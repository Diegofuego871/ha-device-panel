# Mockups "Überwachung und Meldungen" (2026-10-04)

Folge von `notify-v2`: Der Nutzer wählt Variante C (Reiter und Zeitstrahl)
und wünscht: Der Abschnitt "Integrationen" zeigt nur noch das Minimum;
alles, was mit Überwachen und Melden zu tun hat, wandert in den neuen
Abschnitt. Dazu soll sichtbar werden, wie die Einstellungen pro Integration
aussehen. Statisches HTML in der Optik des Panels, Handy-Breite, erfundene
Daten.

| Bild | Inhalt |
| --- | --- |
| `1-struktur.png` | Heute (fünf Abschnitte) und neu: Abschnitt "Überwachung und Meldungen" zuoberst, "Integrationen" nur noch mit "Anzeigen"; Empfehlung mit eigenem Reiter "Integrationen", Alternative mit Tabellen in den Reitern |
| `2-reiter.png` | Reiter "Übersicht" (Zeitstrahl je Meldung, Chips, Abweichungen, Ziel, Tipp), "Ausfall" (Zeitstrahl, Erkennung, Meldung, Abweichungen), "Batterie" (gleicher Aufbau, Inhalt anpassbar) und der Fehler "Erst melden nach kürzer als Ausgefallen nach" |
| `3-integrationen-reiter.png` | **Empfehlung:** Reiter "Integrationen": Liste mit Abweichungen in einem Satz, Filter "Abweichend"; eine Integration mit allem an einem Ort, eigenem Zeitstrahl und Marken Standard/Eigene; Integration mit "Überwachen" aus |
| `4-alternative-tabellen.png` | Alternative: kein Reiter "Integrationen", Tabellen unten in "Ausfall" (Ausgefallen nach, Push, Anhaltend) und "Batterie" (Schwach ab, Push) |
| `5-abschnitt-integrationen.png` | Abschnitt "Integrationen" heute und neu (nur "Anzeigen", Verweis auf die Einstellungen pro Integration) |

Neu gegenüber heute: Push bei schwacher Batterie pro Integration (heute nur
Schwelle oder Aus) und "Überwachen" als eigener Schalter (heute die Auswahl
"Nicht überwachen" bei "Ausgefallen nach"). "Nicht überwachen" schaltet wie
heute auch die Batterie-Warnung ab (`monitored_devices` in `battery.py`).

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/notify-v3/src/render.mjs
```
