# Decisions log

Newest first. Format: date — decision — why — decided by.

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
