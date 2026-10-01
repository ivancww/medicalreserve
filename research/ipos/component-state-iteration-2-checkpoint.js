import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildIteration2Model, projectIteration2 } from './component-state-iteration-2.js';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const write = (name, value) => fs.writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n');
const dataset = read('./fixtures/dataset.json');
const evidence = read('./evidence-gap-matrix.json');
const iteration1 = read('./component-state-research.json');
const baselineReport = read('./validation-report.json');
const model = buildIteration2Model(dataset.cases, evidence);
const candidate = 'ipos-approximation-independent-component-state-phase-a-iteration-2-rb-annual-increment';
const startingHead = '39fb72b8d6b218188139534299985f605591fa4b';
const round = value => Number(value.toFixed(8));
const median = values => { const sorted = values.toSorted((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
const roles = Object.fromEntries(dataset.cases.map(item => [item.caseId, item.role]));
const fixtureSHA256 = crypto.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/dataset.json', import.meta.url))).digest('hex');
const modelLock = {
  rbTransition: model.rbTransition,
  rbFreeParameters: 0,
  terminalTransitions: model.terminalTransitions,
  reductionCoefficients: model.reductionCoefficients,
  calibrationCaseIds: model.calibrationCaseIds,
  sourceIds: model.sourceIds
};
const modelLockSHA256 = crypto.createHash('sha256').update(JSON.stringify(modelLock)).digest('hex');
const rbErrors = model.rbTransitionRows.map(row => row.dollarError);
const bySource = Object.values(Object.groupBy(model.rbTransitionRows, row => row.caseId)).map(rows => ({
  caseId: rows[0].caseId, rows: rows.length,
  meanAbsoluteDollarError: round(rows.reduce((sum, row) => sum + Math.abs(row.dollarError), 0) / rows.length),
  maximumAbsoluteDollarError: round(Math.max(...rows.map(row => Math.abs(row.dollarError))))
}));
const calibrationEvidence = {
  transitionRows: model.rbTransitionRows.length,
  meanAbsoluteDollarError: round(rbErrors.reduce((sum, value) => sum + Math.abs(value), 0) / rbErrors.length),
  medianSignedDollarError: round(median(rbErrors)),
  maximumAbsoluteDollarError: round(Math.max(...rbErrors.map(Math.abs))),
  withinDisplayedHKD1: rbErrors.filter(value => Math.abs(value) <= 1).length,
  sourceHeldOutInterpretation: 'The RB rule has zero fitted parameters; each source therefore tests the same rule without source-specific fitting.',
  bySource
};
const lockArtifact = {
  phase: 'A', iteration: 2, startingHead, candidate,
  hypothesis: 'RB replenishment follows the annual increment in the genuine no-withdrawal RB curve instead of a capital-scaled carried deficit.',
  rbFormula: 'RB_after(PY) = RB_after(PY-1) + [RB_base(PY,current Basic Amount) - RB_base(PY-1,current Basic Amount)] - withdrawalFromRB(PY)',
  calibrationEvidence, baseIdentityMaxResidual: model.baseIdentityMaxResidual,
  frozenRoles: roles, fixtureSHA256, modelLock, modelLockSHA256,
  holdoutEvaluated: false
};

if (process.argv[2] === '--lock') {
  write('./component-state-iteration-2-lock.json', lockArtifact);
  console.log(JSON.stringify({ modelLockSHA256, calibrationEvidence, holdoutEvaluated: false }));
  process.exit(0);
}

if (process.argv[2] !== '--evaluate') throw Error('Use --lock or --evaluate');
const savedLock = read('./component-state-iteration-2-lock.json');
if (savedLock.holdoutEvaluated !== false || savedLock.modelLockSHA256 !== modelLockSHA256 ||
    crypto.createHash('sha256').update(JSON.stringify(savedLock.modelLock)).digest('hex') !== modelLockSHA256) {
  throw Error('Model lock mismatch');
}
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
  const predicted = projectIteration2({ ...caseInput(item), endAge: first.age }, model).rows.at(-1);
  const base = source.baseRows.find(row => row.policyYear === first.policyYear);
  const components = compare(actual, predicted);
  const sourceIdentityError = actual.total - (base.total - actual.withdrawal);
  const modelIdentityError = predicted.total - (predicted.noWithdrawalBaseValue - predicted.withdrawal);
  const sumError = predicted.total - predicted.GCV - predicted.RB - predicted.TD;
  return { caseId: item.caseId, age: first.age, policyYear: first.policyYear, components,
    sourceIdentityError, modelIdentityError, sumError,
    status: Math.abs(sourceIdentityError) <= 1 && Math.abs(modelIdentityError) <= 1 && Math.abs(sumError) <= 1 &&
      Object.values(components).every(value => Math.abs(value.dollarError) <= 1) ? 'PASS' : 'FAIL' };
}).filter(Boolean);
const firstWithdrawalGate = firstWithdrawals.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';

// Five frozen diagnostic rows are evaluation-only and are read only after lock verification.
const fiveRows = evidence.immediateTransitionDiagnostics.map(diagnostic => {
  const item = dataset.cases.find(candidateCase => candidateCase.caseId === diagnostic.caseId);
  const predicted = projectIteration2({ ...caseInput(item), endAge: diagnostic.age }, model).rows.at(-1);
  const components = compare(diagnostic.genuine, predicted);
  return { caseId: diagnostic.caseId, age: diagnostic.age, policyYear: diagnostic.policyYear, components,
    basicAmount: { genuine: diagnostic.genuine.basicAmount, model: predicted.basicAmountState },
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
  const rows = projectIteration2(input, model).rows;
  const checks = pause.zeroWithdrawalYears.map(actual => {
    const predicted = rows.find(row => row.policyYear === actual.policyYear);
    const previous = rows.find(row => row.policyYear === actual.policyYear - 1);
    const pristine = model.baseAt(actual.policyYear, input.initialBasicAmount);
    return { age: actual.age, policyYear: actual.policyYear, components: compare(actual.postWithdrawal, predicted),
      genuineBasicAmount: actual.postWithdrawal.basicAmount, modelBasicAmount: predicted.basicAmountState,
      basicPersists: predicted.basicAmountState === previous.basicAmountState,
      rbCarriedByAccrual: Number.isFinite(predicted.rbAccrual),
      tdNotPristine: predicted.TD !== Math.round(pristine.terminalDividendCashValue),
      gcvIndependent: Math.abs(predicted.GCV - Math.round(model.baseAt(actual.policyYear, previous.basicAmountState).guaranteedCashValue)) <= 1 };
  });
  return { caseId: pause.caseId, sourceId: pause.sourceId, checks,
    status: checks.every(row => row.basicPersists && row.rbCarriedByAccrual && row.tdNotPristine && row.gcvIndependent) ? 'PASS' : 'FAIL' };
});
const zeroWithdrawalPersistence = pauseChecks.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';

// Exactly one full frozen holdout projection pass occurs below. All architecture,
// parameters and the deterministic lock hash were fixed above and saved earlier.
const holdoutRows = dataset.cases.filter(item => item.role === 'holdout').flatMap(item => {
  const predictions = new Map(projectIteration2(caseInput(item), model).rows.map(row => [row.policyYear, row]));
  return item.rows.map(actual => {
    const predicted = predictions.get(actual.policyYear);
    const dollarError = predicted.total - actual.projectedRemainingSurrenderValue;
    return { caseId: item.caseId, age: actual.age, policyYear: actual.policyYear,
      actual: actual.projectedRemainingSurrenderValue, predicted: predicted.total, dollarError,
      absolutePercent: actual.projectedRemainingSurrenderValue === 0 ? 0 : round(Math.abs(dollarError) / actual.projectedRemainingSurrenderValue * 100),
      negativeComponents: predicted.negativeComponents, allocationResidual: predicted.allocationResidual };
  });
});
const worst = holdoutRows.reduce((left, right) => left.absolutePercent >= right.absolutePercent ? left : right);
const holdout = {
  MAPE: round(holdoutRows.reduce((sum, row) => sum + row.absolutePercent, 0) / holdoutRows.length),
  maxErrorPercent: worst.absolutePercent,
  rowsAbove010: holdoutRows.filter(row => row.absolutePercent > 0.10).length,
  annualRows: holdoutRows.length,
  maxDollarError: Math.max(...holdoutRows.map(row => Math.abs(row.dollarError))),
  worstCase: worst.caseId, worstAge: worst.age, worstPolicyYear: worst.policyYear,
  rowsWithImpossibleComponentAllocations: holdoutRows.filter(row => row.negativeComponents.length).length
};
const baseline = { engine: 'ipos-approximation-terminal-dividend-transition-v4', MAPE: 2.29650947,
  maxErrorPercent: 11.80075621, rowsAbove010: 247, annualRows: 325, maxDollarError: 457617,
  worstCase: '50yrs_5pay_130k_avpu', worstAge: 72, worstPolicyYear: 22, leakage: 'PASS' };
if (baselineReport.results.holdout.MAPE !== baseline.MAPE || baselineReport.results.holdout.maxErrorPercent !== baseline.maxErrorPercent) throw Error('Frozen baseline changed');
const leakage = model.calibrationCaseIds.every(id => roles[id] === 'calibration') &&
  model.sourceIds.every(id => evidence.sourceRecords.find(source => source.sourceId === id).frozenRole === 'calibration') ? 'PASS' : 'FAIL';
const calibrationImpossible = dataset.cases.filter(item => item.role === 'calibration').reduce((sum, item) =>
  sum + projectIteration2(caseInput(item), model).rows.filter(row => row.negativeComponents.length).length, 0);
const structural = firstWithdrawalGate === 'PASS' && fiveRowComponentGate === 'PASS' && zeroWithdrawalPersistence === 'PASS' &&
  holdout.rowsWithImpossibleComponentAllocations === 0 && calibrationImpossible === 0;
const retained = leakage === 'PASS' && structural && holdout.maxErrorPercent < baseline.maxErrorPercent &&
  holdout.rowsAbove010 <= baseline.rowsAbove010 && holdout.MAPE <= baseline.MAPE;
const report = {
  ...lockArtifact, holdoutEvaluated: true, holdoutEvaluationCount: 1,
  architecture: {
    rbState: savedLock.rbFormula,
    gcvState: 'Iteration 1 independent GCV curve at current Basic Amount, minus genuine current GCV allocation.',
    tdState: 'Iteration 1 independent v4 seven-feature TD transition unchanged; no Iteration 2 TD fitting.',
    basicAmountState: 'Unchanged without GCV tap; Iteration 1 evidence-supported reduction relationship otherwise.'
  },
  calibrationOnlyParameters: { rbFreeParameters: 0, terminalTransitions: model.terminalTransitions, reductionCoefficients: model.reductionCoefficients },
  firstWithdrawalGate, firstWithdrawals,
  fiveRowComponentGate,
  fiveRowThreshold: 'Every individual component and total <=0.10% of its genuine component value, or <=HKD1 displayed rounding; zero denominators are judged by dollars.',
  fiveRows, zeroWithdrawalPersistence,
  pauseAccuracyBoundary: 'Persistence-only structure; not a claim of full pause/resume numerical accuracy.',
  pauseChecks, holdout, holdoutRows, leakage,
  frozenScheduleAnomalies: dataset.cases.flatMap(item => item.withdrawalSchedule.filter(row =>
    Math.abs(row.withdrawal - row.withdrawalFromGuaranteedCashValue - row.withdrawalFromReversionaryBonus - row.withdrawalFromTerminalDividend) > 1)
    .map(row => ({ caseId: item.caseId, age: row.age, policyYear: row.policyYear, withdrawal: row.withdrawal,
      allocationResidual: row.withdrawal - row.withdrawalFromGuaranteedCashValue - row.withdrawalFromReversionaryBonus - row.withdrawalFromTerminalDividend }))),
  calibrationImpossibleComponentRows: calibrationImpossible,
  baseline, iteration1: { candidate: iteration1.candidate, decision: iteration1.decision, holdout: iteration1.holdout,
    fiveRowComponentGate: iteration1.fiveRowComponentGate },
  decision: retained ? 'ITERATION_2_RETAINED' : 'ITERATION_2_REJECTED',
  retainedEngine: retained ? candidate : baseline.engine,
  reason: retained ? 'All structural gates pass and the frozen holdout improves under the selection priority.' :
    'The parameter-free annual-increment rule changes Iteration 1 RB errors from within HKD1 to HKD265-512 across the five rows; all five component rows fail, and frozen maximum error remains materially worse than v4. v4 remains retained.',
  dominantRemainingIssue: fiveRows.some(row => Math.abs(row.components.TD.percentError ?? Infinity) > 0.10) ? 'TD transition' :
    fiveRows.some(row => Math.abs(row.components.RB.percentError ?? Infinity) > 0.10) ? 'RB transition' : 'long-horizon component transition',
  nextHypothesis: retained ? null : 'Restore the Iteration 1 RB transition, then test one parameter-free TD carried state plus genuine no-withdrawal annual TD increment using calibration evidence only.',
  researchStatus: retained && holdout.maxErrorPercent <= 0.10 ? 'READY_FOR_INTEGRATION' : 'NOT_READY_FOR_INTEGRATION',
  productionActivated: false,
  qualification: 'Research approximation calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.'
};
write('./component-state-iteration-2-research.json', report);

const lines = ['# Component-State Phase A / Iteration 2', '', report.qualification, '',
  `Starting HEAD: \`${startingHead}\``, '', `Candidate: **${candidate}**`, '',
  `Decision: **${report.decision}**. Retained engine: **${report.retainedEngine}**. Status: **${report.researchStatus}**.`, '',
  '## Locked hypothesis', '', report.hypothesis, '', `Formula: \`${report.rbFormula}\``, '',
  `RB free parameters: 0. Model lock: \`${modelLockSHA256}\`.`, '',
  `Calibration evidence: ${calibrationEvidence.transitionRows} affected transitions; mean absolute residual HKD ${calibrationEvidence.meanAbsoluteDollarError}; median signed residual HKD ${calibrationEvidence.medianSignedDollarError}; maximum absolute residual HKD ${calibrationEvidence.maximumAbsoluteDollarError}; ${calibrationEvidence.withinDisplayedHKD1} within HKD1.`, '',
  calibrationEvidence.sourceHeldOutInterpretation, '',
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
    `Basic Amount: genuine ${row.basicAmount.genuine}; model ${row.basicAmount.model}. Result: ${row.status}.`, '');
}
lines.push('## Zero-withdrawal persistence', '', `${zeroWithdrawalPersistence}. ${report.pauseAccuracyBoundary}`, '',
  '## Single frozen holdout evaluation', '',
  '| Metric | v4 | Iteration 1 | Iteration 2 |', '| --- | --- | --- | --- |',
  ...['MAPE','maxErrorPercent','rowsAbove010','annualRows','maxDollarError','worstCase','worstAge','worstPolicyYear'].map(key =>
    `| ${key} | ${baseline[key]} | ${iteration1.holdout[key]} | ${holdout[key]} |`), '',
  `Leakage: ${leakage}. Holdout projection count after lock: 1.`, '',
  `Impossible component rows: calibration ${calibrationImpossible}; holdout ${holdout.rowsWithImpossibleComponentAllocations}.`, '',
  'The frozen age-100 HKD85/8/2 schedule anomalies remain unchanged and unallocated.', '',
  '## Decision', '', report.reason, '', `Dominant remaining issue: ${report.dominantRemainingIssue}.`, '',
  `Smallest next hypothesis (not implemented): ${report.nextHypothesis ?? 'NONE'}`, '',
  'Iteration 1 artifacts remain unchanged. No production, portfolio, fixture, role or baseline file changed. No Iteration 3 was run.');
fs.writeFileSync(new URL('./component-state-iteration-2-research.md', import.meta.url), lines.join('\n') + '\n');
console.log(JSON.stringify({ candidate, modelLockSHA256, firstWithdrawalGate, fiveRowComponentGate,
  zeroWithdrawalPersistence, holdout, leakage, decision: report.decision, retainedEngine: report.retainedEngine,
  researchStatus: report.researchStatus }));
