# Draft rules for review

Automatic check: **passed** on 2026-11-07 (13 files). Every quote below was found verbatim in the saved snapshot in `rules/ma/sources/`.

Approve with `python3 tools/approve_rules.py --by Qiao FILE ...` (files relative to `rules/ma/drafts/`).

## `programs.json`

sha256 `433451db2d6e…`

### masssave_hea

- sources:
  - > The Sponsors of Mass Save offer no-cost virtual or in-person Home Energy Assessments.
    — https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments (Overview, verified 2026-11-06)

### masssave_weatherization

- sources:
  - > Get 75-100 percent off approved insulation and air sealing improvements.
    — https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing (Overview, verified 2026-11-06)

### masssave_income_eligible

- sources:
  - > Through the Income Eligible Program, eligible homeowners and renters can receive a Home Energy Assessment, insulation and air-sealing upgrades, heating and cooling equipment upgrades, as well as new home appliances and more.
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs (Overview, verified 2026-11-06)

### masssave_enhanced

- sources:
  - > Get a fully managed, energy transformation for your home for up to no cost.
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/save-with-enhanced-incentives (Overview, verified 2026-11-06)

### masssave_dec

- sources:
  - > Eligibility is based on where you live—not your income.
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities (Eligibility, verified 2026-11-06)

### masssave_heat_pumps

- sources:
  - > There are three types of rebates: Whole-home, Partial-home and Basic.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Rebates, verified 2026-11-06)

### masssave_heat_loan

- sources:
  - > you may be eligible to receive 0% financing up to $25,000 for qualifying energy-efficiency upgrades
    — https://www.masssave.com/en/residential/rebates-offers-services/financing (Incentives, verified 2026-11-06)

### smart

- sources:
  - > Small (≤25 kW AC) Solar Tariff Generating Units (STGUs) and Low-Income STGUs, as defined in 225 CMR 28.00, receive a flat incentive rate per kilowatt-hour (kWh) of energy generated
    — https://www.mass.gov/info-details/smart-30-program-details (Program Year 2026 Flat Incentive Rates, verified 2026-11-06)

### community_solar

- sources:
  - > Community solar is available to all customers in Massachusetts
    — https://www.eversource.com/residential/save-money-energy/clean-energy-options/solar-energy/community-solar (How Does Community Solar Work, verified 2026-11-06)

### eversource_ecsap

- sources:
  - > The Eversource Community Solar Access Program (ECSAP) includes a simplified billing offering at no cost and an easy enrollment plan to encourage more low-income customer participation.
    — https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access (Eversource ECSAP, verified 2026-11-06)

### utility_discount_rate

- sources:
  - > If you qualify for Fuel Assistance/HEAP or another income-verified program from the list below, you will be referred to your local natural gas or electric utility for a discount on your utility bills.
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs (Utility Discount Rates, verified 2026-11-06)

### ma_solar_tax_credit

- sources:
  - > shall be allowed a credit equal to fifteen per cent of the net expenditure for a renewable energy source property or one thousand dollars, whichever is lesser
    — https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6 (§ 6(d), verified 2026-11-06)

## `predicates.json`

sha256 `41964ec3a55f…`

### condo_eligible_unit

- note: Working assumption until Mass Save answers (outreach/emails.md §3a): a condo unit counts as 'eligible' for the all-units rule if it has a residential heating meter. The confirmation 'condo_eligible_definition' keeps the all-units result 'potential' meanwhile.
- condition: unit.hasResidentialHeatingMeter eq true
- sources:
  - > *Unit must have a residential heating meter
    — https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties (Condo Owners footnote, verified 2026-11-06)

## `income-tables.json`

sha256 `cb4ce201700d…`

### masssave_income_eligible_2026_27

- label: Mass Save Income Eligible, 2026–2027 heating season (max annual household income)
- window: {"from": "2026-10-01", "until": "2027-09-30"}
- bySize: [53585, 70073, 86561, 103049, 119536, 136024, 139116, 142207, 145299, 148390, 151482, 154573, 157665, 160756, 163848, 166939, 170031]
- sources:
  - > 1 ≤ $53,585 $53,586 - $71,447
    — https://www.masssave.com/residential/programs-and-services/income-based-offers (Income Qualifications, verified 2026-11-06)

### masssave_enhanced_2026_27

- label: Mass Save Enhanced Incentive upper limit, 2026–2027 heating season (statewide table; limits vary by area)
- window: {"from": "2026-10-01", "until": "2027-09-30"}
- bySize: [71447, 93431, 115415, 137399, 159382, 181366, 185488, 189610, 193732, 197854, 201976, 206098, 210220, 214342, 218464, 222586, 226708]
- sources:
  - > Enter your zip code to find the household income limits specific to your area.
    — https://www.masssave.com/residential/programs-and-services/income-based-offers (Income Qualifications, verified 2026-11-06)

## `dec.json`

sha256 `3eed29d42909…`

### DEC municipalities

- municipalities (21): Boston, Brockton, Chelsea, Everett, Fall River, Framingham, Fitchburg, Lawrence, Lowell, Lynn, Malden, New Bedford, Oak Bluffs, Pittsfield, Quincy, Revere, Salem, Springfield, Tisbury, Woburn, Worcester
- sources:
  - > The process resulted in selection of 21 communities, including: Boston, Brockton, Chelsea, Everett, Fall River, Framingham, Fitchburg, Lawrence, Lowell, Lynn, Malden, New Bedford, Oak Bluffs, Pittsfield, Quincy, Revere, Salem, Springfield, Tisbury, Woburn, and Worcester. Unitil, Berkshire Gas, and Liberty may further limit eligibility within these communities in their service territories by focusing on certain environmental justice census blocks.
    — https://ma-eeac.org/wp-content/uploads/FINAL-MA-2025-2027-Plan-09-25-24-v2.pdf (p. 29–30, footnote 2; Figure 23 p. 117, verified 2026-11-06)

## `caps.json`

sha256 `90b3547970ed…`

### masssave_hp_money_2026

- window: {"from": "2026-01-01", "until": "2026-12-31"}
- limit: {"type": "money", "amount": 8500}
- sources:
  - > The total rebate amount received is capped at $8,500 per account.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Eligibility — Basic Rebate, verified 2026-11-06)

### masssave_hp_money_2027

- window: {"from": "2027-01-01", "until": null}
- limit: {"type": "money", "amount": 7500}
- sources:
  - > For all Whole-Home projects installed on or after January 1, 2027, the rebate will decrease to $2,350 per ton, capped at $7,500.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Rebates, verified 2026-11-06)

### masssave_whole_home_one_per_account

- window: {"from": "2025-01-01", "until": null}
- limit: {"type": "count", "count": 1}
- sources:
  - > Limit one whole-home rebate per account.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Additional eligibility requirements for the Whole-home Rebate, verified 2026-11-06)

### masssave_heat_loan_lifetime

- window: {"from": "2025-01-01", "until": null}
- limit: {"type": "money", "amount": 25000}
- sources:
  - > Note: The maximum loan amount is over the lifetime of a customer’s energy efficiency upgrades.
    — https://www.masssave.com/en/residential/rebates-offers-services/financing (Incentives, verified 2026-11-06)

## `sequence.json`

sha256 `0ac25f57609a…`

### assessment → weatherization

- reason: Insulation and air-sealing offers are qualified during the Home Energy Assessment.
- sources:
  - > An Energy Specialist will identify energy-saving opportunities throughout your home and make recommendations.
    — https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments (Incentives, verified 2026-11-06)

### assessment → heat_pump

- reason: The assessment report can show the home is weatherized enough for a whole-home rebate (option B), and it is the way into DEC and income-based heat pump offers.
- sources:
  - > (B) Home Energy Assessment report indicates less than $1,000 worth of weatherization recommended
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Additional eligibility requirements for the Whole-home Rebate, verified 2026-11-06)

### weatherization → heat_pump

- reason: Whole-home heat pump rebates require the home to be sufficiently weatherized first.
- sources:
  - > Homes must be sufficiently weatherized prior to heat pump installation
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Additional eligibility requirements for the Whole-home Rebate, verified 2026-11-06)

### rooftop_solar → tax_credit

- reason: The state credit is claimed for the expenditure on the installed system.
- sources:
  - > a credit equal to fifteen per cent of the net expenditure for a renewable energy source property
    — https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6 (§ 6(d), verified 2026-11-06)

## `legal.json`

sha256 `f2df4fa0e198…`

### ma_105_cmr_410_written_rental_agreement

- summary: The owner provides heat, oil, electricity and gas unless the unit has its own meter or tank and a written rental agreement says the occupant pays. A landlord can't move heating cost onto a tenant unilaterally.
- leaseCheck: Check your written rental agreement: does it say the tenant pays for heat (or heating fuel), not only electricity?
- disclaimer: This is not legal advice.
- resources:
  - > The landlord must pay for the heat, hot water, and electricity unless a term in the lease or other written rental agreement requires the tenant to pay for these utilities.
    — https://www.mass.gov/doc/2025-guide-to-landlord-tenant-rights-11182025/download (Does the rent cover heat and electricity?, verified 2026-11-06)
  - > Fuel for hot water and heat: Landlord pays unless you signed a written document saying that the tenant must pay.
    — https://www.masslegalhelp.org/sites/default/files/2025-02/06%20Utilities%202025_0.pdf (Who pays for utilities, verified 2026-11-06)
- sources:
  - > The owner shall provide the electricity or gas used in each dwelling unit unless: (1) Such electricity or gas is metered through a meter which serves only the dwelling unit
    — https://www.mass.gov/doc/105-cmr-410-minimum-standards-of-fitness-for-human-habitation-state-sanitary-code-chapter-ii/download (410.200(A), verified 2026-11-06)
  - > A written rental agreement provides for payment by the occupant.
    — https://www.mass.gov/doc/105-cmr-410-minimum-standards-of-fitness-for-human-habitation-state-sanitary-code-chapter-ii/download (410.200(A)(2), verified 2026-11-06)
  - > The owner shall provide for the oil used for heating and/or hot water in each dwelling unit unless:
    — https://www.mass.gov/doc/105-cmr-410-minimum-standards-of-fitness-for-human-habitation-state-sanitary-code-chapter-ii/download (410.210, verified 2026-11-06)
  - > then such electricity or gas may be metered through meters which serve more than one dwelling unit.
    — https://www.mass.gov/doc/105-cmr-410-minimum-standards-of-fitness-for-human-habitation-state-sanitary-code-chapter-ii/download (410.200(B), verified 2026-11-06)

## `offers/assessment.json`

sha256 `1845dc28e3c0…`

### No-cost Home Energy Assessment (`masssave_hea@1`)

- Measure: assessment; applies to: user; recipient: household; enrollment: apply
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"])
- Benefit: `{"type": "none"}` (exact)
- Sources:
  - > Customers must live in a 1- to 4-unit home
    — https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing (Eligibility, verified 2026-11-06)
  - > Your municipal utility is not part of the Mass Save program.
    — https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing (How to Participate, verified 2026-11-06)

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

## `offers/financing.json`

sha256 `61e7264f797d…`

### 0% HEAT Loan up to $25,000 (`masssave_heat_loan@1`)

- Measure: financing; applies to: user; recipient: property_owner; enrollment: apply
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: (user.role in ["renting_landlord", "owner_occupant_landlord", "condo_owner"] AND (building.electricIsMunicipal eq false OR (building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] AND unit.heatingFuel eq "natural_gas")))
- Benefit: `{"type": "loan", "maxPrincipal": 25000, "apr": 0}` (up_to)
- Prerequisite (action): If the loan pays for a whole-home heat pump, windows or weatherization, complete a Home Energy Assessment first. — done when building.heaCompleted eq true
- Prerequisite (action): Get the loan authorized and approved before you pay the contractor; the lender's check is signed over to the contractor when the work is done. — done when —
- Sources:
  - > Loan applicant must be the homeowner
    — https://www.masssave.com/en/residential/rebates-offers-services/financing (Eligibility, verified 2026-11-06)
  - > Municipal electric customers can take advantage of the HEAT Loan offer if their home is heated with natural gas, provided by a Mass Save Sponsor
    — https://www.masssave.com/en/residential/rebates-offers-services/financing (Eligibility, verified 2026-11-06)

## `offers/heat-pumps.json`

sha256 `3806584d1d30…`

### Whole-home heat pump rebate (installed in 2026) (`ashp_whole_home@2026`)

- Measure: heat_pump; applies to: each_unit; recipient: property_owner; enrollment: apply
- Dates (installation): 2026-01-01 → 2026-12-31; application deadline: 2027-02-28
- Eligibility: (unit.occupiedAllWinter eq true AND ((unit.heatingFuel in ["oil", "propane", "electric_resistance"] AND building.electricIsMunicipal eq false) OR (unit.heatingFuel eq "natural_gas" AND building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"])))
- Benefit: `{"type": "per_ton", "rate": 2650, "cap": 8500}` (up_to)
- Prerequisite (action): Make sure the home is sufficiently weatherized: built 2000 or later, or the assessment recommends under $1,000 of weatherization, or the recommended weatherization is done. — done when (building.yearBuilt gte 2000 OR building.weatherizationRecsDone eq true)
- Prerequisite (action): For rented units, the landlord approves the work. — done when (unit.occupancy eq "owner" OR building.ownerApproval eq true)
- Prerequisite (requirement): The heat pump must be the home's only heating and cooling source. — done when —
- Prerequisite (requirement): Use a contractor in the Mass Save Heat Pump Installer Network. — done when —
- Prerequisite (requirement): Choose ENERGY STAR Cold Climate equipment from the Mass Save qualified list. — done when —
- Confirmation by Mass Save rebate processing (Resource Innovations): The rebate is applied for with a residential electric account (replacing oil, propane or electric resistance) or a residential gas account (replacing gas). In a rental unit where the tenant holds that account and the landlord buys the heat pump, who applies? (asked when unit.occupancy eq "renter")
- Sources:
  - > Whole-Home $2,650 per ton * up to $8,500
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (2026 Air Source Heat Pump Rebates, verified 2026-11-06)
  - > Rebate form and supporting documentation must be received by February 28, 2027.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Eligibility, verified 2026-11-06)
  - > Only available to residences that are occupied full time during the winter heating season.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Additional eligibility requirements for the Whole-home Rebate, verified 2026-11-06)

### Whole-home heat pump rebate (installed from 2027) (`ashp_whole_home@2027`)

- Measure: heat_pump; applies to: each_unit; recipient: property_owner; enrollment: apply
- Dates (installation): 2027-01-01 → open; application deadline: —
- Eligibility: (unit.occupiedAllWinter eq true AND ((unit.heatingFuel in ["oil", "propane", "electric_resistance"] AND building.electricIsMunicipal eq false) OR (unit.heatingFuel eq "natural_gas" AND building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"])))
- Benefit: `{"type": "per_ton", "rate": 2350, "cap": 7500}` (up_to)
- Prerequisite (action): Make sure the home is sufficiently weatherized: built 2000 or later, or the assessment recommends under $1,000 of weatherization, or the recommended weatherization is done. — done when (building.yearBuilt gte 2000 OR building.weatherizationRecsDone eq true)
- Prerequisite (action): For rented units, the landlord approves the work. — done when (unit.occupancy eq "owner" OR building.ownerApproval eq true)
- Prerequisite (requirement): The heat pump must be the home's only heating and cooling source. — done when —
- Prerequisite (requirement): Use a contractor in the Mass Save Heat Pump Installer Network. — done when —
- Prerequisite (requirement): Choose ENERGY STAR Cold Climate equipment from the Mass Save qualified list. — done when —
- Confirmation by Mass Save rebate processing (Resource Innovations): The rebate is applied for with a residential electric account (replacing oil, propane or electric resistance) or a residential gas account (replacing gas). In a rental unit where the tenant holds that account and the landlord buys the heat pump, who applies? (asked when unit.occupancy eq "renter")
- Sources:
  - > For all Whole-Home projects installed on or after January 1, 2027, the rebate will decrease to $2,350 per ton, capped at $7,500.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Rebates, verified 2026-11-06)
  - > Only available to residences that are occupied full time during the winter heating season.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Additional eligibility requirements for the Whole-home Rebate, verified 2026-11-06)

### Partial-home heat pump rebate (installed in 2026) (`ashp_partial_home@2026`)

- Measure: heat_pump; applies to: each_unit; recipient: property_owner; enrollment: apply
- Dates (installation): 2026-01-01 → 2026-12-31; application deadline: 2027-02-28
- Eligibility: (unit.occupiedAllWinter eq true AND ((unit.heatingFuel in ["oil", "propane", "electric_resistance"] AND building.electricIsMunicipal eq false) OR (unit.heatingFuel eq "natural_gas" AND building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"])))
- Benefit: `{"type": "per_ton", "rate": 1125, "cap": 8500}` (up_to)
- Prerequisite (action): For rented units, the landlord approves the work. — done when (unit.occupancy eq "owner" OR building.ownerApproval eq true)
- Prerequisite (requirement): Use a contractor in the Mass Save Heat Pump Installer Network. — done when —
- Prerequisite (requirement): Choose ENERGY STAR Cold Climate equipment from the Mass Save qualified list. — done when —
- Prerequisite (requirement): Install an integrated control for zones where oil, propane or gas stays in use. — done when —
- Confirmation by Mass Save rebate processing (Resource Innovations): The rebate is applied for with a residential electric account (replacing oil, propane or electric resistance) or a residential gas account (replacing gas). In a rental unit where the tenant holds that account and the landlord buys the heat pump, who applies? (asked when unit.occupancy eq "renter")
- Sources:
  - > Partial-Home $1,125 per ton up to $8,500
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (2026 Air Source Heat Pump Rebates, verified 2026-11-06)
  - > Rebate form and supporting documentation must be received by February 28, 2027.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Eligibility, verified 2026-11-06)
  - > Only available to residences that are occupied full time during the winter heating season.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Additional eligibility requirements for the Whole-home Rebate, verified 2026-11-06)

### Partial-home heat pump rebate (installed from 2027) (`ashp_partial_home@2027`)

- Measure: heat_pump; applies to: each_unit; recipient: property_owner; enrollment: apply
- Dates (installation): 2027-01-01 → open; application deadline: —
- Eligibility: (unit.occupiedAllWinter eq true AND ((unit.heatingFuel in ["oil", "propane", "electric_resistance"] AND building.electricIsMunicipal eq false) OR (unit.heatingFuel eq "natural_gas" AND building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"])))
- Benefit: `{"type": "per_ton", "rate": 1000, "cap": 7500}` (up_to)
- Prerequisite (action): For rented units, the landlord approves the work. — done when (unit.occupancy eq "owner" OR building.ownerApproval eq true)
- Prerequisite (requirement): Use a contractor in the Mass Save Heat Pump Installer Network. — done when —
- Prerequisite (requirement): Choose ENERGY STAR Cold Climate equipment from the Mass Save qualified list. — done when —
- Prerequisite (requirement): Install an integrated control for zones where oil, propane or gas stays in use. — done when —
- Confirmation by Mass Save rebate processing (Resource Innovations): The rebate is applied for with a residential electric account (replacing oil, propane or electric resistance) or a residential gas account (replacing gas). In a rental unit where the tenant holds that account and the landlord buys the heat pump, who applies? (asked when unit.occupancy eq "renter")
- Sources:
  - > For all The Partial-Home projects installed on or after January 1, 2027, the rebate will decrease to $1,000 per ton, capped at $7,500.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Rebates, verified 2026-11-06)
  - > Only available to residences that are occupied full time during the winter heating season.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Additional eligibility requirements for the Whole-home Rebate, verified 2026-11-06)

### Basic heat pump rebate (installed in 2026) (`ashp_basic@2026`)

- Measure: heat_pump; applies to: each_unit; recipient: property_owner; enrollment: apply
- Dates (installation): 2026-01-01 → 2026-12-31; application deadline: 2027-02-28
- Eligibility: (building.electricIsMunicipal eq false AND (unit.heatingFuel eq "heat_pump" OR unit.occupiedAllWinter eq false))
- Benefit: `{"type": "per_ton", "rate": 250, "cap": 2500}` (up_to)
- Prerequisite (requirement): Use a contractor in the Mass Save Heat Pump Installer Network. — done when —
- Prerequisite (requirement): The equipment must be new. — done when —
- Sources:
  - > Basic $250 per ton up to $2,500
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (2026 Air Source Heat Pump Rebates, verified 2026-11-06)
  - > Basic rebates are available to customers who are NOT displacing fossil fuel or electric resistance heat in their home.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Rebates, verified 2026-11-06)

### Income-based heat pump incentive: up to $16,000, or up to no cost through turnkey services (installed in 2026) (`ashp_enhanced@2026`)

- Measure: heat_pump; applies to: user; recipient: property_owner; enrollment: apply
- Dates (installation): 2026-10-01 → 2026-12-31; application deadline: 2027-02-28
- Eligibility: (incomeAbove masssave_income_eligible_2026_27 AND incomeAtMost masssave_enhanced_2026_27 AND unit.occupancy eq "owner" AND unit.occupiedAllWinter eq true AND unit.heatingFuel in ["oil", "propane", "electric_resistance"] AND building.electricIsMunicipal eq false)
- Benefit: `{"type": "percent_of_cost_capped", "pct": 100, "cap": 16000, "costOf": "heat_pump"}` (up_to)
- Prerequisite (requirement): Use a contractor in the Mass Save Heat Pump Installer Network. — done when —
- Confirmation by Mass Save income verification: Income limits vary by area. Does this household's income qualify where it lives? (asked when —)
- Sources:
  - > Income-Based Enhanced Incentives ** Up to $16,000 or up to no cost through Turnkey Services
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (2026 Air Source Heat Pump Rebates, verified 2026-11-06)
  - > Pre-existing fuel type must be oil, propane, or electric resistance.
    — https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps (Rebates footnote, verified 2026-11-06)

### Up to no-cost heat pump for a rental unit in a Designated Equity Community (`dec_rental_heat_pump_no_cost@2025_2027`)

- Measure: heat_pump; applies to: each_unit; recipient: property_owner; enrollment: via_landlord
- Dates (as_of): 2025-01-01 → 2027-12-31; application deadline: —
- Eligibility: (building.isDec eq true AND unit.occupancy eq "renter" AND unit.heatingFuel in ["oil", "propane", "electric_resistance"] AND building.electricIsMunicipal eq false)
- Benefit: `{"type": "percent_of_cost", "pct": 100, "costOf": "heat_pump"}` (up_to)
- Prerequisite (action): The landlord signs a form committing not to raise the rent or evict for a period after receiving the incentive. The length of the period isn't published. — done when —
- Prerequisite (action): The landlord approves the upgrade. — done when building.ownerApproval eq true
- Confirmation by the Mass Save turnkey vendor: Would a heat pump be expected to increase this renter's energy burden? (asked when —)
- Sources:
  - > Up to no-cost air source heat pumps*
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities (Offers for rental properties and landlords in Designated Equity Communities, verified 2026-11-06)

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

## `offers/weatherization.json`

sha256 `26b59588f1c0…`

### 100% off insulation for a rental unit (`masssave_insulation_rental_unit@1`)

- Measure: weatherization; applies to: each_unit; recipient: property_owner; enrollment: via_landlord
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: (unit.occupancy eq "renter" AND (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"]))
- Benefit: `{"type": "percent_of_cost", "pct": 100, "costOf": "weatherization"}` (up_to)
- Prerequisite (action): The property owner approves the work. — done when building.ownerApproval eq true
- Sources:
  - > An instant incentive of 100% off insulation upgrades for your rental property
    — https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties (Landlord offer, verified 2026-11-06)

### At least 75% off insulation for an owner-occupied home (`masssave_insulation_owner_standard@1`)

- Measure: weatherization; applies to: each_unit; recipient: property_owner; enrollment: via_assessment
- Dates (as_of): 2025-01-01 → open; application deadline: —
- Eligibility: (unit.occupancy eq "owner" AND building.ownership eq "single_owner" AND (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"]))
- Benefit: `{"type": "percent_of_cost", "pct": 75, "costOf": "weatherization"}` (minimum)
- Sources:
  - > 75-100% off approved insulation improvements
    — https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments (Incentives, verified 2026-11-06)

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

### 100% off insulation and air sealing in a Designated Equity Community (`masssave_dec_weatherization@2025_2027`)

- Measure: weatherization; applies to: each_unit; recipient: property_owner; enrollment: via_assessment
- Dates (as_of): 2025-01-01 → 2027-12-31; application deadline: —
- Eligibility: (building.isDec eq true AND (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"]))
- Benefit: `{"type": "percent_of_cost", "pct": 100, "costOf": "weatherization"}` (up_to)
- Prerequisite (action): For rented units, the landlord signs a form committing not to raise the rent or evict for a period after receiving the incentive. The length of the period isn't published. — done when unit.occupancy eq "owner"
- Prerequisite (action): For rented units, the landlord approves the work. — done when (unit.occupancy eq "owner" OR building.ownerApproval eq true)
- Sources:
  - > If your home is in a Designated Equity Community (DEC), you qualify for 100% off weatherization upgrades, including insulation and air sealing, when recommended by an Energy Specialist during a Home Energy Assessment.
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities (Lower energy bills—at no cost, verified 2026-11-06)

### No-cost weatherization through the Income Eligible Program (`masssave_income_eligible_weatherization@2026_27`)

- Measure: weatherization; applies to: user; recipient: property_owner; enrollment: apply
- Dates (as_of): 2026-10-01 → 2027-09-30; application deadline: —
- Eligibility: (incomeAtMost masssave_income_eligible_2026_27 AND (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"]))
- Benefit: `{"type": "percent_of_cost", "pct": 100, "costOf": "weatherization"}` (up_to)
- Sources:
  - > Installation of additional attic, wall, and basement insulation
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs (Incentives, verified 2026-11-06)

### No-cost weatherization with Enhanced (moderate-income) offers (`masssave_enhanced_weatherization@2026_27`)

- Measure: weatherization; applies to: user; recipient: property_owner; enrollment: apply
- Dates (as_of): 2026-10-01 → 2027-09-30; application deadline: —
- Eligibility: (incomeAbove masssave_income_eligible_2026_27 AND incomeAtMost masssave_enhanced_2026_27 AND unit.occupancy eq "owner" AND (building.electricIsMunicipal eq false OR building.gasUtility in ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"]))
- Benefit: `{"type": "percent_of_cost", "pct": 100, "costOf": "weatherization"}` (up_to)
- Confirmation by Mass Save income verification: Income limits vary by area. Does this household's income qualify where it lives? (asked when —)
- Sources:
  - > No-cost weatherization upgrades
    — https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/save-with-enhanced-incentives (Incentives, verified 2026-11-06)

