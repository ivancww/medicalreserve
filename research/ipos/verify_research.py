"""Capture actual commands and outcomes; retain failures without stopping report generation."""
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).parent
repo = root.parent.parent
commands = {
    'nodeTests': ['npm', 'test'],
    'syntax': ['npm', 'run', 'check'],
    'fixtureValidation': ['npm', 'run', 'validate:fixtures'],
    'pythonSyntax': ['python3', '-m', 'py_compile', 'research/ipos/validate_offline.py', 'research/ipos/validate_fixtures.py', 'research/ipos/verify_research.py'],
    'diffWhitespace': ['git', 'diff', '--check'],
    'productionDiff': ['git', 'diff', '--exit-code', '1a3e2e18ceedf9f25ac98476aae12e3ec82a0597', '--', 'app.js', 'domain.js', 'admin.js', 'gas', 'index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg'],
    'frozenFixtureDiff': ['git', 'diff', '--exit-code', '1a3e2e18ceedf9f25ac98476aae12e3ec82a0597', '--', 'research/ipos/fixtures/dataset.json'],
}
report = {'verifiedAtUTC':datetime.now(timezone.utc).isoformat(),'startingHead':'1a3e2e18ceedf9f25ac98476aae12e3ec82a0597'}
for key, command in commands.items():
    result = subprocess.run(command,cwd=repo,text=True,capture_output=True)
    report[key] = {'command':command,'exitCode':result.returncode,'status':'PASS' if result.returncode == 0 else 'FAIL','output':(result.stdout+result.stderr).strip()}
    print(key,report[key]['status'])
report['browserPhysicalDeviceQA'] = {'status':'NOT VERIFIED','reason':'Research-only change; production UI/deployment unchanged. No integration readiness certification.'}
(root/'verification-report.json').write_text(json.dumps(report,indent=2)+'\n')
# Return nonzero for actual failures; report sync is a separate step.
raise SystemExit(1 if any(isinstance(v,dict) and v.get('status')=='FAIL' for v in report.values()) else 0)
