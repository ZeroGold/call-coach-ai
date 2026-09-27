import http from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { timingSafeEqual } from "node:crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.TYPESAFE_API_KEY || "";
const MODEL = process.env.TYPESAFE_MODEL || "jev-latest";
const ENDPOINT = process.env.TYPESAFE_ENDPOINT || "https://api.typesafe.ai/v1/systemone";
let ASR_MODEL = process.env.ASR_MODEL || "onnx-community/whisper-base.en";

// Where downloaded speech models go. The desktop app points this at its user data
// folder, since the install folder is read-only.
const DATA_DIR = process.env.CALL_COACH_DATA || "";

// Hosting on a website (HOSTED=1). People use their own TypeSafe key, entered in
// Settings and sent with each request, never stored here. To let people use the
// server's key instead, also set ACCESS_CODE (they enter it in Settings), or
// OPEN_ACCESS=1 to let anyone use it. Speech is transcribed in each visitor's
// browser unless TRANSCRIBE=server.
const HOSTED = process.env.HOSTED === "1";
const ACCESS_CODE = process.env.ACCESS_CODE || "";
const OPEN_ACCESS = process.env.OPEN_ACCESS === "1";
const TRANSCRIBE = process.env.TRANSCRIBE || (HOSTED ? "browser" : "server");
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE) || (HOSTED ? 30 : 0);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const ASR_MODELS = [
  { id: "onnx-community/whisper-tiny.en",  label: "Tiny",   size: "~40 MB",  desc: "Fastest, lowest accuracy" },
  { id: "onnx-community/whisper-base.en",  label: "Base",   size: "~80 MB", desc: "Good balance of speed and accuracy" },
  { id: "onnx-community/whisper-small.en", label: "Small",  size: "~250 MB", desc: "High accuracy, moderate speed" },
  { id: "onnx-community/whisper-medium.en",label: "Medium", size: "~800 MB", desc: "Best accuracy, slower" },
];

// Whisper runs as two ONNX sessions (encoder and decoder). By default each one
// starts a thread pool as wide as the machine, and they fight over the cores:
// on a 32-thread CPU that made transcription 3-7x slower. A small pool is faster.
const ASR_THREADS = Number(process.env.ASR_THREADS) || Math.min(4, Math.max(1, Math.floor((os.availableParallelism?.() ?? os.cpus().length) / 2)));

const MAX_TURNS = 40;
const MAX_TURN_CHARS = 1500;
const MAX_BODY_BYTES = 200_000;

// Each folder in public/modes is one mode:
//   mode.json     name, kind ("live" or "rehearsal"), transcript labels, which questions drive the screen
//   schema.json   the questions sent to Jev
//   playbook.js   actions, tips, stage names and screen text (loaded by the browser)
const MODES_DIR = path.join(PUBLIC, "modes");
const DEFAULT_MODE = "sales";
const MODES = await loadModes();

async function loadModes() {
  const modes = {};
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
      modes[id] = { id, ...meta, schema };
    } catch (err) {
      console.warn(`Skipping mode "${id}": ${err.message}`);
    }
  }
  if (!modes[DEFAULT_MODE]) throw new Error(`The "${DEFAULT_MODE}" mode is missing from public/modes.`);
  return modes;
}

function publicModes() {
  return Object.values(MODES)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map(({ id, name, description, kind, icon, questions }) => ({ id, name, description, kind, icon, questions }));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".woff2": "font/woff2",
};

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

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error("Transcript is too large.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("Request body is not valid JSON.")); }
    });
    req.on("error", reject);
  });
}

function readBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) { reject(new Error("Audio too large.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

let asrPipeline = null;
let asrLoadedModel = null;
let asrLoading = false;
let asrProgress = null;

async function getASR() {
  if (asrPipeline && asrLoadedModel === ASR_MODEL) return asrPipeline;
  if (asrLoading) throw new Error("Model is loading, please wait...");
  asrLoading = true;
  asrProgress = { model: ASR_MODEL, pct: 0, status: "downloading" };
  try {
    console.log(`Loading speech model: ${ASR_MODEL}...`);
    const { pipeline, env } = await import("@huggingface/transformers").catch(() => {
      throw new Error("Speech recognition on the server needs the optional packages. Run npm install without --omit=optional.");
    });
    if (DATA_DIR) env.cacheDir = path.join(DATA_DIR, "models");
    asrPipeline = await pipeline("automatic-speech-recognition", ASR_MODEL, {
      dtype: "q8",
      device: "cpu",
      session_options: { intraOpNumThreads: ASR_THREADS },
      progress_callback: (p) => {
        if (p.status === "progress" && p.progress != null) {
          asrProgress = { model: ASR_MODEL, pct: Math.round(p.progress), status: "downloading" };
        }
      },
    });
    asrLoadedModel = ASR_MODEL;
    asrProgress = { model: ASR_MODEL, pct: 100, status: "ready" };
    console.log("Speech model ready.");
    return asrPipeline;
  } catch (err) {
    asrProgress = { model: ASR_MODEL, pct: 0, status: "error", error: err.message };
    throw err;
  } finally {
    asrLoading = false;
  }
}

// One transcription at a time. Whisper is CPU-bound, so running segments in
// parallel only makes every one of them slower, and it keeps results in order.
let asrQueue = Promise.resolve();
function transcribe(samples) {
  const run = asrQueue.then(async () => (await getASR())(samples));
  asrQueue = run.catch(() => {});
  return run;
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
function keyFor(req) {
  const own = req.headers["x-typesafe-key"];
  if (typeof own === "string" && own.trim()) return { key: own.trim() };
  if (!API_KEY) {
    return { status: 401, error: HOSTED ? "Add your TypeSafe API key in Settings to get coaching." : "TYPESAFE_API_KEY is not set. Stop the server and start it again with your key." };
  }
  if (HOSTED && !OPEN_ACCESS) {
    if (!ACCESS_CODE) return { status: 401, error: "This site needs your own TypeSafe API key. Add it in Settings." };
    if (!sameText(req.headers["x-access-code"], ACCESS_CODE)) {
      return { status: 401, error: "Enter this site's access code in Settings, or add your own TypeSafe API key." };
    }
  }
  return { key: API_KEY };
}

// Requests per minute per visitor, when hosted
const hits = new Map();
function overLimit(req) {
  if (!RATE_LIMIT) return false;
  const fwd = TRUST_PROXY ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
  const ip = fwd || req.socket.remoteAddress || "?";
  const minute = Math.floor(Date.now() / 60_000);
  const h = hits.get(ip);
  if (!h || h.minute !== minute) { hits.set(ip, { minute, n: 1 }); return false; }
  return ++h.n > RATE_LIMIT;
}
setInterval(() => {
  const minute = Math.floor(Date.now() / 60_000);
  for (const [ip, h] of hits) if (h.minute !== minute) hits.delete(ip);
}, 60_000).unref();

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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const serverSpeech = TRANSCRIBE === "server";

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ready: Boolean(API_KEY) && !HOSTED,     // the desktop app has a key and needs nothing from the visitor
        hosted: HOSTED,
        access: !HOSTED ? "server" : API_KEY && OPEN_ACCESS ? "open" : API_KEY && ACCESS_CODE ? "code-or-key" : "key",
        transcribe: TRANSCRIBE,
        canTranscribe: TRANSCRIBE !== "off",
        model: MODEL,
        asrModel: ASR_MODEL,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/modes") {
      return sendJson(res, 200, { modes: publicModes(), default: DEFAULT_MODE });
    }

    if (url.pathname.startsWith("/api/models") && !serverSpeech) {
      return sendJson(res, 404, { error: "Speech is transcribed in the browser on this server." });
    }

    if (req.method === "GET" && url.pathname === "/api/models") {
      return sendJson(res, 200, {
        models: ASR_MODELS,
        current: ASR_MODEL,
        loaded: asrLoadedModel,
        progress: asrProgress,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/models/switch") {
      if (HOSTED) return sendJson(res, 403, { error: "The speech model is set by the site owner." });
      const { model } = await readJson(req);
      if (!ASR_MODELS.some((m) => m.id === model)) {
        return sendJson(res, 400, { error: "Unknown model." });
      }
      if (model === asrLoadedModel) {
        return sendJson(res, 200, { status: "already_loaded" });
      }
      ASR_MODEL = model;
      asrPipeline = null;
      asrLoadedModel = null;
      getASR().catch(() => {});
      return sendJson(res, 200, { status: "loading", model });
    }

    if (req.method === "GET" && url.pathname === "/api/models/progress") {
      return sendJson(res, 200, asrProgress || { model: ASR_MODEL, pct: 0, status: "idle" });
    }

    if (req.method === "POST" && url.pathname === "/api/evaluate") {
      if (overLimit(req)) return sendJson(res, 429, { error: "Too many requests. Wait a minute and try again." });
      const access = keyFor(req);
      if (!access.key) return sendJson(res, access.status, { error: access.error });

      const body = await readJson(req);
      let mode;
      if (body.coach) {
        try { mode = readCoach(body.coach); } catch (err) { return sendJson(res, 400, { error: err.message }); }
      } else {
        const modeId = body.mode || DEFAULT_MODE;
        mode = Object.hasOwn(MODES, modeId) ? MODES[modeId] : null;
        if (!mode) return sendJson(res, 400, { error: `Unknown mode "${modeId}".` });
      }
      const clean = cleanTurns(body.turns, mode);
      if (!clean.some((t) => t.speaker === mode.transcript.other)) {
        return sendJson(res, 400, { error: `Add at least one thing the ${mode.transcript.other.replace(/_/g, " ")} said.` });
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
        return sendJson(res, 502, { error: message, status });
      }
      return sendJson(res, 200, { ...data, latency_ms });
    }

    if (req.method === "POST" && url.pathname === "/api/transcribe") {
      if (!serverSpeech) return sendJson(res, 404, { error: "Speech is transcribed in the browser on this server." });
      if (overLimit(req)) return sendJson(res, 429, { error: "Too many requests. Wait a minute and try again." });
      const body = await readBody(req);
      const usable = body.byteLength - (body.byteLength % 4);
      if (usable < 400) return sendJson(res, 200, { text: "" });
      const aligned = new ArrayBuffer(usable);
      new Uint8Array(aligned).set(body.subarray(0, usable));
      const samples = new Float32Array(aligned);
      const result = await transcribe(samples);
      return sendJson(res, 200, { text: result.text || "" });
    }

    if (req.method === "GET") {
      const reqPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const resolved = path.resolve(PUBLIC, "." + reqPath);
      if (resolved.startsWith(PUBLIC + path.sep)) {
        const ext = path.extname(resolved);
        const mime = MIME[ext];
        if (mime) {
          try {
            const content = await readFile(resolved);
            const headers = { "Content-Type": mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
            // Cross-origin isolation lets in-browser speech recognition use several threads.
            // Workers need the same headers as the page that starts them.
            if (HOSTED && (ext === ".html" || ext === ".js")) Object.assign(headers, { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "credentialless" });
            res.writeHead(200, headers);
            return res.end(content);
          } catch {}
        }
      }
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Unexpected server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Call Coach running at http://localhost:${PORT}${HOSTED ? " (hosted)" : ""}`);
  if (HOSTED) {
    if (API_KEY && OPEN_ACCESS) console.warn("Warning: OPEN_ACCESS=1 lets anyone who can reach this site use your TypeSafe key.");
    else if (API_KEY && ACCESS_CODE) console.log("Visitors can use this server's key with the access code, or their own key.");
    else if (API_KEY) console.log("TYPESAFE_API_KEY is ignored: set ACCESS_CODE to share it. Visitors use their own keys.");
    else console.log("Visitors use their own TypeSafe keys, entered in Settings.");
  } else if (!API_KEY) {
    console.warn("Warning: TYPESAFE_API_KEY is not set. The page will load but cannot analyze calls.");
  }
  console.log(`Speech: ${TRANSCRIBE === "server" ? `${ASR_MODEL} on this server` : TRANSCRIBE === "browser" ? "in each visitor's browser" : "off"}`);
  console.log(`Modes: ${publicModes().map((m) => m.id).join(", ")}`);
});
