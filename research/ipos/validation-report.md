# iPOS Approximation Validation Report

ENGINE VERSION: ipos-approximation-component-state-v1

## DATASET
- Calibration cases: 14
- Holdout cases: 6
- Annual rows: 1150
- Leakage check: PASS

## RESULTS
- Calibration MAPE: 15.61429359%
- Calibration max %: 100.0%
- Holdout MAPE: 17.17569366%
- Holdout max %: 57.11395611%
- Holdout max $: HKD 4981831
- Worst case: 70k_original
- Worst age / Policy Year: 99 / 54

## HOLDOUT CROSSINGS
### 45yrs_5pay_130k_avf_55
- MAPE: 13.72573992%
- Max Error %: 31.92708767%
- Max Dollar Error: HKD 3057336
- Worst age / Policy Year: 99 / 54
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 57, "policyYear": 12}
- First >0.10%: {"age": 58, "policyYear": 13}
### 45yrs_5pay_130k_avpu_55yr
- MAPE: 20.76991728%
- Max Error %: 49.15042209%
- Max Dollar Error: HKD 3445334
- Worst age / Policy Year: 99 / 54
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 57, "policyYear": 12}
- First >0.10%: {"age": 58, "policyYear": 13}
### 5pay_avf_150k
- MAPE: 12.67198879%
- Max Error %: 28.31620191%
- Max Dollar Error: HKD 3617055
- Worst age / Policy Year: 99 / 54
- First >0.01%: {"age": 61, "policyYear": 16}
- First >0.02%: {"age": 61, "policyYear": 16}
- First >0.05%: {"age": 61, "policyYear": 16}
- First >0.10%: {"age": 61, "policyYear": 16}
### 5pay_avpu_200k
- MAPE: 13.78433491%
- Max Error %: 30.95254501%
- Max Dollar Error: HKD 4981831
- Worst age / Policy Year: 99 / 54
- First >0.01%: {"age": 61, "policyYear": 16}
- First >0.02%: {"age": 61, "policyYear": 16}
- First >0.05%: {"age": 61, "policyYear": 16}
- First >0.10%: {"age": 61, "policyYear": 16}
### 50yrs_5pay_130k_avpu
- MAPE: 17.6733614%
- Max Error %: 44.25416066%
- Max Dollar Error: HKD 2477147
- Worst age / Policy Year: 99 / 49
- First >0.01%: {"age": 62, "policyYear": 12}
- First >0.02%: {"age": 62, "policyYear": 12}
- First >0.05%: {"age": 63, "policyYear": 13}
- First >0.10%: {"age": 63, "policyYear": 13}
### 70k_original
- MAPE: 24.47406218%
- Max Error %: 57.11395611%
- Max Dollar Error: HKD 1997082
- Worst age / Policy Year: 99 / 54
- First >0.01%: {"age": 61, "policyYear": 16}
- First >0.02%: {"age": 61, "policyYear": 16}
- First >0.05%: {"age": 61, "policyYear": 16}
- First >0.10%: {"age": 61, "policyYear": 16}

## DIAGNOSIS
- Primary factors: persistent component-state approximation, long-horizon bonus / terminal-dividend recovery, and Basic Amount transition approximation.
- Evidence boundary: age-55 first-year arithmetic matches when the proposal withdrawal schedule is supplied; divergence begins in subsequent persistent-state rows.

## ACCURACY DISTRIBUTION
- <=0.005%: 77
- <=0.01%: 77
- <=0.02%: 77
- <=0.05%: 80
- <=0.10%: 84
- >0.10%: 325

## FINAL STATUS
NOT_READY_FOR_INTEGRATION

This is a calibrated approximation and is not the official AIA/iPOS calculation engine.
