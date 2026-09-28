// Audio worklet that cuts each input stream into speech segments at natural pauses.
//
// Every input shares one clock (they live in the same AudioContext), so frame N
// on input 0 happened at the same moment as frame N on input 1. That lets a mic
// segment be compared against the call audio playing at the same time, to spot
// the mic picking up the customer through the speakers (echo).
//
// Posts { type: "segment", input, pcm, startFrame, endFrame, echo } for each finished
// segment. `echo` is null unless the input was given a reference via `echoRefs`; when
// the segment is judged to be echo, `echo.dropped` is true and there is no `pcm`.
//
// Inputs listed in `watch` also report, for live feedback while someone talks:
//   { type: "level", input, level }    loudness, about 11 times a second (for a meter)
//   { type: "vad", input, on }         started or stopped talking (300 ms of quiet = stopped)
//   { type: "partial", input, pcm }    the phrase so far, about once a second, for a live transcript

const FRAME = 480;               // 30 ms at 16 kHz
const START_FRAMES = 3;          // ~90 ms above threshold opens a segment
const END_SILENCE_FRAMES = 23;   // ~700 ms of quiet closes it
const PREROLL_FRAMES = 10;       // keep 300 ms before the start so the first word isn't clipped
const MAX_FRAMES = 400;          // 12 s cap; longer speech is cut and continued
const MIN_SPEECH_FRAMES = 8;     // under ~240 ms of speech is dropped as a click or cough
const ABS_MIN = 0.004;           // never treat anything quieter than this as speech
const FLOOR_MULT = 3;            // speech must be this many times louder than the noise floor
const RELEASE = 0.7;             // once speaking, stay open down to 70% of the threshold
const HISTORY = 640;             // ~19 s of per-frame levels kept for echo checks
const MAX_LAG = 12;              // echo can arrive up to ~360 ms after the call audio
const REVERB_FRAMES = 8;         // the room keeps ringing ~240 ms after the call audio stops
const OWN_MARGIN = 2.5;          // ~8 dB louder than the echo explains = someone at the mic is talking
const ECHO_GAIN_PCT = 0.2;       // echo gain is read from the quietest 20% of mic/call ratios

const LEVEL_EVERY = 3;           // a level reading every ~90 ms
const VAD_OFF_FRAMES = 10;       // ~300 ms of quiet counts as having stopped talking
const PARTIAL_EVERY = 30;        // a live transcript snapshot every ~900 ms

const DEFAULT_ECHO = { minCorr: 0.6, minOverlap: 0.6, minOwnFrames: 10 };

class Segmenter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const n = options.numberOfInputs;
    this.echoRefs = options.processorOptions?.echoRefs || {};
    this.echoCfg = { ...DEFAULT_ECHO, ...options.processorOptions?.echo };
    this.watch = new Set(options.processorOptions?.watch || []);
    this.fill = 0;
    this.frame = 0;
    this.inputs = Array.from({ length: n }, () => ({
      buf: new Float32Array(FRAME),
      floor: ABS_MIN,
      preroll: [],
      open: false,
      chunks: [], levels: [], active: [],
      start: 0, above: 0, silence: 0, speech: 0,
      talking: false, sinceSnapshot: 0,
      level: new Float32Array(HISTORY),
      speaking: new Uint8Array(HISTORY),
    }));
    this.port.onmessage = (e) => { if (e.data === "flush") this.inputs.forEach((s, i) => s.open && this.close(i)); };
  }

  process(inputs) {
    const len = inputs[0]?.[0]?.length || inputs.find((x) => x[0])?.[0].length || 128;
    let off = 0;
    while (off < len) {
      const take = Math.min(FRAME - this.fill, len - off);
      for (let i = 0; i < this.inputs.length; i++) {
        const ch = inputs[i]?.[0];
        const buf = this.inputs[i].buf;
        if (ch) buf.set(ch.subarray(off, off + take), this.fill);
        else buf.fill(0, this.fill, this.fill + take);
      }
      this.fill += take;
      off += take;
      if (this.fill === FRAME) {
        for (let i = 0; i < this.inputs.length; i++) this.step(i);
        this.fill = 0;
        this.frame++;
      }
    }
    return true;
  }

  step(i) {
    const s = this.inputs[i];
    let sum = 0;
    for (let k = 0; k < FRAME; k++) sum += s.buf[k] * s.buf[k];
    const rms = Math.sqrt(sum / FRAME);
    const thr = Math.max(ABS_MIN, s.floor * FLOOR_MULT);
    const loud = rms >= (s.open ? thr * RELEASE : thr);
    const frame = s.buf.slice();

    const h = this.frame % HISTORY;
    s.level[h] = rms;
    s.speaking[h] = loud ? 1 : 0;

    if (!s.open) {
      if (!loud) s.floor = 0.95 * s.floor + 0.05 * rms;
      s.above = loud ? s.above + 1 : 0;
      s.preroll.push(frame);
      if (s.preroll.length > PREROLL_FRAMES) s.preroll.shift();
      if (s.above >= START_FRAMES) {
        s.open = true;
        s.start = this.frame - s.preroll.length + 1;
        s.chunks = s.preroll;
        s.levels = s.chunks.map((f) => rmsOf(f));
        s.active = s.chunks.map((_, k) => k >= s.chunks.length - START_FRAMES);
        s.preroll = [];
        s.speech = START_FRAMES;
        s.silence = 0;
      }
    } else {
      s.chunks.push(frame);
      s.levels.push(rms);
      s.active.push(loud);
      if (loud) { s.speech++; s.silence = 0; } else s.silence++;

      if (s.silence >= END_SILENCE_FRAMES) this.close(i);
      else if (s.chunks.length >= MAX_FRAMES) { this.close(i); s.open = true; s.start = this.frame + 1; s.speech = 0; s.silence = 0; }
    }

    if (this.watch.has(i)) this.report(i, s, rms);
  }

  // Live feedback for a watched input: a level meter, talking on/off, and the phrase so far
  report(i, s, rms) {
    if (this.frame % LEVEL_EVERY === 0) this.port.postMessage({ type: "level", input: i, level: rms });
    const talking = s.open && s.silence < VAD_OFF_FRAMES;
    if (talking !== s.talking) {
      s.talking = talking;
      s.sinceSnapshot = 0;
      this.port.postMessage({ type: "vad", input: i, on: talking });
    }
    if (talking && ++s.sinceSnapshot >= PARTIAL_EVERY && s.speech >= MIN_SPEECH_FRAMES) {
      s.sinceSnapshot = 0;
      const pcm = new Float32Array(s.chunks.length * FRAME);
      s.chunks.forEach((c, k) => pcm.set(c, k * FRAME));
      this.port.postMessage({ type: "partial", input: i, pcm }, [pcm.buffer]);
    }
  }

  close(i) {
    const s = this.inputs[i];
    s.open = false;
    s.above = 0;
    const endFrame = s.start + s.chunks.length;
    // Trim the trailing silence, keeping a little tail so the last word isn't clipped
    let from = 0;
    let to = Math.max(1, s.chunks.length - Math.max(0, s.silence - PREROLL_FRAMES));
    const speech = s.speech;
    const echo = this.echoRefs[i] != null ? this.echoCheck(s, this.inputs[this.echoRefs[i]]) : null;
    const chunks = s.chunks;
    s.chunks = []; s.levels = []; s.active = []; s.speech = 0; s.silence = 0;
    if (speech < MIN_SPEECH_FRAMES) return;
    if (echo?.dropped) { this.port.postMessage({ type: "segment", input: i, startFrame: s.start, endFrame, echo }); return; }
    if (echo?.crop) { from = Math.max(0, echo.first - PREROLL_FRAMES); to = Math.min(to, echo.last + PREROLL_FRAMES + 1); }

    const pcm = new Float32Array((to - from) * FRAME);
    for (let k = from; k < to; k++) pcm.set(chunks[k], (k - from) * FRAME);
    this.port.postMessage({ type: "segment", input: i, pcm, startFrame: s.start + from, endFrame, echo }, [pcm.buffer]);
  }

  // Does this segment contain anything besides the reference input played back
  // through the speakers?
  //   corr:    best correlation of the two loudness envelopes over 0..MAX_LAG frames
  //   overlap: share of this segment's speech frames where the reference was also speaking
  //   own:     speech frames clearly louder than the echo explains (someone talking at the mic)
  // It's echo when it tracks the reference closely and has almost no speech of its own.
  // When echo is present but so is real speech (talking over the customer), the
  // segment is kept and cropped to the real speech.
  echoCheck(s, ref) {
    const n = s.levels.length;
    if (n > HISTORY - MAX_LAG - REVERB_FRAMES) return null;
    const at = (k) => (((s.start + k) % HISTORY) + HISTORY) % HISTORY;
    const own = s.levels.map((v) => Math.log10(v + 1e-5));

    let corr = -1, overlap = 0, lag = 0;
    for (let l = 0; l <= MAX_LAG; l++) {
      const other = new Array(n);
      let hits = 0, spoken = 0;
      for (let k = 0; k < n; k++) {
        const h = at(k - l);
        other[k] = Math.log10(ref.level[h] + 1e-5);
        if (s.active[k]) { spoken++; if (ref.speaking[h]) hits++; }
      }
      const c = pearson(own, other);
      if (c > corr) { corr = c; overlap = spoken ? hits / spoken : 0; lag = l; }
    }

    // Echo gain: how loud the mic is relative to the call audio when it's only hearing echo
    const ratios = [];
    for (let k = 0; k < n; k++) {
      const h = at(k - lag);
      if (s.active[k] && ref.speaking[h]) ratios.push(s.levels[k] / (ref.level[h] + 1e-6));
    }
    ratios.sort((a, b) => a - b);
    const gain = ratios.length ? ratios[Math.floor(ECHO_GAIN_PCT * (ratios.length - 1))] : 0;

    // Frames louder than the loudest recent call audio could make them
    let ownFrames = 0, first = -1, last = -1;
    for (let k = 0; k < n; k++) {
      if (!s.active[k]) continue;
      let recent = 0;
      for (let r = 0; r <= REVERB_FRAMES; r++) recent = Math.max(recent, ref.level[at(k - lag - r)]);
      if (s.levels[k] > OWN_MARGIN * gain * recent) {
        ownFrames++;
        if (first < 0) first = k;
        last = k;
      }
    }

    const cfg = this.echoCfg;
    const heard = corr >= cfg.minCorr && overlap >= cfg.minOverlap;
    const round = (v) => Math.round(v * 100) / 100;
    return {
      corr: round(corr), overlap: round(overlap), own: ownFrames,
      dropped: heard && ownFrames < cfg.minOwnFrames,
      crop: heard && ownFrames >= cfg.minOwnFrames,
      first, last,
    };
  }
}

function rmsOf(f) {
  let sum = 0;
  for (let k = 0; k < f.length; k++) sum += f[k] * f[k];
  return Math.sqrt(sum / f.length);
}

function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let k = 0; k < n; k++) { ma += a[k]; mb += b[k]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let k = 0; k < n; k++) {
    const x = a[k] - ma, y = b[k] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

registerProcessor("segmenter", Segmenter);
