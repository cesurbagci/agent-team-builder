# sync-pipeline — Generator Davranış Sözleşmesi

> **Referans doküman.** `scripts/sync-agent-config.mjs` generator'ının ne yaptığını
> tanımlar. Burası generator'ın **gerçek koddan bağımsız sözleşmesi**dir; kod bu sözleşmeye
> uymak zorundadır, tersi değil.

## 1. Temel Model: Canonical Kaynak → Generate → Drift-check

Tek bir canonical kaynak (`.agent-source/`) vardır. Generated dosyalar **elle
değiştirilmez**; her zaman kaynaktan üretilir. Generator iki modda çalışır:

- **Sync modu (varsayılan):** kaynaktan tüm generated hedefleri yazar/günceller.
- **`--check` modu:** hiçbir şey yazmaz, sadece **drift** (kaynak ile generated
  arasındaki fark) raporlar.

## 2. Girdiler

- **Proje kökü (`root`):** script'in bir üst dizini. Tüm generated hedefler bu köke
  göre yazılır.
- **`.agent-source/` (`sourceRoot`):** tek canonical kaynak ağacı:
  - `agents/manifest.json` — rol metadata listesi (`agents[]`). Her ajan için:
    `name`, `description`, `targets[]` (varsayılan `["claude","codex"]`), `model`
    (opsiyonel), `model_reasoning_effort`, `sandbox_mode`, `nickname_candidates[]`,
    `extra_instructions[]`.
  - `agents/<role>.md` — rolün tam talimat gövdesi (tool-bağımsız).
  - `project/CLAUDE.md`, `project/AGENTS.md` ve (Codex hedefi seçiliyse)
    `project/codex-config.toml`, `project/codex-team.md`, `project/migration-map.md`.
  - `skills/<skill>/SKILL.md` — repo skill kaynakları (varsa).

Argümanlar: `--check` bayrağı `process.argv` içinde aranır; başka argüman yoktur.

## 3. Çıktı Hedefleri (generated)

Kaynaktan üretilen, elle düzenlenmeyen dosyalar:

| Kaynak | Generated hedef(ler) | Koşul |
|---|---|---|
| `project/CLAUDE.md` | `CLAUDE.md` | her zaman |
| `project/AGENTS.md` | `AGENTS.md` | Codex **veya** OpenCode hedefi |
| `project/codex-config.toml` | `.codex/config.toml` | Codex hedefi |
| `project/codex-team.md` | `.codex/team.md` | Codex hedefi |
| `project/migration-map.md` | `.codex/migration-map.md` | Codex hedefi |
| `project/opencode.json` | `opencode.json` (verbatim — JSON header taşımaz) | OpenCode hedefi |
| `project/opencode-team.md` | `.opencode/team.md` | OpenCode hedefi |
| `agents/<role>.md` | `.claude/agents/<role>.md` | `targets` içinde `claude` |
| `agents/<role>.md` | `.codex/agent-definitions/<role>.md` | `targets` içinde `codex` |
| `agents/<role>.md` + manifest | `.codex/agents/<role>.toml` | `targets` içinde `codex` |
| `agents/<role>.md` + manifest | `.opencode/agents/<role>.md` | `targets` içinde `opencode` |
| `skills/<skill>/SKILL.md` | `.claude/skills/` **ve** `.agents/skills/` (+ OpenCode hedefi varsa `.opencode/skills/`) | her zaman |

Codex agent-definition'ı üretilirken kaynak gövdesi dönüştürülür (örn.
`.claude/skills/...` yolları `.agents/skills/...` olur; Claude'a özgü Task-tool
delege ifadeleri Codex sub-agent workflow ifadesine çevrilir).

## 4. Generated Header Satırı

Her generated dosyanın başına sabit bir header yazılır:

```
# This file is generated from .agent-source. Run sync.
```

- Markdown ve TOML'de `#` yorum biçimi kullanılır (TOML'de de aynı satır geçerli).
- Header beklenen içeriğin parçasıdır; bu yüzden `--check` header eksik/yanlış ise
  drift sayar.

## 5. `--check` Drift Davranışı

`--check` modunda generator:

- **Hiçbir dosya yazmaz, silmez, dizin oluşturmaz** (yan etki yok).
- Her hedef için beklenen içeriği üretir ve diskteki içerikle karşılaştırır.
- Fark bulduğu her dosyayı `mismatches` listesine ekler. Drift kaynakları:
  1. Generated dosyanın içeriği beklenenden farklı (veya dosya hiç yok).
  2. Defterde kayıtlı olup bu turda üretilmeyen, hâlâ diskte duran bayat generated
     dosya (bkz. §8).
  3. `.agent-source/agents/` altında manifest'te listelenmeyen `<role>.md` kaynağı.
- Karşılaştırmadan önce satır sonları normalize edilir (`\r\n` → `\n`); CRLF/LF
  farkı drift sayılmaz.
- **Sonuç:**
  - `mismatches` boş → `Agent configuration is in sync.` yazar, exit code 0.
  - `mismatches` dolu → her mismatch yolunu listeler, **exit≠0** (`exitCode = 1`).

CI ve lokal kontrol bu mod ile yapılır: drift varsa build kırmızı olur.

## 6. Idempotentlik

Kaynak değişmeden sync tekrar çalıştırılırsa:

- Beklenen içerik mevcut içerikle birebir aynıysa dosya **hiç yazılmaz**
  (gereksiz dosya dokunuşu yok, `mtime` değişmez).
- Hiç değişiklik yoksa `Agent configuration already in sync.` yazar.
- Bunun sonucu: sync → `--check` her zaman temiz; sync → sync → sync ardışık
  çalıştırmaları no-op'tur. Idempotentlik garantisi sözleşmenin parçasıdır.

## 7. `.claude/settings.local.json` Muafiyeti

`.claude/settings.local.json` **canonical değildir**:

- Generator bu dosyayı kaynaktan kopyalamaz/üretmez.
- `--check` modunda bu dosyayı drift olarak saymaz.
- Geliştiriciye özel/lokal ayar dosyası olarak generator'ın tamamen dışında kalır.

## 8. Bayat Generated Dosya Raporu

**Generator hiçbir dosya silmez.** Bir dosyanın artık üretilmiyor olması, onu silmenin
güvenli olduğu anlamına gelmez; silme yolunu güvenli kılmak için gereken savunmalar
(yol containment, dosya türü kontrolü, case-insensitive yeniden adlandırma çakışması,
geçici I/O hatasının "üretilmedi" sanılması) sağladığı faydadan pahalıdır.

Bunun yerine sync bir **sahiplik defteri** tutar: `.agent-source/generated-files.json`.
Her başarılı çalışmada şunların birleşimini (repo köküne göre, POSIX ayraçlı, sıralı)
oraya yazar: bu turda ürettiği tüm generated yollar **artı** önceki defterde olup artık
üretilmeyen ama hâlâ diskte duran yollar. Defter kendini listelemez.

| Dosya durumu | Davranış |
|---|---|
| Defterde **var**, bu sefer de üretildi | Güncellenir |
| Defterde **var**, bu sefer üretilmedi, diskte duruyor | **`<yol> (stale)` raporlanır — silinmez, defterde KALIR** |
| Defterde **var**, bu sefer üretilmedi, diskte de yok | Kullanıcı silmiş → defterden düşer |
| Defterde **yok** | Hiç ilgilenilmez (kullanıcının dosyası olabilir) |

Bayat yolun defterde kalması şarttır: aksi halde dosya bir kez raporlanır, defterden
düşer ve bir daha hiç görünmez — `--check` yeşil yanarken dosya diskte kalır.

- Rapor mevcut mismatch kanalını kullanır: `--check` modunda exit 1, normal sync modunda
  `!` ile uyarı satırı.
- **Defter yoksa ya da okunamıyorsa bayat rapor üretilmez** ve hata verilmez. Bozuk
  defterin tek sonucu bir turluk eksik rapordur; sync defteri yeniden yazar.
- `--check` defter dosyasının içeriğini **değiştirmez**.
- Bayat dosyaları silmek kullanıcıya kalmıştır.

## 9. Hata Davranışı

- Manifest'te `targets` boş dizi veya geçersiz hedef (`claude`/`codex`/`opencode` dışı)
  içeriyorsa generator hata fırlatır.
- Üst seviye hata yakalanır, `process.exitCode = 1` ile sonlanır.
