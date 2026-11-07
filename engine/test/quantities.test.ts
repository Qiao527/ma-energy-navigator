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
  a('hot_water_share_of_fuel.oil', 0.145, 0.182, 0.272, 'low', 157),
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

describe('weather normalization (E3): each season scaled to a normal winter by heating degree days', () => {
  const recs = [{ year: 2023, quantity: 400, unit: 'gallons' as const }, { year: 2024, quantity: 500, unit: 'gallons' as const }]
  const hdd = [a('heating_degree_days.ma.2023', 5571, 5571, 5571, 'high'), a('heating_degree_days_normal.ma.2023', 6441, 6441, 6441, 'high'),
    a('heating_degree_days.ma.2024', 6014, 6014, 6014, 'high'), a('heating_degree_days_normal.ma.2024', 6407, 6407, 6407, 'high')]
  const k = 0.1385 * 0.84
  test('a mild season counts for more, a cold one for less; the spread between seasons shrinks', () => {
    const e = heatLoadFromRecords(recs, 'oil', [...LIST, ...hdd], false)
    const s23 = 400 * 6441 / 5571
    const s24 = 500 * 6407 / 6014
    expect(e?.range.low).toBeCloseTo(Math.min(s23, s24) * k, 6)
    expect(e?.range.mid).toBeCloseTo((s23 + s24) / 2 * k, 6)
    expect(e?.range.high).toBeCloseTo(Math.max(s23, s24) * k, 6)
    expect(e?.why.join(' ')).toMatch(/normal winter/)
  })
  test('a season without degree-day data is used as recorded, and says so', () => {
    const e = heatLoadFromRecords([...recs, { year: 2030, quantity: 450, unit: 'gallons' }], 'oil', [...LIST, ...hdd], false)
    expect(e?.range.mid).toBeCloseTo((400 * 6441 / 5571 + 500 * 6407 / 6014 + 450) / 3 * k, 6)
    expect(e?.why.join(' ')).toMatch(/2030.*not weather-normalized/)
  })
})

describe('hot water from the same boiler (F2, Qiao 2026-11-07)', () => {
  const recs = [{ year: 2024, quantity: 400, unit: 'gallons' as const }, { year: 2025, quantity: 500, unit: 'gallons' as const }]
  const k = 0.1385 * 0.84
  test('hot water from the boiler: the hot-water share is taken out (widest share for the low end)', () => {
    const e = heatLoadFromRecords(recs, 'oil', LIST, true)
    expect(e?.range.low).toBeCloseTo(400 * k * (1 - 0.272), 6)
    expect(e?.range.mid).toBeCloseTo(450 * k * (1 - 0.182), 6)
    expect(e?.range.high).toBeCloseTo(500 * k * (1 - 0.145), 6)
    expect(e?.why.join(' ')).toMatch(/hot-water share was taken out/)
    expect(e?.why.join(' ')).not.toMatch(/may be overstated/)
  })
  test('hot water from the boiler but no sourced share for the fuel: no change, confidence low, says why', () => {
    const list = [...LIST.filter(x => !x.id.startsWith('hot_water_share')), a('heat_content_mmbtu_per_unit.propane', 0.091452, 0.091452, 0.091452, 'high'), a('heating_efficiency.propane', 0.82, 0.82, 0.82, 'medium')]
    const e = heatLoadFromRecords(recs, 'propane', list, true)
    expect(e?.range.mid).toBeCloseTo(450 * 0.091452 * 0.82, 6)
    expect(e?.confidence).toBe('low')
    expect(e?.why.join(' ')).toMatch(/no sourced hot-water share/i)
  })
  test('hot water not from the boiler: records are all heating, no caveat', () => {
    const e = heatLoadFromRecords(recs, 'oil', LIST, false)
    expect(e?.range.mid).toBeCloseTo(450 * k, 6)
    expect(e?.confidence).toBe('medium')
    expect(e?.why.join(' ')).not.toMatch(/hot water/)
  })
  test('not yet answered: no change, the caveat stays', () => {
    expect(heatLoadFromRecords(recs, 'oil', LIST, null)?.why.join(' ')).toMatch(/may be overstated/)
  })
  test('quantitiesFor passes the unit’s answer through', () => {
    const i = building([unit('1', { heatingFuel: 'oil', hotWaterFromBoiler: true, fuelRecords: recs })], 1910)
    expect(quantitiesFor(i, LIST)('1').heatLoadMMBtu?.range.mid).toBeCloseTo(450 * k * (1 - 0.182), 6)
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
