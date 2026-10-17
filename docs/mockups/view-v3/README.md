# Mockups "Ansicht an einem Ort" (2026-10-17)

Wunsch des Nutzers: Heute steckt die Ansicht an zwei Orten: der Dialog "Spalten"
(Handy: Blatt "Ansicht") über der Tabelle und der Abschnitt "Ansicht" in den
zentralen Einstellungen (Startseite, Filter-Chips). Neu soll alles an einem Ort
liegen, auf zwei Reitern; der Abschnitt "Ansicht" aus den Einstellungen entfällt.
Der Abschnitt "Panel-Version" heisst "Panel" und hat zwei Unterreiter:
"Standardseite" (die Startseite) und "Updates" (eine Ebene tiefer).

Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene Daten); die Inhalte
der Reiter sind die echten Blöcke des heutigen Panels, nur umgesetzt.

| Bild | Inhalt |
| --- | --- |
| `1-Ansicht-Spalten.png` | Dialog "Ansicht" (Desktop), Reiter "Spalten": wie heute, pro Benutzer |
| `2-Ansicht-Filter-Chips.png` | Reiter "Filter-Chips": der Block aus den Einstellungen, global, nur für Administratoren |
| `3-Einstellungen-Panel-Standardseite.png` | Einstellungen ohne "Ansicht"; "Panel" mit Unterreiter "Standardseite" |
| `4-Einstellungen-Panel-Updates.png` | "Panel", Unterreiter "Updates": Versionszeile, Vorabversionen, Prüfung, automatische Installation |
| `7-Symbol-dark.png`, `7-Symbol-light.png` | Symbol der Zeile "Sortierung & Ansicht" (Handy): A Zahnrad mit Auge in der Mitte, **B Auge mit kleinem Zahnrad (Empfehlung)**, C heute (Sortierpfeile) |
| `5-Handy-Ansicht.png`, `6-Handy-Filter-Chips.png` | Handy: Blatt "Ansicht" mit denselben zwei Reitern |

## Offene Punkte

- **Global gegen pro Benutzer:** Spalten, Sortierung und Gruppen gelten pro Benutzer und sofort, die
  Filter-Chips gelten für alle Benutzer (heute mit "Speichern" in den Einstellungen). Im Reiter "Filter-Chips"
  bräuchte es darum einen Hinweis und einen Entscheid: sofort speichern (wie die Spalten) oder mit eigenem
  "Speichern". Nicht-Administratoren sähen den Reiter nicht.
- **Startseite** gilt nur für den Benutzer, der sie setzt, steht aber in den Einstellungen "gilt für alle Benutzer".
  Der Hinweis im Unterreiter sagt es.

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/view-v3/src/render.mjs
```
