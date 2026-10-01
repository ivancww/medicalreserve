# Component-State Phase A / Iteration 2

Research approximation calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.

Starting HEAD: `39fb72b8d6b218188139534299985f605591fa4b`

Candidate: **ipos-approximation-independent-component-state-phase-a-iteration-2-rb-annual-increment**

Decision: **ITERATION_2_REJECTED**. Retained engine: **ipos-approximation-terminal-dividend-transition-v4**. Status: **NOT_READY_FOR_INTEGRATION**.

## Locked hypothesis

RB replenishment follows the annual increment in the genuine no-withdrawal RB curve instead of a capital-scaled carried deficit.

Formula: `RB_after(PY) = RB_after(PY-1) + [RB_base(PY,current Basic Amount) - RB_base(PY-1,current Basic Amount)] - withdrawalFromRB(PY)`

RB free parameters: 0. Model lock: `a164ff7350d9649034fad2cdbffdc9be5a913ef1f5149594d990e24893202547`.

Calibration evidence: 556 affected transitions; mean absolute residual HKD 1978.02403544; median signed residual HKD 1270.43819304; maximum absolute residual HKD 6523.123144; 0 within HKD1.

The RB rule has zero fitted parameters; each source therefore tests the same rule without source-specific fitting.

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

FAIL. Every individual component and total <=0.10% of its genuine component value, or <=HKD1 displayed rounding; zero denominators are judged by dollars.

### 45yrs_5pay_130k_avf_55: age 56 / PY11

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 351874 | 351874 | 0 | 0 |
| RB | 61482 | 61747 | 265 | 0.43102046 |
| TD | 444685 | 444205 | -480 | -0.10794158 |
| total | 858040 | 857826 | -214 | -0.02494056 |

Basic Amount: genuine 1323829; model 1323829. Result: FAIL.

### 45yrs_5pay_130k_avpu_55yr: age 56 / PY11

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 351874 | 351874 | 0 | 0 |
| RB | 52892 | 53254 | 362 | 0.68441352 |
| TD | 441928 | 442070 | 142 | 0.03213193 |
| total | 846694 | 847198 | 504 | 0.05952564 |

Basic Amount: genuine 1323829; model 1323829. Result: FAIL.

### 5pay_avpu_200k: age 62 / PY17

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 729520 | 729520 | 0 | 0 |
| RB | 115740 | 116197 | 457 | 0.39485053 |
| TD | 1135445 | 1134116 | -1329 | -0.11704662 |
| total | 1980705 | 1979833 | -872 | -0.04402473 |

Basic Amount: genuine 2042901; model 2042901. Result: FAIL.

### 50yrs_5pay_130k_avpu: age 62 / PY12

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 370805 | 370805 | 0 | 0 |
| RB | 42715 | 43227 | 512 | 1.19864216 |
| TD | 475557 | 476654 | 1097 | 0.23067687 |
| total | 889076 | 890686 | 1610 | 0.18108688 |

Basic Amount: genuine 1323829; model 1323829. Result: FAIL.

### 70k_original: age 62 / PY17

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % error |
| --- | --- | --- | --- | --- |
| GCV | 253777 | 253777 | 0 | 0 |
| RB | 25170 | 25507 | 337 | 1.33889551 |
| TD | 387047 | 388347 | 1300 | 0.33587652 |
| total | 665993 | 667631 | 1638 | 0.24594853 |

Basic Amount: genuine 710660; model 710660. Result: FAIL.

## Zero-withdrawal persistence

PASS. Persistence-only structure; not a claim of full pause/resume numerical accuracy.

## Single frozen holdout evaluation

| Metric | v4 | Iteration 1 | Iteration 2 |
| --- | --- | --- | --- |
| MAPE | 2.29650947 | 4.78519701 | 4.74623296 |
| maxErrorPercent | 11.80075621 | 44.75947355 | 43.38385216 |
| rowsAbove010 | 247 | 232 | 238 |
| annualRows | 325 | 325 | 325 |
| maxDollarError | 457617 | 4545248 | 4405556 |
| worstCase | 50yrs_5pay_130k_avpu | 45yrs_5pay_130k_avf_55 | 45yrs_5pay_130k_avf_55 |
| worstAge | 72 | 100 | 100 |
| worstPolicyYear | 22 | 55 | 55 |

Leakage: PASS. Holdout projection count after lock: 1.

Impossible component rows: calibration 0; holdout 0.

The frozen age-100 HKD85/8/2 schedule anomalies remain unchanged and unallocated.

## Decision

The parameter-free annual-increment rule changes Iteration 1 RB errors from within HKD1 to HKD265-512 across the five rows; all five component rows fail, and frozen maximum error remains materially worse than v4. v4 remains retained.

Dominant remaining issue: TD transition.

Smallest next hypothesis (not implemented): Restore the Iteration 1 RB transition, then test one parameter-free TD carried state plus genuine no-withdrawal annual TD increment using calibration evidence only.

Iteration 1 artifacts remain unchanged. No production, portfolio, fixture, role or baseline file changed. No Iteration 3 was run.
