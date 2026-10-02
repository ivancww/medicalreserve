# Original-Intent Forward Calculation Checkpoint

Classification: **ORIGINAL_INTENT_FORWARD_PARTIAL — UNMATCHED REPEATED-SUPPORT PATHS REMAIN NOT_YET_VALIDATED; GAS READ CONTRACT IS NOT YET DEPLOYED/VERIFIED**

This research-only checkpoint locks the product routing rule, adds the smallest read-only Official premium contract, and demonstrates a Forward calculation by replaying genuine paths and narrowly supported interpolation. It introduces no actuarial model and does not activate production.

## Locked routing

`activePhaseIndex = floor((attainedAge - supportStartAge) / 5) mod enabledPhaseCount`

| Configuration | Result |
| --- | --- |
| Phase 1 | PASS |
| Phase 1 + Phase 2 | PASS |
| Phase 1 + Phase 2 + Phase 3 | PASS |

Non-active phases continue aging on their own issue-age/Policy-Year timelines; routing selects only the phase funding the current support year.

## Official Medical premium contract

- Official Sheet: **增值式醫保** (`1OXblBBSdhnuFPP54FucxmNEVGL9d2s7fDfZqKtk_dHI`)
- Mapping tab: **MedicalPlans**
- Committed contract: `gas/Code.gs?action=premium` and `action=premiumRange`
- Range parameters: `plan_id`, `support_start_age`, `support_end_age`; legacy `retirement_age` / `coverage_age` remain accepted.
- Ages are inclusive. Missing plan, mapped sheet, or age fails safely. No medical premium is interpolated.
- Deployment status: **implemented in source; not deployed or live-verified in this environment**.

Verified path mappings from the genuine proposal schedules are:

| Genuine research path | Official plan_id | Premium tab |
| --- | --- | --- |
| AVF | `flexible_m` | 男靈活計劃 |
| AVPU | `prestige_16000` | 尊耀16000自付額 |
| Original | `select_18000` | 睿選18000自付額 |

Known Official mapping defect: `select_0` points to `睿選0自付額`, but the actual tab is `睿選 0自付額`. The contract deliberately fails safely rather than guessing.

## Forward evidence boundary

| Validation | Rows | MAPE | Max annual error | Max HKD error | First >0.10% |
| --- | ---: | ---: | ---: | ---: | --- |
| Exact genuine-path replay (calibration/regression) | 610 | 0.00000000% | 0.00000000% | 0.00 | NEVER |
| Blind contribution interpolation (holdout `5pay_avf_150k`) | 40 | 0.01039124% | 0.01416997% | 1918.60 | NEVER |

The holdout path is never used for lookup or interpolation construction. Its worst percentage row is age 85 / PY40. The largest dollar error is HKD 1918.60 at age 100 / PY55.

## Supported and unsupported paths

- **DIRECTLY_VALIDATED:** exact represented issue age, contribution anchor, Policy Year, and matched complete genuine support history.
- **INTERPOLATED_EVIDENCE_SUPPORTED:** between adjacent calibration anchors only when issue age and complete support history match.
- **NOT_YET_VALIDATED:** any unmatched repeated-support history. The engine does not substitute v3/v4/component-state/carried-ratio.
- **OUT_OF_SUPPORTED_RANGE:** contribution below HKD 40,000 or above HKD 200,000, or unsupported issue age/Policy Year.

## Remaining blockers

1. Unmatched repeated-support paths return NOT_YET_VALIDATED because no new actuarial transition is authorized.
2. The committed read-only GAS premium/premiumRange contract must be deployed and live-verified.
3. The Official MedicalPlans mapping for select_0 must be corrected to its actual premium-sheet tab name.

Production Customer Flow, UI, engine selection, Official data, and genuine fixtures remain unchanged.
