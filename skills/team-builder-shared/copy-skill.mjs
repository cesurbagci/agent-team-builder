#!/usr/bin/env node
// copy-skill.mjs — copy a chosen skill into a project's .agent-source/skills/.
//
// CLI: node copy-skill.mjs <skill-dir> <project-root> [--selftest]
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

export async function copySkill(skillDir, projectRoot) {
  const root = await fs.realpath(skillDir)
  const skillMd = await fs.readFile(path.join(root, 'SKILL.md'), 'utf8')
  const name = frontmatterName(skillMd)
  if (!name || !NAME_SLUG.test(name)) {
    throw new Error(
      `SKILL.md needs exactly one frontmatter name line holding a plain slug, got ${JSON.stringify(name)} — check it by hand`
    )
  }
  const dest = path.join(projectRoot, '.agent-source', 'skills', name)
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
    : args.length === 2
      ? copySkill(args[0], args[1]).then(r => {
          for (const w of r.warnings) console.warn(`! ${w}`)
          console.log(r.copied ? `copied: ${r.dest}` : `already present: ${r.dest}`)
        })
      : Promise.reject(new Error('Usage: node copy-skill.mjs <skill-dir> <project-root> | --selftest'))
  run.catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
