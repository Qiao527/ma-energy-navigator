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
}

const YES: EvalResult = { value: 'yes', missing: [] }
const NO: EvalResult = { value: 'no', missing: [] }
const unknown = (missing: string[]): EvalResult => ({ value: 'unknown', missing: [...new Set(missing)].sort() })

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
  return unknowns.length > 0 ? unknown(unknowns.flatMap(r => r.missing)) : YES
}

function combineAny(rs: EvalResult[]): EvalResult {
  if (rs.some(r => r.value === 'yes')) return YES
  const unknowns = rs.filter(r => r.value === 'unknown')
  return unknowns.length > 0 ? unknown(unknowns.flatMap(r => r.missing)) : NO
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
  /** Eligible units that have said no: the "units still needed". */
  needed: string[]
  /** Units whose eligibility or answer is not known yet. */
  undecided: string[]
  missing: string[]
}

/** Per-unit view of an all-units condition (research §2.3). Used for the "N more units needed" count. */
export function participation(spec: { eligible: Condition; require: Condition }, s: Scope): Participation {
  const out: Participation = { needed: [], undecided: [], missing: [] }
  for (const unit of s.input.building.units) {
    const us: Scope = { ...s, unit }
    const e = evaluate(spec.eligible, us)
    if (e.value === 'no') continue
    const r = evaluate(spec.require, us)
    if (r.value === 'yes') continue
    if (e.value === 'yes' && r.value === 'no') out.needed.push(unit.id)
    else {
      out.undecided.push(unit.id)
      out.missing.push(...e.missing, ...r.missing)
    }
  }
  return out
}

function allUnits(spec: { eligible: Condition; require: Condition }, s: Scope): EvalResult {
  const p = participation(spec, s)
  if (p.needed.length > 0) return NO
  return p.undecided.length > 0 ? unknown(p.missing) : YES
}

export function evaluate(c: Condition, s: Scope): EvalResult {
  if ('all' in c) return combineAll(c.all.map(x => evaluate(x, s)))
  if ('any' in c) return combineAny(c.any.map(x => evaluate(x, s)))
  if ('not' in c) {
    const r = evaluate(c.not, s)
    if (r.value === 'unknown') return r
    return r.value === 'yes' ? NO : YES
  }
  if ('fact' in c) return leaf(c, s)
  if ('incomeAtMost' in c) return income(s, c.incomeAtMost, 'atMost')
  if ('incomeAbove' in c) return income(s, c.incomeAbove, 'above')
  if ('ref' in c) {
    const p = s.predicates[c.ref]
    if (p === undefined) throw new Error(`unknown predicate: ${c.ref}`)
    return evaluate(p, s)
  }
  return allUnits(c.allUnits, s)
}
