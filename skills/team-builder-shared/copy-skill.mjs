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

// `seen` holds the real directories already walked: a link back to a parent
// would otherwise recurse forever.
async function collect(root, dir, files, seen = new Set([root])) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    let real = full
    if (entry.isSymbolicLink()) {
      real = await fs.realpath(full)
      if (!inside(root, real)) {
        throw new Error(`${path.relative(root, full)} links outside the skill (${real}); not copied`)
      }
    }
    const stat = await fs.stat(real)
    if (stat.isDirectory()) {
      if (seen.has(real)) continue
      seen.add(real)
      await collect(root, real, files, seen)
    }
    else if (stat.isFile()) files.push({ from: real, rel: path.relative(root, full) })
  }
  return files
}

export async function copySkill(skillDir, projectRoot) {
  const root = await fs.realpath(skillDir)
  const skillMd = await fs.readFile(path.join(root, 'SKILL.md'), 'utf8')
  const name = /^---\r?\n[\s\S]*?^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(skillMd)?.[1]
  if (!name || !NAME_SLUG.test(name)) {
    throw new Error(`SKILL.md needs a frontmatter name that is a plain slug, got ${JSON.stringify(name)}`)
  }
  const dest = path.join(projectRoot, '.agent-source', 'skills', name)
  const warnings = [...new Set(skillMd.match(/\.\.\/[^\s)`'"]+/g) ?? [])].map(
    ref => `SKILL.md refers to ${ref}, outside the skill; it is not copied`
  )
  try {
    await fs.access(dest)
    return { name, dest, copied: false, warnings }
  } catch {}
  const files = await collect(root, root, [])
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
    await fs.writeFile(path.join(skill, 'SKILL.md'), '---\nname: demo\ndescription: d\n---\nSee ../../shared/x.md\n')
    await fs.writeFile(path.join(skill, 'scripts', 'run.sh'), 'echo hi\n')
    await fs.writeFile(path.join(skill, '.git', 'config'), 'x')
    await fs.writeFile(path.join(tmp, 'secret.txt'), 'SECRET')
    if (process.platform !== 'win32') {
      await fs.symlink('scripts/run.sh', path.join(skill, 'alias.sh'))
      await fs.symlink('..', path.join(skill, 'scripts', 'loop'))
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
    }
    assert((await copySkill(skill, project)).copied === false, 'an existing copy must be left alone')

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
