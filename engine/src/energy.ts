import { combine, estimate, type Estimate } from './estimate.js'
import { InputSchema, type Fuel, type Input } from './facts.js'
import { heatPumpSwitch, KWH_PER_MMBTU, splitByPayer, type PayerSplit, type SwitchEstimates } from './finance.js'
import { landlordView, type HotWaterProject, type LandlordView, type UnitProject } from './landlord.js'
import { navigate, type NavigateOptions, type NavigateResult } from './navigate.js'
import { keyOf } from './offers.js'
import { find, heatLoadFromRecords, quantitiesFor, stock, vintageBand, type Assumption } from './quantities.js'
import { div, mul, mulAny, point, scale, sub, sum, type Range } from './range.js'
import { offerKey, type RuleSet } from './rules-schema.js'

const FUELS_BURNED: readonly Fuel[] = ['oil', 'natural_gas', 'propane']
const KG_PER_LB = 0.45359237

/** Records-based heating need vs similar Massachusetts buildings (E5). Wording: room to save, never a judgment (principle 6). */
export interface Comparison {
  position: 'lower_than_most' | 'typical' | 'higher_than_most'
  yours: Estimate
  typical: Estimate
  message: string
}

export interface UnitEnergy {
  unitId: string
  heatingFuel: Fuel | null
  /** Annual heat delivered, MMBtu. */
  heatLoad: Estimate | null
  comparison: Comparison | null
  /** Bill changes from replacing the current heating with a heat pump; null when not computable. */
  bills: SwitchEstimates | null
  split: PayerSplit | null
  /** Tonnes CO₂ per year; change = after − before (negative = less CO₂). */
  co2: { before: Estimate; after: Estimate; change: Estimate } | null
  hotWater: HotWaterProject | undefined
  /** What was left out and why (shown to the user). */
  notes: string[]
}

/** Price per MMBtu of fuel bought, and the CO₂ per MMBtu of fuel bought, for the current heating fuel. */
function fuelSide(fuel: Fuel, list: readonly Assumption[]): { price: Estimate; efficiency: Estimate; kgCo2: Estimate } | null {
  const elecKg = find(list, 'co2_lb_per_mwh.grid')
  if (fuel === 'electric_resistance') {
    const p = find(list, 'price.electricity')
    if (p === null || elecKg === null) return null
    return {
      price: combine(scale(p.range, KWH_PER_MMBTU), [p]),
      efficiency: estimate(point(1), 'high', 'electric resistance heat is 100% efficient'),
      kgCo2: combine(scale(elecKg.range, (KG_PER_LB / 1000) * KWH_PER_MMBTU), [elecKg]),
    }
  }
  const price = find(list, `price.${fuel}`)
  const heat = find(list, `heat_content_mmbtu_per_unit.${fuel}`)
  const efficiency = find(list, `heating_efficiency.${fuel}`)
  const kgCo2 = find(list, `co2_kg_per_mmbtu.${fuel}`)
  if (price === null || heat === null || efficiency === null || kgCo2 === null) return null
  return { price: combine(div(price.range, heat.range), [price, heat]), efficiency, kgCo2 }
}

function compare(yours: Estimate, typical: Estimate): Comparison {
  const position = yours.range.mid > typical.range.high ? 'higher_than_most' : yours.range.mid < typical.range.low ? 'lower_than_most' : 'typical'
  const message = {
    higher_than_most: 'Your heating need is above most similar Massachusetts 2–4 unit homes, so insulation and air sealing have more room to save.',
    typical: 'Your heating need is in the typical range for similar Massachusetts 2–4 unit homes.',
    lower_than_most: 'Your heating need is below most similar Massachusetts 2–4 unit homes; insulation may still help, but with less room to save.',
  }[position]
  return { position, yours, typical, message }
}

const tonnes = (kg: Range): Range => scale(kg, 1 / 1000)

export interface EnergyOptions {
  /** Whose meter the heat pumps run on. 'unit' = each floor's own meter (who pays electricity); 'owner' = an owner-paid meter. */
  heatPumpMeter?: 'unit' | 'owner'
}

export function unitEnergy(input: Input, unitId: string, list: readonly Assumption[], opts: EnergyOptions = {}): UnitEnergy {
  const u = input.building.units.find(x => x.id === unitId)
  if (u === undefined) throw new Error(`unknown unit ${unitId}`)
  const notes: string[] = []
  const band = vintageBand(input.building.yearBuilt)
  const q = quantitiesFor(input, list)(unitId)
  const heatLoad = q.heatLoadMMBtu
  const fromRecords = u.fuelRecords !== null && u.heatingFuel !== null ? heatLoadFromRecords(u.fuelRecords, u.heatingFuel, list, u.hotWaterFromBoiler) : null
  const typical = stock(list, 'annual_heat_load_mmbtu', u.heatingFuel, band)
  const comparison = fromRecords !== null && typical !== null ? compare(fromRecords, typical) : null
  if (comparison !== null && u.hotWaterFromBoiler === null) {
    comparison.message += ' If your boiler also heats your hot water, your records include it, so this may read high.'
  }

  const out: UnitEnergy = { unitId, heatingFuel: u.heatingFuel, heatLoad, comparison, bills: null, split: null, co2: null, hotWater: undefined, notes }
  if (u.heatingFuel === null) {
    notes.push('Heating fuel unknown, so bills and CO₂ are not estimated.')
    return out
  }
  if (u.heatingFuel === 'heat_pump' || u.heatingFuel === 'other') return out
  if (heatLoad === null) {
    notes.push('No heating need estimate (enter fuel records), so bills and CO₂ are not estimated.')
    return out
  }
  const side = fuelSide(u.heatingFuel, list)
  const elec = find(list, 'price.electricity')
  const cop = find(list, 'heat_pump_seasonal_cop')
  const gridLb = find(list, 'co2_lb_per_mwh.grid')
  if (side === null || elec === null || cop === null || gridLb === null) {
    notes.push(`There is no sourced price, efficiency or emission factor for ${u.heatingFuel} or for heat pumps yet, so bills are not estimated.`)
    return out
  }
  out.bills = heatPumpSwitch({ load: heatLoad, fuelEfficiency: side.efficiency, fuelPricePerMMBtu: side.price, seasonalCop: cop, electricityPricePerKwh: elec })
  out.split = splitByPayer(out.bills, { heatingFuel: u.heatingFuel, heatPaidBy: u.heatPaidBy, electricPaidBy: opts.heatPumpMeter === 'owner' ? 'owner' : u.electricPaidBy, upfrontNet: null })

  // CO₂ per MMBtu of heat delivered: fuel burned ÷ efficiency; heat pump kWh ÷ COP × grid factor.
  const fuelKg = div(side.kgCo2.range, side.efficiency.range)
  const hpKg = div(scale(gridLb.range, (KG_PER_LB / 1000) * KWH_PER_MMBTU), cop.range)
  const inputs = [heatLoad, side.kgCo2, side.efficiency, gridLb, cop]
  out.co2 = {
    before: combine(tonnes(mul(heatLoad.range, fuelKg)), inputs),
    after: combine(tonnes(mul(heatLoad.range, hpKg)), inputs),
    change: combine(tonnes(mulAny(heatLoad.range, sub(hpKg, fuelKg))), inputs),
  }

  if (u.hotWaterFromBoiler === true && FUELS_BURNED.includes(u.heatingFuel)) {
    if (u.hotWaterAfter === 'boiler') {
      const share = find(list, `hot_water_share_of_fuel.${u.heatingFuel}`)
      const price = find(list, `price.${u.heatingFuel}`)
      const seasons = new Map<number, number>()
      for (const r of u.fuelRecords ?? []) seasons.set(r.year, (seasons.get(r.year) ?? 0) + r.quantity)
      const mean = seasons.size === 0 ? null : [...seasons.values()].reduce((s, x) => s + x, 0) / seasons.size
      const fuelCostKept = share !== null && price !== null && mean !== null
        ? combine(mul(scale(share.range, mean), price.range), [share, price], 'from your fuel records × the typical hot-water share')
        : null
      if (fuelCostKept === null) notes.push('The hot-water fuel that stays on the bill is not estimated (needs fuel records and a sourced hot-water share).')
      out.hotWater = { after: 'boiler', fuelCostKept, fixedCost: find(list, `boiler_annual_service_cost.${u.heatingFuel}`) }
    } else if (u.hotWaterAfter !== null) {
      notes.push('Switching hot water to an electric water heater is not estimated yet (no sourced water heater efficiency): the boiler fuel it saves and the electricity it uses are both left out.')
    }
  }
  return out
}

export interface ReportOptions extends NavigateOptions, EnergyOptions {
  /** Comparison baseline: the boiler needs replacing anyway (its sourced cost per ton is subtracted for payback). */
  boilerNeedsReplacing: boolean
}

export interface Report {
  navigation: NavigateResult
  units: UnitEnergy[]
  co2Total: { before: Estimate; after: Estimate; change: Estimate } | null
  /** Landlords only: "is it worth it for me?" Null with a reason otherwise. */
  landlord: LandlordView | null
  landlordReason: string | null
}

const sumOf = (es: Estimate[]): Estimate => combine(sum(es.map(e => e.range)), es)

/** The one entry point the web page calls (E6): offers, steps, per-unit energy, and the landlord view. */
export function report(rawInput: unknown, rules: RuleSet, options: ReportOptions, list: readonly Assumption[]): Report {
  const input = InputSchema.parse(rawInput)
  const navigation = navigate(input, rules, { asOf: options.asOf, installDate: options.installDate }, quantitiesFor(input, list))
  const units = input.building.units.map(u => unitEnergy(input, u.id, list, { heatPumpMeter: options.heatPumpMeter ?? 'unit' }))
  const withCo2 = units.flatMap(u => (u.co2 ? [u.co2] : []))
  const co2Total = withCo2.length === 0 ? null : {
    before: sumOf(withCo2.map(c => c.before)), after: sumOf(withCo2.map(c => c.after)), change: sumOf(withCo2.map(c => c.change)),
  }

  let landlord: LandlordView | null = null
  let landlordReason: string | null = null
  if (input.role === 'owner_occupant_landlord' || input.role === 'renting_landlord') {
    const q = quantitiesFor(input, list)
    const projects: UnitProject[] = []
    const costs: Estimate[] = []
    const tons: Estimate[] = []
    for (const e of units) {
      const u = input.building.units.find(x => x.id === e.unitId)
      if (u === undefined || e.bills === null || u.heatingFuel === null) continue
      projects.push({
        unitId: u.id, heatingFuel: u.heatingFuel, heatPaidBy: u.heatPaidBy, electricPaidBy: u.electricPaidBy, bills: e.bills,
        ...(options.heatPumpMeter === 'owner' ? { heatPumpMeterPaidBy: 'owner' as const } : {}),
        ...(e.hotWater ? { hotWater: e.hotWater } : {}),
      })
      const qu = q(u.id)
      if (qu.cost.heat_pump) costs.push(qu.cost.heat_pump)
      if (qu.heatPumpTons) tons.push(qu.heatPumpTons)
    }
    if (projects.length === 0 || costs.length !== projects.length) {
      landlordReason = 'The project cost or bill changes could not be estimated for every unit, so the "is it worth it" view is not shown.'
    } else {
      const byKey = new Map(rules.offers.map(o => [offerKey(o), o]))
      const owned = navigation.shown.filter(r => r.recipient === 'property_owner' && r.status === 'eligible' && byKey.get(keyOf(r))?.measure === 'heat_pump')
      const commitment = navigation.shown.some(r => r.status !== 'not_eligible' && r.prerequisites.some(p => p.id === 'no_rent_increase_commitment'))
      const perTon = find(list, 'oil_boiler_replacement_cost_per_ton')
      const replacement = options.boilerNeedsReplacing && perTon !== null && tons.length > 0
        ? combine(mul(sumOf(tons).range, perTon.range), [...tons, perTon]) : null
      landlord = landlordView({
        ownUnitId: input.role === 'owner_occupant_landlord' ? input.userUnitId : null,
        units: projects,
        projectCost: sumOf(costs),
        incentives: owned.map(r => ({ offerId: r.offerId, value: r.value })),
        rentCommitment: commitment
          ? { months: null, forgoneIncreasePerUnitMonth: null, rentedUnits: input.building.units.filter(u => u.occupancy === 'renter').length }
          : null,
        avoidedReplacementCost: replacement,
      })
    }
  }
  return { navigation, units, co2Total, landlord, landlordReason }
}

export type HeatSource = 'oil' | 'natural_gas' | 'propane' | 'electric_resistance' | 'heat_pump'

/** What one MMBtu of heat delivered to the home costs with each source, at sourced Massachusetts prices. */
export function heatCosts(list: readonly Assumption[]): { id: HeatSource; perMMBtu: Estimate }[] {
  const out: { id: HeatSource; perMMBtu: Estimate }[] = []
  for (const fuel of ['oil', 'natural_gas', 'propane', 'electric_resistance'] as const) {
    const s = fuelSide(fuel, list)
    if (s) out.push({ id: fuel, perMMBtu: combine(div(s.price.range, s.efficiency.range), [s.price, s.efficiency]) })
  }
  const elec = find(list, 'price.electricity')
  const cop = find(list, 'heat_pump_seasonal_cop')
  if (elec && cop) out.push({ id: 'heat_pump', perMMBtu: combine(div(scale(elec.range, KWH_PER_MMBTU), cop.range), [elec, cop]) })
  return out
}

/**
 * Where a heat pump costs the same as the current fuel, at typical (mid) values: the electricity price at today's
 * heat pump efficiency, and the efficiency at today's electricity price.
 */
export function breakEven(list: readonly Assumption[], fuel: Fuel): { electricityPricePerKwh: number; seasonalCop: number } | null {
  const s = fuelSide(fuel, list)
  const elec = find(list, 'price.electricity')
  const cop = find(list, 'heat_pump_seasonal_cop')
  if (s === null || elec === null || cop === null) return null
  const fuelPer = s.price.range.mid / s.efficiency.range.mid
  return { electricityPricePerKwh: (fuelPer * cop.range.mid) / KWH_PER_MMBTU, seasonalCop: (elec.range.mid * KWH_PER_MMBTU) / fuelPer }
}

/** What-if values (E7): the user's own price or efficiency replaces the sourced range with that exact value. Unknown ids are ignored. */
export function withOverrides(list: readonly Assumption[], overrides: Readonly<Record<string, number>>): Assumption[] {
  return list.map(a => {
    const v = overrides[a.id]
    if (v === undefined || !Number.isFinite(v) || v <= 0) return a
    return { ...a, value: { low: v, mid: v, high: v }, description: `Your value for the what-if (${a.unit}); the sourced figure was: ${a.description}` }
  })
}
