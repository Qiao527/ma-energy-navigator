import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { intakeSchema, validate } from './navigator.mjs'

test('evaluation cases have unique identifiers and complete valid expectations', async () => {
  const cases = JSON.parse(await readFile(new URL('../eval/intake-cases.json', import.meta.url), 'utf8'))
  assert.ok(cases.length >= 10)
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length)
  for (const item of cases) {
    assert.ok(item.text.trim())
    assert.ok(validate(item.expected, intakeSchema), item.id)
  }
})
