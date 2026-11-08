# Methods: will heat pumps save this building money?

An engineering case study behind [Every Floor](https://qiao527.github.io/ma-energy-navigator/). It follows one
building from delivery records to bills, CO₂ and who pays. Every number below was produced by the engine
(`engine/src/`) from the approved rules and assumptions in `rules/ma/`. None was typed in by hand. Each input
names its source.

**Short answer.** At Massachusetts prices for winter 2025–26, this oil-heated triple-decker switching heat and
hot water to heat pumps changes its running cost by **−$1,250 to +$3,530 a year**. That runs from a real saving
to a clear increase, with a typical result of about +$1,200. CO₂ falls by **7.4 to 13.1 tonnes a year**, about
two thirds. On each floor's own meter, about **$2,590 to $5,500 a year** moves from the landlord's oil bill onto
the tenants' electric bills.

---

## 1. The building

The demo building is Story 1 of the standard scenarios (`scenarios/ma/story1-owner-occupant.json`). Its numbers
are fictional and labeled **demo data** on the page.

| | |
|---|---|
| Where | Boston (a Designated Equity Community), Eversource electric |
| What | Triple-decker, built 1910, three units |
| Who | The owner lives on floor 1 and rents floors 2 and 3 |
| Heat | Oil boilers, one per floor. Each boiler also heats that floor's water. The landlord buys all the oil; each household pays its own electric bill |
| Plan | Cold-climate heat pumps for heat, and a heat pump water heater on each floor for hot water |
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
the low, mid and high fuel use: 484.7 / 490.5 / 496.2 gallons. Two seasons of records count as medium confidence.

### 2.2 Separating heat from hot water

The same boiler heats the water, so the delivery records include hot water. NREL ResStock 2025.1 simulates
Massachusetts 2–4 unit homes whose water heater burns oil (n = 157). Hot water takes **14.5% / 18.2% / 27.2%**
of their oil (25th / 50th / 75th percentile). For floor 1, that is about 71 / 89 / 133 gallons a year.

The widest share sets the low end of the heating need and the narrowest sets the high end, so the range covers
the full spread. If the question hasn't been answered, the page keeps all of the oil as heating at the mid and
high end, takes out the widest share at the low end, and labels the result low confidence.

### 2.3 Heat delivered to the home

> heat delivered (MMBtu) = gallons × heat content × boiler efficiency × (1 − hot-water share)

- Heat content of heating oil: 0.1385 MMBtu per gallon (EIA).
- Efficiency: 84% AFUE, the baseline Massachusetts program evaluators use for an oil boiler (EEAC).

Floor 1 needs **41.1 / 46.7 / 49.4 MMBtu** of heat a year. Floor 2 needs 37.9 / 42.7 / 44.8 and floor 3 needs
46.5 / 53.1 / 56.4. The hot-water share makes these low confidence.

**Check against similar buildings.** ResStock's oil-heated Massachusetts 2–4 unit homes built before 1950
(n = 274) need **27.6 / 38.3 / 51.8 MMBtu** a year per unit. Floors 1 and 2 are typical. Floor 3 sits above the
75th percentile, and the page calls that "more room to save" rather than a judgment.

### 2.4 Heat pump electricity

> kWh = heat delivered × 293.07 kWh/MMBtu ÷ seasonal COP

A seasonal coefficient of performance (COP) is heat out divided by electricity in, averaged over a whole
winter. The values come from the Cadmus cold-climate heat pump field study for MassCEC, NYSERDA and DOE, which
metered 23 whole-home systems in Massachusetts and New York:

| | Seasonal COP |
|---|---|
| Mixed systems (low) | 1.90 |
| All whole-home systems (mid) | 2.41 |
| Ductless systems (high) | 2.80 |

| Floor | kWh, low | mid | high |
|---|---|---|---|
| 1 | 4,297 | 5,676 | 7,613 |
| 2 | 3,967 | 5,197 | 6,914 |
| 3 | 4,864 | 6,456 | 8,701 |

The low column pairs the smallest load with the best COP; the high column pairs the largest load with the
worst. The study's winter (2020–21) was milder than normal, so a cold winter may come in below these COPs.

### 2.5 Prices

- **Oil.** DOER's Massachusetts statewide prices: $3.10 per gallon (this winter's projection) to $3.43 (last
  winter's average).
- **Electricity.** DOER's statewide average residential rate, $0.33 to $0.35 per kWh. That is the standard rate.
- **Winter heat pump rate.** From November 1 to April 30, Eversource charges a home heated by a heat pump less
  for delivery: distribution drops from $0.09837 to $0.05286 per kWh, transmission from $0.04673 to $0.01492,
  and revenue decoupling from $0.00539 to $0.00443. Together that is **$0.07828 per kWh less** (tariff effective
  September 1 – December 31, 2026). Enrollment is automatic with a Mass Save heat pump rebate.
- **Only part of the season is discounted.** October and May heating pays the standard rate. NOAA's monthly
  data put **85.1%** of a normal Massachusetts heating season in November–April (88.0% last winter). Heat pump
  electricity therefore averages **$0.261 to $0.283 per kWh**.
- **National Grid.** The approved discount is $0.04237 per kWh. A pending filing, D.P.U. 26-71, would raise it
  to $0.09224, so that range is wider and its confidence low.

### 2.6 The price of one unit of heat

Dividing each price by the heat it delivers makes the fuels comparable:

| Per million Btu delivered | Low | Typical | High |
|---|---|---|---|
| Oil boiler, 84% | $26.65 | $26.65 | $29.48 |
| Gas boiler | $24.76 | $24.76 | $27.32 |
| Heat pump, winter heat pump rate | $27.33 | **$34.46** | $43.71 |
| Heat pump, standard rate | $34.54 | $42.56 | $53.99 |
| Propane boiler | $42.27 | $42.27 | $44.41 |
| Electric baseboard | $96.71 | $102.58 | $102.58 |

This table is the core of the result. At typical values, a heat pump's heat costs about 29% more than oil heat.
The two ranges overlap only at the efficient end: COP 2.8 and the lower electricity price.

**Break-even.** At the typical COP of 2.41, a heat pump matches oil when electricity costs **$0.22 per kWh**.
At the season-weighted heat pump rate of $0.28, it matches oil at a seasonal COP of **3.1**, which is above
every group the field study measured. Electric baseboard and propane homes are the opposite case: a heat pump
cuts their heating cost by a wide margin at any of these values.

### 2.7 Hot water

The oil that heated the water goes away and a heat pump water heater's electricity comes in, on the floor's
own meter.

- **Oil saved.** The hot-water share × that floor's mean gallons × the oil price. For floor 1 that is $210 to
  $440 a year.
- **Electricity added: 426 / 862 / 1,534 kWh a year.** The source is Efficiency Maine's June 2026 impact
  evaluation, which metered real homes.
  - Typical: homes whose old water heater burned fuel added 862 kWh.
  - Low: the measured yearly hot-water load (1,534 kWh) at the rated efficiency, UEF 3.6.
  - High: the same load in electric-resistance mode.
  - Field efficiency averaged 1.8, because most units ran in hybrid mode. Confidence is low because hot-water
    use varies by household.
- **Price.** The standard rate is used, because the water heater runs all year. This is conservative.

Per floor, hot water changes by about −$360 to +$340 a year, roughly even at typical values.

### 2.8 Bills, and who pays them

Heat pumps and water heaters on each floor's own meter, per year:

| Floor | Oil for heat (landlord) | Heat pump electricity | Oil for hot water (landlord) | Water heater electricity |
|---|---|---|---|---|
| 1, owner | −$1,460 to −$1,090 | +$1,120 to +$2,160 (owner) | −$440 to −$210 | +$140 to +$540 (owner) |
| 2, rented | −$1,320 to −$1,010 | +$1,040 to +$1,960 (tenant) | −$400 to −$190 | +$140 to +$540 (tenant) |
| 3, rented | −$1,660 to −$1,240 | +$1,270 to +$2,470 (tenant) | −$500 to −$240 | +$140 to +$540 (tenant) |

**Building, all floors and all bills: −$1,250 to +$3,530 a year** (typical +$1,200).

The building total is small next to how it splits:
- The landlord stops buying oil for all three floors and saves **$1,520 to $4,300 a year**, after paying
  floor 1's own new electric bill.
- The tenants on floors 2 and 3 take on **$2,590 to $5,500 a year** of electricity for heat and hot water that
  the landlord used to buy.

This is the split incentive in its plainest form, and the page treats it as the main finding for a landlord.
It shows the Massachusetts sanitary code constraint (105 CMR 410) and four fair ways to rebalance:
- lower the rent;
- pay an electricity allowance;
- put the heat pumps on an owner-paid meter;
- agree in writing at renewal.

This is not legal advice.

A switch on the page moves the heat pumps to an owner-paid meter. The tenants then pay only the water heater's
electricity.

### 2.9 CO₂

- Oil: 73.96 kg CO₂ per MMBtu of fuel burned (EPA Emission Factors Hub 2025).
- Electricity: 537.2 lb CO₂ per MWh, the New England grid average (EPA eGRID, NEWE).

Both heat and hot water are counted.

| Tonnes CO₂ a year | Low | Typical | High |
|---|---|---|---|
| Today | 13.2 | 15.2 | 17.3 |
| With heat pumps | 3.5 | 4.9 | 6.8 |
| Change | −13.1 | −10.4 | −7.4 |

The grid factor is an annual average. Winter-peak electricity in New England is more carbon-intensive than
that, so the true reduction is likely somewhat smaller. It stays large at any plausible marginal factor,
because the heat pump moves about 2.4 units of heat for each unit of electricity.

## 3. How uncertainty is carried

- **Ranges, not points.** Every input is a low / mid / high triple from its source. A range of possible prices,
  efficiencies or measured groups becomes the range. A single published value becomes a point.
- **Interval arithmetic.** Ranges combine so that the result's low and high bound every combination of input
  lows and highs. For example, an electric bill's low uses the lowest price, the smallest load and the highest
  COP. The bounds are conservative; the mid uses the typical inputs.
- **Confidence labels.** Each estimate carries low, medium or high confidence, and the reasons, taken from its
  weakest input. Two seasons of records give medium. A simulated ResStock share gives low. So does a pending
  regulatory filing.
- **Unanswered questions widen the range.** For example, if nobody has said whether the boiler heats the water,
  the range covers both answers.
- **Whole-building figures need every floor.** If one floor can't be estimated, the page names it and shows no
  building total.
- **What-if values.** Anyone can replace the electricity price, fuel price or COP with their own number. It
  replaces the sourced range exactly, and every result recomputes.

## 4. What is not modeled, and which way it pushes

| Left out | Effect on the result |
|---|---|
| The winter heat pump rate also lowers the household's other winter electricity, including half the water heater's | Heat pumps look slightly worse than they are |
| Envelope work (insulation, air sealing) done first, as the plan recommends | Smaller loads; savings and costs both shrink |
| Hourly COP against outdoor temperature (a seasonal average is used) | Either way; a colder winter lowers COP |
| Marginal winter grid emissions (an annual average is used) | The CO₂ cut looks somewhat larger than it is |
| Competitive electricity supply or municipal aggregation prices | Either way; the statewide average is used |
| Air conditioning the heat pumps also provide | Its value is not counted |
| Avoided boiler replacement (used only when the user says the boiler needs replacing) | The project cost looks higher than it is |
| Eversource rates reset January 1, 2027; National Grid's D.P.U. 26-71 is pending | Prices may move this winter |

## 5. How the numbers are kept honest

- **Code computes the numbers.** `engine/` is TypeScript with 243 tests, including property-based tests of the
  range arithmetic (fast-check). The page runs the same code in the browser.
- **Every rule and assumption has a source.** Each one carries a URL, section, verbatim quote and the date it
  was checked. `npm run rules:check-drafts` confirms each quote appears in a saved snapshot of the source
  (`rules/ma/sources/`).
- **An owner approves every change.** Rules and assumptions ship only after approval, recorded against each
  file's SHA-256 in `rules/ma/approvals.json`. The loader refuses a changed file, and so does the public build.
- **Standard scenarios.** Eleven fixed buildings and dates (`scenarios/ma/`) pin the engine's decisions. Their
  costs are computed from the approved assumptions, so a change to an assumption shows up there too. A changed
  result fails CI until it is approved again.
- **Independent review.** The phase ended with a cold, read-only review. Its nine findings and the fixes are in
  [`docs/reviews/phase-1-review.md`](reviews/phase-1-review.md).

## 6. Sources

| Input | Source |
|---|---|
| Heating degree days, winter share | NOAA Climate Prediction Center, Massachusetts population-weighted HDD (monthly state summaries) |
| Oil heat content | U.S. EIA, heat content of petroleum products |
| Boiler efficiency | Massachusetts EEAC, baseline AFUE |
| Typical heating need, hot-water share, heat pump size | NREL ResStock 2025.1, Massachusetts 2–4 unit homes (CC BY 4.0) |
| Seasonal COP | Cadmus, *Residential Cold-Climate Heat Pump Building Electrification Study* (2022), for MassCEC, NYSERDA and DOE |
| Heat pump water heater electricity | Efficiency Maine, *Impact Evaluation of the Heat Pump Water Heater and ECM Circulator Pump Measures* (June 2026) |
| Fuel and electricity prices | Massachusetts DOER, *Household Heating Costs* (winter 2025–26) |
| Winter heat pump rate | Eversource Eastern Massachusetts delivery rates; National Grid M.D.P.U. No. 1-26-G; D.P.U. 26-71 notice; mass.gov |
| CO₂ factors | U.S. EPA, GHG Emission Factors Hub 2025 (eGRID NEWE) |
| Heat pump installed cost | EEAC, Residential Heat Pump Invoice Cost Study |
| Program rules and incentives | Mass Save, mass.gov (DOER, DPU), 105 CMR 410, M.G.L. |

Full links, quotes and check dates are in `rules/ma/assumptions.json` and `rules/ma/assumptions-resstock.json`,
and in the page's *How each number is worked out* section.
