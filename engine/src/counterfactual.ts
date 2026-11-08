import { evaluate, type Condition } from './condition.js'
import { walk } from './provenance.js'
import type { Scope } from './scope.js'

/** Changes a household can actually make. Extend only with facts users can act on. */
export type Change =
  | { fact: 'unit.participating'; unitId: string; to: true }
  | { fact: 'user.onDiscountRate'; to: true }

function mentions(c: Condition, s: Scope, fact: string, seen = new Set<string>()): boolean {
  let found = false
  walk(c, node => {
    if ('fact' in node && node.fact === fact) found = true
    if ('ref' in node && !seen.has(node.ref)) {
      seen.add(node.ref)
      const p = s.predicates[node.ref]
      if (p !== undefined && mentions(p.condition, s, fact, seen)) found = true
    }
  })
  return found
}

function apply(s: Scope, changes: readonly Change[]): Scope {
  let input = s.input
  for (const ch of changes) {
    if (ch.fact === 'unit.participating') {
      const units = input.building.units.map(u => (u.id === ch.unitId ? { ...u, participating: true } : u))
      input = { ...input, building: { ...input.building, units } }
    } else {
      input = { ...input, household: { ...input.household, onDiscountRate: true } }
    }
  }
  const unitId = s.unit?.id
  const unit = unitId === undefined ? null : (input.building.units.find(u => u.id === unitId) ?? null)
  return { ...s, input, unit }
}

function subsets<T>(xs: readonly T[], k: number): T[][] {
  if (k === 0) return [[]]
  const [head, ...tail] = xs
  if (head === undefined || xs.length < k) return []
  return [...subsets(tail, k - 1).map(rest => [head, ...rest]), ...subsets(tail, k)]
}

/** Smallest set of realistic changes that makes `c` hold, or null if none does. */
export function findChanges(c: Condition, s: Scope): Change[] | null {
  const candidates: Change[] = []
  if (mentions(c, s, 'unit.participating')) {
    for (const u of s.input.building.units) {
      if (u.participating !== true) candidates.push({ fact: 'unit.participating', unitId: u.id, to: true })
    }
  }
  if (s.input.household.onDiscountRate !== true && mentions(c, s, 'user.onDiscountRate')) {
    candidates.push({ fact: 'user.onDiscountRate', to: true })
  }
  for (let k = 1; k <= candidates.length; k++) {
    for (const set of subsets(candidates, k)) {
      if (evaluate(c, apply(s, set)).value === 'yes') return set
    }
  }
  return null
}
