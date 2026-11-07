import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { approvalProblems } from './approvals.js'
import type { Quantities } from './benefit.js'
import { combine, estimate, type Estimate } from './estimate.js'
import type { Fuel, Input } from './facts.js'
import type { QuantitiesFor } from './offers.js'
import { mul, point, range } from './range.js'
import { SourceSchema } from './rules-schema.js'

/** A sourced number the engine uses (principle 3). No source → it doesn't exist; the engine shows no dollar figure. */
export const AssumptionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_.]+$/),
  /** Shown to the user as the reason for the number. */
  description: z.string().min(1),
  unit: z.string().min(1),
  value: z
    .strictObject({ low: z.number(), mid: z.number(), high: z.number() })
    .refine(v => v.low <= v.mid && v.mid <= v.high, { message: 'value must satisfy low <= mid <= high' }),
  confidence: z.enum(['low', 'medium', 'high']),
  /** Computed values: the dataset file and the number of samples behind it. */
  dataset: z.url().optional(),
  sampleSize: z.number().int().positive().optional(),
  sources: z.array(SourceSchema).min(1),
})
export const AssumptionsSchema = z.array(AssumptionSchema)
export type Assumption = z.infer<typeof AssumptionSchema>

export const ASSUMPTION_FILES = ['assumptions.json', 'assumptions-resstock.json'] as const

/** Approved assumption files only (same approval ledger as the rules), unless previewing drafts. */
export function loadAssumptions(dir: string, opts: { requireApproval?: boolean; overlayDir?: string } = {}): Assumption[] {
  if (opts.requireApproval ?? true) {
    const problems = approvalProblems(dir)
    if (problems.length > 0) throw new Error(problems.join('\n'))
  }
  return ASSUMPTION_FILES.flatMap(f => {
    const p = opts.overlayDir !== undefined && existsSync(join(opts.overlayDir, f)) ? join(opts.overlayDir, f) : join(dir, f)
    return existsSync(p) ? AssumptionsSchema.parse(JSON.parse(readFileSync(p, 'utf8'))) : []
  })
}

export type VintageBand = 'pre1950' | '1950_1999' | '2000_plus'
export const vintageBand = (yearBuilt: number | null): VintageBand | null =>
  yearBuilt === null ? null : yearBuilt < 1950 ? 'pre1950' : yearBuilt < 2000 ? '1950_1999' : '2000_plus'

const RECORD_UNIT: Partial<Record<Fuel, 'gallons' | 'therms' | 'kwh'>> = {
  oil: 'gallons', propane: 'gallons', natural_gas: 'therms', electric_resistance: 'kwh',
}

type Records = NonNullable<Input['building']['units'][number]['fuelRecords']>

function find(list: readonly Assumption[], id: string): Estimate | null {
  const a = list.find(x => x.id === id)
  if (!a) return null
  const n = a.sampleSize === undefined ? '' : ` (n = ${a.sampleSize})`
  return estimate(range(a.value.low, a.value.mid, a.value.high), a.confidence, `${a.description}${n}`)
}

/**
 * Heat delivered per season from the user's fuel records: season totals (min / mean / max) × heat content × system
 * efficiency. Two or more seasons → medium, one → low (capped by the inputs' confidence). Records in a unit that
 * doesn't fit the fuel, or a fuel without sourced heat content and efficiency, give null.
 */
export function heatLoadFromRecords(records: Records, fuel: Fuel, list: readonly Assumption[]): Estimate | null {
  const unit = RECORD_UNIT[fuel]
  if (unit === undefined || records.length === 0 || records.some(r => r.unit !== unit)) return null
  const heatContent = find(list, `heat_content_mmbtu_per_unit.${fuel}`)
  // Electric resistance turns all electricity into heat, by definition.
  const efficiency = fuel === 'electric_resistance' ? estimate(point(1), 'high', 'electric resistance heat is 100% efficient') : find(list, `heating_efficiency.${fuel}`)
  if (heatContent === null || efficiency === null) return null
  const bySeason = new Map<number, number>()
  for (const r of records) bySeason.set(r.year, (bySeason.get(r.year) ?? 0) + r.quantity)
  const totals = [...bySeason.values()]
  const seasons = totals.length
  const fuelUse = estimate(
    range(Math.min(...totals), totals.reduce((s, x) => s + x, 0) / seasons, Math.max(...totals)),
    seasons >= 2 ? 'medium' : 'low',
    `from your fuel records: ${seasons} heating season${seasons === 1 ? '' : 's'}`,
  )
  return combine(mul(mul(fuelUse.range, heatContent.range), efficiency.range), [fuelUse, heatContent, efficiency],
    'If the same boiler also heats your hot water, these records include it, so the heating need may be overstated.')
}

const RESSTOCK_FUEL: Partial<Record<Fuel, string>> = { oil: 'oil', natural_gas: 'natural_gas', propane: 'propane' }

/** ResStock stock estimate: fuel × vintage group, else the fuel-only group (Task 16b). */
function stock(list: readonly Assumption[], quantity: string, fuel: Fuel | null, band: VintageBand | null): Estimate | null {
  const f = fuel === null ? undefined : RESSTOCK_FUEL[fuel]
  if (f === undefined) return null
  return (band === null ? null : find(list, `${quantity}.${f}.${band}`)) ?? find(list, `${quantity}.${f}`)
}

/**
 * Quantities per unit, from the most specific source: the user's records, then a contractor's quote, then ResStock.
 * Measures with no sourced cost (weatherization, solar) stay missing, so the report shows a percentage only.
 */
export function quantitiesFor(input: Input, list: readonly Assumption[]): QuantitiesFor {
  const band = vintageBand(input.building.yearBuilt)
  const costPerTon = find(list, 'heat_pump_cost_per_ton')
  return unitId => {
    const u = input.building.units.find(x => x.id === unitId)
    if (u === undefined) return { cost: {}, heatPumpTons: null, solarKwhPerYear: null, communitySolarCreditsPerYear: null, heatLoadMMBtu: null }
    const fromRecords = u.fuelRecords !== null && u.heatingFuel !== null ? heatLoadFromRecords(u.fuelRecords, u.heatingFuel, list) : null
    const tons = u.heatPumpTonsQuoted !== null
      ? estimate(point(u.heatPumpTonsQuoted), 'medium', "from the contractor's quote")
      : stock(list, 'heat_pump_tons', u.heatingFuel, band)
    const cost: Quantities['cost'] = {}
    if (tons && costPerTon) cost.heat_pump = combine(mul(tons.range, costPerTon.range), [tons, costPerTon])
    return {
      cost,
      heatPumpTons: tons,
      solarKwhPerYear: null,
      communitySolarCreditsPerYear: null,
      heatLoadMMBtu: fromRecords ?? stock(list, 'annual_heat_load_mmbtu', u.heatingFuel, band),
    }
  }
}
