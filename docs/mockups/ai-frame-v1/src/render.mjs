// Mockups "KI-Bereich abgrenzen" (Wunsch des Nutzers, 2026-10-15): Einschätzung, Rückfragen und Chat fliessen optisch in die
// Abschnitte darunter (Verbindung, Gerät) und sind nicht klar abgegrenzt. Drei Varianten:
//   A: der ganze KI-Bereich in einem Rahmen mit Kopfzeile "KI-Einschätzung" (Empfehlung).
//   B: Akzentleiste links über den ganzen Bereich, getönter Grund, Marke "KI".
//   C: zwei Karten: die Einschätzung wie bisher, die Rückfragen in einer eigenen Karte, KI-Marke an der Überschrift.
// Im echten Panel (Nachbau aus tests/panel, erfundene Daten), Zusätze eingesetzt.
// Aufruf: CHROMIUM_PATH=... node docs/mockups/ai-frame-v1/src/render.mjs
import { setup } from "../../_lib/mock.mjs";
const { page, shot, compose, close } = await setup(8970, import.meta.url);

const SPARK = "M12,1L9,9L1,12L9,15L12,23L15,15L23,12L15,9L12,1Z";
const spark = (s = 15) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${SPARK}"/></svg>`;
const CSS = `
.mkA { border: 1.5px solid color-mix(in srgb, #7c4dff 55%, var(--dp-divider)); border-radius: 18px; background: color-mix(in srgb, #7c4dff 7%, var(--dp-card)); overflow: hidden; gap: 0 !important; margin-top: 4px; }
.mkA .mk-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: color-mix(in srgb, #7c4dff 20%, var(--dp-card)); color: var(--dp-text); font-weight: 600; font-size: 14px; }
.mkA .mk-head svg { color: #b39dff; }
.mkA .mk-head small { margin-left: auto; color: var(--dp-text2); font-weight: 400; font-size: 12px; }
.mkA .ai-card { border: 0; background: transparent; border-radius: 0; padding: 14px 14px 4px; }
.mkA > .opt-short { padding: 0 14px 12px; }
.mkA .ai-ask { margin: 0; padding: 12px 14px 14px; border-top: 1px dashed color-mix(in srgb, #7c4dff 45%, var(--dp-divider)); }
.mkB { border-left: 5px solid #7c4dff; border-radius: 6px 18px 18px 6px; background: color-mix(in srgb, #7c4dff 9%, var(--dp-card)); padding: 12px 14px 14px 14px; gap: 8px; margin: 4px 0 6px; }
.mkB .mk-tag { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: #7c4dff; color: #fff; font-size: 12px; font-weight: 600; letter-spacing: .04em; }
.mkB .ai-card { border: 0; background: transparent; padding: 0; }
.mkB .ai-ask { padding-top: 10px; border-top: 1px solid color-mix(in srgb, #7c4dff 30%, var(--dp-divider)); }
.mkC-h { display: flex; align-items: center; gap: 8px; }
.mkC-h b { padding: 2px 9px; border-radius: 999px; background: #7c4dff; color: #fff; font-size: 11.5px; letter-spacing: .04em; }
.mkC .ai-ask { background: var(--dp-subtle); border-radius: 16px; padding: 12px 14px 14px; margin-top: 10px; border: 1px solid var(--dp-divider); }
.mkC { margin-bottom: 18px; }
`;
const ASKS = [
  { q: "Läuft der Router nachts neu?", a: "Die Ausfälle liegen zwischen 02:50 und 03:10 Uhr. Das spricht für einen nächtlichen Vorgang im Netz, nicht für das Gerät." },
];
const TEXT = "Der Melder hatte heute kurze Unterbrüche und schwachen Empfang.\n\n– Position des Empfängers prüfen\n\nSicherheit: mittel";

async function variant(name, apply, scroll = 0) {
  const { ctx, p, ev } = await page(true, { css: CSS, width: 402, height: 874, freeze: true });
  await p.evaluate(() => { window.__opts.ai_assessment = true; });
  await ev(`r.host._aiOn = true; r.host._ai.set("a", { state: "done", title: "Router oder Funkstrecke prüfen", text: ${JSON.stringify(TEXT)}, source: "Google AI Task", at: new Date().toISOString(), asks: ${JSON.stringify(ASKS)}, next: ["Wie alt ist die Batterie?", "Was heisst Median?", "Wie weit darf der Router weg sein?"] }); r.querySelector('.dev[data-open="a"]').click()`);
  await p.waitForTimeout(700);
  await ev(`const d = r.querySelector("dialog.device"); r.host._devForce = true; r.host._renderDevice(); for (const n of d.querySelectorAll(".ai-box > .opt-short")) n.remove(); ${apply}
    const sc = [d, d.querySelector(".dlg-body")].find((x) => x && x.scrollHeight > x.clientHeight + 5) || d;
    const t = d.querySelector(".ai-box").getBoundingClientRect().top - 26; sc.scrollTop += t - 232 + ${scroll};`);
  await p.waitForTimeout(400);
  const f = await shot(p, true, name);
  await ctx.close();
  return f;
}
const HEAD = (src) => `<div class="mk-head">${spark(16)}KI-Einschätzung<small>${src}</small></div>`;
const hide = `const h = d.querySelector(".ai-box").previousElementSibling; h.style.display = "none"; const box = d.querySelector(".ai-box");`;
const APPLY = {
  A: `${hide} box.classList.add("mkA"); box.insertAdjacentHTML("afterbegin", ${JSON.stringify(HEAD("Google AI Task"))});`,
  B: `${hide} box.classList.add("mkB"); box.insertAdjacentHTML("afterbegin", ${JSON.stringify(`<span class="mk-tag">${spark(13)}KI</span>`)});`,
  C: `const h = d.querySelector(".ai-box").previousElementSibling; h.innerHTML = ${JSON.stringify(`<span class="mkC-h">Einschätzung <b>KI</b></span>`)}; d.querySelector(".ai-box").classList.add("mkC");`,
};
const files = {};
// Oberkante (Kopf des Bereichs) und Unterkante (Übergang zu "Verbindung")
for (const [key, scroll] of [["", 0], ["2", 330]]) for (const v of ["A", "B", "C"]) files[v + key] = await variant(v + key, APPLY[v], scroll);
await compose("1-Varianten.png", [
  [files.A, "A (Empfehlung): ganzer KI-Bereich in einem Rahmen mit Kopfzeile, Einschätzung und Rückfragen innen getrennt", 330],
  [files.B, "B: Akzentleiste links über den ganzen Bereich, getönter Grund, Marke \"KI\"", 330],
  [files.C, "C: zwei Karten (Einschätzung, Rückfragen) mit KI-Marke an der Überschrift", 330],
]);
await compose("2-Unterkante.png", [
  [files.A2, "A: der Rahmen endet sichtbar, darunter beginnt \"Verbindung\"", 330],
  [files.B2, "B: Leiste und Grund enden vor \"Verbindung\"", 330],
  [files.C2, "C: Rückfragen-Karte, dann \"Verbindung\"", 330],
]);
await close();
console.log("fertig");
