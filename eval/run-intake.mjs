import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { intakeSchema, validate } from '../ai/navigator.mjs'

const exec = promisify(execFile)
const url = process.argv[2]
if (!url || new URL(url).protocol !== 'https:' || !new URL(url).hostname.endsWith('.vercel.app')) throw new Error('Pass the protected Vercel preview URL')
const origin = new URL(url).origin
const cases = JSON.parse(await readFile(new URL('./intake-cases.json', import.meta.url), 'utf8'))
let passed = 0, incorrect = 0, invented = 0, unfilled = 0, failed = 0
for (const item of cases) {
  try {
    const { stdout } = await exec('vercel', ['curl', `${origin}/api/intake`, '--', '--silent', '--show-error', '--fail-with-body', '--request', 'POST', '--header', 'Content-Type: application/json', '--header', `Origin: ${origin}`, '--data', JSON.stringify({ text: item.text })], { timeout: 60000, maxBuffer: 65536 })
    const actual = JSON.parse(stdout)
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
