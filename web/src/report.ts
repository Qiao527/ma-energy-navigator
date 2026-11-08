import { breakEven, heatCosts, heatPumpPrice, report, withOverrides, type HeatSource, type Report, type UnitEnergy } from '../../engine/src/energy.js'
import type { Estimate } from '../../engine/src/estimate.js'
import type { Fuel, Unit } from '../../engine/src/facts.js'
import { HEAT_COST_SHIFT_CONSTRAINT } from '../../engine/src/landlord.js'
import type { OfferResult } from '../../engine/src/offers.js'
import type { Assumption } from '../../engine/src/quantities.js'
import { DATA, OFFERS, PROGRAMS, RULES } from './data.js'
import { CONF, esc, FLOOR, MEASURE, num, PAYER, QUESTION, STATUS, usd } from './format.js'
import { today, type State } from './form.js'
import { mapSection } from './map.js'

/** What the viewer is exploring: what-if values, whose meter the heat pumps use, and which drawing mode is shown. */
export interface View {
  /** Assumption id → the user's own value. Empty = the sourced statewide figures. */
  whatIf: Record<string, number>
  meter: 'unit' | 'owner'
  mode: 'today' | 'after'
  zoom: 'state' | 'local'
}
export const DEFAULT_VIEW: View = { whatIf: {}, meter: 'unit', mode: 'after', zoom: 'state' }

export function assumptionsFor(v: View): Assumption[] {
  return Object.keys(v.whatIf).length ? withOverrides(DATA.assumptions, v.whatIf) : DATA.assumptions
}

export function compute(s: State, v: View): { r: Report | null; error: string | null } {
  try {
    const installDate = s.installDate === '' ? null : s.installDate
    return {
      r: report(s.input, RULES, { asOf: today(), installDate, boilerNeedsReplacing: s.boilerNeedsReplacing, heatPumpMeter: v.meter }, assumptionsFor(v)),
      error: null,
    }
  } catch (e) {
    return { r: null, error: e instanceof Error ? e.message : String(e) }
  }
}

/** The main burned fuel in the building (what the fuel-price control and the "why" chart compare against). */
type Burned = 'oil' | 'natural_gas' | 'propane' | 'electric_resistance'
export function mainFuel(s: State): Burned {
  const isBurned = (x: Fuel | null): x is Burned => x === 'oil' || x === 'natural_gas' || x === 'propane' || x === 'electric_resistance'
  return s.input.building.units.map(u => u.heatingFuel).find(isBurned) ?? 'oil'
}

// ---------- number spans that animate between renders ----------

type Fmt = 'usd' | 'n0' | 'n1' | 'n2' | 'c2'
export function fmt(v: number, f: Fmt): string {
  switch (f) {
    case 'usd': return usd(v)
    case 'n0': return num(v, 0)
    case 'n1': return num(v, 1)
    case 'n2': return num(v, 2)
    case 'c2': return `$${num(v, 2)}`
  }
}
/** A number the page may tween when it changes: key, value and format travel on the element. */
const n = (k: string, v: number, f: Fmt = 'usd'): string => `<span class="n" data-k="${k}" data-v="${v}" data-f="${f}">${fmt(v, f)}</span>`
const rangeN = (k: string, lo: number, hi: number, f: Fmt = 'usd'): string =>
  Math.abs(hi - lo) < 1e-9 ? n(`${k}.lo`, lo, f) : `${n(`${k}.lo`, lo, f)}–${n(`${k}.hi`, hi, f)}`
function signedN(k: string, e: Estimate): string {
  const s = (key: string, v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n(key, Math.abs(v))}`
  return `${s(`${k}.lo`, e.range.low)} to ${s(`${k}.hi`, e.range.high)}`
}
const confNote = (e: Estimate): string => `<span class="conf" data-level="${e.confidence}">${CONF[e.confidence]}</span>`
function whyList(e: Estimate, label: string): string {
  return `<details class="why"><summary>${label}</summary><ul>${e.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>`
}
const isLandlord = (s: State): boolean => s.input.role === 'owner_occupant_landlord' || s.input.role === 'renting_landlord'
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)
const fuelName = (f: Fuel | null): string => ({ oil: 'oil', natural_gas: 'gas', propane: 'propane', electric_resistance: 'electric' } as Record<string, string>)[f ?? ''] ?? 'fuel'
const between = (lo: number, hi: number, f: (x: number) => string = usd): string => (Math.abs(hi - lo) < 1e-9 ? f(lo) : `${f(lo)}–${f(hi)}`)

// ---------- 1. the answer, beside the switch drawn as a mechanism ----------

function headline(r: Report, s: State): { text: string; e: Estimate | null } {
  const L = r.landlord
  if (L?.realSavings) {
    const e = L.realSavings
    if (e.range.low >= 0) return { e, text: `Heat pumps would <em>raise</em> this building’s heating costs by ${rangeN('hl', e.range.low, e.range.high)} a year.` }
    if (e.range.high <= 0) return { e, text: `Heat pumps would <em>cut</em> this building’s heating costs by ${rangeN('hl', -e.range.high, -e.range.low)} a year.` }
    return { e, text: `Heat pumps would land between saving ${n('hl.lo', -e.range.low)} and paying ${n('hl.hi', e.range.high)} more a year on heating.` }
  }
  const mine = r.units.find(u => u.unitId === s.input.userUnitId)
  const tenant = s.input.role === 'tenant'
  const e = mine?.split ? (tenant ? mine.split.tenant.annual : mine.split.owner.annual) : null
  if (e) {
    const who = tenant ? 'your bills' : 'your bills on this floor'
    if (e.range.low >= 0) return { e, text: `With heat pumps, ${who} would go up ${rangeN('hl', e.range.low, e.range.high)} a year.` }
    if (e.range.high <= 0) return { e, text: `With heat pumps, ${who} would go down ${rangeN('hl', -e.range.high, -e.range.low)} a year.` }
    return { e, text: `With heat pumps, ${who} would change by ${signedN('hl', e)} a year.` }
  }
  return { e: null, text: 'Tell us how each floor is heated, and who pays which bill, to see who saves and who pays more.' }
}

const fig = (value: string, label: string, cls = ''): string => `<div class="figure ${cls}"><dt>${label}</dt><dd>${value}</dd></div>`
function keyFigures(r: Report): string {
  const L = r.landlord
  const out: string[] = []
  if (L && L.shiftedToTenants.length > 0) {
    const lo = Math.min(...L.shiftedToTenants.map(x => x.monthly.range.low))
    const hi = Math.max(...L.shiftedToTenants.map(x => x.monthly.range.high))
    out.push(fig(`${rangeN('shift', lo, hi)}<small>/month</small>`, 'moves onto each tenant’s electric bill, unless you adjust for it', 'shift'))
  } else if (L) {
    out.push(fig('$0<small>/month</small>', 'moves onto tenants’ bills with these settings', 'shift none'))
  }
  if (L) out.push(fig(rangeN('up', L.netUpfront.range.low, L.netUpfront.range.high), L.incentivesKnown ? `upfront after ${between(L.incentivesKnown.range.low, L.incentivesKnown.range.high)} in rebates` : 'upfront; rebate amount not known yet'))
  if (L?.paybackYears) out.push(fig(`${rangeN('pb', L.paybackYears.range.low, L.paybackYears.range.high, 'n0')}<small> yrs</small>`, 'payback on real savings'))
  else if (L?.realSavings) out.push(fig('No payback', 'running costs may rise at these prices'))
  if (r.co2Total) out.push(fig(`−${rangeN('co2', -r.co2Total.change.range.high, -r.co2Total.change.range.low, 'n1')}<small> t CO₂/yr</small>`, `from about ${num(r.co2Total.before.range.mid, 0)} t today`, 'co2'))
  return out.length ? `<dl class="figures">${out.join('')}</dl>` : ''
}

/**
 * One floor in elevation, with both mechanisms drawn: today a riser from the basement boiler feeds a radiator;
 * with heat pumps an outdoor unit on the porch feeds a wall head, and runs on this floor's meter or an owner bus.
 */
function floorSlice(you: boolean, ownerBus: boolean): string {
  const tag = 'aria-hidden="true" focusable="false"'
  return `<svg class="slice" viewBox="0 0 240 104" ${tag}>
    <rect x="40" y="0" width="160" height="104" class="wall${you ? ' you' : ''}"/>
    <path d="M40 14 L20 22 L20 88 L40 96" class="bay"/><rect x="25" y="34" width="10" height="36" class="glass"/>
    <rect x="58" y="30" width="26" height="44" class="glass"/><rect x="100" y="30" width="26" height="44" class="glass"/>
    <rect x="148" y="24" width="30" height="80" class="door"/>
    <path d="M200 0 V104 M236 0 V104 M200 70 H236 M200 78 H236 M209 70 V104 M218 70 V104 M227 70 V104" class="porch"/>
    <g class="mech mech-today"><path d="M46 0 V104" class="pipe"/><path d="M46 90 H100" class="pipe"/><path d="M100 84 h26 v12 h-26 z M105 84 v12 M110 84 v12 M115 84 v12 M120 84 v12" class="radiator"/></g>
    <g class="mech mech-after">
      <rect x="58" y="14" width="34" height="9" rx="2" class="unit-in"/>
      <path d="M92 18 H196 V48 H204" class="lineset"/>
      <rect x="204" y="38" width="26" height="22" rx="2" class="unit-out"/><circle cx="217" cy="49" r="7" class="fan"/>
      ${ownerBus ? '<path d="M230 56 H238 V104" class="wire"/>' : '<path d="M204 56 H197 V62" class="wire"/><g class="meter"><circle cx="190" cy="62" r="7"/><path d="M186 62 h8 M190 58 v4"/></g>'}
    </g>
    <line x1="14" y1="104" x2="236" y2="104" class="floorline"/>
  </svg>`
}
const ROOF = `<svg class="slice roof" viewBox="0 0 240 30" aria-hidden="true" focusable="false"><path d="M12 14 H238 V22 H12 Z" class="cornice"/><path d="M40 22 V30 M200 22 V30 M20 22 L28 30 M60 22 V27 M100 22 V27 M140 22 V27 M180 22 V27" class="porch"/></svg>`
function basement(keepsBoiler: boolean, ownerBus: boolean): string {
  return `<svg class="slice base" viewBox="0 0 240 60" aria-hidden="true" focusable="false">
    <path d="M20 0 H236 V10 H20 Z" class="foundation"/><path d="M204 10 H232 M208 14 H232 M212 18 H232" class="porch"/>
    <g class="mech mech-today"><path d="M46 0 V24" class="pipe"/><rect x="34" y="24" width="26" height="30" rx="2" class="boiler"/><path d="M42 46 q5 -10 10 0" class="flame"/><rect x="72" y="32" width="54" height="22" rx="11" class="tank"/></g>
    <g class="mech mech-after">${keepsBoiler ? `<rect x="34" y="24" width="26" height="30" rx="2" class="boiler kept"/><path d="M42 46 q5 -10 10 0" class="flame"/>` : ''}
      ${ownerBus ? '<path d="M238 0 V30 H224" class="wire"/><g class="meter owner"><circle cx="216" cy="30" r="9"/><path d="M211 30 h10 M216 25 v5"/></g>' : ''}</g>
  </svg>`
}

function building(r: Report, s: State, v: View): string {
  const units = [...s.input.building.units].reverse()
  const L = r.landlord
  const ownerBus = v.meter === 'owner'
  const keepsBoiler = r.units.some(u => u.hotWater?.after === 'boiler')
  const rows = units.map(u => {
    const e = r.units.find(x => x.unitId === u.id)
    const you = s.input.userUnitId === u.id
    const who = u.occupancy === 'owner' ? 'owner' : u.occupancy === 'renter' ? 'rented' : 'occupancy unknown'
    const heatPayer = u.heatPaidBy ? PAYER[u.heatPaidBy] : null
    const elecPayer = ownerBus ? 'landlord' : u.electricPaidBy ? PAYER[u.electricPaidBy] : null
    const lines: string[] = []
    if (e?.bills) {
      if (v.mode === 'today') {
        lines.push(line('fuel', `${heatPayer ? cap(heatPayer) : 'Unknown payer'} · ${fuelName(u.heatingFuel)} for heat`, `${rangeN(`f${u.id}.today`, -e.bills.fuelBill.range.high, -e.bills.fuelBill.range.low)}<span class="per">/yr</span>`))
      } else if (heatPayer && heatPayer === elecPayer) {
        lines.push(line('both', `${cap(heatPayer)} pays both bills`, `${signedN(`f${u.id}.net`, e.bills.net)}<span class="per">/yr</span>`))
      } else {
        lines.push(line('fuel', `${heatPayer ? cap(heatPayer) : 'Unknown payer'} · ${fuelName(u.heatingFuel)} bill`, `${signedN(`f${u.id}.fuel`, e.bills.fuelBill)}<span class="per">/yr</span>`))
        lines.push(line('elec', `${elecPayer ? cap(elecPayer) : 'Unknown payer'} · electric bill`, `${signedN(`f${u.id}.elec`, e.bills.electricBill)}<span class="per">/yr</span>`))
      }
    }
    const shift = v.mode === 'after' ? L?.shiftedToTenants.find(x => x.unitId === u.id) : undefined
    return `<li class="floor-row${you ? ' is-you' : ''}" data-floor="${u.id}" tabindex="0">
      ${floorSlice(you, ownerBus)}
      <div class="callout">
        <p class="callout-head"><span class="floor-no">${FLOOR(u.id)}</span> ${who}${you ? ' <span class="you">you</span>' : ''}</p>
        ${lines.length ? `<ul>${lines.join('')}</ul>` : '<p class="muted">No estimate yet: add the heating fuel.</p>'}
        ${shift ? `<p class="shift-note">≈ ${n(`f${u.id}.shift`, shift.monthly.range.mid)} a month of heating moves to this tenant</p>` : ''}
      </div></li>`
  }).join('')
  const caption = v.mode === 'today'
    ? 'Today: one boiler in the basement heats every floor through a shared riser, and whoever pays for heat buys all the fuel.'
    : `With heat pumps: each floor gets an outdoor unit on its porch, running on ${ownerBus ? 'one owner-paid meter, so the landlord pays the electricity' : 'that floor’s own electric meter, so whoever pays that bill pays for the heat'}${keepsBoiler ? '. The boiler stays for hot water' : ''}. Yearly change per bill, low to high.`
  return `<figure class="elevation mode-${v.mode}${ownerBus ? ' owner-bus' : ''}" data-k="elev" aria-label="The building drawn floor by floor">
    <div class="seg-toggle" role="group" aria-label="Show the building">
      <button type="button" data-mode="today" aria-pressed="${v.mode === 'today'}">Today</button>
      <button type="button" data-mode="after" aria-pressed="${v.mode === 'after'}">With heat pumps</button>
    </div>
    <div class="roof-row">${ROOF}</div><ol class="floors">${rows}</ol><div class="base-row">${basement(keepsBoiler, ownerBus)}</div>
    <figcaption>${caption}</figcaption></figure>`
}
function line(kind: 'fuel' | 'elec' | 'both', label: string, value: string): string {
  return `<li><span class="swatch ${kind}" aria-hidden="true"></span><span class="lbl">${label}</span><span class="val">${value}</span></li>`
}

function hero(r: Report, s: State, v: View): string {
  const h = headline(r, s)
  const b = s.input.building
  const sheet = [b.municipality || 'Town not set', `${b.units.length} homes`, b.yearBuilt ? `built ${b.yearBuilt}` : null].filter(Boolean).join(' · ')
  const whatIf = Object.keys(v.whatIf).length > 0
  return `<section class="hero" aria-labelledby="h-answer">
    <div class="answer">
      <p class="sheet">${esc(sheet)}${s.demo ? ' <span class="tag">demo data</span>' : ''}${whatIf ? ' <span class="tag whatif">what-if values</span>' : ''}</p>
      <h1 id="h-answer" class="headline">${h.text}</h1>
      ${h.e ? `<p class="headline-meta">${confNote(h.e)} ${whatIf ? 'Using your what-if values.' : 'Statewide prices, winter 2025–26. Try your own in the bar above.'}</p>` : ''}
      ${keyFigures(r)}
      ${r.landlordReason ? `<p class="muted">${esc(r.landlordReason)}</p>` : ''}
    </div>
    ${building(r, s, v)}
  </section>`
}

// ---------- 2. why: the price of one unit of heat (HTML bars, so changes animate) ----------

const SOURCE_LABEL: Record<HeatSource, string> = {
  oil: 'Oil boiler', natural_gas: 'Gas boiler', propane: 'Propane boiler', electric_resistance: 'Electric baseboard', heat_pump: 'Cold-climate heat pump',
}
function heatPrice(s: State, v: View): string {
  const list = assumptionsFor(v)
  const utility = s.input.building.electricUtility
  const rows = heatCosts(list, utility)
  if (rows.length === 0) return ''
  const current = mainFuel(s)
  const lim = Math.max(60, Math.ceil(Math.max(...rows.map(x => x.perMMBtu.range.high)) / 20) * 20)
  const pct = (x: number) => `${(Math.min(x, lim) / lim) * 100}%`
  const cur = rows.find(r => r.id === current)
  const hp = rows.find(r => r.id === 'heat_pump')
  const ticks = Array.from({ length: lim / 20 + 1 }, (_, i) => i * 20)
  const bars = rows.map(row => {
    const kind = row.id === 'heat_pump' || row.id === 'electric_resistance' ? 'elec' : 'fuel'
    const em = row.id === current || row.id === 'heat_pump'
    const e = row.perMMBtu.range
    return `<li class="hb-row${em ? ' em' : ''}" tabindex="0" data-tip="${esc(SOURCE_LABEL[row.id])}|$${num(e.low, 0)}–$${num(e.high, 0)} per MMBtu · typical $${num(e.mid, 0)}">
      <span class="hb-label">${SOURCE_LABEL[row.id]}</span>
      <span class="hb-track"><span class="hb-range ${kind}" data-k="hb.${row.id}.r" style="left:${pct(e.low)};width:calc(${pct(e.high)} - ${pct(e.low)})"></span><span class="hb-dot ${kind}" data-k="hb.${row.id}.d" style="left:${pct(e.mid)}"></span></span>
      <span class="hb-value">${n(`hb.${row.id}`, e.mid, 'c2').replace('.00', '')}</span></li>`
  }).join('')
  const be = breakEven(list, current, utility)
  const hpRate = heatPumpPrice(list, utility)
  const elec = be?.heatPumpPricePerKwh ?? hpRate?.price.range.mid ?? 0
  const standard = list.find(a => a.id === 'price.electricity')?.value.mid ?? 0
  const cop = list.find(a => a.id === 'heat_pump_seasonal_cop')?.value.mid ?? 0
  const lead = cur && hp
    ? `One million Btu of heat from a heat pump costs about ${n('why.hp', hp.perMMBtu.range.mid, 'c2')}, against ${n('why.cur', cur.perMMBtu.range.mid, 'c2')} from ${SOURCE_LABEL[current].toLowerCase()}. ${hp.perMMBtu.range.mid > cur.perMMBtu.range.mid ? 'At these prices, electricity costs more than the heat pump’s efficiency saves.' : 'At these prices, the heat pump’s efficiency wins.'}`
    : ''
  const verdict = be
    ? `<div class="be-grid">
        <div class="be"><span class="be-k">Break-even electricity price</span><span class="be-v">${n('be.p', be.electricityPricePerKwh, 'c2')}<small>/kWh</small></span><span class="be-n">at efficiency ${num(cop, 1)} · now ${fmt(elec, 'c2')}</span></div>
        <div class="be"><span class="be-k">Break-even heat pump efficiency</span><span class="be-v">${n('be.c', be.seasonalCop, 'n1')}</span><span class="be-n">at ${fmt(elec, 'c2')}/kWh · now ${num(cop, 1)}</span></div>
      </div>`
    : ''
  const table = `<details class="data"><summary>Show the numbers as a table</summary><div class="table-wrap"><table>
    <caption>Cost per million Btu (MMBtu) of heat delivered</caption><thead><tr><th scope="col">System</th><th scope="col">Low</th><th scope="col">Typical</th><th scope="col">High</th><th scope="col">Confidence</th></tr></thead>
    <tbody>${rows.map(r => `<tr><th scope="row">${SOURCE_LABEL[r.id]}</th><td>$${num(r.perMMBtu.range.low, 2)}</td><td>$${num(r.perMMBtu.range.mid, 2)}</td><td>$${num(r.perMMBtu.range.high, 2)}</td><td>${CONF[r.perMMBtu.confidence]}</td></tr>`).join('')}</tbody></table></div></details>`
  return `<section class="band" aria-labelledby="h-why"><div class="band-text">
      <h2 id="h-why">The price of one unit of heat</h2><p>${lead}</p>${verdict}
      <p class="muted">${hpRate?.rate === 'seasonal'
        ? `Heat pump electricity is priced at the winter heat pump rate: ${fmt(standard, 'c2')}/kWh standard, ${fmt(elec, 'c2')}/kWh for a heat pump home from November to April. `
        : `${esc(hpRate?.note ?? '')} `}Test your own electricity price (the standard rate), ${fuelName(current)} price or heat pump efficiency in the bar above.</p>
    </div>
    <div class="band-chart"><ol class="hbars" aria-label="Cost per million Btu of heat, by system">${bars}</ol>
      <div class="hb-axis" aria-hidden="true">${ticks.map(t => `<span style="left:${pct(t)}">$${t}</span>`).join('')}</div>
      <p class="legend"><span><span class="swatch fuel"></span>Fuel you buy</span><span><span class="swatch elec"></span>Electricity</span><span class="muted">Bar = low to high · dot = typical · per million Btu delivered</span></p>${table}</div>
  </section>`
}

// ---------- 3. per floor: today vs with heat pumps (HTML stacked bars) ----------

function beforeAfter(r: Report, s: State, v: View): string {
  type Seg = { kind: 'fuel' | 'elec' | 'kept'; value: number; label: string }
  const groups: { unit: Unit; today: Seg[]; after: Seg[]; e: UnitEnergy }[] = []
  for (const e of r.units) {
    const u = s.input.building.units.find(x => x.id === e.unitId)
    if (!u || !e.bills) continue
    const heatPayer = u.heatPaidBy ? PAYER[u.heatPaidBy] : 'unknown payer'
    const elecPayer = v.meter === 'owner' ? 'landlord' : u.electricPaidBy ? PAYER[u.electricPaidBy] : 'unknown payer'
    const kept = e.hotWater?.after === 'boiler' && e.hotWater.fuelCostKept ? e.hotWater.fuelCostKept.range.mid : 0
    const today: Seg[] = [{ kind: 'fuel', value: -e.bills.fuelBill.range.mid, label: `${fuelName(u.heatingFuel)} for heat, ${heatPayer} pays` }]
    const after: Seg[] = [{ kind: 'elec', value: e.bills.electricBill.range.mid, label: `electricity, ${elecPayer} pays` }]
    if (kept > 0) {
      today.push({ kind: 'kept', value: kept, label: `${fuelName(u.heatingFuel)} for hot water, ${heatPayer} pays` })
      after.push({ kind: 'kept', value: kept, label: `${fuelName(u.heatingFuel)} for hot water stays, ${heatPayer} pays` })
    }
    groups.push({ unit: u, today, after, e })
  }
  if (groups.length === 0) return ''
  const max = Math.max(...groups.flatMap(g => [g.today, g.after].map(sg => sg.reduce((a, x) => a + x.value, 0))))
  const step = max > 3000 ? 1000 : 500
  const lim = Math.ceil(max / step) * step
  const pct = (x: number) => `${(x / lim) * 100}%`
  const bar = (segs: Seg[], key: string, label: string) => {
    const total = segs.reduce((a, x) => a + x.value, 0)
    return `<div class="sb"><span class="sb-label">${label}</span><span class="sb-track">${segs.map((sg, i) =>
      `<span class="sb-seg ${sg.kind}" data-k="${key}.${i}" style="width:${pct(sg.value)}" tabindex="0" role="img" aria-label="${esc(cap(sg.label))}: about ${usd(sg.value)} a year" data-tip="${esc(cap(sg.label))}|about ${usd(sg.value)} a year"></span>`).join('')}<span class="sb-total">${n(`${key}.t`, total)}</span></span></div>`
  }
  const body = groups.map(g => `<li class="sb-group" data-floor="${g.unit.id}"><span class="sb-floor">${FLOOR(g.unit.id)}</span>${bar(g.today, `ba${g.unit.id}.today`, 'today')}${bar(g.after, `ba${g.unit.id}.after`, 'heat pumps')}</li>`).join('')
  const ticks = Array.from({ length: lim / step + 1 }, (_, i) => i * step)
  const table = `<details class="data"><summary>Show ranges and who pays</summary><div class="table-wrap"><table>
    <caption>Yearly change by floor and bill (low to high; minus = pays less)</caption><thead><tr><th scope="col">Floor</th><th scope="col">Fuel bill</th><th scope="col">Electric bill</th><th scope="col">Both together</th></tr></thead>
    <tbody>${groups.map(g => { const b = g.e.bills!; const sg = (e: Estimate) => `${e.range.low > 0 ? '+' : e.range.low < 0 ? '−' : ''}${usd(e.range.low)} to ${e.range.high > 0 ? '+' : e.range.high < 0 ? '−' : ''}${usd(e.range.high)}`; return `<tr><th scope="row">${FLOOR(g.unit.id)}</th><td>${sg(b.fuelBill)}</td><td>${sg(b.electricBill)}</td><td>${sg(b.net)}</td></tr>` }).join('')}</tbody></table></div></details>`
  return `<section aria-labelledby="h-floors"><h2 id="h-floors">What each floor spends on heat, today and after</h2>
    <p class="lede">Typical yearly costs. The fuel bill goes away. An electric bill takes its place, often for a different person.</p>
    <ol class="sbars">${body}</ol>
    <div class="sb-axis" aria-hidden="true"><span class="sb-label"></span><span class="sb-ticks">${ticks.map(t => `<span style="left:${pct(t)}">${usd(t)}</span>`).join('')}</span></div>
    <p class="legend"><span><span class="swatch fuel"></span>Heating fuel</span><span><span class="swatch elec"></span>Heat pump electricity</span>${groups.some(g => g.today.length > 1) ? '<span><span class="swatch kept"></span>Hot-water fuel that stays</span>' : ''}</p>${table}</section>`
}

// ---------- 4. fairness ----------

function fairness(r: Report): string {
  const L = r.landlord
  if (!L || L.shiftedToTenants.length === 0) return ''
  const legal = RULES.legal.find(x => x.id === HEAT_COST_SHIFT_CONSTRAINT)
  const total = L.shiftedTotal
  return `<section class="fair" aria-labelledby="h-fair"><h2 id="h-fair">Part of the saving is your tenants’ new electric bill</h2>
    <p class="lede">You pay for oil today. Heat pumps on the tenants’ meters move ${total ? `${between(total.range.low, total.range.high)} a year` : 'heating cost'} onto their bills. The figure at the top already counts that electricity.</p>
    ${legal ? `<p class="law"><strong>${esc(legal.leaseCheck)}</strong> ${esc(legal.summary)} <em>${esc(legal.disclaimer)}</em> Help: ${legal.resources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.section)}</a>`).join(' · ')}</p>` : ''}
    <ol class="options">
      <li><strong>Lower the rent</strong><span>by the monthly amount on each floor.</span></li>
      <li><strong>Electricity allowance</strong><span>of the same size, paid to the tenant.</span></li>
      <li><strong>Owner-paid meter</strong><span>for the heat pumps, so nothing moves.</span></li>
      <li><strong>Agree in writing at renewal</strong><span>and explain the electricity change openly.</span></li>
    </ol>
    <p><button type="button" data-meter="owner">See it with an owner-paid meter</button></p>
    ${L.paybackIfCostShifted ? `<p class="muted">For comparison only: leaving the cost on tenants (which needs a written rental agreement) would give a payback of ${between(L.paybackIfCostShifted.range.low, L.paybackIfCostShifted.range.high, n => num(n, 0))} years.</p>` : ''}
    ${L.projectCommitment.reason ? `<p class="muted">Project commitment terms: ${esc(L.projectCommitment.reason)} Some offers ask the landlord to commit in writing not to raise rent or evict for a period after the incentive.</p>` : ''}
  </section>`
}

// ---------- 5. what to do first ----------

function plan(r: Report): string {
  const shown = r.navigation.shown
  if (r.navigation.steps.length === 0) return ''
  const rank: Record<OfferResult['status'], number> = { eligible: 0, potential: 1, needs_info: 2, not_eligible: 3 }
  const steps = r.navigation.steps.map(st => {
    const results = shown.filter(x => st.offerIds.includes(x.offerId))
    const byOffer = new Map<string, OfferResult[]>()
    for (const x of results) byOffer.set(x.offerId, [...(byOffer.get(x.offerId) ?? []), x])
    const offers = [...byOffer.values()].sort((a, b) => Math.min(...a.map(x => rank[x.status])) - Math.min(...b.map(x => rank[x.status])))
    const items = offers.map(xs => {
      const best = xs.reduce((a, b) => (rank[b.status] < rank[a.status] ? b : a))
      const o = OFFERS.get(`${best.offerId}@${best.version}`)
      const [label, cls] = STATUS[best.status]
      const floors = xs.filter(x => x.unitId !== null).map(x => x.unitId)
      const vals = xs.map(x => x.value).filter((v): v is Estimate => !!v)
      const value = vals.length ? ` · ${o?.qualification === 'up_to' ? 'up to ' : ''}${between(Math.min(...vals.map(v => v.range.low)), Math.max(...vals.map(v => v.range.high)))}${floors.length > 1 ? ' per floor' : ''}` : ''
      const confirm = best.confirmations.map(c => `<li>${esc(c.question)} <span class="muted">${esc(c.decidedBy)}: ${esc(c.nextAction)}</span></li>`).join('')
      const todo = best.prerequisites.filter(p => p.state !== 'done').map(p => `<li>${esc(p.description)}${p.unitsNeeded?.length ? ` <strong>${p.unitsNeeded.length} more unit${p.unitsNeeded.length === 1 ? '' : 's'} needed.</strong>` : ''}</li>`).join('')
      return `<li class="offer"><span class="status" data-s="${cls}">${label}</span> <span class="offer-title">${esc(o?.title ?? best.offerId)}</span><span class="muted">${floors.length ? ` · ${floors.length === 1 ? FLOOR(floors[0] ?? '') : `floors ${floors.join(', ')}`}` : ''}${value}</span>
        ${todo || confirm ? `<details><summary>Before you apply</summary><ul>${todo}${confirm}</ul></details>` : ''}</li>`
    }).join('')
    const after = st.after.length ? `<p class="muted">${st.after.map(a => esc(a.reason)).join(' ')}</p>` : ''
    return `<li class="step"><h3>${MEASURE[st.measure] ?? st.measure}</h3>${after}<ul class="offers">${items}</ul></li>`
  }).join('')
  return `<section aria-labelledby="h-plan"><h2 id="h-plan">What to do, in order</h2>
    <p class="lede">The programs decide eligibility. This shows what their published rules say, and what only they can confirm.</p><ol class="steps">${steps}</ol></section>`
}

// ---------- 6. engineering notes ----------

function engineering(r: Report, s: State): string {
  const cols = r.units.map(e => {
    const u = s.input.building.units.find(x => x.id === e.unitId)
    if (!u) return ''
    const recs = (u.fuelRecords ?? []).map(x => `${num(x.quantity, 0)} ${x.unit}`).join(' / ')
    const chain: string[] = []
    if (recs) chain.push(node('Fuel records', recs, 'two winters, as entered'))
    if (e.heatLoad) chain.push(node('Heat the floor needs', `${between(e.heatLoad.range.low, e.heatLoad.range.high, n => num(n, 0))} MMBtu`, 'normal winter, hot water out', e.heatLoad))
    if (e.bills) chain.push(node('Fuel today', between(-e.bills.fuelBill.range.high, -e.bills.fuelBill.range.low), 'a year'))
    if (e.bills) chain.push(node('Heat pump electricity', between(e.bills.electricBill.range.low, e.bills.electricBill.range.high), 'a year, measured efficiency'))
    if (e.co2) chain.push(node('CO₂', `${num(e.co2.before.range.mid, 1)} → ${num(e.co2.after.range.mid, 1)} t`, 'a year, typical'))
    const cmp = e.comparison ? `<p class="cmp" data-pos="${e.comparison.position}">${esc(e.comparison.message)}</p>` : ''
    const notes = e.notes.map(n => `<p class="muted">${esc(n)}</p>`).join('')
    return `<div class="eng-col" data-floor="${e.unitId}"><h3>${FLOOR(e.unitId)}</h3><ol class="chain">${chain.join('')}</ol>${cmp}${notes}</div>`
  }).join('')
  return `<section aria-labelledby="h-eng"><h2 id="h-eng">How each number is worked out</h2>
    <p class="lede">Each floor’s fuel records are scaled to a normal Massachusetts winter with NOAA degree days. When the boiler also heats water, the hot-water share comes out. The heat pump runs at the efficiency measured in real Massachusetts and New York homes. The full worked example for the demo building is in the <a href="https://github.com/Qiao527/ma-energy-navigator/blob/main/docs/methods.md" target="_blank" rel="noopener">methods write-up</a>.</p>
    <div class="eng">${cols}</div></section>`
}
function node(label: string, value: string, note: string, e?: Estimate): string {
  return `<li><span class="n-label">${label}</span><span class="n-value">${value}</span><span class="n-note">${note}</span>${e ? whyList(e, 'Steps and sources') : ''}</li>`
}

// ---------- 7. questions, contacts, sources ----------

function rest(r: Report): string {
  const qs = r.navigation.questions
  const ids = new Set(r.navigation.shown.flatMap(x => { const o = OFFERS.get(`${x.offerId}@${x.version}`); return o ? [o.programId] : [] }))
  const ps = [...ids].flatMap(id => { const p = PROGRAMS.get(id); return p ? [p] : [] })
  const questions = qs.length ? `<div><h3>Answers that would sharpen this</h3><ul class="plain">${qs.map(q => `<li>${esc(QUESTION[q.fact] ?? q.fact)}${q.unitId ? ` <span class="muted">${FLOOR(q.unitId)}${q.about === 'other_unit' ? ', ask the household' : ''}</span>` : ''}</li>`).join('')}</ul></div>` : ''
  const contacts = ps.length ? `<div><h3>Who to call next</h3><ul class="plain contacts">${ps.map(p => `<li><span>${esc(p.name)}</span><span>${p.handoff.phone ? `<span class="phone">${esc(p.handoff.phone)}</span> · ` : ''}<a href="${esc(p.handoff.url)}" target="_blank" rel="noopener">${esc(p.handoff.label)}</a></span></li>`).join('')}</ul></div>` : ''
  const rows = DATA.assumptions.map(a => `<tr><th scope="row">${esc(a.description)}</th><td class="nowrap">${a.value.low === a.value.high ? a.value.mid : `${a.value.low} / ${a.value.mid} / ${a.value.high}`} <span class="muted">${esc(a.unit)}</span></td><td>${CONF[a.confidence]}</td><td>${a.sources.slice(0, 2).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.section)}</a> <span class="muted">${x.lastVerified}</span>`).join('<br>')}</td></tr>`).join('')
  return `<section class="two" aria-label="Next steps">${questions}${contacts}</section>
    <section aria-labelledby="h-src"><h2 id="h-src" class="small-h">Every number has a source</h2><details class="data"><summary>All ${DATA.assumptions.length} assumptions, with their sources and the date each was checked</summary>
    <div class="table-wrap"><table><caption>Low / typical / high</caption><thead><tr><th scope="col">What</th><th scope="col">Value</th><th scope="col">Confidence</th><th scope="col">Source</th></tr></thead><tbody>${rows}</tbody></table></div></details></section>`
}

export function reportHtml(s: State, v: View): string {
  const { r, error } = compute(s, v)
  if (error || !r) return `<p class="error" role="alert">This building can’t be estimated yet: ${esc(error ?? 'unknown error')}. Check the details in “Edit the building”.</p>`
  return `${hero(r, s, v)}${heatPrice(s, v)}${beforeAfter(r, s, v)}${isLandlord(s) ? fairness(r) : ''}${mapSection(s, v.zoom)}${plan(r)}${engineering(r, s)}${rest(r)}`
}
