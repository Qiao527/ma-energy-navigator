import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import {
  add, capAt, complement, div, floorAt, minOf, mul, mulAny, point, range, scale, sub, sum, type Range,
} from '../src/range.js'

const num = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
const nonNeg = fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true })
const sorted = (a: number, b: number, c: number) => [a, b, c].sort((x, y) => x - y) as [number, number, number]
const arbRange = fc.tuple(num, num, num).map(([a, b, c]) => range(...sorted(a, b, c)))
const arbNonNeg = fc.tuple(nonNeg, nonNeg, nonNeg).map(([a, b, c]) => range(...sorted(a, b, c)))
const arbPositive = fc.tuple(nonNeg, nonNeg, nonNeg).map(([a, b, c]) => range(...sorted(a + 1, b + 1, c + 1)))
const ordered = (r: Range) => r.low <= r.mid && r.mid <= r.high

describe('range()', () => {
  test('rejects unordered values', () => {
    expect(() => range(3, 2, 1)).toThrow(RangeError)
  })
  test('rejects non-finite values', () => {
    expect(() => range(0, Number.NaN, 1)).toThrow(RangeError)
  })
  test('point() makes a zero-width range', () => {
    expect(point(5)).toEqual({ low: 5, mid: 5, high: 5 })
  })
})

describe('examples', () => {
  test('sub widens: low minus high', () => {
    expect(sub(range(10, 20, 30), range(1, 2, 3))).toEqual({ low: 7, mid: 18, high: 29 })
  })
  test('div uses opposite ends', () => {
    expect(div(range(10, 20, 40), range(2, 4, 5))).toEqual({ low: 2, mid: 5, high: 20 })
  })
  test('complement flips a fraction range', () => {
    expect(complement(range(0.05, 0.1, 0.15))).toEqual({ low: 0.85, mid: 0.9, high: 0.95 })
  })
  test('mulAny handles a range that crosses zero', () => {
    expect(mulAny(range(10, 20, 30), range(-2, 1, 3))).toEqual({ low: -60, mid: 20, high: 90 })
  })
  test('sum of nothing is zero', () => {
    expect(sum([])).toEqual(point(0))
  })
})

describe('order is preserved (property)', () => {
  test('add, sub, capAt, floorAt, minOf, mulAny', () => {
    fc.assert(fc.property(arbRange, arbRange, num, (a, b, k) => {
      expect(ordered(add(a, b))).toBe(true)
      expect(ordered(sub(a, b))).toBe(true)
      expect(ordered(capAt(a, k))).toBe(true)
      expect(ordered(floorAt(a, k))).toBe(true)
      expect(ordered(minOf(a, b))).toBe(true)
      expect(ordered(mulAny(a, b))).toBe(true)
    }))
  })
  test('scale, mul, div on non-negative ranges', () => {
    fc.assert(fc.property(arbNonNeg, arbNonNeg, arbPositive, nonNeg, (a, b, p, k) => {
      expect(ordered(scale(a, k))).toBe(true)
      expect(ordered(mul(a, b))).toBe(true)
      expect(ordered(div(a, p))).toBe(true)
    }))
  })
})
