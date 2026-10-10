// Gemeinsame Einstellungen der Panel-Suiten.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
