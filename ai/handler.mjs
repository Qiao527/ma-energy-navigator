import { askDeepSeek } from './navigator.mjs'

export async function handle(req, env = process.env, ask = askDeepSeek) {
  const json = (value, status) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  const url = new URL(req.url)
  const kind = url.pathname === '/api/intake' ? 'intake' : url.pathname === '/api/presentation' ? 'presentation' : null
  if (!kind || req.method !== 'POST') return json({ error: 'Not found' }, 404)
  if (req.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin' }, 403)
  if (req.headers.get('content-type') !== 'application/json') return json({ error: 'Invalid request' }, 415)
  try {
    if (Number(req.headers.get('content-length')) > 12000) return json({ error: 'Request too large' }, 413)
    const body = await req.text()
    if (body.length > 12000) return json({ error: 'Request too large' }, 413)
    const data = JSON.parse(body)
    if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000) return json({ error: 'Invalid request' }, 400)
    const key = req.headers.get('x-api-key')
    if (!key) return json({ error: 'Enter your API key to use the assistant.' }, 401)
    if (key.length > 256 || !/^[\x21-\x7e]+$/.test(key)) return json({ error: 'Check your API key.' }, 400)
    const result = await ask(kind, data.text, key, env.DEEPSEEK_MODEL || 'deepseek-flash')
    return json(result, 200)
  } catch {
    return json({ error: 'The assistant could not complete the request. Please try again or use the form.' }, 502)
  }
}
