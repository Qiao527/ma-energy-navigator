import { combine, estimate, type Estimate } from './estimate.js'
import type { Fuel, Payer } from './facts.js'
import { simplePaybackYears, splitByPayer, type SwitchEstimates } from './finance.js'
import { add, capAt, div, floorAt, mul, point, range, sub, sum, type Range } from './range.js'

export interface UnitProject {
  unitId: string
  heatingFuel: Fuel
  heatPaidBy: Payer | null
  electricPaidBy: Payer | null
  /** Bill changes for this unit; null when the project doesn't change its heating. */
  bills: SwitchEstimates | null
}

export interface RentCommitment {
  /** Length of the no-rent-increase period in months; null = not published (research §3 / data-sources §5). */
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
}

export interface LandlordView {
  /** Annual change on the landlord's own unit. */
  ownUnit: Estimate | null
  /** Rental units: annual change for the landlord and for the tenant. */
  rentals: { unitId: string; landlord: Estimate | null; tenant: Estimate | null; unknownPayer: boolean }[]
  /** Own unit plus rental bills the landlord pays. */
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
  commitmentCost: { cost: Estimate | null; reason: string | null }
  /** (net upfront + commitment cost) / landlord's annual savings. Null when the landlord doesn't save for sure. */
  paybackYears: Estimate | null
  paybackExcludesCommitment: boolean
}

const negate = (r: Range): Range => range(-r.high, -r.mid, -r.low)

function sumEstimates(es: Estimate[]): Estimate | null {
  return es.length === 0 ? null : combine(sum(es.map(x => x.range)), es)
}

function commitment(c: RentCommitment | null): { cost: Estimate | null; reason: string | null } {
  if (c === null) return { cost: estimate(point(0), 'high', 'No no-rent-increase commitment applies'), reason: null }
  if (c.months === null) return { cost: null, reason: 'The length of the no-rent-increase period is not published.' }
  if (c.forgoneIncreasePerUnitMonth === null) return { cost: null, reason: 'Enter the rent increase you would otherwise have made.' }
  const perUnit = mul(c.months.range, c.forgoneIncreasePerUnitMonth.range)
  return { cost: combine(range(perUnit.low * c.rentedUnits, perUnit.mid * c.rentedUnits, perUnit.high * c.rentedUnits), [c.months, c.forgoneIncreasePerUnitMonth]), reason: null }
}

export function landlordView(a: LandlordInput): LandlordView {
  let ownUnit: Estimate | null = null
  let incomplete = false
  const landlordParts: Estimate[] = []
  const rentals: LandlordView['rentals'] = []
  for (const u of a.units) {
    if (u.bills === null) continue
    const split = splitByPayer(u.bills, { heatingFuel: u.heatingFuel, heatPaidBy: u.heatPaidBy, electricPaidBy: u.electricPaidBy, upfrontNet: null })
    if (split.unallocated.length > 0) incomplete = true
    if (split.owner.annual !== null) landlordParts.push(split.owner.annual)
    if (u.unitId === a.ownUnitId) ownUnit = split.owner.annual
    else rentals.push({ unitId: u.unitId, landlord: split.owner.annual, tenant: split.tenant.annual, unknownPayer: split.unallocated.length > 0 })
  }
  const landlordAnnual = sumEstimates(landlordParts)

  const known = a.incentives.flatMap(i => (i.value === null ? [] : [i.value]))
  const incentivesKnown = sumEstimates(known)
  const netUpfront = incentivesKnown
    ? combine(floorAt(sub(a.projectCost.range, incentivesKnown.range), 0), [a.projectCost, incentivesKnown])
    : a.projectCost
  const coverage = incentivesKnown && a.projectCost.range.low > 0
    ? combine(capAt(div(incentivesKnown.range, a.projectCost.range), 1), [incentivesKnown, a.projectCost])
    : null

  const commitmentCost = commitment(a.rentCommitment)
  const paybackExcludesCommitment = commitmentCost.cost === null
  const upfrontWithCommitment = commitmentCost.cost
    ? combine(add(netUpfront.range, commitmentCost.cost.range), [netUpfront, commitmentCost.cost])
    : netUpfront
  const paybackYears = landlordAnnual
    ? simplePaybackYears(upfrontWithCommitment, combine(negate(landlordAnnual.range), [landlordAnnual]))
    : null

  return {
    ownUnit,
    rentals,
    landlordAnnual,
    landlordAnnualIncomplete: incomplete,
    tenantsPayingMore: rentals.filter(r => r.tenant !== null && r.tenant.range.high > 0).map(r => r.unitId),
    incentivesKnown,
    incentivesWithoutAmount: a.incentives.filter(i => i.value === null).map(i => i.offerId),
    coverage,
    netUpfront,
    commitmentCost,
    paybackYears,
    paybackExcludesCommitment,
  }
}
