const MIN = 40000;
const MAX = 200000;
const OFFSETS = Object.freeze({ phase1: 0, phase2: 5, phase3: 10 });

function fail(message) { const error = new Error(message); error.code = 'SAVING_RETURN_DATA_INVALID'; throw error; }

export function validateLayer2Data(data) {
  const value = data?.data?.dataset_id ? data.data : data;
  if (!value || value.dataset_id !== 'SavingPlanReturns' || value.product_id !== 'aia_hk_5pay' || value.currency !== 'HKD' || Number(value.pay_term_years) !== 5 || !Array.isArray(value.rows) || !value.rows.length) fail('SavingPlanReturns 官方資料不完整');
  const rows = value.rows.filter(row => row.enabled !== false).map(row => ({ ...row, annual_contribution: Number(row.annual_contribution), issue_age: Number(row.issue_age), policy_year: Number(row.policy_year), base_value: Number(row.base_value) }));
  if (rows.some(row => !Number.isFinite(row.base_value) || row.annual_contribution < MIN || row.annual_contribution > MAX || !Number.isInteger(row.issue_age) || !Number.isInteger(row.policy_year))) fail('SavingPlanReturns 官方資料超出支援範圍');
  return { ...value, rows };
}

function resolve(rows, medicalPlanId, issueAge, policyYear, contribution) {
  const candidates = rows.filter(row => String(row.medical_plan_id) === String(medicalPlanId) && row.issue_age === issueAge && row.policy_year === policyYear).sort((a,b) => a.annual_contribution - b.annual_contribution);
  const exact = candidates.find(row => row.annual_contribution === contribution); if (exact) return exact.base_value;
  const lower = [...candidates].reverse().find(row => row.annual_contribution < contribution), upper = candidates.find(row => row.annual_contribution > contribution);
  if (!lower || !upper) return null;
  return lower.base_value + ((contribution - lower.annual_contribution) / (upper.annual_contribution - lower.annual_contribution)) * (upper.base_value - lower.base_value);
}

export function automaticAccumulation({ rows, currentAge, supportStartAge, supportEndAge, arrangement, phaseContributions, medicalPlanId }) {
  const count = Number(arrangement) / 5, ids = ['phase1','phase2','phase3'].slice(0, count), output = [];
  for (let age = Number(supportStartAge); age <= Number(supportEndAge); age += 1) {
    let value = 0;
    for (const id of ids) { const issueAge = Number(currentAge) + OFFSETS[id], policyYear = age - issueAge, contribution = Number(phaseContributions[id]); if (policyYear < 1) continue; const resolved = resolve(rows, medicalPlanId, issueAge, policyYear, contribution); if (resolved == null) return null; value += resolved; }
    output.push({ age, value });
  }
  return output;
}
