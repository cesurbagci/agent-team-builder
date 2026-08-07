---
name: work-plan
description: Bu projede plan kapısı açık. Bir iş için plan yazar, denetletir, kullanıcıya onaylatır; onaylanan işlerin havuzunu yönetir ve seçilenleri işletir. Tetikleyiciler — "bunun planını çıkar", "onaylı işleri göster", "şu işi yapalım", "havuzda ne var", "şunu not et".
---

# work-plan

Bu projede **plan kapısı** açıktır: kod yazılmadan önce plan yazılır, denetlenir ve
**kullanıcı onaylar**. Onaysız kod yazılmaz.

Bu dosya plan kapısının **tek otoritesidir**: kapının bütün kuralları burada yazılıdır ve
kural için başka bir belgeye bakman gerekmez. Projenin kendi dosyalarını (manifest,
routing tablosu, `TEMPLATE.md`, ADR'ler) elbette okursun — onlar kural değil, veridir.

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

Yeni `id` verirken `.agent-work/` altındaki **tüm** klasörleri tara, o güne ait en büyük
sırayı bir artır. Aynı `id`'yi taşıyan bir dosya zaten varsa **yazma, dur** — çakışmayı
kullanıcıya bildir.

`created` ve `source` alanları `id` gibi **değiştirilemez**; dosya hangi klasöre giderse
gitsin ilk yazıldıkları gibi kalır.

### Denetim kaydı şeması

Her kapı sonucu `reviews.plan-review` ya da `reviews.code-review` dizisine **tam** şu
şekilde yazılır — beş alanın hepsi zorunludur:

```yaml
{ by: <ekosistem>/<agent-adı> | system, at: <YYYY-MM-DD>, revision: <n>,
  verdict: approved | rejected | skipped, reasons: [<madde>, ...] }
```

- `by`: `<ekosistem>/<agent-adı>` biçimi zorunlu — çıplak ad (`architect`), eksik parça
  (`claude/`) ya da boş parça (`//x`) geçersizdir. **Yalnız `skipped`** kayıtlarında
  `system` yazılır; `approved` ve `rejected` kayıtlarında **asla** `system` olamaz.
- `at`: `YYYY-MM-DD`; eksik ya da başka biçim geçersizdir.
- `revision`: kaydın denetlediği revizyon — pozitif tam sayı. `"3"` (metin), `3.5`, `0`
  ve negatif değerler geçersizdir.
- `verdict`: yalnız `approved`, `rejected`, `skipped`. Başka değer (`ok`, `pending`)
  geçersizdir.
- `reasons`: **her zaman dizi** — `approved` ve `skipped` kayıtlarında `[]`, `rejected`
  kayıtlarında **boş olamaz**. Metin ya da eksik alan geçersizdir.
- Kayıtlar **asla silinmez**; sonraki kayıt öncekini geçersiz kılar.

### `planReviewPassed` — plan onayı geçerli mi?

Bu yüklem **dosyayla birlikte taşınır** ve **çağıran oturumdan bağımsızdır**. Bir planı
başka bir ekosistemde açtığında yeniden denetletme; kimlik planın kendi `executor`
ekosisteminden kurulur, senin oturumundan değil.

| Projenin plan denetleyicisi | Doğru olma koşulu |
|---|---|
| Bir agent adı | `plan-review`'ın **son** kaydı `approved`, `kayıt.revision === plan.revision`, ve `kayıt.by` = `<executor'ın ekosistemi>/<güncel denetleyici adı>` |
| Tanımsız (`null`) | `plan-review`'ın **son** kaydı `skipped`, `kayıt.revision === plan.revision`, ve denetleyici hâlâ tanımsız |

### `executor` geçerli mi?

Bir planın `executor` alanını **her okuduğunda** — yalnız plan yazarken değil, havuzdan
seçerken ve yarım işi devam ettirirken de — üçünü birden doğrula:

1. Ad gerçek bir agent ve **uygun executor'lardan** biri: routing tablosunda geçiyor ve
   kod yazıyor.
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
- Doğruysa **önce** `s:progress`'i doldur (sentinel'i sil, yerine son durum / sıradaki adım
  / engel / dokunulan yerler yaz), **sonra** dosyayı `.agent-work/in-progress/`'e taşı.
  Sıra bu; boş `s:progress` ile `in-progress/`'e girilmez.
- İşi her bıraktığında `s:progress`'i güncelle — başka bir oturum oradan devam edecek.

## İşi bitirme

1. **Kapı 3 — kod denetimi.** Projenin kod denetleyicisi tanımlıysa çağır ve sonucu
   `reviews.code-review`'a şemaya göre kaydet. `rejected` ise `reasons` boş olamaz,
   gerekçeyi `s:review-notes`'a da yaz ve iş `in-progress/`'te kalır.
   Denetleyici tanımlı değilse `{ by: system, at: <bugün>, revision: <plan.revision>,
   verdict: skipped, reasons: [] }` kaydı düş.
2. Kalıcı bir mimari karar çıktıysa mimarlık rolüne ADR yazdır ve `adr:` alanına bağla —
   bunu **taşımadan önce** yap; `done/` arşivdir, oraya girdikten sonra dosya değişmez.
3. **`done/`'a taşıma yetkisi:** son `code-review` kaydı `approved` **ya da** denetleyici
   tanımsız olduğu için `skipped` ise taşı. Denetleyici tanımsızken kullanıcıdan **ek onay
   isteme** — kapı 3 yoktur, iş doğrudan biter.
4. **Kod denetimi onayı tek seferliktir.** İş `done/`'a gitmeden kesilirse, devam
   edildiğinde denetimi **yeniden** çalıştır — eski kayıt geçmiştir, yetki vermez.

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
- Başka ekosistemde onaylanmış planı yeniden denetletmek — onay `executor` ekosistemine
  bağlıdır, senin oturumuna değil.
- Havuza sıra dayatmak — kullanıcı seçer.
- Reddedilen kaydı silmek — kayıtlar birikir, sonraki kayıt öncekini geçersiz kılar.
- Denetim kaydını eksik yazmak — beş alanın hepsi, `skipped` kayıtlarında da zorunlu.
- İptal ederken eski bir notu gerekçe saymak — **yeni** ve etiketli kayıt gerekir.
- `done/`'daki bir işi iptal etmek ya da yeniden değerlendirmek — arşiv dokunulmazdır.
