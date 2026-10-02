// Research-only customer total-value engine. Never imported by production.
// Its state is the remaining-to-no-withdrawal-total ratio; it does not invent
// component allocations for a customer-supplied medical-premium withdrawal.

const PRODUCT = 'AIA 環宇盈活儲蓄保險計劃';
const CURRENCY = 'HKD';

const finite = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be numeric`);
  return number;
};

const interpolate = (points, x) => {
  const ordered = points.toSorted((a, b) => a.x - b.x);
  if (!ordered.length) throw new Error('Interpolation requires evidence points');
  if (x <= ordered[0].x) return ordered[0].value;
  if (x >= ordered.at(-1).x) return ordered.at(-1).value;
  const rightIndex = ordered.findIndex(point => point.x >= x);
  const left = ordered[rightIndex - 1], right = ordered[rightIndex];
  return left.value + (x - left.x) / (right.x - left.x) * (right.value - left.value);
};

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

export function policyYearFor(issueAge, attainedAge) {
  const issue = finite(issueAge, 'issueAge'), age = finite(attainedAge, 'attainedAge');
  if (!Number.isInteger(issue) || !Number.isInteger(age) || age < issue) throw new Error('Invalid issue age / attained age');
  return age - issue;
}

export function buildCustomerTotalValueModel(cases, evidence) {
  const calibration = cases.filter(item => item.role === 'calibration');
  const calibrationIds = new Set(calibration.map(item => item.caseId));
  const sources = evidence.sourceRecords.filter(source => source.usable && source.frozenRole === 'calibration' && calibrationIds.has(source.caseId));
  if (!calibration.length || sources.length !== calibration.length) throw new Error('Complete calibration-only annual evidence is required');

  // Premium -> Basic Amount is verified product metadata, not a surrender-value
  // target. Duplicate anchors must agree exactly before they are admitted.
  const basicByPremium = new Map();
  for (const item of cases) {
    const prior = basicByPremium.get(item.annualPremium);
    if (prior != null && prior !== item.initialBasicAmount) throw new Error('Conflicting Basic Amount metadata anchor');
    basicByPremium.set(item.annualPremium, item.initialBasicAmount);
  }
  const premiumBasicAnchors = [...basicByPremium].toSorted((a, b) => a[0] - b[0]).map(([x, value]) => ({ x, value }));

  // Only calibration source rows build surrender-value curves. Normalize by
  // the exact Basic Amount, average repeated issue-age observations, and keep
  // every annual PY point supplied by the audited genuine central tables.
  const observations = new Map();
  for (const source of sources) {
    const premium = source.metadata.annualPremiumRoundedTableAnchor;
    const basic = source.metadata.initialBasicAmount;
    for (const row of source.baseRows) {
      const key = `${premium}:${row.policyYear}`;
      const values = observations.get(key) || [];
      values.push(row.total / basic);
      observations.set(key, values);
    }
  }
  const curves = new Map();
  for (const [key, values] of observations) {
    const [premium, policyYear] = key.split(':').map(Number);
    const curve = curves.get(premium) || [];
    curve.push({ x: policyYear, value: mean(values) });
    curves.set(premium, curve);
  }
  for (const curve of curves.values()) curve.sort((a, b) => a.x - b.x);
  const baseCurvePremiums = [...curves.keys()].toSorted((a, b) => a - b);
  const basicAmountForPremium = premium => interpolate(premiumBasicAnchors, finite(premium, 'annualSavingContribution'));
  const normalizedTotalAt = (policyYear, basicAmount) => interpolate(baseCurvePremiums.map(premium => ({
    x: basicAmountForPremium(premium), value: interpolate(curves.get(premium), policyYear)
  })), basicAmount);
  const baseTotalAt = (policyYear, basicAmount) => normalizedTotalAt(policyYear, basicAmount) * basicAmount;

  const issueAges = [...new Set(calibration.map(item => item.issueAge))].toSorted((a, b) => a - b);
  return Object.freeze({
    engineVersion: 'ipos-customer-total-value-carried-ratio-v1',
    product: PRODUCT,
    currency: CURRENCY,
    paymentTerm: 5,
    formula: 'remaining(PY) = noWithdrawalTotal(PY) * remaining(PY-1) / noWithdrawalTotal(PY-1) - currentSupport; first support = noWithdrawalTotal - currentSupport',
    premiumBasicAnchors,
    baseCurvePremiums,
    curves,
    calibrationCaseIds: [...calibrationIds].toSorted(),
    calibrationSourceIds: sources.map(source => source.sourceId).toSorted(),
    calibratedIssueAges: issueAges,
    basicAmountForPremium,
    baseTotalAt
  });
}

export function calibrationStatus(model, annualContribution, issueAges) {
  const premium = finite(annualContribution, 'annualSavingContribution');
  // A metadata-only Basic Amount anchor does not establish a calibration
  // curve. The customer engine is bounded by calibration-source premiums.
  const lower = model.baseCurvePremiums[0], upper = model.baseCurvePremiums.at(-1);
  if (premium < lower) return 'OUT_OF_CALIBRATION_RANGE_BELOW';
  if (premium > upper) return 'OUT_OF_CALIBRATION_RANGE_ABOVE';
  const unsupportedIssueAge = issueAges.find(age => !model.calibratedIssueAges.includes(age));
  if (unsupportedIssueAge != null) return 'ISSUE_AGE_OUTSIDE_GENUINE_CALIBRATION';
  if (!model.baseCurvePremiums.includes(premium)) return 'INTERPOLATED_WITHIN_PREMIUM_ANCHORS';
  return 'IN_CALIBRATION_RANGE';
}

export function createPolicyState({ issueAge, annualContribution }, model) {
  const premium = finite(annualContribution, 'annualSavingContribution');
  if (!Number.isInteger(issueAge)) throw new Error('issueAge must be an integer');
  return {
    issueAge,
    annualContribution: premium,
    initialBasicAmount: model.basicAmountForPremium(premium),
    previousBaseTotal: null,
    previousRemainingValue: null,
    rows: []
  };
}

export function previewPolicyYear(state, attainedAge, model) {
  const policyYear = policyYearFor(state.issueAge, attainedAge);
  if (policyYear < 1) return null;
  const baseTotal = model.baseTotalAt(policyYear, state.initialBasicAmount);
  const beforeSupport = state.previousRemainingValue == null
    ? baseTotal
    : baseTotal * state.previousRemainingValue / Math.max(state.previousBaseTotal, 1e-9);
  return { policyYear, baseTotal, beforeSupport: Math.max(0, beforeSupport) };
}

export function advancePolicyYear(state, attainedAge, support, model) {
  const preview = previewPolicyYear(state, attainedAge, model);
  if (!preview) return null;
  const requested = Math.max(0, finite(support, 'support'));
  const applied = Math.min(requested, preview.beforeSupport);
  const remainingValue = Math.max(0, preview.beforeSupport - applied);
  const row = {
    age: attainedAge,
    policyYear: preview.policyYear,
    medicalReserveSupport: applied,
    requestedSupport: requested,
    noWithdrawalTotal: preview.baseTotal,
    remainingSurrenderValue: remainingValue,
    fullySupported: applied + 1e-7 >= requested
  };
  state.previousBaseTotal = preview.baseTotal;
  state.previousRemainingValue = remainingValue;
  state.rows.push(row);
  return row;
}

export function projectTotalValueCase(input, model) {
  if (input.product !== PRODUCT || input.currency !== CURRENCY || input.paymentTerm !== 5) throw new Error('Unsupported saving product configuration');
  const state = createPolicyState({ issueAge: input.issueAge, annualContribution: input.annualPremium }, model);
  const schedule = new Map((input.withdrawalSchedule || []).map(row => [Number(row.age), Number(row.withdrawal || 0)]));
  const endAge = Number(input.endAge ?? input.issueAge + 60);
  for (let age = input.issueAge + 1; age <= endAge; age += 1) {
    const support = age >= (input.withdrawalStartAge ?? Infinity) ? (schedule.get(age) || 0) : 0;
    advancePolicyYear(state, age, support, model);
  }
  return { rows: state.rows, calibrationStatus: calibrationStatus(model, input.annualPremium, [input.issueAge]) };
}

export function serializableModelLock(model) {
  return {
    engineVersion: model.engineVersion,
    formula: model.formula,
    premiumBasicAnchors: model.premiumBasicAnchors,
    baseCurvePremiums: model.baseCurvePremiums,
    curves: [...model.curves].map(([premium, rows]) => ({ premium, rows })),
    calibrationCaseIds: model.calibrationCaseIds,
    calibrationSourceIds: model.calibrationSourceIds,
    calibratedIssueAges: model.calibratedIssueAges,
    fittedTransitionParameters: 0
  };
}
