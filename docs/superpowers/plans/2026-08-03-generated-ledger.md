# Generated Dosya Defteri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sync`'in kullanıcının elle yazdığı agent dosyalarını silmesini durdurmak, kaynaktan çıkarılan skill mirror'larının ortada kalmasını önlemek — ikisini de sync'in ürettiklerini kaydettiği bir deftere bağlayarak.

**Architecture:** `createContext` üretilen her generated yolu bir `produced` kümesinde toplar. `generate()` sonunda bu küme `.agent-source/generated-files.json` defteriyle karşılaştırılır: defterde olup artık üretilmeyen dosyalar silinir, defterde olmayanlara dokunulmaz. Dizin+uzantı tabanlı `removeOrphans` tamamen kaldırılır.

**Tech Stack:** Node.js ≥18 (harici bağımlılık yok), repo'nun kendi selftest harness'ı (`--selftest`, test framework'ü yok).

## Global Constraints

- **Doküman dili Türkçe.** Kod, dosya adı ve commit mesajı İngilizce.
- **Harici bağımlılık eklenmez.** Yalnız Node stdlib.
- **Her kod değişikliği sonrası** `node team-builder-shared/sync-agent-config.mjs --selftest` → `SELFTEST PASS`.
- **`--check` hiçbir şey silmez.** Silinmesi gereken her dosyayı `<yol> (orphan)` biçiminde mismatch olarak raporlar. Bu mevcut sözleşmedir, korunur.
- **Defter yoksa hiçbir şey silinmez.** Geçiş güvenliği; mevcut projelerde ani veri kaybı olmamalı.
- **Defter yolları repo köküne göre POSIX ayraçlıdır** — mevcut `toPosix()` ile aynı biçim.
- **Spec:** `docs/superpowers/specs/2026-08-03-generated-ledger-design.md` — çelişki olursa spec geçerlidir.

---

### Task 1: Üretilen yolları topla ve defteri yaz

Mevcut silme davranışını **değiştirmez**. Yalnız defteri oluşturur; bu güvenli ara adımdır.

**Files:**
- Modify: `team-builder-shared/sync-agent-config.mjs` (`createContext`, `generate`, `runSelftest`)

**Interfaces:**
- Consumes: yok (ilk task)
- Produces: `ctx.produced` — `Set<string>`, üretilen generated yolların POSIX biçimi. `LEDGER_RELATIVE = '.agent-source/generated-files.json'` sabiti. Task 2 bunları kullanır.

- [ ] **Step 1: Failing test yaz**

`team-builder-shared/sync-agent-config.mjs` içinde `runSelftest` fonksiyonunda, `// --check should be clean right after generate (idempotent).` yorumundan **önce** ekle:

```javascript
  // Defter: sync urettigi tum generated yollari kaydeder.
  assert(
    await exists('.agent-source/generated-files.json'),
    'ledger .agent-source/generated-files.json must be written'
  )
  const ledger = JSON.parse(await read('.agent-source/generated-files.json'))
  assert(Array.isArray(ledger.files), 'ledger must have a files array')
  assert(
    ledger.files.includes('.claude/agents/architect.md'),
    'ledger must list generated agent files'
  )
  assert(
    ledger.files.includes('CLAUDE.md'),
    'ledger must list generated project files'
  )
  assert(
    ledger.files.includes('.claude/skills/demo-skill/SKILL.md'),
    'ledger must list generated skill mirrors'
  )
  assert(
    !ledger.files.includes('.agent-source/generated-files.json'),
    'ledger must not list itself'
  )
  assert(
    ledger.files.every((f, i) => i === 0 || ledger.files[i - 1] <= f),
    'ledger files must be sorted for stable diffs'
  )
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST FAIL: ledger .agent-source/generated-files.json must be written`

- [ ] **Step 3: Sabiti ekle**

`team-builder-shared/sync-agent-config.mjs` içinde `const VALID_TARGETS = ...` satırının **hemen üstüne** ekle:

```javascript
// Sync's own record of what it generated. Cleanup compares against this, so a
// file the user wrote by hand is never mistaken for a stale generated target.
const LEDGER_RELATIVE = path.join('.agent-source', 'generated-files.json')
```

- [ ] **Step 4: `createContext`'e `produced` kümesini ekle**

`createContext` içinde `const writes = []` satırının **hemen altına** ekle:

```javascript
  // Every generated path this run produced — whether it changed on disk or not.
  const produced = new Set()
```

Ardından `writeExpected` imzasını ve ilk satırını değiştir. Mevcut hâli:

```javascript
  async function writeExpected(filePath, expected) {
    const normalizedExpected = normalizeText(expected)
```

Şununla değiştir:

```javascript
  async function writeExpected(filePath, expected, { track = true } = {}) {
    if (track) {
      produced.add(toPosix(filePath))
    }
    const normalizedExpected = normalizeText(expected)
```

`copyExpected`'ı da opsiyonları geçirecek şekilde değiştir. Mevcut hâli:

```javascript
  async function copyExpected(sourcePath, targetPath, transform = text => text) {
    const source = await readText(sourcePath)
    await writeExpected(targetPath, transform(source))
  }
```

Şununla değiştir:

```javascript
  async function copyExpected(sourcePath, targetPath, transform = text => text, options) {
    const source = await readText(sourcePath)
    await writeExpected(targetPath, transform(source), options)
  }
```

Son olarak `return { ... }` bloğuna `produced,` ekle — `writes,` satırının hemen altına.

- [ ] **Step 5: Defter yazımını `generate()`'e ekle**

`generate()` içinde `await syncSkills(ctx, manifest)` satırının **hemen altına** ekle:

```javascript
  // Ledger is generated too, but it must not list itself — track: false.
  const ledgerPath = ctx.resolveRoot(LEDGER_RELATIVE)
  const ledgerBody = JSON.stringify({ files: [...ctx.produced].sort() }, null, 2) + '\n'
  await ctx.writeExpected(ledgerPath, ledgerBody, { track: false })
```

- [ ] **Step 6: Testi çalıştır, geçtiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS`

- [ ] **Step 7: Gerçek projede elle doğrula**

```bash
rm -rf /tmp/tb-ledger && mkdir -p /tmp/tb-ledger/.agent-source/agents /tmp/tb-ledger/.agent-source/project && printf '{ "targetsDefault": ["claude"], "lead": "architect", "agents": [ { "name": "architect", "model": "opus" } ] }' > /tmp/tb-ledger/.agent-source/agents/manifest.json && printf -- '---\nname: architect\n---\n\n# A\n' > /tmp/tb-ledger/.agent-source/agents/architect.md && printf '# CLAUDE\n' > /tmp/tb-ledger/.agent-source/project/CLAUDE.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-ledger >/dev/null && cat /tmp/tb-ledger/.agent-source/generated-files.json
```

Beklenen çıktı:

```json
{
  "files": [
    ".claude/agents/architect.md",
    "CLAUDE.md"
  ]
}
```

- [ ] **Step 8: Commit**

```bash
git add team-builder-shared/sync-agent-config.mjs
git commit -m "feat: record generated paths in a sync ledger"
```

---

### Task 2: Temizliği deftere bağla

Asıl bug fix. `removeOrphans` kaldırılır, yerine defter farkına dayanan temizlik gelir.

**Files:**
- Modify: `team-builder-shared/sync-agent-config.mjs` (`createContext`, `syncAgents`, `generate`, `runSelftest`)

**Interfaces:**
- Consumes: Task 1'in `ctx.produced` kümesi ve `LEDGER_RELATIVE` sabiti
- Produces: `removeStaleGenerated(ctx, ledgerPath)` — `generate()` içinde, defter yazımından **önce** çağrılır. `ctx.removeOrphans` artık yoktur.

- [ ] **Step 1: Failing test yaz — kullanıcı dosyası korunmalı**

`runSelftest` içinde, Task 1'de eklediğin defter assert'lerinden **sonra** ekle:

```javascript
  // Kullanicinin elle yazdigi agent dosyasina ASLA dokunulmaz (defterde yok).
  const handWritten = path.join(fixtureRoot, '.claude', 'agents', 'my-helper.md')
  await fs.writeFile(handWritten, '---\nname: my-helper\n---\n\n# Elle yazdigim\n')
  await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    await exists('.claude/agents/my-helper.md'),
    'hand-written agent must survive sync (it is not in the ledger)'
  )
  assert(
    normalizeText(await read('.claude/agents/my-helper.md')) ===
      normalizeText('---\nname: my-helper\n---\n\n# Elle yazdigim\n'),
    'hand-written agent must not be rewritten'
  )

  // Kullanicinin elle yazdigi skill de korunur.
  await fs.mkdir(path.join(fixtureRoot, '.claude', 'skills', 'my-own-skill'), {
    recursive: true,
  })
  await fs.writeFile(
    path.join(fixtureRoot, '.claude', 'skills', 'my-own-skill', 'SKILL.md'),
    '---\nname: my-own-skill\ndescription: elle\n---\n\n# Elle\n'
  )
  await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    await exists('.claude/skills/my-own-skill/SKILL.md'),
    'hand-written skill must survive sync'
  )
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST FAIL: hand-written agent must survive sync (it is not in the ledger)`

Sebep: `removeOrphans` `.claude/agents/` içindeki manifest'te olmayan her `.md` dosyasını siliyor.

- [ ] **Step 3: `removeOrphans`'ı kaldır**

`createContext` içinden şu fonksiyonun tamamını **sil**:

```javascript
  // Remove generated files in dirPath that are not in expectedFileNames and
  // match one of allowedExtensions. Subdirs / other files are left untouched.
  async function removeOrphans(dirPath, expectedFileNames, allowedExtensions) {
    if (!(await pathExists(dirPath))) {
      return
    }
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const extension = path.extname(entry.name)
      if (!allowedExtensions.has(extension) || expectedFileNames.has(entry.name)) {
        continue
      }
      await removeFile(path.join(dirPath, entry.name))
    }
  }
```

`return { ... }` bloğundan `removeOrphans,` satırını da sil.

- [ ] **Step 4: `syncAgents`'taki orphan çağrılarını ve beklenen-ad kümelerini kaldır**

`syncAgents` içinden şu bloğun tamamını **sil**:

```javascript
  // Orphan cleanup for generated agent target dirs.
  await ctx.removeOrphans(
    ctx.resolveRoot('.claude', 'agents'),
    expectedClaudeAgents,
    new Set(['.md'])
  )
  await ctx.removeOrphans(
    ctx.resolveRoot('.codex', 'agent-definitions'),
    expectedCodexDefinitions,
    new Set(['.md'])
  )
  await ctx.removeOrphans(
    ctx.resolveRoot('.codex', 'agents'),
    expectedCodexToml,
    new Set(['.toml'])
  )
  await ctx.removeOrphans(
    ctx.resolveRoot('.opencode', 'agents'),
    expectedOpencodeAgents,
    new Set(['.md'])
  )
```

Bu blok silinince `expectedClaudeAgents`, `expectedCodexDefinitions`, `expectedCodexToml`, `expectedOpencodeAgents` kümeleri kullanılmaz hâle gelir. Onları da sil: `syncAgents` başındaki dört `const expected... = new Set()` satırı ve döngü içindeki dört `expected....add(fileName)` / `.add(definitionFileName)` / `.add(tomlFileName)` satırı.

- [ ] **Step 5: Defter tabanlı temizliği ekle**

`syncSkills` fonksiyonunun **hemen altına**, `// generate — main pipeline` yorum bloğundan **önce** ekle:

```javascript
// Remove targets this run no longer produces. Only paths the previous run
// recorded are eligible — anything absent from the ledger belongs to the user.
// A missing ledger means the project predates it: record, never delete.
async function removeStaleGenerated(ctx, ledgerPath) {
  if (!(await pathExists(ledgerPath))) {
    return
  }
  let previous
  try {
    previous = JSON.parse(await readText(ledgerPath))
  } catch {
    // An unreadable ledger must not authorise deletions.
    return
  }
  const files = Array.isArray(previous?.files) ? previous.files : []
  for (const relative of files) {
    if (ctx.produced.has(relative)) continue
    const filePath = ctx.resolveRoot(...relative.split('/'))
    if (!(await pathExists(filePath))) continue
    await ctx.removeFile(filePath)
  }
}
```

`createContext`'in `return { ... }` bloğuna `removeFile,` ekle — `copyExpected,` satırının hemen altına.

- [ ] **Step 6: `generate()`'te temizliği defter yazımından önce çağır**

`generate()` içinde Task 1'de eklediğin defter bloğunu şununla değiştir:

```javascript
  // Cleanup runs against the PREVIOUS ledger, then the new one is written.
  const ledgerPath = ctx.resolveRoot(LEDGER_RELATIVE)
  await removeStaleGenerated(ctx, ledgerPath)
  const ledgerBody = JSON.stringify({ files: [...ctx.produced].sort() }, null, 2) + '\n'
  await ctx.writeExpected(ledgerPath, ledgerBody, { track: false })
```

- [ ] **Step 7: Testi çalıştır, geçtiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: Kullanıcı dosyası assert'leri geçer. **Mevcut ghost testleri artık fail eder** — bu beklenen davranış değişikliğidir, Step 8'de güncellenecek. Beklenen fail:

```
SELFTEST FAIL: --check should report orphan generated file
```

- [ ] **Step 8: Mevcut ghost testlerini gerçek orphan senaryosuna çevir**

`runSelftest` içinde şu iki bloğun **tamamını sil**:

```javascript
  // Orphan detection: a stray generated agent file → drift in --check.
  await fs.writeFile(
    path.join(fixtureRoot, '.codex', 'agents', 'ghost.toml'),
    'orphan\n'
  )
  const checkOrphan = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(
    checkOrphan.mismatches.some(m => m.includes('ghost.toml')),
    '--check should report orphan generated file'
  )

  // Orphan detection for the opencode agents dir too.
  await fs.writeFile(
    path.join(fixtureRoot, '.opencode', 'agents', 'ghost.md'),
    'orphan\n'
  )
  const checkOcOrphan = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(
    checkOcOrphan.mismatches.some(m => m.includes('.opencode/agents/ghost.md')),
    '--check should report orphan opencode agent md'
  )
```

Yerine, aynı konuma ekle:

```javascript
  // Gercek orphan: onceki sync'in urettigi bir agent manifest'ten cikarilinca
  // generated karsiliklari silinir. Ghost dosyasi elle yaratmak artik orphan
  // uretmez — defterde olmayan dosya kullanicinin sayilir.
  const trimmedManifest = {
    ...manifest,
    agents: manifest.agents.filter(a => a.name !== 'developer'),
  }
  await fs.writeFile(
    path.join(sourceRoot, 'agents', 'manifest.json'),
    JSON.stringify(trimmedManifest, null, 2)
  )
  await fs.rm(path.join(sourceRoot, 'agents', 'developer.md'))

  // Once --check: silinmesi gerekeni raporlamali, DISKTEN SILMEMELI.
  const checkStale = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(
    checkStale.mismatches.some(m => m.includes('.claude/agents/developer.md')),
    '--check should report the removed agent as an orphan'
  )
  assert(
    await exists('.claude/agents/developer.md'),
    '--check must not delete anything'
  )

  // Sonra gercek sync: silinmeli.
  await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    !(await exists('.claude/agents/developer.md')),
    'agent removed from the manifest must be deleted from .claude/agents'
  )
  assert(
    await exists('.claude/agents/architect.md'),
    'the remaining agent must stay'
  )
  assert(
    await exists('.claude/agents/my-helper.md'),
    'hand-written agent must still survive a run that deletes a real orphan'
  )
```

- [ ] **Step 9: Testi çalıştır, geçtiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS`

- [ ] **Step 10: Asıl bug'ın kapandığını elle doğrula**

```bash
rm -rf /tmp/tb-bug && mkdir -p /tmp/tb-bug/.agent-source/agents /tmp/tb-bug/.agent-source/project && printf '{ "targetsDefault": ["claude"], "lead": "architect", "agents": [ { "name": "architect", "model": "opus" } ] }' > /tmp/tb-bug/.agent-source/agents/manifest.json && printf -- '---\nname: architect\n---\n\n# A\n' > /tmp/tb-bug/.agent-source/agents/architect.md && printf '# CLAUDE\n' > /tmp/tb-bug/.agent-source/project/CLAUDE.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-bug >/dev/null && printf -- '---\nname: my-helper\n---\n\n# Elle\n' > /tmp/tb-bug/.claude/agents/my-helper.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-bug && ls /tmp/tb-bug/.claude/agents/
```

Beklenen: `my-helper.md` çıktıda **durur**; `(removed)` satırı **görünmez**.

- [ ] **Step 11: Commit**

```bash
git add team-builder-shared/sync-agent-config.mjs
git commit -m "fix: stop sync from deleting hand-written agent files"
```

---

### Task 3: Boş dizin temizliği ve geçiş güvenliği

Skill mirror'ları dizin altında yaşar; son dosya silinince boş dizin kalmamalı. Ayrıca defter yokken hiçbir şeyin silinmediği kilitlenir.

**Files:**
- Modify: `team-builder-shared/sync-agent-config.mjs` (`removeStaleGenerated`, `runSelftest`)

**Interfaces:**
- Consumes: Task 2'nin `removeStaleGenerated` fonksiyonu
- Produces: yok

- [ ] **Step 1: Failing test yaz**

`runSelftest` içinde, Task 2'de eklediğin gerçek-orphan bloğundan **sonra** ekle:

```javascript
  // Skill kaynagi cikarilinca uc ekosistemdeki mirror'lar da temizlenir ve
  // geride bos dizin kalmaz.
  await fs.rm(path.join(sourceRoot, 'skills', 'demo-skill'), { recursive: true })
  await silentGenerate({ root: fixtureRoot, checkOnly: false })
  for (const dir of ['.claude/skills', '.agents/skills', '.opencode/skills']) {
    assert(
      !(await exists(`${dir}/demo-skill/SKILL.md`)),
      `${dir}/demo-skill/SKILL.md must be removed when the source skill is gone`
    )
    assert(
      !(await exists(`${dir}/demo-skill`)),
      `${dir}/demo-skill must not be left behind as an empty directory`
    )
  }
  assert(
    await exists('.claude/skills/my-own-skill/SKILL.md'),
    'hand-written skill must survive the mirror cleanup'
  )

  // Defter yoksa HICBIR SEY silinmez — sadece defter yeniden olusur.
  await fs.rm(path.join(fixtureRoot, '.agent-source', 'generated-files.json'))
  const strayPath = path.join(fixtureRoot, '.claude', 'agents', 'stray.md')
  await fs.writeFile(strayPath, '---\nname: stray\n---\n\n# Stray\n')
  await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    await exists('.claude/agents/stray.md'),
    'no ledger means no deletions (migration safety)'
  )
  assert(
    await exists('.agent-source/generated-files.json'),
    'a missing ledger must be recreated'
  )
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST FAIL: .claude/skills/demo-skill must not be left behind as an empty directory`

Sebep: `removeStaleGenerated` dosyayı siliyor ama boşalan dizini bırakıyor.

- [ ] **Step 3: Boş dizin budamayı ekle**

`removeStaleGenerated` fonksiyonunun **hemen üstüne** ekle:

```javascript
// Walk up from a deleted file's directory, removing directories that just went
// empty. Stops at the repo root and at the first directory that still has
// content — a directory holding the user's own files is never touched.
async function pruneEmptyDirs(startDir, stopDir) {
  let dir = startDir
  while (dir !== stopDir && dir.startsWith(stopDir + path.sep)) {
    let entries
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }
    if (entries.length > 0) return
    await fs.rmdir(dir)
    dir = path.dirname(dir)
  }
}
```

Sonra `removeStaleGenerated` içindeki silme satırını değiştir. Mevcut hâli:

```javascript
    if (!(await pathExists(filePath))) continue
    await ctx.removeFile(filePath)
```

Şununla değiştir:

```javascript
    if (!(await pathExists(filePath))) continue
    await ctx.removeFile(filePath)
    if (!ctx.checkOnly) {
      await pruneEmptyDirs(path.dirname(filePath), ctx.resolvedRoot)
    }
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS`

- [ ] **Step 5: Commit**

```bash
git add team-builder-shared/sync-agent-config.mjs
git commit -m "fix: prune emptied mirror directories and skip deletion without a ledger"
```

---

### Task 4: Sözleşme dokümanlarını güncelle

Generator'ın davranış sözleşmesi ve kaynak/generated sınırı yeni mekanizmayı yansıtmalı.

**Files:**
- Modify: `team-builder-shared/sync-pipeline.md` (§8)
- Modify: `team-builder-shared/canonical-source.md`

**Interfaces:**
- Consumes: Task 2 ve 3'ün davranışı
- Produces: yok

- [ ] **Step 1: `sync-pipeline.md` §8'i yeniden yaz**

`team-builder-shared/sync-pipeline.md:104` `## 8. Fazlalık Generated Dosya Temizliği (orphan cleanup)` başlığıdır. Bu başlığın altındaki bölümün **tamamını** (bir sonraki `## 9.` başlığına kadar) şununla değiştir:

```markdown
## 8. Fazlalık Generated Dosya Temizliği (orphan cleanup)

Temizlik **sync'in kendi defterine** dayanır: `.agent-source/generated-files.json`.
Sync her başarılı çalışmasında ürettiği tüm generated yolları (repo köküne göre, POSIX
ayraçlı) bu dosyaya yazar.

| Dosya durumu | Davranış |
|---|---|
| Defterde **var**, bu sefer de üretildi | Güncellenir |
| Defterde **var**, bu sefer üretilmedi | **Orphan → silinir** |
| Defterde **yok** | **Kullanıcının → dokunulmaz** |

- **Dizin ya da uzantı bakılarak silme YAPILMAZ.** `.claude/agents/` ve `.claude/skills/`
  gibi dizinler kullanıcının kendi dosyalarını koyabileceği meşru alanlardır; oradaki bir
  dosyanın kaynağı olmaması, onu sync'in yazdığı anlamına gelmez.
- **Defter yoksa hiçbir şey silinmez** — sync yalnız defteri oluşturur. Bu, defterden önce
  kurulmuş projelerde ani veri kaybını önler.
- **Defter okunamıyorsa da silme yapılmaz.** Bozuk bir defter silme yetkisi vermez.
- Silme sonrası **boşalan dizinler** kaldırılır; içinde başka dosya kalan dizine dokunulmaz.
- `--check` modunda silme yapılmaz; silinmesi gereken her orphan `<yol> (orphan)` biçiminde
  mismatch olarak raporlanır.
- Defterin kendisi generated'dır ama **kendini listelemez**; elle düzenlenmez.
```

- [ ] **Step 2: `canonical-source.md`'ye defteri ekle**

`team-builder-shared/canonical-source.md` içinde `.claude/settings.local.json` canonical kaynak değildir.` ile başlayan maddeyi bul ve **hemen ardına** ekle:

```markdown
- `.agent-source/generated-files.json` **kaynak değildir** — sync'in kendi defteridir:
  en son hangi generated dosyaları ürettiğini kaydeder. Temizlik bu deftere bakar, böylece
  kullanıcının elle yazdığı agent/skill dosyaları asla silinmez. Elle düzenlenmez; commit
  edilir (takımda tutarlı olması için). Detay: `sync-pipeline.md` §8.
```

- [ ] **Step 3: Selftest'i son kez çalıştır**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest
```

Beklenen: iki kez `SELFTEST PASS`

- [ ] **Step 4: Commit**

```bash
git add team-builder-shared/sync-pipeline.md team-builder-shared/canonical-source.md
git commit -m "docs: describe ledger-based orphan cleanup"
```

---

## Uygulama sonrası doğrulama

- [ ] **Selftest'ler geçiyor**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest
```

- [ ] **`removeOrphans` kodda kalmamış**

```bash
grep -rn "removeOrphans" team-builder-shared/ || echo "temiz"
```

Beklenen: `temiz`

- [ ] **Elle yazılan agent korunuyor, gerçek orphan siliniyor**

```bash
rm -rf /tmp/tb-final && mkdir -p /tmp/tb-final/.agent-source/agents /tmp/tb-final/.agent-source/project && printf '{ "targetsDefault": ["claude"], "lead": "architect", "agents": [ { "name": "architect", "model": "opus" }, { "name": "dev", "model": "sonnet" } ] }' > /tmp/tb-final/.agent-source/agents/manifest.json && printf -- '---\nname: architect\n---\n\n# A\n' > /tmp/tb-final/.agent-source/agents/architect.md && printf -- '---\nname: dev\n---\n\n# D\n' > /tmp/tb-final/.agent-source/agents/dev.md && printf '# CLAUDE\n' > /tmp/tb-final/.agent-source/project/CLAUDE.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-final >/dev/null && printf -- '---\nname: mine\n---\n\n# Mine\n' > /tmp/tb-final/.claude/agents/mine.md && printf '{ "targetsDefault": ["claude"], "lead": "architect", "agents": [ { "name": "architect", "model": "opus" } ] }' > /tmp/tb-final/.agent-source/agents/manifest.json && rm /tmp/tb-final/.agent-source/agents/dev.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-final && ls /tmp/tb-final/.claude/agents/
```

Beklenen: `dev.md (removed)` raporlanır; kalan dosyalar `architect.md` ve `mine.md`.
