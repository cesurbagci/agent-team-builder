# plan-gate.md — Plan Kapısı Kurulum Sözleşmesi

> Paylaşılan referans. Anayasa KARAR 5 (`planGate`) açıkken geçerlidir.
> Kapı sahipleri ve executor başka bir ekosistemde olabilir; çağrı kuralları `work-plan`
> skill'indedir (*Başka ekosistemdeki kapı sahibi*, *Başka ekosistemdeki executor*).
> **Bu dosya kurulum sözleşmesidir:** hangi dosyalar üretilir, veri modeli nedir, neler
> doğrulanır. **Runtime prosedürünü anlatmaz** — o, projeye kurulan `work-plan`
> skill'inin tek sorumluluğudur. Aynı kuralı iki yerde anlatmak drift üretir.

## Üretilen dosyalar

```
.agent-work/                    ← generated DEĞİL; agent'ların çalışma alanı
├── README.md   TEMPLATE.md
├── inbox/   draft/   approved/   in-progress/   done/

.agent-source/skills/work-plan/SKILL.md   ← canonical kaynak; sync ekosistem skill
                                            dizinlerine mirror'lar (mirror'lar generated)
```

- `TEMPLATE.md` ← `templates/plan.md`
- `.agent-source/skills/work-plan/SKILL.md` ← `templates/work-plan-skill.md`
- **Tüm insan-okur metinler `docLanguage` dilinde üretilir**; şablonlar Türkçe
  referanstır, verbatim kopyalanmaz.
- `.agent-work/` **generated değildir**: `sync` onu üretmez, drift kontrolüne sokmaz,
  generated-file ledger'ı sahiplenmez. Setup boş iskeleti bir kez kurar.
- Skill dosyasının kendisi de generated değildir. Setup onu şablondan **bir kez** render
  eder ve o andan sonra `.agent-source/` ağacının sıradan bir parçasıdır; `sync` onu
  okur ve ekosistem dizinlerine yansıtır. Generated olan **mirror'lardır**.
  (`.agent-source/` içindeki tek generated dosya `generated-files.json`'dır —
  `canonical-source.md`.)

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
{ by: <ekosistem>/<agent-adı> | system | user/<agent-adı>, at: <YYYY-MM-DD>,
  revision: <n>, verdict: approved | rejected | skipped,
  reasons: [<madde>, ...] }
```

- `by`: üç biçim — `<ekosistem>/<agent-adı>`, `system`, `user/<agent-adı>` (`user` bir
  ekosistem değil, ayrı bir ön ek). İki yönlü kural: `system` ve `user/` **yalnız**
  `skipped` kayıtlarında bulunur, **ve** her `skipped` kaydı ikisinden birini taşır;
  `approved`/`rejected` ikisini de asla taşımaz. Çıplak `user` geçersiz: feragat bir
  sahibe bağlıdır, sahip değişirse düşer.
- `reasons`: **her zaman dizi**; `rejected` boş olamaz, `skipped` + `by: user/<agent-adı>`
  de boş olamaz (kullanıcının gerekçesi). `approved` ve `skipped` + `by: system` → `[]`.
- Kayıtlar **asla silinmez**; sonraki kayıt öncekini geçersiz kılar.

## Kapı yüklemleri

**`planReviewPassed(plan, manifest)` — kalıcı.** Dosyayla taşınır, **çağıran oturumdan
bağımsızdır**. Karşılaştırılacak **ad** planın manifest'teki güncel sahibinden gelir,
çağıran oturumdan değil — plan dosyaları paylaşılır ve onay hangi oturumdan bakıldığına
göre değişmemelidir.
**Ekosistem** ise denetimin fiilen çalıştığı yerdir ve sahibin etkin hedeflerinden biri
olmalıdır; denetleyici projenin başka bir ekosisteminde üretilmiş olabilir.

| `planReviewer` | Son kayıt | `kayıt.by` |
|---|---|---|
| Bir agent adı | `approved` | `<denetimin ekosistemi>/<güncel sahip>` — ekosistem sahibin etkin hedeflerinden biri |
| Bir agent adı | `skipped` | `user/<güncel sahip>` — kullanıcı feragati |
| `null` | `skipped` | `system`, sahip hâlâ `null` |

Üçünde de `kayıt.revision === plan.revision`. Ad karşılaştırması **güncel** sahibe
karşıdır: sahip değişirse onay da feragat de düşer.

**`doneAuthorized` — anlık.** `in-progress/ → done/` hareketini yetkilendirir, saklanmaz;
bu yüzden dosyaya bakarak doğrulanamaz ve klasör değişmezi değildir. Yetkiyi veren, kaydın
içeriği değil **kaydı o turun yazmış olmasıdır**; önceki bir turdan kalan kayıt ne derse
desin yetki vermez. **Yalnız başarılı tamamlamayı korur** — iptal ayrı bir geçiştir. Yüklemin nasıl elde edildiği runtime
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
- Hedeflenen her ekosistemde en az bir uygun executor bulunmalı. Bu kural hedeflenen
  ekosistemleri **tüm** agent'lardan hesaplar, kapı sahibi dahil.
- Kapı sahibinin, uygun executor'ların ekosistemlerini **kapsaması gerekmez.** Sahip
  oturumun ekosisteminde üretilmemişse harici CLI çağrısıyla kendi ekosisteminde
  çalıştırılır; prosedür `templates/work-plan-skill.md`'nin *Başka ekosistemdeki kapı
  sahibi* bölümündedir.
- Agent adları benzersiz (büyük/küçük harf duyarsız) ve slug kuralına uygun olmalı.

Bu doğrulamaların kod tarafı `validate-manifest.mjs`'e aittir (ayrı iş).

## Runtime kabul senaryoları

`work-plan` skill'inin davranışı otomatik testle kapsanamaz — bir agent'ın bir oturumda
nasıl davrandığını ölçüyor. Bu yüzden kabul **elle yürütülen senaryolarla** yapılır ve
senaryo listesi tasarım dokümanındadır:

- **`R` senaryoları** — yaşam döngüsünün her geçişi (plan yazımı, kapı onayı/reddi,
  revizyon bayatlaması, havuz seçimi, yarım iş devamı, iptal, ekosistem çözümlemesi)
- **`N` senaryoları** — değişmez savunmaları (geçersiz klasör hareketi, bozuk kayıt şeması,
  kapalı inbox anahtar listesi, dosya adı/`id` uyumsuzluğu)

Aralıklar burada **sayı olarak yazılmaz**: liste büyüdükçe bayatlar ve bayat bir aralık
son senaryoları sessizce kabulün dışında bırakır.

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
