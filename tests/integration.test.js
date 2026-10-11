import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('app.js', 'utf8');
const admin = fs.readFileSync('admin.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const version = fs.readFileSync('version.js', 'utf8');

test('Medical Reserve keeps Frontstage/User and routes Admin through its browser-bound module', () => {
  assert.match(app, /const entry = new URLSearchParams/);
  assert.match(app, /!\['frontend', 'user'\]\.includes\(entry\)/);
  assert.match(app, /不會授權任何官方寫入/);
  assert.match(html, /import\(entry === 'admin' \? '\.\/admin\.js' : '\.\/app\.js'\)/);
  assert.match(admin, /缺少 AVA Studio browser launch/);
  assert.match(admin, /window\.opener/);
  assert.doesNotMatch(html, /\?v=/);
  assert.match(version, /APP_VERSION = '1\.1\.3'/);
});

test('Medical Reserve independently revalidates its PWA shell without release-specific cache names', () => {
  assert.match(sw, /cache: 'no-store'/);
  assert.match(sw, /SHELL_CACHE = 'medical-reserve-shell'/);
  assert.doesNotMatch(sw, /medical-reserve-shell-1\.1\.2/);
  assert.match(sw, /startsWith\(SHELL_CACHE_PREFIX\)/);
});
