# Tasarım: Generated Dosya Defteri

- **Tarih:** 2026-08-03
- **Durum:** Onay bekliyor
- **Kapsam:** `sync-agent-config.mjs`'in dizin+uzantı tabanlı orphan temizliğini, ürettiği dosyaların defterine dayanan temizlikle değiştirmek

## Problem

`sync` bugün kullanıcının elle yazdığı agent dosyalarını **siliyor**. Doğrulandı:

```
$ node team-builder-shared/sync-agent-config.mjs --root <proje>
Synchronized agent configuration:
- .claude/agents/my-helper.md (removed)
```

Sebep: `removeOrphans(dirPath, expectedFileNames, allowedExtensions)` bir dizindeki
**beklenen ad listesinde olmayan her dosyayı** siler. Beklenen liste manifest'ten türer.
Kullanıcının elle eklediği bir agent manifest'te olmadığı için orphan sayılır ve silinir.

Etkilenen dizinler: `.claude/agents/`, `.codex/agent-definitions/`, `.codex/agents/`,
`.opencode/agents/`.

Skill dizinleri (`.claude/skills/`, `.agents/skills/`, `.opencode/skills/`) şu an **güvenli**
çünkü `syncSkills` hiç temizlik yapmıyor. Ama bunun bedeli var: kaynaktan bir skill
çıkarılınca generated mirror'lar ortada kalıyor ve `--check` temiz çıkıyor.

Yani iki uçta iki ayrı hata var: agent tarafında **fazla siliyor**, skill tarafında
**hiç silmiyor**.

## Neden dizin+uzantı yaklaşımı düzeltilemez

"Bu dosyayı kim yazdı" sorusunu dizin ve uzantıdan cevaplamak mümkün değil.
`.claude/agents/` hem generated hem kullanıcı dosyalarının meşru olarak bulunabileceği
bir dizin. Generated header eklemek de çözüm değil: agent md'leri YAML frontmatter ile
başlamak zorunda, önlerine `#` satırı konamaz.

Bilgiyi tutmanın tek güvenilir yolu, sync'in **ne ürettiğini kendisinin kaydetmesidir.**

## Çözüm: `.agent-source/generated-files.json`

Sync her başarılı çalışmasında ürettiği tüm generated yolları bu deftere yazar:

```json
{
  "files": [
    "CLAUDE.md",
    ".claude/agents/architect.md",
    ".claude/skills/team-skill/SKILL.md",
    ".agents/skills/team-skill/SKILL.md"
  ]
}
```

Yollar repo köküne göre POSIX ayraçlıdır (mevcut `toPosix` ile aynı biçim).

### Temizlik kuralı

| Dosya durumu | Davranış |
|---|---|
| Defterde **var**, bu sefer de üretildi | Güncellenir |
| Defterde **var**, bu sefer üretilmedi | **Gerçek orphan → silinir** |
| Defterde **yok** | **Kullanıcının → dokunulmaz** |

Bu kural her iki hatayı da kapatır: elle yazılan agent defterde olmadığı için korunur;
kaynaktan çıkarılan skill defterde olduğu için mirror'ları temizlenir.

### Geçiş güvenliği

**Defter yoksa hiçbir şey silinmez** — sync yalnız defteri oluşturur. Böylece bu değişiklik
mevcut hiçbir projede ani silme yapmaz. İlk çalıştırmadan sonra normal kural işler.

Bunun kabul edilen bedeli: defter oluşturulmadan önce ortada kalmış gerçek orphan'lar bir
kez korunur. Kullanıcı onları elle siler ya da sonraki sync'te defter dolduktan sonra
kaynaktan çıkarma tekrar denenir.

### Boş dizin temizliği

Skill'ler dizin altında yaşar (`.claude/skills/<ad>/SKILL.md`). Defterdeki son dosya
silindiğinde geride boş dizin kalır; silme sonrası boşalan dizinler de kaldırılır.
Yalnız **boş** dizinler kaldırılır — içinde kullanıcının dosyası varsa dizin durur.

### `--check` davranışı

Mevcut sözleşme korunur: `--check` hiçbir şey silmez, silinmesi gereken her dosyayı
`<yol> (orphan)` biçiminde mismatch olarak raporlar. Defterin kendisi de generated
olduğu için içeriği güncel değilse drift sayılır.

## Değişecek yerler

| Dosya | Değişiklik |
|---|---|
| `sync-agent-config.mjs` | `removeOrphans` kaldırılır; defter okuma/yazma + defter tabanlı temizlik gelir |
| `sync-pipeline.md` | §8 orphan cleanup sözleşmesi yeniden yazılır |
| `canonical-source.md` | Defterin `.agent-source/` içinde generated bir dosya olduğu, elle düzenlenmediği |
| `manifest-schema.md` | Değişiklik yok (manifest şeması etkilenmiyor) |

## Davranış değişikliği — bilinçli

Bugün `.codex/agents/ghost.toml` gibi kaynağı olmayan bir dosya siliniyor. Yeni kuralda
**defterde yoksa silinmiyor.** Bu bilinçli bir gevşetmedir: bir dosyanın kaynağı olmaması,
onu sync'in yazdığı anlamına gelmez. Yanlış silmek, fazladan dosya bırakmaktan daha
pahalıdır.

Mevcut selftest'teki orphan senaryoları buna göre güncellenir: ghost dosyası elle
yaratılıp silinmesi beklenmek yerine, **önce sync tarafından üretilip** sonra kaynaktan
çıkarılarak gerçek orphan haline getirilir.

## Doğrulama

`sync-agent-config.mjs --selftest` içine:

1. **Kullanıcı dosyası korunur:** `.claude/agents/my-helper.md` elle yazılır, sync sonrası
   **durur**; içeriği değişmez.
2. **Gerçek orphan silinir:** manifest'te iki agent varken sync çalışır (defter dolar),
   sonra bir agent manifest ve kaynaktan çıkarılır, sync tekrar çalışır → o agent'ın
   generated dosyaları silinir.
3. **Skill kaynağı çıkarılınca mirror'lar temizlenir:** üç ekosistem dizininde de silinir,
   geride boş dizin kalmaz.
4. **Defter yokken silme olmaz:** defter dosyası silinip sync çalıştırılır → hiçbir dosya
   silinmez, defter yeniden oluşur.
5. **`--check` orphan'ı raporlar, silmez:** senaryo 2'nin ikinci sync'i `--check` ile
   çalıştırılır → `(orphan)` mismatch'i döner, dosya diskte durur.
6. **Kullanıcı skill'i korunur:** `.claude/skills/my-own-skill/` elle yazılır, sync sonrası
   durur.

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Defter `.agent-source/generated-files.json` | Kaynak ağacında, görünür ad; ekosistemden bağımsız |
| 2 | Defterde olmayan dosyaya dokunulmaz | "Kim yazdı" sorusunun tek güvenilir cevabı |
| 3 | Defter yoksa silme yok | Mevcut projelerde ani veri kaybı olmasın |
| 4 | `removeOrphans` tamamen kaldırılır | Defterle birlikte çalışırsa yine kullanıcı dosyası siler |
| 5 | Boş kalan dizinler kaldırılır | Skill mirror'ları dizin altında yaşıyor |
| 6 | Kaynaksız dosya artık orphan sayılmaz | Yanlış silmek, fazladan dosya bırakmaktan pahalı |
