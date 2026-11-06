# Independent rules-data schema proposal

Phase 0, Step 5 · 2026-11-06 · **Proposed**, not a policy determination or application code.
Inputs: [incentives research](../incentives-research.md), [data sources](../data-sources.md), [product](../product.md), and [decisions](../decisions.md). Section references below are to the research unless otherwise stated. This design is independent of the lead's draft.

## Design and review plan

Assumptions: the confirmed form supplies facts; the engine evaluates a named target unit, building, household or account and an installation date, not an imagined typical building. Unknown is a first-class value, including unconfirmed external data. Policy constants are exact statements of offers, not estimates. We do not infer that a future offer continues after a stated end date. A rule may be described for review even if evidence gaps prevent its publication as a definitive eligibility or dollar result.

Design checks: (1) encode the six required examples with their original qualifications; (2) trace an all-units counterfactual including unknown eligibility; (3) trace both heat-pump dates and both fuel/utility paths; (4) check missing evidence, unknowns, interactions, and stale/expired versions fail safely; (5) compare the model with simpler alternatives. Examples are illustrative data in YAML notation; the eventual serialization and TypeScript stack are not decisions. The evaluator and finance implementation are outside Phase 0.

## Model and contract

Data files contain `Program`, `Rule`, and `Contact` records, plus separately sourced and versioned lookup tables when needed. IDs are stable, names are display text, and versioned rule IDs identify an immutable published version. A policy change creates a new version and tests; changing the vocabulary or evaluator requires code and tests. All fields below are required unless marked `?`; `null` means explicitly unknown, not false or unlimited. Dates are ISO calendar dates, inclusive at both ends, in the program's local calendar. Percentages use percentage points (75 means 75%); currency is USD. Enums and field paths form a closed, documented vocabulary; unknown operators, units and paths are validation errors.

| Record | Fields and types | Meaning |
|---|---|---|
| Program | `id` string; `name` string; `jurisdiction` string; `contact_ids` nonempty ID list | Stable program ID and authorized display name. Contact choice may depend on rule and location. |
| Contact | `id`, `name` strings; `url?`, `phone?` strings | At least one URL or phone required; a hand-off is guidance, not an application or eligibility guarantee. |
| Rule | `id`, `version`, `program_id` strings; `status` enum (`draft`, `published`); `scope` enum (`building`, `unit`, `household`, `account`, `project`); `target` string; `date_basis` enum; `effective_from`, `effective_until` date or null; `source_url` nonempty URL; `last_verified` date; `condition` expression; `effect` object; `interactions` list; `handoff` object | One separately sourced, separately effective policy assertion. `id` survives versions; `id` + `version` is unique. `date_basis` says which event the dates govern, e.g. `installation` or `assessment`; `as_of` is used only where a source gives no event. Null dates mean unknown, not indefinite. `target` identifies the measure/benefit to which interactions apply. |
| Handoff | `contact_id`; `action` string; `enrollment` enum (`apply`, `contact`, `automatic_selection`, `not_applicable`); `qualification?` string | Honest next step, including lottery selection when applicable. Copy is curated; it cannot change the computed outcome. |
| Condition | recursive `all`, `any`, `not`, or predicate `{fact, op, value}`; `unresolved` object; or `aggregate` object | Closed AST, not executable expressions or prose evaluated by an LLM. `unresolved` has `question`, `decider`, `next_action`; it always evaluates unknown until the rule is revised on evidence. |
| Effect | `kind` and kind-specific fields below; `qualification` enum (`exact`, `up_to`, `minimum`); `decision_note?` | Policy terms, not a promise or a low/mid/high estimate. `up_to` remains visible even if all known conditions pass. |
| Interaction | typed `prerequisite`, `exclusive`, `best_of`, `cap`, or `sequence`; explicit target and scope, plus referenced rule/action IDs when applicable | Relations are directional where appropriate; no implicit stacking. A prerequisite can be satisfied by an expression, not only a completed action. |

**Effect variants.** `percent_off {percent, basis}`; `no_cost {basis}`; `rate {amount, currency, per, cap?}` (e.g. dollars/ton); `flat {amount, currency, cap?}`; `production_rate {amount, currency, per: kWh, duration_years}`; `discount_floor {percent, basis: credit_value}`; `credit {percent, basis, cap}`; `loan_limit {amount, currency, cap_scope}`; and `service {description}`. A cap has `amount`, `currency`, `scope` (`account`, `home`, `customer_lifetime`, or `installation`), and `period?`. Caps do not mean a claimant has an unused allowance: prior usage is a confirmed fact or remains unknown. Conditional bonuses are separate rules with a time-window predicate and a reference to the base benefit; missing event dates yield unknown. A cap on cost is distinct from a cap on program dollars. The model can represent a loan without treating loan proceeds as a grant. These are proposed representations; individual programs require verified terms before publication.

**Profile and evaluation.** The confirmed input snapshot includes `building` (state, municipality, block group, residential unit count, ownership form, year built, separate electric and gas utility and sponsor status); `units[]` (stable ID, occupancy, fuel, heat and electricity payer, residential heating meter, participation, household ID); `households[]` (size and optional income interval); and `project` (measure, target units, install date, cost interval, capacity, account ID and known prior claims). Unit and account relationships must be explicit: no assuming a single building-wide meter or payer. Each input can be unknown; provenance and confirmation status accompany prefilled facts. Only confirmed values feed calculations. The schema does not store names, bill images or account numbers; an opaque local account ID suffices.

Income lookup is a separate table with source, verification and effective dates, area, household size, tier and lower/upper limits. Evaluate an entered income **interval** against the verified applicable thresholds: wholly inside = true, wholly outside = false, overlap or unavailable/local limits = unknown. Do not interpret an illustrative statewide table as a local threshold (§4–5). DEC membership is likewise a sourced location/administrator lookup, with a possible `unknown` result for boundary or administrator narrowing; municipality comes from county subdivision, not postal city. State EJ and SMART federal designations are not interchangeable (data sources §5–6).

**Truth and results.** Predicates return true, false, or unknown with missing fact/ambiguity and next step. `all`: false if any false, true only if all true; `any`: true if any true, false only if all false; `not` preserves unknown. Dates use the same logic when the applicable event or bounds are unknown: known out-of-range is false; unknown bound is not evidence of coverage. For an undated ongoing source, an explicit `date_basis: as_of` and null bounds means *current as-of verified evidence*, not guaranteed historical/future coverage; future coverage remains unknown. Eligibility, prerequisite completion, offer qualification and availability are separate outputs. An unresolved condition cannot be silently converted into true, false, zero or a fixed award. A rule with an unknown condition can return a **potential** offer and decision-maker, never confirmed eligibility. Renter approval is a separate prerequisite for affected work (§1); an unknown approval does not prevent showing the assessment or possible offer.

Finance receives only eligible or explicitly labeled potential policy terms and a documented scenario input for costs, usage and capacities. It produces low/mid/high values, units, time horizon, assumptions, and a confidence label **with reason**. Policy percentages, caps, minimums and `up_to` language remain exact terms; they are not manufactured as three identical estimates. If inputs or an unknown condition cannot support a defensible range, return “estimate unavailable” and the next step rather than inventing bounds. Model heating and electricity together and attribute changes to each confirmed payer; unknown allocation remains unallocated. A minimum discount is not a guaranteed dollar saving without a credit-value scenario.

**Interaction semantics.** Prerequisites and sequencing are distinct: `prerequisite` gates a benefit; `sequence` orders an action when needed. `exclusive` applies to the same equipment, not unrelated measures; `best_of` selects the best *confirmed* applicable offer for the same target, never adds percentages. Potential alternatives remain visible without being declared winners. Caps specify their aggregation key and lifetime/period; if previous use is unknown, remaining cap is unknown. Unspecified stacking is unknown, not permission to stack. Detect dangling references, cycles in mandatory action ordering and conflicting overlapping versions before publishing.

**LLM boundary.** The engine returns program IDs/names, rule versions, evidence links, computed scenario IDs/values, eligibility state, limitations and handoffs. Explanatory templates may reference `{program:condo_insulation}` or `{scenario:net_cost.mid}`; a deterministic renderer resolves only IDs returned for this request. Validate generated output for unapproved program names and numerical claims; if validation fails, use a deterministic fallback. Validation is a defense in depth, not proof that free text is correct.

## Worked data

YAML fragments below share the conventions above. `published` here describes intended data shape only: the examples are **not shipped data**; open conditions and missing operational details must be resolved or presented as potential offers. The source and verification dates are transcribed from the research, not independently reverified. `null` effective dates mean the evidence does not state them. All references to dates use the interval semantics above.

Shared contacts:

```yaml
contacts:
  - {id: mass_save, name: Mass Save, url: 'https://www.masssave.com/', phone: '866-527-7283'}
  - {id: doer_solar, name: Massachusetts DOER community solar guidance, url: 'https://www.mass.gov/doc/guideline-regarding-community-shared-solar-tariff-generation-units-0/download'}
```

The phone is the 866-527-SAVE number in §2.1. A production contact directory must verify the right local contact and handoff for each offer.

### Condo insulation (§2.3, §2.5)

```yaml
program: {id: condo_insulation, name: Mass Save condo insulation, jurisdiction: MA, contact_ids: [mass_save]}
common: &condo
  program_id: condo_insulation
  status: draft
  scope: unit
  target: recommended_insulation
  date_basis: as_of
  effective_from: null
  effective_until: null
  source_url: 'https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties'
  last_verified: '2026-11-06'
  handoff: {contact_id: mass_save, action: 'Confirm eligible units and recommended work with an Energy Specialist.', enrollment: contact}
  interactions:
    - {type: best_of, group: insulation_offer, target: same_unit_and_measure}
    - {type: exclusive, group: insulation_offer, target: same_unit_and_measure}
rules:
  - <<: *condo
    id: condo_all_units
    version: '1'
    condition:
      all:
        - {fact: building.ownership, op: eq, value: condo}
        - {fact: building.residential_unit_count, op: between_inclusive, value: [2, 4]}
        - {fact: unit.residential_heating_meter, op: eq, value: true}
        - aggregate: {over: building.units, filter: condo_eligible, test: participating, quantifier: all, require_nonempty: true}
    effect: {kind: percent_off, percent: 100, basis: recommended_insulation, qualification: up_to, decision_note: 'Energy Specialist confirms eligible units and recommended work.'}
  - <<: *condo
    id: condo_some_units
    version: '1'
    condition:
      all:
        - {fact: building.ownership, op: eq, value: condo}
        - {fact: building.residential_unit_count, op: between_inclusive, value: [2, 4]}
        - {fact: unit.residential_heating_meter, op: eq, value: true}
        - aggregate: {over: building.units, filter: condo_eligible, test: participating, quantifier: some_but_not_all, require_nonempty: true}
    effect: {kind: percent_off, percent: 75, basis: recommended_insulation, qualification: up_to, decision_note: 'Energy Specialist confirms eligible units and recommended work.'}
  - id: condo_eligible
    version: '1'
    program_id: condo_insulation
    status: draft
    scope: unit
    target: eligible_unit_definition
    date_basis: as_of
    effective_from: null
    effective_until: null
    source_url: 'https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties'
    last_verified: '2026-11-06'
    condition: {unresolved: {question: 'Which units count as eligible for the all-units condition?', decider: Energy Specialist, next_action: 'Confirm with Mass Save.'}}
    effect: {kind: service, description: 'Confirm eligible unit definition', qualification: exact}
    interactions: []
    handoff: {contact_id: mass_save, action: 'Ask which units count as eligible.', enrollment: contact}
```

`condo_eligible` is a named **predicate**, not an additional benefit: the example gives it rule provenance so unknown eligibility cannot disappear inside an aggregate. For every unit, false membership excludes it; unknown membership or participation propagates unless the aggregate result is logically determined for all possible assignments. The target unit's meter requirement is necessary; it is not assumed sufficient to define every unit in the denominator.

### Rental insulation and Turnkey (§2.2; approval §1)

```yaml
program: {id: rental_weatherization, name: Mass Save landlord weatherization, jurisdiction: MA, contact_ids: [mass_save]}
common: &rental
  program_id: rental_weatherization
  status: draft
  scope: unit
  date_basis: as_of
  effective_from: null
  effective_until: null
  source_url: 'https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties'
  last_verified: '2026-11-06'
  condition: {all: [{fact: building.residential_unit_count, op: between_inclusive, value: [1, 4]}, {fact: unit.occupancy, op: eq, value: renter}]}
  handoff: {contact_id: mass_save, action: 'Arrange assessment and confirm property owner approval.', enrollment: contact}
  interactions:
    - {type: prerequisite, target: work, condition: {fact: project.owner_approval, op: eq, value: true}, source_url: 'https://www.masssave.com/en/residential/for-renters'}
rules:
  - <<: *rental
    id: landlord_insulation
    version: '1'
    target: recommended_insulation
    effect: {kind: percent_off, percent: 100, basis: rental_property_insulation, qualification: exact}
    interactions:
      - {type: prerequisite, target: work, condition: {fact: project.owner_approval, op: eq, value: true}, source_url: 'https://www.masssave.com/en/residential/for-renters'}
      - {type: best_of, group: insulation_offer, target: same_unit_and_measure}
      - {type: exclusive, group: insulation_offer, target: same_unit_and_measure}
  - <<: *rental
    id: rental_turnkey
    version: '1'
    target: weatherization_barriers
    effect: {kind: service, description: 'Residential Turnkey Solutions for health and safety barriers before weatherization', qualification: exact}
```

Turnkey is represented as a service, not a fabricated dollar amount. The same condition excludes owner-occupied units without assuming the whole mixed building is rental. Whether mixed-unit offers are administered together remains open (§2.4).

### Whole-home heat pump (§1, §6; gas exception §16)

```yaml
program: {id: heat_pump, name: Mass Save air-source heat pump rebates, jurisdiction: MA, contact_ids: [mass_save]}
common: &heat_pump
  program_id: heat_pump
  status: draft
  scope: account
  target: whole_home_air_source_heat_pump
  date_basis: installation
  source_url: 'https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps'
  last_verified: '2026-11-06'
  condition:
    all:
      - {fact: building.residential_unit_count, op: between_inclusive, value: [1, 4]}
      - {fact: project.sole_heating_and_cooling_source, op: eq, value: true}
      - {fact: project.home_occupied_full_time_in_winter, op: eq, value: true}
      - {fact: project.network_installer, op: eq, value: true}
      - {fact: project.cold_climate_qualified_equipment, op: eq, value: true}
      - {fact: account.whole_home_rebate_already_used, op: eq, value: false}
      - any:
          - all:
              - {fact: unit.heating_fuel, op: in, value: [oil, propane, electric_resistance]}
              - {fact: account.type, op: eq, value: residential_electric}
              - {fact: account.utility, op: in, value: [cape_light_compact, eversource, national_grid, unitil]}
          - all:
              - {fact: unit.heating_fuel, op: eq, value: natural_gas}
              - {fact: account.type, op: eq, value: residential_gas}
              - {fact: account.utility, op: in, value: [berkshire_gas, eversource, liberty, national_grid, unitil]}
      - {unresolved: {question: 'Who applies when a tenant holds the account and the landlord owns the equipment?', decider: Mass Save, next_action: 'Confirm at the assessment.'}, when: {fact: project.tenant_account_landlord_equipment, op: eq, value: true}}
  interactions:
    - {type: prerequisite, target: rebate, condition: {fact: project.home_energy_assessment_completed, op: eq, value: true}, source_url: 'https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments'}
    - type: prerequisite
      target: whole_home_rebate
      condition:
        any:
          - {fact: building.year_built, op: gte, value: 2000}
          - {fact: assessment.recommended_weatherization_usd, op: lt, value: 1000}
          - {fact: project.weatherization_recommended_since_2013_completed, op: eq, value: true}
    - {type: sequence, before: complete_recommended_weatherization_if_needed, after: whole_home_heat_pump, when: 'weatherization required'}
    - {type: exclusive, group: mass_save_same_equipment, target: same_equipment}
    - {type: cap, amount: 1, unit: rebate, scope: account, period: unspecified, target: whole_home_rebate}
    - {type: cap, scope: installation, basis: installation_cost, target: rebate}
  handoff: {contact_id: mass_save, action: 'Confirm eligibility, account holder and weatherization at the assessment.', enrollment: contact}
rules:
  - <<: *heat_pump
    id: whole_home_rebate
    version: '2026'
    effective_from: '2026-01-01'
    effective_until: '2026-12-31'
    effect: {kind: rate, amount: 2650, currency: USD, per: ton, cap: {amount: 8500, currency: USD, scope: account, period: unspecified}, qualification: up_to}
  - <<: *heat_pump
    id: whole_home_rebate
    version: '2027'
    effective_from: '2027-01-01'
    effective_until: null
    effect: {kind: rate, amount: 2350, currency: USD, per: ton, cap: {amount: 7500, currency: USD, scope: account, period: unspecified}, qualification: up_to}
```

`when` on an unresolved condition means implication: false condition bypasses it, true makes it unknown, unknown stays unknown. Applying the 2027 rate beyond the announced start is a potential, as-of-verified result until its end and continued terms are confirmed. Capacity is AHRI cooling BTU/h divided by 12,000 (§6). The weatherization failure directs users to the separately verified partial-home rule, not an automatic invented award. The 2026 total account cap and the installation-cost cap must also include other applicable claims; the evidence states the 2027 whole-home cap but does not establish all future aggregate cap terms, so those require verification. The account-holder ambiguity is conditional, not a universal denial. Owner approval applies when the affected unit is rented (§1).

### DEC rental heat pump (§3; data sources §5)

```yaml
program: {id: dec_rental, name: Mass Save Designated Equity Communities rental offer, jurisdiction: MA, contact_ids: [mass_save]}
rule:
  id: dec_rental_heat_pump
  version: '1'
  program_id: dec_rental
  status: draft
  scope: unit
  target: air_source_heat_pump
  date_basis: as_of
  effective_from: null
  effective_until: null
  source_url: 'https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities'
  last_verified: '2026-11-06'
  condition:
    all:
      - {fact: building.residential_unit_count, op: between_inclusive, value: [1, 4]}
      - {fact: unit.occupancy, op: eq, value: renter}
      - {fact: location.confirmed_dec_offer_area, op: eq, value: true}
      - {fact: unit.heating_fuel, op: in, value: [oil, propane, other_delivered_fuel, electric_resistance]}
      - {unresolved: {question: 'Is this project expected not to increase renters’ energy burden?', decider: Mass Save, next_action: 'Ask the program to assess the project.'}}
  effect: {kind: no_cost, basis: air_source_heat_pump, qualification: up_to, decision_note: 'Program determines whether renters’ energy burden is expected to increase.'}
  interactions:
    - {type: prerequisite, target: work, condition: {fact: project.owner_approval, op: eq, value: true}}
    - {type: exclusive, group: mass_save_same_equipment, target: same_equipment}
  handoff: {contact_id: mass_save, action: 'Confirm DEC location, expected energy burden and owner approval.', enrollment: contact}
```

`confirmed_dec_offer_area` is not simply a municipality or state EJ flag; the source may narrow territory and the precise lookup remains open. The engine does not decide the burden test from its own bill forecast. Delivered-fuel examples are descriptive; the source's category must be checked before mapping any specific fuel.

### SMART 3.0 community solar (§9; lottery distinction §10)

```yaml
program: {id: smart_community_solar, name: SMART 3.0 community shared solar, jurisdiction: MA, contact_ids: [doer_solar]}
common: &solar
  program_id: smart_community_solar
  status: draft
  scope: household
  target: community_shared_solar_bill_credit
  date_basis: as_of
  effective_from: null
  effective_until: null
  source_url: 'https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download'
  last_verified: '2026-11-06'
  handoff: {contact_id: doer_solar, action: 'Check an available SMART 3.0 community shared solar project and its contract.', enrollment: contact}
  interactions: []
rules:
  - <<: *solar
    id: smart_low_income_floor
    version: '1'
    condition: {all: [{fact: project.is_smart_3_community_shared_solar, op: eq, value: true}, {fact: household.smart_low_income_customer, op: eq, value: true}]}
    effect: {kind: discount_floor, percent: 40, basis: credit_value, qualification: minimum}
  - <<: *solar
    id: smart_other_residential_floor
    version: '1'
    condition: {all: [{fact: project.is_smart_3_community_shared_solar, op: eq, value: true}, {fact: household.residential_customer, op: eq, value: true}, {fact: household.smart_low_income_customer, op: eq, value: false}]}
    effect: {kind: discount_floor, percent: 20, basis: credit_value, qualification: minimum}
```

Low-income status must follow the regulation's alternatives; do not equate it with state EJ status. When unknown, return possible floor tiers, not a certain 20% classification. The floors apply to covered projects and credit value, not every community solar contract or total utility bill. ECSAP would be a separate program and handoff with `enrollment: automatic_selection`: get on the applicable discount rate if eligible and explain that selection may occur by lottery (§10); the source's enrollment model is secondary evidence and needs confirmation before definitive production copy.

### Municipal electric utility exclusion (§16; gas path §6–7)

```yaml
program: {id: mass_save_electric, name: Mass Save electric-side offers, jurisdiction: MA, contact_ids: [mass_save]}
rule:
  id: electric_sponsor_gate
  version: '1'
  program_id: mass_save_electric
  status: draft
  scope: account
  target: mass_save_electric_side_offer
  date_basis: as_of
  effective_from: null
  effective_until: null
  source_url: 'https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments'
  last_verified: '2026-11-06'
  condition: {fact: account.electric_utility_is_mass_save_sponsor, op: eq, value: true}
  effect: {kind: service, description: 'Electric-side sponsor territory gate', qualification: exact}
  interactions: []
  handoff: {contact_id: mass_save, action: 'Confirm the serving utility; ask the municipal utility about its own offers.', enrollment: contact}
```

This gate is referenced only by electric-side offers that actually require it. A confirmed MLP electric account fails that gate; unknown utility remains unknown. It is **not** a building-wide Mass Save exclusion: evaluate the separate gas sponsor path and its particular conditions independently (§6–7, §16). Resolve a specific MLP contact from a verified utility directory; otherwise ask the user to contact their utility without inventing a phone or URL.

## Counterfactual and verification

For a condo, first evaluate the actual eligible-unit set and each unit's participation with three-valued logic. If the set is confirmed as three eligible units, two have agreed and one has not, simulate only that unit's participation changing to true, reevaluate both rules, and compare potential benefits: “One more eligible unit agreeing could move the offer from **up to 75% to up to 100%**, subject to the Energy Specialist's confirmation.” Never change the actual input. A counterfactual is conditional on all other facts and is not an eligibility promise. With an unknown eligible-unit definition or unknown participation, enumerate the feasible counts (at most four units), report a possible range or “cannot determine yet,” and ask the specialist; do not assert exactly one. Similar simulations can change a confirmed income interval or a prerequisite, with dependencies and other unchanged unknowns retained. Only return changes the user can realistically act on or verify.

Validation before publication checks required fields, nonempty valid source URLs, valid calendar dates, `last_verified` not in the future, date ordering, known enum/operator/field types, effect units and caps, source and contact references, unique IDs/versions, valid AST and aggregate scope, and no conflicting overlapping versions for the same rule/date basis. Each policy-bearing interaction needs its own source or inherits its rule's source only when that source supports it. Missing bounds carry an explicit unknown meaning, never an implicit infinity. Verify lookup tables similarly. Test fixtures pin the evaluation date: 2026-12-31 selects 2026, 2027-01-01 selects the announced 2027 version; an unknown install date selects neither as confirmed. Test false/unknown utility, missing meter, all/some/unknown participation, one-unit counterfactual, tenant approval, uncertain income overlap, DEC burden, cap use and mutually exclusive equipment. Test deterministic rendering against unknown IDs and numbers. No app code is part of this deliverable.

At runtime, flag a rule as possibly stale when `today - last_verified > 90 days`; staleness is independent of eligibility and effective dates. A CI release check fails for a shipped rule lacking a source or with a known `effective_until` before the release date. To reconcile historical scenarios and coexistence of 2026/2027: expired versions stay in a historical archive, not the shipped active set; historical evaluations require explicitly loading that archive and label it historical. Future versions may ship alongside current ones. A null end date is not proof of continuing validity, so release review must separately check source freshness and any unsupported future coverage. A rule with no active or reliably applicable version yields unknown, never silently reuses an expired one.

## Alternatives and risks

- **One free-text rule per program:** easy to author, but conditions, unknowns, unit scope and comparisons become dependent on interpretation. Rejected for deterministic decisions; keep prose only for evidence and explanation.
- **Hard-code every program in TypeScript:** straightforward initially, but policy-only edits then require code changes and entangle source/version review. Rejected in favor of a small closed data vocabulary plus a tested evaluator; new policy concepts still need code deliberately.
- **General-purpose rules DSL or arbitrary JavaScript:** expressive but increases audit surface and lets invalid rules or unsafe execution hide in data. Rejected for typed predicates and explicit effect/interaction kinds. A JSON Schema plus discriminated unions in TypeScript is a possible implementation, not a dependency of the design.

Hard-to-change choices are the condition vocabulary, identity and scope of accounts/units, aggregate semantics, temporal event basis, interaction keys and version migration. A wrong unit of aggregation can overstate benefits across accounts; incorrect unknown propagation can turn potential offers into promises. The 90-day freshness signal cannot guarantee a rule has not changed. An independent reviewer should challenge all three before Phase 1; policy owners must verify actual live source terms before data ships.

## Open questions for Qiao and policy verification

1. Mass Save: which units are eligible for the condo denominator, who applies when a tenant holds the account, and how mixed owner/renter buildings are administered (§2.3–2.4, §6)? Until answered, show conditional results only.
2. DEC: authoritative address/administrator lookup and precise scope of any EJ narrowing; who decides the renter energy-burden test (data sources §5)? Do not equate a model estimate with program approval.
3. Heat pumps: confirm the 2027 end date, aggregate account cap and any changes to other conditions; confirm how previous claims and the account cap are measured (§6). How should archived historical rules be distributed while the expired-rule CI check remains strict?
4. Enhanced income limits vary by area (§5): obtain authoritative versioned local limits and define safe handling of income bands that overlap a threshold. Which sources and permissions are acceptable for optional income collection?
5. Confirm the full set of policy-specific stacking, cap and prerequisite relationships before encoding. Should unverified interactions suppress a net total entirely or allow separately labeled non-additive scenarios?
6. Confirm SMART project applicability, low-income definitions and ECSAP's lottery terms from primary sources (§9–10); obtain verified per-utility handoffs. The current handoff link is guidance, not a specific available project.
7. The proposed AST, version/archive strategy, evaluator vocabulary and slot boundary are design choices for comparison with the lead's independent proposal, not decisions already approved by Qiao.
