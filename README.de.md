# Device Panel

[English](README.md)

Home-Assistant-Integration (HACS) mit einem Panel in der Seitenleiste, das
**alle Geräte** zeigt: welche gerade ausgefallen sind, wie oft und wie lange
Geräte ausfallen, dazu Angaben wie Softwarestand, Hersteller, Modell und
Bereich.

> Frühe Entwicklung (0.x). Umfang und Verhalten können sich noch ändern.

## Funktionen

- Überblick oben: wie viele Geräte online sind (Ring und Anteil jetzt),
  darunter die mittlere Verfügbarkeit der letzten 24 Stunden, welche
  Geräte gerade ausgefallen sind und seit
  wann, und ein Ausfall-Puls über 24 Stunden, der auf Sammelausfälle
  hinweist (mehrere Geräte gleichzeitig, mit gemeinsamer Integration).
  Der Puls ist rot, wo Geräte weg waren, und grün, wo keines fehlte.
  Ein Tipp auf den Puls öffnet die Geräte mit Unterbrüchen in 24 Stunden,
  meiste zuerst; ein Zeitpunkt im Puls zeigt nur die Geräte, die dann weg
  waren.
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
  Desktop und Handy: Spalten (Desktop, Dialog "Anpassen") bzw. Angaben auf
  der Karte (Handy) mit dem Auge ein- und ausblenden und am Griff ordnen,
  nach jeder Spalte sortieren (Klick auf den Kopf), Gruppen oder eine
  Liste, dazu die aktiven Filter-Chips. Auf Handy und Desktop scrollt nur
  die Liste: Chips (und Sortierung) bleiben oben, die Kacheln schrumpfen zu
  einer Zeile.
- Verbindungsart pro Gerät: Zigbee, Z-Wave, Thread, Matter (Thread, WLAN
  oder LAN), Bluetooth, WLAN, Netzwerk, Cloud; Empfang in dBm oder LQI und
  der Hub, die Bridge oder der Bluetooth-Proxy dazwischen.
- Suche über alle Spalten (mit Knopf zum Löschen), Filter nach
  Verbindungsart, "Nur Probleme", Batterie (alle Batteriegeräte, nach Stand
  sortiert), niedriger Batterie, schwachem Empfang und verfügbaren Updates.
  Die Zahl auf einem Chip zählt mit der Suche und den übrigen Filtern: so
  viele Geräte, wie das Antippen zeigt. Ein aktiver Chip lässt sich mit
  einem zweiten Tipp abwählen; "Alle" hebt alle Filter auf einmal auf (die
  Suche bleibt). In den Einstellungen ("Anzeige") lassen sich
  einzelne Chips der Verbindungsart ausblenden und alle in eine eigene
  Reihenfolge ziehen.
- Filter nach Bereich: Der Chip "Bereich" am Anfang der Chip-Zeile wählt
  einen oder mehrere Bereiche oder eine ganze Etage (Reihenfolge wie in
  Home Assistant, "Ohne Bereich" für Geräte ohne). Die Liste zeigt nur
  deren Geräte, und die übrigen Chips filtern darin weiter. Der Kopf
  (Verfügbarkeit, gerade ausgefallen, Ausfall-Puls, Sammelausfälle) zählt
  dann ebenfalls nur diese Geräte. Pro Benutzer gespeichert wie die
  Ansicht.
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
  (einstellbar unter "Überwachung und Meldungen", Reiter "Ausfall", wie
  "instabil ab" und die Anlaufphase nach einem Start). Integrationen, deren
  Geräte selten melden, bekommen eine eigene Zeit (Reiter
  "Integrationen"); mit "Überwachen" aus bleiben ihre Geräte sichtbar, in
  einer Gruppe "Nicht überwacht", ohne Ausfälle, Statistik und
  Meldungen. Ein Verbindungssensor entscheidet zuerst;
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
- Einzelne Geräte (Knopf "Gerät ausblenden" im Geräte-Popup, mit "Rückgängig"),
  ganze Integrationen oder Gerätetypen ausblenden (Einstellungen im Panel
  oder Optionsdialog der Integration): ausgeblendete Geräte werden weder
  gezeigt noch überwacht und melden nichts. Die Einstellungen führen die
  ausgeblendeten Geräte auf ("Ausgeblendete Geräte"), um sie wieder
  einzublenden. Wahlweise Dienst-Geräte (z. B. Sonne, Add-ons)
  und deaktivierte Geräte anzeigen (eigene Gruppe, nicht überwacht).
- Batterie-Warnung: wählen, ab welchem Stand eine Batterie als schwach gilt
  (5–50 %, Standard 15 %) und wie man es erfährt: als Push-Meldung (einmal
  pro Gerät, an einen notify-Dienst oder eine notify-Entität nach Wahl), als
  anhaltende Benachrichtigung in Home Assistant mit allen betroffenen
  Geräten, beides oder keines. Ein Tipp auf die Push-Meldung öffnet das
  Gerät im Panel. Der Push kommt sofort oder einmal täglich zu einer
  gewählten Uhrzeit, mit den neu betroffenen oder allen schwachen Geräten.
  Den Inhalt wählen (Stand, Bereich, Integration, Hersteller / Modell), mit
  Vorschau. Pro Integration gilt der globale Wert, eine eigene Schwelle oder
  aus, und der Push lässt sich ausschalten; pro Gerät ebenso im Popup. Das
  Gerät geht vor, dann die Integration, dann der globale Wert.
- Ausfall-Meldungen: ein Push, sobald ein Gerät als ausgefallen gilt, und
  auf Wunsch eine Entwarnung, wenn es wieder online ist, mit der Dauer des
  Ausfalls (sie ersetzt auf dem Handy die Ausfall-Meldung). Mehrere Geräte
  gleichzeitig ergeben eine Meldung mit vermuteter Ursache. "Erst melden
  nach" (mindestens "Ausgefallen nach", bis 60 Min.) wartet mit dem Push;
  kurze Aussetzer melden nichts,
  auch kein "wieder online", und ein noch nicht gemeldeter Ausfall
  übersteht einen Neustart. Den Inhalt wählen (Bereich, Integration,
  Verbindungsart, offline seit, Empfang zuletzt, Batterie, Hersteller /
  Modell), mit Vorschau in den Einstellungen. Der Push hat die Knöpfe
  "Öffnen" und "24 Std. stumm"; das Popup zeigt das Stummschalten bis zu
  seinem Ende, "Globale Einstellung" hebt es auf. Pro Integration lassen
  sich Push und anhaltende Benachrichtigung ausschalten; pro Gerät lassen sich die Meldungen im Popup ausschalten, z. B.
  für ein Ladegerät, das oft absichtlich offline ist; überwacht wird das
  Gerät weiter. Auf Wunsch listet eine anhaltende Benachrichtigung in Home
  Assistant alle ausgefallenen Geräte, solange sie ausgefallen sind, mit
  Link zum Gerät. Standardmässig aus.
- Batterie-Verlauf: Die Kachel "Batterie" im Geräte-Popup zeigt den Stand
  über 24 Std., 7 Tage, 30 Tage, 3, 6 oder 12 Monate als Linie, mit Warnschwelle
  und Batteriewechseln; aus dem Recorder (Langzeitstatistik auch über
  seine 10 Tage hinaus). Eine Prognose zeigt, wie lange die Batterie
  voraussichtlich bis zur Warnschwelle des Geräts hält (ohne Warnung bis
  leer), gerechnet aus dem Verlauf seit dem letzten Batteriewechsel, höchstens
  ein Jahr, ohne KI.
- Empfang-Warnung pro Gerät im Popup: globaler Wert (unter -80 dBm bzw.
  LQI 61), eigene Schwelle oder aus, für Geräte, die immer schwachen
  Empfang haben. Markierung und Chip "Schwacher Empfang" folgen.
- Empfangsverlauf: Die Kachel "Empfang" im Geräte-Popup öffnet den Empfang
  über 24 Std., 7 oder 30 Tage mit Median, schlechtestem und bestem Wert
  und der Schwelle der Warnung. Aus dem Recorder, wenn ein Sensor den
  Empfang liefert; für ZHA, Bluetooth und Sensoren, die der Recorder nicht
  aufzeichnet (in seiner Konfiguration ausgeschlossen), zeichnet das Panel
  ihn selbst auf (jede Minute, 31 Tage in einer eigenen Datei). Hat sich
  ein Wert lange nicht geändert, gilt er seit seiner letzten Änderung.
- Batteriestand als farbiges Symbol mit Füllung: grün, gelbgrün, orange und
  rot, wenn schwach (Schwelle der Batterie-Warnung).
- Neue Geräte: "Neu" beim Namen in den ersten 3 Tagen nach dem Hinzufügen
  in Home Assistant, mit eigenem Chip.
- Einstellungen pro Gerät auf einen Blick: ein Symbol beim Namen (eigene
  Batterie-Schwelle, Batterie-Warnung aus, Meldungen aus, Verbindungsart von
  Hand, eigene Empfang-Warnung, eigenes "Ausgefallen nach" oder "Nicht
  überwachen"), der Chip "Eigene Einstellung" zeigt nur
  diese Geräte, und die Einstellungen listen sie zum Zurücksetzen auf,
  einzeln oder alle auf einmal.
- Optionale KI-Einschätzung (standardmässig aus): Ein Knopf "Mit KI
  einschätzen" im Geräte-Popup schickt auf Knopfdruck die Fakten dieses
  einen Geräts (keine Schlüssel, keine Zugangsdaten) an eine KI-Aufgabe von
  Home Assistant und zeigt die Antwort. Die KI-Aufgabe ist in den
  Einstellungen wählbar. Im Profi-Modus lässt sich der Prompt ansehen,
  kopieren und anpassen (Variablen `{language}`, `{facts}` und Gruppen
  wie `{facts_area}` oder `{facts_hub}`, mit Vorschau des genauen Texts). Neben dem Gerät geben die Fakten den
  Zusammenhang: die anderen Geräte im selben Bereich mit
  ihren Werten (auch gesunde, mit der Zahl derer mit demselben Funkstandard,
  etwa Thread oder Bluetooth), die Geräte am selben Hub, Geräte desselben
  Modells, die letzten 7 Tage, die Batterie-Prognose und welche Geräte zur
  selben Zeit ausfielen.
- Matter-Geräte: im Popup die Thread-Rolle (Router, Endgerät, schlafendes
  Endgerät) und der Netzname aus der Matter-Diagnose, neben der
  Verbindungsart, die weiter von Hand gesetzt werden kann.
- Herkunft jeder Einstellung im Geräte-Popup: unter jeder Einstellung ein
  Etikett (Standard, Integration, Gerät) und was der Standard wäre.
  "Ausgefallen nach" lässt sich auch pro Gerät setzen (wie Integration,
  eigene Zeit oder "Nicht überwachen"); das Gerät geht vor.
- Überwachung und Meldungen an einem Ort (erster Abschnitt der
  Einstellungen): Der Reiter "Übersicht" zeigt je Meldung einen Zeitstrahl,
  wann ein Gerät als ausgefallen gilt und wann der Push kommt, mit den
  Schaltern als Chips; die Reiter "Ausfall" und "Batterie" enthalten alle
  ihre Einstellungen, der Reiter "Integrationen" führt jede Integration mit
  ihren Abweichungen auf und öffnet alle ihre Einstellungen mit eigenem
  Zeitstrahl, mit "Alle zurücksetzen" auf den Standard.
- Fünf Abschnitte in den Einstellungen: "Geräte im Panel" (Dienst-Geräte
  und deaktivierte Geräte; Reiter "Integrationen", "Typen" und "Geräte"
  zum Ausblenden aus Panel und Überwachung), "Überwachung und Meldungen",
  "Darstellung" (Reiter "Verbindungsart" und "Filter-Chips"),
  "KI-Einschätzung" und "Updates".
- Einstellungen im Panel (Zahnrad) mit Updates: nach einer neuen Version
  suchen, mit einem Klick über HACS aktualisieren, danach neu starten,
  wahlweise Vorabversionen anbieten ("In HACS freischalten" schaltet die
  Vorabversionen in HACS ein). Auf Wunsch tägliche Prüfung mit Meldung unter
  Einstellungen → Reparaturen. Alles gilt mit "Speichern"; der Dialog bleibt
  danach offen.

### Geplant (siehe `docs/CONCEPT.md`)

- Überwachungsebenen mit Regeln, vermutete Ursache und Funkweg in der
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
