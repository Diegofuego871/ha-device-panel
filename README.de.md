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
  und Prozent, Prozent ab 1 Stunde Daten), Typ (z. B. Licht, Steckdose, Bewegung, Tür/Fenster, Klima,
  Hub/Bridge, Netzwerk, Handy/Computer, Energie/Zähler), Integration mit
  ihrem Eintrag, Batterie, Hersteller und Modell, Software mit
  Update-Hinweis; wahlweise Bereich, Unterbrüche in 24 Stunden und Hub /
  Bridge.
- Ansicht pro Benutzer, gespeichert in Home Assistant und getrennt für
  Desktop und Handy: Spalten (Desktop) bzw. Angaben auf der Karte (Handy)
  wählen und ordnen, nach jeder Spalte sortieren (Klick auf den Kopf),
  Gruppen oder eine Liste, dazu die aktiven Filter-Chips.
- Verbindungsart pro Gerät: Zigbee, Z-Wave, Thread, Matter (Thread, WLAN
  oder LAN), Bluetooth, WLAN, Netzwerk, Cloud; Empfang in dBm oder LQI und
  der Hub, die Bridge oder der Bluetooth-Proxy dazwischen.
- Suche über alle Spalten (mit Knopf zum Löschen), Filter nach
  Verbindungsart, "Nur Probleme", Batterie (alle Batteriegeräte, nach Stand
  sortiert), niedriger Batterie, schwachem Empfang und verfügbaren Updates.
  Die Zahl auf einem Chip zählt mit der Suche und den übrigen Filtern: so
  viele Geräte, wie das Antippen zeigt. Ein aktiver Chip lässt sich mit
  einem zweiten Tipp abwählen. In den Einstellungen ("Anzeige") lassen sich
  einzelne Chips der Verbindungsart ausblenden und alle in eine eigene
  Reihenfolge ziehen.
- Popup pro Gerät (wie bei UniFi Dynamic Clients): Verfügbarkeit 24 Stunden,
  Unterbrüche in 7 Tagen, Empfang und Batterie als Kacheln; Verbindung,
  Integration (warnt, wenn ihr Eintrag nicht geladen ist), Geräteangaben und
  alle Entitäten mit Zustand, die für das Lebenszeichen entscheidenden
  markiert. Ein Tipp auf eine Entität öffnet den Entitäts-Dialog von Home
  Assistant, ein Knopf die Geräteseite von Home Assistant. Hier lässt sich
  der Typ und die Verbindungsart des Geräts ändern, wenn die Erkennung
  falsch liegt oder nichts findet. Die Verbindungsart lässt sich auch pro
  Integration in den Einstellungen festlegen (für alle ihre Geräte; das
  Gerät geht vor).
- Statistik-Fenster aus den Kacheln: Verfügbarkeit über 24 Stunden, 7 oder
  30 Tage mit Zeitstrahl, jeder Unterbruch mit Zeit und Dauer sowie
  Unterbrüche pro Tag.
- Ein Gerät gilt als ausgefallen nach 2 Minuten ohne Lebenszeichen
  (einstellbar unter "Ausfall-Erkennung", wie "instabil ab" und die
  Anlaufphase nach einem Start). Ein Verbindungssensor entscheidet zuerst;
  sonst müssen alle normalen Entitäten nicht verfügbar sein. Ein Ausfall
  endet erst, wenn Home Assistant das Gerät wieder online sieht: Seine Dauer
  läuft über Neustarts von Home Assistant weiter. "Mindestens" (≥) nur, wenn
  der Beginn nicht bekannt ist (z. B. war das Gerät online, als Home
  Assistant stoppte, und nach dem Start weg); der Tooltip zeigt den Beginn.
- Verfügbarkeitsprotokoll über 31 Tage in einer eigenen Datei (nicht im
  Recorder). Zeit, in der Home Assistant nicht lief, gilt als "keine Daten",
  nie als eigener Ausfall; die Balken zeigen sie so. War ein Gerät davor und
  danach ausgefallen, zählen die Zahlen das als einen Ausfall. Einmal nach
  der Installation füllt die Integration das Protokoll aus dem Verlauf des
  Recorders nach, so weit dieser Daten hat.
- Ganze Integrationen oder Gerätetypen ausblenden (Einstellungen im Panel
  oder Optionsdialog der Integration): ausgeblendete Geräte werden weder
  gezeigt noch überwacht. Wahlweise Dienst-Geräte (z. B. Sonne, Add-ons)
  und deaktivierte Geräte anzeigen (eigene Gruppe, nicht überwacht).
- Batterie-Warnung: wählen, ab welchem Stand eine Batterie als schwach gilt
  (5–50 %, Standard 15 %) und wie man es erfährt: als Push-Meldung (einmal
  pro Gerät, an einen notify-Dienst oder eine notify-Entität nach Wahl), als
  anhaltende Benachrichtigung in Home Assistant mit allen betroffenen
  Geräten, beides oder keines. Ein Tipp auf die Push-Meldung öffnet das
  Gerät im Panel. Der Push kommt sofort oder einmal täglich zu einer
  gewählten Uhrzeit, mit den neu betroffenen oder allen schwachen Geräten.
  Pro Integration (aufgeführt sind nur Integrationen mit Batteriegeräten)
  gilt der globale Wert, eine eigene Schwelle oder aus; pro Gerät ebenso im
  Popup. Das Gerät geht vor, dann die Integration, dann der globale Wert.
- Ausfall-Meldungen: ein Push, sobald ein Gerät als ausgefallen gilt, und
  auf Wunsch eine Entwarnung, wenn es wieder online ist, mit der Dauer des
  Ausfalls (sie ersetzt auf dem Handy die Ausfall-Meldung). Mehrere Geräte
  gleichzeitig ergeben eine Meldung mit vermuteter Ursache. Pro Gerät
  lassen sie sich im Popup ausschalten, z. B. für ein Ladegerät, das oft
  absichtlich offline ist; überwacht wird das Gerät weiter. Standardmässig
  aus.
- Einstellungen pro Gerät auf einen Blick: ein Symbol beim Namen (eigene
  Batterie-Schwelle, Batterie-Warnung aus, Meldungen aus, Verbindungsart von
  Hand), der Chip "Eigene Einstellung" zeigt nur diese Geräte, und die
  Einstellungen listen sie zum Zurücksetzen auf, einzeln oder alle auf
  einmal.
- Einstellungen im Panel (Zahnrad) mit Updates: nach einer neuen Version
  suchen, mit einem Klick über HACS aktualisieren, danach neu starten,
  wahlweise Vorabversionen anbieten ("In HACS freischalten" schaltet die
  Vorabversionen in HACS ein). Auf Wunsch tägliche Prüfung mit Meldung unter
  Einstellungen → Reparaturen. Alles gilt mit "Speichern"; der Dialog bleibt
  danach offen.

### Geplant (siehe `docs/CONCEPT.md`)

- Filter nach Bereich, Ausfall-Meldungen pro Integration mit Aktionen,
  Überwachungsebenen mit Regeln, vermutete Ursache und Funkweg in der
  Geräteansicht.

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

### Entfernen

Einstellungen → Geräte & Dienste → "Device Panel" → ⋮ → Löschen. Das löscht
auch die eigenen Dateien der Integration (`.storage/device_panel.*`:
Verfügbarkeitsprotokoll, Einstellungen pro Gerät, gemeldete Ausfälle und
Batterien, gemeinsame Panel-Einstellungen). Die Registries von Home
Assistant verändert die Integration nie. Danach in HACS entfernen (oder den
Ordner löschen) und neu starten.

## Entwicklung und Tests

- Python mit echtem Home Assistant: `pip install pytest-homeassistant-custom-component`
  (Python 3.13), dann `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`.

## Änderungen

Siehe [CHANGELOG.de.md](CHANGELOG.de.md).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
