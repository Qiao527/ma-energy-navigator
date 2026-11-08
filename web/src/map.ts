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

/** The map's viewBox for a zoom level: the whole state, or a window around the building's town. */
export function mapView(here: { x: number; y: number } | undefined, zoom: 'state' | 'local'): { vb: string; z: number } {
  const [, , W, H] = towns.viewBox.split(' ').map(Number) as [number, number, number, number]
  if (zoom === 'state' || !here) return { vb: towns.viewBox, z: 1 }
  const w = 190, h = (w * H) / W
  const x = Math.min(Math.max(here.x - w / 2, 0), W - w), y = Math.min(Math.max(here.y - h / 2, 0), H - h)
  return { vb: `${x.toFixed(1)} ${y.toFixed(1)} ${w} ${h.toFixed(1)}`, z: w / W }
}

export function mapSection(s: State, zoom: 'state' | 'local'): string {
  const dec = new Map(RULES.dec.municipalities.map(m => [m.name, m]))
  const town = s.input.building.municipality.trim()
  const here = towns.towns.find(t => t.name.toLowerCase() === town.toLowerCase())
  const paths = towns.towns.map(t => {
    const d = dec.get(t.name)
    const cls = d ? (d.narrowedFor.length ? 'dec part' : 'dec') : 'town'
    const label = `${t.name}${d ? (d.narrowedFor.length ? ': Designated Equity Community in parts (Environmental Justice block groups) for some utilities' : ': Designated Equity Community') : ''}${PILOT.includes(t.name) ? '; navigator pilot city' : ''}`
    const [name, ...rest] = label.split(/[:;] /)
    return `<path d="${t.d}" class="${cls}${here === t ? ' here' : ''}" data-tip="${esc(name ?? t.name)}|${esc(rest.join('; ') || 'Mass Save and the regional CAP agency serve every town')}"></path>`
  }).join('')
  const view = mapView(here, zoom)
  const z = view.z
  const pins = towns.towns.filter(t => PILOT.includes(t.name)).map(t =>
    `<g class="pin"><circle cx="${t.x}" cy="${t.y}" r="${7 * z}"/><text x="${t.x + 11 * z}" y="${t.y + 4 * z}">${t.name}</text></g>`).join('')
  const herePin = here ? `<g class="pin-here"><circle cx="${here.x}" cy="${here.y}" r="${10 * z}" class="pulse"/><circle cx="${here.x}" cy="${here.y}" r="${9 * z}"/><circle cx="${here.x}" cy="${here.y}" r="${3 * z}"/><text x="${here.x + 13 * z}" y="${here.y - 10 * z}">${esc(here.name)}</text></g>` : ''
  const labels = zoom === 'local' ? towns.towns.filter(t => t !== here && !PILOT.includes(t.name)).map(t => `<text class="town-label" x="${t.x}" y="${t.y}" text-anchor="middle">${esc(t.name)}</text>`).join('') : ''

  const isDec = here ? dec.get(here.name) : undefined
  const nearest = here && !PILOT.includes(here.name)
    ? towns.towns.filter(t => PILOT.includes(t.name)).reduce((a, b) => (Math.hypot(a.x - here.x, a.y - here.y) <= Math.hypot(b.x - here.x, b.y - here.y) ? a : b))
    : null
  const summary = here
    ? `${esc(here.name)} ${isDec ? (isDec.narrowedFor.length ? 'is a Designated Equity Community in its Environmental Justice block groups for some utilities' : 'is a Designated Equity Community, so every resident gets Mass Save’s enhanced offers') : 'is not a Designated Equity Community; income-based offers may still apply'}. ${PILOT.includes(here.name) ? 'It is also a navigator pilot city, so you can book a free call with a human navigator.' : `It is outside the six-city navigator pilot${nearest ? ` (the nearest pilot city is ${nearest.name})` : ''}, so this page is your navigator. Mass Save and the regional CAP agency serve every town.`}`
    : town ? `We couldn’t find “${esc(town)}” among Massachusetts’ 351 cities and towns. Check the spelling.` : 'Enter the city or town to place the building on the map.'

  return `<section class="map-band" aria-labelledby="h-map">
    <div class="band-text"><h2 id="h-map">Where extra help reaches</h2><p>${summary}</p>
      <ul class="map-legend">
        <li><span class="key dec" aria-hidden="true"></span>Designated Equity Community: enhanced offers for everyone who lives there</li>
        <li><span class="key part" aria-hidden="true"></span>Designated in its Environmental Justice block groups only, for some utilities</li>
        <li><span class="key pin" aria-hidden="true"></span>Navigator pilot city (MassCEC)</li>
        ${here ? '<li><span class="key here" aria-hidden="true"></span>This building’s town</li>' : ''}
      </ul>
      <p class="muted">Sources: <a href="${esc(DEC_SOURCE?.url ?? '')}" target="_blank" rel="noopener">Mass Save DEC list</a> · ${PILOT_SOURCES.map(p => `<a href="${p.url}" target="_blank" rel="noopener">${p.label}</a>`).join(' · ')} · <a href="${esc(towns.source)}" target="_blank" rel="noopener">Census town boundaries</a>. The shading shows where extra help applies.</p>
    </div>
    <div class="map-wrap">
      ${here ? `<div class="seg-toggle" role="group" aria-label="Map view"><button type="button" data-zoom="state" aria-pressed="${zoom === 'state'}">All of Massachusetts</button><button type="button" data-zoom="local" aria-pressed="${zoom === 'local'}">Around ${esc(here.name)}</button></div>` : ''}
      <svg class="map" viewBox="${view.vb}" data-k="map" data-z="${z}" style="--z:${z}" role="img" aria-labelledby="map-t"><title id="map-t">Massachusetts cities and towns: Designated Equity Communities, navigator pilot cities${here ? `, and ${esc(here.name)}` : ''}</title>${paths}${labels}${pins}${herePin}</svg></div>
  </section>`
}
