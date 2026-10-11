export function normalizeReserveRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    policy_year: Number(row.policy_year),
    support_percent: Number(row.support_percent),
    value_multiple: Number(row.value_multiple)
  })).filter(row => Number.isFinite(row.policy_year) && Number.isFinite(row.support_percent) && Number.isFinite(row.value_multiple));
}

export function premiumTotal(annualPremiums) {
  if (!Array.isArray(annualPremiums) || annualPremiums.some(row => !Number.isFinite(Number(row.annual_premium)))) return null;
  return annualPremiums.reduce((total, row) => total + Number(row.annual_premium), 0);
}

export function remainingMedicalCost(premium, support) {
  if (!Number.isFinite(premium) || !Number.isFinite(support)) return null;
  return Math.max(0, premium - support);
}

export function validateBackup(payload, schema) {
  return Boolean(payload && payload.schema === schema && payload.user && typeof payload.user === 'object' && Array.isArray(payload.user.pages));
}

// These are the actual editable Official tabs in AVA-medicalreserve.
// Premium tabs, SavingPlanReturns and research data remain read-only.
export const ADMIN_RESOURCES = Object.freeze([
  'AppFlow',
  'FlowOptions',
  'MedicalPlans',
  'Visualization',
  'SystemSettings'
]);

export const ADMIN_WRITABLE_SYSTEM_KEYS = Object.freeze([
  'checkpoint_interval',
  'chart_type',
  'allowed_visibility',
  'default_result_mode'
]);

export function officialRecordKey(resource, row) {
  if (!row || typeof row !== 'object') return '';
  if (resource === 'FlowOptions') return `${String(row.step_id ?? row.flow_id ?? '').trim()}::${String(row.option_id ?? row.id ?? '').trim()}`;
  if (resource === 'Visualization') return `${String(row.visual_id ?? '').trim()}::${String(row.setting ?? '').trim()}`;
  if (resource === 'SystemSettings') return String(row.key ?? '').trim();
  return String(row.step_id ?? row.page_id ?? row.plan_id ?? row.id ?? '').trim();
}

export function validateAdminRows(resource, rows, context = {}) {
  if (!ADMIN_RESOURCES.includes(resource) || !Array.isArray(rows)) return { ok: false, errors: ['Invalid official resource payload'] };
  const errors = [];
  const number = (row, key, label = key) => {
    if (row[key] !== '' && row[key] != null && !Number.isFinite(Number(row[key]))) errors.push(`${label} must be numeric`);
  };
  const bool = (row, key) => {
    if (row[key] !== undefined && ![true, false, 'true', 'false', 1, 0, '1', '0'].includes(row[key])) errors.push(`${key} must be boolean`);
  };
  const ids = new Set();

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      errors.push(`${resource} row ${index + 1} is invalid`);
      return;
    }

    if (resource === 'AppFlow') {
      if (!officialRecordKey(resource, row)) errors.push(`AppFlow row ${index + 1} requires an ID`);
      number(row, 'sort_order');
      bool(row, 'enabled');
      bool(row, 'visible');
    }

    if (resource === 'FlowOptions') {
      const id = officialRecordKey(resource, row);
      if (!String(row.step_id ?? row.flow_id ?? '').trim()) errors.push(`FlowOptions row ${index + 1} requires a step reference`);
      if (!String(row.option_id ?? row.id ?? '').trim()) errors.push(`FlowOptions row ${index + 1} requires an option ID`);
      if (id && ids.has(id)) errors.push(`FlowOptions contains duplicate ${id}`);
      if (id) ids.add(id);
      number(row, 'sort_order');
      bool(row, 'enabled');
    }

    if (resource === 'MedicalPlans') {
      if (!String(row.plan_id ?? row.id ?? '').trim()) errors.push(`MedicalPlans row ${index + 1} requires plan_id`);
      if (row.deductible !== '' && row.deductible != null && Number(row.deductible) < 0) errors.push(`MedicalPlans row ${index + 1} has an invalid deductible`);
      if (!String(row.premium_sheet ?? row.sheet_name ?? '').trim()) errors.push(`MedicalPlans row ${index + 1} requires premium_sheet`);
      number(row, 'deductible');
      number(row, 'sort_order');
      bool(row, 'enabled');
    }

    if (resource === 'Visualization') {
      if (!String(row.visual_id ?? '').trim()) errors.push(`Visualization row ${index + 1} requires visual_id`);
      if (!String(row.setting ?? '').trim()) errors.push(`Visualization row ${index + 1} requires setting`);
      if (String(row.setting ?? '').toLowerCase().includes('interval')) number(row, 'value');
    }

    if (resource === 'SystemSettings') {
      const key = String(row.key ?? '').trim();
      if (!key) errors.push(`SystemSettings row ${index + 1} requires key`);
      if (!context.writableSystemKeys?.includes(key)) errors.push(`SystemSettings key ${key || '(blank)'} is protected`);
    }
  });

  if (resource === 'AppFlow') {
    const required = context.requiredFlowIds || [];
    const present = new Set(rows.map(row => String(row.step_id ?? row.page_id ?? row.id ?? '').trim()));
    required.forEach(id => {
      if (!present.has(id)) errors.push(`Protected flow ID ${id} cannot be removed`);
    });
  }

  return { ok: errors.length === 0, errors };
}
