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

const workbook = {
  MedicalPlans: [
    ['plan_id', 'display_name', 'gender', 'deductible', 'premium_sheet', 'enabled', 'sort_order'],
    ['prestige_16000', '尊耀計劃', 'ALL', 16000, '尊耀16000自付額', true, 1],
    ['broken', '錯誤映射', 'ALL', 0, '不存在分頁', true, 2]
  ],
  '尊耀16000自付額': [
    ['實際年齡', '年繳保費 (港元)'], [65, 37816], [66, 41208], [67, 43576], ['99+', 107448]
  ],
  SystemSettings: [['key', 'value'], ['data_version', 3]]
};

test('premiumRange supports new support-age names and returns an inclusive Official series', () => {
  const result = gas(workbook)({ action: 'premiumRange', plan_id: 'prestige_16000', support_start_age: '65', support_end_age: '67' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.annual_premiums.map(row => [row.age, row.annual_premium]), [[65, 37816], [66, 41208], [67, 43576]]);
  assert.equal(result.data.years, 3);
  assert.equal(result.data.total_premium, 122600);
  assert.equal(result.data.support_start_age, 65);
  assert.equal(result.data.support_end_age, 67);
});

test('premiumRange retains legacy retirement/coverage parameter compatibility', () => {
  const result = gas(workbook)({ action: 'premiumRange', plan_id: 'prestige_16000', retirement_age: '65', coverage_age: '66' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.annual_premiums.map(row => row.age), [65, 66]);
  assert.equal(result.data.retirement_age, 65);
  assert.equal(result.data.coverage_age, 66);
});

test('99+ is an explicit Official band rather than invented interpolation', () => {
  const result = gas(workbook)({ action: 'premium', plan_id: 'prestige_16000', age: '100' });
  assert.equal(result.data.annual_premium, 107448);
  assert.equal(result.data.source_age, '99+');
});

test('missing plan, mapped sheet and age fail safely', () => {
  assert.equal(gas(workbook)({ action: 'premiumRange', plan_id: 'missing', support_start_age: '65', support_end_age: '65' }).error.code, 'PLAN_NOT_FOUND');
  assert.equal(gas(workbook)({ action: 'premiumRange', plan_id: 'broken', support_start_age: '65', support_end_age: '65' }).error.code, 'MAPPED_PREMIUM_SHEET_NOT_FOUND');
  assert.equal(gas(workbook)({ action: 'premiumRange', plan_id: 'prestige_16000', support_start_age: '64', support_end_age: '65' }).error.code, 'PREMIUM_AGE_NOT_FOUND');
});
