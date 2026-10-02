import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EVIDENCE, ENGINE_VERSION, resolveBasicAmount, routeSupportPhase, runOriginalIntentForward
} from '../research/ipos/original-intent-forward.js';

const dataset = JSON.parse(fs.readFileSync(new URL('../research/ipos/fixtures/dataset.json', import.meta.url), 'utf8'));
const phases = (...values) => values.map((annualContribution, index) => ({ id: `phase${index + 1}`, enabled: true, annualContribution }));
const premiums = (start, end, value = age => age * 100) => Array.from({ length: end - start + 1 }, (_, index) => ({ age: start + index, annualPremium: value(start + index) }));

test('five-year rotating routing is deterministic for one, two and three phases', () => {
  for (let age = 65; age <= 94; age += 1) assert.equal(routeSupportPhase({ attainedAge: age, supportStartAge: 65, enabledPhaseIds: ['phase1'] }), 'phase1');
  assert.deepEqual(premiums(65, 94).map(row => routeSupportPhase({ attainedAge: row.age, supportStartAge: 65, enabledPhaseIds: ['phase1', 'phase2'] })),
    Array(5).fill('phase1').concat(Array(5).fill('phase2'), Array(5).fill('phase1'), Array(5).fill('phase2'), Array(5).fill('phase1'), Array(5).fill('phase2')));
  assert.deepEqual(premiums(65, 94).map(row => routeSupportPhase({ attainedAge: row.age, supportStartAge: 65, enabledPhaseIds: ['phase1', 'phase2', 'phase3'] })),
    Array(5).fill('phase1').concat(Array(5).fill('phase2'), Array(5).fill('phase3'), Array(5).fill('phase1'), Array(5).fill('phase2'), Array(5).fill('phase3')));
});

test('routing starts from the selected support age and handles an end inside a window', () => {
  assert.deepEqual(premiums(58, 64).map(row => routeSupportPhase({ attainedAge: row.age, supportStartAge: 58, enabledPhaseIds: ['phase1', 'phase2'] })),
    ['phase1', 'phase1', 'phase1', 'phase1', 'phase1', 'phase2', 'phase2']);
});

test('Phase 3 requires Phase 2', () => {
  assert.throws(() => runOriginalIntentForward({ currentAge: 40, supportStartAge: 65, supportEndAge: 65, planId: 'prestige_16000',
    phases: [{ id: 'phase1', enabled: true, annualContribution: 130000 }, { id: 'phase2', enabled: false, annualContribution: 0 }, { id: 'phase3', enabled: true, annualContribution: 130000 }],
    medicalPremiumSchedule: premiums(65, 65) }, dataset), error => error.code === 'PHASE_3_REQUIRES_PHASE_2');
});

test('exact anchors, supported interpolation and unsupported range are explicit', () => {
  assert.deepEqual(resolveBasicAmount(130000), { status: EVIDENCE.DIRECT, BasicAmount: 1323829 });
  assert.equal(resolveBasicAmount(140000).status, EVIDENCE.INTERPOLATED);
  assert.equal(resolveBasicAmount(39999).status, EVIDENCE.OUT_OF_RANGE);
  assert.equal(resolveBasicAmount(200001).status, EVIDENCE.OUT_OF_RANGE);
});

test('first support uses the verified no-withdrawal minus support identity', () => {
  const genuine = dataset.cases.find(item => item.caseId === '45yrs_5pay_130k_avpu_55yr');
  const result = runOriginalIntentForward({ currentAge: 45, supportStartAge: 55, supportEndAge: 55, planId: 'prestige_16000',
    phases: phases(130000), medicalPremiumSchedule: [{ age: 55, annualPremium: 19128 }] }, dataset);
  assert.equal(result.schedule[0].phase1RemainingValue, genuine.rows.find(row => row.age === 55).projectedRemainingSurrenderValue);
  assert.equal(result.schedule[0].phaseEvidence[0].firstSupportIdentity, true);
});

test('repeated support reuses an exact genuine annual path', () => {
  const genuine = dataset.cases.find(item => item.caseId === '45yrs_5pay_130k_avf');
  const medicalPremiumSchedule = genuine.withdrawalSchedule.filter(row => row.age >= 61 && row.age <= 62).map(row => ({ age: row.age, annualPremium: row.withdrawal }));
  const result = runOriginalIntentForward({ currentAge: 45, supportStartAge: 61, supportEndAge: 62, planId: 'flexible_m', phases: phases(130000), medicalPremiumSchedule }, dataset);
  assert.equal(result.schedule.at(-1).phase1RemainingValue, genuine.rows.find(row => row.age === 62).projectedRemainingSurrenderValue);
  assert.equal(result.schedule.at(-1).evidenceStatus, EVIDENCE.DIRECT);
});

test('between-anchor repeated genuine paths are explicitly interpolated', () => {
  const source = dataset.cases.find(item => item.caseId === '5pay_avf_150k');
  const medicalPremiumSchedule = source.withdrawalSchedule.filter(row => row.age >= 61 && row.age <= 62).map(row => ({ age: row.age, annualPremium: row.withdrawal }));
  const result = runOriginalIntentForward({ currentAge: 45, supportStartAge: 61, supportEndAge: 62, planId: 'flexible_m', phases: phases(150000), medicalPremiumSchedule }, dataset);
  assert.equal(result.schedule.at(-1).evidenceStatus, EVIDENCE.INTERPOLATED);
  assert.ok(result.schedule.at(-1).phaseEvidence[0].sourceCaseIds.every(id => dataset.cases.find(item => item.caseId === id).role !== 'holdout'));
});

test('different phase contributions stay independent and combined value is their sum', () => {
  const result = runOriginalIntentForward({ currentAge: 40, supportStartAge: 61, supportEndAge: 61, planId: 'flexible_m',
    phases: phases(130000, 180000, 130000), medicalPremiumSchedule: [{ age: 61, annualPremium: 17745 }] }, dataset);
  const row = result.schedule[0];
  assert.equal(row.activeSupportPhase, 'phase1');
  assert.ok(row.phase1RemainingValue > 0 && row.phase2RemainingValue > 0 && row.phase3RemainingValue > 0);
  assert.equal(row.combinedRemainingMedicalReserveValue, row.phase1RemainingValue + row.phase2RemainingValue + row.phase3RemainingValue);
  assert.deepEqual(result.phases.map(phase => phase.annualContribution), [130000, 180000, 130000]);
});

test('cumulative support uses Official premiums and missing data fails safely', () => {
  const result = runOriginalIntentForward({ currentAge: 45, supportStartAge: 61, supportEndAge: 62, planId: 'flexible_m',
    phases: phases(130000), medicalPremiumSchedule: [{ age: 61, annualPremium: 17745.6 }, { age: 62, annualPremium: 18776.8 }] }, dataset);
  assert.ok(Math.abs(result.cumulativeMedicalReserveSupport - 36522.4) < 1e-9);
  assert.equal(result.schedule[0].medicalReserveSupport, 17745);
  assert.throws(() => runOriginalIntentForward({ currentAge: 45, supportStartAge: 61, supportEndAge: 62, planId: 'flexible_m',
    phases: phases(130000), medicalPremiumSchedule: [{ age: 61, annualPremium: 17745.6 }] }, dataset), error => error.code === 'OFFICIAL_PREMIUM_AGE_MISSING');
  assert.throws(() => runOriginalIntentForward({ currentAge: 45, supportStartAge: 61, supportEndAge: 61, planId: '',
    phases: phases(130000), medicalPremiumSchedule: premiums(61, 61) }, dataset), error => error.code === 'MISSING_PLAN_ID');
});

test('research Forward engine is not activated by production', () => {
  assert.equal(ENGINE_VERSION, 'ipos-original-intent-genuine-path-forward-v1');
  assert.doesNotMatch(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), /original-intent-forward/);
});
