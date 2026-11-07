import { describe, expect, test } from 'vitest'
import { evaluate, participation, type Condition } from '../src/condition.js'
import type { Unit } from '../src/facts.js'
import type { NamedPredicate } from '../src/scope.js'
import { input, scope, unit } from './fixtures.js'

const METER: Condition = { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true }
/** Today: "eligible unit" = has a heating meter is only a working assumption (research §2.3). */
const ASSUMED: Record<string, NamedPredicate> = { condo_eligible_unit: { condition: METER, workingAssumption: true } }
/** After Mass Save confirms a definition, the same predicate becomes confirmed. */
const CONFIRMED: Record<string, NamedPredicate> = { condo_eligible_unit: { condition: METER, workingAssumption: false } }
const SPEC = { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } } as const
const ALL_UNITS: Condition = { allUnits: SPEC }

const at = (units: Unit[], predicates: Record<string, NamedPredicate>) =>
  scope(input({ building: { units } }), { unit: null, predicates })
const m = (id: string, participating: boolean | null, meter: boolean | null = true) =>
  unit(id, { hasResidentialHeatingMeter: meter, participating })

describe('allUnits with the definition still a working assumption (today)', () => {
  test('everyone agreed → yes: the definition doesn’t matter', () => {
    expect(evaluate(ALL_UNITS, at([m('1', true), m('2', true), m('3', true)], ASSUMED)).value).toBe('yes')
  })
  test('a metered unit said no → unknown, not no: it is only "likely needed"', () => {
    expect(evaluate(ALL_UNITS, at([m('1', true), m('2', true), m('3', false)], ASSUMED)))
      .toEqual({ value: 'unknown', missing: [], assumptions: ['condo_eligible_unit'] })
  })
  test('a unit with NO heating meter said no → unknown, and it counts as undecided (Qiao, 2026-11-06)', () => {
    const s = at([m('1', true), m('2', true), m('3', false, false)], ASSUMED)
    expect(evaluate(ALL_UNITS, s)).toEqual({ value: 'unknown', missing: [], assumptions: ['condo_eligible_unit'] })
    expect(participation(SPEC, s)).toEqual({
      needed: [], likelyNeeded: [], undecided: ['3'], missing: [], assumptions: ['condo_eligible_unit'],
    })
  })
  test('an undecided answer asks for participation', () => {
    expect(evaluate(ALL_UNITS, at([m('1', true), m('2', null)], ASSUMED)))
      .toEqual({ value: 'unknown', missing: ['unit.participating'], assumptions: ['condo_eligible_unit'] })
  })
})

describe('participation counts (the "N more units needed" hint)', () => {
  test('metered unit said no → likely needed, not needed', () => {
    expect(participation(SPEC, at([m('1', true), m('2', true), m('3', false)], ASSUMED))).toEqual({
      needed: [], likelyNeeded: ['3'], undecided: [], missing: [], assumptions: ['condo_eligible_unit'],
    })
  })
  test('unknown meter and said no → undecided, and we ask about the meter', () => {
    expect(participation(SPEC, at([m('1', true), m('2', false, null)], ASSUMED))).toEqual({
      needed: [], likelyNeeded: [], undecided: ['2'], missing: ['unit.hasResidentialHeatingMeter'], assumptions: ['condo_eligible_unit'],
    })
  })
})

describe('once the definition is confirmed, the same data gives definite answers', () => {
  test('a metered unit said no → no, and it is needed', () => {
    const s = at([m('1', true), m('2', true), m('3', false)], CONFIRMED)
    expect(evaluate(ALL_UNITS, s).value).toBe('no')
    expect(participation(SPEC, s)).toEqual({ needed: ['3'], likelyNeeded: [], undecided: [], missing: [], assumptions: [] })
  })
  test('an unmetered unit is not needed', () => {
    expect(evaluate(ALL_UNITS, at([m('1', true), m('2', false, false)], CONFIRMED)).value).toBe('yes')
  })
  test('a definite no beats another unit being undecided', () => {
    expect(evaluate(ALL_UNITS, at([m('1', false), m('2', null)], CONFIRMED)).value).toBe('no')
  })
})
