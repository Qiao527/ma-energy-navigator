/**
 * Build-time only (Node): loads the rules and assumptions the page ships with. A production build ships only rule
 * files Qiao approved (product.md §6a); the loader throws otherwise. A preview build overlays the drafts and the page
 * says so on every screen.
 */
import { fileURLToPath } from 'node:url'
import { approvalProblems, readApprovals, ruleFiles } from '../../engine/src/approvals.js'
import { report } from '../../engine/src/energy.js'
import { loadAssumptions, loadRuleSet } from '../../engine/src/load-rules.js'
import { STORY1 } from './demo.js'

export function loadData(previewDrafts: boolean) {
  const dir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
  const drafts = `${dir}drafts`
  const opts = previewDrafts ? { requireApproval: false, overlayDir: drafts } : {}
  if (!previewDrafts) {
    const problems = approvalProblems(dir)
    if (problems.length > 0) throw new Error(`Not every rule file is approved:\n${problems.join('\n')}`)
  }
  const rules = loadRuleSet(dir, opts)
  const assumptions = loadAssumptions(dir, opts)
  // Smoke check: the demo story must produce a full report with these exact rules.
  const r = report(STORY1.input, rules, { asOf: '2026-11-15', installDate: null, boilerNeedsReplacing: false }, assumptions)
  if (r.units.some(u => u.bills === null)) throw new Error('smoke check: the demo story has a unit without bills')
  return {
    rules,
    assumptions,
    status: {
      previewDrafts,
      pendingDrafts: previewDrafts ? ruleFiles(drafts) : [],
      approvals: readApprovals(dir).length,
      builtOn: new Date().toISOString().slice(0, 10),
    },
  }
}
