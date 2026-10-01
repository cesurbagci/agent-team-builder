# Governance Varsayılanları (v2 — Roller)

> v1'in basit "architect + developer + reviewer" rosterini **domain-split**
> mimarisine taşır. Bunlar varsayılandır; sihirbaz her rolü kullanıcıya gösterir,
> kabul/değiştir denir. Her rol için `sandbox_mode` · `writesCode` · `consults`
> manifest.json'a yazılır. **Model ve effort önerisi** de buradadır ama manifest'e değil,
> `team-builder-models` aracılığıyla `.agent-source/llm.json`'a gider (bkz.
> `llm-config.md`): Claude için takma ad (eskimez) ve effort; Codex ve OpenCode modeli o
> makinenin kataloğundan seçilir.

## Genel İlke

Önerilen çekirdek roster: **architect (lead, doc-only)** + **developer(lar, domain-split)** + **reviewer**. "Her zaman" değil **varsayılan**: kullanıcı architect'i eklemeyebilir. Eklemezse `docs/` sahipliği, danışma hedefi, developer yasakları ve `lead` seçimi koşullu olarak değişir (bu dosyada ve `routing.md` / `agent-md-rich.md`'de işaretli).
`qa` / `security` / `doc-writer` opsiyoneldir. Developer rolleri generic değildir; sihirbaz
projeyi analiz eder ve gerçek domain'lere göre böler (aşağıya bakın).

`sandbox_mode` değerleri (Codex hedefi için anlamlı; Claude tarafında okuma/yazma sınırı
agent md gövdesindeki "Çalışma/Yasak klasörleri" ile uygulanır):
- `read-only` — yalnız okur, dosya yazmaz (architect production koduna, reviewer her şeye).
- `workspace-write` — kendi domain'inde yazar.

---

## 1. Architect / Tech Lead  (çekirdek, default: EKLE, lead)

- `writesCode`: **false** (doc-only). Production kodu yalnız **okur**.
- Claude önerisi: **opus** · effort: **high** · `sandbox_mode`: **workspace-write**
  — sahiplendiği `docs/` dizinine yazması gerektiği için `read-only` olamaz; production
  koduna yazma yasağı talimatla uygulanır (reviewer'dan farkı budur).
- **Yazma yetkisi: routing'de kendisine verilen doküman yolları.** Varsayılan tek satır `docs/**`'tir — o zaman "tüm `docs/` dizini" doğru ifadedir ve alt klasörleri (`docs/architecture/adr` vb.) tek tek sayma. Doküman **bölünmüşse** (doc-writer'a `docs/guides/**` verildiyse) ya da per-module satır varsa yetkiyi **tablodaki kendi yollarıyla** ifade et; "tüm `docs/`" demek başka bir rolün alanını da sahiplenmek olur. Production koduna hiçbir durumda yazamaz.
- `consults`: [] (son mercii kendisidir).
- Topolojide genelde `lead`.
- Kurallar:
  - "Production kod yazma; **yazma alanın routing'de sana verilen yollardır**" (tek satır `docs/**` ise: "tüm `docs/` dizinidir"; mimari dokümanlar `docs/<arch-root>/` altında).
  - "Kod tabanını birincil kaynak olarak oku; dokümanları kod kontratlarının tamamlayıcısı olarak güncelle."
  - "ADR / mimari kısıt / tasarım kararı üret; gerekçe ve sonucu kalıcı doküman olarak bırak."
  - "Mimari soruların son mercii sensin."

## 2. Developer(lar)  (çekirdek, default: EKLE — DOMAIN-SPLIT)

Tek bir generic "developer" yerine, sihirbaz **proje analizinden domain önerir** ve her
domain için **ayrı bir developer rolü** oluşturur. Domain türetme kuralı (kod-yolu analizi):

| Kod yolu deseni | Önerilen developer rolü |
|---|---|
| `apps/<app>/` | `<app>-developer` (ör. backend / frontend) |
| `modules/<name>/` | `extension-developer` (modül başına yazma sorumluluğu) |
| `packages/<pkg>/` | ilgili domain developer'ına bağlanır ya da ayrı `packages-developer` |

> **Örnek roster:** `backend-developer`, `frontend-developer`,
> `extension-developer` (+opsiyonel `codex-extension-developer` yönlendirici).
> Sihirbaz bu domain taslağını kullanıcıya onaylatır/düzelttirir.

Her developer rolü için varsayılan:
- `writesCode`: **true**.
- Claude önerisi: **sonnet** · effort: **medium** · `sandbox_mode`: **workspace-write**.
  (Karmaşık projelerde effort=high tercih edilebilir; sihirbaz proje karmaşıklığına göre yükseltebilir.)
- `consults`: **[architect]** — architect takımda **yoksa boş `[]`**.
- Kurallar (her developer'a, kendi domain'i doldurularak):
  - Dokümantasyonu sahiplenen bir rol **varsa** — ölçü routing'dir, rol adı değil: kod yazmayan (`writesCode: false`) bir role verilmiş her yol o rolün yazma alanıdır — "Sadece kendi domain'inde (`<paths>`) kod yaz. `<o yol>` altına yazma — orası `<o rol>`ün; gerekiyorsa ona işaret et." Sahip architect ise yasak **tüm `docs/`**'tur, yalnız mimari kök değil. Doküman birden çok role bölündüyse her yol için ayrı satır yazılır. Böyle bir rol **yoksa** bu cümle **yazılmaz** — `docs/` özel sahipliği olmayan sıradan bir dizindir.
  - "Mimari etkili kararda (yeni bağımlılık, modül sınırı, yeni IPC/public API yüzeyi, şema/breaking change, güvenlik etkisi) implementasyonu durdurup **architect'e danış**." Architect **yoksa** danışma hedefi **kullanıcıdır**: "…implementasyonu durdurup kullanıcıya sor."
  - "Diğer domain'lerin kodunu okuyabilirsin ama yazamazsın."
  - "Kendi kodunun testlerini sen yazar ve çalıştırırsın: yeni davranışta ya da hata
    düzeltmesinde önce doğru nedenle başarısız olan testi yaz, sonra kodu, sonra projenin test
    komutunu çalıştır."
- **Testler kodun sahibinindir.** Bir domain'in test yolları (`src/test/**`, `__tests__/**`,
  `*_test.go` vb.) o domain'in developer'ına aittir; ayrı bir role verilmez. Developer'ın
  routing satırı test yollarını zaten kapsıyorsa ayrı satır gerekmez. Kullanıcı testleri
  reviewer'a yazdırmak isterse şunu söyle: kod yazan bir rol kapı sahibi olamaz; kod
  denetimi o zaman başka bir role kalır.
- **Skill:** her developer'a TDD skill'i (`test-driven-development` — superpowers, ya da
  `tdd-workflow` — ECC) ve stack'in test skill'i (ör. `springboot-tdd`, `python-testing`)
  **gerektiğinde** olarak önerilir (`skill-recommend.md`).

## 3. Reviewer  (çekirdek, default: EKLE)

- `writesCode`: **false** (read-only).
- Claude önerisi: **opus** · effort: **high** · `sandbox_mode`: **read-only**.
- `consults`: [] (gate'tir; gerekirse architect'e eskale eder — architect **yoksa** eskalasyon hedefi **kullanıcıdır**).
- **Plan kapısı açıksa:** evrensel kod review kuralının tek otoritesi `planGate.codeReviewer`'dır. O alan bir ad taşıyorsa kural o adla yazılır (bu rol o ad olmayabilir); `null` ise **evrensel kod review kuralı hiç yazılmaz**. Plan kapısı kapalıysa bugünkü sabit `reviewer` gate'i aynen korunur.
- Kurallar:
  - "Kod yazma ve dosya değiştirme. `git diff`, `git status` ve ilgili mimari dokümanları okuyarak bulgu raporu üret."
  - Kod review kapısı **varsa** (plan kapısı kapalı, ya da `planGate.codeReviewer` bir ad taşıyor): "Her çıktı review gate'inden geçer." `planGate.codeReviewer: null` ise bu cümle **yazılmaz** — projede kod review kapısı yoktur.
  - "Bulguları **Kritik / Uyarı / Öneri** olarak grupla; önce gerçek riskleri yaz. Her
    bulguya mümkünse somut bir düzeltme önerisi yaz. Yalnız Kritik/Yüksek bulgu işi
    reddeder; Uyarı ve Öneri ile onay verilir."
  - "Testleri de denetle: değişen davranışı kapsıyorlar mı, yeni davranışta önce başarısız
    olan test var mı. Test yazma; eksik testi kodun sahibine bildir."
  - "**Workaround pattern'leri otomatik Kritik'tir** (anayasa no-workaround). Kod-doc senkronizasyon eksiği de Kritik."
  - "Kritik/Yüksek bulgular merge'i bloklar."

---

## Opsiyonel Roller

### QA / Test Engineer  (opsiyonel)
- `writesCode`: true (yalnız test) · Claude önerisi: **sonnet** · effort: **medium** · `sandbox_mode`: **workspace-write**.
- **Kapsam:** yalnız ayrı duran uçtan uca / kabul testleri (ör. `e2e/**`, `tests/acceptance/**`).
  Birim ve entegrasyon testleri kodun sahibi developer'ındır — QA'ya verilmez. Ayrı bir e2e
  alanı yoksa bu rolü önerme. Kod yazdığı için kapı sahibi olamaz.
- `consults`: [architect] — architect takımda **yoksa boş `[]`**.
- Kurallar: "Uçtan uca test stratejisini sen belirlersin; testleri kodun gerçek davranışına göre yaz; developer'ların birim ve entegrasyon testlerine yazma."

### Security Reviewer  (opsiyonel)
- `writesCode`: false · Claude önerisi: **opus** · effort: **high** · `sandbox_mode`: **read-only**.
- `consults`: [architect] — architect takımda **yoksa boş `[]`**.
- Kurallar: "Auth, input validasyonu, secrets, dış çağrı içeren değişiklikleri sen incelersin; bulguları reviewer formatında raporla."

### Database Engineer  (opsiyonel — projede veritabanı varsa öner)
- **Ne zaman önerilir:** proje analizinde bir veritabanı izi görürsen — migration dizinleri
  (`migrations/`, `db/migrate/`, Flyway/Liquibase), ORM şema/entity dosyaları (`schema.prisma`,
  `DbContext`/Entity Framework, JPA/Hibernate `@Entity`, TypeORM/Sequelize/Drizzle, Django
  `models.py`, SQLAlchemy/Alembic, ActiveRecord), `*.sql` dosyaları ya da bağımlılıklarda bir
  veritabanı sürücüsü. Önerirken hangi işareti gördüğünü söyle.
- **İz yoksa sor** — boş ya da yeni bir projede kod henüz yoktur: "Bu projede veritabanı
  işlemleri olacak mı (tablolar/entity'ler, migration'lar, sorgular)?" Evet derse rolü öner ve
  nerede duracaklarını sor (ör. `src/db/**`, `prisma/**`); o yol routing'de ona verilir —
  yazma izni olan bir rolün routing'de yolu olmalıdır. Yolu henüz bilmiyorsa bir öneri yap
  (`src/db/**`), sonra `db/migrate/**` gibi düzeltilebileceğini söyle.
- `name`: `database-engineer` · `writesCode`: **true** (şema, entity, migration, sorgu katmanı) ·
  Claude önerisi: **opus** · effort: **high** · `sandbox_mode`: **workspace-write**.
- **Routing:** entity/şema/migration yolları ona verilir (ör. `prisma/**`, `src/db/**`,
  `apps/api/src/entities/**`, `db/migrate/**`). Bu yollar çoğu zaman bir developer'ın alanının
  içindedir; routing kuralı gereği ya iç içe (dar yol database-engineer'ın) ya da tamamen ayrı
  olmalıdır.
- `consults`: [architect] — architect takımda **yoksa boş `[]`**. Developer'lar şema, index ya da
  sorgu performansı sorusunda ona danışır (`consults`'a eklenmesini öner).
- Kurallar:
  - "Veri modelini standartlara göre tasarla: normalizasyon (bilinçli denormalizasyonu gerekçesiyle
    yaz), tutarlı adlandırma, birincil/yabancı anahtar, NOT NULL, unique ve check kısıtları, doğru
    veri tipleri."
  - "Performansı tasarımda düşün: gerçek sorgu desenlerine göre index (bileşik index sırası,
    kapsayan index), N+1 ve gereksiz tam tablo taramalarından kaçın, büyük tablolarda sayfalama;
    önemli sorgularda çalıştırma planını (`EXPLAIN`) kontrol et."
  - "Migration'lar geri alınabilir ve çalışan sistemle uyumlu olsun (genişlet → taşı → daralt);
    veri kaybettiren bir değişikliği (kolon/tablo silme, tip daraltma) kullanıcı onayı olmadan
    yapma."
  - "Şema değişikliği mimari etkiliyse (yeni veri deposu, büyük model değişikliği) architect'e
    danış; architect yoksa kullanıcıya sor."
  - "Kendi kodunun (entity, repository, migration, sorgu) testlerini sen yazar ve
    çalıştırırsın; önce başarısız test."
- **Test yolları:** kendi yollarının test karşılıkları da ona verilir (ör.
  `src/main/.../domain/**` → `src/test/.../domain/**`), iç içe satırla. Skill olarak TDD ve
  stack'in test skill'i **gerektiğinde** önerilir.

### Doc Writer  (opsiyonel)
- `writesCode`: false (yalnız doküman) · Claude önerisi: **haiku** · effort: **low** · `sandbox_mode`: **workspace-write** (yalnız `docs/`).
- `consults`: [architect] — architect takımda **yoksa boş `[]`**.
- Kurallar: Architect **varsa** — "Mimari kararları architect üretir; sen kullanıcı-bakış dokümanını/README'leri yazar ve günceltirsin. ADR yazma." **İkisi birlikte seçildiyse routing tablosu böler:** architect `docs/**`'in sahibidir, doc-writer'a yazacağı alt yol (örn. `docs/guides/**`) **mutlaka** verilir. Yol vermemek "yazamaz" demek değildir — `workspace-write` bir role routing'de yol verilmemesi manifest'i **geçersiz** kılar (yazma izni var, yazacağı yer yok; bkz. `manifest-schema.md` doğrulama kuralları). Doc-writer'a yol verilmeyecekse doc-writer'ı **ekleme**. Architect **yoksa** — "Kullanıcı-bakış dokümanını ve README'leri sen yazar ve günceltirsin. Mimari karar gerekiyorsa kullanıcıya sor." (ADR yasağı kalkar: yazacak başka rol yoktur.)

---

## Manifest Eşlemesi (özet)

Her rol, `manifest.json` `agents[]` içine şu metadata ile yazılır:

```jsonc
{
  "name": "backend-developer",
  "targets": ["claude", "codex"],
  "sandbox_mode": "workspace-write",  // read-only | workspace-write
  "writesCode": true,
  "consults": ["technical-architect"]
}
```

Model ve effort bu nesnede yoktur — `llm.json`'a gider. `writesCode: false` her ikisinde de vardır ama sandbox ayrışır: reviewer hiçbir şey
yazmadığı için `read-only`, architect sahiplendiği `docs/` dizinine yazdığı için
`workspace-write`'dır (production kodu yasağı talimattadır). Developer'larda
`workspace-write` + `writesCode: true`. Domain → developer eşlemesi projeye özeldir ve
sihirbaz tarafından kullanıcıya onaylatılır.
