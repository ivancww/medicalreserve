import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildCustomerTotalValueModel, projectTotalValueCase, serializableModelLock } from '../research/ipos/customer-total-value-engine.js';
import { buildFivePayPortfolio, runForwardMedicalReserve, solveRequiredContribution } from '../research/ipos/customer-ab-calculation.js';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const dataset = read('../research/ipos/fixtures/dataset.json');
const evidence = read('../research/ipos/evidence-gap-matrix.json');
const model = buildCustomerTotalValueModel(dataset.cases, evidence);
const fixture = dataset.cases.find(item => item.caseId === '50yrs_5pay_180k_avpu');
const genuineSchedule = fixture.withdrawalSchedule.filter(row => row.age >= 61 && row.age <= 90)
  .map(row => ({ age: row.age, annualPremium: row.withdrawal, source: 'GENUINE_AIA_SUPPORT_WITHDRAWAL_VALIDATION_ONLY' }));

test('model is calibration-only and parameter-free', () => {
  assert.equal(model.engineVersion, 'ipos-customer-total-value-carried-ratio-v1');
  assert.ok(model.calibrationCaseIds.every(id => dataset.cases.find(item => item.caseId === id).role === 'calibration'));
  assert.equal(model.calibrationSourceIds.length, 14);
});

test('holdout targets and schedules cannot alter the locked customer model', () => {
  const mutated = structuredClone(dataset);
  for (const item of mutated.cases.filter(value => value.role === 'holdout')) {
    for (const row of item.rows) row.projectedRemainingSurrenderValue += 999999999;
    for (const row of item.withdrawalSchedule) row.withdrawal += 999999999;
  }
  assert.deepEqual(serializableModelLock(buildCustomerTotalValueModel(mutated.cases, evidence)), serializableModelLock(model));
  const saved = read('../research/ipos/customer-total-value-lock.json');
  const digest = crypto.createHash('sha256').update(JSON.stringify(serializableModelLock(model))).digest('hex');
  assert.equal(digest, saved.modelLockSHA256);
});

test('saved checkpoint records exactly one post-lock holdout evaluation', () => {
  const report = read('../research/ipos/customer-total-value-engine.json');
  assert.equal(report.frozenHoldoutEvaluationCount, 1);
  assert.equal(report.leakage, 'PASS');
  assert.equal(report.holdout.annualRows, 325);
});

test('first withdrawal is exactly base total minus support', () => {
  const first = fixture.rows.find(row => row.withdrawal > 0);
  const projected = projectTotalValueCase({ ...fixture, endAge: first.age }, model).rows.at(-1);
  assert.ok(Math.abs(projected.remainingSurrenderValue - (projected.noWithdrawalTotal - first.withdrawal)) < 1e-7);
});

test('zero withdrawal preserves the affected total-state ratio', () => {
  const schedule = fixture.withdrawalSchedule.map(row => row.age === 62 ? { ...row, withdrawal: 0 } : row);
  const rows = projectTotalValueCase({ ...fixture, withdrawalSchedule: schedule, endAge: 62 }, model).rows;
  const previous = rows.find(row => row.age === 61), current = rows.find(row => row.age === 62);
  assert.ok(Math.abs(previous.remainingSurrenderValue / previous.noWithdrawalTotal - current.remainingSurrenderValue / current.noWithdrawalTotal) < 1e-10);
});

test('5/10/15-year structures are independent sequential 5Pay policies', () => {
  assert.deepEqual(buildFivePayPortfolio({ currentAge: 50, annualSavingContribution: 130000, savingDuration: 5 }, model).map(p => p.issueAge), [50]);
  assert.deepEqual(buildFivePayPortfolio({ currentAge: 50, annualSavingContribution: 130000, savingDuration: 10 }, model).map(p => p.issueAge), [50, 55]);
  assert.deepEqual(buildFivePayPortfolio({ currentAge: 50, annualSavingContribution: 130000, savingDuration: 15 }, model).map(p => p.issueAge), [50, 55, 60]);
});

test('forward uses inclusive support ages and precise shortfall semantics', () => {
  const result = runForwardMedicalReserve({ currentAge: 50, savingDuration: 5, annualSavingContribution: 70000,
    supportStartAge: 61, endAge: 90, medicalPremiumSchedule: genuineSchedule }, model);
  assert.equal(result.schedule.length, 30);
  assert.equal(result.schedule[0].age, 61);
  assert.equal(result.schedule.at(-1).age, 90);
  if (result.firstShortfallAge != null) {
    assert.equal(result.schedule.find(row => !row.fullySupported).age, result.firstShortfallAge);
    assert.ok(result.shortfallAmount > 0);
  }
});

test('forward rejects a missing official premium year and out-of-range contribution is labelled', () => {
  assert.throws(() => runForwardMedicalReserve({ currentAge: 50, savingDuration: 5, annualSavingContribution: 130000,
    supportStartAge: 61, endAge: 90, medicalPremiumSchedule: genuineSchedule.slice(1) }, model), /Missing official medical premium/);
  const result = runForwardMedicalReserve({ currentAge: 50, savingDuration: 5, annualSavingContribution: 250000,
    supportStartAge: 61, endAge: 90, medicalPremiumSchedule: genuineSchedule }, model);
  assert.equal(result.calibrationStatus, 'OUT_OF_CALIBRATION_RANGE_ABOVE');
  const below = runForwardMedicalReserve({ currentAge: 50, savingDuration: 5, annualSavingContribution: 40000,
    supportStartAge: 61, endAge: 90, medicalPremiumSchedule: genuineSchedule }, model);
  assert.equal(below.calibrationStatus, 'OUT_OF_CALIBRATION_RANGE_BELOW');
});

test('forward support and remaining value are monotonic at evidence anchors', () => {
  const results = model.baseCurvePremiums.map(x => runForwardMedicalReserve({ currentAge: 50, savingDuration: 5,
    annualSavingContribution: x, supportStartAge: 61, endAge: 90, medicalPremiumSchedule: genuineSchedule }, model));
  for (let index = 1; index < results.length; index += 1) {
    assert.ok(results[index].totalMedicalPremiumSupported >= results[index - 1].totalMedicalPremiumSupported);
    assert.ok(results[index].finalRemainingSurrenderValue >= results[index - 1].finalRemainingSurrenderValue);
  }
});

test('reverse uses forward and enforces A/B consistency when solution is in range', () => {
  const targetRemainingValue = fixture.rows.find(row => row.age === 90).projectedRemainingSurrenderValue;
  const result = solveRequiredContribution({ currentAge: 50, savingDuration: 5, supportStartAge: 61,
    targetSupportAge: 90, targetRemainingValue, medicalPremiumSchedule: genuineSchedule, solverTolerance: 100 }, model);
  assert.equal(result.feasible, true);
  assert.equal(result.abConsistency, 'PASS');
  assert.equal(result.forward.lastFullySupportedAge, 90);
  assert.equal(result.lowerContributionCheck.succeeds, false);
});

test('reserve exhaustion and exact target-age boundary are explicit', () => {
  const huge = genuineSchedule.map(row => ({ ...row, annualPremium: 999999999 }));
  const result = runForwardMedicalReserve({ currentAge: 50, savingDuration: 5, annualSavingContribution: 40000,
    supportStartAge: 61, endAge: 61, medicalPremiumSchedule: huge.filter(row => row.age === 61) }, model);
  assert.equal(result.schedule.length, 1);
  assert.equal(result.lastFullySupportedAge, null);
  assert.equal(result.firstShortfallAge, 61);
  assert.ok(result.shortfallAmount > 0);
});
