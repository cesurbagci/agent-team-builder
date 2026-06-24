# Codex Hedefi Üretimi

> Referans doküman. Bir agent'ın `targets` alanında `codex` varsa, `sync-agent-config.mjs`
> generator'ı hangi Codex dosyalarını ürettiğini anlatır.
> Üretilen Codex dosyaları: `.codex/agents/*.toml`, `.codex/agent-definitions/*.md`,
> `.codex/config.toml`, `.codex/team.md`, `AGENTS.md`.

Codex bir agent **primitive**'i sunmaz; takım yapısı `AGENTS.md` politikası +
`.codex/agents/*.toml` custom agent tanımları + `.codex/agent-definitions/*.md` rol
talimatları + `.codex/config.toml` + `.codex/team.md` ile kurulur. Aşağıdaki dosyaların
**tamamı `.agent-source/agents/manifest.json` + `.agent-source/agents/*.md` kaynağından
`sync-agent-config.mjs` generator'ı tarafından üretilir.** Generated
dosyalar elle değiştirilmez; kaynak `.agent-source/`'tur. Drift `--check` ile yakalanır.

---

## Hangi dosyalar üretilir (Codex hedefi açıkken)

| Üretilen dosya | Kaynak | Sayı |
|---|---|---|
| `AGENTS.md` | `.agent-source/project/*` (dil, routing, code-doc sync, anayasa) | Tek |
| `.codex/config.toml` | manifest (sandbox + multi-agent) | Tek |
| `.codex/team.md` | `.agent-source/project/codex-team.md` + roster | Tek |
| `.codex/agents/<name>.toml` | manifest `agents[]` (codex hedefli her agent) | Agent başına |
| `.codex/agent-definitions/<name>.md` | `.agent-source/agents/<name>.md` (verbatim) | Agent başına |

`targets` içinde `codex` olmayan bir agent için Codex dosyaları üretilmez.

---

## 1. `.codex/agents/<name>.toml` (custom agent metadata)

Her codex hedefli agent için bir TOML üretilir. Üst satıra "bu dosya `.agent-source`'tan
üretildi, `sync:agents` çalıştır" notu eklenir.

| TOML alanı | manifest kaynağı | Not |
|---|---|---|
| `name` | `agents[].name` | Agent adı. |
| `description` | `agents[].description` | Ne zaman kullanılacağı. |
| `model_reasoning_effort` | `agents[].model_reasoning_effort` | `low\|medium\|high`. |
| `sandbox_mode` | `agents[].sandbox_mode` | `read-only\|workspace-write\|danger-full-access`. Reviewer gibi salt-okunur roller `read-only`. |
| `nickname_candidates` | `agents[].nickname_candidates` | Kullanıcı dostu takma adlar. |
| `developer_instructions` | manifest + project'ten **derlenir** | Çok satırlı `"""..."""` blok. Aşağıdaki template. |

> Claude'a özgü frontmatter alanları (`tools`, `model`, `memory`, `color`) Codex TOML'una
> **yazılmaz**. Codex tarafı bunları konfigürasyon olarak yorumlamaz.

### `developer_instructions` template'i

`sync-agent-config.mjs` bu bloğu manifest alanlarından derler. İçeriği (docLanguage dilinde):

```
Sen <proje adı> projesinin Codex custom agent'i `<name>` rolüsün.

İlk iş olarak `AGENTS.md` dosyasını ve `.codex/agent-definitions/<name>.md`
dosyasını oku. `.codex/agent-definitions/<name>.md` içindeki rol talimatları
bağlayıcıdır; Claude'a özgü frontmatter metadata alanlarını (`tools`, `model`,
`memory`, `color`) Codex konfigürasyonu olarak yorumlama.

<writesCode=false ise:>  - Production kod yazma. Yazma alanı prensip olarak <arch-root>/ altıdır.
<writesCode=true ise:>   - Sadece kendi domain'inde kod yaz; <arch-root>/ altına yazma.
- Kod tabanını birincil kaynak olarak oku; dokümanları kod kontratlarının tamamlayıcısı olarak güncelle.
<extra_instructions[] satırları buraya eklenir.>

Agent memory gerekiyorsa `.agent-memory/<name>/MEMORY.md` dosyasını oku. Kalıcı
memory notu gerekiyorsa sadece `.agent-memory/<name>/` altına yaz; `.claude/agent-memory/`
ve `.codex/agent-memory/` altına yazma.

Kullanıcıya <docLanguage> cevap ver. Kod, dosya ve commit isimleri İngilizce kalır.
Shell komutlarında mümkünse `rtk` kullan.
```

Notlar:
- `writesCode`, `arch-root`, `extra_instructions[]`, `docLanguage` manifest'ten gelir.
- `consults[]` varsa "Belirsizlik/mimari karar çıkarsa `<consult>` rolüne sevk et" satırı eklenir.
- Memory satırı **anayasa preset 3 (perAgentMemory)** açıksa eklenir.
- Dil/rtk satırı **anayasa preset 4 (languageStandard)** açıksa eklenir.

---

## 2. `.codex/agent-definitions/<name>.md` (verbatim kopya mantığı)

Codex'in tam rol talimatı buradadır. **Mantık: `.agent-source/agents/<name>.md`
(agent-md-rich.md kalıbındaki zengin gövde) birebir (verbatim) kopyalanır.** Frontmatter
dahil aynen taşınır — Codex tarafı Claude'a özgü frontmatter'ı yok sayar (TOML'daki
`developer_instructions` bunu açıkça söyler). Yani:

- Claude hedefi → `.claude/agents/<name>.md` = kaynak md (frontmatter + gövde).
- Codex hedefi → `.codex/agent-definitions/<name>.md` = **aynı kaynak md'nin verbatim kopyası**.
- TOML (`developer_instructions`) bu definition dosyasını okumayı zorunlu kılar.

Bu sayede rol talimatları iki ekosistemde **tek kaynaktan** tutarlı kalır; ayrıntılı
talimat kaybolmaz, sadece giriş noktası (TOML vs frontmatter) değişir.

---

## 3. `.codex/config.toml`

manifest'ten üretilen tekil dosya. Örnek içerik:

```toml
sandbox_mode = "workspace-write"
[agents]
max_threads = 6
max_depth = 1
[features]
multi_agent = true
```

- `sandbox_mode`: takım geneli varsayılan (agent başına TOML override eder).
- `[agents].max_threads` / `max_depth`: sub-agent eşzamanlılık sınırı.
- `[features].multi_agent = true`: custom agent / sub-agent workflow'unu açar.

---

## 4. `.codex/team.md`

`.agent-source/project/codex-team.md` + manifest roster'ından üretilen takım sözleşmesi.
İçerir:

- Codex'te ayrı "team" primitive olmadığı, yapının `AGENTS.md` + `.codex/agents/*.toml` +
  agent-definitions + memory ile kurulduğu açıklaması.
- **Çalışma modları:** (1) sub-agent workflow (runtime izin veriyorsa custom agent spawn),
  (2) role emulation (sub-agent yoksa ana ajan `.codex/agent-definitions/*.md` okuyup o rol
  gibi çalışır). Claude MCP üzerinden delege edilen işlerde sub-agent kapalı kabul edilir.
- **Roster tablosu:** her agent → `.codex/agents/<name>.toml` → sorumluluk.
- **Onay politikası:** destructive komut, yeni production dependency, dış network, sandbox
  dışına yazma, gizli/credential işleminde kullanıcı onayı.
- Kaynaklar: `AGENTS.md`, `.codex/agent-definitions/`, `.agent-memory/`, repo skill'leri.

---

## 5. `AGENTS.md` (Codex root talimatı)

Claude tarafındaki `CLAUDE.md`'nin Codex karşılığı; `.agent-source/project/*`'tan üretilir.
İçerir (anayasa presetlerine ve manifest'e göre):

- **Temel kural + dil:** kullanıcıya `docLanguage`, kod/dosya/commit İngilizce, yorum
  `docLanguage` metin + İngilizce tag, shell'de `rtk`, aramada `rg`.
- **Senkronizasyon disiplini:** generated dosya listesi + "elle değiştirme, `.agent-source/`
  güncelle → `sync:agents` → `check:agents` drift".
- **Agent memory disiplini:** tek canonical alan `.agent-memory/`.
- **Codex team politikası:** sub-agent / role emulation; hangi iş hangi
  `.codex/agent-definitions/<name>.md` okunur.
- **Zorunlu Routing tablosu:** `routing[]` → `<yol> → <rol>`; "tabloyu bypass = mimari ihlal".
- **Kod-Doküman Senkronizasyonu tablosu:** `codeDocSync[]` → `<kod> → <doküman>`.
- **Mimari kaynaklar + test/doğrulama** komutları.

`AGENTS.md`'deki agent'ın kendi rolü (root talimatın hangi agent gözünden yazıldığı) ana
Codex ajanının orkestratör rolüdür; ayrıntılı rol talimatları agent-definitions'tadır.

---

## Özet

Codex hedefi seçildiğinde generator (`sync-agent-config.mjs`) tek kaynak `.agent-source/`'tan:
`AGENTS.md` + `.codex/config.toml` + `.codex/team.md` + her codex agent için
`.codex/agents/<name>.toml` (TOML metadata + derlenen `developer_instructions`) +
`.codex/agent-definitions/<name>.md` (kaynak md'nin verbatim kopyası) üretir. Hiçbir
generated dosya elle düzenlenmez; değişiklik kaynakta yapılır, sonra sync + drift-check.
