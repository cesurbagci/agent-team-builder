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
| `wizard-state.md` | constitution örneği 5 alana çıkar |
| `README.md` (iki dil) | "all on by default" düzeltilir |
| `routing.md` | `.agent-work/**` notu; `docs/** → architect` satırının architect'siz takımda üretilmediği; code-review satırının `codeReviewer`'dan geldiği |
| `governance-defaults.md` | Reviewer'ın evrensel gate tanımının `planGate.codeReviewer`'a bağlanması |
| `canonical-source.md`, `sync-pipeline.md` | `.agent-work/` generated değildir |

### Sihirbaz soru düzeni

`team-builder-setup/SKILL.md:53` "soru başına en fazla 4 seçenek", satır 57 "anayasa
presetleri tam 4 kural → tek multiSelect" diyor. Beşinci preset bunu çakıştırıyor:

- **İlk dört preset:** tek `multiSelect`, dördü de önceden işaretli (bugünkü davranış).
- **`planGate`:** ayrı bir tekli soru, işaretsiz.
- `SKILL.md:57` bu düzene göre güncellenir.

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
| Ad biçimi | `agents[].name` **`/` içeremez** (kimlik ayrıştırması için) |

**Erişilebilirlik neden böyle tanımlı.** İlk taslak "kapı sahibi, `executor`'ın
ekosisteminde olmalı" diyordu; bu doğrulayıcıya verilemez çünkü `executor` plan dosyasına
ait bir değerdir ve `validate(doc)` yalnız manifest'i görür (`validate-manifest.mjs:19`).
Kural manifest verisinden kurulabilir hale getirildi: kurulum anında kapsama, çalışma
anında da `executor`'ın **uygun executor'lardan biri olması** denetlenir. Bu ikisi birlikte
"denetleyicisi olmayan bir ekosisteme iş düşmesi" durumunu kapatır.

Doğrulayıcı bugün ad tekilliğini denetlemiyor (`validate-manifest.mjs:32-40`); kapı
sahipleri ada göre çözümlendiği için bu kural eklenir.

## Kimlik biçimi

`executor` ve `reviews[].by` alanları **`<ekosistem>/<agent-adı>`** biçimindedir.

- Ekosistem: `claude` | `codex` | `opencode`.
- İlk `/` ayraçtır; agent adları `/` içeremez (yukarıdaki değişmez).
- `skipped` kayıtlarında `by` değeri özel sabit **`system`**'dir (ekosistem taşımaz).

Çalışma anında `work-plan`: adın gerçek bir agent olduğunu, **uygun executor'lardan biri**
olduğunu ve ekosistemin o agent'ın etkin hedeflerinde bulunduğunu denetler.

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
| Ham kayıt analiz edilir | `inbox/` → `draft/` | Plan yazılır, `revision: 1`; inbox kaydı silinir |
| Plan doğrudan yazılır | — → `draft/` | `revision: 1` |
| Kapı 1 onaylar | `draft/` (kalır) | `reviews.plan-review` += `approved` |
| Kapı 1 reddeder | `draft/` (kalır) | `reviews.plan-review` += `rejected`; gerekçe `## Denetim notları`'na |
| Kapı 1 sahibi `null` | `draft/` (kalır) | `reviews.plan-review` += `skipped` (`by: system`) |
| Plan düzeltilir | `draft/` (kalır) | `revision` artar |
| Kapı 2 — kullanıcı onaylar | `draft/` → `approved/` | — |
| Kapı 2 — kullanıcı değişiklik ister | `draft/` (kalır) | Geri bildirim `## Denetim notları`'na |
| Havuzdan seçilir | `approved/` → `in-progress/` | `## İlerleme` doldurulmaya başlar |
| İş bırakılır | `in-progress/` (kalır) | `## İlerleme` güncellenir |
| Planlama içeriği değişir | `approved/` veya `in-progress/` → `draft/` | `revision` artar; `## İlerleme` korunur |
| Kapı 3 onaylar | `in-progress/` → `done/` | `reviews.code-review` += `approved` |
| Kapı 3 reddeder | `in-progress/` (kalır) | `reviews.code-review` += `rejected`; gerekçe `## Denetim notları`'na |
| Kapı 3 sahibi `null` | `in-progress/` → `done/` | `reviews.code-review` += `skipped` (`by: system`); **ek kullanıcı onayı istenmez** — kullanıcı kapı 2'de zaten onayladı |
| İş iptal edilir | `draft/`, `approved/`, `in-progress/` → `done/` | `outcome: cancelled`; gerekçe `## Denetim notları`'na |
| Ham kayıt iptal edilir | `inbox/` → **silinir** | Inbox kaydında `revision`/`reviews` yoktur; `done/`'a taşınmaz |

### Klasör değişmezleri

| Klasör | Değişmez |
|---|---|
| `inbox/` | `revision`, `reviews`, `executor`, `outcome` **bulunmaz** |
| `draft/` | `revision` var; `## İlerleme` **`Başlamadı`** sentinel'iyle mevcut |
| `approved/` | `planReviewPassed` **doğru** olmalı |
| `in-progress/` | `planReviewPassed` doğru; `## İlerleme` doldurulmuş |
| `done/` | Ya `outcome: cancelled`, ya da `planReviewPassed` doğru **ve** o hareket `doneAuthorized` ile yetkilendirilmiş |

## Veri modeli

### `inbox/` kaydı

```yaml
---
title: Kupon alanında doğrulama eksik
created: 2026-08-02
source: agent:backend-developer      # user | agent:<ad>
---
```

Gövde iki-üç cümle. Analiz edilmemiştir; başka alan taşımaz.

### Plan dosyası

```yaml
---
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
| `title` | Zorunlu | **Evet** |
| `revision` | Zorunlu, 1'den başlar | — |
| `created`, `source` | Zorunlu, **değiştirilemez** | Hayır |
| `domain`, `paths` | Zorunlu | **Evet** |
| `executor` | Zorunlu | **Evet** |
| `reviews` | Zorunlu (boş diziler olabilir) | Hayır |
| `outcome` | **Yalnız `done/`'da**, tek değer `cancelled` | Hayır |
| `adr` | Opsiyonel | Hayır |

Gövde bölümlerinden `## İlerleme` ve `## Denetim notları` **artırmaz**; diğer her bölüm
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

Plan dosyasına bakarak hesaplanır, dosyayla birlikte taşınır:

| `planReviewer` | Koşul |
|---|---|
| Bir agent adı | `reviews.plan-review` son kaydı `approved`, `kayıt.revision === plan.revision`, **ve** `kayıt.by` güncel çözümlenmiş sahiple aynı |
| `null` | Son kayıt `skipped` **ve** sahip hâlâ `null` |

`by` karşılaştırması şart: kapı sahibi sonradan değiştirilirse eski denetleyicinin onayı
geçerli kalmamalıdır. `null` durumunda `revision` eşitliği aranmaz — atlama plan içeriğine
bağlı değildir.

### `doneAuthorized` — anlık

`in-progress/ → done/` hareketini yetkilendirir ve **saklanmaz**:

| `codeReviewer` | Koşul |
|---|---|
| Bir agent adı | O hareketten hemen önce çalıştırılan kod review'ın sonucu `approved` |
| `null` | Her zaman yetkilidir (kapı yok) |

**Kod review onayı bir revizyona bağlanamaz** çünkü plan `revision`'ı planlama içeriğini
tanımlar, yazılan kodu değil — plan hiç değişmeden kod değişebilir. Bu yüzden kod review
kaydı geçmiş olarak durur ama **yetki vermez**: iş `done/`'a gitmeden kesilirse, devam
edildiğinde kod review yeniden çalıştırılır.

## Şablon

Tüm bölümler **her zaman mevcuttur**; `## İlerleme` `draft/`'ta `Başlamadı` sentinel'iyle
açılır ve `in-progress/`'e geçince doldurulur.

| Bölüm | İçerik | `revision` artırır |
|---|---|---|
| `## Ne ve neden` | Sade dille, örnekle. **Kabul kriteri** burada | Evet |
| `## Nasıl` | Yaklaşım, etkilenen bileşenler, riskler | Evet |
| `## Açık sorular` | Yoksa "yok" yazılır | Evet |
| `## Denetim notları` | Kapı red gerekçeleri, kullanıcı geri bildirimi, iptal gerekçesi | Hayır |
| `## İlerleme` | `Başlamadı` \| son durum, sıradaki adım, engel, dokunulan yerler | Hayır |

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
| Kapı sahibi kurulumdan sonra değişti | Eski sahibin onayı geçersiz sayılır |
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
| V4 | Kök nesnede `codeReviewer` eksik | Reddedilir |
| V5 | `planReviewer: null`, `codeReviewer: null` | Kabul edilir |
| V6 | Kapı sahibi tanımsız ad | Reddedilir |
| V7 | Kapı sahibi `writesCode` **verilmemiş** agent | Reddedilir (varsayılan `true` → kod yazar) |
| V8 | Kapı sahibinin etkin hedefleri uygun executor birleşimini kapsamıyor | Reddedilir |
| V9 | Kapı sahibi `targets` taşımıyor, `targetsDefault`'tan kapsıyor | Kabul edilir |
| V10 | İki agent aynı ada sahip | Reddedilir |
| V11 | Agent adı `/` içeriyor | Reddedilir |

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

### Runtime kabul matrisi

| # | Senaryo | Beklenen |
|---|---|---|
| R1 | Ham kayıttan plan yazılır | `inbox/` kaydı silinir, `draft/`'ta `revision: 1`, `## İlerleme` = `Başlamadı` |
| R2 | Doğrudan plan yazılır (inbox'sız) | `draft/`'ta `revision: 1`, tüm bölümler mevcut |
| R3 | Kapı 1 onaylar | `approved` kaydı, `reasons: []`, revision eşleşir |
| R4 | Kapı 1 reddeder | `draft/`'ta kalır, `rejected` + boş olmayan `reasons`, gerekçe `## Denetim notları`'nda |
| R5 | Red sonrası düzeltilir | `revision` artar, kapı 1 yeniden geçilir, eski kayıt durur |
| R6 | Kullanıcı onaylar | `approved/`'a taşınır |
| R7 | Kullanıcı değişiklik ister | `draft/`'ta kalır, geri bildirim `## Denetim notları`'nda; düzeltme `revision`'ı artırır |
| R8 | `approved/`'da `## Nasıl` değişir | `revision` artar, `draft/`'a döner |
| R9 | `in-progress/`'te `executor` değişir | `revision` artar, `draft/`'a döner, `## İlerleme` korunur |
| R10 | `## İlerleme` güncellenir | `revision` **artmaz**, `planReviewPassed` bozulmaz |
| R11 | Havuzdan iki iş seçilir | İkisi `in-progress/`'e geçer, sıra dayatılmaz |
| R12 | İş bırakılır, yeni oturum | `## İlerleme`'den kaldığı yer okunur |
| R13 | Kapı 3 onaylar | `done/`'a taşınır |
| R14 | Kapı 3 reddeder | `in-progress/`'te kalır, gerekçe `## Denetim notları`'nda |
| R15 | `planReviewer: null` | `skipped` kaydı, akış kullanıcıya gider |
| R16 | `codeReviewer: null` | `skipped` kaydı, iş doğrudan `done/`'a gider, ek onay istenmez |
| R17 | Kod review onaylandı, `done/`'a gitmeden kesildi, devam edildi | Kod review **yeniden** çalışır; eski kayıt yetki vermez |
| R18 | Kapı sahibi değiştirildi | Eski sahibin onayı geçersiz, yeni sahiple yeniden geçilir |
| R19 | Denetleyici bayat `reviewed_revision` döndürür | Kayıt yazılmaz, denetim tekrarlanır |
| R20 | `draft/`'tan iptal | `done/`'a taşınır, `outcome: cancelled` |
| R21 | `approved/`'tan iptal | Aynı |
| R22 | `in-progress/`'ten iptal | Aynı |
| R23 | `inbox/` kaydı iptal | Silinir, `done/`'a taşınmaz |
| R24 | `.agent-work/` yok | İskeleti kurmayı teklif eder |
| R25 | Kullanıcı "plansız yap" der | Hiç dosya oluşmaz |
| R26 | Preset kapalı, skill kurulu | Doğru mesaj, var olmayan komuta yönlendirme yok |

**Değişmez savunmaları (negatif senaryolar):**

| # | Senaryo | Beklenen |
|---|---|---|
| N1 | `approved/`'a `planReviewPassed` yanlışken taşıma denenir | Reddedilir |
| N2 | `in-progress/`'e `## İlerleme` doldurulmadan geçilir | Reddedilir |
| N3 | `done/`'a `doneAuthorized` olmadan taşıma denenir | Reddedilir |
| N4 | `inbox/` kaydına `revision`/`reviews` eklenir | Reddedilir |

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
| 13 | Tüm bölümler her zaman mevcut; `## İlerleme` sentinel'li | Şablon yaşam döngüsü R1 ile çelişiyordu |
| 14 | `outcome: cancelled` yalnız `done/`'da, revizyon-etkilemez | `done/` iki sonucu barındırıyor |
| 15 | Kimlik `<ekosistem>/<agent-adı>`, ad `/` içeremez | Ayrıştırma belirsizliği kalmasın |
| 16 | Topolojiye referans verilmez | `topology` yalnız Claude hedefi için |
| 17 | Tek `executor`; çoklu domain'de danışma | Path→executor eşlemesi YAGNI |
| 18 | Eşik yok, kaçış kullanıcıda ve izlenmez | Eşik kararını agent verirse kapı sessizce atlanır |
| 19 | Tüm insan-okur çıktılar `docLanguage`'de üretilir | Sihirbazın dil sözleşmesi |
| 20 | Preset açma/kapama proje-yükseltme skill'ine ait | `sync` yeni kaynak yaratmıyor |
| 21 | Çapraz ekosistem ayrı spec | Verdict protokolü başlı başına iş |
