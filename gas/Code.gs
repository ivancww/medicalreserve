/** Medical Reserve Official Cloud GAS. Deploy as the existing Web App. */
const APP_ID = 'medicalreserve';
const PLATFORM_AUTH_URL_PROPERTY = 'AVA_PLATFORM_ADMIN_AUTH_URL';
const PLATFORM_AUTH_URL_FALLBACK = 'https://script.google.com/macros/s/AKfycbzVf1fuxcq8GPSOzS8WvcAtubqaawFj0rbVjxe0LOLKfwbYkRZf7Vs61Q0T73UG6dznww/exec';
const REQUIRED_FLOW_IDS = ['funding','timeline','coverage','plan','journey','total','transition','strategy','support','summary'];
const RESOURCE_RULES = {
  AppFlow: { key: ['step_id','page_id','id'], writable: ['step_id','page_id','id','title','subtitle','enabled','visible','sort_order'], required: REQUIRED_FLOW_IDS },
  FlowOptions: { key: ['option_id','id'], writable: ['step_id','flow_id','option_id','id','label','value','sort_order','enabled'] },
  MedicalPlans: { key: ['plan_id','id'], writable: ['plan_id','id','display_name','name','gender','deductible','premium_sheet','sheet_name','enabled','sort_order'] },
  ReserveStrategies: { key: ['strategy_id','id'], writable: ['strategy_id','id','display_name','name','sheet_name','strategy_sheet','start_year','enabled','sort_order'] },
  Visualization: { key: ['key','setting_key'], writable: ['key','setting_key','value','enabled'] },
  SystemSettings: { key: ['key'], writable: ['key','value'], allowedKeys: ['checkpoint_interval','chart_type','allowed_visibility'] }
};

function output_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function error_(message, code) { return { success: false, error: { code: code || 'REQUEST_REJECTED', message: String(message) } }; }
function doGet(e) {
  try {
    const action = String(e.parameter.action || '');
    if (action === 'health') return output_({ ok: true, api_version: '1.1.0', action: 'health', data_version: version_(), updated_at: updatedAt_(), data: health_() });
    if (action === 'bootstrap') return output_({ ok: true, api_version: '1.1.0', action: 'bootstrap', data_version: version_(), data: readConfig_() });
    return output_(error_('Unsupported action', 'UNSUPPORTED_ACTION'));
  } catch (error) { return output_(error_(error.message, 'READ_FAILED')); }
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
function readConfig_() { const data = {}, missing = []; Object.keys(RESOURCE_RULES).forEach(name => { try { data[name] = rows_(sheet_(name)); } catch (_) { data[name] = []; missing.push(name); } }); return { config: data, missing }; }
function health_() {
  const names = sheetNames_(), control = Object.keys(RESOURCE_RULES).map(sheet => ({ sheet, exists: names.includes(sheet) }));
  const mapped = []; if (names.length) rowsSafe_('MedicalPlans').forEach(row => mapped.push({ type: 'premium', id: String(row.plan_id || row.id || ''), sheet: String(row.premium_sheet || row.sheet_name || ''), exists: names.includes(String(row.premium_sheet || row.sheet_name || '')) }));
  return { status: control.every(item => item.exists) ? 'ok' : 'warning', spreadsheet_name: SpreadsheetApp.getActive().getName(), control_sheets: control, mapped_data_sheets: mapped };
}
function rowsSafe_(name) { try { return rows_(sheet_(name)); } catch (_) { return []; } }
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
