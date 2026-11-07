import { describe, expect, test } from 'vitest'
import { derive, FACT_PATHS, getFact, type DecEntry } from '../src/scope.js'
import { input, scope, unit } from './fixtures.js'

const DEC: DecEntry[] = [{ name: 'Boston', narrowedFor: ['unitil', 'berkshire_gas', 'liberty'] }]

describe('derive', () => {
  test('Boston with Eversource is a DEC', () => {
    const i = input({ building: { municipality: 'Boston', electricUtility: 'eversource', gasUtility: 'national_grid' } })
    expect(derive(i, DEC).isDec).toBe(true)
  })
  test('a non-listed municipality is not a DEC', () => {
    expect(derive(input({ building: { municipality: 'Newton' } }), DEC).isDec).toBe(false)
  })
  test('a narrowing utility makes DEC depend on the EJ block group', () => {
    const i = input({ building: { municipality: 'Boston', electricUtility: 'unitil', gasUtility: 'none', inEjBlockGroup: null } })
    expect(derive(i, DEC).isDec).toBeNull()
  })
  test('unknown utilities in a narrowed DEC give unknown', () => {
    expect(derive(input({ building: { municipality: 'Boston' } }), DEC).isDec).toBeNull()
  })
  test('renter share needs every occupancy', () => {
    const units = [unit('1', { occupancy: 'renter' }), unit('2', { occupancy: null })]
    expect(derive(input({ building: { units } }), DEC).renterShare).toBeNull()
    const known = [unit('1', { occupancy: 'renter' }), unit('2', { occupancy: 'owner' })]
    expect(derive(input({ building: { units: known } }), DEC).renterShare).toBe(0.5)
  })
})

describe('getFact', () => {
  test('every registered path resolves without throwing', () => {
    const s = scope(input())
    for (const p of FACT_PATHS) expect(() => getFact(s, p)).not.toThrow()
  })
  test('an unknown path throws (catches typos in rules data)', () => {
    expect(() => getFact(scope(input()), 'unit.occupancyy')).toThrow(/unknown fact path/)
  })
  test('unit facts are null when there is no subject unit', () => {
    expect(getFact(scope(input(), { unit: null }), 'unit.occupancy')).toBeNull()
  })
  test('electricIsMunicipal is derived from the utility', () => {
    expect(getFact(scope(input({ building: { electricUtility: 'municipal' } })), 'building.electricIsMunicipal')).toBe(true)
  })
})
