# Review notes — Phase 0, Step 1

Reviewer: Qiao Long. Date: 2026-11-06. Reviewed: `docs/product.md` draft v0.

How to read this: each item has a **target** (section of `product.md`), the **proposed
change**, the **reason**, and the **basis**, which is either *Evidence* (with a source I
read on 2026-11-06) or *Inference* (my reasoning, not yet checked). Items touching
**[Decided]** statements are proposals only. Nothing in `product.md` has been edited yet.

Step 1 used quick checks only. Step 3 does the full verification of every program against
its official source. Figures below that come from secondary sources are marked as such and
are not to be encoded.

---

## A. Problems with [Decided] items (need Qiao's decision)

### 1. The signature example is the wrong rule for the core personas  ⚠ most important
- **Target:** §4 "key insight", and the signature feature "1 more unit → 100% off".
- **Finding:** On the Mass Save landlord page, the "up to 100% off if **all** eligible units
  in a 2–4-unit building participate, up to 75% if only some do" rule appears under the
  **Condo Owners** heading. The **heating meter** footnote belongs to that condo offer.
  For landlords, the page says "An instant incentive of 100% off insulation upgrades for
  your rental property", and nothing there depends on every unit taking part. The sentence
  "valid for renter-occupied units in buildings with 1–4 units only; owner-occupied units
  do not qualify" is about the **Residential Turnkey Solutions** (health and safety
  barriers) offer. It does not cover the whole landlord offer.
- **Evidence:** Raw page text of
  https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties
  (fetched 2026-11-06), sections "landlord offer", "Residential Turnkey Solutions", "Condo
  Owners".
- **Why it matters:** The draft's main story, a tenant and landlord in a triple-decker
  getting every unit to agree to reach 100% off, doesn't match the published rule. In a
  renter-occupied building the landlord already gets 100% off insulation.
- **Proposed change:** Keep coordination as the signature feature, but build it on the
  coordination problems that actually exist:
  - **Condo triple-deckers / 2–4 unit condo buildings:** the all-units 75%→100% rule
    applies here exactly as described. Condo-converted triple-deckers are common in
    Boston, Somerville and Cambridge *(inference — quantify with MassGIS / assessor data
    in Step 4)*. This means adding a **condo owner** persona (see item 8).
  - **Rental buildings:** the tenant can't act alone. The landlord has to authorize work,
    and every unit needs access for the assessment and installation. The messages are
    "tenant → landlord: here's a 100%-off offer you're missing" and
    "landlord → tenants: scheduling and access".
  - **Owner-occupant landlords:** the owner's unit and the rental units are on different
    offers. Step 3 must confirm whether the owner's unit gets the standard homeowner
    insulation incentive.
- **Decision needed:** (a) Do you accept this reframing? (b) Do we add condo owners as a
  fourth persona?

### 2. "Human navigators can't scale" is our inference, not the state's claim
- **Target:** §1 one-line story ("the state proved … human navigators can't cover the state").
- **Finding:** The six-city list is correct. MassCEC launched in Lowell and Springfield and
  added Chelsea, Lynn, Framingham and Taunton in December 2025. But MassCEC describes this
  as a pilot with possible expansion. It doesn't say human navigators can't scale.
- **Evidence:** MassCEC expansion press release (URL in `product.md` §11); local coverage,
  e.g. https://itemlive.com/2025/12/12/home-modernization-navigator-program-comes-to-lynn/ ;
  goclean.masscec.com lists the cities.
- **Proposed change:** Reword to something we can defend: "The state is piloting human
  energy navigators in six cities. This project asks how much of that navigator's
  knowledge can be put in software that anyone in the state can use." Keep the story;
  drop the claim.

### 3. The "coverage gap map" pitch visual could overstate the gap
- **Target:** §8 README visual 1.
- **Reason:** Many places outside the six navigator cities still have help: Mass Save
  Energy Specialists, Community Action Program (CAP) agencies for income-eligible
  households, and city programs. A map that shows "six cities vs nothing" would
  misrepresent that. *(Inference; Step 4 can list statewide services.)*
- **Proposed change:** Keep the map, but label it as navigator *pilot* coverage and show
  that other services exist.

### 4. "Utility territory" needs to be two things: electric and gas
- **Target:** §6 design notes, §4/§5 rules.
- **Reason:** Mass Save sponsors include both electric and gas utilities. Heating
  incentives depend on the heating fuel and the gas utility, and a home can be in a
  municipal light plant (MLP) electric town while still having an investor-owned gas
  utility. The landlord page says municipal utility customers "are not part of the
  program". Taunton, one of the six navigator cities, is served by Taunton Municipal
  Lighting Plant (TMLP), which runs its own navigator pilot.
- **Evidence:** Mass Save landlord page ("Municipal utilities" note); TMLP page
  https://www.tmlp.com/329/TMLP-Home-Modernization-Navigator-Pilot- .
  The electric/gas split is *inference*. Step 3 will verify it.
- **Proposed change:** The building profile stores `electric_utility` and `gas_utility`
  separately, plus `heating_fuel`. Rules key off whichever ones they depend on. This turns
  the §6 [Proposed] MLP note into a design rule.

### 5. "Who pays for heat" is missing, and it's central to the split incentive
- **Target:** §3 personas, §6 finance.
- **Reason:** Who benefits from a weatherization or heat-pump upgrade depends on who pays
  the heating bill and who pays the electric bill: tenant, landlord, or each separately.
  Heat in a triple-decker can be landlord-paid or tenant-paid. The draft assumes the
  tenant "pays the bills". *(Inference.)*
- **Proposed change:** Add `heat_paid_by` and `electric_paid_by` per unit as intake fields
  (asked, not guessed). The finance module assigns savings to whoever pays. This is the
  quantitative heart of the split-incentive story.

---

## B. [Proposed] items, each checked against reality

### 6. Energy burden statistic (§1) — **change**
- **Finding:** "8.1% vs 2.3%" comes from ACEEE's 2020 national report, based on 2017
  American Housing Survey data. 8.1% is the *median* for households under 200% of the
  federal poverty level, and 2.3% is the median for non-low-income households. The
  figures are national, not Massachusetts, and roughly eight years old.
- **Evidence:** ACEEE national fact sheet
  https://www.aceee.org/sites/default/files/pdfs/ACEEE-01%20Energy%20Burden%20-%20National.pdf
  (fetched via search 2026-11-06).
- **Proposed change:** If we keep it, write "median" and cite "ACEEE 2020, 2017 data". In
  Step 4, check whether DOE's LEAD Tool gives a Massachusetts figure. A local number makes
  a stronger pitch.

### 7. Mass Save rental rules (§4) — **change** (see item 1)
- Also from the same page: landlords get no-cost targeted air sealing, 0% financing, and
  extra help with barriers such as knob-and-tube wiring. If ≥50% of tenants are
  income-eligible, the building may qualify for the Income Eligible Multi-Family Retrofit
  path. The page also mentions an **Energy Aligned Lease**. All of these should go into
  Step 3.

### 8. Users (§3): "assumption that 2–4 unit buildings are where coordination is sharpest" — **keep, extend**
- Keep the assumption and still quantify it in Step 4.
- Add a **condo owner (2–4 unit condo building)** persona, because that is where the
  all-units rule actually applies (item 1).
- *Inference:* ownership type can be read from assessor/MassGIS land-use codes (condo vs
  2-family vs 3-family). Step 4 confirms.

### 9. v1 program list (§5) — **change**
- **Federal tax credits:** §25C (energy-efficient home improvements, incl. heat pumps) and
  §25D (residential clean energy, incl. owner-installed rooftop solar) are not allowed for
  expenditures made after 2025-12-31. This comes from the One Big Beautiful Bill Act, P.L.
  119-21, 2025-07-04. So v1 should **not** include either credit for new 2026+ projects.
  *Evidence:* IRS FAQ
  https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-act-obbb .
  *Open for Step 3:* whether third-party-owned residential solar (lease/PPA, claimed by
  the owner under §48E) still affects pricing for our users, and on what timeline.
- **SMART:** SMART 3.0 is live. Program Year 2026 opened 2026-01-02, and DOER has a draft
  PY2027 report (Oct 2026). Secondary sources disagree on the residential payment term
  (10 vs 20 years). *Evidence (secondary):*
  https://www.masscec.com/blog/unlocking-solar-incentives-your-guide-massachusetts-smart-30-program ,
  https://www.solarpowerworldonline.com/2026/06/explained-massachusetts-smart-program-changes-in-2026/ .
  Step 3 must use DOER's own documents.
- **Heat-pump rebates:** amounts changed for 2026 after the 2025–2027 plan was cut back.
  Secondary sources say the whole-home rebate dropped from $10,000 to $8,500, and a new
  "basic" tier was added. These numbers come from aggregator sites and are **not** to be
  encoded. *(Evidence, secondary:* https://greennewton.org/resources/heat-pump-incentives-2026 *.)*
  This shows that the rules data has to handle **mid-plan changes**. See item 15.
- **Add to the v1 list:** the **income-eligible** path (Mass Save income-eligible programs,
  delivered through CAP agencies). This fits the equity principle best: for a low-income
  tenant, it is often the most valuable route. *(Inference; Step 3 verifies thresholds.)*
- **Proposed v1 list for Step 3 to verify:** Mass Save assessment + weatherization
  (renter/landlord, condo, homeowner), income-eligible path, Mass Save heat-pump rebates,
  community solar (incl. low-income), SMART 3.0 + net metering for rooftop, MLP exclusion
  handling.

### 10. Rooftop solar on a multi-meter building (§5) — **flag**
- **Reason:** In a triple-decker each unit usually has its own electric meter. Rooftop
  solar output goes to one account unless net-metering credits are allocated to other
  accounts. So "who benefits from the roof" is its own split-incentive problem.
  *(Inference; Step 3 verifies MA net-metering credit allocation rules.)*
- **Proposed change:** Add to the Step 3 checklist. The solar module must say which
  meter(s) benefit.

### 11. Community solar for tenants (§5, Open Q2) — **partly answered**
- **Finding:** DPU approved Eversource's Community Solar Access Program (ECSAP), a
  low-income community shared solar offering with simplified billing at no cost, in
  D.P.U. 24-104 (2024). Reports say a 2025 law requires consolidated billing for
  low-income community shared solar.
- **Evidence:** https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access ;
  Eversource community solar page
  https://www.eversource.com/residential/save-money-energy/clean-energy-options/solar-energy/community-solar ;
  the 2025 law claim is from a secondary source (Solstice) and is still unverified.
- **Next:** Step 3 reads the DPU order, finds out whether ECSAP is enrolling now, and
  checks the National Grid equivalent.

### 12. Conversational intake agent (§5) — **change to: form-first, LLM explains**
- **Reason:** The intake asks a small, fixed set of things: address, role, unit count,
  who pays for heat, fuel, income band. A short structured form, with the LLM asking
  follow-up questions only where data is missing or ambiguous, is easier to test, easier
  to make accessible (principle 5), and easier to keep honest (principle 1). *(Inference.)*
  The LLM still does the parts it's good at: explaining results, answering "why?", and
  drafting the coordination messages.
- **Proposed change:** v1 = structured intake + LLM explanation/messages. Free-form chat
  intake becomes a stretch goal.

### 13. Utility-bill reading (§5) — **move to stretch / v1.5**
- **Reason:** It adds the biggest privacy surface (principle 7: account numbers,
  addresses), needs a security review before launch, and the core flow works without it.
  Usage can be entered as a monthly bill range, or default to typical values with a wider
  range and a lower confidence label. *(Inference.)*
- **Dependency to note:** the "bill before/after" chart (§8) then uses entered or typical
  usage. That's fine as long as the confidence label says so.

### 14. Uncertainty method (§7, [Open]) — **propose low/mid/high scenarios for v1**
- **Reason:** Three named scenarios can be explained in plain language ("if prices stay
  high…"), tested by hand, and shown in a chart's text alternative. Monte Carlo adds a
  distribution we can't calibrate without the v1.5 energy model. *(Inference.)*
  Revisit Monte Carlo in v1.5.

### 15. Rules data must handle change over time — **strengthen**
- **Reason:** In 2025–2026 alone, federal credits ended, Mass Save heat-pump rebates
  changed in the middle of the plan, and SMART moved to 3.0. Principle 3 already asks
  for `effective_from/until` and `last_verified`. Add:
  - a staleness rule: if `last_verified` is older than N days (proposal: 90), the UI marks
    the rule "may be out of date — check source";
  - a test that fails if any shipped rule has no `source_url` or is past its
    `effective_until`.
- Goes into the Phase 1 schema (Step 5).

### 16. Keeping the LLM honest (§7) — **strengthen**
- **Proposed change:** The LLM writes text with **slots**, e.g. `{saving.mid}` and
  `{program:masssave_insulation}`. The app fills those from tool results, so the LLM never
  types a number or a program name directly. The existing "check every number" validator
  stays as a second line of defense. *(Inference — design proposal, Step 5.)*

### 17. Architecture shape / stack (§6, §10) — **defer to Step 5**
No problems found at this level. The stack is confirmed in Step 5.

### 18. v1.5 energy model, v2 ideas (§5) — **keep as is**; Open Q5 is answered in Step 4.

---

## C. Missing from the draft

### 19. Tenant risk after upgrades
Tenants may worry that an upgrade leads to a rent increase. Messages to landlords and
explanations to tenants should address this honestly. Mass Save's **Energy Aligned Lease**
(mentioned on the landlord page) may be relevant, so Step 3 should read it. *(Inference.)*

### 20. "Not advice" and the hand-off
Every plan should end with the real next contact (Mass Save number/link, CAP agency,
utility, or the MassCEC navigator in the six pilot cities) and a short disclaimer that
eligibility is decided by the program, not by us. *(Inference; supports principle 4.)*

### 21. Success criteria for v1
The draft has no definition of "done". Proposal:
(a) the rules engine gives the right answer for N hand-written scenarios checked against
sources;
(b) the LLM eval set has zero invented numbers or programs;
(c) WCAG 2.2 AA audit passes;
(d) at least one real tenant or landlord has tried it and their feedback is written down.

### 22. User conversations need to start early (Open Q8)
If the first real user is only consulted at the end, item 1 shows how far the product can
drift from reality. Proposal: Qiao contacts All In Energy, which partners on the MassCEC
navigator, during Phase 0/1. I draft the outreach message for Qiao to send.

### 23. Multilingual tension (note, not a change)
The navigator pilot prioritizes non-English speakers, and v1 excludes multilingual
output (a [Decided] item; I'm not asking to change it). The README should say this
openly. The code should keep user-facing strings in one place so translation can be
added later without restructuring. *(Inference.)*

---

## D. How each [Open] question gets answered

| # | Open question | Where | How |
|---|---|---|---|
| 1 | v1 program list | Step 3 | Review B reads official pages and PDFs. Candidate list in item 9 |
| 2 | Eversource low-income community solar | Step 3 | Read D.P.U. 24-104 order, check current enrollment (item 11) |
| 3 | Address → parcel → utility → EJ sources | Step 4 | MassGIS layers, assessor data, utility territory maps |
| 4 | Google Solar API pricing/coverage | Step 4 | Official pricing page, test 3 MA addresses if a key is available |
| 5 | ResStock-type dataset | Step 4 | NREL OEDI data format/size/license; short verdict |
| 6 | Stack | Step 5 | Confirm with reasons |
| 7 | Name | Step 5 | 3–5 options |
| 8 | Who to talk to | Now → Qiao | Item 22; I draft outreach |
| §7 | Uncertainty method | Item 14 | Proposed: scenarios in v1 |
| §8 | Original MassGIS analysis | Step 4 | Check data availability first |

---

## Decisions needed from Qiao at Checkpoint A

1. Reframe the signature feature around real coordination problems, and add a condo owner
   persona (items 1, 8)?
2. Reword the one-line story and the coverage-map label (items 2, 3)?
3. Add electric/gas utility split and "who pays for heat/electric" to the core model
   (items 4, 5)?
4. v1 scope: form-first intake with LLM explanations; bill reading moved to stretch;
   scenario ranges (items 12–14)?
5. Add the income-eligible path to the v1 program list; drop federal tax credits
   (item 9)?
6. Start contacting a real user / All In Energy now (item 22)?
