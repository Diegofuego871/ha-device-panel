// Thread-Rolle und Netzname im Geräte-Popup (0.32.0, docs/mockups/backlog-v1,
// Punkt 4 A) aus matter/node_diagnostics. Die Verbindungsart von Hand bleibt
// möglich und hat Vorrang; die Kacheln sind nur Zusatzangaben. Unbekannte
// Rollen und Fehler zeigen nichts. DE/EN, Desktop/Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

const TEXT = {
  de: { role: "Thread-Rolle", net: "Netz", end: "Endgerät", endHint: "hängt an einem Router", sleepy: "Schlafendes Endgerät", sleepyHint: "meldet sich nur zeitweise", router: "Router", netName: "Zuhause-Thread", netHint: "Netzname aus der Diagnose", thread: "Thread", wifi: "WLAN" },
  en: { role: "Thread role", net: "Network", end: "End device", endHint: "attached to a router", sleepy: "Sleepy end device", sleepyHint: "checks in only now and then", router: "Router", netName: "Zuhause-Thread", netHint: "network name from the diagnostics", thread: "Thread", wifi: "Wi-Fi" },
};

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`));
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const tiles = () => ev(`return [...r.querySelectorAll("dialog.device .tile")].map(t=>[t.querySelector(".tile-k").textContent.trim(), t.querySelector(".tile-v").textContent.replace(/\\s+/g," ").trim()])`);
    const find = async (label) => (await tiles()).find(([k]) => k === label);
    const open = async (id) => {
      await ev(`r.host._openDevice(${JSON.stringify(id)})`);
      await wait(`return r.querySelector("dialog.device")?.open && r.querySelector('select[data-dlg="conn"]')`);
    };
    const close = async () => {
      await ev(`r.querySelector("dialog.device").close()`);
      await wait(`return !r.querySelector("dialog.device").open`);
    };
    const refresh = async () => {
      await ev(`r.host._matter.clear(); r.host._refineMatter()`);
      await wait(`return r.host._matter.size >= 2`);
    };

    // Thermostat Bad (Matter über Thread, Endgerät)
    await wait(`return r.host._matter.size >= 2`);
    await open("c");
    const role = await find(T.role);
    const net = await find(T.net);
    check(`[${tag}] Kachel "${T.role}": ${T.end}`, role && role[1] === `${T.end}${T.endHint}`, JSON.stringify(role));
    check(`[${tag}] Kachel "${T.net}": ${T.netName}`, net && net[1] === `${T.netName}${T.netHint}`, JSON.stringify(net));
    await p.screenshot({ path: `${outDir}/matter-end-${tag.replace("/", "-")}.png` });
    // Kacheln im Abschnitt "Verbindung", nach der Verbindungsart
    const order = (await tiles()).map(([k]) => k);
    check(`[${tag}] Reihenfolge: Verbindungsart vor Rolle und Netz`, order.indexOf(T.role) > order.indexOf(order.find((k) => k !== T.role && k !== T.net)) && order.indexOf(T.net) === order.indexOf(T.role) + 1, order.join(","));
    await close();

    // Türschloss: schlafendes Endgerät
    await open("i");
    const sleepy = await find(T.role);
    check(`[${tag}] schlafendes Endgerät`, sleepy && sleepy[1] === `${T.sleepy}${T.sleepyHint}`, JSON.stringify(sleepy));

    // Verbindungsart von Hand bleibt möglich und hat Vorrang; Kacheln bleiben
    await (await handle('select[data-dlg="conn"]')).selectOption("wifi");
    check(`[${tag}] von Hand "${T.wifi}" gesetzt`, await wait(`const d=r.host._devices.find((x)=>x.id==="i"); return d.connection === "wifi" && d.connection_manual === true`));
    await wait(`return !!r.querySelector('select[data-dlg="conn"]')`);
    check(`[${tag}] Verbindungsart von Hand hat Vorrang (${T.wifi})`, (await ev(`return r.host._connOf(r.host._devices.find((x)=>x.id==="i"))`)) === "wifi" && (await ev(`const s=r.querySelector('select[data-dlg="conn"]'); return s.value`)) === "wifi");
    const still = await find(T.role);
    check(`[${tag}] Rolle bleibt als Zusatzangabe`, still && still[1].startsWith(T.sleepy), JSON.stringify(still));
    await (await handle('select[data-dlg="conn"]')).selectOption("");
    await wait(`return r.host._devices.find((x)=>x.id==="i").connection_manual === false`);
    await close();

    // Router, unbekannte Rolle, WLAN, Fehler
    await p.evaluate(() => { window.__matterDiag = { network_type: "thread", node_type: "routing_end_device", network_name: "Zuhause-Thread" }; });
    await refresh();
    await open("c");
    check(`[${tag}] Router`, (await find(T.role))?.[1].startsWith(T.router), JSON.stringify(await find(T.role)));
    await close();
    await p.evaluate(() => { window.__matterDiag = { network_type: "thread", node_type: "unbekannt_xyz", network_name: "" }; });
    await refresh();
    await open("c");
    check(`[${tag}] unbekannte Rolle und leerer Netzname: keine Kacheln`, !(await find(T.role)) && !(await find(T.net)));
    await close();
    await p.evaluate(() => { window.__matterDiag = { network_type: "wifi", node_type: "end_device", network_name: "MeinWLAN" }; });
    await refresh();
    await open("c");
    check(`[${tag}] WLAN: keine Rolle, aber die SSID als Netz`, !(await find(T.role)) && (await find(T.net))?.[1].startsWith("MeinWLAN"), JSON.stringify(await find(T.net)));
    await close();
    await p.evaluate(() => { window.__matterDiag = { network_type: "thread", node_type: "bridge", network_name: null }; });
    await refresh();
    await open("c");
    check(`[${tag}] Bridge, ohne Netzname: keine Kacheln`, !(await find(T.role)) && !(await find(T.net)));
    await close();
    await p.evaluate(() => { window.__matterDiag = null; });
    await refresh();
    await open("c");
    check(`[${tag}] Diagnose-Fehler: keine Kacheln, Popup funktioniert`, !(await find(T.role)) && !(await find(T.net)) && (await ev(`return !!r.querySelector('select[data-dlg="conn"]')`)));
    // Kein Passwort, kein Schlüssel im Popup
    check(`[${tag}] nichts Sicherheitsrelevantes im Popup`, !(await ev(`return /password|passwort|credential|secret/i.test(r.querySelector("dialog.device").textContent)`)));
    await close();
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
