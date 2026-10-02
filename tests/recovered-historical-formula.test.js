import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { report } from '../research/ipos/recover-historical-formula.js';

test('historical recovery reproduces the prompt-cited Basic Amount reductions', () => {
  const rows = report.historicalReproduction.examples.basicReduction;
  assert.deepEqual(rows.map(row => row.policyYear), [19, 20]);
  assert.ok(rows.every(row => row.absolutePercent <= 0.01));
  assert.ok(rows.every(row => Math.abs(row.dollarError) <= 1));
});

test('first-withdrawal identities reproduce genuine proposal evidence', () => {
  const result = report.historicalReproduction.summaries.firstWithdrawal;
  assert.ok(result.rows >= 20);
  assert.equal(result.rowsWithinHKD1, result.rows);
  assert.ok(result.maxAbsoluteHKD <= 1);
});

test('normalized GCV state follows displayed Basic Amount', () => {
  const result = report.historicalReproduction.summaries.postReductionGCV;
  assert.ok(result.rows >= 1000);
  assert.ok(result.rowsWithinHKD1 >= result.rows - 2);
  assert.ok(result.maxAbsoluteHKD <= 1.1);
});

test('recovery stops instead of inventing the missing RB/TD rule', () => {
  assert.equal(report.expandedValidation.status, 'NOT_RUN_PREREQUISITE_FAILED');
  assert.equal(report.expandedValidation.MAPE, null);
  assert.equal(report.classification, 'RECOVERED_FORMULA_PARTIAL — SPECIFIC RULE STILL MISSING');
  assert.equal(report.productionActivated, false);
  assert.equal(report.leakage, 'PASS');
});

test('generated recovery artifacts agree', () => {
  const saved = JSON.parse(fs.readFileSync(new URL('../research/ipos/recovered-historical-formula.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, report);
});
