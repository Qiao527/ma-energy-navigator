import type { Report } from '../../engine/src/energy.js'
import type { LegalConstraint } from '../../engine/src/rules-schema.js'
import type { State } from './form.js'
import { esc, num, usd } from './format.js'
import { fairnessState, hasUnestimatedWater } from './shift.js'

const between = (lo: number, hi: number, format: (value: number) => string = usd): string =>
  Math.abs(hi - lo) < 1e-9 ? format(lo) : `${format(lo)}–${format(hi)}`

// ---------- 4. fairness ----------

export function fairness(r: Report, s: State, legal: LegalConstraint | undefined): string {
  const L = r.landlord
  if (!L) return ''
  const status = fairnessState(L, hasUnestimatedWater(s.input, r.units))
  if (status === 'unknown') return `<section class="fair" aria-labelledby="h-fair"><h2 id="h-fair">Check how bills could change for tenants</h2>
    <p class="lede">We can’t estimate the full cost moved to tenants yet. Check who pays each bill and any hot-water changes that could not be estimated.</p></section>`
  if (status === 'none') return ''
  const total = L.shiftedTotal
  const intro = status === 'partial'
    ? 'Some known costs may move to tenants, but the full amount is unknown because some bill payers or hot-water changes are not yet accounted for.'
    : `Changes to heating and hot water could add ${total ? `${between(total.range.low, total.range.high)} a year` : 'electricity costs'} to tenants’ bills where the owner currently pays for fuel. The figure at the top already counts that electricity.`
  return `<section class="fair" aria-labelledby="h-fair"><h2 id="h-fair">Heating changes can affect your tenants’ bills</h2>
    <p class="lede">${intro}</p>
    ${legal ? `<p class="law"><strong>${esc(legal.leaseCheck)}</strong> ${esc(legal.summary)} <em>${esc(legal.disclaimer)}</em> Help: ${legal.resources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.section)}</a>`).join(' · ')}</p>` : ''}
    <ol class="options">
      <li><strong>Lower the rent</strong><span>Discuss a fair amount with each affected household.</span></li>
      <li><strong>Electricity allowance</strong><span>Discuss an allowance with each affected household.</span></li>
      <li><strong>Owner-paid meter</strong><span>for the heat pumps, to avoid shifting those costs.</span></li>
      <li><strong>Agree in writing at renewal</strong><span>and explain the electricity change openly.</span></li>
    </ol>
    <p><button type="button" data-meter="owner">See it with an owner-paid meter</button></p>
    ${status !== 'partial' && L.paybackIfCostShifted ? `<p class="muted">For comparison only: leaving the cost on tenants (which needs a written rental agreement) would give a payback of ${between(L.paybackIfCostShifted.range.low, L.paybackIfCostShifted.range.high, n => num(n, 0))} years.</p>` : ''}
    ${L.projectCommitment.reason ? `<p class="muted">Project commitment terms: ${esc(L.projectCommitment.reason)} Some offers ask the landlord to commit in writing not to raise rent or evict for a period after the incentive.</p>` : ''}
  </section>`
}
