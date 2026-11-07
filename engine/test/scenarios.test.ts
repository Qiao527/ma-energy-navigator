import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { ruleFiles } from '../src/approvals.js'
import { loadRuleSet } from '../src/load-rules.js'
import { diffSummaries, runScenario, ScenarioSchema } from '../src/scenarios.js'

/** npm run scenarios — every rules, engine, prompt or model change must pass these first (CONTRIBUTING.md). */
const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
const dir = fileURLToPath(new URL('../../scenarios/ma/', import.meta.url))
const files = readdirSync(dir).filter(n => n.endsWith('.json')).sort()
const hasApprovedRules = ruleFiles(rulesDir).length > 0

describe.skipIf(!hasApprovedRules)('standard scenarios (approved rules)', () => {
  const rules = hasApprovedRules ? loadRuleSet(rulesDir) : null
  for (const f of files) {
    test(f, () => {
      const s = ScenarioSchema.parse(JSON.parse(readFileSync(`${dir}${f}`, 'utf8')))
      expect(s.expected, 'no baseline recorded').not.toBeNull()
      if (rules) expect(diffSummaries(s.expected, runScenario(s, rules))).toEqual([])
    })
  }
})
