---
name: work-plan
description: Bu projede plan kapısı açık. Bir iş için plan yazar, denetletir, kullanıcıya onaylatır; onaylanan işlerin havuzunu yönetir ve seçilenleri işletir. Tetikleyiciler — "bunun planını çıkar", "onaylı işleri göster", "şu işi yapalım", "havuzda ne var", "şunu not et".
---

# work-plan

Bu projede **plan kapısı** açıktır: kod yazılmadan önce plan yazılır, denetlenir ve
**kullanıcı onaylar**. Onaysız kod yazılmaz.

## Önce: hangi mod?

| Kullanıcı ne diyor | Mod |
|---|---|
| Yeni bir iş tarif ediyor | **Plan yaz** |
| "Havuzda ne var", "şu işi yapalım" | **Havuz** |
| "Şunu not et", "sonra bakarız" | **Inbox** |
| "Plansız yap" | Kapı atlanır; hiçbir dosya oluşturulmaz, `.agent-work/`'e yazılmaz |

## Ortak kurallar

- **`.agent-work/` altına yalnız sen yazarsın.** Denetleyiciler dosya değiştirmez; sana
  sonuç döndürür, kaydı sen yazarsın.
- **Bölümler işaretle bulunur.** `<!-- s:what -->`, `<!-- s:how -->`,
  `<!-- s:questions -->`, `<!-- s:review-notes -->`, `<!-- s:progress -->`. Başlık
  metinleri projenin diline çevrilidir; **asla başlığa göre arama yapma.**
- **`revision`** yalnız planlama içeriği değişince artar: `title`, `domain`, `paths`,
  `executor` ve `s:what` / `s:how` / `s:questions` bölümleri. `s:review-notes`,
  `s:progress`, `reviews` ve `adr` **artırmaz**.
- **`id`** `<YYYYMMDD>-<n{2,}>` biçimindedir (en az iki hane; 99'dan sonra üç hane),
  değişmez; dosya adı `<id>-<slug>.md`, `<slug>` `title`'dan türetilir ve
  `^[a-z0-9]+(?:-[a-z0-9]+)*$` kuralına uyar. Yeni id verirken `.agent-work/` altındaki
  **tüm** klasörleri tara ve o güne ait en büyük sırayı bir artır.

## Plan yaz

1. **Sahibini bul.** İşin dokunacağı kod yollarına bak; projenin routing tablosundan o
   yolun sahibi developer'ı belirle. `executor` odur, `<ekosistem>/<ad>` biçiminde.
   Ekosistem **bu oturumun ekosistemidir**.
2. **`.agent-work/TEMPLATE.md`'yi kopyala** → `.agent-work/draft/<id>-<slug>.md`.
   `revision: 1`, `reviews` boş diziler, `s:progress` sentinel'li.
3. **Gövdeyi doldur.** `s:what` sade dille ve örnekle, ölçülebilir kabul kriteriyle;
   `s:how` yaklaşım ve etkilenen bileşenler (`paths` ile tutarlı); `s:questions` boş
   bırakılmaz.
4. **Kapı 1 — plan denetimi.** Projenin plan denetleyicisi tanımlıysa onu çağır.
   Denetleyici sana şunu döndürür:
   ```
   verdict: approved | rejected
   reviewed_revision: <denetlediği revision>
   reasons: [ ... ]
   ```
   - `reviewed_revision` diskteki `revision` ile aynı değilse **kaydı yazma** — plan
     denetim sırasında değişmiş demektir, denetimi tekrarla.
   - Kaydı `reviews.plan-review`'a ekle: `{ by, at, revision, verdict, reasons }`.
     `rejected` ise `reasons` boş olamaz ve gerekçeyi `s:review-notes`'a da yaz.
   - Denetleyici tanımlı değilse `{ by: system, verdict: skipped, reasons: [] }` kaydı
     düş ve devam et.
5. **Kapı 2 — kullanıcı onayı.** Planı **sade dille, örnekle** anlat. Alan adı
   (`gates`, `executor`, `paths`) ya da ham YAML **gösterme**. "Böyle ilerleyelim mi?"
   diye sor.
   - Onaylarsa dosyayı `.agent-work/approved/`'a taşı.
   - Değişiklik isterse `draft/`'ta bırak, geri bildirimi `s:review-notes`'a yaz;
     düzeltme `revision`'ı artırır ve kapı 1'i geçersiz kılar.

**Kod yazma:** onaylanmamış bir planın işini yapma. Kullanıcı açıkça "plansız yap" derse
o iş için kural atlanır.

## Havuz

- **"Havuzda ne var"** → `.agent-work/approved/` içindekileri listele. Her biri için
  başlık ve tek cümle özet ver; dosya adı ve alan adı dökme.
- **"Şunu yapalım" / "şu ikisini yapalım"** → kullanıcı seçer. **Sıra dayatma** — havuz
  FIFO değildir.
- Seçilen dosyayı `.agent-work/in-progress/`'e taşı, `s:progress` sentinel'ini sil ve
  ilerleme yazmaya başla: son durum, sıradaki adım, engel, dokunulan yerler.
- İşi her bıraktığında `s:progress`'i güncelle — başka bir oturum oradan devam edecek.

## İşi bitirme

1. **Kapı 3 — kod denetimi.** Projenin kod denetleyicisi tanımlıysa çağır; sonucu
   `reviews.code-review`'a kaydet. Tanımlı değilse `skipped` kaydı düş.
2. Onaylandıysa dosyayı `.agent-work/done/`'a taşı.
3. **Kod denetimi onayı tek seferliktir.** İş `done/`'a gitmeden kesilirse, devam
   edildiğinde denetimi **yeniden** çalıştır — eski kayıt geçmiştir, yetki vermez.
4. Kalıcı bir mimari karar çıktıysa mimarlık rolüne ADR yazdır ve `adr:` alanına bağla.

## İptal

Herhangi bir klasördeki iş iptal edilebilir: `outcome: cancelled` yaz, `s:review-notes`'a
**yeni** bir `<!-- note:cancelled -->` kaydı ekle (gerekçesiyle) ve dosyayı `done/`'a taşı.
**Kod denetimi çalıştırma** — yarıda bırakılan işi iptal etmek için kodunu onaylatmak
anlamsızdır. `inbox/` kaydı iptal edilirse `done/`'a taşınmaz, **silinir**.

## Inbox

Kullanıcı ya da bir agent alakasız bir bulgu veya sonraya bırakılacak bir fikir
söylediğinde `.agent-work/inbox/<id>-<slug>.md` aç:

```yaml
---
id: <YYYYMMDD-nn>
title: <tek cümle>
created: <YYYY-MM-DD>
source: <user | agent:<ad>>
---
```

Gövde iki-üç cümle. **Başka alan ekleme** — inbox anahtar listesi kapalıdır. Analiz etme,
plan yazma; amaç kaybolmamasıdır. Kullanıcı "şunu ele alalım" dediğinde kayıt analiz
edilip `draft/`'a plan olarak taşınır; `id`, `created` ve `source` **korunur**.

## Plan kapısı kapalıysa

Manifest'te plan kapısı kapatılmışsa şunu söyle: **"Bu projede plan kapısı kapalı. Açmak
kurulum sonrası bir işlemdir ve proje-yükseltme skill'i gerektirir."** Var olmayan bir
komuta yönlendirme.

`.agent-work/` hiç yoksa iskeleti kurmayı teklif et.

## Yaygın hatalar

- Kullanıcıya ham YAML ya da alan adı göstermek — kapı 2 sade dille anlatılır.
- Bölümleri **başlığa** göre aramak — başlıklar çevrilidir, işaretlere bak.
- Onaysız kod yazmak — kaçış yalnız kullanıcının açık talebiyledir.
- `s:progress` güncellerken `revision` artırmak — ilerleme planlama içeriği değildir.
- Havuza sıra dayatmak — kullanıcı seçer.
- Reddedilen kaydı silmek — kayıtlar birikir, sonraki kayıt öncekini geçersiz kılar.
- İptal ederken eski bir notu gerekçe saymak — **yeni** ve etiketli kayıt gerekir.
