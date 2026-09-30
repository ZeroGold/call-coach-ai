const { app, BrowserWindow, desktopCapturer, ipcMain, screen, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const PORT = parseInt(process.env.PORT, 10) || 3456;
const BASE = `http://localhost:${PORT}`;

// Settings live in the user's app data folder, since an installed app's own
// folder is read-only. When running from source, a .env next to this file also works.
const DATA_DIR = app.getPath("userData");
const USER_ENV = path.join(DATA_DIR, "call-coach.env");
const SOURCE_ENV = path.join(__dirname, ".env");
const WINDOW_STATE = path.join(DATA_DIR, "window-state.json");
let serverProc = null;

if (!app.requestSingleInstanceLock()) app.quit();

/* ---------- Key and settings ---------- */
function readEnvFile(file, env) {
  try {
    const txt = fs.readFileSync(file, "utf8");
    const km = txt.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (km && km[1].trim()) env.key = km[1].trim();
    const mm = txt.match(/^ASR_MODEL=(.+)$/m);
    if (mm && mm[1].trim()) env.model = mm[1].trim();
  } catch {}
}

function loadEnv() {
  const env = { key: process.env.TYPESAFE_API_KEY || null, model: process.env.ASR_MODEL || null };
  if (!app.isPackaged) readEnvFile(SOURCE_ENV, env);
  readEnvFile(USER_ENV, env);
  return env;
}

function saveEnv(key, model) {
  const lines = [`TYPESAFE_API_KEY=${key}`];
  if (model) lines.push(`ASR_MODEL=${model}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USER_ENV, lines.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
}

/* ---------- Server ---------- */
function probe() {
  return new Promise((resolve) => {
    http.get(`${BASE}/api/health`, (res) => { res.resume(); resolve(res.statusCode === 200); }).on("error", () => resolve(false));
  });
}

async function ensureServer(env) {
  if (await probe()) return true;
  // Electron's own Node runs the server, so an installed copy doesn't need Node.js
  const log = fs.createWriteStream(path.join(DATA_DIR, "server.log"), { flags: "w" });
  serverProc = spawn(process.execPath, [path.join(__dirname, "server.mjs")], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      TYPESAFE_API_KEY: env.key,
      ...(env.model && { ASR_MODEL: env.model }),
      // Installed copies keep downloaded speech models in app data; source checkouts reuse node_modules
      ...(app.isPackaged && { CALL_COACH_DATA: DATA_DIR }),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProc.stdout.pipe(log);
  serverProc.stderr.pipe(log);
  if (!app.isPackaged) { serverProc.stdout.pipe(process.stdout); serverProc.stderr.pipe(process.stderr); }
  serverProc.on("error", (err) => log.write(`Server error: ${err.message}\n`));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await probe()) return true;
  }
  return false;
}

/* ---------- Windows ---------- */
const webPreferences = { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: false };
let overlayWin = null, dashWin = null, practiceWin = null, settingsWin = null;

function savedBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(WINDOW_STATE, "utf8"));
    // Only reuse the position if it's still on a connected screen
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x >= a.x - 50 && b.y >= a.y - 50 && b.x + 100 <= a.x + a.width && b.y + 60 <= a.y + a.height;
    });
    return visible ? b : null;
  } catch {
    return null;
  }
}

// Windows 11 (22H2+) can blur whatever is behind a window with its Acrylic material.
// It's opt-in (CALL_COACH_GLASS=1): Windows draws Acrylic as flat gray whenever the
// window isn't focused, and during a call the focus is on the call app. By default the
// window is transparent and the page draws solid cards, which read well over anything.
const OS_GLASS = process.platform === "win32" && process.env.CALL_COACH_GLASS === "1"
  && Number(process.getSystemVersion().split(".")[2] || 0) >= 22621;

// The floating coach: one window with both cards, on top of the call
function openOverlay(mode) {
  const url = `${BASE}/?overlay=1${OS_GLASS ? "&glass=os" : ""}${mode ? `&mode=${encodeURIComponent(mode)}` : ""}`;
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.loadURL(url);
    overlayWin.show();
    overlayWin.focus();
    return overlayWin;
  }
  const { width } = screen.getPrimaryDisplay().workArea;
  const bounds = savedBounds() || { width: 340, height: 600, x: width - 360, y: 40 };
  overlayWin = new BrowserWindow({
    ...bounds,
    minWidth: 280,
    minHeight: 220,
    title: "Call Coach",
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    backgroundColor: "#00000000",
    // Acrylic needs an opaque window with a clear background; elsewhere the window is
    // transparent and the page draws solid cards
    ...(OS_GLASS ? { transparent: false, backgroundMaterial: "acrylic" } : { transparent: true, hasShadow: false }),
    webPreferences,
  });
  overlayWin.loadURL(url);
  overlayWin.setAlwaysOnTop(true, "screen-saver");
  let saveTimer;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!overlayWin || overlayWin.isDestroyed()) return;
      try { fs.writeFileSync(WINDOW_STATE, JSON.stringify(overlayWin.getBounds())); } catch {}
    }, 400);
  };
  overlayWin.on("move", save);
  overlayWin.on("resize", save);
  overlayWin.on("closed", () => { overlayWin = null; });
  return overlayWin;
}

// Show a window, reusing it if it's already open. onClosed runs once, when it closes.
function openWindow(current, url, opts, onClosed) {
  if (current && !current.isDestroyed()) {
    if (current.webContents.getURL() !== url) current.loadURL(url);
    current.show();
    current.focus();
    return current;
  }
  const win = new BrowserWindow({ backgroundColor: "#edf0f4", autoHideMenuBar: true, webPreferences, ...opts });
  win.loadURL(url);
  win.on("closed", onClosed);
  return win;
}

// Practice modes don't float over a call, so they get a regular window
function openPractice(mode) {
  practiceWin = openWindow(practiceWin, `${BASE}/?mode=${encodeURIComponent(mode)}`, { width: 1100, height: 780, title: "Call Coach practice" }, () => { practiceWin = null; });
}

function showKeyPrompt() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 560,
      height: 660,
      frame: false,
      resizable: false,
      center: true,
      title: "Welcome to Call Coach",
      backgroundColor: "#edf0f4",
      webPreferences,
    });
    win.loadFile(path.join(__dirname, "public", "setup-key.html"));
    ipcMain.once("submit-key", (_event, key, model) => {
      saveEnv(key, model);
      win.close();
      resolve({ key, model });
    });
    win.on("closed", () => resolve(null));
  });
}

async function launch() {
  const env = loadEnv();
  if (!env.key) {
    const result = await showKeyPrompt();
    if (!result) { app.quit(); return; }
    env.key = result.key;
    env.model = result.model;
  }
  if (!(await ensureServer(env))) {
    const { dialog } = require("electron");
    dialog.showErrorBox("Call Coach couldn't start", `The coaching server didn't start. Details are in:\n${path.join(DATA_DIR, "server.log")}`);
    app.quit();
    return;
  }
  openOverlay();
}

app.whenReady().then(launch);

app.on("second-instance", () => {
  const win = overlayWin || BrowserWindow.getAllWindows()[0];
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
});

app.on("window-all-closed", () => {
  if (serverProc) serverProc.kill();
  app.quit();
});

/* ---------- Requests from pages ---------- */
const validMode = (m) => typeof m === "string" && /^[a-z0-9-]{1,64}$/.test(m);

ipcMain.on("win-close", (event) => BrowserWindow.fromWebContents(event.sender)?.close());
ipcMain.on("win-minimize", (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on("win-pin", (event, on) => BrowserWindow.fromWebContents(event.sender)?.setAlwaysOnTop(on, on ? "screen-saver" : "normal"));

ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: { width: 150, height: 150 },
  });
  return sources.map((s) => ({ id: s.id, name: s.name }));
});

ipcMain.on("win-dashboard", () => {
  dashWin = openWindow(dashWin, `${BASE}/dashboard.html`, { width: 820, height: 560, frame: false, title: "Call Coach dashboard" }, () => { dashWin = null; });
});

ipcMain.on("open-practice", (_event, mode) => { if (validMode(mode)) openPractice(mode); });

// Links out of the app open in the user's browser; only known sites are allowed
ipcMain.on("open-external", (_event, url) => {
  if (typeof url === "string" && /^https:\/\/(www\.)?typesafe\.ai(\/|$)/.test(url)) shell.openExternal(url);
});

ipcMain.on("open-settings", (_event, hash) => {
  const h = typeof hash === "string" && /^#[a-z0-9=-]*$/i.test(hash) ? hash : "";
  settingsWin = openWindow(settingsWin, `${BASE}/settings.html${h}`, { width: 980, height: 820, title: "Call Coach settings" }, () => { settingsWin = null; });
});

// "Use it now" in Settings: practice opens its own window; a live coach takes over the overlay
ipcMain.on("use-coach", (_event, mode, kind) => {
  if (!validMode(mode)) return;
  if (kind === "rehearsal") openPractice(mode);
  else openOverlay(mode);
});
