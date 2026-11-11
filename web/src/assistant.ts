import { blankState, setPath, type State } from './form.js'
import { isMassachusettsTown } from '../../engine/src/scope.js'
import type { Report } from '../../engine/src/energy.js'
import { MEASURE, usd } from './format.js'

export interface Extracted {
  role: 'tenant' | 'renting_landlord' | 'owner_occupant_landlord' | 'condo_owner' | null
  town: string | null
  units: 2 | 3 | 4 | null
  fuel: 'oil' | 'natural_gas' | 'propane' | 'electric_resistance' | 'heat_pump' | 'other' | null
  heatPayer: 'owner' | 'tenant' | null
  electricPayer: 'owner' | 'tenant' | null
  electricUtility: 'eversource' | 'national_grid' | 'unitil' | 'cape_light_compact' | 'municipal' | null
}
export type Presentation = { focus: 'cost' | 'coordination'; tone: 'warm' | 'direct' }

export function missing(f: Extracted): string[] {
  return [!f.role && 'your role', (!f.town || !isMassachusettsTown(f.town)) && 'a Massachusetts city or town (check the spelling)', !f.units && 'number of homes (2–4)'].filter((v): v is string => Boolean(v))
}

export function reviewFacts(f: Extracted): [string, string][] {
  const roles: Record<NonNullable<Extracted['role']>, string> = {
    tenant: 'A tenant', renting_landlord: 'A landlord who lives elsewhere',
    owner_occupant_landlord: 'A landlord who lives in the building', condo_owner: 'A condo owner',
  }
  const fuels: Record<NonNullable<Extracted['fuel']>, string> = {
    oil: 'Heating oil', natural_gas: 'Natural gas', propane: 'Propane', electric_resistance: 'Electric baseboard',
    heat_pump: 'Heat pump', other: 'Other',
  }
  const utilities: Record<NonNullable<Extracted['electricUtility']>, string> = {
    eversource: 'Eversource', national_grid: 'National Grid', unitil: 'Unitil',
    cape_light_compact: 'Cape Light Compact', municipal: 'Municipal light plant',
  }
  const payer = (p: Extracted['heatPayer']): string => p === 'owner' ? 'Landlord / owner' : p === 'tenant' ? 'Tenant' : 'Not sure yet'
  return [
    ['You are', f.role ? roles[f.role] : 'Not sure yet'],
    ['City or town', f.town ?? 'Not sure yet'],
    ['Homes in the building', f.units === null ? 'Not sure yet' : String(f.units)],
    ['Heating on every floor', f.fuel ? fuels[f.fuel] : 'Not sure yet'],
    ['Who pays for heat on every floor', payer(f.heatPayer)],
    ['Who pays for electricity on every floor', payer(f.electricPayer)],
    ['Electric company', f.electricUtility ? utilities[f.electricUtility] : 'Not sure yet'],
  ]
}

// Called only after explicit confirmation; facts not supplied by the user remain unknown.
export function confirmedState(f: Extracted): State {
  if (missing(f).length || !f.role || !f.town || !f.units) throw new Error('Required facts are missing')
  const s = blankState()
  s.input.building.ownership = null
  s.input.userUnitId = null
  setPath(s, 'unitCount', 'enum', String(f.units))
  for (const unit of s.input.building.units) unit.occupancy = null
  s.input.role = f.role
  s.input.building.municipality = f.town
  s.input.building.electricUtility = f.electricUtility
  for (const unit of s.input.building.units) {
    unit.heatingFuel = f.fuel
    unit.heatPaidBy = f.heatPayer
    unit.electricPaidBy = f.electricPayer
  }
  return s
}

export function confirmReplacement(f: Extracted, confirm: (message: string) => boolean): State | null {
  return confirm('This replaces the current building and any details you entered, including bills. Continue?') ? confirmedState(f) : null
}

export function renderAnswer(r: Report, role: State['input']['role'], p: Presentation, demo: boolean, waterNotEstimated = false): string {
  const landlord = role === 'renting_landlord' || role === 'owner_occupant_landlord'
  const range = landlord ? r.buildingChange : null
  const signed = (value: number) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${usd(value)}`
  const cost = range
    ? `The estimated yearly change in the building’s heating and any estimated hot-water costs is ${signed(range.range.low)} to ${signed(range.range.high)} (positive means higher cost). Confidence: ${range.confidence}.${waterNotEstimated ? ' The hot-water change is not included where it could not be estimated.' : ''}`
    : 'The information available does not give a whole-building estimate for this view. Check the report for details and missing information.'
  const first = r.navigation.steps[0]
  const next = first ? `The plan starts with ${first.measure === 'financing' ? 'financing' : (MEASURE[first.measure] ?? 'the first step').toLowerCase()}. Check its details in the report.` : 'Check the report for next steps and unanswered questions.'
  const coordination = 'Discuss who pays each bill and how any change would affect the people living in the building. Confirm program details with the program before making a decision.'
  const greeting = p.tone === 'warm' ? 'Hello, I hope you are doing well.' : 'Hello,'
  const audience = role === 'tenant' ? 'I would like to discuss the heating options for our building.' : 'I would like to discuss heating options and how they may affect the building.'
  return `${demo ? 'This uses fictional demo data.\n\n' : ''}${p.focus === 'cost' ? `${cost}\n\n${coordination}` : `${coordination}\n\n${cost}`}\n\n${next}\n\nDraft message — review before sending\n\n${greeting}\n\n${audience} ${cost} Could we discuss the options and any effect on household bills before deciding?\n\nThank you.`
}
