import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
dataset = json.loads((ROOT / 'fixtures/dataset.json').read_text())
lock = json.loads((ROOT / 'customer-total-value-lock.json').read_text())
engine = json.loads((ROOT / 'customer-total-value-engine.json').read_text())
ab = json.loads((ROOT / 'customer-ab-calculation.json').read_text())

assert lock['frozenHoldoutEvaluationCount'] == 0
assert engine['frozenHoldoutEvaluationCount'] == 1
assert engine['modelLockSHA256'] == lock['modelLockSHA256']
assert len(engine['holdoutRows']) == 325
assert engine['leakage'] == 'PASS'
roles = {case['caseId']: case['role'] for case in dataset['cases']}
assert all(roles[case_id] == 'calibration' for case_id in lock['model']['calibrationCaseIds'])
assert engine['productionActivated'] is False
assert engine['customerUiModified'] is False
assert ab['medicalPremiumBoundary']['status'] == 'OFFICIAL_VALUES_NOT_AVAILABLE_IN_REPOSITORY_OR_THIS_WORK_ENVIRONMENT'
assert ab['age50OfficialExample']['medicalPremiumYearsIncluded'] == 26
assert all(ab['age50OfficialExample'][key]['requiredAnnualContribution'] is None for key in ('fiveYear', 'tenYear', 'fifteenYear'))
assert engine['holdout']['rowsAbove']['0.10'] == sum(row['absolutePercent'] > .10 for row in engine['holdoutRows'])
assert engine['holdout']['rowsAbove']['1.00'] == sum(row['absolutePercent'] > 1 for row in engine['holdoutRows'])
print('customer A/B research artifacts: PASS')
