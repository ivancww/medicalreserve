/** Medical Reserve Official Cloud GAS. Deploy as the existing Web App. */
const APP_ID = 'medicalreserve';
const PLATFORM_AUTH_URL_PROPERTY = 'AVA_PLATFORM_ADMIN_AUTH_URL';
const PLATFORM_AUTH_URL_FALLBACK = 'https://script.google.com/macros/s/AKfycbzVf1fuxcq8GPSOzS8WvcAtubqaawFj0rbVjxe0LOLKfwbYkRZf7Vs61Q0T73UG6dznww/exec';
const SAVING_RETURN_SHEET = 'SavingPlanReturns';
const SAVING_RETURN_DATASET = 'SavingPlanReturns';
const SAVING_RETURN_PRODUCT = 'aia_hk_5pay';
const SAVING_RETURN_CURRENCY = 'HKD';
const SAVING_RETURN_PAY_TERM = 5;
const SAVING_RETURN_FIELDS = ['return_data_id','dataset_id','data_version','product_id','medical_plan_id','currency','pay_term_years','annual_contribution','issue_age','policy_year','base_value','basic_amount','guaranteed_cash_value','reversionary_bonus_cash_value','terminal_dividend_cash_value','source_case_id','evidence_class','enabled'];
const SAVING_RETURN_EVIDENCE = ['DIRECT','HOLDOUT_REFERENCE','INTERPOLATED_REFERENCE'];
const REQUIRED_FLOW_IDS = ['protection_importance','premium_budget_awareness','premium_need_setup','premium_need_result','funding_source','reserve_intro','reserve_setup','reserve_result','summary'];
const BOOTSTRAP_RESOURCES = ['AppFlow', 'FlowOptions', 'MedicalPlans', 'Visualization', 'SystemSettings'];
const RESOURCE_RULES = {
  AppFlow: { key: ['step_id','page_id','id'], writable: ['step_id','page_id','id','title','subtitle','enabled','visible','sort_order'], required: REQUIRED_FLOW_IDS },
  FlowOptions: { key: ['option_id','id'], writable: ['step_id','flow_id','option_id','id','label','value','sort_order','enabled'] },
  MedicalPlans: { key: ['plan_id','id'], writable: ['plan_id','id','display_name','name','gender','deductible','premium_sheet','sheet_name','enabled','sort_order'] },
  ReserveStrategies: { key: ['strategy_id','id'], writable: ['strategy_id','id','display_name','name','sheet_name','strategy_sheet','start_year','enabled','sort_order'] },
  Visualization: { key: ['key','setting_key'], writable: ['key','setting_key','value','enabled'] },
  SystemSettings: { key: ['key'], writable: ['key','value'], allowedKeys: ['checkpoint_interval','chart_type','allowed_visibility','saving_return_data_version','saving_return_dataset','saving_return_updated_at','default_result_mode'] }
};

function output_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function error_(message, code) { return { success: false, error: { code: code || 'REQUEST_REJECTED', message: String(message) } }; }
function doGet(e) {
  try {
    const action = String(e.parameter.action || '');
    if (action === 'health') return output_({ ok: true, api_version: '1.2.0', action: 'health', data_version: version_(), updated_at: updatedAt_(), data: health_() });
    if (action === 'bootstrap') return output_({ ok: true, api_version: '1.2.0', action: 'bootstrap', data_version: version_(), data: readConfig_() });
    if (action === 'premium') return output_({ ok: true, api_version: '1.2.0', action: 'premium', data_version: version_(), data: premium_(e.parameter) });
    if (action === 'premiumRange') return output_({ ok: true, api_version: '1.2.0', action: 'premiumRange', data_version: version_(), data: premiumRange_(e.parameter) });
    if (action === 'savingPlanReturns') return output_({ ok: true, api_version: '1.2.0', action: 'savingPlanReturns', data_version: savingReturnVersion_(), data: savingPlanReturns_() });
    return output_(error_('Unsupported action', 'UNSUPPORTED_ACTION'));
  } catch (error) { return output_(error_(error.message, error.code || 'READ_FAILED')); }
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents || '{}');
    if (body.action === 'exchangeAdminLaunch') return output_(exchangeAdminLaunch_(body));
    if (body.action === 'writeOfficial') return output_(writeOfficial_(body));
    return output_(error_('Unsupported action', 'UNSUPPORTED_ACTION'));
  } catch (error) { return output_(error_(error.message, error.code || 'REQUEST_REJECTED')); }
}

function exchangeAdminLaunch_(body) {
  if (String(body.appId || '') !== APP_ID || !body.launchTicket) throw new Error('Invalid Medical Reserve Admin launch');
  const endpoint = PropertiesService.getScriptProperties().getProperty(PLATFORM_AUTH_URL_PROPERTY) || PLATFORM_AUTH_URL_FALLBACK;
  const response = UrlFetchApp.fetch(endpoint, { method: 'post', contentType: 'text/plain', muteHttpExceptions: true, payload: JSON.stringify({ action: 'exchangeAppLaunch', launchTicket: String(body.launchTicket), appId: APP_ID }) });
  const value = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() >= 400 || value.success !== true || !value.appGrant) throw new Error('AVA Admin launch authorization failed');
  return value;
}
function verifyGrant_(body) {
  if (String(body.appId || '') !== APP_ID || !body.appGrant) throw new Error('Missing App Admin authorization');
  const endpoint = PropertiesService.getScriptProperties().getProperty(PLATFORM_AUTH_URL_PROPERTY) || PLATFORM_AUTH_URL_FALLBACK;
  const response = UrlFetchApp.fetch(endpoint, { method: 'post', contentType: 'text/plain', muteHttpExceptions: true, payload: JSON.stringify({ action: 'verifyAppGrant', appGrant: String(body.appGrant), appId: APP_ID, operation: 'medical-reserve:official-write' }) });
  const value = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() >= 400 || value.success !== true || value.appId !== APP_ID || value.operation !== 'medical-reserve:official-write') throw new Error('Invalid or expired App Admin authorization');
  return value;
}
function sheet_(name) { const value = SpreadsheetApp.getActive().getSheetByName(name); if (!value) throw new Error(`Sheet not found: ${name}`); return value; }
function rows_(sheet) { const values = sheet.getDataRange().getValues(); if (!values.length) return []; const headers = values.shift().map(String); return values.filter(row => row.some(value => value !== '')).map(row => Object.fromEntries(headers.map((key, index) => [key, row[index]]))); }
function sheetNames_() { return SpreadsheetApp.getActive().getSheets().map(sheet => sheet.getName()); }
function readConfig_() { const data = {}, missing = []; BOOTSTRAP_RESOURCES.forEach(name => { try { data[name] = rows_(sheet_(name)); } catch (_) { data[name] = []; missing.push(name); } }); return { config: data, missing }; }
function health_() {
  const names = sheetNames_(), control = BOOTSTRAP_RESOURCES.map(sheet => ({ sheet, exists: names.includes(sheet) }));
  const mapped = []; if (names.length) rowsSafe_('MedicalPlans').forEach(row => mapped.push({ type: 'premium', id: String(row.plan_id || row.id || ''), sheet: String(row.premium_sheet || row.sheet_name || ''), exists: names.includes(String(row.premium_sheet || row.sheet_name || '')) }));
  const savingReturnSheet = names.includes(SAVING_RETURN_SHEET), savingReturnVersion = savingReturnVersion_();
  return { status: control.every(item => item.exists) && savingReturnSheet && savingReturnVersion != null ? 'ok' : 'warning', spreadsheet_name: SpreadsheetApp.getActive().getName(), control_sheets: control, mapped_data_sheets: mapped, saving_return_dataset: { sheet: SAVING_RETURN_SHEET, exists: savingReturnSheet, data_version: savingReturnVersion } };
}
function rowsSafe_(name) { try { return rows_(sheet_(name)); } catch (_) { return []; } }
function readError_(code, message) { const error = new Error(message); error.code = code; return error; }
function plan_(planId) {
  const id = String(planId || '').trim();
  if (!id) throw readError_('MISSING_PLAN_ID', 'plan_id is required');
  const plan = rowsSafe_('MedicalPlans').find(row => String(row.plan_id || row.id || '').trim() === id && boolean_(row.enabled) !== false);
  if (!plan) throw readError_('PLAN_NOT_FOUND', `Medical plan not found: ${id}`);
  const sheetName = String(plan.premium_sheet || plan.sheet_name || '').trim();
  if (!sheetName || !sheetNames_().includes(sheetName)) throw readError_('MAPPED_PREMIUM_SHEET_NOT_FOUND', `Mapped premium sheet not found: ${sheetName || '(blank)'}`);
  return { row: plan, id, sheetName };
}
function integerAge_(value, label) {
  const age = Number(value);
  if (!Number.isInteger(age) || age < 0 || age > 100) throw readError_('INVALID_AGE', `${label || 'age'} must be an integer from 0 to 100`);
  return age;
}
function firstField_(row, names) { for (const name of names) if (row[name] !== '' && row[name] != null) return row[name]; return undefined; }
function premiumRows_(sheetName) {
  const normalized = [];
  rows_(sheet_(sheetName)).forEach(row => {
    const rawAge = firstField_(row, ['實際年齡','age','attained_age']);
    const rawPremium = firstField_(row, ['年繳保費(港元)','年繳保費 (港元)','annual_premium','premium']);
    const textAge = String(rawAge == null ? '' : rawAge).trim();
    const plus = /^(\d+)\+$/.exec(textAge);
    const minimumAge = plus ? Number(plus[1]) : Number(rawAge);
    const premium = Number(rawPremium);
    if (!Number.isInteger(minimumAge) || minimumAge < 0 || minimumAge > 100 || !Number.isFinite(premium) || premium < 0) return;
    normalized.push({ minimumAge, exact: !plus, sourceAge: plus ? `${minimumAge}+` : minimumAge, annualPremium: premium });
  });
  return normalized;
}
function premiumForAge_(rows, age) {
  const exact = rows.find(row => row.exact && row.minimumAge === age);
  if (exact) return exact;
  const bands = rows.filter(row => !row.exact && row.minimumAge <= age).sort((left, right) => right.minimumAge - left.minimumAge);
  return bands[0] || null;
}
function premium_(parameters) {
  const resolved = plan_(parameters.plan_id), age = integerAge_(parameters.age, 'age');
  const row = premiumForAge_(premiumRows_(resolved.sheetName), age);
  if (!row) throw readError_('PREMIUM_AGE_NOT_FOUND', `Official premium is unavailable for age ${age}`);
  return {
    plan_id: resolved.id,
    display_name: resolved.row.display_name || resolved.row.name || resolved.id,
    gender: resolved.row.gender || 'ALL', deductible: Number(resolved.row.deductible || 0), premium_sheet: resolved.sheetName,
    age, source_age: row.sourceAge, annual_premium: row.annualPremium, currency: 'HKD'
  };
}
function premiumRange_(parameters) {
  const rawStart = parameters.support_start_age ?? parameters.retirement_age;
  const rawEnd = parameters.support_end_age ?? parameters.coverage_age;
  const start = integerAge_(rawStart, 'support_start_age'), end = integerAge_(rawEnd, 'support_end_age');
  if (end < start) throw readError_('INVALID_AGE_RANGE', 'support_end_age must be at or after support_start_age');
  const annual = [];
  for (let age = start; age <= end; age += 1) annual.push(premium_({ plan_id: parameters.plan_id, age }));
  const checkpoints = annual.filter((row, index) => index % 5 === 0 || index === annual.length - 1).map((row, index, values) => ({
    age: row.age, annual_premium: row.annual_premium,
    growth_from_previous_checkpoint_percent: index === 0 ? null : (values[index - 1].annual_premium === 0 ? null : (row.annual_premium / values[index - 1].annual_premium - 1) * 100)
  }));
  const first = annual[0];
  return {
    plan_id: first.plan_id, display_name: first.display_name, gender: first.gender, deductible: first.deductible,
    premium_sheet: first.premium_sheet, support_start_age: start, support_end_age: end,
    retirement_age: start, coverage_age: end, years: annual.length, currency: 'HKD',
    total_premium: annual.reduce((total, row) => total + row.annual_premium, 0),
    annual_premiums: annual.map(row => ({ age: row.age, annual_premium: row.annual_premium, source_age: row.source_age })), checkpoints
  };
}
function savingReturnVersion_() {
  const row = rowsSafe_('SystemSettings').find(item => String(item.key || '') === 'saving_return_data_version');
  if (!row || row.value === '' || row.value == null) return null;
  const version = Number(row.value);
  if (!Number.isInteger(version) || version < 1) throw readError_('INVALID_SAVING_RETURN_VERSION', 'saving_return_data_version must be a positive integer');
  return version;
}
function savingPlanReturns_() {
  const version = savingReturnVersion_();
  if (version == null) throw readError_('SAVING_RETURN_VERSION_MISSING', 'SavingPlanReturns dataset version is unavailable');
  let rows;
  try { rows = rows_(sheet_(SAVING_RETURN_SHEET)); } catch (_) { throw readError_('SAVING_RETURN_SHEET_NOT_FOUND', `Official sheet not found: ${SAVING_RETURN_SHEET}`); }
  const headers = rows.length ? Object.keys(rows[0]) : [];
  if (!SAVING_RETURN_FIELDS.every(field => headers.includes(field))) throw readError_('SAVING_RETURN_SCHEMA_INVALID', 'SavingPlanReturns does not match the approved Layer 2 schema');
  const seen = new Set(), normalized = [];
  rows.forEach((row, index) => {
    const id = String(row.return_data_id || '').trim();
    if (!id || seen.has(id)) throw readError_('SAVING_RETURN_DUPLICATE_KEY', `SavingPlanReturns row ${index + 2} has a missing or duplicate return_data_id`);
    seen.add(id);
    if (Number(row.data_version) !== version || String(row.dataset_id) !== SAVING_RETURN_DATASET || String(row.product_id) !== SAVING_RETURN_PRODUCT || String(row.currency) !== SAVING_RETURN_CURRENCY || Number(row.pay_term_years) !== SAVING_RETURN_PAY_TERM) throw readError_('SAVING_RETURN_SCHEMA_INVALID', `SavingPlanReturns row ${index + 2} has inconsistent dataset metadata`);
    const contribution = Number(row.annual_contribution), issueAge = Number(row.issue_age), policyYear = Number(row.policy_year);
    if (!Number.isFinite(contribution) || contribution < 40000 || contribution > 200000 || !Number.isInteger(issueAge) || issueAge < 0 || issueAge > 100 || !Number.isInteger(policyYear) || policyYear < 1) throw readError_('SAVING_RETURN_FIELD_INVALID', `SavingPlanReturns row ${index + 2} has an invalid contribution or policy-year field`);
    ['base_value','basic_amount','guaranteed_cash_value','reversionary_bonus_cash_value','terminal_dividend_cash_value'].forEach(field => { if (!Number.isFinite(Number(row[field])) || Number(row[field]) < 0) throw readError_('SAVING_RETURN_FIELD_INVALID', `SavingPlanReturns row ${index + 2} has an invalid ${field}`); });
    if (!String(row.medical_plan_id || '').trim() || !String(row.source_case_id || '').trim() || !SAVING_RETURN_EVIDENCE.includes(String(row.evidence_class || '').trim())) throw readError_('SAVING_RETURN_FIELD_INVALID', `SavingPlanReturns row ${index + 2} has invalid evidence metadata`);
    if (row.enabled === '' || row.enabled == null) throw readError_('SAVING_RETURN_FIELD_INVALID', `SavingPlanReturns row ${index + 2} has an invalid enabled flag`);
    const enabled = boolean_(row.enabled); if (enabled === null) throw readError_('SAVING_RETURN_FIELD_INVALID', `SavingPlanReturns row ${index + 2} has an invalid enabled flag`);
    if (enabled) normalized.push({ return_data_id: id, dataset_id: SAVING_RETURN_DATASET, data_version: version, product_id: SAVING_RETURN_PRODUCT, medical_plan_id: String(row.medical_plan_id), currency: SAVING_RETURN_CURRENCY, pay_term_years: SAVING_RETURN_PAY_TERM, annual_contribution: contribution, issue_age: issueAge, policy_year: policyYear, base_value: Number(row.base_value), basic_amount: Number(row.basic_amount), guaranteed_cash_value: Number(row.guaranteed_cash_value), reversionary_bonus_cash_value: Number(row.reversionary_bonus_cash_value), terminal_dividend_cash_value: Number(row.terminal_dividend_cash_value), source_case_id: String(row.source_case_id), evidence_class: String(row.evidence_class), enabled: true });
  });
  if (!normalized.length) throw readError_('SAVING_RETURN_ROWS_MISSING', 'SavingPlanReturns has no enabled rows');
  return { dataset_id: SAVING_RETURN_DATASET, data_version: version, product_id: SAVING_RETURN_PRODUCT, currency: SAVING_RETURN_CURRENCY, pay_term_years: SAVING_RETURN_PAY_TERM, rows: normalized };
}
function version_() { const rows = rowsSafe_('SystemSettings'); const row = rows.find(item => String(item.key || '') === 'medical_reserve_version' || String(item.key || '') === 'data_version'); return Number(row && row.value) || 1; }
function updatedAt_() { const rows = rowsSafe_('SystemSettings'), row = rows.find(item => String(item.key || '') === 'medical_reserve_updated_at' || String(item.key || '') === 'updated_at'); return row ? new Date(row.value).toISOString() : new Date().toISOString(); }
function keyOf_(row, rule) { for (const key of rule.key) if (String(row[key] ?? '').trim()) return String(row[key]).trim(); return ''; }
function boolean_(value) { if (typeof value === 'boolean') return value; const text = String(value).toLowerCase(); if (['true','1','yes'].includes(text)) return true; if (['false','0','no',''].includes(text)) return false; return null; }
function number_(value, label, minimum) { if (value === '' || value == null) return value; const number = Number(value); if (!Number.isFinite(number) || (minimum != null && number < minimum)) throw new Error(`${label} is invalid`); return number; }
function validateRows_(resource, incoming, current) {
  const rule = RESOURCE_RULES[resource]; if (!rule || !Array.isArray(incoming)) throw new Error('Invalid official resource');
  const currentKeys = new Set(current.map(row => keyOf_(row, rule)).filter(Boolean)), seen = new Set();
  incoming.forEach((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`${resource} row ${index + 1} is invalid`);
    const key = keyOf_(row, rule); if (!key || seen.has(key)) throw new Error(`${resource} row ${index + 1} has a missing or duplicate ID`); seen.add(key);
    const existing = current.find(value => keyOf_(value, rule) === key);
    Object.keys(row).forEach(field => { if (!rule.writable.includes(field) && field !== 'updated_at' && String(row[field] ?? '') !== String(existing?.[field] ?? '')) throw new Error(`${resource}.${field} is not writable`); });
    ['enabled','visible'].forEach(field => { if (row[field] !== undefined && boolean_(row[field]) === null) throw new Error(`${resource}.${field} is invalid`); });
    ['sort_order','start_year','deductible','value'].forEach(field => { if (row[field] !== undefined) number_(row[field], `${resource}.${field}`, field === 'deductible' ? 0 : undefined); });
  });
  if (resource === 'AppFlow') rule.required.forEach(id => { if (!seen.has(id)) throw new Error(`Protected flow ID ${id} cannot be removed`); });
  if (resource === 'SystemSettings' && incoming.some(row => !rule.allowedKeys.includes(String(row.key || '')))) throw new Error('Protected SystemSettings key rejected');
  if (resource === 'MedicalPlans') incoming.forEach(row => { const name = String(row.premium_sheet || row.sheet_name || ''); if (!sheetNames_().includes(name)) throw new Error(`Mapped premium sheet does not exist: ${name}`); });
  if (resource === 'ReserveStrategies') incoming.forEach(row => { const name = String(row.sheet_name || row.strategy_sheet || ''); if (!sheetNames_().includes(name)) throw new Error(`Mapped strategy sheet does not exist: ${name}`); const headers = rows_(sheet_(name)); if (headers.length && !['policy_year','support_percent','value_multiple'].every(key => Object.prototype.hasOwnProperty.call(headers[0], key))) throw new Error(`Strategy sheet ${name} does not match the normalized strategy schema`); });
  current.forEach(row => { const key = keyOf_(row, rule); if (key && !seen.has(key) && resource === 'AppFlow') throw new Error(`Protected existing flow ID ${key} cannot be removed`); });
}
function writeOfficial_(body) {
  verifyGrant_(body); const resource = String(body.resource || ''), rule = RESOURCE_RULES[resource]; if (!rule) throw new Error('Unauthorized official resource');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const target = sheet_(resource), current = rows_(target), incoming = body.rows; validateRows_(resource, incoming, current);
    const headers = target.getDataRange().getValues()[0].map(String), currentByKey = new Map(current.map(row => [keyOf_(row, rule), row]));
    const values = incoming.map(row => headers.map(header => rule.writable.includes(header) ? (row[header] ?? currentByKey.get(keyOf_(row, rule))?.[header] ?? '') : (currentByKey.get(keyOf_(row, rule))?.[header] ?? row[header] ?? '')));
    target.getRange(2, 1, Math.max(target.getMaxRows() - 1, 1), headers.length).clearContent(); if (values.length) target.getRange(2, 1, values.length, headers.length).setValues(values);
    const settings = sheet_('SystemSettings'), settingRows = rows_(settings), version = version_() + 1, merged = new Map(settingRows.map(row => [String(row.key), row.value])); merged.set('medical_reserve_version', version); merged.set('medical_reserve_updated_at', new Date().toISOString()); const settingHeaders = settings.getDataRange().getValues()[0].map(String); settings.getRange(2, 1, Math.max(settings.getMaxRows() - 1, 1), settingHeaders.length).clearContent(); settings.getRange(2, 1, merged.size, settingHeaders.length).setValues([...merged].map(([key, value]) => settingHeaders.map(header => header === 'key' ? key : header === 'value' ? value : '')));
    const readBack = rows_(target); const expected = values.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]]))); if (JSON.stringify(readBack) !== JSON.stringify(expected)) throw new Error('Official read-back verification failed');
    return { success: true, resource, version, readBack, synchronized: true };
  } finally { lock.releaseLock(); }
}
