#!/usr/bin/env node
// validate-llm.mjs — checks one LLM configuration layer (.agent-source/llm.json
// or llm.local.json) against its closed shape and the manifest.
//
// Shape only, never membership. Claude Code accepts provider-specific model
// IDs — Bedrock ARNs, `@date` suffixes, Foundry deployment names, anything
// behind a gateway — and `[1m]` suffixes, so even a `claude-` prefix rule
// would reject valid values. Whether a model exists is a catalog question, and
// only ever a warning (model-catalogs.mjs).
//
// Contract: team-builder-shared/llm-config.md.
//
// CLI: node validate-llm.mjs --selftest

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ECOSYSTEMS } from './llm-config.mjs'

const ROOT_KEYS = ['defaults', 'agents']
const ENTRY_KEYS = ['model', 'effort']
const OPENCODE_MODEL = /^[^/\s]+\/\S+$/
// Values reach external CLI calls as --model=<m> / --effort=<e>. Anything that
// could read as an option, or break the binding, never gets into llm.json.
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/@+\[\]-]*$/
const SAFE_EFFORT = /^[a-z]+$/
// claude-opus-5.5: Claude model IDs write the version with dashes.
const DOTTED_CLAUDE_VERSION = /^(claude-[a-z]+-)(\d+)\.(\d+)$/

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function checkEntry(entry, ecosystem, where, errors, warnings) {
  if (!isPlainObject(entry)) {
    errors.push(`${where}: nesne olmalı ({ "model": …, "effort": … })`)
    return
  }
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.includes(key)) {
      errors.push(`${where}: bilinmeyen alan "${key}" (yalnız model, effort)`)
    }
  }
  for (const key of ENTRY_KEYS) {
    if (!Object.hasOwn(entry, key)) continue
    const value = entry[key]
    if (typeof value !== 'string' || value === '') {
      errors.push(`${where}.${key}: boş olmayan bir metin olmalı`)
    } else if (/\s/.test(value)) {
      errors.push(
        `${where}.${key}: boşluk içeremez ("${value}") — sürümlü tam adlarda tire kullanılır, örn. claude-opus-5-5`
      )
    } else if (!(key === 'model' ? SAFE_MODEL : SAFE_EFFORT).test(value)) {
      errors.push(
        key === 'model'
          ? `${where}.model: harf ya da rakamla başlamalı, yalnız harf, rakam ve . _ : / @ + - [ ] içerebilir ("${value}")`
          : `${where}.effort: yalnız küçük harf olmalı ("${value}")`
      )
    }
  }

  const model = entry.model
  if (typeof model !== 'string' || model === '' || /\s/.test(model)) return
  if (ecosystem === 'opencode' && !OPENCODE_MODEL.test(model)) {
    errors.push(`${where}.model: OpenCode modeli "sağlayıcı/model" biçiminde olmalı ("${model}")`)
  }
  const dotted = ecosystem === 'claude' ? DOTTED_CLAUDE_VERSION.exec(model) : null
  if (dotted) {
    warnings.push(
      `${where}.model: "${model}" — bunu mu kastettin: ${dotted[1]}${dotted[2]}-${dotted[3]}?`
    )
  }
}

// layer: 'shared' | 'local'. Problems with the manifest — an agent that does
// not exist, an ecosystem it does not target — are errors in the shared file
// and warnings in the local one: a teammate removing an agent must not stop my
// sync because of my own old local entry.
export function validateLlmConfig(doc, manifest, { layer }) {
  const errors = []
  const warnings = []
  if (!isPlainObject(doc)) {
    errors.push('kök bir nesne olmalı')
    return { errors, warnings }
  }
  for (const key of Object.keys(doc)) {
    if (!ROOT_KEYS.includes(key)) {
      errors.push(`bilinmeyen kök anahtar "${key}" (yalnız defaults, agents)`)
    }
  }

  if (Object.hasOwn(doc, 'defaults')) {
    if (!isPlainObject(doc.defaults)) {
      errors.push('defaults nesne olmalı')
    } else {
      for (const [ecosystem, entry] of Object.entries(doc.defaults)) {
        if (!ECOSYSTEMS.includes(ecosystem)) {
          errors.push(`defaults: bilinmeyen ekosistem "${ecosystem}" (claude, codex, opencode)`)
        } else {
          checkEntry(entry, ecosystem, `defaults.${ecosystem}`, errors, warnings)
        }
      }
    }
  }

  if (Object.hasOwn(doc, 'agents')) {
    if (!isPlainObject(doc.agents)) {
      errors.push('agents nesne olmalı')
      return { errors, warnings }
    }
    const manifestProblems = layer === 'shared' ? errors : warnings
    const agentsByName = new Map((manifest.agents ?? []).map(agent => [agent.name, agent]))
    for (const [agentName, block] of Object.entries(doc.agents)) {
      const where = `agents.${agentName}`
      if (!isPlainObject(block)) {
        errors.push(`${where}: nesne olmalı`)
        continue
      }
      const agent = agentsByName.get(agentName)
      if (!agent) {
        manifestProblems.push(`${where}: manifest'te böyle bir agent yok`)
      }
      const targets = agent ? (agent.targets ?? manifest.targetsDefault ?? []) : []
      for (const [ecosystem, entry] of Object.entries(block)) {
        if (!ECOSYSTEMS.includes(ecosystem)) {
          errors.push(`${where}: bilinmeyen ekosistem "${ecosystem}" (claude, codex, opencode)`)
          continue
        }
        if (agent && !targets.includes(ecosystem)) {
          manifestProblems.push(
            `${where}.${ecosystem}: bu agent ${ecosystem} hedeflemiyor, girdi hiçbir yerde kullanılmaz`
          )
        }
        checkEntry(entry, ecosystem, `${where}.${ecosystem}`, errors, warnings)
      }
    }
  }
  return { errors, warnings }
}

// ---------------------------------------------------------------------------
// selftest
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`SELFTEST FAIL: ${message}`)
}

const MANIFEST = {
  targetsDefault: ['claude'],
  agents: [
    { name: 'architect', description: 'd', targets: ['claude', 'codex', 'opencode'] },
    { name: 'developer', description: 'd' },
  ],
}

function run(doc, layer) {
  return validateLlmConfig(doc, MANIFEST, { layer })
}

function expectClean(label, doc, layer) {
  const { errors, warnings } = run(doc, layer)
  assert(
    errors.length === 0 && warnings.length === 0,
    `${label} must be clean, got errors ${JSON.stringify(errors)} warnings ${JSON.stringify(warnings)}`
  )
}

function expectError(label, doc, layer, fragment) {
  const { errors } = run(doc, layer)
  assert(
    errors.some(error => error.includes(fragment)),
    `${label} must be an error containing "${fragment}", got ${JSON.stringify(errors)}`
  )
}

function expectWarningOnly(label, doc, layer, fragment) {
  const { errors, warnings } = run(doc, layer)
  assert(errors.length === 0, `${label} must not be an error, got ${JSON.stringify(errors)}`)
  assert(
    warnings.some(warning => warning.includes(fragment)),
    `${label} must warn with "${fragment}", got ${JSON.stringify(warnings)}`
  )
}

async function runSelftest() {
  expectClean(
    'a complete shared file',
    {
      defaults: { claude: { model: 'sonnet' }, codex: { model: 'gpt-5.6-terra', effort: 'medium' } },
      agents: {
        architect: {
          claude: { model: 'claude-opus-5-5', effort: 'high' },
          opencode: { model: 'anthropic/claude-opus-5-5' },
        },
      },
    },
    'shared'
  )
  expectClean('an empty file', {}, 'shared')

  // Every value the old manifest locks rejected is valid today. A list or a
  // prefix rule added later turns these red.
  for (const model of [
    'fable',
    'claude-opus-5-5',
    'inherit',
    'opus[1m]',
    'claude-sonnet-4-5@20250929',
    'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123',
  ]) {
    expectClean(`claude model ${model}`, { defaults: { claude: { model } } }, 'shared')
  }
  for (const effort of ['xhigh', 'max', 'ultra']) {
    expectClean(`effort ${effort}`, { defaults: { codex: { effort } } }, 'shared')
  }

  // Option-shaped values would be read as flags by an external CLI call.
  expectError('flag-shaped model', { defaults: { opencode: { model: '--attach=https://x.example/m' } } }, 'shared', 'harf ya da rakamla başlamalı')
  expectError('model with =', { defaults: { codex: { model: 'gpt=5' } } }, 'shared', 'harf ya da rakamla başlamalı')
  expectError('flag-shaped effort', { defaults: { codex: { effort: '-c' } } }, 'shared', 'yalnız küçük harf')
  expectClean('provider model', { defaults: { opencode: { model: 'openrouter/anthropic/claude-sonnet-4.5' } } }, 'shared')

  // Closed key lists, in both files: a typo is never silently ignored.
  for (const layer of ['shared', 'local']) {
    expectError(`${layer}: unknown root key`, { agent: {} }, layer, 'bilinmeyen kök anahtar "agent"')
    expectError(
      `${layer}: unknown ecosystem in defaults`,
      { defaults: { gemini: { model: 'x' } } },
      layer,
      'bilinmeyen ekosistem "gemini"'
    )
    expectError(
      `${layer}: unknown ecosystem under an agent`,
      { agents: { architect: { gemini: { model: 'x' } } } },
      layer,
      'bilinmeyen ekosistem "gemini"'
    )
    expectError(
      `${layer}: unknown entry key`,
      { defaults: { claude: { efort: 'high' } } },
      layer,
      'bilinmeyen alan "efort"'
    )
  }
  expectError('an array root', [], 'shared', 'kök bir nesne olmalı')

  expectError('an empty model', { defaults: { claude: { model: '' } } }, 'shared', 'boş olmayan bir metin')
  expectError('a non-string effort', { defaults: { codex: { effort: 3 } } }, 'shared', 'boş olmayan bir metin')
  expectError('whitespace in a model', { defaults: { claude: { model: 'opus 5.5' } } }, 'shared', 'tire kullanılır')
  expectError(
    'an opencode model without a provider',
    { defaults: { opencode: { model: 'claude-opus-5-5' } } },
    'shared',
    'sağlayıcı/model'
  )

  // The shared file must match the manifest…
  expectError(
    'shared: an agent the manifest does not have',
    { agents: { ghost: { claude: { model: 'opus' } } } },
    'shared',
    "manifest'te böyle bir agent yok"
  )
  expectError(
    'shared: an ecosystem the agent does not target',
    { agents: { developer: { codex: { model: 'gpt-5.6-terra' } } } },
    'shared',
    'hedeflemiyor'
  )
  // …the local file only warns: a teammate removing an agent must not stop
  // my sync because of my own old local entry.
  expectWarningOnly(
    'local: an agent the manifest does not have',
    { agents: { ghost: { claude: { model: 'opus' } } } },
    'local',
    "manifest'te böyle bir agent yok"
  )
  expectWarningOnly(
    'local: an ecosystem the agent does not target',
    { agents: { developer: { codex: { model: 'gpt-5.6-terra' } } } },
    'local',
    'hedeflemiyor'
  )

  expectWarningOnly(
    'a dotted claude version',
    { defaults: { claude: { model: 'claude-opus-5.5' } } },
    'shared',
    'claude-opus-5-5'
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
    console.error('Usage: node validate-llm.mjs --selftest')
    process.exitCode = 2
  }
}
