import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transitionDataset, fitTD, candidateNames } from '../research/ipos/td-transition.js';
import { buildCalibrationModel, projectPolicy } from '../research/ipos/engine.js';
const dataset=JSON.parse(fs.readFileSync(new URL('../research/ipos/fixtures/dataset.json',import.meta.url)));

test('TD fitting excludes interpolated bases, capital reduction and frozen holdouts',()=>{
  const pairs=transitionDataset(dataset.cases);
  assert.equal(pairs.length,206);
  assert.equal(pairs.filter(r=>r.eligibleForFit).length,27);
  for(const r of pairs.filter(r=>r.eligibleForFit)) {
    assert.equal(dataset.cases.find(c=>c.caseId===r.caseId).role,'calibration');
    assert.ok(r.t.baseSources.length&&r.next.baseSources.length);
    assert.equal(r.t.basicAmount,r.initialBasicAmount);
    assert.equal(r.next.basicAmount,r.initialBasicAmount);
    assert.equal(r.t.withdrawalFromGCV+r.next.withdrawalFromGCV,0);
  }
});

test('mutating holdout targets and components cannot alter TD coefficients or blind projections',()=>{
  const mutated=structuredClone(dataset);
  for(const c of mutated.cases.filter(c=>c.role==='holdout')) {
    c.initialBasicAmount *= 3;
    c.baseCurve.forEach(r=>{r.terminalDividendCashValue*=10;});
    c.rows.forEach(r=>{r.projectedRemainingSurrenderValue*=10;r.terminalDividendCashValue*=10;r.basicAmountAfterWithdrawal*=10;});
  }
  const before=transitionDataset(dataset.cases),after=transitionDataset(mutated.cases);
  assert.deepEqual(after,before);
  for(const name of candidateNames)assert.deepEqual(fitTD(after,name),fitTD(before,name));
  const input=dataset.cases.find(c=>c.role==='holdout');
  assert.deepEqual(projectPolicy(input,buildCalibrationModel(dataset.cases)),projectPolicy(input,buildCalibrationModel(mutated.cases)));
});
