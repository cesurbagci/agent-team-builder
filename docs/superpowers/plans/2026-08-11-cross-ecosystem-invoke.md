# Çapraz Ekosistem Agent Çağırma (kapsam B) — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan kapısı sahibi oturumun ekosisteminde üretilmemişse, kapıyı harici bir CLI çağrısıyla o sahibin bulunduğu ekosistemde işletmek — ve bunu doğrulayıcıların zorladığı kurallarla tutarlı hale getirmek.

**Architecture:** Bu iş **runtime davranışını ve doğrulama kurallarını** değiştirir; `sync` çıktısını değiştirmez. Üç katman var: (1) projeye giden tek runtime otoritesi olan `templates/work-plan-skill.md` — çağrı dizisi, verdict protokolü ve yüklem burada tarif edilir; (2) kurulum sözleşmesi `plan-gate.md` ile referans dokümanlar — skill ile birebir aynı şeyi söylemek zorundalar; (3) iki doğrulayıcı — `validate-manifest.mjs` (manifest kuralları) ve `validate-plan-gate.mjs` (şablon/doküman denetimi). Kod yazılan tek yer doğrulayıcılardır; geri kalanı dokümandır ve `validate-plan-gate.mjs` onların geride kalmasını engeller.

**Tech Stack:** Node.js ESM (bağımlılıksız), `node --test` yok — her iki doğrulayıcı kendi `--selftest` bayrağını taşıyor ve testler o harness'a eklenir. Markdown dokümanlar.

## Global Constraints

- **Doküman dili Türkçe.** Bu repodaki `team-builder-shared/*.md` dosyaları Türkçe yazılır; kod içi yorumlar ve hata mesajları mevcut dosyanın kendi diline uyar (`validate-manifest.mjs` hata mesajları Türkçe, yorumları İngilizce; `validate-plan-gate.mjs` hata mesajları İngilizce).
- **Yeni bağımlılık yok.** Her iki doğrulayıcı da yalnız Node stdlib kullanır.
- **Üretilen dosyalar değişmez.** `sync-agent-config.mjs` bu planda **hiç değiştirilmez**. Değiştirmek gerektiğini düşünüyorsan dur ve sor.
- **`by` grameri:** `<ekosistem>/<agent-adı>` **ya da** `system` **ya da** `user/<agent-adı>`. Çıplak `user` geçersizdir.
- **Ekosistem kümesi:** `claude`, `codex`, `opencode`. `user` bir ekosistem **değildir**.
- **Kayıt alanları beş tane, kapalı liste:** `by`, `at`, `revision`, `verdict`, `reasons`. Bu planda yeni alan eklenmez.
- **Her commit'ten önce ilgili doğrulayıcının selftest'i geçmeli:**
  `node team-builder-shared/validate-manifest.mjs --selftest` ve
  `node team-builder-shared/validate-plan-gate.mjs --selftest`.
- **Spec:** `docs/superpowers/specs/2026-08-11-cross-ecosystem-invoke-design.md`. Bir çelişki görürsen spec kazanır; spec'in kendisi yanlışsa dur ve sor.

---

## Dosya yapısı

| Dosya | Sorumluluk | Bu planda |
|---|---|---|
| `team-builder-shared/templates/work-plan-skill.md` | Projeye kopyalanan **tek** runtime otoritesi. Kapı prosedürü, kayıt şeması, yüklemler, yeni çapraz çağrı bölümü. | Görev 2, 3, 4 |
| `team-builder-shared/plan-gate.md` | Kurulum sözleşmesi — sihirbaz buradan okur, projeye **gitmez**. Kayıt şeması + yüklem tablosu. | Görev 2, 3 |
| `team-builder-shared/validate-plan-gate.mjs` | Şablon/doküman denetimi. Skill'in kuralları belgelemeyi bırakmasını engeller. | Görev 1, 5 |
| `team-builder-shared/validate-manifest.mjs` | Manifest kuralları + selftest. | Görev 6, 7 |
| `team-builder-shared/manifest-schema.md` | Doğrulama kuralları listesi; sihirbazın elle doğrulama fallback'i buraya bakıyor. | Görev 6, 7 |
| `team-builder-shared/codex-target.md` | Codex hedefi ayrıntıları — komut eşlemesi, sandbox bayrağı, model/effort sınırı. | Görev 8 |
| `team-builder-shared/opencode-target.md` | OpenCode hedefi ayrıntıları — komut eşlemesi, sandbox bayrağı. | Görev 8 |
| `docs/superpowers/specs/2026-08-02-plan-gate-design.md` | Çekirdek spec — N14 revizyonu, yüklem tablosu, KARAR 21'in kapanışı. | Görev 9 |

**Yeni dosya yok.** `route-globs.mjs` gibi ayrı bir modül gerekmiyor: bu planda paylaşılan yeni bir algoritma yok, kural metni ve doğrulama var.

---

### Task 1 — Görev 1: `by` gramerini doğrulayıcıya bir sabit olarak tanıt

Skill ve sözleşme dokümanları `user/<ad>` gramerini gerçekten belgeliyor mu — bunu mekanik olarak denetleyecek altyapıyı **önce** kur. Böylece sonraki görevlerde dokümanı değiştirmeyi unutmak testte patlar.

**Files:**
- Modify: `team-builder-shared/validate-plan-gate.mjs`

**Interfaces:**
- Consumes: yok (ilk görev).
- Produces: `export const BY_GRAMMAR_TOKENS` — `string[]`, doküman metninde geçmesi zorunlu gramer parçaları. Görev 5 bunu genişletir; görev 2 ve 3 dokümanları bu listeyi sağlayacak şekilde yazar.

- [ ] **Step 1: Failing test'i yaz**

`team-builder-shared/validate-plan-gate.mjs` selftest'inde `// --- skill template ---` bloğu var (dosyanın 507. satırı civarı). O bloğun **sonuna**, `description` vakalarının ardına ekle:

```js
    // The shipped skill is the only copy of the record schema a project sees.
    // If it stops naming an accepted `by` form, agents stop writing it while
    // the validator still accepts one — the two drift apart silently.
    await expectError(
      'does not document by-value form user/<agent-adı>',
      'a shipped skill that dropped the user waiver form',
      () => fs.writeFile(skillPath, GOOD_SKILL.replace('user/<agent-adı>', 'user'))
    )
```

`expectError(fragment, what, mutate)` bu dosyanın kendi harness'ıdır (364. satır civarı): mutasyonu uygular, `fragment`'i içeren bir bulgu bekler, sonra fixture'ı geri yükler. Yeni bir yardımcı yazma.

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest`
Expected: FAIL — `a shipped skill that dropped the user waiver form — expected a finding containing "does not document by-value form user/<agent-adı>", got: (none)`

(Ne `BY_GRAMMAR_TOKENS` var ne de `GOOD_SKILL` bu dizeyi içeriyor; `replace` hiçbir şey değiştirmiyor ve denetim de yok, dolayısıyla hiç bulgu çıkmıyor.)

- [ ] **Step 3: Sabiti ve denetimi ekle**

`SECTION_MARKERS` tanımının hemen altına (dosyanın 17. satırı civarı):

```js
// Every accepted `by` value form. The shipped skill is the only copy of the
// record schema a project sees; if it stops naming a form, agents stop writing
// it while the validator still accepts it — the two drift apart silently.
export const BY_GRAMMAR_TOKENS = [
  '<ekosistem>/<agent-adı>',
  'system',
  'user/<agent-adı>',
]
```

Not: `'system'` pratikte her zaman eşleşir — metinde başka bağlamlarda da geçen bir kelime, yani zayıf bir denetim. Listede **tamlık için** durur (gramerin üç biçimi de belgelenmiş olsun). Gerçek koruma öbür iki tokenda; drift oralarda olur.

`GOOD_SKILL` fixture'ına gramer satırlarını ekle (mevcut dizinin sonuna, `CANCEL_NOTE_TAG`'den sonra):

```js
  ...BY_GRAMMAR_TOKENS,
```

Skill denetim bloğuna (`CANCEL_NOTE_TAG` denetiminin hemen ardına, aynı `if (skillTpl)` gövdesi içinde):

```js
    for (const token of BY_GRAMMAR_TOKENS) {
      if (!skillTpl.includes(token)) {
        errors.push(
          `templates/work-plan-skill.md does not document by-value form ${token}`
        )
      }
    }
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest`
Expected: PASS — selftest'in kendi başarı çıktısı (mevcut gövde ne yazıyorsa), hata satırı yok.

- [ ] **Step 5: Gerçek dosyaya karşı çalıştır ve **başarısız** olduğunu gör**

Run: `node team-builder-shared/validate-plan-gate.mjs`
Expected: FAIL — `templates/work-plan-skill.md does not document by-value form user/<agent-adı>`

Bu beklenen bir kırmızıdır: doğrulayıcı artık gerçek skill'den bir şey istiyor, skill henüz vermiyor. Görev 2 bunu yeşile çevirir. **Bu görevi commit'lerken repo bu kırmızıyı taşır** — sonraki görev onu kapatana kadar.

- [ ] **Step 6: Commit**

```bash
git add team-builder-shared/validate-plan-gate.mjs
git commit -m "test: require the shipped skill to document every by-value form"
```

---

### Task 2 — Görev 2: `user/<ad>` gramerini kayıt şemalarına yaz

**Files:**
- Modify: `team-builder-shared/templates/work-plan-skill.md:103-124` (`### Denetim kaydı şeması`)
- Modify: `team-builder-shared/plan-gate.md:73-82` (`### Denetim kaydı`)

**Interfaces:**
- Consumes: `BY_GRAMMAR_TOKENS` (görev 1) — dokümanlar bu dizeleri **birebir** içermeli.
- Produces: iki dosyada aynı `by` grameri ve `reasons` kuralı. Görev 3 bunun üstüne yüklem tablolarını kurar.

- [ ] **Step 1: `work-plan-skill.md` kayıt şemasını güncelle**

`templates/work-plan-skill.md` içinde şu bloğu:

```yaml
{ by: <ekosistem>/<agent-adı> | system, at: <YYYY-MM-DD>, revision: <n>,
  verdict: approved | rejected | skipped, reasons: [<madde>, ...] }
```

şununla değiştir:

```yaml
{ by: <ekosistem>/<agent-adı> | system | user/<agent-adı>, at: <YYYY-MM-DD>,
  revision: <n>, verdict: approved | rejected | skipped,
  reasons: [<madde>, ...] }
```

Ardından `by` ve `reasons` madde açıklamalarını değiştir. Mevcut:

```markdown
- `by`: `<ekosistem>/<agent-adı>` biçimi zorunlu — çıplak ad (`architect`), eksik parça
  (`claude/`) ya da boş parça (`//x`) geçersizdir. **Yalnız `skipped`** kayıtlarında
  `system` yazılır; `approved` ve `rejected` kayıtlarında **asla** `system` olamaz.
```

Yerine:

```markdown
- `by`: üç biçimden biri — `<ekosistem>/<agent-adı>`, `system`, ya da
  `user/<agent-adı>`. Çıplak ad (`architect`), eksik parça (`claude/`), boş parça
  (`//x`) ve **çıplak `user`** geçersizdir. Ekosistem yalnız `claude`, `codex` ya da
  `opencode` olabilir; `user` bir ekosistem değildir, ayrı bir ön ektir.
  - `system` — denetleyici tanımsız. Yalnız `skipped`.
  - `user/<agent-adı>` — adı geçen kapı sahibine ulaşılamadı, kullanıcı kapıyı atladı.
    Yalnız `skipped`. Ad **zorunludur**: feragat o sahibe verilmiştir, sahip sonradan
    değişirse feragat düşmelidir — tıpkı onay gibi.
  - `approved` ve `rejected` kayıtlarında `system` ve `user/` **asla** bulunmaz.
```

Ve `reasons` maddesini. Mevcut:

```markdown
- `reasons`: **her zaman dizi** — `approved` ve `skipped` kayıtlarında `[]`, `rejected`
  kayıtlarında **boş olamaz**. Metin ya da eksik alan geçersizdir.
```

Yerine:

```markdown
- `reasons`: **her zaman dizi**. Metin ya da eksik alan geçersizdir.
  - `approved` → `[]`. Denetleyici gerekçe yazsa bile kayda `[]` geçer.
  - `rejected` → **boş olamaz**.
  - `skipped` + `by: system` → `[]` — söylenecek bir şey yok, denetleyici tanımsız.
  - `skipped` + `by: user/<ad>` → **boş olamaz**. Kaydın bütün denetim değeri burada:
    hangi planın hangi kapıyı neden atladığı. Kullanıcı gerekçe vermezse kapı atlanmaz.
```

- [ ] **Step 2: Doğrulayıcıyı çalıştır, yeşile döndüğünü gör**

Run: `node team-builder-shared/validate-plan-gate.mjs`
Expected: PASS — görev 1'in bıraktığı `user/<agent-adı>` hatası kalktı, yeni hata yok.

- [ ] **Step 3: `plan-gate.md` kayıt şemasını aynı hale getir**

`plan-gate.md` içinde:

```yaml
{ by: <ekosistem>/<agent-adı> | system, at: <YYYY-MM-DD>, revision: <n>,
  verdict: approved | rejected | skipped, reasons: [<madde>, ...] }
```

→

```yaml
{ by: <ekosistem>/<agent-adı> | system | user/<agent-adı>, at: <YYYY-MM-DD>,
  revision: <n>, verdict: approved | rejected | skipped,
  reasons: [<madde>, ...] }
```

Ve altındaki iki maddeyi:

```markdown
- `by`: `skipped` kayıtlarında **`system`**; diğerlerinde asla `system` değil.
- `reasons`: **her zaman dizi**; `rejected` ise boş olamaz.
```

→

```markdown
- `by`: üç biçim — `<ekosistem>/<agent-adı>`, `system`, `user/<agent-adı>`. `system` ve
  `user/` **yalnız** `skipped` kayıtlarında; `approved`/`rejected` kayıtlarında asla.
  Çıplak `user` geçersiz: feragat bir sahibe bağlıdır, sahip değişirse düşer.
- `reasons`: **her zaman dizi**; `rejected` boş olamaz, `skipped` + `by: user/<ad>` de
  boş olamaz (kullanıcının gerekçesi). `approved` ve `skipped` + `by: system` → `[]`.
```

- [ ] **Step 4: İki doğrulayıcıyı da çalıştır**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs`
Expected: ikisi de PASS.

- [ ] **Step 5: Commit**

```bash
git add team-builder-shared/templates/work-plan-skill.md team-builder-shared/plan-gate.md
git commit -m "feat: add user/<ad> to the by grammar in both record schemas"
```

---

### Task 3 — Görev 3: Yüklem tablolarına üçüncü satırı ekle

Bu, spec'in en kolay atlanan noktası: kayıt yazılabilir olması onu **geçerli** yapmaz. `planReviewPassed` tablosu iki satırdı ve adlı bir denetleyici için `skipped` hiçbirini sağlamıyordu.

**Files:**
- Modify: `team-builder-shared/templates/work-plan-skill.md:125-135` (`### planReviewPassed`)
- Modify: `team-builder-shared/templates/work-plan-skill.md:241-249` (`done/`'a taşıma yetkisi)
- Modify: `team-builder-shared/plan-gate.md:85-96` (yüklem tablosu)

**Interfaces:**
- Consumes: görev 2'nin `by` grameri.
- Produces: üç yerde birbirinin aynı, üç satırlı yüklem. Görev 5 bu satırların varlığını mekanik olarak zorlar.

- [ ] **Step 1: `work-plan-skill.md` `planReviewPassed` tablosunu değiştir**

Mevcut:

```markdown
| Projenin plan denetleyicisi | Doğru olma koşulu |
|---|---|
| Bir agent adı | `plan-review`'ın **son** kaydı `approved`, `kayıt.revision === plan.revision`, ve `kayıt.by` = `<executor'ın ekosistemi>/<güncel denetleyici adı>` |
| Tanımsız (`null`) | `plan-review`'ın **son** kaydı `skipped`, `kayıt.revision === plan.revision`, ve denetleyici hâlâ tanımsız |
```

Yerine:

```markdown
Üç yoldan biriyle doğru olur. Hepsinde ortak: bakılan kayıt `plan-review`'ın **son**
kaydıdır ve `kayıt.revision === plan.revision` olmalıdır.

| Projenin plan denetleyicisi | Son kayıt | `kayıt.by` |
|---|---|---|
| Bir agent adı | `approved` | `<denetimin çalıştığı ekosistem>/<güncel denetleyici adı>` — ekosistem, denetleyicinin **etkin hedeflerinden biri** olmalı |
| Bir agent adı | `skipped` | `user/<güncel denetleyici adı>` — kullanıcı feragati |
| Tanımsız (`null`) | `skipped` | `system`, ve denetleyici **hâlâ** tanımsız |

Ad karşılaştırması üç satırda da **güncel** denetleyiciye karşıdır. Kapı sahibi
değişirse hem eski onaylar hem eski feragatler düşer; yeni sahiple kapıyı yeniden geç.

Ekosistem kısıtı `approved` satırında **denetimin çalıştığı** ekosistemdir, executor'ınki
değil — denetleyici başka bir ekosistemde çalışıyor olabilir (bkz. *Başka ekosistemdeki
kapı sahibi*).
```

- [ ] **Step 2: `done/`'a taşıma yetkisini aynı hale getir**

`## İşi bitirme` altındaki 3. maddede, mevcut iki mermi:

```markdown
   - denetleyici bir ad taşıyorsa: son kayıt `approved`, `kayıt.revision` planın
     `revision`'ına eşit **ve** `kayıt.by` **güncel** denetleyiciyle aynı. Denetleyici
     sonradan değiştiyse eski sahibin onayı yetki vermez — kapı 3'ü yeni sahiple
     çalıştır (`planReviewPassed` kapı 1 için aynı şeyi yapar);
   - denetleyici tanımsızsa: son kayıt `skipped`, `kayıt.revision` eşit **ve** denetleyici
     **hâlâ** tanımsız. Sonradan bir kod denetleyicisi tanımlandıysa eski `skipped` kaydı
     yetki vermez; kapı 3'ü çalıştır.
```

→ üç mermi:

```markdown
   - denetleyici bir ad taşıyorsa: son kayıt `approved`, `kayıt.revision` planın
     `revision`'ına eşit **ve** `kayıt.by` **güncel** denetleyiciyle aynı — ekosistem
     kısmı denetleyicinin etkin hedeflerinden biri olmalı. Denetleyici sonradan
     değiştiyse eski sahibin onayı yetki vermez — kapı 3'ü yeni sahiple çalıştır
     (`planReviewPassed` kapı 1 için aynı şeyi yapar);
   - denetleyici bir ad taşıyor ve kapıya ulaşılamadıysa: son kayıt `skipped`,
     `kayıt.revision` eşit **ve** `kayıt.by` = `user/<güncel denetleyici adı>`. Sahip
     değişmişse bu feragat de düşer;
   - denetleyici tanımsızsa: son kayıt `skipped`, `kayıt.revision` eşit, `kayıt.by` =
     `system` **ve** denetleyici **hâlâ** tanımsız. Sonradan bir kod denetleyicisi
     tanımlandıysa eski `skipped` kaydı yetki vermez; kapı 3'ü çalıştır.
```

- [ ] **Step 3: `plan-gate.md` yüklem tablosunu aynı hale getir**

Mevcut:

```markdown
| `planReviewer` | Koşul |
|---|---|
| Bir agent adı | Son kayıt `approved`, `kayıt.revision === plan.revision`, `kayıt.by` güncel sahiple aynı |
| `null` | Son kayıt `skipped`, `kayıt.revision === plan.revision`, sahip hâlâ `null` |
```

Yerine:

```markdown
| `planReviewer` | Son kayıt | `kayıt.by` |
|---|---|---|
| Bir agent adı | `approved` | `<denetimin ekosistemi>/<güncel sahip>` — ekosistem sahibin etkin hedeflerinden biri |
| Bir agent adı | `skipped` | `user/<güncel sahip>` — kullanıcı feragati |
| `null` | `skipped` | `system`, sahip hâlâ `null` |

Üçünde de `kayıt.revision === plan.revision`. Ad karşılaştırması **güncel** sahibe
karşıdır: sahip değişirse onay da feragat de düşer.
```

Bu bölümün üstündeki paragrafta *"Karşılaştırılacak sahip kimliği planın kendi `executor`
ekosisteminden kurulur (`<executor.ecosystem>/<planReviewer>`)"* cümlesi artık yanlış —
şununla değiştir:

```markdown
Karşılaştırılacak **ad** planın manifest'teki güncel sahibinden gelir, çağıran oturumdan
değil — plan dosyaları paylaşılır ve onay hangi oturumdan bakıldığına göre değişmemelidir.
**Ekosistem** ise denetimin fiilen çalıştığı yerdir ve sahibin etkin hedeflerinden biri
olmalıdır; denetleyici projenin başka bir ekosisteminde üretilmiş olabilir.
```

- [ ] **Step 4: Doğrulayıcıları çalıştır**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs`
Expected: ikisi de PASS.

- [ ] **Step 5: Commit**

```bash
git add team-builder-shared/templates/work-plan-skill.md team-builder-shared/plan-gate.md
git commit -m "feat: let a user waiver satisfy the gate predicates

Adli bir denetleyici icin skipped hicbir yuklem satirini saglamiyordu; atlama
kaydi yazilsa bile plan ilerleyemezdi. Ucuncu satir user/<ad> feragatini kabul
ediyor ve ad karsilastirmasi korundugu icin sahip degisince feragat de dusuyor."
```

---

### Task 4 — Görev 4: Çapraz çağrı bölümünü skill'e yaz

Bu görevin çıktısı projelere kopyalanan **tek** runtime otoritesidir. Buradaki her cümle bir agent'ın çalışma zamanında izleyeceği kuraldır; eksik bırakılan bir detay uydurulur.

**Files:**
- Modify: `team-builder-shared/templates/work-plan-skill.md` — `## Kapı sahipleri değişirse` bölümünün **hemen öncesine** yeni bölüm.

**Interfaces:**
- Consumes: görev 2'nin `by` grameri, görev 3'ün yüklemleri.
- Produces: `## Başka ekosistemdeki kapı sahibi` bölümü ve içinde `<!-- verdict -->` / `<!-- /verdict -->` işaretleri. Görev 5 bu işaretlerin varlığını zorlar.

- [ ] **Step 1: Bölümü ekle**

`## Kapı sahipleri değişirse` satırının hemen öncesine ekle:

````markdown
## Başka ekosistemdeki kapı sahibi

Kapı sahibi senin ekosisteminde üretilmemişse onu **harici CLI çağrısıyla** kendi
ekosisteminde çalıştırırsın. Kapı 1 ve kapı 3 için dizi aynıdır.

1. Sahibin **etkin hedeflerini** çöz (kendi `targets`'ı, yoksa `targetsDefault`).
   Senin ekosistemin bunlardan biriyse **çapraz çağrı yok** — normal yoldan çağır.
2. Değilse hedef ekosistem, etkin hedefler listesinin **sırasındaki ilkidir**.
   Kullanıcıya sorma.
3. Hedefin **rol tanımını oku**:
   `.claude/agents/<ad>.md`, `.codex/agent-definitions/<ad>.md`,
   `.opencode/agents/<ad>.md`. Dosya yoksa bu bir hatadır (aşağıya bak).
4. Prompt'u kur: **rol tanımının tamamı** + **plan dosyasının tamamı** + aşağıdaki çıktı
   sözleşmesi.
   - **Kapı 3'te ayrıca** uygulama farkını ekle: planın açıldığı temel referans ve
     değişen dosyaların listesi. Taze bir denetleyici süreci depoyu okuyabilir ama hangi
     değişikliğin bu plana ait olduğunu göremez — çalışma ağacı zaten kirliyse ya da
     birden çok plan sürüyorsa okumak yanıltır. Kapı 1'de bu bölüm yoktur.
5. CLI'ı **proje kökünde** çalıştır. Hedefin depoyu okuması gerekir: kapı 1'in reddetme
   ölçütlerinden biri "yaklaşım mevcut bir ADR'ye aykırı"dır.

   | Ekosistem | Komut |
   |---|---|
   | `claude` | `claude -p --agent <ad>` |
   | `codex` | `codex exec --sandbox read-only -` |
   | `opencode` | `opencode run --agent <ad>` |

   - **Prompt stdin'den gider**, argüman olarak değil: rol + planın tamamı kolayca
     işletim sisteminin argüman sınırını aşar ve tırnak hatası üretir.
   - **Sandbox her zaman salt-okunur** — sahibin `sandbox_mode`'una **bakma**.
     `writesCode: false` dosya sistemi izni değildir; doküman sahibi bir rol meşru
     biçimde `workspace-write` olabilir. Denetim çağrısı hiçbir şey yazmaz.
   - **Zaman aşımı 10 dakika.** Süre dolarsa süreç ağacının tamamını sonlandır.
   - Manifest'te `planGate.cli.<ekosistem>` varsa çalıştırılabilir **yol** olarak onu
     kullan; argümanlar yine yukarıdaki tablodandır.

### Çıktı sözleşmesi

Hedeften şunu istersin — **işaretler, alan adları ve değerler çevrilmez**, yalnız
hedefe verdiğin açıklama metni proje diline çevrilir:

```
<!-- verdict -->
verdict: approved | rejected
reviewed_revision: <denetlediği revision>
reasons:
- <madde>
- <madde>
<!-- /verdict -->
```

Ayrıştırma kuralları:

- İşaretler **kendi satırlarında ve tam**. stdout'ta tam bir açılış ve tam bir kapanış,
  bu sırayla. Sıfır, ikiden çok, ya da ters sıra → hata.
- Blok içinde **yalnız bu üç alan**. Bilinmeyen alan, tekrarlanan alan, eksik alan → hata.
- `verdict` yalnız `approved` ya da `rejected`. `skipped` hedeften **gelmez** — onu
  yalnız sen yazarsın.
- Blok **dışındaki** metni yok say; modeller düşünme/özet metni yazar.
- `reasons`: `rejected` ise boş olamaz. `approved` ise kayda **`[]`** yazarsın — hedef
  madde yazmışsa onları at.
- `by` alanını **sen** doldurursun, hedef değil: kimi çağırdığını sen biliyorsun.
  Hedefin kendi kimliğini beyan etmesine izin verme.

### Sonuç üç sınıftan biridir

| Sınıf | Ne zaman | Ne yaparsın |
|---|---|---|
| Taşıma hatası | CLI yok/`PATH`'te değil, yetkisiz, zaman aşımı, çıkış kodu ≠ 0 | **Kayıt yazma.** Geçerli bir blok gelmiş olsa bile yok say — sağlıklı bitmemiş süreçten çıkan blok güvenilmez. |
| Protokol hatası | Blok yok, birden çok, ya da şemaya uymuyor | **Kayıt yazma.** |
| Verdict | Geçerli blok, sağlıklı çıkış | Kaydı yaz. |

**Hata `rejected` değildir.** Ulaşılamayan bir kapıyı "reddetti" saymak planı gereksiz
düzeltme döngüsüne sokar; ayrıştırma hatasını "onayladı" saymak sessiz onaydır.

`reviewed_revision` diskteki `revision` ile aynı değilse **kaydı yazma** — plan denetim
sırasında değişmiş demektir, denetimi tekrarla.

### Hata hâlinde kullanıcıya ne sorarsın

Kayıt yazılmaz, plan bulunduğu klasörde kalır. Kullanıcıya bu üç seçeneği bu sırayla sun:

1. **Tekrar dene** — taşıma hatalarında anlamlı; protokol hatasında genelde değil.
2. **`<sahip>`'i `<başka ekosistem>`'de çalıştır** — yalnız sahibin **etkin
   hedeflerinden** ve rol tanımı dosyası **gerçekten var** olanları listele. Böyle bir
   ekosistem yoksa bu maddeyi **hiç gösterme**. Agent adı uydurma; öneri manifest'ten
   türer.
3. **Bu kapıyı atla** — kullanıcıdan **gerekçe iste**, sonra:
   `{ by: user/<sahibin adı>, at: <bugün>, revision: <plan.revision>,
   verdict: skipped, reasons: [<kullanıcının gerekçesi>] }`.
   Gerekçe vermezse kapıyı **atlama**.

Kullanıcı seçim yapmadan bırakırsa hiçbir şey yazma; sonraki oturum kapıyı sağlanmamış
görür ve baştan dener.

2. seçenek **farklı bir agent değildir**, aynı sahibin başka ekosistemidir. Kullanıcı
gerçekten başka bir denetleyici istiyorsa bu, kapı sahibini değiştirmektir — *Kapı
sahipleri değişirse* kuralları geçerlidir.

### Codex'te sınır

`codex exec`'te agent seçme bayrağı yok; yalnız `.codex/agent-definitions/<ad>.md`
prompt'a gömülür. `.codex/agents/<ad>.toml`'daki model/effort **uygulanmaz** — çağrı
Codex'in o oturumdaki varsayılan modeliyle koşar. Denetim kararı rol metnine dayanır.
Öbür iki ekosistemde `--agent` verildiği için konfigürasyon da yüklenir; yani ekosistemler
arası **birebir aynı** karar bekleme.
````

- [ ] **Step 2: Doğrulayıcıları çalıştır**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs`
Expected: ikisi de PASS.

- [ ] **Step 3: Kapı 1'i yeni bölüme bağla**

`## Plan yaz` altındaki 4. maddede, `Denetleyici sana şunu döndürür:` cümlesinden **önce** şu satırı ekle:

```markdown
   Denetleyici senin ekosisteminde üretilmemişse **Başka ekosistemdeki kapı sahibi**
   bölümünü izle; çıktı sözleşmesi ve hata hâli oradadır.
```

- [ ] **Step 4: Kapı 3'ü de bağla**

`## İşi bitirme` bölümünün 1. maddesinde şu satır var:

```markdown
1. **Kapı 3 — kod denetimi.** Projenin kod denetleyicisi tanımlıysa çağır. Denetleyici
   kapı 1'deki **aynı** çıktıyı döndürür (`verdict` / `reviewed_revision` / `reasons`).
```

Hemen ardına, ilk mermiden **önce** ekle:

```markdown
   Kod denetleyicisi senin ekosisteminde üretilmemişse **Başka ekosistemdeki kapı
   sahibi** bölümünü izle — kapı 3'te prompt'a uygulama farkını (temel referans +
   değişen dosyalar) da eklersin.
```

- [ ] **Step 5: Doğrulayıcıları tekrar çalıştır**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs`
Expected: ikisi de PASS.

- [ ] **Step 6: Commit**

```bash
git add team-builder-shared/templates/work-plan-skill.md
git commit -m "feat: document the cross-ecosystem gate call in the shipped skill"
```

---

### Task 5 — Görev 5: Çapraz çağrı bölümünün varlığını mekanik olarak zorla

Görev 4'ün yazdığı bölüm skill'den düşerse hiçbir test patlamaz — bu görev o boşluğu kapatır.

**Files:**
- Modify: `team-builder-shared/validate-plan-gate.mjs`

**Interfaces:**
- Consumes: `BY_GRAMMAR_TOKENS` (görev 1), görev 4'ün yazdığı bölüm.
- Produces: `export const VERDICT_MARKERS` — `['verdict', '/verdict']`.

- [ ] **Step 1: Failing test'i yaz**

Görev 1'de eklediğin `expectError` vakasının hemen ardına, aynı `// --- skill template ---` bloğunda:

```js
    // The cross-ecosystem call is runtime-only: nothing is generated for it, so
    // the shipped skill is the sole place the protocol exists. Drop the verdict
    // block and a project's agents have no contract to hold a foreign CLI to.
    await expectError(
      'does not document marker <!-- /verdict -->',
      'a shipped skill missing the verdict close marker',
      () => fs.writeFile(skillPath, GOOD_SKILL.replace('<!-- /verdict -->', ''))
    )
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest`
Expected: FAIL — `a shipped skill missing the verdict close marker — expected a finding containing "does not document marker <!-- /verdict -->", got: (none)`

- [ ] **Step 3: Sabiti ve denetimi ekle**

`BY_GRAMMAR_TOKENS` tanımının hemen altına:

```js
// The verdict block is the only contract binding a foreign CLI's output. It is
// never generated into a project by name, so if the skill stops printing it the
// protocol silently disappears.
export const VERDICT_MARKERS = ['verdict', '/verdict']
```

`GOOD_SKILL` fixture'ına ekle (`...BY_GRAMMAR_TOKENS,` satırının ardına):

```js
  ...VERDICT_MARKERS.map(m => `<!-- ${m} -->`),
```

Skill denetim bloğuna, `BY_GRAMMAR_TOKENS` döngüsünün ardına:

```js
    for (const marker of VERDICT_MARKERS) {
      if (!skillTpl.includes(`<!-- ${marker} -->`)) {
        errors.push(
          `templates/work-plan-skill.md does not document marker <!-- ${marker} -->`
        )
      }
    }
```

- [ ] **Step 4: Testi ve gerçek dosyayı çalıştır**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs`
Expected: ikisi de PASS — görev 4 bölümü zaten yazdığı için gerçek dosya da geçer.

- [ ] **Step 5: Mutasyon testi — kuralın gerçekten savunulduğunu kanıtla**

Denetimi geçici olarak etkisizleştir ve selftest'in **öldüğünü** gör:

```bash
node -e '
const fs = require("node:fs");
const p = "team-builder-shared/validate-plan-gate.mjs";
const orig = fs.readFileSync(p, "utf8");
fs.writeFileSync(p, orig.replace("export const VERDICT_MARKERS = [\x27verdict\x27, \x27/verdict\x27]", "export const VERDICT_MARKERS = []"));
' && node team-builder-shared/validate-plan-gate.mjs --selftest; echo "exit=$?"; git checkout team-builder-shared/validate-plan-gate.mjs
```

Expected: `a shipped skill missing the verdict close marker — expected a finding containing "does not document marker <!-- /verdict -->", got: (none)` ve `exit=1`. Sonra `git checkout` mutasyonu geri alır.

`exit=0` görürsen test kuralı savunmuyor demektir — dur, testi düzelt.

- [ ] **Step 6: Commit**

```bash
git add team-builder-shared/validate-plan-gate.mjs
git commit -m "test: require the shipped skill to document the verdict block"
```

---

### Task 6 — Görev 6: Kapsama kuralını doğrulayıcıdan kaldır

**Files:**
- Modify: `team-builder-shared/validate-manifest.mjs:125-132` (kapsama döngüsü)
- Modify: `team-builder-shared/validate-manifest.mjs:1062-1081` (V8 selftest vakası)
- Modify: `team-builder-shared/manifest-schema.md:115-116`

**Interfaces:**
- Consumes: yok.
- Produces: `checkPlanGate` artık kapsama hatası üretmiyor. Görev 7 aynı fonksiyona yeni bir alan doğrulaması ekler.

- [ ] **Step 1: V8'i reddetme vakasından kabul vakasına çevir**

Bu, kuralın kalktığını **kanıtlayan** testtir. `validate-manifest.mjs` içinde V8:

```js
  // V8 — owner is not generated for every ecosystem its executors run in.
  expectReject(
    "V8 owner does not cover executor targets",
    { ... },
    "kapsamalı"
  );
```

→

```js
  // V8 — the owner need not be generated in every executor's ecosystem. This is
  // the whole point of cross-ecosystem invocation: a claude session reaches a
  // codex-only reviewer over the CLI. `dev` still targets codex, so the
  // per-ecosystem executor rule (which this change keeps) is satisfied.
  expectAccept("V8 owner outside an executor ecosystem", {
    targetsDefault: ["claude"],
    constitution: { planGate: true },
    planGate: { planReviewer: "architect", codeReviewer: null },
    routing: [{ path: "src/**", role: "dev" }],
    agents: [
      { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"], model: "sonnet" },
      {
        name: "architect", description: 'rol aciklamasi',
        targets: ["codex"],
        model: "opus",
        writesCode: false,
      },
    ],
  });
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `node team-builder-shared/validate-manifest.mjs --selftest`
Expected: FAIL — V8 artık kabul bekliyor ama kapsama kuralı hâlâ reddediyor. Hata metni `kapsamalı` içerecek.

- [ ] **Step 3: Kuralı kaldır**

`checkPlanGate` içindeki şu bloğu **tamamen sil**:

```js
    const ownerTargets = new Set(effectiveTargets(doc, agent));
    for (const eco of executorTargets) {
      if (!ownerTargets.has(eco)) {
        errors.push(
          `planGate.${key} "${owner}" "${eco}" ekosisteminde üretilmiyor — kapı sahibi tüm uygun executor'ların ekosistemlerini kapsamalı`
        );
      }
    }
```

**Yerine yeni kural ekleme.** "Kapı sahibinin en az bir etkin hedefi olmalı" gereksizdir — doğrulayıcı bunu zaten **her agent için** istiyor (`agents[].targets` ya da kök `targetsDefault`); kapı sahibi de bir agent'tır.

Silme sonrası `effectiveTargets` ya da `executorTargets` bu fonksiyonda kullanılmıyorsa Node uyarı vermez ama ölü kalırlar — `executorTargets` fonksiyonun başında başka bir kural için de kullanılıyor, **onu silme**. Yalnız yukarıdaki bloğu sil.

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `node team-builder-shared/validate-manifest.mjs --selftest`
Expected: PASS.

- [ ] **Step 5: `manifest-schema.md`'yi güncelle**

Şu iki satırı:

```markdown
- Kapı sahibinin etkin hedefleri, uygun executor'ların (routing'de geçen + kod yazan)
  etkin hedeflerinin birleşimini kapsamalı.
```

**sil** ve altındaki satırın ardına açıklama ekle:

```markdown
- `planGate` açıkken hedeflenen her ekosistemde en az bir uygun executor bulunmalı.
  Bu kural hedeflenen ekosistemleri **tüm** agent'lardan hesaplar, kapı sahibi dahil;
  yani yalnız bir ekosistemde üretilen bir kapı sahibi o ekosistemde bir executor
  bulunmasını da zorunlu kılar. Kapı sahibinin **executor'ların ekosistemlerini
  kapsaması** artık gerekmiyor — ulaşılamayan sahip harici CLI çağrısıyla çalıştırılır
  (bkz. `plan-gate.md`, *Başka ekosistemdeki kapı sahibi*).
```

- [ ] **Step 6: Commit**

```bash
git add team-builder-shared/validate-manifest.mjs team-builder-shared/manifest-schema.md
git commit -m "feat: drop the gate-owner coverage rule

Kural tek-ekosistem varsayiminin sonucuydu ve B'nin cozdugu durumu -- sahip
oturumun ekosisteminde yok -- dogrudan reddediyordu. Yerine yeni kural gelmiyor:
'en az bir etkin hedef' zaten her agent icin var."
```

---

### Task 7 — Görev 7: `planGate.cli` yol override'ını şemaya al

**Files:**
- Modify: `team-builder-shared/validate-manifest.mjs` (`checkPlanGate` içine)
- Modify: `team-builder-shared/manifest-schema.md:33-35` (alan tablosu) ve doğrulama kuralları listesi

**Interfaces:**
- Consumes: görev 6'nın sadeleştirdiği `checkPlanGate`.
- Produces: `planGate.cli` — `{ [ekosistem]: string }`, opsiyonel. Değerler dolu string; anahtarlar `claude|codex|opencode`.

- [ ] **Step 1: Failing testleri yaz**

`validate-manifest.mjs` selftest'inde V8'in ardına üç vaka ekle:

```js
  // V8b — cli override accepts a path per ecosystem.
  expectAccept("V8b cli override", {
    targetsDefault: ["claude"],
    constitution: { planGate: true },
    planGate: {
      planReviewer: "architect",
      codeReviewer: null,
      cli: { codex: "/opt/homebrew/bin/codex" },
    },
    routing: [{ path: "src/**", role: "dev" }],
    agents: [
      { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"], model: "sonnet" },
      { name: "architect", description: 'rol aciklamasi', targets: ["codex"], model: "opus", writesCode: false },
    ],
  });

  // V8c — an unknown ecosystem key is a typo, not a new target.
  expectReject(
    "V8c cli override unknown ecosystem",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: {
        planReviewer: "architect",
        codeReviewer: null,
        cli: { gpt: "/usr/bin/gpt" },
      },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"], model: "sonnet" },
        { name: "architect", description: 'rol aciklamasi', targets: ["codex"], model: "opus", writesCode: false },
      ],
    },
    "planGate.cli"
  );

  // V8d — an empty path would run the ecosystem name from PATH while looking
  // deliberate; a blank override is a mistake, not a default.
  expectReject(
    "V8d cli override empty path",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: {
        planReviewer: "architect",
        codeReviewer: null,
        cli: { codex: "  " },
      },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"], model: "sonnet" },
        { name: "architect", description: 'rol aciklamasi', targets: ["codex"], model: "opus", writesCode: false },
      ],
    },
    "planGate.cli"
  );
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `node team-builder-shared/validate-manifest.mjs --selftest`
Expected: FAIL — V8c ve V8d reddedilmesi gerekirken kabul ediliyor (henüz kural yok).

- [ ] **Step 3: Kuralı ekle**

`checkPlanGate` içinde, `for (const key of ["planReviewer", "codeReviewer"])` döngüsünün **ardına**:

```js
  // Only the executable path is overridable — never the arguments. A free-form
  // shell command in the manifest would put arbitrary command execution into
  // generated config, which is exactly the risk the fixed mapping avoids.
  if ("cli" in gate) {
    const cli = gate.cli;
    if (cli === null || typeof cli !== "object" || Array.isArray(cli)) {
      errors.push("planGate.cli nesne olmalı (ekosistem → yürütülebilir yol)");
    } else {
      for (const [eco, value] of Object.entries(cli)) {
        if (!TARGETS.includes(eco)) {
          errors.push(
            `planGate.cli geçersiz ekosistem "${eco}" (claude|codex|opencode)`
          );
          continue;
        }
        if (typeof value !== "string" || value.trim() === "") {
          errors.push(`planGate.cli.${eco} dolu bir yol olmalı`);
        }
      }
    }
  }
```

`TARGETS` bu dosyada zaten tanımlı — yeni sabit ekleme.

- [ ] **Step 4: Testleri çalıştır, geçtiklerini gör**

Run: `node team-builder-shared/validate-manifest.mjs --selftest`
Expected: PASS.

- [ ] **Step 5: Mutasyon testi**

```bash
node -e '
const fs = require("node:fs");
const p = "team-builder-shared/validate-manifest.mjs";
const orig = fs.readFileSync(p, "utf8");
fs.writeFileSync(p, orig.replace("if (!TARGETS.includes(eco)) {", "if (false) {"));
' && node team-builder-shared/validate-manifest.mjs --selftest; echo "exit=$?"; git checkout team-builder-shared/validate-manifest.mjs
```

Expected: V8c'nin başarısız olduğunu bildiren çıktı ve `exit=1`.

`exit=0` görürsen V8c kuralı savunmuyor — dur, testi düzelt.

- [ ] **Step 6: `manifest-schema.md`'ye alanı ekle**

`planGate.codeReviewer` satırının ardına tabloya:

```markdown
| `planGate.cli` | `object` | Hayır | Ekosistem → **yürütülebilir dosya yolu**. Yalnız CLI'ı `PATH`'te olmayan bir yere kuranlar için. Anahtarlar `claude`/`codex`/`opencode`, değerler dolu string. Argümanlar override edilemez — serbest kabuk komutu üretilen konfigürasyona keyfi komut yerleştirmek olurdu. |
```

Doğrulama kuralları listesine:

```markdown
- `planGate.cli` (verildiyse) nesne olmalı; anahtarları `claude|codex|opencode`,
  değerleri dolu string. Yalnız yürütülebilir yol; argüman kurgusu araçta sabittir.
```

- [ ] **Step 7: Commit**

```bash
git add team-builder-shared/validate-manifest.mjs team-builder-shared/manifest-schema.md
git commit -m "feat: accept planGate.cli path overrides"
```

---

### Task 8 — Görev 8: Hedef dokümanlarına komut ve sandbox eşlemesini yaz

**Files:**
- Modify: `team-builder-shared/codex-target.md`
- Modify: `team-builder-shared/opencode-target.md`

**Interfaces:**
- Consumes: görev 4'ün komut tablosu — birebir aynı komutlar.
- Produces: doküman; kod yok.

- [ ] **Step 1: `codex-target.md`'ye bölüm ekle**

Dosyanın sonuna:

```markdown
## Çapraz ekosistem denetim çağrısı

Plan kapısı sahibi yalnız Codex'te üretilmişse başka bir ekosistemdeki oturum onu şu
komutla çağırır:

```
codex exec --sandbox read-only -
```

- Prompt **stdin**'den gider (`-`): rol tanımı + planın tamamı argüman sınırını aşar.
  Süreç kabuk olmadan, `argv` dizisiyle başlatılır.
- Sandbox **her zaman `read-only`** — agent'ın `sandbox_mode`'una bakılmaz. `writesCode:
  false` dosya sistemi izni değildir; bir doküman sahibi meşru biçimde
  `workspace-write` olabilir ve o izinle çağrılırsa `.agent-work/`'e yazabilir.
  Denetim çağrısı hiçbir şey yazmaz.
  **Üç ekosistem içinde salt-okunurluğu işletim sistemi düzeyinde zorlayan tek CLI
  Codex'tir**; `claude` izin listesiyle, `opencode` ise hiç zorlamaz. Bu, Codex'i çapraz
  denetim için en güvenli hedef yapar.
- **`--agent` yok** — Codex'te zaten yok, ama olsaydı da verilmezdi: `--agent` hedefin
  kendi konfigürasyonunu, dolayısıyla izinlerini yükler. Rol yalnız
  `.codex/agent-definitions/<ad>.md` prompt'a gömülerek taşınır;
  `.codex/agents/<ad>.toml`'daki `model` ve `model_reasoning_effort` **uygulanmaz**.
  Çağrı, Codex'in o oturumdaki varsayılan modeliyle koşar.
- Manifest'te `planGate.cli.codex` varsa `codex` yerine o yol kullanılır; argümanlar
  değişmez.
```

- [ ] **Step 2: `opencode-target.md`'ye bölüm ekle**

Dosyanın sonuna:

```markdown
## Çapraz ekosistem denetim çağrısı

Plan kapısı sahibi yalnız OpenCode'da üretilmişse başka bir ekosistemdeki oturum onu şu
komutla çağırır:

```
opencode run
```

- Prompt **stdin**'den gider. Süreç kabuk olmadan, `argv` dizisiyle başlatılır.
- **`--agent` verilmez.** Rol prompt'a gömülür — üç ekosistemde tek kod yolu, tek hata
  biçimi. `--agent` vermek burada özellikle tehlikelidir: agent'ın kendi
  konfigürasyonunu yükler, dolayısıyla `permission.edit`'ini de. Yukarıdaki
  *`writesCode: false` tek başına `deny` demek değildir* notu tam olarak bu yüzden
  önemli — bir doküman sahibi meşru biçimde `workspace-write`'tır ve `edit: allow`
  alır. `--agent architect` demek, denetleyiciye yazma izni vermek demektir.
  Konfigürasyon yüklenmediği için `opencode_model` ve variant ayarları da
  **uygulanmaz**; çağrı OpenCode'un o oturumdaki varsayılanıyla koşar.
- **Salt-okunurluk OpenCode'da CLI ile zorlanamıyor.** `opencode run`'da salt-okunur
  bayrağı yok; tersi var (`--dangerously-skip-permissions`). Bunu "sandbox engeller"
  diye yazma — engellemiyor. Kalan koruma **sözleşmeseldir**: `--agent` verilmediği
  için izin verici rol konfigürasyonu yüklenmez, çekirdeğin *"`.agent-work/` altına
  yalnız sen yazarsın"* kuralı geçerlidir ve kaydı yalnız çağıran yazar. Bu, **kaydın
  bütünlüğünü** korur; hedefin depoya hiç dokunamayacağını garanti etmez.
- Manifest'te `planGate.cli.opencode` varsa `opencode` yerine o yol kullanılır.
```

- [ ] **Step 3: Doğrulayıcıları çalıştır**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-manifest.mjs --selftest`
Expected: ikisi de PASS.

- [ ] **Step 4: Commit**

```bash
git add team-builder-shared/codex-target.md team-builder-shared/opencode-target.md
git commit -m "docs: record the cross-ecosystem call per target"
```

---

### Task 9 — Görev 9: Çekirdek spec'i revize et

Çekirdek spec N14'ü ve iki satırlı yüklemi hâlâ eski hâliyle söylüyor; öyle kalırsa bir sonraki okuyan uygulanan kuralla çelişen bir referans metni bulur.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-plan-gate-design.md:475` (kayıt şeması)
- Modify: `docs/superpowers/specs/2026-08-02-plan-gate-design.md:744` (N14)
- Modify: `docs/superpowers/specs/2026-08-02-plan-gate-design.md` (KARAR 21 ve yüklem tablosu)

**Interfaces:**
- Consumes: görev 2 ve 3'ün kuralları.
- Produces: doküman; kod yok.

- [ ] **Step 1: Kayıt şemasını güncelle**

475. satırdaki:

```
{ by: <ekosistem>/<agent-adı> | system, at: <YYYY-MM-DD>, revision: <n>,
```

→

```
{ by: <ekosistem>/<agent-adı> | system | user/<agent-adı>, at: <YYYY-MM-DD>, revision: <n>,
```

- [ ] **Step 2: N14'ü revize et**

744. satırdaki:

```markdown
| N14 | `skipped` kaydında `by` değeri `system` değil | Reddedilir |
```

→

```markdown
| N14 | `skipped` kaydında `by` değeri `system` ya da `user/<agent-adı>` değil (çıplak `user` dahil) | Reddedilir |
```

N15'e dokunma — `approved`/`rejected` kayıtlarında `system` yasağı aynen geçerli. Ama tablonun altına, N15'in ardından ekle:

```markdown
| N16 | `approved`/`rejected` kaydında `by` değeri `user/` ile başlıyor | Reddedilir |
```

- [ ] **Step 3: Yüklem tablosunu ve kimlik paragrafını güncelle**

`### planReviewPassed(plan, manifest) — kalıcı` bölümü 513. satırda. İki şey değişir.

Önce 518-519. satırlardaki kimlik cümlesi:

```markdown
Karşılaştırılacak sahip kimliği **planın kendi `executor` ekosisteminden** kurulur:
`<executor.ecosystem>/<planReviewer>`. `currentEcosystem` bu hesaba **girmez**.
```

→

```markdown
Karşılaştırılacak **ad** manifest'teki güncel `planReviewer`'dan gelir. **Ekosistem**
denetimin fiilen çalıştığı yerdir ve sahibin etkin hedeflerinden biri olmalıdır —
denetleyici projenin başka bir ekosisteminde üretilmiş olabilir ve harici CLI çağrısıyla
orada koşar. `currentEcosystem` bu hesaba **girmez**.
```

Altındaki `> **Neden.**` bloğunu **koru** — gerekçesi (kalıcı yüklem geçici bağlama bağlanamaz) hâlâ geçerli.

Sonra 531. satırda başlayan iki satırlı tabloyu, görev 3'te `plan-gate.md`'ye yazdığın **üç satırlı** tabloyla değiştir. Metni oradan **birebir** kopyala — üç yer aynı şeyi söylemeli.

- [ ] **Step 4: KARAR 21'i kapat**

KARAR 21'in bulunduğu satırın ardına:

```markdown
> **Kapandı (2026-08-11).** Çapraz ekosistem çağrısı ayrı bir spec'te tasarlandı ve
> uygulandı: `docs/superpowers/specs/2026-08-11-cross-ecosystem-invoke-design.md`.
> O spec bu çekirdeği iki yerde revize eder — N14 (`by: user/<ad>` kabul edilir) ve
> `planReviewPassed` tablosu (üçüncü satır: kullanıcı feragati).
```

- [ ] **Step 5: Tutarlılık kontrolü**

Run:

```bash
grep -n 'system | user\|user/<agent-adı>' team-builder-shared/plan-gate.md team-builder-shared/templates/work-plan-skill.md docs/superpowers/specs/2026-08-02-plan-gate-design.md
```

Expected: üç dosyanın **hepsinde** en az bir eşleşme. Biri eksikse o dosya geride kalmış — düzelt.

- [ ] **Step 6: Doğrulayıcıları son kez çalıştır**

Run: `node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs && node team-builder-shared/validate-manifest.mjs --selftest`
Expected: üçü de PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-08-02-plan-gate-design.md
git commit -m "docs: revise the core spec for the user waiver and close KARAR 21"
```

---

### Task 10 — Görev 10: Uçtan uca elle prova

Doğrulayıcılar kuralların **belgelendiğini** kanıtlar, **işlediğini** değil. Kapı prosedürünü elle yürütmek bu planda başka hiçbir adımın bulamayacağı boşlukları bulur — önceki turda `slug` boşluğu tam böyle çıkmıştı.

**Files:**
- Değişiklik yok; bulgu çıkarsa ilgili göreve dönülür.

**Interfaces:**
- Consumes: görev 1–9'un tamamı.
- Produces: bulgu listesi ya da temiz sonuç.

- [ ] **Step 1: Skill'i bir okuyucu gibi baştan sona oku**

Run: `sed -n '1,400p' team-builder-shared/templates/work-plan-skill.md`

Şu soruları sorarak oku — her biri için dosyada **açık** bir cevap ara:

1. Kapı 1'de denetleyici başka ekosistemdeyse hangi bölüme gidiyorum? Oradan geri dönüş var mı?
2. Verdict bloğunda `reviewed_revision` uyuşmazsa ne yapacağım — hangi cümle söylüyor?
3. Taşıma hatası aldım, kullanıcı "başka ekosistemde çalıştır" dedi. Hangi listeyi gösteririm, o listeyi nasıl kurarım?
4. Kullanıcı atladı. Kaydı **tam olarak** hangi değerlerle yazarım? `by`'daki ad nereden gelir?
5. O kaydı yazdıktan sonra `planReviewPassed` doğru mu? Hangi satır sağlıyor?
6. Kapı sahibi ertesi gün değişti. Dünkü feragat hâlâ yetki veriyor mu? Hangi cümle söylüyor?

- [ ] **Step 2: Bir feragat kaydını yüklem tablosuna karşı elle işlet**

Kâğıt üzerinde şu planı kur:

```yaml
revision: 3
reviews:
  plan-review:
    - { by: user/architect, at: 2026-08-11, revision: 3, verdict: skipped, reasons: [codex CLI kurulu degil] }
```

Manifest'te `planGate.planReviewer: architect`. Skill'in tablosuna bakarak `planReviewPassed`'ı hesapla.

Expected: **doğru** — 2. satır (adlı denetleyici + `skipped` + `by: user/architect`).

Sonra manifest'te sahibi `reviewer2` yap ve tekrar hesapla.

Expected: **yanlış** — `user/architect` ≠ `user/reviewer2`, feragat düştü.

Tablodan bu iki sonucu **çıkaramıyorsan** tablo eksik; görev 3'e dön.

- [ ] **Step 3: `plan-gate.md` ile skill'i karşılaştır**

Run:

```bash
diff <(grep -A6 'by: <ekosistem>' team-builder-shared/plan-gate.md) <(grep -A6 'by: <ekosistem>' team-builder-shared/templates/work-plan-skill.md)
```

Biçim farkı normal; **kural** farkı değil. Biri ötekinin kabul ettiği bir değeri reddediyorsa görev 2'ye dön.

- [ ] **Step 4: Bulguları raporla**

Bulgu çıkmadıysa bir sonraki adıma geç. Çıktıysa hangi göreve ait olduğunu yaz, o görevin adımlarını tekrarla, sonra bu görevi baştan çalıştır.

- [ ] **Step 5: Tam doğrulama**

Run:

```bash
node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs && git status --short
```

Expected: üç doğrulayıcı da PASS, `git status` **temiz** (her görev kendi commit'ini attı).

- [ ] **Step 6: Spec durumunu güncelle ve commit**

`docs/superpowers/specs/2026-08-11-cross-ecosystem-invoke-design.md` başlığındaki:

```markdown
- **Durum:** Karşıt inceleme sonrası revize edildi — kullanıcı onayı ve uygulama planı bekliyor
```

→

```markdown
- **Durum:** Uygulandı — `docs/superpowers/plans/2026-08-11-cross-ecosystem-invoke.md`
```

```bash
git add docs/superpowers/specs/2026-08-11-cross-ecosystem-invoke-design.md
git commit -m "docs: mark the scope B spec as implemented"
```

---

## Spec kapsam kontrolü

| Spec bölümü | Görev |
|---|---|
| Çağrı dizisi (1–8) | 4 |
| Salt-okunur sandbox (B11) | 4, 8 |
| Kapı 3 uygulama farkı (B13) | 4 |
| Zaman aşımı + süreç ağacı | 4 |
| Verdict bloğu + ayrıştırma kuralları | 4 |
| Üç sonuç sınıfı | 4 |
| `reasons` normalizasyonu | 2, 4 |
| Veri modeli — ekosistem gevşemesi | 3 |
| Veri modeli — yüklem üçüncü satırı | 3 |
| `by: user/<ad>` grameri | 2 |
| N14 revizyonu | 9 |
| Hata hâli seçenekleri | 4 |
| Komut eşlemesi + stdin (B12) | 4, 8 |
| `planGate.cli` override (B9) | 7 |
| Codex model/effort sınırı | 4, 8 |
| Doğrulayıcı: kapsama kuralı kalkar (B10) | 6 |
| Kabul kriterleri B-R1…B-R10 | 4 (davranış), 6 (B-R5) |
| Kabul kriterleri B-N1…B-N19 | 4 (davranış), 1/5 (doküman), 6/7 (manifest) |

**Kapsam dışı olduğu için görevi yok:** executor devri, vekil denetleyici, salt-denetleyici ekosistem, inbox (C), preset aç/kapa (E), paralel çağrı.

**Not — davranışsal kriterler neden test edilmiyor:** B-R1…B-R10 ve B-N1…B-N19'un çoğu *runtime* davranışıdır ve runtime bir agent'tır, bir fonksiyon değil. Bu repoda çalıştırılabilir tek şey doğrulayıcılardır; onlar kuralın **belgelendiğini** zorlar. Kriterlerin kendisi görev 10'un elle provasında yürütülür. Bunu otomatikleştirmek, agent davranışını simüle eden bir harness yazmak demektir — ayrı bir iş ve bu planın kapsamı dışında.
