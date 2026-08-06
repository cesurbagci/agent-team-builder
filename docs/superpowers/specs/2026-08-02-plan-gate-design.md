# Tasarım: Plan Kapısı ve İş Havuzu (`planGate`)

- **Tarih:** 2026-08-02 (revize: 2026-08-04)
- **Durum:** Onaylandı — uygulama planı bekliyor
- **Kapsam:** team-builder'a 5. anayasa preseti olarak plan kapısı + onaylanmış iş havuzu + çapraz ekosistem çağırma

> **Revizyon notu.** İlk sürüm Codex review'ından 11 bulgu aldı. Bu sürüm hepsini
> karşılıyor. İki şey de değişti: (a) generated-file ledger'ı geldi, bu yüzden preset
> kapatıldığında ortada kalan skill mirror'ları artık `(stale)` olarak raporlanıyor;
> (b) çapraz ekosistem çağırma mekanizması doğrulandı ve bu tasarımın kapsamına alındı.

## Problem

team-builder bir takım kuruyor (architect, domain developer'lar, reviewer), aralarına
zorunlu routing ve danışma zinciri koyuyor. Ama **bir işin bu roller arasında nasıl
aktığına** dair hiçbir şey üretmiyor. Sonuç:

- Agent işe girişip yanlış yaklaşımla kod yazıyor; bu ancak sonuç çıkınca fark ediliyor.
- Kullanıcının onayı olmadan iş ilerliyor.
- Yarım kalan iş, verilen kararlar ve nerede kalındığı oturumlar arasında kayboluyor.

Mevcut tek denetim noktası kod review'ı — yani reviewer devreye girdiğinde ortada zaten
yazılmış kod var. Yaklaşım baştan yanlışsa o emek çöpe gidiyor.

**Bu tasarımın çözdüğü dert:** kod yazılmadan önce yaklaşımın hem bir agent hem kullanıcı
tarafından onaylanması; onaylanmış işlerin kaybolmadan bir havuzda birikip istendiğinde
işletilebilmesi; ve birden fazla ekosistem kuruluysa denetimin istenen provider'ın
agent'ına yaptırılabilmesi.

## Kapsam

| | Alt sistem | Durum |
|---|---|---|
| **A** | Plan kapısı — plan yazımı, architect denetimi, kullanıcı onayı | **Bu spec** |
| **D** | Havuz — onaylanmış işlerin birikmesi ve seçilerek işletilmesi | **Bu spec** |
| **B** | Çapraz ekosistem çağırma — başka provider'ın agent'ını çalıştırmak | **Bu spec** (mekanizma doğrulandı) |
| **C** | Inbox'ın dış sisteme (Jira vb.) bağlanması | Ayrı spec |

`inbox/` dizini ve ham kayıt formatı burada tanımlanıyor; **dış sistem entegrasyonu** C'ye
ait.

## Mimari

Mekanizma iki parçalı: **kural anayasada, prosedür skill'de.**

### Tek otorite ayrımı (Codex bulgu 2)

İlk sürüm hem `plan-gate.md`'yi hem skill'i "prosedürün tek otoritesi" ilan ediyordu ve
adımları ikisine birden kopyalıyordu — tam da önlemek istediği drift. Ayrım artık net:

| Doküman | Kim okur | Ne anlatır |
|---|---|---|
| `team-builder-shared/plan-gate.md` | **Sihirbaz** (kurulum anında) | Kurulum sözleşmesi: hangi dizin/dosyalar üretilir, frontmatter şeması, öncelik katmanları. **Runtime adımlarını anlatmaz.** |
| Projeye kurulan `work-plan` skill'i | **Projede çalışan agent** (her iş anında) | Runtime prosedürü: planı kim yazar, kapılardan nasıl geçer, havuz nasıl işletilir |

Aynı kural iki yerde anlatılmaz. Agent md gövdeleri de adımları tekrar etmez; "bu projede
plan kapısı açık, prosedür `work-plan` skill'inde" der.

### Neden hook değil

`PreToolUse` hook'u ile Edit/Write çağrısını engellemek daha zorlayıcı olurdu, ama Claude
Code'a özgü; Codex ve OpenCode'da karşılığı yok. Çok hedefli bir repoda kapı yalnız bir
ekosistemde çalışır — "kapı var sanmak, yokken" en kötü senaryo.

### team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `constitution.md` | KARAR 5 — `planGate` (default **KAPALI**); "default her zaman true" iddiası düzeltilir |
| `plan-gate.md` *(yeni)* | Kurulum sözleşmesi + veri modeli (runtime adımları **değil**) |
| `templates/plan.md` *(yeni)* | Plan şablonu iskeleti |
| `templates/work-plan-skill.md` *(yeni)* | Projeye kurulacak skill'in şablonu |
| `templates/agent-invoke-skill.md` *(yeni)* | Çapraz ekosistem çağırma skill'inin şablonu |
| `team-builder-setup/SKILL.md` | 5. toggle; "tam 4 kural" soru kuralı; Adım 8a üretim adımları |
| `agent-md-rich.md` | developer ve architect gövdelerine `## Plan Kapısı` bölümü |
| `manifest-schema.md` | `constitution.planGate`; "4 preset, tümü default true" düzeltilir |
| `validate-manifest.mjs` | `planGate` boolean |
| `wizard-state.md` | constitution örneği 5 alana çıkar |
| `README.md` (iki dil) | "all on by default" düzeltilir |
| `routing.md` | `.agent-work/**` sahipliği notu |
| `canonical-source.md` | `.agent-work/` generated değildir |
| `sync-pipeline.md` | `.agent-work/` sync kapsamı dışıdır |

> **Codex bulgu 3 ve 4:** ilk sürüm yalnız `constitution.md`'nin bir cümlesini
> düzeltiyordu. `manifest-schema.md`, `wizard-state.md`, `README.md` ve
> `team-builder-setup/SKILL.md`'deki "tam 4 kural → tek multiSelect (4 seçenek)" kuralı da
> beşinci presete göre güncellenmelidir; aksi halde şema dokümanı "tümü default true" der
> ve sihirbazın soru kuralı 4 seçenek sınırıyla çakışır.

### Projede üretilecekler (preset açıkken, setup bir kez)

```
.agent-work/                     ← generated DEĞİL; agent'ların çalışma alanı
├── README.md
├── TEMPLATE.md                  ← plan şablonu
├── agent.local.json             ← makine-yerel; .gitignore'da
├── inbox/                       ← ham kayıt
├── draft/                       ← plan yazıldı
├── approved/                    ← onaylandı; havuz
├── in-progress/                 ← işletiliyor
└── done/                        ← bitti (arşiv)

.agent-source/skills/work-plan/SKILL.md      ← generated; ekosistem skill dizinlerine mirror
.agent-source/skills/agent-invoke/SKILL.md   ← generated; aynı şekilde
```

Ayrıca setup, projenin `.gitignore`'una `.agent-work/agent.local.json` satırını ekler.

### Üç kritik kısıt

**1. `.agent-work/` generated değildir.** `.agent-memory/` ile aynı sınıfta. `sync` onu
üretmez, drift kontrolüne sokmaz. Setup yalnız boş iskeleti bir kez kurar.

**2. Şablon `docs/` altına konmaz.** `templates/plan.md` projede `.agent-work/TEMPLATE.md`
olur. Sebep: routing'de `docs/** → architect` kuralı her zaman eklenir; şablon `docs/`
altında olsaydı planı yazacak developer kendi şablonuna erişemezdi.

**3. Şablonlar `docLanguage` dilinde üretilir (Codex bulgu 9).** `team-builder-setup`
"üretilen tüm metinler `docLanguage` dilinde" diyor. Bu yüzden `templates/plan.md` ve
`templates/work-plan-skill.md` **verbatim kopyalanmaz**; sihirbaz aynı yapıyı projenin
`docLanguage`'inde üretir. Şablonlar Türkçe referanstır, çıktı değil.

### Preset kapatma (Codex bulgu 1)

`/team-builder-edit` diye bir skill **yoktur** — repoda üç skill var (`setup`, `sync`,
`architecture-advisor`) ve mevcut SKILL.md'ler var olmayan komutlara yönlendiriyor. Bu
tasarım o eksiği kapatmaz; bu yüzden kapatma yolu şudur:

`manifest.constitution.planGate` `false` yapılır ve `sync` çalıştırılır. `work-plan` ve
`agent-invoke` skill kaynakları `.agent-source/skills/`'ten silinirse, generated
mirror'ları **generated-file ledger'ı sayesinde `(stale)` olarak raporlanır** ve kullanıcı
onları siler. `.agent-work/` dizinine dokunulmaz — içindeki planlar kullanıcınındır.

`work-plan` skill'i, preset kapalıyken çağrılırsa bunu söyler; var olmayan bir komuta
yönlendirmez.

> **Planlanan ayrı iş:** mevcut projeleri team-builder'ın son sürümüne yükselten bir skill
> yazılacak (manifest migration'ı — örn. eksik `targetsDefault` — ekosistem ekleme, rol
> ekleme, preset açma/kapama). O geldiğinde preset kapatma oraya taşınabilir. Bu spec o
> skill'e bağımlı değildir ve onsuz da tamamdır; yukarıdaki elle yol geçerli kalır.

## Yaşam döngüsü

```
inbox/        ham kayıt (yan bulgu, sonradan akla gelen)
   │ analiz
   ▼
draft/        plan yazıldı ── kapı 1: gates.plan-review ──┐
   ▲                                                      │
   │ plan değişti → reviewed_by düşer                     ▼
   └───────────────────────────────── kapı 2: kullanıcı onayı
                                                          │
                                                          ▼
approved/     havuz — kullanıcı bir/birkaçını seçip işletir
                                                          │ seçildi
                                                          ▼
in-progress/  kod yazılıyor ── kapı 3: gates.code-review ─┐
                                                          ▼
done/         arşiv (+ kalıcı karar çıktıysa ADR)
```

**Durum = bulunduğu klasör.** Frontmatter'da `status` alanı yoktur.

`in-progress/` (Codex bulgu 8) sayesinde "hiç başlamadı" ile "yarıda kaldı" ayrılır:
`approved/` bekleyen iş, `in-progress/` başlamış iş demektir. Yarım kalan iş
`in-progress/`'te durur ve `executor` alanı kimin devam edeceğini söyler.

### Roller ve kapılar

| Adım | Kim | Rol takımda yoksa |
|---|---|---|
| Plan yazımı | Kod yolunun sahibi developer (`routing[]`) | — |
| **Kapı 1** — plan review | **architect** | Kapı atlanır, plan doğrudan kullanıcıya gider |
| **Kapı 2** — onay | **kullanıcı** | — |
| İşletme | `executor` alanındaki developer | — |
| **Kapı 3** — kod review | **reviewer** | Kapı atlanır, iş biterken doğrudan kullanıcı onayına gider |

Kapı 1'in architect'e ait olması bilinçlidir: plan review'ının sorusu "bu doğru yaklaşım
mı" — mimari bir yargı. Reviewer'ı plan aşamasına da sokmak onun asıl kapısını sulandırır.

**Rol adları sabit varsayılmaz (Codex bulgu 7).** Sihirbaz özel rol adlarına izin verir.
`gates` listeleri manifest'teki gerçek agent adlarından üretilir; "architect"/"reviewer"
sabit metinleri şablona gömülmez. Developer, ad kalıbıyla değil `writesCode: true` +
routing sahipliğiyle belirlenir.

### Kapı 2'nin sunum kuralı

Plan kullanıcıya **sade dille ve somut örnekle** sunulur; ham YAML veya alan adı
(`gates`, `executor`, `paths`) gösterilmez. Bu, `team-builder-setup`'taki "JARGON YASAĞI"
ilkesinin devamıdır. Kullanıcıya giden plan **kapı 1'den geçmiş, düzeltilmiş** plandır.

### Eşik: yok

**Her iş plan kapısından geçer.** Kaçış kullanıcıdadır: "plansız yap" derse atlanır. Kaçış
agent'ta değildir — eşik kararını agent verirse kapı sessizce atlanır.

### Havuz seçmelidir

`approved/` bir havuzdur, FIFO kuyruk değil. Kullanıcı bir tanesini ya da birkaçını seçip
işletir.

## Veri modeli

### `inbox/` kaydı

```yaml
---
title: Kupon alanında doğrulama eksik
created: 2026-08-02
source: agent:backend-developer      # user | agent:<ad>
---
```

Gövde iki-üç cümle. Analiz edilmemiştir; amaç kaybolmamasıdır.

### Plan dosyası

```yaml
---
title: Kupon alanına doğrulama ekle
domain: backend
paths: [apps/api/src/coupon/**]
created: 2026-08-02
source: agent:backend-developer
executor: claude/backend-developer
gates:
  plan-review:
    - claude/architect
    - codex/architect
  code-review:
    - claude/reviewer
    - codex/reviewer
reviewed_by: [claude/architect]
adr: docs/mimari/backend/adr/0003-kupon-dogrulama.md
---
```

| Alan | Anlamı |
|---|---|
| `domain`, `paths` | Hangi projeye/modüle ait — filtreleme bunun üzerinden |
| `source` | Kaydı kim açtı |
| `executor` | İşi kim yapacak — `<ekosistem>/<rol>` |
| `gates` | Bu iş için zorunlu kapılar — `<ekosistem>/<rol>` listeleri |
| `reviewed_by` | Fiilen hangi kapılardan geçti |
| `adr` | Kalıcı karar çıktıysa ADR bağlantısı |

`gates` alanlarını agent kullanıcının doğal dilinden doldurur. Kullanıcı *"mimarisinde
Codex mimardan ikinci bir review alalım, el sıkışmadan ilerlemeyelim"* dediğinde agent
bunu `gates` bloğuna çevirir; kullanıcı YAML yazmaz. Liste olduğu için **ikinci görüş ek
alan gerektirmez**.

### Konum: kökte tek havuz

Planlar repo kökünde tek `.agent-work/` altında toplanır. Gerekçe: bir plan sık sık birden
fazla projeye dokunur; havuz merkezi olmak zorundadır; repo projeyi zaten domain olarak
modelliyor (`domain`/`paths` filtrelemeyi karşılar); ve `.agent-memory/` emsali kökte tek.

## Çapraz ekosistem çağırma

### Üç katmanlı öncelik

1. **Plan frontmatter `gates`** — o iş için ezer, commit edilir
2. **`.agent-work/agent.local.json`** — makine-yerel, `.gitignore`'da
3. **Hiçbiri yoksa** — planı yazan developer'ın ekosistemi

### `agent.local.json`

```json
{
  "codex/architect":  { "model": "gpt-5.6-sol", "effort": "max" },
  "claude/architect": { "model": "opus" },
  "opencode/reviewer": { "model": "anthropic/claude-sonnet-4-5" }
}
```

**Yalnız çapraz-ekosistem çağrıları için** provider/model/effort tutar. Yoksa agent
kullanıcıyı doldurmaya yönlendirir. Makine-yereldir çünkü başka bir geliştiricinin
makinesinde Codex kurulu olmayabilir.

**Generated agent dosyalarındaki `model` alanına dokunulmaz.** Bir agent kendi
ekosisteminde çalışırken modelini ekosistemin native mekanizmasından alır. Model bilgisini
oradan kaldırıp yerel JSON'a taşımak çalışmaz — o JSON'u hiçbir ekosistem okumaz.

### Çağırma mekanizması — doğrulandı

`agent-invoke` skill'i hedef ekosisteme göre farklı yol tutar:

| Ekosistem | Komut | Rolü verme |
|---|---|---|
| Claude | `claude -p --agent <ad> --model <model> --output-format json` | `--agent` |
| OpenCode | `opencode run --agent <ad> -m <provider/model> --format json` | `--agent` |
| Codex | `codex exec -m <model> -c model_reasoning_effort=<effort>` | **Rol talimatını prompt'a gömerek** |

Codex'te agent'ı adıyla seçen bir flag yoktur (`codex exec --help` taranarak doğrulandı).
Rol, `.codex/agent-definitions/<rol>.md` içeriği prompt'a gömülerek verilir. Model ve
effort seçimi Codex'te de mevcuttur.

`codex exec --output-schema` ile yapılandırılmış verdict alınabilir; Claude ve OpenCode'da
karşılığı `--output-format json` / `--format json`.

### Hedef ekosistem kurulu değilse

Akış **durur ve o makinedeki kişiye sorar**: *"Bu plan `codex/architect` onayı istiyor ama
bu makinede Codex kurulu değil. Atlayalım mı, sen mi bakacaksın?"* Sessizce atlanmaz
(kullanıcının niyeti açıktır), akış da kilitlenmez (plan dosyaları commit edilir ve başka
geliştiricinin makinesinde kırılmamalıdır).

## Commit kapsamı

`.agent-work/` tamamen commit edilir — `inbox/` dahil. Tek istisna `agent.local.json`.

## Sınır durumları

| Durum | Davranış |
|---|---|
| architect yok | Kapı 1 atlanır; plan doğrudan kullanıcıya |
| reviewer yok | Kapı 3 atlanır; iş biterken doğrudan kullanıcı onayına |
| İstenen ekosistem kurulu değil | Durur ve sorar |
| Plan review sonrası içerik değişti | `reviewed_by` düşer, kapılardan yeniden geçer; kullanıcı "gerek yok" diyebilir |
| Plan reddedildi | `draft/`'ta kalır, `reviewed_by` temizlenir |
| İş yarıda kaldı | `in-progress/`'te kalır, `executor` işaretli |
| Preset kapalıyken skill çağrıldı | "Plan kapısı kapalı; açmak için `manifest.constitution.planGate`'i `true` yapıp sync çalıştır" der |
| `.agent-work/` yok | İskeleti kurmayı teklif eder |

## Doğrulama

**İskeleti sihirbaz kurar, generator değil (Codex bulgu 5).** Bu yüzden testler ikiye
ayrılır:

**Generator selftest'i** (`sync-agent-config.mjs --selftest`) — yalnız generator'ın
sorumluluğunu test eder:
1. `planGate: true` olan manifest geçerlidir; `false` olan da geçerlidir.
2. `.agent-source/skills/work-plan/` ve `agent-invoke/` kaynakları ekosistem skill
   dizinlerine mirror'lanır.
3. **`.agent-work/` içine konan bir dosya sync sonrası yerinde durur, `--check` temiz
   çıkar ve ledger'da görünmez** — generator o dizini hiç sahiplenmez.

**Manifest doğrulayıcı** (`validate-manifest.mjs --selftest`):
4. `constitution.planGate` boolean olmalı; string reddedilir.

**Sihirbaz çıktısı** (elle doğrulama, otomatik test kapsamı dışı):
5. Preset açık kurulumda `.agent-work/` iskeleti (beş alt dizin dahil), `TEMPLATE.md` ve
   `.gitignore` satırı oluşur; şablon metinleri `docLanguage` dilindedir.
6. Preset kapalı kurulumda hiçbiri oluşmaz.

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Anayasa preseti + projeye kurulan skill; hook değil | Hook Claude'a özgü; çok hedefli repoda kapı tek ekosistemde çalışırdı |
| 2 | Preset default kapalı | Artefakt üreten tek kural; bilinçli tercih olmalı |
| 3 | `plan-gate.md` = kurulum sözleşmesi, skill = runtime prosedürü | Aynı kural iki yerde anlatılırsa drift olur |
| 4 | Kökte tek `.agent-work/` | Çoklu projeye dokunan plan ve merkezi havuz gereği |
| 5 | Durum = klasör; `in-progress/` eklendi | İki yerde tutmak drift üretir; başlamış iş ayırt edilmeli |
| 6 | Kapı 1 architect'e, kapı 3 reviewer'a; rol yoksa kullanıcıya | Yaklaşım yargısı architect'in; kimse kilitlenmemeli |
| 7 | Rol adları manifest'ten üretilir, sabit varsayılmaz | Sihirbaz özel rol adlarına izin veriyor |
| 8 | Eşik yok, kaçış kullanıcıda | Eşik kararını agent verirse kapı sessizce atlanır |
| 9 | `gates` frontmatter'da, ayrı override dosyası yok | Tek mekanizma, tek yer |
| 10 | Generated agent dosyalarındaki `model`'e dokunulmaz | Native mekanizma; kaldırılırsa model seçimi kaybolur |
| 11 | Şablonlar `docLanguage`'de üretilir, kopyalanmaz | Sihirbazın kendi dil sözleşmesi |
| 12 | Preset kapatma: manifest + sync | `/team-builder-edit` yok; ledger mirror'ları stale raporlar |
| 13 | Codex'te rol prompt'a gömülür | `codex exec`'te agent seçme flag'i yok (doğrulandı) |
