import { describe, expect, test } from 'vitest'
import { benefitValue, NO_QUANTITIES, type Quantities } from '../src/benefit.js'
import { estimate } from '../src/estimate.js'
import { range } from '../src/range.js'

const Q: Quantities = {
  cost: {
    weatherization: estimate(range(6000, 9000, 12000), 'medium', 'fixture'),
    heat_pump: estimate(range(18000, 22000, 26000), 'medium', 'fixture'),
    rooftop_solar: estimate(range(15000, 20000, 25000), 'low', 'fixture'),
  },
  heatPumpTons: estimate(range(2, 3, 4), 'medium', 'fixture'),
  solarKwhPerYear: estimate(range(4000, 5000, 6000), 'medium', 'fixture'),
  communitySolarCreditsPerYear: estimate(range(600, 800, 1000), 'low', 'fixture'),
  heatLoadMMBtu: null,
}

describe('benefitValue', () => {
  test('percent of cost', () => {
    expect(benefitValue({ type: 'percent_of_cost', pct: 75, costOf: 'weatherization' }, Q)?.range).toEqual(range(4500, 6750, 9000))
  })
  test('percent of cost, capped', () => {
    expect(benefitValue({ type: 'percent_of_cost_capped', pct: 15, cap: 1000, costOf: 'rooftop_solar' }, Q)?.range).toEqual(range(1000, 1000, 1000))
  })
  test('per ton with cap (whole-home 2026: $2,650/ton up to $8,500)', () => {
    expect(benefitValue({ type: 'per_ton', rate: 2650, cap: 8500 }, Q)?.range).toEqual(range(5300, 7950, 8500))
  })
  test('per ton never exceeds installation cost (research §6)', () => {
    const cheap: Quantities = { ...Q, cost: { heat_pump: estimate(range(4000, 5000, 6000), 'medium', 'fixture') } }
    expect(benefitValue({ type: 'per_ton', rate: 2650, cap: 8500 }, cheap)?.range).toEqual(range(4000, 5000, 6000))
  })
  test('per kWh over 20 years (SMART ≤25 kW: $0.03/kWh)', () => {
    const r = benefitValue({ type: 'per_kwh', rate: 0.03, years: 20 }, Q)?.range
    expect(r?.low).toBeCloseTo(2400)
    expect(r?.mid).toBeCloseTo(3000)
    expect(r?.high).toBeCloseTo(3600)
  })
  test('minimum discount on community solar credits', () => {
    expect(benefitValue({ type: 'min_discount_on_credits', pct: 20 }, Q)?.range).toEqual(range(120, 160, 200))
  })
  test('fixed amounts are high confidence', () => {
    expect(benefitValue({ type: 'fixed', amount: 500 }, Q)).toMatchObject({ range: range(500, 500, 500), confidence: 'high' })
  })
  test('confidence comes from the inputs used (mixed → lowest)', () => {
    const mixed: Quantities = { ...Q, heatPumpTons: estimate(range(2, 3, 4), 'low', 'tons: example size') }
    const r = benefitValue({ type: 'per_ton', rate: 2650, cap: 8500 }, mixed)
    expect(r?.confidence).toBe('low')
    expect(r?.why).toContain('tons: example size')
  })
  test('loans and none are not money benefits', () => {
    expect(benefitValue({ type: 'loan', maxPrincipal: 25000, apr: 0 }, Q)).toBeNull()
    expect(benefitValue({ type: 'none' }, Q)).toBeNull()
  })
  test('missing quantity gives null, never a guess', () => {
    expect(benefitValue({ type: 'percent_of_cost', pct: 100, costOf: 'weatherization' }, NO_QUANTITIES)).toBeNull()
    expect(benefitValue({ type: 'per_ton', rate: 2650, cap: 8500 }, NO_QUANTITIES)).toBeNull()
  })
})
