# routing.md — Path-based Zorunlu Routing

> Paylaşılan referans. Sihirbaz (`team-builder-setup`) ve üye rutini (`member-template.md`)
> bu dosyaya dayanır. Üretimde çalışan bir referans kurulumdaki "Zorunlu Routing" tablosunun genelleştirilmiş hâli.

## Amaç

v2 governance modelinin çekirdeği **kod-yolu → zorunlu rol** tablosudur. Generic
"consults" listesi tek başına yeterli değildir; her kod değişikliği görevinde
**hangi yolun hangi role gittiği** açıkça tanımlanır. Bu tablo iki yere yazılır:

1. **`.agent-source/project/instructions.md`** — okunabilir governance bölümü (insan +
   agent için). Routing **ortak** metindir; hedefe özgü dosyalara (`project/CLAUDE.md`,
   `project/AGENTS.md`) yazılmaz — onlar `instructions.md`'ye referans verir.
2. **manifest.routing[]** — makine-okunur kaynak (`{ "path": "<glob>", "role": "<agent-name>" }`).

Bu ikisi yol sahipliğinin **tek kaynağıdır**. Sync `instructions.md`'yi manifest'ten
üretmez, kopyalar; bu yüzden tablo ile `manifest.routing` her değişiklikte birlikte
güncellenir ve `sync` ikisini karşılaştırır (aşağıda *Kayma kontrolleri*).

### Rol dosyaları ve kurallar sahiplik taşımaz

Rol dosyaları (`.agent-source/agents/<ad>.md`) ve manifest `agents[].rules` /
`extra_instructions` **yol kopyalamaz**. Rol dosyası yazma alanını "`instructions.md`'deki
routing tablosunda rolüne atanmış yollar" diye tabloya atıfla anlatır; bu metin
`<!-- ownership -->` … `<!-- /ownership -->` işaretleri arasında durur (`agent-md-rich.md`).
Kod–doküman eşleştirmesi de aynı şekilde yalnız `manifest.codeDocSync[]` ve
`instructions.md`'deki `c:codeDocSync` tablosunda durur. Böylece bir sahiplik değişikliği
yalnız manifest'i ve `instructions.md`'yi değiştirir; rol dosyaları dokunulmadan doğru kalır.

Makine düzeyindeki izinler değişmez: Codex `sandbox_mode`, OpenCode `permission.edit` rol
bazındadır; sync'in Codex `developer_instructions`'a routing'den ürettiği yol satırları da
kalır — her sync'te manifest'ten yeniden üretildikleri için bayatlamazlar.

### Tablonun biçimi

Sync tabloyu şu satırlardan tanır: ikinci hücre **yalnız** backtick'li bir agent adı, birinci
hücre bir ya da daha çok backtick'li yol (`` | `apps/api/**` | `backend-developer` | ``).
`c:codeDocSync` bloğu hariç tutulur. Başka biçimde yazılmış satırlar (açıklama ekli rol
hücresi, iş türü satırları) tabloya sayılmaz — iş türü satırları (aşağıda) bu yüzden
serbesttir.

### Kayma kontrolleri

`sync` her çalışmada şunlara bakar (`ownership-drift.mjs`):

1. **Kopyalanmış routing satırı.** Bir routing satırının kendisi — yolu (`services/orders/**`),
   glob'suz dizin biçimi (`services/orders/`, `services/orders`) ya da dosya satırı — bir rol dosyasının
   `ownership` işaretleri içinde ya da bir agent'ın `rules[]`/`extra_instructions[]`
   maddesinde geçerse. Yalnız `/` içeren biçimler aranır (`build.gradle` gibi tek parçalı
   satırlar düz metinde sıradan sözcük olabilir). Daha derin bir yol
   (`services/gateway/docs/<api>/sources/`) yakalanmaz: o, rolün işini tarif eder.
2. **Routing tablosu.** Tablonun `{yol, rol}` kümesi `manifest.routing[]` ile birebir aynı
   olmalı; eksik ve fazla satırlar raporlanır. Tablo hiç bulunmazsa uyarı verilir (eski
   biçim).
3. **Kod–doküman tablosu.** `c:codeDocSync` bloğundaki iki hücresi de tek backtick'li yol olan
   satırlar `manifest.codeDocSync[]` ile aynı olmalı. Blok yoksa kontrol yok.

Bulgular, rol dosyalarından **en az biri** `<!-- ownership -->` işareti taşıdığında kaymadır
(`--check` exit 1). Hiçbiri taşımıyorsa (göç edilmemiş eski kurulum) aynı bulgular uyarıdır ve
sync `team-builder-upgrade`'in "Rol dosyalarını sahiplikten arındır" göçünü önerir.

## Standart satır (koşullu)

- **`docs/**` → dokümantasyonu sahiplenen rol — takımda böyle bir rol varsa.** İlk aday
  architect'tir; **architect yoksa doc-writer** bu satırın sahibidir. Sahip tüm `docs/`
  dizininin sahibidir; dokümantasyon (ADR, kısıt, tasarım, README) yalnız onun tarafından
  yazılır ve bu satır routing tablosuna eklenir (alt klasör — `docs/architecture/adr` vb. —
  tek tek yazılmaz; `docs/**` yeter).
  **İkisi birlikte seçildiyse tablo bölünür:** `docs/**` architect'e kalır, doc-writer'a
  yazacağı alt yol (örn. `docs/guides/**`) **ayrı satır** olarak verilir; verilmezse
  doc-writer yazamaz.
  **Kod yazmayan hiçbir doküman rolü yoksa bu satır üretilmez.** O zaman `docs/` özel
  sahipliği olmayan sıradan bir dizindir ve kod yolu sahipliği kuralları neyse o geçerlidir.

- **`layout: per-module` ise her servis için `<servis>/docs/<mimari-klasör>/**` → architect.**
  Servis, routing'de kod yazan bir role verilmiş üst düzey kod alanıdır (`<servis>/**`,
  `modules/<ad>/**`); hangi satırların servis olduğunu setup kullanıcıya onaylatır.
  `<mimari-klasör>`, `architectureDocs.root`'un son parçasıdır (`docs/architecture` →
  `architecture`, `docs/mimari` → `mimari`). Satır **servis başına** yazılır, joker değil:
  `*/docs/architecture/**` gibi bir satır başka bir servisin `<servis>/docs/**` satırıyla
  kısmen çakışır. Servis satırı `<servis>/**`'ın ve varsa `<servis>/docs/**`'ın içine iç içe
  düşer; servisin `docs/` klasörünün geri kalanı servis için seçilen sahipte (developer ya da
  `<servis>/docs/**` satırının sahibi) kalır. Architect yoksa satır yazılmaz — mimari kararı
  kullanıcı verir, belgeyi değişikliği yapan rol yazar. `layout: central` ise yazılmaz.
  Eski kurulumların `modules/*/docs/**` → doküman sahibi satırı geçerlidir; göç onu
  yeniden yazmaz.

  > Bu satırı atlamak sahipliği sessizce yok eder: sahiplik generator'a **yalnız routing
  > üzerinden** geçer. Tabloya yazılmayan bir sahiplik üretilen talimatlarda yoktur — o rol
  > "dosya değiştirme, yalnız oku" talimatı alır. Doküman yazan bir rolü tabloya yazmadan
  > takıma eklemek, onu yazamaz hâlde kurmaktır.

> **`.agent-work/` — routing tablosuna GİRMEZ.** Plan kapısı açıksa bu dizin agent'ların
> çalışma alanıdır (planlar, ham kayıtlar, ilerleme notları) ve buraya **yalnız `work-plan`
> skill'ini çalıştıran agent** yazar; denetleyiciler dahil kimse doğrudan dosya
> değiştirmez, sonuç döndürür. Ama bu kural `manifest.routing[]`'e **satır olarak
> yazılamaz**: `routing[].role` bir **agent adı** olmak zorundadır ve `work-plan` bir
> agent değil, bir skill'dir — öyle bir satır manifest'i geçersiz kılar. Kural yalnız
> düzyazıdır; sahiplik, çalıştıran agent'ın kim olduğuna değil, hangi skill'i
> çalıştırdığına bağlıdır.

## Temel Kural (DEĞİŞMEZ)

- **Ajansız doğrudan kod yazma YASAKTIR.** Her kod değişikliği görevinde tablodaki
  zorunlu rol çağrılır.
- **Tabloyu bypass eden doğrudan kod yazımı = mimari ihlaldir.** Eşleşen rol varken
  main agent kodu kendisi yazmaz; ilgili role delege eder.
- **Şüphede kalınırsa architect'e danışılır.** Yol bir role net eşleşmiyorsa, ya da
  mimari karar / breaking change / standart belirsizliği varsa önce architect.
  **Architect yoksa danışma hedefi kullanıcıdır** — zincirin ucu boşta kalmaz, belirsizlik
  kullanıcıya taşınır.

Bu üç madde `instructions.md`'nin routing bölümüne **birebir** (genelleştirilmiş
proje adlarıyla) yazılır. "YASAK" ve "bypass = ihlal" ifadeleri yumuşatılmaz.
**Tek istisna üçüncü maddedir:** architect takımda yoksa danışma hedefi "architect"
yerine "kullanıcı" yazılır. Var olmayan bir role birebir atıf yapmak, birebirliği korumak
uğruna kuralı anlamsızlaştırır.

## Tablo Mantığı

Tablo satırı: `<glob/yol> → <rol>`. Eşleşme **en özgül (most-specific) yol önce**
değerlendirilir; bir dosya birden fazla satıra uyarsa en dar glob kazanır.

**Yol dilbilgisi (dar tutulur).** Segment ya düz metin, ya `*` (tek segment), ya `**` (sıfır ya da daha çok segment) olur. Segment içi kısmi joker (`src/*.ts`, `docs/a*`) ve `.`/`..` **kabul edilmez** — routing dizin sahipliği atar, dosya filtresi değil. Ardışık `**` yazılmaz (`docs/**/**`), ve joker içermeyen bir yol (`docs`) o dizinin **alt ağacı** demektir — `docs/**` ile aynıdır.
İki yol **kısmen** çakışıyorsa (biri ötekini kapsamıyorsa, örn. `a/*/c` ile `a/b/*`)
en özgül eşleşme kesişimde bir sahip seçemez; doğrulayıcı böyle bir tabloyu reddeder.
Yollardan birini ötekinin altına al ya da tamamen ayır.

> **Bu cümle tablonun yanına, `instructions.md`'ye de yazılır.** Tablo çakışan satırlar
> taşır (`docs/**` ve `docs/guides/**` gibi) ve çözüm kuralı olmadan hangi rolün sahip
> olduğu okunamaz. Kural burada kalırsa projeye gitmez: bu dosya sihirbazın rehberidir,
> projeye kurulmaz. Tabloyu yazarken çözüm kuralını da yaz.

| Satır türü | Örnek (genel) | Hedef rol |
|---|---|---|
| Backend domain yolu | `apps/<app>/main/src/**`, preload | domain backend-developer |
| Frontend domain yolu | `apps/<app>/renderer/src/**`, `packages/ui-kit/**` | domain frontend-developer |
| Modül/eklenti yolu | `modules/<name>/**` (UI dahil) | extension-developer |
| Mimari karar / ADR / breaking change / standart belirsizliği | (yol değil, iş türü) | architect — yoksa kullanıcı |
| Kod değişikliği tamamlandı, review gerekiyor | (yol değil, kapı) | `reviewer` ya da `planGate.codeReviewer`; kapı sahibi yoksa satır yazılmaz |

Son iki satır **yola değil iş türüne** bağlıdır. İkisi de **koşulludur**: danışma satırı
architect yoksa kullanıcıya döner, gate satırı kapı sahibi yoksa hiç yazılmaz (aşağıya
bakın).

## Routing satırları PROJEYE ÖZELDİR

Yol→rol satırları **jenerik varsayılmaz**. Sihirbaz şu akışı izler:

1. **Proje analizi:** kod köklerini tarar (`apps/*`, `modules/*`, `packages/*`,
   `src/*` vb.), gerçek domain yapısını çıkarır.
2. **Taslak öner:** analize göre bir routing tablosu taslağı + domain-split developer
   rolleri önerir (örn. `apps/api/**` → `backend-developer`, `apps/web/**` →
   `frontend-developer`, `modules/**` → `extension-developer`).
3. **Kullanıcı onayı:** kullanıcı taslağı onaylar, düzeltir veya satır ekler/siler.
   Hiçbir satır kullanıcı onayı olmadan kesinleşmez.
4. **Yazım:** onaylanan tablo hem `project/instructions.md`'nin routing bölümüne
   **hem de** `manifest.routing[]`'e yazılır — rol dosyalarına yazılmaz. Routing **ortak** metindir; hedefe özgü
   dosyalara (`project/CLAUDE.md`, `project/AGENTS.md`) yazılmaz — onlar
   `instructions.md`'ye referans verir.

`manifest.routing[].role` değerleri manifest'teki bir `agents[].name` olmalıdır
(`validate-manifest.mjs` bunu doğrular). Tanımsız role işaret eden routing satırı
geçersizdir.

## Korunan generic danışma kuralları

Yol→rol tablosunun **yanında** projeden bağımsız kurallar durur. Bunlar sabit değil
**koşulludur**: hedefi olmayan bir kural (architect'siz danışma, sahipsiz kod review
kapısı) yazılmaz — var olmayan bir role işaret eden bir kural, kuralsızlıktan kötüdür.

- **Architect'e danış:** mimari karar, ADR, kanal/standart belirsizliği, breaking
  change durumunda kod yazmadan önce architect'e gidilir. **Architect yoksa bu madde
  "kullanıcıya sorulur" olarak yazılır.**
- **Kod review kapısı.** Plan kapısı kapalıysa: her kod değişikliği tamamlandıktan sonra
  `reviewer` çağrılır (review olmadan iş "tamam" sayılmaz). Plan kapısı açıksa tek otorite
  `planGate.codeReviewer`'dır — bir ad verildiyse kural o adla yazılır, `null` ise
  **bu madde hiç yazılmaz** ve projede kod review kapısı yoktur.
- **No-workaround → architect:** belirsizlikte kestirme yol aranmaz; architect'e
  gidilir (bkz. `constitution.md` KARAR 1). **Architect yoksa kullanıcıya sorulur.**

Bu kurallar projeye özel routing satırlarıyla **çelişmez, onları tamamlar**: tablo
"kim yazar"ı, danışma kuralları "ne zaman dur ve sor"u belirler.

## Üretim özeti

- Kaynak: `manifest.routing[]` (`.agent-source/agents/manifest.json`).
- Yazıldığı yer: `.agent-source/project/instructions.md`'nin routing bölümü (hedefe özgü dosyalara değil).
- Doğrulama: `validate-manifest.mjs` — `path` ve `role` dolu, `role` ∈ agent adları.
- Kayma: `sync-agent-config.mjs` tabloyu manifest'le karşılaştırır, rol dosyalarında ve
  manifest kurallarında kopyalanmış routing satırını arar (yukarıda *Kayma kontrolleri*).
- Codex: `developer_instructions`'daki yol satırları her sync'te `manifest.routing[]`'ten
  üretilir.
