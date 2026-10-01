// Phase A / Iteration 2 only. Research approximation; never imported by production.
import { buildComponentStateModel as buildIteration1Model } from './component-state.js';

const componentKeys = ['GCV', 'RB', 'TD'];
const region = py => py <= 10 ? 'early' : py <= 20 ? 'middle' : 'late';

export function buildIteration2Model(cases, evidence) {
  // Iteration 1 already enforces the calibration/evidence firewall before it
  // constructs the genuine annual bases and the retained v4 TD transition.
  const prior = buildIteration1Model(cases, evidence);
  const calibrationIds = new Set(prior.calibrationCaseIds);
  const sources = evidence.sourceRecords.filter(s => s.usable && s.frozenRole === 'calibration' && calibrationIds.has(s.caseId));
  const rbTransitionRows = [];
  for (const source of sources) {
    const initialBasicAmount = source.metadata.initialBasicAmount;
    let affected = false;
    for (let index = 1; index < source.postRows.length; index++) {
      const previous = source.postRows[index - 1];
      const current = source.postRows[index];
      const previousBase = source.baseRows[index - 1];
      const currentBase = source.baseRows[index];
      const allocation = source.allocationRows[index];
      if (source.allocationRows[index - 1].total > 0) affected = true;
      if (!affected) continue;
      const currentBasicAmount = current.basicAmount;
      const annualAccrual = (currentBase.RB - previousBase.RB) * currentBasicAmount / initialBasicAmount;
      const predicted = previous.RB + annualAccrual - allocation.fromRB;
      rbTransitionRows.push({
        caseId: source.caseId, previousPolicyYear: previous.policyYear, policyYear: current.policyYear,
        currentBasicAmount, annualAccrual, genuine: current.RB, predicted,
        dollarError: predicted - current.RB
      });
    }
  }
  if (!rbTransitionRows.length) throw Error('No calibration RB annual-increment evidence');
  return {
    baseAt: prior.baseAt,
    terminalTransitions: prior.terminalTransitions,
    reductionCoefficients: prior.reductionCoefficients,
    rbTransition: 'previous RB after withdrawal + annual no-withdrawal RB curve increment at current Basic Amount - current RB withdrawal',
    rbTransitionRows,
    calibrationCaseIds: prior.calibrationCaseIds,
    sourceIds: prior.sourceIds,
    baseIdentityMaxResidual: prior.baseIdentityMaxResidual
  };
}

export function advanceIteration2State(previous, base, allocation, model, context) {
  const { policyYear, initialBasicAmount, timeSince, firstWithdrawalSeen } = context;
  const basicBefore = previous?.basicAmountState ?? initialBasicAmount;
  let gcvState = base.guaranteedCashValue;
  let rbState = base.reversionaryBonusCashValue;
  let tdState = base.terminalDividendCashValue;
  let rbAccrual = 0;
  if (previous && firstWithdrawalSeen) {
    const priorBaseAtCurrentCapital = model.baseAt(policyYear - 1, basicBefore);
    rbAccrual = base.reversionaryBonusCashValue - priorBaseAtCurrentCapital.reversionaryBonusCashValue;
    rbState = previous.rbState + rbAccrual;

    // Preserve Iteration 1's independent v4 TD transition unchanged. This
    // iteration introduces no TD coefficient, feature or fitting family.
    const previousTDBase = previous.base.terminalDividendCashValue;
    const features = [1, previous.tdState / Math.max(previousTDBase, 1), policyYear / 60,
      allocation.fromTD / Math.max(base.terminalDividendCashValue, 1),
      previous.allocation.fromTD / Math.max(previousTDBase, 1), basicBefore / initialBasicAmount,
      Math.min(timeSince, 20) / 20];
    const ratio = Math.max(0, Math.min(1.5,
      model.terminalTransitions[region(policyYear)].reduce((sum, coefficient, index) => sum + coefficient * features[index], 0)));
    tdState *= ratio;
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
  gcvState = Math.max(0, gcvState);
  rbState = Math.max(0, rbState);
  tdState = Math.max(0, tdState);
  return { basicAmountState, gcvState, rbState, tdState, basicBefore, base, allocation, rbAccrual,
    negativeComponents, total: gcvState + rbState + tdState };
}

export function projectIteration2(input, model) {
  const schedule = new Map(input.withdrawalSchedule.map(row => [row.age, row]));
  const rows = [];
  let state = null;
  let firstWithdrawalSeen = false;
  let lastWithdrawalAge = null;
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
    state = advanceIteration2State(state, base, allocation, model, {
      policyYear, initialBasicAmount: input.initialBasicAmount,
      timeSince: lastWithdrawalAge == null ? 20 : age - lastWithdrawalAge,
      firstWithdrawalSeen
    });
    rows.push({ age, policyYear, withdrawal, basicAmountState: state.basicAmountState,
      GCV: Math.round(state.gcvState), RB: Math.round(state.rbState), TD: Math.round(state.tdState),
      total: Math.round(state.total), noWithdrawalBaseValue: Math.round(base.total),
      negativeComponents: state.negativeComponents, rbAccrual: state.rbAccrual, allocationResidual });
    if (withdrawal > 0) {
      firstWithdrawalSeen = true;
      lastWithdrawalAge = age;
    }
  }
  return { rows };
}
