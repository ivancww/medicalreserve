# Medical Reserve Original-Intent Forward Calculation Specification

Classification: **ORIGINAL_INTENT_SPEC_BLOCKED — PHASE SUPPORT ROUTING, GENERIC REPEATED-SUPPORT TRANSITION, AND VERIFIED OFFICIAL PREMIUM READ CONTRACT ARE REQUIRED**

This checkpoint locks the original product direction. It does not add a calculation model, activate research in production, change Customer Flow, or implement a reverse solver.

## 1. Product question and scope

The first calculation answers one question:

> Given the customer's enabled Saving phases and contributions, use the selected Official medical premium for every support age and show cumulative Medical Reserve Support and the genuine-data-supported remaining Medical Reserve value.

It is **Forward only**. Support start and expected end ages are manual customer inputs; retirement age is not hardcoded as the support start. Internal GCV/RB/TD fields may support calculation or validation but are not customer-facing outputs.

## 2. Minimum inputs

| Input | Rule |
| --- | --- |
| Current age | Becomes Phase 1 issue age. |
| Phase 1 annual contribution | Required; five annual contributions. |
| Phase 2 enabled and annual contribution | Optional; independent from Phase 1. |
| Phase 3 enabled and annual contribution | Optional; Phase 2 must be enabled. |
| Support start age | Manually selected. |
| Support expected end age | Manually selected; annual range is inclusive. |
| Medical plan | Official `MedicalPlans.plan_id`. |
| Deductible / plan option | Taken from the selected Official MedicalPlans mapping. |

Each phase may have a different annual contribution.

## 3. Phase structure

These are independent five-payment Saving blocks, not three fixed products and not synthetic 10Pay/15Pay policies.

| Phase | Enabled | Issue age | Contribution window | State |
| --- | --- | ---: | --- | --- |
| Phase 1 | Required | `currentAge` | Years 1–5 | Independent |
| Phase 2 | Optional | `currentAge + 5` | Years 6–10 | Independent |
| Phase 3 | Optional; requires Phase 2 | `currentAge + 10` | Years 11–15 | Independent |

The timing matches the existing AVA Saving concept, which labels sequential blocks as years 1–5, 6–10, and 11–15. The existing research portfolio also creates independent policies at five-year issue-age offsets. This checkpoint adopts only that timing concept; it does not adopt the old Saving app's synthetic projection calculations.

Valid structures are:

1. Phase 1 only.
2. Phase 1 + Phase 2.
3. Phase 1 + Phase 2 + Phase 3.

For every attained age, each enabled phase calculates its own Policy Year, Basic Amount, value path, support history, and remaining value. `policyYear = attainedAge - issueAge`.

## 4. Required result views

| View | Calculation |
| --- | --- |
| A — Phase 1 effect | Phase 1 only. |
| B — Phase 1 + Phase 2 effect | Calculate both independently, then sum after applying an approved support-routing rule. |
| C — Phase 1 + Phase 2 + Phase 3 effect | Calculate all three independently, then sum after applying an approved support-routing rule. |

A pre-support display may sum values at the same attained age. A post-support combined result is valid only after the annual support has been routed and each affected phase has been recalculated.

## 5. Genuine iPOS data coverage

The audited corpus contains 22 usable central HKD 5Pay proposals and 1,205 same-PDF annual component comparisons. The frozen fixture contains 21 cases: 14 calibration, 6 holdout, and 1 regression. It includes annual no-withdrawal values, post-withdrawal values, Basic Amount, GCV, RB, TD, allocation, repeated-support rows, and pause/resume evidence.

### Direct annual-contribution anchors

| Annual contribution | Basic Amount |
| ---: | ---: |
| HKD 40,000 | 404,041 |
| HKD 70,000 | 710,660 |
| HKD 100,000 | 1,015,229 |
| HKD 130,000 | 1,323,829 |
| HKD 150,000 | 1,527,495 |
| HKD 180,000 | 1,832,994 |
| HKD 200,000 | 2,042,901 |

### Direct issue-age and Policy-Year coverage

| Issue age | Policy Years | Frozen cases |
| ---: | --- | ---: |
| 40 | 1–60 | 3 |
| 45 | 1–55 | 14 |
| 50 | 1–50 | 4 |

Direct withdrawal/support starts in the frozen corpus are ages 55, 56, and 61. Exact genuine paths include Original/AVF/AVPU research labels, but those labels are not customer options and are not mapped in the repository to a MedicalPlans plan/deductible.

### Calculation coverage classes

- **DIRECTLY VALIDATED:** exact represented issue age, exact contribution anchor, supported Policy Year, and a genuinely matched support path.
- **INTERPOLATED / EVIDENCE-SUPPORTED:** a contribution between adjacent anchors may use piecewise Premium-to-Basic interpolation and Basic-normalized no-withdrawal values. This does not validate an arbitrary repeated-support path.
- **NOT YET VALIDATED:** an arbitrary Official medical-premium sequence after a phase's first support, or a multi-phase result without validated routing.
- **OUT OF SUPPORTED RANGE:** contribution below HKD 40,000 or above HKD 200,000; issue age outside 40/45/50 without a separately validated rule; or Policy Year beyond the represented range.

No extrapolation is allowed.

## 6. Preserved verified calculation rules

The foundation is genuine proposal data plus recovered identities—not a new fitted curve.

1. `policyYear = attainedAge - issueAge`.
2. `component(PY, current Basic) = genuine no-withdrawal component(PY) / original Basic × current Basic`.
3. At a phase's first support: `remaining total = genuine no-withdrawal total - current Medical Reserve Support`.
4. Genuine allocation identity: `support = RB support + associated TD support + GCV support`.
5. When GCV is used: `Basic reduction = GCV support / (no-withdrawal GCV(PY) / original Basic)`.
6. `post-support GCV = no-withdrawal GCV(PY) / original Basic × current Basic`.

The recovered evidence validates these identities very closely: first support is exact in 22/22 rows; Basic Amount reduction has maximum absolute error HKD 2.17 across 221 rows; and post-reduction GCV has maximum absolute error HKD 1.04 across 1,205 rows.

The missing generic rule remains the next-year RB/TD state after support. Therefore the first implementation must not convert the existence of genuine repeated-support examples into a claim that every Official medical-premium sequence can be calculated.

## 7. Official Medical premium mapping

The current Medical Reserve app defines this data path:

1. `bootstrap` returns `MedicalPlans`.
2. `MedicalPlans` maps `plan_id` to display name, gender when supplied, deductible, and `premium_sheet`.
3. `premiumRange` is requested with `plan_id`, `retirement_age`, and `coverage_age`.
4. For this specification, the legacy parameter `retirement_age` carries the manually selected support start age; it does not impose retirement as the product rule.
5. `annual_premiums` must include every attained age from support start through support end, inclusive.
6. A missing age, plan mapping, or Official response returns `OFFICIAL_PREMIUM_DATA_UNAVAILABLE`. No medical premium is interpolated or fabricated.

Source priority is live Official Cloud data, then a versioned cached Official response marked stale, then an unavailable result.

Status: **CONTRACT IDENTIFIED; LIVE DATA UNVERIFIED.** The app consumes `health`, `bootstrap`, `premium`, and `premiumRange`, but the committed `gas/Code.gs` implements only `health` and `bootstrap`. The deployed endpoint could not be read from this Work environment, so current plan rows, deductible rows, and age coverage are not asserted in this checkpoint.

## 8. Annual forward sequence

For each enabled result view:

1. Validate phase dependencies, contributions, issue-age coverage, and Policy-Year coverage.
2. Create each enabled phase independently and resolve its exact or explicitly interpolated Basic Amount and genuine no-withdrawal path.
3. Load a complete inclusive Official premium range for the selected plan and deductible.
4. Before support start age, annual Medical Reserve Support is zero.
5. From support start through support end, required support equals that attained age's Official annual medical premium.
6. Apply the approved phase-routing rule.
7. For a phase's first support, apply the verified first-support identity.
8. For later support, use an exact genuine audited path only when it matches. Otherwise stop that projection with `NOT_YET_VALIDATED`; do not substitute v3/v4/component-state/carried-ratio.
9. Return age, annual Medical Reserve Support, cumulative support, remaining Medical Reserve value, and evidence status.

## 9. Phase aggregation and unresolved decision

**PHASE SUPPORT ROUTING — DECISION REQUIRED**

No repository evidence establishes which phase should fund annual support first. The existing oldest-issued-first behavior is explicitly a research rule, not product evidence. These options must be presented for a product decision and later validated:

- oldest-issued phase first;
- newest-issued phase first;
- proportional to each phase's available value.

No option is selected by this checkpoint. Until one is selected, Views B and C may show the individual phase values and a pre-support sum, but they may not claim a post-support combined projection.

## 10. Customer-facing annual output

For every support age:

| Field | Meaning |
| --- | --- |
| Age | Attained age. |
| Medical Reserve Support | Official annual medical premium funded that year. |
| Cumulative Medical Reserve Support | Sum of fully applied support through that age. |
| Projected Remaining Medical Reserve Value | Sum of independently updated phase values, only where the path is supported. |
| Evidence status | Direct, interpolated, not validated, out of range, premium unavailable, or routing decision required. |

## 11. Validation boundary

Direct validation must compare model remaining value with the genuine iPOS remaining value and report HKD error, signed %, and absolute %. The target is maximum annual absolute error at or below 0.10%, preferred at or below 0.05%, only for directly comparable rows.

Existing evidence available for regression:

| Identity | Rows | Result |
| --- | ---: | --- |
| First support | 22 | 22/22 exact |
| Basic Amount reduction | 221 | max HKD 2.168633 |
| Post-reduction GCV | 1,205 | max HKD 1.0356 |
| Component total | 2,410 | max HKD 1 |
| Allocation | 1,205 | max HKD 1 |

No generic repeated-support accuracy claim is made. Existing genuine paths are validation evidence and may be replayed exactly; they are not a license to infer missing paths.

## 12. Exact next implementation scope

1. Obtain one explicit product decision for phase support routing.
2. Reconcile or document the deployed Official `premiumRange` read implementation with committed GAS, then capture a versioned complete response for supported MedicalPlans.
3. Implement a research-only Forward orchestrator with per-phase contribution inputs, independent phase states, inclusive Official premium lookup, exact contribution paths, explicit interpolation labels, and fail-safe evidence statuses.
4. Permit the verified first-support calculation and exact audited-path replay only. Return `NOT_YET_VALIDATED` for unmatched repeated-support paths.
5. Validate Phase 1 first. Only then validate the chosen routing for Phase 1+2 and Phase 1+2+3.

Reverse solving, production activation, Customer Flow changes, and UI redesign remain outside scope.

## 13. Decision

**ORIGINAL_INTENT_SPEC_BLOCKED — PHASE SUPPORT ROUTING, GENERIC REPEATED-SUPPORT TRANSITION, AND VERIFIED OFFICIAL PREMIUM READ CONTRACT ARE REQUIRED**

The product direction is now unambiguous, and the evidence-supported boundary is explicit. Broad implementation is blocked until the three named items are resolved; no new actuarial approximation is authorized by this specification.
