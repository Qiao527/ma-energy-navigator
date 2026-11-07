import type { Input, Unit } from '../src/facts.js'
import { derive, type Scope } from '../src/scope.js'

export function unit(id: string, over: Partial<Unit> = {}): Unit {
  return {
    id,
    occupancy: null,
    heatingFuel: null,
    heatPaidBy: null,
    electricPaidBy: null,
    hasResidentialHeatingMeter: null,
    participating: null,
    occupiedAllWinter: null,
    ...over,
  }
}

export interface InputOverrides {
  role?: Input['role']
  userUnitId?: string | null
  building?: Partial<Input['building']>
  household?: Partial<Input['household']>
}

export function input(over: InputOverrides = {}): Input {
  return {
    role: over.role ?? 'tenant',
    userUnitId: over.userUnitId === undefined ? null : over.userUnitId,
    building: {
      municipality: 'Boston',
      ownership: null,
      yearBuilt: null,
      electricUtility: null,
      gasUtility: null,
      inEjBlockGroup: null,
      weatherizationRecsDone: null,
      heaCompleted: null,
      ownerApproval: null,
      units: [unit('1')],
      ...over.building,
    },
    household: { size: null, incomeBand: null, onDiscountRate: null, ...over.household },
  }
}

/** A scope over `i` with no DEC list, no income tables and no predicates unless overridden. */
export function scope(i: Input, over: Partial<Scope> = {}): Scope {
  return { input: i, unit: i.building.units[0] ?? null, derived: derive(i, []), incomeTables: {}, predicates: {}, ...over }
}

export const SOURCE = {
  url: 'https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties',
  section: 'Landlord offer',
  quote: 'An instant incentive of 100% off insulation upgrades for your rental property',
  lastVerified: '2026-11-06',
}

export const OFFER = {
  id: 'test_offer',
  version: '1',
  programId: 'masssave_weatherization',
  title: 'Test',
  measure: 'weatherization',
  appliesTo: 'each_unit',
  dateBasis: 'as_of',
  effective: { from: '2026-01-01', until: null },
  applicationDeadline: null,
  eligibility: { fact: 'unit.occupancy', op: 'eq', value: 'renter' },
  prerequisites: [],
  confirmations: [],
  benefit: { type: 'percent_of_cost', pct: 100, costOf: 'weatherization' },
  qualification: 'up_to',
  recipient: 'property_owner',
  enrollment: 'via_landlord',
  exclusiveGroup: 'insulation',
  capGroups: [],
  sources: [SOURCE],
}
