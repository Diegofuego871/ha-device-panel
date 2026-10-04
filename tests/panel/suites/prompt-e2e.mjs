// Profi-Modus der KI-Einschätzung (1.2.0, docs/mockups/ai-v1, A): Schalter im
// Abschnitt, Prompt mit {language} und {facts} zum Lesen und Kopieren, Fenster
// "Prompt bearbeiten" (Platzhalter einfügen, Prüfung, Vorschau mit den Fakten
// eines Geräts), Übernehmen, Speichern, auf Standard zurück. DE/EN, Desktop/Handy.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const MINE = "Kurz auf {language}.\n{facts}";

const TEXT = {
  de: {
    expert: "Profi-Modus", def: "Standard", own: "Eigener", copied: "Kopiert", sub: "Standard", subOwn: "Eigener Prompt statt Standard", lang: "German",
    errFacts: "Der Prompt braucht {facts}, sonst bekommt die KI keine Angaben zum Gerät.", errUnknown: "Unbekannter Platzhalter {name}. Erlaubt sind {language} und {facts}.",
    sumOwn: "Aus · Eigener Prompt", tabs: "Bearbeiten|Vorschau", count: (n) => `${n} von 4000 Zeichen`, change: "1 Änderung",
  },
  en: {
    expert: "Expert mode", def: "Default", own: "Own", copied: "Copied", sub: "Default", subOwn: "Own prompt instead of the default", lang: "English",
    errFacts: "The prompt needs {facts}, otherwise the AI gets no details about the device.", errUnknown: "Unknown placeholder {name}. Allowed are {language} and {facts}.",
    sumOwn: "Off · Own prompt", tabs: "Edit|Preview", count: (n) => `${n} of 4000 characters`, change: "1 change",
  },
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
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const text = (sel) => ev(`return (r.querySelector(${JSON.stringify(sel)})?.textContent || "").replace(/\\s+/g," ").trim()`);
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const calls = (type) => p.evaluate((t) => window.__wsCalls.filter((m) => m.type === t), type);
    const setText = (value) => ev(`const a=r.querySelector(".pr-text"); a.value=${JSON.stringify(value)}; a.dispatchEvent(new Event("input", { bubbles: true }))`);
    const savedThenClose = async () => {
      await tap('dialog.settings [data-set="save"]');
      if (!(await wait(`return r.querySelector(".set-count")?.classList.contains("saved")`))) return false;
      await tap('dialog.settings .dlg-actions [data-set="close"]');
      return wait(`return !r.querySelector("dialog.settings").open`);
    };
    // Zwischenablage ersetzen: im iframe fehlt die Berechtigung
    await f.evaluate(() => { window.__clip = null; Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true }); });

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="ai"]');
    check(`[${tag}] Profi-Modus aus, kein Prompt sichtbar`, !(await ev(`return r.querySelector('input[data-set="expert"]').checked`)) && !(await handle(".aip")), await text(".set-sec.open .opt:last-of-type"));
    check(`[${tag}] Beschriftung "${T.expert}"`, (await ev(`return [...r.querySelectorAll(".opt-label")].some(e=>e.textContent.trim()===${JSON.stringify(T.expert)})`)));
    await tap('input[data-set="expert"]');
    check(`[${tag}] Schalter an: Prompt "${T.def}" mit allen Platzhaltern hervorgehoben`, (await text(".aip-h")).endsWith(T.def) && (await ev(`return r.querySelectorAll(".aip-box .pv").length === (r.host._settings.data.ai_prompt_default.match(/\\{(language|facts)\\}/g) || []).length && r.querySelectorAll(".aip-box .pv").length >= 2`)) && (await text(".aip-box")).includes("careful assistant"), await text(".aip-h"));
    check(`[${tag}] "Standard" gesperrt, nichts geändert`, (await ev(`return r.querySelector('[data-set="prompt-default"]').disabled`)) && (await text(".set-count")) === "");

    // Kopieren
    const def = await ev(`return r.host._settings.data.ai_prompt_default`);
    await tap('[data-set="prompt-copy"]');
    check(`[${tag}] Kopieren: Standard-Prompt in der Zwischenablage, Knopf "${T.copied}"`, (await f.evaluate(() => window.__clip)) === def && (await text('[data-set="prompt-copy"]')) === T.copied);

    // Fenster
    await tap('[data-set="prompt-open"]');
    check(`[${tag}] Fenster offen: Textfeld mit dem Standard, Übernehmen frei`, await wait(`return r.querySelector("dialog.prompt-dlg")?.open && r.querySelector(".pr-text")?.value === r.host._settings.data.ai_prompt_default && !r.querySelector('[data-prompt="apply"]').disabled`));
    check(`[${tag}] Reiter ${T.tabs}, Unterzeile "${T.sub}", Zähler`, (await ev(`return [...r.querySelectorAll("dialog.prompt-dlg .sub-tab")].map(x=>x.textContent).join("|")`)) === T.tabs && (await text("dialog.prompt-dlg [data-prompt-sub]")) === T.sub && (await text("[data-prompt-count]")) === T.count(def.length), await text("[data-prompt-count]"));
    if (!mobile) await p.screenshot({ path: `${outDir}/prompt-edit-${tag.replace("/", "-")}.png` });

    // Prüfung
    await setText("Beurteile das Gerät auf {language}.");
    check(`[${tag}] ohne {facts}: Fehler, Übernehmen gesperrt, Feld rot`, (await text("[data-prompt-error]")) === T.errFacts && (await ev(`return r.querySelector('[data-prompt="apply"]').disabled && r.querySelector(".pr-text").classList.contains("bad") && !r.querySelector("[data-prompt-error]").hidden`)), await text("[data-prompt-error]"));
    await setText("{name} {facts}");
    check(`[${tag}] unbekannter Platzhalter`, (await text("[data-prompt-error]")) === T.errUnknown.replace("{name}", "{name}") && (await ev(`return r.querySelector('[data-prompt="apply"]').disabled`)), await text("[data-prompt-error]"));
    await setText("x".repeat(4001) + "{facts}");
    check(`[${tag}] zu lang`, (await ev(`return r.querySelector('[data-prompt="apply"]').disabled && !r.querySelector("[data-prompt-error]").hidden`)));
    // Chip fügt an der Cursor-Stelle ein
    await setText("Vorher  nachher");
    await ev(`const a=r.querySelector(".pr-text"); a.focus(); a.setSelectionRange(7, 7)`);
    await tap('[data-prompt="insert"][data-key="{facts}"]');
    check(`[${tag}] Chip {facts} an der Cursor-Stelle, Fehler weg`, (await ev(`return r.querySelector(".pr-text").value`)) === "Vorher {facts} nachher" && (await ev(`return r.querySelector("[data-prompt-error]").hidden && !r.querySelector('[data-prompt="apply"]').disabled`)));
    await setText(MINE);
    check(`[${tag}] eigener Prompt: Unterzeile "${T.subOwn}"`, (await text("dialog.prompt-dlg [data-prompt-sub]")) === T.subOwn && (await text("[data-prompt-count]")) === T.count(MINE.length));

    // Vorschau mit den Fakten eines Geräts
    await tap('dialog.prompt-dlg [data-prompt="tab"][data-key="preview"]');
    check(`[${tag}] Vorschau: Text mit Sprache und Gerät, ohne Platzhalter`, await wait(`const t=r.querySelector("dialog.prompt-dlg .aip-box.ro")?.textContent||""; return t.startsWith("Kurz auf ${T.lang}") && t.includes('"name"') && !t.includes("{facts}") && !t.includes("{language}")`), await text("dialog.prompt-dlg .aip-box"));
    const dev1 = await ev(`return r.querySelector("[data-prompt-dev]").value`);
    const other = await ev(`return [...r.querySelectorAll("[data-prompt-dev] option")].map(o=>o.value).find(v=>v!==${JSON.stringify(dev1)})`);
    await ev(`const s=r.querySelector("[data-prompt-dev]"); s.value=${JSON.stringify(other)}; s.dispatchEvent(new Event("change", { bubbles: true }))`);
    const name2 = await ev(`return r.host._devices.find(d=>d.id===${JSON.stringify(other)}).name`);
    check(`[${tag}] anderes Gerät: Vorschau ändert sich`, await wait(`return (r.querySelector("dialog.prompt-dlg .aip-box.ro")?.textContent||"").includes(${JSON.stringify(name2)})`));
    const pv = (await calls("device_panel/ai_prompt_preview")).at(-1);
    check(`[${tag}] Vorschau schickt den Entwurf und die Sprache`, pv && pv.prompt === MINE && pv.device_id === other && pv.language === lang, JSON.stringify(pv));
    check(`[${tag}] Vorschau ruft die KI nicht auf`, (await calls("device_panel/ai_assess")).length === 0);
    if (!mobile) await p.screenshot({ path: `${outDir}/prompt-preview-${tag.replace("/", "-")}.png` });
    // Zurück: Text bleibt
    await tap('dialog.prompt-dlg [data-prompt="tab"][data-key="edit"]');
    check(`[${tag}] zurück zu "Bearbeiten": Text bleibt`, (await ev(`return r.querySelector(".pr-text").value`)) === MINE);

    // Abbrechen ändert nichts
    await tap('dialog.prompt-dlg .dlg-actions [data-prompt="cancel"]');
    check(`[${tag}] Abbrechen: Fenster zu, nichts geändert`, await wait(`return !r.querySelector("dialog.prompt-dlg").open`) && (await text(".set-count")) === "" && (await text(".aip-h")).endsWith(T.def));
    // Übernehmen
    await tap('[data-set="prompt-open"]');
    await wait(`return r.querySelector("dialog.prompt-dlg")?.open`);
    await setText(MINE);
    await tap('dialog.prompt-dlg [data-prompt="apply"]');
    check(`[${tag}] Übernehmen: Fenster zu, Prompt "${T.own}", eine Änderung`, await wait(`return !r.querySelector("dialog.prompt-dlg").open && r.querySelector(".aip-h b")?.textContent === ${JSON.stringify(T.own)}`) && (await text(".set-count")) === T.change, await text(".set-count"));
    check(`[${tag}] Box zeigt den eigenen Prompt, "Standard" aktiv, Zusammenfassung`, (await text(".aip-box")).startsWith("Kurz auf {language}.") && !(await ev(`return r.querySelector('[data-set="prompt-default"]').disabled`)) && (await text('[data-id="ai"] .set-sec-sum')) === T.sumOwn, await text('[data-id="ai"] .set-sec-sum'));
    if (!mobile) await p.screenshot({ path: `${outDir}/prompt-section-${tag.replace("/", "-")}.png` });
    check(`[${tag}] gespeichert: set_options mit dem Prompt`, await savedThenClose() && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ ai_prompt: MINE }), JSON.stringify((await calls("device_panel/set_options")).at(-1)?.values));

    // Neu öffnen: Profi-Modus ist an, weil ein eigener Prompt gilt; Standard zurück
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="ai"]');
    check(`[${tag}] erneut geöffnet: Schalter an, eigener Prompt`, (await ev(`return r.querySelector('input[data-set="expert"]').checked`)) && (await text(".aip-h")).endsWith(T.own));
    await tap('[data-set="prompt-default"]');
    check(`[${tag}] "Standard": Prompt zurück, eine Änderung`, (await text(".aip-h")).endsWith(T.def) && (await text(".set-count")) === T.change, `${await text(".aip-h")} / ${await text(".set-count")}`);
    check(`[${tag}] gespeichert: leer = Standard`, await savedThenClose() && JSON.stringify((await calls("device_panel/set_options")).at(-1).values) === JSON.stringify({ ai_prompt: "" }));
    // Schalter aus blendet nur aus
    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="ai"]');
    check(`[${tag}] wieder Standard: Schalter aus`, !(await ev(`return r.querySelector('input[data-set="expert"]').checked`)));
    await tap('dialog.settings .dlg-actions [data-set="close"]');

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
