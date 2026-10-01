# Component-State Phase A / Iteration 2 Validation

Classification: **MODEL REJECTION**. No implementation or production regression was found.

| Check | Result | Evidence |
| --- | --- | --- |
| Node regression | PASS | 29 passed, 0 failed |
| Iteration 2 component regression | PASS | 3 passed, 0 failed |
| Saved report validation | PASS | Recomputed metrics from stored predictions; 0 new holdout projections |
| Evidence schema / provenance | PASS | 1,205 source rows; 1,205 pairs; 346 transitions |
| Fixture schema / frozen roles | PASS | Schema and assignments unchanged |
| Fixture schedule consistency | FAIL | The three frozen age-100 HKD85/8/2 rows remain inconsistent with source-confirmed zero, as previously audited |
| First withdrawal | PASS | Exact within displayed HKD rounding |
| Five-row component gate | FAIL | Candidate model rejection; all five rows fail independent component thresholds |
| Zero-withdrawal persistence | PASS | State persists structurally; no numerical pause/resume certification claimed |
| Leakage / model lock | PASS | Calibration-only sources; lock `a164ff7350d9649034fad2cdbffdc9be5a913ef1f5149594d990e24893202547` |
| Candidate frozen holdout count | PASS | One run, after lock |
| Protected production files | PASS | No changes from starting HEAD |
| Node/Python syntax and `git diff --check` | PASS | Completed |

The fixture consistency failure is the required preserved benchmark caveat. No allocation was invented, no fixture was corrected, and it is not reported as a passing check.
