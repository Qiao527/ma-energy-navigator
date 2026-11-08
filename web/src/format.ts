import type { Estimate } from '../../engine/src/estimate.js'
import type { OfferResult } from '../../engine/src/offers.js'


export const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
export function usd(n: number): string {
  const a = Math.abs(n)
  const r = a >= 10000 ? Math.round(a / 100) * 100 : a >= 100 ? Math.round(a / 10) * 10 : Math.round(a)
  return `$${r.toLocaleString('en-US')}`
}
export const num = (n: number, d = 1): string => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
export const CONF: Record<Estimate['confidence'], string> = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' }

/** A yearly bill change (positive = pays more), in words that never hide which way it goes. */
export function change(e: Estimate, per = 'a year'): string {
  const { low, high } = e.range
  if (high <= 0) return `saves ${usd(-high)}–${usd(-low)} ${per}`
  if (low >= 0) return `pays ${usd(low)}–${usd(high)} more ${per}`
  return `between saving ${usd(-low)} and paying ${usd(high)} more ${per}`
}
export const typical = (e: Estimate): string => (e.range.mid <= 0 ? `typically saves ${usd(-e.range.mid)}` : `typically ${usd(e.range.mid)} more`)
export const conf = (e: Estimate): string => `<span class="conf conf-${e.confidence}">${CONF[e.confidence]}</span>`
export function why(e: Estimate, label = 'Why this range'): string {
  return `<details class="why"><summary>${label}</summary><ul>${e.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>`
}
export const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`

export const FLOOR = (id: string): string => `Floor ${id}`
export const PAYER: Record<string, string> = { owner: 'landlord', tenant: 'tenant' }
export const MEASURE: Record<string, string> = {
  assessment: 'Home energy assessment', weatherization: 'Insulation and air sealing', heat_pump: 'Heat pumps',
  financing: '0% financing', bill_assistance: 'Bill help', rooftop_solar: 'Rooftop solar', community_solar: 'Community solar', tax_credit: 'State tax credit',
}
export const STATUS: Record<OfferResult['status'], [string, string]> = {
  eligible: ['Qualifies', 'ok'], potential: ['Likely', 'maybe'], needs_info: ['Needs an answer', 'ask'], not_eligible: ['Not eligible', 'no'],
}
export const QUESTION: Record<string, string> = {
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

