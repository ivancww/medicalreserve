# Original-Intent Forward Calculation Checkpoint

Classification: **ORIGINAL_INTENT_FORWARD_PARTIAL — OFFICIAL MAPPING PASS; GAS v1.1.0 DEPLOYMENT/LIVE CONTRACT BLOCKED; REAL PREMIUM REPEATED-SUPPORT PATHS REMAIN NOT_YET_VALIDATED**

Validated against PR #2 head `be61fcd6c36e8432024d6f19a0e5e097c62e73a1`. Production remains inactive.

## Current status

| Area | Status | Result |
| --- | --- | --- |
| Original-Intent Forward engine | PASS | Existing engine and regression suite pass; no actuarial logic changed |
| Official MedicalPlans mapping | PASS | `select_0` corrected and read-after-write verified |
| GAS source | PASS | Repository source is API v1.1.0 and implements the required contract |
| GAS deployment | BLOCKED | No authenticated Apps Script deployment/project capability is available here |
| Live GAS contract | FAIL | Existing endpoint remains API v1.0.0 |
| Real Medical Premium Forward path | PARTIAL | All four mappings consumed; unsupported evidence states remain explicit |
| Genuine iPOS validation | PASS | 610 exact genuine annual rows remain exact |
| Production integration | BLOCKED | Deployment and repeated-support evidence gaps remain |

## Official Sheet correction

Sheet: **增值式醫保** (`1OXblBBSdhnuFPP54FucxmNEVGL9d2s7fDfZqKtk_dHI`), tab `MedicalPlans`.

Header-matched `select_0` row after the minimal write:

| plan_id | display_name | gender | deductible | premium_sheet | enabled | sort_order |
| --- | --- | --- | ---: | --- | --- | ---: |
| `select_0` | 睿選計劃 | ALL | 0 | `睿選 0自付額` | TRUE | 30 |

Read-after-write verification: **PASS**. Only `premium_sheet` and `enabled` were changed. The target tab `睿選 0自付額` exists.

Required mapping verification:

| plan_id | Official premium tab | Enabled | Target exists |
| --- | --- | --- | --- |
| `select_0` | `睿選 0自付額` | TRUE | Yes |
| `flexible_m` | `男靈活計劃` | TRUE | Yes |
| `prestige_16000` | `尊耀16000自付額` | TRUE | Yes |
| `select_18000` | `睿選18000自付額` | TRUE | Yes |

Boundary data remains official: `flexible_m` and `prestige_16000` use `99+` bands; `select_0` and `select_18000` contain explicit ages 99 and 100.

## GAS source and live contract

`gas/Code.gs` is API v1.1.0. It supports `premium`, `premiumRange`, `plan_id`, `support_start_age`, `support_end_age`, and legacy `retirement_age` / `coverage_age`; it uses exact ages before `99+`, does not interpolate missing medical premiums, and fails safely.

The canonical deployed endpoint still returns API v1.0.0:

- Normal `premium` values for `flexible_m`, `prestige_16000`, `select_18000`, and corrected `select_0`: **PASS**; values match the Official tabs.
- Corrected `select_0` age 65: HKD 68,696; age 99 and 100: HKD 201,872; legacy 65–100 range: **PASS**.
- New `support_start_age/support_end_age`: **FAIL**; old deployment rejects them.
- Legacy range parameters: **PASS**.
- `flexible_m` / `prestige_16000` age 100: **FAIL** on old deployment; current source is designed to resolve their official `99+` bands.
- Invalid plan, invalid age, and reversed range: safely rejected.
- Deployment: **BLOCKED**. Minimum manual action: open the existing Apps Script project behind the canonical endpoint, replace/deploy `gas/Code.gs` as a new version of the same Web App while preserving its spreadsheet binding and URL, then re-run the endpoint checks above.

## Locked routing and Forward validation

`activePhaseIndex = floor((attainedAge - supportStartAge) / 5) mod enabledPhaseCount`.

Phase 1, Phase 1 + 2, and Phase 1 + 2 + 3 routing all remain **PASS**. Phase 1 is mandatory; Phase 3 requires Phase 2; non-active phases continue aging independently. Runs covered age-55, age-60, and age-65 starts, long ranges, partial final windows, and all three phase configurations.

Real-premium evidence remains partial:

| Plan / start | Phase 1 | Phase 1 + 2 | Phase 1 + 2 + 3 |
| --- | --- | --- | --- |
| `flexible_m`, 55 | NOT_YET_VALIDATED age 56 / PY11; prior support age 55 = HKD 14,031 | same | OUT_OF_SUPPORTED_RANGE / unsupported phase-3 state |
| `prestige_16000`, 65 | NOT_YET_VALIDATED age 66 / PY26; prior support age 65 = HKD 37,816 | NOT_YET_VALIDATED age 70 / phase-2 PY25 | NOT_YET_VALIDATED age 70 / phase-2 PY25 |
| `select_18000`, 65 | NOT_YET_VALIDATED age 66 / PY26; prior support age 65 = HKD 28,000 | NOT_YET_VALIDATED age 70 / phase-2 PY25 | NOT_YET_VALIDATED age 70 / phase-2 PY25 |
| `select_0`, 65 | NOT_YET_VALIDATED age 66 / PY26; prior support age 65 = HKD 68,696 | NOT_YET_VALIDATED age 70 / phase-2 PY25 | NOT_YET_VALIDATED age 70 / phase-2 PY25 |

The first unsupported rows are reported, not hidden. No reverse solver, v3/v4 model, component-state model, carried-ratio model, or new actuarial formula was introduced.

### Repeated-support evidence audit

The committed genuine iPOS corpus was audited using complete prior support history, not age or Policy Year alone. No currently unsupported real-premium state has a complete genuine history match, so no state was promoted. The audit is recorded in [`repeated-support-evidence-audit.json`](repeated-support-evidence-audit.json).

The smallest useful evidence request is staged by phase slot: four Phase-1 proposals first (one for each Official Medical path), followed by four Phase-2 offset proposals and four Phase-3 offset proposals. Each proposal must use the named plan's exact Official premium-derived support schedule and provide genuine iPOS annual values. The matrix contains the issue age, contribution, support range, policy-year range, and row count; it is an evidence request, not a new formula or fixture.

The first complete-history gaps in the primary age-65 run are:

| Plan | Configuration | First gap | Support | Evidence |
| --- | --- | --- | ---: | --- |
| `flexible_m` | P1 | age 66 / PY26 | HKD 23,905 | NOT_YET_VALIDATED |
| `flexible_m` | P1+P2 | age 70 / P2 PY25 | HKD 29,329 | NOT_YET_VALIDATED |
| `prestige_16000` | P1 | age 66 / PY26 | HKD 41,208 | NOT_YET_VALIDATED |
| `prestige_16000` | P1+P2 | age 70 / P2 PY25 | HKD 50,328 | NOT_YET_VALIDATED |
| `select_18000` | P1 | age 66 / PY26 | HKD 30,512 | NOT_YET_VALIDATED |
| `select_18000` | P1+P2 | age 70 / P2 PY25 | HKD 37,264 | NOT_YET_VALIDATED |
| `select_0` | P1 | age 66 / PY26 | HKD 74,544 | NOT_YET_VALIDATED |
| `select_0` | P1+P2 | age 70 / P2 PY25 | HKD 90,504 | NOT_YET_VALIDATED |

P1+P2+P3 reaches the same first P2 gap at age 70. Numerical output remains available only as explicitly classified research output; it is not claimed as genuine validation.

### Age-100 frozen fixture audit

The three preserved inconsistencies are source-confirmed zero allocations, not unresolved actuarial mismatches. Their frozen schedule values (85, 8, and 2) remain unchanged intentionally for benchmark comparability. Each source post-withdrawal value agrees with the frozen remaining value. The detailed audit is [`age100-fixture-audit.json`](age100-fixture-audit.json). The fixture validator therefore remains a known FAIL on these preserved benchmark rows; no genuine evidence was edited.

## Genuine iPOS regression

| Validation | Rows | MAPE | Max annual error | Max dollar error | >0.01% | >0.02% | >0.05% | >0.10% |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Exact genuine-path replay | 610 | 0.00000000% | 0.00000000% | HKD 0.00 | NEVER | NEVER | NEVER | NEVER |
| Blind 150K interpolation | 40 | 0.01039124% | 0.01416997% | HKD 1,918.60 | see prior report | NEVER | NEVER | NEVER |

Full regression: 12 test files passed; syntax checks passed. Frozen fixture validation remains FAIL on the three preserved ambiguous age-100 schedule inconsistencies; frozen evidence was not modified.

## Remaining blockers and integration

1. Deploy current `gas/Code.gs` v1.1.0 to the existing canonical Web App and live-verify API version, new range parameters, and 99+ behavior.
2. Repeated-support paths remain `NOT_YET_VALIDATED` because genuine iPOS evidence does not cover those histories.
3. Production integration remains inactive and **BLOCKED**. The mapping correction alone does not justify activation.
