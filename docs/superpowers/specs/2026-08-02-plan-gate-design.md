# Tasarım: Plan Kapısı ve İş Havuzu (`planGate`) — çekirdek

- **Tarih:** 2026-08-02 (revize: 2026-08-07)
- **Durum:** Onaylandı — uygulama planı bekliyor
- **Kapsam:** 5. anayasa preseti olarak plan kapısı + onaylanmış iş havuzu, **tek ekosistem içinde**

> **Revizyon notu (2. tur).** İlk sürüm Codex review'ından 11, revize sürüm 13 bulgu aldı.
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

Bu spec **tek ekosistem içinde** çalışır: kapılar projenin kendi agent'larıyla, aynı
oturumda (subagent olarak) yürütülür. Harici CLI çağrısı yoktur.

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
| `routing.md` | `.agent-work/**` sahipliği notu |
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

**2. Şablon `docs/` altına konmaz.** Routing'de `docs/** → architect` kuralı her zaman
eklenir; şablon `docs/` altında olsaydı planı yazacak developer kendi şablonuna erişemezdi.

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

| Adım | Kim | Boşsa |
|---|---|---|
| Plan yazımı | Kod yolunun sahibi developer (`routing[]`) | — |
| **Kapı 1** — plan review | `planGate.planReviewer` | Kapı atlanır, plan doğrudan kullanıcıya |
| **Kapı 2** — onay | **kullanıcı** | — |
| İşletme | `executor` | — |
| **Kapı 3** — kod review | `planGate.codeReviewer` | Kapı atlanır, iş biterken doğrudan kullanıcıya |

> **routing ile çelişki notu.** `routing.md:18` `docs/** → architect` satırını "her zaman
> eklenir" diyor. Architect'siz bir takımda o satır da üretilmez; `routing.md` bu koşulu
> belirtecek şekilde güncellenir. Aksi halde var olmayan bir role yönlendirme kalır.

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
domain: backend
paths: [apps/api/src/coupon/**]
created: 2026-08-02
source: agent:backend-developer
executor: claude/backend-developer
reviews:
  plan-review:
    - { by: claude/architect, at: 2026-08-02, revision: 3, verdict: approved }
  code-review: []
adr: docs/mimari/backend/adr/0003-kupon-dogrulama.md
---
```

**`reviews` kapı bazlıdır (Codex bulgu F).** Düz bir `reviewed_by` listesi plan review ile
kod review'ı ayıramaz — özellikle aynı agent iki kapıya da bakıyorsa. Her kayıt hangi
revizyonu onayladığını taşır; plan gövdesi değişince `revision` artar ve o kapının kaydı
geçersizleşir.

| Alan | Anlamı |
|---|---|
| `domain`, `paths` | Hangi projeye/modüle ait |
| `source` | Kaydı kim açtı |
| `executor` | İşin sahibi — `<ekosistem>/<rol>` |
| `reviews.<kapı>[]` | O kapıdan kim, hangi revizyonda, hangi kararla geçirdi |
| `adr` | Kalıcı karar çıktıysa ADR bağlantısı |

### Plan gövdesi — zorunlu bölümler (Codex bulgu D)

Şablon serbest metin değildir; denetleyici tanımsız bir gövdeyi tutarlı denetleyemez.
`TEMPLATE.md` şu bölümleri zorunlu tutar:

| Bölüm | İçerik |
|---|---|
| `## Ne ve neden` | Sade dille, örnekle. **Kabul kriteri** burada. |
| `## Nasıl` | Yaklaşım, etkilenen bileşenler, riskler |
| `## Açık sorular` | Yoksa "yok" yazılır — boş bırakılmaz |
| `## İlerleme` | `in-progress/`'e geçince doldurulur (aşağıya bak) |

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
| Plan reddedildi | `draft/`'ta kalır, `reviews.plan-review` temizlenir, red gerekçesi gövdeye yazılır |
| İş yarıda kaldı | `in-progress/`'te kalır; `## İlerleme` nerede kalındığını söyler |
| Preset kapalıyken skill çağrıldı | "Plan kapısı bu projede kapalı. Açmak kurulum sonrası bir işlemdir ve proje-yükseltme skill'i gerektirir." der — var olmayan komuta yönlendirmez |
| `.agent-work/` yok | İskeleti kurmayı teklif eder |

## Doğrulama

**Sorumluluk ayrımı (Codex bulgu I).** Manifest tipi/şeması doğrulayıcının, dosya üretimi
generator'ın, iskelet ve şablonlar sihirbazın işidir.

**`validate-manifest.mjs --selftest`:**
1. `constitution.planGate` boolean; string reddedilir; `true` ve `false` kabul edilir.
2. `planGate.planReviewer` / `codeReviewer` verilmişse manifest'teki gerçek agent adları
   olmalı; tanımsız ad reddedilir; `null` kabul edilir.

**`sync-agent-config.mjs --selftest`:**
3. `.agent-source/skills/work-plan/` kaynağı ekosistem skill dizinlerine mirror'lanır.
4. `.agent-work/` içine konan dosya sync sonrası yerinde durur, `--check` temiz çıkar ve
   ledger'da görünmez — generator o dizini hiç sahiplenmez.

**Sihirbaz çıktısı (elle kabul listesi):**
5. Preset açık kurulumda: `.agent-work/` + beş alt dizin, `README.md`, `TEMPLATE.md`,
   `.agent-source/skills/work-plan/SKILL.md` oluşur ve **metinleri `docLanguage` dilindedir**.
6. Preset kapalı kurulumda: hiçbiri oluşmaz, hiçbir mirror üretilmez.

**Runtime senaryo matrisi (Codex bulgu G).** `work-plan` skill'i insan tarafından şu
senaryolarla kabul edilir — her biri bir kez elle yürütülüp doğrulanır:

| # | Senaryo | Beklenen |
|---|---|---|
| R1 | Yeni iş, plan yazılır | `draft/`'ta dosya, zorunlu bölümler dolu |
| R2 | Kapı 1 onaylar | `reviews.plan-review` kaydı düşer, kullanıcıya sade özet sunulur |
| R3 | Kapı 1 reddeder | `draft/`'ta kalır, gerekçe gövdede |
| R4 | Kullanıcı onaylar | `approved/`'a taşınır |
| R5 | Onay sonrası gövde değişir | `revision` artar, kapı 1 kaydı geçersizleşir |
| R6 | Havuzdan iki iş seçilir | İkisi `in-progress/`'e geçer, sıra dayatılmaz |
| R7 | İş yarıda bırakılır, yeni oturum açılır | `## İlerleme`'den kaldığı yer okunur |
| R8 | Kapı 3 onaylar | `done/`'a taşınır |
| R9 | `planReviewer: null` | Kapı 1 atlanır, akış kullanıcıya gider |
| R10 | Preset kapalı, skill çağrılır | Doğru mesaj, var olmayan komuta yönlendirme yok |

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Anayasa preseti + projeye kurulan skill; hook değil | Hook Claude'a özgü; çok hedefli repoda kapı tek ekosistemde çalışırdı |
| 2 | Preset default kapalı, **ayrı soruda** sorulur | Artefakt üreten tek kural; ayrıca 4-seçenek sınırı ile çakışmaz |
| 3 | `plan-gate.md` = kurulum sözleşmesi, skill = runtime prosedürü | Aynı kural iki yerde anlatılırsa drift olur |
| 4 | Kapı sahipleri manifest'te ad olarak yazılır | Rol adları özelleştirilebilir; `writesCode:false` tek başına ayırt etmiyor |
| 5 | Durum = klasör; `in-progress/` + gövdede `## İlerleme` | Klasör "başladı"yı, bölüm "nerede kaldı"yı söyler |
| 6 | Tek `executor`; çoklu domain'de danışma, gerekirse plan bölünür | Path→executor eşlemesi yeni kavram getirir, YAGNI |
| 7 | `reviews` kapı bazlı ve `revision` taşır | Düz liste plan/kod review'ı ayıramaz, bayatlığı da anlamaz |
| 8 | Gövdenin zorunlu bölümleri var | Denetleyici tanımsız gövdeyi tutarlı denetleyemez |
| 9 | Eşik yok, kaçış kullanıcıda | Eşik kararını agent verirse kapı sessizce atlanır |
| 10 | Tüm insan-okur çıktılar `docLanguage`'de üretilir | Sihirbazın kendi dil sözleşmesi |
| 11 | Preset açma/kapama proje-yükseltme skill'ine ait | `sync` yeni kaynak yaratmıyor; buradaki talimat yanlış olurdu |
| 12 | Çapraz ekosistem ayrı spec | Verdict protokolü başlı başına iş; çekirdek ona bağlı kalmamalı |
