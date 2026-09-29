#!/usr/bin/env node
// copy-skill.mjs — copy a chosen skill into a project's .agent-source/skills/.
//
// CLI: node copy-skill.mjs <skill-dir> <project-root>
//      node copy-skill.mjs --team-builder <project-root>
//      node copy-skill.mjs --selftest
//
// --team-builder copies team-builder itself — its five skills and
// team-builder-shared, from wherever this file is installed — so a teammate
// who has not installed team-builder still gets it with the repo. It replaces
// an earlier copy (that is how it updates), and turns a copy install's
// absolute paths back into ${CLAUDE_SKILL_DIR}/../ so they work on any machine.
//
// The copy holds regular files only, because sync mirrors nothing else:
// - .git is skipped, so the project never records an embedded repository;
// - a link is copied as the file or directory it points to, but only when that
//   target lies inside the skill directory; a link leaving it stops the copy,
//   so an outside file never enters the repo;
// - the name comes from SKILL.md's frontmatter and must be a plain slug;
// - an existing .agent-source/skills/<name>/ is left alone.
// References in SKILL.md that climb out of the skill (../) are printed as
// warnings: those files are not copied and the skill may not work alone.

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function inside(root, target) {
  return target === root || target.startsWith(root + path.sep)
}

// Walks `dir` (a real path) and records each file under its logical path
// `rel`, the one the skill sees — a linked directory keeps its link's name.
// `ancestors` holds the real directories on the current branch: a link back
// to one of them would recurse forever.
async function collect(root, dir, rel, files, ancestors) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    const logical = path.join(rel, entry.name)
    let real = full
    if (entry.isSymbolicLink()) {
      real = await fs.realpath(full)
      if (!inside(root, real)) {
        throw new Error(`${logical} links outside the skill (${real}); not copied`)
      }
      // A link into .git would bring the repository back under another name.
      if (path.relative(root, real).split(path.sep).includes('.git')) continue
    }
    const stat = await fs.stat(real)
    if (stat.isDirectory()) {
      if (ancestors.has(real)) continue
      await collect(root, real, logical, files, new Set([...ancestors, real]))
    } else if (stat.isFile()) {
      files.push({ from: real, rel: logical })
    }
  }
  return files
}

// The name from the opening frontmatter block only, never from the body.
function frontmatterName(skillMd) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skillMd)?.[1]
  if (block === undefined) return null
  // More than one line that looks like the key — a multiline value can hold
  // one — is ambiguous without a YAML parser: refuse rather than guess.
  const lines = [...block.matchAll(/^(["']?)name\1[ \t]*:[ \t]*(.*)$/gm)]
  return lines.length === 1 ? lines[0][2].trim().replace(/^(["'])(.*)\1$/, '$2') : null
}

// The project's .agent-source/skills, created if missing, refused when any
// part of it is a link: writes and deletions must stay in this project.
async function projectSkillsDir(projectRoot) {
  await fs.mkdir(projectRoot, { recursive: true })
  const realProject = await fs.realpath(projectRoot)
  const destRoot = path.join(realProject, '.agent-source', 'skills')
  await fs.mkdir(destRoot, { recursive: true })
  if ((await fs.realpath(destRoot)) !== destRoot) {
    throw new Error(`${destRoot} resolves elsewhere — is .agent-source or its skills directory a link? Nothing copied`)
  }
  return { realProject, destRoot }
}

// An existing destination must be a real directory, never a link to elsewhere.
async function assertNotLink(dest) {
  const info = await fs.lstat(dest).catch(() => null)
  if (info?.isSymbolicLink()) throw new Error(`${dest} is a link; not replaced`)
}

export async function copySkill(skillDir, projectRoot) {
  const root = await fs.realpath(skillDir)
  const skillMd = await fs.readFile(path.join(root, 'SKILL.md'), 'utf8')
  const name = frontmatterName(skillMd)
  if (!name || !NAME_SLUG.test(name)) {
    throw new Error(
      `SKILL.md needs exactly one frontmatter name line holding a plain slug, got ${JSON.stringify(name)} — check it by hand`
    )
  }
  const { destRoot } = await projectSkillsDir(projectRoot)
  const dest = path.join(destRoot, name)
  await assertNotLink(dest)
  const warnings = [...new Set(skillMd.match(/\.\.\/[^\s)`'"]+/g) ?? [])].map(
    ref => `SKILL.md refers to ${ref}, outside the skill; it is not copied`
  )
  try {
    await fs.access(dest)
    return { name, dest, copied: false, warnings }
  } catch {}
  const files = await collect(root, root, '', [], new Set([root]))
  for (const { from, rel } of files) {
    const target = path.join(dest, rel)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(from, target)
  }
  return { name, dest, copied: true, warnings }
}

export const TEAM_BUILDER_DIRS = [
  'team-builder-setup',
  'team-builder-sync',
  'team-builder-upgrade',
  'team-builder-models',
  'architecture-advisor',
  'team-builder-shared',
]

export async function vendorTeamBuilder(projectRoot, skillsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const from = await fs.realpath(skillsRoot)
  const { realProject, destRoot } = await projectSkillsDir(projectRoot)
  // Run from this project's own copy — .agent-source or one of the tool
  // mirrors — there is nothing newer to bring in; a mirror may even be older
  // than the canonical copy.
  if (inside(realProject, from)) return []
  // A copy install wrote its absolute directory into the .md files.
  const installPrefixes = [...new Set([from, skillsRoot].flatMap(d => [d + path.sep, d.split(path.sep).join('/') + '/']))]
  const copied = []
  for (const name of TEAM_BUILDER_DIRS) {
    const root = await fs.realpath(path.join(from, name))
    if (path.dirname(root) !== from) {
      throw new Error(`${name} in ${from} resolves to ${root}, outside the bundle; nothing copied`)
    }
    const files = await collect(root, root, '', [], new Set([root]))
    const dest = path.join(destRoot, name)
    await assertNotLink(dest)
    await fs.rm(dest, { recursive: true, force: true })
    for (const { from: source, rel } of files) {
      const target = path.join(dest, rel)
      await fs.mkdir(path.dirname(target), { recursive: true })
      if (rel.endsWith('.md')) {
        let text = await fs.readFile(source, 'utf8')
        for (const prefix of installPrefixes) text = text.split(prefix).join('${CLAUDE_SKILL_DIR}/../')
        await fs.writeFile(target, text)
      } else {
        await fs.copyFile(source, target)
      }
    }
    copied.push(dest)
  }
  return copied
}

async function selftest() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tb-copy-skill-'))
  const assert = (ok, msg) => { if (!ok) throw new Error(`SELFTEST FAIL: ${msg}`) }
  try {
    const skill = path.join(tmp, 'src', 'demo')
    const project = path.join(tmp, 'project')
    await fs.mkdir(path.join(skill, 'scripts'), { recursive: true })
    await fs.mkdir(path.join(skill, '.git'), { recursive: true })
    await fs.writeFile(
      path.join(skill, 'SKILL.md'),
      '---\n"name": demo\ndescription: d\n---\nSee ../../shared/x.md\n\nname: example\n'
    )
    await fs.writeFile(path.join(skill, 'scripts', 'run.sh'), 'echo hi\n')
    await fs.writeFile(path.join(skill, '.git', 'config'), 'x')
    await fs.writeFile(path.join(tmp, 'secret.txt'), 'SECRET')
    if (process.platform !== 'win32') {
      await fs.symlink('scripts/run.sh', path.join(skill, 'alias.sh'))
      await fs.symlink('..', path.join(skill, 'scripts', 'loop'))
      await fs.symlink('scripts', path.join(skill, 'alias'))
      await fs.symlink('.git', path.join(skill, 'repo-meta'))
    }

    const first = await copySkill(skill, project)
    const dest = path.join(project, '.agent-source', 'skills', 'demo')
    assert(first.copied && first.name === 'demo', 'first copy must happen under the frontmatter name')
    assert(await fs.readFile(path.join(dest, 'scripts', 'run.sh'), 'utf8') === 'echo hi\n', 'files must be copied')
    assert(!(await fs.access(path.join(dest, '.git')).then(() => true, () => false)), '.git must be skipped')
    assert(first.warnings.some(w => w.includes('../../shared/x.md')), 'an outside reference must warn')
    if (process.platform !== 'win32') {
      const alias = await fs.lstat(path.join(dest, 'alias.sh'))
      assert(alias.isFile() && !alias.isSymbolicLink(), 'an inside link must become a regular file')
      assert(
        await fs.readFile(path.join(dest, 'alias', 'run.sh'), 'utf8') === 'echo hi\n',
        'a linked directory must keep its own name'
      )
      assert(
        !(await fs.access(path.join(dest, 'repo-meta')).then(() => true, () => false)),
        'a link into .git must be skipped'
      )
    }
    assert((await copySkill(skill, project)).copied === false, 'an existing copy must be left alone')

    // --team-builder: a copy install (absolute paths) becomes portable again,
    // and a second run replaces the first.
    const installed = path.join(tmp, 'home', 'skills')
    for (const name of TEAM_BUILDER_DIRS) {
      await fs.mkdir(path.join(installed, name), { recursive: true })
      await fs.writeFile(
        path.join(installed, name, name === 'team-builder-shared' ? 'x.mjs' : 'SKILL.md'),
        `run node "${installed}/team-builder-shared/x.mjs"\n`
      )
    }
    await vendorTeamBuilder(project, installed)
    const vendored = path.join(project, '.agent-source', 'skills')
    const syncMd = await fs.readFile(path.join(vendored, 'team-builder-sync', 'SKILL.md'), 'utf8')
    assert(syncMd === 'run node "${CLAUDE_SKILL_DIR}/../team-builder-shared/x.mjs"\n', `absolute paths must be made relative, got ${syncMd}`)
    assert(
      (await fs.readFile(path.join(vendored, 'team-builder-shared', 'x.mjs'), 'utf8')).includes(installed),
      'only .md files are rewritten'
    )
    await fs.writeFile(path.join(vendored, 'team-builder-sync', 'old.md'), 'stale')
    await vendorTeamBuilder(project, installed)
    assert(
      !(await fs.access(path.join(vendored, 'team-builder-sync', 'old.md')).then(() => true, () => false)),
      'a second run must replace the earlier copy'
    )
    assert((await vendorTeamBuilder(project, vendored)).length === 0, 'the project copy must not be vendored onto itself')
    const mirror = path.join(project, '.agents', 'skills')
    await fs.mkdir(mirror, { recursive: true })
    for (const name of TEAM_BUILDER_DIRS) await fs.cp(path.join(vendored, name), path.join(mirror, name), { recursive: true })
    assert((await vendorTeamBuilder(project, mirror)).length === 0, 'a tool mirror in the project must not overwrite the canonical copy')

    if (process.platform !== 'win32') {
      // A source directory that is itself a link out of the bundle.
      const leaky = path.join(tmp, 'leaky')
      await fs.cp(installed, leaky, { recursive: true })
      await fs.rm(path.join(leaky, 'team-builder-setup'), { recursive: true })
      await fs.mkdir(path.join(tmp, 'private'))
      await fs.writeFile(path.join(tmp, 'private', 'SKILL.md'), 'SECRET')
      await fs.symlink(path.join(tmp, 'private'), path.join(leaky, 'team-builder-setup'))
      let outside = null
      try { await vendorTeamBuilder(path.join(tmp, 'p2'), leaky) } catch (e) { outside = e }
      assert(outside?.message.includes('outside the bundle'), 'a source directory linking out must be refused')

      // A destination that links elsewhere must never be written or emptied.
      const p3 = path.join(tmp, 'p3')
      const external = path.join(tmp, 'external')
      await fs.mkdir(path.join(external, 'team-builder-setup'), { recursive: true })
      await fs.writeFile(path.join(external, 'team-builder-setup', 'keep.txt'), 'keep')
      await fs.mkdir(path.join(p3, '.agent-source'), { recursive: true })
      await fs.symlink(external, path.join(p3, '.agent-source', 'skills'))
      let linked = null
      try { await vendorTeamBuilder(p3, installed) } catch (e) { linked = e }
      assert(linked?.message.includes('resolves elsewhere'), 'a linked destination must be refused')
      assert(
        (await fs.readFile(path.join(external, 'team-builder-setup', 'keep.txt'), 'utf8')) === 'keep',
        'nothing outside the project may be deleted'
      )
    }

    const ambiguous = path.join(tmp, 'src', 'ambiguous')
    await fs.mkdir(ambiguous, { recursive: true })
    await fs.writeFile(
      path.join(ambiguous, 'SKILL.md'),
      '---\ndescription: "First line\nname: example\nlast line"\nname: actual\n---\n'
    )
    let unclear = null
    try { await copySkill(ambiguous, project) } catch (e) { unclear = e }
    assert(unclear?.message.includes('exactly one'), 'an ambiguous name must stop the copy')
    assert(
      !(await fs.access(path.join(project, '.agent-source', 'skills', 'example')).then(() => true, () => false)),
      'nothing may be copied under a guessed name'
    )

    if (process.platform !== 'win32') {
      await fs.symlink(path.join(tmp, 'secret.txt'), path.join(skill, 'leak.txt'))
      await fs.rm(dest, { recursive: true })
      let refused = null
      try { await copySkill(skill, project) } catch (e) { refused = e }
      assert(refused?.message.includes('links outside the skill'), 'a link leaving the skill must stop the copy')
      const leaked = await fs.readFile(path.join(dest, 'leak.txt'), 'utf8').catch(() => null)
      assert(leaked === null, 'the outside file must not be copied')
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
  console.log('SELFTEST PASS')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const args = process.argv.slice(2)
  const run = args.includes('--selftest')
    ? selftest()
    : args[0] === '--team-builder' && args.length === 2
      ? vendorTeamBuilder(args[1]).then(dirs => {
          for (const dir of dirs) console.log(`copied: ${dir}`)
          if (dirs.length === 0) console.log('already the project copy; nothing to do')
        })
      : args.length === 2
      ? copySkill(args[0], args[1]).then(r => {
          for (const w of r.warnings) console.warn(`! ${w}`)
          console.log(r.copied ? `copied: ${r.dest}` : `already present: ${r.dest}`)
        })
      : Promise.reject(
          new Error('Usage: node copy-skill.mjs <skill-dir> <project-root> | --team-builder <project-root> | --selftest')
        )
  run.catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
