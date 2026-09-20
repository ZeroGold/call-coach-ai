// Local decision layer.
// Jev returns a probability for every next-step option. This code decides which
// ONE the rep sees, so the screen stays steady and follows your playbook:
//
//   1. Skip options the rep marked done (for a cooldown) or that a rule blocks.
//   2. Rescale the remaining probabilities so they add up to 1 again.
//   3. Treat near-ties as ties and break them with the playbook priority.
//   4. Keep the current suggestion unless a challenger clearly beats it
//      or stays on top for several updates in a row (stops flickering).
//   5. Only suggest an action at or above the minimum score; otherwise "keep listening".

export const DEFAULT_CONFIG = {
  minScore: 0.4,          // below this, the screen says "Keep listening" (8 options, so 40% is a clear lead)
  tieMargin: 0.08,        // options within 8 points of the leader count as tied
  switchMargin: 0.12,     // a challenger must lead the current suggestion by this much to replace it at once...
  confirmUpdates: 2,      // ...or stay on top for this many updates in a row
  minRemaining: 0.3,      // if skipped options held over 70% of the probability, the rest is too thin to trust
  doneCooldownMs: 3 * 60 * 1000,
  signalMin: 0.6,         // default threshold for a signal-based tip

  // Buying stage
  stageSmoothing: 0.8,    // weight of the newest reading (1 = no smoothing)
  stageHysteresis: 0.05,  // the score must pass a stage boundary by this much before the stage changes
  confidenceHigh: 0.7,    // Jev's Score confidence at or above this reads "High confidence"
  confidenceMedium: 0.45  // ...at or above this "Medium", below it "Low"
};

export function createMemory() {
  return { current: null, challenger: null, streak: 0, done: {}, stage: createStageMemory() };
}

export function createStageMemory() {
  return { smoothed: null, level: null, from: null };
}

/**
 * Turn Jev's buying-stage Score into a steady reading for the screen.
 * - Smooths the score across updates so one sentence can't swing it.
 * - Changes the stage only when the score passes a boundary by `stageHysteresis`,
 *   and keeps the displayed position inside the displayed stage so the marker,
 *   the stage name, and the buying score always agree.
 * - Reports how spread out Jev's probabilities are, for drawing uncertainty.
 * Returns { level, label, position, buyingScore, spread, confidence, confidenceLabel, trend, from, changed }
 */
export function trackStage(answer, mem, labels, config = DEFAULT_CONFIG) {
  if (!answer || typeof answer.score !== "number" || !labels?.length) return null;
  const max = labels.length - 1;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const raw = clamp(answer.score, 0, max);
  mem.smoothed = mem.smoothed == null ? raw : config.stageSmoothing * raw + (1 - config.stageSmoothing) * mem.smoothed;

  let changed = false;
  if (mem.level == null) {
    mem.level = Math.round(mem.smoothed);
    changed = true;
  } else if (Math.abs(mem.smoothed - mem.level) > 0.5 + config.stageHysteresis) {
    mem.from = mem.level;
    mem.level = clamp(Math.round(mem.smoothed), 0, max);
    changed = true;
  }

  // Keep the displayed position inside the displayed stage
  const position = clamp(mem.smoothed, mem.level - 0.5, mem.level + 0.5);

  // Spread (standard deviation, in stages) of Jev's probabilities across the levels
  const probs = labels.map((_, i) => Number(answer.probabilities?.[String(i)] ?? 0));
  const total = probs.reduce((a, b) => a + b, 0) || 1;
  const mean = probs.reduce((acc, p, i) => acc + p * i, 0) / total;
  const spread = Math.sqrt(probs.reduce((acc, p, i) => acc + p * (i - mean) ** 2, 0) / total);

  const confidence = typeof answer.confidence === "number" ? answer.confidence : null;
  const confidenceLabel = confidence == null ? null
    : confidence >= config.confidenceHigh ? "High confidence"
    : confidence >= config.confidenceMedium ? "Medium confidence"
    : "Low confidence";

  return {
    level: mem.level,
    label: labels[mem.level],
    position,
    buyingScore: Math.round((clamp(position, 0, max) / max) * 100),
    spread,
    confidence,
    confidenceLabel,
    trend: mem.from == null ? null : mem.level > mem.from ? "up" : "down",
    from: mem.from == null ? null : labels[mem.from],
    changed
  };
}

/** Mark an action done so it's skipped for the cooldown period. */
export function markDone(memory, action, now = Date.now(), config = DEFAULT_CONFIG) {
  memory.done[action] = now + config.doneCooldownMs;
  if (memory.current === action) memory.current = null;
  memory.challenger = null;
  memory.streak = 0;
}

/** Pick up to `max` tips: signal-specific ones first, then general ones. */
export function pickTips(action, signals, max = 3, config = DEFAULT_CONFIG) {
  if (!action?.tips) return [];
  const specific = (action.tips.when || [])
    .filter((t) => {
      const v = signals[t.signal];
      if (v == null) return false;
      if (t.max != null) return v <= t.max;
      return v >= (t.min ?? config.signalMin);
    })
    .map((t) => t.text);
  return [...specific, ...(action.tips.always || [])].slice(0, max);
}

/**
 * Decide what to show. `answers` is the Jev response's `answers` object.
 * Returns either
 *   { status: "act", action, title, score, tips, changed, note }
 *   { status: "listen", leaning, leaningTitle, score, tips, note }
 * `memory` is updated in place so the next call can apply the stability rules.
 */
export function decide(answers, playbook, memory, now = Date.now(), config = DEFAULT_CONFIG) {
  const nba = answers?.next_best_action;
  if (!nba?.probabilities) throw new Error("Response has no next_best_action probabilities.");

  const signals = {};
  for (const [key, a] of Object.entries(answers)) if (a?.type === "noul") signals[key] = a.noul;

  // 1. Skip done and blocked options
  const skipped = new Set();
  for (const [key, until] of Object.entries(memory.done)) {
    if (until > now) skipped.add(key);
    else delete memory.done[key];
  }
  const blockNotes = {};
  for (const rule of playbook.rules || []) {
    if (!rule.when(signals)) continue;
    for (const key of rule.block) { skipped.add(key); blockNotes[key] = rule.note; }
  }

  // Note shown when a rule overrode what the model ranked first
  const rawTop = Object.entries(nba.probabilities).sort((a, b) => b[1] - a[1])[0]?.[0];
  const note = blockNotes[rawTop] || null;

  // 2. Rescale what's left
  const kept = Object.entries(nba.probabilities).filter(([k]) => !skipped.has(k));
  const remaining = kept.reduce((sum, [, p]) => sum + p, 0);
  if (!kept.length || remaining < config.minRemaining) {
    memory.current = null;
    return listen(playbook, null, 0, note);
  }
  const probs = Object.fromEntries(kept.map(([k, p]) => [k, p / remaining]));

  // 3. Leader, with near-ties broken by playbook priority
  const rank = (k) => {
    const i = (playbook.priority || []).indexOf(k);
    return i === -1 ? Infinity : i;
  };
  const best = Math.max(...Object.values(probs));
  const top = Object.entries(probs)
    .filter(([, p]) => p >= best - config.tieMargin)
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])[0][0];

  // 4. Stability: hold the current suggestion unless it's clearly beaten
  let chosen = top;
  const cur = memory.current;
  const curStillValid = cur && cur !== top && probs[cur] != null && probs[cur] >= config.minScore;
  if (curStillValid) {
    memory.streak = memory.challenger === top ? memory.streak + 1 : 1;
    memory.challenger = top;
    const clearlyBetter = probs[top] - probs[cur] >= config.switchMargin;
    if (!clearlyBetter && memory.streak < config.confirmUpdates) chosen = cur;
  }
  if (chosen === top) { memory.challenger = null; memory.streak = 0; }

  // 5. Minimum score
  const score = probs[chosen];
  if (chosen === "no_action" || score < config.minScore) {
    memory.current = null;
    return listen(playbook, chosen === "no_action" ? null : chosen, score, note);
  }

  const changed = chosen !== cur;
  memory.current = chosen;
  const action = playbook.actions[chosen];
  return {
    status: "act",
    action: chosen,
    title: action?.title || chosen,
    score,
    tips: pickTips(action, signals, 3, config),
    changed,
    note
  };
}

function listen(playbook, leaning, score, note) {
  return {
    status: "listen",
    leaning,
    leaningTitle: leaning ? playbook.actions[leaning]?.title || leaning : null,
    score,
    tips: playbook.listeningTips || [],
    note
  };
}
