# Draft rules for review — batch-2

Automatic check: **passed** on 2026-11-07 (3 files). Every quote below was found verbatim in the saved snapshot in `rules/ma/sources/`.

Approve with `python3 tools/approve_rules.py --by Qiao FILE ...` (files relative to `rules/ma/drafts/`).

## `offers/bill-assistance.json`

sha256 `19a34c0463ca…`

### Ask your utility about the low-income discount rate (`utility_discount_rate_referral@1`)

- Measure: bill_assistance; applies to: user; recipient: household; enrollment: referral
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: user.onDiscountRate eq false
- Benefit: `{"type": "none"}` (exact)
- Confirmation by your utility: Eligibility comes from enrollment in Fuel Assistance (HEAP), SNAP, MassHealth or a similar program. Is the household enrolled in one? (asked when —)
- Sources:
  - > Discounted rates that lower actual charges for your energy usage may be available.
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs (Utility Discount Rates, verified 2026-11-06)

## `offers/solar.json`

sha256 `0e43446767c6…`

### SMART 3.0 incentive for rooftop solar ≤25 kW (Program Year 2026) (`smart_small@py2026`)

- Measure: rooftop_solar; applies to: user; recipient: property_owner; enrollment: apply
- Dates (as_of): 2026-01-01 → 2026-12-31; application deadline: 2026-12-31
- Eligibility: (user.role in ["renting_landlord", "owner_occupant_landlord", "condo_owner"] AND building.electricIsMunicipal eq false)
- Benefit: `{"type": "per_kwh", "rate": 0.03, "years": 20}` (exact)
- Sources:
  - > STGUs ≤25 kW AC $0.03/kWh
    — https://www.mass.gov/info-details/smart-30-program-details (Program Year 2026 Flat Incentive Rates (≤25 kW), verified 2026-11-06)
  - > In a given Program Year, DOER will accept applications from January 1 through December 31 of that year.
    — https://www.mass.gov/info-details/smart-30-program-details (Program Year Annual Capacity and Rates, verified 2026-11-06)
  - > All STGUs will be eligible to receive compensation under 225 CMR 28.00 for 20 years from the STGU’s Incentive Payment Effective Date.
    — https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download (225 CMR 28.13(1), verified 2026-11-06)

### SMART 3.0 low-income rate for rooftop solar ≤25 kW (Program Year 2026) (`smart_low_income@py2026`)

- Measure: rooftop_solar; applies to: user; recipient: property_owner; enrollment: apply
- Dates (as_of): 2026-01-01 → 2026-12-31; application deadline: 2026-12-31
- Eligibility: (user.role in ["renting_landlord", "owner_occupant_landlord", "condo_owner"] AND building.electricIsMunicipal eq false AND user.onDiscountRate eq true)
- Benefit: `{"type": "per_kwh", "rate": 0.06, "years": 20}` (exact)
- Confirmation by the solar installer and DOER: Low Income Customer also covers Low Income Eligible Areas, other needs-based programs and self-attestation. Does this household qualify? (asked when —)
- Sources:
  - > Low Income STGUs $0.06/kWh
    — https://www.mass.gov/info-details/smart-30-program-details (Program Year 2026 Flat Incentive Rates (≤25 kW), verified 2026-11-06)

### Community solar: at least 40% off the credits you receive (low-income customers) (`community_solar_low_income_floor@smart3`)

- Measure: community_solar; applies to: user; recipient: household; enrollment: apply
- Dates (as_of): 2025-09-12 → open; application deadline: —
- Eligibility: (building.electricIsMunicipal eq false AND user.onDiscountRate eq true)
- Benefit: `{"type": "min_discount_on_credits", "pct": 40}` (minimum)
- Sources:
  - > Low Income Customers shall receive not less than a 40 percent discount on the value of allocated Bill Credits from the Community Shared STGU to the Low Income Customer.
    — https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download (225 CMR 28.07(5)(c)1.b, verified 2026-11-06)

### Community solar: at least 20% off the credits you receive (`community_solar_standard_floor@smart3`)

- Measure: community_solar; applies to: user; recipient: household; enrollment: apply
- Dates (as_of): 2025-09-12 → open; application deadline: —
- Eligibility: building.electricIsMunicipal eq false
- Benefit: `{"type": "min_discount_on_credits", "pct": 20}` (minimum)
- Sources:
  - > All other customers shall receive not less than a 20 percent discount on the value of allocated Bill Credits from the Community Shared STGU to the End- use Customer.
    — https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download (225 CMR 28.07(5)(c)1.b, verified 2026-11-06)

### You may be selected for Eversource's no-cost low-income community solar (`eversource_ecsap@1`)

- Measure: community_solar; applies to: user; recipient: household; enrollment: auto_selected
- Dates (as_of): 2024-06-01 → open; application deadline: —
- Eligibility: (building.electricUtility eq "eversource" AND user.onDiscountRate eq true)
- Benefit: `{"type": "none"}` (exact)
- Sources:
  - > In its filings, Eversource detailed that the ECSAP includes a target of $420 in annual bill savings for each low-income customer enrolled
    — https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access (Eversource ECSAP, verified 2026-11-06)

### Share rooftop solar credits with other units' accounts (net metering, Schedule Z) (`net_metering_allocation@1`)

- Measure: rooftop_solar; applies to: user; recipient: property_owner; enrollment: apply
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: (user.role in ["renting_landlord", "owner_occupant_landlord", "condo_owner"] AND building.electricIsMunicipal eq false)
- Benefit: `{"type": "none"}` (exact)
- Prerequisite (action): File Schedule Z with the utility to say which accounts get what share of the credits (up to 4 changes a year; same utility territory and load zone for systems of 25 kW or less). — done when —
- Sources:
  - > The host customer must fill out a form called Schedule Z to let the electric company know which account(s) the net metering credits should go to.
    — https://www.mass.gov/info-details/net-metering-guide (Allocation of net metering credits, verified 2026-11-06)

### Massachusetts tax credit: 15% of solar cost, up to $1,000 (`ma_solar_tax_credit@1`)

- Measure: tax_credit; applies to: user; recipient: household; enrollment: apply
- Dates (installation): 2026-01-01 → open; application deadline: —
- Eligibility: (user.role in ["owner_occupant_landlord", "condo_owner"] AND unit.occupancy eq "owner")
- Benefit: `{"type": "percent_of_cost_capped", "pct": 15, "cap": 1000, "costOf": "rooftop_solar"}` (up_to)
- Sources:
  - > any owner or tenant of residential property located in the commonwealth who is not a dependent of another taxpayer and who occupies said property as his principal residence, shall be allowed a credit equal to fifteen per cent of the net expenditure for a renewable energy source property or one thousand dollars, whichever is lesser
    — https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6 (§ 6(d), verified 2026-11-06)

## `offers/weatherization-condo.json`

sha256 `57dbdeb7cd49…`

### Up to 100% off insulation when every eligible condo unit takes part (`masssave_insulation_condo_all_units@1`)

- Measure: weatherization; applies to: each_unit; recipient: property_owner; enrollment: via_assessment
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: (building.ownership eq "condo" AND building.unitCount gte 2 AND unit.hasResidentialHeatingMeter eq true AND (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"]))
- Benefit: `{"type": "percent_of_cost", "pct": 100, "costOf": "weatherization"}` (up_to)
- Prerequisite (coordination): Every eligible unit in the building takes part. — done when every unit where [condo_eligible_unit] has unit.participating eq true
- Confirmation by Mass Save: Which units count as 'eligible' for the all-units rule? We assume units with a residential heating meter, so the number of units still needed depends on this answer. (asked when —)
- Sources:
  - > Up to 100% off recommended insulation improvements for each unit, if all eligible units in a 2–4-unit building participate (or up to 75% off per unit if only some participate) *
    — https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties (Condo Owners, verified 2026-11-06)
  - > *Unit must have a residential heating meter
    — https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties (Condo Owners footnote, verified 2026-11-06)

### Up to 75% off insulation for a condo unit (`masssave_insulation_condo_some_units@1`)

- Measure: weatherization; applies to: each_unit; recipient: property_owner; enrollment: via_assessment
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: (building.ownership eq "condo" AND building.unitCount gte 2 AND unit.hasResidentialHeatingMeter eq true AND (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"]))
- Benefit: `{"type": "percent_of_cost", "pct": 75, "costOf": "weatherization"}` (up_to)
- Sources:
  - > (or up to 75% off per unit if only some participate)
    — https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties (Condo Owners, verified 2026-11-06)

