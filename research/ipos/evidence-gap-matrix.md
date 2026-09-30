# Genuine iPOS Evidence Audit

Starting head: `fb67494394afda9bbb1bc7c4154468642461e990`

EVIDENCE_SUFFICIENT_FOR_NEXT_MODEL

The prior fixture contains only selected no-withdrawal checkpoints. Genuine annual central component rows are already present in the SAME PDFs (usually pp12–13); missing annual values were an extraction gap, not a proposal gap.

23 PDFs inspected; 22 usable central HKD 5Pay proposals; one unrelated USD anniversary statement excluded. 1205 annual same-PDF comparisons; 346 consecutive positive-withdrawal transitions.

No fitting. v4 and the frozen fixture are unchanged. No raw PDF or identifying text is committed.

## Internally verified proposal metadata

| Source / case | Issue age | Annual premium (printed / rounded table) | Initial Basic Amount | Term / currency | Research strategy | Start age | PY range |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ipos-7416b1594a53d1bd / 45yrs_5pay_130k_avpu_55yr | 45 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVPU | 55 | [1, 55] |
| ipos-c7cd776365d2e8b5 / 45yrs_5pay_130k_avf_55 | 45 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVF | 55 | [1, 55] |
| ipos-43aef1e32fa3e42d / 40yrs_5pay_130k_avf | 40 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVF | 61 | [1, 60] |
| ipos-b1272f8eb1f797f5 / 40yrs_5pay_130k_avpu | 40 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVPU | 61 | [1, 60] |
| ipos-097be310d0f7d0d1 / 50yrs_5pay_180k_avpu | 50 | 180000.01 / 180000 | 1832994 | 5 / HKD | AVPU | 61 | [1, 50] |
| ipos-c4648de5cd771a6a / 50yrs_5pay_130k_avpu | 50 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVPU | 61 | [1, 50] |
| ipos-ec240d657705979a / 50yrs_5pay_130k_avf | 50 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVF | 61 | [1, 50] |
| ipos-34ec372fa4c903db / 50yrs_5pay_180k_avf | 50 | 180000.01 / 180000 | 1832994 | 5 / HKD | AVF | 61 | [1, 50] |
| ipos-3afcb35b16f2ab2f / 45yrs_5pay_180k_56_60 | 45 | 180000.01 / 180000 | 1832994 | 5 / HKD | Original | 56 | [1, 55] |
| ipos-cf93323294f22530 / 45yrs_5pay_130k_avf_56_60 | 45 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVF | 56 | [1, 55] |
| ipos-fb8b45d0c3d329ff / 45yrs_5pay_130k_avf | 45 | 130000.01 / 130000 | 1323829 | 5 / HKD | AVF | 61 | [1, 55] |
| ipos-c6cbc4082bd01470 / 5pay_180k_avf | 45 | 180000.01 / 180000 | 1832994 | 5 / HKD | AVF | 61 | [1, 55] |
| ipos-1b1268c5907ee30d / 5pay_180k_avpu | 45 | 180000.01 / 180000 | 1832994 | 5 / HKD | AVPU | 61 | [1, 55] |
| ipos-5bb64a1c9b773f1d / ipos-5bb64a1c9b773f1d | 45 | 130000.01 / 130000 | 1323829 | 5 / HKD | UNLABELLED_NUMERIC_WITHDRAWAL_SCHEDULE | 61 | [1, 55] |
| ipos-2102fab5c1e4cfff / 5pay_avpu_200k | 45 | 200000.01 / 200000 | 2042901 | 5 / HKD | AVPU | 61 | [1, 55] |
| ipos-1c3651fc71e1a245 / 5pay_avf_200k | 45 | 200000.01 / 200000 | 2042901 | 5 / HKD | AVF | 61 | [1, 55] |
| ipos-e7156a5b2f0392ab / 5pay_avf_150k | 45 | 150000.01 / 150000 | 1527495 | 5 / HKD | AVF | 61 | [1, 55] |
| ipos-19aab67938abfd5f / 70k_avf | 45 | 70000.01 / 70000 | 710660 | 5 / HKD | AVF | 61 | [1, 55] |
| ipos-d9689d78fa5440fd / 70k_avpu | 45 | 70000.01 / 70000 | 710660 | 5 / HKD | AVPU | 61 | [1, 55] |
| ipos-8100b5272f80c956 / 100k_original | 45 | 100000.06 / 100000 | 1015229 | 5 / HKD | Original | 61 | [1, 55] |
| ipos-130e729fbd4565ec / 70k_original | 45 | 70000.01 / 70000 | 710660 | 5 / HKD | Original | 61 | [1, 55] |
| ipos-500fbc7cf3a698d8 / 40k_base | 40 | 40000.06 / 40000 | 404041 | 5 / HKD | Original | 61 | [1, 60] |

Strategy labels are existing research manifest labels; the PDFs verify numeric withdrawal schedules and do not define AVF/AVPU as official strategy terms. No label is established by filename alone.
Annual printed premiums contain cents; the first paid-premium table row is rounded to dollars. Both are preserved without changing the existing engine premium anchors.

## Field definitions and provenance

A: no-withdrawal total; B: post-withdrawal total; C: displayed post-withdrawal Basic Amount; D/E/F: both no-withdrawal and post-withdrawal GCV/RB/TD; G: total withdrawal; H/I/J: RB/associated TD/GCV allocation.
Every JSON field is explicitly AVAILABLE, NOT AVAILABLE, AMBIGUOUS or ESTIMATED_ONLY. No interpolated value enters these genuine tables. C uses the direct post-withdrawal column; the no-withdrawal Basic Amount is the initial metadata amount, not an additional annual column.
Within-PDF pairing fixes product, issue age, premium and initial Basic Amount. Rows with reduced effective Basic Amount are flagged as capital-reduction-confounded and excluded from strict same-Basic-Amount interpretation.

## Priority PY10–30 evidence

| Case | PY10–14 | PY15–19 | PY20–24 | PY25–30 | Central source pages |
| --- | --- | --- | --- | --- | --- |
| 45yrs_5pay_130k_avpu_55yr | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | [{'page': 12, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 13, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 15, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 16, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 17, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}, {'page': 18, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}] |
| 45yrs_5pay_130k_avf_55 | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | [{'page': 12, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 13, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 15, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 16, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 17, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}, {'page': 18, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}] |
| 50yrs_5pay_130k_avpu | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | [{'page': 12, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 13, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 15, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 16, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 17, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}, {'page': 18, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}] |
| 5pay_avpu_200k | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | [{'page': 12, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 13, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 15, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 16, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 17, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}, {'page': 18, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}] |
| 70k_original | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | A–J AVAILABLE | [{'page': 12, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 13, 'type': 'CENTRAL_NO_WITHDRAWAL_ANNUAL'}, {'page': 15, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 16, 'type': 'CENTRAL_WITHDRAWAL_ALLOCATION'}, {'page': 17, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}, {'page': 18, 'type': 'CENTRAL_POST_WITHDRAWAL_ANNUAL'}] |

The complete per-Policy-Year A–J matrix with numeric values and page provenance is in evidence-gap-matrix.json. The earlier checkpoint-only representation must not be mistaken for absence in the proposals.

## Five immediate second-withdrawal diagnostics

| Case / age / PY | Genuine total | v4 total | GCV error HKD | RB error HKD | TD error HKD | Dominant |
| --- | --- | --- | --- | --- | --- | --- |
| 45yrs_5pay_130k_avf_55 / 56 / 11 | 858040 | 860248 | -13228.42 | 18870.42 | -3435.00 | GCV+RB interaction |
| 45yrs_5pay_130k_avpu_55yr / 56 / 11 | 846694 | 852327 | -17781.97 | 26379.97 | -2965.00 | GCV+RB interaction |
| 5pay_avpu_200k / 62 / 17 | 1980705 | 2004807 | -20524.83 | 33567.83 | 11059.00 | GCV+RB interaction |
| 50yrs_5pay_130k_avpu / 62 / 12 | 889076 | 899328 | -24739.70 | 37609.70 | -2619.00 | GCV+RB interaction |
| 70k_original / 62 / 17 | 665993 | 680643 | -15445.44 | 25020.44 | 5074.00 | GCV+RB interaction |

Model GCV and RB above are algebraically implied by v4’s shared aggregate ratio. The engine does not maintain separate GCV/RB states. Their split is therefore an accounting interpretation, with HKD 1 rounding precision, not additional genuine evidence.
At all five priority rows, genuine GCV equals the paired no-withdrawal GCV before any GCV tap. The shared model ratio reduces implied GCV while retaining too much RB; TD offsets the combined error in three rows and adds to it in two rows. This directly supports investigating the GCV/RB separation and RB carryover before further TD-only tuning.

## Age-100 source audit

| Case | Frozen schedule | Genuine allocation total / post amount | PDF pages | Status |
| --- | --- | --- | --- | --- |
| 50yrs_5pay_130k_avpu | 85 | 0 / 0 | 16, 18 | SOURCE_CONFIRMS_ZERO |
| 50yrs_5pay_180k_avpu | 8 | 0 / 0 | 16, 18 | SOURCE_CONFIRMS_ZERO |
| 70k_original | 2 | 0 / 0 | 16, 18 | SOURCE_CONFIRMS_ZERO |

All three genuine allocation tables and post-withdrawal tables explicitly display zero. The frozen fixture is intentionally preserved in this audit to avoid altering the benchmark. The independent genuine evidence contains the confirmed zeros.

## Evidence decision

EVIDENCE_SUFFICIENT_FOR_NEXT_MODEL
Enough existing calibration-only annual matched component evidence for a next component-state investigation. This does not identify an official formula or establish accuracy, and is not permission to fit in this run. Frozen holdouts remain evaluation-only; the additional 130k source is unassigned evidence-only.

Minimal new proposal request: **none**. Existing PDFs already supply the relevant annual paired component tables.

## Frozen result

{"MAPE": 2.29650947, "maxErrorPercent": 11.80075621, "rowsAbove010": 247, "annualRows": 325, "maxDollarError": 457617, "worstCase": "50yrs_5pay_130k_avpu", "worstAge": 72, "worstPolicyYear": 22, "leakage": "PASS"}
NOT_READY_FOR_INTEGRATION


## Direct component comparison (HKD)

| Case / PY | Component | Genuine | Model | Model − genuine |
| --- | --- | --- | --- | --- |
| 45yrs_5pay_130k_avf_55 / 11 | GCV | 351874 | 338645.58 | -13228.42 |
| 45yrs_5pay_130k_avf_55 / 11 | RB | 61482 | 80352.42 | 18870.42 |
| 45yrs_5pay_130k_avf_55 / 11 | TD | 444685 | 441250.00 | -3435.00 |
| 45yrs_5pay_130k_avf_55 / 11 | total | 858040 | 860248.00 | 2208.00 |
| 45yrs_5pay_130k_avpu_55yr / 11 | GCV | 351874 | 334092.03 | -17781.97 |
| 45yrs_5pay_130k_avpu_55yr / 11 | RB | 52892 | 79271.97 | 26379.97 |
| 45yrs_5pay_130k_avpu_55yr / 11 | TD | 441928 | 438963.00 | -2965.00 |
| 45yrs_5pay_130k_avpu_55yr / 11 | total | 846694 | 852327.00 | 5633.00 |
| 5pay_avpu_200k / 17 | GCV | 729520 | 708995.17 | -20524.83 |
| 5pay_avpu_200k / 17 | RB | 115740 | 149307.83 | 33567.83 |
| 5pay_avpu_200k / 17 | TD | 1135445 | 1146504.00 | 11059.00 |
| 5pay_avpu_200k / 17 | total | 1980705 | 2004807.00 | 24102.00 |
| 50yrs_5pay_130k_avpu / 12 | GCV | 370805 | 346065.30 | -24739.70 |
| 50yrs_5pay_130k_avpu / 12 | RB | 42715 | 80324.70 | 37609.70 |
| 50yrs_5pay_130k_avpu / 12 | TD | 475557 | 472938.00 | -2619.00 |
| 50yrs_5pay_130k_avpu / 12 | total | 889076 | 899328.00 | 10252.00 |
| 70k_original / 17 | GCV | 253777 | 238331.56 | -15445.44 |
| 70k_original / 17 | RB | 25170 | 50190.44 | 25020.44 |
| 70k_original / 17 | TD | 387047 | 392121.00 | 5074.00 |
| 70k_original / 17 | total | 665993 | 680643.00 | 14650.00 |

At PY17 the model also interpolates a base curve: 200k no-withdrawal GCV/RB/TD errors are HKD +3,472.75 / +167.50 / +21,694.25; 70k errors are +1,208 / +58.50 / +7,546.875. Base-curve interpolation is an additional confounder for those two cases. The PY11 and PY12 matched bases are exact within HKD 1, independently exposing the GCV/RB transition problem. No new coefficients or curve substitutions were applied.
## Genuine pause/resume evidence

- 45yrs_5pay_180k_56_60: last withdrawal PY15; displayed zero PY16–20; resumes PY21. Full component states and page provenance are in JSON.
- 45yrs_5pay_180k_56_60: last withdrawal PY25; displayed zero PY26–30; resumes PY31. Full component states and page provenance are in JSON.
- 45yrs_5pay_130k_avf_56_60: last withdrawal PY15; displayed zero PY16–20; resumes PY21. Full component states and page provenance are in JSON.
- 45yrs_5pay_130k_avf_56_60: last withdrawal PY25; displayed zero PY26–30; resumes PY31. Full component states and page provenance are in JSON.
- 40k_base: last withdrawal PY38; displayed zero PY39–44; resumes PY45. Full component states and page provenance are in JSON.
- 40k_base: last withdrawal PY45; displayed zero PY46–49; resumes PY50. Full component states and page provenance are in JSON.
- 40k_base: last withdrawal PY50; displayed zero PY51–59; resumes PY60. Full component states and page provenance are in JSON.

These are source observations; no engine pause/resume accuracy is claimed.
