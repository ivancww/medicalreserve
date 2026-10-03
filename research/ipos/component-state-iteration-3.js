// Phase A / Iteration 3 only. Research approximation; never imported by production.
import { buildComponentStateModel as buildIteration1Model } from './component-state.js';

const componentKeys = ['GCV', 'RB', 'TD'];
const region = policyYear => policyYear <= 10 ? 'early' : policyYear <= 20 ? 'middle' : 'late';

export function buildIteration3Model(cases, evidence) {
  const prior = buildIteration1Model(cases, evidence);
  const calibrationIds = new Set(prior.calibrationCaseIds);
  const sources = evidence.sourceRecords.filter(source => source.usable &&
    source.frozenRole === 'calibration' && calibrationIds.has(source.caseId));
  const tdTransitionRows = [];
  for (const source of sources) {
    const initialBasicAmount = source.metadata.initialBasicAmount;
    let affected = false;
    let firstAffectedPolicyYear = null;
    let priorGCVTapSeen = false;
    for (let index = 1; index < source.postRows.length; index++) {
      const previous = source.postRows[index - 1];
      const current = source.postRows[index];
      const previousBase = source.baseRows[index - 1];
      const currentBase = source.baseRows[index];
      const previousAllocation = source.allocationRows[index - 1];
      const allocation = source.allocationRows[index];
      if (previousAllocation.total > 0) {
        affected = true;
        firstAffectedPolicyYear ??= previous.policyYear;
      }
      if (previousAllocation.fromGCV > 0) priorGCVTapSeen = true;
      if (!affected) continue;
      const basicAmountEnteringYear = previous.basicAmount;
      const tdAccrual = (currentBase.TD - previousBase.TD) * basicAmountEnteringYear / initialBasicAmount;
      const predicted = previous.TD + tdAccrual - allocation.fromTD;
      tdTransitionRows.push({
        caseId: source.caseId, previousPolicyYear: previous.policyYear, policyYear: current.policyYear,
        horizonAfterFirstAffectedYear: current.policyYear - firstAffectedPolicyYear,
        basicAmountEnteringYear, afterPriorGCVTap: priorGCVTapSeen, tdAccrual,
        genuine: current.TD, predicted, dollarError: predicted - current.TD,
        impossiblePreClampTD: predicted < -1
      });
    }
  }
  if (!tdTransitionRows.length) throw Error('No calibration TD carried-state evidence');
  return {
    baseAt: prior.baseAt,
    reductionCoefficients: prior.reductionCoefficients,
    rbPersistence: prior.rbPersistence,
    rbFitRows: prior.fitRows,
    tdTransition: 'previous TD after withdrawal + annual no-withdrawal TD curve increment at Basic Amount entering the year - current associated TD withdrawal',
    tdFreeParameters: 0,
    tdTransitionRows,
    calibrationCaseIds: prior.calibrationCaseIds,
    sourceIds: prior.sourceIds,
    baseIdentityMaxResidual: prior.baseIdentityMaxResidual
  };
}

export function advanceIteration3State(previous, base, allocation, model, context) {
  const { policyYear, initialBasicAmount, firstWithdrawalSeen } = context;
  const basicBefore = previous?.basicAmountState ?? initialBasicAmount;
  let gcvState = base.guaranteedCashValue;
  let rbState = base.reversionaryBonusCashValue;
  let tdState = base.terminalDividendCashValue;
  let carryRB = 0;
  let tdAccrual = 0;
  if (previous && firstWithdrawalSeen) {
    // Restore Iteration 1 RB exactly; no Iteration 3 RB fitting or parameter.
    const capitalScale = basicBefore / Math.max(previous.basicBefore, 1);
    carryRB = Math.max(0, previous.base.reversionaryBonusCashValue - previous.rbState) *
      model.rbPersistence * capitalScale;
    rbState -= carryRB;

    // Both annual TD curve points use the Basic Amount entering this policy
    // year, before the current withdrawal and its possible GCV tap.
    const previousBaseAtEnteringCapital = model.baseAt(policyYear - 1, basicBefore);
    tdAccrual = base.terminalDividendCashValue - previousBaseAtEnteringCapital.terminalDividendCashValue;
    tdState = previous.tdState + tdAccrual;
  }
  gcvState -= allocation.fromGCV;
  rbState -= allocation.fromRB;
  tdState -= allocation.fromTD;
  let basicAmountState = basicBefore;
  if (allocation.fromGCV > 0) {
    basicAmountState = Math.max(0, basicBefore - model.reductionCoefficients[region(policyYear)] * allocation.fromGCV /
      Math.max(base.guaranteedCashValue / Math.max(basicBefore, 1), 1e-9));
  }
  const rawStates = [gcvState, rbState, tdState];
  const negativeComponents = componentKeys.filter((key, index) => rawStates[index] < -1);
  const invalidBasicAmount = !Number.isFinite(basicAmountState) || basicAmountState < 0;
  gcvState = Math.max(0, gcvState);
  rbState = Math.max(0, rbState);
  tdState = Math.max(0, tdState);
  return { basicAmountState, gcvState, rbState, tdState, basicBefore, base, allocation,
    carryRB, tdAccrual, negativeComponents, invalidBasicAmount,
    total: gcvState + rbState + tdState };
}

export function projectIteration3(input, model) {
  const schedule = new Map(input.withdrawalSchedule.map(row => [row.age, row]));
  const rows = [];
  let state = null;
  let firstWithdrawalSeen = false;
  for (let age = input.issueAge + 1; age <= (input.endAge ?? input.issueAge + 60); age++) {
    const policyYear = age - input.issueAge;
    const point = schedule.get(age) || {};
    const withdrawal = age >= (input.withdrawalStartAge ?? Infinity) ? Number(point.withdrawal || 0) : 0;
    const allocation = {
      fromGCV: withdrawal > 0 ? Number(point.withdrawalFromGuaranteedCashValue || 0) : 0,
      fromRB: withdrawal > 0 ? Number(point.withdrawalFromReversionaryBonus || 0) : 0,
      fromTD: withdrawal > 0 ? Number(point.withdrawalFromTerminalDividend || 0) : 0
    };
    const allocationResidual = withdrawal - allocation.fromGCV - allocation.fromRB - allocation.fromTD;
    const base = model.baseAt(policyYear, state?.basicAmountState ?? input.initialBasicAmount);
    state = advanceIteration3State(state, base, allocation, model, {
      policyYear, initialBasicAmount: input.initialBasicAmount, firstWithdrawalSeen
    });
    const rounded = { GCV: Math.round(state.gcvState), RB: Math.round(state.rbState), TD: Math.round(state.tdState) };
    const total = Math.round(state.total);
    rows.push({ age, policyYear, withdrawal, basicAmountState: state.basicAmountState,
      ...rounded, total, noWithdrawalBaseValue: Math.round(base.total),
      negativeComponents: state.negativeComponents, invalidBasicAmount: state.invalidBasicAmount,
      componentTotalResidual: total - rounded.GCV - rounded.RB - rounded.TD,
      carryRB: state.carryRB, tdAccrual: state.tdAccrual, allocationResidual });
    if (withdrawal > 0) firstWithdrawalSeen = true;
  }
  return { rows };
}
