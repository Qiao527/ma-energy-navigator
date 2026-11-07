import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { report, unitEnergy } from '../src/energy.js'
import { InputSchema } from '../src/facts.js'
import { KWH_PER_MMBTU } from '../src/finance.js'
import { loadRuleSet } from '../src/load-rules.js'
import { AssumptionsSchema, loadAssumptions, type Assumption } from '../src/quantities.js'
import { input, SOURCE, unit } from './fixtures.js'

const a = (id: string, low: number, mid: number, high: number, confidence: Assumption['confidence'] = 'medium'): Assumption =>
  AssumptionsSchema.parse([{ id, description: `about ${id}`, unit: 'x', value: { low, mid, high }, confidence, sources: [SOURCE] }])[0] as Assumption

const LIST: Assumption[] = [
  a('heat_pump_cost_per_ton', 3694, 5664, 7634),
  a('heat_content_mmbtu_per_unit.oil', 0.1385, 0.1385, 0.1385, 'high'),
  a('heating_efficiency.oil', 0.84, 0.84, 0.84),
  a('price.oil', 3.1, 3.1, 3.43),
  a('price.electricity', 0.33, 0.35, 0.35),
  a('heat_pump_seasonal_cop', 1.9, 2.41, 2.8),
  a('co2_kg_per_mmbtu.oil', 73.96, 73.96, 73.96, 'high'),
  a('co2_lb_per_mwh.grid', 537.2, 537.2, 537.2),
  a('annual_heat_load_mmbtu.oil', 22.8, 35.8, 50.8, 'low'),
  a('heat_pump_tons.oil', 1.97, 2.48, 3.29, 'low'),
  a('hot_water_share_of_fuel.oil', 0.145, 0.182, 0.272, 'low'),
  a('boiler_annual_service_cost.oil', 120, 135, 150, 'low'),
]
const RECS = [{ year: 2024, quantity: 350, unit: 'gallons' as const }, { year: 2025, quantity: 350, unit: 'gallons' as const }]
const LB = 0.45359237

describe('unitEnergy: bills from sourced prices and measured heat pump efficiency (E1, E2)', () => {
  const i = InputSchema.parse(input({ userUnitId: '1', building: { units: [unit('1', { heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', fuelRecords: RECS, hotWaterFromBoiler: false })] } }))
  const u = unitEnergy(i, '1', LIST)
  const load = 350 * 0.1385 * 0.84
  test('fuel bill = load ÷ efficiency × price per MMBtu; electric bill = load in kWh ÷ COP × price', () => {
    expect(u.bills?.fuelBill.range.mid).toBeCloseTo(-(load / 0.84) * (3.1 / 0.1385), 6)
    expect(u.bills?.electricBill.range.mid).toBeCloseTo((load * KWH_PER_MMBTU / 2.41) * 0.35, 6)
  })
  test('the payer split follows who pays which bill', () => {
    expect(u.split?.owner.annual).toEqual(u.bills?.fuelBill)
    expect(u.split?.tenant.annual).toEqual(u.bills?.electricBill)
  })
  test('CO₂ (E4): oil burned before, grid electricity after, in tonnes per year', () => {
    expect(u.co2?.before.range.mid).toBeCloseTo((load / 0.84) * 73.96 / 1000, 6)
    expect(u.co2?.after.range.mid).toBeCloseTo((load * KWH_PER_MMBTU / 2.41) * (537.2 * LB / 1000) / 1000, 6)
    expect(u.co2?.change.range.high).toBeLessThan(0)
  })
  test('comparison with similar buildings (E5): records-based need vs the ResStock typical range', () => {
    expect(u.comparison).toMatchObject({ position: 'typical' })
    expect(u.comparison?.typical.range.mid).toBe(35.8)
  })
})

describe('unitEnergy: what is missing is said, never guessed', () => {
  test('no price for the fuel → no bills, with a note', () => {
    const i = InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'oil' })] } }))
    const u = unitEnergy(i, '1', LIST.filter(x => x.id !== 'price.oil'))
    expect(u.bills).toBeNull()
    expect(u.notes.join(' ')).toMatch(/no sourced price/)
  })
  test('already a heat pump → nothing to switch', () => {
    const i = InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'heat_pump' })] } }))
    expect(unitEnergy(i, '1', LIST).bills).toBeNull()
  })
  test('high use vs similar buildings is "more room to save", never a judgment', () => {
    const big = [{ year: 2024, quantity: 900, unit: 'gallons' as const }, { year: 2025, quantity: 900, unit: 'gallons' as const }]
    const i = InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'oil', fuelRecords: big, hotWaterFromBoiler: false })] } }))
    const c = unitEnergy(i, '1', LIST).comparison
    expect(c?.position).toBe('higher_than_most')
    expect(c?.message).toMatch(/room to save/)
    expect(c?.message).not.toMatch(/wast/i)
  })
})

describe('unitEnergy: hot water (F2)', () => {
  test('boiler kept for hot water: the kept hot-water oil and the service cost', () => {
    const i = InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'oil', fuelRecords: RECS, hotWaterFromBoiler: true, hotWaterAfter: 'boiler' })] } }))
    const hw = unitEnergy(i, '1', LIST).hotWater
    expect(hw?.after).toBe('boiler')
    if (hw?.after !== 'boiler') throw new Error('expected boiler')
    expect(hw.fuelCostKept?.range.mid).toBeCloseTo(350 * 0.182 * 3.1, 6)
    expect(hw.fixedCost?.range).toEqual({ low: 120, mid: 135, high: 150 })
  })
  test('electric water heater: not estimated yet (no sourced efficiency), and the note says what is left out', () => {
    const i = InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'oil', fuelRecords: RECS, hotWaterFromBoiler: true, hotWaterAfter: 'heat_pump_water_heater' })] } }))
    const u = unitEnergy(i, '1', LIST)
    expect(u.hotWater).toBeUndefined()
    expect(u.notes.join(' ')).toMatch(/water heater/)
  })
})

describe('report (E6): Story 1 end to end on the draft rules', () => {
  const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
  const rules = loadRuleSet(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const list = loadAssumptions(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const floor = (id: string, occupancy: 'owner' | 'renter') => unit(id, {
    occupancy, heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: occupancy === 'owner' ? 'owner' : 'tenant',
    hasResidentialHeatingMeter: true, occupiedAllWinter: true, fuelRecords: RECS, hotWaterFromBoiler: false,
  })
  const i = input({
    role: 'owner_occupant_landlord', userUnitId: '1',
    building: { municipality: 'Boston', ownership: 'single_owner', yearBuilt: 1910, electricUtility: 'eversource', gasUtility: 'national_grid', units: [floor('1', 'owner'), floor('2', 'renter'), floor('3', 'renter')] },
  })
  const r = report(i, rules, { asOf: '2026-11-15', installDate: '2026-12-01', boilerNeedsReplacing: false }, list)
  test('every unit gets bills and CO₂; the building total adds them', () => {
    expect(r.units.map(u => u.bills !== null)).toEqual([true, true, true])
    expect(r.co2Total?.change.range.mid).toBeCloseTo(r.units.reduce((s, u) => s + (u.co2?.change.range.mid ?? 0), 0), 6)
  })
  test('the landlord view: real savings vs heating cost shifted onto tenants, payback on real savings', () => {
    expect(r.landlord).not.toBeNull()
    expect(r.landlord?.shiftedToTenants.map(s => s.unitId)).toEqual(['2', '3'])
    expect(r.landlord?.netUpfront.range.mid).toBeGreaterThan(0)
  })
  test('the "boiler needs replacing anyway" baseline uses the sourced replacement cost per ton', () => {
    const b = report(i, rules, { asOf: '2026-11-15', installDate: '2026-12-01', boilerNeedsReplacing: true }, list)
    expect(b.landlord?.usesReplacementBaseline).toBe(true)
  })
  test('a tenant gets no landlord view', () => {
    expect(report({ ...i, role: 'tenant', userUnitId: '2' }, rules, { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false }, list).landlord).toBeNull()
  })
})
