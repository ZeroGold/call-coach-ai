// GET /api/health on Vercel. Everywhere else, server.mjs answers it.
import { health } from "../lib/coach.mjs";
import { json, route } from "../lib/web.mjs";

export const GET = route(() => json(200, health()));
