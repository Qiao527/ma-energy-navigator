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
