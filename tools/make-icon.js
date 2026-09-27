// Renders the app icon (build/icon.png, 512x512) from the SVG below.
//   npm run icon
// electron-builder turns it into the Windows .ico when packaging.

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const SIZE = 512;
const R = 150;
const CIRC = 2 * Math.PI * R;
const ARC = CIRC * (240 / 360);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3553e0"/>
      <stop offset="1" stop-color="#1b2c8f"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)"/>
  <g transform="rotate(150 256 290)" fill="none" stroke-linecap="round" stroke-width="46">
    <circle cx="256" cy="290" r="${R}" stroke="rgba(255,255,255,0.28)" stroke-dasharray="${ARC} ${CIRC}"/>
    <circle cx="256" cy="290" r="${R}" stroke="#ffffff" stroke-dasharray="${ARC * 0.68} ${CIRC}"/>
  </g>
  <circle cx="256" cy="290" r="34" fill="#ffffff"/>
</svg>`;

app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  win.webContents.on("did-finish-load", async () => {
    await new Promise((r) => setTimeout(r, 500)); // let it paint
    const image = (await win.webContents.capturePage()).resize({ width: SIZE, height: SIZE, quality: "best" });
    const out = path.join(__dirname, "..", "build", "icon.png");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, image.toPNG());
    console.log(`Wrote ${out}`);
    app.quit();
  });
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`;
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  setTimeout(() => { console.error("Timed out rendering the icon."); app.exit(1); }, 15000);
});
