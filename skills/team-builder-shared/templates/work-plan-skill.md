---
name: work-plan
description: Bu projede plan kapısı açık. Bir iş için plan yazar, denetleyici tanımlıysa denetletir, kullanıcıya onaylatır; onaylanan işlerin havuzunu yönetir ve seçilenleri işletir. Tetikleyiciler — "bunun planını çıkar", "onaylı işleri göster", "şu işi yapalım", "havuzda ne var", "şunu not et".
---

# work-plan

Bu projede **plan kapısı** açıktır: kod yazılmadan önce plan yazılır, (denetleyici
tanımlıysa) denetlenir ve **kullanıcı onaylar**. Kullanıcı onayı atlanamaz; onaysız kod
yazılmaz.

Bu dosya plan kapısının **tek otoritesidir**: kapının bütün kuralları burada yazılıdır ve
kural için başka bir belgeye bakman gerekmez. Projenin kendi dosyalarını (manifest,
routing tablosu, `TEMPLATE.md`, ADR'ler) elbette okursun — onlar kural değil, veridir.

**Veriyi nereden okursun.** Manifest `.agent-source/agents/manifest.json`'dır; routing tablosu
da onun içindedir (`routing`). Kapı sahipleri manifest'te `planGate.planReviewer` ve
`planGate.codeReviewer` alanlarındadır; değer bir agent adı ya da `null`'dır.
`planGate.crossReview` `true` ise sahipler **başka bir ekosistemde** çalıştırılır (bkz.
*Başka ekosistemdeki kapı sahibi*). Bu alanları **her kapıda yeniden oku** — sahip değişmiş olabilir ve yüklemlerin tamamı
**güncel** sahibe göre hesaplanır.

## Önce: hangi mod?

| Kullanıcı ne diyor | Mod |
|---|---|
| Yeni bir iş tarif ediyor | **Plan yaz** |
| "Havuzda ne var", "şu işi yapalım" | **Havuz** |
| "Şunu not et", "sonra bakarız" | **Inbox** |
| "Plansız yap" | Kapı atlanır; hiçbir dosya oluşturulmaz, `.agent-work/`'e yazılmaz, iş izlenmez |

Plan kapısı açıkken `.agent-work/` dizini yoksa — hangi modda olursan ol — iskeleti kurmayı
teklif et: `inbox/ draft/ approved/ in-progress/ done/` ve `TEMPLATE.md`. Kapı kapalıysa
teklif etme (en alttaki bölüme bak).

## Hangi ekosistemdesin?

`executor` ve denetim kayıtları `<ekosistem>/<agent-adı>` biçiminde yazılır, o yüzden
önce ekosistemi çözmen gerekir. Bu, **skill'in okunduğu yola** bakılarak yapılır:
(Tek istisna: kapı sahibi başka bir ekosistemdeyse denetim kaydına **çağrının koştuğu**
ekosistem girer, seninki değil — bkz. *Başka ekosistemdeki kapı sahibi*.)

| Skill'in konumu | Ekosistem |
|---|---|
| `.claude/skills/` | `claude` |
| `.opencode/` altında | `opencode` |
| `.agents/skills/` | Aşağıdaki kesişimden çözülür |

`.agents/skills/` altındaki kopyayı hem Codex hem OpenCode okur; konum tek başına ayırt
etmez. Projenin hedeflediği ekosistemlerle `{codex, opencode}` kesişimini al:

- **Tek aday** → o ekosistemi kullan, soru sorma.
- **İki aday** → **dur ve kullanıcıya sor**: "Bu oturum Codex mi OpenCode mu?" Tahmin etme.
- **Hiç aday yok** → **dur**. Bu konumdan çağrı desteklenmiyor; kullanıcıya söyle.

**Projenin hedeflediği ekosistemler** manifest'ten şöyle hesaplanır: her agent'ın **etkin
hedefleri**nin birleşimi. Bir agent'ın etkin hedefleri kendi `targets` alanıdır; o alan
yoksa projenin `targetsDefault` değeridir. `targetsDefault`'a tek başına bakma — her agent
onu kendi `targets`'ıyla ezebilir, o yüzden yalnız `targetsDefault`'ta geçen bir ekosistem
gerçekte hedeflenmiyor olabilir.

## Ortak kurallar

- **`.agent-work/` altına yalnız sen yazarsın.** Denetleyiciler dosya değiştirmez; sana
  sonuç döndürür, kaydı sen yazarsın.
- **Durum = dosyanın bulunduğu klasör.** Frontmatter'da `status` alanı **yoktur**; ekleme.
- **Bölümler işaretle bulunur.** `<!-- s:what -->`, `<!-- s:how -->`,
  `<!-- s:questions -->`, `<!-- s:review-notes -->`, `<!-- s:progress -->`. Başlık
  metinleri projenin diline çevrilidir; **asla başlığa göre arama yapma.**

### `revision` ne zaman artar, artınca ne olur

`revision` yalnız **planlama içeriği** değişince artar: `title`, `domain`, `paths`,
`executor` ve `s:what` / `s:how` / `s:questions` bölümleri. `s:review-notes`,
`s:progress`, `reviews`, `outcome` ve `adr` **artırmaz**.

`revision` artınca plan denetimi onayı bozulur — aşağıdaki `planReviewPassed` yanlış olur.
Sonucu klasöre göre değişir:

| Dosya neredeyse | Ne olur |
|---|---|
| `draft/` | Yerinde kalır; kapı 1 yeniden geçilir |
| `approved/` | **`draft/`'a geri döner**, kapı 1 ve kapı 2 yeniden geçilir |
| `in-progress/` | **`draft/`'a geri döner**; `s:progress` bölümü **korunur** — sentinel geri konmaz |
| `done/` | **Dokunulmaz.** `done/` arşivdir, yeniden değerlendirilmez |

`title` değişirse dosya adındaki slug'ı da yenile — `id` aynı kalır, dosya yeniden
adlandırılır.

### `id` ve dosya adı

`id` `<YYYYMMDD>-<n{2,}>` biçimindedir (en az iki hane; aynı gün 99'u aşarsa üç hane),
**değişmezdir** ve dosya taşındıkça korunur. Dosya adı `<id>-<slug>.md`; `<slug>`
`title`'dan türetilir ve `^[a-z0-9]+(?:-[a-z0-9]+)*$` kuralına uyar (büyük harf, boşluk,
Türkçe karakter yok). Slug okunabilirlik içindir, tekilliği `id` sağlar; slug'sız dosya
adı geçersizdir.

**Slug'ı `title`'dan üretme kuralı** — çevirme, harf indirge: `ç→c ğ→g ı→i İ→i ö→o ş→s
ü→u`, kalan harf-dışı karakterler tire olur, tireler tekilleşir, baştaki/sondaki tire
düşer. Başlık uzunsa **ilk üç-dört anlamlı kelimede** kes. Başlığı İngilizceye çevirme:
"Auth uçlarına oran sınırlama ekle" → `auth-uclarina-oran-sinirlama` (`auth-rate-limit`
**değil**). Kural olmadan iki agent aynı başlık için farklı dosya adı üretir ve `title`
değişip slug yenilendiğinde ad biçimi kayar.

Yeni `id` verirken `.agent-work/` altındaki **tüm** klasörleri tara, o güne ait en büyük
sırayı bir artır. Aynı `id`'yi taşıyan bir dosya zaten varsa **yazma, dur** — çakışmayı
kullanıcıya bildir.

`created` ve `source` alanları `id` gibi **değiştirilemez**; dosya hangi klasöre giderse
gitsin ilk yazıldıkları gibi kalır.

### Denetim kaydı şeması

Her kapı sonucu `reviews.plan-review` ya da `reviews.code-review` dizisine **tam** şu
şekilde yazılır — beş alanın hepsi zorunludur:

```yaml
{ by: <ekosistem>/<agent-adı> | system | user/<agent-adı>, at: <YYYY-MM-DD>,
  revision: <n>, verdict: approved | rejected | skipped,
  reasons: [<madde>, ...] }
```

- `by`: üç biçimden biri — `<ekosistem>/<agent-adı>`, `system`, ya da
  `user/<agent-adı>`. Çıplak ad (`architect`), eksik parça (`claude/`), boş parça
  (`//x`) ve **çıplak `user`** geçersizdir. Ekosistem yalnız `claude`, `codex` ya da
  `opencode` olabilir; `user` bir ekosistem değildir, ayrı bir ön ektir.
  - `system` — denetleyici tanımsız. Yalnız `skipped`.
  - `user/<agent-adı>` — adı geçen kapı sahibine ulaşılamadı, kullanıcı kapıyı atladı.
    Yalnız `skipped`. Ad **zorunludur**: feragat o sahibe verilmiştir, sahip sonradan
    değişirse feragat düşmelidir — tıpkı onay gibi.
  - `approved` ve `rejected` kayıtlarında `system` ve `user/` **asla** bulunmaz.
  - `skipped` kayıtlarında `by` **yalnız** `system` ya da `user/<agent-adı>` olabilir;
    `<ekosistem>/<agent-adı>` biçimi `skipped`'te geçersizdir — denetleyici karar
    verdiyse `approved` ya da `rejected` yazar, kendisi hiçbir zaman `skipped` yazmaz.
- `at`: `YYYY-MM-DD`; eksik ya da başka biçim geçersizdir.
- `revision`: kaydın denetlediği revizyon — pozitif tam sayı. `"3"` (metin), `3.5`, `0`
  ve negatif değerler geçersizdir.
- `verdict`: yalnız `approved`, `rejected`, `skipped`. Başka değer (`ok`, `pending`)
  geçersizdir.
- `reasons`: **her zaman dizi**. Metin ya da eksik alan geçersizdir.
  - `approved` → `[]`. Denetleyici gerekçe yazsa bile kayda `[]` geçer.
  - `rejected` → **boş olamaz**.
  - `skipped` + `by: system` → `[]` — söylenecek bir şey yok, denetleyici tanımsız.
  - `skipped` + `by: user/<agent-adı>` → **boş olamaz**. Kaydın bütün denetim değeri
    burada: hangi planın hangi kapıyı neden atladığı. Kullanıcı gerekçe vermezse kapı
    atlanmaz.
- Kayıtlar **asla silinmez**; sonraki kayıt öncekini geçersiz kılar.

### `planReviewPassed` — plan onayı geçerli mi?

Bu yüklem **dosyayla birlikte taşınır** ve **çağıran oturumdan bağımsızdır**. Bir planı
başka bir ekosistemde açtığında yeniden denetletme. Karşılaştırılacak **ad** manifest'teki
güncel denetleyiciden gelir, senin oturumundan değil — plan dosyaları paylaşılır ve onay
hangi oturumdan bakıldığına göre değişmemelidir. **Ekosistem** ise denetimin fiilen
çalıştığı yerdir; denetleyici projenin başka bir ekosisteminde üretilmiş olabilir.

Üç yoldan biriyle doğru olur. Hepsinde ortak: bakılan kayıt `plan-review`'ın **son**
kaydıdır ve `kayıt.revision === plan.revision` olmalıdır.

| Projenin plan denetleyicisi | Son kayıt | `kayıt.by` |
|---|---|---|
| Bir agent adı | `approved` | `<denetimin çalıştığı ekosistem>/<güncel denetleyici adı>` — ekosistem, denetleyicinin **etkin hedeflerinden biri** olmalı |
| Bir agent adı | `skipped` | `user/<güncel denetleyici adı>` — kullanıcı feragati |
| Tanımsız (`null`) | `skipped` | `system`, ve denetleyici **hâlâ** tanımsız |

Ad karşılaştırması üç satırda da **güncel** denetleyiciye karşıdır. Kapı sahibi
değişirse hem eski onaylar hem eski feragatler düşer; yeni sahiple kapıyı yeniden geç.

Ekosistem kısıtı `approved` satırında **denetimin çalıştığı** ekosistemdir, executor'ınki
değil — denetleyici başka bir ekosistemde çalışıyor olabilir (bkz. *Başka ekosistemdeki
kapı sahibi*).

### `executor` geçerli mi?

Bir planın `executor` alanını **her okuduğunda** — yalnız plan yazarken değil, havuzdan
seçerken ve yarım işi devam ettirirken de — üçünü birden doğrula:

1. Ad gerçek bir agent ve **uygun executor'lardan** biri: manifest'in `routing`
   tablosunda bir satırın `role`'ü olarak geçiyor **ve** kod yazıyor. "Kod yazıyor"
   demek, agent'ın `writesCode` alanının `false` **olmaması** demektir — alan hiç
   verilmemişse agent **kod yazar** sayılır. Yalnız açıkça `writesCode: false` yazan
   agent'lar executor olamaz.
2. `executor`'ın ekosistemi o agent'ın **etkin hedeflerinde** var.
3. O ekosistem **senin oturumunun ekosistemi**.

İlk ikisi sağlanmıyorsa plan bozuktur — işletme, kullanıcıya bildir. Üçüncüsü
sağlanmıyorsa plan geçerlidir ama **çalıştırma yetkisi sende değildir**; o ekosistemde
açılmayı bekler.

### Klasör değişmezleri

Bu koşullar dosyanın **durduğu yerde** sağlanır. Bir geçişi tamamlarken önce dosyayı hedef
klasörün koşulunu sağlayacak hale getir, **sonra** taşı — geçiş bitmeden ara adımlara
bakılmaz, ama geçiş bittiğinde koşul sağlanmıyorsa hata vardır.

| Klasör | Koşul |
|---|---|
| `inbox/` | `revision`, `reviews`, `executor`, `outcome` **bulunmaz** |
| `draft/` | `revision` var; `s:progress` bölümü mevcut — hiç başlanmamışsa `<!-- progress:not-started -->` sentinel'iyle, `in-progress/`'ten geri döndüyse korunmuş ilerlemeyle |
| `approved/` | `planReviewPassed` **doğru**; `s:progress` `draft/`'taki gibi |
| `in-progress/` | `planReviewPassed` **doğru** ve `s:progress` doldurulmuş (sentinel yok) |
| `done/` | Arşiv. Ya başarılı tamamlama ya `outcome: cancelled` taşır; sonradan değiştirilmez |

`outcome` alanı **yalnız `done/`'daki dosyalarda** bulunur ve tek geçerli değeri
`cancelled`'dır. Başka bir klasörde duran bir dosyada `outcome` varsa o dosya bozuktur.

## Plan yaz

1. **Sahibini bul.** İşin dokunacağı kod yollarına bak; projenin routing tablosundan o
   yolun sahibi developer'ı belirle. `executor` odur, `<ekosistem>/<ad>` biçiminde.
   Ekosistemi yukarıdaki tablodan çöz.
   Yukarıdaki üç geçerlilik kontrolünü uygula; sağlanmıyorsa plan yazma, kullanıcıya sor.
   - İş birden çok domain'e dokunuyorsa **tek** `executor` seç (ağırlık merkezine göre) ve
     diğer sahiplere danışmayı `s:how` bölümüne yaz. İki executor yazma.
2. **`.agent-work/TEMPLATE.md`'yi kopyala** → `.agent-work/draft/<id>-<slug>.md`.
   `revision: 1`, `reviews` boş diziler, `s:progress` sentinel'li.
3. **Gövdeyi doldur.** `s:what` sade dille ve örnekle, ölçülebilir kabul kriteriyle;
   `s:how` yaklaşım ve etkilenen bileşenler (`paths` ile tutarlı); `s:questions` boş
   bırakılmaz.
4. **Kapı 1 — plan denetimi.** Projenin plan denetleyicisi tanımlıysa onu çağır. Reddetme
   ölçütleri: kabul kriteri yok ya da ölçülemez; `paths` gövdeyle tutarsız; açık soru
   cevapsız; yaklaşım mevcut bir ADR'ye aykırı.
   Denetleyici senin ekosisteminde üretilmemişse — ya da `crossReview` açıksa —
   **Başka ekosistemdeki kapı sahibi** bölümünü izle; çıktı sözleşmesi ve hata hâli oradadır.
   Denetleyici sana şunu döndürür:
   ```
   verdict: approved | rejected
   reviewed_revision: <denetlediği revision>
   reasons: [ ... ]
   ```
   - `reviewed_revision` diskteki `revision` ile aynı değilse **kaydı yazma** — plan
     denetim sırasında değişmiş demektir, denetimi tekrarla.
   - Kaydı `reviews.plan-review`'a yukarıdaki şemaya göre ekle. `approved` ise
     `reasons: []`; `rejected` ise `reasons` boş olamaz ve gerekçeyi `s:review-notes`'a
     da yaz.
   - **Reddedildiyse kapı 2'ye geçme.** Plan `draft/`'ta kalır; düzelt — `revision` artar
     — ve kapı 1'i **yeniden** geç. Eski kayıt durur.
   - Denetleyici tanımlı değilse kaydı yine yaz, şemanın tamamıyla:
     `{ by: system, at: <bugün>, revision: <plan.revision>, verdict: skipped,
     reasons: [] }`. Plan sonradan düzeltilip `revision` artarsa **yeni** bir `skipped`
     kaydı düşmen gerekir; eski kayıt yeni revizyona yetki vermez.
5. **Kapı 2 — kullanıcı onayı.** Planı **sade dille, örnekle** anlat. Alan adı
   (`gates`, `executor`, `paths`) ya da ham YAML **gösterme**. "Böyle ilerleyelim mi?"
   diye sor.
   - Onaylarsa: önce `planReviewPassed`'ın doğru olduğunu doğrula, sonra dosyayı
     `.agent-work/approved/`'a taşı. Doğru değilse taşıma — kapı 1'e dön.
   - Değişiklik isterse `draft/`'ta bırak, geri bildirimi `s:review-notes`'a yaz;
     düzeltme `revision`'ı artırır ve kapı 1'i geçersiz kılar.

**Kod yazma:** onaylanmamış bir planın işini yapma. Kullanıcı açıkça "plansız yap" derse
o iş için kural atlanır.

## Havuz

- **"Havuzda ne var"** → `.agent-work/approved/` içindekileri listele. Her biri için
  başlık ve tek cümle özet ver; dosya adı ve alan adı dökme.
- **"Şunu yapalım" / "şu ikisini yapalım"** → kullanıcı seçer. **Sıra dayatma** — havuz
  FIFO değildir.
- Seçilen dosya için `planReviewPassed`'ı ve `executor` geçerliliğini **yeniden doğrula** —
  sahibi değişmiş, plan düzenlenmiş ya da agent projeden çıkarılmış olabilir.
- Doğruysa **önce** `s:progress`'i doldur, **sonra** dosyayı `.agent-work/in-progress/`'e
  taşı. Sıra bu; boş `s:progress` ile `in-progress/`'e girilmez.
  - `s:progress` sentinel içeriyorsa (iş hiç başlamamış): sentinel'i sil, yerine son durum
    / sıradaki adım / engel / dokunulan yerler yaz.
  - Sentinel yoksa iş **daha önce başlamış ve geri dönmüştür**: oradaki ilerlemeyi
    **koru**, üstüne yaz — sıfırlama. Yapılmış işi kaybetmek bu akışın en pahalı hatasıdır.
- İşi her bıraktığında `s:progress`'i güncelle — başka bir oturum oradan devam edecek.

## İşi bitirme

1. **Kapı 3 — kod denetimi.** Projenin kod denetleyicisi tanımlıysa çağır. Denetleyici
   kapı 1'deki **aynı** çıktıyı döndürür (`verdict` / `reviewed_revision` / `reasons`).
   Kod denetleyicisi senin ekosisteminde üretilmemişse — ya da `crossReview` açıksa —
   **Başka ekosistemdeki kapı sahibi** bölümünü izle — kapı 3'te prompt'a uygulama farkını (temel referans +
   değişen dosyalar) da eklersin.
   - `reviewed_revision` diskteki `revision` ile aynı değilse **kaydı yazma** — plan
     denetim sırasında değişmiş demektir, denetimi tekrarla. Bayat bir kayıt `done/`'a
     taşıma yetkisi **vermez** — kapı 1'de olduğu gibi burada da geçersizdir. `done/`
     arşivdir ve geri dönüşü yoktur; bayat bir onayla oraya taşımak, denetlenmemiş işi
     kalıcı olarak denetlenmiş göstermek demektir.
   - Sonucu `reviews.code-review`'a şemaya göre kaydet. `rejected` ise `reasons` boş
     olamaz, gerekçeyi `s:review-notes`'a da yaz ve iş `in-progress/`'te kalır.
   Denetleyici tanımlı değilse `{ by: system, at: <bugün>, revision: <plan.revision>,
   verdict: skipped, reasons: [] }` kaydı düş.
2. Kalıcı bir mimari karar çıktıysa ADR yazılmalı: projede mimarlık rolü **varsa** ona
   yazdır, **yoksa** kullanıcıya sor. Sonucu `adr:` alanına bağla — bunu **taşımadan
   önce** yap; `done/` arşivdir, oraya girdikten sonra dosya değişmez.
3. **`done/`'a taşıma yetkisi.** Yetkiyi veren kaydın içeriği değil — **kaydı bu turda,
   1. adımda senin yazmış olman**. Diskte hazır duran bir `code-review` kaydı, bu turun
   ürünü değilse geçmiştir: ne derse desin yetki vermez. Onu okuyup "hâlâ geçerli mi"
   diye sınama — 1. adıma dön ve kapı 3'ü çalıştır.
   Bu turda yazdığın kaydın biçimi şu üçünden biri olmalı:
   - denetleyici bir ad taşıyorsa: kayıt `approved` **ve** `kayıt.by` **güncel**
     denetleyiciyle aynı — ekosistem kısmı denetleyicinin etkin hedeflerinden biri
     olmalı;
   - denetleyici bir ad taşıyor ve kapıya ulaşılamadıysa: kayıt `skipped` **ve**
     `kayıt.by` = `user/<güncel denetleyici adı>`;
   - denetleyici tanımsızsa: kayıt `skipped`, `kayıt.by` = `system` **ve** denetleyici
     **hâlâ** tanımsız.
   Üçünde de `kayıt.revision === plan.revision` olmalı. Bu bir **tutarlılık
   kontrolüdür**, yetkinin kaynağı değil: 1. adım uyuşmayan bir kaydı zaten yazmaz.
   Denetleyici tanımsızken kullanıcıdan **ek onay isteme** — kapı 3 yoktur, iş doğrudan
   biter.
4. **Neden "bu turda" şartı var.** Kod yazmak `revision`'ı arttırmaz ve hiçbir alan işin
   kesildiğini kaydetmez. Yani "önceki turun onayından sonra kod değişti mi" sorusunu
   dosyaya bakarak **yanıtlayamazsın** — hiçbir alan onu ele vermez. Bu yüzden ölçüt,
   yanıtlanabilen tek soru olan "bu kaydı bu turda ben mi yazdım" sorusudur. Yanlış
   yanıt, denetlenmemiş kodu geri dönüşü olmayan `done/` arşivine denetlenmiş olarak
   sokar; bu akışın telafisi olmayan tek hatasıdır.

## Başka ekosistemdeki kapı sahibi

Kapı sahibi senin ekosisteminde üretilmemişse — ya da manifest'te `planGate.crossReview`
`true` ise — onu **harici CLI çağrısıyla** başka bir ekosistemde çalıştırırsın. Çapraz
denetimin amacı işi yazan modelden farklı bir modelin denetlemesidir. Kapı 1 ve kapı 3 için
dizi aynıdır.

1. Sahibin **etkin hedeflerini** çöz (kendi `targets`'ı, yoksa `targetsDefault`).
   - `crossReview` **kapalıysa**: senin ekosistemin bunlardan biriyse **çapraz çağrı yok** —
     normal yoldan çağır.
   - `crossReview` **açıksa**: senin ekosisteminden **farklı** bir hedef varsa çapraz çağrı
     yaparsın. Sahip yalnız senin ekosisteminde üretiliyorsa başka yer yoktur: normal
     yoldan çağır ve kullanıcıya "çapraz denetim bu sahip için mümkün değil" de.
2. Hedef ekosistem, etkin hedefler listesinin **sırasındaki ilkidir** — `crossReview`
   açıksa seninkini atlayarak. Kullanıcıya sorma.
3. Hedefin **rol tanımını oku**:
   `.claude/agents/<ad>.md`, `.codex/agent-definitions/<ad>.md`,
   `.opencode/agents/<ad>.md`. Dosya yoksa bu bir hatadır (aşağıya bak).
4. Prompt'u kur: **rol tanımının tamamı** + **plan dosyasının tamamı** + aşağıdaki çıktı
   sözleşmesi.
   - **Kapı 3'te ayrıca** uygulama farkını ekle. Taze bir denetleyici süreci depoyu
     okuyabilir ama hangi değişikliğin bu plana ait olduğunu göremez — çalışma ağacı
     zaten kirliyse ya da birden çok plan sürüyorsa okumak yanıltır. Kapı 1'de bu bölüm
     yoktur (henüz kod yok). Şunu koy:
     - **Değişen dosyaların listesi.** İşin bir kısmı commit'lenmiş olabilir, o yüzden
       **iki kaynağı birleştir**: temel referansı biliyorsan
       `git diff --name-only <temel>..HEAD`, her hâlde `git status --short`. Yalnız
       birine bakarsan liste boş çıkar — commit'lenmiş işte `git status` boştur ve
       denetleyici **hiçbir şey görmeden onaylar**. Sonucu planın `paths` alanına göre
       daralt (`paths` her planda zorunludur). Daraltmanın sebebi bir üstteki uyarının
       kendisidir: çalışma ağacı başka işlerin değişikliklerini de taşıyabilir.
       Birleşik liste boşsa **kapı 3'ü çalıştırma** — denetlenecek bir şey yok demektir;
       dur ve kullanıcıya sor.
     - **Temel referans** — işin başladığı commit — **biliyorsan**. Plan dosyasında
       böyle bir alan **yoktur**; işi sen başlattıysan bilirsin, başka bir oturum
       başlattıysa bilmeyebilirsin. Bilmiyorsan **uydurma**: prompt'ta "temel referans
       bilinmiyor, değişen dosya listesi plandan daraltılmıştır" diye yaz. Denetleyici
       neyi görmediğini bilerek karar versin.
5. CLI'ı **proje kökünde** çalıştır. Hedefin depoyu okuması gerekir: kapı 1'in reddetme
   ölçütlerinden biri "yaklaşım mevcut bir ADR'ye aykırı"dır.

   | Ekosistem | Komut |
   |---|---|
   | `claude` | `claude -p --permission-mode plan --disallowedTools Edit,Write,NotebookEdit,Bash` |
   | `codex` | `codex exec --sandbox read-only -` |
   | `opencode` | `opencode run` |

   - **Prompt stdin'den gider, argüman olarak değil.** Rol + planın tamamı kolayca
     işletim sisteminin argüman sınırını aşar. Mekaniği şudur: prompt'u **geçici bir
     dosyaya yaz**, sonra girdiyi o dosyadan yönlendir —
     `codex exec --sandbox read-only - < /tmp/<dosya>`.
     **Plan metnini bir kabuk dizesinin içine koyma** — ne `"$(cat …)"` ile argümana, ne
     `echo "$PROMPT" |` ile boruya. Plan metni kullanıcı içeriğidir ve `s:how` bölümü
     pekâlâ ters tırnak ya da `$(...)` taşıyan bir komut örneği içerebilir; çift tırnak
     içinde bunu **senin** kabuğun çalıştırır. Dosyaya yazıp yönlendirmek bu yüzeyi
     tümüyle kaldırır.
     **`--disallowedTools` variadic bir bayraktır** — arkasına prompt'u argüman olarak
     koyarsan onu da tool adı sanıp yutar (`Permission deny rule "..." matches no known
     tool`) ve izin listesi sessizce bozulur. Prompt'u yukarıdaki gibi dosyadan
     yönlendirdiğin sürece sorun yok; bayrağın arkasına hiçbir şey ekleme.
     Bir CLI sürümü stdin'i okumazsa çağrı boş prompt'la koşar ve ya hata koduyla ya da
     ayrıştırılamayan çıktıyla döner — yani **taşıma ya da protokol hatası** olarak
     yakalanır ve kullanıcı seçenekleri görür. Sessizce yanlış bir verdict üretmez.
   - **`--agent` verme.** Rolü zaten prompt'a gömüyorsun; `--agent` bunun üstüne hedefin
     kendi konfigürasyonunu, dolayısıyla **izinlerini** yükler. OpenCode'da
     `permission.edit` doğrudan agent konfigürasyonundan gelir ve doküman sahibi bir rol
     meşru biçimde `allow`'dur — `--agent architect` demek, denetleyiciye yazma izni
     vermek demektir. Yan etkisi: hiçbir ekosistemde agent'ın model/effort ayarı
     uygulanmaz, çağrı o CLI'ın varsayılan modeliyle koşar. Bu kabul edilmiştir; denetim
     kararı rol metnine dayanır ve ekosistemler arası **birebir aynı karar bekleme**.
   - **Sahibin `sandbox_mode`'una bakma.** `writesCode: false` dosya sistemi izni
     değildir; doküman sahibi bir rol meşru biçimde `workspace-write` olabilir. Denetim
     çağrısı hiçbir şey yazmaz, o yüzden izin rolden değil çağrı türünden gelir.
   - **Salt-okunurluğu üç CLI eşit zorlamıyor; bunu bilerek çalış.** `codex` işletim
     sistemi düzeyinde engeller — tek gerçek mekanik güvence odur. `claude`'da
     `--permission-mode plan` düzenlemeyi kapatır ve `--disallowedTools` yazma
     araçlarını reddeder; ama bu bir **daraltmadır, kapatma değil** — `--allowedTools`
     eklemeli çalışır (adı "izin verilecekler", reddedilecekler ayrı bayraktır) ve çağrı
     proje kökünde koştuğu için projenin kendi izin ayarları da yürürlüktedir.
     **`opencode`'da salt-okunur bayrağı yoktur**; orada
     koruma mekanik değil sözleşmeseldir: `--agent` verilmediği için izin verici rol
     konfigürasyonu yüklenmez ve *"`.agent-work/` altına yalnız sen yazarsın"* kuralı
     geçerlidir. Bu, **kaydın bütünlüğünü** korur; hedefin depoya hiç dokunamayacağını
     garanti etmez. Bir hedef seçerken bunu hesaba kat.
   - **Zaman aşımı 10 dakika.** Süre dolarsa süreç ağacının tamamını sonlandır.
   - Manifest'te `planGate.cli.<ekosistem>` varsa çalıştırılabilir **yol** olarak onu
     kullan; argümanlar yine yukarıdaki tablodandır.

### Çıktı sözleşmesi

Hedeften şunu istersin — **işaretler, alan adları ve değerler çevrilmez**, yalnız
hedefe verdiğin açıklama metni proje diline çevrilir:

```
<!-- verdict -->
verdict: approved | rejected
reviewed_revision: <denetlediği revision>
reasons:
- <madde>
- <madde>
<!-- /verdict -->
```

Bunu **yalnız bir kez, çıktının sonunda** üretmesini iste; tekrarlamasın. Düşünme ya da
özet metni yazması sorun değil — blok **dışındaki** metin zaten yok sayılır (aşağıya
bak) — ama sözleşmeyi ikinci kez tekrarlarsa (ör. talimatı özetlerken) bu iki blok
sayılır ve ayrıştırma hatasına yol açar.

Ayrıştırma kuralları:

- İşaretler **kendi satırlarında ve tam eşleşmeli** (baş/son boşluk dışında başka
  karakter yok). stdout'ta tam bir açılış ve tam bir kapanış, bu sırayla. Sayılan
  **işaretlerdir, blok değil**: `<!-- verdict -->` tam bir kez, `<!-- /verdict -->` tam
  bir kez görünmeli. Biri hiç yoksa, biri birden çok kez geçiyorsa (tekrarlanmış iki tam
  blok dahil), ya da kapanış açılıştan önce geliyorsa → hata.
- Blok içinde **yalnız bu üç alan**. Bilinmeyen alan, tekrarlanan alan, eksik alan → hata.
  **Alan sırası serbesttir** — üçü de varsa hangi sırada yazıldığı önemli değil. Sıraya
  bakarsan aynı çıktı iki ayrıştırıcıda iki karar verir.
- `verdict` yalnız `approved` ya da `rejected`, **birebir küçük harf**. `Approved`,
  `APPROVED` gibi varyantlar → hata; değerleri normalize etme, tolerans kuralı yoksa
  tolerans yoktur. `skipped` hedeften **gelmez** — onu yalnız sen yazarsın.
- `reasons` maddelerini hedef **iki biçimde** yazabilir ve ikisi de geçerlidir: alt
  satırlarda `- <madde>` listesi, ya da tek satırda `[<madde>, <madde>]`. İçerik aynıysa
  biçim fark etmez.
- Blok **dışındaki** metni yok say; modeller düşünme/özet metni yazar.
- `reasons`: `approved` için hedefin bloğunda **boş dizi** (`reasons: []`) kabul edilen
  biçimdir — alan **eksik değildir**, değeri boştur. Alan var ama altında hiç madde yoksa
  (`reasons:` tek başına) bu da **boş sayılır**, hata değildir. Kayda her hâlde **`[]`**
  yazarsın; hedef madde yazmışsa onları at. `rejected` için boş olamaz — boşsa **→ hata**: kaydı yazma,
  gerekçe uydurma.
- `by` alanını **sen** doldurursun, hedef değil: kimi çağırdığını sen biliyorsun.
  Hedefin kendi kimliğini beyan etmesine izin verme. Değer `<denetimin çalıştığı
  ekosistem>/<sahibin adı>`dır — **bu bloğu döndüren çağrının fiilen koştuğu** ekosistem,
  **senin oturumunun ekosistemi değil**. Hata hâlinde kullanıcı "başka ekosistemde
  çalıştır" dediyse kayda **o** ekosistem girer, 2. adımda ilk seçtiğin değil: kayıt
  denetimin nerede yapıldığını söyler, nerede denenmiş olduğunu değil.
  **Bu, "Hangi ekosistemdesin?" bölümündeki kuralın
  istisnasıdır:** o kural denetim kaydının ekosistemini skill'in okunduğu yoldan (senin
  ekosisteminden) çözer; çapraz çağrıda kayda giren ekosistem **senin değil, çağrının
  fiilen çalıştığı** ekosistemdir. Karıştırırsan `planReviewPassed`'ın ilk satırı hiç
  sağlanmaz — plan `draft/`'tan çıkamaz.

### Sonuç üç sınıftan biridir

| Sınıf | Ne zaman | Ne yaparsın |
|---|---|---|
| Taşıma hatası | CLI yok/`PATH`'te değil, yetkisiz, zaman aşımı, çıkış kodu ≠ 0 | **Kayıt yazma.** Geçerli bir blok gelmiş olsa bile yok say — sağlıklı bitmemiş süreçten çıkan blok güvenilmez. |
| Protokol hatası | Blok yok, birden çok, şemaya uymuyor, ya da hedefte rol tanımı dosyası (3. adım) bulunamadı | **Kayıt yazma.** |
| Verdict | Geçerli blok, sağlıklı çıkış | Kaydı yaz, sonra **çağıran kapının akışına dön** — kapı 1'de plan yazma dizisinin 4. adımına, kapı 3'te işi bitirme dizisine. Bu bölüm çağrıyı kurar, kapıyı yönetmez. |

**Hata `rejected` değildir.** Ulaşılamayan bir kapıyı "reddetti" saymak planı gereksiz
düzeltme döngüsüne sokar; ayrıştırma hatasını "onayladı" saymak sessiz onaydır.

**Rol tanımı bulunamaması taşıma hatası değildir** (CLI hiç çağrılmaz, 3. adımda
biter) — protokol hatası gibi ele alınır: aşağıdaki "Tekrar dene" seçeneği bu durumda
genelde anlamlı değildir, dosya yerinde olmadıkça aynı çağrı yine bulamaz.

**Verdict sınıfının ek koşulu:** blok geçerli olsa bile `reviewed_revision` diskteki
`revision`'a eşit değilse **kaydı yazma** — plan denetim sırasında değişmiş demektir.
Bu durum aşağıdaki *Hata hâlinde kullanıcıya ne sorarsın* akışına **girmez**; seçenek
sunulmadan denetim doğrudan tekrarlanır, tıpkı kapı 1 ve kapı 3'ün aynı-ekosistem
davranışında olduğu gibi.

### Hata hâlinde kullanıcıya ne sorarsın

1. ve 2. seçenek **kendiliğinden kayıt yazmaz**; plan bulunduğu klasörde kalır ve
yeniden yapılan çağrı normal akışa döner — başarılı olursa kaydı o akış yazar.
Kullanıcıya bu üç seçeneği bu sırayla sun:

1. **Tekrar dene** — taşıma hatalarında anlamlı; protokol hatasında genelde değil.
2. **`<sahip>`'i `<başka ekosistem>`'de çalıştır** — yalnız sahibin **etkin
   hedeflerinden**, rol tanımı dosyası **gerçekten var** olanları ve **az önce
   başarısız olan ekosistem dışındakileri** listele. Geriye ekosistem kalmıyorsa bu
   maddeyi **hiç gösterme** — aynı hedefi tekrar önermek 1. seçeneğin kopyasıdır.
   Agent adı uydurma; öneri manifest'ten türer.
3. **Bu kapıyı atla** — **tek istisna budur: bu seçenek kaydı yazar.** Kullanıcıdan
   **gerekçe iste**, sonra:
   `{ by: user/<sahibin adı>, at: <bugün>, revision: <plan.revision>,
   verdict: skipped, reasons: [<kullanıcının gerekçesi>] }`.
   Gerekçeyi **olduğu gibi tek bir madde** olarak yaz — kendi cümlelerine bölme, özetleme
   ya da yeniden ifade etme. Kayıt kullanıcının kendi ifadesini taşımalı; sonradan okuyan
   kapının neden atlandığını senin yorumundan değil kaynağından öğrenir.
   Kaydı kapı 1'deysen `reviews.plan-review`'a, kapı 3'teysen `reviews.code-review`'a
   ekle. Gerekçe vermezse kapıyı **atlama**. Yazıldıktan sonra kapı akışı **normal
   şekilde sürer** — kapı 1'de `planReviewPassed` artık ikinci satırından doğrudur,
   kapı 3'te `done/`'a taşıma yetkisinin ikinci maddesi sağlanır.

Kullanıcı seçim yapmadan bırakırsa hiçbir şey yazma; sonraki oturum kapıyı sağlanmamış
görür ve baştan dener.

2. seçenek **farklı bir agent değildir**, aynı sahibin başka ekosistemidir. Kullanıcı
gerçekten başka bir denetleyici istiyorsa bu, kapı sahibini değiştirmektir — *Kapı
sahipleri değişirse* kuralları geçerlidir.

### Çağrı rol taklididir, tam konfigürasyon değil

`--agent` hiçbir ekosistemde verilmediği için hedefin **yalnız rol tanımı** prompt'a
gömülür; kendi konfigürasyonu yüklenmez. Rol tanımı dosyaları:

| Ekosistem | Rol tanımı |
|---|---|
| `claude` | `.claude/agents/<ad>.md` |
| `codex` | `.codex/agent-definitions/<ad>.md` |
| `opencode` | `.opencode/agents/<ad>.md` |

Konfigürasyon yüklenmediği için agent'a atanmış model ve effort/variant ayarları
**uygulanmaz** — çağrı, o CLI'ın oturumdaki varsayılan modeliyle koşar. Bu bilinçli bir
sınırdır: denetim kararı rol metnine dayanır. Sonucu şudur — aynı planı iki ayrı
ekosistemdeki aynı role denetletirsen **birebir aynı kararı bekleme**.

## Kapı sahipleri değişirse

Kurulumdan sonra plan ya da kod denetleyicisi değiştirilebilir. İkisi farklı davranır:

- **Plan denetleyicisi değişti:** eski sahibin onayı geçersizdir — `planReviewPassed`
  `kayıt.by`'a bakar. `approved/` ve `in-progress/`'teki işler `draft/`'a döner;
  `in-progress/`'tekilerin `s:progress` bölümü korunur. `done/`'dakiler **dokunulmaz**.
- **Kod denetleyicisi değişti:** hiçbir dosya taşınmaz. Kapı 3 anlıktır; yeni sahip
  yalnız bundan sonraki tamamlamalarda çalışır.

## İptal

`inbox/`, `draft/`, `approved/` ya da `in-progress/`'teki bir iş iptal edilebilir.
`done/`'daki iş **iptal edilemez** — arşiv değiştirilmez.

- **`inbox/` kaydı** iptal edilirse `done/`'a taşınmaz, **silinir**.
- **Diğer üç klasör:** `s:review-notes`'a **yeni** bir `<!-- note:cancelled -->` kaydı
  ekle (gerekçesiyle), `outcome: cancelled` yaz ve dosyayı `done/`'a taşı. Bu üçü **tek
  bir geçiştir** — dosya geçiş bitmeden başka bir işe konu olmaz, ve geçiş bittiğinde
  `outcome` yalnız `done/`'da durur. Yarıda bırakma.
- **Kod denetimi çalıştırma** — yarıda bırakılan işi iptal etmek için kodunu onaylatmak
  anlamsızdır.
- Gerekçe olarak **eski bir not yeterli değildir**; iptal geçişinde yeni ve etiketli bir
  kayıt gerekir.

## Inbox

Kullanıcı ya da bir agent alakasız bir bulgu veya sonraya bırakılacak bir fikir
söylediğinde `.agent-work/inbox/<id>-<slug>.md` aç:

```yaml
---
id: <YYYYMMDD>-<sıra>
title: <tek cümle>
created: <YYYY-MM-DD>
source: <user | agent:<ad>>
---
```

Gövde iki-üç cümle. **Başka alan ekleme** — inbox anahtar listesi kapalıdır; bu dörtlünün
dışında herhangi bir anahtar (özellikle `revision`, `reviews`, `executor`, `outcome`)
kaydı geçersiz kılar.

`source` grameri: `user` **veya** `agent:<agent-adı>`. Ad slug kuralına uyar; `agent:`
tek başına, büyük harfli önek (`Agent:x`) ve boş değer geçersizdir. Değer yakalama anının
kaydıdır — o agent projeden sonradan çıkarılsa bile kayıt geçerli kalır.

Analiz etme, plan yazma; amaç kaybolmamasıdır. Kullanıcı "şunu ele alalım" dediğinde kayıt
analiz edilip `draft/`'a plan olarak taşınır; `id`, `created` ve `source` **korunur**.

## Plan kapısı kapalıysa

Manifest'te plan kapısı kapatılmışsa şunu söyle: **"Bu projede plan kapısı kapalı. Açmak
kurulum sonrası bir işlemdir ve proje-yükseltme skill'i gerektirir."** Var olmayan bir
komuta yönlendirme ve `.agent-work/` iskeletini kurmayı teklif etme.

## Yaygın hatalar

- Kullanıcıya ham YAML ya da alan adı göstermek — kapı 2 sade dille anlatılır.
- Bölümleri **başlığa** göre aramak — başlıklar çevrilidir, işaretlere bak.
- Onaysız kod yazmak — kaçış yalnız kullanıcının açık talebiyledir.
- `s:progress` güncellerken `revision` artırmak — ilerleme planlama içeriği değildir.
- `revision` artınca dosyayı bulunduğu klasörde bırakmak — `approved/` ve `in-progress/`
  `draft/`'a döner.
- Başka ekosistemde onaylanmış planı yeniden denetletmek — onay **denetimin çalıştığı**
  ekosisteme bağlıdır, senin oturumuna değil. Denetleyici executor'dan başka bir
  ekosistemde koşmuş olabilir; bu geçerli bir onaydır.
- Havuza sıra dayatmak — kullanıcı seçer.
- Reddedilen kaydı silmek — kayıtlar birikir, sonraki kayıt öncekini geçersiz kılar.
- Denetim kaydını eksik yazmak — beş alanın hepsi, `skipped` kayıtlarında da zorunlu.
- İptal ederken eski bir notu gerekçe saymak — **yeni** ve etiketli kayıt gerekir.
- `done/`'daki bir işi iptal etmek ya da yeniden değerlendirmek — arşiv dokunulmazdır.
