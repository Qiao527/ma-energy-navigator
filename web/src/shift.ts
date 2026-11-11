import type { UnitEnergy } from '../../engine/src/energy.js'
import type { Input } from '../../engine/src/facts.js'
import type { LandlordView } from '../../engine/src/landlord.js'

export function hasUnestimatedWater(input: Input, units: UnitEnergy[]): boolean {
  return input.building.units.some(unit => unit.hotWaterFromBoiler === true &&
    unit.hotWaterAfter !== null && unit.hotWaterAfter !== 'boiler' &&
    units.find(result => result.unitId === unit.id)?.hotWater === undefined)
}

export function shiftedCostState(view: Pick<LandlordView, 'shiftedToTenants' | 'landlordAnnualIncomplete'>, waterNotEstimated = false): 'unknown' | 'shifted' | 'none' {
  if (view.landlordAnnualIncomplete || waterNotEstimated) return 'unknown'
  return view.shiftedToTenants.length ? 'shifted' : 'none'
}

export function fairnessState(view: Pick<LandlordView, 'shiftedToTenants' | 'landlordAnnualIncomplete'>, waterNotEstimated = false): 'unknown' | 'partial' | 'shifted' | 'none' {
  const status = shiftedCostState(view, waterNotEstimated)
  return status === 'unknown' && view.shiftedToTenants.length > 0 ? 'partial' : status
}
