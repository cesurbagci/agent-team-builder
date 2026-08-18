#!/usr/bin/env node
// sync-agent-config.mjs — canonical (.agent-source) → generated sync generator.
//
// Generalized from a production agent-team generator:
//   - root comes from `--root <dir>` (default cwd) instead of `__dirname/..`;
//   - developer_instructions are manifest-driven (writesCode, routing, consults,
//     docLanguage, constitution presets) instead of project-hardcoded text;
//     directory ownership comes from routing alone — no path is special-cased;
//   - AGENTS.md and codex-* project files are written only when the source exists.
//
// Behavior contract: team-builder-shared/sync-pipeline.md + canonical-source.md +
// codex-target.md + manifest-schema.md.
//
// CLI: node sync-agent-config.mjs [--check] [--root <dir>] [--selftest]

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { routeContains } from './route-globs.mjs'

// validate-manifest.mjs runs its own selftest block when `--selftest` is in
// process.argv. Since this script shares that flag, import it dynamically with
// the flag stripped from argv so the dependency's selftest never piggybacks.
let _validate
async function loadValidate() {
  if (_validate) return _validate
  const savedArgv = process.argv
  process.argv = savedArgv.filter(arg => arg !== '--selftest')
  try {
    const mod = await import('./validate-manifest.mjs')
    _validate = mod.validate
  } finally {
    process.argv = savedArgv
  }
  return _validate
}

const GENERATED_HEADER = '# This file is generated from .agent-source. Run sync.\n'
// Sync's own record of what it generated. Staleness is reported against this,
// so a file the user wrote by hand is never mistaken for a leftover.
const LEDGER_RELATIVE = path.join('.agent-source', 'generated-files.json')
const VALID_TARGETS = new Set(['claude', 'codex', 'opencode'])

// The shared instruction file lives in the canonical source and is referenced —
// never copied. If a source file loses this reference the generated target still
// looks valid and drift check stays clean, so nothing else would ever notice.
export const INSTRUCTIONS_REF = '.agent-source/project/instructions.md'

// Fallback map when an opencode-targeted agent has no explicit `opencode_model`.
// The wizard normally asks for and stores a provider/model string per agent, so
// this is a best-effort backstop only — adjust to the provider you actually use.
const OPENCODE_MODEL_FALLBACK = {
  opus: 'anthropic/claude-opus-4',
  sonnet: 'anthropic/claude-sonnet-4-5',
  haiku: 'anthropic/claude-haiku-4-5',
}

// ---------------------------------------------------------------------------
// fs helpers
// ---------------------------------------------------------------------------

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n')
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8')
}

async function listFiles(dirPath) {
  if (!(await pathExists(dirPath))) {
    return []
  }
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(child)))
    } else if (entry.isFile()) {
      files.push(child)
    }
  }
  return files.sort()
}

// ---------------------------------------------------------------------------
// TOML rendering
// ---------------------------------------------------------------------------

function tomlString(value) {
  return JSON.stringify(value ?? '')
}

function tomlArray(values) {
  return `[${(values ?? []).map(tomlString).join(', ')}]`
}

// ---------------------------------------------------------------------------
// Generator context — collects writes/mismatches; performs side effects in
// sync mode only. In --check mode nothing is written/removed/created.
// ---------------------------------------------------------------------------

function createContext({ root, checkOnly }) {
  const resolvedRoot = path.resolve(root)
  const sourceRoot = path.join(resolvedRoot, '.agent-source')

  const mismatches = []
  const writes = []
  // Every generated path this run produced — whether it changed on disk or not.
  const produced = new Set()

  const toPosix = filePath =>
    path.relative(resolvedRoot, filePath).split(path.sep).join('/')

  const resolveRoot = (...segments) => path.join(resolvedRoot, ...segments)
  const resolveSource = (...segments) => path.join(sourceRoot, ...segments)

  async function writeExpected(filePath, expected, { track = true } = {}) {
    if (track) {
      produced.add(toPosix(filePath))
    }
    const normalizedExpected = normalizeText(expected)
    const exists = await pathExists(filePath)
    const actual = exists ? normalizeText(await readText(filePath)) : null

    if (actual === normalizedExpected) {
      return
    }
    if (checkOnly) {
      mismatches.push(toPosix(filePath))
      return
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, normalizedExpected)
    writes.push(toPosix(filePath))
  }

  async function copyExpected(sourcePath, targetPath, transform = text => text) {
    const source = await readText(sourcePath)
    await writeExpected(targetPath, transform(source))
  }

  return {
    resolvedRoot,
    sourceRoot,
    checkOnly,
    mismatches,
    writes,
    produced,
    toPosix,
    resolveRoot,
    resolveSource,
    writeExpected,
    copyExpected,
  }
}

// ---------------------------------------------------------------------------
// agent targets
// ---------------------------------------------------------------------------

function agentTargets(agent, manifest) {
  // No implicit ecosystem: the target set is always an explicit choice, taken
  // from the agent or from the manifest-wide default.
  const targets = agent.targets ?? manifest.targetsDefault
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error(
      `Agent ${agent.name} has no targets: set agents[].targets or the ` +
        `manifest-wide targetsDefault (subset of ${[...VALID_TARGETS].join('|')}).`
    )
  }
  for (const target of targets) {
    if (!VALID_TARGETS.has(target)) {
      throw new Error(`Agent ${agent.name} has unsupported target: ${target}`)
    }
  }
  return new Set(targets)
}

function projectHasTarget(manifest, target) {
  return manifest.agents.some(agent => agentTargets(agent, manifest).has(target))
}

function projectHasClaude(manifest) {
  return projectHasTarget(manifest, 'claude')
}

function projectHasCodex(manifest) {
  return projectHasTarget(manifest, 'codex')
}

function projectHasOpencode(manifest) {
  return projectHasTarget(manifest, 'opencode')
}

// ---------------------------------------------------------------------------
// codex agent-definition transform (verbatim source + path/delegation rewrites)
// ---------------------------------------------------------------------------

function codexAgentDefinition(source) {
  return source
    .replaceAll('.claude/skills/', '.agents/skills/')
    .replaceAll(
      'Task tool ile delege et',
      'Codex sub-agent workflow aktifse delege et'
    )
}

// ---------------------------------------------------------------------------
// opencode agent md rendering (opencode-target.md)
// ---------------------------------------------------------------------------

// Strip a leading YAML frontmatter block (the source md carries Claude-style
// frontmatter; OpenCode needs its own frontmatter first, so we replace it).
function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text
  const match = text.match(/^---\n[\s\S]*?\n---\n?/)
  return match ? text.slice(match[0].length) : text
}

// The frontmatter block itself, for checks that must not match prose lower
// down the file. Returns null when the document does not open with one.
function frontmatterOf(text) {
  if (!text.startsWith('---')) return null
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  return match ? match[1] : null
}

function opencodeModel(agent) {
  if (agent.opencode_model) return agent.opencode_model
  return OPENCODE_MODEL_FALLBACK[agent.model] ?? 'anthropic/claude-sonnet-4-5'
}

// Rich role body, reused from the single source md, with path/delegation rewrites.
function opencodeAgentBody(source) {
  return stripFrontmatter(source)
    .replace(/^\n+/, '')
    .replaceAll('.claude/skills/', '.opencode/skills/')
    .replaceAll('Task tool ile delege et', 'OpenCode @mention ile subagent\'e delege et')
}

// `writesCode` is a production-code prohibition carried in the role text;
// `sandbox_mode` is the filesystem permission. They are not the same question:
// a documentation owner is `writesCode: false` *and* `workspace-write`. Every
// target must answer "can this role change files" the same way, or the same
// role is granted a write area by one and denied it by another.
function canWriteFiles(agent) {
  return agent.sandbox_mode
    ? agent.sandbox_mode !== 'read-only'
    : agent.writesCode !== false
}

function renderOpencodeAgentMd(agent, manifest, source) {
  const writesCode = agent.writesCode !== false
  const canEdit = canWriteFiles(agent)
  const mode = manifest.lead && agent.name === manifest.lead ? 'primary' : 'subagent'
  const edit = canEdit ? 'allow' : 'deny'
  const bash = canEdit && writesCode ? 'allow' : 'ask'

  const frontmatter =
    '---\n' +
    `description: ${tomlString(agent.description)}\n` +
    `mode: ${mode}\n` +
    `model: ${opencodeModel(agent)}\n` +
    'permission:\n' +
    `  edit: ${edit}\n` +
    `  bash: ${bash}\n` +
    '---\n\n'

  return frontmatter + opencodeAgentBody(source)
}

// ---------------------------------------------------------------------------
// developer_instructions template (manifest-driven; codex-target.md §1)
// ---------------------------------------------------------------------------

function renderDeveloperInstructions(agent, manifest, projectName) {
  const docLanguage = manifest.docLanguage ?? 'tr'
  const constitution = manifest.constitution ?? {}
  const perAgentMemory = constitution.perAgentMemory !== false
  const languageStandard = constitution.languageStandard !== false
  const writesCode = agent.writesCode !== false

  const lines = []
  lines.push(
    `Sen ${projectName} projesinin Codex custom agent'i \`${agent.name}\` rolusun.`
  )
  lines.push('')
  lines.push(
    `Ilk is olarak \`AGENTS.md\` dosyasini ve \`.codex/agent-definitions/${agent.name}.md\``
  )
  lines.push('dosyasini oku. `.codex/agent-definitions/' + agent.name + '.md` icindeki rol')
  lines.push("talimatlari baglayicidir; Claude'a ozgu frontmatter metadata alanlarini")
  lines.push('(`tools`, `model`, `memory`, `color`) Codex konfigurasyonu olarak yorumlama.')
  lines.push('')

  // Documentation ownership comes from routing, not from a role name and not
  // from a path prefix. A directory routed to a role that does not write code
  // is that role's to maintain, wherever the project puts it — `docs/**`, a
  // per-module `modules/<m>/docs/**`, anywhere. Matching on the literal string
  // "docs" instead would miss the per-module layout and would mistake a
  // code directory that merely reads like one (`docsite/`) for documentation.
  // Named for what they are, not for `docs/`: reintroducing a path test here
  // is what produced both earlier bugs.
  // A read-only role owns nothing it could maintain: granting it a write area
  // would contradict the very permission its sandbox states, and barring other
  // roles from a directory nobody can write is noise.
  const nonWritingOwners = new Set(
    (manifest.agents ?? [])
      .filter(a => a && a.name && a.writesCode === false && canWriteFiles(a))
      .map(a => a.name)
  )
  // Several roles may share the documentation, so every owned route counts,
  // not just the first — taking one would hand this agent another's directory.
  const ownedRoutes = (manifest.routing ?? []).filter(
    r => r && typeof r.path === 'string' && nonWritingOwners.has(r.role)
  )
  const ownRoutes = ownedRoutes.filter(r => r.role === agent.name)
  const otherRoutes = ownedRoutes.filter(r => r.role !== agent.name)

  // `docs/guides/**` sits inside `docs/**`. Routing resolves most-specific
  // first, so barring this agent from the parent outright would contradict
  // the grant it was just given; name the exception instead.
  // Containment is decided exactly, by route-globs.mjs. Sampling paths and
  // comparing them was an approximation, and four review rounds each found
  // the next pair it got wrong.
  const nestedIn = (inner, outer) =>
    inner !== outer && routeContains(outer, inner)

  const prohibit = route => {
    const carved = ownRoutes.filter(o => nestedIn(o.path, route.path))
    const except = carved.length
      ? ` (kendi yolun ${carved.map(o => `\`${o.path}\``).join(', ')} haric)`
      : ''
    lines.push(
      `- \`${route.path}\` altina yazma${except}; orasi \`${route.role}\` rolunun.`
    )
  }

  if (writesCode) {
    lines.push("- Sadece kendi domain'inde kod yaz.")
    otherRoutes.forEach(prohibit)
  } else {
    lines.push('- Production kod yazma.')
    if (ownRoutes.length > 0) {
      lines.push(
        `- Yazma alanin ${ownRoutes.map(r => `\`${r.path}\``).join(', ')} altidir.`
      )
      otherRoutes.forEach(prohibit)
    } else {
      lines.push('- Dosya degistirme; yalniz okur ve rapor uretirsin.')
    }
  }
  lines.push(
    '- Kod tabanini birincil kaynak olarak oku; dokumanlari kod kontratlarinin tamamlayicisi olarak guncelle.'
  )
  for (const extra of agent.extra_instructions ?? []) {
    lines.push(`- ${extra}`)
  }
  for (const consult of agent.consults ?? []) {
    lines.push(
      `- Belirsizlik veya mimari karar cikarsa \`${consult}\` rolune sevk et.`
    )
  }
  lines.push('')

  if (perAgentMemory) {
    lines.push(
      `Agent memory gerekiyorsa \`.agent-memory/${agent.name}/MEMORY.md\` dosyasini oku. Kalici`
    )
    lines.push(
      `memory notu gerekiyorsa sadece \`.agent-memory/${agent.name}/\` altina yaz; \`.claude/agent-memory/\``
    )
    lines.push('ve `.codex/agent-memory/` altina yazma.')
    lines.push('')
  }

  if (languageStandard) {
    lines.push(
      `Kullaniciya ${docLanguage} cevap ver. Kod, dosya ve commit isimleri Ingilizce kalir.`
    )
    lines.push('Shell komutlarinda mumkunse `rtk` kullan.')
  }

  // Trim trailing blank lines.
  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines.join('\n')
}

function renderCodexAgentToml(agent, manifest, projectName) {
  const modelLine = agent.model ? `model = ${tomlString(agent.model)}\n` : ''
  // These are enums on the Codex side. Both fields are optional in the
  // manifest, and emitting `= ""` for an absent one is not "unset" — Codex
  // rejects the agent outright ("reasoning_effort must not be empty",
  // "unknown variant"). Omit them so the agent inherits the default.
  const effortLine = agent.model_reasoning_effort
    ? `model_reasoning_effort = ${tomlString(agent.model_reasoning_effort)}\n`
    : ''
  const sandboxLine = agent.sandbox_mode
    ? `sandbox_mode = ${tomlString(agent.sandbox_mode)}\n`
    : ''
  const developerInstructions = renderDeveloperInstructions(agent, manifest, projectName)
  return (
    GENERATED_HEADER +
    `name = ${tomlString(agent.name)}\n` +
    `description = ${tomlString(agent.description)}\n` +
    modelLine +
    effortLine +
    sandboxLine +
    `nickname_candidates = ${tomlArray(agent.nickname_candidates)}\n` +
    '\n' +
    'developer_instructions = """\n' +
    developerInstructions +
    '\n"""\n'
  )
}

// ---------------------------------------------------------------------------
// sync phases
// ---------------------------------------------------------------------------

// Deliberately a warning, not a ctx.mismatch: mismatches fail --check, and the
// project owner decided a missing reference must not block generation. The
// offer to restore it belongs to the interactive skills, not here.
async function warnMissingInstructionsRef(ctx, manifest, warn) {
  const checks = []
  if (projectHasClaude(manifest)) checks.push('CLAUDE.md')
  if (projectHasCodex(manifest) || projectHasOpencode(manifest)) checks.push('AGENTS.md')

  for (const name of checks) {
    const source = ctx.resolveSource('project', name)
    if (!(await pathExists(source))) continue
    const body = await readText(source)
    if (!body.includes(INSTRUCTIONS_REF)) {
      warn(
        `! .agent-source/project/${name} does not reference ${INSTRUCTIONS_REF} — ` +
          'the project loses its shared governance text. Add the reference back.'
      )
    }
  }
}

async function syncProjectFiles(ctx, manifest) {
  // Project files are templated/compiled generated outputs → prepend header.
  const withHeader = source => GENERATED_HEADER + source

  // CLAUDE.md is a Claude-only output — no target selection implies it.
  if (projectHasClaude(manifest)) {
    const claudeSource = ctx.resolveSource('project', 'CLAUDE.md')
    if (await pathExists(claudeSource)) {
      await ctx.copyExpected(claudeSource, ctx.resolveRoot('CLAUDE.md'), withHeader)
    }
  }

  const hasCodex = projectHasCodex(manifest)
  const hasOpencode = projectHasOpencode(manifest)
  if (!hasCodex && !hasOpencode) {
    return
  }

  // project/AGENTS.md → AGENTS.md. Both Codex and OpenCode read AGENTS.md
  // natively, so it is generated whenever either target exists.
  const agentsSource = ctx.resolveSource('project', 'AGENTS.md')
  if (await pathExists(agentsSource)) {
    await ctx.copyExpected(agentsSource, ctx.resolveRoot('AGENTS.md'), withHeader)
  }

  // project/codex-* → .codex/* (only if present)
  if (hasCodex) {
    const codexProjectMap = [
      ['codex-config.toml', path.join('.codex', 'config.toml')],
      ['codex-team.md', path.join('.codex', 'team.md')],
      ['migration-map.md', path.join('.codex', 'migration-map.md')],
    ]
    for (const [sourceName, targetRel] of codexProjectMap) {
      const sourcePath = ctx.resolveSource('project', sourceName)
      if (await pathExists(sourcePath)) {
        await ctx.copyExpected(sourcePath, ctx.resolveRoot(targetRel), withHeader)
      }
    }
  }

  // project/opencode-* → .opencode/* and root opencode.json (only if present).
  // opencode.json is copied verbatim and carries NO generated marker: it cannot
  // take the `#` header, and OpenCode validates its config strictly — an
  // unknown key (including a "//" comment key) makes it reject the file with
  // "Unrecognized key". Drift (`--check`) is the guard against hand-edits here.
  if (hasOpencode) {
    const ocConfig = ctx.resolveSource('project', 'opencode.json')
    if (await pathExists(ocConfig)) {
      await ctx.copyExpected(ocConfig, ctx.resolveRoot('opencode.json'))
    }
    const ocTeam = ctx.resolveSource('project', 'opencode-team.md')
    if (await pathExists(ocTeam)) {
      await ctx.copyExpected(ocTeam, ctx.resolveRoot('.opencode', 'team.md'), withHeader)
    }
  }
}

async function syncAgents(ctx, manifest, projectName) {
  const names = manifest.agents.map(agent => agent.name)

  for (const agent of manifest.agents) {
    const source = ctx.resolveSource('agents', `${agent.name}.md`)
    if (!(await pathExists(source))) {
      ctx.mismatches.push(
        `.agent-source/agents/${agent.name}.md is listed in manifest but missing`
      )
      continue
    }
    const targets = agentTargets(agent, manifest)

    if (targets.has('claude')) {
      const fileName = `${agent.name}.md`
      await ctx.copyExpected(source, ctx.resolveRoot('.claude', 'agents', fileName))
    }

    if (targets.has('codex')) {
      const definitionFileName = `${agent.name}.md`
      const tomlFileName = `${agent.name}.toml`
      await ctx.copyExpected(
        source,
        ctx.resolveRoot('.codex', 'agent-definitions', definitionFileName),
        codexAgentDefinition
      )
      await ctx.writeExpected(
        ctx.resolveRoot('.codex', 'agents', tomlFileName),
        renderCodexAgentToml(agent, manifest, projectName)
      )
    }

    if (targets.has('opencode')) {
      const fileName = `${agent.name}.md`
      await ctx.copyExpected(
        source,
        ctx.resolveRoot('.opencode', 'agents', fileName),
        src => renderOpencodeAgentMd(agent, manifest, src)
      )
    }
  }

  // Source agent .md not listed in manifest → mismatch.
  const sourceAgentFiles = await listFiles(ctx.resolveSource('agents'))
  for (const filePath of sourceAgentFiles) {
    const fileName = path.basename(filePath)
    if (fileName === 'manifest.json') continue
    if (path.extname(fileName) !== '.md') continue
    const agentName = path.basename(filePath, '.md')
    if (!names.includes(agentName)) {
      ctx.mismatches.push(
        `${ctx.toPosix(filePath)} is not listed in .agent-source/agents/manifest.json`
      )
    }
  }
}

async function syncSkills(ctx, manifest) {
  const hasClaude = projectHasClaude(manifest)
  const hasOpencode = projectHasOpencode(manifest)
  const skillsSource = ctx.resolveSource('skills')
  const files = await listFiles(skillsSource)
  for (const filePath of files) {
    const relative = path.relative(skillsSource, filePath)
    if (hasClaude) {
      await ctx.copyExpected(filePath, ctx.resolveRoot('.claude', 'skills', relative))
    }
    // .agents/skills is the ecosystem-neutral mirror: Codex and OpenCode both
    // discover it, so it is written regardless of which of the two is targeted.
    await ctx.copyExpected(filePath, ctx.resolveRoot('.agents', 'skills', relative))
    if (hasOpencode) {
      await ctx.copyExpected(filePath, ctx.resolveRoot('.opencode', 'skills', relative))
    }
  }
}

// Whether a previously-generated LEDGER ENTRY should still count as present.
// Unlike pathExists (fs.access, follows symlinks), this must see a dangling
// symlink as present — otherwise a stale target that becomes one silently
// drops out of stalePaths below and is never reported again, breaking the
// "reported until the user deletes it" contract. A transient error (e.g.
// EACCES) must not be read as "deleted" either, for the same reason: only
// ENOENT/ENOTDIR (the path or a parent segment is genuinely gone) means the
// user actually removed it. Local to reportStaleGenerated — pathExists keeps
// its existing "any error means absent" semantics for its other callers.
async function ledgerEntryExists(filePath) {
  try {
    await fs.lstat(filePath)
    return true
  } catch (err) {
    return err.code !== 'ENOENT' && err.code !== 'ENOTDIR'
  }
}

// Report generated targets this run no longer produces. Nothing is deleted:
// a path that stopped being generated is not proof that removing it is safe.
// A missing or malformed ledger yields no report — never an error. Returns
// the stale paths that are still on disk, so the caller can keep carrying
// them in the ledger — the ledger is an ownership record, not a per-run
// snapshot, so a path stays reported every run until the file is actually
// gone.
async function reportStaleGenerated(ctx, ledgerPath) {
  if (!(await pathExists(ledgerPath))) {
    return []
  }
  let previous
  try {
    previous = JSON.parse(await readText(ledgerPath))
  } catch {
    return []
  }
  if (!previous || !Array.isArray(previous.files)) {
    return []
  }
  const stale = []
  for (const relative of previous.files) {
    if (typeof relative !== 'string' || relative.length === 0) continue
    if (ctx.produced.has(relative)) continue
    const filePath = ctx.resolveRoot(...relative.split('/'))
    if (!(await ledgerEntryExists(filePath))) continue
    ctx.mismatches.push(`${relative} (stale)`)
    stale.push(relative)
  }
  return stale
}

// ---------------------------------------------------------------------------
// generate — main pipeline
// ---------------------------------------------------------------------------

// The value of a top-level frontmatter key, or null when the key is absent or
// carries nothing. Deliberately not a regex over the whole block: `\s*` spans
// newlines, so `description:` followed by `name: architect` read as a filled
// description, and a quoted value read as part of the name.
function frontmatterValue(block, key) {
  for (const line of block.split('\n')) {
    const match = new RegExp(`^${key}:(.*)$`).exec(line)
    if (!match) continue
    let value = match[1]
    // A `#` that starts a token begins a comment; one inside a word does not.
    value = value.replace(/(^|\s)#.*$/, '$1').trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1).trim()
    }
    return value === '' || value === '~' || value === 'null' ? null : value
  }
  return null
}

// The Claude body is this source file verbatim, so its own frontmatter is
// never covered by the manifest checks: Claude will not load an agent without
// a description, and a name disagreeing with the manifest detaches the file
// from its routing and gate rules. This runs before anything is written —
// reporting it as a mismatch would let a broken agent reach disk first.
async function checkAgentSources(ctx, manifest) {
  const problems = []
  for (const agent of manifest.agents) {
    const source = ctx.resolveSource('agents', `${agent.name}.md`)
    if (!(await pathExists(source))) continue // reported per-agent during sync
    const block = frontmatterOf(await fs.readFile(source, 'utf8'))
    const where = `.agent-source/agents/${agent.name}.md`
    if (block === null) {
      problems.push(`${where} must start with YAML frontmatter`)
      continue
    }
    // One description reaches all three targets: Claude gets this file's, and
    // Codex and OpenCode get the manifest's. If they differ, the same role is
    // described two ways depending on where it is read.
    const description = frontmatterValue(block, 'description')
    if (description === null) {
      problems.push(`${where} frontmatter needs a non-empty description`)
    } else if (description !== agent.description) {
      problems.push(
        `${where} frontmatter description must match the manifest's (source: ${JSON.stringify(description)}, manifest: ${JSON.stringify(agent.description)})`
      )
    }
    const declared = frontmatterValue(block, 'name')
    if (declared !== agent.name) {
      problems.push(`${where} frontmatter name must be "${agent.name}"`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`Agent source invalid:\n- ${problems.join('\n- ')}`)
  }
}

async function generate({ root, checkOnly, quiet = false }) {
  const log = quiet ? () => {} : (...a) => console.log(...a)
  const warn = quiet ? () => {} : (...a) => console.warn(...a)
  const error = quiet ? () => {} : (...a) => console.error(...a)
  const ctx = createContext({ root, checkOnly })

  const manifestPath = ctx.resolveSource('agents', 'manifest.json')
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Manifest not found: ${manifestPath}`)
  }
  const manifest = JSON.parse(await readText(manifestPath))
  const validate = await loadValidate()
  validate(manifest)
  await checkAgentSources(ctx, manifest)

  const projectName = path.basename(ctx.resolvedRoot)

  await warnMissingInstructionsRef(ctx, manifest, warn)
  await syncProjectFiles(ctx, manifest)
  await syncAgents(ctx, manifest, projectName)
  await syncSkills(ctx, manifest)

  // Staleness is judged against the PREVIOUS ledger, then the new one is written.
  // The new ledger is the union of this run's produced paths and any stale
  // path still on disk — an ownership record, not a per-run snapshot — so a
  // stale target keeps being reported on every future sync/--check instead
  // of silently dropping out the moment it's first noticed. A stale path the
  // user actually deleted is absent from disk, so reportStaleGenerated will
  // not return it here, and it naturally falls out of the ledger.
  // The ledger is generated too, but must not list itself — track: false.
  const ledgerPath = ctx.resolveRoot(LEDGER_RELATIVE)
  const stalePaths = await reportStaleGenerated(ctx, ledgerPath)
  const ledgerFiles = new Set([...ctx.produced, ...stalePaths])
  const ledgerBody = JSON.stringify({ files: [...ledgerFiles].sort() }, null, 2) + '\n'
  await ctx.writeExpected(ledgerPath, ledgerBody, { track: false })

  if (checkOnly) {
    if (ctx.mismatches.length > 0) {
      error('Agent configuration drift detected:')
      for (const mismatch of ctx.mismatches) {
        error(`- ${mismatch}`)
      }
      process.exitCode = 1
      return { ok: false, mismatches: ctx.mismatches }
    }
    log('Agent configuration is in sync.')
    return { ok: true, mismatches: [] }
  }

  if (ctx.mismatches.length > 0) {
    // Mismatches — unlisted agent sources and stale generated paths alike —
    // are non-fatal in sync mode: printed as warnings, not failures. Only
    // --check (above) treats them as a failure.
    for (const mismatch of ctx.mismatches) {
      warn(`! ${mismatch}`)
    }
    if (ctx.mismatches.some(m => m.endsWith(' (stale)'))) {
      warn('These files are no longer generated; deleting them is up to you.')
    }
  }
  if (ctx.writes.length === 0) {
    log('Agent configuration already in sync.')
    return { ok: true, writes: [], mismatches: ctx.mismatches }
  }
  log('Synchronized agent configuration:')
  for (const filePath of ctx.writes) {
    log(`- ${filePath}`)
  }
  return { ok: true, writes: ctx.writes, mismatches: ctx.mismatches }
}

// ---------------------------------------------------------------------------
// selftest (TDD harness — builds fixture, asserts generate + drift detection)
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) {
    throw new Error(`SELFTEST FAIL: ${message}`)
  }
}

// Run generate() with quiet=true so selftest output stays clean.
async function silentGenerate(options) {
  return generate({ ...options, quiet: true })
}

async function runSelftest() {
  const fixtureRoot = path.join(os.tmpdir(), 'tb-sync-selftest')
  const sourceRoot = path.join(fixtureRoot, '.agent-source')

  // Clean slate.
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  await fs.mkdir(path.join(sourceRoot, 'agents'), { recursive: true })
  await fs.mkdir(path.join(sourceRoot, 'project'), { recursive: true })
  await fs.mkdir(path.join(sourceRoot, 'skills', 'demo-skill'), { recursive: true })
  await fs.mkdir(path.join(sourceRoot, 'skills', 'work-plan'), { recursive: true })

  // Manifest: 2 agents — one claude+codex, one claude-only.
  const manifest = {
    targetsDefault: ['claude', 'codex'],
    docLanguage: 'tr',
    // The architect is workspace-write, so it must own a route: a role that may
    // write files and has nowhere to write is the incoherence V7e rejects.
    routing: [{ path: 'docs/**', role: 'architect' }],
    architectureDocs: { root: 'docs/mimari', layout: 'central' },
    constitution: {
      noWorkaround: true,
      codeDocSync: true,
      perAgentMemory: true,
      languageStandard: true,
    },
    lead: 'architect',
    agents: [
      {
        name: 'architect',
        targets: ['claude', 'codex', 'opencode'],
        description: 'Mimari kararlar icin.',
        model: 'opus',
        opencode_model: 'anthropic/claude-opus-4',
        model_reasoning_effort: 'high',
        sandbox_mode: 'workspace-write',
        writesCode: false,
        nickname_candidates: ['Architect', 'ADR Lead'],
        consults: [],
        extra_instructions: ['Production kod yazma.'],
      },
      {
        name: 'developer',
        targets: ['claude'],
        description: 'Kod yazar.',
        model: 'sonnet',
        model_reasoning_effort: 'high',
        sandbox_mode: 'workspace-write',
        writesCode: true,
        nickname_candidates: ['Dev'],
        consults: ['architect'],
        extra_instructions: [],
      },
    ],
  }
  await fs.writeFile(
    path.join(sourceRoot, 'agents', 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )

  const architectBody =
    '---\nname: architect\ndescription: Mimari kararlar icin.\nmodel: opus\n---\n\n# Architect\n\nSkill: .claude/skills/demo-skill/SKILL.md\nDelege: technical-architect ajanina Task tool ile delege et.\n'
  await fs.writeFile(path.join(sourceRoot, 'agents', 'architect.md'), architectBody)

  // The Claude and OpenCode bodies are this file verbatim, so a source md
  // without a description produces an agent Claude will not load, and a name
  // that disagrees with the manifest detaches the file from its routing.
  // Neither is visible to the manifest checks.
  {
    const sourcePath = path.join(sourceRoot, 'agents', 'architect.md')
    const good = await fs.readFile(sourcePath, 'utf8')
    for (const [label, broken, expected] of [
      [
        'a source md with no description',
        good.replace('description: Mimari kararlar icin.\n', ''),
        'needs a non-empty description',
      ],
      [
        'a source md whose name disagrees with the manifest',
        good.replace('name: architect', 'name: architekt'),
        'frontmatter name must be "architect"',
      ],
      ['a source md with no frontmatter', '# Architect\n', 'must start with YAML frontmatter'],
      // `\s*` used to span the newline, so an empty description followed by
      // another key read as filled.
      [
        'an empty description followed by another key',
        good.replace('description: Mimari kararlar icin.', 'description:'),
        'needs a non-empty description',
      ],
      [
        'a quoted-empty description',
        good.replace('description: Mimari kararlar icin.', 'description: ""'),
        'needs a non-empty description',
      ],
      [
        'a description that is only a comment',
        good.replace('description: Mimari kararlar icin.', 'description: # yok'),
        'needs a non-empty description',
      ],
      // A non-string is not a description; it also read as "present" because
      // the token is non-empty.
      [
        'a description that is a YAML sequence',
        good.replace('description: Mimari kararlar icin.', 'description: []'),
        'must match the manifest',
      ],
      // Claude reads this file, Codex and OpenCode read the manifest. Two
      // different values mean the same role is described two ways.
      [
        'a description disagreeing with the manifest',
        good.replace('description: Mimari kararlar icin.', 'description: Baska bir sey.'),
        'must match the manifest',
      ],
    ]) {
      await fs.writeFile(sourcePath, broken)
      // Generation must refuse before writing: reporting it as a mismatch
      // would let an unloadable Claude agent reach disk with exit 0.
      let thrown = null
      try {
        await silentGenerate({ root: fixtureRoot, checkOnly: false })
      } catch (e) {
        thrown = e
      }
      assert(
        thrown !== null && thrown.message.includes(expected),
        `${label} must abort generation (expected "${expected}", got ${thrown ? thrown.message : 'no error'})`
      )
    }
    // …and a quoted name that agrees with the manifest is fine.
    await fs.writeFile(sourcePath, good.replace('name: architect', 'name: "architect"'))
    await silentGenerate({ root: fixtureRoot, checkOnly: false })
    await fs.writeFile(sourcePath, good)
  }

  const developerBody = '---\nname: developer\ndescription: Kod yazar.\nmodel: sonnet\n---\n\n# Developer\n\nKod yazar.\n'
  await fs.writeFile(path.join(sourceRoot, 'agents', 'developer.md'), developerBody)

  const claudeMd = `# CLAUDE\n\n@${INSTRUCTIONS_REF}\n\nProje talimati.\n`
  await fs.writeFile(path.join(sourceRoot, 'project', 'CLAUDE.md'), claudeMd)
  const agentsMd = `# AGENTS\n\nButun proje kurallari @${INSTRUCTIONS_REF} dosyasindadir.\n`
  await fs.writeFile(path.join(sourceRoot, 'project', 'AGENTS.md'), agentsMd)

  const opencodeJson =
    '{\n  "$schema": "https://opencode.ai/config.json",\n  "instructions": ["AGENTS.md"]\n}\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'opencode.json'), opencodeJson)
  const opencodeTeam = '# OpenCode Team\n\nTakim sozlesmesi.\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'opencode-team.md'), opencodeTeam)

  const codexConfig = '# codex config\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'codex-config.toml'), codexConfig)
  const codexTeam = '# codex team\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'codex-team.md'), codexTeam)

  const skillMd = '# Demo Skill\n\nDemo.\n'
  await fs.writeFile(
    path.join(sourceRoot, 'skills', 'demo-skill', 'SKILL.md'),
    skillMd
  )
  const workPlanSkillMd =
    '---\nname: work-plan\ndescription: Plan kapisi proseduru.\n---\n\n# work-plan\n'
  await fs.writeFile(
    path.join(sourceRoot, 'skills', 'work-plan', 'SKILL.md'),
    workPlanSkillMd
  )

  // --- Generate ---
  await silentGenerate({ root: fixtureRoot, checkOnly: false })

  const read = rel => readText(path.join(fixtureRoot, rel))
  const exists = rel => pathExists(path.join(fixtureRoot, rel))

  // Claude agent md (both agents target claude).
  assert(await exists('.claude/agents/architect.md'), '.claude/agents/architect.md missing')
  assert(await exists('.claude/agents/developer.md'), '.claude/agents/developer.md missing')
  assert(
    normalizeText(await read('.claude/agents/architect.md')) === normalizeText(architectBody),
    'architect claude md content mismatch (must be verbatim source)'
  )

  // Codex targets only for architect (developer is claude-only).
  assert(
    await exists('.codex/agent-definitions/architect.md'),
    '.codex/agent-definitions/architect.md missing'
  )
  assert(
    await exists('.codex/agents/architect.toml'),
    '.codex/agents/architect.toml missing'
  )
  assert(
    !(await exists('.codex/agent-definitions/developer.md')),
    'developer should not have codex agent-definition'
  )
  assert(
    !(await exists('.codex/agents/developer.toml')),
    'developer should not have codex toml'
  )

  // Codex agent-definition is transformed (paths + delegation rewrite).
  const codexDef = await read('.codex/agent-definitions/architect.md')
  assert(
    codexDef.includes('.agents/skills/demo-skill/SKILL.md'),
    'codex def should rewrite .claude/skills → .agents/skills'
  )
  assert(
    !codexDef.includes('.claude/skills/'),
    'codex def should not retain .claude/skills paths'
  )
  assert(
    codexDef.includes('Codex sub-agent workflow aktifse delege et'),
    'codex def should rewrite Task tool delegation'
  )

  // TOML content checks.
  const toml = await read('.codex/agents/architect.toml')
  assert(toml.startsWith(GENERATED_HEADER), 'toml should start with generated header')
  assert(toml.includes('name = "architect"'), 'toml missing name')
  assert(toml.includes('model = "opus"'), 'toml missing model line')
  assert(
    toml.includes('model_reasoning_effort = "high"'),
    'toml missing model_reasoning_effort'
  )
  assert(toml.includes('sandbox_mode = "workspace-write"'), 'toml missing sandbox_mode')
  // Both fields are optional and both are enums on the Codex side: emitting
  // `= ""` for an absent one makes Codex reject the agent rather than fall
  // back to its default.
  const bareToml = renderCodexAgentToml(
    { name: 'bare', description: 'd' },
    manifest,
    'demo'
  )
  assert(
    !bareToml.includes('model_reasoning_effort ='),
    'an absent model_reasoning_effort must be omitted, not emitted empty'
  )
  assert(
    !bareToml.includes('sandbox_mode ='),
    'an absent sandbox_mode must be omitted, not emitted empty'
  )
  assert(
    !/=\s*""/.test(bareToml.split('developer_instructions')[0]),
    'no TOML key may be emitted with an empty value'
  )
  assert(
    toml.includes('nickname_candidates = ["Architect", "ADR Lead"]'),
    'toml missing nickname_candidates'
  )
  assert(toml.includes('developer_instructions = """'), 'toml missing developer_instructions')
  assert(
    toml.includes("Codex custom agent'i `architect` rolusun"),
    'developer_instructions missing role line'
  )
  assert(
    toml.includes('Production kod yazma'),
    'developer_instructions should include writesCode=false line + extra_instructions'
  )
  assert(
    toml.includes('.agent-memory/architect/MEMORY.md'),
    'developer_instructions should include per-agent memory line'
  )

  // Documentation ownership is derived from routing, not from a role name.
  // Ownership is derived from the owner's writability, so every fixture below
  // carries the agents its routing names — routing[].role must be a real agent
  // (validate-manifest V-routing), and the derivation now reads writesCode.
  const ownedManifest = {
    docLanguage: 'tr',
    routing: [{ path: 'docs/**', role: 'architect' }],
    agents: [
      { name: 'architect', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'dev' , description: 'rol aciklamasi',},
    ],
  }
  const ownerText = renderDeveloperInstructions(
    { name: 'architect', description: 'rol aciklamasi', writesCode: false },
    ownedManifest,
    'demo'
  )
  assert(
    ownerText.includes('Yazma alanin `docs/**` altidir.'),
    'the docs owner must be granted its routed path'
  )
  const devText = renderDeveloperInstructions({ name: 'dev' , description: 'rol aciklamasi',}, ownedManifest, 'demo')
  assert(
    devText.includes('`docs/**` altina yazma; orasi `architect` rolunun.'),
    'a developer must be kept out of the routed docs path'
  )

  // Documentation may be split between roles. Every owned route counts, and the
  // sub-path owner must not be barred from the parent that contains its own
  // grant — most-specific routing wins, so the exception has to be named.
  const splitManifest = {
    docLanguage: 'tr',
    routing: [
      { path: 'docs/**', role: 'architect' },
      { path: 'docs/guides/**', role: 'doc-writer' },
    ],
    agents: [
      { name: 'architect', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'dev' , description: 'rol aciklamasi',},
    ],
  }
  const splitWriter = renderDeveloperInstructions(
    { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false },
    splitManifest,
    'demo'
  )
  assert(
    splitWriter.includes('Yazma alanin `docs/guides/**` altidir.'),
    'a split docs owner must be granted its own route'
  )
  assert(
    splitWriter.includes(
      '`docs/**` altina yazma (kendi yolun `docs/guides/**` haric); orasi `architect` rolunun.'
    ),
    'a blanket prohibition must carve out the sub-path the same agent owns'
  )
  const splitDev = renderDeveloperInstructions({ name: 'dev' , description: 'rol aciklamasi',}, splitManifest, 'demo')
  assert(
    splitDev.includes('`docs/**` altina yazma; orasi `architect` rolunun.') &&
      splitDev.includes('`docs/guides/**` altina yazma; orasi `doc-writer` rolunun.'),
    'a developer must be kept out of every owned route, not just the first'
  )
  assert(
    !splitDev.includes('haric'),
    'an agent that owns nothing must get no carve-out'
  )

  // Three roles sharing a root: the middle one is inside the widest and
  // contains the narrowest, so its prohibitions must carve out its own route
  // for the former and stay bare for the latter.
  const threeDeep = {
    docLanguage: 'tr',
    routing: [
      { path: 'docs/**', role: 'architect' },
      { path: 'docs/guides/**', role: 'doc-writer' },
      { path: 'docs/guides/api/**', role: 'api-writer' },
    ],
    agents: [
      { name: 'architect', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'api-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
    ],
  }
  const middle = renderDeveloperInstructions(
    { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
    threeDeep,
    'demo'
  )
  assert(
    middle.includes(
      '`docs/**` altina yazma (kendi yolun `docs/guides/**` haric); orasi `architect` rolunun.'
    ),
    'the middle owner carves its route out of the route that contains it'
  )
  assert(
    middle.includes(
      '`docs/guides/api/**` altina yazma; orasi `api-writer` rolunun.'
    ),
    'the middle owner is barred from the route nested inside its own, with no exception'
  )

  // Sibling owners: neither path contains the other, so neither prohibition
  // may carry a carve-out. Without this the nesting test could return true
  // unconditionally and every case above would still pass.
  const siblingManifest = {
    docLanguage: 'tr',
    routing: [
      { path: 'docs/arch/**', role: 'architect' },
      { path: 'docs/guides/**', role: 'doc-writer' },
    ],
    agents: [
      { name: 'architect', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
    ],
  }
  const siblingWriter = renderDeveloperInstructions(
    { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false },
    siblingManifest,
    'demo'
  )
  assert(
    siblingWriter.includes('\`docs/arch/**\` altina yazma; orasi \`architect\` rolunun.'),
    "a sibling owner must still be barred from the other owner's path"
  )
  assert(
    !siblingWriter.includes('haric'),
    "a path that does not contain this agent's own route needs no carve-out"
  )

  // per-module layout (architecture-docs.md): the documentation tree lives
  // under modules/<name>/docs, with no top-level docs/ route at all. Ownership
  // must follow the routed role, not the spelling of the path.
  const perModuleManifest = {
    docLanguage: 'tr',
    routing: [
      { path: 'modules/pay/docs/**', role: 'architect' },
      { path: 'modules/pay/**', role: 'dev' },
    ],
    agents: [
      { name: 'architect', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'dev' , description: 'rol aciklamasi',},
    ],
  }
  const perModuleDev = renderDeveloperInstructions(
    { name: 'dev' , description: 'rol aciklamasi',},
    perModuleManifest,
    'demo'
  )
  assert(
    perModuleDev.includes(
      '`modules/pay/docs/**` altina yazma; orasi `architect` rolunun.'
    ),
    'per-module documentation must be recognised even without a docs/ prefix'
  )

  // A read-only role owns nothing. Routing may legitimately name one (a
  // security reviewer scoped to a path), but granting it a write area would
  // contradict its own sandbox, and Codex would then promise what OpenCode
  // denies — the cross-target split this derivation exists to prevent.
  const readOnlyRouted = {
    docLanguage: 'tr',
    routing: [
      { path: 'src/auth/**', role: 'security-reviewer' },
      { path: 'src/**', role: 'dev' },
    ],
    agents: [
      { name: 'security-reviewer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'read-only' },
      { name: 'dev', description: 'rol aciklamasi', sandbox_mode: 'workspace-write' },
    ],
  }
  assert(
    !renderDeveloperInstructions(
      { name: 'security-reviewer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'read-only' },
      readOnlyRouted,
      'demo'
    ).includes('Yazma alanin'),
    'a read-only role must never be granted a write area'
  )
  assert(
    !renderDeveloperInstructions({ name: 'dev' , description: 'rol aciklamasi',}, readOnlyRouted, 'demo').includes(
      'src/auth/** altina yazma'
    ),
    'a developer must not be barred from a path whose routed role cannot write'
  )
  // Same reasoning for an undeclared sandbox: the fallback says it cannot
  // write, so it cannot own.
  assert(
    !renderDeveloperInstructions(
      { name: 'ghost', description: 'rol aciklamasi', writesCode: false },
      {
        docLanguage: 'tr',
        routing: [{ path: 'docs/**', role: 'ghost' }],
        agents: [{ name: 'ghost', description: 'rol aciklamasi', writesCode: false }],
      },
      'demo'
    ).includes('Yazma alanin'),
    'a non-writer with no declared sandbox must not be treated as an owner'
  )

  // Routes carry globs. modules/*/docs/** contains modules/pay/docs/guides/**,
  // which a literal prefix comparison does not see.
  const globNested = {
    docLanguage: 'tr',
    routing: [
      { path: 'modules/*/docs/**', role: 'architect' },
      { path: 'modules/pay/docs/guides/**', role: 'doc-writer' },
    ],
    agents: [
      { name: 'architect', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
    ],
  }
  assert(
    renderDeveloperInstructions(
      { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      globNested,
      'demo'
    ).includes(
      '\`modules/*/docs/**\` altina yazma (kendi yolun \`modules/pay/docs/guides/**\` haric)'
    ),
    'the carve-out must see through a wildcard segment in the containing route'
  )
  // `*` spans exactly one segment: modules/*/docs/** does not reach a docs
  // directory nested a level deeper, so no carve-out belongs there.
  assert(
    !renderDeveloperInstructions(
      { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      {
        ...globNested,
        routing: [
          { path: 'modules/*/docs/**', role: 'architect' },
          { path: 'modules/pay/sub/docs/guides/**', role: 'doc-writer' },
        ],
      },
      'demo'
    ).includes('haric'),
    'a single-star segment must not swallow a deeper path'
  )
  // Three patterns a star-stripping comparison got wrong. Each is a valid
  // routing pair, and each produced a contradictory instruction.
  const globCases = [
    // `**` governs everything, so the carve-out is required.
    [['**', 'docs/guides/**'], true, 'a blanket ** route must still carve out a nested owner'],
    // An inner `**` has to be able to match zero segments.
    [
      ['modules/**/docs/**', 'modules/docs/guides/**'],
      true,
      'an inner ** must match zero segments',
    ],
    // `docs/*` reaches one level only, so `docs/a/b/**` is not inside it.
    [
      ['docs/*', 'docs/a/b/**'],
      false,
      'a single-star route must not be treated as covering a deeper path',
    ],
    // …and `docs/a/**` is not inside it either: `docs/a/b` escapes `docs/*`.
    [
      ['docs/*', 'docs/a/**'],
      false,
      'a subtree route is not inside a route that reaches one level',
    ],
    // Same root, different terminal glob: `docs/*` IS inside `docs/**`.
    // Reducing both to the directory `docs` made them look identical, and the
    // identity check then suppressed the exception.
    [
      ['docs/**', 'docs/*'],
      true,
      'a narrower terminal glob under the same root must be carved out',
    ],
    // The reverse does not hold — the wider route is not inside the narrower.
    [
      ['docs/*', 'docs/**'],
      false,
      'a wider route is not inside a narrower one sharing its root',
    ],
    // A trailing `**` covers its own directory. Sampling that directory while
    // the matcher demanded a separator after it lost real containment.
    [
      ['modules/*/docs/**', 'modules/pay/docs/**'],
      true,
      'a concrete subtree is inside the same subtree under a wildcard segment',
    ],
    [
      ['modules/*/docs/**', 'modules/pay/docs'],
      true,
      'a wildcard-free route is inside the subtree that contains it',
    ],
    // `*` matches every one-segment path, so it is not inside any literal one
    // — whatever that literal is spelled. The comparison represents "some
    // other segment" internally, and if that representative were a string, a
    // route literal equal to it would be indistinguishable from it.
    [
      ['any-other-segment', '*'],
      false,
      'a route literal must not collide with the internal any-other-segment representative',
    ],
    // `a/*` also matches `a/somethingelse`, so it is not inside `a/a`. Deciding
    // this needs a segment that is none of the literals in either route — with
    // only `a` to try, the two look identical.
    [
      ['a/a', 'a/*'],
      false,
      'a wildcard is not contained by a literal that shares every segment name',
    ],
    // Overlapping without containment: `docs/y/z` is in `docs/*/*` and not in
    // `docs/x/*`, so the narrower route must not be carved out of it.
    [
      ['docs/x/*', 'docs/*/*'],
      false,
      'routes that merely overlap must not produce a carve-out',
    ],
    // A route with no wildcard names a directory and governs what is under it.
    [['docs', 'docs/guides/**'], true, 'a wildcard-free route governs its subtree'],
    // Two roles on the same path: neither is inside the other, so the
    // prohibition carries no exception.
    [['**', '**'], false, 'a route identical to the prohibited one is not nested in it'],
  ]
  for (const [[outer, inner], wantCarve, why] of globCases) {
    const rendered = renderDeveloperInstructions(
      { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
      {
        docLanguage: 'tr',
        routing: [
          { path: outer, role: 'architect' },
          { path: inner, role: 'doc-writer' },
        ],
        agents: [
          { name: 'architect', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
          { name: 'doc-writer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'workspace-write' },
        ],
      },
      'demo'
    )
    assert(rendered.includes('haric') === wantCarve, why)
  }

  // A code directory that merely reads like documentation belongs to the role
  // that writes code there; a routing row without a role names nobody.
  const lookalikeManifest = {
    docLanguage: 'tr',
    routing: [{ path: 'docsite/**', role: 'web' }, { path: 'docs/**' }],
    agents: [{ name: 'web' , description: 'rol aciklamasi',}, { name: 'dev' , description: 'rol aciklamasi',}],
  }
  const lookalike = renderDeveloperInstructions({ name: 'dev' , description: 'rol aciklamasi',}, lookalikeManifest, 'demo')
  assert(
    !lookalike.includes('docsite'),
    'a directory owned by a code-writing role is not documentation'
  )
  assert(
    !lookalike.includes('undefined'),
    'a routing row without a role must not reach the instructions'
  )

  const ownerlessManifest = { docLanguage: 'tr', routing: [], agents: [] }
  const soloDev = renderDeveloperInstructions({ name: 'dev' , description: 'rol aciklamasi',}, ownerlessManifest, 'demo')
  assert(
    !/altina yazma; orasi/.test(soloDev),
    'without a docs owner a developer must not be barred from an unowned directory'
  )
  const soloReviewer = renderDeveloperInstructions(
    { name: 'reviewer', description: 'rol aciklamasi', writesCode: false },
    ownerlessManifest,
    'demo'
  )
  assert(
    !soloReviewer.includes('Yazma alanin'),
    'without a docs owner a read-only role must not be granted a write area'
  )
  assert(
    soloReviewer.includes('Dosya degistirme; yalniz okur'),
    'a non-writing role with no owned route must be told it writes nothing'
  )

  // OpenCode agent md — only architect targets opencode (developer is claude-only).
  assert(
    await exists('.opencode/agents/architect.md'),
    '.opencode/agents/architect.md missing'
  )
  assert(
    !(await exists('.opencode/agents/developer.md')),
    'developer should not have an opencode agent md'
  )
  const ocAgent = await read('.opencode/agents/architect.md')
  assert(ocAgent.startsWith('---\n'), 'opencode agent md must start with frontmatter')
  assert(ocAgent.includes('mode: primary'), 'lead should map to mode: primary')
  assert(
    ocAgent.includes('model: anthropic/claude-opus-4'),
    'opencode agent md should use opencode_model'
  )
  // Permissions follow sandbox_mode, not writesCode: this architect is
  // doc-only (writesCode:false) yet owns docs/, so it must be able to edit.
  assert(
    ocAgent.includes('edit: allow'),
    'a doc-only owner with workspace-write must be allowed to edit'
  )
  assert(
    ocAgent.includes('bash: ask'),
    'a role that writes no code must not be handed bash outright'
  )
  const ocSource = '---\nname: x\n---\n\nbody'
  const ocReadOnly = renderOpencodeAgentMd(
    { name: 'reviewer', description: 'rol aciklamasi', writesCode: false, sandbox_mode: 'read-only' },
    manifest,
    ocSource
  )
  assert(
    ocReadOnly.includes('edit: deny') && ocReadOnly.includes('bash: ask'),
    'a read-only role must be denied edits'
  )
  const ocDev = renderOpencodeAgentMd(
    { name: 'dev', description: 'rol aciklamasi', sandbox_mode: 'workspace-write' },
    manifest,
    ocSource
  )
  assert(
    ocDev.includes('edit: allow') && ocDev.includes('bash: allow'),
    'a code-writing role keeps edit and bash'
  )
  // No declared sandbox: fall back to the conservative writesCode reading
  // rather than widening permissions by omission.
  const ocUndeclared = renderOpencodeAgentMd(
    { name: 'ghost', description: 'rol aciklamasi', writesCode: false },
    manifest,
    ocSource
  )
  assert(
    ocUndeclared.includes('edit: deny'),
    'a non-writer without a declared sandbox must not gain edit rights'
  )
  assert(
    ocAgent.includes('.opencode/skills/demo-skill/SKILL.md'),
    'opencode body should rewrite skill paths to .opencode/skills'
  )
  assert(
    !ocAgent.includes('.claude/skills/'),
    'opencode body should not retain .claude/skills paths'
  )
  assert(!/^---[\s\S]*name: architect/.test(ocAgent.split('\n\n')[0]),
    'opencode frontmatter should replace the source Claude frontmatter (no leftover name:)')

  // OpenCode project files.
  assert(await exists('opencode.json'), 'opencode.json missing')
  const ocJson = await read('opencode.json')
  assert(!ocJson.startsWith('#'), 'opencode.json must not carry the # generated header (invalid JSON)')
  JSON.parse(ocJson) // must remain valid JSON
  assert(await exists('.opencode/team.md'), '.opencode/team.md missing')
  assert(
    normalizeText(await read('.opencode/team.md')).startsWith(GENERATED_HEADER),
    '.opencode/team.md should carry the generated header'
  )
  assert(
    await exists('.opencode/skills/demo-skill/SKILL.md'),
    '.opencode/skills/demo-skill/SKILL.md missing (opencode skills mirror)'
  )

  // Project files.
  assert(await exists('CLAUDE.md'), 'CLAUDE.md missing')
  assert(await exists('AGENTS.md'), 'AGENTS.md missing (codex/opencode target present)')
  assert(
    normalizeText(await read('CLAUDE.md')) === GENERATED_HEADER + normalizeText(claudeMd),
    'CLAUDE.md should be header + source'
  )

  // Skills → both .claude and .agents.
  assert(
    await exists('.claude/skills/demo-skill/SKILL.md'),
    '.claude/skills/demo-skill/SKILL.md missing'
  )
  assert(
    await exists('.agents/skills/demo-skill/SKILL.md'),
    '.agents/skills/demo-skill/SKILL.md missing'
  )

  // Preserve user-authored files not generated from the canonical source.
  const handWritten = path.join(fixtureRoot, '.claude', 'agents', 'my-helper.md')
  const handWrittenBody = '---\nname: my-helper\n---\n\n# Elle yazdigim\n'
  await fs.writeFile(handWritten, handWrittenBody)
  await fs.mkdir(path.join(fixtureRoot, '.claude', 'skills', 'my-own-skill'), {
    recursive: true,
  })
  const handSkillBody = '---\nname: my-own-skill\ndescription: elle\n---\n\n# Elle\n'
  await fs.writeFile(
    path.join(fixtureRoot, '.claude', 'skills', 'my-own-skill', 'SKILL.md'),
    handSkillBody
  )

  await silentGenerate({ root: fixtureRoot, checkOnly: false })

  assert(
    await exists('.claude/agents/my-helper.md'),
    'hand-written agent must survive sync'
  )
  assert(
    normalizeText(await read('.claude/agents/my-helper.md')) ===
      normalizeText(handWrittenBody),
    'hand-written agent must not be rewritten'
  )
  assert(
    await exists('.claude/skills/my-own-skill/SKILL.md'),
    'hand-written skill must survive sync'
  )
  assert(
    normalizeText(await read('.claude/skills/my-own-skill/SKILL.md')) ===
      normalizeText(handSkillBody),
    'hand-written skill must not be rewritten'
  )

  // The ledger lists every generated target, sorted, and never itself.
  assert(
    await exists('.agent-source/generated-files.json'),
    'ledger .agent-source/generated-files.json must be written'
  )
  const ledger = JSON.parse(await read('.agent-source/generated-files.json'))
  const expectedLedger = [
    '.agents/skills/demo-skill/SKILL.md',
    '.agents/skills/work-plan/SKILL.md',
    '.claude/agents/architect.md',
    '.claude/agents/developer.md',
    '.claude/skills/demo-skill/SKILL.md',
    '.claude/skills/work-plan/SKILL.md',
    '.codex/agent-definitions/architect.md',
    '.codex/agents/architect.toml',
    '.codex/config.toml',
    '.codex/team.md',
    '.opencode/agents/architect.md',
    '.opencode/skills/demo-skill/SKILL.md',
    '.opencode/skills/work-plan/SKILL.md',
    '.opencode/team.md',
    'AGENTS.md',
    'CLAUDE.md',
    'opencode.json',
  ]
  assert(
    JSON.stringify(ledger.files) === JSON.stringify(expectedLedger),
    `ledger must equal the full sorted target list\n  got:      ${JSON.stringify(ledger.files)}\n  expected: ${JSON.stringify(expectedLedger)}`
  )

  // --check should be clean right after generate (idempotent).
  const checkClean = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(checkClean.ok === true, '--check should be clean after generate')
  assert(
    (checkClean.mismatches ?? []).length === 0,
    '--check should report zero mismatches after generate'
  )

  // Corrupt a generated file → --check must detect drift.
  await fs.writeFile(
    path.join(fixtureRoot, '.claude', 'agents', 'architect.md'),
    'CORRUPTED CONTENT\n'
  )
  const checkDrift = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(checkDrift.ok === false, '--check should fail after corruption')
  assert(
    checkDrift.mismatches.some(m => m.includes('.claude/agents/architect.md')),
    '--check should report the corrupted file as drift'
  )

  // S1 — the work-plan skill source mirrors into every ecosystem skill dir.
  // The mirror is name-agnostic; this case exists so a name-based exception
  // cannot be added without turning the selftest red. Content is compared, not
  // just existence: sync never deletes, so a stale file would pass a bare
  // existence check. Asserted here, while all three ecosystems are still
  // targeted and nothing has gone stale yet.
  for (const mirror of ['.claude/skills', '.agents/skills', '.opencode/skills']) {
    const rel = `${mirror}/work-plan/SKILL.md`
    assert(await exists(rel), `S1: work-plan skill must mirror into ${mirror}`)
    assert(
      (await read(rel)) === workPlanSkillMd,
      `S1: ${rel} must match the canonical source byte for byte`
    )
  }

  // Skill mirrors go stale too, same contract as agent files: removing a
  // skill's SOURCE must be reported for every ecosystem mirror it fed. Run
  // before the manifest trim below, while opencode is still an active target
  // — otherwise losing the last opencode agent would also make the opencode
  // mirror stale for an unrelated reason and confound the assertion.
  await fs.rm(path.join(sourceRoot, 'skills', 'demo-skill'), { recursive: true })
  const skillMirrors = [
    '.claude/skills/demo-skill/SKILL.md',
    '.agents/skills/demo-skill/SKILL.md',
    '.opencode/skills/demo-skill/SKILL.md',
  ]
  const skillStaleRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  for (const mirror of skillMirrors) {
    assert(await exists(mirror), `${mirror} must NOT be deleted, only reported`)
    assert(
      skillStaleRun.mismatches.includes(`${mirror} (stale)`),
      `${mirror} must be reported exactly as "${mirror} (stale)"`
    )
  }

  // Persists on a second consecutive sync, same contract as agent staleness.
  const skillStaleRunAgain = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  for (const mirror of skillMirrors) {
    assert(
      skillStaleRunAgain.mismatches.includes(`${mirror} (stale)`),
      `${mirror} must still be reported as stale on a second consecutive sync`
    )
  }

  // Persists on --check too, without rewriting the ledger.
  const ledgerBeforeSkillCheck = await read('.agent-source/generated-files.json')
  const skillStaleCheck = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  for (const mirror of skillMirrors) {
    assert(
      skillStaleCheck.mismatches.includes(`${mirror} (stale)`),
      `${mirror} must be reported as stale by --check too`
    )
  }
  assert(
    (await read('.agent-source/generated-files.json')) === ledgerBeforeSkillCheck,
    '--check must not rewrite the ledger for stale skill mirrors either'
  )

  // Dropping an agent that fed three targets: the files STAY on disk and
  // every one of them is reported as stale. Placed after the clean/drift
  // checks above (rather than immediately after the ledger assert) because
  // it permanently trims the manifest for the rest of this fixture — running
  // it earlier would pull architect out of the ledger before the drift test
  // above gets to exercise it.
  const trimmedManifest = {
    ...manifest,
    // Dropping architect also drops every reference to it: a consults entry
    // or a routing row naming a removed agent is rejected, which is the same
    // rule the wizard follows when a team has no architect — and there the
    // docs row disappears with its owner.
    routing: manifest.routing.filter(r => r.role !== 'architect'),
    agents: manifest.agents
      .filter(a => a.name !== 'architect')
      .map(a => ({ ...a, consults: (a.consults ?? []).filter(c => c !== 'architect') })),
    lead: 'developer',
  }
  await fs.writeFile(
    path.join(sourceRoot, 'agents', 'manifest.json'),
    JSON.stringify(trimmedManifest, null, 2)
  )
  await fs.rm(path.join(sourceRoot, 'agents', 'architect.md'))

  const staleTargets = [
    '.claude/agents/architect.md',
    '.codex/agent-definitions/architect.md',
    '.codex/agents/architect.toml',
    '.opencode/agents/architect.md',
  ]

  // --check reports the staleness against the ledger as the original sync
  // left it (before this trim), and rewrites nothing, deletes nothing. (A
  // later real sync no longer makes staleness disappear either — the union
  // in generate() keeps carrying it forward on every run — this ordering
  // just exercises --check against a ledger the trim hasn't touched yet.)
  const ledgerBefore = await read('.agent-source/generated-files.json')
  const staleCheck = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  for (const target of staleTargets) {
    assert(
      staleCheck.mismatches.includes(`${target} (stale)`),
      `--check must report ${target} as stale`
    )
    assert(await exists(target), `--check must never delete ${target}`)
  }
  assert(
    (await read('.agent-source/generated-files.json')) === ledgerBefore,
    '--check must not rewrite the ledger'
  )

  const staleRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  for (const target of staleTargets) {
    assert(await exists(target), `${target} must NOT be deleted, only reported`)
    assert(
      staleRun.mismatches.includes(`${target} (stale)`),
      `${target} must be reported exactly as "${target} (stale)"`
    )
  }

  // A hand-written file is never reported: it was never in the ledger.
  assert(
    !staleRun.mismatches.some(m => m.includes('my-helper.md')),
    'hand-written files must never be reported as stale'
  )
  assert(
    !staleRun.mismatches.some(m => m.includes('my-own-skill')),
    'hand-written skills must never be reported as stale'
  )

  // A stale target that becomes a dangling symlink must still be reported
  // and retained. pathExists (fs.access, follows symlinks) would call a
  // dangling symlink "absent" and silently drop it from the ledger forever;
  // reportStaleGenerated must use an lstat-based check instead, which sees
  // the symlink itself regardless of where it points.
  const danglingStaleTarget = '.codex/agent-definitions/architect.md'
  await fs.rm(path.join(fixtureRoot, danglingStaleTarget))
  await fs.symlink(
    path.join(fixtureRoot, 'does-not-exist-target'),
    path.join(fixtureRoot, danglingStaleTarget)
  )
  const danglingRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    danglingRun.mismatches.includes(`${danglingStaleTarget} (stale)`),
    'a dangling symlink stale target must still be reported, not silently dropped'
  )
  assert(
    JSON.parse(await read('.agent-source/generated-files.json')).files.includes(
      danglingStaleTarget
    ),
    'a dangling symlink stale target must remain retained in the ledger'
  )

  // The whole point of the ledger: staleness must be reported EVERY run, not
  // just the run it was first noticed on. A second consecutive sync (no
  // further changes) must still report all four targets — this is what
  // catches the ledger being written from ctx.produced alone instead of the
  // union with the previous ledger's still-on-disk entries.
  const staleRunAgain = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  for (const target of staleTargets) {
    assert(
      staleRunAgain.mismatches.includes(`${target} (stale)`),
      `${target} must still be reported as stale on a second consecutive sync`
    )
  }

  // --check must report that same persistent staleness, must exit 1 while
  // doing so (verification requirement 8), and must not rewrite the ledger
  // while doing so (checked via byte-identical content).
  const ledgerBeforeStaleRecheck = await read('.agent-source/generated-files.json')
  // Reset first: the earlier corruption test's --check already set exitCode
  // to 1, so asserting it below without resetting would pass vacuously even
  // if this --check call itself never touched exitCode.
  process.exitCode = 0
  const staleRecheck = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  for (const target of staleTargets) {
    assert(
      staleRecheck.mismatches.includes(`${target} (stale)`),
      `${target} must be reported as stale by --check too`
    )
  }
  assert(
    process.exitCode === 1,
    '--check must exit with code 1 while persistent staleness remains'
  )
  assert(
    (await read('.agent-source/generated-files.json')) === ledgerBeforeStaleRecheck,
    '--check must not rewrite the ledger even when stale paths are present'
  )

  // Deleting one stale file from disk (the user cleaning it up by hand) must
  // drop only that path from the ledger; the rest stay reported. Uses a
  // target other than '.claude/agents/architect.md', which later assertions
  // ("a missing ledger must not cause any deletion") still expect present.
  const removedStaleTarget = '.codex/agents/architect.toml'
  await fs.rm(path.join(fixtureRoot, removedStaleTarget))
  const afterDeleteRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    !afterDeleteRun.mismatches.includes(`${removedStaleTarget} (stale)`),
    `${removedStaleTarget} must stop being reported once removed from disk`
  )
  for (const target of staleTargets) {
    if (target === removedStaleTarget) continue
    assert(
      afterDeleteRun.mismatches.includes(`${target} (stale)`),
      `${target} must still be reported as stale after an unrelated stale file was removed`
    )
  }
  assert(
    !JSON.parse(await read('.agent-source/generated-files.json')).files.includes(
      removedStaleTarget
    ),
    'the ledger must drop a stale path once the file is gone from disk'
  )

  // A malformed ledger is not an error: no report, and it gets rewritten.
  await fs.writeFile(
    path.join(fixtureRoot, '.agent-source', 'generated-files.json'),
    '{ bu gecerli JSON degil'
  )
  const brokenRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    !brokenRun.mismatches.some(m => m.endsWith('(stale)')),
    'a malformed ledger must produce no stale report'
  )
  assert(
    Array.isArray(
      JSON.parse(await read('.agent-source/generated-files.json')).files
    ),
    'a malformed ledger must be rewritten'
  )

  // No ledger means no report even though a genuinely stale target exists.
  await fs.rm(path.join(fixtureRoot, '.agent-source', 'generated-files.json'))
  const noLedgerRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    !noLedgerRun.mismatches.some(m => m.endsWith('(stale)')),
    'a missing ledger must produce no stale report (migration safety)'
  )
  assert(
    await exists('.claude/agents/architect.md'),
    'a missing ledger must not cause any deletion'
  )
  assert(
    await exists('.agent-source/generated-files.json'),
    'a missing ledger must be recreated'
  )

  // Idempotence: a second consecutive sync must report zero writes.
  const secondRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    (secondRun.writes ?? []).length === 0,
    `a second consecutive sync must write nothing, wrote: ${JSON.stringify(secondRun.writes)}`
  )

  // S2 — .agent-work/ is the agents' workspace, not generated output. Sync
  // must leave it alone: no production, no deletion, no rewriting, no ledger
  // ownership, and no drift.
  const workDir = path.join(fixtureRoot, '.agent-work', 'draft')
  const workFile = path.join(workDir, '20260808-01-ornek.md')
  const workBody = '---\nid: 20260808-01\n---\n\n<!-- s:progress -->\n'
  await fs.mkdir(workDir, { recursive: true })
  await fs.writeFile(workFile, workBody)

  await silentGenerate({ root: fixtureRoot })

  assert(
    (await fs.readFile(workFile, 'utf8')) === workBody,
    'S2: sync must leave files under .agent-work/ byte-identical'
  )

  // Reset first: the earlier drift tests already set exitCode to 1, so
  // asserting it below without resetting would pass vacuously.
  process.exitCode = 0
  const s2Check = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(s2Check.ok === true, 'S2: .agent-work/ content must not produce drift')
  assert(
    process.exitCode === 0,
    'S2: a clean --check must not set a failure exit code'
  )

  const s2Ledger = await read(LEDGER_RELATIVE)
  assert(
    !s2Ledger.includes('.agent-work'),
    'S2: the ledger must not claim ownership of .agent-work/'
  )

  // A source file that lost its instructions reference still generates a valid
  // looking target and passes drift check — the project silently loses all of
  // its governance. The warning is the only thing standing between the user and
  // that outcome, so it has its own case.
  {
    await fs.writeFile(
      path.join(sourceRoot, 'project', 'CLAUDE.md'),
      '# CLAUDE\n\nProje talimati.\n'
    )
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...a) => warnings.push(a.join(' '))
    try {
      await generate({ root: fixtureRoot, checkOnly: false })
    } finally {
      console.warn = originalWarn
    }
    assert(
      warnings.some(w => w.includes(INSTRUCTIONS_REF)),
      `expected a warning naming ${INSTRUCTIONS_REF}, got: ${warnings.join(' | ') || '(none)'}`
    )
    await fs.writeFile(
      path.join(sourceRoot, 'project', 'CLAUDE.md'),
      `# CLAUDE\n\n@${INSTRUCTIONS_REF}\n\nProje talimati.\n`
    )
  }

  // Cleanup.
  await fs.rm(fixtureRoot, { recursive: true, force: true })

  await runOpencodeOnlySelftest()

  // Reset exitCode (the --check drift runs above set process.exitCode = 1).
  process.exitCode = 0
  console.log('SELFTEST PASS')
}

// OpenCode-only project: no ecosystem is implied, so nothing Claude-specific
// may be emitted even though the source tree still carries a CLAUDE.md.
async function runOpencodeOnlySelftest() {
  const fixtureRoot = path.join(os.tmpdir(), 'tb-sync-selftest-opencode')
  const sourceRoot = path.join(fixtureRoot, '.agent-source')

  await fs.rm(fixtureRoot, { recursive: true, force: true })
  await fs.mkdir(path.join(sourceRoot, 'agents'), { recursive: true })
  await fs.mkdir(path.join(sourceRoot, 'project'), { recursive: true })
  await fs.mkdir(path.join(sourceRoot, 'skills', 'demo-skill'), { recursive: true })

  // targetsDefault is the only target declaration — agents omit `targets`.
  const manifest = {
    targetsDefault: ['opencode'],
    docLanguage: 'tr',
    lead: 'architect',
    agents: [
      {
        name: 'architect',
        description: 'Mimari kararlar icin.',
        opencode_model: 'openai/gpt-5',
        writesCode: false,
        consults: [],
        extra_instructions: [],
      },
    ],
  }
  await fs.writeFile(
    path.join(sourceRoot, 'agents', 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )
  await fs.writeFile(
    path.join(sourceRoot, 'agents', 'architect.md'),
    '---\nname: architect\ndescription: Mimari kararlar icin.\nmodel: opus\n---\n\n# Architect\n\nSkill: .claude/skills/demo-skill/SKILL.md\n'
  )
  // Present in the source but must NOT be emitted: claude is not a target.
  await fs.writeFile(path.join(sourceRoot, 'project', 'CLAUDE.md'), '# CLAUDE\n')
  await fs.writeFile(path.join(sourceRoot, 'project', 'AGENTS.md'), '# AGENTS\n')
  await fs.writeFile(
    path.join(sourceRoot, 'project', 'opencode.json'),
    '{\n  "$schema": "https://opencode.ai/config.json"\n}\n'
  )
  await fs.writeFile(path.join(sourceRoot, 'skills', 'demo-skill', 'SKILL.md'), '# Demo\n')

  await silentGenerate({ root: fixtureRoot, checkOnly: false })
  const exists = rel => pathExists(path.join(fixtureRoot, rel))

  // Claude outputs must be absent.
  assert(!(await exists('CLAUDE.md')), 'opencode-only: CLAUDE.md must not be generated')
  assert(
    !(await exists('.claude/agents/architect.md')),
    'opencode-only: .claude/agents must not be generated'
  )
  assert(
    !(await exists('.claude/skills/demo-skill/SKILL.md')),
    'opencode-only: .claude/skills must not be generated'
  )

  // OpenCode outputs must be present — driven by targetsDefault alone.
  assert(
    await exists('.opencode/agents/architect.md'),
    'opencode-only: .opencode/agents/architect.md missing'
  )
  assert(await exists('opencode.json'), 'opencode-only: opencode.json missing')
  // OpenCode validates opencode.json strictly: any key outside its schema — a
  // "//" note key included — makes it refuse to start with "Unrecognized key".
  const ocConfig = JSON.parse(await readText(path.join(fixtureRoot, 'opencode.json')))
  const noteKeys = Object.keys(ocConfig).filter(k => k.startsWith('/'))
  assert(
    noteKeys.length === 0,
    `opencode-only: opencode.json must carry no comment key (found: ${noteKeys.join(', ')})`
  )
  assert(await exists('AGENTS.md'), 'opencode-only: AGENTS.md missing')
  assert(
    await exists('.opencode/skills/demo-skill/SKILL.md'),
    'opencode-only: .opencode/skills mirror missing'
  )
  assert(
    await exists('.agents/skills/demo-skill/SKILL.md'),
    'opencode-only: .agents/skills mirror missing'
  )

  const check = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(check.ok === true, 'opencode-only: --check should be clean after generate')

  await fs.rm(fixtureRoot, { recursive: true, force: true })
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const checkOnly = argv.includes('--check')
  const selftest = argv.includes('--selftest')
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx !== -1 && argv[rootIdx + 1] ? argv[rootIdx + 1] : process.cwd()
  return { checkOnly, selftest, root }
}

async function main() {
  const { checkOnly, selftest, root } = parseArgs(process.argv.slice(2))
  if (selftest) {
    await runSelftest()
    return
  }
  await generate({ root, checkOnly })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

export {
  generate,
  renderCodexAgentToml,
  renderDeveloperInstructions,
  codexAgentDefinition,
  renderOpencodeAgentMd,
  opencodeModel,
}
