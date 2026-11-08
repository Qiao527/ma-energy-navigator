import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { approvalProblems, ruleFiles } from '../src/approvals.js'
import { loadAssumptions, loadRuleSet } from '../src/load-rules.js'
import { diffSummaries, runScenario, ScenarioSchema } from '../src/scenarios.js'

/**
 * npm run scenarios — every rules, engine, prompt or model change must pass these first (CONTRIBUTING.md).
 * Rules: the approved active files, plus any drafts still waiting for approval (named in the suite title),
 * so engine changes are checked before every rule is approved. Unapproved baselines are skipped, not trusted.
 */
const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
const dir = fileURLToPath(new URL('../../scenarios/ma/', import.meta.url))
const files = readdirSync(dir).filter(n => n.endsWith('.json')).sort()
const pending = ruleFiles(`${rulesDir}drafts`)

describe(`standard scenarios (${pending.length} rule files still drafts${pending.length ? `: ${pending.join(', ')}` : ''})`, () => {
  test('active rule files are all approved', () => {
    expect(approvalProblems(rulesDir)).toEqual([])
  })
  const rules = loadRuleSet(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const list = loadAssumptions(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  for (const f of files) {
    const s = ScenarioSchema.parse(JSON.parse(readFileSync(`${dir}${f}`, 'utf8')))
    test.skipIf(s.approved === null)(`${f}${s.approved === null ? ' (baseline waiting for Qiao’s approval)' : ''}`, () => {
      expect(diffSummaries(s.expected, runScenario(s, rules, list))).toEqual([])
    })
  }
})
