import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const gas = fs.readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');

test('P1-P9 uses the approved stable flow order', () => {
  assert.deepEqual([...app.matchAll(/id: '([^']+)'/g)].map(match => match[1]).slice(0, 9), [
    'protection_importance','premium_budget_awareness','premium_need_setup','premium_need_result',
    'funding_source','reserve_intro','reserve_setup','reserve_result','summary'
  ]);
  assert.match(app, /退休後，你覺得醫療保障對你嚟講會係/);
  assert.match(app, /你原先預計/);
  assert.match(app, /如果冇另外準備，呢筆退休後醫療保費/);
});

test('dual result modes are independent and medical support is the default', () => {
  assert.match(app, /resultMode: 'medical_support'/);
  assert.match(app, /data-mode="medical_support"/);
  assert.match(app, /data-mode="auto_accumulation"/);
  assert.match(app, /state\.resultMode = el\.dataset\.mode/);
  assert.match(app, /medicalReserve/);
  assert.doesNotMatch(app, /state\.autoResult\s*=\s*state\.medicalResult/);
  assert.doesNotMatch(app, /state\.medicalResult\s*=\s*state\.autoResult/);
});

test('phase structure and support period remain explicit', () => {
  assert.match(app, /5年 = Phase 1；10年 = Phase 1 \+ Phase 2；15年 = Phase 1 \+ Phase 2 \+ Phase 3/);
  assert.match(app, /min="40000" max="200000"/);
  assert.match(app, /Support period/);
  assert.match(gas, /savingPlanReturns/);
});

test('entry and update contracts remain present', () => {
  assert.match(app, /avaEntry/);
  assert.match(app, /返回 AVA/);
  assert.match(app, /updateViaCache: 'none'/);
  assert.match(app, /register\('\.\/sw\.js'/);
});
