import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync(new URL('../research/ipos/original-intent-calculation-spec.json', import.meta.url)));

test('original-intent spec is forward-only and does not select a new model', () => {
  assert.equal(spec.selectedDirection.mode, 'FORWARD_ONLY');
  assert.equal(spec.selectedDirection.reverseSolverIncluded, false);
  assert.equal(spec.selectedDirection.newApproximationModelIncluded, false);
  assert.equal(spec.selectedDirection.productionActivated, false);
});

test('phase dependency and five-year offsets are explicit', () => {
  assert.deepEqual(spec.phaseModel.validConfigurations, [
    'phase1',
    'phase1+phase2',
    'phase1+phase2+phase3'
  ]);
  assert.deepEqual(spec.phaseModel.phases.map(phase => phase.offsetYears), [0, 5, 10]);
  assert.equal(spec.phaseModel.phases[2].requires, 'phase2');
  assert.equal(spec.phaseModel.contributionsMayDifferByPhase, true);
});

test('phase routing is unresolved instead of silently defaulting to oldest-first', () => {
  assert.equal(spec.phaseAggregation.status, 'PHASE SUPPORT ROUTING — DECISION REQUIRED');
  assert.match(spec.phaseAggregation.prohibitedDefault, /oldest-first rule is research-only/);
});

test('genuine data anchors and ranges are frozen facts', () => {
  assert.deepEqual(spec.genuineDataCoverage.annualContributionToBasicAmountAnchors, [
    { annualContribution: 40000, BasicAmount: 404041 },
    { annualContribution: 70000, BasicAmount: 710660 },
    { annualContribution: 100000, BasicAmount: 1015229 },
    { annualContribution: 130000, BasicAmount: 1323829 },
    { annualContribution: 150000, BasicAmount: 1527495 },
    { annualContribution: 180000, BasicAmount: 1832994 },
    { annualContribution: 200000, BasicAmount: 2042901 }
  ]);
  assert.deepEqual(spec.genuineDataCoverage.issueAgesDirectlyRepresented, [40, 45, 50]);
  assert.deepEqual(spec.genuineDataCoverage.policyYearCoverageByIssueAge, [
    { issueAge: 40, minimum: 1, maximum: 60 },
    { issueAge: 45, minimum: 1, maximum: 55 },
    { issueAge: 50, minimum: 1, maximum: 50 }
  ]);
});

test('official medical premiums fail safe and repeated support is not overclaimed', () => {
  assert.match(spec.medicalPremiumMapping.missingAgeRule, /Fail unavailable/);
  assert.equal(spec.medicalPremiumMapping.rangeAction, 'premiumRange');
  assert.equal(spec.contributionSupport.noExtrapolation, true);
  assert.equal(spec.validationEvidence.genericRepeatedSupport, 'NOT YET VALIDATED');
  assert.ok(spec.evidenceStatuses.includes('OFFICIAL_PREMIUM_DATA_UNAVAILABLE'));
  assert.ok(spec.evidenceStatuses.includes('NOT_YET_VALIDATED'));
});

test('protected production and evidence areas remain outside this checkpoint', () => {
  for (const required of ['Customer Flow', 'production calculation engine', 'GAS', 'Official Cloud data', 'genuine proposal fixtures']) {
    assert.ok(spec.protectedAreasUnchanged.includes(required));
  }
});
