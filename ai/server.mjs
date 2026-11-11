import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { askDeepSeek } from './navigator.mjs'

const port = Number(process.env.PORT || 3000)
const key = process.env.DEEPSEEK_API_KEY
const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash'
if (!key) throw new Error('Set DEEPSEEK_API_KEY before starting the AI navigator.')
const page = await readFile(new URL('../web/dist/index.html', import.meta.url))

createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page); return }
  if (req.method !== 'POST' || !['/api/intake', '/api/presentation'].includes(req.url)) { res.writeHead(404); res.end(); return }
  // Same-origin browser requests only. This development server is deliberately bound to localhost.
  if (req.headers.origin !== `http://localhost:${port}` && req.headers.origin !== `http://127.0.0.1:${port}`) { res.writeHead(403); res.end(); return }
  if (req.headers['content-type'] !== 'application/json') { res.writeHead(415); res.end(); return }
  try {
    let body = ''
    for await (const chunk of req) { body += chunk; if (body.length > 12000) throw new Error('Request too large') }
    const data = JSON.parse(body)
    if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000) throw new Error('Invalid request')
    const answer = await askDeepSeek(req.url === '/api/intake' ? 'intake' : 'presentation', data.text, key, model)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(answer))
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: 'The assistant could not complete the request. Please try again or use the form.' }))
  }
}).listen(port, '127.0.0.1', () => console.log(`AI navigator: http://localhost:${port}`))
