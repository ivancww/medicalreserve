import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('Admin renders Saving-style domain cards with actual counts and active state', () => {
  assert.match(admin, /class="admin-tab\$\{resource === active \? ' is-active' : ''\}"/);
  assert.match(admin, /<small>\$\{rowsFor\(resource\)\.length\} 筆<\/small>/);
  assert.match(admin, /role="tablist"/);
  assert.match(admin, /aria-selected="\$\{resource === active\}"/);
});

test('Admin keeps exactly one accessible active panel', () => {
  assert.match(admin, /role="tabpanel"/);
  assert.match(admin, /panel\.replace\(' class="admin-panel"', ' class="admin-panel" hidden'\)/);
  assert.match(admin, /aria-controls="admin-panel-\$\{resource\}"/);
  assert.match(styles, /\[hidden\]\{display:none!important\}/);
});

test('Admin record editor preserves identity and unknown fields', () => {
  assert.match(admin, /選擇記錄/);
  assert.match(admin, /recordLabel\(resource, item\)/);
  assert.match(admin, /data-admin-resource="\$\{escapeHtml\(resource\)\}"/);
  assert.match(admin, /其他欄位已保留/);
  assert.match(admin, /儲存時會原樣保留/);
  assert.match(admin, /data-admin-field/);
});

test('Admin keeps draft, authorization and persisted-write evidence boundaries', () => {
  assert.match(admin, /state\.drafts/);
  assert.match(admin, /state\.confirmedConfig/);
  assert.match(admin, /persisted !== true/);
  assert.match(admin, /readAfterWrite !== true/);
  assert.match(admin, /beforeunload/);
  assert.match(admin, /data_version/);
});

test('Admin responsive layout uses wrapped card grids without page overflow', () => {
  assert.match(styles, /\.admin-tabs\{display:grid;grid-template-columns:repeat\(5/);
  assert.match(styles, /\.admin-tabs\{grid-template-columns:repeat\(3/);
  assert.match(styles, /\.admin-tabs\{grid-template-columns:repeat\(2/);
  assert.match(styles, /html,body\{overflow-x:hidden\}/);
  assert.match(styles, /\.admin-tabs\{overflow:visible;flex-wrap:initial\}/);
});

test('System information is bottom-mounted and collapsed by default', () => {
  assert.match(admin, /<details class="admin-system-info"><summary>系統資料<\/summary>/);
  assert.doesNotMatch(admin, /<details[^>]+open/);
});
