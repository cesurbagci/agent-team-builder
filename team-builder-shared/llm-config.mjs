#!/usr/bin/env node
// llm-config.mjs — reads the two LLM configuration layers and resolves the
// model and effort one agent runs with in one ecosystem.
//
// Contract: team-builder-shared/llm-config.md.
//
// CLI: node llm-config.mjs --selftest

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LLM_SHARED_RELATIVE = '.agent-source/llm.json'
export const LLM_LOCAL_RELATIVE = '.agent-source/llm.local.json'
export const ECOSYSTEMS = ['claude', 'codex', 'opencode']

async function readLayer(root, relative) {
  let text
  try {
    text = await fs.readFile(path.join(root, ...relative.split('/')), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${relative} is not valid JSON: ${error.message}`)
  }
}

// Both layers are optional. A missing file is undefined — never null, which a
// file can hold and validation must reject — and resolution then treats every
// value it would have held as unset.
export async function readLlmLayers(root) {
  return {
    shared: await readLayer(root, LLM_SHARED_RELATIVE),
    local: await readLayer(root, LLM_LOCAL_RELATIVE),
  }
}

// Returns { model?, effort? }. An absent key means "write no line": the
// ecosystem's own default applies.
//
// Four layers, most specific first. The local file always beats the shared
// one; inside a file, an agent's own entry beats `defaults`.
//
// Effort validity depends on the model, so an effort set in a layer below the
// one that chose the model was chosen for a different model and is not carried
// over. With no model anywhere, effort may come from any layer.
export function resolveModelSettings({ shared, local }, agentName, ecosystem) {
  const layers = [
    local?.agents?.[agentName]?.[ecosystem],
    local?.defaults?.[ecosystem],
    shared?.agents?.[agentName]?.[ecosystem],
    shared?.defaults?.[ecosystem],
  ]
  const modelAt = layers.findIndex(layer => typeof layer?.model === 'string')
  const effortScope = modelAt === -1 ? layers : layers.slice(0, modelAt + 1)
  const effortLayer = effortScope.find(layer => typeof layer?.effort === 'string')

  const settings = {}
  if (modelAt !== -1) settings.model = layers[modelAt].model
  if (effortLayer) settings.effort = effortLayer.effort
  return settings
}

// ---------------------------------------------------------------------------
// selftest
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`SELFTEST FAIL: ${message}`)
}

function assertSettings(actual, expected, label) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  )
}

async function runSelftest() {
  const cases = [
    {
      label: 'local model only: the shared effort was chosen for another model',
      shared: { agents: { architect: { codex: { model: 'gpt-6-astra', effort: 'ultra' } } } },
      local: { agents: { architect: { codex: { model: 'gpt-5.6-luna' } } } },
      agent: 'architect',
      ecosystem: 'codex',
      expected: { model: 'gpt-5.6-luna' },
    },
    {
      label: 'local effort only: the model comes from the shared file',
      shared: { agents: { architect: { claude: { model: 'claude-opus-5-5', effort: 'high' } } } },
      local: { agents: { architect: { claude: { effort: 'low' } } } },
      agent: 'architect',
      ecosystem: 'claude',
      expected: { model: 'claude-opus-5-5', effort: 'low' },
    },
    {
      label: 'local defaults beat a shared agent entry',
      shared: { agents: { architect: { claude: { model: 'claude-opus-5-5', effort: 'high' } } } },
      local: { defaults: { claude: { model: 'sonnet' } } },
      agent: 'architect',
      ecosystem: 'claude',
      expected: { model: 'sonnet' },
    },
    {
      label: 'nothing anywhere: no line at all',
      shared: null,
      local: null,
      agent: 'architect',
      ecosystem: 'claude',
      expected: {},
    },
    {
      label: 'shared defaults apply to an agent with no entry',
      shared: { defaults: { claude: { model: 'sonnet', effort: 'medium' } } },
      local: null,
      agent: 'developer',
      ecosystem: 'claude',
      expected: { model: 'sonnet', effort: 'medium' },
    },
    {
      label: "an agent entry's model drops the defaults' effort",
      shared: {
        defaults: { claude: { effort: 'medium' } },
        agents: { architect: { claude: { model: 'opus' } } },
      },
      local: null,
      agent: 'architect',
      ecosystem: 'claude',
      expected: { model: 'opus' },
    },
    {
      label: 'no model anywhere: effort may come from any layer',
      shared: { defaults: { codex: { effort: 'high' } } },
      local: null,
      agent: 'architect',
      ecosystem: 'codex',
      expected: { effort: 'high' },
    },
    {
      label: 'a local file alone is enough',
      shared: null,
      local: { agents: { architect: { opencode: { model: 'openai/gpt-5' } } } },
      agent: 'architect',
      ecosystem: 'opencode',
      expected: { model: 'openai/gpt-5' },
    },
    {
      label: 'a claude entry never reaches another ecosystem',
      shared: { agents: { architect: { claude: { model: 'opus', effort: 'high' } } } },
      local: null,
      agent: 'architect',
      ecosystem: 'codex',
      expected: {},
    },
  ]
  for (const c of cases) {
    assertSettings(
      resolveModelSettings({ shared: c.shared, local: c.local }, c.agent, c.ecosystem),
      c.expected,
      c.label
    )
  }

  // Reading: missing files are undefined — a file can hold null, and that must
  // reach validation — and broken JSON names the file.
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tb-llm-config-'))
  try {
    const empty = await readLlmLayers(root)
    assert(
      empty.shared === undefined && empty.local === undefined,
      'missing files must read as undefined'
    )

    await fs.mkdir(path.join(root, '.agent-source'))
    await fs.writeFile(path.join(root, '.agent-source', 'llm.json'), '{"defaults":{}}')
    await fs.writeFile(path.join(root, '.agent-source', 'llm.local.json'), '{"agents":{}}')
    const both = await readLlmLayers(root)
    assert(
      JSON.stringify(both) === '{"shared":{"defaults":{}},"local":{"agents":{}}}',
      `both layers must be parsed, got ${JSON.stringify(both)}`
    )

    await fs.writeFile(path.join(root, '.agent-source', 'llm.local.json'), '{ broken')
    let thrown = null
    try {
      await readLlmLayers(root)
    } catch (error) {
      thrown = error
    }
    assert(
      thrown !== null && thrown.message.includes(`${LLM_LOCAL_RELATIVE} is not valid JSON`),
      `broken JSON must name the file, got ${thrown ? thrown.message : 'no error'}`
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }

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
    console.error('Usage: node llm-config.mjs --selftest')
    process.exitCode = 2
  }
}
