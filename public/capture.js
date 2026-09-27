// Call audio capture, transcribed by Whisper (see transcriber.js for where it runs).
//
//   Capture call:  call audio only, every line labeled "customer".
//   Auto capture:  call audio -> "customer", microphone -> "rep". Each side is
//                  its own stream, so speakers are labeled without any voice
//                  analysis. If the mic picks up the customer through the
//                  speakers, those segments are recognized as echo and dropped.
//
// All streams run through one AudioContext so they share a clock. The segmenter
// worklet cuts each one at natural pauses, and segments are transcribed and
// delivered in the order they finished.

import { transcribe } from "/transcriber.js";

export const SAMPLE_RATE = 16000;

// A mic segment is echo when its loudness follows the call audio this closely,
// while the call audio was playing for most of it, and it has less than
// minOwnFrames x 30 ms of speech the call audio can't explain.
export const ECHO = { minCorr: 0.6, minOverlap: 0.6, minOwnFrames: 10 };
const BEHIND_AT = 3;                              // segments waiting before we warn
const MERGE_MAX = SAMPLE_RATE * 25;               // Whisper hears at most 30 s per request
const MERGE_GAP = new Float32Array(SAMPLE_RATE / 5); // 200 ms of silence between merged segments

const HALLUCINATIONS = new Set([
  "you", "thank you", "thanks for watching", "subscribe",
  "bye", "the end", "thanks for listening",
]);

export function isHallucination(text) {
  if (/^[\s[(*♪].*[\])*♪\s]$/.test(text)) return true; // [BLANK_AUDIO], (silence), *music*
  const lower = text.toLowerCase().replace(/[.!?,\s]+/g, " ").trim();
  if (!lower || HALLUCINATIONS.has(lower)) return true;
  const words = lower.split(" ");
  return words.length <= 3 && words.every((w) => w === words[0]);
}

/** Call audio: the desktop in Electron, a shared tab or screen in the browser. */
export async function getCallAudio() {
  let stream;
  if (window.overlay?.getSources) {
    const sources = await window.overlay.getSources();
    const source = sources.find((s) => s.id.startsWith("screen:")) || sources[0];
    if (!source) throw new Error("No capture sources found.");
    const desktop = { chromeMediaSource: "desktop", chromeMediaSourceId: source.id };
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: desktop, optional: [{ echoCancellation: false }, { noiseSuppression: false }, { autoGainControl: false }] },
      video: { mandatory: { ...desktop, minWidth: 1, maxWidth: 1, minHeight: 1, maxHeight: 1 } },
    });
  } else {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  }
  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('No audio captured. Make sure to check "Share audio" when selecting the tab or screen.');
  }
  return stream;
}

export function getMicAudio() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

/**
 * Start transcribing. `sources` is [{ stream, speaker, echoOf? }], where
 * `echoOf` is the index of the source this one might hear through the speakers.
 * Handlers:
 *   onText(speaker, text)     a finished line, in order
 *   onDrop(speaker, reason)   a segment was discarded ("echo" or "noise")
 *   onBehind(waiting)         transcription is falling behind (0 once caught up)
 *   onError(message)
 *   onEnded()                 a stream ended on its own (e.g. screen share stopped)
 * Returns { stop(), settled() }.
 */
export async function startSession(sources, handlers = {}) {
  const { onText = () => {}, onDrop = () => {}, onBehind = () => {}, onError = () => {}, onEnded = () => {} } = handlers;
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  let running = true;

  try {
    await ctx.audioWorklet.addModule("/segmenter.worklet.js");
    const echoRefs = {};
    sources.forEach((s, i) => { if (s.echoOf != null) echoRefs[i] = s.echoOf; });
    const node = new AudioWorkletNode(ctx, "segmenter", {
      numberOfInputs: sources.length,
      numberOfOutputs: 1,
      processorOptions: { echoRefs, echo: ECHO },
    });
    sources.forEach((s, i) => ctx.createMediaStreamSource(new MediaStream(s.stream.getAudioTracks())).connect(node, 0, i));
    node.connect(ctx.destination); // outputs silence; keeps the graph pulling audio
    if (ctx.state === "suspended") await ctx.resume();

    // One request at a time, oldest segment first, so lines arrive in order.
    // Whisper costs about the same per request whatever the clip length, so when
    // segments pile up, consecutive ones from the same speaker go in one request.
    const queue = [];
    let busy = false, warned = false;
    let waiters = [];
    const settle = () => { if (!busy && !queue.length) { waiters.forEach((w) => w()); waiters = []; } };
    const pump = async () => {
      if (busy || !queue.length) return;
      busy = true;
      const { speaker } = queue[0];
      const parts = [];
      let len = 0;
      while (queue.length && queue[0].speaker === speaker && (!parts.length || len + MERGE_GAP.length + queue[0].pcm.length <= MERGE_MAX)) {
        if (parts.length) { parts.push(MERGE_GAP); len += MERGE_GAP.length; }
        const { pcm } = queue.shift();
        parts.push(pcm);
        len += pcm.length;
      }
      const pcm = new Float32Array(len);
      let off = 0;
      for (const p of parts) { pcm.set(p, off); off += p.length; }
      try {
        const text = (await transcribe(pcm)).text.trim();
        if (text && !isHallucination(text)) onText(speaker, text); // includes segments flushed by stop()
        else onDrop(speaker, "noise");
      } catch (err) {
        console.error("Transcription error:", err);
        onError(err.message);
      }
      busy = false;
      if (warned && !queue.length) { warned = false; onBehind(0); }
      pump();
      settle();
    };

    node.port.onmessage = (e) => {
      if (!running) return;
      const { input, pcm, echo } = e.data;
      const speaker = sources[input].speaker;
      if (echo?.dropped) { onDrop(speaker, "echo", echo); return; }
      queue.push({ speaker, pcm });
      if (queue.length >= BEHIND_AT && !warned) { warned = true; onBehind(queue.length); }
      pump();
    };

    for (const s of sources) for (const t of s.stream.getTracks()) t.addEventListener("ended", () => running && onEnded());

    return {
      async stop() {
        if (!running) return;
        node.port.postMessage("flush"); // send whatever was mid-sentence
        await new Promise((r) => setTimeout(r, 150));
        running = false;
        ctx.close().catch(() => {});
        for (const s of sources) s.stream.getTracks().forEach((t) => t.stop());
      },
      /** Resolves once every segment so far has been transcribed and delivered. */
      settled() {
        return new Promise((resolve) => { waiters.push(resolve); settle(); });
      },
    };
  } catch (err) {
    running = false;
    ctx.close().catch(() => {});
    throw err;
  }
}
