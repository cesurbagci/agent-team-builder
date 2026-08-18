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
| `permission.edit` | `sandbox_mode`, yoksa `writesCode` | `sandbox_mode: read-only` → `deny`; `workspace-write` → `allow`. `sandbox_mode` verilmemişse `writesCode`'a düşülür (eksik alan izni genişletmesin diye). |
| `permission.bash` | `permission.edit` + `writesCode` | Kod yazmayan roller `ask`; yazan roller `allow`. |

> **`writesCode: false` tek başına `deny` demek değildir.** `writesCode` production
> koduna yazma yasağıdır ve rol metninde taşınır; `sandbox_mode` dosya sistemi iznidir.
> Doküman sahibi doc-only roller (architect, doc-writer) `writesCode: false` **ve**
> `workspace-write`'tır: `edit: deny` verilirse routing'in kendilerine verdiği dizine
> yazamazlar, yani o dizinin sahibi olamazlar. İkisini tek bayrağa indirgeme.

> Claude'a özgü frontmatter alanları (`tools`, `color`, `memory`, Claude `model` etiketi)
> OpenCode frontmatter'ına **yazılmaz**; OpenCode kendi şemasını kullanır. Rol talimatları
> (gövde) iki ekosistemde **tek kaynaktan** tutarlı kalır.

---

## 2. `opencode.json` (team config)

Minimal team config. Generator **verbatim** kopyalar.

> **DİKKAT — bu dosyaya yorum/işaret KOYMA.** OpenCode `opencode.json`'ı **katı** doğrular:
> şemada olmayan herhangi bir anahtar (bir `"//"` not anahtarı dahil) config'i **geçersiz**
> kılar ve OpenCode `Unrecognized key: //` diyerek başlamaz. JSON `#` header de taşıyamaz.
> Dolayısıyla `opencode.json`, generated-header taşımayan **tek** çıktıdır; elle düzenlemeye
> karşı koruma `--check` **drift** kontrolüdür.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [".agent-source/project/instructions.md", "AGENTS.md", "docs/mimari/**/*.md"],
  "permission": { "edit": "allow", "bash": "ask" }
}
```

- `instructions`: OpenCode'un her oturumda yüklediği kural dosyaları. **İlk eleman
  `.agent-source/project/instructions.md` olmalı** — ortak talimat kaynağıdır
  (routing, kod-doküman, anayasa, mimari kaynaklar) ve `AGENTS.md` ona referans verir.
  Ardından `AGENTS.md` ve mimari doküman glob'u gelir.
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

---

## Çapraz ekosistem denetim çağrısı

Plan kapısı sahibi yalnız OpenCode'da üretilmişse başka bir ekosistemdeki oturum onu şu
komutla çağırır:

```
opencode run
```

- Prompt **stdin**'den gider: geçici bir dosyaya yazılıp yönlendirilir; plan metni
  hiçbir zaman bir kabuk dizesine konmaz.
- **`--agent` verilmez.** Rol prompt'a gömülür — üç ekosistemde tek kod yolu, tek hata
  biçimi. `--agent` vermek burada özellikle tehlikelidir: agent'ın kendi
  konfigürasyonunu yükler, dolayısıyla `permission.edit`'ini de. Yukarıdaki
  *`writesCode: false` tek başına `deny` demek değildir* notu tam olarak bu yüzden
  önemli — bir doküman sahibi meşru biçimde `workspace-write`'tır ve `edit: allow`
  alır. `--agent architect` demek, denetleyiciye yazma izni vermek demektir.
  Konfigürasyon yüklenmediği için `opencode_model` ve variant ayarları da
  **uygulanmaz**; çağrı OpenCode'un o oturumdaki varsayılanıyla koşar.
- **Salt-okunurluk OpenCode'da CLI ile zorlanamıyor.** `opencode run`'da salt-okunur
  bayrağı yok; tersi var (`--dangerously-skip-permissions`). Bunu "sandbox engeller"
  diye yazma — engellemiyor. Kalan koruma **sözleşmeseldir**: `--agent` verilmediği
  için izin verici rol konfigürasyonu yüklenmez, çekirdeğin *"`.agent-work/` altına
  yalnız sen yazarsın"* kuralı geçerlidir ve kaydı yalnız çağıran yazar. Bu, **kaydın
  bütünlüğünü** korur; hedefin depoya hiç dokunamayacağını garanti etmez.
- Manifest'te `planGate.cli.opencode` varsa `opencode` yerine o yol kullanılır;
  **argümanlar değişmez** — override yalnız çalıştırılabilir dosyanın yoludur.
