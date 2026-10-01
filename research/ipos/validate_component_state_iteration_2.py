"""Validate saved Iteration-2 artifacts without projecting the holdout again."""
import hashlib
import json
import math
import subprocess
from pathlib import Path

root = Path(__file__).parent
repo = root.parent.parent
report = json.loads((root / 'component-state-iteration-2-research.json').read_text())
lock = json.loads((root / 'component-state-iteration-2-lock.json').read_text())
dataset_bytes = (root / 'fixtures/dataset.json').read_bytes()
dataset = json.loads(dataset_bytes)
evidence = json.loads((root / 'evidence-gap-matrix.json').read_text())
roles = {case['caseId']: case['role'] for case in dataset['cases']}

assert report['phase'] == 'A' and report['iteration'] == 2
assert report['startingHead'] == '39fb72b8d6b218188139534299985f605591fa4b'
assert lock['holdoutEvaluated'] is False and report['holdoutEvaluated'] is True
assert report['holdoutEvaluationCount'] == 1
assert report['frozenRoles'] == lock['frozenRoles'] == roles
assert report['fixtureSHA256'] == lock['fixtureSHA256'] == hashlib.sha256(dataset_bytes).hexdigest()
canonical = json.dumps(report['modelLock'], separators=(',', ':'))
assert hashlib.sha256(canonical.encode()).hexdigest() == report['modelLockSHA256'] == lock['modelLockSHA256']
assert report['modelLock'] == lock['modelLock']
assert report['modelLock']['rbFreeParameters'] == 0
assert set(report['modelLock']['calibrationCaseIds']) == {key for key, value in roles.items() if value == 'calibration'}
assert all(next(source for source in evidence['sourceRecords'] if source['sourceId'] == source_id)['frozenRole'] == 'calibration'
           for source_id in report['modelLock']['sourceIds'])
assert report['leakage'] == 'PASS'
assert report['firstWithdrawalGate'] == 'PASS'
assert all(row['status'] == 'PASS' for row in report['firstWithdrawals'])
assert report['zeroWithdrawalPersistence'] == 'PASS'
assert all(row['status'] == 'PASS' for row in report['pauseChecks'])
assert report['fiveRowComponentGate'] == 'FAIL'
assert len(report['fiveRows']) == 5 and any(row['status'] == 'FAIL' for row in report['fiveRows'])
for row, source in zip(report['fiveRows'], evidence['immediateTransitionDiagnostics']):
    assert (row['caseId'], row['age'], row['policyYear']) == (source['caseId'], source['age'], source['policyYear'])
    for key, component in row['components'].items():
        assert component['genuine'] == source['genuine'][key]
        assert component['dollarError'] == component['model'] - component['genuine']
        assert component['percentError'] is None or math.isfinite(component['percentError'])
    assert abs(row['components']['total']['model'] - sum(row['components'][key]['model'] for key in ('GCV', 'RB', 'TD'))) <= 1

actual_rows = {(case['caseId'], row['policyYear']): row for case in dataset['cases'] if case['role'] == 'holdout' for row in case['rows']}
saved_rows = report['holdoutRows']
assert len(saved_rows) == len(actual_rows) == 325
for row in saved_rows:
    actual = actual_rows[(row['caseId'], row['policyYear'])]
    assert row['actual'] == actual['projectedRemainingSurrenderValue']
    assert row['dollarError'] == row['predicted'] - row['actual']
    expected = abs(row['dollarError']) / row['actual'] * 100 if row['actual'] else 0
    assert abs(row['absolutePercent'] - expected) < 1e-7
holdout = report['holdout']
assert abs(sum(row['absolutePercent'] for row in saved_rows) / len(saved_rows) - holdout['MAPE']) < 1e-7
assert max(row['absolutePercent'] for row in saved_rows) == holdout['maxErrorPercent']
assert sum(row['absolutePercent'] > .10 for row in saved_rows) == holdout['rowsAbove010']
assert max(abs(row['dollarError']) for row in saved_rows) == holdout['maxDollarError']
assert report['decision'] == 'ITERATION_2_REJECTED'
assert report['retainedEngine'] == report['baseline']['engine'] == 'ipos-approximation-terminal-dividend-transition-v4'
assert report['researchStatus'] == 'NOT_READY_FOR_INTEGRATION'
assert report['iteration1']['decision'] == 'ITERATION_1_REJECTED'

protected = [
    'app.js', 'domain.js', 'admin.js', 'gas', 'index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg',
    'research/ipos/engine.js', 'research/ipos/fixtures/dataset.json', 'research/ipos/validation-report.json',
    'research/ipos/validation-report.md', 'research/ipos/evidence-gap-matrix.json', 'research/ipos/evidence-gap-matrix.md',
    'research/ipos/matched-component-evidence.json', 'research/ipos/component-transition-evidence.json',
    'research/ipos/component-state.js', 'research/ipos/component-state-research.js',
    'research/ipos/component-state-research.json', 'research/ipos/component-state-research.md',
    'research/ipos/validate_component_state.py', 'tests/component-state.test.js'
]
subprocess.run(['git', 'diff', '--exit-code', report['startingHead'], '--', *protected], cwd=repo, check=True)
print(json.dumps({
    'artifactValidation': 'PASS', 'frozenRoles': 'PASS', 'leakage': 'PASS', 'modelLock': 'PASS',
    'protectedFiles': 'PASS', 'firstWithdrawal': 'PASS', 'fiveRowComponentGate': 'FAIL',
    'zeroWithdrawalPersistence': 'PASS', 'holdoutRecomputedFromSavedPredictions': 'PASS',
    'newHoldoutProjectionRuns': 0
}))
