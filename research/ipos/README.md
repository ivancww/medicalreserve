# iPOS Approximation Research Dataset

This directory is intentionally separate from the production Medical Reserve flow and from PR #1. It is the input boundary for the AIA 環宇盈活儲蓄保險計劃 approximation research phase.

## DATASET_INPUT_REQUIRED

No genuine iPOS proposal PDFs or de-identified numeric proposal tables are present in this repository. Validation must not start until the following current projected-illustration, HKD, 5 Pay inputs are supplied and their internal metadata is verified:

### Required source cases

The source filenames may differ, but each supplied file must be mapped to one of these case identities in `manifest.json`:

- `40yrs_5pay_130k_avf`
- `40yrs_5pay_130k_avpu`
- `45yrs_5pay_130k_avf`
- `45yrs_5pay_130k_avpu`
- `45yrs_5pay_130k_avf_56_60`
- `45yrs_5pay_180k_56_60`
- `45yrs_5pay_130k_avf_55`
- `45yrs_5pay_130k_avpu_55yr`
- `5pay_avf_150k`
- `5pay_avf_200k`
- `5pay_avpu_200k`
- `5pay_180k_avf`
- `5pay_180k_avpu`
- `50yrs_5pay_130k_avf`
- `50yrs_5pay_130k_avpu`
- `50yrs_5pay_180k_avf`
- `50yrs_5pay_180k_avpu`
- `40k_original`
- `70k_original`
- `70k_avf`
- `70k_avpu`
- `100k_original`

Additional genuine proposals may be supplied, but they must use the same schema and be assigned to calibration, holdout, or regression before fitting.

### Required numeric tables

For every case, provide:

1. Proposal metadata: product, product version/date, currency, payment term, issue age, annual premium, initial Basic Amount, withdrawal pattern, withdrawal start age, and scenario type.
2. Current projected no-withdrawal base values by age / Policy Year, or an explicitly identified matching base proposal.
3. Current projected medical-withdrawal rows by age / Policy Year, including withdrawal and displayed projected remaining surrender value.
4. Where shown in the proposal: Basic Amount after withdrawal, guaranteed cash value, reversionary bonus, terminal dividend, and component-level withdrawal allocation.
5. Any final full-surrender row, explicitly typed as `fullSurrender` so it cannot enter medical-withdrawal calibration.

The age-55 rows must include the displayed checks `828920 - 14031 = 814889` for AVF and `828920 - 19128 = 809792` for AVPU, plus all future annual rows needed for blind validation.

Do not provide personal information. Raw PDFs must remain outside Git; commit only de-identified numeric fixtures and provenance hashes.

## Import contract

Use `schema.json` for the deterministic manifest and yearly-row shape. Reject a case when metadata does not match the requested product, current proposal version/date family, HKD, or 5 Pay scope. Do not infer missing values, filename metadata, scenario type, or component values.

