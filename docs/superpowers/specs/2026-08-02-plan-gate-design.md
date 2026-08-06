# Tasarım: Plan Kapısı ve İş Havuzu (`planGate`)

- **Tarih:** 2026-08-02
- **Durum:** Onaylandı — uygulama planı bekliyor
- **Kapsam:** team-builder'a 5. anayasa preseti olarak plan kapısı + onaylanmış iş havuzu

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
tarafından onaylanması, ve onaylanmış işlerin kaybolmadan bir havuzda birikip istendiğinde
işletilebilmesi.

## Kapsam sınırı

Bu spec dört alt sistemden ikisini kapsar:

| | Alt sistem | Durum |
|---|---|---|
| **A** | Plan kapısı — plan yazımı, agent review, kullanıcı onayı | **Bu spec** |
| **D** | Havuz — onaylanmış işlerin birikmesi ve seçilerek işletilmesi | **Bu spec** |
| **B** | Çapraz ekosistem mekanizması — başka provider'ın agent'ının teknik olarak nasıl çağrılacağı | Ayrı spec |
| **C** | Inbox'ın dış sistem entegrasyonu (Jira vb.) | Ayrı spec |

A ve D birlikte ele alınıyor çünkü D, A'nın durum makinesinin devamı — kullanıcı planı
onayladıktan sonra ne olduğunun cevabı. Ayırmak A'yı yarım bırakırdı.

`inbox/` dizini ve ham kayıt formatı bu spec'te tanımlanıyor; **dış sisteme bağlanması**
C'ye ait.

B için bu spec **kanca noktalarını ve veri modelini** tanımlıyor, böylece B geldiğinde
A+D'yi yeniden yazmak gerekmiyor.

## Mimari

Mekanizma iki parçalı: **kural anayasada, prosedür skill'de.**

Agent md gövdeleri sadece "bu projede plan kapısı açık, prosedür `work-plan` skill'inde"
der; adımları tekrar etmez. Prosedürün tek otoritesi skill'dir. Bu ayrım drift'i önler —
aynı kural iki yerde anlatılmaz.

### Neden hook değil

`PreToolUse` hook'u ile Edit/Write çağrısını engellemek daha zorlayıcı olurdu, ama Claude
Code'a özgü; Codex ve OpenCode'da karşılığı yok. Çok hedefli bir repoda kapı yalnız bir
ekosistemde çalışır — "kapı var sanmak, yokken" en kötü senaryo. Hook ileride Claude
tarafında *ek* sıkılaştırma olarak düşünülebilir, kapının temeli olamaz.

### team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `team-builder-shared/constitution.md` | KARAR 5 — `planGate` (default **KAPALI**) |
| `team-builder-shared/plan-gate.md` *(yeni)* | Prosedürün tek otoritesi: durumlar, kapılar, roller |
| `team-builder-shared/templates/plan.md` *(yeni)* | Plan dosyası şablonu |
| `team-builder-setup/SKILL.md` | Adım 7B'ye toggle + preset açıksa sorulacaklar; Adım 8a'ya iskelet üretimi |
| `team-builder-shared/agent-md-rich.md` | developer ve architect gövdelerine kural satırları |
| `team-builder-shared/manifest-schema.md` | `constitution.planGate` alanı |
| `team-builder-shared/validate-manifest.mjs` | `planGate` boolean doğrulaması |
| `team-builder-shared/routing.md` | `.agent-work/**` sahipliği notu |
| `team-builder-shared/canonical-source.md` | `.agent-work/` generated değildir notu |
| `team-builder-shared/sync-pipeline.md` | iskelet üretimi + orphan istisnası |

### Projede üretilecekler (preset açıkken, setup bir kez çalışır)

```
.agent-work/                     ← generated DEĞİL; agent'ların çalışma alanı
├── README.md                    ← ne olduğu + akış özeti
├── TEMPLATE.md                  ← plan şablonu
├── inbox/                       ← ham kayıt
├── draft/                       ← plan yazıldı
├── approved/                    ← onaylandı, havuz
└── done/                        ← işlendi (arşiv)

.agent-source/skills/work-plan/SKILL.md   ← generated; ekosistem skill dizinlerine mirror
```

Ayrıca setup, projenin `.gitignore`'una `.agent-work/agent.local.json` satırını ekler
(dosya yoksa oluşturur, varsa satır zaten varsa tekrar eklemez).

`.agent-work/` **tek dizindir, repo kökündedir, hiçbir yere kopyalanmaz.** Mirror'lanan
yalnız `work-plan/SKILL.md`'dir; bunun sebebi ekosistemlerin skill'i farklı dizinden
okumasıdır (Claude `.claude/skills/`, Codex `.agents/skills/`, OpenCode ikisini de).

### İki kritik kısıt

**1. `.agent-work/` generated değildir.** `.agent-memory/` ile aynı sınıfta: agent'ların
kendi alanı. `sync` onu üretmez, içindeki planları silmez, drift kontrolüne sokmaz. Setup
yalnız **boş iskeleti** bir kez kurar. Bu şart — aksi halde generator bir sonraki
çalışmasında bütün planları orphan sayıp siler.

**2. Şablon `docs/` altına konmaz.** `templates/plan.md` projede `.agent-work/TEMPLATE.md`
olarak açılır. Sebep: routing'de `docs/** → architect` kuralı var ve her zaman ekleniyor.
Şablon `docs/` altında olsaydı planı yazacak developer kendi şablonuna erişemez, routing
onu architect'e yönlendirirdi. `.agent-work/` `docs/` dışında olduğu için bu çakışma
doğmuyor.

### Preset neden default kapalı

Mevcut dört anayasa kuralı neredeyse sıfır maliyetli disiplinlerdir (yorum standardı,
memory disiplini gibi). Bu beşincisi her iş için artefakt ve iki kapı üretir — bilinçli
tercih olmalı, sessizce gelmemeli. Sihirbaz diğerleri gibi sorar, yalnız işaretsiz gelir.

## Yaşam döngüsü

```
inbox/     ham kayıt (yan bulgu, sonradan akla gelen)
   │ analiz
   ▼
draft/     plan yazıldı ── kapı 1: gates.plan-review ──┐
   ▲                                                   │
   │ plan değişti → reviewed_by düşer                  ▼
   └────────────────────────────── kapı 2: kullanıcı onayı
                                                       │
                                                       ▼
approved/  havuz — kullanıcı içinden bir/birkaçını seçip işletir
                                                       │ kod yazılır
                                                       │ kapı 3: gates.code-review
                                                       ▼
done/      arşiv (+ kalıcı karar çıktıysa ADR)
```

**Durum = bulunduğu klasör.** Frontmatter'da `status` alanı bilerek yoktur; durumu iki
yerde tutmak kaçınılmaz olarak drift üretir. Dosya taşımak git'te rename olarak görünür,
geçmiş korunur.

`inbox/` girişi opsiyoneldir; doğrudan `draft/` ile de başlanabilir.

### Roller ve kapılar

| Adım | Kim |
|---|---|
| Plan yazımı | Kod yolunun sahibi developer (routing'e göre) |
| **Kapı 1** — plan review | **architect** |
| **Kapı 2** — onay | **Kullanıcı** (aşağıdaki sunum kuralına göre) |
| İşletme | `executor` alanındaki developer |
| **Kapı 3** — kod review | reviewer (mevcut akış) |

### Kapı 2'nin sunum kuralı

Plan kullanıcıya **sade dille ve somut örnekle** sunulur; ham dosya içeriği veya YAML
dökülmez. Kullanıcı planı okuyup "evet böyle ilerle" diyebilmeli, teknik terim çözmek
zorunda kalmamalıdır.

Bu, repo'nun mevcut sunum ilkesinin devamıdır: `team-builder-setup` zaten "JARGON YASAĞI +
önce açıkla" ve "kullanıcıya alan adı / teknik terim gösterme" kuralını taşıyor. Aynı
disiplin plan sunumuna uygulanır — `gates`, `executor`, `paths` gibi alan adları
kullanıcıya gösterilmez; ne yapılacağı ve kabul kriteri günlük dille anlatılır.

Kullanıcıya giden plan **kapı 1'den geçmiş, düzeltilmiş** plandır — ham taslak değil.
Kapı sırası bilinçli olarak "önce agent, sonra kullanıcı" seçilmiştir ki kullanıcının
zamanı teknik olarak süzülmemiş bir metne harcanmasın.

Kapı 1'in architect'e ait olmasının sebebi: plan review'ının asıl sorusu "bu doğru
yaklaşım mı" — bu mimari bir yargıdır. Repo zaten "belirsizlikte architect'e danışılır"
diyor; plan bu danışmanın yazılı hali olur. reviewer'ı plan aşamasına da sokmak onun asıl
kapısını (kod review) sulandırırdı.

### Eşik: yok

**Her iş plan kapısından geçer.** Kaçış kullanıcıdadır: kullanıcı açıkça "plansız yap"
derse atlanır. Kaçış kapısı **agent'ta değildir** — agent kendi kararıyla planı atlayamaz.

Eşik tanımlamak ("N dosyadan fazlaysa plan") reddedildi çünkü "eşiğin altında mı"
kararını planı yazacak agent verir; yanlış sınıflarsa kapı sessizce atlanır. Bu, kapının
varlık sebebini ortadan kaldırır.

### Havuz seçmelidir, kuyruk değil

`approved/` bir **havuzdur**, FIFO kuyruk değil. Kullanıcı içinden bir tanesini seçip
"bunu yapalım" der, ya da birkaçını seçip "bunları yapalım" der. Zorunlu sıra yoktur.

## Veri modeli

### `inbox/` kaydı — minimal

```markdown
---
title: Kupon alanında doğrulama eksik
created: 2026-08-02
source: agent:backend-developer      # user | agent:<ad>
---

Kupon kodu boş gönderilince 500 dönüyor. Ödeme akışı test edilirken görüldü.
```

Domain, yol, plan yok — henüz analiz edilmedi. Amaç kaybolmamasıdır.

### `draft/` → `approved/` → `done/` planı

```markdown
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

## Ne ve neden
Sade dille, örnekle. Kabul kriteri burada.

## Nasıl
Etkilenen yollar, yaklaşım, riskler, açık sorular.
```

| Alan | Anlamı |
|---|---|
| `domain`, `paths` | Hangi projeye/modüle ait — filtreleme bunun üzerinden |
| `source` | Kaydı kim açtı (kullanıcı mı, hangi agent mı) |
| `executor` | İşi kim yapacak — `<ekosistem>/<rol>` |
| `gates` | Bu iş için zorunlu kapılar — `<ekosistem>/<rol>` listeleri |
| `reviewed_by` | Fiilen hangi kapılardan geçti |
| `adr` | Kapanışta kalıcı karar çıktıysa ADR bağlantısı |

**`gates` alanlarını agent kullanıcının doğal dilinden doldurur.** Kullanıcı *"mimarisinde
Codex mimardan ikinci bir review alalım, el sıkışmadan ilerlemeyelim; iş gerçekleşince de
Codex reviewer onayı olmadan ilerlemeyelim"* dediğinde agent bunu `gates` bloğuna çevirir.
Kullanıcı YAML yazmaz.

`gates` listeleri olduğu için **ikinci görüş ek alan gerektirmez** — aynı kapıya iki
ekosistem yazmak yeterlidir.

### Konum: kökte tek havuz

Planlar repo kökünde tek `.agent-work/` altında toplanır, proje/modül başına dağıtılmaz.
Gerekçeler:

1. **Bir plan sık sık birden fazla projeye dokunur.** Per-project olsa hangisine
   yazılacağı keyfi olurdu; ikisine birden yazmak tek-kaynak ilkesini kırardı.
2. **Havuz merkezi olmak zorunda.** "Onaylı işleri göster, şu üçünü işlet" diyebilmek için
   hepsinin tek yerde ve seçilebilir olması gerekir. Dağıtık olsa bir projeyi atlamak
   sessiz bir hata olurdu.
3. **Repo projeyi zaten domain olarak modelliyor.** Domain-split developer rolleri ve
   `routing[]` path→rol eşlemesi mevcut; `domain` + `paths` alanları filtrelemeyi
   karşılar, ayrı dizin ağacına gerek yoktur.
4. **Emsal var:** anayasa KARAR 3 "tek canonical memory alanı repo kökünde `.agent-memory/`"
   diyor. `.agent-work/` onunla simetriktir.

Karşı argüman — bir projeyi başka repoya taşırsan planlar gitmez — kabul edilmiştir:
planlar geçici artefakttır (`done/` arşivi), kalıcı olan karar zaten kapanışta ADR'a
dönüşüp `docs/<arch-root>/` altına, domain klasörüne gider.

## Ekosistem seçimi

### Üç katmanlı öncelik

1. **Plan frontmatter `gates`** — o iş için ezer, commit edilir
2. **`.agent-work/agent.local.json`** — makine-yerel varsayılan, `.gitignore`'da
3. **Hiçbiri yoksa** — planı yazan developer'ın ekosistemi (aynı oturumda kalır)

Ayrı bir override *dosyası* yoktur; ezme frontmatter'da olur.

### `agent.local.json`

```json
{
  "codex/architect": { "model": "gpt-5.5", "effort": "high" },
  "codex/reviewer":  { "model": "gpt-5.5", "effort": "high" },
  "claude/architect": { "model": "opus", "effort": "high" }
}
```

Bu dosya **yalnız çapraz-ekosistem çağrıları için** provider/model/effort tutar. Yoksa
agent kullanıcıyı doldurmaya yönlendirir. `.gitignore`'a eklenir — `.agent-work/`'ün
commit edilmeyen tek parçasıdır.

**Generated agent dosyalarındaki `model` alanına dokunulmaz.** Bir agent kendi
ekosisteminde çalışırken modelini ekosistemin native mekanizmasından alır
(`.claude/agents/<ad>.md` frontmatter'ı, `.codex/agents/<ad>.toml`,
`.opencode/agents/<ad>.md`). Model bilgisini oradan kaldırıp yerel bir JSON'a taşımak
teknik olarak çalışmaz: o JSON'u hiçbir ekosistem okumaz, model seçimi tamamen kaybolur ve
her ekosistem kendi varsayılanına düşer.

İki dosya çakışmaz çünkü iki farklı çağrı yolunu tanımlarlar:

| | Agent kendi ekosisteminde | Başka ekosistemden çağrılırken |
|---|---|---|
| Kaynak | Generated agent dosyası (native) | `agent.local.json` |
| Kim okur | Ekosistemin kendisi | `work-plan` skill'i |

`agent.local.json`'ın **mekanizması** (o agent'ın teknik olarak nasıl çağrılacağı) B
spec'ine aittir; bu spec yalnız dosyayı, formatını ve önceliğini tanımlar.

### Kanca noktaları (B'ye bırakılan)

| Kanca | Ne seçilir |
|---|---|
| Plan yazımı | Hangi ekosistemin developer'ı |
| Kapı 1 | Hangi ekosistemin architect'i + ikinci görüş |
| İşletme | Hangi ekosistemin developer'ı |
| Kapı 3 | Hangi ekosistemin reviewer'ı + ikinci görüş |

## Commit kapsamı

`.agent-work/` **tamamen commit edilir** — `inbox/` dahil. Tek istisna
`agent.local.json`'dır, o `.gitignore`'a eklenir.

Planların paylaşılması bilinçlidir: plan bir devir teslim artefaktıdır, takım ne
yapılacağını görmeli ve PR'da plan da okunabilmelidir.

## Sınır durumları

| Durum | Davranış |
|---|---|
| Takımda architect yok | Kapı 1 atlanır; plan doğrudan kullanıcıya gider. Plan yine yazılır. |
| İstenen ekosistem o makinede kurulu değil | **Durur ve o makinedeki kişiye sorar:** "Bu plan `codex/architect` onayı istiyor, bu makinede Codex yok. Atlayalım mı, sen mi bakacaksın?" |
| Plan review sonrası içeriği değişti | `reviewed_by` düşer, plan kapılardan yeniden geçer. Kullanıcı "gerek yok" diyerek atlatabilir. |
| Plan reddedildi | `draft/`'ta kalır, `reviewed_by` temizlenir |
| İş yarıda kaldı | `approved/`'da kalır, `executor` işaretli — başka oturumda devam edilir |
| Preset kapalıyken skill çağrıldı | "Bu projede plan kapısı kapalı; açmak için `/team-builder-edit`" der |
| `.agent-work/` yokken skill çağrıldı | İskeleti kurmayı teklif eder |

### Eksik ekosistemde neden sessizce atlanmıyor

Kullanıcı `gates`'e bir kapı yazdıysa niyeti açıktır ("el sıkışmadan ilerlemeyelim").
Sessizce atlamak o niyeti ihlal eder. Akışı kilitlemek de kabul edilemez — plan dosyaları
commit edildiği için başka geliştiricinin makinesinde kırılırdı. Doğrusu durup **karar
verme yetkisini o makinedeki insana bırakmaktır**; bu, tasarım boyunca uygulanan "kaçış
kullanıcıda" ilkesiyle tutarlıdır.

## Doğrulama

Mevcut selftest altyapısına eklenecekler:

**`validate-manifest.mjs`:**
- `constitution.planGate` boolean olmalı
- Manifest geçerliliği `planGate` açık/kapalı iken bozulmamalı

**`sync-agent-config.mjs` selftest:**
- Preset **açıkken**: `.agent-work/` iskeleti kurulur, `work-plan` skill'i ekosistem skill
  dizinlerine mirror'lanır
- Preset **kapalıyken**: hiçbiri üretilmez
- **`.agent-work/` içine elle konan bir plan dosyası sync sonrası yerinde durur ve
  `--check` temiz çıkar** — en kritik test. Bu kırılırsa generator bütün planları orphan
  sayıp siler.
- Preset açıkken drift kontrolü temiz kalır

## Kararlar özeti

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Anayasa preseti + skill; hook değil | Hook Claude'a özgü, çok hedefli repoda kapı yalnız bir ekosistemde çalışırdı |
| 2 | Preset default kapalı | Artefakt üreten tek kural; bilinçli tercih olmalı |
| 3 | Kökte tek `.agent-work/` | Çoklu projeye dokunan plan ve merkezi havuz gereği |
| 4 | Durum = klasör | İki yerde tutmak drift üretir |
| 5 | Kapı 1 architect'e ait | "Doğru yaklaşım mı" mimari yargıdır; reviewer'ın kapısı sulanmaz |
| 6 | Eşik yok, kaçış kullanıcıda | Eşik kararını agent verirse kapı sessizce atlanır |
| 7 | Havuz seçmeli, FIFO değil | Kullanıcı bir veya birkaçını seçer |
| 8 | `gates` frontmatter'da, ayrı dosya yok | Tek mekanizma, tek yer |
| 9 | Generated agent dosyalarındaki `model`'e dokunulmaz | Native mekanizma; kaldırılırsa model seçimi kaybolur |
| 10 | Eksik ekosistemde durur ve sorar | Ne sessiz atlama ne kilitlenme |
| 11 | `.agent-work/` sync'in dışında | Aksi halde planlar orphan sayılıp silinir |
| 12 | Şablon `.agent-work/TEMPLATE.md` | `docs/** → architect` routing çakışmasını doğurmamak için |
