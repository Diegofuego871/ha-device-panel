# Device Panel

[English](README.md)

Home-Assistant-Integration (HACS) mit einem Panel in der Seitenleiste, das
**alle Geräte** zeigt: welche gerade ausgefallen sind, wie oft und wie lange
Geräte ausfallen, dazu Angaben wie Softwarestand, Hersteller, Modell und
Bereich.

> Frühe Entwicklung (0.x). Umfang und Verhalten können sich noch ändern.

## Funktionen

- Überblick oben: wie viele Geräte online sind, die mittlere Verfügbarkeit
  der letzten 24 Stunden, welche Geräte gerade ausgefallen sind und seit
  wann, und ein Ausfall-Puls über 24 Stunden, der auf Sammelausfälle
  hinweist (mehrere Geräte gleichzeitig, mit gemeinsamer Integration).
- Geräteliste in Gruppen: ausgefallen (längste zuerst, rot hervorgehoben),
  instabil (3 oder mehr Unterbrüche in 24 Stunden), keine Daten und online;
  auf dem Handy als Karten. Die Spalte mit dem Gerät bleibt stehen, wenn die
  Tabelle seitlich scrollt.
- Spalten für Status, Verbindung, Verfügbarkeit über 24 Stunden (Streifen
  und Prozent), Typ (z. B. Licht, Steckdose, Bewegung, Tür/Fenster, Klima,
  Hub/Bridge), Integration mit ihrem Eintrag, Batterie, Hersteller und
  Modell, Software mit Update-Hinweis.
- Verbindungsart pro Gerät: Zigbee, Z-Wave, Thread, Matter (Thread, WLAN
  oder LAN), Bluetooth, WLAN, Netzwerk, Cloud; Empfang in dBm oder LQI und
  der Hub, die Bridge oder der Bluetooth-Proxy dazwischen.
- Suche über alle Spalten, Filter nach Verbindungsart, "Nur Probleme",
  niedriger Batterie, schwachem Empfang und verfügbaren Updates.
- Popup pro Gerät (wie bei UniFi Dynamic Clients): Verfügbarkeit 24 Stunden,
  Unterbrüche in 7 Tagen, Empfang und Batterie als Kacheln; Verbindung,
  Integration (warnt, wenn ihr Eintrag nicht geladen ist), Geräteangaben und
  alle Entitäten mit Zustand, die für das Lebenszeichen entscheidenden
  markiert. Ein Tipp auf eine Entität öffnet den Entitäts-Dialog von Home
  Assistant, ein Knopf die Geräteseite von Home Assistant.
- Statistik-Fenster aus den Kacheln: Verfügbarkeit über 24 Stunden, 7 oder
  30 Tage mit Zeitstrahl, jeder Unterbruch mit Zeit und Dauer sowie
  Unterbrüche pro Tag.
- Ein Gerät gilt als ausgefallen nach 2 Minuten ohne Lebenszeichen. Ein
  Verbindungssensor entscheidet zuerst; sonst müssen alle normalen Entitäten
  nicht verfügbar sein. Ausfälle, die kurz nach einem Neustart von Home
  Assistant begannen, stehen als "mindestens" (≥) da.
- Verfügbarkeitsprotokoll über 31 Tage in einer eigenen Datei (nicht im
  Recorder). Zeit, in der Home Assistant nicht lief, gilt als "keine Daten",
  nie als Ausfall.
- Einstellungen im Panel (Zahnrad) mit Updates: nach einer neuen Version
  suchen, mit einem Klick über HACS aktualisieren, danach neu starten,
  wahlweise Vorabversionen anbieten ("In HACS freischalten" schaltet die
  Vorabversionen in HACS ein). Auf Wunsch tägliche Prüfung mit Meldung unter
  Einstellungen → Reparaturen.

### Geplant (siehe `docs/CONCEPT.md`)

- Spalten, Sortierung und Filter pro Benutzer, getrennt für Desktop und
  Handy.
- Weitere Einstellungen im Panel, flexible Regeln für die Überwachung
  (Integrationen oder Gerätetypen ausschliessen), Push-Meldungen.

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
→ HACS → Gerät "Device Panel"). HACS legt die Entität deaktiviert an. Das
Panel kann das übernehmen: Einstellungen (Zahnrad) → "Vorabversionen
anzeigen" → "In HACS freischalten".

**Updates:** Die Einstellungen (Zahnrad) im Panel zeigen die installierte und
die neueste Version; "Aktualisieren" installiert sie über HACS, danach Home
Assistant neu starten.

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
