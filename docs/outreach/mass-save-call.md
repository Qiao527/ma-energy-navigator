# Mass Save call: question list

For Qiao's phone call on Monday 2026-11-09. Number: **866-527-SAVE (7283)**
(https://www.masssave.com/en/contact). Qiao makes this call.

- **Order:** most important first. If the call is short, questions 1–6 are the ones that
  change what Story 1 and Story 2 show.
- **"Affects"** names the rule (`offer id`, file in `rules/ma/drafts/`) and the standard
  scenarios whose results may change.
- **After the call:** record each answer in `docs/incentives-research.md`, without the
  representative's name. Note the date and whether it was "official / written down" (ask
  for a link) or "said on the phone". Then the rule changes go through the drafting
  workflow (`docs/product.md` §6a). Changed scenario results need Qiao's approval.

## A. Story 1: owner-occupant landlord, triple-decker

### 1. Heat pump rebate in a rental unit: who applies, on which account?

- **Ask:** In a rental unit where the tenant holds the electric account and the landlord
  buys and owns the heat pump, who applies for the rebate, and on which account?
- **Ask:** Does the $8,500 per-account cap apply to each unit's account separately?
- **Ask:** Can the landlord apply for three units at once?
- **Why:** the page says "must apply using a residential electric account" and "Limit one
  whole-home rebate per account". In a triple-decker the tenant often holds the account.
- **Now:** results for rental units are "potential", with this as a confirmation. The cap
  "assumes one account per unit".
- **Affects:**
  - `ashp_whole_home@2026/2027` and `ashp_partial_home@2026/2027` (`offers/heat-pumps.json`), confirmation on rental units;
  - caps `masssave_hp_money_2026/2027` and `masssave_whole_home_one_per_account` (`caps.json`).
- **Scenarios:** `story1-owner-occupant`, `story1-tenant-entry`, `story1-install-2027`,
  `story1-planning-after-deadline`, `story1-installed-deadline-passed`.

### 2. DEC no-cost heat pump for a rental: the no-rent-increase commitment

- **Ask:** The 2025–2027 Plan says landlords sign a form "committing not to raise rent or
  evict tenants for a period". How long is the period?
- **Ask:** Is it per unit or for the whole building?
- **Ask:** What happens at lease renewal?
- **Ask:** Can we see the form?
- **Why:** this is the "project commitment terms" in the landlord view. Its cost is
  unknown until the period is known.
- **Now:** the prerequisite says "the length of the period isn't published". The landlord
  view leaves the commitment cost out of payback and says so.
- **Affects:**
  - `dec_rental_heat_pump_no_cost@2025_2027` prerequisite `no_rent_increase_commitment` (`offers/heat-pumps.json`);
  - `projectCommitment` in `engine/src/landlord.ts`.
- **Scenarios:** all `story1-*`.

### 3. DEC no-cost heat pump: "not expected to increase renters' energy burden"

- **Ask:** How is this checked?
- **Ask:** If the landlord pays for oil heat today and the tenant pays electricity, does a
  heat pump on the tenant's meter count as increasing the renter's energy burden?
- **Ask:** Does an owner-paid heat pump meter, or an agreement to lower rent, change the
  answer?
- **Why:** this is the cost-shifting case (105 CMR 410, research §18). Mass Save's own test
  may already rule out the shifted setup.
- **Now:** the turnkey vendor's confirmation keeps the result "potential".
- **Affects:**
  - `dec_rental_heat_pump_no_cost@2025_2027` confirmation (`offers/heat-pumps.json`);
  - fair options in the landlord view.
- **Scenarios:** all `story1-*`.

### 4. One assessment for a building that is part owner-occupied and part rented

- **Ask:** In a triple-decker where the owner lives on one floor and rents the other two,
  does one Home Energy Assessment cover all three units?
- **Ask:** Does the owner's unit get the homeowner offer while the rental units get the
  landlord 100% offer?
- **Now:** the rules apply them per unit. This is our inference from the two pages
  (research §2.4).
- **Affects:**
  - `masssave_insulation_rental_unit@1`, `masssave_insulation_owner_standard@1` and `masssave_dec_weatherization@2025_2027` (`offers/weatherization.json`);
  - `masssave_hea@1` (`offers/assessment.json`).
- **Scenarios:** all `story1-*`, `belmont-mlp`.

### 5. Already installed, paperwork deadline missed

- **Ask:** The page says "Rebate form and supporting documentation must be received by
  February 28, 2027" for 2026 purchases. Is there any exception or late-submission path?
- **Ask:** Can a DEC rental unit still use the no-cost turnkey offer if the landlord
  already installed heat pumps through their own contractor?
- **Now:** after the deadline, an installed project sees "application deadline passed"
  with the date. The DEC no-cost offer is still shown as "potential" for an installed
  project, which is probably wrong (see the report to Qiao).
- **Affects:**
  - `ashp_*@2026` `applicationDeadline` (`offers/heat-pumps.json`);
  - `dec_rental_heat_pump_no_cost@2025_2027`.
- **Scenarios:** `story1-installed-deadline-passed`.

## B. Story 2: condo triple-decker

### 6. Condo "eligible unit" for the 100% all-units offer

- **Ask:** The landlord page says condo owners get up to 100% off insulation "if all
  eligible units in a 2–4-unit building participate", and "*Unit must have a residential
  heating meter". What makes a unit "eligible"?
- **Ask:** If one unit has no residential heating meter, must it take part for the others
  to get 100%?
- **Now:** working assumption (predicate `condo_eligible_unit`): a unit with a residential
  heating meter. It never decides anything on its own. The 100% result stays "potential"
  with "N more units needed" as a hint.
- **Affects:**
  - predicate `condo_eligible_unit` (`predicates.json`);
  - `masssave_insulation_condo_all_units@1` and its confirmation `condo_eligible_definition` (`offers/weatherization-condo.json`).
- **Scenarios:** `condo-all-agreed`, `condo-one-declined`, `condo-one-undecided`,
  `condo-no-meter`.

## C. Income tables and income-based offers

### 7. Validity dates of the 2026–2027 income tables

- **Ask:** The Income Eligible and Enhanced tables say "2026 – 2027 Heating Season". On
  which dates do they start and end?
- **Ask:** When will the next tables be published?
- **Now:** inferred 2026-10-01 → 2027-09-30 (the LIHEAP program year), marked [Open]. Offers
  that use a table end with it.
- **Affects:**
  - `masssave_income_eligible_2026_27` and `masssave_enhanced_2026_27` (`income-tables.json`);
  - `masssave_income_eligible_weatherization@2026_27` (`offers/weatherization.json`);
  - `masssave_enhanced_weatherization@2026_27` (`offers/weatherization.json`);
  - `ashp_enhanced@2026` (`offers/heat-pumps.json`).
- **Scenarios:** `story1-tenant-entry`.

### 8. Enhanced income limits by area

- **Ask:** The page says "a family of four with a household income of $132,000 or less may
  qualify", but the table shows $137,399 for four. It also says limits are specific to
  your area. Is the table the highest limit anywhere in the state?
- **Ask:** Where is the full list by area?
- **Now:** a confirmation ("Income limits vary by area") keeps these results "potential".
- **Affects:**
  - `masssave_enhanced_weatherization@2026_27` (`offers/weatherization.json`);
  - `ashp_enhanced@2026` (`offers/heat-pumps.json`).

### 9. A renter in the Income Eligible Program: landlord approval

- **Ask:** Does insulation or heating work in a rental unit through the Income Eligible
  Program need the landlord's written approval?
- **Ask:** Who signs?
- **Now:** our inference is "yes for heating systems". The page doesn't say.
- **Affects:** `masssave_income_eligible_weatherization@2026_27`
  (`offers/weatherization.json`), whether an `owner_approval` prerequisite is added.
- **Scenarios:** `story1-tenant-entry`.

## D. Owner-occupied homes

### 10. When does an owner-occupied home get 100% instead of 75%?

- **Ask:** The homeowner page says "75–100% off approved insulation". Apart from DECs,
  income-based offers and the condo all-units rule, is there another route to 100%?
- **Now:** "at least 75%". Other routes are separate offers.
- **Affects:** `masssave_insulation_owner_standard@1` (`offers/weatherization.json`).
- **Scenarios:** `belmont-mlp`, `story1-*` (the owner's own floor, when the building is
  not a DEC).

## E. If there is time (no rule depends on these yet)

- **11. Seasonal heat pump electric rates** (product.md Open Q12). Does Mass Save list
  each utility's winter heat pump rate, or only the utility does? (The engine computes
  nothing with it yet.)
- **12. New England Heat Pump Accelerator (NEHPA).** Do its point-of-sale incentives stack
  with Mass Save heat pump rebates? (Not in the rules data.)
