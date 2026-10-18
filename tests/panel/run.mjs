// Startet den HA-Nachbau und alle Suiten (oder die als Argument genannten).
// Die Suiten laufen parallel (PANEL_JOBS, Standard: Kerne minus eins, höchstens 4): der Server ist reiner Dateiserver,
// jeder Browser hält seinen eigenen Zustand. PANEL_JOBS=1 startet sie nacheinander wie früher.
// Unter Last schlagen Suiten mit Zeitabhängigkeit (Animationen, Wartezeiten) sporadisch fehl: eine fehlgeschlagene Suite
// wird nach dem Parallellauf einzeln, ohne Last, ein zweites Mal gestartet. Besteht sie, zählt sie als bestanden und wird
// als "instabil" ausgewiesen (PANEL_RETRY=0 schaltet das ab); besteht sie nicht, gilt der Fehler. Exit-Code 1 bei Fehlern.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.mjs";

const dir = fileURLToPath(new URL("./suites/", import.meta.url));
const wanted = process.argv.slice(2);
const suites = readdirSync(dir)
  .filter((f) => f.endsWith("-e2e.mjs"))
  .filter((f) => !wanted.length || wanted.some((w) => f.startsWith(w)))
  .sort();
const jobs = Math.max(1, Number(process.env.PANEL_JOBS) || Math.min(4, cpus().length - 1));
const retryOn = process.env.PANEL_RETRY !== "0" && jobs > 1;
const server = await startServer(8950);

const run = (suite) =>
  new Promise((ok) => {
    const child = spawn(process.execPath, [dir + suite], { stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    child.stdout.on("data", (d) => (text += d));
    child.stderr.on("data", (d) => (text += d));
    child.on("close", (code) => ok({ code, text }));
  });
const verdict = (out) => {
  const pass = (out.text.match(/^PASS/gm) || []).length;
  const fail = (out.text.match(/^FAIL/gm) || []).length;
  return { pass, fail, bad: fail > 0 || out.code !== 0 || pass === 0 };
};
const detail = (out) => out.text.split("\n").filter((l) => !l.startsWith("PASS")).join("\n");

let failed = 0;
const retry = [];
const unstable = [];
let next = 0;
async function worker() {
  while (next < suites.length) {
    const suite = suites[next++];
    const out = await run(suite);
    const { pass, fail, bad } = verdict(out);
    if (bad && retryOn) {
      retry.push(suite);
      console.log(`? ${suite}: ${pass} bestanden, ${fail} fehlgeschlagen, wird einzeln wiederholt`);
      continue;
    }
    if (bad) failed += 1;
    console.log(`${bad ? "✗" : "✓"} ${suite}: ${pass} bestanden, ${fail} fehlgeschlagen${out.code ? `, Exit ${out.code}` : ""}`);
    if (bad) console.log(detail(out));
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, suites.length) }, worker));
for (const suite of retry.sort()) {
  const out = await run(suite);
  const { pass, fail, bad } = verdict(out);
  if (bad) failed += 1;
  else unstable.push(suite);
  console.log(`${bad ? "✗" : "✓"} ${suite}: ${pass} bestanden, ${fail} fehlgeschlagen${out.code ? `, Exit ${out.code}` : ""}${bad ? "" : " (instabil: erst im zweiten Versuch bestanden)"}`);
  if (bad) console.log(detail(out));
}
server.close();
if (unstable.length) console.log(`Instabil unter Last (im Einzellauf bestanden): ${unstable.join(", ")}`);
console.log(failed ? `${failed} Suite(n) fehlgeschlagen` : `Alle ${suites.length} Suiten bestanden`);
process.exit(failed ? 1 : 0);
