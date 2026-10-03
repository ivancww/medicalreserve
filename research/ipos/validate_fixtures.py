"""Validate the frozen normalized fixture, not raw proposals or research estimates."""
import hashlib
import json
from pathlib import Path
from jsonschema import Draft202012Validator

root = Path(__file__).parent
raw = (root / 'fixtures/dataset.json').read_bytes()
dataset = json.loads(raw)
schema = json.loads((root / 'schema.json').read_text())
Draft202012Validator.check_schema(schema)
Draft202012Validator(schema).validate(dataset)
roles = {}
inconsistencies = []
for case in dataset['cases']:
    assert case['caseId'] not in roles, 'Duplicate case identity'
    roles[case['caseId']] = case['role']
    assert len({r['policyYear'] for r in case['rows']}) == len(case['rows'])
    schedule = {r['age']: r for r in case['withdrawalSchedule']}
    for row in case['rows']:
        assert row['policyYear'] == row['age'] - case['issueAge']
        assert row['withdrawalType'] != 'fullSurrender', 'Full surrender excluded from this corpus'
        if row['withdrawal'] != schedule[row['age']]['withdrawal']:
            inconsistencies.append({'caseId':case['caseId'],'age':row['age'],'policyYear':row['policyYear'],'rowWithdrawal':row['withdrawal'],'scheduleWithdrawal':schedule[row['age']]['withdrawal']})
        s = schedule[row['age']]
        assert abs(row['withdrawal'] - sum(s[k] for k in ['withdrawalFromGuaranteedCashValue', 'withdrawalFromReversionaryBonus', 'withdrawalFromTerminalDividend'])) <= 1, 'Allocation rounding exceeds HKD 1'
        assert abs(row['projectedRemainingSurrenderValue'] - sum(row[k] for k in ['guaranteedCashValue', 'reversionaryBonusCashValue', 'terminalDividendCashValue'])) <= 1, 'Component rounding exceeds HKD 1'
expected_holdouts = {'45yrs_5pay_130k_avf_55','45yrs_5pay_130k_avpu_55yr','5pay_avf_150k','5pay_avpu_200k','50yrs_5pay_130k_avpu','70k_original'}
assert {k for k,v in roles.items() if v == 'holdout'} == expected_holdouts, 'Frozen assignment changed'
report = {'status':'FAIL' if inconsistencies else 'PASS','schemaValidation':'PASS','frozenAssignment':'PASS','componentRounding':'PASS','scheduleConsistency':'FAIL' if inconsistencies else 'PASS','cases':len(roles),'annualRows':sum(len(c['rows']) for c in dataset['cases']),'fixtureSHA256':hashlib.sha256(raw).hexdigest(),'inconsistencies':inconsistencies,'action':'Frozen fixture preserved; recheck genuine proposals before correcting ambiguous final-year schedules.'}
print(json.dumps(report))
(root / 'fixture-validation-report.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if inconsistencies else 0)
