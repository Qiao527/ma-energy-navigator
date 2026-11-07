# Rules-data schema: Draft A vs Draft B

Phase 0, Step 5 / Phase 1 Task 0 gate. Author: Qiao Long (author of one of the two
designs). Date: 2026-11-06.

Compared:
- **Draft A:** `docs/schema/rules-schema-draft-a.md`, implemented in `docs/phase-1-plan.md`
  Tasks 4–12.
- **Draft B:** `docs/schema/rules-schema-draft-b.md` on branch `Qiao527/schema-draft-b`,
  commit `a4571ed`. Read with `git show`; not merged.

**Bottom line.** Draft B's design is more correct in five places where mine is wrong or
over-confident: the condo eligibility definition, installation date vs today's date,
unresolved conditions, prerequisites, and counterfactuals. Mine is simpler to implement
and has better provenance (quotes per source) and more useful output in one condo case.
**Recommendation: keep my structure and file format, and adopt Draft B's semantics in
those five places plus caps.** Section 5 lists the exact changes. I'll update the Phase 1
plan after Qiao approves.

---

## 1. Where the two designs agree

Both designs, independently:
- keep rules as data with a **closed vocabulary**, so unknown operators or fact paths fail
  validation;
- use **three-valued logic** (true / false / unknown), with the same Kleene semantics for
  `all` / `any` / `not`;
- express **tiers as separate rules** (75% and 100% condo insulation) and pick the best
  applicable one, never adding percentages;
- store **separate versions for 2026 and 2027** heat pump rates, with their own dates;
- treat MLP as an **electric-side gate on each offer**, not a building-wide exclusion, so
  the gas path still works;
- treat the community solar 40% / 20% as a **minimum on credit value**, not a dollar
  promise;
- apply the **90-day staleness flag** and a **release check** that fails on a missing
  source or an expired rule;
- show ECSAP as **automatic selection** ("get on the discount rate"), not "sign up";
- keep the **LLM behind slots** (`{program:…}`, `{scenario:…}`) filled from engine output,
  with a validator as the second line of defense;
- take the municipality from the county subdivision, not the postal city.

## 2. Where they differ

| # | Topic | Draft A | Draft B |
|---|---|---|---|
| D1 | Unclear policy terms | `certainty: unresolved` on the **offer**; the condition can still evaluate to yes | `unresolved` is a **condition node** that always evaluates to unknown, optionally only `when` a fact holds |
| D2 | Condo "eligible unit" | Hard-coded as "has a residential heating meter" | A named predicate `condo_eligible` that is itself unresolved; the target unit's meter is necessary but not sufficient |
| D3 | Which date picks the rule version | Today's date (`asOf`) | `date_basis`: the **installation** date for rebates, `as_of` only where the source names no event |
| D4 | Prerequisites (assessment, weatherization, owner approval) | Folded into eligibility (weatherization) or sequence edges (assessment); owner approval only as `enrollment: via_landlord` | Separate `prerequisite` interactions; eligibility and prerequisite completion are separate outputs |
| D5 | Heat pump requirements | Fuel/utility path and weatherization only | Also: sole heating/cooling source, full-time winter occupancy, Installer Network, cold-climate equipment, one whole-home rebate per account |
| D6 | "What would change the answer" | `levers` propagated through `all`/`any` | Re-evaluate with only the changed fact; with unknowns, enumerate feasible counts or say "cannot determine yet" |
| D7 | Caps | Sum per unit, per period | Cap with scope (account, home, lifetime, installation); prior use is a fact; unknown prior use → unknown remaining cap |
| D8 | Expired versions | Stay in the data; CI uses the real date and fails once a version expires | Expired versions move to a historical archive; the active set ships; history must be loaded on purpose |
| D9 | Provenance | `sources[]` with **url, section, quote, lastVerified** on every offer, table, cap and sequence edge | One `source_url` + `last_verified` per rule; interactions may carry their own URL; **no quote** |
| D10 | Entities and scopes | Building, units, one household; `appliesTo: each_unit | user` | Building, units, households[], account, project; scopes building/unit/household/account/project |
| D11 | Predicate form | Key-based: `{fact, eq}`, `{fact, in}`, `{fact, gte}` | Uniform: `{fact, op, value}` incl. `between_inclusive`, `lt` |
| D12 | Condo 75% tier | No participation condition; best-of picks it when 100% doesn't apply | Aggregate quantifier `some_but_not_all` |
| D13 | Handoffs | Per program, plus `enrollment` per offer | Contact directory, plus per-rule `handoff {contact, action, enrollment}` |
| D14 | Format | JSON + Zod, concrete and implemented in the plan | YAML for illustration; serialization left open |

## 3. Criterion by criterion

### 3.1 Correctness (does it say only what the sources support?)

**Draft B is ahead.** Where my design is wrong:
1. **D2: I encoded a definition the source doesn't give.** The landlord page says the unit
   must have a heating meter. It does not say that the meter is what makes a unit
   "eligible" for the all-units count. My design would tell a condo owner "1 more unit →
   100%" as if that were settled. Draft B makes the definition explicitly unresolved.
   Qiao is asking Mass Save; until then, only Draft B's version is honest.
2. **D3: I used today's date to pick the rate.** In November 2026, someone planning a
   February 2027 install would see the 2026 rate ($2,650/ton, cap $8,500), which won't
   apply to them ($2,350/ton, cap $7,500). Draft B's `date_basis: installation` is right.
3. **D1: offer-level "unresolved" is too coarse in two directions.**
   - Too strong: the DEC no-cost heat pump shows status `yes` while the energy-burden
     test is unanswered.
   - Too weak: the account-holder question gets attached to every unit, including
     owner-occupied units where it doesn't arise.

   Draft B's `unresolved` node, with `when`, fixes both.
4. **D5: I left out stated heat pump conditions:** sole source, full-time winter
   occupancy, Installer Network, cold-climate equipment, one whole-home rebate per
   account. My engine would say `yes` when the source says more is required.
5. **D4: a fixable prerequisite shows as "not eligible".** In Story 1, the whole-home
   rebate comes out `no` with a lever, which the UI would read as "you don't qualify".
   The source frames weatherization as something to do first. Draft B separates the two.
6. **D6: my lever propagation is an approximation.** For `any`, it returns the first lever
   it finds. For `all`, it unions levers without checking that applying them gives `yes`.
   Draft B's re-evaluation is correct by construction.
7. **D7: caps ignore prior claims and lifetime limits** (HEAT Loan is $25,000 over a
   customer's lifetime). Draft B models this.

Where Draft B is weaker:
- **D9:** without a quote per source, a reviewer can't check a rule against its source
  without re-reading the page. Interactions often "inherit" the rule's URL, so the support
  for a specific condition is easy to lose. Principle 3 is better served by my per-source
  quotes.
- **D12:** with one undecided unit, `some_but_not_all` makes the 75% tier unknown too.
  But if the user's own unit is taking part, "at least some" is already true, so the user
  could be told "75% now, 100% if everyone joins". My design shows that; Draft B's shows two
  potentials.

### 3.2 Can it express condo all-units participation?

Both can. Draft B's is **more honest** (D2): the unknown definition propagates. Mine is
**more useful today** (D12): it gives a concrete 75% while 100% is pending. The merged
design should do both. Use a named predicate for "eligible unit" that stays unresolved
until Mass Save answers, plus my best-of handling of the 75% tier. Until the definition is
known, the counterfactual message is conditional: "If units without a heating meter don't
count, 1 more unit agreeing would move this from up to 75% to up to 100%."

### 3.3 Can it express mid-plan rule changes?

Both store 2026 and 2027 as separate versions. Draft B handles it correctly (D3, D8):
- the version is chosen by **installation date**;
- an unknown installation date shows both versions as possible;
- expired versions are archived, not left to fail CI.

Mine has two defects:
- the wrong date basis (D3);
- a CI rule that fails on 2027-01-01 even though 2026 installs can apply until
  **2027-02-28** (research §6). That's a real tension my design didn't notice.

### 3.4 Testability

Both can be tested well.
- Mine is already turned into concrete tests: about 80 example tests, three property
  tests, and the coordination property.
- Draft B's test list is thorough but not yet written. Its richer output states (eligible /
  prerequisite pending / potential / not eligible) mean more combinations to test.
- Draft B's re-evaluation counterfactual is **easier** to test than my lever propagation,
  because the expected answer is just "evaluate again with this fact changed".

### 3.5 Implementation complexity

- **Mine:** about 16 tasks as planned; small evaluator; two scopes.
- **Draft B in full:** about 40–60% more *(estimate)*:
  - account and project entities;
  - five interaction types;
  - a version + archive store;
  - a contact directory;
  - date-basis handling;
  - feasible-count enumeration.
- **Risk in Draft B in full:** many facts (`project.network_installer`,
  `account.whole_home_rebate_already_used`, …) are unknown at the navigation stage. If they
  sit in eligibility conditions, almost every heat pump result becomes "potential", and
  the product says little.
- **Merge:** about 25% more than mine *(estimate)*. That means 3–4 extra tasks: prerequisites,
  date basis + archive, re-evaluation counterfactuals, cap scopes.

## 4. Scorecard

| Criterion | Draft A | Draft B | Merge |
|---|---|---|---|
| Correctness vs sources | Weaker (7 issues above) | Stronger; weaker provenance | Draft B semantics + Draft A provenance |
| Condo all-units | Concrete, but over-confident | Honest, but less informative | Honest *and* informative |
| Mid-plan changes | Wrong date basis; CI tension | Correct | Draft B's |
| Testability | Concrete now | Good, not yet written | Concrete, with simpler counterfactual tests |
| Complexity | Lowest | Highest | Moderate |

## 5. Merge recommendation

**Adopt from Draft B**
1. **`unresolved` as a condition node** with optional `when`, carrying `question`,
   `decider`, `next_action`. My `certainty` field shrinks to Draft B's
   `qualification: exact | up_to | minimum` on the benefit.
2. **Two kinds of unknown** in results: *missing user fact* (ask the user) vs
   *unresolved policy* (ask the program). Only the first goes into `questions`.
3. **Prerequisites as their own field** on an offer (condition + source). Result status
   becomes: `eligible`, `eligible_after_prerequisites`, `potential`, `not_eligible`.
   Weatherization-before-whole-home, the assessment requirement and owner approval for
   rented units move here.
4. **`date_basis`**, with evaluation by planned installation date. Unknown date → show
   each applicable version as potential. **Archive** expired versions outside the
   active set; the CI expiry check runs on the active set only.
5. **Counterfactuals by re-evaluation** over a declared list of changeable facts.
   Delete my lever propagation.
6. **Caps with scope and prior use** (`account | home | customer_lifetime |
   installation`). Unknown prior use → "if you haven't claimed this before".
7. **The heat pump conditions I left out** (D5). Project-level ones (Installer Network,
   cold-climate equipment) become a **requirements checklist** with sources, shown to the
   user rather than asked up front. Household-level ones (full-time winter occupancy,
   sole heating source for whole-home) become ordinary facts.
8. **Uniform predicate form** `{fact, op, value}` (D11). Easier to validate and extend.
9. **Named predicates** for reusable definitions with their own source, starting with
   `condo_eligible_unit`.

**Keep from Draft A**
10. **`sources[]` with url, section, quote, lastVerified** on every rule, table, cap,
    prerequisite and sequence edge (D9).
11. **JSON validated by Zod** and the closed fact registry (D14). This matches the
    approved stack.
12. **One `exclusiveGroup` for best-of** (D12). Draft B's separate `best_of` and
    `exclusive` lead to the same result for every v1 rule. Document the difference and
    split them only when a rule needs it.
13. **Two scopes plus one household for v1** (D10). Draft B's `households[]` and `account`
    entities wait until a rule needs them. The account-holder question is handled by an
    `unresolved … when` node instead.
14. **Concrete 75% tier via best-of** while the 100% tier is pending (D12, §3.2).

**Not adopted**
- Draft B's per-rule contact directory (D13) is a good idea but not needed for the schema
  decision. My per-program handoff plus per-offer `enrollment` covers v1. Revisit in
  Phase 2 when the copy is written.

**Effect on the Phase 1 plan:** Tasks 4, 5, 6, 8, 10, 11 and 12 change, and 3–4 tasks are
added. I'll revise the plan after Qiao approves this recommendation, before Phase 1 starts
(Task 0 Step 3–4).

**Waiting on Mass Save:** the condo "eligible unit" definition (Qiao is calling). The
merged schema works either way: the answer becomes the body of `condo_eligible_unit`.
