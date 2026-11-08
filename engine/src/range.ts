/** A money or quantity estimate. Never a single falsely precise number (CONTRIBUTING.md principle 2). */
export interface Range {
  readonly low: number
  readonly mid: number
  readonly high: number
}

export function range(low: number, mid: number, high: number): Range {
  if (![low, mid, high].every(Number.isFinite)) throw new RangeError(`non-finite range ${low}/${mid}/${high}`)
  if (!(low <= mid && mid <= high)) throw new RangeError(`unordered range ${low}/${mid}/${high}`)
  return { low, mid, high }
}

export const point = (x: number): Range => range(x, x, x)

export const add = (a: Range, b: Range): Range => range(a.low + b.low, a.mid + b.mid, a.high + b.high)

/** Interval subtraction: the widest honest result. */
export const sub = (a: Range, b: Range): Range => range(a.low - b.high, a.mid - b.mid, a.high - b.low)

export const sum = (rs: readonly Range[]): Range => rs.reduce(add, point(0))

export function scale(a: Range, k: number): Range {
  if (!(k >= 0)) throw new RangeError(`scale factor must be >= 0, got ${k}`)
  return range(a.low * k, a.mid * k, a.high * k)
}

function assertNonNegative(a: Range, name: string): void {
  if (a.low < 0) throw new RangeError(`${name} must be non-negative`)
}

/** Product of two non-negative ranges. */
export function mul(a: Range, b: Range): Range {
  assertNonNegative(a, 'a')
  assertNonNegative(b, 'b')
  return range(a.low * b.low, a.mid * b.mid, a.high * b.high)
}

/** Product of any two ranges (endpoints may be negative). */
export function mulAny(a: Range, b: Range): Range {
  const corners = [a.low * b.low, a.low * b.high, a.high * b.low, a.high * b.high]
  return range(Math.min(...corners), a.mid * b.mid, Math.max(...corners))
}

/** Non-negative numerator divided by a strictly positive denominator. */
export function div(a: Range, b: Range): Range {
  assertNonNegative(a, 'numerator')
  if (!(b.low > 0)) throw new RangeError('denominator must be strictly positive')
  return range(a.low / b.high, a.mid / b.mid, a.high / b.low)
}

export const capAt = (a: Range, cap: number): Range =>
  range(Math.min(a.low, cap), Math.min(a.mid, cap), Math.min(a.high, cap))

export const floorAt = (a: Range, floor: number): Range =>
  range(Math.max(a.low, floor), Math.max(a.mid, floor), Math.max(a.high, floor))

export const minOf = (a: Range, b: Range): Range =>
  range(Math.min(a.low, b.low), Math.min(a.mid, b.mid), Math.min(a.high, b.high))

/** 1 − r for a fraction range within [0, 1]. */
export function complement(r: Range): Range {
  if (r.low < 0 || r.high > 1) throw new RangeError('complement needs a fraction within [0, 1]')
  return range(1 - r.high, 1 - r.mid, 1 - r.low)
}
