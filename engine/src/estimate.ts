import type { Range } from './range.js'

export type Confidence = 'low' | 'medium' | 'high'

/** A money or quantity value with the confidence label and the reasons behind it (principle 2). */
export interface Estimate {
  range: Range
  confidence: Confidence
  why: string[]
}

const ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }

export const estimate = (range: Range, confidence: Confidence, ...why: string[]): Estimate => ({ range, confidence, why })

/** A value computed from other estimates: lowest confidence, every reason kept once. */
export function combine(range: Range, inputs: readonly Estimate[], ...extra: string[]): Estimate {
  const confidence = inputs.reduce<Confidence>((c, e) => (ORDER[e.confidence] < ORDER[c] ? e.confidence : c), 'high')
  const why = [...new Set([...inputs.flatMap(e => e.why), ...extra])]
  return { range, confidence, why }
}
