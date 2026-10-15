# Mockups Timer mit Auslöser, Teil 2: Zurückschalten (2026-10-15)

Wunsch des Nutzers: Auch das Zurückschalten soll durch eine Uhrzeit oder einen Auslöser festgelegt werden können, beliebig kombinierbar
(20:00 ein, aus wenn die Terrassentür offen ist; oder Bewegung ein, aus nach 5 Min. ohne Bewegung). Die Zeitfenster gelten für den Start
(siehe `timer-trigger-v1`). Im echten Panel (Nachbau aus `tests/panel`, erfundene Daten), Handy.

| Bild | Inhalt |
| --- | --- |
| `1-Seite-Zurueckschalten.png` | **A (Empfehlung):** eigene Seite "Zurückschalten" (Schritt 4 von 7) mit Reiterleiste "Nie / Nach Dauer / Zu einer Zeit / Durch Auslöser"; "Danach zurück auf: Ausschalten / Wie vorher". |
| `2-Auslöser-Kombinationen.png` | A: Zurück durch Auslöser (Bedingungen wie Magic Push, Dauer), "Spätestens nach" als Sicherung; Kombination Zeit → Auslöser; Prüfung mit Satz; Liste mit "ist eingeschaltet · wartet auf". |
| `3-Variante-B.png` | B: alles bleibt in Schritt 1 "Was schalten" unter der Aktion (Reiterleiste "Nie / Dauer / Zeit / Auslöser"); die Seite wird sehr lang. |

Regeln:

- Zurück durch Zeit: die nächste Uhrzeit nach dem Einschalten (20:00 ein, 23:30 aus → heute 23:30; wäre es 23:45 → morgen 23:30).
- Zurück durch Auslöser: schaltet, sobald die Bedingung **neu eintritt**. Ist sie beim Einschalten schon erfüllt, wartet der Timer auf das nächste Eintreten.
- Deshalb die Sicherung "Spätestens nach" (30 Min. bis 6 Std.): Kommt der Auslöser nie, wird trotzdem zurückgeschaltet. Standard aus, ausser beim Zurück durch Auslöser: dort vorgeschlagen.
- Das Zeitfenster gilt nur für das Einschalten, nicht für das Zurückschalten (sonst bliebe etwas ewig an).
- "Wie vorher" und "Ausschalten" wie in 2.52.0.
- Alle Vorgänge in einem Timer: Start Zeit oder Auslöser (4 Arten in Kombination mit Zurück Nie, Dauer, Zeit, Auslöser).

Empfehlung A: Eine eigene Seite hält "Was schalten" kurz und gibt dem Zurückschalten Platz für die Bedingungen. B spart eine Seite, macht Schritt 1 aber sehr lang.

Neu rendern: `CHROMIUM_PATH=... node docs/mockups/timer-trigger-v2/src/render.mjs`
