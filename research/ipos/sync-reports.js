// Annotate regenerated v4 reports with the bounded research outcome, without fitting.
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL(name+'.json',import.meta.url),'utf8'));
const write=(name,report)=>fs.writeFileSync(new URL(name+'.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const validation=read('./validation-report'),td=read('./td-transition-research');
const fixtures=read('./fixture-validation-report');
const verificationRun=read('./verification-report');
const verification=Object.fromEntries(Object.entries(verificationRun).map(([key,value])=>[key,value && typeof value==='object' ? Object.fromEntries(Object.entries(value).filter(([field])=>field!=='output')) : value]));
const summary={engineVersion:validation.engineVersion,leakageStatus:validation.dataset.leakageCheck?'PASS':'FAIL',aggregate:validation.results.holdout,
 holdouts:validation.holdouts.map(({rows,...summary})=>summary)};
const research={iterations:td.experiments.length,retainedModel:td.selectedModel,iterationOutcomes:td.experiments.map(e=>({iteration:e.iteration,hypothesis:e.hypothesis,decision:e.decision,targetedGate:e.targetedGate,fullHoldoutExecuted:e.frozenHoldout!==null})),
 structuralLimit:'The legacy aggregate ratio also supplies non-TD state; exact-TD replacement alone leaves material non-TD residuals before GCV tapping. No unrelated layer is redesigned in this cycle.',
 requiredEvidence:td.diagnosis.requiredEvidence};
validation.tdTransitionResearch=research;
validation.verification=verification;
write('./validation-report',validation);
td.frozenHoldoutSummary=summary;
td.verification=verification;
td.dataset.maxExactBaseComponentSpreadHKD=1;
td.authorityReview={repository:'ivancww/avaplatform',ref:'main',scope:'research only; architecture/ownership, data/storage, security, Front/User/Admin and workflow preserved',
 documents:{'AGENTS.md':'0c29e6c7bdfdefeaff39188d031140f3cd7ba50d','docs/MOTHER-RULES.md':'22764350305384d9d45b6d6bf5635d276a00d59c','design-system/DESIGN-SYSTEM.md':'2208c3a0b1f0a113a312a46dfd2bc24f55114deb','docs/ava-studio-admin-authentication.md':'68dfa9906f89d4619f96d84340d8a7e1aca5251b'},appAGENTS:'No root or scoped AGENTS.md exists at the required PR head.'};
write('./td-transition-research',td);
const appendix=['','## Bounded TD continuation','',`Retained model: ${td.selectedModel}. Three candidates rejected at the immediate-row gate; no additional candidate full holdout runs.`,
 research.structuralLimit,'','## Frozen holdout summary','',
 `Leakage: ${summary.leakageStatus}; MAPE: ${summary.aggregate.MAPE}%; maximum annual error: ${summary.aggregate.maxErrorPercent}%; rows >0.10%: ${summary.aggregate.distribution['>0.10%']}; max dollar error: HKD ${summary.aggregate.maxDollarError}.`,
 '', '| Case | MAPE % | Max % | Max HKD | Worst age / PY | First >0.01% | >0.02% | >0.05% | >0.10% |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
 ...summary.holdouts.map(h=>`| ${h.caseName} | ${h.MAPE} | ${h.maxErrorPercent} | ${h.maxDollarError} | ${h.worstAge} / ${h.worstPolicyYear} | ${Object.values(h.crossings).map(x=>typeof x==='string'?x:`${x.age} / ${x.policyYear}`).join(' | ')} |`),
 '', 'Further proposal evidence is listed in td-transition-research.md. No production engine or Customer Flow change.',
 '', '## Verification', '', `Node regression tests: ${verification.nodeTests.status}. Syntax: ${verification.syntax.status}. Python syntax: ${verification.pythonSyntax.status}. Schema: ${fixtures.schemaValidation}. Fixture schedule consistency: ${fixtures.scheduleConsistency}.`,
 'Three age-100 rows say zero withdrawal but their schedule has HKD 85, 8 and 2 respectively. The frozen fixture is preserved; genuine proposals must be checked before correction.',
 'Browser / physical-device UI verification: NOT VERIFIED; no production/UI changes. This research result does not certify Platform integration.', ''];
for(const name of ['validation-report','first-divergence-report','residual-decomposition-report']) {
 if(name!=='validation-report') {
   const report=read('./'+name);report.frozenHoldoutSummary=summary;report.tdTransitionResearch=research;report.verification=verification;
   report.exactTDComponentEvaluation=td.oracleComponentEvaluation;
   if(name==='residual-decomposition-report'&&!report.classificationEvidence.includes('TD-only substitution is insufficient')) report.classificationEvidence+=' The new evaluation-only exact-TD substitution reveals that the aggregate-derived non-TD contribution also retains material error; TD-only substitution is insufficient.';
   if(name==='first-divergence-report') {
     for(const c of report.cases)if(c.classification==='premium-to-Basic mapping'&&c.firstOver010?.modelCurrentBasicAmount===c.firstOver010?.currentBasicAmount)
       c.classification='no-withdrawal base/display rounding (Basic Amount mapping matches)';
   }
   write('./'+name,report);
 }
 const path=new URL('./'+name+'.md',import.meta.url);
 let text=fs.readFileSync(path,'utf8').split('\n## Bounded TD continuation')[0];
 if(name==='first-divergence-report') text=text.replace('- Classification: premium-to-Basic mapping','- Classification: no-withdrawal base/display rounding (Basic Amount mapping matches)');
 fs.writeFileSync(path,text.trimEnd()+'\n'+appendix.join('\n'));
}
console.log(JSON.stringify({retainedModel:td.selectedModel,holdout:summary.aggregate,leakage:summary.leakageStatus}));
const tdPath=new URL('./td-transition-research.md',import.meta.url);
const tdText=fs.readFileSync(tdPath,'utf8').split('\n## Bounded TD continuation')[0];
fs.writeFileSync(tdPath,tdText.trimEnd()+'\n'+appendix.join('\n'));
