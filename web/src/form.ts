import { InputSchema, type Input, type Unit } from '../../engine/src/facts.js'
import { esc, FLOOR } from './format.js'
import { STORY1 } from './demo.js'

export const SEASONS = [2024, 2025] as const

export interface State {
  input: Input
  installDate: string
  boilerNeedsReplacing: boolean
  /** True while the numbers are Story 1's fictional demo data. */
  demo: boolean
}

const blankUnit = (id: string, occupancy: Unit['occupancy']): Unit => ({
  id, occupancy, heatingFuel: null, heatPaidBy: null, electricPaidBy: null, hasResidentialHeatingMeter: null,
  participating: null, occupiedAllWinter: null, fuelRecords: null, heatPumpTonsQuoted: null, hotWaterFromBoiler: null, hotWaterAfter: null,
})

export function demoState(): State {
  return { input: InputSchema.parse(structuredClone(STORY1.input)), installDate: '', boilerNeedsReplacing: false, demo: STORY1.demoData }
}

export function blankState(): State {
  return {
    input: {
      role: 'owner_occupant_landlord', userUnitId: '1',
      building: {
        municipality: '', ownership: 'single_owner', yearBuilt: null, electricUtility: null, gasUtility: null, inEjBlockGroup: null,
        weatherizationRecsDone: null, heaCompleted: null, ownerApproval: null,
        units: [blankUnit('1', 'owner'), blankUnit('2', 'renter'), blankUnit('3', 'renter')],
      },
      household: { size: null, incomeBand: null, onDiscountRate: null },
    },
    installDate: '', boilerNeedsReplacing: false, demo: false,
  }
}

export const today = (): string => new Date().toLocaleDateString('en-CA')


export type Kind = 'text' | 'int' | 'num' | 'tri' | 'enum' | 'band'
const opt = (pairs: [string, string][], value: string | null): string =>
  pairs.map(([v, l]) => `<option value="${v}"${(value ?? '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')
function select(id: string, path: string, label: string, pairs: [string, string][], value: string | null, kind: Kind = 'enum', structural = false): string {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-path="${path}" data-kind="${kind}"${structural ? ' data-structural' : ''}>${opt([['', 'Not sure'], ...pairs], value)}</select></div>`
}
const triVal = (b: boolean | null): string | null => (b === null ? null : b ? 'yes' : 'no')
const YES_NO: [string, string][] = [['yes', 'Yes'], ['no', 'No']]
function numberField(id: string, path: string, label: string, value: number | null, unit: string, kind: Kind = 'num', hint = ''): string {
  return `<div class="field"><label for="${id}">${label}</label><div class="with-unit"><input id="${id}" data-path="${path}" data-kind="${kind}" type="number" inputmode="decimal" min="0" step="any" value="${value ?? ''}"${hint ? ` aria-describedby="${id}-hint"` : ''}><span>${unit}</span></div>${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}</div>`
}

/** Income bands, in dollars a year; the value is "low-high". The top band is open-ended in practice (high = low × 2). */
const INCOME: [string, string][] = [
  ['0-30000', 'Under $30,000'], ['30000-50000', '$30,000–50,000'], ['50000-75000', '$50,000–75,000'], ['75000-100000', '$75,000–100,000'],
  ['100000-150000', '$100,000–150,000'], ['150000-200000', '$150,000–200,000'], ['200000-400000', '$200,000 or more'],
]
const FUELS: [string, string][] = [['oil', 'Heating oil'], ['natural_gas', 'Natural gas'], ['propane', 'Propane'], ['electric_resistance', 'Electric baseboard'], ['heat_pump', 'Heat pump already'], ['other', 'Other']]
const RECORD_UNIT: Record<string, 'gallons' | 'therms' | 'kwh'> = { oil: 'gallons', propane: 'gallons', natural_gas: 'therms', electric_resistance: 'kwh' }

function unitForm(u: Unit, i: number, condo: boolean): string {
  const p = `building.units.${i}`
  const id = `u${u.id}`
  const recUnit = u.heatingFuel ? RECORD_UNIT[u.heatingFuel] : undefined
  const season = (y: number) => u.fuelRecords?.filter(r => r.year === y).reduce((s, r) => s + r.quantity, 0) ?? null
  const records = recUnit
    ? `<fieldset class="sub"><legend>Fuel used, from delivery records or bills</legend><div class="grid2">${SEASONS.map(y =>
        numberField(`${id}-rec${y}`, `${p}.records.${y}`, `Winter ${y}–${String(y + 1).slice(2)}`, season(y), recUnit)).join('')}</div>
        <p class="hint">Add up every delivery or bill from July to June. Two winters make the estimate firmer. Leave it blank and the page uses typical Massachusetts homes.</p></fieldset>`
    : ''
  const burns = u.heatingFuel === 'oil' || u.heatingFuel === 'natural_gas' || u.heatingFuel === 'propane' || u.fuelRecords !== null
  const hotWater = burns
    ? `<div class="grid2">${select(`${id}-hw`, `${p}.hotWaterFromBoiler`, 'Does the boiler also heat the hot water?', YES_NO, triVal(u.hotWaterFromBoiler), 'tri', true)}${
        u.hotWaterFromBoiler ? select(`${id}-hwa`, `${p}.hotWaterAfter`, 'After the heat pump, hot water comes from', [['boiler', 'The same boiler'], ['electric_resistance', 'An electric water heater'], ['heat_pump_water_heater', 'A heat pump water heater']], u.hotWaterAfter, 'enum', true) : ''}</div>`
    : ''
  return `<fieldset class="unit"><legend>${FLOOR(u.id)}</legend>
    <div class="grid2">
      ${select(`${id}-occ`, `${p}.occupancy`, 'Who lives here', [['owner', 'The owner'], ['renter', 'A renter']], u.occupancy, 'enum', true)}
      ${select(`${id}-fuel`, `${p}.heatingFuel`, 'Heating today', FUELS, u.heatingFuel, 'enum', true)}
      ${select(`${id}-heat`, `${p}.heatPaidBy`, 'Who pays for heat', [['owner', 'Landlord / owner'], ['tenant', 'Tenant']], u.heatPaidBy, 'enum', true)}
      ${select(`${id}-elec`, `${p}.electricPaidBy`, 'Who pays electricity', [['owner', 'Landlord / owner'], ['tenant', 'Tenant']], u.electricPaidBy, 'enum', true)}
      ${select(`${id}-winter`, `${p}.occupiedAllWinter`, 'Lived in all winter', YES_NO, triVal(u.occupiedAllWinter), 'tri', true)}
      ${numberField(`${id}-tons`, `${p}.heatPumpTonsQuoted`, 'Heat pump size from a quote', u.heatPumpTonsQuoted, 'tons', 'num', 'Optional. Otherwise sized from similar homes.')}
    </div>${records}${hotWater}${condo ? `<div class="grid2">
      ${select(`${id}-meter`, `${p}.hasResidentialHeatingMeter`, 'Has its own residential heating meter', YES_NO, triVal(u.hasResidentialHeatingMeter), 'tri')}
      ${select(`${id}-join`, `${p}.participating`, 'Takes part in the all-units insulation offer', YES_NO, triVal(u.participating), 'tri')}</div>` : ''}</fieldset>`
}

/** One answer for every floor, when the floors agree. Shows the shared value, or "Mixed" when they differ. */
const SHARED: { field: keyof Unit; label: string; pairs: [string, string][]; kind: Kind }[] = [
  { field: 'heatingFuel', label: 'Heating today', pairs: FUELS, kind: 'enum' },
  { field: 'heatPaidBy', label: 'Who pays for heat', pairs: [['owner', 'Landlord / owner'], ['tenant', 'Tenant']], kind: 'enum' },
  { field: 'electricPaidBy', label: 'Who pays electricity', pairs: [['owner', 'Landlord / owner'], ['tenant', 'Tenant']], kind: 'enum' },
  { field: 'hotWaterFromBoiler', label: 'Does the boiler also heat the hot water?', pairs: YES_NO, kind: 'tri' },
  { field: 'occupiedAllWinter', label: 'Lived in all winter', pairs: YES_NO, kind: 'tri' },
]
function sharedForm(units: Unit[]): string {
  const value = (f: keyof Unit): string | null | 'mixed' => {
    const vs = units.map(u => { const v = u[f]; return typeof v === 'boolean' ? (v ? 'yes' : 'no') : (v as string | null) })
    return vs.every(v => v === vs[0]) ? (vs[0] ?? null) : 'mixed'
  }
  const list = value('hotWaterFromBoiler') === 'yes'
    ? [...SHARED.slice(0, 4), { field: 'hotWaterAfter' as const, label: 'After the heat pump, hot water comes from', pairs: [['boiler', 'The same boiler'], ['electric_resistance', 'An electric water heater'], ['heat_pump_water_heater', 'A heat pump water heater']] as [string, string][], kind: 'enum' as Kind }, ...SHARED.slice(4)]
    : SHARED
  const fields = list.map(({ field, label, pairs, kind }) => {
    const v = value(field)
    const id = `all-${field}`
    const options = v === 'mixed' ? `<option value="" selected disabled>Differs by floor</option>${opt([['', 'Not sure'], ...pairs], '-')}` : opt([['', 'Not sure'], ...pairs], v)
    return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-path="allUnits.${field}" data-kind="${kind}" data-structural>${options}</select></div>`
  }).join('')
  return `<fieldset class="unit shared"><legend>Every floor</legend>
    <p class="hint">Answer once here if it’s the same on every floor. You can still change a single floor below.</p>
    <div class="grid2">${fields}</div></fieldset>`
}

export function formHtml(s: State): string {
  const b = s.input.building
  const h = s.input.household
  const units = b.units.map((u, i) => unitForm(u, i, b.ownership === 'condo')).join('')
  return `
  <div class="form-actions">
    <button type="button" data-action="demo">Load the demo building</button>
    <button type="button" data-action="blank">Clear and enter my building</button>
  </div>
  ${s.demo ? `<p class="demo-note"><strong>Example data.</strong> This form may still contain made-up details. Choose “Clear and enter my building” to start fresh.</p>` : ''}
  <fieldset><legend>You</legend><div class="grid2">
    ${select('role', 'role', 'I am', [['owner_occupant_landlord', 'A landlord who lives in the building'], ['renting_landlord', 'A landlord who lives elsewhere'], ['tenant', 'A tenant'], ['condo_owner', 'A condo owner']], s.input.role, 'enum', true)}
    ${s.input.role === 'renting_landlord' ? '' : select('me', 'userUnitId', 'I live on', b.units.map(u => [u.id, FLOOR(u.id)] as [string, string]), s.input.userUnitId)}
    ${numberField('hh-size', 'household.size', 'People in my household', h.size, 'people', 'int')}
    ${select('discount', 'household.onDiscountRate', 'On a utility discount rate', YES_NO, triVal(h.onDiscountRate), 'tri')}
    ${(() => {
      const cur = h.incomeBand ? `${h.incomeBand.low}-${h.incomeBand.high}` : null
      const bands: [string, string][] = cur && h.incomeBand && !INCOME.some(([v]) => v === cur)
        ? [[cur, `$${h.incomeBand.low.toLocaleString('en-US')}–${h.incomeBand.high.toLocaleString('en-US')}`], ...INCOME] : INCOME
      return select('income', 'household.incomeBand', 'Household income, before tax', bands, cur, 'band')
    })()}
  </div></fieldset>
  <fieldset><legend>The building</legend><div class="grid2">
    <div class="field"><label for="town">City or town</label><input id="town" data-path="building.municipality" data-kind="text" value="${esc(b.municipality)}" autocomplete="address-level2"></div>
    ${numberField('year', 'building.yearBuilt', 'Year built', b.yearBuilt, '', 'int')}
    ${select('units', 'unitCount', 'Homes in the building', [['2', '2'], ['3', '3'], ['4', '4']], String(b.units.length), 'enum', true)}
    ${select('own', 'building.ownership', 'Ownership', [['single_owner', 'One owner'], ['condo', 'Condominium']], b.ownership, 'enum', true)}
    ${select('eu', 'building.electricUtility', 'Electric company', [['eversource', 'Eversource'], ['national_grid', 'National Grid'], ['unitil', 'Unitil'], ['cape_light_compact', 'Cape Light Compact'], ['municipal', 'Municipal light plant']], b.electricUtility)}
    ${select('gu', 'building.gasUtility', 'Gas company', [['eversource', 'Eversource'], ['national_grid', 'National Grid'], ['unitil', 'Unitil'], ['liberty', 'Liberty'], ['berkshire_gas', 'Berkshire Gas'], ['municipal', 'Municipal'], ['none', 'No gas service']], b.gasUtility)}
    ${select('hea', 'building.heaCompleted', 'Had a Mass Save energy assessment', YES_NO, triVal(b.heaCompleted), 'tri')}
    ${select('wx', 'building.weatherizationRecsDone', 'Recommended insulation done', YES_NO, triVal(b.weatherizationRecsDone), 'tri')}
    ${select('approve', 'building.ownerApproval', 'The owner approves the upgrades', YES_NO, triVal(b.ownerApproval), 'tri')}
  </div></fieldset>
  ${b.units.length > 1 ? sharedForm(b.units) : ''}
  ${units}
  <fieldset><legend>The project</legend><div class="grid2">
    <div class="field"><label for="install">Planned install date</label><input id="install" type="date" data-path="installDate" data-kind="text" value="${s.installDate}"></div>
    ${select('replace', 'boilerNeedsReplacing', 'The boiler needs replacing anyway', YES_NO, s.boilerNeedsReplacing ? 'yes' : 'no', 'tri')}
  </div></fieldset>`
}

export function setPath(s: State, path: string, kind: Kind, value: string): void {
  const band = value.match(/^(\d+)-(\d+)$/)
  const v: unknown = kind === 'text' ? value
    : value === '' ? null
    : kind === 'band' ? (band ? { low: Number(band[1]), high: Number(band[2]) } : null)
    : kind === 'tri' ? value === 'yes'
    : kind === 'int' ? Math.round(Number(value))
    : kind === 'num' ? Number(value)
    : value
  if (path === 'installDate') { s.installDate = value; return }
  if (path === 'boilerNeedsReplacing') { s.boilerNeedsReplacing = v === true; return }
  if (path === 'unitCount') {
    const n = Number(value) || 3
    const units = s.input.building.units.slice(0, n)
    while (units.length < n) units.push(blankUnit(String(units.length + 1), 'renter'))
    s.input.building.units = units
    if (s.input.userUnitId !== null && !units.some(u => u.id === s.input.userUnitId)) s.input.userUnitId = '1'
    return
  }
  const rec = path.match(/^building\.units\.(\d+)\.records\.(\d+)$/)
  if (rec) {
    const u = s.input.building.units[Number(rec[1])]
    if (!u || !u.heatingFuel) return
    const unit = RECORD_UNIT[u.heatingFuel]
    if (!unit) return
    const year = Number(rec[2])
    const rest = (u.fuelRecords ?? []).filter(r => r.year !== year && r.unit === unit)
    const all = v === null || !(Number(v) >= 0) ? rest : [...rest, { year, quantity: Number(v), unit }]
    u.fuelRecords = all.length === 0 ? null : all.sort((a, b) => a.year - b.year)
    return
  }
  const all = path.match(/^allUnits\.(\w+)$/)
  if (all) {
    for (let i = 0; i < s.input.building.units.length; i++) setPath(s, `building.units.${i}.${all[1]}`, kind, value)
    return
  }
  const keys = path.split('.')
  let o: Record<string, unknown> = s.input as unknown as Record<string, unknown>
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>
  const last = keys[keys.length - 1] as string
  o[last] = v
  if (last === 'heatingFuel') {
    const u = o as unknown as Unit
    if (u.fuelRecords && u.heatingFuel && u.fuelRecords.some(r => r.unit !== RECORD_UNIT[u.heatingFuel ?? ''])) u.fuelRecords = null
  }
  if (last === 'hotWaterFromBoiler' && v !== true) (o as unknown as Unit).hotWaterAfter = null
  if (path === 'role' && v === 'renting_landlord') s.input.userUnitId = null
  if (path === 'role' && v !== 'renting_landlord' && s.input.userUnitId === null) s.input.userUnitId = '1'
}

