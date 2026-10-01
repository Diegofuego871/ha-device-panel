# Device Panel

[English](README.md)

Home-Assistant-Integration (HACS) mit einem Panel in der Seitenleiste, das
**alle Geräte** zeigt: welche gerade ausgefallen sind, wie oft und wie lange
Geräte ausfallen, dazu Angaben wie Softwarestand, Hersteller, Modell und
Bereich.

> Frühe Entwicklung (0.x). Umfang und Verhalten können sich noch ändern.

## Funktionen

- Überblick oben: wie viele Geräte online sind, welche gerade ausgefallen
  sind und seit wann, dazu niedrige Batterien, schwacher Empfang und
  verfügbare Updates (antippen filtert).
- Geräteliste in Gruppen: ausgefallen (längste zuerst, rot hervorgehoben),
  keine Daten und online; auf dem Handy als Karten.
- Verbindungsart pro Gerät: Zigbee, Z-Wave, Thread, Matter (Thread, WLAN
  oder LAN), Bluetooth, WLAN, Netzwerk, Cloud; Empfang in dBm oder LQI und
  der Hub, die Bridge oder der Bluetooth-Proxy dazwischen.
- Batteriestand, Softwarestand mit Update-Hinweis, Integration, Hersteller
  und Modell; Suche über alle Spalten, Filter nach Verbindungsart und "Nur
  Probleme".
- Ein Gerät gilt als ausgefallen nach 2 Minuten ohne Lebenszeichen. Ein
  Verbindungssensor entscheidet zuerst; sonst müssen alle normalen Entitäten
  nicht verfügbar sein. Ausfälle, die kurz nach einem Neustart von Home
  Assistant begannen, stehen als "mindestens" (≥) da.

### Geplant (siehe `docs/CONCEPT.md`)

- Spalten, Sortierung und Filter pro Benutzer, getrennt für Desktop und
  Handy.
- Einstellungen im Panel, Updates mit Vorabversionen, flexible Regeln für
  die Überwachung, Geräteansicht mit Verlauf, Push-Meldungen.

## Installation

### HACS (Custom Repository)

1. HACS → ⋮ → Benutzerdefinierte Repositories →
   `https://github.com/Diegofuego871/ha-device-panel`, Typ "Integration".
2. "Device Panel" installieren und Home Assistant neu starten.
3. Einstellungen → Geräte & Dienste → Integration hinzufügen → "Device Panel".

**Vorabversionen:** Versionen mit `b` oder `rc` in der Nummer (zum Beispiel
`0.1.0b2`) erscheinen als Vorabversion (Pre-release) auf GitHub. HACS
installiert sie nur, wenn die Entität "Pre-release" am HACS-Gerät dieses
Repositorys aktiviert und eingeschaltet ist (Einstellungen → Geräte & Dienste
→ HACS → Gerät "Device Panel"). HACS legt die Entität deaktiviert an.

### Manuell

`custom_components/device_panel` nach `config/custom_components/` kopieren
und Home Assistant neu starten.

## Entwicklung und Tests

- Python mit echtem Home Assistant: `pip install pytest-homeassistant-custom-component`
  (Python 3.13), dann `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`.

## Änderungen

Siehe [CHANGELOG.de.md](CHANGELOG.de.md).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
