# iPOS Approximation Validation Report

ENGINE VERSION: ipos-approximation-policy-year-transition-v3-basecurve

## DATASET
- Calibration cases: 14
- Holdout cases: 6
- Annual rows: 1150
- Leakage check: PASS

## RESULTS
- Calibration MAPE: 5.65566368%
- Calibration max %: 69.78829946%
- Holdout MAPE: 5.16213632%
- Holdout max %: 35.97650942%
- Holdout max $: HKD 6140453
- Worst case: 5pay_avpu_200k
- Worst age / Policy Year: 100 / 55

## HOLDOUT CROSSINGS
### 45yrs_5pay_130k_avf_55
- MAPE: 2.74767534%
- Max Error %: 12.45942201%
- Max Dollar Error: HKD 1265233
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
### 45yrs_5pay_130k_avpu_55yr
- MAPE: 7.0153849%
- Max Error %: 29.98215778%
- Max Dollar Error: HKD 2228721
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
### 5pay_avf_150k
- MAPE: 6.85104319%
- Max Error %: 35.57787206%
- Max Dollar Error: HKD 4819354
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 46, "policyYear": 1}
- First >0.02%: {"age": 46, "policyYear": 1}
- First >0.05%: {"age": 46, "policyYear": 1}
- First >0.10%: {"age": 46, "policyYear": 1}
### 5pay_avpu_200k
- MAPE: 6.88719632%
- Max Error %: 35.97650942%
- Max Dollar Error: HKD 6140453
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 62, "policyYear": 17}
- First >0.02%: {"age": 62, "policyYear": 17}
- First >0.05%: {"age": 62, "policyYear": 17}
- First >0.10%: {"age": 62, "policyYear": 17}
### 50yrs_5pay_130k_avpu
- MAPE: 3.87825183%
- Max Error %: 9.11102806%
- Max Dollar Error: HKD 506639
- Worst age / Policy Year: 74 / 24
- First >0.01%: {"age": 62, "policyYear": 12}
- First >0.02%: {"age": 62, "policyYear": 12}
- First >0.05%: {"age": 62, "policyYear": 12}
- First >0.10%: {"age": 62, "policyYear": 12}
### 70k_original
- MAPE: 3.47654959%
- Max Error %: 14.98874874%
- Max Dollar Error: HKD 555787
- Worst age / Policy Year: 100 / 55
- First >0.01%: {"age": 62, "policyYear": 17}
- First >0.02%: {"age": 62, "policyYear": 17}
- First >0.05%: {"age": 62, "policyYear": 17}
- First >0.10%: {"age": 62, "policyYear": 17}

## DIAGNOSIS
- Primary factors: first-withdrawal base-curve interpolation for non-anchor Policy Years, terminal-dividend behavior after a correct first withdrawal, and remaining long-horizon transition behavior.
- Evidence boundary: calibration-only first-withdrawal component reconstruction is used for base curves; holdout first-withdrawal rows remain validation-only. Later rows use the fitted transition model.
- Detailed first-divergence output: first-divergence-report.json and first-divergence-report.md

## ACCURACY DISTRIBUTION
- <=0.005%: 77
- <=0.01%: 77
- <=0.02%: 77
- <=0.05%: 77
- <=0.10%: 79
- >0.10%: 325

## FINAL STATUS
NOT_READY_FOR_INTEGRATION

This is a calibrated approximation and is not the official AIA/iPOS calculation engine.
