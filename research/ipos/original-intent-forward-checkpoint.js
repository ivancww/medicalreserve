import fs from 'node:fs';
import { runOriginalIntentForward } from './original-intent-forward.js';

const dataset = JSON.parse(fs.readFileSync(new URL('./fixtures/dataset.json', import.meta.url), 'utf8'));
const constructionRoles = new Set(['calibration', 'regression']);

function forwardForCase(item) {
  const start = item.withdrawalSchedule.find(row => Number(row.withdrawal || 0) > 0)?.age;
  if (start == null) return null;
  const end = item.rows.at(-1).age;
  const medicalPremiumSchedule = item.withdrawalSchedule
    .filter(row => row.age >= start && row.age <= end)
    .map(row => ({ age: row.age, annualPremium: Number(row.withdrawal || 0) }));
  return runOriginalIntentForward({
    currentAge: item.issueAge,
    supportStartAge: start,
    supportEndAge: end,
    planId: 'genuine-fixture-path',
    phases: [{ id: 'phase1', enabled: true, annualContribution: item.annualPremium }],
    medicalPremiumSchedule
  }, dataset);
}

function metrics(comparisons) {
  const errors = comparisons.map(row => ({
    ...row,
    dollarError: row.model - row.genuine,
    absoluteDollarError: Math.abs(row.model - row.genuine),
    absoluteErrorPercent: Math.abs(row.model - row.genuine) / row.genuine * 100
  }));
  const maxPercent = errors.reduce((best, row) => !best || row.absoluteErrorPercent > best.absoluteErrorPercent ? row : best, null);
  const maxDollar = errors.reduce((best, row) => !best || row.absoluteDollarError > best.absoluteDollarError ? row : best, null);
  return {
    rows: errors.length,
    maeHKD: errors.reduce((sum, row) => sum + row.absoluteDollarError, 0) / errors.length,
    mapePercent: errors.reduce((sum, row) => sum + row.absoluteErrorPercent, 0) / errors.length,
    maximumAnnualAbsoluteErrorPercent: maxPercent?.absoluteErrorPercent ?? null,
    maximumDollarErrorHKD: maxDollar?.absoluteDollarError ?? null,
    worstPercentRow: maxPercent,
    worstDollarRow: maxDollar,
    rowsAbove010Percent: errors.filter(row => row.absoluteErrorPercent > 0.10).length,
    firstAbove010Percent: errors.find(row => row.absoluteErrorPercent > 0.10) ?? 'NEVER'
  };
}

const direct = [];
for (const item of dataset.cases.filter(item => constructionRoles.has(item.role))) {
  const result = forwardForCase(item);
  if (!result) continue;
  for (const row of result.schedule) {
    const genuine = item.rows.find(value => value.age === row.age)?.projectedRemainingSurrenderValue;
    if (genuine > 0 && row.phase1RemainingValue != null) direct.push({
      caseId: item.caseId, role: item.role, age: row.age, policyYear: row.age - item.issueAge,
      genuine, model: row.phase1RemainingValue, evidenceStatus: row.evidenceStatus
    });
  }
}

const interpolationCase = dataset.cases.find(item => item.caseId === '5pay_avf_150k');
const interpolationResult = forwardForCase(interpolationCase);
const interpolated = interpolationResult.schedule.map(row => ({
  caseId: interpolationCase.caseId,
  role: interpolationCase.role,
  age: row.age,
  policyYear: row.age - interpolationCase.issueAge,
  genuine: interpolationCase.rows.find(value => value.age === row.age).projectedRemainingSurrenderValue,
  model: row.phase1RemainingValue,
  evidenceStatus: row.evidenceStatus,
  sourceCaseIds: row.phaseEvidence[0].sourceCaseIds
})).filter(row => row.genuine > 0 && row.model != null);

const report = {
  reportVersion: 'original-intent-forward-checkpoint-v1',
  startingRemoteHead: 'c3ea513e835af14b1872560132e8f17b57e8ef9c',
  engine: 'ipos-original-intent-genuine-path-forward-v1',
  productionActivated: false,
  newActuarialModelIntroduced: false,
  routing: {
    status: 'RESOLVED — 5-YEAR ROTATING PHASE SUPPORT ROUTING',
    formula: 'activePhaseIndex = floor((attainedAge - supportStartAge) / 5) mod enabledPhaseCount',
    phase1: 'PASS', phase1And2: 'PASS', phase1And2And3: 'PASS'
  },
  officialMedicalPremiumSource: {
    spreadsheetTitle: '增值式醫保',
    spreadsheetId: '1OXblBBSdhnuFPP54FucxmNEVGL9d2s7fDfZqKtk_dHI',
    mappingSheet: 'MedicalPlans',
    gasFile: 'gas/Code.gs',
    contract: ['premium', 'premiumRange'],
    premiumRangeStatus: 'IMPLEMENTED_NOT_DEPLOYED_OR_LIVE_VERIFIED',
    exactPathMappings: {
      AVF: { planId: 'flexible_m', premiumSheet: '男靈活計劃' },
      AVPU: { planId: 'prestige_16000', premiumSheet: '尊耀16000自付額' },
      Original: { planId: 'select_18000', premiumSheet: '睿選18000自付額' }
    },
    knownMappingDefect: 'MedicalPlans select_0 maps to 睿選0自付額, while the actual premium tab is 睿選 0自付額; this plan fails safely until Official mapping is corrected.'
  },
  genuinePathReplay: metrics(direct),
  evidenceSupportedInterpolationBlindCheck: metrics(interpolated),
  interpolationCase: '5pay_avf_150k',
  constructionRoles: [...constructionRoles],
  holdoutExcludedFromConstruction: true,
  supportedPaths: {
    directlyValidated: 'Exact represented issue age, contribution anchor, Policy Year and matched genuine support history.',
    interpolatedEvidenceSupported: 'Between adjacent calibration anchors only when issue age and complete support history match.',
    unsupported: 'Unmatched repeated-support histories, out-of-range contribution, unsupported issue age or Policy Year.'
  },
  remainingBlockers: [
    'Unmatched repeated-support paths return NOT_YET_VALIDATED because no new actuarial transition is authorized.',
    'The committed read-only GAS premium/premiumRange contract must be deployed and live-verified.',
    'The Official MedicalPlans mapping for select_0 must be corrected to its actual premium-sheet tab name.'
  ],
  classification: 'ORIGINAL_INTENT_FORWARD_PARTIAL — UNMATCHED REPEATED-SUPPORT PATHS REMAIN NOT_YET_VALIDATED; GAS READ CONTRACT IS NOT YET DEPLOYED/VERIFIED'
};

fs.writeFileSync(new URL('./original-intent-forward-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

const md = `# Original-Intent Forward Calculation Checkpoint

Classification: **${report.classification}**

This research-only checkpoint locks the product routing rule, adds the smallest read-only Official premium contract, and demonstrates a Forward calculation by replaying genuine paths and narrowly supported interpolation. It introduces no actuarial model and does not activate production.

## Locked routing

\`activePhaseIndex = floor((attainedAge - supportStartAge) / 5) mod enabledPhaseCount\`

| Configuration | Result |
| --- | --- |
| Phase 1 | PASS |
| Phase 1 + Phase 2 | PASS |
| Phase 1 + Phase 2 + Phase 3 | PASS |

Non-active phases continue aging on their own issue-age/Policy-Year timelines; routing selects only the phase funding the current support year.

## Official Medical premium contract

- Official Sheet: **增值式醫保** (\`${report.officialMedicalPremiumSource.spreadsheetId}\`)
- Mapping tab: **MedicalPlans**
- Committed contract: \`gas/Code.gs?action=premium\` and \`action=premiumRange\`
- Range parameters: \`plan_id\`, \`support_start_age\`, \`support_end_age\`; legacy \`retirement_age\` / \`coverage_age\` remain accepted.
- Ages are inclusive. Missing plan, mapped sheet, or age fails safely. No medical premium is interpolated.
- Deployment status: **implemented in source; not deployed or live-verified in this environment**.

Verified path mappings from the genuine proposal schedules are:

| Genuine research path | Official plan_id | Premium tab |
| --- | --- | --- |
| AVF | \`flexible_m\` | 男靈活計劃 |
| AVPU | \`prestige_16000\` | 尊耀16000自付額 |
| Original | \`select_18000\` | 睿選18000自付額 |

Known Official mapping defect: \`select_0\` points to \`睿選0自付額\`, but the actual tab is \`睿選 0自付額\`. The contract deliberately fails safely rather than guessing.

## Forward evidence boundary

| Validation | Rows | MAPE | Max annual error | Max HKD error | First >0.10% |
| --- | ---: | ---: | ---: | ---: | --- |
| Exact genuine-path replay (calibration/regression) | ${report.genuinePathReplay.rows} | ${report.genuinePathReplay.mapePercent.toFixed(8)}% | ${report.genuinePathReplay.maximumAnnualAbsoluteErrorPercent.toFixed(8)}% | ${report.genuinePathReplay.maximumDollarErrorHKD.toFixed(2)} | ${report.genuinePathReplay.firstAbove010Percent} |
| Blind contribution interpolation (holdout \`5pay_avf_150k\`) | ${report.evidenceSupportedInterpolationBlindCheck.rows} | ${report.evidenceSupportedInterpolationBlindCheck.mapePercent.toFixed(8)}% | ${report.evidenceSupportedInterpolationBlindCheck.maximumAnnualAbsoluteErrorPercent.toFixed(8)}% | ${report.evidenceSupportedInterpolationBlindCheck.maximumDollarErrorHKD.toFixed(2)} | ${report.evidenceSupportedInterpolationBlindCheck.firstAbove010Percent} |

The holdout path is never used for lookup or interpolation construction. Its worst percentage row is age ${report.evidenceSupportedInterpolationBlindCheck.worstPercentRow.age} / PY${report.evidenceSupportedInterpolationBlindCheck.worstPercentRow.policyYear}. The largest dollar error is HKD ${report.evidenceSupportedInterpolationBlindCheck.maximumDollarErrorHKD.toFixed(2)} at age ${report.evidenceSupportedInterpolationBlindCheck.worstDollarRow.age} / PY${report.evidenceSupportedInterpolationBlindCheck.worstDollarRow.policyYear}.

## Supported and unsupported paths

- **DIRECTLY_VALIDATED:** exact represented issue age, contribution anchor, Policy Year, and matched complete genuine support history.
- **INTERPOLATED_EVIDENCE_SUPPORTED:** between adjacent calibration anchors only when issue age and complete support history match.
- **NOT_YET_VALIDATED:** any unmatched repeated-support history. The engine does not substitute v3/v4/component-state/carried-ratio.
- **OUT_OF_SUPPORTED_RANGE:** contribution below HKD 40,000 or above HKD 200,000, or unsupported issue age/Policy Year.

## Remaining blockers

1. ${report.remainingBlockers[0]}
2. ${report.remainingBlockers[1]}
3. ${report.remainingBlockers[2]}

Production Customer Flow, UI, engine selection, Official data, and genuine fixtures remain unchanged.
`;
fs.writeFileSync(new URL('./original-intent-forward-report.md', import.meta.url), md);

console.log(JSON.stringify({ direct: report.genuinePathReplay, interpolated: report.evidenceSupportedInterpolationBlindCheck }, null, 2));
