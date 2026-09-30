// Re-evaluate unchanged v4 only; no candidate fitting, tuning, or production imports.
import fs from 'node:fs';
import {buildCalibrationModel,projectPolicy} from './engine.js';
const dataset=JSON.parse(fs.readFileSync(new URL('./fixtures/dataset.json',import.meta.url)));
const model=buildCalibrationModel(dataset.cases);
const targets=[['45yrs_5pay_130k_avf_55',56],['45yrs_5pay_130k_avpu_55yr',56],['5pay_avpu_200k',62],['50yrs_5pay_130k_avpu',62],['70k_original',62]];
const diagnostics=targets.map(([caseId,age])=>{
 const c=dataset.cases.find(c=>c.caseId===caseId),out=projectPolicy({...c,endAge:age},model).rows.at(-1);
 const base=model.baseAt(out.policyYear,c.initialBasicAmount);
 // The v4 equation is ratio*(base GCV + base RB) + TD; it stores no independent GCV/RB states.
 const nonTD=out.projectedRemainingSurrenderValue-out.terminalDividendState;
 const impliedRatio=nonTD/(base.guaranteedCashValue+base.reversionaryBonusCashValue);
 return {caseId,age,policyYear:out.policyYear,total:out.projectedRemainingSurrenderValue,
  basicAmount:out.basicAmountAfterWithdrawal,TD:out.terminalDividendState,aggregateNonTD:nonTD,
  impliedGCV:base.guaranteedCashValue*impliedRatio,impliedRB:base.reversionaryBonusCashValue*impliedRatio,
  contributionMeaning:'GCV/RB are algebraically implied by the shared aggregate ratio, not independently maintained model states; reconstructed from rounded total and TD (HKD 1 precision).',base};
});
const rows=dataset.cases.filter(c=>c.role==='holdout').flatMap(c=>{
 const p=new Map(projectPolicy(c,model).rows.map(r=>[r.age,r]));
 return c.rows.map(r=>({caseId:c.caseId,age:r.age,policyYear:r.policyYear,dollars:Math.abs(p.get(r.age).projectedRemainingSurrenderValue-r.projectedRemainingSurrenderValue),error:Math.abs(p.get(r.age).projectedRemainingSurrenderValue-r.projectedRemainingSurrenderValue)/r.projectedRemainingSurrenderValue*100}));
});
const worst=rows.reduce((a,b)=>a.error>=b.error?a:b);
const metrics={MAPE:Number((rows.reduce((s,r)=>s+r.error,0)/rows.length).toFixed(8)),maxErrorPercent:Number(worst.error.toFixed(8)),rowsAbove010:rows.filter(r=>r.error>.10).length,annualRows:rows.length,maxDollarError:Math.max(...rows.map(r=>r.dollars)),worstCase:worst.caseId,worstAge:worst.age,worstPolicyYear:worst.policyYear,leakage:model.calibrationCaseIds.every(id=>dataset.cases.find(c=>c.caseId===id).role==='calibration')?'PASS':'FAIL'};
if(metrics.MAPE!==2.29650947||metrics.maxErrorPercent!==11.80075621||metrics.rowsAbove010!==247||metrics.leakage!=='PASS')throw Error('STOP: frozen v4 metrics changed unexpectedly');
const result={engineVersion:'ipos-approximation-terminal-dividend-transition-v4',metrics,diagnostics};
if(!process.argv[2])throw Error('Specify a scratch output path');
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(metrics));
