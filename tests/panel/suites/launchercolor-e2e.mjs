// Farbe eigener Apps (2.199.0): im Formular oberhalb der Symbole die Akzentfarben des Panels (und "Standard"), Vorschau und Launcher in dieser
// Farbe, Speichern nur der Kennung, kein Farbwahl-Bereich beim Favicon, zehn neue Symbole. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const IDS = ["sky", "ocean", "teal", "indigo", "pink", "orange", "red", "forest", "graphite"];
const NAMES = { de: { forest: "Tannengrün", def: "Standard (Akzentfarbe)", color: "Farbe" }, en: { forest: "Forest green", def: "Default (accent colour)", color: "Colour" } };

// Reine Funktionen: nur eine bekannte Form der Kennung, nie ein Farbwert; mit Favicon keine Farbe
{
  const { sanitizeApps } = await import("../../../custom_components/device_panel/panel/apps.js");
  const s = sanitizeApps({ custom: [
    { id: "a", name: "Seite", icon: "web", url: "/lovelace/k", accent: "forest" },
    { id: "b", name: "Aktion", icon: "bolt", svc: { service: "light.turn_on" }, accent: "pink" },
    { id: "c", name: "Böse", icon: "web", url: "/lovelace/k", accent: "#ff0000" },
    { id: "d", name: "Markup", icon: "web", url: "/lovelace/k", accent: "x\"><b>" },
    { id: "e", name: "Mit Bild", icon: "web", url: "https://x.example", ext: true, accent: "red", favicon: "data:image/png;base64,iVBORw0KGgo=" },
    { id: "f", name: "Neues Symbol", icon: "unicorn", url: "/lovelace/k" },
  ] });
  check("Bereinigen: Farbkennung bei Seite und Aktion behalten", s.custom[0].accent === "forest" && s.custom[1].accent === "pink");
  check("Bereinigen: Farbwert (#ff0000) und Markup werden verworfen", !("accent" in s.custom[2]) && !("accent" in s.custom[3]));
  check("Bereinigen: mit Favicon keine Farbe, neues Symbol bleibt", !("accent" in s.custom[4]) && s.custom[5].icon === "unicorn");
}

for (const lang of ["de", "en"]) {
  const T = NAMES[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=dark`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => {
      for (let n = 1; ; n++) {
        const h = await handle(sel);
        if (!h) throw new Error("fehlt: " + sel);
        try { await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); return; } catch (err) { if (n >= 3 || !/not attached|not stable/.test(String(err))) throw err; await p.waitForTimeout(200); }
      }
    };
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const data = async () => JSON.parse(await ev(`return JSON.stringify(r.host._apps.data)`));
    const D = "dialog.apps-dlg";
    const F = "dialog.app-dlg";

    await tap(".apps-btn");
    await wait(`return r.querySelector("${D}")?.open`);
    await tap(`${D} [data-ap="edit"]`);
    await tap(`${D} [data-ap="add"]`);
    await wait(`return r.querySelector("${F}")?.open`);

    check(`[${tag}] Formular: ${IDS.length + 1} Farben (Standard und die Akzentfarben des Panels in dessen Reihenfolge)`, await ev(`const b = [...r.querySelectorAll('${F} [data-ap="fcolor"]')]; return b.length === ${IDS.length + 1} && b.map((x) => x.dataset.accent).join() === ${JSON.stringify(["", ...IDS].join())}`));
    check(`[${tag}] "Standard" gewählt, Beschriftung "${T.color} · ${T.def}"`, await ev(`return r.querySelector('${F} [data-ap="fcolor"][data-accent=""]').classList.contains("on") && r.querySelector("${F} .ap-collbl").textContent.replace(/\\s+/g, " ").trim() === ${JSON.stringify(`${T.color} · ${T.def}`)}`));
    check(`[${tag}] Farben stehen oberhalb der Symbole`, await ev(`return r.querySelector("${F} .ap-cols").getBoundingClientRect().bottom <= r.querySelector("${F} .ap-icons").getBoundingClientRect().top + 1`));
    check(`[${tag}] Farbe wie im Einstellungsfenster: gleiche Farbwerte wie die Akzentfarben`, await ev(`const c = (id) => getComputedStyle(r.querySelector('${F} [data-accent="' + id + '"] i')).backgroundColor; return c("forest") === "rgb(46, 139, 87)" && c("sky") === "rgb(3, 169, 244)" && c("graphite") === "rgb(144, 164, 174)"`));

    await (await handle(`${F} [data-f="name"]`)).fill("Mein Wald");
    await (await handle(`${F} [data-f="url"]`)).fill("/lovelace/wald");
    await tap(`${F} [data-ap="ficon"][data-icon="unicorn"]`);
    await tap(`${F} [data-ap="fcolor"][data-accent="forest"]`);
    check(`[${tag}] Tannengrün: gewählt, Beschriftung nennt "${T.forest}", Vorschau in dieser Farbe mit neuem Symbol`, await ev(`const i = r.querySelector("${F} [data-f-prev] .ap-ico"); return r.querySelector('${F} [data-accent="forest"]').classList.contains("on") && r.querySelector("${F} .ap-collbl").textContent.includes(${JSON.stringify(T.forest)}) && getComputedStyle(i).backgroundColor === "rgb(46, 139, 87)" && !i.classList.contains("own") && !!i.querySelector("svg path")`));
    await tap(`${F} [data-ap="fsave"]`);
    await wait(`return !r.querySelector("${F}").open`);
    const d1 = await data();
    check(`[${tag}] gespeichert: nur die Kennung "forest" und das Symbol`, d1.custom.length === 1 && d1.custom[0].accent === "forest" && d1.custom[0].icon === "unicorn" && !JSON.stringify(d1.custom[0]).includes("#"), JSON.stringify(d1.custom[0]));
    check(`[${tag}] Launcher: Kachel der App in Tannengrün`, await ev(`const t = [...r.querySelectorAll("${D} .ap-erow")].find((x) => x.textContent.includes("Mein Wald")); const i = t?.querySelector(".ap-ico"); return !!i && getComputedStyle(i).backgroundColor === "rgb(46, 139, 87)"`));

    // Bearbeiten: Farbe ist vorgewählt; "Standard" nimmt sie zurück
    await tap(`${D} [data-ap="edit-app"][data-id="${d1.custom[0].id}"]`);
    await wait(`return r.querySelector("${F}")?.open`);
    check(`[${tag}] Bearbeiten: Tannengrün vorgewählt`, await ev(`return r.querySelector('${F} [data-accent="forest"]').classList.contains("on")`));
    await tap(`${F} [data-ap="fcolor"][data-accent=""]`);
    await tap(`${F} [data-ap="fsave"]`);
    await wait(`return !r.querySelector("${F}").open`);
    const d2 = await data();
    check(`[${tag}] "Standard": Farbe entfernt, Kachel wieder in der Hauptfarbe`, d2.custom.length === 1 && !("accent" in d2.custom[0]) && (await ev(`const t = [...r.querySelectorAll("${D} .ap-erow")].find((x) => x.textContent.includes("Mein Wald")); return !!t?.querySelector(".ap-ico.own")`)));

    // Externer Link mit Favicon: kein Farbbereich
    await tap(`${D} [data-ap="add"]`);
    await wait(`return r.querySelector("${F}")?.open`);
    await tap(`${F} [data-set="fkind"][data-v="ext"]`);
    await tap(`${F} [data-set="fsrc"][data-v="favicon"]`);
    check(`[${tag}] Reiter Favicon: Farbwahl verborgen (das Bild ersetzt den Kreis)`, await ev(`return r.querySelector("${F} .ap-colrow").offsetHeight === 0`));
    await tap(`${F} [data-set="fsrc"][data-v="icon"]`);
    check(`[${tag}] Reiter Symbol: Farbwahl wieder sichtbar`, await ev(`return r.querySelector("${F} .ap-colrow").offsetHeight > 0`));
    check(`[${tag}] keine Seitenfehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
