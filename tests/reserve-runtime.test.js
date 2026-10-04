import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticAccumulation, validateLayer2Data } from '../reserve-runtime.js';

const rows = [1, 2, 3, 4, 5].flatMap(policy_year => [100000, 130000].map(annual_contribution => ({
  medical_plan_id: 'flexible_m', annual_contribution, issue_age: 40, policy_year, base_value: annual_contribution * policy_year, enabled: true
})));
const data = { dataset_id: 'SavingPlanReturns', data_version: 1, product_id: 'aia_hk_5pay', currency: 'HKD', pay_term_years: 5, rows };

test('Layer 2 validation preserves supported contribution bounds', () => {
  assert.equal(validateLayer2Data(data).rows.length, 10);
  assert.throws(() => validateLayer2Data({ ...data, rows: [{ ...rows[0], annual_contribution: 200001 }] }), /超出支援範圍/);
});

test('automatic accumulation is an independent scenario with fixed phase contributions', () => {
  const result = automaticAccumulation({ rows, currentAge: 40, supportStartAge: 41, supportEndAge: 45, arrangement: 5, phaseContributions: { phase1: 100000, phase2: 130000, phase3: 150000 }, medicalPlanId: 'flexible_m' });
  assert.equal(result.length, 5);
  assert.equal(result[0].value, 100000);
  assert.equal(result.at(-1).value, 500000);
});
