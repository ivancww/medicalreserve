# Component-State Phase A / Iteration 3 — FINAL

Research approximation calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.

Starting HEAD: `13489029fdc7615eaadc7c4870706007f2c3f7ad`

Candidate: **ipos-approximation-independent-component-state-phase-a-iteration-3-td-annual-increment**

Decision: **ITERATION_3_REJECTED**. Retained engine: **ipos-approximation-terminal-dividend-transition-v4**. Status: **NOT_READY_FOR_INTEGRATION**.

## Locked hypothesis

Restore Iteration 1 RB and test a parameter-free carried TD state replenished only by the genuine annual no-withdrawal TD curve increment.

Formula: `TD_after(PY) = TD_after(PY-1) + [TD_base(PY, Basic Amount entering PY) - TD_base(PY-1, same Basic Amount)] - withdrawalFromTD(PY)`

TD free parameters: 0. Basic Amount basis: Basic Amount entering the policy year (previous annual row post-withdrawal amount), used for both adjacent normalized no-withdrawal TD curve points.

Model lock: `fce66985c0c82da55e1f4578268922a0684be9b9a739a6f10a259e2cf23e75f2`.

## Calibration-only TD diagnosis

Eligible transitions: 556. Mean signed residual HKD 30492.00053789; mean absolute residual HKD 30584.55835794; maximum absolute residual HKD 130297.22780693.

Before prior GCV tap MAE: HKD 16511.26027397; after prior GCV tap MAE: HKD 35596.02548053.

Horizon bias: years 1–5 signed mean HKD 3331.11331163; years 6–15 HKD 14237.15239823; years 16+ HKD 42564.08390607. Bias grows: true.

Calibration residual is positive and grows materially with horizon; the parameter-free TD annual-increment hypothesis is structurally insufficient without fitted repair.

## First-withdrawal gate

PASS

| Case | Age / PY | GCV error | RB error | TD error | Total error | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 40yrs_5pay_130k_avf | 61 / 21 | 0 | 0 | 0 | 0 | PASS |
| 40yrs_5pay_130k_avpu | 61 / 21 | 0 | 0 | 0 | 0 | PASS |
| 45yrs_5pay_130k_avf_55 | 55 / 10 | 0 | 0 | 0 | 0 | PASS |
| 45yrs_5pay_130k_avpu_55yr | 55 / 10 | 0 | 0 | 0 | 0 | PASS |
| 45yrs_5pay_130k_avf_56_60 | 56 / 11 | 0 | -1 | 0 | 0 | PASS |
| 45yrs_5pay_180k_56_60 | 56 / 11 | 0 | 0 | 0 | 1 | PASS |
| 45yrs_5pay_130k_avf | 61 / 16 | 0 | -1 | 1 | 0 | PASS |
| 5pay_avf_150k | 61 / 16 | 0 | -1 | 0 | 0 | PASS |
| 5pay_avf_200k | 61 / 16 | 0 | 0 | 0 | 0 | PASS |
| 5pay_avpu_200k | 61 / 16 | 0 | 1 | -1 | 0 | PASS |
| 5pay_180k_avf | 61 / 16 | 0 | -1 | 1 | 0 | PASS |
| 5pay_180k_avpu | 61 / 16 | 0 | 0 | 0 | 0 | PASS |
| 50yrs_5pay_130k_avf | 61 / 11 | 0 | 0 | 0 | 0 | PASS |
| 50yrs_5pay_130k_avpu | 61 / 11 | 0 | 0 | 0 | 0 | PASS |
| 50yrs_5pay_180k_avf | 61 / 11 | 0 | 0 | 0 | 1 | PASS |
| 50yrs_5pay_180k_avpu | 61 / 11 | 0 | 1 | 0 | 1 | PASS |
| 70k_avf | 61 / 16 | 0 | 0 | 1 | 1 | PASS |
| 70k_avpu | 61 / 16 | 0 | 0 | 0 | 1 | PASS |
| 70k_original | 61 / 16 | 0 | 0 | 0 | 1 | PASS |
| 100k_original | 61 / 16 | 0 | -1 | 0 | 0 | PASS |

## Five-row component gate

FAIL. Every component and total <=0.10% of its genuine component value, or <=HKD1 displayed rounding; zero denominator judged by dollars.

### 45yrs_5pay_130k_avf_55: age 56 / PY11

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 351874 | 351874 | 0 | 0 |
| RB | 61482 | 61481 | -1 | -0.00162649 |
| TD | 444685 | 445063 | 378 | 0.08500399 |
| total | 858040 | 858418 | 378 | 0.04405389 |

Basic Amount: genuine 1323829; model 1323829; difference 0.

TD vs Iteration 1: I1 error -480; I3 error 378; absolute improvement 102. Result: PASS.

### 45yrs_5pay_130k_avpu_55yr: age 56 / PY11

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 351874 | 351874 | 0 | 0 |
| RB | 52892 | 52892 | 0 | 0 |
| TD | 441928 | 442443 | 515 | 0.11653482 |
| total | 846694 | 847209 | 515 | 0.06082481 |

Basic Amount: genuine 1323829; model 1323829; difference 0.

TD vs Iteration 1: I1 error 142; I3 error 515; absolute improvement -373. Result: FAIL.

### 5pay_avpu_200k: age 62 / PY17

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 729520 | 729520 | 0 | 0 |
| RB | 115740 | 115741 | 1 | 0.00086401 |
| TD | 1135445 | 1136485 | 1040 | 0.09159404 |
| total | 1980705 | 1981746 | 1041 | 0.05255704 |

Basic Amount: genuine 2042901; model 2042901; difference 0.

TD vs Iteration 1: I1 error -1329; I3 error 1040; absolute improvement 289. Result: PASS.

### 50yrs_5pay_130k_avpu: age 62 / PY12

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 370805 | 370805 | 0 | 0 |
| RB | 42715 | 42715 | 0 | 0 |
| TD | 475557 | 476300 | 743 | 0.15623784 |
| total | 889076 | 889820 | 744 | 0.08368238 |

Basic Amount: genuine 1323829; model 1323829; difference 0.

TD vs Iteration 1: I1 error 1097; I3 error 743; absolute improvement 354. Result: FAIL.

### 70k_original: age 62 / PY17

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 253777 | 253777 | 0 | 0 |
| RB | 25170 | 25169 | -1 | -0.00397298 |
| TD | 387047 | 387817 | 770 | 0.19894225 |
| total | 665993 | 666763 | 770 | 0.11561683 |

Basic Amount: genuine 710660; model 710660; difference 0.

TD vs Iteration 1: I1 error 1300; I3 error 770; absolute improvement 530. Result: FAIL.

## Zero-withdrawal persistence

PASS. Persistence-only structure; not a claim of full pause/resume numerical accuracy.

## One frozen holdout evaluation

| Metric | v4 | Iteration 1 | Iteration 2 | Iteration 3 |
| --- | --- | --- | --- | --- |
| MAPE | 2.29650947 | 4.78519701 | 4.74623296 | 5.51908644 |
| maxErrorPercent | 11.80075621 | 44.75947355 | 43.38385216 | 12.05713439 |
| rowsAbove010 | 247 | 232 | 238 | 243 |
| annualRows | 325 | 325 | 325 | 325 |
| maxDollarError | 457617 | 4545248 | 4405556 | 1660297 |
| worstCase | 50yrs_5pay_130k_avpu | 45yrs_5pay_130k_avf_55 | 45yrs_5pay_130k_avf_55 | 45yrs_5pay_130k_avpu_55yr |
| worstAge | 72 | 100 | 100 | 100 |
| worstPolicyYear | 22 | 55 | 55 | 55 |

Leakage: PASS. Holdout projection count after lock: 1.

Impossible component states: calibration 5; holdout 1; total 6.

Known impossible allocation rows remain frozen: calibration 1; holdout 2. The audited age-100 HKD85/8/2 rows remain unchanged and unallocated.

## Decision

Calibration falsifies the parameter-free TD annual-increment transition through a positive horizon-growing bias; the candidate does not satisfy all component, structural and frozen-holdout retention gates. v4 remains retained.

TD result: 4 of 5 immediate rows reduce absolute TD error versus Iteration 1; calibration bias grows from HKD 3331.11331163 in years 1-5 to HKD 42564.08390607 in years 16+.

Dominant remaining failure: TD transition requires a different evidence-supported state law; simple additive no-withdrawal TD accrual systematically overstates genuine carried TD.

Recommended next research phase: Phase B: identify a non-additive TD state invariant from calibration transitions before defining any new candidate or coefficient.

Iterations 1 and 2 remain unchanged. No production, UI, portfolio, fixture, role or baseline file changed. No Iteration 4 was run.
