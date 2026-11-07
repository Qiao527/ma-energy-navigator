# Rules-data schema (chosen design, v2)

**Status:** [Decided 2026-11-06 — Qiao].
- **v1** merged `rules-schema-draft-a.md` and `rules-schema-draft-b.md` per `comparison.md` §5.
- **v2** applies the accepted Phase 0 review findings (`docs/reviews/phase-0-response.md`).

Implemented in `docs/phase-1-plan.md`.

## 1. Shape

Rules are **JSON files** under `rules/<state>/`, validated by **Zod** at load time. A
**Program** owns **Offers**. An Offer is one sourced, versioned policy statement.

```ts
Offer {
  id, version,                       // id is stable; id + version is unique
  programId, title, measure: Measure,
  appliesTo: 'each_unit' | 'user',   // evaluate for every unit, or once for the user's unit and household
  dateBasis: 'installation' | 'as_of',
  effective: { from, until | null }, // the period the offer covers; compared to the planned install date
                                     // (dateBasis installation) or to today (as_of)
  applicationDeadline: ISODate | null, // paperwork due; separate from `effective`
  eligibility: Condition,            // facts about the user and building (§3)
  prerequisites: Prerequisite[],     // things to do first, including other units agreeing (§3)
  confirmations: Confirmation[],     // what only the program can confirm (§3)
  benefit: Benefit, qualification: 'exact' | 'up_to' | 'minimum',
  recipient: 'property_owner' | 'household',  // who receives the money or service (§7)
  enrollment: 'apply' | 'via_assessment' | 'via_landlord' | 'auto_selected' | 'referral',
  exclusiveGroup: string | null,     // best-of within (group, unit)
  capGroups: string[],
  sources: Source[]
}

Measure = 'bill_assistance' | 'assessment' | 'weatherization' | 'heat_pump'
        | 'rooftop_solar' | 'community_solar' | 'financing' | 'tax_credit'

Benefit =
  | { type: 'percent_of_cost', pct, costOf: Measure }              // e.g. 100% of insulation
  | { type: 'percent_of_cost_capped', pct, cap, costOf: Measure }  // e.g. 15% of solar, max $1,000
  | { type: 'per_ton', rate, cap }                                 // heat pumps; never above install cost
  | { type: 'fixed', amount }
  | { type: 'per_kwh', rate, years }                               // SMART
  | { type: 'min_discount_on_credits', pct }                       // community solar floor
  | { type: 'loan', maxPrincipal, apr: 0 }                         // HEAT Loan; not a grant
  | { type: 'none' }                                               // a service or referral

Source        { url, section, quote, lastVerified }
Prerequisite  { id, kind: 'action' | 'requirement' | 'coordination', description,
                satisfiedWhen: Condition | null, sources }
Confirmation  { id, question, decidedBy, nextAction, when: Condition | null, sources }
Predicate     { id, condition, note, sources }   // named, reusable, sourced definitions
IncomeTable   { id, label, window, bySize: number[], sources }
CapRule       { id, capGroup, scope: 'account' | 'home' | 'customer_lifetime' | 'installation',
                limit: { type: 'money', amount } | { type: 'count', count }, window, sources }
SequenceEdge  { before: Measure, after: Measure, reason, sources }
DecList       { municipalities: { name, narrowedFor: Utility[] }[], sources }

Condition = { all: Condition[] } | { any: Condition[] } | { not: Condition }
          | { fact: FactPath, op: 'eq', value: Scalar } | { fact, op: 'in', value: Scalar[] }
          | { fact, op: 'gte' | 'gt' | 'lte' | 'lt', value: number }
          | { incomeAtMost: tableId } | { incomeAbove: tableId }
          | { allUnits: { eligible: Condition, require: Condition } }  // evaluated per unit
          | { ref: predicateId }
```

## 2. Facts and truth values

- **Three namespaces** (review B01), each a closed list (`FACT_PATHS`):
  - `user.*`: the person using the tool and their household (`role`, `householdSize`,
    `incomeBand`, `onDiscountRate`).
  - `unit.*`: the unit being evaluated (`occupancy`, `heatingFuel`, `heatPaidBy`,
    `electricPaidBy`, `hasResidentialHeatingMeter`, `participating`,
    `occupiedAllWinter`).
  - `building.*`: building-wide facts and derived ones (`ownership`, `unitCount`,
    utilities, `isDec`, `renterShare`, …).
- With `appliesTo: each_unit`, `unit.*` is bound to each unit in turn. With `user`, it is
  bound to the user's own unit.
- An unknown path is an error at load time (data check) and at run time (`getFact`), so
  typos can't hide as questions (review B12).
- Conditions are three-valued (yes / no / unknown), with Kleene `all` / `any` / `not`.
  `null` in the input always means "not known yet". Unknown is never turned into no.

## 3. Three kinds of conditions, and status

| Kind | What it holds | Effect on status |
|---|---|---|
| **Eligibility** | Facts about the user and building | no → `not_eligible`; unknown → `needs_info` |
| **Prerequisites** | Things to do first. `action`: the user does it (landlord approval, weatherization). `requirement`: a condition on the work we can't check (Installer Network, cold-climate equipment); shown as a checklist. `coordination`: **other units** must agree (condo all-units) | **Never changes status.** Each one is `done` / `todo` / `unknown` / `check`. Coordination results also carry `unitsNeeded` (eligible units that said no) and `unitsUndecided` |
| **Confirmations** | What only the program can confirm | `when` yes or absent → `potential`; `when` unknown → `needs_info` (ask the user first, review B09); `when` no → ignored |

- **Status precedence:** `not_eligible` > `needs_info` > `potential` > `eligible`.
- A version whose `applicationDeadline` has passed (as of today) is `not_eligible` with
  reason `application_deadline_passed` (review A4).
- **Prerequisites vs sequence edges** (review B10): sequence edges order **measures** in the
  roadmap (assessment → weatherization → heat pump). Prerequisites are the steps for **one
  offer**.

## 4. Choosing what to show

- Within an `exclusiveGroup` and unit, an `eligible` result hides other results it beats
  or ties:
  - compare by dollar value (mid);
  - otherwise by percent of the same cost;
  - results that can't be compared are both kept.
- A result with a **pending coordination prerequisite** never hides anything; it depends
  on other people.
- `potential` and `needs_info` results stay unless an eligible result beats or ties them.
- **Condo example (Qiao, 2026-11-06):** while not every unit has agreed, the 75% tier is
  `eligible` and shown. The 100% tier is shown with "N more units needed" and the
  definition confirmation. It is **never** `not_eligible` for lack of agreement.
- `navigate` returns:
  - `evaluated`: everything, for tests and audit;
  - `shown`: eligible, potential and needs_info, plus `not_eligible` only when a
    realistic change would flip it (review B15).

## 5. Dates and versions

- `dateBasis: installation`: the version is picked by the planned installation date. If
  the date is unknown, use today, list `upcoming` versions, and ask for the date.
- `dateBasis: as_of`: picked by today.
- `applicationDeadline` is checked against today.
- **No archive folder** (review B06, Qiao). Old versions stay in the data: a 2026 install
  evaluated in 2027 needs them.
- **Tests always pass a fixed date.** A separate, non-blocking `npm run data:status` uses
  the real date to list versions past both dates and programs with no current version.
- Data checks:
  - versions of one id must not overlap;
  - an offer that uses an income table must end within the table's `window` (review A5);
  - every reference must resolve.

## 6. What would change the answer

For `not_eligible` and `needs_info` results, the engine re-evaluates eligibility with
realistic changes (getting on the discount rate) and reports the smallest set that works.
It never edits the input. Participation is **not** handled here: it's a coordination
prerequisite with an exact count (§3).

## 7. Money and who it reaches

- **Estimates carry confidence** (review A7): `Estimate { range, confidence, why[] }`.
  - Combining estimates takes the lowest confidence and keeps every reason.
  - Policy amounts fixed in the rules are `high`.
  - Costs come from sourced Massachusetts assumptions: heat pump $/ton, rooftop solar $/kW
    (`data-sources.md` §9b).
  - With no cost source, the value is `null`. Insulation then shows only "up to 100%" and
    who decides. No near-zero wording (review A2, Qiao).
- **Who saves, who may pay more** (review A3, review B02; Qiao's top priority). For each
  unit, `splitByPayer` attributes:
  - the **heating fuel bill** change to `heatPaidBy`;
  - the **electric bill** change to `electricPaidBy`;
  - the **upfront cost and rebate** to the offer's `recipient`.

  Then it nets per person. Unknown payer → `unallocated`, never guessed. Example: oil →
  heat pump, landlord pays oil, tenant pays electricity → landlord saves the oil bill,
  tenant's electric bill goes up. Both are shown.
- **Caps:**
  - money caps clip the per-unit sum, labelled "assumes one account per unit" (review A10);
  - count caps and lifetime caps are notes ("if you haven't used this before").

## 8. Condo "eligible unit"

- The predicate `condo_eligible_unit` holds the **working assumption**: units with a
  residential heating meter.
- The all-units offer's coordination prerequisite counts units under that assumption. Its
  confirmation names Mass Save as the decider, so the result is `potential` and the count
  reads as conditional.
- When Qiao gets the answer, only the predicate and the confirmation change.

## 9. Kept for later

Contact directory, multiple households, account identity, relative deadlines, grandfathering
selectors and participation ratios. No sourced v1 rule needs them (response, "Not changed").
