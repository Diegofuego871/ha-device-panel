# Mockups Warnung statt Problem (2026-10-06)

Wunsch des Nutzers: Das Wort "Problem" ist zu stark (schwacher Empfang ist nicht
zwingend ein Problem). Entscheid A: Zwei Stufen. **Ausfall** = Gerät offline, **Warnung** =
instabil, Batterie niedrig, schwacher Empfang (und, wie heute beim Filter, keine
Daten). Der Filter "Nur Probleme" heisst "Nur Warnungen" und zeigt künftig nur
Warnungen, ohne Ausfälle; für die Ausfälle gibt es einen eigenen Chip
"Ausgefallen". In der Kachel "Gerade ausgefallen" steht unten die Zahl der
Geräte mit Warnung. Dazu "Warnschwelle" statt "Schwelle" bei Batterie und Empfang.
Erstellt im echten Panel (Nachbau aus `tests/panel`, erfundene Daten).

| Bild | Inhalt |
| --- | --- |
| `1-V1-schlanke-zeile.png` | **V1 (Empfehlung):** eine schlanke, antippbare Zeile "7 Geräte mit Warnung" unten in der Kachel, in den Zuständen "alles online" und "mit Ausfällen", Desktop und Handy. |
| `2-V2-mit-aufschluesselung.png` | V2: dieselbe Zeile mit Aufschlüsselung (instabil, Batterie, Empfang) als kleine Marken darunter. |
| `3-chips.png` | Die Chip-Leiste mit den neuen Chips "Ausgefallen" (rotes Symbol) und "Nur Warnungen", je mit Zahl. |

## Verhalten

- "Ausgefallen" zeigt nur Geräte, die offline sind; "Nur Warnungen" zeigt Geräte
  mit Warnung ohne Ausfälle. Beide stehen in der Standardfolge vor den Hinweisen
  und lassen sich wie die anderen Chips ordnen, ausblenden und anheften.
- Beide Chips erscheinen nur, wenn mindestens ein Gerät zutrifft (oder der Filter
  aktiv ist), wie die Hinweis-Chips.
- Die Zeile in der Kachel öffnet beim Antippen den Filter "Nur Warnungen". Ohne
  Warnungen steht dort "Keine Warnungen" (V1).
- Intern bleiben die Schlüssel (`problems` für die Warnungen); neu kommt `offline`.

## Empfehlung: V1

Die Aufschlüsselung wiederholt, was die Chips darunter (Batterie niedrig,
Schwacher Empfang) und die Kachel "Verfügbarkeit" (instabil) schon zeigen, und kostet
auf dem Handy eine zusätzliche Zeile.

Neu rendern:

```bash
cd tests/panel && npm ci && cd ../..
CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/mockups/chip-warn-v1/src/render.mjs
```
