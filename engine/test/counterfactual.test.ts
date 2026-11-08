import { describe, expect, test } from 'vitest'
import type { Condition } from '../src/condition.js'
import { findChanges } from '../src/counterfactual.js'
import type { NamedPredicate } from '../src/scope.js'
import { input, scope, unit } from './fixtures.js'

const PREDICATES: Record<string, NamedPredicate> = {
  condo_eligible_unit: { condition: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true }, workingAssumption: false },
}
const ALL_UNITS: Condition = {
  allUnits: { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } },
}
const condo = (parts: (boolean | null)[], onDiscountRate: boolean | null = false) => {
  const i = input({
    building: { units: parts.map((p, k) => unit(String(k + 1), { hasResidentialHeatingMeter: true, participating: p })) },
    household: { onDiscountRate },
  })
  return scope(i, { predicates: PREDICATES })
}

describe('findChanges', () => {
  test('one unit said no → that unit agreeing is the change', () => {
    expect(findChanges(ALL_UNITS, condo([true, true, false]))).toEqual([{ fact: 'unit.participating', unitId: '3', to: true }])
  })
  test('two units missing → both are needed', () => {
    expect(findChanges(ALL_UNITS, condo([true, false, null]))).toEqual([
      { fact: 'unit.participating', unitId: '2', to: true },
      { fact: 'unit.participating', unitId: '3', to: true },
    ])
  })
  test('getting on the discount rate', () => {
    const c: Condition = { fact: 'user.onDiscountRate', op: 'eq', value: true }
    expect(findChanges(c, condo([true], false))).toEqual([{ fact: 'user.onDiscountRate', to: true }])
  })
  test('nothing realistic helps → null', () => {
    const c: Condition = { fact: 'user.role', op: 'eq', value: 'condo_owner' }
    expect(findChanges(c, condo([false]))).toBeNull()
  })
  test('the real input is not changed', () => {
    const s = condo([true, false])
    findChanges(ALL_UNITS, s)
    expect(s.input.building.units[1]?.participating).toBe(false)
  })
})
