---
name: team-builder-board
description: Plan kapısı açık bir projede .agent-work/ altındaki planları (inbox, draft, approved, in-progress, done) HTML kanban panosu olarak gösterir — varsayılan olarak klasörü izleyen canlı bir yerel sunucuyla, istenirse tek dosyalık anlık görüntü olarak; karta tıklayınca planın tamamı açılır. Salt okunur — plan dosyalarına dokunmaz. Kullanıcı "iş panosu", "kanban", "agent work panosu", "planları göster", "work board" dediğinde tetiklenir.
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
2. **Canlı pano (varsayılan):**
   ```bash
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/work-board.mjs" --root "<proje>" --detach --open
   ```
   Komut sunucuyu **bu oturumdan ayrı** arka planda başlatır ve hemen döner — oturumu
   bloklamaz, oturum ya da araç kapansa da pano açık kalır. Aynı proje için zaten
   çalışan bir pano varsa yenisini açmaz, onu gösterir. Sunucu yalnız `127.0.0.1`'i
   dinler, `.agent-work/`'ü izler ve bir plan eklenince, taşınınca ya da düzenlenince açık
   sayfaya hemen gönderir; hiçbir şey değişmezken çalışmaz. `--open` tarayıcıyı açar.
   Kullanıcı bir port isterse `--port <n>`.
   - **Durdurmak istenirse** ("panoyu kapat", "durdur"): aynı komutu `--stop` ile çalıştır.
   - Komut "5 sn içinde başlamadı" der ya da çalışma ortamı arka plan işine veya port
     dinlemeye izin vermezse: kullanıcıya bunu söyle ve aynı komutu kendi terminalinde
     çalıştırmasını öner — komutu `CLAUDE_SKILL_DIR` çözülmüş, **mutlak yolla** ver.
3. **Anlık görüntü istenirse** (canlı değil, tek dosya — paylaşmak ya da arşivlemek için):
   ```bash
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/work-board.mjs" --root "<proje>"
   ```
   Çıktı `<proje>/agent-work-board.html`; başka bir yer için `--out <dosya>`. Bu dosya
   kendiliğinden güncellenmez.
4. **Raporla:** adresi (ya da dosyanın mutlak yolunu) ver; canlı panoda pano kapatılana
   kadar açık kalacağını ve `$team-builder-board` ile "panoyu kapat" diyerek
   durdurulabileceğini söyle.
5. Anlık görüntü ürettiysen ve `agent-work-board.html` projenin `.gitignore`'unda yoksa
   eklemeyi **teklif et** — yerel bir görünümdür, proje durumu değildir. Kendiliğinden ekleme.

## Panoda ne var

- Sütunlar klasörlerdir: Gelen kutusu · Taslak · Onaylı · Devam ediyor · Bitti.
- Kart: id, başlık, executor, revizyon, alan, son plan/kod denetimi kararı (eski revizyona
  verildiyse ⟲), ilerleme listesi, yollar; iptal edilen iş üstü çizili.
- Karta tıklayınca (ya da Enter) planın frontmatter özeti ve gövdesinin tamamı açılır.
- Arama kutusu ve executor filtresi.
- Canlı panoda açık bir plan, dosyası değişince yerinde güncellenir; üstteki nokta yeşilse
  bağlantı canlıdır.
