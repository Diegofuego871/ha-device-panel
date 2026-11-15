/**
 * Nur für die Tour-Seite (docs/tour): ein zusätzliches Thema "Einrichtungsassistent" an dritter Stelle. Im Panel gibt es dieses Thema
 * nicht, denn dort haben die Nutzer den Assistenten gerade durchgespielt, bevor die Lernseite aufgeht. Die Tour dagegen zeigt Leuten,
 * die Device Panel noch nicht installiert haben, dass die Einrichtung in einem Assistenten erledigt ist.
 * Texte und Skizze sind erfunden/zusammengefasst aus dem Assistenten (wizard.js, README "Setup wizard"); sie hängen an keinem Zustand.
 */

export const WIZARD_TOPIC = (deps, text) => ({
  id: "wiz",
  icon: "rocket",
  color: "#6D4C41",
  at: 2,
  // Skizze: das Assistenten-Fenster mit Schrittleiste, Titel und drei Integrationen mit Schaltern; im Artikel dazu die Testmeldung
  sketch: (full) => {
    const { escape } = deps;
    const k = text();
    const bars = Array.from({ length: 7 }, (_, n) => `<i class="${n < 1 ? "on" : n === 1 ? "cur" : ""}"></i>`).join("");
    // Kachel: kompakt (zwei Zeilen, ohne Schrittangabe und "Weiter"); Artikel: voll
    const rows = k.sk.rows.slice(0, full ? 3 : 2).map(([name, n, on]) => `<div class="wz-r"><b>${escape(name)}</b><em>${escape(n)}</em><span class="wz-sw${on ? " on" : ""}"></span></div>`).join("");
    const win = `<div class="lrn-wz"><div class="wz-bars">${bars}</div><div class="wz-t">${escape(k.sk.title)}</div>${full ? `<div class="wz-s">${escape(k.sk.step)}</div>` : ""}${rows}${full ? `<div class="wz-nx">${escape(k.sk.next)}</div>` : ""}</div>`;
    return win;
  },
});

// Texte je Sprache: Thema (wie lrnTopics in strings.js) und die zwei Zeilen, die für die Tour anders lauten (Untertitel mit zehn Themen)
export const WIZARD_TEXT = {
  de: {
    sub: "Zehn Themen, je etwa 2 Minuten",
    topic: {
      name: "Einrichtungsassistent",
      tab: "Assistent",
      short: "Die Einrichtung in etwa zwei Minuten: ein Fenster führt durch alles Wichtige.",
      title: "Eingerichtet in zwei Minuten",
      cap: "Beispiel mit erfundenen Daten: der Assistent mit Schrittleiste und der Wahl der Integrationen.",
      blocks: [
        { h: "Wozu?", p: ["Nach der Installation öffnet sich einmal ein Fenster in der Mitte des Panels und führt durch die Grundeinstellungen. Danach ist die Einrichtung abgeschlossen: Das Panel überwacht, was du gewählt hast, und meldet sich bei dem Ziel, das du bestimmt hast. Du musst nichts in den Einstellungen suchen, um loszulegen."] },
        {
          h: "Die Schritte",
          p: ["Oben zeigt eine Leiste mit einem Balken je Schritt, wo du bist; jeder Balken ist ein Knopf zum direkten Springen. Weiter geht es erst, wenn die Seite stimmt."],
          steps: [
            ["Integrationen", "Schalte aus, was du nicht im Panel brauchst. Die Zahl der Geräte steht dabei."],
            ["Gerätetypen", "Handys und Fernseher fallen oft aus, weil sie schlafen oder aus sind. Wer dazu keine Meldungen will, wählt sie ab."],
            ["Geräte", "Nach Integration gruppiert und aufklappbar, ein Schalter je Gruppe oder je Gerät."],
            ["Meldungen", "Ziel wählen (Notify-Gruppe oder Handy) und die Arten einschalten. Die jetzigen Werte stehen schon da und lassen sich gleich ändern; eine Testmeldung zeigt, dass es ankommt."],
            ["Labels", "Nur wenn Geräte ein Label von Home Assistant tragen: Überwachung, Zeiten, Batterie-Schwelle und Meldungen für alle Geräte des Labels auf einmal."],
            ["Backup, Ruhezeit und System", "Meldung bei einem Backup, das scheitert, Ruhezeit und Warnung bei hoher Auslastung. Erst, wenn ein Ziel gewählt ist."],
            ["Fertig", "Eine Zusammenfassung, dann wird angewendet."],
          ],
        },
        { h: "Nichts passiert, bis du fertig bist", p: ["Angewendet wird erst am Ende. Schliesst du zwischendurch, bleiben dein Schritt und deine Wahl erhalten, und der Assistent macht beim nächsten Start dort weiter. Alle Werte sind schon sinnvoll vorbelegt."] },
        { h: "Danach", p: ["Die Einrichtung ist damit abgeschlossen. Jede Wahl lässt sich später in den Einstellungen ändern, und unter Einstellungen › Panel › Allgemein öffnest du den Assistenten jederzeit wieder; dabei wird nichts zurückgesetzt."] },
        { tip: "**Nur in der Tour:** Im Panel selbst gibt es diesen Artikel nicht. Dort führt dich der Assistent direkt durch die Einrichtung; danach öffnet sich diese Lernseite mit den übrigen Themen." },
      ],
    },
    sk: {
      title: "Welche Integrationen?",
      step: "Schritt 2 von 7",
      next: "Weiter",
      rows: [["Zigbee", "34 Geräte", true], ["Matter", "9 Geräte", true], ["Mobile App", "3 Geräte", false]],
    },
  },
  en: {
    sub: "Ten topics, about 2 minutes each",
    topic: {
      name: "Setup wizard",
      tab: "Wizard",
      short: "Set up in about two minutes: one window leads through everything important.",
      title: "Set up in two minutes",
      cap: "Example with made-up data: the wizard with its step bar and the choice of integrations.",
      blocks: [
        { h: "What for?", p: ["After the installation a window opens once in the middle of the panel and leads through the basic settings. After that the setup is complete: the panel watches what you chose and reports to the target you picked. You do not have to look for anything in the settings to get started."] },
        {
          h: "The steps",
          p: ["A bar on top with one segment per step shows where you are; every segment is a button to jump straight there. You move on once the page is valid."],
          steps: [
            ["Integrations", "Switch off what you do not need in the panel. The number of devices is shown."],
            ["Device types", "Phones and TVs often fail because they sleep or are off. If you do not want messages for them, deselect them."],
            ["Devices", "Grouped by integration and expandable, one switch per group or per device."],
            ["Notifications", "Choose the target (notify group or phone) and switch on the kinds you want. The current values are already filled in and can be changed on the spot; a test message shows that it arrives."],
            ["Labels", "Only if devices carry a Home Assistant label: monitoring, times, battery threshold and notifications for all devices of the label at once."],
            ["Backup, quiet hours and system", "A message when a backup fails, quiet hours and a warning for high load. Only once a target is chosen."],
            ["Done", "A summary, then everything is applied."],
          ],
        },
        { h: "Nothing happens until you are done", p: ["Everything is applied only at the end. If you close in between, your step and choices are kept and the wizard continues there the next time. All values are already sensibly pre-filled."] },
        { h: "Afterwards", p: ["That completes the setup. Every choice can be changed later in the settings, and under Settings › Panel › General you can open the wizard again at any time; nothing is reset."] },
        { tip: "**Only in the tour:** This article does not exist in the panel itself. There the wizard leads you straight through the setup, and this learn page then opens with the other topics." },
      ],
    },
    sk: {
      title: "Which integrations?",
      step: "Step 2 of 7",
      next: "Next",
      rows: [["Zigbee", "34 devices", true], ["Matter", "9 devices", true], ["Mobile App", "3 devices", false]],
    },
  },
};
