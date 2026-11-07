import { combine, estimate, type Estimate } from './estimate.js'
import type { Fuel, Payer } from './facts.js'
import { simplePaybackYears, splitByPayer, type SwitchEstimates } from './finance.js'
import { add, capAt, div, floorAt, mul, point, range, scale, sub, sum, type Range } from './range.js'

export interface UnitProject {
  unitId: string
  heatingFuel: Fuel
  heatPaidBy: Payer | null
  electricPaidBy: Payer | null
  /** Bill changes for this unit; null when the project doesn't change its heating. */
  bills: SwitchEstimates | null
  /** Who pays the meter the heat pump runs on. Defaults to electricPaidBy (the unit's own meter). */
  heatPumpMeterPaidBy?: Payer | null
}

/** "Project commitment terms" in the UI (Qiao, 2026-11-06): the no-rent-increase commitment some offers require. */
export interface RentCommitment {
  /** Length of the commitment period in months; null = not published (data-sources §5). */
  months: Estimate | null
  /** The monthly rent increase per rented unit the landlord would otherwise have made: the landlord's own input. */
  forgoneIncreasePerUnitMonth: Estimate | null
  rentedUnits: number
}

export interface LandlordInput {
  /** The landlord's own unit (owner-occupant); null for a landlord who doesn't live there. */
  ownUnitId: string | null
  units: UnitProject[]
  projectCost: Estimate
  /** Incentives paid to the property owner for this project; value null = no dollar amount available. */
  incentives: { offerId: string; value: Estimate | null }[]
  /** null = no commitment applies. */
  rentCommitment: RentCommitment | null
  /**
   * Comparison baseline: "the boiler needs replacing anyway". The cost of the replacement the landlord would
   * have paid regardless; subtracted from the upfront cost for payback. null = not chosen.
   */
  avoidedReplacementCost: Estimate | null
}

/** 105 CMR 410.200 / 410.210: the owner pays for heat unless a separate meter or tank AND a written rental agreement say otherwise. */
export const HEAT_COST_SHIFT_CONSTRAINT = 'ma_105_cmr_410_written_rental_agreement' as const

export interface ShiftedCost {
  unitId: string
  /** Heating cost that moves onto the tenant's electric bill (positive = tenant pays more). */
  annual: Estimate
  /** The same per month: the size of a fair rent reduction or electricity allowance. */
  monthly: Estimate
  /** The landlord can't do this unilaterally (research §18). */
  constraint: typeof HEAT_COST_SHIFT_CONSTRAINT
  /**
   * Fair ways to handle it; UI copy explains each (Qiao, 2026-11-06). negotiate_at_lease_renewal means agreeing
   * in writing at renewal or a new lease, with the electricity change explained openly — never a disguised shift.
   */
  fairOptions: ('lower_rent' | 'electricity_allowance' | 'owner_paid_meter' | 'negotiate_at_lease_renewal')[]
}

export interface LandlordView {
  /** Annual change on the landlord's own unit. */
  ownUnit: Estimate | null
  /**
   * Real energy savings on the heating the landlord paid for before: the net change across both bills
   * (fuel saved minus the new electricity), whoever ends up paying the electricity. Negative = saves.
   */
  realSavings: Estimate | null
  /** Heating cost that would move onto tenants' electric bills (Qiao, 2026-11-06: show it, with fair options). */
  shiftedToTenants: ShiftedCost[]
  shiftedTotal: Estimate | null
  /** Rental units: annual change for the landlord and for the tenant. */
  rentals: { unitId: string; landlord: Estimate | null; tenant: Estimate | null; unknownPayer: boolean }[]
  /** Own unit plus rental bills the landlord pays = realSavings + shiftedTotal (mid). Only fair with tenant agreement. */
  landlordAnnual: Estimate | null
  /** True when some bill's payer is unknown, so the total leaves it out. */
  landlordAnnualIncomplete: boolean
  /** Rental units whose tenant may pay more (the high end of their change is above zero). */
  tenantsPayingMore: string[]
  incentivesKnown: Estimate | null
  incentivesWithoutAmount: string[]
  /** Share of the project cost covered by known incentives, 0–1. */
  coverage: Estimate | null
  netUpfront: Estimate
  /** UI label: "project commitment terms". */
  projectCommitment: { cost: Estimate | null; reason: string | null }
  /**
   * Payback on REAL savings: (net upfront + commitment − avoided replacement) / −realSavings.
   * Null when the landlord doesn't save for sure.
   */
  paybackYears: Estimate | null
  /**
   * COMPARISON ONLY. Payback if the shifted cost were left on tenants: only possible with a written rental
   * agreement. Never shown in a recommendation slot (Qiao, 2026-11-06); always shown with the 105 CMR 410 note.
   */
  paybackIfCostShifted: Estimate | null
  paybackExcludesCommitment: boolean
  /** True when the "boiler needs replacing anyway" baseline was used. */
  usesReplacementBaseline: boolean
}

const negate = (r: Range): Range => range(-r.high, -r.mid, -r.low)

function sumEstimates(es: Estimate[]): Estimate | null {
  return es.length === 0 ? null : combine(sum(es.map(x => x.range)), es)
}

function commitment(c: RentCommitment | null): { cost: Estimate | null; reason: string | null } {
  if (c === null) return { cost: estimate(point(0), 'high', 'No project commitment applies'), reason: null }
  if (c.months === null) return { cost: null, reason: 'The length of the project commitment period is not published.' }
  if (c.forgoneIncreasePerUnitMonth === null) return { cost: null, reason: 'Enter the rent increase you would otherwise have made.' }
  const perUnit = mul(c.months.range, c.forgoneIncreasePerUnitMonth.range)
  return { cost: combine(range(perUnit.low * c.rentedUnits, perUnit.mid * c.rentedUnits, perUnit.high * c.rentedUnits), [c.months, c.forgoneIncreasePerUnitMonth]), reason: null }
}

export function landlordView(a: LandlordInput): LandlordView {
  let ownUnit: Estimate | null = null
  let incomplete = false
  const landlordParts: Estimate[] = []
  const realParts: Estimate[] = []
  const shifted: ShiftedCost[] = []
  const rentals: LandlordView['rentals'] = []
  for (const u of a.units) {
    if (u.bills === null) continue
    const meterPayer = u.heatPumpMeterPaidBy === undefined ? u.electricPaidBy : u.heatPumpMeterPaidBy
    const split = splitByPayer(u.bills, { heatingFuel: u.heatingFuel, heatPaidBy: u.heatPaidBy, electricPaidBy: meterPayer, upfrontNet: null })
    if (split.unallocated.length > 0) incomplete = true
    if (split.owner.annual !== null) landlordParts.push(split.owner.annual)
    if (u.heatPaidBy === 'owner') realParts.push(u.bills.net)
    if (u.heatPaidBy === 'owner' && u.heatingFuel !== 'electric_resistance' && meterPayer === 'tenant') {
      const annual = u.bills.electricBill
      shifted.push({
        unitId: u.unitId,
        annual,
        monthly: combine(scale(annual.range, 1 / 12), [annual]),
        constraint: HEAT_COST_SHIFT_CONSTRAINT,
        fairOptions: ['lower_rent', 'electricity_allowance', 'owner_paid_meter', 'negotiate_at_lease_renewal'],
      })
    }
    if (u.unitId === a.ownUnitId) ownUnit = split.owner.annual
    else rentals.push({ unitId: u.unitId, landlord: split.owner.annual, tenant: split.tenant.annual, unknownPayer: split.unallocated.length > 0 })
  }
  const landlordAnnual = sumEstimates(landlordParts)
  const realSavings = sumEstimates(realParts)
  const shiftedTotal = sumEstimates(shifted.map(s => s.annual))

  const known = a.incentives.flatMap(i => (i.value === null ? [] : [i.value]))
  const incentivesKnown = sumEstimates(known)
  const netUpfront = incentivesKnown
    ? combine(floorAt(sub(a.projectCost.range, incentivesKnown.range), 0), [a.projectCost, incentivesKnown])
    : a.projectCost
  const coverage = incentivesKnown && a.projectCost.range.low > 0
    ? combine(capAt(div(incentivesKnown.range, a.projectCost.range), 1), [incentivesKnown, a.projectCost])
    : null

  const projectCommitment = commitment(a.rentCommitment)
  const withCommitment = projectCommitment.cost
    ? combine(add(netUpfront.range, projectCommitment.cost.range), [netUpfront, projectCommitment.cost])
    : netUpfront
  const paybackCost = a.avoidedReplacementCost
    ? combine(floorAt(sub(withCommitment.range, a.avoidedReplacementCost.range), 0), [withCommitment, a.avoidedReplacementCost])
    : withCommitment
  const payback = (annual: Estimate | null): Estimate | null =>
    annual ? simplePaybackYears(paybackCost, combine(negate(annual.range), [annual])) : null

  return {
    ownUnit,
    realSavings,
    shiftedToTenants: shifted,
    shiftedTotal,
    rentals,
    landlordAnnual,
    landlordAnnualIncomplete: incomplete,
    tenantsPayingMore: rentals.filter(r => r.tenant !== null && r.tenant.range.high > 0).map(r => r.unitId),
    incentivesKnown,
    incentivesWithoutAmount: a.incentives.filter(i => i.value === null).map(i => i.offerId),
    coverage,
    netUpfront,
    projectCommitment,
    paybackYears: payback(realSavings),
    paybackIfCostShifted: shifted.length > 0 ? payback(landlordAnnual) : null,
    paybackExcludesCommitment: projectCommitment.cost === null,
    usesReplacementBaseline: a.avoidedReplacementCost !== null,
  }
}
