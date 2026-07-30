// validate-manifest.mjs (v2)
// .agent-source/agents/manifest.json'u (parse edilmiş JS objesi) v2 şemasına göre doğrular.
// Çağıran JSON'u parse edip verir. Geçersizse toplanan mesajlarla Error fırlatır; geçerliyse true döner.
// Şema otoritesi: team-builder-shared/manifest-schema.md

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
];

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

  const agentNames = new Set();
  for (const a of Array.isArray(agents) ? agents : []) {
    const label = a && a.name ? a.name : "(adsız)";

    // name zorunlu
    if (!a || !a.name || typeof a.name !== "string") {
      errors.push(`${label}: name zorunlu`);
    } else {
      agentNames.add(a.name);
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

    // skills[].enforcement: verildiyse {mandatory,when-needed}
    for (const s of (a && a.skills) ?? []) {
      const sName = s && s.name ? s.name : "(skill)";
      if (!s || !ENFORCEMENTS.includes(s.enforcement)) {
        errors.push(
          `${label}/${sName}: enforcement mandatory|when-needed olmalı`
        );
      }
    }
  }

  // lead: verildiyse bir agent name'i olmalı
  if (doc.lead !== undefined && doc.lead !== null && doc.lead !== "") {
    if (!agentNames.has(doc.lead)) {
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
        } else if (!agentNames.has(r.role)) {
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

  if (!ok) process.exit(1);
  console.log("SELFTEST PASS");
}
