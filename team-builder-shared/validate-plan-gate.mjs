#!/usr/bin/env node
// validate-plan-gate.mjs — structural checks for the plan gate artifacts.
//
// The rules of the plan gate key off stable HTML markers rather than section
// headings, because headings are translated into the project's docLanguage.
// This validator makes sure the reference documents actually carry those
// markers and stay consistent with each other.
//
// CLI: node validate-plan-gate.mjs [--root <dir>] [--selftest]

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// The five section markers every plan file must carry, in order.
export const SECTION_MARKERS = [
  's:what',
  's:how',
  's:questions',
  's:review-notes',
  's:progress',
]

export const PROGRESS_SENTINEL = '<!-- progress:not-started -->'
export const CANCEL_NOTE_TAG = '<!-- note:cancelled -->'

// Frontmatter keys a plan file carries. Order is not significant.
export const PLAN_FIELDS = [
  'id',
  'title',
  'revision',
  'created',
  'source',
  'domain',
  'paths',
  'executor',
  'reviews',
]

// The inbox record has a CLOSED key list — any other key invalidates it. This
// validator only checks documents, and a bare key name like `id` cannot be
// told apart from ordinary prose by a substring search, so nothing here reads
// this list. It is the canonical definition for the runtime validator.
export const INBOX_FIELDS = ['id', 'title', 'created', 'source']

// Returns the YAML frontmatter block of a document, or null when the document
// does not open with one. Field checks run against this block only, so a
// `revision:` line inside a prose example never passes as the real field.
export function frontmatter(text) {
  const lines = text.split('\n')
  if (lines[0] !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end === -1) return null
  return lines.slice(1, end).join('\n')
}

export function parseArgs(argv) {
  const selftest = argv.includes('--selftest')
  const rootIdx = argv.indexOf('--root')
  if (rootIdx !== -1 && !argv[rootIdx + 1]) {
    throw new Error('--root requires a directory path')
  }
  const root = rootIdx !== -1 ? argv[rootIdx + 1] : process.cwd()
  return { selftest, root }
}

// A missing file is a finding; anything else (permissions, EISDIR, I/O) is a
// problem with the run itself and must not be reported as "missing".
async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function markerPositions(text, marker) {
  const needle = `<!-- ${marker} -->`
  const hits = []
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    hits.push(at)
  }
  return hits
}

export async function validatePlanGateArtifacts(rootDir) {
  const errors = []
  const shared = path.join(rootDir, 'team-builder-shared')

  const contract = await readIfExists(path.join(shared, 'plan-gate.md'))
  const planTpl = await readIfExists(path.join(shared, 'templates', 'plan.md'))
  const skillTpl = await readIfExists(
    path.join(shared, 'templates', 'work-plan-skill.md')
  )

  if (contract === null) errors.push('team-builder-shared/plan-gate.md missing')
  if (planTpl === null) errors.push('team-builder-shared/templates/plan.md missing')
  if (skillTpl === null) {
    errors.push('team-builder-shared/templates/work-plan-skill.md missing')
  }

  // The plan template must carry all five markers exactly once, in order, plus
  // the sentinel. A duplicated marker makes "the section after the marker"
  // ambiguous, which is how every runtime rule addresses plan content.
  if (planTpl !== null) {
    let cursor = -1
    for (const marker of SECTION_MARKERS) {
      const hits = markerPositions(planTpl, marker)
      if (hits.length === 0) {
        errors.push(`templates/plan.md missing marker ${marker}`)
        continue
      }
      if (hits.length > 1) {
        errors.push(`templates/plan.md marker ${marker} appears ${hits.length} times`)
      }
      if (hits[0] < cursor) {
        errors.push(`templates/plan.md marker ${marker} out of order`)
      }
      cursor = hits[0]
    }
    // The sentinel marks an untouched progress section, so it has to sit
    // inside one — once. Anywhere else and "replace the sentinel with real
    // progress" either finds nothing or leaves a second copy behind, and a
    // resumed plan reads as not-started.
    const sentinelHits = markerPositions(planTpl, PROGRESS_SENTINEL.slice(5, -4))
    const progressAt = markerPositions(planTpl, 's:progress')[0]
    if (sentinelHits.length === 0) {
      errors.push(`templates/plan.md missing sentinel ${PROGRESS_SENTINEL}`)
    } else if (sentinelHits.length > 1) {
      errors.push(
        `templates/plan.md sentinel appears ${sentinelHits.length} times, expected once`
      )
    } else if (progressAt === undefined || sentinelHits[0] < progressAt) {
      errors.push('templates/plan.md sentinel must sit after the s:progress marker')
    }

    const fm = frontmatter(planTpl)
    if (fm === null) {
      errors.push('templates/plan.md must start with YAML frontmatter')
    } else {
      for (const field of PLAN_FIELDS) {
        if (!new RegExp(`^${field}:`, 'm').test(fm)) {
          errors.push(`templates/plan.md missing frontmatter field ${field}`)
        }
      }
      // `reviews` is not a scalar: both gates append to their own array, and a
      // template that declares only the parent key leaves each gate inventing
      // where its record goes.
      for (const gate of ['plan-review', 'code-review']) {
        if (!new RegExp(`^\\s+${gate}:`, 'm').test(fm)) {
          errors.push(`templates/plan.md reviews is missing the ${gate} array`)
        }
      }
    }
  }

  // The contract must document every marker in its literal comment form. The
  // bare name (`s:what`) also occurs in prose; the comment form is the thing an
  // implementer copies, so that is what has to be present.
  if (contract !== null) {
    for (const marker of SECTION_MARKERS) {
      if (!contract.includes(`<!-- ${marker} -->`)) {
        errors.push(`plan-gate.md does not document marker <!-- ${marker} -->`)
      }
    }
    if (!contract.includes(PROGRESS_SENTINEL)) {
      errors.push(`plan-gate.md does not document ${PROGRESS_SENTINEL}`)
    }
    if (!contract.includes(CANCEL_NOTE_TAG)) {
      errors.push(`plan-gate.md does not document ${CANCEL_NOTE_TAG}`)
    }
  }

  // The skill template becomes SKILL.md in a project, so it needs frontmatter
  // with name and description — otherwise no ecosystem will load it.
  if (skillTpl !== null) {
    const fm = frontmatter(skillTpl)
    if (fm === null) {
      errors.push('templates/work-plan-skill.md must start with YAML frontmatter')
    } else {
      if (!/^name:\s*work-plan\s*$/m.test(fm)) {
        errors.push('templates/work-plan-skill.md frontmatter needs name: work-plan')
      }
      if (!/^description:\s*\S/m.test(fm)) {
        errors.push('templates/work-plan-skill.md frontmatter needs a description')
      }
    }

    // plan-gate.md never ships anywhere; this skill is the only copy of the
    // rules a project ever sees. A marker it stops naming is a section agents
    // stop writing, while the template still reserves a place for it — so the
    // shipped file is held to the same standard as the setup contract.
    for (const marker of SECTION_MARKERS) {
      if (!skillTpl.includes(`<!-- ${marker} -->`)) {
        errors.push(
          `templates/work-plan-skill.md does not document marker <!-- ${marker} -->`
        )
      }
    }
    if (!skillTpl.includes(PROGRESS_SENTINEL)) {
      errors.push(`templates/work-plan-skill.md does not document ${PROGRESS_SENTINEL}`)
    }
    if (!skillTpl.includes(CANCEL_NOTE_TAG)) {
      errors.push(`templates/work-plan-skill.md does not document ${CANCEL_NOTE_TAG}`)
    }
  }

  // A file literally named SKILL.md under team-builder-shared/ would be picked
  // up as a global skill once the repo is installed into ~/.claude/skills/.
  const stray = await findStraySkillFiles(shared)
  for (const filePath of stray) {
    errors.push(`${path.relative(rootDir, filePath)} must not be named SKILL.md`)
  }

  return errors
}

// Follows symlinks: a symlinked directory holding a SKILL.md installs exactly
// like a real one. `seen` holds resolved paths so a symlink cycle terminates.
async function findStraySkillFiles(dir, seen = new Set()) {
  let real
  try {
    real = await fs.realpath(dir)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  if (seen.has(real)) return []
  seen.add(real)

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    const child = path.join(dir, entry.name)
    let stat
    try {
      stat = await fs.stat(child)
    } catch (error) {
      if (error.code === 'ENOENT') continue // dangling symlink
      throw error
    }
    if (stat.isDirectory()) {
      found.push(...(await findStraySkillFiles(child, seen)))
    } else if (entry.name === 'SKILL.md') {
      found.push(child)
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// selftest
// ---------------------------------------------------------------------------

const GOOD_PLAN = [
  '---',
  'id: 20260807-01',
  'title: Ornek',
  'revision: 1',
  'created: 2026-08-07',
  'source: user',
  'domain: backend',
  'paths: []',
  'executor: claude/dev',
  'reviews:',
  '  plan-review: []',
  '  code-review: []',
  '---',
  '',
  '<!-- s:what -->',
  '## Ne ve neden',
  '<!-- s:how -->',
  '## Nasil',
  '<!-- s:questions -->',
  '## Acik sorular',
  '<!-- s:review-notes -->',
  '## Denetim notlari',
  '<!-- s:progress -->',
  '## Ilerleme',
  PROGRESS_SENTINEL,
  '',
].join('\n')

const GOOD_CONTRACT = [
  '# plan-gate',
  ...SECTION_MARKERS.map(m => `- \`<!-- ${m} -->\``),
  `- \`${PROGRESS_SENTINEL}\``,
  `- \`${CANCEL_NOTE_TAG}\``,
  '',
].join('\n')

const GOOD_SKILL = [
  '---',
  'name: work-plan',
  'description: Plan kapisi proseduru.',
  '---',
  '',
  '# work-plan',
  '',
  // The shipped skill is the only copy of the rules a project sees, so it must
  // name every machine marker it expects agents to write.
  ...SECTION_MARKERS.map((m) => `<!-- ${m} -->`),
  PROGRESS_SENTINEL,
  CANCEL_NOTE_TAG,
  '',
].join('\n')

async function runSelftest() {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tb-plan-gate-'))
  const shared = path.join(fixtureRoot, 'team-builder-shared')
  const contractPath = path.join(shared, 'plan-gate.md')
  const planPath = path.join(shared, 'templates', 'plan.md')
  const skillPath = path.join(shared, 'templates', 'work-plan-skill.md')

  const restore = async () => {
    await fs.mkdir(path.join(shared, 'templates'), { recursive: true })
    await fs.writeFile(contractPath, GOOD_CONTRACT)
    await fs.writeFile(planPath, GOOD_PLAN)
    await fs.writeFile(skillPath, GOOD_SKILL)
  }

  // Applies a mutation, asserts the expected finding, then restores the fixture
  // so every case starts from a document set that is otherwise valid.
  const expectError = async (fragment, what, mutate) => {
    await mutate()
    const errors = await validatePlanGateArtifacts(fixtureRoot)
    assert(
      errors.some(e => e.includes(fragment)),
      `${what} — expected a finding containing "${fragment}", got: ${
        errors.join('; ') || '(none)'
      }`
    )
    await restore()
  }

  try {
    await restore()

    let errors = await validatePlanGateArtifacts(fixtureRoot)
    assert(errors.length === 0, `valid fixture rejected: ${errors.join('; ')}`)

    // --- files ---------------------------------------------------------------
    await expectError('templates/plan.md missing', 'a deleted plan template', () =>
      fs.rm(planPath)
    )
    await expectError('plan-gate.md missing', 'a deleted contract', () =>
      fs.rm(contractPath)
    )
    await expectError(
      'work-plan-skill.md missing',
      'a deleted skill template',
      () => fs.rm(skillPath)
    )

    // --- plan markers --------------------------------------------------------
    await expectError('missing marker s:questions', 'a dropped marker', () =>
      fs.writeFile(planPath, GOOD_PLAN.replace('<!-- s:questions -->\n', ''))
    )
    await expectError('marker s:how appears 2 times', 'a duplicated marker', () =>
      fs.writeFile(planPath, `${GOOD_PLAN}\n<!-- s:how -->\n`)
    )
    await expectError('marker s:how out of order', 'swapped markers', () =>
      fs.writeFile(
        planPath,
        GOOD_PLAN.replace('<!-- s:what -->', '<!-- s:tmp -->')
          .replace('<!-- s:how -->', '<!-- s:what -->')
          .replace('<!-- s:tmp -->', '<!-- s:how -->')
      )
    )
    await expectError('missing sentinel', 'a dropped sentinel', () =>
      fs.writeFile(planPath, GOOD_PLAN.replace(PROGRESS_SENTINEL, ''))
    )

    // --- plan frontmatter ----------------------------------------------------
    await expectError(
      'missing frontmatter field revision',
      'a field that only appears in the body',
      () =>
        fs.writeFile(
          planPath,
          `${GOOD_PLAN.replace('revision: 1\n', '')}\nrevision: 1\n`
        )
    )
    await expectError(
      'plan.md must start with YAML frontmatter',
      'a plan template with no frontmatter',
      () => fs.writeFile(planPath, GOOD_PLAN.split('---\n').slice(2).join('---\n'))
    )

    // Both gates append to their own array; a template declaring only the
    // parent key leaves each gate to invent where its record goes.
    for (const gate of ['plan-review', 'code-review']) {
      await expectError(
        `reviews is missing the ${gate} array`,
        `a plan template whose reviews omits ${gate}`,
        () =>
          fs.writeFile(
            planPath,
            GOOD_PLAN.replace(new RegExp(`^\\s+${gate}: \\[\\]\\n`, 'm'), '')
          )
      )
    }
    // The sentinel means "this progress section is untouched", so it has to be
    // in one, once. Elsewhere, replacing it either finds nothing or leaves a
    // copy behind and a resumed plan reads as not-started.
    await expectError(
      'sentinel must sit after the s:progress marker',
      'a sentinel placed above the progress section',
      () =>
        fs.writeFile(
          planPath,
          GOOD_PLAN.replace(PROGRESS_SENTINEL, '').replace(
            '<!-- s:what -->',
            `${PROGRESS_SENTINEL}\n<!-- s:what -->`
          )
        )
    )
    await expectError(
      'sentinel appears 2 times',
      'a duplicated sentinel',
      () =>
        fs.writeFile(
          planPath,
          GOOD_PLAN.replace(
            PROGRESS_SENTINEL,
            `${PROGRESS_SENTINEL}\n${PROGRESS_SENTINEL}`
          )
        )
    )

    // --- contract ------------------------------------------------------------
    await expectError(
      'does not document marker <!-- s:progress -->',
      'a contract naming a marker only in prose',
      () =>
        fs.writeFile(
          contractPath,
          GOOD_CONTRACT.replace('`<!-- s:progress -->`', 's:progress')
        )
    )
    await expectError(
      `does not document ${CANCEL_NOTE_TAG}`,
      'a contract missing the cancellation tag',
      () => fs.writeFile(contractPath, GOOD_CONTRACT.replace(CANCEL_NOTE_TAG, ''))
    )
    await expectError(
      `does not document ${PROGRESS_SENTINEL}`,
      'a contract missing the sentinel',
      () => fs.writeFile(contractPath, GOOD_CONTRACT.replace(PROGRESS_SENTINEL, ''))
    )

    // --- skill template ------------------------------------------------------
    await expectError(
      'work-plan-skill.md must start with YAML frontmatter',
      'a skill template with no frontmatter',
      () => fs.writeFile(skillPath, '# work-plan\n')
    )
    await expectError(
      'work-plan-skill.md does not document marker <!-- s:review-notes -->',
      'a shipped skill that stopped naming a marker',
      () =>
        fs.writeFile(
          skillPath,
          GOOD_SKILL.replace('<!-- s:review-notes -->', 's:review-notes')
        )
    )
    await expectError(
      `work-plan-skill.md does not document ${PROGRESS_SENTINEL}`,
      'a shipped skill missing the sentinel',
      () => fs.writeFile(skillPath, GOOD_SKILL.replace(PROGRESS_SENTINEL, ''))
    )
    await expectError(
      `work-plan-skill.md does not document ${CANCEL_NOTE_TAG}`,
      'a shipped skill missing the cancellation tag',
      () => fs.writeFile(skillPath, GOOD_SKILL.replace(CANCEL_NOTE_TAG, ''))
    )
    await expectError(
      'needs name: work-plan',
      'a skill template under the wrong name',
      () => fs.writeFile(skillPath, GOOD_SKILL.replace('name: work-plan', 'name: wp'))
    )
    await expectError(
      'needs a description',
      'a skill template with an empty description',
      () =>
        fs.writeFile(
          skillPath,
          GOOD_SKILL.replace('description: Plan kapisi proseduru.', 'description:')
        )
    )
    await expectError(
      'needs name: work-plan',
      'frontmatter keys that only appear in the body',
      () =>
        fs.writeFile(
          skillPath,
          '---\ntitle: x\n---\n\nname: work-plan\ndescription: x\n'
        )
    )

    // --- stray SKILL.md ------------------------------------------------------
    await expectError(
      'must not be named SKILL.md',
      'a stray SKILL.md',
      () => fs.writeFile(path.join(shared, 'templates', 'SKILL.md'), 'x\n')
    )
    await fs.rm(path.join(shared, 'templates', 'SKILL.md'), { force: true })

    await expectError(
      'must not be named SKILL.md',
      'a SKILL.md reachable only through a symlinked directory',
      async () => {
        const outside = path.join(fixtureRoot, 'outside')
        await fs.mkdir(outside, { recursive: true })
        await fs.writeFile(path.join(outside, 'SKILL.md'), 'x\n')
        await fs.symlink(outside, path.join(shared, 'linked'), 'dir')
      }
    )
    await fs.rm(path.join(shared, 'linked'), { force: true })
    await fs.rm(path.join(fixtureRoot, 'outside'), { recursive: true, force: true })

    // A symlink cycle must terminate rather than recurse forever.
    await fs.symlink(shared, path.join(shared, 'loop'), 'dir')
    errors = await validatePlanGateArtifacts(fixtureRoot)
    assert(
      errors.length === 0,
      `a symlink cycle must terminate cleanly, got: ${errors.join('; ')}`
    )
    await fs.rm(path.join(shared, 'loop'), { force: true })

    // --- unreadable input is an error, not a silent "missing" ----------------
    await fs.rm(planPath)
    await fs.mkdir(planPath)
    let threw = false
    try {
      await validatePlanGateArtifacts(fixtureRoot)
    } catch {
      threw = true
    }
    assert(threw, 'an unreadable plan template must surface, not read as missing')
    await fs.rm(planPath, { recursive: true })
    await restore()

    // --- CLI arguments -------------------------------------------------------
    assert(
      parseArgs(['--root', '/tmp/x']).root === '/tmp/x',
      '--root must take the following argument'
    )
    let argsThrew = false
    try {
      parseArgs(['--root'])
    } catch {
      argsThrew = true
    }
    assert(argsThrew, '--root without a value must be a clean error')

    console.log('SELFTEST PASS')
  } finally {
    await fs.rm(fixtureRoot, { recursive: true, force: true })
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`SELFTEST FAIL: ${message}`)
  }
}

async function main() {
  const { selftest, root } = parseArgs(process.argv.slice(2))
  if (selftest) {
    await runSelftest()
    return
  }
  const errors = await validatePlanGateArtifacts(root)
  if (errors.length > 0) {
    console.error('Plan gate artifacts invalid:')
    for (const e of errors) console.error(`- ${e}`)
    process.exitCode = 1
  } else {
    console.log('Plan gate artifacts are valid.')
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
