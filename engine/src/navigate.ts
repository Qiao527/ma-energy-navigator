import { InputSchema } from './facts.js'
import { applyCaps, chooseBest, evaluateOffer, type CapNote, type OfferResult, type QuantitiesFor } from './offers.js'
import { buildSteps, type Step } from './plan.js'
import { freshness, inWindow, isStale } from './provenance.js'
import { offerKey, type RuleSet } from './rules-schema.js'
import { derive, type Scope } from './scope.js'

export interface NavigateOptions {
  /** Today. Picks as_of rules, checks application deadlines, drives staleness. Tests always pass a fixed date. */
  asOf: string
  /** Planned installation date, if known. Picks installation-basis versions (schema §5). */
  installDate: string | null
}

export interface Question {
  fact: string
  unitId: string | null
  /** own_unit: the user can answer. other_unit: ask a neighbour or the landlord. */
  about: 'own_unit' | 'other_unit' | 'building' | 'user' | 'project'
}

export interface NavigateResult {
  options: NavigateOptions
  /** Every evaluated offer × unit, for tests and audit. */
  evaluated: OfferResult[]
  /** What the report shows (schema §4). */
  shown: OfferResult[]
  questions: Question[]
  steps: Step[]
  caps: CapNote[]
  /** Offer versions whose oldest source, including dependencies, is over 90 days old. */
  staleOffers: string[]
  /** Announced versions that start after the date used (e.g. 2027 heat pump rates). */
  upcoming: { offerId: string; version: string; from: string }[]
}

function aboutOf(fact: string, unitId: string | null, userUnitId: string | null): Question['about'] {
  if (fact.startsWith('unit.')) return unitId !== null && unitId === userUnitId ? 'own_unit' : 'other_unit'
  if (fact.startsWith('user.')) return 'user'
  if (fact.startsWith('project.')) return 'project'
  return 'building'
}

export function navigate(rawInput: unknown, rules: RuleSet, options: NavigateOptions, quantitiesFor: QuantitiesFor): NavigateResult {
  const input = InputSchema.parse(rawInput)
  const date = options.installDate ?? options.asOf
  const base: Scope = {
    input,
    unit: null,
    derived: derive(input, rules.dec.municipalities),
    incomeTables: Object.fromEntries(rules.incomeTables.map(t => [t.id, t.bySize])),
    predicates: Object.fromEntries(rules.predicates.map(p => [p.id, { condition: p.condition, workingAssumption: p.workingAssumption }])),
  }
  const byKey = new Map(rules.offers.map(o => [offerKey(o), o]))
  const selected = rules.offers.filter(o => inWindow(o.effective, o.dateBasis === 'installation' ? date : options.asOf))
  // An install date on or before today means the work is done (Qiao, 2026-11-07).
  const installed = options.installDate !== null && options.installDate <= options.asOf
  const upcoming = installed ? [] : rules.offers
    .filter(o => o.dateBasis === 'installation' && o.effective.from > date)
    .map(o => ({ offerId: o.id, version: o.version, from: o.effective.from }))
  const evaluated = selected.flatMap(o => evaluateOffer(o, base, quantitiesFor, options.asOf))
  // Installed: a missed paperwork deadline is shown with its date. Still planning: last year's versions
  // aren't selected at all, so they never show.
  const shown = chooseBest(evaluated, byKey).filter(r =>
    r.status !== 'not_eligible' || r.changes !== null || (installed && r.reason === 'application_deadline_passed'))

  const questions = new Map<string, Question>()
  const ask = (fact: string, unitId: string | null) => {
    const unitScoped = fact.startsWith('unit.') ? unitId : null
    questions.set(`${fact}|${unitScoped ?? ''}`, { fact, unitId: unitScoped, about: aboutOf(fact, unitScoped, input.userUnitId) })
  }
  for (const r of shown) {
    if (r.status === 'needs_info') for (const f of r.missing) ask(f, r.unitId)
    for (const p of r.prerequisites) for (const q of p.unitQuestions ?? []) ask(q.fact, q.unitId)
  }
  if (options.installDate === null && upcoming.length > 0) ask('project.installDate', null)
  // Hot water (F2): fuel records include it when the same boiler heats the water. No boiler fact exists, so a
  // fuel-burning heating system or fuel records stand in for "has a boiler".
  for (const u of input.building.units) {
    const burnsFuel = u.heatingFuel === 'oil' || u.heatingFuel === 'natural_gas' || u.heatingFuel === 'propane'
    if (u.hotWaterFromBoiler === null && (burnsFuel || u.fuelRecords !== null)) ask('unit.hotWaterFromBoiler', u.id)
    if (u.hotWaterFromBoiler === true && u.hotWaterAfter === null) ask('unit.hotWaterAfter', u.id)
  }

  return {
    options,
    evaluated,
    shown,
    questions: [...questions.values()],
    steps: buildSteps(shown, byKey, rules.sequence),
    caps: applyCaps(shown, byKey, rules.caps, date),
    staleOffers: selected.filter(o => isStale(freshness(o, rules), options.asOf)).map(offerKey),
    upcoming,
  }
}
