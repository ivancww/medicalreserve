# AVA Medical Reserve — Customer UI / Presentation Blueprint Audit

**APP:** AVA Medical Reserve  
**REPOSITORY:** `ivancww/medicalreserve`  
**AUDIT TYPE:** CUSTOMER UI / PRESENTATION BLUEPRINT ONLY

**Medical Reserve latest merged `main`:** `17469570dfe69ab362944ff62dcc9613a08067d5` — merged 2026-10-03, PR #2.  
**Mother Platform latest merged `main`:** `be05ff400019d6910d18798ffbebae1302776e98` — merged 2026-10-03.

**Current App Version: 1.0.1**, confirmed by `package.json`, `app.js`, and `manifest.webmanifest`. The audit used Medical Reserve `main` directly from the fetched ref. No application, calculation, GAS, or Sheet changes were part of the audit.

## A. Current State

The merged `main` snapshot contains a ten-step customer flow: Funding Source, Timeline, Coverage, Plan, Premium Journey, Premium Total, Reserve Transition, Build Reserve, Support, and Summary. The steps are configured through official `AppFlow`, with a hard-coded ten-step fallback. The current customer-facing implementation is in [`app.js`](https://github.com/ivancww/medicalreserve/blob/17469570dfe69ab362944ff62dcc9613a08067d5/app.js); the product’s V1 story is also stated in [`product-rules.md`](https://github.com/ivancww/medicalreserve/blob/17469570dfe69ab362944ff62dcc9613a08067d5/product-rules.md).

**Current major UI problems:**

- The first page asks about funding but does not first explain the App’s purpose or why the question matters.
- A large hero repeats the page title above the page’s own title. Progress and page counts appear throughout, even when a step is just one complete choice.
- Every step has bottom **上一步** and **繼續** controls. There is no direct advance for a choice that resolves a step.
- Premium Journey and Premium Total are separate pages; the transition to Medical Reserve follows them, but saving and support are unavailable placeholders.
- Strategy, Support, and Summary contain “temporarily unavailable” content because official `ReserveStrategies` is missing. Summary therefore does not tell a complete customer story.
- There is no Annual Saving amount or 5/10/15-year arrangement control in the production customer flow. The Forward Calculation research is not integrated into the flow.
- The header only says “Medical Reserve”; it does not identify AVA or the App version. Its **← 返回 AVA** link conflates platform return with page-level back.
- The current service worker uses a fixed cache name and does not show a completed automatic shell-update lifecycle. That is a Mother Standard follow-up, not a calculation or data change.

### Audit questions answered

1. **Does Entry explain the App?** No. It opens directly on a funding question.
2. **Is the journey technical, fragmented, or missing transitions?** It is fragmented by multiple separate pages and repeated navigation; the need-to-reserve transition exists as a page but does not yet connect to a working reserve experience.
3. **Can Funding Source be understood in one step?** Yes, if preceded by a short explanation and presented as four clear choices.
4. **Are age interactions logically grouped?** Not yet. Current Age and Retirement Age share a step; Coverage Age is another step; Support Start and End do not exist in the customer flow. Group timeline inputs where they serve the same planning period, but keep Support Start/End explicit if they define a distinct Forward Calculation period.
5. **Does the customer see premiums before configuring saving?** The intended sequence does; the current saving page is unavailable and offers no configuration.
6. **Is Medical Need → Medical Reserve clear?** The transition text exists, but it currently follows a separate total page and leads to an unavailable strategy page.
7. **Is 5/10/15 understandable without mislabeling AIA terms?** It can be, with simple one-, two-, or three-phase bands and explicit “each phase is five years.” Do not label these as official 10Pay/15Pay products.
8. **Can Support and remaining value be understood without a giant table?** Yes: a selected-age result, balance graphic, support timeline, and expandable annual rows.
9. **Primary Forward visualization?** An age rail with a selected-year result card and remaining-value balance, plus cumulative support and optional annual details.
10. **Hide behind Detail on Demand?** Year-by-year rows, phase mechanics, calculation assumptions, source freshness, and technical validation data.
11. **Does current Summary tell one story?** No; reserve results are unavailable, so it cannot summarize the build/support outcome.
12. **Redundancies?** Repeated title hierarchy, Premium Journey plus Premium Total as separate stops, and universal bottom Back/Next buttons. Exact page consolidation should preserve the premium story and customer comprehension.
13. **UI/Product Logic conflicts?** Yes: the period used for premium need vs. Support may differ, and the research spec allows phase-specific contributions while the requested UI concept names one annual amount. See **Decisions Required**.
14. **What should be implemented next after approval?** The proposed entry, need-to-reserve flow, configuration, specialized Support presentation, and Summary described below—only after resolving those product-facing ambiguities and keeping calculation activation out of the production flow until its existing prerequisites are satisfied.

## B. Mother Standard Alignment

The controlling sources are Mother `AGENTS.md`, `docs/MOTHER-RULES.md`, and `design-system/DESIGN-SYSTEM.md` at the latest fetched Mother commit: [AGENTS.md](https://github.com/ivancww/avaplatform/blob/be05ff400019d6910d18798ffbebae1302776e98/AGENTS.md), [Mother Rules](https://github.com/ivancww/avaplatform/blob/be05ff400019d6910d18798ffbebae1302776e98/docs/MOTHER-RULES.md), and [Design System](https://github.com/ivancww/avaplatform/blob/be05ff400019d6910d18798ffbebae1302776e98/design-system/DESIGN-SYSTEM.md). The shared rules require the same AVA presentation skeleton while retaining each App’s content, logic, and data ownership.

| Area | Audit finding and blueprint direction |
|---|---|
| Header / version | Replace the current wordmark-only header with **AVA MEDICAL RESERVE · v1.0.1** and a distinct Journey / Page identity. The source value is clear: `1.0.1`. |
| 返回 AVA | Persistent top-right platform navigation, visibly labelled **返回 AVA**, with the AVA-consistent outlined arrow icon and 44px minimum target. Keep it outside the Main Presentation Card. Current destination is the AVA Platform URL in `app.js`. |
| Internal ← 返回 | On internal pages, use a separate **← 返回** above the Main Card when the step has a meaningful prior step. It must not be styled or described as Return to AVA. |
| Bottom 上一步 | Remove the global bottom **上一步** control. Back belongs in the internal page header where appropriate. |
| Main Presentation Card | One primary concept per page; content-sized card. Use shared AVA typography, tokens, states, 44px targets, and metric/result patterns. |
| Navigation | Use direct advance for a complete single choice. Use explicit **下一步** for multi-input configuration, review, or validation. Don’t show progress on the Entry page; show meaningful progress only for a defined multi-step journey. |
| Responsive | Use shared compact ≤650px, medium 651–1000px, and wide >1000px behavior. Foldables and split-screen use the usable viewport range, not device detection. |
| Horizontal overflow | Avoid page-level horizontal scrolling. Any intentionally scrollable annual timeline/table owns its own scrolling, with an accessible name and focus behavior. Do not hide overflow to mask layout issues. |
| PWA / standalone | Preserve the same journey and visible Return to AVA in browser and standalone. The latest Mother Shell Update Standard requires automatic discovery/activation and preservation of local data; the current fixed service-worker cache indicates this gate is not established by this audit. |
| Major gaps | Missing AVA/version identity; Return-to-AVA is visually conflated with page Back; repeated page title; universal bottom navigation; current Reserve/Support/Summary placeholder; shared token implementation not present in the current CSS; physical-device behavior NOT VERIFIED. |

## C. Current Page Inventory

The ten entries below are the current fallback pages; official `AppFlow` may configure titles, visibility, and ordering. For rows that depend on current control behavior, see [`app.js`](https://github.com/ivancww/medicalreserve/blob/17469570dfe69ab362944ff62dcc9613a08067d5/app.js).

| Current page | Role | Purpose / customer question | Current interaction and navigation | Data / calculation dependency | Keep / change candidate |
|---|---|---|---|---|---|
| `funding` | **A. Entry / Journey Selection** | Which funds might pay future medical premiums? | Four choices: 銀行存款, 投資資產, 家庭財務, 退休生活資金; currently requires **繼續**. | Official funding options, with safe fallback. Currently stored as choice; no visible downstream effect. | Keep choices; add purpose-setting message and direct advance after selection. |
| `timeline` | **B. Internal Journey Step** | What is the customer’s current age and expected retirement age? | Current Age number input; Retirement Age select; small timeline. **繼續**. | Official retirement-age options; currently defaults 40 and 65. | Keep and simplify. Retirement choices 55/60/65/70 are fallback values, not proof every current official configuration offers them. |
| `coverage` | **B. Internal Journey Step** | How long should the medical projection run? | Coverage age options, with years after retirement; **繼續**. | Official coverage-age options; fallback 80/85/90/95/100. | Keep the planning endpoint; consider combining with other planning-age review only if it remains clear. Verify options against Official config. |
| `plan` | **B. Internal Journey Step** | Which Medical Plan / deductible is assumed? | Official plan choices; **繼續**. | Official `MedicalPlans` mapping to display name, deductible, and premium sheet. No fabricated plan values when unavailable. | Keep. Ensure correct product spelling **尊耀計劃** whenever that plan appears. |
| `journey` | **C. Result / Presentation** | How does annual Medical Premium progress with age? | Five-year checkpoint rows with bar and value; annual premium data is loaded for the selected range. **繼續**. | `premiumRange` and annual official premiums/checkpoints. Current client requests legacy retirement/coverage fields. | Keep as a premium presentation, redesign first view as hero and age rail; detailed annual rows on demand. |
| `total` | **C. Result / Presentation** | What is the cumulative premium over the period? | Total plus start and coverage ages as metric cards; **繼續**. | Sum of every official annual premium row in the returned period. | Combine into the Medical Premium presentation where it improves continuity; retain clear distinction between annual and cumulative values. |
| `transition` | **B. Internal Journey Step** | Why consider Medical Reserve after seeing the need? | Explanatory card only; **繼續**. | Premium period/total should ground the transition. | Keep the conceptual transition, but integrate the explanation into a purposeful page that leads into reserve configuration. |
| `strategy` | **D. Specialized Interactive Step** (intended) | How much will the customer save, and which arrangement? | Currently displays unavailable warning; no saving controls. | `ReserveStrategies` currently missing; Forward Calculation exists separately in research, inactive in customer flow. | Replace placeholder only after approved Forward integration stage; do not alter calculation to support the UI. |
| `support` | **D. Specialized Interactive Step** | What happens to Medical Reserve Support and remaining value over time? | Currently unavailable warning; no interactive result. | Official medical premiums plus Forward Calculation result; neither is integrated here. | Keep as the specialized result page, with a timeline and selected-year visualization after the integration boundary is cleared. |
| `summary` | **C. Result / Presentation** | What plan and reserve outcome are being explored? | Currently repeats premium total and unavailable Reserve warning. **繼續** restarts flow. | Premium data plus eventual Forward output. | Keep and restructure as concise customer story; remove restart as the primary result action. |

**Additional customer-visible states:** generic “other kind” pages configured through AppFlow render supporting text in a generic card, so arbitrary official page kinds are not tailored product screens. User-created pages and User Edit/Preview controls are User-layer content/modes, not part of the normal customer journey. The app also has `Customer Presentation` mode, but it is a mode switch, not a separate journey page. Admin is out of scope.

## D. Proposed Customer Journey

This blueprint preserves the V1 need-first intent in `product-rules.md`, while combining premium presentation where it remains understandable. It does not move calculation into the production customer flow.

| ID / page | Type; purpose; card content | Interaction / navigation | Dependencies, details, and responsive notes |
|---|---|---|---|
| **E0 — 開始規劃醫療儲備** | **A. Entry.** Supporting label: *AVA MEDICAL RESERVE*. Main message: future medical premiums may continue into retirement; this journey helps the customer see the need and explore a Medical Reserve. Primary content: brief BUILD → RESERVE → SUPPORT explanation; no questionnaire first. **SMALL.** | **下一步: N/A** as a control; one clear **開始** action begins the journey. No ← 返回, no progress, no bottom 上一步. | No calculation. Use a responsive, concise Main Card. Return to AVA remains in the top header. |
| **P1 — 資金來源** | **B. Internal.** Supporting label: *了解規劃背景*. Main question: which existing funding source may be used for future medical premiums? Supporting copy explains this is context for the discussion. Four options only: 銀行存款 / 投資資產 / 家庭財務 / 退休生活資金. **MEDIUM** when cards wrap; otherwise SMALL. | **DIRECT ADVANCE** after one choice; selection resolves the step. ← 返回 to E0; meaningful progress begins here. | Official flow options / User-permitted rendered content. Do not imply a funding choice changes the calculation unless current product behavior says so; currently it does not. Stack the four choice cards on compact screens. |
| **P2 — 你的退休時間線** | **B. Internal.** Supporting label: *先設定規劃年齡*. Main message: capture Current Age and Retirement Age together. Show selected current/retirement ages on one simple age rail. **MEDIUM.** | **EXPLICIT NEXT**: multiple values must be entered and reviewed together. ← 返回; meaningful progress. | Official retirement options; values 55/60/65/70 appear only if present in current Official configuration. Current Age control with visible label, validation, 44px target. |
| **P3 — 醫療保障至幾多歲？** | **B. Internal.** Supporting label: *設定保障規劃終點*. Main question: through which age should the premium need be shown? Coverage options from Official data; fallback evidence is 80/85/90/95/100 but do not assume these are live options. **MEDIUM.** | **DIRECT ADVANCE** when choosing an age fully resolves it, unless an explicit review step is needed by current product behavior. ← 返回; progress. | Official coverage options and selected period. Choice cards or compact age selector, with plain-language period context. |
| **P4 — 選擇醫療計劃** | **B. Internal.** Supporting label: *使用官方保費資料*. Main question: which Medical Plan / deductible should anchor the projection? Show official display name and deductible. **MEDIUM.** | **DIRECT ADVANCE** after one plan selection if the selection is complete and loads an official premium range. ← 返回; progress. | Official `MedicalPlans` and premium mapping; do not invent plan names. Write **尊耀計劃** correctly. Show loading, unavailable, and retry messaging in customer language. |
| **P5 — 看見未來醫療保費** | **C. Result / Presentation.** Supporting label: *官方年度保費資料*. Main message: selected annual premiums by age create a long-term need. Lead with a hero cumulative premium and period; show a simple age rail / premium progression. Annual rows are optional detail. **LARGE** if details expanded; otherwise MEDIUM. | **EXPLICIT NEXT** after customer has reviewed the need and proceeds to reserve. ← 返回; meaningful progress. | Official complete annual premiums and selected plan/period. Keep annual and cumulative figures distinct, labelled with HKD and age range. Expandable rows; no dense table as the first view. |
| **P6 — 從醫療需要到 Medical Reserve** | **B. Internal / transition.** Supporting label: *BUILD → RESERVE*. Main message: the premiums shown are the future need; a Saving Plan can be explored as a structure for preparing Medical Reserve Support. Explain that this is an exploration, not a promise that all premiums are covered. **SMALL–MEDIUM.** | **EXPLICIT NEXT**: customer chooses to explore reserve configuration. ← 返回; progress. | Depends on prior premium result. No new calculation. This bridge must precede Saving controls; don’t jump directly from premium into calculator inputs. |
| **P7 — 建立 Medical Reserve** | **D. Specialized Interactive Step.** Supporting label: *BUILD*. Main question: how much to save annually and for how many five-year phases? Proposed display: Annual Saving amount range HKD 40,000–200,000 and arrangement choice **5年 / 10年 / 15年**. Show a conversational phase band: 1 phase; 2 successive five-year phases; 3 successive five-year phases. **MEDIUM–LARGE.** | **EXPLICIT NEXT**: amount and arrangement need review/validation together. ← 返回; progress. | Forward inputs include Current Age, phase contributions, phase enablement, support range, plan, and official premiums. **DECISION REQUIRED:** one amount applied to every phase vs. separate phase amounts, because the merged Forward spec permits distinct annual contributions by phase. Customer-facing labels must not claim official AIA 10Pay/15Pay products. |
| **P8 — Medical Reserve Support** | **D. Specialized Interactive Step.** Supporting label: *SUPPORT*. Main message: explore what happens from Support Start Age to Support End Age. Main view: selected age result card with **Medical Premium**, **Medical Reserve Support**, **Projected Remaining Medical Reserve Value**, plus a visual balance. Show cumulative Support as a secondary metric. A horizontal age rail selects years; expandable annual details expose each row. **SPECIALIZED.** | **EXPLICIT NEXT** for configured ages and review of the result period. ← 返回; meaningful progress. | Forward Calculation and official premiums. Active phase appears as a simple “Support from phase 1/2/3” label only when meaningful; explain five-year rotation behind “How support is assigned.” The rail owns horizontal scrolling; entire page must not overflow. |
| **P9 — 你的醫療儲備重點** | **C. Result / Presentation.** Supporting label: *規劃摘要*. Main message: a coherent recap of the medical need and the reserve arrangement explored. Include planning period; Medical Plan/assumption; approximate cumulative premium need; Annual Saving amount and phase arrangement; Support Start/End Age; cumulative Support where meaningful; remaining value at selected milestones/end age; one plain-language takeaway. **MEDIUM–LARGE.** | **N/A** for a forward step. Offer deliberate “再調整”/return-to-edit path and close/return behavior; no universal bottom 上一步. | Premium + eventual Forward outputs. Detailed annual values remain a separate on-demand view. Do not report an unsupported result as a confirmed value. |

### Main Support Visualization

The strongest primary presentation is an **age rail + selected-year card + remaining-value balance**, not a full-width dense table:

1. The age rail shows the Support Start–End span, with the selected age clearly labelled.
2. The result card shows that age’s actual Official Medical Premium, Medical Reserve Support, and projected remaining value, each with currency/period units.
3. A compact balance bar shows the relationship between support and remaining reserve only when calculation outputs define those quantities. It must not imply a guaranteed outcome.
4. A cumulative Support metric answers “how much support has been shown so far?”
5. Expandable annual details list Age → Premium → Support → Projected Remaining Value.
6. A phase label is explanatory context, not the headline or a customer-facing state machine.

If the timeline is wider than the viewport, only the rail scrolls horizontally, with focus/keyboard access and visible selected age. The page itself wraps and remains within the viewport.

## E. Journey Map

**ENTRY — explain future medical premiums and BUILD → RESERVE → SUPPORT**  
↓  
**Funding Source**  
↓  
**Current Age + Retirement Age**  
↓  
**Coverage End Age**  
↓  
**Medical Plan / deductible**  
↓  
**Future Medical Premium hero + timeline + cumulative need**  
↓  
**Medical Need → Medical Reserve transition**  
↓  
**Annual Saving amount + 5 / 10 / 15-year arrangement**  
↓  
**Support Start/End + Forward result by age**  
↓  
**Summary: need → arrangement → Support → remaining value**

## F. Forward Calculation UI Boundary

The merged PR #2 research is explicitly separate from production customer flow. Its original-intent spec says production activation remains inactive, identifies unsupported repeated-support histories, and documents a GAS live-contract gap. See [`original-intent-calculation-spec.md`](https://github.com/ivancww/medicalreserve/blob/17469570dfe69ab362944ff62dcc9613a08067d5/research/ipos/original-intent-calculation-spec.md) and [`original-intent-forward-report.md`](https://github.com/ivancww/medicalreserve/blob/17469570dfe69ab362944ff62dcc9613a08067d5/research/ipos/original-intent-forward-report.md).

- **Integration pages:** P7 Build Medical Reserve supplies inputs; P8 Medical Reserve Support presents annual results; P9 Summary consumes the approved aggregate outputs. P5 remains the separate official Medical Premium need presentation.
- **Inputs:** Current Age (Phase 1 issue age); Phase 1 annual contribution; optional Phase 2 and Phase 3 contributions/enablement; Support Start Age; Support End Age inclusive; Official Medical Plan and its mapped deductible.
- **Official data:** `MedicalPlans` maps plan ID/display name/deductible/premium sheet. Official annual premium range must include every attained age in the support interval; missing age or mapping must not be interpolated or fabricated. Medical Premium data remains the Sheet/GAS contract’s authority.
- **Calculation:** 5/10/15-year arrangements mean 1/2/3 independent 5Pay blocks, offset by 0/+5/+10 years. The approved rotating phase routing is preserved. Non-active phases continue ageing; they are not reset or reissued.
- **Outputs:** age, annual Medical Reserve Support, cumulative Support, and Projected Remaining Medical Reserve Value only where calculation supports the path. Customer labels omit research evidence classifications.
- **Visualization:** selected-year result plus age rail, balance visualization, cumulative Support, and annual detail on demand.
- **Detail on demand:** annual values, assumptions/source information where appropriate, and a plain-language explanation of which phase supplies Support. Internal component values, evidence labels, iPOS comparisons, engine names, and research diagnostics do not belong in normal Customer Presentation.
- **Loading:** show that official premiums or the projection are loading without inventing a percentage or partial result.
- **Unavailable/error:** distinguish missing Official premium data from an unavailable projection; show a clear retry/edit action. Do not display fabricated premiums or remaining values.
- **Unsupported/out of range:** stop the projection safely and explain that a result is unavailable for the selected inputs. Don’t expose technical labels such as `NOT_YET_VALIDATED` in normal customer UI, and don’t imply the remaining balance is established.
- **Existing integration prerequisites:** the merged report says GAS source v1.1.0 is not deployed and the canonical endpoint was still v1.0.0 at the report checkpoint; new Support Start/End range parameters and age-100 `99+` behavior failed live verification. The UI audit does not change GAS, Sheet, or calculation.

## G. Direct Advance Matrix

| Page | Action | Direct Advance? | Reason |
|---|---|---:|---|
| Entry | Start journey | No choice-based advance; one **開始** action | It introduces the App, not a form step. |
| Funding Source | Choose one of four existing categories | Yes | One selected value completes the step. |
| Current Age / Retirement | Enter/select and review both | No | Multiple related inputs require review. |
| Coverage End Age | Select one official option | Yes, if the selection fully resolves it | A single choice completes the step. |
| Medical Plan | Select one official mapping | Yes, if premium range loads safely | The chosen plan is complete, with availability feedback. |
| Medical Premium | Continue after reviewing result | No | Customer should understand the need before moving on. |
| Need → Reserve | Choose to explore | No | It’s an intentional conceptual bridge. |
| Build Reserve | Configure amount and arrangement | No | Multiple configuration choices require validation/review. |
| Support Result | Review Support Start/End and projection | No | Multiple ages and a result period need confirmation. |
| Summary | Adjust or finish | N/A | It is the presentation endpoint. |

## H. Explicit Next Matrix

| Page | Required interaction | Why confirmation is needed |
|---|---|---|
| Current Age / Retirement | Set both ages and review the timeline | Two linked values form the planning context. |
| Medical Premium | Continue after reviewing the hero and progression | It is the customer’s basis for exploring a reserve. |
| Need → Reserve | Continue to reserve exploration | The transition explains why configuration follows. |
| Build Reserve | Set annual amount and arrangement | Amount and duration are jointly meaningful; validate supported range. |
| Support | Set Start/End Age and review the projection | The period controls the annual result range. |

**下一步** should appear on these pages only. The proposed one-choice Funding Source, Coverage Age, and Medical Plan steps can direct-advance. No global bottom 上一步 control.

## I. Responsive Plan

All device entries below describe intended behavior. **Physical device testing: NOT VERIFIED.**

| Viewport | Intended behavior |
|---|---|
| Mobile | One-column cards and controls; text wraps; header may wrap while retaining App/version and 返回 AVA. 44px targets. Age rail may scroll within its own named region. |
| Narrow foldable | Treat as compact usable viewport; stack controls and phase bands; no page-level horizontal overflow. Do not detect a particular phone model. |
| HONOR Magic V5 folded | Compact behavior by usable width. **NOT VERIFIED on device.** |
| Foldable unfolded | Medium or wide by usable width; related age controls may share a two-column grid; keep focus and safe areas. **NOT VERIFIED on device.** |
| iPad Portrait | Usually medium-width behavior; two columns only when they remain readable; safe-area padding and tappable controls. **NOT VERIFIED on device.** |
| iPad Landscape | Usually wide behavior; allow two-column composition for related controls and wider results; keep the Support rail locally scrollable only if needed. **NOT VERIFIED on device.** |
| Desktop / Wide | Centered content with shared max-width; result visualization and details align without stretching text lines excessively. |
| PWA Standalone | Same route, controls, Return to AVA and local User Layer behavior as browser. Respect safe areas. Automatic shell update lifecycle remains to be assessed separately; no physical standalone verification was done. |

Typography follows the shared AVA fluid scale; amounts retain labels, currency, and period. Tables, if present, scroll within an accessible local region. Do not claim a successful no-overflow browser/device verification: this was source review only.

## J. Product Protection

| Protected area | Status | Audit note |
|---|---|---|
| Product Flow Meaning | **PRESERVED / DECISION REQUIRED** | Need-first flow retained. Decide how the premium need period relates to a potentially different Support period. |
| Business Logic | **PRESERVED / DECISION REQUIRED** | Existing rules retained. Decide whether annual contribution repeats across each phase or can differ by phase in customer UI. |
| Calculation Logic | **PRESERVED** | No formula or solver changes proposed. Forward Calculation remains inactive in production Customer Flow in this audit. |
| Official Data | **PRESERVED** | Official plan, premium, and strategy sources remain authoritative. Missing data remains unavailable; no fabricated values. |
| 5-Year Rotating Routing | **PRESERVED** | Keep the locked rule: Support windows count from Support Start Age; cycle through enabled phases in order; inactive phases continue ageing and are not reset/reissued. |
| Medical Premium Contract | **PRESERVED** | Annual official premium by age/plan/deductible; missing ages are not interpolated. GAS/Sheet contract unchanged. |

## K. Decisions Required From User

These are the product-facing ambiguities that cannot be safely resolved from current Mother standards, current repository rules, and the task alone:

1. **Premium need period vs. Support period:** Should the headline “future medical premium need” stay Retirement Age → Coverage End Age, while the Support calculation independently uses Support Start → Support End? Or should the premium need hero use the Support period? The merged spec explicitly says Support Start is manually selected and is not hard-coded to Retirement Age; the current V1 flow describes retirement-to-coverage premium need.
2. **Annual Saving amount across phases:** Should one customer-entered annual amount apply to every enabled five-year phase, or should the customer be able to set separate contributions for Phase 1/2/3? The requested customer concept uses a singular amount, while the merged Forward spec permits a different annual contribution for each phase.
3. **Meaning of “remaining value” in customer language:** The user request calls this “Projected Remaining Saving Plan Value”; the Forward spec’s output calls it “Projected Remaining Medical Reserve Value.” Confirm the preferred customer-facing term before writing the Summary and selected-year result labels.

No decision is needed about introducing new funding categories, changing routing, changing medical premium data, or adding Reverse Solver.

## L. Recommended Implementation Scope

After review and approval, the smallest coherent UI scope is:

1. Establish the shared AVA header, version identity, distinct 返回 AVA, internal ← 返回, content-sized Main Card, and per-page navigation behavior.
2. Rework the customer flow around the approved need-first story; streamline age/planning controls, premium hero/timeline, and the need-to-reserve transition.
3. Add the approved Saving amount/arrangement controls only after resolving the phase contribution decision; keep one/two/three five-year bands conversational.
4. Build the Support result presentation and concise Summary against the approved Forward output contract, including safe loading/unavailable/unsupported states.
5. Align responsive presentation to the shared AVA system, including locally owned age-rail overflow and standalone shell behavior.

This UI work should remain separate from GAS deployment, Sheet edits, Forward Calculation changes, production calculation activation, and Reverse Solver. If a UI decision depends on any of those, keep it at the documented integration boundary until that prerequisite is resolved.

## Final Status

**CURRENT JOURNEY:** Funding → Timeline → Coverage → Plan → Premium Journey → Premium Total → Transition → unavailable Strategy → unavailable Support → incomplete Summary.

**PROPOSED JOURNEY:** Entry → Funding → Current/Retirement Age → Coverage End Age → Medical Plan → Future Premium Need → Need-to-Reserve transition → Saving Amount/Arrangement → Support Start/End + Forward Result → Summary.

**ENTRY PAGE:** Purpose-setting Medical Reserve introduction, before Funding Source.

**INTERNAL PAGE STRUCTURE:** Age planning, coverage end, and plan selection; then premium need and a clear reserve transition; then build, Support, and Summary.

**HEADER:** AVA Medical Reserve identity and Journey/Page title on the left; persistent 返回 AVA on the right.  
**TOP-LEFT VERSION:** v1.0.1.  
**返回 AVA:** Keep distinct from page-level ← 返回.

**DIRECT ADVANCE PAGES:** Funding Source; Coverage End Age; Medical Plan after successful official selection/load.  
**EXPLICIT NEXT PAGES:** Current/Retirement Age; Medical Premium review; Need-to-Reserve transition; Build Reserve; Support period/result review.

**FORWARD CALCULATION PRESENTATION:** Selected-year age-rail result card, annual Medical Premium, Medical Reserve Support, projected remaining value, cumulative Support, compact remaining-value visualization, annual details on demand.

**SUMMARY PAGE:** Planning period, plan/assumption, cumulative premium need, saving amount/arrangement, Support start/end, cumulative Support where meaningful, remaining value milestones/end, and one clear takeaway.

**RESPONSIVE PLAN:** Shared AVA compact/medium/wide ranges; stacked cards on compact viewports; fluid type and 44px targets; local overflow only for an intentionally scrolling age-rail/detail region. Physical device and standalone verification: **NOT VERIFIED**.

**PRODUCT FLOW:** PRESERVED / DECISION REQUIRED  
**BUSINESS LOGIC:** PRESERVED / DECISION REQUIRED  
**CALCULATION LOGIC:** PRESERVED  
**OFFICIAL DATA:** PRESERVED  
**5-YEAR ROTATING ROUTING:** PRESERVED  
**REVERSE SOLVER:** OUT OF SCOPE

**CODE CHANGED:** NO  
**BRANCH CREATED:** NO  
**PR CREATED:** NO

**DECISIONS REQUIRED FROM USER:** Premium need period vs. Support period; shared vs. per-phase annual contribution; customer-facing name for remaining value.

**RECOMMENDED NEXT IMPLEMENTATION SCOPE:** After review of this blueprint and decisions, implement only the coherent customer UI structure above; keep Forward Calculation integration gated by the existing Official endpoint/evidence boundary.

**STOP FOR CHATGPT / USER REVIEW.**
