# Device Panel

[English](README.md)

Home-Assistant-Integration (HACS) mit einem Panel in der Seitenleiste, das
**alle Geräte** zeigt: welche gerade ausgefallen sind, wie oft und wie lange
Geräte ausfallen, dazu Angaben wie Softwarestand, Hersteller, Modell und
Bereich.

> Frühe Entwicklung (0.x). Umfang und Verhalten können sich noch ändern.

## Funktionen (geplant, siehe `docs/CONCEPT.md`)

- Tabelle aller Geräte mit Status, Bereich, Integration, Hersteller/Modell
  und Softwarestand; ausgefallene Geräte zuoberst.
- Verfügbarkeit pro Gerät für 24 Std. / 7 Tage / 30 Tage, Zahl und Dauer der
  Unterbrüche, Zeitstrahl.
- Suche, Filter, sortier- und einstellbare Spalten, Desktop und Handy.

## Installation

### HACS (Custom Repository)

1. HACS → ⋮ → Benutzerdefinierte Repositories →
   `https://github.com/Diegofuego871/ha-device-panel`, Typ "Integration".
2. "Device Panel" installieren und Home Assistant neu starten.
3. Einstellungen → Geräte & Dienste → Integration hinzufügen → "Device Panel".

**Vorabversionen:** Versionen mit `b` oder `rc` in der Nummer (zum Beispiel
`0.1.0b1`) erscheinen als Vorabversion (Pre-release) auf GitHub. HACS
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

## Lizenz

MIT, siehe [LICENSE](LICENSE).
