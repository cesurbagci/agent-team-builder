---
name: team-builder-upgrade
description: Kurulmuş bir projede anayasa preset'lerini (geçici çözüm yok, kod-doküman senkronizasyonu, rol başına hafıza, dil standardı, plan kapısı) açar veya kapatır; plan kapısının artefaktlarını kurar ya da bırakır; eski yapıdaki projeleri tek talimat dosyasına göç ettirir. Tetikleyiciler — "plan kapısını aç", "preset aç", "preset kapat", "anayasa değiştir", "takımı yükselt". Yeni rol/routing/ekosistem eklemek için kullanma; o setup'ın işidir.
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
6. **`sync` çalıştır.**
7. **Doğrula ve raporla.**

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

   Seçilen agent **kod yazmayan** bir agent olmalı (`writesCode: false`). Kullanıcı kod
   yazan bir rol seçerse söyle ve tekrar sor — doğrulayıcı zaten reddeder, ama hatayı
   sihirbaz aşamasında yakalamak daha iyidir.
2. **Manifest'i yaz:** `constitution.planGate: true` **ve** kök `planGate` nesnesi
   (`planReviewer`, `codeReviewer` — ikisi de zorunlu, değer ad ya da `null`).
3. **Bloğu ekle:** `<!-- c:planGate -->` … `<!-- /c:planGate -->`, şablondan render
   edilmiş, denetleyici adları doldurulmuş.
4. **Skill kaynağını üret:** `.agent-source/skills/work-plan/SKILL.md` —
   `~/.claude/skills/team-builder-shared/templates/work-plan-skill.md`'den,
   `docLanguage`'e çevrilerek. **İşaretler çevrilmez.**
5. **İskeleti kur:** `.agent-work/` altında `README.md`, `TEMPLATE.md` (bu da
   `templates/plan.md`'den render edilir) ve beş klasör: `inbox/ draft/ approved/
   in-progress/ done/`.
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
4. **`sync` çalıştır**
5. **`sync`'in `(stale)` diye raporladığı hedeflerden yalnız `work-plan` yolunda
   olanları sil.** `.agents/skills/work-plan/` **her projede** çıkar (o kopya ekosistem
   koşulsuz üretilir); `.claude/skills/work-plan/` ve `.opencode/skills/work-plan/` ise
   ilgili ekosistem hedefleniyorsa. **Listedeki başka yollara dokunma** — aynı koşuda
   ilgisiz bir stale girdi de raporlanmış olabilir ve onu silmek bu işlemin
   duyurulmamış bir yan etkisi olur.
6. **Silinenleri kullanıcıya listele**

### Sıra önemlidir

Adım 3 (kaynağı sil) adım 4'ten (`sync`) **önce** gelmeli. Kaynak hâlâ diskteyken `sync`
çalışırsa `work-plan`'ı olduğu gibi yeniden yansıtır, hiçbir şeyi stale işaretlemez ve
konfigürasyonun zaten güncel olduğunu bildirir — adım 5'te temizlenecek hiçbir hedef
görünmez.

## Referans eksikse

`sync` çalıştırdığında `.agent-source/project/CLAUDE.md` ya da `AGENTS.md`'nin ortak
talimat referansını kaybettiğine dair uyarı görürsen, kullanıcıya **eklemeyi teklif
et**. Kabul ederse satırı geri koy:

- `CLAUDE.md` → `@.agent-source/project/instructions.md`
- `AGENTS.md` → `Bütün proje kuralları @.agent-source/project/instructions.md dosyasındadır. Önce onu oku.`

Reddederse zorlama — ama uyarı her `sync`'te tekrar çıkacak, bunu söyle.
