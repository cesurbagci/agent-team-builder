#!/usr/bin/env node
// module-scan.mjs — which folders of an installed project have no owner.
//
// CLI: node module-scan.mjs <project>            → folders no routing path covers
//      node module-scan.mjs <project> <folder>   → that folder's most specific owner
//      node module-scan.mjs --selftest
//
// Coverage uses route-globs.mjs, the validator's own rule. The scan stays in
// the project: the manifest is read only when its real path lies inside the
// real project root and it is not a link, directory links are neither followed
// nor listed, and a folder argument must be a plain project-relative path.

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { routeContains, routePathProblems } from './route-globs.mjs'

const SKIP = new Set(['node_modules', 'dist', 'build', 'target', 'vendor', 'coverage'])

function inside(root, target) {
  return target === root || target.startsWith(root + path.sep)
}

async function readRouting(projectRoot) {
  const root = await fs.realpath(projectRoot)
  const manifestPath = path.join(root, '.agent-source', 'agents', 'manifest.json')
  const real = await fs.realpath(manifestPath)
  if (real !== manifestPath || !inside(root, real)) {
    throw new Error(`${manifestPath} resolves to ${real}, outside the project or through a link; not read`)
  }
  if ((await fs.lstat(real)).isSymbolicLink()) throw new Error(`${manifestPath} is a link; not read`)
  const manifest = JSON.parse(await fs.readFile(real, 'utf8'))
  return { root, routes: Array.isArray(manifest.routing) ? manifest.routing : [] }
}

// The covering route that every other covering route contains.
export function ownerOf(routes, folder) {
  const target = `${folder}/**`
  const covering = routes.filter(r => typeof r?.path === 'string' && routeContains(r.path, target))
  const specific = covering.find(c => covering.every(o => o === c || routeContains(o.path, c.path)))
  return specific ?? null
}

async function childDirs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  // A Dirent for a link is not a directory, so links are skipped here.
  return entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !SKIP.has(e.name))
    .map(e => e.name)
    .sort()
}

// Top-level folders nobody owns. A folder that holds routed subfolders (only
// `apps/web/**` is routed) reports its unowned children instead of itself —
// and itself too, marked partial, when files sit directly inside it.
export async function unownedFolders(projectRoot) {
  const { root, routes } = await readRouting(projectRoot)
  const out = []
  for (const top of await childDirs(root)) {
    if (ownerOf(routes, top)) continue
    const partly = routes.some(r => typeof r?.path === 'string' && routeContains(`${top}/**`, r.path))
    if (!partly) {
      out.push({ folder: top, partial: false })
      continue
    }
    const entries = await fs.readdir(path.join(root, top), { withFileTypes: true })
    if (entries.some(e => e.isFile() && !e.name.startsWith('.'))) out.push({ folder: top, partial: true })
    for (const child of await childDirs(path.join(root, top))) {
      const rel = `${top}/${child}`
      if (!ownerOf(routes, rel)) out.push({ folder: rel, partial: false })
    }
  }
  return out
}

// The nearest existing ancestor of `full`, resolved: a folder that does not
// exist yet may still sit under a link that leaves the project.
// A link whose target does not exist is not "missing": it is refused.
async function realNearest(full) {
  let current = full
  for (;;) {
    const info = await fs.lstat(current).catch(error => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (info !== null) {
      if (info.isSymbolicLink() && (await fs.stat(current).catch(() => null)) === null) {
        throw new Error(`${current} is a link to nothing; outside the project`)
      }
      return fs.realpath(current)
    }
    const parent = path.dirname(current)
    if (parent === current) throw new Error(`${full} has no existing ancestor`)
    current = parent
  }
}

export async function folderOwner(projectRoot, folder) {
  const problems = routePathProblems(folder)
  if (problems.length > 0 || /[*]/.test(folder) || path.isAbsolute(folder)) {
    throw new Error(`"${folder}" is not a plain project-relative folder: ${problems.join('; ') || 'no wildcards or absolute paths'}`)
  }
  const { root, routes } = await readRouting(projectRoot)
  const full = path.join(root, ...folder.split('/'))
  const real = await realNearest(full)
  if (!inside(root, real)) {
    throw new Error(`${folder} resolves outside the project (${real})`)
  }
  return ownerOf(routes, folder)
}

async function selftest() {
  const tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tb-module-scan-')))
  const assert = (ok, msg) => { if (!ok) throw new Error(`SELFTEST FAIL: ${msg}`) }
  const rejects = async (fn, fragment) => {
    try { await fn() } catch (e) { return e.message.includes(fragment) }
    return false
  }
  try {
    const project = path.join(tmp, 'p')
    for (const d of ['product/api', 'company', 'apps/web', 'apps/mobile', 'lib/auth', 'src/auth', 'node_modules/x', '.cache']) {
      await fs.mkdir(path.join(project, d), { recursive: true })
    }
    await fs.writeFile(path.join(project, 'lib', 'main.js'), '')
    await fs.mkdir(path.join(project, '.agent-source', 'agents'), { recursive: true })
    const manifest = {
      routing: [
        { path: 'product/**', role: 'backend-developer' },
        { path: 'apps/web/**', role: 'frontend-developer' },
        { path: 'src/**', role: 'backend-developer' },
        { path: 'src/auth/**', role: 'security-developer' },
        { path: 'lib/auth/**', role: 'security-developer' },
      ],
    }
    await fs.writeFile(path.join(project, '.agent-source', 'agents', 'manifest.json'), JSON.stringify(manifest))

    const unowned = await unownedFolders(project)
    const expected = [
      { folder: 'apps/mobile', partial: false },
      { folder: 'company', partial: false },
      { folder: 'lib', partial: true },
    ]
    assert(JSON.stringify(unowned) === JSON.stringify(expected), `unowned folders, got ${JSON.stringify(unowned)}`)
    assert((await folderOwner(project, 'src/auth/tokens')).role === 'security-developer', 'the most specific owner must win')
    assert((await folderOwner(project, 'src/billing')).role === 'backend-developer', 'a nested folder takes its parent route')
    assert((await folderOwner(project, 'company')) === null, 'an unowned folder has no owner')
    assert(await rejects(() => folderOwner(project, '../x'), 'not a plain'), 'a .. argument must be refused')
    assert(await rejects(() => folderOwner(project, 'src/*'), 'not a plain'), 'a wildcard argument must be refused')

    if (process.platform !== 'win32') {
      const outside = path.join(tmp, 'outside')
      await fs.mkdir(path.join(outside, 'secret'), { recursive: true })
      await fs.symlink(path.join(outside, 'secret'), path.join(project, 'linked'))
      assert(!(await unownedFolders(project)).some(entry => entry.folder === 'linked'), 'a directory link must not be listed')
      await fs.symlink(path.join(outside, 'not-created'), path.join(project, 'dangling'))
      assert(await rejects(() => folderOwner(project, 'dangling/new'), 'outside the project'), 'a folder under a dangling link must be refused')
      assert(await rejects(() => folderOwner(project, 'linked'), 'outside the project'), 'a folder resolving outside must be refused')
      assert(await rejects(() => folderOwner(project, 'linked/new'), 'outside the project'), 'a future folder under an outside link must be refused')

      // An ancestor of the manifest that links outside the project.
      const p2 = path.join(tmp, 'p2')
      await fs.mkdir(path.join(p2, '.agent-source'), { recursive: true })
      await fs.mkdir(path.join(outside, 'agents'), { recursive: true })
      await fs.writeFile(path.join(outside, 'agents', 'manifest.json'), JSON.stringify(manifest))
      await fs.symlink(path.join(outside, 'agents'), path.join(p2, '.agent-source', 'agents'))
      const originalReadFile = fs.readFile
      const read = []
      fs.readFile = (target, ...rest) => { read.push(String(target)); return originalReadFile(target, ...rest) }
      try {
        assert(await rejects(() => unownedFolders(p2), 'not read'), 'a manifest behind a linked ancestor must be refused')
      } finally {
        fs.readFile = originalReadFile
      }
      assert(read.length === 0, `a refused manifest must not be read at all, read ${JSON.stringify(read)}`)
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
    : args.length === 1
      ? unownedFolders(args[0]).then(list =>
          console.log(
            list.length
              ? list.map(f => (f.partial ? `unowned: ${f.folder} (only the files directly inside it)` : `unowned: ${f.folder}`)).join('\n')
              : 'every folder has an owner'
          )
        )
      : args.length === 2
        ? folderOwner(args[0], args[1]).then(owner =>
            console.log(owner ? `owner: ${owner.role} (route ${owner.path})` : `unowned: ${args[1]}`)
          )
        : Promise.reject(new Error('Usage: node module-scan.mjs <project> [<folder>] | --selftest'))
  run.catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
