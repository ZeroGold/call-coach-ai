// Checks every mode in public/modes for mistakes that would otherwise fail quietly:
// actions missing from the playbook, tips or signals that name a question the
// schema doesn't have, and stage names that don't match the score levels.
//
//   npm run check-modes

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MODES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "modes");
let failed = false;

for (const id of (await readdir(MODES_DIR)).sort()) {
  const dir = path.join(MODES_DIR, id);
  const problems = [];
  try {
    const meta = JSON.parse(await readFile(path.join(dir, "mode.json"), "utf8"));
    const schema = JSON.parse(await readFile(path.join(dir, "schema.json"), "utf8"));
    // playbook.js is a browser ES module; importing its source works on any Node version
    const source = await readFile(path.join(dir, "playbook.js"), "utf8");
    const { PLAYBOOK: p } = await import("data:text/javascript," + encodeURIComponent(source));
    const action = schema[meta.questions?.action];
    const stage = schema[meta.questions?.stage];
    const isSignal = (k) => schema[k]?.type === "noul";

    if (action?.type !== "choice") problems.push(`questions.action must name a choice question`);
    if (stage?.type !== "score") problems.push(`questions.stage must name a score question`);
    if (!["live", "rehearsal"].includes(meta.kind)) problems.push(`kind must be "live" or "rehearsal"`);

    const options = Object.keys(action?.criteria || {});
    for (const o of options) {
      if (!p.actions?.[o]) problems.push(`playbook has no action for "${o}"`);
      if (!p.priority?.includes(o)) problems.push(`priority is missing "${o}"`);
    }
    for (const a of Object.keys(p.actions || {})) if (!options.includes(a)) problems.push(`action "${a}" is not an option in schema.json`);
    for (const [a, def] of Object.entries(p.actions || {})) {
      for (const t of def.tips?.when || []) if (!isSignal(t.signal)) problems.push(`tip in "${a}" uses "${t.signal}", which is not a yes/no question`);
    }
    for (const k of Object.keys(p.signals || {})) if (!isSignal(k)) problems.push(`signal "${k}" is not a yes/no question`);
    if (p.alert && !isSignal(p.alert.signal)) problems.push(`alert uses "${p.alert.signal}", which is not a yes/no question`);
    if (p.stages?.length !== stage?.criteria?.length) problems.push(`${p.stages?.length} stage names but ${stage?.criteria?.length} score levels`);
    if (p.stages?.length !== 4) problems.push(`the gauge is drawn for 4 stages, not ${p.stages?.length}`);
    if (meta.kind === "rehearsal" && !p.scenarios?.length) problems.push(`a rehearsal mode needs scenarios`);
  } catch (err) {
    problems.push(err.message);
  }
  failed ||= problems.length > 0;
  console.log(problems.length ? `✗ ${id}\n${problems.map((m) => `    ${m}`).join("\n")}` : `✓ ${id}`);
}

process.exit(failed ? 1 : 0);
