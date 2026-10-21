# Device Panel

[English](README.md)

**Alle Geräte von Home Assistant auf einen Blick:** wer gerade ausgefallen ist, wie oft und wie lange Geräte ausfallen, wie voll die Batterien sind, wie gut der Empfang ist, und Meldungen, die du an einem Ort steuerst.

<p align="center"><img src="docs/screenshots/de/overview.png" alt="Übersicht mit Verfügbarkeit, ausgefallenen Geräten, Ausfall-Puls und Geräteliste" width="900"></p>

## Die wichtigsten Funktionen

- **Alles auf einen Blick:** Geräte online, wer ausgefallen ist und seit wann, instabile Geräte, ein Ausfall-Puls über 24 Stunden mit Sammelausfällen und eine Liste, die du durchsuchen, filtern und sortieren kannst
- **Verfügbarkeit pro Gerät:** Statistik für 24 Stunden, 7 und 30 Tage mit jedem Ausfall und seiner Dauer, 31 Tage in einem eigenen Protokoll, auch über Neustarts
- **Batterie-Übersicht mit Meldungen:** ein farbiges Batteriesymbol bei jedem Gerät, eine Warnschwelle (Standard 15 %), Push oder anhaltende Benachrichtigung, ein Verlauf bis 12 Monate mit Prognose, wie lange die Batterie hält, und eine Meldung, wenn ein Gerät voll geladen ist
- **Empfangs-Übersicht mit Warnungen:** Empfang in dBm oder LQI bei jedem Gerät, eine Warnschwelle pro Verbindungsart, ein Verlauf mit Median und Spanne, und bei Bluetooth der Empfänger (Adapter oder Proxy), über den ein Gerät verbunden ist oder war
- **Meldungen auf drei Ebenen:** einmal eine Vorgabe setzen, pro Integration ändern, auf einem einzelnen Gerät überschreiben; jede Einstellung zeigt, woher ihr Wert stammt (Grafik unten)
- **Ruhezeit:** Meldungen warten in der Nacht (Zeiten je Wochentag, Arten wählbar) und kommen danach als Zusammenfassung oder einzeln
- **Magic Push:** eigene Meldungen pro Gerät ohne Automation: einen Wert wählen, sagen, wann gemeldet wird, den Text schreiben, fertig
- **Routinen:** eine Entität eines Geräts zu einer Zeit oder durch einen Auslöser (beliebige Entität, mit Bedingungen wie bei Magic Push) schalten, ohne Automation, zurückschalten per Zeit, Dauer oder Auslöser, mit Testknopf und Vorschau der nächsten Ausführungen
- **Reiter Schalter:** jedes Gerät mit etwas Schaltbarem zeigt es als Kacheln; ein Tipp öffnet die Bedienung von Home Assistant (Dimmen, Farbe, Position)
- **Laden und Updates:** Chip "Lädt" mit Ladebalken, Push, wenn ein Gerät voll ist, Live-Aktivität (iPhone) oder Live-Update (Android 16) und eine Update-Erinnerung, die deine eigenen Automationen ersetzt
- **Neue Geräte:** eine Markierung "Neu" und ein Chip für drei Tage, dazu ein optionaler Push mit allen neu erschienenen Geräten
- **App-Launcher und Log:** ein Knopf für nützliche Seiten von Home Assistant und eigene Links, dazu ein Log, das zeigt, was die Meldungen entscheiden und warum eine nicht kam
- **Optionale KI-Einschätzung:** eine Vermutung zur Ursache auf Knopfdruck, nur mit einer KI-Aufgabe von Home Assistant
- **Ganz deine Ansicht:** Spalten, Sortierung, Filter, Favoriten und Startseite werden pro Benutzer gespeichert, auf Handy und Desktop
- **Alles im Panel:** alle Einstellungen, Updates über HACS (auch automatisch), Sichern und Wiederherstellen aller Einstellungen, Deutsch und Englisch

## Übersicht und Geräteliste

Oben steht, wie viele Geräte online sind, wer gerade ausgefallen ist, und der Ausfall-Puls. Darunter ist die Liste in ausgefallene, instabile und online Geräte gegliedert. Jede Zeile zeigt Status, Verbindung, Verfügbarkeit der letzten 24 Stunden, Gerätetyp, Integration, Batterie, Hersteller und Software. Typ und Verbindungsart (Zigbee, Thread, Z-Wave, Matter, Bluetooth, WLAN, Ethernet, Netzwerk, Cloud) werden automatisch erkannt und lassen sich pro Integration oder pro Gerät korrigieren.

### Ausfälle auf einen Blick

Ausgefallene Geräte mit der Zeit, seit der sie weg sind, instabile Geräte (drei oder mehr Ausfälle in 24 Stunden) und der Ausfall-Puls. Ein Tipp auf den Puls listet die Geräte mit Ausfällen, ein Punkt im Puls zeigt, wer damals weg war. Fallen drei oder mehr Geräte gleichzeitig aus, nennt das Panel die vermutete gemeinsame Ursache, zum Beispiel die Integration oder ihren Hub.

<p align="center"><img src="docs/screenshots/de/pulse.png" alt="Fenster mit dem Ausfall-Puls und den Geräten mit Ausfällen in 24 Stunden" width="720"></p>

### Suchen, filtern, sortieren

Die Suche läuft über alle Spalten. Filter-Chips grenzen die Liste ein: Warnungen, ausgefallen, Batterie, lädt, neue Geräte, Geräte mit eigenen Einstellungen, Favoriten, jede Verbindungsart, dazu ein Bereichs- und ein Integrationsfilter, die sich mit den Chips kombinieren lassen. Ausgeblendete Geräte, Integrationen und Gerätetypen werden weder gezeigt noch überwacht.

| Warnungen | Batterie | Bereichsfilter |
|---|---|---|
| <img src="docs/screenshots/de/warnings.png" alt="Liste gefiltert mit dem Chip Warnungen"> | <img src="docs/screenshots/de/batteries.png" alt="Liste gefiltert mit dem Chip Batterie"> | <img src="docs/screenshots/de/area.png" alt="Bereichsfilter mit Etagen und Bereichen"> |

| Lädt | Neue Geräte |
|---|---|
| <img src="docs/screenshots/de/charging.png" alt="Liste gefiltert mit dem Chip Lädt, mit Ladebalken"> | <img src="docs/screenshots/de/new.png" alt="Liste gefiltert mit dem Chip Neu"> |

### Deine eigene Ansicht

Der Knopf "Ansicht" (Handy: die Zeile "Sortierung & Ansicht") öffnet einen Dialog mit zwei Reitern. "Spalten" (Handy: "Sortierung"): Spalten mit dem Auge ein- oder ausblenden, per Ziehen in jede Reihenfolge bringen, die Liste gruppieren oder als eine Liste zeigen; das gilt pro Benutzer, für Desktop und Handy getrennt. "Filter-Chips" (nur Administratoren): Chips ausblenden, umordnen und anheften, das gilt für alle Benutzer. Änderungen zeigt die Liste gleich, übernommen werden sie erst mit "Speichern"; beim Schliessen fragt das Panel "Änderungen verwerfen?". Ein Herz markiert Favoriten (eigener Chip), und in den Einstellungen unter "Panel" › "Allgemein" machst du das Panel zu deiner eigenen Startseite in Home Assistant (Browser und Companion-App).

<p align="center"><img src="docs/screenshots/de/columns.png" alt="Dialog Ansicht mit den Reitern Spalten und Filter-Chips, Auge und Griff" width="560"></p>

## Alles zu einem Gerät

Ein Tipp auf ein Gerät öffnet ein Pop-up mit Verfügbarkeit, Ausfällen, Empfang und Batterie als Kacheln, dazu Verbindung, Integration, Hersteller, Modell, Software und alle Entitäten. Hat das Gerät etwas Schaltbares (Licht, Steckdose, Rollladen, Schloss, Klima und mehr), zeigt der zweite Reiter "Schalter" es als Kacheln mit Symbol und Zustand; ein Tipp öffnet die Bedienung von Home Assistant (Dimmen, Farbe, Position). Das Gerät lässt sich umbenennen (in Home Assistant, die Entitäts-IDs bleiben), als Favorit markieren, ausblenden und auf seiner Seite in Home Assistant öffnen. Das Popup hat Knöpfe, die die Geräteseite und die Seite der Integration in Home Assistant öffnen. Die Reiter "Schalter" und "Entitäten" haben ab acht Einträgen ein Suchfeld (Name, Entitäts-ID oder Zustand). Am Ende des Reiters "Entitäten" kopieren zwei Knöpfe den Link genau zu diesem Gerät (und einen App-Link für die Home-Assistant-App). Eine Warnung nennt ihren Grund im Kopf.

<p align="center"><img src="docs/screenshots/de/popup.png" alt="Geräte-Pop-up mit Statistik, Verbindung und Gerätedetails" width="720"></p>

### Statistik und Verlauf

Jede Kachel öffnet ein Fenster mit 24 Stunden, 7 oder 30 Tagen. Die Verfügbarkeit zeigt jeden Ausfall mit Beginn, Ende und Dauer und die Ausfälle pro Tag.

<p align="center"><img src="docs/screenshots/de/availability.png" alt="Verfügbarkeit über 7 Tage mit jedem Ausfall" width="560"></p>

### Empfang und Bluetooth-Weg

Der Empfangsverlauf zeigt den Median als Linie und die Spanne vom schlechtesten bis zum besten Wert als Fläche, dazu die Warnschwelle des Geräts. Er kommt aus dem Recorder oder, bei ZHA, Bluetooth und nicht aufgezeichneten Sensoren, vom Panel selbst. Bluetooth-Geräte bekommen zusätzlich die Karte "Empfänger": Ein Balken zeigt, über welchen Empfänger (Bluetooth-Adapter oder Proxy) das Gerät gehört wurde, Lücken sind schraffiert, und je Empfänger eine Zeile nennt den aktuellen Wert samt Alter, Anteil und mittleren Empfang im Zeitraum sowie die letzten Wechsel (Empfängernamen ohne Adressen). Wurde das Gerät längere Zeit über einen deutlich schwächeren Empfänger gehört, sagt das ein Hinweis. Den Weg zeichnet das Panel selbst auf, ab dem Update. Die Zeilen zeigen, welche Empfänger das Gerät gerade hören ("gerade -76 dBm · vor 8 s", alle paar Sekunden neu); der Empfänger, dessen Wert zählt, trägt die Marke "✓ zählt". Kennzahlen stehen als Kacheln oben, alle Hinweise (Quelle, Median, Lücken) hinter einem Info-Knopf. Damit einzelne Meldungen nicht entscheiden, ist der gezeigte Empfang bei Bluetooth, ZHA und nicht aufgezeichneten Sensoren, und damit auch "schwach", der Median der letzten 5 Minuten (das Fenster sagt es).

| Empfangsverlauf | Verbunden über (Bluetooth) |
|---|---|
| <img src="docs/screenshots/de/signal.png" alt="Empfangsverlauf mit Median, Spanne und Warnschwelle"> | <img src="docs/screenshots/de/signal-via.png" alt="Abschnitt Verbunden über mit Empfängern, Anteil und Wechseln"> |

### Batterie mit Prognose

Der Batterie-Verlauf reicht bis zu 12 Monate zurück, mit markiertem Batteriewechsel. Die Prognose rechnet vom letzten Batteriewechsel (höchstens ein Jahr) bis zur Warnschwelle des Geräts und sagt, wie sicher sie ist.

<p align="center"><img src="docs/screenshots/de/battery.png" alt="Batterie-Verlauf mit Batteriewechsel, Warnschwelle und Prognose" width="560"></p>

### Einstellungen pro Gerät

Jedes Gerät kann die Vorgaben im Reiter "Einstellungen" seines Pop-ups überschreiben: eine eigene "Ausgefallen nach"-Zeit (oder keine Überwachung), Batterie-Warnung, Empfang-Warnung, Laden und Ausfall- und Online-Meldungen ausgeschaltet. Jede Zeile zeigt, woher der Wert stammt und wie der Standard wäre. Ein Symbol neben dem Namen in der Liste markiert Geräte mit eigenen Einstellungen.

<p align="center"><img src="docs/screenshots/de/device-settings.png" alt="Geräte-Pop-up: Einstellungen für dieses Gerät mit eigener Zeit, eigener Batterie-Warnschwelle und Meldungen aus" width="720"></p>

## Meldungen

Alles, was dich benachrichtigt, folgt einem Prinzip: Du setzt einmal eine Vorgabe, änderst sie für alle Geräte einer Integration und überschreibst sie bei Bedarf auf einem einzelnen Gerät. Die genauere Ebene gewinnt.

### Das Prinzip

<p align="center"><img src="docs/graphics/de/notification-levels.png" alt="Drei Ebenen Allgemein, Integration und Gerät mit einem Beispiel und einer Tabelle, was sich wo einstellen lässt" width="900"></p>

- **Allgemein:** in den Einstellungen unter "Überwachung und Meldungen", die Vorgabe für alle Geräte
- **Integration:** am selben Ort, Reiter "Integrationen": eine Liste aller Integrationen mit dem, was von der Vorgabe abweicht, und eine Detailseite pro Integration mit eigenen Reitern
- **Gerät:** im Pop-up des Geräts, Reiter "Einstellungen": nur dieses Gerät, mit der Herkunft jedes Werts
- **Herkunft:** jede Einstellung sagt, woher sie stammt (Standard, Integration oder Gerät), und ein Chip "Eigene Einstellung" filtert Geräte mit eigenen Werten; in den Einstellungen lassen sie sich einzeln oder alle auf einmal zurücksetzen

### Vom Ausfall zur Meldung

<p align="center"><img src="docs/graphics/de/notification-flow.png" alt="Sechs Schritte vom Ausfall eines Geräts bis zur Meldung, mit der Ebene, die jeden Schritt entscheidet" width="900"></p>

- **Zwei Zeiten, nicht addiert:** "Ausgefallen nach" (Standard 2 Minuten) entscheidet, wann das Panel das Gerät als ausgefallen zeigt, "Erst melden nach" entscheidet, wann die Meldung kommt; beide laufen ab Beginn des Ausfalls, und die zweite kann nicht kürzer sein als die erste; beide lassen sich global, pro Integration und pro Gerät einstellen
- **Eine Meldung pro Integration:** fallen mehrere Geräte einer Integration zusammen aus (Standard ab drei, einstellbar), kommt eine Meldung für diese Integration statt vieler; die Meldung wartet bis zu einer Minute auf weitere Geräte, die Rückkehr wird ebenso zusammengefasst
- **Ruhezeit:** eine globale Ruhezeit mit eigenen Zeiten je Wochentag hält die gewählten Meldungsarten zurück (je Art wählbar, auch Magic Push und Status-App) und sendet sie danach als Zusammenfassung oder einzeln; kritische Magic-Push-Meldungen kommen immer sofort
- **Sichern und wiederherstellen:** alle Einstellungen (Meldungen, Anzeige, pro Gerät, KI, auf Wunsch Routinen und Magic Push) in eine Datei und zurück, mit Vorschau der Änderungen, Hinweis auf Fehlendes (Gerät, Integration, Push-Ziel) und Rückgängig; keine Zugangsdaten oder Tokens in der Datei
- **Wieder online:** "Wieder online" mit der Dauer des Ausfalls ersetzt die Ausfall-Meldung
- **Knöpfe in der Meldung:** das Gerät im Panel öffnen oder das Gerät in der Companion-App 24 Stunden stumm schalten
- **Anhaltende Benachrichtigung:** auf Wunsch zusätzlich eine Meldung in Home Assistant, solange Geräte ausgefallen sind, pro Integration

### Wohin die Meldung geht

<p align="center"><img src="docs/graphics/de/notification-targets.png" alt="Ein Push-Ziel für alles, ein eigenes Ziel pro Reiter, Magic Push und Routinen wählen ihren Empfänger selbst" width="900"></p>

- **Ein Push-Ziel:** ein Notify-Dienst, eine Gruppe oder eine Notify-Entität für alle Meldungen
- **Eigenes Ziel pro Reiter:** Ausfall, Batterie, Laden, Neue Geräte, Updates, Panel-Updates und Routinen können je an einen anderen Empfänger senden
- **Aussehen:** jede Meldung zeigt das Symbol ihrer Integration und ein Emoji, das du pro Art ändern kannst; jeder Titel beginnt mit einem passenden Emoji

### Die Arten von Meldungen

Jede Art hat in den Einstellungen einen eigenen Reiter. Ausfall, Batterie, Laden, Neue Geräte und Empfang sind auch Reiter jeder Integration, und Ausfall, Batterie, Laden und Empfang Reiter jedes Geräts (ein Gerät zeigt nur die Reiter, für die es etwas gibt: ohne Batterie entfallen "Batterie" und "Laden", ohne Empfangswert "Empfang"), damit die drei Ebenen für jede davon gelten.

| Ausfall | Batterie | Laden |
|---|---|---|
| <img src="docs/screenshots/de/settings-outage.png" alt="Reiter Ausfall: Ausgefallen nach, Erst melden nach, Erkennung und Meldung"> | <img src="docs/screenshots/de/settings-battery.png" alt="Reiter Batterie: Warnschwelle und Push"> | <img src="docs/screenshots/de/settings-charge.png" alt="Reiter Laden: Anstieg, Voll ab, Meldung und Live-Aktivität"> |

| Neu | Updates | Empfang |
|---|---|---|
| <img src="docs/screenshots/de/settings-new.png" alt="Reiter Neu: Sammelfenster und Inhalt"> | <img src="docs/screenshots/de/settings-updates.png" alt="Reiter Updates: Update-Erinnerung"> | <img src="docs/screenshots/de/settings-sig.png" alt="Reiter Empfang: Warnschwelle pro Verbindungsart"> |

- **Ausfall und wieder online:** Push, anhaltende Benachrichtigung und Sammelmeldung, mit Beginn, Dauer, Bereich und Integration
- **Batterie:** einmal pro Gerät beim Unterschreiten der Schwelle (Standard 15 %, von 1 bis 50 %), sofort oder als tägliche Sammelmeldung, mit einer anhaltenden Benachrichtigung aller betroffenen Geräte
- **Laden:** Push, wenn ein Gerät voll geladen ist ("Voll ab", Standard 100 %) oder die Ladung vorzeitig endet, standardmässig aus und nur für wiederaufladbare Geräte; Geräte, die gerade laden, bekommen den Chip "Lädt" mit grüner Markierung und Ladebalken
- **Live-Aktivität:** auf Wunsch der Ladefortschritt auf dem Sperrbildschirm (iPhone, Live-Aktivität) oder als Live-Update (Android 16), mit leisen Aktualisierungen und, sobald sie verlässlich ist, einer Schätzung, wann das Ziel erreicht ist ("fertig gegen 14:35"), standardmässig aus
- **Neue Geräte:** ein Sammelfenster, dann eine Meldung mit allen neu erschienenen Geräten; das Gerät trägt drei Tage die Markierung "Neu"
- **Update-Erinnerung:** täglich, wöchentlich oder sofort für Updates von Home Assistant, Add-ons, HACS und Geräte-Firmware, einstellbar pro App, pro Integration und pro Firmware, auf Wunsch wiederholt, solange ein Update offen bleibt; ersetzt zwei selbstgebaute Automationen
- **Empfang:** eine Warnschwelle pro Verbindungsart, pro Integration und pro Gerät (Standard schwach unter -80 dBm oder LQI 61), auch abschaltbar
- **Panel-Updates:** ein optionaler Push einmal pro Version, wenn eine neue Version des Panels gefunden oder installiert wird

<p align="center"><img src="docs/screenshots/de/settings-integrations.png" alt="Einstellungen: Liste der Integrationen mit dem, was von den Vorgaben abweicht" width="720"></p>

<p align="center"><img src="docs/screenshots/de/integ-detail.png" alt="Detail einer Integration mit Reitern für Ausfall, Batterie, Laden, Neu, Empfang und Geräte" width="720"></p>

## Magic Push: eigene Meldungen

Eigene Meldungen pro Gerät ohne Automation, im Reiter "Magic Push" des Geräts.

<p align="center"><img src="docs/screenshots/de/magic-tab.png" alt="Reiter Magic Push eines Geräts mit zwei Meldungen" width="560"></p>

- **Jeder Wert:** einen Wert des Geräts wählen oder eine beliebige Entität von Home Assistant, die dem Gerät zugeordnet bleibt
- **Wann:** über, unter, ist oder ändert sich; mehrere Bedingungen mit Und/Oder und Gruppen verknüpft; wie lange sie gelten muss; wie lange der Wert normal bleiben muss, bevor zurückgesetzt wird, und bei welchem Wert
- **Empfänger:** jedes Notify-Ziel, auf Wunsch als kritische Mitteilung mit einer Lautstärke von 1 bis 10, und wie oft wiederholt wird
- **Text:** Titel und Inhalt mit Variablen, die zum Wert passen (Name, Wert, Einheit, Schwelle, Bereich und mehr), mit Vorschau und einem Rückblick auf die letzten 24 Stunden vor dem Speichern
- **Assistent:** öffnet in einem eigenen Fenster (Vollbild auf dem Handy), fünf Schritte: Bedingungen, wie lange, Versand, Text, Name
- **Übersicht:** die App "Magic Push" (im Launcher) öffnet ein Fenster mit allen Meldungen aller Geräte, eine Karte pro Gerät, mit Suche und Filter; unten legt "Neue Meldung" eine neue an (zuerst das Gerät wählen, dann wie im Popup des Geräts)
- **Protokoll:** "Protokoll" auf einer Karte (und "Protokoll des Geräts" im Geräte-Popup und in der Übersicht) öffnet ein Fenster für Magic Push und Routinen (zwei Reiter, es öffnet auf dem, von dem du kommst) und listet jede Meldung: Datum, Art, Titel und Text, wie gesendet, Wert, Empfänger und was daraus wurde (gesendet, zurückgehalten, fehlgeschlagen). Zeitraum 7 Tage bis 12 Monate oder eigene Daten, Kennzahlen, ein Balkendiagramm (je Tag, bei langen Zeiträumen je Woche; ein Tipp auf einen Balken wählt den Tag), Auswahl, Suche und "Als Text kopieren". Aufbewahrt wird, solange Platz ist: höchstens 5000 Einträge je Meldung und 30 MB für alle zusammen (einstellbar)

<p align="center"><img src="docs/screenshots/de/magic-wizard.png" alt="Magic-Push-Assistent, Schritt 1: Was soll überwacht werden" width="560"></p>

<p align="center"><img src="docs/screenshots/de/magic-all.png" alt="Fenster Magic Push: alle Meldungen aller Geräte, eine Karte pro Gerät" width="720"></p>

## Routinen

Schaltet eine Entität eines Geräts einmalig oder nach Zeitplan, ohne Automation.

| Routinen eines Geräts | Assistent: wann |
|---|---|
| <img src="docs/screenshots/de/routine-tab.png" alt="Reiter Routinen eines Geräts mit einer Routine"> | <img src="docs/screenshots/de/routine-wizard.png" alt="Routinen-Assistent, Schritt 2: Wann soll geschaltet werden"> |

- **Was:** die Entität und die Aktion wählen (ein, aus, umschalten; **setzen** bei Zahlen und Auswahlen wie der Helligkeit eines Displays, das nur "wie vorher" zurückgeht), auf Wunsch nach einer Weile zurückschalten. Über die Übersicht "Alle Routinen" angelegt, heisst die erste Seite "Gerät, Gruppe oder Szene?": neben den Geräten stehen **Szenen** (Aktion "Aktivieren", nichts zum Zurückschalten) und **Gruppen** (zum Beispiel eine Lichtergruppe, verhält sich wie eine einzelne Lampe), beide ohne Gerät; die erste Seite listet jedes Gerät, jede Gruppe und jede Szene als eigene Zeile, mit einem Filter oben (Alle, Geräte, Gruppen, Szenen) und einer kleinen Pille an Gruppen und Szenen, und die Suche findet sie über ihren Namen; eine gewählte Szene braucht keine Seite "Was" mehr, eine gewählte Gruppe fragt nur noch nach der Aktion
- **Optionen:** Kann die Entität beim Einschalten etwas einstellen, folgt eine eigene Seite: Licht Helligkeit, Farbtemperatur und Farbe; Rollladen Position; Klima Soll-Temperatur und Modus; Medien Lautstärke; Ventilator Stufe. Eine Vorschau zeigt das Ergebnis (die Lampe leuchtet in der gewählten Farbe), geschaltet wird damit nichts, und "Jetzt ausführen" probiert die echte Stärke; ohne Angabe bleibt alles "wie zuletzt"
- **Zurückschalten:** nach einer Weile zurück auf "aus" (das Gegenstück) oder "wie vorher": Die Routine merkt sich die Szene vor dem Schalten (zum Beispiel Helligkeit und Farbe) und stellt sie wieder her, so kann eine Lampe kurz heller werden und danach wieder sein wie vorher. Eigene Seite "Zurückschalten": nie, nach einer Dauer, zu einer Zeit oder durch einen Auslöser (zum Beispiel um 20:00 ein, aus wenn der Regensensor trocken ist), mit "spätestens nach" als Sicherung
- **Wann:** in X Minuten, einmal an einem Datum und zu einer Uhrzeit oder wiederholt täglich, wöchentlich an gewählten Wochentagen oder monatlich, mit einer Prüfung der nächsten Ausführungen vor dem Speichern; oder **durch einen Auslöser** statt einer Uhrzeit: beliebige Entität, "über" / "unter" / "ist" / "ändert sich", mehrere Bedingungen mit "und" / "oder" wie bei Magic Push, "mindestens so lange erfüllt", ein optionales Zeitfenster (auch über Mitternacht), eine Pause nach dem Schalten und "nur einmal". Jede Zeit hat Schnellwahlen und ein Feld für eine eigene Zeit (die Pause nicht unter 1 Minute). Es schaltet nur, wenn die Bedingung neu eintritt
- **Test:** ein Knopf "Jetzt ausführen" probiert den gewählten Schalter aus
- **Erinnerung:** auf Wunsch ein Push im Moment des Schaltens, mit Vorschau und eigenem Empfänger
- **Läuft in Home Assistant:** mit dessen Zeitzone, eine Routine löst also auch bei geschlossenem Panel und nach einem Neustart aus (innerhalb eines Nachhol-Fensters, das du festlegst), und "Alle Routinen pausieren" ist ein Schalter; ein Schaltbefehl ohne Antwort endet nach 45 Sekunden
- **Übersicht:** der Blitz in der Kopfzeile (auch im Launcher) öffnet alle Routinen in einer Karte pro Gerät (Szenen und Gruppen ohne Gerät in eigenen Karten), mit Suche und Filter, bearbeiten, ausführen, ein- oder ausschalten, löschen und Favoriten; ganz oben der Schalter "Alle Routinen pausieren" (derselbe wie in den Einstellungen, gilt sofort)
- **Protokoll und Trace:** "Protokoll" auf einer Karte (und "Protokoll des Geräts") listet jeden Lauf: Datum, Auslöser (Zeit, Auslöser, von Hand, Zurückschalten), Aktion und Ergebnis (ausgeführt, zurückgeschaltet, verpasst, pausiert, fehlgeschlagen). Gleicher Zeitraum, gleiches Diagramm, gleiche Auswahl und Suche wie bei Magic Push. Eine Zeile öffnet den **Trace**: jeder Schritt der Reihe nach (Auslöser und Verspätung, Zeitfenster, gemerkter Zustand, Aufruf mit Dauer und Ergebnis, geplantes Zurückschalten, Meldung), als Text kopierbar für die Fehlersuche. Aufbewahrt wird, solange Platz ist: höchstens 5000 Einträge je Routine und 30 MB für alle zusammen (einstellbar)

<p align="center"><img src="docs/screenshots/de/routines-all.png" alt="Fenster mit allen Routinen, eine Karte pro Gerät" width="720"></p>

## App-Launcher und Log

Ein Knopf in der Kopfzeile öffnet einen Launcher mit nützlichen Seiten, in den Symbolen und Farben der Einstellungen von Home Assistant. Administratoren finden dort auch einen Ein/Aus-Knopf, der Home Assistant neu startet, immer nach einer Rückfrage.

| App-Launcher | Log |
|---|---|
| <img src="docs/screenshots/de/launcher.png" alt="App-Launcher mit Favoriten, Device Panel und Seiten von Home Assistant"> | <img src="docs/screenshots/de/log.png" alt="Protokoll mit Einträgen der Meldungen und einem Filter"> |

- **Seiten:** Routinen, Magic Push und das Protokoll dieser Integration, Seiten von Home Assistant (Automationen, Szenen, Skripte, Helfer, Geräte, Entitäten, Integrationen, Werkzeuge und mehr; "Apps" und "Dashboards" gibt es auch, sie sind aber ausgeblendet, bis du sie im Bearbeiten-Modus einschaltest; die Verwaltungsseiten nur für Administratoren)
- **Eigene Links und Aktionen:** eine Seite in Home Assistant, ein externer Link, der in einem neuen Browser-Tab öffnet (auf Wunsch mit seinem Favicon als Symbol), oder eine **Aktion**, die einen Dienst von Home Assistant oder einen Befehl der Oberfläche aufruft (Daten als JSON, auf Wunsch mit Rückfrage); beim Ausführen zeigt das Symbol drehende Pfeile, danach einen grünen Haken (oder ein rotes Kreuz), und das Ergebnis steht im Log
- **Ansicht und Einstellungen:** zwei Apps in der Gruppe "Device Panel" öffnen die Ansichtseinstellungen (Sortierung, Spalten, Filter-Chips) und die zentralen Einstellungen, so findet man alles an einem Ort; beide lassen sich ausblenden, weil auch die Knöpfe in der Kopfzeile dorthin führen
- **Favoriten:** ein Herz markiert bis zu fünf Apps, die eigene Knöpfe in der Kopfzeile bekommen (am Handy die ersten zwei); standardmässig sind es die Routinen und die Einstellungen. Das Zahnrad steht nicht mehr fest dort, sondern nur noch, wenn die App "Einstellungen" angeheftet ist; sie lässt sich nicht ausblenden. Steht ein Neustart aus, zeigt der Launcher-Knopf den roten Punkt, solange die Einstellungen nicht angeheftet sind
- **Bearbeiten-Modus:** per Ziehen sortieren, Apps mit dem Auge ausblenden (Protokoll und Status bleiben sichtbar, mit Schloss), Raster oder Liste; alles wird pro Benutzer gespeichert
- **Status:** eine App für Administratoren, die zeigt, ob die Teile der Integration laufen (Routinen, Ausfall-Überwachung, Batterie, Laden, Empfangsverlauf, Magic Push, Neue Geräte, Updates: "läuft", "verspätet" oder "steht"). Steht ein Teil, kommt ein Push (an das Standard-Ziel oder an ein Ziel, das du in der App wählst) und eine Entwarnung, wenn er wieder läuft; ein verspäteter oder stehender Teil hat einen Knopf, mit dem sich genau dieser Teil von Hand neu starten lässt. Ein roter Punkt am Launcher-Knopf, oder am Status-Knopf, wenn du ihn angeheftet hast, zeigt eine Störung; ein oranger Punkt zeigt, dass der Debug-Modus läuft. Grenze: Steht Home Assistant selbst, kann das niemand melden
- **Log:** zeigt, was die Meldungen entscheiden und warum eine nicht kam, mit Filter und Suche (die letzten 500 Einträge bleiben über Neustarts erhalten) und einem optionalen Debug-Modus (für 48 Stunden eingeschaltet, auch über Neustarts)

## Einstellungen im Panel

Das Zahnrad (die angeheftete App "Einstellungen", oder der Launcher) öffnet alle Einstellungen auf Deutsch oder Englisch, in Abschnitten. Die Versionsleiste oben zeigt die installierte und die neueste Version und aktualisiert über HACS.

| Geräte im Panel | Routinen | Panel |
|---|---|---|
| <img src="docs/screenshots/de/settings-section-devices.png" alt="Abschnitt Geräte im Panel"> | <img src="docs/screenshots/de/settings-section-routines.png" alt="Abschnitt Routine"> | <img src="docs/screenshots/de/settings-section-updates.png" alt="Abschnitt Panel mit täglicher Prüfung und automatischer Installation"> |

- **Geräte im Panel:** Integrationen, Gerätetypen und einzelne Geräte ausblenden (ein Gerät erst nach Rückfrage), Typ und Verbindungsart pro Integration festlegen, Geräte mit eigenen Einstellungen sehen und zurücksetzen
- **Überwachung und Meldungen:** die Reiter Allgemein (Ziel der Meldungen, Ruhezeit), Ausfall, Batterie, Laden, Neu, Updates, Empfang und Integrationen; jeder Reiter einer Meldung beginnt mit einer kleinen Übersicht (Zeitstrahl und Pillen zum schnellen Umschalten)
- **Abweichungen:** jeder Reiter von "Überwachung und Meldungen" (bei "Neue Geräte" ohne Geräte) endet mit den Integrationen und Geräten, die vom Standard abweichen, mit Zurücksetzen (auch unter "Geräte im Panel" › "Geräte-Einstellungen")
- **Ansicht:** liegt nicht mehr in den Einstellungen, sondern im Dialog "Ansicht" über der Liste (Spalten und Sortierung pro Benutzer, Filter-Chips für alle); beide Reiter haben ein eigenes "Speichern"
- **Routinen und KI-Einschätzung:** Pause, Nachhol-Fenster, Empfänger; KI-Aufgabe und Prompt
- **Status-App:** ob die Teile der Integration laufen, mit Push-Meldung und Neustart-Knopf (auch eine Meldung, wenn CPU, Arbeitsspeicher oder Festplatte eine frei wählbare Grenze erreichen, Standard 99 %, je für eine frei wählbare Mindestdauer, Standard 3 Minuten); darunter kleine Grafiken zu CPU, Arbeitsspeicher und Festplatte von Home Assistant (24 Stunden; die Festplatte auch 30 Tage, 6 Monate, 1 Jahr), aus den Sensoren von "System Monitor" oder eigenen (aus einer durchsuchbaren Liste von Sensor-Entitäten gewählt; ausgeschaltete Sensoren lassen sich mit einem Knopf einschalten). Drei Reiter: "Dienste" (die Teile), "System" (die Grafiken) und "Einstellungen" (Meldungen, Grenzen, Quellen; sie gelten erst nach "Speichern").
- **Panel:** zwei Unterreiter. "Allgemein": das Panel als deine Startseite in Home Assistant (gilt nur für dich) das Kapitel **"Protokolle"**: wie viel die Protokolle behalten, als Grösse in MB und als Zahl der Einträge, einmal für Meldungen und Routinen (Standard 30 MB, 5000 Einträge je Meldung oder Routine) und einmal für das Panel-Protokoll (Standard 10 MB, 4000 Einträge), mit der aktuellen Belegung daneben. Ist eine Grenze erreicht, fallen die ältesten Einträge weg; eine tiefere Grenze kürzt sofort und fragt vorher. Ganz am Schluss das Kapitel "Sichern und wiederherstellen" (siehe unten). "Updates" (die Versionszeile mit Suchen und Installieren steht ganz oben in den Einstellungen): Prüfung bei jedem Öffnen der Einstellungen (höchstens einmal pro Minute), tägliche Prüfung zu einer festen Zeit, optionaler Push, Vorabversionen und automatische Installation über HACS (den Neustart von Home Assistant machst du selbst)
- **Speichern:** Änderungen im Pop-up und in den Einstellungen gelten erst mit "Speichern"; beim Schliessen mit ungespeicherten Änderungen fragt das Panel "Änderungen verwerfen?"

<p align="center"><img src="docs/screenshots/de/settings-general.png" alt="Einstellungen, Reiter Allgemein: Ziel der Meldungen und Ruhezeit mit Zeiten je Wochentag" width="720"></p>

### Sichern und wiederherstellen

Unter "Panel" › "Allgemein" (unter "Startseite", nur Administratoren) lassen sich alle Einstellungen in eine Datei sichern und später wiederherstellen, zum Beispiel nach einer Neuinstallation oder um sie in ein anderes Home Assistant zu übernehmen.

| Sichern und wiederherstellen | Vorschau vor dem Wiederherstellen |
|---|---|
| <img src="docs/screenshots/de/settings-backup.png" alt="Kapitel Sichern und wiederherstellen unter Startseite"> | <img src="docs/screenshots/de/backup-restore.png" alt="Vorschau: was sich ändert, was bleibt, was übersprungen wird, mit Hinweisen zu fehlenden Push-Zielen und Geräten"> |

- **Was hineinkommt:** du wählst die Teile: Meldungen und Überwachung, Panel und Anzeige, Einstellungen pro Gerät, KI-Einschätzung und, standardmässig aus, Routinen und Magic Push. Keine Zugangsdaten und keine Tokens. "Kopieren" und "Text einfügen" sind der Weg für die App auf dem Handy, wo das Speichern einer Datei nicht immer geht.
- **Zuerst die Vorschau:** vor "Übernehmen" wird nichts geschrieben. Die Vorschau zählt, was sich ändert, gleich bleibt oder nicht übernommen wird, je Teil, mit Beispielen.
- **Was fehlt, wird genannt:** unbekannte Einstellungen, Werte ausserhalb des Bereichs, Geräte, die es hier nicht gibt, und Routinen oder Meldungen mit fehlender Entität werden mit Grund übersprungen; ein Push-Ziel oder eine Integration, die es nicht mehr gibt, werden mit Hinweis übernommen.
- **Details:** die drei Kacheln der Vorschau (werden geändert, unverändert, nicht übernommen) und die Bereichszeilen öffnen ein Fenster mit der vollen Liste: jede Änderung alt → neu (Geräte mit Namen), die unveränderten Werte und jeder übersprungene Eintrag mit Grund; unbekannte Geräte mit Name, ID und Betroffenem. "Bericht kopieren" legt die Liste in die Zwischenablage. Routinen und Magic-Push-Meldungen zeigen dort, was sie tun (Entität und Aktion bzw. Bedingung und Push-Ziel), nicht nur den Namen aus der Datei.
- **Rückgängig:** der Zustand vorher wird festgehalten (auf Wunsch auch als Datei gesichert); "Rückgängig" holt ihn genau zurück.

## KI-Einschätzung (optional)

Standardmässig aus. Auf Knopfdruck fragt das Panel eine KI-Aufgabe von Home Assistant nach einer Vermutung zur Ursache, auf Grundlage von Fakten zum Gerät, seinem Bereich, Hub und ähnlichen Geräten. Die Funktion lässt sich erst einschalten, wenn in Home Assistant unter "KI-Vorschläge" eine KI-Aufgabe gewählt ist (der Link dorthin steht in den Einstellungen). Es werden keine Schlüssel, Zugangsdaten oder IDs gesendet.

| Antwort im Pop-up | Profi-Modus: Prompt |
|---|---|
| <img src="docs/screenshots/de/ai.png" alt="Geräte-Pop-up mit der KI-Einschätzung"> | <img src="docs/screenshots/de/settings-ai.png" alt="Einstellungen mit dem Prompt im Profi-Modus"> |

- **Profi-Modus:** der Prompt ist anpassbar, mit Gruppen von Fakten wie `{facts_area}` und `{facts_hub}`, und eine Vorschau zeigt den genauen Text
- **Wenn es scheitert:** das Pop-up zeigt die Meldung der KI-Aufgabe, und das Protokoll hält den Grund fest, so lassen sich Kontingent, Schlüssel oder Modell als Ursache finden; eine leere Antwort bekommt einen zweiten Versuch, und eine vorübergehende Überlastung des Anbieters (zum Beispiel "503, high demand") wird zweimal wiederholt, bevor ein Fehler erscheint
- **Entfernen:** ein Knopf neben "Neu erstellen" nimmt die Einschätzung weg (Popup und Speicher), eine neue ist einen Tipp entfernt
- **Rückfragen:** unter der Einschätzung lässt sich die KI weiter fragen, mit vorgeschlagenen Fragen als Pillen (die KI schlägt sie selbst vor, passend zum Gerät und zu ihrer letzten Antwort) und einem Textfeld für eigene; die Antworten erscheinen als Gespräch, höchstens drei je Einschätzung
- **Gedächtnis:** die letzte Einschätzung jedes Geräts bleibt gespeichert und erscheint beim Öffnen wieder; die nächste bekommt sie mit, so sagt die KI, was sich geändert hat. Lange Fakten werden auf eine feste Grösse gekürzt.
- **Fakten:** neben dem Gerät selbst sieht die KI die letzten Ausfälle mit Tageszeit, den Empfang der letzten 24 Stunden und 7 Tage und bei Bluetooth die Empfänger, die das Gerät gehört haben (ohne Adressen); sie weiss auch, ob ein Gerät geladen wird (Staubsauger-Roboter, Handy) oder mit Batterien läuft, und spricht dann über Ladegewohnheiten statt über Batterie-Laufzeit
- **Ohne KI:** das Panel nennt die vermutete gemeinsame Ursache von Sammelausfällen und rechnet die Batterie-Prognose selbst

## Auf dem Handy

Dasselbe Panel als Karten, mit denselben Pop-ups, Fenstern und Assistenten im Vollbild.

| Liste | Pop-up | Batterie |
|---|---|---|
| <img src="docs/screenshots/de/overview-mobile.png" alt="Handy: Karten" width="260"> | <img src="docs/screenshots/de/popup-mobile.png" alt="Handy: Pop-up" width="260"> | <img src="docs/screenshots/de/battery-mobile.png" alt="Handy: Batterie-Verlauf" width="260"> |

| Laden | Launcher | Routinen-Assistent | Magic Push |
|---|---|---|---|
| <img src="docs/screenshots/de/charging-mobile.png" alt="Handy: ladende Geräte" width="200"> | <img src="docs/screenshots/de/launcher-mobile.png" alt="Handy: App-Launcher" width="200"> | <img src="docs/screenshots/de/routine-wizard-mobile.png" alt="Handy: Routinen-Assistent" width="200"> | <img src="docs/screenshots/de/magic-wizard-mobile.png" alt="Handy: Magic-Push-Assistent" width="200"> |

## Gut zu wissen

- Ein Gerät gilt nach 2 Minuten ohne Lebenszeichen als ausgefallen (einstellbar, pro Integration und pro Gerät).
- Ein Empfang gilt als schwach unter -80 dBm oder LQI 61. Die Warnschwelle lässt sich pro Verbindungsart, allgemein, pro Integration und pro Gerät einstellen oder abschalten.
- Ein Ausfall dauert, bis Home Assistant das Gerät wieder online sieht, auch über Neustarts. "Mindestens" (≥) heisst: Der Beginn ist nicht bekannt.
- Das Verfügbarkeitsprotokoll umfasst 31 Tage in einer eigenen Datei, nicht im Recorder. Zeit, in der Home Assistant nicht lief, zählt als "keine Daten".
- Ausgeblendete Geräte, Integrationen und Gerätetypen werden weder gezeigt noch überwacht. Jeder Filter-Chip lässt sich in den Einstellungen ausblenden und umordnen.
- Batterie-Warnung von 1 bis 50 % (Standard 15 %), pro Integration und pro Gerät. Ein unglaubwürdig schneller Abfall (zum Beispiel 76 % auf 2 % in wenigen Minuten, ein Messfehler mancher Sensoren) wird gehalten, bis eine spätere Meldung ihn bestätigt; schnell leere Akkus wie ein Staubsauger gelten sofort. Es ist nichts einzustellen.
- Gerätetyp und Verbindungsart werden automatisch erkannt. Du kannst beides pro Integration korrigieren; ein von Hand am Gerät gesetzter Wert geht vor. Der Typ gilt nur im Panel, nicht in Home Assistant.
- Der Empfangsverlauf kommt aus dem Recorder oder, bei ZHA, Bluetooth und nicht aufgezeichneten Sensoren, vom Panel selbst.
- Bluetooth-Geräte zeigen den Live-Empfang von Bluetooth (bester Empfänger), nicht den Wert ihres eigenen Empfangs-Sensors. Den Weg "Verbunden über" zeichnet das Panel ab dem Update auf; frühere Wege lassen sich nicht nachträglich herstellen.
- Jede Einstellung zeigt, woher sie stammt: Standard, Integration oder Gerät.
- Nichts Sicherheitsrelevantes (Tokens, Schlüssel) wird je im Panel angezeigt.
- Alle Printscreens in dieser Datei zeigen erfundene Daten.

## Installation

### HACS (benutzerdefiniertes Repository)

1. HACS → ⋮ → Benutzerdefinierte Repositories → `https://github.com/Diegofuego871/ha-device-panel`, Typ "Integration".
2. "Device Panel" installieren und Home Assistant neu starten.
3. Einstellungen → Geräte & Dienste → Integration hinzufügen → "Device Panel".

Updates: Die Einstellungen (Zahnrad) zeigen die installierte und die neueste Version und aktualisieren über HACS. Vorabversionen (`b` oder `rc` in der Nummer) sind optional: "Vorabversionen anzeigen", danach im HACS-Gerät "Pre-release" selbst einschalten (der Hinweis im Panel führt dorthin); das Panel ändert keine Entitäten von HACS. Optional "Updates automatisch installieren" (braucht die tägliche Prüfung): Eine gefundene Version wird über HACS installiert, den Neustart von Home Assistant machst du selbst; ein roter Punkt am Zahnrad zeigt, dass der Neustart aussteht. Solange es arbeitet, zeigt die Versionsleiste in den Einstellungen nach dem Titel eine kleine "Auto"-Pille. Die tägliche Prüfung kann zu einer festen Uhrzeit laufen, und ein optionaler Push (einmal pro Version, Empfänger wählbar) meldet eine gefundene oder installierte Version.

### Manuell

`custom_components/device_panel` nach `config/custom_components/` kopieren und Home Assistant neu starten.

### Entfernen

Einstellungen → Geräte & Dienste → "Device Panel" → ⋮ → Löschen. Das löscht auch die eigenen Dateien der Integration (`.storage/device_panel.*`). Die Register von Home Assistant werden nie verändert. Danach in HACS entfernen und neu starten.

## Entwicklung und Tests

- Python mit echtem Home Assistant: `pip install pytest-homeassistant-custom-component` (Python 3.13), dann `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`. Die Printscreens in dieser Datei stammen aus `node readme-shots.mjs` (erfundene Daten), die Grafiken aus `node docs/graphics/render.mjs`.

## Änderungsprotokoll

Siehe [CHANGELOG.de.md](CHANGELOG.de.md).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
