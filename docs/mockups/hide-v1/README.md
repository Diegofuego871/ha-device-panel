# Mockups Einzelne Geräte ausblenden (2026-10-03)

Wunsch des Nutzers: einzelne Geräte ausblenden; die ausgeblendeten stehen
in den Einstellungen, wo man sie wieder einblendet. Erstellt im echten
Panel (Nachbau aus `tests/panel`, erfundene Daten).

| Bild | Inhalt |
| --- | --- |
| `1-A-knopf-im-popup.png` | **A (Empfehlung):** Knopf "Ausblenden" unten im Geräte-Popup; danach Hinweis "… ausgeblendet · Rückgängig" |
| `2-B-auswahl.png` | B: Auswahl "In der Liste: Anzeigen / Ausblenden" bei den Einstellungen für dieses Gerät |
| `3-C-mehrere.png` | C: "Auswählen" in der Werkzeugleiste, Kästchen in der Liste, dann "Ausblenden" für mehrere |
| `4-einstellungen.png` | Alle Varianten: Abschnitt "Ausgeblendete Geräte" mit Schalter "Anzeigen" pro Gerät und "Alle einblenden", gilt mit "Speichern" |

## Verhalten (Vorschlag, alle Varianten)

- Gilt für alle Benutzer (wie Integrationen und Gerätetypen), gespeichert
  in den Optionen der Integration.
- Ausgeblendet heisst wie bei Integrationen und Gerätetypen: nicht in der
  Liste, nicht im Kopf, nicht überwacht, keine Meldungen. Alternative:
  nur in der Liste verborgen, weiter überwacht (dann besser "Stumm" als
  eigene Einstellung). Entscheid offen; Empfehlung: nicht überwacht.
- Gelöschte Geräte fallen aus der Liste in den Einstellungen weg.

## Empfehlung: A

Ein Knopf mit Rückgängig ist am schnellsten und braucht keine Erklärung.
B passt zu den übrigen Einstellungen pro Gerät, versteckt die Aktion aber
weiter unten im Popup. C lohnt sich nur, wenn man oft viele Geräte auf
einmal ausblendet; es lässt sich später zu A ergänzen.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/hide-v1/src/render.mjs
```
