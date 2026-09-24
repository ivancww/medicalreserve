import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReserveRows, premiumTotal, remainingMedicalCost, validateBackup } from '../domain.js';

test('normalizes official reserve rows and rejects incomplete rows', () => {
  assert.deepEqual(normalizeReserveRows([{ policy_year:'1', support_percent:'20', value_multiple:'1.1' }, { policy_year:'x' }]), [{ policy_year:1, support_percent:20, value_multiple:1.1 }]);
});
test('totals only complete official annual premium data', () => {
  assert.equal(premiumTotal([{ annual_premium: 10 }, { annual_premium: 25 }]), 35);
  assert.equal(premiumTotal([{ annual_premium: 10 }, {}]), null);
});
test('remaining cost is safe and never negative', () => {
  assert.equal(remainingMedicalCost(80000, 65000), 15000);
  assert.equal(remainingMedicalCost(10, 20), 0);
  assert.equal(remainingMedicalCost(10, undefined), null);
});
test('backup validation requires the app schema and user pages', () => {
  assert.equal(validateBackup({ schema:'medical-reserve-backup-v1', user:{ pages:[] } }, 'medical-reserve-backup-v1'), true);
  assert.equal(validateBackup({ schema:'medical-reserve-backup-v1', user:{} }, 'medical-reserve-backup-v1'), false);
});
