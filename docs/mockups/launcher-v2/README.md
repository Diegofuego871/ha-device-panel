# Mockups launcher-v2: App-Launcher, Entscheide und Bearbeiten-Modus

Entscheide des Nutzers zu launcher-v1 (2026-10-13):

1. Auf dem Desktop **Raster** (Kacheln).
2. Am **Handy nur ein Favorit** in der Kopfzeile: der **oberste**. Im Launcher zeigt ein **Strich** (wie die Haftgruppe bei den Filter-Chips),
   wo die Grenze liegt. Die Reihenfolge der Favoriten bestimmt man durch Ziehen.
3. **Protokoll** (Debug) nur noch im Launcher, nicht mehr im Kopf der Einstellungen. Es lässt sich deshalb nicht ausblenden.
4. Favoriten und eigene Apps **pro Benutzer** (in den Benutzerdaten von HA, wie die anderen Herzen).
5. Die vorgeschlagene **Auswahl der HA-Seiten reicht**. Die vorinstallierten Links lassen sich **ausblenden** (Auge) und
   **sortieren** (Ziehen), in **allen Gruppen** des Launchers. Alles in einem Bearbeiten-Modus.

- `1-Launcher.png`: Launcher normal: Desktop (Favoriten mit senkrechtem Strich nach dem ersten) und Handy (Blatt, Kopfzeile nur mit dem Timer)
- `2-Bearbeiten-Desktop.png`: Bearbeiten-Modus: Ziehgriff, Auge, Herz, waagrechter Strich "Kopfzeile am Handy", gezogener Eintrag
- `3-Bearbeiten-Handy.png`: Bearbeiten-Modus auf dem Handy (44 px Zeilen)

## Verhalten

- **Favoriten**: Das Herz hängt einen Eintrag hinten an. Der **erste** Favorit steht am Handy in der Kopfzeile, auf dem Desktop **alle**.
  Zieht man einen anderen auf Platz 1, übernimmt er diesen Platz in der Kopfzeile des Handys. Ein ausgeblendeter Eintrag ist auch kein Favorit mehr.
- **Strich**: im Raster senkrecht (mit Handy-Symbol) nach dem ersten Favoriten, im Bearbeiten-Modus waagrecht mit Beschriftung.
- **Bearbeiten**: Ziehgriff links in jeder Zeile (Sortieren innerhalb der Gruppe), Auge (ausblenden/einblenden), Herz; eigene Apps zusätzlich
  Stift (ändern) und Kreuz (löschen). "Auf Standard zurücksetzen" stellt Auswahl, Reihenfolge und Ausgeblendetes wieder her.
- **Nicht ausblendbar**: Protokoll (sonst gäbe es keinen Zugang mehr zum Debug-Modus).
- **Standard** für neue Benutzer: Timer ist Favorit, alles sichtbar, Reihenfolge wie im Mockup.
- **Speicherort**: ein Eintrag in den Benutzerdaten von HA (`frontend/set_user_data`), lokale Kopie im Browser wie bei den Herzen der Timer.

## Offen zur Bestätigung

- Reicht es, dass der Strich nur die Handy-Grenze zeigt, und auf dem Desktop alle Favoriten in die Kopfzeile kommen (mehr als etwa vier
  würden dort eng)? Alternative: eine zweite Grenze für den Desktop, zum Beispiel nach dem vierten.
