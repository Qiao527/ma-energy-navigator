import { combine, type Estimate } from './estimate.js'
import type { Fuel, Payer } from './facts.js'
import { complement, div, floorAt, mul, mulAny, range, scale, sub, type Range } from './range.js'

export const KWH_PER_MMBTU = 293.07107

const negate = (r: Range): Range => range(-r.high, -r.mid, -r.low)

/** Annual bill changes from replacing a fuel system with a heat pump. Positive = pays more. */
export interface SwitchEstimates {
  /** Change on the heating fuel bill (oil, propane, gas): negative. */
  fuelBill: Estimate
  /** Change on the electric bill: positive. */
  electricBill: Estimate
  /** fuelBill + electricBill, computed per MMBtu so the load's spread isn't counted twice. */
  net: Estimate
}

export function heatPumpSwitch(a: {
  load: Estimate
  fuelEfficiency: Estimate
  fuelPricePerMMBtu: Estimate
  seasonalCop: Estimate
  electricityPricePerKwh: Estimate
}): SwitchEstimates {
  const inputs = [a.load, a.fuelEfficiency, a.fuelPricePerMMBtu, a.seasonalCop, a.electricityPricePerKwh]
  const hpPerMMBtu = div(scale(a.electricityPricePerKwh.range, KWH_PER_MMBTU), a.seasonalCop.range)
  const fuelPerMMBtu = div(a.fuelPricePerMMBtu.range, a.fuelEfficiency.range)
  return {
    fuelBill: combine(negate(mul(a.load.range, fuelPerMMBtu)), inputs),
    electricBill: combine(mul(a.load.range, hpPerMMBtu), inputs),
    net: combine(mulAny(a.load.range, sub(hpPerMMBtu, fuelPerMMBtu)), inputs),
  }
}

export interface Party {
  /** Annual bill change for this person. Positive = pays more. */
  annual: Estimate | null
  /** Net upfront cost after incentives (owner only). */
  upfront: Estimate | null
}

export interface PayerSplit {
  owner: Party
  tenant: Party
  /** Bill changes whose payer is unknown: shown as "we don't know who pays this bill". */
  unallocated: { bill: 'heating_fuel' | 'electricity' | 'both'; change: Estimate }[]
}

/**
 * Who saves and who may pay more (schema §7). The fuel bill goes to whoever pays heat and the electric
 * bill to whoever pays electricity. When one person pays both, they get the net. Unknown payer → unallocated.
 */
export function splitByPayer(
  sw: SwitchEstimates,
  a: { heatingFuel: Fuel; heatPaidBy: Payer | null; electricPaidBy: Payer | null; upfrontNet: Estimate | null },
): PayerSplit {
  const split: PayerSplit = { owner: { annual: null, upfront: a.upfrontNet }, tenant: { annual: null, upfront: null }, unallocated: [] }
  const give = (payer: Payer | null, bill: 'heating_fuel' | 'electricity' | 'both', change: Estimate): void => {
    if (payer === null) split.unallocated.push({ bill, change })
    else split[payer].annual = change
  }
  if (a.heatingFuel === 'electric_resistance') give(a.electricPaidBy, 'both', sw.net)
  else if (a.heatPaidBy !== null && a.heatPaidBy === a.electricPaidBy) give(a.heatPaidBy, 'both', sw.net)
  else {
    give(a.heatPaidBy, 'heating_fuel', sw.fuelBill)
    give(a.electricPaidBy, 'electricity', sw.electricBill)
  }
  return split
}

/** Heat load after weatherization removes a fraction of it. */
export const weatherizedLoad = (load: Estimate, reductionFraction: Estimate): Estimate =>
  combine(mul(load.range, complement(reductionFraction.range)), [load, reductionFraction])

/** Years to recover the net cost. Null when savings might be zero or negative (no honest payback). */
export function simplePaybackYears(netCost: Estimate, annualSavings: Estimate): Estimate | null {
  if (annualSavings.range.low <= 0) return null
  return combine(div(floorAt(netCost.range, 0), annualSavings.range), [netCost, annualSavings])
}

/** Splits annual rooftop credits by Schedule Z shares (research §12). The remainder stays with the host account. */
export function splitCredits(annualCredits: Estimate, shares: Readonly<Record<string, number>>): Record<string, Estimate> {
  const total = Object.values(shares).reduce((s, x) => s + x, 0)
  if (total > 1 + 1e-9 || Object.values(shares).some(x => x < 0)) throw new RangeError('Schedule Z shares must be non-negative and total at most 100%')
  const out: Record<string, Estimate> = {}
  for (const [unitId, share] of Object.entries(shares)) out[unitId] = combine(scale(annualCredits.range, share), [annualCredits])
  out.host = combine(scale(annualCredits.range, Math.max(0, 1 - total)), [annualCredits])
  return out
}
