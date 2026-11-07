import { describe, expect, test } from 'vitest'
import { NO_QUANTITIES, type Quantities } from '../src/benefit.js'
import { estimate } from '../src/estimate.js'
import { applyCaps, chooseBest, evaluateOffer, type OfferResult } from '../src/offers.js'
import { range } from '../src/range.js'
import { CapRuleSchema, OfferSchema, offerKey, type Offer } from '../src/rules-schema.js'
import { input, OFFER, scope, SOURCE, unit } from './fixtures.js'

const ASOF = '2026-11-15'
const Q: Quantities = { ...NO_QUANTITIES, cost: { weatherization: estimate(range(6000, 9000, 12000), 'medium', 'fixture') } }
const offer = (over: Record<string, unknown> = {}): Offer => OfferSchema.parse({ ...OFFER, ...over })
const base = () => scope(input({
  userUnitId: '2',
  building: { units: [unit('1', { occupancy: 'owner' }), unit('2', { occupancy: 'renter' }), unit('3')] },
}), { unit: null })
const run = (o: Offer, s = base(), asOf = ASOF, q: Quantities = Q) => evaluateOffer(o, s, () => q, asOf)
const forUnit = (rs: OfferResult[], id: string) => rs.find(r => r.unitId === id)

describe('evaluateOffer: status', () => {
  test('eligible / not_eligible / needs_info per unit', () => {
    const rs = run(offer())
    expect(rs.map(r => [r.unitId, r.status])).toEqual([['1', 'not_eligible'], ['2', 'eligible'], ['3', 'needs_info']])
    expect(forUnit(rs, '2')?.value?.range).toEqual(range(6000, 9000, 12000))
    expect(forUnit(rs, '1')?.value).toBeNull()
    expect(forUnit(rs, '3')?.missing).toEqual(['unit.occupancy'])
  })
  test('user scope evaluates the user unit only', () => {
    expect(run(offer({ appliesTo: 'user' })).map(r => r.unitId)).toEqual(['2'])
  })
  test('an applicable confirmation makes an eligible result potential', () => {
    const confirmations = [{ id: 'c', question: 'q?', decidedBy: 'Mass Save', nextAction: 'Ask.', when: null, sources: [SOURCE] }]
    const r = forUnit(run(offer({ confirmations })), '2')
    expect(r?.status).toBe('potential')
    expect(r?.confirmations.map(c => c.decidedBy)).toEqual(['Mass Save'])
  })
  test('a confirmation whose `when` is no does not apply', () => {
    const confirmations = [{ id: 'c', question: 'q?', decidedBy: 'x', nextAction: 'y', when: { fact: 'unit.occupancy', op: 'eq', value: 'owner' }, sources: [SOURCE] }]
    expect(forUnit(run(offer({ confirmations })), '2')?.status).toBe('eligible')
  })
  test('a confirmation whose `when` is unknown asks the user first (review B09)', () => {
    const confirmations = [{ id: 'c', question: 'q?', decidedBy: 'x', nextAction: 'y', when: { fact: 'unit.heatingFuel', op: 'eq', value: 'oil' }, sources: [SOURCE] }]
    const r = forUnit(run(offer({ confirmations })), '2')
    expect(r?.status).toBe('needs_info')
    expect(r?.missing).toEqual(['unit.heatingFuel'])
  })
  test('application deadline passed → not_eligible with the reason (review A4)', () => {
    const o = offer({ applicationDeadline: '2027-02-28' })
    expect(forUnit(run(o, base(), '2027-02-28'), '2')?.status).toBe('eligible')
    expect(forUnit(run(o, base(), '2027-03-01'), '2')).toMatchObject({ status: 'not_eligible', reason: 'application_deadline_passed', changes: null })
  })
})

describe('evaluateOffer: prerequisites never change status (Qiao, 2026-11-06)', () => {
  test('a prerequisite still to do → eligible, with the step marked todo; one we cannot check → check', () => {
    const prerequisites = [
      { id: 'approval', kind: 'action', description: 'Landlord approves.', satisfiedWhen: { fact: 'building.ownerApproval', op: 'eq', value: true }, sources: [SOURCE] },
      { id: 'installer', kind: 'requirement', description: 'Use a network installer.', satisfiedWhen: null, sources: [SOURCE] },
    ]
    const s = base()
    const denied = scope({ ...s.input, building: { ...s.input.building, ownerApproval: false } }, { unit: null })
    const r = forUnit(run(offer({ prerequisites }), denied), '2')
    expect(r?.status).toBe('eligible')
    expect(r?.prerequisites.map(p => [p.id, p.state])).toEqual([['approval', 'todo'], ['installer', 'check']])
  })
  test('a coordination prerequisite reports the units still needed', () => {
    const prerequisites = [{ id: 'all_agree', kind: 'coordination', description: 'Every eligible unit takes part.',
      satisfiedWhen: { allUnits: { eligible: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true }, require: { fact: 'unit.participating', op: 'eq', value: true } } },
      sources: [SOURCE] }]
    const s = scope(input({
      userUnitId: '1',
      building: { units: [
        unit('1', { occupancy: 'renter', hasResidentialHeatingMeter: true, participating: true }),
        unit('2', { occupancy: 'renter', hasResidentialHeatingMeter: true, participating: false }),
        unit('3', { occupancy: 'renter', hasResidentialHeatingMeter: true, participating: null }),
      ] },
    }), { unit: null })
    const r = forUnit(run(offer({ prerequisites }), s), '1')
    expect(r?.status).toBe('eligible')
    expect(r?.prerequisites[0]).toMatchObject({ kind: 'coordination', state: 'todo', unitsNeeded: ['2'], unitsLikelyNeeded: [], unitsUndecided: ['3'] })
  })
})

describe('evaluateOffer: money and changes', () => {
  test('no cost source → no dollar value; the percentage stays in the offer terms', () => {
    expect(forUnit(run(offer(), base(), ASOF, NO_QUANTITIES), '2')?.value).toBeNull()
  })
  test('not eligible results carry what would change the answer', () => {
    const discount = offer({ appliesTo: 'user', eligibility: { fact: 'user.onDiscountRate', op: 'eq', value: true } })
    const s = base()
    const noRate = scope({ ...s.input, household: { ...s.input.household, onDiscountRate: false } }, { unit: null })
    expect(run(discount, noRate)[0]?.changes).toEqual([{ fact: 'user.onDiscountRate', to: true }])
  })
})

describe('chooseBest', () => {
  const offers = new Map<string, Offer>(['a', 'b', 'c', 'd'].map(id => {
    const o = offer({ id, exclusiveGroup: id === 'd' ? null : 'g' })
    return [offerKey(o), o]
  }))
  const r = (offerId: string, status: OfferResult['status'], mid: number | null, over: Partial<OfferResult> = {}): OfferResult => ({
    offerId, version: '1', unitId: '1', status, reason: null, missing: [], confirmations: [], prerequisites: [],
    value: mid === null ? null : estimate(range(mid, mid, mid), 'medium', 'fixture'), recipient: 'property_owner', changes: null, ...over,
  })
  test('keeps the best eligible; hides worse eligible and worse potential; keeps better potential, not_eligible and ungrouped', () => {
    const results = [r('a', 'eligible', 75), r('b', 'eligible', 50), r('c', 'potential', 100), r('b', 'potential', 10), r('a', 'not_eligible', null), r('d', 'eligible', 1)]
    expect(chooseBest(results, offers).map(x => `${x.offerId}:${x.status}`)).toEqual(['a:eligible', 'c:potential', 'a:not_eligible', 'd:eligible'])
  })
  test('ties keep the first', () => {
    expect(chooseBest([r('a', 'eligible', 75), r('b', 'eligible', 75)], offers).map(x => x.offerId)).toEqual(['a'])
  })
  test('an offer waiting on other units never hides the others (condo 75% stays)', () => {
    const waiting = r('a', 'eligible', 100, {
      prerequisites: [{ id: 'all_agree', kind: 'coordination', description: 'd', state: 'todo', unitsNeeded: ['3'], unitsLikelyNeeded: [], unitsUndecided: [] }],
    })
    expect(chooseBest([waiting, r('b', 'eligible', 75)], offers).map(x => x.offerId)).toEqual(['a', 'b'])
  })
  test('without dollar values, percent of the same cost decides', () => {
    const pct = new Map<string, Offer>(
      [offer({ id: 'hi', exclusiveGroup: 'g' }), offer({ id: 'lo', exclusiveGroup: 'g', benefit: { type: 'percent_of_cost', pct: 75, costOf: 'weatherization' } })]
        .map(o => [offerKey(o), o]),
    )
    expect(chooseBest([r('lo', 'eligible', null), r('hi', 'eligible', null)], pct).map(x => x.offerId)).toEqual(['hi'])
  })
  test('results that cannot be compared are both kept', () => {
    const mixed = new Map<string, Offer>(
      [offer({ id: 'pct', exclusiveGroup: 'g' }), offer({ id: 'ton', exclusiveGroup: 'g', benefit: { type: 'per_ton', rate: 2650, cap: 8500 } })]
        .map(o => [offerKey(o), o]),
    )
    expect(chooseBest([r('pct', 'eligible', null), r('ton', 'eligible', null)], mixed)).toHaveLength(2)
  })
})

describe('applyCaps', () => {
  const capBase = { id: 'hp_cap', capGroup: 'hp', scope: 'account', window: { from: '2026-01-01', until: '2026-12-31' }, sources: [SOURCE] }
  const money = CapRuleSchema.parse({ ...capBase, limit: { type: 'money', amount: 8500 } })
  const count = CapRuleSchema.parse({ ...capBase, id: 'one_per_account', limit: { type: 'count', count: 1 } })
  const lifetime = CapRuleSchema.parse({ ...capBase, id: 'loan_lifetime', scope: 'customer_lifetime', limit: { type: 'money', amount: 25000 } })
  const offers = new Map<string, Offer>(['x', 'y'].map(id => {
    const o = offer({ id, capGroups: ['hp'] })
    return [offerKey(o), o]
  }))
  const res = (offerId: string, low: number, high: number): OfferResult => ({
    offerId, version: '1', unitId: '1', status: 'eligible', reason: null, missing: [], confirmations: [], prerequisites: [],
    value: estimate(range(low, (low + high) / 2, high), 'medium', 'fixture'), recipient: 'property_owner', changes: null,
  })
  test('account money caps clip the per-unit sum and state the assumption (review A10)', () => {
    expect(applyCaps([res('x', 5000, 8000), res('y', 1000, 2000)], offers, [money], '2026-06-01')).toEqual([
      { capId: 'hp_cap', unitId: '1', scope: 'account', limit: { type: 'money', amount: 8500 }, total: range(6000, 8000, 8500), capped: true, assumption: 'one account per unit' },
    ])
  })
  test('count caps and lifetime caps are notes without a total', () => {
    expect(applyCaps([res('x', 5000, 8000)], offers, [count], '2026-06-01')[0]).toMatchObject({ capId: 'one_per_account', total: null, capped: false })
    expect(applyCaps([res('x', 5000, 8000)], offers, [lifetime], '2026-06-01')[0]).toMatchObject({ capId: 'loan_lifetime', total: null, capped: false })
  })
  test('caps outside their window are ignored', () => {
    expect(applyCaps([res('x', 5000, 8000)], offers, [money], '2027-06-01')).toEqual([])
  })
})
