# Mockups magic-conditions-v1: weitere Bedingungen (Und/Oder) im Magic-Push-Assistenten

Wunsch des Nutzers (2026-10-11): Nach Schritt 2 eine Seite mit Und/Oder-Bedingungen (wählbar). Wie auf der ersten Seite
lassen sich Bedingungen hinzufügen, auch mehrere. Die Seite lässt sich überspringen. Im echten Panel (Nachbau, erfundene
Daten), Fenster wie in magic-push-dialog-v1. Der Assistent hätte dann sechs Schritte:
Wert · Wann · Bedingungen · Versand · Text · Name.

- `1-Varianten.png`: A, B, C
- `2-A-Ablauf.png`: Variante A: leere Seite ("Überspringen"), Entität wählen, Bedingung festlegen
- `3-Kombinieren.png`: gemischtes Und/Oder mit einer Ebene Gruppen: A mit Gruppen-Kasten, C mit Klammern im Satz

Varianten:

- **A, Karten, Hinzufügen wie Schritt 1 (Empfehlung):** Die erste Bedingung (aus Schritt 2) steht oben, gesperrt. Darunter
  die weiteren Bedingungen als Karten mit Bearbeiten und Entfernen, dazwischen "UND"/"ODER". "Bedingung hinzufügen" führt
  wie Schritt 1 durch die Auswahl der Entität (Werte dieses Geräts, "Freie Entität wählen"), danach legt man die Bedingung
  fest (Reiterleiste, Wert). Oben ein Satz, wie die Meldung gelesen wird. Ohne weitere Bedingung heisst der Knopf
  "Überspringen", sonst "Weiter".
- **B, Karten mit eingebautem Editor:** Die Karte klappt auf und enthält Entität (Liste) und Bedingung. Weniger Schritte,
  aber auf dem Handy länger und schwerer zu überblicken.
- **C, Satz-Baukasten:** Die Meldung als Satz aus Bausteinen. Kompakt, aber weniger geführt und mit mehr Antippen.

Gemischtes Und/Oder (Wunsch des Nutzers): Nicht an C gebunden. Es braucht ein Modell mit einer Ebene Gruppen: oben ein
Operator (und/oder), darin einzelne Bedingungen und Gruppen, jede Gruppe mit eigenem Operator. Das deckt "A und (B oder C)"
und "(A und B) oder C" ab. In A ist die Gruppe ein Kasten mit eigenem Schalter (alle / eine genügt), in C eine Klammer im
Satz. Ohne Gruppen wäre ein gemischter Satz "A und B oder C" mehrdeutig.

Vorschlag zur Wirkung (Entscheide stehen aus):

1. Ein Operator für alle Bedingungen (Und oder Oder), keine Klammern.
2. "für mindestens" (Dauer) gilt für die Gesamtbedingung; der eigene Rücksetzwert gilt nur für die erste Bedingung, "wieder
   normal" kommt, wenn die Gesamtbedingung nicht mehr gilt.
3. Weitere Bedingungen: über, unter, ist gleich, ist (Zustand); nicht "ändert sich". Ist die erste Bedingung "ändert sich",
   fällt die Seite weg.
4. Nicht erreichbare Entität: bei Und keine Meldung (nicht beurteilbar); bei Oder zählen die anderen.
5. Rückblick (24 Std.) und Vorschau rechnen über alle Bedingungen; die Variablen bleiben die der ersten Bedingung, dazu
   `{conditions}` als Satz der Gesamtbedingung.

Neu erzeugen: `CHROMIUM_PATH=... node docs/mockups/magic-conditions-v1/src/render.mjs`
