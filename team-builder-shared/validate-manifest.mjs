// validate-manifest.mjs (v2)
// .agent-source/agents/manifest.json'u (parse edilmiş JS objesi) v2 şemasına göre doğrular.
// Çağıran JSON'u parse edip verir. Geçersizse toplanan mesajlarla Error fırlatır; geçerliyse true döner.
// Şema otoritesi: team-builder-shared/manifest-schema.md

// Agent names are embedded directly in generated file paths
// (sync-agent-config.mjs:409,419,425). Anything outside this slug — a slash,
// a backslash, a space, a control character — can escape the target directory.
const NAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TARGETS = ["claude", "codex", "opencode"];
const TOPOLOGIES = ["subagent", "native"];
const FOCUS = ["performance", "code-design", "ui-ux", "accessibility", "security", "testing"];
const MODELS = ["opus", "sonnet", "haiku"];
const EFFORTS = ["low", "medium", "high"];
const ENFORCEMENTS = ["mandatory", "when-needed"];
const CONSTITUTION_FIELDS = [
  "noWorkaround",
  "codeDocSync",
  "perAgentMemory",
  "languageStandard",
  "planGate",
];

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

export function validate(doc) {
  const errors = [];

  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("Manifest geçersiz:\n- manifest bir nesne olmalı");
  }

  // agents: zorunlu, boş olamaz
  const agents = doc.agents;
  if (!Array.isArray(agents) || agents.length === 0) {
    errors.push("agents zorunlu ve boş olamaz");
  }

  const agentsByName = new Map();
  const agentNamesLower = new Set();
  for (const a of Array.isArray(agents) ? agents : []) {
    const label = a && a.name ? a.name : "(adsız)";

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

    // targets: verildiyse {claude,codex,opencode} alt kümesi ve boş olmamalı
    const hasTargets = a && a.targets !== undefined;
    if (hasTargets) {
      if (!Array.isArray(a.targets) || a.targets.length === 0) {
        errors.push(`${label}: targets boş olmayan dizi olmalı`);
      } else {
        for (const t of a.targets) {
          if (!TARGETS.includes(t)) {
            errors.push(`${label}: geçersiz target "${t}" (claude|codex|opencode)`);
          }
        }
      }
    }

    // Etkin hedefler: agent'ın kendi targets'ı, yoksa kök targetsDefault.
    // Varsayılan ekosistem YOKTUR — ikisi de yoksa hata.
    const effectiveTargets = Array.isArray(a && a.targets)
      ? a.targets
      : Array.isArray(doc.targetsDefault)
        ? doc.targetsDefault
        : null;
    if (!effectiveTargets || effectiveTargets.length === 0) {
      errors.push(
        `${label}: hedef belirtilmeli — agents[].targets ya da kök targetsDefault (claude|codex|opencode)`
      );
    }

    // model: verildiyse ve claude hedefliyse {opus,sonnet,haiku}
    const targetsClaude = (effectiveTargets ?? []).includes("claude");
    if (a && a.model !== undefined && targetsClaude) {
      if (!MODELS.includes(a.model)) {
        errors.push(`${label}: model geçersiz "${a.model}" (opus|sonnet|haiku)`);
      }
    }

    // model_reasoning_effort: verildiyse {low,medium,high}
    if (a && a.model_reasoning_effort !== undefined) {
      if (!EFFORTS.includes(a.model_reasoning_effort)) {
        errors.push(
          `${label}: model_reasoning_effort geçersiz "${a.model_reasoning_effort}" (low|medium|high)`
        );
      }
    }

    // opencode_model: verildiyse provider/model formatında string olmalı
    const targetsOpencode = (effectiveTargets ?? []).includes("opencode");
    if (a && a.opencode_model !== undefined) {
      if (
        typeof a.opencode_model !== "string" ||
        !/^[^/]+\/[^/]+/.test(a.opencode_model)
      ) {
        errors.push(
          `${label}: opencode_model "provider/model" formatında olmalı (örn. anthropic/claude-sonnet-4-5)`
        );
      }
    } else if (targetsOpencode && a.model === undefined) {
      // opencode hedefli ama ne opencode_model ne model var → fallback haritası da çalışmaz.
      errors.push(
        `${label}: opencode hedefli agent için opencode_model veya model belirtilmeli`
      );
    }

    // skills[]: name zorunlu, enforcement {mandatory,when-needed}
    for (const s of (a && a.skills) ?? []) {
      const sName = s && s.name ? s.name : "(skill)";
      if (!s || typeof s.name !== "string" || s.name === "") {
        errors.push(`${label}: skills[].name zorunlu`);
      }
      if (!s || !ENFORCEMENTS.includes(s.enforcement)) {
        errors.push(
          `${label}/${sName}: enforcement mandatory|when-needed olmalı`
        );
      }
    }
  }

  // consults[]: verildiyse her değer tanımlı bir agent adı olmalı. Generator
  // bu adı doğrudan talimata gömüyor (sync-agent-config.mjs), yani tanımsız bir
  // ad var olmayan bir role sevk talimatı üretir.
  for (const a of Array.isArray(agents) ? agents : []) {
    const label = a && a.name ? a.name : "(adsız)";
    if (a && a.consults !== undefined) {
      if (!Array.isArray(a.consults)) {
        errors.push(`${label}: consults bir dizi olmalı`);
      } else {
        for (const c of a.consults) {
          if (!agentsByName.has(c)) {
            errors.push(
              `${label}: consults "${c}" agents içinde bir name olmalı`
            );
          }
        }
      }
    }
  }

  // codeDocSync[]: her satırda code ve doc dolu olmalı
  if (doc.codeDocSync !== undefined) {
    if (!Array.isArray(doc.codeDocSync)) {
      errors.push("codeDocSync bir dizi olmalı");
    } else {
      doc.codeDocSync.forEach((row, i) => {
        if (!row || typeof row !== "object") {
          errors.push(`codeDocSync[${i}]: nesne olmalı`);
          return;
        }
        if (!row.code) errors.push(`codeDocSync[${i}]: code dolu olmalı`);
        if (!row.doc) errors.push(`codeDocSync[${i}]: doc dolu olmalı`);
      });
    }
  }

  // lead: verildiyse bir agent name'i olmalı
  if (doc.lead !== undefined && doc.lead !== null && doc.lead !== "") {
    if (!agentsByName.has(doc.lead)) {
      errors.push(`lead "${doc.lead}" agents içinde bir name olmalı`);
    }
  }

  // routing[]: path & role dolu, role bir agent name'i
  if (doc.routing !== undefined) {
    if (!Array.isArray(doc.routing)) {
      errors.push("routing bir dizi olmalı");
    } else {
      doc.routing.forEach((r, i) => {
        if (!r || typeof r !== "object") {
          errors.push(`routing[${i}]: nesne olmalı`);
          return;
        }
        if (!r.path) errors.push(`routing[${i}]: path dolu olmalı`);
        if (!r.role) {
          errors.push(`routing[${i}]: role dolu olmalı`);
        } else if (!agentsByName.has(r.role)) {
          errors.push(`routing[${i}]: role "${r.role}" bir agent name olmalı`);
        }
      });
    }
  }

  // topology: verildiyse {subagent,native}
  if (doc.topology !== undefined && !TOPOLOGIES.includes(doc.topology)) {
    errors.push(`topology geçersiz "${doc.topology}" (subagent|native)`);
  }

  // focus: verildiyse dizi ve değerler bilinen set içinde
  if (doc.focus !== undefined) {
    if (!Array.isArray(doc.focus)) {
      errors.push("focus bir dizi olmalı");
    } else {
      for (const f of doc.focus) {
        if (!FOCUS.includes(f)) {
          errors.push(`focus geçersiz "${f}" (${FOCUS.join("|")})`);
        }
      }
    }
  }

  // constitution: alanları boolean (verildiyse)
  if (doc.constitution !== undefined) {
    if (typeof doc.constitution !== "object" || doc.constitution === null) {
      errors.push("constitution bir nesne olmalı");
    } else {
      for (const f of CONSTITUTION_FIELDS) {
        if (
          doc.constitution[f] !== undefined &&
          typeof doc.constitution[f] !== "boolean"
        ) {
          errors.push(`constitution.${f} boolean olmalı`);
        }
      }
    }
  }

  validatePlanGate(doc, errors, agentsByName);

  if (errors.length) {
    throw new Error("Manifest geçersiz:\n- " + errors.join("\n- "));
  }
  return true;
}

if (process.argv.includes("--selftest")) {
  let ok = true;

  // 1) invalid-reddedilir: targets {claude,codex} dışı, model geçersiz, lead yok,
  //    routing.role tanımsız agent, enforcement geçersiz, constitution boolean değil.
  const bad = {
    lead: "ghost",
    topology: "mesh",
    focus: ["performance", "bogus-focus"],
    constitution: { noWorkaround: "yes" },
    routing: [{ path: "apps/**", role: "nonexistent" }, { role: "architect" }],
    agents: [
      {
        name: "architect",
        targets: ["claude", "gpt"],
        model: "ultra",
        model_reasoning_effort: "extreme",
        skills: [{ name: "x", enforcement: "always" }],
      },
    ],
  };
  let rejected = false;
  try {
    validate(bad);
  } catch {
    rejected = true;
  }
  if (!rejected) {
    console.error("SELFTEST FAIL: invalid manifest accepted");
    ok = false;
  }

  // 2) valid-kabul-edilir: şemaya uygun tam örnek.
  const good = {
    targetsDefault: ["claude", "codex"],
    topology: "native",
    focus: ["performance", "code-design", "security"],
    docLanguage: "tr",
    architectureDocs: { root: "docs/mimari", layout: "central" },
    constitution: {
      noWorkaround: true,
      codeDocSync: true,
      perAgentMemory: true,
      languageStandard: true,
    },
    routing: [{ path: "apps/**", role: "backend-developer" }],
    lead: "architect",
    agents: [
      {
        name: "architect",
        targets: ["claude", "codex", "opencode"],
        model: "opus",
        opencode_model: "anthropic/claude-opus-4",
        model_reasoning_effort: "high",
        writesCode: false,
        skills: [{ name: "architecture-advisor", enforcement: "when-needed" }],
      },
      {
        name: "backend-developer",
        targets: ["claude", "codex"],
        model: "sonnet",
        model_reasoning_effort: "high",
        skills: [{ name: "backend-patterns", enforcement: "mandatory" }],
      },
    ],
  };
  try {
    if (validate(good) !== true) {
      console.error("SELFTEST FAIL: valid manifest rejected (no true)");
      ok = false;
    }
  } catch (e) {
    console.error("SELFTEST FAIL: valid manifest rejected:", e.message);
    ok = false;
  }

  // 3) opencode-only kabul edilir: targetsDefault ["opencode"], agent'lar targets
  //    yazmaz. Claude model kuralı UYGULANMAMALI (model alanı hiç yok), OpenCode
  //    kuralı targetsDefault üzerinden UYGULANMALI.
  const opencodeOnly = {
    targetsDefault: ["opencode"],
    lead: "architect",
    agents: [
      { name: "architect", opencode_model: "openai/gpt-5", writesCode: false },
    ],
  };
  try {
    if (validate(opencodeOnly) !== true) {
      console.error("SELFTEST FAIL: opencode-only manifest rejected (no true)");
      ok = false;
    }
  } catch (e) {
    console.error("SELFTEST FAIL: opencode-only manifest rejected:", e.message);
    ok = false;
  }

  // 4) targetsDefault üzerinden opencode hedefliyken model/opencode_model yoksa
  //    reddedilmeli (eskiden targetsDefault yok sayıldığı için kaçıyordu).
  let missingModelRejected = false;
  try {
    validate({
      targetsDefault: ["opencode"],
      lead: "architect",
      agents: [{ name: "architect" }],
    });
  } catch {
    missingModelRejected = true;
  }
  if (!missingModelRejected) {
    console.error("SELFTEST FAIL: opencode target without model accepted");
    ok = false;
  }

  // 5) hiçbir hedef yok (ne targets ne targetsDefault) → reddedilmeli.
  let noTargetRejected = false;
  try {
    validate({ lead: "architect", agents: [{ name: "architect" }] });
  } catch {
    noTargetRejected = true;
  }
  if (!noTargetRejected) {
    console.error("SELFTEST FAIL: manifest without any target accepted");
    ok = false;
  }

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

  // V13c — routing names ONLY a non-code-writing agent. Isolates the
  // writesCode half of the eligible-executor derivation: with routing
  // non-empty, dropping that half would wrongly make the reviewer an executor.
  expectReject(
    "V13c routed agent does not write code",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: "architect", codeReviewer: null },
      routing: [{ path: "docs/**", role: "architect" }],
      agents: [{ name: "architect", model: "opus", writesCode: false }],
    },
    "en az bir agent gerekli"
  );

  // V13d — a code-writing agent exists but no routing row names it. Isolates
  // the routing half: dropping it would wrongly make an unrouted developer an
  // executor.
  expectReject(
    "V13d code-writing agent is not routed",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: null, codeReviewer: null },
      routing: [],
      agents: [{ name: "dev", model: "sonnet" }],
    },
    "en az bir agent gerekli"
  );

  // V9b — every agent overrides targetsDefault, so codex is NOT a targeted
  // ecosystem and must not demand an executor. Reading targetsDefault directly
  // instead of the union of effective targets would reject this.
  expectAccept("V9b overridden targetsDefault is not targeted", {
    targetsDefault: ["claude", "codex"],
    constitution: { planGate: true },
    planGate: { planReviewer: "architect", codeReviewer: null },
    routing: [{ path: "src/**", role: "dev" }],
    agents: [
      { name: "dev", targets: ["claude"], model: "sonnet" },
      {
        name: "architect",
        targets: ["claude"],
        model: "opus",
        writesCode: false,
      },
    ],
  });

  // V17 — consults naming a nonexistent agent generates a referral to a role
  // that does not exist. The generator embeds the name verbatim.
  expectReject(
    "V17 unknown consults role",
    {
      targetsDefault: ["claude"],
      agents: [{ name: "dev", model: "sonnet", consults: ["ghost"] }],
    },
    "consults \"ghost\" agents içinde bir name olmalı"
  );

  // V18 — a skill entry without a name.
  expectReject(
    "V18 skill without name",
    {
      targetsDefault: ["claude"],
      agents: [
        { name: "dev", model: "sonnet", skills: [{ enforcement: "mandatory" }] },
      ],
    },
    "skills[].name zorunlu"
  );

  // V19 — a codeDocSync row missing either side of the mapping.
  expectReject(
    "V19 codeDocSync row without doc",
    {
      targetsDefault: ["claude"],
      codeDocSync: [{ code: "src/api/**" }],
      agents: [{ name: "dev", model: "sonnet" }],
    },
    "doc dolu olmalı"
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

  if (!ok) process.exit(1);
  console.log("SELFTEST PASS");
}
