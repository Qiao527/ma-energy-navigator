import { DATA } from './data.js'
import { blankState, demoState, formHtml, setPath, type Kind, type State } from './form.js'
import { DEFAULT_VIEW, compute, fmt, mainFuel, reportHtml, type View } from './report.js'
import { confirmReplacement, missing, renderAnswer, reviewFacts, type Extracted, type Presentation } from './assistant.js'
import { hasUnestimatedWater } from './shift.js'

let state: State = demoState()
let view: View = structuredClone(DEFAULT_VIEW)

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const dialog = $<HTMLDialogElement>('editor')
const formEl = $<HTMLFormElement>('form')
const reportEl = $<HTMLElement>('report')
const liveEl = $<HTMLElement>('live')
const tip = $<HTMLElement>('tip')
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

// ---------- what-if controls (one row that scopes everything below) ----------

const statewide = (id: string): number => DATA.assumptions.find(a => a.id === id)?.value.mid ?? 0
const FUEL_CTL: Record<string, { id: string; label: string; min: number; max: number; step: number; unit: string }> = {
  oil: { id: 'price.oil', label: 'Heating oil', min: 2, max: 5, step: 0.05, unit: '/gal' },
  natural_gas: { id: 'price.natural_gas', label: 'Natural gas', min: 1, max: 3.5, step: 0.05, unit: '/therm' },
  propane: { id: 'price.propane', label: 'Propane', min: 2, max: 5, step: 0.05, unit: '/gal' },
}
const elec = $<HTMLInputElement>('wi-elec')
const fuel = $<HTMLInputElement>('wi-fuel')
const cop = $<HTMLInputElement>('wi-cop')
const val = (id: string): number => view.whatIf[id] ?? statewide(id)

function syncControls(): void {
  const f = FUEL_CTL[mainFuel(state)]
  elec.value = String(val('price.electricity'))
  $('wi-elec-o').textContent = `$${val('price.electricity').toFixed(2)}/kWh`
  elec.setAttribute('aria-valuetext', `${val('price.electricity').toFixed(2)} dollars per kilowatt-hour`)
  cop.value = String(val('heat_pump_seasonal_cop'))
  $('wi-cop-o').textContent = val('heat_pump_seasonal_cop').toFixed(1)
  cop.setAttribute('aria-valuetext', `seasonal efficiency ${val('heat_pump_seasonal_cop').toFixed(1)}`)
  const fuelCtl = $('wi-fuel-ctl')
  fuelCtl.hidden = !f
  if (f) {
    $('wi-fuel-l').textContent = f.label
    Object.assign(fuel, { min: String(f.min), max: String(f.max), step: String(f.step) })
    fuel.value = String(val(f.id))
    fuel.dataset.id = f.id
    $('wi-fuel-o').textContent = `$${val(f.id).toFixed(2)}${f.unit}`
    fuel.setAttribute('aria-valuetext', `${val(f.id).toFixed(2)} dollars per ${f.unit === '/gal' ? 'gallon' : 'therm'}`)
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('#whatif [data-meter]')) b.setAttribute('aria-pressed', String(b.dataset.meter === view.meter))
  $('wi-reset').hidden = Object.keys(view.whatIf).length === 0 && view.meter === 'unit'
}

let pending = 0
function onSlide(id: string, value: number): void {
  view.whatIf[id] = value
  if (Math.abs(value - statewide(id)) < 1e-9) delete view.whatIf[id]
  cancelAnimationFrame(pending)
  pending = requestAnimationFrame(() => render())
}
elec.addEventListener('input', () => onSlide('price.electricity', Number(elec.value)))
cop.addEventListener('input', () => onSlide('heat_pump_seasonal_cop', Number(cop.value)))
fuel.addEventListener('input', () => onSlide(fuel.dataset.id ?? 'price.oil', Number(fuel.value)))
$('wi-reset').addEventListener('click', () => { view.whatIf = {}; view.meter = 'unit'; render() })

// ---------- render with continuity: bars glide, numbers count, the map pans ----------

interface Snap { style: string | null; cls: string; v: number | null; vb: string | null }
function snapshot(): Map<string, Snap> {
  const m = new Map<string, Snap>()
  for (const el of reportEl.querySelectorAll<HTMLElement | SVGElement>('[data-k]')) {
    m.set(el.dataset.k ?? '', { style: el.getAttribute('style'), cls: el.getAttribute('class') ?? '', v: el.dataset.v ? Number(el.dataset.v) : null, vb: el.getAttribute('viewBox') })
  }
  return m
}
function tween(ms: number, step: (t: number) => void): void {
  const t0 = performance.now()
  const ease = (t: number) => 1 - Math.pow(1 - t, 3)
  const frame = (now: number) => {
    const t = Math.min(1, (now - t0) / ms)
    step(ease(t))
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
function play(old: Map<string, Snap>): void {
  const later: (() => void)[] = []
  for (const el of reportEl.querySelectorAll<HTMLElement | SVGElement>('[data-k]')) {
    const o = old.get(el.dataset.k ?? '')
    if (!o) continue
    const v = el.dataset.v ? Number(el.dataset.v) : null
    if (v !== null && o.v !== null && Math.abs(v - o.v) > 1e-9) {
      const f = (el.dataset.f ?? 'usd') as Parameters<typeof fmt>[1]
      const from = o.v
      tween(450, t => { el.textContent = fmt(from + (v - from) * t, f) })
    }
    const style = el.getAttribute('style')
    if (o.style !== null && style !== null && o.style !== style && !el.hasAttribute('viewBox')) {
      el.setAttribute('style', o.style)
      later.push(() => el.setAttribute('style', style))
    }
    const cls = el.getAttribute('class') ?? ''
    if (o.cls !== cls) {
      el.setAttribute('class', o.cls)
      later.push(() => el.setAttribute('class', cls))
    }
    const vb = el.getAttribute('viewBox')
    if (vb && o.vb && vb !== o.vb) {
      const a = o.vb.split(' ').map(Number), b = vb.split(' ').map(Number)
      const za = Number(old.get('map')?.style?.match(/--z:([\d.]+)/)?.[1] ?? 1), zb = Number(el.getAttribute('data-z') ?? 1)
      el.setAttribute('viewBox', o.vb)
      tween(650, t => {
        el.setAttribute('viewBox', a.map((x, i) => x + ((b[i] ?? x) - x) * t).join(' '))
        ;(el as SVGElement).style.setProperty('--z', String(za + (zb - za) * t))
      })
    }
  }
  if (later.length) requestAnimationFrame(() => requestAnimationFrame(() => later.forEach(f => f())))
}

let announceTimer = 0
function render(announce = true): void {
  $('ai-answer').textContent = ''
  const old = snapshot()
  reportEl.innerHTML = reportHtml(state, view)
  if (!reduced.matches) play(old)
  syncControls()
  $('edit-top').textContent = state.demo ? 'Check your building' : 'Edit your building'
  if (announce) {
    clearTimeout(announceTimer)
    announceTimer = window.setTimeout(() => { liveEl.textContent = document.getElementById('h-answer')?.textContent ?? '' }, 900)
  }
}
// The sticky what-if bar must never cover the focused control (WCAG 2.4.11).
const sticky = (): void => document.documentElement.style.setProperty('--sticky', `${($('whatif').getBoundingClientRect().height || 0) + 16}px`)
window.addEventListener('resize', sticky)
function renderForm(): void { formEl.innerHTML = formHtml(state) }
// Phones: the what-if controls fold away so the answer comes first.
const wiToggle = $<HTMLButtonElement>('wi-toggle')
wiToggle.addEventListener('click', () => {
  const open = $('whatif').classList.toggle('open')
  wiToggle.setAttribute('aria-expanded', String(open))
  wiToggle.textContent = open ? 'Hide the price controls ▴' : 'Try your own prices ▾'
})

// ---------- report interactions ----------

reportEl.addEventListener('click', e => {
  const t = e.target as HTMLElement
  const b = t.closest<HTMLButtonElement>('button[data-mode], button[data-meter], button[data-zoom]')
  if (!b) return
  if (b.dataset.mode) view.mode = b.dataset.mode as View['mode']
  if (b.dataset.meter) view.meter = b.dataset.meter as View['meter']
  if (b.dataset.zoom) view.zoom = b.dataset.zoom as View['zoom']
  // Re-rendering replaces the button; put focus back on its replacement (WCAG 2.4.3).
  const sel = b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : b.dataset.zoom ? `[data-zoom="${b.dataset.zoom}"]` : b.dataset.meter ? `button[data-meter="${b.dataset.meter}"]` : null
  render()
  if (sel) (reportEl.querySelector<HTMLElement>(sel) ?? (b.dataset.meter ? document.querySelector<HTMLElement>(`#whatif [data-meter="${b.dataset.meter}"]`) : null))?.focus()
})
document.querySelectorAll<HTMLButtonElement>('#whatif [data-meter]').forEach(b =>
  b.addEventListener('click', () => { view.meter = b.dataset.meter as View['meter']; render() }))

// One floor, highlighted everywhere it appears.
function highlight(id: string | null): void {
  for (const el of reportEl.querySelectorAll<HTMLElement>('[data-floor]')) el.classList.toggle('dim', id !== null && el.dataset.floor !== id)
}
reportEl.addEventListener('pointerover', e => highlight((e.target as HTMLElement).closest<HTMLElement>('[data-floor]')?.dataset.floor ?? null))
reportEl.addEventListener('pointerleave', () => highlight(null))
reportEl.addEventListener('focusin', e => highlight((e.target as HTMLElement).closest<HTMLElement>('[data-floor]')?.dataset.floor ?? null))
reportEl.addEventListener('focusout', () => highlight(null))

// One tooltip for every mark: value first, then what it is. Text only, never HTML.
function showTip(el: Element, x: number, y: number): void {
  const [label, value] = (el.getAttribute('data-tip') ?? '').split('|')
  tip.replaceChildren()
  const v = document.createElement('strong'); v.textContent = value ?? ''
  const l = document.createElement('span'); l.textContent = label ?? ''
  tip.append(v, l)
  tip.hidden = false
  const r = tip.getBoundingClientRect()
  tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14))}px`
  tip.style.top = `${Math.max(8, y - r.height - 12)}px`
}
reportEl.addEventListener('pointermove', e => {
  const el = (e.target as Element).closest('[data-tip]')
  if (el) showTip(el, e.clientX, e.clientY)
  else tip.hidden = true
})
reportEl.addEventListener('pointerleave', () => { tip.hidden = true })
reportEl.addEventListener('focusin', e => {
  const el = (e.target as Element).closest('[data-tip]')
  if (!el) { tip.hidden = true; return }
  const r = el.getBoundingClientRect()
  showTip(el, r.left + r.width / 2, r.top)
})
reportEl.addEventListener('focusout', () => { tip.hidden = true })
document.addEventListener('keydown', e => { if (e.key === 'Escape') tip.hidden = true })

// ---------- editor drawer ----------

formEl.addEventListener('submit', e => { e.preventDefault(); dialog.close() })
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
  render()
})
formEl.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
  if (!b) return
  state = b.dataset.action === 'demo' ? demoState() : blankState()
  view = structuredClone(DEFAULT_VIEW)
  renderForm()
  render()
  document.getElementById(b.dataset.action === 'demo' ? 'role' : 'town')?.focus()
})
document.addEventListener('click', e => { if ((e.target as HTMLElement).closest('[data-action="edit"]')) dialog.showModal() })
$('close').addEventListener('click', () => dialog.close())


// ---------- AI assistant: no model output reaches calculations before confirmation ----------
let extracted: Extracted | null = null
const aiInput = $<HTMLTextAreaElement>('ai-input')
const aiKey = $<HTMLInputElement>('ai-key')
aiKey.value = ''
const aiStatus = $('ai-status')
const aiReview = $('ai-review')
const aiReviewSection = $('ai-review-section')
const aiAnswer = $('ai-answer')
const aiConfirm = $<HTMLButtonElement>('ai-confirm')
const aiAvailable = location.hostname !== 'qiao527.github.io' && location.protocol !== 'file:'
const setAiBusy = (busy: boolean): void => {
  $<HTMLButtonElement>('ai-extract').disabled = busy || !aiAvailable
  $<HTMLButtonElement>('ai-explain').disabled = busy || !aiAvailable
}
if (!aiAvailable) {
  $<HTMLButtonElement>('ai-extract').disabled = true
  $<HTMLButtonElement>('ai-explain').disabled = true
  aiStatus.textContent = 'AI preview is available locally. See the project README for setup.'
}
aiInput.addEventListener('input', () => { extracted = null; aiConfirm.hidden = true; aiReviewSection.hidden = true; aiReview.replaceChildren(); if (aiAvailable) aiStatus.textContent = '' })
async function aiRequest(path: string, text: string): Promise<unknown> {
  const key = aiKey.value.trim()
  if (!key) { $<HTMLDetailsElement>('ai-key-settings').open = true; aiKey.focus(); throw new Error('Enter your API key to use live AI, or explore the example report below.') }
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key }, body: JSON.stringify({ text }) })
  if (!response.ok) throw new Error('Live AI is unavailable. Check your API key and balance, then try again, or use the form instead.')
  return response.json()
}
$('ai-extract').addEventListener('click', async () => {
  const text = aiInput.value.trim()
  if (!text) { aiStatus.textContent = 'Describe your building first.'; return }
  extracted = null; aiConfirm.hidden = true; aiReviewSection.hidden = true; aiReview.replaceChildren(); aiStatus.textContent = 'Reading what you wrote…'
  setAiBusy(true)
  try {
    const result = await aiRequest('/api/intake', text) as Extracted
    if (aiInput.value.trim() !== text) return
    extracted = result
    for (const [label, value] of reviewFacts(result)) {
      const term = document.createElement('dt'); term.textContent = label
      const detail = document.createElement('dd'); detail.textContent = value
      aiReview.append(term, detail)
    }
    aiReviewSection.hidden = false
    const needed = missing(result)
    aiStatus.textContent = needed.length ? `To get started, please add: ${needed.join(', ')}. Then select “Review what I wrote” again.` : 'Please check the details below before continuing.'
    aiConfirm.hidden = needed.length > 0
  } catch (e) { aiStatus.textContent = e instanceof Error ? e.message : 'The assistant is unavailable.' }
  finally { setAiBusy(false) }
})
aiConfirm.addEventListener('click', () => {
  if (!extracted) return
  const replacement = confirmReplacement(extracted, message => window.confirm(message))
  if (!replacement) return
  state = replacement
  view = structuredClone(DEFAULT_VIEW)
  extracted = null; aiConfirm.hidden = true; aiReviewSection.hidden = true; aiReview.replaceChildren()
  aiAnswer.textContent = ''; aiStatus.textContent = 'Details added. Review the form and fill in anything still unknown.'
  renderForm(); render(); dialog.showModal()
  document.getElementById('role')?.focus()
})
$('ai-explain').addEventListener('click', async () => {
  const before = JSON.stringify({ state, view })
  const text = aiInput.value.trim() || 'Explain the report and help me coordinate with the other people in the building.'
  aiStatus.textContent = 'Preparing an explanation…'; aiAnswer.textContent = ''
  setAiBusy(true)
  try {
    const presentation = await aiRequest('/api/presentation', text) as Presentation
    if (before !== JSON.stringify({ state, view })) { aiStatus.textContent = 'The report changed. Please request a new explanation.'; return }
    if (!['cost', 'coordination'].includes(presentation.focus) || !['warm', 'direct'].includes(presentation.tone)) throw new Error('Invalid assistant response.')
    const { r } = compute(state, view)
    if (!r) throw new Error('Complete the building form before requesting an explanation.')
    aiAnswer.textContent = renderAnswer(r, state.input.role, presentation, state.demo, hasUnestimatedWater(state.input, r.units))
    aiStatus.textContent = 'Explanation ready. Numbers come from the current report; check the draft before sending.'
  } catch (e) { aiStatus.textContent = e instanceof Error ? e.message : 'The assistant is unavailable.' }
  finally { setAiBusy(false) }
})

if (DATA.status.previewDrafts) {
  const bar = $('preview')
  bar.hidden = false
  bar.textContent = `Preview with draft rules not yet approved (${DATA.status.pendingDrafts.length} files). Not for decisions.`
}
$('built').textContent = DATA.status.builtOn
renderForm()
render(false)
sticky()
