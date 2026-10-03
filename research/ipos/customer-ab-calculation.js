// Research-only A/B orchestration. Medical premiums are supplied by the
// separate official premium engine; this module never fabricates them.
import {
  advancePolicyYear,
  calibrationStatus,
  createPolicyState,
  previewPolicyYear
} from './customer-total-value-engine.js';

const supportedDurations = new Set([5, 10, 15]);
const finite = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be numeric`);
  return number;
};

export function normalizeMedicalPremiumSchedule(schedule, supportStartAge, endAge) {
  if (!Array.isArray(schedule)) throw new Error('medicalPremiumSchedule must be an array');
  const byAge = new Map();
  for (const row of schedule) {
    const age = Number(row.age), premium = Number(row.annualPremium ?? row.medicalPremium);
    if (!Number.isInteger(age) || !Number.isFinite(premium) || premium < 0 || byAge.has(age)) throw new Error('Invalid or duplicate medical premium row');
    byAge.set(age, { age, medicalPremium: premium, planId: row.planId ?? null, deductible: row.deductible ?? null });
  }
  for (let age = supportStartAge; age <= endAge; age += 1) if (!byAge.has(age)) throw new Error(`Missing official medical premium for age ${age}`);
  return byAge;
}

export function buildFivePayPortfolio({ currentAge, annualSavingContribution, savingDuration }, model) {
  const duration = Number(savingDuration), age = Number(currentAge);
  if (!Number.isInteger(age) || !supportedDurations.has(duration)) throw new Error('Unsupported current age or saving duration');
  const phases = duration / 5;
  return Array.from({ length: phases }, (_, index) => createPolicyState({
    issueAge: age + index * 5,
    annualContribution: annualSavingContribution
  }, model));
}

export function runForwardMedicalReserve(input, model) {
  const currentAge = Number(input.currentAge), supportStartAge = Number(input.supportStartAge), endAge = Number(input.endAge ?? input.targetAge);
  const annualSavingContribution = finite(input.annualSavingContribution, 'annualSavingContribution');
  const savingDuration = Number(input.savingDuration);
  if (![currentAge, supportStartAge, endAge].every(Number.isInteger) || supportStartAge <= currentAge || endAge < supportStartAge) throw new Error('Invalid customer ages');
  const premiums = normalizeMedicalPremiumSchedule(input.medicalPremiumSchedule, supportStartAge, endAge);
  const policies = buildFivePayPortfolio({ currentAge, annualSavingContribution, savingDuration }, model);
  const firstProjectionAge = Math.min(...policies.map(policy => policy.issueAge + 1));
  const schedule = [];
  let cumulativeMedicalSupport = 0, lastFullySupportedAge = null, firstShortfallAge = null, shortfallAmount = 0;

  for (let age = firstProjectionAge; age <= endAge; age += 1) {
    const premiumRow = premiums.get(age);
    const required = age >= supportStartAge ? premiumRow.medicalPremium : 0;
    let outstanding = required;
    const previews = policies.map(policy => previewPolicyYear(policy, age, model));
    // Explicit research routing rule: oldest issued policy first. There is no
    // genuine multi-policy iPOS corpus, so this remains a product-review gap.
    const allocations = previews.map(preview => {
      if (!preview || outstanding <= 0) return 0;
      const amount = Math.min(outstanding, preview.beforeSupport);
      outstanding -= amount;
      return amount;
    });
    const policyRows = policies.map((policy, index) => previews[index] ? advancePolicyYear(policy, age, allocations[index], model) : null);
    if (age < supportStartAge) continue;
    const supported = required - outstanding;
    cumulativeMedicalSupport += supported;
    const fullySupported = outstanding <= 1e-7;
    if (fullySupported) lastFullySupportedAge = age;
    else if (firstShortfallAge == null) { firstShortfallAge = age; shortfallAmount = outstanding; }
    schedule.push({
      age,
      medicalPremium: required,
      medicalReserveSupport: supported,
      remainingSurrenderValue: policyRows.reduce((sum, row) => sum + Number(row?.remainingSurrenderValue || 0), 0),
      cumulativeMedicalSupport,
      fullySupported,
      policySupport: allocations
    });
  }
  const issueAges = policies.map(policy => policy.issueAge);
  return {
    currentAge,
    savingDuration,
    annualSavingContribution,
    totalSavingContribution: annualSavingContribution * savingDuration,
    supportStartAge,
    endAge,
    schedule,
    lastFullySupportedAge,
    firstShortfallAge,
    shortfallAmount,
    totalMedicalPremiumSupported: cumulativeMedicalSupport,
    finalRemainingSurrenderValue: schedule.at(-1)?.remainingSurrenderValue ?? 0,
    calibrationStatus: calibrationStatus(model, annualSavingContribution, issueAges),
    portfolioRouting: 'OLDEST_POLICY_FIRST_RESEARCH_RULE',
    policies: policies.map(policy => ({ issueAge: policy.issueAge, annualContribution: policy.annualContribution, rows: policy.rows })),
    calculationEngineVersion: model.engineVersion
  };
}

const succeeds = (result, targetRemainingValue) => result.firstShortfallAge == null && result.finalRemainingSurrenderValue + 1e-7 >= targetRemainingValue;

export function solveRequiredContribution(input, model) {
  const tolerance = Number(input.solverTolerance ?? 100);
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error('Invalid solver tolerance');
  const targetRemainingValue = Math.max(0, Number(input.targetRemainingValue ?? 0));
  const lowerBound = model.baseCurvePremiums[0], upperBound = model.baseCurvePremiums.at(-1);
  const run = annualSavingContribution => runForwardMedicalReserve({
    ...input,
    endAge: input.targetSupportAge,
    annualSavingContribution
  }, model);
  const sampled = [...new Set(model.baseCurvePremiums.concat([lowerBound, upperBound]))].toSorted((a, b) => a - b)
    .map(contribution => ({ contribution, result: run(contribution) }));
  const monotonic = sampled.every((sample, index) => index === 0 ||
    sample.result.totalMedicalPremiumSupported + 1e-7 >= sampled[index - 1].result.totalMedicalPremiumSupported &&
    sample.result.finalRemainingSurrenderValue + 1e-7 >= sampled[index - 1].result.finalRemainingSurrenderValue);
  if (!monotonic) throw new Error('Forward engine is not monotonic over verified anchors');
  if (succeeds(sampled[0].result, targetRemainingValue)) {
    return {
      currentAge: input.currentAge, supportStartAge: input.supportStartAge, targetSupportAge: input.targetSupportAge,
      savingDuration: input.savingDuration, requiredAnnualContribution: null, totalContribution: null,
      supportPremiumYearCount: sampled[0].result.schedule.length,
      totalMedicalPremiumRequired: sampled[0].result.schedule.reduce((sum, row) => sum + row.medicalPremium, 0),
      totalMedicalPremiumSupported: sampled[0].result.totalMedicalPremiumSupported,
      remainingValueAtTargetAge: sampled[0].result.finalRemainingSurrenderValue,
      lastFullySupportedAge: sampled[0].result.lastFullySupportedAge, firstShortfallAge: null, shortfallAmount: 0,
      solverTolerance: tolerance, solverIterations: 0, calibrationStatus: 'OUT_OF_CALIBRATION_RANGE_BELOW',
      feasible: false, reason: 'The minimum lies at or below the lowest validated annual-contribution anchor.',
      monotonicity: 'PASS', calculationEngineVersion: model.engineVersion
    };
  }
  if (!succeeds(sampled.at(-1).result, targetRemainingValue)) {
    const result = sampled.at(-1).result;
    return {
      currentAge: input.currentAge, supportStartAge: input.supportStartAge, targetSupportAge: input.targetSupportAge,
      savingDuration: input.savingDuration, requiredAnnualContribution: null, totalContribution: null,
      supportPremiumYearCount: result.schedule.length,
      totalMedicalPremiumRequired: result.schedule.reduce((sum, row) => sum + row.medicalPremium, 0),
      totalMedicalPremiumSupported: result.totalMedicalPremiumSupported,
      remainingValueAtTargetAge: result.finalRemainingSurrenderValue,
      lastFullySupportedAge: result.lastFullySupportedAge, firstShortfallAge: result.firstShortfallAge, shortfallAmount: result.shortfallAmount,
      solverTolerance: tolerance, solverIterations: 0, calibrationStatus: 'OUT_OF_CALIBRATION_RANGE_ABOVE',
      feasible: false, reason: 'Target exceeds the highest validated annual-contribution anchor.',
      monotonicity: 'PASS', calculationEngineVersion: model.engineVersion
    };
  }
  let low = lowerBound, high = upperBound, iterations = 0;
  while (high - low > tolerance) {
    const midpoint = (low + high) / 2;
    const result = run(midpoint);
    iterations += 1;
    if (succeeds(result, targetRemainingValue)) high = midpoint;
    else low = midpoint;
  }
  // Round upward to solver currency tolerance so the returned value itself
  // satisfies the target. This is not a claim of HKD 1 source precision.
  let requiredAnnualContribution = Math.ceil(high / tolerance) * tolerance;
  let forward = run(requiredAnnualContribution);
  // Floating binary bounds can land just above a tolerance boundary. Walk
  // downward on the declared currency grid only; this is not parameter fit.
  while (requiredAnnualContribution - tolerance >= lowerBound) {
    const priorContribution = requiredAnnualContribution - tolerance;
    const prior = run(priorContribution);
    if (!succeeds(prior, targetRemainingValue)) break;
    requiredAnnualContribution = priorContribution;
    forward = prior;
  }
  const lowerContribution = requiredAnnualContribution - tolerance;
  const lower = lowerContribution >= lowerBound ? run(lowerContribution) : null;
  const consistent = succeeds(forward, targetRemainingValue) && (!lower || !succeeds(lower, targetRemainingValue));
  return {
    currentAge: input.currentAge,
    supportStartAge: input.supportStartAge,
    targetSupportAge: input.targetSupportAge,
    savingDuration: input.savingDuration,
    requiredAnnualContribution,
    totalContribution: requiredAnnualContribution * Number(input.savingDuration),
    supportPremiumYearCount: forward.schedule.length,
    totalMedicalPremiumRequired: forward.schedule.reduce((sum, row) => sum + row.medicalPremium, 0),
    totalMedicalPremiumSupported: forward.totalMedicalPremiumSupported,
    remainingValueAtTargetAge: forward.finalRemainingSurrenderValue,
    lastFullySupportedAge: forward.lastFullySupportedAge,
    firstShortfallAge: forward.firstShortfallAge,
    shortfallAmount: forward.shortfallAmount,
    solverTolerance: tolerance,
    solverIterations: iterations,
    calibrationStatus: forward.calibrationStatus,
    feasible: consistent,
    monotonicity: 'PASS',
    abConsistency: consistent ? 'PASS' : 'FAIL',
    lowerContributionCheck: lower ? {
      annualContribution: lowerContribution,
      succeeds: succeeds(lower, targetRemainingValue),
      firstShortfallAge: lower.firstShortfallAge,
      remainingValueAtTargetAge: lower.finalRemainingSurrenderValue
    } : null,
    forward,
    calculationEngineVersion: model.engineVersion
  };
}
