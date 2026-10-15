# Änderungsprotokoll

[English](CHANGELOG.md)

Alle nennenswerten Änderungen an dieser Integration stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/).

## [2.56.0] - 2026-10-15

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
[2.56.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.56.0
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
