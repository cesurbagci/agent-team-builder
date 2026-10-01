// validate-manifest.mjs (v2)
// .agent-source/agents/manifest.json'u (parse edilmiş JS objesi) v2 şemasına göre doğrular.
// Çağıran JSON'u parse edip verir. Geçersizse toplanan mesajlarla Error fırlatır; geçerliyse true döner.
// Şema otoritesi: team-builder-shared/manifest-schema.md

// Agent names are embedded directly in generated file paths
// (sync-agent-config.mjs:409,419,425). Anything outside this slug — a slash,
// a backslash, a space, a control character — can escape the target directory.
import { spawnSync } from "node:child_process";
import { lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  routePathProblems,
  routeContains,
  routesOverlap,
} from "./route-globs.mjs";

const NAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TARGETS = ["claude", "codex", "opencode"];
const TOPOLOGIES = ["subagent", "native"];
const FOCUS = ["performance", "code-design", "ui-ux", "accessibility", "security", "testing"];
// Model and effort live in .agent-source/llm.json (llm-config.md). A leftover
// field here would be silently ignored by the generator.
const LEGACY_MODEL_FIELDS = ["model", "model_reasoning_effort", "opencode_model"];
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

  // Every ecosystem the project targets has to be able to run a plan: an
  // eligible executor must exist there, so work never lands where no
  // executor can pick it up. (The gate owner does not have to be generated
  // in every executor's ecosystem — an unreachable owner runs over an
  // external CLI call instead.)
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
  }

  // crossReview: the gate owners run in another ecosystem than the caller.
  if ("crossReview" in gate && typeof gate.crossReview !== "boolean") {
    errors.push("planGate.crossReview true ya da false olmalı");
  }
  // taskAssignments: retired and ignored; still accepted so installed projects
  // that carry it stay valid.
  if ("taskAssignments" in gate && typeof gate.taskAssignments !== "boolean") {
    errors.push("planGate.taskAssignments true ya da false olmalı");
  }

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

    // Both target schemas require it: Codex rejects a subagent without a
    // description, and OpenCode's agent frontmatter requires the key. Treating
    // it as optional here produced configurations neither would load.
    if (a && (typeof a.description !== "string" || a.description.trim() === "")) {
      errors.push(`${label}: description dolu bir string olmalı`);
    }

    // sandbox_mode drives the OpenCode edit permission, so an unrecognised
    // value must not reach the generator: anything that is not "read-only"
    // is treated there as permission to write.
    if (
      a &&
      a.sandbox_mode !== undefined &&
      a.sandbox_mode !== "read-only" &&
      a.sandbox_mode !== "workspace-write"
    ) {
      errors.push(
        `${label}: sandbox_mode "read-only" ya da "workspace-write" olmalı`
      );
    }

    // A read-only agent cannot write, so it cannot write code. Left unchecked
    // this combination passes the plan gate's executor requirement with an
    // agent that every target denies edits to.
    if (a && a.writesCode !== false && a.sandbox_mode === "read-only") {
      errors.push(
        `${label}: sandbox_mode "read-only" ise writesCode false olmalı — kod yazamayan bir agent executor sayılamaz`
      );
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

    for (const field of LEGACY_MODEL_FIELDS) {
      if (a && a[field] !== undefined) {
        errors.push(
          `${label}: "${field}" artık .agent-source/llm.json'da — team-builder-models ile göç et`
        );
      }
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
        if (typeof row.code !== "string" || row.code === "") {
          errors.push(`codeDocSync[${i}]: code dolu bir string olmalı`);
        }
        if (typeof row.doc !== "string" || row.doc === "") {
          errors.push(`codeDocSync[${i}]: doc dolu bir string olmalı`);
        }
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
        // Must be a string, not merely truthy: the generator matches routes
        // with `typeof path === 'string'`, so a number here validates and is
        // then silently dropped — the role keeps its write permission and
        // loses the directory that justified it.
        if (typeof r.path !== "string" || r.path === "") {
          errors.push(`routing[${i}]: path dolu bir string olmalı`);
        } else {
          // Paths are restricted to the vocabulary routing.md documents, so
          // that containment is decidable and two routes cannot overlap with
          // neither containing the other — ownership would then have no
          // most-specific winner. See route-globs.mjs.
          const problems = routePathProblems(r.path);
          if (problems.length > 0) {
            errors.push(
              `routing[${i}]: path "${r.path}" desteklenmeyen glob biçimi (${problems.join(", ")})`
            );
          }
        }
        if (!r.role) {
          errors.push(`routing[${i}]: role dolu olmalı`);
        } else if (!agentsByName.has(r.role)) {
          errors.push(`routing[${i}]: role "${r.role}" bir agent name olmalı`);
        }
      });
    }
  }

  // Two routes may share paths only when one of them is the more specific: the
  // table resolves by most-specific match, so a partial overlap has no winner.
  // `a/*/c` and `a/b/*` both claim `a/b/c` and neither contains the other —
  // the generator would grant it to one role and forbid it to the other.
  {
    const rows = (Array.isArray(doc.routing) ? doc.routing : []).filter(
      (r) => r && typeof r.path === "string" && routePathProblems(r.path).length === 0
    );
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i].path;
        const b = rows[j].path;
        if (!routesOverlap(a, b)) continue;
        const aInB = routeContains(b, a);
        const bInA = routeContains(a, b);
        // Equal scope has no most specific side either. It is not always a
        // repeated spelling: `**/*` and `*/**` are different strings for the
        // same set, so comparing canonical text missed it.
        if (aInB && bInA) {
          errors.push(
            `routing: "${a}" ve "${b}" aynı kapsamı gösteriyor — en özgül eşleşme eşitler arasında seçim yapamaz; tek satıra indir`
          );
          continue;
        }
        if (aInB || bInA) continue;
        errors.push(
          `routing: "${a}" ve "${b}" kesişiyor ama biri ötekini kapsamıyor — en özgül eşleşme kesişimde bir sahip seçemez; yollardan birini diğerinin altına al ya da ayır`
        );
      }
    }
  }

  // The routing table assigns ownership, and routing.md makes that ownership
  // binding ("bypass = mimari ihlal"). A role that cannot change files cannot
  // discharge it: Codex would tell it to write a directory OpenCode denies it,
  // and the mandatory route would name an agent incapable of taking the work.
  // A reviewer belongs to the table as a gate, not as a path.
  for (const r of Array.isArray(doc.routing) ? doc.routing : []) {
    const owner = r && r.role ? agentsByName.get(r.role) : undefined;
    if (!owner) continue;
    const mayWrite = owner.sandbox_mode
      ? owner.sandbox_mode !== "read-only"
      : owner.writesCode !== false;
    if (!mayWrite) {
      errors.push(
        `routing: "${r.path}" yolu "${r.role}" rolüne verilmiş ama o rol dosya yazamıyor (sandbox_mode "read-only" ya da yazma izni yok) — yol sahipliği yazabilen bir role verilmeli`
      );
    }
  }

  // A doc-only role that may write files must have somewhere to write it.
  // Ownership reaches the generator only through routing, so an unrouted
  // `workspace-write` non-writer is told by Codex that it changes no files
  // while OpenCode hands it edit rights — the same role, two answers.
  {
    const routedRoles = new Set(
      (Array.isArray(doc.routing) ? doc.routing : [])
        .map((r) => r && r.role)
        .filter(Boolean)
    );
    for (const a of Array.isArray(doc.agents) ? doc.agents : []) {
      if (
        a &&
        a.name &&
        a.writesCode === false &&
        a.sandbox_mode === "workspace-write" &&
        !routedRoles.has(a.name)
      ) {
        errors.push(
          `agents["${a.name}"]: writesCode false + sandbox_mode "workspace-write" ise routing'de en az bir yol verilmeli — yoksa yazma izni var ama yazacağı yer yok`
        );
      }
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

  // 1) invalid-reddedilir: targets {claude,codex} dışı, lead yok, routing.role
  //    tanımsız agent, enforcement geçersiz, constitution boolean değil.
  const bad = {
    lead: "ghost",
    topology: "mesh",
    focus: ["performance", "bogus-focus"],
    constitution: { noWorkaround: "yes" },
    routing: [{ path: "apps/**", role: "nonexistent" }, { role: "architect" }],
    agents: [
      {
        name: "architect",
        description: "rol aciklamasi",
        targets: ["claude", "gpt"],
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
        description: "rol aciklamasi",
        targets: ["claude", "codex", "opencode"],
        writesCode: false,
        skills: [{ name: "architecture-advisor", enforcement: "when-needed" }],
      },
      {
        name: "backend-developer",
        description: "rol aciklamasi",
        targets: ["claude", "codex"],
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
  //    yazmaz; hedef targetsDefault'tan gelir.
  const opencodeOnly = {
    targetsDefault: ["opencode"],
    lead: "architect",
    agents: [
      { name: "architect", description: 'rol aciklamasi', writesCode: false },
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

  // 4) OpenCode hedefli bir agent'ın hiçbir yerde modeli olmaması geçerlidir:
  //    model .agent-source/llm.json'da durur, orada da yoksa OpenCode kendi
  //    varsayılanını kullanır.
  try {
    validate({
      targetsDefault: ["opencode"],
      lead: "architect",
      agents: [{ name: "architect" , description: 'rol aciklamasi',}],
    });
  } catch (e) {
    console.error("SELFTEST FAIL: opencode target without a model rejected:", e.message);
    ok = false;
  }

  // 5) hiçbir hedef yok (ne targets ne targetsDefault) → reddedilmeli.
  let noTargetRejected = false;
  try {
    validate({ lead: "architect", agents: [{ name: "architect" , description: 'rol aciklamasi',}] });
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
      { name: "dev", description: 'rol aciklamasi' },
      { name: "architect", description: 'rol aciklamasi', writesCode: false },
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

  // Model and effort moved to .agent-source/llm.json. Each old field must stop
  // validation and name the migration instead of being silently ignored.
  for (const [field, value] of [
    ["model", "claude-opus-5-5"],
    ["model_reasoning_effort", "high"],
    ["opencode_model", "openai/gpt-5"],
  ]) {
    const doc = gateBase();
    doc.agents[0][field] = value;
    expectReject(`legacy field ${field}`, doc, "team-builder-models");
  }

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
        { name: "dev", description: 'rol aciklamasi' },
        { name: "architect", description: 'rol aciklamasi', writesCode: 0 },
      ],
    },
    "writesCode boolean olmalı"
  );

  // V7c — sandbox_mode is the OpenCode edit permission. The generator reads
  // anything other than "read-only" as leave to write, so an unrecognised
  // value must be rejected here rather than silently granting access.
  expectReject(
    "V7c sandbox_mode is not a known value",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: "architect", codeReviewer: null },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", description: 'rol aciklamasi' },
        {
          name: "architect", description: 'rol aciklamasi',
          writesCode: false,
          sandbox_mode: "danger-full-access",
        },
      ],
    },
    'sandbox_mode "read-only" ya da "workspace-write" olmalı'
  );

  // V7d — read-only and "writes code" cannot both hold. Such an agent would
  // otherwise satisfy the plan gate's per-ecosystem executor requirement while
  // every target denies it edits.
  expectReject(
    "V7d read-only agent claims to write code",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: { planReviewer: "architect", codeReviewer: null },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", description: 'rol aciklamasi', sandbox_mode: "read-only" },
        { name: "architect", description: 'rol aciklamasi', writesCode: false },
      ],
    },
    "writesCode false olmalı"
  );

  // V7e — a doc-only role that may write files but owns no route: Codex tells
  // it it changes no files, OpenCode grants edit.
  expectReject(
    "V7e writable non-writer has no routed path",
    {
      targetsDefault: ["claude"],
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", description: 'rol aciklamasi' },
        {
          name: "doc-writer", description: 'rol aciklamasi',
          writesCode: false,
          sandbox_mode: "workspace-write",
        },
      ],
    },
    "routing'de en az bir yol verilmeli"
  );

  // V7f — a path routed to a role that cannot write it. Codex would announce a
  // write area the other targets deny, and the binding route would name an
  // agent that cannot take the work.
  expectReject(
    "V7f path routed to a read-only role",
    {
      targetsDefault: ["claude"],
      routing: [
        { path: "src/**", role: "dev" },
        { path: "src/auth/**", role: "security-reviewer" },
      ],
      agents: [
        { name: "dev", description: 'rol aciklamasi' },
        {
          name: "security-reviewer", description: 'rol aciklamasi',
          writesCode: false,
          sandbox_mode: "read-only",
        },
      ],
    },
    "dosya yazamıyor"
  );

  // V7j — description is required by both target schemas. Without it Codex
  // rejects the subagent and OpenCode gets an empty frontmatter key.
  for (const description of [undefined, "", "   "]) {
    expectReject(
      `V7j description ${JSON.stringify(description)}`,
      {
        targetsDefault: ["claude"],
        routing: [{ path: "src/**", role: "dev" }],
        agents: [{ name: "dev", description }],
      },
      "description dolu bir string olmalı"
    );
  }

  // V7i — routing paths are restricted to the documented glob vocabulary.
  // Outside it the ownership comparison cannot decide containment, and it
  // emitted carve-outs for routes that only overlap.
  const routePathCase = (path) => ({
    targetsDefault: ["claude"],
    routing: [
      { path: "src/**", role: "dev" },
      { path, role: "doc-writer" },
    ],
    agents: [
      { name: "dev", description: 'rol aciklamasi' },
      {
        name: "doc-writer", description: 'rol aciklamasi',
        writesCode: false,
        sandbox_mode: "workspace-write",
      },
    ],
  });
  for (const path of [
    "docs/*a*z*",
    "docs/***",
    "docs/**/**",
    "/docs/**",
    "docs//x/**",
    "docs/",
    // Partial-segment wildcards: routing assigns directory ownership, and a
    // file filter is not ownership. They also let two routes overlap with
    // neither containing the other, leaving no most-specific winner.
    "docs/**/*.md",
    "docs/a*",
    "docs/*a",
    "docs/readme.*",
    // Dot segments alias another path; routes are written from the project root.
    "./docs/**",
    "docs/../src/**",
  ]) {
    expectReject(
      `V7i unsupported glob ${path}`,
      routePathCase(path),
      "desteklenmeyen glob biçimi"
    );
  }
  // …and every form routing.md actually documents stays valid.
  for (const path of [
    "docs/**",
    "docs/*",
    "docs",
    "**",
    "apps/**/main/src/**",
    "modules/*/docs/**",
  ]) {
    expectAccept(`V7i supported glob ${path}`, routePathCase(path));
  }

  // V7l — routes that name the same set without being the same string.
  // `**/*` and `*/**` both mean "every non-empty path", so comparing canonical
  // text missed them; equality has no most-specific side either.
  for (const [a, b] of [
    ["**/*", "*/**"],
    ["docs", "docs/**"],
    ["docs/**", "docs/**"],
  ]) {
    expectReject(
      `V7l equal scope ${a} vs ${b}`,
      {
        targetsDefault: ["claude"],
        routing: [
          { path: a, role: "dev" },
          { path: b, role: "other" },
        ],
        agents: [
          { name: "dev", description: "rol aciklamasi" },
          { name: "other", description: "rol aciklamasi" },
        ],
      },
      "aynı kapsamı gösteriyor"
    );
  }

  // V7k — routes that overlap without either containing the other. Both claim
  // `a/b/c`, and most-specific matching has no answer for it.
  expectReject(
    "V7k partial overlap between routes",
    {
      targetsDefault: ["claude"],
      routing: [
        { path: "a/*/c", role: "dev" },
        { path: "a/b/*", role: "other" },
      ],
      agents: [
        { name: "dev", description: "rol aciklamasi" },
        { name: "other", description: "rol aciklamasi" },
      ],
    },
    "kesişiyor ama biri ötekini kapsamıyor"
  );
  // Every path `apps/**/main` matches is also matched by `apps/*/**`, so this
  // is a nested pair, not an ambiguous one. Deciding containment by walking
  // both token lists got this wrong: an inner `**` has to hold for every way
  // it expands, and that is a different question from whether some expansion
  // works.
  expectAccept("V7k interior globstar nested under a star", {
    targetsDefault: ["claude"],
    routing: [
      { path: "apps/*/**", role: "dev" },
      { path: "apps/**/main", role: "other" },
    ],
    agents: [
      { name: "dev", description: "rol aciklamasi" },
      { name: "other", description: "rol aciklamasi" },
    ],
  });

  // …while a nested pair is exactly what the table is for.
  expectAccept("V7k nested routes stay valid", {
    targetsDefault: ["claude"],
    routing: [
      { path: "docs/**", role: "architect" },
      { path: "docs/guides/**", role: "doc-writer" },
      { path: "src/**", role: "dev" },
    ],
    agents: [
      { name: "dev", description: "rol aciklamasi" },
      {
        name: "architect",
        description: "rol aciklamasi",
        writesCode: false,
        sandbox_mode: "workspace-write",
      },
      {
        name: "doc-writer",
        description: "rol aciklamasi",
        writesCode: false,
        sandbox_mode: "workspace-write",
      },
    ],
  });

  // V7h — two roles on the same scope. Most-specific routing cannot choose
  // between equals, and the generator grants the path to one while forbidding
  // it to the other. `docs` and `docs/**` are the same scope spelled twice.
  for (const [a, b] of [
    ["docs/**", "docs/**"],
    ["docs", "docs/**"],
  ]) {
    expectReject(
      `V7h duplicate scope ${a} vs ${b}`,
      {
        targetsDefault: ["claude"],
        routing: [
          { path: "src/**", role: "dev" },
          { path: a, role: "architect" },
          { path: b, role: "doc-writer" },
        ],
        agents: [
          { name: "dev", description: 'rol aciklamasi' },
          {
            name: "architect", description: 'rol aciklamasi',
            writesCode: false,
            sandbox_mode: "workspace-write",
          },
          {
            name: "doc-writer", description: 'rol aciklamasi',
            writesCode: false,
            sandbox_mode: "workspace-write",
          },
        ],
      },
      "aynı kapsamı gösteriyor"
    );
  }

  // V7g — a non-string path passes a truthiness check but the generator drops
  // it, leaving the owner with a write permission and no directory.
  expectReject(
    "V7g routing path is not a string",
    {
      targetsDefault: ["claude"],
      routing: [{ path: 123, role: "doc-writer" }],
      agents: [
        {
          name: "doc-writer", description: 'rol aciklamasi',
          writesCode: false,
          sandbox_mode: "workspace-write",
        },
      ],
    },
    "path dolu bir string olmalı"
  );

  // …and the same roster is fine once the route exists.
  expectAccept("V7e routed writable non-writer", {
    targetsDefault: ["claude"],
    routing: [
      { path: "src/**", role: "dev" },
      { path: "docs/**", role: "doc-writer" },
    ],
    agents: [
      { name: "dev", description: 'rol aciklamasi' },
      {
        name: "doc-writer", description: 'rol aciklamasi',
        writesCode: false,
        sandbox_mode: "workspace-write",
      },
    ],
  });

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
      { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"] },
      {
        name: "architect", description: 'rol aciklamasi',
        targets: ["codex"],
        writesCode: false,
      },
    ],
  });

  // V8f — crossReview is optional and boolean.
  expectAccept("V8f crossReview", {
    ...gateBase(),
    constitution: { planGate: true },
    planGate: { planReviewer: null, codeReviewer: null, crossReview: true },
  });
  expectReject(
    "V8g crossReview not boolean",
    {
      ...gateBase(),
      constitution: { planGate: true },
      planGate: { planReviewer: null, codeReviewer: null, crossReview: "yes" },
    },
    "planGate.crossReview true ya da false olmalı"
  );

  // V8h — taskAssignments is optional and boolean.
  expectAccept("V8h taskAssignments", {
    ...gateBase(),
    constitution: { planGate: true },
    planGate: { planReviewer: null, codeReviewer: null, taskAssignments: false },
  });
  expectReject(
    "V8i taskAssignments not boolean",
    {
      ...gateBase(),
      constitution: { planGate: true },
      planGate: { planReviewer: null, codeReviewer: null, taskAssignments: 1 },
    },
    "planGate.taskAssignments true ya da false olmalı"
  );

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
      { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"] },
      { name: "architect", description: 'rol aciklamasi', targets: ["codex"], writesCode: false },
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
        { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"] },
        { name: "architect", description: 'rol aciklamasi', targets: ["codex"], writesCode: false },
      ],
    },
    "geçersiz ekosistem"
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
        { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"] },
        { name: "architect", description: 'rol aciklamasi', targets: ["codex"], writesCode: false },
      ],
    },
    "dolu bir yol olmalı"
  );

  // V8e — cli itself must be an object. Without a case here the outer shape
  // guard is untested: a refactor weakening it would let `cli: 42` through
  // while every other line in the block stays covered.
  expectReject(
    "V8e cli override wrong shape",
    {
      targetsDefault: ["claude"],
      constitution: { planGate: true },
      planGate: {
        planReviewer: "architect",
        codeReviewer: null,
        cli: 42,
      },
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", description: 'rol aciklamasi', targets: ["claude", "codex"] },
        { name: "architect", description: 'rol aciklamasi', targets: ["codex"], writesCode: false },
      ],
    },
    "nesne olmalı"
  );

  // V9 — the owner may inherit coverage from targetsDefault.
  // Both sandbox values ride along here: a rule that rejected the real roster
  // would otherwise pass its own suite, since no other accepted fixture
  // declares a sandbox at all.
  expectAccept("V9 owner covers via targetsDefault", {
    targetsDefault: ["claude", "codex"],
    constitution: { planGate: true },
    planGate: { planReviewer: "architect", codeReviewer: null },
    routing: [{ path: "src/**", role: "dev" }],
    agents: [
      { name: "dev", description: 'rol aciklamasi', sandbox_mode: "workspace-write" },
      {
        name: "architect", description: 'rol aciklamasi',
        writesCode: false,
        sandbox_mode: "read-only",
      },
    ],
  });

  // V10 — duplicate agent name.
  expectReject(
    "V10 duplicate name",
    {
      targetsDefault: ["claude"],
      routing: [{ path: "src/**", role: "dev" }],
      agents: [
        { name: "dev", description: 'rol aciklamasi' },
        { name: "dev", description: 'rol aciklamasi' },
      ],
    },
    "benzersiz"
  );

  // V11 — a name that is not a portable slug can escape the target directory.
  expectReject(
    "V11 path traversal in name",
    {
      targetsDefault: ["claude"],
      agents: [{ name: "../../../escaped", description: 'rol aciklamasi' }],
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
        agents: [{ name: bad }],
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
        { name: "dev", description: 'rol aciklamasi' },
        { name: "Dev", description: 'rol aciklamasi' },
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
      agents: [{ name: "architect", description: 'rol aciklamasi', writesCode: false }],
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
        { name: "dev", description: 'rol aciklamasi', targets: ["claude"] },
        {
          name: "architect", description: 'rol aciklamasi',
          targets: ["claude", "codex"],
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
      agents: [{ name: "architect", description: 'rol aciklamasi', writesCode: false }],
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
      agents: [{ name: "dev", description: 'rol aciklamasi' }],
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
      { name: "dev", description: 'rol aciklamasi', targets: ["claude"] },
      {
        name: "architect", description: 'rol aciklamasi',
        targets: ["claude"],
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
      agents: [{ name: "dev", description: 'rol aciklamasi', consults: ["ghost"] }],
    },
    "consults \"ghost\" agents içinde bir name olmalı"
  );

  // V18 — a skill entry without a name.
  expectReject(
    "V18 skill without name",
    {
      targetsDefault: ["claude"],
      agents: [
        { name: "dev", description: 'rol aciklamasi', skills: [{ enforcement: "mandatory" }] },
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
      agents: [{ name: "dev", description: 'rol aciklamasi' }],
    },
    "doc dolu bir string olmalı"
  );

  // V19b — a truthy non-string is not a path.
  expectReject(
    "V19b codeDocSync row with non-string sides",
    {
      targetsDefault: ["claude"],
      codeDocSync: [{ code: 42, doc: {} }],
      agents: [{ name: "dev", description: 'rol aciklamasi' }],
    },
    "code dolu bir string olmalı"
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
  for (const owner of [42, { name: "architect" , description: 'rol aciklamasi',}]) {
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

  // CLI: the manifest path is an argument, never JavaScript source, so any
  // directory name works — quotes, dollar signs, a Windows drive letter.
  {
    const dir = mkdtempSync(path.join(os.tmpdir(), "tb-vm-it's $x-"));
    const run = file =>
      spawnSync(process.execPath, [fileURLToPath(import.meta.url), file], { encoding: "utf8" });
    const goodFile = path.join(dir, "manifest.json");
    const badFile = path.join(dir, "bad.json");
    writeFileSync(goodFile, JSON.stringify(good));
    writeFileSync(badFile, JSON.stringify(bad));
    const accepted = run(goodFile);
    const refused = run(badFile);
    const noArgument = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { encoding: "utf8" });
    if (accepted.status !== 0 || !accepted.stdout.includes("MANIFEST OK")) {
      console.error(`SELFTEST FAIL: CLI must accept a valid manifest, got ${accepted.status} ${accepted.stderr}`);
      ok = false;
    }
    if (refused.status !== 1 || !refused.stderr.includes("Manifest geçersiz")) {
      console.error(`SELFTEST FAIL: CLI must reject an invalid manifest with exit 1, got ${refused.status}`);
      ok = false;
    }
    // Without a file there is nothing to validate: say so, never exit 0.
    if (noArgument.status === 0) {
      console.error("SELFTEST FAIL: CLI without a manifest path must not report success");
      ok = false;
    }
    if (process.platform !== "win32") {
      const linked = path.join(dir, "linked.json");
      symlinkSync(goodFile, linked);
      const link = run(linked);
      if (link.status !== 1 || !link.stderr.includes("not a regular file")) {
        console.error(`SELFTEST FAIL: CLI must not follow a symbolic link, got ${link.status}`);
        ok = false;
      }
    }
    rmSync(dir, { recursive: true, force: true });
  }

  if (!ok) process.exit(1);
  console.log("SELFTEST PASS");
}

// CLI: node validate-manifest.mjs <path/to/manifest.json>. Only when run
// directly — sync imports this module. A link is not followed, like sync's own
// source reads, so a linked manifest cannot print an outside file's values.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly && !process.argv.includes("--selftest")) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node validate-manifest.mjs <path/to/manifest.json> | --selftest");
    process.exit(2);
  }
  try {
    if (!lstatSync(file).isFile()) {
      throw new Error(`${file} is not a regular file (a symbolic link is not followed)`);
    }
    validate(JSON.parse(readFileSync(file, "utf8")));
    console.log("MANIFEST OK");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
