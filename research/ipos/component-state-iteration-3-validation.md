# Component-State Phase A / Iteration 3 Validation

Classification: **MODEL REJECTION**. No implementation or production regression was found.

| Check | Result | Evidence |
| --- | --- | --- |
| Node regression | PASS | 32 passed, 0 failed |
| Iteration 3 component regression | PASS | 3 passed, 0 failed |
| Saved report validation | PASS | Recomputed metrics from stored predictions; 0 new holdout projections |
| Evidence schema / provenance | PASS | 1,205 source rows; 1,205 pairs; 346 transitions |
| Fixture schema / frozen roles | PASS | Schema and assignments unchanged |
| Fixture schedule consistency | FAIL | Three frozen age-100 HKD85/8/2 rows remain inconsistent with source-confirmed zero |
| First withdrawal | PASS | Exact within displayed HKD rounding |
| Five-row component gate | FAIL | Candidate model rejection; 2 of 5 rows pass all independent component thresholds |
| Zero-withdrawal persistence | PASS | State persists structurally; no full numerical pause/resume claim |
| Impossible component states | FAIL | Six pre-clamp invalid component rows: five calibration and one holdout |
| Leakage / model lock | PASS | Calibration-only sources; lock `fce66985c0c82da55e1f4578268922a0684be9b9a739a6f10a259e2cf23e75f2` |
| Candidate frozen holdout count | PASS | Exactly one run after lock |
| Protected production files / frozen fixture diff | PASS | No changes from starting HEAD |
| Node/Python syntax and `git diff --check` | PASS | Completed |

The fixture consistency failure is the required preserved benchmark caveat. It is separate from the Iteration 3 model rejection; neither is reported as PASS.
