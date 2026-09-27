# Tasarım: LLM Yapılandırması (`llm.json` + `team-builder-models`)

- **Tarih:** 2026-09-27
- **Durum:** Uygulandı — `docs/superpowers/plans/2026-09-27-llm-config.md`
- **Revizyon 1 (2026-09-27, kullanıcı kararı):** ajan dosyaları ve defter yeniden git'te;
  git dışında yalnız `llm.local.json` kalır. Aşağıdaki L2, L5 ve Kararlar 6, 7, 8, 17 bu
  revizyonla değişti — bkz. *Revizyon 1*.
- **Kapsam:** Model ve effort seçiminin agent tanımından ayrılması; ortak dosya + kişisel
  dosya; sağlayıcı kataloğuna dayalı uyarı ve güncelleme; mevcut projelerin göçü

## Problem

Tek bir agent tanımlandı: manifest'te `model: opus`, rol dosyasının frontmatter'ında
`model: haiku`. `sync --check` 0 ile çıktı, tek uyarı yok:

| Ekosistem | Yazılan | Neden |
|---|---|---|
| Claude | `haiku` | Rol dosyası birebir kopyalanıyor; manifest'teki `model` Claude'a hiç ulaşmıyor |
| Codex | `"opus"` | Claude takma adı Codex ayarına yazılıyor; Codex'in kendi model alanı yok |
| OpenCode | `anthropic/claude-opus-4` | Kodda sabit bir yedek harita; güncel sürümün iki nesil gerisinde |

Aynı rol üç ekosistemde üç ayrı modelle çalışıyor. Ayrıca:

- **Kilitler geçerli değerleri reddediyor.** `validate-manifest.mjs` Claude modelini
  `opus|sonnet|haiku`'ya, effort'u `low|medium|high`'a kilitliyor. Claude Code bugün
  `fable`'ı, `claude-opus-5-5` gibi tam adları, `inherit`'i ve `xhigh`/`max` effort
  seviyelerini kabul ediyor; hepsi reddediliyor.
- **Claude + Codex hedefli bir agent iki tarafta birden doğru olamaz.** Codex modeli
  yazılırsa Claude kuralı reddeder; Claude modeli yazılırsa Codex'e yanlış ad gider.
- **Kişiye özel katman yok.** Seçimler repoda; herkes aynısını alıyor.
- **Güncelleme yolu yok.** Kurulumdan sonra modeli değiştiren bir skill yok; setup kurulu
  bir takımı var olmayan `/team-builder-edit` ve `/team-builder-add`'e yönlendiriyor.
  Kalkan bir modeli hiçbir şey tespit etmiyor.

## Ön bulgular (ölçüldü)

- **Üretilen dosyalar commit ediliyor.** Defter "takımda tutarlı olması için commit
  edilir" diyor (`canonical-source.md:129`); setup `.gitignore`'a hiçbir şey yazmıyor.
- **Claude'da commit dışı bir dosya proje ajanını ezemiyor.** Belgedeki öncelik:
  yönetilen ayarlar > `--agents` bayrağı > proje `.claude/agents/` > kullanıcı
  `~/.claude/agents/` > eklenti. `CLAUDE_CODE_SUBAGENT_MODEL` frontmatter'dan sonra gelir;
  ancak `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ile, o da tüm alt ajanlara birden uygulanır.
- **Claude alt ajan frontmatter'ı** `model:` için takma ad (`sonnet`, `opus`, `haiku`,
  `fable`), tam ad (`claude-opus-5-5`) ve `inherit`; `effort:` için `low`, `medium`,
  `high`, `xhigh`, `max` kabul ediyor — "kullanılabilir seviyeler modele bağlı".
- **Claude sağlayıcıya özgü kimlikleri de kabul ediyor.** Bedrock'ta inference profile
  ARN'si, Google'da `claude-sonnet-4-5@20250929`, Foundry'de dağıtım adı, ağ geçidinin
  arkasında herhangi bir metin; `opus[1m]` gibi son ekler var. Alt ajan `model` alanı
  bunların hepsini alıyor.
- **Katalog komutları:**
  - `codex debug models` — yerelde çalışıyor, API anahtarı istemiyor. Her model için
    `slug`, `visibility` (`list`/`hide`), `default_reasoning_level`,
    `supported_reasoning_levels` ve `upgrade` taşıyor. Effort seviyeleri modele bağlı
    (`gpt-5.5`: `low`…`xhigh`; `gpt-6-astra`: `low`…`ultra`).
  - `upgrade` emekliliği makinece okunur biçimde veriyor:
    `{"model":"gpt-5.6-sol","retirement_at":"2026-10-14T19:00:00Z", ...}` — `gpt-5.5`
    bu spec'in yazıldığı günden 17 gün sonra kalkıyor.
  - `opencode models` — yalnız **bu makinede yapılandırılmış** sağlayıcıları listeliyor
    (bu makinede `anthropic` yok: "Provider not found"). Projenin `opencode.json`'unda
    tanımlı bir sağlayıcı yalnız komut o projenin dizininde çalışınca listeleniyor
    (denendi: aynı makinede proje dizininde listede, başka dizinde yok).
  - `claude` CLI'ında model listeleyen komut yok.
- **Süre:** `codex debug models` ilk çağrıda 1,0 s, önbellekten 0,03 s;
  `opencode models` 1,3–2,0 s.
- **OpenCode** ajan frontmatter'ında `model:` var; effort gibi seçenekler (belgedeki örnek
  `reasoningEffort`) sağlayıcıya olduğu gibi aktarılıyor, anlamı sağlayıcıya bağlı. Model
  verilmezse birincil ajan genel modeli, alt ajan onu çağıranın modelini kullanıyor.
  `opencode debug agent <ad>` ile model çağırmadan doğrulandı: frontmatter'daki
  `reasoningEffort: "high"` ajan yapılandırmasına `options.reasoningEffort` olarak giriyor;
  tırnaklı `model: "sağlayıcı/model"` doğru çözümleniyor.
- **Makine adı kararsız.** Bu Mac `cesurbs-MacBook-Pro.local`,
  `cesurbs-MacBook-Pro` ve `cesurb’s MacBook Pro` adlarını döndürüyor; `HostName` ayarlı
  değil, macOS adı ağdan alabiliyor.
- **Proje düzeyindeki ayar dosyaları model taşımıyor:** `.codex/config.toml` ve
  `opencode.json`. Model yalnız üç ajan dizininde yazılıyor.

## Terimler

| Terim | Anlamı |
|---|---|
| **Ortak dosya** | `.agent-source/llm.json` — commit edilir, takımın seçimi |
| **Yerel dosya** | `.agent-source/llm.local.json` — `.gitignore`'da, yalnız bu makine |
| **Katman** | Bir dosyanın `agents` ya da `defaults` bölümü; toplam dört katman |
| **Çözümleme** | Bir agent + ekosistem için model ve effort'un katmanlardan belirlenmesi |
| **Katalog** | Bir CLI'ın bu makinede bildirdiği model listesi |
| **Yerel üretim** | Sync'in ürettiği ama repoya girmeyen dosyalar: ajan dosyaları ve defter |

## L1 — Dosyalar ve birleştirme kuralı

İki dosyanın şekli aynıdır; iki kök anahtar da isteğe bağlıdır, `{}` geçerlidir:

```json
{
  "defaults": { "claude": { "model": "sonnet" } },
  "agents": {
    "architect": {
      "claude": { "model": "claude-opus-5-5", "effort": "high" },
      "codex":  { "model": "gpt-5.6-terra", "effort": "high" }
    }
  }
}
```

Ekosistem anahtarları `targets`'takilerle aynıdır: `claude`, `codex`, `opencode`. Her
girdide `model` ve `effort` vardır, ikisi de isteğe bağlıdır.

### Çözümleme

Her agent `a` ve ekosistem `e` için katmanlar şu sırayla aranır:

1. yerel `agents[a][e]`
2. yerel `defaults[e]`
3. ortak `agents[a][e]`
4. ortak `defaults[e]`

- **model** = `model` alanı olan ilk katmanın değeri. O katmanın sırası `m` olsun.
- **effort** = `effort` alanı olan ilk katmanın değeri; ancak model bir katmandan geldiyse
  yalnız **1…m** arasındaki katmanlara bakılır. Hiçbir katman model vermiyorsa effort
  herhangi bir katmandan gelebilir.
- Bulunmayan alan için **satır yazılmaz**; ekosistemin kendi varsayılanı geçerli olur.

Yerel dosya her zaman ortak dosyayı ezer; aynı dosyada ajana özel girdi `defaults`'u ezer.

İki dosya da yoksa her şey boş çözümlenir: hiçbir model ya da effort satırı yazılmaz ve her
ekosistem kendi varsayılanıyla çalışır. Bu geçerli bir durumdur; setup yine de ortak dosyayı
her zaman kurar.

**Model–effort bağının nedeni:** effort'un geçerliliği modele bağlıdır ve alt katmandaki
effort başka bir model için seçilmiştir.

| Ortak | Yerel | Sonuç |
|---|---|---|
| architect/codex `gpt-6-astra` + `ultra` | architect/codex `model: gpt-5.6-luna` | `gpt-5.6-luna` + Codex varsayılanı — `ultra` devralınmaz; katalogda `gpt-5.6-luna` `max`'ta bitiyor |
| architect/claude `claude-opus-5-5` + `high` | architect/claude `effort: low` | `claude-opus-5-5` + `low` |
| architect/claude `claude-opus-5-5` + `high` | `defaults.claude.model: sonnet` | `sonnet` + Claude varsayılanı — yerel katman ortak ajana özel girdiyi de ezer |
| — | — | Satır yok; ekosistem varsayılanı |

## L2 — Üretim

### Ekosisteme yazım

| Dosya | Model | Effort |
|---|---|---|
| `.claude/agents/<ad>.md` | frontmatter `model:` | frontmatter `effort:` |
| `.codex/agents/<ad>.toml` | `model = "…"` | `model_reasoning_effort = "…"` |
| `.opencode/agents/<ad>.md` | frontmatter `model:` | frontmatter `reasoningEffort:` |

- Claude ajan dosyası artık birebir kopya değildir: gövde ve diğer frontmatter alanları
  kaynak rol dosyasından gelir; `model:` ve `effort:` yalnız çözümlemeden gelir ve
  frontmatter'ın sonuna, kapanış `---`'ten önce yazılır.
- Bir ekosistemin girdisi yalnız o ekosistemin dosyasına yansır. `claude` girdisi Codex'e
  ya da OpenCode'a hiçbir koşulda gitmez.
- `OPENCODE_MODEL_FALLBACK` silinir.
- Kaynak rol dosyasının frontmatter'ında `model:` ya da `effort:` bulunursa sync **durur**:
  modelin tek yeri `llm.json`'dır.
- `CLAUDE.md` ve `AGENTS.md`'nin üretilen başlığına bir satır eklenir: ajan dosyaları
  yoksa sync çalıştır. Taze klonda ve göç commit'i çekildiğinde okuyucuyu bu satır uyarır.

### Repodan çıkanlar — yerel üretim

`.gitignore`'a, sync'in yönettiği işaretli bir blok yazılır:

```gitignore
# >>> team-builder (generated by sync — do not edit this block)
/.agent-source/generated-files.json
/.agent-source/llm.local.json
/.claude/agents/architect.md
/.codex/agents/architect.toml
# <<< team-builder
```

- **Dizin değil, tek tek dosya yolu.** Aynı dizinlere kullanıcının elle yazdığı agent'lar
  da girebilir ve bu desteklenen bir durumdur (`canonical-source.md:128`); dizini toptan
  dışlamak onları sessizce repodan düşürürdü.
- Blok iki sabit girdi (defter ve `llm.local.json`) ile **manifest'ten hesaplanan ajan
  dosyalarından** (agent × etkin hedef) oluşur; yollar sıralanır. Yerel dosya içeriği etkilemez, dosya kümesini etkilemez; blok herkeste aynı
  çıkar. Agent eklenip çıkarıldığında kendiliğinden güncellenir.
- Bloğun dışına dokunulmaz. `.gitignore` yoksa yalnız blokla oluşturulur.
- `.gitignore` sembolik bağsa sync onun içinden yazmaz ve uyarır: bağ proje dışını
  gösterebilir.
- `.codex/agent-definitions/` model taşımaz; commit edilmeye devam eder.
- **Defter yerel olur.** Commit edilirse şu olur: takım arkadaşı bir agent'ı kaldırır,
  dosyasını siler, defteri commit eder; ben çektiğimde diskimdeki eski ajan dosyası
  defterde olmadığı için bayat raporlanmaz ve Claude onu yüklemeye devam eder. Yerel
  defterde o dosya benim önceki sync'imde kaydedilmiştir, bayat olarak raporlanır.

### `--check` ve yerel üretim

Yerel üretim dosyaları repoda yoktur; CI'da ve taze klonda hiç bulunmazlar. Bu yüzden:

- **Eksik** bir yerel üretim dosyası kayma sayılmaz; `--check` bunu bilgi satırı olarak
  söyler ("üretilmemiş — sync çalıştır") ve çıkış kodunu etkilemez.
- **Var olup farklı** olan yerel üretim dosyası kaymadır — örneğin yerel dosya
  değiştirildi ama sync çalıştırılmadı.
- Commit edilen üretilmiş dosyalar ve `.gitignore` bloğu için bugünkü kural sürer:
  eksik ya da farklı = kayma. `--check` hiçbir şey yazmaz.

## L3 — Doğrulama

Yeni `validate-llm.mjs`, kendi selftest'iyle. Sync onu manifest doğrulamasının yanında,
üretimden **önce** çağırır; her iki dosyayı ayrı doğrular.

### Biçim — hata, sync durur

Çevrimdışı, deterministik; hiçbir model ya da effort listesi içermez:

- Kapalı anahtar listeleri: kökte `defaults`, `agents`; ekosistem olarak `claude`,
  `codex`, `opencode`; girdide `model`, `effort`.
- Değerler boş olmayan ve boşluk içermeyen metindir. Boşluk içeren bir değer için mesaj
  tire kullanımını hatırlatır (`opus 5.5` → `claude-opus-5-5`).
- OpenCode modeli `sağlayıcı/model` biçimindedir (OpenCode'un kendi şartı).
- **Ortak dosyada** her agent manifest'te bulunur ve yazıldığı ekosistem o agent'ın etkin
  hedeflerinden biridir.

**Neden bu kadar gevşek:** Claude sağlayıcıya özgü kimlikleri (ARN, `@tarih` son eki,
dağıtım adı, ağ geçidinde serbest metin) ve `[1m]` son ekini kabul ediyor. `claude-`
önekini şart koşmak bile geçerli değerleri reddeden yeni bir kilit olurdu. Claude Code
Anthropic API'de adı kendisi doğruluyor.

### Uyarılar — sync sürer

- **Noktalı sürüm:** `claude-<aile>-<n>.<n>` biçimi → "Bunu mu kastettin:
  `claude-<aile>-<n>-<n>`?"
- **Yerel dosyada manifest'te olmayan agent** ya da hedeflenmeyen ekosistem. Takım
  arkadaşı bir agent'ı kaldırdığında benim sync'im eski yerel girdim yüzünden durmamalı.
- **Katalog** (aşağıda).

### Katalog kontrolü

Çözümlenmiş değerler — bu makinede fiilen çalışacak olanlar — karşılaştırılır:

| Ekosistem | Komut | Uyarı verilen durumlar |
|---|---|---|
| Codex | `codex debug models` | Model katalogda yok · effort modelin `supported_reasoning_levels`'ında yok · `upgrade` dolu → emeklilik tarihi ve yerine önerilen model |
| OpenCode | `opencode models --pure` | Model listede yok (sağlayıcı bu makinede yapılandırılmamış olabilir) |
| Claude | — | Katalog yok; kontrol yapılmaz |

- Yalnız uyarır; çıkış kodunu etkilemez — `--check` modunda da. Kataloglar makineye ve
  hesaba göre değişir, CI'da yoktur.
- Her komut sync başına en fazla bir kez, **10 saniye** sınırla çalışır (ölçülen 1–2 s).
- OpenCode `--pure` ile çalışır: onsuz `opencode models` projenin `.opencode/plugins/`'ini yükler
  ve repodaki kod sync'te çalışır (OpenCode 1.14.39 ile denendi). `--pure`'u tanımayan sürümde
  kontrol, yardım metnine bakılarak atlanır — yardım eklenti yüklemez.
- Komutlar **proje kökünde** çalışır, sync'in başlatıldığı dizinde değil: katalog projenin
  yapılandırmasına bağlıdır (OpenCode, projenin `opencode.json`'undaki sağlayıcıları ekler).
- Komut yalnız `PATH`'in tam nitelikli dizinlerinde aranır, çalışma dizininde asla —
  Windows önce çalışma dizinine bakardı ve orası proje köküdür. CLI'nın kendi aramaları
  (npm'in kurduğu CLI `node`'u arar) da aynı süzülmüş `PATH`'le, Windows'ta
  `NoDefaultCurrentDirectoryInExePath` ile yapılır. Windows'ta `PATHEXT` sırası izlenir (yalnız
  `.COM`/`.EXE`/`.BAT`/`.CMD`); `.cmd`/`.bat` sarmalayıcıları kabukla çalışır (argümanlar sabit).
- CLI yoksa kontrol **sessizce** atlanır (CI'da beklenen durum). CLI var ama hata verdi,
  zaman aşımına uğradı ya da çıktı çözümlenemediyse **tek bilgi satırı** yazılır ve kontrol
  atlanır.
- `visibility: hide` modeller katalogda sayılır; açıkça seçilmişlerse uyarı verilmez.
- Her uyarı `team-builder-models`'e yönlendirir.
- Selftest gerçek CLI çağırmaz; `generate()`'e sahte katalog verilir.

### `validate-manifest.mjs`

`model`, `model_reasoning_effort`, `opencode_model` alanları ve kilitleri kalkar. Bu
alanlardan biri manifest'te bulunursa **hata**: "Model ayarları artık
`.agent-source/llm.json`'da — `team-builder-models` ile göç et."

## L4 — Skill'ler

### Sözleşme: `team-builder-shared/llm-config.md`

Dosya biçimi, çözümleme kuralı, ekosistem eşlemesi, doğrulama ve katalog komutları. Setup
ve `team-builder-models` buna dayanır — `plan-gate.md` ile `work-plan` arasındaki düzenin
aynısı: sözleşme tek yerde, prosedür skill'de.

### Setup

Ortak `llm.json`'ı ilk kez kurar, ama model ve effort sorusunu kendisi sormaz:
`team-builder-models`'in *Ortak dosyayı kur* akışını izler. Manifest'e ve rol dosyasına
model yazmaz. `agent-md-rich.md` frontmatter şablonundan `model:` kalkar;
`governance-defaults.md` rol başına öneriyi Claude takma adı + effort olarak verir
(takma adlar eskimez, bu öneri metinde sabit durabilir).

Setup'ın "takım zaten kurulu" mesajı var olan skill'leri gösterir: model için
`team-builder-models`, preset için `team-builder-upgrade`, yeniden üretim için
`team-builder-sync`. Var olmayan `/team-builder-add` ve `/team-builder-edit` kalkar; rol
eklemek/düzenlemek için bir skill olmadığı açıkça yazılır (manifest + rol dosyası + sync).

### `team-builder-models`

Tetikleyiciler: "modelleri güncelle", "bu makine için model ayarla", "modeli değiştir",
"effort değiştir", "yeni model çıktı", "model kalktı". Üç akış:

**1. Ortak dosyayı kur.** Hedeflenen ekosistemlerin CLI'larını bulur, kataloglarını okur,
her rol için sade dille öneri sunar ve taşınabilir seçeneği öne çıkarır:

- **Claude:** takma ad (`governance-defaults.md`'deki rol önerisi) ve effort.
- **Codex:** yalnız katalogda `visibility: list` olan ve `upgrade` alanı boş modeller;
  effort olarak modelin `default_reasoning_level`'ı, seçenekler
  `supported_reasoning_levels`'tan.
- **OpenCode:** önce "takım ortak bir sağlayıcı kullanıyor mu?" diye sorar; hayırsa
  OpenCode ortak dosyaya girmez, her makine kendi yerel dosyasında belirler.

Kullanıcı onaylar ya da değiştirir; dosya yazılır.

**2. Bu makineyi hazırla.** Klondan sonra ya da sync uyardığında. Ortak dosyadaki her
çözümlenmiş seçimi bu makinenin kataloğuyla karşılaştırır; bulunmayanlar için katalogdan
seçenek önerir. Kişisel bir tercih olup olmadığını sorar. `llm.local.json`'a **yalnız
farkları** yazar; fark yoksa dosya oluşmaz. Sonra sync.

**3. Değiştir ve yenile.**

- Bir değişiklik isteğinde önce **kim için** olduğunu sorar: takım (ortak dosya) mı,
  yalnız sen (yerel dosya) mi?
- Yenilemede açık her seçimi kataloglarla karşılaştırır: katalogda olmayan → kalkmış ya da
  bu makinede yok; `upgrade` dolu → emeklilik tarihi ve önerilen yerine geçen.
- Model değişince effort'u yeni modelin desteklediği seviyelerden yeniden sorar (L1'deki
  bağ).
- Claude'da katalog yok: takma adlar zaten güncel sürümü gösterir. Sabitlenmiş tam adlar
  için güncel adları Claude'un model belgesinden okumayı dener; okuyamazsa bunu açıkça
  söyler, ad uydurmaz.

**Commit ve push:** ortak dosya değiştiğinde skill dosyayı yazar ve commit edilmesi
gerektiğini söyler; commit ve push'u kendisi yapmaz.

### Diğer skill'ler

- `team-builder-sync`: klondan sonra sync'in gerektiğini ve katalog uyarılarının
  `team-builder-models`'e yönlendirdiğini söyler.
- `team-builder-upgrade`: kapsam dışı listesine "model ve effort → `team-builder-models`".

## L5 — Göç

**Zorunlu ve tek adımlık.** Güncellenmiş team-builder eski alanları gördüğünde sync durur
ve `team-builder-models`'i gösterir (L3). "Eski mod" yoktur: eski kodu yaşatmak bilinen iki
hatayı (Codex'e Claude takma adı, eskimiş yedek harita) yaşatır; model satırlarını yazmamak
ise `opencode_model` ile doğru ayarlanmış agent'ları uyarısız başka modele geçirir.

**İlke: göç, her ekosistemin bugün fiilen çalıştırdığını korur; bilinen yanlışları
korumaz.** Göç, takımın commit ettiği değerlerden geldiği için **ortak** dosyaya yazılır.

Tablo yalnız agent'ın **etkin hedeflerindeki** ekosistemlere uygulanır (`targets`, yoksa
`targetsDefault`). Hedeflenmeyen bir ekosistemin değeri hiçbir yerde çalışmıyordu — eski
yapı `model_reasoning_effort`'u her role yazıyordu — ve ortak dosyada hedeflenmeyen
ekosistem girdisi hatadır (L3); bu değer taşınmaz, kullanıcıya gösterilen planda söylenir.

| Bugün | Göçte |
|---|---|
| Claude: rol dosyasındaki `model:` | `claude.model`. Manifest'teki `model` farklıysa ikisi gösterilir, kullanıcı seçer. Rol dosyasında `model:` yoksa Claude varsayılanla çalışıyordu — alan boş kalır |
| Claude: rol dosyasındaki `effort:` | `claude.effort`. Team-builder bunu hiç yazmadı, ama rol dosyası Claude'a olduğu gibi kopyalandığı için elle eklenen satır etkiliydi. Satır yoksa Claude oturumun effort'uyla çalışıyordu — alan boş kalır |
| Codex: manifest `model` | Yalnız Codex kataloğunda bulunuyorsa `codex.model` olur. Claude hedefli agent'larda bu değer bir Claude takma adıydı — taşınmaz, katalogdan öneri sunulur. Katalog okunamıyorsa skill sorar |
| Codex: `model_reasoning_effort` | `codex.effort` |
| OpenCode: `opencode_model` | `opencode.model` |
| OpenCode: yedek haritadan gelen değer | **Taşınmaz**. Takımda herkes aynı sağlayıcıyı kullanıyorsa kullanıcı `opencode models`'tan seçer ya da boş bırakır; değilse ortak dosyaya yazılmaz, her makine kendi yerel dosyasında belirler (Akış 2) |

Ardından katalog kontrolü çalışır (örneğin emeklilik uyarısı).

**Adımlar** (kullanıcı onayından sonra):

1. `llm.json`'ı yaz.
2. Eski alanları manifest'ten, `model:` ve `effort:` satırlarını rol dosyalarından sil.
3. Üretilen ajan dosyalarını ve defteri `git rm --cached` ile takipten çıkar — diskteki
   dosyalar yerinde kalır.
4. Sync çalıştır — `.gitignore` bloğunu yazar, ajan dosyalarını yeniden üretir.
5. Skill commit etmez. Göçün tamamı tek bir commit'tir, git ile geri alınabilir. Skill,
   commit'e yeni `llm.json`'ın da girmesi gerektiğini söyler: dosya henüz takip edilmediği
   için `git commit -a` onu almaz ve unutulursa takım sessizce varsayılan modellerle çalışır.

**Takım arkadaşlarına etkisi.** Git, takibi bırakılan dosyaları commit'i çeken herkesin
diskinden **siler**. Göç commit'ini çeken herkes bir kez sync çalıştırmalıdır;
`CLAUDE.md`/`AGENTS.md` başlığındaki satır bu an içindir. Takımdaki herkes team-builder'ın
yeni sürümüne geçmelidir; eski sürüm `llm.json`'ı tanımaz.

## team-builder reposunda değişecekler

| Dosya | Değişiklik |
|---|---|
| `team-builder-models/SKILL.md` | **YENİ** — üç akış + göç |
| `team-builder-shared/llm-config.md` | **YENİ** — sözleşme: biçim, çözümleme, eşleme, doğrulama, katalog |
| `team-builder-shared/validate-llm.mjs` | **YENİ** — biçim doğrulaması + selftest |
| `team-builder-shared/sync-agent-config.mjs` | Çözümleme; ekosistem başına yazım; `OPENCODE_MODEL_FALLBACK` silinir; kaynak rol dosyasında `model:`/`effort:` → dur; `.gitignore` bloğu; `--check`'te eksik yerel üretim; katalog kontrolü; `CLAUDE.md`/`AGENTS.md` başlık satırı |
| `team-builder-shared/validate-manifest.mjs` | Model/effort alanları ve kilitleri kalkar; eski alan → göç hatası |
| `team-builder-setup/SKILL.md` | Model/effort adımı `team-builder-models`'e devredilir; "takım kurulu" mesajındaki ölü bağlantılar düzeltilir |
| `team-builder-sync/SKILL.md` | Klondan sonra sync; katalog uyarıları |
| `team-builder-upgrade/SKILL.md` | Kapsam dışı: model/effort → `team-builder-models` |
| `team-builder-shared/agent-md-rich.md` | Frontmatter şablonundan `model:` kalkar |
| `team-builder-shared/governance-defaults.md` | Rol başına öneri: Claude takma adı + effort |
| `team-builder-shared/manifest-schema.md` | Model alanları, kuralları ve örnekleri kalkar (`gpt-5.5` örneği dahil) |
| `team-builder-shared/codex-target.md` | Model/effort kaynağı `llm.json` |
| `team-builder-shared/opencode-target.md` | Model/effort kaynağı `llm.json`; yedek harita kalkar; `reasoningEffort` |
| `team-builder-shared/canonical-source.md` | Ağaca `llm.json`/`llm.local.json`; defter artık yerel |
| `team-builder-shared/sync-pipeline.md` | `.gitignore` bloğu; yerel defter; `--check` ve yerel üretim; katalog uyarıları |
| `README.md` | Skill tablosuna `team-builder-models` — ve E'den beri eksik olan `team-builder-upgrade` |

## Kabul kriterleri

### Olumlu (R)

| # | Durum | Beklenen |
|---|---|---|
| L-R1 | Ortak dosyada agent + ekosistem için model ve effort | Üç hedefte L2 tablosundaki yerlere yazılır |
| L-R2 | Yerel dosya bir ajan girdisini ezdi | Yalnız bu makinede değişir; `.gitignore` bloğu değişmez |
| L-R3 | Yerel `defaults`, ortak ajana özel girdiyle çakıştı | Yerel kazanır |
| L-R4 | Yerel dosyada yalnız effort | Model ortak dosyadan gelir |
| L-R5 | Yerel dosyada yalnız model | Ortak effort devralınmaz; effort satırı yok |
| L-R6 | Hiçbir katmanda değer yok | Satır yazılmaz; ekosistem varsayılanı |
| L-R7 | Taze klon + sync | Ajan dosyaları ortak dosyadan üretilir |
| L-R8 | Kullanıcının elle yazdığı bir agent `.claude/agents/`'ta | `.gitignore`'a girmez, commit edilebilir |
| L-R9 | Agent eklendi / çıkarıldı | Blok kendiliğinden güncellenir |
| L-R10 | Takım arkadaşı bir agent'ı kaldırdı, ben çektim | Diskimdeki eski ajan dosyası bayat raporlanır |
| L-R11 | Codex kataloğunda `upgrade` dolu bir model seçili | Sync emeklilik tarihini ve yerine geçen modeli uyarır |
| L-R12 | Yeni makine; ortak bir seçim bu makinenin kataloğunda yok | Alternatif önerilir; yalnız fark yerel dosyaya yazılır |
| L-R13 | Yeni makine; her seçim mevcut, kişisel tercih yok | Yerel dosya oluşmaz |
| L-R14 | Model değişikliği isteği | Önce "takım mı, sen mi" sorulur; ortak dosya değişirse commit hatırlatılır |
| L-R15 | Model değişti | Effort yeni modelin desteklediği seviyelerden sorulur |
| L-R16 | Eski projede göç | Her ekosistemin bugün çalıştırdığı korunur; Codex'teki Claude takma adı ve yedek harita değerleri taşınmaz |
| L-R17 | Göçte manifest `model` ≠ rol dosyası `model:` | İkisi gösterilir, kullanıcı seçer |
| L-R18 | Eski kilitlerin reddettiği geçerli değerler: `fable`, `claude-opus-5-5`, `inherit`, `opus[1m]`, `claude-sonnet-4-5@20250929`, bir Bedrock ARN'si, `xhigh`, `max`, `ultra` | Hepsi geçer |
| L-R19 | Setup, takımın ortak OpenCode sağlayıcısı yok | OpenCode ortak dosyaya girmez |

### Olumsuz (N)

| # | Durum | Beklenen |
|---|---|---|
| L-N1 | Bilinmeyen kök, ekosistem ya da girdi anahtarı (iki dosyada da) | Hata |
| L-N2 | Boş ya da boşluk içeren değer | Hata; boşluk için tire ipucu |
| L-N3 | OpenCode modeli `sağlayıcı/model` değil | Hata |
| L-N4 | Ortak dosyada manifest'te olmayan agent | Hata |
| L-N5 | Ortak dosyada agent'ın hedeflemediği ekosistem | Hata |
| L-N6 | Yerel dosyada manifest'te olmayan agent | Uyarı; sync sürer |
| L-N7 | Kaynak rol dosyasında `model:` ya da `effort:` | Sync durur |
| L-N8 | Manifest'te `model`, `model_reasoning_effort` ya da `opencode_model` | Doğrulama durur, göçe yönlendirir |
| L-N9 | `claude` girdisi | Codex ya da OpenCode çıktısına hiçbir koşulda yansımaz |
| L-N10 | Katalogda olmayan model ya da desteklenmeyen effort | Uyarı; sync sürer, çıkış kodu değişmez |
| L-N11 | CLI yok | Katalog kontrolü sessizce atlanır |
| L-N12 | CLI var ama hata / zaman aşımı / çözümlenemeyen çıktı | Tek bilgi satırı; sync sürer |
| L-N13 | CI'da `--check`, yerel üretim dosyaları yok | Başarısızlık değil; bilgi satırı |
| L-N14 | `--check` modu | `.gitignore` yazılmaz; güncel olmayan blok kayma olarak raporlanır |
| L-N15 | `.gitignore`'da blok dışı satırlar | Dokunulmaz |
| L-N16 | Skill ortak dosyayı değiştirdi | Commit ve push yapmaz |
| L-N17 | Yenilemede Claude tam adı doğrulanamadı | Açıkça söylenir; ad uydurulmaz |

## Test

Mekanik olarak test edilebilen her şey selftest'le test edilir ve mutasyon testiyle testin
gerçekten bir kuralı koruduğu gösterilir.

- **`validate-llm.mjs` selftest:** L-N1…L-N6 ve L-R18. L-R18 gerileme korumasıdır: biri
  ileride bir liste eklerse kırmızıya döner.
- **Sync selftest:**
  - Çözümleme: L-R2…L-R6 ve L1'deki örnek tablo.
  - Üretim: L-R1, L-N7, L-N8, L-N9; Claude gövdesinin değişmediği; OpenCode'da yedek
    haritanın olmadığı.
  - `.gitignore`: L-R8, L-R9, L-N14, L-N15; bloğun yerel dosyadan bağımsız olduğu.
  - Yerel defter: L-R10.
  - `--check`: L-N13.
  - Katalog (sahte katalogla): L-R11, L-N10, L-N11, L-N12.

**Elle yürütülen provalar**, dosyaları ilk kez okuyan biri tarafından: kurulum akışı
(L-R19), yeni makine (L-R12, L-R13), değiştirme (L-R14, L-R15, L-N16), yenileme (L-N17) ve
eski yapıdaki bir fixture projenin göçü (L-R16, L-R17). Ek olarak bu makinede gerçek
`codex debug models` ve `opencode models` ile bir çalıştırma, ve üretilen bir OpenCode ajanının
`opencode debug agent <ad>` ile `options.reasoningEffort` taşıdığının görülmesi.

## Revizyon 1 — Ajan dosyaları git'te

**Neden.** Ajan dosyalarını git dışına almak, team-builder kurmayan takım arkadaşını
bozuyordu: göç commit'ini çekince git ajan dosyalarını diskinden siliyordu, yeni klonda hiç
yoktular, biri bir ajanı değiştirdiğinde de ötekiler sync çalıştırana kadar eski ajanla
çalışıyordu. Ajanları yalnız kullananlar team-builder komutu çalıştırmaz.

**Yeni davranış.**
- Ajan dosyaları ve defter commit edilir. `.gitignore` bloğunda yalnız
  `/.agent-source/llm.local.json` durur.
- Sync `llm.local.json`'u uygulamaya devam eder. Yerel değerin değiştirdiği ajan dosyalarını
  bir uyarı satırında listeler; kullanıcı onları commit'e katmaz.
- `--no-local` yerel dosyayı hiç okumaz ve takımın hâlini yazar (yerel farkı olan bir
  makineden `llm.json` değişikliğini commit etmeden önce).
- `--check` bu makinenin çözümlemesiyle karşılaştırır; eksik ajan dosyası ve eksik defter
  kaymadır. CI'da yerel dosya olmadığı için yanlışlıkla commit edilmiş yerel değer orada
  kayma olarak görünür.
- `CLAUDE.md` ve `AGENTS.md` yalnız standart üretim başlığını taşır.
- Göç hiçbir dosyayı takipten çıkarmaz; commit'i çeken takım arkadaşının bir şey yapması
  gerekmez.

**Bedel.** Yerel farkı olan makinede o ajan dosyaları `git status`'ta değişmiş görünür;
çekilen bir commit aynı dosyayı değiştiriyorsa önce geri alınması gerekir.

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Model ve effort agent tanımından ayrılır, `llm.json`'da durur | Rol ve model farklı hızda değişir; bugün iki kaynak birbirinden kayıyor |
| 2 | Ortak + yerel dosya; yerel her zaman ezer | Kişiye özel katman; kuralın tek cümle olması |
| 3 | Yerel dosyanın adı `llm.local.json`, makine adı yok | `.gitignore`'da olduğu için zaten makineye özel; makine adı kararsız |
| 4 | Ekosistem başına açık eşleme, çeviri tablosu yok | Model ad alanları ekosistemler arasında farklı; tablo eskir |
| 5 | Model değişen katmanın altındaki effort devralınmaz | Effort geçerliliği modele bağlı (katalogda ölçüldü) |
| 6 | ~~Ajan dosyaları ve defter yerel üretimdir~~ **Revizyon 1:** git'tedir; yerel farkı olan makine değişen dosyaları commit etmez | Ajanları yalnız kullanan, team-builder kurmadan çalışabilmeli |
| 7 | `.gitignore` işaretli blokta; **Revizyon 1:** yalnız `llm.local.json` | Blok herkeste aynı |
| 8 | ~~Defter yerel~~ **Revizyon 1:** defter git'te | Ajan dosyaları git'teyken yeni klon da bayat dosyaları görmeli |
| 9 | Biçim doğrulanır, üyelik doğrulanmaz | Claude sağlayıcıya özgü kimlikleri kabul ediyor; kilitler bugün geçerli değerleri reddediyor |
| 10 | Katalog kontrolü yalnız uyarır | Katalog makineye ve hesaba bağlı; CI'da yok |
| 11 | OpenCode yedek haritası silinir | Kodda sabit sürüm adları eskiyor; model yoksa OpenCode'un kendi kuralı işler |
| 12 | Yeni skill: `team-builder-models` | Setup bir kez çalışır, sync ince kalır, upgrade preset'lerle sınırlı |
| 13 | Setup model sorusunu `team-builder-models`'e bırakır | Aynı prosedür iki yerde anlatılırsa kayar |
| 14 | Göç zorunlu ve tek adımlık | "Eski mod" ya bilinen hataları yaşatır ya modelleri uyarısız değiştirir |
| 15 | Göç bugün çalışanı korur, bilinen yanlışları korumaz | Davranışı koruyan ama hatayı taşımayan tek yol |
| 16 | Skill commit ve push yapmaz | Paylaşılan repoya kendiliğinden gönderim riskli |
| 17 | ~~`--check` eksik yerel üretimi kayma saymaz~~ **Revizyon 1:** yerel üretim yok; eksik dosya kaymadır | Her üretilen dosya git'te |

## Kapsam dışı

- **Profil dosyaları** (`llm.ci.json` gibi, bir ortam değişkeniyle seçilen). Bu tasarımı
  değiştirmeden sonradan eklenebilir.
- **Projeler arası kullanıcı düzeyinde dosya.** Aynı gerekçe.
- **Claude kataloğu.** Claude CLI'ında listeleme komutu yok.
- **Effort dışındaki sağlayıcı seçenekleri** (`temperature` vb.).
- **Rol eklemek / düzenlemek için bir skill.** Setup'ın mesajı bunun yokluğunu açıkça
  söyler; skill'in kendisi ayrı iş.
