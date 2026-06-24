# constitution.md — Cross-cutting "Anayasa" Presetleri

> Paylaşılan referans. Sihirbaz (`team-builder-setup`) ve üye rutini (`member-template.md`)
> bu dosyaya dayanır. Üretimde çalışan bir referans agent-takımı kurulumunun genelleştirilmiş hâli.

## Amaç

Anayasa, projedeki tüm rolleri kesen (cross-cutting) numaralı kararlardır: tek tek
agent'lara değil, takımın tamamına uygulanan disiplinler.
**Dördü de DEFAULT AÇIK** gelir; sihirbaz her birini gösterir ve kullanıcı kapatabilir
(toggle). Bazı satırlar projeye özeldir → kullanıcıya sorulur.

Anayasa alanları `manifest.constitution`'a yazılır:

```jsonc
"constitution": { "noWorkaround": true, "codeDocSync": true, "perAgentMemory": true, "languageStandard": true }
```

Açık olan her preset, ilgili agent md gövdelerine (`agent-md-rich.md` kalıbı) ve
CLAUDE.md/AGENTS.md'ye gömülür. `default` değer her zaman `true`'dur; kullanıcı
toggle ile `false` yaparsa o preset hiçbir agent'a yansımaz.

---

## SUNUM KURALLARI (kullanıcıya nasıl sorulur)

> Bu bölüm, presetlerin kullanıcıya gösterilme biçimini yönetir. Aşağıdaki teknik
> açıklamalar (KARAR 1-4) **senin için**; kullanıcıya **sade dille** sun.

1. **SIRA:** Presetler **rollerden SONRA** sorulur. Kullanıcı hangi rolleri istediğini
   söylemeden (architect/developer/reviewer...) preset davranışını sorma.
2. **VAR OLMAYAN ROLE ATIF YAPMA.** Açıklamayı seçilen takıma göre uyarla:
   - reviewer **eklendiyse**: "Reviewer bunları otomatik 'düzeltilmeli' işaretler." denebilir.
   - reviewer **eklenmediyse**: bu cümleyi yazma; bunun yerine "Kural agent talimatlarına
     yazılır ama otomatik denetleyen bir reviewer yok." de.
3. **JARGON YOK.** `noWorkaround`, `codeDocSync` gibi alan adlarını kullanıcıya gösterme;
   günlük dille açıkla. Aşağıdaki tek-satırlık sade açıklamaları kullan:

   | Kural | Kullanıcıya gösterilecek sade açıklama |
   |---|---|
   | Workaround yasağı | "Geçici çözüm / kestirme yasak; belirsizlikte mimara gidilir." |
   | Kod–doküman birlikte | "Bir kod yeri değişince ilgili doküman aynı işte güncellenir (eşleşmeyi ayrıca soracağım)." |
   | Her agent kendi notu | "Her rol kendi `.agent-memory/<rol>/` klasörüne not tutar; başkasınınkine karışmaz." |
   | Dil standardı | "Kod İngilizce; doküman/yorum/cevap senin seçtiğin dilde." |

4. **Default açık**, kullanıcı kapatabilir. Açık kalanlar için projeye özel satırları sor
   (sadece açık olanlar için; aşağıya bak).

---

## KARAR 1 — No-workaround disiplini  (`noWorkaround`)

**Ne:** "Çalışıyor olması yetmez." Mimari kararı bypass eden hack/workaround kabul
edilmez; belirsizlikte architect'e gidilir.

**Agent'lara yansıması:**
- **reviewer:** workaround pattern listesindeki bir desen görürse **otomatik Kritik**
  bulgu üretir (review'da geri çıkarılır).
- **architect:** workaround'u aktif reddeder; doğru yolu söyler veya ADR açtırır.
- **developer'lar:** belirsizlikte kestirme yol aramaz, architect'e danışır
  (routing.md'deki "architect'e danış" kuralıyla birleşir).

**PROJEYE ÖZEL → kullanıcıya sorulur:** workaround pattern listesi. Referanstan bir
çekirdek liste uyarlanır (deprecate API kullanımı, sözleşme/kanal bypass'ı, modül-sınırı
ihlali vb.), kullanıcı projeye özgü desenler ekler.

## KARAR 2 — Kod-doc senkronizasyonu  (`codeDocSync`)

**Ne:** `kod-yeri → beklenen doküman` tablosu. Belirli kod yolları değiştiğinde ilgili
dokümanın da güncel olması beklenir; eksikse reviewer Kritik verir.

**Agent'lara yansıması:**
- **reviewer:** `manifest.codeDocSync[]` satırlarına göre, ilgili kod değişti ama
  beklenen doc güncellenmediyse **otomatik Kritik**.
- **architect:** standart/kontrat dosyalarını kararla birlikte günceller (kayıt kod
  ile senkron tutulur).
- **developer'lar:** kendi alanlarındaki kod-doc eşleşmesini gözetir.

**PROJEYE ÖZEL → kullanıcıya SADE dille sorulur** (alan adı `codeDocSync` veya "glob"
gibi jargon GÖSTERME). Önce ne olduğunu bir örnekle anlat, sonra nasıl başlatacağını sor:

> "Bazı kod yerleri değişince, onu anlatan dokümanın da güncel kalması gerekir.
> Örnek: `src/api/` (kod) değişince `docs/api.md` (doküman) aynı işte güncellenir.
> Reviewer, kod değişip doküman güncellenmediyse uyarır. Bu eşleştirmeyi nasıl başlatalım?
> **1) Şimdilik boş bırak (önerilen)** — sonra ihtiyaç oldukça eklenir.
> **2) Senin için birkaç satır önereyim** — projeni inceleyip taslak çıkarırım, onaylarsın.
> **3) Satırları ben yazayım.**"

Seçime göre `manifest.codeDocSync[]`'i doldur (boş `[]` de geçerli). Kullanıcıya hiçbir
zaman ham `{code, doc}` JSON'u veya "glob deseni" terimini sorma; "hangi klasör → hangi
doküman" diye günlük dille konuş.

## KARAR 3 — Per-agent memory  (`perAgentMemory`)

**Ne:** Her agent'ın kalıcı belleği `.agent-memory/<agent>/` altında tutulur;
`MEMORY.md` index dosyasıdır. Memory **generated değildir** (canonical değil, kaynak
da değil — agent'ın kendi alanı).

**Agent'lara yansıması:**
- **her agent md'sine memory disiplini gömülür:** "Memory okunacak/yazılacaksa sadece
  `.agent-memory/<kendi-adın>/` kullan; kalıcı bilgi için ayrı Markdown dosyası aç,
  `MEMORY.md`'yi index tut."
- `.claude/agent-memory/**` ve `.codex/agent-memory/**` **kullanılmaz** ve repo
  tarafından oluşturulmaz (tek canonical memory alanı repo kökündeki `.agent-memory/`).

**Projeye özel satır gerektirmez** (disiplin standarttır); sadece toggle ile
açılır/kapanır.

## KARAR 4 — Dil & yorum standardı  (`languageStandard`)

**Ne:** Dil kuralları + kod yorumlama disiplini.
- Kod, commit, değişken/identifier: **İngilizce**.
- Doküman ve yorumlar: **`docLanguage`** (manifest'ten; örn. `tr`).
- Kullanıcıya cevap dili: `docLanguage`.

**Yorum standardı üslubu** (referanstan):
- Şimdiki zaman (kodun bugün ne yaptığı).
- Eski implementasyon / refactor öyküsü yok.
- Task ID, ticket, PR referansı yok.
- Self-evident kodda yorum yok.
- TS/tip imzasını yorumda tekrar etme.
- Yorum kodla senkron; yanlışsa silinir/güncellenir.

**Agent'lara yansıması:**
- **dil kuralları `docLanguage`'den türetilir** ve her agent md'sinin "Dil Kuralları"
  bölümüne yazılır.
- **reviewer:** yorum kalite denetimini yapar (public export'ta JSDoc yok = Kritik;
  eski implementasyon anekdotu = Uyarı gibi).

**PROJEYE ÖZEL → kullanıcıya sorulur:** yorum standardı detayları (örn. process/runtime
tag'leri, `@example` zorunluluğu, ESLint plugin entegrasyonu). Dil kuralları
`docLanguage`'den otomatik türer; yorum üslubu detayları sorulabilir.

---

## Sihirbaz akışı (özet)

0. **Önce roller belirlenmiş olmalı** (presetler rollerden sonra sorulur — bkz. SUNUM KURALLARI).
1. Dört kuralı **default açık** ve **sade dille** (SUNUM KURALLARI tablosu) göster; kullanıcı her birini toggle edebilir. Seçilmemiş role atıf yapma.
2. Açık her preset için **projeye özel satırları** sor:
   - KARAR 1 → workaround pattern listesi
   - KARAR 2 → kod-doc sync tablosu
   - KARAR 4 → yorum standardı detayları (dil `docLanguage`'den gelir)
   - KARAR 3 → ek satır gerektirmez
3. Sonuçları `manifest.constitution` (+ `codeDocSync[]`) alanlarına yaz.
4. Açık presetleri ilgili agent md gövdelerine ve CLAUDE.md/AGENTS.md'ye gömül
   (reviewer'da otomatik Kritik kuralları, her agent'ta memory disiplini, dil bölümü).
