// Turns a recorded segment (16 kHz mono PCM) into text.
//
// The desktop app and self-hosted servers transcribe on the server
// (/api/transcribe). A hosted site transcribes in each visitor's browser
// instead (asr-worker.js), so their audio never leaves their computer.

export const BROWSER_MODELS = [
  { id: "onnx-community/whisper-tiny.en", label: "Tiny", size: "~40 MB", desc: "Fastest, lowest accuracy" },
  { id: "onnx-community/whisper-base.en", label: "Base", size: "~80 MB", desc: "More accurate, slower" },
];
const MODEL_KEY = "cc-browser-asr";

let where = null;
export function speechLocation() {
  where ??= fetch("/api/health").then((r) => r.json()).then((h) => h.transcribe || "server").catch(() => "server");
  return where;
}

export function browserModel() {
  let id = null;
  try { id = localStorage.getItem(MODEL_KEY); } catch {}
  return BROWSER_MODELS.some((m) => m.id === id) ? id : BROWSER_MODELS[0].id;
}
export function setBrowserModel(id) {
  try { localStorage.setItem(MODEL_KEY, id); } catch {}
}

let worker = null;
let nextId = 0;
const pending = new Map();
const progressListeners = new Set();

/** Calls fn({ pct, model, ready }) while the in-browser model downloads. Returns an unsubscribe function. */
export function onModelProgress(fn) {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker("/asr-worker.js", { type: "module" });
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.type === "progress") { progressListeners.forEach((fn) => fn(d)); return; }
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    d.error ? p.reject(new Error(d.error)) : p.resolve({ text: d.text });
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "Speech recognition failed to load."));
    pending.clear();
    worker = null;
  };
  return worker;
}

/** Returns { text }, or throws. */
export async function transcribe(pcm) {
  const place = await speechLocation();
  if (place === "off") throw new Error("Speech recognition is turned off on this server.");
  if (place === "browser") {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, pcm, model: browserModel() }, [pcm.buffer]);
    });
  }
  const res = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pcm.buffer });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { text: data.text || "" };
}
