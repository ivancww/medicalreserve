import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');

function gas(rowsBySheet) {
  const sheets = new Map(Object.entries(rowsBySheet).map(([name, values]) => [name, {
    getName: () => name,
    getDataRange: () => ({ getValues: () => values.map(row => [...row]) })
  }]));
  const context = {
    console,
    SpreadsheetApp: { getActive: () => ({ getName: () => '增值式醫保', getSheets: () => [...sheets.values()], getSheetByName: name => sheets.get(name) || null }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: content => ({ content, setMimeType() { return this; }, getContent() { return this.content; } })
    }
  };
  vm.createContext(context); vm.runInContext(code, context);
  return parameters => JSON.parse(context.doGet({ parameter: parameters }).getContent());
}

const headers = ['return_data_id','dataset_id','data_version','product_id','medical_plan_id','currency','pay_term_years','annual_contribution','issue_age','policy_year','base_value','basic_amount','guaranteed_cash_value','reversionary_bonus_cash_value','terminal_dividend_cash_value','source_case_id','evidence_class','enabled'];
const row = ['saving-return-v1:fixture:py1','SavingPlanReturns',1,'aia_hk_5pay','flexible_m','HKD',5,130000,45,1,132,1323829,132,0,0,'fixture','DIRECT',true];
const workbook = {
  SystemSettings: [['key', 'value'], ['saving_return_data_version', 1]],
  SavingPlanReturns: [headers, row]
};

test('savingPlanReturns returns the versioned approved read-only dataset', () => {
  const result = gas(workbook)({ action: 'savingPlanReturns' });
  assert.equal(result.ok, true);
  assert.equal(result.api_version, '1.2.0');
  assert.equal(result.data.dataset_id, 'SavingPlanReturns');
  assert.equal(result.data.data_version, 1);
  assert.deepEqual(result.data.rows[0], Object.fromEntries(headers.map((key, index) => [key, row[index]])));
});

test('savingPlanReturns fails safely for missing schema and invalid version', () => {
  const missingSheet = gas({ SystemSettings: [['key', 'value'], ['saving_return_data_version', 1]] })({ action: 'savingPlanReturns' });
  assert.equal(missingSheet.error.code, 'SAVING_RETURN_SHEET_NOT_FOUND');
  const invalidVersion = gas({ SystemSettings: [['key', 'value'], ['saving_return_data_version', 'v2']], SavingPlanReturns: [headers, row] })({ action: 'savingPlanReturns' });
  assert.equal(invalidVersion.error.code, 'INVALID_SAVING_RETURN_VERSION');
});

test('savingPlanReturns rejects unsupported product, pay term and duplicate keys', () => {
  const badProduct = [...row]; badProduct[3] = 'other_product';
  assert.equal(gas({ SystemSettings: [['key', 'value'], ['saving_return_data_version', 1]], SavingPlanReturns: [headers, badProduct] })({ action: 'savingPlanReturns' }).error.code, 'SAVING_RETURN_SCHEMA_INVALID');
  const badTerm = [...row]; badTerm[6] = 10;
  assert.equal(gas({ SystemSettings: [['key', 'value'], ['saving_return_data_version', 1]], SavingPlanReturns: [headers, badTerm] })({ action: 'savingPlanReturns' }).error.code, 'SAVING_RETURN_SCHEMA_INVALID');
  assert.equal(gas({ SystemSettings: [['key', 'value'], ['saving_return_data_version', 1]], SavingPlanReturns: [headers, row, row] })({ action: 'savingPlanReturns' }).error.code, 'SAVING_RETURN_DUPLICATE_KEY');
});
