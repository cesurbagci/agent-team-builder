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
model: <opus | sonnet | haiku>
memory: project
color: <purple | blue | green | red | yellow | ...>
---
```

- `tools`: reviewer/doc-only roller `Read, Grep, Glob` (+reviewer için `Bash`). writesCode
  developer'lar `Read, Grep, Glob, Write, Edit, Bash`. architect doc yazdığı için
  `Read, Grep, Glob, Write, Edit, Bash` ama production koda yazmaz (gövdede netleştirilir).
- `model`, `color`: manifest `agents[].model` / `agents[].color`.
- `memory: project` her zaman (per-agent memory disiplini, anayasa preset 3).
- Codex-özel metadata (`model_reasoning_effort`, `sandbox_mode`, `nickname_candidates`,
  `targets`, `extra_instructions`) **frontmatter'a girmez** — manifest'te tutulur, Codex
  TOML'una yansır.

---

## Gövde bölümleri (sırayla)

### `# <Rol Başlığı>` + giriş paragrafı
Projenin stack'ini ve agent'ın domain'ini özetleyen 2-4 cümle. writesCode=false ise burada
**"Production kodu YAZMAZSIN"** net belirtilir.

### `## Rol & Sınırlar`
- Ne yapar, ne yapmaz.
- `writesCode=false` → **"Kod yazma"** net madde (architect: "**tüm `docs/` dizinine yetkiliyim**, tüm dokümantasyonun sahibiyim; production koduna yazmam, sadece okurum"; reviewer: "kod yazmam, dosya değiştirmem, yalnız rapor üretirim").
- `writesCode=true` → "Sadece kendi domain'imde kod yazarım; `docs/` altına yazmam (orası architect'in)".

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
  **architect → tüm `docs/` dizini**; reviewer → hiçbiri).
- **Yasak:** yalnız okuduğu yollar. architect için tüm production kod yolları "sadece
  okurum". developer için diğer domainler + `docs/` (orası architect'in). reviewer için
  "her şeyi okurum, hiçbir şeye yazmam".

### `## Kod-Doküman Senkronizasyonu` *(anayasa preset 2 açıksa)*
manifest `codeDocSync[]` tablosu: `<kod yeri> → <beklenen doküman>`. Eksikse reviewer için
**Kritik**. architect: doc tarafını ben güncellerim; bir karar kod + doc + (bağlayıcıysa)
ADR üçü tamamlanmadan "bitti" sayılmaz. developer: kod kontratı değiştiyse ilgili dokümanın
güncellenmesi için architect'e sevk eder.

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
- architect → "Tüm `docs/` dizinine yetkilisin (tüm dokümantasyon); production koduna yazma. ADR varsa yeniden karar verme."
- reviewer → "Hiç kod yazma, hiç düzeltme; read-only."
- Belirsiz tavsiye verme; kararı netleştir (architect). Raporu kısa tut (reviewer).
- `extra_instructions[]` maddeleri burada veya ilgili bölümde yer alır.

---

## writesCode ve enforcement çevirisi (özet)

| manifest | gövdeye yansıma |
|---|---|
| `writesCode: false` | Rol & Sınırlar + Kısıtlar'da **"Kod yazma"** net; Çalışma klasörü dar (architect: `<arch-root>/`; reviewer: yok). |
| `writesCode: true` | Çalışma klasörü = kendi domain kod yolları; Yasak = diğer domain + `<arch-root>/`. |
| `skills[].enforcement: mandatory` | `## Zorunlu Skill'ler` altında **MUTLAKA** emir kipi. |
| `skills[].enforcement: when-needed` | `## Gerektiğinde Skill'ler` altında öneri dili. |
| `consults: [architect]` | `## Routing & Danışma`'da "mimari belirsizlikte architect'e sevk". |
| `model` | frontmatter `model:` (tipik: architect/reviewer `opus`, developer `sonnet`). |

## Reviewer'a özel: `## Denetim Eksenleri`

`reviewer` (ve `security`) rolünün gövdesine, **neyi denetleyeceğini** sıralayan bir
`## Denetim Eksenleri` bölümü eklenir. Bu liste şunlardan üretilir:
- **Her zaman:** görev eksiksizliği (kullanıcı isteği karşılandı mı), mimari standart/ADR uyumu, routing ihlali.
- **Açık anayasa presetlerinden:** no-workaround (otomatik Kritik), kod-doc senkronizasyonu (otomatik Kritik), yorum/dil standardı.
- **Seçili kalite odaklarından** (`manifest.focus[]`, `quality-dimensions.md`): performans · kod tasarımı (dosya/fonksiyon boyutu, DRY, nesting) · UI/UX · erişilebilirlik · güvenlik · test/coverage. Her odak için o dosyadaki "Reviewer ekseni" maddeleri yazılır.
- **Kısıtlardan:** `docs/<arch-root>/constraints/*` (örn. file-size eşiği) → ihlal = bulgu.

Her eksende bulgu seviyesi (Kritik/Uyarı/Öneri) belirtilir.

## Notlar

- Anayasa presetleri kapalıysa ilgili bölümler atlanır (örn. preset 3 kapalı → `## Memory`
  yok). Bkz. `constitution.md`.
- `manifest.focus[]` boşsa reviewer yalnız "her zaman" + anayasa eksenlerini denetler.
- Bu kalıp `member-template.md`'deki "agent-source md yaz" adımının çıktısıdır.
- Aynı md, codex hedefli agent'larda `.codex/agent-definitions/<name>.md` olarak verbatim
  kopyalanır; Codex frontmatter'ı yok sayar. Bkz. `codex-target.md`.
