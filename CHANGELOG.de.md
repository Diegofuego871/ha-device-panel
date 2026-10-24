# Änderungsprotokoll

[English](CHANGELOG.md)

Alle nennenswerten Änderungen an dieser Integration stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/).

## [2.135.1] - 2026-10-24

Der Knopf "Los geht's" des Einrichtungsassistenten ist gleich gross wie die anderen Knöpfe, die Logos haben keinen blauen Hintergrund, und der Schritt "Meldungen" ist einfacher.

### Geändert

- **Einrichtungsassistent, Schritt "Meldungen":** bei den ausgefallenen Geräten wird nur noch "Melden nach" angeboten; "Ausgefallen nach" steht nicht mehr da, damit der Schritt einfach bleibt (es bleibt auf dem jetzigen Wert und lässt sich in den Einstellungen ändern). "Melden nach" darf weiterhin nicht kürzer sein; der Hinweis nennt den jetzigen Wert.

### Behoben

- **Einrichtungsassistent, Logos der Integrationen:** die Logos (Philips Hue, Shelly und andere) standen auf einer blauen Kachel wie die Buchstaben-Abzeichen. Sie stehen jetzt auf dem neutralen Grund, wie in den Einstellungen.
- **Einrichtungsassistent, Willkommensseite:** der Knopf "Los geht's" wurde vom Layout flach gedrückt und wirkte viel kleiner als "Jetzt nicht" und "Nicht mehr zeigen". Alle drei Knöpfe sind jetzt 44 px hoch; "Los geht's" bleibt der gefüllte, einladendste Knopf über die ganze Breite.

## [2.135.0] - 2026-10-24

Ein Einrichtungsassistent führt nach der Installation durch die Grundeinstellungen.

### Hinzugefügt

- **Einrichtungsassistent:** nach einer frischen Installation öffnet sich einmal ein Fenster in der Mitte (auf dem Handy als Vollbild). Schritte: Willkommen, Integrationen, Gerätetypen, Geräte (nach Integration gruppiert, aufklappbar, ein Schalter je Gruppe oder Gerät), Meldungen, Ruhezeit (nur mit Push-Ziel) und eine Zusammenfassung. Gespeichert wird erst mit "Fertigstellen" (ein `set_options`); wer mit Änderungen schliesst, wird vorher gefragt.
- **Schritt "Meldungen":** Push-Ziel, ein Schalter je Art (ausgefallene Geräte mit Rückkehr, niedrige Batterie, neue Geräte, voll geladen) und je Zeile die jetzigen Werte, mit den Standardwerten vorausgefüllt und anpassbar ("Ausgefallen nach", "Melden nach", "Batterie schwach unter", "Neue Geräte sammeln", "Voll ab"), mit Prüfung der Bereiche und dass "Melden nach" nicht kürzer ist als "Ausgefallen nach". Ein Knopf sendet eine Testmeldung.
- **"Jetzt nicht" und "Nicht mehr zeigen":** "Jetzt nicht" schliesst das Fenster; "Nicht mehr zeigen" beendet den Assistenten für immer.
- **Launcher:** solange der Assistent nie beendet wurde, steht zuoberst in der Gruppe "Device Panel" die Kachel "Einrichtung" und am Launcher-Knopf ein oranger Punkt. Nicht einstellbar; weg nach "Fertigstellen" oder "Nicht mehr zeigen".
- **Einstellungen › Panel › Allgemein:** neues Kapitel "Einrichtungsassistent" mit dem Knopf "Assistent starten" und dem Datum des letzten Abschlusses. Die Felder zeigen den jetzigen Stand, nichts wird zurückgesetzt. Wird der Assistent nicht beendet, kommen Kachel und Punkt zurück.
- Neue Optionen `wizard_state` (`new`, `later`, `open`, `done`, `off`) und `wizard_done_at`: sie gelten für die ganze Installation, nur Administratoren ändern sie, sie stehen nicht in der Sicherungsdatei. Eine frische Installation startet mit `new`; bestehende Installationen gelten als `done` (kein Fenster, keine Kachel).
- WebSocket `wizard_data` (alle infrage kommenden Geräte mit Integration, Typ und Bereich, ohne Ausschlüsse) und `wizard_test` (Testmeldung an ein `notify.*`-Ziel); `list_devices` liefert `wizard`.

## [2.134.1] - 2026-10-24

Der Filter-Chip steht auch da, wenn das Gerät nur eine Routine oder Meldung hat.

### Behoben

- **Protokoll einer Karte an einem Gerät mit nur einer Routine oder Meldung:** die Chips aus 2.134.0 blieben aus, weil sie erst ab zwei Einträgen erschienen; der Filter war damit wieder unsichtbar. Wird das Protokoll von einer Karte geöffnet, stehen die Chips ("Alle Routinen" und die gewählte Routine, bzw. "Alle Meldungen" und die gewählte Meldung) jetzt auch bei einem einzigen Eintrag da, und "Alle ..." hebt den Filter auf.

## [2.134.0] - 2026-10-24

Das Protokoll einer einzelnen Routine oder Meldung zeigt seinen Filter jetzt als Chip. Enthält die Änderungen von 2.133.0.

### Geändert

- **Protokoll einer Routine oder Meldung, am Gerät:** ein Tipp auf "Protokoll" an einer Karte öffnet das Protokoll des **Geräts** mit dieser Routine oder Meldung schon als Chip gewählt. Die Chips "Alle Routinen" und je eine pro Routine (bzw. "Alle Meldungen" und je eine pro Meldung) sind immer da; ein Tipp auf "Alle ..." hebt den Filter auf, ein Tipp auf eine andere wechselt. Die Unterzeile nennt das Gerät und die Zahl. Bisher stand der Filter nur als Name in der Unterzeile und liess sich nicht ändern, ohne das Fenster zu schliessen. Ein Gerät mit nur einer Routine oder Meldung hat keine Chips.
- **Protokoll über alle Geräte** (Reiter "Magic Push" und "Routinen"): ein Chip "Meldung" bzw. "Routine" öffnet darunter eine Liste mit "Alle Meldungen/Routinen" und jedem Eintrag mit seinem Gerät; die gewählte steht auf dem Chip. Eine Auswahl auf einmal (keine Mehrfachwahl).
- WebSocket `protocol_get`: neu `item_ids` (eine Auswahl innerhalb von `device_id` oder über alle Geräte); `items` nennt immer alle Einträge dieses Bereichs und trägt jetzt `device_id`. `item_id` funktioniert weiter.

## [2.133.0] - 2026-10-24

Das Umbenennen eines Geräts öffnet am Handy ein eigenes Fenster.

### Geändert

- **Gerät umbenennen am Handy:** der Stift neben dem Namen öffnet jetzt ein kleines Fenster oben mit einem grossen Feld (die Tastatur verdeckt es nicht), dem Originalnamen mit "Zurücksetzen" und den Knöpfen "Abbrechen" und "Name speichern". Enter speichert, Escape oder das Kreuz bricht ab. Bisher sass das Feld im Kopf des Popups zwischen den runden Knöpfen und war zu klein. Am Desktop ändert sich nichts: das Feld bleibt im Kopf.

Nicht veröffentlicht; enthalten in 2.134.0.

## [2.132.0] - 2026-10-24

Die Einstellungen sagen jetzt, warum Geräte einer gezeigten Integration fehlen. Enthält die Änderungen von 2.130.0 und 2.131.0.

### Hinzugefügt

- **Grund für fehlende Geräte** (Einstellungen › Geräte im Panel › Integrationen): die Zeile unter einer Integration nennt, wie viele ihrer Geräte nicht sichtbar sind und warum, zum Beispiel "3 Geräte · 3 nicht sichtbar, Typ ausgeblendet: Medien" oder "1 einzeln ausgeblendet". Bisher stand dort nur "3 Geräte", und die Liste zeigte keines davon, weil der Schalter "Anzeigen" der Integration unabhängig von den ausgeblendeten Typen und den einzeln ausgeblendeten Geräten ist. Eine Integration, die selbst ausgeblendet ist, nennt keinen Grund (ihr Schalter sagt es schon).
- Der WebSocket-Befehl `get_options` liefert `hidden_by_type` und `hidden_by_device` für jede Integration des Katalogs.

## [2.131.0] - 2026-10-24

Der Text-Link "Protokoll des Geräts" entfällt in den Reitern "Routinen" und "Magic Push" eines Geräts. Enthält die Änderungen von 2.130.0.

### Entfernt

- **Text-Link "Protokoll des Geräts ›"** über den Karten in den Reitern "Routinen" und "Magic Push" des Geräte-Popups und im Fuss jedes Geräts in den Übersichten von Magic Push und Routinen (dort bleibt "Gerät öffnen ›"). Der runde Protokoll-Knopf im Kopf tut dasselbe und ist immer da. Die Knöpfe "Protokoll" an den einzelnen Karten bleiben.

### Geändert

- **Symbol "Zurücksetzen" gespiegelt** (seit 2.130.0): die Pfeile laufen im Uhrzeigersinn, eine laufende App dreht sich auch so.

Nicht veröffentlicht; enthalten in 2.132.0.

## [2.130.0] - 2026-10-24

Der Pfeil "neu laden" läuft überall im Uhrzeigersinn und dreht sich auch so.

### Geändert

- **Symbol "Zurücksetzen" gespiegelt** (runder Pfeil mit Spitze oben): die Pfeile laufen jetzt **im Uhrzeigersinn**, wie das Aktualisieren-Symbol der Update-Prüfung. Es steht bei der App "Backup" im Launcher und in deren Knopf im Kopf, bei den Knöpfen "Standard wiederherstellen" und "Zurücksetzen" (Ansicht, Reihenfolge der Chips, Einstellungen je Integration, KI-Prompt, Rückgängig bei der Sicherung) und bei "Neustart".
- **App, die gerade läuft** (Launcher): die Pfeile drehen sich im Uhrzeigersinn, in ihrer Pfeilrichtung. Vorher zeigte das Symbol gegen den Uhrzeigersinn und drehte sich andersherum.
- Die Printscreens der README sind nicht neu aufgenommen; sie zeigen bis zum nächsten Mal die alte Richtung.

Nicht veröffentlicht; enthalten in 2.131.0.

## [2.129.0] - 2026-10-24

Die Status-App bietet dieselben sechs Zeiträume wie die Geräteverläufe, der Reiter "System" des Protokolls beginnt mit "Alle", und Zeilen von Magic Push zeigen einen Pfeil.

### Geändert

- **Status-App, Reiter "System":** jede Kurve (CPU, Arbeitsspeicher, Festplatte) hat jetzt die sechs Zeiträume des Batterie-Verlaufs: **24 Stunden, 7 Tage, 30 Tage, 3 Monate, 6 Monate, 12 Monate** (vorher vier: 24 Stunden, 30 Tage, 6 Monate, 1 Jahr). Auf dem Handy brauchen die sechs Knöpfe zwei Zeilen. Bis 7 Tage kommt die Kurve aus dem Verlauf des Rekorders, ab 30 Tagen aus der Langzeitstatistik; der Hinweis auf fehlende Statistik erscheint erst ab 30 Tagen.
- WebSocket `status_system`: `range` und `ranges` nehmen jetzt `24h`, `7d`, `30d`, `90d`, `180d` oder `365d` (dieselben Schlüssel wie der Batterie-Verlauf); die alten Schlüssel `6m` und `1y` entfallen. Das Panel schickt die neuen, nichts ist zu migrieren.
- **Protokoll, Reiter "System":** der Zeitraum beginnt auf **"Alle"** (vorher 30 Tage), damit die Einträge der ganzen Aufbewahrung sofort da sind. Die anderen Reiter behalten 30 Tage; der Rückweg aus "System" stellt den bisherigen Zeitraum wieder her.
- **Protokoll, Reiter "Magic Push":** eine Zeile mit Meldungstext zeigt neben dem Wert einen Pfeil (offen nach oben), wie die Zeilen im Reiter "Alles". Zeilen ohne Text haben keinen Pfeil. Der Pfeil in der Tabelle der Routinen war schon da.
- **README:** die Status-App beschreibt die sechs Zeiträume.

## [2.128.0] - 2026-10-24

Jede Kurve der Status-App hat ihre eigenen Knöpfe für den Zeitraum. Enthält die Änderungen von 2.126.0 und 2.127.0.

### Geändert

- **Status-App, Reiter "System":** CPU und Arbeitsspeicher haben jetzt dieselben Knöpfe für den Zeitraum wie die Festplatte (24 Stunden, 30 Tage, 6 Monate, 1 Jahr). Jede Kurve behält ihren eigenen Zeitraum, die anderen bleiben unverändert. Bisher liess sich nur die Festplatte umschalten, CPU und Arbeitsspeicher standen fest auf 24 Stunden. Ältere Zeiträume stammen aus der Langzeitstatistik von Home Assistant; ohne sie zeigt die Kurve nur, was der Rekorder noch hat, mit dem bekannten Hinweis.
- WebSocket `status_system` nimmt ein optionales `ranges` (`cpu`, `ram`, `disk`, je `24h`, `30d`, `6m` oder `1y`) und liefert es je Kurve zurück; `range` setzt weiter die Festplatte und gilt auch ohne `ranges`.

## [2.127.0] - 2026-10-24

Einträge des Protokolls, die man antippen kann, zeigen das jetzt mit einem Pfeil. Enthält die Änderungen von 2.126.0.

### Geändert

- **Pfeil am Ende antippbarer Zeilen** im Protokoll (Reiter "Alles" und "System"): ein Pfeil nach unten (offen nach oben) bei einer Magic-Push-Meldung und bei einer gesendeten Meldung, ein Pfeil nach rechts bei einem Lauf einer Routine (öffnet den Ablauf) und bei einem Eintrag, der sein Gerät öffnet. Einfache Einträge haben keinen Pfeil. Bisher musste man wissen, dass diese Zeilen antippbar sind.
- **Diagramm im Reiter "Alles"** (seit 2.126.0): Balken je Tag (bei Zeiträumen über 120 Tage je Woche), Störungen rot; es folgt den Chips und der Suche, ein Tipp auf einen Balken setzt den Zeitraum auf diesen Tag.

Nicht veröffentlicht; enthalten in 2.128.0.

## [2.126.0] - 2026-10-24

Das Balkendiagramm von Magic Push und Routinen steht jetzt auch in der Liste "Alles" des Protokolls.

### Hinzugefügt

- **Diagramm im Reiter "Alles":** Balken je Tag (bei Zeiträumen über 120 Tage je Woche), Störungen (Ausfall, Warnung, Fehler, fehlgeschlagene Meldung oder Lauf) rot. Es folgt den Chips und der Suche wie die Liste darunter, und ein Tipp auf einen Balken setzt den Zeitraum auf diesen Tag. Über alle Geräte zählt es alle.

### Geändert

- WebSocket `protocol_get` mit Art `all` liefert `step` und `buckets` wie die anderen Arten.
- **README:** der Abschnitt "Protokoll eines Geräts" nennt das Diagramm; die Printscreens des Protokolls sind neu aufgenommen.

Nicht veröffentlicht; enthalten in 2.127.0.

## [2.125.0] - 2026-10-24

Ein Protokoll statt zwei Fenstern: das Fenster "Log" ist jetzt der Reiter "System" des Protokolls, und die App "Log" heisst "Protokoll".

### Hinzugefügt

- **Reiter "System" im Protokoll** (nur über alle Geräte, nicht an einem Gerät): die Einträge des Panel-Logs ohne Gerät (Start, Fehler, KI, Push-Ziele, Status-App, Launcher) und **alle Debug-Einträge**, mit Chips für **Stufe** (Fehler, Warnung, Info, Debug) und **Art**, Suche, Zeitraum (7 Tage bis 12 Monate), Kopieren als Text, Leeren (mit Rückfrage) und ein Eintrag öffnet sein Gerät. Das Fenster fragt alle 4 Sekunden nach, nicht mitten in einer Wischbewegung.
- **Debug-Modus im Reiter "System":** der Schalter steht dort, mit der Zeit, zu der er sich ausschaltet (48 Stunden, auch über Neustarts, wie bisher). Er gilt für das ganze Panel.
- **Neuer Einstieg:** Einstellungen › Panel › Speicher hat im Kapitel "Protokolle und Log" einen Knopf "Protokoll öffnen (System)".
- Neue Art `system` für `device_panel/protocol_get` (Administratoren), mit `filter` für die Stufe und `cat` für die Art.

### Geändert

- **Die App "Log" im Launcher heisst "Protokoll"** (EN "History"), der Untertitel "mit Debug-Modus" bleibt. Sie öffnet das Protokoll über alle Geräte auf dem Reiter "Alles". Die interne Kennung bleibt, angeheftete Apps und ihre Reihenfolge bleiben erhalten. Das Symbol ist dasselbe wie im Geräte-Popup und in den Übersichten.
- Das Protokoll-Fenster hat vier Reiter: Alles, Magic Push, Routinen, System. An einem Gerät und von einer einzelnen Meldung oder Routine aus gibt es keinen Reiter "System".
- **README:** "App-Launcher und Protokoll" beschreibt das eine Fenster und seine Einstiege.

### Entfernt

- Das eigene Fenster "Log" (`dialog.log-dlg`, `get_log` im Panel). Debug-Modus, Einträge und Grenzen sind unverändert; es muss nichts migriert werden.

## [2.124.0] - 2026-10-24

Gesendete Meldungen haben einen eigenen Speicher mit eigener Aufbewahrung, und die Zusammenfassung nach der Ruhezeit erscheint bei jedem Gerät, das sie nennt. Enthält die Änderungen von 2.123.0.

### Hinzugefügt

- **Eigener Speicher für gesendete Meldungen** (Einstellungen › Panel › Speicher, neues Kapitel "Gesendete Meldungen"): **Aufbewahrung in Tagen** (7 bis 365, Standard 1 Jahr) und **Grenze in MB** (1 bis 200, Standard 10 MB), mit der belegten Grösse. Bisher lagen die Meldungen im Panel-Log, das für alles zusammen nur eine begrenzte Zahl Einträge behält; häufige Einträge verdrängten die Meldungen. Jetzt bleiben sie so lange, wie du einstellst. Eine tiefere Grenze kürzt beim Speichern sofort, nach der gewohnten Rückfrage. Der Gesamtbalken zählt sie zu den Protokollen.
- Die Meldungen aus Version 2.123.0, die noch im Panel-Log stehen, werden einmalig in den neuen Speicher übernommen.

### Geändert

- **Zusammenfassung nach der Ruhezeit:** die Meldung, die zurückgehaltene Meldungen zustellt, kommt jetzt bei jedem Gerät der zurückgehaltenen Meldungen ins Protokoll (vorher gehörte sie keinem Gerät). Im Modus "einzeln" behalten die zugestellten Meldungen ihr Gerät und ihre Art, so sind sie wieder mit ihrem Eintrag im Protokoll verbunden.
- Das Panel-Log behält nur eine Zeile je Meldung ("gesendet: Titel"); Titel, Text und Ziel stehen im Protokoll des Geräts.
- Der WebSocket-Befehl `storage_usage` liefert `push` (Byte, Einträge, Geräte, Tage); neue Optionen `push_keep_days` und `push_max_mb`. Die Datei `device_panel.push_log` wird mit der Integration entfernt.
- **README:** das Kapitel "Gesendete Meldungen" ist unter "Speicher" beschrieben.

## [2.123.0] - 2026-10-24

Im Protokoll eines Geräts zeigt ein Tipp auf einen Eintrag die gesendete Meldung: an wen sie ging und was sie sagte.

### Hinzugefügt

- **Gesendete Meldungen im Protokoll eines Geräts:** jede Push-Meldung an ein Notify-Ziel wird jetzt mit **Titel, Text, Ziel und Ergebnis** protokolliert (gesendet, in der Ruhezeit zurückgehalten, fehlgeschlagen, Ziel fehlt). Das Protokoll zeigt sie als eigene Zeile (Chip "Push") und unter dem Eintrag, der sie ausgelöst hat: ein Tipp auf "wieder online nach 9 Min.: Meldung wird gesendet" (auch Ausfall, Batterie, Laden, neues Gerät) öffnet die Meldung, wie sie hinausging. Sammelmeldungen erscheinen bei jedem Gerät, das sie nennen. Die Suche findet auch den Text der Meldung.
- Meldungen, die in der Ruhezeit zurückgehalten werden, kommen beim Zurückhalten mit den Geräten ins Protokoll.

### Geändert

- Einträge des Panel-Logs tragen jetzt den Code ihres Textes und bei Meldungen den Inhalt (`push`) und die Geräte (`device_ids`); beides bleibt über einen Neustart von Home Assistant erhalten. Der Text einer Meldung wird bei 600 Zeichen gekürzt.
- **README:** der Abschnitt "Protokoll eines Geräts" nennt den Tipp auf einen Eintrag.

### Behoben

- **Integration liess sich nicht einrichten (seit 2.122.0):** bei einem Gerät, dessen Kennung mehr als zwei Teile hat (zum Beispiel ein Shelly-Gerät), brach die Einrichtung mit "too many values to unpack (expected 2, got 3)" ab, das Panel startete nicht. Das Dienst-Gerät der Integration wird jetzt nur am ersten Teil der Kennung erkannt; die Kennungen im Detail eines Geräts werden genauso gelesen.

Nicht veröffentlicht; enthalten in 2.124.0.

## [2.122.0] - 2026-10-24

Eigene Entitäten: Zähler und Zustände des Panels für Automationen und Dashboards, mit einem Fehlerzähler.

### Hinzugefügt

- **Dienst-Gerät "Device Panel" mit Entitäten** (alle 30 Sekunden aus der Liste des Panels berechnet, nur bei Änderung in den Verlauf geschrieben):
  - **11 Sensoren:** Geräte aktiv, ausgeblendet, ausgefallen, mit Warnung, mit Batterie, mit schwacher Batterie, am Laden, mit schwachem Empfang, neu und mit Update, dazu **"Fehler (24 Stunden)"**. Jeder Zähler trägt die Namen der Geräte im Attribut `names` (höchstens 20, `more` zählt den Rest).
  - **2 binäre Sensoren:** **Ausfall** (mindestens ein Gerät ist ausgefallen) und **Problem** (ein Fehler im Log oder ein Teil der Integration läuft nicht).
  - **Fehlerzähler:** zählt die Einträge der Stufe "error" im Panel-Log der letzten 24 Stunden, mit dem letzten Fehler als Attributen. Der neue Knopf **"Fehler quittieren"** setzt ihn auf null; das Log bleibt unberührt.
- Warnungen zählen wie im Panel (instabil, Batterie niedrig, schwacher Empfang oder keine Daten); deaktivierte und nicht überwachte Geräte zählen nicht.
- README (DE/EN): neuer Abschnitt "Entitäten für Automationen".

### Geändert

- Das eigene Dienst-Gerät erscheint nicht in der Geräteliste des Panels (die Sensoren würden sich sonst selbst zählen).
- **Protokoll-Fenster (Magic Push, Routinen):** das Diagramm folgt jetzt den Filter-Chips und der Suche, wie die Liste darunter (vorher zeigte es immer alle Einträge des Zeitraums; die Kennzahlen oben bleiben beim ganzen Zeitraum).
- Die Datei des Fehlerzählers (`device_panel.summary`) wird beim Entfernen der Integration mit den übrigen Dateien gelöscht.
- `test_audit_fixes`: zwei Routinen, die in derselben Sekunde fällig sind, erwarten keine feste Reihenfolge mehr (sie teilen sich einen Zeitpunkt).

## [2.121.0] - 2026-10-24

Das Protokoll-Symbol steht im Kopf des Geräte-Popups, jedes Protokoll-Fenster hat ein Kreuz, und die Verläufe nutzen am Handy den ganzen Bildschirm.

### Geändert

- **Verläufe eines Geräts am Handy** (Batterie, Verfügbarkeit, Empfang): das Fenster steht jetzt ganz oben am Bildschirmrand statt als Blatt mit Abstand darüber, so bleibt mehr Platz für die Grafik. Am Desktop ändert sich nichts.
- **Protokoll-Fenster:** oben rechts in jeder Ansicht des Protokolls (Gerät, Magic Push, Routinen) ein "X"; "Zurück" unten links bleibt, beide schliessen das Fenster.
- **Geräte-Popup:** der Knopf "Protokoll" steht nicht mehr in der Schnellzeile, sondern oben rechts links vom Herz, mit demselben Symbol wie in den Übersichten von Magic Push und Routinen. Die Schnellzeile behält nur die zwei Links, die aus dem Panel führen ("Gerät in HA öffnen", "Integration in HA öffnen"); alles oben öffnet ein Fenster im Panel. Am Handy ist der Name im Kopf eine Stufe kleiner (21 statt 24 px), damit neben den drei runden Knöpfen mehr Platz bleibt.
- **README:** die Printscreens des Geräte-Popups sind neu aufgenommen (Symbol im Kopf).

Nicht veröffentlicht; enthalten in 2.122.0.

## [2.120.0] - 2026-10-24

Der Empfang im Protokoll eines Geräts: ein Eintrag, wenn ein Gerät schwach wird und wenn es wieder in Ordnung ist.

### Hinzugefügt

- **Empfang als Ereignis:** das Panel schreibt einen Eintrag ins Log (Kategorie "Empfang", mit Gerät), wenn ein Gerät **schwach** wird und wenn sein Empfang **wieder in Ordnung** ist, mit Wert und Schwelle ("Empfang schwach: -86 dBm", Schwelle -80 dBm). Die Prüfung läuft alle 5 Minuten mit derselben Rechnung wie die Liste (Median der letzten 5 Minuten, Schwelle des Geräts, der Integration oder der Verbindungsart); ein Wechsel zählt erst nach **zwei Prüfungen hintereinander**, damit ein Wert an der Schwelle nicht jede Minute einen Eintrag schreibt. Der erste Stand eines Geräts ist kein Ereignis; ein ausgefallenes Gerät behält seinen Stand.
- Die Einträge erscheinen im Protokoll des Geräts (Reiter "Alles", Chip "Empfang") und im Log des Panels (Filter "Empfang").

### Geändert

- Der Hinweis unter der Liste im Protokoll-Fenster sagt nicht mehr, dass der Empfang fehlt.
- **README:** alle Printscreens sind mit der aktuellen Version neu aufgenommen (Zeiträume bis 12 Monate, neuer Knopf "Protokoll", neuer Reiter "Speicher"). Neue Bilder: das Protokoll eines Geräts (Liste nach Tagen und die Auswertung von Magic Push) der Reiter "Speicher" in den Einstellungen und der Dialog "Ansicht" am Handy; ein neuer Abschnitt "Protokoll eines Geräts" beschreibt sie.

## [2.119.0] - 2026-10-24

Verfügbarkeit und Empfang bis 12 Monate zurück, mit denselben Zeiträumen wie bei der Batterie.

### Added

- **Zeiträume 3, 6 und 12 Monate** in den Fenstern **Verfügbarkeit** und **Empfang** (wie bei der Batterie: 24 Std., 7 Tage, 30 Tage, 3, 6 und 12 Monate). Die Verfügbarkeit zeigt den Zeitstrahl, jeden Unterbruch und die Säulen je Tag über den ganzen Zeitraum; der Empfang Tageswerte (Median, schlechtester und bester Wert je Tag).
- **Empfang als Tageswerte:** Stundenwerte bleiben 31 Tage; was älter ist, wird je Tag zu einem Wert (Median, schlechtester, bester) zusammengefasst und bis zur eingestellten Aufbewahrung behalten. So bleibt der Speicher klein: ein Jahr eines Geräts braucht rund 15 KB.

### Changed

- **Aufbewahrung bis 365 Tage, Standard 1 Jahr** (Einstellungen › Panel › Speicher, Kapitel "Geräteverläufe"): vorher 7 bis 31 Tage, Standard 31. Die Grenze in MB ist neu 20 MB für die Verfügbarkeit und 50 MB für den Empfang (vorher 10 und 20). Eigene Werte bleiben unverändert.
- Der Hinweis zur Aufbewahrung sagt nicht mehr "höchstens 30 Tage".
- Die Verläufe wachsen ab diesem Update über die bisherigen 31 Tage hinaus. Was schon gelöscht wurde, lässt sich nicht herstellen (der Recorder von Home Assistant behält standardmässig nur zehn Tage).

### Behoben

- **Handy, Kopf der Einstellungen und der Übersichten:** der runde Aktionsknopf (und der neue Knopf "Protokoll") sass einige Pixel höher als der Schliessen-Knopf. Beide stehen jetzt auf einer Linie.

## [2.118.0] - 2026-10-24

Das Protokoll-Fenster ist zum Protokoll eines Geräts geworden: alles zu einem Gerät in einer Liste, auch aus den Übersichten von Magic Push und Routinen.

### Hinzugefügt

- **Reiter "Alles" im Protokoll-Fenster:** eine Liste nach Tagen (Heute, Gestern, Datum) mit **allem zu einem Gerät**: Ausfälle und Rückkehr mit der Dauer (aus der Verfügbarkeit), Batterie, Laden, Updates, neue Geräte, Push, Meldungen von Magic Push und Läufe von Routinen. Chips filtern nach Art und zeigen nur Arten, zu denen es im Zeitraum Einträge gibt, mit ihrer Zahl. Suche über alle Texte. Ein Tipp auf eine Magic-Push-Zeile zeigt die Meldung, wie sie gesendet wurde, ein Tipp auf eine Routine-Zeile ihren Trace. Debug-Einträge, das System und die Apps stehen nicht in der Liste (sie gehören keinem Gerät). Der Empfang erscheint noch nicht (es gibt dafür kein Ereignis).
- **Knopf "Protokoll" in der Schnellzeile des Geräte-Popups** (Administratoren), nach "Gerät in HA öffnen" und "Integration öffnen".
- **Knopf "Protokoll" im Kopf der Übersichten von Magic Push und Routinen** (links vom Schliessen-Knopf, mit Strich getrennt): er öffnet das Protokoll aller Meldungen oder aller Routinen aller Geräte; der Reiter "Alles" listet dann alle Geräte, mit dem Namen des Geräts in jeder Zeile.
- Neue Art `all` im WebSocket-Befehl `device_panel/protocol_get`, auch ohne Gerät (alle Geräte); `magic` und `routine` ohne Meldung und Gerät liefern jetzt die aller Geräte.

### Geändert

- Das Protokoll-Fenster hat jetzt immer drei Reiter: **Alles**, **Magic Push** und **Routinen**. Sie behalten ihre Auswertung (Kennzahlen, Diagramm, Tabelle, Trace). Vorher gab es zwei Reiter, und nur, wenn das Fenster für ein Gerät geöffnet wurde.

## [2.117.0] - 2026-10-24

Neuer Reiter "Speicher" in den Einstellungen des Panels: alles, was die Integration selbst speichert, mit Grösse und Grenzen.

### Hinzugefügt

- **Reiter "Speicher" (Einstellungen › Panel, dritter Reiter nach "Allgemein" und "Updates"):** oben die Summe als Zahl und ein Balken in fünf Teilen (Verläufe, Protokolle, Panel-Log, Zustände, Übrige) mit Legende. Darunter das Kapitel "Geräteverläufe", das Kapitel "Protokolle und Log" und das Kapitel "Weitere Daten". Jede Zeile mit einer Grenze zeigt, wie viel belegt ist (Grösse, Geräte, Tage), und einen Balken für den Anteil an der Grenze; er wird ab 90 % gelb. In der Zusammenfassung des Abschnitts: "Speicher: 7,2 MB belegt".
- **Geräteverläufe mit Grenzen:** Verfügbarkeit und Empfang aller Geräte hatten eine feste Aufbewahrung von 31 Tagen und keine Grenze. Jetzt hat jeder eine **Aufbewahrung in Tagen** (7 bis 31; das Panel zeigt höchstens 30 Tage, mehr wäre nicht zu sehen) und eine **Grenze in MB** (Standard 31 Tage, 10 MB für die Verfügbarkeit und 20 MB für den Empfang). Ist die Grenze in MB erreicht, fallen die ältesten Werte über alle Geräte weg (der Zustand zu Beginn des Zeitraums bleibt). Eine tiefere Grenze kürzt beim Speichern sofort, nach einer Rückfrage; sie nennt, was gekürzt wird. Der Batterie-Verlauf hat keinen eigenen Speicher (Rekorder von Home Assistant); ein Hinweis sagt das.
- **Weitere Daten:** Zustände der Meldungen, des Ladens, der neuen Geräte, der Updates und der Ruhezeit, die KI-Einschätzungen sowie Routinen, Magic Push, Geräte und Panel in drei Zeilen mit ihrer Grösse (ohne Grenze, sie wachsen kaum).
- Neuer WebSocket-Befehl `device_panel/storage_usage` (Administratoren); er ersetzt `device_panel/protocol_usage` (der nur die Protokolle der Meldungen und das Panel-Log kannte).

### Geändert

- Das Kapitel "Protokolle und Log" (Grenzen für die Protokolle der Meldungen und das Panel-Log) ist von "Allgemein" in den neuen Reiter "Speicher" gewandert. Werte und Standards sind unverändert. "Allgemein" hat jetzt "Startseite" und "Sichern und wiederherstellen".

## [2.116.1] - 2026-10-24

Die README zeigt ihre Bilder und Links in HACS.

### Behoben

- **README in HACS:** Wurde Device Panel in HACS innerhalb von Home Assistant geöffnet, erschien **kein Bild** (Screenshots und Grafiken), und der Link zur anderen Sprache führte ins Leere. HACS stellt die README auf der Adresse von Home Assistant dar und löst relative Pfade wie `docs/screenshots/de/overview.png` nicht auf. Bilder und Links in `README.md` und `README.de.md` verwenden jetzt die volle GitHub-Adresse. Auf GitHub selbst ändert sich nichts.

## [2.116.0] - 2026-10-21

Mehr Symbole, ein Aktionsknopf im Kopf der Einstellungen; die Wahl "Symbol / Favicon" erscheint nur noch beim externen Link.

### Hinzugefügt

- **Aktion im Kopf der Einstellungen:** Eine Aktion hat ein neues Kontrollkästchen **"In den Einstellungen anzeigen"**. Mit ihm steht die Aktion als runder Knopf im **Kopf der Einstellungen, links vom Schliessen-Knopf und mit einem dünnen Strich von ihm getrennt**, sodass man sie direkt dort aufrufen kann (zum Beispiel einen Dienst, der beim Ändern der Einstellungen nützlich ist). Der Knopf zeigt denselben Fortschritt wie im Launcher (drehende Pfeile, danach grüner Haken oder rotes Kreuz; der Grund eines Fehlers als Hinweistext), fragt vorher, wenn man das eingeschaltet hat, und das Ergebnis steht im Log. **Nur eine Aktion** kann den Haken haben (am Handy fehlt der Platz für mehr): hat ihn schon eine andere, sagt das Kontrollkästchen es ("schon belegt durch …"), das Setzen wird mit einer Fehlermeldung abgelehnt, die diese Aktion nennt, ebenso das Speichern, und in gespeicherten Daten behält nur die erste den Haken. Die Einstellungen der Ansicht (Spalten, Sortierung) bekommen diese Knöpfe nicht.

- **Mehr Symbole:** Das Formular einer eigenen App bietet **40 statt 16 Symbole**. Neu: Update, Download, Upload, Abspielen, Ein/Aus, Schloss, Wolke, WLAN, Glocke, Zahnrad, Verlauf, Neu laden, Glühbirne, Thermometer, Ventilator, Schild, Tür, Garage, Wasser, Feuer, Schlüssel, Rakete, Lautstärke und Saugroboter. Bestehende Apps behalten ihr Symbol.

### Behoben

- **Aktion, Fortschrittsanzeige:** Die drehenden Pfeile drehten **gegen** die Richtung ihrer Pfeilspitzen. Sie drehen jetzt gegen den Uhrzeigersinn, wie die Pfeile zeigen.

### Geändert

- **README, Installation:** Device Panel steht jetzt im **Standard-Katalog von HACS**. Der Abschnitt Installation beginnt mit der Suche nach "Device Panel" in HACS und dem blauen Knopf "Open your Home Assistant instance and open a repository inside HACS"; das benutzerdefinierte Repository bleibt als Ersatzweg.
- **Formular einer eigenen App:** Die Wahl zwischen "Symbol" und "Favicon" gibt es **nur bei der Art "Externer Link"**. Bei "Seite" (vorher war der Reiter Favicon nur ausgegraut) und bei "Aktion" ist sie ganz ausgeblendet; die Symbole zur Auswahl bleiben. Ein Favicon ergibt nur bei einer Adresse ausserhalb von Home Assistant Sinn.

### Intern

- `svc.settings` (`checkAction`), `settingsActionsHtml`/`paintSettingsActions` in `apps.js`, `data-ap-actions` im Kopf der Einstellungen, `.dlg-act`/`.dlg-sep`; `APP_ICONS` in `apps.js` (40 Einträge), 12 neue Pfade in der Symboltabelle von `device-panel.js` (Material Design Icons), `data-f-srctabs` im Formular, `.sub-tabs[hidden]`; Suiten `launcherfav` und `launcheract` angepasst.

## [2.115.0] - 2026-10-21

Aktionen zeigen ihren Fortschritt und schreiben das Ergebnis ins Log.

### Hinzugefügt

- **Fortschrittsanzeige:** Solange eine Aktion läuft, wird ihr Symbol zu einem **Kreis mit drehenden Pfeilen** (im Launcher als Kachel oder Zeile und in der Kopfzeile, wenn sie ein Favorit ist). Ist der Dienst oder Befehl fertig, zeigt sich drei Sekunden lang ein **grüner Haken mit grünem Rand**, bei einem Fehler ein **rotes Kreuz mit rotem Rand**. Danach ist das gewohnte Symbol wieder da. Während sie läuft, bewirkt ein zweiter Tipp nichts. Ist im System "Bewegung reduzieren" eingestellt, drehen sich die Pfeile langsam.
- **Eintrag im Log des Panels:** Jeder Lauf steht im Log (Kategorie "Apps"): "Aktion ausgeführt: `cover.open_cover`" als Information oder "Aktion fehlgeschlagen: `cover.open_cover`: Grund" als Warnung, mit dem Namen der App. Der Filter "Apps" im Log zeigt nur diese.

### Intern

- WebSocket `device_panel/log_launcher_action` (Administratoren; Name, Ziel als Dienst oder Befehl, Ergebnis, Fehler bis 300 Zeichen), Texte `launcher_run_ok` und `launcher_run_failed` in `activity.py`; `AppLauncher._setRun`/`runState`, CSS `.run-running|ok|err`. Tests: `test_activity.py`, Suite `launcheract` (Zustände, Log-Einträge), Simulator `__serviceDelay`.

## [2.114.0] - 2026-10-21

Aktionen können auch einen Befehl der Oberfläche (WebSocket) senden, zum Beispiel damit HACS nach einer neuen Version sucht.

### Hinzugefügt

- **Aktion, "Dienst oder Befehl":** Das Feld einer Aktion nimmt neben einem Dienst von Home Assistant (`bereich.dienst`) auch einen **Befehl der Oberfläche** an, wie ihn das Panel selbst benutzt (`bereich/befehl`, zum Beispiel `hacs/repository/refresh`). Die Daten sind dann die Felder der Nachricht (ohne `type` und `id`, die gehören dem Befehl), zum Beispiel `{"repository": "123456789"}`. Es läuft mit Ihren Rechten, auf Wunsch mit Rückfrage. Typischer Einsatz: ein Knopf, der HACS sofort nach einer neuen Version von Device Panel suchen lässt; die Zahl steht in der Adresse der HACS-Seite von Device Panel. Der Code der Integration weiss dafür nichts von HACS; wer es will, legt sich die Aktion selbst an.

### Geändert

- Hinweis und Fehlertexte des Formulars nennen beide Formen (Dienst und Befehl); die Rückfrage vor dem Ausführen sagt "Dienst" oder "Befehl".

### Intern

- `checkAction` kennt beide Formen (`isCommand`: ein Schrägstrich), der Befehl läuft über `callWS`; Tests: Suite `launcheract` (Befehl, `type`/`id` in den Daten abgelehnt).

## [2.113.0] - 2026-10-21

App-Launcher: eine neue Art eigener App, "Aktion", die einen Dienst von Home Assistant aufruft.

### Hinzugefügt

- **Eigene App der Art "Aktion":** Neben "Seite" (in Home Assistant) und "Externer Link" hat das Formular einer eigenen App jetzt die Reiter **Seite | Externer Link | Aktion**. Eine Aktion ruft beim Antippen einen **Dienst von Home Assistant** auf, wie in einem Skript: Feld **Dienst** (`bereich.dienst`, zum Beispiel `homeassistant.update_entity`), Feld **Daten** (JSON-Objekt, zum Beispiel `{"entity_id": "update.device_panel_update"}`) und der Schalter **"Vor dem Ausführen nachfragen"** (standardmässig aus; mit ihm kommt zuerst eine Rückfrage). Der Dienst läuft mit **Ihren** Rechten. Das Ergebnis steht unten im Launcher ("… ausgeführt" oder "… fehlgeschlagen: Grund"), aus der Kopfzeile (Launcher zu) als Toast der Seite. Aktionen tragen eine kleine Blitz-Marke, zeigen im Bearbeiten-Modus ihren Dienst als Untertitel, lassen sich wie andere Apps als Favorit markieren und stehen dann in der Kopfzeile.
- Typischer Einsatz: ein Knopf, der HACS nach einer neuen Version von Device Panel suchen lässt (`homeassistant.update_entity` auf der Update-Entität von HACS), nachdem das Panel selbst keine HACS-Interna mehr nutzt.

### Geändert

- Das Kontrollkästchen "Externer Link" des Formulars ist die Reiterleiste oben (gleiches Verhalten, ein Bedienelement für alle drei Arten).
- **Knopf "Nach Updates suchen" (Einstellungen):** Er ruft im Browser ebenfalls keine internen Befehle von HACS mehr auf (`hacs/repositories/list`, `hacs/repository/refresh`; derselbe Typ Zugriff, den die HACS-Prüfung in der Integration beanstandet hat). Er lädt die Update-Entität von HACS über den öffentlichen Dienst `homeassistant.update_entity` neu; wer will, dass HACS sofort nachsieht, legt sich eine App der Art "Aktion" an (siehe oben).

### Intern

- `checkAction` und `sanitizeApps` in `apps.js` (Dienst nur `bereich.dienst`, Daten ein einfaches Objekt bis 2000 Zeichen, ungültige Aktionen entfallen), `AppLauncher.run`/`_exec`, `_askConfirm` nimmt Argumente für seine Texte. Tests: neue Suite `launcheract`, Suiten `launcher` und `launcherfav` angepasst.

## [2.112.1] - 2026-10-21

Das automatische Update fasst die Interna von HACS nicht mehr an (Wunsch der HACS-Prüfung).

### Geändert

- **Automatisches Update:** Vor der Installation liess die Integration HACS das Repository über dessen interne Objekte neu laden (`hass.data["hacs"]`). Das ist privater Zustand einer anderen Integration und kann mit jeder HACS-Version brechen. Es ist entfernt. Die Integration nutzt nur noch öffentliche Dienste von Home Assistant: `homeassistant.update_entity` auf der Update-Entität von HACS, danach `update.install`. Wirkung: HACS prüft nur alle paar Stunden auf neue Versionen; ein eben erschienenes Release kann deshalb einige Stunden länger brauchen, bis das automatische Update es sieht, die nächste tägliche Prüfung holt es.

### Intern

- `_async_hacs_refresh` aus `update_check.py` entfernt; der Test `test_auto_update_starts_as_soon_as_a_check_finds_a_version` prüft, dass das HACS-Objekt nie berührt wird.

Nicht veröffentlicht; enthalten in 2.113.0.

## [2.112.0] - 2026-10-20

Das Empfangsfenster ist aufgeräumt: Kennzahlen als Kacheln, eine Karte "Empfänger", alle Hinweise hinter einem Info-Knopf.

### Geändert

- **Empfangsfenster (Mockup `signal-layout-v1`, Variante A):** Vorher standen sieben Textblöcke und drei Diagramme untereinander, die wichtigen Zahlen im Fliesstext. Jetzt:
  - **Kacheln oben:** "Jetzt" (mit Stufe, "Ø 5 Min." und der Warnschwelle; die Schwelle wird gelb, wenn das Gerät schwach ist) und darunter "Median", "Schlechtester" und "Bester" des Zeitraums.
  - **Diagramm** wie bisher, mit der Legende und einem **ⓘ-Knopf**: Er klappt die Hinweise einmal auf (Quelle der Aufzeichnung, "Wert und Warnung sind der Median der letzten 5 Minuten", Lücken, "der frühere Weg lässt sich nicht herstellen", Erklärung der Live-Werte). Vorher hatte jeder Abschnitt seinen eigenen Hinweis.
  - **Eine Karte "Empfänger"** ersetzt "Gerade gehört von" und "Verbunden über": der Weg-Balken mit Zeiten, darunter je Empfänger eine Zeile mit Name, der Marke **"✓ zählt"** (sein Wert ist der Empfang), dem aktuellen Wert und Alter seiner letzten Meldung ("gerade -76 dBm · vor 8 s", alle 5 Sekunden neu), seinem Anteil und Ø im Zeitraum und der Marke **"⚠ 21 dB schwächer"** für einen Empfänger, über den der Empfang längere Zeit deutlich schlechter lief als über den Hauptempfänger (Einzelheiten als Tooltip; ersetzt den langen Textkasten). Empfänger, die gerade gehört werden, aber im Zeitraum nicht im Weg waren, stehen grau am Ende; Empfänger ohne frische Meldung sagen "gerade nicht gehört".
  - **Letzte Wechsel** bleiben unter den Empfängern sichtbar.
- Es ging nichts verloren: alle Werte, Notizen und Hinweise sind noch da, nur gruppiert.

### Intern

- `_signalHistHtml` (Kacheln, Hinweis-Bereich), neu `_receiversHtml` ersetzt `_liveHtml` und `_viaHtml`; Texte `sigNow`, `sigAvg5`, `sigMedian`, `sigWorst`, `sigBest`, `sigInfo`, `sigReceivers`, `sigScope`, `sigPct`, `sigUsed`, `sigWeaker`, `sigAvgShort`, `sigRowNow`, `sigRecvIdle` (entfernt: `sigFacts`, `sigLive`). Tests: Suite `signallive` (neu geschrieben), `signalvia`, `sighist` angepasst.

## [2.111.0] - 2026-10-20

"Empfang schwach" und der Empfangswert beruhen auf dem Median der letzten Minuten statt auf der einzelnen Meldung.

### Geändert

- **Empfang (Bluetooth, ZHA und Sensoren, die der Recorder nicht aufzeichnet):** Eine einzelne Meldung schwankt um 10 dB und mehr (Fading, mehrere Empfänger, ein Proxy, der nur zeitweise hört). Am Einzelwert gemessen wechselte ein Gerät an der Schwelle (Standard -80 dBm) ständig zwischen "schwach" und "nicht schwach", und Warnungen "Empfang schwach" erschienen und verschwanden, ohne dass sich etwas geändert hatte. Der **Wert in der Liste, die Entscheidung "schwach", der Filter-Chip, die Sortierung, der Grund der Warnung und die KI-Fakten** nutzen jetzt den **Median der letzten 5 Minuten** (Messungen der eigenen Aufzeichnung plus der aktuelle Wert; ab drei Messungen, vorher der Einzelwert). Eine echte Veränderung zeigt sich nach wenigen Minuten, ein einzelner Ausreisser nicht mehr. Das Empfangsfenster sagt es unter dem Diagramm ("Der aktuelle Wert und die Warnung "schwach" beruhen auf dem Median der letzten 5 Minuten"); die Live-Zeile zeigt die Einzelwerte der Empfänger wie bisher. Der aufgezeichnete Verlauf bleibt unverändert (er hält die Einzelwerte fest).
- Nicht betroffen: WLAN und andere Geräte, deren Empfang aus einem Sensor des Recorders kommt (ihr Wert ist ohnehin ruhig).

### Intern

- `SignalLog.steady` (Fenster `STEADY_WINDOW_S` 300 s, `STEADY_MIN` 3), `devices.signal_source(…, smooth=True)`; die Aufzeichnung liest den Einzelwert (`smooth=False`). Das Ergebnis von `signal_history` hat `smoothed`. Tests: `tests/test_signal_history.py`, Suite `signallive`.

## [2.110.0] - 2026-10-20

Der App-Launcher zeigt immer alle Apps.

### Geändert

- **App-Launcher:** Die Gruppe "Home Assistant" endet nicht mehr nach 6 (Handy) oder 8 (Desktop) Apps mit dem Umschalter "Alle 12 ›" / "Weniger". Es werden immer alle Apps gezeigt; bei mehr Apps **scrollt** der Launcher. Der Knopf und seine zwei Texte entfallen.

### Intern

- `_listHtml` in `apps.js` ohne Grenze, `ui.all`, Handler `all`, `.ap-more` und die Texte `appsAll`/`appsLess` entfernt. Tests: `launcher` (alle 12 Kacheln, kein Knopf), `launchercol`.

Nicht veröffentlicht; enthalten in 2.111.0.

## [2.109.0] - 2026-10-20

Das Empfangsfenster eines Bluetooth-Geräts zeigt live, welche Empfänger es gerade hören.

### Hinzugefügt

- **Empfangsfenster, Live-Zeile (Bluetooth):** Unter dem Diagramm steht zum Beispiel "Gerade gehört von: **Shelly Garage -76 dBm (vor 8 s)**, Storen Küche -97 dBm (vor 3 s)": jeder Empfänger (Adapter oder Proxy), der das Gerät gehört hat, mit seinem letzten RSSI und der Frische dieser Meldung, der stärkste zuerst. Der Empfänger, dessen Wert als Empfang zählt, ist fett. Die Zeile aktualisiert sich alle 5 Sekunden, solange das Fenster offen ist (das Alter läuft weiter). So sieht man auf einen Blick, ob ein schwacher Wert vom Gerät kommt oder nur von einem Empfänger, der es zufällig schlecht hört. Ein Hinweis beim Darüberfahren oder langen Drücken erklärt den fetten Eintrag. Ohne Bluetooth-Adresse oder wenn kein Empfänger das Gerät hört, erscheint nichts.

### Behoben

- **Bluetooth-Empfang, Platzhalterwert:** Ein Empfänger, der 0 dBm meldet (ein Platzhalter, keine Messung), zählte als "stärkster" Wert und konnte einer echten Messung vorgezogen werden. Werte ab 0 dBm werden jetzt wie "kein Wert" (-127) ignoriert.

### Intern

- `devices._ble_seen` (alle Empfänger mit Alter und RSSI), `_ble_pick` (die Wahl), neu `ble_listeners`; WebSocket `device_panel/signal_listeners` (nur die Live-Zeile, ohne Verlauf) und Feld `listeners` in `device_panel/signal_history`. Tests: `tests/test_ble_best.py`, `tests/test_signal_history.py`, neue Suite `signallive`.


## [2.108.0] - 2026-10-20

Der Bluetooth-Empfang zeigt den stärksten Empfänger statt den, den Home Assistant gerade führt.

### Geändert

- **Bluetooth-Geräte, Empfang:** Alle Adapter und Bluetooth-Proxys hören gleichzeitig mit, aber Home Assistant behält den zuerst gewählten Empfänger und wechselt erst, wenn ein anderer deutlich stärker ist (oder der alte veraltet). Ein Gerät stand deshalb oft auf einem schwächeren Proxy, und der Wert sprang beim Wechsel. Das Panel liest jetzt die letzte Meldung **jedes** Empfängers und zeigt den **stärksten RSSI**, mit dem Namen des Empfängers, der ihn geliefert hat; Wert und Empfänger stammen immer aus derselben Meldung. Der **Empfangsverlauf** und der Weg "verbunden über" nutzen dieselbe Wahl und widersprechen der Liste also nie.
- **Einzelheiten:** Es zählen nur Empfänger, die das Gerät kürzlich gehört haben (ihre letzte Meldung höchstens 60 Sekunden älter als die frischeste; ein Proxy, der das Gerät nicht mehr hört, behält keinen alten guten Wert). Der bisherige Empfänger bleibt, solange er höchstens 2 dB schwächer ist als der stärkste, damit der Name nicht zwischen zwei fast gleichen Proxys hin und her springt (und der Verlauf frei von Rauschen bleibt). Liefert HA keine Sicht je Empfänger, gilt wie bisher der Wert, den HA führt.
- Wirkung: Der Empfang von Bluetooth-Geräten ist meist besser und ruhiger als vorher; Warnungen "Empfang schwach" erscheinen für sie seltener. Einzelne Werte schwanken weiter um einige dB, das ist das Funksignal selbst.

### Intern

- `devices._ble_best` (eine Stelle für Wert und Empfänger, genutzt von `_ble_signal` und `ble_receiver`), `_ble_stamps` (HA baut die Zeitpunkte bei jedem Zugriff neu auf, darum 5 s je Empfänger zwischengespeichert). Tests: neu `tests/test_ble_best.py`.

## [2.107.0] - 2026-10-20

"Apps" und "Dashboards" von Home Assistant als Apps im Launcher, standardmässig ausgeblendet.

### Hinzugefügt

- **App-Launcher:** zwei neue Seiten von Home Assistant, **Apps** (Einstellungen › Apps, `/config/apps/installed`) und **Dashboards** (`/config/lovelace/dashboards`), für Administratoren. Sie sind **standardmässig ausgeblendet**; mit dem Auge im Bearbeiten-Modus schaltest du sie ein (und kannst sie wie jede App als Favorit anheften). Bestehende Einstellungen bekommen sie einmal als ausgeblendet; wer sie einschaltet, behält das. "Zurücksetzen" im Bearbeiten-Modus blendet sie wieder aus.

### Intern

- Daten des Launchers `v` 3 (`sanitizeApps`, `HIDDEN_BY_DEFAULT`); der einmalige Schritt von v 2 (Einstellungen anheften) läuft nur noch für Daten älter als v 2. Suite `launcher` erweitert.

## [2.106.1] - 2026-10-20

Das Log fragt, bevor es geleert wird.

### Geändert

- **Log, Knopf "Leeren":** ein Pop-up fragt zuerst "Log leeren?" (alle Einträge werden gelöscht, auch die gespeicherten; das lässt sich nicht rückgängig machen) mit "Abbrechen" und "Alle löschen". Erst "Alle löschen" leert.

### Intern

- Nutzt das gemeinsame Rückfrage-Pop-up (`_askConfirm`). Suite `log` erweitert.

## [2.106.0] - 2026-10-20

Ein Protokollfenster für Magic Push und Routinen, mit Reitern.

### Hinzugefügt

- **Protokollfenster:** oben zwei Reiter, **"Magic Push"** (links) und **"Routinen"**, in einem Fenster. Es öffnet auf dem Reiter, von dem aus es aufgerufen wurde. Der andere Reiter zeigt das Protokoll **aller Meldungen oder Routinen desselben Geräts** (mit der Auswahl einer einzelnen); beim Zurückwechseln gilt wieder der erste Zusammenhang (die einzelne Meldung oder Routine, von der man kam). Der Zeitraum bleibt; Auswahl, Suche und Wahl der Meldung beginnen je Reiter neu.

### Geändert

- **Das Protokoll des Panels heisst "Log"** (vorher "Protokoll"), damit es sich vom Protokoll einer Meldung oder Routine unterscheidet. Auf Englisch heisst das Protokoll einer Meldung, Routine oder eines Geräts jetzt **"History"** (Knopf "History", "History of the device"), das Panel-Log bleibt "Log". Einstellungen: Zeilen "Panel-Log", Kapitel "Protokolle und Log".
- **Log, Fuss:** neben der Zahl der Einträge die **Grösse in MB** (zum Beispiel "532 Einträge, 5 gezeigt · 0,1 MB"). `device_panel/get_log` meldet `bytes`.

### Intern

- Die Knöpfe "Protokoll" auf den Karten tragen jetzt das Gerät (`data-device`) neben `data-id`, damit das Fenster das Gerät einer einzelnen Meldung oder Routine kennt. `ProtocolUi.alt` hält den Zusammenhang des anderen Reiters. Suite `protocol` erweitert.

## [2.105.1] - 2026-10-20

Protokollfenster: "Zurück" unten; Kapitel der Einstellungen in neuer Reihenfolge; mehr Platz in den Gerätekarten.

### Geändert

- **Protokollfenster (alle Ansichten):** "Zurück" steht unten links im Fuss statt des Kreuzes oben rechts. Im Trace führt "Zurück" weiter zur Tabelle. Auf dem Handy ist die Zahl der Einträge im Fuss ausgeblendet, damit der Platz reicht.
- **Einstellungen, Panel › Allgemein:** das Kapitel "Sichern und wiederherstellen" steht wieder ganz am Schluss; "Protokolle" davor.
- **Übersichten, Fuss einer Gerätekarte:** "Gerät öffnen" und "Protokoll des Geräts" haben mehr Abstand.

### Intern

- Suiten `protocol`, `protocollimits` und `backup` angepasst.

## [2.105.0] - 2026-10-20

Die Grösse der Protokolle ist in den Einstellungen wählbar; das Protokollfenster geht so weit zurück, wie es Einträge gibt.

Enthält die Änderungen von 2.104.0 und 2.103.0.

### Hinzugefügt

- **Einstellungen, Panel › Allgemein, neues Kapitel "Protokolle"** (ganz unten): wie viel die Protokolle behalten, als **Grösse in MB** und als **Zahl der Einträge**, getrennt für **Meldungen und Routinen** (Standard **30 MB**, **5000 Einträge je Meldung oder Routine**) und für das **Panel-Protokoll** (Standard **10 MB**, **4000 Einträge**; vorher fest 500). Daneben steht die aktuelle Belegung. Ist eine Grenze erreicht, fällt der **älteste Eintrag** weg (bei den MB der Meldungen und Routinen der älteste über alle). Eine **tiefere Grenze kürzt sofort**; gehen dabei vorhandene Einträge verloren, fragen die Einstellungen vorher ("Kürzen und speichern"), weil sich das nicht rückgängig machen lässt. Die Grösse ist die des gespeicherten JSON.
- **Protokollfenster:** neuer Zeitraum **"Alle"** (ab dem ältesten Eintrag, auch über 12 Monate hinaus); das Diagramm geht je Woche und zeigt höchstens die neuesten 399 Wochen. "Eigener" nach "Alle" beginnt mit dem Datum des ältesten Eintrags und heute.
- Neuer Befehl `device_panel/protocol_usage` (nur Administratoren) für die Belegung in den Einstellungen.

### Geändert

- **Keine Zeitgrenze mehr:** die 12 Monate aus 2.104.0 entfallen; Einträge bleiben, solange Grösse und Zahl es erlauben. Der Hinweis unter der Protokolltabelle nennt die geltenden Grenzen.
- **Panel-Protokoll (Aktivitätsprotokoll):** seine Grenze ist nicht mehr fest 500 Einträge, sondern die zwei Einstellungen; `device_panel/get_log` meldet die Zahl als `max`.

### Intern

- `protocol.Protocol.enforce()` / `usage()` / `limits()`, `activity.enforce()` / `apply_limits()` / `usage()`; der Listener der Optionen wendet die Grenzen nach dem Speichern an. Optionen `protocol_max_mb`, `protocol_max_entries`, `log_max_mb`, `log_max_entries` (Bereiche 1–200, 100–100000, 1–200, 100–20000). Tests: `test_protocol`, `test_activity`, `test_update_check` angepasst; neue Suite `protocollimits`.

## [2.104.0] - 2026-10-20

Ein Protokoll für jede Magic-Push-Meldung und jede Routine, mit Diagramm und bei Routinen einem kopierbaren Trace.

Enthält die Änderungen von 2.103.0.

### Hinzugefügt

- **Magic Push, Protokoll:** Der Knopf **"Protokoll"** auf einer Karte (in der Übersicht und im Geräte-Popup) öffnet ein Fenster mit jeder gesendeten Meldung: Datum, Art (ausgelöst, wiederholt, wieder normal, Test), **Titel und Text, wie gesendet**, Wert, Empfänger und was daraus wurde (gesendet, durch die Ruhezeit zurückgehalten, fehlgeschlagen mit Grund, kein Empfänger). Oben: der Zeitraum (**7 Tage, 30 Tage, 6 Monate, 12 Monate** oder eigene Daten), Kennzahlen, ein **Balkendiagramm** (je Tag, bei Zeiträumen über 120 Tagen je Woche; ein Tipp auf einen Balken wählt diesen Tag, ein roter Teil zeigt Probleme), eine Auswahl (ausgelöst, wieder normal, Test, zurückgehalten, fehlgeschlagen), eine Suche über Titel, Text und Wert und **"Als Text kopieren"**. Eine Zeile zeigt die Meldung, wie sie gesendet wurde.
- **Routinen, Protokoll und Trace:** dasselbe Fenster für eine Routine: Datum, Auslöser (Zeit, Auslöser, von Hand, Zurückschalten), Aktion und Ergebnis (ausgeführt, zurückgeschaltet, verpasst, pausiert, neuer Versuch, fehlgeschlagen mit Grund), mit Kennzahlen und dem Anteil pünktlicher Läufe. Eine Zeile öffnet den **Trace**: jeder Schritt der Reihe nach (Auslöser und Verspätung, Zeitfenster, gemerkter Zustand, Aufruf mit den Diensten, Dauer und Zustand danach, geplantes Zurückschalten, Meldung aufs Handy, Ergebnis); fehlgeschlagene Schritte in Rot. **"Trace kopieren"** legt ihn als Text in die Zwischenablage, "Neuer" und "Älter" gehen durch die Einträge.
- **Protokoll des Geräts:** "Protokoll des Geräts" im Geräte-Popup (Reiter Magic Push und Routinen) und im Fuss jeder Gerätekarte der Übersichten listet alle Meldungen oder Routinen des Geräts in einer Tabelle, mit einer Auswahl einzelner Meldungen oder Routinen.
- **Aufbewahrt:** 12 Monate, höchstens 4000 Einträge je Meldung oder Routine (die ältesten fallen weg). Gespeichert in einer eigenen Datei je Meldung oder Routine (`.storage/device_panel.protocol_<id>`), geschrieben mit 30 Sekunden Verzögerung und beim Beenden von Home Assistant. Ein Meldungseintrag braucht etwa 250 Byte, ein Routinenlauf mit Trace etwa 650 Byte; eine Meldung, die einige Male im Monat auslöst, bleibt im Kilobyte-Bereich, eine täglich laufende Routine liegt nach einem Jahr bei etwa 0,5 MB, die Grenze von 4000 Einträgen bei etwa 1 MB (Meldungen) bis 2,6 MB (Routinen mit Trace). Wird eine Meldung oder Routine gelöscht, verschwindet ihr Protokoll; entfernt man die Integration, verschwinden alle Protokolle.

### Intern

- Neu `protocol.py` (Speicher, Grenzen, Abfrage mit Kennzahlen und Balken), `protocol_ws.py` (`device_panel/protocol_get`, nur Administratoren), `panel/protocol.js` (Fenster `dialog.proto-dlg`, gleiche Hülle wie das Aktivitätsprotokoll). `push.async_push(outcome=…)` meldet zurückgehalten / gesendet / Grund; `routines._async_call(trace=…)` hält die Schritte fest. Das Protokoll bleibt beim Neuladen der Integration im Speicher (wie das Aktivitätsprotokoll), damit beim Speichern der Einstellungen nichts verloren geht, was noch auf das Schreiben wartet.
- Tests: `tests/test_protocol.py`, neue Suite `protocol`; Befehl `device_panel/protocol_get` im Simulator.

Nicht veröffentlicht; enthalten in 2.105.0.

## [2.103.0] - 2026-10-20

Suchfeld im Geräte-Popup bei "Schalter" und "Entitäten".

### Hinzugefügt

- **Geräte-Popup, Reiter "Schalter" und "Entitäten":** Ab acht Einträgen steht über der Liste ein **Suchfeld** (Name, Entitäts-ID oder der gezeigte Zustand; Gross- und Kleinschreibung egal), mit dem Kreuz zum Leeren, einem Zähler "n von m" und dem Hinweis "Keine Treffer". Beide Reiter haben ihren eigenen Text. Der Text bleibt beim Wechsel des Reiters und beim Auffrischen des Popups; beim nächsten Gerät beginnt er leer. Solange das Feld den Fokus hat, frischt sich das Popup nicht selbst auf (wie bei den anderen Eingabefeldern). Mit weniger als acht Einträgen gibt es kein Feld.

### Intern

- `_devSearchHtml`, `_devSearchInput`, `_devMatch`, `_entListHtml`, `_switchGridHtml` in `device-panel.js`; der Text liegt in `_devQ`. Test: neue Suite `devsearch`.

Nicht veröffentlicht; enthalten in 2.104.0.

## [2.102.0] - 2026-10-20

Neue Magic-Push-Meldungen aus der Übersicht, und der Knopf "Neu" sitzt unten.

### Hinzugefügt

- **Magic Push, Übersicht:** Das Fenster mit allen Meldungen hat unten einen Knopf **"Neue Meldung"**, wie im Popup eines Geräts. Er öffnet denselben Assistenten mit einem Schritt mehr davor: **Gerät** (Schritt 1 von 6, mit Suche). "Weiter" lädt die Entitäten des Geräts, "Zurück" kehrt zur Wahl zurück (sie bleibt erhalten; mit demselben Gerät bleiben die Bedingungen, mit einem anderen beginnt der Entwurf von vorn), "Abbrechen" schliesst ohne Rückfrage. Danach ist alles wie im Popup des Geräts; die Meldung gehört zum gewählten Gerät.

### Geändert

- **Routinen und Magic Push, Übersicht:** Der Knopf für einen neuen Eintrag ist kein Plus mehr oben rechts, sondern der Knopf **"Neue Routine"** bzw. **"Neue Meldung"** unten, im Aussehen wie der im Popup des Geräts. Er bleibt beim Scrollen am unteren Rand des Fensters stehen und verschwindet so auch bei einer langen Liste nie. Die Texte der Fenster nennen ihn.

### Intern

- `startNewFromAll`, `chooseDevice` und Schritt 0 in `magic-push.js` (wie bei den Routinen); `.dlg-addbar` (haftend). Tests: neue Suite `magicadd`, `magicall` und `routineall` angepasst.

## [2.101.1] - 2026-10-20

Namen in Benachrichtigungen von Home Assistant werden entschärft, Regler kommen mit unsinnigen Werten eines Geräts zurecht, und die Actions der CI sind festgelegt.

### Sicherheit

- **Anhaltende Benachrichtigungen (neue Geräte, Batterie schwach, Geräte ausgefallen):** Namen von Geräten, Bereichen und Integrationen werden als reiner Text eingesetzt. Zeichen mit Bedeutung für Markdown (`[ ] ( ) ! * _ ` < > ~ | & \`) bekommen einen Backslash, Zeilenumbrüche werden zu Leerzeichen. Vorher konnte ein Name wie `X](https://…)` einen eigenen Link oder ein Bild von einem fremden Server in die Meldung bringen, die jeder Benutzer von Home Assistant sieht. Namen ohne solche Zeichen sehen aus wie bisher. Die Push-Meldungen aufs Handy sind reiner Text und unverändert.
- **CI:** Die Actions in `.github/workflows` (`checkout`, `setup-python`, `setup-node`, `upload-artifact`, `hacs/action`, `hassfest`) sind auf einen Commit festgelegt statt auf einen beweglichen Tag oder Zweig. Die Version steht als Kommentar daneben.

### Behoben

- **Routinen, Seite "Optionen" (Regler):** Ein Gerät kann unsinnige Werte melden: Text statt Zahl, `null`, eine untere Grenze über der oberen, einen Schritt von 0 oder grösser als der ganze Bereich. Bei Temperatur (Klima), Farbtemperatur (Licht) und Zahl-Entitäten entstand dann ein kaputter Regler, im schlimmsten Fall baute sich die Seite nicht auf. Die Werte werden jetzt im Backend und noch einmal im Panel geprüft; sind sie unbrauchbar, gelten die üblichen Grenzen (Temperatur 7 bis 35 °C bzw. 45 bis 95 °F, Schritt 0,5 bzw. 1; Farbtemperatur 2000 bis 6500 K; Zahl 0 bis 100, Schritt 1). Normale Geräte sind nicht betroffen. Auch die Werte im Markup werden escaped.

### Intern

- `push.md_text`, `routines._finite`/`_bounds`/`_step` und `cleanSpec` in `routines.js`. Tests: `test_new_devices`, `test_battery`, `test_outage_notify`, `test_routine_options`, neue Suite `routineweird`.

## [2.101.0] - 2026-10-19

Härtung nach einer Sicherheitsprüfung: weniger Wege für fremde Daten zu internen Adressen, Grössenlimits für Antworten von aussen und eine klarere Vorschau beim Wiederherstellen.

### Sicherheit

- **Favicon für externe Links:** Was die Seite selbst nennt (Symbol-Links, Weiterleitungen), wird nicht mehr abgerufen, wenn es auf den Rechner von Home Assistant selbst oder auf Link-Local-Adressen zeigt (`127.x`, `::1`, `localhost`, `169.254.x.x` samt Cloud-Metadatenadresse). Weiterleitungen werden jetzt von Hand verfolgt (höchstens 5) und jedes Ziel geprüft. Die Adresse, die man selbst eingibt, ist ausgenommen (ein Dienst auf `localhost` geht weiter), ebenso Geräte im Heimnetz (`192.168.x.x`, `10.x.x.x`, Router). Ein Name, der erst per DNS auf eine solche Adresse zeigt, wird nicht erkannt: vor dem Abruf gibt es keine Namensauflösung.
- **Update-Entität in HACS:** Sie wird nur noch am Link ihres Releases auf dieses Repository auf GitHub erkannt (am Host `github.com` verankert), nicht mehr am Titel "Device Panel" oder an der Entity-ID. Das gilt für das Panel (Knopf "Updaten") und für "Updates automatisch installieren". Hat HACS noch keinen Release-Link (zum Beispiel direkt nach dem Start), gilt die Entität im Panel als nicht gefunden, bis HACS geladen hat; die tägliche Prüfung versucht es erneut.
- **Antworten von aussen sind in der Grösse begrenzt:** die Antwort der GitHub-API (Versionsprüfung, Release-Texte) auf 2 MB, die Textdateien der Release Notes auf 1 MB (wie bisher), das Icon vom Icon-CDN von Home Assistant auf 512 KB und 2048 × 2048 Pixel (im PNG-Kopf geprüft, bevor entpackt wird). Grössere Antworten werden verworfen.

### Hinzugefügt

- **Wiederherstellen, Vorschau:** Routinen und Magic-Push-Meldungen aus einer Datei zeigen, **was sie tun**, nicht nur ihren Namen: Entität und Aktion (Routinen) bzw. Entität, Bedingung und Push-Ziel (Magic Push), in der Bereichszeile und im Fenster "Werden geändert"; bei einem bestehenden Eintrag als alt → neu. Eine fremde Datei kann sich nicht mehr hinter einem harmlosen Namen verstecken.

### Geändert

- **Release Notes:** Der Text des Änderungsprotokolls wird jetzt stückweise bis zum Ende gelesen. Vorher war es ein einziges Lesen, das nur liefert, was bis dahin angekommen ist; ein verkürztes Lesen wurde nicht beobachtet, es ist eine Vorsichtsmassnahme.

### Intern

- Neues Modul `http_limit.py` (`read_limited`). Tests: `test_favicon`, `test_update_check`, `test_push_icon`, `test_backup`, Suite `backup`.

Nicht veröffentlicht; enthalten in 2.101.1.

## [2.100.0] - 2026-10-19

Das Panel ändert keine Entitäten von HACS mehr.

### Geändert

- **Vorabversionen: das Panel schaltet den HACS-Schalter "Pre-release" nicht mehr.** Der Knopf "In HACS freischalten" ist weg: er aktivierte die deaktivierte HACS-Entität "Pre-release" in der Entity-Registry und schaltete sie ein, und "Vorabversionen anzeigen" aus schaltete sie wieder aus. Eine Integration soll die Entitäten einer anderen nicht aktivieren, deaktivieren oder schalten. Bei einer gefundenen Beta und ausgeschaltetem "Pre-release" in HACS bleibt "Updaten" wie bisher gesperrt, der Hinweis führt zum HACS-Gerät ("HACS-Gerät öffnen"); dort aktivierst und schaltest du "Pre-release" selbst ein, danach installiert "Updaten" die Beta. "Vorabversionen anzeigen" aus lässt den Schalter in HACS, wie er ist.
- Unverändert: die tägliche Prüfung, "Updaten" und "Updates automatisch installieren" installieren weiter über die HACS-Update-Entität von Device Panel selbst.
- Der gespeicherte Wert `prerelease_hacs` (welchen Schalter das Panel eingeschaltet hatte) wird nicht mehr verwendet; `device_panel/set_panel` nimmt ihn nicht mehr an.

## [2.99.2] - 2026-10-19

Routinen-Karten zeigen Entitätsnamen als Text.

### Sicherheit

- **Routinen, Karte in der Liste:** die Zeile, die beschreibt, was die Routine tut ("Steckdose einschalten, nach 20 Min. wieder aus"), setzte den **Namen der Entität** als HTML statt als Text in die Seite. Ein Name mit HTML darin (zum Beispiel `"><img src=x onerror=…>`, gesetzt von einer Integration oder einem Netzwerkgerät) konnte im Panel Code ausführen, mit der Home-Assistant-Verbindung des Administrators. Die Zeile wird jetzt wie alle anderen Texte escaped. Alle übrigen Stellen wurden geprüft (siehe Intern).

### Intern

- Neue Prüfung `tests/panel/xss-run.mjs` (Simulator-Modus `PANEL_XSS=1`): jeder angezeigte Text aus dem Backend (Namen, Bereiche, Modelle, Labels, Meldungen und mehr) bekommt ein Stück HTML angehängt, das Attribute schliesst (`"` und `'`) und ein Bild mit `onerror` einfügt; alle 107 Suiten laufen dagegen, jede Stelle, an der solches HTML wirkt, wird mit ihrem Kontext gemeldet. Vor der Korrektur: 104 Treffer, alle in der Routinen-Karte; danach: keine.

Nicht veröffentlicht; enthalten in 2.100.0.

## [2.99.1] - 2026-10-19

Das Herz-Easter-Egg schlägt auch bei eingeschaltetem "Bewegung reduzieren".

### Behoben

- **Easter Egg (fünf schnelle Klicks aufs Logo):** bei eingeschalteter Systemeinstellung **"Bewegung reduzieren"** (auf dem Desktop oft der Fall) stand das Herz oben links still und die Linie im Puls-Diagramm wurde nicht aufgedeckt. Das Herz schlägt dann jetzt **sanft** (kleiner), die Linie wird wie sonst aufgedeckt. Ohne diese Einstellung ändert sich nichts.

## [2.99.0] - 2026-10-19

Wiederherstellen: die Kacheln der Vorschau öffnen Detailfenster.

### Hinzugefügt

- **Wiederherstellen, Vorschau:** die drei Kacheln (**werden geändert**, **unverändert**, **nicht übernommen**) und die Bereichszeilen sind antippbar (Pfeil ›) und öffnen ein **Detailfenster** mit "Zurück zur Vorschau". **Werden geändert** listet alle Änderungen nach Bereich, je Einstellung alt → neu (Geräte mit Name, Einstellungen mit lesbaren Namen); ein Tipp auf eine Bereichszeile springt zu diesem Bereich. **Unverändert** listet die Werte, die schon so gelten. **Nicht übernommen** listet jeden übersprungenen Eintrag mit Grund, Geräte mit Name, ID und Betroffenem; dort steht auch **"Bericht kopieren"**. Vorher zeigte die Vorschau nur drei Beispiele und die übersprungenen Einträge als eine lange Liste.

### Intern

- Der Bericht des Wiederherstellens (`device_panel/backup_import`) liefert je Bereich die vollen Listen: `changes` (was, alt, neu, Gerät) und `same` (was, Gerät), je bis 500 Einträge, neben den Zählern und den drei Beispielen. Test `test_backup`, Suite `backup`.

## [2.98.1] - 2026-10-19

Einstellungen › Panel öffnet im linken Reiter; Wiederherstellen erklärt, was es überspringt.

### Behoben

- **Einstellungen › Panel** öffnet jetzt im Reiter **"Allgemein"** (links) statt in "Updates" (rechts). Der gewählte Reiter bleibt erhalten, solange der Dialog offen bleibt.
- **Wiederherstellen: eine Sicherung der eigenen Einstellungen meldet kein "Gerät unbekannt" mehr.** In Home Assistant gelöschte Geräte bleiben in den Ablagen des Panels stehen (Typ, Verbindungsart, Batterie und weitere Werte je Gerät) und kamen mit in die Sicherung; beim Wiederherstellen wurden sie als unbekannt übersprungen. Sie bleiben jetzt aus der Sicherung weg. Eine Datei von vor dieser Änderung meldet sie weiterhin, jetzt mit Angaben (siehe Geändert).

### Geändert

- **Wiederherstellen, Bericht:** die Zeile "N Geräte unbekannt" lässt sich öffnen (**"Geräte anzeigen"**): je Gerät der Name (falls die Datei ihn kennt), die ID und was betroffen ist (Batterie, Meldungen, Typ, ausgeblendet …). **"Bericht kopieren"** legt die ganze Liste (Übersprungenes und Hinweise, mit Namen und IDs) in die Zwischenablage. Der Bericht erscheint auch im Ergebnisfenster nach dem Wiederherstellen.
- **Wiederherstellen, Schalter "Aktuelle Einstellungen vorher sichern"** (vorher "Zustand vorher als Datei sichern") mit klarerem Text: sichert den jetzigen Stand als Datei, bevor etwas überschrieben wird, damit sich die Wiederherstellung rückgängig machen lässt, auch später und nach dem Schliessen des Panels.

## [2.98.0] - 2026-10-18

Einstellungen sichern und wiederherstellen.

### Hinzugefügt

- **Einstellungen › Panel › Allgemein: neues Kapitel "Sichern und wiederherstellen"** unter "Startseite" (nur Administratoren, gilt für alle Benutzer). **"Sichern"** speichert die Einstellungen in eine Datei (`device-panel-JJJJ-MM-TT.json`); die Teile wählst du selbst: Meldungen und Überwachung, Panel und Anzeige, Einstellungen pro Gerät (eigene Werte, Typ, Verbindungsart, ausgeblendete Geräte), KI-Einschätzung und, standardmässig aus, Routinen und Magic Push (sie verweisen auf Entitäten und Geräte, die fehlen können). Die Datei enthält Push-Ziele, Geräte-IDs und freie Texte, aber keine Zugangsdaten und keine Tokens. **"Kopieren"** legt denselben Text in die Zwischenablage (für die App auf dem Handy, wo das Speichern einer Datei nicht immer geht).
- **"Wiederherstellen"** liest so eine Datei (oder eingefügten Text) und zeigt zuerst eine **Vorschau**, ohne etwas zu schreiben: wie viele Werte sich ändern, gleich bleiben oder nicht übernommen werden, je Teil, mit einigen Beispielen. Geschrieben wird erst nach **"Übernehmen"**. Was die Datei nicht nennt, bleibt unverändert; es wird nichts gelöscht.
- **Fehlendes wird gemeldet, nicht still ignoriert:** eine Einstellung, die es in dieser Version nicht gibt, ein Wert ausserhalb des Bereichs, eine Geräte-ID, die es hier nicht gibt, oder eine Routine bzw. Magic-Push-Meldung, deren Gerät oder Entität fehlt, werden **mit Grund übersprungen**; ein Push-Ziel, das es nicht mehr gibt, oder eine Integration, die nicht installiert ist, werden **mit Hinweis übernommen** (ohne Push-Ziel kommt kein Push, bis du es änderst).
- **Rückgängig:** vor dem Wiederherstellen hält das Panel den jetzigen Zustand fest und kann ihn als Datei sichern ("Zustand vorher als Datei sichern", standardmässig an); **"Rückgängig"** im Ergebnisfenster stellt genau diesen Zustand wieder her (und entfernt, was die Wiederherstellung hinzugefügt hat), solange das Fenster offen ist. Dieselbe Datei stellt ihn später mit derselben Funktion wieder her.
- Sichern und Wiederherstellen sind gesperrt, solange die Einstellungen ungespeicherte Änderungen haben.

### Intern

- Backend `backup.py` mit den Befehlen `device_panel/backup_export` und `device_panel/backup_import` (`dry_run` für die Vorschau, `replace` für Rückgängig); Routinen und Magic-Push-Meldungen behalten beim Wiederherstellen ihre IDs (keine Doppelten bei zweimaligem Einspielen). Tests: `tests/test_backup.py`, Suite `backup`.

## [2.97.0] - 2026-10-18

Die Kopfzeile einer geöffneten Einstellungs-Gruppe bleibt oben haften.

### Hinzugefügt

- **Einstellungen: die Kopfzeile einer aufgeklappten Gruppe bleibt unter dem Titel "Einstellungen" haften**, solange du durch ihren Inhalt scrollst, bis die nächste Gruppe sie wegschiebt (eine aufgeklappte nächste Gruppe heftet dann ihre eigene Kopfzeile an). Ein Tipp auf die angeheftete Kopfzeile schliesst die Gruppe, wo du auch bist. Zugeklappte Gruppen haften nicht. Nach dem Schliessen einer Gruppe, deren Anfang aus dem Bild gescrollt war, springt die Ansicht zu dieser Gruppe statt an eine zufällige Stelle.

## [2.96.0] - 2026-10-18

Die Übersicht jeder Meldung zieht in ihren Reiter.

### Geändert

- Der Reiter **"Übersicht" heisst jetzt "Allgemein"** (Einstellungen, "Überwachung und Meldungen"). Er wiederholt nicht mehr die fünf Karten von Ausfall, Batterie, Laden, Neu und Updates, die auch in den Reitern standen, und behält "Ziel der Meldungen" und "Ruhezeit".
- Dafür **beginnt jeder dieser Reiter mit seiner eigenen kleinen Übersicht**: eine Karte mit dem Kapitel (Symbol und Titel), dem Zeitstrahl und den **Pillen** (Push, Anhaltend, Wieder online, Sammelausfall), wie sie die Übersicht zeigte. Die Pillen schalten die Meldung sofort, neben dem Schalter im selben Reiter. Die Links "Ändern" und die Zeilen "Abweichend" der alten Karten entfallen (der Abschnitt "Abweichungen" am Ende jedes Reiters bleibt). Der Reiter Updates hat dabei den Zeitstrahl bekommen, der ihm fehlte.
- Texte, die auf den Reiter "Übersicht" verwiesen, sagen jetzt "Allgemein".
- Der Weg zurück von einer Integration zur Liste ("Alle Integrationen") ist jetzt ein **echter Knopf** mit Pfeil (Rahmen, gleiche Grösse und Stil wie "Zurück" in den Dialogen) statt eines kleinen blauen Textlinks.

## [2.95.1] - 2026-10-18

Die Ruhezeit zieht in die Übersicht um; standardmässig werden weniger Arten gehalten.

### Geändert

- **"Ruhezeit" ist kein eigener Reiter mehr.** Sie steht jetzt als Abschnitt ganz unten im Reiter "Übersicht" der Einstellungen ("Überwachung und Meldungen"), nach "Ziel der Meldungen", mit demselben blauen Strich im Titel. Die Reiterleiste hat wieder acht Reiter.
- **Standard der gehaltenen Arten:** Magic Push und Routinen sind jetzt standardmässig **aus**, wie die Status-App (standardmässig gehalten: Ausfälle, wieder online, Batterie, Laden, neue Geräte, Updates, Panel-Update). Bestehende Einstellungen der Ruhezeit bleiben wie gespeichert; bei neuen lassen sich die Arten einzeln zuschalten.

## [2.95.0] - 2026-10-18

Ruhezeit: Meldungen warten in der Nacht.

### Hinzugefügt

- Neuer Reiter **"Ruhezeit"** in den Einstellungen ("Überwachung und Meldungen"). Eine globale Ruhezeit für alle Empfänger, mit **Zeiten je Wochentag** (von, bis; das Fenster darf über Mitternacht reichen, jeder Tag lässt sich ausschalten, "Zeiten von Montag für alle" übernimmt die Zeiten). Standard: jeden Tag 22:00 bis 07:00.
- **Welche Meldungen warten**, ist je Art wählbar: Ausfälle, wieder online, Batterie, Laden, neue Geräte, Updates, Panel-Update, Routinen, Status-App und Magic Push (standardmässig alles ausser der Status-App). Alle anderen Arten kommen sofort. **Kritische Magic-Push-Meldungen** kommen immer sofort.
- **Nach der Ruhezeit** kommt entweder **eine Zusammenfassung** ("Ruhezeit vorbei: Ausfälle 2 · Batterie 1", mit noch ausgefallenen Geräten, kurzen Ausfällen und den übrigen Arten) oder **jede Meldung einzeln** (wählbar). Im Einzelmodus wird eine Meldung, die inzwischen ersetzt wurde (gleicher Tag), nur einmal gesendet, und ein Gerät, das zurück ist, wird nicht als ausgefallen gemeldet. Es werden höchstens 300 Meldungen gehalten.
- Gehaltene Meldungen überstehen einen Neustart von Home Assistant; ist die Ruhezeit inzwischen vorbei, gehen sie beim Start hinaus. Eine Änderung der Einstellungen gibt sofort frei, was nicht mehr gilt (Ruhezeit aus, Art abgewählt, Fenster vorbei). Das Aktivitätsprotokoll zeigt, was gehalten und freigegeben wurde.

## [2.94.0] - 2026-10-18

Ausfälle werden pro Integration zusammengefasst.

### Geändert

- **Eine Meldung pro Integration** statt einer für alles, was zufällig im selben Moment ausfällt. Fallen mehrere Geräte **einer Integration** zusammen aus, kommt eine Meldung für diese Integration ("Zigbee Home Automation: 7 Geräte ausgefallen", mit den ersten sechs Namen, "und 1 weitere" und dem Beginn des Ausfalls). Weniger Geräte als die Schwelle kommen einzeln. Geräte anderer Integrationen werden nicht mehr in die gemeinsame Meldung gezogen; vorher blieb eine gemischte Gruppe eine gemischte Gruppe ohne klare Ursache.
- Die erste Meldung einer Integration **wartet bis zu eine Minute**, bis auch die übrigen Geräte fällig sind, damit alle in einer Meldung stehen (ein einzelnes Gerät einer Integration wird nicht verzögert). **Wieder online** wird ebenso zusammengefasst: ist das letzte gemeldete Gerät der Integration zurück, oder nach einer Minute, kommt eine Meldung "Zigbee Home Automation: 7 Geräte wieder online" mit demselben Tag, sie **ersetzt** also die Ausfall-Meldung auf dem Handy.
- Der Schalter "Sammelausfall zusammenfassen" heisst jetzt **"Ausfälle pro Integration zusammenfassen"**.

### Hinzugefügt

- Neue Einstellung **"Zusammenfassen ab"** (Einstellungen, "Überwachung und Meldungen" › "Ausfall", unter dem Schalter; 2 bis 20 Geräte, Standard 3). Sie steht auch in den Optionen der Integration in Home Assistant.

### Intern

- Die Tests laufen parallel (rund 13 statt 35 Minuten; fehlgeschlagene Suiten werden einmal wiederholt und als instabil gekennzeichnet), ein Konsistenz-Test prüft jede "eigene Einstellung pro Gerät" gegen Backend und Panel (`tests/test_consistency.py`, Suite `consistency`), und die README-Screenshots zeigen die aktuellen Dialoge.

Nicht veröffentlicht; enthalten in 2.95.0.

## [2.93.0] - 2026-10-18

Beim Ausblenden eines Geräts wird nachgefragt.

### Geändert

- Geräte-Popup: **"Gerät ausblenden"** fragt jetzt zuerst nach ("Gerät ausblenden?", mit dem Hinweis, dass das Gerät für alle Benutzer verschwindet, nicht mehr überwacht wird und nichts mehr meldet). "Abbrechen" hat den Fokus und ändert nichts. Nach "Ausblenden" erscheint unten weiterhin der Hinweis "... ausgeblendet" mit **"Rückgängig"**, und in den Einstellungen lässt sich das Gerät wieder einblenden. Der Knopf liegt gleich neben "Schliessen" und war leicht aus Versehen getroffen.

## [2.92.1] - 2026-10-18

Die Grafik im Geräte-Popup zeigt "Erst melden nach".

### Behoben

- Geräte-Popup, Reiter "Einstellungen", Abschnitt "Ausfall": die Grafik zeigt jetzt **zwei Balken** wie die in den Einstellungen, "Ausgefallen nach" und den Push "Erst melden nach" (eigener Wert des Geräts, sonst der Integration, sonst global; nie kürzer als der erste). Bisher zeigte das Popup nur den ersten Balken, die neue Einstellung aus 2.91.0 hatte am Gerät also keine Grafik. Ohne Push (stumm, ausgeschaltet, kein Ziel) nennt der zweite Balken den Grund.

## [2.92.0] - 2026-10-18

Symbole an allen Zurück-, Weiter-, Schliessen- und Abbrechen-Knöpfen; der Reiter "Schalter" bleibt aktuell; das Easter Egg ist jetzt ein pulsierendes Herz.

### Hinzugefügt

- **Symbole an allen Navigationsknöpfen.** "Zurück" (Pfeil links), "Weiter" (Pfeil rechts), "Schliessen" und "Abbrechen" (Kreuz) tragen jetzt ein Symbol im Geräte-Popup, in den Einstellungen, in den Fenstern von Status, Routinen und Magic Push (Assistenten, Rückfragen) und im Launcher, wie es "Speichern" (Diskette) und "Gerät ausblenden" (Auge) schon taten. Der Knopf, der in den Einstellungen zwischen "Abbrechen" und "Schliessen" wechselt, behält sein Symbol. Auch die übrigen Knöpfe der Fenster haben eines bekommen, **jeder Knopf in diesem Stil trägt also ein Symbol**: "Löschen" (Papierkorb), "Verwerfen" (Papierkorb), "Weiter bearbeiten" (Stift), "Fertig"/"Übernehmen"/"Einschalten" (Haken oder Ein-Aus), "Kopieren", "Bearbeiten", "Standard", "Erneut versuchen", "Jetzt ausführen", "System Monitor hinzufügen" und "Favicon laden". (Die kleinen Textlinks in Listen, etwa "Bearbeiten" oder "Löschen" auf einer Routinen-Karte, bleiben Text.)
- **Easter Egg:** das Logo oben links wird jetzt zu einem **blauen, pulsierenden Herz** (das "D" verschwindet), das im Takt der Linie im Puls-Diagramm schlägt, also auch nach dem Hinunterscrollen sichtbar ist und auch ohne Puls-Kachel. Nach der Vorstellung kommt das Logo unverändert zurück.

### Geändert

- Das Easter Egg dauert **2 Sekunden länger** (7,4 statt 5,4 Sekunden, vier Durchläufe der Linie). Der kurze Hinweis 💓 ohne Puls-Kachel entfällt, das Herz ersetzt ihn.

### Behoben

- Geräte-Popup, Reiter **"Schalter"** und **"Entitäten"**: wer in HAs Dialog eine Entität schaltete und zurückkam, sah den alten Zustand, bis er den Reiter wechselte. Das Popup zeichnet sich jetzt neu, sobald Home Assistant einen neuen Zustand oder ein neues Attribut einer Entität des offenen Geräts meldet (sanft, nicht mitten in einer Berührung oder Eingabe).

## [2.91.0] - 2026-10-18

"Erst melden nach" pro Gerät und pro Integration.

### Hinzugefügt

- **"Erst melden nach"** (Zeit vom Beginn eines Ausfalls bis zur Meldung) lässt sich jetzt **pro Integration** (Einstellungen, "Überwachung und Meldungen" › "Integrationen", Reiter "Ausfall") und **pro Gerät** (Pop-up, Reiter "Einstellungen", neben "Ausgefallen nach") einstellen, wie "Ausgefallen nach". Das Gerät geht vor der Integration, die Integration vor dem globalen Wert; jede Zeile zeigt, woher der Wert stammt. Die neue Einstellung zählt als eigene Einstellung: Marke am Gerätenamen, Übersicht der Abweichungen und Zurücksetzen in den Einstellungen.
- Der neue Wert ist **nie kürzer als "Ausgefallen nach"** (auf allen drei Ebenen). Wer einen zu kurzen eigenen Wert speichert, bekommt eine **Fehlermeldung** statt einer stillen Verschiebung. Ohne eigenen Wert gilt zur Laufzeit der längere der beiden.

### Geändert

- Die Ausfall-Meldung wartet jetzt pro Gerät auf dessen eigene Zeit (Gerät, Integration oder global).

## [2.90.0] - 2026-10-17

KI-Einschätzung: lässt sich zuklappen.

### Hinzugefügt

- Geräte-Popup: die **KI-Einschätzung** lässt sich **zuklappen**. Die Kopfzeile des Rahmens ist jetzt ein Knopf mit Pfeil; zugeklappt bleibt nur die Kopfzeile (Einschätzung, Rückfragen und Hinweis sind weg, eine laufende Anfrage läuft weiter). Der Stand wird **pro Benutzer** gespeichert (zusammen mit den Favoriten, in den Benutzerdaten von Home Assistant, eine lokale Kopie als Rückfall), bleibt also in jedem Gerät und nach dem Neuladen zugeklappt, bis der Benutzer sie wieder öffnet.

### Geändert

- Der Unterreiter **"Standardseite"** im Abschnitt "Panel" der Einstellungen heisst jetzt **"Allgemein"**.

## [2.89.0] - 2026-10-17

Easter Egg: ein Herzschlag im Puls-Diagramm.

### Hinzugefügt

- **Easter Egg:** fünfmal schnell aufs Logo oben links tippen (jeder Tipp höchstens 1,5 Sekunden nach dem vorigen), und einige Sekunden lang zeichnet sich ein Herzschlag über das Puls-Diagramm, drei Schläge, während das Diagramm zurücktritt und das Puls-Symbol pocht. Es lässt sich wiederholen, übersteht den Neuaufbau des Diagramms und beachtet "Bewegung reduzieren" (die Linie blendet dann nur ein und aus, ohne sich zu bewegen). Ohne Puls-Kachel (noch keine Daten) erscheint stattdessen ein kleines 💓.

## [2.88.0] - 2026-10-17

Der Einstellungs-Knopf ist ein Favorit: nur noch in der Kopfzeile, wenn der Benutzer ihn anheftet; am Handy zwei angeheftete Knöpfe.

Enthält die Änderungen aus 2.87.0 und 2.86.0.

### Geändert

- Das Zahnrad steht **nicht mehr fest** am rechten Ende der Kopfzeile. Die App **Einstellungen** ist jetzt ein Favorit wie die anderen und steht nur dann in der Kopfzeile, wenn sie angeheftet ist (Herz im Launcher). **Standardmässig sind die Einstellungen ein Favorit**, zusammen mit den Routinen: beide stehen angeheftet in der Kopfzeile. Der Launcher-Knopf sitzt jetzt ganz rechts.
- **Handy:** die Kopfzeile trägt jetzt **zwei** angeheftete Knöpfe (vorher: einer, dazu das feste Zahnrad). Die gestrichelte Linie im Bearbeiten-Modus des Launchers ("Kopfzeile am Handy: nur die obersten zwei Favoriten") rutscht unter den zweiten Favoriten.
- Die App **Einstellungen** lässt sich **nicht mehr ausblenden** (Schloss statt Auge), weil es ohne das feste Zahnrad keinen Weg mehr in die Einstellungen gäbe, wenn sie ausgeblendet und nicht angeheftet ist. Eine früher gespeicherte Markierung "ausgeblendet" wird ignoriert.
- **Bestehende gespeicherte Favoriten** bekommen die Einstellungen einmal als zweiten Favoriten (am Handy sieht die Kopfzeile dann aus wie bisher: erster Favorit und Einstellungen); wer sie löst, behält es so. Ohne gespeicherte Favoriten gilt der neue Standard (Routinen, Einstellungen).
- Roter Punkt "Neustart steht aus" (nach einem Update): wie bisher am Zahnrad, wenn die **Einstellungen angeheftet** sind; **sonst am Launcher-Knopf** (die Beschriftung sagt "Neustart steht aus"). Die Karte **Einstellungen** im Launcher zeigt in beiden Fällen die rote Pille "Neustart".

## [2.87.0] - 2026-10-17

Ansicht mit "Speichern": ein Dialog "Ansicht" mit zwei Reitern; das Panel bekommt die Unterreiter "Standardseite" und "Updates".

Nicht veröffentlicht; enthalten in 2.88.0.

### Hinzugefügt

- Dialog **Ansicht** (Knopf "Ansicht" über der Liste; am Handy die Zeile "Sortierung & Ansicht"; auch die App "Ansicht" im Launcher): ein Dialog mit zwei Reitern. **Spalten** (am Handy **Sortierung**) enthält, was bisher im Dialog "Spalten" und im Blatt "Ansicht" stand: Gruppen oder Liste, Spalten (Desktop), Sortierung, Richtung und Angaben auf der Karte (Handy). Das gilt **pro Benutzer**, für Desktop und Handy getrennt. **Filter-Chips** enthält den Chip-Editor (zeigen, ausblenden, umordnen, anheften, Vorschau), aus den Einstellungen hierher gezogen; das gilt für **alle Benutzer**, und nur **Administratoren** sehen den Reiter. Ohne Administratorrecht hat der Dialog nur den ersten Reiter und lädt keine Optionen.
- **Speichern** für die Ansicht: beide Reiter ändern nur einen Entwurf. Die Liste dahinter zeigt die Änderung gleich, behalten wird sie (pro Benutzer in den Benutzerdaten, die Chips in den Optionen der Integration) aber erst mit **Speichern**. Der Zähler nennt beide Änderungen, ein Punkt markiert den geänderten Reiter. Schliessen mit Entwurf fragt "Änderungen verwerfen?"; "Verwerfen" stellt die Liste auf den gespeicherten Stand zurück. Der Reiter "Filter-Chips" lässt sich auch speichern, während er noch lädt.
- Die Einstellungen: der Abschnitt **Panel** (bisher "Panel-Version") hat zwei Unterreiter. **Standardseite**: der Schalter "Als meine Startseite festlegen" mit dem Hinweis "Gilt nur für dich, nicht für andere Benutzer". **Updates**: die Einstellungen der Update-Prüfung (tägliche Prüfung, Uhrzeit, automatische Installation, Erinnerung). Die **Versionszeile** (Nach Updates suchen, Installieren, Release Notes, Vorabversionen) bleibt wie bisher **ganz oben** in den Einstellungen, damit sie schnell erreichbar ist und beim Öffnen gleich zu sehen.
- Jeder **Speichern**-Knopf trägt jetzt das Disketten-Symbol vor dem Text, im gleichen Stil wie das Auge am Ausblenden-Knopf: Geräte-Popup, Einstellungen, die Fenster von Status, Routinen und Magic Push sowie der Launcher.
- Das Symbol "Auge mit kleinem Zahnrad" steht jetzt auch am Knopf "Ansicht" und in der Zeile "Sortierung & Ansicht" am Handy (vorher: das Spaltensymbol und die Sortierpfeile).

### Geändert

- Der Knopf "Spalten" heisst jetzt **Ansicht** (Titel des Dialogs "Ansicht"); der alte Dialog "Spalten" und das Blatt "Ansicht" entfallen, ersetzt durch den Dialog oben.
- Der Abschnitt "Ansicht" entfällt in den Einstellungen; Startseite und Filter-Chips sind wie oben beschrieben umgezogen.
- Ein Filter oder Bereich, der in der Liste gewählt wird (Bereich, Integration, Chips, Sortierung im Tabellenkopf), gilt weiter sofort und wird gleich gespeichert; nur die Einstellungen im Dialog "Ansicht" warten auf "Speichern".

## [2.86.0] - 2026-10-17

KI-Einschätzung: Knopf "Entfernen".

Nicht veröffentlicht; enthalten in 2.88.0.

### Hinzugefügt

- Geräte-Popup, KI-Einschätzung: neben "Neu erstellen" nimmt der neue Knopf **Entfernen** die Einschätzung weg, aus dem Popup und aus dem Speicher (neuer Befehl `device_panel/ai_clear`). Der Knopf "Mit KI einschätzen" steht dann wieder da; eine neue Einschätzung ist einen Tipp entfernt. Sie bleibt beim erneuten Öffnen des Popups weg, weil die gemerkte Einschätzung gelöscht ist, und fliesst auch nicht mehr in den Kontext einer späteren Einschätzung ein. Ohne Rückfrage, weil sie sich leicht neu erstellen lässt. Eine lange Einschätzung (mit Rückfragen) wurde man bisher nicht los.

## [2.85.0] - 2026-10-17

App-Launcher: die Apps "Ansicht" und "Einstellungen".

Enthält die Änderungen von 2.84.0 und 2.83.0.

### Hinzugefügt

- App-Launcher, Gruppe "Device Panel": zwei neue Apps, **Ansicht** (Symbol: Auge mit kleinem Zahnrad, in Blau) und **Einstellungen** (Zahnrad, in Braungrau). "Ansicht" öffnet den Dialog "Spalten" (auf dem Handy das Blatt "Ansicht") mit Sortierung, Spalten und Filter-Chips; "Einstellungen" öffnet die zentralen Einstellungen. Beides erreicht man auch über die Knöpfe in der Kopfzeile, darum kann der Benutzer sie im Bearbeiten-Modus **ausblenden** (Auge), wie Routinen und Magic Push; standardmässig sind beide sichtbar. Sie lassen sich auch als Favorit wählen.
- App-Launcher: die Karte **Einstellungen** zeigt eine rote Pille "Neustart", solange der rote Punkt am Zahnrad der Kopfzeile steht (Neustart nach einem Update ausstehend). Der Launcher-Knopf bekommt dafür keinen Punkt; der Punkt bleibt nur am Zahnrad in der Kopfzeile. Weg, sobald die neue Version läuft.
- Symbole können jetzt aus mehreren Formen zusammengesetzt sein (das Auge mit ausgeschnittenem Zahnrad); bisher war ein Symbol eine einzelne Form.

## [2.84.0] - 2026-10-17

Geräte-Popup: Knopf "Integration in HA öffnen".

Nicht veröffentlicht; enthalten in 2.85.0.

### Hinzugefügt

- Geräte-Popup, neben dem Geräte-Knopf: der Knopf **Integration in HA öffnen** (im gleichen Stil, auf derselben Zeile, auch auf dem Handy). Beide Knöpfe folgen einem Schema und sind kürzer als vorher: "Gerät in HA öffnen" und "Integration in HA öffnen". Er öffnet die Seite der Integration dieses Geräts in Home Assistant (zum Beispiel die ESPHome-Seite bei einem ESPHome-Gerät) und schliesst das Popup; bei ungespeicherten Änderungen fragt er zuerst nach, wie bei der Geräteseite. Geräte ohne Integration haben den Knopf nicht.

### Geändert

- Geräte-Popup: der Knopf "HA-Geräteseite öffnen" heisst jetzt **"Gerät in HA öffnen"** (kürzer, im gleichen Schema wie der Knopf zur Integration).

## [2.83.0] - 2026-10-17

Neuer Gerätetyp "Display".

Nicht veröffentlicht; enthalten in 2.84.0.

### Hinzugefügt

- Neuer Gerätetyp **Display** (Bildschirm-Symbol) für Anzeigen, zum Beispiel ein ESPHome-Display. Eine automatische Erkennung gibt es nicht (ein Display hat in Home Assistant keine eigene Entitätsart, ein Raten läge oft falsch): Den Typ legst du von Hand am Gerät fest (Popup, Reiter "Einstellungen") oder für eine ganze Integration (Einstellungen, "Gerätetypen"). Er erscheint wie die anderen Typen in der Liste, im Filter und bei den Ausschlüssen, auf Deutsch und Englisch. Die Reihenfolge der Typen: "Display" steht nach "Medien".

### Geändert

- Übersicht, Kachel "Gerade ausgefallen": Die Zeile unten ("Keine Warnungen") erscheint nicht mehr, solange Geräte ausgefallen sind und keines eine Warnung hat. Warnungen zählen nur Geräte, die online sind (schwacher Empfang, niedrige Batterie, instabil), darum las sich "Keine Warnungen" direkt unter einem Ausfall als Widerspruch. Mit Warnungen bleibt die Zeile; sind alle Geräte online, steht weiter "Keine Warnungen".

## [2.82.0] - 2026-10-17

Geräte-Popup, Reiter "Entitäten": den Link zum Gerät kopieren.

Enthält die Änderungen von 2.81.0.

### Hinzugefügt

- Geräte-Popup, Reiter "Entitäten": ganz am Ende der Abschnitt **Link zu diesem Gerät** mit zwei Zeilen. **Link kopieren** kopiert die Adresse, mit der du gerade in Home Assistant bist, plus `/device-panel?device=<id>`; öffnet man ihn, zeigt das Panel dieses Gerät (derselbe Deep-Link wie beim Push). **App-Link kopieren** kopiert `homeassistant://navigate/device-panel?device=<id>`, die Form für die Home-Assistant-App. Ein Tipp zeigt ein Häkchen. Die Links werden beim Zeichnen und beim Kopieren zusammengesetzt, passen also immer zur benutzten Adresse. Grenzen: Von unterwegs geht ein Link nur, wenn seine Adresse von aussen erreichbar ist; ob der App-Link die Home-Assistant-App öffnet, hängt vom Handy ab (die Form folgt der Dokumentation der App, auf einem Handy nicht getestet).

## [2.81.0] - 2026-10-17

App-Launcher: Knopf "Home Assistant neu starten" mit Rückfrage.

Nicht veröffentlicht; enthalten in 2.82.0.

### Hinzugefügt

- App-Launcher (nur Administratoren): Ein Ein/Aus-Knopf in der Kopfzeile, links von "Bearbeiten", startet Home Assistant neu. Er fragt immer zuerst in einem eigenen Fenster ("Home Assistant neu starten?", mit dem Hinweis, dass Integrationen, Routinen und Verbindungen einige Minuten nicht verfügbar sind); die sichere Antwort "Abbrechen" hat den Fokus, Escape bricht ebenfalls ab. Erst "Neu starten" ruft den Dienst `homeassistant.restart` auf. Das Recht (nur Administratoren) prüft Home Assistant selbst, und es lehnt den Neustart bei ungültiger Konfiguration ab; die Ablehnung erscheint als Hinweis im Launcher. Die abbrechende Verbindung während des Neustarts ist kein Fehler. Im Bearbeiten-Modus und für Benutzer ohne Administratorrecht fehlt der Knopf.

## [2.80.0] - 2026-10-17

Routinen können Zahlen und Auswahlen setzen; ein hängender Schaltbefehl endet nach 45 Sekunden.

### Hinzugefügt

- Routinen: neue Aktion **Setzen** für `number`- und `select`-Entitäten (zum Beispiel die Helligkeit eines Displays oder eine Betriebsart). Der Assistent zeigt bei einer Zahl einen Regler und ein Zahlenfeld mit Einheit und erlaubtem Bereich, bei einer Auswahl Knöpfe (bei mehr als fünf Werten eine Liste); der Wert wird gegen Bereich und Optionen der Entität geprüft. Eine solche Routine geht nur mit **Wie vorher** zurück (der Wert direkt vor dem Schalten wird wiederhergestellt); ein Gegenteil gibt es nicht. Testknopf, Vorschau, Sätze und Push ("Helligkeit auf 60 % gesetzt · 14:32") kennen die neue Aktion. `button`-Entitäten sind nicht enthalten.
- Geräte-Popup, Reiter "Schalter": `number`- und `select`-Entitäten erscheinen ebenfalls als Kacheln (Zustand sichtbar, ein Tipp öffnet die Bedienung von Home Assistant; die Kachel schaltet nichts).

### Geändert

- Routinen: Jeder Schaltbefehl endet nach **45 Sekunden** (fest, ohne Einstellung). Ein Befehl, der nicht antwortet (zum Beispiel ein Cloud-Gerät), zählt als Fehler mit dem Grund "keine Antwort des Geräts" und wird nach 5 Minuten höchstens zweimal wiederholt; andere Routinen warten nicht mehr darauf. Grenze: Home Assistant führt einen abgebrochenen Dienstaufruf weiter aus, ein sehr langsames Gerät kann also trotzdem spät schalten.

### Behoben

- Reiterleisten (die gleitende Kapsel): Wurde die Leiste gleich nach einem Tipp neu gezeichnet (zum Beispiel weil im Status-Fenster frische Daten eintrafen), sprang die Kapsel an den Ausgangspunkt zurück und fuhr neu los, es sah aus wie ein Hin- und Herspringen. Sie fährt jetzt von der Stelle weiter, an der sie wirklich steht. Behebt das Springen im Status-Fenster und an jeder anderen Stelle mit Reiterleisten.

## [2.79.0] - 2026-10-16

Fenster "Routinen": der Schalter "Alle Routinen pausieren" steht ganz oben.

### Hinzugefügt

- Fenster "Routinen" (Blitz in der Kopfzeile): Ganz oben steht **Alle Routinen pausieren**, derselbe Schalter wie in den Einstellungen unter "Routinen". Er gilt sofort, ohne "Speichern", und beide Orte zeigen denselben Stand (Option `routines_pause`). Ist die Pause an, steht darunter in Warnfarbe "Pausiert: Es schaltet nichts, bis du wieder einschaltest. Die Routinen überspringen ihre Zeiten."; sonst die kurze Erklärung. Schlägt das Speichern fehl, erscheint die Fehlermeldung im Fenster und der Schalter bleibt, wie er war.
- Die Antwort von `device_panel/routine_list` nennt den Stand als `paused`, damit das Fenster ihn ohne zweiten Aufruf zeigt.

### Behoben

- Fenster "Routinen" und "Magic Push": Wurde das Fenster geschlossen und gleich wieder geöffnet, konnte das verzögerte Schliessen-Ereignis den Stand des neuen Öffnens löschen (die Liste blieb dann ohne Reaktion auf Tipps). Es löscht ihn nur noch, wenn das Fenster zu ist.

## [2.78.0] - 2026-10-16

Einstellungen, Überwachung und Meldungen: Die Reiter "Laden" und "Empfang" enden wie die anderen mit einem Abschnitt "Abweichungen".

Enthält die Änderungen von 2.77.0.

### Hinzugefügt

- Reiter "Laden": Am Ende steht neu der Abschnitt **Abweichungen** mit dem Kasten "N Integrationen weichen ab" (mit den Werten, zum Beispiel "Shelly: Laden an (voll ab 90 %)", und dem Sprung zu "Integrationen") und der Liste **"Eigene Werte der Lademeldung auf Geräten"**. Bisher sah man in den Einstellungen nicht, auf welchen Geräten die Lademeldung vom Standard abweicht. Die Liste zeigt je Gerät alle eigenen Werte (Laden an oder aus, voll ab, Anstieg, Ende nach, Push bei Ende, Live), mit Bereich und Integration. Ein Kreuz setzt ein Gerät zurück, "Alle zurücksetzen" alle; zurückgesetzt wird wie bei den anderen Reitern erst beim Speichern, danach gelten wieder die Integration bzw. die globalen Werte. Der Abschnitt steht auch bei ausgeschalteter Lademeldung da, weil Geräte trotzdem eigene Werte haben können. Er steht ganz unten, nach der Liste "Pro Integration".
- Unter "Geräte im Panel" › "Geräte-Einstellungen" und im Detail einer Integration steht dieselbe Liste für die Lademeldung neben den anderen. Auf der Übersicht führt "N Geräte" in der Zeile "Laden" jetzt zu diesem Reiter und zählt alle Geräte mit eigenen Lade-Werten (bisher nur die mit eigenem Schalter).
- Neue Antwort-Liste `overrides.charge` in `get_options` und neuer Parameter `charge` bei `device_panel/reset_device_settings` (nimmt alle eigenen Lade-Werte der genannten Geräte zurück; die Antwort zählt auch `charge`).

### Geändert

- Reiter "Empfang": Im Abschnitt "Abweichungen" steht nun wie bei Ausfall, Batterie und Neu zuerst der Kasten "N Integrationen weichen ab", dann die Liste der Geräte mit eigener Schwelle.
- Lange Werte in der Liste (Lademeldung mit mehreren eigenen Werten) stehen unter dem Namen des Geräts über die ganze Breite, damit der Name nicht gequetscht wird.
- Der Reiter "Neu" bleibt, wie er ist: Dort gibt es keine Werte pro Gerät, nur den Kasten der Integrationen.

## [2.77.0] - 2026-10-16

Nicht veröffentlicht; enthalten in 2.78.0.

Status-App: die Mindestdauer der Meldung bei hoher Auslastung gilt je Art (Prozessor, Arbeitsspeicher, Festplatte), der Empfänger hat einen eigenen Abschnitt.

### Geändert

- Status-App, Einstellungen, "Meldung bei hoher Auslastung": Die **Mindestdauer** ist nicht mehr eine Zahl für alle, sondern gilt je Art. Unter der Grenze von Prozessor, Arbeitsspeicher und Festplatte steht eine eigene Zeile "Mindestdauer" (1 bis 60 Minuten, Standard je 3). Die Anforderungen sind verschieden: ein Prozessor darf kurz auf 100 % springen, eine Festplatte sollte gleich gemeldet werden. Ein Fehler (leer, keine ganze Zahl, ausserhalb 1 bis 60) zeigt sich im Block der betroffenen Art und sperrt "Speichern". Neue Optionen `status_cpu_minutes`, `status_ram_minutes` und `status_disk_minutes`; die bisherige gemeinsame Option `status_load_minutes` entfällt. Wer sie gesetzt hatte, behält den Wert beim ersten Start für alle drei Arten (eine bereits gesetzte eigene bleibt), danach lässt er sich einzeln ändern. Der Hinweis unter dem Abschnitt nennt keine Zahl mehr.
- Status-App, Einstellungen: Der **Empfänger** hat einen eigenen Abschnitt "Empfänger der Meldungen" ganz oben. Er gilt für alle Meldungen der Status-App (bei Stillstand und bei hoher Auslastung); vorher stand die Auswahl unter "Meldung bei Stillstand", obwohl sie auch die Meldung bei hoher Auslastung betrifft. Darunter folgen "Meldung bei Stillstand" (nur noch der Schalter), "Meldung bei hoher Auslastung" und die Quelle der Werte. Die Warnung "Es ist kein Ziel gewählt" steht beim Empfänger und nennt nun auch die hohe Auslastung. Keine Änderung an den gespeicherten Optionen (`notify_service_status` bleibt).

## [2.76.0] - 2026-10-16

Die App "Status" lässt sich nicht mehr ausblenden.

### Geändert

- App-Launcher, Bearbeiten: Die App **Status** bekommt wie das Protokoll ein Schloss statt des Auges. Sie lässt sich nicht mehr ausblenden, weil dort die Einstellungen der Meldungen liegen (bei Stillstand und bei hoher Auslastung, Empfänger, Quelle der Werte). Verschieben und als Favorit wählen geht weiterhin. Hatte jemand sie schon ausgeblendet, ist sie wieder sichtbar. **Routinen** und **Magic Push** lassen sich weiterhin mit dem Auge ausblenden und sind standardmässig sichtbar. Der Hinweis am Schloss nennt den Grund je App.

## [2.75.0] - 2026-10-16

Magic Push ist eine eigene App mit eigenem Fenster und nicht mehr ein Reiter in den Einstellungen.

Enthält die Änderungen von 2.74.0.

### Geändert

- Magic Push: Die Übersicht aller Meldungen aller Geräte ist aus den Einstellungen ("Überwachung und Meldungen", Reiter "Magic Push") ausgezogen und öffnet als **eigenes Fenster**, wie "Alle Routinen": Glocke im Kopf, Titel "Magic Push", Untertitel "Alle Geräte", Kreuz zum Schliessen. Es sind keine Einstellungen im eigentlichen Sinn, die Meldungen gehören den Geräten und werden sofort gespeichert. Inhalt und Bedienung sind unverändert: eine Karte pro Gerät, Suche, Filter (Alle, An, Aus, Ausgelöst), Karten ein- und ausklappen, ein- und ausschalten, bearbeiten (öffnet das Fenster des Assistenten), löschen mit Rückfrage und "Gerät öffnen". Neue Meldungen legt man weiterhin im Popup des Geräts an, im Reiter "Magic Push". Das Fenster lädt die Liste nach, wenn ein Geräte-Popup geschlossen wird; nach dem Schliessen und erneuten Öffnen ist die Suche leer.
- Die App "Magic Push" im Launcher öffnet dieses Fenster (vorher die Einstellungen beim Reiter "Magic Push").
- Einstellungen, "Überwachung und Meldungen": Der Reiter "Magic Push" entfällt, es bleiben acht Reiter (Übersicht, Ausfall, Batterie, Laden, Neu, Updates, Empfang, Integrationen), auf dem Desktop in vier Spalten und zwei Zeilen. Auch der Eintrag in der Suche der Einstellungen ist weg.
- README: Das Bild der Übersicht zeigt das neue Fenster (`magic-all.png`, vorher `settings-magic.png`); das Bild der Einstellungen mit den Reitern ist neu aufgenommen.

## [2.74.0] - 2026-10-16

Nicht veröffentlicht; enthalten in 2.75.0.

Fenster "Alle Routinen": jede Routine lässt sich dort ausführen; Meldung bei hoher Auslastung mit Mindestdauer; Korrekturen aus dem Prüfbericht (Routinen, Push, Texte).

### Hinzugefügt

- Fenster mit allen Routinen (Blitz in der Kopfzeile): Jede Routine hat neben "Bearbeiten" einen Knopf **Ausführen**, wie im Popup des Geräts. Er schaltet sofort, ohne Rückfrage, auch wenn die Routine ausgeschaltet ist; der Zeitplan bleibt, wie er ist, ein Zurückschalten wird geplant. Das Ergebnis steht in der Karte dieser Routine ("Ausgeführt." grün oder "Konnte nicht schalten: …" rot, zum Beispiel "nicht erreichbar"), nicht oben in der langen Liste; die nächste Aktion im Fenster räumt es weg. Die Einleitung des Fensters nennt es mit.
- Status-App, Einstellungen, "Meldung bei hoher Auslastung": neue Zeile **Mindestdauer** (1 bis 60 Minuten, Standard 3, für Prozessor, Arbeitsspeicher und Festplatte). Der Wert muss bei so vielen Prüfungen in Folge (eine Prüfung je Minute) auf oder über der Grenze liegen, bevor der Push kommt; 1 meldet bei der ersten Prüfung, eine höhere Zahl übergeht längere Spitzen. Bisher war es fest 3. Neue Option `status_load_minutes`. Der Hinweis unter dem Abschnitt nennt die aktuelle Zahl.

### Geändert

- Handy: Die Aktionen unter einer Routine oder einer Magic-Push-Regel (Bearbeiten, Ausführen, Löschen, Herz) sind seitlich etwas schmaler (7 statt 12 px), damit die vier auf 390 px in eine Zeile passen; die Höhe von 44 px für den Finger bleibt.
- App-Launcher, Bearbeiten-Liste: Die Zeile "Läuft das Panel?" unter "Status" entfällt (die anderen Apps behalten ihre Zeile).
- Push: Bei Zusatzdaten (Tag, Link) wird ein **vorübergehender** Fehler (Netz, Zeitüberschreitung) nach 2 Sekunden einmal mit denselben Daten wiederholt; bisher ging der zweite Versuch immer ohne sie hinaus, die Entwarnung ersetzte dann die erste Meldung nicht und ein Tipp öffnete die App nicht. Nur wenn das Ziel die Zusatzdaten **ablehnt** (zum Beispiel Telegram, E-Mail), folgt wie bisher gleich die schlichte Meldung; scheitert auch die Wiederholung, geht sie als letzter Ausweg schlicht hinaus.
- Status-Fenster: Es fragt nicht mehr alle 10 Sekunden nach, solange das Panel verdeckt ist (wie die Liste der Geräte).
- Tests: Die Unit-Tests behandeln veraltete Aufrufe (Deprecation-Warnungen) aus dem eigenen Code der Integration als Fehler (die von Home Assistant selbst bleiben aus), damit so etwas wie bei 1.31.1 auffällt; neue Tests für die Punkte dieses Abschnitts.
- Aufgeräumt: 14 ungenutzte Texte sowie 7 ungenutzte Code-Teile (Python) und Variablen (JavaScript) entfernt; am Verhalten ändert sich nichts.

### Behoben

- Status-App, Reiter "System": Die Kurven von Prozessor und Arbeitsspeicher zeigen eine kurze Spitze. Bisher war jeder Abschnitt der Kurve (etwa 5 Minuten) das Mittel seiner Werte, sodass eine Spitze von ein paar Minuten bei 100 % wie 30 bis 60 % aussah, während "Spitze 100 %" unter der Kurve die Rohwerte nahm. Jetzt zeigt jeder Abschnitt seinen höchsten Wert; der Durchschnitt unter der Kurve bleibt. Festplatte und die längeren Zeiträume bleiben wie sie waren.
- Routinen: Ein Schaltbefehl, der nicht antwortet (zum Beispiel ein Cloud-Gerät), lässt andere Routinen, die gleichzeitig fällig sind, nicht mehr "verpasst" werden. Sie warteten auf die Sperre und zählten ihre Verspätung ab dem Moment, in dem sie sie bekamen; nach mehr als der Nachholzeit (Standard 10 Minuten) wurden sie übersprungen und nie geschaltet. Die Verspätung zählt jetzt ab dem Zeitgeber; eine solche Routine läuft spät statt nie. Eine Routine, die wirklich zu spät dran ist (Home Assistant war aus), gilt weiter als verpasst.
- Filter "Integration": Der Eintrag für Geräte ohne Integration hiess "Keine Integrationen." statt "Ohne Integration" (ein Text-Schlüssel war doppelt definiert). Die leere Liste behält "Keine Integrationen."; ein Test findet doppelte Text-Schlüssel jetzt.
- Status-Meldungen: Die Uhrzeit im Push ("… · 14:32") steht in der Zeitzone von Home Assistant, nicht mehr in der des Systems (in einem Container ohne Zeitzone war es UTC).

## [2.73.0] - 2026-10-16

Status-App: drei Reiter, "Dienste", "System" und "Einstellungen"; die Meldung bei hoher Auslastung öffnet "System".

### Geändert

- Status-App: Die Grafiken haben einen eigenen Reiter. Die Reiter heissen jetzt **Dienste** (die Teile der Integration mit ihren Pillen und Neustart-Knöpfen; das war "Zustand"), **System** (Prozessor, Arbeitsspeicher und Festplatte als Grafiken, ohne eigene Überschrift) und **Einstellungen** (unverändert: Meldungen, Grenzen, Quelle der Werte, gespeichert mit "Speichern"). Das Fenster öffnet auf "Dienste". Die Systemwerte werden nur geholt, solange "System" oder "Einstellungen" offen ist, nicht mehr alle 60 Sekunden im Hintergrund.
- Der Push bei hoher Auslastung öffnet die Status-App gleich im Reiter "System": Sein Link ist `/device-panel?app=status&tab=system`. Der Push bei einem stehenden Teil öffnet weiter "Dienste". Der Parameter `tab` (`services`, `system`, `settings`) verschwindet danach aus der Adresse, wie `app`.
- Status-App: Die Zeile "Läuft das Panel?" unter dem Titel des Fensters entfällt; sie passt nicht mehr, seit die App auch das System zeigt.

## [2.72.0] - 2026-10-16

Status-App: zwei Reiter, "Zustand" und "Einstellungen"; die Einstellungen gelten erst nach "Speichern".

### Hinzugefügt

- Status-App, neue Reiterleiste "Zustand" | "Einstellungen". "Zustand" behält, was man ansieht (die Teile mit ihren Pillen, die Neustart-Knöpfe, die drei Grafiken). "Einstellungen" enthält alles, was sich ändern lässt: "Meldung bei Stillstand" (Schalter und Empfänger), "Meldung bei hoher Auslastung" (Schalter und Grenze für CPU, Arbeitsspeicher und Festplatte) und "Quelle der Werte" (automatisch oder ein eigener Sensor). Beim Öffnen steht der Reiter auf "Zustand".
- Speichern ist Absicht: Ein Schalter, eine Grenze, der Empfänger oder ein gewählter Sensor ist nur ein Entwurf, bis "Speichern" gedrückt wird; dann geht alles in einem Aufruf (`set_options`) hinaus, und das Fenster bleibt offen mit "Gespeichert". Die Leiste unten zeigt die Zahl der offenen Änderungen ("1 Änderung", "2 Änderungen"), "Speichern" (nur aktiv, wenn etwas geändert ist und alle Grenzen gültig sind) und "Verwerfen" (zurück auf die gespeicherten Werte); ohne Änderung heisst der zweite Knopf "Schliessen". Solange es ungespeicherte Änderungen gibt, zeigt ein Punkt am Reiter "Einstellungen" das im Reiter "Zustand". Wer das Fenster schliesst (Kreuz, Klick daneben, Esc) oder die Seite "System Monitor" öffnet, wird bei ungespeicherten Änderungen zuerst gefragt "Änderungen verwerfen?". Ein Wert, der wieder dem gespeicherten gleicht, zählt nicht als Änderung.

### Geändert

- Bisher wurde jeder Schalter, der Empfänger, jede Grenze und jeder gewählte Sensor sofort gespeichert. Das entfällt: Es ändert sich nichts, bevor "Speichern" gedrückt ist. Eine ungültige Grenze (leer, keine ganze Zahl, ausserhalb von 1 bis 100) zeigt weiterhin den Fehler am Feld und sperrt jetzt zusätzlich "Speichern".
- Die Hinweise auf den Karten "Kein Sensor gefunden" verweisen auf den Reiter "Einstellungen" statt auf "unten".

## [2.71.0] - 2026-10-16

Status-App: Push bei hoher Auslastung von CPU, Arbeitsspeicher und Festplatte; die Pille "Debug" überlappt das Symbol nicht mehr.

### Hinzugefügt

- Meldung bei hoher Auslastung: In der Status-App steht unter "Meldung bei Stillstand" ein neuer Abschnitt "Meldung bei hoher Auslastung" mit je einer Zeile für **Prozessor (CPU)**, **Arbeitsspeicher (RAM)** und **Festplatte**: ein Schalter (Standard an) und eine Grenze in Prozent (Standard 99, frei von 1 bis 100). Ein Push, wenn der Wert **3 Minuten in Folge** auf oder über der Grenze liegt (kurze Spitzen melden nichts, geprüft wird jede Minute): "⚠️ Device Panel: Prozessor bei 99 %". Liegt er klar wieder darunter (mindestens 2 Punkte, 2 Prüfungen lang), folgt eine Entwarnung, "✅ Device Panel: Prozessor wieder unter 99 %", die die erste Meldung ersetzt. Ein Wert, der um die Grenze pendelt, piept nicht dauernd. Ein Tipp auf die Meldung öffnet die Status-App. Empfänger ist derselbe wie bei "Bei Stillstand melden" (eigenes Ziel oder der Standard); die Warnung "Es ist kein Ziel gewählt" gilt jetzt auch für diese Meldungen. Das Protokoll hält beide Meldungen fest. Der Wert ist der, den die Karte zeigt (eigener Sensor oder automatisch gefunden; ein Sensor in Gigabyte mit bekannter Gesamtgrösse wird in Prozent umgerechnet). Nur Werte in Prozent lassen sich vergleichen: bei einem Sensor in Gigabyte ohne Gesamtgrösse oder ohne Sensor gibt es keine Meldung, und die Zeile sagt es. Neue Optionen `status_cpu_alert`, `status_ram_alert`, `status_disk_alert` (Standard an) und `status_cpu_limit`, `status_ram_limit`, `status_disk_limit` (Standard 99). Eine ungültige Grenze zeigt einen Fehler am Feld und wird nicht gespeichert. Grenze: Eine Meldung, die beim Neustart von Home Assistant offen ist, wird erneut gesendet, wenn der Wert nach 3 Minuten noch zu hoch ist.

### Behoben

- App-Launcher: Die Pillen "Debug" und "Störung" an einer Kachel sitzen nicht mehr auf dem Symbol. Sie stehen jetzt mittig darüber (die Kachel hat oben mehr Platz), am Desktop wie auf dem Handy.

## [2.70.1] - 2026-10-16

Nicht veröffentlicht; enthalten in 2.71.0.

Status-App, System: nach dem Einschalten von Sensoren scheint nichts mehr verloren.

### Geändert

- Der Knopf "Sensoren einschalten" fragt zuerst: Er listet die Sensoren (Name und Entität), sagt, was geschieht (nur die Sensoren selbst werden eingeschaltet, nichts wird gelöscht, vorhandene Verläufe bleiben, Home Assistant lädt die Integration nach etwa 30 Sekunden neu und die Sensoren sind kurz nicht verfügbar) und wie man es rückgängig macht (Einstellungen, Geräte & Dienste, Entitäten). "Abbrechen" ändert nichts.

### Behoben

- Gleich nach dem Einschalten sagte die Karte "Der gewählte Sensor existierte nicht mehr." Ein eben eingeschalteter Sensor hat keinen Zustand, bis Home Assistant die Integration neu geladen hat. Jetzt bleibt die Karte bei dem Sensor mit Werten (bei der Festplatte "Belegter Massenspeicher" in Gigabyte) und wechselt zum neuen, sobald er einen Zustand hat; gibt es nur den neuen, sagt sie, dass er gerade neu lädt (kein Fehler). Ein gewählter Sensor, der in Home Assistant ausgeschaltet ist, wird als solcher gemeldet.
- Festplatte: Ein frisch eingeschalteter Prozent-Sensor hat erst ab jetzt Werte, die Kurve sah leer aus ("Verlauf verloren"). Sind "Belegter" und "Freier Massenspeicher" an, wird der längere Verlauf von "belegt" in Prozent umgerechnet, solange er weiter zurückreicht als der des Prozent-Sensors. Gelöscht wurde nie etwas.

## [2.70.0] - 2026-10-16

Status-App, System: die Festplatten-Sensoren finden, Entitäten mit Suche wählen, Uhrzeiten in den Grafiken.

### Hinzugefügt

- Sensor mit Suchfeld wählen: Unter "Quelle der Werte" öffnet jede Art eine Liste von **Sensor-Entitäten** (Name und darunter `sensor.…`, keine Geräte) mit dem gewohnten Suchfeld samt X; "Automatisch" bleibt oben. Angeboten werden alle Sensoren mit Zahl und Einheit, die naheliegenden (Prozent ohne Geräteklasse; bei der Festplatte auch Grössen in Byte) zuerst, den Rest findet die Eingabe. Vorher konnte eine einfache Auswahlliste, die bei 200 Einträgen abbrach, Sensoren wie `sensor.system_monitor_arbeitsspeicherauslastung` oder `sensor.system_monitor_belegter_massenspeicher` nicht zeigen.
- Festplatte ohne Prozent-Sensor: "System Monitor" legt "Massenspeicher-Auslastung" (Prozent) ausgeschaltet an, oft ist nur "Belegter Massenspeicher" in Gigabyte an. Die Karte findet diesen Sensor jetzt von selbst. Ist auch "Freier Massenspeicher" an, rechnet sie den Prozentwert (belegt / (belegt + frei)) und zeigt die Grösse; mit nur "Belegter Massenspeicher" zeigt die Karte die Gigabyte (zum Beispiel "318,4 GiB") mit eigener Achse statt Prozent. Auch die Sensoren der Supervisor-Integration ("Host disk used" und "total") dienen, wenn es kein System Monitor gibt. Für die Festplatte lässt sich auch jeder Sensor in Byte oder mit anderer Einheit wählen; die Karte zeigt dann seine Einheit.
- Sensoren, die es gibt, die aber ausgeschaltet sind (System Monitor und der Supervisor legen die meisten so an): Die Karte nennt sie und hat den Knopf "Sensoren einschalten". Nur auf diesen Druck, nur Sensoren von System Monitor und Supervisor; Home Assistant lädt die Integration danach selbst neu, die Werte erscheinen nach etwa einer Minute. Neuer WebSocket-Befehl `device_panel/status_system_enable` (Administratoren, Parameter `kind`).
- "System Monitor" nicht eingerichtet: Die Karte sagt es und dass es nicht zwingend ist (ein eigener Sensor lässt sich wählen); ein Knopf "System Monitor hinzufügen" öffnet die Seite "Integration hinzufügen" von Home Assistant bei dieser Integration (er öffnet nur die Seite, nichts wird geändert). `device_panel/status_system` liefert dafür `integrations` (`systemmonitor`, `hassio`).
- Grafiken mit Zeitstrahl: Uhrzeiten unter der Kurve (alle 3 Stunden bei 24 Stunden, Tage bei 30 Tagen, Monate bei 6 Monaten und 1 Jahr) mit feinen senkrechten Linien und "jetzt" rechts.

### Geändert

- `device_panel/status_system`: Jede Karte trägt `mode` (`percent` oder `absolute`), `unit`, `axis_max` und `disabled`; `candidates` tragen `unit` und `pref`.

## [2.69.0] - 2026-10-16

Status-App: die Festplatte in Gigabyte und in Prozent.

### Hinzugefügt

- Status-App, Karte "Festplatte": unter dem Prozentwert die Grösse, zum Beispiel "318,4 von 530,7 GiB belegt · 212,3 GiB frei" (die Einheit, wie Home Assistant sie meldet, GiB; ab 1024 GiB in TiB). Die Zahlen kommen von den Sensoren "Belegter Massenspeicher" und "Freier Massenspeicher" der Integration "System Monitor" für dieselbe Platte (gesamt = belegt + frei). Ohne diese zwei Sensoren (sie können standardmässig aus sein) zeigt die Karte nur Prozent, mit einem Hinweis, welche Sensoren einzuschalten sind. Mit einem eigenen Sensor für die Festplatte gibt es keine Grösse. `device_panel/status_system` liefert sie als `size` (`used`, `free`, `total`, `unit`) im Eintrag der Festplatte.

## [2.68.0] - 2026-10-16

Status-App: kleine Grafiken für CPU, Arbeitsspeicher und Festplatte.

### Hinzugefügt

- Status-App, neuer Abschnitt "System": drei Karten mit dem aktuellen Wert und einer kleinen Grafik aus dem Recorder. **Prozessor (CPU)** und **Arbeitsspeicher (RAM)** zeigen die letzten 24 Stunden; die **Festplatte** hat eine Leiste mit 24 Stunden, 30 Tagen, 6 Monaten oder 1 Jahr (lange Zeiträume kommen aus der Langzeitstatistik des Recorders: Stundenmittel, ab 6 Monaten Tagesmittel). Jede Karte zeigt "vor 24 Std." bis "jetzt" sowie Durchschnitt und Spitze des Zeitraums. Das Panel zeichnet selbst nichts auf: Die Werte kommen von Sensoren, die Home Assistant schon hat.
- Die Sensoren werden automatisch gefunden: zuerst die Integration "System Monitor" (Prozessor, Arbeitsspeicher und Festplatte in Prozent, der Host), für CPU und Arbeitsspeicher sonst die Werte von Home Assistant Core aus der Supervisor-Integration (gekennzeichnet "Home Assistant Core (nur der Prozess)", weil sie nicht den Host messen). Mehrere Festplatten: die Hauptplatte ("/") zuerst. Wird nichts gefunden, sagt ein Hinweis auf jeder Karte, dass "System Monitor" einzuschalten ist. Unter "Quelle der Werte" lässt sich jede Art stattdessen auf einen eigenen Sensor stellen (jeder Sensor in Prozent mit Zustandsklasse); gespeichert als Optionen `status_cpu_entity`, `status_ram_entity` und `status_disk_entity` (leer = automatisch). Ein gewählter Sensor, den es nicht mehr gibt, wird gemeldet und nicht stillschweigend ersetzt.
- Neuer WebSocket-Befehl `device_panel/status_system` (Administratoren; Parameter `range`: `24h`, `30d`, `6m`, `1y`, nur für die Festplatte). Das Fenster fragt alle 60 Sekunden neu.

## [2.67.0] - 2026-10-16

Nicht veröffentlicht; enthalten in 2.68.0.

Routinen-Assistent: keine zweite Auswahl, nachdem eine Szene oder Gruppe gewählt wurde.

### Geändert

- Routinen-Assistent: Eine Szene oder Gruppe, die auf der ersten Seite gewählt wurde, wird nicht noch einmal abgefragt. Bei einer **Szene** gibt es nichts mehr zu bestimmen (die einzige Aktion ist "Aktivieren"), darum entfällt die Seite "Was": Nach der ersten Seite geht es gleich zu "Wann" (vier Seiten statt fünf). Eine **Gruppe** behält eine Seite, die jetzt "Aktion" heisst und fragt "Was soll mit "<Name>" geschehen?": nur Einschalten / Ausschalten / Umschalten, keine Liste aller Gruppen mehr. Beim Bearbeiten einer Routine bleibt die Seite "Was" mit ihrer Liste wie bisher.

## [2.66.0] - 2026-10-16

Routinen-Assistent: eine Liste mit Filter und Pille; die Statusmeldung öffnet die Status-App.

### Hinzugefügt

- Statusmeldung: Ein Tipp auf die Push-Meldung "⚠️ Device Panel: <Teil> steht" (und auf "✅ … läuft wieder") öffnet jetzt direkt die Status-App statt der Übersicht. Der Link ist `/device-panel?app=status`; er wird danach aus der Adresse entfernt, wie `?device=`. Die App bekommen nur Administratoren (wie im Launcher).

### Geändert

- Routinen-Assistent, erste Seite ("Gerät, Gruppe oder Szene?"): Jedes Gerät, jede Gruppe und jede Szene steht als eigene Zeile in der Liste, ohne dass man zuerst suchen muss (Geräte, dann Gruppen, dann Szenen). Die Sammeleinträge "Szenen" und "Gruppen" entfallen. Eine Filterleiste oben (Alle, Geräte, Gruppen, Szenen, je mit ihrer Zahl) schränkt die Liste ein; sie erscheint nur, wenn es Gruppen oder Szenen ohne Gerät gibt. Gruppen und Szenen tragen rechts eine kleine Pille ("Gruppe" / "Szene"), Geräte behalten "N Entitäten". Die Suche arbeitet über den gewählten Filter und findet ein Gerät weiter über die Szenen und Lampen darin. Ein Tipp und "Weiter" führen auf die Seite "Was" mit der Szene oder Gruppe schon gewählt. Die Grenze von 40 Zeilen aus 2.65.0 entfällt, der Filter ersetzt sie.

## [2.65.0] - 2026-10-16

Routinen-Assistent: Jede Szene und Gruppe wird direkt über ihren Namen gefunden.

### Geändert

- Routinen-Assistent, erste Seite ("Gerät, Gruppe oder Szene?"): Wer in der Suche einen Namen tippt, sieht jetzt jede passende Szene und Gruppe als eigene Zeile (mit ihrem Symbol und rechts der Art "Szene" oder "Gruppe"), nicht mehr nur die Sammeleinträge "Szenen" und "Gruppen". Ein Tipp und "Weiter" führen auf die Seite "Was" mit der Szene oder Gruppe schon gewählt und der Aktion gesetzt. Niemand muss die Wörter "Szene" oder "Gruppe" mehr kennen; Helfer-Gruppen (Gruppen-Integration) werden genauso gefunden. Ohne Suche bleibt die Liste kurz (Geräte, dann "Szenen" und "Gruppen"). Die Suche zeigt höchstens 40 solche Zeilen und nennt, wie viele Treffer weiter vorhanden sind. Die Geräteliste des Servers (`routine_devices`) liefert die Einzeleinträge bei den Sammeleinträgen als `items` (`id`, `name`).

## [2.64.0] - 2026-10-16

Einstellungen: bei jedem Öffnen nach einer neuen Version suchen.

### Geändert

- Einstellungen, Abschnitt "Panel-Version": Bei jedem Öffnen der Einstellungen fragt das Panel jetzt sofort bei GitHub nach der neuesten Version (bisher galt die Antwort von bis zu 6 Stunden vorher, ausser du drücktest "Nach Updates suchen"). Während der Prüfung läuft die gewohnte Anzeige "Prüft". Der Server fragt GitHub weiter höchstens einmal pro Minute, mehrmaliges Öffnen kurz hintereinander verbraucht also das Limit von GitHub nicht; der Knopf "Nach Updates suchen" arbeitet wie bisher. Das Öffnen lädt HACS nicht von sich aus neu und verwirft keinen früheren Installationsfehler; läuft gerade eine Installation oder ein Neustart, bleibt der aktuelle Stand stehen. Kennt GitHub eine neuere Version als HACS, wird HACS einmal für diese Version neu geladen, auch wenn sie beim Öffnen gefunden wurde.

### Behoben

- Fenster Release Notes: "Die Release Notes konnten nicht geladen werden: HTTP 404" bei Releases, deren Tag kein "v" trägt (zum Beispiel 2.63.0). Die Notes werden jetzt unter "v2.63.0" und unter "2.63.0" gesucht, in den Changelog-Dateien wie im GitHub-Release-Text.

## [2.63.0] - 2026-10-15

Status: einen Teil von Hand neu starten.

### Hinzugefügt

- App "Status": Ein Teil, der "verspätet" ist oder "steht", hat einen Knopf "Neu starten". Zuerst kommt eine Rückfrage ("<Teil> neu starten?"): Es wird nur dieser Teil der Integration auf einem frischen Objekt neu gestartet, nicht Home Assistant und keine andere Integration, und der gespeicherte Stand bleibt erhalten. Bei den Routinen wird nachgeholt, was fällig war, wenn es noch im Nachhol-Fenster liegt, sonst als verpasst vermerkt. Danach erscheint der Hinweis "<Teil> wurde neu gestartet." und der Zustand folgt; ein fehlgeschlagener Neustart zeigt den Fehler im Fenster und setzt das alte Objekt wieder ein. Der Server lehnt den Neustart eines Teils ab, der läuft, und einen zweiten Neustart innerhalb von 20 Sekunden. Das Protokoll vermerkt jeden Neustart ("Von Hand neu gestartet") und jeden Fehlschlag. Neuer WebSocket-Befehl `device_panel/status_restart` (Administratoren).
- Suchfelder: Jedes Suchfeld hat jetzt denselben Knopf zum Leeren (ein kleines X rechts, nur sichtbar, solange etwas drinsteht): im Routinen-Assistenten (Geräteliste, Entitätenliste, Bedingungs-Suche), im App-Launcher und in der Suche "Freie Entität" von Magic Push; das Protokoll, die Listen der Übersichten und die Hauptsuche hatten es schon. Ein Tipp leert das Feld, die Liste folgt und der Cursor bleibt im Feld. Ein gemeinsamer Mechanismus (`data-fc`) statt eines Handlers pro Feld.
- Automatisch startet nichts neu: Das riskierte doppelte oder verlorene Ausführungen von Routinen und verdeckte die Ursache eines Stillstands.

## [2.62.0] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.63.0.

Neue App "Status": Läuft das Panel?

### Hinzugefügt

- Launcher, neue App "Status" (Gruppe Device Panel, nur für Administratoren, nicht vorgemerkt): zeigt, ob die Teile der Integration laufen, mit Zustand je Teil ("läuft", "verspätet", "steht"), einem Kopf ("Alles läuft" oder "Störung: N Teile") und der Zeile "Integration gestartet: <Zeit> · N Routinen geladen · M verpasst". Die Teile: Routinen (gemessen daran, ob etwas überfällig ist: fällig, aber nicht gelaufen), Ausfall-Überwachung, Batterie, Laden und Empfangsverlauf (je nach Zeit ihres letzten Takts; verspätet ab dem 4fachen des Takts, mindestens 2 Min.; steht ab dem 10fachen, mindestens 5 Min.), Magic Push, Neue Geräte und Updates (ereignisgesteuert, ohne festen Takt: nur ob sie geladen sind). Mockups: `docs/mockups/status-v1`.
- Meldung bei Stillstand: Ein Wächter prüft jede Minute; steht ein Teil bei zwei Prüfungen hintereinander (damit ein Stocken von Home Assistant selbst nicht meldet), kommt ein Push "⚠️ Device Panel: <Teil> steht" und, sobald er wieder läuft, "✅ … läuft wieder" (ersetzt die erste Meldung). Die Meldung steht auch im Protokoll. Oben in der App: Schalter "Bei Stillstand melden" (Standard an) und eine Auswahlliste "Empfänger" wie bei den Reitern der Einstellungen ("Standard (…)" = das globale Ziel, oder ein eigenes Ziel); gespeichert als die Optionen `status_notify` und `notify_service_status`.
- Warnung, wenn nichts gesendet werden kann: Ist der Schalter an, aber weder ein eigenes noch das globale Ziel gewählt, sagt eine rote Zeile unter "Empfänger", dass nichts gemeldet wird.
- Punkte in der Kopfzeile: ein roter Punkt am Launcher-Knopf, wenn ein Teil verspätet ist oder steht, ein oranger Punkt, solange der Debug-Modus läuft (rot geht vor). Ist die App Status (oder das Protokoll) mit dem Herz angeheftet, sitzt der Punkt an ihrem eigenen Knopf statt am Launcher-Knopf. Im Launcher zeigt die App Status eine rote Pille "Störung", wie "Debug" am Protokoll (die Pille "Debug" erscheint jetzt auch, ohne dass das Protokoll zuerst geöffnet wurde).
- `list_devices` trägt `debug` und `status` (Zahlen für die Punkte); neuer WebSocket-Befehl `device_panel/status_get` (Administratoren).
- Grenze: Steht Home Assistant selbst still oder startet neu, kann dieser Wächter es nicht melden; dafür braucht es etwas ausserhalb (zum Beispiel einen externen Ping).

## [2.61.0] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.62.0.

Routinen: Szenen und Gruppen.

### Hinzugefügt

- Routinen-Assistent, "Routine hinzufügen" im Fenster "Alle Routinen": Die erste Seite heisst jetzt "Gerät, Gruppe oder Szene?". Nach den Geräten kommen zwei Einträge ohne Gerät: "Szenen" und "Gruppen". Es erscheinen nur Einträge, in denen etwas steht.
- Szenen (Home Assistant `scene`, ohne Gerät): Die einzige Aktion ist "Aktivieren" (`scene.turn_on`). Eine Szene hat kein Gegenteil, darum gibt es weder die Seite "Zurückschalten" noch eine Optionen-Seite; Zeit oder Auslöser, Zeitfenster, Pause und "nur einmal" gelten wie bei jeder Routine. Push und Protokoll sagen "Szene <Name> aktiviert". "Jetzt ausführen" im Assistenten aktiviert die Szene einmal.
- Gruppen (ein Licht, Schalter, Ventilator … , das in seinem Attribut `entity_id` andere Entitäten aufführt und kein Gerät hat, zum Beispiel eine Lichtergruppe; auch Gruppen der Gruppen-Integration (Helfer) zählen, solange sie nicht erreichbar sind): Sie verhalten sich wie eine einzelne Lampe, mit Ein, Aus, Umschalten, Optionen für Helligkeit und Farbe und Zurückschalten (auch "wie vorher").
- Übersicht und Fenster "Alle Routinen": Routinen von Szenen und Gruppen stehen nach den Geräten in eigenen Karten "Szenen" und "Gruppen" (mit eigenem Symbol, ohne den Link "Gerät öffnen"). Alle Szenen stehen bei "Szenen", auch die eines Geräts (zum Beispiel Hue-Szenen); diese stehen weiter bei ihrem Gerät und in dessen Reiter Routinen. Szenen erscheinen nicht im Reiter "Schalter" des Geräte-Popups.
- Die Suche im Assistenten findet auch die Entitäten in Geräten, "Szenen" und "Gruppen" ("alles" findet die Szene "Alles aus"), und die Seite "Was" hat ab 8 Entitäten ein eigenes Suchfeld (eine Instanz mit 78 Szenen braucht es).
- Die Grenze von 20 Routinen pro Gerät gilt nicht für "Szenen" und "Gruppen" (die Grenze von 200 insgesamt schon).
- Neuer Wert in den Routinen-Daten: `device_id` darf `@scenes` oder `@groups` sein (WebSocket `routine_devices`, `routine_get`, `routine_list`, `routine_save` nehmen sie an). Skripte werden nicht angeboten.

## [2.60.0] - 2026-10-15

App-Launcher: Vollbild auf dem Handy.

### Geändert

- App-Launcher auf dem Handy: Das Fenster füllt jetzt den ganzen Bildschirm, genau wie "Alle Routinen", und sein Schliessen-Knopf sitzt an derselben Stelle in derselben Grösse (38 px, 12 px vom oberen und rechten Rand). Es war das letzte Fenster, das als Blatt von unten kam. Auf dem Desktop bleibt es ein Fenster unter dem Knopf. Das Formular für eigene Apps bleibt ein Blatt.

## [2.59.0] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.60.0.

Routinen: eine eigene Zeit neben den Schnellwahlen.

### Geändert

- Geräte-Popup: mehr Abstand (14 statt 6 px) zwischen dem Knopf "HA-Geräteseite öffnen" und der Reiterleiste, die zusammengedrückt wirkte.

### Hinzugefügt

- Routinen-Assistent, Auslöser: Neben den Schnellwahlen gibt es jetzt bei jeder Zeit, die nur Schnellwahlen hatte, ein Feld "oder eigene Zeit" mit Einheit: "Mindestens so lange erfüllt" (Start und Zurückschalten; Sekunden, Minuten oder Stunden, von 1 Sekunde bis 7 Tage), "Pause danach" (Minuten oder Stunden) und "Spätestens nach" (Minuten, Stunden oder Tage). Ein getippter Wert nimmt die Schnellwahl weg (die Kapsel verschwindet); leert man das Feld, gilt wieder die Vorgabe; eine Schnellwahl leert das Feld. Ein ungültiger Wert zeigt den erlaubten Bereich unter dem Feld und sperrt "Weiter". Die Pause darf nicht unter 1 Minute fallen, die kleinste Schnellwahl, so dass niemand eine kürzere Pause bekommt, als die Vorgabe anbietet; alle anderen Felder erlauben, was der Server erlaubt. Beim Bearbeiten einer Routine steht ein Wert, der keine Schnellwahl ist, im Feld.

## [2.58.0] - 2026-10-15

Neuer Reiter "Schalter" im Geräte-Popup; die Schliessen-Knöpfe von Protokoll, "Alle Routinen" und Launcher passen zum neuen Aussehen.

### Hinzugefügt

- Geräte-Popup, neuer Reiter "Schalter" (an zweiter Stelle, Emoji 🕹️): alle schaltbaren Entitäten des Geräts (Schalter, Licht, Ventilator, Rollladen, Ventil, Schloss, Sirene, Luftbefeuchter, Klima, Mediaplayer, wie bei den Routinen) als kompakte Kacheln in drei Spalten, je mit Symbol, Name und Zustand ("an" ist farbig, eine Lampe und ein Rollladen zeigen auch Helligkeit und Position). Ein Tipp öffnet die Bedienung von Home Assistant für diese Entität, genau wie die Entität im Reiter "Entitäten" (Dimmen, Farbe, Position, Temperatur sind dort); die Kachel selbst schaltet nie etwas, so dass ein Schloss oder ein Rollladen nicht aus Versehen reagiert. Nicht erreichbare Entitäten sind gedimmt. Ein Gerät ohne Schaltbares hat keinen Reiter (fünf Reiter wie bisher). Mockups: `docs/mockups/switches-v1`.

### Geändert

- Schliessen-Knopf in den Vollbild-Fenstern auf dem Handy (Einstellungen, Protokoll, "Alle Routinen"): Er sitzt jetzt auf gleicher Höhe wie der Einstellungs-Knopf der Übersicht (12 px vom oberen Rand), bleibt also an derselben Stelle, wenn ein Fenster aufgeht.
- Launcher-Fenster: Sein Schliessen-Knopf hat den grauen Rand wie die anderen runden Knöpfe (Grösse und Lage bleiben, das Fenster ist kein Vollbild).

## [2.57.0] - 2026-10-15

Reiter mit Emoji und Text auf dem Desktop; der Blitz für Routinen.

### Geändert

- Geräte-Popup, Desktop: Jeder Reiter zeigt jetzt sein Emoji vor der Beschriftung ("📊 Übersicht", "⚙️ Einstellungen", "🧩 Entitäten", "🔔 Magic Push", "⚡ Routinen"). Bisher zeigte nur das Handy Emoji (und die Beschriftung nur am gewählten Reiter), der Desktop nur Text. Auf dem Handy ändert sich nichts. Reiter mit zweiter Zeile ("2 aktiv") behalten sie, das Emoji steht links neben beiden Zeilen.
- Routinen bekommen den Blitz statt der Stoppuhr: als Emoji des Reiters, als Symbol des Knopfs in der Kopfzeile (und im Launcher und im Kopf des Fensters "Alle Routinen") und in der Push-Meldung ("⚡ Routine: <Name>"). Die Stoppuhr passte nicht mehr zu einer Routine, die auch durch einen Auslöser starten kann.

## [2.56.0] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.57.0.

Kreuz, Herz und Plus im Kopf der Fenster sehen aus wie die Knöpfe der Übersicht.

### Geändert

- Die runden Knöpfe im Kopf jedes Fensters (Kreuz, Herz im Geräte-Popup, Plus in "Alle Routinen") sehen jetzt aus wie die Knöpfe der Panel-Übersicht (Einstellungen, Launcher, Favoriten): ein grauer Rand auf der Farbe der Karte statt einer gefüllten grauen Scheibe, und gleich gross (42 px, auf dem Handy 38 px). Auf dem Handy sitzt das Kreuz im selben Abstand zum rechten Rand wie der Einstellungs-Knopf, also an derselben Stelle, wenn ein Fenster über der Übersicht aufgeht.

## [2.55.0] - 2026-10-15

Aus Timern werden Routinen.

### Geändert

- "Timer" heisst jetzt überall "Routine": der Reiter im Geräte-Popup ("Routinen"), die App im Launcher und der Knopf in der Kopfzeile, das Fenster "Alle Routinen", der Abschnitt in den Einstellungen (alle pausieren, Verpasste nachholen, Empfänger, bei Fehler benachrichtigen), die Push-Meldungen ("⏱️ Routine: <Name>", "⚠️ Routine fehlgeschlagen: <Name>"), die Kategorie im Protokoll, die README und die Printscreens. Da eine Routine jetzt auch durch einen Auslöser starten und per Zeit oder Auslöser zurückschalten kann, beschrieb "Timer" sie nicht mehr. Wie Routinen arbeiten, ändert sich nicht.
- Alles Gespeicherte bleibt: die Routinen (die Speicherdatei `device_panel.timers` wird beim ersten Start zu `device_panel.routines`, samt laufendem Stand), die vier Einstellungen (`timers_pause`, `timers_catch_up`, `timers_notify_error`, `notify_service_timers` werden zu `routines_pause`, `routines_catch_up`, `routines_notify_error`, `notify_service_routines`), die Lieblings-Routinen (Herzen) und der Eintrag "Timer" im Launcher mit seinem Platz bei den Favoriten.
- Die internen Namen folgen dem neuen Namen: Dateien (`routines.py`, `routines_ws.py`, `routines.js`, `routine-trigger.js`), die WebSocket-Befehle (`device_panel/routine_*`, Feld `routine_id`), die CSS-Klassen (`rt-*`) und die Texte (`rt*`). Wer die alten Befehle (`device_panel/timer_*`) aufruft, muss auf die neuen wechseln.

## [2.54.1] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.55.0.

Timer: keine Fehlermeldung beim Wechsel auf einen Auslöser.

### Behoben

- Timer, Auslöser: Beim Wechsel auf "Durch einen Auslöser" erscheint nicht mehr die rote Meldung "Bedingungen erwartet", bevor eine Bedingung eingegeben ist. Der Assistent fragt die Vorschau beim Server erst ab, wenn die Bedingungen (und ein gesetztes Zeitfenster) vollständig sind.

## [2.54.0] - 2026-10-15

Timer: ein Auslöser statt einer Uhrzeit und Zurückschalten per Zeit oder Auslöser.

### Hinzugefügt

- Timer, Seite "Wann": ein Umschalter "Zu einer Zeit | Durch einen Auslöser". Bei "Durch einen Auslöser" schaltet der Timer, wenn Bedingungen erfüllt sind, aufgebaut wie bei Magic Push: beliebige Entität, "über", "unter", "ist" oder "ändert sich", mehrere Bedingungen mit "und" / "oder" und einer Ebene Gruppen, auf Wunsch "Mindestens so lange erfüllt" (sofort, 30 Sek., 2 Min., 5 Min.). Die Bedingung erscheint als Satz ("Wenn Temperatur Garten unter 5 ist."). Der Timer schaltet nur, wenn die Bedingung neu eintritt: Ist sie beim Speichern des Timers, nach einem Neustart oder zu Beginn des Zeitfensters schon erfüllt, passiert nichts, bis sie zwischenzeitlich nicht mehr erfüllt war.
- Timer, Auslöser: Zeitfenster ("Nur in einem Zeitfenster", zum Beispiel 22:00 bis 06:00, auch über Mitternacht). Das Fenster gilt nur für den Start: Ausserhalb passiert nichts, und eine ausserhalb erfüllte Bedingung wird nicht auf später verschoben.
- Timer, Auslöser: Mindestpause nach einem Schalten (1, 5, 15 oder 60 Min., Standard 1 Min.) und der Schalter "Nur einmal auslösen" (Standard aus; danach schaltet sich der Timer selbst aus).
- Timer, neue Seite "Zurückschalten" (ersetzt die Rückschalt-Steuerung der Seite "Was"): "Nie", "Nach Dauer", "Zu einer Zeit" oder "Durch einen Auslöser", jeweils mit "Ausschalten" oder "Wie vorher". Der Zurück-Auslöser zählt nur beim Eintreten und hat dieselben Bedingungen und "Mindestens so lange erfüllt" wie der Start. Als Sicherung schaltet "Spätestens nach" (30 Min. bis 6 Std.) auch dann zurück, wenn der Auslöser nie kommt. Start und Ende lassen sich beliebig kombinieren: zum Beispiel um 20:00 ein und aus, wenn der Regensensor trocken ist, oder per Auslöser ein und zu einer Zeit aus.
- Timer, Listen und Zusammenfassung: Ein Timer mit Auslöser zeigt den Satz und "wartet auf Auslöser" statt der nächsten Ausführung, in den Listen mit einem Blitz-Zeichen; Protokoll und Push nennen den Grund ("übersprungen: ausserhalb des Zeitfensters", "übersprungen: Pause", "übersprungen: Zurückschalten wartet noch").
- Schutz: Die geschaltete Entität darf nicht ihr eigener Auslöser sein (auch nicht im Zurück-Auslöser).

### Geändert

- Timer-Assistent: Die Seiten sind jetzt Was, Optionen (nur wenn vorhanden), Wann, Zurückschalten (nur bei Aktionen mit Gegenstück), Meldung und Name; die Rückschalt-Steuerung ist von "Was" auf die neue Seite gewandert. Bestehende Timer verhalten sich unverändert.

## [2.53.0] - 2026-10-15

KI-Einschätzung: Der KI-Bereich ist vom Rest des Geräte-Popups abgesetzt.

### Geändert

- Geräte-Popup, KI-Einschätzung: Alles, was von der KI kommt (der Knopf, die Einschätzung, die Rückfragen mit ihren Vorschlägen und dem Textfeld), steht jetzt in einem Rahmen mit farbiger Kopfzeile "KI-Einschätzung" und, sobald es eine Einschätzung gibt, der Quelle (zum Beispiel "Google AI Task") rechts. Innen sind Einschätzung und Rückfragen durch eine gestrichelte Linie getrennt, und unter dem Rahmen beginnen "Verbindung" und "Gerät" deutlich. Vorher flossen Einschätzung, Chat und die Abschnitte darunter ineinander, so dass schwer zu erkennen war, was zur KI gehört und was nicht. Die Zeile "Erstellt 10:41 · Neu erstellen" unter der Einschätzung zeigt jetzt nur noch die Zeit, denn die Quelle steht in der Kopfzeile. Der Hinweis, was gesendet wird, bleibt im Rahmen.

## [2.52.1] - 2026-10-15

Timer: Auch ausgeblendete Entitäten lassen sich schalten.

### Behoben

- Timer: Auch ausgeblendete Entitäten lassen sich jetzt schalten. Bisher liess der Timer-Assistent jede Entität weg, die Home Assistant als "versteckt" markiert, so dass ein Gerät, dessen einziges Licht versteckt ist (zum Beispiel einzelne Hue-Lampen einer Gruppe, die Hue versteckt), "Dieses Gerät hat keine Entität, die ein Timer schalten kann" zeigte. Versteckt heisst nur, dass Home Assistant die Entität nicht in automatischen Dashboards zeigt; schalten lässt sie sich wie jede andere. Deaktivierte Entitäten bleiben ausgeschlossen, denn sie haben keinen Zustand. Dasselbe gilt für die Geräteliste bei "Timer hinzufügen" im Fenster aller Timer.

## [2.52.0] - 2026-10-15

Timer: Schaltoptionen (Helligkeit, Farbe, Position, Temperatur, Lautstärke, Stufe) und Zurückschalten "wie vorher".

### Hinzugefügt

- Timer, neue Seite "Optionen" nach "Was schalten": Kann die gewählte Entität beim Einschalten etwas einstellen, zeigt der Assistent eine eigene Seite mit Vorschau und je einem Regler pro Einstellung. Licht: Helligkeit, Farbtemperatur (mit "Warm", "Neutral", "Kalt") und Farbe (acht Farben und eine freie Farbe aus der Farbwahl des Browsers); Rollladen oder Store: Position (0 bis 100 %); Klima: Soll-Temperatur (innerhalb der Grenzen und Schritte des Geräts) und Modus (Heizen, Kühlen, Automatik und so weiter, soweit das Gerät sie hat); Mediaplayer: Lautstärke; Ventilator: Stufe. Die Vorschau zeigt die Lampe in der gewählten Farbe und Helligkeit, den Rollladen auf seiner Position, die Soll-Temperatur und so weiter; geschaltet wird damit nichts. Jede Einstellung hat auch "Wie zuletzt": Ohne Angabe bleibt alles wie bisher, der Standard ändert sich also nicht und ein Timer ohne Einstellung verhält sich genau wie vorher. Die Seite gibt es nur für "Einschalten" (bei Rollläden "Öffnen") und nur, wenn die Entität Einstellungen anbietet; bei anderen Entitäten hat der Assistent dieselben vier Schritte wie bisher. Einstellungen, die sich ausschliessen (Farbtemperatur und Farbe), löschen sich gegenseitig.
- Timer, "Danach zurück auf" (erscheint, sobald Zurückschalten eingestellt ist): "Ausschalten" (bisher der einzige Weg, das Gegenstück der Aktion) oder "Wie vorher". Bei "Wie vorher" merkt sich der Timer unmittelbar vor dem Schalten die Szene der Entität (ein oder aus, Helligkeit und Farbe einer Lampe, Position eines Rollladens, Modus und Soll-Temperatur eines Klimageräts, Lautstärke eines Mediaplayers, Stufe eines Ventilators) und stellt sie nach der Zeit wieder her, zum Beispiel "die Lampe kurz heller und danach wieder wie sie war". War die Entität aus, wird sie wieder ausgeschaltet; war sie schon an, bleibt sie an. Die Szene wird gespeichert und übersteht einen Neustart. Schaltet ein Timer erneut, während sein Zurückschalten noch aussteht, bleibt die erste Szene (die Lampe "kehrt" nicht in den Zustand zurück, den der Timer selbst gesetzt hat). Lässt sich eine Szene nicht herstellen (der Zustand war unbekannt), gilt das Gegenstück. Protokoll und Push nennen "wie vorher".
- Timer schalten jetzt auch Klimageräte (einschalten, ausschalten, umschalten) und Mediaplayer (dasselbe) und können sie damit auch einstellen. Angeboten wird nur, was das Gerät kann: "Einschalten" und "Ausschalten" bei einem Gerät, das es unterstützt, und "Einschalten" auch bei einem Gerät, das sich nicht einschalten, aber einstellen lässt (ein Lautsprecher mit Lautstärke). Zwischen zwei Aufrufen eines Schaltens (einschalten, dann Temperatur oder Lautstärke) wartet der Timer eine Sekunde, damit das Gerät für den zweiten bereit ist.

### Geändert

- Timer, "Jetzt ausführen" im Assistenten nimmt die gewählten Einstellungen und schaltet damit in genau der gewählten Stärke; so lässt sich sofort prüfen, wie es wirklich aussieht. Wie bisher schaltet es nichts zurück und speichert keinen Timer.
- Timer, der Satz im Assistenten, in der Zusammenfassung und in den Listen nennt die Einstellungen: "Hue Lamp einschalten (50 %, warmweiss (2700 K)), nach 10 Min. wieder wie vorher." Bei Rollläden mit Position: "Rollo auf 50 % fahren".
- Batterie-Prognose: Dauern ab einem Jahr stehen in Jahren und Monaten statt als Dezimalzahl: "Reicht noch etwa 2 Jahre 11 Monate" statt "2,9 Jahre" (auch in der Spanne, zum Beispiel "Spanne 2 Jahre 10 Monate bis 2 Jahre 11 Monate"). Unter einem Jahr bleiben es Monate, unter 45 Tagen Tage.
- Timer-Assistent: Die Schrittanzeige zählt die Seiten, die es gibt (mit der Seite "Optionen" "Schritt 3 von 6", ohne sie aus dem Fenster aller Timer "Schritt 3 von 5").

## [2.51.0] - 2026-10-15

KI-Einschätzung: die vorgeschlagenen Rückfragen kommen von der KI.

Enthält die Änderungen aus 2.50.0.

### Geändert

- KI-Einschätzung, Rückfragen: die Pillen über dem Textfeld sind nicht mehr immer dieselben. Die KI schlägt selbst bis zu drei Anschlussfragen vor, die zum Gerät und zu ihrer letzten Antwort passen, zum Beispiel "Läuft der Router nachts neu?" oder "Wie alt ist die Batterie?". Sie hängt sie als letzte Zeile an dieselbe Antwort (kein zusätzlicher Aufruf, keine zusätzlichen Kosten); das Panel schneidet die Zeile ab und zeigt sie als Pillen. Nach jeder Antwort gibt es neue Vorschläge, gestellte Fragen fallen weg. Die Vorschläge bleiben mit der letzten Einschätzung gespeichert, auch über Neustarts. Das gilt auch für einen selbst geänderten Prompt, weil die Bitte um die Zeile vom Panel angefügt wird und nicht Teil des Prompts ist; die Vorschau im Profi-Modus zeigt sie. Schickt die KI keine Vorschläge (oder ist die Zeile beschädigt), bleiben die bisherigen festen Fragen als Rückfall.

## [2.50.0] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.51.0.

Fenster "Empfang": Empfängernamen ohne Adressen, Hinweis auf einen weit entfernten Empfänger.

### Hinzugefügt

- Fenster "Empfang", Abschnitt "Verbunden über": wurde das Gerät mindestens 10 % der Zeit über einen Empfänger gehört, dessen mittleres Signal mindestens 10 dBm schwächer war als das des Hauptempfängers, sagt das ein kurzer Hinweis, zum Beispiel "Über "Storen Küche" lief der Empfang 13 % der Zeit, im Mittel -97 dBm: 20 dBm schwächer als über "Shelly Eingang EG Aussen" (Ø -77 dBm). Das kann die Einbrüche im Verlauf erklären." (höchstens zwei Hinweise). Das Panel kann daran nichts ändern: Home Assistant wählt den Empfänger, und das Panel ändert keine anderen Integrationen. Es hilft ein näherer Proxy oder dass der weit entfernte das Gerät nicht mehr erreicht.

### Geändert

- Empfängernamen erscheinen ohne Bluetooth-Adressen: Home Assistant nennt einen Proxy oft "Name (E4:B3:23:17:F5:3A)", was die Zeilen in der Legende, in der Liste der Wechsel und bei "Verbunden über" lang machte. Heissen zwei Empfänger gleich, bleibt bei ihnen die Adresse, damit man sie noch unterscheiden kann. Die gespeicherten Namen bleiben unverändert.

## [2.49.0] - 2026-10-15

Live-Aktivität beim Laden: geschätzte Zeit bis zum Ziel.

Enthält die Änderungen aus 2.48.1.

### Hinzugefügt

- Live-Aktivität (iPhone) und Live-Update (Android 16) beim Laden: sobald die Schätzung verlässlich ist, beginnt der Text mit "fertig gegen 14:35" (nach Mitternacht "fertig morgen gegen 02:10"), danach der Stand ("fertig gegen 14:35 · 62 % von 100 %"). Die Zeit erscheint mit dem nächsten regulären Update (höchstens alle 4 Minuten, wie bisher), es gibt keinen zusätzlichen Push und keine Einstellung dazu. Das Panel schätzt sie aus den Messungen der laufenden Ladung: die Geschwindigkeit der letzten 30 Minuten, und erst wenn mindestens 5 Minuten und 3 Punkte Anstieg gemessen sind, der Start zeigt also noch keine Zeit. Ein Akku lädt gegen Ende langsamer, darum zählt der Rest über 80 % unterhalb von 80 % doppelt so lang (eine grobe Annahme, noch nicht aus früheren Ladungen des Geräts gelernt). Die Zeit wird auf 5 Minuten gerundet; steht die Ladung still oder läge die Schätzung über 12 Stunden entfernt, erscheint nichts. Das Protokoll (Debug) hält jede Schätzung mit Geschwindigkeit, Messdauer und Ergebnis fest.

### Behoben

- Fenster "Empfang", Abschnitt "Verbunden über": der farbige Balken liegt jetzt genau unter dem Diagramm darüber, auf gleicher Breite und mit denselben Zeitmarken (12:00, 15:00 … jetzt). Vorher lief der Balken über die ganze Breite, während das Diagramm erst nach seiner Achse beginnt, sodass eine Zeit im Diagramm und dieselbe Zeit im Balken nicht übereinander lagen und man am Diagramm nicht ablesen konnte, über welchen Empfänger das Gerät verbunden war. Ohne Diagramm darüber (keine Messwerte, zum Beispiel bei einem ausgefallenen Gerät) behält der Balken die ganze Breite. Bei einer jungen Aufzeichnung beginnt der Balken erst mit ihrem Beginn: die Zeit davor bleibt links leer, und "jetzt" liegt immer ganz rechts, der Balken wächst also von rechts her statt von links (vorher lief er vom linken Rand und liess den leeren Rest rechts, was am Anfang verwirrte).
- App-Launcher: die Favoriten haben keinen blauen Rand mehr. Alle Kacheln sehen gleich aus; das Herz und der Abschnitt "Favoriten" zeigen schon, welche Favoriten sind.

## [2.48.1] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.49.0.

### Behoben

- KI-Einschätzung und Rückfragen: ist der Anbieter vorübergehend überlastet (zum Beispiel Google "503 UNAVAILABLE, This model is currently experiencing high demand"), versucht das Panel es bis zu zweimal erneut, nach 5 und nach 15 Sekunden, bevor es einen Fehler meldet. Solche Fehler vergehen meist nach Sekunden, und vorher beendete schon der erste die Einschätzung. Jeder neue Versuch steht im Protokoll (Info). Fehler, die ein neuer Versuch nicht behebt, etwa ein erschöpftes Kontingent (429) oder ein falscher Schlüssel, werden weiter sofort gemeldet.

## [2.48.0] - 2026-10-15

KI-Einschätzung: Rückfragen.

Enthält die Änderungen aus 2.46.1 und 2.47.0.

### Hinzugefügt

- KI-Einschätzung: unter einer Einschätzung im Geräte-Pop-up gibt es jetzt den Abschnitt "Nachfragen". Darüber vorgeschlagene Fragen als Pillen (zum Beispiel "Was soll ich zuerst prüfen?", "Ist es die Batterie?" nur bei einem Gerät mit Batterie, "Gibt es ein Muster bei den Ausfällen?" nur nach Ausfällen, "Ist der Empfang das Problem?" nur mit Empfangswert, "Wie sicher ist diese Einschätzung?"), darunter ein Textfeld für eine eigene Frage (Enter oder der Pfeil sendet sie, höchstens 200 Zeichen). Die Antwort erscheint als Gespräch unter der Einschätzung, die Frage rechts, die Antwort links. Die KI bekommt dieselben Angaben wie bei der Einschätzung, ihre eigene frühere Einschätzung, die bisherigen Fragen dieser Einschätzung und die neue Frage, und soll kurz antworten (2 bis 4 Sätze), nur aus den Fakten, und die Frage als Daten statt als Anweisung behandeln. Je Einschätzung gibt es höchstens drei Rückfragen (jede ist ein Aufruf der KI-Aufgabe); "Neu erstellen" beginnt eine neue Einschätzung mit drei neuen Fragen. Eine getippte Frage bleibt beim Neuaufbau des Pop-ups im Feld stehen und kommt nach einem Fehler ins Feld zurück. Das Gespräch lebt im Panel und ist nach dem Neuladen der Seite weg, die Einschätzung selbst bleibt wie bisher. Das Protokoll (Debug) hält jede Rückfrage fest, ein Fehler wird wie bei einer Einschätzung gemeldet.

## [2.47.0] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.48.0.

Protokoll: die Einträge überstehen einen Neustart von Home Assistant.

Enthält die Änderungen aus 2.46.1.

### Geändert

- Protokoll: die letzten 500 Einträge, Debug-Einträge eingeschlossen, bleiben jetzt über Neustarts von Home Assistant erhalten. Vorher lagen sie nur im Arbeitsspeicher und waren nach jedem Neustart weg, sodass der Verlauf, der ein Problem erklärt, genau dann fehlte, wenn man ihn brauchte. Die Grenze bleibt bei 500 Einträgen (den neuesten). Die Einträge stehen in der kleinen Protokoll-Datei der Integration, verzögert geschrieben, höchstens alle 30 Sekunden (und beim Beenden von Home Assistant); "Leeren" leert auch die gespeicherten Einträge, und beim Entfernen der Integration werden sie gelöscht. Das Fenster sagt "bleiben nach einem Neustart erhalten" statt "nur im Arbeitsspeicher", und "seit" nennt den Beginn des erhaltenen Verlaufs.

## [2.46.1] - 2026-10-15

Nicht veröffentlicht; enthalten in 2.47.0.

### Geändert

- Geräte-Pop-up, Reiter "Einstellungen": hat ein Gerät nur die Einstellungen zum Ausfall und entfällt deshalb die Reiterleiste, steht jetzt der Titel "Ausfall" darüber, damit auf den ersten Blick klar ist, wozu die Einstellungen gehören. Mit Reiterleiste gibt es keinen Titel.

## [2.46.0] - 2026-10-14

Geräte-Pop-up: Reiter ohne Inhalt werden ausgeblendet.

Enthält die Änderungen aus 2.45.0.

### Geändert

- Geräte-Pop-up, Reiter "Einstellungen": die Unterreiter Batterie, Laden und Empfang erscheinen nur, wenn das Gerät etwas zu zeigen hat. Ein Gerät ohne Batteriestand (zum Beispiel ein Anwesenheitssensor am Netz) hat die Reiter "Batterie" und "Laden" nicht mehr, die nur "Dieses Gerät meldet keinen Batteriestand." sagten; ein Gerät ohne Empfangswert hat keinen Reiter "Empfang". Der Reiter "Ausfall" bleibt immer. Bleibt nur "Ausfall" übrig, entfällt die Reiterleiste.

## [2.45.0] - 2026-10-14

Nicht veröffentlicht; enthalten in 2.46.0.

KI-Einschätzung: kürzere Prompts, mehr Zusammenhang, die letzte Antwort fliesst ein, Messfehler werden markiert.

### Hinzugefügt

- KI-Einschätzung: Das Panel merkt sich die letzte Einschätzung jedes Geräts (bleibt über Neustarts, höchstens 150 Geräte, 30 Tage). Das Pop-up zeigt sie beim Öffnen des Geräts wieder, ohne die KI zu fragen, und die nächste Einschätzung bekommt sie als Fakt `previous_assessment` mit (wie lange her, Überschrift, Text, Status damals). Der Standard-Prompt sagt der KI, zu prüfen, was sich seither geändert hat, und sich nicht blind zu wiederholen. Ein selbst bearbeiteter Prompt kann sie über die neue Gruppe `{facts_previous}` oder `{facts}` nutzen. Die gemerkten Texte werden beim Entfernen der Integration gelöscht.
- KI-Einschätzung: mehr Zusammenhang, wo es Daten gibt: `integration_problem` (die Integration läuft nicht: setup_retry, setup_error und ähnlich, das erklärt einen Ausfall allein), `entities` (wie viele Entitäten das Gerät hat und wie viele nicht verfügbar sind), `home_assistant_started_minutes_ago` (ein Ausfall kurz nach einem Neustart gehört oft zum Neustart) und `battery_sensor_glitches_7d` (wie oft der Batterie-Sensor einen unmöglichen Wert meldete, den das Panel verworfen hat; die KI soll ihn nicht als echten Abfall lesen und einen solchen Sensor unzuverlässig nennen).

### Geändert

- KI-Einschätzung: Die ganze Anweisung ist auf 18000 Zeichen begrenzt (etwa 4500 Token). Längere Fakten werden vom Unwichtigsten her gekürzt: die Listen anderer Geräte im Bereich, der ausgefallenen Geräte der Integration und des Hubs, danach die Monate des Batterie-Verlaufs; alles zum Gerät selbst bleibt. Das Protokoll (Kategorie System) sagt, was gekürzt wurde.

## [2.44.0] - 2026-10-14

KI-Einschätzung: Geräte, die geladen werden, werden erkannt.

### Hinzugefügt

- KI-Einschätzung: Die KI weiss jetzt, ob ein Gerät geladen wird oder mit auswechselbaren Batterien läuft. Neue Fakten `battery_kind` ("rechargeable" oder "probably_rechargeable") mit `battery_kind_reason` und `charging_now` (seit wann, von welchem Stand). Das Panel leitet es aus Belegen ab: eine Ladeanzeige des Geräts oder eine eingerichtete Lademeldung, ein Ladevorgang, der gerade läuft, ein Gerätetyp, der immer geladen wird (Staubsauger-Roboter, Handy), oder drei und mehr Anstiege des Stands im Verlauf. Wo das Panel es nicht belegen kann, fehlt der Fakt, und der Prompt sagt der KI, nach Typ, Hersteller und Modell zu entscheiden. Bisher wurde ein Staubsauger-Roboter wie ein Sensor mit Batterie eingeschätzt ("Der Batteriestand ist stabil, die Prognose ist unsicher").
- KI-Einschätzung: Bei einem geladenen Gerät entfällt die Batterie-Prognose ("Tage bis zur Warnschwelle"), und der Standard-Prompt sagt der KI, über die Ladegewohnheiten zu sprechen (wie oft geladen, lädt es gerade) statt über Batterie-Laufzeit oder einen Batteriewechsel; ein tiefer Stand heisst nur, dass es geladen werden muss.

### Geändert

- KI-Einschätzung: Der längste erlaubte Prompt hat jetzt 12000 statt 6000 Zeichen (Einstellungen, Profi-Modus). Der Standard-Prompt war über 6000 gewachsen und liess sich nach dem Kopieren nicht mehr speichern.

## [2.43.0] - 2026-10-14

Batterie: Messfehler werden von selbst abgefangen, und das Protokoll hält nur Neues fest.

### Geändert

- Batteriestand: Ein unglaubwürdig schneller Abfall wird gehalten, bis er bestätigt ist, ohne dass etwas einzustellen ist. Manche Sensoren melden zwischendurch einen unmöglichen Wert (76 % - 2 % - 68 % innerhalb von Minuten); das löste "Batterie schwach" aus und liess ein Gerät wie ladend aussehen. Das Panel schaut jetzt auf die Geschwindigkeit des Abfalls statt auf den Wert: Ein Abfall gilt nur als verdächtig, wenn er mindestens 25 Punkte beträgt und grösser ist, als eine Batterie seit der letzten Meldung physikalisch verlieren kann (2 Punkte pro Minute plus 10). Ein Staubsauger, der einen Punkt pro Minute verliert, oder ein Sensor, der einmal pro Stunde meldet, wird deshalb nie gehalten. Ein gehaltener Stand wird bestätigt durch eine weitere passende Meldung mindestens 10 Minuten später oder wenn er 30 Minuten unverändert bleibt; kehrt der Stand vorher zurück, wird die Meldung als Messfehler verworfen. Anstiege werden nie gefiltert (Laden und Batteriewechsel sind echt). Liste, Batterie-Warnung, Ladeerkennung und die Fakten für die KI nutzen den glaubwürdigen Stand; jede Entscheidung steht im Protokoll (Kategorie Batterie).
- Batterie-Verlauf: Solche Einbrüche, auf die der Stand innerhalb einer Stunde zurückkehrt, erscheinen nicht mehr im Diagramm, in der Prognose und in den Fakten für die KI (die Langzeitstatistik glättet sie schon).
- Protokoll: Die Debug-Zeile "Laden" wird nur noch geschrieben, wenn sich der Stand eines Geräts ändert. Eine Wiederverbindung von Matter- oder Eve-Geräten meldet viele Geräte auf einmal mit demselben Wert und füllte das Protokoll mit gleichen Zeilen (und verdrängte die wichtigen Einträge). Alles andere bleibt so ausführlich wie bisher.

## [2.42.0] - 2026-10-14

Nicht veröffentlicht; enthalten in 2.43.0.

KI-Einschätzung: Der Grund eines Fehlers ist sichtbar, und die KI bekommt mehr Fakten.

### Hinzugefügt

- KI-Einschätzung: Meldet die KI-Aufgabe einen Fehler, zeigt das Pop-up unter der Erklärung jetzt ihre Meldung ("Meldung der KI-Aufgabe: ..."), und das Protokoll (Einstellungen, Protokoll) bekommt eine Warnung mit dem Grund, der Grösse des Prompts und der KI-Aufgabe. Bisher sagte das Panel nur "Die KI-Aufgabe hat einen Fehler gemeldet", und der Grund stand nur im Protokoll von Home Assistant. Ein erfolgreicher Lauf schreibt eine Debug-Zeile mit Grösse von Prompt und Antwort und Dauer.
- KI-Einschätzung: neue Fakten, je nur wo es Daten gibt: `recent_outages_7d` (die letzten Ausfälle der Woche mit Zeit seit dem Ausfall, Dauer, Ortszeit des Beginns und Wochentag, das zeigt Muster wie "jede Nacht um 3 Uhr"), `signal.last_24h` und `signal.last_7d` (Median, schlechtester und bester Empfang aus der eigenen Aufzeichnung des Panels) und `bluetooth_receivers_24h` (die Empfänger, die ein Bluetooth-Gerät in den letzten 24 Stunden gehört haben, mit Anteil und mittlerem Empfang, wie oft es gewechselt hat und ob es Lücken ohne Empfang gab). Der Standard-Prompt erklärt sie; ein selbst bearbeiteter Prompt behält seinen Text und kann die neuen Fakten über die Gruppen `{facts_history}` und `{facts_signal}` oder `{facts}` nutzen.

### Geändert

- KI-Einschätzung: Eine leere Antwort der KI-Aufgabe (zum Beispiel von einem Modell mit Denkphase, das seine Ausgabe dort verbraucht) bekommt einen zweiten Versuch; ist sie wieder leer, nennt eine klare Meldung die wahrscheinliche Abhilfe (anderes Modell oder mehr Ausgabe-Tokens) statt des allgemeinen Fehlers.

### Behoben

- KI-Einschätzung: Bluetooth-Adressen erreichen die KI nicht mehr. Home Assistant nennt einen Bluetooth-Proxy oft "Name (B0:A7:32:46:E3:C2)", und dieser Name ging als "verbunden über" in die Fakten, obwohl keine Adressen gesendet werden sollen. Die Adresse wird vorher entfernt.

## [2.41.2] - 2026-10-14

Bluetooth: Wert und Empfänger aus derselben Quelle.

### Geändert

- Bluetooth-Geräte zeigen jetzt den Live-Empfang von Bluetooth (der beste Empfang über alle Empfänger, wie unter Einstellungen, Bluetooth, Advertisements) statt des Werts ihres eigenen Empfangs-Sensors. Grund: Sensoren wie das SwitchBot "Bluetooth-Signal" lesen den Empfänger, der das Gerät steuern kann, nicht den besten. Das widersprach dem angezeigten Empfänger ("über Proxy Garage") und konnte "Empfang schwach" auslösen, obwohl ein Proxy das Gerät gut hört. Der Sensor bleibt Ersatz, solange Bluetooth nichts meldet. Der Empfangsverlauf dieser Geräte stammt nun aus der eigenen Aufzeichnung des Panels statt aus dem Recorder und beginnt mit diesem Update leer (24 Stunden füllen sich in Minuten, 30 Tage mit der Zeit); die früheren Recorder-Werte werden nicht mehr gezeigt.

## [2.40.1] - 2026-10-14

Bluetooth: Der Empfänger wird auch bei Geräten gezeigt, deren Empfang aus einem Sensor kommt.

### Behoben

- Bluetooth-Geräte mit eigenem Empfangs-Sensor (zum Beispiel SwitchBot "Bluetooth-Signal") zeigten in der Liste keinen Empfänger ("über Storen Büro") und im Fenster "Empfang" keinen Abschnitt "Verbunden über", obwohl Home Assistant den Empfänger kennt (Einstellungen, Bluetooth, Advertisements). Das Panel fragte Bluetooth nur, wenn ein Gerät keinen Empfangs-Sensor hatte. Jetzt wird der Empfänger bei jedem Bluetooth-Gerät gelesen; der Empfangswert selbst kommt wie bisher aus dem Sensor. Den Weg solcher Geräte zeichnet das Panel ab diesem Update auf, der Abschnitt "Verbunden über" füllt sich mit der Zeit (ohne mittleren Empfang, da die Sensorwerte aus dem Recorder stammen).

## [2.40.0] - 2026-10-14

Empfang: der Weg des Bluetooth-Empfangs ("Verbunden über").

### Hinzugefügt

- Fenster "Empfang" eines Bluetooth-Geräts: neuer Abschnitt "Verbunden über" unter dem Verlauf, für 24 Std., 7 Tage und 30 Tage. Ein Balken zeigt, über welchen Empfänger (Bluetooth-Adapter von Home Assistant oder ein Bluetooth-Proxy, zum Beispiel "Proxy Garage") das Gerät gehört wurde, eine Farbe je Empfänger; Lücken, in denen das Gerät nicht empfangen wurde, sind schraffiert. Darunter listet eine Legende jeden Empfänger mit seinem Zeitanteil und dem mittleren Empfang ("60 % · Ø -74 dBm"), und die Liste "Wechsel" nennt die letzten Wechsel ("Küche → Storen Büro") mit Zeit. Das Panel hält den Empfänger jede Minute zusammen mit dem Empfang fest und bewahrt ihn 31 Tage in einer eigenen Datei auf. Es zeigt nur, was es selbst aufgezeichnet hat, also seit diesem Update: Ein früherer Weg lässt sich nicht nachträglich herstellen, das Fenster sagt es. Geräte ohne Bluetooth-Empfänger (Zigbee, WLAN und so weiter) und Bluetooth-Geräte ohne aufgezeichneten Weg zeigen nichts Neues. Als Name des Empfängers gilt der, den Home Assistant dem Scanner gibt; die Farben bleiben je Gerät gleich, in der Reihenfolge, in der die Empfänger zuerst auftraten.

## [2.39.1] - 2026-10-14

Nicht veröffentlicht; enthalten in 2.40.0.

Startseite: wie alle anderen Einstellungen.

### Geändert

- Einstellungen, "Startseite": Der Schalter "Als meine Startseite festlegen" gilt nicht mehr sofort, sondern wie alle anderen Einstellungen erst mit "Speichern" (er zeigt das Etikett "geändert", zählt als Änderung, und beim Schliessen ohne Speichern fragt das Panel "Änderungen verwerfen?"). Beim Einschalten merkt sich das Panel deine bisherige Startseite von Home Assistant; Ausschalten und Speichern bringt sie zurück. Ohne bisherige Startseite wird der Eintrag entfernt, und es gilt wieder die Vorgabe von Home Assistant.

## [2.39.0] - 2026-10-14

Startseite: das Panel als Startseite von Home Assistant.

### Hinzugefügt

- Einstellungen, neuer Bereich "Startseite" ganz oben im Abschnitt "Ansicht" (über den Filter-Chips): Der Schalter "Als meine Startseite festlegen" macht dieses Panel zu der Seite, die Home Assistant beim Start öffnet, im Browser und in der Companion-App. Er gilt sofort (kein "Speichern"), nur für dein Konto, und schreibt `default_panel` in deine Benutzerdaten von Home Assistant, ohne die anderen Werte dort anzutasten. Ausschalten entfernt den Eintrag, dann gilt wieder die Vorgabe von Home Assistant. Die Profilseite von Home Assistant kann das nicht, ihre Auswahl listet nur eingebaute Seiten und Dashboards, nicht das Panel einer Integration. Die Zusammenfassung des Abschnitts lautet dann "Deine Startseite". Fehler erscheinen unter dem Schalter.

### Geändert

- Der Einstellungsabschnitt "Darstellung" (englisch "Appearance") heisst jetzt "Ansicht" (englisch "View").

## [2.38.0] - 2026-10-14

KI-Einschätzung: Link zu den KI-Einstellungen von Home Assistant, und nur mit einer KI-Aufgabe.

### Hinzugefügt

- Einstellungen, "KI-Einschätzung": Ein Link "KI-Vorschläge in Home Assistant öffnen" führt zu den KI-Einstellungen von Home Assistant (`/config/ai`, dort wählt man die KI-Aufgabe bei "Aufgaben zur Datengenerierung").

### Geändert

- Der Schalter "Knopf "Mit KI einschätzen" zeigen" lässt sich nur einschalten, wenn es eine KI-Aufgabe gibt: eine in Home Assistant unter "KI-Vorschläge" bei "Aufgaben zur Datengenerierung" gewählte (oder eine hier gewählte, die noch existiert). Ohne sie ist der Schalter gesperrt, und eine Meldung sagt warum und was zu tun ist: "Keine KI-Aufgabe ausgewählt. Wähle in Home Assistant unter "KI-Vorschläge" bei "Aufgaben zur Datengenerierung" eine KI-Task-Entität aus. Erst dann lässt sich die KI-Einschätzung hier einschalten." Der Server prüft es ebenfalls, eine Anfrage am Panel vorbei wird mit derselben Meldung abgelehnt. Ist die Funktion schon eingeschaltet und die KI-Aufgabe fällt weg, bleibt sie an, mit einem Hinweis, und andere Einstellungen lassen sich weiter speichern.
- Die Hinweise zur KI-Aufgabe verweisen jetzt auf "KI-Vorschläge" statt auf "Einstellungen → System → Allgemein".
- Einstellungen, Versionsleiste bei aktiven automatischen Updates (2.37.0): Statt des Abzeichens mit dem kreisenden Ring auf dem Symbol steht eine kleine Pille "Auto" hinter dem Titel (wie die Pille "Beta"). Das Symbol bleibt das schlichte grüne Häkchen, nichts bewegt sich mehr (der Ring war zu unruhig und drehte sich nicht auf jedem Gerät). Der Untertitel sagt nicht mehr "automatisch", das sagt die Pille (über ihr steht "Updates werden automatisch installiert"). Die Bedingungen bleiben: Schalter und tägliche Prüfung an, nur bei "Aktuell".

## [2.37.0] - 2026-10-14

Ein Zeichen, dass die automatischen Updates aktiv sind.

### Hinzugefügt

- Einstellungen, Versionsleiste: Solange "Updates automatisch installieren" wirklich arbeitet (Schalter an und tägliche Prüfung an, wie gespeichert), trägt das Symbol der Leiste ("Aktuell") ein kleines Abzeichen mit kreisenden Pfeilen und einen langsam kreisenden grünen Ring, und der Untertitel lautet "Aktuell · automatisch". Über dem Abzeichen steht "Updates werden automatisch installiert". Der Ring steht still, wenn auf dem Gerät "Bewegung reduzieren" eingestellt ist. Nur in den Einstellungen (das Zahnrad in der Kopfzeile bleibt unverändert, es behält den roten Punkt für einen ausstehenden Neustart). Ein gefundenes Update wird bei automatischen Updates sofort installiert, die Zeile "Update verfügbar" bleibt deshalb ohne Zeichen.

## [2.36.0] - 2026-10-14

Nicht veröffentlicht; enthalten in 2.37.0.

Suchfeld: nicht mehr so breit wie das ganze Fenster.

### Geändert

- Desktop (ab 1101 px): Das Suchfeld zieht sich nicht mehr bis zu den Schaltern am äussersten Rand, sondern endet genau mit der Kachel "Gerade ausgefallen" darunter, damit das Kreuz zum Leeren gut erreichbar ist. Die Schalter bleiben am rechten Rand. Fehlt der Platz (zum Beispiel fünf Favoriten bei etwa 1100 px Fensterbreite), gibt das Feld nach und wird schmaler; nichts läuft über. Schmalere Fenster und das Handy bleiben unverändert (das Feld füllt den Rest).

## [2.35.1] - 2026-10-14

Nicht veröffentlicht; enthalten in 2.36.0.

Die Logos der Integrationen kommen von selbst wieder.

### Behoben

- Geräteliste: Nach dem Öffnen der App fehlten manchmal alle Logos der Integrationen (stattdessen stand das Symbol der Verbindungsart), bis die Companion-App neu gestartet wurde. Ursachen: Scheiterte die erste Abfrage des Zugangs-Tokens für den Logo-Dienst (zum Beispiel weil beim Aufwachen der App die Verbindung kurz weg war), wurde sie nie wiederholt; ein Logo, dessen Bild einmal nicht lud, blieb für die ganze Sitzung als "kein Logo" vermerkt; und nach dem Aufwachen wurde ein altes Token nicht erneuert (die Zeitgeber ruhen im Hintergrund). Jetzt wird die Abfrage mit wachsendem Abstand wiederholt, ein gescheitertes Logo nach 5 Minuten und mit jedem neuen Token neu versucht, und ein altes Token beim Aufwachen der App erneuert. Eine Home Assistant ohne Logo-Dienst (vor 2026.3) wird weiterhin nur einmal gefragt.

## [2.35.0] - 2026-10-13

App-Launcher: die Symbole und Farben von Home Assistant.

### Geändert

- App-Launcher: Die Apps von Home Assistant zeigen dasselbe Symbol und dieselbe Farbe wie die Seite, die sie öffnen, in den Einstellungen von Home Assistant, übernommen aus dem Frontend von Home Assistant selbst: ein Kreis in der Farbe der Seite mit weissem Symbol. Automationen, Szenen und Skripte sind grün, Helfer violett, Geräte, Entitäten, Integrationen und Bereiche indigo, Werkzeuge violettgrau, Backups blau; Verlauf und Logbuch haben in Home Assistant keine Farbe und bekommen eine aus dessen Palette. Die Apps des Device Panels (Timer, Magic Push, Protokoll) behalten ihr Symbol und bekommen eine Farbe derselben Palette; eigene Apps erhalten die Hauptfarbe, ein Favicon bleibt, wie es ist, ohne Kreis.
- Die Knöpfe der Favoriten in der Kopfzeile zeigen dasselbe Symbol wie der Launcher, ohne Farbe.

## [2.34.0] - 2026-10-13

Nicht veröffentlicht; enthalten in 2.35.0.

App-Launcher: Eigene Apps legt man nur im Bearbeiten-Modus an.

### Geändert

- App-Launcher, normale Ansicht: Die Kachel "Eigene App" (Plus) entfällt, ebenso die Überschrift "Eigene", wenn darunter nichts zu zeigen ist. Eine eigene App legt man im Bearbeiten-Modus an ("Bearbeiten", dann "Eigene App hinzufügen"). Die Überschrift erscheint wieder, sobald es eine eigene App gibt, die kein Favorit ist (ein Favorit steht nur bei den Favoriten; ist Ihre einzige eigene App ein Favorit, gibt es keinen Abschnitt "Eigene").

## [2.33.1] - 2026-10-13

Nicht veröffentlicht; enthalten in 2.35.0.

Favicon in Originalfarben, Launcher-Liste nur mit Titel, kein "Erneut starten" mehr bei den Timern.

### Behoben

- Favicon einer eigenen App: Es erschien blau eingefärbt und, wenn dunkel (zum Beispiel GitHub), im dunklen Design kaum sichtbar, weil es auf dem blauen Kreis der Symbole sass. Es behält jetzt seine Originalfarben auf einer hellen, abgerundeten Fläche, ohne den blauen Kreis, im Launcher (Raster und Liste), im Bearbeiten-Modus, in der Vorschau und im Knopf der Kopfzeile.

### Geändert

- Launcher, Listenansicht: Jede Zeile zeigt nur den Titel, nicht mehr den Pfad oder die Adresse darunter (der Bearbeiten-Modus zeigt sie weiter; die Suche findet Apps weiterhin auch über den Pfad).

### Entfernt

- Timer: Der Knopf "Erneut starten" im Geräte-Popup und im Fenster mit allen Timern entfällt. Er tat dasselbe wie der Schalter des Timers (wieder einschalten), den jede Karte ohnehin hat.

## [2.33.0] - 2026-10-13

App-Launcher: Favicon für eigene Apps mit externem Link.

### Hinzugefügt

- Eigene Apps mit externem Link können das Favicon der Seite statt eines Symbols verwenden. Im Formular gibt es dafür einen Schalter "Symbol | Favicon" (das Favicon nur bei eingeschaltetem "Externer Link") und den Knopf "Favicon laden" (nur bei einer gültigen Adresse mit https:// oder http://). Home Assistant holt das Symbol, nicht der Browser: Es liest die Seite nach `<link rel="icon">`, sonst nimmt es `/favicon.ico`. Das klappt auch bei http:// und bei Geräten im Heimnetz (Router), und der Browser lädt beim Öffnen des Launchers nichts von der fremden Seite. Grenzen: 5 Sekunden je Abruf, 100 KB, nur Bilder (PNG, ICO, GIF, JPEG, WebP, SVG, am Inhalt erkannt); es werden weder Cookies noch Zugangsdaten gesendet, und das Zertifikat wird nicht geprüft, damit Geräte mit eigenem Zertifikat gehen. Der Befehl ist nur für Administratoren.
- Das Favicon wird als kleines Bild bei der App in den Benutzerdaten von Home Assistant gespeichert und ersetzt das Symbol überall: Launcher (Raster und Liste), Bearbeiten-Modus, Vorschau und Knopf in der Kopfzeile. Zurück zu "Symbol" entfernt es. Meldungen erklären, warum kein Favicon kam (keins, zu gross, nicht erreichbar).

### Geändert

- Formular "Eigene App": Die Reihenfolge ist jetzt Name, externer Link, Adresse, Bild (Symbol oder Favicon), damit das Favicon freigegeben ist, bevor man dort ankommt.
- Fenster "Batterie" und KI-Einschätzung: Ein Gerät gilt als eines, das geladen wird (statt neue Batterien zu bekommen), nicht nur bei eingeschalteter Lademeldung, sondern auch, wenn es eine eigene Ladeanzeige hat (Binärsensor der Klasse "Batterie lädt" oder der Batteriestatus der Companion-App). Ein Anstieg heisst dann Laden ("Laden", "Aufgeladen", "seit dem Laden am …"), auch ohne Lademeldung. Geräte mit keinem von beiden behalten "Wechsel", weil das Panel dort Laden und neue Batterien nicht unterscheiden kann.

## [2.32.0] - 2026-10-13

Nicht veröffentlicht; enthalten in 2.33.0.

Debug-Modus über Neustarts, die KI-Einschätzung nennt einen Ladevorgang Laden.

### Geändert

- Protokoll, Debug-Modus: Der Schalter bleibt jetzt 48 Stunden eingeschaltet, auch über Neustarts von Home Assistant, und schaltet sich dann selbst aus (ein Eintrag im Protokoll sagt es). Neben dem Schalter steht immer "48 Std." und, solange er an ist, bis wann er läuft. Nach einem Neustart vermerkt ein Eintrag, dass der Modus wieder eingeschaltet wurde. Von Hand ausgeschaltet, endet er sofort. Die Einträge des Protokolls selbst liegen weiterhin nur im Arbeitsspeicher und gehen beim Neustart verloren.
- KI-Einschätzung: Ist für das Gerät die Lademeldung aktiv, geht ein Anstieg des Stands im Batterie-Verlauf der letzten 12 Monate als Ladevorgang an die KI ("battery_charges", "recent_charges") und nicht mehr als Batteriewechsel; der Standard-Prompt sagt ihr, einen solchen Anstieg Laden zu nennen. Geräte ohne Lademeldung behalten die Batteriewechsel.

### Behoben

- Timer: Ein einmaliger Timer ("In …" oder "Einmal") ist nach dem Lauf aus, und das Bearbeiten schaltet ihn nicht mehr von selbst wieder ein: Der Schalter "Aktiv" im Assistenten bleibt aus, und "Speichern" lässt ihn aus. Er muss von Hand wieder eingeschaltet werden (Schalter im Assistenten oder Schalter in der Liste). Ein noch nicht gelaufener Timer bleibt beim Bearbeiten an. Bisher hat das Bearbeiten eines erledigten Timers ihn stillschweigend wieder scharf gemacht.

## [2.31.1] - 2026-10-13

Nicht veröffentlicht; enthalten in 2.33.0.

App-Launcher: ruhigere normale Ansicht, mehr Platz in der Kopfzeile.

### Geändert

- Launcher, normale Ansicht: keine Herzen mehr an den Apps, nur eines hinter der Überschrift "Favoriten". Favoriten setzt man im Bearbeiten-Modus. Die gestrichelte Linie mit dem Handy-Hinweis erscheint nur im Bearbeiten-Modus, und der erste Favorit ist nicht mehr grösser als die anderen.
- Ein Favorit steht nur im Abschnitt "Favoriten", nicht noch einmal in seiner Gruppe (die Suche findet weiterhin jede App).
- Der Launcher behält seine Höhe, während man im Suchfeld tippt.
- Handy: mehr Platz zwischen den Knöpfen in der Kopfzeile (das Suchfeld ist dafür etwas schmaler).

## [2.31.0] - 2026-10-13

App-Launcher: nützliche Seiten mit einem Tipp, Favoriten in der Kopfzeile, eigene Links.

### Hinzugefügt

- App-Launcher: Ein Knopf in der Kopfzeile (Rastersymbol) öffnet einen Launcher mit Apps in drei Gruppen. Device Panel: Timer (die Übersicht aller Timer), Magic Push (die Einstellungen beim Reiter Magic Push) und das Protokoll. Home Assistant: Automationen, Szenen, Skripte, Helfer, Geräte, Entitäten, Integrationen, Werkzeuge, Bereiche, Verlauf, Logbuch und Backups (die Verwaltungsseiten nur für Administratoren). Eigene: eigene Links. Ein Suchfeld filtert die Apps.
- Favoriten: Das Herz an einer App legt sie als Knopf in die Kopfzeile; der Stoppuhr-Knopf der Timer ist dort nur noch der erste Favorit (der Standard). Bis zu fünf Favoriten; auf dem Desktop stehen alle in der Kopfzeile, am Handy nur der erste. Im Launcher zeigt eine gestrichelte Linie diese Grenze (senkrecht im Raster, waagrecht in der Liste). Das Zahnrad bleibt ganz rechts.
- Bearbeiten-Modus: Ziehen am Griff (oder die Pfeiltasten darauf) sortiert in jeder Gruppe; das Auge blendet eine App aus (eine ausgeblendete App ist kein Favorit mehr), das Herz setzt Favoriten, "Auf Standard zurücksetzen" stellt Auswahl, Reihenfolge und Ausgeblendetes wieder her (mit "Rückgängig"). Das Protokoll lässt sich nicht ausblenden, es ist der einzige Zugang zum Debug-Modus. Ein Schalter "Raster | Liste" wählt die Darstellung, getrennt für Desktop und Handy.
- Eigene Apps: Name, Symbol und Ziel. Ohne das Kontrollkästchen "Externer Link" ist das Ziel eine Seite von Home Assistant (beginnt mit "/"), sonst eine Adresse mit https:// oder http://, die immer in einem neuen Browser-Tab öffnet (`noopener noreferrer`, Home Assistant bleibt offen); andere Schemata wie javascript: werden abgelehnt. Externe Links tragen eine kleine Link-Marke. Eigene Apps lassen sich ändern, löschen (mit "Rückgängig") und zu Favoriten machen.
- Alles wird pro Benutzer in den Benutzerdaten von Home Assistant gespeichert (mit lokaler Kopie im Browser, der neuere Stand gewinnt), wie die Herzen der Geräte und Timer.

### Geändert

- Der Protokoll-Knopf ist aus dem Kopf der Einstellungen in den Launcher gewandert (App "Protokoll"). Der Stoppuhr-Knopf in der Kopfzeile ist jetzt der Favorit "Timer" und lässt sich dort entfernen.
- Die Beschriftung des Timer-Knopfs lautet "Timer" (vorher "Alle Timer").
## [2.30.0] - 2026-10-13

Nicht veröffentlicht; enthalten in 2.31.0.

Batterie-Verlauf: Ein Ladevorgang heisst Ladevorgang.

### Geändert

- Fenster "Batterie" (Verlauf): Ist für das Gerät die Lademeldung aktiv, heisst ein Anstieg des Stands nicht mehr "Wechsel" der Batterie, sondern Ladevorgang: Die Marke im Diagramm lautet "Laden", die Liste "Aufgeladen", und die Texte sagen "seit dem Laden am …" (auch bei der Prognose). Geräte ohne Lademeldung behalten "Wechsel".

## [2.29.1] - 2026-10-13

Nicht veröffentlicht; enthalten in 2.31.0.

Schmalere Scrollleisten ohne Pfeile.

### Behoben

- Scrollleisten auf dem Desktop: Die klassische Leiste mit Pfeilen lag in den runden Ecken der Popups, und die Pfeile wurden dort abgeschnitten. Die Leisten sind jetzt schmal, ohne Pfeile und halten Abstand zu den Ecken. In den Popups und in allen Listen mit eigener Scrollleiste.

## [2.29.0] - 2026-10-13

Mehr im Debug-Protokoll.

### Hinzugefügt

- Protokoll, Debug-Modus: Bei eingeschaltetem Schalter werden mehr Zwischenschritte aufgezeichnet. Ausfall: ein Gerät wird als ausgefallen erkannt (mit der Wartezeit bis zur Meldung), ein Ausfall, der vor einer Lücke begann, die Rückkehr eines Geräts (mit oder ohne Meldung), ein Gerät, das nicht mehr überwacht wird. Batterie: eine Zusammenfassung pro Prüfung (geprüfte, schwache, neue Geräte), nur wenn sich die Zahlen ändern. Timer: der geplante nächste Lauf oder das Zurückschalten. System: welche Einstellungen gespeichert wurden (nur die Namen, nie die Werte), Geräteeinstellungen und von Hand gesetzter Gerätetyp sowie das Entladen der Integration. Bei ausgeschaltetem Schalter wird nichts aufgezeichnet.

## [2.28.5] - 2026-10-13

Grössere Popups auf dem Desktop, abgerundete Ecken, Einstellungen, Gerät, Timer und Protokoll gleich gross.

### Geändert

- Desktop: Die grossen Fenster (Geräte-Popup, Einstellungen, Fenster mit allen Timern, Protokoll) haben jetzt dieselbe Grösse, 880 px breit, und sind bis zu 1100 px hoch statt 780 px, soweit der Bildschirm es zulässt. Die Fenster für Statistik, Puls und Notizen sind ebenfalls höher. Auf dem Handy ändert sich nichts.

### Behoben

- Einstellungen, Geräte-Popup und weitere Popups mit eigener Scrollleiste: Die rechten Ecken waren eckig, weil die Scrollleiste über der Rundung lag. Die Popups werden jetzt auf ihre runde Form beschnitten, die Scrollleiste bleibt innerhalb der Ecken.

## [2.28.4] - 2026-10-13

Nicht veröffentlicht; enthalten in 2.28.5.

Fenster mit allen Timern so gross wie die Einstellungen.

### Geändert

- Fenster mit allen Timern: Auf dem Desktop hat es jetzt dieselbe Grösse wie die Einstellungen und das Geräte-Popup (640 px breit statt 860 px).

## [2.28.3] - 2026-10-13

Fenster mit allen Timern auf dem Desktop als Popup.

### Geändert

- Fenster mit allen Timern: Auf dem Desktop ist es jetzt ein Popup wie das Protokoll (mittig, abgerundet, die Seite dahinter abgedunkelt) statt die ganze Seite zu füllen. Auf dem Handy (bis 700 px) bleibt es vollflächig. Der Hinweis oben nennt jetzt auch den Plus-Knopf.

## [2.28.2] - 2026-10-13

Timer-Assistent: "Jetzt ausführen" ist ein richtiger Knopf.

### Geändert

- Timer-Assistent: "Jetzt ausführen" ist kein kleiner Textlink mehr, sondern ein Knopf mit Rahmen, 44 px hoch und mit grösserer Schrift, damit er sich auf dem Touch-Bildschirm gut treffen lässt. Die Rückmeldung ("Ausgeführt.") steht daneben.

### Behoben

- Protokoll: Das Protokoll und der Debug-Modus bleiben beim Neuladen der Integration erhalten (verloren gehen sie nur beim Neustart von Home Assistant oder beim Entfernen der Integration). Hinweis: Das Speichern der Einstellungen lud die Integration nie neu; das Protokoll wird durch einen Neustart von Home Assistant geleert.

## [2.28.1] - 2026-10-13

Timer-Assistent: Der angezeigte Zustand aktualisiert sich nach "Jetzt ausführen".

### Behoben

- Timer-Assistent, Schritt "Was schalten": Nach "Jetzt ausführen" zeigte die Karte weiter den alten Zustand ("ein", obwohl gerade ausgeschaltet wurde). Die Zustände werden nach dem Schalten jetzt neu geholt.

## [2.28.0] - 2026-10-13

Testknopf im Timer-Assistenten.

### Hinzugefügt

- Timer-Assistent, Schritt "Was schalten": Ein Knopf "Jetzt ausführen" unter der Ergebniszeile schaltet die gewählte Entität mit der gewählten Aktion sofort, als Test. Es wird nichts gespeichert, es gibt keine Rückschaltung, keine Push-Meldung und keinen Protokolleintrag. Eine kurze Meldung sagt, ob es geklappt hat oder warum nicht (zum Beispiel "Das Gerät ist nicht erreichbar").

### Geändert

- Symbol in der Seitenleiste: ein Haus mit Balken ("home-analytics") statt des Symbols mit zwei Geräten, das wie Handys aussah. Home Assistant zeigt das alte Symbol unter Umständen, bis die Seite neu geladen wird.

## [2.27.1] - 2026-10-13

Einstellungen: Der Schliessen-Knopf steht rechts.

### Geändert

- Einstellungen: "Schliessen" (mit offenen Änderungen "Abbrechen") steht jetzt rechts und "Speichern" links, damit der schliessende Knopf wie in den Popups immer auf derselben Seite ist.

## [2.27.0] - 2026-10-13

Timer direkt im Fenster aller Timer hinzufügen.

### Hinzugefügt

- Fenster mit allen Timern: Ein "+"-Knopf in der Kopfzeile (zwischen Titel und Kreuz) startet den Timer-Assistenten. Es ist derselbe Assistent wie am Gerät, mit einem zusätzlichen ersten Schritt auf einer eigenen Seite: Zuerst wählst du das Gerät (Suche nach Name, Bereich oder Integration; aufgeführt sind nur Geräte mit etwas, das ein Timer schalten kann). Danach läuft alles wie gewohnt, und die Fortschrittsleiste zeigt fünf Schritte. Speichern oder Schliessen führt zurück zur Liste aller Timer.

## [2.26.0] - 2026-10-12

Lieblings-Timer (Herz), und der Titel in der Kopfzeile entfällt nur noch auf dem Handy.

### Hinzugefügt

- Fenster mit allen Timern: ein Herz rechts von "Löschen" auf jeder Timer-Karte markiert einen Lieblings-Timer. Sobald es mindestens einen gibt, hat die Filterleiste einen fünften Reiter mit Herz (und der Anzahl), der nur die Lieblings-Timer zeigt, ihre Geräte aufgeklappt, und das Fenster öffnet immer auf diesem Reiter. Wird der letzte Lieblings-Timer entfernt, verschwindet der Reiter. Die Herzen gehören dem Benutzer (gespeichert in den Benutzerdaten von Home Assistant wie die Favoriten-Geräte, sie folgen dir also auf andere Geräte).

### Geändert

- Timer-Assistent: Mit "Danach wieder zurückschalten" zeigt die Vorschau jetzt genau, wann zurückgeschaltet wird, auf die Minute: unter jeder nächsten Ausführung ("wieder aus: morgen 06:50") und im letzten Schritt unter "Nächste Ausführung". Gerechnet von Home Assistant mit dessen Zeitzone.
- Der Titel "Geräte" in der Kopfzeile ist auf breiten Bildschirmen (ab 700 px) wieder sichtbar; auf dem Handy bleibt er weg, wie in 2.25.0. Der Timer-Knopf bleibt auf beiden mittig.
- Dauern bei Timern werden genau angezeigt, bis auf die Sekunde, statt gerundet: 690 Minuten lauten jetzt "11 Std. 30 Min." (vorher "11 Std."), 90 Sekunden "1 Min. 30 Sek.". Das gilt für die Ergebniszeile im Assistenten, den Satz eines Timers und die Bereichsmeldungen.

### Behoben

- Fenster mit allen Timern: Ein Timer, der geschaltet hat und auf das Zurückschalten wartet ("Danach wieder zurückschalten"), gilt jetzt als laufend: Er steht im Reiter "Läuft" (und wird dort mitgezählt), und seine Karte sagt, wann er zurückschaltet ("wieder aus: heute 06:30"). Vorher galten nur Countdown-Timer als "läuft".
- Fenster mit allen Timern auf dem iPhone: Der Einleitungstext über dem Suchfeld änderte seine Grösse je nach Liste (grösser und dreizeilig bei leerer Liste), und Suchfeld und Reiterleiste verschoben sich. Das Panel schaltet jetzt die automatische Textvergrösserung von iOS ab, damit bleiben Text und Reiterleiste auf jedem Reiter gleich gross und gleich hoch.
- Fenster mit allen Timern: Nach dem Tippen einer Suche konnte das Kreuz im Suchfeld die alten Treffer stehen lassen (die Liste wurde nicht neu gezeichnet, weil sie unverändert aussah). Behoben; das gilt auch nach dem Auf- und Zuklappen von Geräten.

## [2.25.0] - 2026-10-12

Panel-Updates (Uhrzeit der täglichen Prüfung, Push-Meldung, roter Punkt bei ausstehendem Neustart) und eine schlankere Kopfzeile ohne Titel.

### Geändert

- Der sichtbare Titel "Geräte" über der Liste entfällt (die Anwendung heisst schon "Device Panel"); das Logo bleibt, das Suchfeld übernimmt den Platz. Für Screenreader bleibt der Titel erhalten.

### Hinzugefügt

- Ein kleiner roter Punkt am Zahnrad-Knopf, solange ein Panel-Update installiert ist und der Neustart noch aussteht (HACS hat die neue Version auf der Platte, während die alte läuft). Er verschwindet nach dem Neustart; die Beschriftung lautet "Neustart steht aus".
- Einstellungen › Panel-Updates › "Uhrzeit der Prüfung": Die tägliche Prüfung läuft zu einer gewählten Uhrzeit (Zeit von Home Assistant). Leer, der Standard, bleibt wie bisher: zufällig nach dem Start von Home Assistant, danach alle 24 Stunden. "Automatisch" setzt zurück.
- Einstellungen › Panel-Updates › "Per Push melden": eine Push-Meldung, einmal pro Version. Ohne automatische Installation meldet sie, dass eine neue Version verfügbar ist; mit automatischer Installation meldet sie nach dem Installieren, dass die Version installiert ist und der Neustart aussteht (scheitert die Installation, kommt stattdessen die Meldung "verfügbar"). Der Empfänger (Gruppe, Dienst oder Entität) ist in einer Zeile darunter wählbar; Standard ist das Push-Ziel der Übersicht. Ein Tipp auf die Meldung öffnet das Panel. Nur mit eingeschalteter täglicher Prüfung.

## [2.24.1] - 2026-10-12

### Hinzugefügt

- Das Fenster mit allen Timern (Stoppuhr-Knopf) hat jetzt auch "Löschen", mit derselben Rückfrage wie im Geräte-Reiter. Es hat weiterhin kein "Jetzt ausführen" und keine Möglichkeit, Timer anzulegen.

### Geändert

- Der Stoppuhr-Knopf in der Kopfzeile sitzt genau in der Mitte zwischen seinem linken Nachbarn (Suchfeld, auf breiten Bildschirmen der Knopf "Ansicht") und dem Zahnrad: auf beiden Seiten derselbe Abstand (15 px auf dem Handy, wo das Suchfeld so breit bleibt wie vorher; 22 px auf breiten Bildschirmen).
- Auf dem Handy öffnet jetzt auch das Geräte-Popup als Vollbild, wie die Einstellungen und das Blatt "Ansicht". Der Hintergrund zum Antippen entfällt, das Kreuz und "Schliessen" schliessen es.

## [2.24.0] - 2026-10-12

Einstellungen und Blatt "Ansicht" öffnen auf dem Handy als Vollbild, die Aktionen der Karten sind besser zu treffen, und der Timer-Assistent speichert auf jeder Seite.

### Hinzugefügt

- Timer-Assistent: ein Knopf "Speichern" auf jeder Seite (zwischen "Zurück" und "Weiter"), freigegeben, sobald alle Schritte gültig sind. Wer nur die Zeit eines bestehenden Timers ändert, muss nicht mehr durch alle vier Schritte klicken: ändern, speichern, das Fenster schliesst. Auf der letzten Seite bleibt das gewohnte "Speichern".

### Geändert

- Auf dem Handy füllen die Einstellungen und das Blatt "Ansicht" (Sortierung und Darstellung) jetzt den ganzen Bildschirm (wie das Fenster aller Timer), statt oben einen Streifen der Liste freizulassen. Der Hintergrund zum Antippen entfällt, das Kreuz schliesst.
- Auf dem Handy sind die Aktionen auf den Karten der Übersichten von Timer und Magic Push ("Bearbeiten", "Löschen", "Gerät öffnen") besser zu treffen: grössere Schrift, 44 px hohe Trefferflächen und etwas mehr Abstand. Auf breiten Bildschirmen ändert sich nichts.

## [2.23.1] - 2026-10-12

Automatische Updates installieren, sobald eine Version gefunden wird.

### Behoben

- "Updates automatisch installieren" startet die Installation jetzt, sobald irgendeine Prüfung eine neuere Version findet,
  wie gedacht. Vorher lief es nur nach der täglichen Prüfung und im Panel nur bei "Nach Updates suchen"; beim Öffnen der
  Einstellungen stand "Version verfügbar", ohne dass installiert wurde. Jetzt löst jede Erkennung es aus: die Prüfung nach
  dem Start von Home Assistant, die tägliche Prüfung, das Öffnen der Einstellungen und "Nach Updates suchen". Im Panel gibt
  es pro Version und Sitzung einen Versuch (ein Fehlschlag wird nicht in einer Schleife wiederholt; "Nach Updates suchen"
  versucht es erneut).
- Vor der Installation lässt die Integration HACS die Versionen dieses Repositories neu laden (wie das Panel). HACS selbst
  prüft nur alle paar Stunden und kannte ein frisches Release oft noch nicht, darum startete die Installation nicht.
  Das nutzt HACS-Interna bestmöglich; ohne sie bleibt es beim Aktualisieren der Update-Entität. Kennt HACS die neue
  Version noch nicht, steht das im Protokoll (Debug-Modus) und es wird bei der nächsten Prüfung erneut versucht.
- Home Assistant startet weiterhin nie von selbst neu.

### Hinzugefügt

- Einstellungen › Timer hat eine neue Zeile "Empfänger" (wie bei den Reitern der Überwachung und Meldungen): die Gruppe, der Dienst oder die Entität, die die Meldungen aller Timer erhält (Fehlermeldung und "Per Push melden"). Standard ist das Push-Ziel der Übersicht, wie bisher. Ein Empfänger am einzelnen Timer geht weiterhin vor; der Assistent zeigt den wirksamen Standard.

### Geändert

- Der Protokoll-Knopf ist aus der Kopfzeile der Geräteliste in den Kopf des Einstellungsdialogs gewandert, links vom
  Kreuz. So hat die Kopfzeile wieder Platz (sie wurde mit dem Timer-Knopf eng). Das Protokoll öffnet wie bisher, jetzt
  über den Einstellungen.
- Die Sammlung aller Timer ist aus Einstellungen › Timer entfernt; sie steht im Fenster hinter dem Stoppuhr-Knopf in der
  Kopfzeile der Geräteliste. Der Abschnitt behält nur die Optionen (alle Timer pausieren, Verpasste Timer nachholen, Bei
  Fehler benachrichtigen).
- "Bei Fehler benachrichtigen" ist jetzt genau beschrieben (Info-Knopf bei der Option, Hinweis im Assistenten,
  Optionstext in der Integration): Es ist eine normale Push-Meldung (Dienst, Gruppe oder Entität), keine anhaltende
  Benachrichtigung in Home Assistant und nichts unter Reparaturen. Sie kommt erst, nachdem der Timer es dreimal versucht
  hat (sofort und zwei weitere Male im Abstand von 5 Minuten), auch beim Zurückschalten. Sie geht an den eigenen
  Empfänger des Timers, sonst an das Push-Ziel unter "Überwachung und Meldungen"; steht dort "Keine Meldung", wird
  nichts gesendet und es steht nur im Protokoll (Kategorie Timer). Ein Timer mit "Per Push melden" sendet sie immer. Auf
  dem Handy ersetzt eine neuere Meldung desselben Timers die ältere. Verpasste Läufe (Home Assistant lief nicht) und
  pausierte Timer melden nichts, sie stehen nur im Protokoll.
- Überall derselbe Abstand zwischen benachbarten runden Knöpfen in den Kopfzeilen, damit sie sich gut mit dem Finger
  treffen lassen: 22 px zwischen Protokoll-Knopf und Kreuz in den Einstellungen, zwischen Stoppuhr-Knopf und Zahnrad in
  der Kopfzeile der Geräteliste und zwischen Herz und Kreuz im Geräte-Popup (wie bisher).

## [2.23.0] - 2026-10-12

Ein Fenster mit allen Timern, überall dasselbe Symbol für Timer und ein besserer Favoriten-Chip auf dem Handy.

### Hinzugefügt

- Neuer Stoppuhr-Knopf (⏱️, dasselbe Symbol wie der Reiter "Timer") in der Kopfzeile der Geräteliste, neben Protokoll und Zahnrad. Er öffnet ein Vollbild-Fenster mit
  allen Timern aller Geräte, nach Gerät gruppiert, damit klar ist, zu welchem Gerät jeder gehört (Suche, Filter Alle,
  Aktiv, Aus, Läuft, alle einklappen, "Gerät öffnen"). Dort lässt sich ein Timer bearbeiten (der Assistent öffnet
  darüber) und ein- oder ausschalten. Neue Timer legst du dort nicht an (das bleibt im Reiter "Timer" eines Geräts),
  und löschen oder ausführen geht dort auch nicht.

### Geändert

- Timer haben überall dasselbe Symbol: die Stoppuhr (⏱️), auch auf dem neuen Knopf in der Kopfzeile und im Fenster mit allen Timern.
- Der Chip "Favoriten" ist etwas breiter (42 px) und schrumpft in der scrollenden Chip-Leiste auf dem Handy nicht mehr
  (er wurde auf etwa 18 px gestaucht), damit das Herz nicht eingequetscht wirkt. Das Herz im Geräte-Popup sitzt etwas
  weiter vom Kreuz entfernt.

## [2.22.0] - 2026-10-12

Favoriten und automatische Updates (beides Wunsch des Nutzers): ein Herz auf der Geräteseite mit einem Filter-Chip, der nur ein rotes Herz zeigt, und eine Option, Updates automatisch zu installieren.

### Hinzugefügt

- Herz am oberen Rand des Geräte-Popups, links vom Kreuz. Ein Tipp markiert das Gerät als Favorit (rotes, gefülltes
  Herz) oder nimmt die Markierung weg. Es gilt sofort, ohne "Speichern", wie das Umbenennen. Die Favoriten gehören dem
  einzelnen Benutzer (in den Benutzerdaten von Home Assistant gespeichert, mit lokaler Kopie als Rückfall) und sind auf
  Desktop und Handy dieselben.
- Neuer Filter-Chip "Favoriten": nur ein kleines rotes Herz, ohne Text und Zahl, damit er wenig Platz braucht. Er zeigt
  die mit dem Herz markierten Geräte; ein zweiter Tipp oder "Alle" hebt den Filter auf. Standardmässig ist er der
  zweite Chip, gleich nach "Alle", aktiv und nicht angeheftet (angeheftet bleibt standardmässig nur "Alle"). Wie die
  übrigen Chips lässt er sich ausblenden (Einstellungen › Darstellung › Filter-Chips; "Favoriten") und per Ziehen
  verschieben. Installationen mit gespeicherter Chip-Folge bekommen ihn gleich nach "Alle" (hinter der Anheft-Linie),
  bis sie ihn verschieben.
- Updates automatisch installieren (Einstellungen › Panel-Version, neuer Schalter unter "Täglich nach Updates suchen").
  Eingeschaltet installiert die Integration eine neuere Version gleich nach ihrer täglichen Prüfung über HACS (wie der
  Knopf "Aktualisieren"), auch bei geschlossenem Panel. Das geht nur zusammen mit der täglichen Prüfung: ist sie aus,
  ist der Schalter gesperrt und ohne Wirkung. Eine Vorabversion wird nur installiert, wenn Vorabversionen angeboten
  werden. Home Assistant startet nie von selbst neu: Nach der Installation steht im Protokoll (Kategorie "Updates") und
  unter Einstellungen → Reparaturen, dass ein Neustart nötig ist, und das Panel zeigt "Jetzt neu starten". Wer von Hand
  nach Updates sucht und eine Version findet, bekommt sie sofort installiert, ohne ein zweites Mal "Aktualisieren" zu
  drücken. Eine fehlgeschlagene Installation steht im Protokoll und wird bei der nächsten täglichen Prüfung wiederholt.
  Ohne HACS geschieht nichts. Der Schalter ist eine Panel-Einstellung für die ganze Instanz und gilt mit "Speichern".

### Geändert

- Timer "Einmal": Ein Datum ist optional. Ein neuer Schalter "Bestimmtes Datum" (standardmässig aus) zeigt das
  Datumsfeld; beim Einschalten steht das morgige Datum darin. Ohne Datum schaltet der Timer, wenn die gewählte Uhrzeit
  das nächste Mal eintrifft, heute oder morgen. Danach ist er immer ausgeschaltet und muss neu aktiviert werden (das
  ist der Unterschied zu "Täglich"); beim erneuten Einschalten wartet er auf das nächste Mal. Mit Datum funktioniert
  alles wie bisher. In der Liste steht ein solcher
  Timer als "einmalig" und "Einmalig, nächstes Mal um 06:30".
- Der Schalter auf den Timer-Karten im Geräte-Popup ist etwas grösser (44 × 24 px statt 36 × 20 px).
- Geräte-Popup auf dem Handy: Die kleinen Symbole bleiben. Das Symbol des Reiters "Magic Push" ist jetzt eine Glocke (🔔)
  statt der Funken, die zu wenig nach Benachrichtigung aussahen.

## [2.21.0] - 2026-10-12

Timer: eine Entität eines Geräts einmalig oder nach Plan schalten (Wunsch des Nutzers).

### Hinzugefügt

- Neuer Reiter "Timer" im Geräte-Popup (jetzt der fünfte Reiter, nach "Magic Push"). Ein Timer schaltet eine schaltbare
  Entität des Geräts (Schalter, Licht, Ventilator, Luftbefeuchter, Sirene, input_boolean, Rollladen, Ventil, Schloss).
  Angeboten werden nur Entitäten, die zum Gerät gehören. Aktionen: Einschalten, Ausschalten, Umschalten (bei Rollläden
  und Ventilen Öffnen und Schliessen, bei Schlössern Verriegeln und Entriegeln; Schlösser haben kein Umschalten). Der Reiter listet die Timer des Geräts als Uhr-Karten mit der nächsten
  Ausführung, einem Schalter zum Ein- und Ausschalten und den Aktionen "Bearbeiten", "Ausführen" und "Löschen"
  (mit Rückfrage). Ein Timer mit Countdown zeigt einen Ring mit der Restzeit.
- Der Assistent für einen neuen Timer öffnet in einem eigenen Fenster (auf dem Handy als Vollbild), vier Schritte:
  1. was schalten (Entität, Aktion, auf Wunsch "Danach wieder zurückschalten" nach 10 Min., 30 Min., 1 Std. oder eigener
  Zeit), 2. wann ("In ..." als Countdown, "Einmal" an einem Datum zu einer Uhrzeit, "Wiederholt" täglich, wöchentlich
  mit Wochentagen oder monatlich an einem Tag des Monats, auch "letzter Tag"), 3. ob per Push gemeldet wird, 4. Name
  (leer = Name der Entität) und Prüfung mit den nächsten Ausführungen. Falsche Eingaben erscheinen beim Feld und sperren
  "Weiter". Schliessen mit Änderungen fragt "Änderungen verwerfen?".
- Per Push melden (Schalter, pro Timer, standardmässig aus): eine Erinnerung aufs Handy in dem Moment, in dem der Timer
  schaltet, damit man eine Kontrolle hat. Der Inhalt ist fest und bei jedem Timer gleich ("Timer: <Name>", "<Entität> ist
  jetzt ein · 11:15"), der Assistent zeigt eine Vorschau und "Test senden". Der Empfänger ist wählbar (Dienste, Gruppen,
  Entitäten wie in "Überwachung und Meldungen"); Standard ist das Push-Ziel aus dem ersten Menü der Einstellungen, und
  ein Timer ohne eigene Wahl folgt einer späteren Änderung davon. Ein Push kommt nur, wenn der Timer wirklich schaltet,
  nicht beim Bearbeiten. Auch Fehler werden gemeldet (abschaltbar).
- Neuer Abschnitt "Timer" in den Einstellungen (aufklappbar, gleicher Ansatz wie Magic Push): eine Karte pro Gerät mit
  allen Timern, Suche, Filter (Alle, Aktiv, Aus, Läuft), "Alle einklappen", ein- und ausschalten, bearbeiten (öffnet
  das Popup des Geräts im Assistenten), ausführen, löschen. Darunter die allgemeinen Optionen: "Alle Timer
  pausieren", "Verpasste Timer nachholen" (Minuten, 0 bis 60, Standard 10) und "Bei Fehler benachrichtigen".
- Die Steuerung läuft in Home Assistant, nicht im Browser: Ein Timer schaltet auch bei geschlossenem Panel. Sie nutzt die
  Zeitzone von Home Assistant (Sommerzeit wird beachtet; ein monatlicher Timer am 31. läuft in kürzeren Monaten am
  letzten Tag). Ein einmaliger oder Countdown-Timer schaltet sich danach selbst aus und bleibt als "Erledigt" in der
  Liste (ein Countdown-Timer verschwindet nach einem Tag); "Erneut starten" setzt eine neue Zeit. Die nächste
  Ausführung übersteht einen Neustart. Ausführungen, die weiter zurückliegen als das Nachhol-Fenster (Pause,
  Neustart), werden übersprungen und protokolliert (ein wiederholter Timer rückt auf die nächste Ausführung). Ein
  fehlgeschlagenes Schalten wird zweimal nach 5 Minuten wiederholt.
- Protokoll: Timer-Läufe, manuelle Läufe, Zurückschalten, Wiederholungen, Fehler, übersprungene Läufe, pausierte
  Timer und fehlende Ziele erscheinen im Protokoll unter der Kategorie "Timer".

### Geändert

- Die Reiterleiste des Geräte-Popups hat fünf Reiter. Auf dem Handy (Breite bis 600 px) zeigen die Reiter ein kleines
  Symbol über dem Text, damit alle fünf in einer Zeile Platz haben.
- Handy: Die Kurve in der Zeile "Ausfall-Puls" reicht jetzt von der Mitte der Kachel bis zum rechten Rand (vorher auf
  112 px zusammengepresst). Der Titel der Zeile kann auf schmalen Handys auf zwei Zeilen umbrechen.

## [2.20.0] - 2026-10-12

Speichern funktioniert überall gleich, und das helle Design wirkt nicht mehr ausgegraut (beides Wunsch des Nutzers).

### Geändert

- Änderungen im Geräte-Popup gelten jetzt erst mit "Speichern", wie im Einstellungsdialog (Zahnrad). Das betrifft den
  Typ, die Verbindungsart und alle Einstellungen eines Geräts (Ausfall, Meldungen, Batterie, Laden, Empfang). Bis dahin
  zeigt das Gerät die gewählten Werte, der Fuss zeigt "n Änderungen" mit "Abbrechen" und "Speichern", und es wird
  nichts gesendet. "Speichern" sendet je Art einen Aufruf (Typ, Verbindungsart, Einstellungen) und lässt das Popup mit
  "Gespeichert" offen. Eine Änderung, die wieder auf den alten Wert steht, zählt nicht. Der Entwurf übersteht das
  Auffrischen der Liste, das alle 10 Sekunden läuft.
- Schliessen mit ungespeicherten Änderungen (Knopf "Abbrechen", Kreuz, Tipp auf den Hintergrund, Escape oder "HA-Geräteseite
  öffnen") fragt in einem Pop-up in der Mitte "Änderungen verwerfen?" mit "Weiter bearbeiten" oder "Verwerfen", dasselbe
  Pop-up wie im Assistenten von Magic Push. Das gilt jetzt für das Geräte-Popup und für den Einstellungsdialog (Zahnrad).
  Ohne Änderung schliesst alles sofort. Schlägt das Speichern fehl, bleibt der Entwurf stehen und der Fehler erscheint
  beim Wert.
- Weiterhin sofort (ohne Entwurf): ein Gerät umbenennen, ein Gerät ausblenden, die Listenaktionen von Magic Push
  (ein- oder ausschalten, löschen), die Dialoge "Anpassen" und die Filter. Jedes davon ist eine einzelne Aktion, keine
  Gruppe von Einstellungen.

### Behoben

- Helles Design: Das Geräte-Popup und der Einstellungsdialog (Zahnrad) wirken nicht mehr ausgegraut. Die durchscheinende
  Glasoptik, gedacht für das dunkle Design, wurde über dem abgedunkelten Hintergrund grau. Im hellen Design sind die
  Fenster, Kopf, Reiter und Knöpfe jetzt rein weiss (Kacheln nur ganz leicht abgesetzt); grau erscheint nur beim
  Darüberfahren. Das dunkle Design und das Blatt auf dem Handy (Breite bis 600 px) bleiben unverändert; grau war das Desktop-Fenster.

## [2.19.0] - 2026-10-12

Live-Aktivität beim Laden (iPhone) und Live-Update (Android 16).

### Hinzugefügt

- Ein Gerät, das lädt, kann seinen Fortschritt jetzt als Live-Aktivität auf dem Sperrbildschirm und in der Dynamic Island
  (iPhone, Companion-App, ab iOS 17.2) oder als Live-Update (Android 16) zeigen (Wunsch des Nutzers). Sie zeigt "62 % von
  80 %" mit Fortschrittsbalken, das Ziel ist das "Voll ab" des Geräts, also nicht immer 100 %. Sie läuft unabhängig von der
  Push-Meldung "Laden melden". Standardmässig aus; einschalten global (Reiter "Laden"), pro Integration (Reiter
  "Integrationen", Abschnitt "Laden") oder pro Gerät (Geräte-Popup, Gruppe "Laden"); das Gerät geht vor, wie bei den
  anderen Lade-Einstellungen. Empfänger ist das Ziel des Reiters "Laden" (ein notify-Dienst oder eine Gruppe; eine
  notify-Entität kann das nicht).
- Stille Updates: der Start darf melden, jedes weitere Update ist still (iOS `silent`, Android `alert_once`), höchstens
  alle 4 Minuten und nur, wenn sich der Prozentwert geändert hat; so vibriert das Telefon nicht bei jedem Aktualisieren.
  Ist das Ziel erreicht, zeigt die Aktivität 10 Minuten "Geladen" und wird dann entfernt (`clear_notification`). Sie endet
  auch, wenn die Ladung endet (Stand unverändert für die Zeit "Ladung beendet nach") oder das Ladegerät abgezogen wird.
- Wischt der Nutzer die Aktivität weg, kommen für diese Ladung keine Updates mehr (sonst startete jedes Update eine neue,
  auf iOS mit Benachrichtigung). Android meldet das mit `mobile_app_notification_cleared`; für iOS sendet Core noch kein
  Ereignis (Pull Request home-assistant/core#183255 ist noch offen), die Integration hört auf
  `mobile_app_live_activity_dismissed` und nutzt es, sobald Core es liefert. Bis dahin kommt eine weggewischte Aktivität
  mit dem nächsten Update zurück (frühestens nach 4 Minuten). Bei einer notify-Gruppe als Ziel lässt sich nicht
  unterscheiden, welches Telefon es war, darum stoppt das ganze Ziel.
- Die Live-Aktivität überlebt einen Neustart von Home Assistant. Das Aktivitätsprotokoll zeigt Start, Ziel, Ende und
  Wegwischen.
- Optionsdialog: neue Option "Laden: Live-Aktivität beim Laden".

## [2.18.0] - 2026-10-12

Nicht veröffentlicht; enthalten in 2.19.0.

Überwachung und Meldungen: ein eigener Empfänger pro Reiter.

### Hinzugefügt

- Jeder Reiter mit Meldungen (Ausfall, Batterie, Laden, Neu, Updates) kann jetzt einen eigenen Empfänger haben (Wunsch
  des Nutzers). Im Reiter steht direkt unter "Meldung" die neue Zeile "Empfänger". "Standard" folgt dem Ziel aus dem Reiter
  "Übersicht" und ist die Vorgabe, für bestehende Installationen ändert sich also nichts. Statt dessen lässt sich ein
  anderer notify-Dienst, eine Gruppe oder eine Entität wählen; "Kein Ziel" gibt es dort nicht (Meldungen ausschalten geht
  mit dem Schalter des Reiters). Ein Reiter mit eigenem Ziel sendet auch dann, wenn das globale Ziel "Kein Ziel" ist.
  Zeitstrahl der Übersicht, Liste der Integrationen und die Warnung "Ohne Ziel kommt kein Push" berücksichtigen das Ziel
  des Reiters. Ein Ziel, das es nicht mehr gibt, bleibt wählbar (als fehlend markiert), wie beim globalen.

## [2.17.2] - 2026-10-12

Nicht veröffentlicht; enthalten in 2.19.0.

Magic Push: die Schrittbalken des Assistenten stehen immer gleich hoch.

### Behoben

- Die Schrittbalken oben im Assistenten springen nicht mehr von Schritt zu Schritt (vom Nutzer gemeldet): Ein Symbol in
  der Zeile darüber (zum Beispiel das Thermometer ab Schritt 2) machte diese Zeile auf dem Handy höher, sodass die Balken
  einige Pixel tiefer standen als in Schritt 1. Die Zeile hat jetzt eine feste Höhe, und ein langer Name der Entität wird
  mit "..." gekürzt statt umgebrochen.

## [2.17.1] - 2026-10-12

Magic Push: robuster bei Absturz und Neustart von Home Assistant.

### Behoben

- Nach einer Meldung ("ausgelöst" oder "wieder normal") wird der Stand jetzt sofort gespeichert statt erst nach bis zu
  5 Sekunden. Stürzte Home Assistant direkt nach dem Senden ab oder fiel der Strom aus (kein sauberes Herunterfahren),
  wusste es nach dem Start nicht, dass die Meldung schon raus war, und sendete dieselbe noch einmal. Ein sauberes
  Herunterfahren war nicht betroffen.
- "Ändert sich" mit Dauer ("der neue Wert muss bleiben für mindestens ...") überlebt jetzt einen Neustart: die laufende
  Wartezeit wird mitgespeichert und läuft nach dem Start weiter. War die Zeit während des Ausfalls abgelaufen und der Wert
  noch derselbe, kommt die Meldung gleich beim Start; hat sich der Wert inzwischen zurückgeändert, wird nichts gesendet.
  Vorher ging so eine Änderung verloren.

### Geändert

- Die Schrittbalken oben im Assistenten sind etwas dicker (6 statt 4 px) und haben eine grössere Tippfläche (34 statt
  24 px), damit sie besser zu treffen und deutlicher zu sehen sind (Wunsch des Nutzers).
- Der Pfeil zum Auf- und Zuklappen ist in Magic Push jetzt überall derselbe (Wunsch des Nutzers): bei den Bedingungs-
  Karten, bei der Auswahl des Empfängers in Schritt 3, bei "Freie Entität wählen" und bei den Geräte-Karten in den
  Einstellungen. Vorher hatten Schritt 3 und die Übersicht ein kleines Text-Dreieck in anderer Grösse, das beim Öffnen
  sogar die Grösse wechselte. Jetzt ist es überall derselbe grössere Pfeil, zu: nach unten, offen: nach oben.

## [2.17.0] - 2026-10-12

Magic Push: "Zurücksetzen erst nach" einer Dauer, gegen Flattern um die Schwelle.

### Hinzugefügt

- Neue Einstellung in Schritt 2 ("Wie lange"): "Zurücksetzen erst, wenn es nicht mehr gilt für mindestens" (Wunsch des
  Nutzers). Die Meldung gilt erst als erledigt ("wieder normal", und eine neue Meldung ist möglich), wenn die Bedingung so
  lange durchgehend nicht mehr gegolten hat. Ein Wert, der kürzer um die Schwelle schwankt, bleibt eine Meldung, statt
  "Meldung, wieder normal, Meldung, ..." hintereinander zu schicken. Gleiche Bedienung wie "für mindestens": Sofort,
  1 Min., 5 Min., 10 Min., 30 Min., 1 Std. oder eigene Zeit (bis 7 Tage). Es lässt sich mit "Eigener Wert" kombinieren (die
  Zeit beginnt erst, wenn der Rücksetzwert erreicht ist) und mit mehreren Bedingungen (gilt für das Ganze). Nicht
  verfügbar bei "ändert sich".
- Der Rückblick (Seite 2) berücksichtigt die Einstellung: kurze Unterbrüche gehören zur selben Episode.

### Geändert

- Neue Meldungen starten mit 1 Min.; "Sofort" ergibt das bisherige Verhalten. Bestehende Meldungen behalten "Sofort",
  für sie ändert sich nichts, bis man sie bearbeitet.

## [2.16.0] - 2026-10-12

Nicht veröffentlicht; enthalten in 2.17.0.

Magic Push: die Rückfrage "Änderungen verwerfen?" als Pop-up in der Mitte.

### Geändert

- Schliesst man den Assistenten mit nicht gespeicherten Änderungen (Wunsch des Nutzers), fragt er "Änderungen verwerfen?"
  jetzt in einem Pop-up in der Mitte des Fensters mit abgedunkeltem Hintergrund, nicht mehr in der Knopfleiste unten. So
  fällt sie auf. Alles dahinter ist gesperrt, bis man antwortet, und der Fokus liegt auf "Weiter bearbeiten", damit Enter
  nichts verwirft.
- Die Bedingungs-Karten in Schritt 1 sind mit dem Finger leichter zu treffen (Wunsch des Nutzers): der Pfeil zum
  Zuklappen ist grösser und heller, das "x" zum Entfernen einer Bedingung oder Gruppe hat eine Fläche von 44 px mit
  grösserem Symbol.

## [2.15.0] - 2026-10-11

Magic Push: mehrere verknüpfte Bedingungen (Und/Oder, mit Gruppen), alle auf der ersten Seite des Assistenten.

### Hinzugefügt

- Magic Push kann mehrere Bedingungen verknüpfen (Wunsch des Nutzers, Mockups `docs/mockups/magic-conditions-v1`). Auf der
  ersten Seite des Assistenten kommen Bedingungen mit "+ Bedingung" dazu: jede mit eigener Entität (auch von anderen
  Geräten), Art (über, unter, ist) und Wert, mit Diagramm der letzten 24 Stunden. Zwei oder mehr Bedingungen verbindet
  "Und" oder "Oder"; ein Satz "Melden, wenn ..." zeigt, was die Meldung tut. "+ Gruppe" setzt einen Kasten, in dem die
  Bedingungen andersherum verknüpft sind ("alle" oder "eine genügt"), zum Beispiel "A und (B oder C)". Eine Ebene
  Gruppen, höchstens 10 Bedingungen und 4 Gruppen.
- Jede Bedingung hat ihren eigenen Rücksetzwert ("Zurücksetzen"), so behält jede ihre eigene Zone gegen Flattern.
  "Ändert sich" kann nur die einzige Bedingung einer Meldung sein.
- Neue Textvariable `{conditions}`: die Bedingungen als Satz, zum Beispiel "Temperatur über 25 °C und Fenster ist offen".
- Der Rückblick (Seite 2) zeigt eine Zeitleiste je Bedingung und eine Zeile "Zusammen" mit den Zeitpunkten, zu denen die
  Meldung gekommen wäre.
- Übersicht und Meldungsliste zeigen die ganze Bedingung als Satz.

### Geändert

- Der Assistent hat wieder fünf Schritte, aber in neuer Reihenfolge: 1 Bedingungen (Entität und Bedingung, eine oder
  mehrere) · 2 Wie lange (Dauer und Rückblick) · 3 Versand · 4 Text · 5 Name. "Wie lange", "Wiederholen" und "Auch melden,
  wenn wieder normal" gelten für die ganze Bedingung.
- Bei "Und" bedeutet eine Bedingung `unavailable` oder `unknown`, dass nichts passiert; bei "Oder" wird sie übergangen,
  solange eine andere entscheidet. Die erste Bedingung steht weiterhin in den alten Feldern, bestehende Meldungen laufen
  unverändert weiter.

## [2.14.0] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.15.0.

Magic Push: eine Vorschau unter jeder Nachricht.

### Geändert

- Schritt 4 des Assistenten ("Text") zeigt jede Vorschau jetzt direkt unter ihren eigenen Feldern (Wunsch des Nutzers):
  Titel und Inhalt der Meldung, ihre Variablen, dann die Vorschau mit "Test senden"; darunter "Auch melden, wenn wieder
  normal" mit eigenem Titel, Inhalt und eigenen Variablen und wieder einer eigenen Vorschau mit eigenem "Test senden".
  Vorher standen beide Vorschauen zusammen unten. Schritt 5 (Zusammenfassung) zeigt beide Vorschauen weiterhin zusammen.

## [2.13.1] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.14.0.

### Behoben

- Magic Push auf dem Handy: "Freie Entität wählen" scrollte die Liste zu weit, das Suchfeld war nicht mehr zu sehen. Das
  Assistenten-Fenster folgt jetzt der sichtbaren Fläche über der Tastatur (auch wenn das Handy die Seite hochschiebt) und
  scrollt nur seinen eigenen Inhalt, sodass das Suchfeld oben in dem steht, was sichtbar ist. "Zurück"/"Weiter" bleiben
  ebenfalls über der Tastatur.

## [2.13.0] - 2026-10-11

Magic Push: Übersicht in den Einstellungen mit Struktur, Suche und Filter.

### Geändert

- Die Übersicht "Magic Push" in den Einstellungen (Überwachung und Meldungen) gruppiert die Meldungen jetzt in einer Karte
  pro Gerät (Wunsch des Nutzers, Mockups `docs/mockups/magic-overview-v1`, Variante B). Der Kopf der Karte zeigt das Gerät
  (Symbol, Name, Bereich und Integration, rote Marke "ausgefallen") und die Zahl seiner Meldungen; die Meldungen stehen in
  der Karte, je mit Schalter, "Bearbeiten" und "Löschen", am Ende "Gerät öffnen". Ein Tipp auf den Kopf klappt die Karte
  zu; zu zeigt sie eine Kurzfassung ("2 Meldungen · 1 aus · 1 ausgelöst", "gerade nicht erreichbar"). Über der Liste
  steht "Alle einklappen" / "Alle ausklappen". Bei mehr als drei Geräten beginnen alle Karten zu. Der Zustand bleibt
  erhalten, solange die Einstellungen offen sind.

### Hinzugefügt

- Suchfeld über der Übersicht, wie in den anderen langen Listen der Einstellungen: Es durchsucht Name, Satz, Gerät, Bereich,
  Integration, Empfänger und Entitäts-ID (mehrere Wörter müssen alle vorkommen), zeigt "n von m" und hat ein Kreuz.
- Filter "Alle / An / Aus / Ausgelöst" mit den Zahlen (Ausgelöst: die Bedingung gilt gerade). Suche und Filter klappen die
  Treffer auf; ohne sie sind die Karten wie vorher.

## [2.12.0] - 2026-10-11

Magic Push: neue Reihenfolge der Schritte.

### Geändert

- Der Assistent von Magic Push fragt jetzt zuerst, wohin die Meldung geht, und dann, was darin steht (Wunsch des Nutzers).
  Schritt 3 ist "Versand": Empfänger, kritische Mitteilung mit Lautstärke und Wiederholen. Schritt 4 ist "Text": Titel und
  Inhalt der Meldung und, wenn gewünscht, "Auch melden, wenn wieder normal" mit eigenem Titel und Inhalt, alles in einem
  Fenster, danach die Vorschau und "Test senden". Der Test nutzt so schon den gewählten Empfänger, die Lautstärke und die
  Wiederholung. Schritt 5 bleibt "Name". Bestehende Meldungen bleiben unverändert; beim Bearbeiten stehen die Schritte in
  der Leiste in der neuen Reihenfolge.

## [2.11.0] - 2026-10-11

Magic Push: der Assistent bekommt ein eigenes Fenster.

### Geändert

- Der Assistent von Magic Push (neue Meldung und Bearbeiten) öffnet jetzt in einem eigenen Fenster über dem Geräte-Popup
  statt im Reiter (Wunsch des Nutzers, Mockups `docs/mockups/magic-push-dialog-v1`, Variante A). Auf dem Handy füllt das
  Fenster den ganzen Bildschirm: schmale Kopfleiste mit Titel, Gerät und "Schliessen", darunter die Schrittanzeige, dazwischen
  der Inhalt und "Zurück"/"Weiter" fest am unteren Rand, damit sie immer erreichbar sind. Die Schritte haben so rund einen
  Drittel mehr Platz, und die Tastatur schiebt den Inhalt nicht mehr unter einen hohen Popup-Kopf. Auf dem Desktop ist das
  Fenster breit (920 px) und zeigt Diagramm, Rückblick und Vorschau in einer Spalte rechts neben dem Formular. Der Reiter
  "Magic Push" im Popup zeigt nur noch die Liste der Meldungen mit "Neue Meldung" und "Bearbeiten".
- "Bearbeiten" in der Übersicht in den Einstellungen öffnet das Assistenten-Fenster direkt, ohne das Geräte-Popup dahinter;
  nach dem Speichern oder Schliessen sind die Einstellungen wieder da und die Übersicht wird neu geladen.
- Schliessen des Fensters (Kreuz, Escape, "Abbrechen" in Schritt 1) mit ungespeicherten Änderungen fragt "Änderungen
  verwerfen?"; ohne Änderung schliesst es sofort. Ein Tipp neben das Fenster schliesst es nicht.

## [2.10.0] - 2026-10-11

Magic Push: Übersicht in den Einstellungen und freie Entitäten.

### Hinzugefügt

- Neuer Reiter "Magic Push" unter "Überwachung und Meldungen" in den Einstellungen (Wunsch des Nutzers). Er zeigt alle
  Meldungen von Magic Push aller Geräte, nach Gerät gruppiert: das Gerät (Symbol, Name, Bereich und Integration, eine
  Marke bei Ausfall) als Überschrift, darunter seine Meldungen mit Name, Satz ("Temperatur unter 12 °C · für 10 Min. ·
  zurück ab 14 °C"), Zustand und wann sie zuletzt kam. Meldungen lassen sich dort ein- und ausschalten, bearbeiten und
  löschen (mit Rückfrage); "Bearbeiten" öffnet das Popup des Geräts mit dem Assistenten auf dieser Meldung, ein Tipp auf
  das Gerät öffnet sein Popup im Reiter Magic Push. Neue Meldungen entstehen nicht hier, sondern nur im Popup eines
  Geräts. Die Änderungen gelten sofort, nicht erst mit "Speichern"; die Übersicht lädt neu, wenn ein Geräte-Popup
  schliesst.
- Freie Entität (Wunsch des Nutzers): ganz unten in Schritt 1 des Assistenten öffnet "Freie Entität wählen" eine Suche
  über alle Entitäten von Home Assistant (nach Name, Entitäts-ID und Gerät, mehrere Wörter möglich). Die Meldung bleibt an
  dieses Gerät gebunden, die Entität darf aber von einem anderen Gerät oder von keinem stammen: Wert, Einheit und
  Zustände kommen von der gewählten Entität, `{entity}` ist ihr Name und `{device}` bleibt das Gerät der Meldung. So
  lässt sich zum Beispiel eine berechnete absolute Luftfeuchtigkeit an einem Sensor verwenden, der sie nicht messen
  kann. Liste und Übersicht kennzeichnen solche Meldungen mit der Entitäts-ID.

### Geändert

- Die Einstellungen zeigen auf dem Handy nur noch die Titel der Abschnitte; die kleine Vorschauzeile unter dem Titel
  entfällt dort (Wunsch des Nutzers). Auf dem Desktop bleibt sie.
- Die Reiterleiste von "Überwachung und Meldungen" hat jetzt neun Reiter: auf dem Desktop fünf und vier, auf dem Handy
  drei Zeilen zu drei.
- Magic Push verlangt nicht mehr, dass die Entität zum Gerät gehört (siehe "Freie Entität"); die Entität muss es geben.

### Behoben

- Auf dem Handy deckte die Tastatur das Suchfeld zu, wenn die Suche nach einer freien Entität aufging. Das Feld scrollt
  jetzt beim Öffnen direkt unter die Reiter und noch einmal, sobald die Tastatur da ist (auch beim Umbenennen einer
  Meldung in der Liste).
- Die Fehlermeldung bei einem ungültigen Rücksetzwert nennt jetzt die Bedingung und die Schwelle ("Bei "unter 14 g/m³"
  muss der Rücksetzwert mindestens 14 g/m³ sein ...") und weist auf die andere Richtung hin, wenn ein tieferer oder
  höherer Wert gemeint ist.

## [2.9.0] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.10.0.

Magic Push: eigene Rücksetzbedingung.

### Hinzugefügt

- In Schritt 2 des Magic-Push-Assistenten steht der neue Abschnitt "Zurücksetzen" (Wunsch des Nutzers). "Automatisch"
  behält das bisherige Verhalten: Die Meldung ist zurückgesetzt, sobald die Bedingung nicht mehr gilt. Mit "Eigener Wert"
  bestimmst du, wo sie zurückgesetzt wird: bei einer Zahl ein Rücksetzwert (zum Beispiel melden unter 12 °C, erst ab
  14 °C zurücksetzen; der Assistent schlägt einen Wert vor und prüft, dass er auf der Seite des Normalen liegt), bei einem
  Zustand der Zustand, bei dem zurückgesetzt wird (zum Beispiel erst bei "geschlossen"). Dazwischen bleibt alles still:
  keine zweite Meldung und kein "wieder normal". "Wieder normal" und das erneute Scharfwerden (wichtig bei "nur einmal"
  und bei der Wiederholung) folgen dem Rücksetzwert. Vor der Meldung ändert sich nichts: Die Bedingung muss ohne
  Unterbruch gelten, sonst beginnt die Zeit von vorn. Eine Wiederholung, die im Zwischenbereich wartete, läuft im alten
  Takt weiter. Das Diagramm zeigt eine zweite, grüne Linie für den Rücksetzwert, der Rückblick rechnet damit, und die
  Liste zeigt "zurück ab 14 °C". "Ändert sich" hat keinen Rücksetzwert. Meldungen aus früheren Versionen bleiben
  automatisch.

## [2.8.0] - 2026-10-11

Magic Push: Titel und Inhalt getrennt schreiben.

### Hinzugefügt

- Im Magic-Push-Assistenten sind Titel und Inhalt einer Meldung jetzt zwei getrennte, freie Felder, beide mit
  Variablen (Wunsch des Nutzers). Bisher liess sich nur der Titel schreiben; die Zeile darunter entstand automatisch.
  Schritt 3 hat den Titel (eine Zeile) und den Inhalt (mehrere Zeilen erlaubt, bis 300 Zeichen); ein Tipp auf eine
  Variable fügt sie im zuletzt gewählten Feld ein. Bleibt der Inhalt leer, entsteht die Zeile wie bisher automatisch
  (Gerät und wie lange, bei einer Änderung alter und neuer Wert). Neue Meldungen beginnen mit einem Standardinhalt
  ("{device} · seit {duration}"). "Wieder normal" hat in Schritt 4 einen eigenen Titel und einen eigenen Inhalt. Die
  Vorschau zeigt beide, "Test senden" schickt beide. Meldungen aus früheren Versionen behalten ihre automatische Zeile.

## [2.7.0] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.8.0.

Magic Push: kritische Mitteilung mit Lautstärke.

### Hinzugefügt

- In Schritt 4 ("Versand") des Magic-Push-Assistenten steht der neue Schalter "Kritische Mitteilung" (Wunsch des
  Nutzers). Ist er an, stellt ein Regler die Lautstärke von 1 bis 10 ein. Eine kritische Meldung kommt auch bei stummem
  Gerät oder "Nicht stören" an. Für iOS wird die Lautstärke als 0,1 bis 1,0 geschickt (`push.sound` mit `critical: 1`;
  0 wäre stumm, darum beginnt die Skala bei 1). Für Android, das keine Lautstärke pro Meldung kennt, geht die Meldung
  mit `ttl: 0`, `priority: high` und dem Kanal `alarm_stream` hinaus und klingt so über den Alarm-Ton in der am Gerät
  eingestellten Lautstärke. Nur die Meldung selbst ist kritisch; "wieder normal" kommt als gewöhnliche Meldung. "Test
  senden" klingt wie die echte Meldung, so lässt sich die Lautstärke anhören. Die Vorschau trägt den Vermerk
  "kritisch", die Liste zeigt "kritisch (Lautstärke 7)". Auf iOS müssen kritische Hinweise für die Companion-App in
  deren Einstellungen erlaubt sein.

### Geändert

- Im Magic-Push-Assistenten sind alle Auswahlen (Bedingung, Zustand, Dauer, Wiederholung) jetzt Reiterleisten wie die
  Reiter darüber, mit der gleitenden Kapsel und demselben Aussehen (Wunsch des Nutzers). Der Wertwähler "− Zahl +" hat
  dieselbe Fläche. Eine Leiste ohne gewählten Knopf (eigene Zeit getippt) zeigt keine Kapsel.

## [2.6.1] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.8.0.

Release Notes öffnen wieder bei einer neuen Version von HACS.

### Behoben

- "Release Notes" bei einem verfügbaren Update zeigten den Fehler "does not match the expected pattern at 'latest'. Got
  'v2.6.0'" (Meldung des Nutzers). HACS nennt die neue Version mit ihrem Tag ("v2.6.0"), der Server nahm aber nur die
  reine Nummer an. Das Panel schickt jetzt die Nummer ohne "v", und der Server akzeptiert auch ein führendes "v".

## [2.6.0] - 2026-10-11

Magic Push: eigene Meldungen pro Gerät, ohne Automation.

### Hinzugefügt

- Neuer vierter Reiter "Magic Push" im Geräte-Popup (Wunsch des Nutzers). Er listet die Meldungen des Geräts (Name, ein
  Satz wie "Temperatur unter 12 °C · für 10 Min. · einmal", wann sie zuletzt kam, ein Schalter) mit "Bearbeiten",
  "Umbenennen" und "Löschen" (mit Rückfrage). Der Reiter zeigt die Zahl der aktiven Meldungen.
- "Neue Meldung" öffnet einen Assistenten in fünf Schritten: Wert, Wann, Text, Versand, Name. 1) Eine beliebige Entität
  des Geräts wählen, mit ihrem jetzigen Wert. 2) Die Bedingung: über, unter, ist gleich oder ändert sich bei einer Zahl;
  ist oder ändert sich bei einem Zustand (mit den Wörtern der Entität, etwa offen oder geschlossen). Die Dauer ("für
  mindestens") hat Vorschläge und immer auch eine freie Zeit (Zahl und Einheit, bis 7 Tage). Ein Diagramm oder eine
  Zeitleiste der letzten 24 Stunden und ein Rückblick ("wäre 1-mal gekommen, gestern 04:12, tiefster Wert 11,6 °C") zeigen,
  was die Einstellung getan hätte; der Rückblick darf leer sein und braucht den Recorder. 3) Der Text ist frei; die
  Variablen passen zur Entität ({value}, {unit}, {threshold} bei einer Zahl, {value} als Wort der Entität bei einem
  Zustand, {old} und {new} bei einer Änderung, dazu immer {device}, {area}, {entity}, {integration}, {rule}, {duration},
  {since}, {time}) und werden an den Cursor eingefügt. Eine Vorschau mit dem jetzigen Wert steht immer da. 4) Der
  Empfänger: der Standard aus den Einstellungen oder ein Notify-Dienst, eine Gruppe oder eine Entität; Wiederholung (nur
  einmal, 30 Min., 1 Std., täglich oder eine freie Zeit); "Auch melden, wenn wieder normal" mit einem Text, der genauso
  frei ist wie der erste, mit eigener Vorschau; "Test senden". 5) Der Name, mit Vorschlag, und eine Zusammenfassung.
- Eine Meldung kommt, wenn die Bedingung die angegebene Zeit gegolten hat, einmal je Episode (erneut erst, wenn der Wert
  zwischendurch wieder normal war) oder wiederholt. "Ändert sich" kommt je Änderung, sobald der neue Wert die Zeit
  geblieben ist. Nicht erreichbare Entitäten (unavailable, unknown) melden nichts und setzen die Zeit nicht zurück. Der
  Stand überlebt Neustarts; Meldungen eines entfernten Geräts werden mit entfernt. Bis 20 Meldungen pro Gerät und 200
  insgesamt.
- Ein Push von Magic Push zeigt das Icon der Integration und öffnet das Gerät im Panel, wie die anderen Meldungen. Das
  Protokoll hat eine neue Kategorie "Magic Push".
- Befehle `device_panel/magic_get`, `magic_save`, `magic_delete`, `magic_enable`, `magic_preview`, `magic_test` und
  `magic_history` (nur Administratoren). Die Meldungen liegen in `.storage` und werden beim Entfernen der Integration
  gelöscht.

## [2.5.0] - 2026-10-11

Lange Listen in den Einstellungen ganz unten.

### Geändert

- In den Einstellungen steht eine lange Liste jetzt immer zuunterst in ihrem Reiter, damit man nicht an ihr vorbeiscrollen
  muss (Wunsch des Nutzers). Unter "Laden" stehen das Emoji-Feld und die Vorschau nun über der Liste "Pro Integration", unter
  "Updates" über der Liste "Einzelne Apps und Integrationen". Unter "Darstellung" ist "Reihenfolge zurücksetzen" über die
  Chip-Liste gewandert. Die Reiter "Ausfall", "Batterie", "Neu" und "Empfang" endeten schon mit ihren Listen der Ausnahmen.

## [2.4.0] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.5.0.

Release Notes auch der installierten Version lesen.

### Hinzugefügt

- In den Einstellungen hat die Zeile der installierten Version ("Aktuell") jetzt ebenfalls den Knopf "Release Notes"
  (Wunsch des Nutzers). Ohne Update öffnet er dasselbe Fenster mit den Notes der installierten Version, überschrieben mit
  "Installierte Version x.y.z", damit man nachlesen kann, was die aktuelle Version gebracht hat. Das Fenster arbeitet wie
  bisher: Sprache des Panels, Hinweis bei nur englischem Text, Knopf "Auf GitHub" und "Erneut versuchen" bei Fehlern.

## [2.3.0] - 2026-10-11

Release Notes in einem Fenster statt als Link.

### Geändert

- In den Einstellungen öffnet "Release Notes" bei einem verfügbaren Update nicht mehr GitHub, sondern ein Fenster im
  Panel (Wunsch des Nutzers). Es zeigt die Notes aller Versionen nach der installierten bis zur neuen, neueste zuerst,
  übersprungene Versionen sind also dabei. Im deutschen Panel kommen sie auf Deutsch (aus `CHANGELOG.de.md` der neuen
  Version auf GitHub), sonst auf Englisch; fehlt eine Sprache, sagt das Fenster es und zeigt Englisch. Ein Knopf "Auf
  GitHub" im Fenster öffnet weiterhin die Release-Seite. Ohne Netz oder beim Abfragelimit von GitHub zeigt das Fenster
  den Fehler mit "Erneut versuchen". Die Texte werden sechs Stunden zwischengespeichert.

## [2.2.0] - 2026-10-11

Ein Emoji pro Push-Meldung, im Panel einstellbar.

### Hinzugefügt

- Das Emoji am Anfang des Push-Titels lässt sich pro Meldung ändern (Wunsch des Nutzers), im Reiter der Meldung unter
  "Überwachung und Meldungen": "Ausfall" (ausgefallen, Sammelausfall, wieder online), "Batterie" (schwache Batterie),
  "Laden" (geladen, Ladung beendet), "Neu" und "Updates". Das Feld steht über der Vorschau, die beim Tippen mitgeht.
  Standard ist das bisherige Emoji (🔴 🚨 🟢 🪫 🔋 🔌 ✨ ⬆️). Das Feld nimmt bis zu 3 Zeichen (eine Flagge oder ein Emoji
  mit Hautton zählt als eins) und lässt sich leer speichern, dann hat der Titel kein Emoji. "Standard" setzt das Emoji
  zurück. Die anhaltenden Benachrichtigungen in Home Assistant behalten ihr Emoji; die Einstellung gibt es nur im
  Panel, nicht im Optionsdialog von Home Assistant.

## [2.1.0] - 2026-10-11

Das Icon der Integration in Push-Meldungen.

### Hinzugefügt

- Eine Push-Meldung, die eindeutig zu einer Integration gehört, zeigt nun deren Icon statt des Device-Panel-Icons:
  "Wieder online: Aqara FP400" zeigt das Icon der Integration, mit der das Gerät eingerichtet ist (zum Beispiel
  Matter). Das gilt für Ausfall und Wieder online, schwache Batterie, Ladung und neue Geräte. Eine Meldung zu
  mehreren Geräten zeigt das Icon nur, wenn alle zur selben Integration gehören; sonst, und bei der
  Update-Erinnerung, bleibt das Device-Panel-Icon. Nichts einzurichten.
- Woher das Icon kommt: zuerst `brand/icon.png` der Integration selbst, sonst der Icon-Dienst von Home Assistant
  (`brands.home-assistant.io`), dieselbe Quelle, die Home Assistant für die eigenen Integrations-Seiten nutzt. Jedes
  Icon wird nur einmal geholt, mit Rand auf eine quadratische Fläche gesetzt (iOS schneidet die Ecken des Bilds ab)
  und in `.storage/device_panel_icons` abgelegt; die Companion-App lädt es ohne Anmeldung, wie das Device-Panel-Icon.
  Ein Icon, das sich nicht finden lässt, wird nach sechs Stunden neu versucht; bis dahin, und wenn Home Assistant
  keinen Netzzugriff hat, gilt das Device-Panel-Icon. Eine Meldung wartet wegen eines Icons nie länger als vier
  Sekunden. Der Ordner wird beim Entfernen der Integration gelöscht.

### Geändert

- Der rechte Rand des Ausfall-Pulses zeigt jetzt den Stand jetzt (Wunsch des Nutzers): Der letzte Abschnitt zählt nur
  Geräte, die in diesem Moment ausgefallen sind. Bisher blieb die Kurve am rechten Rand bis zu 30 Minuten nach der
  Rückkehr eines kurz ausgefallenen Geräts oben und rot, obwohl "Gerade ausgefallen" schon 0 zeigte. Die Ausfälle
  bleiben in den Abschnitten davor, im Balken jedes Geräts und in der Liste des Puls-Fensters sichtbar. Ein kurzer
  Ausfall, der ganz in der laufenden halben Stunde liegt, erscheint in der Kurve nicht mehr, sobald das Gerät wieder
  da ist. Das Fenster listet beim Tipp auf den letzten Abschnitt dieselben Geräte.

## [2.0.10] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.1.0.

Geräte-Popup: der Reiter "Einstellungen" auf zwei Zeilen.

### Geändert

- Im Geräte-Popup zeigt der Reiter "Einstellungen" die Zahl auf einer zweiten Zeile, wenn das Gerät eigene
  Einstellungen hat: "Einstellungen" in etwas kleinerer Schrift, darunter klein "1 eigene". Vorher war
  "Einstellungen · 1 eigene" in eine Zeile gepresst (Wunsch des Nutzers). Der Reiter ohne eigene Einstellungen und
  die übrigen Reiter bleiben wie bisher.

## [2.0.9] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.1.0.

Blauer Ring nach dem Schliessen eines Fensters auf dem Handy.

### Behoben

- Auf dem Handy blieb nach dem Öffnen und Schliessen des Fensters ein blauer Ring um die Kachel "Ausfall-Puls" stehen
  (und konnte bei anderen angetippten Elementen stehen bleiben): Der Browser gibt beim Schliessen eines Fensters den
  Fokus an das angetippte Element zurück und zeigt dort einen Fokusring. Auf Touch-Geräten wird der Fokus beim
  Schliessen jetzt losgelassen (Puls, Geräte-Popup, Einstellungen, Ansicht, Statistik, Bereiche, Protokoll,
  Prompt-Editor). Der Tastatur-Fokus auf dem Desktop bleibt unberührt.

## [2.0.8] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.1.0.

Klares Zeichen für eine ausgeschaltete Meldung in den Grafiken.

### Geändert

- Der Endpunkt einer ausgeschalteten Meldung ("Kein Push") ist ein grauer Ring mit Schrägstrich statt eines
  gestrichelten Rings, der wie ein Pixelfehler aussah (Wunsch des Nutzers, Mockups `off-marker-v1`, Variante B). Das
  gilt für alle Grafiken: Übersicht, die Reiter der Einstellungen, Detail einer Integration und Geräte-Popup. Die
  Balken bei "Ausfall" und "Neu", die ausgeschaltet gar kein Zeichen zeigten, zeigen jetzt denselben Ring am Ende
  der gestrichelten Linie.

## [2.0.7] - 2026-10-11

Nicht veröffentlicht; enthalten in 2.1.0.

Einstellungen pro Gerät an einem Ort; "Darstellung" hat nur noch die Filter-Chips.

### Geändert

- "Geräte im Panel" hat einen neuen Reiter "Pro Gerät" (Wunsch des Nutzers): Dort stehen alle Geräte mit einer
  eigenen Einstellung, jede Art in einer eigenen Liste mit Zurücksetzen (Ausfall-Zeit, ausgeschaltete Meldungen,
  Batterie, Verbindungsart von Hand, Empfang-Warnung). Einzelne Einträge oder alle lassen sich zurücksetzen; es
  gilt mit "Speichern". Die Listen stehen weiterhin auch beim jeweiligen Thema (zum Beispiel die der Batterie unter
  "Batterie"). Der Reiter zeigt, wie viele Geräte eine eigene Einstellung haben.
- Die Warnschwellen des Empfangs pro Funkart, bisher Teil von "Darstellung" › "Verbindungsart", sind jetzt ein Reiter
  "Empfang" in "Überwachung und Meldungen" (dort, wo auch Integrationen und Geräte ihren Reiter "Empfang" haben),
  mit den Geräten mit eigener Schwelle unter "Abweichungen". Die Einstellungen selbst ändern sich nicht.
- "Darstellung" hat den Reiter "Verbindungsart" nicht mehr: Es bleiben nur die Filter-Chips, ohne Unterreiter.
- "Überwachung und Meldungen" hat acht Reiter (neu: "Empfang"), immer in zwei Zeilen zu vier, auch auf dem Desktop.

## [2.0.6] - 2026-10-11

Stift am Gerätenamen ohne blauen Ring.

### Geändert

- Der Stift neben dem Gerätenamen (Umbenennen) ist ein kleiner Kreis auf der leicht getönten Fläche, wie die Fläche
  der neuen Reiter, statt eines blauen Rings (Wunsch des Nutzers). Der Tastatur-Fokus wird in einer neutralen Farbe
  gezeigt.

### Behoben

- Auf dem Handy zeigt das Öffnen des Geräte-Popups, der Einstellungen, des Statistik-Fensters oder des Prompt-Editors
  keinen Fokusrahmen mehr am ersten Knopf (der Stift erschien mit blauem Ring).

## [2.0.5] - 2026-10-11

Reiter als Segmentschalter und auf dem Handy eine Zeile für Sortierung und Ansicht.

### Geändert

- Die Reiter sehen aus und verhalten sich wie der Segmentschalter der UniFi-App (Wunsch des Nutzers, Mockups
  `segmented-v1`): eine abgerundete Fläche mit gleich breiten Feldern; das gewählte Feld ist eine dunklere Kapsel mit
  Schrift in der Akzentfarbe, die anderen haben keinen Rahmen. Beim Wechsel gleitet die Kapsel mit leichtem
  Nachschwingen zum neuen Reiter und die Schrift wechselt weich zur Akzentfarbe; mit "Bewegung reduzieren" springt
  die Kapsel stattdessen. Das gilt für alle Reiter: Einstellungen, Detail einer Integration und Geräte-Popup. Das
  ersetzt die umrahmten Reiter aus 2.0.2 und 2.0.3.
- Ab fünf Reitern zeigt das Handy vier Spalten (sieben Reiter: 4 + 3, der letzte links und gleich gross wie die
  anderen), auf schmalen Handys (unter 390 px) drei Spalten; auf dem Desktop eine Zeile. Auf dem Handy sind die
  Reiter mindestens 44 px hoch.
- Handy: Der Knopf "Spalten" oben und die Pille "Sortiert nach" unter den Chips (beide öffneten dasselbe Blatt
  "Ansicht") sind durch eine Zeile "Sortierung & Ansicht" unter den Chips ersetzt; rechts steht die gewählte
  Sortierung in der Akzentfarbe, mit Richtungspfeil (Wunsch des Nutzers, Mockups `sort-line-v1`, Variante C). Das
  Suchfeld ist breiter. Der Desktop bleibt unverändert.

## [2.0.4] - 2026-10-11

Verbindungsart pro Integration neben dem Typ.

### Geändert

- Die Verbindungsart pro Integration (Zigbee, Thread, WLAN, ...) stellt man jetzt in derselben Liste ein wie den
  Typ: Einstellungen › "Geräte im Panel" › "Integrationen" hat neben "Typ" eine zweite Auswahl "Verbindungsart"
  (Wunsch des Nutzers). Es ist dieselbe Einstellung wie bisher, bereits gesetzte Werte bleiben also. Auf dem Handy
  stehen "Typ" und "Verbindungsart" unter dem Namen; die erkannten Verbindungsarten zeigt der Tooltip der Auswahl.
- "Darstellung" › "Verbindungsart" hat keine eigene Liste der Integrationen mehr; ein Hinweis mit Link führt zur
  neuen Stelle. Die Ausnahmen pro Gerät und die Empfangs-Schwellen bleiben dort.
- Die Zusammenfassung von "Geräte im Panel" zeigt, für wie viele Integrationen eine Verbindungsart festgelegt ist.

## [2.0.3] - 2026-10-11

Reiter ohne Fläche dahinter, auf dem Handy grösser.

### Geändert

- Die Reiter behalten ihren Rahmen, aber die Fläche hinter der ganzen Reihe entfällt: Die Reihe hat denselben
  Grund wie das übrige Popup beziehungsweise die Einstellungen (Wunsch des Nutzers, Mockups `tabs-frame-v1`,
  Variante A). Das gilt für alle Reiter: Einstellungen, Detail einer Integration und Geräte-Popup.
- Die Reiter haben ihre natürliche Breite und stehen linksbündig (Mockups `tabs-touch-v1`, Variante 2): Sie füllen
  die Zeile nicht mehr, der letzte Reiter ("Integrationen") ist deshalb nicht mehr über die ganze Breite gezogen,
  sondern gleich gross wie die anderen und links. Bei Platzmangel kommen die nächsten Reiter in eine zweite Zeile.
- Auf dem Handy sind die Reiter grösser, damit man sie besser mit dem Finger trifft: mindestens 44 px hoch, Schrift
  14 px.

## [2.0.2] - 2026-10-10

Einheitliche Grafiken, umrahmte Reiter und Korrektur beim Drücken. Diese Version ist ein reguläres Release (keine
Vorabversion); sie enthält den Material-Look aus 2.0.0 und 2.0.1.

### Geändert

- Alle Zeitstrahl-Grafiken sind einheitlich (Wunsch des Nutzers, Mockups `graphics-v1`, Variante A): Linien und
  Balken reichen nicht mehr bis zum rechten Rand, sondern enden bei 80 % der Breite, und der Wert samt
  Beschreibung steht unter dem Endpunkt (Ring). Das gilt für die Balken bei "Ausfall" und "Neu" (der längste Balken
  endet bei 80 %, der Wert wanderte vom rechten Rand zum Ende) und für die Linien bei "Batterie", "Laden" und
  "Updates" (die Linie endet an der letzten Marke). Überall, wo sie vorkommen: Übersicht, die Reiter der
  Einstellungen, Detail einer Integration und Geräte-Popup. Es ändert sich nur das Aussehen: keine Werte, Felder
  oder Funktionen.
- Nicht gewählte Reiter sind leicht umrahmt, damit man sie besser als Reiter erkennt. Das gilt für alle Reiter:
  Einstellungen, Detail einer Integration und Geräte-Popup.

### Behoben

- Wer eine Zeile drückt und hält (zum Beispiel einen Abschnitt in den Einstellungen, eine Integration, eine
  Listenzeile oder eine Protokollzeile), sah am Rand eine dunklere Fläche: Solche Zeilen werden beim Drücken nicht
  mehr kleiner, sondern zeigen stattdessen die Hover-Farbe (seit 2.0.0).

## [2.0.1] - 2026-10-10

Material-Look nachgeschärft und auf die Liste angewendet (Vorabversion).

### Geändert

- Die Blätter (Geräte-Popup, Einstellungen, Protokoll) sind durchscheinender (64 % statt 80 %), mit kräftigerer
  heller Oberkante, dunklerem und unschärferem Hintergrund und klar sichtbarem Glas bei Kacheln, Reitern und
  Karten, damit man das Material auch auf dem Handy sieht (Wunsch des Nutzers, nach dem Test von 2.0.0).
- Die Liste bekommt denselben Look: grösserer, enger gesetzter Titel "Geräte", Karten mit grösserem Radius und
  weicher Tiefe, die Chip-Leiste als durchscheinendes Material über der Liste, Gruppentitel ("Ausgefallen",
  "Online") im kräftigeren Titelstil. Es ändern sich nur Stile.

## [2.0.0] - 2026-10-10

Material-Look, Schritt 1 (Vorabversion).

### Geändert

- Neues Aussehen für das Geräte-Popup, die Einstellungen und das Protokoll-Fenster (Wunsch des Nutzers, Mockups
  `apple-design-v1`, Variante B, Schritt 1 von 2): durchscheinende Blätter mit Unschärfe und heller Oberkante,
  abgedunkelter und leicht unscharfer Hintergrund, Kopf und Knöpfe laufen weich aus statt mit harter Linie,
  gläserne Kacheln, Tasten und Reiter, enger gesetzte grosse Titel und etwas weiter gesetzte kleine Beschriftung
  sowie eine sofortige Druck-Rückmeldung (3 % kleiner). Es ändern sich nur Stile: keine Felder, Werte, Tags oder
  Funktionen. Ohne Unterstützung für `backdrop-filter` oder bei "Transparenz reduzieren" bleiben die Blätter
  deckend wie bisher; bei "Bewegung reduzieren" entfällt die Druck-Rückmeldung. Schritt 2 (ziehbares Blatt, Federn)
  folgt gesondert. Zurück auf 1.44.0 geht jederzeit.

## [1.44.0] - 2026-10-10

Reiter brechen auf eine zweite Zeile um.

### Geändert

- Alle Reiter (Einstellungen, Detail einer Integration, Geräte-Popup, Unterreiter der Abschnitte und das
  Prompt-Fenster) behalten das klare Segment-Aussehen und brechen bei Platzmangel auf eine zweite Zeile um, statt
  seitlich zu scrollen oder gequetscht zu werden (Wunsch des Nutzers; der Stil wurde aus den Mockups
  `tabs-style-v1` gewählt: das bisherige Aussehen bleibt). Die Reiter einer Zeile füllen deren Breite.

## [1.43.0] - 2026-10-10

Klare Abschnittstitel in den Einstellungen.

### Geändert

- Ein Titelstil für jedes neue Thema in den Einstellungen (Wunsch des Nutzers): grösser (18 px, fett), in der
  Textfarbe mit einem Akzentbalken davor, damit auf den ersten Blick klar ist, dass ein neuer Abschnitt
  beginnt. Die kleinen grauen Grossbuchstaben-Titel ("Erkennung", "Meldung" …) sehen jetzt gleich aus. Neue
  Titel dort, wo ein Thema ohne Titel begann: "Was das Panel zeigt", "Integrationen im Panel", "Gerätetypen im
  Panel" und "Ausgeblendete Geräte" (Geräte im Panel); "Ziel der Meldungen" (Übersicht); "Meldung" und
  "Integrationen" (Laden); "Anzeige", "Anbieter" und "Prompt" (KI-Einschätzung). "Verbindungsart pro
  Integration", "Empfang: Warnschwelle pro Funkart" und "Filter-Chips" sind ebenfalls Titel.

## [1.42.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.43.0.

Auf jeder Ebene dieselben Reiter.

### Geändert

- Dieselben Reiter in den Einstellungen, im Detail einer Integration und im Geräte-Popup (Wunsch des Nutzers,
  "überall genau gleich aufgebaut"):
  - Einstellungen › Überwachung und Meldungen: "Laden" ist ein eigener Reiter (vorher ein Unterreiter von
    "Batterie"): Übersicht, Ausfall, Batterie, Laden, Neu, Updates, Integrationen. Auf dem Handy scrollt die
    Reiterzeile seitlich und hält den gewählten Reiter in der Mitte.
  - Detail einer Integration: Reiter Ausfall, Batterie, Laden, Neu, Empfang und Geräte statt einer langen Seite.
    Jeder Reiter zeigt die Grafik des passenden Reiters der Einstellungen (mit den Werten, die für die
    Integration gelten), ein Punkt markiert einen Reiter mit eigener Einstellung der Integration, "Alles auf
    Standard" bleibt darunter.
  - Geräte-Popup, Reiter Einstellungen: Unterreiter Ausfall, Batterie, Laden und Empfang mit Grafik und den
    Einstellungen des Geräts (Herkunft wie bisher). Die Reiter gibt es immer; was ein Gerät nicht kann (keine
    Batterie, kein Empfang), sagt ein kurzer Hinweis. Ein Punkt markiert einen Reiter mit eigener Einstellung
    des Geräts.
- "Ladung erkannt bei Anstieg" lässt sich ab 2 % einstellen (Wunsch des Nutzers; vorher 5 bis 80 %), in der
  globalen Einstellung, pro Integration (die Liste bietet jetzt 2 % und 3 %) und pro Gerät.
- Inhalt, der unter der Reiterzeile des Geräte-Popups durchläuft, blendet weich aus statt hart abgeschnitten zu
  werden (die Kacheln "Typ" und "Verbindungsart" schienen an den Reitern zu kleben).

## [1.41.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.43.0.

Ladung beendet pro Integration und pro Gerät.

### Hinzugefügt

- "Ladung beendet nach" und der Push bei beendeter Ladung lassen sich pro Integration und pro Gerät
  übersteuern (Wunsch des Nutzers), wie "Voll ab" und der Anstieg. Im Geräte-Popup (Reiter Einstellungen)
  zwei weitere Zeilen: "Ladung beendet nach" (globaler oder Wert der Integration, oder "Eigene Zeit" von 5 bis
  120 Minuten) und "Push bei beendeter Ladung" (Standard, Ein, Aus), je mit Herkunft. Im Detail einer
  Integration (Reiter Integrationen, Gruppe "Batterie"): eine Zeit (5 bis 120 Minuten) und Ein/Aus, mit dem
  Standard (globaler Wert). Die Liste zeigt "Laden an (beendet nach 30 Min., Push bei Ende ein)". Reihenfolge:
  Gerät, Integration, global. Neue Optionen `charge_stall_integrations` und `charge_stop_integrations` (nur im
  Panel); neue Einstellungen `charge_stall` und `charge_stop` in `set_device_settings`; `list_devices` hat
  `charge_stall_setting`, `charge_stop_setting` und die Werte in `charge_default`.

- Push-Titel beginnen mit einem Emoji (Wunsch des Nutzers), damit das Thema auf den ersten Blick klar ist:
  🪫 schwache Batterie, 🔴 ausgefallen, 🚨 Sammelausfall, 🟢 wieder online, ✨ neues Gerät, 🔋 geladen,
  🔌 Ladung beendet, ⬆️ Update-Erinnerung. Die Vorschauen in den Einstellungen zeigen dieselben Titel. Die
  anhaltenden Benachrichtigungen in Home Assistant beginnen ebenfalls mit dem Emoji ihres Themas (🪫, 🔴, ✨).
- Ladebalken mit Ziel (Wunsch des Nutzers, Mockup `charge-target-v1`, Variante C): liegt "Voll ab" unter 100 %
  (zum Beispiel 80 %), ist der Rest hinter dem Ziel schraffiert, mit Strich und kleiner Zahl am Ziel. Gezeigt in
  der Liste beim Chip "Lädt" und in der Batterie-Kachel des Geräte-Popups. Bei 100 % bleibt der Balken wie bisher.
  `list_devices` hat `full` in `charging`.

### Geändert

- Feste Höhe der Fenster (Wunsch des Nutzers): das Geräte-Popup, die Einstellungen, das Statistik-Fenster, das
  Fenster der Unterbrüche ("Puls"), die Bereichsauswahl und das Prompt-Fenster bleiben gleich hoch, egal
  welcher Reiter oder Zeitraum gewählt ist (vorher wurde das Popup auf einem Reiter mit weniger Inhalt
  niedriger). Kopf, Reiter und Knöpfe bleiben stehen, der Inhalt füllt den Rest und scrollt, wenn er länger
  ist. Kleinere Fenster mit gleichbleibendem Inhalt (Spalten, Ansicht) bleiben unverändert.
- Die Batterie-Warnung ("Schwach ab") lässt sich bis auf 1 % senken (Wunsch des Nutzers: "Ich möchte hier
  niemand bevormunden"; vorher 5 bis 50 %). Gilt im Geräte-Popup, in der globalen Einstellung, pro Integration
  und in den Home-Assistant-Optionen; 0 und Werte über 50 werden weiterhin abgelehnt.

### Behoben

- Protokoll-Fenster: "Alle" bleibt in beiden Chip-Zeilen stehen, wenn seitlich gescrollt wird (vorher scrollte
  auf dem Handy der erste Chip der zweiten Zeile aus dem Bild).
- Das Geräte-Popup (und das Protokoll-Fenster) wird vom regelmässigen Abfragen (alle 10 Sekunden) nicht mehr
  neu aufgebaut, solange du es berührst, darin wischst oder eine Auswahl offen hast. Auf dem iPhone bricht ein
  ersetzter Inhalt die Wischbewegung ab, die Seite dahinter scrollt mit und kann das Neuladen der App auslösen
  ("die Geräteansicht ist nicht mehr scrollbar, alles scrollt zusammen"); eine offene Auswahl würde sich
  ausserdem schliessen. Das Abfragen wartet, bis die Berührung vorbei ist (etwa eine Sekunde), und
  aktualisiert dann; eigene Aktionen aktualisieren weiterhin sofort. Die Ursache ist auf einem echten Gerät
  nicht bestätigt (keine Reproduktion möglich); falls es weiter vorkommt, bitte die genauen Schritte melden.

## [1.40.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.43.0.

Ladung beendet.

### Hinzugefügt

- Ladung beendet (Wunsch des Nutzers): ein Gerät ohne eigene Ladeanzeige, das nach dem Stand lud, gilt nicht
  mehr als ladend, sobald der Stand eine eingestellte Zeit unverändert bleibt (Standard 15 Minuten, 5 bis
  120), zum Beispiel bei einem Ladelimit oder abgezogenem Ladegerät. Markierung, Chip "Lädt" und Balken
  verschwinden, und das Protokoll sagt "Ladung beendet bei 80 %". Steigt der Stand wieder, geht die Ladung
  weiter. Neu: ein Push "Ladung beendet" mit Stand, bisheriger Ladung und der Dauer, seit der der Stand
  unverändert ist, mit eigenem Schalter (standardmässig aus; nur für Geräte, bei denen die Lademeldung an
  ist). Beides in Einstellungen › Batterie › Laden (Optionen `charge_stall` und `notify_charge_stop`, auch
  in den Home-Assistant-Optionen). Geräte mit eigener Ladeanzeige melden das Ende selbst und sind nicht
  betroffen.

## [1.39.0] - 2026-10-10

"Voll ab" mit Stufen und eigenem Wert.

### Geändert

- "Voll ab" der Lademeldung (Wunsch des Nutzers): die Stufen sind jetzt 100, 95, 90 und 80 % (98 % entfällt)
  oder "Eigener Wert" mit einem Zahlenfeld von 50 bis 100 %. Das gilt im Geräte-Popup, global (Einstellungen ›
  Batterie › Laden) und pro Integration; ein Wert ausserhalb der Stufen zeigt "Eigener Wert". Der Bereich ist
  jetzt 50 bis 100 % (vorher 90 bis 100 %); die Home-Assistant-Option `charge_full` nimmt denselben Bereich.
  Die Ersatzregel für selten meldende Geräte (Sprung auf voll) verlangt jetzt einen Sprung von mehr als 10
  Punkten unter "Voll ab", damit ein Schritt von 79 auf 80 % bei "Voll ab" 80 % nicht als Laden gilt.

## [1.38.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.39.0.

Protokoll: warum eine Meldung kam oder nicht.

### Hinzugefügt

- Protokoll (Wunsch des Nutzers, Mockups `popup-tabs-log-v1`, P1): ein neuer Knopf "Protokoll" in der Kopfzeile,
  links vom Zahnrad. Das Fenster ist auf dem Desktop gross und füllt auf dem Handy den Bildschirm. Es zeigt,
  was die Meldungen entscheiden und warum etwas nicht kam ("Lademeldung für dieses Gerät aus", "kein Push-Ziel
  gewählt", "Push-Ziel existiert nicht", stumm, aus …): Laden (erkannt, voll geladen, Meldung gesendet oder
  nicht), Ausfall und wieder online, Batterie (neu schwach, und warum kein Push), neue Geräte,
  Update-Erinnerungen, jeder Push (gesendet oder fehlgeschlagen) und der Start. Filter nach Stufe (Info,
  Warnung, Fehler) und Bereich, Suche mit X zum Leeren, "Kopieren" der gezeigten Einträge und "Leeren". Eine
  Zeile mit Gerät öffnet dessen Popup. Der Schalter "Debug-Einträge aufzeichnen" im Fenster zeichnet auch
  Zwischenschritte auf (jeden neuen Batteriestand mit Tiefpunkt und Schwellen), bis zum nächsten Neustart. Die
  Einträge liegen nur im Arbeitsspeicher (die letzten 500) und gehen zusätzlich ins Protokoll von Home
  Assistant (Warnungen und Fehler sind dort ohnehin sichtbar). Neue WebSocket-Befehle `get_log`, `set_log`
  und `clear_log` (nur Administratoren).

## [1.37.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.39.0.

Reiter im Geräte-Popup.

### Geändert

- Geräte-Popup mit drei Reitern (Wunsch des Nutzers, Mockups `popup-tabs-log-v1`, R3):
  "Übersicht", "Einstellungen" und "Entitäten". Die "Übersicht" hat Statistik, Einschätzung,
  Verbindung und Geräteangaben zum Lesen; Typ und Verbindungsart stehen dort als Text. Alle
  Einstellungen des Geräts sind im Reiter "Einstellungen": Typ, Verbindungsart und alles unter
  "Einstellungen für dieses Gerät" (Ausfall, Batterie, Empfang, Laden, Meldungen). Der Reiter
  zeigt die Zahl der eigenen Einstellungen ("Einstellungen · 2 eigene") mit einem Punkt; die
  "Entitäten" haben die Liste der Entitäten. Das Popup öffnet immer auf der "Übersicht".

## [1.36.0] - 2026-10-10

Lademeldung pro Integration mit eigenen Werten.

### Hinzugefügt

- Lademeldung pro Integration (Wunsch des Nutzers): im Detail einer Integration (Reiter
  Integrationen, Gruppe "Batterie"), sobald die Lademeldung für sie an ist, "Voll ab" und
  "Ladung erkannt bei Anstieg" mit dem Standard (globaler Wert) oder einem eigenen Wert (Anstieg
  5 bis 80 % in Stufen, Voll ab 90, 95, 98, 100 %). Die Liste zeigt "Laden an (voll ab 98 %,
  Anstieg 15 %)". Reihenfolge: Gerät, Integration, global. Neue Optionen
  `charge_full_integrations` und `charge_rise_integrations` (nur im Panel); im Geräte-Popup
  heisst der Standard dann "Wie Integration (95 %)".

### Behoben

- Ein Gerät ohne eigene Ladeanzeige wurde schon bei einem blossen Anstieg des Stands als "lädt"
  markiert, auch wenn es gar nicht lädt: ein Knopfzellen-Sensor im Kühlschrank (BTHome)
  schwankte von 53 auf 61 % und erschien im Chip "Lädt". Der Stand allein zählt jetzt nur noch,
  wenn die Lademeldung für das Gerät eingeschaltet ist (eigenes "Ein" oder von der
  Integration); damit gilt es als wiederaufladbar. Sonst wird es nie markiert. Geräte mit
  Ladeanzeige (Binärsensor battery_charging, Companion-App "Batteriestatus") bleiben
  unverändert.

## [1.35.0] - 2026-10-10

Geräte, die gerade laden.

### Hinzugefügt

- Filter-Chip "Lädt" (Wunsch des Nutzers, Mockups `charging-state-v1`, B und C): zeigt die
  Geräte, die gerade laden, nach "Batterie"; er erscheint nur, wenn ein Gerät lädt, und lässt
  sich wie die anderen Chips in den Einstellungen (Darstellung) ausblenden, anheften und
  verschieben. Bei gewähltem Chip ist die Liste eine Liste nach Stand (das vollste zuerst), je
  Gerät mit grünem Balken, "81 % · von 38 % · seit 1 Std. 20 Min." und auf dem Handy mit grünem
  Streifen.
- Markierung in der Liste: eine grüne Pille "lädt" beim Gerät (Handy: rechts in der Zeile,
  Desktop: hinter dem Namen, in der Spalte Batterie mit Blitz); im Geräte-Popup nennt die
  Kachel Batterie "lädt seit 1 Std. 20 Min.".
- Erkennung für alle Geräte mit Batterie, unabhängig von der Lademeldung: die Ladeanzeige des
  Geräts, wo es eine hat (Binärsensor mit Geräteklasse battery_charging oder der "Batteriestatus"
  der Companion-App), sonst der Anstieg des Stands vom tiefsten Wert um den eingestellten
  Anstieg (Standard 20 %), solange der Stand nicht voll ist und in den letzten 2 Stunden
  gestiegen ist. Ein Rückgang um 5 Punkte beendet es. Geräte, die selten melden (viele
  Bluetooth- und Zigbee-Sensoren), zeigen "lädt" spät oder nie. `list_devices` hat das neue Feld
  `charging` (Stand, Startstand, seit, Quelle).
- Lademeldung pro Gerät (Wunsch des Nutzers): im Geräte-Popup, sobald die Lademeldung für das
  Gerät gilt (eigenes "Ein" oder von der Integration), zwei weitere Zeilen: "Voll ab" (globaler
  Wert oder 90, 95, 98, 100 %) und "Ladung erkannt bei Anstieg" (globaler Wert oder eigener
  Wert von 5 bis 80 %), je mit Herkunft ("Gerät", "Standard wäre …"). Die eigenen Werte gelten
  für den Push und für die Markierung "lädt". Neue Einstellungen `charge_full` und
  `charge_rise` in `set_device_settings`; `list_devices` hat `charge_full_setting`,
  `charge_rise_setting` und die globalen Werte in `charge_default`.

### Geändert

- Die Lademeldung beobachtet jetzt alle überwachten Geräte mit Batterie (vorher nur die
  eingeschalteten); den Push sendet sie weiter nur für diese.
- Einstellungen › Batterie › "Laden": Der Zeitstrahl der Übersicht steht auch dort, wie bei der
  Warnung. Anstieg (Feld) und "Voll ab" (Auswahl) stellt man im Zeitstrahl ein, die Hinweise
  stehen darunter.
- Die Suchfelder der Listen in den Einstellungen und der Auswahlfenster (Bereich, Integration)
  haben ein eigenes X zum Leeren, sobald etwas eingegeben ist; iOS zeigt das des Browsers nicht.

## [1.34.0] - 2026-10-10

Übersicht mit allen Meldungen.

### Hinzugefügt

- Einstellungen › Überwachung und Meldungen › Übersicht (Wunsch des Nutzers): zwei neue
  Zeilen, damit die Übersicht jede Meldung zeigt. "Laden" zeigt den Anstieg, der das Laden
  erkennt, und "Voll ab" mit dem Push, den Chip "Push" (schaltet die Lademeldung) und für
  welche Integrationen und Geräte sie eingeschaltet ist. "Updates" zeigt, wann der Push kommt
  (sofort nach dem Sammelfenster, täglich oder montags zur eingestellten Zeit), den Chip
  "Push", die Arten und die Zahl der Ausnahmen. "Ändern" öffnet den passenden Reiter, bei
  "Laden" den Unterreiter "Laden", bei "Batterie schwach" den Unterreiter "Warnung".

## [1.33.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.34.0.

Lademeldung auch pro Integration im Reiter "Integrationen".

### Hinzugefügt

- Einstellungen › Überwachung und Meldungen › Integrationen (Wunsch des Nutzers): im Detail
  einer Integration mit Batteriegeräten, Gruppe "Batterie", der Schalter "Lademeldung"
  (Standard aus; es ist derselbe Wert wie die Liste unter "Batterie" › "Laden"). Die Liste der
  Integrationen zeigt "Laden an", der Filter "Abweichend" findet sie; "Alle zurücksetzen" und
  "Alles auf Standard" schalten sie wieder aus. Ein Hinweis nennt, wenn die Lademeldung global
  ausgeschaltet ist oder kein Ziel hat.

## [1.32.0] - 2026-10-10

Reiter Batterie: Unterreiter "Warnung" und "Laden".

### Geändert

- Einstellungen › Überwachung und Meldungen › Batterie (Wunsch des Nutzers, Mockups
  `battery-layout-v1`, C): zwei Unterreiter. "Warnung" enthält den Zeitstrahl der Schwelle, die
  Meldung, ihren Inhalt und die Abweichungen, jetzt mit dem Titel "Abweichungen von "Schwach
  ab"", damit klar ist, worauf sie sich beziehen. "Laden" enthält die Lademeldung in einer
  eigenen Ansicht (Schalter, "Voll ab", Anstieg, Integrationen mit Suche, Vorschau). Der Punkt
  an einem Unterreiter zeigt eine Änderung.

## [1.31.1] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.32.0.

Behoben: Panel lädt seit Home Assistant 2026.10 langsam oder gar nicht.

### Behoben

- Panel und Einstellungen luden seit Home Assistant 2026.10 sehr langsam oder gar nicht,
  Speichern dauerte lange, und ganz Home Assistant konnte träge wirken. Ursache: Seit 2026.10
  meldet jedes Lesen von `DeviceEntry.config_entries` und `primary_config_entry` (seit 2026.8
  veraltet, ersetzt durch `config_entry_id`) zur Laufzeit und untersucht dazu den Aufrufstapel.
  Das Panel las sie pro Gerät und Abfrage mehrfach: bei einigen hundert Geräten Tausende
  Meldungen, die Home Assistant blockierten. Das Panel liest jetzt `config_entry_id` (ältere
  Home-Assistant-Versionen funktionieren weiter mit `config_entries`). Ein Test prüft, dass
  kein Modul die veralteten Eigenschaften mehr liest.
- Dieselbe Ursache an einer zweiten Stelle (Log von Home Assistant): `device_registry.devices`
  wurde als Abbildung benutzt (`.values()`), was seit 2026.10 ebenfalls meldet. Das Panel
  iteriert jetzt das Register.

### Geändert

- Lademeldung: Der Anstieg steht in "%" statt in "Punkten" (Panel und Optionsdialog); die
  Beschreibung nennt ein Beispiel.

## [1.31.0] - 2026-10-10

Update-Erinnerung pro App und Integration.

### Hinzugefügt

- Update-Erinnerung: Liste aller Update-Entitäten von Home Assistant im Reiter "Updates"
  (Wunsch des Nutzers): Home Assistant Core, Betriebssystem und Supervisor, jede installierte
  App (Add-on), HACS-Einträge und Geräte-Firmware, mit Name, installierter Version und einem
  Punkt "Update verfügbar". Jeder Eintrag folgt seiner Art (die vier Schalter über der Liste),
  bis du ihn einzeln umschaltest: aus für eine App einer eingeschalteten Art oder an für eine
  Firmware einer ausgeschalteten Art. Ein Eintrag mit eigener Wahl ist mit "eigene Wahl"
  markiert und geht der Art vor. Die Liste hat ab 8 Einträgen ein Suchfeld.
- Die Vorschau im Reiter "Updates" zeigt jetzt die Updates, die jetzt offen sind und gemeldet
  würden (Beispiele nur, wenn nichts offen ist).
- Neue Optionen `updates_exclude` und `updates_include` (Entitäts-IDs, im Panel gesetzt).

### Geändert

- Die Art "Add-ons" heisst jetzt "Apps (Add-ons)", wie in Home Assistant.

## [1.30.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.31.0.

Lademeldung.

### Hinzugefügt

- Lademeldung (Wunsch des Nutzers, Mockups und Konzept `charging-v1`,
  `docs/CONCEPT-laden-updates.md`): ein Push, sobald ein Gerät voll geladen ist.
  Standardmässig aus; einschalten im Reiter "Batterie" unter Überwachung und Meldungen
  (Abschnitt "Laden"), pro Integration oder pro Gerät im Geräte-Popup ("Laden melden":
  Wie Integration, Ein, Aus; das Gerät geht vor).
  - Erkennung ohne Ladeanzeige-Entität: Das Panel merkt sich den tiefsten Stand seit dem
    letzten Entladen. Ein Anstieg um 20 % oder mehr (von 22 % auf 42 %, zum Beispiel) gilt als Laden; bei "voll"
    (Standard 100 %) kommt ein Push. Beide Werte sind einstellbar ("Voll ab" 90, 95, 98 oder
    100 %; Anstieg 5 bis 80 %), weil manche Geräte nie 100 % melden.
  - Ersatzregel für Geräte, die selten melden: Ein Sprung von unter 90 % direkt auf "voll"
    wird ebenfalls gemeldet, ohne Dauer ("von 38 %"). Die Meldung ist wieder scharf, sobald
    der Stand 10 Punkte unter "voll" gefallen ist.
  - Meldung: "Geladen: Name", Text "100 % · in 1 Std. 40 Min. von 22 % · Bereich"; gleiches
    Push-Ziel und Bild wie die anderen Meldungen; Tippen öffnet das Gerät im Panel.
  - Vorschau in den Einstellungen, analog zur Batterie-Meldung; die Liste der Integrationen
    hat ab 8 Einträgen ein Suchfeld.
  - Achtung: Eine neue Batterie sieht wie Laden aus; für Geräte mit nicht wiederaufladbaren
    Batterien aus lassen.
  - Neue Optionen `notify_charge`, `charge_full`, `charge_rise` und `charge_integrations`,
    auch im Optionsdialog; Einstellung pro Gerät in `.storage/device_panel.devices`.

## [1.29.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.30.0.

Update-Erinnerung.

### Hinzugefügt

- Update-Erinnerung (Wunsch des Nutzers, Mockup `charging-v1`): Push-Meldung, wenn in Home
  Assistant ein neues Update verfügbar ist, im neuen Reiter "Updates" unter Überwachung und
  Meldungen. Sie ersetzt Automationen mit Zähler und Hilfsentität: Das Panel schaut selbst
  auf die Update-Entitäten von Home Assistant. Standardmässig aus; gleiches Push-Ziel wie die
  übrigen Meldungen, mit deren Bild und "Antippen öffnet die Update-Seite".
  - Zeitpunkt: täglich zur eingestellten Uhrzeit (Standard 09:00), wöchentlich (montags) oder
    sofort nach einem Sammelfenster (Standard 5 Minuten).
  - Arten: Home Assistant (Core, OS, Supervisor), Add-ons, HACS (auch dieses Panel),
    Geräte-Firmware (standardmässig aus). Übersprungene Versionen werden nie gemeldet.
  - Eine Meldung nennt alle offenen Updates mit "Name alt → neu". Ein Update wird je Version
    einmal gemeldet; auf Wunsch nach 3 oder 7 Tagen noch einmal, wenn es offen bleibt.
  - Vorschau in den Einstellungen, wie bei der Batterie-Meldung.
  - Neue Optionen `notify_updates`, `updates_mode`, `updates_time`, `updates_window`,
    `updates_repeat` und `updates_kinds`, auch im Optionsdialog.

### Geändert

- Der Abschnitt "Updates" (Version dieses Panels) in den Einstellungen heisst jetzt
  "Panel-Version", damit er vom neuen Reiter zu unterscheiden ist. Die Update-Zeile des Panels
  bleibt ganz oben in den Einstellungen.

## [1.28.0] - 2026-10-10

Nicht veröffentlicht; enthalten in 1.30.0.

Suchfeld in langen Listen der Einstellungen.

### Hinzugefügt

- Suchfeld über langen Listen in den Einstellungen (Wunsch des Nutzers, Mockup
  `settings-search-v1`, A): ab 8 Einträgen, bei den Integrationen, Typen und ausgeblendeten
  Geräten (Geräte im Panel), Überwachung und Meldungen › Integrationen, der Verbindungsart pro
  Integration und den Listen der Geräte mit eigener Einstellung. Die Liste filtert beim
  Tippen, zeigt "1 von 9" und "Keine Treffer."; die Suche bleibt, wenn sich der Dialog neu
  aufbaut. "Alle umschalten" schaltet weiter die ganze Liste.

## [1.27.0] - 2026-10-08

Grund der Warnung oben im Geräte-Popup.

### Hinzugefügt

- Geräte-Popup (Wunsch des Nutzers, Mockup `warn-reason-v1`, K2): Die Gründe einer Warnung
  stehen jetzt oben als Marken unter dem Namen: "Instabil · 5× in 24 Std.",
  "Empfang schwach · LQI 61", "Batterie niedrig · 9 %". Die passenden Kacheln der Statistik
  tragen einen gelben Rahmen und einen Punkt, damit Marke und Kachel sichtbar zusammengehören.
  Geräte ohne Warnung zeigen beides nicht.

### Geändert

- Die Marke ersetzt die Pille "Instabil" unter dem Namen.

## [1.26.0] - 2026-10-07

Kopf-Kacheln nebeneinander auf dem Handy.

### Hinzugefügt

- Das Fenster "Unterbrüche in 24 Std." zeigt jetzt die Sammelausfälle (bis zu 3) mit
  vollem Text über der Geräteliste; bisher standen sie nur in der Kachel.

### Geändert

- Kopf auf dem Handy (bis 600 px Breite; Wunsch des Nutzers, Mockup `hero-mobile-v1`,
  V2): "Verfügbarkeit" und "Gerade ausgefallen" stehen jetzt nebeneinander, je die halbe
  Breite (185 px auf einem iPhone 17), statt drei Kacheln zum Wischen. Tablet und Desktop
  bleiben wie sie waren.
  - Verfügbarkeit: kleinerer Ring (nur die Zahl) mit dem Prozentwert daneben,
    darunter der Durchschnitt über 24 Std. und die Zeilen.
  - Gerade ausgefallen: kleinere Zahl, die zwei längsten Geräte und "+ 2 weitere",
    eine kurze Warnzeile ("3 Warnungen"); der Satz "Kein Gerät ist gerade
    ausgefallen." entfällt (die 0 und "Alles online" sagen dasselbe).
  - Ausfall-Puls: eine schlanke Zeile unter den zwei Kacheln mit Titel, der Titelzeile
    des Sammelausfalls (oder der Zusammenfassung) und einer kleinen Kurve; Antippen
    öffnet das Fenster wie bisher.

## [1.25.0] - 2026-10-06

Gerätetyp pro Integration.

### Hinzugefügt

- Gerätetyp pro Integration (Wunsch des Nutzers): unter Einstellungen › Geräte im
  Panel › Integrationen eine Spalte "Typ" neben "Anzeigen" mit einer Auswahl
  "Automatisch" plus alle Gerätetypen; jede Zeile zeigt die erkannten Typen der
  Integration. Ein hier gesetzter Typ gilt für alle Geräte der Integration statt
  der Erkennung; "Automatisch" (Standard) belässt die Erkennung wie bisher. Ein
  am einzelnen Gerät von Hand gesetzter Typ geht weiterhin vor (Gerät, dann
  Integration, dann Erkennung).
  - Im Popup steht die Auswahl dann als "Wie Integration: Schalter" mit dem
    Hinweis "für die ganze Integration festgelegt", solange das Gerät keinen
    eigenen Typ hat.
  - Der Typ zählt überall, wo der Typ zählt: Liste, Filter, Ausschlüsse nach Typ
    (samt Zahlen unter "Typen") und KI-Einschätzung. Er gilt nur im Panel und
    wird nicht in Home Assistant geschrieben.
  - Die Zusammenfassung des Abschnitts zeigt "Typ für N Integrationen festgelegt".
  - Neue Option `type_integrations` ({Domain: Typ}), auch im Optionsdialog;
    `list_devices` liefert zusätzlich `type_integration`.

## [1.24.0] - 2026-10-06

Nicht veröffentlicht; enthalten in 1.25.0.

Push-Meldung bei neuen Geräten.

### Hinzugefügt

- Push-Meldung, wenn ein neues Gerät in Home Assistant erscheint (Wunsch des
  Nutzers), mit eigenem Reiter "Neu" unter Einstellungen › Überwachung und
  Meldungen, aufgebaut wie "Ausfall" und "Batterie":
  - Standardmässig aus. Gemeldet werden nur Geräte, die nach dem Einschalten
    erscheinen; ausgeblendete, deaktivierte und ausgeschlossene nicht.
  - Sammelfenster (Standard 5 Minuten, 1 bis 60): Das erste neue Gerät startet
    es, dann kommt eine Meldung mit allem, was inzwischen dazukam. Ein Gerät gibt
    "Neues Gerät: Name", mehrere "3 neue Geräte" mit den Angaben in Klammern. Das
    Fenster gibt auch Bereich, Hersteller und Modell Zeit, sich zu füllen.
  - Inhalt der Meldung (Bereich, Integration, Verbindungsart, Hersteller /
    Modell) mit Vorschau, dazu eine anhaltende Benachrichtigung in Home Assistant
    mit den zuletzt gefundenen Geräten (bis du sie wegklickst). Antippen der
    Meldung öffnet das Gerät, wie unter "Öffnet" eingestellt.
  - Zeitstrahl mit dem Fenster im Reiter und eine dritte Zeile in der Übersicht.
  - Pro Integration: Schalter "Neue Geräte melden" im Detail der Integration;
    Liste und "Alles auf Standard" schliessen ihn ein. Neue Installationen
    starten mit ausgeschlossenem "ibeacon" (Bluetooth-Tracker legen laufend
    Geräte an).
  - Neue Optionen `notify_new`, `new_window`, `new_persistent`, `new_fields` und
    `new_exclude_integrations`, auch im Optionsdialog.

## [1.23.0] - 2026-10-06

Logos der Integrationen in den Einstellungen.

### Geändert

- Die Integrationslisten in den Einstellungen zeigen ebenfalls das Logo der
  Integration (Anzeige, Überwachung und Meldungen, Verbindungsart pro Integration,
  ausgeblendete Integrationen) statt der farbigen Anfangsbuchstaben. Gleiche Quelle
  und gleicher Rückfall wie in der Geräteliste: ohne Logo oder bei einem älteren
  Home Assistant bleiben die Anfangsbuchstaben.

## [1.22.0] - 2026-10-06

Logos der Integrationen in der Liste.

### Geändert

- In der Geräteliste zeigt der runde Avatar das Logo der Integration statt des
  Icons der Verbindungsart (Wunsch des Nutzers); der Statuspunkt bleibt. Die Logos
  kommen vom Brand-Dienst der eigenen Home-Assistant-Instanz
  (`/api/brands/integration/<Domain>/icon.png`, seit Home Assistant 2026.3, mit
  dem Zugriffstoken aus `brands/access_token`), es wird also nichts aus dem
  Internet geladen, und es geht offline. Im dunklen Design gilt `dark_icon.png`,
  wenn es eines gibt. Ohne Logo (etwa bei manchen eigenen Integrationen) oder bei
  einem älteren Home Assistant bleibt das Icon der Verbindungsart. Die
  Verbindungsart steht weiter in ihrer Spalte, im Popup und in den Filter-Chips.

## [1.21.0] - 2026-10-06

Geräte umbenennen.

### Hinzugefügt

- Geräte-Popup: Ein Stift neben dem Namen benennt das Gerät in Home Assistant um
  (Wunsch des Nutzers). Es setzt den Gerätenamen im Geräte-Register, wie die
  Geräteseite von Home Assistant, der neue Name gilt also überall. Enter oder der
  Haken speichert, Escape oder das Kreuz bricht ab. Der Name der Integration
  bleibt erhalten und steht als "Originalname" mit "Zurücksetzen"; ein leerer
  Name stellt ihn wieder her. Es wird nur das Gerät umbenannt, Entitäts-IDs
  bleiben, wie sie sind. Umbenennen dürfen nur Administratoren (neuer Befehl
  `device_panel/rename_device`).

## [1.20.0] - 2026-10-06

Paralleler Zeitstrahl beim Ausfall.

### Geändert

- Einstellungen › Überwachung und Meldungen: Der Zeitstrahl von "Ausgefallen
  nach" und "Erst melden nach" zeigt jetzt zwei parallele Balken ab demselben
  Nullpunkt ("Gerät weg"), weil beide Zeiten ab Beginn des Ausfalls zählen
  (Wunsch des Nutzers). Die Länge folgt dem Wert (der längere füllt die Breite,
  der andere steht im Verhältnis dazu, mindestens ein Fünftel) und ändert sich
  beim Tippen. Ebenso in der Übersicht und im Detail der Integration; fehlt der
  Push, steht eine gestrichelte Linie mit dem Grund, verzögert eine Integration
  den Push, zeigt eine gestrichelte Marke den globalen Wert.

## [1.19.0] - 2026-10-06

Entitäts-ID kopieren.

### Hinzugefügt

- Geräte-Popup: Jede Entität in der Liste hat einen Kopierknopf, der ihre
  Entitäts-ID in die Zwischenablage legt (Wunsch des Nutzers). Ein Haken
  bestätigt es; der Knopf öffnet die Details der Entität nicht.

## [1.18.0] - 2026-10-06

Startwerte für neue Installationen.

### Geändert

- Neue Installationen starten mit den Werten, die der Autor nutzt (Wunsch des
  Nutzers, nach Bildschirmfotos der Einstellungen):
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

[2.6.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.6.0
[2.135.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.135.1
[2.135.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.135.0
[2.134.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.134.1
[2.134.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.134.0
[2.132.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.132.0
[2.129.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.129.0
[2.128.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.128.0
[2.125.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.125.0
[2.124.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.124.0
[2.122.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.122.0
[2.120.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.120.0
[2.119.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.119.0
[2.118.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.118.0
[2.117.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.117.0
[2.116.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.116.1
[2.116.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.116.0
[2.115.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.115.0
[2.114.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.114.0
[2.113.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.113.0
[2.112.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.112.0
[2.111.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.111.0
[2.109.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.109.0
[2.108.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.108.0
[2.107.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.107.0
[2.106.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.106.1
[2.106.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.106.0
[2.105.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.105.1
[2.105.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.105.0
[2.102.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.102.0
[2.101.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.101.1
[2.100.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.100.0
[2.99.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.99.1
[2.99.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.99.0
[2.98.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.98.1
[2.98.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.98.0
[2.97.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.97.0
[2.96.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.96.0
[2.95.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.95.1
[2.95.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.95.0
[2.93.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.93.0
[2.92.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.92.1
[2.92.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.92.0
[2.91.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.91.0
[2.90.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.90.0
[2.89.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.89.0
[2.88.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.88.0
[2.85.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.85.0
[2.82.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.82.0
[2.80.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.80.0
[2.79.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.79.0
[2.78.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.78.0
[2.76.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.76.0
[2.75.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.75.0
[2.73.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.73.0
[2.72.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.72.0
[2.71.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.71.0
[2.70.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.70.0
[2.69.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.69.0
[2.68.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.68.0
[2.66.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.66.0
[2.65.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.65.0
[2.64.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.64.0
[2.63.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.63.0
[2.60.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.60.0
[2.58.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.58.0
[2.57.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.57.0
[2.55.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.55.0
[2.54.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.54.0
[2.53.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.53.0
[2.52.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.52.1
[2.52.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.52.0
[2.51.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.51.0
[2.49.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.49.0
[2.48.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.48.0
[2.46.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.46.0
[2.44.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.44.0
[2.43.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.43.0
[2.41.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.41.2
[2.40.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.40.1
[2.40.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.40.0
[2.39.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.39.0
[2.38.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.38.0
[2.37.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.37.0
[2.35.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.35.0
[2.33.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.33.0
[2.31.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.31.0
[2.29.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.29.0
[2.28.5]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.5
[2.28.3]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.3
[2.28.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/2.28.2
[2.28.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.1
[2.28.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.0
[2.27.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.27.1
[2.27.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.27.0
[2.26.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.26.0
[2.25.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.25.0
[2.24.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.24.1
[2.24.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.24.0
[2.23.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.23.1
[2.23.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.23.0
[2.22.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.22.0
[2.21.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.21.0
[2.20.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.20.0
[2.19.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.19.0
[2.17.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.17.1
[2.17.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.17.0
[2.15.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.15.0
[2.13.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.13.0
[2.12.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.12.0
[2.11.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.11.0
[2.10.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.10.0
[2.8.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.8.0
[2.5.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.5.0
[2.3.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.3.0
[2.2.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.2.0
[2.1.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.1.0
[2.0.6]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.6
[2.0.5]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.5
[2.0.4]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.4
[2.0.3]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.3
[2.0.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.2
[2.0.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.1
[2.0.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.0
[1.44.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.44.0
[1.43.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.43.0
[1.39.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.39.0
[1.36.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.36.0
[1.35.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.35.0
[1.34.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.34.0
[1.32.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.32.0
[1.31.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.31.0
[1.27.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.27.0
[1.26.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.26.0
[1.25.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.25.0
[1.23.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.23.0
[1.22.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.22.0
[1.21.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.21.0
[1.20.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.20.0
[1.19.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.19.0
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
