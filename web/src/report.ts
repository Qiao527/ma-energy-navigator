import { breakEven, heatCosts, report, type HeatSource, type Report, type UnitEnergy } from '../../engine/src/energy.js'
import type { Estimate } from '../../engine/src/estimate.js'
import type { Unit } from '../../engine/src/facts.js'
import { HEAT_COST_SHIFT_CONSTRAINT } from '../../engine/src/landlord.js'
import type { OfferResult } from '../../engine/src/offers.js'
import { DATA, OFFERS, PROGRAMS, RULES } from './data.js'
import { STORY1 } from './demo.js'
import { CONF, esc, FLOOR, MEASURE, num, PAYER, QUESTION, STATUS, usd } from './format.js'
import { today, type State } from './form.js'
import { mapSection } from './map.js'

export function compute(s: State): { r: Report | null; error: string | null } {
  try {
    const installDate = s.installDate === '' ? null : s.installDate
    return { r: report(s.input, RULES, { asOf: today(), installDate, boilerNeedsReplacing: s.boilerNeedsReplacing }, DATA.assumptions), error: null }
  } catch (e) {
    return { r: null, error: e instanceof Error ? e.message : String(e) }
  }
}

// ---------- small helpers ----------

/** A signed yearly range, e.g. "+$1,800 to +$2,830". Positive = pays more. */
function signed(e: Estimate): string {
  const f = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${usd(v)}`
  return `${f(e.range.low)} to ${f(e.range.high)}`
}
const between = (lo: number, hi: number, f: (n: number) => string = usd): string => (Math.abs(hi - lo) < 1e-9 ? f(lo) : `${f(lo)}–${f(hi)}`)
const confNote = (e: Estimate): string => `<span class="conf" data-level="${e.confidence}">${CONF[e.confidence]}</span>`
function whyList(e: Estimate, label: string): string {
  return `<details class="why"><summary>${label}</summary><ul>${e.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>`
}
function sum(es: (Estimate | null | undefined)[]): Estimate | null {
  const xs = es.filter((e): e is Estimate => !!e)
  if (xs.length === 0) return null
  const order = { low: 0, medium: 1, high: 2 } as const
  return {
    range: { low: xs.reduce((a, e) => a + e.range.low, 0), mid: xs.reduce((a, e) => a + e.range.mid, 0), high: xs.reduce((a, e) => a + e.range.high, 0) },
    confidence: xs.reduce<Estimate['confidence']>((c, e) => (order[e.confidence] < order[c] ? e.confidence : c), 'high'),
    why: [...new Set(xs.flatMap(e => e.why))],
  }
}
const isLandlord = (s: State): boolean => s.input.role === 'owner_occupant_landlord' || s.input.role === 'renting_landlord'

// ---------- 1. the answer, beside the building drawn as an elevation ----------

function headline(r: Report, s: State): { text: string; e: Estimate | null } {
  const L = r.landlord
  if (L?.realSavings) {
    const e = L.realSavings
    if (e.range.low >= 0) return { e, text: `Heat pumps would <em>raise</em> this building’s heating costs by ${between(e.range.low, e.range.high)} a year.` }
    if (e.range.high <= 0) return { e, text: `Heat pumps would <em>cut</em> this building’s heating costs by ${between(-e.range.high, -e.range.low)} a year.` }
    return { e, text: `Heat pumps would land between saving ${usd(-e.range.low)} and paying ${usd(e.range.high)} more a year on heating.` }
  }
  const mine = r.units.find(u => u.unitId === s.input.userUnitId)
  const role = s.input.role === 'tenant' ? 'tenant' : 'owner'
  const e = mine?.split ? (role === 'tenant' ? mine.split.tenant.annual : mine.split.owner.annual) : null
  if (e) {
    const who = role === 'tenant' ? 'your bills' : 'your bills on this floor'
    if (e.range.low >= 0) return { e, text: `With heat pumps, ${who} would go up ${between(e.range.low, e.range.high)} a year.` }
    if (e.range.high <= 0) return { e, text: `With heat pumps, ${who} would go down ${between(-e.range.high, -e.range.low)} a year.` }
    return { e, text: `With heat pumps, ${who} would change by ${signed(e)} a year.` }
  }
  return { e: null, text: 'Tell us how each floor is heated, and who pays which bill, to see who saves and who pays more.' }
}

function keyFigures(r: Report, s: State): string {
  const L = r.landlord
  const out: string[] = []
  if (L && L.shiftedToTenants.length > 0) {
    const lo = Math.min(...L.shiftedToTenants.map(x => x.monthly.range.low))
    const hi = Math.max(...L.shiftedToTenants.map(x => x.monthly.range.high))
    out.push(fig(`${between(lo, hi)}<small>/month</small>`, 'moves onto each tenant’s electric bill, unless you adjust for it', 'shift'))
  }
  if (L) out.push(fig(between(L.netUpfront.range.low, L.netUpfront.range.high), L.incentivesKnown ? `upfront after ${usd(L.incentivesKnown.range.low)}–${usd(L.incentivesKnown.range.high)} in rebates` : 'upfront; rebate amount not known yet', ''))
  if (L && !L.paybackYears && L.realSavings) out.push(fig('No payback', 'running costs don’t fall for sure at today’s prices', ''))
  if (L?.paybackYears) out.push(fig(`${between(L.paybackYears.range.low, L.paybackYears.range.high, n => num(n, 0))}<small> yrs</small>`, 'payback on real savings', ''))
  if (r.co2Total) out.push(fig(`−${between(-r.co2Total.change.range.high, -r.co2Total.change.range.low, n => num(n, 1))}<small> t CO₂/yr</small>`, `from about ${num(r.co2Total.before.range.mid, 0)} t today`, 'co2'))
  void s
  return out.length ? `<dl class="figures">${out.join('')}</dl>` : ''
}
const fig = (value: string, label: string, cls: string): string => `<div class="figure ${cls}"><dt>${label}</dt><dd>${value}</dd></div>`

/** One floor of a triple-decker in elevation: bay window on the left, stacked porch on the right. */
function floorSlice(you: boolean): string {
  return `<svg class="slice" viewBox="0 0 240 104" aria-hidden="true" focusable="false">
    <rect x="40" y="0" width="160" height="104" class="${you ? 'wall you' : 'wall'}"/>
    <path d="M40 14 L20 22 L20 88 L40 96" class="bay"/>
    <rect x="25" y="34" width="10" height="36" class="glass"/>
    <rect x="58" y="28" width="26" height="46" class="glass"/><rect x="100" y="28" width="26" height="46" class="glass"/>
    <rect x="148" y="22" width="30" height="82" class="door"/>
    <path d="M200 0 V104 M236 0 V104 M200 66 H236 M200 74 H236 M209 66 V104 M218 66 V104 M227 66 V104" class="porch"/>
    <line x1="14" y1="104" x2="236" y2="104" class="floorline"/>
  </svg>`
}
const ROOF = `<svg class="slice roof" viewBox="0 0 240 30" aria-hidden="true" focusable="false"><path d="M12 14 H238 V22 H12 Z" class="cornice"/><path d="M40 22 V30 M200 22 V30 M20 22 L28 30 M60 22 V27 M100 22 V27 M140 22 V27 M180 22 V27" class="porch"/></svg>`
const BASE = `<svg class="slice base" viewBox="0 0 240 18" aria-hidden="true" focusable="false"><path d="M20 0 H236 V8 H20 Z" class="foundation"/><path d="M204 8 H232 M208 12 H232 M212 16 H232" class="porch"/></svg>`

function building(r: Report, s: State): string {
  const units = [...s.input.building.units].reverse()
  const L = r.landlord
  const rows = units.map(u => {
    const e = r.units.find(x => x.unitId === u.id)
    const you = s.input.userUnitId === u.id
    const who = u.occupancy === 'owner' ? 'owner' : u.occupancy === 'renter' ? 'rented' : 'occupancy unknown'
    const lines: string[] = []
    if (e?.bills && e.split) {
      const fuelPayer = u.heatPaidBy ? PAYER[u.heatPaidBy] : null
      const elecPayer = u.electricPaidBy ? PAYER[u.electricPaidBy] : null
      if (fuelPayer && fuelPayer === elecPayer) {
        lines.push(line('both', `${fuelPayer === 'landlord' ? 'Landlord' : 'Tenant'} pays both bills`, signed(e.bills.net)))
      } else {
        lines.push(line('fuel', `${fuelPayer ? cap(fuelPayer) : 'Unknown payer'} · ${fuelName(u)} bill`, signed(e.bills.fuelBill)))
        lines.push(line('elec', `${elecPayer ? cap(elecPayer) : 'Unknown payer'} · electric bill`, signed(e.bills.electricBill)))
      }
    }
    const shift = L?.shiftedToTenants.find(x => x.unitId === u.id)
    return `<li class="floor-row${you ? ' is-you' : ''}">
      ${floorSlice(you)}
      <div class="callout">
        <p class="callout-head"><span class="floor-no">${FLOOR(u.id)}</span> ${who}${you ? ' <span class="you">you</span>' : ''}</p>
        ${lines.length ? `<ul>${lines.join('')}</ul>` : '<p class="muted">No estimate yet: add the heating fuel.</p>'}
        ${shift ? `<p class="shift-note">≈ ${usd(shift.monthly.range.mid)} a month of heating moves to this tenant</p>` : ''}
      </div></li>`
  }).join('')
  return `<figure class="elevation" aria-label="The building, floor by floor, with each bill’s yearly change">
    <div class="roof-row">${ROOF}</div><ol class="floors">${rows}</ol><div class="base-row">${BASE}</div>
    <figcaption>Yearly change per bill with heat pumps, low to high. Minus = pays less.</figcaption></figure>`
}
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)
const fuelName = (u: Unit): string => ({ oil: 'oil', natural_gas: 'gas', propane: 'propane', electric_resistance: 'electric' } as Record<string, string>)[u.heatingFuel ?? ''] ?? 'fuel'
function line(kind: 'fuel' | 'elec' | 'both', label: string, value: string): string {
  return `<li><span class="swatch ${kind}" aria-hidden="true"></span><span class="lbl">${label}</span><span class="val">${value}</span></li>`
}

function hero(r: Report, s: State): string {
  const h = headline(r, s)
  const b = s.input.building
  const sheet = [b.municipality || 'Town not set', `${b.units.length} homes`, b.yearBuilt ? `built ${b.yearBuilt}` : null].filter(Boolean).join(' · ')
  return `<section class="hero" aria-labelledby="h-answer">
    <div class="answer">
      <p class="sheet">${esc(sheet)}${s.demo ? ' <span class="demo">demo data</span>' : ''}</p>
      <h2 id="h-answer" class="headline">${h.text}</h2>
      ${h.e ? `<p class="headline-meta">${confNote(h.e)} At Massachusetts statewide prices for winter 2025–26. Your own prices may differ.</p>` : ''}
      ${keyFigures(r, s)}
      ${r.landlordReason ? `<p class="muted">${esc(r.landlordReason)}</p>` : ''}
      <button type="button" class="edit" data-action="edit">Edit the building</button>
    </div>
    ${building(r, s)}
  </section>`
}

// ---------- 2. why: the price of one unit of heat ----------

const SOURCE_LABEL: Record<HeatSource, string> = {
  oil: 'Oil boiler', natural_gas: 'Gas boiler', propane: 'Propane boiler', electric_resistance: 'Electric baseboard', heat_pump: 'Cold-climate heat pump',
}
function heatPrice(s: State): string {
  const rows = heatCosts(DATA.assumptions)
  if (rows.length === 0) return ''
  const current = s.input.building.units.map(u => u.heatingFuel).find(f => f === 'oil' || f === 'natural_gas' || f === 'propane' || f === 'electric_resistance') ?? 'oil'
  const max = Math.max(...rows.map(x => x.perMMBtu.range.high))
  const lim = Math.ceil(max / 10) * 10
  const W = 720, L = 190, R = 70, rowH = 38, top = 10
  const H = top + rows.length * rowH + 34
  const x = (v: number) => L + (v / lim) * (W - L - R)
  const ticks = Array.from({ length: lim / 10 + 1 }, (_, i) => i * 10)
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="hp-t hp-d">
    <title id="hp-t">What one million Btu of heat costs, by heating system</title>
    <desc id="hp-d">Each bar spans the low to high cost; the dot is the typical cost. The table below lists the same values.</desc>
    ${ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${H - 26}" class="${v === 0 ? 'axis' : 'grid'}"/><text x="${x(v)}" y="${H - 8}" class="tick" text-anchor="middle">$${v}</text>`).join('')}
    ${rows.map((row, i) => {
      const y = top + i * rowH + rowH / 2
      const kind = row.id === 'heat_pump' || row.id === 'electric_resistance' ? 'elec' : 'fuel'
      const em = row.id === current || row.id === 'heat_pump'
      return `<g class="hp-row${em ? ' em' : ''}" tabindex="0"><title>${SOURCE_LABEL[row.id]}: $${num(row.perMMBtu.range.low, 0)}–$${num(row.perMMBtu.range.high, 0)} per MMBtu, typical $${num(row.perMMBtu.range.mid, 0)}</title>
        <rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" class="hit"/>
        <text x="${L - 12}" y="${y + 4}" text-anchor="end" class="row-label">${SOURCE_LABEL[row.id]}</text>
        <rect x="${x(row.perMMBtu.range.low)}" y="${y - 4}" width="${Math.max(3, x(row.perMMBtu.range.high) - x(row.perMMBtu.range.low))}" height="8" rx="4" class="range ${kind}"/>
        <circle cx="${x(row.perMMBtu.range.mid)}" cy="${y}" r="6" class="dot ${kind}"/>
        <text x="${x(row.perMMBtu.range.high) + 10}" y="${y + 4}" class="row-value">$${num(row.perMMBtu.range.mid, 0)}</text></g>`
    }).join('')}
  </svg>`
  const be = breakEven(DATA.assumptions, current)
  const cur = rows.find(r => r.id === current)
  const hp = rows.find(r => r.id === 'heat_pump')
  const lead = cur && hp
    ? hp.perMMBtu.range.mid > cur.perMMBtu.range.mid
      ? `A unit of heat from a heat pump costs about <strong>$${num(hp.perMMBtu.range.mid, 0)}</strong>, versus <strong>$${num(cur.perMMBtu.range.mid, 0)}</strong> from ${SOURCE_LABEL[current].toLowerCase()}. Electricity here is expensive enough to outweigh the heat pump’s efficiency.`
      : `A unit of heat from a heat pump costs about <strong>$${num(hp.perMMBtu.range.mid, 0)}</strong>, versus <strong>$${num(cur.perMMBtu.range.mid, 0)}</strong> from ${SOURCE_LABEL[current].toLowerCase()}.`
    : ''
  const table = `<details class="data"><summary>Show the numbers as a table</summary><div class="table-wrap"><table>
    <caption>Cost per million Btu (MMBtu) of heat delivered</caption><thead><tr><th scope="col">System</th><th scope="col">Low</th><th scope="col">Typical</th><th scope="col">High</th><th scope="col">Confidence</th></tr></thead>
    <tbody>${rows.map(r => `<tr><th scope="row">${SOURCE_LABEL[r.id]}</th><td>$${num(r.perMMBtu.range.low, 2)}</td><td>$${num(r.perMMBtu.range.mid, 2)}</td><td>$${num(r.perMMBtu.range.high, 2)}</td><td>${CONF[r.perMMBtu.confidence]}</td></tr>`).join('')}</tbody></table></div></details>`
  return `<section class="band" aria-labelledby="h-why"><div class="band-text">
      <p class="kicker">Why</p><h2 id="h-why">The price of one unit of heat</h2>
      <p>${lead}</p>
      ${be ? `<p class="breakeven">A heat pump matches ${SOURCE_LABEL[current].toLowerCase()} when electricity costs <strong>$${num(be.electricityPricePerKwh, 2)}/kWh</strong> at today’s measured efficiency, or when the heat pump reaches a seasonal efficiency of <strong>${num(be.seasonalCop, 1)}</strong> at today’s $${num(DATA.assumptions.find(a => a.id === 'price.electricity')?.value.mid ?? 0, 2)}/kWh. The new winter heat pump rate lowers delivery charges and is not counted here yet.</p>` : ''}
    </div>
    <div class="band-chart">${svg}<p class="legend"><span><span class="swatch fuel"></span>Fuel you buy</span><span><span class="swatch elec"></span>Electricity</span><span class="muted">Bar = low to high · dot = typical · per million Btu delivered</span></p>${table}</div>
  </section>`
}

// ---------- 3. per floor: today vs with heat pumps ----------

function beforeAfter(r: Report, s: State): string {
  type Seg = { kind: 'fuel' | 'elec' | 'kept'; value: number; label: string }
  const groups: { unit: Unit; today: Seg[]; after: Seg[]; e: UnitEnergy }[] = []
  for (const e of r.units) {
    const u = s.input.building.units.find(x => x.id === e.unitId)
    if (!u || !e.bills) continue
    const heatPayer = u.heatPaidBy ? PAYER[u.heatPaidBy] : 'unknown payer'
    const elecPayer = u.electricPaidBy ? PAYER[u.electricPaidBy] : 'unknown payer'
    const kept = e.hotWater?.after === 'boiler' && e.hotWater.fuelCostKept ? e.hotWater.fuelCostKept.range.mid : 0
    const today: Seg[] = [{ kind: 'fuel', value: -e.bills.fuelBill.range.mid, label: `${fuelName(u)} for heat · ${heatPayer}` }]
    const after: Seg[] = [{ kind: 'elec', value: e.bills.electricBill.range.mid, label: `electricity · ${elecPayer}` }]
    if (kept > 0) {
      today.push({ kind: 'kept', value: kept, label: `${fuelName(u)} for hot water · ${heatPayer}` })
      after.push({ kind: 'kept', value: kept, label: `${fuelName(u)} for hot water, stays · ${heatPayer}` })
    }
    groups.push({ unit: u, today, after, e })
  }
  if (groups.length === 0) return ''
  const max = Math.max(...groups.flatMap(g => [g.today, g.after].map(seg => seg.reduce((a, x) => a + x.value, 0))))
  const step = max > 3000 ? 1000 : 500
  const lim = Math.ceil(max / step) * step
  const W = 720, L = 120, R = 16, barH = 13, gap = 5, groupGap = 24, top = 8
  const H = top + groups.length * (2 * barH + gap + groupGap) + 28
  const x = (v: number) => L + (v / lim) * (W - L - R)
  const bar = (segs: Seg[], y: number, label: string) => {
    let acc = 0
    const rects = segs.map(sg => {
      const x0 = x(acc), x1 = x(acc + sg.value)
      acc += sg.value
      return `<rect x="${x0 + (x0 > L ? 1 : 0)}" y="${y}" width="${Math.max(1, x1 - x0 - (x0 > L ? 1 : 0))}" height="${barH}" rx="${x0 > L ? 0 : 3}" class="seg ${sg.kind}"><title>${esc(sg.label)}: about ${usd(sg.value)} a year</title></rect>`
    }).join('')
    return `<text x="${L - 10}" y="${y + barH - 4}" text-anchor="end" class="bar-label">${label}</text>${rects}<text x="${x(acc) + 8}" y="${y + barH - 4}" class="bar-value">${usd(acc)}</text>`
  }
  let y = top
  const body = groups.map(g => {
    const out = `<text x="0" y="${y + barH - 4}" class="group-label">${FLOOR(g.unit.id)}</text>${bar(g.today, y, 'today')}${bar(g.after, y + barH + gap, 'heat pumps')}`
    y += 2 * barH + gap + groupGap
    return out
  }).join('')
  const ticks = Array.from({ length: lim / step + 1 }, (_, i) => i * step)
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ba-t ba-d">
    <title id="ba-t">Yearly heating cost per floor, today and with heat pumps</title>
    <desc id="ba-d">For each floor, the top bar is today’s heating fuel and the lower bar is the heat pumps’ electricity, at typical values. The table below gives low to high ranges and who pays.</desc>
    ${ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${top - 4}" y2="${H - 24}" class="${v === 0 ? 'axis' : 'grid'}"/><text x="${x(v)}" y="${H - 6}" class="tick" text-anchor="middle">${usd(v)}</text>`).join('')}
    ${body}</svg>`
  const table = `<details class="data"><summary>Show ranges and who pays</summary><div class="table-wrap"><table>
    <caption>Yearly change by floor and bill (low to high; minus = pays less)</caption><thead><tr><th scope="col">Floor</th><th scope="col">Fuel bill</th><th scope="col">Electric bill</th><th scope="col">Both together</th></tr></thead>
    <tbody>${groups.map(g => `<tr><th scope="row">${FLOOR(g.unit.id)}</th><td>${signed(g.e.bills!.fuelBill)}<br><span class="muted">${g.unit.heatPaidBy ? PAYER[g.unit.heatPaidBy] : 'unknown payer'}</span></td><td>${signed(g.e.bills!.electricBill)}<br><span class="muted">${g.unit.electricPaidBy ? PAYER[g.unit.electricPaidBy] : 'unknown payer'}</span></td><td>${signed(g.e.bills!.net)}</td></tr>`).join('')}</tbody></table></div></details>`
  return `<section aria-labelledby="h-floors"><p class="kicker">Floor by floor</p><h2 id="h-floors">What each floor spends on heat, today and after</h2>
    <p class="lede">Typical values. The fuel bill disappears and an electric bill appears, often for a different person.</p>
    ${svg}<p class="legend"><span><span class="swatch fuel"></span>Heating fuel</span><span><span class="swatch elec"></span>Heat pump electricity</span>${groups.some(g => g.today.length > 1) ? '<span><span class="swatch kept"></span>Hot-water fuel that stays</span>' : ''}</p>${table}</section>`
}

// ---------- 4. fairness ----------

function fairness(r: Report): string {
  const L = r.landlord
  if (!L || L.shiftedToTenants.length === 0) return ''
  const legal = RULES.legal.find(x => x.id === HEAT_COST_SHIFT_CONSTRAINT)
  const total = L.shiftedTotal
  return `<section class="fair" aria-labelledby="h-fair"><p class="kicker">Fairness</p><h2 id="h-fair">Part of the saving is your tenants’ new electric bill</h2>
    <p class="lede">You pay for oil today. Heat pumps on the tenants’ meters move ${total ? `${between(total.range.low, total.range.high)} a year` : 'heating cost'} onto their bills. Your real energy change is the figure at the top, which already includes that electricity.</p>
    ${legal ? `<p class="law"><strong>${esc(legal.leaseCheck)}</strong> ${esc(legal.summary)} <em>${esc(legal.disclaimer)}</em> Help: ${legal.resources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.section)}</a>`).join(' · ')}</p>` : ''}
    <ol class="options">
      <li><strong>Lower the rent</strong><span>by the monthly amount on each floor.</span></li>
      <li><strong>Electricity allowance</strong><span>of the same size, paid to the tenant.</span></li>
      <li><strong>Owner-paid meter</strong><span>for the heat pumps, so nothing moves.</span></li>
      <li><strong>Agree in writing at renewal</strong><span>with the change explained openly, never slipped in.</span></li>
    </ol>
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
  return `<section aria-labelledby="h-plan"><p class="kicker">Plan</p><h2 id="h-plan">What to do, in order</h2>
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
    return `<div class="eng-col"><h3>${FLOOR(e.unitId)}</h3><ol class="chain">${chain.join('')}</ol>${cmp}${notes}</div>`
  }).join('')
  return `<section aria-labelledby="h-eng"><p class="kicker">Method</p><h2 id="h-eng">How each number is worked out</h2>
    <p class="lede">Fuel records are scaled to a normal Massachusetts winter with NOAA heating degree days, the hot-water share is taken out when the boiler heats water, and the heat pump runs at efficiency measured in Massachusetts and New York homes.</p>
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

export function reportHtml(s: State): string {
  const { r, error } = compute(s)
  if (error || !r) return `<p class="error" role="alert">This building can’t be estimated yet: ${esc(error ?? 'unknown error')}. Check the details in “Edit the building”.</p>`
  return `${hero(r, s)}${heatPrice(s)}${beforeAfter(r, s)}${isLandlord(s) ? fairness(r) : ''}${mapSection(s)}${plan(r)}${engineering(r, s)}${rest(r)}`
}

export const DEMO_STORY = STORY1.story
