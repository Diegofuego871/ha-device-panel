# Konzept: HA Device Panel

Stand: Entwurf für den Projektstart. Offene Punkte sind markiert und werden
vor der Umsetzung mit dem Nutzer entschieden.

## Ziel

Ein Panel in der Seitenleiste von Home Assistant, das alle Geräte zeigt und
transparent macht:

- **Jetzt:** welche Geräte gerade ausgefallen sind (sofort sichtbar, oben).
- **Verlauf:** wie oft und wie lange ein Gerät in 24 Std. / 7 / 30 Tagen
  ausgefallen ist (Verfügbarkeit in %, Zahl der Unterbrüche, längster).
- **Inventar:** Hersteller, Modell, Softwarestand, Hardware-Version, Bereich,
  Integration, Verbindungsart.

## Fahrplan (vom Nutzer festgelegt, der Reihe nach)

Stand 2026-10-01. Mockups dazu: `docs/mockups/panel-v1/`.

**Design-Entscheid (Nutzer, 2026-10-01): Variante C**, die Kombination aus A
und B, und alle Ideen aus den Mockups werden verfolgt:

- Kopf aus B: Ring "online von gesamt", Tafel "Gerade ausgefallen" mit
  Dauer, Ausfall-Puls über 24 Std. mit Hinweis auf Sammelausfälle.
- Filter-Chips nach Verbindungsart und "Nur Probleme" (B), Ansicht
  gruppiert (Ausgefallen, Instabil, Online) oder als Liste.
- Tabelle: ausgefallene Zeilen rot hinterlegt mit Balken links (A), Dauer
  gross in der Statusspalte (B), alle Spalten über das Spalten-Popover
  wählbar und verschiebbar (A), getrennt für Desktop und Handy.
- Geräteansicht mit Tabs (B), auf dem Desktop als Seitenleiste, auf dem
  Handy als Blatt: Übersicht (Kennzahlen, wahrscheinliche Ursache, Funkweg,
  Empfangsverlauf), Verlauf (Zeitstrahl und Unterbrüche aus A,
  Unterbrüche pro Tag über 30 Tage), Verbindung, Entitäten, Einstellungen.
- Einstellungen wie Bild 5 (unifi_dynamic-Aufbau).
- Handy: Karten wie B.

1. **Geräteliste** (umgesetzt in 0.2.0b1, erweitert in 0.3.0b1 um
   Ausfall-Puls, Gruppe Instabil, Verfügbarkeit 24 Std., Typ und Integration
   mit Eintrag; Hinweise sind seither Chips; Gesundheit folgt) mit
   sinnvollen Spalten: Gerät, Status mit Offline-Dauer,
   Verbindungsart, Empfang, Integration, Hersteller/Modell, Software (mit
   Update-Hinweis), Batterie, Verfügbarkeit 24 Std. Ausgefallene Geräte
   sehr klar erkennbar und zuoberst; oben sofort die Statistik: wie viele
   ausgefallen und seit wann.
2. **Spalten und Ansicht pro Benutzer:** Spalten ein-/ausblenden und
   verschieben, Sortierung und Filter gespeichert, getrennt für Desktop und
   Handy (siehe "Pflicht", Abschnitt 3). Mockups `docs/mockups/view-v1/`.
   Entschieden: Desktop nach Bild 6, Handy Variante A (ein Blatt "Ansicht").
   Umgesetzt in 0.19.0: `frontend/set_user_data` mit Schlüssel
   `device_panel_view` ({desktop, mobile, updated}; je Sortierung,
   Richtung, Gruppen/Liste, Spalten bzw. Angaben auf der Karte mit
   Reihenfolge, Filter-Chips), lokale Kopie in localStorage, der neuere
   Stand gewinnt, an HA verzögert (400 ms) und gebündelt. Unbekanntes wird
   beim Laden bereinigt, neue Spalten kommen mit ihrem Standard ans Ende.
   Änderungen gelten sofort (keine "Speichern"-Taste), wie die Spaltenwahl
   in unifi_dynamic. Sortierung "Standard" = Folge der Gruppen; eine andere
   Sortierung gilt innerhalb der Gruppen bzw. über die ganze Liste, Geräte
   ohne Wert am Ende. Mit Batterie-Chip und Standard-Sortierung nach Stand.
   Dazu (Nutzer, 2026-10-02): Filter-Chips der Verbindungsart einzeln
   ausblendbar, standardmässig alle sichtbar; "Alle" und die hinteren Chips
   ("Nur Probleme", Hinweise, "Eigene Einstellung") bleiben immer.
   Umgesetzt in 0.11.0 als globale Einstellung (Variante C in
   `docs/mockups/view-v2/`, Abschnitt "Anzeige", auch im Optionsdialog).
   Dazu (Nutzer, 2026-10-02) die Reihenfolge der Chips per Ziehen, ebenfalls
   global (`connection_order`, leer = nach Anzahl der Geräte), umgesetzt in
   0.13.0.
   Seit 0.17.0 (Nutzer, 2026-10-02): Die Zahl auf einem Chip zählt mit
   der Suche und den übrigen Filtern (so viele Zeilen, wie das Antippen
   zeigt); welche Chips erscheinen, richtet sich weiter nach allen Geräten.
   Ein aktiver Chip lässt sich mit einem zweiten Tipp abwählen. Neuer Chip
   "Batterie" (alle Geräte mit Batterie, je Gruppe nach Stand sortiert).
   **To-do** (Nutzer, 2026-10-02): Filter nach Bereich, damit jeder nach
   seinen Bereichen filtern kann. Mockups `docs/mockups/area-v1/`
   (Empfehlung A: Chip "Bereich" mit Auswahl nach Etagen), Entscheid offen.
3. **Einstellungsmenü im Panel**, das alle Optionen der Integration abbildet
   (siehe "Pflicht", Abschnitt 1). Darin pro Integration: anzeigen, Push,
   anhaltende Benachrichtigung. Grundgerüst umgesetzt in 0.4.0 (Zahnrad,
   Dialog, Speichern/Abbrechen, `get_options`/`set_options`, Optionsdialog
   von HA). Abschnitte "Integrationen" und "Gerätetypen" (Anzeigen) in
   0.5.0, "Ausfall-Erkennung" und "Anzeige" in 0.6.0, "Batterie" und
   "Push-Benachrichtigung" in 0.7.0 bis 0.9.0. Es fehlen "Anhaltende
   Benachrichtigung" bei Ausfällen sowie die Spalten Push/Anhaltend bei den
   Integrationen (mit Schritt 7).
4. **Update-Bereich wie unifi_dynamic:** Version, "Nach Updates suchen",
   "Aktualisieren" über die HACS-Update-Entität, Vorabversionen,
   "In HACS freischalten" (Entität "Pre-release" aktivieren, etwa 30 s auf
   HACS warten, einschalten). Ohne HACS: nur Hinweis mit Link, genau wie
   unifi_dynamic (Nutzer, 2026-10-01). Umgesetzt in 0.4.0 (vom Nutzer
   vorgezogen, damit er nicht jedes Release über HACS installieren muss).
   Abweichung von unifi_dynamic: GitHub antwortet auf `releases/latest` mit
   404, solange es nur Vorabversionen gibt; das gilt nicht als Fehler. Und
   wer eine Vorabversion installiert hat, bekommt neuere standardmässig
   angeboten, bis "Vorabversionen anzeigen" einmal gespeichert ist.
5. **Geräteansicht** beim Antippen: Verfügbarkeit mit Zeitstrahl und
   Unterbrüchen, Verbindung und Empfang, Gerätedaten, Entitäten, Platz für
   Einstellungen und Statistiken pro Gerät. Umgesetzt in 0.3.0b1 als Popup
   wie unifi_dynamic (Wunsch des Nutzers, 2026-10-01): Kopf, Statistik-
   Kacheln (Verfügbarkeit 24 Std., Unterbrüche 7 Tage, Empfang, Batterie),
   Verbindung, Gerät, Entitäten; ein Tipp auf eine Statistik-Kachel öffnet
   ein zweites Fenster (Zeitraum 24 Std./7/30 Tage, Zeitstrahl, Liste,
   Unterbrüche pro Tag). Offen aus Variante C: wahrscheinliche Ursache,
   Funkweg, Empfangsverlauf, Einstellungen pro Gerät.
6. **Verfügbarkeitsprotokoll:** Unterbrüche, 24 Std. / 7 / 30 Tage,
   "instabil" bei vielen Unterbrüchen (siehe "Verfügbarkeitsprotokoll").
   Umgesetzt in 0.3.0b1; Recorder-Nachfüllen in 0.18.0.
7. **Push-Meldungen** mit einstellbarem Inhalt wie unifi_dynamic, Klickziel,
   Entwarnung, anhaltende Benachrichtigung (siehe "Push-Meldungen").
8. **Ideen** (aus den Mockups, vom Nutzer angenommen): Gesundheitswert pro
   Gerät, Hinweis auf wahrscheinliche Ursache (Batterie, Empfang),
   Sammelausfall erkennen und zusammenfassen, Ausfall-Puls (Zahl
   ausgefallener Geräte über 24 Std.), Funkweg (Zigbee-Route, Bluetooth-
   Proxy), Empfangsverlauf, Stummschalten pro Gerät, Filter nach
   Verbindungsart.

### Verbindungsart und Empfang: Quellen (geprüft in HA 2026.2)

| Was | Quelle | Sicherheit |
| --- | --- | --- |
| Zigbee, Bluetooth, IP | `device.connections` (`zigbee`, `bluetooth`, `mac`) | geprüft |
| Hub / Bridge | `device.via_device_id` | geprüft |
| Thread / WLAN / Ethernet bei Matter | WebSocket `matter/node_diagnostics` | geprüft (Befehl existiert), Felder noch nicht |
| Thread-Rolle bei HomeKit | Sensoren `ThreadStatus` von homekit_controller | geprüft |
| Zigbee LQI/RSSI | ZHA-Gerätedaten (`lqi`, `rssi`, WebSocket `zha/devices`) | geprüft |
| WLAN-Empfang | Sensoren mit `device_class: signal_strength` (dBm), z. B. Shelly, ESPHome | geprüft (Shelly) |
| Bluetooth-Empfang und Proxy | `bluetooth.async_last_service_info` (RSSI, Quelle) | geprüft |
| Thread-Empfang, Zigbee-Route | Matter-Thread-Diagnose, ZHA-Nachbartabelle | offen |
| Verbindungsart von Hand | Popup, `.storage/device_panel.devices` ("connections"), Vorrang vor der Erkennung und der Matter-Diagnose | seit 0.12.0 |
| Verbindungsart pro Integration | Option `connection_integrations` {Domain: Art} (primäre Integration), Abschnitt "Verbindungsart"; Vorrang: Gerät von Hand, dann Integration, dann Erkennung. Gilt für alle Geräte der Integration, auch richtig erkannte (Nutzer, 2026-10-02, Variante B: viele falsch erkannte, nicht nur unbekannte) | seit 0.16.0 |

## Überwachung einstellen (vom Nutzer angenommen, 2026-10-01)

Ziel des Nutzers: sehr flexibel. Weder die Integration allein noch der
Entitätstyp allein reicht: ZHA hat netzbetriebene Router und schlafende
Batteriesensoren mit ganz anderem Zeitverhalten; "Schalter" gibt es in
vielen Integrationen. Deshalb vier Ebenen, je Einstellung gilt die
genaueste: **Gerät vor Regel vor Integration vor Standard** (Mockup
`docs/mockups/panel-v1/9-ueberwachung-regeln.png`).

1. **Standard:** alle Geräte, ausgefallen nach 2 Min., Lebenszeichen = alle
   aktivierten, sichtbaren Entitäten ausser Diagnose/Konfiguration;
   ein Verbindungssensor (`binary_sensor`, `connectivity`) hat Vorrang.
2. **Integration:** Tabelle mit Anzeigen, Überwachen, Push, Anhaltend (und
   optional eigener Schwelle). Reicht für die meisten.
3. **Regeln:** Bedingungen mit UND verknüpft, Wirkungen nur für das, was die
   Regel setzt ("unverändert" sonst). Reihenfolge per Ziehen; je
   Einstellung gewinnt die oberste passende Regel.
   - Bedingungen: Integration, Bereich, Etage, Label (HA-Labels an Gerät),
     Entitätstyp (Gerät hat z. B. einen Schalter), Verbindungsart,
     Stromversorgung (Batterie, wenn eine Entität `device_class: battery`
     hat), Hersteller, Modell, einzelnes Gerät.
   - Wirkungen: anzeigen, überwachen, ausgefallen nach, Push (an/aus,
     sofort), anhaltend, Ruhezeit, Lebenszeichen (welche Entitätstypen
     zählen).
   - Vorschau "trifft auf N Geräte zu" mit Namen, Hinweis auf Ausnahmen.
4. **Gerät:** Ausnahme im Tab "Einstellungen" der Geräteansicht. Dort steht
   bei jeder Einstellung, woher sie kommt (Standard, Integration ZHA,
   Regel "…").

**Typ und Integration in der Liste** (Wunsch des Nutzers, 2026-10-01): Die
Liste zeigt pro Gerät den Gerätetyp und die Integration samt Eintrag, damit
man sieht, worauf ein Ausschluss wirkt. In der Konfiguration sollen sich
ganze Integrationen (Ebene 2) und Gerätetypen (Bedingung in Ebene 3)
ausschliessen lassen. Der Typ kommt aus `devices.device_type`: Hub/Bridge,
wenn andere Geräte über das Gerät verbunden sind; Handy/Computer bei der
Companion-App (`mobile_app`); Netzwerk bei Integrationen für Router, Access
Points, Switches und NAS (`_NETWORK_DOMAINS`, z. B. `unifi`, `fritz`,
`synology_dsm`); sonst die wichtigste Domain der Entitäten (Klima, Schloss,
Abdeckung, Ventil, Roboter, Kamera, Alarm, Medien, Ventilator, Licht,
Schalter bzw. Steckdose bei `device_class: outlet`), dann Binärsensoren nach
Klasse (Bewegung, Tür/Fenster, Sicherheit), dann Energie/Zähler (mindestens
die Hälfte der Sensoren misst Leistung, Energie, Gas, Wasser, Strom oder
Spannung), dann Sensor, Taster, Sonstiges. Die Integration ist der primäre
Eintrag des Geräts (`primary_config_entry`, sonst der erste).

**Umgesetzt in 0.5.0** (Nutzer, 2026-10-01): ein Typ pro Gerät; im Popup
lässt er sich von Hand setzen ("Automatisch: …" stellt zurück), gespeichert
in `.storage/device_panel.devices` und gültig auch für die Ausschlüsse. Die
Einstellungen (Panel und Optionsdialog) blenden ganze Integrationen
(primärer Eintrag) oder Typen aus (`exclude_integrations`,
`exclude_types`). Ausgeblendet heisst: nicht gezeigt und nicht überwacht;
das Protokoll setzt ab dann "keine Daten", Puls und Sammelausfälle zählen
nur gezeigte Geräte. Die vollen Ebenen 2 bis 4 (Überwachen, Push, Schwelle
pro Integration, Regeln) folgen später.

Geprüft in HA 2026.2: Geräte haben `labels`, `area_id`, `via_device_id`,
`entry_type`, `model_id`; Entitäten haben `labels`, `entity_category`,
`hidden_by`, `original_device_class`.

## Wahrscheinliche Ursache (regelbasiert, ohne KI)

Feste Regeln über Fakten, die HA und das eigene Protokoll liefern; lokal,
sofort, nachvollziehbar und testbar. Angezeigt werden höchstens zwei
Ursachen mit "wahrscheinlich" oder "möglich" und den Fakten dahinter; passt
keine Regel, steht "keine eindeutige Ursache".

| Ursache | Signal | Sicherheit |
| --- | --- | --- |
| Integration läuft nicht | Config-Entry nicht `loaded` (`setup_retry`, `setup_error`, `not_loaded`) | sicher |
| Hub/Bridge ausgefallen | `via_device` zur selben Zeit ausgefallen | hoch |
| Bluetooth-Proxy | der Proxy, der das Gerät zuletzt sah, ist ausgefallen | hoch |
| Sammelausfall | ≥ 3 Geräte derselben Integration, desselben Hubs oder derselben Verbindungsart innert 2 Min. | hoch (gemeinsamer Teil) |
| Batterie | Batterie ≤ 15 % vor dem Ausfall oder stark fallend | mittel bis hoch |
| Empfang | zuletzt ≤ −80 dBm bzw. LQI ≤ 60, fallender Trend über 7 Tage, viele kurze Unterbrüche | mittel |
| Cloud-Dienst | Integration mit `iot_class` cloud_*, alle ihre Geräte ausgefallen | mittel |
| Strom im Bereich | alle netzbetriebenen Geräte eines Bereichs gleichzeitig | niedrig bis mittel |
| Nach Update | `sw_version` kurz vor dem Ausfall geändert | niedrig |

Was sofort geht (Zustand jetzt): Integration, Hub, Proxy, Batterie jetzt,
Sammelausfall ab Start des Protokolls. Trends (Empfang, Batterie) brauchen
ein eigenes Protokoll von Empfang und Batterie (wie `signal_log` in
unifi_dynamic), also Fahrplan-Schritt 6. Optional später: Zusammenfassung
über die KI-Aufgaben von HA (`ai_task`), nur wenn der Nutzer dort ein
Modell eingerichtet hat; nicht als Grundlage (Kosten, Datenschutz, nicht
vorhersehbar).

## Datenquellen (alles aus Home Assistant, keine externe API)

| Was | Quelle |
| --- | --- |
| Geräte | Device Registry (`dr.async_get(hass).devices`) |
| Softwarestand | `device.sw_version`, `device.hw_version` |
| Hersteller/Modell | `device.manufacturer`, `device.model` |
| Bereich | `device.area_id` → Area Registry |
| Integration | `device.config_entries` → `entry.domain`, `entry.title` |
| Entitäten | Entity Registry (`er.async_entries_for_device`) |
| Zustand | State Machine, Ereignis `state_changed` |
| Updates verfügbar | Entitäten der Domain `update` am Gerät |

## Wann gilt ein Gerät als ausgefallen? (Standard, angenommen)

Siehe auch "Überwachung einstellen": Schwelle und Lebenszeichen sollen dort
pro Integration, Regel und Gerät einstellbar werden; hier steht der
Standard. Seit 0.6.0 gilt für alle Geräte gemeinsam (Abschnitt
"Ausfall-Erkennung"): "Ausgefallen nach" 1–60 Min. (Standard 2), "Instabil
ab" 2–50 Unterbrüche in 24 Std. (Standard 3), "Anlaufphase nach dem Start"
0–30 Min. (Standard 5). Eine neue Schwelle gilt ab dem Speichern; das
Protokoll schreibt bisherige Unterbrüche nicht um.

- Gerät **offline**, wenn alle seine aktivierten Entitäten `unavailable`
  sind (Ausnahmen: deaktivierte, versteckte, `diagnostic`-Entitäten zählen
  nicht als Lebenszeichen, wenn es andere gibt).
- Hat das Gerät eine Konnektivitäts-Entität (`binary_sensor` mit
  `device_class: connectivity`), gilt deren Zustand vorrangig.
- Kurze Aussetzer unter einer Schwelle (Standard 2 Min., einstellbar) zählen
  nicht als Unterbruch; HA-Neustarts zählen nie (Lehre aus unifi_dynamic:
  "keine Daten" ist nicht "offline").
- Geräte ohne Entitäten oder reine Dienst-Geräte (`entry_type: service`)
  standardmässig ausgeblendet. Seit 0.6.0 (Abschnitt "Anzeige"): Dienst-
  Geräte lassen sich zeigen und werden dann wie alle überwacht;
  deaktivierte Geräte lassen sich zeigen (mit ihren deaktivierten
  Entitäten), in eigener Gruppe am Ende, nie überwacht und nicht in Kopf,
  Puls oder "Nur Probleme".

## Verfügbarkeitsprotokoll

Umgesetzt in 0.3.0b1 (`availability.py`).

- Entfernen der Integration (seit 0.14.0, Nutzer, 2026-10-02):
  `async_remove_entry` löscht alle eigenen Dateien (`.storage/device_panel.`
  `availability`, `devices`, `notify`, `battery`, `panel`) und die geladenen
  Stände in `hass.data`. Meldungen und Batterie schreiben beim Entladen
  sofort, damit kein verzögertes Schreiben eine Datei nach dem Löschen neu
  anlegt.
- Eigene Datei pro Instanz (`.storage/device_panel.availability`), nicht der
  Recorder: Wechsel `[zeit, zustand]` pro Gerät, 31 Tage, dazu ein
  Lebenszeichen (`heartbeat`), mindestens alle 5 Min. geschrieben.
- Zustand 1 = online, 0 = offline, None = keine Daten (HA lief nicht).
- Beim Start: Lücke seit dem letzten Lebenszeichen als "keine Daten"
  markieren; beim Stoppen ab jetzt "keine Daten".
- Alle 30 s Bewertung mit derselben Regel wie die Liste
  (`devices.device_status`): Ausfälle unter 2 Min. erscheinen nicht; Beginn
  ist der echte Wechsel (`last_changed`), Rückkehr der früheste Wechsel der
  lebenden Entitäten. Anlaufphase 5 Min. nach dem Start: wer darin
  zurückkommt, hatte keinen Unterbruch.
- **Ausfall über Lücken (seit 0.13.0, Nutzer: "essentiell"):** Ein Ausfall
  endet erst, wenn HA das Gerät wieder online sieht. `last_changed` beginnt
  nach jedem Neustart beim Start; massgebend ist darum das Protokoll: Beginn
  = erster Ausfall nach der letzten Beobachtung "online"
  (`AvailabilityLog.open_outage`, `devices.outage_start`). Lücken ohne Daten
  dazwischen (Neustart, Absturz, eine Weile nicht überwacht) beenden ihn
  nicht. Bedeutung für den Nutzer: "seit HA das Gerät zuletzt online sah".
  - Sicher (ohne "≥"), wenn HA den Wechsel online → ausgefallen selbst sah.
  - "Mindestens" (≥), wenn der Beginn in eine Lücke fällt (online beim
    Stoppen, nach dem Start weg) oder vor dem Protokoll liegt (Beginn kurz
    nach dem Start von HA, gekürzt nach 31 Tagen).
  - Zahlen und Dauer (Unterbrüche, längster, Summe, Prozent, pro Tag,
    instabil, Sammelausfall, Meldungen) zählen einen Ausfall über eine Lücke
    als einen (`bridged`), die Lücke als Teil davon. Balken, Streifen und
    Puls zeigen weiter, was HA beobachtet hat, die Lücke als "keine Daten".
  - Liste der Unterbrüche im Statistik-Fenster ebenso (seit 0.20.0,
    Fehlerbericht des Nutzers: nach jedem Neustart ein neuer Eintrag):
    `history()` liefert `outages` aus den überbrückten Abschnitten; das
    Panel nimmt Liste, Zahl, Summe, längsten, Prozent (`summary`) und den
    Tooltip eines Balkenteils daraus, nicht aus den Rohabschnitten.
  - Prozent erst ab 1 Std. Daten im Zeitraum (seit 0.17.0,
    `availability.PCT_MIN_COVERED`, im Panel gleich): Kurz nach dem ersten
    Start hiesse ein Unterbruch von einer Minute sonst "50 %". Darunter
    liefert `summarize` `pct: None`, das Panel zeigt "–" mit Hinweis;
    Unterbrüche und Dauer erscheinen weiter. Der Durchschnitt oben nimmt
    nur Geräte mit Prozent, ohne solche den Anteil gerade online.
  - Unter "Ausgefallen nach" (alle Entitäten weg, aber noch keine Schwelle)
    ist ein Gerät weder ausgefallen noch online: Das Protokoll schreibt
    nichts. Nach einem Neustart sind das die Geräte, die schon vorher
    fehlten; die Liste zeigt sie gleich als ausgefallen, wenn das Protokoll
    den Ausfall vor der Lücke kennt.
- Instabil: online, aber 3 oder mehr Unterbrüche in 24 Std.
- Sammelausfall: mindestens 3 Geräte, die innert 2 Min. ausfielen; gemeinsame
  Integration als Hinweis auf die Ursache. Ein Ausfall, der über einen
  Neustart läuft, beginnt beim Start nicht neu.
- WebSocket: `device_panel/list_devices` liefert pro Gerät `avail24`
  (Kurzfassung und 48 Abschnitte à 30 Min.), dazu `pulse` und `incidents`;
  `device_panel/device` die Entitäten und Kurzstatistik 24 Std./7 Tage;
  `device_panel/availability` den Verlauf für 24 Std., 7 oder 30 Tage.
- Einmaliges Nachfüllen aus dem Recorder (seit 0.18.0, Nutzer, 2026-10-02:
  "ja übernehmen"; `backfill.py`): zwei Minuten nach dem Start, im
  Hintergrund über den Executor des Recorders, für jedes überwachte Gerät
  mit Einträgen die Zeit vor seinem ersten Ereignis (höchstens 31 Tage,
  praktisch so weit der Recorder reicht, Standard 10 Tage). Regel wie die
  Bewertung: weg, wenn alle gewählten lebenden Entitäten weg sind
  (Verbindungssensor: aus oder nicht verfügbar, sonst nicht verfügbar);
  Ausfall erst ab "Ausgefallen nach"; Anlaufphase ab jedem Start eines
  Recorder-Laufs; zwischen zwei Läufen "keine Daten". Ein Ausfall, der beim
  ersten eigenen Ereignis noch läuft (Protokoll beginnt mit "ausgefallen"),
  zählt auch kürzer. Grenzen für grosse Installationen: höchstens 3
  Entitäten pro Gerät, ruhige zuerst (Verbindungssensor, dann keine
  Sensoren, Messwerte wie Leistung zuletzt), Entitäten mit 20 000 oder mehr
  Wechseln im Zeitraum fallen weg. Ein Absturz erscheint nicht als Lücke
  (der Recorder schliesst den Lauf erst mit dem nächsten Start). Merker
  `backfilled` im Protokoll: einmal pro Instanz; ohne Recorder oder während
  einer Datenbank-Migration kein Merker (später erneut), bei einem Fehler
  Merker trotzdem (nicht bei jedem Start erneut scheitern). Keine Meldungen
  für vergangene Ausfälle.
- Speichern über `storage_util.PeriodicSaver` (siehe LEARNINGS).

## Panel (Aufbau wie unifi_dynamic)

- Werkzeugleiste: Suche, Filter, Spalten, Einstellungen.
- Zähler-Leiste: "120 Geräte · 117 online · 3 ausgefallen" (antippbar als
  Filter).
- Tabelle: Name, Bereich, Integration, Hersteller/Modell, Softwarestand,
  Verfügbarkeit 24 Std. (%), Unterbrüche, Status, zuletzt geändert.
  Ausgefallene Geräte zuoberst (Standard-Sortierung), sortierbar,
  Spalten ein-/ausblendbar und verschiebbar, Filter pro Spalte.
- Geräteansicht (Dialog/Blatt): Kopf mit Symbol, Kacheln (Verfügbarkeit,
  Unterbrüche, Software), Statistik-Fenster mit Tabs und Zeitraum
  24 Std./7/30 Tage, Zeitstrahl wie unifi_dynamic, Liste der Entitäten,
  Link zur HA-Geräteseite.
- Einstellungen: Schwelle, ausgeschlossene Integrationen/Geräte,
  Benachrichtigungen, Updates/Vorabversionen.

## Pflicht: aus unifi_dynamic übernehmen

Diese Funktionen gehören zum Grundumfang und werden aus
Diegofuego871/unifi_dynamic übernommen (Verhalten, Texte, Design und Tests).
Pfade beziehen sich auf jenes Repository, Stand v2.16.0.

### 1. Alle Einstellungen im Panel

- Zahnrad öffnet den Dialog "Einstellungen" mit zuklappbaren Abschnitten,
  Zusammenfassung pro Abschnitt, Etikett "geändert", Zähler der Änderungen.
- Alles gilt erst mit "Speichern", "Abbrechen" verwirft. Seit 0.15.0
  (Nutzer, 2026-10-02) bleibt der Dialog nach "Speichern" offen: "Gespeichert"
  neben den Knöpfen, gespeicherter Stand neu geladen, aufgeklappte
  Abschnitte bleiben; ohne Änderung heisst "Abbrechen" "Schliessen". Dieselben Options wie
  der Optionsdialog von HA, keine Kopie: Lesen/Schreiben über WebSocket
  (`get_options`, `set_options`), Wertebereiche einmal zentral
  (`options_api.py`), Reload nur bei Werten, die beim Setup eingefroren sind.
- Panel: `_openSettings`, `_settingsSections`, `_settingsChanges`,
  `_settingsEntryChanges`, `_settingsExtraChanges`, `_saveSettings`;
  Backend `_ws_get_options`, `_ws_set_options` (`options_api.py`).

### 2. Update-Bereich mit Beta und Freischalten in HACS

- Versionszeile oben in den Einstellungen: installierte Version, neue
  Version (GitHub), "Nach Updates suchen", "Aktualisieren" über die
  HACS-Update-Entität (`update.install`), Neustart-Hinweis nach der
  Installation, Release Notes.
- Abgleich mit HACS: Kennt HACS die Version noch nicht, lädt das Panel HACS
  automatisch nach ("Wird mit HACS abgeglichen …"), sonst Hinweis.
- Schalter "Vorabversionen anzeigen", gilt für die ganze Instanz (Backend-
  Speicher über `set_panel`), wirksam mit "Speichern". Vorabversion =
  GitHub-Pre-Release oder Nummer mit b/rc. Beta-Zeile violett mit Etikett
  "Beta".
- Freischalten: HACS installiert Betas nur mit eingeschalteter Entität
  "Pre-release" (standardmässig deaktiviert). Knopf "In HACS freischalten"
  aktiviert die Entität (`config/entity_registry/update`), wartet bis HACS
  neu geladen hat, schaltet sie ein; beim Ausschalten der Vorabversionen
  wird sie wieder ausgeschaltet, aber nur, wenn das Panel sie eingeschaltet
  hat. Link zum HACS-Gerät als Alternative.
- Tägliche Prüfung mit Meldung unter "Reparaturen" (nie für Betas).
- Panel: `_loadVersion`, `_versionState`, `_isPreVersion`, `_refreshHacs`,
  `_hacsUpdateEntity`, `_hacsPreReleaseSwitch`, `_enableHacsPrerelease`,
  `_disableHacsPrerelease`, `_versionRowHtml`, `_prereleaseOptHtml`;
  Backend `update_check.py`, `_ws_version`, `_ws_set_panel`.
- Tests: `tests/panel/suites/version-e2e.mjs`, `statdlg-e2e.mjs`
  (Beta-Teil), `tests/legacy/panel_settings_unit.py`.

### 3. Speicher-Konzept für Spalten, Ansicht und Benutzereinstellungen

- Pro Benutzer (über `frontend/set_user_data`, auf allen Geräten gleich):
  Sortierung, Filter (Status, Verbindung …), ausgeblendete Spalten und
  Spaltenreihenfolge **getrennt für breit und schmal** (Handy,
  `NARROW_QUERY = "(max-width: 600px)"`), Zeitraum der Statistik, gewählte
  Instanz, Loader.
- Lokale Kopie in `localStorage`; beim Laden gewinnt der neuere Stand
  (Zeitstempel `updated`); Schreiben an HA verzögert und gebündelt.
  Unbekannte oder ungültige Werte werden beim Laden bereinigt
  (`sanitizePrefs`).
- Nicht gespeichert: Suchtext, Textfilter pro Spalte.
- Spaltenwahl: Desktop als Popover, Handy als Blatt; Reihenfolge per Ziehen
  oder Pfeiltasten; ausgeblendete Spalten behalten ihren Platz
  (`_mergeVisibleOrder`).
- Panel: `DEFAULT_PREFS`, `loadPrefs`, `savePrefs`, `sanitizePrefs`,
  `_applyPrefs`, `_currentPrefs`, `_savePrefs`, `_saveUserPrefs`,
  `_loadUserPrefs`, `_isNarrow`, `_colOrder`, `_hiddenCols`.
- Tests: `userprefs-e2e.mjs`, `cols-e2e.mjs`, `order-e2e.mjs`.

### 4. Weiteres Verhalten

- Deep-Link aus Meldungen direkt in die Geräteansicht.
- Verbindungsabbrüche still überbrücken, Polling im Hintergrund pausieren.
- Statistik-Fenster mit Tabs, Zeitraum 24 Std./7/30 Tage, Loader.

## Push-Meldungen (Grundlage seit 0.7.0)

Wie in unifi_dynamic (`docs/reference/notification.py`). Bereits umgesetzt:

- Versand in `push.py` (seit 0.7.0, zuerst für die Batterie-Warnung): Ziel
  `notify_service` (notify-Dienst, Gruppe oder notify-Entität, "none" =
  aus), Klickziel `notify_click_target` (Gerät im Panel über
  `/device-panel?device=<id>` oder HA-Geräteseite), Zusatzdaten mit `url`,
  `clickAction`, `tag`, `icon_url`, zweiter Versuch ohne Zusatzdaten,
  notify-Entitäten über `notify.send_message`, Texte DE/EN nach
  `hass.config.language`.
- Batterie-Warnung (`battery.py`, Abschnitt "Batterie"): Schwelle pro Gerät
  = eigene des Geräts (Popup), sonst die seiner primären Integration
  (`battery_low_integrations`, seit 0.8.0, Mockup A) oder "Schwach ab".
  Seit 0.14.0 (Nutzer, 2026-10-02, `docs/mockups/battery-v2/`, Variante B)
  kann eine Integration auch "off" sein: keine Warnung für ihre Geräte, ausser
  eines hat eine eigene Schwelle. In der Liste je Zeile eine Auswahl wie im
  Geräte-Popup (Globaler Wert / Eigene Schwelle / Aus), das Zahlenfeld nur
  bei eigener Schwelle; im Optionsdialog "zha: off" (auch False aus YAML 1.1). Die Liste dafür zeigt nur
  Integrationen mit Batteriegeräten (Registry bzw. Geräteklasse, nicht der
  aktuelle Wert), dazu solche mit eigener Schwelle ohne Geräte. Push einmal
  pro Gerät beim Unterschreiten, gemerkt in
  `.storage/device_panel.battery`; erneut erst nach `BATTERY_REARM` (5)
  Punkten darüber; keine Werte (nicht erreichbar) ändern nichts; mehr als
  `BATTERY_PUSH_MAX` (3) neue auf einmal = Sammelmeldung; Einschalten oder
  neues Ziel meldet die aktuell betroffenen einmal. Anhaltende
  Benachrichtigung (`persistent_notification`, ID `device_panel_battery`)
  mit allen betroffenen Geräten, verschwindet, wenn keines mehr betroffen
  ist; weggeklickt (Callback REMOVED) erst wieder bei einem neuen Gerät,
  nach geänderten Optionen oder nach dem Start.
- Zeitpunkt des Batterie-Push (seit 0.9.0): `battery_push_mode` sofort oder
  täglich um `battery_push_time` (lokale Zeit, `async_track_time_change`).
  Täglich sammelt `pending` die neu schwachen Geräte (gespeichert mit
  `low`); Inhalt `battery_push_daily` "new" (nur diese) oder "all" (alle
  schwachen, jeden Tag). Einschalten oder neues Ziel nimmt die gerade
  betroffenen einmal mit; beim Wechsel auf sofort kommen die wartenden.
- Pro Gerät (seit 0.9.0, Popup, Variante A in `docs/mockups/notify-v1/`):
  Batterie-Schwelle des Geräts (Vorrang vor Integration und allgemein) oder
  "off" (keine Markierung, kein Push, nicht in der anhaltenden
  Benachrichtigung); Ausfall-/Online-Meldungen aus (`notify_off`), das
  Gerät bleibt überwacht. Sofort gespeichert in
  `.storage/device_panel.devices`. Seit 0.10.0 (Variante A in
  `docs/mockups/override-v1/`): Symbole je Art beim Namen (Liste und
  Karten), Chip "Eigene Einstellung" als Filter, in den Einstellungen je Art
  eine Liste der Geräte mit eigenem Wert, einzeln oder alle zurücksetzen
  (mit "Speichern"). Der Typ von Hand zählt nicht dazu; die Verbindungsart
  von Hand seit 0.17.0 schon (Nutzer, 2026-10-02: "dann könnte man auch
  einfach bereinigen"), zurückzusetzen im Abschnitt "Verbindungsart", danach
  gilt wieder Integration bzw. Erkennung. Gelöschte Geräte
  behalten ihren Eintrag (HA stellt ein wieder hinzugefügtes Gerät mit
  derselben ID her).
- Ausfall und Rückkehr (seit 0.9.0, `outage.py`): Das Protokoll meldet
  Wechsel an Listener; Ausfall sofort bei Erkennung (nach `offline_after`)
  mit Bereich, Integration und Beginn, Rückkehr mit Dauer, gleicher `tag`
  pro Gerät (die Rückkehr ersetzt die Ausfall-Meldung). Ab
  `NOTIFY_GROUP_MIN` (3) im selben Durchlauf eine Sammelmeldung mit
  vermuteter Ursache (gemeinsame Integration), abschaltbar. Gemeldete
  Ausfälle in `.storage/device_panel.notify`: kein erneuter Ausfall nach
  einem Neustart, die Rückkehr kommt trotzdem. Standard: alles aus ausser
  Sammelausfall.
- Ausfall-Meldungen nach Bild 5 (seit 0.20.0):
  - "Erst melden nach" (`notify_delay`, 0–60 Min.): fällig, wenn
    Beginn + Wartezeit erreicht ist; Beginn ist der Beginn des Ausfalls im
    Protokoll, nicht die Erkennung. `async_call_later` auf den nächsten
    Termin, damit die Meldung ohne Zustandswechsel kommt. Kurze Ausfälle:
    weder Ausfall noch "wieder online" (Rückkehr nur, wenn der Ausfall
    gemeldet war). Stand `{"offline": {Gerät: Beginn}, "notified": [...]}`
    in `.storage/device_panel.notify`: ein noch nicht gemeldeter Ausfall
    übersteht den Neustart und wird zum Termin gemeldet. Eine Datei aus
    0.19.0 ohne "notified" gilt als ganz gemeldet (kein Nachmelden).
  - Inhalt (`notify_fields`): Bereich, Integration, Verbindungsart, offline
    seit, Empfang zuletzt, Batterie, Hersteller / Modell; immer in dieser
    Reihenfolge (nicht in der Reihenfolge des Antippens), Werte aus
    `devices.async_device_facts` (wirksame Verbindungsart wie in der
    Liste: von Hand, Integration, Erkennung). Fehlt ein Wert, fällt er weg.
    Die Vorschau im Panel nimmt ein ausgefallenes Gerät aus der Liste.
  - Aktionen: "Öffnen" (`URI`, Gerät im Panel) und "24 Std. stumm"
    (`DEVICE_PANEL_MUTE_<Gerät>`, Ereignis
    `mobile_app_notification_action`): stumm bis jetzt + `MUTE_HOURS`,
    gespeichert in `.storage/device_panel.devices` ("notify_mute",
    abgelaufene fallen beim Schreiben weg). Das Popup zeigt "Stumm bis …"
    als eigene Option; "Globale Einstellung" oder "Aus" hebt es auf.
  - Pro Integration (Spalten in "Integrationen"): `notify_exclude_integrations`
    (kein Push, Sammelmeldung zählt sie nicht), `persistent_exclude_integrations`
    (nicht in der anhaltenden Benachrichtigung). Nach der primären
    Integration wie Batterie und Verbindungsart.
  - Anhaltende Benachrichtigung bei Ausfällen (`outage_persistent`, ID
    `device_panel_outage`): alle ausgefallenen Geräte mit Link
    `/device-panel?device=<id>`, ohne Geräte mit Meldungen aus und ohne
    ausgeschlossene Integrationen, unabhängig von "Erst melden nach" und
    stumm. Verschwindet, wenn keines mehr ausgefallen ist; weggeklickt erst
    wieder bei einem neuen Ausfall (wie die Batterie).

- Bild: `push/icon.png` (das gewählte Icon mit Rand, 512 × 512, Quelle
  `docs/brand/push.svg`) wird beim Setup als statischer Pfad ohne Anmeldung
  unter `/device_panel/push/icon.png` ausgeliefert, sonst kann die
  Companion-App es nicht laden. Bis 0.14.0 war es `brand/icon.png`; iOS
  schneidet das Bild in ein abgerundetes Quadrat, das knapp zugeschnittene
  Brand-Icon verlor die Ecken (Nutzer, 2026-10-02). `hass.data[DATA_PUSH_IMAGE]` hält
  die URL, oder None, wenn das Bereitstellen scheiterte (dann ohne Bild).

Für den Versand zu übernehmen:

- Zusatzdaten (`notification_data`): `icon_url` = Bild (Android; iOS zeigt es
  in neueren Versionen als Absender-Bild, beschnitten), `url` (iOS) und `clickAction` (Android) = Klickziel, z. B. Deep-Link
  in die Geräteansicht, `tag` = welche Meldungen sich ersetzen, optional
  `actions`.
- Versand (`_async_push`): `notify.<dienst>`; lehnt ein Ziel die
  Zusatzdaten ab (Telegram, E-Mail), einmal ohne `data` wiederholen.
  notify-Entitäten über `notify.send_message` (nur Titel und Text).
- Texte in Deutsch und Englisch nach `hass.config.language`.
- Schritt 7 umgesetzt: 0.9.0 (Ausfall sofort, "Wieder online melden",
  Sammelausfall, aus pro Gerät) und 0.20.0 (Bild 5, siehe oben).

## Mögliche Erweiterungen (später)

- Binary-Sensor "Geräte ausgefallen" und Sensor "Anzahl ausgefallen" für
  Automationen.
- Hinweis auf verfügbare Firmware-Updates (update-Entitäten).
- Export (CSV) des Inventars.

## Offene Entscheide für den Start

1. ~~Definition "ausgefallen" und Standard-Schwelle~~: entschieden (siehe
   oben, 2 Min.).
2. ~~Ausgeblendete Geräte~~: entschieden (Dienst-Geräte, deaktivierte
   Geräte, Geräte ohne Entitäten).
3. ~~Recorder-Nachfüllen beim ersten Start~~: ja (Nutzer, 2026-10-02),
   umgesetzt in 0.18.0.
4. ~~Domain/Name~~: `device_panel` / "Device Panel" (HACS-Repo
   `ha-device-panel`).
