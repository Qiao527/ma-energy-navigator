# Rules-data schema (chosen design)

**Status:** [Decided 2026-11-06 — Qiao]. Merged from `rules-schema-draft-a.md` and
`rules-schema-draft-b.md` following `comparison.md` §5. Qiao added three rules (§3, §5, §7).
Implemented in `docs/phase-1-plan.md`.

## 1. Shape

Rules are **JSON files** under `rules/<state>/`, validated by **Zod** at load time. A
**Program** owns **Offers**. An Offer is one sourced, versioned policy statement:

```ts
Offer {
  id, version,                    // id is stable; id + version is unique
  programId, title, measure,
  appliesTo: 'each_unit' | 'user',
  dateBasis: 'installation' | 'as_of',
  installWindow: { from, until | null },   // when the work must be installed (or the program-year window)
  applicationDeadline: ISODate | null,     // when the paperwork must be in; separate from installWindow (§5)
  eligibility: Condition,         // facts about the user and building (§3)
  prerequisites: Prerequisite[],  // things the user does first (§3)
  confirmations: Confirmation[],  // what only the program can confirm (§3)
  benefit: Benefit, qualification: 'exact' | 'up_to' | 'minimum',
  enrollment: 'apply' | 'via_assessment' | 'via_landlord' | 'auto_selected' | 'referral',
  exclusiveGroup: string | null,  // best-of within (group, unit)
  capGroups: string[],
  sources: Source[]               // url, section, quote, lastVerified — on everything
}
Source        { url, section, quote, lastVerified }
Prerequisite  { id, kind: 'action' | 'requirement', description, satisfiedWhen: Condition | null, sources }
Confirmation  { id, question, decidedBy, nextAction, when: Condition | null, sources }
Predicate     { id, condition, note, sources }          // named, reusable, sourced definitions
CapRule       { id, capGroup, scope: 'account'|'home'|'customer_lifetime'|'installation',
                limit: { type: 'money', amount } | { type: 'count', count }, window, sources }
SequenceEdge  { before: Measure, after: Measure, reason, sources }
IncomeTable   { id, label, bySize: number[], sources }
DecList       { municipalities: { name, narrowedFor: Utility[] }[], sources }
Condition = { all } | { any } | { not } | { fact, op, value } | { incomeAtMost } | { incomeAbove }
          | { allUnits: { eligible, require } } | { ref: predicateId }
op ∈ eq | in | gte | gt | lte | lt
```

## 2. Truth values

Conditions are three-valued (yes / no / unknown) with Kleene `all` / `any` / `not`.
`null` in the input always means "not known yet". Unknown is never turned into no.

## 3. Three kinds of conditions (Qiao, 2026-11-06)

| Kind | What it holds | Effect on status |
|---|---|---|
| **Eligibility** | Facts about the user and building: role, occupancy, fuel, utility, location, income band, winter occupancy | no → `not_eligible`; unknown → `needs_info` (ask the user) |
| **Prerequisites** | Things the user does first: Home Energy Assessment, weatherization before a whole-home heat pump, owner approval, a contractor from the Installer Network, cold-climate equipment | **Never changes status.** Shown as "eligible — next, do X". Each one is `done` / `todo` / `unknown` / `check` (can't be checked by us; shown as a checklist item) |
| **Confirmations** | Facts nobody in the app can settle, only the program: e.g. the condo "eligible unit" definition, the renter energy-burden test, who applies on a tenant-held account, area-specific income limits | If it applies (`when` is yes or unknown, or absent) and eligibility is yes → `potential`, naming who decides and the next action |

**Statuses:** `eligible`, `potential`, `needs_info`, `not_eligible`.
Interpretation note: Qiao's "待确认（未知的事实）" covers facts **only the program can
answer**. Facts the *user* can answer but hasn't yet are eligibility unknowns
(`needs_info`), and they become questions on the form.

## 4. Choosing what to show

- Within an `exclusiveGroup` and unit, an `eligible` result hides other results it
  **beats or ties**:
  - compare by dollar value (mid);
  - if no dollar values, compare percent-of-cost on the same cost basis;
  - results that can't be compared are both kept.
- `potential` and `needs_info` results stay visible unless an eligible result beats or ties
  them. So a condo owner sees "75% now" (eligible) **and** "100% if every unit takes part"
  (potential).
- `not_eligible` results are always kept, so the UI can say what would change the answer.

## 5. Dates and versions (Qiao: install window ≠ application deadline)

- `dateBasis: installation`: the version is picked by the **planned installation date**.
  If that date is unknown, use today, list upcoming versions (e.g. "from 2027-01-01 the
  rate is $2,350/ton"), and ask for the date.
- `dateBasis: as_of`: picked by today's date.
- `installWindow` and `applicationDeadline` are stored separately. Example: 2026 heat pump
  installs end 2026-12-31, while the paperwork is due 2027-02-28.
- A version **retires** once both its install window and its application deadline have
  passed. It then moves to `rules/<state>/archive/`, which the loader doesn't read. The
  data check fails if a retired version is still in the active set, and if two versions of
  the same id overlap.

## 6. What would change the answer

For `not_eligible` and `needs_info` results, the engine **re-evaluates** with realistic
changes and reports the smallest set that makes eligibility hold:
- another unit agreeing to take part;
- getting on the utility discount rate.

It never edits the real input. With today's rules, this is how "1 more unit → 100%" is
found.

## 7. Money

- `benefitValue` turns a benefit into a `Range` only when the quantities exist. These come
  from sourced Massachusetts assumptions (`data-sources.md` §9b): heat pump $/ton, rooftop
  solar $/kW.
- **Insulation has no Massachusetts cost source.** The result carries the percentage and
  `nearZeroOutOfPocket: true` when the offer covers 100%. The UI then says "you'd likely
  pay close to nothing" with no dollar figure (Qiao, 2026-11-06).
- Policy terms stay exact (`qualification`). They are never turned into fake low/mid/high
  values.
- Caps have a scope:
  - money caps clip the summed value;
  - count caps (one whole-home rebate per account) and lifetime caps (HEAT Loan) appear
    as notes: "if you haven't used this before".

## 8. Condo "eligible unit"

The predicate `condo_eligible_unit` holds the **working assumption** (a unit with a
residential heating meter), with its source and a note. The all-units offer carries a
confirmation asking Mass Save, so its result is `potential`, not `eligible`. When Qiao gets
the answer, only the predicate body and the confirmation change; no code does.

## 9. Kept for later

Contact directory, multiple households, `account` / `project` entities: not needed by any
v1 rule (comparison §5).
