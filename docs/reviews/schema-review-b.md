# Independent Schema Review: `rules-schema.md`

**Reviewer:** independent review B  
**Date:** 2026-11-06  
**Target Document:** `docs/schema/rules-schema.md` (Chosen Design)  
**Context & Principles:** `CONTRIBUTING.md`, `docs/product.md`  

---

## Executive Summary

`docs/schema/rules-schema.md` establishes a strong, elegant conceptual foundation for the *Every Floor* rules engine. Its key achievements include:
- A clean separation of three-valued Kleene logic (`yes` / `no` / `unknown`) to honor the core project rule "Ask, don't pretend" without conflating lack of information with ineligibility.
- An innovative tri-partite condition architecture (**Eligibility**, **Prerequisites**, **Confirmations**) that properly isolates user-provable facts from procedural next steps and program-discretionary boundaries.
- Explicit temporal decoupling of the **installation window** (`installWindow`) from the **application deadline** (`applicationDeadline`).
- Built-in counterfactual analysis to power the signature feature: *"1 more unit agreeing moves insulation from 75% to 100% off"*.

However, when audited against the real-world Massachusetts policy requirements and user stories outlined in `docs/product.md`, several **Critical** and **High** severity gaps emerge. If not addressed before Phase 1 implementation begins, these flaws will lead to runtime evaluation errors, incorrect status classifications, brittle CI pipelines, or inability to support complex roles (such as the Owner-Occupant Landlord).

---

## Summary of Findings

| ID | Focus Area | Title | Severity | Location |
|---|---|---|---|---|
| **ISSUE-01** | Four Roles | Lack of scoped entity namespaces (`user`, `unit`, `building`) breaks Owner-Occupant Landlord evaluation | **Critical** | §1 (lines 13–20, 38–41) |
| **ISSUE-02** | Four Roles | Missing benefit assignment mechanism for split-incentives (heat vs electric bill payer) | **High** | §1 (line 23), §7 |
| **ISSUE-03** | Condo Participation | Underspecified `{ allUnits }` AST semantics and missing unit-level agreement schema | **Critical** | §1 (line 39), §8 |
| **ISSUE-04** | Condo Participation | Logical contradiction between Status `potential`, Status `not_eligible`, and Counterfactuals in Condo 100% offer | **High** | §3, §4 (lines 68–70), §8 |
| **ISSUE-05** | Rules Mid-Plan Change | Banning overlapping version windows breaks policy transition & grandfathering periods | **Critical** | §5 (lines 79–85) |
| **ISSUE-06** | Rules Mid-Plan Change | File-moving version retirement (`rules/<state>/archive/`) introduces calendar-dependent test failures | **High** | §5 (lines 81–85) |
| **ISSUE-07** | Rules Mid-Plan Change | Omission of rule-level `effective_from` / `effective_until` contradicts project governance principles | **Medium** | §1 (lines 13–28), `CONTRIBUTING.md` §2 |
| **ISSUE-08** | Install vs Apply Dates | Lack of relative post-installation deadlines (e.g. "within 60 days of installation") and pre-approval milestones | **High** | §1 (line 19), §5 |
| **ISSUE-09** | Three Condition Kinds | Undefined evaluation precedence and risk of unknown confirmation conditions prematurely downgrading to `potential` | **High** | §3 (lines 48–60) |
| **ISSUE-10** | Three Condition Kinds | Ambiguity between `Prerequisite` (offer-specific) and `SequenceEdge` (measure-level roadmap) | **Medium** | §1 (lines 21, 30, 35), §3 |
| **ISSUE-11** | Three Condition Kinds | Area Median Income (AMI) / State Median Income (SMI) classified as confirmation instead of deterministic table lookup | **Low** | §1 (line 36), §3 (line 54) |
| **ISSUE-12** | Missing Info Handling | Missing fact dictionary and typed path validation permits silent failure from typos | **High** | §1 (lines 38–41), §2 |
| **ISSUE-13** | Missing Info Handling | Engine cannot report *which* missing inputs to query, or distinguish current user gaps from other units | **High** | §2, §3, §6 |
| **ISSUE-14** | Architecture / Schema | Complete omission of `Benefit` schema and `Measure` enum definitions | **Critical** | §1 (line 23, line 35) |
| **ISSUE-15** | Choosing What to Show | Blanket retention of all `not_eligible` results pollutes UI with irrelevant offers | **Medium** | §4 (line 71) |

---

## Detailed Review by Focus Area

### 1. Expressing the Four Roles
(`docs/product.md` §3, §4, §6)

#### ISSUE-01: Lack of scoped entity namespaces breaks Owner-Occupant Landlord evaluation
- **Severity:** Critical (Blocker)
- **Location:** `docs/schema/rules-schema.md` §1 (lines 13–20, 38–41)
- **Problem:**
  `docs/product.md` §3 defines four distinct user personas: *Tenant*, *Renting Landlord*, *Condo Owner*, and *Owner-Occupant Landlord*. The owner-occupant landlord is explicitly highlighted:
  > *"Owner-occupant landlord (lives on one floor): Own unit and rental units are on different offers. Which offer applies to which unit, combined picture."* (`product.md` §3)  
  > *"Owner-occupied units follow homeowner offers; the Residential Turnkey Solutions (health and safety barriers) offer covers renter-occupied units only."* (`product.md` §4)
  
  In `rules-schema.md` §1, `Offer` defines `appliesTo: 'each_unit' | 'user'`, while `Condition` defines `{ fact, op, value }` without any scoping or entity model.
  If an owner-occupant landlord evaluates their building:
  - The *user* role is `owner_occupant_landlord`.
  - Unit 1 is *owner-occupied* (`tenure: 'owner_occupied'`).
  - Unit 2 & 3 are *renter-occupied* (`tenure: 'renter_occupied'`).
  
  If an offer for rental weatherization checks `{ fact: 'occupancy', op: 'eq', value: 'tenant' }` or `{ fact: 'role', op: 'eq', value: 'landlord' }`, a flat string namespace cannot distinguish between:
  1. The persona of the person running the calculation (`user.role`).
  2. The occupancy of the specific unit being evaluated (`unit.occupancy`).
  3. Building-wide attributes (`building.unit_count`, `building.property_type`).
  
  Without scoped entity paths, rules targeting renter units vs owner units within the same multi-unit building will either misfire or collide.
- **Modification Suggestion:**
  Explicitly formalize scoped fact paths in the schema and Zod definitions:
  - `user.*` (e.g. `user.role`, `user.household_income`, `user.household_size`, `user.unit_id`)
  - `unit.*` (e.g. `unit.id`, `unit.occupancy: 'owner' | 'tenant' | 'vacant'`, `unit.heat_payer: 'owner' | 'tenant'`, `unit.heating_fuel`, `unit.has_residential_meter`)
  - `building.*` (e.g. `building.units_count`, `building.municipality`, `building.electric_utility`, `building.gas_utility`, `building.is_condo`)
  When `appliesTo: 'each_unit'`, the evaluation context binds `unit.*` to the specific unit under test while maintaining access to `user.*` and `building.*`.

---

#### ISSUE-02: Missing benefit assignment mechanism for split-incentives
- **Severity:** High
- **Location:** `docs/schema/rules-schema.md` §1 (line 23), §7
- **Problem:**
  `docs/product.md` §3 mandates:
  > *"Every unit records who pays for heat and who pays for electricity (tenant or owner). These are asked, never guessed, and savings are assigned to whoever pays."*
  
  In `rules-schema.md`, `Offer` contains `benefit: Benefit`, but there is zero specification of:
  - Who receives the upfront capital incentive / rebate (the property owner vs the utility account holder).
  - Who receives the ongoing utility bill savings (the heat bill payer vs the electric bill payer).
  
  For example, if an air-source heat pump replaces an oil furnace in a tenant-occupied unit where the landlord pays for oil but the tenant pays for electricity:
  - The capital rebate goes to the landlord (or installer).
  - Oil fuel expenses drop to $0 (landlord saves).
  - Electric bills surge due to heat pump load (tenant pays more).
  
  Without tracking which utility bill is impacted and who is the beneficiary in the Offer/Benefit schema, the rules engine cannot fulfill the requirement of modeling split incentives and assigning savings to whoever pays.
- **Modification Suggestion:**
  Add bill-impact attribution to the `Benefit` specification:
  ```ts
  interface Benefit {
    recipient: 'applicant' | 'building_owner' | 'unit_ratepayer' | 'contractor';
    upfrontIncentive: IncentiveAmount;
    ongoingBillImpact?: {
      electricFuelDelta?: 'increase' | 'decrease';
      heatingFuelDelta?: 'decrease';
      beneficiary: 'heat_payer' | 'electric_payer' | 'building_owner';
    };
  }
  ```

---

### 2. Condo Whole-Building Participation
(`docs/product.md` §3, §4, §8)

#### ISSUE-03: Underspecified `{ allUnits }` AST semantics and missing unit-level agreement schema
- **Severity:** Critical (Blocker)
- **Location:** `docs/schema/rules-schema.md` §1 (line 39), §8
- **Problem:**
  The schema represents whole-building condo participation with a single AST node:
  ```ts
  Condition = ... | { allUnits: { eligible, require } } | ...
  ```
  This definition is missing critical structural specifications:
  1. What types are `eligible` and `require`? Are they nested `Condition` objects, or strings, or predicates?
  2. What fact represents participation? Is it `unit.participating`, `unit.agreed`, or `unit.committed`?
  3. How does the engine handle a building where `eligible` matches zero units, or only 1 unit?
  4. Most importantly, `product.md` §3 and §8 state that the signature feature is showing:
     > *"Units still needed for the all-units insulation offer, messages to neighbors"*
     > *"1 more unit agreeing moves insulation from 75% to 100% off"*
  
  If `{ allUnits }` is evaluated solely as a Boolean/Kleene condition returning `yes` / `no` / `unknown`, the engine cannot deterministically compute how many units are still needed (e.g. `totalEligibleUnits - participatingUnits = unitsNeeded`).
- **Modification Suggestion:**
  1. Formalize `{ allUnits }` in TypeScript:
     ```ts
     interface AllUnitsCondition {
       allUnits: {
         eligibleUnitsPredicate: string; // e.g. 'condo_eligible_unit'
         unitRequirement: Condition;    // e.g. { fact: 'unit.agreed', op: 'eq', value: true }
         minParticipationRatio?: number; // default 1.0 (100% participation)
       };
     }
     ```
  2. Ensure the condition evaluation output returns structured aggregation metadata:
     ```ts
     interface AllUnitsEvaluationMeta {
       totalUnits: number;
       eligibleUnits: number;
       participatingUnits: number;
       unitsStillNeeded: number;
     }
     ```

---

#### ISSUE-04: Logical contradiction between Status `potential`, Status `not_eligible`, and Counterfactuals
- **Severity:** High
- **Location:** `docs/schema/rules-schema.md` §3, §4 (lines 68–70), §8
- **Problem:**
  There is a direct contradiction in how `rules-schema.md` describes the status of the 100% condo insulation offer:
  - In §3: An offer is `potential` **only** if its eligibility is `yes` and a Confirmation applies:
    > *"If it applies (when is yes or unknown, or absent) and eligibility is yes → potential"*
  - In §4: The document asserts:
    > *"So a condo owner sees '75% now' (eligible) and '100% if every unit takes part' (potential)."*
  - In §8: The document asserts:
    > *"The all-units offer carries a confirmation asking Mass Save, so its result is potential, not eligible."*
  
  **The Contradiction:**
  When a condo owner enters the app, their neighbors have **not** yet agreed to participate.
  Therefore:
  - The condition `{ allUnits: { require: { fact: 'unit.agreed', op: 'eq', value: true } } }` evaluates to `no` (or `unknown`).
  - By §3 rules, `no` in eligibility produces `not_eligible`!
  - If it is `not_eligible`, it **cannot** be `potential` under §3!
  
  Section 4 erroneously conflates a **counterfactual scenario** (*"what would happen if the other unit agreed"*) with the static status `potential` (*"eligible, but pending Mass Save's administrative confirmation of eligible meter"*).
  If the engine implemented §4 literally, an uncommitted condo offer would either bypass eligibility checks to become `potential`, or be labeled `not_eligible` and fail §4's display rule.
- **Modification Suggestion:**
  Clarify the pipeline cleanly:
  1. Under current inputs (where neighbor has not agreed), the 100% offer evaluates to `not_eligible` (due to unmet neighbor participation).
  2. Section 6's counterfactual engine re-evaluates the offer under the hypothetical `unit[*].agreed = true`.
  3. Under this counterfactual, eligibility becomes `yes`; and because §8 carries the Mass Save confirmation, the counterfactual status is `potential`.
  4. The UI displays the base offer (75% `eligible`) paired with an actionable counterfactual card: *"1 more unit agreeing moves your offer to 100% off (pending Mass Save verification)"*.
  Update §4 and §8 to explicitly explain this interaction instead of claiming the uncommitted offer is statically `potential`.

---

### 3. Rules Changing Mid-Plan
(`docs/product.md` §5, §6, `CONTRIBUTING.md` §2)

#### ISSUE-05: Banning overlapping version windows breaks policy transition & grandfathering periods
- **Severity:** Critical (Blocker)
- **Location:** `docs/schema/rules-schema.md` §5 (lines 79–85)
- **Problem:**
  Section 5 states:
  > *"The data check fails if a retired version is still in the active set, and if two versions of the same id overlap."*
  
  In Massachusetts clean energy programs, mid-plan rule updates frequently involve **overlapping installation windows with grandfathering provisions**.
  For example:
  - *Mass Save 2024 to 2025 Transition:* An installation window of `2025-01-01` to `2025-06-30` could be governed by either 2024 rebate rates or 2025 rebate rates, depending on whether the customer's Home Energy Assessment or quote approval occurred before December 31, 2024.
  - *Heat Pump Rebate Rate Revision (2026 vs 2027):* When a program transitions, customers with pre-approvals locked in by December 2026 are often permitted to complete installation in early 2027 under the 2026 incentive rate, while new applicants follow the 2027 rate.
  
  If the rules schema strictly forbids any overlap between versions of the same offer ID, it is mathematically impossible to model grandfathered transition periods without artificially corrupting the real installation dates or generating artificial IDs that break offer continuity and history.
- **Modification Suggestion:**
  Allow overlapping installation windows by introducing a secondary transition discriminator, such as `applicationWindow` or `quoteDeadline`:
  ```ts
  interface OfferVersionSelector {
    id: string;
    version: string;
    installWindow: { from: ISODate; until: ISODate | null };
    applicationWindow?: { from: ISODate; until: ISODate | null };
    preApprovalRequiredBy?: ISODate;
  }
  ```
  Change the validation check from *"no two versions may overlap in installWindow"* to *"no two versions may have identical selection criteria"*.

---

#### ISSUE-06: File-moving version retirement introduces calendar-dependent test failures
- **Severity:** High
- **Location:** `docs/schema/rules-schema.md` §5 (lines 81–85)
- **Problem:**
  Section 5 states:
  > *"A version retires once both its install window and its application deadline have passed. It then moves to rules/<state>/archive/, which the loader doesn't read. The data check fails if a retired version is still in the active set..."*
  
  This creates a severe operational and engineering anti-pattern:
  - If a rule's `applicationDeadline` is `2026-12-31`, tests that passed on December 31 will suddenly **FAIL in CI on January 1** simply because the wall-clock calendar advanced, even though no code or configuration changed.
  - An engineer checking out a historical commit or branch 6 months later will find tests failing unless they manually move files into `archive/`.
  - Repository files should not require physical filesystem relocation to reflect date transitions.
- **Modification Suggestion:**
  Replace physical file moving with deterministic metadata filtering:
  1. Rules retain an explicit `status: 'active' | 'archived'` or are evaluated dynamically:
     `isActive = isBefore(currentDate, offer.applicationDeadline ?? offer.installWindow.until)`
  2. The test suite checks that the *active loader* correctly ignores retired offers when evaluated against a given `asOfDate`.
  3. CI tests run with pinned or injected mock dates rather than relying on unmocked system clocks.

---

#### ISSUE-07: Omission of rule-level `effective_from` / `effective_until` contradicts project governance principles
- **Severity:** Medium
- **Location:** `docs/schema/rules-schema.md` §1 (lines 13–28), `CONTRIBUTING.md` §2 Principle 3
- **Problem:**
  `CONTRIBUTING.md` Non-negotiable Principle 3 states:
  > *"Every incentive rule has a source. Each rule in the rules data has source_url, last_verified (date) and effective_from / effective_until where known. A rule without a source does not ship."*
  
  And `docs/product.md` §6 reiterates:
  > *"Rules data handles change over time: effective_from / effective_until, last_verified, a staleness flag in the UI when last_verified is older than 90 days, and a test that fails if a shipped rule lacks source_url or is past effective_until."*
  
  However, in `rules-schema.md` §1, `Offer` replaces these fields with `installWindow` and `applicationDeadline`, and `Source` only has `{ url, section, quote, lastVerified }`.
  `installWindow` is the window during which physical equipment must be installed. It is **not** the administrative effective period of the policy document (e.g., a DPU Order or Mass Save Program Manual effective June 1, 2025 to Dec 31, 2027). Omitting policy validity dates violates project rules and prevents automated detection of outdated program filings.
- **Modification Suggestion:**
  Add policy filing dates to `Offer` or `Source`:
  ```ts
  interface Offer {
    // ...
    effectiveFrom: ISODate;
    effectiveUntil?: ISODate | null;
    lastVerified: ISODate; // or on Source
    // ...
  }
  ```

---

### 4. Separating Installation Window and Application Deadline
(`docs/product.md` §5, §6)

#### ISSUE-08: Lack of relative post-installation deadlines and pre-approval milestones
- **Severity:** High
- **Location:** `docs/schema/rules-schema.md` §1 (line 19), §5
- **Problem:**
  In `rules-schema.md`, the separation of dates is represented as:
  ```ts
  installWindow: { from, until | null },
  applicationDeadline: ISODate | null
  ```
  While storing an absolute ISO date for `applicationDeadline` works for fixed program year-end cutoffs (e.g. `2027-02-28`), Massachusetts programs frequently employ **relative deadlines**:
  1. *Post-Installation Filing Limit:* Mass Save heat pump and weatherization rebate forms routinely state: *"Rebate applications must be submitted within 60 days of equipment installation, or by February 28, whichever is earlier."* If a customer installs equipment on March 1, 2026, their deadline is April 30, 2026—not February 28, 2027!
  2. *Pre-Approval Requirement:* Programs like the Mass Save HEAT Loan and Residential Turnkey Solutions require pre-approval *before* contract execution or installation begins. An `applicationDeadline` that only records the final paperwork submission date fails to alert the user that they must apply *prior* to installation.
- **Modification Suggestion:**
  Expand the deadline definition to accommodate relative windows and pre-approval milestones:
  ```ts
  interface Deadlines {
    installWindow: { from: ISODate; until: ISODate | null };
    applicationDeadline: {
      absoluteDate: ISODate | null;
      daysPostInstall?: number; // e.g. 60 days
    };
    preApprovalRequired: boolean;
    preApprovalDeadline?: ISODate | null;
  }
  ```

---

### 5. The Three Condition Kinds: Eligibility, Prerequisites, Confirmations
(`docs/product.md` §3, §4, §5)

#### ISSUE-09: Undefined evaluation precedence and risk of unknown confirmation conditions prematurely downgrading to `potential`
- **Severity:** High
- **Location:** `docs/schema/rules-schema.md` §3 (lines 48–60)
- **Problem:**
  Section 3 defines the effect of the three condition kinds:
  - Eligibility: `no` → `not_eligible`; `unknown` → `needs_info`
  - Prerequisites: Never changes status; checklist item
  - Confirmations: *"If it applies (when is yes or unknown, or absent) and eligibility is yes → potential"*
  
  **Flaw 1: Unhandled combination of `needs_info` and Confirmations.**
  What happens if an offer's eligibility is `unknown` (`needs_info`), but it also has an active Confirmation?
  The schema does not specify the resolution precedence:
  Does `needs_info` take precedence over `potential`? (It must, because if the user provides the missing fact and turns out to be `not_eligible`, program confirmation is moot).
  
  **Flaw 2: `when: unknown` in Confirmations downgrading too early.**
  Section 3 line 54 states: *"If it applies (when is yes or **unknown**, or absent)... → potential"*.
  Suppose a confirmation has a condition `when: { fact: 'unit.has_commercial_space', op: 'eq', value: true }`.
  If the user hasn't answered whether the building has commercial space yet, `fact` is `unknown`.
  Under line 54, because `when` is `unknown`, the offer is immediately downgraded to `potential`, hand-waving the question off to Mass Save!
  This directly contradicts Section 3's own interpretation note:
  > *"Facts the user can answer but hasn't yet are eligibility unknowns (needs_info), and they become questions on the form."*
- **Modification Suggestion:**
  1. Formally define the strict status precedence hierarchy:
     $$\text{not\_eligible} > \text{needs\_info} > \text{potential} > \text{eligible}$$
  2. If a Confirmation's `when` condition depends on a user-provable fact that is currently `unknown`, the engine must yield `needs_info` to prompt the user first. Only when `when` evaluates to `yes` (or is unconditional) does it downgrade an eligible offer to `potential`.

---

#### ISSUE-10: Ambiguity between `Prerequisite` (offer-specific) and `SequenceEdge` (measure-level roadmap)
- **Severity:** Medium
- **Location:** `docs/schema/rules-schema.md` §1 (lines 21, 30, 35), §3
- **Problem:**
  The schema introduces both:
  - `Prerequisite { id, kind, description, satisfiedWhen, sources }` on each `Offer`.
  - `SequenceEdge { before: Measure, after: Measure, reason, sources }` at the package level.
  
  Both constructs represent sequential dependencies (e.g. *"Home Energy Assessment before Weatherization"*, *"Weatherization before Heat Pump"*).
  Having two independent mechanisms for sequencing introduces confusion:
  - Does the action roadmap generator use `SequenceEdge` or `Offer.prerequisites`?
  - If an offer defines a prerequisite that contradicts a `SequenceEdge`, which takes precedence?
- **Modification Suggestion:**
  Clearly demarcate the responsibilities:
  1. `SequenceEdge` governs **physical and logical measure ordering** for building decarbonization (e.g., weatherize before heat pump sizing; roof condition before solar). It drives the topological sort of the Action Roadmap.
  2. `Prerequisite` governs **administrative and program prerequisites** for a specific incentive offer (e.g., must use an authorized contractor from the Mass Save Heat Pump Installer Network; landlord authorization form required).

---

#### ISSUE-11: Area Median Income (AMI) / State Median Income (SMI) classified as confirmation instead of deterministic table lookup
- **Severity:** Low
- **Location:** `docs/schema/rules-schema.md` §1 (line 36), §3 (line 54)
- **Problem:**
  In Section 3 (line 54), Confirmations are described as:
  > *"Facts nobody in the app can settle, only the program: e.g. the condo 'eligible unit' definition, the renter energy-burden test, who applies on a tenant-held account, area-specific income limits"*
  
  Yet in Section 1 (line 36), the schema explicitly defines:
  ```ts
  IncomeTable { id, label, bySize: number[], sources }
  ```
  Income eligibility in Massachusetts (e.g. 60% SMI for Low-Income CAP programs; 80% AMI for Enhanced Moderate-Income) is determined deterministically from household size and municipality/county tables published annually by DOER and HUD.
  Describing "area-specific income limits" as an unsolvable fact that only the program can settle contradicts the engine's ability to compute income eligibility deterministically from `IncomeTable` data (Principle 1).
- **Modification Suggestion:**
  Clarify in §3 that income eligibility calculation is a deterministic `Eligibility` check using `IncomeTable`. The confirmation aspect is solely the administrative document verification (e.g., CAP agency income verification audit), not the income limit determination itself.

---

### 6. Handling Missing Information
(`docs/product.md` §5, §6, §7, `CONTRIBUTING.md` §2)

#### ISSUE-12: Missing fact dictionary and typed path validation permits silent failure from typos
- **Severity:** High
- **Location:** `docs/schema/rules-schema.md` §1 (lines 38–41), §2
- **Problem:**
  Section 1 defines:
  ```ts
  Condition = ... | { fact, op, value } | ...
  ```
  There is no schema or enum defining the universe of valid facts.
  Under three-valued logic:
  - If an input object does not have a property, it resolves to `null` (`unknown`).
  - If a rule author types `{ fact: 'heat_fuel', op: 'eq', value: 'gas' }` instead of `{ fact: 'heating_fuel', op: 'eq', value: 'gas' }`, the property `'heat_fuel'` is missing from the input.
  - The evaluator treats `'heat_fuel'` as `null` (unknown).
  - The offer returns `needs_info` instead of failing schema validation!
  
  Because Zod validates only the generic shape `{ fact: z.string(), op: z.string(), value: z.any() }`, typos in rule facts will pass Zod schema validation silently and manifest as phantom `needs_info` questions in the user interface.
- **Modification Suggestion:**
  Define a strict, typed `FactCatalog` enum / Zod schema of recognized system facts:
  ```ts
  export const FactName = z.enum([
    'building.units_count',
    'building.municipality',
    'building.electric_utility',
    'building.gas_utility',
    'building.is_condo',
    'unit.occupancy',
    'unit.heat_payer',
    'unit.electric_payer',
    'unit.heating_fuel',
    'unit.agreed',
    'user.role',
    'user.household_size',
    'user.household_income',
    'user.on_discount_rate'
  ]);
  ```
  Zod schema validation in Phase 1 should reject any rule referencing an unregistered fact.

---

#### ISSUE-13: Engine cannot report *which* missing inputs to query, or distinguish current user gaps from other units
- **Severity:** High
- **Location:** `docs/schema/rules-schema.md` §2, §3, §6
- **Problem:**
  `rules-schema.md` describes how conditions evaluate under Kleene logic, but does not define how `needs_info` results are consumed by the UI/agent layer:
  1. *Tracking Unresolved Facts:* When an expression `{ all: [A, B] }` evaluates to `unknown`, the rules engine needs to return the exact list of missing facts (`missingFacts: ['unit.heating_fuel']`) that would resolve the condition. The current schema contains no definition of the evaluation return type.
  2. *User Scope vs Building Scope:* In a 3-unit rental building, Maria (a tenant in Unit 2) knows her own apartment's heating fuel and payment arrangement, but she does not know whether Unit 1's tenant pays for electric heat. If an offer evaluating Unit 1 returns `needs_info` for Unit 1's facts, the UI must not block Maria by asking her questions she cannot possibly answer.
- **Modification Suggestion:**
  1. Specify the evaluation result schema:
     ```ts
     interface EvaluationResult {
       offerId: string;
       unitId?: string;
       status: 'eligible' | 'potential' | 'needs_info' | 'not_eligible';
       missingFacts?: string[]; // facts that caused needs_info
       prerequisites: PrerequisiteEvaluation[];
       confirmations: ConfirmationEvaluation[];
       benefit?: ComputedBenefit;
     }
     ```
  2. Tag facts in the Fact Catalog with an `askableRole: Role[]` attribute so the UI only prompts the user for facts their role can realistically provide.

---

### 7. Additional Schema Architecture Incompletenesses

#### ISSUE-14: Complete omission of `Benefit` schema and `Measure` enum definitions
- **Severity:** Critical (Blocker)
- **Location:** `docs/schema/rules-schema.md` §1 (line 23, line 35)
- **Problem:**
  Line 23 of `rules-schema.md` references `benefit: Benefit`, and line 35 references `Measure`.
  However, neither `Benefit` nor `Measure` is defined anywhere in `rules-schema.md`!
  `Benefit` is the central payload of every incentive offer. Without a formal schema for `Benefit`:
  - It is impossible to write Zod schemas to validate `rules/ma/*.json`.
  - The finance module cannot compute low/mid/high dollar estimates.
  - Section 7 notes (*"Insulation has no Massachusetts cost source... carries percentage and nearZeroOutOfPocket: true"*) cannot be validated.
- **Modification Suggestion:**
  Formally define `Measure` and `Benefit` in the schema specification:
  ```ts
  type Measure = 
    | 'home_energy_assessment'
    | 'weatherization'
    | 'air_source_heat_pump'
    | 'ground_source_heat_pump'
    | 'heat_pump_water_heater'
    | 'rooftop_solar'
    | 'community_solar'
    | 'electric_panel_upgrade';

  type Benefit =
    | { type: 'percent_cost'; percent: number; maxLimit?: number; nearZeroOutOfPocket?: boolean }
    | { type: 'dollar_fixed'; amount: number }
    | { type: 'dollar_per_unit'; unit: 'ton' | 'kW'; rate: number; maxLimit?: number }
    | { type: 'discount_rate'; percentDiscount: number }
    | { type: 'no_cost_service'; description: string }
    | { type: 'financing'; maxAmount: number; interestRate: number; termYears: number };
  ```

---

#### ISSUE-15: Blanket retention of all `not_eligible` results pollutes UI with irrelevant offers
- **Severity:** Medium
- **Location:** `docs/schema/rules-schema.md` §4 (line 71)
- **Problem:**
  Section 4 states:
  > *"`not_eligible` results are always kept, so the UI can say what would change the answer."*
  
  If the rules catalog contains 30 Massachusetts offers, keeping *every* `not_eligible` result means:
  - A condo owner sees offers for single-family oil-to-gas conversions, commercial turnkey systems, and rental-specific subsidies.
  - The UI and LLM explanations become overwhelmed with dozens of completely irrelevant programs.
  Counterfactual reasoning is only helpful for **actionable near-misses** (e.g. another unit agreeing to participate, or applying for the utility discount rate), not for structurally incompatible programs (e.g. a triple-decker being ineligible for a commercial warehouse program).
- **Modification Suggestion:**
  Refine Section 4:
  - Separate `structurally_ineligible` (e.g., mismatch on fixed structural facts like `building.property_type` or municipal electric territory) from `counterfactual_candidate` (e.g., participation thresholds, missing discount rate, seasonal occupancy).
  - Only retain and present `not_eligible` results that carry actionable counterfactual deltas.

---

## Actionable Recommendations for Phase 1 Plan

To ensure a seamless transition into Phase 1 implementation without redesign mid-coding, the following immediate updates to `docs/schema/rules-schema.md` are recommended:

1. **Add Scoped Entity Namespaces to AST:**
   Update `{ fact, op, value }` to enforce dot-notation prefixes: `user.*`, `unit.*`, `building.*`.
2. **Define `Benefit` and `Measure` Types:**
   Incorporate the discriminated union types for `Benefit` and enum for `Measure` directly into Section 1.
3. **Reconcile Condo 100% Status Pipeline:**
   Clarify that uncommitted condo offers evaluate to `not_eligible` in the static pass and are elevated to `potential` only within the counterfactual engine pass.
4. **Fix Versioning & Calendar Dependency:**
   Remove the instruction to physically move retired rules to `archive/` in active repos. Replace it with an active/archived status flag and date-mocked loader checks. Remove the ban on overlapping install windows when secondary discriminators exist.
5. **Formalize Precedence of Statuses:**
   Document the definitive priority function:
   $$\text{not\_eligible} > \text{needs\_info} > \text{potential} > \text{eligible}$$
   and ensure unknown conditions on confirmations trigger `needs_info` if askable of the user.
6. **Specify Output Schema (`EvaluationResult`):**
   Define the typed output contract returned by the rules engine, including `missingFacts` for form generation and `unitsStillNeeded` for condo coordination.
