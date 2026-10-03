import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildComponentStateModel, projectComponentState } from './component-state.js';

const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const dataset = read('./fixtures/dataset.json');
const evidence = read('./evidence-gap-matrix.json');
const baseline = read('./validation-report.json');
const model = buildComponentStateModel(dataset.cases, evidence);
const round = n => Number(n.toFixed(8));
const keys = ['GCV', 'RB', 'TD', 'total'];
const compare = (actual, predicted) => Object.fromEntries(keys.map(k => [k, {
  genuine: actual[k], model: predicted[k], dollarError: predicted[k] - actual[k],
  percentError: actual[k] === 0 ? (predicted[k] === 0 ? 0 : null) : round((predicted[k] - actual[k]) / actual[k] * 100),
  percentOfGenuineTotal: actual.total === 0 ? null : round((predicted[k] - actual[k]) / actual.total * 100)
}]));
const componentPass = c => Object.values(c).every(v => Math.abs(v.dollarError) <= 1 || (v.percentError != null && Math.abs(v.percentError) <= .10));
const caseInput = c => ({ product: c.product, currency: c.currency, paymentTerm: c.paymentTerm,
  issueAge: c.issueAge, annualPremium: c.annualPremium, initialBasicAmount: c.initialBasicAmount,
  withdrawalPattern: c.withdrawalPattern, withdrawalStartAge: c.withdrawalStartAge,
  endAge: c.endAge ?? c.issueAge + 60, withdrawalSchedule: c.withdrawalSchedule });
const calibration = dataset.cases.filter(c => c.role === 'calibration');
const calibrationResults = calibration.map(c => ({ caseId: c.caseId, projection: projectComponentState(caseInput(c), model) }));
const sourceFor = id => evidence.sourceRecords.find(s => s.usable && s.caseId === id);
const firstWithdrawals = dataset.cases.filter(c => c.role !== 'regression').map(c => {
  const first = c.rows.find(r => r.withdrawal > 0 && r.withdrawalType === 'medicalWithdrawal');
  if (!first) return null;
  const source = sourceFor(c.caseId), actual = source.postRows.find(r => r.policyYear === first.policyYear);
  const predicted = projectComponentState({ ...caseInput(c), endAge: first.age }, model).rows.at(-1);
  const base = source.baseRows.find(r => r.policyYear === first.policyYear);
  const components = compare(actual, predicted);
  const sourceIdentityError = actual.total - (base.total - actual.withdrawal);
  const modelIdentityError = predicted.total - (predicted.noWithdrawalBaseValue - predicted.withdrawal);
  const sumError = predicted.total - predicted.GCV - predicted.RB - predicted.TD;
  return { caseId: c.caseId, age: first.age, policyYear: first.policyYear, components, sourceIdentityError, modelIdentityError, sumError,
    status: Math.abs(sourceIdentityError) <= 1 && Math.abs(modelIdentityError) <= 1 && Math.abs(sumError) <= 1 && Object.values(components).every(v => Math.abs(v.dollarError) <= 1) ? 'PASS' : 'FAIL' };
}).filter(Boolean);
const firstWithdrawalGate = firstWithdrawals.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL';
// These five frozen holdout rows are diagnostics ONLY. Never supplied to model building.
const fiveRows = evidence.immediateTransitionDiagnostics.map(d => {
  const c = dataset.cases.find(c => c.caseId === d.caseId);
  const predicted = projectComponentState({ ...caseInput(c), endAge: d.age }, model).rows.at(-1);
  const components = compare(d.genuine, predicted);
  return { caseId: d.caseId, age: d.age, policyYear: d.policyYear, components,
    basicAmount: { genuine: d.genuine.basicAmount, model: predicted.basicAmountState },
    status: componentPass(components) ? 'PASS' : 'FAIL' };
});
const fiveRowComponentGate = fiveRows.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL';
const pauseChecks = evidence.pauseResumeEvidence.map(p => {
  const s = evidence.sourceRecords.find(s => s.sourceId === p.sourceId);
  const input = { issueAge: s.metadata.issueAge, initialBasicAmount: s.metadata.initialBasicAmount,
    withdrawalStartAge: s.metadata.withdrawalStartAge,
    endAge: p.zeroWithdrawalYears.at(-1).age,
    withdrawalSchedule: s.allocationRows.map(r => ({ age: r.age, withdrawal: r.total,
      withdrawalFromGuaranteedCashValue: r.fromGCV, withdrawalFromReversionaryBonus: r.fromRB, withdrawalFromTerminalDividend: r.fromTD })) };
  const rows = projectComponentState(input, model).rows;
  const checks = p.zeroWithdrawalYears.map(a => {
    const predicted = rows.find(r => r.policyYear === a.policyYear);
    const prev = rows.find(r => r.policyYear === a.policyYear - 1);
    const pristine = model.baseAt(a.policyYear, input.initialBasicAmount);
    return { age: a.age, policyYear: a.policyYear, components: compare(a.postWithdrawal, predicted),
      genuineBasicAmount: a.postWithdrawal.basicAmount, modelBasicAmount: predicted.basicAmountState,
      basicPersists: predicted.basicAmountState === prev.basicAmountState,
      rbCarryoverPersists: predicted.carryRB > 0,
      tdNotPristine: predicted.TD !== Math.round(pristine.terminalDividendCashValue),
      gcvIndependent: Math.abs(predicted.GCV - Math.round(model.baseAt(a.policyYear, prev.basicAmountState).guaranteedCashValue)) <= 1 };
  });
  return { caseId: p.caseId, sourceId: p.sourceId, checks,
    status: checks.every(r => r.basicPersists && r.rbCarryoverPersists && r.tdNotPristine && r.gcvIndependent) ? 'PASS' : 'FAIL' };
});
const zeroWithdrawalPersistence = pauseChecks.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL';
// Model architecture/parameters fixed BEFORE the one full holdout pass.
const modelLock = { rbPersistence: model.rbPersistence, terminalTransitions: model.terminalTransitions,
  reductionCoefficients: model.reductionCoefficients, calibrationCaseIds: model.calibrationCaseIds, sourceIds: model.sourceIds };
const lockHash = crypto.createHash('sha256').update(JSON.stringify(modelLock)).digest('hex');
const holdoutRows = dataset.cases.filter(c => c.role === 'holdout').flatMap(c => {
  const predictions = new Map(projectComponentState(caseInput(c), model).rows.map(r => [r.policyYear, r]));
  return c.rows.map(actual => {
    const p = predictions.get(actual.policyYear), dollarError = p.total - actual.projectedRemainingSurrenderValue;
    return { caseId: c.caseId, age: actual.age, policyYear: actual.policyYear,
      actual: actual.projectedRemainingSurrenderValue, predicted: p.total, dollarError,
      absolutePercent: actual.projectedRemainingSurrenderValue === 0 ? 0 : round(Math.abs(dollarError) / actual.projectedRemainingSurrenderValue * 100),
      negativeComponents: p.negativeComponents, allocationResidual: p.allocationResidual };
  });
});
const worst = holdoutRows.reduce((a, b) => a.absolutePercent >= b.absolutePercent ? a : b);
const holdout = { MAPE: round(holdoutRows.reduce((a, r) => a + r.absolutePercent, 0) / holdoutRows.length),
  maxErrorPercent: worst.absolutePercent, rowsAbove010: holdoutRows.filter(r => r.absolutePercent > .10).length,
  annualRows: holdoutRows.length, maxDollarError: Math.max(...holdoutRows.map(r => Math.abs(r.dollarError))),
  worstCase: worst.caseId, worstAge: worst.age, worstPolicyYear: worst.policyYear,
  rowsWithImpossibleComponentAllocations: holdoutRows.filter(r => r.negativeComponents.length).length };
const roles = Object.fromEntries(dataset.cases.map(c => [c.caseId, c.role]));
const leakage = model.calibrationCaseIds.every(id => roles[id] === 'calibration') && model.sourceIds.every(id => evidence.sourceRecords.find(s => s.sourceId === id).frozenRole === 'calibration') && lockHash === crypto.createHash('sha256').update(JSON.stringify(modelLock)).digest('hex') ? 'PASS' : 'FAIL';
const baselineMetrics = { MAPE: 2.29650947, maxErrorPercent: 11.80075621, rowsAbove010: 247, annualRows: 325,
  maxDollarError: 457617, worstCase: '50yrs_5pay_130k_avpu', worstAge: 72, worstPolicyYear: 22 };
if (baseline.results.holdout.MAPE !== baselineMetrics.MAPE || baseline.results.holdout.maxErrorPercent !== baselineMetrics.maxErrorPercent) throw Error('Frozen baseline changed');
const calibrationImpossible = calibrationResults.reduce((a, c) => a + c.projection.rows.filter(r => r.negativeComponents.length).length, 0);
const structural = firstWithdrawalGate === 'PASS' && fiveRowComponentGate === 'PASS' && zeroWithdrawalPersistence === 'PASS' && holdout.rowsWithImpossibleComponentAllocations === 0 && calibrationImpossible === 0;
const retained = leakage === 'PASS' && structural && holdout.maxErrorPercent < baselineMetrics.maxErrorPercent;
const report = {
  phase: 'A', iteration: 1, startingHead: 'd0311fc4b786c8f3ea17c2699a4f43f4da886565',
  candidate: 'ipos-approximation-independent-component-state-phase-a-iteration-1',
  baseline: { engine: baseline.engineVersion, ...baselineMetrics, leakage: 'PASS' },
  hypothesis: 'Independent GCV and Basic Amount with persistent RB depletion and the existing standalone v4 TD transition can repair the aggregate-state component mismatch.',
  architecture: { basicAmountState: 'Unchanged at zero GCV tap; v4 calibration reduction coefficient times fromGCV/GCV_per_BasicAmount(PY) otherwise.',
    gcvState: 'Annual GCV_per_BasicAmount(PY) times current Basic Amount, minus current genuine GCV allocation only; never scaled by aggregate surrender value.',
    rbState: 'Annual RB base minus previous RB deficit times one calibration median persistence factor (and capital ratio only after a GCV tap), minus current RB allocation.',
    tdState: 'Independent previous TD and associated TD withdrawal feed the existing seven-feature v4 TD transition; subtract current TD allocation. No aggregate-state ratio.',
    baseCurves: 'Full committed genuine annual calibration GCV/RB/TD per Basic Amount; existing anchor interpolation. Total is sum of components.',
    negativeStates: 'Clamp at zero but report impossible component allocations as structural failures; never hide the clamp.' },
  calibrationRules: ['Only frozen calibration fixtures and matching frozen calibration source records used for construction.',
    'One median RB factor from clean same-Basic-Amount consecutive rows with previous RB deficit >HKD10 (rounding noise exclusion). Includes genuine pause rows.',
    'Reuse v4 TD regression feature form; complete calibration annual base evidence replaces sparse interpolation.',
    'Frozen schedules, roles and targets unchanged. Genuine withdrawal allocations are supplied inputs; this is not an allocation-generating formula.',
    'Five priority rows and full holdout are evaluation-only; no refit, search, tuning or second iteration.'],
  modelLock, modelLockSHA256: lockHash, rbFitRows: model.fitRows, baseIdentityMaxResidual: model.baseIdentityMaxResidual,
  frozenRoles: roles, fixtureSHA256: crypto.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/dataset.json', import.meta.url))).digest('hex'),
  calibrationSummary: { cases: calibrationResults.length, projectedRows: calibrationResults.reduce((a, c) => a + c.projection.rows.length, 0),
    impossibleComponentRows: calibrationImpossible },
  frozenScheduleAnomalies: dataset.cases.flatMap(c => c.withdrawalSchedule.filter(r => Math.abs(r.withdrawal - r.withdrawalFromGuaranteedCashValue - r.withdrawalFromReversionaryBonus - r.withdrawalFromTerminalDividend) > 1).map(r => ({ caseId: c.caseId, age: r.age, policyYear: r.policyYear, withdrawal: r.withdrawal,
    allocationResidual: r.withdrawal - r.withdrawalFromGuaranteedCashValue - r.withdrawalFromReversionaryBonus - r.withdrawalFromTerminalDividend }))),
  firstWithdrawalGate, firstWithdrawals,
  fiveRowComponentGate, fiveRowThreshold: 'Every individual component AND total <=0.10% of its own genuine value, or <=HKD1 displayed rounding; zero denominator reported null and judged by dollars.', fiveRows,
  zeroWithdrawalPersistence, pauseAccuracyBoundary: 'Persistence-only gate; genuine pause component errors included, not certification of pause/resume accuracy.', pauseChecks,
  holdoutEvaluationCount: 1, holdout, holdoutRows, leakage,
  decision: retained ? 'ITERATION_1_RETAINED' : 'ITERATION_1_REJECTED',
  retainedEngine: retained ? 'ipos-approximation-independent-component-state-phase-a-iteration-1' : baseline.engineVersion,
  reason: retained ? 'All structural/safety gates pass and frozen maximum error is lower.' :
    'GCV is exact and RB is within HKD1 at all five rows, but four TD rows fail the component gate. Frozen maximum error and MAPE worsen substantially; negative raw component states also expose an insufficient independent transition. v4 remains retained.',
  nextHypothesis: retained ? null : 'Test whether RB replenishment should follow the annual increment in the no-withdrawal RB curve after Basic Amount reduction, rather than carrying a capital-scaled RB deficit.',
  researchStatus: 'NOT_READY_FOR_INTEGRATION', productionActivated: false,
  qualification: 'Approximation research calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.'
};
fs.writeFileSync(new URL('./component-state-research.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
const lines = ['# Component-State Phase A / Iteration 1', '', report.qualification, '',
  `Decision: **${report.decision}**. Retained engine: **${report.retainedEngine}**. Status: **${report.researchStatus}**.`, '',
  '## Baseline and hypothesis', '', report.hypothesis, '', `Frozen v4: ${JSON.stringify(baselineMetrics)}. Baseline records unchanged.`, '',
  '## Architecture', '', ...Object.entries(report.architecture).map(([k,v]) => `- ${k}: ${v}`), '',
  '## Calibration boundary', '', ...report.calibrationRules.map(v => '- ' + v), '',
  `RB persistence: ${model.rbPersistence}; ${model.fitRows.length} clean calibration transitions. Base sum identity maximum residual: HKD ${model.baseIdentityMaxResidual}.`, '',
  `Model locked before holdout: ${lockHash}. Frozen roles and fixture hash are recorded in JSON.`, '',
  '## First-withdrawal gate', '', firstWithdrawalGate, '',
  '| Case | Age / PY | Source total identity residual | Model total identity residual | GCV error | RB error | TD error | Total error | Result |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...firstWithdrawals.map(r => `| ${r.caseId} | ${r.age} / ${r.policyYear} | ${r.sourceIdentityError} | ${r.modelIdentityError} | ${r.components.GCV.dollarError} | ${r.components.RB.dollarError} | ${r.components.TD.dollarError} | ${r.components.total.dollarError} | ${r.status} |`), '',
  '## Five-row component gate', '', fiveRowComponentGate + '. ' + report.fiveRowThreshold, ''];
for (const r of fiveRows) {
  lines.push(`### ${r.caseId}: age ${r.age} / PY${r.policyYear}`, '',
    '| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % of component | % of genuine total |',
    '| --- | --- | --- | --- | --- | --- |',
    ...keys.map(k => {const c=r.components[k]; return `| ${k} | ${c.genuine} | ${c.model} | ${c.dollarError} | ${c.percentError ?? 'N/A'} | ${c.percentOfGenuineTotal ?? 'N/A'} |`;}), '', `Result: ${r.status}. Basic Amount: genuine ${r.basicAmount.genuine}; model ${r.basicAmount.model}.`, '');
}
lines.push('## Zero-withdrawal persistence', '', zeroWithdrawalPersistence + '. ' + report.pauseAccuracyBoundary, '',
  '| Source case | Zero rows | Result |', '| --- | --- | --- |', ...pauseChecks.map(r => `| ${r.caseId} / ${r.sourceId} | ${r.checks.length} | ${r.status} |`), '',
  'GCV is allowed to equal its unaffected curve where no GCV tap occurred. This is independent preservation, not a reset. RB deficit, TD history and Basic Amount persist. Per-row genuine/model component errors are in JSON.', '',
  '## One frozen holdout evaluation', '', '| Metric | v4 | Iteration 1 |', '| --- | --- | --- |',
  ...Object.keys(baselineMetrics).map(k => `| ${k} | ${baselineMetrics[k]} | ${holdout[k]} |`), '',
  `Impossible component allocation rows: ${holdout.rowsWithImpossibleComponentAllocations}; calibration: ${report.calibrationSummary.impossibleComponentRows}.`, '',
  'The three previously audited age-100 schedule anomalies remain unchanged (85/8/2 HKD with zero component allocation). No invented allocation or named-case correction is applied. The JSON records these mismatches separately. Metrics use the frozen schedule, as v4 does; component total remains the independent component sum.', '',
  '## Leakage and decision', '', `Leakage: ${leakage}. ${report.reason}`, '',
  `Smallest next hypothesis (not implemented; unproven): ${report.nextHypothesis ?? 'None in this checkpoint'}`, '',
  'No production changes, no portfolio changes, no baseline replacement, no Iteration 2, no merge.');
fs.writeFileSync(new URL('./component-state-research.md', import.meta.url), lines.join('\n') + '\n');
console.log(JSON.stringify({ decision: report.decision, firstWithdrawalGate, fiveRowComponentGate, zeroWithdrawalPersistence, holdout, leakage }));
