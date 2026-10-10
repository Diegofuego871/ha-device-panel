# Konzept: Lademeldung und Update-Erinnerung (Entwurf, 2026-10-10)

Update-Erinnerung umgesetzt in 1.29.0 (Entscheide: Reiter "Updates", Standard täglich 09:00 konfigurierbar, Bild wie die übrigen Meldungen); Lademeldung umgesetzt in 1.30.0 (ohne Ladeanzeige-Entität; Anstieg und "Voll ab" konfigurierbar). Mockups: `docs/mockups/charging-v1/`. Offene Entscheide stehen am Ende.

## 1. Lademeldung ("Gerät ist geladen")

**Ziel:** Push, sobald ein Gerät mit Akku voll geladen ist. Standardmässig aus; pro Gerät und pro
Integration einschaltbar (Abschnitt "Laden" im Reiter "Batterie", Zeile "Laden melden" im
Geräte-Popup, Schalter im Integrations-Detail). Vorrang wie überall: Gerät, dann Integration.

**Erkennung (von sicher zu unsicher):**

1. *Ladeanzeige des Geräts*, wenn vorhanden: Binärsensor `battery_charging`, Sensor
   "Batteriestatus" (Companion-App: charging / full), Staubsauger-Status "docked"/"charging". Dann
   gilt "Laden beendet" oder "voll" direkt. Wird zuerst geprüft, wo die Entität existiert.
2. *Stand beobachten* (Zustandsänderungen des Batteriesensors, nicht abfragen): Merkt sich den
   tiefsten Stand seit dem letzten Entladen. Steigt der Stand um mindestens 20 Punkte darüber, gilt
   das Gerät als "lädt". Erreicht es "Voll ab" (Standard 100 %, wählbar 95/98/100), geht die Meldung
   raus. Wieder scharf, wenn der Stand unter "Voll ab" minus 10 fällt.
3. *Ersatzregel für Geräte, die selten melden* (Bluetooth, Zigbee: oft nur ein Sprung 38 → 100):
   Wechsel von unter 90 % auf mindestens "Voll ab" löst die Meldung aus. Das ist derselbe Fall wie
   Regel 2 mit einem einzigen Wert, darum braucht es keine zweite Einstellung.

**Antwort auf die Frage "geht es selbstständig?":** Ja, über den Anstieg (Regel 2), solange das
Gerät oft genug meldet. Die Meldung des Anstiegs kommt aus dem Ereignis des Sensors, nicht aus
Abfragen; bei seltenen Meldungen fällt es automatisch auf Regel 3 zurück. Eine Ladeanzeige (Regel 1)
ist besser, wo sie existiert, und wird bevorzugt.

**Risiko, offen benannt:** Ein Batteriewechsel (neue Batterie: 100 %) sieht wie Laden aus. Darum
Standard aus und nur für wiederaufladbare Geräte einschalten; bei Geräten mit Wegwerfbatterie bleibt
der Schalter aus. Geräte, die nie 100 % melden, brauchen "Voll ab" 95 oder 98.

**Meldung:** "Aloe Vera ist geladen" mit "100 % · in 1 Std. 40 Min. von 22 % · Büro" (Dauer und
Startstand nur bei Regel 2). Ziel, Sammeln und Inhalt wie bei der Batterie-Meldung.

**Technik (Skizze):** neuer `ChargeNotifier` neben `battery.py`; `async_track_state_change_event` auf
den Batterie- und Ladeentitäten der eingeschalteten Geräte; Merker `{Gerät: tiefster Stand,
lädt seit, gemeldet}` in `.storage/device_panel.charge`; Optionen `charge_notify`, `charge_full`,
`charge_rise`, `charge_integrations` {Domain: bool}, pro Gerät in `.storage/device_panel.devices`.

## 2. Update-Erinnerung (ersetzt die zwei Automationen)

**Heute (Automationen des Nutzers):** täglich 09:00 die Zahl `sensor.anzahl_updates_verfugbar` in einen
Zähler schreiben; steigt der Zähler, Push mit den Namen aller `update.*` im Zustand `on`.
**Im Panel, ohne Hilfsentitäten:** auf die `update`-Entitäten selbst hören
(`EVENT_STATE_CHANGED`, neuer Zustand `on`), Sammelfenster wie bei neuen Geräten, dann eine Meldung.
Gemeldet wird nur, was neu ist: gemerkt wird je Entität die gemeldete `latest_version`
(`.storage/device_panel.updates`), also keine Wiederholung für dasselbe Update; kein Zähler nötig.

**Einstellungen** (neuer Reiter "Updates" unter "Überwachung und Meldungen", Aufbau wie "Neu"; der
bisherige Abschnitt "Updates" für das Panel selbst hiesse dann "Panel-Version"): Schalter
"Update-Erinnerung" (Standard aus), Zeitpunkt (Sofort / Täglich um … / Wöchentlich), Sammelfenster,
welche Arten (Home Assistant, Add-ons, HACS, Geräte-Firmware; übersprungene Versionen nie),
"Erinnerung wiederholen" (nie / nach 3 / nach 7 Tagen, wenn ein Update offen bleibt), Inhalt mit
Vorschau, Ausnahmen pro Integration. Ziel: das gewählte Push-Ziel (Notify Group), Antippen öffnet
`/config/updates`.

**Meldung:** "Home Assistant Update · 3 verfügbar:" mit "Name alt → neu" je Zeile (wie die
Automation, dazu die Versionen).

## Offene Entscheide

1. Laden: Bedeutung von "20 Punkte" richtig verstanden (Anstieg über das Minimum)? "Voll ab" Standard 100 %?
2. Laden: Dauer und Startstand in der Meldung gewünscht?
3. Updates: Tab "Updates" und Umbenennung des Panel-Abschnitts in "Panel-Version" in Ordnung?
4. Updates: Standard "Sofort" oder "Täglich um 09:00" (wie heute)? Wiederholung ja/nein?
5. Updates: Bild (`image`) in der Meldung wie heute? Wäre eine feste URL in den Optionen.
