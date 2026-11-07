// Builds dist/index.html: one standalone file (engine + rules + page), so it runs on any static host.
// Usage: node build.mjs [--preview-drafts]   (preview builds carry a banner on every screen and go to dist-preview/)
import { build } from 'esbuild'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const preview = process.argv.includes('--preview-drafts')
const out = preview ? 'dist-preview' : 'dist'
rmSync('.gen', { recursive: true, force: true })
mkdirSync('.gen', { recursive: true })

await build({ entryPoints: ['src/data-node.ts'], bundle: true, platform: 'node', format: 'esm', outfile: '.gen/data-node.mjs', logLevel: 'warning' })
const { loadData } = await import(pathToFileURL('.gen/data-node.mjs').href)
writeFileSync('.gen/data.json', JSON.stringify(loadData(preview)))

const js = await build({ entryPoints: ['src/main.ts'], bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true, write: false, logLevel: 'warning' })
const script = js.outputFiles[0].text.replaceAll('</script', '<\\/script')
const page = readFileSync('src/page.html', 'utf8')
const [head, body] = page.split('<!-- BODY -->')
mkdirSync(out, { recursive: true })
// Full document for static hosting, and a fragment for hosts that add their own skeleton.
writeFileSync(`${out}/index.html`, `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}</head>\n<body>\n${body}<script>${script}</script>\n</body>\n</html>\n`)
writeFileSync(`${out}/fragment.html`, `${head}${body}<script>${script}</script>\n`)
console.log(`wrote ${out}/index.html (${Math.round(script.length / 1024)} KB script)${preview ? ' — PREVIEW: draft rules, not for publishing' : ''}`)
