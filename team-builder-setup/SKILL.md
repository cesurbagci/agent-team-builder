---
name: team-builder-setup
description: Bir projede governance kuralları gömülü kalıcı agent takımı konfigürasyonu kurar (bir kez çalışır; .agent-source, CLAUDE.md, .claude/agents, varsa AGENTS.md, .codex ve .opencode üretir). Soru sorarak hedef (Claude/Codex/OpenCode), topoloji, doküman dili, mimari kök, anayasa, path-routing, domain-split roller ve model/effort/skill belirler. Tetikleyiciler — "team builder", "agent takımı yapılandır", "agent takımı konfigürasyonunu kur", "governance takımı kur". Bir işi paralel takımla yaptırmak ya da native agent team başlatmak için kullanma (o, Claude'un yerleşik özelliğidir); bu skill yalnız konfigürasyon üretir, iş çalıştırmaz.
---

# Team Builder Setup (v2 Sihirbaz)

## ÖNCE: Doğru niyet mi? (yanlış tetiklenme koruması)

Bu skill **takım KONFİGÜRASYONU kurmak** içindir (bir kez; dosya üretir) — **iş yaptırmak için değil.**

- Kullanıcı bir **işi** takımla yaptırmak istiyorsa ya da **çalışan bir native agent team başlatmak** istiyorsa (ör. "şu özelliği takımla yap", yalın "takım kur/oluştur" ile bir görev kastediyorsa): **DUR, bu skill'i çalıştırma.** Kısaca söyle: "Bu, Claude'un yerleşik agent teams özelliğiyle (takımı bir göreve koşmak) yapılır; ben yalnız takım konfigürasyonunu kuran araçım. İşi anlatırsan lider takımı başlatır; takım **konfigürasyonunu** kurmak/değiştirmek istersen devam edeyim." Niyeti netleştir.
- Projede zaten kurulu takım varsa (Adım 1) edit/add/sync'e yönlendir.
- Yalnızca kullanıcı gerçekten **konfigürasyon kurmak/iskelemek** istiyorsa sihirbaza devam et.

## Genel Bakış

Bu skill, bulunulan projede **governance kuralları gömülü, çok hedefli bir agent takımı** kurar. Sihirbaz akışıyla, her adımda kullanıcıya **tek tek soru sorarak** ilerlersin. Sonuç olarak **tek bir canonical kaynak** (`.agent-source/`) üretilir; tüm hedef dosyalar (`CLAUDE.md`, `.claude/agents/*.md`; Codex seçiliyse `AGENTS.md` + `.codex/*`; OpenCode seçiliyse `AGENTS.md` + `opencode.json` + `.opencode/*`) bu kaynaktan `sync-agent-config.mjs` ile **generate** edilir.

**Temel ilke:** Hiçbir şeyi varsaymadan üretme. Önce sor → kullanıcı onaylasın/değiştirsin → sonra yaz. `.agent-source/` tek gerçek kaynaktır; generated dosyalar elle değiştirilmez, kaynaktan türetilir ve `--check` ile drift'siz tutulur.

**Ortak çekirdek referansları:** Akışın her aşaması `~/.claude/skills/team-builder-shared/` altındaki referans dosyalarına dayanır. İlgili adımda o dosyayı oku ve kuralına uy. Bu skill o dosyaları tekrar etmez; onlara yönlendirir. (Repo içi geliştirmede de aynı isimler `team-builder-shared/` altındadır.)

## Önkoşul: Ortak Çekirdek Dosyaları

Akışa başlamadan önce şu dosyaların var olduğunu doğrula. Yoksa kullanıcıyı bilgilendir (ortak çekirdek paketi kurulmamış olabilir):

- `~/.claude/skills/team-builder-shared/canonical-source.md` — `.agent-source/` çıktı mimarisi (kaynak → generate → drift).
- `~/.claude/skills/team-builder-shared/wizard-state.md` — sihirbaz durum kaydı (resume): her adımda kaydet, başka oturumda devam et.
- `~/.claude/skills/team-builder-shared/manifest-schema.md` — `agents/manifest.json` v2 şeması.
- `~/.claude/skills/team-builder-shared/governance-defaults.md` — rol bazlı varsayılan governance + model/effort + domain-split.
- `~/.claude/skills/team-builder-shared/member-template.md` — tek üye tanımlama rutini.
- `~/.claude/skills/team-builder-shared/agent-md-rich.md` — zengin agent md gövde kalıbı.
- `~/.claude/skills/team-builder-shared/skill-recommend.md` — proje-farkında skill önerisi.
- `~/.claude/skills/team-builder-shared/routing.md` — path-based zorunlu routing tablosu.
- `~/.claude/skills/team-builder-shared/constitution.md` — 4 cross-cutting anayasa preseti.
- `~/.claude/skills/team-builder-shared/quality-dimensions.md` — kalite odakları (checkbox) → kısıt + reviewer eksenleri.
- `~/.claude/skills/team-builder-shared/templates/` — mimari doküman standardı + ADR/kısıt/tasarım şablonları (`doc-standard.md`).
- `~/.claude/skills/team-builder-shared/architecture-docs.md` — mimari doküman ağacı (arch-root + layout) + MADR.
- `~/.claude/skills/team-builder-shared/codex-target.md` — Codex hedefi üretimi (TOML + agent-definitions + AGENTS.md).
- `~/.claude/skills/team-builder-shared/opencode-target.md` — OpenCode hedefi üretimi (`.opencode/agents/*.md` + opencode.json + AGENTS.md).
- `~/.claude/skills/team-builder-shared/topologies.md` — topoloji (subagent vs native agent teams) + native enablement.
- `~/.claude/skills/team-builder-shared/sync-pipeline.md` — generate algoritması + drift sözleşmesi.
- `~/.claude/skills/team-builder-shared/validate-manifest.mjs` — manifest doğrulayıcı (Node).
- `~/.claude/skills/team-builder-shared/sync-agent-config.mjs` — generator (canonical → generated, `--check` drift).

## Soru Sorma Biçimi (ÖNEMLİ — önce oku)

Sihirbaz çok sorulu; soruları **güvenle** sor:

- **Varsayılan: düz sohbet (metin) ile sor.** Çoğu cevap serbest metindir (rol adları, model seçimi, routing yolları, eşleşmeler). Kullanıcı yazarak cevaplasın. Bu en güvenli yoldur.
- **Yapılandırılmış seçim aracı (AskUserQuestion) kullanırsan KATI sınırlara uy**, yoksa "Invalid tool parameters" alırsın:
  - **Soru başına EN FAZLA 4 seçenek.** 4'ten fazla aday varsa tek soruya sığdırma.
  - Her seçenekte hem **kısa etiket** hem **açıklama** olmalı.
  - Birden çok seçilebiliyorsa `multiSelect` kullan; tek seçimse normal.
- **Rolleri CHECKBOX ile seçtir (tercih edilen), düz metin değil.** Aday rol sayısı 4'ü geçtiği için **çoklu-seçim (multiSelect) sorusunu ≤4'lük gruplara böl** (örn. Grup 1: architect, ios/web/backend-developer'lar; Grup 2: reviewer, qa, security, doc-writer). Önerilen rolleri **önceden işaretli** sun. En sonda "başka özel rol?" için tek bir serbest-metin sorusu sor. **Tabloyu/listeyi düz metin soruya çevirme** — kullanıcı kutucukları tıklayarak seçsin. (Tek tek Evet/Hayır da kabul ama checkbox tercih edilir; asla tek soruda 4+ seçenek koyma.)
- **Anayasa presetleri tam 4 kural** → tek `multiSelect` soru (4 seçenek) uygundur; ya da tek tek aç/kapa sor.
- Emin değilsen **düz metin** sor. UX'i şık yapmaya çalışırken aracı geçersiz parametreyle çağırma.
- **JARGON YASAĞI + önce açıkla:** Kullanıcıya **alan adı / teknik terim gösterme** (`codeDocSync`, `enforcement`, `glob`, `targets`, `layout` vb.). Her kavramı **önce bir cümle + somut örnekle** anlat, **sonra** sor. Kullanıcı terimi bilmiyor olabilir; "ADR nedir", "kod-doküman senkronu nedir" gibi şeyleri kısaca açıkla. Seçenekleri günlük dille ("şimdilik boş bırak", "sana taslak önereyim") yaz, kod/JSON ile değil.
- **DAHİLİ REFERANSLARI GİZLE:** Kullanıcıya **asla** "referans proje", "altın standart", dosya adı (`governance-defaults.md`, "KARAR 4") gibi iç kaynakları söyleme. Bunlar senin rehberin; kullanıcı için yalnızca **sade öneri** sun ("önerilen model: opus" yeter, gerekçe olarak iç kaynak gösterme).
- **GERÇEK WIZARD ol — toplu döküm yok:** Her adımı **tek tek, etkileşimli** ilerlet. Büyük metin tabloları basıp tek bir serbest-metin onayı isteme. Özellikle roller: **her agent'ı SIRAYLA, tek tek yapılandır** (önce rol 1'in model/effort/skill'lerini sor-onayla, sonra rol 2'ye geç). 4 rolün ayarını birden basıp "hepsi tamam mı?" deme.

## Sihirbaz Akışı (10 Adım)

Adımları **bu sırayla** uygula. Her adımda kullanıcıya sor, cevabı al, sonraki adıma geç. Varsayılanlar yalnızca öneridir; kullanıcı onaylamadan kesinleşmez.

> **DURUM KAYDI (resume) — her adımda yaz:** Bir cevap kesinleşince ilerlemeyi `.claude/team-builder-state.json`'a yaz (`~/.claude/skills/team-builder-shared/wizard-state.md` şeması). **Özellikle her agent tek tek yapılandırıldıktan sonra** kaydet — böylece kullanıcı başka bir oturumda kaldığı yerden devam edebilir. Üretim (Adım 8) bitince bu dosyayı **sil**.

### Adım 1 — Ön kontrol

1. Hedef proje kökünü tespit et (bulunulan çalışma dizini).
2. `.agent-source/agents/manifest.json` var mı bak.
   - **Varsa:** Takım zaten kurulu. Kullanıcıyı uyar: "Mevcut takıma üye eklemek için `/team-builder-add`, düzenlemek için `/team-builder-edit`, generated dosyaları tazeleyip drift kontrol için `/team-builder-sync`." Üzerine yazmayı kullanıcı açıkça istemedikçe **DEVAM ETME**.
3. Yoksa **yarım kalmış kurulum var mı bak** (`~/.claude/skills/team-builder-shared/wizard-state.md`): `.claude/team-builder-state.json` varsa → kullanıcıya sade sor: "Bu projede yarım kalmış bir takım kurulumu var (en son: <adım>, <n> rol yapılandırıldı). **Devam mı, baştan mı?**"
   - **Devam** → state'i yükle; tamamlanmış cevapları TEKRAR SORMA; kısa "şu ana kadar seçtiklerin" özeti ver; `currentStep`/`currentAgentIndex`'ten sonraki adımdan sürdür.
   - **Baştan** → state dosyasını sil, sıfırdan.
4. Hiçbiri yoksa → yeni kuruluma devam et. (Kaynak mimarisi: `~/.claude/skills/team-builder-shared/canonical-source.md`.)

### Adım 2 — Hedefler + Topoloji

İki ayrı şey sor: **(A) hangi ekosistem(ler)e** üretelim, **(B) Claude tarafında hangi takım topolojisi.**

**A) Hedef ekosistem(ler):** Sade dille sor — "Bu takımı hangi araçlar için kurayım? (birden çok seçilebilir)":
- **Claude varsayılan hedeftir** ve her zaman üretilir (`CLAUDE.md` + `.claude/agents/*.md`).
- **Codex?** EVET ise takım ek olarak `AGENTS.md` + `.codex/config.toml` + `.codex/team.md` + her codex hedefli agent için `.codex/agents/<name>.toml` ve `.codex/agent-definitions/<name>.md` ile kurulur. (Detay: `~/.claude/skills/team-builder-shared/codex-target.md`.)
- **OpenCode?** EVET ise takım ek olarak `AGENTS.md` (Codex ile paylaşılır) + `opencode.json` + `.opencode/team.md` + her opencode hedefli agent için `.opencode/agents/<name>.md` (OpenCode frontmatter + kaynak gövde) ile kurulur. (Detay: `~/.claude/skills/team-builder-shared/opencode-target.md`.)
- Manifest kök `targetsDefault`: seçilen ekosistemlerin birleşimi (örn. `["claude","codex","opencode"]`, `["claude","opencode"]`). (Üye bazında `targets` Adım 5'te daraltılabilir.)

**B) Topoloji (Claude için)** — `~/.claude/skills/team-builder-shared/topologies.md`. Kullanıcıya **sade** sor:
> "Claude tarafında agent'lar nasıl çalışsın?
> **1) subagent (önerilen):** Bir lider dağıtır, agent'lar işi yapıp lidere döner. Kararlı, ek ayar yok.
> **2) native takım (deneysel):** Agent'lar birbirine doğrudan mesajlaşıp paylaşılan görev listesiyle koordine olur. Yeni Claude Code sürümü ister, deneysel."
- Manifest kök `topology`: `subagent` (varsayılan) | `native`.
- **native seçilirse kullanıcıyı bilgilendir:** Bu deneysel bir özellik; `.claude/settings.json`'a `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (+ `teammateMode`) eklenecek ve `claude --version`'ın yeterli olması gerekir (≈v2.1.32+; flag adı sürümle değişebilir). Adım 8'de bunlar yazılır + agent md'lerin "İletişim" bölümü peer-to-peer dilinde üretilir.

### Adım 3 — Doküman dili (docLanguage)

Üretilen tüm dokümanların ve agent talimatlarının dilini belirle.

- Önce projeden **tahmin et:** mevcut `CLAUDE.md` veya `README` dilinden çıkarım yap.
- Tahminini kullanıcıya öner ("Dokümanları `tr` dilinde üreteceğim, uygun mu?"); kullanıcı onaylasın veya değiştirsin (`tr`, `en`, ...).
- `docLanguage` değerini not et (manifest köküne yazılır). Bundan sonra üretilen tüm metinler bu dilde olur; kod/dosya/commit İngilizce kalır (anayasa KARAR 4 ile uyumlu).

### Adım 4 — Mimari doküman konumu (arch-root + layout)

`~/.claude/skills/team-builder-shared/architecture-docs.md` kurallarını kullan.

**Önce kavramı SADE anlat** (kullanıcı ADR'i bilmeyebilir):
> "Mimar (architect) kod yazmaz; bunun yerine takımın **mimari kararlarını** bir klasöre yazar. İçinde:
> - **ADR** = *Mimari Karar Kaydı*: 'şu kararı şu gerekçeyle aldık' diye kısa notlar (örn. 'state için Redux yerine Zustand seçtik, çünkü…').
> - **Kısıtlar**: 'şu katman şunu yapamaz' gibi kurallar.
> - **Tasarım notları / diyagramlar.**
> Bunlar nereye yazılsın?"

- **arch-root** sor (sade): "Türkçe `docs/mimari` mı, İngilizce `docs/architecture` mı?"
- **layout** sor (sade): "Tüm kararlar tek yerde mi toplansın (**central**), yoksa her modülün kendi `docs/`'u da olsun mu (**per-module**)?"
- `per-module` seçilirse: modül listesi **SORULMAZ**; kararlar yazıldıkça organik oluşur ve "modül kararları modül altına yazılır" kuralı architect'in talimatına eklenir.
- `architectureDocs.root` ve `architectureDocs.layout` değerlerini not et (manifest köküne).

### Adım 5 — Roller (önce takımı kur — üye-üye)

> **ÖNEMLİ SIRA:** Roller, anayasa presetleri ve routing'den **ÖNCE** belirlenir. Çünkü presetler ve routing seçilen rollere atıf yapar (örn. "reviewer şunu denetler"). Kullanıcı hangi rolleri istediğini söylemeden o rollerin davranışını sorma.

`~/.claude/skills/team-builder-shared/governance-defaults.md` + `member-template.md` + `skill-recommend.md` + `agent-md-rich.md` kurallarını kullan. (Bu dosyalar SENİN rehberin; kullanıcıya **isimlerini/iç referansları gösterme** — yalnız sade öneri sun.)

1. **Önce kısa proje analizi yap** (sessizce): kod köklerini tara (`apps/*`, `modules/*`, `packages/*`, `src/*` vb.) ve **domain-split developer rolleri öner** (örn. `backend-developer`, `frontend-developer`, `extension-developer`). Bunu kullanıcıya "şu rolleri öneriyorum" diye sun.

2. **Rolleri CHECKBOX (çoklu seçim) ile seçtir**, ≤4'lük gruplara bölerek; önerilen rolleri önceden işaretli sun (bkz. "Soru Sorma Biçimi"). Örn. **Grup 1:** architect, ios/web/backend-developer'lar (analizden çıkanlar); **Grup 2:** reviewer, qa, security, doc-writer. Önce kısa bir "şu rolleri öneriyorum" özeti verip sonra checkbox'ları sun; tabloyu serbest-metin soruya ÇEVİRME. Aday/öneri sırası: 
   - **architect** (öneri: EKLE) — takım lideri (`lead`), kod yazmaz; **tüm `docs/` dizinine yetkilidir** (tüm dokümantasyonun sahibi). Mimari kararlar/ADR'ler `docs/<arch-root>/` altında toplanır ama yetkisini "docs/ dizini" diye sun, alt klasörleri tek tek sayma. Routing'de `docs/**` → architect.
   - **developer(lar)** (öneri: EKLE) — analizden önerdiğin her domain için ayrı developer (`consults: [architect]`).
   - **reviewer** (öneri: EKLE) — kod yazmaz, sadece inceler (gate).
   - **opsiyoneller:** `qa`, `security`, `doc-writer`, (UI ağırlıklıysa) `ui-developer` — her birini ayrı sor. Proje analizine göre öner: güvenlik kritikse (auth/ödeme/kişisel veri) `security`, UI ağırlıklıysa UI developer + `frontend-design` skill'i, test önemliyse `qa`. (Bu öneriler Adım 7'deki kalite odaklarıyla da örtüşür.)
   - **"Başka özel bir rol eklemek ister misin?"** — serbest rol; aynı rutin.

3. **EKLENEN her üyeyi SIRAYLA, TEK TEK yapılandır** (gerçek wizard — `member-template.md`). Bir agent'ı bitirmeden diğerine geçme; 4 rolün ayarını birden basma. Her agent için şu mini-akış:

   **(a)** "Şimdi **<rol>** rolünü ayarlıyoruz (X/N). Görevi: <tek cümle>." diye başla.
   **(b) Hedef(ler)** — Adım 2'de birden çok ekosistem seçildiyse: bu rol hangilerinde üretilsin (claude / codex / opencode / kombinasyon; varsayılan = `targetsDefault`). Tek ekosistem varsa bu soruyu atla. → manifest `targets`.
   **(c) Model(ler)** — rolün **hedeflerine göre** sor ve öner:
      - Claude veya Codex hedefliyse: **opus / sonnet / haiku** (önerilen önceden işaretli) → manifest `model`. (Codex TOML aynı değeri kullanır.)
      - OpenCode hedefliyse: **`provider/model`** formatında OpenCode modeli sor ve **öner** — `model`'e göre `anthropic/claude-opus-4` / `…claude-sonnet-4-5` / `…claude-haiku-4-5` öner; kullanıcı başka provider'a (`openai/gpt-5`, `google/gemini-2.5-pro` vb.) değiştirebilir → manifest `opencode_model`.
   **(d) Effort** sor (tekli seçim): düşük / orta / yüksek — önerilen işaretli.
   **(e) Kod yazsın mı + kime danışır** — varsayılanı söyle, onaylat/değiştir (developer → architect'e danışır; architect/reviewer kod yazmaz).
   **(f) Skill'ler** — `skill-recommend.md` §4 **ZORUNLU FORMATINA birebir uy.** Bu role uygun **yüklü + public** skill'leri öner. **Hiçbir skill'i yalnız "isim — açıklama" ile gösterme**; her skill **iki satır** olmalı:
      ```
      • <skill-adı> — <bu projede ne işe yarar>
        Kaynak: ✅ ~/.claude/skills/<name>   |   [owner/repo](https://github.com/owner/repo)   |   marketplace/eklenti
      ```
      Public skill'lerin adresini **WebSearch açıksa MUTLAKA ara ve yaz** (markdown link); bulamazsan "kaynak doğrulanmalı" işaretle ama kaynak satırını atlama.
      Sonra **her skill için TEK TEK** sor (tekli seçim 3 seçenek): **"Zorunlu (her zaman) / Gerektiğinde / Ekleme"** — önceden atama yapma, kullanıcı seçsin.
      Seçilen **yüklü-olmayan** skill'i **otomatik kur** (`skill-recommend.md` §5: scope → `git clone` → kopyala → doğrula; kaynağı gösterip onay al; tekrar indirme).
   **(g)** Bu agent'ın özetini göster, "bu rol böyle tamam mı?" diye onaylat. Onaylanınca taslağını sakla (manifest `agents[]` girişi + `agent-md-rich.md` rol talimatı; diske Adım 8'de yazılır) ve **bir sonraki role geç**.

   `lead` varsayılanı `architect`.

**Bu adım bitince her agent tek tek yapılandırılmış ve NET bir rol listesi hazır olmalı.** Sonraki iki adım yalnızca bu listeye atıf yapar.

### Adım 6 — Routing tablosu (kod yolu → rol)

`~/.claude/skills/team-builder-shared/routing.md` kurallarını kullan. **Yalnız Adım 5'te eklenen roller** kullanılabilir.

1. Proje analizine göre bir **path → rol** tablosu taslağı öner (örn. `apps/**/main/src/**` → `backend-developer`, `apps/**/renderer/src/**` → `frontend-developer`, `docs/<arch-root>/**` → `architect`).
2. Kullanıcı onaylar / düzeltir / satır ekler-siler. Onaysız satır kesinleşmez.
3. Onaylanan satırları manifest kök `routing[]`'e (`{ path, role }`) yaz. `role` mutlaka eklenen bir rol olmalı.

> Routing temel kuralı: **ajansız doğrudan kod yazma yasaktır; tabloyu bypass = mimari ihlal; şüphede architect'e danışılır.** (Generic danışma/gate kuralları her zaman korunur.)

### Adım 7 — Kalite Odakları + Anayasa

**7A) Kalite odakları (checkbox)** — `~/.claude/skills/team-builder-shared/quality-dimensions.md`.

"Bu projede hangi kalite boyutlarına özellikle odaklanalım?" diye **çoklu seçim** sun. Boyutlar: **Performans · Kod tasarımı/sürdürülebilirlik · UI/UX tasarımı · Erişilebilirlik · Güvenlik · Test/kalite.** (6 boyut > 4 seçenek limiti → **iki gruba böl** veya düz metin checklist; alan adı/jargon gösterme.) Proje analizinden öner (örn. iOS/finans → performans + kod tasarımı + test; UI ağırlıklı → UI/UX + erişilebilirlik).

Seçilenler somut çıktıya döner (`quality-dimensions.md`):
- **Reviewer'ın denetim eksenleri** seçili boyutlardan oluşur (agent-md-rich.md reviewer bölümü).
- **Somut kısıt üretilenler:** `code-design` → **büyüyen dosya yasağı** (`constraints/file-size.md`: max satır, varsayılan **800** — eşiği kullanıcıya sor; fonksiyon/nesting/DRY), `security` → secrets/girdi doğrulama kısıtı, `testing` → coverage hedefi (varsayılan %80, sor). Bu kısıtlar Adım 8'de `templates/constraint.md` standardıyla yazılır.
- **Rol/skill iması:** `security`→ security rolü + `security-review`; `ui-ux`→ UI developer + `frontend-design`/`swift-architecture-performance`; `testing`→ qa + `tdd-workflow`. Seçilen boyut için ilgili rol Adım 5'te eklenmediyse kullanıcıya hatırlat ("güvenliği seçtin ama security rolü yok — eklemek ister misin? `/team-builder-add`").
- `manifest.focus[]`'a yaz (örn. `["performance","code-design","security"]`).

**7B) Anayasa presetleri (sade dille sor)** — `~/.claude/skills/team-builder-shared/constitution.md` kurallarını kullan. Dört kuralı **default AÇIK** olarak, **sade ve günlük dille** sun; kullanıcı kapatmak istediğini seçer. **Henüz var olmayan role atıf yapma** — açıklamayı Adım 5'te seçilen takıma göre uyarla (örn. reviewer eklenmediyse "otomatik denetleyen reviewer yok, kural yine de agent talimatlarına yazılır" de).

Sade açıklama kalıbı (jargon yok):

1. **Workaround yasağı** (`noWorkaround`) — "Geçici çözüm / kestirme yasak; belirsizlikte mimara gidilir.[Reviewer varsa: Riskli kestirme desenlerini otomatik 'düzeltilmeli' işaretler.]"
2. **Kod–doküman birlikte güncellenir** (`codeDocSync`) — "Belirli kod yerleri değişince ilgili doküman aynı işte güncellenir. Hangi kod → hangi doküman eşleşmesini sana ayrıca soracağım."
3. **Her agent kendi notunu tutar** (`perAgentMemory`) — "Her rol kendi `.agent-memory/<rol>/` klasörüne not/karar yazar; birbirinin notuna karışmaz."
4. **Dil standardı** (`languageStandard`) — "Kod İngilizce; doküman, yorum ve cevap senin seçtiğin dilde (`docLanguage`)."

Açık kalan her kural için **projeye özel satırları** sor (sadece açık olanlar için):
- Workaround yasağı açıksa → varsa projeye özel yasak desenleri eklet (çekirdek liste hazır).
- Kod–doküman açıksa → **sade dille** sor (jargon/`codeDocSync`/"glob" gösterme): önce bir örnekle anlat ("`src/api/` değişince `docs/api.md` güncellenir; reviewer unutursan uyarır"), sonra "1) boş bırak (önerilen) / 2) sana taslak önereyim / 3) sen yaz" seçtir. `constitution.md`'deki soru kalıbını birebir kullan. Sonucu `manifest.codeDocSync[]`'e yaz (boş `[]` da geçerli).
- Dil standardı → `docLanguage`'den otomatik türer; ekstra üslup tercihi varsa sor.
- Her agent notu → ek satır yok (sadece aç/kapa).

Sonuçları `manifest.constitution` (+ varsa `codeDocSync[]`) alanlarına yaz.

### Adım 8 — Üretim

Tüm cevaplar toplandı; şimdi kaynağı yaz, doğrula ve generate et. Sırayla:

**8a. `.agent-source/` kaynağını yaz** (mimari: `~/.claude/skills/team-builder-shared/canonical-source.md`):

- `.agent-source/agents/manifest.json` — kök alanlar (`targetsDefault`, `topology`, `docLanguage`, `architectureDocs`, `constitution`, `focus[]`, `routing[]`, `codeDocSync[]`, `lead`) + `agents[]`; `~/.claude/skills/team-builder-shared/manifest-schema.md` şemasına birebir uygun.
- **Kalite odaklarından kısıt dosyaları** (Adım 7A, `quality-dimensions.md`): seçili boyutlardan somut olanlar için `docs/<arch-root>/constraints/<konu>.md`'yi `templates/constraint.md` standardıyla üret — örn. `code-design` → `file-size.md` (max satır eşiğiyle), `security` → `secrets.md`, `testing` → `coverage.md`.
- `.agent-source/agents/<name>.md` — her üye için zengin rol talimatı (`~/.claude/skills/team-builder-shared/agent-md-rich.md` kalıbı, docLanguage dilinde). **`İletişim` bölümü topolojiye göre yazılır** (`subagent` → lead'e raporla; `native` → peer-to-peer mesajlaş — `topologies.md`).
- `.agent-source/project/CLAUDE.md` — Claude proje talimatı kaynağı (routing + code-doc sync + anayasa + mimari kaynaklar dahil). **`topology: native` ise** ek bir "Takımı başlatma" bölümü ekle: takımın doğal dille nasıl kurulacağına dair kısa örnek (örn. "X, Y, Z rolleriyle bir agent takımı oluştur") ve teammate'lerin peer-to-peer koordine olduğu notu.
- Codex **veya** OpenCode hedefi seçildiyse: `.agent-source/project/AGENTS.md` (ikisi de native okur).
- Codex hedefi seçildiyse ayrıca: `.agent-source/project/codex-config.toml`, `.agent-source/project/codex-team.md` (`~/.claude/skills/team-builder-shared/codex-target.md`).
- OpenCode hedefi seçildiyse ayrıca: `.agent-source/project/opencode.json` (içine `"//": "generated…"` notu göm — JSON `#` header taşıyamaz; `$schema` + `instructions` [AGENTS.md + mimari docs] + `permission` default'ları) ve `.agent-source/project/opencode-team.md` (`~/.claude/skills/team-builder-shared/opencode-target.md`).
- `.agent-source/skills/<skill>/SKILL.md` — repo skill kaynakları (varsa).
- `.agent-source/README.md` — "generated'ı elleme; burayı güncelle + sync çalıştır" notu.
- Ayrıca `~/.claude/skills/team-builder-shared/architecture-docs.md`'deki "İskelet üretimi" kuralına göre `docs/<arch-root>/` iskeletini üret: `adr/` `constraints/` `design/` dizinleri + `ilkeler.md`. **README ve standart şablonları `~/.claude/skills/team-builder-shared/templates/` standardından kopyala:** `templates/architecture-readme.md` → `docs/<arch-root>/README.md`; `templates/{doc-standard.md, adr.md, constraint.md, design.md}` → `docs/<arch-root>/templates/`. Böylece dokümanlar **tek standartta** yazılır ve agent'lar bu standarda göre okur (`doc-standard.md`). per-module ise modül-docs şablonu da eklenir.

**8b. Manifest'i doğrula:**

- Önce aracın çalıştığını teyit et: `node ~/.claude/skills/team-builder-shared/validate-manifest.mjs --selftest` → `SELFTEST PASS` görmelisin.
- Sonra yazdığın `manifest.json`'u doğrula: ya küçük bir Node tek-satırıyla dosyayı parse edip `validate()` fonksiyonunu o obje ile çağır, ya da `~/.claude/skills/team-builder-shared/manifest-schema.md`'deki doğrulama kurallarına göre alan alan elle denetle (agents boş değil; her agent'ta name; targets ⊆ {claude,codex,opencode}; model ∈ {opus,sonnet,haiku}; opencode hedefli agent'ta opencode_model (provider/model) veya model var; effort ∈ {low,medium,high}; enforcement ∈ {mandatory,when-needed}; lead ve routing.role birer agent name; constitution alanları boolean).
- Hata varsa düzelt ve yeniden doğrula. Manifest geçerli olmadan **8c'ye GEÇME**.

**8c. Generate (sync):**

- `node ~/.claude/skills/team-builder-shared/sync-agent-config.mjs --root <proje-kökü>` çalıştır. Generator kaynaktan tüm generated hedefleri üretir (`CLAUDE.md`, `.claude/agents/*.md`; Codex ise `AGENTS.md` + `.codex/*`; OpenCode ise `AGENTS.md` + `opencode.json` + `.opencode/*`). Davranış sözleşmesi: `~/.claude/skills/team-builder-shared/sync-pipeline.md`.

**8d. Drift kontrolü:**

- `node ~/.claude/skills/team-builder-shared/sync-agent-config.mjs --root <proje-kökü> --check` çalıştır. `Agent configuration is in sync.` (exit 0) görmelisin. Drift varsa kaynağı düzelt → 8c → 8d tekrar; drift temizlenene kadar kullanıcıya "bitti" deme.

**8e. (Yalnız `topology: native` ise) Agent teams enablement** — `~/.claude/skills/team-builder-shared/topologies.md`:

- Bu adım **sync kapsamı dışıdır** (tek seferlik proje aç/kapa ayarı; `sync-agent-config.mjs` settings.json'a dokunmaz). Skill bunu **doğrudan ve dikkatli merge** ile yapar.
- `.claude/settings.json`'u **oku → merge → yaz** (mevcut `hooks`, `permissions` vb. anahtarları KORU; sadece ekle/güncelle):
  ```jsonc
  { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }, "teammateMode": "<in-process|tmux>" }
  ```
  `teammateMode`'u kullanıcıya sor: **`auto`** (varsayılan, ortamı algılar) · `in-process` (hepsi ana oturumda) · `tmux` (ayrı paneller, tmux/iTerm2 gerekir). Hatırlat: **takım otomatik başlamaz** — kullanıcı "şu rollerle takım kur" demeli (ya da Claude önerip onay almalı).
- `claude --version`'ı kontrol et; deneysel özelliğin desteklenmediği bir sürümse kullanıcıyı uyar (ayar yine de yazılır, sürüm güncellenince aktif olur). Flag adı/sürüm değişmiş olabilir — emin değilsen bunu söyle.
- `~/.claude/teams/` ve `~/.claude/tasks/` Claude tarafından runtime'da otomatik üretilir; **bunları YAZMA**.

**8f. Durum kaydını temizle:** Üretim (ve varsa native enablement) başarıyla bittiğine göre `.claude/team-builder-state.json`'ı **sil** — kurulum tamamlandı, bundan sonra `/team-builder-add` · `/team-builder-edit` · `/team-builder-sync`.

### Adım 9 — Özet + sıradaki adımlar

Üretim bitince kullanıcıya net bir özet ver:

- **Ne üretildi:** hedefler (Claude [+ Codex]), docLanguage, arch-root + layout, açık anayasa presetleri, routing satır sayısı, üye sayısı/rolleri, `lead`.
- **Üretilen yollar:** canonical kaynak `.agent-source/` (manifest.json + agents/*.md + project/* + skills); generated hedefler `CLAUDE.md`, `.claude/agents/*.md`, (Codex ise) `AGENTS.md` + `.codex/*`, (OpenCode ise) `AGENTS.md` + `opencode.json` + `.opencode/*`; mimari iskelet `docs/<arch-root>/...`.
- **Doğrulama sonucu:** manifest geçerli; sync drift temiz.
- **Sıradaki adımlar:** üye eklemek için `/team-builder-add`, takımı düzenlemek için `/team-builder-edit`, yeniden generate + drift kontrol için `/team-builder-sync`. **Hatırlat:** generated dosyalar elle değiştirilmez; her değişiklik `.agent-source/` üzerinde yapılır, sonra sync.

### Adım 10 — Mimari dokümanları birlikte doldurmayı TEKLİF ET

Özetten sonra, mimari doküman ağacı şu an çoğunlukla **boş iskelet** (README + ADR şablonu). Kullanıcıya teklif et:

> "Mimari doküman iskeleti hazır ama içi henüz boş. İstersen şimdi **birlikte adım adım** ADR'leri ve mimari kararları dolduralım — projeni inceleyip yazılmaya değer kararları önereyim, sen seç, beraber yazalım. Başlayalım mı?"

- **EVET** → `/architecture-advisor` skill'ini çalıştır (projeyi analiz et → ADR/kısıt/tasarım öner → kullanıcıyla tek tek yaz → `docs/<arch-root>/` altına işle). Takım manifesti zaten yazıldığı için advisor `architectureDocs.root`/`layout`/`docLanguage`'i oradan okur.
- **HAYIR / sonra** → "İstediğin zaman `/architecture-advisor` ile dökümanları doldurabiliriz" de ve bitir.

## Quick Reference (adım → referans dosyası)

| Adım | Konu | Referans (`~/.claude/skills/team-builder-shared/`) |
|------|------|------|
| 1 | Ön kontrol (kurulu mu / yarım kalmış mı — resume) | `canonical-source.md`, `wizard-state.md` |
| 2 | Hedefler (Claude/Codex/OpenCode) + Topoloji (subagent/native) | `codex-target.md`, `opencode-target.md`, `topologies.md` |
| 3 | docLanguage | proje/`CLAUDE.md`/README'den tahmin |
| 4 | arch-root + layout | `architecture-docs.md` |
| 5 | Roller (üye-üye, ÖNCE) | `governance-defaults.md`, `member-template.md`, `skill-recommend.md`, `agent-md-rich.md`, `manifest-schema.md` |
| 6 | Routing tablosu (kod yolu → rol) | `routing.md` |
| 7 | Kalite odakları (checkbox) + Anayasa presetleri | `quality-dimensions.md`, `constitution.md` |
| 8a | `.agent-source/` yaz | `canonical-source.md`, `manifest-schema.md`, `agent-md-rich.md`, `architecture-docs.md`, `codex-target.md` |
| 8b | manifest doğrula | `validate-manifest.mjs`, `manifest-schema.md` |
| 8c–8d | generate + drift | `sync-agent-config.mjs`, `sync-pipeline.md` |
| 9 | Özet + sıradaki adımlar | — |
| 10 | Mimari dokümanları doldurmayı teklif et | `/architecture-advisor` (skill) |

## Yaygın Hatalar

- **Soru sormadan üretme.** Her hedef, rol, enforcement, anayasa preseti ve routing satırı kullanıcıya sorulur; varsayılanlar yalnızca öneridir.
- **Routing/domain taslağını onaylatmadan yazma.** Adım 6 taslağı kullanıcı onayı olmadan manifest'e geçmez.
- **Manifest'i doğrulamadan generate etme.** 8b geçmeden 8c'ye geçme.
- **Drift'i yok sayma.** 8d temiz çıkmadan iş bitmiş sayılmaz.
- **Generated dosyayı elle yazma/düzenleme.** Tek kaynak `.agent-source/`; generated hedefler yalnız sync ile üretilir, elle değişiklik bir sonraki `--check`'te drift olarak yakalanır.
- **Mevcut takımın üzerine sessizce yazma.** Adım 1'de `.agent-source/` varsa kullanıcıyı uyar, add/edit/sync'e yönlendir.
- **docLanguage dışı dil kullanma.** Tüm üretilen metinler seçilen dilde; kod/dosya/commit İngilizce.
