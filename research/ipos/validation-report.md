# iPOS Approximation Validation Report

ENGINE VERSION: ipos-approximation-terminal-dividend-transition-v4

## DATASET
- Calibration cases: 14
- Holdout cases: 6
- Annual rows: 1150
- Leakage check: PASS

## RESULTS
- Calibration MAPE: 1.86943871%
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
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
### 45yrs_5pay_130k_avpu_55yr
- MAPE: 3.72725523%
- Max Error %: 9.31646292%
- Max Dollar Error: HKD 273481
- Worst age / Policy Year: 67 / 22
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
### 5pay_avf_150k
- MAPE: 1.24168125%
- Max Error %: 3.47225634%
- Max Dollar Error: HKD 383896
- Worst age / Policy Year: 73 / 28
- First >0.01%: {"age": 46, "policyYear": 1}
- First >0.02%: {"age": 46, "policyYear": 1}
- First >0.05%: {"age": 46, "policyYear": 1}
- First >0.10%: {"age": 46, "policyYear": 1}
### 5pay_avpu_200k
- MAPE: 1.43531869%
- Max Error %: 5.84407899%
- Max Dollar Error: HKD 457617
- Worst age / Policy Year: 69 / 24
- First >0.01%: {"age": 62, "policyYear": 17}
- First >0.02%: {"age": 62, "policyYear": 17}
- First >0.05%: {"age": 62, "policyYear": 17}
- First >0.10%: {"age": 62, "policyYear": 17}
### 50yrs_5pay_130k_avpu
- MAPE: 3.19598594%
- Max Error %: 11.80075621%
- Max Dollar Error: HKD 151508
- Worst age / Policy Year: 72 / 22
- First >0.01%: {"age": 62, "policyYear": 12}
- First >0.02%: {"age": 62, "policyYear": 12}
- First >0.05%: {"age": 62, "policyYear": 12}
- First >0.10%: {"age": 62, "policyYear": 12}
### 70k_original
- MAPE: 2.31939632%
- Max Error %: 6.31105662%
- Max Dollar Error: HKD 108324
- Worst age / Policy Year: 77 / 32
- First >0.01%: {"age": 62, "policyYear": 17}
- First >0.02%: {"age": 62, "policyYear": 17}
- First >0.05%: {"age": 62, "policyYear": 17}
- First >0.10%: {"age": 62, "policyYear": 17}

## DIAGNOSIS
- Primary factors: terminal-dividend state recovery after a correct first withdrawal, remaining long-horizon transition behavior, and display rounding at low Policy Years.
- Evidence boundary: terminal-dividend state recovery is fitted only from calibration component rows; holdout first-withdrawal rows remain validation-only.
- Detailed first-divergence output: first-divergence-report.json and first-divergence-report.md

## ACCURACY DISTRIBUTION
- <=0.005%: 77
- <=0.01%: 77
- <=0.02%: 77
- <=0.05%: 77
- <=0.10%: 78
- >0.10%: 325

## FINAL STATUS
NOT_READY_FOR_INTEGRATION

This is a calibrated approximation and is not the official AIA/iPOS calculation engine.
