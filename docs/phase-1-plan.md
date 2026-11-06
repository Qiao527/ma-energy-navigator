# Phase 1 — Rules Engine and Finance Core Implementation Plan

**Goal:** A tested TypeScript package. It takes a confirmed building profile (who lives where, fuel, who pays, utility, income band) and returns:
- which Massachusetts offers apply to which unit, as `eligible`, `potential`, `needs_info` or `not_eligible`;
- the next steps for each offer (prerequisites);
- what only the program can confirm;
- money as low/mid/high ranges where a Massachusetts cost source exists;
- what would change the answer ("1 more unit agreeing");
- the order to do things in.

No UI, no LLM.

**Architecture:**
- Policy lives in JSON under `rules/ma/` and is validated by Zod. Design: `docs/schema/rules-schema.md` (decided 2026-11-06, merged from two independent drafts; see `docs/schema/comparison.md`).
- The engine (`engine/src/`) is pure functions:
  - three-valued conditions over a closed fact registry;
  - three kinds of conditions (eligibility, prerequisites, confirmations);
  - versions chosen by planned installation date;
  - counterfactuals by re-evaluation;
  - typed benefit calculators returning `Range`s;
  - best-of selection, caps, sequencing, and a small heating-cost/payback module.
- Every rule carries sources with quotes and a `lastVerified` date. Data tests fail on missing sources, retired versions and overlapping versions.

**Tech Stack:** Node 24 LTS, TypeScript 6.0.3, Zod 4.6.7, Vitest 5.0.5, fast-check 4.10.2, all released at least 2 weeks before 2026-11-06. The one data-analysis script uses only the Python 3 standard library.

**Evidence base:** `docs/incentives-research.md` (rules), `docs/data-sources.md` (inputs, cost sources §9b), `docs/product.md` (scope). Every rule in Task 13 cites the research section it encodes.

**Open items that don't block Phase 1:**
- **Condo "eligible unit" definition:** encoded as a working-assumption predicate plus a confirmation. Qiao is asking Mass Save.
- **SMART PY2027 rates:** add them when DOER finalizes them.
- **Account-holder question:** a confirmation on rental units.

---

## File structure

```
engine/
  package.json  tsconfig.json  vitest.config.ts
  src/
    range.ts            # Range {low, mid, high} and order-preserving arithmetic
    facts.ts            # Zod schemas for user input (building, units, household)
    scope.ts            # fact registry, derived facts (DEC, renter share), getFact
    condition.ts        # Condition type + three-valued evaluator (incl. allUnits, ref)
    rules-schema.ts     # Zod schemas for rules data (offers, predicates, caps, sequence, …)
    provenance.ts       # windows, retirement, staleness, data-problem finder, walk()
    benefit.ts          # Benefit → Range given Quantities
    counterfactual.ts   # smallest realistic change that makes eligibility hold
    offers.ts           # status, prerequisites, confirmations, best-of, caps
    plan.ts             # order measures into steps
    navigate.ts         # entry point; picks versions by install date
    load-rules.ts       # read + validate rules/<state>/ (Node only)
    heating.ts          # heating cost, weatherization, payback, payer split
    quantities.ts       # assumptions.json → Quantities
  test/
    fixtures.ts  range  facts  scope  condition  condition.pbt  participation  rules-schema
    provenance  benefit  counterfactual  offers  plan  navigate  rules-data  scenarios
    scenarios.pbt  heating  quantities   (each *.test.ts)
rules/ma/
  programs.json  predicates.json  income-tables.json  dec.json  caps.json  sequence.json  assumptions.json
  offers/{assessment,bill-assistance,financing,heat-pumps,solar,weatherization}.json
  archive/      # retired versions; not loaded
analysis/
  lead_burden.py  test_lead_burden.py  README.md
```

---

### Task 1: Scaffold the engine package

**Files:**
- Create: `engine/package.json`, `engine/tsconfig.json`, `engine/vitest.config.ts`, `engine/test/smoke.test.ts`, `.gitignore` (append)

- [ ] **Step 1: Create `engine/package.json`**

```json
{
  "name": "@navigator/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && npm test"
  },
  "dependencies": {
    "zod": "4.6.7"
  },
  "devDependencies": {
    "@types/node": "24.19.2",
    "fast-check": "4.10.2",
    "typescript": "6.0.3",
    "vitest": "5.0.5"
  }
}
```

- [ ] **Step 2: Create `engine/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `engine/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
})
```

- [ ] **Step 4: Create `engine/test/smoke.test.ts`**

```ts
import { expect, test } from 'vitest'

test('test runner works', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 5: Append to `.gitignore`**

```
node_modules/
```

- [ ] **Step 6: Install and run**

Run: `cd engine && npm install && npm run check`
Expected: typecheck passes; `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add engine/package.json engine/package-lock.json engine/tsconfig.json engine/vitest.config.ts engine/test/smoke.test.ts .gitignore
git commit -m "chore(engine): scaffold TypeScript package with Vitest"
```

---

### Task 2: `Range` — low/mid/high with order-preserving arithmetic

Every money value is a `Range` (principle 2). Each operation must keep `low ≤ mid ≤ high`.

**Files:**
- Create: `engine/src/range.ts`
- Test: `engine/test/range.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import {
  add, capAt, complement, div, floorAt, minOf, mul, mulAny, point, range, scale, sub, sum, type Range,
} from '../src/range.js'

const num = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
const nonNeg = fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true })
const sorted = (a: number, b: number, c: number) => [a, b, c].sort((x, y) => x - y) as [number, number, number]
const arbRange = fc.tuple(num, num, num).map(([a, b, c]) => range(...sorted(a, b, c)))
const arbNonNeg = fc.tuple(nonNeg, nonNeg, nonNeg).map(([a, b, c]) => range(...sorted(a, b, c)))
const arbPositive = fc.tuple(nonNeg, nonNeg, nonNeg).map(([a, b, c]) => range(...sorted(a + 1, b + 1, c + 1)))
const ordered = (r: Range) => r.low <= r.mid && r.mid <= r.high

describe('range()', () => {
  test('rejects unordered values', () => {
    expect(() => range(3, 2, 1)).toThrow(RangeError)
  })
  test('rejects non-finite values', () => {
    expect(() => range(0, Number.NaN, 1)).toThrow(RangeError)
  })
  test('point() makes a zero-width range', () => {
    expect(point(5)).toEqual({ low: 5, mid: 5, high: 5 })
  })
})

describe('examples', () => {
  test('sub widens: low minus high', () => {
    expect(sub(range(10, 20, 30), range(1, 2, 3))).toEqual({ low: 7, mid: 18, high: 29 })
  })
  test('div uses opposite ends', () => {
    expect(div(range(10, 20, 40), range(2, 4, 5))).toEqual({ low: 2, mid: 5, high: 20 })
  })
  test('complement flips a fraction range', () => {
    expect(complement(range(0.05, 0.1, 0.15))).toEqual({ low: 0.85, mid: 0.9, high: 0.95 })
  })
  test('mulAny handles a range that crosses zero', () => {
    expect(mulAny(range(10, 20, 30), range(-2, 1, 3))).toEqual({ low: -60, mid: 20, high: 90 })
  })
  test('sum of nothing is zero', () => {
    expect(sum([])).toEqual(point(0))
  })
})

describe('order is preserved (property)', () => {
  test('add, sub, capAt, floorAt, minOf, mulAny', () => {
    fc.assert(fc.property(arbRange, arbRange, num, (a, b, k) => {
      expect(ordered(add(a, b))).toBe(true)
      expect(ordered(sub(a, b))).toBe(true)
      expect(ordered(capAt(a, k))).toBe(true)
      expect(ordered(floorAt(a, k))).toBe(true)
      expect(ordered(minOf(a, b))).toBe(true)
      expect(ordered(mulAny(a, b))).toBe(true)
    }))
  })
  test('scale, mul, div on non-negative ranges', () => {
    fc.assert(fc.property(arbNonNeg, arbNonNeg, arbPositive, nonNeg, (a, b, p, k) => {
      expect(ordered(scale(a, k))).toBe(true)
      expect(ordered(mul(a, b))).toBe(true)
      expect(ordered(div(a, p))).toBe(true)
    }))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run test/range.test.ts`
Expected: FAIL — `Cannot find module '../src/range.js'`.

- [ ] **Step 3: Implement `engine/src/range.ts`**

```ts
/** A money or quantity estimate. Never a single falsely precise number (CONTRIBUTING.md principle 2). */
export interface Range {
  readonly low: number
  readonly mid: number
  readonly high: number
}

export function range(low: number, mid: number, high: number): Range {
  if (![low, mid, high].every(Number.isFinite)) throw new RangeError(`non-finite range ${low}/${mid}/${high}`)
  if (!(low <= mid && mid <= high)) throw new RangeError(`unordered range ${low}/${mid}/${high}`)
  return { low, mid, high }
}

export const point = (x: number): Range => range(x, x, x)

export const add = (a: Range, b: Range): Range => range(a.low + b.low, a.mid + b.mid, a.high + b.high)

/** Interval subtraction: the widest honest result. */
export const sub = (a: Range, b: Range): Range => range(a.low - b.high, a.mid - b.mid, a.high - b.low)

export const sum = (rs: readonly Range[]): Range => rs.reduce(add, point(0))

export function scale(a: Range, k: number): Range {
  if (!(k >= 0)) throw new RangeError(`scale factor must be >= 0, got ${k}`)
  return range(a.low * k, a.mid * k, a.high * k)
}

function assertNonNegative(a: Range, name: string): void {
  if (a.low < 0) throw new RangeError(`${name} must be non-negative`)
}

/** Product of two non-negative ranges. */
export function mul(a: Range, b: Range): Range {
  assertNonNegative(a, 'a')
  assertNonNegative(b, 'b')
  return range(a.low * b.low, a.mid * b.mid, a.high * b.high)
}

/** Product of any two ranges (endpoints may be negative). */
export function mulAny(a: Range, b: Range): Range {
  const corners = [a.low * b.low, a.low * b.high, a.high * b.low, a.high * b.high]
  return range(Math.min(...corners), a.mid * b.mid, Math.max(...corners))
}

/** Non-negative numerator divided by a strictly positive denominator. */
export function div(a: Range, b: Range): Range {
  assertNonNegative(a, 'numerator')
  if (!(b.low > 0)) throw new RangeError('denominator must be strictly positive')
  return range(a.low / b.high, a.mid / b.mid, a.high / b.low)
}

export const capAt = (a: Range, cap: number): Range =>
  range(Math.min(a.low, cap), Math.min(a.mid, cap), Math.min(a.high, cap))

export const floorAt = (a: Range, floor: number): Range =>
  range(Math.max(a.low, floor), Math.max(a.mid, floor), Math.max(a.high, floor))

export const minOf = (a: Range, b: Range): Range =>
  range(Math.min(a.low, b.low), Math.min(a.mid, b.mid), Math.min(a.high, b.high))

/** 1 − r for a fraction range within [0, 1]. */
export function complement(r: Range): Range {
  if (r.low < 0 || r.high > 1) throw new RangeError('complement needs a fraction within [0, 1]')
  return range(1 - r.high, 1 - r.mid, 1 - r.low)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd engine && npx vitest run test/range.test.ts`
Expected: all tests PASS. If `mulAny` mid falls outside the corners because of floating-point error, the property test will show the counterexample; the bilinear mid is mathematically inside the corner hull, so investigate before loosening anything.

- [ ] **Step 5: Commit**

```bash
git add engine/src/range.ts engine/test/range.test.ts
git commit -m "feat(engine): add Range with order-preserving arithmetic"
```

---

### Task 3: Input facts (what the user confirms)

`null` always means "not known yet" (principle 4). The form is the only data source (decision 2026-11-06).

**Files:**
- Create: `engine/src/facts.ts`, `engine/test/fixtures.ts`
- Test: `engine/test/facts.test.ts`

- [ ] **Step 1: Write the failing tests — `engine/test/facts.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { InputSchema } from '../src/facts.js'
import { input, unit } from './fixtures.js'

describe('InputSchema', () => {
  test('accepts a minimal input with unknowns', () => {
    expect(InputSchema.parse(input())).toBeTruthy()
  })
  test('rejects more than 4 units', () => {
    const units = ['1', '2', '3', '4', '5'].map(id => unit(id))
    expect(() => InputSchema.parse(input({ building: { units } }))).toThrow()
  })
  test('rejects duplicate unit ids', () => {
    expect(() => InputSchema.parse(input({ building: { units: [unit('1'), unit('1')] } }))).toThrow(/unique/)
  })
  test('rejects an income band with low > high', () => {
    expect(() => InputSchema.parse(input({ household: { incomeBand: { low: 5, high: 1 } } }))).toThrow()
  })
  test('rejects a userUnitId that matches no unit', () => {
    expect(() => InputSchema.parse(input({ userUnitId: '9' }))).toThrow(/userUnitId/)
  })
  test('rejects unknown keys (typos in the form mapping)', () => {
    expect(() => InputSchema.parse({ ...input(), extra: true })).toThrow()
  })
})
```

- [ ] **Step 2: Create `engine/test/fixtures.ts`**

```ts
import type { Input, Unit } from '../src/facts.js'

export function unit(id: string, over: Partial<Unit> = {}): Unit {
  return {
    id,
    occupancy: null,
    heatingFuel: null,
    heatPaidBy: null,
    electricPaidBy: null,
    hasResidentialHeatingMeter: null,
    participating: null,
    occupiedAllWinter: null,
    ...over,
  }
}

export interface InputOverrides {
  role?: Input['role']
  userUnitId?: string | null
  building?: Partial<Input['building']>
  household?: Partial<Input['household']>
}

export function input(over: InputOverrides = {}): Input {
  return {
    role: over.role ?? 'tenant',
    userUnitId: over.userUnitId === undefined ? null : over.userUnitId,
    building: {
      municipality: 'Boston',
      ownership: null,
      yearBuilt: null,
      electricUtility: null,
      gasUtility: null,
      inEjBlockGroup: null,
      weatherizationRecsDone: null,
      heaCompleted: null,
      ownerApproval: null,
      units: [unit('1')],
      ...over.building,
    },
    household: { size: null, incomeBand: null, onDiscountRate: null, ...over.household },
  }
}
```

- [ ] **Step 3: Run to verify failure**

Run: `cd engine && npx vitest run test/facts.test.ts`
Expected: FAIL — `Cannot find module '../src/facts.js'`.

- [ ] **Step 4: Implement `engine/src/facts.ts`**

```ts
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
```

- [ ] **Step 5: Run to verify pass**

Run: `cd engine && npx vitest run test/facts.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add engine/src/facts.ts engine/test/fixtures.ts engine/test/facts.test.ts
git commit -m "feat(engine): add input schema with explicit unknowns"
```

---

### Task 4: Fact registry, derived facts and scopes

**Files:**
- Create: `engine/src/scope.ts`
- Modify: `engine/test/fixtures.ts` (add `scope()` helper)
- Test: `engine/test/scope.test.ts`

- [ ] **Step 1: Write the failing tests — `engine/test/scope.test.ts`**

```ts
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
```

- [ ] **Step 2: Append the `scope()` helper to `engine/test/fixtures.ts`** (add the imports at the top of the file)

```ts
import { derive, type Scope } from '../src/scope.js'

/** A scope over `i` with no DEC list, no income tables and no predicates unless overridden. */
export function scope(i: Input, over: Partial<Scope> = {}): Scope {
  return { input: i, unit: i.building.units[0] ?? null, derived: derive(i, []), incomeTables: {}, predicates: {}, ...over }
}
```

- [ ] **Step 3: Run to verify failure**

Run: `cd engine && npx vitest run test/scope.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `engine/src/scope.ts`**

```ts
import type { Condition } from './condition.js'
import type { Input, Unit } from './facts.js'

export type Scalar = string | number | boolean

/** One Designated Equity Community (data-sources §5). */
export interface DecEntry {
  name: string
  /** Program administrators that limit the DEC offer to EJ block groups in this municipality. */
  narrowedFor: string[]
}

export interface Derived {
  isDec: boolean | null
  renterShare: number | null
  unitCount: number
}

/** Everything a condition can see. `unit` is the subject unit (null when there is none). */
export interface Scope {
  input: Input
  unit: Unit | null
  derived: Derived
  /** Income limit by household size (index = size − 1), keyed by table id. */
  incomeTables: Readonly<Record<string, readonly number[]>>
  /** Named predicates from rules data, keyed by id. */
  predicates: Readonly<Record<string, Condition>>
}

/** The closed list of facts rules may use. Renaming one is a breaking change (schema §1). */
export const FACT_PATHS = [
  'user.role',
  'unit.occupancy',
  'unit.heatingFuel',
  'unit.heatPaidBy',
  'unit.electricPaidBy',
  'unit.hasResidentialHeatingMeter',
  'unit.participating',
  'unit.occupiedAllWinter',
  'building.ownership',
  'building.yearBuilt',
  'building.unitCount',
  'building.electricUtility',
  'building.gasUtility',
  'building.electricIsMunicipal',
  'building.isDec',
  'building.renterShare',
  'building.weatherizationRecsDone',
  'building.heaCompleted',
  'building.ownerApproval',
  'household.size',
  'household.onDiscountRate',
] as const

export function derive(input: Input, dec: readonly DecEntry[]): Derived {
  const b = input.building
  const entry = dec.find(d => d.name === b.municipality)
  let isDec: boolean | null = false
  if (entry !== undefined) {
    const utilities = [b.electricUtility, b.gasUtility]
    if (entry.narrowedFor.length > 0 && utilities.includes(null)) isDec = null
    else if (utilities.some(u => u !== null && entry.narrowedFor.includes(u))) isDec = b.inEjBlockGroup
    else isDec = true
  }
  const occupancies = b.units.map(u => u.occupancy)
  const renterShare = occupancies.includes(null)
    ? null
    : occupancies.filter(o => o === 'renter').length / occupancies.length
  return { isDec, renterShare, unitCount: b.units.length }
}

export function getFact(s: Scope, path: string): Scalar | null {
  const b = s.input.building
  switch (path) {
    case 'user.role': return s.input.role
    case 'unit.occupancy': return s.unit?.occupancy ?? null
    case 'unit.heatingFuel': return s.unit?.heatingFuel ?? null
    case 'unit.heatPaidBy': return s.unit?.heatPaidBy ?? null
    case 'unit.electricPaidBy': return s.unit?.electricPaidBy ?? null
    case 'unit.hasResidentialHeatingMeter': return s.unit?.hasResidentialHeatingMeter ?? null
    case 'unit.participating': return s.unit?.participating ?? null
    case 'unit.occupiedAllWinter': return s.unit?.occupiedAllWinter ?? null
    case 'building.ownership': return b.ownership
    case 'building.yearBuilt': return b.yearBuilt
    case 'building.unitCount': return s.derived.unitCount
    case 'building.electricUtility': return b.electricUtility
    case 'building.gasUtility': return b.gasUtility
    case 'building.electricIsMunicipal': return b.electricUtility === null ? null : b.electricUtility === 'municipal'
    case 'building.isDec': return s.derived.isDec
    case 'building.renterShare': return s.derived.renterShare
    case 'building.weatherizationRecsDone': return b.weatherizationRecsDone
    case 'building.heaCompleted': return b.heaCompleted
    case 'building.ownerApproval': return b.ownerApproval
    case 'household.size': return s.input.household.size
    case 'household.onDiscountRate': return s.input.household.onDiscountRate
    default: throw new Error(`unknown fact path: ${path}`)
  }
}
```

`scope.ts` imports `Condition` as a type only; `condition.ts` (Task 5) imports runtime code from `scope.ts`. There is no runtime cycle. Until Task 5 exists, `npm run typecheck` fails on that import; run only the Vitest file in this task.

- [ ] **Step 5: Run to verify pass**

Run: `cd engine && npx vitest run test/scope.test.ts`
Expected: PASS (9 tests). Vitest strips types, so the missing `condition.ts` doesn't matter yet.

- [ ] **Step 6: Commit**

```bash
git add engine/src/scope.ts engine/test/scope.test.ts engine/test/fixtures.ts
git commit -m "feat(engine): add fact registry and derived facts"
```

---

### Task 5: Three-valued condition evaluator

**Files:**
- Create: `engine/src/condition.ts`
- Test: `engine/test/condition.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest'
import { evaluate, type Condition } from '../src/condition.js'
import { input, scope, unit } from './fixtures.js'

const TABLES = { ie: [50_000, 70_000, 90_000] }
const renter = () => scope(input({ building: { units: [unit('1', { occupancy: 'renter' })] } }))

describe('leaves', () => {
  test('eq: yes / no / unknown', () => {
    const c: Condition = { fact: 'unit.occupancy', op: 'eq', value: 'renter' }
    expect(evaluate(c, renter()).value).toBe('yes')
    expect(evaluate(c, scope(input({ building: { units: [unit('1', { occupancy: 'owner' })] } }))).value).toBe('no')
    expect(evaluate(c, scope(input()))).toEqual({ value: 'unknown', missing: ['unit.occupancy'] })
  })
  test('in', () => {
    const s = scope(input({ building: { units: [unit('1', { heatingFuel: 'oil' })] } }))
    expect(evaluate({ fact: 'unit.heatingFuel', op: 'in', value: ['oil', 'propane'] }, s).value).toBe('yes')
  })
  test('gte / gt / lte / lt', () => {
    const s = scope(input({ building: { yearBuilt: 2000 } }))
    expect(evaluate({ fact: 'building.yearBuilt', op: 'gte', value: 2000 }, s).value).toBe('yes')
    expect(evaluate({ fact: 'building.yearBuilt', op: 'gt', value: 2000 }, s).value).toBe('no')
    expect(evaluate({ fact: 'building.yearBuilt', op: 'lte', value: 2000 }, s).value).toBe('yes')
    expect(evaluate({ fact: 'building.yearBuilt', op: 'lt', value: 2000 }, s).value).toBe('no')
  })
})

describe('combinators (Kleene logic)', () => {
  const yes: Condition = { fact: 'unit.occupancy', op: 'eq', value: 'renter' }
  const no: Condition = { fact: 'unit.occupancy', op: 'eq', value: 'owner' }
  const unk: Condition = { fact: 'unit.heatingFuel', op: 'eq', value: 'oil' }
  test('all: a no wins over unknown', () => {
    expect(evaluate({ all: [yes, unk, no] }, renter()).value).toBe('no')
    expect(evaluate({ all: [yes, unk] }, renter())).toEqual({ value: 'unknown', missing: ['unit.heatingFuel'] })
    expect(evaluate({ all: [yes, yes] }, renter()).value).toBe('yes')
  })
  test('any: a yes wins over unknown', () => {
    expect(evaluate({ any: [no, unk, yes] }, renter()).value).toBe('yes')
    expect(evaluate({ any: [no, unk] }, renter()).value).toBe('unknown')
    expect(evaluate({ any: [no, no] }, renter()).value).toBe('no')
  })
  test('not keeps unknown', () => {
    expect(evaluate({ not: yes }, renter()).value).toBe('no')
    expect(evaluate({ not: unk }, renter()).value).toBe('unknown')
  })
})

describe('named predicates', () => {
  test('ref evaluates the predicate', () => {
    const s = scope(renter().input, { predicates: { is_renter: { fact: 'unit.occupancy', op: 'eq', value: 'renter' } } })
    expect(evaluate({ ref: 'is_renter' }, s).value).toBe('yes')
  })
  test('unknown ref throws', () => {
    expect(() => evaluate({ ref: 'nope' }, renter())).toThrow(/unknown predicate/)
  })
})

describe('income tables', () => {
  const withIncome = (size: number | null, band: { low: number; high: number } | null) =>
    scope(input({ household: { size, incomeBand: band } }), { incomeTables: TABLES })
  test('band fully under the limit', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(2, { low: 40_000, high: 60_000 })).value).toBe('yes')
    expect(evaluate({ incomeAbove: 'ie' }, withIncome(2, { low: 40_000, high: 60_000 })).value).toBe('no')
  })
  test('band straddling the limit is unknown', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(2, { low: 60_000, high: 80_000 })))
      .toEqual({ value: 'unknown', missing: ['household.incomeBand'] })
  })
  test('household larger than the table uses the last row', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(9, { low: 85_000, high: 89_000 })).value).toBe('yes')
  })
  test('missing size and band are both reported', () => {
    expect(evaluate({ incomeAtMost: 'ie' }, withIncome(null, null)).missing).toEqual(['household.incomeBand', 'household.size'])
  })
  test('unknown table id throws', () => {
    expect(() => evaluate({ incomeAtMost: 'nope' }, withIncome(1, { low: 0, high: 0 }))).toThrow(/unknown income table/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run test/condition.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/src/condition.ts`**

```ts
import { getFact, type Scalar, type Scope } from './scope.js'

export type Tri = 'yes' | 'no' | 'unknown'

export type Leaf =
  | { fact: string; op: 'eq'; value: Scalar }
  | { fact: string; op: 'in'; value: Scalar[] }
  | { fact: string; op: 'gte' | 'gt' | 'lte' | 'lt'; value: number }

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | Leaf
  | { incomeAtMost: string }
  | { incomeAbove: string }
  | { allUnits: { eligible: Condition; require: Condition } }
  | { ref: string }

export interface EvalResult {
  value: Tri
  /** Facts whose absence makes the value unknown. Empty unless value is 'unknown'. */
  missing: string[]
}

const YES: EvalResult = { value: 'yes', missing: [] }
const NO: EvalResult = { value: 'no', missing: [] }
const unknown = (missing: string[]): EvalResult => ({ value: 'unknown', missing: [...new Set(missing)].sort() })

function holds(c: Leaf, v: Scalar): boolean {
  switch (c.op) {
    case 'eq': return v === c.value
    case 'in': return c.value.includes(v)
    case 'gte': return typeof v === 'number' && v >= c.value
    case 'gt': return typeof v === 'number' && v > c.value
    case 'lte': return typeof v === 'number' && v <= c.value
    case 'lt': return typeof v === 'number' && v < c.value
  }
}

function leaf(c: Leaf, s: Scope): EvalResult {
  const v = getFact(s, c.fact)
  if (v === null) return unknown([c.fact])
  return holds(c, v) ? YES : NO
}

function combineAll(rs: EvalResult[]): EvalResult {
  if (rs.some(r => r.value === 'no')) return NO
  const unknowns = rs.filter(r => r.value === 'unknown')
  return unknowns.length > 0 ? unknown(unknowns.flatMap(r => r.missing)) : YES
}

function combineAny(rs: EvalResult[]): EvalResult {
  if (rs.some(r => r.value === 'yes')) return YES
  const unknowns = rs.filter(r => r.value === 'unknown')
  return unknowns.length > 0 ? unknown(unknowns.flatMap(r => r.missing)) : NO
}

function income(s: Scope, tableId: string, mode: 'atMost' | 'above'): EvalResult {
  const table = s.incomeTables[tableId]
  if (table === undefined) throw new Error(`unknown income table: ${tableId}`)
  const { size, incomeBand } = s.input.household
  if (size === null || incomeBand === null) {
    return unknown([
      ...(size === null ? ['household.size'] : []),
      ...(incomeBand === null ? ['household.incomeBand'] : []),
    ])
  }
  const limit = table[Math.min(size, table.length) - 1]
  if (limit === undefined) throw new Error(`income table ${tableId} is empty`)
  const atMost: Tri = incomeBand.high <= limit ? 'yes' : incomeBand.low > limit ? 'no' : 'unknown'
  const value: Tri = mode === 'atMost' ? atMost : atMost === 'yes' ? 'no' : atMost === 'no' ? 'yes' : 'unknown'
  if (value === 'unknown') return unknown(['household.incomeBand'])
  return value === 'yes' ? YES : NO
}

/** Every unit that is (or may be) eligible must meet `require` (research §2.3). */
function allUnits(spec: { eligible: Condition; require: Condition }, s: Scope): EvalResult {
  let anyNo = false
  let pending = false
  const missing: string[] = []
  for (const unit of s.input.building.units) {
    const us: Scope = { ...s, unit }
    const e = evaluate(spec.eligible, us)
    if (e.value === 'no') continue
    const r = evaluate(spec.require, us)
    if (r.value === 'yes') continue
    if (e.value === 'yes' && r.value === 'no') anyNo = true
    else {
      pending = true
      missing.push(...e.missing, ...r.missing)
    }
  }
  if (anyNo) return NO
  return pending ? unknown(missing) : YES
}

export function evaluate(c: Condition, s: Scope): EvalResult {
  if ('all' in c) return combineAll(c.all.map(x => evaluate(x, s)))
  if ('any' in c) return combineAny(c.any.map(x => evaluate(x, s)))
  if ('not' in c) {
    const r = evaluate(c.not, s)
    if (r.value === 'unknown') return r
    return r.value === 'yes' ? NO : YES
  }
  if ('fact' in c) return leaf(c, s)
  if ('incomeAtMost' in c) return income(s, c.incomeAtMost, 'atMost')
  if ('incomeAbove' in c) return income(s, c.incomeAbove, 'above')
  if ('ref' in c) {
    const p = s.predicates[c.ref]
    if (p === undefined) throw new Error(`unknown predicate: ${c.ref}`)
    return evaluate(p, s)
  }
  return allUnits(c.allUnits, s)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd engine && npx vitest run test/condition.test.ts && npm run typecheck`
Expected: PASS (13 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add engine/src/condition.ts engine/test/condition.test.ts
git commit -m "feat(engine): add three-valued condition evaluator"
```

---

### Task 6: All-units participation (the signature feature)

The code exists from Task 5. These tests pin its behavior (research §2.3).

**Files:**
- Test: `engine/test/participation.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, expect, test } from 'vitest'
import { evaluate, type Condition } from '../src/condition.js'
import type { Unit } from '../src/facts.js'
import { input, scope, unit } from './fixtures.js'

const PREDICATES = { condo_eligible_unit: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true } } as const
const ALL_UNITS: Condition = {
  allUnits: { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } },
}
const run = (units: Unit[]) => evaluate(ALL_UNITS, scope(input({ building: { units } }), { unit: null, predicates: PREDICATES }))
const m = (id: string, participating: boolean | null, meter: boolean | null = true) =>
  unit(id, { hasResidentialHeatingMeter: meter, participating })

describe('allUnits', () => {
  test('everyone eligible agreed → yes', () => {
    expect(run([m('1', true), m('2', true), m('3', true)]).value).toBe('yes')
  })
  test('one eligible unit said no → no', () => {
    expect(run([m('1', true), m('2', true), m('3', false)]).value).toBe('no')
  })
  test('an undecided eligible unit → unknown, asks for participation', () => {
    expect(run([m('1', true), m('2', null)])).toEqual({ value: 'unknown', missing: ['unit.participating'] })
  })
  test('an ineligible unit is not needed', () => {
    expect(run([m('1', true), m('2', false, false)]).value).toBe('yes')
  })
  test('unknown eligibility of a non-participating unit → unknown, asks for the meter', () => {
    expect(run([m('1', true), m('2', false, null)])).toEqual({ value: 'unknown', missing: ['unit.hasResidentialHeatingMeter'] })
  })
  test('a definite no beats another unit being undecided', () => {
    expect(run([m('1', false), m('2', null)]).value).toBe('no')
  })
})
```

- [ ] **Step 2: Run**

Run: `cd engine && npx vitest run test/participation.test.ts`
Expected: PASS (6 tests). If one fails, fix `allUnits` in `engine/src/condition.ts`, not the test.

- [ ] **Step 3: Commit**

```bash
git add engine/test/participation.test.ts
git commit -m "test(engine): pin all-units participation behavior"
```

---

### Task 7: Property tests for conditions

**Files:**
- Test: `engine/test/condition.pbt.test.ts`

- [ ] **Step 1: Write the property tests**

```ts
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
  { fact: 'household.onDiscountRate', op: 'eq', value: true },
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
```

The third property uses an exact income (`low === high`), because a known income *range* can legitimately straddle a limit.

- [ ] **Step 2: Run**

Run: `cd engine && npx vitest run test/condition.pbt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add engine/test/condition.pbt.test.ts
git commit -m "test(engine): property tests for condition logic"
```

---

### Task 8: Rules-data schema and provenance checks

**Files:**
- Create: `engine/src/rules-schema.ts`, `engine/src/provenance.ts`
- Modify: `engine/test/fixtures.ts` (shared rule fixtures)
- Test: `engine/test/rules-schema.test.ts`, `engine/test/provenance.test.ts`

- [ ] **Step 1: Append shared rule fixtures to `engine/test/fixtures.ts`.** They live outside `*.test.ts` files, so importing them doesn't re-run tests.

```ts
export const SOURCE = {
  url: 'https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties',
  section: 'Landlord offer',
  quote: 'An instant incentive of 100% off insulation upgrades for your rental property',
  lastVerified: '2026-11-06',
}

export const OFFER = {
  id: 'test_offer',
  version: '1',
  programId: 'masssave_weatherization',
  title: 'Test',
  measure: 'weatherization',
  appliesTo: 'each_unit',
  dateBasis: 'as_of',
  installWindow: { from: '2026-01-01', until: null },
  applicationDeadline: null,
  eligibility: { fact: 'unit.occupancy', op: 'eq', value: 'renter' },
  prerequisites: [],
  confirmations: [],
  benefit: { type: 'percent_of_cost', pct: 100, costOf: 'weatherization' },
  qualification: 'up_to',
  enrollment: 'via_landlord',
  exclusiveGroup: 'insulation',
  capGroups: [],
  sources: [SOURCE],
}
```

- [ ] **Step 2: Write the failing tests — `engine/test/rules-schema.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { CapRuleSchema, OfferSchema } from '../src/rules-schema.js'
import { OFFER, SOURCE } from './fixtures.js'

describe('OfferSchema', () => {
  test('accepts a valid offer', () => {
    expect(OfferSchema.parse(OFFER).id).toBe('test_offer')
  })
  test('rejects an offer without sources (principle 3)', () => {
    expect(() => OfferSchema.parse({ ...OFFER, sources: [] })).toThrow()
  })
  test('rejects a percent over 100', () => {
    expect(() => OfferSchema.parse({ ...OFFER, benefit: { type: 'percent_of_cost', pct: 120, costOf: 'weatherization' } })).toThrow()
  })
  test('rejects an unknown operator', () => {
    expect(() => OfferSchema.parse({ ...OFFER, eligibility: { fact: 'unit.occupancy', op: 'equals', value: 'renter' } })).toThrow()
  })
  test('rejects a comparison against a non-number', () => {
    expect(() => OfferSchema.parse({ ...OFFER, eligibility: { fact: 'building.yearBuilt', op: 'gte', value: '2000' } })).toThrow()
  })
  test('accepts nested conditions, refs and all-units', () => {
    const eligibility = {
      all: [
        { any: [{ fact: 'unit.heatingFuel', op: 'in', value: ['oil'] }] },
        { not: { incomeAbove: 't' } },
        { allUnits: { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } } },
      ],
    }
    expect(OfferSchema.parse({ ...OFFER, eligibility }).eligibility).toEqual(eligibility)
  })
  test('accepts a prerequisite that we cannot check (satisfiedWhen null)', () => {
    const prerequisites = [{ id: 'installer', kind: 'requirement', description: 'Use a network installer.', satisfiedWhen: null, sources: [SOURCE] }]
    expect(OfferSchema.parse({ ...OFFER, prerequisites }).prerequisites).toHaveLength(1)
  })
  test('rejects a bad date', () => {
    expect(() => OfferSchema.parse({ ...OFFER, installWindow: { from: '2026-13-01', until: null } })).toThrow()
  })
})

describe('CapRuleSchema', () => {
  test('accepts money and count limits', () => {
    const base = { id: 'c', capGroup: 'g', scope: 'account', window: { from: '2026-01-01', until: null }, sources: [SOURCE] }
    expect(CapRuleSchema.parse({ ...base, limit: { type: 'money', amount: 8500 } }).limit.type).toBe('money')
    expect(CapRuleSchema.parse({ ...base, limit: { type: 'count', count: 1 } }).limit.type).toBe('count')
  })
})
```

- [ ] **Step 3: Write the failing tests — `engine/test/provenance.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { daysBetween, findDataProblems, inWindow, isRetired, isStale } from '../src/provenance.js'
import { OfferSchema, RuleSetSchema, type Offer, type RuleSet } from '../src/rules-schema.js'
import { OFFER, SOURCE } from './fixtures.js'

const offer = (over: Record<string, unknown> = {}): Offer => OfferSchema.parse({ ...OFFER, ...over })

function ruleSet(over: Partial<RuleSet> = {}): RuleSet {
  return RuleSetSchema.parse({
    programs: [{ id: 'masssave_weatherization', name: 'Mass Save weatherization', administrator: 'Mass Save Sponsors',
      handoff: { label: 'Call Mass Save', phone: '866-527-7283', url: 'https://www.masssave.com/' }, sources: [SOURCE] }],
    offers: [OFFER],
    predicates: [],
    incomeTables: [],
    dec: { municipalities: [{ name: 'Boston', narrowedFor: [] }], sources: [SOURCE] },
    caps: [],
    sequence: [],
    ...over,
  })
}
const TODAY = '2026-11-15'

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
  test('a version retires only after both the install window and the application deadline pass', () => {
    const o = offer({ installWindow: { from: '2026-01-01', until: '2026-12-31' }, applicationDeadline: '2027-02-28' })
    expect(isRetired(o, '2027-01-15')).toBe(false)
    expect(isRetired(o, '2027-03-01')).toBe(true)
  })
})

describe('findDataProblems', () => {
  test('clean data has no problems', () => {
    expect(findDataProblems(ruleSet(), TODAY)).toEqual([])
  })
  test('unknown fact path, including inside prerequisites and confirmations', () => {
    const bad = offer({
      eligibility: { fact: 'unit.occupancyy', op: 'eq', value: 'renter' },
      prerequisites: [{ id: 'p', kind: 'action', description: 'd', satisfiedWhen: { fact: 'nope.a', op: 'eq', value: true }, sources: [SOURCE] }],
      confirmations: [{ id: 'c', question: 'q', decidedBy: 'x', nextAction: 'y', when: { fact: 'nope.b', op: 'eq', value: true }, sources: [SOURCE] }],
    })
    const problems = findDataProblems(ruleSet({ offers: [bad] }), TODAY)
    expect(problems).toContain('offer test_offer@1: unknown fact path unit.occupancyy')
    expect(problems).toContain('offer test_offer@1: unknown fact path nope.a')
    expect(problems).toContain('offer test_offer@1: unknown fact path nope.b')
  })
  test('unknown program', () => {
    expect(findDataProblems(ruleSet({ offers: [offer({ programId: 'nope' })] }), TODAY)).toContain('offer test_offer@1: unknown program nope')
  })
  test('retired version still in the active set', () => {
    const old = offer({ installWindow: { from: '2025-01-01', until: '2025-12-31' }, applicationDeadline: '2026-02-28' })
    expect(findDataProblems(ruleSet({ offers: [old] }), TODAY)).toContain('offer test_offer@1: retired; move to archive/')
  })
  test('duplicate id + version', () => {
    expect(findDataProblems(ruleSet({ offers: [offer(), offer()] }), TODAY)).toContain('duplicate offer test_offer@1')
  })
  test('overlapping versions of the same offer', () => {
    const a = offer({ version: '2026', installWindow: { from: '2026-01-01', until: '2026-12-31' } })
    const b = offer({ version: '2027', installWindow: { from: '2026-12-01', until: null } })
    expect(findDataProblems(ruleSet({ offers: [a, b] }), TODAY)).toContain('offer test_offer: versions 2026 and 2027 overlap')
  })
  test('unknown income table, predicate and cap group', () => {
    const bad = offer({ eligibility: { all: [{ incomeAtMost: 'missing_table' }, { ref: 'missing_pred' }] }, capGroups: ['nope'] })
    const problems = findDataProblems(ruleSet({ offers: [bad] }), TODAY)
    expect(problems).toContain('offer test_offer@1: unknown income table missing_table')
    expect(problems).toContain('offer test_offer@1: unknown predicate missing_pred')
    expect(problems).toContain('offer test_offer@1: no cap rule for capGroup nope')
  })
})
```

- [ ] **Step 4: Run to verify failure**

Run: `cd engine && npx vitest run test/rules-schema.test.ts test/provenance.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 5: Implement `engine/src/rules-schema.ts`**

```ts
import { z } from 'zod'
import type { Condition } from './condition.js'

const IsoDate = z.iso.date()
const Id = z.string().regex(/^[a-z0-9_]+$/)

export const Measure = z.enum([
  'bill_assistance', 'assessment', 'weatherization', 'heat_pump',
  'rooftop_solar', 'community_solar', 'financing', 'tax_credit',
])
export type Measure = z.infer<typeof Measure>
/** Tie-break order for steps when no sequence edge decides. */
export const MEASURE_ORDER: readonly Measure[] = Measure.options

const Scalar = z.union([z.string(), z.number(), z.boolean()])

const LeafSchema = z.union([
  z.strictObject({ fact: z.string(), op: z.literal('eq'), value: Scalar }),
  z.strictObject({ fact: z.string(), op: z.literal('in'), value: z.array(Scalar).min(1) }),
  z.strictObject({ fact: z.string(), op: z.enum(['gte', 'gt', 'lte', 'lt']), value: z.number() }),
])

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(ConditionSchema).min(1) }),
    z.strictObject({ any: z.array(ConditionSchema).min(1) }),
    z.strictObject({ not: ConditionSchema }),
    LeafSchema,
    z.strictObject({ incomeAtMost: z.string() }),
    z.strictObject({ incomeAbove: z.string() }),
    z.strictObject({ allUnits: z.strictObject({ eligible: ConditionSchema, require: ConditionSchema }) }),
    z.strictObject({ ref: Id }),
  ]),
)

export const SourceSchema = z.strictObject({
  url: z.url(),
  section: z.string().min(1),
  quote: z.string().min(1),
  lastVerified: IsoDate,
})
export type Source = z.infer<typeof SourceSchema>
const Sources = z.array(SourceSchema).min(1)

const Pct = z.number().gt(0).lte(100)
export const BenefitSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('percent_of_cost'), pct: Pct, costOf: Measure }),
  z.strictObject({ type: z.literal('percent_of_cost_capped'), pct: Pct, cap: z.number().positive(), costOf: Measure }),
  z.strictObject({ type: z.literal('per_ton'), rate: z.number().positive(), cap: z.number().positive() }),
  z.strictObject({ type: z.literal('fixed'), amount: z.number().positive() }),
  z.strictObject({ type: z.literal('per_kwh'), rate: z.number().positive(), years: z.number().int().positive() }),
  z.strictObject({ type: z.literal('min_discount_on_credits'), pct: Pct }),
  z.strictObject({ type: z.literal('loan'), maxPrincipal: z.number().positive(), apr: z.literal(0) }),
  z.strictObject({ type: z.literal('none') }),
])
export type Benefit = z.infer<typeof BenefitSchema>

export const WindowSchema = z.strictObject({ from: IsoDate, until: IsoDate.nullable() })
export type Window = z.infer<typeof WindowSchema>

/** Something the user does first. Never changes an offer's status (schema §3). */
export const PrerequisiteSchema = z.strictObject({
  id: Id,
  kind: z.enum(['action', 'requirement']),
  description: z.string().min(1),
  /** null = we can't check it; shown as a checklist item. */
  satisfiedWhen: ConditionSchema.nullable(),
  sources: Sources,
})
export type Prerequisite = z.infer<typeof PrerequisiteSchema>

/** Something only the program can confirm. Makes an otherwise eligible result 'potential' (schema §3). */
export const ConfirmationSchema = z.strictObject({
  id: Id,
  question: z.string().min(1),
  decidedBy: z.string().min(1),
  nextAction: z.string().min(1),
  /** null = always applies. Applies when this is yes or unknown. */
  when: ConditionSchema.nullable(),
  sources: Sources,
})
export type Confirmation = z.infer<typeof ConfirmationSchema>

export const OfferSchema = z.strictObject({
  id: Id,
  version: z.string().min(1),
  programId: Id,
  title: z.string().min(1),
  measure: Measure,
  /** each_unit: evaluated for every unit (coordination view). user: once, for the user's unit and household. */
  appliesTo: z.enum(['each_unit', 'user']),
  /** installation: the version is picked by the planned install date. as_of: by today's date. */
  dateBasis: z.enum(['installation', 'as_of']),
  installWindow: WindowSchema,
  applicationDeadline: IsoDate.nullable(),
  eligibility: ConditionSchema,
  prerequisites: z.array(PrerequisiteSchema),
  confirmations: z.array(ConfirmationSchema),
  benefit: BenefitSchema,
  qualification: z.enum(['exact', 'up_to', 'minimum']),
  enrollment: z.enum(['apply', 'via_assessment', 'via_landlord', 'auto_selected', 'referral']),
  exclusiveGroup: z.string().nullable(),
  capGroups: z.array(z.string()),
  sources: Sources,
})
export type Offer = z.infer<typeof OfferSchema>
export const offerKey = (o: { id: string; version: string }): string => `${o.id}@${o.version}`

export const ProgramSchema = z.strictObject({
  id: Id,
  name: z.string().min(1),
  administrator: z.string().min(1),
  handoff: z.strictObject({ label: z.string().min(1), phone: z.string().nullable(), url: z.url() }),
  sources: Sources,
})
export type Program = z.infer<typeof ProgramSchema>

export const PredicateSchema = z.strictObject({
  id: Id,
  condition: ConditionSchema,
  note: z.string().min(1),
  sources: Sources,
})

export const IncomeTableSchema = z.strictObject({
  id: Id,
  label: z.string().min(1),
  /** Income limit by household size; index 0 = 1 person. */
  bySize: z.array(z.number().positive()).min(1),
  sources: Sources,
})

export const DecFileSchema = z.strictObject({
  municipalities: z.array(z.strictObject({ name: z.string().min(1), narrowedFor: z.array(z.string()) })).min(1),
  sources: Sources,
})

export const CapRuleSchema = z.strictObject({
  id: Id,
  capGroup: z.string().min(1),
  scope: z.enum(['account', 'home', 'customer_lifetime', 'installation']),
  limit: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('money'), amount: z.number().positive() }),
    z.strictObject({ type: z.literal('count'), count: z.number().int().positive() }),
  ]),
  window: WindowSchema,
  sources: Sources,
})
export type CapRule = z.infer<typeof CapRuleSchema>

export const SequenceEdgeSchema = z.strictObject({
  before: Measure,
  after: Measure,
  reason: z.string().min(1),
  sources: Sources,
})
export type SequenceEdge = z.infer<typeof SequenceEdgeSchema>

export const RuleSetSchema = z.strictObject({
  programs: z.array(ProgramSchema),
  offers: z.array(OfferSchema),
  predicates: z.array(PredicateSchema),
  incomeTables: z.array(IncomeTableSchema),
  dec: DecFileSchema,
  caps: z.array(CapRuleSchema),
  sequence: z.array(SequenceEdgeSchema),
})
export type RuleSet = z.infer<typeof RuleSetSchema>
```

- [ ] **Step 6: Implement `engine/src/provenance.ts`**

```ts
import type { Condition } from './condition.js'
import { offerKey, type Offer, type RuleSet, type Source, type Window } from './rules-schema.js'
import { FACT_PATHS } from './scope.js'

export const STALE_AFTER_DAYS = 90
const DAY_MS = 86_400_000
const FAR_FUTURE = '9999-12-31'

export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

export const isStale = (lastVerified: string, asOf: string): boolean => daysBetween(lastVerified, asOf) > STALE_AFTER_DAYS

export function oldestVerified(sources: readonly Source[]): string {
  const first = sources.map(s => s.lastVerified).sort()[0]
  if (first === undefined) throw new Error('no sources')
  return first
}

export const inWindow = (w: Window, date: string): boolean => w.from <= date && (w.until === null || date <= w.until)

/** Retired = install window and application deadline have both passed (schema §5). */
export function isRetired(o: Offer, today: string): boolean {
  const installOver = o.installWindow.until !== null && o.installWindow.until < today
  const paperworkOver = o.applicationDeadline === null || o.applicationDeadline < today
  return installOver && paperworkOver
}

const overlaps = (a: Window, b: Window): boolean =>
  a.from <= (b.until ?? FAR_FUTURE) && b.from <= (a.until ?? FAR_FUTURE)

/** Calls `visit` on every node of a condition tree. */
export function walk(c: Condition, visit: (node: Condition) => void): void {
  visit(c)
  if ('all' in c) c.all.forEach(x => walk(x, visit))
  else if ('any' in c) c.any.forEach(x => walk(x, visit))
  else if ('not' in c) walk(c.not, visit)
  else if ('allUnits' in c) {
    walk(c.allUnits.eligible, visit)
    walk(c.allUnits.require, visit)
  }
}

const duplicates = (ids: string[]): string[] => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]

/** Everything that must block shipping the active rules data. Empty list = OK. */
export function findDataProblems(rules: RuleSet, today: string): string[] {
  const problems: string[] = []
  const facts = new Set<string>(FACT_PATHS)
  const programs = new Set(rules.programs.map(p => p.id))
  const tables = new Set(rules.incomeTables.map(t => t.id))
  const predicates = new Set(rules.predicates.map(p => p.id))
  const capGroups = new Set(rules.caps.map(c => c.capGroup))

  const check = (where: string, c: Condition): void =>
    walk(c, node => {
      if ('fact' in node && !facts.has(node.fact)) problems.push(`${where}: unknown fact path ${node.fact}`)
      if ('incomeAtMost' in node && !tables.has(node.incomeAtMost)) problems.push(`${where}: unknown income table ${node.incomeAtMost}`)
      if ('incomeAbove' in node && !tables.has(node.incomeAbove)) problems.push(`${where}: unknown income table ${node.incomeAbove}`)
      if ('ref' in node && !predicates.has(node.ref)) problems.push(`${where}: unknown predicate ${node.ref}`)
    })

  for (const id of duplicates(rules.programs.map(p => p.id))) problems.push(`duplicate program ${id}`)
  for (const k of duplicates(rules.offers.map(offerKey))) problems.push(`duplicate offer ${k}`)
  for (const id of duplicates(rules.predicates.map(p => p.id))) problems.push(`duplicate predicate ${id}`)
  for (const id of duplicates(rules.caps.map(c => c.id))) problems.push(`duplicate cap ${id}`)

  for (const p of rules.predicates) check(`predicate ${p.id}`, p.condition)

  for (const o of rules.offers) {
    const where = `offer ${offerKey(o)}`
    if (!programs.has(o.programId)) problems.push(`${where}: unknown program ${o.programId}`)
    if (o.installWindow.until !== null && o.installWindow.until < o.installWindow.from) problems.push(`${where}: window ends before it starts`)
    if (isRetired(o, today)) problems.push(`${where}: retired; move to archive/`)
    for (const g of o.capGroups) if (!capGroups.has(g)) problems.push(`${where}: no cap rule for capGroup ${g}`)
    check(where, o.eligibility)
    for (const p of o.prerequisites) if (p.satisfiedWhen !== null) check(where, p.satisfiedWhen)
    for (const c of o.confirmations) if (c.when !== null) check(where, c.when)
  }

  const byId = new Map<string, Offer[]>()
  for (const o of rules.offers) byId.set(o.id, [...(byId.get(o.id) ?? []), o])
  for (const [id, versions] of byId) {
    for (let i = 0; i < versions.length; i++) {
      for (let j = i + 1; j < versions.length; j++) {
        const a = versions[i]
        const b = versions[j]
        if (a && b && a.version !== b.version && overlaps(a.installWindow, b.installWindow)) {
          problems.push(`offer ${id}: versions ${a.version} and ${b.version} overlap`)
        }
      }
    }
  }
  return problems
}
```

- [ ] **Step 7: Run to verify pass**

Run: `cd engine && npx vitest run test/rules-schema.test.ts test/provenance.test.ts && npm run typecheck`
Expected: PASS (9 + 11 tests); typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add engine/src/rules-schema.ts engine/src/provenance.ts engine/test/fixtures.ts engine/test/rules-schema.test.ts engine/test/provenance.test.ts
git commit -m "feat(engine): add rules-data schema and provenance checks"
```

---
### Task 9: Benefit calculators

**Files:**
- Create: `engine/src/benefit.ts`
- Test: `engine/test/benefit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest'
import { benefitValue, NO_QUANTITIES, type Quantities } from '../src/benefit.js'
import { range } from '../src/range.js'

const Q: Quantities = {
  cost: { weatherization: range(6000, 9000, 12000), heat_pump: range(18000, 22000, 26000), rooftop_solar: range(15000, 20000, 25000) },
  heatPumpTons: range(2, 3, 4),
  solarKwhPerYear: range(4000, 5000, 6000),
  communitySolarCreditsPerYear: range(600, 800, 1000),
}

describe('benefitValue', () => {
  test('percent of cost', () => {
    expect(benefitValue({ type: 'percent_of_cost', pct: 75, costOf: 'weatherization' }, Q)).toEqual(range(4500, 6750, 9000))
  })
  test('percent of cost, capped', () => {
    expect(benefitValue({ type: 'percent_of_cost_capped', pct: 15, cap: 1000, costOf: 'rooftop_solar' }, Q)).toEqual(range(1000, 1000, 1000))
  })
  test('per ton with cap (whole-home 2026: $2,650/ton up to $8,500)', () => {
    expect(benefitValue({ type: 'per_ton', rate: 2650, cap: 8500 }, Q)).toEqual(range(5300, 7950, 8500))
  })
  test('per ton never exceeds installation cost (research §6)', () => {
    const cheap: Quantities = { ...Q, cost: { heat_pump: range(4000, 5000, 6000) } }
    expect(benefitValue({ type: 'per_ton', rate: 2650, cap: 8500 }, cheap)).toEqual(range(4000, 5000, 6000))
  })
  test('per kWh over 20 years (SMART ≤25 kW: $0.03/kWh)', () => {
    const r = benefitValue({ type: 'per_kwh', rate: 0.03, years: 20 }, Q)
    expect(r?.low).toBeCloseTo(2400)
    expect(r?.mid).toBeCloseTo(3000)
    expect(r?.high).toBeCloseTo(3600)
  })
  test('minimum discount on community solar credits', () => {
    expect(benefitValue({ type: 'min_discount_on_credits', pct: 20 }, Q)).toEqual(range(120, 160, 200))
  })
  test('fixed', () => {
    expect(benefitValue({ type: 'fixed', amount: 500 }, Q)).toEqual(range(500, 500, 500))
  })
  test('loans and none are not money benefits', () => {
    expect(benefitValue({ type: 'loan', maxPrincipal: 25000, apr: 0 }, Q)).toBeNull()
    expect(benefitValue({ type: 'none' }, Q)).toBeNull()
  })
  test('missing quantity gives null, never a guess', () => {
    expect(benefitValue({ type: 'percent_of_cost', pct: 100, costOf: 'weatherization' }, NO_QUANTITIES)).toBeNull()
    expect(benefitValue({ type: 'per_ton', rate: 2650, cap: 8500 }, NO_QUANTITIES)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run test/benefit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/src/benefit.ts`**

```ts
import { capAt, minOf, point, scale, type Range } from './range.js'
import type { Benefit, Measure } from './rules-schema.js'

/** Physical and cost quantities for one unit (or the building, for building-level measures). */
export interface Quantities {
  cost: Partial<Record<Measure, Range>>
  heatPumpTons: Range | null
  solarKwhPerYear: Range | null
  communitySolarCreditsPerYear: Range | null
}

export const NO_QUANTITIES: Quantities = { cost: {}, heatPumpTons: null, solarKwhPerYear: null, communitySolarCreditsPerYear: null }

/** Money value of a benefit, or null when it isn't money or a needed quantity is unknown. */
export function benefitValue(b: Benefit, q: Quantities): Range | null {
  switch (b.type) {
    case 'percent_of_cost': {
      const c = q.cost[b.costOf]
      return c ? scale(c, b.pct / 100) : null
    }
    case 'percent_of_cost_capped': {
      const c = q.cost[b.costOf]
      return c ? capAt(scale(c, b.pct / 100), b.cap) : null
    }
    case 'per_ton': {
      if (!q.heatPumpTons) return null
      const rebate = capAt(scale(q.heatPumpTons, b.rate), b.cap)
      const cost = q.cost.heat_pump
      return cost ? minOf(rebate, cost) : rebate
    }
    case 'fixed':
      return point(b.amount)
    case 'per_kwh':
      return q.solarKwhPerYear ? scale(q.solarKwhPerYear, b.rate * b.years) : null
    case 'min_discount_on_credits':
      return q.communitySolarCreditsPerYear ? scale(q.communitySolarCreditsPerYear, b.pct / 100) : null
    case 'loan':
    case 'none':
      return null
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd engine && npx vitest run test/benefit.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add engine/src/benefit.ts engine/test/benefit.test.ts
git commit -m "feat(engine): add benefit calculators returning ranges"
```

---

### Task 10: "What would change the answer" by re-evaluation

The engine never edits the real input. It tries realistic changes on a copy and reports the smallest set that makes the condition hold (schema §6).

**Files:**
- Create: `engine/src/counterfactual.ts`
- Test: `engine/test/counterfactual.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest'
import type { Condition } from '../src/condition.js'
import { findChanges } from '../src/counterfactual.js'
import { input, scope, unit } from './fixtures.js'

const PREDICATES: Record<string, Condition> = { condo_eligible_unit: { fact: 'unit.hasResidentialHeatingMeter', op: 'eq', value: true } }
const ALL_UNITS: Condition = {
  allUnits: { eligible: { ref: 'condo_eligible_unit' }, require: { fact: 'unit.participating', op: 'eq', value: true } },
}
const condo = (parts: (boolean | null)[], onDiscountRate: boolean | null = false) => {
  const i = input({
    building: { units: parts.map((p, k) => unit(String(k + 1), { hasResidentialHeatingMeter: true, participating: p })) },
    household: { onDiscountRate },
  })
  return scope(i, { predicates: PREDICATES })
}

describe('findChanges', () => {
  test('one unit said no → that unit agreeing is the change', () => {
    expect(findChanges(ALL_UNITS, condo([true, true, false]))).toEqual([{ fact: 'unit.participating', unitId: '3', to: true }])
  })
  test('two units missing → both are needed', () => {
    expect(findChanges(ALL_UNITS, condo([true, false, null]))).toEqual([
      { fact: 'unit.participating', unitId: '2', to: true },
      { fact: 'unit.participating', unitId: '3', to: true },
    ])
  })
  test('getting on the discount rate', () => {
    const c: Condition = { fact: 'household.onDiscountRate', op: 'eq', value: true }
    expect(findChanges(c, condo([true], false))).toEqual([{ fact: 'household.onDiscountRate', to: true }])
  })
  test('nothing realistic helps → null', () => {
    const c: Condition = { fact: 'user.role', op: 'eq', value: 'condo_owner' }
    expect(findChanges(c, condo([false]))).toBeNull()
  })
  test('the real input is not changed', () => {
    const s = condo([true, false])
    findChanges(ALL_UNITS, s)
    expect(s.input.building.units[1]?.participating).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run test/counterfactual.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/src/counterfactual.ts`**

```ts
import { evaluate, type Condition } from './condition.js'
import { walk } from './provenance.js'
import type { Scope } from './scope.js'

/** Changes a household can actually make. Extend only with facts users can act on. */
export type Change =
  | { fact: 'unit.participating'; unitId: string; to: true }
  | { fact: 'household.onDiscountRate'; to: true }

function mentions(c: Condition, s: Scope, fact: string, seen = new Set<string>()): boolean {
  let found = false
  walk(c, node => {
    if ('fact' in node && node.fact === fact) found = true
    if ('ref' in node && !seen.has(node.ref)) {
      seen.add(node.ref)
      const p = s.predicates[node.ref]
      if (p !== undefined && mentions(p, s, fact, seen)) found = true
    }
  })
  return found
}

function apply(s: Scope, changes: readonly Change[]): Scope {
  let input = s.input
  for (const ch of changes) {
    if (ch.fact === 'unit.participating') {
      const units = input.building.units.map(u => (u.id === ch.unitId ? { ...u, participating: true } : u))
      input = { ...input, building: { ...input.building, units } }
    } else {
      input = { ...input, household: { ...input.household, onDiscountRate: true } }
    }
  }
  const unitId = s.unit?.id
  const unit = unitId === undefined ? null : (input.building.units.find(u => u.id === unitId) ?? null)
  return { ...s, input, unit }
}

function subsets<T>(xs: readonly T[], k: number): T[][] {
  if (k === 0) return [[]]
  const [head, ...tail] = xs
  if (head === undefined || xs.length < k) return []
  return [...subsets(tail, k - 1).map(rest => [head, ...rest]), ...subsets(tail, k)]
}

/** Smallest set of realistic changes that makes `c` hold, or null if none does. */
export function findChanges(c: Condition, s: Scope): Change[] | null {
  const candidates: Change[] = []
  if (mentions(c, s, 'unit.participating')) {
    for (const u of s.input.building.units) {
      if (u.participating !== true) candidates.push({ fact: 'unit.participating', unitId: u.id, to: true })
    }
  }
  if (s.input.household.onDiscountRate !== true && mentions(c, s, 'household.onDiscountRate')) {
    candidates.push({ fact: 'household.onDiscountRate', to: true })
  }
  for (let k = 1; k <= candidates.length; k++) {
    for (const set of subsets(candidates, k)) {
      if (evaluate(c, apply(s, set)).value === 'yes') return set
    }
  }
  return null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd engine && npx vitest run test/counterfactual.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add engine/src/counterfactual.ts engine/test/counterfactual.test.ts
git commit -m "feat(engine): find what would change the answer by re-evaluation"
```

---

### Task 11: Offer evaluation — status, prerequisites, confirmations, best-of, caps

**Files:**
- Create: `engine/src/offers.ts`
- Test: `engine/test/offers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest'
import { NO_QUANTITIES, type Quantities } from '../src/benefit.js'
import { applyCaps, chooseBest, evaluateOffer, type OfferResult } from '../src/offers.js'
import { range } from '../src/range.js'
import { CapRuleSchema, OfferSchema, offerKey, type Offer } from '../src/rules-schema.js'
import { input, OFFER, scope, SOURCE, unit } from './fixtures.js'

const Q: Quantities = { ...NO_QUANTITIES, cost: { weatherization: range(6000, 9000, 12000) } }
const offer = (over: Record<string, unknown> = {}): Offer => OfferSchema.parse({ ...OFFER, ...over })
const base = () => scope(input({
  userUnitId: '2',
  building: { units: [unit('1', { occupancy: 'owner' }), unit('2', { occupancy: 'renter' }), unit('3')] },
}), { unit: null })
const forUnit = (rs: OfferResult[], id: string) => rs.find(r => r.unitId === id)

describe('evaluateOffer: status', () => {
  test('eligible / not_eligible / needs_info per unit', () => {
    const rs = evaluateOffer(offer(), base(), () => Q)
    expect(rs.map(r => [r.unitId, r.status])).toEqual([['1', 'not_eligible'], ['2', 'eligible'], ['3', 'needs_info']])
    expect(forUnit(rs, '2')?.value).toEqual(range(6000, 9000, 12000))
    expect(forUnit(rs, '1')?.value).toBeNull()
    expect(forUnit(rs, '3')?.missing).toEqual(['unit.occupancy'])
  })
  test('user scope evaluates the user unit only', () => {
    const rs = evaluateOffer(offer({ appliesTo: 'user' }), base(), () => Q)
    expect(rs.map(r => r.unitId)).toEqual(['2'])
  })
  test('an applicable confirmation makes an eligible result potential', () => {
    const confirmations = [{ id: 'c', question: 'q?', decidedBy: 'Mass Save', nextAction: 'Ask.', when: null, sources: [SOURCE] }]
    const r = forUnit(evaluateOffer(offer({ confirmations }), base(), () => Q), '2')
    expect(r?.status).toBe('potential')
    expect(r?.confirmations.map(c => c.decidedBy)).toEqual(['Mass Save'])
  })
  test('a confirmation whose `when` is no does not apply', () => {
    const confirmations = [{ id: 'c', question: 'q?', decidedBy: 'x', nextAction: 'y', when: { fact: 'unit.occupancy', op: 'eq', value: 'owner' }, sources: [SOURCE] }]
    expect(forUnit(evaluateOffer(offer({ confirmations }), base(), () => Q), '2')?.status).toBe('eligible')
  })
})

describe('evaluateOffer: prerequisites never change status (Qiao, 2026-11-06)', () => {
  test('a prerequisite still to do → eligible, with the step marked todo', () => {
    const prerequisites = [
      { id: 'hea', kind: 'action', description: 'Do the assessment first.', satisfiedWhen: { fact: 'building.heaCompleted', op: 'eq', value: true }, sources: [SOURCE] },
      { id: 'installer', kind: 'requirement', description: 'Use a network installer.', satisfiedWhen: null, sources: [SOURCE] },
    ]
    const s = base()
    const withHea = scope({ ...s.input, building: { ...s.input.building, heaCompleted: false } }, { unit: null })
    const r = forUnit(evaluateOffer(offer({ prerequisites }), withHea, () => Q), '2')
    expect(r?.status).toBe('eligible')
    expect(r?.prerequisites.map(p => [p.id, p.state])).toEqual([['hea', 'todo'], ['installer', 'check']])
  })
})

describe('evaluateOffer: money and changes', () => {
  test('100% of cost flags near-zero out of pocket, even without a cost', () => {
    const r = forUnit(evaluateOffer(offer(), base(), () => NO_QUANTITIES), '2')
    expect(r?.value).toBeNull()
    expect(r?.nearZeroOutOfPocket).toBe(true)
  })
  test('not eligible results carry what would change the answer', () => {
    const discount = offer({ appliesTo: 'user', eligibility: { fact: 'household.onDiscountRate', op: 'eq', value: true } })
    const s = base()
    const noRate = scope({ ...s.input, household: { ...s.input.household, onDiscountRate: false } }, { unit: null })
    expect(evaluateOffer(discount, noRate, () => Q)[0]?.changes).toEqual([{ fact: 'household.onDiscountRate', to: true }])
  })
})

describe('chooseBest', () => {
  const offers = new Map<string, Offer>(['a', 'b', 'c', 'd'].map(id => {
    const o = offer({ id, exclusiveGroup: id === 'd' ? null : 'g' })
    return [offerKey(o), o]
  }))
  const r = (offerId: string, status: OfferResult['status'], mid: number | null): OfferResult => ({
    offerId, version: '1', unitId: '1', status, missing: [], confirmations: [], prerequisites: [],
    value: mid === null ? null : range(mid, mid, mid), nearZeroOutOfPocket: false, changes: null,
  })
  test('keeps the best eligible; hides worse eligible and worse potential; keeps better potential, not_eligible and ungrouped', () => {
    const results = [r('a', 'eligible', 75), r('b', 'eligible', 50), r('c', 'potential', 100), r('b', 'potential', 10), r('a', 'not_eligible', null), r('d', 'eligible', 1)]
    expect(chooseBest(results, offers).map(x => `${x.offerId}:${x.status}`)).toEqual(['a:eligible', 'c:potential', 'a:not_eligible', 'd:eligible'])
  })
  test('ties keep the first', () => {
    expect(chooseBest([r('a', 'eligible', 75), r('b', 'eligible', 75)], offers).map(x => x.offerId)).toEqual(['a'])
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
  const offers = new Map<string, Offer>(['x', 'y'].map(id => {
    const o = offer({ id, capGroups: ['hp'] })
    return [offerKey(o), o]
  }))
  const res = (offerId: string, low: number, high: number): OfferResult => ({
    offerId, version: '1', unitId: '1', status: 'eligible', missing: [], confirmations: [], prerequisites: [],
    value: range(low, (low + high) / 2, high), nearZeroOutOfPocket: false, changes: null,
  })
  test('money caps clip the per-unit sum', () => {
    expect(applyCaps([res('x', 5000, 8000), res('y', 1000, 2000)], offers, [money], '2026-06-01')).toEqual([
      { capId: 'hp_cap', unitId: '1', scope: 'account', limit: { type: 'money', amount: 8500 }, total: range(6000, 8000, 8500), capped: true },
    ])
  })
  test('count caps become notes without a total', () => {
    expect(applyCaps([res('x', 5000, 8000)], offers, [count], '2026-06-01')[0]).toMatchObject({ capId: 'one_per_account', total: null, capped: false })
  })
  test('caps outside their window are ignored', () => {
    expect(applyCaps([res('x', 5000, 8000)], offers, [money], '2027-06-01')).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run test/offers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/src/offers.ts`**

```ts
import { benefitValue, type Quantities } from './benefit.js'
import { evaluate, type Tri } from './condition.js'
import { findChanges, type Change } from './counterfactual.js'
import { inWindow } from './provenance.js'
import { add, capAt, point, type Range } from './range.js'
import { offerKey, type CapRule, type Confirmation, type Offer } from './rules-schema.js'
import type { Scope } from './scope.js'

export type Status = 'eligible' | 'potential' | 'needs_info' | 'not_eligible'

export interface PrerequisiteResult {
  id: string
  kind: 'action' | 'requirement'
  description: string
  /** done / todo / unknown from the facts; 'check' = we can't check it (checklist item). */
  state: 'done' | 'todo' | 'unknown' | 'check'
}

export interface OfferResult {
  offerId: string
  version: string
  unitId: string | null
  status: Status
  /** Facts to ask the user about (status needs_info). */
  missing: string[]
  /** What only the program can confirm (status potential). */
  confirmations: Confirmation[]
  prerequisites: PrerequisiteResult[]
  value: Range | null
  /** Covers 100% of the cost: the UI says "you'd likely pay close to nothing" without a dollar figure. */
  nearZeroOutOfPocket: boolean
  changes: Change[] | null
}

export type QuantitiesFor = (unitId: string | null) => Quantities

const STATE: Record<Tri, PrerequisiteResult['state']> = { yes: 'done', no: 'todo', unknown: 'unknown' }
const keyOf = (r: OfferResult): string => offerKey({ id: r.offerId, version: r.version })

export function evaluateOffer(offer: Offer, base: Scope, quantitiesFor: QuantitiesFor): OfferResult[] {
  const { units } = base.input.building
  const userUnit = units.find(u => u.id === base.input.userUnitId) ?? null
  const scopes: Scope[] = offer.appliesTo === 'each_unit' ? units.map(unit => ({ ...base, unit })) : [{ ...base, unit: userUnit }]
  return scopes.map(s => {
    const e = evaluate(offer.eligibility, s)
    const confirmations = offer.confirmations.filter(c => c.when === null || evaluate(c.when, s).value !== 'no')
    const status: Status =
      e.value === 'no' ? 'not_eligible' : e.value === 'unknown' ? 'needs_info' : confirmations.length > 0 ? 'potential' : 'eligible'
    const unitId = s.unit?.id ?? null
    return {
      offerId: offer.id,
      version: offer.version,
      unitId,
      status,
      missing: e.missing,
      confirmations,
      prerequisites: offer.prerequisites.map(p => ({
        id: p.id,
        kind: p.kind,
        description: p.description,
        state: p.satisfiedWhen === null ? 'check' : STATE[evaluate(p.satisfiedWhen, s).value],
      })),
      value: status === 'not_eligible' ? null : benefitValue(offer.benefit, quantitiesFor(unitId)),
      nearZeroOutOfPocket: offer.benefit.type === 'percent_of_cost' && offer.benefit.pct === 100,
      changes: status === 'not_eligible' || status === 'needs_info' ? findChanges(offer.eligibility, s) : null,
    }
  })
}

/** > 0: a is better; < 0: worse; 0: equal; null: not comparable (schema §4). */
export function compareResults(a: OfferResult, b: OfferResult, offers: ReadonlyMap<string, Offer>): number | null {
  if (a.value !== null && b.value !== null) return a.value.mid - b.value.mid
  const ba = offers.get(keyOf(a))?.benefit
  const bb = offers.get(keyOf(b))?.benefit
  if (ba?.type === 'percent_of_cost' && bb?.type === 'percent_of_cost' && ba.costOf === bb.costOf) return ba.pct - bb.pct
  return null
}

export function chooseBest(results: readonly OfferResult[], offers: ReadonlyMap<string, Offer>): OfferResult[] {
  const keep = new Set<OfferResult>()
  const groups = new Map<string, OfferResult[]>()
  for (const r of results) {
    const group = offers.get(keyOf(r))?.exclusiveGroup ?? null
    if (group === null || r.status === 'not_eligible') {
      keep.add(r)
      continue
    }
    const k = `${group}|${r.unitId ?? ''}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const beatsOrTies = (k: OfferResult, r: OfferResult): boolean => {
    const c = compareResults(k, r, offers)
    return c !== null && c >= 0
  }
  for (const rs of groups.values()) {
    const best: OfferResult[] = []
    for (const r of rs.filter(x => x.status === 'eligible')) {
      if (best.some(k => beatsOrTies(k, r))) continue
      for (let i = best.length - 1; i >= 0; i--) {
        const k = best[i]
        if (k !== undefined && beatsOrTies(r, k)) best.splice(i, 1)
      }
      best.push(r)
    }
    for (const r of best) keep.add(r)
    for (const r of rs.filter(x => x.status !== 'eligible')) if (!best.some(k => beatsOrTies(k, r))) keep.add(r)
  }
  return results.filter(r => keep.has(r))
}

export interface CapNote {
  capId: string
  unitId: string | null
  scope: CapRule['scope']
  limit: CapRule['limit']
  /** Money caps: the capped sum of eligible/potential values. Count caps: null. */
  total: Range | null
  capped: boolean
}

/** Prior use is never known in v1: the UI words every cap as "if you haven't used this before". */
export function applyCaps(
  results: readonly OfferResult[], offers: ReadonlyMap<string, Offer>, caps: readonly CapRule[], date: string,
): CapNote[] {
  const notes: CapNote[] = []
  for (const cap of caps) {
    if (!inWindow(cap.window, date)) continue
    const byUnit = new Map<string | null, OfferResult[]>()
    for (const r of results) {
      if (r.status !== 'eligible' && r.status !== 'potential') continue
      if (!offers.get(keyOf(r))?.capGroups.includes(cap.capGroup)) continue
      byUnit.set(r.unitId, [...(byUnit.get(r.unitId) ?? []), r])
    }
    for (const [unitId, rs] of byUnit) {
      const values = rs.map(r => r.value).filter((v): v is Range => v !== null)
      if (cap.limit.type === 'count' || values.length === 0) {
        notes.push({ capId: cap.id, unitId, scope: cap.scope, limit: cap.limit, total: null, capped: false })
        continue
      }
      const sum = values.reduce(add, point(0))
      notes.push({ capId: cap.id, unitId, scope: cap.scope, limit: cap.limit, total: capAt(sum, cap.limit.amount), capped: sum.high > cap.limit.amount })
    }
  }
  return notes
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd engine && npx vitest run test/offers.test.ts && npm run typecheck`
Expected: PASS (14 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add engine/src/offers.ts engine/test/offers.test.ts
git commit -m "feat(engine): offer status, prerequisites, confirmations, best-of and caps"
```

---

### Task 12: Sequencing and `navigate` (with version selection)

**Files:**
- Create: `engine/src/plan.ts`, `engine/src/navigate.ts`
- Test: `engine/test/plan.test.ts`, `engine/test/navigate.test.ts`

- [ ] **Step 1: Write the failing tests — `engine/test/plan.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import type { OfferResult } from '../src/offers.js'
import { buildSteps } from '../src/plan.js'
import { OfferSchema, offerKey, SequenceEdgeSchema, type Measure, type Offer } from '../src/rules-schema.js'
import { OFFER, SOURCE } from './fixtures.js'

const offers = new Map<string, Offer>(
  (['assessment', 'weatherization', 'heat_pump', 'community_solar'] as Measure[]).map(m => {
    const o = OfferSchema.parse({ ...OFFER, id: m, measure: m })
    return [offerKey(o), o]
  }),
)
const res = (offerId: string, status: OfferResult['status'] = 'eligible'): OfferResult => ({
  offerId, version: '1', unitId: null, status, missing: [], confirmations: [], prerequisites: [], value: null, nearZeroOutOfPocket: false, changes: null,
})
const edge = (before: Measure, after: Measure) => SequenceEdgeSchema.parse({ before, after, reason: `${before} first`, sources: [SOURCE] })

describe('buildSteps', () => {
  test('orders by edges, then by MEASURE_ORDER', () => {
    const steps = buildSteps([res('heat_pump'), res('community_solar'), res('weatherization'), res('assessment')], offers,
      [edge('weatherization', 'heat_pump'), edge('assessment', 'weatherization')])
    expect(steps.map(s => s.measure)).toEqual(['assessment', 'weatherization', 'heat_pump', 'community_solar'])
    expect(steps[2]?.after).toEqual([{ measure: 'weatherization', reason: 'weatherization first' }])
  })
  test('potential and needs_info make steps; not_eligible does not', () => {
    const steps = buildSteps([res('heat_pump', 'potential'), res('assessment', 'needs_info'), res('weatherization', 'not_eligible')], offers,
      [edge('weatherization', 'heat_pump')])
    expect(steps.map(s => s.measure)).toEqual(['assessment', 'heat_pump'])
  })
  test('a cycle throws', () => {
    expect(() => buildSteps([res('heat_pump'), res('weatherization')], offers,
      [edge('weatherization', 'heat_pump'), edge('heat_pump', 'weatherization')])).toThrow(/cycle/)
  })
})
```

- [ ] **Step 2: Write the failing tests — `engine/test/navigate.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { NO_QUANTITIES } from '../src/benefit.js'
import { navigate } from '../src/navigate.js'
import { RuleSetSchema } from '../src/rules-schema.js'
import { input, OFFER, SOURCE, unit } from './fixtures.js'

const version = (v: string, from: string, until: string | null, deadline: string | null) => ({
  ...OFFER, id: 'rebate', version: v, dateBasis: 'installation', installWindow: { from, until }, applicationDeadline: deadline,
})
const rules = RuleSetSchema.parse({
  programs: [{ id: 'masssave_weatherization', name: 'P', administrator: 'A', handoff: { label: 'L', phone: null, url: 'https://www.masssave.com/' }, sources: [SOURCE] }],
  offers: [version('2026', '2026-01-01', '2026-12-31', '2027-02-28'), version('2027', '2027-01-01', null, null)],
  predicates: [], incomeTables: [],
  dec: { municipalities: [{ name: 'Boston', narrowedFor: [] }], sources: [SOURCE] },
  caps: [], sequence: [],
})
const i = input({ userUnitId: '1', building: { units: [unit('1', { occupancy: 'renter' })] } })

describe('navigate: versions by installation date (schema §5)', () => {
  test('a planned 2027 install uses the 2027 version', () => {
    const r = navigate(i, rules, { asOf: '2026-11-15', installDate: '2027-02-01' }, () => NO_QUANTITIES)
    expect([...new Set(r.results.map(x => x.version))]).toEqual(['2027'])
    expect(r.upcoming).toEqual([])
  })
  test('unknown install date: today’s version, the upcoming one listed, and the date asked', () => {
    const r = navigate(i, rules, { asOf: '2026-11-15', installDate: null }, () => NO_QUANTITIES)
    expect([...new Set(r.results.map(x => x.version))]).toEqual(['2026'])
    expect(r.upcoming).toEqual([{ offerId: 'rebate', version: '2027', from: '2027-01-01' }])
    expect(r.questions).toContain('project.installDate')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd engine && npx vitest run test/plan.test.ts test/navigate.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `engine/src/plan.ts`**

```ts
import type { OfferResult } from './offers.js'
import { MEASURE_ORDER, offerKey, type Measure, type Offer, type SequenceEdge } from './rules-schema.js'

export interface Step {
  measure: Measure
  offerIds: string[]
  /** Why this step comes after others; each reason is backed by a sourced edge. */
  after: { measure: Measure; reason: string }[]
}

export function buildSteps(
  results: readonly OfferResult[], offers: ReadonlyMap<string, Offer>, edges: readonly SequenceEdge[],
): Step[] {
  const byMeasure = new Map<Measure, string[]>()
  for (const r of results) {
    if (r.status === 'not_eligible') continue
    const measure = offers.get(offerKey({ id: r.offerId, version: r.version }))?.measure
    if (measure === undefined) continue
    const ids = byMeasure.get(measure) ?? []
    if (!ids.includes(r.offerId)) ids.push(r.offerId)
    byMeasure.set(measure, ids)
  }
  const present = MEASURE_ORDER.filter(m => byMeasure.has(m))
  const relevant = edges.filter(e => byMeasure.has(e.before) && byMeasure.has(e.after))
  const indegree = new Map<Measure, number>(present.map(m => [m, relevant.filter(e => e.after === m).length]))
  const done = new Set<Measure>()
  const steps: Step[] = []
  while (steps.length < present.length) {
    const next = present.find(m => !done.has(m) && indegree.get(m) === 0)
    if (next === undefined) throw new Error('cycle in sequence edges')
    done.add(next)
    for (const e of relevant) if (e.before === next) indegree.set(e.after, (indegree.get(e.after) ?? 0) - 1)
    steps.push({
      measure: next,
      offerIds: byMeasure.get(next) ?? [],
      after: relevant.filter(e => e.after === next).map(e => ({ measure: e.before, reason: e.reason })),
    })
  }
  return steps
}
```

- [ ] **Step 5: Implement `engine/src/navigate.ts`**

```ts
import { InputSchema } from './facts.js'
import { applyCaps, chooseBest, evaluateOffer, type CapNote, type OfferResult, type QuantitiesFor } from './offers.js'
import { buildSteps, type Step } from './plan.js'
import { inWindow, isStale, oldestVerified } from './provenance.js'
import { offerKey, type RuleSet } from './rules-schema.js'
import { derive, type Scope } from './scope.js'

export interface NavigateOptions {
  /** Today. Picks as_of rules and drives staleness. */
  asOf: string
  /** Planned installation date, if known. Picks installation-basis rule versions (schema §5). */
  installDate: string | null
}

export interface NavigateResult {
  options: NavigateOptions
  results: OfferResult[]
  /** Fact paths to ask the user about. */
  questions: string[]
  steps: Step[]
  caps: CapNote[]
  /** Active offer versions whose oldest source check is over 90 days old: show "may be out of date". */
  staleOffers: string[]
  /** Announced versions that start after the date used (e.g. 2027 heat pump rates). */
  upcoming: { offerId: string; version: string; from: string }[]
}

export function navigate(rawInput: unknown, rules: RuleSet, options: NavigateOptions, quantitiesFor: QuantitiesFor): NavigateResult {
  const input = InputSchema.parse(rawInput)
  const date = options.installDate ?? options.asOf
  const base: Scope = {
    input,
    unit: null,
    derived: derive(input, rules.dec.municipalities),
    incomeTables: Object.fromEntries(rules.incomeTables.map(t => [t.id, t.bySize])),
    predicates: Object.fromEntries(rules.predicates.map(p => [p.id, p.condition])),
  }
  const byKey = new Map(rules.offers.map(o => [offerKey(o), o]))
  const selected = rules.offers.filter(o => inWindow(o.installWindow, o.dateBasis === 'installation' ? date : options.asOf))
  const upcoming = rules.offers
    .filter(o => o.dateBasis === 'installation' && o.installWindow.from > date)
    .map(o => ({ offerId: o.id, version: o.version, from: o.installWindow.from }))
  const results = chooseBest(selected.flatMap(o => evaluateOffer(o, base, quantitiesFor)), byKey)
  const missing = results.filter(r => r.status === 'needs_info').flatMap(r => r.missing)
  if (options.installDate === null && upcoming.length > 0) missing.push('project.installDate')
  return {
    options,
    results,
    questions: [...new Set(missing)].sort(),
    steps: buildSteps(results, byKey, rules.sequence),
    caps: applyCaps(results, byKey, rules.caps, date),
    staleOffers: selected.filter(o => isStale(oldestVerified(o.sources), options.asOf)).map(offerKey),
    upcoming,
  }
}
```

- [ ] **Step 6: Run to verify pass**

Run: `cd engine && npx vitest run test/plan.test.ts test/navigate.test.ts && npm run typecheck`
Expected: PASS (3 + 2 tests); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add engine/src/plan.ts engine/src/navigate.ts engine/test/plan.test.ts engine/test/navigate.test.ts
git commit -m "feat(engine): sequencing and navigate with install-date versioning"
```

---
### Task 13: Massachusetts rules data and loader

Every value is copied from `docs/incentives-research.md` (read 2026-11-06). **Before writing each file, re-open the cited source URL and confirm the quote is still on the page.** If the page has changed, update the research doc first, then the data, and set `lastVerified` to the day you checked. The loader reads `offers/` only; retired versions go to `rules/ma/archive/` (schema §5).

Repeated condition fragments, written out in full in the JSON below:
- `MS_ANY` = Mass Save sponsors electric **or** gas: `{"any":[{"fact":"building.electricIsMunicipal","op":"eq","value":false},{"fact":"building.gasUtility","op":"in","value":["eversource","national_grid","unitil","liberty","berkshire_gas"]}]}`
- `ELEC` = `{"fact":"building.electricIsMunicipal","op":"eq","value":false}`

**Files:**
- Create: `engine/src/load-rules.ts`, all files under `rules/ma/` (plus an empty `rules/ma/archive/.gitkeep`)
- Modify: `engine/test/fixtures.ts` (add `RULES_DIR`)
- Test: `engine/test/rules-data.test.ts`

- [ ] **Step 1: Append to `engine/test/fixtures.ts`** (move the import to the top)

```ts
import { fileURLToPath } from 'node:url'

export const RULES_DIR = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
```

- [ ] **Step 2: Write the failing test — `engine/test/rules-data.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { loadRuleSet } from '../src/load-rules.js'
import { findDataProblems, isStale, oldestVerified } from '../src/provenance.js'
import { offerKey } from '../src/rules-schema.js'
import { RULES_DIR } from './fixtures.js'

const today = new Date().toISOString().slice(0, 10)

describe('rules/ma', () => {
  const rules = loadRuleSet(RULES_DIR)

  test('loads and validates', () => {
    expect(rules.offers.length).toBeGreaterThan(15)
  })

  // Uses the real date on purpose: when a version retires, CI fails until it moves to archive/ (principle 3).
  test('has no data problems today', () => {
    expect(findDataProblems(rules, today)).toEqual([])
  })

  test('reports stale offers (warning, not failure)', () => {
    const stale = rules.offers.filter(o => isStale(oldestVerified(o.sources), today)).map(offerKey)
    if (stale.length > 0) console.warn(`Re-verify (lastVerified > 90 days): ${stale.join(', ')}`)
    expect(Array.isArray(stale)).toBe(true)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd engine && npx vitest run test/rules-data.test.ts`
Expected: FAIL — `Cannot find module '../src/load-rules.js'`.

- [ ] **Step 4: Implement `engine/src/load-rules.ts`**

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RuleSetSchema, type RuleSet } from './rules-schema.js'

/** Reads the active rules in rules/<state>/ (not archive/) and validates them. Throws with the Zod path on error. */
export function loadRuleSet(dir: string): RuleSet {
  const read = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), 'utf8'))
  const offerFiles = readdirSync(join(dir, 'offers')).filter(f => f.endsWith('.json')).sort()
  return RuleSetSchema.parse({
    programs: read('programs.json'),
    offers: offerFiles.flatMap(f => read(join('offers', f)) as unknown[]),
    predicates: read('predicates.json'),
    incomeTables: read('income-tables.json'),
    dec: read('dec.json'),
    caps: read('caps.json'),
    sequence: read('sequence.json'),
  })
}
```

- [ ] **Step 5: Create `rules/ma/programs.json`**

```json
[
  { "id": "masssave_hea", "name": "Mass Save Home Energy Assessment", "administrator": "Sponsors of Mass Save",
    "handoff": { "label": "Book a no-cost Home Energy Assessment", "phone": "866-527-7283", "url": "https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments", "section": "Overview", "quote": "The Sponsors of Mass Save offer no-cost virtual or in-person Home Energy Assessments.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_weatherization", "name": "Mass Save insulation and air sealing", "administrator": "Sponsors of Mass Save",
    "handoff": { "label": "Call Mass Save", "phone": "866-527-7283", "url": "https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing", "section": "Overview", "quote": "Get 75-100 percent off approved insulation and air sealing improvements.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_income_eligible", "name": "Mass Save Income Eligible Program", "administrator": "Sponsors of Mass Save, through Community Action Program agencies",
    "handoff": { "label": "Call the Income Eligible line", "phone": "866-537-7267", "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs", "section": "Overview", "quote": "Through the Income Eligible Program, eligible homeowners and renters can receive a Home Energy Assessment, insulation and air-sealing upgrades, heating and cooling equipment upgrades, as well as new home appliances and more.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_enhanced", "name": "Mass Save Enhanced (moderate-income) offers", "administrator": "Sponsors of Mass Save",
    "handoff": { "label": "Check income and enroll", "phone": "888-714-3990", "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/save-with-enhanced-incentives" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/save-with-enhanced-incentives", "section": "Overview", "quote": "Get a fully managed, energy transformation for your home for up to no cost.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_dec", "name": "Mass Save offers for Designated Equity Communities", "administrator": "Sponsors of Mass Save",
    "handoff": { "label": "Call Mass Save", "phone": "866-527-7283", "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities", "section": "Eligibility", "quote": "Eligibility is based on where you live—not your income.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_heat_pumps", "name": "Mass Save air-source heat pump rebates", "administrator": "Sponsors of Mass Save (processing: Resource Innovations)",
    "handoff": { "label": "Rebate questions", "phone": "888-855-0340", "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Rebates", "quote": "There are three types of rebates: Whole-home, Partial-home and Basic.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_heat_loan", "name": "Mass Save HEAT Loan", "administrator": "Sponsors of Mass Save and participating lenders",
    "handoff": { "label": "Apply for 0% financing", "phone": "866-527-7283", "url": "https://www.masssave.com/en/residential/rebates-offers-services/financing" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/financing", "section": "Incentives", "quote": "you may be eligible to receive 0% financing up to $25,000 for qualifying energy-efficiency upgrades", "lastVerified": "2026-11-06" }] },
  { "id": "smart", "name": "SMART 3.0 solar incentive", "administrator": "Massachusetts Department of Energy Resources",
    "handoff": { "label": "SMART program page", "phone": "617-626-7369", "url": "https://www.mass.gov/info-details/smart-30-program-details" },
    "sources": [{ "url": "https://www.mass.gov/info-details/smart-30-program-details", "section": "Program Year 2026 Flat Incentive Rates", "quote": "Small (≤25 kW AC) Solar Tariff Generating Units (STGUs) and Low-Income STGUs, as defined in 225 CMR 28.00, receive a flat incentive rate per kilowatt-hour (kWh) of energy generated", "lastVerified": "2026-11-06" }] },
  { "id": "community_solar", "name": "Community shared solar", "administrator": "Project owners under SMART 3.0 rules",
    "handoff": { "label": "Community solar in Massachusetts", "phone": null, "url": "https://www.eversource.com/residential/save-money-energy/clean-energy-options/solar-energy/community-solar" },
    "sources": [{ "url": "https://www.eversource.com/residential/save-money-energy/clean-energy-options/solar-energy/community-solar", "section": "How Does Community Solar Work", "quote": "Community solar is available to all customers in Massachusetts", "lastVerified": "2026-11-06" }] },
  { "id": "eversource_ecsap", "name": "Eversource Community Solar Access Program", "administrator": "Eversource",
    "handoff": { "label": "Eversource community solar", "phone": null, "url": "https://www.eversource.com/residential/save-money-energy/clean-energy-options/solar-energy/community-solar" },
    "sources": [{ "url": "https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access", "section": "Eversource ECSAP", "quote": "The Eversource Community Solar Access Program (ECSAP) includes a simplified billing offering at no cost and an easy enrollment plan to encourage more low-income customer participation.", "lastVerified": "2026-11-06" }] },
  { "id": "utility_discount_rate", "name": "Utility low-income discount rate", "administrator": "Your electric and gas utility",
    "handoff": { "label": "Massachusetts Heat Line", "phone": "800-632-8175", "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs", "section": "Utility Discount Rates", "quote": "If you qualify for Fuel Assistance/HEAP or another income-verified program from the list below, you will be referred to your local natural gas or electric utility for a discount on your utility bills.", "lastVerified": "2026-11-06" }] },
  { "id": "ma_solar_tax_credit", "name": "Massachusetts residential renewable energy income tax credit", "administrator": "Massachusetts Department of Revenue",
    "handoff": { "label": "M.G.L. c. 62 § 6(d)", "phone": null, "url": "https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6" },
    "sources": [{ "url": "https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6", "section": "§ 6(d)", "quote": "shall be allowed a credit equal to fifteen per cent of the net expenditure for a renewable energy source property or one thousand dollars, whichever is lesser", "lastVerified": "2026-11-06" }] }
]
```

- [ ] **Step 6: Create `rules/ma/predicates.json`** (schema §8)

```json
[
  { "id": "condo_eligible_unit",
    "condition": { "fact": "unit.hasResidentialHeatingMeter", "op": "eq", "value": true },
    "note": "Working assumption until Mass Save answers (outreach-drafts.md §3a): a condo unit counts as 'eligible' for the all-units rule if it has a residential heating meter. The confirmation 'condo_eligible_definition' keeps the all-units result 'potential' meanwhile.",
    "sources": [{ "url": "https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties", "section": "Condo Owners footnote", "quote": "*Unit must have a residential heating meter", "lastVerified": "2026-11-06" }] }
]
```

- [ ] **Step 7: Create `rules/ma/income-tables.json`** (research §4, §5)

```json
[
  { "id": "masssave_income_eligible_2026_27", "label": "Mass Save Income Eligible, 2026–2027 heating season (max annual household income)",
    "bySize": [53585, 70073, 86561, 103049, 119536, 136024, 139116, 142207, 145299, 148390, 151482, 154573, 157665, 160756, 163848, 166939, 170031],
    "sources": [{ "url": "https://www.masssave.com/residential/programs-and-services/income-based-offers", "section": "Income Qualifications", "quote": "1 ≤ $53,585 $53,586 - $71,447", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_enhanced_2026_27", "label": "Mass Save Enhanced Incentive upper limit, 2026–2027 heating season (statewide table; limits vary by area)",
    "bySize": [71447, 93431, 115415, 137399, 159382, 181366, 185488, 189610, 193732, 197854, 201976, 206098, 210220, 214342, 218464, 222586, 226708],
    "sources": [{ "url": "https://www.masssave.com/residential/programs-and-services/income-based-offers", "section": "Income Qualifications", "quote": "Enter your zip code to find the household income limits specific to your area.", "lastVerified": "2026-11-06" }] }
]
```

- [ ] **Step 8: Create `rules/ma/dec.json`** (data-sources §5)

```json
{
  "municipalities": [
    { "name": "Boston", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Brockton", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Chelsea", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Everett", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Fall River", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Framingham", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Fitchburg", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Lawrence", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Lowell", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Lynn", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Malden", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "New Bedford", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Oak Bluffs", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Pittsfield", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Quincy", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Revere", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Salem", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Springfield", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Tisbury", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Woburn", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] },
    { "name": "Worcester", "narrowedFor": ["unitil", "berkshire_gas", "liberty"] }
  ],
  "sources": [
    { "url": "https://ma-eeac.org/wp-content/uploads/FINAL-MA-2025-2027-Plan-09-25-24-v2.pdf", "section": "p. 29–30, footnote 2; Figure 23 p. 117",
      "quote": "The process resulted in selection of 21 communities, including: Boston, Brockton, Chelsea, Everett, Fall River, Framingham, Fitchburg, Lawrence, Lowell, Lynn, Malden, New Bedford, Oak Bluffs, Pittsfield, Quincy, Revere, Salem, Springfield, Tisbury, Woburn, and Worcester. Unitil, Berkshire Gas, and Liberty may further limit eligibility within these communities in their service territories by focusing on certain environmental justice census blocks.",
      "lastVerified": "2026-11-06" }
  ]
}
```

- [ ] **Step 9: Create `rules/ma/caps.json`** (research §6, §7)

```json
[
  { "id": "masssave_hp_money_2026", "capGroup": "masssave_hp_account", "scope": "account", "limit": { "type": "money", "amount": 8500 },
    "window": { "from": "2026-01-01", "until": "2026-12-31" },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Eligibility — Basic Rebate", "quote": "The total rebate amount received is capped at $8,500 per account.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_hp_money_2027", "capGroup": "masssave_hp_account", "scope": "account", "limit": { "type": "money", "amount": 7500 },
    "window": { "from": "2027-01-01", "until": null },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Rebates", "quote": "For all Whole-Home projects installed on or after January 1, 2027, the rebate will decrease to $2,350 per ton, capped at $7,500.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_whole_home_one_per_account", "capGroup": "masssave_whole_home", "scope": "account", "limit": { "type": "count", "count": 1 },
    "window": { "from": "2025-01-01", "until": null },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Additional eligibility requirements for the Whole-home Rebate", "quote": "Limit one whole-home rebate per account.", "lastVerified": "2026-11-06" }] },
  { "id": "masssave_heat_loan_lifetime", "capGroup": "masssave_heat_loan", "scope": "customer_lifetime", "limit": { "type": "money", "amount": 25000 },
    "window": { "from": "2025-01-01", "until": null },
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/financing", "section": "Incentives", "quote": "Note: The maximum loan amount is over the lifetime of a customer’s energy efficiency upgrades.", "lastVerified": "2026-11-06" }] }
]
```

- [ ] **Step 10: Create `rules/ma/sequence.json`**

```json
[
  { "before": "assessment", "after": "weatherization", "reason": "Insulation and air-sealing offers are qualified during the Home Energy Assessment.",
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments", "section": "Incentives", "quote": "An Energy Specialist will identify energy-saving opportunities throughout your home and make recommendations.", "lastVerified": "2026-11-06" }] },
  { "before": "assessment", "after": "heat_pump", "reason": "A Home Energy Assessment is mandatory before a whole-home heat pump.",
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/financing", "section": "How to Participate", "quote": "A HEA is mandatory if you plan to pursue any of the following", "lastVerified": "2026-11-06" }] },
  { "before": "weatherization", "after": "heat_pump", "reason": "Whole-home heat pump rebates require the home to be sufficiently weatherized first.",
    "sources": [{ "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Additional eligibility requirements for the Whole-home Rebate", "quote": "Homes must be sufficiently weatherized prior to heat pump installation", "lastVerified": "2026-11-06" }] },
  { "before": "rooftop_solar", "after": "tax_credit", "reason": "The state credit is claimed for the expenditure on the installed system.",
    "sources": [{ "url": "https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6", "section": "§ 6(d)", "quote": "a credit equal to fifteen per cent of the net expenditure for a renewable energy source property", "lastVerified": "2026-11-06" }] }
]
```

- [ ] **Step 11: Create `rules/ma/offers/assessment.json`** (research §1)

```json
[
  { "id": "masssave_hea", "version": "1", "programId": "masssave_hea", "title": "No-cost Home Energy Assessment",
    "measure": "assessment", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "none" }, "qualification": "exact", "enrollment": "apply", "exclusiveGroup": null, "capGroups": [],
    "sources": [
      { "url": "https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing", "section": "Eligibility", "quote": "Customers must live in a 1- to 4-unit home", "lastVerified": "2026-11-06" },
      { "url": "https://www.masssave.com/en/residential/rebates-offers-services/insulation-and-windows/insulation-and-air-sealing", "section": "How to Participate", "quote": "Your municipal utility is not part of the Mass Save program.", "lastVerified": "2026-11-06" } ] }
]
```

- [ ] **Step 12: Create `rules/ma/offers/weatherization.json`** (research §2–§5)

```json
[
  { "id": "masssave_insulation_rental_unit", "version": "1", "programId": "masssave_weatherization", "title": "100% off insulation for a rental unit",
    "measure": "weatherization", "appliesTo": "each_unit", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "unit.occupancy", "op": "eq", "value": "renter" },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] } ] },
    "prerequisites": [
      { "id": "owner_approval", "kind": "action", "description": "The property owner approves the work.",
        "satisfiedWhen": { "fact": "building.ownerApproval", "op": "eq", "value": true },
        "sources": [ { "url": "https://www.masssave.com/en/residential/for-renters", "section": "Resources for renters", "quote": "While larger measures like weatherization and heating and cooling system upgrades require property owner approval, there are actions you can take on your own.", "lastVerified": "2026-11-06" } ] } ],
    "confirmations": [],
    "benefit": { "type": "percent_of_cost", "pct": 100, "costOf": "weatherization" }, "qualification": "up_to",
    "enrollment": "via_landlord", "exclusiveGroup": "insulation", "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties", "section": "Landlord offer", "quote": "An instant incentive of 100% off insulation upgrades for your rental property", "lastVerified": "2026-11-06" } ] },

  { "id": "masssave_insulation_owner_standard", "version": "1", "programId": "masssave_weatherization", "title": "At least 75% off insulation for an owner-occupied home",
    "measure": "weatherization", "appliesTo": "each_unit", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "unit.occupancy", "op": "eq", "value": "owner" }, { "fact": "building.ownership", "op": "eq", "value": "single_owner" },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "percent_of_cost", "pct": 75, "costOf": "weatherization" }, "qualification": "minimum",
    "enrollment": "via_assessment", "exclusiveGroup": "insulation", "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/home-energy-assessments", "section": "Incentives", "quote": "75-100% off approved insulation improvements", "lastVerified": "2026-11-06" } ] },

  { "id": "masssave_insulation_condo_all_units", "version": "1", "programId": "masssave_weatherization", "title": "Up to 100% off insulation when every eligible condo unit takes part",
    "measure": "weatherization", "appliesTo": "each_unit", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [
      { "fact": "building.ownership", "op": "eq", "value": "condo" }, { "fact": "building.unitCount", "op": "gte", "value": 2 },
      { "fact": "unit.hasResidentialHeatingMeter", "op": "eq", "value": true },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] },
      { "allUnits": { "eligible": { "ref": "condo_eligible_unit" }, "require": { "fact": "unit.participating", "op": "eq", "value": true } } } ] },
    "prerequisites": [],
    "confirmations": [
      { "id": "condo_eligible_definition", "question": "Which units count as 'eligible' for the all-units rule? We assume: units with a residential heating meter.",
        "decidedBy": "Mass Save", "nextAction": "Ask the Energy Specialist, or call Mass Save at 866-527-7283.", "when": null,
        "sources": [ { "url": "https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties", "section": "Condo Owners", "quote": "if all eligible units in a 2–4-unit building participate", "lastVerified": "2026-11-06" } ] } ],
    "benefit": { "type": "percent_of_cost", "pct": 100, "costOf": "weatherization" }, "qualification": "up_to",
    "enrollment": "via_assessment", "exclusiveGroup": "insulation", "capGroups": [],
    "sources": [
      { "url": "https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties", "section": "Condo Owners", "quote": "Up to 100% off recommended insulation improvements for each unit, if all eligible units in a 2–4-unit building participate (or up to 75% off per unit if only some participate) *", "lastVerified": "2026-11-06" },
      { "url": "https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties", "section": "Condo Owners footnote", "quote": "*Unit must have a residential heating meter", "lastVerified": "2026-11-06" } ] },

  { "id": "masssave_insulation_condo_some_units", "version": "1", "programId": "masssave_weatherization", "title": "Up to 75% off insulation for a condo unit",
    "measure": "weatherization", "appliesTo": "each_unit", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [
      { "fact": "building.ownership", "op": "eq", "value": "condo" }, { "fact": "building.unitCount", "op": "gte", "value": 2 },
      { "fact": "unit.hasResidentialHeatingMeter", "op": "eq", "value": true },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "percent_of_cost", "pct": 75, "costOf": "weatherization" }, "qualification": "up_to",
    "enrollment": "via_assessment", "exclusiveGroup": "insulation", "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/saving/energy-assessments/landlords-with-1-4-unit-properties", "section": "Condo Owners", "quote": "(or up to 75% off per unit if only some participate)", "lastVerified": "2026-11-06" } ] },

  { "id": "masssave_dec_weatherization", "version": "2025_2027", "programId": "masssave_dec", "title": "100% off insulation and air sealing in a Designated Equity Community",
    "measure": "weatherization", "appliesTo": "each_unit", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": "2027-12-31" }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "building.isDec", "op": "eq", "value": true },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] } ] },
    "prerequisites": [
      { "id": "owner_approval", "kind": "action", "description": "For rented units, the landlord approves the work.",
        "satisfiedWhen": { "any": [ { "fact": "unit.occupancy", "op": "eq", "value": "owner" }, { "fact": "building.ownerApproval", "op": "eq", "value": true } ] },
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities", "section": "Offers for rental properties and landlords in Designated Equity Communities", "quote": "Landlords must provide approval for upgrades.", "lastVerified": "2026-11-06" } ] } ],
    "confirmations": [],
    "benefit": { "type": "percent_of_cost", "pct": 100, "costOf": "weatherization" }, "qualification": "up_to",
    "enrollment": "via_assessment", "exclusiveGroup": "insulation", "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities", "section": "Lower energy bills—at no cost", "quote": "If your home is in a Designated Equity Community (DEC), you qualify for 100% off weatherization upgrades, including insulation and air sealing, when recommended by an Energy Specialist during a Home Energy Assessment.", "lastVerified": "2026-11-06" } ] },

  { "id": "masssave_income_eligible_weatherization", "version": "2026_27", "programId": "masssave_income_eligible", "title": "No-cost weatherization through the Income Eligible Program",
    "measure": "weatherization", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2026-07-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "incomeAtMost": "masssave_income_eligible_2026_27" },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "percent_of_cost", "pct": 100, "costOf": "weatherization" }, "qualification": "up_to",
    "enrollment": "apply", "exclusiveGroup": "insulation", "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs", "section": "Incentives", "quote": "Installation of additional attic, wall, and basement insulation", "lastVerified": "2026-11-06" } ] },

  { "id": "masssave_enhanced_weatherization", "version": "2026_27", "programId": "masssave_enhanced", "title": "No-cost weatherization with Enhanced (moderate-income) offers",
    "measure": "weatherization", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2026-07-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "incomeAbove": "masssave_income_eligible_2026_27" }, { "incomeAtMost": "masssave_enhanced_2026_27" },
      { "fact": "unit.occupancy", "op": "eq", "value": "owner" },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] } ] },
    "prerequisites": [],
    "confirmations": [
      { "id": "enhanced_local_limit", "question": "Income limits vary by area. Does this household's income qualify where it lives?",
        "decidedBy": "Mass Save income verification", "nextAction": "Use Mass Save's online income qualification tool or call 888-714-3990.", "when": null,
        "sources": [ { "url": "https://www.masssave.com/residential/programs-and-services/income-based-offers", "section": "Income Qualifications", "quote": "Enter your zip code to find the household income limits specific to your area.", "lastVerified": "2026-11-06" } ] } ],
    "benefit": { "type": "percent_of_cost", "pct": 100, "costOf": "weatherization" }, "qualification": "up_to",
    "enrollment": "apply", "exclusiveGroup": "insulation", "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/save-with-enhanced-incentives", "section": "Incentives", "quote": "No-cost weatherization upgrades", "lastVerified": "2026-11-06" } ] }
]
```

- [ ] **Step 13: Create `rules/ma/offers/heat-pumps.json`** (research §3, §6). The four rebate entries share their prerequisites and confirmation; each entry spells them out because JSON has no references.

```json
[
  { "id": "ashp_whole_home", "version": "2026", "programId": "masssave_heat_pumps", "title": "Whole-home heat pump rebate (installed in 2026)",
    "measure": "heat_pump", "appliesTo": "each_unit", "dateBasis": "installation", "installWindow": { "from": "2026-01-01", "until": "2026-12-31" }, "applicationDeadline": "2027-02-28",
    "eligibility": { "all": [
      { "fact": "unit.occupiedAllWinter", "op": "eq", "value": true },
      { "any": [
        { "all": [ { "fact": "unit.heatingFuel", "op": "in", "value": ["oil", "propane", "electric_resistance"] }, { "fact": "building.electricIsMunicipal", "op": "eq", "value": false } ] },
        { "all": [ { "fact": "unit.heatingFuel", "op": "eq", "value": "natural_gas" }, { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] } ] } ] } ] },
    "prerequisites": [
      { "id": "hea_completed", "kind": "action", "description": "Complete a no-cost Home Energy Assessment first.",
        "satisfiedWhen": { "fact": "building.heaCompleted", "op": "eq", "value": true },
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/financing", "section": "How to Participate", "quote": "A HEA is mandatory if you plan to pursue any of the following", "lastVerified": "2026-11-06" } ] },
      { "id": "weatherized", "kind": "action", "description": "Make sure the home is sufficiently weatherized: built 2000 or later, or the assessment recommends under $1,000 of weatherization, or the recommended weatherization is done.",
        "satisfiedWhen": { "any": [ { "fact": "building.yearBuilt", "op": "gte", "value": 2000 }, { "fact": "building.weatherizationRecsDone", "op": "eq", "value": true } ] },
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Additional eligibility requirements for the Whole-home Rebate", "quote": "Sufficient weatherization can be demonstrated by satisfying at least one of the following requirements: (A) home was built during or after 2000, (B) Home Energy Assessment report indicates less than $1,000 worth of weatherization recommended, or (C) weatherization recommendations made during or after 2013 have been completed.", "lastVerified": "2026-11-06" } ] },
      { "id": "owner_approval", "kind": "action", "description": "For rented units, the landlord approves the work.",
        "satisfiedWhen": { "any": [ { "fact": "unit.occupancy", "op": "eq", "value": "owner" }, { "fact": "building.ownerApproval", "op": "eq", "value": true } ] },
        "sources": [ { "url": "https://www.masssave.com/en/residential/for-renters", "section": "Resources for renters", "quote": "While larger measures like weatherization and heating and cooling system upgrades require property owner approval, there are actions you can take on your own.", "lastVerified": "2026-11-06" } ] },
      { "id": "sole_source", "kind": "requirement", "description": "The heat pump must be the home's only heating and cooling source.", "satisfiedWhen": null,
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Rebates", "quote": "Whole-home rebates are available to customers who install heat pumps as the sole source for heating and cooling.", "lastVerified": "2026-11-06" } ] },
      { "id": "network_installer", "kind": "requirement", "description": "Use a contractor in the Mass Save Heat Pump Installer Network.", "satisfiedWhen": null,
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "How to Participate", "quote": "To qualify, the heat pump system must be installed by a contractor participating in the Mass Save Heat Pump Installer Network.", "lastVerified": "2026-11-06" } ] },
      { "id": "cold_climate_equipment", "kind": "requirement", "description": "Choose ENERGY STAR Cold Climate equipment from the Mass Save qualified list.", "satisfiedWhen": null,
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Eligibility", "quote": "Equipment must meet ENERGY STAR® Cold Climate.", "lastVerified": "2026-11-06" } ] } ],
    "confirmations": [
      { "id": "tenant_account_holder", "question": "In a rental unit where the tenant holds the account and the landlord buys the heat pump, who applies, and on which account?",
        "decidedBy": "Mass Save rebate processing (Resource Innovations)", "nextAction": "Ask at the assessment, or email MARebates@Resource-Innovations.com.",
        "when": { "fact": "unit.occupancy", "op": "eq", "value": "renter" },
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Eligibility", "quote": "Customers must apply using a residential electric account.", "lastVerified": "2026-11-06" } ] } ],
    "benefit": { "type": "per_ton", "rate": 2650, "cap": 8500 }, "qualification": "up_to",
    "enrollment": "apply", "exclusiveGroup": "heat_pump", "capGroups": ["masssave_hp_account", "masssave_whole_home"],
    "sources": [
      { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "2026 Air Source Heat Pump Rebates", "quote": "Whole-Home $2,650 per ton * up to $8,500", "lastVerified": "2026-11-06" },
      { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Eligibility", "quote": "Rebate form and supporting documentation must be received by February 28, 2027.", "lastVerified": "2026-11-06" },
      { "url": "https://www.masssave.com/en/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps", "section": "Additional eligibility requirements for the Whole-home Rebate", "quote": "Only available to residences that are occupied full time during the winter heating season.", "lastVerified": "2026-11-06" } ] }
]
```

Then add three more entries to the same array, each a copy of the one above with these differences (write them out in full in the file):

| id / version | title | installWindow | applicationDeadline | benefit | prerequisites | capGroups | first source quote |
|---|---|---|---|---|---|---|---|
| `ashp_whole_home` / `2027` | Whole-home heat pump rebate (installed from 2027) | 2027-01-01 → null | null | `per_ton` 2350, cap 7500 | same | same | "For all Whole-Home projects installed on or after January 1, 2027, the rebate will decrease to $2,350 per ton, capped at $7,500." (section "Rebates"); drop the 2027-02-28 deadline source |
| `ashp_partial_home` / `2026` | Partial-home heat pump rebate (installed in 2026) | 2026-01-01 → 2026-12-31 | 2027-02-28 | `per_ton` 1125, cap 8500 | `hea_completed`, `owner_approval`, `network_installer`, `cold_climate_equipment`, plus `integrated_control` (requirement, `satisfiedWhen: null`, "Install an integrated control for zones where oil, propane or gas stays in use.", quote: "An integrated control from the Mass Save Integrated Control Qualified Product List must be installed for heating zones where propane, oil, or natural gas will remain in use.") — no `weatherized`, no `sole_source` | `["masssave_hp_account"]` | "Partial-Home $1,125 per ton up to $8,500" |
| `ashp_partial_home` / `2027` | Partial-home heat pump rebate (installed from 2027) | 2027-01-01 → null | null | `per_ton` 1000, cap 7500 | as partial 2026 | `["masssave_hp_account"]` | "For all The Partial-Home projects installed on or after January 1, 2027, the rebate will decrease to $1,000 per ton, capped at $7,500." |

Note: the partial-home `hea_completed` prerequisite applies only when bonuses are claimed (the financing page lists "Partial Home Heat Pump (when pursuing bonus incentives)"). Write its description that way: "Complete a Home Energy Assessment first if you want the $500 weatherization bonus."

Finally, add the DEC entry:

```json
  { "id": "dec_rental_heat_pump_no_cost", "version": "2025_2027", "programId": "masssave_dec", "title": "Up to no-cost heat pump for a rental unit in a Designated Equity Community",
    "measure": "heat_pump", "appliesTo": "each_unit", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": "2027-12-31" }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "building.isDec", "op": "eq", "value": true }, { "fact": "unit.occupancy", "op": "eq", "value": "renter" },
      { "fact": "unit.heatingFuel", "op": "in", "value": ["oil", "propane", "electric_resistance"] }, { "fact": "building.electricIsMunicipal", "op": "eq", "value": false } ] },
    "prerequisites": [
      { "id": "owner_approval", "kind": "action", "description": "The landlord approves the upgrade.",
        "satisfiedWhen": { "fact": "building.ownerApproval", "op": "eq", "value": true },
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities", "section": "Offers for rental properties and landlords in Designated Equity Communities", "quote": "Landlords must provide approval for upgrades.", "lastVerified": "2026-11-06" } ] } ],
    "confirmations": [
      { "id": "renter_energy_burden", "question": "Would a heat pump be expected to increase this renter's energy burden?",
        "decidedBy": "the Mass Save turnkey vendor", "nextAction": "Ask during the Home Energy Assessment.", "when": null,
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities", "section": "Offers for rental properties and landlords in Designated Equity Communities", "quote": "*Applies to households using delivered fuels or electric resistance heating only, and for projects where heat pumps are not expected to increase renters’ energy burden.", "lastVerified": "2026-11-06" } ] } ],
    "benefit": { "type": "percent_of_cost", "pct": 100, "costOf": "heat_pump" }, "qualification": "up_to",
    "enrollment": "via_landlord", "exclusiveGroup": "heat_pump", "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/designated-equity-communities", "section": "Offers for rental properties and landlords in Designated Equity Communities", "quote": "Up to no-cost air source heat pumps*", "lastVerified": "2026-11-06" } ] }
```

- [ ] **Step 14: Create `rules/ma/offers/financing.json`** (research §7)

```json
[
  { "id": "masssave_heat_loan", "version": "1", "programId": "masssave_heat_loan", "title": "0% HEAT Loan up to $25,000",
    "measure": "financing", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "user.role", "op": "in", "value": ["renting_landlord", "owner_occupant_landlord", "condo_owner"] },
      { "any": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false },
        { "all": [ { "fact": "building.gasUtility", "op": "in", "value": ["eversource", "national_grid", "unitil", "liberty", "berkshire_gas"] }, { "fact": "unit.heatingFuel", "op": "eq", "value": "natural_gas" } ] } ] } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "loan", "maxPrincipal": 25000, "apr": 0 }, "qualification": "up_to",
    "enrollment": "apply", "exclusiveGroup": null, "capGroups": ["masssave_heat_loan"],
    "sources": [
      { "url": "https://www.masssave.com/en/residential/rebates-offers-services/financing", "section": "Eligibility", "quote": "Loan applicant must be the homeowner", "lastVerified": "2026-11-06" },
      { "url": "https://www.masssave.com/en/residential/rebates-offers-services/financing", "section": "Eligibility", "quote": "Municipal electric customers can take advantage of the HEAT Loan offer if their home is heated with natural gas, provided by a Mass Save Sponsor", "lastVerified": "2026-11-06" } ] }
]
```

- [ ] **Step 15: Create `rules/ma/offers/solar.json`** (research §9–§13)

```json
[
  { "id": "smart_small", "version": "py2026", "programId": "smart", "title": "SMART 3.0 incentive for rooftop solar ≤25 kW (Program Year 2026)",
    "measure": "rooftop_solar", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2026-01-01", "until": "2026-12-31" }, "applicationDeadline": "2026-12-31",
    "eligibility": { "all": [ { "fact": "user.role", "op": "in", "value": ["renting_landlord", "owner_occupant_landlord", "condo_owner"] }, { "fact": "building.electricIsMunicipal", "op": "eq", "value": false } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "per_kwh", "rate": 0.03, "years": 20 }, "qualification": "exact", "enrollment": "apply", "exclusiveGroup": "smart", "capGroups": [],
    "sources": [
      { "url": "https://www.mass.gov/info-details/smart-30-program-details", "section": "Program Year 2026 Flat Incentive Rates (≤25 kW)", "quote": "STGUs ≤25 kW AC $0.03/kWh", "lastVerified": "2026-11-06" },
      { "url": "https://www.mass.gov/info-details/smart-30-program-details", "section": "Program Year Annual Capacity and Rates", "quote": "In a given Program Year, DOER will accept applications from January 1 through December 31 of that year.", "lastVerified": "2026-11-06" },
      { "url": "https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download", "section": "225 CMR 28.13(1)", "quote": "All STGUs will be eligible to receive compensation under 225 CMR 28.00 for 20 years from the STGU’s Incentive Payment Effective Date.", "lastVerified": "2026-11-06" } ] },

  { "id": "smart_low_income", "version": "py2026", "programId": "smart", "title": "SMART 3.0 low-income rate for rooftop solar ≤25 kW (Program Year 2026)",
    "measure": "rooftop_solar", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2026-01-01", "until": "2026-12-31" }, "applicationDeadline": "2026-12-31",
    "eligibility": { "all": [ { "fact": "user.role", "op": "in", "value": ["renting_landlord", "owner_occupant_landlord", "condo_owner"] }, { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "household.onDiscountRate", "op": "eq", "value": true } ] },
    "prerequisites": [],
    "confirmations": [
      { "id": "smart_low_income_customer", "question": "Low Income Customer also covers Low Income Eligible Areas, other needs-based programs and self-attestation. Does this household qualify?",
        "decidedBy": "the solar installer and DOER", "nextAction": "Ask the installer to check with the DOER Low Income Customer Self-Attestation Form.", "when": null,
        "sources": [ { "url": "https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download", "section": "225 CMR 28.02 Low Income Customer", "quote": "An End -use Customer that: (a) is on a low income discount rate of a Distribution Company", "lastVerified": "2026-11-06" } ] } ],
    "benefit": { "type": "per_kwh", "rate": 0.06, "years": 20 }, "qualification": "exact", "enrollment": "apply", "exclusiveGroup": "smart", "capGroups": [],
    "sources": [ { "url": "https://www.mass.gov/info-details/smart-30-program-details", "section": "Program Year 2026 Flat Incentive Rates (≤25 kW)", "quote": "Low Income STGUs $0.06/kWh", "lastVerified": "2026-11-06" } ] },

  { "id": "community_solar_low_income_floor", "version": "smart3", "programId": "community_solar", "title": "Community solar: at least 40% off the credits you receive (low-income customers)",
    "measure": "community_solar", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2025-09-12", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "building.electricIsMunicipal", "op": "eq", "value": false }, { "fact": "household.onDiscountRate", "op": "eq", "value": true } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "min_discount_on_credits", "pct": 40 }, "qualification": "minimum", "enrollment": "apply", "exclusiveGroup": "community_solar", "capGroups": [],
    "sources": [ { "url": "https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download", "section": "225 CMR 28.07(5)(c)1.b", "quote": "Low Income Customers shall receive not less than a 40 percent discount on the value of allocated Bill Credits from the Community Shared STGU to the Low Income Customer.", "lastVerified": "2026-11-06" } ] },

  { "id": "community_solar_standard_floor", "version": "smart3", "programId": "community_solar", "title": "Community solar: at least 20% off the credits you receive",
    "measure": "community_solar", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2025-09-12", "until": null }, "applicationDeadline": null,
    "eligibility": { "fact": "building.electricIsMunicipal", "op": "eq", "value": false },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "min_discount_on_credits", "pct": 20 }, "qualification": "minimum", "enrollment": "apply", "exclusiveGroup": "community_solar", "capGroups": [],
    "sources": [ { "url": "https://www.mass.gov/doc/225-cmr-2800-clean-09222026/download", "section": "225 CMR 28.07(5)(c)1.b", "quote": "All other customers shall receive not less than a 20 percent discount on the value of allocated Bill Credits from the Community Shared STGU to the End- use Customer.", "lastVerified": "2026-11-06" } ] },

  { "id": "eversource_ecsap", "version": "1", "programId": "eversource_ecsap", "title": "You may be selected for Eversource's no-cost low-income community solar",
    "measure": "community_solar", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2024-06-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "building.electricUtility", "op": "eq", "value": "eversource" }, { "fact": "household.onDiscountRate", "op": "eq", "value": true } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "none" }, "qualification": "exact", "enrollment": "auto_selected", "exclusiveGroup": null, "capGroups": [],
    "sources": [ { "url": "https://www.mass.gov/news/dpu-issues-order-on-low-income-solar-access", "section": "Eversource ECSAP", "quote": "In its filings, Eversource detailed that the ECSAP includes a target of $420 in annual bill savings for each low-income customer enrolled", "lastVerified": "2026-11-06" } ] },

  { "id": "ma_solar_tax_credit", "version": "1", "programId": "ma_solar_tax_credit", "title": "Massachusetts tax credit: 15% of solar cost, up to $1,000",
    "measure": "tax_credit", "appliesTo": "user", "dateBasis": "installation", "installWindow": { "from": "2026-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "all": [ { "fact": "user.role", "op": "in", "value": ["owner_occupant_landlord", "condo_owner"] }, { "fact": "unit.occupancy", "op": "eq", "value": "owner" } ] },
    "prerequisites": [], "confirmations": [],
    "benefit": { "type": "percent_of_cost_capped", "pct": 15, "cap": 1000, "costOf": "rooftop_solar" }, "qualification": "up_to", "enrollment": "apply", "exclusiveGroup": null, "capGroups": [],
    "sources": [ { "url": "https://www.mass.gov/info-details/mass-general-laws-c-62-ss-6", "section": "§ 6(d)", "quote": "any owner or tenant of residential property located in the commonwealth who is not a dependent of another taxpayer and who occupies said property as his principal residence, shall be allowed a credit equal to fifteen per cent of the net expenditure for a renewable energy source property or one thousand dollars, whichever is lesser", "lastVerified": "2026-11-06" } ] }
]
```

Notes on dates:
- The ECSAP `installWindow.from` is the month of the June 2024 DPU order; read D.P.U. 24-104 if the exact date matters.
- SMART PY2026 retires on 2027-01-01. Add PY2027 versions once DOER finalizes the PY2027 rates (expected around December 2026), or CI fails.

- [ ] **Step 16: Create `rules/ma/offers/bill-assistance.json`** (research §4, §10)

```json
[
  { "id": "utility_discount_rate_referral", "version": "1", "programId": "utility_discount_rate", "title": "Ask your utility about the low-income discount rate",
    "measure": "bill_assistance", "appliesTo": "user", "dateBasis": "as_of", "installWindow": { "from": "2025-01-01", "until": null }, "applicationDeadline": null,
    "eligibility": { "fact": "household.onDiscountRate", "op": "eq", "value": false },
    "prerequisites": [],
    "confirmations": [
      { "id": "discount_rate_basis", "question": "Eligibility comes from enrollment in Fuel Assistance (HEAP), SNAP, MassHealth or a similar program. Is the household enrolled in one?",
        "decidedBy": "your utility", "nextAction": "Call the Massachusetts Heat Line at 1-800-632-8175 or your utility.", "when": null,
        "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs", "section": "Utility Discount Rates", "quote": "If you qualify for Fuel Assistance/HEAP or another income-verified program from the list below, you will be referred to your local natural gas or electric utility for a discount on your utility bills.", "lastVerified": "2026-11-06" } ] } ],
    "benefit": { "type": "none" }, "qualification": "exact", "enrollment": "referral", "exclusiveGroup": null, "capGroups": [],
    "sources": [ { "url": "https://www.masssave.com/en/residential/rebates-offers-services/income-based-offers/income-eligible-programs", "section": "Utility Discount Rates", "quote": "Discounted rates that lower actual charges for your energy usage may be available.", "lastVerified": "2026-11-06" } ] }
]
```

- [ ] **Step 17: Run to verify pass**

Run: `cd engine && npx vitest run test/rules-data.test.ts`
Expected: PASS (3 tests). If Zod fails, its error path (e.g. `offers[7].eligibility`) points to the bad entry. If `findDataProblems` returns entries, fix the data.

- [ ] **Step 18: Commit**

```bash
git add engine/src/load-rules.ts engine/test/fixtures.ts engine/test/rules-data.test.ts rules/ma
git commit -m "feat(rules): encode Massachusetts v1 rules with sources"
```

---

### Task 14: Scenario tests (the demo stories) and the coordination property

Expected results follow from the rules in Task 13. Quantities here are **test fixtures**, not real costs.

**Files:**
- Test: `engine/test/scenarios.test.ts`, `engine/test/scenarios.pbt.test.ts`

- [ ] **Step 1: Write the scenario tests — `engine/test/scenarios.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import type { Quantities } from '../src/benefit.js'
import type { Input } from '../src/facts.js'
import { loadRuleSet } from '../src/load-rules.js'
import { navigate, type NavigateResult } from '../src/navigate.js'
import { range } from '../src/range.js'
import { input, RULES_DIR, unit } from './fixtures.js'

const rules = loadRuleSet(RULES_DIR)
const Q: Quantities = {
  cost: { weatherization: range(6000, 9000, 12000), heat_pump: range(18000, 22000, 26000), rooftop_solar: range(15000, 20000, 25000) },
  heatPumpTons: range(2, 3, 4),
  solarKwhPerYear: range(4000, 5000, 6000),
  communitySolarCreditsPerYear: range(600, 800, 1000),
}
const run = (i: Input, asOf = '2026-11-15', installDate: string | null = null): NavigateResult =>
  navigate(i, rules, { asOf, installDate }, () => Q)
const find = (r: NavigateResult, offerId: string, unitId: string | null) =>
  r.results.find(x => x.offerId === offerId && x.unitId === unitId)
const shown = (r: NavigateResult, group: string, unitId: string, statuses = ['eligible', 'potential']) =>
  r.results.filter(x => statuses.includes(x.status) && x.unitId === unitId &&
    rules.offers.find(o => o.id === x.offerId && o.version === x.version)?.exclusiveGroup === group)

// Story 1: Maria, 2nd floor of a Boston (DEC) triple-decker, oil heat, all units rented.
const maria = (): Input => input({
  role: 'tenant',
  userUnitId: '2',
  building: {
    municipality: 'Boston', ownership: 'single_owner', yearBuilt: 1910,
    electricUtility: 'eversource', gasUtility: 'national_grid', inEjBlockGroup: null,
    weatherizationRecsDone: false, heaCompleted: false, ownerApproval: null,
    units: ['1', '2', '3'].map(id => unit(id, { occupancy: 'renter', heatingFuel: 'oil', heatPaidBy: 'tenant', electricPaidBy: 'tenant', occupiedAllWinter: true })),
  },
  household: { size: 3, incomeBand: { low: 40_000, high: 50_000 }, onDiscountRate: null },
})

describe('Story 1: Boston rental (tenant)', () => {
  const r = run(maria())
  test('one insulation offer is shown for her unit, covering 100% ("likely close to nothing")', () => {
    const ins = shown(r, 'insulation', '2', ['eligible'])
    expect(ins).toHaveLength(1)
    expect(ins[0]?.nearZeroOutOfPocket).toBe(true)
    expect(ins[0]?.prerequisites.find(p => p.id === 'owner_approval')?.state).toBe('unknown')
  })
  test('the DEC no-cost heat pump is potential, pending the energy-burden check', () => {
    const dec = find(r, 'dec_rental_heat_pump_no_cost', '2')
    expect(dec?.status).toBe('potential')
    expect(dec?.confirmations.map(c => c.id)).toEqual(['renter_energy_burden'])
  })
  test('weatherization not done yet is a next step, not a "no" (Qiao, 2026-11-06)', () => {
    const whole = find(r, 'ashp_whole_home', '2')
    expect(whole?.version).toBe('2026')
    expect(whole?.status).toBe('potential')
    expect(whole?.prerequisites.find(p => p.id === 'weatherized')?.state).toBe('todo')
    expect(whole?.prerequisites.find(p => p.id === 'network_installer')?.state).toBe('check')
    expect(whole?.confirmations.map(c => c.id)).toEqual(['tenant_account_holder'])
  })
  test('a tenant gets no HEAT Loan, SMART or state solar credit', () => {
    for (const id of ['masssave_heat_loan', 'smart_small', 'ma_solar_tax_credit']) expect(find(r, id, '2')?.status).toBe('not_eligible')
  })
  test('asks about the discount rate and the install date', () => {
    expect(r.questions).toEqual(expect.arrayContaining(['household.onDiscountRate', 'project.installDate']))
    expect(r.upcoming.map(u => `${u.offerId}@${u.version}`)).toEqual(expect.arrayContaining(['ashp_whole_home@2027', 'ashp_partial_home@2027']))
  })
  test('assessment → weatherization → heat pump', () => {
    const order = r.steps.map(s => s.measure)
    expect(order.indexOf('assessment')).toBeLessThan(order.indexOf('weatherization'))
    expect(order.indexOf('weatherization')).toBeLessThan(order.indexOf('heat_pump'))
  })
  test('a planned 2027 install uses the 2027 rates', () => {
    const r27 = run(maria(), '2026-11-15', '2027-02-01')
    expect(find(r27, 'ashp_whole_home', '2')?.version).toBe('2027')
  })
})

// Story 2: a Somerville condo triple-decker; units 1 and 2 agreed; unit 3 varies.
const condo = (third: boolean | null): Input => input({
  role: 'condo_owner',
  userUnitId: '1',
  building: {
    municipality: 'Somerville', ownership: 'condo', yearBuilt: 1915,
    electricUtility: 'eversource', gasUtility: 'national_grid', inEjBlockGroup: null,
    weatherizationRecsDone: false, heaCompleted: false, ownerApproval: true,
    units: [
      unit('1', { occupancy: 'owner', heatingFuel: 'natural_gas', hasResidentialHeatingMeter: true, participating: true, occupiedAllWinter: true }),
      unit('2', { occupancy: 'owner', heatingFuel: 'natural_gas', hasResidentialHeatingMeter: true, participating: true, occupiedAllWinter: true }),
      unit('3', { occupancy: 'owner', heatingFuel: 'natural_gas', hasResidentialHeatingMeter: true, participating: third, occupiedAllWinter: true }),
    ],
  },
  household: { size: 2, incomeBand: { low: 200_000, high: 250_000 }, onDiscountRate: false },
})

describe('Story 2: condo building (coordination)', () => {
  test('unit 3 says no → 75% shown, and unit 3 agreeing is what would change it', () => {
    const r = run(condo(false))
    expect(shown(r, 'insulation', '1').map(x => x.offerId)).toEqual(['masssave_insulation_condo_some_units'])
    expect(shown(r, 'insulation', '1')[0]?.value).toEqual(range(4500, 6750, 9000))
    expect(find(r, 'masssave_insulation_condo_all_units', '1')).toMatchObject({
      status: 'not_eligible', changes: [{ fact: 'unit.participating', unitId: '3', to: true }],
    })
  })
  test('unit 3 undecided → we ask, and say what unit 3 agreeing would do', () => {
    const r = run(condo(null))
    expect(find(r, 'masssave_insulation_condo_all_units', '1')).toMatchObject({
      status: 'needs_info', missing: ['unit.participating'], changes: [{ fact: 'unit.participating', unitId: '3', to: true }],
    })
    expect(r.questions).toContain('unit.participating')
  })
  test('everyone agrees → 75% eligible now and 100% potential (pending Mass Save’s definition), both shown', () => {
    const r = run(condo(true))
    expect(shown(r, 'insulation', '1').map(x => `${x.offerId}:${x.status}`)).toEqual([
      'masssave_insulation_condo_all_units:potential',
      'masssave_insulation_condo_some_units:eligible',
    ])
    expect(find(r, 'masssave_insulation_condo_all_units', '1')?.confirmations[0]?.decidedBy).toBe('Mass Save')
  })
  test('Somerville is not a DEC; high income gets no income offers', () => {
    const r = run(condo(true))
    for (const id of ['masssave_dec_weatherization', 'masssave_income_eligible_weatherization', 'masssave_enhanced_weatherization']) {
      expect(r.results.filter(x => x.offerId === id).every(x => x.status === 'not_eligible')).toBe(true)
    }
  })
})

// Edge case: Belmont, a municipal light plant town, gas heat.
describe('Belmont (MLP electric, Mass Save gas)', () => {
  const r = run(input({
    role: 'owner_occupant_landlord',
    userUnitId: '1',
    building: {
      municipality: 'Belmont', ownership: 'single_owner', yearBuilt: 2005,
      electricUtility: 'municipal', gasUtility: 'national_grid', inEjBlockGroup: null,
      weatherizationRecsDone: null, heaCompleted: null, ownerApproval: true,
      units: [
        unit('1', { occupancy: 'owner', heatingFuel: 'natural_gas', occupiedAllWinter: true }),
        unit('2', { occupancy: 'renter', heatingFuel: 'natural_gas', occupiedAllWinter: true }),
      ],
    },
    household: { size: 2, incomeBand: { low: 150_000, high: 200_000 }, onDiscountRate: false },
  }))
  test('assessment is available through the gas sponsor', () => {
    expect(find(r, 'masssave_hea', '1')?.status).toBe('eligible')
  })
  test('electric-side SMART is not available', () => {
    expect(find(r, 'smart_small', '1')?.status).toBe('not_eligible')
  })
  test('gas-path whole-home rebate is eligible for the owner unit, weatherization already satisfied (built 2005)', () => {
    const whole = find(r, 'ashp_whole_home', '1')
    expect(whole?.status).toBe('eligible')
    expect(whole?.prerequisites.find(p => p.id === 'weatherized')?.state).toBe('done')
  })
  test('HEAT Loan applies because the home is heated with Mass Save gas', () => {
    expect(find(r, 'masssave_heat_loan', '1')?.status).toBe('eligible')
  })
})
```

- [ ] **Step 2: Write the coordination property — `engine/test/scenarios.pbt.test.ts`**

```ts
import fc from 'fast-check'
import { expect, test } from 'vitest'
import type { Quantities } from '../src/benefit.js'
import { loadRuleSet } from '../src/load-rules.js'
import { navigate } from '../src/navigate.js'
import { range } from '../src/range.js'
import { input, RULES_DIR, unit } from './fixtures.js'

const rules = loadRuleSet(RULES_DIR)
const Q: Quantities = { cost: { weatherization: range(6000, 9000, 12000) }, heatPumpTons: null, solarKwhPerYear: null, communitySolarCreditsPerYear: null }
const insulation = new Set(rules.offers.filter(o => o.exclusiveGroup === 'insulation').map(o => o.id))

/** Best insulation value shown for unit 1, counting 'potential' as possible upside. */
function bestShown(participation: (boolean | null)[]): number {
  const i = input({
    role: 'condo_owner', userUnitId: '1',
    building: {
      municipality: 'Somerville', ownership: 'condo', yearBuilt: 1915, electricUtility: 'eversource', gasUtility: 'national_grid',
      inEjBlockGroup: null, weatherizationRecsDone: false, heaCompleted: false, ownerApproval: true,
      units: participation.map((p, k) => unit(String(k + 1), { occupancy: 'owner', hasResidentialHeatingMeter: true, participating: p })),
    },
    household: { size: 2, incomeBand: { low: 200_000, high: 250_000 }, onDiscountRate: false },
  })
  const r = navigate(i, rules, { asOf: '2026-11-15', installDate: null }, () => Q)
  const mids = r.results
    .filter(x => x.unitId === '1' && (x.status === 'eligible' || x.status === 'potential') && insulation.has(x.offerId))
    .map(x => x.value?.mid ?? 0)
  return Math.max(0, ...mids)
}

test('one more unit agreeing never reduces the discount (tooling.md property)', () => {
  const p = fc.constantFrom<boolean | null>(true, false, null)
  fc.assert(fc.property(fc.array(p, { minLength: 2, maxLength: 4 }), fc.nat(), (parts, k) => {
    const idx = k % parts.length
    if (parts[idx] !== false) return
    const after = parts.map((x, j) => (j === idx ? true : x))
    expect(bestShown(after)).toBeGreaterThanOrEqual(bestShown(parts))
  }))
})
```

- [ ] **Step 3: Run**

Run: `cd engine && npx vitest run test/scenarios.test.ts test/scenarios.pbt.test.ts`
Expected: PASS. A failure means the rules data or the engine disagrees with the research doc. Check the cited section before changing anything, and never change an expectation just to make it pass.

- [ ] **Step 4: Commit**

```bash
git add engine/test/scenarios.test.ts engine/test/scenarios.pbt.test.ts
git commit -m "test(engine): scenario tests for the two demo stories and the MLP case"
```

---
### Task 15: Finance core — heating cost, weatherization, payback, who pays

**Files:**
- Create: `engine/src/heating.ts`
- Test: `engine/test/heating.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest'
import {
  attributeToPayer, fuelHeatingCost, heatPumpHeatingCost, heatPumpSwitch, KWH_PER_MMBTU, simplePaybackYears, weatherizedLoad,
} from '../src/heating.js'
import { point, range } from '../src/range.js'

describe('heating cost', () => {
  test('fuel: load / efficiency × price', () => {
    expect(fuelHeatingCost(point(60), point(0.8), point(30)).mid).toBeCloseTo(2250)
  })
  test('heat pump: load / COP × kWh per MMBtu × price', () => {
    expect(heatPumpHeatingCost(point(60), point(2.5), point(0.3)).mid).toBeCloseTo((60 / 2.5) * KWH_PER_MMBTU * 0.3)
  })
  test('switch change uses the same load in both (no double-counted spread)', () => {
    const s = heatPumpSwitch({
      load: range(50, 60, 70), fuelEfficiency: point(0.8), fuelPricePerMMBtu: point(30),
      seasonalCop: point(2.5), electricityPricePerKwh: point(0.3),
    })
    const perMMBtu = KWH_PER_MMBTU * 0.3 / 2.5 - 30 / 0.8
    expect(s.change.low).toBeCloseTo(70 * perMMBtu)
    expect(s.change.high).toBeCloseTo(50 * perMMBtu)
  })
})

describe('weatherization', () => {
  test('reduces load by a fraction range', () => {
    const r = weatherizedLoad(point(100), range(0.05, 0.1, 0.15))
    expect(r.low).toBeCloseTo(85)
    expect(r.mid).toBeCloseTo(90)
    expect(r.high).toBeCloseTo(95)
  })
})

describe('payback', () => {
  test('net cost / annual savings', () => {
    expect(simplePaybackYears(range(1000, 2000, 3000), range(100, 200, 500))).toEqual(range(2, 10, 30))
  })
  test('null when savings could be zero or negative', () => {
    expect(simplePaybackYears(range(1000, 2000, 3000), range(-50, 100, 200))).toBeNull()
  })
  test('net cost below zero counts as zero', () => {
    expect(simplePaybackYears(range(-500, 0, 100), point(100))).toEqual(range(0, 0, 1))
  })
})

describe('who pays', () => {
  test('a change on the heating bill goes to whoever pays heat', () => {
    expect(attributeToPayer(point(-300), 'tenant')).toEqual({ tenant: point(-300), owner: null, payerUnknown: false })
  })
  test('unknown payer is reported, not guessed', () => {
    expect(attributeToPayer(point(-300), null)).toEqual({ tenant: null, owner: null, payerUnknown: true })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run test/heating.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/src/heating.ts`**

```ts
import type { Payer } from './facts.js'
import { complement, div, floorAt, mul, mulAny, scale, sub, type Range } from './range.js'

export const KWH_PER_MMBTU = 293.07107

/** Annual cost of delivering `load` MMBtu of heat with a fuel system of the given seasonal efficiency. */
export const fuelHeatingCost = (load: Range, efficiency: Range, pricePerMMBtu: Range): Range =>
  mul(div(load, efficiency), pricePerMMBtu)

/** Annual electricity cost of delivering `load` MMBtu of heat with a heat pump. */
export const heatPumpHeatingCost = (load: Range, seasonalCop: Range, pricePerKwh: Range): Range =>
  mul(div(load, seasonalCop), scale(pricePerKwh, KWH_PER_MMBTU))

/** Heat load after weatherization removes a fraction of it. */
export const weatherizedLoad = (load: Range, reductionFraction: Range): Range => mul(load, complement(reductionFraction))

export interface SwitchResult {
  before: Range
  after: Range
  /** after − before; negative means savings. Computed per MMBtu so the load's spread isn't counted twice. */
  change: Range
}

export function heatPumpSwitch(a: {
  load: Range
  fuelEfficiency: Range
  fuelPricePerMMBtu: Range
  seasonalCop: Range
  electricityPricePerKwh: Range
}): SwitchResult {
  const hpPerMMBtu = div(scale(a.electricityPricePerKwh, KWH_PER_MMBTU), a.seasonalCop)
  const fuelPerMMBtu = div(a.fuelPricePerMMBtu, a.fuelEfficiency)
  return {
    before: mul(a.load, fuelPerMMBtu),
    after: mul(a.load, hpPerMMBtu),
    change: mulAny(a.load, sub(hpPerMMBtu, fuelPerMMBtu)),
  }
}

/** Years to recover the net cost. Null when savings might be zero or negative (no honest payback). */
export function simplePaybackYears(netCost: Range, annualSavings: Range): Range | null {
  if (annualSavings.low <= 0) return null
  return div(floorAt(netCost, 0), annualSavings)
}

export interface Attribution {
  tenant: Range | null
  owner: Range | null
  payerUnknown: boolean
}

/** Assign a bill change to whoever pays that bill (product.md §3). */
export function attributeToPayer(change: Range, payer: Payer | null): Attribution {
  if (payer === null) return { tenant: null, owner: null, payerUnknown: true }
  return payer === 'tenant'
    ? { tenant: change, owner: null, payerUnknown: false }
    : { tenant: null, owner: change, payerUnknown: false }
}
```

Check of the `change` test: with a fixed per-MMBtu difference `d < 0`, `mulAny(range(50,60,70), point(d))` gives low = 70·d and high = 50·d, which is what the test expects.

- [ ] **Step 4: Run to verify pass**

Run: `cd engine && npx vitest run test/heating.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add engine/src/heating.ts engine/test/heating.test.ts
git commit -m "feat(engine): heating cost, weatherization, payback and payer split"
```

---

### Task 16: Sourced assumptions and `Quantities`

Cost and price assumptions are numbers too: each needs a source (principle 3). **Rule for this task: if you can't find a source for an assumption, leave it out.** The engine then shows that offer's percentage without a dollar figure (`benefit: null`). Never invent a value.

**Files:**
- Create: `engine/src/quantities.ts`, `rules/ma/assumptions.json`
- Test: `engine/test/quantities.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { AssumptionsSchema, loadAssumptions, quantitiesFromAssumptions } from '../src/quantities.js'
import { range } from '../src/range.js'
import { SOURCE } from './fixtures.js'

const a = (id: string, low: number, mid: number, high: number) =>
  ({ id, description: id, unit: 'x', value: { low, mid, high }, confidence: 'low', sources: [SOURCE] })

describe('quantitiesFromAssumptions', () => {
  test('maps known ids', () => {
    const list = AssumptionsSchema.parse([
      a('heat_pump_cost_per_ton', 3860, 5830, 7800),
      a('heat_pump_tons_per_unit', 2, 3, 4),
      a('rooftop_solar_kw_per_building', 4, 6, 8),
      a('solar_yield_kwh_per_kw_year', 1000, 1150, 1300),
    ])
    const q = quantitiesFromAssumptions(list)(null)
    expect(q.cost.heat_pump).toEqual(range(7720, 17490, 31200))
    expect(q.heatPumpTons).toEqual(range(2, 3, 4))
    expect(q.solarKwhPerYear).toEqual(range(4000, 6900, 10400))
    expect(q.cost.weatherization).toBeUndefined()
  })
  test('rejects an assumption without a source', () => {
    expect(() => AssumptionsSchema.parse([{ ...a('x', 1, 2, 3), sources: [] }])).toThrow()
  })
  test('rejects an unordered value', () => {
    expect(() => AssumptionsSchema.parse([a('x', 3, 2, 1)])).toThrow()
  })
  test('the real assumptions file loads', () => {
    const file = fileURLToPath(new URL('../../rules/ma/assumptions.json', import.meta.url))
    expect(Array.isArray(loadAssumptions(file))).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd engine && npx vitest run test/quantities.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/src/quantities.ts`**

```ts
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import type { Quantities } from './benefit.js'
import type { QuantitiesFor } from './offers.js'
import { mul, range, type Range } from './range.js'
import { SourceSchema } from './rules-schema.js'

export const AssumptionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/),
  description: z.string().min(1),
  unit: z.string().min(1),
  value: z
    .strictObject({ low: z.number(), mid: z.number(), high: z.number() })
    .refine(v => v.low <= v.mid && v.mid <= v.high, { message: 'value must satisfy low <= mid <= high' }),
  confidence: z.enum(['low', 'medium', 'high']),
  sources: z.array(SourceSchema).min(1),
})
export const AssumptionsSchema = z.array(AssumptionSchema)
export type Assumption = z.infer<typeof AssumptionSchema>

export const loadAssumptions = (file: string): Assumption[] => AssumptionsSchema.parse(JSON.parse(readFileSync(file, 'utf8')))

/**
 * Same quantities for every unit: a known simplification for 2–4 unit buildings with similar units
 * (schema doc §7). Missing assumptions stay missing.
 */
export function quantitiesFromAssumptions(list: readonly Assumption[]): QuantitiesFor {
  const get = (id: string): Range | null => {
    const v = list.find(x => x.id === id)?.value
    return v ? range(v.low, v.mid, v.high) : null
  }
  const kw = get('rooftop_solar_kw_per_building')
  const costPerKw = get('rooftop_solar_cost_per_kw')
  const yieldPerKw = get('solar_yield_kwh_per_kw_year')
  const cost: Quantities['cost'] = {}
  const weatherization = get('weatherization_cost_per_unit')
  const tons = get('heat_pump_tons_per_unit')
  const costPerTon = get('heat_pump_cost_per_ton')
  if (weatherization) cost.weatherization = weatherization
  if (tons && costPerTon) cost.heat_pump = mul(tons, costPerTon)
  if (kw && costPerKw) cost.rooftop_solar = mul(kw, costPerKw)
  const q: Quantities = {
    cost,
    heatPumpTons: tons,
    solarKwhPerYear: kw && yieldPerKw ? mul(kw, yieldPerKw) : null,
    communitySolarCreditsPerYear: get('community_solar_credits_per_year'),
  }
  return () => q
}
```

- [ ] **Step 4: Write `rules/ma/assumptions.json` from the sources found in Phase 0** (`docs/data-sources.md` §9b). Re-open each source first and confirm the numbers.

| id | Value (low / mid / high) | Source | Status |
|---|---|---|---|
| `heat_pump_cost_per_ton` | 3860 / 5830 / 7800 USD per ton (ductless; mean ± 1 SD) | MA23X14-B-RHPINV Table 1 and Table 6 | Found |
| `rooftop_solar_cost_per_kw` | 3010 / 3750 / 3775 USD per kWdc | DOER SMART PY2027 Aggregated Cost Survey (rooftop ≤27.5 kWdc residential, N = 7) | Found |
| `solar_yield_kwh_per_kw_year` | min / median / max of PVWatts v8 runs | PVWatts v8 (`developer.nlr.gov`) for Boston, Worcester, Springfield; tilt 20–35°, azimuth 180°, losses 14% | Compute in this step |
| `heat_pump_tons_per_unit` | — | No Massachusetts source found | **Omit** (the UI shows example sizes or the contractor's quoted size) |
| `weatherization_cost_per_unit` | — | No Massachusetts source found | **Omit** (percentage only) |
| `rooftop_solar_kw_per_building` | — | Per address from Google Solar / PVWatts in Phase 3 | **Omit** |
| `community_solar_credits_per_year` | — | No published typical value | **Omit** |

```json
[
  { "id": "heat_pump_cost_per_ton", "description": "Installed cost of a ductless mini-split heat pump per ton, Mass Save and MassCEC projects 2021–22, Jan 2024 dollars; range = mean ± 1 standard deviation", "unit": "USD per ton",
    "value": { "low": 3860, "mid": 5830, "high": 7800 }, "confidence": "medium",
    "sources": [
      { "url": "https://ma-eeac.org/wp-content/uploads/MA23X14-B-RHPINV-Residential-Heat-Pump-Invoice-Cost-Study-Web.pdf", "section": "Table 1: Baseline Heat Pump Project Costs and Proportions (Jan. 2024$)", "quote": "Ductless MSHP $5,830/ton", "lastVerified": "2026-11-06" },
      { "url": "https://ma-eeac.org/wp-content/uploads/MA23X14-B-RHPINV-Residential-Heat-Pump-Invoice-Cost-Study-Web.pdf", "section": "Table 6: Ductless MSHP – Project Scope Cost Dependency (Jan. 2024$/ton)", "quote": "Standard Deviation $1,970", "lastVerified": "2026-11-06" } ] },
  { "id": "rooftop_solar_cost_per_kw", "description": "Installed cost of residential rooftop solar ≤27.5 kWdc reported to DOER for SMART PY2027 (25th percentile / median / 75th percentile; N = 7; sheet labels the unit $/kwh but values are $/kWdc)", "unit": "USD per kWdc",
    "value": { "low": 3010, "mid": 3750, "high": 3775 }, "confidence": "low",
    "sources": [
      { "url": "https://www.mass.gov/doc/aggregated-cost-survey-results-py2027/download", "section": "Rooftop, <= 27.5 kWdc residential", "quote": "Rooftop | <= 27.5 kWdc residential | Mean 3461.29 | Median 3750 | 25th Percentile 3010.43 | 75th Percentile 3775 | N 7", "lastVerified": "2026-11-06" } ] }
]
```

Add the `solar_yield_kwh_per_kw_year` entry after running PVWatts, with each run's inputs in `description` and the API URL (without the key) as the source.

- [ ] **Step 5: Run to verify pass**

Run: `cd engine && npx vitest run test/quantities.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add engine/src/quantities.ts engine/test/quantities.test.ts rules/ma/assumptions.json
git commit -m "feat(engine): sourced assumptions to quantities"
```

---

### Task 17: Reproducible energy-burden figure (README statistic)

**Files:**
- Create: `analysis/lead_burden.py`, `analysis/test_lead_burden.py`, `analysis/README.md`

- [ ] **Step 1: Write the failing test — `analysis/test_lead_burden.py`**

```python
import csv
import io

from lead_burden import burden_by_group

HEADER = ["FPL150", "TEN", "TEN-BLD", "UNITS", "HINCP*UNITS", "ELEP*UNITS", "GASP*UNITS", "FULP*UNITS",
          "HINCP UNITS", "ELEP UNITS", "GASP UNITS", "FULP UNITS"]


def rows(*data):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADER)
    w.writerows(data)
    buf.seek(0)
    return csv.DictReader(buf)


def test_low_income_burden_is_spend_over_income():
    # 10 households at 0-100% FPL: income 20,000 each, electricity 1,000, gas 1,000, other 0.
    r = rows(["0-100%", "REN", "RENTER 3-4 UNIT", 10, 200000, 10000, 10000, 0, 10, 10, 10, 10])
    out = burden_by_group(r)
    assert round(out["below 200% FPL"]["burden"], 4) == 0.1
    assert out["below 200% FPL | 2-4 unit"]["households"] == 10


def test_groups_split_at_200_percent_fpl():
    r = rows(
        ["0-100%", "OWN", "OWNER 2 UNIT", 1, 10000, 500, 500, 0, 1, 1, 1, 1],
        ["200-400%", "OWN", "OWNER 2 UNIT", 1, 100000, 1000, 1000, 0, 1, 1, 1, 1],
    )
    out = burden_by_group(r)
    assert round(out["below 200% FPL"]["burden"], 3) == 0.1
    assert round(out["at/above 200% FPL"]["burden"], 3) == 0.02
```

- [ ] **Step 2: Run to verify failure**

Run: `cd analysis && python3 -m pytest -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'lead_burden'`. (Install pytest first if missing: `python3 -m pip install pytest`.)

- [ ] **Step 3: Implement `analysis/lead_burden.py`**

```python
"""Massachusetts energy burden from DOE LEAD Tool 2022 (docs/data-sources.md §8).

burden(group) = (avg electricity + avg gas + avg other fuel spend) / avg household income,
summed over the county-level FPL file. Usage:
    python3 lead_burden.py "path/to/MA FPL Counties 2022.csv"
"""
import csv
import sys
from collections import defaultdict

LOW_FPL = {"0-100%", "100-150%", "150-200%"}
FIELDS = ["HINCP*UNITS", "ELEP*UNITS", "GASP*UNITS", "FULP*UNITS",
          "HINCP UNITS", "ELEP UNITS", "GASP UNITS", "FULP UNITS", "UNITS"]


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def burden_by_group(reader):
    acc = defaultdict(lambda: defaultdict(float))
    for r in reader:
        low = "below 200% FPL" if r["FPL150"] in LOW_FPL else "at/above 200% FPL"
        building = r["TEN-BLD"].split(" ", 1)[1] if " " in r["TEN-BLD"] else r["TEN-BLD"]
        keys = ["ALL", low, f"{low} | {r['TEN']}"]
        if building in ("2 UNIT", "3-4 UNIT"):
            keys += [f"{low} | 2-4 unit", f"{low} | 2-4 unit | {r['TEN']}"]
        for k in keys:
            for c in FIELDS:
                acc[k][c] += _f(r[c])
    out = {}
    for k, a in acc.items():
        income = a["HINCP*UNITS"] / a["HINCP UNITS"]
        energy = sum(a[f"{x}P*UNITS"] / a[f"{x}P UNITS"] for x in ("ELE", "GAS", "FUL") if a[f"{x}P UNITS"])
        out[k] = {"households": a["UNITS"], "income": income, "energy": energy, "burden": energy / income}
    return out


def main(path):
    with open(path, newline="") as fh:
        out = burden_by_group(csv.DictReader(fh))
    print(f"{'group':45s} {'households':>11s} {'avg income':>11s} {'avg energy':>11s} {'burden':>7s}")
    for k in sorted(out):
        g = out[k]
        print(f"{k:45s} {g['households']:11,.0f} {g['income']:11,.0f} {g['energy']:11,.0f} {g['burden']*100:6.1f}%")


if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 4: Create `analysis/README.md`**

```markdown
# Analysis scripts

## lead_burden.py — Massachusetts energy burden

1. Download `MA-2022-LEAD-data.zip` from https://data.openei.org/submissions/6219 into a new, empty folder outside the repo and unzip it.
2. Run: `python3 analysis/lead_burden.py "<folder>/MA FPL Counties 2022.csv"`
3. Expected on the 2022 update (checked 2026-11-06): below 200% FPL ≈ 12.9%, at/above ≈ 2.3%.

Data files are not committed (≈ 660 MB unzipped).
```

- [ ] **Step 5: Run to verify pass**

Run: `cd analysis && python3 -m pytest -q`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add analysis/
git commit -m "feat(analysis): reproducible MA energy burden from LEAD"
```

---

### Task 18: Full verification and review

- [ ] **Step 1: Run everything**

Run: `cd engine && npm run check && cd ../analysis && python3 -m pytest -q`
Expected: typecheck clean; all Vitest suites pass; `2 passed` for pytest.

- [ ] **Step 2: Check each principle and write the answers in the PR description**
  - Numbers only from code: every `Range` comes from `benefit.ts`, `heating.ts` or `quantities.ts`.
  - Ranges: no function in `engine/src` returns a bare money `number`.
  - Sources: `rules-data.test.ts` passes, so every rule has a source and nothing retired is active.
  - Ask, don't pretend: `questions` lists the unknown user facts in both stories. `confirmations` list what only the program can confirm.
  - Prerequisites never change status: Story 1's whole-home rebate shows `weatherized: todo` while its status is `potential` for a different reason (the account-holder confirmation), not `not_eligible`.

- [ ] **Step 3: Request review** with requesting-code-review, then hand off for the independent end-of-phase review (CONTRIBUTING.md).

---

## Self-review notes (writing-plans checklist)

- **Spec coverage:**
  - four roles (Tasks 3, 13);
  - unit vs user scope (Tasks 4, 11);
  - three condition kinds (Tasks 8, 11, 14);
  - all-units coordination and "what would change" (Tasks 5, 6, 10, 14);
  - install window vs application deadline, versions by install date, archive (Tasks 8, 12, 13);
  - ranges (Tasks 2, 9, 15, 16);
  - insulation shows a percentage and "likely close to nothing" without a cost source (Tasks 11, 14);
  - sources, retirement and staleness (Tasks 8, 13);
  - sequencing with sourced reasons (Tasks 12, 13);
  - MLP (Tasks 13, 14), DEC (Tasks 4, 13), income tiers as ranges (Tasks 5, 13);
  - caps with scope (Tasks 11, 13);
  - total household energy cost and payer split (Task 15);
  - sourced cost assumptions (Task 16);
  - README statistic (Task 17).
- **Deliberately not in Phase 1:** LLM slots and explanations (Phase 2), the address→profile pipeline (Phase 2/3), seasonal heat pump rates (v1.5), Google Solar (Phase 3), contact directory and multiple households (schema §9).
- **Known simplifications** (commented in code):
  - the same quantities for every unit;
  - DEC narrowing checks either utility;
  - whole-home weatherization option (B), "< $1,000 recommended", is described in the prerequisite but not checked;
  - prior use of caps is never known, so caps read "if you haven't used this before".
