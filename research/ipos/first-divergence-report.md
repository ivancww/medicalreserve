# iPOS First-Divergence Diagnostics

ENGINE VERSION: ipos-approximation-terminal-dividend-transition-v4

Frozen holdout leakage check: PASS

## 45yrs_5pay_130k_avf_55
- Classification: terminal dividend behavior
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
- First >0.10% row: {"case": "45yrs_5pay_130k_avf_55", "age": 56, "policyYear": 11, "annualPremium": 130000, "initialBasicAmount": 1323829, "currentBasicAmount": 1323829, "modelCurrentBasicAmount": 1323829, "noWithdrawalBaseValue": 887115, "withdrawal": 14400, "expectedIPOSRemaining": 858040, "modelRemaining": 860248, "dollarError": 2208, "percentageError": 0.25733066, "absolutePercentageError": 0.25733066}
- Immediately previous row: {"case": "45yrs_5pay_130k_avf_55", "age": 55, "policyYear": 10, "annualPremium": 130000, "initialBasicAmount": 1323829, "currentBasicAmount": 1323829, "modelCurrentBasicAmount": 1323829, "noWithdrawalBaseValue": 828920, "withdrawal": 14031, "expectedIPOSRemaining": 814889, "modelRemaining": 814889, "dollarError": 0, "percentageError": 0.0, "absolutePercentageError": 0.0}
- First-withdrawal identity check: {"age": 55, "policyYear": 10, "evidenceNoWithdrawalBaseValue": 828920, "withdrawal": 14031, "identityExpectedRemaining": 814889, "iposRemainingSurrenderValue": 814889, "identityDollarError": 0, "identityAbsolutePercent": 0.0, "evidenceSource": "baseCurve row"}

## 45yrs_5pay_130k_avpu_55yr
- Classification: terminal dividend behavior
- First >0.01%: {"age": 56, "policyYear": 11}
- First >0.02%: {"age": 56, "policyYear": 11}
- First >0.05%: {"age": 56, "policyYear": 11}
- First >0.10%: {"age": 56, "policyYear": 11}
- First >0.10% row: {"case": "45yrs_5pay_130k_avpu_55yr", "age": 56, "policyYear": 11, "annualPremium": 130000, "initialBasicAmount": 1323829, "currentBasicAmount": 1323829, "modelCurrentBasicAmount": 1323829, "noWithdrawalBaseValue": 887115, "withdrawal": 20416, "expectedIPOSRemaining": 846694, "modelRemaining": 852327, "dollarError": 5633, "percentageError": 0.66529348, "absolutePercentageError": 0.66529348}
- Immediately previous row: {"case": "45yrs_5pay_130k_avpu_55yr", "age": 55, "policyYear": 10, "annualPremium": 130000, "initialBasicAmount": 1323829, "currentBasicAmount": 1323829, "modelCurrentBasicAmount": 1323829, "noWithdrawalBaseValue": 828920, "withdrawal": 19128, "expectedIPOSRemaining": 809792, "modelRemaining": 809792, "dollarError": 0, "percentageError": 0.0, "absolutePercentageError": 0.0}
- First-withdrawal identity check: {"age": 55, "policyYear": 10, "evidenceNoWithdrawalBaseValue": 828920, "withdrawal": 19128, "identityExpectedRemaining": 809792, "iposRemainingSurrenderValue": 809792, "identityDollarError": 0, "identityAbsolutePercent": 0.0, "evidenceSource": "baseCurve row"}

## 5pay_avf_150k
- Classification: premium-to-Basic mapping
- First >0.01%: {"age": 46, "policyYear": 1}
- First >0.02%: {"age": 46, "policyYear": 1}
- First >0.05%: {"age": 46, "policyYear": 1}
- First >0.10%: {"age": 46, "policyYear": 1}
- First >0.10% row: {"case": "5pay_avf_150k", "age": 46, "policyYear": 1, "annualPremium": 150000, "initialBasicAmount": 1527495, "currentBasicAmount": 1527495, "modelCurrentBasicAmount": 1527495, "noWithdrawalBaseValue": 152, "withdrawal": 0, "expectedIPOSRemaining": 153, "modelRemaining": 152, "dollarError": -1, "percentageError": -0.65359477, "absolutePercentageError": 0.65359477}
- Immediately previous row: null
- First-withdrawal identity check: {"age": 61, "policyYear": 16, "evidenceNoWithdrawalBaseValue": 1423591, "withdrawal": 17745, "identityExpectedRemaining": 1405846, "iposRemainingSurrenderValue": 1405846, "identityDollarError": 0, "identityAbsolutePercent": 0.0, "evidenceSource": "first-withdrawal identity inferred from genuine proposal row"}

## 5pay_avpu_200k
- Classification: terminal dividend behavior
- First >0.01%: {"age": 62, "policyYear": 17}
- First >0.02%: {"age": 62, "policyYear": 17}
- First >0.05%: {"age": 62, "policyYear": 17}
- First >0.10%: {"age": 62, "policyYear": 17}
- First >0.10% row: {"case": "5pay_avpu_200k", "age": 62, "policyYear": 17, "annualPremium": 200000, "initialBasicAmount": 2042901, "currentBasicAmount": 2042901, "modelCurrentBasicAmount": 2042901, "noWithdrawalBaseValue": 2064720, "withdrawal": 29576, "expectedIPOSRemaining": 1980705, "modelRemaining": 2004807, "dollarError": 24102, "percentageError": 1.21683946, "absolutePercentageError": 1.21683946}
- Immediately previous row: {"case": "5pay_avpu_200k", "age": 61, "policyYear": 16, "annualPremium": 200000, "initialBasicAmount": 2042901, "currentBasicAmount": 2042901, "modelCurrentBasicAmount": 2042901, "noWithdrawalBaseValue": 1903938, "withdrawal": 27608, "expectedIPOSRemaining": 1876330, "modelRemaining": 1876330, "dollarError": 0, "percentageError": 0.0, "absolutePercentageError": 0.0}
- First-withdrawal identity check: {"age": 61, "policyYear": 16, "evidenceNoWithdrawalBaseValue": 1903938, "withdrawal": 27608, "identityExpectedRemaining": 1876330, "iposRemainingSurrenderValue": 1876330, "identityDollarError": 0, "identityAbsolutePercent": 0.0, "evidenceSource": "first-withdrawal identity inferred from genuine proposal row"}

## 50yrs_5pay_130k_avpu
- Classification: terminal dividend behavior
- First >0.01%: {"age": 62, "policyYear": 12}
- First >0.02%: {"age": 62, "policyYear": 12}
- First >0.05%: {"age": 62, "policyYear": 12}
- First >0.10%: {"age": 62, "policyYear": 12}
- First >0.10% row: {"case": "50yrs_5pay_130k_avpu", "age": 62, "policyYear": 12, "annualPremium": 130000, "initialBasicAmount": 1323829, "currentBasicAmount": 1323829, "modelCurrentBasicAmount": 1323829, "noWithdrawalBaseValue": 947516, "withdrawal": 29576, "expectedIPOSRemaining": 889076, "modelRemaining": 899328, "dollarError": 10252, "percentageError": 1.15310727, "absolutePercentageError": 1.15310727}
- Immediately previous row: {"case": "50yrs_5pay_130k_avpu", "age": 61, "policyYear": 11, "annualPremium": 130000, "initialBasicAmount": 1323829, "currentBasicAmount": 1323829, "modelCurrentBasicAmount": 1323829, "noWithdrawalBaseValue": 887115, "withdrawal": 27608, "expectedIPOSRemaining": 859507, "modelRemaining": 859507, "dollarError": 0, "percentageError": 0.0, "absolutePercentageError": 0.0}
- First-withdrawal identity check: {"age": 61, "policyYear": 11, "evidenceNoWithdrawalBaseValue": 887115, "withdrawal": 27608, "identityExpectedRemaining": 859507, "iposRemainingSurrenderValue": 859507, "identityDollarError": 0, "identityAbsolutePercent": 0.0, "evidenceSource": "first-withdrawal identity inferred from genuine proposal row"}

## 70k_original
- Classification: terminal dividend behavior
- First >0.01%: {"age": 62, "policyYear": 17}
- First >0.02%: {"age": 62, "policyYear": 17}
- First >0.05%: {"age": 62, "policyYear": 17}
- First >0.10%: {"age": 62, "policyYear": 17}
- First >0.10% row: {"case": "70k_original", "age": 62, "policyYear": 17, "annualPremium": 70000, "initialBasicAmount": 710660, "currentBasicAmount": 710660, "modelCurrentBasicAmount": 710660, "noWithdrawalBaseValue": 718250, "withdrawal": 21896, "expectedIPOSRemaining": 665993, "modelRemaining": 680643, "dollarError": 14650, "percentageError": 2.19972282, "absolutePercentageError": 2.19972282}
- Immediately previous row: {"case": "70k_original", "age": 61, "policyYear": 16, "annualPremium": 70000, "initialBasicAmount": 710660, "currentBasicAmount": 710660, "modelCurrentBasicAmount": 710660, "noWithdrawalBaseValue": 662320, "withdrawal": 20440, "expectedIPOSRemaining": 641879, "modelRemaining": 641880, "dollarError": 1, "percentageError": 0.00015579, "absolutePercentageError": 0.00015579}
- First-withdrawal identity check: {"age": 61, "policyYear": 16, "evidenceNoWithdrawalBaseValue": 662319, "withdrawal": 20440, "identityExpectedRemaining": 641879, "iposRemainingSurrenderValue": 641879, "identityDollarError": 0, "identityAbsolutePercent": 0.0, "evidenceSource": "first-withdrawal identity inferred from genuine proposal row"}
