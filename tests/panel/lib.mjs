// Gemeinsame Einstellungen der Panel-Suiten.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

// Chromium: eigener Pfad über CHROMIUM_PATH, sonst der von
// "npx playwright-core install chromium" installierte Browser.
export const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

// Bildschirmfotos der Suiten (nicht im Repository, siehe .gitignore).
export const outDir = process.env.UDC_TEST_OUT || fileURLToPath(new URL("./output", import.meta.url));
mkdirSync(outDir, { recursive: true });

// Im Geräte-Popup sind die Einstellungen seit 1.42.0 auf Unterreiter verteilt (Ausfall, Batterie, Laden, Empfang).
// Die Suiten greifen über Selektoren wie data-dlg="dev-bat" auf die Zeilen zu: vor dem Zugriff wird der Unterreiter
// gewählt, zu dem der Selektor gehört (nichts zu tun, wenn er schon offen ist oder das Popup keine Reiter hat).
const DEV_TAB = { off: "out", notify: "out", bat: "bat", charge: "chg", sig: "sig" };
export async function ensureDevTab(frame, root, code) {
  const m = /data-dlg=\\?["']dev-(off|notify|bat|charge|sig)/.exec(String(code)) || /dev-(off|notify|bat|charge|sig)(?:-|["'\]])/.exec(String(code));
  if (!m) return;
  const tab = DEV_TAB[m[1]];
  await frame.evaluate(new Function(`const r=${root}; const b=r.querySelector('dialog.device [data-stab="${tab}"]'); if (b && !b.classList.contains("on")) b.click();`));
}

// Im Detail einer Integration (seit 1.42.0 Reiter Ausfall, Batterie, Laden, Neu, Empfang, Geräte) gilt dasselbe:
// vor dem Zugriff wird der Reiter gewählt, zu dem der Selektor gehört (nur wenn ein Detail offen ist).
const INTEG_TAB = [
  [/data-bat-mode|data-bat[=\]]|data-bat-error|battery_push_exclude_integrations|data-bat="|bat-ctl|bat-row/, "bat"],
  [/data-cinteg|data-cfull-integ|data-crise-integ|data-cstall-integ|data-cstop-integ/, "chg"],
  [/new_exclude_integrations/, "new"],
  [/data-sig-mode|data-sig[=\]]|data-sig="|sig-intro/, "sig"],
  [/ovr-row|ovr-list|ovr-one|ovr-x/, "dev"],
  [/data-imon|data-off-mode|notify_exclude_integrations|persistent_exclude_integrations/, "out"],
];
export async function ensureIntegTab(frame, root, code) {
  const text = String(code);
  const hit = INTEG_TAB.find(([re]) => re.test(text));
  if (!hit) return;
  await frame.evaluate(new Function(`const r=${root}; const b=r.querySelector('[data-set="isub"][data-key="${hit[1]}"]'); if (b && !b.classList.contains("on")) b.click();`));
}

// Seit 2.20.0 gelten Änderungen im Geräte-Popup erst mit "Speichern". Suiten, die danach die gesendeten Aufrufe prüfen,
// speichern vorher einen offenen Entwurf (nichts zu tun, wenn keiner da ist). Das "nichts gesendet vor Speichern"
// prüfen savecheck-e2e und devset-e2e.
export async function savePending(frame, root) {
  const clicked = await frame.evaluate(new Function(`const r=${root}; const d=r.querySelector("dialog.device"); const b=d?.open && d.querySelector('[data-dlg="save"]:not([disabled])'); if (b) b.click(); return !!b;`));
  if (clicked) await frame.waitForFunction(new Function(`const r=${root}; return !!r.querySelector("dialog.device .set-count.saved") || !r.querySelector('dialog.device [data-dlg="save"]')`), null, { timeout: 5000 }).catch(() => {});
}

// Unter Last zeichnet das Panel Elemente zwischen "Handle holen" und "Tippen" neu ("not attached", "not stable", "intercepts pointer events").
// Die Suiten holen ihre Handles selbst; damit nicht jede einen eigenen Wiederholer braucht, setzt der erste Start des Browsers einmalig eine
// Wiederholung auf click/tap/scrollIntoViewIfNeeded. Ein abgehängtes Element wird über denselben evaluateHandle-Aufruf neu geholt.
const RETRY = /not stable|intercepts pointer events|not attached/;
const launch = chromium.launch.bind(chromium);
const origin = new WeakMap();
let patched = false;
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  if (!patched) {
    patched = true;
    const page = await browser.newPage();
    const frame = page.mainFrame();
    const fproto = Object.getPrototypeOf(frame);
    const evalHandle = fproto.evaluateHandle;
    fproto.evaluateHandle = async function (...a) {
      const h = await evalHandle.apply(this, a);
      const el = h.asElement();
      if (el) origin.set(el, { frame: this, args: a });
      return h;
    };
    const proto = Object.getPrototypeOf((await frame.evaluateHandle(() => document.body)).asElement());
    for (const name of ["click", "tap", "scrollIntoViewIfNeeded"]) {
      const orig = proto[name];
      proto[name] = async function (...a) {
        let el = this;
        for (let i = 0; ; i++) {
          try { return await orig.apply(el, a); }
          catch (e) {
            if (i >= 4 || !RETRY.test(e.message)) throw e;
            await new Promise((r) => setTimeout(r, 150));
            const o = origin.get(this);
            if (/not attached/.test(e.message) && o) { const fresh = (await evalHandle.apply(o.frame, o.args)).asElement(); if (fresh) el = fresh; }
          }
        }
      };
    }
    await page.close();
  }
  return browser;
};
