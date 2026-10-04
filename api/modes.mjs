// GET /api/modes on Vercel: the built-in coaches, read from public/modes.
import { listModes } from "../lib/coach.mjs";
import { json, route } from "../lib/web.mjs";

export const GET = route(async () => json(200, await listModes()));
