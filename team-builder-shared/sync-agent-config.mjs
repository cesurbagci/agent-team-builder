#!/usr/bin/env node
// sync-agent-config.mjs — canonical (.agent-source) → generated sync generator.
//
// Generalized from a production agent-team generator:
//   - root comes from `--root <dir>` (default cwd) instead of `__dirname/..`;
//   - developer_instructions are manifest-driven (writesCode, arch-root, consults,
//     docLanguage, constitution presets) instead of project-hardcoded text;
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
const DEFAULT_TARGETS = ['claude', 'codex']
const VALID_TARGETS = new Set(['claude', 'codex', 'opencode'])

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

  const toPosix = filePath =>
    path.relative(resolvedRoot, filePath).split(path.sep).join('/')

  const resolveRoot = (...segments) => path.join(resolvedRoot, ...segments)
  const resolveSource = (...segments) => path.join(sourceRoot, ...segments)

  async function writeExpected(filePath, expected) {
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

  async function removeFile(filePath) {
    if (checkOnly) {
      mismatches.push(`${toPosix(filePath)} (orphan)`)
      return
    }
    await fs.unlink(filePath)
    writes.push(`${toPosix(filePath)} (removed)`)
  }

  // Remove generated files in dirPath that are not in expectedFileNames and
  // match one of allowedExtensions. Subdirs / other files are left untouched.
  async function removeOrphans(dirPath, expectedFileNames, allowedExtensions) {
    if (!(await pathExists(dirPath))) {
      return
    }
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const extension = path.extname(entry.name)
      if (!allowedExtensions.has(extension) || expectedFileNames.has(entry.name)) {
        continue
      }
      await removeFile(path.join(dirPath, entry.name))
    }
  }

  return {
    resolvedRoot,
    sourceRoot,
    checkOnly,
    mismatches,
    writes,
    toPosix,
    resolveRoot,
    resolveSource,
    writeExpected,
    copyExpected,
    removeOrphans,
  }
}

// ---------------------------------------------------------------------------
// agent targets
// ---------------------------------------------------------------------------

function agentTargets(agent, manifest) {
  const fallback = manifest.targetsDefault ?? DEFAULT_TARGETS
  const targets = agent.targets ?? fallback
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error(`Agent ${agent.name} targets must be a non-empty array.`)
  }
  for (const target of targets) {
    if (!VALID_TARGETS.has(target)) {
      throw new Error(`Agent ${agent.name} has unsupported target: ${target}`)
    }
  }
  return new Set(targets)
}

function projectHasTarget(manifest, target) {
  return manifest.agents.some(agent => {
    const targets = agent.targets ?? manifest.targetsDefault ?? DEFAULT_TARGETS
    return Array.isArray(targets) && targets.includes(target)
  })
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

function renderOpencodeAgentMd(agent, manifest, source) {
  const writesCode = agent.writesCode !== false
  const readOnly = agent.sandbox_mode === 'read-only' || !writesCode
  const mode = manifest.lead && agent.name === manifest.lead ? 'primary' : 'subagent'
  const edit = readOnly ? 'deny' : 'allow'
  const bash = readOnly ? 'ask' : 'allow'

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
  const archRoot = manifest.architectureDocs?.root ?? 'docs/mimari'
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

  if (writesCode) {
    lines.push(`- Sadece kendi domain'inde kod yaz; \`${archRoot}/\` altina yazma.`)
  } else {
    lines.push(`- Production kod yazma. Yazma alani prensip olarak \`${archRoot}/\` altidir.`)
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
  const developerInstructions = renderDeveloperInstructions(agent, manifest, projectName)
  return (
    GENERATED_HEADER +
    `name = ${tomlString(agent.name)}\n` +
    `description = ${tomlString(agent.description)}\n` +
    modelLine +
    `model_reasoning_effort = ${tomlString(agent.model_reasoning_effort)}\n` +
    `sandbox_mode = ${tomlString(agent.sandbox_mode)}\n` +
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

async function syncProjectFiles(ctx, manifest) {
  // Project files are templated/compiled generated outputs → prepend header.
  const withHeader = source => GENERATED_HEADER + source

  const claudeSource = ctx.resolveSource('project', 'CLAUDE.md')
  if (await pathExists(claudeSource)) {
    await ctx.copyExpected(claudeSource, ctx.resolveRoot('CLAUDE.md'), withHeader)
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
  // opencode.json is JSON and cannot carry the `#` generated header, so it is
  // copied verbatim (the source file should embed a "//" generated note).
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

  const expectedClaudeAgents = new Set()
  const expectedCodexDefinitions = new Set()
  const expectedCodexToml = new Set()
  const expectedOpencodeAgents = new Set()

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
      expectedClaudeAgents.add(fileName)
      await ctx.copyExpected(source, ctx.resolveRoot('.claude', 'agents', fileName))
    }

    if (targets.has('codex')) {
      const definitionFileName = `${agent.name}.md`
      const tomlFileName = `${agent.name}.toml`
      expectedCodexDefinitions.add(definitionFileName)
      expectedCodexToml.add(tomlFileName)
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
      expectedOpencodeAgents.add(fileName)
      await ctx.copyExpected(
        source,
        ctx.resolveRoot('.opencode', 'agents', fileName),
        src => renderOpencodeAgentMd(agent, manifest, src)
      )
    }
  }

  // Orphan cleanup for generated agent target dirs.
  await ctx.removeOrphans(
    ctx.resolveRoot('.claude', 'agents'),
    expectedClaudeAgents,
    new Set(['.md'])
  )
  await ctx.removeOrphans(
    ctx.resolveRoot('.codex', 'agent-definitions'),
    expectedCodexDefinitions,
    new Set(['.md'])
  )
  await ctx.removeOrphans(
    ctx.resolveRoot('.codex', 'agents'),
    expectedCodexToml,
    new Set(['.toml'])
  )
  await ctx.removeOrphans(
    ctx.resolveRoot('.opencode', 'agents'),
    expectedOpencodeAgents,
    new Set(['.md'])
  )

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
  const hasOpencode = projectHasOpencode(manifest)
  const skillsSource = ctx.resolveSource('skills')
  const files = await listFiles(skillsSource)
  for (const filePath of files) {
    const relative = path.relative(skillsSource, filePath)
    await ctx.copyExpected(filePath, ctx.resolveRoot('.claude', 'skills', relative))
    await ctx.copyExpected(filePath, ctx.resolveRoot('.agents', 'skills', relative))
    if (hasOpencode) {
      await ctx.copyExpected(filePath, ctx.resolveRoot('.opencode', 'skills', relative))
    }
  }
}

// ---------------------------------------------------------------------------
// generate — main pipeline
// ---------------------------------------------------------------------------

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

  const projectName = path.basename(ctx.resolvedRoot)

  await syncProjectFiles(ctx, manifest)
  await syncAgents(ctx, manifest, projectName)
  await syncSkills(ctx, manifest)

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
    // Non-fatal source-listing mismatches surfaced even in sync mode.
    for (const mismatch of ctx.mismatches) {
      warn(`! ${mismatch}`)
    }
  }
  if (ctx.writes.length === 0) {
    log('Agent configuration already in sync.')
    return { ok: true, writes: [] }
  }
  log('Synchronized agent configuration:')
  for (const filePath of ctx.writes) {
    log(`- ${filePath}`)
  }
  return { ok: true, writes: ctx.writes }
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

  // Manifest: 2 agents — one claude+codex, one claude-only.
  const manifest = {
    targetsDefault: ['claude', 'codex'],
    docLanguage: 'tr',
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
    '---\nname: architect\nmodel: opus\n---\n\n# Architect\n\nSkill: .claude/skills/demo-skill/SKILL.md\nDelege: technical-architect ajanina Task tool ile delege et.\n'
  await fs.writeFile(path.join(sourceRoot, 'agents', 'architect.md'), architectBody)

  const developerBody = '---\nname: developer\nmodel: sonnet\n---\n\n# Developer\n\nKod yazar.\n'
  await fs.writeFile(path.join(sourceRoot, 'agents', 'developer.md'), developerBody)

  const claudeMd = '# CLAUDE\n\nProje talimati.\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'CLAUDE.md'), claudeMd)
  const agentsMd = '# AGENTS\n\nCodex/OpenCode talimati.\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'AGENTS.md'), agentsMd)

  const opencodeJson =
    '{\n  "//": "generated from .agent-source, run sync",\n  "$schema": "https://opencode.ai/config.json",\n  "instructions": ["AGENTS.md"]\n}\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'opencode.json'), opencodeJson)
  const opencodeTeam = '# OpenCode Team\n\nTakim sozlesmesi.\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'opencode-team.md'), opencodeTeam)

  const skillMd = '# Demo Skill\n\nDemo.\n'
  await fs.writeFile(
    path.join(sourceRoot, 'skills', 'demo-skill', 'SKILL.md'),
    skillMd
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
  assert(ocAgent.includes('edit: deny'), 'writesCode:false should map to permission edit: deny')
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

  // Orphan detection: a stray generated agent file → drift in --check.
  await fs.writeFile(
    path.join(fixtureRoot, '.codex', 'agents', 'ghost.toml'),
    'orphan\n'
  )
  const checkOrphan = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(
    checkOrphan.mismatches.some(m => m.includes('ghost.toml')),
    '--check should report orphan generated file'
  )

  // Orphan detection for the opencode agents dir too.
  await fs.writeFile(
    path.join(fixtureRoot, '.opencode', 'agents', 'ghost.md'),
    'orphan\n'
  )
  const checkOcOrphan = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(
    checkOcOrphan.mismatches.some(m => m.includes('.opencode/agents/ghost.md')),
    '--check should report orphan opencode agent md'
  )

  // Cleanup.
  await fs.rm(fixtureRoot, { recursive: true, force: true })

  // Reset exitCode (the --check drift runs above set process.exitCode = 1).
  process.exitCode = 0
  console.log('SELFTEST PASS')
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
  codexAgentDefinition,
  renderOpencodeAgentMd,
  opencodeModel,
}
