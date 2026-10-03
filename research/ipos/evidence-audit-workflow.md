# Genuine Evidence Audit Workflow

This is an evidence reconstruction, not a model-fitting cycle. Read the latest relevant AVA Mother rules before continuing. Keep the v4 engine, production calculation, Customer Flow, frozen calibration/holdout assignment and fixture unchanged.

## Reproduction

Use authorized original PDFs outside the repository. Identify each by the SHA256 in `evidence-gap-matrix.json`; the hashes and physical PDF page indices identify the source without retaining customer information. The existing fixture's `sourceFileId` associates known sources with existing case identities. The additional unassigned source remains evidence-only.

Prepare a private JSON array outside Git, with entries containing `id` (Drive file ID) and `path` (authorized local PDF). Do not commit this manifest, raw PDFs, full extracted text or screenshots. Dependencies: Node, Python, pypdf, jsonschema and Poppler `pdftotext`.

```sh
node research/ipos/audit-model-snapshot.js /outside-repository/model-snapshot.json
python research/ipos/audit_evidence.py /outside-repository/private-manifest.json /outside-repository/model-snapshot.json
python research/ipos/validate_evidence.py
npm test
npm run check
npm run validate:ipos
python research/ipos/validate_fixtures.py
git diff --check
```

The extraction is deliberately strict: internal product/currency/term/age/premium/Basic Amount verification; exact numeric column counts; complete annual coverage; component and allocation rounding checks. Central detailed no-withdrawal tables are paired with central post-withdrawal tables in the same PDF. Pessimistic/optimistic pages, death values, footers and loan columns are excluded. A changed PDF layout requires source review rather than guessed columns.

`audit-model-snapshot.js` evaluates the unchanged existing calibration model only. It aborts if the frozen metrics change. Model GCV/RB contributions are algebraic partitions of a shared aggregate ratio, not independently maintained engine states. They must never be labelled genuine observations.

## Interpretation limits

The 492 strict same-effective-Basic-Amount comparisons distinguish component carryover before capital reduction. Other comparisons are explicitly flagged as confounded by Basic Amount reduction. The year-to-year add-back of displayed allocation is an accounting identity; it does not establish an official AIA transition formula.

All 14 existing calibration sources now have genuine annual paired components through PY10–30. A future investigation can use those calibration sources. The six frozen holdouts remain evaluation-only; neither new annual holdout components nor their diagnostic residuals may determine coefficients. No case-specific constants, premium/age patches or final-value fitting are authorized by this audit.

The five priority rows show unchanged genuine GCV and materially depleted genuine RB. v4's aggregate ratio cannot represent that separation. Its largest implied individual error is RB; the net GCV/RB residual survives genuine-TD substitution. The PY17 base-curve interpolation errors are separately reported. Evidence is sufficient to investigate these states, but does not yet identify the correct transition rule.

The three age-100 source tables confirm zero. The historical frozen schedules still contain HKD 85, 8 and 2; fixture validation therefore remains FAIL. A later separately reviewed fixture correction must distinguish the corrected benchmark from the historical frozen metrics. No pause/resume model accuracy or integration readiness is established here.
