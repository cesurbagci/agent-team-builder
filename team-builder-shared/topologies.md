# topologies.md — Takım Topolojisi (subagent vs native agent teams)

> Paylaşılan referans. `team-builder-setup` ve `agent-md-rich.md` buna dayanır.
> **Hedef ekosistem** (Claude/Codex, bkz. `codex-target.md`) ile **topoloji** ayrı eksenlerdir.
> Topoloji, **Claude hedefi** için agent'ların birbiriyle nasıl konuştuğunu belirler.

## İki topoloji

### 1) `subagent` (hiyerarşik — varsayılan)
- Ana (lead) oturum işi dağıtır; subagent'lar **izole bağlamda** çalışır ve **yalnız sonuç mesajını** lead'e döndürür. Agent'lar birbirleriyle doğrudan konuşmaz.
- Tanım: `.claude/agents/<name>.md` (frontmatter + gövde). Lead, `Agent`/`Task` tool ile çağırır.
- Ek ayar **gerekmez**. Klasik, kararlı yol.
- Agent md "İletişim" bölümü: **"Bulgularını/çıktılarını lead'e (`<lead>`) raporla; lider isen dağıt ve topla."**

### 2) `native` (agent teams — deneysel, peer-to-peer)
- Birden çok bağımsız Claude Code oturumu paralel çalışır; **teammate'ler birbirine isimle doğrudan mesaj atar** (mailbox/`SendMessage`), **paylaşılan task list** üzerinden kendi kendine koordine olur. Her teammate'in kendi context window'u vardır.
- **Aynı `.claude/agents/<name>.md` tanımlarını kullanır** — ekstra statik takım dosyası yok. Team runtime'da doğal dille kurulur; `~/.claude/teams/<team>/` ve `~/.claude/tasks/<team>/` Claude tarafından otomatik üretilir (bunları biz YAZMAYIZ).
- **Etkinleştirme (proje `.claude/settings.json`):**
  ```jsonc
  {
    "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
    "teammateMode": "auto"   // "auto" (varsayılan, ortamı algılar) | "in-process" (hepsi ana oturumda, Shift+Down ile gez) | "tmux" (ayrı panel; tmux/iTerm2 gerekir)
  }
  ```
  - **Takım otomatik başlamaz:** lider, sen "şu rollerle takım kur" deyince veya önerip onaylayınca teammate'leri spawn eder; CLAUDE.md tek başına otomatik takım kuramaz.
  - Split-pane (tmux) terminal'e özeldir; desktop app'te muhtemelen yalnız in-process geçerli (doküman net değil).
- **Sürüm/gereksinim:** Deneysel; yeni Claude Code sürümü gerekir (dokümana göre ~v2.1.32+). Kurulumda `claude --version` ile doğrula; flag adı/sürüm zamanla değişebilir — emin değilsen kullanıcıyı bilgilendir.
- Agent md "İletişim" bölümü: **"Diğer teammate'lerle isimle doğrudan mesajlaş; paylaşılan task list'ten işleri al/güncelle; lead başlangıçta dağıtır ama koordinasyon peer-to-peer'dir."**

## Üretime etkisi (kim neyi yazar)

| Konu | subagent | native |
|---|---|---|
| `.claude/agents/<name>.md` | Üretilir (lead-raporlama dili) | Üretilir (peer-mesajlaşma dili) |
| `.claude/settings.json` env flag | **gerekmez** | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `teammateMode` — **setup tarafından merge edilir** (generator değil; mevcut anahtarlar korunur) |
| `CLAUDE.md` notu | normal routing/danışma | + "Takımı başlatma" notu (doğal dille team kurma örneği) |
| `~/.claude/teams/`, `~/.claude/tasks/` | yok | Claude runtime'da otomatik üretir; biz dokunmayız |

> **Not:** `settings.json` enablement'ı canonical→generated `sync` kapsamında DEĞİLDİR (tek seferlik proje aç/kapa ayarı; `sync-agent-config.mjs` settings.json'a dokunmaz). Topolojinin agent davranışına yansıması, agent md'lerin "İletişim" bölümüne (kaynakta) yazılır ve normal generate ile taşınır.

## Manifest
`manifest.topology`: `"subagent"` (varsayılan) | `"native"`. Topoloji **Claude hedefi** içindir; Codex hedefinin kendi takım modeli ayrıdır (`codex-target.md` / `.codex/team.md`).
