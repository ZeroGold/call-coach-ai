import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import {
  HOSTED, TRANSCRIBE, MAX_BODY_BYTES, TOO_MANY,
  getModes, listModes, health, evaluate, clientIp, overLimit, accessSummary,
} from "./lib/coach.mjs";

// The desktop app, and self-hosting on any Node server. Coaching requests are
// handled by lib/coach.mjs, which the Vercel functions in api/ share; this file
// adds speech recognition on the server and serves public/.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const PORT = Number(process.env.PORT || 3000);
let ASR_MODEL = process.env.ASR_MODEL || "onnx-community/whisper-base.en";

// Where downloaded speech models go. The desktop app points this at its user data
// folder, since the install folder is read-only.
const DATA_DIR = process.env.CALL_COACH_DATA || "";

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

await getModes(); // stop here if public/modes is broken

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
function transcribe(samples, quick = false) {
  const run = asrQueue.then(async () => (quick ? quickASR : await getASR())(samples));
  asrQueue = run.catch(() => {});
  return run;
}

// Live transcripts (the phrase so far, re-read about once a second) use a small, fast
// model so they keep up and don't hold up the final text, which uses the chosen model.
const QUICK_MODEL = process.env.ASR_QUICK_MODEL || "onnx-community/whisper-tiny.en";
let quickASR = null;
let quickLoading = null;
function quickReady() {
  if (QUICK_MODEL === ASR_MODEL && asrPipeline && asrLoadedModel === ASR_MODEL) { quickASR = asrPipeline; return true; }
  if (quickASR) return true;
  // Load it in the background; until then, live transcripts are skipped rather than waited for
  quickLoading ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    if (DATA_DIR) env.cacheDir = path.join(DATA_DIR, "models");
    quickASR = await pipeline("automatic-speech-recognition", QUICK_MODEL, {
      dtype: "q8", device: "cpu", session_options: { intraOpNumThreads: ASR_THREADS },
    });
    console.log(`Quick speech model ready: ${QUICK_MODEL}`);
  })().catch((err) => { console.warn("Quick speech model failed to load:", err.message); quickLoading = null; });
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const serverSpeech = TRANSCRIBE === "server";
    const header = (name) => req.headers[name];

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ...health(), asrModel: ASR_MODEL });
    }

    if (req.method === "GET" && url.pathname === "/api/modes") {
      return sendJson(res, 200, await listModes());
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
      const [status, payload] = await evaluate({ header, ip: clientIp(header, req.socket.remoteAddress), readJson: () => readJson(req) });
      return sendJson(res, status, payload);
    }

    if (req.method === "POST" && url.pathname === "/api/transcribe") {
      if (!serverSpeech) return sendJson(res, 404, { error: "Speech is transcribed in the browser on this server." });
      if (overLimit(clientIp(header, req.socket.remoteAddress))) return sendJson(res, 429, TOO_MANY);
      const body = await readBody(req);
      const usable = body.byteLength - (body.byteLength % 4);
      if (usable < 400) return sendJson(res, 200, { text: "" });
      const aligned = new ArrayBuffer(usable);
      new Uint8Array(aligned).set(body.subarray(0, usable));
      const samples = new Float32Array(aligned);
      // A live-transcript request uses the quick model, and is skipped while it's still loading
      const quick = url.searchParams.get("quick") === "1";
      if (quick && !quickReady()) return sendJson(res, 200, { text: "", skipped: true });
      const result = await transcribe(samples, quick);
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
  const access = accessSummary();
  if (access) (access.startsWith("Warning") ? console.warn : console.log)(access);
  console.log(`Speech: ${TRANSCRIBE === "server" ? `${ASR_MODEL} on this server` : TRANSCRIBE === "browser" ? "in each visitor's browser" : "off"}`);
  listModes().then(({ modes }) => console.log(`Modes: ${modes.map((m) => m.id).join(", ")}`));
});
