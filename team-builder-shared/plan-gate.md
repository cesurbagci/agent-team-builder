# plan-gate.md — Plan Kapısı Kurulum Sözleşmesi

> Paylaşılan referans. Anayasa KARAR 5 (`planGate`) açıkken geçerlidir.
> **Bu dosya kurulum sözleşmesidir:** hangi dosyalar üretilir, veri modeli nedir, neler
> doğrulanır. **Runtime prosedürünü anlatmaz** — o, projeye kurulan `work-plan`
> skill'inin tek sorumluluğudur. Aynı kuralı iki yerde anlatmak drift üretir.

## Üretilen dosyalar

```
.agent-work/                    ← generated DEĞİL; agent'ların çalışma alanı
├── README.md   TEMPLATE.md
├── inbox/   draft/   approved/   in-progress/   done/

.agent-source/skills/work-plan/SKILL.md   ← generated; ekosistem skill dizinlerine mirror
```

- `TEMPLATE.md` ← `templates/plan.md`
- `.agent-source/skills/work-plan/SKILL.md` ← `templates/work-plan-skill.md`
- **Tüm insan-okur metinler `docLanguage` dilinde üretilir**; şablonlar Türkçe
  referanstır, verbatim kopyalanmaz.
- `.agent-work/` **generated değildir**: `sync` onu üretmez, drift kontrolüne sokmaz,
  generated-file ledger'ı sahiplenmez. Setup boş iskeleti bir kez kurar.

## Makine işaretleri

Kurallar bölüm başlıklarına bakamaz — başlıklar `docLanguage`'e çevrilir. Bu yüzden her
gövde bölümü sabit bir HTML yorumuyla işaretlenir:

| İşaret | Bölüm | `revision` artırır |
|---|---|---|
| `<!-- s:what -->` | Ne ve neden (kabul kriteri burada) | Evet |
| `<!-- s:how -->` | Nasıl | Evet |
| `<!-- s:questions -->` | Açık sorular | Evet |
| `<!-- s:review-notes -->` | Denetim notları | Hayır |
| `<!-- s:progress -->` | İlerleme | Hayır |

İşaretler tam bu yorum biçiminde yazılır; çıplak ad (`s:what`) düzyazıda da geçer ve
kopyalanacak şey yorumun kendisidir.

İki sabit dize daha üretilir ve şablonlarda birebir bulunmalıdır: sentinel
`<!-- progress:not-started -->` ve iptal etiketi `<!-- note:cancelled -->`. **Ne zaman
yazılıp silindikleri runtime kuralıdır ve `work-plan` skill'ine aittir**, burada
anlatılmaz.

## Veri modeli

### `inbox/` kaydı — anahtar listesi KAPALI

Yalnız `id`, `title`, `created`, `source`. Başka herhangi bir anahtar kaydı geçersiz kılar.

`source` grameri: `user` **veya** `agent:<agent-adı>`. Değer yakalama anının kaydıdır; o
agent sonradan çıkarılsa bile geçerli kalır.

### Plan dosyası

| Alan | Kural | `revision` artırır |
|---|---|---|
| `id` | Zorunlu, değişmez, `<YYYYMMDD>-<n{2,}>` | Hayır |
| `title` | Zorunlu | Evet |
| `revision` | Zorunlu, 1'den başlar, pozitif tam sayı | — |
| `created`, `source` | Zorunlu, **değiştirilemez** | Hayır |
| `domain`, `paths` | Zorunlu | Evet |
| `executor` | Zorunlu, `<ekosistem>/<agent-adı>` | Evet |
| `reviews` | Zorunlu (`plan-review` ve `code-review` dizileri) | Hayır |
| `outcome` | **Yalnız `done/`'da**, tek değer `cancelled` | Hayır |
| `adr` | Opsiyonel | Hayır |

Dosya adı: `<id>-<slug>.md`. `<slug>` `title`'dan türetilir,
`^[a-z0-9]+(?:-[a-z0-9]+)*$` kuralına uyar; tekilliği `id` sağlar, slug okunabilirlik
içindir.

### Denetim kaydı

```yaml
{ by: <ekosistem>/<agent-adı> | system, at: <YYYY-MM-DD>, revision: <n>,
  verdict: approved | rejected | skipped, reasons: [<madde>, ...] }
```

- `by`: `skipped` kayıtlarında **`system`**; diğerlerinde asla `system` değil.
- `reasons`: **her zaman dizi**; `rejected` ise boş olamaz.
- Kayıtlar **asla silinmez**; sonraki kayıt öncekini geçersiz kılar.

## Kapı yüklemleri

**`planReviewPassed(plan, manifest)` — kalıcı.** Dosyayla taşınır, **çağıran oturumdan
bağımsızdır**. Karşılaştırılacak sahip kimliği planın kendi `executor` ekosisteminden
kurulur (`<executor.ecosystem>/<planReviewer>`), çağıran oturumdan değil — plan dosyaları
paylaşılır ve onay hangi oturumdan bakıldığına göre değişmemelidir.

| `planReviewer` | Koşul |
|---|---|
| Bir agent adı | Son kayıt `approved`, `kayıt.revision === plan.revision`, `kayıt.by` güncel sahiple aynı |
| `null` | Son kayıt `skipped`, `kayıt.revision === plan.revision`, sahip hâlâ `null` |

**`doneAuthorized` — anlık.** `in-progress/ → done/` hareketini yetkilendirir, saklanmaz;
bu yüzden dosyaya bakarak doğrulanamaz ve klasör değişmezi değildir. **Yalnız başarılı
tamamlamayı korur** — iptal ayrı bir geçiştir. Yüklemin nasıl elde edildiği runtime
kuralıdır ve skill'e aittir.

## Klasör değişmezleri

| Klasör | Değişmez |
|---|---|
| `inbox/` | `revision`, `reviews`, `executor`, `outcome` bulunmaz |
| `draft/` | `revision` var; `s:progress` mevcut — hiç başlanmamışsa sentinel'li, `in-progress/`'ten geri döndüyse korunmuş ilerlemeyle |
| `approved/` | `planReviewPassed` doğru; `s:progress` `draft/`'taki gibi (sentinel ya da korunmuş ilerleme) |
| `in-progress/` | `planReviewPassed` doğru; `s:progress` doldurulmuş |
| `done/` | **Arşivdir, yeniden değerlendirilmez** |

`done/` neden yeniden değerlendirilmez: `planReviewPassed` güncel sahibe bakar; kapı sahibi
sonradan değişirse tamamlanmış işler geriye dönük geçersiz görünürdü. Kayıtlar
tamamlanma anındaki durumu zaten taşır. **Sahip değişiminin diğer klasörlerde ne
yaptığı runtime kuralıdır ve skill'e aittir.**

Frontmatter'da `status` alanı **yoktur**; durum dosyanın bulunduğu klasördür.

## Kurulum sırasında doğrulananlar

Sihirbaz üretimden **önce** şunları denetler:

- `constitution.planGate: true` ise kök `planGate` nesnesi zorunlu; `false`/yok ise
  bulunmamalı.
- `planReviewer` ve `codeReviewer` anahtarları ikisi de zorunlu; değer agent adı ya da
  `null`.
- Kapı sahibi **kod yazmayan** agent olmalı (`writesCode === false`; alan verilmemişse
  agent kod yazar sayılır).
- Kapı sahibinin **etkin hedefleri**, tüm **uygun executor'ların** (routing'de geçen ve
  kod yazan agent'lar) etkin hedeflerinin birleşimini kapsamalı.
- Hedeflenen her ekosistemde en az bir uygun executor bulunmalı.
- Agent adları benzersiz (büyük/küçük harf duyarsız) ve slug kuralına uygun olmalı.

Bu doğrulamaların kod tarafı `validate-manifest.mjs`'e aittir (ayrı iş).

## Runtime kabul senaryoları

`work-plan` skill'inin davranışı otomatik testle kapsanamaz — bir agent'ın bir oturumda
nasıl davrandığını ölçüyor. Bu yüzden kabul **elle yürütülen senaryolarla** yapılır ve
senaryo listesi tasarım dokümanındadır:

- **R1–R41** — yaşam döngüsünün her geçişi (plan yazımı, kapı onayı/reddi, revizyon
  bayatlaması, havuz seçimi, yarım iş devamı, iptal, ekosistem çözümlemesi)
- **N1–N25** — değişmez savunmaları (geçersiz klasör hareketi, bozuk kayıt şeması, kapalı
  inbox anahtar listesi, dosya adı/`id` uyumsuzluğu)

Kaynak: `docs/superpowers/specs/2026-08-02-plan-gate-design.md`. Liste burada
**tekrarlanmaz** — iki yerde tutmak drift üretir; skill değiştiğinde tek yer güncellenir.

## Artefakt doğrulaması

Bu dosyanın ve şablonların yapısal tutarlılığı makine tarafından denetlenir:

```bash
node team-builder-shared/validate-plan-gate.mjs --root <repo-kökü>
```

Denetlenenler: beş `s:*` işareti şablonda **tam bir kez** ve sırayla var mı, sentinel var
mı, plan frontmatter alanları **frontmatter bloğunun içinde** eksiksiz mi, skill şablonu
geçerli frontmatter taşıyor mu, bu dosya her işareti yorum biçiminde belgeliyor mu, ve
`team-builder-shared/` altında — symlink'lerin arkası dahil — kazara `SKILL.md` adında
dosya var mı.

## Architect'siz takım

Architect yoksa `docs/` özel sahipliği olmayan sıradan bir dizindir ve danışma hedefi
**kullanıcıdır**. Bu koşul `routing.md`, `agent-md-rich.md`, `governance-defaults.md` ve
`team-builder-setup/SKILL.md`'de birlikte uygulanır — biri koşullanmazsa `docs/` sahipsiz
kalırken yasak sürer.
