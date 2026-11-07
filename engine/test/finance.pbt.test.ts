import fc from 'fast-check'
import { expect, test } from 'vitest'
import { estimate } from '../src/estimate.js'
import { heatPumpSwitch, splitByPayer } from '../src/finance.js'
import { range } from '../src/range.js'

const pos = (min: number, max: number) =>
  fc.tuple(fc.double({ min, max, noNaN: true }), fc.double({ min, max, noNaN: true }), fc.double({ min, max, noNaN: true }))
    .map(xs => xs.sort((a, b) => a - b) as [number, number, number])
    .map(([l, m, h]) => estimate(range(l, m, h), 'medium', 'gen'))
const switchArb = fc.record({
  load: pos(10, 150), fuelEfficiency: pos(0.5, 1), fuelPricePerMMBtu: pos(5, 60),
  seasonalCop: pos(1.5, 4), electricityPricePerKwh: pos(0.1, 0.5),
}).map(heatPumpSwitch)
const payer = fc.constantFrom('owner' as const, 'tenant' as const, null)

test('each bill change is counted exactly once: owner + tenant + unallocated = net (mid)', () => {
  fc.assert(fc.property(switchArb, fc.constantFrom('oil' as const, 'propane' as const, 'natural_gas' as const, 'electric_resistance' as const), payer, payer, (sw, fuel, heat, elec) => {
    const s = splitByPayer(sw, { heatingFuel: fuel, heatPaidBy: heat, electricPaidBy: elec, upfrontNet: null })
    const total = (s.owner.annual?.range.mid ?? 0) + (s.tenant.annual?.range.mid ?? 0) + s.unallocated.reduce((t, u) => t + u.change.range.mid, 0)
    expect(total).toBeCloseTo(sw.net.range.mid, 6)
  }))
})

test('the net range lies inside the sum of the two bill ranges (no spread invented or lost)', () => {
  fc.assert(fc.property(switchArb, sw => {
    const eps = 1e-6 * (1 + Math.abs(sw.net.range.mid))
    expect(sw.net.range.low).toBeGreaterThanOrEqual(sw.fuelBill.range.low + sw.electricBill.range.low - eps)
    expect(sw.net.range.high).toBeLessThanOrEqual(sw.fuelBill.range.high + sw.electricBill.range.high + eps)
  }))
})
