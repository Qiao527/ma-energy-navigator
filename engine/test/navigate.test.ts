import { describe, expect, test } from 'vitest'
import { NO_QUANTITIES } from '../src/benefit.js'
import { navigate } from '../src/navigate.js'
import { RuleSetSchema } from '../src/rules-schema.js'
import { input, OFFER, SOURCE, unit } from './fixtures.js'

const version = (v: string, from: string, until: string | null, deadline: string | null) => ({
  ...OFFER, id: 'rebate', version: v, dateBasis: 'installation', effective: { from, until }, applicationDeadline: deadline, exclusiveGroup: null,
})
const rules = RuleSetSchema.parse({
  programs: [{ id: 'masssave_weatherization', name: 'P', administrator: 'A', handoff: { label: 'L', phone: null, url: 'https://www.masssave.com/' }, sources: [SOURCE] }],
  offers: [version('2026', '2026-01-01', '2026-12-31', '2027-02-28'), version('2027', '2027-01-01', null, null)],
  predicates: [], incomeTables: [],
  dec: { municipalities: [{ name: 'Boston', narrowedFor: [] }], sources: [SOURCE] },
  caps: [], sequence: [],
})
const i = input({ userUnitId: '1', building: { units: [unit('1', { occupancy: 'renter' }), unit('2')] } })
const nav = (asOf: string, installDate: string | null) => navigate(i, rules, { asOf, installDate }, () => NO_QUANTITIES)

describe('navigate: versions and deadlines (schema §5)', () => {
  test('a planned 2027 install uses the 2027 version', () => {
    const r = nav('2026-11-15', '2027-02-01')
    expect([...new Set(r.evaluated.map(x => x.version))]).toEqual(['2027'])
    expect(r.upcoming).toEqual([])
  })
  test('unknown install date: today’s version, the upcoming one listed, and the date asked', () => {
    const r = nav('2026-11-15', null)
    expect([...new Set(r.evaluated.map(x => x.version))]).toEqual(['2026'])
    expect(r.upcoming).toEqual([{ offerId: 'rebate', version: '2027', from: '2027-01-01' }])
    expect(r.questions).toContainEqual({ fact: 'project.installDate', unitId: null, about: 'project' })
  })
  test('a 2026 install looked at after its paperwork deadline is not eligible, with the reason', () => {
    const r = nav('2027-03-01', '2026-12-01')
    expect(r.evaluated.find(x => x.unitId === '1')).toMatchObject({ version: '2026', status: 'not_eligible', reason: 'application_deadline_passed' })
  })
  test('already installed (install date on or before today): the missed deadline is shown with its date (Qiao, 2026-11-07)', () => {
    const r = nav('2027-03-01', '2026-12-01')
    expect(r.shown.find(x => x.unitId === '1')).toMatchObject({
      version: '2026', status: 'not_eligible', reason: 'application_deadline_passed', applicationDeadline: '2027-02-28',
    })
  })
  test('already installed: no upcoming versions and no install-date question', () => {
    const r = nav('2027-03-01', '2026-12-01')
    expect(r.upcoming).toEqual([])
    expect(r.questions.some(q => q.fact === 'project.installDate')).toBe(false)
  })
  test('still planning: last year’s version is neither evaluated nor shown', () => {
    for (const installDate of [null, '2027-04-01']) {
      const r = nav('2027-03-01', installDate)
      expect([...new Set(r.evaluated.map(x => x.version))]).toEqual(['2027'])
      expect(r.shown.every(x => x.version === '2027')).toBe(true)
    }
  })
})

describe('navigate: questions say whose fact it is (review B13)', () => {
  test('another unit’s unknown fact is marked other_unit', () => {
    expect(nav('2026-11-15', null).questions).toContainEqual({ fact: 'unit.occupancy', unitId: '2', about: 'other_unit' })
  })
})

describe('navigate: only ask what is actually missing', () => {
  const coordination = RuleSetSchema.parse({
    ...rules,
    offers: [{
      ...OFFER, id: 'condo_all', exclusiveGroup: null, eligibility: { fact: 'unit.occupancy', op: 'eq', value: 'owner' },
      prerequisites: [{ id: 'all_agree', kind: 'coordination', description: 'Every eligible unit takes part.',
        satisfiedWhen: { allUnits: { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } } },
        sources: [SOURCE] }],
    }],
    predicates: [{ id: 'condo_eligible_unit', condition: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true }, workingAssumption: true, note: 'n', sources: [SOURCE] }],
  })
  const ask = (third: { participating: boolean | null; hasResidentialHeatingMeter: boolean | null }) => navigate(input({
    userUnitId: '1',
    building: { units: [unit('1', { occupancy: 'owner', hasResidentialHeatingMeter: true, participating: true }), unit('2', { occupancy: 'owner', ...third })] },
  }), coordination, { asOf: '2026-11-15', installDate: null }, () => NO_QUANTITIES).questions
  test('a unit without a meter that already said no is not asked again (only the definition is open)', () => {
    expect(ask({ participating: false, hasResidentialHeatingMeter: false })).toEqual([])
  })
  test('a unit that hasn’t answered is asked, as another unit’s question', () => {
    expect(ask({ participating: null, hasResidentialHeatingMeter: true })).toContainEqual({ fact: 'unit.participating', unitId: '2', about: 'other_unit' })
  })
})

describe('navigate: hot water questions (F2, Qiao 2026-11-07)', () => {
  const ask = (units: ReturnType<typeof unit>[]) =>
    navigate(input({ userUnitId: '1', building: { units } }), rules, { asOf: '2026-11-15', installDate: null }, () => NO_QUANTITIES)
      .questions.filter(q => q.fact.startsWith('unit.hotWater'))
  test('a unit with a fuel-burning system or fuel records is asked whether the boiler heats its hot water', () => {
    expect(ask([unit('1', { heatingFuel: 'oil' }), unit('2', { fuelRecords: [{ year: 2024, quantity: 400, unit: 'gallons' }] })])).toEqual([
      { fact: 'unit.hotWaterFromBoiler', unitId: '1', about: 'own_unit' },
      { fact: 'unit.hotWaterFromBoiler', unitId: '2', about: 'other_unit' },
    ])
  })
  test('no boiler fuel and no records → not asked', () => {
    expect(ask([unit('1', { heatingFuel: 'electric_resistance' }), unit('2')])).toEqual([])
  })
  test('yes → ask what heats the water after the heat pump; both answered → nothing asked', () => {
    expect(ask([unit('1', { heatingFuel: 'oil', hotWaterFromBoiler: true })])).toEqual([{ fact: 'unit.hotWaterAfter', unitId: '1', about: 'own_unit' }])
    expect(ask([unit('1', { heatingFuel: 'oil', hotWaterFromBoiler: true, hotWaterAfter: 'boiler' })])).toEqual([])
    expect(ask([unit('1', { heatingFuel: 'oil', hotWaterFromBoiler: false })])).toEqual([])
  })
})

describe('navigate: an offer arranged before installation, on an installed project (F1)', () => {
  const turnkey = {
    ...OFFER, id: 'turnkey', version: '1', dateBasis: 'as_of', effective: { from: '2025-01-01', until: null }, applicationDeadline: null, exclusiveGroup: null,
    confirmations: [{ id: 'installed_project', question: 'Does an installed project qualify?', decidedBy: 'Mass Save', nextAction: 'Ask Mass Save.', when: { fact: 'project.installed', op: 'eq', value: true }, sources: [SOURCE] }],
  }
  const plain = { ...OFFER, id: 'plain', version: '1', dateBasis: 'as_of', effective: { from: '2025-01-01', until: null }, applicationDeadline: null, exclusiveGroup: null }
  const r2 = RuleSetSchema.parse({ ...rules, offers: [turnkey, plain] })
  const run = (asOf: string, installDate: string | null) => navigate(i, r2, { asOf, installDate }, () => NO_QUANTITIES)
  test('installed: the offer stays, as potential, carrying the confirmation, and sorts after the others', () => {
    const r = run('2027-03-01', '2026-12-01')
    const t = r.shown.filter(x => x.offerId === 'turnkey' && x.unitId === '1')
    expect(t.length).toBe(1)
    expect(t.every(x => x.status === 'potential' && x.confirmations.some(c => c.id === 'installed_project'))).toBe(true)
    const firstTurnkey = r.shown.findIndex(x => x.offerId === 'turnkey')
    expect(r.shown.slice(firstTurnkey).every(x => x.offerId === 'turnkey')).toBe(true)
  })
  test('still planning, or no install date: the confirmation does not apply', () => {
    for (const installDate of [null, '2027-04-01']) {
      const t = run('2026-11-15', installDate).shown.find(x => x.offerId === 'turnkey' && x.unitId === '1')
      expect(t?.confirmations.some(c => c.id === 'installed_project')).toBe(false)
    }
  })
})
