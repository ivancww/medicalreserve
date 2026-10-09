import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Medical Reserve admin entry boots the browser-bound Admin flow', () => {
  assert.match(index, /entry === 'admin' \? '\.\/admin\.js'/);
  assert.match(admin, /window\.opener/);
  assert.match(admin, /ava-admin-session-request/);
  assert.match(admin, /exchangeAdminSession/);
  assert.match(admin, /start\(\);\s*$/);
});

test('Medical Reserve Admin preserves security-bound exchange checks', () => {
  assert.match(admin, /event\.source !== window\.opener/);
  assert.match(admin, /event\.origin !== openerOrigin/);
  assert.match(admin, /data\.appId !== APP_ID/);
  assert.match(admin, /data\.launchNonce !== launchNonce/);
  assert.match(admin, /browserProof/);
  assert.match(admin, /contract !== 'ava-admin-session-v1'/);
});
