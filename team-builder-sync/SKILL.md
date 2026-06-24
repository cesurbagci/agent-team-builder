---
name: team-builder-sync
description: Bir projedeki agent konfigürasyonunu canonical kaynaktan (.agent-source/) yeniden üretir ve drift kontrolü yapar. Generated dosyalar (CLAUDE.md, AGENTS.md, .claude/agents/*, .codex/*) ile kaynak arasındaki farkı tespit eder. Kullanıcı "takımı senkronla", "agent sync", "drift kontrol", "agent config güncelle" dediğinde tetiklenir.
---

# team-builder-sync

## Genel Bakış

İnce bir sarmalayıcı: `.agent-source/` canonical kaynağından generated agent
dosyalarını **yeniden üretir** (sync) ve/veya **drift** kontrol eder (`--check`).
Gerçek iş `team-builder-shared/sync-agent-config.mjs` generator'ında yapılır; bu
skill onu doğru sırada çağırıp sonucu raporlar.

**Tek doğru kaynak `.agent-source/`'tır.** Generated hedefler (`CLAUDE.md`,
`AGENTS.md`, `.claude/agents/*.md`, `.codex/agents/*.toml`,
`.codex/agent-definitions/*.md`, `.codex/*`) **elle değiştirilmez**. Değişiklik
gerektiğinde `.agent-source/` güncellenir, sonra bu skill ile sync çalıştırılır.

Referans dokümanlar (kurulu yol): `~/.claude/skills/team-builder-shared/` altında
`sync-pipeline.md` (generator davranış sözleşmesi) ve `canonical-source.md`
(kaynak→hedef haritası).

## Ne Zaman Kullanılır

- `.agent-source/` altındaki bir rol md'si, manifest.json veya project/* dosyası
  değiştirildi → generated hedefleri tazelemek için **sync**.
- Generated dosyaların kaynakla uyumlu olup olmadığını (CI/PR öncesi) doğrulamak →
  **drift kontrol** (`--check`).
- Bir generated dosyanın elle düzenlendiğinden şüpheleniliyor → `--check` farkı
  yakalar.

Proje henüz takım kurulu değilse (`.agent-source/` yoksa) bu skill **çalıştırılmaz**;
kullanıcı `team-builder-setup` skill'ine yönlendirilir.

## Adımlar

### 1. Ön kontrol: `.agent-source/` var mı?

Proje kökünde (`<proje>`) `.agent-source/` ve `.agent-source/agents/manifest.json`
var mı bak.

- Yoksa: dur, kullanıcıya bu projede takım kurulu olmadığını söyle ve
  `team-builder-setup`'a yönlendir. Sync çalıştırma.
- Varsa: devam.

### 2. Manifest'i doğrula (generate ÖNCESİ)

Bozuk bir manifest ile generate çalıştırma. Önce
`~/.claude/skills/team-builder-shared/validate-manifest.mjs` ile doğrula.

Bu modül parse edilmiş bir nesne üzerinde çalışır: `validate(doc)` fonksiyonunu
export eder (geçerliyse `true`, değilse hata fırlatır). Tercih edilen yol:
`manifest.json`'ı oku, JSON parse et ve `validate()` çağır. Örnek:

```bash
node --input-type=module -e '
import { validate } from "'"$HOME"'/.claude/skills/team-builder-shared/validate-manifest.mjs";
import { readFileSync } from "node:fs";
const root = process.argv[1];
const doc = JSON.parse(readFileSync(root + "/.agent-source/agents/manifest.json", "utf8"));
validate(doc);
console.log("MANIFEST OK");
' <proje>
```

(`<proje>` yerine projenin mutlak yolunu koy. `$HOME` çözümlenmiyorsa
`~/.claude/...` yerine tam yolu yaz.)

En azından modülün kendi selftest'ini çalıştırıp sağlamlığını teyit et, sonra
manifest'i yukarıdaki gibi elle doğrula:

```bash
node ~/.claude/skills/team-builder-shared/validate-manifest.mjs --selftest
```

Doğrulama hata verirse: **dur**, hatayı kullanıcıya raporla, `.agent-source/` düzelt.
Generate'e geçme.

### 3. Generate (sync)

Manifest geçerliyse generated hedefleri kaynaktan üret:

```bash
node ~/.claude/skills/team-builder-shared/sync-agent-config.mjs --root <proje>
```

Generator idempotenttir: kaynak değişmemişse hiçbir dosya yeniden yazılmaz.
Kaynakta artık karşılığı olmayan generated dosyalar (orphan) temizlenir.
`.claude/settings.local.json` dokunulmaz.

### 4. Drift-free doğrula (`--check`)

Generate'in temiz ve idempotent olduğunu teyit et: hiçbir şey yazmadan farkı
kontrol et. Sync'ten hemen sonra `--check` **temiz** (exit 0) olmalıdır.

```bash
node ~/.claude/skills/team-builder-shared/sync-agent-config.mjs --root <proje> --check
echo "DRIFT EXIT=$?"
```

- Exit 0 → kaynak ile generated senkron. Beklenen durum.
- Exit ≠ 0 → drift var. Generator mismatch yollarını listeler. Bu, ya sync'in
  çalışmadığını ya da bir generated dosyanın elle değiştirildiğini gösterir.

### 5. Raporla

Kullanıcıya kısaca bildir:
- Manifest doğrulama sonucu.
- Hangi hedeflerin üretildiği/güncellendiği (veya hiç değişmediği — idempotent).
- `--check` sonucu (drift-free mi, değilse hangi dosyalar).
- Hatırlatma: **generated dosyaları elle düzenleme; kaynak `.agent-source/`'tur.**

## Sadece Drift Kontrol İstendiğinde

Kullanıcı sadece "drift var mı?" diye soruyorsa (üretim/yazma istemiyorsa) Adım 1-2
sonrası doğrudan Adım 4'teki `--check`'i çalıştır, yazma adımını (Adım 3) atla.

## Sık Hatalar

| Hata | Doğrusu |
|---|---|
| Generated dosyayı (CLAUDE.md, .claude/agents/*) elle düzeltmek | `.agent-source/` kaynağını düzelt, sonra sync çalıştır. Elle değişiklik bir sonraki sync'te ezilir ve `--check`'te drift olur. |
| Manifest doğrulamadan generate etmek | Önce `validate-manifest.mjs`, sonra generate. Bozuk manifest yanlış çıktı üretir. |
| `--root` vermeyi unutmak | `--root <proje>` verilmezse generator cwd'yi kök sayar; yanlış dizine yazabilir. Her zaman projenin mutlak yolunu ver. |
| `--check` exit ≠ 0'ı yok saymak | Drift gerçek bir uyumsuzluktur; mismatch listesindeki dosyaları incele ve kaynaktan tekrar üret. |
