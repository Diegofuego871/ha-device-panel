// Einrichtungsassistent, Fortschritt (2.178.0): ein Balken je Schritt wie bei Routinen und Magic Push, jeder ein Knopf zum direkten Springen
// (vorwärts nur bei gültiger Seite). Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const D = "dialog.wizard-dlg";

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark&wizard=new`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const step = () => ev(`return r.host._wizard.s?.step || ""`);
    await wait(`return r.querySelector("${D}")?.open && !r.host._wizard.s?.loading`);
    check(`[${tag}] Willkommen: kein Fortschrittsbalken`, await ev(`return !r.querySelector("${D} .wz-steps")`));
    await tap(`${D} [data-wz="start"]`);
    await wait(`return r.host._wizard.s.step === "integrations"`);
    const total = await ev(`return r.host._wizard.steps().length`);
    check(`[${tag}] ein Balken je Schritt (${total}), nur der erste gefüllt, als Knöpfe mit Beschriftung`, await ev(`const b = [...r.querySelectorAll("${D} .wz-steps .mg-stp")]; return b.length === ${total} && b.every((x) => x.tagName === "BUTTON" && x.getAttribute("aria-label")) && b.filter((x) => x.classList.contains("on")).length === 1 && b[0].classList.contains("on")`));
    check(`[${tag}] Lücken zwischen den Balken (nicht fliessend)`, await ev(`const b = [...r.querySelectorAll("${D} .wz-steps .mg-stp")]; return b[1].getBoundingClientRect().left - b[0].getBoundingClientRect().right >= 3`));
    // Weiter: der zweite Balken füllt sich
    await tap(`${D} [data-wz="next"]`);
    await wait(`return r.host._wizard.s.step === "types"`);
    check(`[${tag}] Weiter: zwei Balken gefüllt`, await ev(`return r.querySelectorAll("${D} .wz-steps .mg-stp.on").length === 2`));
    // Direkt vorspringen: auf den letzten Balken
    await tap(`${D} .wz-steps .mg-stp:last-child`);
    check(`[${tag}] Letzter Balken: springt direkt auf die Zusammenfassung`, (await wait(`return r.host._wizard.s.step === "done"`)) && (await ev(`return r.querySelectorAll("${D} .wz-steps .mg-stp.on").length === ${total}`)));
    // Zurück auf den ersten
    await tap(`${D} .wz-steps .mg-stp:first-child`);
    check(`[${tag}] Erster Balken: zurück auf Integrationen`, (await wait(`return r.host._wizard.s.step === "integrations"`)) && (await ev(`return r.querySelectorAll("${D} .wz-steps .mg-stp.on").length === 1`)));
    // Ungültige Seite: vorwärts gesperrt, zurück frei
    await ev(`r.host._wizard.go("messages")`);
    await wait(`return r.host._wizard.s.step === "messages"`);
    await ev(`const s = r.host._wizard.s; s.d.v.notify_delay = "abc"; r.host._wizard.render()`);
    const bad = await ev(`return !!r.host._wizard.invalid()`);
    check(`[${tag}] ungültige Seite: spätere Balken gesperrt, frühere frei`, bad && (await ev(`const b = [...r.querySelectorAll("${D} .wz-steps .mg-stp")]; const i = b.findIndex((x) => x.getAttribute("aria-current")); return b.slice(i + 1).every((x) => x.disabled) && b.slice(0, i + 1).every((x) => !x.disabled)`)));
    await p.screenshot({ path: `${process.env.OUT || "output"}/wizard-steps-${tag.replace("/", "-")}.png` });
    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(";"));
    await ctx.close();
  }
}
await b.close();
process.exit(ok ? 0 : 1);
