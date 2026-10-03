# Mockups Backlog 4, 5, 7, 10 (2026-10-03)

Wunsch des Nutzers: Backlog-Punkte 4, 5, 7 und 10 ansehen. Statisches HTML
in der Optik des Panels, erfundene Daten.

| Bild | Inhalt |
| --- | --- |
| `1-punkt5-ausgefallen-nach.png` | Punkt 5, Überwachung pro Integration. **A (Empfehlung):** "Eigene Zeit pro Integration" in "Ausfall-Erkennung" wie die Batterie-Schwellen, Auswahl mit "Nicht überwachen". B: Spalte "Ausgefallen nach" in "Integrationen" |
| `2-punkt7-herkunft.png` | Punkt 7, Herkunft jeder Einstellung pro Gerät. **A (Empfehlung):** Herkunft (Standard, Integration, Gerät) unter jeder Einstellung im Popup. B: Übersicht "Wirksame Einstellungen" |
| `3-punkt10-ki.png` | Punkt 10, KI über die KI-Aufgaben von HA (`ai_task.generate_data`). **A (Empfehlung):** "Mit KI einschätzen" im Geräte-Popup. B: Zusammenfassung im Puls-Fenster. Einstellung standardmässig aus |
| `4-punkt4-matter.png` | Punkt 4, Matter. Erkennung Thread/WLAN/LAN geprüft (HA 2026.9, `matter/node_diagnostics`: `network_type`, `node_type`, `network_name`). **A:** Thread-Rolle und Netzname im Popup |

Neu rendern:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/backlog-v1/src/render.mjs
```
