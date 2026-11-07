import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { approvalProblems, fileSha256 } from '../src/approvals.js'
import { checkDrafts, normalizeText, quoteProblems } from '../src/drafts.js'
import { loadRuleSet } from '../src/load-rules.js'
import { OFFER, SOURCE } from './fixtures.js'

const PROGRAM = { id: 'masssave_weatherization', name: 'P', administrator: 'A', handoff: { label: 'L', phone: null, url: 'https://www.masssave.com/' }, sources: [SOURCE] }
const DEC = { municipalities: [{ name: 'Boston', narrowedFor: [] }], sources: [SOURCE] }
const SNAPSHOT = 'Landlord offer\nAn instant incentive of 100% off\ninsulation upgrades for   your rental property\n'

/** A complete rules folder with one offer. Returns its path. */
function rulesDir(over: { offer?: object; snapshot?: string | null } = {}): string {
  const d = mkdtempSync(join(tmpdir(), 'rules-'))
  mkdirSync(join(d, 'offers'))
  mkdirSync(join(d, 'sources'))
  const files: Record<string, unknown> = {
    'programs.json': [PROGRAM], 'predicates.json': [], 'income-tables.json': [], 'dec.json': DEC,
    'caps.json': [], 'sequence.json': [], 'legal.json': [], 'offers/test.json': [over.offer ?? OFFER],
  }
  for (const [f, v] of Object.entries(files)) writeFileSync(join(d, f), JSON.stringify(v, null, 2))
  if (over.snapshot !== null) {
    writeFileSync(join(d, 'sources', 'landlord.txt'), over.snapshot ?? SNAPSHOT)
    writeFileSync(join(d, 'sources', 'landlord.meta.json'), JSON.stringify({ url: SOURCE.url, fetchedOn: '2026-11-06', sha256: 'x' }))
  }
  return d
}

function approveAll(d: string): void {
  const files = ['programs.json', 'predicates.json', 'income-tables.json', 'dec.json', 'caps.json', 'sequence.json', 'legal.json', 'offers/test.json']
  const ledger = files.map(file => ({ file, sha256: fileSha256(join(d, file)), draftedBy: 'model-draft', checkedOn: '2026-11-06', approvedBy: 'Qiao', approvedOn: '2026-11-06' }))
  writeFileSync(join(d, 'approvals.json'), JSON.stringify(ledger, null, 2))
}

describe('quote check: every quote must appear verbatim in the saved source', () => {
  test('whitespace and line breaks are normalized', () => {
    expect(normalizeText('a\n  b\t c')).toBe('a b c')
  })
  test('a quote present in the snapshot passes', () => {
    const d = rulesDir()
    expect(quoteProblems([OFFER], join(d, 'sources'))).toEqual([])
  })
  test('a quote missing from the snapshot fails', () => {
    const d = rulesDir()
    const bad = { ...OFFER, sources: [{ ...SOURCE, quote: 'An instant incentive of 90% off' }] }
    expect(quoteProblems([bad], join(d, 'sources'))).toEqual([
      `quote not found in snapshot of ${SOURCE.url}: "An instant incentive of 90% off"`,
    ])
  })
  test('a source with no saved snapshot fails', () => {
    const d = rulesDir({ snapshot: null })
    expect(quoteProblems([OFFER], join(d, 'sources'))).toEqual([`no saved snapshot for ${SOURCE.url}`])
  })
})

describe('checkDrafts: schema, data checks and quotes, before Qiao sees anything', () => {
  test('a good draft passes', () => {
    const active = rulesDir()
    const drafts = mkdtempSync(join(tmpdir(), 'drafts-'))
    mkdirSync(join(drafts, 'offers'))
    writeFileSync(join(drafts, 'offers', 'test.json'), JSON.stringify([OFFER]))
    const r = checkDrafts({ activeDir: active, draftsDir: drafts, sourcesDir: join(active, 'sources') })
    expect(r).toMatchObject({ ok: true, problems: [] })
    expect(r.files).toEqual([{ file: 'offers/test.json', sha256: fileSha256(join(drafts, 'offers', 'test.json')) }])
  })
  test('schema errors, data problems and missing quotes are all reported', () => {
    const active = rulesDir()
    const drafts = mkdtempSync(join(tmpdir(), 'drafts-'))
    mkdirSync(join(drafts, 'offers'))
    const bad = { ...OFFER, eligibility: { fact: 'unit.occupancyy', op: 'eq', value: 'renter' }, sources: [{ ...SOURCE, quote: 'not on the page' }] }
    writeFileSync(join(drafts, 'offers', 'test.json'), JSON.stringify([bad]))
    const r = checkDrafts({ activeDir: active, draftsDir: drafts, sourcesDir: join(active, 'sources') })
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual(expect.arrayContaining([
      'offer test_offer@1: unknown fact path unit.occupancyy',
      `quote not found in snapshot of ${SOURCE.url}: "not on the page"`,
    ]))
    const broken = mkdtempSync(join(tmpdir(), 'drafts-'))
    writeFileSync(join(broken, 'caps.json'), JSON.stringify([{ id: 'x' }]))
    expect(checkDrafts({ activeDir: active, draftsDir: broken, sourcesDir: join(active, 'sources') }).problems[0]).toMatch(/^schema:/)
  })
})

describe('approvals: only rules Qiao approved are loaded', () => {
  test('approved files load', () => {
    const d = rulesDir()
    approveAll(d)
    expect(loadRuleSet(d).offers).toHaveLength(1)
  })
  test('a file without an approval is refused', () => {
    const d = rulesDir()
    expect(() => loadRuleSet(d)).toThrow(/not approved: .*offers\/test.json/)
  })
  test('a file changed after approval is refused', () => {
    const d = rulesDir()
    approveAll(d)
    const f = join(d, 'offers', 'test.json')
    writeFileSync(f, readFileSync(f, 'utf8').replace('"Test"', '"Changed"'))
    expect(approvalProblems(d)).toEqual(['not approved: offers/test.json (changed since approval or never approved)'])
    expect(() => loadRuleSet(d)).toThrow(/not approved/)
  })
  test('drafts are never loaded', () => {
    const d = rulesDir()
    approveAll(d)
    mkdirSync(join(d, 'drafts', 'offers'), { recursive: true })
    writeFileSync(join(d, 'drafts', 'offers', 'extra.json'), JSON.stringify([{ ...OFFER, id: 'draft_only' }]))
    expect(loadRuleSet(d).offers.map(o => o.id)).toEqual(['test_offer'])
  })
  test('preview mode loads active rules overlaid with drafts, without approval (for the check report)', () => {
    const d = rulesDir()
    const drafts = mkdtempSync(join(tmpdir(), 'drafts-'))
    mkdirSync(join(drafts, 'offers'))
    writeFileSync(join(drafts, 'offers', 'test.json'), JSON.stringify([{ ...OFFER, title: 'Draft title' }]))
    expect(loadRuleSet(d, { requireApproval: false, overlayDir: drafts }).offers[0]?.title).toBe('Draft title')
  })
})
