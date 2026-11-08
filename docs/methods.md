# Methods: will heat pumps save this building money?

An engineering case study behind [Every Floor](https://qiao527.github.io/ma-energy-navigator/). It follows one
building from delivery records to bills, CO₂ and who pays. Every number below was produced by the engine
(`engine/src/`) from the approved rules and assumptions in `rules/ma/`. None was typed in by hand. Each input
names its source.

**Short answer.** At Massachusetts prices for winter 2025–26, switching this oil-heated triple-decker to
cold-climate heat pumps changes its running cost by **−$550 to +$2,690 a year**, from a small saving to a clear
increase. CO₂ falls by **8.7 to 11.0 tonnes a year**, about two thirds. On each floor's own meter, about
**$3,050 to $4,960 a year** of heating cost moves from the landlord's oil bill to the tenants' electric bills.

---

## 1. The building

The demo is Story 1 of the standard scenarios (`scenarios/ma/story1-owner-occupant.json`). Its numbers are
fictional and labeled **demo data** on the page.

| | |
|---|---|
| Where | Boston (a Designated Equity Community), Eversource electric |
| What | Triple-decker, built 1910, three units |
| Who | Owner lives on floor 1 and rents floors 2 and 3 |
| Heat | Oil boilers, one per floor. The landlord buys all the oil; each household pays its own electric bill |
| Records | Oil deliveries for two heating seasons per floor |

| Floor | 2024–25 | 2025–26 |
|---|---|---|
| 1 | 455 gal | 490 gal |
| 2 | 420 gal | 445 gal |
| 3 | 515 gal | 560 gal |

## 2. The chain, step by step

Worked numbers are for floor 1; the other floors follow the same steps.

### 2.1 Weather normalization

A cold winter burns more oil than a mild one. Each season is scaled to a normal winter by Massachusetts
population-weighted heating degree days (HDD, base 65 °F) from NOAA's Climate Prediction Center:

> normalized gallons = gallons × normal HDD ÷ actual HDD

| Season | Actual HDD | Normal HDD | Floor 1 |
|---|---|---|---|
| 2024–25 | 6,014 | 6,407 | 455 → 484.7 gal |
| 2025–26 | 6,327 | 6,407 | 490 → 496.2 gal |

Both winters were milder than normal, so normalization raises the estimate. The two normalized seasons give
the low, mid and high fuel use: 484.7 / 490.5 / 496.2 gallons. With two seasons, the confidence is medium.

### 2.2 Heat delivered to the home

> heat delivered (MMBtu) = gallons × heat content × boiler efficiency

- Heat content of heating oil: 0.1385 MMBtu per gallon (EIA).
- Efficiency: 84% AFUE, the baseline Massachusetts program evaluators use for an oil boiler (EEAC).

Floor 1 needs **56.4 / 57.1 / 57.7 MMBtu** of heat a year. Floor 2 needs 52.1 / 52.2 / 52.4 and floor 3 needs
63.8 / 64.9 / 66.0.

**Check against similar buildings.** NREL ResStock 2025.1 simulates Massachusetts 2–4 unit homes built before
1950 and heated by oil (n = 274). Their annual heating need runs **27.6 / 38.3 / 51.8 MMBtu** per unit
(25th / 50th / 75th percentile). All three demo floors sit above the 75th percentile, and the page says so as
"more room to save".

One reason the figure may read high is that the demo landlord hasn't answered whether the boilers also heat
the water. If they do, the page removes the typical hot-water share: 18.2% of oil use for these homes,
ResStock, n = 157. That would bring floor 1 to about 46.7 MMBtu. Until it is answered, the page shows the
records as heating and says they may include hot water.

### 2.3 Heat pump electricity

> kWh = heat delivered × 293.07 kWh/MMBtu ÷ seasonal COP

A seasonal coefficient of performance (COP) is heat out divided by electricity in, averaged over a whole
winter. The values come from the Cadmus cold-climate heat pump field study for MassCEC, NYSERDA and DOE, which
metered 23 whole-home systems in Massachusetts and New York:

| | Seasonal COP |
|---|---|
| Mixed systems (low) | 1.90 |
| All whole-home systems (mid) | 2.41 |
| Ductless systems (high) | 2.80 |

| Floor | kWh at COP 2.80 | at 2.41 | at 1.90 |
|---|---|---|---|
| 1 | 5,972 | 6,939 | 8,802 |
| 2 | 5,468 | 6,353 | 8,058 |
| 3 | 6,793 | 7,892 | 10,011 |

The study's winter (2020–21) was milder than normal, so a cold winter may come in below these COPs.

### 2.4 Prices

- **Oil:** DOER's Massachusetts statewide prices, $3.10 (this winter's projection) to $3.43 (last winter's average)
  per gallon.
- **Electricity:** DOER's statewide average residential rate, $0.33 to $0.35 per kWh. That is the standard rate.
- **Winter heat pump rate.** From November 1 to April 30, Eversource charges a home heated by a heat pump less
  for delivery: distribution $0.09837 → $0.05286, transmission $0.04673 → $0.01492 and revenue decoupling
  $0.00539 → $0.00443 per kWh. Together that is **$0.07828 per kWh less** (tariff effective September 1 –
  December 31, 2026). Enrollment is automatic with a Mass Save heat pump rebate. Heat pump electricity therefore
  costs **$0.252 to $0.272 per kWh**. National Grid's approved discount is $0.04237. A pending filing,
  D.P.U. 26-71, would raise it to $0.09224, so that range is wider and its confidence low.

### 2.5 The price of one unit of heat

Dividing price by delivered heat makes fuels comparable:

| Per million Btu delivered | Low | Typical | High |
|---|---|---|---|
| Oil boiler, 84% | $26.65 | $26.65 | $29.48 |
| Gas boiler | $24.76 | $24.76 | $27.32 |
| Heat pump, winter heat pump rate | $26.35 | **$33.04** | $41.91 |
| Heat pump, standard rate | $34.54 | $42.56 | $53.99 |
| Propane boiler | $42.27 | $42.27 | $44.41 |
| Electric baseboard | $96.71 | $102.58 | $102.58 |

This table is the core of the result. At typical values a heat pump's heat costs about 24% more than oil
heat. The two ranges overlap only at the efficient end (COP 2.8, the lower electricity price).

**Break-even.** At the typical COP of 2.41, a heat pump matches oil when electricity costs **$0.22 per kWh**.
At the winter heat pump rate of $0.27, it matches oil at a seasonal COP of **3.0**, which is above every group
the field study measured. Electric baseboard and propane homes are the opposite case: a heat pump cuts their
heating cost by a wide margin at any of these values.

### 2.6 Bills, and who pays them

Per floor, heat pumps on each floor's own meter:

| Floor | Oil bill (landlord) | Electric bill (household) | Change together |
|---|---|---|---|
| 1, owner | −$1,700 to −$1,500 | +$1,490 to +$2,420 | −$180 to +$880 |
| 2, rented | −$1,550 to −$1,390 | +$1,370 to +$2,200 | −$160 to +$800 |
| 3, rented | −$1,950 to −$1,700 | +$1,680 to +$2,770 | −$210 to +$1,010 |
| **Building** | | | **−$550 to +$2,690** |

The building total is small next to how it splits. The landlord stops buying oil for all three floors and
saves **$2,210 to $3,670 a year**, counting floor 1's own new electric bill. The tenants on floors 2 and 3 take
on **$3,050 to $4,960 a year** of electricity for heat they didn't pay for before. This is the split incentive
in its plainest form, and the page treats it as the main finding for a landlord. It shows the Massachusetts
sanitary code constraint (105 CMR 410) and four fair ways to rebalance it: lower the rent, pay an
electricity allowance, put the heat pumps on an owner-paid meter, or agree in writing at renewal. This is not legal advice.

A switch on the page moves the heat pumps to an owner-paid meter. The tenants' bills are then unchanged and
the landlord's change equals the building's.

### 2.7 CO₂

- Oil: 73.96 kg CO₂ per MMBtu of fuel burned (EPA Emission Factors Hub 2025), divided by boiler efficiency.
- Electricity: 537.2 lb CO₂ per MWh, the New England grid average (EPA eGRID, NEWE), divided by the heat pump's COP.

| | Low | Typical | High |
|---|---|---|---|
| Today, tonnes CO₂ a year | 15.2 | 15.3 | 15.5 |
| With heat pumps | 4.4 | 5.2 | 6.6 |
| Change | −11.0 | −10.2 | −8.7 |

The grid factor is an annual average. Winter-peak electricity in New England is more carbon-intensive than
the average, so the true reduction is likely somewhat smaller. Even so, it stays large at any plausible
marginal factor, because the heat pump moves about 2.4 units of heat for each unit of electricity.

## 3. How uncertainty is carried

- **Ranges, not points.** Every input is a low / mid / high triple from its source. A range of possible prices,
  efficiencies or measured groups becomes the range. A single published value becomes a point.
- **Interval arithmetic.** Ranges combine so that the result's low and high bound every combination of input
  lows and highs. For example, an electric bill's low uses the lowest price and the highest COP. Bounds are
  therefore conservative. The mid uses the typical inputs.
- **Confidence labels.** Each estimate carries low, medium or high confidence, plus the reasons, which come from
  its weakest input. Two seasons of records give medium; simulated ResStock values give low; a pending
  regulatory filing gives low.
- **What-if values.** The page lets anyone replace electricity price, fuel price and COP with their own number.
  That number replaces the sourced range exactly, and every result recomputes.

## 4. What is not modeled, and which way it pushes

| Left out | Effect on the result |
|---|---|
| The winter heat pump rate also lowers the household's other winter electricity | Heat pumps look slightly worse than they are |
| Envelope work (insulation, air sealing) done first, as the plan recommends | Smaller loads; savings and costs both shrink |
| Hourly COP against outdoor temperature (a seasonal average is used) | Either way; a colder winter lowers COP |
| Marginal winter grid emissions (an annual average is used) | CO₂ cut looks somewhat larger than it is |
| Competitive electricity supply or municipal aggregation prices | Either way; the statewide average is used |
| Air conditioning the heat pumps also provide | Value not counted |
| Avoided boiler replacement (used only when the user says it needs replacing) | Project cost looks higher than it is |
| Eversource rates reset January 1, 2027; National Grid's D.P.U. 26-71 is pending | Prices may move this winter |

## 5. How the numbers are kept honest

- **Code, not prose, computes.** `engine/` is TypeScript with 235 tests, including property-based tests of the
  range arithmetic (fast-check). The page runs the same code in the browser.
- **Every rule and assumption has a source.** Each one carries a URL, section, verbatim quote and the date it
  was checked. `npm run rules:check-drafts` confirms each quote appears in a saved snapshot of the source
  (`rules/ma/sources/`).
- **An owner approves every change.** Rules and assumptions ship only after approval, recorded against each
  file's SHA-256 in `rules/ma/approvals.json`. The loader refuses changed files, and so does the public build.
- **Standard scenarios.** Ten fixed buildings and dates (`scenarios/ma/`) pin the engine's decisions. A changed
  result fails CI until it is approved again.

## 6. Sources

| Input | Source |
|---|---|
| Heating degree days | NOAA Climate Prediction Center, Massachusetts population-weighted HDD |
| Oil heat content | U.S. EIA, heat content of petroleum products |
| Boiler efficiency | Massachusetts EEAC, baseline AFUE |
| Typical heating need, hot-water share, heat pump size | NREL ResStock 2025.1, Massachusetts 2–4 unit homes (CC BY 4.0) |
| Seasonal COP | Cadmus, *Residential Cold-Climate Heat Pump Building Electrification Study* (2022), for MassCEC, NYSERDA and DOE |
| Fuel and electricity prices | Massachusetts DOER, *Household Heating Costs* (winter 2025–26) |
| Winter heat pump rate | Eversource Eastern Massachusetts delivery rates; National Grid M.D.P.U. No. 1-26-G; D.P.U. 26-71 notice; mass.gov |
| CO₂ factors | U.S. EPA, GHG Emission Factors Hub 2025 (eGRID NEWE) |
| Heat pump installed cost | EEAC, Residential Heat Pump Invoice Cost Study |
| Program rules and incentives | Mass Save, mass.gov (DOER, DPU), 105 CMR 410, M.G.L. |

Full links, quotes and check dates are in `rules/ma/assumptions.json`, `rules/ma/assumptions-resstock.json` and
the page's *How each number is worked out* section.
