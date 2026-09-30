# Proje-Farkında Skill Önerisi

> Referans doküman. Bir üye eklenirken o role uygun skill'leri önerme rutini.
> Manifest hedefi `.agent-source/agents/manifest.json` → `agents[].skills`. Bkz. `member-template.md`.

Bu rutin **her üye için ayrı ayrı** çalışır (member-template.md'den çağrılır): her agent
kendi `agents[].skills` listesini alır; bir skill bir agent'ta `mandatory`, başka agent'ta
`when-needed` olabilir veya hiç olmayabilir.

Bir üye eklenirken, o role uygun skill'leri öner. **İki kaynaktan da öner:**
(1) projede/kullanıcıda **zaten yüklü** olanlar, (2) **public / community'si yüksek**
olup henüz yüklü olmayanlar. Sadece yüklülerle sınırlı kalma.

> **Kopyalamayı tekrarlama:** Aynı skill birden çok agent'a seçilirse projeye **bir kez**
> kopyala, sonra her agent'ın manifest'ine ekle. Zaten `.agent-source/skills/` altında olan
> (veya bu oturumda kopyalanmış) bir skill'i yeniden indirme.

## Adımlar

1. **Projeyi analiz et:** paket/manifest dosyaları (package.json, *.csproj, pubspec.yaml, Cargo.toml, go.mod, requirements.txt, *.xcodeproj, build.gradle ...), dizin desenleri, dil/framework izleri. Rolün domain'ini + stack'i çıkar.

2. **Yüklü skill'leri tara — kullanılan araca göre TÜM global dizinleri gez**, yalnız Claude'unkini değil:
   - `~/.claude/skills/` (Claude Code; **OpenCode da bu dizini native okur**)
   - `~/.config/opencode/skills/` ve `~/.agents/skills/` (OpenCode)
   - `~/.codex/skills/` (Codex)
   - proje içi: `.claude/skills/`, `.opencode/skills/`, `.agents/skills/`

   - plugin'lerin skill'leri: `~/.claude/plugins/cache/`, `~/.codex/plugins/cache/`
   - projenin kendi kaynağı: `.agent-source/skills/`

   Olmayan dizinleri sessizce atla. Role/stack'e uyanları **"✅ Zaten yüklü"** olarak işaretle.
   Yüklü olması projeye kopyalanmayacağı anlamına gelmez: seçilirse 5. adımda kopyalanır.

3. **Public/popüler skill ara (ATLAMA):** role + stack için yüklü olmayan ama değerli, community'si yüksek skill'leri öner.
   - **WebSearch/WebFetch varsa kullan:** güncel popüler skill'leri ara (örn. "claude code skills <stack>", GitHub `awesome-claude-code`/skill repoları, marketplace'ler). Yıldız/indirme gibi popülerlik sinyali varsa belirt.
   - **Yoksa aşağıdaki bilinen kataloğu kullan** (fallback). Bunları **"➕ Public — kurman gerekir"** olarak işaretle ve **nereden alınacağını** söyle (örn. ECC "Everything Claude Code" paketi, `anthropic-skills` eklentisi, ilgili GitHub reposu).

4. **Her skill'i KAYNAĞIYLA göster — ZORUNLU FORMAT.** Bu rutin her agent için ayrı çalışır. **Hiçbir skill'i yalnız isim+açıklama ile gösterme** — her satırda **kaynak/adres** OLMAK ZORUNDA. Public skill öneriyorsan ve WebSearch açıksa **adresi MUTLAKA ara ve yaz**; bulamıyorsan o skill'i "kaynak doğrulanmalı" diye işaretle ama yine de adres alanını boş bırakma.

   **Her skill tam olarak şu formatta (iki satır):**
   ```
   • <skill-adı> — <bu projede ne işe yarar (tek cümle)>
     Kaynak: <✅ <bulunduğu kurulu yol>  |  [owner/repo](https://github.com/owner/repo)  |  marketplace/eklenti adı>
   ```
   - **yüklü** → `Kaynak: ✅ <skill'i bulduğun gerçek yol>` (örn. `~/.claude/skills/<name>` ya da `~/.config/opencode/skills/<name>`) — Claude yolunu varsayma, Adım 2'de nerede bulduysan onu yaz.
   - **public (yüklü değil)** → `Kaynak:` satırına **tıklanabilir tam adres** (markdown link `[owner/repo](https://github.com/owner/repo)`; WebSearch'ten bulduysan URL'i birebir) ya da marketplace/eklenti adı.

   **Sonra her skill için TEK TEK seçtir** (tekli seçim, 3 seçenek; alan adı/jargon gösterme):
   **Zorunlu (her zaman) · Gerektiğinde · Ekleme.** Önceden "her zaman/gerektiğinde" diye atama YAPMA — kullanıcı seçer.

   > **Asla yapma:** skill'leri sadece "isim — açıklama" listesi olarak sunmak; kaynak satırını atlamak; zorunluluk seçimini kullanıcıya bırakmadan önceden atamak. Üçü de zorunludur.

5. **Seçilenleri PROJEYE KOPYALA** — nerede bulunmuş olursa olsun:
   Seçilen her skill `.agent-source/skills/<ad>/` altına kopyalanır; global dizine **kurulmaz**,
   kapsam sorulmaz. Sync onu hedeflenen araçların proje dizinlerine (`.agents/skills/`, varsa
   `.claude/skills/`, `.opencode/skills/`) yansıtır. Skill'ler böylece repoyla gelir: takım
   arkadaşının bir şey kurması gerekmez, herkes aynı sürümü kullanır.
   1. **Zaten `.agent-source/skills/<ad>/` varsa** kopyalama; aynı skill birden çok agent'a
      seçildiyse de bir kez kopyala.
   2. **Kopyalamayı betik yapar** — elle `cp` kullanma:
      ```bash
      node "<bu dosyanın klasörü>/copy-skill.mjs" "<skill klasörü>" "<proje>"
      ```
      `<bu dosyanın klasörü>` team-builder'ın ortak klasörüdür (setup'taki
      `${CLAUDE_SKILL_DIR}/../team-builder-shared`). Betik:
      - `.git`'i atlar (proje iç içe bir repo kaydetmez);
      - skill klasörünün **içini** gösteren bir bağı gerçek dosyaya çevirir (sync bağ yansıtmaz),
        **dışını** gösteren bir bağda durur ve hiçbir şey kopyalamaz — dış dosya repoya giremez;
      - hedefi SKILL.md'deki `name`'den kurar; `.agent-source/skills/<ad>/` zaten varsa dokunmaz;
      - SKILL.md skill klasörünün dışına (`../`) atıf yapıyorsa `!` ile uyarır.
   3. **Yüklü skill** (Adım 2'de bulduğun yol — global, proje içi ya da bir plugin'in önbelleği):
      o klasörü betiğe ver.
   4. **Public skill (git kaynağı):** kaynağı göster, onay al; geçici bir klasöre
      `git clone --depth 1 <git-url> "$tmp"` yap, SKILL.md içeren klasörü seç (birden çok varsa
      kullanıcıya sor), onu betiğe ver, sonra geçici klasörü sil. **Marketplace/eklenti
      kaynağı:** önce kullanıcıya kurdur, kurulan skill klasörünü betiğe ver.
   - **`!` … outside the skill uyarısı:** o skill paketinin başka yerindeki dosyalara dayanıyor
     (çoğu plugin skill'i böyledir); tek başına kopyalanınca çalışmayabilir. Kullanıcıya söyle,
     atlamayı ya da o aracın plugin'i olarak kullanmayı öner.
   5. Kopyalanan skill'in adını (SKILL.md frontmatter `name`) doğrula; agent'a bu adla atanır.
      Klasör adı frontmatter `name` ile aynı olmalı.
   6. **Kopyalama başarısızsa** kullanıcıyı bilgilendir; skill atlanır ya da sonra eklenir —
      kullanıcı karar verir.
   - **team-builder'ın kendi skill'lerini bu adımda kopyalama** (`team-builder-*`,
     `architecture-advisor`): onları setup ayrı bir soruyla, `copy-skill.mjs --team-builder` ile
     projeye koyar (Adım 8a).
   - **Aynı skill global olarak da kuruluysa** kullanıcıya söyle: Codex aynı adlı iki skill'i
     birleştirmez, ikisi de listelenir; Claude'da kişisel (global) kopya projedekini gölgeler.
     Proje kopyası yeterliyse global olanı kaldırmayı önerebilirsin — kendin silme.
   - **Yalnız metin dosyaları yansıtılır:** sync dosyaları metin olarak okuyup yazar. Skill'de
     görsel gibi ikili dosyalar varsa proje kopyalarında bozulurlar; betikler çalıştırma iznini
     kaybeder (`bash betik.sh` ile çalışır). Böyle bir skill seçilirse kullanıcıya söyle.
   - **Lisans:** üçüncü taraf bir skill repoya girer. Klasördeki LICENSE dosyası kopyayla gelir;
     yoksa kullanıcıya lisansı kontrol etmesini söyle.
   - **Güvenlik:** `git clone` harici bir adresten kod indirir ve bu kod repoya girer — kaynağı
     kullanıcıya göster ve onayını al, rastgele adresten sessizce kopyalama.

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
| Test | `test-driven-development`, `tdd-workflow`, `e2e-testing` | superpowers / ECC |
| Review | `code-review`, `security-review` | ECC |
| MCP server | `mcp-builder` (`mcp-server-patterns`) | anthropic-skills / ECC |
| Mimari/ADR | `architecture-advisor` | bu team-builder ailesi |

> Katalog sabit değil; gerçek öneri proje stack'ine göre seçilir. Tespit edilen stack'le
> alakasız skill önerme (YAGNI).

## Örnek rol eşleştirmeleri (başlangıç)
- frontend developer → `frontend-design` (mandatory), `frontend-patterns` (when-needed)
- backend developer → `backend-patterns`, `api-design`
- **kod yazan her rol** (developer'lar, database-engineer) → TDD skill'i
  (`test-driven-development` ya da `tdd-workflow`) + stack'in test skill'i (`springboot-tdd`,
  `python-testing` …), **gerektiğinde** — testlerini kendileri yazar
- reviewer → `code-review` (+ güvenlik kritikse `security-review`); test skill'i gerekmez,
  testleri denetler ama yazmaz
- QA (yalnız ayrı e2e alanı varsa) → `e2e-testing`
- architect → `architecture-advisor`

## Her skill için zorunluluk seviyesi (MUTLAKA sor — sade dille)
- **"her zaman kullan"** (`mandatory`) → agent md'sine emir kipiyle: "Bu tür görevlerde <skill>'i MUTLAKA kullan."
- **"gerektiğinde"** (`when-needed`) → öneri diliyle: "Gerektiğinde <skill>'e başvur."

> Kullanıcıya `mandatory`/`when-needed` terimini gösterme; "her zaman mı, gerektiğinde mi?" diye sor.

Manifest'e (`.agent-source/agents/manifest.json` → `agents[].skills`) `{ name, enforcement }`
olarak yaz. Bu alan `agent-md-rich.md` kalıbındaki "Zorunlu/Gerektiğinde Skill'ler"
bölümlerini besler.
