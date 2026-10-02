// Ansicht pro Benutzer (docs/mockups/view-v1): Desktop mit Popover
// "Spalten" (ein/aus, ziehen, Pfeiltasten, zurücksetzen), Sortieren im
// Spaltenkopf, "Gruppen | Liste"; Handy mit Zeile "Sortiert nach" und Blatt
// "Ansicht" (Sortierung, Richtung, Darstellung, Angaben auf der Karte).
// Gespeichert pro Benutzer (frontend/set_user_data), getrennt für Desktop
// und Handy, samt Filter-Chips. Deutsch und Englisch.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;
const TEXT = {
  de: {
    btn: "Spalten", status: "Status", area: "Bereich", battery: "Batterie", avail: "Verfügbarkeit 24 Std.", list: "Liste",
    sortDefault: "Standard (Ausfälle zuerst)", sortBattery: "Batterie", title: "Ansicht",
  },
  en: {
    btn: "Columns", status: "Status", area: "Area", battery: "Battery", avail: "Availability 24 h", list: "List",
    sortDefault: "Default (offline first)", sortBattery: "Battery", title: "View",
  },
};
const DEFAULT_COLS = "status,connection,avail,type,integration,battery,model,software,area,outages,via";

for (const lang of ["de", "en"]) {
  const T = TEXT[lang];
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    let f;
    const load = async () => {
      await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}&theme=${mobile ? "dark" : "light"}`);
      f = await (await p.waitForSelector("#panel-frame")).contentFrame();
      // Mindestens ein Gerät: ein gespeicherter Filter kann die Liste kürzen.
      await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 0`), null, { timeout: 15000 });
      // Matter-Geräte werden nach dem Laden zu Thread; erst dann prüfen.
      await f.waitForFunction(new Function(`return !!${R}.querySelector('.chip[data-conn="thread"]')`), null, { timeout: 5000 }).catch(() => {});
    };
    await load();
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const handle = async (sel) => (await f.evaluateHandle(new Function(`return ${R}.querySelector(${JSON.stringify(sel)})`))).asElement();
    const tap = async (sel) => { const h = await handle(sel); if (!h) throw new Error("fehlt: " + sel); await h.scrollIntoViewIfNeeded(); if (mobile) await h.tap(); else await h.click(); };
    const wait = (code) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: 5000 }).then(() => true, () => false);
    // Was HA gespeichert hat (der Nachbau legt es in die Sitzung des Tabs),
    // nicht der Aufruf-Log: der zeigt auf die lebenden Objekte des Panels.
    const lastSaved = () => p.evaluate(() => JSON.parse(sessionStorage.getItem("sim_user_data") || "{}").device_panel_view);
    const savedSoon = async (fn) => { for (let i = 0; i < 20; i++) { const v = await lastSaved(); if (v && fn(v)) return true; await p.waitForTimeout(100); } return false; };
    const center = async (sel) => {
      const box = await f.evaluate(new Function(`const b=${R}.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }`));
      const fr = await (await p.$("#panel-frame")).boundingBox();
      return { x: box.x + fr.x, y: box.y + fr.y };
    };
    const drag = async (fromSel, toSel) => {
      const a = await center(fromSel);
      const z = await center(toSel);
      const to = { x: z.x, y: z.y - 12 };
      if (!mobile) {
        await p.mouse.move(a.x, a.y);
        await p.mouse.down();
        for (let i = 1; i <= 8; i++) await p.mouse.move(a.x, a.y + ((to.y - a.y) * i) / 8);
        await p.mouse.up();
      } else {
        const cdp = await ctx.newCDPSession(p);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
        for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y + ((to.y - a.y) * i) / 8 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
        // Chrome 153 (CI) verschluckt kurz nach einer Touch-Folge per CDP den nächsten Klick.
        await p.waitForTimeout(1500);
      }
      await p.waitForTimeout(300);
    };

    if (!mobile) {
      const heads = () => ev(`return [...r.querySelectorAll("thead th")].map(t=>t.textContent.trim()).join("|")`);
      check(`[${tag}] Knopf "Spalten"`, (await ev(`return r.querySelector(".view-btn").textContent.trim()`)) === T.btn);
      await tap(".view-btn");
      check(`[${tag}] Popover offen mit allen Spalten`, (await wait(`return !r.querySelector(".cols-pop").hidden`)) && (await ev(`return [...r.querySelectorAll('.cols-pop [data-vtoggle]')].map(i=>i.dataset.key).join()`)) === DEFAULT_COLS);
      check(`[${tag}] aria-expanded`, (await ev(`return r.querySelector(".view-btn").getAttribute("aria-expanded")`)) === "true");
      // Bereich ein, Status aus
      await tap('.cols-pop [data-vtoggle="cols"][data-key="area"]');
      await tap('.cols-pop [data-vtoggle="cols"][data-key="status"]');
      const h1 = await heads();
      check(`[${tag}] Bereich ein, Status aus`, h1.endsWith(`|${T.area}`) && !h1.includes(`|${T.status}|`), h1);
      check(`[${tag}] Bereich nicht mehr unter dem Namen`, !(await ev(`return !!r.querySelector("tr.dev td:first-child .sub")`)));
      check(`[${tag}] Popover bleibt offen`, await ev(`return !r.querySelector(".cols-pop").hidden`));
      // Batterie nach oben ziehen (Maus)
      await drag('.cols-pop .vrow[data-key="battery"] .drag-h', '.cols-pop .vrow[data-key="status"] .drag-h');
      check(`[${tag}] Batterie nach oben gezogen`, (await heads()).split("|")[1] === T.battery, await heads());
      // Pfeiltaste: Batterie eins nach unten, Fokus bleibt am Griff
      await (await handle('.cols-pop [data-vdrag][data-key="battery"]')).focus();
      await p.keyboard.press("ArrowDown");
      check(`[${tag}] Pfeiltaste verschiebt`, (await ev(`return [...r.querySelectorAll('.cols-pop [data-vtoggle]')].map(i=>i.dataset.key).slice(0,2).join()`)) === "status,battery" && (await ev(`return r.activeElement?.dataset.key === "battery"`)));
      check(`[${tag}] gespeichert (Desktop)`, await savedSoon((v) => v.desktop.cols[1][0] === "battery" && v.desktop.cols.find(([k]) => k === "area")[1] === true && v.mobile.cols[0][0] === "status"));
      await p.screenshot({ path: `${outDir}/view-cols-${tag.replace("/", "-")}.png` });
      // Escape schliesst, auch direkt nach einem Schalter (Neuaufbau ersetzt
      // das fokussierte Element; im echten HA blieb das Popover sonst offen).
      await tap('.cols-pop [data-vtoggle="cols"][data-key="via"]');
      await tap('.cols-pop [data-vtoggle="cols"][data-key="via"]');
      check(`[${tag}] Fokus bleibt am Schalter`, await ev(`return r.activeElement?.dataset.vtoggle === "cols" && r.activeElement?.dataset.key === "via"`));
      await p.keyboard.press("Escape");
      check(`[${tag}] Escape schliesst`, await wait(`return r.querySelector(".cols-pop").hidden`));
      // Zurücksetzen
      await tap(".view-btn");
      await tap('.cols-pop [data-vreset="cols"]');
      check(`[${tag}] Zurücksetzen`, (await ev(`return [...r.querySelectorAll('.cols-pop [data-vtoggle]')].map(i=>i.dataset.key+(i.checked?"+":"-")).join()`)) === "status+,connection+,avail+,type+,integration+,battery+,model+,software+,area-,outages-,via-");
      // Klick ausserhalb schliesst, ohne das Gerät zu öffnen
      await tap('tr.dev td:nth-child(3)');
      check(`[${tag}] Klick ausserhalb schliesst nur die Auswahl`, (await wait(`return r.querySelector(".cols-pop").hidden`)) && !(await ev(`return r.querySelector("dialog.device").open`)));

      // Sortieren im Kopf: auf, ab, Standard
      const availInGroup = () => ev(`const out=[]; let g=-1; for (const tr of r.querySelectorAll("tbody tr")) { if (tr.classList.contains("grp")) { g++; out.push([]); continue; } const m=tr.children[3].textContent.replace(",",".").match(/\\d+(\\.\\d+)?/); out[g].push(m?Number(m[0]):null); } return out;`);
      await tap('th .th-sort[data-sort="avail"]');
      let groups = await availInGroup();
      const sortedAsc = (g) => g.filter((x) => x != null).every((v, i, a) => i === 0 || a[i - 1] <= v);
      check(`[${tag}] Verfügbarkeit aufsteigend in den Gruppen`, groups.every(sortedAsc) && (await ev(`return r.querySelector("th.sorted")?.getAttribute("aria-sort")`)) === "ascending", JSON.stringify(groups));
      await tap('th .th-sort[data-sort="avail"]');
      groups = await availInGroup();
      check(`[${tag}] absteigend`, groups.every((g) => sortedAsc([...g.filter((x) => x != null)].reverse())) && (await ev(`return r.querySelector("th.sorted")?.getAttribute("aria-sort")`)) === "descending", JSON.stringify(groups));
      await tap('th .th-sort[data-sort="avail"]');
      check(`[${tag}] dritter Klick: Standard`, !(await ev(`return !!r.querySelector("th.sorted")`)) && (await ev(`return r.querySelector("tr.dev").textContent.includes("Temperatur Keller")`)));

      // Liste ohne Gruppen, nach Batterie
      await tap('.chips [data-flat="1"]');
      await tap('th .th-sort[data-sort="battery"]');
      const bats = await ev(`return [...r.querySelectorAll("tr.dev")].map(tr=>{const m=tr.children[6].textContent.match(/(\\d+) %/); return m?Number(m[1]):null})`);
      const withVal = bats.filter((x) => x != null);
      check(`[${tag}] Liste ohne Gruppen`, !(await ev(`return !!r.querySelector("tr.grp")`)) && (await ev(`return r.querySelector('.chips [data-flat="1"]').classList.contains("on")`)));
      check(`[${tag}] Batterie aufsteigend, ohne Wert am Ende`, withVal.every((v, i) => i === 0 || withVal[i - 1] <= v) && bats.indexOf(null) === withVal.length, JSON.stringify(bats));
      // Filter-Chip gehört zur Ansicht
      await tap('.chip[data-conn="wifi"]');
      check(`[${tag}] gespeichert mit Liste, Sortierung, Filter`, await savedSoon((v) => v.desktop.flat === true && v.desktop.sort === "battery" && v.desktop.conn === "wifi" && v.mobile.flat === false && v.mobile.conn === "all"));
      await p.screenshot({ path: `${outDir}/view-list-${tag.replace("/", "-")}.png` });

      // Neu laden ohne lokale Kopie: Stand kommt von HA
      await ev(`localStorage.removeItem("device_panel_view")`);
      await load();
      check(`[${tag}] nach Neuladen von HA: Liste, Batterie, WLAN`, await wait(`return !r.querySelector("tr.grp") && r.querySelector('th.sorted .th-sort')?.dataset.sort === "battery" && r.querySelector('.chip[data-conn="wifi"]').classList.contains("on")`),
        await ev(`return JSON.stringify({ grp: !!r.querySelector("tr.grp"), sorted: r.querySelector('th.sorted .th-sort')?.dataset.sort, wifi: r.querySelector('.chip[data-conn="wifi"]')?.className, view: r.host._view })`));
      // Lokale Kopie neuer als HA (Änderung kurz vor dem Neuladen): sie
      // gilt und geht an HA.
      await ev(`const v=JSON.parse(localStorage.getItem("device_panel_view")); v.desktop.conn="cloud"; v.updated=Date.now()+1000; localStorage.setItem("device_panel_view", JSON.stringify(v))`);
      await load();
      check(`[${tag}] neuere lokale Kopie gilt`, await wait(`return r.querySelector('.chip[data-conn="cloud"]').classList.contains("on")`));
      check(`[${tag}] und geht an HA`, await savedSoon((v) => v.desktop.conn === "cloud"));
      await tap('.chip[data-conn="wifi"]');
      await savedSoon((v) => v.desktop.conn === "wifi");
      // Handy hat seine eigene Ansicht
      await p.setViewportSize({ width: 390, height: 844 });
      check(`[${tag}] schmal: eigene Ansicht (Gruppen, Standard, Alle)`, await wait(`return !!r.querySelector(".gh") && r.querySelector(".sort-btn")?.textContent.includes(${JSON.stringify(T.sortDefault)}) && r.querySelector('.chip[data-conn="all"]').classList.contains("on")`));
      await p.setViewportSize({ width: 1400, height: 1000 });
      check(`[${tag}] breit: wieder Desktop`, await wait(`return !r.querySelector("tr.grp") && r.querySelector('.chip[data-conn="wifi"]').classList.contains("on")`));
    } else {
      const sortText = () => ev(`return r.querySelector(".sort-btn").textContent.trim()`);
      check(`[${tag}] Zeile "Sortiert nach"`, (await sortText()) === T.sortDefault, await sortText());
      await tap(".view-btn");
      check(`[${tag}] Blatt "Ansicht"`, (await wait(`return r.querySelector("dialog.view").open`)) && (await ev(`return r.querySelector("dialog.view h2").textContent`)) === T.title);
      await tap('dialog.view [data-vsort="battery"]');
      check(`[${tag}] Batterie gewählt`, (await sortText()).startsWith(T.sortBattery) && (await ev(`return r.querySelector('dialog.view [data-vsort="battery"]').classList.contains("on")`)));
      await p.screenshot({ path: `${outDir}/view-sheet-${tag.replace("/", "-")}.png` });
      // Angaben: Verbindung aus, Bereich aus, Batterie ein
      await tap('dialog.view [data-vtoggle="fields"][data-key="connection"]');
      await tap('dialog.view [data-vtoggle="fields"][data-key="area"]');
      await tap('dialog.view [data-vtoggle="fields"][data-key="battery"]');
      // Batterie per Finger ganz nach oben
      await drag('dialog.view .vrow[data-key="battery"] .drag-h', 'dialog.view .vrow[data-key="connection"] .drag-h');
      check(`[${tag}] Batterie zuoberst`, (await ev(`return r.querySelector('dialog.view .vlist .vrow')?.dataset.key`)) === "battery");
      await tap('dialog.view .dlg-actions [data-vdone]');
      check(`[${tag}] Fertig schliesst`, await wait(`return !r.querySelector("dialog.view").open`));
      const card = await ev(`const c=[...r.querySelectorAll(".mc")].find(x=>x.textContent.includes("Temperatur Keller")); return { sb: !!c.querySelector(".sb"), meta: c.querySelector(".sb2")?.textContent || "" }`);
      check(`[${tag}] Karte ohne Verbindungszeile, Batterie vorn, ohne Bereich`, !card.sb && card.meta.trim().startsWith("0 %") && !card.meta.includes("Keller"), JSON.stringify(card));
      // Gruppen: nach Batterie innerhalb der Gruppen
      const off = await ev(`return [...r.querySelectorAll(".mc.off")].map(c=>c.querySelector(".nm").textContent.trim())`);
      check(`[${tag}] Ausgefallene nach Batterie`, JSON.stringify(off) === JSON.stringify(["Temperatur Keller", "Bewegungsmelder Flur", "Thermostat Bad", "Steckdose Terrasse"]), JSON.stringify(off));
      // Richtung absteigend und Liste
      await tap(".sort-btn");
      await wait(`return r.querySelector("dialog.view").open`);
      await tap('dialog.view [data-vdir="desc"]');
      await tap('dialog.view [data-vflat="1"]');
      await tap('dialog.view .dlg-actions [data-vdone]');
      await wait(`return !r.querySelector("dialog.view").open`);
      const names = await ev(`return [...r.querySelectorAll(".dev")].map(d=>(d.querySelector(".nm")||d.children[1]).childNodes[0].textContent.trim())`);
      check(`[${tag}] Liste ohne Köpfe, höchste Batterie zuerst`, !(await ev(`return !!r.querySelector(".gh")`)) && names[0].startsWith("Rauchmelder Flur"), names.slice(0, 3).join(" | "));
      check(`[${tag}] gespeichert (Handy)`, await savedSoon((v) => v.mobile.sort === "battery" && v.mobile.dir === "desc" && v.mobile.flat === true && v.mobile.fields[0][0] === "battery" && v.desktop.sort === "default"));
      await ev(`r.querySelector(".content").scrollTop = r.querySelector(".chips").offsetTop - 80`);
      await p.screenshot({ path: `${outDir}/view-list-${tag.replace("/", "-")}.png` });
      // Zurücksetzen im Blatt
      await tap(".view-btn");
      await wait(`return r.querySelector("dialog.view").open`);
      await tap('dialog.view [data-vreset]');
      check(`[${tag}] Zurücksetzen im Blatt`, (await sortText()) === T.sortDefault && (await ev(`return !!r.querySelector(".gh") && r.querySelector('dialog.view .vlist .vrow').dataset.key === "connection"`)));
      // Tipp auf den Hintergrund schliesst
      await p.mouse.click(195, 120);
      check(`[${tag}] Hintergrund schliesst`, await wait(`return !r.querySelector("dialog.view").open`));
    }
    check(`[${tag}] kein fehlender Text`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
