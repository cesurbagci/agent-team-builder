# Preset Yükseltme (kapsam E) — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kurulumdan sonra beş anayasa preset'ini açıp kapatabilmek — ve bunu mümkün kılmak için ortak talimat metnini tek bir kaynağa taşımak.

**Architecture:** İki katman. **Kaynak yapısı:** ortak governance `.agent-source/project/instructions.md`'ye taşınır, hedef kaynakları (`project/CLAUDE.md`, `project/AGENTS.md`) referans + o ekosisteme özgü içerik taşır. Anayasa metni preset başına işaretli bloklara ayrılır ve yeni bir şablondan (`templates/constitution-blocks.md`) render edilir — setup ve yükseltme aynı kaynağı kullanır. **Yükseltme:** dördüncü bir skill (`team-builder-upgrade`) preset çevirir, `planGate`'in artefaktlarını kurar/bırakır ve eski yapıdaki projeleri göç ettirir. Kod yazılan tek yer generator'daki referans uyarısıdır; geri kalanı skill ve şablon metnidir.

**Tech Stack:** Node.js ESM (bağımlılıksız); `sync-agent-config.mjs` kendi `--selftest` bayrağını taşır ve testler o harness'a eklenir. Markdown skill ve şablon dosyaları.

## Global Constraints

- **Doküman dili Türkçe.** `team-builder-shared/*.md`, `templates/*.md` ve skill dosyaları Türkçe yazılır. `sync-agent-config.mjs`'te hata/uyarı mesajları **İngilizce**, kod yorumları İngilizce — dosyanın mevcut konvansiyonu.
- **Yeni bağımlılık yok.** Yalnız Node stdlib.
- **`instructions.md` üretilen dosya DEĞİLDİR.** `.agent-source/project/` altında yaşar ve referanslar onu orada gösterir. Generator onu kopyalamaz; ledger'a girmez.
- **İşaret adları:** `c:noWorkaround`, `c:codeDocSync`, `c:perAgentMemory`, `c:languageStandard`, `c:planGate`. Her biri `<!-- c:X -->` … `<!-- /c:X -->` çifti.
- **Referans yolu:** `.agent-source/project/instructions.md` — proje kökünden göreli.
- **Blok varlığı = preset açık.** İkinci bir durum kaydı tutulmaz.
- **`.agent-work/` asla silinmez.** Kullanıcı verisidir. `work-plan` skill kaynağı ve hedefleri ise `planGate` kapanınca **silinir**.
- **Referans eksikse `sync` uyarır, reddetmez.** `ctx.mismatches`'e **girmez** — oraya girmek `--check`'i düşürür, yani reddetmek olur.
- **Her commit'ten önce:** `node team-builder-shared/sync-agent-config.mjs --selftest`, `node team-builder-shared/validate-manifest.mjs --selftest`, `node team-builder-shared/validate-plan-gate.mjs --selftest` ve `node team-builder-shared/validate-plan-gate.mjs` geçmeli.
- **Spec:** `docs/superpowers/specs/2026-08-19-preset-upgrade-design.md`. Çelişki görürsen spec kazanır; spec yanlışsa dur ve sor.

---

## Dosya yapısı

| Dosya | Sorumluluk | Görev |
|---|---|---|
| `team-builder-shared/templates/constitution-blocks.md` | **YENİ** — preset başına işaretli blok şablonu. Setup ve yükseltmenin ortak metin kaynağı. | 1 |
| `team-builder-shared/constitution.md` | Preset başına işaret adı + blok şablonuna işaret | 1 |
| `team-builder-shared/sync-agent-config.mjs` | Referans eksikse uyarı + selftest | 2 |
| `team-builder-shared/canonical-source.md` | `instructions.md`'nin kaynak haritasındaki yeri | 2 |
| `team-builder-shared/routing.md` | Routing tablosunun artık `instructions.md`'ye yazıldığı | 3 |
| `team-builder-shared/codex-target.md` | §5: `AGENTS.md` referans taşır, içerik `instructions.md`'de | 3 |
| `team-builder-shared/opencode-target.md` | `instructions` dizisinin ilk elemanı + AGENTS.md kaynağı satırı | 3 |
| `team-builder-shared/architecture-docs.md` | Mimari kuralların artık `instructions.md`'ye işlendiği | 3 |
| `team-builder-shared/topologies.md` | `CLAUDE.md` notunun yalnız referans olduğu | 3 |
| `team-builder-shared/sync-pipeline.md` | Referans uyarısı ve stale temizliği sözleşmesi | 2 |
| `team-builder-setup/SKILL.md` | Yeni yapıyı üretir: `instructions.md` + referanslı hedef kaynakları + işaretli bloklar | 3 |
| `team-builder-upgrade/SKILL.md` | **YENİ** — dördüncü skill. Türetilen/metin preset'leri (4), `planGate` (5), göç (6). | 4, 5, 6 |
| `team-builder-shared/templates/work-plan-skill.md` | `--disallowedTools` variadic tuzağı notu | 7 |
| `docs/superpowers/specs/2026-08-02-plan-gate-design.md` | KARAR 20 kapanışı | 7 |

**Neden `instructions.md`'nin şablonu yok:** içeriği projeye özeldir (routing tablosu, kod-doküman satırları, mimari kök). Şablonu olan tek şey **anayasa blokları**dır; gerisini setup projeden üretir.

---

### Task 1 — Görev 1: Anayasa blok şablonu

Setup ve yükseltmenin aynı metni render edebilmesi için önce ortak kaynağı kur. Bu olmadan iki skill aynı prose'u iki yerde bestelemek zorunda kalır — planın kaçındığı şeyin ta kendisi.

**Files:**
- Create: `team-builder-shared/templates/constitution-blocks.md`
- Modify: `team-builder-shared/constitution.md`

**Interfaces:**
- Consumes: yok (ilk görev).
- Produces: beş işaretli blok şablonu. Görev 3 (setup) ve görev 4/5 (yükseltme) bunu render eder. İşaret adları global kısıtlarda sabittir.

- [ ] **Step 1: Şablonu oluştur**

`team-builder-shared/templates/constitution-blocks.md` dosyasını şu içerikle yaz:

````markdown
# constitution-blocks.md — Anayasa Blok Şablonları

> Paylaşılan referans. `team-builder-setup` kurulumda, `team-builder-upgrade` preset
> açarken **aynı** bloğu buradan render eder. Metnin tek kaynağı burasıdır.
>
> **Verbatim kopyalanmaz.** Bloklar `docLanguage`'e çevrilir; `templates/plan.md` ve
> `templates/work-plan-skill.md` ile aynı disiplin.
>
> **`<...>` yer tutucuları** render anında projenin cevaplarıyla doldurulur. Bu,
> `templates/plan.md`'nin yaptığının aynısıdır; `work-plan-skill.md` yer tutucu taşımaz.
>
> **İşaretler çevrilmez.** Başlıklar `docLanguage`'e çevrilir, bu yüzden hiçbir kural
> başlığa bakamaz — blok sınırları sabit HTML yorumlarıyla bulunur.

Her blok `.agent-source/project/instructions.md` içine, açık olan preset için konur.
Kapalı preset'in bloğu **bulunmaz**; blok varlığı preset'in açık olduğu anlamına gelir.

## `c:noWorkaround`

```markdown
<!-- c:noWorkaround -->
## Geçici çözüm yok

"Çalışıyor olması yetmez." Mimari kararı bypass eden hack kabul edilmez. Belirsizlikte
<architect varsa: architect'e danışılır / architect yoksa: kullanıcıya sorulur>.

Reddedilen desenler:
<workaround desen listesi — her madde `- ` ile başlayan kendi satırında>
<!-- /c:noWorkaround -->
```

**Yer tutucular:** `architect` dalı, manifest'in `agents[]` dizisinde **adı
`architect` olan** bir agent var mı diye bakılarak seçilir (`agents[].name` — şemada
`role` diye bir alan yoktur). Desen listesi kullanıcıya sorulur (`constitution.md` KARAR 1).

## `c:codeDocSync`

```markdown
<!-- c:codeDocSync -->
## Kod–doküman senkronizasyonu

Şu kod yolları değiştiğinde ilgili doküman da güncellenir:

| Kod | Doküman |
|---|---|
<manifest.codeDocSync[] satırları — kod | doc>

Liste boşsa bu kural yalnız bir disiplindir; otomatik denetimi yoktur.
<!-- /c:codeDocSync -->
```

**Yer tutucular:** tablo `manifest.codeDocSync[]`'ten üretilir. Boş dizi geçerlidir —
o hâlde tablo yazılmaz, yalnız son cümle kalır.

## `c:perAgentMemory`

```markdown
<!-- c:perAgentMemory -->
## Rol başına hafıza

Her agent kendi öğrendiklerini kendi hafıza dosyasında tutar; başka rolün hafızasına
yazmaz. Hafıza, rol talimatının parçasıdır ve rol değişince taşınmaz.
<!-- /c:perAgentMemory -->
```

**Yer tutucu yok.** Generator bu preset'i manifest'ten ayrıca okuyup agent dosyalarına
da yansıtır; buradaki blok projenin insan-okur açıklamasıdır.

## `c:languageStandard`

```markdown
<!-- c:languageStandard -->
## Dil ve yorum standardı

- Doküman, yorum metni ve kullanıcıya cevap: **<docLanguage>**.
- Kod artefaktları — fonksiyon, değişken, dosya adı, commit mesajı, JSDoc/TSDoc
  tag'leri: **İngilizce**.
- Yorumun metni <docLanguage>, tag'leri İngilizce. **Karışık dil kabul edilmez.**
<!-- /c:languageStandard -->
```

**Yer tutucular:** `<docLanguage>` manifest'ten. Generator bu preset'i manifest'ten
ayrıca okuyup her agent dosyasına da yansıtır (`agent-md-rich.md` → `## Dil Kuralları`);
buradaki blok projenin insan-okur açıklamasıdır. **İkisi aynı şeyi söylemeli** — kod
İngilizce, doküman/yorum `docLanguage`.

## `c:planGate`

```markdown
<!-- c:planGate -->
## Plan kapısı

Kod yazılmadan önce plan yazılır, **(denetleyici tanımlıysa)** denetlenir ve **kullanıcı
onaylar**. Kullanıcı onayı atlanamaz. Prosedürün tamamı `work-plan` skill'indedir.

- Plan denetleyicisi: <planReviewer ya da "yok">
- Kod denetleyicisi: <codeReviewer ya da "yok">

Planlar `.agent-work/` altında yaşar; durum, dosyanın bulunduğu klasördür.
<!-- /c:planGate -->
```

**Yer tutucular:** denetleyici adları `manifest.planGate`'ten. `null` ise "yok" yazılır
ve o kapı atlanır.
````

- [ ] **Step 2: `constitution.md`'ye işaret adlarını ve şablon referansını ekle**

`team-builder-shared/constitution.md` içinde, manifest alanlarını gösteren JSON bloğunun **hemen ardına** ekle:

```markdown
### Projeye yazılan metin

Her preset'in **projeye yazılan** metni `templates/constitution-blocks.md`'dedir ve
`.agent-source/project/instructions.md` içine işaretli blok olarak konur:

| Preset | İşaret |
|---|---|
| `noWorkaround` | `<!-- c:noWorkaround -->` |
| `codeDocSync` | `<!-- c:codeDocSync -->` |
| `perAgentMemory` | `<!-- c:perAgentMemory -->` |
| `languageStandard` | `<!-- c:languageStandard -->` |
| `planGate` | `<!-- c:planGate -->` |

**Bu dosya sihirbaz talimatıdır, projeye yazılan metin değil.** Aşağıdaki KARAR
bölümleri preset'in ne olduğunu ve kullanıcıya nasıl sorulacağını anlatır; projeye
giden metin şablondan render edilir. `team-builder-setup` kurulumda, `team-builder-upgrade`
preset açarken **aynı** şablonu kullanır.
```

- [ ] **Step 3: Doğrulayıcıları çalıştır**

Run:
```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs
```
Expected: dördü de PASS. (Bu görev kod değiştirmiyor; amaç bir şey bozulmadığını görmek.)

- [ ] **Step 4: Beş işaretin de şablonda olduğunu doğrula**

Run:
```bash
for m in noWorkaround codeDocSync perAgentMemory languageStandard planGate; do
  o=$(grep -c "<!-- c:$m -->" team-builder-shared/templates/constitution-blocks.md)
  c=$(grep -c "<!-- /c:$m -->" team-builder-shared/templates/constitution-blocks.md)
  echo "$m acilis=$o kapanis=$c"
done
```
Expected: beş satır, hepsinde `acilis=1 kapanis=1`.

Sayı farklıysa şablonda eksik ya da fazla işaret var — düzelt, tekrar çalıştır.

- [ ] **Step 5: Commit**

```bash
git add team-builder-shared/templates/constitution-blocks.md team-builder-shared/constitution.md
git commit -m "feat: add the constitution block template setup and upgrade both render"
```

---

### Task 2 — Görev 2: Referans uyarısı ve kaynak haritası

Kullanıcı referans satırını silerse proje bütün governance'ını **sessizce** kaybeder: üretilen dosya geçerli görünür, drift kontrolü temiz döner (kaynakla uyumludur çünkü), routing/anayasa/kod-doküman kuralları yok olur. Bu görev o sessizliği kaldırır.

**Files:**
- Modify: `team-builder-shared/sync-agent-config.mjs`
- Modify: `team-builder-shared/canonical-source.md`
- Modify: `team-builder-shared/sync-pipeline.md`

**Interfaces:**
- Consumes: görev 1'in işaret adları (doğrudan kullanılmaz, bağlam).
- Produces: `export const INSTRUCTIONS_REF` — referans yolu dizesi, `.agent-source/project/instructions.md`. Görev 3 ve 6 bu dizeyi birebir yazar.

- [ ] **Step 1: Failing test'i yaz**

`team-builder-shared/sync-agent-config.mjs` selftest'inde, mevcut fixture kurulumundan sonra çalışan bir vaka ekle. Selftest gövdesinde `claudeMd` fixture'ının yazıldığı yeri bul (`const claudeMd = '# CLAUDE\n\nProje talimati.\n'` civarı) ve **o fixture'ı referanslı hâle getir**, sonra referansı düşüren bir vaka ekle.

Önce fixture'ı değiştir:

```js
  const claudeMd = `# CLAUDE\n\n@${INSTRUCTIONS_REF}\n\nProje talimati.\n`
```

```js
  const agentsMd = `# AGENTS\n\nButun proje kurallari @${INSTRUCTIONS_REF} dosyasindadir.\n`
```

Sonra selftest'in sonuna, `generate()` çağrılarının yapıldığı bölgeye yeni bir vaka ekle:

```js
  // A source file that lost its instructions reference still generates a valid
  // looking target and passes drift check — the project silently loses all of
  // its governance. The warning is the only thing standing between the user and
  // that outcome, so it has its own case.
  {
    await fs.writeFile(
      path.join(sourceRoot, 'project', 'CLAUDE.md'),
      '# CLAUDE\n\nProje talimati.\n'
    )
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...a) => warnings.push(a.join(' '))
    try {
      await generate({ root: fixtureRoot, checkOnly: false })
    } finally {
      console.warn = originalWarn
    }
    assert(
      warnings.some(w => w.includes(INSTRUCTIONS_REF)),
      `expected a warning naming ${INSTRUCTIONS_REF}, got: ${warnings.join(' | ') || '(none)'}`
    )
    await fs.writeFile(
      path.join(sourceRoot, 'project', 'CLAUDE.md'),
      `# CLAUDE\n\n@${INSTRUCTIONS_REF}\n\nProje talimati.\n`
    )
  }
```

Selftest'te `assert`, `fs`, `path`, `sourceRoot`, `fixtureRoot` adlarını komşu vakalardan **birebir** kopyala — bu dosyanın kendi harness'ı ne kullanıyorsa o.

> **Tuzak — komşu vakaları refleksle taklit etme.** Bu dosyanın selftest'i her yerde
> `silentGenerate()` kullanıyor; o da `generate`'i `quiet: true` ile çağırır ve `quiet`
> modunda `warn` **no-op**'tur. `silentGenerate` kullanırsan uyarı hiç üretilmez, test
> yanlış sebepten kalır, ve daha kötüsü **mutasyon testi sahte biçimde geçer** — çünkü
> mutasyonlu kod da uyarı üretmiyor olur. Bu vaka bilerek `generate()`'i doğrudan
> çağırır; `console.warn` zaten yakalandığı için selftest çıktısı yine temiz kalır.

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `node team-builder-shared/sync-agent-config.mjs --selftest`
Expected: FAIL — `INSTRUCTIONS_REF is not defined` (sabit henüz yok).

- [ ] **Step 3: Sabiti ve uyarıyı ekle**

Dosyanın üst kısmına, öbür `export const` tanımlarının yanına:

```js
// The shared instruction file lives in the canonical source and is referenced —
// never copied. If a source file loses this reference the generated target still
// looks valid and drift check stays clean, so nothing else would ever notice.
export const INSTRUCTIONS_REF = '.agent-source/project/instructions.md'
```

`generate()` içinde, `await syncProjectFiles(ctx, manifest)` çağrısının **hemen öncesine**:

```js
  await warnMissingInstructionsRef(ctx, manifest, warn)
```

Ve `syncProjectFiles` fonksiyonunun hemen öncesine yeni fonksiyon:

```js
// Deliberately a warning, not a ctx.mismatch: mismatches fail --check, and the
// project owner decided a missing reference must not block generation. The
// offer to restore it belongs to the interactive skills, not here.
async function warnMissingInstructionsRef(ctx, manifest, warn) {
  const checks = []
  if (projectHasClaude(manifest)) checks.push('CLAUDE.md')
  if (projectHasCodex(manifest) || projectHasOpencode(manifest)) checks.push('AGENTS.md')

  for (const name of checks) {
    const source = ctx.resolveSource('project', name)
    if (!(await pathExists(source))) continue
    const body = await readText(source)
    if (!body.includes(INSTRUCTIONS_REF)) {
      warn(
        `! .agent-source/project/${name} does not reference ${INSTRUCTIONS_REF} — ` +
          'the project loses its shared governance text. Add the reference back.'
      )
    }
  }
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `node team-builder-shared/sync-agent-config.mjs --selftest`
Expected: PASS.

- [ ] **Step 5: Mutasyon testi — uyarının gerçekten savunulduğunu kanıtla**

```bash
cp team-builder-shared/sync-agent-config.mjs /tmp/sac.bak
node -e '
const fs=require("node:fs");const p="team-builder-shared/sync-agent-config.mjs";
fs.writeFileSync(p, fs.readFileSync(p,"utf8").replace("if (!body.includes(INSTRUCTIONS_REF)) {", "if (false) {"));'
node team-builder-shared/sync-agent-config.mjs --selftest; echo "mutant exit=$?"
cp /tmp/sac.bak team-builder-shared/sync-agent-config.mjs && rm /tmp/sac.bak
node team-builder-shared/sync-agent-config.mjs --selftest && echo "restored OK"
```

Expected: mutant satırında `expected a warning naming .agent-source/project/instructions.md, got: (none)` ve `mutant exit=1`; sonra `restored OK`.

`mutant exit=0` görürsen test kuralı savunmuyor — dur, testi düzelt.

**Geri yükleme `git checkout` ile yapılmaz** — henüz stage'lenmemiş çalışmanı da siler.

- [ ] **Step 6: `canonical-source.md`'ye satırı ekle**

`project/CLAUDE.md` satırının **hemen öncesine**:

```markdown
| `project/instructions.md` | *(kopyalanmaz — hedefler referans verir)* | Her zaman |
```

Ve tablonun altına açıklama:

```markdown
> **`instructions.md` üretilen dosya değildir.** `.agent-source/project/` altında yaşar
> ve `CLAUDE.md`/`AGENTS.md` ona referans verir; `opencode.json` `instructions` dizisine
> ekler. Kopyalanmadığı için ledger'a girmez ve drift kontrolüne konu olmaz — ama
> **referansın kendisi** denetlenir (`sync-pipeline.md`).
```

- [ ] **Step 7: `sync-pipeline.md`'ye sözleşmeyi yaz**

Dosyanın sonuna:

```markdown
## Ortak talimat referansı

Hedeflenen her ekosistemin kaynak dosyası `.agent-source/project/instructions.md`
referansını taşımalıdır: Claude için `project/CLAUDE.md`, Codex ya da OpenCode için
`project/AGENTS.md`.

Referans eksikse `sync` **uyarır ve devam eder** — reddetmez. Gerekçe: dosya kullanıcının
kendi kaynağıdır ve tek satır yüzünden üretimi durdurmak orantısız olur. Ama sessiz de
kalınamaz: üretilen dosya geçerli görünür, drift kontrolü temiz döner ve proje bütün
governance metnini kaybetmiş olur.

Uyarı **`ctx.mismatches`'e girmez** — oraya girseydi `--check` düşerdi, yani reddetmiş
olurduk. Bunun bedeli: yalnız `--check` çalıştıran bir CI eksik referansı görmez.
Bilinçli bir tercihtir; eklemeyi teklif etmek etkileşimli skill'lerin işidir.
```

- [ ] **Step 8: Commit**

```bash
git add team-builder-shared/sync-agent-config.mjs team-builder-shared/canonical-source.md team-builder-shared/sync-pipeline.md
git commit -m "feat: warn when a source file loses its instructions reference"
```

---

### Task 3 — Görev 3: Setup yeni yapıyı üretsin

**Files:**
- Modify: `team-builder-setup/SKILL.md`

**Interfaces:**
- Consumes: görev 1'in şablonu, görev 2'nin `INSTRUCTIONS_REF` yolu.
- Produces: yeni kurulumlarda `instructions.md` + referanslı hedef kaynakları. Görev 6 (göç) eski yapıyı buna dönüştürür, yani ikisinin çıktısı **aynı** olmalı.

- [ ] **Step 1: Üretilecek dosyalar listesini değiştir**

`team-builder-setup/SKILL.md` içinde `.agent-source/project/CLAUDE.md` üretimini anlatan maddeyi bul (Adım 8 civarı, "Claude hedefi seçildiyse" ile başlayan). Şu üç maddeyi **onların yerine** yaz:

```markdown
- **Her zaman:** `.agent-source/project/instructions.md` — **ortak talimat kaynağı.**
  Routing tablosu (+ çözüm kuralı: "bir dosya birden fazla satıra uyarsa **en özgül (en
  dar) yol kazanır**"), kod-doküman satırları, mimari kaynaklar ve **açık olan her
  anayasa preset'inin işaretli bloğu**. Bloklar
  `~/.claude/skills/team-builder-shared/templates/constitution-blocks.md`'den render
  edilir — verbatim kopyalanmaz, `docLanguage`'e çevrilir ve yer tutucular projenin
  cevaplarıyla doldurulur. **Kapalı preset'in bloğu yazılmaz.**
- **Claude hedefi seçildiyse:** `.agent-source/project/CLAUDE.md` — **ilk satırı
  referans olmalı:** `@.agent-source/project/instructions.md`. Altına yalnız Claude'a
  özgü olan gelir: **`topology: native` ise** "Takımı başlatma" bölümü (takımın doğal
  dille nasıl kurulacağına dair kısa örnek + teammate'lerin peer-to-peer koordine
  olduğu notu). Claude seçilmediyse bu dosyayı **YAZMA**.
- **Codex veya OpenCode hedefi seçildiyse:** `.agent-source/project/AGENTS.md` — referans
  satırını taşır: `Bütün proje kuralları @.agent-source/project/instructions.md
  dosyasındadır. Önce onu oku.` Bugün bu ekosistemlere özgü başka içerik yoktur, yani
  dosya kısadır; kullanıcının sonradan ekleyeceği şey için açık durur.
```

- [ ] **Step 2: `opencode.json` maddesine `instructions` girdisini ekle**

`opencode.json` üretimini anlatan maddede, `instructions` dizisini tarif eden kısmı şununla değiştir:

```markdown
`instructions` dizisinin **ilk** elemanı `.agent-source/project/instructions.md`
olmalı, ardından `AGENTS.md` ve mimari doküman glob'u gelir.
```

- [ ] **Step 3: Referansın zorunluluğunu yaz**

Aynı bölümün sonuna:

```markdown
> **Referans satırı zorunludur.** Kullanıcı onu silerse proje bütün governance metnini
> **sessizce** kaybeder — üretilen dosya geçerli görünür ve drift kontrolü temiz döner.
> `sync` bunu uyarı olarak yakalar ama reddetmez; o yüzden ilk yazımda doğru koymak
> önemlidir.
```

- [ ] **Step 4: Doğrulayıcıları çalıştır**

Run:
```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs
```
Expected: dördü de PASS.

- [ ] **Step 5: Setup'ın anlattığı yapının şablonla uyuştuğunu doğrula**

Run:
```bash
grep -c 'instructions.md' team-builder-setup/SKILL.md
grep -c 'constitution-blocks.md' team-builder-setup/SKILL.md
```
Expected: ilki en az `4`, ikincisi en az `1`.

Sıfır çıkarsa bir adım atlanmış — geri dön.

- [ ] **Step 6: Commit**

```bash
git add team-builder-setup/SKILL.md
git commit -m "feat: setup writes the shared instruction file and references it"
```

---

### Task 4 — Görev 4: Yükseltme skill'i — türetilen ve metin preset'leri

Dördüncü skill'in iskeletini ve **kolay** iki sınıfı kur. `planGate` (görev 5) ve göç (görev 6) bunun üstüne biner.

**Files:**
- Create: `team-builder-upgrade/SKILL.md`

**Interfaces:**
- Consumes: görev 1'in şablonu ve işaret adları, görev 2'nin `INSTRUCTIONS_REF`.
- Produces: `## Preset çevirme` bölümü ve ortak akış. Görev 5 aynı akışa `planGate` dalını, görev 6 `## Göç` bölümünü ekler.

- [ ] **Step 1: Skill'i oluştur**

`team-builder-upgrade/SKILL.md` dosyasını şu içerikle yaz:

````markdown
---
name: team-builder-upgrade
description: Kurulmuş bir projede anayasa preset'lerini (geçici çözüm yok, kod-doküman senkronizasyonu, rol başına hafıza, dil standardı, plan kapısı) açar veya kapatır; plan kapısının artefaktlarını kurar ya da bırakır; eski yapıdaki projeleri tek talimat dosyasına göç ettirir. Tetikleyiciler — "plan kapısını aç", "preset aç", "preset kapat", "anayasa değiştir", "takımı yükselt". Yeni rol/routing/ekosistem eklemek için kullanma; o setup'ın işidir.
---

# team-builder-upgrade

Kurulmuş bir projede **anayasa preset'lerini** açar/kapatır. Kurulum bir kez çalışır
(`team-builder-setup`), `sync` ince bir sarmalayıcıdır (`team-builder-sync`); bu skill
ikisinin arasındaki boşluğu doldurur: kurulumdan sonra fikir değişince.

**Kapsam dışı:** rol ekleme/çıkarma, routing değiştirme, yeni ekosistem hedefleme.
Bunlar setup'ın soru akışının tamamını gerektirir — kullanıcı isterse setup'a yönlendir.

## Beş preset, üç sınıf

| Sınıf | Preset | Yapılacak iş |
|---|---|---|
| Türetilen | `perAgentMemory`, `languageStandard` | Manifest + `instructions.md` bloğu + `sync` |
| Metin | `noWorkaround`, `codeDocSync` | Aynısı + projeye özel cevap sorulur |
| Artefakt | `planGate` | Aynısı + dosya/dizin kurma ya da bırakma |

Türetilen ikisini generator manifest'ten ayrıca okuyup agent dosyalarına da yansıtır;
o yüzden onlarda `sync` gerçek bir çıktı değişikliği üretir. Üçü de `instructions.md`'ye
blok yazar — insan-okur açıklama her preset için gerekir.

## Ortak akış

Hangi preset olursa olsun sıra aynıdır:

1. **Durumu göster.** `.agent-source/agents/manifest.json`'daki `constitution`
   alanlarını sade dille listele: hangisi açık, hangisi kapalı. Alan adlarını
   (`noWorkaround` vb.) kullanıcıya **gösterme**.
2. **Değişikliği sor.** Hangisi açılacak/kapatılacak.
3. **Etkiyi önce söyle.** Ne üretilecek, ne silinecek, neye dokunulmayacak. Kapatmada
   bu adım **zorunludur**.
4. **Onay al.** Onaysız hiçbir dosya değişmez.
5. **Uygula:** manifest → `instructions.md` bloğu → (varsa) artefakt.
6. **`sync` çalıştır.**
7. **Doğrula ve raporla.**

## İşaretli bloklar

Anayasa metni `.agent-source/project/instructions.md` içinde, preset başına işaretli
bloklarda durur:

| Preset | İşaret |
|---|---|
| `noWorkaround` | `<!-- c:noWorkaround -->` … `<!-- /c:noWorkaround -->` |
| `codeDocSync` | `<!-- c:codeDocSync -->` … `<!-- /c:codeDocSync -->` |
| `perAgentMemory` | `<!-- c:perAgentMemory -->` … `<!-- /c:perAgentMemory -->` |
| `languageStandard` | `<!-- c:languageStandard -->` … `<!-- /c:languageStandard -->` |
| `planGate` | `<!-- c:planGate -->` … `<!-- /c:planGate -->` |

**Blok varlığı = preset açık.** İkinci bir durum kaydı tutma; manifest ile blok
arasında bir tutarsızlık görürsen kullanıcıya bildir ve manifest'i doğru kabul et.

**Açarken:** bloğu `~/.claude/skills/team-builder-shared/templates/constitution-blocks.md`'den
render et — verbatim kopyalama, `docLanguage`'e çevir ve `<...>` yer tutucularını
projenin cevaplarıyla doldur. Bloğu `instructions.md`'nin sonuna ekle.

**Kapatırken:** açılış ve kapanış işareti dahil bloğun tamamını çıkar. Başka hiçbir
şeye dokunma.

**`instructions.md` yoksa** bu proje eski yapıdadır → *Göç* bölümüne bak.

## Projeye özel cevap isteyen preset'ler

`noWorkaround` ve `codeDocSync` açılırken projeye özel bilgi gerekir. Soru kalıplarını
`~/.claude/skills/team-builder-shared/constitution.md`'den al ve **sade dille** sor —
alan adı ya da "glob" gibi jargon gösterme.

- `noWorkaround` → reddedilen desen listesi. Çekirdek bir liste öner, kullanıcı ekler.
- `codeDocSync` → kod→doküman satırları. **Boş liste geçerlidir**; kullanıcı
  istemiyorsa `[]` yaz ve bloğun son cümlesi bunu zaten açıklıyor.

Cevabı **hem manifest'e hem render edilen bloğa** yaz. İkisi ayrışırsa blok yalan söyler.

## Zaten açık/kapalı olan

Kullanıcı zaten açık bir preset'i açmak isterse **işlem yapma**, durumu söyle. Aynısı
kapalıyı kapatmak için de geçerli.

## Referans eksikse

`sync` çalıştırdığında `.agent-source/project/CLAUDE.md` ya da `AGENTS.md`'nin ortak
talimat referansını kaybettiğine dair uyarı görürsen, kullanıcıya **eklemeyi teklif
et**. Kabul ederse satırı geri koy:

- `CLAUDE.md` → `@.agent-source/project/instructions.md`
- `AGENTS.md` → `Bütün proje kuralları @.agent-source/project/instructions.md dosyasındadır. Önce onu oku.`

Reddederse zorlama — ama uyarı her `sync`'te tekrar çıkacak, bunu söyle.
````

- [ ] **Step 2: Skill'in frontmatter'ının geçerli olduğunu doğrula**

Run:
```bash
head -4 team-builder-upgrade/SKILL.md
node -e '
const fs=require("node:fs");
const t=fs.readFileSync("team-builder-upgrade/SKILL.md","utf8");
const m=/^---\n([\s\S]*?)\n---\n/.exec(t);
if(!m){console.error("FAIL: frontmatter yok");process.exit(1)}
if(!/^name:\s*team-builder-upgrade$/m.test(m[1])){console.error("FAIL: name yanlis");process.exit(1)}
if(!/^description:\s*\S/m.test(m[1])){console.error("FAIL: description bos");process.exit(1)}
console.log("frontmatter OK");'
```
Expected: `frontmatter OK`.

- [ ] **Step 3: Beş işaretin de skill'de belgelendiğini doğrula**

Run:
```bash
for m in noWorkaround codeDocSync perAgentMemory languageStandard planGate; do
  grep -q "c:$m" team-builder-upgrade/SKILL.md && echo "$m OK" || echo "$m EKSIK"
done
```
Expected: beş satır, hepsi `OK`.

- [ ] **Step 4: Doğrulayıcıları çalıştır**

Run:
```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs
```
Expected: üçü de PASS.

`validate-plan-gate.mjs` `team-builder-shared/` altında `SKILL.md` adlı dosya arar ve bulursa hata verir — yeni skill `team-builder-upgrade/` altında olduğu için etkilenmez. Hata alırsan dosyayı yanlış yere koymuşsundur.

- [ ] **Step 5: Commit**

```bash
git add team-builder-upgrade/SKILL.md
git commit -m "feat: add the upgrade skill with derived and text preset toggling"
```

---

### Task 5 — Görev 5: `planGate` açma/kapama

Bu görevin en keskin kuralı: **veri korunur, konfigürasyon temizlenir.** İkisini karıştırmak ya kullanıcının işini siler ya da projeyi kendi durumu hakkında yalan söyler hâlde bırakır.

**Files:**
- Modify: `team-builder-upgrade/SKILL.md`

**Interfaces:**
- Consumes: görev 4'ün ortak akışı ve blok kuralları.
- Produces: `## Plan kapısı` bölümü. Görev 6 (göç) buna dokunmaz.

- [ ] **Step 1: Bölümü ekle**

`team-builder-upgrade/SKILL.md` içinde `## Referans eksikse` bölümünün **hemen öncesine** ekle:

````markdown
## Plan kapısı (`planGate`)

Öbür dört preset yalnız metin yazar; bu, projede **dosya ve dizin üretir**. O yüzden
açma ve kapatma ayrı ayrı anlatılır.

### Açarken

1. **Denetleyicileri sor.** `constitution.md` KARAR 5'in soru kalıbını kullan:
   - plan denetleyicisi: bir agent adı ya da "yok"
   - kod denetleyicisi: bir agent adı ya da "yok"

   Seçilen agent **kod yazmayan** bir agent olmalı (`writesCode: false`). Kullanıcı kod
   yazan bir rol seçerse söyle ve tekrar sor — doğrulayıcı zaten reddeder, ama hatayı
   sihirbaz aşamasında yakalamak daha iyidir.
2. **Manifest'i yaz:** `constitution.planGate: true` **ve** kök `planGate` nesnesi
   (`planReviewer`, `codeReviewer` — ikisi de zorunlu, değer ad ya da `null`).
3. **Bloğu ekle:** `<!-- c:planGate -->` … `<!-- /c:planGate -->`, şablondan render
   edilmiş, denetleyici adları doldurulmuş.
4. **Skill kaynağını üret:** `.agent-source/skills/work-plan/SKILL.md` —
   `~/.claude/skills/team-builder-shared/templates/work-plan-skill.md`'den,
   `docLanguage`'e çevrilerek. **İşaretler çevrilmez.**
5. **İskeleti kur:** `.agent-work/` altında `README.md`, `TEMPLATE.md` (bu da
   `templates/plan.md`'den render edilir) ve beş klasör: `inbox/ draft/ approved/
   in-progress/ done/`.
6. **`sync` çalıştır** — skill ekosistem dizinlerine yansır.

**`.agent-work/` zaten varsa ÜZERİNE YAZMA.** Önceki bir açma-kapama turundan kalmış
olabilir ve içinde planlar durur. Mevcut iskeleti kullan, yalnız **eksik** klasörleri
ekle. `TEMPLATE.md` varsa dokunma.

### Kapatırken — veri korunur, konfigürasyon temizlenir

İki farklı şey var ve **ayrı davranırlar**.

**`.agent-work/` kullanıcı verisidir. Hiçbir şey silinmez.** Önce say, sonra sor:

```
inbox: 2   draft: 1   approved: 3   in-progress: 1   done: 7
```

> "3 onaylı, 1 süren iş artık izlenmeyecek. Dosyalar `.agent-work/` altında duruyor ve
> silinmiyor. Devam edilsin mi?"

Kullanıcı onaylamazsa **hiçbir şey değişmez** — manifest de dahil.

**`work-plan` skill'i konfigürasyondur ve silinir.** Bırakılırsa
`.claude/skills/work-plan/` yerinde kalır ve o skill'in ilk cümlesi *"Bu projede plan
kapısı açıktır"*. Proje kendi durumu hakkında yalan söyler; bir agent kapalı bir kapıyı
işletmeye çalışır.

`sync` bunu tek başına çözmez — ledger stale hedefi **raporlar ama silmez**. Sıra:

1. Kaynağı sil: `.agent-source/skills/work-plan/`
2. `sync` çalıştır
3. `sync`'in `(stale)` diye raporladığı hedefleri sil — tipik olarak
   `.agents/skills/work-plan/`, `.claude/skills/work-plan/`, `.opencode/skills/work-plan/`
   (hangi ekosistemler hedefliyse)
4. Silinenleri kullanıcıya listele

**Manifest'ten `planGate` nesnesini de sil.** `constitution.planGate: false` iken kök
`planGate` nesnesinin varlığı manifest'i **geçersiz** kılar — doğrulayıcı reddeder.

**Bloğu çıkar:** `<!-- c:planGate -->` … `<!-- /c:planGate -->`.

### Sıra önemlidir

Manifest'i **önce** yaz, `sync`'i **sonra** çalıştır. Ters sırada `sync` eski manifest'le
koşar ve sildiğin kaynağı geri üretmez ama stale raporu da vermez — temizlenecek hedefi
göremezsin.
````

- [ ] **Step 2: Doğrulayıcıları çalıştır**

Run:
```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs
```
Expected: dördü de PASS.

- [ ] **Step 3: Manifest kuralının gerçekten var olduğunu doğrula**

Skill, `planGate` nesnesinin kapalıyken silinmesi gerektiğini söylüyor. Doğrulayıcının bunu gerçekten zorladığını teyit et:

```bash
node -e '
import("./team-builder-shared/validate-manifest.mjs").then(m=>{
  const doc={version:1,docLanguage:"tr",targetsDefault:["claude"],
    constitution:{planGate:false},
    agents:[{name:"dev",description:"gelistirici"}],
    routing:[{path:"src/**",role:"dev"}],
    planGate:{planReviewer:null,codeReviewer:null}};
  try{ m.validate(doc); console.log("SORUN: kabul edildi"); }
  catch(e){ console.log("OK reddedildi:", e.message.split("\n")[1]); }
});'
```
Expected: `OK reddedildi: - kök planGate nesnesi var ama constitution.planGate açık değil`

`SORUN: kabul edildi` çıkarsa skill var olmayan bir kurala dayanıyor — dur ve bildir.

- [ ] **Step 4: Commit**

```bash
git add team-builder-upgrade/SKILL.md
git commit -m "feat: add plan gate toggling with the data/config split"
```

---

### Task 6 — Görev 6: Göç

Bugüne kadar kurulmuş her projede `instructions.md` yok ve metin işaretsiz. Göç **sezgisel olamaz** — kendi yazmadığın prose'a otomatik işaret koymak, canonical kaynağı tahminle düzenlemektir.

**Files:**
- Modify: `team-builder-upgrade/SKILL.md`

**Interfaces:**
- Consumes: görev 4'ün blok kuralları, görev 2'nin referans biçimleri.
- Produces: `## Göç` bölümü. Bu, planın son skill değişikliğidir.

- [ ] **Step 1: Bölümü ekle**

`team-builder-upgrade/SKILL.md` içinde `## Referans eksikse` bölümünün **hemen öncesine** ekle:

````markdown
## Göç — eski yapıdaki projeler

`.agent-source/project/instructions.md` yoksa bu proje ortak talimat dosyasından önce
kurulmuş demektir: metin `project/CLAUDE.md` ve `project/AGENTS.md` içinde, işaretsiz.
Preset çeviremezsin — önce göç.

**Göç tek seferliktir ve git ile geri alınabilir.** Kullanıcıya bunu söyle.

### Sıra

1. **Tespit et ve teklif et.**
   > "Bu proje talimatları iki dosyada tutuyor. Tek dosyaya taşıyıp `CLAUDE.md` ve
   > `AGENTS.md`'yi referansa çeviriyorum — böylece preset'leri açıp kapatabilirim.
   > Değişiklikler git'te, geri alınabilir. Devam edeyim mi?"

2. **Diverjansı kontrol et.** `project/CLAUDE.md` ile `project/AGENTS.md` bugün kopya
   olmalı, ama kullanıcı birini elle düzenlemiş olabilir. Karşılaştır:
   - **Aynıysa** → devam.
   - **Farklıysa** → **DUR.** Farkı göster ve sor: "Bu iki dosya ayrışmış. Hangisi
     ortak metin olsun?" Sessizce birini kazandırma — kullanıcının yazdığı metni
     kaybetmek demektir.

3. **`instructions.md`'yi oluştur.** Seçilen dosyanın içeriğini al. Ekosisteme özgü
   olduğunu bildiğin bölümleri **çıkar** — bugün bu yalnız Claude'un `topology: native`
   durumundaki "Takımı başlatma" bölümüdür; onu bir kenara koy, 5. adımda geri
   yazacaksın.

4. **İşaretleri blok blok onaylat.** Her preset için, manifest'te **açık** olanları sırayla:
   > "`noWorkaround` metnin burada başlıyor gibi görünüyor:
   > *<ilk iki satır>* … *<son satır>*
   > İşaretleri buraya koyuyorum — doğru mu?"

   - Onaylarsa işaretleri koy.
   - **Ayırt edemezsen ya da kullanıcı hayır derse: işaretsiz bırak ve açıkça söyle.**
     > "`codeDocSync` bloğunu ayırt edemedim; o preset'i çevirmek istersen önce
     > işaretleri elle koyman gerekiyor."

   **Yarım göç, yanlış göçten iyidir.** Tahminle işaret koyma.

5. **Hedef kaynaklarını yeniden yaz.**
   - `project/CLAUDE.md` → `@.agent-source/project/instructions.md` + (varsa) 3. adımda
     kenara koyduğun native topoloji bölümü
   - `project/AGENTS.md` → `Bütün proje kuralları @.agent-source/project/instructions.md
     dosyasındadır. Önce onu oku.`
   - `project/opencode.json` → `instructions` dizisinin **başına**
     `.agent-source/project/instructions.md` ekle

   Yalnız hedeflenen ekosistemlerin dosyalarıyla ilgilen. Tek ekosistemli bir projede
   (ör. yalnız OpenCode) `CLAUDE.md` zaten yoktur.

6. **`sync` çalıştır** ve sonucu raporla: hangi bloklar işaretlendi, hangileri
   işaretsiz kaldı, hangi dosyalar referansa döndü.

### `instructions.md` var ama işaretsiz

Bu da göç sayılır — yalnız 4. adım çalışır. 2., 3. ve 5. adımlar atlanır.
````

- [ ] **Step 2: Doğrulayıcıları çalıştır**

Run:
```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs
```
Expected: üçü de PASS.

- [ ] **Step 3: Skill'in bütün bölümlerinin yerinde olduğunu doğrula**

Run:
```bash
grep -n '^## ' team-builder-upgrade/SKILL.md
```
Expected: şu başlıklar bulunmalı — `Beş preset, üç sınıf`, `Ortak akış`, `İşaretli bloklar`, `Projeye özel cevap isteyen preset'ler`, `Zaten açık/kapalı olan`, `Plan kapısı (planGate)`, `Göç — eski yapıdaki projeler`, `Referans eksikse`.

Eksik varsa bir görev atlanmış.

- [ ] **Step 4: Commit**

```bash
git add team-builder-upgrade/SKILL.md
git commit -m "feat: add assisted migration for pre-instructions.md projects"
```

---

### Task 7 — Görev 7: Doküman kapanışları

**Files:**
- Modify: `team-builder-shared/templates/work-plan-skill.md`
- Modify: `docs/superpowers/specs/2026-08-02-plan-gate-design.md`

**Interfaces:**
- Consumes: yok.
- Produces: doküman; kod yok.

- [ ] **Step 1: `--disallowedTools` tuzağını not et**

`team-builder-shared/templates/work-plan-skill.md` içinde komut tablosunun altındaki **Prompt stdin'den gider** maddesini bul ve sonuna ekle:

```markdown
     **`--disallowedTools` variadic bir bayraktır** — arkasına prompt'u argüman olarak
     koyarsan onu da tool adı sanıp yutar (`Permission deny rule "..." matches no known
     tool`) ve izin listesi sessizce bozulur. Prompt'u yukarıdaki gibi dosyadan
     yönlendirdiğin sürece sorun yok; bayrağın arkasına hiçbir şey ekleme.
```

- [ ] **Step 2: Çekirdek spec'te KARAR 20'yi kapat**

`docs/superpowers/specs/2026-08-02-plan-gate-design.md` içinde KARAR 20 satırını bul:

```markdown
| 20 | Preset açma/kapama proje-yükseltme skill'ine ait | `sync` yeni kaynak yaratmıyor |
```

Kararlar tablosunun **altına** (KARAR 21'in kapanış notunun yanına) ekle:

```markdown
> **Kapandı (2026-08-19).** Proje-yükseltme skill'i tasarlandı ve uygulandı:
> `docs/superpowers/specs/2026-08-19-preset-upgrade-design.md`. O spec ortak talimat
> metnini `.agent-source/project/instructions.md`'ye taşır ve beş preset'i işaretli
> bloklarla çevrilebilir kılar; `sync`'in "yeni kaynak yaratmaz" kuralı **korunur** —
> yeni kaynağı yükseltme skill'i yaratır.
```

- [ ] **Step 3: Kapsam tablosunda E'yi güncelle**

Aynı dosyada:

```markdown
| **E** | Preset'i kurulum sonrası açma/kapama | Proje-yükseltme skill'i |
```

→

```markdown
| **E** | Preset'i kurulum sonrası açma/kapama | **Uygulandı** — `2026-08-19-preset-upgrade-design.md` |
```

- [ ] **Step 4: Doğrulayıcıları çalıştır**

Run:
```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs
```
Expected: dördü de PASS.

- [ ] **Step 5: Commit**

```bash
git add team-builder-shared/templates/work-plan-skill.md docs/superpowers/specs/2026-08-02-plan-gate-design.md
git commit -m "docs: note the variadic flag trap and close KARAR 20"
```

---

### Task 8 — Görev 8: Uçtan uca elle prova

Doğrulayıcılar kuralların **belgelendiğini** kanıtlar, **işlediğini** değil. Kapsam B'de iki prova turu, otomatik testlerin bulamayacağı sekiz boşluk buldu — biri geri dönüşü olmayan arşive bayat onayla taşımaya izin veren düşmüş bir olumsuzluk ekiydi.

**Files:**
- Değişiklik yok; bulgu çıkarsa ilgili göreve dönülür.

**Interfaces:**
- Consumes: görev 1–7'nin tamamı.
- Produces: bulgu listesi ya da temiz sonuç.

- [ ] **Step 1: Yükseltme skill'ini taze bir okuyucu gibi oku**

Run: `cat team-builder-upgrade/SKILL.md`

Şu soruları sorarak oku — her biri için dosyada **açık** bir cevap ara. "Çıkarabilirim" bir başarısızlıktır, çünkü çalışma zamanındaki agent farklı bir çıkarım yapabilir:

1. Manifest hangi dosyada? Tam yol yazılı mı?
2. `planGate`'i açıyorum, denetleyici olarak kod yazan bir rol seçildi. Ne yaparım?
3. `planGate`'i kapatıyorum. Tam olarak hangi dosyaları siliyorum, hangilerini bırakıyorum? Sıra ne?
4. `sync` bana `(stale)` diye bir şey raporladı. Hangilerini sileceğimi nereden biliyorum?
5. Göçte iki dosya ayrışmış. Ne yaparım — ve kullanıcı seçmezse?
6. Bir bloğu ayırt edemedim. Devam eder miyim, dururum mu?
7. Kullanıcı kapatmayı onaylamadı. Manifest'e dokundum mu?

- [ ] **Step 2: Şablon ile skill'in aynı işaretleri söylediğini doğrula**

Run:
```bash
echo "--- sablon ---"; grep -o 'c:[a-zA-Z]*' team-builder-shared/templates/constitution-blocks.md | sort -u
echo "--- skill ---";  grep -o 'c:[a-zA-Z]*' team-builder-upgrade/SKILL.md | sort -u
echo "--- constitution.md ---"; grep -o 'c:[a-zA-Z]*' team-builder-shared/constitution.md | sort -u
```
Expected: üç liste de **aynı** beş adı içermeli. Biri eksikse o dosya geride kalmış.

- [ ] **Step 3: Kapatma sırasını kâğıt üzerinde işlet**

Şu durumu kur: `planGate` açık, `.agent-work/approved/` içinde 3 dosya, hedefler `claude` ve `codex`.

Skill'i izleyerek kapatmayı adım adım yaz. Sonunda şunları **skill'den okuyarak** cevaplayabilmelisin:
- Kullanıcıya gösterilen sayım nedir?
- Manifest'te ne değişti? (iki şey olmalı)
- Hangi dosyalar silindi? (kaynak + hedefler)
- `.agent-work/approved/` içindeki 3 dosyaya ne oldu? (**hiçbir şey**)

Cevaplardan biri skill'den çıkarılamıyorsa görev 5'e dön.

- [ ] **Step 4: Spec kapsamını tara**

Run: `grep -n '^| E-' docs/superpowers/specs/2026-08-19-preset-upgrade-design.md`

Her kabul kriteri için, onu karşılayan bir skill bölümü ya da doğrulayıcı kuralı gösterebilmelisin. Gösteremediğin varsa bildir.

- [ ] **Step 5: Bulguları raporla**

Bulgu çıkmadıysa sonraki adıma geç. Çıktıysa hangi göreve ait olduğunu yaz, o görevin adımlarını tekrarla, sonra bu görevi baştan çalıştır.

- [ ] **Step 6: Tam doğrulama**

Run:
```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs && git status --short
```
Expected: dört doğrulayıcı da PASS, `git status` **temiz**.

- [ ] **Step 7: Spec durumunu güncelle ve commit**

`docs/superpowers/specs/2026-08-19-preset-upgrade-design.md` başlığında:

```markdown
- **Durum:** Tasarlandı — kullanıcı onayı ve uygulama planı bekliyor
```

→

```markdown
- **Durum:** Uygulandı — `docs/superpowers/plans/2026-08-19-preset-upgrade.md`
```

```bash
git add docs/superpowers/specs/2026-08-19-preset-upgrade-design.md
git commit -m "docs: mark the scope E spec as implemented"
```

---

## Spec kapsam kontrolü

| Spec bölümü | Görev |
|---|---|
| E1 — tek talimat kaynağı | 2 (harita + uyarı), 3 (setup üretir) |
| E1 — referans kaybı denetimi | 2 |
| E2 — anayasa blokları işaretlenmesi | 1 (şablon), 4 (skill kuralları) |
| E2 — blok metni şablondan render | 1, 4 |
| E3 — türetilen preset'ler | 4 |
| E3 — metin preset'leri + projeye özel sorular | 4 |
| E3 — `planGate` açma | 5 |
| E3 — `planGate` kapatma, veri/konfigürasyon ayrımı | 5 |
| E4 — göç, diverjans, blok blok onay | 6 |
| Doğrulayıcı değişikliği — referans uyarısı | 2 |
| Doğrulayıcı değişikliği — işaret denetimi | 8 (Step 2, elle tarama) |
| Yan bulgu — `--disallowedTools` tuzağı | 7 |
| KARAR 20 kapanışı | 7 |
| Kabul kriterleri E-R1…E-R11, E-N1…E-N10 | 4, 5, 6 (davranış); 8 (prova) |

**Kapsam dışı olduğu için görevi yok:** rol/routing/ekosistem değiştirme, kurulumdan sonra ekosistem ekleme, `instructions.md` içeriğinin otomatik yeniden üretimi, göçün geri alınması.

**Not — işaret denetimi neden otomatik test değil:** `instructions.md` bir **proje** dosyasıdır, bu repoda örneği yok; `validate-plan-gate.mjs` bu reponun kendi şablonlarını denetliyor. Projedeki işaretleri denetlemek, projeye kurulan bir doğrulayıcı gerektirir — ayrı iş. Bu planda işaret tutarlılığı görev 8'in elle taramasıyla kapsanıyor ve bu sınır burada açıkça yazılıdır.

**Not — davranışsal kriterler neden otomatik test değil:** yükseltme bir skill'dir, yani çalışma zamanı bir agent'tır. Bu repoda çalıştırılabilir tek şey generator ve doğrulayıcılardır; onlar kuralın **belgelendiğini** zorlar. Kriterlerin kendisi görev 8'in provasında yürütülür.
