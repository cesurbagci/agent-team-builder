# Proje-Farkında Skill Önerisi

> Referans doküman. Bir üye eklenirken o role uygun skill'leri önerme rutini.
> Manifest hedefi `.agent-source/agents/manifest.json` → `agents[].skills`. Bkz. `member-template.md`.

Bu rutin **her üye için ayrı ayrı** çalışır (member-template.md'den çağrılır): her agent
kendi `agents[].skills` listesini alır; bir skill bir agent'ta `mandatory`, başka agent'ta
`when-needed` olabilir veya hiç olmayabilir.

Bir üye eklenirken, o role uygun skill'leri öner. **İki kaynaktan da öner:**
(1) projede/kullanıcıda **zaten yüklü** olanlar, (2) **public / community'si yüksek**
olup henüz yüklü olmayanlar. Sadece yüklülerle sınırlı kalma.

> **Kurulumu tekrarlama:** Aynı public skill birden çok agent'a seçilirse **bir kez kur**,
> sonra her agent'ın manifest'ine ekle. Zaten kurulu (veya bu oturumda kurulmuş) bir skill'i
> yeniden indirme.

## Adımlar

1. **Projeyi analiz et:** paket/manifest dosyaları (package.json, *.csproj, pubspec.yaml, Cargo.toml, go.mod, requirements.txt, *.xcodeproj, build.gradle ...), dizin desenleri, dil/framework izleri. Rolün domain'ini + stack'i çıkar.

2. **Yüklü skill'leri tara:** `ls ~/.claude/skills/`, proje `.claude/skills/`, varsa repo `.agents/skills/`. Role/stack'e uyanları **"✅ Zaten yüklü"** olarak işaretle.

3. **Public/popüler skill ara (ATLAMA):** role + stack için yüklü olmayan ama değerli, community'si yüksek skill'leri öner.
   - **WebSearch/WebFetch varsa kullan:** güncel popüler skill'leri ara (örn. "claude code skills <stack>", GitHub `awesome-claude-code`/skill repoları, marketplace'ler). Yıldız/indirme gibi popülerlik sinyali varsa belirt.
   - **Yoksa aşağıdaki bilinen kataloğu kullan** (fallback). Bunları **"➕ Public — kurman gerekir"** olarak işaretle ve **nereden alınacağını** söyle (örn. ECC "Everything Claude Code" paketi, `anthropic-skills` eklentisi, ilgili GitHub reposu).

4. **Her skill'i KAYNAĞIYLA göster — ZORUNLU FORMAT.** Bu rutin her agent için ayrı çalışır. **Hiçbir skill'i yalnız isim+açıklama ile gösterme** — her satırda **kaynak/adres** OLMAK ZORUNDA. Public skill öneriyorsan ve WebSearch açıksa **adresi MUTLAKA ara ve yaz**; bulamıyorsan o skill'i "kaynak doğrulanmalı" diye işaretle ama yine de adres alanını boş bırakma.

   **Her skill tam olarak şu formatta (iki satır):**
   ```
   • <skill-adı> — <bu projede ne işe yarar (tek cümle)>
     Kaynak: <✅ ~/.claude/skills/<name>  |  [owner/repo](https://github.com/owner/repo)  |  marketplace/eklenti adı>
   ```
   - **yüklü** → `Kaynak: ✅ ~/.claude/skills/<name>` (kurulu yol).
   - **public (yüklü değil)** → `Kaynak:` satırına **tıklanabilir tam adres** (markdown link `[owner/repo](https://github.com/owner/repo)`; WebSearch'ten bulduysan URL'i birebir) ya da marketplace/eklenti adı.

   **Sonra her skill için TEK TEK seçtir** (tekli seçim, 3 seçenek; alan adı/jargon gösterme):
   **Zorunlu (her zaman) · Gerektiğinde · Ekleme.** Önceden "her zaman/gerektiğinde" diye atama YAPMA — kullanıcı seçer.

   > **Asla yapma:** skill'leri sadece "isim — açıklama" listesi olarak sunmak; kaynak satırını atlamak; zorunluluk seçimini kullanıcıya bırakmadan önceden atamak. Üçü de zorunludur.

5. **Seçilenleri OTOMATİK KUR** (`autoInstall`):
   Kullanıcı işaretleyince, yüklü olmayan her seçili skill'i kur:
   1. **Scope sor (bir kez):** kullanıcı seviyesi `~/.claude/skills/` mi, proje `.claude/skills/` mi? (Varsayılan: kullanıcı seviyesi — her projede kullanılsın.)
   2. **git kaynağı için:**
      ```bash
      tmp="$(mktemp -d)"
      git clone --depth 1 <git-url> "$tmp"
      # SKILL.md içeren dizini bul (repo kökü ya da skills/<name>/ olabilir)
      src="$(dirname "$(find "$tmp" -name SKILL.md | head -1)")"
      dest="<scope>/<skill-name>"            # ~/.claude/skills/<name> veya .claude/skills/<name>
      rm -rf "$dest" && mkdir -p "$dest" && cp -R "$src/." "$dest/"
      rm -rf "$tmp"
      test -f "$dest/SKILL.md" && echo "kuruldu: $dest"
      ```
   3. **marketplace/eklenti kaynağı için:** ilgili kurulum yolunu uygula (ör. plugin/marketplace komutu) ya da kullanıcıya tek satırlık komutu ver; kurulumdan sonra SKILL.md varlığını doğrula.
   4. **Kurulum başarısızsa** kullanıcıyı bilgilendir; skill yine de manifest'e eklenebilir (kurulunca aktif olur) ya da atlanır — kullanıcı karar verir.
   5. Kurulan skill'in adını (SKILL.md frontmatter `name`) doğrula; agent'a bu adla atanır.
   - **Güvenlik:** `git clone` harici bir adresten kod indirir — kaynağı kullanıcıya göster ve onayını al, rastgele adresten sessizce kurma.

## Bilinen public skill kataloğu (fallback — stack'e göre uyarla)

| Domain / stack | Önerilebilecek skill'ler | Tipik kaynak |
|---|---|---|
| Frontend (React/Vue/Next/SwiftUI) | `frontend-design`, `frontend-patterns` | ECC / anthropic-skills |
| Backend (Node/Express/Nest) | `backend-patterns`, `api-design`, `nestjs-patterns` | ECC |
| Python | `python-patterns`, `python-testing`, `django-patterns` | ECC |
| Go | `golang-patterns`, `golang-testing` | ECC |
| Rust | `rust-patterns`, `rust-testing` | ECC |
| Kotlin/Android/KMP | `kotlin-patterns`, `kotlin-testing`, `android-clean-architecture` | ECC |
| Dart/Flutter | `dart-flutter-patterns` | ECC |
| Swift/Apple | `swift-architecture-performance` | ECC |
| Java/Spring | `springboot-patterns`, `springboot-tdd` | ECC |
| Laravel/PHP | `laravel-patterns`, `laravel-tdd` | ECC |
| Test/QA | `tdd-workflow`, `e2e-testing` | ECC / superpowers |
| Review | `code-review`, `security-review` | ECC |
| MCP server | `mcp-builder` (`mcp-server-patterns`) | anthropic-skills / ECC |
| Mimari/ADR | `architecture-advisor` | bu team-builder ailesi |

> Katalog sabit değil; gerçek öneri proje stack'ine göre seçilir. Tespit edilen stack'le
> alakasız skill önerme (YAGNI).

## Örnek rol eşleştirmeleri (başlangıç)
- frontend developer → `frontend-design` (mandatory), `frontend-patterns` (when-needed)
- backend developer → `backend-patterns`, `api-design`
- reviewer → `code-review` (+ güvenlik kritikse `security-review`)
- QA → `tdd-workflow`, `e2e-testing`
- architect → `architecture-advisor`

## Her skill için zorunluluk seviyesi (MUTLAKA sor — sade dille)
- **"her zaman kullan"** (`mandatory`) → agent md'sine emir kipiyle: "Bu tür görevlerde <skill>'i MUTLAKA kullan."
- **"gerektiğinde"** (`when-needed`) → öneri diliyle: "Gerektiğinde <skill>'e başvur."

> Kullanıcıya `mandatory`/`when-needed` terimini gösterme; "her zaman mı, gerektiğinde mi?" diye sor.

Manifest'e (`.agent-source/agents/manifest.json` → `agents[].skills`) `{ name, enforcement }`
olarak yaz. Bu alan `agent-md-rich.md` kalıbındaki "Zorunlu/Gerektiğinde Skill'ler"
bölümlerini besler.
