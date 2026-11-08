import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Rule files at the top of a rules folder; offers live in offers/*.json. */
export const RULE_FILES = [
  'programs.json', 'predicates.json', 'income-tables.json', 'dec.json', 'caps.json', 'sequence.json', 'legal.json',
  'assumptions.json', 'assumptions-resstock.json',
] as const

/** Every rule file present in a rules folder, as paths relative to it (drafts/ and sources/ are never included). */
export function ruleFiles(dir: string): string[] {
  const top = RULE_FILES.filter(f => existsSync(join(dir, f)))
  const offersDir = join(dir, 'offers')
  const offers = existsSync(offersDir) ? readdirSync(offersDir).filter(f => f.endsWith('.json')).sort().map(f => `offers/${f}`) : []
  return [...top, ...offers]
}

export const fileSha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex')

/** One approval: Qiao approved this exact file content (product.md §6a). */
export interface Approval {
  file: string
  sha256: string
  draftedBy: string
  checkedOn: string
  approvedBy: string
  approvedOn: string
}

export function readApprovals(dir: string): Approval[] {
  const f = join(dir, 'approvals.json')
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Approval[]) : []
}

/** Active rule files whose current content has no approval. Any change after approval needs a new one. */
export function approvalProblems(dir: string): string[] {
  const latest = new Map<string, Approval>()
  for (const a of readApprovals(dir)) latest.set(a.file, a)
  return ruleFiles(dir)
    .filter(file => latest.get(file)?.sha256 !== fileSha256(join(dir, file)) || !latest.get(file)?.approvedBy)
    .map(file => `not approved: ${file} (changed since approval or never approved)`)
}
