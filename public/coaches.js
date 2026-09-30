// Custom coaches: modes built in Settings instead of a folder in /modes.
//
// A coach is stored as the plain form fields people fill in (name, who's who,
// the gauge, next steps, signals, scenarios). buildCoach() turns those fields
// into the same three pieces a built-in mode has: meta (like mode.json), the
// Jev question schema, and a playbook. Coaches live in this browser's storage
// (in the desktop app, on this computer) and each evaluation sends the schema
// along, so the server doesn't need to store anything.

const KEY = "cc-coaches";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("call-coach-coaches") : null;

export const TRANSCRIPT_KEY = "conversation_transcript";
export const ACTION_KEY = "next_step";
export const STAGE_KEY = "gauge";
export const LIMITS = { actions: 10, signals: 10, scenarios: 10, lines: 12, text: 400, name: 60 };

/* ---------- Storage ---------- */

export function listCoaches() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((c) => c && typeof c.id === "string" && c.fields) : [];
  } catch {
    return [];
  }
}

export function getCoach(id) {
  return listCoaches().find((c) => c.id === id) || null;
}

/** Saves the fields as a coach (new if `id` is missing) and returns its id. Throws with the problems if invalid. */
export function saveCoach(fields, id = null) {
  const problems = validateCoach(fields);
  if (problems.length) throw Object.assign(new Error(problems.join(" ")), { problems });
  const list = listCoaches();
  const coachId = id || `c-${slug(fields.name, "coach").slice(0, 24).replace(/_/g, "-")}-${Math.random().toString(36).slice(2, 6)}`;
  const entry = { id: coachId, fields: clean(fields), updatedAt: Date.now() };
  const at = list.findIndex((c) => c.id === coachId);
  if (at >= 0) list[at] = entry; else list.push(entry);
  write(list);
  return coachId;
}

export function deleteCoach(id) {
  write(listCoaches().filter((c) => c.id !== id));
}

/** Calls `fn` when coaches change in any window. */
export function onCoachesChanged(fn) {
  channel?.addEventListener("message", (e) => { if (e.data === "changed") fn(); });
  addEventListener("storage", (e) => { if (e.key === KEY) fn(); });
}

function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  channel?.postMessage("changed");
}

/* ---------- Fields ---------- */

export function blankCoach(kind = "live") {
  const practice = kind === "rehearsal";
  return {
    name: "",
    description: "",
    kind,
    you: practice ? "You" : "Rep",
    them: practice ? "Partner" : "Customer",
    goal: "",
    gauge: {
      label: practice ? "Your reply" : "Stage",
      question: practice ? "how well does it keep the conversation going?" : "where are they right now?",
      levels: [0, 1, 2, 3].map(() => ({ name: "", what: "", examples: [] })),
    },
    actions: [{ title: "", when: "", tip: "" }, { title: "", when: "", tip: "" }],
    signals: [],
    scenarios: practice ? [{ title: "", setup: "", lines: [] }] : [],
    advanced: { actionInstructions: "", stageInstructions: "" },
  };
}

export function validateCoach(f) {
  const p = [];
  const has = (v) => typeof v === "string" && v.trim().length > 0;
  if (!has(f?.name)) p.push("Give the coach a name.");
  if (!["live", "rehearsal"].includes(f?.kind)) p.push("Choose live call or practice.");
  if (!has(f?.you) || !has(f?.them)) p.push("Say who you are and who you're talking to.");
  if (!has(f?.gauge?.label)) p.push("Name what the gauge measures.");
  const levels = f?.gauge?.levels || [];
  if (levels.length !== 4 || levels.some((l) => !has(l.name) || !has(l.what))) p.push("Fill in a name and description for all four gauge levels.");
  const actions = (f?.actions || []).filter((a) => has(a.title) || has(a.when) || has(a.tip));
  if (actions.length < 2) p.push("Add at least two next steps.");
  if (actions.some((a) => !has(a.title) || !has(a.when))) p.push("Every next step needs a title and when to suggest it.");
  if (actions.length > LIMITS.actions) p.push(`Use at most ${LIMITS.actions} next steps.`);
  const signals = (f?.signals || []).filter((s) => has(s.label) || has(s.question));
  if (signals.some((s) => !has(s.label) || !has(s.question))) p.push("Every signal needs a label and a yes/no question.");
  if (signals.length > LIMITS.signals) p.push(`Use at most ${LIMITS.signals} signals.`);
  if (f?.kind === "rehearsal") {
    const scenarios = (f.scenarios || []).filter((s) => has(s.title) || s.lines?.some(has));
    if (!scenarios.length) p.push("Add at least one practice scenario.");
    if (scenarios.some((s) => !has(s.title) || !s.lines?.some(has))) p.push("Every scenario needs a title and at least one line.");
    if (scenarios.length > LIMITS.scenarios) p.push(`Use at most ${LIMITS.scenarios} scenarios.`);
  }
  return p;
}

// Trim text, drop empty rows, and cap lengths so stored coaches stay small
function clean(f) {
  const t = (v, n = LIMITS.text) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const has = (v) => typeof v === "string" && v.trim().length > 0;
  return {
    name: t(f.name, LIMITS.name),
    description: t(f.description),
    kind: f.kind,
    you: t(f.you, 40),
    them: t(f.them, 40),
    goal: t(f.goal),
    gauge: {
      label: t(f.gauge.label, 40),
      question: t(f.gauge.question),
      levels: f.gauge.levels.slice(0, 4).map((l) => ({ name: t(l.name, 40), what: t(l.what), examples: (l.examples || []).map((e) => t(e)).filter(Boolean).slice(0, 6) })),
    },
    actions: f.actions.filter((a) => has(a.title) || has(a.when)).slice(0, LIMITS.actions).map((a) => ({ title: t(a.title, 60), when: t(a.when), tip: t(a.tip) })),
    signals: (f.signals || []).filter((s) => has(s.label) || has(s.question)).slice(0, LIMITS.signals)
      .map((s) => ({ label: t(s.label, 40), question: t(s.question), ...(has(s.yes) && { yes: t(s.yes) }), ...(has(s.no) && { no: t(s.no) }) })),
    scenarios: f.kind === "rehearsal"
      ? (f.scenarios || []).filter((s) => has(s.title)).slice(0, LIMITS.scenarios)
        .map((s) => ({ title: t(s.title, 60), setup: t(s.setup), lines: (s.lines || []).map((l) => t(l)).filter(Boolean).slice(0, LIMITS.lines) }))
      : [],
    advanced: { actionInstructions: t(f.advanced?.actionInstructions, 800), stageInstructions: t(f.advanced?.stageInstructions, 800) },
  };
}

/* ---------- Building a mode from fields ---------- */

export function slug(s, fallback) {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || fallback;
}

function uniqueKeys(labels, prefix, reserved = []) {
  const used = new Set(reserved);
  return labels.map((label, i) => {
    let k = slug(label, `${prefix}_${i + 1}`);
    if (/^\d/.test(k)) k = `${prefix}_${k}`;
    while (used.has(k)) k = `${k}_2`;
    used.add(k);
    return k;
  });
}

/** The exact questions sent to Jev, generated from the people and goal unless overridden in Advanced. */
export function defaultInstructions(f) {
  const you = (f.you || "user").toLowerCase(), them = (f.them || "other person").toLowerCase();
  const goal = (f.goal || "").trim().replace(/[.?!]+$/, "");
  const question = (f.gauge?.question || "").trim();
  const q = question ? question[0].toLowerCase() + question.slice(1) : "";
  if (f.kind === "rehearsal") {
    return {
      action: `\`${TRANSCRIPT_KEY}\` is a conversation the ${you} is practicing with the ${them}${goal ? `, where the goal is to ${goal}` : ""}. Looking at the ${you}'s most recent reply, what is the single most useful thing for the ${you} to work on next?`,
      stage: `Looking at the ${you}'s most recent reply in \`${TRANSCRIPT_KEY}\`, ${q || "how well does it keep the conversation going?"}`,
    };
  }
  return {
    action: `Given the ${them}'s most recent statements in \`${TRANSCRIPT_KEY}\`, what should the ${you} do next${goal ? ` to ${goal}` : ""}?`,
    stage: `Based on the ${them}'s most recent statements in \`${TRANSCRIPT_KEY}\`, ${q || "where are they right now?"}`,
  };
}

/** Fields -> { meta, schema, playbook }, the same shape as a built-in mode. */
export function buildCoach(id, f) {
  const live = f.kind !== "rehearsal";
  const them = f.them || "Them";
  const themLower = them.toLowerCase();
  const rep = slug(f.you, "user");
  let other = slug(f.them, "other");
  if (other === rep) other = `${other}_2`;

  const actionKeys = uniqueKeys(f.actions.map((a) => a.title), "step", ["no_action"]);
  const signalKeys = uniqueKeys(f.signals.map((s) => s.label), "signal", [ACTION_KEY, STAGE_KEY]);
  const auto = defaultInstructions(f);

  const criteria = Object.fromEntries(f.actions.map((a, i) => [actionKeys[i], a.when]));
  if (live) criteria.no_action = `Nothing needs doing right now, or the conversation isn't about this`;

  const schema = {
    [ACTION_KEY]: { type: "choice", instructions: f.advanced?.actionInstructions || auto.action, criteria },
    [STAGE_KEY]: {
      type: "score",
      instructions: f.advanced?.stageInstructions || auto.stage,
      criteria: f.gauge.levels.map((l) => ({ what: `${l.name}: ${l.what}`, examples: l.examples?.length ? l.examples : [l.what] })),
    },
  };
  f.signals.forEach((s, i) => {
    schema[signalKeys[i]] = {
      type: "noul",
      instructions: s.question,
      criteria: { true: s.yes || "Yes, clearly", false: s.no || "No, or it isn't clear" },
    };
  });

  const actions = Object.fromEntries(f.actions.map((a, i) => [actionKeys[i], { title: a.title, tips: { when: [], always: a.tip ? [a.tip] : [] } }]));
  if (live) actions.no_action = { title: "Keep listening", tips: { when: [], always: [] } };

  const playbook = {
    stages: f.gauge.levels.map((l) => l.name),
    actions,
    priority: [...actionKeys, ...(live ? ["no_action"] : [])],
    rules: [],
    listeningTips: live
      ? ["Let them talk. The more they say, the clearer the next step becomes."]
      : ["No single fix stands out. Try a reply that's specific and moves the conversation forward."],
    ...(live ? {} : { config: { stageSmoothing: 1, stageHysteresis: 0, switchMargin: 0, confirmUpdates: 1 } }),
    copy: {
      stageKicker: f.gauge.label,
      idleStage: live ? `Waiting for the ${themLower}` : "Reply to see how it lands",
      other: them,
      rep: "You",
      otherSpeaking: `${them} speaking`,
      typeOther: `Type what the ${themLower} said`,
      ...(live && { idleTip: `Press Start listening, or type what the ${themLower} says below. Press S to switch who's speaking.` }),
    },
    signals: Object.fromEntries(f.signals.map((s, i) => [signalKeys[i], { label: s.label }])),
    scenarios: live ? [] : f.scenarios,
  };

  const meta = {
    id,
    name: f.name,
    description: f.description,
    kind: f.kind,
    custom: true,
    transcript: { key: TRANSCRIPT_KEY, rep, other },
    questions: { action: ACTION_KEY, stage: STAGE_KEY },
  };
  return { meta, schema, playbook };
}

/* ---------- Starting from a built-in mode ---------- */

/** A built-in mode's files -> editable fields, for "Duplicate". Signal-specific tips and rules don't carry over. */
export function fieldsFromMode(meta, schema, playbook) {
  const action = schema[meta.questions.action];
  const stage = schema[meta.questions.stage];
  const own = (text) => (text || "").replaceAll(`\`${meta.transcript.key}\``, `\`${TRANSCRIPT_KEY}\``);
  const human = (k) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const options = Object.keys(action.criteria).filter((k) => k !== "no_action");
  const ordered = [...(playbook.priority || []).filter((k) => options.includes(k)), ...options.filter((k) => !(playbook.priority || []).includes(k))];
  return {
    name: `${meta.name} (copy)`,
    description: meta.description || "",
    kind: meta.kind,
    you: human(meta.transcript.rep),
    them: playbook.copy?.other || human(meta.transcript.other),
    goal: "",
    gauge: {
      label: playbook.copy?.stageKicker || "Stage",
      question: "",
      levels: stage.criteria.map((c, i) => ({
        name: playbook.stages?.[i] || `Level ${i + 1}`,
        what: c.what.replace(/^[^:]{1,40}:\s*/, ""),
        examples: c.examples || [],
      })),
    },
    actions: ordered.map((k) => ({ title: playbook.actions[k]?.title || human(k), when: action.criteria[k], tip: playbook.actions[k]?.tips?.always?.[0] || "" })),
    signals: Object.entries(schema).filter(([, q]) => q.type === "noul")
      .map(([k, q]) => ({ label: playbook.signals?.[k]?.label || human(k), question: q.instructions, yes: q.criteria?.true, no: q.criteria?.false })),
    scenarios: playbook.scenarios || [],
    // Keep the original wording so the copy behaves like the original
    advanced: { actionInstructions: own(action.instructions), stageInstructions: own(stage.instructions) },
  };
}

/* ---------- Sharing ---------- */

export function exportCoach(entry) {
  return JSON.stringify({ callCoach: 1, coach: entry.fields }, null, 2);
}

export function parseImport(text) {
  const data = JSON.parse(text);
  const fields = data?.callCoach === 1 ? data.coach : null;
  if (!fields) throw new Error("That file isn't a Call Coach coach.");
  const base = blankCoach(fields.kind);
  return { ...base, ...fields, gauge: { ...base.gauge, ...fields.gauge }, advanced: { ...base.advanced, ...fields.advanced } };
}
