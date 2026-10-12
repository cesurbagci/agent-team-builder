---
name: team-builder-board
description: Plan kapısı açık bir projede .agent-work/ altındaki planları (inbox, draft, approved, in-progress, done) tek dosyalık bir HTML kanban panosu olarak üretir; karta tıklayınca planın tamamı açılır. Salt okunur — plan dosyalarına dokunmaz. Kullanıcı "iş panosu", "kanban", "agent work panosu", "planları göster", "work board" dediğinde tetiklenir.
---

# team-builder-board

> **Dosya yolları:** team-builder'ın betik ve belgeleri `${CLAUDE_SKILL_DIR}/../team-builder-shared/` altındadır; bu dosyadaki yollar buna göre yazılmıştır. Yol `CLAUDE_SKILL_DIR` adıyla çözülmeden görünüyorsa (Codex plugin'i onu çözmez), onu bu SKILL.md'nin bulunduğu klasörün mutlak yoluyla değiştir.

İnce bir sarmalayıcı: işi `team-builder-shared/work-board.mjs` yapar. Pano bir
**görüntüleyicidir** — kural denetlemez, `.agent-work/`'e yazmaz, plan taşımaz. Kuralların
sahibi `plan-gate.md` ve projedeki `work-plan` skill'idir.

## Akış

1. **Proje kökünü bul:** çalışılan dizinden yukarı doğru `.agent-work/` içeren ilk dizin.
   Yoksa dur ve kullanıcıya söyle: plan kapısı bu projede kapalı ya da kurulmamış;
   açmak için `team-builder-upgrade`.
2. **Panoyu üret:**
   ```bash
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/work-board.mjs" --root "<proje>"
   ```
   Çıktı `<proje>/agent-work-board.html`. Kullanıcı başka bir yer isterse `--out <dosya>`.
3. **Canlı izleme istenirse** (`--watch`): komutu **arka planda** başlat, oturumu bloklama:
   ```bash
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/work-board.mjs" --root "<proje>" --watch 3
   ```
   Sayfa 3 sn'de bir yenilenir; ayrıntı penceresi açıkken yenilemez.
4. **Raporla:** dosyanın mutlak yolunu ve sütun başına plan sayısını ver; kullanıcıya
   dosyayı tarayıcıda açmasını söyle. Tarayıcıyı açabiliyorsan (`open` / `xdg-open` /
   `start`) aç.
5. `agent-work-board.html` projenin `.gitignore`'unda yoksa eklemeyi **teklif et** — yerel bir
   görünümdür, proje durumu değildir. Kendiliğinden ekleme.

## Panoda ne var

- Sütunlar klasörlerdir: Gelen kutusu · Taslak · Onaylı · Devam ediyor · Bitti.
- Kart: id, başlık, executor, revizyon, alan, son plan/kod denetimi kararı (eski revizyona
  verildiyse ⟲), ilerleme listesi, yollar; iptal edilen iş üstü çizili.
- Karta tıklayınca (ya da Enter) planın frontmatter özeti ve gövdesinin tamamı açılır.
- Arama kutusu ve executor filtresi.
