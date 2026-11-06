# Decisions log

Newest first. Format: date — decision — why — decided by.

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
