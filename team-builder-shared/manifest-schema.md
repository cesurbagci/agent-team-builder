# manifest.json Şeması (v2)

> Referans doküman. `.agent-source/agents/manifest.json` dosyasının v2 şemasını tanımlar.
> Çekirdek alan adları üretimde çalışan bir referans kurulumla uyumludur (`targets`, `model`, `model_reasoning_effort`,
> `sandbox_mode`, `nickname_candidates`, `extra_instructions`) + v2 eklemeleri
> (`routing`, `codeDocSync`, `constitution`, `skills[{name,enforcement}]`,
> `docLanguage`, `architectureDocs`, `lead`).

`manifest.json`, agent takımının **tek metadata kaynağıdır**. `validate-manifest.mjs`
ile doğrulanır, `sync-agent-config.mjs` ile generated hedeflere (`.claude/agents/*.md`,
`.codex/agents/*.toml`, `.codex/agent-definitions/*.md`, `.opencode/agents/*.md`,
`CLAUDE.md`, `AGENTS.md`, `opencode.json`) çevrilir.
Generated dosyalar **elle değiştirilmez**; kaynak burasıdır.

---

## Kök alanlar

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `targetsDefault` | `string[]` | Hayır | `targets` belirtmeyen agent'lar için varsayılan hedef ekosistem. `{claude, codex, opencode}` alt kümesi (örn. `["claude"]`, `["claude","codex"]`, `["claude","opencode"]`). Default: `["claude"]`. |
| `topology` | `string` | Hayır | Claude hedefi için takım topolojisi: `subagent` (hiyerarşik, lead dağıtır — varsayılan) veya `native` (deneysel agent teams, peer-to-peer). Bkz. `topologies.md`. Default: `subagent`. |
| `docLanguage` | `string` | Hayır | Doküman ve cevap dili (örn. `tr`, `en`). Dil & yorum standardını (anayasa preset 4) besler. Default: proje analizinden tahmin (`tr`). |
| `architectureDocs` | `object` | Hayır | Mimari doküman ağacının kökü ve düzeni. Bkz. `architecture-docs.md`. |
| `architectureDocs.root` | `string` | Hayır | Mimari doküman kök dizini. `docs/mimari` veya `docs/architecture`. |
| `architectureDocs.layout` | `string` | Hayır | `central` (tüm kararlar `architectureDocs.root` altında) veya `per-module` (modül başına `modules/<name>/docs/`). |
| `constitution` | `object` | Hayır | 4 cross-cutting anayasa presetinin aç/kapat durumu. Tümü default `true`. Bkz. `constitution.md`. |
| `constitution.noWorkaround` | `boolean` | Hayır | No-workaround disiplini açık mı. Workaround pattern'leri reviewer'da otomatik Kritik. |
| `constitution.codeDocSync` | `boolean` | Hayır | Kod-doküman senkronizasyonu açık mı. `codeDocSync[]` tablosu zorunlu kılınır. |
| `constitution.perAgentMemory` | `boolean` | Hayır | Per-agent memory disiplini açık mı (`.agent-memory/<agent>/MEMORY.md`). |
| `constitution.languageStandard` | `boolean` | Hayır | Dil & yorum standardı açık mı (kod İngilizce / doküman `docLanguage`). |
| `focus` | `string[]` | Hayır | Projenin kalite odakları (checkbox ile seçilir). Değerler: `performance`, `code-design`, `ui-ux`, `accessibility`, `security`, `testing`. Reviewer denetim eksenlerini + kısıtları besler. Bkz. `quality-dimensions.md`. |
| `routing` | `object[]` | Hayır | Path-based zorunlu routing tablosu. Her satır bir kod yolunu bir role bağlar. Bkz. `routing.md`. |
| `routing[].path` | `string` | Evet (satır içinde) | Glob yolu (örn. `apps/**/main/src/**`). |
| `routing[].role` | `string` | Evet (satır içinde) | Bu yola atanan agent `name`'i. `agents[]` içinde var olmalı. |
| `codeDocSync` | `object[]` | Hayır | Kod konumu → beklenen doküman eşlemesi. Eksikse reviewer Kritik. |
| `codeDocSync[].code` | `string` | Evet (satır içinde) | Kod glob'u (örn. `packages/plugin-sdk/**`). |
| `codeDocSync[].doc` | `string` | Evet (satır içinde) | Beklenen doküman yolu. |
| `lead` | `string` | Hayır | Takım lideri agent `name`'i (genelde `architect`). Verildiyse `agents[]` içinde bulunmalı. |
| `agents` | `object[]` | **Evet** | Agent tanımları. Boş olamaz. |

---

## `agents[]` öğesi

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `name` | `string` | **Evet** | Agent adı. Generated dosya adlarının (`<name>.md`, `<name>.toml`) ve routing/lead referanslarının temeli. |
| `description` | `string` | Hayır (önerilir) | Agent'ın ne zaman kullanılacağı. Claude frontmatter `description` + Codex TOML `description`'ına yansır. |
| `targets` | `string[]` | Hayır | Hedef ekosistemler: `{claude, codex, opencode}` alt kümesi, boş olamaz. Verilmezse `targetsDefault` uygulanır. `claude` → `.claude/agents/<name>.md`; `codex` → `.codex/agent-definitions/<name>.md` + `.codex/agents/<name>.toml`; `opencode` → `.opencode/agents/<name>.md`. |
| `model` | `string` | Hayır | `claude` hedefli agent'larda model: `opus`, `sonnet`, `haiku`. Codex agent'larında Codex modeli (örn. `gpt-5.5`) da olabilir. |
| `opencode_model` | `string` | Hayır | `opencode` hedefli agent'ın modeli, **`provider/model` formatında** (örn. `anthropic/claude-sonnet-4-5`, `openai/gpt-5`). Verilmezse `model` (opus/sonnet/haiku) Anthropic ID'lerine fallback haritasıyla map'lenir. |
| `model_reasoning_effort` | `string` | Hayır | Reasoning effort: `low`, `medium`, `high`. Codex TOML'una ve (Claude için) effort bilgisine yansır. |
| `sandbox_mode` | `string` | Hayır | Codex sandbox modu: `read-only`, `workspace-write`, `danger-full-access`. Reviewer gibi salt-okunur roller `read-only`. |
| `writesCode` | `boolean` | Hayır | Agent kod yazar mı. `false` → agent md'de "Kod yazma" net kuralı (architect, reviewer). Default: `true`. |
| `color` | `string` | Hayır | Claude frontmatter rengi (örn. `purple`, `blue`). |
| `nickname_candidates` | `string[]` | Hayır | Kullanıcı dostu takma ad önerileri (örn. `["Architect","ADR Lead"]`). |
| `skills` | `object[]` | Hayır | Bu agent'a bağlı skill'ler ve zorunluluk seviyesi. |
| `skills[].name` | `string` | Evet (satır içinde) | Skill adı (örn. `frontend-design`). |
| `skills[].enforcement` | `string` | Evet (satır içinde) | `mandatory` (MUTLAKA oku/uygula) veya `when-needed` (gerektiğinde). |
| `consults` | `string[]` | Hayır | Bu agent'ın danışması gereken diğer agent `name`'leri (örn. developer → `["architect"]`). |
| `rules` | `string[]` | Hayır | Agent md gövdesine işlenen kısa kural cümleleri. |
| `extra_instructions` | `string[]` | Hayır | Codex `developer_instructions` + agent md'ye eklenen ek serbest talimatlar (memory, domain sınırı, mimari sevk vb.). |

### Doğrulama kuralları (validate-manifest.mjs ile birebir)

- `agents` boş olamaz; her agent'ta `name` zorunlu.
- `targets` verildiyse `{claude, codex, opencode}` alt kümesi olmalı ve boş olmamalı.
- `model` (verildiyse, claude hedefli agent'ta) `{opus, sonnet, haiku}` içinde olmalı.
- `opencode_model` (verildiyse) `provider/model` formatında string olmalı. `opencode` hedefli bir agent'ta ne `opencode_model` ne `model` yoksa hata verilir (fallback haritası da çalışamaz).
- `model_reasoning_effort` (verildiyse) `{low, medium, high}` içinde olmalı.
- Her `skills[].enforcement` `{mandatory, when-needed}` içinde olmalı.
- `lead` verildiyse bir agent `name`'i olmalı.
- `routing[].path` ve `routing[].role` dolu olmalı; `routing[].role` bir agent `name`'i olmalı.
- `constitution` alanları (verildiyse) boolean olmalı.

---

## Tam örnek manifest

```jsonc
{
  "targetsDefault": ["claude", "codex", "opencode"],
  "docLanguage": "tr",
  "architectureDocs": { "root": "docs/mimari", "layout": "central" },
  "constitution": {
    "noWorkaround": true,
    "codeDocSync": true,
    "perAgentMemory": true,
    "languageStandard": true
  },
  "routing": [
    { "path": "apps/**/main/src/**", "role": "backend-developer" },
    { "path": "apps/**/renderer/src/**", "role": "frontend-developer" },
    { "path": "modules/*/**", "role": "extension-developer" }
  ],
  "codeDocSync": [
    { "code": "packages/plugin-sdk/**", "doc": "docs/mimari/extension/extension-contract.md" },
    { "code": "apps/**/main/src/ipc/**", "doc": "docs/mimari/backend/ipc-registry.md" }
  ],
  "lead": "architect",
  "agents": [
    {
      "name": "architect",
      "targets": ["claude", "codex", "opencode"],
      "description": "Mimari kararlar, ADR'lar, API kontratı ve standart belirsizlikleri için kullanılır. Production kod yazmaz; docs/mimari altında kalıcı karar üretir.",
      "model": "opus",
      "opencode_model": "anthropic/claude-opus-4",
      "model_reasoning_effort": "high",
      "sandbox_mode": "workspace-write",
      "writesCode": false,
      "color": "purple",
      "nickname_candidates": ["Architect", "ADR Lead", "System Steward"],
      "skills": [
        { "name": "architecture-advisor", "enforcement": "when-needed" }
      ],
      "consults": [],
      "rules": ["Kod yazma; ADR/kısıt/tasarım üret."],
      "extra_instructions": [
        "Production kod yazma. Yazma alanı yalnız docs/mimari/ altıdır.",
        "Kod tabanını birincil kaynak olarak oku; dokümanları kod kontratlarının tamamlayıcısı olarak güncelle.",
        "Mimari karar gerekiyorsa gerekçeyi ve sonucunu kalıcı ADR olarak bırak."
      ]
    },
    {
      "name": "backend-developer",
      "targets": ["claude", "codex"],
      "description": "Main process, IPC handler, native entegrasyon ve backend paket değişiklikleri için kullanılır.",
      "model": "sonnet",
      "model_reasoning_effort": "high",
      "sandbox_mode": "workspace-write",
      "writesCode": true,
      "color": "blue",
      "nickname_candidates": ["Backend Dev", "Main Process"],
      "skills": [
        { "name": "backend-patterns", "enforcement": "mandatory" }
      ],
      "consults": ["architect"],
      "rules": ["Sadece kendi domain'inde kod yaz; docs/mimari altına yazma."],
      "extra_instructions": [
        "Backend memory index'ini de oku: .agent-memory/backend-developer/MEMORY.md",
        "Mimari karar, yeni IPC/API yüzeyi veya breaking change varsa implementasyonu durdurup architect'e sevk et."
      ]
    },
    {
      "name": "frontend-developer",
      "targets": ["claude", "codex"],
      "description": "Renderer React kodu, UI, navigation, state ve design system uygulaması için kullanılır.",
      "model": "sonnet",
      "model_reasoning_effort": "high",
      "sandbox_mode": "workspace-write",
      "writesCode": true,
      "color": "green",
      "nickname_candidates": ["Frontend Dev", "Renderer Dev", "UI Kit Dev"],
      "skills": [
        { "name": "frontend-design", "enforcement": "mandatory" },
        { "name": "frontend-patterns", "enforcement": "when-needed" }
      ],
      "consults": ["architect"],
      "rules": ["Sadece kendi domain'inde kod yaz; main/preload veya docs/mimari altına yazma."],
      "extra_instructions": [
        "UI veya React component işlerinde repo skill'lerini oku: .agents/skills/frontend-design/SKILL.md",
        "Yeni design token, UI library veya state pattern değişikliği gerekiyorsa mimari karara sevk et."
      ]
    },
    {
      "name": "reviewer",
      "targets": ["claude", "codex"],
      "description": "Kod değişikliği sonrası read-only review yapar; mimari ihlal, workaround, doküman senkronizasyonu, güvenlik ve test kalitesi bulgularını raporlar.",
      "model": "opus",
      "model_reasoning_effort": "high",
      "sandbox_mode": "read-only",
      "writesCode": false,
      "color": "red",
      "nickname_candidates": ["Reviewer", "Quality Gate", "Risk Finder"],
      "skills": [],
      "consults": [],
      "rules": ["Kod yazma ve dosya değiştirme."],
      "extra_instructions": [
        "git diff, git status ve ilgili mimari dokümanları okuyarak bulgu raporu üret.",
        "Workaround ve kod-doc senkronizasyon eksiğini otomatik Kritik say.",
        "Bulguları Kritik, Uyarı ve Öneri olarak grupla; önce gerçek riskleri yaz."
      ]
    }
  ]
}
```
