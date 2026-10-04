# Medical Reserve Product Rules

This document defines Medical Reserve-specific product rules. AVA Mother Rules and the AVA Design System remain authoritative for shared architecture, ownership, presentation, responsive behavior, media, storage, backup/restore, security, and PWA behavior.

## Purpose and V1 flow

Medical Reserve helps an Agent and customer understand future retirement medical premiums, the total requirement, a possible Medical Reserve, and the remaining medical cost after official Medical Reserve Support. The opening story is future medical need; a saving plan is introduced only after that need is visible.

The current customer flow is P1 Medical Protection Importance → P2 Retirement Medical Premium Budget Awareness → P3 Medical Premium Need Setup → P4 Future Medical Premium Need → P5 Funding Source → P6 Medical Reserve introduction → P7 Reserve setup and Support period → P8 dual result mode → P9 summary.

The interaction follows Easy for Agent → Natural Conversation → Instant Visualization → Easy for Customer. The primary Frontstage is one working flow, not a questionnaire or duplicated User workspace.

## Official data boundary

The official endpoint is centralized in `app.js` configuration and is never embedded in calculation/UI components. `bootstrap` is the primary source for SystemSettings, AppFlow, FlowOptions, MedicalPlans, ReserveStrategies, and Visualization. `health` is used for status/version validation and only supplies a degraded premium-plan availability boundary when bootstrap is unavailable. The app consumes the normalized response boundary from GAS actions `health`, `bootstrap`, `premium`, `premiumRange`, `reserve`, and `medicalReserve`. Official premium sheets remain the numeric source of truth. The correct product name is **尊耀計劃**.

`MedicalPlans` is the app-facing mapping layer. A plan maps `plan_id` to display name, gender where returned, deductible, and official `premium_sheet`/mapped sheet identity. The app does not interpret arbitrary Sheet layouts. Built-in flow values are safe fallback structure only; official bootstrap values take precedence.

Premium ranges use every annual row from retirement age through coverage age for the total. Customer presentation uses official checkpoints, normally every five years, with annual premium and growth from the prior checkpoint. No estimate, invented inflation, sample value, or fabricated missing data is permitted.

## Reserve strategy architecture

Strategies are data strategies, not separate engines. The common normalized row is `policy_year`, `support_percent`, and `value_multiple`; the common framework conceptually combines actual/base amount, policy year, support percentage, and value multiple to produce official Medical Reserve Support, then compares support to each annual premium to derive remaining medical cost. The current endpoint reports `ReserveStrategies` as missing, so V1 must show an unavailable state and must not infer a scaling formula or make reserve claims.

Customer terminology is **Medical Reserve** and **Medical Reserve Support**. Source wording such as withdrawal percentage is not the primary customer-facing wording. P8 offers two independent alternatives for the same arrangement: default **交醫保保費** (`medical_support`) and alternative **自動滾存** (`auto_accumulation`). No runtime state is handed from one scenario to the other.

## Editable boundaries

User-local overrides may change permitted page title, subtitle, supporting text, visibility/order, user-created pages, and permitted presentation settings. Official cloud data, premium values, GAS calculation logic, protected business rules, security rules, and system parameters remain read-only. User overrides never mutate official defaults. User-created pages retain IDs, type, content, flow position, sort order, visibility, timestamps, override data, and media relationships.

Media pages explicitly choose IMAGE PAGE or VIDEO PAGE. Image pages support up to six references and video pages up to one reference; binary media is cloud-only. This Phase 1 build exposes a safe unavailable capability boundary when no provider is connected.

Portable backup contains structured User Layer data and schema/version information, including page ordering, overrides, user pages, and media metadata/references, but never media binary or credentials. Restore validates the package and reconstructs the local flow without overwriting Official Defaults.
