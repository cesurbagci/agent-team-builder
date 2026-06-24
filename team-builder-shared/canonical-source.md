# Canonical Kaynak Mimarisi (`.agent-source/`)

> **Referans dosya.** team-builder v2'nin çıktı mimarisini tarif eder: tek canonical
> kaynak `.agent-source/` → `sync` ile **generate** → `--check` ile **drift** kontrolü.
> Üretimde çalışan bir referans `.agent-source/` kurulumunu model alır.

## Temel İlke

Projede agent konfigürasyonu için **tek bir doğru kaynak (single source of truth)**
vardır: `.agent-source/`. Tüm Claude, Codex ve OpenCode hedef dosyaları (`CLAUDE.md`,
`.claude/agents/*.md`, `.codex/agents/*.toml`, `.opencode/agents/*.md` …) bu kaynaktan
**üretilir**.

**KURAL — Generated dosyalar elle değiştirilmez.** Üretilen hiçbir hedef dosya elle
düzenlenmez. Değişiklik gerektiğinde **`.agent-source/` altındaki kaynak** güncellenir
ve ardından senkronizasyon (sync) çalıştırılır. Generated dosyaya yapılan elle
değişiklik bir sonraki sync'te ezilir ve `--check` modunda **drift** olarak yakalanır.

Her generated md/TOML dosyasının başına şu anlamda bir uyarı header'ı eklenir:
`# This file is generated from .agent-source. Run sync.` — yani dosyayı açan herkes
kaynağın `.agent-source/` olduğunu görür.

## Canonical Dizin Ağacı

```
.agent-source/                      # TEK CANONICAL KAYNAK — generated dosyalar elle değiştirilmez
├── README.md                       # "generated'ı elleme, burayı güncelle + sync çalıştır"
├── agents/
│   ├── <role>.md                   # rol talimatının TAM gövdesi (tool-bağımsız, verbatim kopyalanır)
│   └── manifest.json               # rol metadata: targets[], model, model_reasoning_effort,
│                                   #   sandbox_mode, nickname_candidates[], routing, codeDocSync,
│                                   #   constitution, extra_instructions[]
├── project/
│   ├── CLAUDE.md                   # Claude proje talimatı kaynağı
│   ├── AGENTS.md                   # Codex/OpenCode proje talimatı kaynağı (Codex veya OpenCode hedefi)
│   ├── codex-config.toml           # → .codex/config.toml      (Codex hedefi seçiliyse)
│   ├── codex-team.md               # → .codex/team.md          (Codex hedefi seçiliyse)
│   ├── migration-map.md            # → .codex/migration-map.md (Codex hedefi seçiliyse)
│   ├── opencode.json               # → opencode.json           (OpenCode hedefi seçiliyse)
│   └── opencode-team.md            # → .opencode/team.md       (OpenCode hedefi seçiliyse)
└── skills/<skill>/SKILL.md         # repo skill kaynakları (varsa)
```

`.agent-source/README.md` kullanıcıya net bir not düşer: *generated'ı elleme, burayı
güncelle ve sync çalıştır.*

## Generated Hedefler Haritası (kaynak → hedef)

Senkronizasyon scripti aşağıdaki eşlemeyi uygular. Sağ taraftaki **tüm hedefler
GENERATED'dır**; elle düzenlenmez, kaynaktan üretilir.

| Kaynak (`.agent-source/`) | Generated Hedef(ler) | Koşul |
|---|---|---|
| `agents/<role>.md` | `.claude/agents/<role>.md` | agent `targets` içinde `claude` varsa |
| `agents/<role>.md` | `.codex/agent-definitions/<role>.md` | agent `targets` içinde `codex` varsa (verbatim kopya) |
| `agents/manifest.json` | `.codex/agents/<role>.toml` | `codex` target'lı agent'lar için (metadata + `developer_instructions`) |
| `agents/<role>.md` + manifest | `.opencode/agents/<role>.md` | agent `targets` içinde `opencode` varsa (OpenCode frontmatter + kaynak gövde) |
| `project/CLAUDE.md` | `CLAUDE.md` | her zaman |
| `project/AGENTS.md` | `AGENTS.md` | Codex **veya** OpenCode hedefi seçiliyse |
| `project/codex-config.toml` | `.codex/config.toml` | Codex hedefi seçiliyse |
| `project/codex-team.md` | `.codex/team.md` | Codex hedefi seçiliyse |
| `project/migration-map.md` | `.codex/migration-map.md` | varsa |
| `project/opencode.json` | `opencode.json` | OpenCode hedefi seçiliyse |
| `project/opencode-team.md` | `.opencode/team.md` | OpenCode hedefi seçiliyse |
| `skills/<skill>/SKILL.md` | `.claude/skills/` **ve** `.agents/skills/` (+ OpenCode hedefi varsa `.opencode/skills/`) | varsa |

- `agents/<role>.md`'nin hangi hedeflere gideceği o agent'ın **`targets`** alanına
  bağlıdır: `["claude"]`, `["codex"]` veya `["claude","codex"]`.
- `manifest.json`, Codex target'ı olan her agent için bir `*.toml` üretir; bu TOML
  metadata (`name`, `description`, `model_reasoning_effort`, `sandbox_mode`,
  `nickname_candidates`) ile `developer_instructions` bloğunu içerir.

## Drift & Idempotentlik (özet)

- **`--check`:** Hiçbir şey yazmaz; kaynaktan üretilmesi beklenen içerikle diskteki
  generated dosyaları karşılaştırır. Fark (drift) varsa mismatch listesi basar ve
  exit ≠ 0 döner. Generated dosyanın elle değiştirilmiş olması burada yakalanır.
- **Idempotent:** Kaynak değişmeden sync tekrar çalışınca hiçbir generated dosya
  değişmez (`--check` temiz çıkar).
- Ayrıntılı generate algoritması ve drift davranışı için bkz. `sync-pipeline.md`.

## Memory canonical DEĞİLDİR

Agent memory `.agent-source/`'ın parçası **değildir** ve generate edilmez. Memory,
runtime state kabul edilir.

- Tek canonical memory alanı **repo kökündeki `.agent-memory/<agent>/`** dizinidir.
  Agent'lar memory okuyacak/güncelleyecekse yalnızca bu dizini kullanır.
- `MEMORY.md` her agent dizininde **index** olarak kullanılır; ayrıntılı kalıcı notlar
  aynı agent dizininde ayrı Markdown dosyaları olarak tutulur.
- `.claude/agent-memory/**` ve `.codex/agent-memory/**` generated hedef **değildir**;
  oluşturulmaz ve yeni bilgi için kullanılmaz.

## Canonical olmayan diğer dosyalar

- `.claude/settings.local.json` canonical kaynak değildir. Sync bu dosyayı kopyalamaz,
  Codex altına taşımaz ve `--check` modunda **drift sebebi saymaz** (kullanıcıya özel
  yerel izinler).
