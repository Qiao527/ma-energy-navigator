import { report, type Report, type UnitEnergy } from '../../engine/src/energy.js'
import type { Estimate } from '../../engine/src/estimate.js'
import { InputSchema, type Input, type Unit } from '../../engine/src/facts.js'
import { HEAT_COST_SHIFT_CONSTRAINT } from '../../engine/src/landlord.js'
import type { OfferResult } from '../../engine/src/offers.js'
import type { Assumption } from '../../engine/src/quantities.js'
import { offerKey, type RuleSet } from '../../engine/src/rules-schema.js'
import raw from '../.gen/data.json'
import { STORY1 } from './demo.js'

const DATA = raw as unknown as {
  rules: RuleSet
  assumptions: Assumption[]
  status: { previewDrafts: boolean; pendingDrafts: string[]; approvals: number; builtOn: string }
}
const RULES = DATA.rules
const OFFERS = new Map(RULES.offers.map(o => [offerKey(o), o]))
const PROGRAMS = new Map(RULES.programs.map(p => [p.id, p]))
const SEASONS = [2024, 2025] as const

// ---------- state ----------

interface State {
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

function demoState(): State {
  return { input: InputSchema.parse(structuredClone(STORY1.input)), installDate: '', boilerNeedsReplacing: false, demo: true }
}

function blankState(): State {
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

let state = demoState()
const today = (): string => new Date().toLocaleDateString('en-CA')

// ---------- formatting ----------

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
function usd(n: number): string {
  const a = Math.abs(n)
  const r = a >= 10000 ? Math.round(a / 100) * 100 : a >= 100 ? Math.round(a / 10) * 10 : Math.round(a)
  return `$${r.toLocaleString('en-US')}`
}
const num = (n: number, d = 1): string => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
const CONF: Record<Estimate['confidence'], string> = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' }

/** A yearly bill change (positive = pays more), in words that never hide which way it goes. */
function change(e: Estimate, per = 'a year'): string {
  const { low, high } = e.range
  if (high <= 0) return `saves ${usd(-high)}–${usd(-low)} ${per}`
  if (low >= 0) return `pays ${usd(low)}–${usd(high)} more ${per}`
  return `between saving ${usd(-low)} and paying ${usd(high)} more ${per}`
}
const typical = (e: Estimate): string => (e.range.mid <= 0 ? `typically saves ${usd(-e.range.mid)}` : `typically ${usd(e.range.mid)} more`)
const conf = (e: Estimate): string => `<span class="conf conf-${e.confidence}">${CONF[e.confidence]}</span>`
function why(e: Estimate, label = 'Why this range'): string {
  return `<details class="why"><summary>${label}</summary><ul>${e.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>`
}
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`

const FLOOR = (id: string): string => `Floor ${id}`
const PAYER: Record<string, string> = { owner: 'landlord', tenant: 'tenant' }
const MEASURE: Record<string, string> = {
  assessment: 'Home energy assessment', weatherization: 'Insulation and air sealing', heat_pump: 'Heat pumps',
  financing: '0% financing', bill_assistance: 'Bill help', rooftop_solar: 'Rooftop solar', community_solar: 'Community solar', tax_credit: 'State tax credit',
}
const STATUS: Record<OfferResult['status'], [string, string]> = {
  eligible: ['Qualifies', 'ok'], potential: ['Likely; the program confirms', 'maybe'], needs_info: ['Needs an answer', 'ask'], not_eligible: ['Not eligible', 'no'],
}
const QUESTION: Record<string, string> = {
  'unit.hotWaterFromBoiler': 'Does the boiler also heat this floor’s hot water?',
  'unit.hotWaterAfter': 'After the heat pump, what heats this floor’s water?',
  'unit.occupancy': 'Who lives on this floor: the owner or a renter?',
  'unit.heatingFuel': 'What heats this floor?',
  'unit.heatPaidBy': 'Who pays for this floor’s heat?',
  'unit.electricPaidBy': 'Who pays this floor’s electric bill?',
  'unit.hasResidentialHeatingMeter': 'Does this floor have its own residential heating meter?',
  'unit.participating': 'Has this floor’s household agreed to take part?',
  'unit.occupiedAllWinter': 'Is this floor lived in all winter?',
  'project.installDate': 'When do you plan to install? Heat pump rebates change on January 1, 2027.',
  'user.householdSize': 'How many people live in your household?',
  'user.onDiscountRate': 'Are you on your utility’s discount rate?',
  'building.heaCompleted': 'Has the building had a Mass Save Home Energy Assessment?',
  'building.weatherizationRecsDone': 'Has recommended insulation already been done?',
  'building.inEjBlockGroup': 'Is the building in an Environmental Justice block group?',
  'building.ownerApproval': 'Has the owner approved the work?',
}

// ---------- form ----------

type Kind = 'text' | 'int' | 'num' | 'tri' | 'enum'
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

const FUELS: [string, string][] = [['oil', 'Heating oil'], ['natural_gas', 'Natural gas'], ['propane', 'Propane'], ['electric_resistance', 'Electric baseboard'], ['heat_pump', 'Heat pump already'], ['other', 'Other']]
const RECORD_UNIT: Record<string, 'gallons' | 'therms' | 'kwh'> = { oil: 'gallons', propane: 'gallons', natural_gas: 'therms', electric_resistance: 'kwh' }

function unitForm(u: Unit, i: number): string {
  const p = `building.units.${i}`
  const id = `u${u.id}`
  const recUnit = u.heatingFuel ? RECORD_UNIT[u.heatingFuel] : undefined
  const season = (y: number) => u.fuelRecords?.filter(r => r.year === y).reduce((s, r) => s + r.quantity, 0) ?? null
  const records = recUnit
    ? `<fieldset class="sub"><legend>Fuel used, from delivery records or bills</legend><div class="grid2">${SEASONS.map(y =>
        numberField(`${id}-rec${y}`, `${p}.records.${y}`, `Winter ${y}–${String(y + 1).slice(2)}`, season(y), recUnit)).join('')}</div>
        <p class="hint">Add up every delivery or bill from July to June. Two winters give medium confidence; leave blank to use typical Massachusetts homes instead.</p></fieldset>`
    : ''
  const burns = u.heatingFuel === 'oil' || u.heatingFuel === 'natural_gas' || u.heatingFuel === 'propane' || u.fuelRecords !== null
  const hotWater = burns
    ? `<div class="grid2">${select(`${id}-hw`, `${p}.hotWaterFromBoiler`, 'Does the boiler also heat the hot water?', YES_NO, triVal(u.hotWaterFromBoiler), 'tri', true)}${
        u.hotWaterFromBoiler ? select(`${id}-hwa`, `${p}.hotWaterAfter`, 'After the heat pump, hot water comes from', [['boiler', 'The same boiler'], ['electric_resistance', 'An electric water heater'], ['heat_pump_water_heater', 'A heat pump water heater']], u.hotWaterAfter) : ''}</div>`
    : ''
  return `<fieldset class="unit"><legend>${FLOOR(u.id)}</legend>
    <div class="grid2">
      ${select(`${id}-occ`, `${p}.occupancy`, 'Who lives here', [['owner', 'The owner'], ['renter', 'A renter']], u.occupancy, 'enum', true)}
      ${select(`${id}-fuel`, `${p}.heatingFuel`, 'Heating today', FUELS, u.heatingFuel, 'enum', true)}
      ${select(`${id}-heat`, `${p}.heatPaidBy`, 'Who pays for heat', [['owner', 'Landlord / owner'], ['tenant', 'Tenant']], u.heatPaidBy)}
      ${select(`${id}-elec`, `${p}.electricPaidBy`, 'Who pays electricity', [['owner', 'Landlord / owner'], ['tenant', 'Tenant']], u.electricPaidBy)}
      ${select(`${id}-winter`, `${p}.occupiedAllWinter`, 'Lived in all winter', YES_NO, triVal(u.occupiedAllWinter), 'tri')}
      ${numberField(`${id}-tons`, `${p}.heatPumpTonsQuoted`, 'Heat pump size from a quote', u.heatPumpTonsQuoted, 'tons', 'num', 'Optional. Otherwise sized from similar homes.')}
    </div>${records}${hotWater}</fieldset>`
}

function formHtml(s: State): string {
  const b = s.input.building
  const h = s.input.household
  const units = b.units.map((u, i) => unitForm(u, i)).join('')
  return `
  <div class="form-head">
    <h2 id="form-title">Your building</h2>
    <div class="row">
      ${s.demo ? '<span class="demo-tag">Demo data</span>' : ''}
      <button type="button" class="ghost" data-action="demo">Load the demo building</button>
      <button type="button" class="ghost" data-action="blank">Start with my building</button>
    </div>
  </div>
  ${s.demo ? `<p class="demo-note"><strong>Demo data.</strong> ${esc(STORY1.story)}</p>` : ''}
  <fieldset><legend>You</legend><div class="grid2">
    ${select('role', 'role', 'I am', [['owner_occupant_landlord', 'A landlord who lives in the building'], ['renting_landlord', 'A landlord who lives elsewhere'], ['tenant', 'A tenant'], ['condo_owner', 'A condo owner']], s.input.role, 'enum', true)}
    ${s.input.role === 'renting_landlord' ? '' : select('me', 'userUnitId', 'I live on', b.units.map(u => [u.id, FLOOR(u.id)] as [string, string]), s.input.userUnitId)}
    ${numberField('hh-size', 'household.size', 'People in my household', h.size, 'people', 'int')}
    ${select('discount', 'household.onDiscountRate', 'On a utility discount rate', YES_NO, triVal(h.onDiscountRate), 'tri')}
  </div></fieldset>
  <fieldset><legend>The building</legend><div class="grid2">
    <div class="field"><label for="town">City or town</label><input id="town" data-path="building.municipality" data-kind="text" value="${esc(b.municipality)}" autocomplete="address-level2"></div>
    ${numberField('year', 'building.yearBuilt', 'Year built', b.yearBuilt, '', 'int')}
    ${select('units', 'unitCount', 'Homes in the building', [['2', '2'], ['3', '3'], ['4', '4']], String(b.units.length), 'enum', true)}
    ${select('own', 'building.ownership', 'Ownership', [['single_owner', 'One owner'], ['condo', 'Condominium']], b.ownership)}
    ${select('eu', 'building.electricUtility', 'Electric company', [['eversource', 'Eversource'], ['national_grid', 'National Grid'], ['unitil', 'Unitil'], ['cape_light_compact', 'Cape Light Compact'], ['municipal', 'Municipal light plant']], b.electricUtility)}
    ${select('gu', 'building.gasUtility', 'Gas company', [['eversource', 'Eversource'], ['national_grid', 'National Grid'], ['unitil', 'Unitil'], ['liberty', 'Liberty'], ['berkshire_gas', 'Berkshire Gas'], ['municipal', 'Municipal'], ['none', 'No gas service']], b.gasUtility)}
    ${select('hea', 'building.heaCompleted', 'Had a Mass Save energy assessment', YES_NO, triVal(b.heaCompleted), 'tri')}
    ${select('wx', 'building.weatherizationRecsDone', 'Recommended insulation done', YES_NO, triVal(b.weatherizationRecsDone), 'tri')}
  </div></fieldset>
  ${units}
  <fieldset><legend>The project</legend><div class="grid2">
    <div class="field"><label for="install">Planned install date</label><input id="install" type="date" data-path="installDate" data-kind="text" value="${s.installDate}"></div>
    ${select('replace', 'boilerNeedsReplacing', 'The boiler needs replacing anyway', YES_NO, s.boilerNeedsReplacing ? 'yes' : 'no', 'tri')}
  </div></fieldset>`
}

function setPath(s: State, path: string, kind: Kind, value: string): void {
  const v: unknown = value === '' ? null
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

// ---------- report ----------

function compute(s: State): { r: Report | null; error: string | null } {
  try {
    const installDate = s.installDate === '' ? null : s.installDate
    return { r: report(s.input, RULES, { asOf: today(), installDate, boilerNeedsReplacing: s.boilerNeedsReplacing }, DATA.assumptions), error: null }
  } catch (e) {
    return { r: null, error: e instanceof Error ? e.message : String(e) }
  }
}

function sumRange(es: (Estimate | null | undefined)[]): Estimate | null {
  const xs = es.filter((e): e is Estimate => !!e)
  if (xs.length === 0) return null
  return {
    range: { low: xs.reduce((a, e) => a + e.range.low, 0), mid: xs.reduce((a, e) => a + e.range.mid, 0), high: xs.reduce((a, e) => a + e.range.high, 0) },
    confidence: xs.some(e => e.confidence === 'low') ? 'low' : xs.some(e => e.confidence === 'medium') ? 'medium' : 'high',
    why: [...new Set(xs.flatMap(e => e.why))],
  }
}

function verdict(r: Report, s: State): string {
  const L = r.landlord
  const co2 = r.co2Total ? `and cuts CO₂ by ${num(-r.co2Total.change.range.high)}–${num(-r.co2Total.change.range.low)} tonnes a year` : ''
  if (L && L.realSavings) {
    const real = L.realSavings
    const text = real.range.high <= 0
      ? `At today’s Massachusetts prices, switching to heat pumps <strong>${change(real)}</strong> on the heating you pay for now, ${co2}.`
      : real.range.low >= 0
        ? `At today’s Massachusetts prices, heat pumps would <strong>cost ${usd(real.range.low)}–${usd(real.range.high)} more a year to run</strong> than your current heat, ${co2}.`
        : `At today’s Massachusetts prices, heat pumps land <strong>${change(real)}</strong> on running costs, ${co2}.`
    return `<p class="verdict">${text}</p>`
  }
  const net = sumRange(r.units.map(u => u.bills?.net))
  if (net) return `<p class="verdict">Across the building, heat pumps <strong>${change(net)}</strong> on energy, ${co2}.</p>`
  return `<p class="verdict">Add the heating fuel for each floor to see the money and the CO₂.</p>${s.demo ? '' : ''}`
}

function tiles(r: Report): string {
  const L = r.landlord
  const t: string[] = []
  if (L?.realSavings) t.push(tile('Real energy change', change(L.realSavings), typical(L.realSavings), L.realSavings))
  if (L?.shiftedTotal) t.push(tile('Moved onto tenants’ electric bills', `${usd(L.shiftedTotal.range.low)}–${usd(L.shiftedTotal.range.high)} a year`, `about ${usd(L.shiftedTotal.range.mid / 12)} a month in total`, L.shiftedTotal))
  if (L) t.push(tile('Upfront after incentives', `${usd(L.netUpfront.range.low)}–${usd(L.netUpfront.range.high)}`, L.coverage ? `incentives cover ${Math.round(L.coverage.range.low * 100)}–${Math.round(L.coverage.range.high * 100)}%` : 'incentive amount unknown', L.netUpfront))
  if (L) {
    const pb = L.paybackYears
    t.push(pb
      ? tile('Payback on real savings', `${num(pb.range.low, 0)}–${num(pb.range.high, 0)} years`, L.usesReplacementBaseline ? 'counts the boiler you would replace anyway' : 'without the commitment cost', pb)
      : `<div class="tile"><h3>Payback on real savings</h3><p class="big">None at these prices</p><p class="small">Running costs don’t fall for sure, so there is no honest payback.</p></div>`)
  }
  if (r.co2Total) t.push(tile('CO₂ per year', `−${num(-r.co2Total.change.range.high)} to −${num(-r.co2Total.change.range.low)} t`, `from about ${num(r.co2Total.before.range.mid)} t today`, r.co2Total.change))
  return t.length ? `<div class="tiles">${t.join('')}</div>` : ''
}
function tile(title: string, big: string, small: string, e: Estimate): string {
  return `<div class="tile"><h3>${title}</h3><p class="big">${big}</p><p class="small">${small}</p>${conf(e)}${why(e)}</div>`
}

function buildingDiagram(r: Report, s: State): string {
  const units = [...s.input.building.units].reverse()
  const L = r.landlord
  const floors = units.map(u => {
    const e = r.units.find(x => x.unitId === u.id)
    const who = u.occupancy === 'owner' ? 'Owner lives here' : u.occupancy === 'renter' ? 'Rented' : 'Occupancy unknown'
    const you = s.input.userUnitId === u.id ? '<span class="you">You</span>' : ''
    const pay = `Heat: ${u.heatPaidBy ? PAYER[u.heatPaidBy] : 'unknown'} pays · Electricity: ${u.electricPaidBy ? PAYER[u.electricPaidBy] : 'unknown'} pays`
    const lines: string[] = []
    if (e?.split) {
      if (e.split.owner.annual) lines.push(`<li><span class="who">Landlord</span> ${change(e.split.owner.annual)}</li>`)
      if (e.split.tenant.annual) lines.push(`<li><span class="who">Tenant</span> ${change(e.split.tenant.annual)}</li>`)
      for (const x of e.split.unallocated) lines.push(`<li><span class="who">Unknown payer</span> ${change(x.change)}: we don’t know who pays this bill</li>`)
    }
    const shifted = L?.shiftedToTenants.find(x => x.unitId === u.id)
    return `<li class="floor${u.occupancy === 'owner' ? ' own' : ''}">
      <div class="floor-head"><strong>${FLOOR(u.id)}</strong>${you}<span class="occ">${who}</span></div>
      <p class="pay">${pay}</p>
      ${lines.length ? `<ul class="changes">${lines.join('')}</ul>` : '<p class="small">No bill estimate yet.</p>'}
      ${shifted ? `<p class="shift-flag">Heating cost moves to this tenant: about ${usd(shifted.monthly.range.mid)} a month</p>` : ''}
    </li>`
  }).join('')
  return `<section aria-labelledby="h-building"><h2 id="h-building">Who saves, who may pay more</h2>
    <p class="lede">Each bill goes to whoever pays it today. A heat pump cuts the fuel bill and adds to the electric bill.</p>
    <div class="house"><div class="roof" aria-hidden="true"></div><ol class="floors" reversed>${floors}</ol></div></section>`
}

/** Range chart: each payer’s yearly change per floor, low–high with the typical value marked; a table carries the same numbers. */
function rangeChart(r: Report): string {
  const rows: { label: string; e: Estimate }[] = []
  for (const u of r.units) {
    if (!u.split) continue
    if (u.split.owner.annual) rows.push({ label: `${FLOOR(u.unitId)} · landlord`, e: u.split.owner.annual })
    if (u.split.tenant.annual) rows.push({ label: `${FLOOR(u.unitId)} · tenant`, e: u.split.tenant.annual })
  }
  if (rows.length === 0) return ''
  const max = Math.max(...rows.map(x => Math.max(Math.abs(x.e.range.low), Math.abs(x.e.range.high))))
  const step = max > 4000 ? 2000 : max > 2000 ? 1000 : 500
  const lim = Math.ceil(max / step) * step
  const W = 640, L = 150, R = 20, top = 28, rowH = 30
  const H = top + rows.length * rowH + 30
  const x = (v: number) => L + ((v + lim) / (2 * lim)) * (W - L - R)
  const ticks: number[] = []
  for (let v = -lim; v <= lim; v += step) ticks.push(v)
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chart-t chart-d" class="chart">
    <title id="chart-t">Yearly bill change by floor and payer</title>
    <desc id="chart-d">Bars show the low to high range of each payer’s yearly change; the mark is the typical value. Left of zero saves money, right of zero pays more. The table below has the same numbers.</desc>
    ${ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${top - 6}" y2="${H - 26}" class="${v === 0 ? 'zero' : 'grid'}"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle" class="tick">${v === 0 ? '$0' : `${v < 0 ? '−' : '+'}${usd(v)}`}</text>`).join('')}
    <text x="${x(-lim / 2)}" y="14" text-anchor="middle" class="axis">saves</text><text x="${x(lim / 2)}" y="14" text-anchor="middle" class="axis">pays more</text>
    ${rows.map((row, i) => {
      const y = top + i * rowH + rowH / 2
      const cls = row.e.range.mid > 0 ? 'more' : 'less'
      return `<text x="${L - 10}" y="${y + 4}" text-anchor="end" class="label">${esc(row.label)}</text>
        <rect x="${x(row.e.range.low)}" y="${y - 7}" width="${Math.max(2, x(row.e.range.high) - x(row.e.range.low))}" height="14" rx="3" class="bar ${cls}"/>
        <line x1="${x(row.e.range.mid)}" x2="${x(row.e.range.mid)}" y1="${y - 11}" y2="${y + 11}" class="mid"/>`
    }).join('')}
  </svg>`
  const table = `<div class="table-wrap"><table><caption>Yearly bill change by floor and payer (positive = pays more)</caption>
    <thead><tr><th scope="col">Floor and payer</th><th scope="col">Low</th><th scope="col">Typical</th><th scope="col">High</th><th scope="col">Confidence</th></tr></thead>
    <tbody>${rows.map(row => `<tr><th scope="row">${esc(row.label)}</th>${[row.e.range.low, row.e.range.mid, row.e.range.high].map(v => `<td>${v > 0 ? '+' : v < 0 ? '−' : ''}${usd(v)}</td>`).join('')}<td>${CONF[row.e.confidence]}</td></tr>`).join('')}</tbody></table></div>`
  return `<section aria-labelledby="h-chart"><h2 id="h-chart">Yearly bills, as ranges</h2>${svg}${table}</section>`
}

function fairness(r: Report): string {
  const L = r.landlord
  if (!L || L.shiftedToTenants.length === 0) return ''
  const legal = RULES.legal.find(x => x.id === HEAT_COST_SHIFT_CONSTRAINT)
  const per = L.shiftedToTenants.map(x => `<li>${FLOOR(x.unitId)}: ${usd(x.annual.range.low)}–${usd(x.annual.range.high)} a year, about ${usd(x.monthly.range.mid)} a month</li>`).join('')
  const shifted = L.paybackIfCostShifted
  return `<section aria-labelledby="h-fair" class="fair"><h2 id="h-fair">Heating cost moving onto tenants</h2>
    <p>Today you pay the oil. After the switch, the heat pumps run on the tenants’ electric meters, so part of what looks like your saving is heating cost moving onto their bills:</p>
    <ul>${per}</ul>
    ${legal ? `<p class="law"><strong>${esc(legal.leaseCheck)}</strong> ${esc(legal.summary)} ${esc(legal.disclaimer)}</p>
    <p class="small">Where to get help: ${legal.resources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.section)}</a>`).join(' · ')}</p>` : ''}
    <h3>Fair ways to handle it</h3>
    <ol class="options"><li><strong>Lower the rent</strong> by the monthly amount above.</li><li><strong>Give an electricity allowance</strong> of the same size.</li><li><strong>Put the heat pumps on an owner-paid meter</strong>, so nothing moves.</li><li><strong>Agree on it at renewal or in a new lease, in writing</strong>, with the electricity change explained openly. Never use a renewal to move the cost without saying so.</li></ol>
    ${shifted ? `<p class="small">For comparison only: if the cost were left on tenants (which needs a written rental agreement), the payback would be ${num(shifted.range.low, 0)}–${num(shifted.range.high, 0)} years. The payback above uses real savings only.</p>` : ''}
    ${L.projectCommitment.reason ? `<p class="small"><strong>Project commitment terms:</strong> ${esc(L.projectCommitment.reason)} Some offers require a written commitment not to raise rent or evict for a period after the incentive.</p>` : ''}
  </section>`
}

function offersSection(r: Report): string {
  const shown = r.navigation.shown
  if (shown.length === 0) return ''
  const steps = r.navigation.steps.map(st => `<li><strong>${MEASURE[st.measure] ?? st.measure}</strong>${st.after.length ? `<span class="small"> · after ${st.after.map(a => `${(MEASURE[a.measure] ?? a.measure).toLowerCase()}: ${esc(a.reason)}`).join('; ')}</span>` : ''}</li>`).join('')
  const groups = new Map<string, OfferResult[]>()
  for (const x of shown) {
    const k = x.unitId === null ? 'Whole building / you' : FLOOR(x.unitId)
    groups.set(k, [...(groups.get(k) ?? []), x])
  }
  const cards = [...groups.entries()].map(([k, xs]) => `<div class="offer-group"><h3>${k}</h3><ul class="offers">${xs.map(offerItem).join('')}</ul></div>`).join('')
  return `<section aria-labelledby="h-plan"><h2 id="h-plan">What to do first</h2><ol class="steps">${steps}</ol></section>
    <section aria-labelledby="h-offers"><h2 id="h-offers">Programs, floor by floor</h2>
    <p class="lede">The program decides eligibility; this shows what the published rules say and what to confirm.</p><div class="offer-groups">${cards}</div></section>`
}
function offerItem(x: OfferResult): string {
  const o = OFFERS.get(`${x.offerId}@${x.version}`)
  const [label, cls] = STATUS[x.status]
  const deadline = x.reason === 'application_deadline_passed' ? `<p class="small">Application deadline passed on ${x.applicationDeadline}.</p>` : ''
  const value = x.value ? `<p class="value">${o?.qualification === 'up_to' ? 'Up to ' : ''}${usd(x.value.range.low)}–${usd(x.value.range.high)} ${conf(x.value)}</p>` : ''
  const todo = x.prerequisites.filter(p => p.state !== 'done').map(p => `<li>${esc(p.description)}${p.unitsNeeded?.length ? ` <strong>${plural(p.unitsNeeded.length, 'more unit')} needed.</strong>` : ''}</li>`).join('')
  const confirm = x.confirmations.map(c => `<li>${esc(c.question)} <span class="small">(${esc(c.decidedBy)} decides: ${esc(c.nextAction)})</span></li>`).join('')
  return `<li class="offer"><div class="offer-head"><span class="status s-${cls}">${label}</span><strong>${esc(o?.title ?? x.offerId)}</strong></div>${value}${deadline}
    ${todo ? `<details><summary>Before you apply</summary><ul>${todo}</ul></details>` : ''}${confirm ? `<details><summary>Only the program can confirm</summary><ul>${confirm}</ul></details>` : ''}</li>`
}

function energySection(r: Report): string {
  const rows = r.units.map((u: UnitEnergy) => {
    const parts: string[] = []
    if (u.heatLoad) parts.push(`<p><strong>Heating need:</strong> ${num(u.heatLoad.range.low, 0)}–${num(u.heatLoad.range.high, 0)} MMBtu of heat a year ${conf(u.heatLoad)}</p>${why(u.heatLoad, 'How it was worked out')}`)
    if (u.comparison) parts.push(`<p class="cmp cmp-${u.comparison.position}">${esc(u.comparison.message)} <span class="small">Similar homes: ${num(u.comparison.typical.range.low, 0)}–${num(u.comparison.typical.range.high, 0)} MMBtu (25th–75th percentile).</span></p>`)
    if (u.bills) parts.push(`<p><strong>Fuel bill:</strong> ${change(u.bills.fuelBill)} · <strong>Electric bill:</strong> ${change(u.bills.electricBill)} · <strong>Both together:</strong> ${change(u.bills.net)}</p>`)
    if (u.co2) parts.push(`<p><strong>CO₂:</strong> ${num(u.co2.before.range.mid)} t a year today → ${num(u.co2.after.range.mid)} t with heat pumps</p>`)
    if (u.hotWater?.after === 'boiler') parts.push(`<p><strong>Hot water stays on the boiler:</strong> the oil bill won’t reach zero${u.hotWater.fuelCostKept ? `: about ${usd(u.hotWater.fuelCostKept.range.low)}–${usd(u.hotWater.fuelCostKept.range.high)} of fuel a year stays` : ''}${u.hotWater.fixedCost ? `, plus the boiler’s yearly service, about ${usd(u.hotWater.fixedCost.range.low)}–${usd(u.hotWater.fixedCost.range.high)}` : ''}.</p>`)
    for (const n of u.notes) parts.push(`<p class="note">${esc(n)}</p>`)
    return `<div class="unit-energy"><h3>${FLOOR(u.unitId)}</h3>${parts.join('') || '<p class="small">Nothing to estimate yet.</p>'}</div>`
  }).join('')
  return `<section aria-labelledby="h-energy"><h2 id="h-energy">How the numbers are worked out</h2>
    <p class="lede">Fuel records → scaled to a normal winter → hot water taken out → heat the home needs → heat pump electricity at measured Massachusetts efficiency → bills at statewide prices and CO₂.</p>
    <div class="unit-energies">${rows}</div></section>`
}

function questionsSection(r: Report): string {
  const qs = r.navigation.questions
  if (qs.length === 0) return ''
  return `<section aria-labelledby="h-q"><h2 id="h-q">Answers that would sharpen this</h2><ul class="questions">${qs.map(q =>
    `<li>${esc(QUESTION[q.fact] ?? q.fact)}${q.unitId ? ` <span class="small">(${FLOOR(q.unitId)}${q.about === 'other_unit' ? ', ask the household' : ''})</span>` : ''}</li>`).join('')}</ul></section>`
}

function contacts(r: Report): string {
  const ids = new Set(r.navigation.shown.flatMap(x => { const o = OFFERS.get(`${x.offerId}@${x.version}`); return o ? [o.programId] : [] }))
  const ps = [...ids].flatMap(id => { const p = PROGRAMS.get(id); return p ? [p] : [] })
  if (ps.length === 0) return ''
  return `<section aria-labelledby="h-contact"><h2 id="h-contact">Who to contact next</h2><ul class="contacts">${ps.map(p =>
    `<li><strong>${esc(p.name)}</strong><span>${p.handoff.phone ? `<span class="phone">${esc(p.handoff.phone)}</span> · ` : ''}<a href="${esc(p.handoff.url)}" target="_blank" rel="noopener">${esc(p.handoff.label)}</a></span></li>`).join('')}</ul></section>`
}

function sourcesSection(): string {
  const rows = DATA.assumptions.map(a => `<tr><th scope="row">${esc(a.description)}</th><td class="nowrap">${a.value.low === a.value.high ? num(a.value.mid, 4).replace(/\.?0+$/, '') : `${a.value.low} / ${a.value.mid} / ${a.value.high}`} <span class="small">${esc(a.unit)}</span></td><td>${CONF[a.confidence]}</td><td>${a.sources.slice(0, 2).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.section)}</a> <span class="small">(${s.lastVerified})</span>`).join('<br>')}</td></tr>`).join('')
  return `<section aria-labelledby="h-src"><h2 id="h-src">Every number has a source</h2><details><summary>Show all ${DATA.assumptions.length} assumptions, with sources</summary>
    <div class="table-wrap"><table><caption>Assumptions used (low / typical / high)</caption><thead><tr><th scope="col">What</th><th scope="col">Value</th><th scope="col">Confidence</th><th scope="col">Source</th></tr></thead><tbody>${rows}</tbody></table></div></details></section>`
}

function reportHtml(s: State): string {
  const { r, error } = compute(s)
  if (error || !r) return `<p class="error" role="alert">This combination can’t be estimated yet: ${esc(error ?? 'unknown error')}. Check the building details and try again.</p>`
  return `${s.demo ? '<p class="demo-tag inline">Demo data: fictional oil records</p>' : ''}
    ${verdict(r, s)}${tiles(r)}${r.landlordReason ? `<p class="note">${esc(r.landlordReason)}</p>` : ''}
    ${buildingDiagram(r, s)}${rangeChart(r)}${fairness(r)}${offersSection(r)}${energySection(r)}${questionsSection(r)}${contacts(r)}${sourcesSection()}`
}

// ---------- wiring ----------

const formEl = document.getElementById('form') as HTMLFormElement
const reportEl = document.getElementById('report') as HTMLElement
const liveEl = document.getElementById('live') as HTMLElement

function renderForm(): void { formEl.innerHTML = formHtml(state) }
function renderReport(): void {
  reportEl.innerHTML = reportHtml(state)
  liveEl.textContent = 'Report updated.'
}

formEl.addEventListener('submit', e => e.preventDefault())
formEl.addEventListener('change', e => {
  const t = e.target as HTMLInputElement | HTMLSelectElement
  const path = t.dataset.path
  if (!path) return
  setPath(state, path, (t.dataset.kind ?? 'enum') as Kind, t.value)
  if (t.hasAttribute('data-structural')) {
    const id = t.id
    renderForm()
    document.getElementById(id)?.focus()
  }
  renderReport()
})
formEl.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null
  if (!b) return
  state = b.dataset.action === 'demo' ? demoState() : blankState()
  renderForm()
  renderReport()
  document.getElementById(b.dataset.action === 'demo' ? 'role' : 'town')?.focus()
})

if (DATA.status.previewDrafts) {
  const bar = document.getElementById('preview') as HTMLElement
  bar.hidden = false
  bar.textContent = `Preview with draft rules that are not yet approved (${DATA.status.pendingDrafts.length} files). Not for decisions.`
}
;(document.getElementById('built') as HTMLElement).textContent = DATA.status.builtOn
renderForm()
renderReport()
