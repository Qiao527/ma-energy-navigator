import { describe, expect, it } from 'vitest'
import { confirmReplacement, confirmedState, missing, renderAnswer, reviewFacts, type Extracted } from '../../web/src/assistant.js'
import { demoState, setPath } from '../../web/src/form.js'
import { fairnessState, shiftedCostState } from '../../web/src/shift.js'
import type { Report } from '../src/energy.js'

const facts: Extracted = { role: 'tenant', town: 'Boston', units: 3, fuel: null, heatPayer: null, electricPayer: null, electricUtility: null }
describe('AI navigator boundaries', () => {
  it('requires core facts and never fills unspecified floor facts', () => {
    expect(missing({ ...facts, town: null })).toEqual(['a Massachusetts city or town (check the spelling)'])
    expect(() => confirmedState({ ...facts, town: null })).toThrow()
    expect(missing({ ...facts, town: 'Worchester' })).toContain('a Massachusetts city or town (check the spelling)')
    const state = confirmedState(facts)
    expect(state.input.building.units).toHaveLength(3)
    expect(state.input.building.units.every(u => u.occupancy === null && u.heatingFuel === null)).toBe(true)
    expect(state.input.userUnitId).toBeNull()
  })
  it('keeps demo labels after editing and preserves data when replacement is cancelled', () => {
    const state = demoState()
    setPath(state, 'building.municipality', 'text', 'Lowell')
    expect(state.demo).toBe(true)
    const previous = structuredClone(state)
    expect(confirmReplacement(facts, () => false)).toBeNull()
    expect(state).toEqual(previous)
    expect(confirmReplacement(facts, () => true)?.input.building.municipality).toBe('Boston')
  })
  it('does not confuse an unknown payer with zero shifted cost', () => {
    expect(shiftedCostState({ shiftedToTenants: [], landlordAnnualIncomplete: true })).toBe('unknown')
    expect(shiftedCostState({ shiftedToTenants: [], landlordAnnualIncomplete: false })).toBe('none')
    expect(shiftedCostState({ shiftedToTenants: [{}] as never[], landlordAnnualIncomplete: false })).toBe('shifted')
    expect(fairnessState({ shiftedToTenants: [{}] as never[], landlordAnnualIncomplete: true })).toBe('partial')
  })
  it('shows extracted facts in plain language and labels unknowns', () => {
    expect(reviewFacts(facts)).toEqual([
      ['You are', 'A tenant'], ['City or town', 'Boston'], ['Homes in the building', '3'],
      ['Heating on every floor', 'Not sure yet'], ['Who pays for heat on every floor', 'Not sure yet'],
      ['Who pays for electricity on every floor', 'Not sure yet'], ['Electric company', 'Not sure yet'],
    ])
    expect(reviewFacts({ ...facts, role: 'owner_occupant_landlord', fuel: 'oil', heatPayer: 'owner' })[0]).toEqual(['You are', 'A landlord who lives in the building'])
  })
  it('renders the engine range with signs and marks demo data', () => {
    const r = { navigation: { steps: [] }, buildingChange: { range: { low: -1250, mid: 1200, high: 3530 }, confidence: 'low' } } as unknown as Report
    const text = renderAnswer(r, 'renting_landlord', { focus: 'cost', tone: 'direct' }, true)
    expect(text).toContain('−$1,250 to +$3,530')
    expect(text).toContain('fictional demo data')
    expect(renderAnswer(r, 'renting_landlord', { focus: 'cost', tone: 'direct' }, false, true)).toContain('hot-water change is not included')
    expect(renderAnswer(r, 'tenant', { focus: 'cost', tone: 'warm' }, false)).not.toContain('$3,530')
  })
})
