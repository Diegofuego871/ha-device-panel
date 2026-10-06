# Änderungsprotokoll

[English](CHANGELOG.md)

Alle nennenswerten Änderungen an dieser Integration stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/).

## [1.18.0] - 2026-10-06

Startwerte für neue Installationen.

### Geändert

- Neue Installationen starten mit den Werten, die der Autor nutzt (Wunsch des
  Nutzers, nach seinen Bildschirmfotos der Einstellungen):
  - Reihenfolge der Filter-Chips: zuerst "Alle" (angeheftet), dann Integration,
    Neu, Ausgefallen, Warnungen, Batterie niedrig, Batterie, Bereich, die
    Verbindungsarten (Thread, WLAN, Bluetooth, Zigbee, LAN, Cloud, Matter,
    Netzwerk, Unbekannt, Z-Wave) und zuletzt Schwacher Empfang, Update
    verfügbar und Eigene Einstellung. Ohne gespeicherte Folge ist das auch, was
    "Standardreihenfolge" wiederherstellt.
  - Inhalt der Ausfall-Meldung: Bereich, Integration, Verbindungsart, Offline
    seit und Batterie zuletzt (vorher: Bereich, Integration, Offline seit).
  - Inhalt der Batterie-Meldung: Stand, Bereich und Integration (vorher: Stand
    und Bereich).
  - Der Chip "Eigene Einstellung" ist ausgeblendet (einschalten unter
    Einstellungen › Darstellung › Filter-Chips).
- Der Inhalt der Meldungen und der ausgeblendete Chip gelten nur für neue
  Installationen, bestehende behalten, was sie haben. Die neue Standardfolge
  gilt auch für Installationen, die die Reihenfolge der Chips nie geändert haben
  (bisher: Bereich, Integration, "Alle" und die Verbindungsarten nach Zahl der
  Geräte); eine gespeicherte Folge bleibt, wie sie ist.

### Behoben

- Unter Einstellungen › Darstellung › Filter-Chips deckt die Vorschau der
  Handy-Leiste mit den angehefteten Chips beim Scrollen den Kopf des Dialogs
  nicht mehr ab.

## [1.17.0] - 2026-10-06

Warnschwelle für den Empfang pro Funkart.

### Hinzugefügt

- Warnschwelle für den Empfang pro Funkart (Wunsch des Nutzers): WLAN,
  Bluetooth, Zigbee, Z-Wave usw. bekommen je einen eigenen Wert, weil sie in
  verschiedenen Einheiten melden (WLAN und Bluetooth in dBm, Zigbee meist in LQI) und
  verschiedene Bereiche haben. Jede Funkart steht auf "Standard", "Eigene" oder
  "Aus" ("Aus" markiert sie nie als schwach).
  - Global: Einstellungen › Darstellung › Verbindungsart, Block "Empfang:
    Warnschwelle pro Funkart". Es erscheinen nur Funkarten mit Geräten, die
    einen Empfangswert melden.
  - Pro Integration: Einstellungen › Überwachung und Meldungen › Integrationen,
    Abschnitt "Empfang" der Integration. Der Wert der Integration geht dem
    globalen Wert vor; "Alles auf Standard" und "Alle zurücksetzen" schliessen
    ihn ein, die Integrationsliste zeigt "Empfang (n Funkarten)".
  - Reihenfolge der Geltung: eigener Wert am Gerät, dann Integration, dann
    globaler Wert, dann der feste Standard (unter -80 dBm bzw. LQI 61).
  - Eine Zahl gilt nur für Geräte, die in derselben Einheit melden (negativ =
    dBm, positiv = LQI); sonst gilt die nächste Stufe.
  - Im Geräte-Popup nennt die erste Auswahl, woher der Wert kommt ("Globaler
    Wert (unter -85 dBm)", "Wie Integration (unter -90 dBm)", "... (aus)"), mit
    der Herkunft "Integration Shelly" und was der Standard wäre.
  - Die KI-Einschätzung nutzt den Wert, der für das Gerät gilt (`signal.weak`
    und `own_threshold`).
  - Neue Optionen `signal_low` und `signal_low_integrations` (auch im
    Optionsdialog als YAML, etwa `{"wifi": -85, "zigbee": 40, "ble": "off"}`).

## [1.16.0] - 2026-10-06

Warnung statt Problem.

### Hinzugefügt

- Neuer Filter-Chip "Ausgefallen" mit der Zahl der Geräte, die gerade offline
  sind. Wie die Hinweis-Chips erscheint er nur, wenn er zutrifft, und lässt sich
  wie die anderen ordnen, ausblenden und anheften.
- Eine Zeile unten in der Kachel "Gerade ausgefallen": "3 Geräte mit Warnung"
  (Wunsch des Nutzers, Mockups `docs/mockups/chip-warn-v1/`, V1). Antippen zeigt
  nur diese Geräte. Ohne Warnungen steht dort "Keine Warnungen".

### Geändert

- Zwei Stufen statt "Problem": **Ausfall** (Gerät offline) und **Warnung**
  (instabil, Batterie niedrig, schwacher Empfang oder keine Daten). Der Chip
  "Nur Probleme" heisst jetzt "Warnungen" und zeigt nur Warnungen, ohne Ausfälle;
  er zeigt seine Zahl und erscheint nur, wenn er zutrifft. Mit eingeschaltetem
  "Ausgefallen" dazu sieht man, was "Nur Probleme" bisher zeigte.
- "Schwelle" heisst bei Batterie und Empfang jetzt "Warnschwelle" ("Eigene
  Warnschwelle", "Eigene Batterie-Warnschwelle", im Panel, im Optionsdialog und
  in der README). Gespeicherte Einstellungen bleiben gültig, keine Schlüssel
  geändert.

### Behoben

- Die Beschreibung des Chips sagte "Nur ausgefallene und instabile Geräte",
  obwohl er auch niedrige Batterie, schwachen Empfang und Geräte ohne Daten
  zeigte. Sie sagt jetzt, was der Chip tut.

## [1.15.0] - 2026-10-05

Chips anheften.

### Hinzugefügt

- Einstellungen › Darstellung › Filter-Chips: Eine Linie "angeheftet bis hier"
  in der Chip-Liste (Wunsch des Nutzers, Mockups `docs/mockups/chip-pin-v1/`, B).
  Sie hat einen Griff und lässt sich wie ein Chip verschieben. Die sichtbaren
  Chips darüber bleiben auf dem Handy beim seitlichen Scrollen der Leiste
  links stehen, mit einem Schatten an der Kante, sobald man scrollt. Ganz oben
  (Standard) ist nichts angeheftet.
  - Die Leiste scrollt nur auf schmalen Bildschirmen (bis 600 px) seitlich;
    auf dem Desktop bricht sie wie bisher um, dort hat das Anheften keine
    Wirkung.
  - Angeheftete Chips, die mehr als 60 % der Leiste einnähmen, scrollen
    stattdessen mit, damit der Rest erreichbar bleibt.
  - Die Vorschau über der Liste markiert die Kante mit einem Pin und zeigt,
    sobald etwas angeheftet ist, zusätzlich die Handy-Leiste seitlich gescrollt
    (zum Ausprobieren scrollbar).
  - Gilt für alle Benutzer, gespeichert mit der Reihenfolge in `chip_order`.

## [1.14.0] - 2026-10-05

Eine Liste für alle Filter-Chips.

### Hinzugefügt

- Einstellungen › Darstellung › Filter-Chips: Über der Liste zeigt eine
  Vorschau "So sieht die Leiste aus" die Chips in der eingestellten Reihenfolge,
  ausgeblendete und nicht zutreffende fehlen wie in der echten Leiste. Sie geht
  bei jeder Änderung mit.
- Feine Trenner in der Leiste zwischen zwei Chips verschiedener Art:
  Auswahlfenster (Bereich, Integration), "Alle" mit den Verbindungsarten (genau
  eine aktiv) und "Nur Probleme" mit den Hinweisen. In der Standardfolge stehen
  sie dort, wo sie immer standen.

### Geändert

- Die Reihenfolge aller Chips ist eine Liste (Wunsch des Nutzers, Mockups
  `docs/mockups/chip-order-v3/`, D2). "Alle" ist eine eigene Zeile mit Schloss
  ("fest"): Sie lässt sich verschieben, aber nicht ausschalten. Jede
  Verbindungsart ist eine eigene Zeile mit Schalter und Griff, Zigbee kann also
  auch zwischen zwei Hinweisen stehen. Von oben nach unten ist von links nach
  rechts. Vorher war "Verbindungsarten" ein Block, und die Verbindungsarten
  hatten darunter eine zweite Liste.
  - Die zweite Liste "Verbindungsart" und der Knopf "Nach Anzahl sortieren"
    entfallen. "Standardreihenfolge" setzt alles zurück (Bereich, Integration,
    Alle, Verbindungsarten nach Anzahl der Geräte, dann "Nur Probleme" und die
    Hinweise).
  - "Alle umschalten" schaltet alle Chips, auch die Verbindungsarten.
  - Verbindungsarten mit gleich vielen Geräten stehen jetzt in fester Folge statt
    in der Folge der Geräte.
  - Bestehende Einstellungen bleiben erhalten: Der Block aus 1.13.0 und die
    Reihenfolge der Verbindungsarten werden zu einer Folge. Im Optionsdialog von
    Home Assistant ist "Reihenfolge der Chips der Verbindungsart" jetzt nur noch
    die Ausgangsfolge, bis im Panel Chips gezogen werden.

## [1.13.1] - 2026-10-05

Nicht veröffentlicht; enthalten in 1.14.0.

Update-Kasten nach einem Neustart von Home Assistant.

### Behoben

- Nach "Jetzt neu starten" im Update-Kasten blieb "Home Assistant startet
  neu…" dauerhaft stehen, solange die Seite nicht neu geladen wurde: Home
  Assistant lädt das Panel nach einem Neustart nicht neu, und das Panel hat
  diesen Zustand nie zurückgesetzt. Der Kasten liest jetzt die laufende
  Version neu, sobald Home Assistant antwortet; läuft eine andere Version,
  verschwindet die Meldung. Kam innerhalb von 5 Minuten kein Neustart, ist
  der Knopf "Jetzt neu starten" wieder da.
- Lehnt Home Assistant den Neustart ab (zum Beispiel wegen ungültiger
  Konfiguration), erscheint der Fehler jetzt im Kasten ("Neustart
  fehlgeschlagen: …") und der Knopf bleibt. Vorher behauptete das Panel, es
  starte neu.

## [1.13.0] - 2026-10-05

Reihenfolge aller Filter-Chips.

### Hinzugefügt

- Die Reihenfolge aller Chips über der Liste lässt sich einstellen (Wunsch des
  Nutzers, zum Beispiel "Batterie" ganz nach vorn). Einstellungen › Darstellung
  › Filter-Chips: Die Liste "Weitere Chips" hat in jeder Zeile einen Griff (mit
  Maus oder Finger ziehen oder mit den Pfeiltasten verschieben), wie die Chips
  der Verbindungsart. Die neue Zeile "Verbindungsarten" steht für "Alle" und
  die Chips der Verbindungsart als ein Block; sie ist immer an und lässt sich
  wie die anderen verschieben. Die Reihenfolge innerhalb des Blocks bleibt
  darunter einstellbar.
  - Chips, die auf kein Gerät zutreffen, erscheinen weiterhin nicht, egal wo
    sie stehen.
  - Trenner stehen nur um den Block der Verbindungsarten und nur neben einem
    sichtbaren Chip. "Standardreihenfolge" setzt zurück; die Standardfolge
    wird als leer gespeichert. Gilt für alle Benutzer.
  - Neue Option `chip_order` (im Panel gesetzt, vom Optionsdialog von Home
    Assistant erhalten, der nicht ziehen kann).

## [1.12.2] - 2026-10-05

Zurück von der Geräteseite von Home Assistant, Ursache gefunden und behoben.

### Behoben

- Der Pfeil oben links auf der Geräteseite von Home Assistant führte zur
  Geräteliste von Home Assistant statt zurück ins Panel (Meldung des Nutzers,
  auch im Browser, also kein Problem der App). Ursache: Seit dem Frontend 20260930
  von Home Assistant hat die Geräteseite eine feste Rücksprungseite (die
  Geräteliste) und geht nur dann im Verlauf zurück, wenn der Verlaufseintrag
  sagt, woher man kam (`history.state.from`). Der Link des Panels legte den
  Eintrag ohne das an. Er legt ihn jetzt an wie die eigene Navigation von Home
  Assistant. In einem Home Assistant mit diesem Frontend geprüft: vorher ging
  der Pfeil nach `/config/devices/dashboard`, jetzt nach `/device-panel`; auch
  mit dem älteren Frontend 20260128.6.
  - Gilt für "HA-Geräteseite öffnen" im Geräte-Popup und für den Link zum
    HACS-Gerät in den Einstellungen.

### Geändert

- Der Merker `historyBack=1`, den 1.12.1 an den Link hängte, entfällt wieder:
  Er wirkte bei der Geräteseite nicht.

## [1.12.1] - 2026-10-05

Zurück von der Geräteseite von Home Assistant.

### Behoben

- "HA-Geräteseite öffnen" (Geräte-Popup und der Link zum HACS-Gerät in den
  Einstellungen) öffnet die Seite jetzt mit dem eigenen Merker
  `historyBack=1` von Home Assistant (Meldung des Nutzers: der Pfeil oben
  links auf der Geräteseite führte in der Companion-App zur Geräteliste von
  Home Assistant statt zurück ins Panel). Mit dem Merker geht Home Assistant
  im Verlauf zurück, also ins Panel, statt zu einer festen Seite. Versionen
  von Home Assistant, die den Merker nicht kennen, ignorieren ihn; dort geht
  der Pfeil schon im Verlauf zurück.

## [1.12.0] - 2026-10-04

"Gruppen | Liste" wandert in den Dialog "Anpassen".

### Geändert

- Der Schalter "Gruppen | Liste" nimmt keinen Platz mehr in der Chip-Zeile ein
  (Wunsch des Nutzers: Brauchen wir ihn wirklich?). Er steht jetzt ganz oben im
  Dialog "Anpassen" ("Spalten" auf dem Desktop, "Ansicht" auf dem Handy), mit
  seinem Hinweis: Gruppen halten die Ausgefallenen zuoberst und sortieren
  innerhalb jeder Gruppe, die Liste sortiert über alle Geräte (etwa nach
  Batterie).
  - Die Einstellung selbst bleibt gleich und pro Benutzer gespeichert,
    Desktop und Handy getrennt.
  - "Standard wiederherstellen" im Desktop-Dialog stellt auch die Gruppen
    wieder her.
  - Die Chip-Zeile und die Zeile darunter auf dem Handy sind kürzer.

## [1.11.0] - 2026-10-04

Jeden Filter-Chip ausblenden.

### Hinzugefügt

- Alle Filter-Chips lassen sich ausblenden (Wunsch des Nutzers):
  Einstellungen, "Darstellung", Reiter "Filter-Chips", neue Tabelle "Weitere
  Chips" über den Verbindungsarten: Bereich, Integration, Nur Probleme,
  Batterie, Batterie niedrig, Schwacher Empfang, Update verfügbar, Eigene
  Einstellung und Neu, je mit Schalter und "Alle umschalten". "Alle" bleibt
  immer.
  - Gilt für alle Benutzer, wie die ausgeblendeten Chips der Verbindungsart;
    die Geräte bleiben sichtbar.
  - Ein ausgeblendeter Chip hebt seinen Filter auf (Wunsch des Nutzers): "Nur
    Probleme", der Hinweis, Bereich und Integration werden zurückgesetzt,
    damit kein unsichtbarer Filter die Liste kürzt. Der Kopf zählt wieder
    alle Geräte.
  - Die Zusammenfassung des Abschnitts zählt die ausgeblendeten Chips beider
    Tabellen.
  - Neue Option `hide_chips`, auch im Optionsdialog von Home Assistant
    ("Filter-Chips ausblenden").

## [1.10.0] - 2026-10-04

Die KI-Einschätzung beachtet eine unsichere Batterie-Prognose.

### Hinzugefügt

- Der Fakt `battery_forecast` der KI-Einschätzung (Wunsch des Nutzers) sagt
  jetzt, wenn die Berechnung unsicher ist: `uncertain` mit
  `uncertain_reasons` (Sicherheit nicht "high", der Rückgang wird steiler und
  die Prognose damit eher zu optimistisch, oder weniger als 30 Tage Verlauf),
  dazu `days_range` (ohne `max`: mindestens so lange) und
  `days_of_history`. Bei zu wenig Verlauf steht das im Fakt ("too little
  history for a forecast"), statt dass er fehlt.
- Der Standard-Prompt weist die KI an, eine unsichere Prognose auch so zu
  behandeln: nur eine grobe Spanne, nie ein festes Datum, die Unsicherheit
  nennen, die Ursache nicht darauf stützen und die eigene Sicherheit senken,
  wenn eine Aussage zur Batterie darauf beruht.

### Geändert

- Der Standard-Prompt ist rund 340 Zeichen länger (4282 von 6000). Ein
  gespeicherter eigener Prompt behält seinen Text; "Standard" im Profi-Modus
  lädt den neuen.

## [1.9.0] - 2026-10-04

Nicht veröffentlicht; enthalten in 1.10.0.

Filter nach Integration, wie der Filter nach Bereich.

### Hinzugefügt

- Filter-Chip "Integration" neben "Bereich" (Wunsch des Nutzers): eine oder
  mehrere Integrationen in einer Liste mit der Zahl der Geräte wählen
  (Popover auf dem Desktop, Blatt auf dem Handy, Suche ab neun Einträgen,
  "Ohne Integration" für Geräte ohne eine).
  - Die Liste zeigt nur die Geräte der gewählten Integrationen; die übrigen
    Chips filtern darin weiter. "Alle" hebt Bereich und Integration auf.
  - Kombinierbar mit dem Filter nach Bereich (beide müssen passen): die
    Zahlen in jeder Auswahl und auf den Chips zählen mit dem anderen Filter.
  - Der Kopf (Verfügbarkeit, gerade ausgefallen, Ausfall-Puls,
    Sammelausfälle) und das Puls-Fenster zählen nur diese Geräte; der Titel
    nennt die Auswahl ("· Küche · Shelly").
  - Der aktive Chip zeigt einen oder zwei Namen, sonst die Zahl, und ein
    Kreuz, das nur diesen Filter aufhebt.
  - Pro Benutzer wie die Ansicht gespeichert, Desktop und Handy getrennt.
    Eine Integration, die es nicht mehr gibt, fällt still weg.
  - Der Filter nimmt die Integration des Geräts so, wie die Spalte
    "Integration" sie zeigt.

## [1.8.0] - 2026-10-04

Die Batterie der letzten 12 Monate in der KI-Einschätzung.

### Hinzugefügt

- Neuer Fakt `battery_last_12_months` für die KI-Einschätzung (Wunsch des
  Nutzers): Mittel und Tiefstand je Kalendermonat (höchstens 12), die
  Batteriewechsel mit Alter in Tagen und Stand davor und danach (die letzten
  6), der tiefste Stand und die abgedeckten Tage. Er stammt aus dem
  Batterie-Verlauf (Recorder) und gehört zur Gruppe `{facts_battery}`.
- Der Standard-Prompt erklärt ihn, vergleicht die Zeit zwischen den
  Batteriewechseln mit dem aktuellen Rückgang und lässt bei jedem
  Batteriegerät einen Satz zur Batterie der letzten 12 Monate in die
  Einschätzung einfliessen (Trend, Wechsel, Prognose).

### Geändert

- Der Prompt darf nun bis zu 6000 Zeichen lang sein (vorher 4000): Der
  Standard-Prompt braucht fast 4000. Gespeicherte Prompts bleiben gültig.
- Der Hinweis in den Einstellungen nennt die 12 Monate der Batterie.

## [1.7.0] - 2026-10-04

Gruppen der Fakten als Variablen im Profi-Modus der KI-Einschätzung.

### Hinzugefügt

- Profi-Modus: Neben `{language}` und `{facts}` (alles, wie bisher) kann der
  Prompt Gruppen der Fakten als Variablen nutzen (Wunsch des Nutzers):
  `{facts_device}`, `{facts_history}`, `{facts_battery}`, `{facts_signal}`,
  `{facts_integration}`, `{facts_area}`, `{facts_hub}` und `{facts_model}`.
  Wer `{facts}` nicht verwendet, setzt nur die gewünschten Gruppen ein und
  bestimmt so Umfang, Reihenfolge und Kosten. Die Fakten selbst werden nicht
  weiter aufgeteilt; jeder Fakt gehört zu genau einer Gruppe.
  - Das Fenster "Prompt bearbeiten" zeigt die neuen Variablen als Chips mit
    kurzer Erklärung (Tooltip) und einem Hinweis.
  - Ein Prompt braucht `{facts}` oder mindestens eine Gruppe; eine unbekannte
    Variable wird zuerst gemeldet.
  - Eine Gruppe ohne Fakten für das Gerät ist leer (`{}`). Die Vorschau zeigt
    den genauen Text.
  - Die Variablen werden in einem Durchgang ersetzt: Ein Platzhalter im
    Gerätenamen wird nicht nochmals ersetzt.
- Der Standard-Prompt bleibt unverändert und nutzt weiter `{facts}`.

## [1.6.0] - 2026-10-04

Nicht veröffentlicht; enthalten in 1.7.0.

Mehr Zusammenhang für die KI-Einschätzung: Raum, Funkstandard, Hub und mehr.

### Hinzugefügt

- Fakten für die KI-Einschätzung (Wunsch des Nutzers):
  - `same_area_devices`: die anderen Geräte im selben Bereich mit ihren
    Werten (Typ, Integration, Verbindungsart, Status, Minuten offline,
    Empfang mit `signal_weak`, Batterie, Unterbrüche in 24 Std.), auffällige
    zuerst (ausgefallen, instabil, schwacher Empfang oder Batterie), auch
    gesunde als Gegenbeweis; höchstens 15, ohne IDs oder Entitäten.
  - `same_area_same_connection`: wie viele Geräte im Bereich denselben
    Funkstandard nutzen (etwa Thread oder Bluetooth) und wie viele davon
    ausgefallen sind.
  - `same_hub_other_devices` und `same_hub_offline_devices`: andere Geräte
    am selben Hub oder Router, wie viele fehlen und wie viele im selben
    Bereich sind.
  - `went_offline_within_5_min_of_this_device`: bei ausgefallenen Geräten
    des Bereichs, des Hubs und der Integration, ob sie zusammen mit diesem
    ausfielen.
  - `same_model_other_devices`: gleicher Hersteller und gleiches Modell,
    auch nach Softwarestand (Serien- oder Firmware-Fehler).
  - `last_7d`: Verfügbarkeit, Unterbrüche und längster Unterbruch über
    7 Tage (Dauerproblem oder Einzelfall).
  - `battery_forecast`: Tage bis zur Warnschwelle, aus der Batterie-Prognose
    von 1.5.0.
- Der Standard-Prompt erklärt die neuen Fakten; gesunde Geräte im Bereich, am
  Hub oder mit demselben Funkstandard gelten als Beleg gegen eine gemeinsame
  Ursache.

### Geändert

- `same_area_offline_devices` entfällt zugunsten von `same_area_devices`, das
  die ausgefallenen Geräte mit Minuten enthält. Ein gespeicherter eigener
  Prompt behält seinen Text; "Standard" im Profi-Modus lädt den neuen.
- Die Hinweise im Popup und in den Einstellungen nennen, was gesendet wird.

## [1.5.0] - 2026-10-04

Batterie-Prognose im Verlaufsfenster der Batterie, ohne KI.

### Hinzugefügt

- Batterie-Verlauf: Ein Block "Prognose" zeigt, wie lange die Batterie
  voraussichtlich noch hält (Wunsch des Nutzers, ohne KI gerechnet):
  - Grundlage: der Verlauf seit dem letzten Batteriewechsel oder der
    längstmögliche Zeitraum, höchstens ein Jahr zurück. Die Prognose hängt
    nicht vom gewählten Zeitraum-Reiter ab.
  - Ziel: die beim Gerät geltende Warnschwelle (eigene, der Integration oder
    globale). Bei 5 % also die Zeit bis 5 %. Ist die Warnung beim Gerät aus,
    wird bis leer (0 %) gerechnet.
  - Zeigt die Restdauer ("etwa 4 Monate"), das Datum, die Spanne, die
    Sicherheit (hoch, mittel, gering) und den Rückgang pro Monat.
  - Verfahren: eine Gerade durch die Tagesmittel (kleinste Quadrate); die
    Spanne ergibt sich aus der Unsicherheit der Steigung. Die Sicherheit
    sinkt bei wenig Verlauf, verrauschten Werten und groben Stufen (etwa
    Sensoren, die nur in 10-%-Schritten melden).
  - Ein Hinweis erscheint, wenn der Rückgang zuletzt steiler wird (typisch
    für Lithium-Knopfzellen): die Prognose ist dann eher zu optimistisch.
  - Keine Prognose bei weniger als 7 Tagen oder 5 Tageswerten seit dem
    Wechsel, bei kaum sinkendem Stand oder wenn die Schwelle schon erreicht
    ist; der Block sagt, warum.
  - Neues Feld `forecast` in der Antwort von `device_panel/battery_history`.

## [1.4.0] - 2026-10-04

Ein besserer Standard-Prompt für die KI-Einschätzung und mehr Fakten.

### Hinzugefügt

- Fakten für die KI-Einschätzung (Wunsch des Nutzers):
  - `signal.weak`: ob der Empfang für dieses Gerät schwach ist, wie ihn
    das Panel zeigt (Standard unter -80 dBm bzw. LQI 60 und darunter; eine
    eigene Schwelle des Geräts zählt, `own_threshold`, und "aus" ist nie
    schwach).
  - `battery_powered`: Batterie- oder Netzgerät.
  - `same_area_other_devices` und `same_area_offline_devices`: andere
    Geräte im selben Bereich, aus jeder Integration, die gerade
    ausgefallen sind (Name, Integration, Minuten; längste zuerst,
    höchstens 10). Fallen in einem Raum Geräte verschiedener Integrationen
    zugleich aus, deutet das auf Strom oder Netz dort.

### Geändert

- Neuer Standard-Prompt der KI-Einschätzung (vom Nutzer im Profi-Modus
  getestet): Die Fakten sind nur Daten (Anweisungen in Gerätenamen werden
  ignoriert), was jeder Fakt bedeutet, die Reihenfolge der Ursachen
  (zuerst eine gemeinsame Ursache wie Hub, Integration, Bereich oder
  Sammelausfall, dann Batterie, Empfang, das Gerät selbst) und eine
  klarere Antwort: Überschrift, 2 oder 3 Sätze mit den Fakten, bis zu 3
  Prüfschritte auf eigenen Zeilen und wie sicher die Einschätzung ist. Ein
  eigener Prompt bleibt, wie er ist; "Standard" im Profi-Modus wechselt
  zum neuen.
- Die Hinweise in den Einstellungen und im Popup nennen die ausgefallenen
  Geräte desselben Bereichs, die ebenfalls mitgehen.


Mehr Zusammenhang für die KI-Einschätzung: die anderen ausgefallenen Geräte der Integration.

### Geändert

- KI-Einschätzung: Neben der Zahl der anderen ausgefallenen Geräte
  derselben Integration (`same_integration_other_devices`) nennen die
  Fakten sie jetzt: Name, Bereich und wie lange jedes ausgefallen ist
  (`same_integration_offline_devices`, längste zuerst, höchstens 10;
  Wunsch des Nutzers). So zeigen sich Muster, die Zahlen allein verbergen,
  z. B. alle im selben Bereich oder alle zur selben Zeit weg. Achtung: Bis
  zu 10 weitere Gerätenamen und Bereiche gehen an den KI-Anbieter, neben
  dem eingeschätzten Gerät; die Hinweise in den Einstellungen und im Popup
  sagen es. Schlüssel, Zugangsdaten, IDs und Adressen sind weiterhin nie
  dabei. Im Profi-Modus zeigt die Vorschau genau, was gesendet wird.

## [1.2.0] - 2026-10-04

Nicht veröffentlicht; enthalten in 1.3.0.

Profi-Modus der KI-Einschätzung: den Prompt ansehen, kopieren und anpassen.

### Hinzugefügt

- Einstellungen, "KI-Einschätzung": Der Schalter "Profi-Modus" zeigt den
  Prompt, der an die KI-Aufgabe geht, mit seinen zwei Variablen
  `{language}` (Sprache der Antwort) und `{facts}` (die Fakten eines Geräts
  als JSON), dazu die Knöpfe "Bearbeiten …", "Kopieren" und "Standard"
  (Wunsch des Nutzers). "Bearbeiten …" öffnet das Fenster "Prompt
  bearbeiten": Textfeld mit Chips zum Einfügen der Variablen, Zähler
  (höchstens 4000 Zeichen), Hinweis, dass die erste Zeile der Antwort zur
  Überschrift wird, und ein Reiter "Vorschau" mit dem Text genau so, wie er
  gesendet würde, mit den Fakten eines gewählten Geräts. Die Vorschau
  schickt nichts an die KI. `{facts}` ist Pflicht; andere Platzhalter
  werden abgelehnt. Gespeichert wird ein Prompt als Option `ai_prompt`
  (leer = Standard); der Standard muss nicht gespeichert werden. Ein
  eigener Prompt kann nicht mehr Daten anfordern: Es gehen weiter nur die
  Fakten raus, nie Schlüssel, Zugangsdaten, IDs oder Adressen. Der
  Optionsdialog von Home Assistant hat dafür kein Feld.

## [1.1.0] - 2026-10-04

Nicht veröffentlicht; enthalten in 1.2.0.

"Alle zurücksetzen" bei den Integrationen, alle Filter-Chips in den Einstellungen.

### Geändert

- Einstellungen, "Darstellung" › "Filter-Chips": Die Liste zeigt jede
  Verbindungsart, die es gibt, auch ohne Geräte (z. B. Matter, LAN), damit
  sich ein Chip im Voraus ausblenden oder einordnen lässt (Wunsch des
  Nutzers). Vorher standen nur Arten mit Geräten in der Liste.

### Hinzugefügt

- Einstellungen, "Überwachung und Meldungen" › "Integrationen": Der Knopf
  "Alle zurücksetzen" neben dem Filter setzt alle Integrationen auf einmal
  auf den Standard zurück (Ausgefallen nach, Push, anhaltende
  Benachrichtigung, Schwelle schwache Batterie, Push bei schwacher
  Batterie), wie "Alle zurücksetzen" bei den Geräten. Gilt mit
  "Speichern"; grau, wenn nichts abweicht. Geräte mit eigener Einstellung
  bleiben, wie sie sind (zurücksetzen in den Reitern "Ausfall" und
  "Batterie").

## [1.0.0] - 2026-10-04

Fünf Abschnitte in den Einstellungen statt acht.

### Geändert

- Einstellungen (Wunsch des Nutzers: weniger Punkte, was zusammengehört an
  einem Ort): "Geräte im Panel" steht zuoberst und enthält alles, was
  bestimmt, welche Geräte das Panel zeigt und überwacht: die Schalter
  "Dienst-Geräte anzeigen" und "Deaktivierte Geräte anzeigen" und die
  Reiter "Integrationen", "Typen" und "Geräte" (die einzeln
  ausgeblendeten), je mit der Zahl der ausgeblendeten und einem Punkt bei
  ungespeicherten Änderungen. "Überwachung und Meldungen" bleibt
  unverändert. "Darstellung" enthält, was nur ändert, wie Geräte
  erscheinen: die Reiter "Verbindungsart" (pro Integration, mit den
  Ausnahmen auf Geräten) und "Filter-Chips" (welche Chips, in welcher
  Reihenfolge). Die bisherigen Abschnitte "Integrationen", "Gerätetypen",
  "Verbindungsart", "Anzeige" und "Ausgeblendete Geräte" gehen in diesen
  beiden auf. Keine Option hat sich geändert; gespeicherte Einstellungen
  bleiben. Die Zusammenfassung von "Geräte im Panel" nennt, was
  ausgeblendet ist, z. B. "1 Integration, 1 Typ ausgeblendet".

## [0.34.1] - 2026-10-04

Nicht veröffentlicht; enthalten in 1.0.0.

Der Puls ist rot, wo er über null liegt, und grün nur, wo er auf null liegt.

### Behoben

- Puls oben und im Fenster "Unterbrüche in 24 Std.": Die Linie ist jetzt
  abschnittweise gefärbt (Wunsch des Nutzers): rot, solange die Kurve über
  null liegt, auch An- und Abstieg, grün nur, wo sie auf null liegt; die
  rote Fläche nur unter den roten Abschnitten. 0.34.0 färbte die ganze
  Kurve grün, sobald gerade kein Gerät ausgefallen war, also auch die
  Höcker vergangener Unterbrüche.

## [0.34.0] - 2026-10-04

Überwachung und Meldungen an einem Ort, mit Zeitstrahl je Meldung.

### Hinzugefügt

- Einstellungen: neuer Abschnitt "Überwachung und Meldungen" zuoberst, mit
  vier Reitern (Wunsch des Nutzers: alles, was überwacht oder meldet, an
  einem Ort, damit sofort klar ist, wann welche Meldung kommt):
  - "Übersicht": je Meldung ein Zeitstrahl. Ausfall: Gerät weg, im Panel
    ausgefallen nach "Ausgefallen nach", Push nach "Erst melden nach" (eine
    Marke, wenn beide gleich sind). Batterie schwach: Schwelle, dann Push
    sofort oder täglich zur gewählten Zeit. Die Schalter als Chips (Push,
    Anhaltend, Wieder online, Sammelausfall), wie viele Integrationen und
    Geräte abweichen (mit Verweis), Ziel und was ein Tipp öffnet.
  - "Ausfall": die beiden Zeiten auf einem einstellbaren Zeitstrahl,
    Erkennung (Instabil ab, Anlaufphase), Meldung (Push, Wieder online,
    Sammelausfall, anhaltende Benachrichtigung, Inhalt mit Vorschau) und
    die Abweichungen (Integrationen, Geräte zum Zurücksetzen).
  - "Batterie": "Schwach ab" auf dem Zeitstrahl, Push mit Zeitpunkt und
    Inhalt der Tagesmeldung, anhaltende Benachrichtigung, Inhalt mit
    Vorschau, Abweichungen.
  - "Integrationen": eine Zeile je Integration mit dem, was vom Standard
    abweicht, in einem Satz, Filter "Abweichend". Ein Tipp öffnet alle
    Einstellungen der Integration mit eigenem Zeitstrahl (z. B. Push erst
    nach 60 Min., wenn ihre Geräte erst dann als ausgefallen gelten):
    Überwachen, Ausgefallen nach, Push bei Ausfall, anhaltende
    Benachrichtigung, Schwach ab, Push bei schwacher Batterie, ihre Geräte
    mit eigener Einstellung, "Alles auf Standard". Etiketten "Standard" und
    "Eigene" wie im Geräte-Popup.
- Push bei schwacher Batterie lässt sich pro Integration ausschalten
  (Option `battery_push_exclude_integrations`); die rote Markierung im
  Panel und die anhaltende Benachrichtigung bleiben. Das Geräte-Popup sagt
  es neben der Batterie-Warnung.
- Der Inhalt des Push bei schwacher Batterie ist wählbar wie bei der
  Ausfall-Meldung: Stand, Bereich, Integration, Hersteller und Modell
  (Option `battery_fields`, Standard Stand und Bereich wie bisher), mit
  Vorschau. Die Tages- oder Sammelmeldung nennt die weiteren Angaben in
  Klammern nach jedem Gerät.

### Geändert

- "Erst melden nach" kann nicht mehr kürzer sein als "Ausgefallen nach"
  (Wunsch des Nutzers): Vorher gilt ein Gerät nicht als ausgefallen, ein
  kürzerer Wert wirkte nicht und führte in die Irre. Das Panel zeigt den
  Fehler unter beiden Feldern und sperrt "Speichern", auch wenn
  "Ausgefallen nach" später erhöht wird; der Optionsdialog von Home
  Assistant zeigt denselben Fehler. Den Wert 0 ("sobald ausgefallen") gibt
  es nicht mehr. Ein früher gespeicherter Wert (0 oder kürzer) gilt wie
  schon immer als "Ausgefallen nach" und bleibt, bis er geändert wird.
- Der Abschnitt "Integrationen" hat nur noch "Anzeigen"; Push, Anhaltend
  und Ausgefallen nach pro Integration stehen jetzt in "Überwachung und
  Meldungen" › "Integrationen". Die Abschnitte "Ausfall-Erkennung",
  "Batterie", "Push-Benachrichtigung" und "Anhaltende Benachrichtigung"
  gehen im neuen Abschnitt auf.
- "Überwachen" ist pro Integration ein eigener Schalter (vorher: "Nicht
  überwachen" in der Auswahl "Ausgefallen nach"); aus heisst weiterhin
  keine Ausfälle, Batterie-Warnung, Statistik und Meldungen.
- Optionsdialog von Home Assistant: gleiche Reihenfolge wie der neue
  Abschnitt, mit den zwei neuen Feldern.
- Der Puls oben wird wieder grün, sobald kein Gerät mehr ausgefallen ist
  (Wunsch des Nutzers: "wieder grün, dass man das sieht"); die Höcker der
  vergangenen Unterbrüche bleiben sichtbar. Rot nur, solange ein Gerät
  fehlt. Ebenso im Fenster "Unterbrüche in 24 Std.".
- Kachel "Verfügbarkeit": Gross steht der Anteil, der gerade online ist,
  wie der Ring ("100 % jetzt", wenn alle online sind); darunter kleiner
  der Durchschnitt der letzten 24 Stunden ("Ø 24 Std.: 98,7 %"). Vorher
  stand gross der Durchschnitt 24 Std. und las sich neben einem vollen Ring
  wie ein Fehler (Rückfrage des Nutzers). Nie 100 %, solange ein Gerät
  fehlt.

## [0.33.1] - 2026-10-04

Verständlicher: "Inhalt der Ausfall-Meldung" ist nicht die Batterie-Warnung.

### Geändert

- Einstellungen, Abschnitt "Push-Benachrichtigung": "Inhalt der Meldung"
  heisst jetzt "Inhalt der Ausfall-Meldung", der Schalter "Batterie" jetzt
  "Batterie zuletzt" (wie "Empfang zuletzt"). Ein Hinweiskasten unter den
  Schaltern sagt, was die Einstellung umfasst: nur die Ausfall-Meldung
  ("Ausgefallen: …"), nicht die Warnung bei schwacher Batterie, die eine
  eigene Meldung mit festem Inhalt (Stand und Bereich) ist und im
  Abschnitt "Batterie" eingestellt wird. Dieser Abschnitt sagt es
  umgekehrt. Der Optionsdialog von Home Assistant hat dieselben Texte.

### Behoben

- Die Puls-Kachel im Kopf ersetzt nicht mehr alle 10 Sekunden die ganze
  Kachelreihe: Ihre Zeitachse folgte der Sekunde der letzten Abfrage, die
  Reihe wurde bei jeder Aktualisierung neu aufgebaut, und ein Tipp genau in
  diesem Moment ging verloren (das Puls-Fenster öffnete sich nicht; von der
  Testsuite entdeckt). Die Achse folgt jetzt der Minute.

## [0.33.0] - 2026-10-03

Optionale KI-Einschätzung eines Geräts.

### Hinzugefügt

- Geräte-Popup: ein Knopf "Mit KI einschätzen" unter der Statistik. Auf
  Knopfdruck (nie von selbst) schickt das Panel die Fakten dieses einen
  Geräts (Name, Bereich, Typ, Hersteller und Modell, Status und Dauer eines
  Ausfalls, Verfügbarkeit und Unterbrüche der letzten 24 Stunden, Batterie,
  Empfang, Hub, Integration, ob andere Geräte der Integration ausgefallen
  sind, Sammelausfälle, an denen es beteiligt war) an eine KI-Aufgabe von
  Home Assistant (`ai_task.generate_data`) und zeigt die Antwort als Karte
  mit Überschrift, Quelle und Zeit sowie "Neu erstellen". Nie gesendet
  werden Schlüssel, Zugangsdaten, IDs, Adressen und Entitätsnamen. Die
  Antwort bleibt nur im Panel, sie wird nicht gespeichert. Fehler (keine
  KI-Aufgabe, Zeitüberschreitung, Fehler der Aufgabe) werden erklärt.
- Einstellungen, neuer Abschnitt "KI-Einschätzung": standardmässig aus,
  weil je nach Anbieter die Daten das eigene Netz verlassen und pro Anfrage
  kosten. Eingeschaltet erscheint der Knopf; die KI-Aufgabe ist wählbar
  (leer = Standard von Home Assistant). Der Optionsdialog hat dieselben
  zwei Einstellungen (`ai_assessment`, `ai_task_entity`). Braucht eine
  KI-Aufgabe in Home Assistant (Einstellungen → System → Allgemein).

## [0.32.0] - 2026-10-03

Nicht veröffentlicht; enthalten in 0.33.0.

Thread-Rolle und Netzname für Matter-Geräte.

### Hinzugefügt

- Geräte-Popup, Abschnitt "Verbindung": Bei Matter-Geräten zwei weitere
  Kacheln aus der Matter-Diagnose: "Thread-Rolle" (Router, Endgerät oder
  schlafendes Endgerät, mit kurzem Hinweis) und "Netz" (der Netzname des
  Thread-Netzes, bei WLAN-Geräten der Netzname des WLANs). Die Kacheln sind
  Zusatzangaben: Die Verbindungsart von Hand (z. B. Thread) bleibt möglich
  und geht vor der Erkennung. Unbekannte Rollen, Bridges und Geräte, die der
  Matter-Server nicht erreicht, zeigen keine Kachel.

## [0.31.0] - 2026-10-03

Nicht veröffentlicht; enthalten in 0.33.0.

Herkunft jeder Einstellung im Geräte-Popup und "Ausgefallen nach" pro Gerät.

### Hinzugefügt

- Geräte-Popup, "Einstellungen für dieses Gerät": Unter jeder Einstellung
  zeigt ein Etikett, woher der Wert kommt (Standard, Integration mit Namen
  oder Gerät), und was der Standard wäre ("Standard wäre 2 Min."). Die
  Erklärung steht jetzt im Tooltip des Etiketts. Auch die Auswahl sagt es:
  "Wie Integration (1 Std.)" statt "Globaler Wert", wenn die Integration
  einen eigenen Wert hat.
- Neue Zeile "Ausgefallen nach" pro Gerät: wie Integration bzw. globaler
  Wert, eigene Zeit in Minuten (1 bis 1440) oder "Nicht überwachen". Das
  Gerät geht vor, auch gegen "Nicht überwachen" der Integration. Ein Symbol
  beim Namen und der Chip "Eigene Einstellung" zeigen Geräte mit eigener
  Zeit; in den Einstellungen (Abschnitt "Ausfall-Erkennung") setzt eine
  Liste sie auf den Wert der Integration bzw. den globalen Wert zurück,
  einzeln oder alle.
- Ausfall-Meldungen zeigen den Stand der Integration: "Push an ·
  Anhaltend aus", und "Wie Integration", wenn die Integration von Push oder
  anhaltender Benachrichtigung ausgenommen ist.

## [0.30.0] - 2026-10-03

Nicht veröffentlicht; enthalten in 0.33.0.

Eigenes "Ausgefallen nach" pro Integration und "Nicht überwachen".

### Hinzugefügt

- Einstellungen, Abschnitt "Integrationen": Neue Spalte "Ausgefallen nach"
  mit einer Auswahl pro Integration: Standard, eine feste Zeit (1, 2, 5,
  10, 15 oder 30 Minuten; 1, 2, 6, 12 oder 24 Stunden) oder "Nicht
  überwachen". Geräte, die selten melden (z. B. Bluetooth-Sensoren), gelten
  so nicht schon nach zwei Minuten als ausgefallen. Massgebend ist die
  primäre Integration des Geräts. Auf dem Handy steht die Auswahl unter dem
  Namen. Der Optionsdialog von Home Assistant hat dieselbe Einstellung als
  Zuordnung (`offline_after_integrations`, z. B. `zha: 60` oder
  `hue: off`, 1 bis 1440 Minuten).
- "Nicht überwachen": Die Geräte der Integration bleiben sichtbar, in einer
  eigenen Gruppe "Nicht überwacht" mit dem Status "Nicht überwacht", haben
  aber keine Ausfälle, keine Verfügbarkeitsstatistik, keine Meldungen
  (Ausfall oder Batterie) und keine eigene Aufzeichnung des Empfangs, und
  zählen nicht im Kopf, im Puls der Ausfälle und bei den instabilen
  Geräten.

### Geändert

- Das Nachfüllen des Verfügbarkeitsprotokolls aus dem Recorder nimmt die
  Zeit "Ausgefallen nach" der Integration des jeweiligen Geräts.

## [0.29.1] - 2026-10-03

Nicht veröffentlicht; enthalten in 0.33.0.

Verständlicherer "Inhalt der Meldung".

### Behoben

- Einstellungen, "Inhalt der Meldung": Die Vorschau nimmt jetzt das
  ausgefallene Gerät mit den meisten Angaben, und fehlt dem gezeigten Gerät
  ein Wert (z. B. der Batteriestand), steht ein Beispielwert in Kursiv.
  So ändert jeder Schalter die Vorschau sichtbar. Ein Hinweis sagt das; die
  echte Meldung lässt eine solche Angabe weg.
- Der Erklärtext sagt, was die Schalter bedeuten: "Batterie" und "Empfang
  zuletzt" nennen den letzten bekannten Stand des ausgefallenen Geräts,
  "Offline seit" den Beginn des Ausfalls, und die Warnung bei schwacher
  Batterie ist eine eigene Meldung.

## [0.29.0] - 2026-10-03

Batterie-Verlauf für 6 und 12 Monate.

### Hinzugefügt

- Das Fenster "Batterie" hat zwei weitere Zeiträume: 6 Monate und 12
  Monate, aus der Langzeitstatistik als Tagesmittel (Monate auf der Achse,
  Batteriewechsel weiter markiert). Auf dem Handy scrollt die Auswahl der
  Zeiträume seitlich und holt den gewählten Zeitraum ins Bild.

## [0.28.0] - 2026-10-03

Fixierter Kopf auf Handy und Desktop.

### Geändert

- Handy und Desktop, in beiden Ansichten (Gruppen und Liste): Nur noch die
  Liste scrollt. Sind die Kacheln weggescrollt, bleibt oben eine Zeile
  stehen ("11 von 16 online · 4 ausgefallen", mit dem Bereich, wenn der
  Filter gilt); die Chips (auf dem Handy auch die Sortierung) bleiben
  darunter, und auf dem Desktop klebt die Kopfzeile der Tabelle direkt
  unter den Chips. Ein Tipp auf die Zeile scrollt zurück zu den Kacheln.
- Die Kachel "Hinzugefügt" im Geräte-Popup zeigt das Datum mit Jahr
  (z. B. "Sa., 13.06.2026, 12:56").

## [0.27.1] - 2026-10-03

Verbindungsverlust zeigt keinen Fehler mehr.

### Behoben

- Nach dem Ruhezustand des Handys zeigte das Panel "Laden fehlgeschlagen:
  [object Object]" und eine leere Liste. Home Assistant meldet eine
  verlorene Verbindung nicht als Fehler mit Text, sondern als Zahl oder
  Objekt, und das Panel verstand es nicht. Jetzt bleibt die Liste stehen,
  unten steht der Hinweis "Verbindung zu Home Assistant unterbrochen, neuer
  Versuch …", und das Panel fragt von allein wieder ab (nach 1, 2, 4, 8 s,
  dann alle 10 s) und sofort, wenn das Handy aufwacht, die Seite
  zurückkommt oder das Netz wieder da ist. Beim ersten Laden ohne
  Verbindung bleibt es bei "Geräte werden geladen…" mit demselben Hinweis.
  Eine Abfrage ohne jede Antwort bricht nach 20 s ab. Echte Fehler behalten
  ihren Text; unlesbare heissen jetzt "unbekannter Fehler" statt
  "[object Object]".

## [0.27.0] - 2026-10-03

Empfangsverlauf füllt sich, Knopf "Gerät ausblenden".

### Geändert

- Empfangsverlauf: Für einen Sensor, den der Recorder nicht aufzeichnet
  (in seiner Konfiguration ausgeschlossen), zeichnet das Panel den Empfang
  jetzt selbst auf, wie bei ZHA und Bluetooth (jede Minute, solange das
  Gerät online ist). Das Fenster "Empfang" sagt, warum.
- Der Knopf im Geräte-Popup heisst jetzt "Gerät ausblenden" statt
  "Ausblenden". Auf schmalen Handys bleiben beide Knöpfe einzeilig.

### Behoben

- Empfangs- und Batterie-Verlauf zeigten nur den Punkt "jetzt", wenn der
  Recorder im Zeitraum keinen Eintrag hatte, z. B. weil sich der Wert
  länger nicht geändert hat, als der Recorder Daten aufbewahrt (Standard
  10 Tage), oder weil der Sensor im Recorder ausgeschlossen ist. Der
  aktuelle Wert gilt seit seiner letzten Änderung; die Linie beginnt jetzt
  dort (höchstens am Anfang des Zeitraums), mit dem Hinweis "Wert
  unverändert seit …".
- Eine fehlgeschlagene Abfrage des Recorders für den Empfangs- oder
  Batterie-Verlauf steht jetzt als Warnung im Log statt nur auf Stufe
  Debug.

## [0.26.0] - 2026-10-03

Fenster zum Ausfall-Puls, Kopf pro Bereich, Dialog "Anpassen".

### Hinzugefügt

- Ein Tipp auf die Kachel "Ausfall-Puls" öffnet das Fenster "Unterbrüche
  in 24 Std.": der Puls gross, darunter alle Geräte mit Unterbrüchen in
  den letzten 24 Stunden, meiste Unterbrüche zuerst, mit Anzahl, Dauer
  zusammen und dem Streifen über 24 Stunden; gerade ausgefallene Geräte
  sind markiert. Ein Tipp auf einen Zeitpunkt im Puls zeigt nur die
  Geräte, die dann weg waren, ein Tipp auf ein Gerät öffnet sein Popup.

### Geändert

- Mit dem Filter "Bereich" folgt der Kopf den gewählten Bereichen: die
  Kachel "Verfügbarkeit" mit dem Ring, "Gerade ausgefallen", der
  Ausfall-Puls und die Sammelausfälle zählen nur deren Geräte, und die
  Kacheln zeigen den Bereich hinter ihrem Titel. Ein Sammelausfall bleibt
  nur, wenn im Bereich mindestens 3 Geräte betroffen waren.
- Desktop: Die Spalten wählt man im Dialog "Anpassen" statt in einem
  kleinen Aufklappfenster: ein Auge blendet eine Spalte ein oder aus, der
  Griff zieht sie in eine andere Reihenfolge, "Gerät" ist immer sichtbar;
  unten "Standard wiederherstellen" und "Fertig". Auf dem Handy hat das
  Blatt "Ansicht" dieselben Augen und Knöpfe.

### Behoben

- Der Ausfall-Puls zählte ein Gerät in einem Abschnitt von 30 Min.
  mehrfach, wenn es darin mehr als einmal ausfiel (oder ein Ausfall über
  einen Neustart lief); die Kurve zeigte so 3 Geräte, wo nur eines
  betroffen war. Er zählt jetzt Geräte, wie sein Tooltip sagt und wie der
  Streifen in der Liste.

## [0.25.0] - 2026-10-03

"Alle" hebt alle Filter auf.

### Geändert

- Ein Tipp auf den Chip "Alle" hebt alle Filter auf einmal auf: Bereich,
  Verbindungsart, "Nur Probleme" und die Hinweis-Chips (Batterie, Neu …).
  Die Suche bleibt (sie hat ihr eigenes ×). "Alle" ist nur hervorgehoben,
  wenn kein Filter aktiv ist, und die Zahl zeigt alle Geräte, so viele,
  wie das Antippen zeigt.

## [0.24.0] - 2026-10-03

Nicht veröffentlicht; enthalten in 0.25.0.

Farbiges Batteriesymbol und Empfangsverlauf.

### Hinzugefügt

- Ein Tipp auf die Kachel "Empfang" im Geräte-Popup öffnet den Verlauf des
  Empfangs über 24 Std., 7 Tage und 30 Tage: der Wert als Linie, die
  Schwelle der Empfang-Warnung gestrichelt, darüber aktueller Wert,
  Median, schlechtester und bester Wert. Empfang von einem Sensor (z. B.
  WLAN-RSSI, LQI von Zigbee2MQTT) kommt aus dem Recorder (30 Tage aus der
  Langzeitstatistik). Für ZHA und Bluetooth, deren Wert direkt aus der
  Integration kommt, zeichnet das Panel den Empfang jede Minute selbst auf
  (Median je 5 Min. für 24 Std., je Stunde für 31 Tage, mit der Spanne vom
  schlechtesten zum besten Wert); dieser Verlauf beginnt mit dem Update.
  Lücken heissen: Gerät ausgefallen oder nicht empfangen.

### Geändert

- Das Batteriesymbol zeigt den Stand als Füllung und in vier Farben wie die
  Empfangsbalken: grün über 50 %, gelbgrün bis 50 %, orange bis 30 %, rot,
  sobald die Batterie als schwach gilt (Schwelle der Batterie-Warnung, wie
  der Chip "Batterie niedrig"). Auch im Geräte-Popup.

## [0.23.0] - 2026-10-03

Einzelne Geräte ausblenden und nach Bereich filtern.

### Hinzugefügt

- Einzelne Geräte ausblenden: Knopf "Ausblenden" im Geräte-Popup. Ein
  ausgeblendetes Gerät ist ganz weg: nicht in der Liste und nicht im Kopf,
  nicht überwacht, keine Meldungen. Danach erscheint ein Hinweis mit
  "Rückgängig". Gilt für alle Benutzer.
- Einstellungen, neuer Abschnitt "Ausgeblendete Geräte": alle
  ausgeblendeten Geräte mit Name, Bereich und Integration, Schalter
  "Anzeigen" pro Gerät und "Alle einblenden", gilt mit "Speichern". Auch im
  Optionsdialog der Integration (Feld "Ausgeblendete Geräte").
- Filter "Bereich": Chip am Anfang der Chip-Zeile. Einen oder mehrere
  Bereiche oder eine ganze Etage wählen; die Liste zeigt nur deren Geräte,
  und die übrigen Chips filtern darin weiter. Etagen und Bereiche in der
  Reihenfolge aus Home Assistant, Bereiche ohne Etage und "Ohne Bereich"
  am Schluss, Zahl der Geräte je Bereich, Suche ab 9 Bereichen. Pro
  Benutzer gespeichert, Desktop und Handy getrennt. Der Kopf (Ring,
  "Gerade ausgefallen", Puls) zeigt weiter das ganze Haus.

## [0.22.0] - 2026-10-03

Batterie-Verlauf im Geräte-Popup.

### Hinzugefügt

- Ein Tipp auf die Kachel "Batterie" im Geräte-Popup (Geräte mit Batterie
  in Prozent) öffnet das Fenster "Batterie" mit 24 Std., 7 Tagen, 30 Tagen
  und 3 Monaten: der Stand als Linie mit Fläche wie ein Kurs, Achse immer
  0–100 %, die Warnschwelle gestrichelt, Batteriewechsel markiert und
  darunter aufgeführt (Sprung um mindestens 30 Punkte nach oben). Oben der
  aktuelle Stand, die Veränderung seit dem letzten Wechsel und der
  Verbrauch pro Tag, sonst tiefster und höchster Wert.
- Quelle ist der Recorder: 24 Std. und 7 Tage aus dem Verlauf, 30 Tage und
  3 Monate aus der Langzeitstatistik (Stundenwerte, bleiben über die
  10 Tage des Recorders hinaus). Ohne Statistik (Sensor ohne state_class)
  gilt der Verlauf, so weit der Recorder Daten hat; das Fenster sagt das.

## [0.21.0] - 2026-10-03

Nicht veröffentlicht; enthalten in 0.22.0.

Empfang-Warnung pro Gerät und neue Geräte markiert.

### Hinzugefügt

- Geräte-Popup, "Einstellungen für dieses Gerät": "Empfang-Warnung" wie die
  Batterie-Warnung: globaler Wert (unter -80 dBm bzw. LQI 61), eigene
  Schwelle "schwach unter" oder aus. Die eigene Schwelle beginnt etwas
  unter dem heutigen Wert (5 dBm bzw. 10 LQI). Markierung, Chip "Schwacher
  Empfang" und "Nur Probleme" folgen; sie zählt als eigene Einstellung
  (Symbol beim Namen, Chip "Eigene Einstellung") und lässt sich in den
  Einstellungen im Abschnitt "Verbindungsart" zurücksetzen. Für Geräte,
  die immer schwachen Empfang haben.
- Neue Geräte: die ersten 3 Tage nach dem Hinzufügen in Home Assistant
  steht "Neu" beim Namen (Datum im Tooltip), der Chip "Neu" zeigt nur sie.
  Das Geräte-Popup zeigt "Hinzugefügt" mit Datum.

### Geändert

- Der Abschnitt "Meldungen für dieses Gerät" im Geräte-Popup heisst jetzt
  "Einstellungen für dieses Gerät".

## [0.20.0] - 2026-10-03

Nicht veröffentlicht; enthalten in 0.22.0.

Ausfall-Meldungen pro Integration, mit Verzögerung, Inhalt, Aktionen und
anhaltender Benachrichtigung.

### Hinzugefügt

- Einstellungen → "Integrationen": neben "Anzeigen" zwei weitere Spalten,
  "Push" und "Anhaltend", je mit "Alle umschalten". Sie bestimmen, welche
  Integrationen Ausfall-Meldungen senden und welche in der anhaltenden
  Benachrichtigung stehen; ausgeblendete Integrationen sperren beide. Die
  Zusammenfassung zeigt "Push für N", wenn Push-Meldungen eingeschaltet
  sind.
- Einstellungen → "Push-Benachrichtigung": "Erst melden nach" (0–60 Min.,
  Standard 0). Kurze Aussetzer lösen keine Meldung aus, auch kein "wieder
  online". Die Wartezeit läuft ohne Zustandswechsel weiter und übersteht
  einen Neustart von Home Assistant.
- "Inhalt der Meldung": Bereich, Integration, Verbindungsart, offline
  seit, Empfang zuletzt, Batterie, Hersteller / Modell als Schalter
  (Standard: Bereich, Integration, offline seit), immer in dieser
  Reihenfolge, mit Vorschau einer Ausfall-Meldung mit einem Gerät aus der
  Liste.
- Ausfall-Meldungen haben die Knöpfe "Öffnen" (das Gerät im Panel) und
  "24 Std. stumm" (schaltet das Gerät einen Tag stumm). Das Geräte-Popup
  zeigt "Stumm bis …"; "Globale Einstellung" hebt es auf.
- Neuer Abschnitt "Anhaltende Benachrichtigung" mit "Bei Ausfällen": eine
  Benachrichtigung in Home Assistant listet alle ausgefallenen Geräte mit
  Link zum Gerät, solange sie ausgefallen sind. Weggeklickt kommt sie erst
  bei einem neuen Ausfall wieder.

### Geändert

- "Ausfall melden" nennt die Wartezeit, wenn "Erst melden nach" länger
  ist als "Ausgefallen nach".

### Behoben

- Eine von Hand gesetzte Verbindungsart (z. B. Thread) konnte bis zur
  nächsten Abfrage auf die vorige (z. B. Matter) zurückspringen: eine
  Abfrage der Liste, die vor der Änderung begonnen hatte, überschrieb sie.
  Ein solches Ergebnis wird jetzt verworfen und die Liste neu abgefragt.
  Dasselbe galt für den Typ von Hand, die Einstellungen pro Gerät und
  gespeicherte Einstellungen.
- Fenster "Verfügbarkeit": ein Ausfall über Neustarts von Home Assistant
  erschien nach jedem Neustart als neuer Eintrag. Ausfälle ohne "online"
  dazwischen sind jetzt ein Eintrag vom Beginn bis zum Ende, in der Liste,
  der Zahl, der Summe, dem Prozentwert und dem Tooltip, wie in den
  Kacheln. Der Balken zeigt die Zeit ohne Daten weiterhin.

## [0.19.0] - 2026-10-02

Nicht veröffentlicht; enthalten in 0.22.0.

Spalten, Sortierung und Ansicht pro Benutzer, getrennt für Desktop und
Handy.

### Hinzugefügt

- Desktop: Knopf "Spalten" neben der Suche mit allen Spalten: ein- oder
  ausblenden, in eine eigene Reihenfolge ziehen (auch mit den
  Pfeiltasten), "Zurücksetzen". Neue, wählbare Spalten: Bereich,
  Unterbrüche 24 Std., Hub / Bridge.
- Sortieren per Klick auf den Spaltenkopf: aufsteigend, absteigend, dann
  wieder Standard (Ausfälle zuerst, längster zuoberst). Geräte ohne Wert
  bleiben am Ende.
- "Gruppen | Liste" neben den Filter-Chips: Gruppen halten Ausgefallene,
  Instabile usw. getrennt und sortieren darin; "Liste" zeigt eine Liste.
- Handy: Zeile "Sortiert nach" unter den Chips und ein Blatt "Ansicht"
  (Knopf neben der Suche) mit Sortierung, Richtung, Gruppen oder Liste und
  den Angaben auf der Karte (ein- und ausblenden, in eine eigene
  Reihenfolge ziehen).
- Die Ansicht gilt pro Benutzer, gespeichert in Home Assistant und auf
  allen Geräten gleich, getrennt für Desktop und Handy: Sortierung,
  Richtung, Gruppen oder Liste, Spalten bzw. Angaben auf der Karte und die
  Filter-Chips. Der Suchtext wird nicht gespeichert.

## [0.18.0] - 2026-10-02

Verfügbarkeitsprotokoll aus dem Recorder nachgefüllt.

### Hinzugefügt

- Einmal nach dem Update oder der Installation füllt die Integration das
  Verfügbarkeitsprotokoll aus dem Verlauf des Recorders nach, für die Zeit
  vor dem ersten Eintrag jedes Geräts, so weit der Recorder Daten hat
  (Standard 10 Tage, höchstens 31 Tage). Es gilt dieselbe Regel wie bei der
  laufenden Erkennung: ausgefallen nur, wenn alle Entitäten, die zeigen,
  dass das Gerät lebt, mindestens "Ausgefallen nach" nicht verfügbar sind,
  kein Ausfall, wenn das Gerät in der Anlaufphase nach einem Start
  zurückkommt, und Zeit, in der Home Assistant nicht lief, gilt als "keine
  Daten". Läuft im Hintergrund zwei Minuten nach dem Start und schickt für
  vergangene Ausfälle keine Meldungen. Grenzen: höchstens 3 Entitäten pro
  Gerät, ruhige zuerst (Verbindungssensor, dann alles ausser Sensoren);
  Entitäten mit sehr vielen Wechseln fallen weg; ein Absturz von Home
  Assistant erscheint nicht als Lücke.

## [0.17.0] - 2026-10-02

Nicht veröffentlicht; enthalten in 0.18.0.

Filter folgen der Suche, neuer Chip "Batterie", Verbindungsart von Hand als
eigene Einstellung.

### Hinzugefügt

- Chip "Batterie": alle Geräte mit Batterie, in jeder Gruppe nach Stand
  sortiert (der tiefste zuerst); auf dem Handy zeigt jede Karte den Stand.
- Suchfeld: ein Knopf (×) löscht die Suche.
- Eine am Gerät von Hand gesetzte Verbindungsart gilt als eigene
  Einstellung: Symbol beim Namen (Tooltip mit dem automatischen Wert), im
  Chip "Eigene Einstellung" enthalten und in den Einstellungen im Abschnitt
  "Verbindungsart" zum Zurücksetzen aufgeführt, einzeln oder alle auf
  einmal.

### Geändert

- Die Zahl auf einem Chip zählt mit der Suche und den übrigen Filtern: so
  viele Geräte, wie das Antippen zeigt (bisher immer alle Geräte). Chips
  ohne Treffer bleiben sichtbar, gedämpft, mit 0.
- Ein aktiver Chip der Verbindungsart lässt sich mit einem zweiten Tipp
  abwählen ("Alle").
- Handy: Die Kacheln oben (Verfügbarkeit, gerade ausgefallen, Ausfall-Puls)
  sind alle gleich hoch.
- Verfügbarkeit in Prozent erst ab 1 Stunde Daten (Liste, Popup,
  Statistik-Fenster, Durchschnitt oben). Bisher zeigte ein kurzer Ausfall
  kurz nach dem Start z. B. "50 %"; jetzt "–" mit dem Hinweis "Prozent ab
  1 Std. Daten". Unterbrüche und ihre Dauer erscheinen weiterhin.

## [0.16.0] - 2026-10-02

Verbindungsart pro Integration.

### Hinzugefügt

- Einstellungen, neuer Abschnitt "Verbindungsart": pro Integration eine
  Auswahl "Automatisch" oder eine Verbindungsart (Zigbee, Thread, Z-Wave,
  Matter, Bluetooth, WLAN, LAN, Netzwerk, Cloud). Sie gilt für alle Geräte
  der Integration statt der Erkennung, auch für richtig erkannte; eine am
  Gerät von Hand gesetzte Verbindungsart geht weiterhin vor. Jede Zeile
  zeigt, was die Erkennung gefunden hat ("5 Geräte · erkannt: 4 Zigbee,
  1 Unbekannt"). Liste, Spalte und Filter-Chips folgen. Auch im
  Optionsdialog, z. B. "hue: zigbee".
- Geräte-Popup, Kachel "Verbindungsart": ohne Wahl am Gerät heisst die
  erste Option "Wie Integration: …", mit Hinweis, wenn die Integration sie
  festlegt.

## [0.15.0] - 2026-10-02

Einstellungen bleiben nach dem Speichern offen; Bild der Push-Meldungen
nicht mehr abgeschnitten.

### Geändert

- Einstellungen im Panel: "Speichern" schliesst den Dialog nicht mehr. Er
  zeigt "Gespeichert" neben den Knöpfen und lädt den gespeicherten Stand
  neu; aufgeklappte Abschnitte und die Scrollposition bleiben. Ohne
  ungespeicherte Änderungen heisst der linke Knopf "Schliessen" statt
  "Abbrechen".

### Behoben

- Push-Meldungen: Das "D"-Symbol war auf dem Handy an den Ecken
  abgeschnitten (iOS zeigt das Bild in einem abgerundeten Quadrat). Die
  Meldungen haben jetzt ein eigenes Bild mit Rand
  (`/device_panel/push/icon.png`).

## [0.14.0] - 2026-10-02

Nicht veröffentlicht; enthalten in 0.15.0.

Batterie-Warnung für eine ganze Integration aus; Entfernen der Integration
löscht ihre Daten.

### Hinzugefügt

- Einstellungen, Abschnitt "Batterie", Liste "Eigene Schwelle pro
  Integration": pro Integration eine Auswahl wie im Geräte-Popup,
  "Globaler Wert", "Eigene Schwelle" oder "Aus". "Aus" schaltet die
  Batterie-Warnung (Markierung, Push, anhaltende Benachrichtigung) für alle
  Geräte der Integration ab; ihr Batteriestand bleibt sichtbar. Eine eigene
  Schwelle am Gerät geht weiterhin vor. Auch im Optionsdialog, z. B.
  "bthome: off".
- Entfernen der Integration löscht ihre eigenen Dateien
  (`.storage/device_panel.*`: Verfügbarkeitsprotokoll, Einstellungen pro
  Gerät, gemeldete Ausfälle und Batterien, gemeinsame Panel-Einstellungen),
  damit nichts zurückbleibt. Die Registries von Home Assistant hat die
  Integration nie verändert.

### Geändert

- "Eigene Schwelle pro Integration": statt eines leeren Felds für den
  globalen Wert hat jede Zeile eine Auswahl; das Zahlenfeld erscheint bei
  "Eigene Schwelle". Leer ist es dort ungültig (zurück auf den globalen
  Wert über die Auswahl).

## [0.13.0] - 2026-10-02

Nicht veröffentlicht; enthalten in 0.15.0.

Reihenfolge der Chips der Verbindungsart; Ausfalldauer über Neustarts von
Home Assistant.

### Hinzugefügt

- Einstellungen, Abschnitt "Anzeige", "Filter-Chips der Verbindungsart":
  die Chips am Griff in eine eigene Reihenfolge ziehen (Maus, Finger oder
  Pfeiltasten auf dem Griff). "Nach Anzahl sortieren" geht zurück auf die
  Standard-Reihenfolge (meiste Geräte zuerst). Gilt für alle Benutzer, wie
  das Ausblenden. Auch im Optionsdialog ("Reihenfolge der Chips der
  Verbindungsart"): gewählte Arten in der Reihenfolge der Auswahl, die
  übrigen folgen nach Anzahl der Geräte.

### Geändert

- Die Ausfalldauer zeigt ihren Beginn als Tooltip ("Ausgefallen seit …",
  mit Wochentag, Datum und Uhrzeit); "längster seit" auf der Ausfall-Tafel
  zeigt ebenfalls "≥", wenn der Beginn unbekannt ist.

### Behoben

- Ausfalldauer nach einem Neustart von Home Assistant: Liste, Ausfall-Tafel,
  Popup und Meldungen zeigten die Zeit seit dem Neustart statt des echten
  Ausfalls, oft mit "≥". Ein Ausfall endet jetzt erst, wenn Home Assistant
  das Gerät wieder online sieht; Zeit ohne Daten dazwischen (Home Assistant
  lief nicht) beendet ihn nicht. Beginn und Dauer kommen aus dem
  Verfügbarkeitsprotokoll, auch über mehrere Neustarts. "≥" bleibt nur, wenn
  der Beginn wirklich unbekannt ist (z. B. war das Gerät online, als Home
  Assistant stoppte, und nach dem Start weg).
- Statistik: Ein Ausfall über einen Neustart zählte doppelt (24 Stunden, 7
  und 30 Tage, "instabil") und konnte beim Start einen falschen
  Sammelausfall zeigen. Jetzt zählt er einmal; die Balken zeigen die Zeit
  ohne Daten weiterhin.
- Nach jedem Neustart galt ein schon ausgefallenes Gerät in den ersten
  Minuten als online: Das Protokoll schrieb "online", und mit eingeschalteten
  Meldungen kamen "Wieder online" und ein zweites "Ausgefallen". Solche
  Einträge früherer Versionen werden beim Laden des Protokolls entfernt.

## [0.12.0] - 2026-10-02

Nicht veröffentlicht; enthalten in 0.15.0.

Verbindungsart von Hand.

### Hinzugefügt

- Geräte-Popup, Kachel "Verbindungsart": wählbar wie der Typ,
  "Automatisch: <erkannt>" oder eine Verbindungsart (Zigbee, Thread,
  Z-Wave, Matter, Bluetooth, WLAN, LAN, Netzwerk, Cloud), für Geräte, deren
  Verbindung nicht erkannt wird (z. B. "Unbekannt"). Gilt sofort und wird
  von der Integration gespeichert; Liste, Spalte und Filter-Chips folgen.
  "Automatisch" geht zurück auf die Erkennung.

## [0.11.0] - 2026-10-02

Filter-Chips der Verbindungsart lassen sich ausblenden.

### Hinzugefügt

- Einstellungen, Abschnitt "Anzeige", auch im Optionsdialog: "Filter-Chips
  der Verbindungsart". Einzelne Chips (Zigbee, WLAN, Thread …) über der
  Liste ausblenden, damit es übersichtlicher wird; die Geräte bleiben
  sichtbar. "Alle", "Nur Probleme" und die Hinweise bleiben immer. Gilt für
  alle Benutzer. Ist der Filter eines ausgeblendeten Chips aktiv, geht er
  auf "Alle" zurück.

## [0.10.0] - 2026-10-02

Nicht veröffentlicht; enthalten in 0.11.0.

Einstellungen pro Gerät auf einen Blick: in der Liste markiert, filterbar
und in den Einstellungen zurücksetzbar.

### Hinzugefügt

- Geräteliste: Ein Gerät mit eigener Einstellung zeigt sie beim Namen, ein
  Symbol je Art: Batterie mit eigener Schwelle ("30 %"), Batterie-Warnung
  aus, Ausfall- und Online-Meldungen aus; der Tooltip nennt den Wert und den
  globalen Wert. Auch auf den Karten am Handy.
- Chip "Eigene Einstellung" (erscheint, sobald es eine gibt): nur Geräte mit
  eigener Einstellung.
- Einstellungen, Abschnitte "Batterie" und "Push-Benachrichtigung": die
  Geräte mit eigenem Wert (auch ausgeblendete), je mit Bereich und
  Integration; einzeln zurücksetzen (×, rückgängig möglich) oder "Alle
  zurücksetzen". Gilt wie alle Einstellungen mit "Speichern", "Abbrechen"
  verwirft.

## [0.9.1] - 2026-10-02

Nicht veröffentlicht; enthalten in 0.11.0.

### Geändert

- Geräte-Popup und Einstellungen sprechen vom globalen Wert statt von "wie
  eingestellt": "Globaler Wert (15 %)", "Globale Einstellung", "Globaler
  Wert: 15 %" in der Kurzzeile, "Leer = globaler Wert" bei der Schwelle pro
  Integration (auch im Optionsdialog).

### Behoben

- Auf dem Handy (iOS) ging eine Auswahl im Geräte-Popup oder in den
  Einstellungen nach der Wahl sofort wieder auf, und nach jeder
  Aktualisierung erneut. Nach einer Änderung bleibt sie jetzt zu.

## [0.9.0] - 2026-10-02

Push bei Ausfall und wenn Geräte wieder online sind, Zeitpunkt der
Batterie-Push-Meldung und Meldungen pro Gerät. Alle neuen Meldungen sind
standardmässig aus, das Update verschickt also nicht von sich aus etwas.

### Hinzugefügt

- Abschnitt "Push-Benachrichtigung", auch im Optionsdialog: "Ausfall
  melden" schickt einen Push, sobald ein Gerät als ausgefallen gilt (nach
  "Ausgefallen nach"), mit Bereich, Integration und Zeitpunkt des Ausfalls.
  "Wieder online melden" schickt die Entwarnung mit der Dauer des Ausfalls;
  auf dem Handy ersetzt sie die Ausfall-Meldung. Ein laufender Ausfall wird
  nach einem Neustart von Home Assistant nicht erneut gemeldet, die
  Entwarnung kommt trotzdem.
- "Sammelausfall zusammenfassen" (standardmässig an): 3 oder mehr Geräte,
  die im selben Durchlauf ausfallen, ergeben eine Meldung, mit vermuteter
  Ursache, wenn alle zur selben Integration gehören.
- Abschnitt "Batterie": "Zeitpunkt der Push-Meldung", sofort oder einmal
  täglich zu einer gewählten Uhrzeit (Standard 08:00). Die Tagesmeldung
  enthält die neu betroffenen oder alle schwachen Geräte (jeden Tag als
  Erinnerung, bis die Batterie gewechselt ist). Beim Wechsel auf "Sofort"
  kommen die Geräte, die noch auf die Tagesmeldung warten.
- Popup "Meldungen für dieses Gerät", sofort gespeichert: Batterie-Warnung
  wie eingestellt, mit eigener Schwelle oder aus (aus entfernt auch die
  Markierung in der Liste); Ausfall- und Online-Meldungen aus für dieses
  Gerät, überwacht wird es weiter.

### Geändert

- Der aufgeklappte Abschnitt in den Einstellungen hebt sich ab: Kopf
  dunkler, Titel fett, Inhalt getönt.
- Die Zusammenfassung von "Push-Benachrichtigung" lautet "meldet Ausfall,
  wieder online, schwache Batterie"; vorher sah "Batterie schwach" allein
  wie ein Zustand aus.
- Ein Prozentwert ausserhalb von 5–50 im Popup bleibt im Feld stehen, mit
  dem erlaubten Bereich darunter, statt zurückgesetzt zu werden.

## [0.8.0] - 2026-10-01

Eigene Batterie-Schwelle pro Integration.

### Hinzugefügt

- Abschnitt "Batterie": "Eigene Schwelle pro Integration" listet nur
  Integrationen mit Batteriegeräten, mit der Zahl der Geräte und der
  schwächsten Batterie; ein leeres Feld nimmt die allgemeine Schwelle
  "Schwach ab". Gilt für die Markierung in der Liste, Push und anhaltende
  Benachrichtigung; massgebend ist die primäre Integration des Geräts. Eine
  Integration mit eigener Schwelle bleibt auch ohne Geräte in der Liste,
  damit sie sich zurücksetzen lässt. Auch im Optionsdialog als Zuordnung
  (z. B. `zha: 25`).

### Behoben

- Texte mit Anführungszeichen in den Einstellungen wurden nach einer
  Eingabe abgeschnitten (z. B. die Kurzzeile unter "Schwach ab"); ein Wert
  mit Anführungszeichen konnte im Panel ein Attribut aufbrechen.

## [0.7.0] - 2026-10-01

Nicht veröffentlicht; enthalten in 0.8.0.

Batterie-Warnung mit wählbarer Schwelle, als Push-Meldung, als anhaltende
Benachrichtigung in Home Assistant, beides oder keines. Beide Meldungen sind
standardmässig aus, damit das Update nicht von selbst zu melden beginnt.

### Hinzugefügt

- Abschnitt "Batterie" in den Einstellungen, auch im Optionsdialog:
  "Schwach ab" (5–50 %, Standard 15 %) statt fest 15 %; gilt für die
  Markierung in der Liste, den Hinweis "Batterie niedrig" und "Nur
  Probleme".
- "Push-Meldung" (Batterie): einmal pro Gerät, wenn es unter die Schwelle
  fällt, erneut erst, wenn die Batterie zwischendurch 5 Punkte darüber war
  (z. B. neue Batterie); ein Gerät, das kurz nicht erreichbar ist, wird
  nicht erneut gemeldet. Mehr als 3 Geräte auf einmal: eine Sammelmeldung.
  Beim Einschalten kommen die gerade betroffenen Geräte einmal. Übersteht
  Neustarts ohne Wiederholung.
- "Anhaltende Benachrichtigung" (Batterie): eine Meldung in Home Assistant
  mit allen Geräten mit schwacher Batterie, jedes mit Link ins Panel; sie
  verschwindet von selbst, wenn alle wieder über der Schwelle sind.
  Weggeklickt bleibt sie weg, bis ein weiteres Gerät dazukommt oder Home
  Assistant neu startet.
- Abschnitt "Push-Benachrichtigung" (wie UniFi Dynamic Clients): "Ziel"
  (notify-Dienst, -Gruppe oder notify-Entität) und "Tipp auf Meldung
  öffnet" (Gerät im Panel oder Geräteseite von Home Assistant). Ein Hinweis
  erscheint, wenn Push ohne Ziel eingeschaltet ist. Ziele, die Bild und
  Klickziel ablehnen, bekommen die Meldung ohne.
- Link auf ein Gerät: `/device-panel?device=<id>` öffnet sein Popup, auch
  wenn das Panel schon offen ist.

## [0.6.0] - 2026-10-01

Nicht veröffentlicht; enthalten in 0.8.0.

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

[1.18.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.18.0
[1.17.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.17.0
[1.16.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.16.0
[1.15.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.15.0
[1.14.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.14.0
[1.13.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.13.0
[1.12.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.12.2
[1.12.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.12.1
[1.12.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.12.0
[1.11.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.11.0
[1.10.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.10.0
[1.8.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.8.0
[1.7.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.7.0
[1.5.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.5.0
[1.4.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.4.0
[1.3.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.3.0
[1.0.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.0.0
[0.34.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.34.0
[0.33.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.33.1
[0.33.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.33.0
[0.29.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.29.0
[0.28.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.28.0
[0.27.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.27.1
[0.27.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.27.0
[0.26.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.26.0
[0.25.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.25.0
[0.23.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.23.0
[0.22.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.22.0
[0.18.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.18.0
[0.16.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.16.0
[0.15.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.15.0
[0.11.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.11.0
[0.9.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.9.0
[0.8.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.8.0
[0.5.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.5.0
[0.4.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.4.0
[0.3.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.3.0b1
[0.2.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.2.0b1
[0.1.0b2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b2
[0.1.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b1
