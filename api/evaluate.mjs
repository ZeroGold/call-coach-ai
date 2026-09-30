// POST /api/evaluate on Vercel: asks Jev about the transcript so far.
import { evaluate, clientIp } from "../lib/coach.mjs";
import { json, route, headers, readJson } from "../lib/web.mjs";

export const POST = route(async (request) => {
  const header = headers(request);
  const [status, payload] = await evaluate({ header, ip: clientIp(header), readJson: () => readJson(request) });
  return json(status, payload);
});
