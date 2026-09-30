const COMPONENTS = Object.freeze(['guaranteedCashValue', 'reversionaryBonusCashValue', 'terminalDividendCashValue']);

function finite(value) { return Number.isFinite(Number(value)); }
function number(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(label + ' must be numeric');
  return result;
}
function region(policyYear) { return policyYear <= 10 ? 'early' : policyYear <= 20 ? 'middle' : 'late'; }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function policyYearFor(issueAge, currentAge) {
  const issue = number(issueAge, 'issueAge'), age = number(currentAge, 'currentAge');
  if (!Number.isInteger(issue) || !Number.isInteger(age) || issue < 0 || age < issue) throw new Error('Invalid age / Policy Year mapping');
  return age - issue;
}
export function interpolate(points, x) {
  const usable = points.filter(point => finite(point.x) && finite(point.value)).sort((a, b) => a.x - b.x);
  if (!usable.length) return 0;
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
function solve(matrix, vector, ridge = 1e-6) {
  const size = vector.length;
  const augmented = matrix.map((row, rowIndex) => row.map((value, columnIndex) => value + (rowIndex === columnIndex && rowIndex ? ridge : 0)).concat(vector[rowIndex]));
  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    if (Math.abs(augmented[best][pivot]) < 1e-12) continue;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    augmented[pivot] = augmented[pivot].map(value => value / divisor);
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      augmented[row] = augmented[row].map((value, column) => value - factor * augmented[pivot][column]);
    }
  }
  return augmented.map(row => row[size]);
}
function featureVector(policyYear, previousRatio, withdrawalRatio, previousWithdrawalRatio, gcvRatio, gcvTapped, basicRatio, timeSince) {
  return [1, previousRatio, policyYear / 60, withdrawalRatio, previousWithdrawalRatio, gcvRatio, gcvTapped ? 1 : 0, basicRatio, Math.min(timeSince, 20) / 20];
}
function terminalFeatureVector(policyYear, previousRatio, withdrawalRatio, previousWithdrawalRatio, basicRatio, timeSince) {
  return [1, previousRatio, policyYear / 60, withdrawalRatio, previousWithdrawalRatio, basicRatio, Math.min(timeSince, 20) / 20];
}
function normalizeCase(item) {
  if (!item || item.product !== 'AIA 環宇盈活儲蓄保險計劃' || item.currency !== 'HKD' || item.paymentTerm !== 5) throw new Error('Unsupported product, currency, or payment term');
  if (!Number.isInteger(item.issueAge) || item.issueAge < 0) throw new Error('Invalid issue age');
  if (!finite(item.annualPremium) || item.annualPremium <= 0 || !finite(item.initialBasicAmount) || item.initialBasicAmount <= 0) throw new Error('Invalid premium or Basic Amount');
  if (!['Original', 'AVF', 'AVPU'].includes(item.withdrawalPattern)) throw new Error('Unsupported withdrawal pattern');
  return item;
}
function baseComponentRow(row, initialBasicAmount) {
  return {
    guaranteedCashValue: Number(row.guaranteedCashValue || 0) / initialBasicAmount,
    reversionaryBonusCashValue: Number(row.reversionaryBonusCashValue || 0) / initialBasicAmount,
    terminalDividendCashValue: Number(row.terminalDividendCashValue || 0) / initialBasicAmount
  };
}

export function buildCalibrationModel(cases) {
  const calibration = cases.filter(item => item.role === 'calibration').map(normalizeCase);
  if (!calibration.length) throw new Error('No calibration cases available');
  const anchors = [...new Map(calibration.map(item => [item.annualPremium, item.initialBasicAmount])).entries()].sort((a, b) => a[0] - b[0]).map(([premium, basicAmount]) => ({ x: premium, value: basicAmount }));
  const byAnchor = new Map();
  calibration.forEach(item => {
    const years = byAnchor.get(item.annualPremium) || new Map();
    item.baseCurve.forEach(row => {
      const list = years.get(row.policyYear) || [];
      list.push(baseComponentRow(row, item.initialBasicAmount));
      years.set(row.policyYear, list);
    });
    const firstWithdrawal = item.withdrawalStartAge ?? Number.POSITIVE_INFINITY;
    item.rows.filter(row => row.age < firstWithdrawal && Number(row.withdrawal || 0) === 0).forEach(row => {
      const list = years.get(row.policyYear) || [];
      list.push(baseComponentRow(row, item.initialBasicAmount));
      years.set(row.policyYear, list);
    });
    const firstRow = item.rows.find(row => Number(row.withdrawal || 0) > 0 && row.withdrawalType === 'medicalWithdrawal');
    if (firstRow) {
      const scheduleRow = item.withdrawalSchedule.find(row => row.age === firstRow.age) || {};
      const list = years.get(firstRow.policyYear) || [];
      list.push({
        guaranteedCashValue: (Number(firstRow.guaranteedCashValue || 0) + Number(scheduleRow.withdrawalFromGuaranteedCashValue || 0)) / item.initialBasicAmount,
        reversionaryBonusCashValue: (Number(firstRow.reversionaryBonusCashValue || 0) + Number(scheduleRow.withdrawalFromReversionaryBonus || 0)) / item.initialBasicAmount,
        terminalDividendCashValue: (Number(firstRow.terminalDividendCashValue || 0) + Number(scheduleRow.withdrawalFromTerminalDividend || 0)) / item.initialBasicAmount
      });
      years.set(firstRow.policyYear, list);
    }
    byAnchor.set(item.annualPremium, years);
  });
  const curves = new Map();
  for (const [premium, years] of byAnchor.entries()) {
    curves.set(premium, new Map([...years.entries()].map(([policyYear, rows]) => [policyYear, Object.fromEntries(COMPONENTS.map(component => [component, mean(rows.map(row => row[component]))]))])));
  }
  const baseAt = (policyYear, basicAmount) => {
    const values = {};
    COMPONENTS.forEach(component => {
      values[component] = interpolate([...curves.entries()].map(([premium, curve]) => ({ x: interpolate(anchors, premium), value: interpolate([...curve.entries()].map(([year, row]) => ({ x: year, value: row[component] })), policyYear) })), basicAmount) * basicAmount;
    });
    values.total = COMPONENTS.reduce((sum, component) => sum + values[component], 0);
    return values;
  };
  const transitionRows = { early: [], middle: [], late: [] }, terminalRows = { early: [], middle: [], late: [] }, reductionRows = { early: [], middle: [], late: [] };
  calibration.forEach(item => {
    const schedule = new Map(item.withdrawalSchedule.map(row => [row.age, row]));
    let previous = null, previousTerminal = null, previousTerminalWithdrawal = 0, previousBasic = item.initialBasicAmount, lastWithdrawalAge = null;
    item.rows.forEach(actual => {
      const currentBasic = Number(actual.basicAmountAfterWithdrawal || previousBasic);
      const currentBase = baseAt(actual.policyYear, currentBasic);
      const previousBase = previous ? baseAt(previous.policyYear, previousBasic) : currentBase;
      const previousRemaining = previous ? previous.projectedRemainingSurrenderValue : currentBase.total;
      const previousWithdrawalRatio = previous ? previous.withdrawal / Math.max(previousBase.total, 1) : 0;
      const previousRatio = previousRemaining / Math.max(previousBase.total, 1);
      const withdrawal = Number(actual.withdrawal || 0), withdrawalRatio = withdrawal / Math.max(currentBase.total, 1);
      const gcvTap = Number(schedule.get(actual.age)?.withdrawalFromGuaranteedCashValue || 0), gcvRatio = gcvTap / Math.max(currentBase.guaranteedCashValue, 1);
      const tdWithdrawal = Number(schedule.get(actual.age)?.withdrawalFromTerminalDividend || 0);
      const previousTerminalBase = previous ? previousBase.terminalDividendCashValue : currentBase.terminalDividendCashValue;
      const previousTerminalRatio = previousTerminal == null ? 1 : previousTerminal / Math.max(previousTerminalBase, 1);
      const tdWithdrawalRatio = tdWithdrawal / Math.max(currentBase.terminalDividendCashValue, 1);
      const previousTdWithdrawalRatio = previousTerminalWithdrawal / Math.max(previousTerminalBase, 1);
      const timeSince = lastWithdrawalAge == null ? 20 : actual.age - lastWithdrawalAge;
      if (withdrawal > 0) lastWithdrawalAge = actual.age;
      transitionRows[region(actual.policyYear)].push({ features: featureVector(actual.policyYear, previousRatio, withdrawalRatio, previousWithdrawalRatio, gcvRatio, gcvTap > 0, currentBasic / item.initialBasicAmount, timeSince), target: Number(actual.projectedRemainingSurrenderValue) / Math.max(currentBase.total, 1) });
      terminalRows[region(actual.policyYear)].push({ features: terminalFeatureVector(actual.policyYear, previousTerminalRatio, tdWithdrawalRatio, previousTdWithdrawalRatio, currentBasic / item.initialBasicAmount, timeSince), target: (Number(actual.terminalDividendCashValue || 0) + tdWithdrawal) / Math.max(currentBase.terminalDividendCashValue, 1) });
      if (gcvTap > 0 && currentBasic < previousBasic) {
        const gcvPerBasic = previousBase.guaranteedCashValue / Math.max(previousBasic, 1);
        reductionRows[region(actual.policyYear)].push((previousBasic - currentBasic) / Math.max(gcvTap / Math.max(gcvPerBasic, 1e-9), 1e-9));
      }
      previous = actual;
      previousTerminal = Number(actual.terminalDividendCashValue || 0);
      previousTerminalWithdrawal = tdWithdrawal;
      previousBasic = currentBasic;
    });
  });
  const transitions = {};
  for (const [name, rows] of Object.entries(transitionRows)) {
    const matrix = Array.from({ length: 9 }, () => Array(9).fill(0)), vector = Array(9).fill(0);
    rows.forEach(row => row.features.forEach((feature, index) => {
      vector[index] += feature * row.target;
      row.features.forEach((other, otherIndex) => { matrix[index][otherIndex] += feature * other; });
    }));
    transitions[name] = solve(matrix, vector);
  }
  const terminalTransitions = {};
  for (const [name, rows] of Object.entries(terminalRows)) {
    const matrix = Array.from({ length: 7 }, () => Array(7).fill(0)), vector = Array(7).fill(0);
    rows.forEach(row => row.features.forEach((feature, index) => {
      vector[index] += feature * row.target;
      row.features.forEach((other, otherIndex) => { matrix[index][otherIndex] += feature * other; });
    }));
    terminalTransitions[name] = solve(matrix, vector);
  }
  return Object.freeze({ anchors, curves, baseAt, transitions, terminalTransitions, reductionCoefficients: Object.fromEntries(Object.entries(reductionRows).map(([name, rows]) => [name, median(rows)])), calibrationCaseIds: calibration.map(item => item.caseId) });
}

export function projectPolicy(input, model) {
  const policy = normalizeCase(input);
  const endAge = Number(input.endAge ?? policy.issueAge + 60);
  if (!Number.isInteger(endAge) || endAge < policy.issueAge) throw new Error('Invalid projection end age');
  const mappedBasic = interpolate(model.anchors, policy.annualPremium);
  const currentBasicRange = model.anchors[0].x <= policy.annualPremium && policy.annualPremium <= model.anchors[model.anchors.length - 1].x;
  const schedule = new Map((policy.withdrawalSchedule || []).map(row => [row.age, row]));
  let currentBasic = mappedBasic || policy.initialBasicAmount, previousRemaining = null, previousBasic = currentBasic, previousWithdrawal = 0, previousBase = null, previousTerminal = null, previousTerminalWithdrawal = 0, lastWithdrawalAge = null, firstWithdrawalSeen = false;
  const rows = [];
  for (let age = policy.issueAge + 1; age <= endAge; age += 1) {
    const policyYear = policyYearFor(policy.issueAge, age), base = model.baseAt(policyYear, currentBasic), point = schedule.get(age) || {};
    const withdrawal = age >= (policy.withdrawalStartAge ?? Number.POSITIVE_INFINITY) ? Number(point.withdrawal || 0) : 0;
    const gcvTap = withdrawal > 0 ? Number(point.withdrawalFromGuaranteedCashValue || 0) : 0;
    const tdWithdrawal = withdrawal > 0 ? Number(point.withdrawalFromTerminalDividend || 0) : 0;
    let terminalState = base.terminalDividendCashValue;
    let remaining = base.total;
    if (previousRemaining != null && firstWithdrawalSeen) {
      const prevBase = previousBase || model.baseAt(Math.max(1, policyYear - 1), previousBasic);
      const previousRatio = previousRemaining / Math.max(prevBase.total, 1);
      const previousWithdrawalRatio = previousWithdrawal / Math.max(prevBase.total, 1);
      const withdrawalRatio = withdrawal / Math.max(base.total, 1);
      const gcvRatio = gcvTap / Math.max(base.guaranteedCashValue, 1);
      const timeSince = lastWithdrawalAge == null ? 20 : age - lastWithdrawalAge;
      const features = featureVector(policyYear, previousRatio, withdrawalRatio, previousWithdrawalRatio, gcvRatio, gcvTap > 0, currentBasic / policy.initialBasicAmount, timeSince);
      const coefficients = model.transitions[region(policyYear)];
      const ratio = Math.max(0, Math.min(1.5, coefficients.reduce((sum, coefficient, index) => sum + coefficient * features[index], 0)));
      remaining = base.total * ratio;
      const previousTerminalBase = previousTerminal == null ? base.terminalDividendCashValue : previousBase.terminalDividendCashValue;
      const previousTerminalRatio = previousTerminal == null ? 1 : previousTerminal / Math.max(previousTerminalBase, 1);
      const terminalFeatures = terminalFeatureVector(policyYear, previousTerminalRatio, tdWithdrawal / Math.max(base.terminalDividendCashValue, 1), previousTerminalWithdrawal / Math.max(previousTerminalBase, 1), currentBasic / policy.initialBasicAmount, timeSince);
      const terminalRatio = Math.max(0, Math.min(1.5, model.terminalTransitions[region(policyYear)].reduce((sum, coefficient, index) => sum + coefficient * terminalFeatures[index], 0)));
      terminalState = base.terminalDividendCashValue * terminalRatio - tdWithdrawal;
      remaining += terminalState - base.terminalDividendCashValue * ratio;
    }
    if (withdrawal > 0 && !firstWithdrawalSeen) {
      remaining = Math.max(0, base.total - withdrawal);
      terminalState = base.terminalDividendCashValue - tdWithdrawal;
    }
    if (withdrawal > 0) { firstWithdrawalSeen = true; lastWithdrawalAge = age; }
    if (gcvTap > 0) {
      const coefficient = model.reductionCoefficients[region(policyYear)];
      const rawReduction = gcvTap / Math.max(base.guaranteedCashValue / Math.max(currentBasic, 1), 1e-9);
      currentBasic = Math.max(0, currentBasic - coefficient * rawReduction);
    }
    const insufficient = base.total <= withdrawal && withdrawal > 0;
    if (insufficient) remaining = 0;
    rows.push({ age, policyYear, withdrawal: Math.round(withdrawal), withdrawalType: withdrawal > 0 ? 'medicalWithdrawal' : 'zeroWithdrawal', basicAmountAfterWithdrawal: Math.round(currentBasic), projectedRemainingSurrenderValue: Math.round(Math.max(0, remaining)), status: insufficient ? 'INSUFFICIENT_RESERVE' : 'OK', calibrationStatus: currentBasicRange ? 'IN_CALIBRATION_RANGE' : 'OUT_OF_CALIBRATION_RANGE' });
    previousRemaining = remaining;
    previousWithdrawal = withdrawal;
    previousBasic = currentBasic;
    previousBase = base;
    previousTerminal = terminalState;
    previousTerminalWithdrawal = tdWithdrawal;
  }
  const firstShortfallAge = rows.find(row => row.status === 'INSUFFICIENT_RESERVE')?.age ?? null;
  return { rows, firstShortfallAge, status: firstShortfallAge == null ? 'OK' : 'INSUFFICIENT_RESERVE', calibrationStatus: currentBasicRange ? 'IN_CALIBRATION_RANGE' : 'OUT_OF_CALIBRATION_RANGE' };
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
