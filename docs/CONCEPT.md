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

1. **Geräteliste** mit sinnvollen Spalten: Gerät, Status mit Offline-Dauer,
   Verbindungsart, Empfang, Integration, Hersteller/Modell, Software (mit
   Update-Hinweis), Batterie, Verfügbarkeit 24 Std. Ausgefallene Geräte
   sehr klar erkennbar und zuoberst; oben sofort die Statistik: wie viele
   ausgefallen und seit wann.
2. **Spalten und Ansicht pro Benutzer:** Spalten ein-/ausblenden und
   verschieben, Sortierung und Filter gespeichert, getrennt für Desktop und
   Handy (siehe "Pflicht", Abschnitt 3).
3. **Einstellungsmenü im Panel**, das alle Optionen der Integration abbildet
   (siehe "Pflicht", Abschnitt 1). Darin pro Integration: anzeigen, Push,
   anhaltende Benachrichtigung.
4. **Update-Bereich wie unifi_dynamic:** Version, "Nach Updates suchen",
   "Aktualisieren" über die HACS-Update-Entität, Vorabversionen,
   "In HACS freischalten" (Entität "Pre-release" aktivieren, etwa 30 s auf
   HACS warten, einschalten). Ohne HACS: Hinweis mit Link (wie
   unifi_dynamic; eigenes Installieren ohne HACS ist offen, siehe unten).
5. **Geräteansicht** beim Antippen: Verfügbarkeit mit Zeitstrahl und
   Unterbrüchen, Verbindung und Empfang, Gerätedaten, Entitäten, Platz für
   Einstellungen und Statistiken pro Gerät.
6. **Verfügbarkeitsprotokoll:** Unterbrüche, 24 Std. / 7 / 30 Tage,
   "instabil" bei vielen Unterbrüchen (siehe "Verfügbarkeitsprotokoll").
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

## Wann gilt ein Gerät als ausgefallen? (zu entscheiden)

Vorschlag:

- Gerät **offline**, wenn alle seine aktivierten Entitäten `unavailable`
  sind (Ausnahmen: deaktivierte, versteckte, `diagnostic`-Entitäten zählen
  nicht als Lebenszeichen, wenn es andere gibt).
- Hat das Gerät eine Konnektivitäts-Entität (`binary_sensor` mit
  `device_class: connectivity`), gilt deren Zustand vorrangig.
- Kurze Aussetzer unter einer Schwelle (z. B. 60 s, einstellbar) zählen
  nicht als Unterbruch; HA-Neustarts zählen nie (Lehre aus unifi_dynamic:
  "keine Daten" ist nicht "offline").
- Geräte ohne Entitäten oder reine Dienst-Geräte (`entry_type: service`)
  standardmässig ausgeblendet.

## Verfügbarkeitsprotokoll

- Eigene Datei pro Instanz (`.storage/device_panel_availability`), nicht der
  Recorder: Wechsel `[zeit, zustand]` pro Gerät, 31 Tage.
- Zustand 1 = online, 0 = offline, None = keine Daten (HA lief nicht).
- Beim Start: Lücke seit dem letzten Lauf als "keine Daten" markieren.
- Optional einmaliges Nachfüllen aus dem Recorder (History) für die ersten
  Tage nach der Installation.
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
- Alles gilt erst mit "Speichern", "Abbrechen" verwirft. Dieselben Options wie
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

## Push-Meldungen (vorbereitet)

Wie in unifi_dynamic (`docs/reference/notification.py`). Bereits umgesetzt:

- Bild: `brand/icon.png` (das gewählte Icon) wird beim Setup als statischer
  Pfad ohne Anmeldung unter `/device_panel/icon.png` ausgeliefert, sonst
  kann die Companion-App es nicht laden. `hass.data[DATA_PUSH_IMAGE]` hält
  die URL, oder None, wenn das Bereitstellen scheiterte (dann ohne Bild).

Für den Versand zu übernehmen:

- Zusatzdaten (`notification_data`): `icon_url` = Bild (nur Android zeigt es
  an), `url` (iOS) und `clickAction` (Android) = Klickziel, z. B. Deep-Link
  in die Geräteansicht, `tag` = welche Meldungen sich ersetzen, optional
  `actions`.
- Versand (`_async_push`): `notify.<dienst>`; lehnt ein Ziel die
  Zusatzdaten ab (Telegram, E-Mail), einmal ohne `data` wiederholen.
  notify-Entitäten über `notify.send_message` (nur Titel und Text).
- Texte in Deutsch und Englisch nach `hass.config.language`.
- Ziel und Auslöser in den Einstellungen (siehe "Pflicht", Abschnitt 1).

## Mögliche Erweiterungen (später)

- Push-Benachrichtigung bei Ausfall, mit Aktionen (siehe "Push-Meldungen").
- Binary-Sensor "Geräte ausgefallen" und Sensor "Anzahl ausgefallen" für
  Automationen.
- Hinweis auf verfügbare Firmware-Updates (update-Entitäten).
- Export (CSV) des Inventars.

## Offene Entscheide für den Start

1. Definition "ausgefallen" (siehe oben) und Standard-Schwelle.
2. Welche Geräte standardmässig ausgeblendet werden.
3. Recorder-Nachfüllen beim ersten Start: ja/nein.
4. Domain/Name: `device_panel` / "Device Panel" (HACS-Repo
   `ha-device-panel`).
