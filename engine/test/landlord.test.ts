import { describe, expect, test } from 'vitest'
import { estimate } from '../src/estimate.js'
import { heatPumpSwitch } from '../src/finance.js'
import { landlordView, type LandlordInput } from '../src/landlord.js'
import { range } from '../src/range.js'

const e = (low: number, mid: number, high: number) => estimate(range(low, mid, high), 'medium', 'fixture')
const sw = heatPumpSwitch({
  load: e(50, 60, 70), fuelEfficiency: e(0.8, 0.8, 0.8), fuelPricePerMMBtu: e(30, 30, 30),
  seasonalCop: e(2.5, 2.5, 2.5), electricityPricePerKwh: e(0.3, 0.3, 0.3),
})
// Story 1: the owner lives in unit 1 and pays both bills there. In units 2 and 3 the landlord pays the oil heat
// and the tenants pay electricity — the classic split.
const story1 = (over: Partial<LandlordInput> = {}): LandlordInput => ({
  ownUnitId: '1',
  units: [
    { unitId: '1', heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'owner', bills: sw },
    { unitId: '2', heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', bills: sw },
    { unitId: '3', heatingFuel: 'oil', heatPaidBy: 'owner', electricPaidBy: 'tenant', bills: sw },
  ],
  projectCost: e(45000, 55000, 65000),
  incentives: [{ offerId: 'ashp_whole_home', value: e(15900, 23850, 25500) }, { offerId: 'dec_weatherization', value: null }],
  rentCommitment: { months: null, forgoneIncreasePerUnitMonth: e(25, 50, 75), rentedUnits: 2 },
  avoidedReplacementCost: null,
  ...over,
})

describe('landlordView: whose bills change (Story 1)', () => {
  const v = landlordView(story1())
  test('own unit: the landlord gets the net change of both bills', () => {
    expect(v.ownUnit).toBe(sw.net)
  })
  test('rental units: the landlord saves the oil bill, the tenant’s electric bill goes up', () => {
    expect(v.rentals).toEqual([
      { unitId: '2', landlord: sw.fuelBill, tenant: sw.electricBill, unknownPayer: false },
      { unitId: '3', landlord: sw.fuelBill, tenant: sw.electricBill, unknownPayer: false },
    ])
    expect(v.tenantsPayingMore).toEqual(['2', '3'])
  })
  test('the landlord’s total annual change adds the own unit and the rental bills the landlord pays', () => {
    expect(v.landlordAnnual?.range.mid).toBeCloseTo(sw.net.range.mid + 2 * sw.fuelBill.range.mid)
    expect(v.landlordAnnual?.range.high).toBeLessThan(0)
    expect(v.landlordAnnualIncomplete).toBe(false)
  })
})

describe('landlordView: incentives and upfront cost', () => {
  const v = landlordView(story1())
  test('known incentives are summed; ones without a dollar amount are listed, not guessed', () => {
    expect(v.incentivesKnown?.range).toEqual(range(15900, 23850, 25500))
    expect(v.incentivesWithoutAmount).toEqual(['dec_weatherization'])
  })
  test('coverage = incentives / project cost, never above 100%', () => {
    expect(v.coverage?.range.mid).toBeCloseTo(23850 / 55000)
    const rich = landlordView(story1({ incentives: [{ offerId: 'x', value: e(90000, 90000, 90000) }] }))
    expect(rich.coverage?.range.high).toBe(1)
  })
  test('net upfront cost is never negative', () => {
    expect(v.netUpfront.range.low).toBeGreaterThanOrEqual(0)
    expect(v.netUpfront.range.mid).toBeCloseTo(55000 - 23850)
  })
})

describe('landlordView: project commitment terms (the no-rent-increase commitment)', () => {
  test('unknown period → no cost, with the reason; payback says it leaves the commitment out', () => {
    const v = landlordView(story1())
    expect(v.projectCommitment).toEqual({ cost: null, reason: 'The length of the project commitment period is not published.' })
    expect(v.paybackExcludesCommitment).toBe(true)
  })
  test('known period → forgone rent = months × increase × rented units, and it is added to the payback cost', () => {
    const v = landlordView(story1({ rentCommitment: { months: e(12, 12, 12), forgoneIncreasePerUnitMonth: e(25, 50, 75), rentedUnits: 2 } }))
    expect(v.projectCommitment.cost?.range).toEqual(range(600, 1200, 1800))
    expect(v.paybackExcludesCommitment).toBe(false)
    expect(v.paybackYears).not.toBeNull()
  })
  test('no commitment required → zero cost', () => {
    expect(landlordView(story1({ rentCommitment: null })).projectCommitment.cost?.range).toEqual(range(0, 0, 0))
  })
})

describe('landlordView: honesty about unknowns', () => {
  test('an unknown payer is flagged and makes the landlord total incomplete', () => {
    const units = story1().units.map(u => (u.unitId === '3' ? { ...u, heatPaidBy: null } : u))
    const v = landlordView(story1({ units }))
    expect(v.rentals.find(r => r.unitId === '3')?.unknownPayer).toBe(true)
    expect(v.landlordAnnualIncomplete).toBe(true)
  })
  test('no payback when the landlord doesn’t save', () => {
    const units = story1().units.map(u => ({ ...u, heatPaidBy: 'tenant' as const, electricPaidBy: 'tenant' as const }))
    const v = landlordView(story1({ ownUnitId: null, units }))
    expect(v.landlordAnnual).toBeNull()
    expect(v.paybackYears).toBeNull()
  })
})

describe('landlordView: real savings vs cost shifted to tenants (Qiao, 2026-11-06)', () => {
  test('Story 1: the landlord’s apparent saving = real energy saving + heating cost moved onto tenants’ electric bills', () => {
    const v = landlordView(story1())
    expect(v.realSavings?.range.mid).toBeCloseTo(3 * sw.net.range.mid)
    expect(v.shiftedToTenants.map(s => s.unitId)).toEqual(['2', '3'])
    expect(v.shiftedTotal?.range.mid).toBeCloseTo(2 * sw.electricBill.range.mid)
    expect(v.landlordAnnual?.range.mid).toBeCloseTo((v.realSavings?.range.mid ?? NaN) - (v.shiftedTotal?.range.mid ?? NaN))
  })
  test('each shift shows its amount per month and that it needs a written rental agreement (105 CMR 410.200)', () => {
    const s = landlordView(story1()).shiftedToTenants[0]
    expect(s?.monthly.range.mid).toBeCloseTo(sw.electricBill.range.mid / 12)
    expect(s?.constraint).toBe('ma_105_cmr_410_written_rental_agreement')
    expect(s?.fairOptions).toEqual(['lower_rent', 'electricity_allowance', 'owner_paid_meter'])
  })
  test('heat pumps on an owner-paid meter: nothing shifts, and the landlord’s change equals the real saving', () => {
    const units = story1().units.map(u => (u.unitId === '1' ? u : { ...u, heatPumpMeterPaidBy: 'owner' as const }))
    const v = landlordView(story1({ units }))
    expect(v.shiftedToTenants).toEqual([])
    expect(v.landlordAnnual?.range.mid).toBeCloseTo(v.realSavings?.range.mid ?? NaN)
    expect(v.paybackIfCostShifted).toBeNull()
  })
  test('tenants already paying for heat: no shift by the landlord', () => {
    const units = story1().units.map(u => (u.unitId === '1' ? u : { ...u, heatPaidBy: 'tenant' as const }))
    expect(landlordView(story1({ units })).shiftedToTenants).toEqual([])
  })
})

describe('landlordView: "the boiler needs replacing anyway" baseline', () => {
  const rich = (avoided: ReturnType<typeof e> | null) => landlordView(story1({
    rentCommitment: null,
    avoidedReplacementCost: avoided,
    units: story1().units.map(u => ({ ...u, bills: { ...sw, net: e(-2000, -1500, -1000) } })),
  }))
  test('the avoided replacement cost shortens the payback', () => {
    const without = rich(null)
    const withBaseline = rich(e(7000, 9000, 11000))
    expect(withBaseline.usesReplacementBaseline).toBe(true)
    expect(withBaseline.paybackYears?.range.mid).toBeLessThan(without.paybackYears?.range.mid ?? 0)
  })
})
