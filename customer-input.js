export function formatMoneyInput(value) {
  if (value == null || value === '') return '';
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
}

export function parseMoneyInput(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}

export function validateSupportAgeRange({ start, end, minimum, maximum }) {
  if (!Number.isInteger(start) || start < minimum || start > maximum) {
    return { ok: false, message: `預計開始年歲必須是 ${minimum}–${maximum} 歲的整數。` };
  }
  if (!Number.isInteger(end) || end < minimum || end > maximum) {
    return { ok: false, message: `預計終結年歲必須是 ${minimum}–${maximum} 歲的整數。` };
  }
  if (end < start) return { ok: false, message: '預計終結年歲不可早於預計開始年歲。' };
  return { ok: true, message: '' };
}

function planName(plan) {
  return String(plan?.display_name ?? plan?.name ?? plan?.plan_id ?? '').trim();
}

function planGender(plan) {
  return String(plan?.gender ?? 'ALL').trim() || 'ALL';
}

function planGroupKey(plan) {
  return `${planName(plan)}::${planGender(plan)}`;
}

function planSort(left, right) {
  return Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0) || String(left?.plan_id ?? '').localeCompare(String(right?.plan_id ?? ''));
}

export function groupMedicalPlans(plans) {
  const enabled = (Array.isArray(plans) ? plans : [])
    .filter(plan => plan && plan.enabled !== false && String(plan.plan_id ?? plan.id ?? '').trim())
    .map(plan => ({ ...plan, plan_id: String(plan.plan_id ?? plan.id).trim(), deductible: Number(plan.deductible ?? 0) }))
    .sort(planSort);
  const nameCounts = new Map();
  enabled.forEach(plan => nameCounts.set(planName(plan), (nameCounts.get(planName(plan)) || 0) + 1));
  const groups = new Map();
  enabled.forEach(plan => {
    const key = planGroupKey(plan);
    if (!groups.has(key)) groups.set(key, { key, name: planName(plan), gender: planGender(plan), plans: [] });
    groups.get(key).plans.push(plan);
  });
  return [...groups.values()].map(group => ({
    ...group,
    label: `${group.name}${nameCounts.get(group.name) > 1 && group.gender !== 'ALL' ? `（${group.gender}）` : ''}`,
    plans: [...group.plans].sort(planSort)
  }));
}

export function selectMedicalPlanId(plans, groupKey, deductible) {
  const group = groupMedicalPlans(plans).find(value => value.key === groupKey);
  if (!group) return '';
  const selected = group.plans.find(plan => Number(plan.deductible ?? 0) === Number(deductible));
  return selected?.plan_id || group.plans[0]?.plan_id || '';
}
