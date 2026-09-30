# TD Transition Research

Starting head: 1a3e2e18ceedf9f25ac98476aae12e3ec82a0597

Calibration-only dataset. This is a research approximation, not an official AIA formula.

Consecutive pairs: 206; exact clean fitting pairs: 27.
No-withdrawal fields refer to original Basic Amount. After Basic Amount reduction these deficits conflate capital reduction and TD carryover and are excluded from fit. Interpolated bases are estimates and excluded from fit.

## Three bounded iterations

| Iteration | Hypothesis | Coefficients | Calibration LOCO max % | Target gate | Full holdout | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A_deficitPersistence | 1.12316475 | 0.15918369 | REJECTED | NOT RUN: targeted gate failed | REJECTED_RETAIN_V4 |
| 2 | B_deficitAndAssociatedShock | 1.13207305, -0.03320946 | 0.17137199 | REJECTED | NOT RUN: targeted gate failed | REJECTED_RETAIN_V4 |
| 3 | C_deficitAndRBDepletion | 1.20693460, -0.04069369 | 0.27585704 | REJECTED | NOT RUN: targeted gate failed | REJECTED_RETAIN_V4 |

CV is leave-one-calibration-case-out, with withheld-case annual base sources excluded. CV measures teacher-forced TD component error divided by remaining surrender, not full-policy accuracy.

Models: A = next pre-withdrawal TD deficit = k × previous post-withdrawal TD deficit; B adds previous associated TD withdrawal; C adds previous RB deficit. All fit without an intercept and preserve a zero unaffected deficit. Runtime RB deficit in C is inferred from previous remaining − TD − base GCV; it is not read from proposal targets.

## Immediate second-withdrawal evaluation

| Case / age / PY | v4 % | A % | B % | C % | Exact TD only, non-TD residual % |
| --- | --- | --- | --- | --- | --- |
| 45yrs_5pay_130k_avf_55 / 56 / 11 | 0.25733066 | 0.65603002 | 0.66500396 | 0.67630880 | 0.65766165 |
| 45yrs_5pay_130k_avpu_55yr / 56 / 11 | 0.66529348 | 1.01311690 | 1.02551807 | 1.04110812 | 1.01547903 |
| 5pay_avpu_200k / 62 / 17 | 1.21683946 | 1.75038686 | 1.76139304 | 1.75058881 | 0.65850291 |
| 50yrs_5pay_130k_avpu / 62 / 12 | 1.15310727 | 1.43834723 | 1.45668087 | 1.47074041 | 1.44768276 |
| 70k_original / 62 / 17 | 2.19972282 | 2.56339031 | 2.58771489 | 2.56399091 | 1.43785295 |

The exact-TD substitution is evaluation-only and never an engine, coefficient source, or final-value fit.

## Policy-Year regions

- PY10–14: 15 exact clean pairs; PY 12, 13, 14; persistence 1.1232894347162576; NOT RETAINED. Sparse/unbalanced exact-year evidence; no demonstrated case-held-out regional generalization advantage; PY25+ unavailable.
- PY15–19: 10 exact clean pairs; PY 15, 17, 18, 19, 16; persistence 1.1030059978979376; NOT RETAINED. Sparse/unbalanced exact-year evidence; no demonstrated case-held-out regional generalization advantage; PY25+ unavailable.
- PY20–24: 2 exact clean pairs; PY 20, 21; persistence 1.153144246112975; NOT RETAINED. Sparse/unbalanced exact-year evidence; no demonstrated case-held-out regional generalization advantage; PY25+ unavailable.
- PY25+: 0 exact clean pairs; PY none; persistence unidentifiable; NOT RETAINED. Sparse/unbalanced exact-year evidence; no demonstrated case-held-out regional generalization advantage; PY25+ unavailable.

## Diagnosis

- Only 27 consecutive pre-GCV pairs have exact-year calibration base evidence; 206 consecutive pairs exist in total.
- Simple exact-evidence deficit persistence is approximately 1.12, but extrapolation is contaminated by missing annual base TD and aggregate-derived non-TD state.
- Even replacing TD with the genuine displayed TD leaves material second-withdrawal errors in the frozen aggregate-derived GCV/RB contribution. TD-only component substitution cannot repair that contribution.
- No new model is retained; no coefficient uses a holdout target. All three immediate-row gates rejected the candidates.

## Additional genuine evidence

- Matched annual no-withdrawal GCV/RB/TD tables (not only five-year checkpoints) for calibration premiums 70k, 100k, 130k, 180k, 200k through PY10–30.
- Matched same-policy consecutive annual post-withdrawal component rows and RB/associated-TD withdrawal allocations; vary withdrawal amount and start Policy Year independently.
- Genuine zero-withdrawal pause/resume proposals with affected TD/RB states before, during and after the pause; no pause/resume accuracy claim is made.
- Structural explanation or proposal evidence connecting RB remaining, associated TD cash withdrawal and next-year TD entitlement; isolate this from Basic Amount/GCV reduction.

## Retained result

v4: MAPE 2.29650947%; max 11.80075621%; rows >0.10% 247; worst 50yrs_5pay_130k_avpu, age 72 / PY22. Leakage PASS.
All three candidates are rejected and are available only in the isolated experiment harness. Production and baseline model selection remain unchanged.

NOT_READY_FOR_INTEGRATION

## TD component error (relative to remaining surrender)

| Target case | v4 % | A % | B % | C % |
| --- | --- | --- | --- | --- |
| 45yrs_5pay_130k_avf_55 | 0.40033099 | 0.00174817 | 0.00734232 | 0.01864715 |
| 45yrs_5pay_130k_avpu_55yr | 0.35018555 | 0.00236213 | 0.01003905 | 0.02562909 |
| 5pay_avpu_200k | 0.55833655 | 1.09188395 | 1.10289013 | 1.09208590 |
| 50yrs_5pay_130k_avpu | 0.29457549 | 0.00933553 | 0.00899811 | 0.02305765 |
| 70k_original | 0.76186987 | 1.12568751 | 1.15001209 | 1.12613796 |

## Bounded TD continuation

Retained model: v4 unchanged. Three candidates rejected at the immediate-row gate; no additional candidate full holdout runs.
The legacy aggregate ratio also supplies non-TD state; exact-TD replacement alone leaves material non-TD residuals before GCV tapping. No unrelated layer is redesigned in this cycle.

## Frozen holdout summary

Leakage: PASS; MAPE: 2.29650947%; maximum annual error: 11.80075621%; rows >0.10%: 247; max dollar error: HKD 457617.

| Case | MAPE % | Max % | Max HKD | Worst age / PY | First >0.01% | >0.02% | >0.05% | >0.10% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 45yrs_5pay_130k_avf_55 | 1.94118998 | 6.2919885 | 281724 | 63 / 18 | 56 / 11 | 56 / 11 | 56 / 11 | 56 / 11 |
| 45yrs_5pay_130k_avpu_55yr | 3.72725523 | 9.31646292 | 273481 | 67 / 22 | 56 / 11 | 56 / 11 | 56 / 11 | 56 / 11 |
| 5pay_avf_150k | 1.24168125 | 3.47225634 | 383896 | 73 / 28 | 46 / 1 | 46 / 1 | 46 / 1 | 46 / 1 |
| 5pay_avpu_200k | 1.43531869 | 5.84407899 | 457617 | 69 / 24 | 62 / 17 | 62 / 17 | 62 / 17 | 62 / 17 |
| 50yrs_5pay_130k_avpu | 3.19598594 | 11.80075621 | 151508 | 72 / 22 | 62 / 12 | 62 / 12 | 62 / 12 | 62 / 12 |
| 70k_original | 2.31939632 | 6.31105662 | 108324 | 77 / 32 | 62 / 17 | 62 / 17 | 62 / 17 | 62 / 17 |

Further proposal evidence is listed in td-transition-research.md. No production engine or Customer Flow change.

## Verification

Node regression tests: PASS. Syntax: PASS. Python syntax: PASS. Schema: PASS. Fixture schedule consistency: FAIL.
Three age-100 rows say zero withdrawal but their schedule has HKD 85, 8 and 2 respectively. The frozen fixture is preserved; genuine proposals must be checked before correction.
Browser / physical-device UI verification: NOT VERIFIED; no production/UI changes. This research result does not certify Platform integration.
