// Shared interface pieces: icons, toasts, menus, the segmented control, the
// pointer spotlight, view transitions, and the Ctrl+K command palette.

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Icons (24px, stroke) ---------- */
const P = {
  logo: '<path d="M4.5 16.5a8 8 0 1 1 15 0"/><path d="M12 12.5 15.5 9"/><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  settings: '<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9c.8.7 1.6 1.2 2.6 1.5l.4 2.4h4l.4-2.4c1-.3 1.8-.8 2.6-1.5l2.4.9 2-3.4-2-1.6Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  chat: '<path d="M4 5.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H9l-4 3.5V15a2 2 0 0 1-1-1.7V7.5a2 2 0 0 1 2-2Z"/><path d="M17 9h1.5a2 2 0 0 1 2 2v4.8a2 2 0 0 1-1 1.7V20l-3-2.5H12"/>',
  sparkle: '<path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15A2 2 0 0 0 9 13.8L3.5 12 9 10.2A2 2 0 0 0 10.2 9L12 3.5Z"/>',
  headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4" height="6" rx="1.6"/><rect x="17" y="13.5" width="4" height="6" rx="1.6"/><path d="M20 19.5c0 1.4-1.8 2-4 2h-2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/>',
  popout: '<path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  dashboard: '<rect x="3.5" y="3.5" width="7" height="8" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.8"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.8"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.8"/>',
  capture: '<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="11" r="2.4" fill="currentColor" stroke="none"/>',
  auto: '<path d="M4 12a8 8 0 0 1 14.5-4.6M20 12a8 8 0 0 1-14.5 4.6"/><path d="M18.5 3v4.4h-4.4M5.5 21v-4.4h4.4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 6l2.5 2.5M14 8l2 2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2h.01"/>',
};
export function icon(name, cls = "") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}
/** Replaces [data-icon] placeholders with their SVG. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) {
    el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
    el.removeAttribute("data-icon");
  }
}

/* ---------- Theme (shared across windows) ---------- */
const themeChannel = new BroadcastChannel("call-coach-theme");
const themeListeners = new Set();
export const getTheme = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
export function setTheme(t, broadcast = true) {
  t = t === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("cc-theme", t); } catch {}
  themeListeners.forEach((fn) => fn(t));
  if (broadcast) themeChannel.postMessage({ theme: t });
}
export function onTheme(fn) { themeListeners.add(fn); fn(getTheme()); }
themeChannel.onmessage = (e) => e.data?.theme && setTheme(e.data.theme, false);
export const toggleTheme = () => setTheme(getTheme() === "dark" ? "light" : "dark");

/* ---------- View transitions ---------- */
export function transition(fn) {
  if (!document.startViewTransition || reduceMotion()) { fn(); return Promise.resolve(); }
  return document.startViewTransition(fn).finished.catch(() => {});
}

/* ---------- Toast ---------- */
let toastEl = null, toastTimer = null;
export function toast(text, action) {
  toastEl?.remove();
  toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  toastEl.append(Object.assign(document.createElement("span"), { textContent: text }));
  if (action) {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "btn small", textContent: action.label });
    b.addEventListener("click", () => { toastEl?.remove(); action.run(); });
    toastEl.append(b);
  }
  document.body.append(toastEl);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl?.remove(), action ? 8000 : 4000);
}

/* ---------- Spotlight: surfaces with .spot light up under the pointer ---------- */
export function enableSpotlight(root = document) {
  root.addEventListener("pointermove", (e) => {
    const el = e.target.closest?.(".spot");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });
}

/* ---------- Segmented control: slides a thumb under the pressed button ---------- */
export function segmented(group) {
  let thumb = group.querySelector(".thumb");
  if (!thumb) { thumb = Object.assign(document.createElement("span"), { className: "thumb" }); group.prepend(thumb); }
  const place = () => {
    const on = group.querySelector('button[aria-pressed="true"]');
    if (!on || !on.offsetWidth) return;
    thumb.style.width = `${on.offsetWidth}px`;
    thumb.style.transform = `translateX(${on.offsetLeft - 3}px)`;
  };
  new MutationObserver(place).observe(group, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
  new ResizeObserver(place).observe(group);
  document.fonts?.ready.then(place);
  place();
  return place;
}

/* ---------- Menu: a button that opens a list below it ---------- */
export function menu(button, panel) {
  const open = (on) => {
    panel.hidden = !on;
    button.setAttribute("aria-expanded", String(on));
    if (on) panel.querySelector("button:not([hidden]), a")?.focus();
  };
  button.addEventListener("click", (e) => { e.stopPropagation(); open(panel.hidden); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target)) open(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { open(false); button.focus(); } });
  panel.addEventListener("click", (e) => { if (e.target.closest("button, a")) open(false); });
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...panel.querySelectorAll("button:not([hidden]), a")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  });
  return open;
}

/* ---------- Command palette (Ctrl+K / ⌘K) ----------
   getItems() returns [{ title, hint?, group, icon?, keywords?, run }]. */
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const paletteShortcut = isMac ? "⌘K" : "Ctrl K";

export function commandPalette(getItems) {
  let scrim = null;

  function score(item, q) {
    if (!q) return 1;
    const title = item.title.toLowerCase();
    if (title.startsWith(q)) return 4;
    if (title.includes(q)) return 3;
    if (`${item.keywords || ""} ${item.hint || ""} ${item.group}`.toLowerCase().includes(q)) return 2;
    // Letters in order within the title ("scl" finds "Sales call")
    let i = 0;
    for (const ch of title) { if (ch === q[i]) i++; if (i === q.length) return 1; }
    return 0;
  }

  function open() {
    if (scrim) return;
    const lastFocus = document.activeElement;
    scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="palette-input">${icon("search")}<input type="text" placeholder="Search coaches and actions" aria-label="Search coaches and actions" role="combobox" aria-expanded="true" aria-controls="paletteList" autocomplete="off"></div>
        <ul class="palette-list" id="paletteList" role="listbox"></ul>
        <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>Esc</kbd> close</span></div>
      </div>`;
    document.body.append(scrim);
    const input = scrim.querySelector("input");
    const list = scrim.querySelector(".palette-list");
    let shown = [], sel = 0;

    const render = () => {
      const q = input.value.trim().toLowerCase();
      shown = getItems().map((it) => ({ it, s: score(it, q) })).filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s).map((x) => x.it);
      if (!q) { const order = [...new Set(shown.map((i) => i.group))]; shown.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group)); }
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.replaceChildren();
      if (!shown.length) { list.append(Object.assign(document.createElement("li"), { className: "palette-empty", textContent: "Nothing matches. Try another word." })); return; }
      let group = null;
      shown.forEach((it, i) => {
        if (it.group !== group && !q) { group = it.group; list.append(Object.assign(document.createElement("li"), { className: "palette-group", textContent: group, role: "presentation" })); }
        const li = document.createElement("li");
        li.className = "palette-item";
        li.id = `pi-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === sel));
        li.innerHTML = `<span class="pi-icon">${icon(it.icon || "arrow")}</span><span class="pi-text"><div class="pi-title"></div><div class="pi-hint"></div></span>`;
        li.querySelector(".pi-title").textContent = it.title;
        li.querySelector(".pi-hint").textContent = it.hint || it.group;
        li.addEventListener("pointermove", () => { if (sel !== i) { sel = i; mark(); } });
        li.addEventListener("click", () => runItem(i));
        list.append(li);
      });
      input.setAttribute("aria-activedescendant", `pi-${sel}`);
    };
    const mark = () => {
      list.querySelectorAll(".palette-item").forEach((li) => li.setAttribute("aria-selected", String(li.id === `pi-${sel}`)));
      list.querySelector(`#pi-${sel}`)?.scrollIntoView({ block: "nearest" });
      input.setAttribute("aria-activedescendant", `pi-${sel}`);
    };
    const runItem = (i) => { const it = shown[i]; close(); it?.run(); };

    input.addEventListener("input", () => { sel = 0; render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); runItem(sel); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") e.preventDefault();
    });
    scrim.addEventListener("pointerdown", (e) => { if (e.target === scrim) close(); });
    function close() { scrim?.remove(); scrim = null; lastFocus?.focus?.(); }
    render();
    input.focus();
  }

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); scrim ? null : open(); }
  });
  return open;
}
