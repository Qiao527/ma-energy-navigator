import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { evaluate, type Condition } from '../src/condition.js'
import { InputSchema, type Input } from '../src/facts.js'
import { derive, type DecEntry, type Scope } from '../src/scope.js'

const DEC: DecEntry[] = [{ name: 'Boston', narrowedFor: ['unitil'] }]
const TABLES = { t: [50_000, 70_000, 90_000] }
const PREDICATES: Record<string, Condition> = { p: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true } }

const leafArb = fc.constantFrom<Condition>(
  { fact: 'unit.occupancy', op: 'eq', value: 'renter' },
  { fact: 'unit.participating', op: 'eq', value: true },
  { fact: 'unit.heatingFuel', op: 'in', value: ['oil', 'propane'] },
  { fact: 'building.isDec', op: 'eq', value: true },
  { fact: 'building.yearBuilt', op: 'gte', value: 2000 },
  { fact: 'building.renterShare', op: 'gt', value: 0.5 },
  { fact: 'user.onDiscountRate', op: 'eq', value: true },
  { ref: 'p' },
  { incomeAtMost: 't' },
  { incomeAbove: 't' },
  { allUnits: { eligible: { ref: 'p' }, require: { fact: 'unit.participating', op: 'eq', value: true } } },
)

const { cond } = fc.letrec<{ cond: Condition }>(tie => ({
  cond: fc.oneof(
    { depthSize: 'small' },
    leafArb,
    fc.array(tie('cond'), { minLength: 1, maxLength: 3 }).map(all => ({ all })),
    fc.array(tie('cond'), { minLength: 1, maxLength: 3 }).map(any => ({ any })),
    tie('cond').map(not => ({ not })),
  ),
}))

const fullUnit = (id: string) => fc.record({
  id: fc.constant(id),
  occupancy: fc.constantFrom('owner' as const, 'renter' as const),
  heatingFuel: fc.constantFrom('natural_gas' as const, 'oil' as const, 'propane' as const, 'electric_resistance' as const),
  heatPaidBy: fc.constantFrom('tenant' as const, 'owner' as const),
  electricPaidBy: fc.constantFrom('tenant' as const, 'owner' as const),
  hasResidentialHeatingMeter: fc.boolean(),
  participating: fc.boolean(),
  occupiedAllWinter: fc.boolean(),
})

const fullInput: fc.Arbitrary<Input> = fc.record({
  role: fc.constantFrom('tenant' as const, 'renting_landlord' as const, 'owner_occupant_landlord' as const, 'condo_owner' as const),
  userUnitId: fc.constant('1'),
  building: fc.record({
    municipality: fc.constantFrom('Boston', 'Somerville'),
    ownership: fc.constantFrom('single_owner' as const, 'condo' as const),
    yearBuilt: fc.integer({ min: 1880, max: 2025 }),
    electricUtility: fc.constantFrom('eversource' as const, 'unitil' as const, 'municipal' as const),
    gasUtility: fc.constantFrom('national_grid' as const, 'none' as const),
    inEjBlockGroup: fc.boolean(),
    weatherizationRecsDone: fc.boolean(),
    heaCompleted: fc.boolean(),
    ownerApproval: fc.boolean(),
    units: fc.tuple(fullUnit('1'), fullUnit('2'), fullUnit('3')).map(us => [...us]),
  }),
  household: fc.record({
    size: fc.integer({ min: 1, max: 5 }),
    incomeBand: fc.integer({ min: 0, max: 150_000 }).chain(low =>
      fc.integer({ min: low, max: low + 40_000 }).map(high => ({ low, high }))),
    onDiscountRate: fc.boolean(),
  }),
}).map(x => InputSchema.parse(x))

const UNIT_FIELDS = ['occupancy', 'heatingFuel', 'heatPaidBy', 'electricPaidBy', 'hasResidentialHeatingMeter', 'participating', 'occupiedAllWinter'] as const
const BUILDING_FIELDS = ['ownership', 'yearBuilt', 'electricUtility', 'gasUtility', 'inEjBlockGroup', 'weatherizationRecsDone', 'heaCompleted', 'ownerApproval'] as const
const HOUSEHOLD_FIELDS = ['size', 'incomeBand', 'onDiscountRate'] as const
const MASK_BITS = BUILDING_FIELDS.length + HOUSEHOLD_FIELDS.length + 3 * UNIT_FIELDS.length

/** Same input with some known fields turned back into unknown (null). */
function blank(full: Input, mask: boolean[]): Input {
  const out = structuredClone(full)
  let i = 0
  const b = out.building as unknown as Record<string, unknown>
  for (const f of BUILDING_FIELDS) if (mask[i++]) b[f] = null
  const h = out.household as unknown as Record<string, unknown>
  for (const f of HOUSEHOLD_FIELDS) if (mask[i++]) h[f] = null
  for (const u of out.building.units) {
    const ur = u as unknown as Record<string, unknown>
    for (const f of UNIT_FIELDS) if (mask[i++]) ur[f] = null
  }
  return out
}

const scopeOf = (i: Input): Scope => ({
  input: i, unit: i.building.units[0] ?? null, derived: derive(i, DEC), incomeTables: TABLES, predicates: PREDICATES,
})

describe('condition properties', () => {
  test('double negation keeps the value', () => {
    fc.assert(fc.property(cond, fullInput, (c, i) => {
      expect(evaluate({ not: { not: c } }, scopeOf(i)).value).toBe(evaluate(c, scopeOf(i)).value)
    }))
  })

  test('learning more never flips a decided answer (knowledge monotonicity)', () => {
    fc.assert(fc.property(cond, fullInput, fc.array(fc.boolean(), { minLength: MASK_BITS, maxLength: MASK_BITS }), (c, full, mask) => {
      const partial = evaluate(c, scopeOf(blank(full, mask)))
      if (partial.value !== 'unknown') expect(evaluate(c, scopeOf(full)).value).toBe(partial.value)
    }))
  })

  test('with every fact known (exact income), nothing is unknown', () => {
    const exact = fullInput.map(i => ({
      ...i,
      household: { ...i.household, incomeBand: i.household.incomeBand && { low: i.household.incomeBand.low, high: i.household.incomeBand.low } },
    }))
    fc.assert(fc.property(cond, exact, (c, i) => {
      expect(evaluate(c, scopeOf(i)).value).not.toBe('unknown')
    }))
  })
})
