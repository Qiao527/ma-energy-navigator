import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handle } from './handler.mjs'

const request = (path, origin = 'https://example.vercel.app', text = 'hello', key) => new Request(`https://example.vercel.app/api/${path}`, {
  method: 'POST', headers: { origin, 'content-type': 'application/json', ...(key === undefined ? {} : { 'x-api-key': key }) }, body: JSON.stringify({ text }),
})
test('rejects invalid routes, origins and oversized inputs', async () => {
  assert.equal((await handle(request('other'), {}, async () => null)).status, 404)
  assert.equal((await handle(request('intake', 'https://evil.example'), {}, async () => null)).status, 403)
  assert.equal((await handle(request('intake', undefined, 'x'.repeat(4001)), {}, async () => null)).status, 400)
})
test('requires the visitor key and never falls back to the project key', async () => {
  let args
  const answer = { focus: 'cost', tone: 'warm' }
  assert.equal((await handle(request('presentation'), { DEEPSEEK_API_KEY: 'project-secret' }, async () => { throw new Error('must not call') })).status, 401)
  assert.equal((await handle(request('presentation', undefined, 'hello', 'bad key'), {}, async () => null)).status, 400)
  const response = await handle(request('presentation', undefined, 'hello', 'visitor-secret'), { DEEPSEEK_API_KEY: 'project-secret' }, async (...values) => { args = values; return answer })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, answer)
  assert.equal(args[0], 'presentation')
  assert.equal(args[2], 'visitor-secret')
  assert.equal(args[3], 'deepseek-flash')
  assert.equal(JSON.stringify(body).includes('visitor-secret'), false)
})
test('does not return a visitor key when the provider fails', async () => {
  const response = await handle(request('intake', undefined, 'hello', 'visitor-secret'), {}, async () => { throw new Error('visitor-secret') })
  assert.equal(response.status, 502)
  assert.equal((await response.text()).includes('visitor-secret'), false)
})
