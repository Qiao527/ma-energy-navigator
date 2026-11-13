import { readFile } from 'node:fs/promises'
import { intakeSchema, validate } from '../ai/navigator.mjs'

const url = process.argv[2]
if (!url || new URL(url).protocol !== 'https:' || !new URL(url).hostname.endsWith('.vercel.app')) throw new Error('Pass the protected Vercel preview URL')
if (!process.env.DEEPSEEK_API_KEY || !process.env.VERCEL_OIDC_TOKEN) throw new Error('Set DEEPSEEK_API_KEY and VERCEL_OIDC_TOKEN in your environment')
const origin = new URL(url).origin
const cases = JSON.parse(await readFile(new URL('./intake-cases.json', import.meta.url), 'utf8'))
let passed = 0, incorrect = 0, invented = 0, unfilled = 0, failed = 0
for (const item of cases) {
  try {
    const response = await fetch(`${origin}/api/intake`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-API-Key': process.env.DEEPSEEK_API_KEY, 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN }, body: JSON.stringify({ text: item.text }), signal: AbortSignal.timeout(60000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const actual = await response.json()
    if (!validate(actual, intakeSchema)) throw new Error('Invalid response')
    const differences = Object.keys(item.expected).filter(key => actual[key] !== item.expected[key])
    if (!differences.length) passed++
    for (const key of differences) {
      incorrect++
      if (item.expected[key] === null && actual[key] !== null) invented++
      if (item.expected[key] !== null && actual[key] === null) unfilled++
    }
    console.log(`${differences.length ? 'FAIL' : 'PASS'} ${item.id}${differences.length ? `: ${differences.map(key => `${key}: expected ${JSON.stringify(item.expected[key])}, received ${JSON.stringify(actual[key])}`).join('; ')}` : ''}`)
  } catch (error) {
    failed++
    console.log(`ERROR ${item.id}: ${error.message.split('\n')[0]}`)
  }
}
console.log(JSON.stringify({ cases: cases.length, passed, incorrectFields: incorrect, unsupportedFacts: invented, missingKnownFacts: unfilled, requestErrors: failed }))
if (passed !== cases.length) process.exitCode = 1
