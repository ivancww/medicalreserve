# iPOS Approximation Research Dataset

This directory is intentionally separate from the production Medical Reserve flow and from PR #1. It is the input boundary for the AIA 環宇盈活儲蓄保險計劃 approximation research phase.

## Dataset status

The validated Google Drive proposal corpus has been normalized into [fixtures/dataset.json](fixtures/dataset.json). Raw PDFs are not committed. The fixture contains current projected, HKD, 5 Pay rows only, with provenance IDs, metadata validation fields, base curves, withdrawal schedules, component values, and frozen calibration/holdout roles.

The fixture split is frozen before fitting. Holdouts cover early withdrawal, premium interpolation, issue-age generalization, Original intensity, and AVPU/premium strength dimensions. Holdout results are generated in `validation-report.json` and `validation-report.md`.

The withdrawal schedule is an exogenous input to the state engine, representing Medical Premium / Medical Reserve Support after normalization. It is not used as a surrender-value target. The blind fit excludes all holdout cases when learning Basic Amount anchors, base curves, component depletion, and Basic Amount transition behavior.

## DATASET_INPUT_REQUIRED

This status applies only when the de-identified fixture corpus is absent. Do not substitute raw PDFs or filename assumptions for the fixture schema below.

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
