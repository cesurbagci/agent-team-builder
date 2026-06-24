# Mimari Doküman Yapısı (v2 — Zengin Ağaç)

> v1'in basit `docs/architecture/{adr,constraints,design}` yapısını,
> **domain-bazlı zengin ağaca** genişletir.
> **Sadece architect yazar.** Dosya konumu kuralı architect agent md'sine + CLAUDE.md'ye işlenir.

## arch-root Seçimi

Kök dizin adı sihirbazda kullanıcıya **sorulur**:
- `docs/mimari` (Türkçe projeler) **veya**
- `docs/architecture`

Aşağıda `<arch-root>` bu seçimi temsil eder.

## Layout Seçimi

- **central:** tüm mimari dokümanlar `docs/<arch-root>/` altında toplanır.
- **per-module:** central'a ek olarak her modül kendi dokümanını tutar:
  `modules/<name>/docs/{README.md, api.md, kararlar/}`. Modül listesi SORULMAZ; ADR'ler
  yazıldıkça organik oluşur. Seçilen kural architect md'sine yazılır.

---

## Ağaç (central)

```
docs/<arch-root>/
├── README.md                 → İndeks; herkesi ilgili domaine yönlendiren ana doküman
├── ilkeler.md                → Cross-cutting prensipler (tüm domain'leri bağlayan kurallar)
├── <domain>/                 → Her developer domain'i için bir klasör (governance-defaults domain-split ile birebir)
│   ├── README.md             → Domain'in mimari özeti
│   ├── <konu>-registry.md    → Kodla SENKRON katalog (api-registry, component-registry, registry...)
│   └── adr/                  → Domain'e özel kararlar
│       └── 0001-...md, 0002-...md
├── cross-cutting/            → Üç/N domaini de etkileyen kararlar (anayasa KARAR'ları gibi)
│   ├── README.md
│   ├── <standart>.md         → ör. kod-yorumlama-standardi.md (günlük referans)
│   └── adr/
│       └── 0001-...md
└── templates/
    ├── adr-sablonu.md        → Yeni ADR kalıbı (MADR — aşağıda)
    └── <module-docs-sablonu>/→ per-module docs şablonu (layout=per-module ise kopyalanır)
        ├── README.md
        ├── api.md
        └── kararlar/
            └── 0001-ornek-karar.md
```

### per-module ek ağaç (layout=per-module)

```
modules/<name>/docs/
├── README.md     → Modülün ne yaptığı, mimari yeri
├── api.md        → Modülün dışa açtığı yüzey (kodla senkron)
└── kararlar/     → Modüle özel ADR'lar (cross-cutting'e taşınana kadar burada)
    └── 0001-...md
```

> `<domain>` klasörleri, `governance-defaults.md` domain-split developer rolleriyle birebir
> eşleşir (ör. `backend/`, `frontend/`, `extension/`). Her registry
> dosyası ilgili kod yolunun kataloğudur ve kod-doc senkronizasyon disiplinine tabidir.

---

## ADR Formatı (MADR varyantı)

> **Tek otorite:** Format ve okuma/yazma standardı `templates/doc-standard.md`'dir; ADR/kısıt/
> tasarım şablonları `team-builder-shared/templates/{adr,constraint,design}.md`. Aşağıdaki kalıp
> referanstır; çakışma olursa `doc-standard.md` + `templates/` geçerlidir (formatı iki yerde
> ayrı tutma — drift). Setup bu şablonları `docs/<arch-root>/templates/`'e kopyalar.

Her ADR `docs/<arch-root>/<domain>/adr/NNNN-baslik.md` (domain'e
özel) ya da `cross-cutting/adr/NNNN-baslik.md` (çok domainli) altına yazılır.

```markdown
# NNNN: [Kısa, emir kipli başlık]

- **Durum:** Önerilen | Kabul Edildi | Yerini Aldı (ADR-XXX'e)
- **Tarih:** YYYY-MM-DD
- **Domain:** <domain> | cross-cutting

## Bağlam
*Kararı tetikleyen durum: hangi soru/sorun ortaya çıktı, neden şimdi.*

## Karar
*Ne yapacağız. Net, emir kipli, tek paragraf.*

## Gerekçe
*Niye bu seçim? Hangi alternatifleri eledik ve neden? Hangi ilkeye dayanıyor?*

## Sonuçlar
*Geliştiriciler için ne anlama geliyor? Yeni kurallar/sınırlar; hangi kod yeri (paket/dosya) ve hangi doc dosyası güncellenmeli.*

## İlgili
*İlgili ADR'lar, kod referansları (paket/dosya yolu), dış kaynaklar.*
```

### ADR Kuralları
- Tek ekran ideal, iki ekran tavan.
- Başlık emir kipinde ve kısa.
- Dosya adı İngilizce kebab-case: `0003-extension-permission-model.md` (Türkçe karakter yok, içerik `docLanguage` dilinde).
- Yeni ADR `Durum: Önerilen` ile başlar; architect onayından sonra `Kabul Edildi`.
- ADR yerini alındığında eski dosya silinmez; `Durum: Yerini Aldı (ADR-XXX'e)` olur.

---

## İskelet Üretimi (setup sırasında)

Sihirbaz, onaylanan domain'lere göre üretir:
1. `docs/<arch-root>/README.md` + `ilkeler.md` (docLanguage dilinde kısa içerik).
2. Her domain için `<domain>/{README.md, adr/}` (registry dosyaları boş başlık + "kodla senkron" notu ile).
3. `cross-cutting/{README.md, adr/}` + seçilen standart dosyaları (anayasa presetlerinden türetilir).
4. `templates/adr-sablonu.md` (yukarıdaki MADR) + `templates/<module-docs-sablonu>/` (per-module ise).
5. layout=per-module ise her modülün ilk dokümanı şablondan organik kopyalanır (architect ADR yazdıkça).

Bu kuralların tamamı (sadece architect yazar; ADR konum kuralı; registry kod-doc senkron disiplini)
architect agent md'sine ve CLAUDE.md'ye işlenir.
