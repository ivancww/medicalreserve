"""Validate saved Iteration-1 checkpoint without projecting holdouts again."""
import hashlib
import json
import math
import subprocess
from pathlib import Path

root = Path(__file__).parent
repo = root.parent.parent
report = json.loads((root / 'component-state-research.json').read_text())
dataset_bytes = (root / 'fixtures/dataset.json').read_bytes()
dataset = json.loads(dataset_bytes)
evidence = json.loads((root / 'evidence-gap-matrix.json').read_text())
roles = {c['caseId']: c['role'] for c in dataset['cases']}
assert report['phase'] == 'A' and report['iteration'] == 1
assert report['frozenRoles'] == roles
assert report['fixtureSHA256'] == hashlib.sha256(dataset_bytes).hexdigest()
assert report['holdoutEvaluationCount'] == 1
assert report['productionActivated'] is False
assert report['leakage'] == 'PASS'
assert all(roles[r['caseId']] == 'calibration' for r in report['rbFitRows'])
assert set(report['modelLock']['calibrationCaseIds']) == {k for k,v in roles.items() if v == 'calibration'}
assert all(next(s for s in evidence['sourceRecords'] if s['sourceId'] == sid)['frozenRole'] == 'calibration' for sid in report['modelLock']['sourceIds'])
assert report['baseIdentityMaxResidual'] <= 1
assert len(report['fiveRows']) == 5
for r, source in zip(report['fiveRows'], evidence['immediateTransitionDiagnostics']):
    assert (r['caseId'], r['age'], r['policyYear']) == (source['caseId'], source['age'], source['policyYear'])
    assert set(r['components']) == {'GCV', 'RB', 'TD', 'total'}
    for key, c in r['components'].items():
        assert c['genuine'] == source['genuine'][key]
        assert c['dollarError'] == c['model'] - c['genuine']
        assert c['percentError'] is None or math.isfinite(c['percentError'])
    assert abs(r['components']['total']['model'] - sum(r['components'][k]['model'] for k in ['GCV','RB','TD'])) <= 1
assert report['firstWithdrawalGate'] == 'PASS'
assert all(r['status'] == 'PASS' and abs(r['modelIdentityError']) <= 1 and abs(r['sumError']) <= 1 for r in report['firstWithdrawals'])
assert report['zeroWithdrawalPersistence'] == 'PASS'
assert all(r['status'] == 'PASS' for r in report['pauseChecks'])
assert report['fiveRowComponentGate'] == 'FAIL'
assert any(r['status'] == 'FAIL' for r in report['fiveRows'])
rows = report['holdoutRows']
actual_rows = {(c['caseId'],r['policyYear']): r for c in dataset['cases'] if c['role'] == 'holdout' for r in c['rows']}
assert len(rows) == len(actual_rows) == 325
for r in rows:
    a = actual_rows[(r['caseId'],r['policyYear'])]
    assert a['projectedRemainingSurrenderValue'] == r['actual']
    assert r['dollarError'] == r['predicted'] - r['actual']
    assert abs(r['absolutePercent'] - (abs(r['dollarError'])/r['actual']*100 if r['actual'] else 0)) < 1e-7
holdout = report['holdout']
assert abs(sum(r['absolutePercent'] for r in rows)/len(rows) - holdout['MAPE']) < 1e-7
assert max(r['absolutePercent'] for r in rows) == holdout['maxErrorPercent']
assert sum(r['absolutePercent'] > .10 for r in rows) == holdout['rowsAbove010']
assert max(abs(r['dollarError']) for r in rows) == holdout['maxDollarError']
assert report['decision'] == 'ITERATION_1_REJECTED'
assert report['retainedEngine'] == report['baseline']['engine'] == 'ipos-approximation-terminal-dividend-transition-v4'
assert report['researchStatus'] == 'NOT_READY_FOR_INTEGRATION'
protected = ['app.js','domain.js','admin.js','gas','index.html','styles.css','sw.js','manifest.webmanifest','icon.svg',
             'research/ipos/engine.js','research/ipos/fixtures/dataset.json','research/ipos/validation-report.json','research/ipos/validation-report.md',
             'research/ipos/evidence-gap-matrix.json','research/ipos/matched-component-evidence.json','research/ipos/component-transition-evidence.json']
subprocess.run(['git','diff','--exit-code',report['startingHead'],'--',*protected], cwd=repo, check=True)
print(json.dumps({'artifactValidation':'PASS','frozenRoles':'PASS','leakage':'PASS','protectedFiles':'PASS',
                  'firstWithdrawal':'PASS','zeroWithdrawalPersistence':'PASS','fiveRowComponentGate':'FAIL',
                  'holdoutRecomputedFromSavedPredictions':'PASS','newHoldoutProjectionRuns':0}))
