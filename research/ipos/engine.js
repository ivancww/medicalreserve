const COMPONENTS = Object.freeze(['guaranteedCashValue', 'reversionaryBonusCashValue', 'terminalDividendCashValue']);

function finite(value) { return Number.isFinite(Number(value)); }
function number(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(label + ' must be numeric');
  return result;
}

export function policyYearFor(issueAge, currentAge) {
  const issue = number(issueAge, 'issueAge');
  const age = number(currentAge, 'currentAge');
  if (!Number.isInteger(issue) || !Number.isInteger(age) || issue < 0 || age < issue) throw new Error('Invalid age / Policy Year mapping');
  return age - issue;
}

export function interpolate(points, x) {
  const usable = points.filter(point => finite(point.x) && finite(point.value)).sort((a, b) => a.x - b.x);
  if (!usable.length) return null;
  if (x <= usable[0].x) return usable[0].value;
  if (x >= usable[usable.length - 1].x) return usable[usable.length - 1].value;
  for (let index = 1; index < usable.length; index += 1) {
    if (x <= usable[index].x) {
      const left = usable[index - 1], right = usable[index], span = right.x - left.x;
      return span === 0 ? left.value : left.value + ((x - left.x) / span) * (right.value - left.value);
    }
  }
  return usable[usable.length - 1].value;
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}
function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function normalizeCase(item) {
  if (!item || item.product !== 'AIA 環宇盈活儲蓄保險計劃' || item.currency !== 'HKD' || item.paymentTerm !== 5) throw new Error('Unsupported product, currency, or payment term');
  if (!Number.isInteger(item.issueAge) || item.issueAge < 0) throw new Error('Invalid issue age');
  if (!finite(item.annualPremium) || item.annualPremium <= 0 || !finite(item.initialBasicAmount) || item.initialBasicAmount <= 0) throw new Error('Invalid premium or Basic Amount');
  if (!['Original', 'AVF', 'AVPU'].includes(item.withdrawalPattern)) throw new Error('Unsupported withdrawal pattern');
  return item;
}
function components(row, basicAmount) {
  const scale = basicAmount > 0 ? basicAmount : 1;
  return {
    guaranteedCashValue: Number(row.guaranteedCashValue || 0) / scale,
    reversionaryBonusCashValue: Number(row.reversionaryBonusCashValue || 0) / scale,
    terminalDividendCashValue: Number(row.terminalDividendCashValue || 0) / scale
  };
}

export function buildCalibrationModel(cases) {
  const calibration = cases.filter(item => item.role === 'calibration').map(normalizeCase);
  if (!calibration.length) throw new Error('No calibration cases available');
  const basicAnchors = [...new Map(calibration.map(item => [item.annualPremium, item.initialBasicAmount])).entries()]
    .map(([premium, basicAmount]) => ({ x: Number(premium), value: Number(basicAmount) })).sort((a, b) => a.x - b.x);
  const baseByYear = new Map();
  calibration.forEach(item => item.baseCurve.forEach(row => {
    const list = baseByYear.get(row.policyYear) || [];
    list.push({ ...components(row, item.initialBasicAmount), projectedRemainingSurrenderValue: Number(row.projectedRemainingSurrenderValue) / item.initialBasicAmount });
    baseByYear.set(row.policyYear, list);
  }));
  calibration.forEach(item => item.rows.filter(row => Number(row.withdrawal || 0) === 0).forEach(row => {
    const list = baseByYear.get(row.policyYear) || [];
    list.push({ ...components(row, item.initialBasicAmount), projectedRemainingSurrenderValue: Number(row.projectedRemainingSurrenderValue) / item.initialBasicAmount });
    baseByYear.set(row.policyYear, list);
  }));
  const baseCurve = [...baseByYear.entries()].map(([policyYear, rows]) => ({
    policyYear,
    guaranteedCashValue: mean(rows.map(row => row.guaranteedCashValue)),
    reversionaryBonusCashValue: mean(rows.map(row => row.reversionaryBonusCashValue)),
    terminalDividendCashValue: mean(rows.map(row => row.terminalDividendCashValue)),
    projectedRemainingSurrenderValue: mean(rows.map(row => row.projectedRemainingSurrenderValue))
  })).sort((a, b) => a.policyYear - b.policyYear);
  const scheduleByPattern = new Map();
  const allSchedule = [];
  calibration.forEach(item => item.withdrawalSchedule.forEach(row => {
    const point = { x: row.age, value: Number(row.withdrawal || 0) / item.initialBasicAmount };
    allSchedule.push(point);
    const list = scheduleByPattern.get(item.withdrawalPattern) || [];
    list.push(point);
    scheduleByPattern.set(item.withdrawalPattern, list);
  }));
  const reductionRatios = [];
  calibration.forEach(item => item.rows.forEach(row => {
    const schedule = item.withdrawalSchedule.find(point => point.age === row.age);
    const gcvTap = Number(schedule?.withdrawalFromGuaranteedCashValue || 0);
    const reduction = Number(item.initialBasicAmount) - Number(row.basicAmountAfterWithdrawal || item.initialBasicAmount);
    if (gcvTap > 0 && reduction > 0) reductionRatios.push(reduction / gcvTap);
  }));
  return Object.freeze({ calibrationCaseIds: calibration.map(item => item.caseId), basicAnchors, baseCurve, scheduleByPattern, allSchedule, basicReductionPerGuaranteedWithdrawal: median(reductionRatios) });
}

function baseAt(model, policyYear, basicAmount) {
  const fields = COMPONENTS.concat('projectedRemainingSurrenderValue');
  const result = { policyYear };
  fields.forEach(field => { result[field] = interpolate(model.baseCurve.map(row => ({ x: row.policyYear, value: row[field] })), policyYear) * basicAmount; });
  return result;
}
function withdrawalAt(model, pattern, age, basicAmount, externalSchedule) {
  if (externalSchedule?.length) return Math.max(0, interpolate(externalSchedule.map(row => ({ x: row.age, value: Number(row.withdrawal || 0) })), age) || 0);
  const points = model.scheduleByPattern.get(pattern) || model.allSchedule;
  return Math.max(0, (interpolate(points, age) || 0) * basicAmount);
}

export function projectPolicy(input, model) {
  const policy = normalizeCase(input);
  const endAge = Number(input.endAge ?? policy.issueAge + 60);
  if (!Number.isInteger(endAge) || endAge < policy.issueAge) throw new Error('Invalid projection end age');
  const basicAmount = interpolate(model.basicAnchors, policy.annualPremium);
  const inRange = policy.annualPremium >= model.basicAnchors[0].x && policy.annualPremium <= model.basicAnchors[model.basicAnchors.length - 1].x;
  const startAge = Number(input.withdrawalStartAge ?? policy.withdrawalStartAge ?? endAge + 1);
  let currentBasicAmount = basicAmount || policy.initialBasicAmount;
  let ratios = { guaranteedCashValue: 1, reversionaryBonusCashValue: 1, terminalDividendCashValue: 1 };
  let firstShortfallAge = null;
  const rows = [];
  for (let age = policy.issueAge + 1; age <= endAge; age += 1) {
    const policyYear = policyYearFor(policy.issueAge, age);
    const base = baseAt(model, policyYear, currentBasicAmount);
    const available = {};
    COMPONENTS.forEach(component => { available[component] = Math.max(0, base[component] * ratios[component]); });
    const requestedWithdrawal = age >= startAge ? withdrawalAt(model, policy.withdrawalPattern, age, currentBasicAmount, policy.withdrawalSchedule) : 0;
    let remainingWithdrawal = requestedWithdrawal;
    const allocation = { guaranteedCashValue: 0, reversionaryBonusCashValue: 0, terminalDividendCashValue: 0 };
    for (const component of ['reversionaryBonusCashValue', 'terminalDividendCashValue', 'guaranteedCashValue']) {
      allocation[component] = Math.min(available[component], remainingWithdrawal);
      remainingWithdrawal -= allocation[component];
    }
    const insufficient = remainingWithdrawal > 0.5;
    if (insufficient && firstShortfallAge == null) firstShortfallAge = age;
    const projected = insufficient ? 0 : Math.max(0, COMPONENTS.reduce((sum, component) => sum + available[component] - allocation[component], 0));
    const basicBefore = currentBasicAmount;
    if (!insufficient && allocation.guaranteedCashValue > 0) currentBasicAmount = Math.max(0, currentBasicAmount - allocation.guaranteedCashValue * model.basicReductionPerGuaranteedWithdrawal);
    COMPONENTS.forEach(component => { if (base[component] > 0) ratios[component] = Math.max(0, (available[component] - allocation[component]) / base[component]); });
    rows.push({
      age, policyYear, withdrawal: Math.round(requestedWithdrawal), withdrawalType: requestedWithdrawal > 0 ? 'medicalWithdrawal' : 'zeroWithdrawal',
      basicAmountAfterWithdrawal: Math.round(currentBasicAmount), basicAmountBeforeWithdrawal: Math.round(basicBefore),
      guaranteedCashValue: Math.round(Math.max(0, available.guaranteedCashValue - allocation.guaranteedCashValue)),
      reversionaryBonusCashValue: Math.round(Math.max(0, available.reversionaryBonusCashValue - allocation.reversionaryBonusCashValue)),
      terminalDividendCashValue: Math.round(Math.max(0, available.terminalDividendCashValue - allocation.terminalDividendCashValue)),
      projectedRemainingSurrenderValue: Math.round(projected),
      status: insufficient ? 'INSUFFICIENT_RESERVE' : 'OK',
      calibrationStatus: inRange ? 'IN_CALIBRATION_RANGE' : 'OUT_OF_CALIBRATION_RANGE'
    });
  }
  return { rows, firstShortfallAge, status: firstShortfallAge == null ? 'OK' : 'INSUFFICIENT_RESERVE', calibrationStatus: inRange ? 'IN_CALIBRATION_RANGE' : 'OUT_OF_CALIBRATION_RANGE' };
}

export function simulatePortfolio(policies, model, options = {}) {
  const startAge = Number(options.startAge), endAge = Number(options.endAge), routingYears = Number(options.routingYears || 5);
  const states = policies.map(policy => ({ policy, result: projectPolicy({ ...policy, endAge }, model) }));
  const rows = [];
  for (let age = startAge; age <= endAge; age += 1) {
    const block = Math.floor((age - startAge) / routingYears);
    const activePolicyIndex = policies.length ? block % policies.length : 0;
    rows.push({ age, activePolicyIndex, totalProjectedRemainingSurrenderValue: states.reduce((sum, state) => sum + Number(state.result.rows.find(row => row.age === age)?.projectedRemainingSurrenderValue || 0), 0) });
  }
  return { rows, policies: states };
}
