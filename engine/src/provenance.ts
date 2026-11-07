import type { Condition } from './condition.js'
import { offerKey, type Offer, type RuleSet, type Source, type Window } from './rules-schema.js'
import { FACT_PATHS } from './scope.js'

export const STALE_AFTER_DAYS = 90
const DAY_MS = 86_400_000
const FAR_FUTURE = '9999-12-31'

export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

export const isStale = (lastVerified: string, asOf: string): boolean => daysBetween(lastVerified, asOf) > STALE_AFTER_DAYS

export function oldestVerified(sources: readonly Source[]): string {
  const first = sources.map(s => s.lastVerified).sort()[0]
  if (first === undefined) throw new Error('no sources')
  return first
}

export const inWindow = (w: Window, date: string): boolean => w.from <= date && (w.until === null || date <= w.until)

const overlaps = (a: Window, b: Window): boolean =>
  a.from <= (b.until ?? FAR_FUTURE) && b.from <= (a.until ?? FAR_FUTURE)

/** Calls `visit` on every node of a condition tree. */
export function walk(c: Condition, visit: (node: Condition) => void): void {
  visit(c)
  if ('all' in c) c.all.forEach(x => walk(x, visit))
  else if ('any' in c) c.any.forEach(x => walk(x, visit))
  else if ('not' in c) walk(c.not, visit)
  else if ('allUnits' in c) {
    walk(c.allUnits.eligible, visit)
    walk(c.allUnits.require, visit)
  }
}

/** Every condition an offer uses: eligibility, prerequisites and confirmations. */
export function conditionsOf(o: Offer): Condition[] {
  return [
    o.eligibility,
    ...o.prerequisites.flatMap(p => (p.satisfiedWhen === null ? [] : [p.satisfiedWhen])),
    ...o.confirmations.flatMap(c => (c.when === null ? [] : [c.when])),
  ]
}

const duplicates = (ids: string[]): string[] => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]

/** Structural problems that must block shipping the rules data. Date-free, so tests are deterministic. */
export function findDataProblems(rules: RuleSet): string[] {
  const problems: string[] = []
  const facts = new Set<string>(FACT_PATHS)
  const programs = new Set(rules.programs.map(p => p.id))
  const tables = new Map(rules.incomeTables.map(t => [t.id, t]))
  const predicates = new Set(rules.predicates.map(p => p.id))
  const capGroups = new Set(rules.caps.map(c => c.capGroup))

  const check = (where: string, c: Condition): void =>
    walk(c, node => {
      if ('fact' in node && !facts.has(node.fact)) problems.push(`${where}: unknown fact path ${node.fact}`)
      if ('incomeAtMost' in node && !tables.has(node.incomeAtMost)) problems.push(`${where}: unknown income table ${node.incomeAtMost}`)
      if ('incomeAbove' in node && !tables.has(node.incomeAbove)) problems.push(`${where}: unknown income table ${node.incomeAbove}`)
      if ('ref' in node && !predicates.has(node.ref)) problems.push(`${where}: unknown predicate ${node.ref}`)
    })

  for (const id of duplicates(rules.programs.map(p => p.id))) problems.push(`duplicate program ${id}`)
  for (const k of duplicates(rules.offers.map(offerKey))) problems.push(`duplicate offer ${k}`)
  for (const id of duplicates(rules.predicates.map(p => p.id))) problems.push(`duplicate predicate ${id}`)
  for (const id of duplicates(rules.caps.map(c => c.id))) problems.push(`duplicate cap ${id}`)
  for (const p of rules.predicates) check(`predicate ${p.id}`, p.condition)

  for (const o of rules.offers) {
    const where = `offer ${offerKey(o)}`
    if (!programs.has(o.programId)) problems.push(`${where}: unknown program ${o.programId}`)
    if (o.effective.until !== null && o.effective.until < o.effective.from) problems.push(`${where}: effective period ends before it starts`)
    for (const g of o.capGroups) if (!capGroups.has(g)) problems.push(`${where}: no cap rule for capGroup ${g}`)
    for (const c of conditionsOf(o)) check(where, c)
    for (const p of o.prerequisites) {
      if (p.kind === 'coordination' && (p.satisfiedWhen === null || !('allUnits' in p.satisfiedWhen))) {
        problems.push(`${where}: coordination prerequisite ${p.id} must be an allUnits condition`)
      }
    }
    const used = new Set<string>()
    for (const c of conditionsOf(o)) walk(c, n => {
      if ('incomeAtMost' in n) used.add(n.incomeAtMost)
      if ('incomeAbove' in n) used.add(n.incomeAbove)
    })
    for (const id of used) {
      const tw = tables.get(id)?.window
      if (tw === undefined) continue
      const ends = o.effective.until ?? FAR_FUTURE
      if (o.effective.from < tw.from || ends > (tw.until ?? FAR_FUTURE)) problems.push(`${where}: runs outside the window of income table ${id}`)
    }
  }

  const byId = new Map<string, Offer[]>()
  for (const o of rules.offers) byId.set(o.id, [...(byId.get(o.id) ?? []), o])
  for (const [id, versions] of byId) {
    for (let i = 0; i < versions.length; i++) {
      for (let j = i + 1; j < versions.length; j++) {
        const a = versions[i]
        const b = versions[j]
        if (a && b && a.version !== b.version && overlaps(a.effective, b.effective)) {
          problems.push(`offer ${id}: versions ${a.version} and ${b.version} overlap`)
        }
      }
    }
  }
  return problems
}

export interface DataStatus {
  /** Versions whose effective period and application deadline have both passed (kept for history). */
  pastBothDates: string[]
  /** Programs with no version that applies on `date`: the data needs an update (e.g. new program year). */
  programsWithoutCurrentVersion: string[]
}

/** Non-blocking status for `npm run data:status`, which passes today's date. */
export function dataStatus(rules: RuleSet, date: string): DataStatus {
  const past = (o: Offer): boolean =>
    o.effective.until !== null && o.effective.until < date && (o.applicationDeadline === null || o.applicationDeadline < date)
  const current = new Set(rules.offers.filter(o => inWindow(o.effective, date)).map(o => o.programId))
  return {
    pastBothDates: rules.offers.filter(past).map(offerKey),
    programsWithoutCurrentVersion: rules.programs.map(p => p.id).filter(id => !current.has(id)),
  }
}

/** Oldest lastVerified across the offer and everything it depends on (review A6). */
export function freshness(o: Offer, rules: RuleSet): string {
  const sources: Source[] = [...o.sources]
  const facts = new Set<string>()
  for (const c of conditionsOf(o)) {
    walk(c, n => {
      if ('fact' in n) facts.add(n.fact)
      const tableId = 'incomeAtMost' in n ? n.incomeAtMost : 'incomeAbove' in n ? n.incomeAbove : null
      if (tableId !== null) sources.push(...(rules.incomeTables.find(t => t.id === tableId)?.sources ?? []))
      if ('ref' in n) sources.push(...(rules.predicates.find(p => p.id === n.ref)?.sources ?? []))
    })
  }
  if (facts.has('building.isDec')) sources.push(...rules.dec.sources)
  for (const g of o.capGroups) sources.push(...rules.caps.filter(c => c.capGroup === g).flatMap(c => c.sources))
  return oldestVerified(sources)
}
