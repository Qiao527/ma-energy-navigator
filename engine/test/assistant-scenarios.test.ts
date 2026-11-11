import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { report } from '../src/energy.js'
import { InputSchema } from '../src/facts.js'
import { loadAssumptions, loadRuleSet } from '../src/load-rules.js'
import { ScenarioSchema } from '../src/scenarios.js'
import { renderAnswer } from '../../web/src/assistant.js'
import { usd } from '../../web/src/format.js'

const rulesDir = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
const dir = fileURLToPath(new URL('../../scenarios/ma/', import.meta.url))
const rules = loadRuleSet(rulesDir)
const assumptions = loadAssumptions(rulesDir)

describe('AI output grounding across standard scenarios', () => {
  for (const file of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    it(file, () => {
      const s = ScenarioSchema.parse(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')))
      const input = InputSchema.parse(s.input)
      const r = report(input, rules, { ...s.options, boilerNeedsReplacing: false }, assumptions)
      const permitted = r.buildingChange && (input.role === 'renting_landlord' || input.role === 'owner_occupant_landlord')
        ? [usd(r.buildingChange.range.low), usd(r.buildingChange.range.high)] : []
      for (const focus of ['cost', 'coordination'] as const) for (const tone of ['warm', 'direct'] as const) {
        const text = renderAnswer(r, input.role, { focus, tone }, s.demoData)
        expect(text.match(/\$[\d,]+/g) ?? []).toEqual(permitted.length ? [...permitted, ...permitted] : [])
        expect(text).toContain('fictional demo data')
        for (const program of rules.programs) expect(text.toLowerCase()).not.toContain(program.name.toLowerCase())
      }
    })
  }
})
