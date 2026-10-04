// Original-intent Forward calculation.
// It reuses genuine annual paths and verified identities. Production calls it
// through saving-plan-returns.js after hydrating official SavingPlanReturns.
import DEFAULT_DATASET from './fixtures/dataset.json' with { type: 'json' };

export { DEFAULT_DATASET as default };

export const ENGINE_VERSION = 'ipos-original-intent-genuine-path-forward-v1';
export const ROUTING_RULE = 'FIVE_YEAR_ROTATING_PHASE_SUPPORT';
export const CONTRIBUTION_ANCHORS = Object.freeze([
  [40000, 404041], [70000, 710660], [100000, 1015229], [130000, 1323829],
  [150000, 1527495], [180000, 1832994], [200000, 2042901]
]);
export const EVIDENCE = Object.freeze({
  DIRECT: 'DIRECTLY_VALIDATED', INTERPOLATED: 'INTERPOLATED_EVIDENCE_SUPPORTED',
  NOT_VALIDATED: 'NOT_YET_VALIDATED', OUT_OF_RANGE: 'OUT_OF_SUPPORTED_RANGE', NOT_ISSUED: 'NOT_ISSUED'
});

const CONSTRUCTION_ROLES = new Set(['calibration', 'regression']);
const OFFSETS = Object.freeze({ phase1: 0, phase2: 5, phase3: 10 });

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function orderedPhases(phases) {
  const configured = (Array.isArray(phases) ? phases : []).map((phase, index) => ({
    id: phase.id || `phase${index + 1}`, enabled: phase.enabled !== false,
    annualContribution: Number(phase.annualContribution)
  }));
  const byId = new Map(configured.map(phase => [phase.id, phase]));
  if (!byId.get('phase1')?.enabled) fail('PHASE_1_REQUIRED', 'Phase 1 is required');
  if (byId.get('phase3')?.enabled && !byId.get('phase2')?.enabled) fail('PHASE_3_REQUIRES_PHASE_2', 'Phase 3 requires Phase 2');
  const enabled = ['phase1', 'phase2', 'phase3'].map(id => byId.get(id)).filter(phase => phase?.enabled);
  enabled.forEach(phase => {
    if (!Number.isFinite(phase.annualContribution) || phase.annualContribution <= 0) fail('INVALID_CONTRIBUTION', `${phase.id} annual contribution is invalid`);
  });
  return enabled;
}

export function routeSupportPhase({ attainedAge, supportStartAge, enabledPhaseIds }) {
  const age = Number(attainedAge), start = Number(supportStartAge), ids = [...enabledPhaseIds];
  if (!Number.isInteger(age) || !Number.isInteger(start) || age < start) return null;
  if (!ids.length) fail('NO_ENABLED_PHASES', 'At least one phase is required');
  const supportYearIndex = age - start;
  const windowIndex = Math.floor(supportYearIndex / 5);
  return ids[windowIndex % ids.length];
}

export function resolveBasicAmount(annualContribution) {
  const premium = Number(annualContribution), minimum = CONTRIBUTION_ANCHORS[0][0], maximum = CONTRIBUTION_ANCHORS.at(-1)[0];
  if (!Number.isFinite(premium) || premium < minimum || premium > maximum) return { status: EVIDENCE.OUT_OF_RANGE, BasicAmount: null };
  const exact = CONTRIBUTION_ANCHORS.find(([value]) => value === premium);
  if (exact) return { status: EVIDENCE.DIRECT, BasicAmount: exact[1] };
  for (let index = 1; index < CONTRIBUTION_ANCHORS.length; index += 1) {
    const left = CONTRIBUTION_ANCHORS[index - 1], right = CONTRIBUTION_ANCHORS[index];
    if (premium < right[0]) {
      const weight = (premium - left[0]) / (right[0] - left[0]);
      return { status: EVIDENCE.INTERPOLATED, BasicAmount: left[1] + weight * (right[1] - left[1]), lowerAnchor: left[0], upperAnchor: right[0] };
    }
  }
  return { status: EVIDENCE.OUT_OF_RANGE, BasicAmount: null };
}

function scheduleMap(item) { return new Map(item.withdrawalSchedule.map(row => [row.age, Number(row.withdrawal || 0)])); }
function rowAt(item, age) { return item.rows.find(row => row.age === age); }
function baseAt(item, policyYear) { return item.baseCurve.find(row => row.policyYear === policyYear); }
function noWithdrawalValueAt(item, age) {
  const policyYear = age - item.issueAge, base = baseAt(item, policyYear);
  if (base) return base.projectedRemainingSurrenderValue;
  const row = rowAt(item, age); if (!row) return null;
  const schedule = scheduleMap(item), firstSupportAge = item.withdrawalSchedule.find(value => Number(value.withdrawal || 0) > 0)?.age;
  if (firstSupportAge == null || age < firstSupportAge) return row.projectedRemainingSurrenderValue;
  if (age === firstSupportAge) return row.projectedRemainingSurrenderValue + (schedule.get(age) || 0);
  return null;
}
function historiesMatch(item, issueAge, age, supportHistory) {
  const source = scheduleMap(item);
  for (let attained = issueAge + 1; attained <= age; attained += 1) {
    if ((source.get(attained) || 0) !== (supportHistory.get(attained) || 0)) return false;
  }
  return true;
}
function interpolate(left, right, targetBasic, field) {
  const leftBasic = Number(left.item.initialBasicAmount), rightBasic = Number(right.item.initialBasicAmount);
  const weight = (targetBasic - leftBasic) / (rightBasic - leftBasic);
  return Number(left[field]) + weight * (Number(right[field]) - Number(left[field]));
}
function bracket(candidates, premium) {
  const unique = [...new Map(candidates.map(value => [value.item.annualPremium, value])).values()].sort((left, right) => left.item.annualPremium - right.item.annualPremium);
  const lower = [...unique].reverse().find(value => value.item.annualPremium < premium);
  const upper = unique.find(value => value.item.annualPremium > premium);
  return lower && upper ? [lower, upper] : null;
}

function projectNoSupport({ phase, age, cases, basic }) {
  const policyYear = age - phase.issueAge;
  if (policyYear < 1) return { remainingValue: 0, BasicAmount: basic.BasicAmount, evidenceStatus: EVIDENCE.NOT_ISSUED, sourceCaseIds: [] };
  const candidates = cases.filter(item => item.issueAge === phase.issueAge && noWithdrawalValueAt(item, age) != null).map(item => ({ item, value: noWithdrawalValueAt(item, age) }));
  const exact = candidates.find(value => value.item.annualPremium === phase.annualContribution);
  if (exact) return { remainingValue: exact.value, BasicAmount: exact.item.initialBasicAmount, evidenceStatus: EVIDENCE.DIRECT, sourceCaseIds: [exact.item.caseId] };
  const pair = bracket(candidates, phase.annualContribution);
  if (!pair || basic.status === EVIDENCE.OUT_OF_RANGE) return { remainingValue: null, BasicAmount: basic.BasicAmount, evidenceStatus: EVIDENCE.OUT_OF_RANGE, sourceCaseIds: [] };
  return {
    remainingValue: interpolate(pair[0], pair[1], basic.BasicAmount, 'value'), BasicAmount: basic.BasicAmount,
    evidenceStatus: EVIDENCE.INTERPOLATED, sourceCaseIds: pair.map(value => value.item.caseId)
  };
}

function projectPhase({ phase, age, supportHistory, cases }) {
  const basic = resolveBasicAmount(phase.annualContribution);
  if (basic.status === EVIDENCE.OUT_OF_RANGE) return { remainingValue: null, BasicAmount: null, evidenceStatus: EVIDENCE.OUT_OF_RANGE, sourceCaseIds: [] };
  const positive = [...supportHistory.entries()].filter(([attained, amount]) => attained <= age && amount > 0);
  if (!positive.length) return projectNoSupport({ phase, age, cases, basic });

  const candidates = cases.filter(item => item.issueAge === phase.issueAge && rowAt(item, age) && historiesMatch(item, phase.issueAge, age, supportHistory))
    .map(item => ({ item, value: rowAt(item, age).projectedRemainingSurrenderValue, BasicAmount: rowAt(item, age).basicAmountAfterWithdrawal }));
  const exact = candidates.find(value => value.item.annualPremium === phase.annualContribution);
  if (exact) return { remainingValue: exact.value, BasicAmount: exact.BasicAmount, evidenceStatus: EVIDENCE.DIRECT, sourceCaseIds: [exact.item.caseId] };
  const pair = bracket(candidates, phase.annualContribution);
  if (pair) return {
    remainingValue: interpolate(pair[0], pair[1], basic.BasicAmount, 'value'),
    BasicAmount: interpolate(pair[0], pair[1], basic.BasicAmount, 'BasicAmount'),
    evidenceStatus: EVIDENCE.INTERPOLATED, sourceCaseIds: pair.map(value => value.item.caseId)
  };

  if (positive.length === 1 && positive[0][0] === age) {
    const base = projectNoSupport({ phase, age, cases, basic });
    if (base.remainingValue != null) return { ...base, remainingValue: base.remainingValue - positive[0][1], firstSupportIdentity: true };
  }
  return { remainingValue: null, BasicAmount: basic.BasicAmount, evidenceStatus: EVIDENCE.NOT_VALIDATED, sourceCaseIds: [] };
}

function premiumsByAge(schedule, start, end) {
  const map = new Map();
  for (const row of schedule || []) {
    const age = Number(row.age), premium = Number(row.annual_premium ?? row.annualPremium);
    if (map.has(age)) fail('DUPLICATE_PREMIUM_AGE', `Duplicate Official medical premium age ${age}`);
    if (Number.isInteger(age) && Number.isFinite(premium) && premium >= 0) map.set(age, premium);
  }
  for (let age = start; age <= end; age += 1) if (!map.has(age)) fail('OFFICIAL_PREMIUM_AGE_MISSING', `Missing Official medical premium for age ${age}`);
  return map;
}
function combinedStatus(values) {
  const statuses = values.map(value => value.evidenceStatus);
  if (statuses.includes(EVIDENCE.OUT_OF_RANGE)) return EVIDENCE.OUT_OF_RANGE;
  if (statuses.includes(EVIDENCE.NOT_VALIDATED)) return EVIDENCE.NOT_VALIDATED;
  if (statuses.includes(EVIDENCE.INTERPOLATED)) return EVIDENCE.INTERPOLATED;
  return EVIDENCE.DIRECT;
}

export function runOriginalIntentForward(input, dataset = DEFAULT_DATASET) {
  const currentAge = Number(input.currentAge), supportStartAge = Number(input.supportStartAge), supportEndAge = Number(input.supportEndAge);
  if (!Number.isInteger(currentAge) || !Number.isInteger(supportStartAge) || !Number.isInteger(supportEndAge) || supportEndAge < supportStartAge) fail('INVALID_AGE_RANGE', 'Forward ages are invalid');
  if (!String(input.planId || '').trim()) fail('MISSING_PLAN_ID', 'Official Medical plan_id is required');
  const enabled = orderedPhases(input.phases);
  const phases = enabled.map(phase => ({ ...phase, issueAge: currentAge + OFFSETS[phase.id] }));
  const premiumMap = premiumsByAge(input.medicalPremiumSchedule, supportStartAge, supportEndAge);
  const cases = dataset.cases.filter(item => CONSTRUCTION_ROLES.has(item.role));
  const histories = new Map(phases.map(phase => [phase.id, new Map()]));
  const rows = []; let cumulative = 0;

  for (let age = supportStartAge; age <= supportEndAge; age += 1) {
    const activePhase = routeSupportPhase({ attainedAge: age, supportStartAge, enabledPhaseIds: phases.map(phase => phase.id) });
    const officialMedicalPremium = premiumMap.get(age);
    // Genuine iPOS tables display support as whole HKD and use truncation for the matched Official premium paths.
    const medicalReserveSupport = Math.floor(officialMedicalPremium);
    cumulative += officialMedicalPremium;
    histories.get(activePhase).set(age, medicalReserveSupport);
    const projections = phases.map(phase => ({ phaseId: phase.id, ...projectPhase({ phase, age, supportHistory: histories.get(phase.id), cases }) }));
    const valid = projections.every(value => value.remainingValue != null);
    rows.push({
      age, officialMedicalPremium, medicalReserveSupport, premiumRoundingAdjustment: officialMedicalPremium - medicalReserveSupport,
      activeSupportPhase: activePhase, cumulativeMedicalReserveSupport: cumulative,
      phase1RemainingValue: projections.find(value => value.phaseId === 'phase1')?.remainingValue ?? null,
      phase2RemainingValue: projections.find(value => value.phaseId === 'phase2')?.remainingValue ?? null,
      phase3RemainingValue: projections.find(value => value.phaseId === 'phase3')?.remainingValue ?? null,
      combinedRemainingMedicalReserveValue: valid ? projections.reduce((total, value) => total + value.remainingValue, 0) : null,
      evidenceStatus: combinedStatus(projections), phaseEvidence: projections
    });
  }
  return {
    calculationEngineVersion: ENGINE_VERSION, routingRule: ROUTING_RULE, productionActive: false,
    currentAge, supportStartAge, supportEndAge, planId: input.planId, deductible: input.deductible ?? null,
    phases: phases.map(phase => ({ ...phase, initialBasicAmount: resolveBasicAmount(phase.annualContribution) })), schedule: rows,
    cumulativeMedicalReserveSupport: rows.at(-1)?.cumulativeMedicalReserveSupport || 0,
    finalCombinedRemainingMedicalReserveValue: rows.at(-1)?.combinedRemainingMedicalReserveValue ?? null,
    overallEvidenceStatus: combinedStatus(rows.flatMap(row => row.phaseEvidence))
  };
}
