import { z } from 'zod'
import { InputSchema } from './facts.js'
import { navigate, type NavigateResult } from './navigate.js'
import { quantitiesFor, type Assumption } from './quantities.js'
import type { RuleSet } from './rules-schema.js'

/**
 * A standard scenario (product.md §6a): fixed input and dates, and the expected summary. Quantities (costs, heat
 * pump size) are computed by the engine from the assumptions in force (F4), so an assumption change shows up here.
 */
export const ScenarioSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  story: z.string().min(1),
  /** The building and its records are invented for testing and demos; never present them as real (F3). */
  demoData: z.boolean(),
  input: z.unknown(),
  options: z.strictObject({ asOf: z.iso.date(), installDate: z.iso.date().nullable() }),
  expected: z.unknown().nullable(),
  /** Qiao's approval of this exact `expected`. Cleared whenever a re-record changes it (CONTRIBUTING.md). */
  approved: z.strictObject({ by: z.string().min(1), on: z.iso.date() }).nullable().default(null),
})
export type Scenario = z.infer<typeof ScenarioSchema>

const r2 = (x: number): number => Math.round(x * 100) / 100

/** A stable, reviewable summary of everything the engine decided. Any change in it is a change Qiao approves. */
export function summarize(r: NavigateResult): unknown {
  const shown = new Set(r.shown)
  const results = r.evaluated
    .map(x => ({
      key: `${x.offerId}@${x.version}|${x.unitId ?? '-'}`,
      status: x.status,
      shown: shown.has(x),
      ...(x.reason ? { reason: x.reason, applicationDeadline: x.applicationDeadline } : {}),
      ...(x.missing.length > 0 ? { missing: x.missing } : {}),
      ...(x.confirmations.length > 0 ? { confirmations: x.confirmations.map(c => c.id) } : {}),
      ...(x.prerequisites.length > 0 ? { prerequisites: Object.fromEntries(x.prerequisites.map(p => [p.id, p.state])) } : {}),
      ...(x.prerequisites.some(p => p.kind === 'coordination')
        ? {
            coordination: x.prerequisites.filter(p => p.kind === 'coordination').map(p => ({
              needed: p.unitsNeeded, likelyNeeded: p.unitsLikelyNeeded, undecided: p.unitsUndecided,
            }))[0],
          }
        : {}),
      ...(x.value ? { value: { low: r2(x.value.range.low), mid: r2(x.value.range.mid), high: r2(x.value.range.high), confidence: x.value.confidence } } : {}),
      ...(x.changes ? { changes: x.changes } : {}),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
  return {
    results,
    questions: [...r.questions].sort((a, b) => `${a.fact}|${a.unitId}`.localeCompare(`${b.fact}|${b.unitId}`)),
    steps: r.steps.map(s => s.measure),
    upcoming: r.upcoming.map(u => `${u.offerId}@${u.version}`).sort(),
  }
}

export function runScenario(s: Scenario, rules: RuleSet, list: readonly Assumption[]): unknown {
  const input = InputSchema.parse(s.input)
  return summarize(navigate(input, rules, s.options, quantitiesFor(input, list)))
}

/** Human-readable differences between the expected and actual summary (empty = scenario passes). */
export function diffSummaries(expected: unknown, actual: unknown, path = ''): string[] {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return []
  if (Array.isArray(expected) && Array.isArray(actual) && path.endsWith('results')) {
    const byKey = (xs: unknown[]) => new Map(xs.map(x => [(x as { key: string }).key, x]))
    const e = byKey(expected)
    const a = byKey(actual)
    const out: string[] = []
    for (const k of new Set([...e.keys(), ...a.keys()])) {
      if (!a.has(k)) out.push(`${path}: ${k} missing`)
      else if (!e.has(k)) out.push(`${path}: ${k} new`)
      else out.push(...diffSummaries(e.get(k), a.get(k), `${path}[${k}]`))
    }
    return out
  }
  if (expected !== null && actual !== null && typeof expected === 'object' && typeof actual === 'object' && !Array.isArray(expected)) {
    const eo = expected as Record<string, unknown>
    const ao = actual as Record<string, unknown>
    return [...new Set([...Object.keys(eo), ...Object.keys(ao)])].flatMap(k => diffSummaries(eo[k], ao[k], path ? `${path}.${k}` : k))
  }
  return [`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`]
}
