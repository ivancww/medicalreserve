import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildIteration2Model, advanceIteration2State } from '../research/ipos/component-state-iteration-2.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../research/ipos/' + name, import.meta.url), 'utf8'));
const dataset = read('fixtures/dataset.json');
const evidence = read('evidence-gap-matrix.json');
const model = buildIteration2Model(dataset.cases, evidence);

test('Iteration 2 calibration is isolated from every non-calibration source and target', () => {
  const poisonedCases = structuredClone(dataset.cases);
  for (const item of poisonedCases.filter(item => item.role !== 'calibration')) {
    item.rows = [{ poisoned: true }];
    item.baseCurve = [];
    item.initialBasicAmount = -1;
  }
  const poisonedEvidence = structuredClone(evidence);
  for (const source of poisonedEvidence.sourceRecords.filter(source => source.frozenRole !== 'calibration')) {
    source.baseRows = [];
    source.postRows = [];
    source.allocationRows = [];
    source.metadata = null;
  }
  const other = buildIteration2Model(poisonedCases, poisonedEvidence);
  assert.equal(other.rbTransition, model.rbTransition);
  assert.deepEqual(other.rbTransitionRows, model.rbTransitionRows);
  assert.deepEqual(other.terminalTransitions, model.terminalTransitions);
  assert.deepEqual(other.reductionCoefficients, model.reductionCoefficients);
});

test('RB advances from carried state by the annual curve increment', () => {
  const initialBasicAmount = dataset.cases.find(item => item.role === 'calibration').initialBasicAmount;
  const previousBase = model.baseAt(10, initialBasicAmount);
  const previous = {
    basicAmountState: initialBasicAmount,
    rbState: previousBase.reversionaryBonusCashValue - 10000,
    tdState: previousBase.terminalDividendCashValue - 4000,
    basicBefore: initialBasicAmount,
    base: previousBase,
    allocation: { fromGCV: 0, fromRB: 10000, fromTD: 4000 }
  };
  const base = model.baseAt(11, initialBasicAmount);
  const allocation = { fromGCV: 0, fromRB: 2500, fromTD: 1000 };
  const state = advanceIteration2State(previous, base, allocation, model, {
    policyYear: 11, initialBasicAmount, timeSince: 1, firstWithdrawalSeen: true
  });
  const expectedAccrual = base.reversionaryBonusCashValue - previousBase.reversionaryBonusCashValue;
  assert.equal(state.rbAccrual, expectedAccrual);
  assert.equal(state.rbState, previous.rbState + expectedAccrual - allocation.fromRB);
  assert.equal(state.gcvState, base.guaranteedCashValue);
  assert.equal(state.basicAmountState, initialBasicAmount);
});

test('saved Iteration 2 checkpoint is locked, bounded and rejected without replacing v4', () => {
  const lock = read('component-state-iteration-2-lock.json');
  const report = read('component-state-iteration-2-research.json');
  const hash = crypto.createHash('sha256').update(JSON.stringify(lock.modelLock)).digest('hex');
  assert.equal(hash, lock.modelLockSHA256);
  assert.equal(hash, report.modelLockSHA256);
  assert.equal(lock.holdoutEvaluated, false);
  assert.equal(report.holdoutEvaluated, true);
  assert.equal(report.holdoutEvaluationCount, 1);
  assert.equal(report.iteration, 2);
  assert.equal(report.firstWithdrawalGate, 'PASS');
  assert.equal(report.fiveRowComponentGate, 'FAIL');
  assert.equal(report.zeroWithdrawalPersistence, 'PASS');
  assert.equal(report.leakage, 'PASS');
  assert.equal(report.decision, 'ITERATION_2_REJECTED');
  assert.equal(report.retainedEngine, 'ipos-approximation-terminal-dividend-transition-v4');
  assert.equal(report.productionActivated, false);
});
