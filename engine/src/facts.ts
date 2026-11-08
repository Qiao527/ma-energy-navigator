import { z } from 'zod'

export const Role = z.enum(['tenant', 'renting_landlord', 'owner_occupant_landlord', 'condo_owner'])
export type Role = z.infer<typeof Role>

export const Fuel = z.enum(['natural_gas', 'oil', 'propane', 'electric_resistance', 'heat_pump', 'other'])
export type Fuel = z.infer<typeof Fuel>

export const Payer = z.enum(['tenant', 'owner'])
export type Payer = z.infer<typeof Payer>

/** 'municipal' = a municipal light plant (docs/incentives-research.md §16). */
export const ElectricUtility = z.enum(['eversource', 'national_grid', 'unitil', 'cape_light_compact', 'municipal'])
export const GasUtility = z.enum(['eversource', 'national_grid', 'unitil', 'liberty', 'berkshire_gas', 'municipal', 'none'])

export const HotWaterAfter = z.enum(['boiler', 'electric_resistance', 'heat_pump_water_heater'])
export type HotWaterAfter = z.infer<typeof HotWaterAfter>

export const UnitSchema = z.strictObject({
  id: z.string().min(1),
  occupancy: z.enum(['owner', 'renter']).nullable(),
  heatingFuel: Fuel.nullable(),
  heatPaidBy: Payer.nullable(),
  electricPaidBy: Payer.nullable(),
  hasResidentialHeatingMeter: z.boolean().nullable(),
  /** Has this unit's household agreed to take part (all-units offers)? */
  participating: z.boolean().nullable(),
  /** Occupied full time during the winter heating season (heat pump rebates, research §6). */
  occupiedAllWinter: z.boolean().nullable(),
  /** Past fuel use, one entry per delivery or bill; `year` = the heating season starting that year (Task 16). */
  fuelRecords: z
    .array(z.strictObject({ year: z.number().int().min(2000).max(2100), quantity: z.number().nonnegative(), unit: z.enum(['gallons', 'therms', 'kwh']) }))
    .nullable()
    .default(null),
  /** Heat pump size from a contractor's quote, in tons. */
  heatPumpTonsQuoted: z.number().positive().nullable().default(null),
  /** Does the heating boiler also heat this unit's hot water today? (F2, Qiao 2026-11-07) */
  hotWaterFromBoiler: z.boolean().nullable().default(null),
  /** After the heat pump, what heats the water. 'boiler' = the same boiler stays for hot water. */
  hotWaterAfter: HotWaterAfter.nullable().default(null),
})
export type Unit = z.infer<typeof UnitSchema>

export const BuildingSchema = z
  .strictObject({
    /** Municipality from the geocoder's county subdivision, never the postal city (data-sources §1). */
    municipality: z.string().min(1),
    ownership: z.enum(['single_owner', 'condo']).nullable(),
    yearBuilt: z.number().int().min(1600).max(2100).nullable(),
    electricUtility: ElectricUtility.nullable(),
    gasUtility: GasUtility.nullable(),
    inEjBlockGroup: z.boolean().nullable(),
    /** Weatherization recommended since 2013 has been completed. */
    weatherizationRecsDone: z.boolean().nullable(),
    heaCompleted: z.boolean().nullable(),
    /** The property owner has approved the work (rented units). */
    ownerApproval: z.boolean().nullable(),
    units: z.array(UnitSchema).min(1).max(4),
  })
  .refine(b => new Set(b.units.map(u => u.id)).size === b.units.length, { message: 'unit ids must be unique' })

export const HouseholdSchema = z.strictObject({
  size: z.number().int().min(1).max(17).nullable(),
  incomeBand: z
    .strictObject({ low: z.number().nonnegative(), high: z.number().nonnegative() })
    .refine(b => b.low <= b.high, { message: 'incomeBand.low must be <= incomeBand.high' })
    .nullable(),
  onDiscountRate: z.boolean().nullable(),
})

export const InputSchema = z
  .strictObject({
    role: Role,
    userUnitId: z.string().nullable(),
    building: BuildingSchema,
    household: HouseholdSchema,
  })
  .refine(i => i.userUnitId === null || i.building.units.some(u => u.id === i.userUnitId), {
    message: 'userUnitId must match a unit id',
  })

export type Input = z.infer<typeof InputSchema>
