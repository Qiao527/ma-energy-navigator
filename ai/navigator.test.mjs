import { test } from 'node:test'
import assert from 'node:assert/strict'
import { askDeepSeek, intakeSchema, presentationSchema, validate } from './navigator.mjs'

const facts = { role: 'tenant', town: 'Boston', units: 3, fuel: null, heatPayer: null, electricPayer: null, electricUtility: null }
test('rejects malformed, extra and invalid extracted facts', () => {
  assert.equal(validate(facts, intakeSchema), true)
  assert.equal(validate({ ...facts, units: 5 }, intakeSchema), false)
  assert.equal(validate({ ...facts, town: '123 Main St' }, intakeSchema), false)
  assert.equal(validate({ ...facts, extra: 'invented' }, intakeSchema), false)
  assert.equal(validate({ focus: 'invented', tone: 'warm' }, presentationSchema), false)
})
test('uses DeepSeek JSON mode and validates complete responses', async () => {
  let sent
  const reply = data => async (url, options) => { sent = { url, options }; return { ok: true, json: async () => data } }
  const completed = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(facts) } }] }
  assert.deepEqual(await askDeepSeek('intake', 'example', 'test', 'deepseek-flash', reply(completed)), facts)
  assert.equal(sent.url, 'https://api.deepseek.com/chat/completions')
  assert.equal(JSON.parse(sent.options.body).response_format.type, 'json_object')
  assert.match(JSON.parse(sent.options.body).messages[0].content, /tenants pay.*does not establish/i)
  assert.match(JSON.parse(sent.options.body).messages[0].content, /single.family.*landlord/i)
  assert.deepEqual(JSON.parse(sent.options.body).thinking, { type: 'disabled' })
  assert.equal(sent.options.headers.authorization, 'Bearer test')
  await assert.rejects(askDeepSeek('intake', 'example', 'test', 'model', reply({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(facts) } }] })))
  await assert.rejects(askDeepSeek('intake', 'example', 'test', 'model', reply({ choices: [{ finish_reason: 'stop', message: { content: '{"units":99}' } }] })))
  await assert.rejects(askDeepSeek('intake', 'example', 'test', 'model', reply({ choices: [{ finish_reason: 'stop', message: { content: '   ' } }] })))
})
test('does not apply a tenant-only bill payer to an owner-occupied floor', async () => {
  const result = { ...facts, role: 'owner_occupant_landlord', heatPayer: 'tenant', electricPayer: 'tenant' }
  const request = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] }) })
  const answer = await askDeepSeek('intake', 'example', 'test', 'deepseek-flash', request)
  assert.equal(answer.heatPayer, null)
  assert.equal(answer.electricPayer, null)
})
