import towns from '../../data/ma-towns.json' with { type: 'json' }
import type { Condition } from './condition.js'
import type { Input, Unit } from './facts.js'

export type Scalar = string | number | boolean

/** One Designated Equity Community (data-sources §5). */
export interface DecEntry {
  name: string
  /** Program administrators that limit the DEC offer to EJ block groups in this municipality. */
  narrowedFor: string[]
}

/** A sourced, reusable definition. A working assumption is used only for hints, never for conclusions. */
export interface NamedPredicate {
  condition: Condition
  workingAssumption: boolean
}

export interface Derived {
  isDec: boolean | null
  renterShare: number | null
  unitCount: number
}

/** Everything a condition can see. `unit` is the subject unit (null when there is none). */
export interface Scope {
  input: Input
  unit: Unit | null
  derived: Derived
  /** Income limit by household size (index = size − 1), keyed by table id. */
  incomeTables: Readonly<Record<string, readonly number[]>>
  /** Named predicates from rules data, keyed by id. */
  predicates: Readonly<Record<string, NamedPredicate>>
  /** The heat pump work is done: an install date on or before today (Qiao, 2026-11-07). Absent = still planning. */
  installed?: boolean
}

/** The closed list of facts rules may use. Renaming one is a breaking change (schema §1). */
export const FACT_PATHS = [
  'user.role',
  'unit.occupancy',
  'unit.heatingFuel',
  'unit.heatPaidBy',
  'unit.electricPaidBy',
  'unit.hasResidentialHeatingMeter',
  'unit.participating',
  'unit.occupiedAllWinter',
  'building.ownership',
  'building.yearBuilt',
  'building.unitCount',
  'building.electricUtility',
  'building.gasUtility',
  'building.electricIsMunicipal',
  'building.isDec',
  'building.renterShare',
  'building.weatherizationRecsDone',
  'building.heaCompleted',
  'building.ownerApproval',
  'user.householdSize',
  'user.onDiscountRate',
  'project.installed',
] as const

export const townKey = (name: string): string => name.trim().toLowerCase().replace(/ town$/, '')
const maTowns = new Set(towns.towns.map(town => townKey(town.name)))
export const isMassachusettsTown = (name: string): boolean => maTowns.has(townKey(name))

export function derive(input: Input, dec: readonly DecEntry[]): Derived {
  const b = input.building
  const town = townKey(b.municipality)
  const entry = dec.find(d => townKey(d.name) === town)
  let isDec: boolean | null = isMassachusettsTown(b.municipality) ? false : null
  if (entry !== undefined) {
    const utilities = [b.electricUtility, b.gasUtility]
    if (entry.narrowedFor.length > 0 && utilities.includes(null)) isDec = null
    else if (utilities.some(u => u !== null && entry.narrowedFor.includes(u))) isDec = b.inEjBlockGroup
    else isDec = true
  }
  const occupancies = b.units.map(u => u.occupancy)
  const renterShare = occupancies.includes(null)
    ? null
    : occupancies.filter(o => o === 'renter').length / occupancies.length
  return { isDec, renterShare, unitCount: b.units.length }
}

export function getFact(s: Scope, path: string): Scalar | null {
  const b = s.input.building
  switch (path) {
    case 'user.role': return s.input.role
    case 'unit.occupancy': return s.unit?.occupancy ?? null
    case 'unit.heatingFuel': return s.unit?.heatingFuel ?? null
    case 'unit.heatPaidBy': return s.unit?.heatPaidBy ?? null
    case 'unit.electricPaidBy': return s.unit?.electricPaidBy ?? null
    case 'unit.hasResidentialHeatingMeter': return s.unit?.hasResidentialHeatingMeter ?? null
    case 'unit.participating': return s.unit?.participating ?? null
    case 'unit.occupiedAllWinter': return s.unit?.occupiedAllWinter ?? null
    case 'building.ownership': return b.ownership
    case 'building.yearBuilt': return b.yearBuilt
    case 'building.unitCount': return s.derived.unitCount
    case 'building.electricUtility': return b.electricUtility
    case 'building.gasUtility': return b.gasUtility
    case 'building.electricIsMunicipal': return b.electricUtility === null ? null : b.electricUtility === 'municipal'
    case 'building.isDec': return s.derived.isDec
    case 'building.renterShare': return s.derived.renterShare
    case 'building.weatherizationRecsDone': return b.weatherizationRecsDone
    case 'building.heaCompleted': return b.heaCompleted
    case 'building.ownerApproval': return b.ownerApproval
    case 'user.householdSize': return s.input.household.size
    case 'user.onDiscountRate': return s.input.household.onDiscountRate
    case 'project.installed': return s.installed ?? false
    default: throw new Error(`unknown fact path: ${path}`)
  }
}
