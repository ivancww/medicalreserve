# Medical Reserve Layer 2 — SavingPlanReturns

Status: implementation branch `feature/saving-plan-returns-layer2`
Dataset: `SavingPlanReturns` v1
Product: AIA 環宇盈活儲蓄保險計劃, HKD, 5Pay only

## Purpose and boundary

Layer 2 separates Official Saving Plan return/base data from the protected Forward calculation engine:

```text
Google Sheet SavingPlanReturns v1
        ↓ read-only GAS action: savingPlanReturns
validated App adapter
        ↓ base/no-support evidence and first-support state
protected Forward engine
```

Google Sheet stores official rows and provenance. The App retains phase offsets, five-year rotating support routing, phase dependency, non-active phase aging, policy-year resolution, support transitions, interpolation policy, evidence statuses, rounding, and remaining-reserve aggregation. No Forward formulas are stored in editable Sheet cells.

This change does not redesign the customer Flow, activate the Forward result in the Frontstage, or implement a reverse solver.

## Official Sheet structure

The existing spreadsheet `增值式醫保` (`1OXblBBSdhnuFPP54FucxmNEVGL9d2s7fDfZqKtk_dHI`) now has an additive tab named `SavingPlanReturns`.

The tab contains 314 enabled rows derived from the committed genuine iPOS evidence fixture. Existing tabs, including `自動滾存`, `8年領取`, `15年領取`, `20年領取`, `25年領取`, and `30年領取`, were not deleted or rewritten. Medical premium tabs were not changed.

### v1 fields

| Field | Meaning | Owner update rule |
|---|---|---|
| `return_data_id` | Stable unique row key | Preserve for an existing evidence row; create a new stable key for a new row |
| `dataset_id` | Must be `SavingPlanReturns` | Protected contract value |
| `data_version` | Dataset version, currently `1` | Increment for a compatible official dataset publication |
| `product_id` | Must be `aia_hk_5pay` | Protected product scope; no 10Pay/15Pay/USD rows |
| `medical_plan_id` | Existing medical-plan evidence mapping (`flexible_m`, `prestige_16000`, or `select_18000`) | Must match the genuine source evidence mapping |
| `currency` | Must be `HKD` | Protected contract value |
| `pay_term_years` | Must be `5` | Protected product scope |
| `annual_contribution` | One annual contribution for one independent 5Pay phase; range HKD 40,000–200,000 | Update only from confirmed official return evidence |
| `issue_age` | Phase issue age; phase offsets are calculated by the App | Official source value |
| `policy_year` | Policy year relative to the phase issue age | Official source value |
| `base_value` | Genuine no-support projected remaining value at that policy year | Official source value; not a Sheet formula |
| `basic_amount` | Genuine Basic Amount used to identify the base path | Official source value |
| `guaranteed_cash_value` | No-support GCV component available in the accepted evidence | Official source value |
| `reversionary_bonus_cash_value` | No-support RB component available in the accepted evidence | Official source value |
| `terminal_dividend_cash_value` | No-support TD component available in the accepted evidence | Official source value |
| `source_case_id` | Repository evidence case identifier | Preserve provenance; do not invent |
| `evidence_class` | `DIRECT`, `HOLDOUT_REFERENCE`, or `INTERPOLATED_REFERENCE` | `INTERPOLATED_REFERENCE` is reserved for explicitly approved reference rows; it is not direct proposal evidence |
| `enabled` | Whether the row is served to the App | Disable incomplete rows; do not delete provenance casually |

`effective_date` was not added because the accepted source evidence does not contain a verified effective date. Empty component columns were not added: the fields above are present because the accepted first-support/base evidence contains those components and the adapter validates them.

The legacy `自動滾存` tab remains a reference multiplier table. It is not multiplied by customer contribution at runtime and is not the Layer 2 source of truth. The fixed-withdrawal tabs remain historical reference only.

## Dataset versioning

`SystemSettings` now contains:

- `saving_return_data_version = 1`
- `saving_return_dataset = SavingPlanReturns`
- `saving_return_updated_at = 2026-10-04T00:00:00.000Z`

The SavingPlanReturns rows repeat `data_version = 1` and the GAS response returns the same value. The Saving Plan Return dataset version is separate from the AVA Platform version, Medical Reserve App version, and general Medical Reserve cloud version.

For a compatible future update:

1. Add or revise only confirmed Official rows in `SavingPlanReturns`.
2. Preserve stable keys and provenance for unchanged rows.
3. Increment `saving_return_data_version` and every served row's `data_version` together.
4. Read back the header, all enabled rows, duplicate keys, product/currency/pay-term values, contribution range, policy-year coverage, and version.
5. Deploy the GAS source as a new version of the existing Web App and verify `savingPlanReturns` before any App cache refresh.

Do not modify Forward formulas for a compatible data-only update.

## GAS read contract

Action: `GET ?action=savingPlanReturns`

The action is read-only and only accesses the hardcoded `SavingPlanReturns` tab. It does not accept a user-supplied sheet name, formula, range, or write operation. It validates:

- required v1 headers;
- one positive dataset version;
- exact product `aia_hk_5pay`;
- exact currency `HKD`;
- exact pay term `5`;
- annual contribution range HKD 40,000–200,000;
- integer issue age and policy year;
- non-negative base/state values;
- evidence class and enabled flag;
- unique `return_data_id` values;
- row metadata matching the SystemSettings version.

Invalid or missing Official data returns a structured error. It never fabricates rows or silently maps the old fixed-withdrawal tabs.

The `health` response now reports whether `SavingPlanReturns` exists and which Saving Plan Return data version is configured. Existing `health`, `bootstrap`, `premium`, and `premiumRange` actions remain available.

The repository contains the GAS source change only. Live deployment was not performed in this implementation environment; the existing Web App must be redeployed separately using the steps in `gas/DEPLOYMENT.md`.

## App adapter contract

`saving-plan-returns.js` provides:

- `validateSavingPlanReturnsResponse(response)` — validates the official response and returns normalized enabled rows;
- `resolveOfficialBaseState(response, input)` — resolves a phase issue age, policy year, direct base state, or the existing accepted contribution interpolation status;
- `hydrateForwardDataset(response, frozenDataset)` — replaces matching frozen `baseCurve` rows with official Layer 2 rows while preserving frozen post-support evidence for regression and explicit `NOT_YET_VALIDATED` boundaries;
- `runForwardWithOfficialReturns(input, response, frozenDataset)` — invokes the existing protected Forward engine through the adapter;
- `contributionEvidence(value)` — reports direct anchor, accepted interpolation, or out-of-range status.

The adapter does not create annual contribution rows inside one phase. Each phase remains one annual contribution repeated for five years; different phases remain independent. Phase 2 and Phase 3 issue ages are resolved by the protected offsets `+5` and `+10`, and Phase 3 still requires Phase 2 in the Forward engine.

The adapter does not claim that the v1 Sheet rows validate every repeated-support history. The frozen genuine post-support evidence remains available for regression, and unsupported/missing states retain the existing evidence status boundary.

## Safe-failure behavior

The App must treat these as unavailable or explicitly unsupported, not as zero or fabricated values:

- missing or invalid GAS response;
- wrong dataset version;
- wrong product, currency, or pay term;
- missing required fields;
- duplicate row key;
- contribution outside HKD 40,000–200,000;
- missing issue-age/policy-year row;
- missing source evidence;
- unsupported repeated-support history.

Valid cached Official data remains separate from User Layer data. An Official refresh must not overwrite User overrides. This Layer 2 adapter has no User write path.

## Current setting decision

`reserve_engine` is now `medsave_v1_legacy_nonproduction` in `SystemSettings`, with an explicit compatibility description. This avoids presenting the historical fixed-withdrawal MedSave label as the active customer calculation engine. The accepted Forward implementation remains protected/research-scoped until a later task explicitly activates a complete production Forward result path.

## Verification summary

- Sheet read-back: 314 rows; no duplicate keys; version 1; all enabled; product `aia_hk_5pay`; currency HKD; pay term 5; policy years 1–60; direct anchor contributions 40K, 70K, 100K, 130K, 150K, 180K, 200K.
- Layer 2 adapter tests cover direct state, accepted interpolation, schema/version/product/range failures, and Forward hydration.
- GAS tests cover the read-only action, missing sheet/version, unsupported product/pay term, and duplicate keys.
- Existing fixtures remain in `research/ipos/fixtures/dataset.json`.
- Customer Flow was not redesigned.
- Reverse Solver was not implemented.
- Live GAS deployment remains `NOT_VERIFIED` until the existing Web App is redeployed and checked.
