const { app, BrowserWindow, desktopCapturer, ipcMain, screen } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const PORT = parseInt(process.env.PORT, 10) || 3456;
const ENV_PATH = path.join(__dirname, ".env");
let serverProc = null;

function loadEnv() {
  const env = { key: process.env.TYPESAFE_API_KEY || null, model: process.env.ASR_MODEL || null };
  try {
    const txt = fs.readFileSync(ENV_PATH, "utf8");
    const km = txt.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (km && km[1].trim()) env.key = km[1].trim();
    const mm = txt.match(/^ASR_MODEL=(.+)$/m);
    if (mm && mm[1].trim()) env.model = mm[1].trim();
  } catch {}
  return env;
}

function saveEnv(key, model) {
  let lines = [`TYPESAFE_API_KEY=${key}`];
  if (model) lines.push(`ASR_MODEL=${model}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf8");
  process.env.TYPESAFE_API_KEY = key;
  if (model) process.env.ASR_MODEL = model;
}

function probe() {
  return new Promise((resolve) => {
    http
      .get(`http://localhost:${PORT}/api/health`, (res) => resolve(res.statusCode === 200))
      .on("error", () => resolve(false));
  });
}

async function ensureServer() {
  if (await probe()) return;
  serverProc = spawn("node", [path.join(__dirname, "server.mjs")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "inherit",
  });
  serverProc.on("error", (err) => console.error("Server error:", err.message));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await probe()) return;
  }
  console.error("Server did not start within 30 seconds.");
  app.quit();
}

function createCard(card, opts) {
  const win = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    x: opts.x,
    y: opts.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: card !== "hero",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.loadURL(`http://localhost:${PORT}?overlay=1&card=${card}`);
  win.setAlwaysOnTop(true, "screen-saver");
  return win;
}

function showKeyPrompt() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 380,
      height: 310,
      frame: false,
      resizable: false,
      center: true,
      backgroundColor: "#edf0f4",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        sandbox: false,
      },
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
  process.env.TYPESAFE_API_KEY = env.key;
  if (env.model) process.env.ASR_MODEL = env.model;

  await ensureServer();
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const x = width - 330;
  createCard("hero", { width: 310, height: 320, x, y: 50 });
  createCard("next", { width: 310, height: 210, x, y: 380 });
}

app.whenReady().then(launch);

app.on("window-all-closed", () => {
  if (serverProc) serverProc.kill();
  app.quit();
});

ipcMain.on("win-close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});
ipcMain.on("win-minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});
ipcMain.on("win-pin", (event, on) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setAlwaysOnTop(on, on ? "screen-saver" : "normal");
});

ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: { width: 150, height: 150 },
  });
  return sources.map((s) => ({ id: s.id, name: s.name }));
});

let dashWin = null;
ipcMain.on("win-dashboard", () => {
  if (dashWin && !dashWin.isDestroyed()) {
    dashWin.focus();
    return;
  }
  dashWin = new BrowserWindow({
    width: 820,
    height: 560,
    frame: false,
    backgroundColor: "#edf0f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
    },
  });
  dashWin.loadURL(`http://localhost:${PORT}/dashboard.html`);
  dashWin.on("closed", () => { dashWin = null; });
});
