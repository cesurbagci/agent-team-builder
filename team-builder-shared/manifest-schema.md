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
| `targetsDefault` | `string[]` | Koşullu | `targets` belirtmeyen agent'lar için hedef ekosistem(ler). `{claude, codex, opencode}` alt kümesi, boş olamaz (örn. `["opencode"]`, `["claude","codex"]`, `["claude","opencode"]`). **Varsayılan YOKTUR** — bir agent'ın ne kendi `targets`'ı ne de `targetsDefault` varsa manifest geçersizdir. |
| `topology` | `string` | Hayır | Claude hedefi için takım topolojisi: `subagent` (hiyerarşik, lead dağıtır — varsayılan) veya `native` (deneysel agent teams, peer-to-peer). Bkz. `topologies.md`. Default: `subagent`. |
| `docLanguage` | `string` | Hayır | Doküman ve cevap dili (örn. `tr`, `en`). Dil & yorum standardını (anayasa preset 4) besler. Default: proje analizinden tahmin (`tr`). |
| `architectureDocs` | `object` | Hayır | Mimari doküman ağacının kökü ve düzeni. Bkz. `architecture-docs.md`. |
| `architectureDocs.root` | `string` | Hayır | Mimari doküman kök dizini. `docs/mimari` veya `docs/architecture`. |
| `architectureDocs.layout` | `string` | Hayır | `central` (tüm kararlar `architectureDocs.root` altında) veya `per-module` (modül başına `modules/<name>/docs/`). |
| `constitution` | `object` | Hayır | 5 cross-cutting anayasa presetinin aç/kapat durumu. İlk dördü default `true`, `planGate` default `false`. Bkz. `constitution.md`. |
| `constitution.noWorkaround` | `boolean` | Hayır | No-workaround disiplini açık mı. Workaround pattern'leri reviewer'da otomatik Kritik. |
| `constitution.codeDocSync` | `boolean` | Hayır | Kod-doküman senkronizasyonu açık mı. `codeDocSync[]` tablosu zorunlu kılınır. |
| `constitution.perAgentMemory` | `boolean` | Hayır | Per-agent memory disiplini açık mı (`.agent-memory/<agent>/MEMORY.md`). |
| `constitution.languageStandard` | `boolean` | Hayır | Dil & yorum standardı açık mı (kod İngilizce / doküman `docLanguage`). |
| `constitution.planGate` | `boolean` | Hayır | Plan kapısı açık mı. **Default `false`** — diğer dört presetin aksine kapalı gelir, çünkü artefakt üretir (`.agent-work/`, `work-plan` skill'i). Açıksa kök `planGate` nesnesi zorunludur. Bkz. `plan-gate.md`. |
| `planGate` | `object` | Koşullu | Kapı sahipleri. **Yalnız `constitution.planGate: true` iken bulunur**; kapalıyken varlığı manifest'i geçersiz kılar. |
| `planGate.planReviewer` | `string \| null` | Evet (nesne varsa) | Planı denetleyen agent'ın adı, ya da `null` (kapı 1 atlanır). Kod yazmayan bir agent olmalı. |
| `planGate.codeReviewer` | `string \| null` | Evet (nesne varsa) | Biten işin kodunu denetleyen agent'ın adı, ya da `null` (kapı 3 yoktur). Kod yazmayan bir agent olmalı. |
| `focus` | `string[]` | Hayır | Projenin kalite odakları (checkbox ile seçilir). Değerler: `performance`, `code-design`, `ui-ux`, `accessibility`, `security`, `testing`. Reviewer denetim eksenlerini + kısıtları besler. Bkz. `quality-dimensions.md`. |
| `routing` | `object[]` | Hayır | Path-based zorunlu routing tablosu. Her satır bir kod yolunu bir role bağlar. Bkz. `routing.md`. |
| `routing[].path` | `string` | Evet (satır içinde) | Glob yolu (örn. `apps/**/main/src/**`). Segment ya düz metin, ya `*` (tek segment), ya `**` (sıfır ya da daha çok segment) olur. Segment içi kısmi joker (`src/*.ts`, `docs/a*`) ve `.`/`..` **kabul edilmez** — routing dizin sahipliği atar, dosya filtresi değil. Ardışık `**` yazılmaz (`docs/**/**`), ve joker içermeyen bir yol (`docs`) o dizinin **alt ağacı** demektir — `docs/**` ile aynıdır; iki yol kısmen çakışırsa en özgül eşleşmenin kazananı olmaz ve manifest reddedilir. |
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
| `name` | `string` | **Evet** | Agent adı. Generated dosya adlarının (`<name>.md`, `<name>.toml`) ve routing/lead referanslarının temeli. **Portatif slug olmalı:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Adlar dosya yollarına doğrudan gömüldüğü için eğik çizgi, ters bölü, boşluk ve kontrol karakteri yasaktır. Tekillik **büyük/küçük harf duyarsız** karşılaştırılır (`Dev` ve `dev` çakışır). |
| `description` | `string` | **Evet** | Agent'ın ne zaman kullanılacağı. Claude frontmatter `description` + Codex TOML + OpenCode frontmatter `description`'ına yansır. **Zorunludur:** Codex açıklaması olmayan bir subagent'ı reddeder, OpenCode ise boş bir anahtar alır. |
| `targets` | `string[]` | Hayır | Hedef ekosistemler: `{claude, codex, opencode}` alt kümesi, boş olamaz. Verilmezse `targetsDefault` uygulanır. `claude` → `.claude/agents/<name>.md`; `codex` → `.codex/agent-definitions/<name>.md` + `.codex/agents/<name>.toml`; `opencode` → `.opencode/agents/<name>.md`. |
| `model` | `string` | Hayır | `claude` hedefli agent'larda model: `opus`, `sonnet`, `haiku`. Codex agent'larında Codex modeli (örn. `gpt-5.5`) da olabilir. |
| `opencode_model` | `string` | Hayır | `opencode` hedefli agent'ın modeli, **`provider/model` formatında** (örn. `anthropic/claude-sonnet-4-5`, `openai/gpt-5`). Verilmezse `model` (opus/sonnet/haiku) Anthropic ID'lerine fallback haritasıyla map'lenir. |
| `model_reasoning_effort` | `string` | Hayır | Reasoning effort: `low`, `medium`, `high`. Codex TOML'una ve (Claude için) effort bilgisine yansır. |
| `sandbox_mode` | `string` | Hayır | Sandbox modu: **yalnız `read-only` ya da `workspace-write`**. Reviewer gibi salt-okunur roller `read-only`; sahiplendiği dizine yazan doc-only roller (architect, doc-writer) `workspace-write`. Codex'in `danger-full-access` değeri **kabul edilmez** — bu alan OpenCode'un `permission.edit` iznini de belirler ve `read-only` dışındaki her değer "yazabilir" demektir; sandbox disiplinini bütünüyle kaldıran bir mod bu araçta üretilmez. |
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

- `agents` boş olamaz; her agent'ta `name` ve `description` zorunlu (`description` boş/boşluk olamaz — iki hedef şeması da ister).
- Her agent'ın bir hedefi olmalı: kendi `targets`'ı ya da kök `targetsDefault`. İkisi de
  yoksa manifest geçersizdir — varsayılan hedef yoktur.
- `targets` verildiyse `{claude, codex, opencode}` alt kümesi olmalı ve boş olmamalı.
- `topology` (verildiyse) `{subagent, native}` içinde olmalı.
- `focus` (verildiyse) dizi olmalı ve değerleri bilinen kalite odakları olmalı
  (`performance`, `code-design`, `ui-ux`, `accessibility`, `security`, `testing`).
- Kap tipleri doğru olmalı: `constitution` ve `planGate` nesne, `routing` ve `codeDocSync`
  dizi, `routing[]`/`codeDocSync[]` öğeleri nesne.
- `model` (verildiyse, claude hedefli agent'ta) `{opus, sonnet, haiku}` içinde olmalı.
- `opencode_model` (verildiyse) `provider/model` formatında string olmalı. `opencode` hedefli bir agent'ta ne `opencode_model` ne `model` yoksa hata verilir (fallback haritası da çalışamaz).
- `model_reasoning_effort` (verildiyse) `{low, medium, high}` içinde olmalı.
- Her `skills[].enforcement` `{mandatory, when-needed}` içinde olmalı.
- `lead` verildiyse bir agent `name`'i olmalı.
- `routing[].path` dolu bir **string** olmalı (generator yolları `typeof === "string"` ile eşler; sayı gibi bir değer doğrulamayı geçip üretimde sessizce düşerdi) ve `routing[].role` dolu olmalı; `routing[].role` bir agent `name`'i olmalı.
- Bir yolun verildiği rol **dosya yazabilmeli** (`sandbox_mode` `read-only` değil; alan yoksa `writesCode`). Routing sahipliktir ve bağlayıcıdır — yazamayan bir rol onu yerine getiremez.
- `routing[].path` **dar dilbilgisine** uymalı: her segment ya düz metin, ya `*`, ya `**`.
  Segment içi kısmi joker (`src/*.ts`, `docs/a*`), `.`/`..`, ardışık `**` ve baştaki/sondaki
  fazladan `/` kabul edilmez. Joker içermeyen bir yol (`docs`) o dizinin alt ağacıdır.
- İki routing yolu **aynı kapsamı** gösteremez — aynı dizgi olmasalar bile (`**/*` ile
  `*/**` aynı kümedir). En özgül eşleşme eşitler arasında seçim yapamaz.
- İki routing yolu **kısmen çakışamaz**: ya biri ötekini kapsar (`docs/**` ⊃
  `docs/guides/**`), ya da tamamen ayrıdır. `a/*/c` ile `a/b/*` ikisi de `a/b/c`'yi ister
  ve hiçbiri ötekini kapsamaz — kesişimde sahip belirsizdir.
- `constitution` alanları (verildiyse) boolean olmalı.
- `writesCode` (verildiyse) boolean olmalı — kapı sahipliği bu alana bakar, falsy bir
  sayı/metin "kod yazmıyor" sayılamaz.
- `sandbox_mode` (verildiyse) `read-only` ya da `workspace-write` olmalı — OpenCode
  `permission.edit` iznini belirlediği için tanınmayan bir değer sessizce yazma izni verir.
- `sandbox_mode: read-only` ise `writesCode` `false` olmalı — yazamayan bir agent kod da
  yazamaz; aksi hâlde plan kapısının "her ekosistemde bir executor" şartını, her hedefin
  düzenlemeyi reddettiği bir agent'la geçerdi.
- `writesCode: false` + `sandbox_mode: workspace-write` olan agent'a routing'de **en az bir
  yol** verilmeli — sahiplik generator'a yalnız routing üzerinden geçtiği için yolu olmayan
  böyle bir role Codex "dosya değiştirme" derken OpenCode yazma izni verir.
- `agents[].name` portatif slug olmalı ve büyük/küçük harf duyarsız biçimde benzersiz olmalı
  — bu ad dosya yolu olarak kullanılır, `../` içeren bir ad hedef dizinin dışına yazardı.
- `agents[].consults` (verildiyse) dizi olmalı ve her değeri tanımlı bir agent adı olmalı;
  generator bu adı talimata birebir yazar, var olmayan bir role sevk anlamsızdır.
- Her `skills[].name` zorunlu.
- Her `codeDocSync[].code` ve `codeDocSync[].doc` dolu string olmalı.
- `constitution.planGate: true` ise kök `planGate` nesnesi zorunlu, `planReviewer` ve
  `codeReviewer` anahtarlarının ikisi de bulunmalı, değerleri agent adı ya da `null` olmalı.
  `false` ya da yoksa kök `planGate` **bulunmamalı**.
- Kapı sahipleri kod yazmayan agent olmalı (`writesCode: false`).
- `planGate` açıkken hedeflenen her ekosistemde en az bir uygun executor bulunmalı.
  Bu kural hedeflenen ekosistemleri **tüm** agent'lardan hesaplar, kapı sahibi dahil;
  yani yalnız bir ekosistemde üretilen bir kapı sahibi o ekosistemde bir executor
  bulunmasını da zorunlu kılar. Kapı sahibinin **executor'ların ekosistemlerini
  kapsaması** artık gerekmiyor — ulaşılamayan sahip harici CLI çağrısıyla çalıştırılır
  (bkz. `plan-gate.md`, *Başka ekosistemdeki kapı sahibi*).

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
    { "path": "modules/*/**", "role": "extension-developer" },
    { "path": "docs/**", "role": "architect" }
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
        "Mimari kararları docs/mimari/ altında topla; ADR/kısıt/tasarım dosyalarını oraya yaz.",
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
