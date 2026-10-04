# Device Panel

[English](README.md)

**Alle Geräte von Home Assistant auf einen Blick:** wer gerade ausgefallen ist, wie oft und wie lange Geräte ausfallen, wie voll die Batterien sind und wie gut der Empfang ist.

<p align="center"><img src="docs/screenshots/de/overview.png" alt="Übersicht mit Verfügbarkeit, ausgefallenen Geräten, Ausfall-Puls und Geräteliste" width="900"></p>

## Das bekommst du

- **Übersicht:** wie viele Geräte online sind, wer seit wann ausgefallen ist, ein Ausfall-Puls über 24 Stunden mit Sammelausfällen
- **Geräteliste** nach ausgefallen, instabil und online gruppiert, mit Suche, Filtern nach Bereich und Integration, Filter-Chips und eigenen Spalten
- **Pro Gerät:** Verfügbarkeit, Unterbrüche, Empfang und Batterie im Popup, mit Verlauf und Statistik
- **Batterie-Prognose:** wie lange die Batterie bis zur Warnschwelle hält, ohne KI
- **Meldungen:** Push und anhaltende Benachrichtigung bei Ausfällen und schwacher Batterie, mit Zeitstrahl, wann was ankommt; Standard pro Integration, Ausnahmen pro Gerät
- **Optionale KI-Einschätzung:** eine Vermutung zur Ursache auf Knopfdruck, der Prompt ist im Profi-Modus anpassbar
- **Einstellungen im Panel,** auch Updates über HACS, auf Deutsch und Englisch
- **Handy und Desktop,** die Ansicht wird pro Benutzer gespeichert

## Bilder

### Ausfälle auf einen Blick

Ausgefallene Geräte mit der Zeit, seit der sie fehlen, instabile Geräte und der Ausfall-Puls. Ein Tipp auf den Puls listet die Geräte mit Unterbrüchen, ein Punkt im Puls zeigt, wer dann weg war.

<p align="center"><img src="docs/screenshots/de/pulse.png" alt="Fenster mit dem Ausfall-Puls und den Geräten mit Unterbrüchen in 24 Stunden" width="720"></p>

### Alles zu einem Gerät

Verfügbarkeit, Unterbrüche, Empfang und Batterie als Kacheln, dazu Verbindung, Integration, Hersteller, Modell, Software und alle Entitäten. Typ und Verbindungsart lassen sich hier korrigieren.

<p align="center"><img src="docs/screenshots/de/popup.png" alt="Geräte-Popup mit Statistik, Verbindung und Gerätedaten" width="720"></p>

### Verlauf: Verfügbarkeit, Empfang, Batterie

| Verfügbarkeit | Empfang | Batterie mit Prognose |
|---|---|---|
| <img src="docs/screenshots/de/availability.png" alt="Verfügbarkeit über 7 Tage mit jedem Unterbruch"> | <img src="docs/screenshots/de/signal.png" alt="Empfangsverlauf mit Median, Spanne und Warnschwelle"> | <img src="docs/screenshots/de/battery.png" alt="Batterie-Verlauf mit Batteriewechsel, Schwelle und Prognose"> |

Die Prognose rechnet ab dem letzten Batteriewechsel (höchstens ein Jahr) bis zur Warnschwelle des Geräts und sagt, wie sicher sie ist.

### Einstellungen pro Gerät

Jedes Gerät kann im Popup die Standardwerte übersteuern: eine eigene "Ausgefallen nach"-Zeit (oder keine Überwachung), eine eigene Batterie-Schwelle, eine eigene Empfang-Warnung sowie Ausfall- und Online-Meldungen aus oder für 24 Stunden stumm, etwa bei einem Ladegerät, das oft absichtlich offline ist. Jede Zeile zeigt, woher der Wert kommt und was der Standard wäre. Ein Symbol neben dem Namen in der Liste zeigt Geräte mit eigenen Einstellungen.

<p align="center"><img src="docs/screenshots/de/device-settings.png" alt="Geräte-Popup: Einstellungen für dieses Gerät mit eigener Zeit, eigener Batterie-Schwelle und ausgeschalteten Meldungen" width="720"></p>

### Meldungen unter deiner Kontrolle

| Übersicht als Zeitstrahl | Einstellungen pro Integration |
|---|---|
| <img src="docs/screenshots/de/settings-monitor.png" alt="Einstellungen: Zeitstrahl, wann ein Gerät als ausgefallen gilt und wann der Push kommt"> | <img src="docs/screenshots/de/settings-integrations.png" alt="Einstellungen: Liste der Integrationen mit den Abweichungen vom Standard"> |

### KI-Einschätzung (optional, standardmässig aus)

| Antwort im Popup | Profi-Modus: Prompt |
|---|---|
| <img src="docs/screenshots/de/ai.png" alt="Geräte-Popup mit der KI-Einschätzung"> | <img src="docs/screenshots/de/settings-ai.png" alt="Einstellungen mit dem Prompt im Profi-Modus"> |

Nur auf Knopfdruck, mit einer KI-Aufgabe von Home Assistant. Es gehen keine Schlüssel, Zugangsdaten oder IDs raus. Im Prompt lassen sich Gruppen der Fakten wie `{facts_area}` und `{facts_hub}` nutzen, eine Vorschau zeigt den genauen Text.

### Auf dem Handy

| Liste | Popup | Batterie |
|---|---|---|
| <img src="docs/screenshots/de/overview-mobile.png" alt="Handy: Karten" width="260"> | <img src="docs/screenshots/de/popup-mobile.png" alt="Handy: Popup" width="260"> | <img src="docs/screenshots/de/battery-mobile.png" alt="Handy: Batterie-Verlauf" width="260"> |

## Gut zu wissen

- Ein Gerät gilt nach 2 Minuten ohne Lebenszeichen als ausgefallen (einstellbar, pro Integration und pro Gerät).
- Ein Ausfall dauert, bis Home Assistant das Gerät wieder online sieht, auch über Neustarts. "Mindestens" (≥) heisst: Der Beginn ist nicht bekannt.
- Das Verfügbarkeitsprotokoll umfasst 31 Tage in einer eigenen Datei, nicht im Recorder. Zeit, in der Home Assistant nicht lief, zählt als "keine Daten".
- Ausgeblendete Geräte, Integrationen und Gerätetypen werden weder angezeigt noch überwacht.
- Batterie-Warnung von 5 bis 50 % (Standard 15 %), pro Integration und pro Gerät.
- Der Empfangsverlauf kommt aus dem Recorder oder, bei ZHA, Bluetooth und nicht aufgezeichneten Sensoren, vom Panel selbst.
- Jede Einstellung zeigt, woher sie kommt: Standard, Integration oder Gerät.
- Sicherheitsrelevantes (Tokens, Schlüssel) zeigt das Panel nie an.

## Installation

### HACS (Custom Repository)

1. HACS → ⋮ → Benutzerdefinierte Repositories → `https://github.com/Diegofuego871/ha-device-panel`, Typ "Integration".
2. "Device Panel" installieren und Home Assistant neu starten.
3. Einstellungen → Geräte & Dienste → Integration hinzufügen → "Device Panel".

Updates: Die Einstellungen (Zahnrad) zeigen die installierte und die neueste Version und aktualisieren über HACS. Vorabversionen (`b` oder `rc` in der Nummer) sind optional: "Vorabversionen anzeigen" → "In HACS freischalten".

### Manuell

`custom_components/device_panel` nach `config/custom_components/` kopieren und Home Assistant neu starten.

### Entfernen

Einstellungen → Geräte & Dienste → "Device Panel" → ⋮ → Löschen. Das löscht auch die eigenen Dateien der Integration (`.storage/device_panel.*`). Die Registries von Home Assistant ändert sie nie. Danach in HACS entfernen und neu starten.

## Entwicklung und Tests

- Python mit echtem Home Assistant: `pip install pytest-homeassistant-custom-component` (Python 3.13), dann `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`. Die Bilder in dieser Datei stammen aus `node readme-shots.mjs` (erfundene Daten).

## Änderungen

Siehe [CHANGELOG.de.md](CHANGELOG.de.md).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
