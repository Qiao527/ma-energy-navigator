import { describe, expect, test } from 'vitest'
import { evaluate, participation, type Condition } from '../src/condition.js'
import type { Unit } from '../src/facts.js'
import { input, scope, unit } from './fixtures.js'

const PREDICATES = { condo_eligible_unit: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true } } as const
const ALL_UNITS_SPEC = { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } } as const
const ALL_UNITS: Condition = { allUnits: ALL_UNITS_SPEC }
const run = (units: Unit[]) => evaluate(ALL_UNITS, scope(input({ building: { units } }), { unit: null, predicates: PREDICATES }))
const m = (id: string, participating: boolean | null, meter: boolean | null = true) =>
  unit(id, { hasResidentialHeatingMeter: meter, participating })

describe('allUnits', () => {
  test('everyone eligible agreed → yes', () => {
    expect(run([m('1', true), m('2', true), m('3', true)]).value).toBe('yes')
  })
  test('one eligible unit said no → no', () => {
    expect(run([m('1', true), m('2', true), m('3', false)]).value).toBe('no')
  })
  test('an undecided eligible unit → unknown, asks for participation', () => {
    expect(run([m('1', true), m('2', null)])).toEqual({ value: 'unknown', missing: ['unit.participating'] })
  })
  test('an ineligible unit is not needed', () => {
    expect(run([m('1', true), m('2', false, false)]).value).toBe('yes')
  })
  test('unknown eligibility of a non-participating unit → unknown, asks for the meter', () => {
    expect(run([m('1', true), m('2', false, null)])).toEqual({ value: 'unknown', missing: ['unit.hasResidentialHeatingMeter'] })
  })
  test('a definite no beats another unit being undecided', () => {
    expect(run([m('1', false), m('2', null)]).value).toBe('no')
  })
})

describe('participation (the "N more units needed" count)', () => {
  const count = (units: Unit[]) =>
    participation(ALL_UNITS_SPEC, scope(input({ building: { units } }), { unit: null, predicates: PREDICATES }))
  test('a metered unit that said no is needed', () => {
    expect(count([m('1', true), m('2', true), m('3', false)])).toEqual({ needed: ['3'], undecided: [], missing: [] })
  })
  test('an unmetered unit that said no is not needed (under the working definition)', () => {
    expect(count([m('1', true), m('2', false, false)])).toEqual({ needed: [], undecided: [], missing: [] })
  })
  test('a unit with an unknown meter that said no is undecided, and we ask about the meter', () => {
    expect(count([m('1', true), m('2', false, null)])).toEqual({ needed: [], undecided: ['2'], missing: ['unit.hasResidentialHeatingMeter'] })
  })
  test('an eligible unit that has not answered is undecided', () => {
    expect(count([m('1', true), m('2', null)])).toEqual({ needed: [], undecided: ['2'], missing: ['unit.participating'] })
  })
})
