// The coaching API, shared by server.mjs (the desktop app and self-hosting) and the
// Vercel functions in api/. It checks a request, picks which TypeSafe key pays for
// it, and asks Jev the mode's questions about the transcript.

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";

const env = process.env;
export const API_KEY = env.TYPESAFE_API_KEY || "";
export const MODEL = env.TYPESAFE_MODEL || "jev-latest";
const ENDPOINT = env.TYPESAFE_ENDPOINT || "https://api.typesafe.ai/v1/systemone";

// Hosting on a website (HOSTED=1). People use their own TypeSafe key, entered in
// Settings and sent with each request, never stored here. To let people use the
// server's key instead, also set ACCESS_CODE (they enter it in Settings), or
// OPEN_ACCESS=1 to let anyone use it. Speech is transcribed in each visitor's
// browser unless TRANSCRIBE=server.
//
// On Vercel the site is always hosted, speech can only run in the browser, and
// Vercel sets X-Forwarded-For itself, so it can be trusted.
const ON_VERCEL = env.VERCEL === "1";
export const HOSTED = env.HOSTED === "1" || ON_VERCEL;
export const ACCESS_CODE = env.ACCESS_CODE || "";
export const OPEN_ACCESS = env.OPEN_ACCESS === "1";
export const TRANSCRIBE = ON_VERCEL ? (env.TRANSCRIBE === "off" ? "off" : "browser") : env.TRANSCRIBE || (HOSTED ? "browser" : "server");
const RATE_LIMIT = Number(env.RATE_LIMIT_PER_MINUTE) || (HOSTED ? 30 : 0);
const TRUST_PROXY = env.TRUST_PROXY === "1" || ON_VERCEL;

const MAX_TURNS = 40;
const MAX_TURN_CHARS = 1500;
export const MAX_BODY_BYTES = 200_000;

// Each folder in public/modes is one mode:
//   mode.json     name, kind ("live" or "rehearsal"), transcript labels, which questions drive the screen
//   schema.json   the questions sent to Jev
//   playbook.js   actions, tips, stage names and screen text (loaded by the browser)
// Keep this a new URL(): Vercel's file tracer follows it to just this folder, where a
// computed path would make it bundle the whole project into each function.
const MODES_DIR = fileURLToPath(new URL("../public/modes/", import.meta.url));
export const DEFAULT_MODE = "sales";
let modes = null;

/** Every built-in mode, read once. Throws if the default mode is missing. */
export function getModes() {
  modes ??= loadModes().catch((err) => { modes = null; throw err; });
  return modes;
}

async function loadModes() {
  const found = {};
  for (const id of (await readdir(MODES_DIR)).sort()) {
    if (!/^[a-z0-9-]+$/.test(id)) continue;
    try {
      const dir = path.join(MODES_DIR, id);
      const meta = JSON.parse(await readFile(path.join(dir, "mode.json"), "utf8"));
      const schema = JSON.parse(await readFile(path.join(dir, "schema.json"), "utf8"));
      const { action, stage } = meta.questions || {};
      if (schema[action]?.type !== "choice") throw new Error(`questions.action ("${action}") must be a choice question in schema.json`);
      if (schema[stage]?.type !== "score") throw new Error(`questions.stage ("${stage}") must be a score question in schema.json`);
      const t = meta.transcript || {};
      if (!t.key || !t.rep || !t.other) throw new Error("mode.json needs transcript.key, transcript.rep and transcript.other");
      if (meta.kind !== "live" && meta.kind !== "rehearsal") throw new Error('kind must be "live" or "rehearsal"');
      found[id] = { id, ...meta, schema };
    } catch (err) {
      console.warn(`Skipping mode "${id}": ${err.message}`);
    }
  }
  if (!found[DEFAULT_MODE]) throw new Error(`The "${DEFAULT_MODE}" mode is missing from public/modes.`);
  return found;
}

/** GET /api/modes */
export async function listModes() {
  const list = Object.values(await getModes())
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map(({ id, name, description, kind, icon, questions }) => ({ id, name, description, kind, icon, questions }));
  return { modes: list, default: DEFAULT_MODE };
}

/** GET /api/health */
export function health() {
  return {
    ready: Boolean(API_KEY) && !HOSTED,     // the desktop app has a key and needs nothing from the visitor
    hosted: HOSTED,
    access: !HOSTED ? "server" : API_KEY && OPEN_ACCESS ? "open" : API_KEY && ACCESS_CODE ? "code-or-key" : "key",
    transcribe: TRANSCRIBE,
    canTranscribe: TRANSCRIBE !== "off",
    model: MODEL,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function askJev(turns, mode, key) {
  const body = JSON.stringify({
    model: MODEL,
    state: { [mode.transcript.key]: turns },
    questions: mode.schema,
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
    });
    if ((res.status === 429 || res.status === 529) && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 300 * 2 ** attempt);
      continue;
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { status: res.status, data };
  }
}

// A custom coach from Settings arrives with its questions. Check the shape and
// size before passing it on; the questions themselves are the user's own.
const LABEL = /^[a-z_][a-z0-9_]{0,40}$/;
function readCoach(c) {
  const t = c?.transcript || {};
  if (![t.key, t.rep, t.other].every((v) => typeof v === "string" && LABEL.test(v)) || t.rep === t.other) {
    throw new Error("This coach's transcript labels aren't valid.");
  }
  const schema = c.schema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new Error("This coach has no questions.");
  const entries = Object.entries(schema);
  if (entries.length < 1 || entries.length > 24) throw new Error("A coach can ask between 1 and 24 questions.");
  for (const [k, q] of entries) {
    if (!LABEL.test(k) || !["choice", "score", "noul"].includes(q?.type) || typeof q.instructions !== "string") {
      throw new Error(`The coach's question "${k}" isn't valid.`);
    }
  }
  if (JSON.stringify(schema).length > 60_000) throw new Error("This coach is too large.");
  return { transcript: { key: t.key, rep: t.rep, other: t.other }, schema };
}

// Which TypeSafe key a request uses: the visitor's own, or the server's when allowed
function sameText(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && timingSafeEqual(x, y);
}
function keyFor(header) {
  const own = header("x-typesafe-key");
  if (typeof own === "string" && own.trim()) return { key: own.trim() };
  if (!API_KEY) {
    return { status: 401, error: HOSTED ? "Add your TypeSafe API key in Settings to get coaching." : "TYPESAFE_API_KEY is not set. Stop the server and start it again with your key." };
  }
  if (HOSTED && !OPEN_ACCESS) {
    if (!ACCESS_CODE) return { status: 401, error: "This site needs your own TypeSafe API key. Add it in Settings." };
    if (!sameText(header("x-access-code"), ACCESS_CODE)) {
      return { status: 401, error: "Enter this site's access code in Settings, or add your own TypeSafe API key." };
    }
  }
  return { key: API_KEY };
}

/** Who a request is from, for the rate limit: the forwarded address behind a trusted proxy, else the socket's. */
export function clientIp(header, socketAddress) {
  const fwd = TRUST_PROXY ? String(header("x-forwarded-for") || "").split(",")[0].trim() : "";
  return fwd || socketAddress || "?";
}

// Requests per minute per visitor, when hosted. On Vercel each running instance
// keeps its own count, so there it's a speed bump rather than a hard limit.
let hits = new Map();
let hitsMinute = 0;
export function overLimit(ip) {
  if (!RATE_LIMIT) return false;
  const minute = Math.floor(Date.now() / 60_000);
  if (minute !== hitsMinute) { hits = new Map(); hitsMinute = minute; }
  const n = (hits.get(ip) || 0) + 1;
  hits.set(ip, n);
  return n > RATE_LIMIT;
}
export const TOO_MANY = { error: "Too many requests. Wait a minute and try again." };

function cleanTurns(input, mode) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({
      speaker: t.speaker === "rep" ? mode.transcript.rep : mode.transcript.other,
      text: t.text.trim().slice(0, MAX_TURN_CHARS),
    }));
}

/**
 * POST /api/evaluate. `header(name)` reads a request header (lowercase name),
 * `ip` is from clientIp(), and `readJson()` returns the parsed body or throws.
 * Returns [status, payload].
 */
export async function evaluate({ header, ip, readJson }) {
  if (overLimit(ip)) return [429, TOO_MANY];
  const access = keyFor(header);
  if (!access.key) return [access.status, { error: access.error }];

  let body;
  try { body = await readJson(); } catch (err) { return [400, { error: err.message }]; }
  let mode;
  if (body.coach) {
    try { mode = readCoach(body.coach); } catch (err) { return [400, { error: err.message }]; }
  } else {
    const all = await getModes();
    const modeId = body.mode || DEFAULT_MODE;
    mode = Object.hasOwn(all, modeId) ? all[modeId] : null;
    if (!mode) return [400, { error: `Unknown mode "${modeId}".` }];
  }
  const clean = cleanTurns(body.turns, mode);
  if (!clean.some((t) => t.speaker === mode.transcript.other)) {
    return [400, { error: `Add at least one thing the ${mode.transcript.other.replace(/_/g, " ")} said.` }];
  }

  const started = performance.now();
  const { status, data } = await askJev(clean, mode, access.key);
  const latency_ms = Math.round(performance.now() - started);

  if (status !== 200) {
    const detail = data?.detail || data?.error || data?.message || data?.raw || "";
    const message =
      status === 401 ? (access.key === API_KEY ? "TypeSafe rejected the API key. Check TYPESAFE_API_KEY." : "TypeSafe rejected your API key. Check it in Settings.") :
      status === 422 ? `TypeSafe could not read the request: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` :
      status === 429 ? "Rate limit reached. Wait a moment and keep talking." :
      `TypeSafe returned status ${status}.`;
    return [502, { error: message, status }];
  }
  return [200, { ...data, latency_ms }];
}

/** The startup message about who pays for coaching. */
export function accessSummary() {
  if (HOSTED) {
    if (API_KEY && OPEN_ACCESS) return "Warning: OPEN_ACCESS=1 lets anyone who can reach this site use your TypeSafe key.";
    if (API_KEY && ACCESS_CODE) return "Visitors can use this server's key with the access code, or their own key.";
    if (API_KEY) return "TYPESAFE_API_KEY is ignored: set ACCESS_CODE to share it. Visitors use their own keys.";
    return "Visitors use their own TypeSafe keys, entered in Settings.";
  }
  return API_KEY ? "" : "Warning: TYPESAFE_API_KEY is not set. The page will load but cannot analyze calls.";
}
