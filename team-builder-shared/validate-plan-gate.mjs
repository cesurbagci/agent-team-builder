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

// The inbox record has a CLOSED key list — any other key invalidates it.
export const INBOX_FIELDS = ['id', 'title', 'created', 'source']

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
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

  // The plan template must carry all five markers, in order, plus the sentinel.
  if (planTpl !== null) {
    let cursor = -1
    for (const marker of SECTION_MARKERS) {
      const at = planTpl.indexOf(`<!-- ${marker} -->`)
      if (at === -1) {
        errors.push(`templates/plan.md missing marker ${marker}`)
        continue
      }
      if (at < cursor) {
        errors.push(`templates/plan.md marker ${marker} out of order`)
      }
      cursor = at
    }
    if (!planTpl.includes(PROGRESS_SENTINEL)) {
      errors.push(`templates/plan.md missing sentinel ${PROGRESS_SENTINEL}`)
    }
    for (const field of PLAN_FIELDS) {
      if (!new RegExp(`^${field}:`, 'm').test(planTpl)) {
        errors.push(`templates/plan.md missing frontmatter field ${field}`)
      }
    }
  }

  // The contract must document every marker and both closed key lists.
  if (contract !== null) {
    for (const marker of SECTION_MARKERS) {
      if (!contract.includes(marker)) {
        errors.push(`plan-gate.md does not document marker ${marker}`)
      }
    }
    for (const field of INBOX_FIELDS) {
      if (!contract.includes(field)) {
        errors.push(`plan-gate.md does not document inbox field ${field}`)
      }
    }
    if (!contract.includes(CANCEL_NOTE_TAG)) {
      errors.push(`plan-gate.md does not document ${CANCEL_NOTE_TAG}`)
    }
  }

  // The skill template becomes SKILL.md in a project, so it needs frontmatter
  // with name and description — otherwise no ecosystem will load it.
  if (skillTpl !== null) {
    if (!skillTpl.startsWith('---\n')) {
      errors.push('templates/work-plan-skill.md must start with YAML frontmatter')
    }
    if (!/^name:\s*work-plan\s*$/m.test(skillTpl)) {
      errors.push('templates/work-plan-skill.md frontmatter needs name: work-plan')
    }
    if (!/^description:\s*\S/m.test(skillTpl)) {
      errors.push('templates/work-plan-skill.md frontmatter needs a description')
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

async function findStraySkillFiles(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const found = []
  for (const entry of entries) {
    const child = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await findStraySkillFiles(child)))
    } else if (entry.name === 'SKILL.md') {
      found.push(child)
    }
  }
  return found
}

async function runSelftest() {
  const fixtureRoot = path.join(os.tmpdir(), 'tb-plan-gate-selftest')
  const shared = path.join(fixtureRoot, 'team-builder-shared')
  await fs.rm(fixtureRoot, { recursive: true, force: true })
  await fs.mkdir(path.join(shared, 'templates'), { recursive: true })

  const goodPlan = [
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

  const goodContract = [
    '# plan-gate',
    ...SECTION_MARKERS.map(m => `- ${m}`),
    ...INBOX_FIELDS.map(f => `- ${f}`),
    `- ${CANCEL_NOTE_TAG}`,
    '',
  ].join('\n')

  const goodSkill = [
    '---',
    'name: work-plan',
    'description: Plan kapisi proseduru.',
    '---',
    '',
    '# work-plan',
    '',
  ].join('\n')

  await fs.writeFile(path.join(shared, 'plan-gate.md'), goodContract)
  await fs.writeFile(path.join(shared, 'templates', 'plan.md'), goodPlan)
  await fs.writeFile(
    path.join(shared, 'templates', 'work-plan-skill.md'),
    goodSkill
  )

  let errors = await validatePlanGateArtifacts(fixtureRoot)
  assert(errors.length === 0, `valid fixture rejected: ${errors.join('; ')}`)

  // A missing marker must be reported.
  await fs.writeFile(
    path.join(shared, 'templates', 'plan.md'),
    goodPlan.replace('<!-- s:questions -->\n', '')
  )
  errors = await validatePlanGateArtifacts(fixtureRoot)
  assert(
    errors.some(e => e.includes('missing marker s:questions')),
    'a missing marker must be reported'
  )
  await fs.writeFile(path.join(shared, 'templates', 'plan.md'), goodPlan)

  // A missing sentinel must be reported.
  await fs.writeFile(
    path.join(shared, 'templates', 'plan.md'),
    goodPlan.replace(PROGRESS_SENTINEL, '')
  )
  errors = await validatePlanGateArtifacts(fixtureRoot)
  assert(
    errors.some(e => e.includes('missing sentinel')),
    'a missing sentinel must be reported'
  )
  await fs.writeFile(path.join(shared, 'templates', 'plan.md'), goodPlan)

  // Skill frontmatter is what makes it loadable; its absence must be reported.
  await fs.writeFile(
    path.join(shared, 'templates', 'work-plan-skill.md'),
    '# work-plan\n'
  )
  errors = await validatePlanGateArtifacts(fixtureRoot)
  assert(
    errors.some(e => e.includes('YAML frontmatter')),
    'skill template without frontmatter must be reported'
  )
  await fs.writeFile(
    path.join(shared, 'templates', 'work-plan-skill.md'),
    goodSkill
  )

  // A stray SKILL.md would become a global skill after install.
  await fs.writeFile(path.join(shared, 'templates', 'SKILL.md'), 'x\n')
  errors = await validatePlanGateArtifacts(fixtureRoot)
  assert(
    errors.some(e => e.includes('must not be named SKILL.md')),
    'a stray SKILL.md must be reported'
  )
  await fs.rm(path.join(shared, 'templates', 'SKILL.md'))

  await fs.rm(fixtureRoot, { recursive: true, force: true })
  console.log('SELFTEST PASS')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`SELFTEST FAIL: ${message}`)
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('validate-plan-gate.mjs')
if (isMain) {
  if (process.argv.includes('--selftest')) {
    await runSelftest()
  } else {
    const rootIdx = process.argv.indexOf('--root')
    const root = rootIdx !== -1 ? process.argv[rootIdx + 1] : process.cwd()
    const errors = await validatePlanGateArtifacts(root)
    if (errors.length > 0) {
      console.error('Plan gate artifacts invalid:')
      for (const e of errors) console.error(`- ${e}`)
      process.exitCode = 1
    } else {
      console.log('Plan gate artifacts are valid.')
    }
  }
}
