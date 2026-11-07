import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import { loadRuleSet } from '../src/load-rules.js'
import { runScenario, ScenarioSchema } from '../src/scenarios.js'

/**
 * npm run scenarios:record — writes each scenario's `expected` from the CURRENT rules (approved + drafts preview).
 * Only for a human-reviewed baseline: every change to an expected result needs Qiao's approval (CONTRIBUTING.md).
 */
test('record standard scenario baselines', () => {
  const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
  const dir = fileURLToPath(new URL('../../scenarios/ma/', import.meta.url))
  const rules = loadRuleSet(rulesDir, { requireApproval: false, overlayDir: `${rulesDir}drafts` })
  for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    const s = ScenarioSchema.parse(JSON.parse(readFileSync(`${dir}${f}`, 'utf8')))
    writeFileSync(`${dir}${f}`, `${JSON.stringify({ ...s, expected: runScenario(s, rules) }, null, 2)}\n`)
  }
})
