# Tasarım: `team-builder-module` — kurulu takıma yeni klasör ve rol ekleme

- **Tarih:** 2026-09-30
- **Durum:** Taslak (Codex tasarım incelemesi 1 bulguları işlendi)
- **Kapsam:** Kurulu bir projede yeni bir klasörü (modülü) mevcut bir role bağlamak ya da
  onun için yeni bir rol açıp bağlamak.

## Problem

Kurulumdan sonra açılan bir klasör (ör. `company/`, `auth/`) routing'de yoksa sahipsizdir.
Bugün manifest, rol dosyaları, `instructions.md` ve `llm.json` elle düzenlenir; yol çakışma
kuralı, rol metinleri ve kod yazan rollerin routing zorunluluğu elle kolay bozulur. Sync bu
metin kaynaklarını manifest'ten **yeniden üretmez**, kopyalar — manifest'i güncellemek tek
başına yetmez.

## Akış

0. **Ön kontrol.**
   - `.agent-source/agents/manifest.json` yoksa `team-builder-setup`'a yönlendir, dur.
   - `team-builder-models`'in eski-yapı tespitinin **tamamı** (manifest'te model alanları
     **ya da** rol dosyası frontmatter'ında `model:`/`effort:`) → önce onun göçü, dur.
   - `.agent-source/project/instructions.md` yoksa ya da anayasa işaretleri eksikse → önce
     `team-builder-upgrade` göçü, dur. Routing bölümü bu dosyadadır.
1. **Klasörü bul.** `module-scan.mjs <proje>` sahipsiz klasörleri listeler; kullanıcı bir
   klasör de söyleyebilir (`module-scan.mjs <proje> <klasör>` o klasörün şu anki en özel
   sahibini ya da "sahipsiz" yazar). Kullanıcı hangilerini ekleyeceğini seçer.
2. **Sahibi seç** — her klasör için. Aday roller **yalnız yazabilen** rollerdir
   (doğrulayıcının kuralı: `sandbox_mode` yazma izni veriyor; kod yazmayan ama yazabilen
   doküman rolleri de olur). Read-only roller (reviewer, security reviewer) **aday değildir**
   — onlara klasör verilmez. Seçenekler: mevcut rol (şu anki yollarıyla gösterilir) ya da
   yeni rol.
   - Klasörün zaten **aynı** sahibi varsa: hiçbir şey yapma, söyle.
   - **Başka** bir sahibi varsa: "`auth/` şu an `developer`'ın; `security-developer`'a
     taşıyayım mı?" Onaylanırsa **eşdeğer** satırın rolü değiştirilir (yeni satır eklenmez;
     eşit kapsamlı iki satır geçersizdir). Klasör daha geniş bir satırın **içindeyse** iç içe
     yeni satır eklenir.
3. **Yeni rol** (yalnız o rol için, setup'ın üye rutiniyle — `member-template.md`,
   `governance-defaults.md`, `agent-md-rich.md`):
   - ad (slug, tekil), ne yapar, kod yazar mı, `sandbox_mode` (klasör alacağı için yazabilen),
     hangi araçlarda (`targets`, proje birden çok hedefliyorsa), kime danışır; **hangi mevcut
     roller buna danışsın**;
   - skill önerisi (`skill-recommend.md`): yalnız projede henüz olmayanlar `copy-skill.mjs`
     ile kopyalanır;
   - model ve effort: `team-builder-models`'in tek-tablo biçiminde, yalnız bu rolün satırı;
     `llm.json`'a (takım) yazılır.
   Read-only bir rol eklemek (ör. yeni bir denetçi) bu skill'in işi değildir — klasörle
   eşleşmez; bu durumda elle ekleme yolunu söyle.
4. **Routing'i kur ve denetle.** Önerilen satırı **bütün** mevcut satırlarla karşılaştır
   (`route-globs.mjs`: ya biri ötekini kapsar ya tamamen ayrıdır). Kısmi çakışma varsa —
   özellikle setup'ın ürettiği `modules/*/docs/**` gibi doküman satırlarıyla (`modules/auth/**`
   ile kısmen çakışır) — yeniden düzenleme öner: ör. `modules/auth/**` + `modules/auth/docs/**`
   → doküman sahibi. Doküman sahipliğini koru; kullanıcı onaylamazsa **hiçbir şey yazmadan dur**.
   Sonra: **yazabilen** her rolün — kod yazanlar ve `workspace-write` doküman rolleri —
   hâlâ en az bir yolu var mı (taşıma sonrası eski sahip dahil), plan kapısı açıksa her hedef
   ekosistemde uygun executor kalıyor mu — değilse dur, söyle. **Önerilen manifest'in
   tamamını dosyaya yazmadan önce doğrula** (geçici bir kopyada `validate-manifest.mjs`);
   geçersizse hiçbir kaynak dosya yazılmaz.
5. **İsteğe bağlı eşleşmeler** — yalnız ilgiliyse sor:
   - kod–doküman kuralı açıksa: bu klasör değişince güncellenecek doküman (`codeDocSync`
     satırı; `instructions.md` bloğu `constitution.md`'deki render kuralıyla manifest'ten
     yeniden üretilir);
   - `database-engineer` varsa ve klasörde şema/migration olacaksa: o yol için iç içe satır.
6. **Metin kaynaklarını güncelle** — sync bunları kopyalar, manifest'ten üretmez:
   - `project/instructions.md` → routing bölümü (tablo + kurallar), `routing.md`'nin yazım
     kuralıyla;
   - etkilenen **her** rol dosyası (`.agent-source/agents/<ad>.md`): yolun sahipliğine bağlı
     **bütün** bölümler `agent-md-rich.md` kalıbına göre uzlaştırılır — rol sınırları, domain +
     "Birincil kod kaynakları", çalışma dizinleri ve yasak dizinler, kısıtlar, `## Routing &
     Danışma`. Yeni ve eski sahip dahil; başka rollerin bu yolu anan hariç tutmaları da
     ("`<yol>` altına yazma — orası `<rol>`ün") güncellenir. Yeni role danışacak rollerin
     danışma satırı eklenir;
   - 5. adımda `codeDocSync` değiştiyse kopyalanmış **bütün** tabloları: `instructions.md`'deki
     blok ve tabloyu taşıyan **her** rol dosyası (`agent-md-rich.md` — reviewer dahil,
     sahipliği değişmemiş olsa da);
   - yeni rol: kendi rol dosyası;
   - hedeflenen ekosistemlerin roster dosyaları: `project/codex-team.md`,
     `project/opencode-team.md` (varsa).
7. **Onay → yaz → doğrula → üret.** Bütün değişiklikleri sade dille göster, onay al. Yaz;
   `validate-manifest.mjs <manifest>` → `MANIFEST OK`. Sync ve `--check` — bu makinede
   `llm.local.json` varsa **ikisi de `--no-local`** ile (commit'e gidecek üretim). Commit'i
   kullanıcıya bırakır; commit'e girecekleri listeler (yerel dosya varsa commit'ten sonra
   normal sync).

## `module-scan.mjs`

- `node module-scan.mjs <proje>` → proje kökündeki ve bir seviye altındaki klasörlerden
  hiçbir routing yolunun kapsamadıklarını listeler.
- `node module-scan.mjs <proje> <klasör>` → o klasörün en özel sahibi (onu kapsayan ve diğer
  kapsayanların içinde kalan satırın rolü) ya da "sahipsiz".
- Kapsama `route-globs.mjs`'in `routeContains(route, "<klasör>/**")`'ı ile — doğrulayıcıyla
  aynı kural.
- **Proje içinde kalma:** proje kökü `realpath` ile çözülür; manifest okunmadan önce
  **gerçek yolu** kökün içinde olmalı ve dosya bağ olmamalı (ata klasörlerden biri bağ olsa
  bile dışarıyı okumaz). Tarama klasör **bağlarını izlemez** ve listelemez. Açık klasör
  argümanı routing yolu dilbilgisine uymalı (`..`, `.`, mutlak yol yok) ve çözülmüş gerçek yolu
  kökün içinde olmalı. Atlananlar: `.` ile başlayanlar, `node_modules`, `dist`, `build`,
  `target`, `vendor`, `coverage`.
- Selftest: sahipsiz/sahipli, en özel sahip, ata klasör bağı, klasör bağı, dışarıyı gösteren
  argüman.

## Diğer değişiklikler

- `team-builder-models`, `team-builder-upgrade`, setup ve `wizard-state.md`'deki "rol eklemek
  için skill yok / elle düzenle" cümleleri: klasör ve yazabilen rol için bu skill'e yönlendirir;
  kapsam dışı işler (rol silme, read-only rol, yeniden adlandırma) için elle yolu korur.
- Setup'taki skill sayısı ("beş skill") ve README'nin kurulum doğrulama listeleri, skill
  tabloları, kaldırma komutları (iki dil).
- `copy-skill.mjs` `TEAM_BUILDER_DIRS`.

## Kapsam dışı

- Rol silme, yeniden adlandırma, klasör taşıma; read-only rol ekleme.
- Yeni ekosistem hedefleme.
