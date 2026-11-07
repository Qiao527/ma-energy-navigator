import { keyOf, type OfferResult } from './offers.js'
import { MEASURE_ORDER, type Measure, type Offer, type SequenceEdge } from './rules-schema.js'

export interface Step {
  measure: Measure
  offerIds: string[]
  /** Why this step comes after others; each reason is backed by a sourced edge. */
  after: { measure: Measure; reason: string }[]
}

export function buildSteps(
  results: readonly OfferResult[], offers: ReadonlyMap<string, Offer>, edges: readonly SequenceEdge[],
): Step[] {
  const byMeasure = new Map<Measure, string[]>()
  for (const r of results) {
    if (r.status === 'not_eligible') continue
    const measure = offers.get(keyOf(r))?.measure
    if (measure === undefined) continue
    const ids = byMeasure.get(measure) ?? []
    if (!ids.includes(r.offerId)) ids.push(r.offerId)
    byMeasure.set(measure, ids)
  }
  const present = MEASURE_ORDER.filter(m => byMeasure.has(m))
  const relevant = edges.filter(e => byMeasure.has(e.before) && byMeasure.has(e.after))
  const indegree = new Map<Measure, number>(present.map(m => [m, relevant.filter(e => e.after === m).length]))
  const done = new Set<Measure>()
  const steps: Step[] = []
  while (steps.length < present.length) {
    const next = present.find(m => !done.has(m) && indegree.get(m) === 0)
    if (next === undefined) throw new Error('cycle in sequence edges')
    done.add(next)
    for (const e of relevant) if (e.before === next) indegree.set(e.after, (indegree.get(e.after) ?? 0) - 1)
    steps.push({
      measure: next,
      offerIds: byMeasure.get(next) ?? [],
      after: relevant.filter(e => e.after === next).map(e => ({ measure: e.before, reason: e.reason })),
    })
  }
  return steps
}
