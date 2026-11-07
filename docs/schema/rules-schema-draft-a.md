# Rules-data schema — Draft A's design (draft, for comparison with Draft B)

Status: **draft, not committed until Draft B delivers** (decision 2026-11-06). Written
independently of `docs/schema/rules-schema-draft-b.md`.
Inputs: `docs/product.md`, `docs/incentives-research.md`, `docs/data-sources.md`.

## 1. Shape in one paragraph

Rules are **JSON data** validated by **Zod schemas** at load time. A **Program** (Mass Save
insulation, SMART, …) owns several **Offers**. An Offer is one versioned, sourced rule: *who*
(an eligibility **Condition**, a small JSON expression tree), *what* (a typed **Benefit**),
*when* (`period.from` / `period.until`), *how sure* (**Certainty**), *how you get it*
(`enrollment`), and *where it comes from* (`sources[]` with quote and `lastVerified`).
Conditions evaluate with **three-valued logic** (yes / no / unknown), so missing facts
become questions instead of guesses. One special condition, `allEligibleUnits`, expresses
"every eligible unit must take part" and returns the units still needed. Offers that
compete (several insulation offers) share an `exclusiveGroup`; the best eligible one is
shown. Per-account caps live in `caps.json`; ordering between measures lives in
`sequence.json`, each edge with its own source.

## 2. Entities

```ts
Program  { id, name, administrator, handoff: { label, phone|null, url }, sources: Source[] }
Source   { url, section, quote, lastVerified: ISODate }
Offer    { id, programId, title, measure: Measure, appliesTo: 'each_unit'|'user',
           period: { from: ISODate, until: ISODate|null },
           eligibility: Condition, benefit: Benefit, certainty: Certainty,
           enrollment: 'apply'|'via_assessment'|'via_landlord'|'auto_selected'|'referral',
           exclusiveGroup: string|null, capGroup: string|null, sources: Source[] }
Measure  = 'bill_assistance'|'assessment'|'weatherization'|'heat_pump'|'rooftop_solar'
         | 'community_solar'|'financing'|'tax_credit'
Benefit  = { type:'percent_of_cost', pct } | { type:'percent_of_cost_capped', pct, cap }
         | { type:'per_ton', rate, cap } | { type:'fixed', amount }
         | { type:'per_kwh', rate, years } | { type:'min_discount_on_credits', pct }
         | { type:'loan', maxPrincipal, apr: 0 } | { type:'none' }
Certainty= { kind:'stated' } | { kind:'at_least' } | { kind:'up_to', decidedBy }
         | { kind:'unresolved', question, decidedBy }
Condition= { all: Condition[] } | { any: Condition[] } | { not: Condition }
         | { fact, eq } | { fact, in } | { fact, gte } | { fact, lte }
         | { incomeAtMost: tableId } | { incomeAbove: tableId }
         | { allEligibleUnits: { eligible: Condition, require: Condition } }
IncomeTable { id, label, bySize: number[] /* index = household size − 1 */, sources }
// appliesTo: each_unit = evaluated for every unit (coordination view: "who in the building gets what");
//            user      = evaluated once for the user's own unit and household (income, role-based offers)
DecList  { municipalities: { name, narrowedFor: Utility[] }[], sources }
CapRule  { id, capGroup, amount, per: 'unit', period, sources }
SequenceEdge { before: Measure, after: Measure, reason, sources }
```

**Facts** are a closed registry of paths (`unit.occupancy`, `building.isDec`,
`household.onDiscountRate`, …). A rule that names an unknown path fails validation. Some
facts are marked *changeable* (participation, weatherization done, discount-rate
enrollment). Only those produce "what would change the answer" levers.

## 3. Main choices and why

| Choice | Why | Alternatives rejected |
|---|---|---|
| JSON data + Zod validation | Policy edits are data edits (product.md §6). Zod gives one source of truth for types and runtime checks | **json-rules-engine** library: its operators can't express "all eligible units", and its true/false logic has no "unknown". **Rules as TypeScript code**: easiest to write, but mixes policy with code and makes source/date checks harder |
| Three-valued conditions | Principle 4 (ask, don't pretend): unknown facts become questions, not silent "no" | Default-false booleans: hide missing data, produce wrong "not eligible" |
| One offer per tier (75% and 100% are two offers) + `exclusiveGroup` | Each tier keeps its own source quote and certainty; "best eligible wins" stays one rule | One offer with nested tiers: harder to cite, harder to show "you'd get the 100% tier if…" |
| Built-in `allEligibleUnits` | The signature feature needs the *count* of units still needed, not just yes/no | Generic `count(units where …) >= n`: more general, but "eligible" must then be duplicated and the shortfall list is harder to explain |
| Separate offers per period (2026 vs 2027) | Matches the source: two published rate sets with dates | Rate schedule inside one offer: compact, but each period has its own source date |
| Certainty on the offer | The product must say "up to" / "unresolved — decided at the assessment" next to the number | Free-text notes: can't be tested or rendered consistently |
| Benefit types, not formulas | A closed set is testable and keeps numbers in code (principle 1) | A formula string: flexible but an injection of arithmetic into data |

## 4. Worked examples (excerpts; full data in the Phase 1 plan, Task 10)

1. **Condo all-units 100%** (research §2.3):
   `eligibility: all[ building.ownership = condo, building.unitCount ≥ 2, unit.hasResidentialHeatingMeter = true,
   allEligibleUnits{ eligible: unit.hasResidentialHeatingMeter = true, require: unit.participating = true } ]`,
   `benefit: percent_of_cost 100`, `certainty: unresolved("What makes a unit 'eligible'?", "Mass Save")`,
   `exclusiveGroup: insulation`. Sibling offer `…_some_units`: same without `allEligibleUnits`, 75%.
2. **Landlord rental 100%** (§2.2): `all[ unit.occupancy = renter, building.electricIsMunicipal = false ]`, 100%.
3. **ASHP whole-home** (§6): two offers, `2026-01-01…2026-12-31` at `per_ton 2650 cap 8500` and
   `2027-01-01…` at `per_ton 2350 cap 7500`; weatherization condition
   `any[ building.yearBuilt ≥ 2000, building.weatherizationRecsDone = true ]`; `capGroup: masssave_hp_account`
   with cap rule $8,500 per unit account.
4. **DEC rental no-cost heat pump** (§3): `all[ building.isDec = true, unit.occupancy = renter,
   unit.heatingFuel in [oil, propane, electric_resistance] ]`, `percent_of_cost 100`,
   `certainty: unresolved("Would the heat pump increase this renter's energy burden?", "Mass Save turnkey vendor")`.
5. **Community solar floor** (§9): `min_discount_on_credits 40` (low-income) / `20`, `certainty: at_least`.
6. **MLP** (§16): every electric-side offer includes `building.electricIsMunicipal = false`; gas-path offers
   check `building.gasUtility` instead. No separate "exclusion" entity is needed.

## 5. "1 more unit → 100%"

`allEligibleUnits` returns `no` with `levers: [{ kind: 'participation', unitIds: [...] }]` when an
eligible unit has `participating = false`. The engine keeps that `no` result next to the chosen
75% offer, so the UI can say "N more unit(s) agreeing moves insulation from 75% to 100% off" and
show the difference in money from the two benefits. If a unit's participation is unknown, the
result is `unknown`, with `unit.participating` listed as a question.

## 6. Validation

- Load time: Zod schema; every fact path is in the registry; every `programId`, income table
  and cap group exists; ids are unique.
- Data tests (CI): every offer has ≥1 source; no shipped offer is past `period.until`; a
  rule whose oldest `lastVerified` is older than 90 days is reported as stale (shown in the UI).

## 7. Risks (hard to change later)

- **The fact registry** is the contract between data, intake form and engine. Renaming a
  fact touches all three.
- **Three-valued semantics** must be the same everywhere (engine, UI, LLM slots).
- **Per-unit quantities** (cost, tons) are a simplification for 2–4 unit buildings with
  similar units.
- **DEC narrowing** is approximated: if either utility is in the narrowing list, the EJ
  block group decides.

## 8. Open questions

- Should income tiers move into `IncomeTable` with area variation once Mass Save's
  ZIP-specific limits are known (research §5)?
- Does the account-holder question for heat pump rebates (research §6) need a per-unit
  certainty instead of one per offer?
