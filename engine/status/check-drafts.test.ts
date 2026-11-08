import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { checkDrafts } from '../src/drafts.js'

/**
 * npm run rules:check-drafts — the automatic check before Qiao reviews drafts (product.md §6a, step 3).
 * Writes rules/ma/drafts/CHECK.json; tools/approve_rules.py only approves files whose hash matches a passing check.
 */
test('rules drafts pass the automatic check', () => {
  const root = fileURLToPath(new URL('../../rules/ma/', import.meta.url))
  const report = checkDrafts({ activeDir: root, draftsDir: `${root}drafts`, sourcesDir: `${root}sources` })
  const checkedOn = new Date().toISOString().slice(0, 10)
  writeFileSync(`${root}drafts/CHECK.json`, `${JSON.stringify({ checkedOn, ...report }, null, 2)}\n`)
  console.log(report.ok ? `OK: ${report.files.length} draft files checked` : `PROBLEMS:\n- ${report.problems.join('\n- ')}`)
  expect(report.problems).toEqual([])
})
