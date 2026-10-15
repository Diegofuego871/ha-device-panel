# Mockups Timer mit Auslöser (2026-10-15)

Wunsch des Nutzers: Ein Timer soll statt zu einer Uhrzeit auch durch eine beliebige Entität ausgelöst werden können, wie bei
Magic Push (Bedingungen mit Und/Oder), mit Zeitfenster. Der Schritt "Wann" bekommt einen Umschalter zwischen Zeit und Auslöser.
Im echten Panel (Nachbau aus `tests/panel`, erfundene Daten), Handy; Gerät "Badwanne links" (Licht mit Optionen, darum Schritt 3 von 6).
Die Uhrzeitfelder zeigen im Nachbau 12 Stunden (Browser-Vorgabe), im Panel gilt das Format des Browsers.

| Bild | Inhalt |
| --- | --- |
| `1-Variante-A.png` | **A (Empfehlung):** Reiterleiste "Zu einer Zeit / Durch einen Auslöser" oben im Schritt "Wann". Bild 1: Zeit wie bisher. Bild 2: Auslöser mit einer Bedingung, Satz, Zeitfenster aus, Pause. Bild 3 und 4: zwei Bedingungen (Und), Dauer, Zeitfenster 22:00 bis 06:00, Pause 5 Min. |
| `2-Variante-A-Ende.png` | A: Schritt "Name und Prüfung" (Satz mit Auslöser, "Wartet auf den Auslöser") und die Zeile in der Timer-Liste. |
| `3-Variante-B-C.png` | B: wie A, aber Zeitfenster und Pause eingeklappt unter "Einschränkungen". C: zwei grosse Karten statt Reiterleiste. |

Festgelegte Regeln (alle in allen Varianten):

- Der Timer schaltet nur, wenn die Bedingung **neu eintritt** (Wechsel auf "erfüllt"). Ist sie beim Speichern, nach einem Neustart oder
  beim Beginn des Zeitfensters schon erfüllt, schaltet er nicht.
- Auslöser ausserhalb des Zeitfensters werden ignoriert, nicht auf später verschoben. Das Fenster darf über Mitternacht gehen.
- Mindestpause zwischen zwei Auslösungen (Standard 1 Minute, wählbar 1 / 5 / 15 / 60 Minuten).
- Eine Entität darf nicht ihr eigener Auslöser sein.
- Bedingungen wie bei Magic Push: über, unter, ist, ändert sich, Und/Oder mit einer Ebene Gruppen, optional "mindestens so lange erfüllt".
- Aktion, Optionen, Zurückschalten ("Aus" oder "Wie vorher"), Push, Protokoll und "Alle Timer pausieren" bleiben wie beim Timer.
- Für Auslöser gibt es kein "einmalig": der Timer schaltet bei jedem Eintreten (mit Pause).

Empfehlung A: Der Umschalter ist das, was der Nutzer sich vorgestellt hat, und die Seite bleibt eine einzige. Die Einschränkungen
(Zeitfenster, Pause) stehen sichtbar, nicht versteckt; in B sieht man sie erst nach dem Aufklappen und vergisst sie leicht, C
braucht mehr Platz für die Wahl und trennt "Zeit" und "Auslöser" stärker, als nötig ist.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/timer-trigger-v1/src/render.mjs`
