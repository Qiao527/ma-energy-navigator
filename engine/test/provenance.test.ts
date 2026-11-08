import { describe, expect, test } from 'vitest'
import { daysBetween, dataStatus, findDataProblems, freshness, inWindow, isStale } from '../src/provenance.js'
import { OfferSchema, RuleSetSchema, type Offer, type RuleSet } from '../src/rules-schema.js'
import { OFFER, SOURCE } from './fixtures.js'

const offer = (over: Record<string, unknown> = {}): Offer => OfferSchema.parse({ ...OFFER, ...over })
const OLD_SOURCE = { ...SOURCE, lastVerified: '2026-01-02' }
const TABLE = { id: 't', label: 'T', window: { from: '2026-10-01', until: '2027-09-30' }, bySize: [50_000], sources: [OLD_SOURCE] }

function ruleSet(over: Partial<RuleSet> = {}): RuleSet {
  return RuleSetSchema.parse({
    programs: [{ id: 'masssave_weatherization', name: 'Mass Save weatherization', administrator: 'Mass Save Sponsors',
      handoff: { label: 'Call Mass Save', phone: '866-527-7283', url: 'https://www.masssave.com/' }, sources: [SOURCE] }],
    offers: [OFFER],
    predicates: [],
    incomeTables: [TABLE],
    dec: { municipalities: [{ name: 'Boston', narrowedFor: [] }], sources: [SOURCE] },
    caps: [],
    sequence: [],
    ...over,
  })
}

describe('dates', () => {
  test('daysBetween', () => {
    expect(daysBetween('2026-11-06', '2027-02-04')).toBe(90)
  })
  test('stale after 90 days', () => {
    expect(isStale('2026-11-06', '2027-02-04')).toBe(false)
    expect(isStale('2026-11-06', '2027-02-05')).toBe(true)
  })
  test('inWindow includes both ends', () => {
    const w = { from: '2026-01-01', until: '2026-12-31' }
    expect(inWindow(w, '2026-01-01')).toBe(true)
    expect(inWindow(w, '2026-12-31')).toBe(true)
    expect(inWindow(w, '2027-01-01')).toBe(false)
  })
})

describe('findDataProblems (structural; no dates)', () => {
  test('clean data has no problems', () => {
    expect(findDataProblems(ruleSet())).toEqual([])
  })
  test('unknown fact path, including inside prerequisites and confirmations', () => {
    const bad = offer({
      eligibility: { fact: 'unit.occupancyy', op: 'eq', value: 'renter' },
      prerequisites: [{ id: 'p', kind: 'action', description: 'd', satisfiedWhen: { fact: 'nope.a', op: 'eq', value: true }, sources: [SOURCE] }],
      confirmations: [{ id: 'c', question: 'q', decidedBy: 'x', nextAction: 'y', when: { fact: 'nope.b', op: 'eq', value: true }, sources: [SOURCE] }],
    })
    const problems = findDataProblems(ruleSet({ offers: [bad] }))
    expect(problems).toContain('offer test_offer@1: unknown fact path unit.occupancyy')
    expect(problems).toContain('offer test_offer@1: unknown fact path nope.a')
    expect(problems).toContain('offer test_offer@1: unknown fact path nope.b')
  })
  test('unknown program', () => {
    expect(findDataProblems(ruleSet({ offers: [offer({ programId: 'nope' })] }))).toContain('offer test_offer@1: unknown program nope')
  })
  test('duplicate id + version', () => {
    expect(findDataProblems(ruleSet({ offers: [offer(), offer()] }))).toContain('duplicate offer test_offer@1')
  })
  test('overlapping versions of the same offer', () => {
    const a = offer({ version: '2026', effective: { from: '2026-01-01', until: '2026-12-31' } })
    const b = offer({ version: '2027', effective: { from: '2026-12-01', until: null } })
    expect(findDataProblems(ruleSet({ offers: [a, b] }))).toContain('offer test_offer: versions 2026 and 2027 overlap')
  })
  test('unknown income table, predicate and cap group', () => {
    const bad = offer({ eligibility: { all: [{ incomeAtMost: 'missing_table' }, { ref: 'missing_pred' }] }, capGroups: ['nope'] })
    const problems = findDataProblems(ruleSet({ offers: [bad] }))
    expect(problems).toContain('offer test_offer@1: unknown income table missing_table')
    expect(problems).toContain('offer test_offer@1: unknown predicate missing_pred')
    expect(problems).toContain('offer test_offer@1: no cap rule for capGroup nope')
  })
  test('an offer must not run past the window of an income table it uses (review A5)', () => {
    const open = offer({ eligibility: { incomeAtMost: 't' }, effective: { from: '2026-10-01', until: null } })
    expect(findDataProblems(ruleSet({ offers: [open] }))).toContain('offer test_offer@1: runs outside the window of income table t')
    const inside = offer({ eligibility: { incomeAtMost: 't' }, effective: { from: '2026-10-01', until: '2027-09-30' } })
    expect(findDataProblems(ruleSet({ offers: [inside] }))).toEqual([])
  })
  test('a coordination prerequisite must be an allUnits condition', () => {
    const bad = offer({ prerequisites: [{ id: 'c', kind: 'coordination', description: 'd', satisfiedWhen: { fact: 'unit.participating', op: 'eq', value: true }, sources: [SOURCE] }] })
    expect(findDataProblems(ruleSet({ offers: [bad] }))).toContain('offer test_offer@1: coordination prerequisite c must be an allUnits condition')
  })
})

describe('dataStatus (uses a given date; the CLI passes today)', () => {
  test('lists versions past both dates and programs with no current version', () => {
    const old = offer({ effective: { from: '2025-01-01', until: '2025-12-31' }, applicationDeadline: '2026-02-28' })
    expect(dataStatus(ruleSet({ offers: [old] }), '2026-11-15')).toEqual({
      pastBothDates: ['test_offer@1'], programsWithoutCurrentVersion: ['masssave_weatherization'],
    })
  })
  test('a version inside its application deadline is not past', () => {
    const v = offer({ effective: { from: '2026-01-01', until: '2026-12-31' }, applicationDeadline: '2027-02-28' })
    expect(dataStatus(ruleSet({ offers: [v] }), '2027-01-15').pastBothDates).toEqual([])
  })
})

describe('freshness includes what the offer depends on (review A6)', () => {
  test('a fresh offer using a stale income table is stale', () => {
    const o = offer({ eligibility: { incomeAtMost: 't' }, effective: { from: '2026-10-01', until: '2027-09-30' } })
    const rules = ruleSet({ offers: [o] })
    expect(freshness(o, rules)).toBe('2026-01-02')
    expect(isStale(freshness(o, rules), '2026-11-15')).toBe(true)
  })
})
