# Independent Phase 0 review

Reviewer: independent review A. Date: 2026-11-06. Verdict: **not ready for Phase 1 as written**. The product and research have useful boundaries, but the implementation plan can return incorrect eligibility, cost attribution, and deadlines for ordinary cases. Resolve the blockers and have the lead verify the other findings before Checkpoint C. This review checks the merged schema only for consistency and evidence; schema findings are marked (CoI). It does not judge the design merge.

1. **Severity: blocker — An unverified condo assumption becomes a definitive exclusion (CoI).**<br>
   **Where:** `docs/phase-1-plan.md:2487`, `docs/phase-1-plan.md:2621`, `docs/phase-1-plan.md:2038`; `docs/schema/rules-schema.md:52`.<br>
   **What's wrong:** If a unit has a heating meter and has not agreed, the assumed predicate makes the all-units result `not_eligible`, even though Mass Save has not confirmed whether that unit counts. The confirmation only changes a `yes` result, so it cannot correct this exclusion or the resulting count of units needed.<br>
   **Evidence:** `docs/incentives-research.md:101` explicitly leaves the definition open; the predicate's note calls it a working assumption. This is an inference from the evaluator's `no` branch.<br>
   **Suggested fix:** Preserve an unknown/potential result whenever the answer depends on the unresolved definition, including negative outcomes and coordination counts; test both a metered nonparticipant that may be ineligible and an unmetered unit.

2. **Severity: blocker — A maximum discount becomes a near-zero cost promise (CoI).**<br>
   **Where:** `docs/phase-1-plan.md:2058`, `docs/phase-1-plan.md:2629`; `docs/schema/rules-schema.md:102`.<br>
   **What's wrong:** `nearZeroOutOfPocket` is true for any 100% benefit, including an offer expressly qualified as `up_to`. A condo offer with an unknown approved percentage therefore gets the same near-zero message as a fully covered cost.<br>
   **Evidence:** `docs/incentives-research.md:112` says to present these as up to a percentage with the assessment deciding; the condo JSON marks the offer `up_to`. The output follows directly from the condition on line 2058.<br>
   **Suggested fix:** Only use a near-zero message where full coverage of the relevant approved costs is established; otherwise retain “up to 100%” and name the deciding assessment. Add a test for an up-to offer.

3. **Severity: blocker — The payer split cannot attribute a fuel switch.**<br>
   **Where:** `docs/phase-1-plan.md:3182`, `docs/phase-1-plan.md:3211`, `docs/phase-1-plan.md:3142`.<br>
   **What's wrong:** A heat-pump switch returns one combined change, and `attributeToPayer` assigns the entire change to one payer. If the owner pays oil and the tenant pays electricity, the owner saves the fuel bill while the tenant incurs the new electricity bill; assigning the net to either person is wrong.<br>
   **Evidence:** `docs/product.md:53` requires both payers and assigns savings to whoever pays; the only payer test uses one heating-bill change. This is an inference from the functions and the two-payer example.<br>
   **Suggested fix:** Attribute the before fuel reduction and after electric increase separately, then derive each person's net and the household total. Test different, identical, and unknown payers.

4. **Severity: major — A past installation remains eligible after its application deadline (CoI).**<br>
   **Where:** `docs/phase-1-plan.md:2319`, `docs/phase-1-plan.md:2330`, `docs/phase-1-plan.md:2689`; `docs/schema/rules-schema.md:79`.<br>
   **What's wrong:** Selection checks the installation window but never compares `asOf` with `applicationDeadline`. A 2026 installation evaluated on 2027-03-01 can still be returned as eligible while the archived data remains available.<br>
   **Evidence:** The [Mass Save heat-pump page](https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps), checked 2026-11-06, says 2026 applications and documents must be received by 2027-02-28. `isRetired` is only a data-shipping check, not an evaluation check.<br>
   **Suggested fix:** Evaluate application timing separately from installation eligibility and report an expired deadline, while retaining historical rules for explanation. Test both sides of the deadline.

5. **Severity: major — Income limits do not expire with their heating season (CoI).**<br>
   **Where:** `docs/phase-1-plan.md:2497`, `docs/phase-1-plan.md:2659`, `docs/phase-1-plan.md:2668`; `docs/schema/rules-schema.md:33`.<br>
   **What's wrong:** Both 2026–27 income tables have no effective window, and their offers have `until: null`. In a later heating season the engine can confidently classify a household using old thresholds without triggering the retired-offer check.<br>
   **Evidence:** `docs/incentives-research.md:137` and `:155` label the values for the 2026–27 heating season; `findDataProblems` checks retirement only on offers (`docs/phase-1-plan.md:1554`).<br>
   **Suggested fix:** Verify the actual table effective dates; version or expire the tables and dependent offers, and return unknown/referral if no current table is verified. Test the season boundary.

6. **Severity: major — Source freshness ignores dependencies (CoI).**<br>
   **Where:** `docs/phase-1-plan.md:2339`, `docs/phase-1-plan.md:1433`; `docs/schema/rules-schema.md:27`.<br>
   **What's wrong:** `staleOffers` checks only the offer's own sources. A newly checked offer can use an old income table, DEC list, predicate or cap without a stale warning, even though that old data changes its result.<br>
   **Evidence:** `navigate` computes staleness from `o.sources` only; income and DEC inputs are loaded separately at lines 2325–2327. `docs/product.md:166` proposes a warning after 90 days.<br>
   **Suggested fix:** Include all data actually used to evaluate a result in its freshness calculation, or expose separate freshness warnings for those dependencies; test a fresh offer with a stale table.

7. **Severity: major — The plan drops confidence and its reason from results.**<br>
   **Where:** `docs/phase-1-plan.md:246`, `docs/phase-1-plan.md:2014`, `docs/phase-1-plan.md:3317`.<br>
   **What's wrong:** Assumptions have confidence, but `quantitiesFromAssumptions` reduces them to `Range`, and `OfferResult.value` carries only numbers. A caller cannot display why the resulting estimate is low or medium confidence.<br>
   **Evidence:** `CONTRIBUTING.md` principle 2 requires every estimate to carry a confidence label saying why; the planned `Range` and `OfferResult` have no confidence or rationale.<br>
   **Suggested fix:** Carry confidence and its explanation with each estimate through the calculation and output, with a documented rule for combining inputs. Test a mixed-confidence result.

8. **Severity: major — Heat-pump account guidance and HEA requirement misread their sources.**<br>
   **Where:** `docs/phase-1-plan.md:2696`, `docs/phase-1-plan.md:2712`; `docs/incentives-research.md:61`, `docs/incentives-research.md:218`.<br>
   **What's wrong:** The whole-home rebate unconditionally tells users to complete an HEA, citing the HEAT Loan page, and its rental confirmation cites an electric account even for gas replacement. This can send a gas customer to the wrong account and adds an unsupported step for a non-loan rebate.<br>
   **Evidence:** On 2026-11-06 the [financing page](https://www.masssave.com/en/residential/rebates-offers-services/financing) places the HEA requirement under HEAT Loan participation; the [heat-pump page](https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps) lists three ways to meet weatherization and specifies a gas account for gas replacement, an electric account for oil/propane/resistance.<br>
   **Suggested fix:** Make the HEA requirement conditional on the verified rebate or financing path, and give account guidance by fuel while retaining the unresolved applicant question. Add gas and post-2000/no-loan scenarios.

9. **Severity: major — The finance and rules plan omits committed v1 cases.**<br>
   **Where:** `docs/phase-1-plan.md:2723`, `docs/phase-1-plan.md:2775`, `docs/product.md:94`; `docs/incentives-research.md:23`.<br>
   **What's wrong:** Task 13 includes whole/partial heat-pump and SMART offers, but no Basic or Enhanced heat-pump offer, nor a net-metering or meter-allocation rule. A household replacing an existing heat pump gets neither whole nor partial, while the Basic path is missing; solar users cannot obtain the promised meter-level picture.<br>
   **Evidence:** The [Mass Save heat-pump page](https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps), checked 2026-11-06, lists Basic and income-based Enhanced offers and identifies existing heat-pump replacements as a Basic example. `docs/product.md:94` decides heat-pump rebates and net-metering allocation are in v1.<br>
   **Suggested fix:** Add sourced, tested paths for the committed cases, or explicitly mark them as an open Phase 1/next-phase deliverable for Qiao's decision; do not silently narrow the decided scope.

10. **Severity: major — Per-account caps are grouped by unit, not account (CoI).**<br>
    **Where:** `docs/phase-1-plan.md:2127`, `docs/phase-1-plan.md:2546`; `docs/schema/rules-schema.md:106`.<br>
    **What's wrong:** `applyCaps` groups every cap by `unitId`, regardless of its declared scope. Two units sharing one account can each receive the full per-account cap in the plan, and a customer-lifetime loan cap is also treated as a unit cap.<br>
    **Evidence:** The input schema at `docs/phase-1-plan.md:436` has no account identifier; the [Mass Save heat-pump page](https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps), checked 2026-11-06, states a per-account limit. The incorrect grouping is an inference from `byUnit`.<br>
    **Suggested fix:** Ask or represent the relevant shared account/customer identity where needed; if unknown, do not claim an aggregate cap has been applied. Test shared and separate accounts.

11. **Severity: minor — The plan's energy-burden script accepts bad rows as zero.**<br>
    **Where:** `docs/phase-1-plan.md:3438`.<br>
    **What's wrong:** `_f` silently turns a malformed or missing data value into zero. A changed LEAD file can therefore produce a plausible but incorrect published statistic instead of a visible failure.<br>
    **Evidence:** Task 17's `_f` catches both `TypeError` and `ValueError` and returns `0.0`; `docs/product.md:33` relies on the result.<br>
    **Suggested fix:** Identify documented missing-value encodings explicitly and reject unexpected values with row and field context; test a malformed number.

## Checked and found consistent

- On 2026-11-06, checked at least seven Task 13/research claims against the live [Mass Save heat-pump page](https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps): 2026 whole-home rate and cap; 2027 whole-home rate and cap; 2026 application deadline; winter occupancy; installer network; cold-climate equipment; and three weatherization alternatives. These match the cited facts, subject to finding 8's interpretation of HEA.
- On the same date, the live [DEC page](https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities) supports no income verification, 100% recommended weatherization, landlord approval, and the delivered-fuel/electric-resistance and renter-burden conditions for rental heat pumps. The [HEAT Loan page](https://www.masssave.com/en/residential/rebates-offers-services/financing) supports the $25,000 maximum, homeowner requirement, and specified municipal-electric/gas-sponsor exception.
- The plan separates installation windows from paperwork deadlines in its data structure, and its heat-pump 2026 and 2027 whole-home windows do not overlap (`docs/phase-1-plan.md:2689`, `:2729`). Finding 4 concerns use of the deadline, not its storage.
- The form-first boundary, explicit nulls for unknown unit facts, and separation of electric and gas utility are present in the product and plan (`docs/product.md:91`, `docs/phase-1-plan.md:436`).

## Limits

This is a document and planned-code review; no Phase 1 package exists here to compile or run. The web tool returned 403 for mass.gov and could not open the older Mass Save landlord URL, so the SMART, statute and condo primary-source quotes were not independently reverified in this pass. The remaining policy, figures, dependencies, dates, and every planned test were not exhaustively verified; recheck sources when implementing as Task 13 directs.

## Quotes requiring independent rechecking

The following quotes or quoted claims are transcribed from the existing research and Task 13, not verified independently in this review. The web tool returned 403 for the three mass.gov pages below and could not access the older Mass Save landlord URL. Reopen each primary source and check the wording, context, dates, and applicability before encoding the corresponding rule. Other unverified sources may remain outside this list; it covers the specific failed page requests in this review.

- [Mass Save landlord and condo offers](https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties): “An instant incentive of 100% off insulation upgrades for your rental property”; condo “Up to 100%” if all eligible units participate, or “up to 75%” if only some participate; and “Unit must have a residential heating meter.” See `docs/incentives-research.md:87`, `:99`, and `docs/phase-1-plan.md:2606`, `:2632`–`:2633`.
- [DOER SMART 3.0 program details](https://www.mass.gov/info-details/smart-30-program-details): the PY2026 small-system rate of “$0.03/kWh”, the low-income rate of “$0.06/kWh”, and the January 1–December 31 application window. See `docs/incentives-research.md:305` and `docs/phase-1-plan.md:2783`–`:2784`, `:2796`.
- [M.G.L. c. 62 § 6(d)](https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6): the principal-residence requirement and a credit of “fifteen per cent of the net expenditure” or $1,000, whichever is less. Also verify the research's three-year carryover and joint-ownership statements and the open sunset date. See `docs/incentives-research.md:346` and `docs/phase-1-plan.md:2479`, `:2824`.
- [DPU low-income solar access order announcement](https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access): ECSAP has “a simplified billing offering at no cost and an easy enrollment plan” and a target of $420 in annual savings for each enrolled low-income customer. See `docs/incentives-research.md:278` and `docs/phase-1-plan.md:2473`, `:2817`.

The separate 225 CMR regulation PDF cited for SMART's 20-year term and community-solar discount floors was not opened in this review either; its claims in `docs/incentives-research.md:255` and `:313` and `docs/phase-1-plan.md:2785`, `:2803`, `:2810` also require independent verification against [the regulation](https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download).
