# Tasarım: Plan Kapısı ve İş Havuzu (`planGate`) — çekirdek

- **Tarih:** 2026-08-02 (baştan yazım: 2026-08-07, 5. review turundan sonra)
- **Durum:** Onaylandı — uygulama planı bekliyor
- **Kapsam:** 5. anayasa preseti olarak plan kapısı + iş havuzu, **tek ekosistem içinde**

> **Yazım notu.** Beş Codex review turu (11, 13, 10, 9, 10 bulgu). İlk dört turda spec
> parça parça düzeltildi ve her düzeltme başka yeri kırdı — beşinci turda kapatılan dokuz
> maddenin yedisi yeni tutarsızlıklar yüzünden açık kaldı. Bu sürüm **baştan, tek seferde**
> yazıldı; terimler tek yerde tanımlanıp her yerde aynı kullanıldı.

## Problem

team-builder bir takım kuruyor ve aralarına routing/danışma zinciri koyuyor, ama **bir işin
roller arasında nasıl aktığına** dair hiçbir şey üretmiyor. Tek denetim noktası kod
review'ı — yani reviewer devreye girdiğinde ortada zaten yazılmış kod var. Yaklaşım baştan
yanlışsa o emek çöpe gidiyor. Ayrıca yarım kalan iş ve verilen kararlar oturumlar arasında
kayboluyor.

## Kapsam

| | Alt sistem | Durum |
|---|---|---|
| **A** | Plan kapısı — plan yazımı, denetim, kullanıcı onayı | **Bu spec** |
| **D** | Havuz — onaylanmış işlerin birikmesi ve seçilerek işletilmesi | **Bu spec** |
| **B** | Çapraz ekosistem çağırma + verdict protokolü | Ayrı spec |
| **C** | Inbox'ın dış sisteme (Jira vb.) bağlanması | Ayrı spec |
| **E** | Preset'i kurulum sonrası açma/kapama | Proje-yükseltme skill'i |

Bu spec **tek ekosistem içinde** çalışır: denetleyiciler projenin kendi agent'larıdır ve
**aynı oturumda**, o ekosistemin kendi agent çağırma mekanizmasıyla çalıştırılır. Harici
CLI çağrısı yoktur.

> `manifest.topology` (`subagent` / `native`) **yalnız Claude hedefi içindir**
> (`manifest-schema.md:22`). Bu yüzden spec topolojiye referans vermez; çağrı kuralı
> "ekosistemin kendi aynı-oturum agent çağrısı" diye tanımlıdır ve her topolojide aynı
> sözleşmeyi kullanır.

**B için bırakılan kanca:** `executor` ve `reviews[].by` alanları `<ekosistem>/<agent-adı>`
biçimindedir. Çekirdekte ekosistem her zaman projenin kendisidir; B geldiğinde aynı alana
başka ekosistem yazılabilir, veri modeli değişmez.

## Terimler (tek tanım)

| Terim | Tanım |
|---|---|
| **Etkin hedefler** | `agents[].targets`, yoksa kök `targetsDefault`. Doğrulayıcı zaten böyle çözümlüyor (`validate-manifest.mjs:57`). |
| **Kod yazan agent** | `writesCode ?? true` — alan **verilmezse varsayılan `true`**'dur (`manifest-schema.md:55`). Bu yüzden `=== true` karşılaştırması yanlıştır. |
| **Uygun executor'lar** | `routing[].role` olarak geçen **ve** kod yazan agent'lar. |

## Mimari

**Kural anayasada, prosedür skill'de.**

| Doküman | Kim okur | Ne anlatır |
|---|---|---|
| `team-builder-shared/plan-gate.md` | Sihirbaz (kurulum anında) | Kurulum sözleşmesi + veri modeli |
| Projeye kurulan `work-plan` skill'i | Projede çalışan agent | Runtime prosedürü |

Agent md gövdeleri adımları tekrar etmez; "plan kapısı açık, prosedür `work-plan`
skill'inde" der.

**Neden hook değil:** `PreToolUse` Claude Code'a özgü; Codex ve OpenCode'da karşılığı yok.

### Preset açma/kapama bu spec'in dışındadır

`sync` yalnız var olan kaynakları mirror'lar, yeni kaynak yaratmaz ve `.agent-work/`
iskeletini kurmaz. Preset kapalı kurulmuşsa ortada ne skill kaynağı ne iskelet olur — yani
"manifest'te `planGate: true` yap ve sync çalıştır" **işe yaramaz.** Bu işlem
proje-yükseltme skill'ine aittir. `work-plan` skill'i bunu doğru söyler, var olmayan bir
komuta yönlendirmez.

### team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `constitution.md` | KARAR 5 — `planGate` (default KAPALI); "default her zaman true" iddiası düzeltilir |
| `plan-gate.md` *(yeni)* | Kurulum sözleşmesi + veri modeli |
| `templates/plan.md` *(yeni)* | Plan şablonu |
| `templates/work-plan-skill.md` *(yeni)* | Projeye kurulacak skill'in şablonu |
| `team-builder-setup/SKILL.md` | 5. toggle (ayrı soru); Adım 8a üretim adımları; routing/governance prose'unun `codeReviewer`'a göre yazılması |
| `agent-md-rich.md` | developer ve denetleyici rollere `## Plan Kapısı` bölümü |
| `manifest-schema.md` | `constitution.planGate` + `planGate` kök nesnesi + ad tekilliği; "4 preset, tümü default true" düzeltilir |
| `validate-manifest.mjs` | `planGate` doğrulaması + ad tekilliği + ad biçimi |
| `wizard-state.md` | constitution örneği 5 alana çıkar; **`answers.planGate`** eklenir (iki kapı sahibi cevabı) |
| `README.md` (iki dil) | "all on by default" düzeltilir |
| `routing.md` | `.agent-work/**` notu; `docs/** → architect` satırının architect'siz takımda üretilmediği; code-review satırının `codeReviewer`'dan geldiği |
| `agent-md-rich.md` (ek) | developer'ın `docs/` yasağı ve architect'e atıflar **koşullu** hale gelir (satır 49, 67, 72, 119) |
| `governance-defaults.md` (ek) | developer `consults` ve `<arch-root>` yasağı architect varlığına bağlanır (satır 53, 55) |
| `governance-defaults.md` | Reviewer'ın evrensel gate tanımının `planGate.codeReviewer`'a bağlanması |
| `canonical-source.md`, `sync-pipeline.md` | `.agent-work/` generated değildir |

### Architect'siz takımda `docs/` sahipliği

`routing.md:20` `docs/** → architect` satırını "her zaman ekle" diyor; bu spec architect
olmayan takımlarda o satırın üretilmemesi gerektiğini söylüyor. Ama yasak **üç yerde**
tanımlı ve üçü birlikte koşullanmazsa `docs/` sahipsiz kalırken developer'a hâlâ "orası
architect'in, yazma" denir:

| Kaynak | Bugünkü hâli | Architect yoksa |
|---|---|---|
| `routing.md:20` | `docs/** → architect` her zaman | Satır **üretilmez** |
| `agent-md-rich.md:49` | developer: "`docs/` altına yazmam (orası architect'in)" | Bu cümle **yazılmaz** |
| `agent-md-rich.md:67` | developer yasak listesinde `docs/` | `docs/` **listeden çıkar** |
| `team-builder-setup/SKILL.md:162` | routing taslağında architect satırı öneriliyor | Öneri **atlanır** |
| `agent-md-rich.md:72` | "architect: doc tarafını ben güncellerim" | Bu cümle **yazılmaz** |
| `agent-md-rich.md:119` | developer yasağı `<arch-root>/` içeriyor | `<arch-root>/` yasaktan **çıkar** |
| `governance-defaults.md:53` | developer `consults: [architect]` | `consults` **boş** olur |
| `governance-defaults.md:55` | "`docs/<arch-root>/` altına yazma; architect'e işaret et" | Bu cümle **yazılmaz** |

Architect yoksa `docs/` özel sahipliği olmayan sıradan bir dizindir; kod yolu sahipliği
kuralları (routing) neyse o geçerlidir. Üç prose kaynağı da aynı koşula bağlanır.

> Bu, plan kapısının getirdiği bir kural değil — architect'i opsiyonel kılmanın zaten var
> olan sonucudur. Plan kapısı yalnız görünür hâle getiriyor.

### Sihirbaz soru düzeni

`team-builder-setup/SKILL.md:53` "soru başına en fazla 4 seçenek", satır 57 "anayasa
presetleri tam 4 kural → tek multiSelect" diyor. Beşinci preset bunu çakıştırıyor:

- **İlk dört preset:** tek `multiSelect`, dördü de önceden işaretli (bugünkü davranış).
- **`planGate`:** ayrı bir tekli soru, işaretsiz.
- `SKILL.md:57` bu düzene göre güncellenir.

**`planGate` açık seçilirse iki alt soru daha sorulur** — kök `planGate` nesnesinin iki
anahtarı da zorunlu olduğu için bunlar atlanamaz:

| Soru | Adaylar |
|---|---|
| "Planı kim denetlesin?" | Kod yazmayan agent'lar + "denetim olmasın" (`null`) |
| "Kodu kim denetlesin?" | Kod yazmayan agent'lar + "denetim olmasın" (`null`) |

Sihirbaz seçimden hemen sonra **erişilebilirliği** doğrular (seçilen sahibin etkin
hedefleri, uygun executor'ların birleşimini kapsıyor mu) ve kapsamıyorsa nedenini sade
dille söyleyip yeniden sorar. Üretim (Adım 8a) bu iki değer kesinleşmeden başlamaz.

Cevaplar sihirbaz durum kaydına yazılır (`wizard-state.md`):

```jsonc
"answers": {
  ...,
  "planGate": { "planReviewer": "architect", "codeReviewer": null }
}
```

Bu şart: kurulum iki alt sorunun ortasında kesilirse, resume edildiğinde cevaplar
kaybolmamalı ve sorular baştan sorulmamalıdır.

### Projede üretilecekler (preset açıkken)

```
.agent-work/                    ← generated DEĞİL; agent'ların çalışma alanı
├── README.md   TEMPLATE.md
├── inbox/   draft/   approved/   in-progress/   done/

.agent-source/skills/work-plan/SKILL.md   ← generated; ekosistem skill dizinlerine mirror
```

**Tüm insan-okur çıktılar `docLanguage` dilinde üretilir** — `README.md`, `TEMPLATE.md` ve
skill gövdesi dahil. `templates/` altındaki dosyalar Türkçe **referanstır**, verbatim
kopyalanmaz.

**Makine işaretleri çeviriden bağımsızdır.** Kurallar bölüm *başlıklarına* bakamaz, çünkü
başlıklar `docLanguage`'e çevrilir. Bu yüzden her gövde bölümünün üstünde **sabit bir HTML
yorum işareti** bulunur ve kurallar yalnız bu işaretlere bakar:

```markdown
<!-- s:what -->
## Ne ve neden
...
<!-- s:progress -->
## İlerleme
<!-- progress:not-started -->
```

| İşaret | Bölüm |
|---|---|
| `s:what` | Ne ve neden |
| `s:how` | Nasıl |
| `s:questions` | Açık sorular |
| `s:review-notes` | Denetim notları |
| `s:progress` | İlerleme |

"Başlamadı" sentinel'i de dilden bağımsızdır: `<!-- progress:not-started -->`. Başlık
metinleri çevrilir, işaretler çevrilmez.

**`.agent-work/` generated değildir:** `sync` onu üretmez, drift kontrolüne sokmaz,
generated-file ledger'ı sahiplenmez. Setup boş iskeleti bir kez kurar.

**Şablon `docs/` altına konmaz:** `docs/` architect'in yazma alanıdır (`routing.md:20`);
developer oradan okuyabilir ama yazamaz (`agent-md-rich.md:49,67`). Plan dosyaları sürekli
değişen çalışma artefaktıdır ve architect'in ağacının dışında durmalıdır.

## Manifest

```jsonc
"constitution": { ..., "planGate": true },
"planGate": {
  "planReviewer": "architect",   // agent adı ya da null
  "codeReviewer": "reviewer"     // agent adı ya da null
}
```

### Değişmezler (normatif)

| Kural | Davranış |
|---|---|
| `constitution.planGate: true` | Kök `planGate` nesnesi **zorunlu** |
| `constitution.planGate` `false`/yok | Kök `planGate` nesnesi **bulunmamalı** |
| Anahtarlar | Nesne varsa `planReviewer` ve `codeReviewer` **ikisi de zorunlu**; değer agent adı ya da `null` |
| Uygunluk | Kapı sahibi **kod yazmayan** agent olmalı (`writesCode === false`; alan verilmemişse agent kod yazar sayılır) |
| Erişilebilirlik | Her `null` olmayan kapı sahibinin **etkin hedefleri**, tüm **uygun executor'ların** etkin hedeflerinin birleşimini kapsamalı |
| Ad tekilliği | `agents[].name` değerleri benzersiz olmalı |
| Ad biçimi | `agents[].name` **portatif slug** olmalı: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| Ad tekilliği (büyük/küçük) | Karşılaştırma **büyük/küçük harf duyarsız** yapılır |
| Routing zorunluluğu | `constitution.planGate: true` ise **hedeflenen her ekosistemde en az bir uygun executor** bulunmalı (tanım aşağıda) |

**Erişilebilirlik neden böyle tanımlı.** İlk taslak "kapı sahibi, `executor`'ın
ekosisteminde olmalı" diyordu; bu doğrulayıcıya verilemez çünkü `executor` plan dosyasına
ait bir değerdir ve `validate(doc)` yalnız manifest'i görür (`validate-manifest.mjs:19`).
Kural manifest verisinden kurulabilir hale getirildi: kurulum anında kapsama, çalışma
anında da `executor`'ın **uygun executor'lardan biri olması** denetlenir. Bu ikisi birlikte
"denetleyicisi olmayan bir ekosisteme iş düşmesi" durumunu kapatır.

Doğrulayıcı bugün ad tekilliğini denetlemiyor (`validate-manifest.mjs:32-40`); kapı
sahipleri ada göre çözümlendiği için bu kural eklenir.

**Ad biçimi neden slug.** Agent adları generated dosya yollarına doğrudan gömülüyor
(`sync-agent-config.mjs:409,419,425`). Yalnız `/` yasaklamak yetmez: ters bölü, kontrol
karakterleri, Windows'ta ayrılmış karakterler ve yalnız büyük/küçük harfle ayrışan
adlar da yol çakışması üretir. Portatif slug kuralı bunların hepsini kapatır.

**Hedeflenen ekosistemler** normatif olarak şudur:

```
targetedEcosystems = ∪ etkinHedefler(agent)   // manifest'teki her agent için
```

`targetsDefault` tek başına yeterli değildir: her agent kendi `targets`'ıyla onu
ezebilir, o zaman o ekosistem projede fiilen hedeflenmiyordur. Generator de proje
hedeflerini aynı birleşimden türetiyor (`sync-agent-config.mjs:184`).

**Routing zorunluluğu neden var.** `routing` şemada opsiyonel (`manifest-schema.md:33`) ama
uygun executor'lar ondan türüyor. Routing boşsa kurulum geçer, sonra **her plan çalışma
anında reddedilir**. Kontrol **ekosistem başınadır**: manifest birden çok ekosistemi
hedefleyebilir (`manifest-schema.md:21`) ve çalışma anında `executor` o anki ekosistemde
olmak zorundadır. Yalnız "global olarak bir executor var" demek, o ekosistemde iş
yapılamayacağı durumu kaçırır.

## Kimlik biçimi

`executor` ve `reviews[].by` alanları **`<ekosistem>/<agent-adı>`** biçimindedir.

- Ekosistem: `claude` | `codex` | `opencode`.
- İlk `/` ayraçtır; agent adları slug kuralı gereği `/` içeremez.
- `skipped` kayıtlarında `by` değeri özel sabit **`system`**'dir (ekosistem taşımaz).

Çalışma anında `work-plan` üç şeyi birden denetler:

1. Ad gerçek bir agent ve **uygun executor'lardan biri**.
2. Ekosistem o agent'ın etkin hedeflerinde bulunuyor.
3. **Ekosistem, o an çalışılan ekosistemin kendisi** (`identity.ecosystem === currentEcosystem`).

#### `currentEcosystem` nasıl belirlenir

Skill kendi yüklendiği dizinden türetir:

| Skill'in konumu | `currentEcosystem` |
|---|---|
| `.claude/skills/` | `claude` |
| `.opencode/skills/` | `opencode` |
| `.agents/skills/` | Aşağıdaki kurala göre çözülür |

**`.agents/skills/` neden özel.** Generator bu mirror'ı **koşulsuz** üretir
(`sync-agent-config.mjs:472`) — Codex ya da OpenCode hedeflenmese bile. Bu yüzden
"manifest'te tek hedef varsa onu kullan" kuralı yanlıştır: Claude-only bir manifest'te
`.agents/` altından çağrılan skill kendini `claude` sanardı.

Doğru kural, **hedeflenen ekosistemler** kümesi üzerinden işler:

```
targetedEcosystems = ∪ etkinHedefler(agent)   // her agent için
adaylar            = targetedEcosystems ∩ { codex, opencode }
```

| `adaylar` | Davranış |
|---|---|
| Boş | **Dur** — bu konumdan çağrı desteklenmiyor (ne Codex ne OpenCode hedefleniyor) |
| Tek eleman | O ekosistem kullanılır |
| İki eleman | Skill **durur ve kullanıcıya sorar** |

`claude` bu kesişime hiç girmez, çünkü Claude `.agents/skills/`'i okumaz.

Bu yüzden `executor` ve `reviews[].by` değerleri her zaman bu çözümlenmiş ekosistemle
yazılır.

Üçüncü şart olmadan bir Codex oturumu `claude/backend-developer` değerini kabul eder, sonra
onu çağıramaz — çekirdek spec ekosistem sınırını geçmiyor. `reviews[].by` de aynı prefix'ten
üretilir.

### Plan dosyası kimliği

Her plan **değişmez bir `id`** taşır ve dosya adı `<id>-<slug>.md` biçimindedir. `id`
oluşturulduğunda verilir, klasörler arasında taşınırken **korunur**, hiçbir zaman
değişmez. Çakışma olursa (aynı `id` iki dosyada) bu bir hatadır ve `work-plan` yeni dosya
yazmaz.

`inbox/` kaydı da `id` taşır; `draft/`'a analiz edilirken **aynı `id` korunur**, böylece
kaydın izi kaybolmaz.

## Yaşam döngüsü

```
inbox/        ham kayıt
   │ analiz
   ▼
draft/        plan yazıldı ── kapı 1: plan review ──┐
   ▲                                                │
   │ planlama içeriği değişti                       ▼
   └────────────────────────────── kapı 2: kullanıcı onayı
                                                    │
                                                    ▼
approved/     havuz — kullanıcı bir/birkaçını seçip işletir
                                                    │ seçildi
                                                    ▼
in-progress/  kod yazılıyor ── kapı 3: kod review ──┐
                                                    ▼
done/         arşiv
```

**Durum = bulunduğu klasör.** Frontmatter'da `status` alanı yoktur.

### Geçişler (tam liste)

| Olay | Nereden → Nereye | Artefakt |
|---|---|---|
| Ham kayıt analiz edilir | `inbox/` → `draft/` | Plan yazılır, `revision: 1`; `id`, `created`, `source` **korunur** (yakalama anının kaydıdır); inbox dosyası silinir |
| Plan doğrudan yazılır | — → `draft/` | `revision: 1` |
| Kapı 1 onaylar | `draft/` (kalır) | `reviews.plan-review` += `approved` |
| Kapı 1 reddeder | `draft/` (kalır) | `reviews.plan-review` += `rejected`; gerekçe `s:review-notes` bölümüne |
| Kapı 1 sahibi `null` | `draft/` (kalır) | `reviews.plan-review` += `skipped` (`by: system`) |
| Plan düzeltilir | `draft/` (kalır) | `revision` artar |
| Kapı 2 — kullanıcı onaylar | `draft/` → `approved/` | — |
| Kapı 2 — kullanıcı değişiklik ister | `draft/` (kalır) | Geri bildirim `s:review-notes` bölümüne |
| Havuzdan seçilir | `approved/` → `in-progress/` | `s:progress` doldurulmaya başlar |
| İş bırakılır | `in-progress/` (kalır) | `s:progress` güncellenir |
| Planlama içeriği değişir | `approved/` veya `in-progress/` → `draft/` | `revision` artar; `s:progress` korunur |
| Kapı 3 onaylar | `in-progress/` → `done/` | `reviews.code-review` += `approved` |
| Kapı 3 reddeder | `in-progress/` (kalır) | `reviews.code-review` += `rejected`; gerekçe `s:review-notes` bölümüne |
| Kapı 3 sahibi `null` | `in-progress/` → `done/` | `reviews.code-review` += `skipped` (`by: system`); **ek kullanıcı onayı istenmez** — kullanıcı kapı 2'de zaten onayladı |
| İş iptal edilir | `draft/`, `approved/`, `in-progress/` → `done/` | `outcome: cancelled`; gerekçe `s:review-notes` bölümüne |
| Ham kayıt iptal edilir | `inbox/` → **silinir** | Inbox kaydında `revision`/`reviews` yoktur; `done/`'a taşınmaz |
| **`planReviewer` manifest'te değişir** | `approved/`, `in-progress/` → `draft/` | `planReviewPassed` bozulur; plan kapısı yeni sahiple yeniden geçilir. `s:progress` korunur. **`done/` etkilenmez** |
| **`codeReviewer` manifest'te değişir** | Hiçbir dosya taşınmaz | Kapı 3 anlık olduğu için geçmişi etkilemez; bir sonraki `done/` hareketinde yeni sahip çalışır |

### Klasör değişmezleri

| Klasör | Değişmez |
|---|---|
| `inbox/` | `revision`, `reviews`, `executor`, `outcome` **bulunmaz** |
| `draft/` | `revision` var; `s:progress` bölümü **`<!-- progress:not-started -->`** sentinel'iyle mevcut |
| `approved/` | `planReviewPassed` **doğru** olmalı |
| `in-progress/` | `planReviewPassed` doğru; `s:progress` doldurulmuş (sentinel yok) |
| `done/` | **Arşivdir, yeniden değerlendirilmez** — aşağıya bak |

**`done/` neden yeniden değerlendirilmez.** `planReviewPassed` *güncel* manifest sahibine
bakar. Kapı sahibi sonradan değişirse tamamlanmış işler geriye dönük "geçersiz" olurdu —
oysa onlar zamanında kurallara uygun bitmişti. `done/` bir **arşivdir**: içindeki kayıtlar
(`reviews[].by`, `at`, `verdict`) tamamlanma anındaki durumu zaten taşır ve o hâliyle
okunur. Değişmez yalnız girişte uygulanır, sonradan değil.

**`doneAuthorized` bir klasör değişmezi değildir.** Saklanmadığı için dosyaya bakarak
doğrulanamaz; yalnız `in-progress/ → done/` **geçişinin koruması**dır. Geçiş anında
denetlenir, sonra unutulur.

## Veri modeli

### `inbox/` kaydı

```yaml
---
id: 20260802-01
title: Kupon alanında doğrulama eksik
created: 2026-08-02
source: agent:backend-developer      # user | agent:<ad>
---
```

Gövde iki-üç cümle. Analiz edilmemiştir; başka alan taşımaz.
Dosya adı: `<id>-<slug>.md` (örn. `20260802-01-kupon-dogrulama.md`).

**`id` biçimi:** `<YYYYMMDD>-<n{2,}>` — oluşturulduğu gün ve o gün içindeki sıra; **en az**
iki hane, gerekirse daha fazla (`-99`'dan sonra `-100` gelir, hata verilmez).
Portatiftir (yalnız rakam ve tire), sıralanabilir, elle okunabilir. Yeni kayıt açılırken
`.agent-work/` altındaki **tüm** klasörler taranır ve o güne ait en büyük sıra bir artırılır.

### Plan dosyası

```yaml
---
id: 20260802-01
title: Kupon alanına doğrulama ekle
revision: 3
created: 2026-08-02
source: agent:backend-developer
domain: backend
paths: [apps/api/src/coupon/**]
executor: claude/backend-developer
reviews:
  plan-review:
    - { by: claude/architect, at: 2026-08-02, revision: 2, verdict: rejected, reasons: ["kabul kriteri ölçülemez"] }
    - { by: claude/architect, at: 2026-08-03, revision: 3, verdict: approved, reasons: [] }
  code-review: []
adr: docs/mimari/backend/adr/0003-kupon-dogrulama.md
---
```

| Alan | Kural | `revision` artırır |
|---|---|---|
| `id` | Zorunlu, **değişmez**, `<YYYYMMDD>-<n{2,}>` | Hayır |
| `title` | Zorunlu | **Evet** |
| `revision` | Zorunlu, 1'den başlar | — |
| `created`, `source` | Zorunlu, **değiştirilemez** | Hayır |
| `domain`, `paths` | Zorunlu | **Evet** |
| `executor` | Zorunlu | **Evet** |
| `reviews` | Zorunlu (boş diziler olabilir) | Hayır |
| `outcome` | **Yalnız `done/`'da**, tek değer `cancelled` | Hayır |
| `adr` | Opsiyonel | Hayır |

Gövde bölümlerinden `s:progress` ve `s:review-notes` **artırmaz**; diğer her bölüm
artırır.

`executor` bilerek artıran listededir: işi kimin yapacağı değişmişse plan onayı da o
değişikliği görmemiştir.

### Denetim kaydı şeması (normatif)

```yaml
{ by: <ekosistem>/<agent-adı> | system, at: <YYYY-MM-DD>, revision: <n>,
  verdict: approved | rejected | skipped, reasons: [<madde>, ...] }
```

| Alan | Kural |
|---|---|
| `by` | Denetleyen agent; `skipped` kayıtlarında `system` |
| `at` | Kayıt tarihi |
| `revision` | Kaydın verildiği andaki `plan.revision` (her kapı için yazılır; **yalnız plan review'da yetki belirler**) |
| `verdict` | Üç değerden biri |
| `reasons` | **Her zaman dizi.** `rejected` ise boş olamaz; `approved`/`skipped` için boş olabilir |

**Kayıtlar asla silinmez.** Reddedilen kapının kaydı durur; sonraki kayıt onu geçersiz kılar.

**Denetleyici çıktısı → kayıt eşlemesi.** Denetleyici dosya değiştirmez; şunu döndürür:

```
verdict:           approved | rejected
reviewed_revision: <denetlediği plan.revision>
reasons:           [ ... ]          # rejected ise boş olamaz
```

`work-plan` bunu alır; `by`'yi çözümlenmiş kapı sahibinden, `at`'i tarihten üretir,
`revision` alanına `reviewed_revision`'ı yazar. `reviewed_revision` o an diskteki
`plan.revision`'dan farklıysa **kayıt yazılmaz** — plan denetim sırasında değişmiştir,
denetim tekrarlanır.

### `.agent-work/` altına kim yazar

Repo'nun kuralları bunu zaten sabitliyor: reviewer hiçbir dosyaya yazmaz
(`agent-md-rich.md:48`; çalışma klasörü `:65` "hiçbiri", `:68` "her şeyi okurum, hiçbir
şeye yazmam"). Bu yüzden **`.agent-work/` altına yalnız `work-plan` akışını yürüten agent
yazar.** Denetleyicilerin yetkileri değişmez.

## İki kapı yüklemi

Kapı 1 ile kapı 3'ün doğası farklıdır ve **tek bir kural ikisini birden tanımlayamaz**.

### `planReviewPassed(plan, manifest)` — kalıcı

Plan dosyasına bakarak hesaplanır, dosyayla birlikte taşınır ve **çağıran oturumdan
bağımsızdır**.

Karşılaştırılacak sahip kimliği **planın kendi `executor` ekosisteminden** kurulur:
`<executor.ecosystem>/<planReviewer>`. `currentEcosystem` bu hesaba **girmez**.

> **Neden.** Plan dosyaları commit edilip paylaşılıyor. Kimlik çağıran oturumdan
> türetilseydi, Codex oturumunda onaylanmış bir planı OpenCode oturumu açtığında kimlik
> `opencode/architect` olur, kayıtta ise `codex/architect` yazardı — onay geçersiz
> görünürdü. Kalıcı bir yüklem geçici bir bağlama bağlanamaz.
>
> `currentEcosystem` yalnız **çalışma yetkisi** kontrolünde kullanılır:
> `executor.ecosystem === currentEcosystem` — yani "bu oturumda bu işi ben yürütebilir
> miyim". Bu ayrı bir sorudur ve dosyaya yazılmaz.

| `planReviewer` | Koşul |
|---|---|
| Bir agent adı | `reviews.plan-review` son kaydı `approved`, `kayıt.revision === plan.revision`, **ve** `kayıt.by` güncel çözümlenmiş sahiple aynı |
| `null` | Son kayıt `skipped`, `kayıt.revision === plan.revision`, **ve** sahip hâlâ `null` |

`by` karşılaştırması şart: kapı sahibi sonradan değiştirilirse eski denetleyicinin onayı
geçerli kalmamalıdır.

**`null` durumunda da `revision` eşitliği aranır.** İlk taslak atlamayı revizyondan muaf
tutuyordu, ama bu sınır tablosuyla çelişiyordu: "her planlama değişikliği
`planReviewPassed`'i bozar" kuralı istisna kaldırmaz. Plan değişince yeni bir `skipped`
kaydı düşülür — ucuz bir işlem ve kural tek parça kalır.

### `doneAuthorized` — anlık

`in-progress/ → done/` hareketini yetkilendirir ve **saklanmaz**:

| `codeReviewer` | Koşul |
|---|---|
| Bir agent adı | O hareketten hemen önce çalıştırılan kod review'ın sonucu `approved` |
| `null` | Her zaman yetkilidir (kapı yok) |

**`doneAuthorized` yalnız başarılı tamamlamayı korur.** İptal ayrı bir geçiştir ve ayrı bir
koruması vardır:

1. `outcome: cancelled` yazılmış olmalı, **ve**
2. `s:review-notes` bölümüne **o geçiş sırasında yeni bir kayıt** eklenmiş olmalı; kayıt
   açıkça iptal etiketi taşır (`<!-- note:cancelled -->`) ve gerekçeyi içerir.

İkinci şart "bölüm boş değil" demek **değildir**: eski bir red notu ya da kullanıcı geri
bildirimi de bölümü doldurur, ama işin neden iptal edildiğini söylemez. İptal için kod
review çalıştırılmaz — yarıda bırakılan bir işi iptal etmek için kodunu onaylatmak
anlamsız olurdu.

**Kod review onayı bir revizyona bağlanamaz** çünkü plan `revision`'ı planlama içeriğini
tanımlar, yazılan kodu değil — plan hiç değişmeden kod değişebilir. Bu yüzden kod review
kaydı geçmiş olarak durur ama **yetki vermez**: iş `done/`'a gitmeden kesilirse, devam
edildiğinde kod review yeniden çalıştırılır.

## Şablon

Tüm bölümler **her zaman mevcuttur**; `s:progress` `draft/`'ta
`<!-- progress:not-started -->` sentinel'iyle açılır ve `in-progress/`'e geçince doldurulur.

| Bölüm | İçerik | `revision` artırır |
|---|---|---|
| `s:what` | Sade dille, örnekle. **Kabul kriteri** burada | Evet |
| `s:how` | Yaklaşım, etkilenen bileşenler, riskler | Evet |
| `s:questions` | Yoksa "yok" yazılır | Evet |
| `s:review-notes` | Kapı red gerekçeleri, kullanıcı geri bildirimi, iptal gerekçesi | Hayır |
| `s:progress` | `<!-- progress:not-started -->` \| son durum, sıradaki adım, engel, dokunulan yerler | Hayır |

**Kapı 1'in reddetme ölçütleri:** kabul kriteri yok/ölçülemez, `paths` gövdeyle tutarsız,
açık soru cevapsız, yaklaşım mevcut bir ADR'ye aykırı.

## `codeReviewer` ve mevcut evrensel gate

`routing.md:45,74` ve `governance-defaults.md:66` bugün sabit `reviewer` adıyla evrensel
bir kod review kapısı tanımlıyor. `planGate` açıkken **tek otorite `planGate.codeReviewer`
alanıdır**:

| `codeReviewer` | Sonuç |
|---|---|
| Bir agent adı | Evrensel code-review kuralı o ad ile yazılır; denetim sonucu ayrıca plan dosyasına kaydedilir |
| `null` | Evrensel code-review kuralı **hiç yazılmaz** — projede kod review kapısı yoktur |

`planGate` kapalıysa bugünkü davranış aynen korunur (sabit `reviewer` gate'i).

**Nasıl uygulanır.** Generator prose üretmez; `.agent-source/project/*` dosyalarını
kopyalar (`sync-agent-config.mjs:348`). Bu yüzden routing ve governance metnini **setup
yazar** — manifest ile aynı anda, aynı kaynaktan. Kapı sahibi sonradan değişirse ikisini
birlikte güncellemek **proje-yükseltme skill'inin** işidir. Generator'a yeni yetenek
eklenmez.

## Sınır durumları

| Durum | Davranış |
|---|---|
| `planReviewer` `null` | Kapı 1 atlanır, `skipped` kaydı düşer, plan kullanıcıya gider |
| `codeReviewer` `null` | Kapı 3 atlanır, `skipped` kaydı düşer, iş `done/`'a gider |
| Plan review sonrası planlama içeriği değişti | `revision` artar, `planReviewPassed` bozulur, kapı 1 yeniden geçilir |
| Denetleyici, plan değişmişken sonuç döndürdü | `reviewed_revision` uyuşmaz, kayıt yazılmaz, denetim tekrarlanır |
| `planReviewer` kurulumdan sonra değişti | Eski sahibin onayı geçersiz sayılır; `approved/` ve `in-progress/` `draft/`'a döner |
| `codeReviewer` kurulumdan sonra değişti | Hiçbir dosya taşınmaz; kapı 3 anlık olduğu için yalnız sonraki tamamlamayı etkiler |
| Preset kapalıyken skill çağrıldı | "Plan kapısı kapalı; açmak proje-yükseltme skill'i gerektirir" der |
| `.agent-work/` yok | İskeleti kurmayı teklif eder |
| Kullanıcı "plansız yap" der | Hiç plan dosyası oluşmaz, `.agent-work/`'e yazılmaz, izlenmez |

## Doğrulama

### `validate-manifest.mjs --selftest`

| # | Senaryo | Beklenen |
|---|---|---|
| V1 | `constitution.planGate` string | Reddedilir |
| V2 | `planGate: true`, kök nesne yok | Reddedilir |
| V3 | `planGate: false`, kök nesne var | Reddedilir |
| V3b | `constitution.planGate` **hiç yok** ama kök nesne var | Reddedilir |
| V4 | Kök nesnede `codeReviewer` eksik | Reddedilir |
| V5 | `planReviewer: null`, `codeReviewer: null` | Kabul edilir |
| V6 | Kapı sahibi tanımsız ad | Reddedilir |
| V7 | Kapı sahibi `writesCode` **verilmemiş** agent | Reddedilir (varsayılan `true` → kod yazar) |
| V8 | Kapı sahibinin etkin hedefleri uygun executor birleşimini kapsamıyor | Reddedilir |
| V9 | Kapı sahibi `targets` taşımıyor, `targetsDefault`'tan kapsıyor | Kabul edilir |
| V10 | İki agent aynı ada sahip | Reddedilir |
| V11 | Agent adı slug kuralına uymuyor (`/`, `\`, boşluk, büyük harf, kontrol karakteri) | Reddedilir |
| V12 | İki agent yalnız büyük/küçük harfle ayrışıyor (`Dev` / `dev`) | Reddedilir |
| V13 | `planGate: true` ama hiç uygun executor yok (routing boş ya da yalnız kod yazmayan roller) | Reddedilir |
| V13b | `planGate: true`, **hedeflenen** bir ekosistemde hiç uygun executor yok | Reddedilir |
| V14 | `planReviewer` anahtarı hiç yok | Reddedilir |
| V15 | Kök `planGate` nesne değil (dizi/string) | Reddedilir |
| V16 | Kapı sahibi değeri string ya da `null` değil (sayı/nesne) | Reddedilir |

### `sync-agent-config.mjs --selftest`

| # | Senaryo | Beklenen |
|---|---|---|
| S1 | `.agent-source/skills/work-plan/` kaynağı | Ekosistem skill dizinlerine mirror'lanır |
| S2 | `.agent-work/` içine konan dosya | Sync sonrası yerinde durur, `--check` temiz, ledger'da görünmez |

### Sihirbaz çıktısı (elle kabul)

| # | Senaryo | Beklenen |
|---|---|---|
| W1 | Preset açık kurulum | `.agent-work/` + beş alt dizin, `README.md`, `TEMPLATE.md`, skill kaynağı oluşur; metinler `docLanguage` dilinde |
| W2 | Preset kapalı kurulum | Hiçbiri oluşmaz, mirror üretilmez, `.agent-work/` yoktur |
| W3 | `codeReviewer` verilmiş kurulum | Routing/governance metni o adla yazılır |
| W4 | `codeReviewer: null` kurulum | Evrensel code-review kuralı metinde hiç yer almaz |
| W5 | Architect'siz takım kurulumu | `docs/** → architect` satırı yok; developer talimatında `docs/` yasağı ve architect atıfları yok; `consults` boş |
| W6 | Kurulum iki kapı sorusunun ortasında kesilir, resume edilir | `answers.planGate`'teki cevap korunur, soru yeniden sorulmaz |

> **Kapalılık kuralı — bu spec içinde uygulanmıştır.** Her normatif satır (manifest
> değişmezleri, klasör değişmezleri, geçiş tablosu, alan sınıflandırması) yukarıdaki
> V/S/W/R/N kümelerinden **en az birine** eşlenir. Uygulama planı bu eşlemeyi yeniden
> türetmez; yalnız senaryoları çalıştırılabilir hâle getirir. Yeni bir normatif satır
> eklenirse ona bir senaryo da eklenir.

### Runtime kabul matrisi

| # | Senaryo | Beklenen |
|---|---|---|
| R1 | Ham kayıttan plan yazılır | `inbox/` kaydı silinir, `draft/`'ta `revision: 1`, `s:progress` = `<!-- progress:not-started -->` |
| R2 | Doğrudan plan yazılır (inbox'sız) | `draft/`'ta `revision: 1`, tüm bölümler mevcut |
| R3 | Kapı 1 onaylar | `approved` kaydı, `reasons: []`, revision eşleşir |
| R4 | Kapı 1 reddeder | `draft/`'ta kalır, `rejected` + boş olmayan `reasons`, gerekçe `s:review-notes` bölümünde |
| R5 | Red sonrası düzeltilir | `revision` artar, kapı 1 yeniden geçilir, eski kayıt durur |
| R6 | Kullanıcı onaylar | `approved/`'a taşınır |
| R7 | Kullanıcı değişiklik ister | `draft/`'ta kalır, geri bildirim `s:review-notes` bölümünde; düzeltme `revision`'ı artırır |
| R8 | `approved/`'da `s:how` değişir | `revision` artar, `draft/`'a döner |
| R9 | `in-progress/`'te `executor` değişir | `revision` artar, `draft/`'a döner, `s:progress` korunur |
| R10 | `s:progress` güncellenir | `revision` **artmaz**, `planReviewPassed` bozulmaz |
| R11 | Havuzdan iki iş seçilir | İkisi `in-progress/`'e geçer, sıra dayatılmaz |
| R12 | İş bırakılır, yeni oturum | `s:progress`'ten kaldığı yer okunur |
| R13 | Kapı 3 onaylar | `done/`'a taşınır; `reviews.code-review` son kaydı `approved` |
| R14 | Kapı 3 reddeder | `in-progress/`'te kalır, gerekçe `s:review-notes` bölümünde |
| R15 | `planReviewer: null` | `skipped` kaydı (`by: system`, revision eşleşir), akış kullanıcıya gider |
| R15b | `planReviewer: null` iken plan düzeltilir | `revision` artar, `planReviewPassed` bozulur, **yeni** `skipped` kaydı düşülür |
| R16 | `codeReviewer: null` | `skipped` kaydı, iş doğrudan `done/`'a gider, ek onay istenmez |
| R17 | Kod review onaylandı, `done/`'a gitmeden kesildi, devam edildi | Kod review **yeniden** çalışır; eski kayıt yetki vermez |
| R18 | **`planReviewer`** değiştirildi | Eski sahibin onayı geçersiz, yeni sahiple yeniden geçilir |
| R18b | **`codeReviewer`** değiştirildi | Hiçbir dosya taşınmaz; bir sonraki `done/` hareketinde yeni sahip çalışır |
| R19 | Denetleyici bayat `reviewed_revision` döndürür | Kayıt yazılmaz, denetim tekrarlanır |
| R20 | `draft/`'tan iptal | `done/`'a taşınır, `outcome: cancelled` |
| R21 | `approved/`'tan iptal | Aynı |
| R22 | `in-progress/`'ten iptal | Aynı |
| R23 | `inbox/` kaydı iptal | Silinir, `done/`'a taşınmaz |
| R24 | `.agent-work/` yok | İskeleti kurmayı teklif eder |
| R25 | Kullanıcı "plansız yap" der | Hiç dosya oluşmaz |
| R26 | Preset kapalı, skill kurulu | Doğru mesaj, var olmayan komuta yönlendirme yok |
| R27 | `title` / `domain` / `paths` değişir | Üçü de `revision` artırır, `planReviewPassed` bozulur |
| R28 | `adr` alanı eklenir | `revision` **artmaz** |
| R28b | `s:review-notes` bölümü değişir | `revision` **artmaz**, `planReviewPassed` bozulmaz |
| R29 | `planReviewer` değişince `approved/`'daki iş | `draft/`'a döner, yeniden geçilir |
| R29b | `planReviewer` değişince `in-progress/`'teki iş | `draft/`'a döner, `s:progress` korunur |
| R30 | `planReviewer` değişince `done/`'daki iş | **Dokunulmaz**, arşiv geçerli kalır |
| R31 | Inbox'tan analiz edilen planın `id`/`created`/`source` değerleri | Korunur, yeniden üretilmez |
| R32 | `s:what` bölümü değişir | `revision` artar, `planReviewPassed` bozulur |
| R33 | `s:questions` bölümü değişir | `revision` artar, `planReviewPassed` bozulur |
| R34 | Aynı gün 99 plan varken 100.'sü açılır | `id` `-100` olur, hata verilmez |
| R35 | `in-progress/`'teki iş iptal edilir | `done/`'a taşınır; `outcome: cancelled` **ve** `s:review-notes`'a yeni `<!-- note:cancelled -->` kaydı eklenir; kod review çalıştırılmaz |
| R36 | Plan Codex oturumunda onaylandı, OpenCode oturumunda açılır | `planReviewPassed` **doğru kalır** — kimlik `executor` ekosisteminden kurulur |
| R37 | `.agents/skills/`'ten çağrı, hedefler yalnız `codex` | `currentEcosystem` = `codex`, soru sorulmaz |
| R38 | `.agents/skills/`'ten çağrı, hedefler `codex` ve `opencode` | Skill **durur ve sorar** |
| R39 | `.agents/skills/`'ten çağrı, ne `codex` ne `opencode` hedefli | **Dur** — bu konumdan çağrı desteklenmiyor |

**Değişmez savunmaları (negatif senaryolar):**

| # | Senaryo | Beklenen |
|---|---|---|
| N1 | `approved/`'a `planReviewPassed` yanlışken taşıma denenir | Reddedilir |
| N1b | `in-progress/`'e `planReviewPassed` yanlışken taşıma denenir | Reddedilir |
| N2 | `in-progress/`'e `s:progress` doldurulmadan geçilir | Reddedilir |
| N3 | `done/`'a **tamamlama olarak** `doneAuthorized` olmadan taşıma denenir | Reddedilir |
| N3b | `done/`'a **iptal olarak** `outcome: cancelled` ya da gerekçe olmadan taşıma denenir | Reddedilir |
| N4 | `inbox/` kaydına `revision`, `reviews`, `executor` ya da `outcome` eklenir (dördü ayrı ayrı) | Reddedilir |
| N5 | `executor` uygun executor listesinde değil (routing'siz kod yazan agent) | Reddedilir |
| N6 | `executor` ekosistemi o an çalışılan ekosistem değil | Reddedilir |
| N7 | `outcome` `done/` dışında bir klasörde | Reddedilir |
| N8 | `outcome` değeri `cancelled` dışında | Reddedilir |
| N9 | `created` ya da `source` değiştirilmeye çalışılır | Reddedilir |
| N10 | Aynı `id` iki dosyada | Reddedilir, yeni dosya yazılmaz |
| N11 | `id` biçimi bozuk (`2026-8-1`, `abc`, sıra yok) | Reddedilir |
| N12 | Dosya adı `id` ile uyuşmuyor (`20260802-01-x.md` içinde `id: 20260803-02`) | Reddedilir |
| N13 | Denetim kaydında `at` yok ya da `YYYY-MM-DD` değil | Reddedilir |
| N14 | `skipped` kaydında `by` değeri `system` değil | Reddedilir |
| N15 | `approved`/`rejected` kaydında `by` değeri `system` | Reddedilir |
| N16 | `rejected` kaydında `reasons` boş dizi | Reddedilir |
| N17 | İptal geçişinde `s:review-notes`'ta yalnız eski notlar var, yeni iptal kaydı yok | Reddedilir |

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Anayasa preseti + projeye kurulan skill; hook değil | Hook Claude'a özgü |
| 2 | Preset default kapalı, ayrı soruda sorulur | Artefakt üretiyor; 4-seçenek sınırıyla çakışmaz |
| 3 | `plan-gate.md` = kurulum sözleşmesi, skill = runtime prosedürü | Aynı kural iki yerde anlatılırsa drift olur |
| 4 | Kapı sahipleri manifest'te ad olarak yazılır | Rol adları özelleştirilebilir |
| 5 | Erişilebilirlik manifest'te kapsama, çalışma anında executor kontrolü | `executor` plan başına; doğrulayıcı onu göremez |
| 6 | `writesCode ?? true` | Repo varsayılanı `true`; `=== true` yanlış sonuç verir |
| 7 | İki ayrı yüklem: `planReviewPassed` kalıcı, `doneAuthorized` anlık | Kapı 1 plan içeriğine, kapı 3 koda bağlı |
| 8 | Kod review kaydı `revision` taşır ama yetki vermez | Plan revizyonu yazılan kodu tanımlamaz |
| 9 | `executor` revizyon-etkileyen | İşi kimin yapacağı değişmişse onay bunu görmemiştir |
| 10 | Kayıt şeması tek; `reasons` her zaman dizi | Tekil/çoğul karışıklığı üç yerde çelişki üretmişti |
| 11 | `.agent-work/`'e yalnız `work-plan` akışı yazar | `agent-md-rich.md:48,65,68` reviewer'a yazma alanı vermiyor |
| 12 | `codeReviewer` evrensel gate'in tek otoritesi; metni setup yazar | Generator prose üretmiyor (`sync-agent-config.mjs:348`) |
| 13 | Tüm bölümler her zaman mevcut; `s:progress` sentinel'li | Şablon yaşam döngüsü R1 ile çelişiyordu |
| 14 | `outcome: cancelled` yalnız `done/`'da, revizyon-etkilemez | `done/` iki sonucu barındırıyor |
| 15 | Kimlik `<ekosistem>/<agent-adı>`; ad portatif slug | Adlar dosya yoluna gömülüyor; `/` yasağı tek başına yetmez |
| 15b | Ekosistem, o an çalışılan ekosistem olmalı | Çekirdek ekosistem sınırını geçmiyor |
| 15c | Plan değişmez bir `id` taşır, taşımalarda korunur | Beş klasör arasında dosya kimliği gerekiyor |
| 15d | `done/` arşivdir, yeniden değerlendirilmez | Kapı sahibi değişince tamamlanmış işler geriye dönük geçersiz olmamalı |
| 15e | `doneAuthorized` geçiş korumasıdır, klasör değişmezi değil | Saklanmadığı için dosyaya bakarak doğrulanamaz |
| 15f | Makine işaretleri (`s:*`) çeviriden bağımsız | Bölüm başlıkları `docLanguage`'e çevriliyor |
| 15g | `currentEcosystem` skill konumundan; `.agents/` altında `{codex,opencode}` kesişiminden | `.agents/skills` koşulsuz üretiliyor, tek-hedef varsayımı yanlış sonuç verir |
| 15h | İptal, yeni ve etiketli bir gerekçe kaydı ister | "Bölüm boş değil" kontrolünü eski bir not da geçer |
| 15i | Architect yoksa `docs/` yasağı ve architect atıfları **tüm** prose kaynaklarında kalkar | Aksi halde `docs/` sahipsizken yasak sürer |
| 15j | `planReviewPassed` kimliği `executor` ekosisteminden kurulur, çağıran oturumdan değil | Plan dosyaları paylaşılıyor; kalıcı yüklem geçici bağlama bağlanamaz |
| 16 | Topolojiye referans verilmez | `topology` yalnız Claude hedefi için |
| 17 | Tek `executor`; çoklu domain'de danışma | Path→executor eşlemesi YAGNI |
| 18 | Eşik yok, kaçış kullanıcıda ve izlenmez | Eşik kararını agent verirse kapı sessizce atlanır |
| 19 | Tüm insan-okur çıktılar `docLanguage`'de üretilir | Sihirbazın dil sözleşmesi |
| 20 | Preset açma/kapama proje-yükseltme skill'ine ait | `sync` yeni kaynak yaratmıyor |
| 21 | Çapraz ekosistem ayrı spec | Verdict protokolü başlı başına iş |
