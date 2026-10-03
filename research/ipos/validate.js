import fs from 'node:fs';
import { buildCalibrationModel, projectPolicy } from './engine.js';

const dataset = JSON.parse(fs.readFileSync(new URL('./fixtures/dataset.json', import.meta.url), 'utf8'));
const cases = dataset.cases;
const model = buildCalibrationModel(cases);
const calibration = cases.filter(item => item.role === 'calibration');
const holdouts = cases.filter(item => item.role === 'holdout');
const round = value => Number(value.toFixed(8));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function error(actual, predicted) {
  const dollarError = predicted - actual;
  const signedPercent = actual === 0 ? 0 : dollarError / actual * 100;
  return { dollarError: Number(dollarError.toFixed(2)), signedPercent: round(signedPercent), absolutePercent: round(Math.abs(signedPercent)) };
}
function firstCrossing(rows, threshold) {
  const row = rows.find(item => item.absolutePercent > threshold);
  return row ? { age: row.age, policyYear: row.policyYear } : 'NEVER_EXCEEDED';
}
function summarize(item) {
  const result = projectPolicy(item, model);
  const predictions = new Map(result.rows.map(row => [row.policyYear, row]));
  const rows = item.rows.map(actual => {
    const predicted = predictions.get(actual.policyYear)?.projectedRemainingSurrenderValue ?? 0;
    return { caseName: item.caseId, issueAge: item.issueAge, annualPremium: item.annualPremium, initialBasicAmount: item.initialBasicAmount, withdrawalType: actual.withdrawalType, withdrawalStartAge: item.withdrawalStartAge, age: actual.age, policyYear: actual.policyYear, withdrawal: actual.withdrawal, iposRemainingSurrenderValue: actual.projectedRemainingSurrenderValue, modelRemainingSurrenderValue: predicted, ...error(actual.projectedRemainingSurrenderValue, predicted), status: predicted === 0 && actual.projectedRemainingSurrenderValue > 0 ? 'FAIL' : 'OK' };
  });
  const absolute = rows.map(row => row.absolutePercent), dollars = rows.map(row => Math.abs(row.dollarError)), worst = rows.reduce((a, b) => a.absolutePercent >= b.absolutePercent ? a : b);
  return { caseName: item.caseId, issueAge: item.issueAge, annualPremium: item.annualPremium, initialBasicAmount: item.initialBasicAmount, withdrawalType: item.withdrawalPattern, withdrawalStartAge: item.withdrawalStartAge, rows, MAPE: round(mean(absolute)), maxErrorPercent: round(Math.max(...absolute)), maxDollarError: Number(Math.max(...dollars).toFixed(2)), worstAge: worst.age, worstPolicyYear: worst.policyYear, crossings: { '>0.01%': firstCrossing(rows, 0.01), '>0.02%': firstCrossing(rows, 0.02), '>0.05%': firstCrossing(rows, 0.05), '>0.10%': firstCrossing(rows, 0.10) }, distribution: { '<=0.005%': absolute.filter(x => x <= 0.005).length, '<=0.01%': absolute.filter(x => x <= 0.01).length, '<=0.02%': absolute.filter(x => x <= 0.02).length, '<=0.05%': absolute.filter(x => x <= 0.05).length, '<=0.10%': absolute.filter(x => x <= 0.10).length, '>0.10%': absolute.filter(x => x > 0.10).length } };
}
function aggregate(items) {
  const rows = items.flatMap(item => item.rows), absolute = rows.map(row => row.absolutePercent), dollars = rows.map(row => Math.abs(row.dollarError)), worst = rows.reduce((a, b) => a.absolutePercent >= b.absolutePercent ? a : b);
  return { MAPE: round(mean(absolute)), maxErrorPercent: round(Math.max(...absolute)), maxDollarError: Number(Math.max(...dollars).toFixed(2)), worstCase: worst.caseName, worstAge: worst.age, worstPolicyYear: worst.policyYear, annualRows: rows.length, distribution: { '<=0.005%': absolute.filter(x => x <= 0.005).length, '<=0.01%': absolute.filter(x => x <= 0.01).length, '<=0.02%': absolute.filter(x => x <= 0.02).length, '<=0.05%': absolute.filter(x => x <= 0.05).length, '<=0.10%': absolute.filter(x => x <= 0.10).length, '>0.10%': absolute.filter(x => x > 0.10).length } };
}
const calibrationResults = calibration.map(summarize);
const holdoutResults = holdouts.map(summarize);
const holdout = aggregate(holdoutResults);
const report = {
  engineVersion: 'ipos-approximation-terminal-dividend-transition-v4',
  dataset: { calibrationCases: calibration.length, holdoutCases: holdouts.length, annualRows: cases.reduce((sum, item) => sum + item.rows.length, 0), fixtureSource: dataset.sourcePolicy, leakageCheck: model.calibrationCaseIds.every(id => calibration.some(item => item.caseId === id)) },
  modelSelection: { selected: 'policyYearBasicAmountNormalizedTransitionWithTerminalDividendState', benchmarkCandidates: ['directPremiumScaling', 'basicAmountNormalized', 'aggregateStateRatio', 'componentState', 'policyYearBasicAmountNormalizedTransition', 'policyYearBasicAmountNormalizedTransitionWithTerminalDividendState'], previousV1HoldoutMAPE: 17.17569366, previousV1HoldoutMaxErrorPercent: 57.11395611, previousV2HoldoutMAPE: 5.973153, previousV2HoldoutMaxErrorPercent: 56.85795543, previousV3HoldoutMAPE: 5.16213632, previousV3HoldoutMaxErrorPercent: 35.97650942, baseCurveChange: 'calibration-only first-withdrawal component reconstruction; no holdout rows used', terminalDividendChange: 'component-specific terminal-dividend state recovery correction fitted only from calibration rows', rationale: 'anchor-specific policy-year base curves and region-specific path-conditioned transitions with explicit terminal-dividend state recovery' },
  results: { calibration: aggregate(calibrationResults), holdout },
  holdouts: holdoutResults,
  thresholdTargets: { IDEAL: holdout.maxErrorPercent <= 0.01, STRONG: holdout.maxErrorPercent <= 0.02, TARGET: holdout.maxErrorPercent <= 0.05, HARD_LIMIT: holdout.maxErrorPercent <= 0.10 },
  supportedRange: { issueAges: [...new Set(cases.map(item => item.issueAge))].sort((a, b) => a - b), premiums: [...new Set(cases.map(item => item.annualPremium))].sort((a, b) => a - b), withdrawalStartAges: [...new Set(cases.map(item => item.withdrawalStartAge).filter(Boolean))].sort((a, b) => a - b), withdrawalPatterns: [...new Set(cases.map(item => item.withdrawalPattern))] },
  notVerifiedRange: ['continuous premiums outside supplied anchors', 'portfolio pause/resume against direct proposal evidence', 'production integration'],
  finalStatus: holdout.maxErrorPercent <= 0.10 ? 'READY_FOR_INTEGRATION_REVIEW' : 'NOT_READY_FOR_INTEGRATION'
};
report.diagnosis = { worstCase: report.results.holdout.worstCase, primaryObservedFactors: ['terminal-dividend state recovery after a correct first withdrawal', 'remaining long-horizon transition behavior', 'display rounding at low Policy Years'], evidenceBoundary: 'Terminal-dividend state recovery is fitted only from calibration component rows; holdout first-withdrawal rows remain validation-only.' };
fs.writeFileSync(new URL('./validation-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
const lines = ['# iPOS Approximation Validation Report', '', 'ENGINE VERSION: ' + report.engineVersion, '', '## DATASET', '- Calibration cases: ' + report.dataset.calibrationCases, '- Holdout cases: ' + report.dataset.holdoutCases, '- Annual rows: ' + report.dataset.annualRows, '- Leakage check: ' + (report.dataset.leakageCheck ? 'PASS' : 'FAIL'), '', '## RESULTS', '- Calibration MAPE: ' + report.results.calibration.MAPE + '%', '- Calibration max %: ' + report.results.calibration.maxErrorPercent + '%', '- Holdout MAPE: ' + report.results.holdout.MAPE + '%', '- Holdout max %: ' + report.results.holdout.maxErrorPercent + '%', '- Holdout max $: HKD ' + report.results.holdout.maxDollarError, '- Worst case: ' + report.results.holdout.worstCase, '- Worst age / Policy Year: ' + report.results.holdout.worstAge + ' / ' + report.results.holdout.worstPolicyYear, '', '## HOLDOUT CROSSINGS'];
holdoutResults.forEach(item => {
  lines.push('### ' + item.caseName, '- MAPE: ' + item.MAPE + '%', '- Max Error %: ' + item.maxErrorPercent + '%', '- Max Dollar Error: HKD ' + item.maxDollarError, '- Worst age / Policy Year: ' + item.worstAge + ' / ' + item.worstPolicyYear, '- First >0.01%: ' + JSON.stringify(item.crossings['>0.01%']), '- First >0.02%: ' + JSON.stringify(item.crossings['>0.02%']), '- First >0.05%: ' + JSON.stringify(item.crossings['>0.05%']), '- First >0.10%: ' + JSON.stringify(item.crossings['>0.10%']));
});
lines.push('', '## ACCURACY DISTRIBUTION', ...Object.entries(report.results.holdout.distribution).map(([key, value]) => '- ' + key + ': ' + value), '', '## FINAL STATUS', report.finalStatus, '', 'This is a calibrated approximation and is not the official AIA/iPOS calculation engine.');
fs.writeFileSync(new URL('./validation-report.md', import.meta.url), lines.join('\n') + '\n');
console.log(JSON.stringify({finalStatus: report.finalStatus, holdout: report.results.holdout}));
