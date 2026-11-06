# Data sources — address to building profile

Phase 0, Step 4. Researcher: Qiao Long. Read or tested on **2026-11-06** unless noted.
Labels: **[Official]** read on the publisher's page or tested against the live API;
**[Secondary]** other sources; **[Inference]** my reasoning; **[Open]** unresolved.

The pipeline the product needs:

```
address → geocode (point, municipality, census block group)
        → parcel + assessor record (use code, units, year built, condo?)
        → building footprint / roof
        → electric + gas utility (Mass Save sponsor or MLP?)
        → DEC? EJ block group?
        → roof solar potential (only if the user can install)
        → show everything to the user to confirm or fill in
```

---

## 0. Summary

| Step | Source | Access | Cost / quota | License / terms | Main gap |
|---|---|---|---|---|---|
| Geocode | US Census Geocoder | REST, no key | Free | Public domain (US gov) *[Inference]* | Postal city ≠ municipality (handled: use county subdivision) |
| Address detail (unit level) | MassGIS Master Address Data (MAD) | Download, weekly refresh | Free | MassGIS public data | Large; unit-level only where known |
| Parcel + assessor | MassGIS Property Tax Parcels (L3 standard) | Download (statewide / per town), ArcGIS feature service | Free | MassGIS public data | Fiscal year varies by town; YEAR_BUILT approximate pre-1980; condos are "stacked" records |
| Footprint / roof outline | MassGIS Building Structures (2-D) | Download / feature service | Free | MassGIS public data | No attributes (no height, use or units) |
| Electric + gas utility | MassGIS Public Utility Service Providers | Table joined to towns | Free | MassGIS public data | **Town level only**; split towns and streets without gas mains |
| DEC | 2025–2027 Plan, Figure 23 (21 municipalities) | Hand-encoded list | Free | Public filing | Some PAs narrow to EJ blocks; Mass Save's site checks by ZIP |
| EJ status | MassGIS 2020 EJ Populations | Download / feature service | Free | MassGIS public data | Block-group level |
| Roof solar | Google Solar API — Building Insights | REST, API key, billing | 10,000 free/month, then $10 per 1,000 | Google Maps Platform terms (attribution; **caching limits**) | MA coverage not yet checked; caching vs "cached demo addresses" |
| Solar fallback | PVWatts v8 (NLR, formerly NREL) | REST, API key | Free, 1,000 requests/hour | US gov *[Inference]* | Needs our own tilt/azimuth/size assumptions |
| Energy burden stat | DOE LEAD Tool 2022 update | Download (state zip, 183 MB) | Free | OEDI *[license: verify]* | ACS-based averages |
| v1.5 energy model | NREL ResStock 2025 release 1 | S3 download (CSV.gz / parquet) | Free | OEDI *[license: verify]* | Simulated buildings, not real ones |

---

## 1. Geocoding

**US Census Geocoder** [Official, tested]
- `geographies/onelineaddress` returns the matched address, coordinates, and census
  geographies in one call, with no key.
- Test: `140 Commonwealth Ave, Chestnut Hill, MA 02467` (Boston College's public address) →
  (−71.1707, 42.3384); County Subdivision **Newton city** (2501745560); Block Group
  250173736002.
- **Lesson:** the postal city "Chestnut Hill" spans Newton, Brookline and Boston. DEC
  (Boston is one, Newton isn't) and MLP lookups must use the **county subdivision**
  (municipality), **never the postal city or ZIP**.
- The block group GEOID joins directly to the 2020 EJ layer (§6).
- Endpoint: https://geocoding.geo.census.gov/geocoder/

**MassGIS Master Address Data (MAD)** [Official]
- 3.2 million address records, 2.2 million points, refreshed weekly. Built for 9-1-1
  routing from voter lists, assessors and anonymized utility customer lists. Exports include
  addresses "to the building/floor/unit level, when that information is available" and
  "stacked points" where several addresses share a location.
- Use: confirm that a typed unit ("Apt 2") exists and count address units at a building.
  That's a second opinion on unit count, independent of the assessor.
- Source: https://www.mass.gov/info-details/massgis-data-master-address-data

**Privacy note [Inference]:** geocoding sends the address to the Census Bureau; Google Solar
sends coordinates to Google. Both are needed for the core flow. Say so in the privacy note,
and never send names or account numbers.

## 2. Parcel and assessor data

**MassGIS Property Tax Parcels (Level 3 standard)** [Official]
- Statewide since 2020-07-24 (Boston was last). Polygons in `TaxPar` link to assessor
  records in `L3_ASSESS` (~25 fields). The view used for downloads "includes 'stacked'
  polygons for features that link to multiple assessor records (such as condominiums)".
- Fields we need:
  - `USE_CODE`: "Land use code as set by Dept. of Revenue".
  - `UNITS`: "Number of living/dwelling units and also other units, for example,
    commercial condos and storage units". Not purely residential.
  - `YEAR_BUILT`, `STYLE`, `STORIES`, `RES_AREA` ("primarily to 1, 2 & 3 family dwellings
    … or residential condominiums based on deeded unit areas"), `NUM_ROOMS`.
  - Owner name/address. Owner mailing address ≠ site address suggests an absentee
    (renting) owner. That's an inference signal only; we never display owner names.
- Updates: towns deliver on different fiscal years. MassGIS publishes monthly batches of
  updated towns (e.g. 31 towns in Sept 2025). Each record has `FY`.
- Downloads: statewide, or per town (all vintages ≈ 7–8 GB).
- Source: https://www.mass.gov/info-details/massgis-data-property-tax-parcels

**How the profile uses it [Inference]**
- Building type from `USE_CODE`: two-family, three-family, condominium, small apartment,
  mixed use. **[Open]** confirm the exact DOR codes from the DOR Property Type
  Classification Codes document before encoding. From memory: 101 single family, 102
  condo, 104 two-family, 105 three-family, 111 apartments 4–8 units, 013/031 mixed use.
  **Not verified.**
- **Condo buildings:** several assessor records on one parcel (stacked) with the condo use
  code. Count the records to get units. This is the main way to tell a condo triple-decker
  from a rental one.
- **Year built:** secondary sources note values before 1980 are often approximate.
  Show as "about 1910" and let the user correct it. Matters for the whole-home heat pump
  rule (built ≥ 2000 counts as sufficiently weatherized).

**Known gaps**
- **Mixed use** (store below, apartments above): `UNITS` mixes commercial and residential.
  Ask the user how many homes are in the building.
- **Condos with parking or storage units** inflate record counts. Ask the user to confirm.
- **Recent conversions** (rental → condo) may not be in the current FY. The user corrects it.

## 3. Building footprint / roof outline

**MassGIS Building Structures (2-D)** [Official]
- Statewide "roofprints" for structures ≥150 sq ft, first from 2011–12 imagery plus LiDAR,
  updated with 2019 and 2021 imagery and later edits. Inside I-495, polygons were shifted to
  correct building lean. "No attributes were included in the creation of the polygons."
- Use: draw the building on the confirmation map and pick the right structure when a parcel
  has several. Height, units and roof shape aren't available.
- Source: https://www.mass.gov/info-details/massgis-data-building-structures-2-d

## 4. Electric and gas utility

**MassGIS Public Utility Service Providers** [Official]
- A table of electric, natural gas and cable providers **per municipality**. Electric and
  gas data from DPU, October 2025. Joins to town polygons on `TOWN_ID`. `ELEC_LABEL` /
  `GAS_LABEL` say "Municipal" for MLP towns.
- Source: https://www.mass.gov/info-details/massgis-data-public-utility-service-providers

**Gaps and how to handle them [Inference]**
- **Split towns:** the official MLP list has Russell ("northern part of town") and towns
  served by another town's MLP, such as Lynnfield (Reading and Peabody). A town-level table
  can't resolve these. Show the likely utility and ask the user to confirm it from their bill.
- **Gas availability is street-level:** a town listed with a gas company may have no gas
  main on a given street. Never infer the heating fuel from the gas utility. Always ask.
- National HIFLD territory polygons exist but aren't state-authoritative. Not used in v1.

## 5. Designated Equity Communities (DEC)

**2025–2027 Energy Efficiency and Decarbonization Plan** [Official — plan PDF pp. 29–30 and
Figure 23 p. 117, https://ma-eeac.org/wp-content/uploads/FINAL-MA-2025-2027-Plan-09-25-24-v2.pdf]
- Criteria (outside Cape Light Compact): "(1) more than 35 percent of the population are
  renters; (2) there were greater than 8,000 renters; and (3) more than 50 percent of the
  population are low- or moderate-income."
- **21 municipalities:** Boston, Brockton, Chelsea, Everett, Fall River, Framingham,
  Fitchburg, Lawrence, Lowell, Lynn, Malden, New Bedford, Oak Bluffs, Pittsfield, Quincy,
  Revere, Salem, Springfield, Tisbury, Woburn, Worcester.
- "Unitil, Berkshire Gas, and Liberty may further limit eligibility within these communities
  in their service territories by focusing on certain environmental justice census blocks."
  Example: Unitil limits no-cost weatherization to EJ census blocks within Fitchburg.
  Cape Light Compact used different criteria (Oak Bluffs and Tisbury are on the list).
- **Rental rule in the plan:** "the PAs will automatically qualify all properties with more
  than 50 percent rental units within these communities for moderate-income turnkey
  offers", and "Landlords will be required to sign a form … committing not to raise renter
  or evict tenants for a period following the receipt of program incentives."
  → This answers product.md Open Q10 (rent increases) for DEC rental projects. The
  "period" isn't specified in that passage. **[Open]** find the form's terms.
- **Lookup [Inference]:** municipality (from §1) ∈ list, and if the relevant PA is Unitil,
  Berkshire Gas or Liberty, also check the EJ block group (§6). Mass Save's site checks by
  ZIP. Where a ZIP spans towns, our answer may differ, so always add "confirm on Mass Save".
- **Risk [Secondary]:** an October 2026 article says Mass Save's future is uncertain while
  the Legislature stalls on an energy bill, and a pending bill could curb the
  no-income-verification approach in DECs. Re-check before the demo.
  (https://www.amherstindy.org/2026/10/14/future-of-mass-save-in-limbo-as-legislature-stalls-on-energy-bill/ ;
  https://www.canarymedia.com/articles/energy-efficiency/massachusetts-weatherize-lower-income-homes)

**Note for the demo:** Boston is a DEC, and so are 5 of the 6 navigator pilot cities
(Chelsea, Framingham, Lowell, Lynn, Springfield; not Taunton). A Boston rental near BC
(Allston/Brighton) is a good demo address. Newton and Brookline are not DECs.

## 6. Environmental Justice status

**MassGIS 2020 Environmental Justice Populations** [Official]
- Polygons are 2020 Census block groups meeting one or more criteria: median household
  income ≤ 65% of statewide; minorities ≥ 40%; ≥ 25% of households lack English
  proficiency; or minorities ≥ 25% and municipal income ≤ 150% of statewide. Fields include
  the criteria met and a count (1–3).
- Join key: block group GEOID from the Census geocoder (§1).
- Source: https://www.mass.gov/info-details/massgis-data-2020-us-census-environmental-justice-populations
- **Use (principle 6):** prioritize help (e.g. surface the income and DEC paths first, check
  the Unitil/Berkshire/Liberty DEC narrowing). Never show the user an "EJ" label about
  their neighborhood.
- Also relevant: SMART's "Low Income Eligible Area" includes federally designated EJ areas
  and areas at ≤65% of state median income (225 CMR 28.02). Not the same as the state EJ
  layer. **[Open]** which federal EJ designation applies now. Not needed for v1.

## 7. Roof solar potential

**Google Solar API** [Official]
- SKUs and price (global price list, read 2026-11-06):
  - **Building Insights**: 10,000 free per month; then $10.00 per 1,000 (to 100k),
    $5.00 (100k–500k), $4.50, $4.00, $3.50.
  - **Data Layers** (imagery/GeoTIFFs): 1,000 free per month; then $75.00 per 1,000.
  - A portfolio demo with a few dozen addresses stays inside the free tier. Use Building
    Insights only; skip Data Layers unless the roof sun map needs imagery.
- Coverage: HIGH (aerial 0.1 m/px), MEDIUM (aerial 0.25 m/px), BASE (satellite 0.25 m/px).
  Coverage is published as an interactive map and GeoJSON. **[Open]** download the GeoJSON
  and check Boston, Lowell, Springfield, Worcester before relying on it.
- **Terms:** attribution "Includes solar data from Google" next to the data; "Cache or store
  Google Maps Content only as expressly permitted under the Google Maps Platform Service
  Specific Terms"; no pre-fetching or storing outside the Services.
  **⚠ Conflict:** the demo needs fixed, repeatable results for real addresses, and caching
  Solar API responses may not be allowed. **[Open — must check the Service Specific Terms
  before Phase 3.]**
  **Fallback [Decided 2026-11-06]:** if caching isn't allowed, the demo uses **PVWatts**
  (cacheable) with roof area and orientation taken from the **MassGIS building outline**
  (§3). Usable roof area and tilt become assumptions with low/mid/high cases, so the range
  is wider and the confidence label lower.
- Sources: https://developers.google.com/maps/billing-and-pricing/pricing ;
  https://developers.google.com/maps/documentation/solar/coverage ;
  https://developers.google.com/maps/documentation/solar/policies

**PVWatts v8** [Official, tested]
- **Moved:** NREL is now the National Laboratory of the Rockies (NLR). `developer.nrel.gov`
  no longer resolves; the API is at `developer.nlr.gov`. Tested 2026-11-06 with
  `DEMO_KEY` at BC's coordinates: version 8.5.0, weather "NSRDB PSM V3 GOES tmy-2020".
- API key required, free; "No more than 1,000 requests may be made in any hour."
  Default dataset NSRDB.
- Inputs we must assume: system size, tilt, azimuth, losses. For flat triple-decker roofs
  vs pitched roofs, these assumptions drive the range. Use low/mid/high cases.
- Source: https://developer.nlr.gov/docs/solar/pvwatts/v8/
- **Action [Inference]:** anything written against `nrel.gov` URLs, including older
  tutorials and notes, is now wrong. Note it in the Phase 1 plan.

## 8. Energy burden — Massachusetts figure (Open Q9, answered)

**DOE LEAD Tool, 2022 update** [Official data; computation ours]
- File: `MA-2022-LEAD-data.zip` (183 MB, 8 CSVs by income metric × county/tract) from
  https://data.openei.org/submissions/6219 . DOI 10.25984/2504170.
- Method (ours, script in Phase 1 `analysis/`): sum the county file to state level per
  group; burden = (avg electricity + avg gas + avg other fuel spend) / avg household income.
  This is LEAD's group-average definition. It's **not** a median, so it's higher than
  ACEEE's medians.

| Group (Massachusetts) | Households | Avg income | Avg energy spend | Energy burden |
|---|---|---|---|---|
| All households | 2,740,995 | $140,413 | $3,699 | 2.6% |
| Below 200% FPL | 548,744 | $20,600 | $2,664 | **12.9%** |
| At or above 200% FPL | 2,192,251 | $167,261 | $3,916 | **2.3%** |
| Below 200% FPL, 2–4 unit buildings | 152,085 | $22,425 | $2,811 | **12.5%** |
| At/above 200% FPL, 2–4 unit buildings | 397,359 | $131,540 | $3,112 | 2.4% |
| Below 200% FPL, renters in 2–4 unit buildings | 128,615 | $22,223 | $2,682 | 12.1% |

- **Pitch line (proposed):** "In Massachusetts, households below 200% of the federal poverty
  level spend on average about 13% of income on home energy, versus about 2% for other
  households (DOE LEAD Tool, 2022 update)."
- **[Open]** the ACS vintage of the "2022 update". Sources disagree (2018–2022 vs
  2014–2018). Read the methodology PDF (energy.gov, Dec 2024) before publishing the number.

**Bonus: evidence for the "2–4 unit buildings" assumption (product.md §3)**
From the same file [computation ours]:
- 549,444 households (20.0% of MA households) live in 2–4 unit buildings.
- 27.7% of them are below 200% FPL, vs 20.0% statewide.
- 68.8% of them rent.
This supports the core-user choice with data. The original MassGIS analysis (pitch visual
3) can add building counts and locations.

## 9. v1.5 energy model — ResStock (Open Q5, answered)

**NREL/NLR ResStock, 2025 release 1 (AMY2018 weather)** [Official listing]
- On the public OEDI S3 bucket:
  `nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock/2025/resstock_amy2018_release_1/`.
  Folders: `metadata_and_annual_results`, `timeseries_aggregates`,
  `timeseries_individual_buildings`, `building_energy_models`, `weather`.
- Massachusetts annual results by upgrade: `by_state/full/csv/state=MA/MA_upgrade{N}.csv.gz`,
  **8–27 MB each** (baseline `upgrade0` = 17 MB). Easy to download and use.
- Caution [Secondary]: NREL's datasets page says bill fields in the **2024.2** release were
  "incorrectly calculated". Compute bills ourselves from energy use and current tariffs.
- **Verdict:** practical for v1.5. Filter MA buildings by type (2–4 unit), vintage and
  heating fuel, then fit quantile regression of energy use on features we actually collect,
  to narrow low/mid/high ranges. Not needed for v1.
- **[Open]** license text (OEDI datasets are usually CC BY 4.0; *verify*).

## 10. What we must ask the user

Data can suggest these; only the user can confirm them (principle 4).

| Field | Why we can't infer it | Prefill from |
|---|---|---|
| Role (tenant / renting landlord / owner-occupant / condo owner) | Not in any dataset | — |
| Number of homes in the building | Assessor `UNITS` mixes commercial and storage units | Assessor, MAD |
| Condo or rental building | Recent conversions lag | Assessor (stacked condo records) |
| Which unit the user lives in / owns | — | MAD unit list |
| Heating fuel, per unit | Gas utility ≠ gas service on the street | — |
| Who pays heat, who pays electricity, per unit | Lease terms | — |
| Residential heating meter per unit (condo) | Not public | — |
| Electric and gas utility (confirm) | Town-level table; split towns | MassGIS utilities table |
| On a utility discount rate (R-2 etc.)? | Private | — |
| Household size and income band (optional) | Private; only to show income paths | — |
| Year built (confirm) | Pre-1980 values approximate | Assessor |
| Roof: age, who controls it, shading worries (solar only) | Not public | Google Solar (shading) |

## 11. Still open after Step 4

| Item | Next step |
|---|---|
| DOR use-code table (exact codes) | Read DOR classification doc before Phase 1 encodes building types |
| Google Solar Service Specific Terms: caching | Before Phase 3; affects "cached demo addresses" |
| Google Solar coverage for target cities | Download coverage GeoJSON |
| LEAD ACS vintage | Read methodology PDF before publishing the 13% figure |
| OEDI licenses (LEAD, ResStock) | Read dataset pages |
| DEC landlord form ("period" of no rent increase / eviction) | Mass Save / plan appendix |
| Federal EJ designation used by SMART | Not needed for v1 |
