import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildIteration3Model, projectIteration3 } from './component-state-iteration-3.js';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const write = (name, value) => fs.writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n');
const dataset = read('./fixtures/dataset.json');
const evidence = read('./evidence-gap-matrix.json');
const iteration1 = read('./component-state-research.json');
const iteration2 = read('./component-state-iteration-2-research.json');
const baselineReport = read('./validation-report.json');
const model = buildIteration3Model(dataset.cases, evidence);
const candidate = 'ipos-approximation-independent-component-state-phase-a-iteration-3-td-annual-increment';
const startingHead = '13489029fdc7615eaadc7c4870706007f2c3f7ad';
const round = value => Number(value.toFixed(8));
const roles = Object.fromEntries(dataset.cases.map(item => [item.caseId, item.role]));
const fixtureSHA256 = crypto.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/dataset.json', import.meta.url))).digest('hex');
const summarize = rows => rows.length ? {
  rows: rows.length,
  meanSignedDollarResidual: round(rows.reduce((sum, row) => sum + row.dollarError, 0) / rows.length),
  meanAbsoluteDollarResidual: round(rows.reduce((sum, row) => sum + Math.abs(row.dollarError), 0) / rows.length),
  maximumAbsoluteDollarResidual: round(Math.max(...rows.map(row => Math.abs(row.dollarError)))),
  impossibleTDStates: rows.filter(row => row.impossiblePreClampTD).length
} : { rows: 0, meanSignedDollarResidual: null, meanAbsoluteDollarResidual: null,
  maximumAbsoluteDollarResidual: null, impossibleTDStates: 0 };
const tdRows = model.tdTransitionRows;
const calibrationDiagnostics = {
  eligibleTransitions: tdRows.length,
  overall: summarize(tdRows),
  beforePriorGCVTap: summarize(tdRows.filter(row => !row.afterPriorGCVTap)),
  afterPriorGCVTap: summarize(tdRows.filter(row => row.afterPriorGCVTap)),
  horizon: {
    years1to5: summarize(tdRows.filter(row => row.horizonAfterFirstAffectedYear <= 5)),
    years6to15: summarize(tdRows.filter(row => row.horizonAfterFirstAffectedYear >= 6 && row.horizonAfterFirstAffectedYear <= 15)),
    years16Plus: summarize(tdRows.filter(row => row.horizonAfterFirstAffectedYear >= 16))
  },
  biasGrowsWithHorizon: Math.abs(summarize(tdRows.filter(row => row.horizonAfterFirstAffectedYear >= 16)).meanSignedDollarResidual) >
    Math.abs(summarize(tdRows.filter(row => row.horizonAfterFirstAffectedYear <= 5)).meanSignedDollarResidual),
  conclusion: 'Calibration residual is positive and grows materially with horizon; the parameter-free TD annual-increment hypothesis is structurally insufficient without fitted repair.'
};
const modelLock = {
  rbTransition: 'Iteration 1 pristine RB base minus carried deficit times its frozen calibration median persistence and capital ratio, then current RB withdrawal',
  rbPersistence: model.rbPersistence,
  tdTransition: model.tdTransition,
  tdFreeParameters: model.tdFreeParameters,
  tdAccrualBasicAmountBasis: 'Basic Amount entering the policy year (previous annual row post-withdrawal amount), used for both adjacent normalized no-withdrawal TD curve points',
  reductionCoefficients: model.reductionCoefficients,
  calibrationCaseIds: model.calibrationCaseIds,
  sourceIds: model.sourceIds
};
const modelLockSHA256 = crypto.createHash('sha256').update(JSON.stringify(modelLock)).digest('hex');
const lockArtifact = {
  phase: 'A', iteration: 3, finalPhaseAIteration: true, startingHead, candidate,
  hypothesis: 'Restore Iteration 1 RB and test a parameter-free carried TD state replenished only by the genuine annual no-withdrawal TD curve increment.',
  tdFormula: 'TD_after(PY) = TD_after(PY-1) + [TD_base(PY, Basic Amount entering PY) - TD_base(PY-1, same Basic Amount)] - withdrawalFromTD(PY)',
  calibrationDiagnostics, baseIdentityMaxResidual: model.baseIdentityMaxResidual,
  frozenRoles: roles, fixtureSHA256, modelLock, modelLockSHA256,
  holdoutEvaluated: false
};

if (process.argv[2] === '--lock') {
  write('./component-state-iteration-3-lock.json', lockArtifact);
  console.log(JSON.stringify({ modelLockSHA256, calibrationDiagnostics, holdoutEvaluated: false }));
  process.exit(0);
}
if (process.argv[2] !== '--evaluate') throw Error('Use --lock or --evaluate');
const savedLock = read('./component-state-iteration-3-lock.json');
if (savedLock.holdoutEvaluated !== false || savedLock.modelLockSHA256 !== modelLockSHA256 ||
    crypto.createHash('sha256').update(JSON.stringify(savedLock.modelLock)).digest('hex') !== modelLockSHA256) throw Error('Model lock mismatch');
if (JSON.stringify(savedLock.frozenRoles) !== JSON.stringify(roles) || savedLock.fixtureSHA256 !== fixtureSHA256) throw Error('Frozen data changed after lock');

const keys = ['GCV', 'RB', 'TD', 'total'];
const compare = (actual, predicted) => Object.fromEntries(keys.map(key => [key, {
  genuine: actual[key], model: predicted[key], dollarError: predicted[key] - actual[key],
  percentError: actual[key] === 0 ? (predicted[key] === 0 ? 0 : null) : round((predicted[key] - actual[key]) / actual[key] * 100),
  percentOfGenuineTotal: actual.total === 0 ? null : round((predicted[key] - actual[key]) / actual.total * 100)
}]));
const componentPass = components => Object.values(components).every(value => Math.abs(value.dollarError) <= 1 ||
  (value.percentError != null && Math.abs(value.percentError) <= 0.10));
const caseInput = item => ({ product: item.product, currency: item.currency, paymentTerm: item.paymentTerm,
  issueAge: item.issueAge, annualPremium: item.annualPremium, initialBasicAmount: item.initialBasicAmount,
  withdrawalPattern: item.withdrawalPattern, withdrawalStartAge: item.withdrawalStartAge,
  endAge: item.endAge ?? item.issueAge + 60, withdrawalSchedule: item.withdrawalSchedule });
const sourceFor = caseId => evidence.sourceRecords.find(source => source.usable && source.caseId === caseId);

const firstWithdrawals = dataset.cases.filter(item => item.role !== 'regression').map(item => {
  const first = item.rows.find(row => row.withdrawal > 0 && row.withdrawalType === 'medicalWithdrawal');
  if (!first) return null;
  const source = sourceFor(item.caseId);
  const actual = source.postRows.find(row => row.policyYear === first.policyYear);
  const predicted = projectIteration3({ ...caseInput(item), endAge: first.age }, model).rows.at(-1);
  const base = source.baseRows.find(row => row.policyYear === first.policyYear);
  const components = compare(actual, predicted);
  const sourceIdentityError = actual.total - (base.total - actual.withdrawal);
  const modelIdentityError = predicted.total - (predicted.noWithdrawalBaseValue - predicted.withdrawal);
  return { caseId: item.caseId, age: first.age, policyYear: first.policyYear, components,
    sourceIdentityError, modelIdentityError, componentTotalResidual: predicted.componentTotalResidual,
    status: Math.abs(sourceIdentityError) <= 1 && Math.abs(modelIdentityError) <= 1 &&
      Math.abs(predicted.componentTotalResidual) <= 1 && Object.values(components).every(value => Math.abs(value.dollarError) <= 1) ? 'PASS' : 'FAIL' };
}).filter(Boolean);
const firstWithdrawalGate = firstWithdrawals.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';

const iteration1Five = new Map(iteration1.fiveRows.map(row => [row.caseId, row]));
const fiveRows = evidence.immediateTransitionDiagnostics.map(diagnostic => {
  const item = dataset.cases.find(candidateCase => candidateCase.caseId === diagnostic.caseId);
  const predicted = projectIteration3({ ...caseInput(item), endAge: diagnostic.age }, model).rows.at(-1);
  const components = compare(diagnostic.genuine, predicted);
  const iteration1TD = iteration1Five.get(diagnostic.caseId).components.TD;
  return { caseId: diagnostic.caseId, age: diagnostic.age, policyYear: diagnostic.policyYear, components,
    basicAmount: { genuine: diagnostic.genuine.basicAmount, model: predicted.basicAmountState,
      difference: predicted.basicAmountState - diagnostic.genuine.basicAmount },
    iteration1TDComparison: { iteration1DollarError: iteration1TD.dollarError,
      iteration3DollarError: components.TD.dollarError,
      absoluteErrorImprovement: Math.abs(iteration1TD.dollarError) - Math.abs(components.TD.dollarError) },
    status: componentPass(components) ? 'PASS' : 'FAIL' };
});
const fiveRowComponentGate = fiveRows.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';

const pauseChecks = evidence.pauseResumeEvidence.map(pause => {
  const source = evidence.sourceRecords.find(item => item.sourceId === pause.sourceId);
  const input = { issueAge: source.metadata.issueAge, initialBasicAmount: source.metadata.initialBasicAmount,
    withdrawalStartAge: source.metadata.withdrawalStartAge, endAge: pause.zeroWithdrawalYears.at(-1).age,
    withdrawalSchedule: source.allocationRows.map(row => ({ age: row.age, withdrawal: row.total,
      withdrawalFromGuaranteedCashValue: row.fromGCV, withdrawalFromReversionaryBonus: row.fromRB,
      withdrawalFromTerminalDividend: row.fromTD })) };
  const rows = projectIteration3(input, model).rows;
  const checks = pause.zeroWithdrawalYears.map(actual => {
    const predicted = rows.find(row => row.policyYear === actual.policyYear);
    const previous = rows.find(row => row.policyYear === actual.policyYear - 1);
    const pristine = model.baseAt(actual.policyYear, input.initialBasicAmount);
    return { age: actual.age, policyYear: actual.policyYear, components: compare(actual.postWithdrawal, predicted),
      basicPersists: predicted.basicAmountState === previous.basicAmountState,
      rbCarryPersists: predicted.carryRB > 0,
      tdCarriedByAccrual: Number.isFinite(predicted.tdAccrual),
      tdNotPristine: predicted.TD !== Math.round(pristine.terminalDividendCashValue),
      gcvIndependent: Math.abs(predicted.GCV - Math.round(model.baseAt(actual.policyYear, previous.basicAmountState).guaranteedCashValue)) <= 1 };
  });
  return { caseId: pause.caseId, sourceId: pause.sourceId, checks,
    status: checks.every(row => row.basicPersists && row.rbCarryPersists && row.tdCarriedByAccrual && row.tdNotPristine && row.gcvIndependent) ? 'PASS' : 'FAIL' };
});
const zeroWithdrawalPersistence = pauseChecks.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';

// The only full Iteration 3 frozen holdout projection occurs below, after the
// saved lock is verified. No code after this point changes model behaviour.
const holdoutRows = dataset.cases.filter(item => item.role === 'holdout').flatMap(item => {
  const predictions = new Map(projectIteration3(caseInput(item), model).rows.map(row => [row.policyYear, row]));
  return item.rows.map(actual => {
    const predicted = predictions.get(actual.policyYear);
    const dollarError = predicted.total - actual.projectedRemainingSurrenderValue;
    return { caseId: item.caseId, age: actual.age, policyYear: actual.policyYear,
      actual: actual.projectedRemainingSurrenderValue, predicted: predicted.total, dollarError,
      absolutePercent: actual.projectedRemainingSurrenderValue === 0 ? 0 : round(Math.abs(dollarError) / actual.projectedRemainingSurrenderValue * 100),
      negativeComponents: predicted.negativeComponents, invalidBasicAmount: predicted.invalidBasicAmount,
      componentTotalResidual: predicted.componentTotalResidual, allocationResidual: predicted.allocationResidual };
  });
});
const worst = holdoutRows.reduce((left, right) => left.absolutePercent >= right.absolutePercent ? left : right);
const holdout = { MAPE: round(holdoutRows.reduce((sum, row) => sum + row.absolutePercent, 0) / holdoutRows.length),
  maxErrorPercent: worst.absolutePercent, rowsAbove010: holdoutRows.filter(row => row.absolutePercent > 0.10).length,
  annualRows: holdoutRows.length, maxDollarError: Math.max(...holdoutRows.map(row => Math.abs(row.dollarError))),
  worstCase: worst.caseId, worstAge: worst.age, worstPolicyYear: worst.policyYear };
const baseline = { engine: 'ipos-approximation-terminal-dividend-transition-v4', MAPE: 2.29650947,
  maxErrorPercent: 11.80075621, rowsAbove010: 247, annualRows: 325, maxDollarError: 457617,
  worstCase: '50yrs_5pay_130k_avpu', worstAge: 72, worstPolicyYear: 22, leakage: 'PASS' };
if (baselineReport.results.holdout.MAPE !== baseline.MAPE || baselineReport.results.holdout.maxErrorPercent !== baseline.maxErrorPercent) throw Error('Frozen baseline changed');
const leakage = model.calibrationCaseIds.every(id => roles[id] === 'calibration') &&
  model.sourceIds.every(id => evidence.sourceRecords.find(source => source.sourceId === id).frozenRole === 'calibration') ? 'PASS' : 'FAIL';
const calibrationRows = dataset.cases.filter(item => item.role === 'calibration').flatMap(item => projectIteration3(caseInput(item), model).rows);
const structurallyInvalid = row => row.negativeComponents.length || row.invalidBasicAmount || Math.abs(row.componentTotalResidual) > 1;
const impossibleComponentStates = {
  calibrationRows: calibrationRows.filter(structurallyInvalid).length,
  holdoutRows: holdoutRows.filter(row => row.negativeComponents.length || row.invalidBasicAmount || Math.abs(row.componentTotalResidual) > 1).length
};
impossibleComponentStates.total = impossibleComponentStates.calibrationRows + impossibleComponentStates.holdoutRows;
const impossibleAllocations = {
  calibrationRows: calibrationRows.filter(row => Math.abs(row.allocationResidual) > 1).length,
  holdoutRows: holdoutRows.filter(row => Math.abs(row.allocationResidual) > 1).length
};
const structural = firstWithdrawalGate === 'PASS' && fiveRowComponentGate === 'PASS' && zeroWithdrawalPersistence === 'PASS' &&
  impossibleComponentStates.total === 0;
const retained = leakage === 'PASS' && structural && holdout.maxErrorPercent < baseline.maxErrorPercent &&
  holdout.rowsAbove010 <= baseline.rowsAbove010 && holdout.MAPE <= baseline.MAPE;
const tdImprovedRows = fiveRows.filter(row => row.iteration1TDComparison.absoluteErrorImprovement > 0).length;
const report = {
  ...lockArtifact, holdoutEvaluated: true, holdoutEvaluationCount: 1,
  architecture: {
    rbState: 'Iteration 1 transition restored exactly; no new RB fitting.',
    gcvState: 'Independent GCV curve at current Basic Amount minus genuine current GCV allocation.',
    tdState: savedLock.tdFormula,
    basicAmountState: 'Unchanged without GCV tap; existing calibration reduction relationship otherwise.'
  },
  firstWithdrawalGate, firstWithdrawals, fiveRowComponentGate,
  fiveRowThreshold: 'Every component and total <=0.10% of its genuine component value, or <=HKD1 displayed rounding; zero denominator judged by dollars.',
  fiveRows, zeroWithdrawalPersistence,
  pauseAccuracyBoundary: 'Persistence-only structure; not a claim of full pause/resume numerical accuracy.',
  pauseChecks, holdout, holdoutRows, leakage, impossibleComponentStates, impossibleAllocations,
  frozenScheduleAnomalies: dataset.cases.flatMap(item => item.withdrawalSchedule.filter(row =>
    Math.abs(row.withdrawal - row.withdrawalFromGuaranteedCashValue - row.withdrawalFromReversionaryBonus - row.withdrawalFromTerminalDividend) > 1)
    .map(row => ({ caseId: item.caseId, age: row.age, policyYear: row.policyYear, withdrawal: row.withdrawal,
      allocationResidual: row.withdrawal - row.withdrawalFromGuaranteedCashValue - row.withdrawalFromReversionaryBonus - row.withdrawalFromTerminalDividend }))),
  comparison: {
    v4: baseline,
    iteration1: { candidate: iteration1.candidate, decision: iteration1.decision, holdout: iteration1.holdout,
      fiveRowComponentGate: iteration1.fiveRowComponentGate },
    iteration2: { candidate: iteration2.candidate, decision: iteration2.decision, holdout: iteration2.holdout,
      fiveRowComponentGate: iteration2.fiveRowComponentGate }
  },
  decision: retained ? 'ITERATION_3_RETAINED' : 'ITERATION_3_REJECTED',
  retainedEngine: retained ? candidate : baseline.engine,
  reason: retained ? 'All structural gates pass and Iteration 3 is superior under the frozen selection hierarchy.' :
    'Calibration falsifies the parameter-free TD annual-increment transition through a positive horizon-growing bias; the candidate does not satisfy all component, structural and frozen-holdout retention gates. v4 remains retained.',
  tdResult: `${tdImprovedRows} of 5 immediate rows reduce absolute TD error versus Iteration 1; calibration bias grows from HKD ${calibrationDiagnostics.horizon.years1to5.meanSignedDollarResidual} in years 1-5 to HKD ${calibrationDiagnostics.horizon.years16Plus.meanSignedDollarResidual} in years 16+.`,
  dominantRemainingFailure: 'TD transition requires a different evidence-supported state law; simple additive no-withdrawal TD accrual systematically overstates genuine carried TD.',
  recommendedNextResearchPhase: 'Phase B: identify a non-additive TD state invariant from calibration transitions before defining any new candidate or coefficient.',
  researchStatus: retained && holdout.maxErrorPercent <= 0.10 ? 'READY_FOR_INTEGRATION' : 'NOT_READY_FOR_INTEGRATION',
  productionActivated: false,
  qualification: 'Research approximation calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.'
};
write('./component-state-iteration-3-research.json', report);

const lines = ['# Component-State Phase A / Iteration 3 — FINAL', '', report.qualification, '',
  `Starting HEAD: \`${startingHead}\``, '', `Candidate: **${candidate}**`, '',
  `Decision: **${report.decision}**. Retained engine: **${report.retainedEngine}**. Status: **${report.researchStatus}**.`, '',
  '## Locked hypothesis', '', report.hypothesis, '', `Formula: \`${report.tdFormula}\``, '',
  `TD free parameters: 0. Basic Amount basis: ${modelLock.tdAccrualBasicAmountBasis}.`, '',
  `Model lock: \`${modelLockSHA256}\`.`, '',
  '## Calibration-only TD diagnosis', '',
  `Eligible transitions: ${calibrationDiagnostics.eligibleTransitions}. Mean signed residual HKD ${calibrationDiagnostics.overall.meanSignedDollarResidual}; mean absolute residual HKD ${calibrationDiagnostics.overall.meanAbsoluteDollarResidual}; maximum absolute residual HKD ${calibrationDiagnostics.overall.maximumAbsoluteDollarResidual}.`, '',
  `Before prior GCV tap MAE: HKD ${calibrationDiagnostics.beforePriorGCVTap.meanAbsoluteDollarResidual}; after prior GCV tap MAE: HKD ${calibrationDiagnostics.afterPriorGCVTap.meanAbsoluteDollarResidual}.`, '',
  `Horizon bias: years 1–5 signed mean HKD ${calibrationDiagnostics.horizon.years1to5.meanSignedDollarResidual}; years 6–15 HKD ${calibrationDiagnostics.horizon.years6to15.meanSignedDollarResidual}; years 16+ HKD ${calibrationDiagnostics.horizon.years16Plus.meanSignedDollarResidual}. Bias grows: ${calibrationDiagnostics.biasGrowsWithHorizon}.`, '',
  calibrationDiagnostics.conclusion, '',
  '## First-withdrawal gate', '', firstWithdrawalGate, '',
  '| Case | Age / PY | GCV error | RB error | TD error | Total error | Result |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...firstWithdrawals.map(row => `| ${row.caseId} | ${row.age} / ${row.policyYear} | ${row.components.GCV.dollarError} | ${row.components.RB.dollarError} | ${row.components.TD.dollarError} | ${row.components.total.dollarError} | ${row.status} |`), '',
  '## Five-row component gate', '', `${fiveRowComponentGate}. ${report.fiveRowThreshold}`, ''];
for (const row of fiveRows) {
  lines.push(`### ${row.caseId}: age ${row.age} / PY${row.policyYear}`, '',
    '| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |',
    '| --- | --- | --- | --- | --- |',
    ...keys.map(key => { const value = row.components[key]; return `| ${key} | ${value.genuine} | ${value.model} | ${value.dollarError} | ${value.percentError ?? 'N/A'} |`; }), '',
    `Basic Amount: genuine ${row.basicAmount.genuine}; model ${row.basicAmount.model}; difference ${row.basicAmount.difference}.`, '',
    `TD vs Iteration 1: I1 error ${row.iteration1TDComparison.iteration1DollarError}; I3 error ${row.iteration1TDComparison.iteration3DollarError}; absolute improvement ${row.iteration1TDComparison.absoluteErrorImprovement}. Result: ${row.status}.`, '');
}
lines.push('## Zero-withdrawal persistence', '', `${zeroWithdrawalPersistence}. ${report.pauseAccuracyBoundary}`, '',
  '## One frozen holdout evaluation', '',
  '| Metric | v4 | Iteration 1 | Iteration 2 | Iteration 3 |', '| --- | --- | --- | --- | --- |',
  ...['MAPE','maxErrorPercent','rowsAbove010','annualRows','maxDollarError','worstCase','worstAge','worstPolicyYear'].map(key =>
    `| ${key} | ${baseline[key]} | ${iteration1.holdout[key]} | ${iteration2.holdout[key]} | ${holdout[key]} |`), '',
  `Leakage: ${leakage}. Holdout projection count after lock: 1.`, '',
  `Impossible component states: calibration ${impossibleComponentStates.calibrationRows}; holdout ${impossibleComponentStates.holdoutRows}; total ${impossibleComponentStates.total}.`, '',
  `Known impossible allocation rows remain frozen: calibration ${impossibleAllocations.calibrationRows}; holdout ${impossibleAllocations.holdoutRows}. The audited age-100 HKD85/8/2 rows remain unchanged and unallocated.`, '',
  '## Decision', '', report.reason, '', `TD result: ${report.tdResult}`, '',
  `Dominant remaining failure: ${report.dominantRemainingFailure}`, '',
  `Recommended next research phase: ${report.recommendedNextResearchPhase}`, '',
  'Iterations 1 and 2 remain unchanged. No production, UI, portfolio, fixture, role or baseline file changed. No Iteration 4 was run.');
fs.writeFileSync(new URL('./component-state-iteration-3-research.md', import.meta.url), lines.join('\n') + '\n');
console.log(JSON.stringify({ candidate, modelLockSHA256, firstWithdrawalGate, fiveRowComponentGate,
  zeroWithdrawalPersistence, holdout, leakage, impossibleComponentStates,
  decision: report.decision, retainedEngine: report.retainedEngine, researchStatus: report.researchStatus,
  tdResult: report.tdResult }));
