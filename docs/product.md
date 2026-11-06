# Product definition (draft v1)

Status: v0 was written from the planning conversation on 2026-11-06. v1 applies the
Checkpoint A decisions from the same day (see `docs/review-notes.md` and
`docs/decisions.md`). Every statement is tagged **[Decided]**, **[Proposed]** or
**[Open]** (see `CONTRIBUTING.md`).

Working name: **[Open]**. Step 5 proposes 3–5 names.

---

## 1. Why this exists

**The gap.** Massachusetts has generous clean-energy and efficiency programs, but they are
hard to navigate. In January 2025 MassCEC launched the *Home Modernization Navigator*: a
free service where residents book a call with a human navigator who explains bills,
programs and incentives. It prioritizes renters, rental property owners, low-income
households and non-English speakers, and names the owner/renter split incentive as a key
barrier. It started in Lowell and Springfield and added Chelsea, Lynn, Framingham and
Taunton in December 2025. MassCEC describes it as a pilot. [Decided — framing; facts
checked 2026-11-06, see review-notes item 2]

**Why it matters.** Low-income households spend a much larger share of income on energy
than other households. [Decided — use a Massachusetts figure from DOE's LEAD Tool, found in
Step 4. Fallback: ACEEE 2020 national *medians* (8.1% for households under 200% FPL vs 2.3%
for non-low-income, 2017 AHS data), labeled as national and dated.]

**Why existing tools miss it.** Generic solar calculators answer "is my roof sunny?" They
assume a homeowner, ignore Massachusetts programs, ignore who pays vs who saves, and treat
solar in isolation from weatherization and heating. [Decided]

**One-line story:** *Massachusetts is piloting human energy navigators in six cities. This
project asks how much of a navigator's knowledge can become software that anyone in the
state can use.* [Decided — reworded at Checkpoint A so it claims only what the evidence
supports]

## 2. Positioning

- Portfolio project, not a startup. Optimize for: a sharp problem, one flow that works
  end-to-end beautifully, a defensible technical core, visible product judgment, and at
  least one real user's feedback. [Decided]
- From "solar calculator" to "navigator": solar is one module; the core is **eligibility
  and sequencing**. [Decided]
- Massachusetts first; architecture lets other states add rules data later (not built in v1).
  [Decided]
- The product hands people off. Every plan ends with the real next contact (Mass Save,
  CAP agency, utility, or the MassCEC navigator in pilot cities) and a short note that the
  program, not this tool, decides eligibility. [Proposed]

## 3. Users

Core users: people in **Massachusetts 1–4 unit residential buildings**. [Decided]

The rules engine supports four roles. The v1 demo tells two stories: a **rental building**
(tenant + landlord) and a **condo building** (unit owners). [Decided]

| Role | Situation | What they need | In v1 demo |
|---|---|---|---|
| Tenant (e.g. Maria, 2nd floor of a triple-decker) | Doesn't control the building; may or may not pay for heat | Programs a renter can use alone (incl. community solar, income-eligible path), and a way to bring the landlord in | Yes (rental story) |
| Renting landlord (owns, doesn't live there) | Pays for upgrades, tenants may get the savings | Net cost after incentives, who benefits, how to arrange access with every unit | Yes (rental story) |
| Condo owner (unit in a 2–4 unit condo building) | Owns one unit; the building's discount depends on the other owners | "Units still needed" for the all-units insulation offer, messages to neighbors | Yes (condo story) |
| Owner-occupant landlord (lives on one floor) | Own unit and rental units are on different offers | Which offer applies to which unit, combined picture | Engine only |

Every unit records **who pays for heat** and **who pays for electricity** (tenant or
owner). These are asked, never guessed, and savings are assigned to whoever pays.
[Decided]

Assumption to validate: 2–4 unit buildings, including condo-converted triple-deckers,
are where split-incentive and coordination problems are sharpest. [Proposed — quantify
with MassGIS / assessor data in Step 4; check with real users]

## 4. The key insight: coordination, not arithmetic

The hard part in a small multifamily building is getting the right people to act. What
needs coordinating depends on who owns the building. Rules below come from the Mass Save
landlord page, read 2026-11-06; Step 3 verifies them in full before anything is encoded.

- **Condo building (2–4 units):** insulation is up to 100% off per unit if **all** eligible
  units participate, up to 75% if only some do; the unit must have a residential heating
  meter. The product shows "1 more unit agreeing moves insulation from 75% to 100% off"
  and generates messages to the other owners. [Decided — feature; Proposed — rule text
  until Step 3]
- **Rental building:** the landlord offer is 100% off insulation for the rental property
  (no all-units condition stated). Here the coordination is tenant → landlord ("there's a
  100%-off offer for this building") and landlord → tenants (assessment and installation
  access, scheduling). The product generates both messages. [Decided — feature; Proposed —
  rule text until Step 3]
- **Owner-occupied units** follow homeowner offers; the Residential Turnkey Solutions
  (health and safety barriers) offer covers renter-occupied units only. [Proposed — verify]

Coordination is the signature feature. [Decided]

## 5. v1 scope

**In v1** [Decided unless marked]
- Four roles in the rules engine; two demo stories (rental, condo)
- Address → building profile, shown to the user to confirm or fill gaps
- **The form is the only source of data for calculations.** An optional entry point lets
  the user describe their situation in a few sentences; the LLM pre-fills the form; the
  user reviews and confirms; only then does anything get calculated.
- Rules engine covering a small, verified set of programs (evidence in
  `docs/incentives-research.md`): Mass Save assessment + weatherization (landlord, condo,
  homeowner offers), **Designated Equity Communities (DEC)**, Income Eligible path (CAP
  agencies), **Enhanced (moderate-income) incentives**, air-source heat-pump rebates
  (2026 amounts and the announced 2027 change), HEAT Loan (owners only), community solar
  (SMART 3.0 discount floors; utility low-income programs), SMART 3.0 + net metering for
  rooftop ≤25 kW incl. credit allocation to other units, the **Massachusetts residential
  renewable energy income tax credit**, and MLP handling. [Decided 2026-11-06]
- Where a source leaves a rule unclear (e.g. which condo units count as "eligible", who
  applies for a heat pump rebate on a tenant-held account), the product says "up to" and
  names the assessment or program as the deciding step. It never resolves the ambiguity
  itself. [Decided 2026-11-06]
- Utility low-income community solar (e.g. Eversource ECSAP) enrolls by lottery from
  discount-rate customers. Tenants are told how to get on the discount rate, not to "sign
  up". [Decided 2026-11-06]
- **No federal tax credits.** §25C and §25D are not allowed for expenditures after
  2025-12-31 (P.L. 119-21). The FAQ explains this. [Decided]
- Rooftop solar module only for users who can install (Google Solar API, PVWatts fallback).
  It must say which meter(s) get the benefit, since each unit usually has its own meter.
  [Proposed — Step 3 verifies net-metering credit allocation]
- Ordered action plan with the reason for each step
- Coordination tools: tenant → landlord letter, landlord → tenants scheduling note,
  condo "units still needed" and messages to other owners
- All money as **low / mid / high scenarios** with confidence labels [Decided]
- LLM explains results and drafts messages; it never computes numbers or names programs
- FAQ, incl. why federal credits don't apply and what the tool can't decide
- A live demo with a few real, cached addresses

**Stretch (after the core flow works)** [Decided]
- Utility-bill reading (photo/PDF → usage, rate, utility). Until then, usage is entered as
  a monthly bill range or defaults to typical values with a wider range and lower
  confidence.

**Not in v1** (listed in README as future work, deliberately cut) [Decided]
- Municipal / nonprofit portfolio mode (batch CSV, ranking, heatmap)
- Multilingual output, PDF export, real application submission
- Self-built LiDAR roof modeling; detailed building heating-load simulation

Multilingual note: the navigator pilot prioritizes non-English speakers. The README says
openly that v1 is English-only, and user-facing strings live in one place so translation
can be added later. [Proposed]

**v1.5** [Proposed]
- Household energy-use model (quantile regression on NREL ResStock-type data) to narrow
  ranges; revisit Monte Carlo then

**v2 ideas** [Proposed]
- Portfolio mode
- Expose the rules engine as an MCP server so any AI agent can ask
  "which MA programs does this building qualify for?"

## 6. Architecture

```
User (address + role → structured form; optional free-text → LLM pre-fills form → user confirms)
        ↓
AI navigator agent — pre-fill, ask follow-ups, call tools, explain, draft messages
        ↓ calls tools                     ↑ returns results
Deterministic tool layer (all numbers computed here)
  ├─ Building data   parcel, electric + gas utility, roof
  ├─ Rules engine    eligibility, counterfactuals ("what would change the answer")
  ├─ Finance         low/mid/high scenarios, total household energy cost, split by who pays
  └─ Energy model    quantile regression (v1.5)
        ↑ reads
External data (Google Solar, PVWatts, MassGIS)   Rules data (JSON + source + verified date)
        ↓
Outputs: action plan · visual report · coordination messages
```
[Decided — shape. Proposed — specific services and libraries]

Design notes:
- Rules live in data files, separate from code. Policy changes = data edits + tests. [Decided]
- Unit-level and building-level eligibility are both first-class. [Decided]
- Some rules depend on other households' choices (all-units conditions). [Decided]
- Heat pumps raise electricity use while cutting oil/gas: finance must model total household
  energy cost. [Decided]
- The building profile stores `electric_utility`, `gas_utility` and `heating_fuel`
  separately; rules key off the ones they depend on. MLP towns are outside Mass Save for
  electric programs (the Mass Save landlord page says municipal utility customers are not
  part of the program). [Decided — data model; Proposed — exact MLP/gas rules until Step 3]
- Rules data handles change over time: `effective_from` / `effective_until`,
  `last_verified`, a staleness flag in the UI when `last_verified` is older than 90 days,
  and a test that fails if a shipped rule lacks `source_url` or is past `effective_until`.
  Programs changed mid-plan in 2025–2026 (federal credits ended, Mass Save heat-pump
  rebates revised, SMART 3.0). [Proposed — schema in Step 5]

## 7. Technical difficulties

| Difficulty | Treatment |
|---|---|
| Rules engine + counterfactual reasoning | Main technical showcase. Heavy tests incl. property-based. |
| Uncertainty propagation + total energy cost | Low/mid/high named scenarios in v1 [Decided]; Monte Carlo considered with the v1.5 model. |
| Keeping the LLM honest | Structured form is the only data source. LLM text uses slots (e.g. `{saving.mid}`, `{program:id}`) filled from tool results, so the LLM never types a number or program name. Second line of defense: validator that every number/program in output exists in tool results. An eval set. [Proposed — slots] |
| Sequencing (weatherize → heat pump, roof age → solar, panel capacity) | Dependency rules with explanations. |
| Address → building data fusion | Show and confirm; ask when unknown. |
| Incentive data accuracy | Biggest risk. Verify every rule before code. Checkpoint A already caught one misread rule. |
| LiDAR roof modeling, precise heating load | Out of scope. Use APIs / reference values. |

## 8. Visualizations

Each chart answers one question. All have text alternatives. [Decided — principle;
Proposed — specific set]

In the product:
1. **Building diagram**: floors, who lives there, who owns, who pays for heat, eligibility,
   who has agreed. In the condo story: "1 more unit → 100% off". Signature visual.
2. **Incentive waterfall**: total cost → minus each program (clickable source) → what you pay.
3. **Bill before/after**: 12 months, with a range band; labeled "estimated from typical
   usage" when the user didn't enter bills.
4. **Action roadmap**: ordered steps with cost, savings, who to contact.
5. **Roof sun map**: only for users who can install solar.

For the README / pitch:
1. **Navigator pilot coverage map**: the six pilot cities, labeled as a pilot, with other
   statewide help (Mass Save, CAP agencies) noted so the map doesn't imply "no help
   elsewhere". [Decided]
2. **Energy burden comparison**, Massachusetts figure from DOE LEAD preferred. [Decided]
3. **Original data analysis**: how many 2–4 unit buildings (and condo buildings) exist in
   MA, where, how many in EJ areas, how many outside navigator pilot cities. [Open — needs
   MassGIS work]
4. **Same person, two answers**: generic calculator vs this product for Maria.

## 9. Success criteria for v1 [Proposed]

1. The rules engine gives the right answer for a set of hand-written scenarios, each
   checked against the cited source.
2. The LLM eval set shows zero invented numbers or programs.
3. A WCAG 2.2 AA audit passes.
4. At least one real tenant, landlord or condo owner has tried it, and their feedback is
   written down.

## 10. Open questions for Phase 0

1. ~~Exact v1 program list~~ → answered in `docs/incentives-research.md` (Step 3). Remaining
   gaps are listed at the end of that file. Three questions go to Mass Save by email
   (`docs/outreach-drafts.md` §3).
2. ~~Eversource low-income community solar~~ → answered (auto-enrollment by lottery).
   National Grid and municipal programs are still open.
3. Data sources for address → parcel → unit count / condo status → electric + gas utility →
   EJ status, and their gaps (condos, mixed use). → Step 4
4. Google Solar API: pricing, quota, coverage for target MA cities; PVWatts as fallback. → Step 4
5. Is an NREL ResStock-type dataset practical for the v1.5 energy model? → Step 4
6. Stack choice. → Step 5
7. Working name. → Step 5
8. Real users: outreach to All In Energy / the navigator program and to a tenant or landlord
   near BC. Drafts in `docs/outreach-drafts.md`; Qiao sends them. [Decided — start now]
9. Massachusetts energy burden figure from DOE LEAD. → Step 4
10. Tenant concern that upgrades lead to rent increases. Energy Aligned Lease is
    descriptive only and doesn't address it; MA rent rules weren't researched. Product stays
    neutral. [Open — low priority]

## 11. Proposed stack

Next.js + TypeScript, MapLibre GL, Tailwind, a chart library with accessible output,
rules engine as a pure TypeScript package with its own tests, Vercel hosting, LLM via the
LLM API. [Proposed — Step 5 to confirm; consider Python for data analysis scripts]

## 12. Sources used in this draft

- MassCEC Home Modernization Navigator: https://www.masscec.com/program/home-modernization-navigator-program
- MassCEC expansion press release: https://www.masscec.com/press/masscec-expands-no-cost-service-help-more-residents-reduce-energy-costs-and-modernize-their
- Lynn joins the navigator pilot (Dec 2025): https://itemlive.com/2025/12/12/home-modernization-navigator-program-comes-to-lynn/
- Mass Save, landlords with 1–4 unit properties (read 2026-11-06): https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties
- IRS FAQ on OBBBA changes to §25C/§25D: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-act-obbb
- ACEEE national energy burden fact sheet (fallback statistic): https://www.aceee.org/sites/default/files/pdfs/ACEEE-01%20Energy%20Burden%20-%20National.pdf
- DPU order on low-income solar access (D.P.U. 24-104): https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access
- Energy burden and Eversource LMI community solar model: https://www.renewableenergyworld.com/solar/how-utilities-can-make-community-solar-work-for-low-income-customers/
- Community solar acquisition costs: https://pv-magazine-usa.com/2025/11/10/cap-agencies-make-good-partners-for-community-solar/
