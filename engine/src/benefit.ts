import { combine, estimate, type Estimate } from './estimate.js'
import { capAt, minOf, point, scale } from './range.js'
import type { Benefit, Measure } from './rules-schema.js'

/** Physical and cost quantities for one unit (or the building, for building-level measures). */
export interface Quantities {
  cost: Partial<Record<Measure, Estimate>>
  heatPumpTons: Estimate | null
  solarKwhPerYear: Estimate | null
  communitySolarCreditsPerYear: Estimate | null
  /** Annual heat delivered to the unit, MMBtu (feeds the bill estimates, finance.ts). */
  heatLoadMMBtu: Estimate | null
}

export const NO_QUANTITIES: Quantities = { cost: {}, heatPumpTons: null, solarKwhPerYear: null, communitySolarCreditsPerYear: null, heatLoadMMBtu: null }

/** Money value of a benefit, or null when it isn't money or a needed quantity is unknown. */
export function benefitValue(b: Benefit, q: Quantities): Estimate | null {
  switch (b.type) {
    case 'percent_of_cost': {
      const c = q.cost[b.costOf]
      return c ? combine(scale(c.range, b.pct / 100), [c]) : null
    }
    case 'percent_of_cost_capped': {
      const c = q.cost[b.costOf]
      return c ? combine(capAt(scale(c.range, b.pct / 100), b.cap), [c]) : null
    }
    case 'per_ton': {
      const tons = q.heatPumpTons
      if (!tons) return null
      const rebate = capAt(scale(tons.range, b.rate), b.cap)
      const cost = q.cost.heat_pump
      return cost ? combine(minOf(rebate, cost.range), [tons, cost]) : combine(rebate, [tons])
    }
    case 'fixed':
      return estimate(point(b.amount), 'high', 'Amount fixed in the program rules')
    case 'per_kwh': {
      const kwh = q.solarKwhPerYear
      return kwh ? combine(scale(kwh.range, b.rate * b.years), [kwh]) : null
    }
    case 'min_discount_on_credits': {
      const credits = q.communitySolarCreditsPerYear
      return credits ? combine(scale(credits.range, b.pct / 100), [credits]) : null
    }
    case 'loan':
    case 'none':
      return null
  }
}
