import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handle } from './handler.mjs'

const request = (path, origin = 'https://example.vercel.app', text = 'hello') => new Request(`https://example.vercel.app/api/${path}`, {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ text }),
})
test('rejects invalid routes, origins and oversized inputs', async () => {
  assert.equal((await handle(request('other'), {}, async () => null)).status, 404)
  assert.equal((await handle(request('intake', 'https://evil.example'), {}, async () => null)).status, 403)
  assert.equal((await handle(request('intake', undefined, 'x'.repeat(4001)), {}, async () => null)).status, 400)
})
test('requires DeepSeek credentials and keeps them server-side', async () => {
  let args
  const answer = { focus: 'cost', tone: 'warm' }
  assert.equal((await handle(request('presentation'), {}, async () => null)).status, 503)
  const response = await handle(request('presentation'), { DEEPSEEK_API_KEY: 'test-secret' }, async (...values) => { args = values; return answer })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), answer)
  assert.equal(args[0], 'presentation')
  assert.equal(args[2], 'test-secret')
  assert.equal(args[3], 'deepseek-flash')
})
