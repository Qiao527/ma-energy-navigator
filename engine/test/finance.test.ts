import { describe, expect, test } from 'vitest'
import { estimate } from '../src/estimate.js'
import { heatPumpSwitch, KWH_PER_MMBTU, simplePaybackYears, splitByPayer, splitCredits, weatherizedLoad } from '../src/finance.js'
import { point, range } from '../src/range.js'

const e = (low: number, mid: number, high: number, confidence: 'low' | 'medium' | 'high' = 'medium') =>
  estimate(range(low, mid, high), confidence, 'fixture')
const SWITCH_IN = {
  load: e(50, 60, 70),
  fuelEfficiency: e(0.8, 0.8, 0.8),
  fuelPricePerMMBtu: e(30, 30, 30),
  seasonalCop: e(2.5, 2.5, 2.5),
  electricityPricePerKwh: e(0.3, 0.3, 0.3),
}
const sw = heatPumpSwitch(SWITCH_IN)

describe('heatPumpSwitch: each bill separately, plus the net', () => {
  test('the fuel bill goes down by load / efficiency × price', () => {
    expect(sw.fuelBill.range.mid).toBeCloseTo(-(60 / 0.8) * 30)
  })
  test('the electric bill goes up by load / COP × kWh per MMBtu × price', () => {
    expect(sw.electricBill.range.mid).toBeCloseTo((60 / 2.5) * KWH_PER_MMBTU * 0.3)
  })
  test('the net uses the same load for both bills (no double-counted spread)', () => {
    const perMMBtu = (KWH_PER_MMBTU * 0.3) / 2.5 - 30 / 0.8
    expect(sw.net.range.low).toBeCloseTo(70 * perMMBtu)
    expect(sw.net.range.high).toBeCloseTo(50 * perMMBtu)
  })
  test('confidence is the lowest of the inputs', () => {
    expect(heatPumpSwitch({ ...SWITCH_IN, load: e(50, 60, 70, 'low') }).net.confidence).toBe('low')
  })
})

describe('splitByPayer (review A3, review B02)', () => {
  const upfront = e(2000, 4000, 6000)
  test('landlord pays oil, tenant pays electricity → landlord saves, tenant pays more', () => {
    const s = splitByPayer(sw, { heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', upfrontNet: upfront })
    expect(s.owner.annual?.range.high).toBeLessThan(0)
    expect(s.tenant.annual?.range.low).toBeGreaterThan(0)
    expect(s.owner.upfront).toBe(upfront)
    expect(s.tenant.upfront).toBeNull()
    expect(s.unallocated).toEqual([])
  })
  test('one person pays both bills → they get the net, computed once', () => {
    const s = splitByPayer(sw, { heatingFuel: 'oil', heatPaidBy: 'tenant', electricPaidBy: 'tenant', upfrontNet: upfront })
    expect(s.tenant.annual).toBe(sw.net)
    expect(s.owner.annual).toBeNull()
  })
  test('electric-resistance heat: both bills are the electric bill → its payer gets the net', () => {
    const s = splitByPayer(sw, { heatingFuel: 'electric_resistance', heatPaidBy: 'owner', electricPaidBy: 'tenant', upfrontNet: null })
    expect(s.tenant.annual).toBe(sw.net)
  })
  test('unknown payer is reported as unallocated, never guessed', () => {
    const s = splitByPayer(sw, { heatingFuel: 'oil', heatPaidBy: null, electricPaidBy: 'tenant', upfrontNet: null })
    expect(s.unallocated).toEqual([{ bill: 'heating_fuel', change: sw.fuelBill }])
    expect(s.tenant.annual).toBe(sw.electricBill)
  })
})

describe('weatherization, payback, credits', () => {
  test('weatherization reduces load by a fraction range', () => {
    const r = weatherizedLoad(e(100, 100, 100), e(0.05, 0.1, 0.15)).range
    expect(r.low).toBeCloseTo(85)
    expect(r.mid).toBeCloseTo(90)
    expect(r.high).toBeCloseTo(95)
  })
  test('payback = net cost / annual savings', () => {
    expect(simplePaybackYears(e(1000, 2000, 3000), e(100, 200, 500))?.range).toEqual(range(2, 10, 30))
  })
  test('no payback when savings could be zero or negative', () => {
    expect(simplePaybackYears(e(1000, 2000, 3000), e(-50, 100, 200))).toBeNull()
  })
  test('rooftop credits split by Schedule Z shares; the rest stays with the host account', () => {
    const shares = splitCredits(e(900, 1000, 1100), { '2': 0.3, '3': 0.3 })
    expect(shares['2']?.range.mid).toBeCloseTo(300)
    expect(shares.host?.range.mid).toBeCloseTo(400)
  })
  test('shares over 100% are rejected', () => {
    expect(() => splitCredits(e(1, 1, 1), { '2': 0.7, '3': 0.4 })).toThrow(/100%/)
  })
  test('point ranges stay exact through the split', () => {
    expect(splitCredits(estimate(point(1000), 'high', 'x'), { '2': 0.5 })['2']?.range).toEqual(point(500))
  })
})
