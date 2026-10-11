// Emoji im Titel der Push-Meldungen (2.2.0): je Meldung ein Feld über der Vorschau (Ausfall:
// Ausgefallen, Sammelausfall, Wieder online; Batterie; Laden: Geladen, Ladung beendet; Neu;
// Updates), höchstens 3 sichtbare Zeichen, leer erlaubt, "Standard" setzt zurück, Vorschau
// folgt beim Tippen, Speichern schickt null für den Standard. Deutsch und Englisch, Desktop
// und Handy, echte Eingaben und Taps.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: { title: "Emoji im Titel", reset: "Standard", none: "kein Emoji", outage: "Ausgefallen: Temperatur Keller", labels: "Ausgefallen|Sammelausfall|Wieder online" },
  en: { title: "Emoji in the title", reset: "Default", none: "no emoji", outage: "Offline: Temperatur Keller", labels: "Offline|Group outage|Back online" },
};
const DEFAULTS = { outage: "🔴", group: "🚨", online: "🟢", battery: "🪫", charge: "🔋", charge_stop: "🔌", new: "✨", updates: "⬆️" };

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
    // Nach einem Schalter baut das Panel die Seite neu auf: kurz vor dem Tipp kann das Element
    // verschwinden; dann noch einmal mit dem neuen Element versuchen.
    const tap = async (sel) => {
      for (let i = 0; ; i++) {
        try {
          const h = await handle(sel);
          if (!h) throw new Error("fehlt: " + sel);
          await h.scrollIntoViewIfNeeded();
          if (mobile) await h.tap(); else await h.click();
          return;
        } catch (err) {
          if (i >= 3 || !/not attached|detached/.test(String(err))) throw err;
          await new Promise((ok) => setTimeout(ok, 150));
        }
      }
    };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    const tab = async (key) => { await tap(`[data-set="tab"][data-key="${key}"]`); await wait(`return r.querySelector('.mon-tab.on')?.dataset.key === "${key}"`); };
    const typeIn = async (kind, value) => { const h = await handle(`[data-emoji="${kind}"]`); await h.scrollIntoViewIfNeeded(); await h.fill(value); };
    const val = (kind) => ev(`return r.querySelector('[data-emoji="${kind}"]')?.value ?? null`);
    const resetOff = (kind) => ev(`return r.querySelector('.emo-reset[data-key="${kind}"]')?.disabled ?? null`);
    const pvTitle = () => ev(`return r.querySelector(".pv-title")?.textContent || ""`);
    const wsSets = () => p.evaluate(() => window.__wsCalls.filter((m) => m.type === "device_panel/set_options").map((m) => m.values));

    await tap(".gear-btn");
    await wait(`return !!r.querySelector("dialog.settings .set-sec")`);
    await tap('[data-set="section"][data-id="monitor"]');
    await tab("outage");

    // Ausfall: drei Felder mit den bisherigen Emojis, zwischen Hinweis und Vorschau
    const kinds = await ev(`return [...r.querySelectorAll("[data-emoji]")].map(i=>i.dataset.emoji).join()`);
    check(`[${tag}] Ausfall: Felder ausgefallen, Sammelausfall, wieder online`, kinds === "outage,group,online", kinds);
    check(`[${tag}] Standardwerte 🔴 🚨 🟢, Knopf "${T.reset}" aus`, (await val("outage")) === "🔴" && (await val("group")) === "🚨" && (await val("online")) === "🟢" && (await resetOff("outage")) === true);
    check(`[${tag}] Titel "${T.title}", Beschriftungen`, (await ev(`return r.querySelector(".emo-box .opt-label").textContent`)) === T.title && (await ev(`return [...r.querySelectorAll(".emo-l")].map(x=>x.textContent).join("|")`)) === T.labels);
    check(`[${tag}] Platz: nach dem Hinweis, vor der Vorschau`, await ev(`const note=r.querySelector(".nf-note"), box=r.querySelector(".emo-box"), pv=r.querySelector(".pv"); const pos=(a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING; return !!note && !!box && pos(note, box) > 0 && (!pv || pos(box, pv) > 0)`));
    check(`[${tag}] Platzhalter "${T.none}"`, (await ev(`return r.querySelector('[data-emoji="outage"]').placeholder`)) === T.none);

    // Vorschau braucht den eingeschalteten Push
    await tap('input[data-opt="notify_outage"]');
    await wait(`return !!r.querySelector(".pv-title")`);
    check(`[${tag}] Vorschau mit Standard-Emoji`, (await pvTitle()) === `🔴 ${T.outage}`, await pvTitle());

    // Tippen: Vorschau folgt, Entwurf zählt als Änderung
    await typeIn("outage", "🔥");
    check(`[${tag}] 🔥: Vorschau, Knopf "${T.reset}" an, Änderung gezählt`, (await pvTitle()) === `🔥 ${T.outage}` && (await resetOff("outage")) === false && /^2 /.test(await ev(`return r.querySelector(".set-count").textContent`)), await ev(`return r.querySelector(".set-count").textContent`));
    check(`[${tag}] Reiter "Ausfall" mit Punkt`, await ev(`return r.querySelector('.mon-tab[data-key="outage"]').classList.contains("chg")`));

    // Höchstens 3 sichtbare Zeichen; Emoji aus mehreren Codepunkten zählen als eins
    await typeIn("outage", "abcd");
    check(`[${tag}] "abcd" wird auf 3 Zeichen gekürzt`, (await val("outage")) === "abc" && (await pvTitle()) === `abc ${T.outage}`, `${await val("outage")} | ${await pvTitle()}`);
    await typeIn("outage", "⬆️✨🔴");
    check(`[${tag}] ⬆️✨🔴 (drei sichtbare Zeichen) bleiben`, (await val("outage")) === "⬆️✨🔴" && (await pvTitle()) === `⬆️✨🔴 ${T.outage}`);
    await typeIn("outage", "👨‍👩‍👧🇨🇭1️⃣🔴");
    check(`[${tag}] vier sichtbare Zeichen: das vierte fällt weg`, (await val("outage")) === "👨‍👩‍👧🇨🇭1️⃣", await val("outage"));

    // Leer: ohne Emoji
    await typeIn("outage", "");
    check(`[${tag}] leer: Titel ohne Emoji, Knopf "${T.reset}" an`, (await pvTitle()) === T.outage && (await resetOff("outage")) === false && (await val("outage")) === "");

    // Standard
    await tap('.emo-reset[data-key="outage"]');
    await wait(`return r.querySelector('[data-emoji="outage"]').value === "🔴"`);
    check(`[${tag}] "${T.reset}": zurück auf 🔴, Knopf aus, Vorschau wie vorher`, (await val("outage")) === "🔴" && (await resetOff("outage")) === true && (await pvTitle()) === `🔴 ${T.outage}`, `${await val("outage")} ${await resetOff("outage")} ${await pvTitle()}`);

    // Das Standard-Emoji von Hand tippen = Standard (nichts zu speichern ausser dem Schalter)
    await typeIn("group", "🚨");
    check(`[${tag}] Standard-Emoji getippt: Knopf bleibt aus`, (await resetOff("group")) === true);

    // Speichern: eigenes, leeres und Standard (null)
    await typeIn("outage", "🔥");
    await typeIn("online", "");
    await tap('[data-set="save"]');
    await wait(`return !r.querySelector('[data-set="save"]')?.disabled === false || !!r.querySelector(".set-count.saved")`);
    await wait(`return !!r.querySelector(".set-count.saved") || r.querySelector(".set-count")?.textContent === ""`);
    const sent = (await wsSets()).find((v) => "emoji_outage" in v);
    check(`[${tag}] Speichern: emoji_outage "🔥", emoji_online ""`, sent && sent.emoji_outage === "🔥" && sent.emoji_online === "" && !("emoji_group" in sent), JSON.stringify(sent));
    await tab("outage");
    check(`[${tag}] nach dem Speichern: 🔥 und leer, Standard-Knopf an`, (await val("outage")) === "🔥" && (await val("online")) === "" && (await resetOff("outage")) === false && (await resetOff("online")) === false);
    await tap('.emo-reset[data-key="outage"]');
    await tap('.emo-reset[data-key="online"]');
    await tap('[data-set="save"]');
    await wait(`return !!r.querySelector(".set-count.saved")`);
    const back = (await wsSets()).filter((v) => "emoji_outage" in v).pop();
    check(`[${tag}] Standard speichern: null`, back && back.emoji_outage === null && back.emoji_online === null, JSON.stringify(back));
    check(`[${tag}] danach wieder Standard`, (await val("outage")) === "🔴" && (await val("online")) === "🟢");

    // Übrige Reiter: je ein Feld bzw. zwei, mit den bisherigen Emojis
    for (const [key, expect] of [["battery", ["battery"]], ["charge", ["charge", "charge_stop"]], ["new", ["new"]], ["updates", ["updates"]]]) {
      await tab(key);
      // Laden: die Felder gehören zur eingeschalteten Meldung (wie der Rest des Reiters)
      if (key === "charge") { await tap('input[data-opt="notify_charge"]'); await wait(`return !!r.querySelector("[data-emoji]")`); }
      const got = await ev(`return [...r.querySelectorAll("[data-emoji]")].map(i=>i.dataset.emoji).join()`);
      const vals = await ev(`return [...r.querySelectorAll("[data-emoji]")].map(i=>i.value).join()`);
      check(`[${tag}] Reiter ${key}: Felder ${expect.join("+")}, Standard`, got === expect.join() && vals === expect.map((k) => DEFAULTS[k]).join(), `${got} ${vals}`);
    }
    // Batterie: Vorschau folgt dem Feld (Push einschalten)
    await tab("battery");
    await tap('input[data-opt="battery_push"]');
    await wait(`return !!r.querySelector(".pv-title")`);
    await typeIn("battery", "🔥");
    check(`[${tag}] Batterie: Vorschau mit 🔥`, (await pvTitle()).startsWith("🔥 "), await pvTitle());
    await p.screenshot({ path: `${outDir}/emoji-${tag.replace("/", "-")}.png` });

    check(`[${tag}] keine Skriptfehler`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
