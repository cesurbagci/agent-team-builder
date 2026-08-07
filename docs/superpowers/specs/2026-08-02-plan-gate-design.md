# Tasarım: Plan Kapısı ve İş Havuzu (`planGate`) — çekirdek

- **Tarih:** 2026-08-02 (revize: 2026-08-07)
- **Durum:** Onaylandı — uygulama planı bekliyor
- **Kapsam:** 5. anayasa preseti olarak plan kapısı + onaylanmış iş havuzu, **tek ekosistem içinde**

> **Revizyon notu (3. tur).** Üç Codex review turu: 11, 13 ve 10 bulgu. Bu sürüm üçünü de
> karşılıyor.
> Bu sürüm hepsini karşılıyor ve **kapsam ikiye bölündü**: çapraz ekosistem çağırma
> (`agent-invoke`, ortak verdict şeması, read-only güvenliği) buradan çıkarıldı ve
> `2026-08-XX-agent-invoke-design.md` olarak ayrı ele alınacak. Sebep: verdict protokolü
> başlı başına bir iş — üç CLI'nin çıktı formatı birbirinden farklı ve normalize edilmesi
> gerekiyor; çekirdek plan kapısı ona bağlı kalmadan da tam çalışır.

## Problem

team-builder bir takım kuruyor (architect, domain developer'lar, reviewer), aralarına
zorunlu routing ve danışma zinciri koyuyor. Ama **bir işin bu roller arasında nasıl
aktığına** dair hiçbir şey üretmiyor. Sonuç:

- Agent işe girişip yanlış yaklaşımla kod yazıyor; bu ancak sonuç çıkınca fark ediliyor.
- Kullanıcının onayı olmadan iş ilerliyor.
- Yarım kalan iş, verilen kararlar ve nerede kalındığı oturumlar arasında kayboluyor.

Mevcut tek denetim noktası kod review'ı — yani reviewer devreye girdiğinde ortada zaten
yazılmış kod var. Yaklaşım baştan yanlışsa o emek çöpe gidiyor.

## Kapsam

| | Alt sistem | Durum |
|---|---|---|
| **A** | Plan kapısı — plan yazımı, denetim, kullanıcı onayı | **Bu spec** |
| **D** | Havuz — onaylanmış işlerin birikmesi ve seçilerek işletilmesi | **Bu spec** |
| **B** | Çapraz ekosistem çağırma + verdict protokolü | **Ayrı spec** |
| **C** | Inbox'ın dış sisteme (Jira vb.) bağlanması | Ayrı spec |

Bu spec **tek ekosistem içinde** çalışır: kapılar projenin kendi agent'larıyla, **aynı
oturumda** yürütülür; harici CLI çağrısı yoktur.

**Topolojiden bağımsızdır.** Repo iki topoloji destekliyor (`manifest-schema.md:22`):
`subagent` (lead dağıtır) ve `native` (peer-to-peer agent teams). Denetleyici çağrısı
"**seçili topolojiye uygun aynı-oturum agent çağrısı**" olarak tanımlanır — `subagent`
topolojisinde subagent olarak, `native` topolojisinde teammate olarak. Sözleşme her iki
durumda aynıdır: denetleyici `{verdict, reviewed_revision, reasons}` döndürür, dosyayı
`work-plan` yazar.

**B için bırakılan kanca:** plan frontmatter'ındaki `reviews.<kapı>[]` kayıtları
`<ekosistem>/<rol>` biçimindedir. Çekirdekte her zaman projenin kendi ekosistemi yazılır;
B geldiğinde aynı alana başka ekosistemler girebilir. Veri modeli değişmez.

## Mimari

**Kural anayasada, prosedür skill'de.**

### Tek otorite ayrımı

| Doküman | Kim okur | Ne anlatır |
|---|---|---|
| `team-builder-shared/plan-gate.md` | **Sihirbaz** (kurulum anında) | Kurulum sözleşmesi: hangi dizin/dosyalar üretilir, frontmatter şeması. **Runtime adımlarını anlatmaz.** |
| Projeye kurulan `work-plan` skill'i | **Projede çalışan agent** | Runtime prosedürü: plan nasıl yazılır, kapılardan nasıl geçer, havuz nasıl işletilir |

Agent md gövdeleri adımları tekrar etmez; "plan kapısı açık, prosedür `work-plan`
skill'inde" der.

### Neden hook değil

`PreToolUse` hook'u Claude Code'a özgü; Codex ve OpenCode'da karşılığı yok. Çok hedefli
bir repoda kapı yalnız bir ekosistemde çalışır — "kapı var sanmak, yokken" en kötü senaryo.

### Preset açma/kapama bu spec'in dışındadır

Setup preset **kapalı** yapıldıysa ortada ne skill kaynağı ne `.agent-work/` iskeleti olur.
`sync` yalnız var olan kaynakları mirror'lar, yeni kaynak yaratmaz — yani "manifest'te
`planGate: true` yap ve sync çalıştır" **işe yaramaz**.

Bu yüzden preset açma/kapama, yazılmasına karar verilen **proje-yükseltme skill'ine**
aittir: eksik skill kaynaklarını ve iskeleti o kurar, kapatırken de kaynakları kaldırır
(mirror'ları ledger `(stale)` olarak raporlar). Bu spec o skill'e bağımlı değildir —
kurulumda preset açık seçilirse her şey çalışır; sonradan açmak o skill gelene kadar
mümkün değildir ve `work-plan` skill'i bunu **doğru** söyler, var olmayan bir komuta
yönlendirmez.

### team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `constitution.md` | KARAR 5 — `planGate` (default **KAPALI**); "default her zaman true" iddiası düzeltilir |
| `plan-gate.md` *(yeni)* | Kurulum sözleşmesi + veri modeli |
| `templates/plan.md` *(yeni)* | Plan şablonu (bölümleri zorunlu — aşağıya bak) |
| `templates/work-plan-skill.md` *(yeni)* | Projeye kurulacak skill'in şablonu |
| `team-builder-setup/SKILL.md` | 5. toggle (ayrı soru); Adım 8a üretim adımları |
| `agent-md-rich.md` | developer ve denetleyici rollere `## Plan Kapısı` bölümü |
| `manifest-schema.md` | `constitution.planGate` + `planGate` kök nesnesi; "4 preset, tümü default true" düzeltilir |
| `validate-manifest.mjs` | `planGate` boolean + kök nesne doğrulaması |
| `wizard-state.md` | constitution örneği 5 alana çıkar |
| `README.md` (iki dil) | "all on by default" düzeltilir |
| `routing.md` | `.agent-work/**` sahipliği notu; `docs/** → architect` satırının architect'siz takımda üretilmediği |
| `governance-defaults.md` | Reviewer'ın evrensel gate tanımı ile `planGate.codeReviewer` ilişkisi (yeni kapı değil, kayıt) |
| `canonical-source.md`, `sync-pipeline.md` | `.agent-work/` generated değildir |

### Sihirbaz soru düzeni (Codex bulgu 4 — çözüm)

`team-builder-setup/SKILL.md:53` "soru başına en fazla 4 seçenek", satır 57 ise "anayasa
presetleri tam 4 kural → tek multiSelect" diyor. Beşinci preset bu ikisini çakıştırıyor.
Çözüm:

- **İlk dört preset:** tek `multiSelect` soru, dördü de önceden işaretli (bugünkü davranış).
- **`planGate`:** **ayrı bir tekli soru**, işaretsiz. Sorulma sebebi de farklı — bu preset
  artefakt üretiyor ve ek roller gerektiriyor.
- `SKILL.md:57`'deki "tam 4 kural" ifadesi bu düzene göre güncellenir.

### Projede üretilecekler (preset açıkken)

```
.agent-work/                     ← generated DEĞİL; agent'ların çalışma alanı
├── README.md
├── TEMPLATE.md
├── inbox/     draft/     approved/     in-progress/     done/

.agent-source/skills/work-plan/SKILL.md   ← generated; ekosistem skill dizinlerine mirror
```

**Tüm insan-okur çıktılar `docLanguage` dilinde üretilir (Codex bulgu 9).** Buna
`README.md`, `TEMPLATE.md` ve `work-plan` skill'inin gövdesi dahildir. `templates/` altındaki
dosyalar Türkçe **referanstır**, verbatim kopyalanmaz.

### İki kritik kısıt

**1. `.agent-work/` generated değildir.** `sync` onu üretmez, drift kontrolüne sokmaz.
Setup yalnız boş iskeleti bir kez kurar. Generated-file ledger'ı da onu sahiplenmez.

**2. Şablon `docs/` altına konmaz.** `docs/` architect'in yazma alanıdır (`routing.md:20`);
developer oradan **okuyabilir** ama yazamaz (`agent-md-rich.md:49,67`; reviewer'ın hiç
yazma alanı yok — `:65,68`). Plan dosyaları
sürekli değişen çalışma artefaktıdır, bu yüzden architect'in sahibi olduğu ağacın dışında
durmalıdır — şablon da onlarla aynı yerde olur ki tek bir çalışma alanı kalsın.

## Yaşam döngüsü

```
inbox/        ham kayıt
   │ analiz
   ▼
draft/        plan yazıldı ── kapı 1: plan review ──┐
   ▲                                                │
   │ plan değişti → o kapının kaydı düşer           ▼
   └────────────────────────────── kapı 2: kullanıcı onayı
                                                    │
                                                    ▼
approved/     havuz — kullanıcı bir/birkaçını seçip işletir
                                                    │ seçildi
                                                    ▼
in-progress/  kod yazılıyor ── kapı 3: kod review ──┐
                                                    ▼
done/         arşiv (+ kalıcı karar çıktıysa ADR)
```

**Durum = bulunduğu klasör.** Frontmatter'da `status` alanı yoktur.

### Tüm geçişler (Codex bulgu 6)

Yukarıdaki şema mutlu yolu gösterir. Tam liste:

| Olay | Nereden → Nereye | Artefakt |
|---|---|---|
| Ham kayıt analiz edilir | `inbox/` → `draft/` | Plan yazılır, `revision: 1` |
| Plan doğrudan yazılır | — → `draft/` | `revision: 1` |
| **Kapı 1 onaylar** | `draft/` (kalır) | `reviews.plan-review` += approved |
| **Kapı 1 reddeder** | `draft/` (kalır) | `reviews.plan-review` += rejected; gerekçe `## Denetim notları`'na |
| Plan düzeltilir | `draft/` (kalır) | `revision` artar; kapı 1 kaydı bayatlar |
| **Kapı 2 — kullanıcı onaylar** | `draft/` → `approved/` | — |
| **Kapı 2 — kullanıcı değişiklik ister** | `draft/` (kalır) | Geri bildirim `## Denetim notları`'na; düzeltme `revision`'ı artırır |
| Havuzdan seçilir | `approved/` → `in-progress/` | `## İlerleme` açılır |
| İş bırakılır | `in-progress/` (kalır) | `## İlerleme` güncellenir |
| **Kapı 3 onaylar** | `in-progress/` → `done/` | `reviews.code-review` += approved |
| **Kapı 3 reddeder** | `in-progress/` (kalır) | `reviews.code-review` += rejected; gerekçe `## Denetim notları`'na |
| **Planlama içeriği `approved/`'da değişir** | `approved/` → `draft/` | `revision` artar; plan kapısından yeniden geçer |
| **Planlama içeriği `in-progress/`'te değişir** | `in-progress/` → `draft/` | `revision` artar; `## İlerleme` korunur, iş sonra kaldığı yerden sürer |
| İş iptal edilir (`draft/`, `approved/`, `in-progress/`) | → `done/` | `outcome: cancelled` yazılır; gerekçe `## Denetim notları`'na |
| **Ham kayıt iptal edilir** | `inbox/` → silinir | Inbox kaydında `revision`/`reviews` yoktur; `done/`'a taşınmaz |
| Kapı sahibi `null` | ilgili kapı | `reviews.<kapı>` += `skipped` (`by: system`), akış devam eder |

#### Klasör değişmezleri

Veri modeli, klasörün ima ettiğiyle çelişen durumlar üretebilir. Bunlar **geçersizdir** ve
`work-plan` bu duruma düşmez:

| Klasör | Değişmez |
|---|---|
| `approved/` | Plan review kapısı **geçilmiş** olmalı (sahip varsa `approved` + revision eşleşir; `null` ise `skipped`) |
| `in-progress/` | Aynı koşul; ayrıca `## İlerleme` bölümü açılmış olmalı |
| `done/` | Ya kod review kapısı geçilmiş olmalı, ya da `outcome: cancelled` olmalı |
| `inbox/` | `revision`, `reviews`, `executor` **bulunmaz** — bunlar analiz sonrası eklenir |

`done/` iki farklı sonucu barındırır; ayırt edici alan **`outcome`**: yoksa iş tamamlandı,
`cancelled` ise iptal edildi. Ayrı bir klasör açılmaz.

**Kullanıcının "plansız yap" kaçışı:** hiç plan dosyası oluşturulmaz ve `.agent-work/`'e
hiçbir şey yazılmaz. Bilinçli bir atlamadır, izlenmez. (İzlenmesi istenirse kullanıcı
`inbox/` kaydı açtırabilir — ama bu zorunlu değildir.)

### Kapıları hangi rol tutar (Codex bulgu 7 — çözüm)

Rol adları **sabit varsayılmaz**; sihirbaz özel adlara izin veriyor ve `writesCode: false`
olan birden fazla agent olabilir. Bu yüzden kapı sahipleri **manifest'te açıkça yazılır**:

```jsonc
"planGate": {
  "planReviewer": "architect",     // manifest'teki bir agent adı, ya da null
  "codeReviewer": "reviewer"       // manifest'teki bir agent adı, ya da null
}
```

Sihirbaz bunu kurulumda sorar (aday listesi: `writesCode: false` olan agent'lar), doğrulayıcı
da değerlerin gerçek agent adları olduğunu denetler. `null` = o kapı yok.

**Denetleyici hangi ekosistemde çalışır?** Çekirdek kural: **executor'ın ekosisteminde.**
Değerler çıplak rol adıdır; ekosistem plandaki `executor`'dan türer. Doğrulayıcı, seçilen
kapı sahibinin o ekosistemde gerçekten üretildiğini denetler (agent'ın `targets`'ı o
ekosistemi içermeli) — aksi halde kurulum sırasında hata verir, çalışma anında değil.

Bu kural manifest'te açıkça yazılır:

```jsonc
"planGate": {
  "planReviewer": "architect",
  "codeReviewer": "reviewer",
  "reviewerEcosystem": "same-as-executor"   // şimdilik tek geçerli değer
}
```

`reviewerEcosystem` alanı bugün tek değer alıyor ama **şimdi tanımlanıyor** ki çapraz
ekosistem fazı geldiğinde `"codex"` gibi bir değer eklemek yeterli olsun; kapı sahibi
konfigürasyonunun şekli değişmesin.

#### Manifest değişmezleri (Codex bulgu 4 — normatif)

| Kural | Davranış |
|---|---|
| `constitution.planGate: true` | Kök `planGate` nesnesi **zorunludur**; yoksa manifest geçersiz |
| `constitution.planGate` `false` ya da yok | Kök `planGate` nesnesi **bulunmamalıdır**; varsa manifest geçersiz |
| `planReviewer`, `codeReviewer` | Nesne varsa **ikisi de zorunlu**; değer bir agent adı ya da `null` |
| `reviewerEcosystem` | Zorunlu; şimdilik tek geçerli değer `"same-as-executor"` |
| Uygunluk | Kapı sahibi olarak verilen agent `writesCode: false` olmalı |
| Erişilebilirlik | Kapı sahibinin **etkin hedefleri**, olası her executor'ın hedeflerini kapsamalı (aşağıya bak) |
| Ad tekilliği | `agents[].name` değerleri benzersiz olmalı |

#### Erişilebilirlik neden manifest seviyesinde tanımlanır

İlk taslak "kapı sahibi, `executor`'ın ekosisteminde üretiliyor olmalı" diyordu. Bu kural
**doğrulayıcıya verilemez**: `executor` plan dosyasına ait bir değerdir, `validate(doc)` ise
yalnız manifest'i görür (`validate-manifest.mjs:19`). Kural manifest verisinden
kurulamadığı için yeniden tanımlandı:

**Kurulum anında (doğrulayıcı):** *olası executor'lar* = `routing[].role` olarak geçen ve
`writesCode: true` olan agent'lar. Her `null` olmayan kapı sahibinin **etkin hedefleri**,
bu executor'ların etkin hedeflerinin **birleşimini kapsamalıdır**. Aksi halde bir iş,
denetleyicisi o ekosistemde bulunmayan bir executor'a düşebilir.

**Çalışma anında (`work-plan` skill'i):** plandaki `executor` gerçek bir kod yazan agent
adı mı, ve o agent'ın etkin hedefleri planın ekosistemini içeriyor mu — bu ikisi orada
denetlenir.

> **Etkin hedef** = `agents[].targets`, yoksa kök `targetsDefault`. Doğrulayıcı zaten bu
> çözümlemeyi yapıyor (`validate-manifest.mjs:57`); spec'in önceki "literal `targets`"
> ifadesi yanlıştı.

Ayrıca doğrulayıcı bugün agent adı tekilliğini denetlemiyor — aynı ad iki kez geçse
`Set`'e sessizce ekleniyor (`validate-manifest.mjs:32-40`). Kapı sahipleri ada göre
çözümlendiği için bu artık bir belirsizlik kaynağıdır; tekillik kuralı eklenir.

Doğrulayıcı bunların hepsini denetler; hata kurulum anında çıkar, çalışma anında değil.

| Adım | Kim | Boşsa |
|---|---|---|
| Plan yazımı | Kod yolunun sahibi developer (`routing[]`) | — |
| **Kapı 1** — plan review | `planGate.planReviewer` | Kapı atlanır, plan doğrudan kullanıcıya |
| **Kapı 2** — onay | **kullanıcı** | — |
| İşletme | `executor` | — |
| **Kapı 3** — kod review | `planGate.codeReviewer` | Kapı atlanır, iş biterken doğrudan kullanıcıya |

> **routing ile çelişki notu.** `routing.md:20` `docs/** → architect` satırını "her zaman
> eklenir" diyor. Architect'siz bir takımda o satır da üretilmez; `routing.md` bu koşulu
> belirtecek şekilde güncellenir. Aksi halde var olmayan bir role yönlendirme kalır.

### Denetim sözleşmesi ve kim yazar (oturum içi)

Repo'nun mevcut kuralları iki şeyi zaten sabitliyor:

- **Reviewer hiçbir dosyaya yazmaz** — `agent-md-rich.md:48` "kod yazmam, dosya
  değiştirmem, yalnız rapor üretirim"; `:65` çalışma klasörü "hiçbiri", `:68` "her şeyi
  okurum, hiçbir şeye yazmam".
- **Reviewer gate'i zaten evrenseldir** — `routing.md:74` "her kod değişikliği
  tamamlandıktan sonra reviewer çağrılır (review olmadan iş 'tamam' sayılmaz)";
  `governance-defaults.md:66` "her çıktı review gate'inden geçer".

Bu yüzden:

**`planGate.codeReviewer` o evrensel gate'in sahibidir.** Ayrı bir kapı kurulmaz ve
sabit `reviewer` adı da kullanılmaz; routing'deki evrensel code-review satırı **bu alandan
üretilir**:

| `codeReviewer` | Sonuç |
|---|---|
| Bir agent adı | Evrensel code-review satırı o ad ile üretilir; denetim sonucu ayrıca plan dosyasına kaydedilir |
| `null` | Evrensel code-review satırı **hiç üretilmez** — o projede kod review kapısı yoktur |

Yani `planGate` açıkken `routing.md:45,74` ve `governance-defaults.md:66`'daki sabit
reviewer referansları bu alana bağlanır. İki ayrı kapı ya da iki ayrı sahip kavramı
kalmaz.

**`.agent-work/` altına yalnız `work-plan` akışını yürüten agent yazar.** Denetleyiciler
(plan reviewer / code reviewer) dosya değiştirmez; yapılandırılmış bir **sonuç** döndürür:

```
verdict:           approved | rejected
reviewed_revision: <planın o anki revision değeri>
reasons:           [kısa madde listesi]   # rejected ise zorunlu
```

`work-plan` bu sonucu `reviews.<kapı>[]`'ya kayıt olarak ekler ve gerekiyorsa dosyayı bir
sonraki klasöre taşır. Denetleyicinin yetkileri değişmez.

> Bu, kapsam dışı bırakılan **çapraz-CLI verdict protokolü değildir**. Burada denetleyici
> aynı oturumda subagent olarak çalışır; sözleşme yalnız cevabın hangi üç alanı taşıması
> gerektiğini söyler. Farklı ekosistemlerin CLI çıktılarını normalize etmek ayrı spec'in
> işidir ve bu üç alan orada da hedef biçim olarak kullanılabilir.

### Kapı 2'nin sunum kuralı

Plan kullanıcıya **sade dille ve somut örnekle** sunulur; ham YAML veya alan adı
gösterilmez (`team-builder-setup`'ın "JARGON YASAĞI" ilkesi). Kullanıcıya giden plan
**kapı 1'den geçmiş, düzeltilmiş** plandır.

### Eşik: yok

Her iş plan kapısından geçer. Kaçış **kullanıcıdadır** ("plansız yap"), agent'ta değildir.

### Havuz seçmelidir

`approved/` bir havuzdur, FIFO değil. Kullanıcı bir tanesini ya da birkaçını seçer.

## Veri modeli

### `inbox/` kaydı

```yaml
---
title: Kupon alanında doğrulama eksik
created: 2026-08-02
source: agent:backend-developer      # user | agent:<ad>
---
```

Gövde iki-üç cümle. Analiz edilmemiştir.

### Plan dosyası

```yaml
---
title: Kupon alanına doğrulama ekle
revision: 3
domain: backend
paths: [apps/api/src/coupon/**]
created: 2026-08-02
source: agent:backend-developer
executor: claude/backend-developer
reviews:
  plan-review:
    - { by: claude/architect, at: 2026-08-02, revision: 2, verdict: rejected, reason: "kabul kriteri ölçülemez" }
    - { by: claude/architect, at: 2026-08-03, revision: 3, verdict: approved }
  code-review: []
adr: docs/mimari/backend/adr/0003-kupon-dogrulama.md
---
```

| Alan | Anlamı |
|---|---|
| `revision` | Planlama içeriğinin sürümü; **1'den başlar**, zorunlu |
| `domain`, `paths` | Hangi projeye/modüle ait |
| `source` | Kaydı kim açtı |
| `executor` | İşin sahibi — `<ekosistem>/<rol>` |
| `reviews.<kapı>[]` | O kapının karar geçmişi (silinmez, birikir) |
| `adr` | Kalıcı karar çıktıysa ADR bağlantısı |

#### Kayıt şeması (normatif)

Her `reviews.<kapı>[]` girdisi tek bir şemaya uyar:

```yaml
{ by: <ekosistem>/<rol> | system, at: <YYYY-MM-DD>, revision: <n>,
  verdict: approved | rejected | skipped, reasons: [<madde>, ...] }
```

| Alan | Kural |
|---|---|
| `by` | Denetleyen agent; **`skipped` kayıtlarında `system`** |
| `at` | Kayıt tarihi |
| `revision` | Kaydın verildiği andaki `plan.revision` |
| `verdict` | Üç değerden biri |
| `reasons` | **Her zaman dizi.** `rejected` ise boş olamaz; diğerlerinde boş olabilir |

**Denetleyici çıktısı → kayıt eşlemesi:** denetleyici `{verdict, reviewed_revision,
reasons}` döndürür; `work-plan` `by`'yi çözümlenmiş kapı sahibinden, `at`'i tarihten üretir,
`revision` alanına `reviewed_revision`'ı yazar. `reviewed_revision` o an diskteki
`plan.revision`'dan farklıysa kayıt **yazılmaz** — plan denetim sırasında değişmiştir,
denetim tekrarlanır.

#### `revision` neyi sayar

Onayın hangi içeriğe verildiğini bilmek için planın kendi sürüm numarası gerekir. Ama her
dosya değişikliği onayı bozmamalı — yoksa ilerleme notu yazmak plan onayını düşürürdü.

**`revision`'ı artıran değişiklikler:** `title`, `domain`, `paths`, **`executor`**, ve
`## İlerleme` ile `## Denetim notları` **dışındaki her gövde bölümü**.

`executor` bilerek bu listededir: işi kimin yapacağı değişmişse plan onayı da o değişikliği
görmemiştir.

**Artırmayan değişiklikler** (defter tutma): `## İlerleme`, `## Denetim notları`, `reviews`,
`adr`, ve dosyanın klasörler arasında taşınması.

#### Bir kapı ne zaman geçilmiş sayılır

Kural **yapılandırmaya duyarlıdır** — kapının o anki sahibine bakar:

| Kapı sahibi | Geçilmiş sayılma koşulu |
|---|---|
| Bir agent adı | Son kayıt `approved`, `kayıt.revision === plan.revision`, **ve** `kayıt.by` güncel çözümlenmiş sahiple aynı |
| `null` | Son kayıt `skipped`, `kayıt.revision === plan.revision`, **ve** sahip hâlâ `null` |

`by` karşılaştırması şart: kapı sahibi kurulumdan sonra değiştirilirse eski denetleyicinin
onayı geçerli kalmamalıdır.

Bu kural dört durumu birden çözer: bekliyor, reddedildi, onay bayatladı, denetleyici değişti.

#### Revizyon geçerliliği yalnız plan review'a uygulanır

Plan `revision`'ı **planlama içeriğini** tanımlar, yazılan kodu değil. Bu yüzden kod
review onayı bir revizyona bağlanamaz — plan hiç değişmeden kod değişebilir.

**Kod review onayı tek seferlik yetkidir:** yalnız o andaki `in-progress/ → done/`
hareketini yetkilendirir. İş `done/`'a gitmeden kesilir ve sonra devam ederse, kod review
**yeniden çalıştırılır**; eski kayıt geçmiş olarak durur ama yetki vermez.

**Kayıtlar asla silinmez (Codex bulgu 5).** Reddedilen bir kapının kaydı kalır ve red
gerekçesi görünür olur. `verdict` üç değer alır:

| `verdict` | Anlamı |
|---|---|
| `approved` | Kapı geçildi |
| `rejected` | Reddedildi; `reason` zorunlu, gerekçe `## Denetim notları`'na da yazılır |
| `skipped` | O kapının sahibi `null`; kayıt "bu kapı yoktu" der, sessiz atlama olmaz |

### Plan gövdesi — zorunlu bölümler (Codex bulgu D)

Şablon serbest metin değildir; denetleyici tanımsız bir gövdeyi tutarlı denetleyemez.
`TEMPLATE.md` şu bölümleri zorunlu tutar:

| Bölüm | İçerik | `revision` artırır mı |
|---|---|---|
| `## Ne ve neden` | Sade dille, örnekle. **Kabul kriteri** burada. | Evet |
| `## Nasıl` | Yaklaşım, etkilenen bileşenler, riskler | Evet |
| `## Açık sorular` | Yoksa "yok" yazılır — boş bırakılmaz | Evet |
| `## Denetim notları` | Kapıların red gerekçeleri ve kullanıcı geri bildirimi | Hayır |
| `## İlerleme` | `in-progress/`'e geçince doldurulur (aşağıya bak) | Hayır |

**Kapı 1'in reddetme ölçütleri:** kabul kriteri yok/ölçülemez, etkilenen yollar
`paths` ile tutarsız, açık soru cevapsız bırakılmış, yaklaşım mevcut bir ADR'ye aykırı.

### Yarım kalan iş (Codex bulgu 8 — çözüm)

`in-progress/` tek başına "başladı" der, nerede kaldığını söylemez. Plan gövdesindeki
`## İlerleme` bölümü şunları tutar:

```markdown
## İlerleme
- **Son durum:** kupon doğrulaması yazıldı, testler eksik
- **Sıradaki adım:** boş-kupon senaryosu için test
- **Engel:** yok
- **Dokunulan yerler:** apps/api/src/coupon/validate.ts
```

Bu bölüm `in-progress/`'e taşınırken açılır ve iş her bırakıldığında güncellenir. Amaç
başka bir oturumun kaldığı yerden devam edebilmesidir.

### Çoklu domain (Codex bulgu E — çözüm)

Bir planın **tek bir `executor`'ı** vardır: işin sahibi. `paths` birden fazla domain'e
dokunabilir; sahibi kendi alanı dışına çıkıyorsa o alanın developer'ına **danışır** —
bu, routing'in mevcut `consults` zinciridir, yeni kavram değil. İş gerçekten iki bağımsız
parçaya ayrılıyorsa **iki ayrı plan** yazılır. Path→executor eşlemesi ve per-executor
ilerleme takibi bilinçli olarak kapsam dışıdır (YAGNI).

### Konum: kökte tek havuz

Planlar repo kökünde tek `.agent-work/` altında toplanır. Gerekçe: bir plan birden fazla
projeye dokunabilir; havuz merkezi olmak zorundadır; `domain`/`paths` filtrelemeyi
karşılar; `.agent-memory/` emsali de kökte tek.

## Commit kapsamı

`.agent-work/` tamamen commit edilir — `inbox/` dahil.

## Sınır durumları

| Durum | Davranış |
|---|---|
| `planReviewer` boş | Kapı 1 atlanır; plan doğrudan kullanıcıya |
| `codeReviewer` boş | Kapı 3 atlanır; iş biterken doğrudan kullanıcıya |
| Plan review sonrası gövde değişti | `revision` artar, o kapının kaydı geçersizleşir, yeniden geçer; kullanıcı "gerek yok" diyebilir |
| Plan reddedildi | `draft/`'ta kalır; `rejected` kaydı **durur** (silinmez), sonraki kayıt onu geçersiz kılar; gerekçe `## Denetim notları`'na |
| İş yarıda kaldı | `in-progress/`'te kalır; `## İlerleme` nerede kalındığını söyler |
| Preset kapalıyken skill çağrıldı | "Plan kapısı bu projede kapalı. Açmak kurulum sonrası bir işlemdir ve proje-yükseltme skill'i gerektirir." der — var olmayan komuta yönlendirmez |
| `.agent-work/` yok | İskeleti kurmayı teklif eder |

## Doğrulama

**Sorumluluk ayrımı (Codex bulgu I).** Manifest tipi/şeması doğrulayıcının, dosya üretimi
generator'ın, iskelet ve şablonlar sihirbazın işidir.

**`validate-manifest.mjs --selftest`:**
1. `constitution.planGate` boolean; string reddedilir; `true` ve `false` kabul edilir.
2. `planGate: true` ama kök `planGate` nesnesi yok → reddedilir.
3. `planGate` `false`/yok ama kök nesne var → reddedilir.
4. Kök nesnede `planReviewer` ya da `codeReviewer` eksik → reddedilir; `null` kabul edilir.
5. Kapı sahibi tanımsız bir agent adı → reddedilir.
6. Kapı sahibi `writesCode: true` olan bir agent → reddedilir.
7. Kapı sahibi, `executor`'ın ekosisteminde üretilmiyor (`targets` içermiyor) → reddedilir.
8. `reviewerEcosystem` eksik ya da `"same-as-executor"` dışında → reddedilir.

**`sync-agent-config.mjs --selftest`:**
9. `.agent-source/skills/work-plan/` kaynağı ekosistem skill dizinlerine mirror'lanır.
10. `.agent-work/` içine konan dosya sync sonrası yerinde durur, `--check` temiz çıkar ve
    ledger'da görünmez — generator o dizini hiç sahiplenmez.

**Sihirbaz çıktısı (elle kabul listesi):**
11. Preset açık kurulumda: `.agent-work/` + beş alt dizin, `README.md`, `TEMPLATE.md`,
    `.agent-source/skills/work-plan/SKILL.md` oluşur ve **metinleri `docLanguage` dilindedir**.
12. Preset kapalı kurulumda: hiçbiri oluşmaz, hiçbir mirror üretilmez, `.agent-work/` yoktur.
    `TEMPLATE.md`'nin zorunlu bölümleri yalnız `templates/plan.md` üzerinden denetlenir.

> **Preset kapalıyken skill davranışı test edilmez (Codex bulgu 2).** Preset kapalı
> kurulumda `work-plan` skill'i hiç kurulmaz, dolayısıyla çağrılamaz — "kapalıyken doğru
> mesajı ver" diye bir senaryo mantıksızdır. Skill'in o mesajı yalnız **tek bir gerçek
> durumda** anlamlıdır: skill kurulu (preset açık kurulmuş) ama sonradan manifest'te
> `planGate` `false` yapılmış. R10 bu duruma göre yazılmıştır.

**Runtime senaryo matrisi.** `work-plan` skill'i insan tarafından şu senaryolarla kabul
edilir; her biri bir kez elle yürütülüp doğrulanır:

| # | Senaryo | Beklenen |
|---|---|---|
| R1 | Yeni iş, plan yazılır | `draft/`'ta dosya, zorunlu bölümler dolu, `revision: 1` |
| R2 | Kapı 1 onaylar | `reviews.plan-review` += approved (revision eşleşir), kullanıcıya sade özet |
| R3 | Kapı 1 reddeder | `draft/`'ta kalır, kayıt `rejected` + `reason`, gerekçe `## Denetim notları`'nda |
| R4 | Red sonrası düzeltilir | `revision` artar, kapı 1 yeniden geçilir |
| R5 | Kullanıcı onaylar | `approved/`'a taşınır |
| R6 | Kullanıcı değişiklik ister | `draft/`'ta kalır, geri bildirim `## Denetim notları`'nda |
| R7 | Onaylı planın gövdesi değişir | `revision` artar, kapı 1 onayı bayatlar, yeniden geçilmesi gerekir |
| R8 | `## İlerleme` güncellenir | `revision` **artmaz**, hiçbir onay bayatlamaz |
| R9 | Havuzdan iki iş seçilir | İkisi `in-progress/`'e geçer, sıra dayatılmaz |
| R10 | Skill kurulu ama `planGate` sonradan `false` yapılmış | "Bu projede plan kapısı kapalı; açmak proje-yükseltme skill'i gerektirir" der; var olmayan komuta yönlendirmez |
| R11 | İş yarıda bırakılır, yeni oturum | `## İlerleme`'den kaldığı yer okunur |
| R12 | Kapı 3 onaylar | `done/`'a taşınır |
| R13 | Kapı 3 reddeder | `in-progress/`'te kalır, gerekçe `## Denetim notları`'nda |
| R14 | `planReviewer: null` | Kapı 1 atlanır, `reviews.plan-review` += `skipped`, akış kullanıcıya gider |
| R15 | `codeReviewer: null` | Kapı 3 atlanır, `skipped` kaydı düşer, iş kullanıcı onayıyla `done/`'a gider |
| R16 | İş iptal edilir | `done/`'a taşınır, `outcome: cancelled`, gerekçe `## Denetim notları`'nda |
| R17 | `.agent-work/` yok, skill çağrılır | İskeleti kurmayı teklif eder |
| R18 | Kullanıcı "plansız yap" der | Hiç plan dosyası oluşmaz, `.agent-work/`'e yazılmaz |
| R19 | `approved/`'daki planın `## Nasıl` bölümü değişir | `revision` artar, dosya `draft/`'a döner, kapı 1 yeniden geçilir |
| R20 | `in-progress/`'teki planın `executor`'ı değişir | `revision` artar, `draft/`'a döner, `## İlerleme` korunur |
| R21 | Kod review onaylandı, iş `done/`'a gitmeden kesildi, sonra devam edildi | Kod review **yeniden** çalıştırılır; eski kayıt yetki vermez |
| R22 | Kapı sahibi kurulumdan sonra değiştirildi | Eski sahibin onayı geçersiz sayılır, yeni sahiple yeniden geçilir |
| R23 | Denetleyici, plan denetim sırasında değişmişken sonuç döndürür | `reviewed_revision` uyuşmaz, kayıt yazılmaz, denetim tekrarlanır |
| R24 | `inbox/` kaydı iptal edilir | Silinir; `done/`'a taşınmaz |

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Anayasa preseti + projeye kurulan skill; hook değil | Hook Claude'a özgü; çok hedefli repoda kapı tek ekosistemde çalışırdı |
| 2 | Preset default kapalı, **ayrı soruda** sorulur | Artefakt üretiyor; ayrıca 4-seçenek sınırıyla çakışmaz |
| 3 | `plan-gate.md` = kurulum sözleşmesi, skill = runtime prosedürü | Aynı kural iki yerde anlatılırsa drift olur |
| 4 | Kapı sahipleri manifest'te ad olarak yazılır, değişmezleri normatif | Rol adları özelleştirilebilir; `writesCode:false` tek başına ayırt etmiyor |
| 5 | Denetleyici, `executor`'ın ekosisteminde çalışır; `reviewerEcosystem` şimdi tanımlanır | İkinci faz alan **eklesin**, konfigürasyonun şeklini değiştirmesin |
| 6 | `planGate.codeReviewer` yeni kapı kurmaz; mevcut evrensel reviewer gate'ini işaret eder ve sonucunu kaydeder | `routing.md:74` ve `governance-defaults.md:66` o gate'i zaten zorunlu kılıyor |
| 7 | `.agent-work/`'e yalnız `work-plan` akışı yazar; denetleyiciler sonuç döndürür | `agent-md-rich.md:48,63` reviewer'a hiçbir yazma alanı vermiyor |
| 8 | `revision` planlama içeriğini sayar; ilerleme ve defter tutma artırmaz | Aksi halde ilerleme notu yazmak plan onayını düşürürdü |
| 9 | Kapı geçildi = son kayıt `approved` **ve** revision eşleşiyor | Tek kural bekliyor/reddedildi/bayatladı üçünü birden çözer |
| 10 | Karar kayıtları silinmez; `approved\|rejected\|skipped` | Boş dizi üç farklı durumu ayıramıyordu |
| 11 | Durum = klasör; `in-progress/` + gövdede `## İlerleme` | Klasör "başladı"yı, bölüm "nerede kaldı"yı söyler |
| 12 | Tek `executor`; çoklu domain'de danışma, gerekirse plan bölünür | Path→executor eşlemesi yeni kavram getirir, YAGNI |
| 13 | Gövdenin zorunlu bölümleri ve kapı 1'in reddetme ölçütleri tanımlı | Denetleyici tanımsız gövdeyi tutarlı denetleyemez |
| 14 | Eşik yok, kaçış kullanıcıda ve izlenmez | Eşik kararını agent verirse kapı sessizce atlanır |
| 15 | Tüm insan-okur çıktılar `docLanguage`'de üretilir | Sihirbazın kendi dil sözleşmesi |
| 16 | Preset açma/kapama proje-yükseltme skill'ine ait | `sync` yeni kaynak yaratmıyor; buradaki talimat yanlış olurdu |
| 17 | Preset kapalıyken skill davranışı test edilmez | Skill hiç kurulmadığı için çağrılamaz; R10 gerçek duruma göre yazıldı |
| 18 | Çapraz ekosistem ayrı spec | Verdict protokolü başlı başına iş; çekirdek ona bağlı kalmamalı |
