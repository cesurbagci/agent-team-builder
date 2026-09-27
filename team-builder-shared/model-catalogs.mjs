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
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Measured: `codex debug models` 1.0 s cold and 0.03 s cached, `opencode
// models` 1.3–2.0 s. The ceiling only matters when a CLI hangs.
export const CATALOG_TIMEOUT_MS = 10_000

const CATALOG_COMMANDS = {
  codex: ['codex', ['debug', 'models']],
  opencode: ['opencode', ['models']],
}

// A catalog CLI runs with the project root as its working directory, so no
// lookup may reach the working directory — not ours for the CLI, and not the
// CLI's own (npm's Windows shim runs `node`; on POSIX, `#!/usr/bin/env node`).
// Windows tries the working directory first; an empty or relative PATH entry
// means it on every platform; on Windows `\bin` is relative to the drive.

const WINDOWS_EXECUTABLE_EXTENSIONS = ['.COM', '.EXE', '.BAT', '.CMD']

// Environment variable names are case-insensitive on Windows (`Path`).
function envValue(env, name, platform) {
  if (platform !== 'win32') return env[name]
  const key = Object.keys(env).find(candidate => candidate.toUpperCase() === name.toUpperCase())
  return key === undefined ? undefined : env[key]
}

function isFullyQualified(dir, platform) {
  if (platform === 'win32') return /^[A-Za-z]:[\\/]/.test(dir) || /^\\\\[^\\]/.test(dir)
  return path.posix.isAbsolute(dir)
}

// The PATH directories that are safe to search, in order. Windows allows a
// quoted entry; the quotes are not part of the directory.
function pathEntries(env, platform) {
  const delimiter = platform === 'win32' ? ';' : ':'
  return (envValue(env, 'PATH', platform) ?? '')
    .split(delimiter)
    .map(dir => (platform === 'win32' ? dir.replace(/^"(.*)"$/, '$1') : dir))
    .filter(dir => isFullyQualified(dir, platform))
}

// PATHEXT order, but only what CreateProcess or cmd.exe can start: a `.JS` or
// `.VBS` earlier on PATH would otherwise hide the real wrapper.
function windowsExtensions(env) {
  const listed = (envValue(env, 'PATHEXT', 'win32') || '')
    .split(';')
    .map(extension => extension.trim().toUpperCase())
    .filter(extension => WINDOWS_EXECUTABLE_EXTENSIONS.includes(extension))
  return listed.length > 0 ? listed : WINDOWS_EXECUTABLE_EXTENSIONS
}

export function resolveCommand(
  command,
  { env = process.env, platform = process.platform, isFile = isExecutableFile } = {}
) {
  if (isFullyQualified(command, platform)) return isFile(command, platform) ? command : null
  const pathApi = platform === 'win32' ? path.win32 : path.posix
  const extensions = platform === 'win32' ? windowsExtensions(env) : ['']
  for (const dir of pathEntries(env, platform)) {
    for (const extension of extensions) {
      const candidate = pathApi.join(dir, command + extension)
      if (isFile(candidate, platform)) return candidate
    }
  }
  return null
}

// Like execvp: a file that cannot be executed does not hide a later one.
function isExecutableFile(file, platform) {
  try {
    if (!fs.statSync(file).isFile()) return false
    if (platform !== 'win32') fs.accessSync(file, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

// The CLI's own lookups get the same fully qualified PATH. On Windows,
// NoDefaultCurrentDirectoryInExePath stops cmd.exe and CreateProcess from
// trying the working directory first.
export function childEnv(env = process.env, platform = process.platform) {
  const child = {}
  for (const [key, value] of Object.entries(env)) {
    const isPath = platform === 'win32' ? key.toUpperCase() === 'PATH' : key === 'PATH'
    if (!isPath) child[key] = value
  }
  // An empty PATH would mean "search the working directory" to execvp; with no
  // PATH at all it falls back to its own absolute default.
  const entries = pathEntries(env, platform)
  if (entries.length > 0) child.PATH = entries.join(platform === 'win32' ? ';' : ':')
  if (platform === 'win32') child.NoDefaultCurrentDirectoryInExePath = '1'
  return child
}

// npm installs CLIs on Windows as .cmd wrappers, which only run through cmd.exe.
export function needsShell(file, platform = process.platform) {
  return platform === 'win32' && /\.(cmd|bat)$/i.test(file)
}

// Without ComSpec, Node would start a bare `cmd.exe` — looked up in the working
// directory first.
function windowsShell(env) {
  const comspec = envValue(env, 'ComSpec', 'win32')
  if (comspec && isFullyQualified(comspec, 'win32')) return comspec
  const systemRoot = envValue(env, 'SystemRoot', 'win32')
  const root = systemRoot && isFullyQualified(systemRoot, 'win32') ? systemRoot : 'C:\\Windows'
  return path.win32.join(root, 'System32', 'cmd.exe')
}

function execToString(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => (error ? reject(error) : resolve(stdout)))
  })
}

// cwd: the project root. A catalog can depend on the project's own config
// (OpenCode adds the providers in its opencode.json), and sync may be started
// from anywhere with --root. A CLI that is not on PATH is reported as ENOENT,
// which readCatalogs treats as "not installed".
export function runCli(
  command,
  args,
  cwd,
  { resolveFile = resolveCommand, env = process.env, platform = process.platform } = {}
) {
  const file = resolveFile(command, { env, platform })
  if (file === null) {
    const missing = new Error(`${command} is not on PATH`)
    missing.code = 'ENOENT'
    return Promise.reject(missing)
  }
  const options = {
    cwd,
    env: childEnv(env, platform),
    timeout: CATALOG_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  }
  if (!needsShell(file, platform)) return execToString(file, args, options)
  // One command line: passing args together with `shell` is deprecated
  // (DEP0190). The arguments are constants, so nothing can be injected; the
  // path is quoted because it may contain spaces.
  return execToString(`"${file}" ${args.join(' ')}`, [], { ...options, shell: windowsShell(env) })
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
  // Windows: a quoted entry is a directory; `\bin` (drive-relative) is not; a
  // .JS earlier in PATHEXT is not something execFile can start.
  const toolsFiles = new Set(['c:\\tools\\codex.cmd', '\\bin\\codex.exe', 'c:\\scripts\\codex.js'])
  const windowsLookup = (PATH, PATHEXT = '.COM;.EXE;.BAT;.CMD') =>
    resolveCommand('codex', {
      env: { Path: PATH, PATHEXT },
      platform: 'win32',
      isFile: file => toolsFiles.has(file.toLowerCase()),
    })
  assert(
    windowsLookup('"C:\\Tools"') === 'C:\\Tools\\codex.CMD',
    'a quoted Windows PATH entry must be searched without its quotes'
  )
  assert(windowsLookup('\\bin') === null, 'a drive-relative Windows PATH entry must be skipped')
  assert(
    windowsLookup('C:\\scripts;C:\\Tools', '.JS;.CMD') === 'C:\\Tools\\codex.CMD',
    'a PATHEXT extension execFile cannot start must not hide the real wrapper'
  )

  // The CLI's own lookups get the same PATH: npm's Windows shim runs `node`,
  // and `#!/usr/bin/env node` searches PATH too.
  const posixChild = childEnv({ PATH: '/usr/bin::./bin:relative:/opt/tools', HOME: '/h' }, 'linux')
  assert(
    posixChild.PATH === '/usr/bin:/opt/tools' &&
      posixChild.HOME === '/h' &&
      !('NoDefaultCurrentDirectoryInExePath' in posixChild),
    `the child PATH must keep only fully qualified entries, got ${JSON.stringify(posixChild)}`
  )
  assert(
    !('PATH' in childEnv({ PATH: ':relative' }, 'linux')),
    'with no usable entry the child must get no PATH — an empty one means the working directory'
  )
  const windowsChild = childEnv({ Path: 'C:\\Windows;.;"C:\\Tools";\\bin' }, 'win32')
  assert(
    windowsChild.PATH === 'C:\\Windows;C:\\Tools' &&
      !('Path' in windowsChild) &&
      windowsChild.NoDefaultCurrentDirectoryInExePath === '1',
    `the Windows child must not search the working directory, got ${JSON.stringify(windowsChild)}`
  )

  // runCli starts the file resolveFile found, never the bare command, and hands
  // it the filtered PATH. Node stands in for the CLI.
  const nodeDir = path.dirname(process.execPath)
  const withoutPath = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH')
  )
  const childPath = await runCli(
    'no-such-catalog-cli',
    ['-e', 'process.stdout.write(process.env.PATH)'],
    here,
    {
      resolveFile: () => process.execPath,
      env: { ...withoutPath, PATH: ['', nodeDir, 'relative'].join(path.delimiter) },
    }
  ).catch(error => `rejected: ${error.message}`)
  assert(
    childPath === nodeDir,
    `runCli must start the resolved file with the filtered PATH, got ${JSON.stringify(childPath)}`
  )

  // Not on PATH is ENOENT, which readCatalogs treats as missing. The command is
  // node, so a regression that falls back to the bare command runs nothing real.
  let notOnPath = null
  try {
    await runCli(process.execPath, ['-e', ''], here, { resolveFile: () => null })
  } catch (error) {
    notOnPath = error
  }
  assert(
    notOnPath !== null && notOnPath.code === 'ENOENT',
    'a CLI that is not on PATH must reject with ENOENT, which readCatalogs treats as missing'
  )

  // Like execvp, a file that cannot be executed does not hide a later one.
  if (process.platform !== 'win32') {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-catalog-'))
    try {
      const [first, second] = ['a', 'b'].map(name => path.join(scratch, name))
      for (const dir of [first, second]) fs.mkdirSync(dir)
      fs.writeFileSync(path.join(first, 'fake-cli'), '', { mode: 0o644 })
      fs.writeFileSync(path.join(second, 'fake-cli'), '', { mode: 0o755 })
      assert(
        resolveCommand('fake-cli', { env: { PATH: `${first}:${second}` }, platform: process.platform }) ===
          path.join(second, 'fake-cli'),
        'a non-executable file earlier on PATH must not hide an executable one'
      )
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true })
    }
  }

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
