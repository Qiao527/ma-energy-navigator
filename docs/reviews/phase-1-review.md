# Phase 1: independent review and response

The review was made cold, read-only, against `Qiao527/phase-1` at commit `04be5a9` (2026-11-07). Its verdict:
not ready to close until the items below were fixed. Every finding was checked against the code before it was
fixed. All nine were confirmed and fixed.

| # | Severity | Finding | Response |
|---|---|---|---|
| 1 | major | When "does the boiler heat the water?" is unanswered, all fuel counts as heating, so the range leaves out the other answer | Fixed. The heat load's low end now takes out the widest hot-water share and confidence drops to low (`quantities.ts`). The page says "may include hot water" instead of "hot water out" |
| 2 | major | If a floor can't be estimated, the remaining floors are still shown as the whole building (headline, CO₂ total) | Fixed. `report()` lists `notEstimated`; the building total, CO₂ total and landlord view are withheld, and the page names the missing floors. Tests cover a mixed building and a floor already on a heat pump |
| 3 | major | The winter heat pump discount is applied to all heating kWh, though it covers November–April only; the Eversource figure has an end date | Fixed. The discount is weighted by the November–April share of a normal heating season (0.851, NOAA CPC monthly state data, sourced). The note says delivery rates change during the year and these are the current tariffs |
| 4 | major | The headline uses the landlord's real saving (owner-paid floors only) while calling it the building's | Fixed. A separate `buildingChange` sums every floor (heating plus any electric water heater switch), whoever pays; the landlord's own saving stays separate |
| 5 | major | Missed deadlines, stale sources and announced future versions are computed but not shown | Fixed. The plan shows the missed deadline with its date, a "checked more than 90 days ago" note, and "Changes already announced" |
| 6 | major | The form can't answer facts the rules ask for (income, residential heating meter, participation) | Fixed. Household income band and owner approval were added. Each unit gets a heating-meter and participation question for condos |
| 7 | major | The chart's text table leaves out the hot-water bills and who pays | Fixed. The table lists every bill on each floor (heat, heat pump electricity, hot-water fuel, water heater electricity), who pays, and the floor total |
| 8 | major | Upfront cost, monthly shift, payback and CO₂ figures lack their own confidence label and reasons; the floor shift shows a typical value only | Fixed. Each key figure carries its confidence label and a "Why" list. The floor shift is a range. The heat-price table gives reasons per row |
| 9 | minor | Focus is lost after the "owner-paid meter" button re-renders the report | Fixed. Focus returns to the replacement button, falling back to the what-if toggle |

Checked after the fixes:
- engine: 233 tests pass;
- quote check passes;
- Python tests pass;
- production and preview builds pass;
- axe-core (WCAG 2.0–2.2 A/AA): 0 violations in light and dark mode;
- no page-level horizontal scroll at 360 px with every section open;
- keyboard focus verified after the meter button.
