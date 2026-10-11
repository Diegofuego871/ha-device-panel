# Mockups magic-overview-v1: Übersicht "Magic Push" in den Einstellungen mit Struktur und Suche

Wunsch des Nutzers (2026-10-11): Die Übersicht der Meldungen in den Einstellungen (Überwachung und Meldungen, Reiter
"Magic Push") zeigt nicht klar, was zusammengehört, und sie braucht ein Filterfeld wie die anderen langen Listen. Es
können viele Meldungen werden. Alles im echten Panel (Nachbau, erfundene Daten).

- `1-Varianten-Handy.png`: A, B, C auf dem Handy
- `2-Suche-Handy.png`: Variante B mit Suche "kritisch" (2 von 7, Treffer aufgeklappt) und ohne Treffer
- `3-Desktop.png`: B und C auf dem Desktop

Allen gemeinsam:

- Suchfeld wie in den anderen Listen (Suchfeld A, `list-search`, X, "n von m"), durchsucht Name, Satz, Gerät, Bereich,
  Integration, Empfänger und Entitäts-ID.
- Darunter ein Filter "Alle / An / Aus / Ausgelöst" mit Zahlen (Reiterleiste mit Kapsel, wie alle Auswahlen).
- Eine Zeile "7 Meldungen auf 5 Geräten" statt der losen Zeile heute.

Unterschiede:

- **A, Gerätekarten:** Pro Gerät eine Karte: Kopf mit Symbol, Name, Bereich · Integration, Zahl der Meldungen, rote Marke
  "Offline"; die Meldungen stehen innerhalb der Karte, durch Linien getrennt. Alles immer offen.
- **B, einklappbar (Empfehlung):** Wie A, aber der Kopf hat einen Pfeil. Zu zeigt die Kurzfassung ("1 Meldung · 1
  ausgelöst", "2 Meldungen · 1 aus", "nicht erreichbar"). "Alle einklappen / ausklappen" über der Liste; Suche und Filter
  klappen die Treffer auf. Skaliert bei vielen Geräten, weil man erst die Geräte überblickt.
- **C, gruppierte Liste:** Das Gerät ist eine kleine Überschrift über einer Gruppe, die Meldungen sind Zeilen darin.
  Leichter, aber der Kopf ist weniger kompakt und nicht einklappbar.

Offen: Zusätzlich könnte man die Gruppierung wählbar machen (nach Gerät, Bereich oder Integration). Nicht mockiert.

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/magic-overview-v1/src/render.mjs`
