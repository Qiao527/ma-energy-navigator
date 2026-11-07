import { benefitValue, type Quantities } from './benefit.js'
import { evaluate, participation, type Tri } from './condition.js'
import { findChanges, type Change } from './counterfactual.js'
import type { Estimate } from './estimate.js'
import { inWindow } from './provenance.js'
import { add, capAt, point, type Range } from './range.js'
import { offerKey, type CapRule, type Confirmation, type Offer, type Prerequisite } from './rules-schema.js'
import type { Scope } from './scope.js'

export type Status = 'eligible' | 'potential' | 'needs_info' | 'not_eligible'

export interface PrerequisiteResult {
  id: string
  kind: Prerequisite['kind']
  description: string
  /** done / todo / unknown from the facts; 'check' = we can't check it (checklist item). */
  state: 'done' | 'todo' | 'unknown' | 'check'
  /** Coordination only: units certainly eligible that said no ("N more units needed"). */
  unitsNeeded: string[] | null
  /** Coordination only: units that said no and count only under a working assumption (a hint). */
  unitsLikelyNeeded: string[] | null
  /** Coordination only: units whose eligibility or answer isn't settled. */
  unitsUndecided: string[] | null
  /** Coordination only: what to ask about each undecided unit (nothing when only the working assumption is open). */
  unitQuestions: { unitId: string; fact: string }[] | null
}

export interface OfferResult {
  offerId: string
  version: string
  unitId: string | null
  /** Precedence: not_eligible > needs_info > potential > eligible (schema §3). */
  status: Status
  reason: 'application_deadline_passed' | null
  /** Facts to ask the user about (status needs_info). */
  missing: string[]
  /** What only the program can confirm (applies, or may apply). */
  confirmations: Confirmation[]
  prerequisites: PrerequisiteResult[]
  value: Estimate | null
  recipient: Offer['recipient']
  changes: Change[] | null
}

export type QuantitiesFor = (unitId: string | null) => Quantities

const STATE: Record<Tri, PrerequisiteResult['state']> = { yes: 'done', no: 'todo', unknown: 'unknown' }
export const keyOf = (r: OfferResult): string => offerKey({ id: r.offerId, version: r.version })

function prerequisiteResult(p: Prerequisite, s: Scope): PrerequisiteResult {
  const base = { id: p.id, kind: p.kind, description: p.description, unitsNeeded: null, unitsLikelyNeeded: null, unitsUndecided: null, unitQuestions: null }
  if (p.satisfiedWhen === null) return { ...base, state: 'check' }
  const state = STATE[evaluate(p.satisfiedWhen, s).value]
  if (p.kind === 'coordination' && 'allUnits' in p.satisfiedWhen) {
    const pt = participation(p.satisfiedWhen.allUnits, s)
    const unitQuestions = Object.entries(pt.missingByUnit).flatMap(([unitId, facts]) => facts.map(fact => ({ unitId, fact })))
    return { ...base, state, unitsNeeded: pt.needed, unitsLikelyNeeded: pt.likelyNeeded, unitsUndecided: pt.undecided, unitQuestions }
  }
  return { ...base, state }
}

export function evaluateOffer(offer: Offer, base: Scope, quantitiesFor: QuantitiesFor, asOf: string): OfferResult[] {
  const { units } = base.input.building
  const userUnit = units.find(u => u.id === base.input.userUnitId) ?? null
  const scopes: Scope[] = offer.appliesTo === 'each_unit' ? units.map(unit => ({ ...base, unit })) : [{ ...base, unit: userUnit }]
  const deadlinePassed = offer.applicationDeadline !== null && asOf > offer.applicationDeadline
  return scopes.map(s => {
    const e = evaluate(offer.eligibility, s)
    const confs = offer.confirmations.map(c => ({ c, w: c.when === null ? null : evaluate(c.when, s) }))
    const applicable = confs.filter(x => x.w === null || x.w.value === 'yes').map(x => x.c)
    const pending = confs.filter(x => x.w !== null && x.w.value === 'unknown')
    let status: Status
    let missing = e.missing
    if (deadlinePassed || e.value === 'no') status = 'not_eligible'
    else if (e.value === 'unknown' || pending.length > 0) {
      status = 'needs_info'
      missing = [...new Set([...e.missing, ...pending.flatMap(x => x.w?.missing ?? [])])].sort()
    } else status = applicable.length > 0 ? 'potential' : 'eligible'
    const unitId = s.unit?.id ?? null
    const lookForChanges = !deadlinePassed && (status === 'not_eligible' || status === 'needs_info')
    return {
      offerId: offer.id,
      version: offer.version,
      unitId,
      status,
      reason: deadlinePassed ? 'application_deadline_passed' : null,
      missing,
      confirmations: [...applicable, ...pending.map(x => x.c)],
      prerequisites: offer.prerequisites.map(p => prerequisiteResult(p, s)),
      value: status === 'not_eligible' ? null : benefitValue(offer.benefit, quantitiesFor(unitId)),
      recipient: offer.recipient,
      changes: lookForChanges ? findChanges(offer.eligibility, s) : null,
    }
  })
}

/** > 0: a is better; < 0: worse; 0: equal; null: not comparable (schema §4). */
export function compareResults(a: OfferResult, b: OfferResult, offers: ReadonlyMap<string, Offer>): number | null {
  if (a.value !== null && b.value !== null) return a.value.range.mid - b.value.range.mid
  const ba = offers.get(keyOf(a))?.benefit
  const bb = offers.get(keyOf(b))?.benefit
  if (ba?.type === 'percent_of_cost' && bb?.type === 'percent_of_cost' && ba.costOf === bb.costOf) return ba.pct - bb.pct
  return null
}

const waitsOnOthers = (r: OfferResult): boolean => r.prerequisites.some(p => p.kind === 'coordination' && p.state !== 'done')

export function chooseBest(results: readonly OfferResult[], offers: ReadonlyMap<string, Offer>): OfferResult[] {
  const keep = new Set<OfferResult>()
  const groups = new Map<string, OfferResult[]>()
  for (const r of results) {
    const group = offers.get(keyOf(r))?.exclusiveGroup ?? null
    if (group === null || r.status === 'not_eligible') {
      keep.add(r)
      continue
    }
    const k = `${group}|${r.unitId ?? ''}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const beatsOrTies = (k: OfferResult, r: OfferResult): boolean => {
    const c = compareResults(k, r, offers)
    return c !== null && c >= 0
  }
  for (const rs of groups.values()) {
    const settled = (x: OfferResult) => x.status === 'eligible' && !waitsOnOthers(x)
    const best: OfferResult[] = []
    for (const r of rs.filter(settled)) {
      if (best.some(k => beatsOrTies(k, r))) continue
      for (let i = best.length - 1; i >= 0; i--) {
        const k = best[i]
        if (k !== undefined && beatsOrTies(r, k)) best.splice(i, 1)
      }
      best.push(r)
    }
    for (const r of best) keep.add(r)
    for (const r of rs.filter(x => !settled(x))) if (!best.some(k => beatsOrTies(k, r))) keep.add(r)
  }
  return results.filter(r => keep.has(r))
}

export interface CapNote {
  capId: string
  unitId: string | null
  scope: CapRule['scope']
  limit: CapRule['limit']
  /** Money caps per account or installation: the capped per-unit sum. Otherwise null (note only). */
  total: Range | null
  capped: boolean
  assumption: 'one account per unit' | null
}

/** Prior use is never known in v1: the UI words every cap as "if you haven't used this before". */
export function applyCaps(
  results: readonly OfferResult[], offers: ReadonlyMap<string, Offer>, caps: readonly CapRule[], date: string,
): CapNote[] {
  const notes: CapNote[] = []
  for (const cap of caps) {
    if (!inWindow(cap.window, date)) continue
    const byUnit = new Map<string | null, OfferResult[]>()
    for (const r of results) {
      if (r.status !== 'eligible' && r.status !== 'potential') continue
      if (!offers.get(keyOf(r))?.capGroups.includes(cap.capGroup)) continue
      byUnit.set(r.unitId, [...(byUnit.get(r.unitId) ?? []), r])
    }
    const clips = cap.limit.type === 'money' && (cap.scope === 'account' || cap.scope === 'installation')
    const assumption = cap.scope === 'account' ? 'one account per unit' : null
    for (const [unitId, rs] of byUnit) {
      const values = rs.map(r => r.value?.range).filter((v): v is Range => v !== undefined)
      if (!clips || cap.limit.type !== 'money' || values.length === 0) {
        notes.push({ capId: cap.id, unitId, scope: cap.scope, limit: cap.limit, total: null, capped: false, assumption })
        continue
      }
      const sum = values.reduce(add, point(0))
      notes.push({ capId: cap.id, unitId, scope: cap.scope, limit: cap.limit, total: capAt(sum, cap.limit.amount), capped: sum.high > cap.limit.amount, assumption })
    }
  }
  return notes
}
