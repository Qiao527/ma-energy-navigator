import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { breakEven, heatCosts, heatPumpPrice, report, unitEnergy, withOverrides } from '../src/energy.js'
import { InputSchema } from '../src/facts.js'
import { KWH_PER_MMBTU } from '../src/finance.js'
import { AssumptionsSchema, type Assumption } from '../src/quantities.js'
import { loadAssumptions, loadRuleSet } from '../src/load-rules.js'
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

describe('the price of one unit of heat, and the break-even point (why heat pumps may not save)', () => {
  test('cost per MMBtu of heat delivered: fuel price ÷ heat content ÷ efficiency; heat pump: kWh per MMBtu ÷ COP × price', () => {
    const t = heatCosts(LIST)
    const oil = t.find(x => x.id === 'oil')
    const hp = t.find(x => x.id === 'heat_pump')
    expect(oil?.perMMBtu.range.mid).toBeCloseTo(3.1 / 0.1385 / 0.84, 6)
    expect(hp?.perMMBtu.range.mid).toBeCloseTo(KWH_PER_MMBTU / 2.41 * 0.35, 6)
    expect(hp?.perMMBtu.range.low).toBeCloseTo(KWH_PER_MMBTU / 2.8 * 0.33, 6)
    expect(hp?.perMMBtu.range.high).toBeCloseTo(KWH_PER_MMBTU / 1.9 * 0.35, 6)
  })
  test('break-even vs oil: the electricity price, and the efficiency, at which a heat pump costs the same (typical values)', () => {
    const b = breakEven(LIST, 'oil')
    const oilPer = 3.1 / 0.1385 / 0.84
    expect(b?.electricityPricePerKwh).toBeCloseTo(oilPer * 2.41 / KWH_PER_MMBTU, 6)
    expect(b?.seasonalCop).toBeCloseTo(0.35 * KWH_PER_MMBTU / oilPer, 6)
  })
  test('a fuel without a sourced price gives no row and no break-even', () => {
    expect(heatCosts(LIST).some(x => x.id === 'propane')).toBe(false)
    expect(breakEven(LIST, 'propane')).toBeNull()
  })
})

describe('what-if controls: the user’s own values replace the statewide ones', () => {
  test('an override becomes that exact value, says it is the user’s, and leaves other assumptions alone', () => {
    const l = withOverrides(LIST, { 'price.electricity': 0.25, heat_pump_seasonal_cop: 3 })
    const p = l.find(x => x.id === 'price.electricity')
    expect(p?.value).toEqual({ low: 0.25, mid: 0.25, high: 0.25 })
    expect(p?.description).toMatch(/your value/i)
    expect(l.find(x => x.id === 'heat_pump_seasonal_cop')?.value.mid).toBe(3)
    expect(l.find(x => x.id === 'price.oil')).toEqual(LIST.find(x => x.id === 'price.oil'))
  })
  test('an override for an assumption that does not exist is ignored, never invented', () => {
    expect(withOverrides(LIST, { 'price.propane': 3 }).some(x => x.id === 'price.propane')).toBe(false)
  })
})

describe('heat pumps on an owner-paid meter (fair option 3)', () => {
  const i = InputSchema.parse(input({ role: 'owner_occupant_landlord', userUnitId: '1', building: { units: [
    unit('1', { occupancy: 'owner', heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'owner', fuelRecords: RECS, hotWaterFromBoiler: false }),
    unit('2', { occupancy: 'renter', heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', fuelRecords: RECS, hotWaterFromBoiler: false }),
  ] } }))
  test('the tenant’s electric bill no longer changes; the landlord gets the net; nothing shifts', () => {
    const u = unitEnergy(i, '2', LIST, { heatPumpMeter: 'owner' })
    expect(u.split?.tenant.annual).toBeNull()
    expect(u.split?.owner.annual).toEqual(u.bills?.net)
  })
})

describe('report: heat pump meter option reaches the landlord view', () => {
  const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
  const rules = loadRuleSet(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const list = loadAssumptions(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const floor = (id: string, occupancy: 'owner' | 'renter') => unit(id, {
    occupancy, heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: occupancy === 'owner' ? 'owner' : 'tenant', fuelRecords: RECS, hotWaterFromBoiler: false,
  })
  const i = input({ role: 'owner_occupant_landlord', userUnitId: '1', building: { yearBuilt: 1910, electricUtility: 'eversource', units: [floor('1', 'owner'), floor('2', 'renter')] } })
  test('owner-paid meter: no shifted cost, and the landlord’s change equals the real energy change', () => {
    const r = report(i, rules, { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false, heatPumpMeter: 'owner' }, list)
    expect(r.landlord?.shiftedToTenants).toEqual([])
    expect(r.landlord?.landlordAnnual?.range.mid).toBeCloseTo(r.landlord?.realSavings?.range.mid ?? NaN, 6)
  })
})

describe('seasonal heat pump rate: winter delivery discount by electric company', () => {
  const RATED = [...LIST, a('heat_pump_rate_discount.eversource', 0.0783, 0.0783, 0.0783), a('heat_pump_rate_discount.national_grid', 0.0424, 0.0424, 0.0424)]
  const at = (electricUtility: 'eversource' | 'national_grid' | 'unitil' | 'cape_light_compact' | 'municipal' | null) =>
    InputSchema.parse(input({ userUnitId: '1', building: { electricUtility, units: [unit('1', { heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', fuelRecords: RECS, hotWaterFromBoiler: false })] } }))
  const load = 350 * 0.1385 * 0.84
  test('Eversource: heat pump kWh are priced at the statewide rate minus the winter discount', () => {
    const u = unitEnergy(at('eversource'), '1', RATED)
    expect(u.bills?.electricBill.range.mid).toBeCloseTo((load * KWH_PER_MMBTU / 2.41) * (0.35 - 0.0783), 6)
    expect(u.bills?.electricBill.range.low).toBeCloseTo((load * KWH_PER_MMBTU / 2.8) * (0.33 - 0.0783), 6)
    expect(u.notes.join(' ')).toMatch(/seasonal heat pump rate/)
  })
  test('Cape Light Compact towns are Eversource for delivery, so the same discount applies', () => {
    expect(heatPumpPrice(RATED, 'cape_light_compact')?.rate).toBe('seasonal')
  })
  test('National Grid uses its own discount', () => {
    expect(heatPumpPrice(RATED, 'national_grid')?.price.range.mid).toBeCloseTo(0.35 - 0.0424, 9)
  })
  test('a municipal utility, Unitil (no sourced figure yet) or an unknown company: the standard rate, and the page says why', () => {
    for (const c of ['municipal', 'unitil', null] as const) {
      const h = heatPumpPrice(RATED, c)
      expect(h?.rate).toBe('standard')
      expect(h?.price.range.mid).toBe(0.35)
      expect(h?.note).toBeTruthy()
    }
    const u = unitEnergy(at('municipal'), '1', RATED)
    expect(u.bills?.electricBill.range.mid).toBeCloseTo((load * KWH_PER_MMBTU / 2.41) * 0.35, 6)
    expect(u.notes.join(' ')).toMatch(/municipal/i)
  })
  test('without the discount assumption the standard rate is used (no invented discount)', () => {
    expect(heatPumpPrice(LIST, 'eversource')?.rate).toBe('standard')
  })
  test('the price of heat and the break-even efficiency use the building’s heat pump rate; the break-even price is the rate to beat', () => {
    const hp = heatCosts(RATED, 'eversource').find(x => x.id === 'heat_pump')
    expect(hp?.perMMBtu.range.mid).toBeCloseTo(KWH_PER_MMBTU / 2.41 * (0.35 - 0.0783), 6)
    expect(heatCosts(RATED).find(x => x.id === 'heat_pump')?.perMMBtu.range.mid).toBeCloseTo(KWH_PER_MMBTU / 2.41 * 0.35, 6)
    const b = breakEven(RATED, 'oil', 'eversource')
    const oilPer = 3.1 / 0.1385 / 0.84
    expect(b?.seasonalCop).toBeCloseTo((0.35 - 0.0783) * KWH_PER_MMBTU / oilPer, 6)
    expect(b?.electricityPricePerKwh).toBeCloseTo(oilPer * 2.41 / KWH_PER_MMBTU, 6)
    expect(b?.heatPumpPricePerKwh).toBeCloseTo(0.35 - 0.0783, 9)
  })
  test('a what-if electricity price is the standard rate; the discount still comes off it', () => {
    const h = heatPumpPrice(withOverrides(RATED, { 'price.electricity': 0.3 }), 'eversource')
    expect(h?.price.range.mid).toBeCloseTo(0.3 - 0.0783, 9)
  })
})
