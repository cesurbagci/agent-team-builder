---
name: architecture-advisor
description: Mevcut projeyi analiz edip mimari dokümanları (ADR = mimari karar kaydı, mimari kısıtlar, tasarım notları) önerir ve kullanıcıyla ADIM ADIM birlikte yazar. docs/<arch-root>/ altına yazar; takım varsa architect rolüyle uyumludur. Kullanıcı "ADR yaz", "mimari karar belgele", "mimari dokümanları doldur", "architecture advisor", "mimari kararları çıkar" dediğinde veya team-builder-setup sonunda tetiklenir.
---

# Architecture Advisor

Projedeki **mimari kararları** kullanıcıyla birlikte yazılı hale getirir. Sıfırdan değil:
önce mevcut kodu/yapıyı analiz eder, **hangi kararların belgelenmesi gerektiğini önerir**,
sonra seçilenleri **tek tek, kullanıcıyla birlikte** yazar.

**Kavramlar (kullanıcıya gerekirse sade anlat):**
- **ADR (Mimari Karar Kaydı):** "Şu kararı şu gerekçeyle aldık" diye kısa not (örn. *"state için Zustand seçtik, çünkü…"*).
- **Mimari kısıt:** "şu katman şunu yapamaz" gibi kural (örn. *"UI doğrudan DB'ye erişemez"*).
- **Tasarım notu / diyagram:** bir akışın/modülün nasıl çalıştığı.

**Temel ilke:** Tek seferde her şeyi doldurmaya çalışma. Önce iskele/öneri → kullanıcı seçsin
→ her birini birlikte yaz → sonra kalanlara geç. Kullanıcı "yeter" diyene kadar.

## Önce: konum ve dil

1. **Takım kaynağı var mı bak:** `.agent-source/agents/manifest.json` varsa oradan al:
   - `architectureDocs.root` (örn. `docs/mimari`), `architectureDocs.layout` (`central`|`per-module`), `docLanguage`.
   - Yapı/format için `~/.claude/skills/team-builder-shared/architecture-docs.md`.
2. **Yoksa kullanıcıya sade sor:** mimari dokümanlar nereye (`docs/mimari` | `docs/architecture`), dil ne (tr/en). (Bu skill takımdan bağımsız da çalışır.)
3. Yazma yetkisi yalnızca `docs/<arch-root>/` (ve per-module ise `modules/<name>/docs/`) altındadır — **production koduna yazma**, sadece oku (architect disiplini).
4. **STANDART ZORUNLU:** Tüm dokümanları `~/.claude/skills/team-builder-shared/templates/doc-standard.md` standardına ve şablonlarına göre yaz:
   - ADR → `templates/adr.md`, kısıt → `templates/constraint.md`, tasarım → `templates/design.md`.
   - Proje kökünde `docs/<arch-root>/templates/` zaten varsa (setup kopyalamış) onları kullan; yoksa `team-builder-shared/templates/`'ten oku. Yapı için `~/.claude/skills/team-builder-shared/architecture-docs.md`.

## Akış

### 1. Projeyi analiz et
- Kod köklerini ve yapıyı tara (`apps/*`, `modules/*`, `packages/*`, `src/*`, paket/manifest dosyaları, dizin desenleri).
- Mevcut `docs/<arch-root>/` içeriğini oku (ne var, ne eksik — iskelet mi, dolu mu).
- Koddan **ima edilen kararları** çıkar: seçilmiş kütüphaneler/desenler (state yönetimi, router, IPC/iletişim kanalı, katman sınırları, paketleme, auth, veri erişimi...). "Yazılı olmayan ama uygulanan" kuralları tespit et.

### 2. Öneri listesi sun (önceliklendirilmiş)
Kullanıcıya **kısa, numaralı bir liste** sun: yazılmaya değer ADR / kısıt / tasarım dokümanları. Her madde için tek cümle "neden gerekli". Örnek:
```
Önerdiğim mimari dokümanlar (önem sırasıyla):
1. ADR — State yönetimi seçimi (kodda <X> görülüyor; gerekçesi yazılı değil)
2. Kısıt — Katman sınırları (<şu> <buna> bağımlı olmamalı)
3. ADR — İletişim/kanal seçimi (<...>)
4. Tasarım — <modül> akışı
...
```
Kullanıcı **hangilerini, hangi sırayla** yazacağını seçsin; ekleme/çıkarma yapabilsin.
Hiçbir şeyi onaysız yazma.

### 3. Seçilenleri TEK TEK birlikte yaz
Her seçilen madde için:
1. **Kısa taslak hazırla** — ilgili **standart şablonu** (`templates/adr.md` | `constraint.md` | `design.md`, `doc-standard.md`'ye uygun) doldur. ADR alanları: Başlık · Status · Tarih · Domain · Bağlam · Karar · Gerekçe · Sonuçlar · İlgili. Kararı koddan çıkardığın haliyle "mevcut davranış böyle, bağlayıcı kabul ediyoruz" tonuyla yaz.
2. **Kullanıcıya göster, birlikte düzelt** (eksik gerekçe, yanlış varsayım vb.). Belirsiz bir mimari seçim varsa kullanıcıya sor — uydurma.
3. **Onaylanınca dosyaya yaz:**
   - ADR → `docs/<arch-root>/adr/NNNN-<kebab-ingilizce-baslik>.md` (numara = o klasördeki en yüksek + 1; başlık/içerik docLanguage'de).
   - Kısıt → `docs/<arch-root>/constraints/<konu>.md`.
   - Tasarım → `docs/<arch-root>/design/<konu>.md`.
   - per-module ve karar modüle özelse → `modules/<name>/docs/kararlar/NNNN-*.md`.
4. **Index/registry güncelle:** `docs/<arch-root>/README.md` (ve varsa registry) ilgili linki ekle.
5. Sonraki maddeye geç. Aralarda kullanıcıya "devam edelim mi / başka eklemek istediğin var mı?" diye sor.

### 4. Bitiş
- Ne yazıldığını özetle (dosya yolları).
- Eksik bırakılanları "sonra `/architecture-advisor` ile devam edilebilir" diye not et.
- Takım varsa: bu dokümanlar architect'in alanıdır; kod değiştikçe ilgili ADR/kısıt güncel tutulur (kod-doküman senkronizasyonu).

## Kurallar
- **Önce öner, sonra yaz; tek tek ilerle.** Toplu doldurma yapma.
- **Onaysız yazma.** Her dosya kullanıcı onayından geçer.
- **docLanguage'de yaz**; dosya adları kebab-case İngilizce, içerik seçilen dilde.
- **Kısa tut:** her ADR tek ekran ideal. Geliştirici 30 saniyede ne yapacağını anlasın.
- **Sadece `docs/<arch-root>/` (+per-module docs) altına yaz**, production koduna asla.
- Bir konuda zaten ADR varsa yeniden yazma; gerekiyorsa "yerini aldı" statüsüyle güncelle.
