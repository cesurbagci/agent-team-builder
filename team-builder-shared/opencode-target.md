# OpenCode Hedefi Üretimi

> Referans doküman. Bir agent'ın `targets` alanında `opencode` varsa, `sync-agent-config.mjs`
> generator'ı hangi OpenCode dosyalarını ürettiğini anlatır.
> Üretilen OpenCode dosyaları: `.opencode/agents/*.md`, `.opencode/team.md`, `opencode.json`,
> `.opencode/skills/*`, `AGENTS.md`.

OpenCode ([opencode.ai](https://opencode.ai)) terminal-tabanlı, çoklu-provider bir AI coding
agent'ıdır. Takım yapısı **markdown agent dosyaları** (`.opencode/agents/<name>.md`,
YAML frontmatter + gövde) + `AGENTS.md` proje kuralları + `opencode.json` config ile kurulur.
Aşağıdaki dosyaların **tamamı `.agent-source/agents/manifest.json` + `.agent-source/agents/*.md`
kaynağından üretilir.** Generated dosyalar elle değiştirilmez; kaynak `.agent-source/`'tur.
Drift `--check` ile yakalanır.

OpenCode `AGENTS.md`'yi **native okur** (tıpkı Codex gibi); bu yüzden `AGENTS.md` çıktısı
Codex ile **paylaşılır** — codex **veya** opencode hedefi varsa üretilir.

---

## Hangi dosyalar üretilir (OpenCode hedefi açıkken)

| Üretilen dosya | Kaynak | Sayı |
|---|---|---|
| `AGENTS.md` | `.agent-source/project/AGENTS.md` (dil, routing, code-doc sync, anayasa) | Tek |
| `opencode.json` | `.agent-source/project/opencode.json` (verbatim — JSON header taşımaz) | Tek |
| `.opencode/team.md` | `.agent-source/project/opencode-team.md` + roster | Tek |
| `.opencode/agents/<name>.md` | manifest `agents[]` + `.agent-source/agents/<name>.md` gövdesi | Agent başına |
| `.opencode/skills/<skill>/` | `.agent-source/skills/` mirror | Skill başına |

`targets` içinde `opencode` olmayan bir agent için OpenCode dosyaları üretilmez.

---

## 1. `.opencode/agents/<name>.md` (markdown agent)

Her opencode hedefli agent için OpenCode frontmatter'lı bir markdown üretilir. **Gövde,
tek kaynak `.agent-source/agents/<name>.md`'nin zengin gövdesidir** (Claude frontmatter'ı
çıkarılır, yerine OpenCode frontmatter'ı yazılır; skill yolları `.opencode/skills/`'e
yeniden yazılır). Frontmatter **manifest alanlarından** derlenir:

```yaml
---
description: "<agents[].description>"
mode: <primary|subagent>
model: <provider/model>
permission:
  edit: <allow|deny>
  bash: <allow|ask>
---

<kaynak md'nin zengin gövdesi (skill yolları .opencode/skills/'e yeniden yazılmış)>
```

| Frontmatter alanı | manifest kaynağı | Eşleme |
|---|---|---|
| `description` | `agents[].description` | Agent'ın ne zaman/nasıl kullanılacağı. |
| `mode` | `lead` | `name === lead` → `primary` (Tab ile geçilen ana ajan); diğerleri → `subagent` (`@mention` ile çağrılır). |
| `model` | `agents[].opencode_model` ya da `model` fallback | `provider/model` formatı (`anthropic/claude-...`, `openai/gpt-...`). `opencode_model` yoksa opus/sonnet/haiku → Anthropic ID fallback haritası. |
| `permission.edit` | `writesCode` / `sandbox_mode` | `writesCode:false` ya da `sandbox_mode:read-only` → `deny`; aksi `allow`. |
| `permission.bash` | aynı | salt-okunur roller `ask`; yazan roller `allow`. |

> Claude'a özgü frontmatter alanları (`tools`, `color`, `memory`, Claude `model` etiketi)
> OpenCode frontmatter'ına **yazılmaz**; OpenCode kendi şemasını kullanır. Rol talimatları
> (gövde) iki ekosistemde **tek kaynaktan** tutarlı kalır.

---

## 2. `opencode.json` (team config)

Minimal team config. **JSON olduğu için `#` generated-header taşımaz**; kaynak dosya
(`.agent-source/project/opencode.json`) bir `"//"` notu gömer ve generator **verbatim**
kopyalar. Örnek:

```json
{
  "//": "generated from .agent-source, run sync",
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md", "docs/mimari/**/*.md"],
  "permission": { "edit": "allow", "bash": "ask" }
}
```

- `instructions`: OpenCode'un her oturumda yüklediği kural dosyaları (AGENTS.md + mimari docs).
- `permission`: takım geneli varsayılan (agent md `permission`'ı override eder).

---

## 3. `.opencode/team.md`

`.agent-source/project/opencode-team.md` + manifest roster'ından üretilen takım sözleşmesi.
İçerir:

- OpenCode'da takım yapısının `AGENTS.md` + `.opencode/agents/*.md` + skills ile kurulduğu açıklaması.
- **Çalışma modeli:** `primary` ajan(lar) Tab ile döngülenir; `subagent`'ler `@<name>` ile
  veya otomatik çağrılır.
- **Roster tablosu:** her agent → `.opencode/agents/<name>.md` → sorumluluk.
- **Onay politikası:** destructive komut, yeni production dependency, dış network, sandbox
  dışına yazma, gizli/credential işleminde kullanıcı onayı (`permission` ile pekiştirilir).

---

## 4. `AGENTS.md` (paylaşılan proje kuralları)

Codex ile **aynı dosya**. OpenCode oturum başında okur. İçerik için `codex-target.md` §5'e bak;
codex veya opencode hedefi varsa üretilir.

---

## Özet

OpenCode hedefi seçildiğinde generator (`sync-agent-config.mjs`) tek kaynak `.agent-source/`'tan:
`AGENTS.md` (codex ile paylaşılır) + `opencode.json` + `.opencode/team.md` + her opencode agent
için `.opencode/agents/<name>.md` (OpenCode frontmatter + kaynak md gövdesi) + `.opencode/skills/`
mirror üretir. Hiçbir generated dosya elle düzenlenmez; değişiklik kaynakta yapılır, sonra
sync + drift-check.
