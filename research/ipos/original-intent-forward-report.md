# Original-Intent Forward Calculation Checkpoint

Classification: **ORIGINAL_INTENT_FORWARD_PARTIAL — CORE RESEARCH ENGINE PASSES; OFFICIAL `select_0` MAPPING AND LIVE GAS CONTRACT FAIL; REAL PREMIUM REPEATED-SUPPORT PATHS REMAIN NOT_YET_VALIDATED**

Validated on current PR #2 head `6a5433006557bcdee7a2975514940a970a7fe06a`. This remains a research-only calculation boundary; production is not activated.

## Current status

| Area | Status | Result |
| --- | --- | --- |
| Calculation engine | PASS | Existing Original-Intent engine and tests pass; no new actuarial model introduced |
| Official Sheet | FAIL | `select_0` is still malformed in the current live `MedicalPlans` row |
| GAS source contract | PASS | Repository source implements `premium` and `premiumRange` with inclusive ranges and safe failures |
| Live GAS deployment | FAIL | Endpoint serves API v1.0.0, not repository v1.1.0 |
| Real Medical Premium Forward path | PARTIAL | Real official ranges consumed; unsupported states remain explicitly classified |
| Genuine iPOS validation | PASS | 610 exact genuine annual rows remain exact |
| Production integration | BLOCKED | Activation is not justified while mapping, deployment, and evidence blockers remain |

## Locked routing

`activePhaseIndex = floor((attainedAge - supportStartAge) / 5) mod enabledPhaseCount`

| Configuration | Result |
| --- | --- |
| Phase 1 | PASS |
| Phase 1 + Phase 2 | PASS |
| Phase 1 + Phase 2 + Phase 3 | PASS |

Phase 1 remains mandatory; Phase 3 requires Phase 2. Non-active phases continue aging on their own issue-age / Policy-Year timelines and are not reset or reissued. Tests cover non-65 starts and partial windows.

## Official Medical premium source

- Sheet: **增值式醫保** (`1OXblBBSdhnuFPP54FucxmNEVGL9d2s7fDfZqKtk_dHI`)
- Mapping tab: **MedicalPlans**

| plan_id | Current premium_sheet | Target tab exists | Status |
| --- | --- | --- | --- |
| `flexible_m` | `男靈活計劃` | Yes | PASS |
| `prestige_16000` | `尊耀16000自付額` | Yes | PASS |
| `select_18000` | `睿選18000自付額` | Yes | PASS |
| `select_0` | `睿選0自付額` | Yes, as `睿選 0自付額` | FAIL |

The current `select_0` row also contains `睿選 0自付額` in the `enabled` column instead of boolean `true`. No external Sheet repair was applied. The target tabs contain official boundary data: `select_0` and `select_18000` have explicit ages 99 and 100; `flexible_m` and `prestige_16000` have `99+` bands.

## GAS contract and live verification

`gas/Code.gs` implements `premium` and `premiumRange`, accepting `plan_id`, `support_start_age`, and `support_end_age` while retaining legacy `retirement_age` / `coverage_age`. It resolves exact ages before `99+` bands, does not interpolate missing rows, and fails safely for missing plans, sheets, ages, and invalid ranges.

The documented endpoint was queried directly. It is an older deployment (`api_version: 1.0.0`) and does not represent the current source (`1.1.0`):

- `flexible_m`, `prestige_16000`, and `select_18000` normal `premium` reads: PASS.
- Legacy `premiumRange` reads: PASS.
- New `support_start_age/support_end_age` parameters: FAIL; rejected by the old deployment.
- `select_0`: FAIL; old mapping points to the missing `睿選0自付額` tab.
- Live 99+/100 boundary reads for `flexible_m` / `prestige_16000`: FAIL; old deployment reports missing premium.
- Invalid plan and invalid range: safely rejected.
- Deployment of current source: BLOCKED; authenticated Apps Script deployment capability is unavailable here.

## Genuine iPOS evidence

| Validation | Rows | MAPE | Max annual error | Max HKD error | First >0.01% | First >0.02% | First >0.05% | First >0.10% |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Exact genuine-path replay (calibration/regression) | 610 | 0.00000000% | 0.00000000% | 0.00 | NEVER | NEVER | NEVER | NEVER |
| Blind contribution interpolation (`5pay_avf_150k`) | 40 | 0.01039124% | 0.01416997% | 1918.60 | see note | NEVER | NEVER | NEVER |

The exact replay was rerun from the committed fixtures on the current head. The interpolation check remains evidence-supported only, not a new direct validation; its worst percentage row is age 85 / Policy Year 40 and its largest dollar error is HKD 1,918.60 at age 100 / Policy Year 55. No genuinely validated annual row exceeds any acceptance threshold.

## Real Medical Premium Forward path

The existing forward engine consumed bounded official premium ranges from the documented endpoint using its legacy range parameters. It exercised support starts 55 and 60, long ranges, partial final windows, and all three phase configurations.

| Plan / range | Phase 1 | Phase 1 + 2 | Phase 1 + 2 + 3 | Routing observed |
| --- | --- | --- | --- | --- |
| `flexible_m`, 55–90 | NOT_YET_VALIDATED from age 56 / PY11 | NOT_YET_VALIDATED from age 56 / PY11 | OUT_OF_SUPPORTED_RANGE from age 65 / PY20 | P1; P1→P2; P1→P2→P3 |
| `flexible_m`, 60–92 | NOT_YET_VALIDATED from age 61 / PY16 | OUT_OF_SUPPORTED_RANGE | OUT_OF_SUPPORTED_RANGE from age 70 / PY25 | P1; P1→P2; P1→P2→P3; partial final window |
| `prestige_16000`, 55–90 | NOT_YET_VALIDATED from age 56 / PY11 | NOT_YET_VALIDATED from age 56 / PY11 | OUT_OF_SUPPORTED_RANGE from age 65 / PY20 | P1; P1→P2; P1→P2→P3 |
| `select_18000`, 60–92 | NOT_YET_VALIDATED from age 61 / PY21 | OUT_OF_SUPPORTED_RANGE | OUT_OF_SUPPORTED_RANGE from age 61 / PY21 | P1; P1→P2; P1→P2→P3 |

These are numerical forward outputs with evidence status, not genuine iPOS PASS claims. The first unmatched support state is exposed; no repeated-support transition, reverse solver, v3/v4 model, component-state model, or carried-ratio model was added.

## Evidence and integration boundary

- **DIRECTLY_VALIDATED:** exact represented issue age, contribution anchor, Policy Year, and matched complete genuine support history.
- **INTERPOLATED_EVIDENCE_SUPPORTED:** between adjacent supported contribution anchors only when issue age and complete support history match.
- **NOT_YET_VALIDATED:** unmatched repeated-support history; numerical output is not promoted to PASS.
- **OUT_OF_SUPPORTED_RANGE:** annual contribution below HKD 40,000 or above HKD 200,000, or unsupported issue age / Policy Year.

The production app remains disconnected from the research engine and fixtures. A production adapter is not activated because the current Official mapping is malformed, the deployed GAS contract is stale, and real repeated-support paths are not genuinely validated. The smallest next step is to correct the Sheet row, deploy the current `gas/Code.gs` version, re-run live contract checks, and then review an integration adapter separately.

Frozen fixtures were not changed. The fixture validator remains FAIL on three preserved ambiguous age-100 schedule inconsistencies; this is not silently converted to PASS.
