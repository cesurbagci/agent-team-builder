# Generated Dosya Defteri (rapor-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sync`'in dosya silmesini tamamen durdurmak — kullanıcının elle yazdığı agent dosyalarının silinmesi bugün canlı bir veri kaybı bug'ı. Yerine sync ürettiklerinin defterini tutar ve bayatlayanları raporlar.

**Architecture:** `createContext` üretilen her generated yolu bir `produced` kümesinde toplar. `generate()` sonunda önceki defterle karşılaştırır: defterde olup artık üretilmeyen ve diskte duran dosyalar `(stale)` mismatch'i olarak raporlanır. Hiçbir dosya silinmez; `removeOrphans` ve `removeFile` kaldırılır.

**Tech Stack:** Node.js ≥18 (harici bağımlılık yok), repo'nun kendi selftest harness'ı (`--selftest`, test framework'ü yok).

## Global Constraints

- **Doküman dili Türkçe.** Kod, dosya adı ve commit mesajı İngilizce.
- **Harici bağımlılık eklenmez.** Yalnız Node stdlib.
- **Her kod değişikliği sonrası** `node team-builder-shared/sync-agent-config.mjs --selftest` → `SELFTEST PASS`.
- **Sync hiçbir dosya silmez.** Uygulama bittiğinde **generator kodunda** (`createContext`, `sync*`, `generate`) `fs.unlink` / `fs.rmdir` / `fs.rm` çağrısı **kalmamalıdır**. `runSelftest` içindeki fixture kurma, bozma ve temizleme kodu bu kuralın dışındadır — testler kaynak dosyaları silerek senaryo kurar.
- **`--check` hiçbir şey yazmaz ve silmez.** Defter dosyasının byte'larını da değiştirmez.
- **Defter yolları repo köküne göre POSIX ayraçlı ve sıralıdır** — mevcut `toPosix()` ile aynı biçim.
- **Bozuk/eksik defter hata vermez**, yalnız o turda bayat rapor üretilmez.
- **Spec:** `docs/superpowers/specs/2026-08-03-generated-ledger-design.md` — çelişki olursa spec geçerlidir.

---

### Task 1: Silme yolunu kaldır

Asıl bug fix, ve bilerek ilk sırada: bu commit'ten sonra sync artık hiçbir kullanıcı dosyasını silemez. Defter henüz yok, dolayısıyla bayat raporu da yok — bu ara durum kabul edilir çünkü bugünkü davranış zaten yanlış siliyor.

**Files:**
- Modify: `team-builder-shared/sync-agent-config.mjs` (`createContext`, `syncAgents`, `runSelftest`)

**Interfaces:**
- Consumes: yok (ilk task)
- Produces: `ctx.removeOrphans` ve `ctx.removeFile` **artık yoktur**. Task 2 bunların yokluğuna dayanır.

- [ ] **Step 1: Failing test yaz**

`team-builder-shared/sync-agent-config.mjs` içinde `runSelftest` fonksiyonunda, `// --check should be clean right after generate (idempotent).` yorumundan **önce** ekle:

```javascript
  // Preserve user-authored files: sync only owns what it generated.
  const handWritten = path.join(fixtureRoot, '.claude', 'agents', 'my-helper.md')
  const handWrittenBody = '---\nname: my-helper\n---\n\n# Elle yazdigim\n'
  await fs.writeFile(handWritten, handWrittenBody)
  await fs.mkdir(path.join(fixtureRoot, '.claude', 'skills', 'my-own-skill'), {
    recursive: true,
  })
  const handSkillBody = '---\nname: my-own-skill\ndescription: elle\n---\n\n# Elle\n'
  await fs.writeFile(
    path.join(fixtureRoot, '.claude', 'skills', 'my-own-skill', 'SKILL.md'),
    handSkillBody
  )

  await silentGenerate({ root: fixtureRoot, checkOnly: false })

  assert(
    await exists('.claude/agents/my-helper.md'),
    'hand-written agent must survive sync'
  )
  assert(
    normalizeText(await read('.claude/agents/my-helper.md')) ===
      normalizeText(handWrittenBody),
    'hand-written agent must not be rewritten'
  )
  assert(
    await exists('.claude/skills/my-own-skill/SKILL.md'),
    'hand-written skill must survive sync'
  )
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST FAIL: hand-written agent must survive sync`

Sebep: `removeOrphans` `.claude/agents/` içindeki manifest'te olmayan her `.md` dosyasını siliyor.

- [ ] **Step 3: `removeOrphans` ve `removeFile`'ı kaldır**

`createContext` içinden şu iki fonksiyonun **tamamını sil**:

```javascript
  async function removeFile(filePath) {
    if (checkOnly) {
      mismatches.push(`${toPosix(filePath)} (orphan)`)
      return
    }
    await fs.unlink(filePath)
    writes.push(`${toPosix(filePath)} (removed)`)
  }

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

`syncAgents` içinden şu bloğun **tamamını sil**:

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

Bu blok silinince dört küme kullanılmaz hâle gelir. Onları da sil:
- `syncAgents` başındaki `const expectedClaudeAgents = new Set()`, `const expectedCodexDefinitions = new Set()`, `const expectedCodexToml = new Set()`, `const expectedOpencodeAgents = new Set()` satırları
- Döngü içindeki `expectedClaudeAgents.add(fileName)`, `expectedCodexDefinitions.add(definitionFileName)`, `expectedCodexToml.add(tomlFileName)`, `expectedOpencodeAgents.add(fileName)` satırları
- Bu `.add(...)` satırlarının hemen üstündeki, yalnız onlara hizmet eden `const fileName = ...`, `const definitionFileName = ...`, `const tomlFileName = ...` bildirimlerinden **başka yerde kullanılmayanlar**. Dikkat: `fileName` ve `definitionFileName`/`tomlFileName` aşağıdaki `copyExpected`/`writeExpected` çağrılarında da kullanılıyor — o kullanımlar duruyorsa bildirimi **silme**.

- [ ] **Step 5: Mevcut ghost testlerini kaldır**

`runSelftest` içinde şu iki bloğun **tamamını sil** — artık silme olmadığı için ikisi de geçersiz:

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

Yerine gelen bayat raporu testleri Task 2'de eklenecek.

- [ ] **Step 6: Testi çalıştır, geçtiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS`

- [ ] **Step 7: Kod tabanında silme kalmadığını doğrula**

```bash
grep -n "fs.unlink\|fs.rmdir\|removeOrphans\|removeFile" team-builder-shared/sync-agent-config.mjs
```

Beklenen: yalnız `runSelftest` içindeki fixture temizliği (`fs.rm(fixtureRoot, ...)`) tipi satırlar; `fs.unlink`, `fs.rmdir`, `removeOrphans`, `removeFile` **hiç görünmemeli**.

- [ ] **Step 8: Asıl bug'ın kapandığını elle doğrula**

```bash
rm -rf /tmp/tb-bug && mkdir -p /tmp/tb-bug/.agent-source/agents /tmp/tb-bug/.agent-source/project && printf '{ "targetsDefault": ["claude"], "lead": "architect", "agents": [ { "name": "architect", "model": "opus" } ] }' > /tmp/tb-bug/.agent-source/agents/manifest.json && printf -- '---\nname: architect\n---\n\n# A\n' > /tmp/tb-bug/.agent-source/agents/architect.md && printf '# CLAUDE\n' > /tmp/tb-bug/.agent-source/project/CLAUDE.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-bug >/dev/null && printf -- '---\nname: my-helper\n---\n\n# Elle\n' > /tmp/tb-bug/.claude/agents/my-helper.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-bug && ls /tmp/tb-bug/.claude/agents/
```

Beklenen: `(removed)` satırı **görünmez**; `ls` çıktısında `architect.md` ve `my-helper.md` birlikte durur.

- [ ] **Step 9: Commit**

```bash
git add team-builder-shared/sync-agent-config.mjs
git commit -m "fix: stop sync from deleting files it did not write"
```

---

### Task 2: Defteri yaz ve bayat çıktıları raporla

**Files:**
- Modify: `team-builder-shared/sync-agent-config.mjs` (sabitler, `createContext`, `generate`, `runSelftest`)

**Interfaces:**
- Consumes: Task 1 sonrası kod (silme yolu yok)
- Produces: `LEDGER_RELATIVE` sabiti; `ctx.produced` (`Set<string>`, POSIX yollar); `reportStaleGenerated(ctx, ledgerPath)`

- [ ] **Step 1: Fixture'ı tüm çıktı tiplerini kapsayacak şekilde genişlet**

Mevcut fixture Codex proje kaynaklarını içermiyor, dolayısıyla `.codex/config.toml` ve
`.codex/team.md` hiç üretilmiyor — defter testi bu iki çıktı tipini kaçırırdı. `runSelftest`
içinde, `const opencodeTeam = ...` satırının **hemen altına** ekle:

```javascript
  const codexConfig = '# codex config\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'codex-config.toml'), codexConfig)
  const codexTeam = '# codex team\n'
  await fs.writeFile(path.join(sourceRoot, 'project', 'codex-team.md'), codexTeam)
```

Doğrula — bu iki dosya eklenince fixture 14 hedef üretmelidir:

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS` (henüz defter yok; bu adım yalnız fixture'ı genişletiyor).

- [ ] **Step 2: Failing test yaz — defter tam ve sıralı**

`runSelftest` içinde, Task 1'de eklediğin elle-yazılan-dosya assert'lerinden **sonra** ekle:

```javascript
  // The ledger lists every generated target, sorted, and never itself.
  assert(
    await exists('.agent-source/generated-files.json'),
    'ledger .agent-source/generated-files.json must be written'
  )
  const ledger = JSON.parse(await read('.agent-source/generated-files.json'))
  const expectedLedger = [
    '.agents/skills/demo-skill/SKILL.md',
    '.claude/agents/architect.md',
    '.claude/agents/developer.md',
    '.claude/skills/demo-skill/SKILL.md',
    '.codex/agent-definitions/architect.md',
    '.codex/agents/architect.toml',
    '.codex/config.toml',
    '.codex/team.md',
    '.opencode/agents/architect.md',
    '.opencode/skills/demo-skill/SKILL.md',
    '.opencode/team.md',
    'AGENTS.md',
    'CLAUDE.md',
    'opencode.json',
  ]
  assert(
    JSON.stringify(ledger.files) === JSON.stringify(expectedLedger),
    `ledger must equal the full sorted target list\n  got:      ${JSON.stringify(ledger.files)}\n  expected: ${JSON.stringify(expectedLedger)}`
  )
```

> **Not:** Beklenen liste fixture'ın ürettiği hedeflerdir. Fail mesajı `got`'u bastığı için, fixture'da bir fark varsa gerçek listeyi oradan okuyup `expectedLedger`'ı düzelt — ama **üyelik assert'ine düşürme**, tam eşitlik korunmalı (eksik hedef ancak böyle yakalanır).

- [ ] **Step 3: Testi çalıştır, fail ettiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST FAIL: ledger .agent-source/generated-files.json must be written`

- [ ] **Step 4: Sabiti ekle**

`const VALID_TARGETS = ...` satırının **hemen üstüne** ekle:

```javascript
// Sync's own record of what it generated. Staleness is reported against this,
// so a file the user wrote by hand is never mistaken for a leftover.
const LEDGER_RELATIVE = path.join('.agent-source', 'generated-files.json')
```

- [ ] **Step 5: `produced` kümesini ekle**

`createContext` içinde `const writes = []` satırının **hemen altına** ekle:

```javascript
  // Every generated path this run produced — whether it changed on disk or not.
  const produced = new Set()
```

`writeExpected` imzasını ve ilk satırlarını değiştir. Mevcut hâli:

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

`copyExpected`'ı opsiyonları geçirecek şekilde değiştir. Mevcut hâli:

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

`return { ... }` bloğuna `produced,` ekle — `writes,` satırının hemen altına.

- [ ] **Step 6: Bayat raporlayıcıyı ekle**

`syncSkills` fonksiyonunun **hemen altına**, `// generate — main pipeline` yorum bloğundan **önce** ekle:

```javascript
// Report generated targets this run no longer produces. Nothing is deleted:
// a path that stopped being generated is not proof that removing it is safe.
// A missing or malformed ledger yields no report — never an error.
async function reportStaleGenerated(ctx, ledgerPath) {
  if (!(await pathExists(ledgerPath))) {
    return
  }
  let previous
  try {
    previous = JSON.parse(await readText(ledgerPath))
  } catch {
    return
  }
  if (!previous || !Array.isArray(previous.files)) {
    return
  }
  for (const relative of previous.files) {
    if (typeof relative !== 'string' || relative.length === 0) continue
    if (ctx.produced.has(relative)) continue
    const filePath = ctx.resolveRoot(...relative.split('/'))
    if (!(await pathExists(filePath))) continue
    ctx.mismatches.push(`${relative} (stale)`)
  }
}
```

- [ ] **Step 7: `generate()`'te raporu ve defter yazımını bağla**

`generate()` içinde `await syncSkills(ctx, manifest)` satırının **hemen altına** ekle:

```javascript
  // Staleness is judged against the PREVIOUS ledger, then the new one is written.
  // The ledger is generated too, but must not list itself — track: false.
  const ledgerPath = ctx.resolveRoot(LEDGER_RELATIVE)
  await reportStaleGenerated(ctx, ledgerPath)
  const ledgerBody = JSON.stringify({ files: [...ctx.produced].sort() }, null, 2) + '\n'
  await ctx.writeExpected(ledgerPath, ledgerBody, { track: false })
```

- [ ] **Step 8: Testi çalıştır, geçtiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS`. Fail ederse mesajdaki `got` listesini `expectedLedger`'a yaz (Step 2'deki nota bak).

- [ ] **Step 9: Bayat raporu testlerini ekle**

> **Beklenen yan etki:** `architect` çıkarılınca geriye yalnız `developer` kalır ve o
> `targets: ['claude']` olduğu için projede artık Codex/OpenCode hedefi yoktur. Dolayısıyla
> `AGENTS.md`, `opencode.json`, `.opencode/team.md`, `.codex/config.toml`, `.codex/team.md`
> de üretilmez ve **onlar da `(stale)` raporlanır.** Bu doğrudur; aşağıdaki assert'ler
> `includes` kullandığı için ek stale girdileri testi bozmaz.

`runSelftest` içinde, defter assert'lerinden **sonra** ekle:

```javascript
  // Dropping an agent that fed three targets: the files STAY on disk and
  // every one of them is reported as stale.
  const trimmedManifest = {
    ...manifest,
    agents: manifest.agents.filter(a => a.name !== 'architect'),
    lead: 'developer',
  }
  await fs.writeFile(
    path.join(sourceRoot, 'agents', 'manifest.json'),
    JSON.stringify(trimmedManifest, null, 2)
  )
  await fs.rm(path.join(sourceRoot, 'agents', 'architect.md'))

  const staleRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  const staleTargets = [
    '.claude/agents/architect.md',
    '.codex/agent-definitions/architect.md',
    '.codex/agents/architect.toml',
    '.opencode/agents/architect.md',
  ]
  for (const target of staleTargets) {
    assert(await exists(target), `${target} must NOT be deleted, only reported`)
    assert(
      staleRun.mismatches.includes(`${target} (stale)`),
      `${target} must be reported exactly as "${target} (stale)"`
    )
  }

  // --check reports the same staleness, rewrites nothing, deletes nothing.
  const ledgerBefore = await read('.agent-source/generated-files.json')
  const staleCheck = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(
    staleCheck.mismatches.includes('.claude/agents/architect.md (stale)'),
    '--check must report stale targets'
  )
  assert(
    (await read('.agent-source/generated-files.json')) === ledgerBefore,
    '--check must not rewrite the ledger'
  )
  assert(
    await exists('.claude/agents/architect.md'),
    '--check must never delete anything'
  )

  // A hand-written file is never reported: it was never in the ledger.
  assert(
    !staleRun.mismatches.some(m => m.includes('my-helper.md')),
    'hand-written files must never be reported as stale'
  )
```

- [ ] **Step 10: Bozuk ve eksik defter testlerini ekle**

Aynı yere, Step 9'un ardından ekle:

```javascript
  // A malformed ledger is not an error: no report, and it gets rewritten.
  await fs.writeFile(
    path.join(fixtureRoot, '.agent-source', 'generated-files.json'),
    '{ bu gecerli JSON degil'
  )
  const brokenRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    !brokenRun.mismatches.some(m => m.endsWith('(stale)')),
    'a malformed ledger must produce no stale report'
  )
  assert(
    Array.isArray(
      JSON.parse(await read('.agent-source/generated-files.json')).files
    ),
    'a malformed ledger must be rewritten'
  )

  // No ledger means no report even though a genuinely stale target exists.
  await fs.rm(path.join(fixtureRoot, '.agent-source', 'generated-files.json'))
  const noLedgerRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    !noLedgerRun.mismatches.some(m => m.endsWith('(stale)')),
    'a missing ledger must produce no stale report (migration safety)'
  )
  assert(
    await exists('.claude/agents/architect.md'),
    'a missing ledger must not cause any deletion'
  )
  assert(
    await exists('.agent-source/generated-files.json'),
    'a missing ledger must be recreated'
  )

  // Idempotence: a second consecutive sync must report zero writes.
  const secondRun = await silentGenerate({ root: fixtureRoot, checkOnly: false })
  assert(
    (secondRun.writes ?? []).length === 0,
    `a second consecutive sync must write nothing, wrote: ${JSON.stringify(secondRun.writes)}`
  )
```

> `architect.md` bu noktada hâlâ diskte ve kaynaktan çıkarılmış durumda — yani defter silinmeden **önce** gerçek bir bayat çıktı var. Test bu yüzden boş geçemez.

- [ ] **Step 11: Testi çalıştır, geçtiğini gör**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS`

- [ ] **Step 12: Uçtan uca elle doğrula**

```bash
rm -rf /tmp/tb-stale && mkdir -p /tmp/tb-stale/.agent-source/agents /tmp/tb-stale/.agent-source/project && printf '{ "targetsDefault": ["claude"], "lead": "architect", "agents": [ { "name": "architect", "model": "opus" }, { "name": "dev", "model": "sonnet" } ] }' > /tmp/tb-stale/.agent-source/agents/manifest.json && printf -- '---\nname: architect\n---\n\n# A\n' > /tmp/tb-stale/.agent-source/agents/architect.md && printf -- '---\nname: dev\n---\n\n# D\n' > /tmp/tb-stale/.agent-source/agents/dev.md && printf '# CLAUDE\n' > /tmp/tb-stale/.agent-source/project/CLAUDE.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-stale >/dev/null && printf '{ "targetsDefault": ["claude"], "lead": "architect", "agents": [ { "name": "architect", "model": "opus" } ] }' > /tmp/tb-stale/.agent-source/agents/manifest.json && rm /tmp/tb-stale/.agent-source/agents/dev.md && node team-builder-shared/sync-agent-config.mjs --root /tmp/tb-stale; echo "--- dosya duruyor mu? ---"; ls /tmp/tb-stale/.claude/agents/
```

Beklenen: çıktıda `! .claude/agents/dev.md (stale)` uyarısı; `ls` çıktısında `dev.md` **hâlâ durur**.

- [ ] **Step 13: Commit**

```bash
git add team-builder-shared/sync-agent-config.mjs
git commit -m "feat: record generated paths and report stale targets"
```

---

### Task 3: Sözleşme dokümanlarını güncelle

**Files:**
- Modify: `team-builder-shared/sync-pipeline.md` (§8)
- Modify: `team-builder-shared/canonical-source.md`

**Interfaces:**
- Consumes: Task 1 ve 2'nin davranışı
- Produces: yok

- [ ] **Step 1: `sync-pipeline.md` §8'i yeniden yaz**

`team-builder-shared/sync-pipeline.md:104` `## 8. Fazlalık Generated Dosya Temizliği (orphan cleanup)` başlığıdır. Bu başlığı ve altındaki bölümün **tamamını** (bir sonraki `## 9.` başlığına kadar) şununla değiştir:

```markdown
## 8. Bayat Generated Dosya Raporu

**Generator hiçbir dosya silmez.** Bir dosyanın artık üretilmiyor olması, onu silmenin
güvenli olduğu anlamına gelmez; silme yolunu güvenli kılmak için gereken savunmalar
(yol containment, dosya türü kontrolü, case-insensitive yeniden adlandırma çakışması,
geçici I/O hatasının "üretilmedi" sanılması) sağladığı faydadan pahalıdır.

Bunun yerine sync bir **sahiplik defteri** tutar: `.agent-source/generated-files.json`.
Her başarılı çalışmada şunların birleşimini (repo köküne göre, POSIX ayraçlı, sıralı)
oraya yazar: bu turda ürettiği tüm generated yollar **artı** önceki defterde olup artık
üretilmeyen ama hâlâ diskte duran yollar. Defter kendini listelemez.

| Dosya durumu | Davranış |
|---|---|
| Defterde **var**, bu sefer de üretildi | Güncellenir |
| Defterde **var**, bu sefer üretilmedi, diskte duruyor | **`<yol> (stale)` raporlanır — silinmez, defterde KALIR** |
| Defterde **var**, bu sefer üretilmedi, diskte de yok | Kullanıcı silmiş → defterden düşer |
| Defterde **yok** | Hiç ilgilenilmez (kullanıcının dosyası olabilir) |

Bayat yolun defterde kalması şarttır: aksi halde dosya bir kez raporlanır, defterden
düşer ve bir daha hiç görünmez — `--check` yeşil yanarken dosya diskte kalır.

- Rapor mevcut mismatch kanalını kullanır: `--check` modunda exit 1, normal sync modunda
  `!` ile uyarı satırı.
- **Defter yoksa ya da okunamıyorsa bayat rapor üretilmez** ve hata verilmez. Bozuk
  defterin tek sonucu bir turluk eksik rapordur; sync defteri yeniden yazar.
- `--check` defter dosyasının içeriğini **değiştirmez**.
- Bayat dosyaları silmek kullanıcıya kalmıştır.
```

- [ ] **Step 2: `canonical-source.md`'ye defteri ekle**

`team-builder-shared/canonical-source.md` içinde `.claude/settings.local.json` canonical kaynak değildir.` ile başlayan maddeyi bul ve **hemen ardına** ekle:

```markdown
- `.agent-source/generated-files.json` **kaynak değildir** — `.agent-source/` ağacının
  içinde duran tek generated dosyadır. Sync'in kendi defteridir: en son hangi generated
  dosyaları ürettiğini kaydeder. Bayat çıktı raporu buna bakar, böylece kullanıcının elle
  yazdığı agent/skill dosyaları hiçbir zaman bayat sayılmaz. Elle düzenlenmez; commit
  edilir (takımda tutarlı olması için). Detay: `sync-pipeline.md` §8.
```

- [ ] **Step 3: Silme iddiası kalmadığını doğrula**

```bash
grep -rn "sil\|remove\|orphan" team-builder-shared/sync-pipeline.md team-builder-shared/canonical-source.md | grep -vi "stale\|silinmez\|silmek kullanıcıya\|silmez"
```

Beklenen: generator'ın dosya sildiğini ima eden hiçbir satır kalmamalı.

- [ ] **Step 4: Selftest'leri çalıştır**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest
```

Beklenen: iki kez `SELFTEST PASS`

- [ ] **Step 5: Commit**

```bash
git add team-builder-shared/sync-pipeline.md team-builder-shared/canonical-source.md
git commit -m "docs: replace orphan cleanup with stale reporting"
```

---

## Uygulama sonrası doğrulama

- [ ] **Selftest'ler geçiyor**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest
```

- [ ] **Kod tabanında silme yolu kalmamış**

```bash
grep -n "fs.unlink\|fs.rmdir\|removeOrphans\|removeFile" team-builder-shared/sync-agent-config.mjs || echo "temiz"
```

Beklenen: `temiz`

- [ ] **Elle yazılan dosya korunuyor, bayat çıktı raporlanıyor**

Task 2 Step 11'deki komutu çalıştır. Beklenen: `(stale)` uyarısı görünür, dosya diskte durur.

## Kapsam dışı

**Yol containment açığı bu planın kapsamı dışındadır.** `validate-manifest.mjs` agent adını
yalnız "boş olmayan string" diye doğruluyor; `path.join(root, '.claude/agents', '../../../X.md')`
repo kökünün dışına çıkıyor. Bu **bugün canlı bir yazma açığıdır** ve ayrı bir iş olarak
ele alınmalıdır. Bu plan silme yapmadığı için onu ne çözer ne kötüleştirir.
