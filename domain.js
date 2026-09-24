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
