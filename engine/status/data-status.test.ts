import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { loadRuleSet } from '../src/load-rules.js'
import { dataStatus, freshness, isStale } from '../src/provenance.js'
import { offerKey } from '../src/rules-schema.js'

/** Uses today's date on purpose. Reports; never fails the build. Run: npm run data:status */
test('rules data status today', () => {
  const today = new Date().toISOString().slice(0, 10)
  const rules = loadRuleSet(fileURLToPath(new URL('../../rules/ma/', import.meta.url)))
  const status = dataStatus(rules, today)
  const stale = rules.offers.filter(o => isStale(freshness(o, rules), today)).map(offerKey)
  console.log(JSON.stringify({ today, ...status, stale }, null, 2))
  expect(true).toBe(true)
})
