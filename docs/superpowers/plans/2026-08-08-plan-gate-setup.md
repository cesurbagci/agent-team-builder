# Plan Kapısı — Kurulum Entegrasyonu (Plan 2/2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 1'de üretilen artefaktları kurulum akışına bağlamak — manifest şeması ve doğrulayıcı, sihirbazın beşinci anayasa presetiyle iki kapı sahibi sorusu, `codeReviewer`'dan üretilen governance metni, architect'siz takım koşullandırması.

**Architecture:** Üç katman. (1) **Makine katmanı:** `validate-manifest.mjs` plan kapısı değişmezlerini ve agent adı kurallarını doğrular; `sync-agent-config.mjs` yeni yetenek kazanmaz, yalnız mevcut davranışı kanıtlayan iki selftest alır. (2) **Sihirbaz katmanı:** `constitution.md` KARAR 5, `wizard-state.md` durum alanı, `team-builder-setup/SKILL.md` soru ve üretim adımları. (3) **Prose katmanı:** `routing.md`, `governance-defaults.md`, `agent-md-rich.md` — `codeReviewer`'dan üretim ve architect'siz koşullandırma.

**Tech Stack:** Node.js ≥18 (harici bağımlılık yok), Markdown, repo'nun kendi `--selftest` deseni.

## Global Constraints

- **Doküman dili Türkçe.** Kod, dosya adı ve commit mesajı İngilizce.
- **Kaynak kodu yorumları İngilizce.** `sync-agent-config.mjs` ve `validate-plan-gate.mjs` bu kuralı izliyor. `validate-manifest.mjs` bugün Türkçe yorumlu; **bu planda eklenen yeni kod İngilizce yorumlanır**, var olan Türkçe yorumlar çevrilmez (o ayrı bir iş, bu planın diff'ini şişirir).
- **Hata mesajları Türkçe.** `validate-manifest.mjs`'in mevcut mesajları Türkçe; yeni mesajlar da Türkçe olur — kullanıcıya gösterilirler.
- **Harici bağımlılık eklenmez.** Yalnız Node stdlib.
- **`sync-agent-config.mjs`'in üretim davranışı değişmez.** Bu plan ona yalnız **selftest** ekler. Yeni dosya üretme, yeni mirror, yeni ledger davranışı yok — S1/S2 var olan davranışı kanıtlar.
- **`.agent-work/` generated değildir.** Sync onu üretmez, drift kontrolüne sokmaz, ledger sahiplenmez.
- **Plan 1 artefaktları hazır ve değişmez:** `team-builder-shared/plan-gate.md`, `templates/plan.md`, `templates/work-plan-skill.md`, `validate-plan-gate.mjs`. Bu plan onları **düzenlemez**; yalnız kurulum akışından onlara atıf yapar.
- **Spec:** `docs/superpowers/specs/2026-08-02-plan-gate-design.md` — çelişki olursa spec geçerlidir.

## Dosya yapısı

| Dosya | Bu planda ne olur |
|---|---|
| `team-builder-shared/manifest-schema.md` | `constitution.planGate` ve kök `planGate` nesnesi şemaya eklenir; ad kuralları yazılır |
| `team-builder-shared/validate-manifest.mjs` | V1–V16 kuralları + selftest vakaları |
| `team-builder-shared/sync-agent-config.mjs` | Yalnız S1/S2 selftest vakaları |
| `team-builder-shared/canonical-source.md` | `.agent-work/` generated değil notu |
| `team-builder-shared/sync-pipeline.md` | Aynı not, pipeline tarafından |
| `team-builder-shared/constitution.md` | KARAR 5 (`planGate`) + "dördü de default açık" düzeltmesi |
| `team-builder-shared/wizard-state.md` | `answers.planGate` |
| `team-builder-setup/SKILL.md` | Adım 6 (routing), Adım 7B (beşinci toggle + iki soru), Adım 8a (üretim) |
| `team-builder-shared/routing.md` | `codeReviewer`'dan üretim + architect'siz koşul |
| `team-builder-shared/governance-defaults.md` | Aynı ikisi |
| `team-builder-shared/agent-md-rich.md` | `## Plan Kapısı` bölümü + architect'siz koşul |
| `README.md` | İki dilde: preset sayısı ve "hepsi default açık" düzeltmesi |

## Görev sırası ve neden

Task 1 önce gelir çünkü şema kararı (alan adları, değişmezler) sonraki her şeyin sözleşmesidir. Task 2 bağımsızdır ve paralel gidebilir. Task 3–4 sihirbazı kurar ve Task 1'in şemasına dayanır. Task 5 prose koşullandırmasıdır ve Task 4'ten sonra gelir çünkü ikisi de `team-builder-setup/SKILL.md`'ye dokunur. Task 6 son.

---

### Task 1: Manifest şeması ve doğrulayıcı (V1–V16)

Plan kapısı değişmezlerini makine tarafına indirir. **Ayrıca bugün açık olan bir güvenlik deliğini kapatır:** agent adları generated dosya yollarına doğrudan gömülüyor (`sync-agent-config.mjs:409,419,425`) ve doğrulayıcı bugün adı "boş olmayan string" diye kabul ediyor. `../../../x` adlı bir agent hedef dizinin dışına yazdırır. V11/V12 bunu kapatır ve **plan kapısı kapalı projelerde de geçerlidir**.

> **V13b'nin sonucu bilinçlidir.** "Hedeflenen her ekosistemde en az bir uygun executor olmalı" kuralı, yalnız denetleyici rolü için ek bir ekosistem hedefleyen manifest'i reddeder (örn. architect claude+codex, tüm developer'lar claude). Spec bunu isteyerek şart koşuyor: aksi halde o ekosistemde açılan her plan çalışma anında reddedilirdi. Kural **yalnız `planGate` açıkken** işler.

**Files:**
- Modify: `team-builder-shared/manifest-schema.md`
- Modify: `team-builder-shared/validate-manifest.mjs`

**Interfaces:**
- Consumes: yok
- Produces: `validate(doc)` — geçersizse `Error` fırlatır, geçerliyse `true`. Task 4'teki sihirbaz üretimi bu fonksiyonu çağırır.

- [ ] **Step 1: Başarısız selftest vakalarını yaz**

`team-builder-shared/validate-manifest.mjs` içinde, var olan `if (process.argv.includes("--selftest")) {` bloğunun **sonuna**, `if (!ok) process.exit(1);` satırından **önce** ekle:

```javascript
  // ---------------------------------------------------------------------
  // V1–V16: plan gate manifest invariants.
  // ---------------------------------------------------------------------

  // A manifest that is valid with the gate off. Cases mutate a fresh copy.
  const gateBase = () => ({
    targetsDefault: ["claude"],
    routing: [{ path: "src/**", role: "dev" }],
    agents: [
      { name: "dev", model: "sonnet" },
      { name: "architect", model: "opus", writesCode: false },
    ],
  });

  const expectReject = (label, doc, fragment) => {
    let message = null;
    try {
      validate(doc);
    } catch (e) {
      message = e.message;
    }
    if (message === null) {
      console.error(`SELFTEST FAIL: ${label} accepted`);
      ok = false;
    } else if (fragment && !message.includes(fragment)) {
      console.error(
        `SELFTEST FAIL: ${label} rejected for the wrong reason: ${message}`
      );
      ok = false;
    }
  };

  const expectAccept = (label, doc) => {
    try {
      if (validate(doc) !== true) {
        console.error(`SELFTEST FAIL: ${label} rejected (no true)`);
        ok = false;
      }
    } catch (e) {
      console.error(`SELFTEST FAIL: ${label} rejected: ${e.message}`);
      ok = false;
    }
  };

  // V1 — constitution.planGate must be boolean.
  expectReject(
    "V1 planGate string",
    { ...gateBase(), constitution: { planGate: "yes" } },
    "constitution.planGate boolean olmalı"
  );

  // V2 — gate on, root object missing.
  expectReject(
    "V2 gate on without root object",
    { ...gateBase(), constitution: { planGate: true } },
    "kök planGate nesnesi yok"
  );

  // V3 — gate off, root object present.
  expectReject(
    "V3 gate off with root object",
    {
      ...gateBase(),
      constitution: { planGate: false },
      planGate: { planReviewer: null, codeReviewer: null },
    },
    "açık değil"
  );

  // V3b — constitution.planGate absent entirely, root object present.
  expectReject(
    "V3b no constitution flag with root object",
    { ...gateBase(), planGate: { planReviewer: null, codeReviewer: null } },
    "açık değil"
  );

  // V4 — codeReviewer key missing.
  expectReject(
    "V4 codeReviewer missing",
    {
      ...gateBase(),
      constitution: { planGate: true },
      planGate: { planReviewer: "architect" },
    },
    "planGate.codeReviewer zorunlu"
  );

  // V5 — both owners null is a valid configuration.
  expectAccept("V5 both owners null", {
    ...gateBase(),
    constitution: { planGate: true },
    planGate: { planReviewer: null, codeReviewer: null },
  });

  // V6 — owner is not a defined agent.
  expectReject(
    "V6 unknown owner",
    {
      ...gateBase(),
      constitution: { planGate: true },
      planGate: { planReviewer: "ghost", codeReviewer: null },
    },
    "agents içinde bir name olmalı"
  );

  // V7 — owner omits writesCode, so it defaults to a code-writing agent.
  expectReject(
    "V7 owner writes code by default",
    {
      ...gateBase(),
      constitution: { planGate: true },
      planGate: { planReviewer: "dev", codeReviewer: null },
    },
    "kod yazmayan"
  );

  // V7b — writesCode must be a real boolean. A falsy non-boolean must not
  // sneak an agent past the "does not write code" requirement.
  expectReject(
    "V7b writesCode is not boolean",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: "architect", codeReviewer: null },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", model: "sonnet" },
        { name: "architect", model: "opus", writesCode: 0 },
      ],
    },
    "writesCode boolean olmalı"
  );

  // V8 — owner is not generated for every ecosystem its executors run in.
  expectReject(
    "V8 owner does not cover executor targets",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: "architect", codeReviewer: null },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", targets: ["claude", "codex"], model: "sonnet" },
        {
          name: "architect",
          targets: ["claude"],
          model: "opus",
          writesCode: false,
        },
      ],
    },
    "kapsamalı"
  );

  // V9 — the owner may inherit coverage from targetsDefault.
  expectAccept("V9 owner covers via targetsDefault", {
    targetsDefault: ["claude", "codex"],
    constitution: { planGate: true },
    planGate: { planReviewer: "architect", codeReviewer: null },
    routing: [{ path: "src/**", role: "dev" }],
    agents: [
      { name: "dev", model: "sonnet" },
      { name: "architect", model: "opus", writesCode: false },
    ],
  });

  // V10 — duplicate agent name.
  expectReject(
    "V10 duplicate name",
    {
      targetsDefault: ["claude"],
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", model: "sonnet" },
        { name: "dev", model: "opus" },
      ],
    },
    "benzersiz"
  );

  // V11 — a name that is not a portable slug can escape the target directory.
  expectReject(
    "V11 path traversal in name",
    {
      targetsDefault: ["claude"],
      agents: [{ name: "../../../escaped", model: "sonnet" }],
    },
    "portatif slug"
  );
  for (const bad of [
    "dev/ops", // a bare slash — the traversal case above also fails on dots
    "back end dev",
    "dev\\ops",
    "Dev", // uppercase alone
    "dev\u0007ops", // control character
    "dev--ops", // double separator
    "-dev", // leading separator
  ]) {
    expectReject(
      `V11 invalid name ${JSON.stringify(bad)}`,
      {
        targetsDefault: ["claude"],
        agents: [{ name: bad, model: "sonnet" }],
      },
      "portatif slug"
    );
  }

  // V12 — names that differ only by case collide on case-insensitive volumes.
  expectReject(
    "V12 case-only difference",
    {
      targetsDefault: ["claude"],
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", model: "sonnet" },
        { name: "Dev", model: "opus" },
      ],
    },
    "benzersiz"
  );

  // V13 — gate on but no routed, code-writing agent exists.
  expectReject(
    "V13 no eligible executor",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: null, codeReviewer: null },
      routing: [],
      agents: [{ name: "architect", model: "opus", writesCode: false }],
    },
    // Not "uygun executor yok": this fixture also trips the per-ecosystem
    // check, whose message carries that same phrase. This fragment is unique
    // to the global rule.
    "en az bir agent gerekli"
  );

  // V13b — a targeted ecosystem with no eligible executor in it.
  expectReject(
    "V13b targeted ecosystem without executor",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: "architect", codeReviewer: null },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", targets: ["claude"], model: "sonnet" },
        {
          name: "architect",
          targets: ["claude", "codex"],
          model: "opus",
          writesCode: false,
        },
      ],
    },
    "ekosisteminde uygun executor yok"
  );

  // V14 — planReviewer key missing.
  expectReject(
    "V14 planReviewer missing",
    {
      ...gateBase(),
      constitution: { planGate: true },
      planGate: { codeReviewer: null },
    },
    "planGate.planReviewer zorunlu"
  );

  // V15 — root planGate is not a plain object. The spec names both an array
  // and a string, so test both.
  for (const shape of [["architect"], "architect"]) {
    expectReject(
      `V15 planGate ${JSON.stringify(shape)}`,
      {
        ...gateBase(),
        constitution: { planGate: true },
        planGate: shape,
      },
      "planGate bir nesne olmalı"
    );
  }

  // V16 — owner value is neither an agent name nor null. The spec names both
  // a number and an object.
  for (const owner of [42, { name: "architect" }]) {
    expectReject(
      `V16 owner ${JSON.stringify(owner)}`,
      {
        ...gateBase(),
        constitution: { planGate: true },
        planGate: { planReviewer: owner, codeReviewer: null },
      },
      "agent adı ya da null olmalı"
    );
  }
```

- [ ] **Step 2: Selftest'i çalıştır, kırmızı olduğunu gör**

```bash
node team-builder-shared/validate-manifest.mjs --selftest
```

Beklenen: exit 1 ve çok sayıda `SELFTEST FAIL: ... accepted` satırı — kural kodu henüz yok, geçersiz manifest'ler kabul ediliyor. `V5` ve `V9` (kabul vakaları) geçmeli.

- [ ] **Step 3: Ad kurallarını uygula**

`team-builder-shared/validate-manifest.mjs`, dosya başındaki sabitlere ekle:

```javascript
// Agent names are embedded directly in generated file paths
// (sync-agent-config.mjs:409,419,425). Anything outside this slug — a slash,
// a backslash, a space, a control character — can escape the target directory.
const NAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
```

`CONSTITUTION_FIELDS` dizisine `"planGate"` ekle:

```javascript
const CONSTITUTION_FIELDS = [
  "noWorkaround",
  "codeDocSync",
  "perAgentMemory",
  "languageStandard",
  "planGate",
];
```

`validate()` içinde `const agentNames = new Set();` satırını şununla değiştir:

```javascript
  const agentsByName = new Map();
  const agentNamesLower = new Set();
```

Agent döngüsündeki name bloğunu şununla değiştir:

```javascript
    // name zorunlu
    if (!a || !a.name || typeof a.name !== "string") {
      errors.push(`${label}: name zorunlu`);
    } else {
      if (!NAME_SLUG.test(a.name)) {
        errors.push(
          `${label}: name portatif slug olmalı — yalnız küçük harf, rakam ve tek tire (^[a-z0-9]+(?:-[a-z0-9]+)*$)`
        );
      }
      const lower = a.name.toLowerCase();
      if (agentNamesLower.has(lower)) {
        errors.push(
          `${label}: agent adı benzersiz olmalı (karşılaştırma büyük/küçük harf duyarsız)`
        );
      }
      agentNamesLower.add(lower);
      agentsByName.set(a.name, a);
    }

    // writesCode decides who may own a gate, so a non-boolean must not slip
    // through: `writesCode: 0` would otherwise read as "does not write code".
    // This check is what makes the strict `!== false` comparisons below safe —
    // do not drop it on the grounds that those comparisons are strict.
    if (a && a.writesCode !== undefined && typeof a.writesCode !== "boolean") {
      errors.push(`${label}: writesCode boolean olmalı`);
    }
```

`lead` ve `routing` kontrollerindeki `agentNames.has(...)` çağrılarını `agentsByName.has(...)` yap (iki yer: `doc.lead` kontrolü ve `routing[i].role` kontrolü).

- [ ] **Step 4: Plan kapısı kurallarını uygula**

`export function validate(doc)` bloğundan **önce**, `CONSTITUTION_FIELDS` tanımından sonra ekle:

```javascript
// Effective targets: the agent's own list, falling back to the root default.
// There is no built-in default ecosystem — an agent with neither is already
// rejected by the main loop.
function effectiveTargets(doc, agent) {
  if (Array.isArray(agent && agent.targets)) return agent.targets;
  if (Array.isArray(doc.targetsDefault)) return doc.targetsDefault;
  return [];
}

// Eligible executors: agents that appear as a routing role AND write code.
// writesCode defaults to true, so an agent that omits the field counts as one.
function eligibleExecutors(doc) {
  const routed = new Set(
    (Array.isArray(doc.routing) ? doc.routing : [])
      .map((r) => r && r.role)
      .filter(Boolean)
  );
  return (Array.isArray(doc.agents) ? doc.agents : []).filter(
    (a) => a && routed.has(a.name) && a.writesCode !== false
  );
}

function validatePlanGate(doc, errors, agentsByName) {
  const enabled = doc.constitution ? doc.constitution.planGate : undefined;
  // A non-boolean flag is already reported by the constitution field loop;
  // stay quiet here so one mistake does not produce two messages.
  if (enabled !== undefined && typeof enabled !== "boolean") return;

  const hasGate = doc.planGate !== undefined;
  if (enabled === true && !hasGate) {
    errors.push("constitution.planGate açık ama kök planGate nesnesi yok");
    return;
  }
  if (enabled !== true) {
    if (hasGate) {
      errors.push(
        "kök planGate nesnesi var ama constitution.planGate açık değil"
      );
    }
    return;
  }

  const gate = doc.planGate;
  if (gate === null || typeof gate !== "object" || Array.isArray(gate)) {
    errors.push("planGate bir nesne olmalı");
    return;
  }

  // Every ecosystem the project targets has to be able to run a plan, and the
  // gate owner has to exist in every ecosystem its executors run in. Together
  // these keep work from landing where no reviewer or no executor exists.
  const executors = eligibleExecutors(doc);
  const executorTargets = new Set(
    executors.flatMap((a) => effectiveTargets(doc, a))
  );
  if (executors.length === 0) {
    errors.push(
      "planGate açık ama uygun executor yok — routing[].role olarak geçen ve kod yazan en az bir agent gerekli"
    );
  }

  const targeted = new Set(
    (Array.isArray(doc.agents) ? doc.agents : []).flatMap((a) =>
      effectiveTargets(doc, a)
    )
  );
  for (const eco of targeted) {
    if (!executorTargets.has(eco)) {
      errors.push(`planGate açık ama "${eco}" ekosisteminde uygun executor yok`);
    }
  }

  for (const key of ["planReviewer", "codeReviewer"]) {
    if (!(key in gate)) {
      errors.push(`planGate.${key} zorunlu (agent adı ya da null)`);
      continue;
    }
    const owner = gate[key];
    if (owner === null) continue;
    if (typeof owner !== "string") {
      errors.push(`planGate.${key} agent adı ya da null olmalı`);
      continue;
    }
    const agent = agentsByName.get(owner);
    if (!agent) {
      errors.push(`planGate.${key} "${owner}" agents içinde bir name olmalı`);
      continue;
    }
    if (agent.writesCode !== false) {
      errors.push(
        `planGate.${key} "${owner}" kod yazmayan bir agent olmalı (writesCode: false)`
      );
      continue;
    }
    const ownerTargets = new Set(effectiveTargets(doc, agent));
    for (const eco of executorTargets) {
      if (!ownerTargets.has(eco)) {
        errors.push(
          `planGate.${key} "${owner}" "${eco}" ekosisteminde üretilmiyor — kapı sahibi tüm uygun executor'ların ekosistemlerini kapsamalı`
        );
      }
    }
  }
}
```

`validate()` içinde, son `if (errors.length) {` **satırını** şununla değiştir — bu bir
**değiştirme**dir, araya ekleme değil; bloğu ikinci kez yazarsan sözdizimi bozulur:

```javascript
  validatePlanGate(doc, errors, agentsByName);

  if (errors.length) {
```

- [ ] **Step 5: Selftest'i çalıştır, yeşil olduğunu gör**

```bash
node team-builder-shared/validate-manifest.mjs --selftest
```

Beklenen: `SELFTEST PASS`, exit 0.

- [ ] **Step 6: Diğer iki selftest'in bozulmadığını doğrula**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest
```

Beklenen: iki kez `SELFTEST PASS`. `sync` fixture'larındaki agent adları (`architect`, `developer`) slug kuralına uyuyor; kırmızı gelirse yeni ad kuralı var olan bir fixture'ı bozmuş demektir — **fixture'ı düzelt, kuralı gevşetme**.

- [ ] **Step 7: Şemayı belgele**

`team-builder-shared/manifest-schema.md` — önce **bayat ana satırı** düzelt. Şu satırı:

```markdown
| `constitution` | `object` | Hayır | 4 cross-cutting anayasa presetinin aç/kapat durumu. Tümü default `true`. Bkz. `constitution.md`. |
```

şununla değiştir:

```markdown
| `constitution` | `object` | Hayır | 5 cross-cutting anayasa presetinin aç/kapat durumu. İlk dördü default `true`, `planGate` default `false`. Bkz. `constitution.md`. |
```

Sonra kök alanlar tablosuna, `constitution` satırlarından sonra ekle:

```markdown
| `constitution.planGate` | `boolean` | Hayır | Plan kapısı açık mı. **Default `false`** — diğer dört presetin aksine kapalı gelir, çünkü artefakt üretir (`.agent-work/`, `work-plan` skill'i). Açıksa kök `planGate` nesnesi zorunludur. Bkz. `plan-gate.md`. |
| `planGate` | `object` | Koşullu | Kapı sahipleri. **Yalnız `constitution.planGate: true` iken bulunur**; kapalıyken varlığı manifest'i geçersiz kılar. |
| `planGate.planReviewer` | `string \| null` | Evet (nesne varsa) | Planı denetleyen agent'ın adı, ya da `null` (kapı 1 atlanır). Kod yazmayan bir agent olmalı. |
| `planGate.codeReviewer` | `string \| null` | Evet (nesne varsa) | Biten işin kodunu denetleyen agent'ın adı, ya da `null` (kapı 3 yoktur). Kod yazmayan bir agent olmalı. |
```

Aynı dosyadaki `agents[].name` satırının açıklamasını şununla değiştir:

```markdown
| `name` | `string` | Evet | Agent adı. **Portatif slug olmalı:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Adlar generated dosya yollarına doğrudan gömüldüğü için eğik çizgi, ters bölü, boşluk ve kontrol karakteri yasaktır. Tekillik **büyük/küçük harf duyarsız** karşılaştırılır (`Dev` ve `dev` çakışır). |
```

Doğrulama kuralları listesine (`- constitution alanları ... boolean olmalı.` satırının yanına) ekle:

```markdown
- `agents[].name` portatif slug olmalı ve büyük/küçük harf duyarsız biçimde benzersiz olmalı.
- `constitution.planGate: true` ise kök `planGate` nesnesi zorunlu, `planReviewer` ve
  `codeReviewer` anahtarlarının ikisi de bulunmalı, değerleri agent adı ya da `null` olmalı.
- Kapı sahipleri kod yazmayan agent olmalı (`writesCode: false`).
- Kapı sahibinin etkin hedefleri, uygun executor'ların (routing'de geçen + kod yazan)
  etkin hedeflerinin birleşimini kapsamalı.
- `planGate` açıkken hedeflenen her ekosistemde en az bir uygun executor bulunmalı.
```

- [ ] **Step 8: Commit**

```bash
git add team-builder-shared/validate-manifest.mjs team-builder-shared/manifest-schema.md
git commit -m "feat: validate plan gate manifest invariants and agent name safety"
```

---

### Task 2: Sync davranışının kanıtı (S1, S2)

Generator'a **hiçbir yetenek eklenmez.** `.agent-source/skills/` altındaki her şey zaten ekosistem skill dizinlerine mirror'lanıyor (`sync-agent-config.mjs:465-476`) ve `.agent-work/` kaynak ağacın dışında olduğu için sync onu hiç görmüyor. Bu task o iki davranışı **kilitler**: birileri skill mirror'ına ad bazlı bir istisna koyarsa ya da silme davranışı geri gelirse selftest kırmızıya döner.

**Files:**
- Modify: `team-builder-shared/sync-agent-config.mjs` (yalnız selftest bölümü)
- Modify: `team-builder-shared/canonical-source.md`
- Modify: `team-builder-shared/sync-pipeline.md`

**Interfaces:**
- Consumes: yok
- Produces: yok (davranış kanıtı)

- [ ] **Step 1: S1 ve S2 vakalarını yaz**

`team-builder-shared/sync-agent-config.mjs`, `runSelftest()` içinde `demo-skill` dizinini oluşturan satırın yanına `work-plan` dizinini de ekle:

```javascript
  await fs.mkdir(path.join(sourceRoot, 'skills', 'demo-skill'), { recursive: true })
  await fs.mkdir(path.join(sourceRoot, 'skills', 'work-plan'), { recursive: true })
```

`demo-skill/SKILL.md` yazan satırın yanına ekle:

```javascript
  await fs.writeFile(
    path.join(sourceRoot, 'skills', 'work-plan', 'SKILL.md'),
    '---\nname: work-plan\ndescription: Plan kapisi proseduru.\n---\n\n# work-plan\n'
  )
```

**`expectedLedger`'i güncelle.** Ledger birebir (`JSON.stringify` eşitliği) karşılaştırılıyor;
üç yeni mirror eklenmezse Task 2 **kendi selftest'ini ilk çalıştırmada patlatır.** Sıralı
listeye üç satır ekle:

```javascript
  const expectedLedger = [
    '.agents/skills/demo-skill/SKILL.md',
    '.agents/skills/work-plan/SKILL.md',
    '.claude/agents/architect.md',
    '.claude/agents/developer.md',
    '.claude/skills/demo-skill/SKILL.md',
    '.claude/skills/work-plan/SKILL.md',
    '.codex/agent-definitions/architect.md',
    '.codex/agents/architect.toml',
    '.codex/config.toml',
    '.codex/team.md',
    '.opencode/agents/architect.md',
    '.opencode/skills/demo-skill/SKILL.md',
    '.opencode/skills/work-plan/SKILL.md',
    '.opencode/team.md',
    'AGENTS.md',
    'CLAUDE.md',
    'opencode.json',
  ]
```

**S1'i doğru yaşam evresine koy.** Selftest'in sonunda manifest kırpılıyor ve OpenCode
artık hedeflenmiyor; sync hiçbir şeyi silmediği için `.opencode/skills/work-plan/SKILL.md`
o noktada **bayat** olarak durur ve varlık kontrolü yanlış sebeple geçer. Var olan
skill-mirror bloğu bu yüzden zaten kırpmadan önce duruyor (`sync-agent-config.mjs` içinde
"before the manifest trim below, while opencode is still an active target" yorumlu blok).
S1'i **o bloğun hemen yanına** ekle:

```javascript
  // S1 — the work-plan skill source mirrors into every ecosystem skill dir.
  // The mirror is name-agnostic; this case exists so a name-based exception
  // cannot be added without turning the selftest red. Content is compared, not
  // just existence: sync never deletes, so a stale file would pass a bare
  // existence check.
  const workPlanSource = await read('.agent-source/skills/work-plan/SKILL.md')
  for (const mirror of ['.claude/skills', '.agents/skills', '.opencode/skills']) {
    const rel = `${mirror}/work-plan/SKILL.md`
    assert(await exists(rel), `S1: work-plan skill must mirror into ${mirror}`)
    assert(
      (await read(rel)) === workPlanSource,
      `S1: ${rel} must match the canonical source byte for byte`
    )
  }
```

**S2'yi selftest'in sonuna ekle** (fixture temizliğinden önce). Buradaki geç konum
sorun değil: `.agent-work/` hiçbir evrede üretilmiyor, dolayısıyla bayatlayacak bir çıktı
da yok.

```javascript
  // S2 — .agent-work/ is the agents' workspace, not generated output. Sync
  // must leave it alone: no production, no deletion, no rewriting, no ledger
  // ownership, and no drift.
  const workDir = path.join(fixtureRoot, '.agent-work', 'draft')
  const workFile = path.join(workDir, '20260808-01-ornek.md')
  const workBody = '---\nid: 20260808-01\n---\n\n<!-- s:progress -->\n'
  await fs.mkdir(workDir, { recursive: true })
  await fs.writeFile(workFile, workBody)

  await silentGenerate({ root: fixtureRoot })

  assert(
    (await fs.readFile(workFile, 'utf8')) === workBody,
    'S2: sync must leave files under .agent-work/ byte-identical'
  )

  // Reset first: the earlier drift tests already set exitCode to 1, so
  // asserting it below without resetting would pass vacuously.
  process.exitCode = 0
  const s2Check = await silentGenerate({ root: fixtureRoot, checkOnly: true })
  assert(s2Check.ok === true, 'S2: .agent-work/ content must not produce drift')
  assert(
    process.exitCode === 0,
    'S2: a clean --check must not set a failure exit code'
  )

  const s2Ledger = await read(LEDGER_RELATIVE)
  assert(
    !s2Ledger.includes('.agent-work'),
    'S2: the ledger must not claim ownership of .agent-work/'
  )
```

> **`read` ve `exists` yardımcıları** selftest'in kendi kapsamında tanımlı ve fixture
> köküne göre göreli yol alıyor; S1 onları kullanır. S2 fixture kökünün dışındaki
> `LEDGER_RELATIVE` sabitini kullandığı için `read` ile birlikte çalışır — ikisi de aynı
> köke göredir.

- [ ] **Step 2: Selftest'i çalıştır**

```bash
node team-builder-shared/sync-agent-config.mjs --selftest
```

Beklenen: `SELFTEST PASS`. **Kırmızı gelirse durup nedenini oku** — S1 kırmızıysa mirror ad bazlı filtreleniyor demektir, S2 kırmızıysa sync `.agent-work/`'e dokunuyor demektir. İkisi de bu planın "generator değişmez" varsayımını çürütür; düzeltme generator'da yapılır ve commit mesajında belirtilir.

- [ ] **Step 3: `.agent-work/` notunu belgele**

`team-builder-shared/canonical-source.md` — generated olmayan alanları anlatan bölüme ekle:

```markdown
- **`.agent-work/` generated değildir.** Plan kapısı açık projelerde agent'ların çalışma
  alanıdır: planlar, ham kayıtlar, ilerleme notları. Setup boş iskeleti bir kez kurar;
  ondan sonrasını `work-plan` skill'i yönetir. `sync` onu üretmez, silmez, drift
  kontrolüne sokmaz ve generated-file ledger'ı sahiplenmez — `.agent-memory/` ile aynı
  statüde.
```

`team-builder-shared/sync-pipeline.md` — pipeline'ın dokunmadığı yolları sayan bölüme ekle:

```markdown
`.agent-work/` pipeline'ın **tamamen dışındadır**. Kaynak ağacında (`.agent-source/`)
karşılığı yoktur, bu yüzden hiçbir aşamada okunmaz ya da yazılmaz. Selftest S2 bunu
kanıtlar: dizine konan bir dosya generate sonrası yerinde durur, `--check` temiz kalır ve
ledger'da görünmez.
```

- [ ] **Step 4: Commit**

```bash
git add team-builder-shared/sync-agent-config.mjs team-builder-shared/canonical-source.md team-builder-shared/sync-pipeline.md
git commit -m "test: lock in skill mirroring and .agent-work isolation"
```

---

### Task 3: Anayasa KARAR 5 ve sihirbaz durumu (W6)

Plan kapısını beşinci anayasa preseti olarak tanımlar. **Diğer dördünden farkı: default KAPALI.** `constitution.md` bugün "Dördü de DEFAULT AÇIK" diyor ve `default` değerin "her zaman `true`" olduğunu yazıyor; ikisi de düzeltilir.

**Files:**
- Modify: `team-builder-shared/constitution.md`
- Modify: `team-builder-shared/wizard-state.md`

**Interfaces:**
- Consumes: Task 1'in `constitution.planGate` ve kök `planGate` şeması
- Produces: KARAR 5 metni ve `answers.planGate` durum alanı — Task 4'teki sihirbaz bunlara dayanır

- [ ] **Step 1: "Dördü de default açık" ifadesini düzelt**

`team-builder-shared/constitution.md`, "## Amaç" bölümünde şu paragrafı:

```markdown
Anayasa, projedeki tüm rolleri kesen (cross-cutting) numaralı kararlardır: tek tek
agent'lara değil, takımın tamamına uygulanan disiplinler.
**Dördü de DEFAULT AÇIK** gelir; sihirbaz her birini gösterir ve kullanıcı kapatabilir
(toggle). Bazı satırlar projeye özeldir → kullanıcıya sorulur.
```

şununla değiştir:

```markdown
Anayasa, projedeki tüm rolleri kesen (cross-cutting) numaralı kararlardır: tek tek
agent'lara değil, takımın tamamına uygulanan disiplinler.
**İlk dördü DEFAULT AÇIK** gelir; sihirbaz her birini gösterir ve kullanıcı kapatabilir
(toggle). **KARAR 5 (plan kapısı) DEFAULT KAPALIDIR** — diğerleri yalnız agent
talimatlarına metin gömerken o, projede dosya ve dizin üretir (`.agent-work/` iskeleti ve
`work-plan` skill'i); açılması bilinçli bir tercih olmalıdır. Bazı satırlar projeye
özeldir → kullanıcıya sorulur.
```

Aynı bölümdeki JSON örneğini ve onu izleyen paragrafı şununla değiştir:

```jsonc
"constitution": { "noWorkaround": true, "codeDocSync": true, "perAgentMemory": true, "languageStandard": true, "planGate": false }
```

```markdown
Açık olan her preset, ilgili agent md gövdelerine (`agent-md-rich.md` kalıbı) ve
CLAUDE.md/AGENTS.md'ye gömülür. İlk dördünün `default` değeri `true`, KARAR 5'inki
`false`'tur; kullanıcı toggle ile değiştirirse o preset ona göre yansır.
```

- [ ] **Step 2: Sunum kuralları tablosuna beşinci satırı ekle**

`team-builder-shared/constitution.md`, "SUNUM KURALLARI" bölümündeki sade açıklama tablosuna ekle:

```markdown
   | Plan kapısı | "Kod yazılmadan önce plan yazılır, denetlenir ve **sen onaylarsın**. Onaylı işler bir havuzda birikir, sırasını sen seçersin. (Varsayılan: kapalı.)" |
```

Aynı bölümdeki 4. maddeyi şununla değiştir:

```markdown
4. **İlk dördü default açık, KARAR 5 default kapalı**; kullanıcı her birini değiştirebilir.
   Açık kalanlar için projeye özel satırları sor (sadece açık olanlar için; aşağıya bak).
5. **KARAR 5 ayrı sorulur.** Dört toggle'ı tek ekranda göstermek 4-seçenek sınırını
   doldurur; plan kapısı kendi sorusunda, kendi gerekçesiyle sunulur.
```

- [ ] **Step 3: KARAR 5'i yaz**

`team-builder-shared/constitution.md`, "## KARAR 4" bölümünün sonuna (bir sonraki `---` ayıracından önce) ekle:

```markdown
## KARAR 5 — Plan kapısı  (`planGate`) · DEFAULT KAPALI

**Ne:** Kod yazılmadan önce iş için plan yazılır, denetlenir ve **kullanıcı onaylar**.
Onaylanan işler bir havuzda birikir; hangisinin ne zaman yapılacağını kullanıcı seçer.
Üç kapı vardır: kapı 1 plan denetimi (`planReviewer`), kapı 2 kullanıcı onayı (her zaman
vardır, atlanamaz), kapı 3 kod denetimi (`codeReviewer`).

**Neden default kapalı:** diğer dört preset yalnız metin gömer; bu preset projede dosya
üretir — `.agent-work/` iskeleti ve projeye kurulan `work-plan` skill'i. Küçük ya da
tek kişilik projelerde bu ek yük istenmeyebilir.

**Agent'lara yansıması:**
- **her agent md'sine** kısa bir "Plan Kapısı" bölümü eklenir: onaysız kod yazılmaz,
  planlar `.agent-work/` altında durur, prosedürün tamamı `work-plan` skill'indedir.
- **`planReviewer`:** planı denetler, sonucu döndürür — dosyayı **kendisi değiştirmez**.
- **`codeReviewer`:** `planGate` açıkken evrensel kod review kapısının **tek otoritesidir**
  (bkz. `routing.md` ve `governance-defaults.md`). `null` ise projede kod review kapısı
  yoktur ve o kural hiç yazılmaz.

**PROJEYE ÖZEL → kullanıcıya sorulur:** iki kapı sahibi. Her ikisi de **kod yazmayan** bir
agent olmalı ya da `null` bırakılmalı. Sorular sade dille sorulur, alan adı gösterilmez:

> "Planı senden önce kim gözden geçirsin? (Kod yazmayan rollerden seç, ya da 'kimse' de —
> o zaman plan doğrudan sana gelir.)"
>
> "İş bitince kodu kim denetlesin? (Kod yazmayan rollerden seç, ya da 'kimse' de — o zaman
> kod review kapısı olmaz.)"

Sonuçlar `manifest.planGate.planReviewer` ve `manifest.planGate.codeReviewer` alanlarına
yazılır. Kapı kapalıysa kök `planGate` nesnesi **hiç yazılmaz**.

Kurulum sözleşmesinin tamamı: `plan-gate.md`. Çalışma zamanı prosedürü **burada değil**,
projeye kurulan `work-plan` skill'indedir.
```

- [ ] **Step 4: Sihirbaz akışı özetini güncelle**

`team-builder-shared/constitution.md`, en alttaki "## Sihirbaz akışı (özet)" bölümünde 1. ve 2. maddeleri şununla değiştir:

```markdown
1. **İlk dört kuralı** default açık ve **sade dille** (SUNUM KURALLARI tablosu) göster;
   kullanıcı her birini toggle edebilir. Seçilmemiş role atıf yapma.
1b. **KARAR 5'i ayrı sor**, default kapalı. Açarsa iki kapı sahibi sorusunu sor
   (KARAR 5'teki kalıpla); kapalı bırakırsa hiçbir şey sorma ve kök `planGate` nesnesini
   yazma.
2. Açık her preset için **projeye özel satırları** sor:
   - KARAR 1 → workaround pattern listesi
   - KARAR 2 → kod-doc sync tablosu
   - KARAR 4 → yorum standardı detayları (dil `docLanguage`'den gelir)
   - KARAR 3 → ek satır gerektirmez
   - KARAR 5 → iki kapı sahibi (yukarıda)
```

- [ ] **Step 5: Sihirbaz durumuna `planGate` ekle**

`team-builder-shared/wizard-state.md`, şema örneğindeki `"constitution"` **satırını** şu iki
satırla **değiştir** — araya ekleme, yoksa `constitution` anahtarı iki kez yazılır:

```jsonc
    "constitution": { "noWorkaround": true, "codeDocSync": true, "perAgentMemory": true, "languageStandard": true, "planGate": false },
    "planGate": { "planReviewer": "architect", "codeReviewer": null },  // yalnız constitution.planGate açıksa
```

Aynı dosyanın "## Notlar" bölümüne ekle:

```markdown
- **İki kapı sahibi sorusu ayrı ayrı kaydedilir.** Kullanıcı plan kapısını açıp ilk soruyu
  cevapladıktan sonra oturum kesilirse, resume'da o cevap **yeniden sorulmaz**: state'te
  `answers.planGate.planReviewer` doludur, `codeReviewer` anahtarı henüz yoktur. Devam
  ederken yalnız eksik anahtarı sor. `constitution.planGate` kapalıysa `answers.planGate`
  hiç yazılmaz.
```

- [ ] **Step 6: Commit**

```bash
git add team-builder-shared/constitution.md team-builder-shared/wizard-state.md
git commit -m "feat: add the plan gate constitution preset and its wizard state"
```

---

### Task 4: Sihirbaz akışı (W1, W2, W3, W4)

Sihirbazın soru ve üretim adımlarını bağlar.

**Files:**
- Modify: `team-builder-setup/SKILL.md`

**Interfaces:**
- Consumes: Task 1'in `validate()` kuralları, Task 3'ün KARAR 5 metni ve `answers.planGate`
- Produces: Adım 8a üretim listesi — Task 5'in prose koşulları buna eklenir

- [ ] **Step 1: Adım 7B'ye beşinci preseti ekle**

`team-builder-setup/SKILL.md`, Adım 7B'nin başındaki paragrafı şununla değiştir:

```markdown
**7B) Anayasa presetleri (sade dille sor)** — `~/.claude/skills/team-builder-shared/constitution.md` kurallarını kullan. **İlk dört kuralı** default AÇIK olarak, **sade ve günlük dille** sun; kullanıcı kapatmak istediğini seçer. **Henüz var olmayan role atıf yapma** — açıklamayı Adım 5'te seçilen takıma göre uyarla (örn. reviewer eklenmediyse "otomatik denetleyen reviewer yok, kural yine de agent talimatlarına yazılır" de).
```

Aynı adımda, 4 numaralı sade açıklamadan sonra ve "Açık kalan her kural için..." satırından önce ekle:

```markdown
**7C) Plan kapısı (ayrı soru, default KAPALI)** — `constitution.md` KARAR 5.

Bu preset dördüyle birlikte gösterilmez: kendi sorusu vardır ve **kapalı** gelir.

> "Kod yazılmadan önce iş için plan yazılsın, denetlensin ve **sen onaylayasın** mı?
> Onaylanan işler bir havuzda birikir; sırasını sen seçersin. Bu, projede bir çalışma
> alanı dizini (`.agent-work/`) ve bir skill üretir. **Varsayılan: kapalı.**"

**Kapalı bırakırsa:** `manifest.constitution.planGate: false` yaz, kök `planGate` nesnesini
**yazma**, başka soru sorma. Adım 8a'da plan kapısı çıktılarının hiçbiri üretilmez.

**Açarsa** iki kapı sahibini sor. Her soruda **yalnız kod yazmayan rolleri** (Adım 5'te
`writesCode: false` seçilenler) ve "kimse" seçeneğini sun. Kod yazmayan hiç rol yoksa
ikisini de "kimse" olarak geç ve kullanıcıya söyle.

1. > "Planı senden önce kim gözden geçirsin? (Kimse dersen plan doğrudan sana gelir.)"
   → `manifest.planGate.planReviewer` (ad ya da `null`)
2. > "İş bitince kodu kim denetlesin? (Kimse dersen kod review kapısı olmaz.)"
   → `manifest.planGate.codeReviewer` (ad ya da `null`)

**Her cevaptan sonra state'i yaz** (`answers.planGate` altına tek tek) — kullanıcı iki
sorunun ortasında çıkarsa resume'da cevapladığı soru yeniden sorulmaz.

**Erişilebilirlik kontrolü.** Seçilen kapı sahibi, kod yazan ve routing'de geçen tüm
rollerin hedeflediği **her** ekosistemde üretiliyor olmalı. Değilse kullanıcıya sade dille
söyle ("Bu rol yalnız Claude'da üretiliyor ama işleri yapacak roller Codex'te de var —
denetleyiciyi oraya da eklememiz gerekiyor") ve ya rolün hedeflerini genişlet ya da başka
bir sahip seçtir. Bu kural Adım 8b'de `validate()` tarafından da denetlenir; **kullanıcıyı
doğrulama hatasıyla karşılaştırmadan burada çöz.**
```

- [ ] **Step 2: Adım 7B'nin sonuç satırını güncelle**

Adım 7B'nin sonundaki satırı:

```markdown
Sonuçları `manifest.constitution` (+ varsa `codeDocSync[]`) alanlarına yaz.
```

şununla değiştir:

```markdown
Sonuçları `manifest.constitution` (+ varsa `codeDocSync[]`, + plan kapısı açıksa kök
`planGate` nesnesi) alanlarına yaz. Kapı kapalıysa kök `planGate` **yazılmaz** — varlığı
manifest'i geçersiz kılar.
```

- [ ] **Step 3: Adım 6'ya `codeReviewer` kuralını ekle**

`team-builder-setup/SKILL.md`, Adım 6'nın sonundaki alıntı satırından sonra ekle:

```markdown
> **Kod review kapısını kim tanımlar.** Plan kapısı **kapalıysa** bugünkü davranış aynen
> korunur: sabit `reviewer` adıyla evrensel bir review gate kuralı yazılır. Plan kapısı
> **açıksa** tek otorite `planGate.codeReviewer`'dır: bir ad verildiyse kural o adla
> yazılır, `null` ise **evrensel kod review kuralı hiç yazılmaz** (projede kod review
> kapısı yoktur). Bu kural hem routing metnine hem governance metnine aynı kaynaktan
> uygulanır; ikisinin farklı ad kullanması drift'tir.
```

- [ ] **Step 4: Adım 8a'ya plan kapısı üretimini ekle**

`team-builder-setup/SKILL.md`, Adım 8a'daki `.agent-source/README.md` maddesinden sonra ekle:

```markdown
- **Plan kapısı açıksa** (`constitution.planGate: true`) şunları da üret — hepsi
  `docLanguage` dilinde, `~/.claude/skills/team-builder-shared/plan-gate.md` sözleşmesine
  göre:
  - `.agent-work/` iskeleti: `inbox/ draft/ approved/ in-progress/ done/` boş dizinleri.
    **Bu dizin generated değildir** — bir kez kurulur, sonra `work-plan` skill'i yönetir;
    `sync` ona dokunmaz.
  - `.agent-work/TEMPLATE.md` ← `~/.claude/skills/team-builder-shared/templates/plan.md`.
    Şablon Türkçe referanstır; **verbatim kopyalama**, `docLanguage` dilinde yeniden yaz.
    Beş `<!-- s:* -->` işareti ve `<!-- progress:not-started -->` sentinel'i **birebir
    korunur** (çeviriden bağımsızdırlar).
  - `.agent-work/README.md`: dizinin ne olduğunu ve beş klasörün ne anlama geldiğini
    anlatan kısa metin.
  - `.agent-source/skills/work-plan/SKILL.md` ←
    `~/.claude/skills/team-builder-shared/templates/work-plan-skill.md`. Aynı kural:
    `docLanguage` dilinde yeniden yaz, makine işaretlerini birebir koru. Bu dosya
    `sync` tarafından ekosistem skill dizinlerine mirror'lanır.
- **Plan kapısı kapalıysa** yukarıdakilerin **hiçbiri** üretilmez: `.agent-work/` yoktur,
  `work-plan` skill kaynağı yazılmaz, dolayısıyla mirror da oluşmaz.
```

- [ ] **Step 5: Adım 8b doğrulama listesine ekle**

`team-builder-setup/SKILL.md`, Adım 8'de manifest doğrulamasını anlatan satırdaki parantez içi listeye şunu ekle (`constitution alanları boolean` ifadesinden sonra):

```markdown
; agent adları portatif slug ve büyük/küçük harf duyarsız benzersiz; `constitution.planGate: true` ise kök `planGate` nesnesi var ve `planReviewer`/`codeReviewer` anahtarlarının ikisi de bulunuyor, değerleri kod yazmayan bir agent adı ya da `null`; kapalıysa kök `planGate` yok
```

- [ ] **Step 6: Adım 9 özetine ekle**

`team-builder-setup/SKILL.md`, Adım 9'da kullanıcıya gösterilen özete plan kapısı satırını ekle:

```markdown
- **Plan kapısı açıksa** özete bir satır ekle ve **sade dille** anlat: "Bundan sonra bir iş
  yaptırmadan önce plan yazılacak, [denetleyici varsa: <ad> gözden geçirecek,] sen
  onaylayacaksın. Onaylı işler `.agent-work/approved/` altında birikir; 'havuzda ne var'
  diye sorabilirsin." Kapalıysa bu satırı **hiç yazma** — var olmayan bir akışa atıf yapma.
```

- [ ] **Step 7: Adım tablosunu güncelle**

`team-builder-setup/SKILL.md`'nin en altındaki adım özet tablosunda 7. satırı şununla değiştir:

```markdown
| 7 | Kalite odakları (checkbox) + Anayasa presetleri + Plan kapısı (ayrı soru) | `quality-dimensions.md`, `constitution.md`, `plan-gate.md` |
```

- [ ] **Step 8: Bayat "4 preset" ifadelerini düzelt ve referansları ekle**

`team-builder-setup/SKILL.md`, soru-sorma tekniğini anlatan şu satırı:

```markdown
- **Anayasa presetleri tam 4 kural** → tek `multiSelect` soru (4 seçenek) uygundur; ya da tek tek aç/kapa sor.
```

şununla değiştir:

```markdown
- **Anayasa presetleri 5 kural, ama tek soruda sorulmaz.** İlk dördü (hepsi default açık) tek `multiSelect` soruya sığar (4 seçenek); **plan kapısı ayrı sorulur** — default kapalıdır ve açılırsa iki alt soru daha getirir.
```

Aynı dosyanın başındaki paylaşılan referans listesinde `constitution.md` satırının açıklamasını `4 cross-cutting anayasa preseti` yerine `5 cross-cutting anayasa preseti (ilk dördü default açık, plan kapısı default kapalı)` yap ve altına ekle:

```markdown
- `~/.claude/skills/team-builder-shared/plan-gate.md` — plan kapısı kurulum sözleşmesi (KARAR 5 açıksa).
- `~/.claude/skills/team-builder-shared/templates/plan.md` — plan dosyası şablonu.
- `~/.claude/skills/team-builder-shared/templates/work-plan-skill.md` — projeye kurulacak `work-plan` skill'inin şablonu.
```

- [ ] **Step 9: Commit**

```bash
git add team-builder-setup/SKILL.md
git commit -m "feat: wire the plan gate into the setup wizard"
```

---

### Task 5: Architect'siz takım ve `codeReviewer` prose'u (W3, W4, W5)

Spec'in en dağınık gereksinimi: `docs/` yasağı **üç prose kaynağında** tanımlı ve üçü birlikte koşullanmazsa architect olmayan takımda `docs/` sahipsiz kalırken developer'a hâlâ "orası architect'in, yazma" denir. Spec tam listeyi veriyor (`Architect'siz takımda docs/ sahipliği` bölümü); bu task o listeyi uygular.

**Files:**
- Modify: `team-builder-shared/routing.md`
- Modify: `team-builder-shared/governance-defaults.md`
- Modify: `team-builder-shared/agent-md-rich.md`
- Modify: `team-builder-setup/SKILL.md`

**Interfaces:**
- Consumes: Task 4'ün Adım 6/7C metni
- Produces: koşullu prose kuralları — Task 6'daki README bunlara atıf yapmaz, bağımsızdır

> **Task 4'ten SONRA çalıştır.** İkisi de `team-builder-setup/SKILL.md`'nin Adım 6'sına
> dokunuyor: Task 4 routing temel kuralı alıntısının **arkasına** yeni bir alıntı ekler,
> Task 5 o alıntının **kendisini** değiştirir. Task 4 önce giderse Task 5'in anchor'ı
> yerinde durur. Ters sırada Adım 6'nın sonunda iki alıntı olur ve hangisinin
> değiştirileceği belirsizleşir — bu durumda **`Routing temel kuralı:` ile başlayan**
> olanı değiştir, `Kod review kapısını kim tanımlar` ile başlayana dokunma.

- [ ] **Step 1: `routing.md`'yi koşullandır**

`team-builder-shared/routing.md`, `docs/** → architect` maddesini şununla değiştir:

```markdown
- **`docs/**` → architect — yalnız takımda architect varsa.** Architect varsa tüm `docs/`
  dizininin sahibidir; dokümantasyon (ADR, kısıt, tasarım, README) yalnız onun tarafından
  yazılır ve bu satır routing tablosuna eklenir (alt klasör — `docs/architecture/adr` vb. —
  tek tek yazılmaz; `docs/**` yeter).
  **Architect yoksa bu satır üretilmez.** O zaman `docs/` özel sahipliği olmayan sıradan
  bir dizindir ve kod yolu sahipliği kuralları neyse o geçerlidir.
```

Aynı dosyadaki "Şüphede kalınırsa architect'e danışılır" maddesini şununla değiştir:

```markdown
- **Şüphede kalınırsa architect'e danışılır.** Yol bir role net eşleşmiyorsa, ya da
  mimari karar / breaking change / standart belirsizliği varsa önce architect.
  **Architect yoksa danışma hedefi kullanıcıdır** — zincirin ucu boşta kalmaz, belirsizlik
  kullanıcıya taşınır.
```

Aynı dosyadaki "Reviewer gate" maddesini şununla değiştir:

```markdown
- **Kod review kapısı.** Plan kapısı kapalıysa: her kod değişikliği tamamlandıktan sonra
  `reviewer` çağrılır (review olmadan iş "tamam" sayılmaz). Plan kapısı açıksa tek otorite
  `planGate.codeReviewer`'dır — bir ad verildiyse kural o adla yazılır, `null` ise
  **bu madde hiç yazılmaz** ve projede kod review kapısı yoktur.
```

Aynı dosyadaki "No-workaround → architect" maddesini şununla değiştir:

```markdown
- **No-workaround → architect:** belirsizlikte kestirme yol aranmaz; architect'e
  gidilir (bkz. `constitution.md` KARAR 1). **Architect yoksa kullanıcıya sorulur.**
```

Ve tablodaki iki satırı şununla değiştir:

```markdown
| Mimari karar / ADR / breaking change / standart belirsizliği | (yol değil, iş türü) | architect — yoksa kullanıcı |
| Kod değişikliği tamamlandı, review gerekiyor | (yol değil, kapı) | `reviewer` ya da `planGate.codeReviewer`; kapı sahibi yoksa satır yazılmaz |
```

**"Her zaman korunur" iddialarını da düzelt** — bu satırlar `codeReviewer: null` ve
architect'siz takımla çelişiyor. Tablodan sonraki cümleyi:

```markdown
Son iki satır **yola değil iş türüne** bağlıdır; bunlar generic danışma/gate
kurallarıdır ve her projede korunur (aşağıya bakın).
```

şununla değiştir:

```markdown
Son iki satır **yola değil iş türüne** bağlıdır. İkisi de **koşulludur**: danışma satırı
architect yoksa kullanıcıya döner, gate satırı kapı sahibi yoksa hiç yazılmaz (aşağıya
bakın).
```

Ve "Routing satırları PROJEYE ÖZELDİR" bölümünün giriş cümlesini:

```markdown
Yol→rol tablosunun **yanında**, projeden bağımsız sabit kurallar her zaman korunur:
```

şununla değiştir:

```markdown
Yol→rol tablosunun **yanında** projeden bağımsız kurallar durur. Bunlar sabit değil
**koşulludur**: hedefi olmayan bir kural (architect'siz danışma, sahipsiz kod review
kapısı) yazılmaz — var olmayan bir role işaret eden bir kural, kuralsızlıktan kötüdür.
```

Ayrıca `.agent-work/` sahipliğini belgele. `routing.md`'ye yol→rol tablosunun altına ekle:

```markdown
- **`.agent-work/**` → `work-plan` akışı.** Plan kapısı açıksa bu dizin agent'ların çalışma
  alanıdır: planlar, ham kayıtlar, ilerleme notları. Buraya **yalnız `work-plan` skill'ini
  çalıştıran agent** yazar — denetleyiciler dahil kimse doğrudan dosya değiştirmez, sonuç
  döndürür. Routing tablosunun geri kalanı kod yollarını yönetir; bu satır iş akışı
  durumunu. Plan kapısı kapalıysa dizin yoktur ve satır yazılmaz.
```

- [ ] **Step 2: `governance-defaults.md`'yi koşullandır**

`team-builder-shared/governance-defaults.md`, developer bölümündeki üç satırı şununla değiştir:

```markdown
- `consults`: **[architect]** — architect takımda **yoksa boş `[]`**.
- Kurallar:
  - Architect **varsa**: "Sadece kendi domain'inde (`<paths>`) kod yaz. `docs/<arch-root>/` altına yazma; gerekiyorsa architect'e işaret et."
    Architect **yoksa** bu cümle **yazılmaz** — `docs/` özel sahipliği olmayan sıradan bir dizindir.
  - "Mimari etkili kararda (yeni bağımlılık, modül sınırı, yeni IPC/public API yüzeyi, şema/breaking change, güvenlik etkisi) implementasyonu durdurup **architect'e danış**." Architect **yoksa** danışma hedefi **kullanıcıdır**: "…implementasyonu durdurup kullanıcıya sor."
```

Aynı dosyada reviewer bölümündeki `consults` satırını şununla değiştir:

```markdown
- `consults`: [] (gate'tir; gerekirse architect'e eskale eder — architect **yoksa**
  eskalasyon hedefi **kullanıcıdır**).
```

Aynı dosyada reviewer bölümüne, `consults` satırından sonra ekle:

```markdown
- **Plan kapısı açıksa:** evrensel kod review kuralının tek otoritesi `planGate.codeReviewer`'dır.
  O alan bir ad taşıyorsa kural o adla yazılır (bu rol o ad olmayabilir); `null` ise
  **evrensel kod review kuralı hiç yazılmaz**. Plan kapısı kapalıysa bugünkü sabit
  `reviewer` gate'i aynen korunur.
```

**Koşulsuz kalan gate cümlesini de değiştir** — yoksa W4 sağlanmaz. Reviewer kurallarındaki
şu satırı:

```markdown
  - "Her çıktı review gate'inden geçer. Bulguları **Kritik / Uyarı / Öneri** olarak grupla; önce gerçek riskleri yaz."
```

şununla değiştir:

```markdown
  - Kod review kapısı **varsa** (plan kapısı kapalı, ya da `planGate.codeReviewer` bir ad taşıyor): "Her çıktı review gate'inden geçer." `planGate.codeReviewer: null` ise bu cümle **yazılmaz** — projede kod review kapısı yoktur.
  - "Bulguları **Kritik / Uyarı / Öneri** olarak grupla; önce gerçek riskleri yaz."
```

Aynı dosyada, çekirdek roster'ı tanımlayan satırı şununla değiştir:

```markdown
Önerilen çekirdek roster: **architect (lead, doc-only)** + **developer(lar, domain-split)** + **reviewer**. "Her zaman" değil **varsayılan**: kullanıcı architect'i eklemeyebilir. Eklemezse `docs/` sahipliği, danışma hedefi, developer yasakları ve `lead` seçimi koşullu olarak değişir (bu dosyada ve `routing.md` / `agent-md-rich.md`'de işaretli).
```

**Opsiyonel rollerde aynı hatanın üç kopyası var.** QA, Security Reviewer ve Doc Writer
bölümlerindeki `consults` satırlarının üçünü de şununla değiştir:

```markdown
- `consults`: [architect] — architect takımda **yoksa boş `[]`**.
```

Doc Writer'ın kural cümlesini şununla değiştir:

```markdown
- Kurallar: Architect **varsa** — "Mimari kararları architect üretir; sen kullanıcı-bakış dokümanını/README'leri yazar ve günceltirsin. ADR yazma."
  Architect **yoksa** — "Kullanıcı-bakış dokümanını ve README'leri sen yazar ve günceltirsin. Mimari karar gerekiyorsa kullanıcıya sor." (ADR yasağı kalkar: yazacak başka rol yoktur.)
```

- [ ] **Step 3: `agent-md-rich.md`'yi koşullandır**

`team-builder-shared/agent-md-rich.md`, `writesCode=true` satırını şununla değiştir:

```markdown
- `writesCode=true` → "Sadece kendi domain'imde kod yazarım." Architect **varsa** cümleye
  "`docs/` altına yazmam (orası architect'in)" eklenir; architect **yoksa** eklenmez.
```

"Yasak" maddesini şununla değiştir:

```markdown
- **Yasak:** yalnız okuduğu yollar. architect için tüm production kod yolları "sadece
  okurum". developer için diğer domainler — architect **varsa** ayrıca `docs/` (orası
  architect'in) ve `<arch-root>/`; architect **yoksa** ikisi de yasak listesinde
  **yer almaz**. reviewer için hepsi.
```

Kod-doc senkronizasyonu bölümündeki architect cümlesini şununla değiştir:

```markdown
**Kritik**. Architect **varsa** — architect: doc tarafını ben güncellerim; bir karar kod +
doc + (bağlayıcıysa) ADR birlikte yürür. developer: doküman güncellenmesi için architect'e
sevk eder. Architect **yoksa** bu iki cümle **yazılmaz**; doküman güncellemesi kod
değişikliğini yapan rolün işidir.
```

`agent-md-rich.md`'nin alanlar→prose eşleme tablosundaki iki satırı şununla değiştir:

```markdown
| `writesCode: true` | Çalışma klasörü = kendi domain kod yolları; Yasak = diğer domain — architect **varsa** ayrıca `<arch-root>/`, **yoksa** yalnız diğer domainler. |
| `consults: [architect]` | `## Routing & Danışma`'da "mimari belirsizlikte architect'e sevk". Liste **boşsa** (architect yoksa) "mimari belirsizlikte **kullanıcıya sor**". |
```

Ayrıca `agent-md-rich.md`'nin sonuna, bölüm listesinin sonuna ekle:

```markdown
## Plan Kapısı (yalnız `constitution.planGate: true` ise)

Kapı açıksa **her** agent md'sine kısa bir bölüm eklenir. Önce **her role yazılan temel
cümle**, sonra varsa role özel ek:

**Temel (istisnasız her agent):** "Bu projede plan kapısı açık: işler `.agent-work/`
altındaki plan dosyalarıyla yürür ve prosedürün tek otoritesi `work-plan` skill'idir.
`.agent-work/` altına doğrudan yazma — o akış senin adına kaydı tutar."

Üstüne, role göre **ek cümle**:

- **Kod yazan roller:** "Onaylanmamış bir planın işini yapma; ne yapacağın plan dosyasında
  yazar."
- **`planReviewer` ise:** "Plan denetimi sende. Planı denetler, sonucunu döndürürsün."
- **`codeReviewer` ise:** "Biten işin kod denetimi sende. Sonucunu döndürürsün."
- **Hiçbiri değilse** (kapı sahibi olmayan, kod da yazmayan bir rol — örn. doc-writer):
  ek cümle **yok**, yalnız temel cümle yazılır.

Bir agent **iki kapıya birden** sahipse (aynı ad hem `planReviewer` hem `codeReviewer`)
**iki ek cümle de** yazılır; biri diğerini elemez.

Bölüm **kısa tutulur ve prosedür tekrar edilmez** — tek otorite `work-plan` skill'idir;
aynı kuralı agent md'sinde de anlatmak drift üretir.
```

- [ ] **Step 4: `team-builder-setup/SKILL.md`'deki architect varsayımlarını koşullandır**

Adım 5'teki developer rol önerisi satırını şununla değiştir:

```markdown
   - **developer(lar)** (öneri: EKLE) — analizden önerdiğin her domain için ayrı developer (architect de önerildiyse `consults: [architect]`, önerilmediyse `consults: []`).
```

Adım 5'in sonundaki `lead` varsayılanı satırını şununla değiştir. **Bugünkü hâli
architect'siz takımda geçersiz manifest üretiyor:** doğrulayıcı `agents[]` içinde
bulunmayan bir `lead`'i reddeder, yani architect eklenmemişse üretim doğrulamada patlar.

```markdown
   `lead` varsayılanı `architect`'tir. **Architect eklenmediyse** `lead` olarak eklenen
   rollerden birini seçtir (öneri: en geniş domain'e sahip developer) ya da alanı hiç
   yazma — `lead` opsiyoneldir. Var olmayan bir adı `lead` yapma; doğrulayıcı reddeder.
```

Adım 5'teki `(e)` maddesini şununla değiştir:

```markdown
   **(e) Kod yazsın mı + kime danışır** — varsayılanı söyle, onaylat/değiştir (architect eklendiyse developer → architect'e danışır; **architect eklenmediyse `consults` boş kalır ve belirsizlikte kullanıcıya sorulur**; architect/reviewer kod yazmaz).
```

Adım 6'daki taslak öneri maddesini şununla değiştir:

```markdown
1. Proje analizine göre bir **path → rol** tablosu taslağı öner (örn. `apps/**/main/src/**` → `backend-developer`, `apps/**/renderer/src/**` → `frontend-developer`). **Architect eklendiyse** ayrıca `docs/<arch-root>/**` → `architect` satırını öner; **eklenmediyse bu satırı önerme** — `docs/` özel sahibi olmayan sıradan bir dizindir.
```

Adım 6'nın sonundaki routing temel kuralı alıntısını şununla değiştir:

```markdown
> Routing temel kuralı: **ajansız doğrudan kod yazma yasaktır; tabloyu bypass = mimari ihlal; şüphede architect'e danışılır — architect yoksa kullanıcıya sorulur.** (Generic danışma/gate kuralları her zaman korunur.)
```

Adım 7B'deki 1 numaralı sade açıklamayı şununla değiştir:

```markdown
1. **Workaround yasağı** (`noWorkaround`) — "Geçici çözüm / kestirme yasak; belirsizlikte [architect varsa: mimara] [architect yoksa: sana] sorulur.[Reviewer varsa: Riskli kestirme desenlerini otomatik 'düzeltilmeli' işaretler.]"
```

- [ ] **Step 5: Koşullandırmanın tam olduğunu doğrula**

**Grep tek başına yetmez** ve buna güvenme: koşul çoğu yerde bir sonraki satırda duruyor,
satır bazlı ters-grep onu göremez. Önce şu listeyi **elle** doğrula — her madde için
dosyayı aç, koşulun yazıldığını gözünle gör:

| # | Dosya | Koşullanması gereken |
|---|---|---|
| 1 | `routing.md` | `docs/** → architect` satırının üretim koşulu |
| 2 | `routing.md` | "Şüphede kalınırsa architect'e danışılır" → architect yoksa kullanıcı |
| 3 | `routing.md` | "Architect'e danış" genel maddesi (mimari karar / breaking change) |
| 4 | `routing.md` | "No-workaround → architect" |
| 5 | `routing.md` | Tablodaki iki iş-türü satırı |
| 6 | `routing.md` | "her projede korunur" / "her zaman korunur" iddiaları |
| 7 | `governance-defaults.md` | Çekirdek roster cümlesindeki "her zaman" |
| 8 | `governance-defaults.md` | developer `consults` + iki kural cümlesi |
| 9 | `governance-defaults.md` | reviewer `consults` (eskalasyon hedefi) |
| 10 | `governance-defaults.md` | reviewer'ın koşulsuz "Her çıktı review gate'inden geçer" cümlesi |
| 11 | `governance-defaults.md` | QA / security-reviewer / doc-writer `consults` (üç satır) |
| 12 | `governance-defaults.md` | doc-writer'ın "Mimari kararları architect üretir" kuralı |
| 13 | `agent-md-rich.md` | `writesCode=true` cümlesindeki `docs/` yasağı |
| 14 | `agent-md-rich.md` | "Yasak" maddesindeki `docs/` ve `<arch-root>/` |
| 15 | `agent-md-rich.md` | Kod-doc bölümündeki iki architect cümlesi |
| 16 | `agent-md-rich.md` | Eşleme tablosunun `writesCode: true` ve `consults` satırları |
| 17 | `team-builder-setup/SKILL.md` | developer rol önerisindeki `consults` |
| 18 | `team-builder-setup/SKILL.md` | `lead` varsayılanı |
| 19 | `team-builder-setup/SKILL.md` | `(e)` maddesindeki danışma varsayılanı |
| 20 | `team-builder-setup/SKILL.md` | Adım 6 taslak önerisindeki architect satırı |
| 21 | `team-builder-setup/SKILL.md` | Adım 6 routing temel kuralı alıntısı |
| 22 | `team-builder-setup/SKILL.md` | Adım 7B workaround açıklaması |

Listeyi bitirdikten **sonra** grep'i bir güvenlik ağı olarak çalıştır — kalan satırlar
listede olmayan bir yeri işaret ediyorsa gerçek bir kaçaktır:

```bash
grep -n "consults.*architect\|architect'e danış\|orası architect'in\|architect'e sevk\|architect'e gidilir\|architect'e işaret\|architect'e eskale\|Mimari kararları architect\|docs/\*\* → architect" team-builder-shared/routing.md team-builder-shared/governance-defaults.md team-builder-shared/agent-md-rich.md team-builder-setup/SKILL.md | grep -iv "varsa\|yoksa\|önerildiyse\|önerilmediyse\|eklendiyse\|eklenmediyse\|technical-architect"
```

(`technical-architect` dışlanıyor çünkü o, örnek manifest JSON'undaki bir agent adıdır —
koşullandırılacak bir kural değil.)

Beklenen: kalan satırların **hepsi yukarıdaki 22 maddede** olmalı ve her biri için koşul
bir sonraki satırda yazılı olmalı (grep bunu göremez, sen görürsün). Listede olmayan bir
satır kalırsa gerçek kaçaktır — spec'in `Architect'siz takımda docs/ sahipliği` tablosuyla
karşılaştır ve koşullandır.

Bu üç kalıbın gerekçesi: (1) `consults` — danışma zincirinin ucu, (2) "architect'e
danış/gidilir/sevk et" — belirsizlik hedefi, (3) "orası architect'in" — `docs/` yasağı.
Architect yoksa üçü de anlamsızlaşır; ikisi çelişki üretir (`docs/` sahipsizken yasak
sürer), biri boşa düşer (danışılacak kimse yok).

- [ ] **Step 6: Commit**

```bash
git add team-builder-shared/routing.md team-builder-shared/governance-defaults.md team-builder-shared/agent-md-rich.md team-builder-setup/SKILL.md
git commit -m "feat: condition architect references and derive the code review gate from codeReviewer"
```

---

### Task 6: README (iki dil)

README bugün "4 anayasa preseti" diyor ve hepsinin default açık olduğunu ima ediyor. Beş oldu ve beşincisi kapalı.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 3'ün KARAR 5 metni
- Produces: yok

- [ ] **Step 1: İngilizce bölümü güncelle**

`README.md`, `/team-builder-setup` satırındaki `constitution presets` ifadesini `constitution presets (including the optional plan gate)` yap.

**Asıl düzeltme bir ekleme değil, bir değiştirmedir** — mevcut cümle "hepsi açık" diyor ve
bu yanlış olacak. Şu satırı:

```markdown
- **Constitution:** no-workaround discipline, code–doc sync, per-agent memory, language/comment
  standard — all on by default, each toggleable in the wizard.
```

şununla değiştir:

```markdown
- **Constitution:** no-workaround discipline, code–doc sync, per-agent memory, language/comment
  standard — all four on by default, each toggleable in the wizard. A fifth preset, the
  **plan gate**, is **off by default**: it makes the team write a plan, have it reviewed and
  get your approval before any code is written. Unlike the other four it creates files in
  your project (`.agent-work/` and a `work-plan` skill), which is why you opt into it.
```

- [ ] **Step 2: Türkçe bölümü güncelle**

`README.md` Türkçe bölümünde, `/team-builder-setup` satırındaki `anayasa presetleri` ifadesini `anayasa presetleri (isteğe bağlı plan kapısı dahil)` yap.

Aynı şekilde, "hepsi varsayılan açık" diyen satırı:

```markdown
  standardı — hepsi varsayılan açık, sihirbazda kapatılabilir.
```

şununla değiştir:

```markdown
  standardı — dördü de varsayılan açık, sihirbazda kapatılabilir. Beşinci bir preset,
  **plan kapısı**, **varsayılan kapalıdır**: kod yazılmadan önce plan yazılmasını,
  denetlenmesini ve **senin onaylamanı** şart koşar. Diğer dördünün aksine projede dosya
  üretir (`.agent-work/` ve bir `work-plan` skill'i) — o yüzden açmak bilinçli bir tercihtir.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the plan gate preset in both README languages"
```

---

## Uygulama sonrası doğrulama

- [ ] **Üç selftest de geçiyor**

```bash
node team-builder-shared/validate-manifest.mjs --selftest && node team-builder-shared/sync-agent-config.mjs --selftest && node team-builder-shared/validate-plan-gate.mjs --selftest
```

Beklenen: üç kez `SELFTEST PASS`.

- [ ] **Plan 1 artefaktları hâlâ geçerli**

```bash
node team-builder-shared/validate-plan-gate.mjs --root .
```

Beklenen: `Plan gate artifacts are valid.`

- [ ] **Kurulum tuzağı yok**

```bash
rm -rf /tmp/tb-pg2 && mkdir -p /tmp/tb-pg2 && HOME=/tmp/tb-pg2 ./install.sh opencode >/dev/null && find /tmp/tb-pg2 -name 'SKILL.md' | sed 's|.*/skills/||' | sort
```

Beklenen tam olarak üç satır: `architecture-advisor/SKILL.md`, `team-builder-setup/SKILL.md`, `team-builder-sync/SKILL.md`.

- [ ] **Plan 1 artefaktlarına dokunulmadı**

```bash
git diff --stat HEAD~6 -- team-builder-shared/plan-gate.md team-builder-shared/templates/ team-builder-shared/validate-plan-gate.mjs
```

Beklenen: boş çıktı.

- [ ] **V ve S senaryoları kodda karşılık buluyor**

Spec'in `## Doğrulama` bölümündeki V1–V16 ve S1–S2 satırlarını tek tek geç; her biri için
selftest kodunda karşılığı olan vakayı göster. Karşılığı olmayan satır kalırsa **plan
eksiktir** — o satır için görev ekle.

- [ ] **W1–W6 gerçekten çalıştırıldı (elle kabul)**

Bunlar **metin okuyarak kapatılamaz** — spec onları elle yürütülen kabul senaryoları
olarak tanımlıyor ve sihirbaz metnini yeniden okumak davranışı kanıtlamaz. Her biri için
tek kullanımlık bir proje dizininde sihirbazı çalıştır:

| # | Kurulum | Doğrulanan |
|---|---|---|
| W1 | Plan kapısı **açık**, iki kapı sahibi de verilmiş | `.agent-work/` + beş alt dizin, `README.md`, `TEMPLATE.md`, `.agent-source/skills/work-plan/SKILL.md` oluştu; metinler `docLanguage` dilinde; makine işaretleri birebir korunmuş |
| W2 | Plan kapısı **kapalı** | `.agent-work/` **yok**, `work-plan` kaynağı yok, mirror yok, manifest'te kök `planGate` yok |
| W3 | Kapı açık, `codeReviewer` bir ad | Routing ve governance metni **o adla** yazılmış |
| W4 | Kapı açık, `codeReviewer: null` | Evrensel code-review kuralı **hiçbir dosyada** yok — `grep -ri "review gate\|review kapı" .agent-source/` boş dönmeli |
| W5 | Architect **eklenmemiş** takım | `docs/** → architect` satırı yok; developer talimatında `docs/` yasağı ve architect atıfları yok; `consults` boş; `lead` geçerli bir agent (ya da hiç yok) |
| W6 | Kapı açık, iki kapı sahibi sorusunun **ortasında** oturumu kes, yeni oturumda devam et | `answers.planGate.planReviewer` korunmuş, o soru **yeniden sorulmamış**, yalnız `codeReviewer` sorulmuş |

Her koşumdan sonra üretilen manifest'i doğrula — W5 özellikle önemli, çünkü geçersiz bir
`lead` orada ortaya çıkar:

```bash
node -e "import('./team-builder-shared/validate-manifest.mjs').then(m=>m.validate(JSON.parse(require('fs').readFileSync('<proje>/.agent-source/agents/manifest.json','utf8'))))"
```

Beklenen: hata yok. W1 ve W3–W6 için ayrıca `sync --check` temiz olmalı.

- [ ] **Sihirbaz metninde jargon sızıntısı yok**

```bash
grep -n "planGate\|planReviewer\|codeReviewer\|writesCode" team-builder-setup/SKILL.md | grep -i "sor\|göster\|de ki\|\">"
```

Beklenen: kullanıcıya **gösterilecek** hiçbir cümlede alan adı geçmemeli. Alan adları
yalnız "→ `manifest.planGate.planReviewer`" gibi **üretim talimatlarında** bulunur.

## Kapsam dışı

- **Kapı sahibinin sonradan değiştirilmesi.** Setup bir kez çalışır; sahip değişince
  routing ve governance metnini birlikte güncellemek **proje-yükseltme skill'inin** işidir
  (ayrı iş, `task_4782952e`).
- **Çapraz ekosistem çağrı protokolü.** `planReviewer` başka bir ekosistemdeyse nasıl
  çağrılacağı ayrı bir spec'tir (spec KARAR 21).
- **`validate-manifest.mjs`'in Türkçe yorumlarının çevrilmesi.** Ayrı temizlik işi.
- **Runtime davranışı.** `work-plan` skill'inin ne yaptığı Plan 1'de tamamlandı ve bu
  planda değişmez.
