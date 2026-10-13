import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { groupMedicalPlans, selectMedicalPlanId } from '../customer-input.js';
import { automaticAccumulation } from '../reserve-runtime.js';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const plans = [
  { plan_id: 'flexible_f', display_name: '靈活計劃', gender: '女', deductible: 0, enabled: true, sort_order: 10 },
  { plan_id: 'flexible_m', display_name: '靈活計劃', gender: '男', deductible: 0, enabled: true, sort_order: 20 },
  { plan_id: 'select_0', display_name: '睿選計劃', gender: 'ALL', deductible: 0, enabled: true, sort_order: 30 },
  { plan_id: 'select_8800', display_name: '睿選計劃', gender: 'ALL', deductible: 8800, enabled: true, sort_order: 40 },
  { plan_id: 'select_18000', display_name: '睿選計劃', gender: 'ALL', deductible: 18000, enabled: true, sort_order: 50 },
  { plan_id: 'prestige_0', display_name: '尊耀計劃', gender: 'ALL', deductible: 0, enabled: true, sort_order: 60 },
  { plan_id: 'prestige_16000', display_name: '尊耀計劃', gender: 'ALL', deductible: 16000, enabled: true, sort_order: 70 }
];

test('plan and deductible selectors are derived from enabled Official MedicalPlans rows', () => {
  const groups = groupMedicalPlans(plans);
  assert.deepEqual(groups.find(group => group.label === '睿選計劃')?.plans.map(plan => plan.deductible), [0, 8800, 18000]);
  assert.deepEqual(groups.filter(group => group.name === '靈活計劃').map(group => group.label), ['靈活計劃（女）', '靈活計劃（男）']);
  assert.equal(selectMedicalPlanId(plans, groups.find(group => group.label === '睿選計劃').key, 18000), 'select_18000');
  assert.equal(selectMedicalPlanId(plans, groups.find(group => group.label === '尊耀計劃').key, 16000), 'prestige_16000');
});

test('customer setup uses compact selectors and preserves stable plan identity', () => {
  assert.match(app, /data-action="plan-choice"/);
  assert.match(app, /data-action="deductible"/);
  assert.match(app, /groupMedicalPlans\(state\.plans\)/);
  assert.match(app, /selectMedicalPlanId\(state\.plans/);
  assert.doesNotMatch(app, /choices\('planId'/);
  assert.doesNotMatch(app, /自付額 \$\{money\(Number\(p\.deductible/);
});

test('customer navigation is rendered inside the presentation card', () => {
  assert.match(app, /class="card-navigation"/);
  assert.match(app, /data-action="prev">← 返回/);
  assert.doesNotMatch(app, /class="journey-nav"/);
  assert.match(styles, /\.card-navigation\{/);
});

test('customer microcopy, result labels and duplicate footer identity are removed', () => {
  assert.doesNotMatch(app, /讀取現有 Official Medical Premium data/);
  assert.doesNotMatch(app, /Support period/);
  assert.doesNotMatch(app, /Medical Reserve Support/);
  assert.doesNotMatch(app, /累積已支援醫療保費/);
  assert.match(app, /由醫療儲備支付/);
  assert.match(app, /累積已支付醫療保費/);
  assert.match(app, /醫療儲備結果/);
  assert.doesNotMatch(app, /<span class="caption">AVA Medical Reserve<\/span>/);
  assert.doesNotMatch(app, /官方資料已更新/);
});

test('查看結果 has a real async loading state and blocks duplicate submissions', () => {
  assert.match(app, /calculationStatus: 'idle'/);
  assert.match(app, /state\.calculationStatus = 'loading'/);
  assert.match(app, /計算中…/);
  assert.match(app, /disabled aria-busy="true"/);
  assert.match(app, /if \(state\.calculationStatus === 'loading'\) return/);
});

test('unsupported Forward remaining values are not rendered as HK$0', () => {
  assert.match(app, /money\(r\.combinedRemainingMedicalReserveValue \?\? r\.remainingSurrenderValue\)/);
  assert.doesNotMatch(app, /Number\(r\.combinedRemainingMedicalReserveValue \?\? r\.remainingSurrenderValue \?\? 0\)/);
});

test('automatic accumulation displays sparse Official rows without fabricating gaps', () => {
  const rows = [5, 10, 15].map(policy_year => ({
    medical_plan_id: 'prestige_16000', annual_contribution: 130000, issue_age: 40, policy_year,
    base_value: policy_year * 1000, enabled: true
  }));
  const result = automaticAccumulation({
    rows, currentAge: 40, supportStartAge: 45, supportEndAge: 55, arrangement: 5,
    phaseContributions: { phase1: 130000, phase2: 130000, phase3: 130000 }, medicalPlanId: 'prestige_16000'
  });
  assert.deepEqual(result.map(row => row.age), [45, 50, 55]);
  assert.deepEqual(result.map(row => row.value), [5000, 10000, 15000]);
});

test('auto accumulation remains independent from the Forward scenario', () => {
  assert.match(app, /state\.autoResult = automaticAccumulation/);
  assert.doesNotMatch(app, /state\.autoResult\s*=\s*state\.medicalResult/);
  assert.doesNotMatch(app, /state\.medicalResult\s*=\s*state\.autoResult/);
});
