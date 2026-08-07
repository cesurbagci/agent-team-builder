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

- [ ] **Step 1: Şablonu yaz**

`team-builder-shared/templates/plan.md`:

````markdown
---
id: <YYYYMMDD-nn>
title: <tek cümlelik iş başlığı>
revision: 1
created: <YYYY-MM-DD>
source: <user | agent:<agent-adı>>
domain: <backend | frontend | ...>
paths: [<etkilenen kod yolları>]
executor: <ekosistem>/<agent-adı>
reviews:
  plan-review: []
  code-review: []
---

<!-- s:what -->
## Ne ve neden

<Sade dille, teknik terim kullanmadan. Somut örnek ver.>

**Kabul kriteri:** <Bu iş bittiğinde neyin doğru çalışıyor olacağı — ölçülebilir yaz.>

<!-- s:how -->
## Nasıl

**Yaklaşım:** <adımlar>

**Etkilenen bileşenler:** <dosya/dizin listesi — `paths` ile tutarlı olmalı>

**Riskler:** <varsa>

<!-- s:questions -->
## Açık sorular

<Yoksa "yok" yaz — boş bırakma. Buradaki her soru kapı 1'de cevaplanmış olmalı.>

<!-- s:review-notes -->
## Denetim notları

<Kapı red gerekçeleri, kullanıcı geri bildirimi ve iptal gerekçesi buraya yazılır.
Bu bölüm `revision` artırmaz.>

<!-- s:progress -->
## İlerleme

<!-- progress:not-started -->
````

> **Şablonun iki kuralı.** (1) Beş `s:*` işareti **her zaman** bulunur — bölüm boş olsa
> bile. Kurallar başlıklara değil bu işaretlere bakar, çünkü başlıklar `docLanguage`'e
> çevrilir. (2) `s:progress` `draft/`'ta `<!-- progress:not-started -->` sentinel'iyle
> durur; `in-progress/`'e geçince sentinel silinip ilerleme yazılır.

- [ ] **Step 2: Doğrulayıcıyı çalıştır**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: `templates/plan.md` ile ilgili hata **kalmamalı**. Kalan hatalar yalnız:

```
- team-builder-shared/plan-gate.md missing
- team-builder-shared/templates/work-plan-skill.md missing
```

- [ ] **Step 3: Commit**

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

- [ ] **Step 1: Skill şablonunu yaz**

`team-builder-shared/templates/work-plan-skill.md`:

> Bu dosya **şablondur**. Sihirbaz onu projeye `.agent-source/skills/work-plan/SKILL.md`
> olarak, projenin `docLanguage` dilinde yazar. Repo içinde `SKILL.md` adını **taşımaz**.

````markdown
---
name: work-plan
description: Bu projede plan kapısı açık. Bir iş için plan yazar, denetletir, kullanıcıya onaylatır; onaylanan işlerin havuzunu yönetir ve seçilenleri işletir. Tetikleyiciler — "bunun planını çıkar", "onaylı işleri göster", "şu işi yapalım", "havuzda ne var", "şunu not et".
---

# work-plan

Bu projede **plan kapısı** açıktır: kod yazılmadan önce plan yazılır, denetlenir ve
**kullanıcı onaylar**. Onaysız kod yazılmaz.

## Önce: hangi mod?

| Kullanıcı ne diyor | Mod |
|---|---|
| Yeni bir iş tarif ediyor | **Plan yaz** |
| "Havuzda ne var", "şu işi yapalım" | **Havuz** |
| "Şunu not et", "sonra bakarız" | **Inbox** |
| "Plansız yap" | Kapı atlanır; hiçbir dosya oluşturulmaz, `.agent-work/`'e yazılmaz |

## Ortak kurallar

- **`.agent-work/` altına yalnız sen yazarsın.** Denetleyiciler dosya değiştirmez; sana
  sonuç döndürür, kaydı sen yazarsın.
- **Bölümler işaretle bulunur.** `<!-- s:what -->`, `<!-- s:how -->`,
  `<!-- s:questions -->`, `<!-- s:review-notes -->`, `<!-- s:progress -->`. Başlık
  metinleri projenin diline çevrilidir; **asla başlığa göre arama yapma.**
- **`revision`** yalnız planlama içeriği değişince artar: `title`, `domain`, `paths`,
  `executor` ve `s:what` / `s:how` / `s:questions` bölümleri. `s:review-notes`,
  `s:progress`, `reviews` ve `adr` **artırmaz**.
- **`id`** `<YYYYMMDD>-<n{2,}>` biçimindedir (en az iki hane; 99'dan sonra üç hane),
  değişmez; dosya adı `<id>-<slug>.md`, `<slug>` `title`'dan türetilir ve
  `^[a-z0-9]+(?:-[a-z0-9]+)*$` kuralına uyar. Yeni id verirken `.agent-work/` altındaki
  **tüm** klasörleri tara ve o güne ait en büyük sırayı bir artır.

## Plan yaz

1. **Sahibini bul.** İşin dokunacağı kod yollarına bak; projenin routing tablosundan o
   yolun sahibi developer'ı belirle. `executor` odur, `<ekosistem>/<ad>` biçiminde.
   Ekosistem **bu oturumun ekosistemidir**.
2. **`.agent-work/TEMPLATE.md`'yi kopyala** → `.agent-work/draft/<id>-<slug>.md`.
   `revision: 1`, `reviews` boş diziler, `s:progress` sentinel'li.
3. **Gövdeyi doldur.** `s:what` sade dille ve örnekle, ölçülebilir kabul kriteriyle;
   `s:how` yaklaşım ve etkilenen bileşenler (`paths` ile tutarlı); `s:questions` boş
   bırakılmaz.
4. **Kapı 1 — plan denetimi.** Projenin plan denetleyicisi tanımlıysa onu çağır.
   Denetleyici sana şunu döndürür:
   ```
   verdict: approved | rejected
   reviewed_revision: <denetlediği revision>
   reasons: [ ... ]
   ```
   - `reviewed_revision` diskteki `revision` ile aynı değilse **kaydı yazma** — plan
     denetim sırasında değişmiş demektir, denetimi tekrarla.
   - Kaydı `reviews.plan-review`'a ekle: `{ by, at, revision, verdict, reasons }`.
     `rejected` ise `reasons` boş olamaz ve gerekçeyi `s:review-notes`'a da yaz.
   - Denetleyici tanımlı değilse `{ by: system, verdict: skipped, reasons: [] }` kaydı
     düş ve devam et.
5. **Kapı 2 — kullanıcı onayı.** Planı **sade dille, örnekle** anlat. Alan adı
   (`gates`, `executor`, `paths`) ya da ham YAML **gösterme**. "Böyle ilerleyelim mi?"
   diye sor.
   - Onaylarsa dosyayı `.agent-work/approved/`'a taşı.
   - Değişiklik isterse `draft/`'ta bırak, geri bildirimi `s:review-notes`'a yaz;
     düzeltme `revision`'ı artırır ve kapı 1'i geçersiz kılar.

**Kod yazma:** onaylanmamış bir planın işini yapma. Kullanıcı açıkça "plansız yap" derse
o iş için kural atlanır.

## Havuz

- **"Havuzda ne var"** → `.agent-work/approved/` içindekileri listele. Her biri için
  başlık ve tek cümle özet ver; dosya adı ve alan adı dökme.
- **"Şunu yapalım" / "şu ikisini yapalım"** → kullanıcı seçer. **Sıra dayatma** — havuz
  FIFO değildir.
- Seçilen dosyayı `.agent-work/in-progress/`'e taşı, `s:progress` sentinel'ini sil ve
  ilerleme yazmaya başla: son durum, sıradaki adım, engel, dokunulan yerler.
- İşi her bıraktığında `s:progress`'i güncelle — başka bir oturum oradan devam edecek.

## İşi bitirme

1. **Kapı 3 — kod denetimi.** Projenin kod denetleyicisi tanımlıysa çağır; sonucu
   `reviews.code-review`'a kaydet. Tanımlı değilse `skipped` kaydı düş.
2. Onaylandıysa dosyayı `.agent-work/done/`'a taşı.
3. **Kod denetimi onayı tek seferliktir.** İş `done/`'a gitmeden kesilirse, devam
   edildiğinde denetimi **yeniden** çalıştır — eski kayıt geçmiştir, yetki vermez.
4. Kalıcı bir mimari karar çıktıysa mimarlık rolüne ADR yazdır ve `adr:` alanına bağla.

## İptal

Herhangi bir klasördeki iş iptal edilebilir: `outcome: cancelled` yaz, `s:review-notes`'a
**yeni** bir `<!-- note:cancelled -->` kaydı ekle (gerekçesiyle) ve dosyayı `done/`'a taşı.
**Kod denetimi çalıştırma** — yarıda bırakılan işi iptal etmek için kodunu onaylatmak
anlamsızdır. `inbox/` kaydı iptal edilirse `done/`'a taşınmaz, **silinir**.

## Inbox

Kullanıcı ya da bir agent alakasız bir bulgu veya sonraya bırakılacak bir fikir
söylediğinde `.agent-work/inbox/<id>-<slug>.md` aç:

```yaml
---
id: <YYYYMMDD-nn>
title: <tek cümle>
created: <YYYY-MM-DD>
source: <user | agent:<ad>>
---
```

Gövde iki-üç cümle. **Başka alan ekleme** — inbox anahtar listesi kapalıdır. Analiz etme,
plan yazma; amaç kaybolmamasıdır. Kullanıcı "şunu ele alalım" dediğinde kayıt analiz
edilip `draft/`'a plan olarak taşınır; `id`, `created` ve `source` **korunur**.

## Plan kapısı kapalıysa

Manifest'te plan kapısı kapatılmışsa şunu söyle: **"Bu projede plan kapısı kapalı. Açmak
kurulum sonrası bir işlemdir ve proje-yükseltme skill'i gerektirir."** Var olmayan bir
komuta yönlendirme.

`.agent-work/` hiç yoksa iskeleti kurmayı teklif et.

## Yaygın hatalar

- Kullanıcıya ham YAML ya da alan adı göstermek — kapı 2 sade dille anlatılır.
- Bölümleri **başlığa** göre aramak — başlıklar çevrilidir, işaretlere bak.
- Onaysız kod yazmak — kaçış yalnız kullanıcının açık talebiyledir.
- `s:progress` güncellerken `revision` artırmak — ilerleme planlama içeriği değildir.
- Havuza sıra dayatmak — kullanıcı seçer.
- Reddedilen kaydı silmek — kayıtlar birikir, sonraki kayıt öncekini geçersiz kılar.
- İptal ederken eski bir notu gerekçe saymak — **yeni** ve etiketli kayıt gerekir.
````

- [ ] **Step 2: Doğrulayıcıyı çalıştır**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: yalnız `plan-gate.md missing` hatası kalmalı.

- [ ] **Step 3: Şablonun `SKILL.md` adını taşımadığını doğrula**

```bash
find team-builder-shared -name 'SKILL.md'
```

Beklenen: **boş çıktı.**

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Sözleşmeyi yaz**

`team-builder-shared/plan-gate.md`:

````markdown
# plan-gate.md — Plan Kapısı Kurulum Sözleşmesi

> Paylaşılan referans. Anayasa KARAR 5 (`planGate`) açıkken geçerlidir.
> **Bu dosya kurulum sözleşmesidir:** hangi dosyalar üretilir, veri modeli nedir, neler
> doğrulanır. **Runtime prosedürünü anlatmaz** — o, projeye kurulan `work-plan`
> skill'inin tek sorumluluğudur. Aynı kuralı iki yerde anlatmak drift üretir.

## Üretilen dosyalar

```
.agent-work/                    ← generated DEĞİL; agent'ların çalışma alanı
├── README.md   TEMPLATE.md
├── inbox/   draft/   approved/   in-progress/   done/

.agent-source/skills/work-plan/SKILL.md   ← generated; ekosistem skill dizinlerine mirror
```

- `TEMPLATE.md` ← `templates/plan.md`
- `.agent-source/skills/work-plan/SKILL.md` ← `templates/work-plan-skill.md`
- **Tüm insan-okur metinler `docLanguage` dilinde üretilir**; şablonlar Türkçe
  referanstır, verbatim kopyalanmaz.
- `.agent-work/` **generated değildir**: `sync` onu üretmez, drift kontrolüne sokmaz,
  generated-file ledger'ı sahiplenmez. Setup boş iskeleti bir kez kurar.

## Makine işaretleri

Kurallar bölüm başlıklarına bakamaz — başlıklar `docLanguage`'e çevrilir. Bu yüzden her
gövde bölümü sabit bir HTML yorumuyla işaretlenir:

| İşaret | Bölüm | `revision` artırır |
|---|---|---|
| `<!-- s:what -->` | Ne ve neden (kabul kriteri burada) | Evet |
| `<!-- s:how -->` | Nasıl | Evet |
| `<!-- s:questions -->` | Açık sorular | Evet |
| `<!-- s:review-notes -->` | Denetim notları | Hayır |
| `<!-- s:progress -->` | İlerleme | Hayır |

İşaretler tam bu yorum biçiminde yazılır; çıplak ad (`s:what`) düzyazıda da geçer ve
kopyalanacak şey yorumun kendisidir.

Sentinel: `<!-- progress:not-started -->` — `draft/`'ta bulunur, `in-progress/`'te silinir.
İptal etiketi: `<!-- note:cancelled -->` — iptal geçişinde `s:review-notes`'a eklenir.

## Veri modeli

### `inbox/` kaydı — anahtar listesi KAPALI

Yalnız `id`, `title`, `created`, `source`. Başka herhangi bir anahtar kaydı geçersiz kılar.

`source` grameri: `user` **veya** `agent:<agent-adı>`. Değer yakalama anının kaydıdır; o
agent sonradan çıkarılsa bile geçerli kalır.

### Plan dosyası

| Alan | Kural | `revision` artırır |
|---|---|---|
| `id` | Zorunlu, değişmez, `<YYYYMMDD>-<n{2,}>` | Hayır |
| `title` | Zorunlu | Evet |
| `revision` | Zorunlu, 1'den başlar, pozitif tam sayı | — |
| `created`, `source` | Zorunlu, **değiştirilemez** | Hayır |
| `domain`, `paths` | Zorunlu | Evet |
| `executor` | Zorunlu, `<ekosistem>/<agent-adı>` | Evet |
| `reviews` | Zorunlu (`plan-review` ve `code-review` dizileri) | Hayır |
| `outcome` | **Yalnız `done/`'da**, tek değer `cancelled` | Hayır |
| `adr` | Opsiyonel | Hayır |

Dosya adı: `<id>-<slug>.md`. `<slug>` `title`'dan türetilir,
`^[a-z0-9]+(?:-[a-z0-9]+)*$` kuralına uyar; tekilliği `id` sağlar, slug okunabilirlik
içindir.

### Denetim kaydı

```yaml
{ by: <ekosistem>/<agent-adı> | system, at: <YYYY-MM-DD>, revision: <n>,
  verdict: approved | rejected | skipped, reasons: [<madde>, ...] }
```

- `by`: `skipped` kayıtlarında **`system`**; diğerlerinde asla `system` değil.
- `reasons`: **her zaman dizi**; `rejected` ise boş olamaz.
- Kayıtlar **asla silinmez**; sonraki kayıt öncekini geçersiz kılar.

## Kapı yüklemleri

**`planReviewPassed(plan, manifest)` — kalıcı.** Dosyayla taşınır, **çağıran oturumdan
bağımsızdır**. Karşılaştırılacak sahip kimliği planın kendi `executor` ekosisteminden
kurulur (`<executor.ecosystem>/<planReviewer>`), çağıran oturumdan değil — plan dosyaları
paylaşılır ve onay hangi oturumdan bakıldığına göre değişmemelidir.

| `planReviewer` | Koşul |
|---|---|
| Bir agent adı | Son kayıt `approved`, `kayıt.revision === plan.revision`, `kayıt.by` güncel sahiple aynı |
| `null` | Son kayıt `skipped`, `kayıt.revision === plan.revision`, sahip hâlâ `null` |

**`doneAuthorized` — anlık.** `in-progress/ → done/` hareketini yetkilendirir, saklanmaz.
Kod denetleyicisi varsa o hareketten hemen önce çalıştırılan denetim `approved` olmalı;
`null` ise her zaman yetkilidir. **Yalnız başarılı tamamlamayı korur** — iptal ayrı bir
geçiştir ve `outcome: cancelled` + yeni `<!-- note:cancelled -->` kaydı ister.

## Klasör değişmezleri

| Klasör | Değişmez |
|---|---|
| `inbox/` | `revision`, `reviews`, `executor`, `outcome` bulunmaz |
| `draft/` | `revision` var; `s:progress` sentinel'li |
| `approved/` | `planReviewPassed` doğru |
| `in-progress/` | `planReviewPassed` doğru; `s:progress` doldurulmuş |
| `done/` | **Arşivdir, yeniden değerlendirilmez** |

`done/` neden yeniden değerlendirilmez: `planReviewPassed` güncel sahibe bakar; kapı sahibi
sonradan değişirse tamamlanmış işler geriye dönük geçersiz görünürdü. Kayıtlar
tamamlanma anındaki durumu zaten taşır.

## Kurulum sırasında doğrulananlar

Sihirbaz üretimden **önce** şunları denetler:

- `constitution.planGate: true` ise kök `planGate` nesnesi zorunlu; `false`/yok ise
  bulunmamalı.
- `planReviewer` ve `codeReviewer` anahtarları ikisi de zorunlu; değer agent adı ya da
  `null`.
- Kapı sahibi **kod yazmayan** agent olmalı (`writesCode === false`; alan verilmemişse
  agent kod yazar sayılır).
- Kapı sahibinin **etkin hedefleri**, tüm **uygun executor'ların** (routing'de geçen ve
  kod yazan agent'lar) etkin hedeflerinin birleşimini kapsamalı.
- Hedeflenen her ekosistemde en az bir uygun executor bulunmalı.
- Agent adları benzersiz (büyük/küçük harf duyarsız) ve slug kuralına uygun olmalı.

Bu doğrulamaların kod tarafı `validate-manifest.mjs`'e aittir (ayrı iş).

## Runtime kabul senaryoları

`work-plan` skill'inin davranışı otomatik testle kapsanamaz — bir agent'ın bir oturumda
nasıl davrandığını ölçüyor. Bu yüzden kabul **elle yürütülen senaryolarla** yapılır ve
senaryo listesi tasarım dokümanındadır:

- **R1–R39** — yaşam döngüsünün her geçişi (plan yazımı, kapı onayı/reddi, revizyon
  bayatlaması, havuz seçimi, yarım iş devamı, iptal, ekosistem çözümlemesi)
- **N1–N25** — değişmez savunmaları (geçersiz klasör hareketi, bozuk kayıt şeması, kapalı
  inbox anahtar listesi, dosya adı/`id` uyumsuzluğu)

Kaynak: `docs/superpowers/specs/2026-08-02-plan-gate-design.md`. Liste burada
**tekrarlanmaz** — iki yerde tutmak drift üretir; skill değiştiğinde tek yer güncellenir.

## Artefakt doğrulaması

Bu dosyanın ve şablonların yapısal tutarlılığı makine tarafından denetlenir:

```bash
node team-builder-shared/validate-plan-gate.mjs --root <repo-kökü>
```

Denetlenenler: beş `s:*` işareti şablonda **tam bir kez** ve sırayla var mı, sentinel var
mı, plan frontmatter alanları **frontmatter bloğunun içinde** eksiksiz mi, skill şablonu
geçerli frontmatter taşıyor mu, bu dosya her işareti yorum biçiminde belgeliyor mu, ve
`team-builder-shared/` altında — symlink'lerin arkası dahil — kazara `SKILL.md` adında
dosya var mı.

## Architect'siz takım

Architect yoksa `docs/` özel sahipliği olmayan sıradan bir dizindir ve danışma hedefi
**kullanıcıdır**. Bu koşul `routing.md`, `agent-md-rich.md`, `governance-defaults.md` ve
`team-builder-setup/SKILL.md`'de birlikte uygulanır — biri koşullanmazsa `docs/` sahipsiz
kalırken yasak sürer.
````

- [ ] **Step 2: Doğrulayıcının tamamen yeşil olduğunu gör**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: `Plan gate artifacts are valid.` ve exit 0.

- [ ] **Step 3: Selftest'lerin bozulmadığını doğrula**

```bash
node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: üç kez `SELFTEST PASS`.

- [ ] **Step 4: Commit**

```bash
git add team-builder-shared/plan-gate.md
git commit -m "feat: add the plan gate setup contract"
```

---

## Uygulama sonrası doğrulama

- [ ] **Artefakt doğrulayıcısı yeşil**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: `Plan gate artifacts are valid.`

- [ ] **Üç selftest de geçiyor**

```bash
node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/sync-agent-config.mjs --selftest
```

- [ ] **Kurulum tuzağı yok**

```bash
find team-builder-shared -name 'SKILL.md'
```

Beklenen: boş çıktı.

- [ ] **Kurulum hâlâ çalışıyor ve şablon global skill olmuyor**

```bash
rm -rf /tmp/tb-pg && mkdir -p /tmp/tb-pg && HOME=/tmp/tb-pg ./install.sh opencode >/dev/null && find /tmp/tb-pg -name 'SKILL.md' | sed 's|.*/skills/||' | sort
```

Beklenen tam olarak üç satır: `architecture-advisor/SKILL.md`, `team-builder-setup/SKILL.md`, `team-builder-sync/SKILL.md`. `work-plan` **görünmemeli**.

- [ ] **Skill şablonu R/N senaryolarını karşılıyor (elle okuma)**

Spec'teki R1–R39 ve N1–N25 listesini `templates/work-plan-skill.md` ile karşılaştır: her
senaryonun beklediği davranış skill metninde tarif edilmiş mi? Skill kurulup gerçek bir
projede çalıştırılmadan tam kabul yapılamaz (o Plan 2 sonrasıdır); bu adım yalnız
**metinsel kapsama** kontrolüdür — tarif edilmeyen bir davranış varsa skill eksiktir.

- [ ] **Generator davranışı değişmedi**

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
