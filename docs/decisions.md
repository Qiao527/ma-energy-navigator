# Decisions log

Newest first. Format: date — decision — why — decided by.

## 2026-11-12 (Public AI access)

- **Use a fixed example for public demonstration and visitor-owned API keys for live AI.**
  This keeps the portfolio accessible without charging the project's account for visitor
  requests. — Qiao.

## 2026-11-11 (AI endpoint observation)

- **The `/api/` firewall observation rule is live.** It logs only and does not rate-limit. Qiao published it;
  traffic verification, staged enforcement, and the DeepSeek spending limit remain open. — Technical.

## 2026-11-11 (Phase 2 review fixes)

- **Unknown is not zero:** unallocated bill payers and unestimated water-heater switches prevent the page from
  reporting a complete tenant cost shift. The fairness section also withholds partial totals. — Technical.
- **Keep data provenance visible:** edited examples remain labeled as examples, and replacing the current
  building with AI-extracted facts requires explicit confirmation. — Technical.
- **Town validation:** the engine and map use the shared Census municipality list. Unrecognized names leave DEC
  status unknown; the form asks the user to check spelling. — Technical.
- **Public AI remains protected:** the initial firewall observation rule logs only; it is not a rate limit. A public release
  still needs effective rate limiting and a provider-side spending limit. — Technical.

## 2026-11-10 (Input interface polish)

- **Refine the intake and form interaction:** more legible typing, clear focus and button states, responsive
  spacing, and a restrained visual hierarchy informed by Apple’s site. Text entry and confirmation semantics
  remain unchanged. — Qiao.

## 2026-11-10 (Intake guidance)

- **Make the AI entry understandable without energy expertise:** ask first for role, town and number of homes;
  suggest heating and bill payers only when known; show an example and plain-language fact review. Keep the
  external-service privacy notice without displaying the model brand in the product. — Qiao.
- **Owner-occupied floors:** tenant-only payer statements cannot be applied to every floor. A live example
  exposed the ambiguity, so the intake asks for a later per-floor answer instead. — Technical.

## 2026-11-10 (DeepSeek provider)

- **Use DeepSeek for the AI navigator.** Qiao already uses DeepSeek; the key stays on the server, and the
  model response is validated before it can be used. — Qiao.
- **Protected Vercel preview verified:** the DeepSeek key is a Preview Secret; a fictional building description
  returned the stated facts and left unstated bill payers and utility unknown. The presentation endpoint also
  returned a valid choice. Public release, budget and rate-limit protections remain open. — Technical.

## 2026-11-10 (AI product direction)

- **Prioritize a demonstrable AI product alongside the energy engineering work**, rather than treating user
  outreach as a startup milestone. — Qiao.
- **Phase 2 local preview:** Claude extracts explicit facts for user confirmation. The model selects from reviewed
  explanation and message text; amounts come from the existing report. A localhost service holds the key and the
  static page remains usable without it. Model extraction accuracy and public hosting remain open. — Technical.

## 2026-11-08 (Form shortcut, demo GIF, plain copy)

- **"Every floor" in the form:** heating, who pays heat, who pays electricity, whether the boiler heats water,
  where hot water comes from afterward, and occupancy can be answered once for all floors. The field shows
  "Differs by floor" when the floors disagree, and single floors can still be changed. — Qiao.
- **Demo GIF in the README** (`docs/assets/every-floor-demo.gif`, about 13 s, 1.3 MB), recorded from the
  production build with headless Chromium. — Qiao.
- **Plain copy (humanizer pass):**
  - footer, plan and form hints rewritten in plain words;
  - section titles "Where extra help is available" and "Where every number comes from";
  - CO₂ shown as "X–Y tonnes less CO₂ a year";
  - README intro, finding and honesty sections rewritten as prose instead of bold-headed lists.
  — Qiao.

## 2026-11-08 (Clarity pass for first-time visitors)

- **Wrap-up direction:** no new features; polish so a landlord understands at a glance. — Qiao.
- **Technical (design critique):**
  - an "This is an example… Check your building" line on the demo, and the top button reads "Check your
    building" (then "Edit your building");
  - the headline leads with the likely result (typical value) and puts the range on the next line;
  - "What if" becomes "Try your own numbers", folded behind a button on phones so the answer comes first;
  - "Likely" replaces "Likely; the program confirms";
  - "What to do, in order" moves ahead of the map;
  - the price-of-heat section explains a million Btu (about 7 gallons of oil);
  - a note every floor shares is shown once.
  axe-core: 0 violations on desktop and phone.

## 2026-11-08 (Outside audit: three fixes)

- **Town names match regardless of case and spaces** (`derive`). "boston" was not found as a Designated Equity
  Community while the map highlighted it. Tested.
- **A blank town shows a "start here" state**, not a validation error. An empty text field stays an empty string
  instead of turning into null.
- **Any edit clears the demo label**, so the user's own numbers are never marked "demo data". — Technical.

## 2026-11-07 (Phase 1 closed)

- **Approved:** the heat pump water heater electricity and the November–April season share ("批准数据"), and the
  11 re-recorded scenario baselines ("批准场景"). Every rule, assumption and scenario is now approved. — Qiao.
- **Phase 1 is closed.** The methods write-up and README are updated to the approved numbers. The demo now reads
  between saving $1,250 and paying $3,530 more a year on heat and hot water. Next: messages for the other people
  in the building (tenant → landlord, landlord → tenants), generated from engine results. — Qiao.

## 2026-11-07 (Phase 1 independent review)

- **Nine findings, all confirmed and fixed** (`docs/reviews/phase-1-review.md`). Two are model changes:
  - an unanswered hot-water question widens the heat load range;
  - the winter heat pump discount is weighted by the November–April share of the heating season.
  Building-wide figures now need every floor. — Technical.
- **Rule draft (waiting for Qiao):** `heating_hdd_share.ma.nov_apr` 0.851 / 0.851 / 0.880 from NOAA CPC monthly
  state data. Approved together with the heat pump water heater value.

## 2026-11-07 (F3, F4)

- **Technical (F3):** `demoData` is a required field on every scenario; all ten are invented buildings, so all are
  `true`. The page's demo label reads it.
- **Technical (F4):** scenario fixture quantities are removed. Each run computes costs and heat pump size with
  `quantitiesFor` from the assumptions in force, so an assumption change now shows in the scenarios. Re-recording
  changed only heat pump rebate amounts (no eligibility, question or order changed); the ten baselines wait for
  Qiao's re-approval.

## 2026-11-07 (Hot water in the demo; heat pump water heater estimate)

- **Demo answers** (Qiao, as recommended): each floor's boiler heats its water, and a heat pump water heater
  takes over. Set in `web/src/demo.ts`; the standard scenario stays unchanged. — Qiao.
- **Technical:** an electric water heater switch is now estimated when a sourced yearly electricity use exists:
  the hot-water oil (share × mean gallons × price) goes, and kWh × the standard rate comes, on the floor's own
  meter. CO₂ includes both. The winter heat pump rate's effect on half the year is left out (conservative).
- **Rule draft (waiting for Qiao):** `water_heater_annual_kwh.heat_pump_water_heater` 426 / 862 / 1,534 kWh a
  year, from Efficiency Maine's June 2026 impact evaluation (metered Maine homes). Typical: 862 kWh added where
  the old water heater burned fuel. Low: the hot-water load at the rated UEF 3.6. High: the same load in
  resistance mode. Confidence low. Quote check passed.
- **Effect on the demo:** heat and hot water together, the building lands between saving $1,400 and paying $3,260
  more a year. The page is published only after approval, because without the value the hot-water switch can't
  be estimated.

## 2026-11-07 (Dependency updates)

- **Technical:** TypeScript 7.0.2 (engine, web) and Vitest 5.1.0 (engine) applied on the branch, with all checks
  passing; Dependabot PRs #3, #4 and #5 closed as superseded. `@types/node` stays on 24 to match the Node 24
  runtime: PR #2 closed, and Dependabot now skips its major updates.

## 2026-11-07 (F1: an offer arranged before installation, on an installed project)

- **Technical:** new fact `project.installed` (install date on or before today). A confirmation can use it in
  `when`; on an installed project, offers carrying such a confirmation sort after the others in `shown`.
- **Rule:** `dec_rental_heat_pump_no_cost` gains the confirmation
  `installed_before_program`. The offer is turnkey ("project coordination and installation managed for you";
  "installed by approved contractors"), and whether finished work qualifies isn't published, so it stays
  potential with "ask Mass Save before counting on it". Quote check passed.
- **Approved** (rule and scenario) at Qiao's instruction ("批准F1"). All 11 standard scenarios are now approved. — Qiao.

## 2026-11-07 (Seasonal heat pump rate)

- **Technical:** heat pump electricity is priced at the standard statewide rate minus the electric company's
  winter heat pump discount (`heatPumpPrice`, engine). Eversource (and Cape Light Compact towns, which Eversource
  serves) $0.07828/kWh: distribution, transmission and revenue decoupling, rates effective Sept 1 – Dec 31, 2026.
  National Grid $0.04237/kWh approved (distribution); up to $0.09224/kWh if D.P.U. 26-71 (winter transmission)
  is approved, so confidence is low. Unitil (no sourced figure yet), municipal and unknown companies use the
  standard rate, with a note. The home is assumed enrolled (automatic with a Mass Save heat pump rebate). The
  discount on the household's other winter electricity is left out (conservative).
- **Effect on Story 1 (Boston, Eversource):** the answer moves from "+$870–4,820 a year" to "between saving $550
  and paying $2,690 more". A heat pump's heat costs about $33 per MMBtu against $27 from oil.
- **Approved:** the two assumptions (quote check passed) moved into `rules/ma/assumptions.json`; approval run at
  Qiao's instruction ("好"). — Qiao.

## 2026-11-07 (Standard scenarios approved)

- **Nine scenario baselines approved** (`approved: {by: Qiao}`); `npm run scenarios` now checks them. — Qiao.
- **`story1-installed-deadline-passed` held:** an installed project still shows the DEC no-cost rental heat pump
  as potential, which needs enrollment before installation. It is re-recorded and re-reviewed after F1. — Qiao.
- **Tenant view keeps one free weatherization offer per unit** (best-of): an income-eligible tenant sees the
  rental-unit 100% insulation offer, not also Income Eligible weatherization. — Qiao (kept as recommended).

## 2026-11-07 (Positioning: an energy engineering portfolio; first public version today)

- **The project stays a portfolio project, now framed as an energy engineering portfolio.** Why: the goal is
  to show that the energy work is done right and explained clearly, not to run a business. — Qiao.
- **Origin:** a hackathon brief on Massachusetts buildings (energy waste, retrofit prioritization, building
  performance, tenant and owner incentives, access to energy savings). The hackathon has ended. The project
  finishes the original idea, and the README says so. — Qiao.
- **Not pursued:** an MCP server (removed from the v2 ideas), and a business that replaces traditional service
  companies. "What an energy consultant decides for a triple-decker, made sourced and testable" stays as the
  way the story is told, not as a business. — Qiao.
- **Emphasis:** energy engineering first, human-centered second. The showcase is the chain: fuel records →
  weather normalization → hot water removed → heat load → heat pump size → seasonal efficiency → bills and
  CO₂ → who pays and who saves. The rules engine and the fairness framing support it. — Qiao.
- **Scope added to Phase 1 (milestone M4b):** sourced fuel prices, heat pump seasonal efficiency, weather
  normalization (heating degree days), CO₂, and a comparison with similar buildings. These come before the
  polished UI. A methods write-up (assumptions, sources, uncertainty, validation) is a deliverable. — Qiao.
- **A first public version today** (Qiao). It ships only with rules and assumptions Qiao has approved
  (principle 3, §6a).
  - Technical: a static site. The engine runs in the browser, with no LLM, no accounts and no stored
    data.
  - Built with esbuild + TypeScript and plain semantic HTML (changed from Vite while building: one dependency, and the output is one standalone HTML file, so any static host or a shared link can serve it). Why: it's the smallest thing that works for a form
    and a report, and it keeps WCAG control simple.
  - Next.js stays [Proposed] for Phase 3, when server routes are needed for the LLM.

## 2026-11-07 (Rules approved; first public release prepared)

- **All 16 rule and assumption files approved** (batches 1 and 2) by Qiao in chat ("approve"). The approval
  command was run at Qiao's explicit instruction; the ledger records `approvedBy: Qiao`. — Qiao.
- **Scenario baselines: not yet reviewed** (all 10 wait for Qiao). Not a release blocker. — Qiao.
- **Publishing rule:** everything on GitHub is published under Qiao's account (Qiao527); recorded in `CONTRIBUTING.md`.
  — Qiao.
- **Technical, accessibility pass (WCAG 2.2 AA):**
  - axe-core reports no violations in light or dark mode.
  - Fixed during the pass:
    - the answer is the page's `h1`;
    - a skip link;
    - scroll padding so the sticky what-if bar never covers focus (2.4.11);
    - spoken slider values (`aria-valuetext`);
    - named bar segments;
    - Escape dismisses tooltips (1.4.13);
    - the map pulse stops after three cycles (2.2.2);
    - 24 px targets on disclosure summaries (2.5.8);
    - a live region that reads the new answer after a pause;
    - an inline favicon.
  - All text tokens are at 4.5:1 or above in both themes.
- **Technical, repository:**
  - README with the energy chain, sources, the honest finding and the demo-data label;
  - CI: engine tests, draft check, scenarios, Python tests, web build;
  - GitHub Pages workflow (builds from approved rules on `main`);
  - generated files (`__pycache__`, `web/dist`) removed from git.


## 2026-11-07 (Interactive version)

- **Technical:**
  - A what-if bar sits above the report: electricity price, the building's fuel price, heat pump efficiency,
    and whose meter the heat pumps run on. One row of controls scopes every number below it.
  - What-if values replace a sourced range with the user's exact value (engine `withOverrides`, tested), and the
    page labels them "what-if values".
  - The meter option is engine `heatPumpMeter: 'owner'` (tested). It removes the shifted cost, which is fair
    option 3.
- **Technical, the elevation shows the switch itself:**
  - Today: the basement boiler and oil tank, a shared riser, and radiators.
  - With heat pumps: outdoor units on each porch, line sets to wall heads, and each floor's meter, or one owner
    meter bus.
  - The boiler stays, drawn dashed, when it keeps heating the hot water.
- **Technical, motion and highlighting:**
  - Between renders, bars glide, numbers count, and the map pans or zooms ("Around <town>").
  - A floor is highlighted everywhere it appears.
  - One tooltip, value first, works on hover and keyboard focus.
  - All motion is off under `prefers-reduced-motion`.

## 2026-11-07 (Qiao's review of web v1)

- **"Heat pumps may not save" is presented as it is** (option A). The headline states the yearly change, and the
  page explains why: the price of one unit of heat, plus the break-even electricity price and heat pump
  efficiency. — Qiao.
- **The first web design was rejected: generic and unfocused.** The redesign leads with the answer for the user,
  makes the visuals stronger, and adds a map. — Qiao.
- **Technical, redesign:**
  - It reads as an engineering sheet: the answer sits beside the building drawn in elevation (bay window,
    stacked porches, flat cornice), one floor per row, with each bill's yearly change.
  - Then come: the price of one unit of heat by system (engine `heatCosts` / `breakEven`, tested); today vs with
    heat pumps per floor; the fairness options; the map; the plan in order; the method chain; and sources.
  - The form moved into an "Edit the building" drawer.
  - Two data colors (fuel, electricity) pass the dataviz palette validator in light and dark mode. Every chart
    has a table.
- **Technical, map:**
  - Census 2023 county subdivisions (351 Massachusetts municipalities, the engine's municipality basis),
    simplified to SVG by `analysis/ma_towns_svg.py` (standard library only).
  - It shades Designated Equity Communities from the rules data, marks the six MassCEC navigator pilot cities,
    and highlights the user's town.
  - No map tiles: the page must run as one file with no outside requests. The caption says places are shown to
    point to help, never to rank them (principle 6).

## 2026-11-07 (M4b built: energy chain and web v1)

- **Technical:** sourced assumptions added to the drafts. All quotes pass the draft check.
  - Prices: DOER winter 2025–26 outlook vs last winter. Oil $3.10–3.43/gal, propane $3.17–3.33/gal, gas
    $2.03–2.24/therm, electricity $0.33–0.35/kWh. Confidence medium; these are statewide averages. The winter
    heat pump rate is not modeled yet.
  - Heat pump seasonal COP: Cadmus field study, whole-home systems in MA and NY. Mixed 1.90, all whole-home
    2.41, ductless 2.80. Confidence medium; the study winter was mild.
  - CO₂: EPA 2025 Emission Factors Hub. Oil 73.96, gas 53.06, propane 62.87 kg/MMBtu; New England grid 537.2
    lb/MWh (total output, CO₂ only).
  - Heating degree days: NOAA CPC Massachusetts population-weighted season totals for 2021–2025 and each
    season's normal. The normal is 6,407 in every season except 2023–24, which is 6,441.
- **Technical:** `report()` is the single entry point. Electric water heaters are not estimated
  (there's no sourced efficiency), and the report says so. The landlord view counts only eligible owner
  incentives.
- **Engineering finding, for Qiao:** at these statewide prices, oil → heat pump raises running costs in Story 1.
  Per MMBtu of heat delivered, oil costs about $32 and a heat pump at COP 2.41 about $42. The report says so
  and shows no payback. This matches DOER's own caution: "households should not assume that switching fuels
  will automatically lead to savings."

## 2026-11-07 (F2: hot water from the boiler)

- **Technical:** the hot-water share comes from ResStock 2025.1 MA, the same file as Task 16b. It uses
  units in 2–4 unit buildings whose water heater burns the heating fuel. Share = hot-water fuel ÷ (heating + hot-water
  fuel), weighted p25 / p50 / p75, with at least 30 samples, at confidence low.
  - Oil: 0.145 / 0.182 / 0.272 (n = 157). Gas: 0.142 / 0.205 / 0.297 (n = 1,504). Propane (n = 20) is left out, so
    propane records stay unadjusted at confidence low, with the reason.
  - Why not EIA RECS: RECS publishes regional end-use totals, not Massachusetts 2–4 unit homes. ResStock is
    already in the approved-source pipeline (license CC-BY-4.0).
- **Technical:** the boiler's fixed cost is the DOER consumer tip sheet (2017): an annual oil burner
  tune-up "approximately $120-150". Recorded as `boiler_annual_service_cost.oil`, 120 / 135 / 150 USD per year,
  confidence low (2017 dollars, tune-up only). Gas and propane have no source, so they get no number; the view says
  why.
- **Technical:** units gain `hotWaterFromBoiler` and `hotWaterAfter`.
  - `heatLoadFromRecords` takes the share out only when the answer is yes. Unanswered keeps the
    "may be overstated" note.
  - `navigate` asks the first question for units with a fuel-burning heating system or fuel records. There is no
    boiler fact, so this stands in for "has a boiler". It asks the second question after a yes.
- **Technical:** landlord view `hotWater`:
  - `boiler` → the unit is listed in `boilerKept` with the hot-water fuel cost and fixed cost that remain. Totals
    don't change: the bill change covers space heating only, and the fixed cost is paid before and after.
  - an electric water heater → its bill changes are added to the unit. Its meter defaults to the heat pump's
    meter. If the landlord paid the boiler fuel and a tenant pays that meter, its electricity is a shifted cost,
    with the same 105 CMR 410 note and fair options (410.210 names oil "for heating and/or hot water").
- **Scenarios:** all 10 baselines were re-recorded. The only change is the new `unit.hotWaterFromBoiler`
  questions; no status, amount or step changed. Approvals were cleared and wait for Qiao.

## 2026-11-07 (Qiao's review of milestone 4, second round)

- **Batch 1 rules: Qiao reviews first, then approves** with `tools/approve_rules.py`.
  Nothing is approved yet. — Qiao.
- **Scenarios `story1-installed-deadline-passed` and `story1-planning-after-deadline`
  approved.** All 10 standard scenarios now have an approved baseline. — Qiao.
- **Demo data is labeled.** Story 1's fuel records are fictional. Wherever they appear,
  the interface and the README must say "demo data". (There is no README or UI yet. The
  scenario `story` text already says "fictional demo numbers".) — Qiao.
- **DEC no-cost heat pump on an already-installed rental unit: keep showing it, last in
  the list.** It must state the sourced fact: the project is arranged by the turnkey
  contractor before installation, and the website doesn't say whether an installed
  project still qualifies, so this needs confirming. Why: don't decide for the user, and
  don't hide a possible offer (Mass Save call, question 5). — Qiao.
- **Hot water from the boiler: ask two questions.**
  1. Does the hot water come from the boiler today?
  2. After the heat pump, what heats the water: the same boiler, an electric water
     heater, or a heat pump water heater?

  If the boiler stays for hot water, the oil bill doesn't go to zero. Keep the hot-water
  share of the oil and the boiler's fixed costs, and adjust the payer split to match.
  - Take the hot-water share from a sourced dataset (for example EIA RECS).
  - If none is found, mark the confidence low and say why.

  Why: fuel records include hot water, so the heating need and the heat pump savings
  would otherwise be too high. — Qiao.
- **Follow-ups :** these become tasks in `docs/phase-1-plan.md` ("Follow-ups from
  Qiao's second M4 review"). Each one that changes a scenario result needs Qiao's
  approval again.

## 2026-11-07 (Tasks 16 and 16b: where heating need and heat pump size come from)

- **Technical:** `engine/src/quantities.ts` estimates per unit, from the most
  specific source:
  - heating need: the user's fuel records, else ResStock fuel × vintage, else ResStock
    fuel only;
  - heat pump size: the contractor's quoted tons, else ResStock;
  - heat pump cost = tons × $/ton.
  Weatherization and solar have no sourced cost, so they stay missing (percentage only).
- **Technical:** units gain `fuelRecords` (`year` = the heating season starting
  that year; several deliveries in a season are added up) and `heatPumpTonsQuoted`.
  - Records in a unit that doesn't fit the fuel aren't used, so the estimate falls back to
    ResStock. Nothing is guessed.
  - Two or more seasons → medium confidence; one → low.
  - The reason text always says that records include hot water if the same boiler heats
    it.
- **Technical:** boiler efficiency is the EEAC new-baseline AFUE (oil 0.84; gas
  and propane 0.82), at `confidence: medium`, and the description says an older boiler is
  probably less efficient.
  - Why medium: the fuel-bill side doesn't depend on efficiency at all (load ÷ efficiency
    gives back the fuel used). Only the heat pump's electricity does. Medium keeps two
    seasons of records at medium, as decided for Story 1.
- **Technical:** heat pump cost per ton is $3,694 / $5,664 / $7,634. The earlier
  $3,860 / $5,830 / $7,800 mixed two groups of the EEAC study.
- **Technical:** assumption files (`assumptions.json`,
  `assumptions-resstock.json`) go through the same drafting workflow, quote check and
  approval ledger as the rules.
- **Technical:** ResStock groups need at least 30 samples. Electric resistance
  has no ResStock group (ResStock's "Electricity" mixes heat pumps and baseboard); such
  units need records.
  - Rerun result: oil 22.8 / 35.8 / 50.8 MMBtu and 1.97 / 2.48 / 3.29 tons (n = 349), the
    same as the first pass. Oil before 1950 has a mid of 38.3 (first pass 38.4; the
    quantile method differs).
- **ResStock license resolved:** CC-BY-4.0 (`citation.txt`).
- **Technical:** solar yield and solar cost assumptions wait for Phase 3. Without
  a per-address system size they produce no number.
- **Technical:** Story 1 scenario inputs now carry two seasons of oil records
  per floor (fictional numbers). Expected results didn't change, because scenarios use
  fixed quantities. Once the assumption files are approved, the scenarios switch to
  computed quantities, which changes dollar values and needs Qiao's re-approval.

## 2026-11-07 (Qiao's review of milestone 4, first round)

- **Missed paperwork deadlines depend on whether the work is done.** Already installed →
  show "application deadline passed" with the date. Still planning → don't show last
  year's versions. — Qiao.
  - **Consistency note:** both earlier statements were true at different layers. The
    status was `not_eligible` with reason `application_deadline_passed`, while the
    `shown` filter hid it. Both layers now follow the rule above.
- **Technical:** "installed" means the install date is on or before today. A
  past install date can only mean the work is done, so no extra input field is needed.
- **Technical:** a result is "missed the deadline" only if eligibility isn't a no
  anyway. Why: otherwise rebates the user never qualified for would read as missed.
- **Standard scenarios: 8 approved** (Qiao). The deadline scenario became two:
  `story1-installed-deadline-passed` and `story1-planning-after-deadline`, both waiting
  for approval.
- **Technical:**
  - each scenario carries `approved: {by, on}`; a re-record that changes `expected`
    clears it;
  - `npm run scenarios` runs approved baselines against approved rules plus pending drafts
    (named in the suite title), so engine changes are checked before every rule is
    approved;
  - unapproved baselines are skipped.
- **Rules are reviewed in batches** (Qiao):
  - batch 1 is Story 1's core: programs, predicates, income tables, DEC list, caps,
    sequence, legal, assessment, weatherization, heat pumps, financing;
  - batch 2 is solar, bill assistance, and the condo insulation offers (moved to
    `offers/weatherization-condo.json` so approval by file works).
- **Mass Save call list:** `docs/outreach/mass-save-call.md`, each question naming the
  rules and scenarios it affects.

## 2026-11-07 (Phase 1, milestone 4: drafting workflow, rule drafts, standard scenarios)

- **Technical:** approvals are a ledger `rules/ma/approvals.json` keyed by each
  file's sha256. `loadRuleSet` refuses any active rule file whose content has no
  approval, so a one-byte change needs re-approval. `drafts/` is never loaded except in
  the check's preview mode. Why: "never add an active rule directly" becomes enforced, not
  a convention.
- **Technical:** `tools/approve_rules.py` (run by Qiao only) approves a file only
  if its hash matches a passing `npm run rules:check-drafts` (`drafts/CHECK.json`).
- **Technical:** the quote check compares against saved text snapshots in
  `rules/ma/sources/` (captured with `tools/capture_source.py`). Normalization: NFKC,
  collapsed whitespace, no space before punctuation (links in web pages leave one).
  Nothing else is fuzzy.
- **Technical:** standard scenarios live in `scenarios/ma/*.json` with fixed dates
  and fixed quantities. `npm run scenarios` compares a stable summary (status, shown,
  reason, missing, prerequisites, coordination counts, value, questions, steps, upcoming).
  Baselines are recorded from the drafts and need Qiao's approval along with them. The
  suite skips until approved rules exist.
- **Technical:** `tools/draft_report.py` writes `rules/ma/drafts/REVIEW.md`, the
  human-readable view Qiao approves from.

## 2026-11-06 (Phase 1, milestone 3: offers and plan)

- **Technical:** milestone 3 implemented (Tasks 10–12) as planned.
- **Technical:** coordination prerequisites ask only for the facts that would
  settle each undecided unit (`missingByUnit` → `unitQuestions`). Why: a unit without a
  heating meter that already said no is undecided only because the definition is open,
  so asking it again would be wrong.

## 2026-11-06 (cost shifting: Qiao's three decisions)

- **Never interpret the lease or the law for the user.** Show "Check your written rental
  agreement: does it say the tenant pays for heat (or heating fuel), not only
  electricity?", list resources (the AG's 2025 guide, MassLegalHelp ch. 6, the local
  Board of Health), and say "This is not legal advice." — Qiao.
- **The recommended payback is the no-shift one.** The cost-shifted payback is
  comparison-only, always with the 105 CMR 410 note, never in a recommendation slot. —
  Qiao.
- **Fourth fair option:** negotiate at renewal or a new lease, in writing, with the
  electricity change explained openly. Never a disguised shift at renewal. — Qiao.
- **ResStock estimates moved into Phase 1** (Task 16b, M4). First pass for oil-heated
  Massachusetts 2–4 unit homes: 22.8 / 35.8 / 50.8 MMBtu heating load and 1.97 / 2.48 /
  3.29 tons, confidence low. — Qiao asked; computed.
- **Demo Story 1 has two years of oil delivery records** (heating need from records,
  confidence medium). — Qiao.
- **Technical:** fuel records go per unit as `fuelRecords`. Estimate precedence:
  records → contractor tons → ResStock fuel × vintage → ResStock fuel only. A group needs
  at least 30 samples.

## 2026-11-06 (Phase 1, after milestone 2: cost shifting)

- **Escalation rule** (CONTRIBUTING.md): The lead decides technical details and records them here.
  Only product direction, policy interpretation, and ethics/fairness go to Qiao. Each
  milestone ends with commit, push, and a report listing only Qiao's decisions. — Qiao.
- **Landlord view splits real energy savings from cost shifted to tenants.** Any shift is
  shown per year and per month, with fair options (lower rent, electricity allowance,
  owner-paid meter). — Qiao (top priority).
- **105 CMR 410 verified** (Mass. Register #1498, 6/23/2023; research §18):
  - the owner provides heat, oil, electricity and gas unless there is a single-unit meter
    or tank **and** a written rental agreement says the occupant pays;
  - an owner-paid meter may serve several units.

  Encoded as the sourced constraint `ma_105_cmr_410_written_rental_agreement` that the
  landlord view attaches to every shift. Whether an existing "tenant pays electricity"
  lease clause covers heat-pump electricity is a **policy-interpretation question for
  Qiao**. — verified.
- **Technical:**
  - Payback defaults to **real** savings. `paybackIfCostShifted` is reported separately,
    and only when a shift exists.
  - `heatPumpMeterPaidBy` per unit defaults to the unit's electric payer.
  - Field renamed to `projectCommitment` ("project commitment terms" in the UI); same
    calculation.
- **"Boiler needs replacing anyway" baseline** added. Cost from the user's quote,
  otherwise the EEAC incremental cost study's oil boiler $920/ton (2023 $, confidence
  low). — Qiao asked; source found.
- **Tons per unit and annual heating need have no source yet.** Planned order: the user's
  bills and the contractor's quote (medium), else a ResStock stock estimate (low, labelled
  "typical for similar buildings"). No value is used without one. — technical.
- **Two [Open] questions added:** cooling and the electric bill; seasonal heat pump rates.
  — Qiao.

## 2026-11-06 (Phase 1, after milestone 1)

- **Working assumptions never produce definite results.** "Eligible condo unit = has a
  heating meter" stays a working assumption until Mass Save confirms. A unit without a
  meter counts as undecided; the all-units result shows as potential with the pending
  definition. The assumption is used only for ordering and hints ("likely needed"). —
  Qiao.
- **Core user changed to small landlords of 2–4 unit homes, especially owner-occupant
  landlords.** Tenants become the entry point (discover, then send a letter to the
  landlord). Demo story 1 is the owner-occupant landlord; story 2 is the condo. Why: the
  landlord decides and pays, and the owner-occupant feels every side of the split
  incentive. — Qiao.
- **Milestone 2 money answers the landlord's "is it worth it for me?":**
  - own-unit savings;
  - who gains in the rental units;
  - incentive coverage;
  - the cost of a no-rent-increase commitment.

  — Qiao.
- **Two governance designs added** (product.md §6a): model-drafted rules with verbatim
  quotes, an automatic check and Qiao's approval before entering the active rules; and a
  fixed suite of standard scenarios that every rules, engine, prompt or model change must
  pass. Recorded in CONTRIBUTING.md. — Qiao.
- **Node 24 pinned** (`.nvmrc`, `engines: >=24 <25`). — Qiao.

## 2026-11-06 (Checkpoint C: Phase 0 approved)

- **Phase 0 approved.** Phase 1 starts from `docs/phase-1-plan.md` and
  `docs/schema/rules-schema.md` v2. — Qiao.
- **Income-table windows:** use the inferred 2026-10-01 → 2027-09-30 for now, marked
  [Open]. Qiao asks Mass Save on Monday, together with the three questions in
  `docs/outreach/emails.md` §3. — Qiao.
- **Phase 1 runs in milestones.** The lead stops after each one to report what was done,
  the test results, and the next milestone. Milestone 1 = the core rules logic
  (three-valued conditions, the four roles as facts, all-units participation; plan Tasks
  1–7), followed by a Chinese walkthrough of the logic. — Qiao.
- **Outreach drafts moved** to `docs/outreach/emails.md` (older entries refer to the old
  path `docs/outreach-drafts.md`). — per Qiao.

## 2026-11-06 (Phase 0 Step 6: review response)

Based on `docs/reviews/phase-0-response.md` (Review A: 10 accepted, 1 partial; Review B: 6
accepted, 7 partial, 2 rejected).

- **Payer split is the top priority.** The report shows who saves and who may pay more,
  per bill and per person. — Qiao.
- **The three Review A blockers are fixed:**
  - condo participation is a coordination prerequisite, not eligibility;
  - "you'd likely pay close to nothing" is **withdrawn** (supersedes the Step 5 entry
    below), and offers show "up to X%" and who decides;
  - the payer split is modeled.

  — Qiao.
- **Fact namespaces `user.*`, `unit.*`, `building.*`** (review B01). — Qiao.
- **No archive folder.** Versions stay in the data; dates decide; tests use fixed dates;
  `npm run data:status` reports on today's date. Chosen over a status field because both
  dates (effective period and application deadline) already determine the state. A
  stored status would duplicate them and drift. — per Qiao's instruction to weigh
  it.
- **review B04 rejected:** while not every condo unit agrees, 75% is eligible and
  100% shows "N more units needed". It is never "not eligible". — Qiao.
- **Relative deadlines and pre-approvals only where a rule exists:** none found for
  relative deadlines. HEAT Loan pre-approval added. — Qiao; verified against the
  saved official pages.
- **`Benefit` and `Measure` were indeed undefined** in `rules-schema.md`; now defined
  (schema v2). — verified.
- **Income-table windows** set to 2026-10-01 → 2027-09-30 as an inference, Open until
  Mass Save confirms. — technical.

## 2026-11-06 (Phase 0 Step 5: schema, name, stack)

- **Rules-data schema decided: merge** (`docs/schema/rules-schema.md`). Keep Draft A's
  structure, JSON + Zod and per-source quotes. Adopt Draft B's approach for seven issues:
  unresolved conditions, install-date versioning with an archive, prerequisites separate
  from eligibility, counterfactuals by re-evaluation, caps with scope, the missing heat
  pump conditions, and named predicates. Condo 75% / 100% are shown Draft A's way (75% now,
  100% as potential). Why: Draft B's semantics were more correct where Draft A
  over-claimed (`comparison.md` §3). Both drafts and the comparison are committed as a
  record. — Qiao.
- **Three kinds of conditions:**
  - eligibility (facts about the user);
  - prerequisites (things the user does first; **never** make a result "not eligible" or
    "potential" — shown as "eligible, next do X");
  - confirmations (what only the program can confirm).

  — Qiao.
- **Each rule stores the install window and the application deadline separately.** — Qiao.
- **Insulation has no Massachusetts cost source, so show the percentage and "you'd likely
  pay close to nothing", never an invented amount.** Heat pump ($/ton, EEAC invoice study)
  and rooftop solar ($/kW, DOER SMART cost survey) show dollar ranges. — Qiao.
- **Name: Every Floor.** Domain, GitHub and web trademark checks were done by the lead; the
  USPTO search was done by Qiao. No conflict. — Qiao.
- **Stack approved** as in `product.md` §11. — Qiao.
- **Phase 1 plan revised** to the merged schema (`docs/phase-1-plan.md`, 18 tasks). — the lead,
  per Qiao's approval.

## 2026-11-06 (Phase 0 Step 4)

- **Google Solar API caching is [Open] and must be resolved before Phase 3.** Fallback if
  caching isn't allowed: the demo uses PVWatts plus the MassGIS building outline. — Qiao.
- **Municipality comes from the geocoder's county subdivision, never the postal city or
  ZIP** (DEC and MLP depend on it). — from Step 4 test; recorded in data-sources.md.
- **Energy burden statistic: Massachusetts LEAD 2022 figures** (12.9% vs 2.3%), pending
  confirmation of the ACS vintage. — Computed; Qiao asked for LEAD.
- **Rules-data schema: An independent second design (Draft B) is written** from requirements
  only, without seeing Draft A. Draft A stays uncommitted until Draft B
  is done. — Qiao.

## 2026-11-06 (Phase 0 Step 3)

- **Step 3 sources read directly.** — Qiao (option B).
- **v1 program list adds Designated Equity Communities, Mass Save Enhanced
  (moderate-income) incentives, and the MA residential renewable energy income tax credit.**
  Why: DEC and Enhanced are likely the strongest offers in both demo stories; the state
  credit is the only remaining tax credit for owner-bought solar. — Qiao.
- **Unclear rules stay unresolved in the product.** Condo "eligible unit" definition,
  heat pump rebate account holder in rentals, and owner-occupied 100% vs 75% are asked by
  email (`outreach-drafts.md` §3). Until answered, the product says "up to" and points to
  the assessment. — Qiao.
- **Tenant copy for utility low-income community solar:** "get on the discount rate", not
  "sign up", because ECSAP enrolls by lottery. — from Step 3 evidence; Qiao agreed
  to the program list.

## 2026-11-06 (Checkpoint B, Phase 0 Step 2)

- **Source capture uses a headless browser:** mass.gov returns 403 to plain HTTP clients but 200 to headless
  Chromium (tested 2026-11-06). — Qiao.

## 2026-11-06 (Checkpoint A, Phase 0 Step 1)

Based on `docs/review-notes.md`.

- **Signature feature reframed.** The "all eligible units → up to 100%, some → up to 75%"
  insulation rule on the Mass Save landlord page belongs to the *Condo Owners* offer, not
  the landlord offer (landlords get 100% off insulation for rental property). Coordination
  stays the signature feature. Condo buildings get "units still needed". Rental buildings
  get tenant → landlord and landlord → tenants messages. — Why: the v0 example applied the
  rule to the wrong offer (Mass Save page, read 2026-11-06). — Qiao.
- **Four roles in the rules engine (tenant, renting landlord, owner-occupant landlord,
  condo owner); the v1 demo tells two stories: rental building and condo building.** —
  Why: the all-units rule is real for condos; two stories keep the demo focused. — Qiao.
- **One-line story reworded** to "Massachusetts is piloting human navigators in six
  cities…". The coverage map is labeled as pilot coverage. — Why: MassCEC calls it a
  pilot; "can't scale" was our inference. — Qiao.
- **Data model: electric and gas utility stored separately, plus heating fuel; per-unit
  `heat_paid_by` and `electric_paid_by`, asked, never guessed.** — Why: MLP towns and
  gas-side programs differ; savings go to whoever pays. — Qiao.
- **Form-first intake; the form is the only data source for calculations.** Optional
  free-text entry: the LLM pre-fills the form, the user confirms, then we calculate. — Why:
  testable, accessible, keeps numbers out of the LLM. — Qiao.
- **Utility-bill reading moved to stretch.** — Why: biggest privacy surface; core flow
  works without it. — Qiao.
- **Uncertainty: low / mid / high named scenarios in v1** (Monte Carlo revisited in v1.5). — Qiao.
- **Income-eligible path added to the v1 program list; federal §25C/§25D credits dropped**
  (not allowed for expenditures after 2025-12-31, P.L. 119-21, IRS FAQ). The FAQ says so. — Qiao.
- **Start user outreach now.** The lead drafts two emails (All In Energy / navigator
  program; a tenant or landlord near BC). Qiao sends them. — Qiao.
- **Energy burden statistic: prefer a Massachusetts figure from DOE's LEAD Tool** (Step 4).
  Fallback is ACEEE 2020 national medians, labeled as national and dated. — Qiao.
- **Remaining review items (6, 7, 10, 11, 15, 16, 19–21, 23) delegated to the lead.** All
  applied to `product.md` as [Proposed]: rules-data staleness flag and expiry test, LLM
  slot-filling, solar meter-allocation check, hand-off + "not advice" note, v1 success
  criteria, multilingual note, tenant rent-increase concern and Energy Aligned Lease for
  Step 3. — Qiao delegated; applied.

## 2026-11-06 (planning)

- **Portfolio project, not a startup.** Optimize for demonstrated skill and a clear story,
  not for finding paying customers. — Qiao.
- **Navigator, not calculator.** The product turns the human energy navigator's job into
  software; solar is one module. — Based on MassCEC Home Modernization Navigator evidence. — Qiao.
- **Core users: MA 1–4 unit buildings**; three roles: tenant, renting landlord,
  owner-occupant landlord. — The split incentive and whole-building participation rules are
  sharpest here. — Qiao.
- **Signature feature: coordination** ("1 more unit agreeing → 100% off" + generated messages). — Qiao.
- **Numbers only from deterministic code; LLM explains and routes.** — Trust. — Qiao.
- **Ranges, not point estimates; every rule has a source and verified date.** — Qiao.
- **Map is supporting, not the main surface.** Used to confirm the building and show the roof
  for users who can install solar. — Qiao.
- **Data visualization is a priority** for both the product and the pitch. — Qiao.
- **v1 excludes portfolio mode, multilingual, PDF export.** Listed as future work. — Qiao.
- **No Kiro artifacts; general-purpose project.** — Qiao.
- **Workflow: written plan, test-driven implementation, and an independent review at the end of each phase.** — Qiao.
- **Docs mark statements as Decided / Proposed / Open** so later work can refine
  without discarding agreed decisions. — Qiao.

## 2026-11-07 (License and public repository)

- **The code is MIT licensed** (© Qiao Long); data and quoted program text keep their own terms. — Qiao.
- **The repository is public**, with `CONTRIBUTING.md` holding the working rules. — Qiao.
