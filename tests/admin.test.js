import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAdminRows } from '../domain.js';

const flow = ['funding','timeline','coverage','plan','journey','total','transition','strategy','support','summary'].map((id, sort_order) => ({ id, title: id, enabled: true, sort_order }));

test('Admin validation protects required AppFlow IDs', () => {
  const result = validateAdminRows('AppFlow', flow.filter(row => row.id !== 'summary'), { requiredFlowIds: flow.map(row => row.id) });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /summary/);
});

test('Admin validation rejects invalid MedicalPlans mapping', () => {
  const result = validateAdminRows('MedicalPlans', [{ plan_id: 'prestige_0', deductible: -1, premium_sheet: '' }]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('deductible')));
  assert.ok(result.errors.some(error => error.includes('premium_sheet')));
});

test('Admin validation rejects protected SystemSettings keys', () => {
  const result = validateAdminRows('SystemSettings', [{ key: 'admin_password_hash', value: 'x' }], { writableSystemKeys: ['checkpoint_interval'] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected/i);
});

test('ReserveStrategies uses the common normalized mapping boundary', () => {
  const result = validateAdminRows('ReserveStrategies', [{ strategy_id: 'balanced', sheet_name: 'Balanced', support_percent: 1 }]);
  assert.equal(result.ok, true);
});
