import { describe, expect, test } from 'vitest'
import { CapRuleSchema, OfferSchema, PredicateSchema } from '../src/rules-schema.js'
import { OFFER, SOURCE } from './fixtures.js'

describe('OfferSchema', () => {
  test('accepts a valid offer', () => {
    expect(OfferSchema.parse(OFFER).id).toBe('test_offer')
  })
  test('rejects an offer without sources (principle 3)', () => {
    expect(() => OfferSchema.parse({ ...OFFER, sources: [] })).toThrow()
  })
  test('rejects a percent over 100', () => {
    expect(() => OfferSchema.parse({ ...OFFER, benefit: { type: 'percent_of_cost', pct: 120, costOf: 'weatherization' } })).toThrow()
  })
  test('rejects an unknown operator', () => {
    expect(() => OfferSchema.parse({ ...OFFER, eligibility: { fact: 'unit.occupancy', op: 'equals', value: 'renter' } })).toThrow()
  })
  test('rejects a comparison against a non-number', () => {
    expect(() => OfferSchema.parse({ ...OFFER, eligibility: { fact: 'building.yearBuilt', op: 'gte', value: '2000' } })).toThrow()
  })
  test('accepts nested conditions, refs and all-units', () => {
    const eligibility = {
      all: [
        { any: [{ fact: 'unit.heatingFuel', op: 'in', value: ['oil'] }] },
        { not: { incomeAbove: 't' } },
        { allUnits: { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } } },
      ],
    }
    expect(OfferSchema.parse({ ...OFFER, eligibility }).eligibility).toEqual(eligibility)
  })
  test('accepts a coordination prerequisite', () => {
    const prerequisites = [{ id: 'all_agree', kind: 'coordination', description: 'Every eligible unit takes part.',
      satisfiedWhen: { allUnits: { eligible: { ref: 'p' }, require: { fact: 'unit.participating', op: 'eq', value: true } } }, sources: [SOURCE] }]
    expect(OfferSchema.parse({ ...OFFER, prerequisites }).prerequisites[0]?.kind).toBe('coordination')
  })
  test('rejects an unknown recipient', () => {
    expect(() => OfferSchema.parse({ ...OFFER, recipient: 'contractor' })).toThrow()
  })
  test('accepts a prerequisite that we cannot check (satisfiedWhen null)', () => {
    const prerequisites = [{ id: 'installer', kind: 'requirement', description: 'Use a network installer.', satisfiedWhen: null, sources: [SOURCE] }]
    expect(OfferSchema.parse({ ...OFFER, prerequisites }).prerequisites).toHaveLength(1)
  })
  test('rejects a bad date', () => {
    expect(() => OfferSchema.parse({ ...OFFER, effective: { from: '2026-13-01', until: null } })).toThrow()
  })
})

describe('CapRuleSchema', () => {
  test('accepts money and count limits', () => {
    const base = { id: 'c', capGroup: 'g', scope: 'account', window: { from: '2026-01-01', until: null }, sources: [SOURCE] }
    expect(CapRuleSchema.parse({ ...base, limit: { type: 'money', amount: 8500 } }).limit.type).toBe('money')
    expect(CapRuleSchema.parse({ ...base, limit: { type: 'count', count: 1 } }).limit.type).toBe('count')
  })
})

describe('PredicateSchema', () => {
  const p = { id: 'condo_eligible_unit', condition: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true }, note: 'n', sources: [SOURCE] }
  test('must say whether it is a working assumption', () => {
    expect(() => PredicateSchema.parse(p)).toThrow()
    expect(PredicateSchema.parse({ ...p, workingAssumption: true }).workingAssumption).toBe(true)
  })
})
