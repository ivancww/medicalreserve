import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCalibrationModel, policyYearFor, projectPolicy, simulatePortfolio } from '../research/ipos/engine.js';

const dataset = JSON.parse(fs.readFileSync(new URL('../research/ipos/fixtures/dataset.json', import.meta.url), 'utf8'));
const model = buildCalibrationModel(dataset.cases);

test('Policy Year mapping is canonical', () => {
  assert.equal(policyYearFor(45, 55), 10);
  assert.equal(policyYearFor(45, 61), 16);
  assert.equal(policyYearFor(40, 61), 21);
  assert.equal(policyYearFor(50, 61), 11);
});

test('one engine accepts Original, AVF, and AVPU', () => {
  for (const pattern of ['Original', 'AVF', 'AVPU']) {
    const result = projectPolicy({ ...dataset.cases[0], withdrawalPattern: pattern, withdrawalStartAge: 55, endAge: 61 }, model);
    assert.equal(result.rows.length, 21);
  }
});

test('age-55 first-year displayed values are present and predictions stay non-negative', () => {
  const item = dataset.cases.find(caseData => caseData.caseId === '45yrs_5pay_130k_avf_55');
  assert.equal(item.rows.find(row => row.age === 55).projectedRemainingSurrenderValue, 814889);
  assert.equal(item.rows.find(row => row.age === 55).withdrawal, 14031);
  const result = projectPolicy(item, model);
  assert.ok(result.rows.every(row => row.projectedRemainingSurrenderValue >= 0));
});

test('zero-withdrawal continuation keeps persistent state', () => {
  const item = dataset.cases.find(caseData => caseData.caseId === '45yrs_5pay_130k_avf');
  const result = projectPolicy(item, model);
  assert.ok(result.rows.find(row => row.age === 61).projectedRemainingSurrenderValue > 0);
  assert.ok(result.rows.find(row => row.age === 78).projectedRemainingSurrenderValue >= 0);
});

test('terminal-dividend state transition is calibrated separately', () => {
  assert.deepEqual(Object.keys(model.terminalTransitions).sort(), ['early', 'late', 'middle']);
  for (const coefficients of Object.values(model.terminalTransitions)) {
    assert.equal(coefficients.length, 7);
    assert.ok(coefficients.every(Number.isFinite));
  }
});

test('portfolio keeps independent policy histories', () => {
  const result = simulatePortfolio(dataset.cases.slice(0, 2).map(item => ({ ...item, withdrawalStartAge: 65 })), model, { startAge: 65, endAge: 75 });
  assert.equal(result.rows.length, 11);
  assert.equal(result.rows[0].activePolicyIndex, 0);
  assert.equal(result.rows[5].activePolicyIndex, 1);
});

test('malformed and unsupported inputs fail safely', () => {
  assert.throws(() => projectPolicy({ ...dataset.cases[0], currency: 'USD' }, model), /Unsupported/);
  assert.throws(() => projectPolicy({ ...dataset.cases[0], issueAge: 70, withdrawalStartAge: 60 }, model), /Invalid/);
  assert.throws(() => buildCalibrationModel([]), /No calibration/);
});

test('anchor premiums, interpolation, exhaustion, and deterministic repeat are covered', () => {
  for (const premium of [40000, 70000, 100000, 130000, 150000, 180000, 200000]) {
    const input = { ...dataset.cases[0], annualPremium: premium, withdrawalStartAge: 61, endAge: 61 };
    assert.equal(projectPolicy(input, model).rows.length, 21);
  }
  const outOfRange = projectPolicy({ ...dataset.cases[0], annualPremium: 250000, endAge: 61 }, model);
  assert.equal(outOfRange.calibrationStatus, 'OUT_OF_CALIBRATION_RANGE');
  const exhausted = projectPolicy({ ...dataset.cases[0], withdrawalStartAge: 41, endAge: 41, withdrawalSchedule: [{ age: 41, withdrawal: 999999999 }] }, model);
  assert.equal(exhausted.status, 'INSUFFICIENT_RESERVE');
  assert.ok(exhausted.firstShortfallAge);
  const input = { ...dataset.cases[0], withdrawalStartAge: 61, endAge: 70 };
  assert.deepEqual(projectPolicy(input, model), projectPolicy(input, model));
});

test('proposal-supported first-withdrawal anchors remain exact in frozen holdouts', () => {
  for (const id of ['45yrs_5pay_130k_avf_55', '45yrs_5pay_130k_avpu_55yr', '5pay_avpu_200k', '50yrs_5pay_130k_avpu', '70k_original']) {
    const item = dataset.cases.find(c => c.caseId === id);
    const actual = item.rows.find(r => r.withdrawal > 0);
    const predicted = projectPolicy({ ...item, endAge: actual.age }, model).rows.at(-1);
    assert.ok(Math.abs(predicted.projectedRemainingSurrenderValue - actual.projectedRemainingSurrenderValue) <= 1, id);
  }
});

test('affected zero-withdrawal continuation does not reset to unaffected base', () => {
  const item = dataset.cases.find(c => c.caseId === '45yrs_5pay_130k_avf');
  const withdrawalSchedule = item.withdrawalSchedule.map(r => r.age === 62 ? { ...r, withdrawal: 0, withdrawalFromGuaranteedCashValue: 0, withdrawalFromReversionaryBonus: 0, withdrawalFromTerminalDividend: 0 } : r);
  const row = projectPolicy({ ...item, withdrawalSchedule, endAge: 62 }, model).rows.at(-1);
  assert.notEqual(row.projectedRemainingSurrenderValue, Math.round(model.baseAt(row.policyYear, item.initialBasicAmount).total));
  // A state regression check, not genuine-proposal certification of pause/resume accuracy.
});

test('v4 predictions reproduce the frozen best holdout metrics', () => {
  const errors = [], dollars = [];
  for (const item of dataset.cases.filter(c => c.role === 'holdout')) {
    const predicted = new Map(projectPolicy(item, model).rows.map(r => [r.age, r]));
    for (const row of item.rows) {
      const dollar = Math.abs(predicted.get(row.age).projectedRemainingSurrenderValue - row.projectedRemainingSurrenderValue);
      dollars.push(dollar); errors.push(dollar / row.projectedRemainingSurrenderValue * 100);
    }
  }
  assert.equal(Number((errors.reduce((a,b)=>a+b,0)/errors.length).toFixed(8)), 2.29650947);
  assert.equal(Number(Math.max(...errors).toFixed(8)), 11.80075621);
  assert.equal(errors.filter(e => e > .10).length, 247);
  assert.equal(Math.max(...dollars), 457617);
});
