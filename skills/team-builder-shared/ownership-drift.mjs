#!/usr/bin/env node
// ownership-drift.mjs — keeps path ownership in one place.
//
// Ownership lives in manifest.routing[] and its table in instructions.md;
// code–doc pairs in manifest.codeDocSync[] and the c:codeDocSync table. Role
// files and manifest rules must not copy routing rows. Sync copies those texts
// verbatim, so nothing else would notice a stale copy.
//
// Pure functions; sync-agent-config.mjs reads the files and reports results.
// CLI: node ownership-drift.mjs --scan <project>  → routing rows named in role
//      files OUTSIDE ownership markers (for review; never a failure)
//      node ownership-drift.mjs --selftest

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const OWNERSHIP_OPEN = '<!-- ownership -->'
export const OWNERSHIP_CLOSE = '<!-- /ownership -->'
const CODE_DOC_OPEN = '<!-- c:codeDocSync -->'
const CODE_DOC_CLOSE = '<!-- /c:codeDocSync -->'

// What may stand right before or after a routing literal in prose. Anything
// else — a letter in any script, a digit, `/`, `[`, `*`, `<`… — continues the
// path, so the text names a longer path, not the routing row.
const BOUNDARY_BEFORE = /[\s`'"(]/
const BOUNDARY_AFTER = /[\s`'"),;:!?]/

// The literal forms of a routing row: `services/orders/**`, `services/orders/`, and for a
// nested row `services/gateway/docs` too. Single-segment forms are left out —
// `build.gradle` or `gradlew` read as ordinary words in prose.
export function routeForms(routePath) {
  const forms = new Set()
  const add = form => { if (form.includes('/')) forms.add(form) }
  add(routePath)
  // `a/b/**`, `a/b/*` and a plain `a/b` all name the directory `a/b/`.
  const base = routePath.replace(/\/\*\*?$/, '').replace(/\/$/, '')
  add(`${base}/`)
  add(base)
  return [...forms]
}

function containsForm(text, form) {
  let index = text.indexOf(form)
  while (index !== -1) {
    const end = index + form.length
    const beforeOk = index === 0 || BOUNDARY_BEFORE.test(text[index - 1])
    // A sentence may end on the path: `docs.` is the path, `docs.md` is not.
    const next = text[end] === '.' ? end + 1 : end
    const afterOk = next >= text.length || BOUNDARY_AFTER.test(text[next])
    if (beforeOk && afterOk) return true
    index = text.indexOf(form, index + 1)
  }
  return false
}

// Routing rows whose literal appears in `text`.
export function routeLiteralsIn(text, routing) {
  const found = []
  for (const route of routing ?? []) {
    if (typeof route?.path !== 'string') continue
    const hit = routeForms(route.path).find(form => containsForm(text, form))
    if (hit) found.push(hit)
  }
  return [...new Set(found)]
}

// Text between ownership marker pairs, or a problem when a pair is broken.
export function ownershipSpans(body) {
  const spans = []
  let from = 0
  for (;;) {
    const open = body.indexOf(OWNERSHIP_OPEN, from)
    const close = body.indexOf(OWNERSHIP_CLOSE, from)
    if (open === -1 && close === -1) return { spans }
    if (open === -1 || close < open) return { spans, problem: `${OWNERSHIP_CLOSE} without ${OWNERSHIP_OPEN}` }
    const nextOpen = body.indexOf(OWNERSHIP_OPEN, open + OWNERSHIP_OPEN.length)
    if (close === -1 || (nextOpen !== -1 && nextOpen < close)) {
      return { spans, problem: `${OWNERSHIP_OPEN} without ${OWNERSHIP_CLOSE}` }
    }
    spans.push(body.slice(open + OWNERSHIP_OPEN.length, close))
    from = close + OWNERSHIP_CLOSE.length
  }
}

const backticked = cell => [...cell.matchAll(/`([^`]+)`/g)].map(m => m[1])

function tableRows(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('|') && line.endsWith('|') && !/^\|[\s:|-]+\|$/.test(line))
    .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()))
}

function withoutBlock(text, open, close) {
  const start = text.indexOf(open)
  const end = text.indexOf(close)
  return start !== -1 && end > start ? text.slice(0, start) + text.slice(end + close.length) : text
}

const key = (a, b) => `${a} → ${b}`

function diffSets(expected, actual) {
  return {
    missing: [...expected].filter(k => !actual.has(k)),
    extra: [...actual].filter(k => !expected.has(k)),
  }
}

// Routing rows of the instructions.md table: the first cell only backticked
// paths (comma-separated), the second a single backticked role slug. The role
// need not exist — a row naming a removed role is exactly the drift to report.
const ROLE_SLUG = /^[a-z0-9][a-z0-9-]*$/
const ONLY_BACKTICKED = /^`[^`]+`(\s*,\s*`[^`]+`)*$/
export function routingTableDrift(instructions, manifest) {
  const actual = new Set()
  for (const cells of tableRows(withoutBlock(instructions, CODE_DOC_OPEN, CODE_DOC_CLOSE))) {
    if (cells.length !== 2 || !ONLY_BACKTICKED.test(cells[0])) continue
    const roles = backticked(cells[1])
    if (roles.length !== 1 || cells[1] !== `\`${roles[0]}\`` || !ROLE_SLUG.test(roles[0])) continue
    for (const p of backticked(cells[0])) actual.add(key(p, roles[0]))
  }
  const expected = new Set((manifest.routing ?? []).filter(r => r?.path && r?.role).map(r => key(r.path, r.role)))
  return { found: actual.size > 0, ...diffSets(expected, actual) }
}

// The c:codeDocSync table against manifest.codeDocSync. null when no block.
export function codeDocTableDrift(instructions, manifest) {
  const start = instructions.indexOf(CODE_DOC_OPEN)
  const end = instructions.indexOf(CODE_DOC_CLOSE)
  if (start === -1 || end < start) return null
  const actual = new Set()
  for (const cells of tableRows(instructions.slice(start, end))) {
    if (cells.length !== 2) continue
    const [code, doc] = cells.map(backticked)
    if (code.length === 1 && doc.length === 1 && cells[0] === `\`${code[0]}\`` && cells[1] === `\`${doc[0]}\``) {
      actual.add(key(code[0], doc[0]))
    }
  }
  const expected = new Set((manifest.codeDocSync ?? []).map(e => key(e.code, e.doc)))
  return diffSets(expected, actual)
}

// Routing rows a role file names outside its ownership markers. Not drift —
// a hand-written rule may name a path on purpose — but a migration shows them
// to the user, since sync never looks there.
export function literalsOutsideMarkers(body, routing) {
  let rest = body
  for (const span of ownershipSpans(body).spans) {
    rest = rest.replace(`${OWNERSHIP_OPEN}${span}${OWNERSHIP_CLOSE}`, '')
  }
  return routeLiteralsIn(rest, routing)
}

async function scan(projectArg) {
  const root = await fs.realpath(projectArg)
  const readInside = async relative => {
    const real = await fs.realpath(path.join(root, relative))
    if (!real.startsWith(root + path.sep)) throw new Error(`${relative} resolves outside the project; not read`)
    return fs.readFile(real, 'utf8')
  }
  const manifest = JSON.parse(await readInside('.agent-source/agents/manifest.json'))
  let any = false
  for (const agent of manifest.agents ?? []) {
    const relative = `.agent-source/agents/${agent.name}.md`
    const body = await readInside(relative).catch(() => null)
    if (body === null) continue
    const hits = literalsOutsideMarkers(body, manifest.routing)
    if (hits.length) {
      any = true
      console.log(`${relative}: outside ownership markers names ${hits.map(h => `\`${h}\``).join(', ')}`)
    }
  }
  if (!any) console.log('no routing rows outside ownership markers')
}

// Every finding as one line, for sync to report.
export function ownershipDrift({ manifest, instructions, roleFiles }) {
  const out = []
  const routing = manifest.routing ?? []
  for (const [name, body] of Object.entries(roleFiles)) {
    const where = `.agent-source/agents/${name}.md`
    const { spans, problem } = ownershipSpans(body)
    if (problem) out.push(`${where}: ${problem}`)
    const hits = routeLiteralsIn(spans.join('\n'), routing)
    if (hits.length) out.push(`${where}: ownership section names routing rows ${hits.map(h => `\`${h}\``).join(', ')} — say "the routing table in instructions.md" instead`)
  }
  for (const agent of manifest.agents ?? []) {
    for (const field of ['rules', 'extra_instructions']) {
      for (const line of agent?.[field] ?? []) {
        const hits = routeLiteralsIn(String(line), routing)
        if (hits.length) out.push(`manifest agents["${agent.name}"].${field} names routing rows ${hits.map(h => `\`${h}\``).join(', ')}: ${JSON.stringify(line)}`)
      }
    }
  }
  if (instructions !== null) {
    const where = '.agent-source/project/instructions.md'
    const table = routingTableDrift(instructions, manifest)
    if (table.found) {
      for (const k of table.missing) out.push(`${where}: routing table lacks ${k}`)
      for (const k of table.extra) out.push(`${where}: routing table has ${k}, not in the manifest`)
    }
    const docs = codeDocTableDrift(instructions, manifest)
    if (docs) {
      for (const k of docs.missing) out.push(`${where}: code–doc table lacks ${k}`)
      for (const k of docs.extra) out.push(`${where}: code–doc table has ${k}, not in the manifest`)
    }
  }
  return out
}

function selftest() {
  const assert = (ok, msg) => { if (!ok) throw new Error(`SELFTEST FAIL: ${msg}`) }
  const manifest = {
    agents: [{ name: 'dev', rules: [] }, { name: 'analyst', rules: [] }, { name: 'architect' }],
    routing: [
      { path: 'services/orders/**', role: 'dev' },
      { path: 'services/gateway/docs/**', role: 'analyst' },
      { path: 'services/gateway/docs/README.md', role: 'dev' },
      { path: 'build.gradle', role: 'dev' },
    ],
    codeDocSync: [{ code: 'services/gateway/src/**', doc: 'services/gateway/docs/README.md' }],
  }
  const hits = text => routeLiteralsIn(text, manifest.routing)

  assert(hits('write `services/orders/**` only').length === 1, 'a glob row is caught')
  assert(hits('under services/orders/ only').length === 1, 'the directory form is caught')
  assert(hits('see services/gateway/docs.').length === 1, 'the bare nested form is caught')
  assert(hits('`services/gateway/docs/README.md` is yours').length === 1, 'a file row is caught')
  assert(hits('write `services/gateway/docs/<api>/sources/`').length === 0, 'a deeper domain path is not caught')
  assert(hits('services/orders/src/main').length === 0, 'a deeper code path is not caught')
  assert(hits('edit build.gradle and run ./gradlew').length === 0, 'single-segment rows are not searched')
  assert(hits('`services/orders/[id]/page.tsx` and services/orders/şema.md').length === 0, 'deeper paths with any segment character are not caught')
  assert(hits("services/orders'a yaz").length === 1, 'a Turkish suffix after the bare form is still the row')
  assert(routeLiteralsIn('only under `apps/web/`', [{ path: 'apps/web', role: 'dev' }]).length === 1, 'a plain directory route has a directory form')
  assert(hits('xservices/orders/** stays').length === 0, 'a longer name ending the same way is not caught')

  const { spans, problem } = ownershipSpans(`a ${OWNERSHIP_OPEN} x ${OWNERSHIP_CLOSE} b ${OWNERSHIP_OPEN} y ${OWNERSHIP_CLOSE}`)
  assert(!problem && spans.length === 2, 'two marker pairs give two spans')
  assert(ownershipSpans(`${OWNERSHIP_OPEN} x`).problem, 'an unclosed pair is a problem')
  assert(ownershipSpans(`${OWNERSHIP_CLOSE} ${OWNERSHIP_OPEN}`).problem, 'an inverted pair is a problem')

  const table = [
    '| Yol | Sahibi |', '|---|---|',
    '| `services/orders/**` | `dev` |', '| `services/gateway/docs/**` | `analyst` |',
    '| `services/gateway/docs/README.md` | `dev` |', '| `build.gradle`, `gradle/**` | `dev` |',
    '| `dev` | Geliştirici |',
    CODE_DOC_OPEN, '| Kod | Doküman |', '|---|---|',
    '| `services/gateway/src/**` | `services/gateway/docs/README.md` |', CODE_DOC_CLOSE,
  ].join('\n')
  const drift = routingTableDrift(table, manifest)
  assert(drift.found && drift.missing.length === 0, `no row missing, got ${drift.missing}`)
  assert(drift.extra.length === 1 && drift.extra[0] === 'gradle/** → dev', `an extra row is reported, got ${drift.extra}`)
  const docs = codeDocTableDrift(table, manifest)
  assert(docs.missing.length === 0 && docs.extra.length === 0, 'matching code–doc table is clean')
  assert(codeDocTableDrift('no block', manifest) === null, 'no block, no check')
  const stale = routingTableDrift(`${table}\n| \`services/orders/private/**\` | \`retired-dev\` |`, manifest)
  assert(stale.extra.includes('services/orders/private/** → retired-dev'), `a row naming a removed role is reported, got ${stale.extra}`)
  const missingRow = routingTableDrift(table.replace('| `services/orders/**` | `dev` |\n', ''), manifest)
  assert(missingRow.missing.length === 1 && missingRow.missing[0] === 'services/orders/** → dev', `a missing row is reported, got ${missingRow.missing}`)
  const wrongDoc = codeDocTableDrift(table.replace('| `services/gateway/src/**` | `services/gateway/docs/README.md` |', '| `services/gateway/src/**` | `docs/other.md` |'), manifest)
  assert(wrongDoc.missing.length === 1 && wrongDoc.extra.length === 1, `a changed code–doc row is reported both ways, got ${JSON.stringify(wrongDoc)}`)
  const inBlock = routingTableDrift(table.replace(CODE_DOC_CLOSE, `| \`services/gateway/src/**\` | \`dev\` |\n${CODE_DOC_CLOSE}`), manifest)
  assert(!inBlock.extra.some(k => k.startsWith('services/gateway/src/**')), 'a row inside the code–doc block is not a routing row')
  assert(!routingTableDrift('no table', manifest).found, 'an old instructions.md without a table is not a mismatch')

  const roleFiles = {
    dev: `# Dev\n${OWNERSHIP_OPEN}\nYazma alanın routing tablosundadır.\n${OWNERSHIP_CLOSE}\n## Standart\n\`services/orders/**\` altında Gradle kullan.\n`,
    analyst: `${OWNERSHIP_OPEN}\n\`services/gateway/docs/**\` senin.\n${OWNERSHIP_CLOSE}`,
  }
  const report = ownershipDrift({
    manifest: { ...manifest, agents: [{ name: 'dev', rules: ['Yalnız `services/orders/**` altına yaz.', 'Kaynakları `services/gateway/docs/<api>/sources/` altında tut.'] }, { name: 'analyst' }, { name: 'architect' }] },
    instructions: table.replace('| `build.gradle`, `gradle/**` | `dev` |', '| `build.gradle` | `dev` |'),
    roleFiles,
  })
  assert(report.length === 2, `analyst span and one dev rule, got ${JSON.stringify(report)}`)
  assert(report.some(l => l.startsWith('.agent-source/agents/analyst.md')), 'a row inside markers is reported')
  assert(!report.some(l => l.startsWith('.agent-source/agents/dev.md')), 'a row outside markers is not reported')
  assert(report.some(l => l.includes('rules') && l.includes('services/orders/**')), 'a row in manifest rules is reported')
  const outside = literalsOutsideMarkers(roleFiles.dev, manifest.routing)
  assert(outside.length === 1 && outside[0] === 'services/orders/**', `a row outside markers is listed by the scan, got ${outside}`)
  assert(literalsOutsideMarkers(roleFiles.analyst, manifest.routing).length === 0, 'a row inside markers is not listed by the scan')
  console.log('SELFTEST PASS')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const args = process.argv.slice(2)
  if (args[0] === '--selftest') selftest()
  else if (args[0] === '--scan' && args.length === 2) {
    scan(args[1]).catch(error => { console.error(error.message); process.exitCode = 1 })
  } else {
    console.error('Usage: node ownership-drift.mjs --scan <project> | --selftest')
    process.exitCode = 2
  }
}
