# AVA Medical Reserve — Saving Base Data / Auto-Accumulation / Forward Integration Audit

Audit date: 2026-10-04  
Scope: read-only study and data-contract design  
Repository audited: `ivancww/medicalreserve`  
Google Sheet: `增值式醫保` (`1OXblBBSdhnuFPP54FucxmNEVGL9d2s7fDfZqKtk_dHI`)

## Executive conclusion

The current `自動滾存` tab is a genuine-looking no-withdrawal accumulation reference: it contains `保單年度`, a zero `領取百分比`, and a `倍數` for policy years 8–25 and selected five-year checkpoints through 100. It is not, by itself, a production Saving Plan return dataset. It has no product identifier, currency, pay term, contribution anchor, issue age, phase identity, component values, or version/evidence metadata.

The accepted Forward research implementation already has the right conceptual separation: official medical premiums are input data, protected Forward logic performs routing/state transitions, and genuine 5Pay proposal paths provide base/no-withdrawal and post-support evidence. However, the Forward implementation is explicitly research-only (`productionActive: false`), reads a repository fixture rather than `自動滾存`, and marks unmatched repeated-support histories `NOT_YET_VALIDATED`. Therefore the pre-Support-to-Forward handoff is **PARTIAL**, not production-ready.

The recommended production direction is to preserve `自動滾存` as the source/reference for a future official no-support base-path dataset only after it is enriched or mapped to genuine proposal evidence. Keep all routing, phase aging, component-state transition, first-support identity, repeated-support validation, interpolation policy, and remaining-value calculation in the App. Do not use the fixed-withdrawal tabs as customer scenarios or as the new runtime contract.

## 1. Verified current state

The requested repository was distinct from the pre-existing local checkout. The requested repository was verified directly from GitHub and cloned to a temporary audit checkout.

| Item | Verified value |
|---|---|
| Requested repository | `ivancww/medicalreserve` |
| Latest repository `main` | `0e48af83ef2c74c80fff6439e4d2fefd3bdf259a` |
| Mother repository | `ivancww/avaplatform` |
| Latest Mother `main` | `468e7d38282314a69cbc5749fcba0724709e6c5a` |
| Audit branch | `audit/saving-base-forward-integration` |
| Sheet title | `增值式醫保` |
| Sheet locale/time zone | `zh_TW` / `Asia/Hong_Kong` |

The latest Mother Rules enforce: independent-app ownership; Official Layer versus User Layer separation; Google Sheet/Admin data remaining read-only to Users; app-owned business/calculation logic; Local-first behavior; and the Frontstage/customer-presentation boundaries. Those rules support the proposed split of Official Return Data in Google Sheet and protected calculation logic in the App.

No checkout, reset, application edit, Sheet write, GAS write, Forward-engine change, PR, merge, or commit was performed.

## 2. Google Sheet evidence

### 2.1 `自動滾存`

Observed header and row shape:

| Column | Observed meaning |
|---|---|
| `保單年度` | Policy year, not attained age |
| `領取百分比` | 0% for every observed row |
| `倍數` | Projected value multiplier |

The tab contains 33 non-header data rows. The policy-year values are:

`8–25`, then `30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100`.

Examples observed:

| Policy year | Withdrawal percentage | Multiplier |
|---:|---:|---:|
| 8 | 0% | 1.16 |
| 15 | 0% | 1.86 |
| 20 | 0% | 2.71 |
| 30 | 0% | 5.85 |
| 50 | 0% | 20.63 |
| 100 | 0% | 480.30 |

The cells are literal numeric values, not formulas, and the inspected cells contained no notes. There is no contribution amount, annual contribution, paid-premium total, Basic Amount, GCV, RB, TD, surrender value, product/plan ID, pay term, issue age, currency, source case, version, or effective date.

What the evidence supports:

- It represents an accumulation/no-withdrawal scenario at the level of a policy-year multiplier.
- `領取百分比 = 0%` is consistent with a no-support/no-withdrawal reference path.
- It can be a useful input or validation reference for a future pre-Support base path.

What the evidence does not support:

- It does not prove that the multiplier is the complete official return path for every product, contribution, issue age, or 5Pay phase.
- It cannot identify a phase's exact state at age 65 without an issue age and product/contribution mapping.
- It cannot provide the component state needed after support (Basic Amount, GCV, RB, TD or equivalent state).
- It cannot replace the Forward engine's protected transition logic.

Status: `AUTO_ACCUMULATION_TAB_AUDITED = PASS`; `AUTO_ACCUMULATION_AS_PRE_SUPPORT_BASE = PARTIAL`.

### 2.2 Fixed-withdrawal tabs

`8年領取`, `15年領取`, `20年領取`, `25年領取`, and `30年領取` all use the same three-column shape: policy year, withdrawal percentage, multiplier. They are scenario tables, not annual medical-premium tables.

Examples:

- `8年領取`: 7% withdrawal begins at policy year 8.
- `15年領取`: 12% withdrawal begins at policy year 15; earlier rows match the zero-withdrawal path.
- `20年領取`: 18% withdrawal begins at policy year 20.
- `25年領取`: 23% withdrawal begins at policy year 25.
- `30年領取`: 29% withdrawal begins at policy year 30.

The later tables are sparse around the scenario start and contain different post-withdrawal multipliers. This is consistent with historical MedSave fixed-withdrawal scenario modeling. It is not the new customer model of actual medical premium by age routed into independent 5Pay phases.

Repository evidence shows no runtime reference to these five tab names. The current GAS source reads named configuration resources and plan-mapped premium tabs; the accepted Forward research code reads its frozen repository fixture. No fixed-withdrawal tab is consumed by the new Forward orchestration.

Classification: `FIXED_WITHDRAWAL_TABS = LEGACY` for the new customer/runtime contract. Preserve them as historical/reference data; do not delete or edit them in this audit.

### 2.3 Existing configuration and GAS boundary

The Sheet has these relevant control tabs:

- `SystemSettings`: currency HKD; `reserve_engine = medsave_v1`; `premium_source = google_sheet`; `reserve_source = google_sheet`; customer withdrawal wording disabled; version 1.
- `Visualization`: checkpoint interval 5, premium/support display flags, withdrawal wording disabled.
- `MedicalPlans`: plan IDs mapped to official premium tabs.
- `AppFlow`: customer sequence includes saving plan and reserve support.

The GAS source has read actions `health`, `bootstrap`, `premium`, and `premiumRange`, plus authenticated Official writes. The current normalized `ReserveStrategies` contract is `policy_year`, `support_percent`, `value_multiple`, but the repository audit documents the live `ReserveStrategies` endpoint as missing/unavailable and explicitly forbids inferring a reserve formula from it.

There is no verified GAS read contract that exposes `自動滾存` as a product/contribution-specific Official Return Dataset to the Forward engine.

## 3. Accepted Forward architecture audit

The accepted Forward research file is `research/ipos/original-intent-forward.js`. It is not imported by production `app.js` and returns `productionActive: false`.

### 3.1 Inputs consumed by the accepted Forward

The Forward consumes:

1. Customer inputs: current age, support start/end age, selected `planId`, optional deductible, enabled phases, and one annual contribution per phase.
2. Official medical premium schedule: one `annual_premium` for every support age; missing ages fail safely.
3. Frozen genuine proposal dataset: cases with issue age, annual contribution, initial Basic Amount, `baseCurve`, annual rows, withdrawal/support schedules, component values, and evidence roles.
4. Protected constants/logic: phase offsets 0/5/10; five-year rotating routing; evidence statuses; interpolation rules; support-history matching; first-support identity; and combined remaining-value aggregation.

The app-facing GAS source currently provides official medical-premium mapping/range data, not the accepted Saving Return/base-path data.

### 3.2 Repository data versus calculation logic

**Repository/frozen evidence data:** genuine case IDs, issue ages, annual contribution anchors, initial Basic Amounts, no-withdrawal `baseCurve` values, post-support annual rows, withdrawal schedules, product/plan mappings, and fixture evidence classifications.

**Protected calculation logic:** phase validation; phase offsets; support routing; policy-year resolution; no-support lookup; exact-path selection; contribution interpolation; support-history matching; first support `no-withdrawal value − support` identity; component-state transitions; rounding/truncation; failure statuses; and combined phase aggregation.

**Official Sheet data currently available:** medical premium tables and control/configuration data; the audited `自動滾存`/fixed-withdrawal reference tables are not yet connected to the accepted Forward as a complete return-data contract.

**Genuine iPOS evidence:** the frozen 21-case dataset and the documented source-evidence audits. The accepted specification explicitly says unmatched repeated-support paths remain `NOT_YET_VALIDATED` and production activation is outside the checkpoint.

**Interpolation/reference data:** contribution anchors are 40K, 70K, 100K, 130K, 150K, 180K, and 200K; the engine piecewise-interpolates Basic Amount and matching path values between adjacent anchors where evidence permits. Interpolation is not new actuarial evidence and does not validate arbitrary repeated-support histories.

Conclusion: return data can be externalized without putting calculation formulas in editable Sheet cells, but the current implementation is only a partial architecture proof. The App must receive a validated, versioned Official Return Dataset and retain the protected Forward logic.

## 4. Auto-accumulation and first-support handoff

### Required state at first support

For each enabled phase, the handoff must identify:

- phase ID and enabled status;
- annual contribution and currency;
- issue age / phase offset;
- attained age and `policy_year = attainedAge − issueAge`;
- no-support projected remaining value at that policy year;
- the underlying component state required by the protected engine (at minimum the evidence-equivalent Basic Amount and, where the transition needs it, GCV/RB/TD or a validated normalized state);
- the Official medical premium for the attained age;
- the active phase determined by the locked routing formula;
- the complete prior support history for that phase, initially empty at first support.

At age 65 in the example, the engine must not use a fixed 8/15/20/25/30-year scenario. It must obtain each phase's age-65 state from that phase's no-support path, apply the actual age-65 Official premium to the routed phase, then carry the resulting post-support state into age 66.

The current research engine can perform the first-support identity when its frozen `baseCurve`/genuine case evidence is available. The current Sheet `自動滾存` row does not provide enough identity/state fields or mapping to perform that handoff by itself.

Status: `PRE_SUPPORT_TO_FORWARD_HANDOFF = PARTIAL`.

### Non-active phases

The accepted routing test preserves the required rule: non-active phases continue aging; they are not reset or reissued when their next five-year support window begins. This must remain protected in any production integration.

## 5. Multi-phase audit

The accepted Forward tests verify the routing sequence for one, two, and three enabled phases and verify a mixed-contribution case (`P1 = 130K`, `P2 = 180K`, `P3 = 130K`) where each phase is projected independently and combined by summation.

| Case | Research logic/routing | Production status |
|---|---|---|
| Phase 1 only | Routing and independent 5Pay projection tested | `PARTIAL` — production engine not activated; later real-premium paths can be `NOT_YET_VALIDATED` |
| Phase 1 + Phase 2 | 5-year P1/P2 rotation tested; mixed phase contribution logic present | `PARTIAL` — same production/evidence limitation |
| Phase 1 + Phase 2 + Phase 3 | 5-year P1/P2/P3 rotation, Phase 3 dependency, independent aging tested | `PARTIAL` — same production/evidence limitation; phase-3 evidence is not broad |

Independent annual contributions are therefore supported by the accepted research design, but not yet a production-ready capability. The customer model remains one fixed annual contribution per independent five-year phase; it must not become five independent inputs inside one phase.

Status: `INDEPENDENT_PHASE_CONTRIBUTIONS = PARTIAL`.

## 6. Contribution range audit

Exact supported anchors in the accepted Forward code:

| Annual contribution | Basic Amount | Evidence status |
|---:|---:|---|
| HKD 40,000 | 404,041 | direct/regression |
| HKD 70,000 | 710,660 | direct |
| HKD 100,000 | 1,015,229 | direct |
| HKD 130,000 | 1,323,829 | direct |
| HKD 150,000 | 1,527,495 | direct/holdout |
| HKD 180,000 | 1,832,994 | direct |
| HKD 200,000 | 2,042,901 | direct |

Values between adjacent anchors are technically interpolated. Accordingly, 50K, 80K, 120K, and 170K are interpolation cases; 70K, 100K, 130K, 150K, 180K, and 200K are direct anchors. 40K is the lower direct anchor. Values below 40K or above 200K are explicitly out of range.

This does not mean every interpolated value has validated repeated-support evidence. The Forward report explicitly keeps unmatched histories `NOT_YET_VALIDATED`. Arbitrary values inside 40K–200K are calculable by the research resolver, but safe production availability is only partial until the relevant base paths and repeated-support states are official and validated.

The current UI uses a 1,000-HKD step. That is a product/input policy, not evidence that every 1,000-HKD point has direct proposal evidence. Retain explicit interpolation labeling and do not claim direct evidence for interpolated values.

Status: `40K_TO_200K_RANGE = PARTIAL`.

## 7. Proposed Google Sheet Layer 2

### Design principle

Google Sheet stores Official Return/Base Data and provenance. The App stores protected calculation logic. Sheet cells must not become an editable copy of the Forward engine.

### Smallest useful schema

Recommended new tab: `SavingPlanReturns`.

One row is one official phase/product/contribution/policy-year base-path observation.

| Column | Purpose |
|---|---|
| `return_data_id` | Stable row key |
| `product_id` | Official plan/product identity |
| `currency` | `HKD` |
| `pay_term_years` | `5` only for this model |
| `annual_contribution` | One phase's fixed annual contribution |
| `issue_age` | Age at phase issue/start |
| `policy_year` | 1, 2, … relative to that phase |
| `base_value` | Official no-support projected remaining value for that policy year |
| `basic_amount` | Optional but required where Forward transition needs it |
| `gcv` | Optional component state |
| `reversionary_bonus` | Optional component state |
| `terminal_dividend` | Optional component state |
| `source_case_id` | Genuine proposal/evidence reference |
| `evidence_class` | `DIRECT`, `INTERPOLATED_REFERENCE`, or `HOLDOUT_REFERENCE` |
| `data_version` | Dataset version |
| `effective_date` | Optional official effective date |
| `enabled` | Explicit active flag |

If the official source only authorizes a normalized base value and not component values, do not invent component columns with fabricated values. In that case, the production contract must explicitly say that the Forward engine can use a normalized state for the supported transition; otherwise component-state data is a prerequisite.

Optional mapping tab: `SavingPlanReturnSources`, only if the official product/plan-to-return-dataset mapping cannot live in `MedicalPlans`. Keep it to `product_id`, `return_dataset_id`, `currency`, `pay_term_years`, `enabled`, `data_version`, and provenance fields. Do not create one tab per customer scenario.

The existing `自動滾存` tab may remain a source/reference tab during migration. It should not be treated as the final Layer 2 contract until its multiplier semantics, product mapping, contribution anchors, issue-age behavior, and official provenance are confirmed.

### Data dependency map

```text
Medical Premium Google Sheet (Official annual premium by age/plan)
                         +
SavingPlanReturns (Official no-support/base return rows)
                         |
                         v
Protected App Forward Engine
  - phase offsets 0/+5/+10
  - 5-year rotating support routing
  - policy-year and state transitions
  - evidence/interpolation/failure rules
                         |
                         v
Phase 1 / Phase 2 / Phase 3 state
                         |
                         v
Actual medical premium by age
                         |
                         v
Medical Reserve Support
                         |
                         v
Projected Remaining Medical Reserve
                         |
                         v
Customer presentation
```

| Classification | Examples |
|---|---|
| Google Sheet Official Data | Medical premium rows; SavingPlanReturns rows; product mapping; version/effective status; approved presentation settings |
| Protected App Calculation Logic | Routing; offsets; fixed five-year contribution semantics; aging; component transitions; support-history matching; interpolation and evidence statuses; aggregation |
| Customer Input | Current age; retirement/coverage ages; plan/deductible; 5/10/15-year arrangement; one annual contribution per enabled phase; support start/end ages; funding-source choice |
| Calculated Result | Annual support; cumulative support; remaining phase values; combined remaining reserve; medical-premium total; comparison values |
| Legacy / not new runtime | Fixed 8/15/20/25/30-year withdrawal scenarios and their customer scenario selection semantics |

## 8. Customer presentation record for later Flow work

No UI was changed. The approved future concept is recorded as follows:

1. Show projected total retirement medical premium need first.
2. Ask where the customer would otherwise expect the money to come from: 退休生活資金, 家庭財務, 投資戶口, or 銀行／儲蓄戶口.
3. Build Medical Reserve with 5 / 10 / 15 years mapped to 1 / 2 / 3 independent 5Pay phases.
4. Show one annual contribution input per enabled phase, fixed across that phase's five years.
5. Select Medical Reserve Support Start Age and End Age independently from the medical need period.
6. Present annual age, Official Medical Premium, Medical Reserve Support, and 預計剩餘醫療儲備.
7. Keep the comparison concise: without reserve premium need; with reserve support; projected remaining reserve.

Medical need period (retirement age → coverage end age) remains separate from Medical Reserve Support period (support start age → support end age). Do not force them to match.

## 9. Required result statuses

```text
CURRENT_MAIN: 0e48af83ef2c74c80fff6439e4d2fefd3bdf259a
MOTHER_MAIN: 468e7d38282314a69cbc5749fcba0724709e6c5a

AUTO_ACCUMULATION_TAB_AUDITED: PASS
AUTO_ACCUMULATION_AS_PRE_SUPPORT_BASE: PARTIAL
PRE_SUPPORT_TO_FORWARD_HANDOFF: PARTIAL
FORWARD_ENGINE_BASE_DATA_IDENTIFIED: PASS
INDEPENDENT_PHASE_CONTRIBUTIONS: PARTIAL
PHASE_1_ONLY: PARTIAL
PHASE_1_2: PARTIAL
PHASE_1_2_3: PARTIAL
40K_TO_200K_RANGE: PARTIAL
FIXED_WITHDRAWAL_TABS: LEGACY
GOOGLE_SHEET_LAYER_2_SCHEMA: NEEDS_MORE_EVIDENCE
CALCULATION_LOGIC_REMAINS_IN_APP: YES
GOOGLE_SHEET_CAN_UPDATE_RETURN_DATA_WITHOUT_ENGINE_REWRITE: PARTIAL
```

`PARTIAL` means the accepted research design or fixture path demonstrates the shape, but production wiring, complete official data coverage, or repeated-support evidence is not complete. It is not a production PASS.

## 10. Recommended production architecture

1. **Should `自動滾存` be the pre-Support Base Path?** Yes as the intended no-support/base-path source or source reference, but only after it is mapped to official product/contribution/issue-age rows and supplemented with the state required at the first support handoff. Today it is `PARTIAL`, not ready to be consumed directly.
2. **What should move/be maintained in Google Sheet?** Official annual medical premiums, official SavingPlanReturns/base-path rows, product/contribution/pay-term mappings, evidence/source IDs, version/effective status, and narrowly scoped presentation/configuration metadata. Keep raw source/reference tabs during migration.
3. **What stays protected in the App?** Phase semantics; offsets; five-year rotating route; non-active phase aging; policy-year/state transitions; first-support identity; repeated-support transitions; interpolation and evidence statuses; rounding; validation; and remaining-reserve aggregation.
4. **Are the fixed-withdrawal tabs still needed?** Keep them for historical/reference audit, but exclude them from the new customer/runtime contract. The customer must not choose a fixed withdrawal-year scenario to simulate medical premiums.
5. **Can phases have different annual contributions today?** The accepted research Forward supports independent amounts conceptually and tests a mixed-contribution case. Production support is `PARTIAL`; do not claim it is ready until official data and runtime integration cover each phase slot.
6. **What must change before the new Customer Flow?** Establish and verify the official SavingPlanReturns read contract; resolve `自動滾存` semantics and mapping; supply first-support component/normalized state; make the Forward engine consume the Official dataset instead of only a frozen fixture; obtain genuine repeated-support evidence for supported plan/phase slots; and keep explicit safe failure states for unsupported combinations. Do not move formulas into Sheet cells.
7. **Next implementation task:** a documentation/contract-led data integration spike: define the exact `SavingPlanReturns` rows from confirmed official proposal evidence, add a read-only GAS `savingPlanReturns`/dataset-version response, build a repository adapter that validates and versions the data, and run the existing Forward fixtures against that adapter without activating the customer Flow yet.

## 11. Audit constraints and verification notes

- Google Sheet reads were metadata, bounded range, and cell-value reads only. No Sheet write was made.
- The repository was audited at latest `main`; no application file was modified.
- The repository's Node/npm test suite could not be executed in this environment because `node`/`npm` were unavailable. No unexecuted test is reported as PASS.
- Existing committed research reports state that the accepted Forward is partial, GAS deployment/live contract verification is blocked, and unmatched repeated-support paths remain not validated. Those findings were preserved rather than reopened into older v3/v4/component-state research.

