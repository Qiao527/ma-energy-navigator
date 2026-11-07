import { RULES } from './data.js'
import { esc } from './format.js'
import type { State } from './form.js'
import towns from './ma-towns.json'

/**
 * MassCEC Home Modernization Navigator pilot cities (docs/product.md §1, facts checked 2026-11-06).
 * Shown as a pilot: Mass Save and CAP agencies serve the whole state.
 */
const PILOT = ['Lowell', 'Springfield', 'Chelsea', 'Lynn', 'Framingham', 'Taunton']
const PILOT_SOURCES = [
  { label: 'MassCEC navigator program', url: 'https://www.masscec.com/program/home-modernization-navigator-program' },
  { label: 'MassCEC expansion, Dec. 2025', url: 'https://www.masscec.com/press/masscec-expands-no-cost-service-help-more-residents-reduce-energy-costs-and-modernize-their' },
]
const DEC_SOURCE = RULES.dec.sources[0]

export function mapSection(s: State): string {
  const dec = new Map(RULES.dec.municipalities.map(m => [m.name, m]))
  const town = s.input.building.municipality.trim()
  const here = towns.towns.find(t => t.name.toLowerCase() === town.toLowerCase())
  const paths = towns.towns.map(t => {
    const d = dec.get(t.name)
    const cls = d ? (d.narrowedFor.length ? 'dec part' : 'dec') : 'town'
    const label = `${t.name}${d ? (d.narrowedFor.length ? ': Designated Equity Community in parts (Environmental Justice block groups) for some utilities' : ': Designated Equity Community') : ''}${PILOT.includes(t.name) ? '; navigator pilot city' : ''}`
    return `<path d="${t.d}" class="${cls}${here === t ? ' here' : ''}"><title>${esc(label)}</title></path>`
  }).join('')
  const pins = towns.towns.filter(t => PILOT.includes(t.name)).map(t =>
    `<g class="pin"><circle cx="${t.x}" cy="${t.y}" r="7"/><text x="${t.x + 11}" y="${t.y + 4}">${t.name}</text></g>`).join('')
  const herePin = here ? `<g class="pin-here"><circle cx="${here.x}" cy="${here.y}" r="9"/><circle cx="${here.x}" cy="${here.y}" r="3"/><text x="${here.x + 13}" y="${here.y - 10}">${esc(here.name)}</text></g>` : ''

  const isDec = here ? dec.get(here.name) : undefined
  const nearest = here && !PILOT.includes(here.name)
    ? towns.towns.filter(t => PILOT.includes(t.name)).reduce((a, b) => (Math.hypot(a.x - here.x, a.y - here.y) <= Math.hypot(b.x - here.x, b.y - here.y) ? a : b))
    : null
  const summary = here
    ? `${esc(here.name)} ${isDec ? (isDec.narrowedFor.length ? 'is a Designated Equity Community in its Environmental Justice block groups for some utilities' : 'is a Designated Equity Community, so its residents get Mass Save’s enhanced offers wherever they live in it') : 'is not a Designated Equity Community; income-based offers may still apply'}. ${PILOT.includes(here.name) ? 'It is also a navigator pilot city, so you can book a free call with a human navigator.' : `It is outside the six-city navigator pilot${nearest ? ` (the nearest pilot city is ${nearest.name})` : ''}, so this page is the navigator; Mass Save and the regional CAP agency still help everywhere.`}`
    : town ? `We couldn’t find “${esc(town)}” among Massachusetts’ 351 cities and towns. Check the spelling.` : 'Enter the city or town to place the building on the map.'

  return `<section class="map-band" aria-labelledby="h-map">
    <div class="band-text"><p class="kicker">Access</p><h2 id="h-map">Where extra help reaches</h2><p>${summary}</p>
      <ul class="map-legend">
        <li><span class="key dec" aria-hidden="true"></span>Designated Equity Community: enhanced offers by place, not income</li>
        <li><span class="key part" aria-hidden="true"></span>Designated in its Environmental Justice block groups only, for some utilities</li>
        <li><span class="key pin" aria-hidden="true"></span>Navigator pilot city (MassCEC)</li>
        ${here ? '<li><span class="key here" aria-hidden="true"></span>This building’s town</li>' : ''}
      </ul>
      <p class="muted">Sources: <a href="${esc(DEC_SOURCE?.url ?? '')}" target="_blank" rel="noopener">Mass Save DEC list</a> · ${PILOT_SOURCES.map(p => `<a href="${p.url}" target="_blank" rel="noopener">${p.label}</a>`).join(' · ')} · <a href="${esc(towns.source)}" target="_blank" rel="noopener">Census town boundaries</a>. Places are shown to point people to help, never to rank them.</p>
    </div>
    <div class="map-wrap"><svg class="map" viewBox="${towns.viewBox}" role="img" aria-labelledby="map-t"><title id="map-t">Massachusetts cities and towns: Designated Equity Communities, navigator pilot cities${here ? `, and ${esc(here.name)}` : ''}</title>${paths}${pins}${herePin}</svg></div>
  </section>`
}
