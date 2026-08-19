# Tasarım: Preset Yükseltme (`team-builder-upgrade`) — kapsam E

- **Tarih:** 2026-08-19
- **Durum:** Uygulandı — `docs/superpowers/plans/2026-08-19-preset-upgrade.md`
- **Kapsam:** Plan kapısı çekirdeğinin (`2026-08-02-plan-gate-design.md`) **E** alt sistemi

> Çekirdek spec, KARAR 20 ile bu işi ayrı bir yere bıraktı: *"Preset açma/kapama
> proje-yükseltme skill'ine ait — `sync` yeni kaynak yaratmıyor."* Bu doküman o boşluğu
> doldurur ve doldururken bugün var olan bir çift-bakım borcunu kapatır.

## Problem

Beş anayasa preseti kurulumda sorulur ve bir daha sorulmaz. Kurulumdan sonra fikir
değiştiren kullanıcının elinde bir yol yok:

1. **`planGate` en sert vaka.** Kapalı kurulmuşsa ortada ne `work-plan` skill kaynağı ne
   `.agent-work/` iskeleti olur. "Manifest'te `true` yap ve `sync` çalıştır" **işe
   yaramaz** — `sync` yalnız var olan kaynakları mirror'lar, yeni kaynak yaratmaz.
2. **`noWorkaround` ve `codeDocSync` metin preset'leri.** Metinleri
   `.agent-source/project/CLAUDE.md` ve `AGENTS.md` içinde, setup'ın yazdığı serbest
   prose'un içinde gömülü. Çevirmek, kendi yazmadığın metnin içinde ameliyat yapmak.
3. **`perAgentMemory` ve `languageStandard` zaten çalışıyor** — generator onları
   manifest'ten okuyor, manifest + `sync` yeterli. Ama kullanıcı hangisinin çalıştığını
   bilmiyor ve bilmesi de gerekmemeli.

**Ölçülen ikinci problem.** Setup, routing + kod-doküman + anayasa + mimari kaynakları
içeren **aynı metni** hem `project/CLAUDE.md`'ye hem `project/AGENTS.md`'ye yazıyor;
generator ikisini de kopyalıyor. Yani aynı kural bugün iki dosyada bakım görüyor.
`AGENTS.md`'de ekosisteme özgü hiçbir içerik yok — baştan sona kopya. E'yi çözmek için
metnin tek bir eve taşınması zaten gerekiyordu; taşıyınca bu borç da kapanıyor.

## Kapsam

| | Konu | Durum |
|---|---|---|
| **E1** | Talimat metninin tek kaynağa taşınması (`instructions.md`) | **Bu spec** |
| **E2** | Anayasa bloklarının işaretlenmesi | **Bu spec** |
| **E3** | Beş preset için açma/kapama | **Bu spec** |
| **E4** | Mevcut projelerin yeni yapıya göçü | **Bu spec** |
| — | Manifest'in başka alanlarını (roller, routing, hedefler) değiştirme | **Kapsam dışı** |
| — | Kurulumdan sonra yeni ekosistem ekleme | **Kapsam dışı** |

**Neden yalnız preset'ler:** Rol eklemek, routing değiştirmek ya da yeni ekosistem
hedeflemek setup'ın soru akışının tamamını gerektirir — yükseltme onun ikizi olmamalı.
Preset'ler tek başına anlamlı, sınırlı ve tersine çevrilebilir bir küme.

## Ön bulgu: üç CLI de referansı izliyor

Tasarım, hedef dosyaların başka bir dosyaya işaret edebilmesine dayanıyor. Ölçüldü:

| Ekosistem | Mekanizma | Doğrulama |
|---|---|---|
| `opencode` | `opencode.json` → `instructions` **dosya dizisi** | Belgeli; araç dosyaları kendisi yükler |
| `claude` | `CLAUDE.md` içinde `@yol` import | Belgeli Claude Code özelliği |
| `codex` | `AGENTS.md` içinde referans | **Ölçüldü** — `@shared.md` yazıldı, Codex dosyayı açıp içeriğini döndürdü |

Codex'te mekanik bir include yok; **model işaretçiyi görüp dosyayı açıyor**. `AGENTS.md`'nin
tamamı zaten aynı mantıkla çalıştığı için pratik fark küçük.

> **Yan bulgu — gönderilen skill'i ilgilendirir.** `--disallowedTools` variadic bir
> bayrak: prompt argüman olarak arkasına konursa onu da tool adı sanıp yutuyor
> (`Permission deny rule "parolayi" matches no known tool`). Çapraz ekosistem çağrısı
> prompt'u stdin'den verdiği için mevcut komut güvenli, ama bu bir tuzak ve
> `work-plan-skill.md`'de not edilmeli.

## Terimler

| Terim | Tanım |
|---|---|
| **Ortak talimat** | `.agent-source/project/instructions.md` — routing, kod-doküman, anayasa, mimari kaynaklar. Tek ev. |
| **Hedef kaynağı** | `.agent-source/project/CLAUDE.md` / `AGENTS.md` — referans satırı + o ekosisteme gerçekten özgü olan. Kullanıcı düzenler. |
| **Anayasa bloğu** | `instructions.md` içinde bir preset'in metnini saran işaretli bölge. |
| **Türetilen preset** | Generator'ın manifest'ten okuduğu preset (`perAgentMemory`, `languageStandard`). |
| **Metin preset'i** | Metni `instructions.md`'de yaşayan preset (`noWorkaround`, `codeDocSync`). |
| **Artefakt preset'i** | Projede dosya/dizin üreten preset — yalnız `planGate`. |

## E1 — Talimat metninin tek kaynağa taşınması

```
.agent-source/project/
├── instructions.md    ← ortak governance; işaretli anayasa blokları
├── CLAUDE.md          ← referans + Claude'a özgü ne varsa (bugün: native topoloji bölümü)
├── AGENTS.md          ← referans + Codex/OpenCode'a özgü ne varsa (bugün: yok)
└── opencode.json      ← instructions dizisine instructions.md eklenir
```

**Canonical-source modeli değişmiyor.** Kullanıcı `.agent-source/project/*` düzenler,
generator kök dizine kopyalar, üretilenler elle değiştirilmez. Değişen tek şey içeriğin
nereye yazıldığı.

Referans biçimleri:

| Dosya | Satır |
|---|---|
| `CLAUDE.md` | `@.agent-source/project/instructions.md` |
| `AGENTS.md` | `Bütün proje kuralları @.agent-source/project/instructions.md dosyasındadır. Önce onu oku.` |
| `opencode.json` | `"instructions"` dizisinin **ilk** elemanı `.agent-source/project/instructions.md` |

**Hedef kaynakları kullanıcıya açık kalır.** "Codex'e özel şunu da söyle" demek için bir
yer olmazsa herkes ortak dosyaya yazmaya başlar ve çift-bakım geri gelir.

### Referans kaybı sessiz olamaz

Kullanıcı referans satırını silerse üretilen dosya yine geçerli görünür, drift kontrolü
**temiz döner** (kaynakla uyumludur), ve proje bütün governance'ını sessizce kaybeder —
routing, anayasa, kod-doküman kuralları. Fark edilmesi aylar sürebilir.

Bu yüzden doğrulama: **hedeflenen her ekosistemin kaynak dosyası `instructions.md`
referansını taşımalı.** Eksikse `sync` **uyarır ve eklemeyi teklif eder**; reddetmez.
Dosya kullanıcının kendi kaynağıdır, tek satır yüzünden üretimi durdurmak orantısız —
ama sessiz kalmak da kabul edilemez (KARAR E4).

## E2 — Anayasa bloklarının işaretlenmesi

Her preset'in metni sabit HTML yorumlarıyla sarılır:

```markdown
<!-- c:noWorkaround -->
## Geçici çözüm yok
...
<!-- /c:noWorkaround -->
```

Beş işaret çifti: `c:noWorkaround`, `c:codeDocSync`, `c:perAgentMemory`,
`c:languageStandard`, `c:planGate`.

**Neden işaret, neden başlık değil:** başlıklar `docLanguage`'e çevrilir. Plan kapısının
`<!-- s:what -->` disiplininin aynısı ve aynı gerekçeyle — bir kural başlığa bakarsa
Türkçe kurulumda çalışıp İngilizce kurulumda çalışmaz.

**Kapalı preset'in bloğu bulunmaz.** Blok varlığı = preset açık. Yükseltme bloğu ekler
ya da çıkarır.

### Blok metni nereden gelir — yeni bir şablon gerekiyor

`constitution.md` **sihirbaz talimatıdır**, projeye yazılacak hazır metin değil: preset'in
ne olduğunu ve kullanıcıya nasıl sorulacağını anlatır, metni setup **besteler** — takım
kadrosuna (*"architect takımda yoksa kullanıcıya sorulur"*), projeye özel cevaplara ve
`docLanguage`'e göre. Yükseltmenin oradan blok "türetmesi" bu besteleme mantığını ikinci
bir yere kopyalamak olurdu.

Bu yüzden **yeni bir şablon**: `templates/constitution-blocks.md`. Her preset için bir
işaretli blok, Türkçe **referans** biçiminde — reponun `templates/plan.md` ve
`templates/work-plan-skill.md` için zaten kullandığı disiplinin aynısı: şablon verbatim
kopyalanmaz, `docLanguage`'e ve projenin cevaplarına göre **render edilir**. Setup
kurulumda render eder, yükseltme preset'i açarken **aynı şablonu** render eder. Metnin
tek kaynağı olur.

İşaretler şablonun kendisinde durur — böylece "blok nasıl sarılır" sorusunun da tek bir
cevabı olur.

**Projeye özel cevap isteyen preset'ler açılırken sorulur.** `noWorkaround`'un workaround
desen listesi, `codeDocSync`'in kod→doküman tablosu ve `planGate`'in denetleyicileri
projeye özeldir; yükseltme bunları `constitution.md`'deki soru kalıplarıyla sorar.

**Cevabın nereye yazıldığı preset'e göre değişir** ve bu, şemada gerçekten ne olduğuna
bakılarak belirlenir:

| Preset | Manifest | Blok |
|---|---|---|
| `codeDocSync` | `codeDocSync[]` kök alanı | tablo oradan render edilir |
| `planGate` | `planGate.planReviewer` / `codeReviewer` | adlar oradan gelir |
| `noWorkaround` | **yok** — yalnız `constitution.noWorkaround` boolean'ı | **listenin tek evi blok** |

`noWorkaround` için manifest'e alan **uydurulmaz**: hiçbir şey onu okumaz, doğrulayıcının
kök anahtar allowlist'i olmadığı için hata da vermez, ve her oturum başka bir ad seçtiği
için projeler arasında sessizce ayrışır.

## E3 — Preset açma/kapama

### Üç sınıf, üç iş

| Sınıf | Preset | Yükseltmenin yaptığı |
|---|---|---|
| Türetilen | `perAgentMemory`, `languageStandard` | Manifest + `sync` |
| Metin | `noWorkaround`, `codeDocSync` | Manifest + `instructions.md` bloğu + `sync` |
| Artefakt | `planGate` | Yukarıdakiler + artefakt kurma/bırakma |

### `planGate` açılırken

1. Denetleyicileri sor (`planReviewer`, `codeReviewer` — ad ya da `null`).
   `constitution.md` KARAR 5'in soru kalıbı kullanılır.
2. Manifest: `constitution.planGate: true` **ve** kök `planGate` nesnesi.
3. `instructions.md`'ye `<!-- c:planGate -->` bloğu.
4. `.agent-source/skills/work-plan/SKILL.md` üret (`templates/work-plan-skill.md`'den,
   `docLanguage`'e çevrilerek).
5. `.agent-work/` iskeleti: `README.md`, `TEMPLATE.md`, `inbox/ draft/ approved/
   in-progress/ done/`.
6. `sync` — skill ekosistem dizinlerine yansır.

**`.agent-work/` zaten varsa üzerine yazma.** Önceki bir açma-kapama turundan kalmış
olabilir ve içinde planlar durur. Mevcut iskelet kullanılır, eksik klasör varsa eklenir.

### `planGate` kapanırken — veri korunur, konfigürasyon temizlenir

Bu ayrım tasarımın en keskin noktası ve iki farklı şeyi ayırır:

**`.agent-work/` kullanıcı verisidir. Hiçbir şey silinmez.** Kapatmadan önce her
klasördeki dosya sayısı gösterilir ve onay istenir:

> "3 onaylı, 1 süren iş artık izlenmeyecek. Dosyalar `.agent-work/` altında duruyor.
> Devam edilsin mi?"

Tekrar açılınca her şey yerinde bulunur.

**`work-plan` skill'i konfigürasyondur ve silinmelidir.** Bırakılırsa
`.claude/skills/work-plan/` yerinde kalır ve o skill'in ilk cümlesi *"Bu projede plan
kapısı açıktır"*. Proje kendi durumu hakkında yalan söyler; bir agent kapalı bir kapıyı
işletmeye çalışır.

`sync` bunu tek başına çözmez: ledger stale hedefi **raporlar ama silmez**
(`sync-pipeline.md`: *"`<yol> (stale)` raporlanır — silinmez, defterde KALIR"*). Bu
yüzden yükseltme sırayla: kaynağı (`.agent-source/skills/work-plan/`) siler, `sync`
çalıştırır, sonra ledger'ın `(stale)` raporundaki hedefleri siler.

**Manifest'ten `planGate` nesnesi de silinir.** Doğrulayıcı, `constitution.planGate`
kapalıyken kök `planGate` nesnesinin varlığını geçersiz sayıyor.

### Akış

Her preset için aynı: **durumu göster → değişikliği sor → etkiyi önce söyle → onay al →
manifest + metin + artefakt → `sync` → doğrula.**

"Etkiyi önce söyle" adımı kapatmada zorunludur; açmada da neyin üretileceği söylenir.

## E4 — Mevcut projelerin göçü

Bugüne kadar kurulmuş her projede `instructions.md` yok, metin iki hedef dosyasının
içinde ve işaretsiz.

**Göç sezgisel olmaz.** Kendi yazmadığın prose'a otomatik işaret yerleştirmek, canonical
kaynağı tahminle düzenlemektir. Bunun yerine **önerili göç**: skill blokları bulup
gösterir, kullanıcı **blok blok onaylar**. Ayırt edemediği bloğu **işaretsiz bırakır** ve
açıkça söyler:

> "`codeDocSync` bloğunu ayırt edemedim; o preset'i çevirmek istersen önce işaretleri
> elle koy."

Yarım göç, yanlış göçten iyidir.

**Diverjans durdurur.** `CLAUDE.md` ile `AGENTS.md` bugün kopya olmalı ama kullanıcı
birini düzenlemiş olabilir. Göç ikisini karşılaştırır; farklıysa **durur ve farkı
gösterir** — hangisinin ortak metin olacağını kullanıcı seçer. Sessizce birini
kazandırmak, kullanıcının yazdığı metni kaybetmektir.

**Göç adımları:** tespit → teklif → diverjans kontrolü → `instructions.md` oluştur →
işaretleri blok blok onaylat → hedef kaynaklarını referans + özgü içerik olarak yeniden
yaz → `sync`.

Göç **tek seferliktir** ve git ile geri alınabilir; skill bunu söyler.

## Doğrulayıcı değişikliği

| Kural | Nerede | Davranış |
|---|---|---|
| Hedeflenen her ekosistemin kaynak dosyası `instructions.md` referansını taşımalı | `sync` öncesi | **Uyar + eklemeyi teklif et** |
| `instructions.md` açık preset'lerin işaret çiftlerini taşımalı | artefakt doğrulaması | **Yapılmadı** — aşağıya bak |

**İkincisi inşa edilmedi.** `instructions.md` bir **proje** dosyasıdır, bu repoda örneği
yok; `validate-plan-gate.mjs` yalnız bu reponun kendi şablonlarını (`templates/plan.md`,
`templates/work-plan-skill.md`) denetler — bir projeye kurulmuş `instructions.md`'yi
değil. Projedeki işaretleri mekanik denetlemek, o projeye kurulan **ayrı bir
doğrulayıcı** gerektirir; bu spec'in kapsamı dışında kalan ayrı bir iş
(`docs/superpowers/plans/2026-08-19-preset-upgrade.md:1074`). Bugün onun yerini
`team-builder-upgrade/SKILL.md`'nin "Ortak akış" 7. adımı (*Doğrula ve raporla*) tutuyor:
preset her açılıp kapatıldığında model `instructions.md`'yi elle tarayıp beklenen işaret
çiftinin var/yok olduğunu kontrol eder. Mekanik değil — ama bugün var olan tek denetim
budur, ve bu yüzden aşağıdaki değişecekler tablosunda bu satıra karşılık bir `.mjs`
değişikliği **yoktur**.

**Mevcut kurallar korunur.** `constitution.planGate` ile kök `planGate` nesnesinin
varlık/yokluk eşleşmesi, kapı sahiplerinin `writesCode: false` olması, hedeflenen her
ekosistemde executor bulunması — hepsi aynen kalır.

## team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `team-builder-upgrade/SKILL.md` | **YENİ** — dördüncü skill: preset çevirme, artefakt kurma/bırakma, göç |
| `team-builder-setup/SKILL.md` | `instructions.md` yazar; hedef kaynaklarına referans + özgü içerik koyar; anayasa bloklarını işaretler |
| `team-builder-shared/sync-agent-config.mjs` | `project/instructions.md`'yi tanır ve kopyalar; referans eksikse uyarır |
| `team-builder-shared/canonical-source.md` | Yeni kaynak→hedef haritası |
| `team-builder-shared/templates/constitution-blocks.md` | **YENİ** — preset başına işaretli blok şablonu; setup ve yükseltme aynı kaynağı render eder |
| `team-builder-shared/constitution.md` | Her preset'in işaret adı; blok şablonuna işaret |
| `team-builder-shared/sync-pipeline.md` | Referans uyarısı ve stale temizliği |
| `team-builder-shared/templates/work-plan-skill.md` | `--disallowedTools` variadic tuzağı notu |
| Çekirdek spec (`2026-08-02-...`) | KARAR 20'nin kapatıldığı bu spec'e işaret |

## Kabul kriterleri

### Olumlu (R)

| # | Durum | Beklenen |
|---|---|---|
| E-R1 | Türetilen preset çevrildi | Manifest + `sync`; üretilen agent dosyaları değişir |
| E-R2 | Metin preset'i açıldı | `instructions.md`'ye işaretli blok girer, `sync` yansıtır |
| E-R3 | Metin preset'i kapatıldı | Blok çıkar, gerisi dokunulmaz |
| E-R4 | `planGate` açıldı | Denetleyiciler sorulur, dört artefakt üretilir, `sync` skill'i yansıtır |
| E-R5 | `planGate` kapatıldı | Sayım gösterilir, onay alınır, skill kaynağı+hedefleri silinir, `.agent-work/` **durur** |
| E-R6 | `planGate` yeniden açıldı, `.agent-work/` dolu | Mevcut iskelet ve planlar **korunur** |
| E-R7 | İşaretli projede preset çevrildi | Yalnız o bloğa dokunulur |
| E-R8 | İşaretsiz projede yükseltme çağrıldı | Göç teklif edilir |
| E-R9 | Göç onaylandı, bloklar ayırt edilebildi | `instructions.md` oluşur, hedefler referansa döner |
| E-R10 | Referans silinmiş, `sync` çalıştı | Uyarı + ekleme teklifi |
| E-R11 | Projeye özel cevap isteyen preset açıldı (`noWorkaround`, `codeDocSync`) | Soru kalıbıyla sorulur. `codeDocSync` → hem `manifest.codeDocSync[]`'e hem bloğa; `noWorkaround` → **yalnız bloğa** (manifest'te desen listesi alanı yoktur) |

### Olumsuz (N)

| # | Durum | Beklenen |
|---|---|---|
| E-N1 | Zaten açık preset açılmak istendi | İşlem yok, söylenir |
| E-N2 | `planGate` kapatılıyor, kullanıcı onaylamadı | **Hiçbir şey değişmez** |
| E-N3 | `planGate` kapandı ama manifest'te `planGate` nesnesi kaldı | Manifest **geçersiz** |
| E-N4 | `planGate` kapandı, skill hedefi silinmedi | Proje durumu hakkında yalan söyler — silinmeli |
| E-N5 | `.agent-work/` var, açma üzerine yazmaya kalktı | **Yazılmaz**, mevcut korunur |
| E-N6 | Göçte `CLAUDE.md` ≠ `AGENTS.md` | **Durur**, fark gösterilir, kullanıcı seçer |
| E-N7 | Göçte bir blok ayırt edilemedi | İşaretsiz bırakılır ve **açıkça söylenir** |
| E-N8 | `planGate` açılıyor ama uygun executor yok | Manifest doğrulaması reddeder |
| E-N9 | Yükseltme rol/routing değiştirmeye kalktı | **Kapsam dışı** — setup'a yönlendirilir |
| E-N10 | Referans eksik, kullanıcı eklemeyi reddetti | `sync` sürer ama uyarı **her seferinde** tekrarlanır |

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| E1 | Ortak talimat tek dosyaya (`instructions.md`) taşınır | Bugün aynı metin iki dosyada bakım görüyor; `AGENTS.md` baştan sona kopya |
| E2 | Hedef kaynakları kullanıcıya açık kalır, referans + özgü içerik taşır | Özgü içerik için yer olmazsa herkes ortak dosyaya yazar, çift-bakım geri gelir |
| E3 | Üç ekosistem de **referans** alır, gömme yok | Üçünde de ölçüldü; tek kod yolu |
| E4 | Referans eksikse **uyar + teklif et**, reddetme | Kullanıcının kendi kaynağı; tek satır için üretimi durdurmak orantısız, ama sessiz kalmak governance'ı sessizce kaybettirir |
| E5 | Anayasa blokları işaretle sarılır | Başlıklar çevrilir; plan kapısının disiplininin aynısı |
| E6 | Blok varlığı = preset açık | İkinci bir durum kaydı tutmak drift üretir |
| E6b | Blok metni yeni bir şablondan (`templates/constitution-blocks.md`) render edilir | `constitution.md` sihirbaz talimatı, hazır metin değil; setup metni besteliyor. Yükseltmenin o beste mantığını kopyalaması, kaçınılan çift-bakımın aynısı olurdu |
| E7 | `planGate` kapanırken `.agent-work/` **hiç silinmez** | Kullanıcı verisi; `done/` zaten arşiv ve geri dönüşü yok |
| E8 | `work-plan` skill'i kapanırken **silinir** | Kalırsa proje kendi durumu hakkında yalan söyler; ledger stale'i silmiyor |
| E9 | Göç önerili ve blok blok onaylı; ayırt edilemeyen işaretsiz kalır | Canonical kaynağı sezgisel düzenlemek, kullanıcının metnini bozma riski |
| E10 | Yükseltme dördüncü skill olur | Setup bir kez çalışır, `sync` ince sarmalayıcı kalır; ikisinin de karakteri bozulmaz |
| E11 | Yalnız preset'ler; rol/routing/ekosistem kapsam dışı | Onlar setup'ın soru akışının tamamını gerektirir; yükseltme setup'ın ikizi olmamalı |

## Kapsam dışı

- **Rol, routing, hedef ekosistem değiştirme.** KARAR E11.
- **Kurulumdan sonra yeni ekosistem ekleme.** Aynı gerekçe.
- **`instructions.md`'nin içeriğini otomatik yeniden üretme.** Kullanıcının düzenlediği
  dosya; yükseltme yalnız işaretli blokları ekler/çıkarır.
- **Göçün geri alınması.** Git zaten yapıyor; ayrı bir mekanizma değmez.
