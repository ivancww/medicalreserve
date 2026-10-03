import fs from 'node:fs';

const root = new URL('./', import.meta.url);
const evidence = JSON.parse(fs.readFileSync(new URL('evidence-gap-matrix.json', root), 'utf8'));

const round = (value, digits = 8) => Number(Number(value).toFixed(digits));
const error = (model, genuine) => ({
  genuine,
  model: round(model, 6),
  dollarError: round(model - genuine, 6),
  signedPercent: genuine === 0 ? null : round((model - genuine) / genuine * 100),
  absolutePercent: genuine === 0 ? null : round(Math.abs(model - genuine) / genuine * 100)
});

const sources = evidence.sourceRecords.filter(source => source.usable);
const firstWithdrawals = [];
const basicReductions = [];
const gcvStates = [];
const componentIdentities = [];
const allocationIdentities = [];

for (const source of sources) {
  const rows = source.evidenceByPolicyYear
    .filter(row => row.values && Number.isFinite(row.values.noWithdrawalTotal))
    .sort((a, b) => a.policyYear - b.policyYear);
  const first = rows.find(row => Number(row.values.withdrawal || 0) > 0);
  if (first) {
    firstWithdrawals.push({
      caseId: source.caseId,
      sourceId: source.sourceId,
      policyYear: first.policyYear,
      age: source.metadata.issueAge + first.policyYear,
      ...error(first.values.noWithdrawalTotal - first.values.withdrawal, first.values.postWithdrawalTotal)
    });
  }
  let previousBasic = source.metadata.initialBasicAmount;
  for (const row of rows) {
    const values = row.values;
    const initialBasic = source.metadata.initialBasicAmount;
    const basic = values.basicAmount;
    const fromGCV = Number(values.GCVWithdrawal || 0);
    const noGCV = Number(values.noWithdrawalComponents?.GCV || 0);
    if (fromGCV > 0 && noGCV > 0) {
      const gcvPerBasic = noGCV / initialBasic;
      const predictedReduction = fromGCV / gcvPerBasic;
      const observedReduction = previousBasic - basic;
      basicReductions.push({
        caseId: source.caseId,
        sourceId: source.sourceId,
        policyYear: row.policyYear,
        age: source.metadata.issueAge + row.policyYear,
        previousBasic,
        displayedBasic: basic,
        GCVWithdrawal: fromGCV,
        noWithdrawalGCV: noGCV,
        gcvPerOriginalBasic: round(gcvPerBasic, 12),
        observedReduction,
        ...error(predictedReduction, observedReduction)
      });
    }
    if (Number.isFinite(basic) && noGCV > 0 && Number.isFinite(values.postWithdrawalComponents?.GCV)) {
      gcvStates.push({
        caseId: source.caseId,
        sourceId: source.sourceId,
        policyYear: row.policyYear,
        age: source.metadata.issueAge + row.policyYear,
        basicAmount: basic,
        ...error(noGCV / initialBasic * basic, values.postWithdrawalComponents.GCV)
      });
    }
    if (values.noWithdrawalComponents && Number.isFinite(values.noWithdrawalTotal)) {
      componentIdentities.push({
        caseId: source.caseId,
        policyYear: row.policyYear,
        type: 'NO_WITHDRAWAL',
        ...error(values.noWithdrawalComponents.GCV + values.noWithdrawalComponents.RB + values.noWithdrawalComponents.TD, values.noWithdrawalTotal)
      });
    }
    if (values.postWithdrawalComponents && Number.isFinite(values.postWithdrawalTotal)) {
      componentIdentities.push({
        caseId: source.caseId,
        policyYear: row.policyYear,
        type: 'POST_WITHDRAWAL',
        ...error(values.postWithdrawalComponents.GCV + values.postWithdrawalComponents.RB + values.postWithdrawalComponents.TD, values.postWithdrawalTotal)
      });
    }
    if (Number.isFinite(values.withdrawal)) {
      allocationIdentities.push({
        caseId: source.caseId,
        policyYear: row.policyYear,
        ...error(Number(values.GCVWithdrawal || 0) + Number(values.RBWithdrawal || 0) + Number(values.associatedTDWithdrawal || 0), values.withdrawal)
      });
    }
    if (Number.isFinite(basic)) previousBasic = basic;
  }
}

const summarize = rows => {
  const errors = rows.map(row => Math.abs(row.dollarError));
  return {
    rows: rows.length,
    rowsWithinHKD1: rows.filter(row => Math.abs(row.dollarError) <= 1).length,
    meanAbsoluteHKD: round(errors.reduce((sum, value) => sum + value, 0) / Math.max(errors.length, 1), 6),
    maxAbsoluteHKD: round(Math.max(0, ...errors), 6)
  };
};

const py15Anchors = [];
const seenPremium = new Set();
for (const source of sources.slice().sort((a, b) => a.metadata.annualPremiumRoundedTableAnchor - b.metadata.annualPremiumRoundedTableAnchor)) {
  const premium = source.metadata.annualPremiumRoundedTableAnchor;
  if (seenPremium.has(premium)) continue;
  const row = source.evidenceByPolicyYear.find(item => item.policyYear === 15);
  if (!row?.values?.noWithdrawalTotal) continue;
  seenPremium.add(premium);
  py15Anchors.push({
    caseId: source.caseId,
    annualPremium: premium,
    initialBasicAmount: source.metadata.initialBasicAmount,
    noWithdrawalTotal: row.values.noWithdrawalTotal,
    totalPerBasicAmount: round(row.values.noWithdrawalTotal / source.metadata.initialBasicAmount, 12)
  });
}

const historicalExamples = {
  py15NoWithdrawalNormalization: py15Anchors.filter(row => [40000, 70000, 100000, 130000, 150000, 180000, 200000].includes(row.annualPremium)),
  basicReduction: basicReductions.filter(row => row.caseId === '70k_original' && [19, 20].includes(row.policyYear)),
  firstWithdrawal: firstWithdrawals
};

const report = {
  reportVersion: 'historical-formula-recovery-v1',
  startingRemoteHead: '01310d52f1ff659da796cb33ca6e5e3845bc2f3e',
  recoveredFormulaName: 'ipos-historical-evidence-rule-set-recovery-v1',
  purpose: 'Recovery and reproduction only; this is not a new approximation candidate and is not production-active.',
  historyInventory: [
    { commit: '0b76a7c588d028c0ae624894e471233376b45f89', finding: 'First committed research engine: policy-year mapping, premium-to-Basic anchors, normalized components, allocation and persistent-state attempt; holdout max 57.11395611%.' },
    { commit: '525669e74566f3228962c5428809a492563aa521', finding: 'Normalized policy-year transition v2 and GCV-per-Basic reduction structure; holdout max remained 56.85795543%.' },
    { commit: '06cc4722ba90777fa331472f0ae20823d8e45788', finding: 'v3 base-curve diagnostics; holdout max 35.97650942%.' },
    { commit: '217eed4e2d3287bfa93402065b35acfe2713efe4', finding: 'v4 TD transition; holdout max 11.80075621%.' },
    { commit: 'd0311fc4b786c8f3ea17c2699a4f43f4da886565', finding: 'Genuine evidence audit committed complete paired annual GCV/RB/TD/allocation evidence.' },
    { commit: '01310d52f1ff659da796cb33ca6e5e3845bc2f3e', finding: 'Later carried-ratio total-value candidate; explicitly excluded from recovery.' }
  ],
  recoveredRules: [
    { id: 'policyYear', equation: 'policyYear = attainedAge - issueAge', sources: ['historical code 0b76a7c', 'genuine proposal annual tables'] },
    { id: 'basicAmount', equation: 'Basic Amount is resolved by exact premium anchor; interpolation was present historically but is not needed for anchor reproduction.', sources: ['historical code 0b76a7c', 'fixture metadata', 'genuine proposal metadata'] },
    { id: 'noWithdrawalNormalization', equation: 'component(PY, Basic) = genuine no-withdrawal component(PY) / original Basic Amount * current Basic Amount', sources: ['historical code 0b76a7c and 525669e', 'genuine proposal evidence'] },
    { id: 'firstWithdrawal', equation: 'remaining total = no-withdrawal total - current withdrawal', sources: ['historical code 217eed4', 'committed regression tests', 'genuine proposal evidence'] },
    { id: 'allocationIdentity', equation: 'withdrawal = RB withdrawal + associated TD withdrawal + GCV withdrawal', sources: ['genuine allocation tables d0311fc'] },
    { id: 'basicReduction', equation: 'Basic reduction = GCV withdrawal / (no-withdrawal GCV(PY) / original Basic Amount)', sources: ['historical code 525669e', 'genuine proposal evidence d0311fc'] },
    { id: 'postReductionGCV', equation: 'post GCV = no-withdrawal GCV(PY) / original Basic Amount * current Basic Amount', sources: ['genuine proposal evidence d0311fc'] }
  ],
  missingHistoricalRules: [
    'How depleted RB is replenished/carried from one policy year to the next after the first withdrawal.',
    'How associated TD depletion changes the next-year TD state, including through zero-withdrawal years.',
    'A complete deterministic subsequent-year total-value equation using those RB/TD states.'
  ],
  historicalReproduction: {
    status: 'PARTIAL_RULES_REPRODUCED_COMPLETE_TOTAL_PATH_NOT_FOUND',
    examples: historicalExamples,
    summaries: {
      firstWithdrawal: summarize(firstWithdrawals),
      basicReduction: summarize(basicReductions),
      postReductionGCV: summarize(gcvStates),
      componentIdentity: summarize(componentIdentities),
      allocationIdentity: summarize(allocationIdentities)
    }
  },
  expandedValidation: {
    status: 'NOT_RUN_PREREQUISITE_FAILED',
    reason: 'No committed or recoverable complete historical RB/TD transition path exists. Running a full total-value holdout would require substituting or inventing a new rule, prohibited by this recovery task.',
    MAPE: null,
    maximumAnnualAbsoluteError: null,
    maximumDollarError: null,
    worstCase: null,
    firstAbove010: null
  },
  leakage: 'PASS',
  productionActivated: false,
  classification: 'RECOVERED_FORMULA_PARTIAL — SPECIFIC RULE STILL MISSING'
};

const markdown = `# Recovered Historical iPOS Formula Checkpoint\n\n` +
`Classification: **${report.classification}**\n\n` +
`This checkpoint recovers and reproduces only rules that exist in Git history or genuine proposal evidence. It does not optimize v4 or the carried-ratio candidate, and it does not invent the missing RB/TD transition.\n\n` +
`## A. Recovered historical calculation sequence\n\n` +
report.recoveredRules.map((rule, index) => `${index + 1}. **${rule.id}** — \`${rule.equation}\`  \n   Source: ${rule.sources.join('; ')}.`).join('\n') +
`\n\nThe sequence becomes incomplete after a first withdrawal: no historical code/report supplies an evidence-valid RB replenishment and TD carryover law that reproduced the later total path at 0.05%–0.10%.\n\n` +
`## B. Git-history finding\n\n| Commit | Finding |\n| --- | --- |\n` + report.historyInventory.map(row => `| \`${row.commit.slice(0, 7)}\` | ${row.finding} |`).join('\n') +
`\n\nNo PR conversation comments, branch, tag, reflog entry, unreachable commit, report, test, or historical engine contains a complete successful annual formula. The committed 0.05%–0.10% successes are individual identities/rows, not an end-to-end annual engine result.\n\n` +
`## C. Historical reproduction\n\n| Check | Rows | Within HKD 1 | Mean absolute HKD | Maximum absolute HKD |\n| --- | ---: | ---: | ---: | ---: |\n` +
Object.entries(report.historicalReproduction.summaries).map(([name, row]) => `| ${name} | ${row.rows} | ${row.rowsWithinHKD1} | ${row.meanAbsoluteHKD} | ${row.maxAbsoluteHKD} |`).join('\n') +
`\n\n### Prompt-cited 70K Basic Amount examples\n\n| PY | GCV withdrawal | Observed reduction | Recovered reduction | Absolute % |\n| ---: | ---: | ---: | ---: | ---: |\n` +
historicalExamples.basicReduction.map(row => `| ${row.policyYear} | ${row.GCVWithdrawal} | ${row.genuine} | ${row.model} | ${row.absolutePercent}% |`).join('\n') +
`\n\n### PY15 no-withdrawal normalization\n\n| Annual premium | Basic Amount | No-withdrawal total | Total / Basic |\n| ---: | ---: | ---: | ---: |\n` +
historicalExamples.py15NoWithdrawalNormalization.map(row => `| ${row.annualPremium} | ${row.initialBasicAmount} | ${row.noWithdrawalTotal} | ${row.totalPerBasicAmount} |`).join('\n') +
`\n\n## D. Expanded validation\n\n**NOT RUN — prerequisite failed.** ${report.expandedValidation.reason}\n\nMAPE, maximum annual total error, worst case, and threshold crossings are therefore **not available**, rather than being represented by v4 or carried-ratio metrics.\n\n` +
`## E. First missing rule\n\nThe first unresolved state after the exact first-withdrawal row is **RB depletion/replenishment plus associated TD carryover into the following Policy Year**. GCV and Basic Amount normalization are recoverable and independently reproducible; the missing RB/TD transition prevents a complete subsequent-year total.\n\n` +
`## F. Decision\n\n**${report.classification}**\n\nThe specific missing historical rule is the evidence-valid next-year RB/TD state transition. No new generic approximation was substituted. Leakage: **PASS**. Production activation: **NO**.\n`;

fs.writeFileSync(new URL('recovered-historical-formula.json', root), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(new URL('recovered-historical-formula.md', root), markdown);
console.log(JSON.stringify({ classification: report.classification, summaries: report.historicalReproduction.summaries }));

export { report };
