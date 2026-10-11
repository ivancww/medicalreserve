import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADMIN_RESOURCES, validateAdminRows } from '../domain.js';

const flow = [
  'protection_importance', 'premium_budget_awareness', 'premium_need_setup',
  'premium_need_result', 'funding_source', 'reserve_intro', 'reserve_setup',
  'reserve_result', 'summary'
].map((id, sort_order) => ({ step_id: id, title: id, enabled: true, sort_order }));

test('Admin domains match the actual Medical Reserve Official workbook', () => {
  assert.deepEqual(ADMIN_RESOURCES, ['AppFlow', 'FlowOptions', 'MedicalPlans', 'Visualization', 'SystemSettings']);
  assert.equal(validateAdminRows('ReserveStrategies', [] , {}).ok, false);
});

test('Admin validation protects required AppFlow IDs and stable records', () => {
  const missing = validateAdminRows('AppFlow', flow.filter(row => row.step_id !== 'summary'), { requiredFlowIds: flow.map(row => row.step_id) });
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join(' '), /summary/);

  const changedIdentity = validateAdminRows('MedicalPlans', [{ plan_id: '', deductible: 0, premium_sheet: '尊耀0自付額' }]);
  assert.equal(changedIdentity.ok, false);
});

test('Admin validation uses the actual Visualization composite identity', () => {
  const result = validateAdminRows('Visualization', [
    { visual_id: 'premium_need_result', setting: 'checkpoint_interval', value: 5 },
    { visual_id: 'premium_need_result', setting: 'chart_type', value: 'step' }
  ]);
  assert.equal(result.ok, true);
});

test('Admin validation rejects protected SystemSettings keys', () => {
  const result = validateAdminRows('SystemSettings', [{ key: 'data_version', value: 999 }], { writableSystemKeys: ['checkpoint_interval', 'default_result_mode'] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected/i);
  assert.equal(validateAdminRows('SystemSettings', [{ key: 'checkpoint_interval', value: 5 }], { writableSystemKeys: ['checkpoint_interval', 'default_result_mode'] }).ok, true);
});

test('Admin source requires AVA Studio authorization and persisted write evidence', () => {
  const admin = fs.readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
  assert.match(admin, /ava-admin-session-v1/);
  assert.match(admin, /action: 'readOfficial'/);
  assert.match(admin, /data-admin-tab/);
  assert.match(admin, /hidden/);
  assert.match(admin, /beforeunload/);
  assert.match(admin, /persisted !== true/);
  assert.match(admin, /readAfterWrite !== true/);
});

test('GAS source has one effective GET/POST router and protected write boundaries', () => {
  const gas = fs.readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
  assert.equal((gas.match(/function doGet\s*\(/g) || []).length, 1);
  assert.equal((gas.match(/function doPost\s*\(/g) || []).length, 1);
  assert.match(gas, /action === 'readOfficial'/);
  assert.match(gas, /LockService\.getScriptLock/);
  assert.match(gas, /expectedVersion/);
  assert.match(gas, /restoreRange_/);
  assert.match(gas, /Visualization: \{ key: \['visual_id','setting'\]/);
  assert.doesNotMatch(gas, /ReserveStrategies: \{/);
  assert.match(gas, /persisted: true/);
});
