# Tasarım: Çapraz Ekosistem Agent Çağırma (`agent-invoke`) — kapsam B

- **Tarih:** 2026-08-11
- **Durum:** Onaylandı — uygulama planı bekliyor
- **Kapsam:** Plan kapısı çekirdeğinin (`2026-08-02-plan-gate-design.md`) **B** alt sistemi

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
6. CLI'ı **proje kökünde** çalıştır. Hedef, deposu okuyabilmelidir: kapı 1'in reddetme
   ölçütlerinden biri *"yaklaşım mevcut bir ADR'ye aykırı"*dır, yani denetleyicinin
   `docs/` altını okuması gerekir. Prompt planı taşır, depo bağlamını taşımaz.
   - `sandbox_mode` CLI'ın sandbox bayrağına eşlenir; karşılığı yoksa **en kısıtlayıcı**
     seçilir. Kapı sahipleri `writesCode: false` olduğu için hedef hiçbir durumda yazma
     iznine ihtiyaç duymaz — sandbox okuma-yazma vermez ve `.agent-work/`'ü fiilen korur.
   - **Zaman aşımı: varsayılan 10 dakika.** Etkileşimsiz koşuda izin istemine takılan bir
     çağrı da burada yakalanır; süresiz bekleme kapıyı sessizce kilitler.
7. stdout'tan verdict bloğunu ayrıştır.
8. Kaydı **çağıran** yazar. Hedef `.agent-work/`'e dokunmaz — çekirdeğin kuralı: *"Denetleyiciler
   dosya değiştirmez; sana sonuç döndürür, kaydı sen yazarsın."*

## Verdict bloğu

Hedeften istenen çıktı, işaretle sınırlıdır. Başlıklar `docLanguage`'e çevrilir, **işaretler
çevrilmez** — çekirdeğin bölüm işareti disiplininin aynısı:

```
<!-- verdict -->
verdict: approved | rejected
reviewed_revision: <pozitif tam sayı>
reasons:
- <madde>
- <madde>
<!-- /verdict -->
```

- Blok **tam olarak bir kez** bulunmalı. Yoksa, birden çoksa, alanları eksikse ya da
  değerler şemaya uymuyorsa bu bir **hatadır**.
- **Hata `rejected` değildir.** İkisini karıştırmak, ulaşılamayan bir kapıyı "reddetti"
  sayıp planı düzeltme döngüsüne sokar; daha kötüsü, ayrıştırma hatasını "onayladı"
  saymak sessiz onaydır.
- `reasons` boş olabilir yalnız `approved`'da; `rejected`'da boş olamaz — çekirdek şeması.

Çağıran bu bloktan çekirdeğin kayıt şemasını üretir. `by` alanı **çağıranın bilgisidir**,
hedefin döndürdüğü bir değer değildir: hedef kendi kimliğini beyan etmez, çağıran kimi
çağırdığını bilir.

## Veri modeli

**Kayıt şeması değişmez.** Beş alan, kapalı liste. `substituted_for` gibi bir alan
eklenmedi (KARAR B6).

**Değişen tek kural — `planReviewPassed`'ın kimlik karşılaştırması.**

| | Bugün | Bu spec ile |
|---|---|---|
| `kayıt.by` | `<executor'ın ekosistemi>/<güncel denetleyici adı>` | `<denetimin çalıştığı ekosistem>/<güncel denetleyici adı>` |
| Ekosistem kısıtı | executor'ınkiyle aynı olmalı | denetleyicinin **etkin hedeflerinden biri** olmalı |

Ad karşılaştırması **aynen korunur**: kapı sahibi değişirse eski onaylar düşer. Gevşeyen
tek şey ekosistemdir — ki çekirdekteki hâli, "tek ekosistem" varsayımının doğrudan
sonucuydu. O varsayım kalkınca kural B'yi imkânsız kılıyordu: denetim tanım gereği başka
ekosistemde çalışır, dolayısıyla `kayıt.by` hiçbir zaman beklenen değere eşit olamazdı.

Aynı gevşeme `done/`'a taşıma yetkisi için de geçerlidir (kapı 3), çünkü o da aynı ölçüyü
kullanır.

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
3. **Bu kapıyı atla** — `{ by: user, at: <bugün>, revision: <plan.revision>,
   verdict: skipped, reasons: [<kullanıcının gerekçesi>] }`.

2. seçenek **farklı bir agent değildir**, aynı sahibin başka ekosistemidir; bu yüzden
`planReviewPassed` doğal olarak sağlanır ve şema değişmez. Kullanıcı gerçekten başka bir
denetleyici istiyorsa bu, kapı sahibini değiştirmektir ve çekirdeğin *"Kapı sahipleri
değişirse"* kuralları devreye girer.

### `by: user` ve KARAR 18

Çekirdeğin KARAR 18'i: *"Eşik yok, kaçış kullanıcıda ve **izlenmez**"*; gerekçesi *"eşik
kararını agent verirse kapı sessizce atlanır"*. O kaçış **"plansız yap"**tır: dosya hiç
oluşmaz, iş sistemin dışında kalır.

B'nin hata hâli o vakanın kapsamadığı bir durumdur: plan dosyası **vardır**, sistemin
içindedir, ama kapıya ulaşılamamaktadır. Hiçbir kayıt tutulmazsa plan geçersiz hâlde
`approved/`'a geçer ve klasör değişmezi kırılır. Bu yüzden atlama **izlenir**.

KARAR 18'in gerekçesiyle çelişmez: kararı agent değil **kullanıcı** verir ve kalıcı kayda
geçer — sessiz değildir. Alternatif (atlamayı hiç sunmamak) kullanıcıyı planı terk edip
denetimsiz çalışmaya iterdi; bu **daha az** görünür olurdu.

`by: user` çekirdek gramerine yeni bir değerdir. Gramer şimdi: `<ekosistem>/<agent-adı>`
**ya da** `system` **ya da** `user`. `system` yalnız "denetleyici tanımsız" hâlindedir;
`user` yalnız "kapıya ulaşılamadı, kullanıcı atladı" hâlindedir. İkisi de yalnız `skipped`
kayıtlarında bulunur; `approved`/`rejected` kayıtlarında **asla**.

**`reasons` kuralı bu vaka için genişler.** Çekirdek şöyle diyor: *"`approved` ve `skipped`
kayıtlarında `[]`"*. O kural yazıldığında `skipped`'ın tek anlamı "denetleyici tanımsız"dı
— söylenecek bir gerekçe yoktu. `by: user` atlamasının **gerekçesi vardır** ve kaydın
denetim değeri tam olarak ondadır: hangi planın hangi kapıyı neden atladığı. Yeni hâli:

| `skipped` kaydı | `reasons` |
|---|---|
| `by: system` (denetleyici tanımsız) | `[]` — çekirdek, değişmedi |
| `by: user` (kapıya ulaşılamadı, atlandı) | **boş olamaz** — kullanıcının gerekçesi |

Gerekçesiz bir kullanıcı atlaması kabul edilmez; kullanıcı gerekçe vermezse kapı atlanmaz.

**Çekirdeğin N14 kuralı revize edilir.** Bugün: *"`skipped` kaydında `by` değeri `system`
değil → Reddedilir"*. Bu kural, `skipped`'ın tek anlamının "denetleyici tanımsız" olduğu
varsayımıyla yazılmıştı. Yeni hâli:

> `skipped` kaydında `by` değeri **`system` ya da `user`** olmalı; başka bir değer
> reddedilir. `approved`/`rejected` kayıtlarında ikisi de **asla** bulunmaz (N15 aynen
> kalır).

`by` gramerini **üç yer** tanımlıyor ve üçü birlikte güncellenmelidir; biri geride kalırsa
doğrulayıcı ile skill birbirini yalanlar:
`plan-gate.md` (kayıt şeması), `templates/work-plan-skill.md` (denetim kaydı şeması) ve
çekirdek spec'in kayıt tanımı.

## Komut eşlemesi

Ekosistem → komut eşlemesi **araçta sabittir**; manifest'te opsiyonel override bulunur.

**Neden sabit:** manifest'e serbest kabuk komutu koymak, üretilen konfigürasyona keyfi
komut yerleştirmek demektir. Manifest'i yazan sihirbazdır ve çıktısı üç ekosisteme
dağıtılır; bir governance aracının varsayılanı bu olmamalı. Override, CLI'ı standart
olmayan bir yere kuranlar içindir ve manifest'te açıkça görünür.

| Ekosistem | Varsayılan çağrı |
|---|---|
| `codex` | `codex exec --sandbox <mod> <prompt>` |
| `opencode` | `opencode run --agent <ad> <prompt>` |
| `claude` | `claude -p --agent <ad> <prompt>` |

`--agent` desteği olan iki ekosistemde de rol **yine prompt'a gömülür** (KARAR B3): tek
kod yolu, tek hata biçimi. `--agent` verilmesi, hedefin kendi konfigürasyonunu da
yüklemesini sağlar; ikisi çelişmez, prompt bağlayıcıdır.

## Doğrulayıcı değişikliği

| Kural | Bugün | Bu spec ile |
|---|---|---|
| Kapı sahibinin kapsaması | Sahibin etkin hedefleri, uygun executor'ların etkin hedeflerinin birleşimini **kapsamalı** | **Kaldırılır** |
| Yerine | — | Kapı sahibinin etkin hedefleri **boş olamaz** — en az bir ekosistemde üretilmeli, yoksa hiçbir yerden çağrılamaz |

Çekirdeğin öbür plan kapısı kuralları (`planGate` nesnesinin varlığı, sahiplerin
`writesCode: false` olması, hedeflenen her ekosistemde bir executor bulunması) **aynen
kalır**.

## team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `templates/work-plan-skill.md` | Yeni **"Başka ekosistemdeki kapı sahibi"** bölümü: çağrı dizisi, verdict bloğu, hata seçenekleri. `by` gramerine `user` eklenir; `reasons` kuralı `by: user` için genişler. |
| `plan-gate.md` | Kayıt şemasında `by` grameri ve `reasons` kuralı güncellenir (kurulum sözleşmesi skill ile aynı şeyi söylemeli). |
| `validate-manifest.mjs` | Kapsama kuralı kaldırılır, "kapı sahibinin etkin hedefleri boş olamaz" gelir. Kural listesi ve selftest'ler buna göre. |
| `manifest-schema.md` | Doğrulama kuralları listesi (sihirbazın elle doğrulama fallback'i buraya bakıyor). |
| `validate-plan-gate.mjs` | Şablon/doküman denetimleri `by` gramerinin yeni hâlini belgeliyor mu diye genişletilir. |
| Çekirdek spec (`2026-08-02-...`) | N14 revizyonu ve KARAR 21'in kapatıldığı bu spec'e işaret edilir. |
| `codex-target.md` / `opencode-target.md` | Komut eşlemesi ve sandbox bayrağı karşılıkları belgelenir. |

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
| B-R5 | Sahip yalnız `codex`'te, executor `claude`'da | Manifest **geçerli** (kapsama kuralı kalktı) |
| B-R6 | Kullanıcı "başka ekosistemde çalıştır" seçti | Kayıt o ekosistemle yazılır, `planReviewPassed` doğru |
| B-R7 | Kullanıcı atladı | `{ by: user, verdict: skipped, reasons: [gerekçe] }`; plan ilerleyebilir |
| B-R8 | Kapı 3'te çapraz çağrı | Kapı 1 ile aynı dizi; `done/` yetkisi aynı gevşemiş ölçüyü kullanır |

### Olumsuz (N)

| # | Durum | Beklenen |
|---|---|---|
| B-N1 | Verdict bloğu yok | **Hata** — kayıt yazılmaz, `rejected` sayılmaz |
| B-N2 | Verdict bloğu birden çok | **Hata** |
| B-N3 | `verdict` şema dışı (`ok`, `pending`) | **Hata** |
| B-N4 | `rejected` ama `reasons` boş | **Hata** |
| B-N5 | `reviewed_revision` ≠ diskteki `revision` | Kayıt yazılmaz, denetim tekrarlanır |
| B-N6 | CLI yok / yetkisiz / zaman aşımı / çıkış ≠ 0 | **Hata** — kayıt yazılmaz, kullanıcıya seçenekler sunulur |
| B-N7 | Hedefte rol tanımı dosyası yok | **Hata** |
| B-N8 | Kapı sahibinin etkin hedefleri boş | Manifest **reddedilir** |
| B-N9 | `by: user` bir `approved`/`rejected` kaydında | **Reddedilir** — yalnız `skipped` |
| B-N10 | Kapı sahibi değişti, eski adla kayıt var | `planReviewPassed` **yanlış** — ad karşılaştırması korunur |
| B-N11 | Kayıt ekosistemi sahibin etkin hedeflerinde değil | `planReviewPassed` **yanlış** |
| B-N12 | Hedef `.agent-work/`'e yazmaya kalktı | Sandbox engeller (kapı sahibi yazma izni almaz); kaydı yalnız çağıran yazar |
| B-N13 | `by: user` kaydında `reasons` boş | **Reddedilir** — gerekçesiz atlama yok |
| B-N14 | Çağrı 10 dakikayı aştı | Zaman aşımı hatası; kayıt yazılmaz |

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| B1 | Çağrı otomatik ve senkron; çekirdeğin "harici CLI çağrısı yok" ilkesi bu kapsamda kalkar | Kullanıcı her kapıda röle olmamalı |
| B2 | Executor devri kapsam dışı | Tek seferlik okuma çağrısıyla sürmekte olan iş devri aynı problem değil |
| B3 | Rol prompt'a gömülür; üç ekosistemde tek kod yolu | `codex exec`'te `--agent` yok; CLI özelliğine bağımlılık kırılganlık |
| B4 | Verdict işaretle sınırlı blokla döner | Başlıklar çevrilir, işaretler çevrilmez — çekirdek disiplini |
| B5 | Ayrıştırma hatası ≠ `rejected` | İkisini karıştırmak sessiz onaya ya da yanlış düzeltme döngüsüne yol açar |
| B6 | Kayıt şeması kapalı kalır; `substituted_for` **eklenmez** | Vekil yerine "aynı sahibin başka ekosistemi" yeterli; şema açmaya değmez |
| B7 | `planReviewPassed`'ın ekosistem kısıtı gevşer, ad kısıtı korunur | Ekosistem kısıtı tek-ekosistem varsayımının sonucuydu; ad kısıtı güvenlik özelliği |
| B8 | Atlama izlenir (`by: user`) | KARAR 18'in kapsamadığı vaka; alternatifi daha az görünür |
| B9 | Komut eşlemesi sabit, override opsiyonel | Manifest'e serbest kabuk komutu governance aracının varsayılanı olmamalı |
| B10 | Doğrulayıcının kapsama kuralı kalkar, "en az bir ekosistem" gelir | Kapsama kuralı tek-ekosistem varsayımıydı; sahip hiçbir yerde yoksa çağrılamaz |

## Kapsam dışı

- **Executor'ın başka ekosistemde işletilmesi.** Yukarıda gerekçelendirildi.
- **Vekil denetleyici** (kapı sahibi yerine başka bir agent). KARAR B6.
- **Inbox'ın dış sisteme bağlanması** (C). Ayrı spec.
- **Preset'i kurulum sonrası açma/kapama** (E). Proje-yükseltme skill'i.
- **Paralel/eşzamanlı çapraz çağrı.** Kapılar sıralıdır; eşzamanlılık ihtiyacı yok.
