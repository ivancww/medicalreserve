# iPOS Approximation Validation Report

ENGINE VERSION: ipos-approximation-terminal-dividend-transition-v4

## DATASET
- Calibration cases: 14
- Holdout cases: 6
- Annual rows: 1150
- Leakage check: PASS

## RESULTS
- Calibration MAPE: 1.86943891%
- Calibration max %: 13.93226392%
- Holdout MAPE: 2.29650947%
- Holdout max %: 11.80075621%
- Holdout max $: HKD 457617
- Worst case: 50yrs_5pay_130k_avpu
- Worst age / Policy Year: 72 / 22

## HOLDOUT CROSSINGS
### 45yrs_5pay_130k_avf_55
- MAPE: 1.94118998%
- Max Error %: 6.2919885%
- Max Dollar Error: HKD 281724
- Worst age / Policy Year: 63 / 18
- First >0.01%: {"age":56,"policyYear":11}
- First >0.02%: {"age":56,"policyYear":11}
- First >0.05%: {"age":56,"policyYear":11}
- First >0.10%: {"age":56,"policyYear":11}
### 45yrs_5pay_130k_avpu_55yr
- MAPE: 3.72725523%
- Max Error %: 9.31646292%
- Max Dollar Error: HKD 273481
- Worst age / Policy Year: 67 / 22
- First >0.01%: {"age":56,"policyYear":11}
- First >0.02%: {"age":56,"policyYear":11}
- First >0.05%: {"age":56,"policyYear":11}
- First >0.10%: {"age":56,"policyYear":11}
### 5pay_avf_150k
- MAPE: 1.24168125%
- Max Error %: 3.47225634%
- Max Dollar Error: HKD 383896
- Worst age / Policy Year: 73 / 28
- First >0.01%: {"age":46,"policyYear":1}
- First >0.02%: {"age":46,"policyYear":1}
- First >0.05%: {"age":46,"policyYear":1}
- First >0.10%: {"age":46,"policyYear":1}
### 5pay_avpu_200k
- MAPE: 1.43531869%
- Max Error %: 5.84407899%
- Max Dollar Error: HKD 457617
- Worst age / Policy Year: 69 / 24
- First >0.01%: {"age":62,"policyYear":17}
- First >0.02%: {"age":62,"policyYear":17}
- First >0.05%: {"age":62,"policyYear":17}
- First >0.10%: {"age":62,"policyYear":17}
### 50yrs_5pay_130k_avpu
- MAPE: 3.19598594%
- Max Error %: 11.80075621%
- Max Dollar Error: HKD 151508
- Worst age / Policy Year: 72 / 22
- First >0.01%: {"age":62,"policyYear":12}
- First >0.02%: {"age":62,"policyYear":12}
- First >0.05%: {"age":62,"policyYear":12}
- First >0.10%: {"age":62,"policyYear":12}
### 70k_original
- MAPE: 2.31939632%
- Max Error %: 6.31105662%
- Max Dollar Error: HKD 108324
- Worst age / Policy Year: 77 / 32
- First >0.01%: {"age":62,"policyYear":17}
- First >0.02%: {"age":62,"policyYear":17}
- First >0.05%: {"age":62,"policyYear":17}
- First >0.10%: {"age":62,"policyYear":17}

## ACCURACY DISTRIBUTION
- <=0.005%: 77
- <=0.01%: 77
- <=0.02%: 77
- <=0.05%: 77
- <=0.10%: 78
- >0.10%: 247

## FINAL STATUS
NOT_READY_FOR_INTEGRATION

This is a calibrated approximation and is not the official AIA/iPOS calculation engine.

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
