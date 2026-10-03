// Phase A / Iteration 1 only. Research approximation; never imported by production.
import { buildCalibrationModel } from './engine.js';

const keys = ['GCV', 'RB', 'TD'];
const longKeys = ['guaranteedCashValue', 'reversionaryBonusCashValue', 'terminalDividendCashValue'];
const median = xs => { const s = xs.toSorted((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const region = py => py <= 10 ? 'early' : py <= 20 ? 'middle' : 'late';

export function buildComponentStateModel(cases, evidence) {
  const calibration = cases.filter(c => c.role === 'calibration');
  const ids = new Set(calibration.map(c => c.caseId));
  // Filter BEFORE reading numeric evidence. Unassigned/regression/holdout sources excluded.
  const sources = evidence.sourceRecords.filter(s => s.usable && s.frozenRole === 'calibration' && ids.has(s.caseId));
  if (sources.length !== calibration.length) throw Error('Incomplete calibration evidence');
  const augmented = calibration.map(c => {
    const s = sources.find(s => s.caseId === c.caseId);
    if (s.metadata.initialBasicAmount !== c.initialBasicAmount || s.metadata.annualPremiumRoundedTableAnchor !== c.annualPremium) throw Error('Calibration metadata mismatch');
    return { ...c, baseCurve: s.baseRows.map(r => ({ policyYear: r.policyYear, ...Object.fromEntries(keys.map((k, i) => [longKeys[i], r[k]])) })) };
  });
  // Reuse the v4 standalone TD regression and Basic Amount reduction relationship,
  // with complete genuine calibration annual base curves. Aggregate transitions unused.
  const v4 = buildCalibrationModel(augmented);
  const factors = [], fitRows = [];
  for (const s of sources) {
    for (let i = 1; i < s.postRows.length; i++) {
      const a = s.postRows[i - 1], b = s.postRows[i], prev = s.baseRows[i - 1], next = s.baseRows[i];
      const pa = s.allocationRows[i - 1], allocation = s.allocationRows[i];
      const deficit = prev.RB - a.RB;
      if (a.basicAmount !== s.metadata.initialBasicAmount || b.basicAmount !== s.metadata.initialBasicAmount || pa.fromGCV !== 0 || allocation.fromGCV !== 0 || deficit <= 10) continue;
      const factor = (next.RB - b.RB - allocation.fromRB) / deficit;
      if (!Number.isFinite(factor) || factor < 0) throw Error('Invalid RB persistence evidence');
      factors.push(factor);
      fitRows.push({ caseId: s.caseId, previousPY: a.policyYear, policyYear: b.policyYear, factor });
    }
  }
  if (!factors.length) throw Error('No clean persistent RB evidence');
  return {
    baseAt: v4.baseAt, terminalTransitions: v4.terminalTransitions,
    reductionCoefficients: v4.reductionCoefficients,
    rbPersistence: median(factors), fitRows,
    calibrationCaseIds: [...ids], sourceIds: sources.map(s => s.sourceId),
    baseIdentityMaxResidual: Math.max(...sources.flatMap(s => s.baseRows.map(r => Math.abs(r.total - r.GCV - r.RB - r.TD))))
  };
}

export function advanceComponentState(previous, base, allocation, model, context) {
  const { policyYear, initialBasicAmount, timeSince, firstWithdrawalSeen } = context;
  const basicBefore = previous?.basicAmountState ?? initialBasicAmount;
  let gcvState = base.guaranteedCashValue, rbState = base.reversionaryBonusCashValue, tdState = base.terminalDividendCashValue;
  let carryRB = 0;
  if (previous && firstWithdrawalSeen) {
    // Persistent RB deficit, independently measured against the prior RB base.
    // Capital scaling is only applied after a genuine GCV tap reduces Basic Amount.
    const capitalScale = basicBefore / Math.max(previous.basicBefore, 1);
    carryRB = Math.max(0, previous.base.reversionaryBonusCashValue - previous.rbState) * model.rbPersistence * capitalScale;
    rbState -= carryRB;
    const previousTDBase = previous.base.terminalDividendCashValue;
    const features = [1, previous.tdState / Math.max(previousTDBase, 1), policyYear / 60,
      allocation.fromTD / Math.max(base.terminalDividendCashValue, 1),
      previous.allocation.fromTD / Math.max(previousTDBase, 1), basicBefore / initialBasicAmount,
      Math.min(timeSince, 20) / 20];
    const ratio = Math.max(0, Math.min(1.5, model.terminalTransitions[region(policyYear)].reduce((sum, c, i) => sum + c * features[i], 0)));
    tdState *= ratio;
  }
  gcvState -= allocation.fromGCV;
  rbState -= allocation.fromRB;
  tdState -= allocation.fromTD;
  let basicAmountState = basicBefore;
  if (allocation.fromGCV > 0) {
    basicAmountState = Math.max(0, basicBefore - model.reductionCoefficients[region(policyYear)] * allocation.fromGCV / Math.max(base.guaranteedCashValue / Math.max(basicBefore, 1), 1e-9));
  }
  const negativeComponents = keys.filter((k, i) => [gcvState, rbState, tdState][i] < -1);
  // Record impossible allocations rather than silently allowing negative reserve.
  gcvState = Math.max(0, gcvState); rbState = Math.max(0, rbState); tdState = Math.max(0, tdState);
  return { basicAmountState, gcvState, rbState, tdState, basicBefore, base, allocation, carryRB,
    negativeComponents, total: gcvState + rbState + tdState };
}

export function projectComponentState(input, model) {
  const schedule = new Map(input.withdrawalSchedule.map(r => [r.age, r]));
  const rows = [];
  let state = null, firstWithdrawalSeen = false, lastWithdrawalAge = null;
  for (let age = input.issueAge + 1; age <= (input.endAge ?? input.issueAge + 60); age++) {
    const policyYear = age - input.issueAge;
    const point = schedule.get(age) || {};
    const withdrawal = age >= (input.withdrawalStartAge ?? Infinity) ? Number(point.withdrawal || 0) : 0;
    const allocation = { fromGCV: withdrawal > 0 ? Number(point.withdrawalFromGuaranteedCashValue || 0) : 0,
      fromRB: withdrawal > 0 ? Number(point.withdrawalFromReversionaryBonus || 0) : 0,
      fromTD: withdrawal > 0 ? Number(point.withdrawalFromTerminalDividend || 0) : 0 };
    // Preserve the frozen historical schedule, including already audited allocation
    // inconsistencies. Never invent a component split for an unallocated withdrawal.
    const allocationResidual = withdrawal - allocation.fromGCV - allocation.fromRB - allocation.fromTD;
    const base = model.baseAt(policyYear, state?.basicAmountState ?? input.initialBasicAmount);
    state = advanceComponentState(state, base, allocation, model, { policyYear, initialBasicAmount: input.initialBasicAmount,
      timeSince: lastWithdrawalAge == null ? 20 : age - lastWithdrawalAge, firstWithdrawalSeen });
    rows.push({ age, policyYear, withdrawal, basicAmountState: state.basicAmountState,
      GCV: Math.round(state.gcvState), RB: Math.round(state.rbState), TD: Math.round(state.tdState),
      total: Math.round(state.total), noWithdrawalBaseValue: Math.round(base.total),
      negativeComponents: state.negativeComponents, carryRB: state.carryRB, allocationResidual });
    if (withdrawal > 0) { firstWithdrawalSeen = true; lastWithdrawalAge = age; }
  }
  return { rows };
}
