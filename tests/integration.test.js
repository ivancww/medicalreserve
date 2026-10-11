import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const version = fs.readFileSync('version.js', 'utf8');

test('Medical Reserve exposes explicit safe Frontstage/User entries and rejects Admin', () => {
  assert.match(app, /const appEntry = requestedEntry/);
  assert.match(app, /!\['frontend', 'user'\]\.includes\(requestedEntry\)/);
  assert.match(app, /不會授權任何官方寫入/);
  assert.match(html, /app\.js\?v=1\.1\.2/);
  assert.match(version, /APP_VERSION = '1\.1\.2'/);
});

test('Medical Reserve independently revalidates its PWA shell and retires only owned caches', () => {
  assert.match(sw, /cache: 'no-store'/);
  assert.match(sw, /medical-reserve-shell-1\.1\.2/);
  assert.match(sw, /startsWith\(OWNED_PREFIX\)/);
});
