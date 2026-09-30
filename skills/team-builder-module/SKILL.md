---
name: team-builder-module
description: Kurulmuş bir team-builder projesine yeni bir klasör (modül) ekler — klasörü mevcut, yazabilen bir role bağlar ya da onun için yeni bir rol açıp bağlar; routing'i, rol dosyalarını, talimatları ve modeli birlikte günceller. Tetikleyiciler — "yeni modül ekle", "yeni klasör açtım", "bu klasörü şu role ver", "company klasörünü backend-developer'a bağla", "auth için security-developer ekle", "sahipsiz klasör var mı", "routing'e ekle". Rol silmek, yeniden adlandırmak, read-only bir denetçi eklemek ya da yeni bir araç (ekosistem) hedeflemek için kullanma; model/effort için team-builder-models, anayasa preset'leri için team-builder-upgrade.
---

# team-builder-module

> **Dosya yolları:** team-builder'ın betik ve belgeleri `${CLAUDE_SKILL_DIR}/../team-builder-shared/` altındadır; bu dosyadaki yollar buna göre yazılmıştır. Yol `CLAUDE_SKILL_DIR` adıyla çözülmeden görünüyorsa (Codex plugin'i onu çözmez), onu bu SKILL.md'nin bulunduğu klasörün mutlak yoluyla değiştir.

Kurulumdan sonra açılan bir klasörü takıma bağlar. Kural kaynakları: `routing.md` (yol
dilbilgisi, çakışma kuralı, `instructions.md`'nin routing bölümü), `manifest-schema.md`,
`member-template.md`, `governance-defaults.md`, `agent-md-rich.md`, `skill-recommend.md`,
`constitution.md` — hepsi `${CLAUDE_SKILL_DIR}/../team-builder-shared/` altında. **Önce
`routing.md`'yi oku.** Kullanıcıya dosya adı, alan adı ya da JSON gösterme; sade dille sor.

**Neden bu kadar dosya:** sync `instructions.md`'yi ve rol dosyalarını manifest'ten
**üretmez**, olduğu gibi kopyalar. Manifest'i değiştirip metinleri bırakırsan ajanlar eski
sahipliği okur; `--check` bunu yakalamaz.

## 0. Ön kontrol

- `.agent-source/agents/manifest.json` yoksa takım kurulu değildir: `team-builder-setup`'a
  yönlendir, dur.
- **Eski yapı:** manifest'te bir agent `model`, `model_reasoning_effort` ya da `opencode_model`
  taşıyorsa, ya da bir rol dosyasının frontmatter'ında `model:`/`effort:` varsa önce
  `team-builder-models` göçü gerekir — söyle, dur.
- `.agent-source/project/instructions.md` yoksa önce `team-builder-upgrade` göçü gerekir
  (routing bölümü o dosyadadır) — söyle, dur.

## 1. Klasörü bul

```bash
node "${CLAUDE_SKILL_DIR}/../team-builder-shared/module-scan.mjs" "<proje>"
```

`unowned: <klasör>` satırları sahipsizdir. Kullanıcı bir klasör söylediyse şu anki sahibini
sor:

```bash
node "${CLAUDE_SKILL_DIR}/../team-builder-shared/module-scan.mjs" "<proje>" "<klasör>"
```

Kullanıcıya listeyi göster, hangilerini ekleyeceğini seçtir.

## 2. Sahibi seç — her klasör için

Aday roller **yalnız yazabilen** rollerdir: `sandbox_mode` yazma izni veriyor (kod yazan
developer'lar ve yazabilen doküman rolleri). Read-only roller (reviewer, security reviewer)
**aday değildir** — onlara klasör verilmez. Her adayı şu anki yollarıyla göster:

> "`company/` henüz kimsenin değil. `product/**`'ı yöneten `backend-developer`'a vereyim mi,
> yoksa yeni bir rol mü açalım?"

- Klasörün zaten **aynı** sahibi varsa: değişiklik yok, söyle, geç.
- **Başka** bir sahibi varsa: "`auth/` şu an `backend-developer`'ın; `security-developer`'a
  taşıyayım mı?" Onaylanırsa ve klasör için **eşdeğer** bir satır varsa o satırın rolünü
  değiştir — yeni satır ekleme (eşit kapsamlı iki satır geçersizdir). Klasör daha geniş bir
  satırın **içindeyse** iç içe yeni satır eklenir.

## 3. Yeni rol (yalnız istendiyse)

Setup'ın üye rutinini (`team-builder-setup` Adım 5, madde 3 (a)–(g); `member-template.md`)
**yalnız bu rol için** uygula:
- ad (slug, projede tekil), görev, kod yazar mı, `sandbox_mode` — klasör alacağı için
  **yazabilen**; proje birden çok aracı hedefliyorsa hangi araçlarda (`targets`);
- kime danışır (`consults`) ve **hangi mevcut roller ona danışsın**;
- skill'ler (`skill-recommend.md`): yalnız `.agent-source/skills/` altında henüz olmayanları
  `copy-skill.mjs` ile kopyala;
- model ve effort: `team-builder-models`'in tek-tablo biçiminde, yalnız bu rolün satırı;
  `.agent-source/llm.json`'a (takım) yaz.

Read-only bir rol (yeni denetçi) istenirse bu skill'in işi değildir; manifest + rol dosyası +
`llm.json` + sync ile elle eklenir — söyle.

## 4. Routing'i kur ve denetle

1. Önerilen satır: `{ "path": "<klasör>/**", "role": "<rol>" }`.
2. **Bütün** mevcut satırlarla karşılaştır: ya biri ötekini kapsar ya tamamen ayrıdır
   (`routing.md`). Kısmi çakışma — özellikle setup'ın ürettiği `modules/*/docs/**` gibi
   doküman satırları, `modules/auth/**` ile kısmen çakışır — varsa yeniden düzenleme öner:
   ör. `modules/auth/**` → yeni rol + `modules/auth/docs/**` → doküman sahibi. Doküman
   sahipliğini koru. Kullanıcı onaylamazsa **hiçbir şey yazmadan dur**.
3. **Yazabilen** her rol — kod yazanlar ve `workspace-write` doküman rolleri — hâlâ en az bir
   yola sahip mi (taşımadan sonra eski sahip dahil)? Plan kapısı açıksa hedeflenen her araçta
   uygun bir executor kalıyor mu? Değilse dur, söyle.
4. **Önerilen manifest'in tamamını yazmadan önce doğrula:** geçici bir dosyaya yaz ve
   ```bash
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/validate-manifest.mjs" "<geçici-dosya>"
   ```
   `MANIFEST OK` değilse hiçbir kaynak dosya yazılmaz.

## 5. İsteğe bağlı eşleşmeler (yalnız ilgiliyse sor)

- Kod–doküman kuralı açıksa: "Bu klasör değişince hangi doküman güncellensin?" →
  `codeDocSync` satırı.
- `database-engineer` varsa ve klasörde şema/migration olacaksa: o yol için iç içe satır.

## 6. Metin kaynaklarını güncelle

Sync bunları kopyalar; burada güncellemezsen ajanlar eskisini okur.
- `.agent-source/project/instructions.md` → routing bölümü (tablo + kurallar), `routing.md`'nin
  yazım kuralıyla.
- Etkilenen **her** rol dosyası (`.agent-source/agents/<ad>.md`): sahipliğe bağlı **bütün**
  bölümler `agent-md-rich.md` kalıbına göre uzlaştırılır — `## Rol & Sınırlar`,
  `## Sorumluluk Alanı` (domain + birincil kod kaynakları), `## Çalışma / Yasak Klasörleri`,
  `## Routing & Danışma`, `## Kısıtlar`. Yeni ve eski sahip dahil; başka rollerin bu yolu anan
  hariç tutmaları ("`<yol>` altına yazma — orası `<rol>`ün") da güncellenir. Yeni role
  danışacak rollerin danışma satırı eklenir.
- Yeni rol: kendi rol dosyası (`agent-md-rich.md`).
- 5. adımda `codeDocSync` değiştiyse kopyalanmış **bütün** tablolar: `instructions.md`'deki
  blok (`constitution.md`'deki render kuralı) ve tabloyu taşıyan **her** rol dosyası —
  reviewer dahil, sahipliği değişmemiş olsa da.
- Hedeflenen araçların takım dosyaları: `project/codex-team.md`, `project/opencode-team.md`
  (varsa) — yeni rol ve yeni sahiplik.

## 7. Onay → yaz → doğrula → üret

1. Bütün değişiklikleri sade dille göster (hangi klasör kime, yeni rol, hangi dosyalar
   değişecek). **Onay al**; onaysız hiçbir dosya değişmez.
2. Yaz. Doğrula:
   ```bash
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/validate-manifest.mjs" "<proje>/.agent-source/agents/manifest.json"
   ```
3. Sync ve kayma kontrolü. Bu makinede `.agent-source/llm.local.json` varsa **ikisini de**
   `--no-local` ile çalıştır (sonuç commit edilecek):
   ```bash
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/sync-agent-config.mjs" --root "<proje>"
   node "${CLAUDE_SKILL_DIR}/../team-builder-shared/sync-agent-config.mjs" --root "<proje>" --check
   ```
4. Kullanıcıya commit'e girecekleri söyle: manifest, değişen rol dosyaları, `instructions.md`,
   varsa takım dosyaları ve `llm.json`, kopyalanan skill'ler, sync'in ürettikleri. Commit'i
   **sen yapma**. `--no-local` kullandıysan commit'ten sonra normal sync gerektiğini ekle.

## Yapma

- Read-only bir role klasör verme.
- Manifest'i doğrulamadan kaynak dosya yazma.
- Metin kaynaklarını (instructions, rol dosyaları, takım dosyaları) güncellemeden bırakma.
- Kısmi çakışan bir satırı onaysız yeniden düzenleme.
- Commit ya da push yapma.
