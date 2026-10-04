import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatMoneyInput, parseMoneyInput, validateSupportAgeRange } from '../customer-input.js';
import { routeSupportPhase } from '../research/ipos/original-intent-forward.js';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('customer money inputs format live while preserving numeric state', () => {
  assert.equal(formatMoneyInput(100000), '100,000');
  assert.equal(formatMoneyInput('130000'), '130,000');
  assert.equal(parseMoneyInput('130,000'), 130000);
  assert.equal(parseMoneyInput(''), null);
});

test('support ages are manual integers with clear range validation', () => {
  assert.equal(validateSupportAgeRange({ start: 57, end: 87, minimum: 40, maximum: 100 }).ok, true);
  assert.equal(validateSupportAgeRange({ start: 63, end: 62, minimum: 40, maximum: 100 }).ok, false);
  assert.equal(validateSupportAgeRange({ start: 101, end: 101, minimum: 40, maximum: 100 }).ok, false);
  assert.match(validateSupportAgeRange({ start: 63, end: 62, minimum: 40, maximum: 100 }).message, /不可早於/);
});

test('phase routing is relative to each actual support start age', () => {
  for (const [start, end] of [[57, 87], [63, 88], [68, 91]]) {
    assert.equal(routeSupportPhase({ attainedAge: start, supportStartAge: start, enabledPhaseIds: ['phase1', 'phase2'] }), 'phase1');
    assert.equal(routeSupportPhase({ attainedAge: start + 4, supportStartAge: start, enabledPhaseIds: ['phase1', 'phase2'] }), 'phase1');
    assert.equal(routeSupportPhase({ attainedAge: start + 5, supportStartAge: start, enabledPhaseIds: ['phase1', 'phase2'] }), 'phase2');
    assert.ok(end >= start);
  }
});

test('customer runtime keeps result navigation, dual modes, and app-only header version', () => {
  assert.match(app, /page\.kind === 'reserve_setup'/);
  assert.match(app, /state\.step = Math\.min\(state\.flow\.length - 1, state\.step \+ 1\)/);
  assert.match(app, /resultMode: 'medical_support'/);
  assert.match(app, /data-mode="auto_accumulation"/);
  assert.match(app, /AVA MEDICAL RESERVE · v\$\{CONFIG\.version\}/);
  assert.doesNotMatch(app, /<footer[^>]*>[\s\S]*v\$\{CONFIG\.version\}/);
  assert.match(app, /data-action="contribution"/);
  assert.match(app, /inputmode="numeric"/);
});
