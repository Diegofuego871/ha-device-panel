# Routine mit mehreren Geräten (Konzept, Stand 2026-10-30)

Wunsch des Nutzers: In einer Routine mehrere Geräte schalten. Ein Gerät nach dem anderen hinzufügen, für jedes dieselben Schritte
wie bisher; alles andere gilt für die ganze Routine.

## Was je Ziel gilt und was gemeinsam gilt

| Je Ziel (Gerät) | Gemeinsam für die Routine |
|---|---|
| Gerät und Entität | Wann: Zeit oder Auslöser (mit Zeitfenster, Pause, "Nur einmal") |
| Aktion (Ein, Aus, Umschalten, Setzen, Aktivieren) | Zurückschalten: Nie / Nach Dauer / Zu einer Zeit / Durch einen Auslöser, "Spätestens nach" |
| Schaltoptionen (Helligkeit, Position …) | Push-Meldung und Empfänger |
| "Danach": Aus oder Wie vorher (nur wenn die Routine zurückschaltet) | Routine an/aus |
| gemerkte Szene für "Wie vorher" | Schalter und Knopf in Home Assistant (je Routine einer) |
| | Name |

Weil Aktion und Optionen je Ziel gelten, entfallen die früheren Einschränkungen: Licht und Steckdose dürfen zusammen in einer
Routine stehen, "Umschalten" ist je Ziel möglich, Optionen gibt es für jedes Ziel, das sie kann. Eine Szene als Ziel wird beim Start
aktiviert und beim Zurückschalten übersprungen.

## Ablauf im Assistenten

- Einstieg wie bisher: über "Alle Routinen" (Seite "Gerät, Gruppe oder Szene?") oder über ein Gerät (Gerät ist dann das erste Ziel).
- Seiten je Ziel: Gerät → Was (Entität, Aktion) → Optionen. Unter dem Inhalt der letzten Ziel-Seite steht ein zweiter Knopf
  "+ Gerät hinzufügen" neben "Weiter". Er legt ein neues Ziel an, die Seiten wiederholen sich für dieses Gerät.
- Kopfzeile der Ziel-Seiten: eine Reihe Chips mit den bisherigen Zielen ("1 Lampe Küche", "2 Steckdose Bad"); ein Tipp springt zu
  diesem Ziel (bearbeiten), ein Kreuz am Chip entfernt es (nicht das letzte).
- Danach wie bisher: Wann, Zurückschalten, Push, Name. Auf der Seite "Zurückschalten" steht je Ziel eine kleine Wahl "Aus" oder
  "Wie vorher" (nur bei mehreren Zielen als Liste, bei einem Ziel wie heute).
- Fortschrittsbalken: die Ziel-Seiten bleiben ein Block (bei mehreren Zielen "Ziel 2 von 3" in der Kopfzeile); die Balken
  ändern ihre Zahl nicht.
- Name: Vorschlag aus dem ersten Ziel plus "+N" (zum Beispiel "Lampe Küche +2"), frei änderbar.

## Daten (Backend)

- Das erste Ziel bleibt in den bisherigen Feldern (`device_id`, `entity_id`, `action`, `options`, `back_mode`): bestehende
  Routinen, Sicherungen und Tests laufen unverändert. Weitere Ziele stehen in `more` (Liste, höchstens 9, je `device_id`,
  `entity_id`, `action`, `options`, `back_mode`). Eine Hilfsfunktion `targets(routine)` liefert alle Ziele einheitlich; die Engine
  arbeitet nur noch damit.
- Gemerkte Szene und Wiederholungszähler des Zurückschaltens (Laufzeitdaten) je Ziel, nicht je Routine. Alte Laufzeitdaten werden
  beim Laden dem ersten Ziel zugeordnet.
- Prüfung beim Speichern je Ziel wie heute (Entität gehört zum Gerät, Aktion passt zur Art, Optionen gültig); dieselbe Entität
  nicht doppelt; keine Ziel-Entität im Auslöser oder in den Rückschalt-Bedingungen; höchstens 10 Ziele.
- Grenzen: "20 Routinen pro Gerät" zählt eine Mehrziel-Routine bei jedem beteiligten Gerät; 200 Routinen insgesamt.
- Gerät wird aus Home Assistant entfernt: nur sein Ziel entfällt (rückt das erste Ziel nach, wird das nächste das erste). Ohne
  Ziel wird die Routine gelöscht wie heute.
- Sicherung (`backup.py`): `more` gehört in die Routine und wird mit der Routine geprüft (je Ziel wie im Panel). Test: Sichern,
  zurücksetzen, wiederherstellen.

## Ablauf beim Schalten

- Alle Ziele werden zugleich geschaltet (je Ziel eigener Aufruf, eigenes Zeitlimit). Ein Fehler stoppt die anderen nicht.
- Ergebnis: alle erfolgreich = ok; einige = "teilweise" (Eintrag im Protokoll mit einem Schritt je Ziel in der Spur); keines =
  Fehler. Der Fehlerzähler und "Fehler quittieren" zählen einen Fehler je Lauf (bei "teilweise" und "Fehler").
- Zurückschalten: je Ziel, das geschaltet wurde. Ziele, die beim Start gescheitert sind, werden nicht zurückgeschaltet. Wiederholungen
  beim Rückschalten je Ziel.
- Push: eine Meldung je Lauf, Text nennt die Ziele (die ersten drei, dann "+N") und bei "teilweise" "3 von 4".
- Schalter und Knopf in Home Assistant: wie heute je Routine; der Knopf führt alle Ziele aus.

## Anzeige (Entscheid des Nutzers)

- Keine getrennte Karte in der Übersicht "Alle Routinen": Die Routine steht in der Karte jedes Geräts, das in ihr vorkommt, und im
  Reiter "Routinen" jedes dieser Geräte. Es ist dieselbe Routine (ein Schalter, eine Zeit); ein Chip nennt die anderen Geräte
  ("+1 Gerät: Steckdose Bad"). Zahlen in der Übersicht zählen sie einmal.
- Zu- und Aufklappen bleibt wie heute: Karten sind ab zwei sichtbaren Geräten standardmässig zugeklappt (auch bei einer Suche), mit
  nur einer Karte offen; jede Karte lässt sich auf- und zuklappen, "Alle aufklappen/zuklappen" bleibt.
- Zugeklappt ändert sich nichts gegenüber heute: bei einer Routine der Schalter im Kopf, bei mehreren je Routine eine schlanke Zeile
  (Name, nächster Lauf, Schalter). Kein Chip, keine zusätzliche Angabe; eine Mehrziel-Routine sieht dort aus wie jede andere.
- Aufgeklappt zeigt die Routine alle Ziele (das aktuelle Gerät markiert, die anderen mit Pfeil zu ihrem Gerät).
- Löschen löscht die ganze Routine, die Rückfrage nennt die Geräte.
- Protokoll: Titel der Routine, in der Spur ein Schritt je Ziel.

## Umsetzung (Vorschlag)

1. Mockups (`index.html`, `routine-multi-v1.png`): Seite "Was schalten" (A Chips, B Liste, C Fusszeile), Gerät für Ziel 2,
   Seite "Zurückschalten" (A je Gerät, B eine Wahl), Anzeige bei jedem Gerät, Fehlerfall. Der Nutzer entscheidet.
2. Backend: Schema, `targets()`, Engine, Protokoll, Teilfehler, Laufzeitdaten je Ziel, Sicherung, Tests (pytest).
3. Panel: Assistent (Ziele, Chips, Wiederholung der Seiten), Liste, Karte, Texte DE/EN, Simulator, Suiten (Desktop und Handy).
4. Doku: README DE/EN, CHANGELOG DE/EN, CONCEPT; Version 2.181.0.
