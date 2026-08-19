---
name: team-builder-upgrade
description: Kurulmuş bir projede anayasa preset'lerini (geçici çözüm yok, kod-doküman senkronizasyonu, rol başına hafıza, dil standardı, plan kapısı) açar veya kapatır; plan kapısının artefaktlarını kurar ya da bırakır; eski yapıdaki projeleri tek talimat dosyasına göç ettirir. Tetikleyiciler — "plan kapısını aç", "preset aç", "preset kapat", "anayasa değiştir", "takımı yükselt", "talimatları tek dosyaya taşı", "projeyi yeni yapıya geçir". Yeni rol/routing/ekosistem eklemek için kullanma; o setup'ın işidir.
---

# team-builder-upgrade

Kurulmuş bir projede **anayasa preset'lerini** açar/kapatır. Kurulum bir kez çalışır
(`team-builder-setup`), `sync` ince bir sarmalayıcıdır (`team-builder-sync`); bu skill
ikisinin arasındaki boşluğu doldurur: kurulumdan sonra fikir değişince.

**Kapsam dışı:** rol ekleme/çıkarma, routing değiştirme, yeni ekosistem hedefleme.
Bunlar setup'ın soru akışının tamamını gerektirir — kullanıcı isterse setup'a yönlendir.

## Beş preset, üç sınıf

| Sınıf | Preset | Yapılacak iş |
|---|---|---|
| Türetilen | `perAgentMemory`, `languageStandard` | Manifest + `instructions.md` bloğu + `sync` |
| Metin | `noWorkaround`, `codeDocSync` | Aynısı + projeye özel cevap sorulur |
| Artefakt | `planGate` | Aynısı + dosya/dizin kurma ya da bırakma |

Türetilen ikisini generator manifest'ten ayrıca okuyup agent dosyalarına da yansıtır;
o yüzden onlarda `sync` gerçek bir çıktı değişikliği üretir. Üçü de `instructions.md`'ye
blok yazar — insan-okur açıklama her preset için gerekir.

## Ortak akış

Hangi preset olursa olsun sıra aynıdır:

1. **Durumu göster.** `.agent-source/agents/manifest.json`'daki `constitution`
   alanlarını sade dille listele: hangisi açık, hangisi kapalı. Alan adlarını
   (`noWorkaround` vb.) kullanıcıya **gösterme**.
2. **Değişikliği sor.** Hangisi açılacak/kapatılacak.
3. **Etkiyi önce söyle.** Ne üretilecek, ne silinecek, neye dokunulmayacak. Kapatmada
   bu adım **zorunludur**.
4. **Onay al.** Onaysız hiçbir dosya değişmez.
5. **Uygula:** manifest → `instructions.md` bloğu → (varsa) artefakt.
6. **`sync` çalıştır.** `team-builder-sync` skill'ini çağır ya da doğrudan
   `node ~/.claude/skills/team-builder-shared/sync-agent-config.mjs` koştur.
7. **Doğrula ve raporla.** Doğrulama şu ikisidir:
   `node ~/.claude/skills/team-builder-shared/validate-manifest.mjs` ile manifest'i
   denetle, ve `instructions.md`'de beklediğin blokların bulunup bulunmadığını gör
   (açtığın preset'in işaret çifti var mı, kapattığınınki gitmiş mi).
   6. adımdaki `sync` bu ikinci kontrolü **mekanik olarak da** yapar: manifest'in
   preset'leriyle dosyadaki işaretleri karşılaştırır ve uyuşmazlığı uyarı olarak basar.
   Uyarı çıkarsa **görmezden gelme** — bloğu sen bu turda yazdın, demek ki istediğin gibi
   yazılmamış. Elle taraman yine de gerekli: uyarı yalnız `sync` çalıştığında görünür,
   sen ise bloğu ondan **önce** yazıyorsun.
   Sonra kullanıcıya ne değiştiğini **sade dille** söyle.

## İşaretli bloklar

Anayasa metni `.agent-source/project/instructions.md` içinde, preset başına işaretli
bloklarda durur:

| Preset | İşaret |
|---|---|
| `noWorkaround` | `<!-- c:noWorkaround -->` … `<!-- /c:noWorkaround -->` |
| `codeDocSync` | `<!-- c:codeDocSync -->` … `<!-- /c:codeDocSync -->` |
| `perAgentMemory` | `<!-- c:perAgentMemory -->` … `<!-- /c:perAgentMemory -->` |
| `languageStandard` | `<!-- c:languageStandard -->` … `<!-- /c:languageStandard -->` |
| `planGate` | `<!-- c:planGate -->` … `<!-- /c:planGate -->` |

**Blok varlığı = preset açık.** İkinci bir durum kaydı tutma; manifest ile blok
arasında bir tutarsızlık görürsen kullanıcıya bildir ve manifest'i doğru kabul et.

**Açarken:** bloğu `~/.claude/skills/team-builder-shared/templates/constitution-blocks.md`'den
render et — verbatim kopyalama, `docLanguage`'e çevir ve `<...>` yer tutucularını
projenin cevaplarıyla doldur. Bloğu `instructions.md`'nin sonuna ekle.

**Kapatırken:** açılış ve kapanış işareti dahil bloğun tamamını çıkar. Başka hiçbir
şeye dokunma.

**`instructions.md` yoksa** bu proje eski yapıdadır → *Göç* bölümüne bak.

## Projeye özel cevap isteyen preset'ler

`noWorkaround` ve `codeDocSync` açılırken projeye özel bilgi gerekir. Soru kalıplarını
`~/.claude/skills/team-builder-shared/constitution.md`'den al ve **sade dille** sor —
alan adı ya da "glob" gibi jargon gösterme.

- `noWorkaround` → reddedilen desen listesi. Çekirdek bir liste öner, kullanıcı ekler.
- `codeDocSync` → kod→doküman satırları. **Boş liste geçerlidir**; kullanıcı
  istemiyorsa `[]` yaz ve bloğun son cümlesi bunu zaten açıklıyor.

**Cevap nereye yazılır — ikisi farklı:**

- `codeDocSync` → **hem manifest'e hem bloğa.** Manifest'te `codeDocSync[]` diye bir kök
  alan vardır ve tablo ondan render edilir; ikisi ayrışırsa blok yalan söyler.
- `noWorkaround` → **yalnız bloğa.** Manifest'te desen listesi için bir alan **yoktur**;
  `constitution.noWorkaround` sadece açık/kapalı boolean'ıdır. Manifest'e bir alan
  **uydurma** — hiçbir şey onu okumaz, doğrulayıcı da yakalamaz, ve her oturum başka bir
  ad seçtiği için projeler arasında sessizce ayrışır. Listenin evi bloktur; preset'i
  sonradan yeniden render edersen mevcut bloktan okursun.

## Zaten açık/kapalı olan

Kullanıcı zaten açık bir preset'i açmak isterse **işlem yapma**, durumu söyle. Aynısı
kapalıyı kapatmak için de geçerli.

## Plan kapısı (`planGate`)

Öbür dört preset yalnız metin yazar; bu, projede **dosya ve dizin üretir**. O yüzden
açma ve kapatma ayrı ayrı anlatılır.

### Açarken

1. **Denetleyicileri sor.** `constitution.md` KARAR 5'in soru kalıbını kullan:
   - plan denetleyicisi: bir agent adı ya da "yok"
   - kod denetleyicisi: bir agent adı ya da "yok"

   Seçilen agent **kod yazmayan** bir agent olmalı: manifest'te `agents[]` içindeki o
   girdinin `writesCode` alanı `false` olmalı. Alan **yoksa** agent kod yazar sayılır,
   yani seçilemez. Kullanıcı kod yazan bir rol seçerse söyle ve tekrar sor —
   doğrulayıcı zaten reddeder, ama hatayı sihirbaz aşamasında yakalamak daha iyidir.

   **Projede hiç `writesCode: false` agent yoksa** kapı açılamaz. Tekrar tekrar sorma:
   durumu söyle ve iki seçenek sun — kullanıcı `null` denetleyiciyle devam etsin (kapı
   açılır ama o kapı atlanır), ya da kod yazmayan bir rolü **elle** eklesin: önce
   `.agent-source/agents/manifest.json`'daki `agents[]`'e `writesCode: false` olan yeni
   bir girdi (`manifest-schema.md`'deki zorunlu alanlarla), sonra karşılığında
   `.agent-source/agents/<name>.md` rol talimatını yaz, sonra `sync` çalıştır. Bu sırayla:
   önce manifest, sonra md, sonra sync — ters sıra `sync`'in daha yazılmamış bir role
   atıf bulmasına yol açar. **`team-builder-setup`'a yönlendirme** — zaten kurulu bir
   projede o skill Adım 1'de **DEVAM ETME** der ve var olmayan `/team-builder-add` ile
   `/team-builder-edit` komutlarına yönlendirir; rol eklemek bu skill'in de işi
   **değildir**, yukarıdaki elle-düzenleme tek yoldur.
2. **Manifest'i yaz:** `constitution.planGate: true` **ve** kök `planGate` nesnesi
   (`planReviewer`, `codeReviewer` — ikisi de zorunlu, değer ad ya da `null`).
3. **Bloğu ekle:** `<!-- c:planGate -->` … `<!-- /c:planGate -->`, şablondan render
   edilmiş, denetleyici adları doldurulmuş.
4. **Skill kaynağını üret:** `.agent-source/skills/work-plan/SKILL.md` —
   `~/.claude/skills/team-builder-shared/templates/work-plan-skill.md`'den,
   `docLanguage`'e çevrilerek. **İşaretler çevrilmez.**
5. **İskeleti kur:** `.agent-work/` altında `README.md`, `TEMPLATE.md` (bu da
   `templates/plan.md`'den render edilir) ve beş klasör: `inbox/ draft/ approved/
   in-progress/ done/`. **`TEMPLATE.md`'yi render ederken** şablon Türkçe referanstır;
   verbatim kopyalama, `docLanguage` dilinde yeniden yaz — ama beş `<!-- s:* -->` işareti
   (`s:what`, `s:how`, `s:questions`, `s:review-notes`, `s:progress`) ve
   `<!-- progress:not-started -->` sentinel'i **birebir korunur** (çeviriden
   bağımsızdırlar). Bunları çevirirsen ya da normalize edersen `work-plan` skill'i
   `.agent-work/` içindeki hiçbir planı okuyamaz.
6. **`sync` çalıştır** — skill ekosistem dizinlerine yansır.

**`.agent-work/` zaten varsa ÜZERİNE YAZMA.** Önceki bir açma-kapama turundan kalmış
olabilir ve içinde planlar durur. Mevcut iskeleti kullan, yalnız **eksik** klasörleri
ekle. `TEMPLATE.md` varsa dokunma.

### Kapatırken — veri korunur, konfigürasyon temizlenir

İki farklı şey var ve **ayrı davranırlar**.

**`.agent-work/` kullanıcı verisidir. Hiçbir şey silinmez.** Önce say, sonra sor:

```
inbox: 2   draft: 1   approved: 3   in-progress: 1   done: 7
```

Sorduğunda **bütün etkiyi** söyle, yalnız veri tarafını değil. Bu onay tek onaydır ve
konfigürasyon silmeyi de yetkilendirir; kullanıcı yalnız planlarının akıbetini onayladığını
sanmamalı:

> "Plan kapısını kapatıyorum. Şunlar olacak:
> — `.agent-work/` **olduğu gibi kalıyor**: 3 onaylı, 1 süren iş artık izlenmeyecek ama
>   hiçbir dosya silinmiyor.
> — `work-plan` skill'i **siliniyor**: kaynağı ve ekosistem dizinlerindeki kopyaları.
> — Manifest'ten plan kapısı ayarları ve ortak talimattan plan kapısı bölümü çıkıyor.
> Devam edilsin mi?"

Kullanıcı onaylamazsa **hiçbir şey değişmez** — manifest de dahil.

**`work-plan` skill'i konfigürasyondur ve silinir.** Bırakılırsa
`.claude/skills/work-plan/` yerinde kalır ve o skill'in ilk cümlesi *"Bu projede plan
kapısı açıktır"*. Proje kendi durumu hakkında yalan söyler; bir agent kapalı bir kapıyı
işletmeye çalışır.

`sync` bunu tek başına çözmez — ledger stale hedefi **raporlar ama silmez**. Sıra:

1. **Manifest'i güncelle:** `constitution.planGate: false` yaz ve kök `planGate`
   nesnesini sil. Nesne kalır da bayrak kapanırsa manifest **geçersiz** olur —
   doğrulayıcı reddeder.
2. **Bloğu çıkar:** `<!-- c:planGate -->` … `<!-- /c:planGate -->`.
3. **Kaynağı sil:** `.agent-source/skills/work-plan/`
4. **`sync` çalıştır** — `team-builder-sync` skill'ini çağır ya da
   `node ~/.claude/skills/team-builder-shared/sync-agent-config.mjs` koştur.
   **Bu noktada `--check` çalıştırma ve kimseye çalıştırtma.** Kaynağı bilerek sildin,
   yani drift **beklenen** durumdur ve `--check` 1 ile döner. `team-builder-sync`
   "sync'ten sonra `--check` temiz olmalı" der — o kural normal senkron içindir, kapatma
   akışının bu noktasında **henüz** geçerli değildir; 6. adımdaki ikinci `sync`'e kadar.
5. **`sync`'in `(stale)` diye raporladığı hedeflerden yalnız `work-plan` yolunda
   olanları sil.** `.agents/skills/work-plan/` **her projede** çıkar (o kopya ekosistem
   koşulsuz üretilir); `.claude/skills/work-plan/` ve `.opencode/skills/work-plan/` ise
   ilgili ekosistem hedefleniyorsa. **Listedeki başka yollara dokunma** — aynı koşuda
   ilgisiz bir stale girdi de raporlanmış olabilir ve onu silmek bu işlemin
   duyurulmamış bir yan etkisi olur.
6. **`sync`'i tekrar çalıştır** (düz `sync`, `--check` değil). Check modu ledger'ı hiç
   yazmaz; 5. adımda dosyaları elle sildikten sonra ledger hâlâ o yolları listeler, yani
   şimdi `--check` çalıştırsan yine 1 ile dönerdi. Bu ikinci düz `sync` ledger'ı diskteki
   gerçek duruma göre yeniden yazar — **ancak bundan sonra** `--check` temiz döner.
7. **Silinenleri kullanıcıya listele.**

### Sıra önemlidir

Adım 3 (kaynağı sil) adım 4'ten (`sync`) **önce** gelmeli. Kaynak hâlâ diskteyken `sync`
çalışırsa `work-plan`'ı olduğu gibi yeniden yansıtır, hiçbir şeyi stale işaretlemez ve
konfigürasyonun zaten güncel olduğunu bildirir — adım 5'te temizlenecek hiçbir hedef
görünmez.

## Göç — eski yapıdaki projeler

`.agent-source/project/instructions.md` yoksa bu proje ortak talimat dosyasından önce
kurulmuş demektir: metin `project/CLAUDE.md` ve `project/AGENTS.md` içinde, işaretsiz.
Preset çeviremezsin — önce göç.

**Göç tek seferliktir ve git ile geri alınabilir.** Kullanıcıya bunu söyle.

### Sıra

1. **Tespit et ve teklif et.**
   > "Bu proje talimatları iki dosyada tutuyor. Tek dosyaya taşıyıp `CLAUDE.md` ve
   > `AGENTS.md`'yi referansa çeviriyorum — böylece preset'leri açıp kapatabilirim.
   > Değişiklikler git'te, geri alınabilir. Devam edeyim mi?"

2. **Diverjansı kontrol et.** Önce **kaç dosya var** ona bak — tek ekosistemli bir
   projede yalnız biri bulunur ve bu normaldir, çakışma değil.
   - **Tek dosya varsa** → karşılaştıracak bir şey yok, o dosyanın içeriğiyle devam et.
   - **İkisi de varsa** → `project/CLAUDE.md` ile `project/AGENTS.md` **birebir kopya
     olmak zorunda değildir.** Bölünmeden önceki eski projelerde üç bölüm ekosisteme
     özgüdür ve yapısal olarak yalnızca birinde bulunur — bu **beklenen** bir fark,
     kullanıcıya sorulacak bir çakışma değildir (bkz. 3. adımdaki liste ve
     `codex-target.md:144-175`): Claude'un `topology: native` "Takımı başlatma" bölümü
     yalnız `CLAUDE.md`'de; "Senkronizasyon disiplini" ve "Codex team politikası"
     bölümleri yalnız `AGENTS.md`'de (Codex hedefliyse). Karşılaştırmadan **önce** bu üç
     bölümü ayıkla, **kalan** metni karşılaştır:
   - **Aynıysa** → devam (ayıklanan bölümler 3. ve 5. adımda kendi hedeflerine gider).
   - **Farklıysa** → **DUR.** Farkı göster ve sor: "Bu iki dosya ayrışmış. Hangisi
     ortak metin olsun?" Sessizce birini kazandırma — kullanıcının yazdığı metni
     kaybetmek demektir. Kullanıcı seçmezse **hiçbir şey değişmez** — göç başlamaz,
     dosyalar olduğu gibi kalır. Aynısı 4. adımdaki `codeDocSync` durması için de
     geçerlidir.

3. **`instructions.md`'yi oluştur.** Seçilen dosyanın içeriğini al. Ekosisteme özgü
   olduğunu bildiğin bölümleri **çıkar ve kenara koy** — bugün üç tane var
   (`codex-target.md:144-175`'teki eşleşmeye göre), gerisi ortak metindir:
   - Claude'un `topology: native` durumundaki "Takımı başlatma" bölümü → 5. adımda
     `CLAUDE.md`'ye geri yazılır.
   - "Senkronizasyon disiplini" bölümü (generated dosya listesi + elle değiştirme
     uyarısı) → `.agent-source/README.md`'ye ait; o dosya zaten bunu içerir, atabilirsin.
   - "Codex team politikası" bölümü (sub-agent / role emulation; hangi iş hangi
     `.codex/agent-definitions/<name>.md` okunur) → Codex hedefliyse 5. adımda
     `.agent-source/project/codex-team.md`'ye yazılır (`.codex/team.md` bu kaynaktan
     üretilir). Codex hedefli değilse bu bölüm zaten yoktur.

4. **İşaretleri blok blok onaylat.** Her preset için, manifest'te **açık** olanları
   sırayla:
   > "`noWorkaround` metnin burada başlıyor gibi görünüyor:
   > *<ilk iki satır>* … *<son satır>*
   > İşaretleri buraya koyuyorum — doğru mu?"

   - Onaylarsa işaretleri koy.
   - **Ayırt edemezsen ya da kullanıcı hayır derse: işaretsiz bırak ve açıkça söyle.**
     > "`codeDocSync` bloğunu ayırt edemedim; o preset'i çevirmek istersen önce
     > işaretleri elle koyman gerekiyor."

   **Yarım göç, yanlış göçten iyidir.** Tahminle işaret koyma.

   **`codeDocSync` bloğu ek bir kontrol ister.** Öbür preset'lerin metni serbest
   prose'dur, ama bunun tablosu `manifest.codeDocSync[]`'ten render edilmiş olmalıdır —
   bu dosyanın kendi kuralı: *"ikisi ayrışırsa blok yalan söyler"*. Eski projede tablo
   elle düzenlenmiş olabilir. Onaydan **önce** metni manifest ile karşılaştır:
   - Aynıysa → normal onay akışı.
   - Farklıysa → **DUR** ve kullanıcıya farkı göster: hangisi doğru? Cevaba göre ya
     manifest'i güncelle ya bloğu manifest'ten yeniden render et. Prose'u olduğu gibi
     sarma — sardığın anda yalan kalıcılaşır ve hiçbir doğrulayıcı bunu yakalamaz.

5. **Hedef kaynaklarını yeniden yaz.**
   - `project/CLAUDE.md` → `@.agent-source/project/instructions.md` + (varsa) 3. adımda
     kenara koyduğun native topoloji bölümü
   - `project/AGENTS.md` → `Bütün proje kuralları @.agent-source/project/instructions.md
     dosyasındadır. Önce onu oku.`
   - `project/opencode.json` → `instructions` dizisinin **başına**
     `.agent-source/project/instructions.md` ekle
   - **Codex hedefliyse ve 3. adımda "Codex team politikası" bölümünü ayırdıysan:**
     `.agent-source/project/codex-team.md`'yi kontrol et — bu içeriği taşımıyorsa
     ayırdığın metni oraya ekle. Zaten taşıyorsa (çoğu zaman öyledir, çünkü dosya bu
     projede zaten vardı) hiçbir şey yapma.

   Yalnız hedeflenen ekosistemlerin dosyalarıyla ilgilen. Tek ekosistemli bir projede
   (ör. yalnız OpenCode) `CLAUDE.md` zaten yoktur.

6. **`sync` çalıştır** ve sonucu raporla: hangi bloklar işaretlendi, hangileri
   işaretsiz kaldı, hangi dosyalar referansa döndü.

### `instructions.md` var ama işaretsiz — ya da yarım işaretli

Bu da göç sayılır — yalnız 4. adım çalışır. 2., 3. ve 5. adımlar atlanır.

**Yarım işaretli dosya da buraya girer.** Önceki bir göç yarıda kesilmiş ya da bir blok
bilerek işaretsiz bırakılmış olabilir. 4. adımı yalnız **işaretsiz kalan** açık
preset'ler için çalıştır; zaten işaretli olanlara dokunma.

## Referans eksikse

`sync` çalıştırdığında `.agent-source/project/CLAUDE.md` ya da `AGENTS.md`'nin ortak
talimat referansını kaybettiğine dair uyarı görürsen, **önce hangi durum olduğuna bak:**

**`.agent-source/project/instructions.md` var mı?**

- **Yoksa** → bu proje henüz göç etmemiştir; uyarı bir kayıp değil, eksik göçtür.
  Referansı **ekleme** — eklersen var olmayan bir dosyayı gösteren bir satır üretirsin ve
  `sync` onu canlı `CLAUDE.md`'ye kopyalar; `--check` bunu yakalamaz, çünkü yalnız
  üretileni kaynakla karşılaştırır, referansın çözülüp çözülmediğine bakmaz. Bunun yerine
  *Göç* bölümüne geç.
- **Varsa** → referans gerçekten kaybolmuştur. Kullanıcıya **eklemeyi teklif et**. Kabul
  ederse satırı geri koy:

- `CLAUDE.md` → `@.agent-source/project/instructions.md`
- `AGENTS.md` → `Bütün proje kuralları @.agent-source/project/instructions.md dosyasındadır. Önce onu oku.`

Reddederse zorlama — ama uyarı her `sync`'te tekrar çıkacak, bunu söyle.
