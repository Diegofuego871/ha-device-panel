# Änderungsprotokoll

[English](CHANGELOG.md)

Alle nennenswerten Änderungen an dieser Integration stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/).

## [0.6.0] - 2026-10-01

Einstellen, wann ein Gerät als ausgefallen oder instabil gilt, und wählen, ob
Dienst-Geräte und deaktivierte Geräte in der Liste stehen.

### Hinzugefügt

- Abschnitt "Ausfall-Erkennung" in den Einstellungen, auch im Optionsdialog
  der Integration: "Ausgefallen nach" (1–60 Minuten, Standard 2), "Instabil
  ab" (2–50 Unterbrüche in 24 Stunden, Standard 3) und "Anlaufphase nach
  dem Start" (0–30 Minuten, Standard 5, 0 schaltet sie aus). Ein Wert
  ausserhalb des Bereichs wird rot markiert und lässt sich nicht speichern.
- Abschnitt "Anzeige", auch im Optionsdialog: "Dienst-Geräte anzeigen"
  (z. B. Sonne, Wettervorhersage, Add-ons; angezeigte werden auch
  überwacht) und "Deaktivierte Geräte anzeigen" (eigene Gruppe
  "Deaktiviert" am Ende der Liste, nicht überwacht, zählt weder oben noch
  unter "Nur Probleme"). Beides ist wie bisher standardmässig aus.

### Geändert

- Der Optionsdialog zeigt die Einstellungen in derselben Reihenfolge wie
  das Panel.

## [0.5.0] - 2026-10-01

Bestimmen, was das Panel zeigt: ganze Integrationen oder Gerätetypen
ausblenden und den Typ eines einzelnen Geräts korrigieren.

### Hinzugefügt

- Abschnitte "Integrationen" und "Gerätetypen" in den Einstellungen: jede
  Integration und jeder Typ mit der Zahl der Geräte und einem Schalter
  "Anzeigen", dazu "Alle umschalten". Ausgeblendete Geräte zeigt das Panel
  nicht, und sie werden nicht überwacht (keine Ausfälle, kein Verlauf). Auch
  im Optionsdialog der Integration ("Integrationen ausblenden",
  "Gerätetypen ausblenden").
- Neue Gerätetypen "Handy / Computer" (Companion-App), "Netzwerk" (Router,
  Access Point, Switch, NAS von Integrationen wie UniFi, FRITZ!Box oder
  Synology), "Ventil" und "Energie / Zähler" (Geräte, die vor allem
  Leistung, Energie, Gas oder Wasser messen).
- Typ eines Geräts im Popup ändern: "Automatisch: …" behält den erkannten
  Typ, jede andere Wahl bleibt als "von Hand gesetzt" bestehen und gilt
  auch für die Ausschlüsse.

### Geändert

- Ventile erscheinen nicht mehr als "Rollladen / Abdeckung", sondern als
  eigener Typ "Ventil".
- Ausfall-Puls und Sammelausfälle zählen nur noch die Geräte, die das Panel
  zeigt.
- Ein Gerät, das nicht mehr überwacht wird (ausgeblendet, deaktiviert,
  gelöscht), hat ab diesem Moment "keine Daten", statt weiter als online zu
  gelten.

## [0.4.0] - 2026-10-01

Erste stabile Version, aufbauend auf den Vorabversionen 0.1.0b1 bis 0.3.0b1
weiter unten. Updates direkt aus dem Panel: kein Umweg über HACS für jedes
neue Release. HACS bietet Device Panel jetzt auch ohne seinen Schalter
"Pre-release" an und meldet nicht mehr jeden Commit als Update.

### Hinzugefügt

- Einstellungen im Panel (Zahnrad neben der Suche), dieselben Optionen wie
  im Optionsdialog der Integration; alles gilt erst mit "Speichern",
  "Abbrechen" verwirft.
- Versionskasten oben in den Einstellungen: installierte Version, neueste
  Version (GitHub und HACS), "Nach Updates suchen", "Aktualisieren" über die
  Update-Entität von HACS, Fortschritt während HACS herunterlädt, danach
  Hinweis und Knopf für den Neustart von Home Assistant, Link zu den Release
  Notes. Kennt HACS eine neue Version noch nicht, lässt das Panel HACS sie
  nachladen.
- "Vorabversionen anzeigen" für die ganze Instanz (Beta-Versionen violett).
  Würde HACS eine Vorabversion nicht installieren, weil sein Schalter
  "Pre-release" aus ist, aktiviert "In HACS freischalten" ihn und schaltet
  ihn ein; schaltet man die Vorabversionen im Panel aus, wird er wieder
  ausgeschaltet.
- Option "Täglich nach Updates suchen" (Standard an): eine neue stabile
  Version erscheint unter Einstellungen → Reparaturen. Auch im
  Optionsdialog der Integration.

### Geändert

- Solange die installierte Version eine Vorabversion ist, werden neuere
  Vorabversionen standardmässig angeboten (bis "Vorabversionen anzeigen"
  einmal gespeichert wurde).

## [0.3.0b1] - 2026-10-01

Jedes Gerät bekommt ein eigenes Popup mit Statistik, und die Liste zeigt, woher
ein Gerät kommt und was es ist.

### Hinzugefügt

- Verfügbarkeitsprotokoll: Device Panel hält für jedes überwachte Gerät fest,
  wann es ausfällt und wann es zurückkommt (31 Tage in einer eigenen Datei,
  nicht im Recorder). Kurze Aussetzer unter der Schwelle von 2 Minuten
  zählen nicht; der Beginn eines Ausfalls ist der echte Zeitpunkt, ab dem
  das Gerät nicht mehr antwortete. Zeit, in der Home Assistant nicht lief,
  gilt als "keine Daten", nie als Ausfall, und die ersten 5 Minuten nach
  einem Start sind eine Anlaufphase.
- Spalten "Typ" (z. B. Licht, Steckdose, Bewegung, Tür/Fenster, Klima,
  Hub/Bridge), "Integration" mit dem Eintrag, zu dem das Gerät gehört, und
  "Verfügbarkeit 24 Std." mit einem Streifen der letzten 24 Stunden. Das
  bereitet vor, später ganze Integrationen oder Gerätetypen auszuschliessen.
- Gruppe "Instabil": Geräte, die online sind, aber 3 oder mehr Unterbrüche in
  24 Stunden hatten.
- Ausfall-Puls: Geräte mit Unterbruch über die letzten 24 Stunden, mit
  Hinweis, wenn mehrere Geräte gleichzeitig ausfielen (Sammelausfall), samt
  gemeinsamer Integration.
- Geräte-Popup (wie bei UniFi Dynamic Clients): Status, Verfügbarkeit 24 Std.,
  Unterbrüche 7 Tage, Empfang und Batterie als Kacheln; Verbindung,
  Integration (mit Warnung, wenn ihr Eintrag nicht geladen ist),
  Geräteangaben und alle Entitäten mit Zustand. Entitäten, die entscheiden,
  ob das Gerät lebt, sind markiert. Ein Tipp auf eine Entität öffnet den
  Entitäts-Dialog von Home Assistant; ein Knopf öffnet die Geräteseite von
  Home Assistant.
- Statistik-Fenster (öffnet aus den Kacheln): Verfügbarkeit über 24 Stunden,
  7 oder 30 Tage mit Zeitstrahl (online, ausgefallen, keine Daten), die
  Unterbrüche mit Zeit und Dauer sowie Unterbrüche pro Tag.

### Geändert

- Niedrige Batterie, schwacher Empfang und Updates sind jetzt Filter-Chips
  neben "Nur Probleme" (statt einer Kachel oben); "Nur Probleme" umfasst
  auch instabile Geräte.
- Die Verfügbarkeit oben ist der Durchschnitt der letzten 24 Stunden, sobald
  das Protokoll Daten hat.
- Breite Tabellen scrollen seitlich; die Spalte mit dem Gerät bleibt stehen.

## [0.2.0b1] - 2026-10-01

Erste Vorabversion der neuen Geräteliste (Design C).

### Hinzugefügt

- Überblick oben: Anteil der Geräte online, gerade ausgefallene Geräte mit
  Dauer (längste zuerst), niedrige Batterie, schwacher Empfang und
  verfügbare Updates als Filter.
- Verbindungsart pro Gerät: Zigbee, Z-Wave, Thread, Matter (Thread, WLAN oder
  LAN aus der Matter-Diagnose), Bluetooth, WLAN, Netzwerk, Cloud; Empfang in
  dBm oder LQI (auch aus ZHA und Bluetooth); Hub, Bridge oder
  Bluetooth-Proxy.
- Batteriestand, Update-Hinweis und Namen der Integrationen pro Gerät.
- Filter-Chips nach Verbindungsart und "Nur Probleme"; Gruppen ausgefallen,
  keine Daten, online; auf dem Handy Karten.

### Geändert

- Ein Gerät gilt erst nach 2 Minuten ohne Lebenszeichen als ausgefallen; ein
  Verbindungssensor hat Vorrang, Diagnose-Entitäten zählen nur, wenn es
  nichts anderes gibt. Ausfälle, die kurz nach einem Neustart begannen,
  stehen als "mindestens" (≥) da.
- Zahlen und Uhrzeiten folgen der Home-Assistant-Sprache des Benutzers.

## [0.1.0b2] - 2026-10-01

Zweite Vorabversion. Bitte statt 0.1.0b1 verwenden: Jene wurde aus einem
früheren Commit veröffentlicht und enthält weder das Icon noch die folgenden
Änderungen (in ihrem Manifest steht noch 0.1.0).

### Hinzugefügt

- Icon und Logo in `brand/` (Home Assistant ab 2026.3 lädt sie lokal).
- Das Icon wird ohne Anmeldung unter `/device_panel/icon.png` ausgeliefert,
  bereit für Push-Meldungen in der Companion-App (wie bei UniFi Dynamic
  Clients).
- Panel-Tests auf Deutsch und Englisch, auf Desktop und Handy.

### Geändert

- Englische Panel-Texte: "offline" statt "down".

## [0.1.0b1] - 2026-10-01

Erste Vorabversion.

### Hinzugefügt

- Erstes Grundgerüst: Einrichtung über die Oberfläche (eine Instanz), Panel
  in der Seitenleiste mit allen Geräten samt Status, Bereich, Integration,
  Hersteller/Modell und Softwarestand; ausgefallene Geräte zuoberst; Suche
  und Statusfilter.
- Tests gegen ein echtes Home Assistant und Playwright-Suiten für das Panel,
  GitHub Actions für die Prüfungen von HACS und hassfest sowie die Tests.

[0.6.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.6.0
[0.5.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.5.0
[0.4.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.4.0
[0.3.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.3.0b1
[0.2.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.2.0b1
[0.1.0b2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b2
[0.1.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b1
