---
name: team-builder-module
description: Kurulmuş bir team-builder projesine yeni bir klasör (modül) ekler — klasörü mevcut, yazabilen bir role bağlar ya da onun için yeni bir rol açıp bağlar; routing'i ve routing tablosunu (instructions.md) günceller, yeni rol açılırsa onun dosyasını ve modelini de yazar. Tetikleyiciler — "yeni modül ekle", "yeni klasör açtım", "bu klasörü şu role ver", "billing klasörünü backend-developer'a bağla", "auth için security-developer ekle", "sahipsiz klasör var mı", "routing'e ekle". Rol silmek, yeniden adlandırmak, read-only bir denetçi eklemek ya da yeni bir araç (ekosistem) hedeflemek için kullanma; model/effort için team-builder-models, anayasa preset'leri için team-builder-upgrade.
---

# team-builder-module

> **Dosya yolları:** team-builder'ın betik ve belgeleri `${CLAUDE_SKILL_DIR}/../team-builder-shared/` altındadır; bu dosyadaki yollar buna göre yazılmıştır. Yol `CLAUDE_SKILL_DIR` adıyla çözülmeden görünüyorsa (Codex plugin'i onu çözmez), onu bu SKILL.md'nin bulunduğu klasörün mutlak yoluyla değiştir.

Kurulumdan sonra açılan bir klasörü takıma bağlar. Kural kaynakları: `routing.md` (yol
dilbilgisi, çakışma kuralı, `instructions.md`'nin routing bölümü), `manifest-schema.md`,
`member-template.md`, `governance-defaults.md`, `agent-md-rich.md`, `skill-recommend.md`,
`constitution.md` — hepsi `${CLAUDE_SKILL_DIR}/../team-builder-shared/` altında. **Önce
`routing.md`'yi oku.** Kullanıcıya dosya adı, alan adı ya da JSON gösterme; sade dille sor.

**Hangi dosyalar:** sahiplik tek kaynaktadır — `manifest.routing[]` ve onun
`instructions.md`'deki routing tablosu (kod–doküman eşleştirmesi: `manifest.codeDocSync[]` ve
`c:codeDocSync` bloğunun tablosu). Rol dosyaları yol taşımaz, tabloya atıf yapar
(`agent-md-rich.md`, `<!-- ownership -->` işaretleri). Bu yüzden sahiplik değişince **rol
dosyalarına dokunulmaz**. Sync `instructions.md`'yi manifest'ten üretmez, kopyalar; tabloyu
güncellemeyi unutursan `sync --check` tablo ile manifest arasındaki kaymayı yakalar.

## 0. Ön kontrol

- `.agent-source/agents/manifest.json` yoksa takım kurulu değildir: `team-builder-setup`'a
  yönlendir, dur.
- **Eski yapı:** manifest'te bir agent `model`, `model_reasoning_effort` ya da `opencode_model`
  taşıyorsa, ya da bir rol dosyasının frontmatter'ında `model:`/`effort:` varsa önce
  `team-builder-models` göçü gerekir — söyle, dur.
- `.agent-source/project/instructions.md` yoksa, ya da manifest'te açık olan her anayasa
  preset'inin işaret çifti (`<!-- c:<preset> -->` … `<!-- /c:<preset> -->`) o dosyada yoksa,
  önce `team-builder-upgrade` göçü gerekir (routing bölümü o dosyadadır) — söyle, dur.
- **Rol dosyalarında `<!-- ownership -->` işareti yoksa** (eski kurulum) rol dosyaları hâlâ
  yol listeleri taşır; bu skill onlara dokunmadığı için o kopyalar bayatlar. Önce
  `team-builder-upgrade`'in "Rol dosyalarını sahiplikten arındır" göçünü öner. Kullanıcıya
  söyle, seçtir: göçü önce yapmak ya da yine de devam etmek (o zaman eski rol dosyalarındaki
  yol cümleleri güncellenmez; sync bunları uyarı olarak gösterir). Devam ederse 6. adımda
  yeni rolün dosyasını **işaretsiz** yaz: işaretli tek bir dosya projeyi yeni yapıya geçmiş
  sayar ve eski rollerin uyarıları `--check` hatasına döner.

## 1. Klasörü bul

```bash
node "${CLAUDE_SKILL_DIR}/../team-builder-shared/module-scan.mjs" "<proje>"
```

`unowned: <klasör>` satırları sahipsizdir; `(only the files directly inside it)` diyen satırda
klasörün alt klasörlerinin bir kısmı sahiplidir, doğrudan içindeki dosyalar sahipsizdir. Kullanıcı bir klasör söylediyse şu anki sahibini
sor:

```bash
node "${CLAUDE_SKILL_DIR}/../team-builder-shared/module-scan.mjs" "<proje>" "<klasör>"
```

Kullanıcıya listeyi göster, hangilerini ekleyeceğini seçtir.

## 2. Sahibi seç — her klasör için

Aday roller **yalnız yazabilen** rollerdir: `sandbox_mode` yazma izni veriyor (kod yazan
developer'lar ve yazabilen doküman rolleri). Read-only roller (reviewer, security reviewer)
**aday değildir** — onlara klasör verilmez. Her adayı şu anki yollarıyla göster:

> "`billing/` henüz kimsenin değil. `orders/**`'ı yöneten `backend-developer`'a vereyim mi,
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
   (`routing.md`). Kısmi çakışma — özellikle eski kurulumların `modules/*/docs/**` gibi joker
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

Yeni klasör bir **servisse** (üst düzey kod alanı, `<klasör>/**` kod yazan bir role) ve
manifest'te `architectureDocs.layout: per-module` ile architect varsa,
`<klasör>/docs/<mimari-klasör>/**` → architect satırını **kendiliğinden** ekle
(`routing.md` → *Standart satır*) ve kullanıcıya söyle; "servis değil" derse ekleme. Bu
satır 2. ve 4. maddelerdeki denetimlerden de geçer.

## 5. İsteğe bağlı eşleşmeler (yalnız ilgiliyse sor)

- Kod–doküman kuralı açıksa: "Bu klasör değişince hangi doküman güncellensin?" →
  `codeDocSync` satırı.
- `database-engineer` varsa ve klasörde şema/migration olacaksa: o yol için iç içe satır.

## 6. Metin kaynaklarını güncelle

Sync `instructions.md`'yi ve takım dosyalarını kopyalar; burada güncellemezsen ajanlar
eskisini okur. Güncellenenler yalnız şunlardır:
- `.agent-source/project/instructions.md` → routing bölümü (tablo + kurallar), `routing.md`'nin
  yazım kuralıyla. Tablo `manifest.routing[]` ile birebir aynı olmalı; `sync --check` farkı
  yakalar.
- 5. adımda `codeDocSync` değiştiyse `instructions.md`'deki `c:codeDocSync` bloğunun tablosu
  (`constitution.md`'deki render kuralı). `sync --check` bu tabloyu da manifest'le karşılaştırır.
- Hedeflenen araçların takım dosyaları: `project/codex-team.md`, `project/opencode-team.md`
  (varsa) — yeni rol ve, sahiplik listeliyorlarsa, yeni sahiplik.

**Rol dosyalarına sahiplik için dokunulmaz.** Rol dosyası yazma alanını routing tablosundan
çözer. İki istisna:
- **Yeni rol:** kendi rol dosyası `agent-md-rich.md` kalıbıyla, sahiplik metni
  `<!-- ownership -->` … `<!-- /ownership -->` işaretleri arasında genel ifadeyle yazılır —
  yol yazılmaz. Proje henüz göç etmediyse (0. adım) aynı genel metin işaretsiz yazılır.
- **Yeni role danışacak mevcut roller:** danışma satırlarına yalnız yeni rolün **adı**
  eklenir (manifest `consults[]` ile birlikte). Başka bir şey değişmez.

Manifest `agents[].rules` ve `extra_instructions` maddelerine routing satırı (`services/orders/**`,
`services/orders/`) **yazılmaz**; sync bunları arar ve kayma sayar. Rolün işini tarif eden daha
derin bir yol serbesttir.

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
4. Kullanıcıya commit'e girecekleri söyle: manifest, `instructions.md`, varsa takım
   dosyaları, yeni rolün dosyası ve `llm.json`, danışma satırı eklenen rol dosyaları,
   kopyalanan skill'ler, sync'in ürettikleri. Commit'i
   **sen yapma**. `--no-local` kullandıysan commit'ten sonra normal sync gerektiğini ekle.

## Yapma

- Read-only bir role klasör verme.
- Manifest'i doğrulamadan kaynak dosya yazma.
- `instructions.md`'deki routing tablosunu (ve değiştiyse `c:codeDocSync` tablosunu) ya da
  takım dosyalarını güncellemeden bırakma.
- Sahiplik değişikliği için mevcut rol dosyalarına yol yazma; manifest `rules`/
  `extra_instructions`'a routing satırı koyma.
- Kısmi çakışan bir satırı onaysız yeniden düzenleme.
- Commit ya da push yapma.
