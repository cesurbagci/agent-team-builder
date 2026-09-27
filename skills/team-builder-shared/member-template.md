# Üye Tanımlama Rutini (v2)

> Referans doküman. Bir rol takıma eklenirken izlenen soru-cevap + üretim rutini.
> v1 farkı: çıktı artık `.claude/agents/<role>.md` + CLAUDE.md bloğu değil; **kaynak**
> `.agent-source/agents/<name>.md` (zengin md) + `.agent-source/agents/manifest.json`
> `agents[]` girişidir. Generated dosyalar `sync-agent-config.mjs` ile üretilir.
> İlgili referanslar: `manifest-schema.md`, `agent-md-rich.md`, `skill-recommend.md`,
> `routing.md`, `constitution.md`, `codex-target.md`, `governance-defaults.md`.

Bir rol için "ekleyelim mi?" → EVET ise sırayla:

## Adımlar

1. **Governance varsayılanlarını göster → kabul/değiştir.**
   `governance-defaults.md`'den o rolün varsayılanlarını GÖSTER: `sandbox_mode`,
   `writesCode`, `color`, varsayılan kurallar
   (`rules[]`), `consults` (architect takımdaysa developer için `["architect"]`, **yoksa boş `[]`**). Kullanıcı kabul eder/düzenler. Model ve effort burada **sorulmaz**: bütün roller bittikten sonra `team-builder-models`'in Akış 1'i sorar ve `.agent-source/llm.json`'a yazar.

2. **Hedefleri sor (`targets`).**
   Bu agent hangi ekosistem(ler)de üretilsin: `claude`, `codex`, `opencode` veya bir
   kombinasyonu. Belirtilmezse manifest `targetsDefault` uygulanır. Bkz. `codex-target.md`,
   `opencode-target.md`.

3. **`writesCode` ve `consults`'u teyit et.**
   writesCode=false roller (architect, reviewer) için "Kod yazma" net olacak (agent md'de).
   developer için `consults=[architect]` varsayılan — **architect takımda yoksa `consults=[]`**
   ve belirsizlikte kullanıcıya sorulur; doğrula.

4. **Skill öner + enforcement sor.**
   `skill-recommend.md` ile role + tespit edilen stack'e uygun skill öner. Seçilen her skill
   için `enforcement` sor: `mandatory` (MUTLAKA) | `when-needed` (gerektiğinde).
   Manifest'e `skills: [{ name, enforcement }]` olarak yaz.

5. **Routing path eşlemesi sor (varsa).**
   `routing.md`'ye göre bu role atanan kod yolları var mı? Proje analizinden taslak öner
   (örn. developer → `apps/**/main/src/**`); kullanıcı onaylar/düzenler. **Yol dilbilgisi
   dardır** (`routing.md` → Tablo Mantığı): segment ya düz metin, ya `*`, ya `**`; segment
   içi kısmi joker (`src/*.ts`) ve `.`/`..` kabul edilmez; ardışık `**` de yazılmaz ve joker içermeyen bir yol o dizinin alt ağacı sayılır. Kullanıcının verdiği böyle bir
   yolu **dizine çevir** (`src/**`) ve nedenini söyle — sohbette kabul edip sonda
   doğrulamada patlatma. Onaylanan satırlar
   manifest **kök** `routing[]`'ine `{ path, role: <name> }` olarak eklenir (agent objesine
   değil — routing tablo köktedir).

6. **Manifest'e agent ekle.**
   `manifest.agents[]`'a `manifest-schema.md`'ye uygun obje ekle. Codex metadata dahil:
   `name, description, targets, sandbox_mode, writesCode, color, nickname_candidates,
   skills, consults, rules, extra_instructions`. **`model`, `model_reasoning_effort`,
   `opencode_model` yazma** — eski alanlardır, doğrulayıcı reddeder; model `llm.json`'a gider.

7. **Agent-source md yaz.**
   `.agent-source/agents/<name>.md` dosyasını `agent-md-rich.md` kalıbıyla üret (frontmatter
   + zengin gövde, docLanguage dilinde). Bu md, sync sırasında `.claude/agents/<name>.md`
   olarak ve (codex hedefliyse) `.codex/agent-definitions/<name>.md` verbatim kopyası olarak
   üretilecektir.

> Her üye eklendikten sonra üretim sihirbazın sonunda toplu yapılır: `validate-manifest.mjs`
> ile doğrula → `sync-agent-config.mjs --root <proje>` ile generate → `--check` ile drift
> temiz doğrula. Bkz. `sync-pipeline.md`.

## Çıktı özeti (her üye için)

| Çıktı | Nereye | Kalıp |
|---|---|---|
| Agent metadata | `.agent-source/agents/manifest.json` → `agents[]` girişi | `manifest-schema.md` |
| Routing satırı (varsa) | aynı manifest → kök `routing[]` | `{ path, role }` |
| Zengin rol talimatı | `.agent-source/agents/<name>.md` | `agent-md-rich.md` |

Generated dosyalar (`.claude/agents/*.md`, `.codex/agents/*.toml`,
`.codex/agent-definitions/*.md`, `CLAUDE.md`, `AGENTS.md`) **elle yazılmaz**; kaynak yukarıdaki
`.agent-source/` dosyalarıdır ve `sync-agent-config.mjs` üretir.

## v1 → v2 değişiklik notu

- v1: agent md doğrudan `.claude/agents/<role>.md`, governance CLAUDE.md bloğu, manifest YAML.
- v2: kaynak `.agent-source/` (manifest.json + agents/*.md); md zenginleşti (`agent-md-rich.md`);
  çoklu hedef (`targets`); path-based routing manifest köküne taşındı; üretim generate pipeline'a
  devredildi.
