#!/usr/bin/env node
// work-board.mjs — .agent-work/ plans → static HTML kanban board.
//
// The plan gate (plan-gate.md) keeps every piece of work as a Markdown file whose
// folder is its state: inbox/ → draft/ → approved/ → in-progress/ → done/. This script
// only reads those folders and renders a self-contained HTML page (no external
// assets), one column per folder. It never writes into .agent-work/, so it works the
// same whichever ecosystem (Claude, Codex, OpenCode) moved the files.
//
// Parsing is lenient on purpose: the board is a viewer, not a validator
// (validate-plan-gate.mjs and the work-plan skill own the rules). A file it cannot
// read still shows up as a card with its file name.
//
// Two modes:
//   - file (default): writes one snapshot HTML file.
//   - --serve: a local server (127.0.0.1 only) that watches .agent-work/ and pushes the
//     board to open pages over Server-Sent Events the moment a plan file is added,
//     moved or edited. Nothing is re-rendered or sent while nothing changes.
//
// CLI: node work-board.mjs [--root <project>] [--out <file>] [--serve] [--port <n>] [--selftest]
//   --root   project root holding .agent-work/ (default: cwd)
//   --out    file mode output (default: <root>/agent-work-board.html)
//   --port   --serve port (default 4780; the next free one is taken when busy)

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { watch } from 'node:fs'

const COLUMNS = [
  { key: 'inbox', title: 'Gelen kutusu' },
  { key: 'draft', title: 'Taslak' },
  { key: 'approved', title: 'Onaylı' },
  { key: 'in-progress', title: 'Devam ediyor' },
  { key: 'done', title: 'Bitti' },
]
const PROGRESS_SENTINEL = '<!-- progress:not-started -->'

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

function unquote(value) {
  const v = value.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

function inlineList(value) {
  const v = value.trim()
  if (!v.startsWith('[') || !v.endsWith(']')) return null
  return v.slice(1, -1).split(',').map(unquote).filter(Boolean)
}

// Only what the board shows: top-level scalars, `paths` (inline or block list) and the
// verdict history under `reviews`. Not a YAML parser.
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!match) return { data: {}, body: text }
  const lines = match[1].split(/\r?\n/)
  const data = {}
  for (let i = 0; i < lines.length; i++) {
    const top = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i])
    if (!top) continue
    const [, key, rest] = top
    if (key === 'paths') {
      data.paths = inlineList(rest) ?? []
      while (!rest.trim() && /^\s+-\s+/.test(lines[i + 1] ?? '')) data.paths.push(unquote(lines[++i].replace(/^\s+-\s+/, '')))
    } else if (key === 'reviews') {
      let block = ''
      while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) block += lines[++i] + '\n'
      data.reviews = parseReviews(block)
    } else {
      data[key] = unquote(rest)
    }
  }
  return { data, body: text.slice(match[0].length) }
}

// Each review record carries exactly one `revision` and one `verdict`; pairing them by
// order is enough to know the latest decision and the revision it was made on.
function parseReviews(block) {
  const reviews = { 'plan-review': [], 'code-review': [] }
  const parts = block.split(/^\s*(plan-review|code-review):/m)
  for (let i = 1; i < parts.length; i += 2) {
    const verdicts = [...parts[i + 1].matchAll(/verdict:\s*([a-z]+)/g)].map(m => m[1])
    const revisions = [...parts[i + 1].matchAll(/revision:\s*(\d+)/g)].map(m => Number(m[1]))
    reviews[parts[i]] = verdicts.map((verdict, n) => ({ verdict, revision: revisions[n] }))
  }
  return reviews
}

export function parseProgress(body) {
  const idx = body.indexOf('<!-- s:progress -->')
  if (idx === -1) return { started: false, done: 0, total: 0, text: '' }
  const section = body.slice(idx + '<!-- s:progress -->'.length).split(/<!-- s:[a-z-]+ -->/)[0]
  const text = section.replace(/^\s*#+ .*$/m, '').replace(PROGRESS_SENTINEL, '').trim()
  const done = (section.match(/^\s*[-*] \[[xX]\]/gm) || []).length
  const open = (section.match(/^\s*[-*] \[ \]/gm) || []).length
  return { started: !section.includes(PROGRESS_SENTINEL) && !!text, done, total: done + open, text }
}

function lastReview(list = [], planRevision) {
  const last = list[list.length - 1]
  if (!last) return null
  return { ...last, stale: !!planRevision && !!last.revision && last.revision !== planRevision }
}

export async function loadPlan(file, column) {
  let text = ''
  try {
    text = await fs.readFile(file, 'utf8')
  } catch (err) {
    console.warn(`[work-board] skipped ${file}: ${err.message}`)
  }
  const { data, body } = parseFrontmatter(text)
  const revision = Number(data.revision) || 0
  return {
    file: path.basename(file),
    column,
    id: data.id || path.basename(file, '.md'),
    title: data.title || path.basename(file, '.md'),
    revision,
    created: data.created || '',
    source: data.source || '',
    domain: data.domain || '',
    executor: data.executor || '',
    paths: data.paths || [],
    adr: data.adr || '',
    cancelled: data.outcome === 'cancelled',
    planReview: lastReview(data.reviews?.['plan-review'], revision),
    codeReview: lastReview(data.reviews?.['code-review'], revision),
    progress: parseProgress(body),
    body,
  }
}

export async function loadBoard(root) {
  const workDir = path.join(root, '.agent-work')
  try {
    await fs.access(workDir)
  } catch {
    return null
  }
  const plans = []
  for (const col of COLUMNS) {
    let files = []
    try {
      files = (await fs.readdir(path.join(workDir, col.key))).filter(f => f.endsWith('.md') && !f.startsWith('.'))
    } catch {
      continue
    }
    for (const f of files.sort()) plans.push(await loadPlan(path.join(workDir, col.key, f), col.key))
  }
  return { root, plans }
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inlineMd(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
}

// Just enough Markdown for plan bodies: headings, lists, checkboxes, fenced code,
// paragraphs. Everything is escaped first; HTML comments (the s:* markers) are dropped.
export function renderMarkdown(md) {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n').split('\n')
  const out = []
  let list = null
  let para = []
  const flushPara = () => { if (para.length) out.push(`<p>${para.map(inlineMd).join('<br>')}</p>`); para = [] }
  const closeList = () => { if (list) out.push(`</${list}>`); list = null }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      flushPara(); closeList()
      const code = []
      while (i + 1 < lines.length && !/^\s*```/.test(lines[i + 1])) code.push(lines[++i])
      i++
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushPara(); closeList()
      const level = Math.min(heading[1].length + 2, 6)
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`)
      continue
    }
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line)
    if (item) {
      flushPara()
      const tag = item[1] ? 'ul' : 'ol'
      if (list !== tag) { closeList(); out.push(`<${tag}>`); list = tag }
      const check = /^\[([ xX])\]\s*(.*)$/.exec(item[3])
      out.push(check
        ? `<li class="task"><input type="checkbox" disabled${check[1] === ' ' ? '' : ' checked'}> ${inlineMd(check[2])}</li>`
        : `<li>${inlineMd(item[3])}</li>`)
      continue
    }
    if (!line.trim()) { flushPara(); closeList(); continue }
    closeList()
    para.push(line.trim())
  }
  flushPara(); closeList()
  return out.join('\n')
}

function renderDetail(plan) {
  const review = (label, list) => list
    ? `<tr><th>${label}</th><td>${esc(VERDICT_TEXT[list.verdict] || list.verdict)}${list.revision ? ` (r${list.revision}${list.stale ? ', güncel değil' : ''})` : ''}</td></tr>`
    : ''
  const rows = [
    ['Durum', COLUMNS.find(c => c.key === plan.column).title + (plan.cancelled ? ' · iptal' : '')],
    ['Executor', plan.executor], ['Revizyon', plan.revision || ''], ['Alan', plan.domain],
    ['Kaynak', plan.source], ['Oluşturuldu', plan.created], ['ADR', plan.adr],
    ['Yollar', plan.paths.join(', ')], ['Dosya', `.agent-work/${plan.column}/${plan.file}`],
  ].filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')
  const body = renderMarkdown(plan.body).trim()
  return `<template data-id="${esc(plan.id)}"><header class="d-head"><span class="id">${esc(plan.id)}</span><h2>${esc(plan.title)}</h2></header>
<table class="meta-table">${rows}${review('Plan denetimi', plan.planReview)}${review('Kod denetimi', plan.codeReview)}</table>
<div class="md">${body || '<p class="muted">Plan gövdesi yok.</p>'}</div></template>`
}

// `executor` may be `<agent>` or the older `<ecosystem>/<agent>` form.
function agentOf(executor) {
  return executor.includes('/') ? executor.split('/').pop() : executor
}

function hue(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) % 360
  return h
}
function agentStyle(name) {
  return `--agent: hsl(${hue(name)} 55% 50%)`
}

const VERDICT_TEXT = { approved: 'onaylandı', rejected: 'reddedildi', skipped: 'atlandı' }
function reviewBadge(label, review) {
  if (!review) return ''
  const stale = review.stale ? ` · r${review.revision}, güncel değil` : ''
  return `<span class="badge v-${esc(review.verdict)}${review.stale ? ' stale' : ''}" title="${label}: ${esc(review.verdict)}${stale}">${label}: ${esc(VERDICT_TEXT[review.verdict] || review.verdict)}${review.stale ? ' ⟲' : ''}</span>`
}

function renderCard(plan) {
  const agent = agentOf(plan.executor)
  const owner = agent
    ? `<span class="agent" style="${agentStyle(agent)}">${esc(plan.executor)}</span>`
    : plan.column === 'inbox' ? '' : '<span class="agent none">executor yok</span>'
  const meta = [
    plan.revision ? `r${plan.revision}` : '',
    plan.domain ? esc(plan.domain) : '',
    plan.source ? `kaynak: ${esc(plan.source)}` : '',
    plan.created ? esc(plan.created) : '',
    plan.adr ? `ADR: ${esc(plan.adr)}` : '',
  ].filter(Boolean).join(' · ')
  const badges = [
    plan.cancelled ? '<span class="badge v-rejected">iptal</span>' : '',
    reviewBadge('plan', plan.planReview),
    reviewBadge('kod', plan.codeReview),
  ].join('')
  const p = plan.progress
  const bar = p.total ? `<div class="bar" title="${p.done}/${p.total} adım"><span style="width:${Math.round((p.done / p.total) * 100)}%"></span></div>` : ''
  const progress = p.started
    ? `${bar}<details><summary>İlerleme${p.total ? ` ${p.done}/${p.total}` : ''}</summary><p class="pre">${esc(p.text)}</p></details>`
    : ''
  const paths = plan.paths.length
    ? `<details><summary>${plan.paths.length} yol</summary><p class="pre">${plan.paths.map(esc).join('\n')}</p></details>`
    : ''
  const search = esc(`${plan.id} ${plan.title} ${plan.executor} ${plan.domain} ${plan.paths.join(' ')}`.toLowerCase())
  return `<article class="card${plan.cancelled ? ' cancelled' : ''}" data-id="${esc(plan.id)}" tabindex="0" data-agent="${esc(agent)}" data-search="${search}" title="Ayrıntı için tıklayın — ${esc(plan.file)}">
  <header><span class="id">${esc(plan.id)}</span>${owner}</header>
  <h3>${esc(plan.title)}</h3>
  ${meta ? `<p class="meta">${meta}</p>` : ''}
  ${badges.trim() ? `<div class="badges">${badges}</div>` : ''}
  ${progress}${paths}
</article>`
}

// The part of the page that changes with the plans; --serve pushes only this.
export function renderBoard(board, root = '') {
  if (!board) {
    return `<p class="empty-state"><code>${esc(path.join(root, '.agent-work'))}</code> bulunamadı.<br>
Plan kapısı açık bir projenin kökünde çalıştırın ya da <code>--root</code> verin.</p>`
  }
  const buckets = Object.fromEntries(COLUMNS.map(c => [c.key, []]))
  for (const plan of board.plans) buckets[plan.column].push(plan)
  const finished = buckets.done.filter(p => !p.cancelled).length
  const active = board.plans.filter(p => !p.cancelled).length
  const pct = active ? Math.round((finished / active) * 100) : 0
  const agents = [...new Set(board.plans.map(p => agentOf(p.executor)).filter(Boolean))].sort()
  return `<div class="head">
  <h1>${esc(path.basename(path.resolve(board.root)))}</h1>
  <div class="progress" title="${finished}/${active} bitti"><span style="width:${pct}%"></span></div>
  <span class="muted">${finished}/${active} bitti${board.plans.length - active ? ` · ${board.plans.length - active} iptal` : ''}</span>
</div>
<div class="filters">
  <button class="chip on" data-agent-filter="">Hepsi</button>
  ${agents.map(a => `<button class="chip" data-agent-filter="${esc(a)}" style="${agentStyle(a)}">${esc(a)}</button>`).join('\n  ')}
</div>
<div class="board">
${COLUMNS.map(col => `<section class="col col-${col.key}">
  <h2>${col.title} <span class="count">${buckets[col.key].length}</span></h2>
  ${buckets[col.key].map(renderCard).join('\n') || '<p class="empty">—</p>'}
</section>`).join('\n')}
</div>
${board.plans.map(renderDetail).join('\n')}`
}

function stamp(date) {
  return date.toLocaleString('tr-TR')
}

export function renderHtml(board, { generatedAt = new Date(), root = '', live = false } = {}) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Work Board</title>
<style>
:root {
  --bg: #f6f7f9; --panel: #eceef2; --card: #fff; --text: #1d2129; --muted: #6b7280; --line: #d9dde3;
  --accent: #2f6fde; --ok: #2e9e5b; --bad: #d64545; --warn: #b7791f;
  --col-inbox: #8a94a6; --col-draft: #b7791f; --col-approved: #8250df; --col-in-progress: #2f6fde; --col-done: #2e9e5b;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #14161a; --panel: #1c1f25; --card: #252931; --text: #e6e8eb; --muted: #9aa1ad; --line: #343944;
  }
}
:root[data-theme="dark"] { --bg: #14161a; --panel: #1c1f25; --card: #252931; --text: #e6e8eb; --muted: #9aa1ad; --line: #343944; }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--text);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.top { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 16px; }
.top input { flex: 1 1 200px; max-width: 320px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px;
  background: var(--card); color: var(--text); font: inherit; }
.muted { color: var(--muted); font-size: 12px; }
.head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.head h1 { font-size: 20px; margin: 0; }
.progress, .bar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
.progress { width: 160px; }
.bar { margin: 6px 0 2px; height: 4px; }
.progress span, .bar span { display: block; height: 100%; background: var(--ok); }
.filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.chip { border: 1px solid var(--line); background: var(--card); color: var(--text); border-radius: 999px;
  padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer; border-left: 4px solid var(--agent, var(--line)); }
.chip.on { outline: 2px solid var(--accent); outline-offset: 1px; }
.board { display: grid; grid-template-columns: repeat(5, minmax(210px, 1fr)); gap: 12px; overflow-x: auto; }
.col { background: var(--panel); border-radius: 8px; padding: 10px; min-height: 120px; border-top: 3px solid var(--col-color); }
.col-inbox { --col-color: var(--col-inbox); } .col-draft { --col-color: var(--col-draft); }
.col-approved { --col-color: var(--col-approved); } .col-in-progress { --col-color: var(--col-in-progress); }
.col-done { --col-color: var(--col-done); }
.col h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; margin: 0 0 10px; display: flex; justify-content: space-between; }
.count { color: var(--muted); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
.card header { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.card h3 { font-size: 14px; margin: 4px 0; font-weight: 600; overflow-wrap: anywhere; }
.col-done .card h3, .cancelled h3 { color: var(--muted); }
.cancelled h3 { text-decoration: line-through; }
.id { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.agent { color: var(--agent); font-weight: 600; overflow-wrap: anywhere; text-align: right; }
.agent::before { content: "●"; margin-right: 4px; }
.agent.none { color: var(--muted); font-weight: 400; }
.meta { margin: 0; font-size: 12px; color: var(--muted); }
.badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.badge { font-size: 11px; border-radius: 4px; padding: 1px 6px; border: 1px solid currentColor; }
.v-approved { color: var(--ok); } .v-rejected { color: var(--bad); } .v-skipped { color: var(--muted); }
.badge.stale { color: var(--warn); border-style: dashed; }
details { font-size: 12px; color: var(--muted); margin-top: 4px; }
summary { cursor: pointer; }
.pre { white-space: pre-wrap; margin: 4px 0 0; overflow-wrap: anywhere; }
.empty { color: var(--muted); text-align: center; }
.empty-state { color: var(--muted); text-align: center; margin-top: 15vh; }
.live::before { content: "●"; margin-right: 4px; color: var(--muted); }
.live.on::before { color: var(--ok); }
.live.off::before { color: var(--bad); }
.hidden { display: none; }
.card { cursor: pointer; }
.card:hover, .card:focus-visible { border-color: var(--accent); outline: none; }
dialog { width: min(760px, calc(100vw - 32px)); max-height: calc(100vh - 48px); border: 1px solid var(--line);
  border-radius: 10px; padding: 20px 24px; background: var(--card); color: var(--text); }
dialog::backdrop { background: rgb(0 0 0 / .45); }
.close { position: sticky; top: 0; float: right; border: 0; background: none; color: var(--muted); font-size: 24px; line-height: 1; cursor: pointer; }
.d-head h2 { margin: 2px 0 12px; font-size: 18px; }
.meta-table { border-collapse: collapse; font-size: 13px; margin-bottom: 12px; width: 100%; }
.meta-table th { text-align: left; color: var(--muted); font-weight: 500; padding: 3px 12px 3px 0; white-space: nowrap; vertical-align: top; width: 1%; }
.meta-table td { padding: 3px 0; overflow-wrap: anywhere; }
.md { border-top: 1px solid var(--line); padding-top: 4px; }
.md h3, .md h4, .md h5, .md h6 { margin: 16px 0 6px; font-size: 15px; }
.md p, .md ul, .md ol { margin: 6px 0; }
.md li.task { list-style: none; margin-left: -18px; }
.md code { background: var(--panel); border-radius: 4px; padding: 0 4px; font-size: 12px; }
.md pre { background: var(--panel); border-radius: 6px; padding: 10px; overflow-x: auto; }
.md pre code { background: none; padding: 0; }
@media (max-width: 720px) { .board { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="top">
  <input id="q" type="search" placeholder="Plan ara…" aria-label="Plan ara">
  ${live
    ? `<span id="live" class="muted live">Bağlanıyor…</span>`
    : `<span class="muted">Anlık görüntü: ${esc(stamp(generatedAt))} · canlı pano için <code>--serve</code></span>`}
</div>
<div id="app">${renderBoard(board, root)}</div>
<dialog id="detail"><button class="close" aria-label="Kapat">×</button><div id="detail-body"></div></dialog>
<script>
(() => {
  const store = {
    get(k) { try { return localStorage.getItem(k) } catch { return null } },
    set(k, v) { try { localStorage.setItem(k, v) } catch {} },
  }
  const app = document.getElementById('app')
  const q = document.getElementById('q')
  const dialog = document.getElementById('detail')
  let agent = ''
  let openId = null
  function apply() {
    const term = q.value.trim().toLowerCase()
    for (const card of app.querySelectorAll('.card')) {
      const ok = (!agent || card.dataset.agent === agent) && (!term || card.dataset.search.includes(term))
      card.classList.toggle('hidden', !ok)
    }
    for (const chip of app.querySelectorAll('.chip')) chip.classList.toggle('on', chip.dataset.agentFilter === agent)
    store.set('tb-work-board', JSON.stringify({ q: q.value, agent }))
  }
  function template(id) {
    return [...app.querySelectorAll('template')].find(t => t.dataset.id === id)
  }
  function showDetail(id) {
    const tpl = template(id)
    if (!tpl) return false
    document.getElementById('detail-body').replaceChildren(tpl.content.cloneNode(true))
    return true
  }
  function open(card) {
    if (!showDetail(card.dataset.id)) return
    openId = card.dataset.id
    dialog.showModal()
  }
  try {
    const saved = JSON.parse(store.get('tb-work-board') || '{}')
    q.value = saved.q || ''
    agent = saved.agent || ''
  } catch {}
  dialog.querySelector('.close').addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close() })
  dialog.addEventListener('close', () => { openId = null })
  document.addEventListener('keydown', e => {
    const card = e.target.closest && e.target.closest('.card')
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(card) }
  })
  document.addEventListener('click', e => {
    const card = e.target.closest('.card')
    if (card && !e.target.closest('details')) return open(card)
    const chip = e.target.closest('.chip')
    if (!chip) return
    agent = chip.dataset.agentFilter
    apply()
  })
  q.addEventListener('input', apply)
  apply()

  // --serve: the server pushes the new board on every change; an open plan stays open
  // and shows its new content.
  const live = document.getElementById('live')
  if (!live) return
  const events = new EventSource('events')
  events.addEventListener('board', e => {
    const msg = JSON.parse(e.data)
    app.innerHTML = msg.html
    apply()
    if (openId && dialog.open) showDetail(openId)
    live.className = 'muted live on'
    live.textContent = 'Canlı · son değişiklik ' + msg.at
  })
  events.onerror = () => {
    live.className = 'muted live off'
    live.textContent = 'Bağlantı koptu — sunucu çalışıyor mu? Yeniden deneniyor…'
  }
})()
</script>
</body>
</html>
`
}

// ---------------------------------------------------------------------------
// serve
// ---------------------------------------------------------------------------

// Cheap change detector: names, sizes and mtimes of the plan files. The board is only
// re-read and re-rendered when this changes.
async function signature(root) {
  const parts = []
  for (const col of COLUMNS) {
    const dir = path.join(root, '.agent-work', col.key)
    let files = []
    try {
      files = (await fs.readdir(dir)).filter(f => f.endsWith('.md')).sort()
    } catch {
      parts.push(`${col.key}:-`)
      continue
    }
    for (const f of files) {
      try {
        const st = await fs.stat(path.join(dir, f))
        parts.push(`${col.key}/${f}:${st.size}:${st.mtimeMs}`)
      } catch {
        // moved between readdir and stat; the next check sees where it went
      }
    }
  }
  return parts.join('|')
}

export async function startServer({ root, port = 4780, strictPort = false, pollMs = 2000 }) {
  const clients = new Set()
  let fragment = renderBoard(await loadBoard(root), root)
  let changedAt = stamp(new Date())
  let sig = await signature(root)
  let checking = null

  const send = res => res.write(`event: board\ndata: ${JSON.stringify({ html: fragment, at: changedAt })}\n\n`)

  async function check() {
    const next = await signature(root)
    if (next === sig) return
    sig = next
    fragment = renderBoard(await loadBoard(root), root)
    changedAt = stamp(new Date())
    for (const res of clients) send(res)
  }
  // Serialize checks; a burst of fs events collapses into one.
  function schedule() {
    if (checking) return
    checking = new Promise(r => setTimeout(r, 100))
      .then(check)
      .catch(err => console.error(`[work-board] ${err.message}`))
      .finally(() => { checking = null })
  }

  // fs.watch gives the instant reaction; the slow poll covers platforms or folders
  // (created later, network drives) where it stays silent.
  const watchers = []
  const workDir = path.join(root, '.agent-work')
  for (const dir of [workDir, ...COLUMNS.map(c => path.join(workDir, c.key))]) {
    try {
      watchers.push(watch(dir, schedule))
    } catch {
      // folder missing; the poll picks it up once it exists
    }
  }
  const poll = setInterval(schedule, pollMs)
  const heartbeat = setInterval(() => { for (const res of clients) res.write(': ping\n\n') }, 25000)

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/') {
      loadBoard(root).then(board => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(renderHtml(board, { root, live: true }))
      }).catch(err => { res.writeHead(500); res.end(err.message) })
    } else if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
      clients.add(res)
      send(res)
      req.on('close', () => clients.delete(res))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  // Only this machine: the board shows plan contents.
  const listen = p => new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(p, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })
  for (let p = port, tries = 0; ; p++, tries++) {
    try {
      await listen(p)
      break
    } catch (err) {
      if (err.code !== 'EADDRINUSE' || strictPort || port === 0 || tries >= 20) throw err
    }
  }

  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    async close() {
      clearInterval(poll)
      clearInterval(heartbeat)
      for (const w of watchers) w.close()
      for (const res of clients) res.end()
      await new Promise(r => server.close(r))
    },
  }
}

// ---------------------------------------------------------------------------
// selftest
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`selftest failed: ${message}`)
}

function plan({ id, title, revision = 1, executor = 'backend-developer', reviews = '  plan-review: []\n  code-review: []', outcome = '', progress = PROGRESS_SENTINEL }) {
  return `---
id: ${id}
title: ${title}
revision: ${revision}
created: 2026-10-01
source: user
domain: backend
paths: [src/cart/, src/cart/api.ts]
executor: ${executor}
reviews:
${reviews}
${outcome ? `outcome: ${outcome}\n` : ''}---

<!-- s:what -->
## Ne ve neden

x

<!-- s:progress -->
## İlerleme

${progress}
`
}

async function selftest() {
  const root = path.join(os.tmpdir(), 'tb-work-board-selftest')
  await fs.rm(root, { recursive: true, force: true })
  const w = d => path.join(root, '.agent-work', d)
  for (const col of COLUMNS) await fs.mkdir(w(col.key), { recursive: true })
  await fs.writeFile(path.join(root, '.agent-work', 'README.md'), '# not a plan')
  await fs.writeFile(path.join(root, '.agent-work', 'TEMPLATE.md'), plan({ id: 'tpl', title: 'template' }))
  await fs.writeFile(path.join(w('inbox'), '20261001-01-idea.md'), '---\nid: 20261001-01\ntitle: "Fikir <b>"\ncreated: 2026-10-01\nsource: agent:architect\n---\n')
  await fs.writeFile(path.join(w('draft'), '20261001-02-cart.md'), plan({
    id: '20261001-02', title: 'Sepet', revision: 2,
    reviews: '  plan-review:\n    - { by: claude/architect, at: 2026-10-02, revision: 1, verdict: rejected,\n        reasons: [eksik] }\n  code-review: []',
  }))
  await fs.writeFile(path.join(w('in-progress'), '20261001-03-pay.md'), plan({
    id: '20261001-03', title: 'Ödeme', executor: 'codex/frontend-developer',
    reviews: '  plan-review:\n    - { by: codex/architect, at: 2026-10-02, revision: 1, verdict: approved, reasons: [] }\n  code-review: []',
    progress: '- [x] API\n- [ ] UI\nyazan: codex',
  }))
  await fs.writeFile(path.join(w('done'), '20261001-04-old.md'), plan({ id: '20261001-04', title: 'Eski', outcome: 'cancelled' }))
  await fs.writeFile(path.join(w('done'), '.gitkeep'), '')

  const board = await loadBoard(root)
  assert(board.plans.length === 4, 'reads only plan files inside state folders')
  const byId = Object.fromEntries(board.plans.map(p => [p.id, p]))
  assert(byId['20261001-01'].column === 'inbox' && byId['20261001-01'].source === 'agent:architect', 'inbox record')
  assert(byId['20261001-02'].planReview.verdict === 'rejected' && byId['20261001-02'].planReview.stale, 'stale plan review')
  assert(byId['20261001-02'].paths.length === 2, 'inline paths list')
  assert(!byId['20261001-02'].progress.started, 'sentinel means not started')
  const pay = byId['20261001-03']
  assert(pay.planReview.verdict === 'approved' && !pay.planReview.stale, 'current plan review')
  assert(pay.progress.started && pay.progress.done === 1 && pay.progress.total === 2, 'progress checklist')
  assert(byId['20261001-04'].cancelled, 'cancelled outcome')

  const block = parseFrontmatter('---\nid: x\npaths:\n  - a/\n  - b/\n---\n').data
  assert(block.paths.join() === 'a/,b/', 'block paths list')

  const html = renderHtml(board, { root })
  assert(html.includes('Fikir &lt;b&gt;') && !html.includes('Fikir <b>'), 'escapes plan text')
  assert(html.includes('data-agent="frontend-developer"'), 'legacy ecosystem/agent executor filters by agent')
  assert(html.includes('0/3 bitti') && html.includes('1 iptal'), 'progress excludes cancelled work')
  assert(html.includes('<template data-id="20261001-03">') && html.includes('<dialog id="detail">'), 'detail view per plan')
  assert(!html.includes('id="live"'), 'file mode has no live stream')
  const md = renderMarkdown('<!-- s:what -->\n## Ne\n\n**Kabul** `x<y>`\n\n- [x] bitti\n- [ ] kaldı\n\n```\n<b>\n```\n')
  assert(md.includes('<h4>Ne</h4>') && md.includes('<strong>Kabul</strong>') && md.includes('<code>x&lt;y&gt;</code>'), 'markdown inline')
  assert(md.includes('checked> bitti') && md.includes('disabled> kaldı') && md.includes('<pre><code>&lt;b&gt;'), 'markdown blocks')
  assert(!md.includes('s:what'), 'markers hidden')
  assert(renderHtml(await loadBoard(path.join(root, 'missing')), { root: 'x' }).includes('bulunamadı'), 'empty state')

  await serveSelftest(root, w)

  await fs.rm(root, { recursive: true, force: true })
  console.log('work-board selftest: OK')
}

// Opens the event stream, moves a plan draft → approved and expects the pushed board
// to show it in the new column.
async function serveSelftest(root, w) {
  const srv = await startServer({ root, port: 0, pollMs: 200 })
  try {
    const page = await (await fetch(srv.url)).text()
    assert(page.includes('id="live"') && page.includes("EventSource('events')"), 'served page is live')
    const events = []
    let wake = () => {}
    const req = http.get(srv.url + 'events', res => {
      let buf = ''
      res.setEncoding('utf8')
      res.on('data', chunk => {
        buf += chunk
        let i
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, i)
          buf = buf.slice(i + 2)
          const data = block.split('\n').find(l => l.startsWith('data: '))
          if (data) { events.push(JSON.parse(data.slice(6))); wake() }
        }
      })
    })
    const waitFor = async (n, ms) => {
      const until = Date.now() + ms
      while (events.length < n && Date.now() < until) await new Promise(r => { wake = r; setTimeout(r, 50) })
      return events.length >= n
    }
    assert(await waitFor(1, 2000), 'current board is sent on connect')
    const approvedCount = html => /col-approved">\s*<h2>[^<]*<span class="count">(\d+)/.exec(html)[1]
    assert(approvedCount(events[0].html) === '0', 'nothing approved yet')
    await fs.rename(path.join(w('draft'), '20261001-02-cart.md'), path.join(w('approved'), '20261001-02-cart.md'))
    assert(await waitFor(2, 3000), 'move is pushed')
    assert(approvedCount(events[1].html) === '1', 'pushed board shows the moved plan')
    await new Promise(r => setTimeout(r, 500))
    assert(events.length === 2, 'no pushes while nothing changes')
    req.destroy()
  } finally {
    await srv.close()
  }
}

// ---------------------------------------------------------------------------
// cli
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { root: process.cwd(), out: '', serve: false, port: 4780, strictPort: false, selftest: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--root') opts.root = path.resolve(argv[++i])
    else if (arg === '--out') opts.out = path.resolve(argv[++i])
    else if (arg === '--serve') opts.serve = true
    else if (arg === '--port') { opts.port = Number(argv[++i]); opts.strictPort = true }
    else if (arg === '--selftest') opts.selftest = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) throw new Error('--port must be 0-65535')
  opts.out ||= path.join(opts.root, 'agent-work-board.html')
  return opts
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.selftest) return selftest()
  const board = await loadBoard(opts.root)
  if (!board) console.warn(`[work-board] ${path.join(opts.root, '.agent-work')} bulunamadı`)
  if (opts.serve) {
    const srv = await startServer(opts)
    console.log(`[work-board] canlı pano: ${srv.url}  (${board ? board.plans.length : 0} plan; Ctrl+C ile çık)`)
    return
  }
  await fs.writeFile(opts.out, renderHtml(board, { root: opts.root }))
  console.log(`[work-board] ${board ? board.plans.length : 0} plan → ${opts.out}`)
}

main().catch(err => {
  console.error(`[work-board] ${err.message}`)
  process.exitCode = 1
})
