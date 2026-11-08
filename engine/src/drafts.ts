import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { fileSha256, ruleFiles } from './approvals.js'
import { loadRuleSet } from './load-rules.js'
import { findDataProblems } from './provenance.js'
import { AssumptionsSchema } from './quantities.js'
import {
  CapRuleSchema, DecFileSchema, IncomeTableSchema, LegalConstraintSchema, OfferSchema, PredicateSchema, ProgramSchema, SequenceEdgeSchema,
} from './rules-schema.js'

/**
 * Whitespace and Unicode-normalized text, so line breaks in a PDF or links in a web page don't break a verbatim
 * quote. Also drops a space before punctuation, which appears when a link ends right before "." or ",".
 */
export const normalizeText = (s: string): string =>
  s.normalize('NFKC').replace(/\s+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').replace(/\( /g, '(').trim()

function collectSources(x: unknown, out: { url: string; quote: string }[]): void {
  if (Array.isArray(x)) for (const v of x) collectSources(v, out)
  else if (x !== null && typeof x === 'object') {
    const o = x as Record<string, unknown>
    if (typeof o.url === 'string' && typeof o.quote === 'string') out.push({ url: o.url, quote: o.quote })
    for (const v of Object.values(o)) collectSources(v, out)
  }
}

/** Saved source snapshots by URL: sources/<slug>.txt with sources/<slug>.meta.json { url, fetchedOn, sha256 }. */
export function loadSnapshots(sourcesDir: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!existsSync(sourcesDir)) return out
  for (const f of readdirSync(sourcesDir).filter(n => n.endsWith('.meta.json'))) {
    const meta = JSON.parse(readFileSync(join(sourcesDir, f), 'utf8')) as { url: string }
    const text = readFileSync(join(sourcesDir, f.replace(/\.meta\.json$/, '.txt')), 'utf8')
    out.set(meta.url, normalizeText(text))
  }
  return out
}

/** Every { url, quote } in the documents must appear verbatim (after normalization) in that URL's snapshot. */
export function quoteProblems(docs: unknown[], sourcesDir: string): string[] {
  const snapshots = loadSnapshots(sourcesDir)
  const sources: { url: string; quote: string }[] = []
  collectSources(docs, sources)
  const problems = new Set<string>()
  for (const s of sources) {
    const text = snapshots.get(s.url)
    if (text === undefined) problems.add(`no saved snapshot for ${s.url}`)
    else if (!text.includes(normalizeText(s.quote))) problems.add(`quote not found in snapshot of ${s.url}: "${s.quote}"`)
  }
  return [...problems]
}

const SCHEMAS: Record<string, z.ZodType> = {
  'programs.json': z.array(ProgramSchema),
  'predicates.json': z.array(PredicateSchema),
  'income-tables.json': z.array(IncomeTableSchema),
  'dec.json': DecFileSchema,
  'caps.json': z.array(CapRuleSchema),
  'sequence.json': z.array(SequenceEdgeSchema),
  'legal.json': z.array(LegalConstraintSchema),
  'assumptions.json': AssumptionsSchema,
  'assumptions-resstock.json': AssumptionsSchema,
}
const schemaFor = (file: string): z.ZodType => SCHEMAS[file] ?? z.array(OfferSchema)

export interface DraftCheck {
  ok: boolean
  problems: string[]
  /** The exact draft contents that were checked; approval must match these hashes. */
  files: { file: string; sha256: string }[]
}

/** The automatic check every draft passes before Qiao reviews it (product.md §6a, step 3). */
export function checkDrafts(a: { activeDir: string; draftsDir: string; sourcesDir: string }): DraftCheck {
  const files = ruleFiles(a.draftsDir)
  const problems: string[] = []
  const docs: unknown[] = []
  for (const file of files) {
    const doc: unknown = JSON.parse(readFileSync(join(a.draftsDir, file), 'utf8'))
    docs.push(doc)
    const r = schemaFor(file).safeParse(doc)
    if (!r.success) problems.push(`schema: ${file}: ${z.prettifyError(r.error).replace(/\s+/g, ' ')}`)
  }
  if (problems.length === 0) {
    try {
      problems.push(...findDataProblems(loadRuleSet(a.activeDir, { requireApproval: false, overlayDir: a.draftsDir })))
    } catch (e) {
      problems.push(`schema: combined rules: ${(e as Error).message.replace(/\s+/g, ' ')}`)
    }
  }
  problems.push(...quoteProblems(docs, a.sourcesDir))
  return { ok: problems.length === 0, problems, files: files.map(file => ({ file, sha256: fileSha256(join(a.draftsDir, file)) })) }
}
