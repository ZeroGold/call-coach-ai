// Draws the app's artwork into build/:
//   icon.png               512x512 app icon (electron-builder makes the .ico from it)
//   installerSidebar.bmp   164x314 sidebar on the installer's welcome and finish pages
//   uninstallerSidebar.bmp the same, for the uninstaller
//   npm run icon

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BUILD = path.join(__dirname, "..", "build");
const R = 150;
const CIRC = 2 * Math.PI * R;
const ARC = CIRC * (240 / 360);

const gauge = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <g transform="rotate(150 256 290)" fill="none" stroke-linecap="round" stroke-width="46">
    <circle cx="256" cy="290" r="${R}" stroke="rgba(255,255,255,0.28)" stroke-dasharray="${ARC} ${CIRC}"/>
    <circle cx="256" cy="290" r="${R}" stroke="#ffffff" stroke-dasharray="${ARC * 0.68} ${CIRC}"/>
  </g>
  <circle cx="256" cy="290" r="34" fill="#ffffff"/>
</svg>`;

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3553e0"/>
      <stop offset="1" stop-color="#1b2c8f"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)"/>
</svg>`;

const page = (body, css = "") => `<html><head><style>html,body{margin:0;overflow:hidden;background:transparent}${css}</style></head><body>${body}</body></html>`;

const ICON_HTML = page(`<div style="position:relative;width:512px;height:512px">${ICON}<div style="position:absolute;inset:0">${gauge(512)}</div></div>`);

const SIDEBAR_HTML = page(`
  <div class="s">
    <div class="glow"></div>
    <div class="mark">${gauge(58)}</div>
    <div class="name">Call Coach</div>
    <div class="tag">A coach for every conversation</div>
    <div class="dots"><i></i><i></i><i></i><i></i></div>
  </div>`, `
  .s { position: relative; width: 164px; height: 314px; overflow: hidden; font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif; color: #fff;
       background: linear-gradient(165deg, #4f5fe8 0%, #6d3fd6 55%, #c0307f 100%); }
  .glow { position: absolute; inset: -40px -60px auto auto; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.35), transparent 65%); }
  .mark { position: absolute; left: 20px; top: 34px; width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center;
          background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.4); box-shadow: inset 0 1px 0 rgba(255,255,255,.45); }
  .mark svg { margin-top: -4px; }
  .name { position: absolute; left: 20px; top: 116px; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .tag { position: absolute; left: 20px; right: 16px; top: 148px; font-size: 12.5px; line-height: 1.35; opacity: .88; }
  .dots { position: absolute; left: 20px; bottom: 26px; display: flex; gap: 5px; }
  .dots i { width: 18px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.35); }
  .dots i:nth-child(1) { background: #c7ccd6; } .dots i:nth-child(2) { background: #aab3ff; } .dots i:nth-child(3) { background: #7fe0ea; } .dots i:nth-child(4) { background: #8ee6b4; }`);

// 24-bit BMP (what NSIS needs): bottom-up rows of BGR, each padded to 4 bytes
function toBmp(image) {
  const { width, height } = image.getSize();
  const bgra = image.toBitmap(); // BGRA, top-down
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const data = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4, d = (height - 1 - y) * rowSize + x * 3;
      data[d] = bgra[s]; data[d + 1] = bgra[s + 1]; data[d + 2] = bgra[s + 2];
    }
  }
  const header = Buffer.alloc(54);
  header.write("BM", 0);
  header.writeUInt32LE(54 + data.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(data.length, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);
  return Buffer.concat([header, data]);
}

async function render(html, width, height, transparent) {
  const win = new BrowserWindow({ width, height, show: false, frame: false, transparent, useContentSize: true, webPreferences: { offscreen: true } });
  const file = path.join(os.tmpdir(), `call-coach-art-${width}x${height}.html`);
  fs.writeFileSync(file, html);
  await win.loadFile(file);
  fs.rmSync(file, { force: true });
  await new Promise((r) => setTimeout(r, 500)); // let it paint
  const image = (await win.webContents.capturePage()).resize({ width, height, quality: "best" });
  win.destroy();
  return image;
}

app.disableHardwareAcceleration();
app.on("window-all-closed", () => {}); // keep going between renders
app.whenReady().then(async () => {
  setTimeout(() => { console.error("Timed out drawing the artwork."); app.exit(1); }, 30000);
  fs.mkdirSync(BUILD, { recursive: true });
  const icon = await render(ICON_HTML, 512, 512, true);
  fs.writeFileSync(path.join(BUILD, "icon.png"), icon.toPNG());
  fs.writeFileSync(path.join(__dirname, "..", "public", "icon.png"), icon.resize({ width: 128, height: 128, quality: "best" }).toPNG());
  const sidebar = toBmp(await render(SIDEBAR_HTML, 164, 314, false));
  fs.writeFileSync(path.join(BUILD, "installerSidebar.bmp"), sidebar);
  fs.writeFileSync(path.join(BUILD, "uninstallerSidebar.bmp"), sidebar);
  console.log(`Wrote icon.png, installerSidebar.bmp and uninstallerSidebar.bmp in ${BUILD}`);
  app.quit();
});
