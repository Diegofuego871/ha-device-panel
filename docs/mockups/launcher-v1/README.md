# Mockups launcher-v1: App-Launcher in der Kopfzeile

Wunsch des Nutzers (2026-10-13): Ein kleiner App-Launcher oben in der Kopfzeile mit Links zu nützlichen Seiten (zum Beispiel
Automationen, Werkzeuge). Die Timer-Übersicht und das Protokoll (Debug) werden dort ebenfalls "Apps". Mit einem Herz lässt sich
eine App als Favorit markieren: Sie erscheint dann direkt in der Kopfzeile (dort, wo heute der Timer-Knopf steht). Das Zahnrad
bleibt immer ganz rechts. Eigene Apps (Links) soll der Nutzer hinzufügen können. Alles im echten Panel (Nachbau, erfundene Daten).
Noch nichts umgesetzt: Entscheid des Nutzers steht aus.

- `1-Kopfzeile.png`: Desktop, rechter Teil der Kopfzeile: heute, neu ohne Favoriten, neu mit Favoriten
- `1b-Kopfzeile-Handy.png`: Handy: heute, neu (Launcher ersetzt den Timer-Knopf), mit einem Favoriten
- `2-Launcher-Desktop.png`: Launcher auf dem Desktop: A Raster mit Kacheln, B Liste
- `3-Launcher-Handy.png`: Launcher auf dem Handy als Blatt von unten (Raster, 3 pro Zeile)
- `4-Eigene-App.png`: Dialog "Eigene App hinzufügen" und Bearbeiten-Modus der Liste

## Konzept

- **Ein Knopf** (Raster aus 9 Punkten) an der Stelle des heutigen Timer-Knopfs. Das Zahnrad bleibt rechts daneben, unverändert.
- **Drei Gruppen** im Launcher:
  - *Device Panel*: Timer (öffnet das Fenster "Alle Timer"), Magic Push (alle Meldungen), Protokoll (mit Debug-Modus).
  - *Home Assistant*: feste Auswahl nützlicher Seiten mit Tiefenlink (Automationen, Szenen, Skripte, Helfer, Geräte, Entitäten,
    Integrationen, Werkzeuge, Verlauf, Logbuch, Energie, Add-ons). Öffnet über denselben Weg wie "Gerät öffnen" (HA-Navigation).
    Seiten, die nur Administratoren sehen, werden für andere Benutzer nicht gezeigt.
  - *Eigene*: Links des Nutzers (HA-Seite mit "/…" oder Adresse mit "https://…", die in einem neuen Tab öffnet).
- **Herz = Favorit**: Ein markierter Eintrag erscheint zusätzlich als runder Knopf in der Kopfzeile, links vom Launcher. Das Herz
  gehört dem Benutzer (wie die Herzen bei Geräten und Timern, in den Benutzerdaten von HA gespeichert).
- **Standard**: Timer ist Favorit (die Kopfzeile sieht für Bestandsnutzer aus wie heute).

## Varianten

- **A Raster** (Desktop-Empfehlung): vier Kacheln pro Zeile, Herz in der Ecke, Debug-Marke auf "Protokoll". Schnell zu überblicken.
- **B Liste**: eine Zeile pro Eintrag mit Pfad darunter und Herz rechts. Grosse Trefferfläche, passt zu langen Listen.
- **Handy**: Blatt von unten mit Raster (3 pro Zeile). In der Kopfzeile am Handy höchstens **ein** Favorit sichtbar, damit das Suchfeld
  nicht schmaler wird; weitere Favoriten stehen oben im Launcher unter "Favoriten".

## Offene Fragen an den Nutzer

1. Raster (A) oder Liste (B) auf dem Desktop? (Empfehlung: A; auf dem Handy immer Raster im Blatt.)
2. Handy: ein Favorit in der Kopfzeile erlaubt (Suchfeld 46 px schmaler) oder nur der Launcher (Suchfeld bleibt wie heute)?
3. Bleibt der Knopf "Protokoll" zusätzlich im Kopf der Einstellungen, oder wandert er nur noch in den Launcher?
4. Eigene Apps und Favoriten pro Benutzer (Empfehlung) oder für alle gemeinsam (zum Beispiel ein Familien-Dashboard)?
5. Welche Seiten von Home Assistant sollen fest dabei sein (Liste im Mockup ist ein Vorschlag)? Alternativ alle Seiten aus der
   HA-Seitenleiste automatisch anbieten.
6. Eigene App: reicht Name, Ziel und Symbol (aus 16 Symbolen), oder auch ein eigenes Bild/Emoji?
