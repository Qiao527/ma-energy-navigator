import story1 from '../../scenarios/ma/story1-owner-occupant.json'

/**
 * The demo building is Story 1 from the standard scenarios: fictional numbers, always labeled "demo data"
 * (Qiao, 2026-11-07). The demo landlord also answers the hot-water questions the scenario leaves open: each
 * floor's boiler heats its water, and a heat pump water heater takes over (Qiao, 2026-11-07).
 */
export const STORY1 = {
  title: 'Demo: an owner-occupied Boston triple-decker',
  story: `${story1.story} Each boiler also heats that floor's water; with heat pumps, a heat pump water heater takes over.`,
  input: {
    ...story1.input,
    building: {
      ...story1.input.building,
      units: story1.input.building.units.map(u => ({ ...u, hotWaterFromBoiler: true, hotWaterAfter: 'heat_pump_water_heater' })),
    },
  },
}
