import type { Assumption } from '../../engine/src/quantities.js'
import { offerKey, type RuleSet } from '../../engine/src/rules-schema.js'
import raw from '../.gen/data.json'

export const DATA = raw as unknown as {
  rules: RuleSet
  assumptions: Assumption[]
  status: { previewDrafts: boolean; pendingDrafts: string[]; approvals: number; builtOn: string }
}
export const RULES = DATA.rules
export const OFFERS = new Map(RULES.offers.map(o => [offerKey(o), o]))
export const PROGRAMS = new Map(RULES.programs.map(p => [p.id, p]))
