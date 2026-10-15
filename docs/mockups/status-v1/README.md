# Mockups App "Status" (2026-10-15)

Wunsch des Nutzers: eine neue Panel-App "Status" im Launcher (Gruppe "Device Panel", nach dem Protokoll), die zeigt, ob die Teile der Integration laufen (Herzschlag),
mit kleinem Config-Teil oben: Meldung bei Stillstand, Vorgabe "wie die anderen Meldungen" (globales Standard-Ziel), umstellbar auf ein eigenes Ziel.
Bei einer Störung: roter Punkt am Status-Knopf in der Kopfzeile (wie der Neustart-Hinweis am Zahnrad) und die Pille "Störung" an der App im Launcher (wie "Debug" am Protokoll).
Im echten Panel (Nachbau aus `tests/panel`, erfundene Daten), Handy 402 × 874. Das Symbol im Fensterkopf ist im Nachbau noch der Blitz der Routinen (Mockup-Behelf).

| Bild | Inhalt |
| --- | --- |
| `1-Status-Handy.png` | **A (Empfehlung):** Liste mit Pille je Teil; links alles ok, Mitte Störung. B: Kacheln in zwei Spalten (rechts, mit gewähltem "Eigenes Ziel"). |
| `2-Status-Desktop.png` | A auf dem Desktop, Störung. |
| `3-Kopfzeile-Launcher.png` | Status-Knopf mit rotem Punkt in der Kopfzeile; Pille "Störung" im Launcher. |

Vorschlag (noch nichts umgesetzt, der Nutzer entscheidet):

- Teile: Routinen, Magic Push, Ausfall-Überwachung, Batterie, Laden, Neue Geräte, Updates; je "läuft", "verspätet" (über der Toleranz) oder "steht" (deutlich darüber), mit Zeit des letzten Takts.
- Kopf: "Alles läuft" (grün) oder "Störung: N Teile" (rot) mit dem Zeitpunkt des Push.
- Config: Schalter "Bei Stillstand melden" (Standard an), Empfänger als Auswahlliste wie bei den Reitern der Einstellungen (Entscheid des Nutzers; im Mockup noch als Reiterleiste gezeichnet).
- Punkte (Entscheid des Nutzers): rot = Störung, orange = Debug; am Launcher-Knopf, oder am eigenen Knopf, wenn die App angeheftet ist. Der Status-Knopf steht nur in der Kopfzeile, wenn der Nutzer die App selbst anheftet (im Mockup zur Veranschaulichung immer gezeigt).
- Beim Start der Integration eine Zeile: Zeitpunkt, geladene und verpasste Routinen.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/status-v1/src/render.mjs`
