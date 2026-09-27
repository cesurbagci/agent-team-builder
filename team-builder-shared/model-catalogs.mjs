#!/usr/bin/env node
// model-catalogs.mjs — asks the installed CLIs which models this machine can
// run, and turns resolved choices outside that list into warnings.
//
// A catalog belongs to one machine and one account, and CI has none, so
// nothing here is ever an error. Claude has no catalog command.
//
// Contract: team-builder-shared/llm-config.md.
//
// CLI: node model-catalogs.mjs --selftest

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Measured: `codex debug models` 1.0 s cold and 0.03 s cached, `opencode
// models` 1.3–2.0 s. The ceiling only matters when a CLI hangs.
export const CATALOG_TIMEOUT_MS = 10_000

const CATALOG_COMMANDS = {
  codex: ['codex', ['debug', 'models']],
  opencode: ['opencode', ['models']],
}

// The catalog CLIs are looked up on PATH only, never in the working directory:
// Windows would otherwise try the working directory first, and that is the
// project root, so a `codex.exe` committed to a repository would run on sync.
// An empty or relative PATH entry means the working directory too, so those
// entries are skipped on every platform.
export function resolveCommand(
  command,
  { env = process.env, platform = process.platform, isFile = isRegularFile } = {}
) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix
  if (pathApi.isAbsolute(command)) return isFile(command) ? command : null
  const dirs = (env.PATH ?? env.Path ?? '')
    .split(pathApi.delimiter)
    .filter(dir => dir !== '' && pathApi.isAbsolute(dir))
  const extensions =
    platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : ['']
  for (const dir of dirs) {
    for (const extension of extensions) {
      const candidate = pathApi.join(dir, command + extension)
      if (isFile(candidate)) return candidate
    }
  }
  return null
}

function isRegularFile(file) {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

// npm installs CLIs on Windows as .cmd wrappers, which only run through cmd.exe.
export function needsShell(file, platform = process.platform) {
  return platform === 'win32' && /\.(cmd|bat)$/i.test(file)
}

// cwd: the project root. A catalog can depend on the project's own config
// (OpenCode adds the providers in its opencode.json), and sync may be started
// from anywhere with --root. A CLI that is not on PATH is reported as ENOENT,
// which readCatalogs treats as "not installed".
export function runCli(command, args, cwd, { resolveFile = resolveCommand } = {}) {
  const file = resolveFile(command)
  if (file === null) {
    const missing = new Error(`${command} is not on PATH`)
    missing.code = 'ENOENT'
    return Promise.reject(missing)
  }
  // Through the shell the arguments are constants, so nothing can be injected;
  // the path is quoted because it may contain spaces.
  const viaShell = needsShell(file)
  return new Promise((resolve, reject) => {
    execFile(
      viaShell ? `"${file}"` : file,
      args,
      { cwd, shell: viaShell, timeout: CATALOG_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    )
  })
}

// `codex debug models` prints { models: [{ slug, supported_reasoning_levels:
// [{ effort }], upgrade: { model, retirement_at } | null, visibility, … }] }.
// Hidden models are kept: one chosen on purpose exists all the same.
export function parseCodexCatalog(stdout) {
  const parsed = JSON.parse(stdout)
  if (!parsed || !Array.isArray(parsed.models)) {
    throw new Error('no "models" array')
  }
  const catalog = new Map()
  for (const entry of parsed.models) {
    if (!entry || typeof entry.slug !== 'string') continue
    const upgrade = entry.upgrade
    catalog.set(entry.slug, {
      efforts: (entry.supported_reasoning_levels ?? [])
        .map(level => level?.effort)
        .filter(effort => typeof effort === 'string'),
      upgrade:
        upgrade && typeof upgrade.model === 'string'
          ? { model: upgrade.model, retirementAt: upgrade.retirement_at ?? null }
          : null,
    })
  }
  return catalog
}

// `opencode models` prints one provider/model per line — only for the
// providers configured on this machine.
export function parseOpencodeCatalog(stdout) {
  const models = new Set(
    stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^[^/\s]+\/\S+$/.test(line))
  )
  if (models.size === 0) throw new Error('no provider/model lines')
  return models
}

const PARSERS = { codex: parseCodexCatalog, opencode: parseOpencodeCatalog }

// A missing CLI is silent — the expected case in CI. A CLI that is there but
// fails, times out, or prints something unreadable yields one note, so a
// check that did not run is never mistaken for one that passed.
export async function readCatalogs(ecosystems, run = runCli) {
  const catalogs = { notes: [] }
  for (const ecosystem of ecosystems) {
    if (!CATALOG_COMMANDS[ecosystem]) continue
    const [command, args] = CATALOG_COMMANDS[ecosystem]
    const label = `${command} ${args.join(' ')}`
    let stdout
    try {
      stdout = await run(command, args)
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      const reason = error?.killed ? 'timed out' : (error?.message ?? String(error))
      catalogs.notes.push(`${label} failed (${reason}); ${ecosystem} catalog check skipped`)
      continue
    }
    try {
      catalogs[ecosystem] = PARSERS[ecosystem](stdout)
    } catch (error) {
      catalogs.notes.push(
        `${label} printed something unreadable (${error.message}); ${ecosystem} catalog check skipped`
      )
    }
  }
  return catalogs
}

// entries: [{ agent, ecosystem, model?, effort? }] — the resolved values, i.e.
// what this machine will actually run.
export function catalogWarnings(entries, catalogs) {
  const warnings = []
  const fix = 'run team-builder-models'
  for (const { agent, ecosystem, model, effort } of entries) {
    if (model === undefined) continue // an effort cannot be judged without its model
    const where = `${agent} (${ecosystem})`
    if (ecosystem === 'codex' && catalogs.codex) {
      const known = catalogs.codex.get(model)
      if (!known) {
        warnings.push(`${where}: "${model}" is not in this machine's Codex catalog — ${fix}`)
        continue
      }
      if (effort !== undefined && !known.efforts.includes(effort)) {
        warnings.push(
          `${where}: ${model} does not support effort "${effort}" (supported: ${known.efforts.join(', ')}) — ${fix}`
        )
      }
      if (known.upgrade) {
        const when =
          typeof known.upgrade.retirementAt === 'string'
            ? `retires on ${known.upgrade.retirementAt.slice(0, 10)}`
            : 'is being retired'
        warnings.push(
          `${where}: ${model} ${when}; suggested replacement: ${known.upgrade.model} — ${fix}`
        )
      }
    }
    if (ecosystem === 'opencode' && catalogs.opencode && !catalogs.opencode.has(model)) {
      warnings.push(
        `${where}: "${model}" is not in this machine's OpenCode catalog — its provider may not be configured here; ${fix}`
      )
    }
  }
  return warnings
}

// ---------------------------------------------------------------------------
// selftest — never calls a real CLI
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`SELFTEST FAIL: ${message}`)
}

const levels = efforts => efforts.map(effort => ({ effort }))

const CODEX_FIXTURE = JSON.stringify({
  models: [
    {
      slug: 'gpt-5.6-terra',
      visibility: 'list',
      supported_reasoning_levels: levels(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']),
      upgrade: null,
    },
    {
      slug: 'gpt-5.5',
      visibility: 'list',
      supported_reasoning_levels: levels(['low', 'medium', 'high', 'xhigh']),
      upgrade: {
        model: 'gpt-5.6-sol',
        migration_markdown: 'GPT-5.5 retires on October 14, 2026.',
        retirement_at: '2026-10-14T19:00:00Z',
      },
    },
    {
      slug: 'gpt-reserve',
      visibility: 'hide',
      supported_reasoning_levels: levels(['low']),
      upgrade: null,
    },
  ],
})
const OPENCODE_FIXTURE = 'opencode/big-pickle\nanthropic/claude-opus-5-5\n'

// A stand-in for runCli: a string is stdout, an Error is thrown, and a
// command with no entry behaves like a CLI that is not installed.
function fakeRun(outputs) {
  return async command => {
    const output = outputs[command]
    if (output instanceof Error) throw output
    if (output === undefined) {
      throw Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' })
    }
    return output
  }
}

async function runSelftest() {
  const both = await readCatalogs(
    ['codex', 'opencode'],
    fakeRun({ codex: CODEX_FIXTURE, opencode: OPENCODE_FIXTURE })
  )
  assert(both.codex instanceof Map && both.codex.has('gpt-5.5'), 'the codex catalog must be parsed')
  assert(
    both.opencode instanceof Set && both.opencode.has('anthropic/claude-opus-5-5'),
    'the opencode catalog must be parsed'
  )
  assert(both.notes.length === 0, `no notes when both CLIs answer, got ${JSON.stringify(both.notes)}`)

  const missing = await readCatalogs(['codex', 'opencode'], fakeRun({}))
  assert(
    !missing.codex && !missing.opencode && missing.notes.length === 0,
    `a missing CLI must be skipped silently, got ${JSON.stringify(missing.notes)}`
  )

  const timedOut = await readCatalogs(
    ['codex'],
    fakeRun({ codex: Object.assign(new Error('killed'), { killed: true }) })
  )
  assert(
    !timedOut.codex && timedOut.notes.length === 1 && timedOut.notes[0].includes('timed out'),
    `a timeout must be one note, got ${JSON.stringify(timedOut.notes)}`
  )

  const failing = await readCatalogs(['opencode'], fakeRun({ opencode: new Error('exit 1') }))
  assert(
    !failing.opencode && failing.notes.length === 1 && failing.notes[0].includes('exit 1'),
    `a failing CLI must be one note, got ${JSON.stringify(failing.notes)}`
  )

  const garbage = await readCatalogs(
    ['codex', 'opencode'],
    fakeRun({ codex: 'not json', opencode: 'nothing useful' })
  )
  assert(
    !garbage.codex && !garbage.opencode && garbage.notes.length === 2,
    `unreadable output must be one note per CLI, got ${JSON.stringify(garbage.notes)}`
  )

  const claudeOnly = await readCatalogs(['claude'], fakeRun({}))
  assert(
    claudeOnly.notes.length === 0 && Object.keys(claudeOnly).length === 1,
    'claude has no catalog command'
  )

  // A catalog is read inside the project: `opencode models` lists the providers
  // the project's opencode.json adds only when run there. Node stands in for
  // the CLI, so this still calls no catalog CLI.
  const here = path.dirname(fileURLToPath(import.meta.url))
  const ranIn = await runCli(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], here)
  assert(ranIn === here, `runCli must run in the directory it is given, got ${ranIn}`)

  // PATH lookup never reaches the working directory: empty and relative PATH
  // entries are skipped, and Windows tries each PATHEXT extension.
  const posixFiles = new Set(['codex', 'bin/codex', 'relative/codex', '/opt/tools/codex'])
  assert(
    resolveCommand('codex', {
      env: { PATH: '/usr/bin::./bin:relative:/opt/tools' },
      platform: 'linux',
      isFile: file => posixFiles.has(file),
    }) === '/opt/tools/codex',
    'resolveCommand must skip empty and relative PATH entries'
  )
  // Windows file names are case-insensitive, so the fake file system is too.
  const npmDir = 'C:\\Users\\me\\AppData\\Roaming\\npm'
  const windowsFiles = new Set(['codex.exe', `${npmDir}\\codex.cmd`.toLowerCase()])
  assert(
    resolveCommand('codex', {
      env: { PATH: `C:\\Windows;.;${npmDir}`, PATHEXT: '.COM;.EXE;.BAT;.CMD' },
      platform: 'win32',
      isFile: file => windowsFiles.has(file.toLowerCase()),
    }) === `${npmDir}\\codex.CMD`,
    'resolveCommand must find an npm .cmd wrapper through PATHEXT and never the working directory'
  )
  assert(
    resolveCommand('codex', { env: { PATH: '/usr/bin' }, platform: 'linux', isFile: () => false }) ===
      null,
    'a command that is not on PATH must resolve to null'
  )
  assert(
    needsShell(`${npmDir}\\codex.CMD`, 'win32') &&
      !needsShell(`${npmDir}\\codex.exe`, 'win32') &&
      !needsShell('/usr/local/bin/codex.cmd', 'linux'),
    'only a Windows .cmd/.bat wrapper needs the shell'
  )
  let notOnPath = null
  try {
    await runCli('codex', ['debug', 'models'], here, { resolveFile: () => null })
  } catch (error) {
    notOnPath = error
  }
  assert(
    notOnPath !== null && notOnPath.code === 'ENOENT',
    'a CLI that is not on PATH must reject with ENOENT, which readCatalogs treats as missing'
  )

  const warn = entries => catalogWarnings(entries, both)

  const retiring = warn([{ agent: 'architect', ecosystem: 'codex', model: 'gpt-5.5', effort: 'xhigh' }])
  assert(
    retiring.length === 1 &&
      retiring[0].includes('retires on 2026-10-14') &&
      retiring[0].includes('gpt-5.6-sol'),
    `a retirement must name the date and the replacement, got ${JSON.stringify(retiring)}`
  )

  const unsupported = warn([
    { agent: 'architect', ecosystem: 'codex', model: 'gpt-5.6-terra', effort: 'extreme' },
  ])
  assert(
    unsupported.length === 1 && unsupported[0].includes('does not support effort "extreme"'),
    `an unsupported effort must warn, got ${JSON.stringify(unsupported)}`
  )

  const unknown = warn([{ agent: 'architect', ecosystem: 'codex', model: 'gpt-9' }])
  assert(
    unknown.length === 1 && unknown[0].includes("not in this machine's Codex catalog"),
    `an unknown codex model must warn, got ${JSON.stringify(unknown)}`
  )

  assert(
    warn([{ agent: 'a', ecosystem: 'codex', model: 'gpt-reserve' }]).length === 0,
    'a hidden model is still in the catalog'
  )
  assert(
    warn([{ agent: 'a', ecosystem: 'codex', effort: 'high' }]).length === 0,
    'an effort without its model cannot be judged'
  )
  assert(
    warn([{ agent: 'a', ecosystem: 'opencode', model: 'anthropic/claude-opus-5-5' }]).length === 0,
    'a listed opencode model passes'
  )
  const ocUnknown = warn([{ agent: 'a', ecosystem: 'opencode', model: 'openai/gpt-5' }])
  assert(
    ocUnknown.length === 1 && ocUnknown[0].includes('OpenCode catalog'),
    `an unlisted opencode model must warn, got ${JSON.stringify(ocUnknown)}`
  )
  assert(
    warn([{ agent: 'a', ecosystem: 'claude', model: 'anything-at-all' }]).length === 0,
    'claude is never checked'
  )
  assert(
    catalogWarnings([{ agent: 'a', ecosystem: 'codex', model: 'gpt-9' }], { notes: [] }).length === 0,
    'no catalog, no warning'
  )

  console.log('SELFTEST PASS')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  if (process.argv.includes('--selftest')) {
    runSelftest().catch(error => {
      console.error(error.message)
      process.exitCode = 1
    })
  } else {
    console.error('Usage: node model-catalogs.mjs --selftest')
    process.exitCode = 2
  }
}
