// Speech recognition inside the visitor's browser, for the hosted site.
// Runs Whisper with transformers.js: on the GPU (WebGPU) where available, else WebAssembly.
// Messages in:  { id, pcm: Float32Array (16 kHz mono), model }
// Messages out: { id, text } | { id, error } | { type: "progress", pct, model }

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0";

env.allowLocalModels = false;

let asr = null;
let loaded = null;
let loading = null;

async function load(model) {
  const progress_callback = (p) => {
    if (p.status === "progress" && p.progress != null) postMessage({ type: "progress", pct: Math.round(p.progress), model });
  };
  if (navigator.gpu) {
    try {
      return await pipeline("automatic-speech-recognition", model, {
        device: "webgpu",
        dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
        progress_callback,
      });
    } catch (err) {
      console.warn("WebGPU speech recognition failed, using WebAssembly:", err.message);
    }
  }
  return pipeline("automatic-speech-recognition", model, { device: "wasm", dtype: "q8", progress_callback });
}

// One segment at a time, in order
let queue = Promise.resolve();

onmessage = (e) => {
  const { id, pcm, model } = e.data;
  queue = queue.then(async () => {
    try {
      if (loaded !== model) {
        loading = load(model);
        asr = await loading;
        loaded = model;
        postMessage({ type: "progress", pct: 100, model, ready: true });
      }
      const result = await asr(pcm);
      postMessage({ id, text: result.text || "" });
    } catch (err) {
      loaded = null;
      postMessage({ id, error: err.message || String(err) });
    }
  });
};
