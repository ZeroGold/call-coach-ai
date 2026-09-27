// How this browser reaches TypeSafe when the app is hosted on a website.
// The desktop app keeps the key on the computer and needs none of this.
//
//   Your own key:  kept in this browser only, sent with each request, never stored by the server.
//   Access code:   for a private site that uses the owner's key.

const KEY = "cc-typesafe-key";
const CODE = "cc-access-code";

const read = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const write = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };

export const getKey = () => read(KEY);
export const setKey = (v) => write(KEY, (v || "").trim());
export const getAccessCode = () => read(CODE);
export const setAccessCode = (v) => write(CODE, (v || "").trim());

export function apiHeaders() {
  const h = {};
  const key = getKey(), code = getAccessCode();
  if (key) h["X-TypeSafe-Key"] = key;
  if (code) h["X-Access-Code"] = code;
  return h;
}
