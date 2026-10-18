// Easter Egg (2.89.0, Wunsch des Nutzers): fünf schnelle Klicks aufs Logo oben links, dann schlägt ein Herz im Puls-Diagramm einige Sekunden lang.
// Weniger Klicks oder zu langsame zählen nicht; das Overlay übersteht den laufenden Neuaufbau der Kachel, verschwindet nach der Zeit von selbst und
// stört weder Tippen auf die Kachel noch die Anzeige. Deutsch und Englisch, Desktop und Handy.
import { chromium } from "playwright-core";
import { launchOptions } from "../lib.mjs";

const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("device-panel").shadowRoot`;

for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "mobile" : "desktop"}`;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`http://127.0.0.1:8950/ha-sim.html?lang=${lang}`);
    const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f.waitForFunction(new Function(`return ${R}?.querySelectorAll(".dev").length > 1`), null, { timeout: 15000 });
    const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
    const wait = (code, ms = 5000) => f.waitForFunction(new Function(`const r=${R};` + code), null, { timeout: ms }).then(() => true, () => false);
    const logo = async () => (await f.evaluateHandle(new Function(`return ${R}.querySelector(".tb-main > svg")`))).asElement();
    // Die Klicks kommen aus der Seite selbst: echte Klicks von Playwright dauern unter Last je einige hundert ms und lägen ausserhalb des Fensters von 1,5 s
    const click = (n, gap) => f.evaluate(async ({ n, gap, root }) => {
      const svg = document.querySelector("device-panel").shadowRoot.querySelector(".tb-main > svg");
      for (let i = 0; i < n; i++) { svg.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })); await new Promise((r) => setTimeout(r, gap)); }
      void root;
    }, { n, gap, root: R });
    void logo;
    const on = () => ev(`return !!r.querySelector(".pchart.ee .ee-ecg") && r.querySelector(".kt.pul")?.classList.contains("ee")`);

    check(`[${tag}] ohne Klicks: kein Herzschlag`, !(await on()));
    await click(4, 100);
    check(`[${tag}] vier Klicks: noch nichts`, !(await on()));
    await p.waitForTimeout(1700);
    await click(1, 100);
    check(`[${tag}] fünfter Klick zu spät (Zähler läuft nach 1,5 s ab): nichts`, !(await on()));
    await p.waitForTimeout(1700);
    await click(5, 150);
    check(`[${tag}] fünf schnelle Klicks: der Herzschlag erscheint im Puls-Diagramm`, await wait(`return !!r.querySelector(".pchart.ee .ee-ecg path")`));
    check(`[${tag}] das Diagramm tritt zurück, die Kachel trägt die Klasse, die Linie ist aufgedeckt (Animation läuft)`, await ev(`const s = r.querySelector(".ee-ecg"); return r.querySelector(".kt.pul").classList.contains("ee") && getComputedStyle(s).animationName.includes("ee-reveal") && getComputedStyle(r.querySelector(".pchart .line")).opacity === "0.25"`));
    // Neuaufbau der Kachel (Abfrage, Minutentakt): das Overlay bleibt
    await ev(`r.host._render()`);
    await p.waitForTimeout(300);
    check(`[${tag}] nach einem Neuaufbau noch da, die Phase springt nicht zurück (negative Verzögerung)`, await ev(`const s = r.querySelector(".ee-ecg"); return !!s && parseFloat(getComputedStyle(s).animationDelay) < 0`));
    check(`[${tag}] ohne Skriptfehler, nur ein Overlay`, (await ev(`return r.querySelectorAll(".ee-ecg").length === 1`)) && errors.length === 0, errors.join("; "));
    await p.screenshot({ path: `/tmp/heartbeat-${tag.replace("/", "-")}.png` }).catch(() => {});
    // Von selbst weg nach rund 5,4 s
    check(`[${tag}] nach einigen Sekunden von selbst weg`, await wait(`return !r.querySelector(".ee-ecg") && !r.querySelector(".pchart.ee")`, 9000));
    // Noch einmal: lässt sich wiederholen
    await click(5, 100);
    check(`[${tag}] lässt sich wiederholen`, await wait(`return !!r.querySelector(".pchart.ee .ee-ecg")`));
    check(`[${tag}] kein fehlender Text, keine JS-Fehler`, !(await ev(`return r.innerHTML.includes("undefined") || r.innerHTML.includes("NaN")`)) && errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASSED" : "SOME FAILED");
process.exit(ok ? 0 : 1);
