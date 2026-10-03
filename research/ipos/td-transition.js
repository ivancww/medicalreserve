// Calibration-only, component-level TD experiments. No production import.
import { buildCalibrationModel } from './engine.js';
const components = ['guaranteedCashValue', 'reversionaryBonusCashValue', 'terminalDividendCashValue'];
const avg = xs => xs.reduce((a,b)=>a+b,0)/xs.length;
export function exactBasePool(cases) {
  const pool = new Map();
  const add = (c,r,source) => {
    const key = `${c.annualPremium}:${r.policyYear}`;
    const list = pool.get(key) || []; list.push({ ...r, sourceCaseId:c.caseId, source }); pool.set(key,list);
  };
  for(const c of cases.filter(c=>c.role==='calibration')) {
    c.baseCurve.forEach(r=>add(c,r,'proposalBaseCheckpoint'));
    let affected=false;
    for(const r of c.rows) {
      if(r.withdrawalType==='fullSurrender') continue;
      const s=c.withdrawalSchedule.find(s=>s.age===r.age);
      if(!affected && r.withdrawal===0) add(c,r,'unaffectedProposalAnnualRow');
      if(!affected && r.withdrawal>0 && s && components.every(k=>Number.isFinite(r[k]))) {
        add(c,{policyYear:r.policyYear,
          guaranteedCashValue:r.guaranteedCashValue+s.withdrawalFromGuaranteedCashValue,
          reversionaryBonusCashValue:r.reversionaryBonusCashValue+s.withdrawalFromReversionaryBonus,
          terminalDividendCashValue:r.terminalDividendCashValue+s.withdrawalFromTerminalDividend},'firstWithdrawalComponentReconstruction');
      }
      if(r.withdrawal>0) affected=true;
    }
  }
  return pool;
}
export function transitionDataset(cases) {
  const calibration=cases.filter(c=>c.role==='calibration');
  const model=buildCalibrationModel(calibration), pool=exactBasePool(calibration);
  const rows=[];
  for(const c of calibration) {
    const schedules=new Map(c.withdrawalSchedule.map(r=>[r.age,r]));
    const point = r => {
      const sources=pool.get(`${c.annualPremium}:${r.policyYear}`);
      const base=sources ? Object.fromEntries(components.map(k=>[k,avg(sources.map(r=>r[k]))])) : model.baseAt(r.policyYear,c.initialBasicAmount);
      const s=schedules.get(r.age);
      return {age:r.age,policyYear:r.policyYear,basicAmount:r.basicAmountAfterWithdrawal,
        noWithdrawalGCV:base.guaranteedCashValue,noWithdrawalRB:base.reversionaryBonusCashValue,noWithdrawalTD:base.terminalDividendCashValue,
        baseEvidence:sources ? 'calibrationProposalExactYearWithinDisplayRounding' : 'calibrationCurveInterpolation_ESTIMATE',
        baseSources:sources?.map(s=>({caseId:s.sourceCaseId,source:s.source})) || [],
        withdrawal:r.withdrawal,withdrawalFromRB:s?.withdrawalFromReversionaryBonus??null,
        withdrawalFromAssociatedTD:s?.withdrawalFromTerminalDividend??null,withdrawalFromGCV:s?.withdrawalFromGuaranteedCashValue??null,
        displayedPostWithdrawalGCV:r.guaranteedCashValue,displayedPostWithdrawalRB:r.reversionaryBonusCashValue,
        displayedPostWithdrawalTD:r.terminalDividendCashValue,remainingSurrenderValue:r.projectedRemainingSurrenderValue};
    };
    for(let i=1;i<c.rows.length;i++) {
      const a=c.rows[i-1],b=c.rows[i];
      if(a.withdrawalType!=='medicalWithdrawal'||b.withdrawalType!=='medicalWithdrawal'||a.withdrawal<=0||b.withdrawal<=0||b.policyYear!==a.policyYear+1)continue;
      const t=point(a),next=point(b);
      const deficit=t.noWithdrawalTD-t.displayedPostWithdrawalTD;
      const nextPreDeficit=next.noWithdrawalTD-next.displayedPostWithdrawalTD-next.withdrawalFromAssociatedTD;
      const clean=t.basicAmount===c.initialBasicAmount&&next.basicAmount===c.initialBasicAmount&&t.withdrawalFromGCV===0&&next.withdrawalFromGCV===0;
      const exact=t.baseSources.length>0&&next.baseSources.length>0;
      rows.push({caseId:c.caseId,role:'calibration',annualPremium:c.annualPremium,initialBasicAmount:c.initialBasicAmount,t,next,
        eligibleForFit:clean&&exact,
        exclusionReason:!clean?'GCV_OR_BASIC_AMOUNT_TRANSITION':!exact?'INTERPOLATED_BASE_NOT_GENUINE_ANNUAL_EVIDENCE':null,
        derived:{tdShockAtT:t.withdrawalFromAssociatedTD,postTDDeficitAtT:deficit,preWithdrawalTDDeficitAtNext:nextPreDeficit,
          postTDDeficitAtNext:next.noWithdrawalTD-next.displayedPostWithdrawalTD,
          recoveryAtNext:deficit-nextPreDeficit,persistenceFactor:deficit?nextPreDeficit/deficit:null,
          deficitPerBasic:deficit/c.initialBasicAmount,deficitPerPreviousTD:deficit/Math.max(t.noWithdrawalTD,1),
          shockPerBasic:t.withdrawalFromAssociatedTD/c.initialBasicAmount,shockPerPreviousTD:t.withdrawalFromAssociatedTD/Math.max(t.noWithdrawalTD,1),
          nextPreDeficitPerPreviousTD:nextPreDeficit/Math.max(t.noWithdrawalTD,1),
          nextDeficitPerAssociatedTDWithdrawal:t.withdrawalFromAssociatedTD?nextPreDeficit/t.withdrawalFromAssociatedTD:null,
          nextDeficitPerPreviousTotalWithdrawal:nextPreDeficit/t.withdrawal,
          previousRBDeficit:t.noWithdrawalRB-t.displayedPostWithdrawalRB,
          previousRemainingBaseRatio:t.remainingSurrenderValue/(t.noWithdrawalGCV+t.noWithdrawalRB+t.noWithdrawalTD)}});
    }
  }
  return rows;
}
function solve(rows,features) {
  const n=features(rows[0]).length, matrix=Array.from({length:n},()=>Array(n+1).fill(0));
  for(const r of rows) {const x=features(r), y=r.derived.preWithdrawalTDDeficitAtNext/r.initialBasicAmount;
    x.forEach((v,i)=>{x.forEach((w,j)=>matrix[i][j]+=v*w);matrix[i][n]+=v*y;});}
  for(let i=0;i<n;i++) {let p=i;for(let j=i+1;j<n;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[p][i]))p=j;
    [matrix[i],matrix[p]]=[matrix[p],matrix[i]];if(Math.abs(matrix[i][i])<1e-14)throw Error('Unidentifiable TD coefficients');
    const divisor=matrix[i][i];matrix[i]=matrix[i].map(v=>v/divisor);
    for(let j=0;j<n;j++)if(j!==i){const v=matrix[j][i];matrix[j]=matrix[j].map((w,k)=>w-v*matrix[i][k]);}}
  return matrix.map(r=>r[n]);
}
export const candidateNames=['A_deficitPersistence','B_deficitAndAssociatedShock','C_deficitAndRBDepletion'];
export function tdFeatures(name,deficit,associated,rbDeficit,basic) {
  const x=[deficit/basic];
  if(name==='B_deficitAndAssociatedShock')x.push(associated/basic);
  if(name==='C_deficitAndRBDepletion')x.push(rbDeficit/basic);
  return x;
}
export function fitTD(rows,name) {
  const eligible=rows.filter(r=>r.eligibleForFit);
  const coefficients=solve(eligible,r=>tdFeatures(name,r.derived.postTDDeficitAtT,r.t.withdrawalFromAssociatedTD,r.derived.previousRBDeficit,r.initialBasicAmount));
  return {name,coefficients,trainingRows:eligible.length,trainingCaseIds:[...new Set(eligible.map(r=>r.caseId))]};
}
export function predictTD(fit,{base,previousBase,previousTerminal,previousAssociated,previousRemaining,basic}) {
  const deficit=previousBase.terminalDividendCashValue-previousTerminal;
  const impliedRB=previousRemaining-previousTerminal-previousBase.guaranteedCashValue;
  const rbDeficit=previousBase.reversionaryBonusCashValue-impliedRB;
  const x=tdFeatures(fit.name,deficit,previousAssociated,rbDeficit,basic);
  return base.terminalDividendCashValue-basic*x.reduce((sum,v,i)=>sum+v*fit.coefficients[i],0);
}
export function crossValidateTD(cases,name) {
  const folds=[];
  for(const c of cases.filter(c=>c.role==='calibration')) {
    const training=cases.filter(x=>x.role==='calibration'&&x.caseId!==c.caseId);
    const rows=transitionDataset(training);let fit;
    try{fit=fitTD(rows,name);}catch(e){folds.push({caseId:c.caseId,blocked:e.message});continue;}
    // Validation points use only annual bases supplied by OTHER calibration cases.
    const pool=exactBasePool(training);
    const evaluated=transitionDataset([c,...training]).filter(r=>r.caseId===c.caseId&&r.eligibleForFit&&
      pool.has(`${c.annualPremium}:${r.t.policyYear}`)&&pool.has(`${c.annualPremium}:${r.next.policyYear}`));
    const errors=evaluated.map(r=>{
      const prev=pool.get(`${c.annualPremium}:${r.t.policyYear}`),next=pool.get(`${c.annualPremium}:${r.next.policyYear}`);
      const prevTD=avg(prev.map(r=>r.terminalDividendCashValue)),nextTD=avg(next.map(r=>r.terminalDividendCashValue));
      const prevRB=avg(prev.map(r=>r.reversionaryBonusCashValue));
      const x=tdFeatures(name,prevTD-r.t.displayedPostWithdrawalTD,r.t.withdrawalFromAssociatedTD,prevRB-r.t.displayedPostWithdrawalRB,r.initialBasicAmount);
      const predicted=nextTD-r.initialBasicAmount*x.reduce((sum,v,i)=>sum+v*fit.coefficients[i],0)-r.next.withdrawalFromAssociatedTD;
      return Math.abs(predicted-r.next.displayedPostWithdrawalTD)/r.next.remainingSurrenderValue*100;
    });
    folds.push({caseId:c.caseId,rows:errors.length,MAPE:errors.length?avg(errors):null,maxErrorPercent:errors.length?Math.max(...errors):null,errors});
  }
  const errors=folds.flatMap(f=>f.errors||[]);
  return {method:'leave-one-calibration-case-out; base sources exclude withheld case; teacher-forced TD component error / remaining surrender',rows:errors.length,MAPE:avg(errors),maxErrorPercent:Math.max(...errors),folds};
}
