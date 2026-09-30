// Fetch-style helpers (Request in, Response out) for the Vercel functions in api/.

import { MAX_BODY_BYTES } from "./coach.mjs";

export function json(status, payload) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

/** Reads request headers by lowercase name, the way lib/coach.mjs asks for them. */
export const headers = (request) => (name) => request.headers.get(name) ?? undefined;

/** Wraps a handler so a failure still answers in JSON, as server.mjs does. */
export const route = (handler) => async (request) => {
  try {
    return await handler(request);
  } catch (err) {
    return json(500, { error: err.message || "Unexpected server error." });
  }
};

export async function readJson(request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new Error("Transcript is too large.");
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error("Transcript is too large.");
  try { return JSON.parse(text || "{}") ?? {}; } catch { throw new Error("Request body is not valid JSON."); }
}
