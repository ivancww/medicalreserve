import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  buildCustomerTotalValueModel,
  projectTotalValueCase,
  serializableModelLock
} from './customer-total-value-engine.js';
import { runForwardMedicalReserve, solveRequiredContribution } from './customer-ab-calculation.js';

const here = name => new URL(name, import.meta.url);
const read = name => JSON.parse(fs.readFileSync(here(name), 'utf8'));
const write = (name, value) => fs.writeFileSync(here(name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const round = value => Number(value.toFixed(8));
const dataset = read('./fixtures/dataset.json');
const evidence = read('./evidence-gap-matrix.json');
const model = buildCustomerTotalValueModel(dataset.cases, evidence);
const mode = process.argv[2];
const lockPath = here('./customer-total-value-lock.json');

const calibrationCases = dataset.cases.filter(item => item.role === 'calibration');
const calibrationRows = calibrationCases.flatMap(item => {
  const predictions = new Map(projectTotalValueCase(item, model).rows.map(row => [row.age, row]));
  return item.rows.map(actual => {
    const predicted = predictions.get(actual.age);
    const dollarError = predicted.remainingSurrenderValue - actual.projectedRemainingSurrenderValue;
    return { caseId: item.caseId, age: actual.age, policyYear: actual.policyYear, genuine: actual.projectedRemainingSurrenderValue,
      model: Math.round(predicted.remainingSurrenderValue), dollarError: Math.round(dollarError),
      absolutePercent: actual.projectedRemainingSurrenderValue === 0 ? 0 : Math.abs(dollarError) / actual.projectedRemainingSurrenderValue * 100 };
  });
});
const firstWithdrawal = calibrationCases.map(item => {
  const actual = item.rows.find(row => row.withdrawal > 0 && row.withdrawalType === 'medicalWithdrawal');
  if (!actual) return null;
  const predicted = projectTotalValueCase({ ...item, endAge: actual.age }, model).rows.at(-1);
  return { caseId: item.caseId, age: actual.age, policyYear: actual.policyYear,
    identityResidual: round(predicted.remainingSurrenderValue - (predicted.noWithdrawalTotal - actual.withdrawal)),
    status: Math.abs(predicted.remainingSurrenderValue - (predicted.noWithdrawalTotal - actual.withdrawal)) < 1e-7 ? 'PASS' : 'FAIL' };
}).filter(Boolean);
const zeroWithdrawalPersistence = calibrationCases.every(item => {
  const predictions = new Map(projectTotalValueCase(item, model).rows.map(row => [row.age, row]));
  const scheduled = new Map(item.withdrawalSchedule.map(row => [row.age, Number(row.withdrawal || 0)]));
  let affected = false;
  return item.rows.every(actual => {
    if (actual.withdrawal > 0) affected = true;
    // Three audited age-100 rows genuinely display zero while the historical
    // frozen schedules contain 85/8/2. They remain frozen for benchmark
    // comparability and are not persistence tests for a zero-support input.
    if (!affected || actual.withdrawal !== 0 || scheduled.get(actual.age) !== 0 || actual.age === item.issueAge + 1) return true;
    const prior = predictions.get(actual.age - 1), current = predictions.get(actual.age);
    return !prior || Math.abs(prior.remainingSurrenderValue / prior.noWithdrawalTotal - current.remainingSurrenderValue / current.noWithdrawalTotal) < 1e-10;
  });
}) ? 'PASS' : 'FAIL';

if (mode === '--lock') {
  if (fs.existsSync(lockPath)) throw new Error('Model lock already exists; refusing to overwrite');
  const snapshot = serializableModelLock(model);
  const lock = {
    createdFromHead: '958b823610d1b3c15a9d6a034f37f6b439c72282',
    model: snapshot,
    modelLockSHA256: hash(snapshot),
    fixtureSHA256: hash(fs.readFileSync(here('./fixtures/dataset.json'))),
    evidenceSHA256: hash(fs.readFileSync(here('./evidence-gap-matrix.json'))),
    calibrationDiagnostics: {
      cases: calibrationCases.length,
      rows: calibrationRows.length,
      MAPE: round(calibrationRows.reduce((sum, row) => sum + row.absolutePercent, 0) / calibrationRows.length),
      maxErrorPercent: round(Math.max(...calibrationRows.map(row => row.absolutePercent))),
      maxDollarError: Math.max(...calibrationRows.map(row => Math.abs(row.dollarError))),
      firstWithdrawal: firstWithdrawal.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL',
      zeroWithdrawalPersistence
    },
    holdoutTargetsRead: false,
    frozenHoldoutEvaluationCount: 0
  };
  write('./customer-total-value-lock.json', lock);
  console.log(JSON.stringify(lock.calibrationDiagnostics));
  process.exit(0);
}

if (mode !== '--evaluate') throw new Error('Use --lock once, then --evaluate once');
if (!fs.existsSync(lockPath)) throw new Error('Model must be locked before holdout evaluation');
if (fs.existsSync(here('./customer-total-value-engine.json'))) throw new Error('Frozen holdout report already exists; refusing a repeated evaluation');
const lock = read('./customer-total-value-lock.json');
if (hash(serializableModelLock(model)) !== lock.modelLockSHA256) throw new Error('Model lock mismatch');
if (hash(fs.readFileSync(here('./fixtures/dataset.json'))) !== lock.fixtureSHA256) throw new Error('Frozen fixture changed after lock');
if (hash(fs.readFileSync(here('./evidence-gap-matrix.json'))) !== lock.evidenceSHA256) throw new Error('Evidence changed after lock');

// The only full frozen holdout projection for this locked candidate.
const holdoutRows = dataset.cases.filter(item => item.role === 'holdout').flatMap(item => {
  const predictions = new Map(projectTotalValueCase(item, model).rows.map(row => [row.age, row]));
  return item.rows.map(actual => {
    const predicted = predictions.get(actual.age), dollarError = Math.round(predicted.remainingSurrenderValue) - actual.projectedRemainingSurrenderValue;
    return { caseId: item.caseId, age: actual.age, policyYear: actual.policyYear, genuine: actual.projectedRemainingSurrenderValue,
      model: Math.round(predicted.remainingSurrenderValue), dollarError,
      absolutePercent: actual.projectedRemainingSurrenderValue === 0 ? 0 : round(Math.abs(dollarError) / actual.projectedRemainingSurrenderValue * 100) };
  });
});
const worst = holdoutRows.reduce((left, right) => left.absolutePercent >= right.absolutePercent ? left : right);
const thresholds = [0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1.00];
const holdout = {
  annualRows: holdoutRows.length,
  MAPE: round(holdoutRows.reduce((sum, row) => sum + row.absolutePercent, 0) / holdoutRows.length),
  MAE_HKD: round(holdoutRows.reduce((sum, row) => sum + Math.abs(row.dollarError), 0) / holdoutRows.length),
  maxErrorPercent: worst.absolutePercent,
  maxDollarError: Math.max(...holdoutRows.map(row => Math.abs(row.dollarError))),
  rowsAbove: Object.fromEntries(thresholds.map(value => [value.toFixed(2), holdoutRows.filter(row => row.absolutePercent > value).length])),
  firstThresholdBreach: Object.fromEntries(thresholds.map(value => {
    const row = holdoutRows.find(item => item.absolutePercent > value);
    return [value.toFixed(2), row ? { caseId: row.caseId, age: row.age, policyYear: row.policyYear, absolutePercent: row.absolutePercent } : null];
  })),
  worstCase: worst.caseId,
  worstAge: worst.age,
  worstPolicyYear: worst.policyYear
};
const classification = holdout.maxErrorPercent <= .10 ? 'EXCELLENT' : holdout.maxErrorPercent <= .25 ? 'VERY_STRONG' : holdout.maxErrorPercent <= .50 ? 'STRONG' : holdout.maxErrorPercent <= 1 ? 'USABLE_CANDIDATE' : 'NOT_READY';
const roles = Object.fromEntries(dataset.cases.map(item => [item.caseId, item.role]));
const leakage = model.calibrationCaseIds.every(id => roles[id] === 'calibration') &&
  model.calibrationSourceIds.every(id => evidence.sourceRecords.find(source => source.sourceId === id)?.frozenRole === 'calibration') ? 'PASS' : 'FAIL';

const validationFixture = dataset.cases.find(item => item.caseId === '50yrs_5pay_180k_avpu');
const validationPremiums = validationFixture.withdrawalSchedule.filter(row => row.age >= 61 && row.age <= 90)
  .map(row => ({ age: row.age, annualPremium: row.withdrawal, source: 'GENUINE_AIA_SUPPORT_WITHDRAWAL_VALIDATION_ONLY_NOT_MEDICAL_PREMIUM' }));
const validationTargetRemaining = validationFixture.rows.find(row => row.age === 90).projectedRemainingSurrenderValue;
const forwardDemo = runForwardMedicalReserve({ currentAge: 50, savingDuration: 5, annualSavingContribution: 180000,
  supportStartAge: 61, endAge: 90, medicalPremiumSchedule: validationPremiums }, model);
const reverseDemo = solveRequiredContribution({ currentAge: 50, savingDuration: 5, supportStartAge: 61,
  targetSupportAge: 90, targetRemainingValue: validationTargetRemaining, medicalPremiumSchedule: validationPremiums, solverTolerance: 100 }, model);
const customerReady = classification !== 'NOT_READY' && leakage === 'PASS';
const report = {
  reportVersion: 1,
  previousHead: lock.createdFromHead,
  engineVersion: model.engineVersion,
  qualification: 'Research approximation calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.',
  architecture: {
    primaryState: 'Projected remaining total surrender value and its ratio to the genuine no-withdrawal total curve.',
    firstWithdrawal: 'no-withdrawal total minus current support',
    repeatedWithdrawal: model.formula,
    zeroWithdrawal: 'Preserve the prior remaining/base ratio; never reset to pristine base.',
    components: 'No customer GCV/RB/TD output and no invented component allocation.',
    basicAmountBoundary: 'Exact premium-to-Basic metadata mapping seeds the no-withdrawal curve. Without a genuine allocation generator, later GCV-driven Basic Amount reduction is represented only through total-state depletion, not claimed as an independent component reconstruction.'
  },
  modelLockSHA256: lock.modelLockSHA256,
  frozenHoldoutEvaluationCount: 1,
  calibrationDiagnostics: lock.calibrationDiagnostics,
  holdout,
  holdoutRows,
  baselineV4: { engine: 'ipos-approximation-terminal-dividend-transition-v4', MAPE: 2.29650947, maxErrorPercent: 11.80075621,
    rowsAbove010: 247, maxDollarError: 457617, worstCase: '50yrs_5pay_130k_avpu', worstAge: 72, worstPolicyYear: 22 },
  classification,
  leakage,
  firstWithdrawal: lock.calibrationDiagnostics.firstWithdrawal,
  zeroWithdrawalPersistence,
  forwardA: customerReady ? 'READY_FOR_PRODUCT_REVIEW' : 'NOT_READY',
  reverseB: customerReady && reverseDemo.abConsistency === 'PASS' ? 'READY_FOR_PRODUCT_REVIEW' : 'NOT_READY',
  productionActivated: false,
  customerUiModified: false
};
const ab = {
  engineVersion: model.engineVersion,
  medicalPremiumBoundary: {
    status: 'OFFICIAL_VALUES_NOT_AVAILABLE_IN_REPOSITORY_OR_THIS_WORK_ENVIRONMENT',
    evidence: 'Production app loads premiumRange dynamically from Official Cloud. The repository contains mappings and fetch logic, not annual premium values. Direct endpoint retrieval timed out in this Work environment.',
    rule: 'No medical premium has been invented or copied from an AIA support schedule.'
  },
  portfolio: {
    fiveYear: { policies: 1, status: customerReady ? 'READY_FOR_PRODUCT_REVIEW' : 'NOT_READY' },
    tenYear: { policies: 2, status: 'NOT_READY', reason: 'Second policy issue age and oldest-first multi-policy routing lack genuine combined-portfolio validation.' },
    fifteenYear: { policies: 3, status: 'NOT_READY', reason: 'Second/third issue ages and oldest-first multi-policy routing lack genuine combined-portfolio validation.' },
    routing: 'Oldest issued policy first; explicit deterministic research rule, not an AIA-validated portfolio rule.'
  },
  genuineScheduleValidation: {
    warning: 'Uses a genuine AIA proposal withdrawal schedule solely as a deterministic solver test; it is not relabelled as an official medical-premium schedule.',
    forward: { supportYears: forwardDemo.schedule.length, lastFullySupportedAge: forwardDemo.lastFullySupportedAge,
      firstShortfallAge: forwardDemo.firstShortfallAge, totalSupport: Math.round(forwardDemo.totalMedicalPremiumSupported),
      remainingAtTarget: Math.round(forwardDemo.finalRemainingSurrenderValue), calibrationStatus: forwardDemo.calibrationStatus },
    reverse: { requiredAnnualContribution: reverseDemo.requiredAnnualContribution, totalContribution: reverseDemo.totalContribution,
      feasible: reverseDemo.feasible, calibrationStatus: reverseDemo.calibrationStatus, abConsistency: reverseDemo.abConsistency ?? 'NOT_APPLICABLE_OUT_OF_RANGE',
      tolerance: reverseDemo.solverTolerance, iterations: reverseDemo.solverIterations,
      targetRemainingValue: validationTargetRemaining }
  },
  age50OfficialExample: {
    currentAge: 50, supportStartAge: 65, targetSupportAge: 90,
    medicalPremiumYearsIncluded: 26,
    ageConvention: 'Inclusive attained ages 65 through 90; an age counts only when that full annual premium is funded.',
    totalMedicalPremiumRequirement: null,
    fiveYear: { requiredAnnualContribution: null, totalContribution: null, remainingValueAtTarget: null, reason: 'Official annual medical-premium schedule unavailable.' },
    tenYear: { requiredAnnualContribution: null, totalContribution: null, remainingValueAtTarget: null, reason: 'Official annual medical-premium schedule unavailable; portfolio validation also incomplete.' },
    fifteenYear: { requiredAnnualContribution: null, totalContribution: null, remainingValueAtTarget: null, reason: 'Official annual medical-premium schedule unavailable; portfolio validation also incomplete.' }
  },
  abConsistency: reverseDemo.abConsistency ?? 'NOT_APPLICABLE_OUT_OF_RANGE',
  testsRequired: ['Forward A', 'Reverse B', 'A/B consistency', '5/10/15 independent policies', 'first/repeated/zero withdrawals',
    'reserve exhaustion', 'target-age boundary', 'interpolation/range', 'monotonicity', 'leakage/model lock/protected files/frozen fixtures']
};
write('./customer-total-value-engine.json', report);
write('./customer-ab-calculation.json', ab);

const engineMd = ['# Customer Total-Value Engine', '', report.qualification, '',
  `Engine: **${report.engineVersion}**. Classification: **${classification}**. Forward A: **${report.forwardA}**. Reverse B: **${report.reverseB}**.`, '',
  '## Locked architecture', '', ...Object.entries(report.architecture).map(([key, value]) => `- ${key}: ${value}`), '',
  `Model-lock SHA-256: \`${report.modelLockSHA256}\`. Frozen holdout evaluations after lock: **1**. Leakage: **${leakage}**.`, '',
  '## Validation', '',
  '| Metric | Customer total-value v1 | v4 baseline |', '| --- | ---: | ---: |',
  `| MAPE | ${holdout.MAPE}% | 2.29650947% |`,
  `| MAE | HKD ${holdout.MAE_HKD} | — |`,
  `| Maximum annual error | ${holdout.maxErrorPercent}% | 11.80075621% |`,
  `| Maximum dollar error | HKD ${holdout.maxDollarError} | HKD 457617 |`,
  `| Rows >0.10% | ${holdout.rowsAbove['0.10']}/${holdout.annualRows} | 247/325 |`,
  `| Rows >0.25% | ${holdout.rowsAbove['0.25']}/${holdout.annualRows} | — |`,
  `| Rows >0.50% | ${holdout.rowsAbove['0.50']}/${holdout.annualRows} | — |`,
  `| Rows >1.00% | ${holdout.rowsAbove['1.00']}/${holdout.annualRows} | — |`, '',
  `Worst: ${holdout.worstCase}, age ${holdout.worstAge} / PY${holdout.worstPolicyYear}.`, '',
  `First withdrawal: ${report.firstWithdrawal}. Zero-withdrawal persistence: ${report.zeroWithdrawalPersistence}.`, '',
  'The customer-total candidate is operational from total withdrawals alone, but it is not product-ready unless the frozen maximum error is at most 1.00%. The prior component-state evidence remains unchanged.', '',
  'No production activation, Customer Flow, UI, official data, frozen fixture, or Phase-A artifact was changed.'];
write('./customer-total-value-engine.md', engineMd.join('\n') + '\n');

const abMd = ['# Customer A/B Calculation Checkpoint', '',
  '## Separation of responsibilities', '',
  '- Medical Premium Engine supplies explicit annual official premiums by attained age, plan and deductible.',
  '- Saving Plan Value Engine projects each independent 5Pay policy.',
  '- Forward A routes each annual premium and reports full support, shortfall and remaining total value.',
  '- Reverse B calls Forward A only; bounded binary search tolerance is HKD 100 and monotonicity is checked across evidence anchors.', '',
  '## Portfolio boundary', '',
  `- 5-year: ${ab.portfolio.fiveYear.status}.`,
  `- 10-year: ${ab.portfolio.tenYear.status} — ${ab.portfolio.tenYear.reason}`,
  `- 15-year: ${ab.portfolio.fifteenYear.status} — ${ab.portfolio.fifteenYear.reason}`,
  `- Routing: ${ab.portfolio.routing}`, '',
  '## A/B deterministic validation', '', ab.genuineScheduleValidation.warning, '',
  `Forward support years: ${ab.genuineScheduleValidation.forward.supportYears}; last fully supported age: ${ab.genuineScheduleValidation.forward.lastFullySupportedAge}; remaining at target: HKD ${ab.genuineScheduleValidation.forward.remainingAtTarget}.`,
  `Reverse required annual contribution: ${ab.genuineScheduleValidation.reverse.requiredAnnualContribution ?? 'outside calibrated range'}; A/B consistency: ${ab.genuineScheduleValidation.reverse.abConsistency}.`, '',
  '## Requested age-50 / age-65–90 example', '',
  `${ab.age50OfficialExample.medicalPremiumYearsIncluded} premium ages are included (${ab.age50OfficialExample.ageConvention}).`, '',
  ab.medicalPremiumBoundary.evidence, '',
  'Accordingly the 5/10/15-year required contributions, total premium requirement and remaining values are deliberately reported as unavailable; no values were invented.', '',
  'No production activation or customer UI change was made.'];
write('./customer-ab-calculation.md', abMd.join('\n') + '\n');
console.log(JSON.stringify({ engine: model.engineVersion, holdout, classification, leakage, forwardA: report.forwardA, reverseB: report.reverseB,
  abConsistency: ab.abConsistency }));
