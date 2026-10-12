# Mockups timer-v1: Timer (schaltbare Entitäten einmalig oder geplant schalten)

Wunsch des Nutzers (2026-10-12): Timer. Im Geräte-Popup ein zusätzlicher Reiter, in dem man Timer anlegt; in den
Einstellungen ein neuer aufklappbarer Abschnitt, der alle Timer sammelt (gleicher Ansatz wie Magic Push, aber nicht unter
"Meldungen", sondern als eigener Abschnitt), mit Suche und Ein-/Ausschalten. Man wählt die Entität, die man schalten will;
es werden nur schaltbare Entitäten dieses Geräts angeboten. Einmalig (danach automatisch aus) oder geplant (auf Wunsch
täglich, wöchentlich, monatlich wiederholt). Alles im echten Panel (Nachbau, erfundene Daten). Noch nichts umgesetzt.

- `1-Reiter-Timer.png`: Reiter "Timer" im Geräte-Popup, Handy: A Karten wie Magic Push, B Wecker-Stil (Empfehlung)
- `1b-Reiter-Desktop.png`: B auf dem Desktop
- `2-Assistent.png`: Assistent in vier Schritten (Was, Wann, Meldung, Name und Prüfung), Stil wie Magic Push
- `3-Wann.png`: Schritt "Wann" in den drei Arten: In 30 Min., Einmal am Datum, Wiederholt monatlich
- `4-Einstellungen-Handy.png`, `4b-Einstellungen-Desktop.png`: neuer Abschnitt "Timer" in den Einstellungen
- `5-Zustaende.png`: läuft, erledigt, Fehler, nach Neustart, Hinweis in der Geräteliste
- `7-Push.png`: Schritt "Meldung": Push pro Timer, Empfänger, Vorschau
- `6-Reiterleiste.png`: fünf Reiter auf dem Handy: A zwei Zeilen (heute), B wischen, C Symbole (Empfehlung)

## Was ein Timer ist

Ein Timer hat **eine Aktion auf einer Entität** (Einschalten, Ausschalten, Umschalten), **einen Zeitpunkt** und optional
**"danach wieder zurückschalten nach X"** (zum Beispiel "20:00 ein, nach 3 Std. 30 Min. wieder aus" in einem Timer statt
in zwei). Zeitpunkt, drei Arten:

1. **In …** (Countdown): in 5 / 15 / 30 Min. / 1 Std. oder eigene Zeit. Läuft einmal ab.
2. **Einmal**: Datum und Uhrzeit. Läuft einmal ab.
3. **Wiederholt**: Uhrzeit plus täglich, wöchentlich (Wochentage wählen, wie ein Wecker) oder monatlich (Tag des Monats,
   auch "Letzter Tag").

Einmalige Timer sind nach der Ausführung automatisch aus, bleiben aber in der Liste ("erledigt") und lassen sich mit
"Erneut starten" wieder scharf machen. Wiederholte laufen weiter, bis man sie ausschaltet.

## Reiter im Geräte-Popup (Bild 1)

- **A, Karten wie Magic Push:** gleiche Karte (Symbol, Name, Satz, Status, Schalter, Bearbeiten/Ausführen/Löschen). Vertraut,
  aber die Uhrzeit, das Wichtigste an einem Timer, steht nur im Satz.
- **B, Wecker-Stil (Empfehlung):** Uhrzeit gross, Wochentage als Zeile, darunter "nächster Lauf". Ein laufender Countdown
  zeigt statt der Uhrzeit einen Ring mit der Restzeit. Man erfasst in einem Blick, was wann schaltet. Bleibt klar, wenn
  ein Gerät viele Timer hat.

## Reiterleiste (Bild 6)

Mit "Timer" hat das Popup fünf Reiter. Auf dem Desktop passen sie in eine Zeile, auf dem Handy (390 px) rutscht der fünfte
in eine zweite Zeile. Empfehlung für das Handy: **Symbole**, die Beschriftung steht nur beim gewählten Reiter. Alternative:
seitlich wischen. Das berührt auch den bestehenden Reiter "Magic Push", Entscheid nötig, bevor der Reiter gebaut wird.

## Assistent (Bilder 2 und 3)

Vier Schritte mit denselben Schrittbalken und Knöpfen wie Magic Push (Vollbild auf dem Handy):

1. **Was:** schaltbare Entitäten dieses Geräts als Karten (mit aktuellem Zustand), darunter die Aktion und "danach
   zurückschalten" (Nie / 10 Min. / 30 Min. / 1 Std. / eigene Zeit). Eine Zeile sagt das Ergebnis in Worten.
2. **Wann:** Reiterleiste "In … / Einmal / Wiederholt", darunter je nach Art die Felder, immer mit den **nächsten
   Ausführungen** als Vorschau (so sieht man sofort, ob der Wochentag oder der Monatstag stimmt).
3. **Meldung (Push):** siehe unten.
4. **Name und Prüfung:** Name (Vorschlag aus Entität und Zeit), ein Satz in Worten (mit der Meldung), nächste Ausführung,
   Schalter "Timer aktiv" und "Jetzt testen" (schaltet wirklich, deshalb mit Hinweis).

## Push-Meldung pro Timer (Bild 7)

Wunsch des Nutzers: pro Timer ein Schalter für eine Erinnerung per Push, fester Inhalt, mit Vorschau, Empfänger wählbar,
Standard ist immer das Push-Ziel aus den Einstellungen.

- Eigener Schritt 3 "Meldung" im Assistenten, **aus** als Voreinstellung. Der Schalter ist wie überall im Panel ein Schalter
  (keine Checkbox, vom Nutzer so bestätigt), gleich wie "Kritische Mitteilung" bei Magic Push.
- **Inhalt fest** (nicht bearbeitbar, immer gleich): Titel `Timer: <Name>`, Text `<Entität> ist jetzt ein · 06:30` (bzw.
  aus / geöffnet / geschlossen). Bei einem Fehler: `Timer <Name> konnte nicht schalten: <Grund>`.
- **Vorschau** wie bei Magic Push (Karte "Home Assistant · jetzt") mit den echten Namen und Zeiten, dazu "Test senden".
- **Empfänger:** dieselbe Auswahl wie bei Magic Push und den Reitern in "Überwachung und Meldungen" (Dienste, Gruppen,
  Entitäten). Vorgewählt ist **"Standard aus den Einstellungen"** (zeigt das aktuelle Ziel, zum Beispiel `notify.familie`).
  Ändert man das Ziel in den Einstellungen, folgen alle Timer mit "Standard".
- **Wann:** nur wenn der Timer schaltet (Entscheid des Nutzers, 2026-10-12): die Meldung ist die Kontrolle, dass es
  geklappt hat. Keine Vorwarnung vorher. Schlägt das Schalten fehl, kommt stattdessen die Fehlermeldung.
- In der Liste steht bei Timern mit Push eine kleine Glocke und der Empfänger ("🔔 Push an Familie").

## Einstellungen (Bild 4)

Neuer Abschnitt "Timer" zwischen "Überwachung und Meldungen" und "Darstellung", aufgebaut wie die Übersicht von Magic Push
(Variante B aus magic-overview-v1): Suchfeld (Name, Gerät, Bereich, Integration, Entität), Filter Alle / Aktiv / Aus /
Läuft mit Zahlen, nach Gerät einklappbar, pro Timer Schalter, Bearbeiten, Ausführen, Löschen. Suche und Filter klappen die
Treffer auf. Darunter drei allgemeine Optionen: "Alle Timer pausieren" (Ferien), "Verpasste Timer nachholen" und "Bei Fehler
benachrichtigen".

## Zustände (Bild 5)

- **Läuft:** Ring mit Restzeit, "+ 5 Min.", "Ausführen", "Abbrechen".
- **Erledigt:** einmalige Timer, automatisch aus, "Erneut starten".
- **Fehler:** Entität war nicht erreichbar: rote Karte, Grund, neue Versuche (06:35, 06:40), dann eine Meldung.
- **Neustart:** was passiert, wenn Home Assistant zur Zeit des Timers nicht lief (siehe Frage 4).
- **Geräteliste:** kleine Marke "⏱ 4" beim Gerätenamen und optional ein Chip "Mit Timer".

## Technisches Vorgehen (Vorschlag, nichts gebaut)

- Neues Modul `timers.py` mit eigenem Speicher (`device_panel.timers`). Pro Timer wird der **nächste Zeitpunkt** berechnet und
  genau dafür ein Aufruf geplant (`async_track_point_in_time`), kein Abfragen im Minutentakt. Countdowns speichern den
  absoluten Zeitpunkt, überstehen also einen Neustart (wie die Pending-Liste von Magic Push).
- Die Uhrzeit gilt in der Zeitzone von Home Assistant, mit Sommerzeit; "31." in einem 30-Tage-Monat fällt auf den letzten Tag.
- Aufruf über die Dienste der Domäne (`switch`, `light`, `fan`, `input_boolean`, `siren`, `humidifier`: turn_on/turn_off/toggle;
  `cover`: open/close; `valve`: open/close; `lock`: lock/unlock). Nur Entitäten, die zum Gerät gehören (Entitätsregister).
- Fehler (nicht erreichbar, Dienst schlägt fehl): zwei Wiederholungen im 5-Minuten-Takt, dann Eintrag im Protokoll (activity)
  und auf Wunsch eine Meldung an das Ziel wie bei "Meldungen".
- WebSocket-Befehle `device_panel/timers` (Liste), `timer_set`, `timer_enable`, `timer_delete`, `timer_run`; Optionen
  `timers_pause`, `timers_catch_up`, `timers_notify_error`.
- Push über `push.py`; Ziel pro Timer, sonst das Standard-Ziel aus den Einstellungen (`notify_target`), Inhalt fest in `push.py`
  (DE und EN), Vorschau und "Test senden" über einen WebSocket-Befehl wie bei Magic Push.
- Reiter und Assistent im Panel in einer neuen Datei `timers.js` (wie `magic-push.js`), Texte in `strings.js`.

## Fragen (mit Empfehlung)

1. **Welche Entitäten und Aktionen in der ersten Version?** Empfehlung: `switch`, `light`, `fan`, `input_boolean`, `siren`,
   `humidifier` (Ein/Aus/Umschalten) sowie `cover`, `valve`, `lock` (Öffnen/Schliessen bzw. Auf-/Zuschliessen). Helligkeit,
   Farbe und Temperatur später.
2. **Mehrere Entitäten in einem Timer?** (zum Beispiel Steckdose und LED-Ring gleichzeitig). Empfehlung: nein, eine Entität
   pro Timer; wer zwei braucht, legt zwei Timer an. Einfacher und klarer im Fehlerfall.
3. **"Danach zurückschalten nach X" gleich dabei?** Empfehlung: ja, es deckt das häufigste Muster ab (Gartenlicht,
   Bewässerung, Kaffeemaschine). Offen: Schaltet jemand zwischendurch von Hand, soll das Zurückschalten trotzdem kommen?
   Empfehlung: ja (einfach und vorhersehbar), mit Hinweis im Assistenten.
4. **Verpasste Timer nach einem Neustart von Home Assistant?** Empfehlung: nachholen bis 10 Minuten nach der Zeit, später
   überspringen und im Protokoll vermerken. Einstellbar (Aus / 10 Min. / 1 Std.).
5. **Einmalige Timer nach der Ausführung:** in der Liste behalten ("erledigt", erneut startbar) oder löschen? Empfehlung:
   behalten, mit dem Knopf "Aufräumen" für erledigte, und Countdowns ("In 30 Min.") nach 24 Std. selbst entfernen.
6. **Meldung bei Fehlern:** erledigt durch den Wunsch "Empfänger pro Timer": Hat der Timer Push an, geht auch die
   Fehlermeldung an seinen Empfänger. Sonst gilt "Bei Fehler benachrichtigen" mit dem Standard-Ziel aus den Einstellungen.
7. **Reiterleiste auf dem Handy** (Bild 6): Symbole (Empfehlung), wischen oder zwei Zeilen?
8. **Zusätze, die ich vorschlage:** "Alle Timer pausieren" (Ferien), "Jetzt ausführen", Marke "⏱ n" in der Geräteliste und Chip
   "Mit Timer", Eintrag jeder Ausführung im Protokoll. Alle ausser "Jetzt ausführen" und dem Protokoll sind verzichtbar.

Entschieden (2026-10-12): Erinnerung nur bei Ausführung; Schalter statt Checkbox; Push pro Timer mit Empfänger, Standard ist das
Push-Ziel aus den Einstellungen.

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/timer-v1/src/render.mjs`
