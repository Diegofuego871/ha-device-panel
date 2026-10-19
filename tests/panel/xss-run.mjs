// Sicherheitsprüfung gegen eingeschleustes HTML (XSS): alle Suiten (oder die genannten) gegen den Simulator mit vergifteten Texten
// (PANEL_XSS=1, siehe sim/ha-sim.html). Die Prüfungen der Suiten schlagen dabei erwartungsgemäss fehl (die Namen tragen das angehängte
// HTML); gezählt werden nur die Treffer: ein Bild mit onerror, das als HTML statt als Text eingesetzt wurde. Treffer je Suite (einzeln
// nacheinander, damit die Zuordnung stimmt) mit PANEL_JOBS=1. Exit-Code 1 bei Treffern.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer, xssHits } from "./server.mjs";

process.env.PANEL_XSS = "1";
const dir = fileURLToPath(new URL("./suites/", import.meta.url));
const wanted = process.argv.slice(2);
const suites = readdirSync(dir).filter((f) => f.endsWith("-e2e.mjs")).filter((f) => !wanted.length || wanted.some((w) => f.startsWith(w))).sort();
const jobs = Math.max(1, Number(process.env.PANEL_JOBS) || 4);
const server = await startServer(8950);
const bySuite = {};
let next = 0;
async function worker() {
  while (next < suites.length) {
    const suite = suites[next++];
    const before = xssHits.length;
    await new Promise((ok) => {
      const c = spawn(process.execPath, [dir + suite], { stdio: "ignore", env: process.env });
      const timer = setTimeout(() => c.kill(), 240000);
      c.on("close", () => { clearTimeout(timer); ok(); });
    });
    await new Promise((r) => setTimeout(r, 300));
    const n = xssHits.length - before;
    if (jobs === 1 && n) bySuite[suite] = n;
    console.log(`${n && jobs === 1 ? "✗" : "·"} ${suite}${jobs === 1 ? `: ${n} Treffer` : ""}`);
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, suites.length) }, worker));
server.close();
console.log(xssHits.length ? `${xssHits.length} Treffer${jobs === 1 ? `: ${JSON.stringify(bySuite)}` : " (mit PANEL_JOBS=1 je Suite zuordnen)"}` : `Keine Treffer in ${suites.length} Suiten`);
if (process.env.PANEL_XSS_OUT) (await import("node:fs")).writeFileSync(process.env.PANEL_XSS_OUT, xssHits.join("\n=====\n"));
process.exit(xssHits.length ? 1 : 0);
