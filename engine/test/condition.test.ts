import { describe, expect, test } from 'vitest'
import { evaluate, type Condition } from '../src/condition.js'
import { input, scope, unit } from './fixtures.js'

const TABLES = { ie: [50_000, 70_000, 90_000] }
const renter = () => scope(input({ building: { units: [unit('1', { occupancy: 'renter' })] } }))

describe('leaves', () => {
  test('eq: yes / no / unknown', () => {
    const c: Condition = { fact: 'unit.occupancy', op: 'eq', value: 'renter' }
    expect(evaluate(c, renter()).value).toBe('yes')
    expect(evaluate(c, scope(input({ building: { units: [unit('1', { occupancy: 'owner' })] } }))).value).toBe('no')
    expect(evaluate(c, scope(input()))).toEqual({ value: 'unknown', missing: ['unit.occupancy'] })
  })
  test('in', () => {
    const s = scope(input({ building: { units: [unit('1', { heatingFuel: 'oil' })] } }))
    expect(evaluate({ fact: 'unit.heatingFuel', op: 'in', value: ['oil', 'propane'] }, s).value).toBe('yes')
  })
  test('gte / gt / lte / lt', () => {
    const s = scope(input({ building: { yearBuilt: 2000 } }))
    expect(evaluate({ fact: 'building.yearBuilt', op: 'gte', value: 2000 }, s).value).toBe('yes')
    expect(evaluate({ fact: 'building.yearBuilt', op: 'gt', value: 2000 }, s).value).toBe('no')
    expect(evaluate({ fact: 'building.yearBuilt', op: 'lte', value: 2000 }, s).value).toBe('yes')
    expect(evaluate({ fact: 'building.yearBuilt', op: 'lt', value: 2000 }, s).value).toBe('no')
  })
})

describe('combinators (Kleene logic)', () => {
  const yes: Condition = { fact: 'unit.occupancy', op: 'eq', value: 'renter' }
  const no: Condition = { fact: 'unit.occupancy', op: 'eq', value: 'owner' }
  const unk: Condition = { fact: 'unit.heatingFuel', op: 'eq', value: 'oil' }
  test('all: a no wins over unknown', () => {
    expect(evaluate({ all: [yes, unk, no] }, renter()).value).toBe('no')
    expect(evaluate({ all: [yes, unk] }, renter())).toEqual({ value: 'unknown', missing: ['unit.heatingFuel'] })
    expect(evaluate({ all: [yes, yes] }, renter()).value).toBe('yes')
  })
  test('any: a yes wins over unknown', () => {
    expect(evaluate({ any: [no, unk, yes] }, renter()).value).toBe('yes')
    expect(evaluate({ any: [no, unk] }, renter()).value).toBe('unknown')
    expect(evaluate({ any: [no, no] }, renter()).value).toBe('no')
  })
  test('not keeps unknown', () => {
    expect(evaluate({ not: yes }, renter()).value).toBe('no')
    expect(evaluate({ not: unk }, renter()).value).toBe('unknown')
  })
})

describe('named predicates', () => {
  test('ref evaluates the predicate', () => {
    const s = scope(renter().input, { predicates: { is_renter: { fact: 'unit.occupancy', op: 'eq', value: 'renter' } } })
    expect(evaluate({ ref: 'is_renter' }, s).value).toBe('yes')
  })
  test('unknown ref throws', () => {
    expect(() => evaluate({ ref: 'nope' }, renter())).toThrow(/unknown predicate/)
  })
})

describe('income tables', () => {
  const withIncome = (size: number | null, band: { low: number; high: number } | null) =>
    scope(input({ household: { size, incomeBand: band } }), { incomeTables: TABLES })
  test('band fully under the limit', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(2, { low: 40_000, high: 60_000 })).value).toBe('yes')
    expect(evaluate({ incomeAbove: 'ie' }, withIncome(2, { low: 40_000, high: 60_000 })).value).toBe('no')
  })
  test('band straddling the limit is unknown', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(2, { low: 60_000, high: 80_000 })))
      .toEqual({ value: 'unknown', missing: ['user.incomeBand'] })
  })
  test('household larger than the table uses the last row', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(9, { low: 85_000, high: 89_000 })).value).toBe('yes')
  })
  test('missing size and band are both reported', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(null, null)).missing).toEqual(['user.householdSize', 'user.incomeBand'])
  })
  test('unknown table id throws', () => {
    expect(() => evaluate({ incomeAtMost: 'nope' }, withIncome(1, { low: 0, high: 0 }))).toThrow(/unknown income table/)
  })
})
