# agent-team-builder

**English** · [Türkçe](#türkçe)

> A question-driven Claude Code / Codex / OpenCode skill family that sets up a **persistent
> agent team with governance rules baked in** for any project. Technology-stack agnostic.

It installs an architect (writes no code, only produces architecture decisions / **ADRs**),
domain-split developers, and a read-only reviewer; the **mandatory routing** and
**consultation chain** between them; and every agent file generated from a single
`.agent-source/` canonical source. Runs once — the configuration it produces is permanent
in the project.

## Table of contents

- [What it does](#what-it-does)
- [Skills](#skills)
- [Requirements](#requirements)
- [Installation](#installation)
  - [macOS / Linux](#macos--linux)
  - [Windows](#windows)
  - [Manual install](#manual-install)
- [Verify the install](#verify-the-install)
- [Quick start](#quick-start)
- [How it works (canonical → generate → drift)](#how-it-works-canonical--generate--drift)
- [Distribution methods](#distribution-methods)
- [Update & uninstall](#update--uninstall)
- [License](#license)

## What it does

Most agent setups rely on a single assistant. agent-team-builder instead defines **a team**
and bakes the rules the team must follow (the "constitution") into each agent's instructions:

- **Roles:** architect (read-only, produces ADRs) · domain developers · reviewer (read-only).
- **Constitution:** no-workaround discipline, code–doc sync, per-agent memory, language/comment
  standard — all four on by default, each toggleable in the wizard. A fifth preset, the
  **plan gate**, is **off by default**: it makes the team write a plan, have it reviewed
  (when you name a reviewer) and get **your** approval before any code is written. Unlike the other four it creates files in
  your project (`.agent-work/` and a `work-plan` skill), which is why you opt into it.
- **Mandatory routing:** path-based routing like "if this code path changes, that developer;
  on architectural uncertainty, the architect".
- **Single source:** everything is generated from `.agent-source/`; generated files are never
  hand-edited.

## Skills

| Skill | Purpose |
|---|---|
| `/team-builder-setup` | Full wizard: targets (Claude/Codex/OpenCode), topology, roles, routing, constitution presets (including the optional plan gate) → `.agent-source/` + generate. At the end it offers to fill in architecture docs with you. |
| `/team-builder-sync` | Re-generates the generated files from `.agent-source/` / runs a **drift** check. |
| `/architecture-advisor` | Analyzes the project, proposes ADR / architecture constraints / design, and writes them with you step by step under `docs/<arch-root>/`. Also works standalone. |

`team-builder-shared/` holds the shared references the skills depend on, plus the generator
(`sync-agent-config.mjs`) and the manifest validator (`validate-manifest.mjs`).

## Requirements

- **Claude Code**, **Codex**, or **OpenCode** installed (any combination).
- **Node.js ≥ 18** — for the generator (`sync-agent-config.mjs`) and the manifest validator.
- macOS / Linux: `bash`, `perl` (used for the codex/opencode path rewrite; both ship by default).
  Windows: **PowerShell 5+**.

## Installation

Clone the repo first:

```bash
git clone https://github.com/cesurbagci/agent-team-builder.git
cd agent-team-builder
```

**There is no default target.** Run the script with no argument and it asks which
tool to install for; pass a target explicitly to skip the prompt.

### macOS / Linux

```bash
./install.sh            # interactive picker
./install.sh claude     # Claude            -> ~/.claude/skills
./install.sh codex      # Codex             -> ~/.codex/skills
./install.sh opencode   # OpenCode          -> ~/.config/opencode/skills
./install.sh both       # Claude + Codex
./install.sh all        # Claude + Codex + OpenCode
```

Custom Claude target:

```bash
CLAUDE_SKILLS_DIR=/custom/path ./install.sh claude
```

### Windows

In PowerShell:

```powershell
.\install.ps1           # interactive picker
.\install.ps1 claude    # Claude
.\install.ps1 codex     # Codex
.\install.ps1 opencode  # OpenCode
.\install.ps1 both      # Claude + Codex
.\install.ps1 all       # Claude + Codex + OpenCode
```

If you hit an execution-policy error:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### Manual install

If you'd rather not use the script, copy the skill directories **as-is** (keep the
subfolder structure) into your global skills directory:

```bash
# macOS / Linux — Claude
cp -R team-builder-setup team-builder-sync architecture-advisor team-builder-shared \
  ~/.claude/skills/
```

> **Important:** `team-builder-shared/` contains the shared references the skills depend
> on — **always copy it too**. For a manual Codex install (target `~/.codex/skills/`) or
> OpenCode install (`~/.config/opencode/skills/`) you must rewrite the
> `.claude/skills/team-builder*` self-paths to `.codex/skills/...` or
> `.config/opencode/skills/...` (the script does this automatically).

> **OpenCode note:** OpenCode discovers Claude Code's skill directories natively —
> `~/.claude/skills/` and a project's `.claude/skills/` — in addition to its own
> `~/.config/opencode/skills/`, `~/.agents/skills/` and project `.opencode/skills/`.
> So if you install for Claude, the skills already show up in OpenCode. Install for
> `opencode` when you want OpenCode to be self-contained (or you disabled that
> discovery with `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS`).

## Verify the install

Open the tool you installed for (Claude Code, Codex or OpenCode) and confirm these
appear in the skill list:

```
/team-builder-setup
/team-builder-sync
/architecture-advisor
```

You can also smoke-test the generator (swap the path for the directory you installed
into — `~/.codex/skills` or `~/.config/opencode/skills`):

```bash
node ~/.claude/skills/team-builder-shared/validate-manifest.mjs --selftest
```

## Quick start

1. Open your agent tool (Claude Code, Codex or OpenCode) at the root of the project you
   want a team for.
2. Type `/team-builder-setup`.
3. The wizard walks you through it step by step: target (Claude/Codex/OpenCode — **no
   default, you pick; any single one is valid**), topology, doc language, architecture
   root, constitution presets, roles, and per-role model/effort/skill.
4. On confirmation it generates `.agent-source/` plus **only the outputs for the targets you
   picked** — Claude → `CLAUDE.md` + `.claude/agents/*`; Codex → `AGENTS.md` + `.codex/*`;
   OpenCode → `AGENTS.md` + `opencode.json` + `.opencode/*`.
5. At the end the wizard can offer to write the first architecture docs with you via
   `/architecture-advisor`.

> This skill **does not run work** — it only produces configuration. Launching a native agent
> team for parallel work is Claude's built-in feature; this skill is separate from that.

## How it works (canonical → generate → drift)

The single source of truth is `.agent-source/`:

```
.agent-source/  ──(sync)──►  CLAUDE.md           (if Claude target is selected)
   (canonical)               .claude/agents/*    (if Claude target is selected)
                             AGENTS.md           (if Codex or OpenCode target is selected)
                             .codex/*            (if Codex target is selected)
                             opencode.json + .opencode/*   (if OpenCode target is selected)
```

- Generated files are **never hand-edited**; you update the source and `sync` regenerates them.
- `/team-builder-sync` refreshes the outputs; `--check` mode catches **drift** between the
  source and the generated files.
- Each generated file starts with the header
  `# This file is generated from .agent-source. Run sync.`

## Distribution methods

- **Script install (recommended, current):** clone + `install.sh` / `install.ps1`. Works today
  on macOS / Linux / Windows. Skills resolve from `~/.claude/skills/team-builder-shared/`.
- **Plugin / marketplace (planned):** one-command `/plugin install` with auto-updates. This
  requires migrating the skills' path references to `${CLAUDE_PLUGIN_ROOT}` and is tracked as a
  future enhancement.

## Update & uninstall

**Update:** `git pull`, then re-run the install script (it overwrites the existing install).

**Uninstall:** remove the skill folders from your global directory.

```bash
# macOS / Linux
rm -rf ~/.claude/skills/{team-builder-setup,team-builder-sync,architecture-advisor,team-builder-shared}
```

```powershell
# Windows
'team-builder-setup','team-builder-sync','architecture-advisor','team-builder-shared' |
  ForEach-Object { Remove-Item -Recurse -Force "$HOME\.claude\skills\$_" }
```

> If you installed for Codex or OpenCode, replace `~/.claude/skills` above with
> `~/.codex/skills` or `~/.config/opencode/skills`.
>
> Files produced by `/team-builder-setup` inside a project (its `.agent-source/`, `CLAUDE.md`,
> `.claude/agents/`, etc.) are **not** deleted when you uninstall the skill; remove those from
> the project separately.

## License

[MIT](LICENSE).

---

# Türkçe

[English](#agent-team-builder) · **Türkçe**

> Bir projede **governance kuralları gömülü, kalıcı bir agent takımı** kuran; soru sorarak
> ilerleyen Claude Code / Codex / OpenCode skill ailesi. Teknoloji-stack'inden bağımsızdır.

Mimar (kod yazmaz, yalnızca mimari karar / **ADR** üretir), domain'lere bölünmüş
developer'lar ve read-only reviewer gibi rolleri; aralarındaki **zorunlu routing** ve
**danışma zincirini**; ve `.agent-source/` canonical kaynağından üretilen tüm agent
dosyalarını otomatik kurar. Bir kez çalışır, ürettiği konfigürasyon projede kalıcıdır.

## Ne işe yarar?

Çoğu agent kurulumu tek bir asistana dayanır. agent-team-builder bunun yerine **bir takım**
tanımlar ve takımın uyması gereken kuralları (anayasa) her agent'ın talimatına gömer:

- **Roller:** architect (read-only, ADR üretir) · domain developer'lar · reviewer (read-only).
- **Anayasa:** no-workaround disiplini, kod-doküman senkronu, per-agent memory, dil/yorum
  standardı — dördü de varsayılan açık, sihirbazda kapatılabilir. Beşinci bir preset,
  **plan kapısı**, **varsayılan kapalıdır**: kod yazılmadan önce plan yazılmasını,
  (bir denetleyici belirlediysen) denetlenmesini ve **senin onaylamanı** şart koşar. Diğer dördünün aksine projede dosya
  üretir (`.agent-work/` ve bir `work-plan` skill'i) — o yüzden açmak bilinçli bir tercihtir.
- **Zorunlu routing:** "şu kod yolu değişiyorsa şu developer'a, mimari belirsizlikte
  architect'e" gibi path-bazlı yönlendirme.
- **Tek kaynak:** her şey `.agent-source/`'tan üretilir; generated dosyalar elle düzenlenmez.

## Skill'ler

| Skill | Görev |
|---|---|
| `/team-builder-setup` | Tam sihirbaz: hedefler (Claude/Codex/OpenCode), topoloji, roller, routing, anayasa presetleri (isteğe bağlı plan kapısı dahil) → `.agent-source/` + generate. Sonunda mimari dokümanları birlikte doldurmayı teklif eder. |
| `/team-builder-sync` | `.agent-source/`'tan generated dosyaları yeniden üretir / **drift** (sapma) kontrolü yapar. |
| `/architecture-advisor` | Projeyi analiz edip ADR / mimari kısıt / tasarım önerir ve kullanıcıyla adım adım `docs/<arch-root>/` altına yazar. Takımdan bağımsız da çalışır. |

`team-builder-shared/`, skill'lerin dayandığı paylaşılan referansları + generator'ı
(`sync-agent-config.mjs`) ve manifest doğrulayıcıyı (`validate-manifest.mjs`) barındırır.

## Gereksinimler

- **Claude Code**, **Codex** veya **OpenCode** kurulu (herhangi bir kombinasyon).
- **Node.js ≥ 18** — generator (`sync-agent-config.mjs`) ve manifest doğrulayıcı için.
- macOS / Linux: `bash`, `perl` (codex/opencode hedefinde path düzeltmesi için; ikisi de hazır gelir).
  Windows: **PowerShell 5+**.

## Kurulum

Önce repoyu klonla:

```bash
git clone https://github.com/cesurbagci/agent-team-builder.git
cd agent-team-builder
```

**Varsayılan hedef yoktur.** Script'i argümansız çalıştırırsan hangi araç için
kurulacağını sorar; hedefi doğrudan yazarsan soruyu atlar.

### macOS / Linux

```bash
./install.sh            # seçim ekranı
./install.sh claude     # Claude               -> ~/.claude/skills
./install.sh codex      # Codex                -> ~/.codex/skills
./install.sh opencode   # OpenCode             -> ~/.config/opencode/skills
./install.sh both       # Claude + Codex
./install.sh all        # Claude + Codex + OpenCode
```

Farklı bir Claude hedefi için:

```bash
CLAUDE_SKILLS_DIR=/özel/yol ./install.sh claude
```

### Windows

PowerShell'de:

```powershell
.\install.ps1           # seçim ekranı
.\install.ps1 claude    # Claude
.\install.ps1 codex     # Codex
.\install.ps1 opencode  # OpenCode
.\install.ps1 both      # Claude + Codex
.\install.ps1 all       # Claude + Codex + OpenCode
```

Çalıştırma politikası hatası alırsan:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### Elle kurulum

Script kullanmak istemezsen, skill dizinlerini **olduğu gibi** (alt klasör yapısını
bozmadan) global skills dizinine kopyala:

```bash
# macOS / Linux — Claude
cp -R team-builder-setup team-builder-sync architecture-advisor team-builder-shared \
  ~/.claude/skills/
```

> **Önemli:** `team-builder-shared/` paylaşılan referansları içerir; skill'ler ona dayanır —
> **mutlaka birlikte kopyala**. Codex'e (`~/.codex/skills/`) veya OpenCode'a
> (`~/.config/opencode/skills/`) elle kurarken `.claude/skills/team-builder*` self-yollarını
> sırasıyla `.codex/skills/...` veya `.config/opencode/skills/...` olarak güncellemen gerekir
> (script bunu otomatik yapar).

> **OpenCode notu:** OpenCode, kendi dizinlerinin (`~/.config/opencode/skills/`,
> `~/.agents/skills/`, proje `.opencode/skills/`) yanı sıra **Claude Code'un skill
> dizinlerini de native okur** — `~/.claude/skills/` ve proje `.claude/skills/`.
> Yani Claude için kurarsan skill'ler OpenCode'da da görünür. `opencode` hedefine
> kurmak, OpenCode'un kendi başına yeterli olmasını istediğinde (ya da bu keşfi
> `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS` ile kapattığında) anlamlıdır.

## Kurulumu doğrula

Kurduğun aracı aç (Claude Code, Codex ya da OpenCode) ve skill listesinde şunların
göründüğünü kontrol et:

```
/team-builder-setup
/team-builder-sync
/architecture-advisor
```

Generator'ın sağlığını da test edebilirsin (yolu kurduğun dizinle değiştir —
`~/.codex/skills` ya da `~/.config/opencode/skills`):

```bash
node ~/.claude/skills/team-builder-shared/validate-manifest.mjs --selftest
```

## Hızlı başlangıç

1. Takımını kurmak istediğin projenin kök dizininde aracını aç (Claude Code, Codex ya da
   OpenCode).
2. `/team-builder-setup` yaz.
3. Sihirbaz seni adım adım götürür: hedef (Claude/Codex/OpenCode — **varsayılan yok, sen
   seçersin; tek bir hedef seçmek de geçerli**), topoloji, doküman dili, mimari kök,
   anayasa presetleri, roller ve her rol için model/effort/skill.
4. Onayladığında `.agent-source/` ve **yalnız seçtiğin hedeflerin çıktıları** üretilir —
   Claude → `CLAUDE.md` + `.claude/agents/*`; Codex → `AGENTS.md` + `.codex/*`;
   OpenCode → `AGENTS.md` + `opencode.json` + `.opencode/*`.
5. İstersen sihirbaz sonunda `/architecture-advisor` ile ilk mimari dokümanları birlikte
   yazmayı teklif eder.

> Bu skill **iş çalıştırmaz**, yalnız konfigürasyon üretir. Native bir agent takımını paralel
> iş için başlatmak Claude'un yerleşik özelliğidir; bu skill ondan ayrıdır.

## Nasıl çalışır? (canonical → generate → drift)

Tek gerçek kaynak `.agent-source/`'tur:

```
.agent-source/  ──(sync)──►  CLAUDE.md           (Claude hedefi seçiliyse)
   (canonical)               .claude/agents/*    (Claude hedefi seçiliyse)
                             AGENTS.md           (Codex veya OpenCode hedefi seçiliyse)
                             .codex/*            (Codex hedefi seçiliyse)
                             opencode.json + .opencode/*   (OpenCode hedefi seçiliyse)
```

- Generated dosyalar **elle değiştirilmez**; kaynak güncellenir ve `sync` yeniden üretir.
- `/team-builder-sync` çıktıları tazeler; `--check` modu kaynak ile üretilen arasındaki
  **drift**'i (sapmayı) yakalar.
- Her generated dosyanın başına `# This file is generated from .agent-source. Run sync.`
  header'ı yazılır.

## Dağıtım yöntemleri

- **Script install (önerilen, mevcut):** clone + `install.sh` / `install.ps1`. macOS / Linux /
  Windows'ta bugün çalışır. Skill'ler `~/.claude/skills/team-builder-shared/`'tan çözülür.
- **Plugin / marketplace (planlanan):** tek komut `/plugin install` + otomatik güncelleme. Bu,
  skill'lerin yol referanslarının `${CLAUDE_PLUGIN_ROOT}`'a taşınmasını gerektirir; gelecek bir
  geliştirme olarak izleniyor.

## Güncelleme & kaldırma

**Güncelleme:** repoyu `git pull` ile çek, install script'ini yeniden çalıştır (mevcut
kurulumu üzerine yazar).

**Kaldırma:** skill klasörlerini global dizinden sil.

```bash
# macOS / Linux
rm -rf ~/.claude/skills/{team-builder-setup,team-builder-sync,architecture-advisor,team-builder-shared}
```

```powershell
# Windows
'team-builder-setup','team-builder-sync','architecture-advisor','team-builder-shared' |
  ForEach-Object { Remove-Item -Recurse -Force "$HOME\.claude\skills\$_" }
```

> Codex veya OpenCode için kurduysan yukarıdaki `~/.claude/skills`'i `~/.codex/skills` ya da
> `~/.config/opencode/skills` ile değiştir.
>
> Bir projede `/team-builder-setup` ile üretilmiş dosyalar (o projenin `.agent-source/`,
> `CLAUDE.md`, `.claude/agents/` vb.) skill kaldırılınca **silinmez**; onları projeden ayrıca
> kaldırman gerekir.

## Lisans

[MIT](LICENSE).
