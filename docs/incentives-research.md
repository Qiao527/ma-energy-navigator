# Incentives research — evidence base for the rules data

Phase 0, Step 3. Researcher: Qiao Long. Read on **2026-11-06** unless noted.
Qiao chose to read the sources directly
(decision B, 2026-11-06).

**Method.** Official pages were loaded in headless Chromium, because mass.gov blocks plain
HTTP clients. The full page HTML, including collapsed "Eligibility" tabs, was converted to
text. PDFs were downloaded and extracted with pypdf. Quotes below are copied from that text.

**Labels used**
- **[Official]**: read on the administrator's own page, regulation, or statute.
- **[Secondary]**: news, vendor or aggregator source. Not to be encoded until confirmed.
- **[Open]**: not resolved. Flagged for Qiao or a later step.

Nothing here is encoded yet. This file is what the rules data (Phase 1) will be built from.

---

## 0. Summary

| # | Program | Status for v1 | Confidence |
|---|---|---|---|
| 1 | Mass Save Home Energy Assessment (1–4 units) | In | Official |
| 2 | Mass Save insulation & air sealing: homeowner / landlord / condo / renter | In | Official, with gaps (§2.5) |
| 3 | Mass Save Designated Equity Communities (DEC) | **In (new)** | Official; DEC list needs a data source |
| 4 | Mass Save Income Eligible Program (CAP agencies) | In | Official |
| 5 | Mass Save Enhanced (moderate-income) incentives | **In (new)** | Official; income limits vary by area |
| 6 | Mass Save air-source heat pump rebates (2026, with 2027 change) | In | Official |
| 7 | Mass Save HEAT Loan (0%) | In (owners only) | Official |
| 8 | Seasonal heat pump electric rates | Mention only (link out) | Official, no numbers |
| 9 | Community solar, general + SMART 3.0 rules | In | Official |
| 10 | Utility low-income community solar (Eversource ECSAP) | In, as "may be selected", not "sign up" | Official (2024) + Secondary (2026) |
| 11 | SMART 3.0, rooftop ≤25 kW | In | Official |
| 12 | Net metering for rooftop ≤25 kW, incl. credit allocation to other units | In | Official |
| 13 | MA residential renewable energy income tax credit (solar) | **In (new)** | Official statute; sunset date secondary |
| 14 | Federal §25C / §25D | **Out**; FAQ only | Official |
| 15 | Massachusetts Solar for All | **Out** (paused) | Official |
| 16 | Municipal light plant (MLP) handling | In (exclusion + hand-off) | Official |
| 17 | Energy Aligned Lease | Mention in coordination messages | Official (descriptive only) |

---

## 1. Mass Save Home Energy Assessment (HEA)

- **Administrator:** Sponsors of Mass Save: Berkshire Gas, Cape Light Compact,
  Eversource, Liberty Utilities, National Grid, Unitil.
- **Eligible:** "Customers must live in a 1- to 4-unit home." Separate entry points exist
  for homeowners, renters, landlords (1–4) and landlords (5+). [Official]
- **Amount:** no cost. Virtual or in person. Produces a "Decarbonization Report" listing the
  rebates the home qualifies for. [Official]
- **Conditions:** "Eligibility for some rebates and incentives is based on findings from the
  Home Energy Assessment." An HEA is **mandatory** before a whole-home heat pump rebate,
  partial-home bonuses, windows, weatherization, or weatherization barriers financed by
  HEAT Loan (financing page). [Official]
- **Alternative path:** "Direct Weatherization Independent Installation Contractor": skip
  the assessment and go straight to insulation/air-sealing incentives. [Official]
- **Territory:** "Your municipal utility is not part of the Mass Save program." [Official]
- **Renters:** "larger measures like weatherization and heating and cooling system upgrades
  require property owner approval." Renters can act alone on products, appliance rebates,
  smart-thermostat demand response (ConnectedSolutions). [Official]
- **Sources:**
  https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments ;
  https://www.masssave.com/en/residential/for-renters
- **Effective dates:** not stated (ongoing under the 2025–2027 Plan).

## 2. Insulation and air sealing

### 2.1 Homeowner (owner-occupied, 1–4 units)
- "75-100% off approved insulation improvements", "No-cost targeted air sealing". [Official]
- **[Open]** The page doesn't say when an owner gets 100% instead of 75%. From the other
  pages, 100% applies in DECs (§3), for Income Eligible (§4) and Enhanced (§5) households,
  and for condo buildings where all eligible units take part (§2.3). Whether there's any
  other route to 100% needs confirming by phone (866-527-SAVE) or from the Plan.
- Source: https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing

### 2.2 Landlord (renter-occupied units, 1–4 units)
- "An instant incentive of 100% off insulation upgrades for your rental property",
  "No-cost targeted air sealing", rebates on heating/cooling/water heating, 0% financing. [Official]
- Renters page: "A special offer of 100 percent off recommended insulation and air sealing
  improvements". [Official]
- **Residential Turnkey Solutions** (health and safety barriers before weatherization):
  "valid for renter-occupied units in buildings with 1-4 units only; owner-occupied units
  do not qualify." [Official]
- **Income Eligible Multi-Family Retrofit:** "if 50% or more of the tenants in your
  building fit within certain income levels, your property may be eligible". [Official]
- Source: https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties

### 2.3 Condo owners (2–4 unit buildings)
- "Up to 100% off recommended insulation improvements for each unit, if all eligible units in
  a 2–4-unit building participate (or up to 75% off per unit if only some participate)*";
  "*Unit must have a residential heating meter". [Official, same page as 2.2]
- **[Open]** What makes a unit "eligible"? Is it only the heating-meter requirement, or
  more? Does a unit with no heating meter count toward "all"? The answer changes the
  "units still needed" number. Ask Mass Save.

### 2.4 Owner-occupant landlord
- Owner's own unit → homeowner offer (2.1). Rental units → landlord offer (2.2).
  *Inference*, from the two offers' wording. **[Open]** confirm a mixed building is
  handled this way in one assessment.

### 2.5 What this means for the rules engine (inference)
- The insulation percentage depends on **(occupancy of the unit) × (DEC?) × (income tier) ×
  (condo all-units condition)**. The highest applicable offer wins. No source says offers
  stack beyond 100%.
- "Up to" appears everywhere. The engine should present these as "up to X%" with the
  Energy Specialist's assessment as the deciding step, not as a promised number.

## 3. Designated Equity Communities (DEC) — new for v1

- **What:** "neighborhoods across Massachusetts with a high percentage of customers,
  particularly renters and landlords, whom the Mass Save programs have not previously
  reached." Part of the 2025–2027 Plan. [Official]
- **Eligibility:** "based on where you live—not your income … without income verification."
  Checked by **ZIP code** on the site. [Official]
- **Amounts (1–4 units):** 100% off insulation and air sealing. [Official]
- **Rental properties in DECs:** "100% off weatherization", "Up to no-cost air source heat
  pumps*", "Up to 100% off health and safety barrier remediation", turnkey delivery.
  "Landlords must provide approval for upgrades."
  "*Applies to households using delivered fuels or electric resistance heating only, and
  for projects where heat pumps are not expected to increase renters' energy burden."
  [Official]
- **Source:** https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities
- **[Open — Step 4]** The DEC list. The site checks by ZIP through a script; we need the list
  itself (likely in the 2025–2027 Plan filing). Also: is the unit ZIP code or census
  tract? Different answers would mislabel buildings near DEC edges.
- **Why it matters:** for a tenant in a DEC rental, this is likely the strongest offer:
  no income check, no-cost heat pump for oil/propane/electric-resistance homes. It also
  fits the equity principle: it uses location to *prioritize help*, not to label.

## 4. Mass Save Income Eligible Program

- **Administrator:** Sponsors, delivered through local **Community Action Program (CAP)**
  agencies. Phone 866-537-7267. [Official]
- **Eligible:** homeowners **and renters** in 1–4 unit homes, by household income.
  2026–2027 heating season limits [Official]:

  | Household size | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
  |---|---|---|---|---|---|---|---|---|
  | Max annual income | $53,585 | $70,073 | $86,561 | $103,049 | $119,536 | $136,024 | $139,116 | $142,207 |

  (Table continues to 17 people; +$3,091–3,092 per person above 8.)
- **Amounts:** "no-cost upgrades", incl. heat pumps replacing the heating system,
  attic/wall/basement insulation, air sealing, appliance replacement (fridge, freezer,
  dehumidifier, window AC, clothes washer), thermostat, LEDs, eligible windows. [Official]
- **Also on the page:** Fuel Assistance (HEAP) via MASSCAP agencies; utility discount
  rates for households on HEAP, SNAP, MassHealth, WIC, EAEDC, Head Start, public housing,
  school lunch. [Official]
- **Source:** https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs
- **[Open] Validity dates of the table.** The page says only "2026 – 2027 Heating Season".
  The rules data uses 2026-10-01 → 2027-09-30 (the LIHEAP program year) as an
  *inference* until Mass Save confirms. Offers that use the table end with it (review
  review A5).
- **[Open]** For a renter: does the Income Eligible Program need the landlord's approval
  for insulation and heating work? Almost certainly yes for heating systems (*inference*),
  but the page doesn't say.

## 5. Mass Save Enhanced (moderate-income) incentives — new for v1

- **Eligible:** income above the Income Eligible limit, up to a second limit (2026–2027)
  [Official]:

  | Household size | 1 | 2 | 3 | 4 | 5 | 6 |
  |---|---|---|---|---|---|---|
  | Enhanced range | $53,586–71,447 | $70,074–93,431 | $86,562–115,415 | $103,050–137,399 | $119,537–159,382 | $136,025–181,366 |

- **Amounts:** turnkey services: "No-cost weatherization upgrades", "Air source heat pumps
  for up to no cost" (electric, oil or propane heat), panel upgrades and weatherization
  barriers "up to 100%". Self-guided path: enhanced heat pump rebates up to $16,000.
  "All offers … subject to cost effectiveness screening." [Official]
- **Who:** the page says "Eligible homeowners". Renters are told to "work with your
  landlord". [Official]
- **Source:** https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/save-with-enhanced-incentives
- **Ambiguity [Open]:** the page says "a family of four with a household income of $132,000
  or less may qualify", but the table says $137,399 for four. The page also says
  "Enter your zip code to find the household income limits specific to your area". So
  **limits vary by area**, and the table may show the highest. The engine must not treat
  the table as exact. Treat it as a range and send people to the official income tool.

## 6. Air-source heat pump rebates (residential, 1–4 units)

- **Administrator:** Mass Save Sponsors (rebate processing: Resource Innovations).
- **2026 amounts** [Official]:

  | Rebate | 2026 (installed 2026-01-01 … 2026-12-31) | From 2027-01-01 |
  |---|---|---|
  | Whole-home | $2,650/ton, up to $8,500 | $2,350/ton, up to $7,500 |
  | Partial-home | $1,125/ton, up to $8,500 | $1,000/ton, up to $7,500 |
  | Basic | $250/ton, up to $2,500 | not stated |
  | Income-based enhanced | up to $16,000, or up to no cost via turnkey | not stated |

  Tons = AHRI cooling capacity ÷ 12,000 BTU. Partial-home bonuses: $500 weatherization
  bonus (HEA + recommended weatherization within 1 year before / 6 months after), $500
  sizing bonus (sized to 90–120% of design heating load, Manual J). Application deadline for
  2026 installs: 2027-02-28. Serial-number photo required from 2026-10-01. [Official]
- **Conditions** [Official]:
  - Whole-home: heat pump is the sole heating/cooling source. The home must be "sufficiently
    weatherized": (A) built 2000 or later, or (B) the HEA recommends < $1,000 of
    weatherization, or (C) weatherization recommended since 2013 is done. Otherwise the
    project drops to partial-home amounts. One whole-home rebate per account. Home occupied
    full time in winter.
  - Partial-home: keeps an existing boiler/furnace and needs an integrated control.
    Replacing an existing heat pump doesn't qualify (Basic instead).
  - Electric sponsor path: replaces oil, propane or electric resistance, and the electric
    sponsor is Cape Light Compact, Eversource, National Grid or Unitil. **Apply with a
    residential electric account.**
  - Gas sponsor path: replaces natural gas, and the gas sponsor is Berkshire Gas,
    Eversource, Liberty, National Grid or Unitil. **Apply with a residential gas account.**
  - Municipal gas customers can't get the Basic rebate unless a Sponsor serves their
    electricity.
  - Total capped at $8,500 per account. "Rebate amount not to exceed total installation
    cost." Can't be combined with other Mass Save incentives for the same equipment.
  - Installer must be in the Mass Save Heat Pump Installer Network. Equipment must be on
    the ENERGY STAR Cold Climate qualified list.
- **Not Mass Save:** "Instant incentives … through distributors and contractors at the
  point of sale through the New England Heat Pump Accelerator (NEHPA)" (federal grant).
  [Official mention] **[Open]** whether NEHPA stacks with Mass Save rebates and what it pays.
- **Cost example on the page:** average whole-home install $22,000 (2022 program data);
  net $13,500 standard, $6,000 enhanced. [Official]. Usable as a *reference point* for the
  cost range, labeled with its year.
- **Source:** https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps
- **Ambiguity [Open] — multi-unit, account holder:** rebates are "per account" and apply
  "using a residential electric account". In a triple-decker each unit has its own account,
  often in the tenant's name. Who applies when the landlord buys the equipment and the
  tenant holds the account? The engine shouldn't decide this; flag it and send the person to
  the assessment. Confirm with Mass Save.
- **Sequencing rule (from the source):** whole-home requires weatherization first, so the
  action plan puts weatherization before heat pumps. This is a *documented* dependency, not
  our opinion.
- **Effective-date lesson:** rebates change on 2027-01-01, already announced. The rules data
  must store both periods with `effective_from` / `effective_until`.

## 7. HEAT Loan (0% financing)

- Up to **$25,000** lifetime per customer (effective 2025-01-01). Covers weatherization,
  pre-weatherization barriers, windows (with completed weatherization), batteries in
  ConnectedSolutions, heat pumps, heat pump water heaters. [Official]
- **Pre-approval:** the loan is authorized (Authorization Form) and approved by a lender
  before the lender's check is signed over to the contractor. The HEA requirement on this
  page ("A HEA is mandatory if you plan to pursue … Whole Home Heat Pump …") is part of
  the **loan** process, not of the heat pump rebate (review A8). [Official]
- **"Loan applicant must be the homeowner."** Tenants can't use it. Needs a residential
  electric or gas account with a Sponsor. Municipal-electric customers qualify only if
  heated with natural gas from a Sponsor. Subject to lender approval. [Official]
- Source: https://www.masssave.com/en/residential/rebates-offers-services/financing

## 8. Seasonal heat pump electric rates

- Lower electric rates November–April for eligible heat pump customers. Each utility runs
  its own (Eversource, National Grid, Unitil). [Official]
- No amounts on the Mass Save page. **v1: mention and link only.** Don't compute with it
  until each utility's tariff is read. That's a candidate for v1.5, because it changes
  heat pump operating cost estimates.
- Source: https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/seasonal-heat-pump-rates

## 9. Community solar (renters can use it alone)

- **How it works (Eversource):** subscribers receive on-bill solar credits and usually pay
  part of them to the project owner; savings are the difference. "Community solar is
  available to all customers in Massachusetts." Income-eligible households (designated
  low-income census blocks, or on the Low-Income Discount Rate) "can qualify for
  additional savings." Eversource points to MassCEC for open projects. [Official]
  Source: https://www.eversource.com/residential/save-money-energy/clean-energy-options/solar-energy/community-solar
- **SMART 3.0 rules for community shared solar projects** (225 CMR 28.07(5)(c)1, Sept 2026
  clean version) [Official]:
  - Projects must give ≥40% of bill credits to Low Income Customers, or ≥15% to Low Income
    Customers **at no cost**.
  - **Guaranteed discount:** Low Income Customers get **≥40% discount** on the value of their
    bill credits; all other residential customers get **≥20%**.
  - Utility-run and municipal-aggregation community solar programs allocate 100% of output
    to Low Income Customers.
  - Consumer protection: early termination processed within 60 days; **"Early termination
    fees shall not be included in the Solar Contract"**; subscriptions transferable.
    (225 CMR 28.12(7), Special Contract Requirements, Sept 2026 text). This matters for
    renters who move.
- **Low Income Customer (225 CMR 28.02):** on a utility low-income discount rate; or lives in
  a Low Income Eligible Area (≤65% of state median income by ACS, or a federally designated
  EJ area); or documents LIHEAP/SNAP/Medicaid etc.; or a Solar for All participant; or
  self-attests on DOER's form. [Official]
- **What we can compute (inference):** the *minimum* discount floor (20% or 40% of credit
  value). We can't compute a specific project's price. Projects set their own terms above
  the floor. Show it as "at least X% off the credits you receive".
- Sources: 225 CMR 28.00 (clean, filed 2026-09-11):
  https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download ;
  Guideline Regarding Community Shared Solar:
  https://www.mass.gov/doc/guideline-regarding-community-shared-solar-tariff-generation-units-0/download

## 10. Eversource Community Solar Access Program (ECSAP)

- **Approved:** DPU order (June 2024) approved Eversource's ECSAP, a low-income community
  shared solar program with "a simplified billing offering at no cost and an easy enrollment
  plan"; Eversource's target is **$420/year** bill savings per enrolled low-income customer.
  [Official — DPU press release
  https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access]
- **Enrollment model:** customers on residential assistance rates (R-2, R-4) are **selected
  by lottery and automatically enrolled**, with priority for customers in arrears and in
  EJ communities. [Secondary — summaries of D.P.U. 24-104 filings, e.g. Boston public notice
  https://www.boston.gov/public-notices/16218361]
- **2026 status:** Eversource reported its first round of selected projects (Dartmouth,
  Maynard, Sharon, Springfield, Rochester, Westport, Woburn) on 2026-05-01. Customers get
  credits once projects operate. [Secondary — Daily Energy Insider]
- **What this means for tenants (inference):** a tenant **can't sign up**. The honest
  message is: "If you're on Eversource's discount rate (R-2), you may be automatically
  selected for no-cost community solar. Make sure you're on the discount rate if you
  qualify." Enrolling in the discount rate is the action the tenant can take.
- **[Open]** National Grid's equivalent: a 2021 proposal exists (≈$240/year discount,
  up to 20,000 customers) [Secondary]; current status not found. Check DPU File Room.
- **[Open]** Municipal LICSS programs under municipal aggregation (Boston, Chelsea, Newton,
  Cape Light Compact named in the 2024 order; "$5–10 each month") [Official mention];
  current status per city unknown.

## 11. SMART 3.0 — rooftop solar ≤25 kW

- **Administrator:** DOER (program), utilities pay (Eversource, National Grid, Unitil).
  Regulation 225 CMR 28.00; final revised regulation filed 2026-09-11 (expected in Register
  2026-09-25). DPU approved company tariffs 2026-07-08 (D.P.U. 25-175). [Official]
- **Program Year 2026 flat incentive rates** (fixed by size, not by bid) [Official]:
  - STGUs ≤25 kW AC: **$0.03/kWh**
  - Low Income STGUs (≤25 kW serving Low Income Customers): **$0.06/kWh**
  - Rate is set "based on the previous year's average net metering credit value".
- **Term: 20 years.** "All STGUs will be eligible to receive compensation under 225 CMR 28.00
  for 20 years from the STGU's Incentive Payment Effective Date." (225 CMR 28.13(1)).
  [Official] This settles the 10 vs 20 year conflict in secondary sources. **20 is correct.**
- **Program Year 2027:** DOER published a draft annual report (comment period closed
  2026-11-02). PY2027 rates aren't final. [Official] **[Open]** Re-read when final
  (expected around December 2026, as PY2026's final came 2025-12-01).
- **[Open]** Does a ≤25 kW system get the SMART flat incentive *in addition to* net
  metering credits? The rate being "based on … net metering credit value" suggests yes
  (*inference*). Confirm in the Eversource SMART 3.0 tariff before computing.
- **Consumer protection:** DOER requires customer disclosure forms for direct ownership,
  third-party ownership and community solar. [Official]
- Source: https://www.mass.gov/info-details/smart-30-program-details

## 12. Net metering — rooftop ≤25 kW, and splitting credits among units

- **Class / cap:** a Class I solar facility ≤25 kW is a **"nameplate cap exempt facility"**:
  it can net meter even when the utility's cap is full (220 CMR 18.02; D.P.U. 23-140-A).
  [Official]
- **Credit value:** nameplate cap exempt facilities earn **standard** net metering credits
  based on basic service, distribution, transmission and transition per-kWh charges.
  Example: about 27¢/kWh for an Eversource East R-1 customer in August 2024. The guide warns
  that rates change often (basic service every 6 months). [Official]
- **Allocation to other units' accounts:** the host customer files **Schedule Z** to send
  credits to other accounts, changeable up to 4 times a year. For nameplate cap exempt
  facilities, recipient accounts must be in the **same utility territory and ISO-NE load
  zone**. Accounts in the same building qualify. [Official]
- **Why it matters (inference):** this answers review-notes item 10. A landlord or condo
  association with one roof array can share credits with tenant or owner accounts in the
  building. The solar module can model this ("credits split X/Y/Z across units"), and
  the split is a coordination decision the building diagram can show.
- **Source:** https://www.mass.gov/info-details/net-metering-guide

## 13. Massachusetts residential renewable energy income tax credit — new for v1

- **Rule:** "any owner or tenant of residential property … who occupies said property as
  his principal residence, shall be allowed a credit equal to fifteen per cent of the net
  expenditure for a renewable energy source property or one thousand dollars, whichever
  is lesser." Unused credit carries over for **three** succeeding years. Joint owners share
  it in proportion to ownership. [Official — M.G.L. c. 62 § 6(d),
  https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6]
- **Not covered:** heat pumps; leasing costs (830 CMR 62.6.1, per search summary).
  [Secondary until the regulation is read]
- **Sunset [Secondary]:** the FY26 state tax expenditure budget says the credit isn't
  available for tax years ending after 2029-12-31. Read the statute's effective-date
  section or DOR guidance before encoding `effective_until`.
- **Form:** Schedule EC; the 2026 version is still a draft dated 2026-09-25. [Official mention]
- **Who can use it (inference):** an owner-occupant who buys a system. Not a renting
  landlord (not their principal residence), and not a tenant in practice (they rarely buy
  the system). Condo owners only for their own residence.

## 14. Federal tax credits — out of v1, explained in the FAQ

- §25C (energy-efficient home improvements, incl. heat pumps) and §25D (residential clean
  energy, incl. owner-bought rooftop solar) are not allowed for expenditures made after
  **2025-12-31** (One Big Beautiful Bill Act, P.L. 119-21, 2025-07-04). [Official — IRS FAQ
  https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-act-obbb]
- **[Open, not v1]** Third-party-owned solar (lease/PPA) can still involve business credits
  (§48E) for the owner, with deadlines set by the same law. That changes lease pricing but
  isn't something our users claim. Out of scope; mention only if a user asks about leases.

## 15. Massachusetts Solar for All — out of v1

- EPA terminated Massachusetts's $156M Solar for All award; DOER was notified 2025-08-07
  and the program is "on pause until further notice". The Massachusetts AG joined a
  multistate lawsuit. [Official — https://www.mass.gov/info-details/about-solar-for-all
  (per search summary) and AG press release]
- **v1:** don't present it as available. It appears only as one way to qualify as a "Low
  Income Customer" under SMART, which doesn't matter while it's paused.

## 16. Municipal light plants (MLPs)

- "Forty-one communities have established MLPs that serve all or part of 50 municipalities
  for electric service." DPU's role is limited; rates are set locally. [Official]
- Mass Save: municipal utility customers "are not part of the program", **except**
  gas-side offers when a Sponsor supplies their gas (HEAT Loan, gas-path heat pump rebate).
  [Official, §6–7]
- **Towns listed** (official table): Ashburnham, Belmont, Berkley*, Boxborough*, Boylston,
  Braintree, Chester, Chicopee, Concord, Danvers, Dighton*, Georgetown, Gosnold, Groton,
  Groveland, Hingham, Holden, Holyoke, Hudson, Hull, Ipswich, Lakeville*, Littleton,
  Lynnfield* (split Reading/Peabody), Mansfield, Marblehead, Merrimac, Middleborough,
  Middleton, North Attleborough, North Reading*, Norwood, Paxton, Peabody, Princeton,
  Raynham*, Reading, Rowley, Russell (northern part only), Shrewsbury, South Hadley,
  Sterling, Stow*, Taunton, Templeton, Wakefield, Wellesley, West Boylston, Westfield,
  Wilmington*. (*served by another town's MLP.) [Official]
  Source: https://www.mass.gov/service-details/massachusetts-municipally-owned-electric-companies
- **Two cautions (inference):**
  - "all or part of" and the Russell entry mean **town name isn't enough**. Step 4 needs
    an electric service territory map by address.
  - Taunton is both a navigator pilot city and an MLP town. Pilot coverage ≠ Mass Save
    coverage.
- **v1 behavior:** detect MLP → say Mass Save electric-side offers don't apply → link to the
  MLP → still evaluate gas-side offers and community solar where applicable. **[Open]**
  community solar and SMART in MLP towns (SMART tariffs are filed by Eversource, National
  Grid, Unitil only, so MLP customers are likely outside SMART: *inference*).

## 17. Energy Aligned Lease (for the coordination messages)

- Mass Save describes it as a lease with clauses that "assign financial responsibility in a
  way that benefits both the renter and the landlord". Measures it can cover: HVAC
  maintenance, energy data sharing, protocols for mechanical upgrades. Mass Save links
  Landlord and Tenant Reference Guides. [Official, descriptive]
- Source: https://www.masssave.com/en/residential/for-renters (Energy Aligned Lease section)
- **Use (inference):** the landlord message can mention it as an optional way to share
  savings. It **doesn't** answer the rent-increase concern (product.md Open Q10). Massachusetts
  rent rules weren't researched. Keep the product neutral there.

---

## 18. Massachusetts housing law: who pays for heat (105 CMR 410)

Read 2026-11-06 from the official text on mass.gov (headless browser), version **Mass.
Register #1498, 6/23/2023**:
https://www.mass.gov/doc/105-cmr-410-minimum-standards-of-fitness-for-human-habitation-state-sanitary-code-chapter-ii/download

- **410.160(A):** "The owner shall provide and maintain in good operating condition a
  heating system …" [Official]
- **410.180(A):** "The owner shall provide heat in every habitable room … from September
  15th through May 31st", at least 68°F (7 A.M.–11 P.M.) and 64°F at night. [Official]
- **410.200(A):** "The owner shall provide the electricity or gas used in each dwelling
  unit unless: (1) Such electricity or gas is metered through a meter which serves only
  the dwelling unit … and (2) A written rental agreement provides for payment by the
  occupant." [Official]
- **410.200(B):** if the owner pays, the electricity or gas "may be metered through meters
  which serve more than one dwelling unit". So a heat pump on an **owner-paid meter** is
  allowed. [Official]
- **410.210:** "The owner shall provide for the oil used for heating … unless: (A) Oil is
  provided through a separate oil tank which serves only that dwelling unit; and (B) The
  occupant is required to provide the oil under a written rental agreement." [Official]

**What this means for the product.** The first point is the law's default; the rest is
*inference* and needs Qiao's decision.
- By default the owner provides heat, oil, electricity and gas. The tenant pays only with
  **both** a meter (or tank) serving only their unit **and** a written rental agreement
  that says so.
- *Inference:* in Story 1 the landlord pays the oil heat. Running new heat pumps off the
  tenant's own electric meter would move heating cost onto the tenant. That needs the
  written rental agreement to provide for it. The landlord can't do it unilaterally.
- *Inference, open:* does an existing lease clause "tenant pays electricity" already cover
  electricity used for heat? This is a legal-interpretation question. The product must
  not answer it for the user; it says "check your written rental agreement".
- **Product rule [Decided 2026-11-06 — Qiao]:** when a project would move heating
  cost onto a tenant's bill, the report:
  1. shows the amount (per year and per month);
  2. says it requires a written rental agreement (105 CMR 410.200/410.210);
  3. offers fair options: lower the rent by that amount, give an electricity allowance, or
     put the heat pump on an owner-paid meter (allowed by 410.200(B));
  4. computes the landlord's payback on **real** energy savings by default;
  5. adds a fourth fair option: negotiate at renewal or a new lease, in writing, with the
     electricity change explained openly;
  6. never interprets the lease. It says "Check your written rental agreement: does it
     say the tenant pays for heat (or heating fuel), not only electricity?" and lists
     resources.
- **Resources** (read 2026-11-06):
  - Attorney General's *2025 Guide to Landlord-Tenant Rights*: "The landlord must pay for
    the heat, hot water, and electricity unless a term in the lease or other written
    rental agreement requires the tenant to pay for these utilities." and "A tenant
    cannot be required to pay for heating oil unless there is a separate tank that serves
    only the tenant's unit."
    https://www.mass.gov/doc/2025-guide-to-landlord-tenant-rights-11182025/download
  - MassLegalHelp, *Legal Tactics* ch. 6 Utilities (2025): "Fuel for hot water and heat:
    Landlord pays unless you signed a written document saying that the tenant must pay."
    https://www.masslegalhelp.org/sites/default/files/2025-02/06%20Utilities%202025_0.pdf
  - The local **Board of Health** enforces 105 CMR 410.
- Not legal advice. The product says so and points to the regulation.

## Flags for Qiao

1. **DEC and Enhanced are new and important.** They're probably the strongest offers for
   both demo stories (rental in a DEC; moderate-income condo owner). Recommend adding both
   to v1. They're already in the summary table as "In (new)".
2. **ECSAP is auto-enrollment by lottery.** For tenants, the honest action is "get on the
   discount rate", not "sign up for community solar". This changes the tenant copy.
3. **Heat pump rebates in rental units have an account-holder question** that the sources
   don't answer (§6). The engine will flag it, not decide it.
4. **Condo "all eligible units" definition is unclear** (§2.3). This directly affects the
   signature "units still needed" number. Worth one phone call to 866-527-SAVE before
   Phase 1 encodes it. Qiao could make that call as a user-research touchpoint.
5. **Income limits vary by area** (§5). Show ranges and link to the official checker; never
   tell someone they qualify on income alone.
6. **SMART term is 20 years** (official), so the secondary sources saying 10 were wrong.

## Still open after Step 3

| Item | Where it goes |
|---|---|
| DEC list (ZIPs or tracts) | Step 4 data sources |
| Electric territory by address (MLP split towns) | Step 4 |
| When homeowners get 100% vs 75% insulation outside DEC/income/condo | Phone Mass Save |
| Condo "eligible unit" definition | Phone Mass Save |
| Heat pump rebate: tenant-held account, landlord-owned equipment | Phone Mass Save |
| Income-table validity dates (2026–27 heating season) | Ask Mass Save; rules use an inferred Oct–Sep window |
| SMART flat incentive + net metering together for ≤25 kW | Read Eversource SMART 3.0 tariff (Phase 1, before encoding) |
| PY2027 SMART rates | Re-read after DOER finalizes (≈ Dec 2026) |
| National Grid and municipal LICSS status | DPU File Room |
| NEHPA point-of-sale incentive and stacking | NEHPA.org |
| MA tax credit sunset date; 830 CMR 62.6.1 | DOR |
| Seasonal heat pump rate values | Utility tariffs (v1.5) |
| Solar property/sales tax exemptions | Not researched; low priority |
