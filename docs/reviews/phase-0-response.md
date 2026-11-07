# Response to the Phase 0 reviews

Author: Qiao Long. Date: 2026-11-06.

Reviews (copied into this branch for the record, branches not merged):
- **Review A:** `docs/reviews/phase-0-review-a.md` (branch `Qiao527/phase0-review-a`,
  commit `911629b`)
- **Review B:** `docs/reviews/schema-review-b.md` (branch `Qiao527/schema-review-b`,
  commit `b692f27`)

How I worked:
- Each finding was checked against the documents and, where it concerns policy, against
  the official pages saved during Step 3. The pages were loaded in headless Chromium on
  2026-11-06; mass.gov blocks plain fetchers, which is why Review A couldn't open them.
- **Qiao's instructions (2026-11-06) decide five points:**
  - the payer split is the top priority;
  - all three Review A blockers are fixed;
  - Review B's prefixes are adopted;
  - review B04 is rejected;
  - deadlines and pre-approvals are added only where a rule actually exists.
- **Verdicts:** Accept = change made as suggested. Partial = the problem is real, but the
  fix differs. Reject = no change, with the reason.

## Summary

| | Accept | Partial | Reject |
|---|---|---|---|
| Review A (11) | 10 | 1 | 0 |
| Review B (15) | 6 | 7 | 2 |

Main changes, all in `docs/schema/rules-schema.md` and `docs/phase-1-plan.md`:
1. **Payer split** (review A3, review B02). The report shows, per person, who saves and who
   may pay more: fuel-bill change → whoever pays heat; electric-bill change → whoever pays
   electricity; upfront cost and rebate → the offer's `recipient`.
2. **Condo participation is a coordination prerequisite, not eligibility** (review A1;
   Qiao on review B04):
   - 75% shows as eligible;
   - 100% shows "N more units needed", with the unit list and a conditional note on the
     "eligible unit" definition;
   - never `not_eligible`.
3. **"Likely close to nothing" is removed** (review A2; Qiao). Offers show "up to X%" and
   who decides.
4. **No archive folder; tests use fixed dates** (review B06; Qiao). Versions stay in place.
   Which version applies, and whether its application deadline has passed, is computed
   from the dates (review A4).
5. **Confidence travels with every estimate** (review A7), as `Estimate { range, confidence, why }`.
6. **`Benefit` and `Measure` are now defined in the schema doc** (review B14, verified
   missing).

---

## Review A

| # | Sev. | Verdict | Verification and reasoning | Change |
|---|---|---|---|---|
| 1 | blocker | **Accept** | Confirmed. In the plan, a metered unit with `participating = false` makes the all-units offer `not_eligible` (`allUnits` → no). That rests on an *assumed* definition the source doesn't state (research §2.3). The confirmation only acts on `yes`, so it never reaches this case. | Participation moved out of eligibility into a **coordination prerequisite**, which never sets status (schema §3–4). Its result carries `unitsNeeded` / `unitsUndecided`. The count is labelled as depending on the working definition through the `condo_eligible_definition` confirmation. New tests cover a metered non-participant and an unmetered unit. |
| 2 | blocker | **Accept** | Confirmed: `nearZeroOutOfPocket` fired for an `up_to` offer. Qiao withdrew the idea. | Field and copy removed. Offers show their percentage, `qualification` and who decides. Test added. |
| 3 | blocker | **Accept** | Confirmed: `attributeToPayer` gives the whole net change to one payer. With oil paid by the owner and electricity paid by the tenant, the owner saves and the tenant pays more. | New `splitByPayer`: fuel bill and electric bill attributed separately (and net per person when one person pays both), plus upfront cost/rebate to the `recipient`; unknown payer → `unallocated`. Tests: different payers, same payer, unknown payer, electric-resistance heat (both on the electric bill). |
| 4 | major | **Accept** | Confirmed: version selection ignored `applicationDeadline`. Research §6 shows 2026 paperwork is due 2027-02-28. | `navigate` reports `applicationDeadlinePassed` and sets `not_eligible` with reason `application_deadline_passed`. Old versions stay in the data (item 4 above), so a 2026 install evaluated in March 2027 is explained correctly. Tests on both sides of the deadline. |
| 5 | major | **Accept** | Confirmed: the income tables had no validity window. The source says only "2026 – 2027 Heating Season" with no dates. | Income tables get a `window`. Data check: an offer that uses a table can't run past the table's window. Window set to **2026-10-01 → 2027-09-30**, an *inference* (the LIHEAP program year), recorded as an Open item to confirm with Mass Save. The income offers' start date moves from an unsupported 2026-07-01 to the same 2026-10-01. |
| 6 | major | **Accept** | Confirmed: staleness used only the offer's own sources. | Freshness = oldest `lastVerified` across the offer **and** the income tables, predicates, DEC list and caps it uses. Test: fresh offer + stale table → stale. |
| 7 | major | **Accept** | Confirmed against CONTRIBUTING.md principle 2: a `Range` had no confidence or reason. | `Estimate { range, confidence, why[] }`. Combining estimates takes the **lowest** confidence and keeps every input's reason. Fixed policy amounts are `high` ("set in program rules"). Test: mixed confidence. |
| 8 | major | **Accept** | Confirmed on the saved financing page: "A HEA is mandatory if you plan to pursue … Whole Home Heat Pump" sits under the HEAT Loan's *How to Participate*. The heat pump page instead lists three ways to show weatherization (A/B/C), and only B uses an assessment. It also says gas replacements apply with a **gas** account. | HEA prerequisite removed from the rebates and added to the HEAT Loan (for whole-home, windows, weatherization). The sequence edge assessment → heat pump is re-sourced to option B. The account confirmation now names the right account by fuel. Tests: gas path, built ≥ 2000 without an assessment. |
| 9 | major | **Accept** | Confirmed: research §6 lists **Basic** ($250/ton up to $2,500) and the **income-based Enhanced** heat pump offer (up to $16,000); §12 covers net-metering allocation (Schedule Z). Neither was encoded. | Added `ashp_basic` (2026; no 2027 rate is stated, so none is invented), `ashp_enhanced` (with the local-income confirmation) and `net_metering_allocation` (≤ 25 kW, same territory and load zone). New finance helper `splitCredits` for the per-meter picture. Per-address production stays in Phase 3. |
| 10 | major | **Partial** | The grouping really is by unit. But v1 can't know account identity, and product.md §5 already assumes one meter per unit. | Account caps keep per-unit grouping and say so (`assumption: 'one account per unit'`). Lifetime caps are notes only: no clipping, no total. No account input is added (YAGNI); revisit if a user case needs shared accounts. |
| 11 | minor | **Accept** | Checked the real file: all 25,209 rows of `MA FPL Counties 2022.csv` parse, so no missing-value encoding exists. | `_f` now raises on any non-numeric value, with row and column. Test added. |

Review A's "quotes requiring rechecking": **verified.** I checked each quote against the
official pages saved on 2026-11-06:
- condo/landlord: 3 quotes;
- SMART: $0.03, $0.06 and the application window;
- statute: 15%, three-year carryover, joint owners;
- DPU: ECSAP billing and the $420 target;
- 225 CMR: 20 years and the 40% floor.

All were found verbatim. No change needed. Task 13 still re-verifies them before encoding.

## Review B

| ID | Sev. | Verdict | Verification and reasoning | Change |
|---|---|---|---|---|
| 01 | critical | **Accept** (Qiao) | The plan already scoped facts (`user.`, `unit.`, `building.`, `household.`) and evaluated `unit.*` per unit. The schema doc didn't say so, which is fair. | Three namespaces, as Review B proposed: `household.*` facts become `user.householdSize`, `user.incomeBand`, `user.onDiscountRate`. Namespaces and binding rules are documented in schema §2. |
| 02 | high | **Accept** | Same as review A3. | `recipient` on every offer (`property_owner` or `household`), plus `splitByPayer` (see above). |
| 03 | critical | **Partial** | `eligible` and `require` *are* Conditions in the plan code, but the doc was vague. The count was indeed missing. | Types written out in the schema doc. Coordination prerequisite returns `unitsNeeded` / `unitsUndecided`, so "units still needed" is a deterministic count. **Rejected:** `minParticipationRatio`. No Massachusetts rule in the research uses a ratio. |
| 04 | high | **Reject** (Qiao) | Review B is right that the old doc contradicted itself (§4 said "potential"; the plan returned `not_eligible`). But its fix (`not_eligible` + counterfactual) is what Qiao rejected. | Fixed the other way: participation is a coordination prerequisite, so 100% shows "N more units needed", never `not_eligible`. |
| 05 | critical | **Reject** | Review B's grandfathering examples aren't sourced. The research has none: the heat pump page picks the rate by installation date ("installed on or after January 1, 2027"). Allowing overlaps without a sourced rule would weaken a useful data check. | None. Revisit when a sourced rule needs a second selector. |
| 06 | high | **Accept** (Qiao) | Confirmed: the real-date expiry test and the archive folder couple CI to the calendar. Moving files would also break review A4 (a 2026 install evaluated in 2027 needs the 2026 version). | No archive folder. Versions stay in the data; dates decide. Tests use a **fixed date**. A separate non-blocking `npm run data:status` uses today's date to list versions past both dates and programs with no current version (e.g. SMART PY2027 missing). |
| 07 | medium | **Partial** | `installWindow` *was* the effective period, but the name hid that for `as_of` offers. Program-filing dates (DPU orders) aren't needed by any v1 rule. | Renamed `installWindow` → **`effective`**. `dateBasis` says whether the install date or today is compared. Matches CONTRIBUTING.md principle 3's wording. |
| 08 | high | **Partial** (Qiao: only where a rule exists) | Searched every saved official page. No relative "N days after installation" deadline exists in the v1 programs. The heat pump "pre-verification form" is optional ("you can complete"). **The HEAT Loan does have a pre-approval step:** an Authorization Form, then lender approval, then the lender's check is signed over to the contractor. | HEAT Loan gets an `action` prerequisite: "Get loan approval before you pay the contractor." No relative-deadline field. |
| 09 | high | **Accept** | Correct: a confirmation whose `when` is unknown jumped straight to `potential`, skipping a question the user could answer. | Precedence written down: `not_eligible` > `needs_info` > `potential` > `eligible`. A confirmation whose `when` is unknown makes the result `needs_info` with those facts as questions. Test added. |
| 10 | medium | **Accept** | Fair. | Schema §3 now separates them. Sequence edges order measures in the roadmap; prerequisites are offer-specific steps. |
| 11 | low | **Partial** | Income *tables* are deterministic. But Mass Save publishes area-specific Enhanced limits we don't have ("Enter your zip code to find the household income limits specific to your area"). | Wording fixed: the statewide table is a deterministic check. The confirmation is only about the local limit we can't see. |
| 12 | high | **Partial** | Already handled in the plan: `FACT_PATHS` registry; `getFact` throws on unknown paths; `findDataProblems` rejects them in data. The schema doc didn't mention it. | Documented in schema §2. No code change. |
| 13 | high | **Partial** | `missing` already existed per result. The point about other units is real: Maria can't answer unit 1's fuel. | `questions` become `{ fact, unitId, about: 'own' \| 'other_unit' \| 'building' \| 'household' }`. The UI can then route "other unit" questions to a neighbour or landlord message. No role table. |
| 14 | critical | **Accept** | **Verified:** the merged `rules-schema.md` uses `Benefit` and `Measure` but defines neither. They exist only in the plan's Zod code. | Both are defined in schema §1, matching the plan. |
| 15 | medium | **Partial** | Showing every ineligible program would be noise. | `navigate` returns `evaluated` (everything, for tests and audit) and `shown` (eligible, potential, needs_info, plus `not_eligible` **only** when a realistic change exists). |

## Not changed, deliberately

- No account identity, households[], ratios, grandfathering selectors or relative
  deadlines. No sourced v1 rule needs them.
- The heat pump account-holder question stays a confirmation until Mass Save answers
  (outreach §3b).
