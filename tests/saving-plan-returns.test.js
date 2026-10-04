import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EVIDENCE,
  hydrateForwardDataset,
  resolveOfficialBaseState,
  runForwardWithOfficialReturns,
  validateSavingPlanReturnsResponse,
  contributionEvidence
} from '../saving-plan-returns.js';

const dataset = JSON.parse(fs.readFileSync(new URL('../research/ipos/fixtures/dataset.json', import.meta.url), 'utf8'));
const phases = (...values) => values.map((annualContribution, index) => ({ id: `phase${index + 1}`, enabled: true, annualContribution }));

function responseFromDataset() {
  const rows = [];
  dataset.cases.forEach(item => {
    const medicalPlanId = item.caseId.includes('avpu') ? 'prestige_16000' : item.caseId.includes('original') ? 'select_18000' : 'flexible_m';
    const evidenceClass = item.role === 'holdout' ? 'HOLDOUT_REFERENCE' : 'DIRECT';
    item.baseCurve.forEach(base => rows.push({
      return_data_id: `saving-return-v1:${item.caseId}:py${base.policyYear}`,
      dataset_id: 'SavingPlanReturns', data_version: 1, product_id: 'aia_hk_5pay', medical_plan_id: medicalPlanId,
      currency: 'HKD', pay_term_years: 5, annual_contribution: item.annualPremium, issue_age: item.issueAge, policy_year: base.policyYear,
      base_value: base.projectedRemainingSurrenderValue, basic_amount: item.initialBasicAmount,
      guaranteed_cash_value: base.guaranteedCashValue, reversionary_bonus_cash_value: base.reversionaryBonusCashValue,
      terminal_dividend_cash_value: base.terminalDividendCashValue, source_case_id: item.caseId, evidence_class: evidenceClass, enabled: true
    }));
  });
  return { ok: true, data: { dataset_id: 'SavingPlanReturns', data_version: 1, product_id: 'aia_hk_5pay', currency: 'HKD', pay_term_years: 5, rows } };
}

const official = responseFromDataset();
const premium = (start, end, value = age => age * 100) => Array.from({ length: end - start + 1 }, (_, index) => ({ age: start + index, annualPremium: value(start + index) }));

test('Layer 2 response validates the official product, HKD, 5Pay and direct anchors', () => {
  const result = validateSavingPlanReturnsResponse(official, { expectedVersion: 1 });
  assert.equal(result.rows.length, 314);
  assert.equal(contributionEvidence(40000), EVIDENCE.DIRECT);
  assert.equal(contributionEvidence(50000), EVIDENCE.INTERPOLATED);
  assert.equal(contributionEvidence(200001), EVIDENCE.OUT_OF_RANGE);
});

test('adapter resolves direct and existing accepted interpolation policy at pre-support state', () => {
  const direct = resolveOfficialBaseState(official, { currentAge: 45, phaseId: 'phase1', attainedAge: 50, annualContribution: 130000, medicalPlanId: 'flexible_m' });
  assert.equal(direct.status, EVIDENCE.DIRECT);
  assert.equal(direct.state.base_value, dataset.cases.find(item => item.caseId === '45yrs_5pay_130k_avf').baseCurve.find(row => row.policyYear === 5).projectedRemainingSurrenderValue);
  const interpolated = resolveOfficialBaseState(official, { currentAge: 40, phaseId: 'phase1', attainedAge: 45, annualContribution: 50000, medicalPlanId: 'flexible_m' });
  assert.equal(interpolated.status, EVIDENCE.INTERPOLATED);
  assert.deepEqual(interpolated.sourceCaseIds, ['40k_base', '40yrs_5pay_130k_avf']);
  [50000, 80000, 120000].forEach(contribution => assert.equal(resolveOfficialBaseState(official, { currentAge: 40, phaseId: 'phase1', attainedAge: 45, annualContribution: contribution, medicalPlanId: 'flexible_m' }).status, EVIDENCE.INTERPOLATED));
  assert.equal(resolveOfficialBaseState(official, { currentAge: 45, phaseId: 'phase1', attainedAge: 50, annualContribution: 150000, medicalPlanId: 'flexible_m' }).status, EVIDENCE.DIRECT);
  assert.throws(() => validateSavingPlanReturnsResponse({ ...official, data: { ...official.data, data_version: 2 } }, { expectedVersion: 1 }), error => error.code === 'SAVING_RETURN_VERSION_MISMATCH');
});

test('Layer 2 hydration preserves accepted Forward results for P1, P1+P2, P1+P2+P3 and mixed contributions', () => {
  const hydrated = hydrateForwardDataset(official, dataset);
  const cases = [
    phases(130000),
    phases(130000, 180000),
    phases(130000, 180000, 130000),
    phases(130000, 180000, 130000)
  ];
  const starts = [55, 55, 55, 55];
  cases.forEach((phaseSet, index) => {
    const input = { currentAge: 40, supportStartAge: starts[index], supportEndAge: starts[index], planId: 'flexible_m', phases: phaseSet, medicalPremiumSchedule: [{ age: starts[index], annualPremium: 19128 }] };
    const expected = runForwardWithOfficialReturns(input, { ...official, data: { ...official.data, rows: official.data.rows } }, dataset);
    const actual = runForwardWithOfficialReturns(input, official, hydrated);
    assert.equal(actual.schedule[0].activeSupportPhase, 'phase1');
    assert.equal(actual.schedule[0].phase1RemainingValue, expected.schedule[0].phase1RemainingValue);
    assert.equal(actual.schedule[0].combinedRemainingMedicalReserveValue, expected.schedule[0].combinedRemainingMedicalReserveValue);
  });
});

test('adapter fails safely when official rows are incomplete or unsupported', () => {
  const incomplete = { ...official, data: { ...official.data, rows: official.data.rows.slice(0, 1) } };
  assert.equal(resolveOfficialBaseState(incomplete, { currentAge: 45, attainedAge: 50, annualContribution: 130000, medicalPlanId: 'flexible_m' }).status, EVIDENCE.OUT_OF_RANGE);
  const unsupported = { ...official, data: { ...official.data, rows: official.data.rows.map(row => ({ ...row, annual_contribution: 250000 })) } };
  assert.throws(() => validateSavingPlanReturnsResponse(unsupported), error => error.code === 'SAVING_RETURN_CONTRIBUTION_OUT_OF_RANGE');
});

test('Layer 2 Forward wrapper preserves the locked five-year routing result', () => {
  const result = runForwardWithOfficialReturns({ currentAge: 40, supportStartAge: 55, supportEndAge: 65, planId: 'flexible_m', phases: phases(130000, 180000, 130000), medicalPremiumSchedule: premium(55, 65) }, official, dataset);
  assert.deepEqual(result.schedule.slice(0, 10).map(row => row.activeSupportPhase), Array(5).fill('phase1').concat(Array(5).fill('phase2')));
  assert.equal(result.phases[1].annualContribution, 180000);
});
