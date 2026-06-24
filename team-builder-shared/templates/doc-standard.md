# Mimari Doküman Standardı

> **Otorite dosya.** Tüm mimari dokümanlar (ADR, kısıt, tasarım) bu standartta YAZILIR ve
> agent'lar dokümanları bu standarda göre OKUR. Kaynak: yerleşik "KARAR/ADR" formatı + MADR.
> Bu standart `architecture-advisor` ve `architect` rolü tarafından kullanılır; setup
> sırasında `docs/<arch-root>/templates/` altına kopyalanır.

## Konum ve dosya adlandırma
- Kök: `docs/<arch-root>/` (`docs/mimari` veya `docs/architecture`).
- `adr/NNNN-<kebab-ingilizce-baslik>.md` — numara o klasörde en yüksek+1, 4 hane (`0001`).
- `constraints/<konu>.md` — mimari kısıtlar.
- `design/<konu>.md` — tasarım notları/diyagramlar.
- per-module ise modüle özel kararlar: `modules/<name>/docs/kararlar/NNNN-*.md`.
- **Dosya adı kebab-case İngilizce; içerik `docLanguage` dilinde** (örn. tr).

## Üç doküman tipi ve şablonu
| Tip | Şablon | Ne zaman |
|---|---|---|
| ADR (karar) | `adr.md` | Bağlayıcı bir mimari karar alındığında ("şunu şu yüzden yapıyoruz") |
| Kısıt | `constraint.md` | Uyulması zorunlu bir kural ("şu katman şunu yapamaz") |
| Tasarım | `design.md` | Bir akış/modül nasıl çalışır (diyagram/açıklama) |

## Yazım kuralları (tüm tipler)
- **Kısa tut:** ADR tek ekran ideal, iki ekran tavan. Geliştirici 30 saniyede ne yapacağını anlamalı.
- **Şimdiki zaman:** kararın bugünkü hali. "Önce X yapıyorduk" gibi geçmiş öyküsü yok.
- **Net ve emir kipli karar:** "şöyle de olur böyle de" değil, **bir** karar + gerekçe.
- **docLanguage** içerik dili; kod/dosya/komut/tip adları İngilizce.
- **Kod birincil kaynak:** doküman kodu açıklar, yerine geçmez. İlgili kod yolunu referans ver.
- **Status alanını güncel tut:** karar değişince yeni ADR aç, eskiyi `Yerini Aldı (ADR-XXX)` yap.

## Agent'lar dokümanı NASIL OKUR (standart erişim)
Bir agent (architect/developer/reviewer) bir konuda karar/standart ararken:
1. Önce `docs/<arch-root>/README.md` (index) ve `ilkeler.md`.
2. İlgili domain klasörü: `docs/<arch-root>/<domain>/` (README + `*-registry.md`).
3. İlgili `adr/` ve `constraints/` dosyaları — **dosya adından** konuyu, **Status**'tan geçerliliği, **Karar** + **Sonuçlar** bölümlerinden bağlayıcı kuralı oku.
4. per-module konularda `modules/<name>/docs/`.
5. Çelişki/boşluk varsa uydurma → architect'e danış (no-workaround).

> Bu okuma sırası agent md'lerin "Sorumluluk Alanı" / "Routing & Danışma" bölümlerine yansır.
