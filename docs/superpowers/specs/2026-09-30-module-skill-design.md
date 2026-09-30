# Tasarım: `team-builder-module` — kurulu takıma yeni klasör ve rol ekleme

- **Tarih:** 2026-09-30
- **Durum:** Taslak
- **Kapsam:** Kurulu bir projede yeni bir klasörü (modülü) mevcut bir role bağlamak ya da
  onun için yeni bir rol açıp bağlamak.

## Problem

Kurulumdan sonra açılan bir klasör (ör. `company/`, `auth/`) routing'de yoksa sahipsizdir.
Bugün manifest, rol dosyası ve `llm.json` elle düzenlenir: yol çakışma kuralı, rol dosyasının
yapısı ve kod yazan rollerin routing zorunluluğu elle yapınca kolay bozulur.

## Akış

0. **Ön kontrol.** `.agent-source/agents/manifest.json` yoksa `team-builder-setup`'a yönlendir.
   Eski yapı (manifest'te model alanları) varsa önce `team-builder-models` göçü.
1. **Klasörü bul.** `module-scan.mjs <proje>` sahipsiz klasörleri listeler; kullanıcı bir
   klasör de söyleyebilir (`module-scan.mjs <proje> <klasör>` o klasörün şu anki sahibini
   söyler). Kullanıcı hangilerini ekleyeceğini seçer.
2. **Sahibi seç** — her klasör için:
   - mevcut rolleri **şu anki yollarıyla** göster: "`company/`'yi `product/**` gibi
     `backend-developer`'a vereyim mi?";
   - ya da **yeni rol**.
3. **Yeni rol** (yalnız o rol için, setup'ın üye rutiniyle — `member-template.md`,
   `governance-defaults.md`, `agent-md-rich.md`):
   - ad (slug), ne yapar, kod yazar mı, `sandbox_mode`, hangi araçlarda (`targets`,
     proje birden çok hedefliyorsa), kime danışır; **hangi mevcut roller buna danışsın**;
   - skill önerisi (`skill-recommend.md`): yalnız projede henüz olmayanlar
     `copy-skill.mjs` ile kopyalanır;
   - model ve effort: `team-builder-models`'in tek-tablo biçiminde, yalnız bu rolün satırı;
     değer `llm.json`'a (takım) yazılır.
4. **Routing satırı** `{ "path": "<klasör>/**", "role": "<rol>" }`. Klasör başka bir satırın
   içindeyse (ör. `src/auth` ve `src/**`) iç içe satır olarak eklenir — çakışma kuralı:
   ya biri ötekini kapsar ya tamamen ayrıdır. Kod yazan her rolün en az bir yolu olmalıdır.
5. **İsteğe bağlı eşleşmeler** — yalnız ilgiliyse sor:
   - kod–doküman kuralı açıksa: bu klasörün değişince güncellenecek dokümanı
     (`codeDocSync` satırı; `instructions.md` bloğu `constitution.md`'deki render kuralıyla
     manifest'ten yeniden üretilir);
   - `database-engineer` varsa ve klasörde şema/migration olacaksa: o yol için iç içe satır.
6. **Onay → yaz → doğrula → üret.** Değişiklikleri sade dille göster, onay al. Manifest, rol
   dosyası (`.agent-source/agents/<ad>.md`), `llm.json` yazılır;
   `validate-manifest.mjs <manifest>` → `MANIFEST OK`; sync (yerel dosya varsa `--no-local`)
   ve `--check`. Commit'i kullanıcıya bırakır; commit'e girecekleri listeler.

## `module-scan.mjs`

- `node module-scan.mjs <proje>` → proje kökündeki ve bir seviye altındaki klasörlerden
  hiçbir routing yolunun kapsamadıklarını listeler. Atlananlar: `.` ile başlayanlar,
  `node_modules`, `dist`, `build`, `target`, `vendor`, `coverage`.
- `node module-scan.mjs <proje> <klasör>` → o klasörün en özel sahibini (onu kapsayan ve
  diğer kapsayanların içinde kalan satırın rolü) ya da "sahipsiz" yazar.
- Kapsama `route-globs.mjs`'in `routeContains(route, "<klasör>/**")`'ı ile hesaplanır —
  doğrulayıcıyla aynı kural. Manifest `readFileSync` değil, bağı izlemeyen okumayla okunur.
- Selftest ile.

## Diğer değişiklikler

- `team-builder-models`, `team-builder-upgrade`, setup'ın "rol eklemek için skill yok"
  cümleleri bu skill'e yönlendirir.
- `copy-skill.mjs` `TEAM_BUILDER_DIRS` listesine eklenir (projeye kopyalanan team-builder).
- README iki dilde skill tablosu ve kaldırma komutları.

## Kapsam dışı

- Rol silme, yeniden adlandırma, klasör taşıma.
- Yeni ekosistem hedefleme.
