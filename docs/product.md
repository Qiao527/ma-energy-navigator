# Product definition (draft v0)

Status: draft written from the planning conversation on 2026-11-06. Every statement is
tagged **[Decided]**, **[Proposed]** or **[Open]** (see `CONTRIBUTING.md`). Phase 0 exists to
challenge the [Proposed] items and answer the [Open] ones.

Working name: **[Open]** — propose 3–5 names in Phase 0.

---

## 1. Why this exists

**The gap.** Massachusetts has generous clean-energy and efficiency programs, but they are
hard to navigate. The state itself recognized this: in January 2025 MassCEC launched the
*Home Modernization Navigator*, a free service where residents book a call with a human
navigator who explains bills, programs and incentives. It prioritizes renters, rental
property owners, low-income households and non-English speakers, and names the
owner/renter split incentive as a key barrier. As of late 2025 it covered six cities
(Lowell, Springfield, Chelsea, Lynn, Framingham, Taunton) because human navigators don't
scale. [Decided — framing; facts to re-verify]

**Why it matters.** Households under 200% of the federal poverty level spend on average
about 8.1% of income on energy, versus 2.3% for other households. [Proposed — re-verify
source and date before using in the README]

**Why existing tools miss it.** Generic solar calculators (e.g. Google Sunroof) answer
"is my roof sunny?" They assume a homeowner, ignore Massachusetts programs, ignore who pays
vs who saves, and treat solar in isolation from weatherization and heating. [Decided]

**One-line story:** *The state proved people need energy navigators, but human navigators
can't cover the state. This project turns the navigator's knowledge into a product.*
[Decided]

## 2. Positioning

- Portfolio project, not a startup. Optimize for: a sharp problem, one flow that works
  end-to-end beautifully, a defensible technical core, visible product judgment, and at
  least one real user's feedback. [Decided]
- From "solar calculator" to "navigator": solar is one module; the core is **eligibility
  and sequencing**. [Decided]
- Massachusetts first; architecture lets other states add rules data later (not built in v1).
  [Decided]

## 3. Users

Core users: people in **Massachusetts 1–4 unit residential buildings**. [Decided]

| Persona | Situation | What they need |
|---|---|---|
| Tenant (e.g. Maria, 2nd floor of a triple-decker) | Pays the bills, doesn't control the building | Programs a renter can use alone (incl. community solar), and a way to ask the landlord |
| Renting landlord (owns, doesn't live there) | Pays for upgrades, tenants get the savings | What it costs net of incentives, who benefits, how to get all units on board |
| Owner-occupant landlord (lives on one floor) | Mixed: own unit and rental units follow different rules | Which rules apply to which unit, and the combined picture |

Assumption to validate: triple-deckers / 2–4 unit buildings are where the split incentive
and coordination problems are sharpest. [Proposed — quantify with MassGIS parcel data and
check with at least one real tenant or landlord]

## 4. The key insight: coordination, not arithmetic

Example rules from Mass Save's 1–4 unit landlord offer (to be re-verified before encoding):
the rental offer applies to renter-occupied units only (owner-occupied units don't qualify);
insulation can reach 100% off when **all** eligible units in a 2–4 unit building
participate, versus up to 75% per unit when only some do; a residential heating meter is
required. [Proposed — verify against the official page]

So in a triple-decker the hard part is getting every household to agree. The product
should show "1 more unit agreeing moves insulation from 75% to 100% off" and generate the
messages that make that happen. This is the signature feature. [Decided]

## 5. v1 scope

**In v1** [Decided unless marked]
- Three roles: tenant, renting landlord, owner-occupant landlord
- Address → building profile (shown to the user to confirm/fill gaps)
- Rules engine covering a small, verified set of programs: Mass Save assessment and
  weatherization, heat-pump rebates, community solar, rooftop solar + net metering
  [Proposed — final list depends on Phase 0 verification]
- Rooftop solar module only for users who can install (Google Solar API, PVWatts fallback)
- Ordered action plan with the reason for each step
- Coordination tools: letter to landlord, explainer for each tenant, "units still needed"
- All money as ranges with confidence labels
- Conversational intake agent (LLM routes to deterministic tools) [Proposed]
- Utility-bill reading (photo/PDF → usage, rate, utility) [Proposed]
- A live demo with a few real, cached addresses

**Not in v1** (listed in README as future work, deliberately cut) [Decided]
- Municipal / nonprofit portfolio mode (batch CSV, ranking, heatmap)
- Multilingual output, PDF export, real application submission
- Self-built LiDAR roof modeling; detailed building heating-load simulation

**v1.5** [Proposed]
- Household energy-use model (quantile regression on NREL ResStock-type data) to narrow ranges

**v2 ideas** [Proposed]
- Portfolio mode
- Expose the rules engine as an MCP server so any AI agent can ask
  "which MA programs does this building qualify for?"

## 6. Architecture

```
User (address + role / natural language / utility bill)
        ↓
AI navigator agent — understand, ask follow-ups, call tools, explain
        ↓ calls tools                     ↑ returns results
Deterministic tool layer (all numbers computed here)
  ├─ Building data   parcel, utility territory, roof
  ├─ Rules engine    eligibility, counterfactuals ("what would change the answer")
  ├─ Finance         ranges, total household energy cost (not electricity only)
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
- Municipal light plant towns are outside Mass Save; utility territory changes which rules
  apply. [Proposed — verify]

## 7. Technical difficulties

| Difficulty | Treatment |
|---|---|
| Rules engine + counterfactual reasoning | Main technical showcase. Heavy tests incl. property-based. |
| Uncertainty propagation + total energy cost | Low/mid/high scenarios or Monte Carlo. [Open — which] |
| Keeping the LLM honest | Structured inputs only; check every number in output exists in tool results; check no unknown programs; an eval set. |
| Sequencing (weatherize → heat pump, roof age → solar, panel capacity) | Dependency rules with explanations. |
| Address → building data fusion | Show and confirm; ask when unknown. |
| Incentive data accuracy | Biggest risk. Verify every rule before code. |
| LiDAR roof modeling, precise heating load | Out of scope. Use APIs / reference values. |

## 8. Visualizations

Each chart answers one question. All have text alternatives. [Decided — principle;
Proposed — specific set]

In the product:
1. **Building diagram** — floors, who lives there, eligibility, who has agreed;
   "1 more unit → 100% off". Signature visual.
2. **Incentive waterfall** — total cost → minus each program (clickable source) → what you pay.
3. **Bill before/after** — 12 months, with a range band.
4. **Action roadmap** — ordered steps with cost, savings, who to contact.
5. **Roof sun map** — only for users who can install solar.

For the README / pitch:
1. **Coverage gap map** — the six navigator cities vs the rest of the state.
2. **Energy burden comparison.**
3. **Original data analysis** — how many 2–4 unit buildings exist in MA, where, how many in
   EJ areas, how many outside navigator coverage. [Open — needs MassGIS work]
4. **Same person, two answers** — generic calculator vs this product for Maria.

## 9. Open questions for Phase 0

1. Exact v1 program list, each verified against its official source (incl. current SMART
   status, net metering, any state or federal tax credits for residential solar/heat pumps
   — federal rules changed in 2025; do not assume).
2. Is Eversource's low-income community solar model (subscriber gets an on-bill credit at no
   cost) approved in MA, and how does it change what we tell tenants?
3. Data sources for address → parcel → unit count → utility territory → EJ status, and their
   gaps (condos, mixed use).
4. Google Solar API: pricing, quota, coverage for target MA cities; PVWatts as fallback.
5. Is an NREL ResStock-type dataset practical for the v1.5 energy model (format, size, license)?
6. Stack choice (proposed below) — confirm or change with reasons.
7. Working name.
8. Who can we talk to (a tenant, a landlord, All In Energy / navigator staff)?

## 10. Proposed stack

Next.js + TypeScript, MapLibre GL, Tailwind, a chart library with accessible output,
rules engine as a pure TypeScript package with its own tests, Vercel hosting, LLM via the
LLM API. [Proposed — Phase 0 to confirm; consider Python for data analysis scripts]

## 11. Sources used in this draft

- MassCEC Home Modernization Navigator: https://www.masscec.com/program/home-modernization-navigator-program
- MassCEC expansion press release: https://www.masscec.com/press/masscec-expands-no-cost-service-help-more-residents-reduce-energy-costs-and-modernize-their
- Mass Save, landlords with 1–4 unit properties: https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties
- Energy burden and Eversource LMI community solar model: https://www.renewableenergyworld.com/solar/how-utilities-can-make-community-solar-work-for-low-income-customers/
- Community solar acquisition costs: https://pv-magazine-usa.com/2025/11/10/cap-agencies-make-good-partners-for-community-solar/
