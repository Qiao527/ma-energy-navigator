import { describe, expect, test } from 'vitest'
import type { OfferResult } from '../src/offers.js'
import { buildSteps } from '../src/plan.js'
import { OfferSchema, offerKey, SequenceEdgeSchema, type Measure, type Offer } from '../src/rules-schema.js'
import { OFFER, SOURCE } from './fixtures.js'

const offers = new Map<string, Offer>(
  (['assessment', 'weatherization', 'heat_pump', 'community_solar'] as Measure[]).map(m => {
    const o = OfferSchema.parse({ ...OFFER, id: m, measure: m })
    return [offerKey(o), o]
  }),
)
const res = (offerId: string, status: OfferResult['status'] = 'eligible'): OfferResult => ({
  offerId, version: '1', unitId: null, status, reason: null, missing: [], confirmations: [], prerequisites: [],
  value: null, recipient: 'property_owner', changes: null,
})
const edge = (before: Measure, after: Measure) => SequenceEdgeSchema.parse({ before, after, reason: `${before} first`, sources: [SOURCE] })

describe('buildSteps', () => {
  test('orders by edges, then by MEASURE_ORDER', () => {
    const steps = buildSteps([res('heat_pump'), res('community_solar'), res('weatherization'), res('assessment')], offers,
      [edge('weatherization', 'heat_pump'), edge('assessment', 'weatherization')])
    expect(steps.map(s => s.measure)).toEqual(['assessment', 'weatherization', 'heat_pump', 'community_solar'])
    expect(steps[2]?.after).toEqual([{ measure: 'weatherization', reason: 'weatherization first' }])
  })
  test('potential and needs_info make steps; not_eligible does not', () => {
    const steps = buildSteps([res('heat_pump', 'potential'), res('assessment', 'needs_info'), res('weatherization', 'not_eligible')], offers,
      [edge('weatherization', 'heat_pump')])
    expect(steps.map(s => s.measure)).toEqual(['assessment', 'heat_pump'])
  })
  test('a cycle throws', () => {
    expect(() => buildSteps([res('heat_pump'), res('weatherization')], offers,
      [edge('weatherization', 'heat_pump'), edge('heat_pump', 'weatherization')])).toThrow(/cycle/)
  })
})
