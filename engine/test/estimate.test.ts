import { describe, expect, test } from 'vitest'
import { combine, estimate } from '../src/estimate.js'
import { range } from '../src/range.js'

describe('combine', () => {
  test('takes the lowest confidence and keeps every reason once', () => {
    const a = estimate(range(1, 2, 3), 'medium', 'heat pump $/ton: EEAC invoice study')
    const b = estimate(range(2, 3, 4), 'low', 'tons per unit: example size')
    const c = combine(range(2, 6, 12), [a, b, a])
    expect(c.confidence).toBe('low')
    expect(c.why).toEqual(['heat pump $/ton: EEAC invoice study', 'tons per unit: example size'])
  })
  test('with no inputs the confidence is high (fixed by rule)', () => {
    expect(combine(range(1, 1, 1), [], 'fixed in program rules').confidence).toBe('high')
  })
})
