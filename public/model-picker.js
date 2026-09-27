// The speech model picker, shared by Settings and the dashboard.
// On the desktop app (and self-hosted servers) the model runs on the server; on a
// hosted site it runs in this browser, so the choice is saved here instead.

import { BROWSER_MODELS, browserModel, setBrowserModel, speechLocation, onModelProgress } from "/transcriber.js";

export async function mountModelPicker(listEl, statusEl) {
  const place = await speechLocation();
  if (place === "off") {
    listEl.replaceChildren();
    statusEl.textContent = "Speech recognition is turned off on this server.";
    return;
  }
  if (place === "browser") return mountBrowser(listEl, statusEl);
  return mountServer(listEl, statusEl);
}

function option(m, active, onPick) {
  const div = document.createElement("button");
  div.type = "button";
  div.className = "model-opt" + (active ? " active" : "");
  div.dataset.id = m.id;
  div.setAttribute("aria-pressed", String(active));
  div.append(
    Object.assign(document.createElement("span"), { className: "model-name", textContent: m.label }),
    ` ${m.desc}`,
    Object.assign(document.createElement("span"), { className: "model-size", textContent: m.size }),
  );
  div.addEventListener("click", () => onPick(m.id));
  return div;
}

function mark(listEl, id, cls = "active") {
  for (const o of listEl.querySelectorAll(".model-opt")) {
    o.classList.toggle(cls, o.dataset.id === id);
    if (cls === "active") o.setAttribute("aria-pressed", String(o.dataset.id === id));
  }
}

function progressBar(statusEl, label, pct) {
  const bar = Object.assign(document.createElement("div"), { className: "model-bar" });
  bar.append(Object.assign(document.createElement("div"), { className: "model-bar-fill", style: `width:${pct}%` }));
  statusEl.replaceChildren(`${label}... ${pct}%`, bar);
}

/* ---------- In the browser (hosted site) ---------- */
function mountBrowser(listEl, statusEl) {
  const render = () => {
    const current = browserModel();
    listEl.replaceChildren(...BROWSER_MODELS.map((m) => option(m, m.id === current, (id) => { setBrowserModel(id); render(); })));
    statusEl.textContent = "Runs in this browser, so audio never leaves your computer. It downloads the first time you use speech.";
  };
  render();
  onModelProgress((p) => {
    if (p.ready) statusEl.textContent = "Loaded and ready";
    else progressBar(statusEl, `Downloading ${p.model.split("/").pop()}`, p.pct);
  });
}

/* ---------- On the server (desktop app) ---------- */
async function mountServer(listEl, statusEl) {
  let pollTimer = null;
  const stopPoll = () => { clearInterval(pollTimer); pollTimer = null; };

  const showProgress = (p) => {
    if (p.status === "downloading") progressBar(statusEl, `Downloading ${p.model.split("/").pop()}`, p.pct);
    else if (p.status === "ready") { statusEl.textContent = "Loaded and ready"; mark(listEl, null, "loading"); stopPoll(); load(); }
    else if (p.status === "error") { statusEl.textContent = "Error: " + (p.error || "failed to load"); mark(listEl, null, "loading"); stopPoll(); }
  };
  const startPoll = () => {
    stopPoll();
    pollTimer = setInterval(async () => {
      try { showProgress(await (await fetch("/api/models/progress")).json()); } catch {}
    }, 800);
  };

  async function pick(id) {
    mark(listEl, id);
    statusEl.textContent = "Switching...";
    try {
      const res = await fetch("/api/models/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: id }) });
      const data = await res.json();
      if (data.error) { statusEl.textContent = data.error; return; }
      if (data.status === "already_loaded") { statusEl.textContent = "Already loaded"; return; }
      mark(listEl, id, "loading");
      startPoll();
    } catch (err) {
      statusEl.textContent = "Error: " + err.message;
    }
  }

  async function load() {
    try {
      const data = await (await fetch("/api/models")).json();
      listEl.replaceChildren(...data.models.map((m) => option(m, m.id === data.current, pick)));
      if (data.progress?.status === "downloading") { showProgress(data.progress); startPoll(); }
      else if (data.loaded) statusEl.textContent = data.loaded === data.current ? "Loaded and ready" : "Will load on next transcription";
      else statusEl.textContent = "Downloads on first use";
    } catch {
      statusEl.textContent = "Can't reach the local server.";
    }
  }
  await load();
}
