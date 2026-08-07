# Plan Kapısı — Runtime Artefaktları (Plan 1/2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan kapısının çalışma zamanı artefaktlarını üretmek — kurulum sözleşmesi (`plan-gate.md`), plan şablonu ve projeye kurulacak `work-plan` skill'inin şablonu.

**Architecture:** Üç referans/şablon dosyası + bir yapısal doğrulayıcı. `plan-gate.md` sihirbazın okuduğu kurulum sözleşmesi ve veri modelidir; `templates/plan.md` ve `templates/work-plan-skill.md` projeye üretilecek dosyaların Türkçe referanslarıdır. Dosyalar arasındaki tutarlılık (makine işaretleri, alan adları) `validate-plan-gate.mjs` ile makine tarafından denetlenir.

**Tech Stack:** Node.js ≥18 (harici bağımlılık yok), Markdown, repo'nun kendi `--selftest` deseni.

## Global Constraints

- **Doküman dili Türkçe.** Kod, dosya adı ve commit mesajı İngilizce. Kaynak kodu yorumları İngilizce.
- **Harici bağımlılık eklenmez.** Yalnız Node stdlib.
- **`team-builder-shared/` altında hiçbir dosya `SKILL.md` adını taşıyamaz.** Repo `~/.claude/skills/team-builder-shared/` altına kurulur ve o ağaçtaki her derinlikteki `SKILL.md` global skill olarak taranır (OpenCode glob'u: `skills/**/SKILL.md`). Skill şablonunun adı `templates/work-plan-skill.md`'dir.
- **Makine işaretleri çeviriden bağımsızdır.** Kurallar bölüm başlıklarına değil, şu beş HTML yorumuna bakar: `<!-- s:what -->`, `<!-- s:how -->`, `<!-- s:questions -->`, `<!-- s:review-notes -->`, `<!-- s:progress -->`. Sentinel: `<!-- progress:not-started -->`. İptal etiketi: `<!-- note:cancelled -->`.
- **`.agent-work/` generated değildir.** `sync` onu üretmez, drift kontrolüne sokmaz.
- **Bu plan hiçbir `.mjs` generator davranışını değiştirmez.** `sync-agent-config.mjs` ve `validate-manifest.mjs` bu planda **değişmez** — onlar Plan 2'nin konusudur.
- **Spec:** `docs/superpowers/specs/2026-08-02-plan-gate-design.md` — çelişki olursa spec geçerlidir.

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `team-builder-shared/plan-gate.md` | Sihirbazın okuduğu kurulum sözleşmesi + veri modeli. Runtime adımlarını **anlatmaz**. |
| `team-builder-shared/templates/plan.md` | Plan dosyası şablonu (Türkçe referans; sihirbaz `docLanguage`'de üretir) |
| `team-builder-shared/templates/work-plan-skill.md` | Projeye `.agent-source/skills/work-plan/SKILL.md` olarak yazılacak skill'in şablonu; runtime prosedürünün **tek otoritesi** |
| `team-builder-shared/validate-plan-gate.mjs` | Üç dosyanın yapısal tutarlılığını denetleyen doğrulayıcı (`--selftest`) |

---

### Task 1: Yapısal doğrulayıcı

Şablonların ve sözleşmenin tutarlılığını makine tarafından denetler. Doğrulayıcı **önce** yazılır; Task 2, 3 ve 4 onu yeşil tutmak zorundadır.

> **Neden kod ve selftest aynı adımda.** Bu task'ın çıktısı bir doğrulayıcıdır; `--selftest`
> onun kendi testidir ve fixture'ları doğrulayıcının sabitlerine (`SECTION_MARKERS`,
> `PROGRESS_SENTINEL`) dayanır. İkisini ayrı adımlara bölmek testi tanımsız sabitlere
> bağlardı. Kırmızı-yeşil döngüsü Step 2–3'te yaşanır: selftest yeşil, gerçek repo kırmızı
> (dosyalar henüz yok) — ve sonraki üç task onu yeşile çevirir.

**Files:**
- Create: `team-builder-shared/validate-plan-gate.mjs`

**Interfaces:**
- Consumes: yok (ilk task)
- Produces: `validatePlanGateArtifacts(rootDir)` — hata dizisi döner (boş dizi = geçerli). `node team-builder-shared/validate-plan-gate.mjs --selftest` → `SELFTEST PASS`

- [x] **Step 1: Doğrulayıcıyı yaz** — `team-builder-shared/validate-plan-gate.mjs`

Kod artık repoda; kopyası buraya **konmaz** — aynı kodu iki yerde tutmak drift üretir.
Dosyanın dışa verdikleri sonraki task'ların sözleşmesidir:

| Export | Ne için |
|---|---|
| `SECTION_MARKERS` | Beş bölüm işareti, kanonik sırayla |
| `PROGRESS_SENTINEL` | `<!-- progress:not-started -->` |
| `CANCEL_NOTE_TAG` | `<!-- note:cancelled -->` |
| `PLAN_FIELDS` | Plan frontmatter anahtarları |
| `INBOX_FIELDS` | Inbox kapalı anahtar listesi — runtime doğrulayıcısı için; bu dosya kullanmaz |
| `frontmatter(text)` | Frontmatter bloğunu ayırır; alan kontrolleri gövdeye bakmaz |
| `validatePlanGateArtifacts(rootDir)` | Hata dizisi döner, boş dizi = geçerli |

Doğrulanan kurallar: beş işaret şablonda **tam bir kez** ve sırayla var; sentinel var;
plan frontmatter alanları **frontmatter bloğunun içinde** (gövdedeki bir `revision:`
satırı saymaz); skill şablonu `name: work-plan` ve boş olmayan `description` taşıyor;
sözleşme her işareti **yorum biçiminde** (`<!-- s:what -->`) belgeliyor;
`team-builder-shared/` altında — symlink'lerin arkası dahil — `SKILL.md` adında dosya yok.

> **Codex denetimi sonrası düzeltmeler (8 bulgu).** İlk sürüm `^alan:` regex'ini tüm
> dosyaya uyguluyordu, işaret sırasını yalnız ilk oluşuma bakarak ölçüyordu, sözleşme
> kontrolünü çıplak `includes('id')` ile yapıyordu (rastgele düzyazı geçiyordu), tüm
> dosya sistemi hatalarını yutuyordu, symlink dizinleri gezmiyordu ve selftest kuralların
> çoğunu savunmuyordu — kontroller silinse bile yeşil kalıyordu. Selftest artık her kural
> için negatif vaka içeriyor; mutasyon testiyle doğrulandı (7/7 mutant öldü).

- [x] **Step 2: Selftest'i çalıştır, geçtiğini gör**

```bash
node team-builder-shared/validate-plan-gate.mjs --selftest
```

Beklenen: `SELFTEST PASS`

- [x] **Step 3: Gerçek repoya karşı çalıştır, fail ettiğini gör**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: exit 1 ve şu üç satır (dosyalar henüz yok — Task 2, 3, 4 onları yazacak):

```
Plan gate artifacts invalid:
- team-builder-shared/plan-gate.md missing
- team-builder-shared/templates/plan.md missing
- team-builder-shared/templates/work-plan-skill.md missing
```

- [x] **Step 4: Commit**

```bash
git add team-builder-shared/validate-plan-gate.mjs
git commit -m "feat: add structural validator for plan gate artifacts"
```

---

### Task 2: Plan şablonu

Projeye `.agent-work/TEMPLATE.md` olarak kopyalanacak (sihirbaz `docLanguage`'de üretir) şablon.

**Files:**
- Create: `team-builder-shared/templates/plan.md`

**Interfaces:**
- Consumes: Task 1'in `SECTION_MARKERS`, `PROGRESS_SENTINEL`, `PLAN_FIELDS` sabitleri
- Produces: `templates/plan.md` — Task 3 (skill şablonu) bu bölümlere atıf yapar

- [x] **Step 1: Şablonu yaz**

Şablon repoda: `team-builder-shared/templates/plan.md`. Kopyası buraya **konmaz**.

Frontmatter: `id`, `title`, `revision`, `created`, `source`, `domain`, `paths`,
`executor`, `reviews` (`plan-review` ve `code-review` boş dizileri). Gövde: beş `s:*`
işareti sırayla, `s:progress` `<!-- progress:not-started -->` sentinel'iyle.

> **Şablonun iki kuralı.** (1) Beş `s:*` işareti **her zaman** bulunur — bölüm boş olsa
> bile. Kurallar başlıklara değil bu işaretlere bakar, çünkü başlıklar `docLanguage`'e
> çevrilir. (2) Sentinel yalnız **hiç başlanmamış** planı işaretler; `in-progress/`'ten
> `draft/`'a geri dönen planın ilerlemesi korunur, sentinel geri konmaz.

- [x] **Step 2: Doğrulayıcıyı çalıştır**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: `templates/plan.md` ile ilgili hata **kalmamalı**. Kalan hatalar yalnız:

```
- team-builder-shared/plan-gate.md missing
- team-builder-shared/templates/work-plan-skill.md missing
```

- [x] **Step 3: Commit**

```bash
git add team-builder-shared/templates/plan.md
git commit -m "feat: add the work plan template"
```

---

### Task 3: `work-plan` skill şablonu

Projeye `.agent-source/skills/work-plan/SKILL.md` olarak yazılacak skill. **Runtime prosedürünün tek otoritesidir** — `plan-gate.md` adımları tekrar etmez.

**Files:**
- Create: `team-builder-shared/templates/work-plan-skill.md`

**Interfaces:**
- Consumes: Task 2'nin bölüm işaretleri
- Produces: runtime prosedürü — Task 4 (`plan-gate.md`) buna yönlendirir, tekrarlamaz

- [x] **Step 1: Skill şablonunu yaz**

> Bu dosya **şablondur**. Sihirbaz onu projeye `.agent-source/skills/work-plan/SKILL.md`
> olarak, projenin `docLanguage` dilinde yazar. Repo içinde `SKILL.md` adını **taşımaz**.

Skill repoda: `team-builder-shared/templates/work-plan-skill.md`. Kopyası buraya
**konmaz** — üç denetim turunda önemli ölçüde değişti, buradaki bir kopya bayatlar.

Skill projeye giden **tek** plan kapısı belgesidir (`plan-gate.md` kopyalanmaz), o yüzden
veri modelini de taşır. Bölümleri: mod seçimi, ekosistem çözümlemesi, ortak kurallar
(revizyon sonuçları, `id`/dosya adı, denetim kaydı şeması, `planReviewPassed`, `executor`
geçerliliği, klasör değişmezleri), plan yazma, havuz, işi bitirme, kapı sahibi değişimi,
iptal, inbox, kapı kapalıysa, yaygın hatalar.

- [x] **Step 2: Doğrulayıcıyı çalıştır**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: yalnız `plan-gate.md missing` hatası kalmalı.

- [x] **Step 3: Şablonun `SKILL.md` adını taşımadığını doğrula**

```bash
find team-builder-shared -name 'SKILL.md'
```

Beklenen: **boş çıktı.**

- [x] **Step 4: Commit**

```bash
git add team-builder-shared/templates/work-plan-skill.md
git commit -m "feat: add the work-plan skill template"
```

---

### Task 4: Kurulum sözleşmesi

Sihirbazın okuduğu referans: hangi dosyalar üretilir, veri modeli nedir, kabul senaryoları nelerdir. **Runtime adımlarını anlatmaz** — onlar skill'dedir.

**Files:**
- Create: `team-builder-shared/plan-gate.md`

**Interfaces:**
- Consumes: Task 2 ve 3'ün şablonları
- Produces: kurulum sözleşmesi — Plan 2'deki sihirbaz entegrasyonu buna dayanır

- [x] **Step 1: Sözleşmeyi yaz**

Sözleşme repoda: `team-builder-shared/plan-gate.md`. Kopyası buraya **konmaz**.

İçeriği: üretilen dosyalar, makine işaretleri, veri modeli (inbox kaydı, plan alanları,
denetim kaydı), iki kapı yüklemi, klasör değişmezleri, kurulum sırasında doğrulananlar,
kabul senaryolarına atıf, artefakt doğrulaması ve architect'siz takım kuralı.

**Runtime prosedürünü anlatmaz.** Sentinel'in ne zaman silindiği, kod denetiminin ne zaman
çalıştığı, sahip değişiminin dosyaları nasıl taşıdığı — hepsi skill'e aittir; sözleşme
yalnız bunların skill'de olduğunu söyler.

- [x] **Step 2: Doğrulayıcının tamamen yeşil olduğunu gör**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: `Plan gate artifacts are valid.` ve exit 0.

- [x] **Step 3: Selftest'lerin bozulmadığını doğrula**

```bash
node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: üç kez `SELFTEST PASS`.

- [x] **Step 4: Commit**

```bash
git add team-builder-shared/plan-gate.md
git commit -m "feat: add the plan gate setup contract"
```

---

## Uygulama sonrası doğrulama

- [x] **Artefakt doğrulayıcısı yeşil**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: `Plan gate artifacts are valid.`

- [x] **Üç selftest de geçiyor**

```bash
node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/sync-agent-config.mjs --selftest
```

- [x] **Kurulum tuzağı yok**

```bash
find team-builder-shared -name 'SKILL.md'
```

Beklenen: boş çıktı.

- [x] **Kurulum hâlâ çalışıyor ve şablon global skill olmuyor**

```bash
rm -rf /tmp/tb-pg && mkdir -p /tmp/tb-pg && HOME=/tmp/tb-pg ./install.sh opencode >/dev/null && find /tmp/tb-pg -name 'SKILL.md' | sed 's|.*/skills/||' | sort
```

Beklenen tam olarak üç satır: `architecture-advisor/SKILL.md`, `team-builder-setup/SKILL.md`, `team-builder-sync/SKILL.md`. `work-plan` **görünmemeli**.

- [ ] **Skill şablonu R/N senaryolarını karşılıyor (elle okuma)**

Spec'teki R1–R41 ve N1–N25 listesini `templates/work-plan-skill.md` ile karşılaştır: her
senaryonun beklediği davranış skill metninde tarif edilmiş mi? Skill kurulup gerçek bir
projede çalıştırılmadan tam kabul yapılamaz (o Plan 2 sonrasıdır); bu adım yalnız
**metinsel kapsama** kontrolüdür — tarif edilmeyen bir davranış varsa skill eksiktir.

- [x] **Generator davranışı değişmedi**

```bash
git diff --stat main -- team-builder-shared/sync-agent-config.mjs team-builder-shared/validate-manifest.mjs
```

Beklenen: boş çıktı — bu plan o iki dosyaya dokunmaz.

## Kapsam dışı (Plan 2)

Bu plan yalnız artefaktları üretir. Şunlar **ikinci plana** aittir:

- `manifest-schema.md` + `validate-manifest.mjs`: `constitution.planGate`, kök `planGate`
  nesnesi, ad tekilliği/biçimi, erişilebilirlik — V1–V16 senaryoları
- `constitution.md` KARAR 5 ve "default her zaman true" düzeltmesi
- `team-builder-setup/SKILL.md`: 5. toggle, iki kapı sahibi sorusu, Adım 8a üretimi
- `wizard-state.md`: `answers.planGate`
- `agent-md-rich.md`: `## Plan Kapısı` bölümü ve architect'siz koşullandırma
- `routing.md`, `governance-defaults.md`: `codeReviewer`'dan üretim, architect'siz koşul
- `canonical-source.md`, `sync-pipeline.md`: `.agent-work/` notu
- `README.md` (iki dil): "all on by default" düzeltmesi
- S1–S2, W1–W6 senaryoları
