# Zengin Agent md Gövde Kalıbı

> Referans doküman. `.agent-source/agents/<name>.md` dosyasının (zengin agent md)
> frontmatter + gövde kalıbını tanımlar. Bu md hem `.claude/agents/<name>.md` olarak
> hem de (codex hedefliyse) `.codex/agent-definitions/<name>.md` verbatim kopyası olarak
> üretilir — bkz. `codex-target.md`.
> Referans agent md örnekleri: `.claude/agents/technical-architect.md`,
> `.claude/agents/code-reviewer.md`.

Amaç: v1'in ince "rol + governance" md'sini **zengin** gövdeye
yükseltmek. Her bölüm manifest `agents[]` alanlarından + proje analizinden doldurulur.
Tüm gövde **docLanguage** dilinde yazılır.

---

## Frontmatter (Claude)

```yaml
---
name: <name>
description: <ne zaman PROAKTİF çağrılır — docLanguage; routing/consults bağlamı dahil>
tools: <Read, Grep, Glob[, Write, Edit, Bash] — writesCode/role'e göre>
memory: project
color: <purple | blue | green | red | yellow | ...>
---
```

- `tools`: writesCode developer'lar `Read, Grep, Glob, Write, Edit, Bash`. Kod yazmayan
  roller için ölçü rol adı değil, **iki şartın birlikte sağlanması**dır: routing'de
  kendisine bir yol verilmiş **ve** `sandbox_mode` `read-only` değil. İkisi de sağlanıyorsa
  (architect, doc-writer, …) `Read, Grep, Glob, Write, Edit, Bash` alır — production koda
  yazmadıkları gövdede netleştirilir. Sağlanmıyorsa (reviewer, security-reviewer; ya da
  yolu olmayan herhangi bir doc-only rol) `Read, Grep, Glob` (+reviewer için `Bash`) alır.

  > Bu, Codex `developer_instructions`'ın ve OpenCode `permission.edit`'in kullandığı
  > **aynı** ölçüdür (`sandbox_mode`, yoksa `writesCode`). Üç hedef aynı soruya farklı
  > cevap verirse aynı rol bir yerde yazma alanı alıp başka yerde reddedilir — son üç
  > denetim turunun bulduğu hataların çoğu tam olarak buydu.
- `color`: manifest `agents[].color`. **`model:` ve `effort:` yazılmaz** — sync onları
  `llm.json`'dan çözüp üretilen Claude dosyasına ekler (`llm-config.md`); kaynak rol
  dosyasında bulunurlarsa sync durur.
- `memory: project` her zaman (per-agent memory disiplini, anayasa preset 3).
- Codex-özel metadata (`sandbox_mode`, `nickname_candidates`, `targets`,
  `extra_instructions`) **frontmatter'a girmez** — manifest'te tutulur, Codex TOML'una
  yansır.

---

## Gövde bölümleri (sırayla)

### `# <Rol Başlığı>` + giriş paragrafı
Projenin stack'ini ve agent'ın domain'ini özetleyen 2-4 cümle. writesCode=false ise burada
**"Production kodu YAZMAZSIN"** net belirtilir.

### `## Rol & Sınırlar`
- Ne yapar, ne yapmaz.
- `writesCode=false` → **"Kod yazma"** net madde. Yazma alanı **routing tablosundan** yazılır, "tüm `docs/`" gibi sabit bir ifadeyle değil (architect: "**routing'de bana verilen yollara yetkiliyim** — `<yollar>`; production koduna yazmam, sadece okurum"; reviewer: "kod yazmam, dosya değiştirmem, yalnız rapor üretirim"). Tabloda `docs/**` tek satırsa ifade "tüm `docs/`" olur; bölünmüşse (`docs/guides/**` doc-writer'da) ya da per-module satır varsa **kendi yolları** sayılır.
- `writesCode=true` → "Sadece kendi domain'imde kod yazarım." Routing'de kod yazmayan bir
  role verilmiş **her** yol için cümleye "`<yol>` altına yazmam (orası `<rol>`ün)" eklenir —
  sahip architect de olabilir doc-writer da. Böyle bir yol yoksa eklenmez.

### `## Memory` *(anayasa preset 3 açıksa)*
> Canonical memory dizinin `.agent-memory/<name>/` altındadır. Göreve başlamadan önce varsa
> `MEMORY.md` dosyasını oku. Kalıcı yeni bilgi oluşursa aynı dizinde ayrı Markdown dosyası
> ekle/güncelle; `MEMORY.md` index olarak tutulur. `.claude/agent-memory/` ve
> `.codex/agent-memory/` altına yazma.

### `## Sorumluluk Alanı`
Agent'ın domain(ler)i. Her domain için **+ Birincil kod kaynakları** alt listesi: bu role
ait kontratların yaşadığı gerçek kod yolları (proje analizinden; örn.
`packages/plugin-sdk/`, `apps/**/main/src/preload/namespaces/`). "Birincil bilgi kaynağın
koddur; doküman kodu açıklar, yerine geçmez."

### `## Çalışma / Yasak Klasörleri`
- **Çalışma:** yalnız yazabildiği yollar (writesCode=true → kendi domain kod yolları;
  **architect → routing'de kendisine verilen yollar** (tek satırsa `docs/**`, bölünmüşse yalnız kendi payı, per-module ise `modules/*/docs/**` de dahil); reviewer → hiçbiri).
- **Yasak:** yalnız okuduğu yollar. Doküman sahibi rol için tüm production kod yolları
  "sadece okurum". developer için diğer domainler — ayrıca **routing'de kod yazmayan bir
  role verilmiş her yol**, sahibinin adıyla (`docs/**` → architect, `docs/guides/**` →
  doc-writer gibi). Böyle bir yol yoksa yasak listesinde doküman yolu **yer almaz**.
  reviewer için "her şeyi okurum, hiçbir şeye yazmam".

### `## Kod-Doküman Senkronizasyonu` *(anayasa preset 2 açıksa)*
manifest `codeDocSync[]` tablosu: `<kod yeri> → <beklenen doküman>`. Eksikse reviewer için
**Kritik**. Architect **varsa** — architect: doc tarafını ben güncellerim; bir karar kod + doc + (bağlayıcıysa)
ADR üçü tamamlanmadan "bitti" sayılmaz. developer: kod kontratı değiştiyse ilgili dokümanın
güncellenmesi için architect'e sevk eder. Architect **yoksa** bu iki cümle **yazılmaz**;
doküman güncellemesi kod değişikliğini yapan rolün işidir.

**Doküman standardı (her agent md'sine yazılır):** Mimari dokümanlar `docs/<arch-root>/templates/doc-standard.md` standardına göredir.
- **architect:** ADR/kısıt/tasarım yazarken `templates/{adr,constraint,design}.md` şablonlarını kullanır; başka format uydurmaz.
- **tüm roller (okuma):** bir konuda karar/kuralı `doc-standard.md`'deki okuma sırasıyla bulur (README index → ilgili domain → adr/constraints; Status + Karar + Sonuçlar bölümleri bağlayıcıdır).

### `## Routing & Danışma`
- **Routing:** manifest `routing[]`'ten bu role atanan yollar. "Bu yollardaki işler bana
  gelir; tabloyu bypass eden doğrudan kod yazımı mimari ihlaldir."
- **Danışma:** `consults[]` varsa "Şu durumlarda `<consult>` rolüne danış/sevk et"
  (developer → architect: mimari karar, yeni API yüzeyi, breaking change, kanal belirsizliği;
  reviewer → "mimarı ben çağırmam, Mimar'a Sevk listesine yazarım").

### `## Zorunlu Skill'ler` *(enforcement=mandatory)*
`skills[]` içinde `enforcement: mandatory` olanlar **emir kipiyle**: "Bu tür görevlerde
`<skill>`'i **MUTLAKA** kullan/oku."

### `## Gerektiğinde Skill'ler` *(enforcement=when-needed)*
`skills[]` içinde `enforcement: when-needed` olanlar **öneri diliyle**: "Gerektiğinde
`<skill>`'e başvur."

### `## İletişim` *(topolojiye göre — `topologies.md`)*
- **`topology: subagent`** → "Bulgularını, sorularını ve çıktılarını lead'e (`<lead>`) raporla; lider isen işi dağıt ve sonuçları topla. Diğer rollerle doğrudan değil, lead üzerinden koordine ol."
- **`topology: native`** → "Diğer teammate'lerle **isimle doğrudan mesajlaş**; paylaşılan task list'ten işini al ve durumunu güncelle. Lead başlangıçta dağıtır ama koordinasyon peer-to-peer'dir. Kendi sorumluluğun dışındaki işi ilgili teammate'e devret."

### `## Dil Kuralları` *(anayasa preset 4 açıksa)*
- Doküman / cevap dili: `docLanguage`.
- Kod artefaktları (fonksiyon, değişken, dosya, commit, JSDoc/TSDoc tag'leri): İngilizce.
- Yorum metni `docLanguage`, tag'ler İngilizce. Karışık dil kabul edilmez.

### `## Kısıtlar`
Role özel sıkı kurallar (madde listesi):
- writesCode=false → "Asla `<kod yolları>` altına yazma; sadece okursun."
- architect → "Routing'de sana verilen yollara yetkilisin — `<yollar>`; production koduna yazma. ADR varsa yeniden karar verme." (Yolları tablodan kopyala; başka bir role verilmiş doküman yolunu kendine yazma.)
- reviewer → "Hiç kod yazma, hiç düzeltme; read-only."
- Belirsiz tavsiye verme; kararı netleştir (architect). Raporu kısa tut (reviewer).
- `extra_instructions[]` maddeleri burada veya ilgili bölümde yer alır.

---

## writesCode ve enforcement çevirisi (özet)

| manifest | gövdeye yansıma |
|---|---|
| `writesCode: false` | Rol & Sınırlar + Kısıtlar'da **"Kod yazma"** net; Çalışma klasörü dar — **routing'de o role verilen yollar** (tek `docs/**` satırı varsa "tüm `docs/`"; bölünmüşse yalnız kendi payı; reviewer: yok). |
| `writesCode: true` | Çalışma klasörü = kendi domain kod yolları; Yasak = diğer domain + **routing'de kod yazmayan bir role verilmiş her yol**, sahibinin adıyla (ölçü architect'in varlığı değil, tablodaki sahiplik: architect yoksa doc-writer'ın yolları da yazılır). Böyle bir yol yoksa yalnız diğer domainler. |
| `skills[].enforcement: mandatory` | `## Zorunlu Skill'ler` altında **MUTLAKA** emir kipi. |
| `skills[].enforcement: when-needed` | `## Gerektiğinde Skill'ler` altında öneri dili. |
| `consults: [architect]` | `## Routing & Danışma`'da "mimari belirsizlikte architect'e sevk". Liste **boşsa** (architect yoksa) "mimari belirsizlikte **kullanıcıya sor**". |

## Reviewer'a özel: `## Denetim Eksenleri`

`reviewer` (ve `security`) rolünün gövdesine, **neyi denetleyeceğini** sıralayan bir
`## Denetim Eksenleri` bölümü eklenir. Bu liste şunlardan üretilir:
- **Her zaman:** görev eksiksizliği (kullanıcı isteği karşılandı mı), mimari standart/ADR uyumu, routing ihlali.
- **Açık anayasa presetlerinden:** no-workaround (otomatik Kritik), kod-doc senkronizasyonu (otomatik Kritik), yorum/dil standardı.
- **Seçili kalite odaklarından** (`manifest.focus[]`, `quality-dimensions.md`): performans · kod tasarımı (dosya/fonksiyon boyutu, DRY, nesting) · UI/UX · erişilebilirlik · güvenlik · test/coverage. Her odak için o dosyadaki "Reviewer ekseni" maddeleri yazılır.
- **Kısıtlardan:** `docs/<arch-root>/constraints/*` (örn. file-size eşiği) → ihlal = bulgu.

Her eksende bulgu seviyesi (Kritik/Uyarı/Öneri) belirtilir.

## Plan Kapısı (yalnız `constitution.planGate: true` ise)

Kapı açıksa **her** agent md'sine kısa bir bölüm eklenir. Önce **her role yazılan temel
cümle**, sonra varsa role özel ek:

**Temel (istisnasız her agent):** "Bu projede plan kapısı açık: işler `.agent-work/`
altındaki plan dosyalarıyla yürür ve prosedürün tek otoritesi `work-plan` skill'idir.
`.agent-work/` altına doğrudan yazma — o akış senin adına kaydı tutar."

Üstüne, role göre **ek cümle**:

- **Kod yazan roller:** "Onaylanmamış bir planın işini yapma; ne yapacağın plan dosyasında
  yazar."
- **`planReviewer` ise:** "Plan denetimi sende. Planı denetler, sonucunu döndürürsün."
- **`codeReviewer` ise:** "Biten işin kod denetimi sende. Sonucunu döndürürsün."
- **Hiçbiri değilse** (kapı sahibi olmayan, kod da yazmayan bir rol — örn. doc-writer):
  ek cümle **yok**, yalnız temel cümle yazılır.

Bir agent **iki kapıya birden** sahipse (aynı ad hem `planReviewer` hem `codeReviewer`)
**iki ek cümle de** yazılır; biri diğerini elemez.

Bölüm **kısa tutulur ve prosedür tekrar edilmez** — tek otorite `work-plan` skill'idir;
aynı kuralı agent md'sinde de anlatmak drift üretir.

## Notlar

- Anayasa presetleri kapalıysa ilgili bölümler atlanır (örn. preset 3 kapalı → `## Memory`
  yok). Bkz. `constitution.md`.
- `manifest.focus[]` boşsa reviewer yalnız "her zaman" + anayasa eksenlerini denetler.
- Bu kalıp `member-template.md`'deki "agent-source md yaz" adımının çıktısıdır.
- Aynı md, codex hedefli agent'larda `.codex/agent-definitions/<name>.md` olarak verbatim
  kopyalanır; Codex frontmatter'ı yok sayar. Bkz. `codex-target.md`.
