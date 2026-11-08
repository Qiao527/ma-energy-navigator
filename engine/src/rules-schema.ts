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
  /** action: the user does it. requirement: a condition on the work we can't check. coordination: other units must agree. */
  kind: z.enum(['action', 'requirement', 'coordination']),
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
  /** installation: `effective` is compared to the planned install date. as_of: to today's date. */
  dateBasis: z.enum(['installation', 'as_of']),
  effective: WindowSchema,
  applicationDeadline: IsoDate.nullable(),
  eligibility: ConditionSchema,
  prerequisites: z.array(PrerequisiteSchema),
  confirmations: z.array(ConfirmationSchema),
  benefit: BenefitSchema,
  qualification: z.enum(['exact', 'up_to', 'minimum']),
  /** Who receives the money or service; drives the upfront side of the payer split (schema §7). */
  recipient: z.enum(['property_owner', 'household']),
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
  /** true until the program confirms the definition: then it never decides a result (Task 5). */
  workingAssumption: z.boolean(),
  note: z.string().min(1),
  sources: Sources,
})

export const IncomeTableSchema = z.strictObject({
  id: Id,
  label: z.string().min(1),
  /** The period the limits apply to. Offers using the table must stay inside it (review A5). */
  window: WindowSchema,
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

/** A sourced legal constraint the report refers to by id (research §18). Never interpreted for the user. */
export const LegalConstraintSchema = z.strictObject({
  id: Id,
  summary: z.string().min(1),
  /** The exact thing the user should check, e.g. in their written rental agreement. */
  leaseCheck: z.string().min(1),
  disclaimer: z.string().min(1),
  /** Where to get help. */
  resources: Sources,
  sources: Sources,
})
export type LegalConstraint = z.infer<typeof LegalConstraintSchema>

export const RuleSetSchema = z.strictObject({
  programs: z.array(ProgramSchema),
  offers: z.array(OfferSchema),
  predicates: z.array(PredicateSchema),
  incomeTables: z.array(IncomeTableSchema),
  dec: DecFileSchema,
  caps: z.array(CapRuleSchema),
  sequence: z.array(SequenceEdgeSchema),
  legal: z.array(LegalConstraintSchema).default([]),
})
export type RuleSet = z.infer<typeof RuleSetSchema>
