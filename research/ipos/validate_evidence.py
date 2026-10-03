"""Validate de-identified audit evidence independently of engine predictions."""
import json
import math
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).parent
report = json.loads((ROOT / 'evidence-gap-matrix.json').read_text())
pairs = json.loads((ROOT / 'matched-component-evidence.json').read_text())['pairs']
transitions = json.loads((ROOT / 'component-transition-evidence.json').read_text())['transitions']
schema = {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'type': 'object',
    'required': ['auditVersion', 'previousHead', 'engineVersion', 'frozenMetrics',
                 'sourceRecords', 'immediateTransitionDiagnostics', 'age100Anomalies',
                 'pauseResumeEvidence', 'evidenceDecision', 'finalResearchStatus'],
    'properties': {
        'evidenceDecision': {'enum': ['EVIDENCE_SUFFICIENT_FOR_NEXT_MODEL', 'ADDITIONAL_PROPOSALS_REQUIRED']},
        'sourceRecords': {'type': 'array', 'minItems': 1},
        'immediateTransitionDiagnostics': {'type': 'array', 'minItems': 5, 'maxItems': 5},
        'age100Anomalies': {'type': 'array', 'minItems': 3, 'maxItems': 3},
        'finalResearchStatus': {'const': 'NOT_READY_FOR_INTEGRATION'},
    },
}
Draft202012Validator.check_schema(schema)
Draft202012Validator(schema).validate(report)
field_schema = {'type': 'object', 'minProperties': 10, 'maxProperties': 10,
                'additionalProperties': {'enum': ['AVAILABLE', 'NOT AVAILABLE', 'AMBIGUOUS', 'ESTIMATED_ONLY']}}
components = ('GCV', 'RB', 'TD')
sources = {s['sourceId']: s for s in report['sourceRecords']}
assert len(sources) == 23
frozen = json.loads((ROOT / 'fixtures/dataset.json').read_text())
roles = {c['caseId']: c['role'] for c in frozen['cases']}
usable = [s for s in sources.values() if s['usable']]
assert len(usable) == 22
for source in usable:
    m = source['metadata']
    assert m['currency'] == 'HKD' and m['paymentTerm'] == 5
    assert source['frozenRole'] == roles.get(source['caseId'], 'UNASSIGNED_EVIDENCE_ONLY')
    assert source['sourceId'] == 'ipos-' + source['pdfSHA256'][:16]
    assert len(source['pdfSHA256']) == 64
    expected = list(range(1, 101 - m['issueAge']))
    for key in ['baseRows', 'postRows', 'allocationRows', 'evidenceByPolicyYear']:
        assert [r['policyYear'] for r in source[key]] == expected, f'Incomplete {source["caseId"]} {key}'
    assert source['frozenPostComponentDifferences'] == []
    for row in source['evidenceByPolicyYear']:
        Draft202012Validator(field_schema).validate(row['fields'])
        assert set(row['fields'].values()) == {'AVAILABLE'}
        assert all(1 <= page <= m['pageCount'] for page in row['pages'].values())
        assert not set(row['pages'].values()) & set(source['excludedNonCentralPages'])
    for row in source['baseRows'] + source['postRows']:
        assert row['age'] - m['issueAge'] == row['policyYear']
        assert abs(row['total'] - sum(row[k] for k in components)) <= 1
        assert all(isinstance(row[k], (int, float)) and math.isfinite(row[k]) and row[k] >= 0 for k in components)
    for row in source['allocationRows']:
        assert abs(row['total'] - row['fromGCV'] - row['fromRB'] - row['fromTD']) <= 1

assert len(pairs) == report['summary']['matchedAnnualPairs'] == 1205
pair_index = {}
for pair in pairs:
    s = sources[pair['sourceId']]
    assert pair['noWithdrawal'] == s['baseRows'][pair['policyYear'] - 1]
    assert pair['postWithdrawal'] == s['postRows'][pair['policyYear'] - 1]
    assert pair['allocation'] == s['allocationRows'][pair['policyYear'] - 1]
    assert pair['sameEffectiveBasicAmount'] == (pair['postWithdrawal']['basicAmount'] == s['metadata']['initialBasicAmount'])
    for k in (*components, 'total'):
        assert pair['impact'][k] == pair['postWithdrawal'][k] - pair['noWithdrawal'][k]
    assert abs(pair['impact']['total'] - sum(pair['impact'][k] for k in components)) <= 2
    pair_index[(pair['caseId'], pair['policyYear'])] = pair
assert len(transitions) == report['summary']['consecutivePositiveWithdrawalTransitions'] == 346
for transition in transitions:
    t, n = transition['t'], transition['next']
    assert n['policyYear'] == t['policyYear'] + 1
    assert t == pair_index[(t['caseId'], t['policyYear'])]
    assert n == pair_index[(n['caseId'], n['policyYear'])]
    assert t['postWithdrawal']['withdrawal'] > 0 and n['postWithdrawal']['withdrawal'] > 0
    for k in components:
        assert transition['changeInImpact'][k] == n['impact'][k] - t['impact'][k]
for d in report['immediateTransitionDiagnostics']:
    assert d['genuine'] == pair_index[(d['caseId'], d['policyYear'])]['postWithdrawal']
    assert abs(d['componentErrorIdentityResidual']) <= 1 + 1e-6
    assert abs(d['componentErrorDollars']['total'] - sum(d['componentErrorDollars'][k] for k in components)) <= 1 + 1e-6
    assert d['genuine']['GCV'] == d['genuineNoWithdrawal']['GCV']
for anomaly in report['age100Anomalies']:
    assert anomaly['status'] == 'SOURCE_CONFIRMS_ZERO'
    assert anomaly['genuinePostWithdrawalAmount'] == anomaly['genuineAllocation']['total'] == 0
for gap in report['pauseResumeEvidence']:
    assert gap['lastWithdrawal']['postWithdrawal']['withdrawal'] > 0
    assert all(r['postWithdrawal']['withdrawal'] == 0 for r in gap['zeroWithdrawalYears'])
    assert gap['resumedWithdrawal']['postWithdrawal']['withdrawal'] > 0
metrics = report['frozenMetrics']
assert metrics['MAPE'] == 2.29650947 and metrics['maxErrorPercent'] == 11.80075621
assert metrics['rowsAbove010'] == 247 and metrics['annualRows'] == 325 and metrics['leakage'] == 'PASS'
print(json.dumps({'status': 'PASS', 'schema': 'PASS', 'sourceRows': 1205, 'matchedPairs': len(pairs),
                  'transitions': len(transitions), 'frozenRoles': 'PASS', 'age100SourceVerification': 'PASS'}))
