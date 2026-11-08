import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import { loadAssumptions, loadRuleSet } from '../src/load-rules.js'
import { runScenario, ScenarioSchema } from '../src/scenarios.js'

/**
 * npm run scenarios:record — writes each scenario's `expected` from the CURRENT rules (approved + drafts preview).
 * A changed `expected` loses its approval: every change to an expected result needs Qiao's approval (CONTRIBUTING.md).
 */
test('record standard scenario baselines', () => {
  const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
  const dir = fileURLToPath(new URL('../../scenarios/ma/', import.meta.url))
  const rules = loadRuleSet(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  const list = loadAssumptions(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    const s = ScenarioSchema.parse(JSON.parse(readFileSync(`${dir}${f}`, 'utf8')))
    const expected = runScenario(s, rules, list)
    const changed = JSON.stringify(expected) !== JSON.stringify(s.expected)
    if (changed) console.log(`changed: ${f}${s.approved ? ' (approval cleared)' : ''}`)
    const next = { ...s, expected, approved: changed ? null : s.approved }
    writeFileSync(`${dir}${f}`, `${JSON.stringify(next, null, 2)}\n`)
  }
})
