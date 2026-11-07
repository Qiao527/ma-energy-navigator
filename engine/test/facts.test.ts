import { describe, expect, test } from 'vitest'
import { InputSchema } from '../src/facts.js'
import { input, unit } from './fixtures.js'

describe('InputSchema', () => {
  test('accepts a minimal input with unknowns', () => {
    expect(InputSchema.parse(input())).toBeTruthy()
  })
  test('rejects more than 4 units', () => {
    const units = ['1', '2', '3', '4', '5'].map(id => unit(id))
    expect(() => InputSchema.parse(input({ building: { units } }))).toThrow()
  })
  test('rejects duplicate unit ids', () => {
    expect(() => InputSchema.parse(input({ building: { units: [unit('1'), unit('1')] } }))).toThrow(/unique/)
  })
  test('rejects an income band with low > high', () => {
    expect(() => InputSchema.parse(input({ household: { incomeBand: { low: 5, high: 1 } } }))).toThrow()
  })
  test('rejects a userUnitId that matches no unit', () => {
    expect(() => InputSchema.parse(input({ userUnitId: '9' }))).toThrow(/userUnitId/)
  })
  test('rejects unknown keys (typos in the form mapping)', () => {
    expect(() => InputSchema.parse({ ...input(), extra: true })).toThrow()
  })
})
