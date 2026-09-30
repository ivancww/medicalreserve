# iPOS Approximation Validation Report

ENGINE VERSION: ipos-approximation-policy-year-transition-v2

## DATASET
- Calibration cases: 14
- Holdout cases: 6
- Annual rows: 1150
- Leakage check: PASS

## RESULTS
- Calibration MAPE: 4.44962792%
- Calibration max %: 69.78829946%
- Holdout MAPE: 5.973153%
- Holdout max %: 56.85795543%
- Holdout max $: HKD 4226531
- Worst case: 45yrs_5pay_130k_avpu_55yr
- Worst age / Policy Year: 100 / 55

## HOLDOUT CROSSINGS
### 45yrs_5pay_130k_avf_55
- MAPE: 3.08201872%
- Max Error %: 14.36702676%
- Max Dollar Error: HKD 1458947
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
### 45yrs_5pay_130k_avpu_55yr
- MAPE: 12.10048489%
- Max Error %: 56.85795543%
- Max Dollar Error: HKD 4226531
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
### 5pay_avf_150k
- MAPE: 3.50464271%
- Max Error %: 17.44382132%
- Max Dollar Error: HKD 2362928
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 46, "policyYear": 1}
- First >0.02%: {"age": 46, "policyYear": 1}
- First >0.05%: {"age": 46, "policyYear": 1}
- First >0.10%: {"age": 46, "policyYear": 1}
### 5pay_avpu_200k
- MAPE: 3.61553918%
- Max Error %: 17.81448752%
- Max Dollar Error: HKD 3040568
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 61, "policyYear": 16}
- First >0.02%: {"age": 61, "policyYear": 16}
- First >0.05%: {"age": 61, "policyYear": 16}
- First >0.10%: {"age": 61, "policyYear": 16}
### 50yrs_5pay_130k_avpu
- MAPE: 12.10437629%
- Max Error %: 49.07012494%
- Max Dollar Error: HKD 2913099
- Worst age / Policy Year: 100 / 50
- First >0.01%: {"age": 62, "policyYear": 12}
- First >0.02%: {"age": 62, "policyYear": 12}
- First >0.05%: {"age": 62, "policyYear": 12}
- First >0.10%: {"age": 62, "policyYear": 12}
### 70k_original
- MAPE: 1.98924014%
- Max Error %: 5.79293774%
- Max Dollar Error: HKD 151576
- Worst age / Policy Year: 77 / 32
- First >0.01%: {"age": 61, "policyYear": 16}
- First >0.02%: {"age": 61, "policyYear": 16}
- First >0.05%: {"age": 61, "policyYear": 16}
- First >0.10%: {"age": 61, "policyYear": 16}

## DIAGNOSIS
- Primary factors: late-PY transition instability, Basic Amount reduction / GCV-funded switch approximation, and long-horizon terminal-dividend recovery.
- Evidence boundary: first withdrawal arithmetic is separately enforced where proposal evidence supports it; later rows use the fitted transition model.

## ACCURACY DISTRIBUTION
- <=0.005%: 74
- <=0.01%: 74
- <=0.02%: 75
- <=0.05%: 77
- <=0.10%: 81
- >0.10%: 325

## FINAL STATUS
NOT_READY_FOR_INTEGRATION

This is a calibrated approximation and is not the official AIA/iPOS calculation engine.
