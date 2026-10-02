# Recovered Historical iPOS Formula Checkpoint

Classification: **RECOVERED_FORMULA_PARTIAL — SPECIFIC RULE STILL MISSING**

This checkpoint recovers and reproduces only rules that exist in Git history or genuine proposal evidence. It does not optimize v4 or the carried-ratio candidate, and it does not invent the missing RB/TD transition.

## A. Recovered historical calculation sequence

1. **policyYear** — `policyYear = attainedAge - issueAge`  
   Source: historical code 0b76a7c; genuine proposal annual tables.
2. **basicAmount** — `Basic Amount is resolved by exact premium anchor; interpolation was present historically but is not needed for anchor reproduction.`  
   Source: historical code 0b76a7c; fixture metadata; genuine proposal metadata.
3. **noWithdrawalNormalization** — `component(PY, Basic) = genuine no-withdrawal component(PY) / original Basic Amount * current Basic Amount`  
   Source: historical code 0b76a7c and 525669e; genuine proposal evidence.
4. **firstWithdrawal** — `remaining total = no-withdrawal total - current withdrawal`  
   Source: historical code 217eed4; committed regression tests; genuine proposal evidence.
5. **allocationIdentity** — `withdrawal = RB withdrawal + associated TD withdrawal + GCV withdrawal`  
   Source: genuine allocation tables d0311fc.
6. **basicReduction** — `Basic reduction = GCV withdrawal / (no-withdrawal GCV(PY) / original Basic Amount)`  
   Source: historical code 525669e; genuine proposal evidence d0311fc.
7. **postReductionGCV** — `post GCV = no-withdrawal GCV(PY) / original Basic Amount * current Basic Amount`  
   Source: genuine proposal evidence d0311fc.

The sequence becomes incomplete after a first withdrawal: no historical code/report supplies an evidence-valid RB replenishment and TD carryover law that reproduced the later total path at 0.05%–0.10%.

## B. Git-history finding

| Commit | Finding |
| --- | --- |
| `0b76a7c` | First committed research engine: policy-year mapping, premium-to-Basic anchors, normalized components, allocation and persistent-state attempt; holdout max 57.11395611%. |
| `525669e` | Normalized policy-year transition v2 and GCV-per-Basic reduction structure; holdout max remained 56.85795543%. |
| `06cc472` | v3 base-curve diagnostics; holdout max 35.97650942%. |
| `217eed4` | v4 TD transition; holdout max 11.80075621%. |
| `d0311fc` | Genuine evidence audit committed complete paired annual GCV/RB/TD/allocation evidence. |
| `01310d5` | Later carried-ratio total-value candidate; explicitly excluded from recovery. |

No PR conversation comments, branch, tag, reflog entry, unreachable commit, report, test, or historical engine contains a complete successful annual formula. The committed 0.05%–0.10% successes are individual identities/rows, not an end-to-end annual engine result.

## C. Historical reproduction

| Check | Rows | Within HKD 1 | Mean absolute HKD | Maximum absolute HKD |
| --- | ---: | ---: | ---: | ---: |
| firstWithdrawal | 22 | 22 | 0 | 0 |
| basicReduction | 221 | 177 | 0.641456 | 2.168633 |
| postReductionGCV | 1205 | 1203 | 0.182992 | 1.0356 |
| componentIdentity | 2410 | 2410 | 0.30332 | 1 |
| allocationIdentity | 1205 | 1205 | 0.044813 | 1 |

### Prompt-cited 70K Basic Amount examples

| PY | GCV withdrawal | Observed reduction | Recovered reduction | Absolute % |
| ---: | ---: | ---: | ---: | ---: |
| 19 | 2837 | 7210 | 7209.649448 | 0.00486202% |
| 20 | 10298 | 24857 | 24856.42124 | 0.00232836% |

### PY15 no-withdrawal normalization

| Annual premium | Basic Amount | No-withdrawal total | Total / Basic |
| ---: | ---: | ---: | ---: |
| 40000 | 404041 | 354203 | 0.87665113194 |
| 70000 | 710660 | 623002 | 0.87665268905 |
| 100000 | 1015229 | 890003 | 0.876652459691 |
| 130000 | 1323829 | 1160538 | 0.87665249817 |
| 150000 | 1527495 | 1339082 | 0.876652296734 |
| 180000 | 1832994 | 1606898 | 0.876652078512 |
| 200000 | 2042901 | 1790914 | 0.876652368372 |

## D. Expanded validation

**NOT RUN — prerequisite failed.** No committed or recoverable complete historical RB/TD transition path exists. Running a full total-value holdout would require substituting or inventing a new rule, prohibited by this recovery task.

MAPE, maximum annual total error, worst case, and threshold crossings are therefore **not available**, rather than being represented by v4 or carried-ratio metrics.

## E. First missing rule

The first unresolved state after the exact first-withdrawal row is **RB depletion/replenishment plus associated TD carryover into the following Policy Year**. GCV and Basic Amount normalization are recoverable and independently reproducible; the missing RB/TD transition prevents a complete subsequent-year total.

## F. Decision

**RECOVERED_FORMULA_PARTIAL — SPECIFIC RULE STILL MISSING**

The specific missing historical rule is the evidence-valid next-year RB/TD state transition. No new generic approximation was substituted. Leakage: **PASS**. Production activation: **NO**.
