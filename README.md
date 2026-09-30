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
  - [Claude Code plugin](#claude-code-plugin)
  - [Codex plugin](#codex-plugin)
  - [Script install](#script-install)
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
  **plan gate**, is asked separately and **recommended on**: it makes the team write a plan, have it
  reviewed (when you name a reviewer) and get **your** approval before any code is written. Unlike
  the other four it creates files in your project (`.agent-work/` and a `work-plan` skill), so you
  can turn it off.
- **Mandatory routing:** path-based routing like "if this code path changes, that developer;
  on architectural uncertainty, the architect".
- **Single source:** everything is generated from `.agent-source/`; generated files are never
  hand-edited.

## Skills

| Skill | Purpose |
|---|---|
| `/team-builder-setup` | Full wizard: targets (Claude/Codex/OpenCode), topology, roles, routing, constitution presets (including the optional plan gate) → `.agent-source/` + generate. At the end it offers to fill in architecture docs with you. |
| `/team-builder-sync` | Re-generates the generated files from `.agent-source/` / runs a **drift** check. |
| `/team-builder-upgrade` | Turns constitution presets (including the plan gate) on or off after setup, and migrates older projects to the single instructions file. |
| `/team-builder-models` | Chooses the model and effort each agent runs with, per ecosystem: the shared `.agent-source/llm.json`, this machine's `llm.local.json`, refreshing new or retiring models, and migrating older projects. |
| `/team-builder-module` | Adds a new folder (module) to an installed team: gives it to an existing role that can write, or opens a new role for it (skills, model, who consults it), and updates routing, the role files and the instructions together. |
| `/architecture-advisor` | Analyzes the project, proposes ADR / architecture constraints / design, and writes them with you step by step under `docs/<arch-root>/`. Also works standalone. |

`skills/team-builder-shared/` holds the shared references the skills depend on, plus the
generator (`sync-agent-config.mjs`) and the validators (`validate-manifest.mjs`,
`validate-llm.mjs`).

## Requirements

- **Claude Code**, **Codex**, or **OpenCode** installed (any combination).
- **Node.js ≥ 18** — for the generator (`sync-agent-config.mjs`) and the manifest validator.
- Script install on macOS / Linux: `bash`, `perl` (used for the path rewrite; both ship by default).
  Windows: **PowerShell 5+**.

## Installation

Pick one method per tool: installing the same tool both as a plugin and by script lists
every skill twice.

### Claude Code plugin

```bash
claude plugin marketplace add cesurbagci/agent-team-builder
claude plugin install team-builder@team-builder
```

The skills carry the plugin's name: `/team-builder:team-builder-setup`,
`/team-builder:team-builder-sync`, and so on. `--scope project` on either command limits it to
the current project; `cesurbagci/agent-team-builder#<branch-or-tag>` pins a version.

### Codex plugin

```bash
codex plugin marketplace add cesurbagci/agent-team-builder
codex plugin add team-builder@team-builder
```

Codex does not prefix plugin skills: they appear as `$team-builder-setup`,
`$team-builder-sync`, and so on. `--ref <branch-or-tag>` on `marketplace add` pins a version.

### Script install

For Claude Code, Codex and OpenCode — the only way for OpenCode. Clone the repo first:

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
cp -R skills/* ~/.claude/skills/
```

> **Important:** `team-builder-shared/` contains the shared references the skills depend
> on — **always copy it too**. The skills name those files as
> `${CLAUDE_SKILL_DIR}/../team-builder-shared/…`; in a copy, replace `${CLAUDE_SKILL_DIR}/..`
> in the copied `.md` files with the absolute path of the skills directory (the script does
> this automatically).

> **OpenCode note:** OpenCode discovers Claude Code's skill directories natively —
> `~/.claude/skills/` and a project's `.claude/skills/` — in addition to its own
> `~/.config/opencode/skills/`, `~/.agents/skills/` and project `.opencode/skills/`.
> So if you install for Claude, the skills already show up in OpenCode. Install for
> `opencode` when you want OpenCode to be self-contained (or you disabled that
> discovery with `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS`).

## Verify the install

Open the tool you installed for (Claude Code, Codex or OpenCode) and confirm these
appear in the skill list (the Claude plugin shows them as `/team-builder:<name>`, the Codex
plugin as `$<name>`):

```
/team-builder-setup
/team-builder-sync
/team-builder-upgrade
/team-builder-models
/team-builder-module
/architecture-advisor
```

After a script install you can also smoke-test the generator (swap the path for the
directory you installed into — `~/.codex/skills` or `~/.config/opencode/skills`):

```bash
node ~/.claude/skills/team-builder-shared/validate-manifest.mjs --selftest
```

## Quick start

1. Open your agent tool (Claude Code, Codex or OpenCode) at the root of the project you
   want a team for.
2. Type `/team-builder-setup` (Claude plugin: `/team-builder:team-builder-setup`; Codex
   plugin: `$team-builder-setup`).
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
- **Agent files are committed.** They carry the team's models from `.agent-source/llm.json`, so
  a teammate who only uses the agents needs nothing but `git pull` — team-builder is for whoever
  changes the team or its models. The only file git ignores is `.agent-source/llm.local.json`,
  kept in a `.gitignore` block that sync manages.
- **team-builder can travel with the repo.** Setup offers to copy team-builder itself into
  `.agent-source/skills/`, so a teammate who never installed it can still change the team.
  Re-run `copy-skill.mjs --team-builder <project>` to update that copy. Someone who also installs
  team-builder separately sees its skills twice, so they don't need to.
- **Skills chosen for a role are copied into the project** (`.agent-source/skills/`), never
  installed globally.
- **A machine can run different models.** Sync applies `llm.local.json` and lists the agent
  files it changed on this machine; leave those out of your commits. `sync --no-local` writes
  the team's version (for example before committing a change to `llm.json`).
- **Models live in `.agent-source/llm.json`** (committed): the model and effort each agent runs
  with, per ecosystem. A machine can override them in `.agent-source/llm.local.json`.
  `/team-builder-models` sets both up.

## Distribution methods

- **Plugin (Claude Code, Codex):** the repo is its own marketplace for both tools
  (`.claude-plugin/`; `.agents/plugins/marketplace.json` + `.codex-plugin/`). The version lives
  in `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` — keep the two equal.
- **Script install:** clone + `install.sh` / `install.ps1`, for all three tools. The skills find
  their scripts next to themselves; the script writes in the absolute path.

## Update & uninstall

**Update:**

- Claude plugin: `claude plugin marketplace update team-builder`, then
  `claude plugin update team-builder@team-builder` (restart to apply).
- Codex plugin: `codex plugin marketplace upgrade team-builder`.
- Script install: `git pull`, then re-run the install script (it overwrites the existing
  install).

Projects set up with an older version keep model settings in the manifest; the updated sync
stops on them and points to `/team-builder-models`, which prepares the migration as one commit
for you to make.
Anyone who runs team-builder commands should update: older versions do not read `llm.json`,
and their sync would drop the model lines from the agent files. Teammates who only use the
agents just pull.

**Uninstall:** `claude plugin uninstall team-builder@team-builder` or
`codex plugin remove team-builder@team-builder` for a plugin. For a script install, remove the
skill folders from your global directory:

```bash
# macOS / Linux
rm -rf ~/.claude/skills/{team-builder-setup,team-builder-sync,team-builder-upgrade,team-builder-models,team-builder-module,architecture-advisor,team-builder-shared}
```

```powershell
# Windows
'team-builder-setup','team-builder-sync','team-builder-upgrade','team-builder-models','team-builder-module','architecture-advisor','team-builder-shared' |
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
  **plan kapısı**, ayrı sorulur ve **açık önerilir**: kod yazılmadan önce plan yazılmasını,
  (bir denetleyici belirlediysen) denetlenmesini ve **senin onaylamanı** şart koşar. Diğer
  dördünün aksine projede dosya üretir (`.agent-work/` ve bir `work-plan` skill'i) — istemezsen
  kapatırsın.
- **Zorunlu routing:** "şu kod yolu değişiyorsa şu developer'a, mimari belirsizlikte
  architect'e" gibi path-bazlı yönlendirme.
- **Tek kaynak:** her şey `.agent-source/`'tan üretilir; generated dosyalar elle düzenlenmez.

## Skill'ler

| Skill | Görev |
|---|---|
| `/team-builder-setup` | Tam sihirbaz: hedefler (Claude/Codex/OpenCode), topoloji, roller, routing, anayasa presetleri (isteğe bağlı plan kapısı dahil) → `.agent-source/` + generate. Sonunda mimari dokümanları birlikte doldurmayı teklif eder. |
| `/team-builder-sync` | `.agent-source/`'tan generated dosyaları yeniden üretir / **drift** (sapma) kontrolü yapar. |
| `/team-builder-upgrade` | Kurulumdan sonra anayasa preset'lerini (plan kapısı dahil) açar ya da kapatır; eski projeleri tek talimat dosyasına göç ettirir. |
| `/team-builder-models` | Her agent'ın hangi model ve effort'la çalışacağını ekosistem başına ayarlar: ortak `.agent-source/llm.json`, bu makinenin `llm.local.json`'u, yeni çıkan ya da kalkan modellerin yenilenmesi ve eski projelerin göçü. |
| `/team-builder-module` | Kurulu takıma yeni bir klasör (modül) ekler: yazabilen mevcut bir role verir ya da onun için yeni bir rol açar (skill'ler, model, kim ona danışır); routing'i, rol dosyalarını ve talimatları birlikte günceller. |
| `/architecture-advisor` | Projeyi analiz edip ADR / mimari kısıt / tasarım önerir ve kullanıcıyla adım adım `docs/<arch-root>/` altına yazar. Takımdan bağımsız da çalışır. |

`skills/team-builder-shared/`, skill'lerin dayandığı paylaşılan referansları + generator'ı
(`sync-agent-config.mjs`) ve doğrulayıcıları (`validate-manifest.mjs`, `validate-llm.mjs`) barındırır.

## Gereksinimler

- **Claude Code**, **Codex** veya **OpenCode** kurulu (herhangi bir kombinasyon).
- **Node.js ≥ 18** — generator (`sync-agent-config.mjs`) ve manifest doğrulayıcı için.
- macOS / Linux'ta script ile kurulum: `bash`, `perl` (yol düzeltmesi için; ikisi de hazır gelir).
  Windows: **PowerShell 5+**.

## Kurulum

Her araç için tek bir yöntem seç: aynı aracı hem plugin hem script ile kurarsan her skill
iki kez listelenir.

### Claude Code plugin'i

```bash
claude plugin marketplace add cesurbagci/agent-team-builder
claude plugin install team-builder@team-builder
```

Skill'ler plugin'in adını taşır: `/team-builder:team-builder-setup`,
`/team-builder:team-builder-sync` vb. İki komuttan birine `--scope project` eklersen yalnız o
projede geçerli olur; `cesurbagci/agent-team-builder#<dal-ya-da-etiket>` bir sürüme sabitler.

### Codex plugin'i

```bash
codex plugin marketplace add cesurbagci/agent-team-builder
codex plugin add team-builder@team-builder
```

Codex plugin skill'lerinin önüne plugin adını eklemez: `$team-builder-setup`,
`$team-builder-sync` vb. olarak görünürler. `marketplace add`'e `--ref <dal-ya-da-etiket>`
eklemek bir sürüme sabitler.

### Script ile kurulum

Claude Code, Codex ve OpenCode için — OpenCode'un tek yolu. Önce repoyu klonla:

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
cp -R skills/* ~/.claude/skills/
```

> **Önemli:** `team-builder-shared/` paylaşılan referansları içerir; skill'ler ona dayanır —
> **mutlaka birlikte kopyala**. Skill'ler bu dosyaları `${CLAUDE_SKILL_DIR}/../team-builder-shared/…`
> diye anar; kopyada, kopyalanan `.md` dosyalarındaki `${CLAUDE_SKILL_DIR}/..`'yı skills
> dizininin mutlak yoluyla değiştir (script bunu otomatik yapar).

> **OpenCode notu:** OpenCode, kendi dizinlerinin (`~/.config/opencode/skills/`,
> `~/.agents/skills/`, proje `.opencode/skills/`) yanı sıra **Claude Code'un skill
> dizinlerini de native okur** — `~/.claude/skills/` ve proje `.claude/skills/`.
> Yani Claude için kurarsan skill'ler OpenCode'da da görünür. `opencode` hedefine
> kurmak, OpenCode'un kendi başına yeterli olmasını istediğinde (ya da bu keşfi
> `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS` ile kapattığında) anlamlıdır.

## Kurulumu doğrula

Kurduğun aracı aç (Claude Code, Codex ya da OpenCode) ve skill listesinde şunların
göründüğünü kontrol et (Claude plugin'i onları `/team-builder:<ad>`, Codex plugin'i `$<ad>`
olarak gösterir):

```
/team-builder-setup
/team-builder-sync
/team-builder-upgrade
/team-builder-models
/team-builder-module
/architecture-advisor
```

Script ile kurduysan generator'ın sağlığını da test edebilirsin (yolu kurduğun dizinle değiştir —
`~/.codex/skills` ya da `~/.config/opencode/skills`):

```bash
node ~/.claude/skills/team-builder-shared/validate-manifest.mjs --selftest
```

## Hızlı başlangıç

1. Takımını kurmak istediğin projenin kök dizininde aracını aç (Claude Code, Codex ya da
   OpenCode).
2. `/team-builder-setup` yaz (Claude plugin'i: `/team-builder:team-builder-setup`; Codex
   plugin'i: `$team-builder-setup`).
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
- **Ajan dosyaları commit edilir.** Takımın `.agent-source/llm.json`'daki modellerini
  taşırlar; ajanları yalnız kullanan takım arkadaşına `git pull` yeter — team-builder'ı
  takımı ya da modelleri değiştirecek kişi kurar. Git'in yok saydığı tek dosya
  `.agent-source/llm.local.json`'dur; sync'in yönettiği bir `.gitignore` bloğunda durur.
- **team-builder repoyla birlikte gelebilir.** Setup, team-builder'ın kendisini
  `.agent-source/skills/` altına kopyalamayı teklif eder; hiç kurmamış bir takım arkadaşı da takımı
  değiştirebilir. O kopyayı güncellemek için `copy-skill.mjs --team-builder <proje>` yeniden
  çalıştırılır. team-builder'ı ayrıca kuran biri skill'leri iki kez görür; kurmasına gerek yoktur.
- **Rollere seçilen skill'ler projeye kopyalanır** (`.agent-source/skills/`), global dizine
  kurulmaz.
- **Bir makine farklı modellerle çalışabilir.** Sync `llm.local.json`'u uygular ve bu makinede
  değiştirdiği ajan dosyalarını listeler; onları commit'e katma. `sync --no-local` takımın
  hâlini yazar (örneğin `llm.json`'daki bir değişikliği commit etmeden önce).
- **Modeller `.agent-source/llm.json`'dadır** (commit edilir): her agent'ın ekosistem başına
  hangi model ve effort'la çalışacağı. Bir makine bunları `.agent-source/llm.local.json`'da
  ezebilir. İkisini de `/team-builder-models` kurar.

## Dağıtım yöntemleri

- **Plugin (Claude Code, Codex):** repo iki araç için de kendi marketplace'idir
  (`.claude-plugin/`; `.agents/plugins/marketplace.json` + `.codex-plugin/`). Sürüm
  `.claude-plugin/plugin.json` ve `.codex-plugin/plugin.json`'dadır — ikisini eşit tut.
- **Script ile kurulum:** clone + `install.sh` / `install.ps1`, üç araç için de. Skill'ler
  betiklerini kendi yanlarında bulur; script mutlak yolu yazar.

## Güncelleme & kaldırma

**Güncelleme:**

- Claude plugin'i: `claude plugin marketplace update team-builder`, sonra
  `claude plugin update team-builder@team-builder` (uygulamak için yeniden başlat).
- Codex plugin'i: `codex plugin marketplace upgrade team-builder`.
- Script ile kurulum: repoyu `git pull` ile çek, install script'ini yeniden çalıştır (mevcut
  kurulumu üzerine yazar).

Eski sürümle kurulmuş projeler model ayarlarını manifest'te tutar;
güncellenmiş sync onlarda durur ve `/team-builder-models`'i gösterir — o, göçü senin
atacağın tek bir commit olarak hazırlar. team-builder komutlarını çalıştıran herkes
güncellemeli: eski sürümler `llm.json`'ı okumaz ve sync'leri ajan dosyalarındaki model
satırlarını siler. Ajanları yalnız kullanan takım arkadaşları sadece `git pull` yapar.

**Kaldırma:** plugin için `claude plugin uninstall team-builder@team-builder` ya da
`codex plugin remove team-builder@team-builder`. Script ile kurduysan skill klasörlerini global
dizinden sil:

```bash
# macOS / Linux
rm -rf ~/.claude/skills/{team-builder-setup,team-builder-sync,team-builder-upgrade,team-builder-models,team-builder-module,architecture-advisor,team-builder-shared}
```

```powershell
# Windows
'team-builder-setup','team-builder-sync','team-builder-upgrade','team-builder-models','team-builder-module','architecture-advisor','team-builder-shared' |
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
