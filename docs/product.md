# Product definition (draft v1)

Status: v0 was written from the planning conversation on 2026-11-06. v1 applies the
Checkpoint A decisions from the same day (see `docs/review-notes.md` and
`docs/decisions.md`). Every statement is tagged **[Decided]**, **[Proposed]** or
**[Open]** (see `CONTRIBUTING.md`).

Name: **Every Floor** [Decided 2026-11-06 — Qiao]. Triple-deckers are stacked floors, and
the signature feature is getting every unit on board.

Collision check (2026-11-06):
- **Domains:** `everyfloor.com` is taken (registered since 2008; redirects to a
  HugeDomains for-sale page). `everyfloor.org`, `.app`, `.io`, `.dev`, `.us` and
  `every-floor.com` have no DNS records, so they're probably unregistered *(inference —
  confirm at a registrar)*.
- **GitHub:** no project with this name in energy or housing; the 42 search hits are
  unrelated games and demos.
- **Trademark:** a web search found no "Every Floor" / "EveryFloor" mark; similar names
  belong to flooring companies.
- **USPTO:** Qiao searched the USPTO database on 2026-11-06; no conflict.
- No blocking problem found. Name confirmed.

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

**Why it matters.** In Massachusetts, households below 200% of the federal poverty level
spend on average about 13% of income on home energy, versus about 2% for other households.
In 2–4 unit buildings the figures are 12.5% vs 2.4%. (DOE LEAD Tool 2022 update, group
averages computed in `docs/data-sources.md` §8.) [Decided — source; Open — confirm the ACS
vintage before publishing]

**Why existing tools miss it.** Generic solar calculators answer "is my roof sunny?" They
assume a homeowner, ignore Massachusetts programs, ignore who pays vs who saves, and treat
solar in isolation from weatherization and heating. [Decided]

**One-line story:** *Massachusetts is piloting human energy navigators in six cities. This
project asks how much of a navigator's knowledge can become software that anyone in the
state can use.* [Decided — reworded at Checkpoint A so it claims only what the evidence
supports]

## 2. Positioning

- **An energy engineering portfolio** [Decided 2026-11-07 — Qiao]. It started from a hackathon brief on
  Massachusetts buildings (energy waste, retrofit prioritization, building performance, tenant and owner
  incentives, access to energy savings). The hackathon has ended; this project finishes the idea. The showcase
  is a sourced, tested energy chain:
  - fuel records → weather normalization → hot water removed → heat load;
  - → heat pump size → seasonal efficiency → bills and CO₂;
  - → who pays and who saves.

  The way the story is told: what an energy consultant decides for a triple-decker, made sourced and testable.
  It is not a business that replaces service companies [Decided 2026-11-07 — Qiao].
- Portfolio project, not a startup. Optimize for: a sharp problem, one flow that works
  end-to-end beautifully, a defensible technical core, visible product judgment, and at
  least one real user's feedback. [Decided]
- Public visitors can inspect a fixed example without model charges. Live AI uses the
  visitor's own provider API key and is billed to their account. [Decided 2026-11-12 — Qiao]
- From "solar calculator" to "navigator": solar is one module; the core is **eligibility
  and sequencing**. [Decided]
- Massachusetts first; architecture lets other states add rules data later (not built in v1).
  [Decided]
- The product hands people off. Every plan ends with the real next contact (Mass Save,
  CAP agency, utility, or the MassCEC navigator in pilot cities) and a short note that the
  program, not this tool, decides eligibility. [Proposed]

## 3. Users

**Core users: small landlords of Massachusetts 2–4 unit homes, especially owner-occupant
landlords** who live on one floor and rent the others. [Decided 2026-11-06 — Qiao,
replacing "people in 1–4 unit buildings"]

Why (Qiao, 2026-11-06): the landlord decides and pays for the work, and the
owner-occupant landlord feels every side at once. Their own unit saves, their rental
bills change, and their tenants' bills change. The question the product answers for
them is: **"Is this worth doing for me?"**

**Tenants are the entry point, not the core user.** A tenant uses the product to:
- discover that their building qualifies for something;
- see what they can do alone (community solar, the discount rate);
- generate a clear letter to their landlord.

[Decided 2026-11-06]

The rules engine still supports all four roles. **Demo stories:**
1. **Owner-occupant landlord** (first story): lives on the 1st floor of a triple-decker
   and rents the 2nd and 3rd. The landlord pays the oil heat for all three floors and has
   **two years of oil delivery records**, so the heating need comes from real use
   (confidence medium). The tenants pay their own electricity.
2. **Condo building** (second story): "N more units needed".
3. The tenant appears as the entry point that leads into story 1 (the letter to the
   landlord).

[Decided 2026-11-06]

| Role | Situation | What they need | In v1 demo |
|---|---|---|---|
| **Owner-occupant landlord** (core) | Lives on one floor; own unit and rental units are on different offers; pays for the work | **"Is it worth it for me?"**: what my own unit saves, my real energy savings vs any heating cost moved onto my tenants, how much incentives cover, the project commitment terms, and whether replacing my boiler anyway changes the answer. Also which offer applies to which unit | **Story 1** |
| Renting landlord (core) | Owns, doesn't live there; pays for upgrades; tenants may get the savings | The same "worth it" view, without an own unit | Engine only |
| Condo owner | Owns one unit; the building's discount depends on the other owners | "Units still needed" for the all-units insulation offer, messages to neighbors | **Story 2** |
| Tenant (entry point) | Doesn't control the building; may or may not pay for heat | Programs a renter can use alone, and a letter that gets the landlord to act | Entry into story 1 |

Every unit records **who pays for heat** and **who pays for electricity** (tenant or
owner). These are asked, never guessed, and savings are assigned to whoever pays.
[Decided]

Assumption to validate: 2–4 unit buildings, including condo-converted triple-deckers,
are where split-incentive and coordination problems are sharpest. Evidence so far (LEAD
2022): 549k Massachusetts households (20%) live in 2–4 unit buildings; 69% of them rent and
28% are below 200% FPL (vs 20% statewide). [Proposed — still check with real users]

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
- Four roles in the rules engine; demo stories: owner-occupant landlord (first), condo; the
  tenant as the entry point (letter to the landlord) [Decided 2026-11-06]
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
- **Heating need and heat pump size for everyone** [Decided 2026-11-06 — Qiao]. These
  come from the user's past fuel records where available (confidence medium). Otherwise
  they come from a **ResStock-based Massachusetts estimate** for similar 2–4 unit
  buildings (confidence low, "typical for similar buildings, not measured for yours").
  This is built in Phase 1, so most users still get a number.
- Rooftop solar module only for users who can install (Google Solar API, PVWatts fallback).
  It must say which meter(s) get the benefit, since each unit usually has its own meter.
  [Proposed — Step 3 verifies net-metering credit allocation]
- Ordered action plan with the reason for each step
- Coordination tools: tenant → landlord letter, landlord → tenants scheduling note,
  condo "units still needed" and messages to other owners. The 75% tier shows as
  eligible; the 100% tier shows "N more units needed" and is never shown as "not
  eligible" for lack of agreement [Decided 2026-11-06]
- All money as **low / mid / high scenarios** with confidence labels [Decided]
- **"Is it worth it for me?" — the landlord view** [Decided 2026-11-06 — Qiao]. For a
  project, the engine answers:
  - what the landlord's **own unit** saves or costs per year;
  - **who gains in the rental units**, bill by bill (the landlord, the tenants, or a payer
    we don't know yet);
  - **how much incentives cover** of the project cost, plus the net upfront cost;
  - **real energy savings vs cost shifted to tenants**: the landlord's apparent saving
    is split into the real energy saving and the heating cost that would move onto
    tenants' electric bills. Any shift is shown in dollars per year and per month, with
    fair options: lower the rent accordingly, an electricity allowance, or an owner-paid
    meter for the heat pump. Under 105 CMR 410.200/410.210 the landlord can't shift heat
    costs without a written rental agreement (research §18). Payback is computed on real
    savings. [Decided 2026-11-06 — Qiao]
    - **We never interpret the law for the user.** The report says "Check your written
      rental agreement" and names the exact thing to look for: does it say the tenant
      pays for **heat** (or heating fuel), not only "electricity"? It lists where to get
      help (the Attorney General's Guide to Landlord-Tenant Rights, MassLegalHelp's
      utilities chapter, the local Board of Health) and says "This is not legal advice."
    - **The recommended payback is always the no-shift one.** The "if costs were shifted"
      payback appears only as a comparison, always with the 105 CMR 410 note, never in a
      recommendation slot.
    - **Fair options (four):**
      1. lower the rent by the shifted amount;
      2. an electricity allowance;
      3. an owner-paid meter for the heat pump;
      4. negotiate at renewal or a new lease and write it down. This must explain the
         electricity change openly; renewal must not be used to shift the cost
         unannounced.
  - **project commitment terms** (UI label; formerly "cost of a no-rent-increase
    commitment"): the forgone rent increase over the commitment period. If the period or
    the increase isn't known, it is shown as unknown with the reason.
  - **comparison baseline "the boiler needs replacing anyway"**: if chosen, the payback
    subtracts the replacement cost the landlord would have paid regardless. It comes from
    the user's quote, otherwise the EEAC study's $/ton (low confidence).

  All of these are estimates with confidence, computed by code.
- **Who saves, who may pay more** [Decided 2026-11-06 — Qiao, top priority after review].
  For each unit, the report shows:
  - the heating-fuel bill change for whoever pays heat;
  - the electric bill change for whoever pays electricity;
  - the upfront cost after incentives for the property owner.

  Example: oil → heat pump, landlord pays oil, tenant pays electricity → landlord saves,
  tenant's electric bill goes up. An unknown payer is shown as "we don't know who pays
  this bill".
- LLM explains results and drafts messages; it never computes numbers or names programs
- FAQ, incl. why federal credits don't apply and what the tool can't decide
- A live demo with a few real addresses. A Boston rental near BC works well: Boston is a
  Designated Equity Community.
- **[Open — must be resolved before Phase 3]** Whether Google Solar API responses may be
  cached for the demo (Service Specific Terms). **Fallback [Decided]:** if caching isn't
  allowed, the demo's roof estimate uses PVWatts (public data, cacheable) plus the MassGIS
  building outline for roof area, with wider ranges and a lower confidence label.

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
- (An MCP server was considered and dropped — Qiao, 2026-11-07.)

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

## 6a. Keeping rules and models honest as they change [Decided 2026-11-06 — Qiao]

Stronger models make the project stronger only if every change is checked the same way.

**1. Model-assisted rule drafting, human approval.**
1. **Capture:** the official page or PDF is fetched (headless browser) and saved as a
   text snapshot with URL, date and hash under `rules/<state>/sources/`.
2. **Draft:** a model reads the snapshot and writes rule JSON into
   `rules/<state>/drafts/`, with section and verbatim quote for every condition and
   amount.
3. **Check (automatic):** `npm run rules:check-drafts` validates the schema, resolves
   every reference against the active rules, and checks that **every quote appears
   verbatim in the saved snapshot**. A draft that fails never reaches review.
4. **Approve (human):** Qiao reviews the draft, the check report and the standard
   scenario diff. Only then is it moved into the active rules with a `review` record
   (`draftedBy`, `checkedOn`, `approvedBy`, `approvedOn`). The loader refuses any active
   rule without that record. Drafts are never loaded.

**2. A fixed set of standard scenarios.**
- `scenarios/<state>/*.json`: each scenario is a building, the user's answers, fixed
  dates, and expected results (statuses, versions, units needed, payer split, landlord
  view).
- `npm run scenarios` runs them all.
- **Any change to rules data, the engine, or, from Phase 2, prompts and models must
  pass them first.** A changed expectation is itself a change Qiao approves.
- From Phase 2 the same scenarios also check the LLM layer: no number or program that
  the engine didn't return.

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
5. A methods write-up explains every step of the energy chain: assumption, source, range and why, plus a
   validation of records-based heat loads against ResStock. [Decided 2026-11-07 — Qiao]

## 10. Open questions for Phase 0

1. ~~Exact v1 program list~~ → answered in `docs/incentives-research.md` (Step 3). Remaining
   gaps are listed at the end of that file. Three questions go to Mass Save by email
   (`docs/outreach/emails.md` §3).
2. ~~Eversource low-income community solar~~ → answered (auto-enrollment by lottery).
   National Grid and municipal programs are still open.
3. ~~Data sources~~ → answered in `docs/data-sources.md`. Key rule: municipality comes from
   the geocoder's county subdivision, never the postal city or ZIP.
4. ~~Google Solar API~~ → priced (10,000 free Building Insights calls/month). Still open:
   MA coverage check and caching terms.
5. ~~ResStock~~ → practical for v1.5 (MA files 8–27 MB each).
6. Stack choice. → Step 5
7. Working name. → Step 5
8. Real users: outreach to All In Energy / the navigator program and to a tenant or landlord
   near BC. Drafts in `docs/outreach/emails.md`; Qiao sends them. [Decided — start now]
9. ~~Massachusetts energy burden figure~~ → computed from LEAD (§1). Confirm ACS vintage.
11. **[Open] Cooling and the electric bill.** Heat pumps also cool. Where there was no AC
    before, summer electricity rises (Mass Save heat pump page says so). How should the
    bill estimate treat cooling: leave it out, or add it as a separate, clearly labelled
    line? Needs a sourced cooling-load assumption.
12. **[Open] Winter heat pump electric rates.** Eversource, National Grid and Unitil offer
    seasonal heat pump rates (Nov–Apr) per the Mass Save page (research §8). Amounts,
    eligibility and whether they apply to tenant-held accounts aren't read yet. They change
    the tenant's bill in the cost-shift case.
10. Tenant concern that upgrades lead to rent increases. For DEC rental projects, the
    2025–2027 Plan requires landlords to sign a form "committing not to raise renter or
    evict tenants for a period" after receiving incentives (`docs/data-sources.md` §5).
    The length of that period is still open. Outside DECs: no protection found; the product
    stays neutral.

## 11. Stack (Step 5 review)

| Layer | Choice | Status | Why |
|---|---|---|---|
| Rules engine + finance | TypeScript package `engine/`, Node 24 LTS, Zod 4 for rules-data validation, Vitest + fast-check | [Decided 2026-11-06] | Same language as the app, so the browser and server share one engine. Zod gives types and runtime checks from one schema. fast-check covers the property tests. Versions are pinned in `docs/phase-1-plan.md` |
| Rules data | JSON files in `rules/ma/`, one folder per state; schema in `docs/schema/rules-schema.md` | [Decided 2026-11-06] | Policy edits are data edits plus tests. Schema merged from two independent designs |
| Data analysis | Python scripts in `analysis/` (standard library first) | [Proposed] | LEAD and MassGIS work is tabular/geospatial; it stays out of the app |
| App | Next.js 16 (App Router) + TypeScript + Tailwind | [Proposed — confirm in Phase 3] | Server routes for the engine and LLM API calls; static pages for the demo. |
| Charts | Hand-built SVG with D3 scales, each chart paired with a data table | [Proposed — confirm in Phase 3] | Only 4–5 simple charts. Hand-built SVG gives full control over WCAG 2.2 (text alternatives, patterns as well as colour, keyboard focus). Alternatives: Observable Plot (faster, weaker accessibility control), Recharts |
| Map | MapLibre GL | [Proposed] | Supporting role only (confirm the building, show the roof); open source, no per-view fee |
| LLM | LLM API, model chosen in Phase 2 | [Decided — provider; Open — model] | Explanations, form pre-fill and message drafts only |
| Hosting | Vercel | [Proposed] | Fits Next.js; free tier is enough for a portfolio demo |
| Storage | None in v1 | [Proposed] | No accounts; demo addresses run on request. Cached data is limited to what the terms allow (Solar API caching is [Open]) |

Change from v0: none of substance. Added Zod and fast-check, put charts as hand-built SVG,
dropped the idea of a chart library until Phase 3 shows a need, and confirmed Python only
for analysis.

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
