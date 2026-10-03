# Component-State Phase A / Iteration 1

Approximation research calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.

Decision: **ITERATION_1_REJECTED**. Retained engine: **ipos-approximation-terminal-dividend-transition-v4**. Status: **NOT_READY_FOR_INTEGRATION**.

## Baseline and hypothesis

Independent GCV and Basic Amount with persistent RB depletion and the existing standalone v4 TD transition can repair the aggregate-state component mismatch.

Frozen v4: {"MAPE":2.29650947,"maxErrorPercent":11.80075621,"rowsAbove010":247,"annualRows":325,"maxDollarError":457617,"worstCase":"50yrs_5pay_130k_avpu","worstAge":72,"worstPolicyYear":22}. Baseline records unchanged.

## Architecture

- basicAmountState: Unchanged at zero GCV tap; v4 calibration reduction coefficient times fromGCV/GCV_per_BasicAmount(PY) otherwise.
- gcvState: Annual GCV_per_BasicAmount(PY) times current Basic Amount, minus current genuine GCV allocation only; never scaled by aggregate surrender value.
- rbState: Annual RB base minus previous RB deficit times one calibration median persistence factor (and capital ratio only after a GCV tap), minus current RB allocation.
- tdState: Independent previous TD and associated TD withdrawal feed the existing seven-feature v4 TD transition; subtract current TD allocation. No aggregate-state ratio.
- baseCurves: Full committed genuine annual calibration GCV/RB/TD per Basic Amount; existing anchor interpolation. Total is sum of components.
- negativeStates: Clamp at zero but report impossible component allocations as structural failures; never hide the clamp.

## Calibration boundary

- Only frozen calibration fixtures and matching frozen calibration source records used for construction.
- One median RB factor from clean same-Basic-Amount consecutive rows with previous RB deficit >HKD10 (rounding noise exclusion). Includes genuine pause rows.
- Reuse v4 TD regression feature form; complete calibration annual base evidence replaces sparse interpolation.
- Frozen schedules, roles and targets unchanged. Genuine withdrawal allocations are supplied inputs; this is not an allocation-generating formula.
- Five priority rows and full holdout are evaluation-only; no refit, search, tuning or second iteration.

RB persistence: 1.0244991772664351; 133 clean calibration transitions. Base sum identity maximum residual: HKD 1.

Model locked before holdout: 79c913a9f778c28846b17518f29b199f42bddf68603cd98cf74fe9d7f76061a7. Frozen roles and fixture hash are recorded in JSON.

## First-withdrawal gate

PASS

| Case | Age / PY | Source total identity residual | Model total identity residual | GCV error | RB error | TD error | Total error | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40yrs_5pay_130k_avf | 61 / 21 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 40yrs_5pay_130k_avpu | 61 / 21 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 45yrs_5pay_130k_avf_55 | 55 / 10 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 45yrs_5pay_130k_avpu_55yr | 55 / 10 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 45yrs_5pay_130k_avf_56_60 | 56 / 11 | 0 | 0 | 0 | -1 | 0 | 0 | PASS |
| 45yrs_5pay_180k_56_60 | 56 / 11 | 0 | 0 | 0 | 0 | 0 | 1 | PASS |
| 45yrs_5pay_130k_avf | 61 / 16 | 0 | 0 | 0 | -1 | 1 | 0 | PASS |
| 5pay_avf_150k | 61 / 16 | 0 | 0 | 0 | -1 | 0 | 0 | PASS |
| 5pay_avf_200k | 61 / 16 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 5pay_avpu_200k | 61 / 16 | 0 | 0 | 0 | 1 | -1 | 0 | PASS |
| 5pay_180k_avf | 61 / 16 | 0 | 0 | 0 | -1 | 1 | 0 | PASS |
| 5pay_180k_avpu | 61 / 16 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 50yrs_5pay_130k_avf | 61 / 11 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 50yrs_5pay_130k_avpu | 61 / 11 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| 50yrs_5pay_180k_avf | 61 / 11 | 0 | 0 | 0 | 0 | 0 | 1 | PASS |
| 50yrs_5pay_180k_avpu | 61 / 11 | 0 | 0 | 0 | 1 | 0 | 1 | PASS |
| 70k_avf | 61 / 16 | 0 | 0 | 0 | 0 | 1 | 1 | PASS |
| 70k_avpu | 61 / 16 | 0 | 0 | 0 | 0 | 0 | 1 | PASS |
| 70k_original | 61 / 16 | 0 | 0 | 0 | 0 | 0 | 1 | PASS |
| 100k_original | 61 / 16 | 0 | 0 | 0 | -1 | 0 | 0 | PASS |

## Five-row component gate

FAIL. Every individual component AND total <=0.10% of its own genuine value, or <=HKD1 displayed rounding; zero denominator reported null and judged by dollars.

### 45yrs_5pay_130k_avf_55: age 56 / PY11

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % of component | % of genuine total |
| --- | --- | --- | --- | --- | --- |
| GCV | 351874 | 351874 | 0 | 0 | 0 |
| RB | 61482 | 61481 | -1 | -0.00162649 | -0.00011654 |
| TD | 444685 | 444205 | -480 | -0.10794158 | -0.05594145 |
| total | 858040 | 857560 | -480 | -0.05594145 | -0.05594145 |

Result: FAIL. Basic Amount: genuine 1323829; model 1323829.

### 45yrs_5pay_130k_avpu_55yr: age 56 / PY11

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % of component | % of genuine total |
| --- | --- | --- | --- | --- | --- |
| GCV | 351874 | 351874 | 0 | 0 | 0 |
| RB | 52892 | 52892 | 0 | 0 | 0 |
| TD | 441928 | 442070 | 142 | 0.03213193 | 0.01677111 |
| total | 846694 | 846836 | 142 | 0.01677111 | 0.01677111 |

Result: PASS. Basic Amount: genuine 1323829; model 1323829.

### 5pay_avpu_200k: age 62 / PY17

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % of component | % of genuine total |
| --- | --- | --- | --- | --- | --- |
| GCV | 729520 | 729520 | 0 | 0 | 0 |
| RB | 115740 | 115741 | 1 | 0.00086401 | 0.00005049 |
| TD | 1135445 | 1134116 | -1329 | -0.11704662 | -0.06709732 |
| total | 1980705 | 1979377 | -1328 | -0.06704683 | -0.06704683 |

Result: FAIL. Basic Amount: genuine 2042901; model 2042901.

### 50yrs_5pay_130k_avpu: age 62 / PY12

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % of component | % of genuine total |
| --- | --- | --- | --- | --- | --- |
| GCV | 370805 | 370805 | 0 | 0 | 0 |
| RB | 42715 | 42715 | 0 | 0 | 0 |
| TD | 475557 | 476654 | 1097 | 0.23067687 | 0.12338653 |
| total | 889076 | 890174 | 1098 | 0.123499 | 0.123499 |

Result: FAIL. Basic Amount: genuine 1323829; model 1323829.

### 70k_original: age 62 / PY17

| Component | Genuine HKD | Model HKD | Signed HKD error | Signed % of component | % of genuine total |
| --- | --- | --- | --- | --- | --- |
| GCV | 253777 | 253777 | 0 | 0 | 0 |
| RB | 25170 | 25169 | -1 | -0.00397298 | -0.00015015 |
| TD | 387047 | 388347 | 1300 | 0.33587652 | 0.19519725 |
| total | 665993 | 667294 | 1301 | 0.1953474 | 0.1953474 |

Result: FAIL. Basic Amount: genuine 710660; model 710660.

## Zero-withdrawal persistence

PASS. Persistence-only gate; genuine pause component errors included, not certification of pause/resume accuracy.

| Source case | Zero rows | Result |
| --- | --- | --- |
| 45yrs_5pay_180k_56_60 / ipos-3afcb35b16f2ab2f | 5 | PASS |
| 45yrs_5pay_180k_56_60 / ipos-3afcb35b16f2ab2f | 5 | PASS |
| 45yrs_5pay_130k_avf_56_60 / ipos-cf93323294f22530 | 5 | PASS |
| 45yrs_5pay_130k_avf_56_60 / ipos-cf93323294f22530 | 5 | PASS |
| 40k_base / ipos-500fbc7cf3a698d8 | 6 | PASS |
| 40k_base / ipos-500fbc7cf3a698d8 | 4 | PASS |
| 40k_base / ipos-500fbc7cf3a698d8 | 9 | PASS |

GCV is allowed to equal its unaffected curve where no GCV tap occurred. This is independent preservation, not a reset. RB deficit, TD history and Basic Amount persist. Per-row genuine/model component errors are in JSON.

## One frozen holdout evaluation

| Metric | v4 | Iteration 1 |
| --- | --- | --- |
| MAPE | 2.29650947 | 4.78519701 |
| maxErrorPercent | 11.80075621 | 44.75947355 |
| rowsAbove010 | 247 | 232 |
| annualRows | 325 | 325 |
| maxDollarError | 457617 | 4545248 |
| worstCase | 50yrs_5pay_130k_avpu | 45yrs_5pay_130k_avf_55 |
| worstAge | 72 | 100 |
| worstPolicyYear | 22 | 55 |

Impossible component allocation rows: 1; calibration: 5.

## Leakage and decision

Leakage: PASS. GCV is exact and RB is within HKD1 at all five rows, but four TD rows fail the component gate. Frozen maximum error and MAPE worsen substantially; negative raw component states also expose an insufficient independent transition. v4 remains retained.

Smallest next hypothesis (not implemented; unproven): Test whether RB replenishment should follow the annual increment in the no-withdrawal RB curve after Basic Amount reduction, rather than carrying a capital-scaled RB deficit.

No production changes, no portfolio changes, no baseline replacement, no Iteration 2, no merge.

## Frozen schedule caveat

The three previously audited age-100 anomalies remain unchanged: HKD85/8/2 withdrawals with zero component allocations. No component split is invented and no named-case correction is applied. The JSON records allocation residuals separately. Benchmark schedules and targets remain frozen.

## Executed validation

- Node regression: PASS, 26 passed / 0 failed (includes v4 frozen metrics and holdout poisoning protection).
- Relevant Python evidence validation: PASS; no source extraction or artifact regeneration.
- Component-state report validation: PASS; checks saved predictions only, no new holdout projection.
- Node and Python syntax: PASS.
- Frozen-role, leakage, protected-file and whitespace checks: PASS.
- First-withdrawal: PASS; five-row component gate: FAIL; zero-withdrawal persistence: PASS.
- Browser/device testing: not applicable to this research checkpoint and not executed.
