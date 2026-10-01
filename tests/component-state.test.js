import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildComponentStateModel, advanceComponentState, projectComponentState } from '../research/ipos/component-state.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../research/ipos/' + name, import.meta.url), 'utf8'));
const dataset = read('fixtures/dataset.json'), evidence = read('evidence-gap-matrix.json');
const model = buildComponentStateModel(dataset.cases, evidence);
const calibration = dataset.cases.filter(c => c.role === 'calibration');

test('holdout/regression/unassigned targets cannot change component calibration', () => {
  const poisonedCases = structuredClone(dataset.cases);
  for (const c of poisonedCases.filter(c => c.role !== 'calibration')) {
    c.rows = [{ arbitrary: 'POISON' }]; c.baseCurve = []; c.initialBasicAmount = -999;
  }
  const poisonedEvidence = structuredClone(evidence);
  for (const s of poisonedEvidence.sourceRecords.filter(s => s.frozenRole !== 'calibration')) {
    s.baseRows = []; s.postRows = []; s.allocationRows = []; s.metadata = null;
  }
  const other = buildComponentStateModel(poisonedCases, poisonedEvidence);
  assert.equal(other.rbPersistence, model.rbPersistence);
  assert.deepEqual(other.terminalTransitions, model.terminalTransitions);
  assert.deepEqual(other.reductionCoefficients, model.reductionCoefficients);
  assert.deepEqual(other.fitRows, model.fitRows);
  for (const py of [1, 11, 17, 22, 55]) assert.deepEqual(other.baseAt(py, 1323829), model.baseAt(py, 1323829));
});

test('RB withdrawal persists independently while GCV and Basic Amount stay intact', () => {
  const basic = calibration[0].initialBasicAmount;
  const base = model.baseAt(10, basic), allocation = { fromGCV: 0, fromRB: 10000, fromTD: 4000 };
  const first = advanceComponentState(null, base, allocation, model, { policyYear: 10, initialBasicAmount: basic, timeSince: 20, firstWithdrawalSeen: false });
  assert.equal(first.gcvState, base.guaranteedCashValue);
  assert.equal(first.basicAmountState, basic);
  assert.equal(first.rbState, base.reversionaryBonusCashValue - 10000);
  assert.equal(first.tdState, base.terminalDividendCashValue - 4000);
  const nextBase = model.baseAt(11, basic);
  const next = advanceComponentState(first, nextBase, { fromGCV: 0, fromRB: 0, fromTD: 0 }, model,
    { policyYear: 11, initialBasicAmount: basic, timeSince: 1, firstWithdrawalSeen: true });
  assert.equal(next.gcvState, nextBase.guaranteedCashValue);
  assert.equal(next.basicAmountState, basic);
  assert.ok(Math.abs(next.rbState - (nextBase.reversionaryBonusCashValue - 10000 * model.rbPersistence)) < 1e-6);
  assert.notEqual(next.tdState, nextBase.terminalDividendCashValue);
});

test('genuine GCV tap is the only trigger for Basic Amount reduction', () => {
  const basic = calibration[0].initialBasicAmount, base = model.baseAt(17, basic);
  const allocation = { fromGCV: 1000, fromRB: 0, fromTD: 0 };
  const state = advanceComponentState(null, base, allocation, model, { policyYear: 17, initialBasicAmount: basic, timeSince: 20, firstWithdrawalSeen: false });
  assert.equal(state.gcvState, base.guaranteedCashValue - 1000);
  assert.equal(state.basicAmountState, basic - model.reductionCoefficients.middle * 1000 / (base.guaranteedCashValue / basic));
});

test('first withdrawal preserves total and component accounting on calibration inputs', () => {
  for (const c of calibration) {
    const first = c.rows.find(r => r.withdrawal > 0 && r.withdrawalType === 'medicalWithdrawal');
    const p = projectComponentState({ ...c, endAge: first.age }, model).rows.at(-1);
    assert.ok(Math.abs(p.total - (p.noWithdrawalBaseValue - p.withdrawal)) <= 1);
    assert.ok(Math.abs(p.total - p.GCV - p.RB - p.TD) <= 1);
  }
});

test('rejected checkpoint records component failure without replacing v4', () => {
  const r = read('component-state-research.json');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(r.modelLock)).digest('hex'), r.modelLockSHA256);
  assert.equal(r.modelLock.rbPersistence, model.rbPersistence);
  assert.deepEqual(r.modelLock.terminalTransitions, model.terminalTransitions);
  assert.deepEqual(r.modelLock.reductionCoefficients, model.reductionCoefficients);
  assert.equal(r.iteration, 1);
  assert.equal(r.holdoutEvaluationCount, 1);
  assert.equal(r.firstWithdrawalGate, 'PASS');
  assert.equal(r.fiveRowComponentGate, 'FAIL');
  assert.equal(r.zeroWithdrawalPersistence, 'PASS');
  assert.equal(r.decision, 'ITERATION_1_REJECTED');
  assert.equal(r.retainedEngine, 'ipos-approximation-terminal-dividend-transition-v4');
  assert.equal(r.productionActivated, false);
});
