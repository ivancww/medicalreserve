# Customer Total-Value Engine

Research approximation calibrated against genuine proposals; not an official AIA formula or exact iPOS calculation.

Engine: **ipos-customer-total-value-carried-ratio-v1**. Classification: **NOT_READY**. Forward A: **NOT_READY**. Reverse B: **NOT_READY**.

## Locked architecture

- primaryState: Projected remaining total surrender value and its ratio to the genuine no-withdrawal total curve.
- firstWithdrawal: no-withdrawal total minus current support
- repeatedWithdrawal: remaining(PY) = noWithdrawalTotal(PY) * remaining(PY-1) / noWithdrawalTotal(PY-1) - currentSupport; first support = noWithdrawalTotal - currentSupport
- zeroWithdrawal: Preserve the prior remaining/base ratio; never reset to pristine base.
- components: No customer GCV/RB/TD output and no invented component allocation.
- basicAmountBoundary: Exact premium-to-Basic metadata mapping seeds the no-withdrawal curve. Without a genuine allocation generator, later GCV-driven Basic Amount reduction is represented only through total-state depletion, not claimed as an independent component reconstruction.

Model-lock SHA-256: `31b0e4e4ce35018353b47e40c1c430f511cc26c616b65963761014890c52de23`. Frozen holdout evaluations after lock: **1**. Leakage: **PASS**.

## Validation

| Metric | Customer total-value v1 | v4 baseline |
| --- | ---: | ---: |
| MAPE | 1.14609369% | 2.29650947% |
| MAE | HKD 44522.05230769 | — |
| Maximum annual error | 3.75423516% | 11.80075621% |
| Maximum dollar error | HKD 277602 | HKD 457617 |
| Rows >0.10% | 235/325 | 247/325 |
| Rows >0.25% | 218/325 | — |
| Rows >0.50% | 195/325 | — |
| Rows >1.00% | 144/325 | — |

Worst: 45yrs_5pay_130k_avpu_55yr, age 79 / PY34.

First withdrawal: PASS. Zero-withdrawal persistence: PASS.

The customer-total candidate is operational from total withdrawals alone, but it is not product-ready unless the frozen maximum error is at most 1.00%. The prior component-state evidence remains unchanged.

No production activation, Customer Flow, UI, official data, frozen fixture, or Phase-A artifact was changed.
