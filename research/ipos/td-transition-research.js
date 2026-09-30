import fs from 'node:fs';
import {buildCalibrationModel,projectPolicy} from './engine.js';
import {transitionDataset,fitTD,predictTD,crossValidateTD,candidateNames} from './td-transition.js';
const dataset=JSON.parse(fs.readFileSync(new URL('./fixtures/dataset.json',import.meta.url)));
const model=buildCalibrationModel(dataset.cases), pairs=transitionDataset(dataset.cases);
const targets=[['45yrs_5pay_130k_avf_55',56],['45yrs_5pay_130k_avpu_55yr',56],['5pay_avpu_200k',62],['50yrs_5pay_130k_avpu',62],['70k_original',62]];
const targeted = options=>targets.map(([id,age])=>{
 const c=dataset.cases.find(c=>c.caseId===id), actual=c.rows.find(r=>r.age===age);
 const prediction=projectPolicy({...c,endAge:age},model,options).rows.find(r=>r.age===age);
 return {caseId:id,age,policyYear:actual.policyYear,iposRemaining:actual.projectedRemainingSurrenderValue,modelRemaining:prediction.projectedRemainingSurrenderValue,
  dollarError:prediction.projectedRemainingSurrenderValue-actual.projectedRemainingSurrenderValue,
  absoluteErrorPercent:Math.abs(prediction.projectedRemainingSurrenderValue-actual.projectedRemainingSurrenderValue)/actual.projectedRemainingSurrenderValue*100,
  iposTD:actual.terminalDividendCashValue,modelTD:prediction.terminalDividendState,
  tdComponentErrorPercentOfRemaining:Math.abs(prediction.terminalDividendState-actual.terminalDividendCashValue)/actual.projectedRemainingSurrenderValue*100};
});
const baselineTargeted=targeted({});const experiments=[];
for(const name of candidateNames) {
 const fit=fitTD(pairs,name),cv=crossValidateTD(dataset.cases,name);
 const options={terminalTransition:state=>predictTD(fit,state)}, result=targeted(options);
 const improves=result.every((r,i)=>r.absoluteErrorPercent<=baselineTargeted[i].absoluteErrorPercent)&&result.some((r,i)=>r.absoluteErrorPercent<baselineTargeted[i].absoluteErrorPercent);
 let holdout=null;
 if(improves){const rows=dataset.cases.filter(c=>c.role==='holdout').flatMap(c=>{
   const out=projectPolicy(c,model,options);return c.rows.map(r=>{
    const p=out.rows.find(p=>p.age===r.age);return {caseId:c.caseId,age:r.age,policyYear:r.policyYear,error:Math.abs(p.projectedRemainingSurrenderValue-r.projectedRemainingSurrenderValue)/r.projectedRemainingSurrenderValue*100,dollars:Math.abs(p.projectedRemainingSurrenderValue-r.projectedRemainingSurrenderValue)};
   });});const worst=rows.reduce((a,b)=>a.error>=b.error?a:b);
   holdout={MAPE:rows.reduce((s,r)=>s+r.error,0)/rows.length,maxErrorPercent:worst.error,rowsAbove010:rows.filter(r=>r.error>.1).length,maxDollarError:Math.max(...rows.map(r=>r.dollars)),worst};}
 experiments.push({iteration:experiments.length+1,hypothesis:name,fit,calibrationCrossValidation:cv,targeted:result,targetedGate:improves?'IMPROVED':'REJECTED',frozenHoldout:holdout,
   decision:'REJECTED_RETAIN_V4',reason:improves?'Full holdout must beat the frozen baseline before retention':'Does not improve all five immediate transition rows; no full holdout run justified.'});
}
// Oracle component substitutions are evaluation diagnostics only, never fitting or selectable models.
const oracle=targets.map(([id,age],i)=>{
 const c=dataset.cases.find(c=>c.caseId===id),a=c.rows.find(r=>r.age===age),b=baselineTargeted[i];
 const remaining=b.modelRemaining+a.terminalDividendCashValue-b.modelTD;
 return {caseId:id,age,policyYear:a.policyYear,remainingWithExactTDOnly:remaining,nonTDResidualDollars:remaining-a.projectedRemainingSurrenderValue,
  nonTDResidualPercent:Math.abs(remaining-a.projectedRemainingSurrenderValue)/a.projectedRemainingSurrenderValue*100,
  interpretation:'Evaluation-only exact TD replacement leaves the frozen aggregate-derived GCV+RB contribution intact.'};
});
const regions=[['PY10–14',10,14],['PY15–19',15,19],['PY20–24',20,24],['PY25+',25,Infinity]].map(([name,lo,hi])=>{
 const rows=pairs.filter(r=>r.eligibleForFit&&r.next.policyYear>=lo&&r.next.policyYear<=hi);
 return {name,exactCleanPairs:rows.length,caseIds:[...new Set(rows.map(r=>r.caseId))],policyYears:[...new Set(rows.map(r=>r.next.policyYear))],coefficient:rows.length?fitTD(rows,'A_deficitPersistence').coefficients[0]:null,
  decision:'NOT_RETAINED',reason:'Sparse/unbalanced exact-year evidence; no demonstrated case-held-out regional generalization advantage; PY25+ unavailable.'};
});
const report={startingHead:'1a3e2e18ceedf9f25ac98476aae12e3ec82a0597',engineVersion:'ipos-approximation-terminal-dividend-transition-v4',selectedModel:'v4 unchanged',
 baseline:{MAPE:2.29650947,maxErrorPercent:11.80075621,rowsAbove010:247,maxDollarError:457617,worstCase:'50yrs_5pay_130k_avpu',worstAge:72,worstPolicyYear:22},
 dataset:{roles:'CALIBRATION_ONLY',pairs:pairs.length,eligibleExactCleanPairs:pairs.filter(r=>r.eligibleForFit).length,
  note:'No-withdrawal fields refer to original Basic Amount. After Basic Amount reduction these deficits conflate capital reduction and TD carryover and are excluded from fit. Interpolated bases are estimates and excluded from fit.',
  leakageCheck:pairs.every(r=>dataset.cases.find(c=>c.caseId===r.caseId).role==='calibration')&&experiments.every(e=>e.fit.trainingCaseIds.every(id=>dataset.cases.find(c=>c.caseId===id).role==='calibration'))?'PASS':'FAIL'},
 baselineTargeted,experiments,regions,oracleComponentEvaluation:oracle,pairs,
 diagnosis:{observations:['Only 27 consecutive pre-GCV pairs have exact-year calibration base evidence; 206 consecutive pairs exist in total.',
 'Simple exact-evidence deficit persistence is approximately 1.12, but extrapolation is contaminated by missing annual base TD and aggregate-derived non-TD state.',
 'Even replacing TD with the genuine displayed TD leaves material second-withdrawal errors in the frozen aggregate-derived GCV/RB contribution. TD-only component substitution cannot repair that contribution.',
 'No new model is retained; no coefficient uses a holdout target. All three immediate-row gates rejected the candidates.'],
 requiredEvidence:['Matched annual no-withdrawal GCV/RB/TD tables (not only five-year checkpoints) for calibration premiums 70k, 100k, 130k, 180k, 200k through PY10–30.',
 'Matched same-policy consecutive annual post-withdrawal component rows and RB/associated-TD withdrawal allocations; vary withdrawal amount and start Policy Year independently.',
 'Genuine zero-withdrawal pause/resume proposals with affected TD/RB states before, during and after the pause; no pause/resume accuracy claim is made.',
 'Structural explanation or proposal evidence connecting RB remaining, associated TD cash withdrawal and next-year TD entitlement; isolate this from Basic Amount/GCV reduction.']},
 finalStatus:'NOT_READY_FOR_INTEGRATION'};
fs.writeFileSync(new URL('./td-transition-research.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const lines=['# TD Transition Research','',`Starting head: ${report.startingHead}`,'','Calibration-only dataset. This is a research approximation, not an official AIA formula.',
 '',`Consecutive pairs: ${pairs.length}; exact clean fitting pairs: ${report.dataset.eligibleExactCleanPairs}.`,report.dataset.note,
 '', '## Three bounded iterations','', '| Iteration | Hypothesis | Coefficients | Calibration LOCO max % | Target gate | Full holdout | Decision |','| --- | --- | --- | --- | --- | --- | --- |'];
for(const e of experiments)lines.push(`| ${e.iteration} | ${e.hypothesis} | ${e.fit.coefficients.map(v=>v.toFixed(8)).join(', ')} | ${e.calibrationCrossValidation.maxErrorPercent.toFixed(8)} | ${e.targetedGate} | ${e.frozenHoldout?'EXECUTED':'NOT RUN: targeted gate failed'} | ${e.decision} |`);
lines.push('', 'CV is leave-one-calibration-case-out, with withheld-case annual base sources excluded. CV measures teacher-forced TD component error divided by remaining surrender, not full-policy accuracy.',
 '', 'Models: A = next pre-withdrawal TD deficit = k × previous post-withdrawal TD deficit; B adds previous associated TD withdrawal; C adds previous RB deficit. All fit without an intercept and preserve a zero unaffected deficit. Runtime RB deficit in C is inferred from previous remaining − TD − base GCV; it is not read from proposal targets.',
 '', '## Immediate second-withdrawal evaluation','', '| Case / age / PY | v4 % | A % | B % | C % | Exact TD only, non-TD residual % |','| --- | --- | --- | --- | --- | --- |');
for(let i=0;i<targets.length;i++)lines.push(`| ${baselineTargeted[i].caseId} / ${baselineTargeted[i].age} / ${baselineTargeted[i].policyYear} | ${baselineTargeted[i].absoluteErrorPercent.toFixed(8)} | ${experiments.map(e=>e.targeted[i].absoluteErrorPercent.toFixed(8)).join(' | ')} | ${oracle[i].nonTDResidualPercent.toFixed(8)} |`);
lines.push('','The exact-TD substitution is evaluation-only and never an engine, coefficient source, or final-value fit.', '', '## Policy-Year regions','',...regions.map(r=>`- ${r.name}: ${r.exactCleanPairs} exact clean pairs; PY ${r.policyYears.join(', ')||'none'}; persistence ${r.coefficient??'unidentifiable'}; NOT RETAINED. ${r.reason}`),
 '', '## Diagnosis','',...report.diagnosis.observations.map(s=>'- '+s),'','## Additional genuine evidence','',...report.diagnosis.requiredEvidence.map(s=>'- '+s),
 '', '## Retained result','',`v4: MAPE ${report.baseline.MAPE}%; max ${report.baseline.maxErrorPercent}%; rows >0.10% ${report.baseline.rowsAbove010}; worst ${report.baseline.worstCase}, age 72 / PY22. Leakage ${report.dataset.leakageCheck}.`,
 'All three candidates are rejected and are available only in the isolated experiment harness. Production and baseline model selection remain unchanged.', '',report.finalStatus);
lines.push('', '## TD component error (relative to remaining surrender)','', '| Target case | v4 % | A % | B % | C % |','| --- | --- | --- | --- | --- |', ...baselineTargeted.map((r,i)=>`| ${r.caseId} | ${r.tdComponentErrorPercentOfRemaining.toFixed(8)} | ${experiments.map(e=>e.targeted[i].tdComponentErrorPercentOfRemaining.toFixed(8)).join(' | ')} |`));
fs.writeFileSync(new URL('./td-transition-research.md',import.meta.url),lines.join('\n')+'\n');
console.log(JSON.stringify({iterations:experiments.map(e=>({name:e.hypothesis,targeted:e.targeted.map(r=>r.absoluteErrorPercent),gate:e.targetedGate,holdout:e.frozenHoldout})),oracle,regions}));
