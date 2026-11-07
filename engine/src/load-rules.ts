import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { approvalProblems } from './approvals.js'
import { RuleSetSchema, type RuleSet } from './rules-schema.js'

export interface LoadOptions {
  /** Default true: refuse any rule file without Qiao's approval (product.md §6a). */
  requireApproval?: boolean
  /** Preview only: files in this folder replace the active ones (used by the draft check). */
  overlayDir?: string
}

/** Reads rules/<state>/ and validates it. All versions are loaded; dates pick one. drafts/ is never read. */
export function loadRuleSet(dir: string, opts: LoadOptions = {}): RuleSet {
  if (opts.requireApproval ?? true) {
    const problems = approvalProblems(dir)
    if (problems.length > 0) throw new Error(problems.join('\n'))
  }
  const overlay = opts.overlayDir
  const pick = (rel: string): string | null => {
    if (overlay !== undefined && existsSync(join(overlay, rel))) return join(overlay, rel)
    return existsSync(join(dir, rel)) ? join(dir, rel) : null
  }
  const read = (rel: string, fallback: unknown): unknown => {
    const p = pick(rel)
    return p === null ? fallback : JSON.parse(readFileSync(p, 'utf8'))
  }
  const offerNames = new Set<string>()
  for (const base of [dir, overlay]) {
    if (base !== undefined && existsSync(join(base, 'offers'))) {
      for (const f of readdirSync(join(base, 'offers'))) if (f.endsWith('.json')) offerNames.add(f)
    }
  }
  return RuleSetSchema.parse({
    programs: read('programs.json', []),
    offers: [...offerNames].sort().flatMap(f => read(join('offers', f), []) as unknown[]),
    predicates: read('predicates.json', []),
    incomeTables: read('income-tables.json', []),
    dec: read('dec.json', undefined),
    caps: read('caps.json', []),
    sequence: read('sequence.json', []),
    legal: read('legal.json', []),
  })
}
