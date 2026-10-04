import { CONTRIBUTION_ANCHORS, EVIDENCE, runOriginalIntentForward } from './research/ipos/original-intent-forward.js';

export { EVIDENCE };

export const LAYER2_DATASET_ID = 'SavingPlanReturns';
export const LAYER2_DATA_VERSION = 1;
export const SAVING_PRODUCT_ID = 'aia_hk_5pay';
export const SAVING_CURRENCY = 'HKD';
export const SAVING_PAY_TERM_YEARS = 5;
export const MIN_ANNUAL_CONTRIBUTION = 40000;
export const MAX_ANNUAL_CONTRIBUTION = 200000;
export const PHASE_OFFSETS = Object.freeze({ phase1: 0, phase2: 5, phase3: 10 });

export const LAYER2_FIELDS = Object.freeze([
  'return_data_id', 'dataset_id', 'data_version', 'product_id', 'medical_plan_id',
  'currency', 'pay_term_years', 'annual_contribution', 'issue_age', 'policy_year',
  'base_value', 'basic_amount', 'guaranteed_cash_value', 'reversionary_bonus_cash_value',
  'terminal_dividend_cash_value', 'source_case_id', 'evidence_class', 'enabled'
]);

const EVIDENCE_CLASSES = new Set(['DIRECT', 'HOLDOUT_REFERENCE', 'INTERPOLATED_REFERENCE']);
const PRODUCT_CASE_PLAN = Object.freeze({ flexible_m: 'flexible_m', prestige_16000: 'prestige_16000', select_18000: 'select_18000' });

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function finite(value, label, minimum = null) {
  const result = Number(value);
  if (!Number.isFinite(result) || (minimum != null && result < minimum)) fail('INVALID_SAVING_RETURN_FIELD', `${label} is invalid`);
  return result;
}

function integer(value, label, minimum = null, maximum = null) {
  const result = finite(value, label, minimum);
  if (!Number.isInteger(result) || (maximum != null && result > maximum)) fail('INVALID_SAVING_RETURN_FIELD', `${label} is invalid`);
  return result;
}

function boolean(value, label) {
  if (![true, false, 'true', 'false', 1, 0, '1', '0'].includes(value)) fail('INVALID_SAVING_RETURN_FIELD', `${label} is invalid`);
  return value === true || value === 'true' || value === 1 || value === '1';
}

function responseData(response) {
  if (!response || response.ok === false) fail('SAVING_RETURN_RESPONSE_INVALID', response?.error?.message || 'Official SavingPlanReturns response is unavailable');
  const data = response.data?.dataset_id ? response.data : response.data?.data?.dataset_id ? response.data.data : response;
  if (!data || typeof data !== 'object') fail('SAVING_RETURN_RESPONSE_INVALID', 'Official SavingPlanReturns dataset is missing');
  return data;
}

export function validateSavingPlanReturnsResponse(response, { expectedVersion = null } = {}) {
  const data = responseData(response);
  if (data.dataset_id !== LAYER2_DATASET_ID) fail('SAVING_RETURN_DATASET_INVALID', 'Unexpected SavingPlanReturns dataset');
  const version = integer(data.data_version, 'data_version', 1);
  if (expectedVersion != null && version !== Number(expectedVersion)) fail('SAVING_RETURN_VERSION_MISMATCH', 'SavingPlanReturns dataset version does not match the expected version');
  if (data.product_id !== SAVING_PRODUCT_ID) fail('SAVING_RETURN_PRODUCT_UNSUPPORTED', 'Only the approved AIA HK 5Pay Saving Plan is supported');
  if (data.currency !== SAVING_CURRENCY) fail('SAVING_RETURN_CURRENCY_UNSUPPORTED', 'Only HKD SavingPlanReturns data is supported');
  if (Number(data.pay_term_years) !== SAVING_PAY_TERM_YEARS) fail('SAVING_RETURN_PAY_TERM_UNSUPPORTED', 'Only the approved 5Pay Saving Plan is supported');
  if (!Array.isArray(data.rows) || !data.rows.length) fail('SAVING_RETURN_ROWS_MISSING', 'SavingPlanReturns contains no rows');

  const ids = new Set();
  const rows = data.rows.map((row, index) => {
    if (!row || typeof row !== 'object') fail('SAVING_RETURN_SCHEMA_INVALID', `SavingPlanReturns row ${index + 1} is invalid`);
    LAYER2_FIELDS.forEach(field => { if (!(field in row)) fail('SAVING_RETURN_SCHEMA_INVALID', `SavingPlanReturns row ${index + 1} is missing ${field}`); });
    const id = String(row.return_data_id).trim();
    if (!id || ids.has(id)) fail('SAVING_RETURN_DUPLICATE_KEY', `SavingPlanReturns row ${index + 1} has a missing or duplicate return_data_id`);
    ids.add(id);
    if (String(row.dataset_id) !== LAYER2_DATASET_ID || Number(row.data_version) !== version) fail('SAVING_RETURN_SCHEMA_INVALID', `SavingPlanReturns row ${index + 1} has inconsistent dataset metadata`);
    if (String(row.product_id) !== SAVING_PRODUCT_ID || String(row.currency) !== SAVING_CURRENCY || Number(row.pay_term_years) !== SAVING_PAY_TERM_YEARS) fail('SAVING_RETURN_SCHEMA_INVALID', `SavingPlanReturns row ${index + 1} has unsupported product metadata`);
    const annualContribution = finite(row.annual_contribution, 'annual_contribution', MIN_ANNUAL_CONTRIBUTION);
    if (annualContribution > MAX_ANNUAL_CONTRIBUTION) fail('SAVING_RETURN_CONTRIBUTION_OUT_OF_RANGE', `SavingPlanReturns row ${index + 1} is outside the supported annual contribution range`);
    const normalized = {
      return_data_id: id,
      dataset_id: LAYER2_DATASET_ID,
      data_version: version,
      product_id: SAVING_PRODUCT_ID,
      medical_plan_id: String(row.medical_plan_id).trim(),
      currency: SAVING_CURRENCY,
      pay_term_years: SAVING_PAY_TERM_YEARS,
      annual_contribution: annualContribution,
      issue_age: integer(row.issue_age, 'issue_age', 0, 100),
      policy_year: integer(row.policy_year, 'policy_year', 1),
      base_value: finite(row.base_value, 'base_value', 0),
      basic_amount: finite(row.basic_amount, 'basic_amount', 0),
      guaranteed_cash_value: finite(row.guaranteed_cash_value, 'guaranteed_cash_value', 0),
      reversionary_bonus_cash_value: finite(row.reversionary_bonus_cash_value, 'reversionary_bonus_cash_value', 0),
      terminal_dividend_cash_value: finite(row.terminal_dividend_cash_value, 'terminal_dividend_cash_value', 0),
      source_case_id: String(row.source_case_id).trim(),
      evidence_class: String(row.evidence_class).trim(),
      enabled: boolean(row.enabled, 'enabled')
    };
    if (!normalized.medical_plan_id || !PRODUCT_CASE_PLAN[normalized.medical_plan_id] || !normalized.source_case_id || !EVIDENCE_CLASSES.has(normalized.evidence_class)) fail('SAVING_RETURN_SCHEMA_INVALID', `SavingPlanReturns row ${index + 1} has invalid evidence metadata`);
    return normalized;
  }).filter(row => row.enabled);
  if (!rows.length) fail('SAVING_RETURN_ROWS_MISSING', 'SavingPlanReturns has no enabled rows');
  return { dataset_id: LAYER2_DATASET_ID, data_version: version, product_id: SAVING_PRODUCT_ID, currency: SAVING_CURRENCY, pay_term_years: SAVING_PAY_TERM_YEARS, rows };
}

function interpolate(left, right, target, field) {
  const weight = (target - left.annual_contribution) / (right.annual_contribution - left.annual_contribution);
  return Number(left[field]) + weight * (Number(right[field]) - Number(left[field]));
}

function rowCandidates(rows, { medicalPlanId, issueAge, policyYear }) {
  return rows.filter(row => row.medical_plan_id === medicalPlanId && row.issue_age === issueAge && row.policy_year === policyYear).sort((left, right) => left.annual_contribution - right.annual_contribution);
}

export function resolvePhaseIssueAge(currentAge, phaseId) {
  const age = integer(currentAge, 'currentAge', 0, 100);
  if (!(phaseId in PHASE_OFFSETS)) fail('PHASE_ID_UNSUPPORTED', `Unsupported phase: ${phaseId}`);
  return age + PHASE_OFFSETS[phaseId];
}

export function resolveOfficialBaseState(response, { currentAge, phaseId = 'phase1', attainedAge, annualContribution, medicalPlanId }) {
  const data = validateSavingPlanReturnsResponse(response);
  const issueAge = resolvePhaseIssueAge(currentAge, phaseId);
  const age = integer(attainedAge, 'attainedAge', issueAge, 100);
  const contribution = finite(annualContribution, 'annualContribution', MIN_ANNUAL_CONTRIBUTION);
  if (contribution > MAX_ANNUAL_CONTRIBUTION) return { status: EVIDENCE.OUT_OF_RANGE, issueAge, policyYear: age - issueAge, state: null, sourceCaseIds: [] };
  const policyYear = age - issueAge;
  const candidates = rowCandidates(data.rows, { medicalPlanId, issueAge, policyYear });
  const exact = candidates.find(row => row.annual_contribution === contribution);
  if (exact) return { status: EVIDENCE.DIRECT, issueAge, policyYear, state: exact, sourceCaseIds: [exact.source_case_id] };
  const lower = [...candidates].reverse().find(row => row.annual_contribution < contribution);
  const upper = candidates.find(row => row.annual_contribution > contribution);
  if (!lower || !upper) return { status: EVIDENCE.OUT_OF_RANGE, issueAge, policyYear, state: null, sourceCaseIds: [] };
  const fields = ['base_value', 'basic_amount', 'guaranteed_cash_value', 'reversionary_bonus_cash_value', 'terminal_dividend_cash_value'];
  const state = { ...lower, annual_contribution: contribution, return_data_id: `interpolated:${medicalPlanId}:${issueAge}:${policyYear}:${contribution}`, evidence_class: 'INTERPOLATED_REFERENCE', source_case_id: `${lower.source_case_id}|${upper.source_case_id}` };
  fields.forEach(field => { state[field] = interpolate(lower, upper, contribution, field); });
  return { status: EVIDENCE.INTERPOLATED, issueAge, policyYear, state, sourceCaseIds: [lower.source_case_id, upper.source_case_id] };
}

export function hydrateForwardDataset(response, frozenDataset) {
  const data = validateSavingPlanReturnsResponse(response);
  if (!frozenDataset || !Array.isArray(frozenDataset.cases)) fail('FORWARD_DATASET_INVALID', 'Frozen Forward dataset is unavailable');
  const rowsByCase = new Map();
  data.rows.forEach(row => { if (!rowsByCase.has(row.source_case_id)) rowsByCase.set(row.source_case_id, []); rowsByCase.get(row.source_case_id).push(row); });
  const knownCases = new Set(frozenDataset.cases.map(item => item.caseId));
  for (const sourceCaseId of rowsByCase.keys()) if (!knownCases.has(sourceCaseId)) fail('SAVING_RETURN_SOURCE_CASE_UNKNOWN', `SavingPlanReturns source case is not present in the frozen evidence dataset: ${sourceCaseId}`);
  const cases = frozenDataset.cases.map(item => {
    const officialRows = rowsByCase.get(item.caseId);
    if (!officialRows?.length) return item;
    const baseCurve = officialRows.sort((left, right) => left.policy_year - right.policy_year).map(row => ({
      policyYear: row.policy_year,
      paidPremiumTotal: row.annual_contribution * SAVING_PAY_TERM_YEARS,
      guaranteedCashValue: row.guaranteed_cash_value,
      reversionaryBonusCashValue: row.reversionary_bonus_cash_value,
      terminalDividendCashValue: row.terminal_dividend_cash_value,
      projectedRemainingSurrenderValue: row.base_value
    }));
    return { ...item, initialBasicAmount: officialRows[0].basic_amount, baseCurve };
  });
  return { ...frozenDataset, layer2: { datasetId: data.dataset_id, dataVersion: data.data_version }, cases };
}

export function runForwardWithOfficialReturns(input, response, frozenDataset) {
  return runOriginalIntentForward(input, hydrateForwardDataset(response, frozenDataset));
}

export function contributionEvidence(annualContribution) {
  const value = Number(annualContribution);
  if (!Number.isFinite(value) || value < MIN_ANNUAL_CONTRIBUTION || value > MAX_ANNUAL_CONTRIBUTION) return EVIDENCE.OUT_OF_RANGE;
  return CONTRIBUTION_ANCHORS.some(([anchor]) => anchor === value) ? EVIDENCE.DIRECT : EVIDENCE.INTERPOLATED;
}
