import { z } from 'zod'
import type { Quantities } from './benefit.js'
import type { Estimate } from './estimate.js'
import { navigate, type NavigateResult } from './navigate.js'
import { range } from './range.js'
import { Measure, type RuleSet } from './rules-schema.js'

/** A standard scenario (product.md §6a): fixed input, fixed dates, fixed quantities, and the expected summary. */
const EstimateJson = z.strictObject({
  low: z.number(), mid: z.number(), high: z.number(), confidence: z.enum(['low', 'medium', 'high']), why: z.string().min(1),
})
export const ScenarioSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  story: z.string().min(1),
  input: z.unknown(),
  options: z.strictObject({ asOf: z.iso.date(), installDate: z.iso.date().nullable() }),
  quantities: z.strictObject({
    cost: z.partialRecord(Measure, EstimateJson),
    heatPumpTons: EstimateJson.nullable(),
    solarKwhPerYear: EstimateJson.nullable(),
    communitySolarCreditsPerYear: EstimateJson.nullable(),
  }),
  expected: z.unknown().nullable(),
  /** Qiao's approval of this exact `expected`. Cleared whenever a re-record changes it (CONTRIBUTING.md). */
  approved: z.strictObject({ by: z.string().min(1), on: z.iso.date() }).nullable().default(null),
})
export type Scenario = z.infer<typeof ScenarioSchema>

const toEstimate = (e: z.infer<typeof EstimateJson> | null): Estimate | null =>
  e === null ? null : { range: range(e.low, e.mid, e.high), confidence: e.confidence, why: [e.why] }

function quantitiesOf(s: Scenario): Quantities {
  const cost: Quantities['cost'] = {}
  for (const [m, e] of Object.entries(s.quantities.cost)) if (e) cost[m as Measure] = toEstimate(e) ?? undefined
  return {
    cost,
    heatPumpTons: toEstimate(s.quantities.heatPumpTons),
    solarKwhPerYear: toEstimate(s.quantities.solarKwhPerYear),
    communitySolarCreditsPerYear: toEstimate(s.quantities.communitySolarCreditsPerYear),
    heatLoadMMBtu: null,
  }
}

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

export function runScenario(s: Scenario, rules: RuleSet): unknown {
  const q = quantitiesOf(s)
  return summarize(navigate(s.input, rules, s.options, () => q))
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
