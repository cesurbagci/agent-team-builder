# Tasarım: Generated Dosya Defteri (rapor-only)

- **Tarih:** 2026-08-03
- **Durum:** Onaylandı — uygulama planı bekliyor
- **Kapsam:** `sync`'in dosya silmesini tamamen durdurmak; bunun yerine ürettiklerinin defterini tutup bayatlayanları raporlamak

## Problem

`sync` bugün kullanıcının elle yazdığı agent dosyalarını **siliyor**. Fixture üzerinde
doğrulandı:

```
$ node team-builder-shared/sync-agent-config.mjs --root <proje>
Synchronized agent configuration:
- .claude/agents/my-helper.md (removed)
```

Sebep: `removeOrphans(dirPath, expectedFileNames, allowedExtensions)` bir dizindeki
**beklenen ad listesinde olmayan her dosyayı** siler. Beklenen liste manifest'ten türer,
dolayısıyla kullanıcının elle eklediği agent orphan sayılır.

Etkilenen dizinler: `.claude/agents/`, `.codex/agent-definitions/`, `.codex/agents/`,
`.opencode/agents/`.

Ters yönde ikinci bir hata: skill dizinlerinde (`.claude/skills/` vb.) hiç temizlik yok,
bu yüzden kaynaktan çıkarılan bir skill'in generated mirror'ları ortada kalıyor ve
`--check` temiz çıkıyor. Yani kullanıcı bunu fark edemiyor.

## Karar: sync artık hiçbir şey silmez

Otomatik silmenin kendisi kaldırılıyor. Gerekçe:

Bir dosyanın "artık üretilmiyor" olması, onu silmenin güvenli olduğu anlamına gelmiyor.
Silme yolunu güvenli hale getirmek için gereken savunma katmanları — yol containment,
`lstat` ile tür kontrolü, case-insensitive dosya sistemlerinde yeniden adlandırma
çakışması, geçici I/O hatalarının "üretilmedi" sanılması, defterin atomik yazımı — hepsi
tek bir amaca hizmet ediyor: **yanlışlıkla silmemek.** Silmeyi hiç yapmazsak bu amaç
kendiliğinden sağlanıyor ve mekanizma küçülüyor.

Bayat generated dosyanın maliyeti düşük ve görünür: raporlanır, kullanıcı siler.
Yanlış silmenin maliyeti geri dönüşsüz.

Somut olarak elenen riskler (hepsi silme kaynaklıydı):

| Risk | Silme kalkınca |
|---|---|
| Bozuk defter girdisi (`null`, `""`, `"a/../b"`) kısmi silme yapar | Yalnız yanlış rapor |
| `Foo.md` → `foo.md` yeniden adlandırma: yeni dosya yazılır, sonra **aynı fiziksel dosya** silinir | Yok |
| Geçici `EACCES` → `listFiles` boş döner → tüm mirror'lar silinir | Yalnız yanlış rapor |
| Defterdeki yol artık dizin/dangling symlink → `unlink` patlar veya kalıcı orphan | Yok |
| Kesintili defter yazımı sahiplik kaydını kalıcı kaybettirir | Yalnız rapor eksikliği |
| Kötü/hatalı agent adı (`../../x`) repo dışında **silme** yetkisi verir | Silme yetkisi yok |

Son satır önemli: `validate-manifest.mjs` agent adını yalnız "boş olmayan string" diye
doğruluyor, ve `path.join(root, '.claude/agents', '../../../X.md')` repo kökünün dışına
çıkıyor. **Bu bugün canlı bir yazma açığıdır**, bu tasarımın getirdiği değil — ama defter
silme yapsaydı onu bir silme açığına terfi ettirirdi. Yazma tarafındaki containment
sorunu **ayrı bir iş** olarak ele alınacak; bu tasarım onu ne çözer ne kötüleştirir.

## Çözüm: `.agent-source/generated-files.json`

Sync her başarılı çalışmasında ürettiği tüm generated yolları bu deftere yazar:

```json
{
  "files": [
    ".claude/agents/architect.md",
    ".claude/skills/team-skill/SKILL.md",
    "CLAUDE.md"
  ]
}
```

Yollar repo köküne göre, POSIX ayraçlı, **sıralı** (kararlı diff için). Defter kendini
listelemez.

### Rapor kuralı

| Dosya durumu | Davranış |
|---|---|
| Defterde **var**, bu sefer de üretildi | Güncellenir |
| Defterde **var**, bu sefer üretilmedi, diskte duruyor | **`(stale)` olarak raporlanır — silinmez** |
| Defterde **yok** | Hiç ilgilenilmez |

Rapor mevcut `mismatches` kanalını kullanır. Bu kanalın davranışı zaten tanımlı:
`--check` modunda exit 1, normal sync modunda `!` ile uyarı satırı. Yani yeni bir çıktı
mekanizması gerekmiyor.

Mesaj biçimi: `<yol> (stale)`. `generate()` bayat dosya varsa çıktının sonuna tek satırlık
açıklama ekler: bu dosyalar artık üretilmiyor, silmek kullanıcıya kalmıştır.

### Defter okunamıyorsa

Defter yoksa, JSON olarak parse edilemiyorsa, ya da `files` beklenen biçimde değilse:
**hiçbir bayat rapor üretilmez.** Sync normal çalışır ve defteri yeniden yazar. Bozuk
defterin tek sonucu bir turluk eksik rapordur.

Girdi doğrulaması yine de yapılır — bir girdi string değilse ya da boşsa o girdi atlanır,
tüm defter reddedilmez. Silme olmadığı için kısmi/yanlış yorumun bedeli yalnız rapordur.

### `--check` davranışı

`--check` hiçbir şey yazmaz ve hiçbir şey silmez. Bayat dosyaları `(stale)` mismatch'i
olarak raporlar. Defterin kendisi de generated olduğundan, içeriği güncel değilse
defter yolu da normal drift mismatch'i olarak görünür.

`--check` çalıştırması defter dosyasının içeriğini **değiştirmez**.

## Değişecek yerler

| Dosya | Değişiklik |
|---|---|
| `sync-agent-config.mjs` | `removeOrphans` ve `removeFile` kaldırılır; `produced` kümesi, defter okuma/yazma, bayat raporu eklenir |
| `sync-pipeline.md` | §8 yeniden yazılır: temizlik değil, raporlama |
| `canonical-source.md` | Defterin `.agent-source/` içinde generated bir dosya olduğu; kaynak olmadığı |

`manifest-schema.md` değişmez — manifest şeması etkilenmiyor.

## Davranış değişikliği — bilinçli

Bugün kaynağı olmayan bir generated dosya siliniyor. Bundan sonra **hiçbir dosya
silinmiyor**, yalnız raporlanıyor. Bu bilinçli bir gevşetmedir; gerekçesi yukarıdaki
"Karar" bölümündedir.

Mevcut selftest'teki iki orphan senaryosu (elle yaratılan `ghost.toml` / `ghost.md`'nin
silinmesini bekleyen testler) bu yüzden yeniden yazılır: artık **gerçekten üretilmiş**
bir çıktının kaynaktan çıkarılması ve **silinmeyip raporlanması** doğrulanır.

## Doğrulama

`sync-agent-config.mjs --selftest` içine:

1. **Defter tam ve sıralı:** sync sonrası defterin `files` dizisi, üretilen tüm hedeflerin
   **tam ve sıralı** listesine eşittir (üyelik değil, tam eşitlik). Fixture Claude, Codex
   ve OpenCode çıktılarının hepsini kapsar; defter kendini listelemez.
2. **Kullanıcı dosyası korunur:** elle yazılan `.claude/agents/my-helper.md` ve
   `.claude/skills/my-own-skill/SKILL.md` sync sonrası durur, içerikleri değişmez ve
   **rapor edilmez** (defterde olmadıkları için ilgi alanı dışı).
3. **Bayat çıktı raporlanır, silinmez:** üç hedefe birden üreten bir agent manifest'ten ve
   kaynaktan çıkarılır; sync sonrası dört generated dosyası da **diskte durur** ve dördü
   de `(stale)` olarak raporlanır.
4. **Skill mirror'ları raporlanır:** skill kaynağı çıkarılınca üç ekosistem mirror'ı da
   durur ve raporlanır.
5. **Defter yoksa rapor yok:** önce bir çıktı üretilir, kaynağı çıkarılır, defter silinir,
   sync çalıştırılır → bayat rapor üretilmez, dosyalar durur, defter yeniden oluşur.
   *(Bu senaryo, defter silinmeden önce gerçek bir bayat çıktı yaratıldığı için boş
   geçemez.)*
6. **Bozuk defter rapor üretmez:** defter geçersiz JSON ile doldurulur → sync hata vermeden
   çalışır, bayat rapor üretilmez, defter yeniden yazılır.
7. **`--check` yazmaz:** senaryo 3'ün ardından `--check` çalıştırılır → `(stale)` mismatch'i
   döner, defter dosyasının byte'ları değişmez, hiçbir dosya silinmez.
8. **İdempotentlik:** ardışık iki sync → ikincisi sıfır yazma bildirir; hemen ardından
   `--check` yalnız bayat raporunu verir, başka drift vermez.

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Sync hiçbir dosya silmez | Silme yolunu güvenli kılmak için gereken savunma katmanları, silmenin sağladığı faydadan pahalı |
| 2 | Defter `.agent-source/generated-files.json` | Kaynak ağacında, görünür ad, ekosistemden bağımsız |
| 3 | Rapor mevcut `mismatches` kanalından | `--check` exit 1 / sync uyarı davranışı zaten tanımlı |
| 4 | Bozuk defter → rapor yok, hata yok | Silme olmadığı için bedeli yalnız bir turluk eksik rapor |
| 5 | `removeOrphans` ve `removeFile` kaldırılır | Silme yolu tamamen kapanmalı; yarısı kalırsa risk sürer |
| 6 | Yol containment ayrı iş | Bugün canlı bir **yazma** açığı; bu tasarım onu ne çözer ne kötüleştirir |
