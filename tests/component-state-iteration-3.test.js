import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildIteration3Model, advanceIteration3State } from '../research/ipos/component-state-iteration-3.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../research/ipos/' + name, import.meta.url), 'utf8'));
const dataset = read('fixtures/dataset.json');
const evidence = read('evidence-gap-matrix.json');
const model = buildIteration3Model(dataset.cases, evidence);

test('Iteration 3 construction excludes every non-calibration source and target', () => {
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
  const other = buildIteration3Model(poisonedCases, poisonedEvidence);
  assert.equal(other.rbPersistence, model.rbPersistence);
  assert.equal(other.tdTransition, model.tdTransition);
  assert.equal(other.tdFreeParameters, 0);
  assert.deepEqual(other.tdTransitionRows, model.tdTransitionRows);
  assert.deepEqual(other.reductionCoefficients, model.reductionCoefficients);
});

test('Iteration 1 RB is restored while TD uses only carried state plus annual increment', () => {
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
  const state = advanceIteration3State(previous, base, allocation, model, {
    policyYear: 11, initialBasicAmount, firstWithdrawalSeen: true
  });
  const expectedRB = base.reversionaryBonusCashValue - 10000 * model.rbPersistence - allocation.fromRB;
  const expectedTDAccrual = base.terminalDividendCashValue - previousBase.terminalDividendCashValue;
  assert.ok(Math.abs(state.rbState - expectedRB) < 1e-6);
  assert.equal(state.tdAccrual, expectedTDAccrual);
  assert.equal(state.tdState, previous.tdState + expectedTDAccrual - allocation.fromTD);
  assert.equal(state.gcvState, base.guaranteedCashValue);
  assert.equal(state.basicAmountState, initialBasicAmount);
});

test('saved final Phase A checkpoint is locked, bounded and rejected without replacing v4', () => {
  const lock = read('component-state-iteration-3-lock.json');
  const report = read('component-state-iteration-3-research.json');
  const hash = crypto.createHash('sha256').update(JSON.stringify(lock.modelLock)).digest('hex');
  assert.equal(hash, lock.modelLockSHA256);
  assert.equal(hash, report.modelLockSHA256);
  assert.equal(lock.holdoutEvaluated, false);
  assert.equal(report.holdoutEvaluated, true);
  assert.equal(report.holdoutEvaluationCount, 1);
  assert.equal(report.finalPhaseAIteration, true);
  assert.equal(report.firstWithdrawalGate, 'PASS');
  assert.equal(report.fiveRowComponentGate, 'FAIL');
  assert.equal(report.zeroWithdrawalPersistence, 'PASS');
  assert.equal(report.leakage, 'PASS');
  assert.equal(report.decision, 'ITERATION_3_REJECTED');
  assert.equal(report.retainedEngine, 'ipos-approximation-terminal-dividend-transition-v4');
  assert.equal(report.productionActivated, false);
});
