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

Cevabı **hem manifest'e hem render edilen bloğa** yaz. İkisi ayrışırsa blok yalan söyler.

## Zaten açık/kapalı olan

Kullanıcı zaten açık bir preset'i açmak isterse **işlem yapma**, durumu söyle. Aynısı
kapalıyı kapatmak için de geçerli.

## Referans eksikse

`sync` çalıştırdığında `.agent-source/project/CLAUDE.md` ya da `AGENTS.md`'nin ortak
talimat referansını kaybettiğine dair uyarı görürsen, kullanıcıya **eklemeyi teklif
et**. Kabul ederse satırı geri koy:

- `CLAUDE.md` → `@.agent-source/project/instructions.md`
- `AGENTS.md` → `Bütün proje kuralları @.agent-source/project/instructions.md dosyasındadır. Önce onu oku.`

Reddederse zorlama — ama uyarı her `sync`'te tekrar çıkacak, bunu söyle.
