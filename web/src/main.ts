import { DATA } from './data.js'
import { blankState, demoState, formHtml, setPath, type Kind, type State } from './form.js'
import { reportHtml } from './report.js'

let state: State = demoState()

const dialog = document.getElementById('editor') as HTMLDialogElement
const formEl = document.getElementById('form') as HTMLFormElement
const reportEl = document.getElementById('report') as HTMLElement
const liveEl = document.getElementById('live') as HTMLElement

function renderForm(): void { formEl.innerHTML = formHtml(state) }
function renderReport(announce = true): void {
  reportEl.innerHTML = reportHtml(state)
  if (announce) liveEl.textContent = 'The report below has been updated.'
}

formEl.addEventListener('submit', e => {
  e.preventDefault()
  dialog.close()
})
formEl.addEventListener('change', e => {
  const t = e.target as HTMLInputElement | HTMLSelectElement
  const path = t.dataset.path
  if (!path) return
  setPath(state, path, (t.dataset.kind ?? 'enum') as Kind, t.value)
  if (t.hasAttribute('data-structural')) {
    const id = t.id
    renderForm()
    document.getElementById(id)?.focus()
  }
  renderReport()
})
formEl.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null
  if (!b) return
  state = b.dataset.action === 'demo' ? demoState() : blankState()
  renderForm()
  renderReport()
  document.getElementById(b.dataset.action === 'demo' ? 'role' : 'town')?.focus()
})
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('[data-action="edit"]')
  if (b) dialog.showModal()
})
;(document.getElementById('close') as HTMLButtonElement).addEventListener('click', () => dialog.close())

if (DATA.status.previewDrafts) {
  const bar = document.getElementById('preview') as HTMLElement
  bar.hidden = false
  bar.textContent = `Preview with draft rules not yet approved (${DATA.status.pendingDrafts.length} files). Not for decisions.`
}
;(document.getElementById('built') as HTMLElement).textContent = DATA.status.builtOn
renderForm()
renderReport(false)
