import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { breakEven, heatCosts, heatPumpPrice, report, unitEnergy, withOverrides } from '../src/energy.js'
import { InputSchema } from '../src/facts.js'
import { fairness } from '../../web/src/fairness.js'
import { hasUnestimatedWater, shiftedCostState } from '../../web/src/shift.js'
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
  test('heat pump water heater without a sourced electricity figure: not estimated, and the note says what is left out', () => {
    const i = InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'oil', fuelRecords: RECS, hotWaterFromBoiler: true, hotWaterAfter: 'heat_pump_water_heater' })] } }))
    const u = unitEnergy(i, '1', LIST)
    expect(u.hotWater).toBeUndefined()
    expect(u.notes.join(' ')).toMatch(/water heater/)
  })
  describe('heat pump water heater with a sourced yearly electricity use', () => {
    const HW = [...LIST, a('water_heater_annual_kwh.heat_pump_water_heater', 426, 862, 1534, 'low')]
    const i = InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', fuelRecords: RECS, hotWaterFromBoiler: true, hotWaterAfter: 'heat_pump_water_heater' })] } }))
    const u = unitEnergy(i, '1', HW)
    const hw = u.hotWater
    if (hw?.after !== 'heat_pump_water_heater') throw new Error('expected a heat pump water heater')
    test('the hot-water oil goes (share × mean gallons × oil price) and the water heater electricity comes (kWh × standard price)', () => {
      expect(hw.bills.fuelBill.range.low).toBeCloseTo(-350 * 0.272 * 3.43, 6)
      expect(hw.bills.fuelBill.range.high).toBeCloseTo(-350 * 0.145 * 3.1, 6)
      expect(hw.bills.electricBill.range.mid).toBeCloseTo(862 * 0.35, 6)
      expect(hw.bills.electricBill.range.low).toBeCloseTo(426 * 0.33, 6)
      expect(hw.bills.net.range.mid).toBeCloseTo(862 * 0.35 - 350 * 0.182 * 3.1, 6)
    })
    test('the water heater runs on the floor’s own meter', () => {
      expect(hw.meterPaidBy).toBe('tenant')
    })
    test('CO₂ includes the hot-water switch: oil burned for hot water before, its grid electricity after', () => {
      const base = unitEnergy(InputSchema.parse(input({ building: { units: [unit('1', { heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', fuelRecords: RECS, hotWaterFromBoiler: true, hotWaterAfter: null })] } })), '1', HW)
      const oilKg = 350 * 0.182 * 0.1385 * 73.96
      const elecKg = 862 * 537.2 * LB / 1000
      expect((u.co2?.before.range.mid ?? 0) - (base.co2?.before.range.mid ?? 0)).toBeCloseTo(oilKg / 1000, 6)
      expect((u.co2?.after.range.mid ?? 0) - (base.co2?.after.range.mid ?? 0)).toBeCloseTo(elecKg / 1000, 6)
    })
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
  test('unknown electricity payers remain unknown in the displayed cost-shift status', () => {
    const unknown = { ...i, building: { ...i.building, units: i.building.units.map(u => ({ ...u, electricPaidBy: null })) } }
    const result = report(unknown, rules, { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false }, list)
    expect(result.landlord).not.toBeNull()
    expect(shiftedCostState(result.landlord!)).toBe('unknown')
  })
  test('a known shift plus an unknown payer cannot be presented as a complete shift', () => {
    const mixed = { ...i, building: { ...i.building, units: i.building.units.map(u => u.id === '3' ? { ...u, electricPaidBy: null } : u) } }
    const result = report(mixed, rules, { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false }, list)
    expect(result.landlord?.shiftedToTenants).toHaveLength(1)
    expect(shiftedCostState(result.landlord!)).toBe('unknown')
    const html = fairness(result, { input: mixed, installDate: '', boilerNeedsReplacing: false, demo: false }, rules.legal.find(x => x.id === 'ma_105_cmr_410_written_rental_agreement'))
    expect(html).toContain('full amount is unknown')
    expect(html).toContain('class="law"')
    expect(html).toContain('Lower the rent')
    expect(html).not.toMatch(/\$[\d,]+/)
  })
  test('fairness copy does not claim heat pumps use tenant meters when only hot water does', () => {
    const withWater = { ...i, building: { ...i.building, units: i.building.units.map(u => ({ ...u, hotWaterFromBoiler: true, hotWaterAfter: 'heat_pump_water_heater' as const })) } }
    const result = report(withWater, rules, { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false, heatPumpMeter: 'owner' }, list)
    expect(result.landlord?.shiftedToTenants).toHaveLength(2)
    const html = fairness(result, { input: withWater, installDate: '', boilerNeedsReplacing: false, demo: false }, rules.legal.find(x => x.id === 'ma_105_cmr_410_written_rental_agreement'))
    expect(html).not.toContain('Heat pumps on the tenants’ meters')
    expect(html).toContain('heating and hot water')
  })
  test('an unestimated water-heater switch cannot be presented as zero tenant cost shift', () => {
    const withWater = { ...i, building: { ...i.building, units: i.building.units.map(u => ({ ...u, hotWaterFromBoiler: true, hotWaterAfter: 'electric_resistance' as const })) } }
    const result = report(withWater, rules, { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false, heatPumpMeter: 'owner' }, list)
    expect(result.landlord).not.toBeNull()
    expect(hasUnestimatedWater(withWater, result.units)).toBe(true)
    expect(shiftedCostState(result.landlord!, hasUnestimatedWater(withWater, result.units))).toBe('unknown')
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
  const W = 0.851
  const RATED = [...LIST, a('heat_pump_rate_discount.eversource', 0.0783, 0.0783, 0.0783), a('heat_pump_rate_discount.national_grid', 0.0424, 0.0424, 0.0424), a('heating_hdd_share.ma.nov_apr', W, W, W)]
  const at = (electricUtility: 'eversource' | 'national_grid' | 'unitil' | 'cape_light_compact' | 'municipal' | null) =>
    InputSchema.parse(input({ userUnitId: '1', building: { electricUtility, units: [unit('1', { heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', fuelRecords: RECS, hotWaterFromBoiler: false })] } }))
  const load = 350 * 0.1385 * 0.84
  test('Eversource: heat pump kWh are priced at the statewide rate minus the winter discount', () => {
    const u = unitEnergy(at('eversource'), '1', RATED)
    expect(u.bills?.electricBill.range.mid).toBeCloseTo((load * KWH_PER_MMBTU / 2.41) * (0.35 - 0.0783 * W), 6)
    expect(u.bills?.electricBill.range.low).toBeCloseTo((load * KWH_PER_MMBTU / 2.8) * (0.33 - 0.0783 * W), 6)
    expect(u.notes.join(' ')).toMatch(/seasonal heat pump rate/)
  })
  test('Cape Light Compact towns are Eversource for delivery, so the same discount applies', () => {
    expect(heatPumpPrice(RATED, 'cape_light_compact')?.rate).toBe('seasonal')
  })
  test('National Grid uses its own discount', () => {
    expect(heatPumpPrice(RATED, 'national_grid')?.price.range.mid).toBeCloseTo(0.35 - 0.0424 * W, 9)
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
  test('the discount covers only the November–April share of the heating season; without that share, no discount is assumed', () => {
    expect(heatPumpPrice(RATED.filter(x => x.id !== 'heating_hdd_share.ma.nov_apr'), 'eversource')?.rate).toBe('standard')
  })
  test('the price of heat and the break-even efficiency use the building’s heat pump rate; the break-even price is the rate to beat', () => {
    const hp = heatCosts(RATED, 'eversource').find(x => x.id === 'heat_pump')
    expect(hp?.perMMBtu.range.mid).toBeCloseTo(KWH_PER_MMBTU / 2.41 * (0.35 - 0.0783 * W), 6)
    expect(heatCosts(RATED).find(x => x.id === 'heat_pump')?.perMMBtu.range.mid).toBeCloseTo(KWH_PER_MMBTU / 2.41 * 0.35, 6)
    const b = breakEven(RATED, 'oil', 'eversource')
    const oilPer = 3.1 / 0.1385 / 0.84
    expect(b?.seasonalCop).toBeCloseTo((0.35 - 0.0783 * W) * KWH_PER_MMBTU / oilPer, 6)
    expect(b?.electricityPricePerKwh).toBeCloseTo(oilPer * 2.41 / KWH_PER_MMBTU, 6)
    expect(b?.heatPumpPricePerKwh).toBeCloseTo(0.35 - 0.0783 * W, 9)
  })
  test('a what-if electricity price is the standard rate; the discount still comes off it', () => {
    const h = heatPumpPrice(withOverrides(RATED, { 'price.electricity': 0.3 }), 'eversource')
    expect(h?.price.range.mid).toBeCloseTo(0.3 - 0.0783 * W, 9)
  })
})

describe('report: a building-wide answer covers every floor (review 2 and 4)', () => {
  const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
  const rules = loadRuleSet(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const list = loadAssumptions(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const opts = { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false }
  const oil = (id: string, over: Parameters<typeof unit>[1] = {}) => unit(id, {
    occupancy: id === '1' ? 'owner' : 'renter', heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: id === '1' ? 'owner' : 'tenant', fuelRecords: RECS, hotWaterFromBoiler: false, ...over,
  })
  test('one floor cannot be estimated: no building total, no CO₂ total, no landlord view, and the reason names the floor', () => {
    const r = report(input({ role: 'owner_occupant_landlord', userUnitId: '1', building: { yearBuilt: 1910, units: [oil('1'), oil('2'), oil('3', { heatingFuel: null })] } }), rules, opts, list)
    expect(r.notEstimated).toEqual(['3'])
    expect(r.buildingChange).toBeNull()
    expect(r.co2Total).toBeNull()
    expect(r.landlord).toBeNull()
    expect(r.landlordReason).toMatch(/3/)
  })
  test('a floor whose tenant buys the oil still counts in the building total, but not in the landlord’s own saving', () => {
    const r = report(input({ role: 'owner_occupant_landlord', userUnitId: '1', building: { yearBuilt: 1910, units: [oil('1'), oil('2', { heatPaidBy: 'tenant' })] } }), rules, opts, list)
    const net = (id: string) => r.units.find(u => u.unitId === id)?.bills?.net.range.mid ?? NaN
    expect(r.notEstimated).toEqual([])
    expect(r.buildingChange?.range.mid).toBeCloseTo(net('1') + net('2'), 6)
    expect(r.landlord?.realSavings?.range.mid).toBeCloseTo(net('1'), 6)
  })
  test('a floor already on a heat pump has nothing to switch and does not block the total', () => {
    const r = report(input({ role: 'owner_occupant_landlord', userUnitId: '1', building: { yearBuilt: 1910, units: [oil('1'), oil('2', { heatingFuel: 'heat_pump' })] } }), rules, opts, list)
    expect(r.notEstimated).toEqual([])
    expect(r.buildingChange).not.toBeNull()
  })
})
