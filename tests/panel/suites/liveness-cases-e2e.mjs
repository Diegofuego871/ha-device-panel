// Das Popup wählt die Lebenszeichen genau wie der Server (2.204.1): _lconnState gegen die Fälle in fixtures/liveness-cases.json, die
// tests/test_liveness_cases.py gegen liveness_entities prüft. Vorher wählte das Popup die Stufe vor dem Abziehen der Ausgeschlossenen.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { launchOptions } from "../lib.mjs";

const cases = JSON.parse(fs.readFileSync(new URL("../fixtures/liveness-cases.json", import.meta.url)));
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:8950/ha-sim.html?lang=de");
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
const bad = await f.evaluate(new Function("cases", `const h = ${R}.host; const bad = [];
  cases.forEach((c, i) => {
    h._detail = { id: "x", data: { entities: c.entities.map((e) => ({ ...e, name: e.entity_id })) } };
    const d = { id: "x", liveness_exclude_setting: c.marked, liveness_conn_setting: c.on, liveness_conn_default: { on: true } };
    const lc = h._lconnState(d);
    const got = c.entities.filter((e) => lc.counts(e)).map((e) => e.entity_id).sort();
    if (JSON.stringify(got) !== JSON.stringify(c.expected)) bad.push(i);
  });
  h._detail = null;
  return bad;`), cases);
check(`alle ${cases.length} Fälle wie der Server`, bad.length === 0, bad.join(","));
check("keine Fehler", errors.length === 0, errors.join("|"));
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
