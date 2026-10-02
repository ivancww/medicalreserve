# Customer A/B Calculation Checkpoint

## Separation of responsibilities

- Medical Premium Engine supplies explicit annual official premiums by attained age, plan and deductible.
- Saving Plan Value Engine projects each independent 5Pay policy.
- Forward A routes each annual premium and reports full support, shortfall and remaining total value.
- Reverse B calls Forward A only; bounded binary search tolerance is HKD 100 and monotonicity is checked across evidence anchors.

## Portfolio boundary

- 5-year: NOT_READY.
- 10-year: NOT_READY — Second policy issue age and oldest-first multi-policy routing lack genuine combined-portfolio validation.
- 15-year: NOT_READY — Second/third issue ages and oldest-first multi-policy routing lack genuine combined-portfolio validation.
- Routing: Oldest issued policy first; explicit deterministic research rule, not an AIA-validated portfolio rule.

## A/B deterministic validation

Uses a genuine AIA proposal withdrawal schedule solely as a deterministic solver test; it is not relabelled as an official medical-premium schedule.

Forward support years: 30; last fully supported age: 90; remaining at target: HKD 5506120.
Reverse required annual contribution: 182300; A/B consistency: PASS. The validation target also requires the genuine age-90 remaining value of HKD 5,612,890; HKD 182,200 fails that target on the declared HKD 100 solver grid.

## Requested age-50 / age-65–90 example

26 premium ages are included (Inclusive attained ages 65 through 90; an age counts only when that full annual premium is funded.).

Production app loads premiumRange dynamically from Official Cloud. The repository contains mappings and fetch logic, not annual premium values. Direct endpoint retrieval timed out in this Work environment.

Accordingly the 5/10/15-year required contributions, total premium requirement and remaining values are deliberately reported as unavailable; no values were invented.

## Validation

Node regression 43/43, syntax, schema, frozen roles, leakage, model lock, customer artifact validation and `git diff --check` pass. No production/UI/GAS or frozen fixture file changed. The existing fixture validator continues to report the three intentionally frozen age-100 85/8/2 schedule inconsistencies; this is a known benchmark anomaly, not an implementation failure. Official premium retrieval was blocked by an endpoint timeout.

No production activation or customer UI change was made.
