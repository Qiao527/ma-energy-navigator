import { getFact, type Scalar, type Scope } from './scope.js'

export type Tri = 'yes' | 'no' | 'unknown'

export type Leaf =
  | { fact: string; op: 'eq'; value: Scalar }
  | { fact: string; op: 'in'; value: Scalar[] }
  | { fact: string; op: 'gte' | 'gt' | 'lte' | 'lt'; value: number }

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | Leaf
  | { incomeAtMost: string }
  | { incomeAbove: string }
  | { allUnits: { eligible: Condition; require: Condition } }
  | { ref: string }

export interface EvalResult {
  value: Tri
  /** Facts whose absence makes the value unknown. Empty unless value is 'unknown'. */
  missing: string[]
  /** Working-assumption predicates that kept the value unknown. Present only when non-empty. */
  assumptions?: string[]
}

/** strict: working assumptions never decide anything. assumed: use them (only for hints and ordering). */
type Mode = 'strict' | 'assumed'

const YES: EvalResult = { value: 'yes', missing: [] }
const NO: EvalResult = { value: 'no', missing: [] }
function unknown(missing: string[], assumptions: string[] = []): EvalResult {
  const r: EvalResult = { value: 'unknown', missing: [...new Set(missing)].sort() }
  if (assumptions.length > 0) r.assumptions = [...new Set(assumptions)].sort()
  return r
}
const assumptionsOf = (rs: EvalResult[]): string[] => rs.flatMap(r => r.assumptions ?? [])

function holds(c: Leaf, v: Scalar): boolean {
  switch (c.op) {
    case 'eq': return v === c.value
    case 'in': return c.value.includes(v)
    case 'gte': return typeof v === 'number' && v >= c.value
    case 'gt': return typeof v === 'number' && v > c.value
    case 'lte': return typeof v === 'number' && v <= c.value
    case 'lt': return typeof v === 'number' && v < c.value
  }
}

function leaf(c: Leaf, s: Scope): EvalResult {
  const v = getFact(s, c.fact)
  if (v === null) return unknown([c.fact])
  return holds(c, v) ? YES : NO
}

function combineAll(rs: EvalResult[]): EvalResult {
  if (rs.some(r => r.value === 'no')) return NO
  const unknowns = rs.filter(r => r.value === 'unknown')
  return unknowns.length > 0 ? unknown(unknowns.flatMap(r => r.missing), assumptionsOf(unknowns)) : YES
}

function combineAny(rs: EvalResult[]): EvalResult {
  if (rs.some(r => r.value === 'yes')) return YES
  const unknowns = rs.filter(r => r.value === 'unknown')
  return unknowns.length > 0 ? unknown(unknowns.flatMap(r => r.missing), assumptionsOf(unknowns)) : NO
}

function income(s: Scope, tableId: string, mode: 'atMost' | 'above'): EvalResult {
  const table = s.incomeTables[tableId]
  if (table === undefined) throw new Error(`unknown income table: ${tableId}`)
  const { size, incomeBand } = s.input.household
  if (size === null || incomeBand === null) {
    return unknown([
      ...(size === null ? ['user.householdSize'] : []),
      ...(incomeBand === null ? ['user.incomeBand'] : []),
    ])
  }
  const limit = table[Math.min(size, table.length) - 1]
  if (limit === undefined) throw new Error(`income table ${tableId} is empty`)
  const atMost: Tri = incomeBand.high <= limit ? 'yes' : incomeBand.low > limit ? 'no' : 'unknown'
  const value: Tri = mode === 'atMost' ? atMost : atMost === 'yes' ? 'no' : atMost === 'no' ? 'yes' : 'unknown'
  if (value === 'unknown') return unknown(['user.incomeBand'])
  return value === 'yes' ? YES : NO
}

export interface Participation {
  /** Units that are certainly eligible and have said no: the definite "units still needed". */
  needed: string[]
  /**
   * Units that said no and count as eligible only under a working assumption. A hint, never a
   * conclusion (e.g. a metered condo unit before Mass Save defines "eligible unit").
   */
  likelyNeeded: string[]
  /** Units whose eligibility or answer isn't settled, including units the working assumption would leave out. */
  undecided: string[]
  missing: string[]
  /** Per undecided unit: the facts that would settle it (empty when only the working assumption is in the way). */
  missingByUnit: Record<string, string[]>
  /** Working assumptions the count depends on. */
  assumptions: string[]
}

/** Per-unit view of an all-units condition (research §2.3). Used for the "N more units needed" count. */
export function participation(spec: { eligible: Condition; require: Condition }, s: Scope): Participation {
  const out: Participation = { needed: [], likelyNeeded: [], undecided: [], missing: [], missingByUnit: {}, assumptions: [] }
  for (const unit of s.input.building.units) {
    const us: Scope = { ...s, unit }
    const e = evaluate(spec.eligible, us)
    if (e.value === 'no') continue
    const r = evaluate(spec.require, us)
    if (r.value === 'yes') continue
    out.assumptions.push(...(e.assumptions ?? []))
    if (e.value === 'yes' && r.value === 'no') {
      out.needed.push(unit.id)
      continue
    }
    const assumed = e.value === 'unknown' && e.assumptions !== undefined ? evaluateIn(spec.eligible, us, 'assumed').value : null
    if (assumed === 'yes' && r.value === 'no') out.likelyNeeded.push(unit.id)
    else {
      out.undecided.push(unit.id)
      out.missing.push(...e.missing, ...r.missing)
      out.missingByUnit[unit.id] = [...new Set([...e.missing, ...r.missing])].sort()
    }
  }
  out.missing = [...new Set(out.missing)].sort()
  out.assumptions = [...new Set(out.assumptions)].sort()
  return out
}

function allUnits(spec: { eligible: Condition; require: Condition }, s: Scope): EvalResult {
  const p = participation(spec, s)
  if (p.needed.length > 0) return NO
  return p.likelyNeeded.length > 0 || p.undecided.length > 0 ? unknown(p.missing, p.assumptions) : YES
}

function evaluateIn(c: Condition, s: Scope, mode: Mode): EvalResult {
  if ('all' in c) return combineAll(c.all.map(x => evaluateIn(x, s, mode)))
  if ('any' in c) return combineAny(c.any.map(x => evaluateIn(x, s, mode)))
  if ('not' in c) {
    const r = evaluateIn(c.not, s, mode)
    if (r.value === 'unknown') return r
    return r.value === 'yes' ? NO : YES
  }
  if ('fact' in c) return leaf(c, s)
  if ('incomeAtMost' in c) return income(s, c.incomeAtMost, 'atMost')
  if ('incomeAbove' in c) return income(s, c.incomeAbove, 'above')
  if ('ref' in c) {
    const p = s.predicates[c.ref]
    if (p === undefined) throw new Error(`unknown predicate: ${c.ref}`)
    const r = evaluateIn(p.condition, s, mode)
    if (!p.workingAssumption || mode === 'assumed') return r
    // A working assumption can't produce a definite answer (Qiao, 2026-11-06).
    return unknown(r.value === 'unknown' ? r.missing : [], [...(r.assumptions ?? []), c.ref])
  }
  return allUnits(c.allUnits, s)
}

/** Three-valued evaluation. Working-assumption predicates never decide the result. */
export function evaluate(c: Condition, s: Scope): EvalResult {
  return evaluateIn(c, s, 'strict')
}
