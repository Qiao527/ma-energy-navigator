import { describe, expect, test } from 'vitest'
import { InputSchema } from '../src/facts.js'
import { AssumptionsSchema, heatLoadFromRecords, quantitiesFor, vintageBand, type Assumption } from '../src/quantities.js'
import { range } from '../src/range.js'
import { input, SOURCE, unit } from './fixtures.js'

const a = (id: string, low: number, mid: number, high: number, confidence: Assumption['confidence'] = 'low', sampleSize?: number): Assumption =>
  AssumptionsSchema.parse([{ id, description: `about ${id}`, unit: 'x', value: { low, mid, high }, confidence, sources: [SOURCE], ...(sampleSize ? { sampleSize } : {}) }])[0] as Assumption

const LIST: Assumption[] = [
  a('heat_pump_cost_per_ton', 3860, 5830, 7800, 'medium'),
  a('heat_content_mmbtu_per_unit.oil', 0.1385, 0.1385, 0.1385, 'high'),
  a('heating_efficiency.oil', 0.84, 0.84, 0.84, 'medium'),
  a('annual_heat_load_mmbtu.oil.pre1950', 27.6, 38.4, 51.8, 'low', 274),
  a('annual_heat_load_mmbtu.oil', 22.8, 35.8, 50.8, 'low', 349),
  a('heat_pump_tons.oil.pre1950', 2.1, 2.6, 3.4, 'low', 274),
  a('heat_pump_tons.oil', 1.97, 2.48, 3.29, 'low', 349),
]

const building = (units: ReturnType<typeof unit>[], yearBuilt: number | null) =>
  InputSchema.parse(input({ userUnitId: '1', building: { yearBuilt, units } }))

describe('assumptions schema', () => {
  test('every assumption needs a source and an ordered value', () => {
    expect(() => AssumptionsSchema.parse([{ id: 'x', description: 'd', unit: 'u', value: { low: 1, mid: 2, high: 3 }, confidence: 'low', sources: [] }])).toThrow()
    expect(() => a('x', 3, 2, 1)).toThrow()
  })
})

describe('vintage bands (ResStock groups)', () => {
  test('before 1950 / 1950–1999 / 2000 and later; unknown year → null', () => {
    expect([1910, 1949, 1950, 1999, 2000, null].map(vintageBand)).toEqual(['pre1950', 'pre1950', '1950_1999', '1950_1999', '2000_plus', null])
  })
})

describe('heating need from the user’s fuel records (Task 16)', () => {
  const recs = [{ year: 2024, quantity: 400, unit: 'gallons' as const }, { year: 2025, quantity: 500, unit: 'gallons' as const }]
  test('two seasons: min / mean / max × heat content × efficiency, confidence medium', () => {
    const e = heatLoadFromRecords(recs, 'oil', LIST)
    const k = 0.1385 * 0.84
    expect(e?.range.low).toBeCloseTo(400 * k, 6)
    expect(e?.range.mid).toBeCloseTo(450 * k, 6)
    expect(e?.range.high).toBeCloseTo(500 * k, 6)
    expect(e?.confidence).toBe('medium')
    expect(e?.why.join(' ')).toMatch(/2 heating seasons/)
    expect(e?.why.join(' ')).toMatch(/hot water/)
  })
  test('deliveries in the same season are added up', () => {
    const e = heatLoadFromRecords([{ year: 2024, quantity: 150, unit: 'gallons' }, { year: 2024, quantity: 250, unit: 'gallons' }], 'oil', LIST)
    expect(e?.range.mid).toBeCloseTo(400 * 0.1385 * 0.84, 6)
  })
  test('one season only → confidence low', () => {
    expect(heatLoadFromRecords(recs.slice(0, 1), 'oil', LIST)?.confidence).toBe('low')
  })
  test('records in a unit that doesn’t fit the fuel are not used', () => {
    expect(heatLoadFromRecords([{ year: 2024, quantity: 400, unit: 'therms' }], 'oil', LIST)).toBeNull()
  })
  test('no heat content or efficiency for the fuel → null, never a guess', () => {
    expect(heatLoadFromRecords([{ year: 2024, quantity: 400, unit: 'gallons' }], 'propane', LIST)).toBeNull()
  })
})

describe('quantitiesFor: the most specific source wins', () => {
  test('records → medium heat load; ResStock fuel × vintage → tons; cost = tons × $/ton', () => {
    const i = building([unit('1', { heatingFuel: 'oil', fuelRecords: [{ year: 2024, quantity: 400, unit: 'gallons' }, { year: 2025, quantity: 500, unit: 'gallons' }] })], 1910)
    const q = quantitiesFor(i, LIST)('1')
    expect(q.heatLoadMMBtu?.confidence).toBe('medium')
    expect(q.heatPumpTons?.range).toEqual(range(2.1, 2.6, 3.4))
    expect(q.heatPumpTons?.confidence).toBe('low')
    expect(q.cost.heat_pump?.range.mid).toBeCloseTo(2.6 * 5830, 6)
    expect(q.cost.heat_pump?.confidence).toBe('low')
  })
  test('a contractor’s quoted size beats ResStock (medium)', () => {
    const q = quantitiesFor(building([unit('1', { heatingFuel: 'oil', heatPumpTonsQuoted: 3 })], 1910), LIST)('1')
    expect(q.heatPumpTons?.range).toEqual(range(3, 3, 3))
    expect(q.heatPumpTons?.confidence).toBe('medium')
    expect(q.cost.heat_pump?.confidence).toBe('medium')
  })
  test('no records → ResStock heat load (low); unknown year → fuel-only group', () => {
    const q = quantitiesFor(building([unit('1', { heatingFuel: 'oil' })], null), LIST)('1')
    expect(q.heatLoadMMBtu?.range).toEqual(range(22.8, 35.8, 50.8))
    expect(q.heatLoadMMBtu?.confidence).toBe('low')
    expect(q.heatPumpTons?.range).toEqual(range(1.97, 2.48, 3.29))
  })
  test('unknown fuel → nothing estimated; no assumption for weatherization or solar → missing', () => {
    const q = quantitiesFor(building([unit('1')], 1910), LIST)('1')
    expect(q.heatLoadMMBtu).toBeNull()
    expect(q.heatPumpTons).toBeNull()
    expect(q.cost).toEqual({})
    expect(q.solarKwhPerYear).toBeNull()
  })
})
