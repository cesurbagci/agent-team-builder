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
├── generated-files.json            # sync defteri (GENERATED — ağaçtaki tek generated dosya; git'e girmez)
├── llm.json                        # model + effort, ekosistem başına (commit edilir) — llm-config.md
├── llm.local.json                  # bu makinenin farkları (git'e girmez; ortak dosyayı ezer)
├── agents/
│   ├── <role>.md                   # rol talimatının TAM gövdesi (tool-bağımsız; model/effort TAŞIMAZ)
│   └── manifest.json               # rol metadata: targets[], sandbox_mode, nickname_candidates[],
│                                   #   routing, codeDocSync, constitution, extra_instructions[]
├── project/
│   ├── instructions.md             # ORTAK talimat kaynağı — kopyalanmaz, hedefler referans verir
│   ├── CLAUDE.md                   # Claude'a özgü + instructions.md referansı
│   ├── AGENTS.md                   # Codex/OpenCode'a özgü + instructions.md referansı
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
| `agents/<role>.md` + `llm.json` | `.claude/agents/<role>.md` (git'e girmez) | agent `targets` içinde `claude` varsa; frontmatter'a çözümlenmiş `model`/`effort` eklenir |
| `agents/<role>.md` | `.codex/agent-definitions/<role>.md` | agent `targets` içinde `codex` varsa (verbatim kopya) |
| `agents/manifest.json` + `llm.json` | `.codex/agents/<role>.toml` (git'e girmez) | `codex` target'lı agent'lar için (metadata + `developer_instructions` + çözümlenmiş model/effort) |
| `agents/<role>.md` + manifest + `llm.json` | `.opencode/agents/<role>.md` (git'e girmez) | agent `targets` içinde `opencode` varsa (OpenCode frontmatter + kaynak gövde) |
| `project/instructions.md` | *(kopyalanmaz — hedefler referans verir)* | Her zaman |
| `llm.json` + `llm.local.json` | *(kopyalanmaz — ajan dosyalarına çözümlenir)* | Her zaman (ikisi de isteğe bağlı) |
| *(kaynak yok — sync'in yönettiği blok)* | `.gitignore` içindeki işaretli blok | Her zaman — git'e girmeyen çıktının dosya dosya listesi |
| `project/CLAUDE.md` | `CLAUDE.md` | Claude hedefi seçiliyse |
| `project/AGENTS.md` | `AGENTS.md` | Codex **veya** OpenCode hedefi seçiliyse |
| `project/codex-config.toml` | `.codex/config.toml` | Codex hedefi seçiliyse |
| `project/codex-team.md` | `.codex/team.md` | Codex hedefi seçiliyse |
| `project/migration-map.md` | `.codex/migration-map.md` | Codex hedefi seçiliyse (kaynak varsa) |
| `project/opencode.json` | `opencode.json` | OpenCode hedefi seçiliyse |
| `project/opencode-team.md` | `.opencode/team.md` | OpenCode hedefi seçiliyse |
| `skills/<skill>/SKILL.md` | `.agents/skills/` (her zaman — Codex ve OpenCode ikisi de okur) + Claude hedefi varsa `.claude/skills/` + OpenCode hedefi varsa `.opencode/skills/` | varsa |
| *(kaynak yok — sync'in kendi ürettiği)* | `.agent-source/generated-files.json` | bu turda üretilen tüm generated yollar **artı** önceki defterde olup hâlâ diskte duran yollar (birleşim) |

> **`instructions.md` üretilen dosya değildir.** `.agent-source/project/` altında yaşar
> ve `CLAUDE.md`/`AGENTS.md` ona referans verir; `opencode.json` `instructions` dizisine
> ekler. Kopyalanmadığı için ledger'a girmez ve drift kontrolüne konu olmaz — ama
> **referansın kendisi** denetlenir (`sync-pipeline.md`).

- `agents/<role>.md`'nin hangi hedeflere gideceği o agent'ın **`targets`** alanına
  bağlıdır (yoksa kök `targetsDefault`): örn. `["claude"]`, `["opencode"]`,
  `["claude","codex"]`. **Varsayılan ekosistem yoktur** — hedef her zaman açık bir seçimdir;
  Claude seçilmediyse `CLAUDE.md` ve `.claude/*` üretilmez.
- `manifest.json`, Codex target'ı olan her agent için bir `*.toml` üretir; bu TOML
  manifest metadata'sını (`name`, `description`, `sandbox_mode`, `nickname_candidates`),
  `llm.json`'dan çözümlenen `model` ve `model_reasoning_effort`'u (bkz. `llm-config.md`) ve
  `developer_instructions` bloğunu içerir.

## Drift & Idempotentlik (özet)

- **`--check`:** Hiçbir şey yazmaz; kaynaktan üretilmesi beklenen içerikle diskteki
  generated dosyaları karşılaştırır. Fark (drift) varsa mismatch listesi basar ve
  exit ≠ 0 döner. Generated dosyanın elle değiştirilmiş olması burada yakalanır.
- **Idempotent:** Kaynak değişmeden sync tekrar çalışınca hiçbir generated dosya
  değişmez — sıfır yazma. Bu, `--check`'in her zaman temiz çıkacağı anlamına
  gelmez: defterde hâlâ diskte duran bayat bir yol varsa `--check` o yol elle
  silinene kadar exit 1 vermeye devam eder (bkz. `sync-pipeline.md` §8).
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

## `.agent-work/` de canonical DEĞİLDİR

Plan kapısı açık projelerde `.agent-work/` agent'ların çalışma alanıdır: planlar, ham
kayıtlar, ilerleme notları. `.agent-memory/` ile aynı statüdedir.

- Setup boş iskeleti (`inbox/ draft/ approved/ in-progress/ done/` + `TEMPLATE.md` +
  `README.md`) **bir kez** kurar; ondan sonrasını `work-plan` skill'i yönetir.
- `sync` onu **üretmez, silmez, drift kontrolüne sokmaz** ve generated-file ledger'ı
  sahiplenmez. Kaynak ağacında karşılığı olmadığı için hiçbir aşamada okunmaz.
- Buraya yalnız `work-plan` akışını çalıştıran agent yazar; denetleyiciler dahil kimse
  doğrudan dosya değiştirmez, sonuç döndürür.

## Canonical olmayan diğer dosyalar

- `.claude/settings.local.json` canonical kaynak değildir. Sync bu dosyayı kopyalamaz,
  Codex altına taşımaz ve `--check` modunda **drift sebebi saymaz** (kullanıcıya özel
  yerel izinler).
- `.agent-source/generated-files.json` **kaynak değildir** — `.agent-source/` ağacının
  içinde duran tek generated dosyadır. Sync'in kendi **sahiplik defteridir**: bu turda
  ürettiği yollar **artı** önceki defterde olup hâlâ diskte duran yolların birleşimini
  tutar. Bayat çıktı raporu buna bakar, böylece deftere hiç girmemiş — yani kullanıcının
  kendi yazdığı — agent/skill dosyaları bayat sayılmaz. (Kullanıcı bir zamanlar generated
  olan bir yola elle dosya koyarsa o yol defterde olduğu için bayat raporlanır.) Elle
  düzenlenmez ve **git'e girmez**: bu makinede neyin üretildiğinin kaydıdır. Commit
  edilseydi, bir takım arkadaşının kaldırdığı agent'ın dosyası benim diskimde bayat olarak
  raporlanmazdı ve Claude onu yüklemeye devam ederdi. Detay: `sync-pipeline.md` §8.
