# Tasarım: Çapraz Ekosistem Agent Çağırma (`agent-invoke`) — kapsam B

- **Tarih:** 2026-08-11
- **Durum:** Uygulandı — `docs/superpowers/plans/2026-08-11-cross-ecosystem-invoke.md`
- **Kapsam:** Plan kapısı çekirdeğinin (`2026-08-02-plan-gate-design.md`) **B** alt sistemi

> **Revizyon notu.** İlk taslak karşıt incelemeden geçti; üç blocker çıktı ve kaynakta
> doğrulandı: (1) atlama kaydı çekirdeğin yüklem tablosunun **hiçbir satırını** sağlamıyordu,
> yani hata hâli çıkışsızdı; (2) `writesCode: false`'un dosya sistemi izni sandığı için
> sandbox güvencesi **yanlıştı**; (3) `B-R5` doğrulayıcının korunan bir kuralıyla çelişiyordu.
> Kararlar B11–B13 bu turda eklendi.

> Çekirdek spec, KARAR 21 ile bu işi ayrı bir spec'e bıraktı: *"Çapraz ekosistem ayrı spec
> — verdict protokolü başlı başına iş."* Bu doküman o boşluğu doldurur, çekirdeğin geri
> kalanını olduğu gibi bırakır.

## Problem

Çekirdek **tek ekosistem içinde** çalışır: *"denetleyiciler projenin kendi agent'larıdır ve
aynı oturumda, o ekosistemin kendi agent çağırma mekanizmasıyla çalıştırılır. Harici CLI
çağrısı yoktur."*

Bu, çok hedefli projelerde üç şeyi imkânsız kılar:

1. Kapı sahibi yalnız bir ekosistemde üretiliyorsa, öbür ekosistemdeki executor'ın işi
   denetlenemez. Doğrulayıcı bugün böyle bir manifesti **reddediyor**.
2. Denetimi bilerek başka bir ekosisteme yaptırmak (bağımsız ikinci görüş) mümkün değil.
3. Bir ekosistemde yazılan planın başka ekosistemdeki executor tarafından işletilmesi,
   yalnız "plan geçerli ama çalıştırma yetkisi sende değil" durumunda kalır.

## Kapsam

| | Konu | Durum |
|---|---|---|
| **B1** | Kapı sahibine başka ekosistemden ulaşma (çağrı mekanizması) | **Bu spec** |
| **B2** | Verdict protokolü (çıktı sözleşmesi + ayrıştırma) | **Bu spec** |
| **B3** | Hata hâli ve kullanıcı akışı | **Bu spec** |
| — | Executor'ın başka ekosistemde işletilmesi | **Kapsam dışı** — aşağıya bakın |
| — | Inbox'ın dış sisteme bağlanması (C) | Ayrı spec |

**Executor devri neden kapsam dışı:** Kapı sahibi çağrısı **tek seferlik ve okuma
ağırlıklıdır** — bir plan okunur, bir verdict döner. Executor devri ise sürmekte olan bir
işi (dosya yazma, test çalıştırma, `s:progress` güncelleme) başka bir ekosisteme taşımak
demektir; oturum durumu, kısmi ilerleme ve eşzamanlılık sorunlarını beraberinde getirir.
Çekirdek bunu zaten güvenli biçimde ele alıyor: plan geçerlidir, "o ekosistemde açılmayı
bekler". Bu spec o davranışı **değiştirmez**.

## Ön bulgu: `--agent` her yerde yok

Tasarım, CLI'ların agent seçme özelliğine dayanamaz. Yerel kurulumda ölçüldü:

| CLI | Adıyla agent seçme |
|---|---|
| `claude -p --agent <ad>` | var |
| `opencode run --agent <ad>` | var |
| `codex exec` | **yok** (yalnız `-c`, `--profile`) |

Bu yüzden çağrı, rolü **prompt'a gömerek** kurulur (KARAR B3). Team-builder her hedef için
rol tanımını zaten üretiyor, malzeme mevcut.

**Sonradan çıkan ikinci gerekçe:** `--agent` yalnız gereksiz değil, **zararlı**. Verildiği
yerde hedefin kendi konfigürasyonunu yükler — dolayısıyla izinlerini de. OpenCode'da
`permission.edit` doğrudan agent konfigürasyonundan gelir ve doküman sahibi bir rol
meşru biçimde `allow`'dur; `--agent architect` demek, denetleyiciye yazma izni vermek
demektir. Bu yüzden `--agent` **hiçbir ekosistemde verilmez**.

## Terimler

| Terim | Tanım |
|---|---|
| **Çağıran** | Kapıyı işleten oturum; `.agent-work/`'e yazan taraf. |
| **Hedef** | Kapı sahibi agent ve çalıştırılacağı ekosistem. |
| **Rol tanımı** | Hedef ekosistemin üretilmiş agent dosyası: `.codex/agent-definitions/<ad>.md`, `.claude/agents/<ad>.md`, `.opencode/agents/<ad>.md`. |
| **Verdict bloğu** | Hedefin stdout'unda döndürdüğü, işaretle sınırlanmış yapılandırılmış sonuç. |

Çekirdeğin terimleri (**etkin hedefler**, **uygun executor'lar**, `planReviewPassed`)
aynen geçerlidir.

## Çağrı dizisi

Kapı 1 ve kapı 3 için **aynı**:

1. Kapı sahibini manifest'ten al (`planGate.planReviewer` / `codeReviewer`).
2. Sahibin **etkin hedeflerini** çöz. Oturumun ekosistemi bunlardan biriyse → **çekirdek
   davranışı**, bu spec devreye girmez.
3. Değilse hedef ekosistemi seç: etkin hedeflerden biri. Birden fazlaysa **etkin hedefler
   listesinin sırasındaki ilki** alınır — sahibin kendi `targets`'ı varsa o dizinin,
   yoksa `targetsDefault`'un sırası. Kullanıcıya sorulmaz (hata hâli hariç).
4. Hedefin **rol tanımını oku**. Yoksa bu bir hatadır (aşağıya bakın).
5. Prompt'u kur: rol tanımı + plan dosyasının tamamı + çıktı sözleşmesi.
   - **Kapı 3'te ayrıca uygulama farkı taşınır:** temel referans (planın açıldığı
     commit) ve değişen dosyaların listesi. Taze bir denetleyici süreci depoyu
     okuyabilir ama **hangi değişikliğin bu plana ait olduğunu** göremez — çalışma
     ağacı zaten kirliyse ya da birden çok plan sürüyorsa okumak yanıltır. Bu bilgi
     çağıranda vardır; prompt'a konur. Kapı 1'de bu bölüm yoktur (henüz kod yok).
6. CLI'ı **proje kökünde** çalıştır. Hedef, deposu okuyabilmelidir: kapı 1'in reddetme
   ölçütlerinden biri *"yaklaşım mevcut bir ADR'ye aykırı"*dır, yani denetleyicinin
   `docs/` altını okuması gerekir. Prompt planı taşır, depo bağlamını taşımaz.
   - **Sahibin `sandbox_mode`'u çağrıya taşınmaz.** `writesCode: false` dosya sistemi
     izni değildir: doküman sahibi bir rol `writesCode: false` **ve**
     `sandbox_mode: workspace-write` olabilir, üstelik bu meşrudur
     (`opencode-target.md`: *"İkisini tek bayrağa indirgeme"*). Rolün kendi izinleri
     eşlenirse hedef `.agent-work/`'e yazabilir. Denetim çağrısı hiçbir şey yazmaz; bu
     yüzden izin **rolden değil çağrı türünden** gelir. Her ekosistemde o CLI'ın en
     kısıtlayıcı mekanizması kullanılır — ve mekanizmanın gücü ekosisteme göre değişir,
     bkz. *Salt-okunurluk ne kadar zorlanıyor*.
   - **Zaman aşımı: varsayılan 10 dakika.** Etkileşimsiz koşuda izin istemine takılan bir
     çağrı da burada yakalanır; süresiz bekleme kapıyı sessizce kilitler. Süre dolunca
     **süreç ağacının tamamı** sonlandırılır — CLI'lar alt süreç açar, yalnız üstü
     öldürmek çağrıyı arkada bırakır.
7. stdout'tan verdict bloğunu ayrıştır.
8. Kaydı **çağıran** yazar. Hedef `.agent-work/`'e dokunmaz — çekirdeğin kuralı: *"Denetleyiciler
   dosya değiştirmez; sana sonuç döndürür, kaydı sen yazarsın."*

## Verdict bloğu

Hedeften istenen çıktı, işaretle sınırlıdır. Bloğun **tamamı** — işaretler, alan adları,
enum değerleri — dilden bağımsızdır; yalnız hedefe bloğu nasıl dolduracağını anlatan
**açıklama metni** `docLanguage`'e çevrilir. Çekirdeğin bölüm işareti disiplininin aynısı:

```
<!-- verdict -->
verdict: approved | rejected
reviewed_revision: <pozitif tam sayı>
reasons:
- <madde>
- <madde>
<!-- /verdict -->
```

**Ayrıştırma kuralları — belirlenimci olmalı.** "Şemaya uymuyorsa hata" cümlesi tek başına
uygulanamaz; bir uygulayıcının protokol detayı uydurmak zorunda kalmaması için:

- Açılış ve kapanış işaretleri **kendi satırlarında ve tam eşleşmeli** (baş/son boşluk
  dışında başka karakter yok). stdout'ta **tam bir açılış ve tam bir kapanış**, bu sırayla.
  Sıfır, ikiden çok ya da ters sıra → hata.
- Alan adları ve enum değerleri sabittir: `verdict`, `reviewed_revision`, `reasons`,
  `approved`, `rejected`. Çevrilmiş bir alan adı → hata.
- Blok içinde **yalnız bu üç alan** bulunur. Bilinmeyen alan, tekrarlanan alan ya da eksik
  alan → hata. (Tekrar "ilk mi son mu kazanır" sorusunu ayrıştırıcıya bırakmak,
  aynı çıktının iki ayrıştırıcıda iki farklı karar vermesi demektir.)
- `verdict` yalnız `approved` ya da `rejected` olabilir. `skipped` **hedeften gelmez** —
  o yalnız çağıranın yazdığı bir değerdir.
- Blok **dışındaki** metin yok sayılır — modeller düşünme/özet metni yazar.
- **Öncelik:** zaman aşımı ya da çıkış kodu ≠ 0, geçerli bir blok bulunsa **bile** taşıma
  hatasıdır ve blok yok sayılır. Sağlıklı bitmemiş bir süreçten çıkan blok güvenilmez.
- **Hata `rejected` değildir.** İkisini karıştırmak, ulaşılamayan bir kapıyı "reddetti"
  sayıp planı düzeltme döngüsüne sokar; daha kötüsü, ayrıştırma hatasını "onayladı"
  saymak sessiz onaydır.

Bunu davranışsal değil **mekanik** kılmak için çağrı **tek bir yardımcıdan** geçer ve üç
ayrık sonuçtan birini döndürür: `transport_error` (ulaşılamadı/yetkisiz/zaman aşımı/çıkış
≠ 0), `protocol_error` (blok yok/çok/şema dışı), `verdict` (geçerli sonuç). **Yalnız
sonuncusu kayıt yazdırabilir.** İki hata sınıfı ayrı tutulur çünkü kullanıcıya sunulan
seçenekler farklıdır: `transport_error`'da "tekrar dene" anlamlıdır, `protocol_error`'da
genelde değildir.

`reasons` **hedefin bloğunda** `rejected` için boş olamaz; `approved`'da boş **olmalıdır**
— hedef yine de madde yazmışsa çağıran onları **atar** ve kaydı `reasons: []` ile yazar.
Çekirdek şeması `approved` kayıtlarında `[]` istiyor; normalizasyon çağıranda yapılır,
hedefin nezaketine bırakılmaz. Boş liste kayıtta **tam olarak `[]`**'dir.

Çağıran bu bloktan çekirdeğin kayıt şemasını üretir. `by` alanı **çağıranın bilgisidir**,
hedefin döndürdüğü bir değer değildir: hedef kendi kimliğini beyan etmez, çağıran kimi
çağırdığını bilir. Bu, hedefin **başka bir kimlik iddia etmesini** engeller — ama
protokol, seçilen denetleyicinin *dürüst* olduğuna semantik olarak güvenmek zorundadır:
sözdizimsel olarak geçerli ama yalan bir `approved` bloğu ayırt edilemez. Korunan şey
kimlik ve akış bütünlüğüdür, denetimin kalitesi değil.

## Veri modeli

**Kayıt şeması — alan listesi değişmez.** Beş alan, kapalı liste. `substituted_for` gibi
bir alan eklenmedi (KARAR B6). Değişen, `by`'ın **değer grameri** ve yüklemin bunu nasıl
okuduğudur.

**Değişiklik 1 — ekosistem kısıtı gevşer.**

| | Bugün | Bu spec ile |
|---|---|---|
| `kayıt.by` | `<executor'ın ekosistemi>/<güncel denetleyici adı>` | `<denetimin çalıştığı ekosistem>/<güncel denetleyici adı>` |
| Ekosistem kısıtı | executor'ınkiyle aynı olmalı | denetleyicinin **etkin hedeflerinden biri** olmalı |

Ad karşılaştırması **aynen korunur**: kapı sahibi değişirse eski onaylar düşer. Gevşeyen
tek şey ekosistemdir — ki çekirdekteki hâli, "tek ekosistem" varsayımının doğrudan
sonucuydu. O varsayım kalkınca kural B'yi imkânsız kılıyordu: denetim tanım gereği başka
ekosistemde çalışır, dolayısıyla `kayıt.by` hiçbir zaman beklenen değere eşit olamazdı.

**Değişiklik 2 — yüklem tabloları üçüncü satır alır.** Bu, tasarımın en kolay atlanan
noktasıydı: çekirdeğin `planReviewPassed` tablosunda **iki** satır var — denetleyici bir
ad taşıyorsa son kayıt `approved` olmalı, `null` ise son kayıt `skipped` olmalı. Adlı bir
denetleyici için `skipped` **hiçbir satırı sağlamaz**. Yani atlama kaydı yazılsa bile
yüklem `false` kalır ve plan ilerleyemez; hata hâli çıkışsız kalırdı.

| Projenin denetleyicisi | Son kayıt | Ek koşul | Yüklem |
|---|---|---|---|
| Bir agent adı | `approved` | `by` = `<denetimin ekosistemi>/<güncel ad>` | doğru |
| Bir agent adı | `skipped` | `by` = **`user/<güncel ad>`** | doğru |
| `null` | `skipped` | `by` = `system`, sahip hâlâ `null` | doğru |

`by: user/<ad>` — çıplak `user` **değil**. Neden ad taşımak zorunda: atlama, adı geçen
denetleyici için verilmiş bir feragattir. Ad taşımazsa sonradan denetleyici değiştiğinde
feragat ayakta kalır ve *"kapı sahibi değişirse eski onaylar düşer"* güvencesini (B7,
B-N10) delerdi — yeni sahip hiç görmediği bir planı onaylamış sayılırdı. Adı `by`'a
gömmek, onay yolunun kullandığı **aynı dize karşılaştırmasını** kullanır: şema açılmaz,
yeni alan gerekmez, kural tek yerde kalır.

`user` bir ekosistem adı **değildir**. Ayrıştırıcı `by`'ı bölerken ön eki bilinen ekosistem
kümesine **ya da** `user` sabitine karşı denetler; `approved`/`rejected` kayıtlarında
`user/` ön eki **asla** kabul edilmez.

Her iki değişiklik `done/`'a taşıma yetkisi için de geçerlidir (kapı 3), çünkü o da aynı
ölçüyü kullanır.

## Hata hâli

**Hata sınıfları** — hepsinde ortak sonuç: **kayıt yazılmaz**, plan bulunduğu klasörde kalır.

| Sınıf | Örnek |
|---|---|
| Ulaşılamıyor | CLI kurulu değil, `PATH`'te yok |
| Yetkisiz | kimlik doğrulama yok/süresi geçmiş |
| Zaman aşımı | süre doldu (etkileşimsiz koşuda izin istemi de burada takılır) |
| Başarısız | çıkış kodu ≠ 0 |
| Ayrıştırılamaz | verdict bloğu yok, birden çok, ya da alanları şemaya uymuyor |
| Bayat | `reviewed_revision` ≠ diskteki `revision` — **çekirdeğin mevcut kuralı** |
| Kaynak yok | hedef ekosistemde rol tanımı dosyası bulunamadı |

**Kullanıcıya sunulan seçenekler** (bu sırayla):

1. **Tekrar dene** — geçici hatalarda.
2. **`<sahip>`'i `<başka ekosistem>`'de çalıştır** — yalnız sahibin **etkin hedeflerinden**
   ve rol tanımı **gerçekten üretilmiş** olanlar listelenir. Böyle bir ekosistem yoksa bu
   madde **hiç gösterilmez**. Öneri manifest'ten türer; agent ad uydurmaz.
3. **Bu kapıyı atla** — `{ by: user/<sahibin adı>, at: <bugün>, revision: <plan.revision>,
   verdict: skipped, reasons: [<kullanıcının gerekçesi>] }`.

2. seçenek **farklı bir agent değildir**, aynı sahibin başka ekosistemidir; bu yüzden
`planReviewPassed` doğal olarak sağlanır ve şema değişmez. Kullanıcı gerçekten başka bir
denetleyici istiyorsa bu, kapı sahibini değiştirmektir ve çekirdeğin *"Kapı sahipleri
değişirse"* kuralları devreye girer.

### `by: user/<ad>` ve KARAR 18

Çekirdeğin KARAR 18'i: *"Eşik yok, kaçış kullanıcıda ve **izlenmez**"*; gerekçesi *"eşik
kararını agent verirse kapı sessizce atlanır"*. O kaçış **"plansız yap"**tır: dosya hiç
oluşmaz, iş sistemin dışında kalır.

B'nin hata hâli o vakanın kapsamadığı bir durumdur: plan dosyası **vardır**, sistemin
içindedir, ama kapıya ulaşılamamaktadır. Hiçbir kayıt tutulmazsa plan geçersiz hâlde
`approved/`'a geçer ve klasör değişmezi kırılır. Bu yüzden atlama **izlenir**.

KARAR 18'in gerekçesiyle çelişmez: kararı agent değil **kullanıcı** verir ve kalıcı kayda
geçer — sessiz değildir. Alternatif (atlamayı hiç sunmamak) kullanıcıyı planı terk edip
denetimsiz çalışmaya iterdi; bu **daha az** görünür olurdu.

`user/<ad>` çekirdek gramerine yeni bir değerdir. Gramer şimdi: `<ekosistem>/<agent-adı>`
**ya da** `system` **ya da** `user/<agent-adı>`. `system` yalnız "denetleyici tanımsız"
hâlindedir; `user/<ad>` yalnız "adı geçen kapı sahibine ulaşılamadı, kullanıcı atladı"
hâlindedir. İkisi de yalnız `skipped` kayıtlarında bulunur; `approved`/`rejected`
kayıtlarında **asla**.

**Bunun yaptırımı yok, olduğu gibi yazılmalı.** Ne kayıt ne klasör durumu, başarısız bir
çağrının gerçekten olduğunu kanıtlar: kullanıcı kimlik doğrulamayı bilerek bozup her
kapıda atlama isteyebilir. Yani bu, *"yalnız ulaşılamadığında"* diye **zorlanan** bir
kural değil, **insan feragatidir**; sistemin sağladığı şey feragatin kalıcı ve görünür
olmasıdır. Çekirdek zaten daha geniş bir kaçışa (izlenmeyen "plansız yap") izin verdiği
için bu bir yetki yükselmesi değildir — ama "yalnız hata hâlinde" ifadesi bir niyet
beyanıdır, doğrulanan bir koşul değil.

**`reasons` kuralı bu vaka için genişler.** Çekirdek şöyle diyor: *"`approved` ve `skipped`
kayıtlarında `[]`"*. O kural yazıldığında `skipped`'ın tek anlamı "denetleyici tanımsız"dı
— söylenecek bir gerekçe yoktu. `by: user/<ad>` atlamasının **gerekçesi vardır** ve kaydın
denetim değeri tam olarak ondadır: hangi planın hangi kapıyı neden atladığı. Yeni hâli:

| `skipped` kaydı | `reasons` |
|---|---|
| `by: system` (denetleyici tanımsız) | `[]` — çekirdek, değişmedi |
| `by: user/<ad>` (kapıya ulaşılamadı, atlandı) | **boş olamaz** — kullanıcının gerekçesi |

Gerekçesiz bir kullanıcı atlaması kabul edilmez; kullanıcı gerekçe vermezse kapı atlanmaz.

**Çekirdeğin N14 kuralı revize edilir.** Bugün: *"`skipped` kaydında `by` değeri `system`
değil → Reddedilir"*. Bu kural, `skipped`'ın tek anlamının "denetleyici tanımsız" olduğu
varsayımıyla yazılmıştı. Yeni hâli:

> `skipped` kaydında `by` değeri **`system` ya da `user/<agent-adı>`** olmalı; başka bir
> değer — çıplak `user` dahil — reddedilir. `approved`/`rejected` kayıtlarında ikisi de
> **asla** bulunmaz (N15 aynen kalır).

**Aynı kuralı tekrarlayan yerlerin hepsi birlikte güncellenmelidir**; biri geride kalırsa
doğrulayıcı ile skill birbirini yalanlar. Grameri **ve** yüklemi ayrı ayrı taşıyan
noktalar:

| Yer | Ne tanımlıyor |
|---|---|
| `plan-gate.md` — kayıt şeması | `by` grameri, `reasons` kuralı |
| `plan-gate.md` — `planReviewPassed` tablosu | yüklem satırları |
| `templates/work-plan-skill.md` — denetim kaydı şeması | `by` grameri, `reasons` kuralı |
| `templates/work-plan-skill.md` — `planReviewPassed` tablosu | yüklem satırları |
| `templates/work-plan-skill.md` — `done/`'a taşıma yetkisi | aynı ölçünün kapı 3 kopyası |
| Çekirdek spec'in kayıt tanımı + N14 | referans metin |

## Komut eşlemesi

Ekosistem → komut eşlemesi **araçta sabittir**. Manifest'te **yalnız çalıştırılabilir
dosyanın yolu** override edilebilir; argümanlar edilemez.

| Ekosistem | Varsayılan çağrı | Prompt nasıl gider |
|---|---|---|
| `codex` | `codex exec --sandbox read-only -` | **stdin** |
| `opencode` | `opencode run` | **stdin** |
| `claude` | `claude -p --allowedTools Read,Grep,Glob` | **stdin** |

**`--agent` hiçbir ekosistemde verilmez.** İlk taslak, destekleyen iki ekosistemde
verilmesini öngörüyordu. Ölçüm bunun yanlış olduğunu gösterdi: `--agent`, hedefin kendi
konfigürasyonunu yükler — **tam da salt-okunur kuralının "bakma" dediği izinleri**.
OpenCode'da `permission.edit` doğrudan agent konfigürasyonundan gelir ve doküman sahibi
bir rol meşru biçimde `allow`'dur; `--agent architect` demek, denetleyiciye yazma izni
vermek demektir. KARAR B3 rolü zaten prompt'a gömdüğü için `--agent` hiçbir şey
kazandırmıyordu — kaldırmak tek kod yolunu da güçlendirir.

**Prompt argüman değil, stdin.** Prompt rol tanımının **tamamını** ve plan dosyasının
**tamamını** taşır — kolayca on binlerce karakter. Argüman olarak geçirmek işletim
sisteminin argüman uzunluğu sınırına (`ARG_MAX`) ve tırnak/kaçış hatalarına açıktır.
Süreç **kabuk olmadan** başlatılır (`argv` dizisiyle), yani kabuk enjeksiyonu diye bir
yüzey kalmaz.

**Override neden yalnız yol:** manifest'e serbest kabuk komutu koymak, üretilen
konfigürasyona keyfi komut yerleştirmek demektir — spec'in kendi tanımladığı riskin ta
kendisi. Yol override'ı (`planGate.cli.<ekosistem>: <yürütülebilir yol>`) `PATH`'te
olmayan bir kuruluma işaret etme ihtiyacını karşılar, argüman kurgusunu araçta bırakır
ve manifest'te tek satırda denetlenebilir kalır. Alan verilmezse ekosistemin adı `PATH`'ten
çözülür.

### Salt-okunurluk ne kadar zorlanıyor

Kural tektir — **denetim çağrısı hiçbir şey yazmaz** — ama üç CLI'ın bunu zorlama gücü
farklıdır ve bu **olduğu gibi yazılmalıdır**; "sandbox engeller" demek, engellemediği
yerde yanlış bir güvenlik iddiasıdır.

| Ekosistem | Mekanizma | Gücü |
|---|---|---|
| `codex` | `--sandbox read-only` | **İşletim sistemi düzeyinde.** Yazma denemesi başarısız olur. |
| `claude` | `--allowedTools Read Grep Glob` | **İzin listesi.** Yazma araçları hiç verilmez; liste kapalı olduğu için sonradan eklenen bir araç da otomatik dışarıda kalır. |
| `opencode` | — | **Yok.** `opencode run`'da salt-okunur bayrağı bulunmuyor; tersi var (`--dangerously-skip-permissions`). |

OpenCode'daki boşluk kapatılamıyor, bu yüzden **azaltılıyor ve açıkça yazılıyor**:
`--agent` verilmediği için hedef, denetleyicinin izin verici konfigürasyonunu yüklemez.
Kalan koruma mekanik değil, sözleşmeseldir: çekirdeğin *"`.agent-work/` altına yalnız sen
yazarsın"* kuralı ve rol metninin kendisi. Bu, çağrıyı yapan tarafın kaydı yazmasıyla
birleştiğinde **kaydın bütünlüğünü** korur; hedefin depoya hiç dokunamayacağını
garanti etmez.

**Çağrı rol taklididir, tam konfigürasyon değil — üçünde de.** `--agent` verilmediği
için hiçbir ekosistemde agent'ın kendi model/effort ayarı uygulanmaz; çağrı, o CLI'ın o
oturumdaki varsayılan modeliyle koşar. Prompt'a yalnız rol tanımı dosyası gömülür
(`.codex/agent-definitions/<ad>.md`, `.claude/agents/<ad>.md`,
`.opencode/agents/<ad>.md`). Bu bilinçli bir sınırdır: denetim kararı rol metnine
dayanır. Sonuç olarak ekosistemler arası **birebir aynı karar beklenmemelidir**.

## Doğrulayıcı değişikliği

| Kural | Bugün | Bu spec ile |
|---|---|---|
| Kapı sahibinin kapsaması | Sahibin etkin hedefleri, uygun executor'ların etkin hedeflerinin birleşimini **kapsamalı** | **Kaldırılır** |

**Yerine yeni bir kural gelmez.** "Kapı sahibinin en az bir etkin hedefi olmalı" diye bir
kural eklemek gereksizdi: doğrulayıcı bunu **zaten her agent için** istiyor — *"hedef
belirtilmeli — `agents[].targets` ya da kök `targetsDefault`"*. Kapı sahibi de bir
agent'tır, kural onu da kapsar. Ayrı bir kural yazmak, var olanı iki yerde tekrarlamaktan
başka bir şey yapmazdı.

Çekirdeğin öbür plan kapısı kuralları (`planGate` nesnesinin varlığı, sahiplerin
`writesCode: false` olması, hedeflenen her ekosistemde bir executor bulunması) **aynen
kalır**.

**"Hedeflenen her ekosistemde executor" kuralının B'ye etkisi.** Bu kural, hedeflenen
ekosistemleri **tüm agent'ların** etkin hedeflerinden hesaplar — denetleyici dahil.
Dolayısıyla yalnız `codex`'te üretilen bir kapı sahibi `codex`'i "hedeflenen" yapar ve
`codex`'te bir executor bulunmasını zorunlu kılar. Kapsama kuralı kalksa bile bu kural
yerinde durur.

Pratikte engel değildir: tipik manifestte executor `targetsDefault`'un tamamını hedefler,
yani sahibin bulunduğu ekosistemde de bulunur. Engellediği tek kurgu **executor'ı hiç
olmayan, salt-denetleyici bir ekosistem**'dir; o kurgu bu spec'in **kapsamı dışındadır**
(aşağıya bakın). B'nin çözdüğü asıl durum — sahip oturumun ekosisteminde **yok**, ama
başka bir ekosistemde var ve orada iş de yapılıyor — bu kuralla çelişmez.

## team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `templates/work-plan-skill.md` | Yeni **"Başka ekosistemdeki kapı sahibi"** bölümü: çağrı dizisi, verdict bloğu + ayrıştırma kuralları, üç sonuç sınıfı, hata seçenekleri, `--agent` verilmemesi ve salt-okunurluğun ekosisteme göre değişen gücü, kapı 3'ün uygulama farkı. `by` gramerine `user/<ad>` eklenir; `reasons` kuralı genişler; **`planReviewPassed` ve `done/` yetki tabloları üçüncü satırı alır**. |
| `plan-gate.md` | Kayıt şemasında `by` grameri + `reasons` kuralı **ve** `planReviewPassed` tablosu güncellenir (kurulum sözleşmesi skill ile aynı şeyi söylemeli). |
| `validate-manifest.mjs` | Kapsama kuralı kaldırılır; **yerine yeni kural gelmez**. Opsiyonel `planGate.cli.<ekosistem>` yol alanı şemaya girer. Kural listesi ve selftest'ler buna göre. |
| `manifest-schema.md` | Doğrulama kuralları listesi + `planGate.cli` alanı (sihirbazın elle doğrulama fallback'i buraya bakıyor). |
| `validate-plan-gate.mjs` | Şablon/doküman denetimleri `by` gramerinin **ve yüklem tablolarının** yeni hâlini belgeliyor mu diye genişletilir. |
| Çekirdek spec (`2026-08-02-...`) | N14 revizyonu, yüklem tablosunun üçüncü satırı ve KARAR 21'in kapatıldığı bu spec'e işaret edilir. |
| `codex-target.md` / `opencode-target.md` | Komut eşlemesi, `--agent` verilmemesi, salt-okunurluğun ekosisteme göre değişen gücü (opencode'da bayrak **yok**), model/effort'un **üçünde de** uygulanmadığı sınır. |

**Üretilen dosyalarda değişiklik yok.** B, üretim (`sync`) çıktısını değiştirmez; yalnız
runtime davranışını ve doğrulama kurallarını değiştirir.

## Kabul kriterleri

### Olumlu (R)

| # | Durum | Beklenen |
|---|---|---|
| B-R1 | Sahip oturumun ekosisteminde | Çekirdek davranışı; çapraz çağrı kurulmaz |
| B-R2 | Sahip yalnız başka ekosistemde, CLI çalışıyor | Rol tanımı gömülür, çağrı yapılır, verdict ayrıştırılır, kayıt `by: <hedef eko>/<ad>` ile yazılır |
| B-R3 | Sahip birden çok ekosistemde, oturumunki yok | `targets` sırasındaki ilk hedef seçilir; kullanıcıya sorulmaz |
| B-R4 | `reviewed_revision` = diskteki `revision` | Kayıt yazılır |
| B-R5 | Sahip yalnız `codex`'te; executor `claude` **ve** `codex` hedefliyor | Manifest **geçerli** (kapsama kuralı kalktı) |
| B-R6 | Kullanıcı "başka ekosistemde çalıştır" seçti | Kayıt o ekosistemle yazılır, `planReviewPassed` doğru |
| B-R7 | Kullanıcı atladı | `{ by: user/<sahip>, verdict: skipped, reasons: [gerekçe] }`; yüklem **doğru**, plan ilerleyebilir |
| B-R8 | Kapı 3'te çapraz çağrı | Kapı 1 ile aynı dizi + uygulama farkı prompt'a eklenir; `done/` yetkisi aynı gevşemiş ölçüyü kullanır |
| B-R9 | Sahip `sandbox_mode: workspace-write` | Çağrıya sahibin izinleri **taşınmaz**; `--agent` verilmez, ekosistemin kendi salt-okunur mekanizması kullanılır |
| B-R10 | Hedef `approved` döndürdü ama `reasons` dolu | Kayıt `reasons: []` ile yazılır (normalizasyon) |

### Olumsuz (N)

| # | Durum | Beklenen |
|---|---|---|
| B-N1 | Verdict bloğu yok | **Hata** — kayıt yazılmaz, `rejected` sayılmaz |
| B-N2 | Verdict bloğu birden çok | **Hata** |
| B-N3 | `verdict` şema dışı (`ok`, `pending`) | **Hata** |
| B-N4 | `rejected` ama `reasons` boş | **Hata** |
| B-N5 | `reviewed_revision` ≠ diskteki `revision` | Kayıt yazılmaz, denetim tekrarlanır |
| B-N6 | CLI yok / yetkisiz / zaman aşımı / çıkış ≠ 0 | **`transport_error`** — kayıt yazılmaz, kullanıcıya seçenekler sunulur |
| B-N7 | Hedefte rol tanımı dosyası yok | **Hata** |
| B-N8 | Kapı sahibinin etkin hedefleri boş | Manifest **reddedilir** — *mevcut* genel kural, regresyon testi |
| B-N9 | `user/<ad>` bir `approved`/`rejected` kaydında | **Reddedilir** — yalnız `skipped` |
| B-N10 | Kapı sahibi değişti, eski adla kayıt var | `planReviewPassed` **yanlış** — ad karşılaştırması korunur |
| B-N11 | Kayıt ekosistemi sahibin etkin hedeflerinde değil | `planReviewPassed` **yanlış** |
| B-N12 | Hedef `.agent-work/`'e yazmaya kalktı | `codex`/`claude`'da mekanizma engeller; `opencode`'da **engellenmez** — koruma sözleşmeseldir ve kaydı yalnız çağıran yazar |
| B-N13 | `by: user/<ad>` kaydında `reasons` boş | **Reddedilir** — gerekçesiz atlama yok |
| B-N14 | Çağrı 10 dakikayı aştı | Zaman aşımı hatası; kayıt yazılmaz; süreç ağacı sonlandırılır |
| B-N15 | Çıplak `by: user` (adsız) | **Reddedilir** — feragat bir sahibe bağlı olmalı |
| B-N16 | Atlama kaydı var, sonra kapı sahibi değişti | `planReviewPassed` **yanlış** — feragat de düşer, onay gibi |
| B-N17 | Blok içinde bilinmeyen ya da tekrarlanan alan | **`protocol_error`** |
| B-N18 | İşaret satır ortasında ya da kapanış açılıştan önce | **`protocol_error`** |
| B-N19 | Geçerli blok var **ama** çıkış kodu ≠ 0 / zaman aşımı | **`transport_error`** — blok yok sayılır |

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| B1 | Çağrı otomatik ve senkron; çekirdeğin "harici CLI çağrısı yok" ilkesi bu kapsamda kalkar | Kullanıcı her kapıda röle olmamalı |
| B2 | Executor devri kapsam dışı | Tek seferlik okuma çağrısıyla sürmekte olan iş devri aynı problem değil |
| B3 | Rol prompt'a gömülür; `--agent` **hiçbir ekosistemde verilmez** | `codex exec`'te zaten yok; verildiği yerlerde hedefin izin verici konfigürasyonunu yükleyip salt-okunur kuralını deliyordu |
| B4 | Verdict işaretle sınırlı blokla döner | Başlıklar çevrilir, işaretler çevrilmez — çekirdek disiplini |
| B5 | Ayrıştırma hatası ≠ `rejected` | İkisini karıştırmak sessiz onaya ya da yanlış düzeltme döngüsüne yol açar |
| B6 | Kayıt şeması kapalı kalır; `substituted_for` **eklenmez** | Vekil yerine "aynı sahibin başka ekosistemi" yeterli; şema açmaya değmez |
| B7 | `planReviewPassed`'ın ekosistem kısıtı gevşer, ad kısıtı korunur | Ekosistem kısıtı tek-ekosistem varsayımının sonucuydu; ad kısıtı güvenlik özelliği |
| B8 | Atlama izlenir ve `user/<ad>` ile **sahibe bağlanır** | KARAR 18'in kapsamadığı vaka; ada bağlamak feragatin sahip değişince düşmesini sağlar — yeni alan gerekmeden |
| B9 | Komut eşlemesi sabit; override **yalnız yürütülebilir yolu** | Serbest kabuk komutu spec'in kendi saydığı riskin ta kendisi; yol tek satırda denetlenebilir |
| B10 | Doğrulayıcının kapsama kuralı kalkar, **yerine bir şey gelmez** | "En az bir etkin hedef" kuralı zaten her agent için var; tekrarlamak koruma eklemez |
| B11 | Çağrıya rolün `sandbox_mode`'u **taşınmaz**; her ekosistemde o CLI'ın en kısıtlayıcı mekanizması kullanılır ve `opencode`'daki boşluk açıkça yazılır | `writesCode: false` dosya sistemi izni değil; doküman sahibi roller meşru biçimde `workspace-write` olabilir. Zorlanamayan bir garantiyi zorlanıyormuş gibi yazmak, yanlış güvenlik iddiasıdır |
| B12 | Prompt stdin'den gider, süreç kabuksuz başlatılır | Rol + planın tamamı `ARG_MAX`'ı zorlar; kabuksuz `argv` enjeksiyon yüzeyini kaldırır |
| B13 | Kapı 3 prompt'una uygulama farkı eklenir | Taze süreç, kirli çalışma ağacında hangi değişikliğin bu plana ait olduğunu göremez |

## Kapsam dışı

- **Executor'ın başka ekosistemde işletilmesi.** Yukarıda gerekçelendirildi.
- **Vekil denetleyici** (kapı sahibi yerine başka bir agent). KARAR B6.
- **Salt-denetleyici ekosistem** — içinde hiç executor bulunmayan, yalnız kapı sahibi
  üretilen bir ekosistem. Çekirdeğin *"hedeflenen her ekosistemde executor"* kuralı bunu
  reddediyor ve o kural bu spec'te **korunuyor**: gerçek bir tehlikeyi önlüyor, o
  ekosistemi açan kullanıcı hiç iş yapamaz. B bunu gerektirmiyor — B'nin çözdüğü durum
  "sahip oturumun ekosisteminde yok", "sahibin ekosisteminde kimse çalışmıyor" değil.
  İstenirse ayrı bir değişiklik olur.
- **Inbox'ın dış sisteme bağlanması** (C). Ayrı spec.
- **Preset'i kurulum sonrası açma/kapama** (E). Proje-yükseltme skill'i.
- **Paralel/eşzamanlı çapraz çağrı.** Kapılar sıralıdır; eşzamanlılık ihtiyacı yok.
