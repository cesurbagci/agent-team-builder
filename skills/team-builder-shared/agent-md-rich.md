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

> **Sahiplik tek kaynaktadır.** Hangi yolun kimin olduğu yalnız `manifest.routing[]`'te ve
> onun `instructions.md`'deki routing tablosunda yazar; kod–doküman eşleştirmesi yalnız
> `manifest.codeDocSync[]`'te ve `c:codeDocSync` bloğunun tablosunda. Rol dosyası bunları
> **kopyalamaz**: sync rol dosyasını olduğu gibi kopyalar, bir kopya ilk sahiplik
> değişikliğinde bayatlar. Sahiplikle ilgili metin `<!-- ownership -->` …
> `<!-- /ownership -->` işaretleri arasında durur (dosyada birden çok çift olabilir). Sync,
> işaretlerin içinde bir routing satırı (`services/orders/**`, `services/orders/`, `services/gateway/docs/README.md`)
> görürse kayma sayar. Rolün kimliğini anlatan domain atfı ("yalnız bir servis için var olan
> analist") serbesttir; başka rollerin yollarını sayan cümle ve routing satırı yazılmaz.
>
> **Yalnız sahiplik cümleleri işaretlenir:** rolün hangi yollara yazabildiğini ya da yazamadığını söyleyen
> cümleler. Rolün görevi, danışılan rol adları ve iş kuralları ("kararı şu belgeye yaz",
> bir görev için okunacak belirli bir dosya) işaretlerin dışında kalır; içlerinde daha derin
> bir yol geçebilir. Başlıklar `docLanguage`'e çevrilir ve projede farklı yazılabilir —
> bölümler başlığa göre değil anlamına göre tanınır.
>
> **Okuma listeleri desenle yazılır.** Rolün okuyacağı yerler (reviewer'ın odakları, güvenlik
> rolünün gereksinim belgeleri) servis servis sayılmaz: `<servis>/docs/`, `<servis>/src/…`
> gibi bir desen kullanılır, yoksa yeni servis eklenince liste eskir. Tek servise özgü bir rol
> o servisin adını kimliği gereği anabilir.
>
> **Genel metin projenin koşulunu düşürmez.** Proje bir kuralı koşula bağlamışsa ("yalnız
> anlatılan davranış etkilenirse") rol metni onu daha katı hâle getirmez; koşul ya aynen
> durur ya da yaşadığı yere (`instructions.md`'deki blok) atıf yapılır.

### `## Rol & Sınırlar`
```
- <Ne yapar, ne yapmaz — rolün işi, yol yok.>
<!-- ownership -->
- Yazma alanın, `instructions.md`'deki routing tablosunda rolüne atanmış yollardır. Bir dosya
  birden çok satıra uyarsa en özgül yol kazanır. Diğer yolları yalnız oku; değişiklik
  gerekiyorsa lider üzerinden sahibine yönlendir.
<!-- /ownership -->
```
- `writesCode=false` → ilk maddeye **"Kod yazma"** eklenir. Routing'de yolu olmayan rol
  (reviewer, security) için ikinci madde: "Hiçbir dosyayı değiştirme; yalnız oku ve rapor
  üret."
- `writesCode=true` → "Kendi alanında kod yazarsın."

### `## Memory` *(anayasa preset 3 açıksa)*
> Canonical memory dizinin `.agent-memory/<name>/` altındadır. Göreve başlamadan önce varsa
> `MEMORY.md` dosyasını oku. Kalıcı yeni bilgi oluşursa aynı dizinde ayrı Markdown dosyası
> ekle/güncelle; `MEMORY.md` index olarak tutulur. `.claude/agent-memory/` ve
> `.codex/agent-memory/` altına yazma.

### `## Sorumluluk Alanı`
Agent'ın domain(ler)i **sözle**: ne tür işler, hangi kontratlar (ör. "süreç motoru: görevler,
geçişler, zamanlayıcılar"). Yol listesi **yazılmaz**. İşaretli tek cümle:
```
<!-- ownership -->
Birincil kod kaynakların routing tablosunda rolüne atanmış yollardır.
<!-- /ownership -->
Birincil bilgi kaynağın koddur; doküman kodu açıklar, yerine geçmez.
```
Yolu olmayan salt-okunur rol (reviewer, security): işaretli cümle "Yazma alanın yoktur;
bütün yolları yalnız okursun." olur.

### `## Çalışma / Yasak Klasörleri`
Ayrı bir yol listesi **yoktur**; bölüm ya hiç yazılmaz ya da tek işaretli cümledir:
```
<!-- ownership -->
Çalışma ve yasak yolların routing tablosundan çözülür: rolüne atanmış yollara yazarsın,
gerisini yalnız okursun.
<!-- /ownership -->
```
Yolu olmayan salt-okunur rol: "Hiçbir dosyayı değiştirme; bütün yolları yalnız okursun."

### `## Kod-Doküman Senkronizasyonu` *(anayasa preset 2 açıksa)*
```
<!-- ownership -->
Kod–doküman eşleştirmeleri `instructions.md`'deki kod–doküman bölümündedir. Kod sahibi
eşleşen dokümanın etkilendiğini bildirir; dokümanı sahibi günceller.
<!-- /ownership -->
```
Eşleştirme tablosu rol dosyasına **kopyalanmaz**. Role göre ek (yol yok): architect
**varsa** — architect: "Bir karar kod + doküman + (bağlayıcıysa) ADR üçü tamamlanmadan bitti
sayılmaz."; developer: "Kod kontratı değiştiyse dokümanın güncellenmesi için architect'e
sevk et." Architect **yoksa** bu iki cümle yazılmaz; doküman güncellemesi kod değişikliğini
yapan rolün işidir. Eksik doküman reviewer için **Kritik**.

**Doküman standardı (her agent md'sine yazılır, işaretlerin dışında):** Mimari dokümanlar `docs/<arch-root>/templates/doc-standard.md` standardına göredir.
- **architect:** ADR/kısıt/tasarım yazarken `templates/{adr,constraint,design}.md` şablonlarını kullanır; başka format uydurmaz.
- **tüm roller (okuma):** bir konuda karar/kuralı `doc-standard.md`'deki okuma sırasıyla bulur (README index → ilgili domain → adr/constraints; Status + Karar + Sonuçlar bölümleri bağlayıcıdır).

### `## Routing & Danışma`
```
<!-- ownership -->
- Sahipliği `instructions.md`'deki routing tablosundan çöz; en özgül yol kazanır. Tabloyu
  atlayan doğrudan kod yazımı mimari ihlaldir; kendi alanının dışındaki işi lider üzerinden
  sahibine yönlendir.
<!-- /ownership -->
```
- **Danışma:** `consults[]` varsa rol adlarıyla "Şu durumlarda `<consult>` rolüne danış/sevk
  et" (developer → architect: mimari karar, yeni API yüzeyi, breaking change, kanal
  belirsizliği; reviewer → "mimarı ben çağırmam, Mimar'a Sevk listesine yazarım"). Rol
  adları sahiplik değildir; işaretlerin dışında kalabilir.

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
- writesCode=false → "Production koda yazma; sadece okursun." (yol sayma)
- architect → "Production koduna yazma. ADR varsa yeniden karar verme."
- reviewer → "Hiç kod ya da test yazma, hiç düzeltme; read-only. Eksik testi kodun sahibine bildir."
- kod yazan her rol (developer, database-engineer) → "Kendi kodunun testlerini sen yaz ve çalıştır; önce başarısız test." Testleri başka bir role yönlendiren cümle yazma.
- Belirsiz tavsiye verme; kararı netleştir (architect). Raporu kısa tut (reviewer).
- `extra_instructions[]` maddeleri burada veya ilgili bölümde yer alır. Bu maddelerde de
  routing satırı geçmez (sync manifest'te de arar); daha derin, rolün işini tarif eden yol
  (`services/gateway/docs/<api>/sources/`) serbesttir.

---

## writesCode ve enforcement çevirisi (özet)

| manifest | gövdeye yansıma |
|---|---|
| `writesCode: false` | Rol & Sınırlar + Kısıtlar'da **"Kod yazma"** net. Yazma alanı routing tablosuna atıfla, yol sayılmadan; yolu olmayan rol: "hiçbir dosyayı değiştirme". |
| `writesCode: true` | "Kendi alanında kod yazarsın" + routing tablosu cümlesi. Başka rollerin yolları **sayılmaz**; Codex `developer_instructions`'daki doküman yasakları sync'te routing'den üretilir. |
| `skills[].enforcement: mandatory` | `## Zorunlu Skill'ler` altında **MUTLAKA** emir kipi. |
| `skills[].enforcement: when-needed` | `## Gerektiğinde Skill'ler` altında öneri dili. |
| `consults: [architect]` | `## Routing & Danışma`'da "mimari belirsizlikte architect'e sevk". Liste **boşsa** (architect yoksa) "mimari belirsizlikte **kullanıcıya sor**". |

## Reviewer'a özel: `## Denetim Eksenleri`

`reviewer` (ve `security`) rolünün gövdesine, **neyi denetleyeceğini** sıralayan bir
`## Denetim Eksenleri` bölümü eklenir. Bu liste şunlardan üretilir:
- **Her zaman:** görev eksiksizliği (kullanıcı isteği karşılandı mı), mimari standart/ADR uyumu, routing ihlali, değişen davranışın kodun sahibince yazılmış testlerle kapsanması.
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
