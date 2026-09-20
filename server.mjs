import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.TYPESAFE_API_KEY || "";
const MODEL = process.env.TYPESAFE_MODEL || "jev-latest";
const ENDPOINT = process.env.TYPESAFE_ENDPOINT || "https://api.typesafe.ai/v1/systemone";
let ASR_MODEL = process.env.ASR_MODEL || "onnx-community/whisper-small.en";

const ASR_MODELS = [
  { id: "onnx-community/whisper-tiny.en",  label: "Tiny",   size: "~40 MB",  desc: "Fastest, lowest accuracy" },
  { id: "onnx-community/whisper-base.en",  label: "Base",   size: "~150 MB", desc: "Good balance of speed and accuracy" },
  { id: "onnx-community/whisper-small.en", label: "Small",  size: "~500 MB", desc: "High accuracy, moderate speed" },
  { id: "onnx-community/whisper-medium.en",label: "Medium", size: "~1.5 GB", desc: "Best accuracy, slower" },
];

const MAX_TURNS = 40;
const MAX_TURN_CHARS = 1500;
const MAX_BODY_BYTES = 200_000;

const QUESTIONS = JSON.parse(await readFile(path.join(HERE, "schema.json"), "utf8"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function askJev(turns) {
  const body = JSON.stringify({
    model: MODEL,
    state: { sales_call_transcript: turns },
    questions: QUESTIONS,
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
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
    const { pipeline } = await import("@huggingface/transformers");
    asrPipeline = await pipeline("automatic-speech-recognition", ASR_MODEL, {
      dtype: "q8",
      device: "cpu",
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

function cleanTurns(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({
      speaker: t.speaker === "rep" ? "sales_rep" : "customer",
      text: t.text.trim().slice(0, MAX_TURN_CHARS),
    }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ready: Boolean(API_KEY), model: MODEL, canTranscribe: true, asrModel: ASR_MODEL });
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
      if (!API_KEY) {
        return sendJson(res, 500, { error: "TYPESAFE_API_KEY is not set. Stop the server and start it again with your key." });
      }
      const { turns } = await readJson(req);
      const clean = cleanTurns(turns);
      if (!clean.some((t) => t.speaker === "customer")) {
        return sendJson(res, 400, { error: "Add at least one thing the customer said." });
      }

      const started = performance.now();
      const { status, data } = await askJev(clean);
      const latency_ms = Math.round(performance.now() - started);

      if (status !== 200) {
        const detail = data?.detail || data?.error || data?.message || data?.raw || "";
        const message =
          status === 401 ? "TypeSafe rejected the API key. Check TYPESAFE_API_KEY." :
          status === 422 ? `TypeSafe could not read the request: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` :
          status === 429 ? "Rate limit reached. Wait a moment and keep talking." :
          `TypeSafe returned status ${status}.`;
        return sendJson(res, 502, { error: message, status });
      }
      return sendJson(res, 200, { ...data, latency_ms });
    }

    if (req.method === "POST" && url.pathname === "/api/transcribe") {
      const body = await readBody(req);
      const usable = body.byteLength - (body.byteLength % 4);
      if (usable < 400) return sendJson(res, 200, { text: "" });
      const aligned = new ArrayBuffer(usable);
      new Uint8Array(aligned).set(body.subarray(0, usable));
      const samples = new Float32Array(aligned);
      const asr = await getASR();
      const result = await asr(samples);
      return sendJson(res, 200, { text: result.text || "" });
    }

    if (req.method === "GET") {
      const reqPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const resolved = path.resolve(PUBLIC, "." + reqPath);
      if (resolved.startsWith(PUBLIC)) {
        const ext = path.extname(resolved);
        const mime = MIME[ext];
        if (mime) {
          try {
            const content = await readFile(resolved);
            res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
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
  console.log(`Call Coach running at http://localhost:${PORT}`);
  if (!API_KEY) console.warn("Warning: TYPESAFE_API_KEY is not set. The page will load but cannot analyze calls.");
  console.log(`Speech model: ${ASR_MODEL} (change with ASR_MODEL env var)`);
});
