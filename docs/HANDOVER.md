# Übergabe: Stand und nächste Schritte

Einstieg für jede neue Claude-Code-Session. Zuerst diese Datei lesen, dann
`CLAUDE.md`, `docs/CONCEPT.md`, `docs/LEARNINGS.md`, `docs/DESIGN.md`.

## Stand (1.12.2, Einstellungen in fünf Abschnitten)

- Repository `Diegofuego871/ha-device-panel`, nur Branch `main` (siehe
  `CLAUDE.md`, "Git und Releases").
- Integration `device_panel` (Config-Flow, eine Instanz), iframe-Panel in
  der Seitenleiste. WebSocket: `device_panel/list_devices` (Daten aus
  `devices.py`: Status nach dem Standard der Überwachung, Verbindungsart,
  Empfang, Hub, Batterie, Update, Typ, Integration mit Eintrag,
  Verfügbarkeit 24 Std., Puls, Sammelausfälle mit Geräte-IDs), `device_panel/device`
  (Popup), `device_panel/availability` (Statistik-Fenster),
  `device_panel/set_device_type` (Typ von Hand im Popup),
  `device_panel/set_device_connection` (Verbindungsart von Hand, seit
  0.12.0; `list_devices` liefert `connection`, `connection_auto`,
  `connection_integration`, `connection_manual`) und
  `device_panel/set_device_settings` (Popup "Meldungen für dieses Gerät":
  Batterie-Schwelle des Geräts oder "off", Ausfall-/Online-Meldungen aus),
  beides in `.storage/device_panel.devices`, und
  `device_panel/reset_device_settings` (Einstellungen, beim Speichern: Liste
  von Geräten je Art auf den globalen Wert, Arten `battery`, `notify`,
  `connection`; `get_options` liefert dafür `overrides`, auch ausgeblendete
  Geräte). Seit 0.23.0 `device_panel/hide_device` (Knopf "Gerät ausblenden" im
  Popup, Option `exclude_devices`, gilt für alle Benutzer) und in
  `list_devices` die Bereiche und Etagen in der Reihenfolge der Registries
  (`areas`, `floors`, je Gerät `area_id`) für den Filter "Bereich". Seit
  0.24.0 `device_panel/signal_history` (Fenster "Empfang", 24 Std./7/30
  Tage): Empfang von einem Sensor aus dem Recorder, für ZHA und Bluetooth
  aus der eigenen Aufzeichnung `signal_history.SignalLog`
  (`.storage/device_panel.signal`, jede Minute für überwachte Geräte, die
  online sind; 5-Min.-Blöcke 24 Std., Stunden 31 Tage; Quelle bestimmt
  `devices.signal_source`).
- Einstellungen im Panel (Zahnrad), Reihenfolge nach Bild 5:
  Versionskasten mit Update über HACS, Vorabversionen, "In HACS
  freischalten"; seit 0.34.0 zuerst "Überwachung und Meldungen"
  (`docs/mockups/notify-v3/`, Entscheid des Nutzers: Variante C, eigener
  Reiter "Integrationen", Batterie-Push pro Integration, Batterie-Inhalt
  anpassbar) mit vier Reitern (`st.tab`, Optionen je Reiter in
  `MON_TAB_KEYS`): "Übersicht" (Zeitstrahl je Meldung, Chips
  `data-set="chip"`, Abweichungen, `notify_service`,
  `notify_click_target`), "Ausfall" (Zeitstrahl mit `offline_after` und
  `notify_delay`, dann `flaky_outages`, `startup_grace`, `notify_outage`,
  `notify_online`, `notify_group`, `outage_persistent`, `notify_fields` mit
  Vorschau, Geräte-Ausnahmen `offline` und `notify`), "Batterie"
  (`battery_low` im Zeitstrahl, `battery_push`, `battery_push_mode`,
  `battery_push_time`, `battery_push_daily`, `battery_persistent`,
  `battery_fields` mit Vorschau, Ausnahmen `battery`), "Integrationen"
  (Liste mit Abweichungen, Filter, Detail `st.integ` je Integration:
  Überwachen = `offline_after_integrations` ≠ "off", Ausgefallen nach,
  `notify_exclude_integrations`, `persistent_exclude_integrations`,
  `battery_low_integrations`, `battery_push_exclude_integrations`, ihre
  Geräte mit eigener Einstellung, "Alles auf Standard"). "Erst melden nach"
  nie kürzer als "Ausgefallen nach" (`options_api.delay_too_short`, Fehler
  `notify_delay_short` im Optionsdialog, Fehler an beiden Feldern im
  Panel; gespeicherte kürzere Werte und 0 gelten als "Ausgefallen nach",
  `values_from`). Batterie-Push in `battery.py` (`_pushable`,
  `_async_parts`); `list_devices.battery_default` mit `push` und
  `push_integration`; `get_options.overrides` je Gerät mit `domain`.
  Bis 0.33.1 standen diese Optionen in "Ausfall-Erkennung", "Batterie",
  "Integrationen" (Spalten), "Push-Benachrichtigung" und "Anhaltende
  Benachrichtigung". Seit 1.0.0 (Nutzer, 2026-10-04, Mockups
  `docs/mockups/content-v1/`, A) fünf Abschnitte statt acht, in dieser
  Reihenfolge: "Geräte im Panel" (`devices`; `show_service_devices`,
  `show_disabled_devices`: deaktivierte Geräte in eigener Gruppe, nicht
  überwacht; Reiter "Integrationen" mit `exclude_integrations` und
  Verweis `data-set="goto"`, "Typen" mit `exclude_types`, "Geräte" mit
  `exclude_devices`, seit 0.23.0: einzeln ausgeblendete Geräte, wie
  ausgeschlossene Integrationen nicht überwacht; `get_options` liefert sie
  im Katalog als `hidden_devices`, gelöschte fehlen, ihre ID bleibt
  gespeichert; Zähler am Reiter und Zusammenfassung zählen die
  ausgeblendeten), "Überwachung und Meldungen" (`monitor`), "Darstellung"
  (`look`; Reiter "Verbindungsart" mit `connection_integrations` und den
  Ausnahmen, "Filter-Chips" mit `hide_connections`: Chips der
  Verbindungsart, die nicht erscheinen, gilt für alle, seit 0.11.0, und
  `connection_order`: Reihenfolge dieser Chips, leer = nach Anzahl, nicht
  genannte folgen nach Anzahl, seit 0.13.0), "KI-Einschätzung", "Updates"
  (tägliche Prüfung mit Meldung unter "Reparaturen"). Die Reiter dieser
  zwei Abschnitte sind `SUB_TAB_KEYS` und `st.sub` im Panel (Klasse
  `sub-tab`, Aktion `subtab`); die Reiter der Überwachung bleiben
  `MON_TAB_KEYS`. Optionen und Optionsdialog haben sich nicht geändert. Backend `update_check.py`,
  `options_api.py` (`effective(hass)` liefert die wirksamen Werte),
  Optionsdialog in `config_flow.py` mit denselben Feldern in derselben
  Reihenfolge; WebSocket `device_panel/version`, `set_panel`, `get_options`
  (mit Katalog aller Integrationen und Typen sowie `limits`),
  `set_options`. Welche Geräte gezeigt werden, entscheidet nur das Backend
  (`devices.listed_devices`, Protokoll `monitored_devices`).
- Verfügbarkeitsprotokoll (`availability.py`, `.storage/device_panel.availability`,
  31 Tage), siehe `docs/CONCEPT.md`, "Verfügbarkeitsprotokoll". Seit 0.18.0
  einmal aus dem Recorder nachgefüllt (`backfill.py`, Merker `backfilled`;
  `recorder` in `after_dependencies`).
- Panel in Design C: Kopf mit Ring (Ø 24 Std.), Ausfall-Tafel und
  Ausfall-Puls; Chips nach Verbindungsart, "Nur Probleme" und Hinweisen;
  Gruppen ausgefallen, instabil, keine Daten, online; erste Spalte fixiert;
  Handy als Karten. Jede Zeile öffnet ein Popup wie unifi_dynamic, die
  Statistik-Kacheln ein zweites Fenster. Matter-Funkart holt das Panel
  selbst über `matter/node_diagnostics`.
- Geprüft im echten HA 2026.2.3 mit der Demo-Integration (Anleitung siehe
  `docs/LEARNINGS.md`, "Prüfung im echten Home Assistant").
- Icon und Logo: Variante "D mit Puls" (vom Nutzer gewählt). PNGs in
  `custom_components/device_panel/brand/` (Masse wie unifi_dynamic), Quellen
  in `docs/brand/` (siehe `docs/DESIGN.md`, Abschnitt "Icon und Logo").
- Push-Meldungen: Batterie (sofort oder täglich), Ausfall, wieder online,
  Sammelausfall; `push/` (Bild mit Rand) wird ohne Anmeldung unter
  `/device_panel/push/` ausgeliefert (`hass.data[DATA_PUSH_IMAGE]` für `icon_url`). Siehe
  `docs/CONCEPT.md`, Abschnitt "Push-Meldungen".
- CI: Python-Tests, Panel-Tests (DE/EN), Hassfest und HACS-Prüfung grün
  (Beschreibung und Topics sind gesetzt).
- Releases legt der Nutzer an; Claude liefert die Release-Angaben (siehe
  `CLAUDE.md`, "Git und Releases").
- `v0.1.0b1` (Vorabversion) zeigt versehentlich auf `8944f3b`, den Stand vor
  Icon und Sprachtests (Manifest 0.1.0). Der Tag bleibt (veröffentlichte Tags
  nie ändern); `0.1.0b2` ersetzt ihn. `0.1.0` (Commit `ea170ca`) wurde auf
  Wunsch des Nutzers nicht veröffentlicht; die erste stabile Version kommt
  mit `0.2.0`. Geändert (Nutzer, 2026-10-01): Die erste stabile Version ist
  `0.4.0`. `0.4.0b1` hatte keinen Tag und wurde direkt zu `0.4.0`. Grund: Ohne
  stabiles Release und ohne eingeschalteten Schalter "Pre-release" bietet HACS
  den neuesten Commit von `main` als Update an (bei jedem Push neu).

## Nächste Schritte (Reihenfolge)

1. Entschieden (Nutzer, 2026-10-01): Design Variante C mit allen Ideen
   (`docs/mockups/panel-v1/`, Bilder 5–8), Überwachung mit vier Ebenen
   (Bild 9, `docs/CONCEPT.md`, "Überwachung einstellen"), ohne HACS nur
   Hinweis wie unifi_dynamic. Offen: Recorder-Nachfüllen (mit Schritt 6).
2. Fahrplan-Schritte 1, 4, 5 und 6 erledigt (`0.2.0b1` bis `0.4.0`),
   Schritt 3 als Grundgerüst. Ausschlüsse nach Integration und Gerätetyp
   mit `0.5.0` erledigt (Nutzer, 2026-10-01: ein Typ pro Gerät, vier neue
   Typen, Typ im Popup änderbar). Ausfall-Erkennung und Anzeige mit `0.6.0`.
   Batterie-Warnung (Wunsch des Nutzers, 2026-10-01: Schwelle wählbar,
   Push und anhaltende Benachrichtigung getrennt wählbar) mit `0.7.0`,
   dabei die Push-Grundlage (Ziel, Klickziel, Versand, Deep-Link
   `?device=`). Schwelle pro Integration (Nutzer, 2026-10-01: Variante A)
   mit `0.8.0`. Releases: `0.6.0` und `0.7.0` ohne Release, in `0.8.0`
   enthalten. Mit `0.9.0` (Nutzer, 2026-10-02): Batterie pro Gerät im Popup
   (Variante A, `docs/mockups/notify-v1/`), Batterie-Push sofort oder
   täglich mit Uhrzeit und wählbarem Inhalt, Push bei Ausfall (sofort) und
   "wieder online", Sammelausfall, Meldungen pro Gerät aus; aufgeklappter
   Abschnitt der Einstellungen abgesetzt. `0.9.1` (Nutzer, 2026-10-02):
   "globaler Wert" statt "wie eingestellt", überall; Auswahl ging auf iOS
   nach der Wahl sofort wieder auf (Fokus nach Neuaufbau). Mit `0.10.0`
   (Nutzer, 2026-10-02, `docs/mockups/override-v1/`, Liste A, Einstellungen
   A, Typ von Hand zählt nicht): Symbole je Art beim Namen, Chip "Eigene
   Einstellung", Zurücksetzen einzeln oder alle in "Batterie" und
   "Push-Benachrichtigung". Mit `0.11.0` (Nutzer, 2026-10-02,
   `docs/mockups/view-v2/`, Variante C): Filter-Chips der Verbindungsart
   global ausblendbar (Einstellungen, "Anzeige"). `0.9.1` und `0.10.0` ohne
   Release, in `0.11.0` enthalten. Mit `0.12.0` (Nutzer, 2026-10-02):
   Verbindungsart im Popup wählbar wie der Typ, gespeichert in
   `.storage/device_panel.devices` ("connections"); zählt nicht als "Eigene
   Einstellung" (wie der Typ von Hand). Mit `0.13.0` (Nutzer, 2026-10-02):
   Reihenfolge der Chips der Verbindungsart per Ziehen in "Anzeige";
   `0.12.0` ohne Release, in `0.13.0` enthalten. Dazu in `0.13.0` behoben
   (Nutzer: "essentiell"): Ausfalldauer über Neustarts von HA aus dem
   Protokoll statt aus `last_changed`, Ausfall über Lücken zählt einmal,
   kein falsches "online" mehr in den ersten Minuten nach dem Start (siehe
   `docs/CONCEPT.md`, "Verfügbarkeitsprotokoll", "Ausfall über Lücken").
   Mit `0.14.0` (Nutzer, 2026-10-02): Batterie-Warnung für eine ganze
   Integration aus (`battery_low_integrations` mit Wert `"off"`,
   Reihenfolge Gerät → Integration → global), Darstellung Variante B aus
   `docs/mockups/battery-v2/` (Auswahl je Zeile wie im Geräte-Popup);
   Entfernen der Integration löscht ihre Dateien (`async_remove_entry`).
   `0.13.0` ohne Release, in `0.14.0` enthalten. Mit `0.15.0` (Nutzer,
   2026-10-02): Einstellungen bleiben nach "Speichern" offen. `0.12.0` bis
   `0.14.0` ohne Release, in `0.15.0` enthalten (`v0.15.0` veröffentlicht).
   Mit `0.16.0` (Nutzer, 2026-10-02, Variante B): Verbindungsart pro
   Integration (`connection_integrations`), neuer Abschnitt "Verbindungsart";
   Vorrang Gerät von Hand, dann Integration, dann Erkennung. Mit `0.17.0`
   (Nutzer, 2026-10-02): Verbindungsart von Hand zählt als "Eigene
   Einstellung" (Symbol, Chip, Zurücksetzen); Chip-Zahlen mit Suche und
   übrigen Filtern, aktiver Chip abwählbar, X im Suchfeld, Chip "Batterie",
   Kopf-Kacheln auf dem Handy gleich hoch, Prozent erst ab 1 Std. Daten
   (Entscheid Claude, vom Nutzer übertragen). Mit `0.18.0`: Nachfüllen des
   Protokolls aus dem Recorder. Mit `0.19.0` (Nutzer, 2026-10-02, Desktop
   nach Bild 6, Handy A in `docs/mockups/view-v1/`): Spalten, Sortierung,
   Gruppen oder Liste und Filter-Chips pro Benutzer, getrennt
   Desktop/Handy (Fahrplan Schritt 2). `0.19.0` bis `0.21.0` ohne
   Release, in `0.22.0` enthalten. Mit `0.20.0` (Bild 5): Spalten "Push"
   und "Anhaltend" bei
   den Integrationen, "Erst melden nach", Inhalt der Meldung mit Vorschau,
   Aktionen "Öffnen" und "24 Std. stumm", anhaltende Benachrichtigung bei
   Ausfällen; behoben: eine Abfrage, die vor einer eigenen Änderung begann,
   überschrieb sie (Fehlerbericht des Nutzers: Thread von Hand zeigte
   wieder Matter; `_fetch(true)` verwirft den alten Stand) und die Liste
   im Statistik-Fenster zeigte einen Ausfall über Neustarts als mehrere
   Einträge (jetzt `outages` aus `bridged`). `v0.22.0` veröffentlicht.
   Mit `0.23.0` (Nutzer, 2026-10-03): einzelne Geräte ausblenden (Variante
   A, `docs/mockups/hide-v1/`; ausgeblendet = ganz weg, nicht überwacht,
   keine Meldungen) und Filter "Bereich" (Variante A,
   `docs/mockups/area-v1/`; Nutzer: einen Bereich auswählen, nicht
   sortieren, und mit den Chips weiter filtern; Design Claude überlassen).
   Kopf bleibt beim Filter für das ganze Haus (Annahme, dem Nutzer
   genannt). `v0.23.0` veröffentlicht. Mit `0.24.0` (Nutzer, 2026-10-03):
   Batteriesymbol mit Füllung in vier Farben (Skala Claude überlassen:
   Stufen wie der Empfang, rot = schwach nach der Batterie-Warnung) und
   Empfangsverlauf per Tipp auf die Kachel "Empfang" (Rahmen wie
   "Batterie", ohne eigenes Mockup). `0.24.0` ohne Release, in `0.25.0`
   enthalten. Mit `0.25.0` (Nutzer, 2026-10-03): Chip "Alle" hebt alle
   Filter auf (Bereich, Verbindungsart, "Nur Probleme", Hinweise; Suche
   bleibt). `v0.25.0` veröffentlicht. Entscheide des Nutzers
   (2026-10-03, Fragen einzeln mit Bildern), umgesetzt mit `0.26.0`:
   Puls-Fenster Variante A (`docs/mockups/pulse-v1/`), Spalten-Dialog
   "Anpassen" Variante A (`docs/mockups/customize-v1/`; das Blatt
   "Ansicht" auf dem Handy mit denselben Augen und Knöpfen), Fenster
   "Empfang" bleibt so, Kopf (Verfügbarkeit, "Gerade ausgefallen", Puls,
   Sammelausfälle) folgt dem Bereichsfilter (nicht mehr das ganze Haus;
   `incidents[].devices` neu im Ergebnis). `v0.26.0` veröffentlicht.
   Mit `0.27.0` (Fehlerbericht des Nutzers, 2026-10-03: "Empfangsverlauf
   füllt sich nicht", Bild mit nur einem Punkt "jetzt" bei einem Sensor
   aus dem Recorder): Ursache beim Nutzer nicht sicher bestimmbar; beide
   möglichen Fälle abgedeckt. Wert lange unverändert (Recorder ohne Zeile
   im Zeitraum): Linie ab `last_changed` des Zustands
   (`battery_history.held`, auch für den Batterie-Verlauf). Sensor im
   Recorder ausgeschlossen (`signal_history.recorded`): eigene Aufzeichnung
   wie ZHA/Bluetooth, im Test-HA mit `recorder: exclude` geprüft. Knopf
   "Gerät ausblenden" (Wunsch des Nutzers). Offen: Rückmeldung des
   Nutzers, ob sich der Verlauf jetzt füllt (Sensor und ZHA/Bluetooth).
   `0.29.1` hat keinen Tag (im CHANGELOG "Nicht veröffentlicht", in 0.30.0
   enthalten).
   Erledigt mit `0.30.0`: Punkt 5 Variante B. Option
   `offline_after_integrations` ({Domain: Minuten 1–1440 oder "off"},
   `options_api.offline_map`, `offline_after_for(opts, domain)` in
   Sekunden oder None), Spalte "Ausgefallen nach" in der Tabelle
   "Integrationen" (Auswahl Standard/1/2/5/10/15/30 Min./1/2/6/12/24
   Std./Nicht überwachen), Optionsdialog als ObjectSelector. "off":
   `devices.monitored_devices` lässt die Integration weg (Protokoll,
   Batterie, Empfang, Meldungen), `listed_devices` behält sie;
   `list_devices` liefert je Gerät `unmonitored`, `offline_after` (Minuten
   oder None) und `online` None; Puls und Sammelausfälle zählen sie nicht.
   Panel: Gruppe und Status "Nicht überwacht", nicht im Kopf. Das
   Nachfüllen aus dem Recorder (`backfill.async_backfill`) nimmt
   `offline_after` je Gerät (Dict Gerät → Sekunden).
   Erledigt mit `0.31.0`: Punkt 7 Variante A. Einstellung "Ausgefallen
   nach" pro Gerät in `.storage/device_panel.devices` (`offline`: Minuten
   1–1440 oder "off"; `devices.device_offline_after` = Gerät vor Integration
   vor global, None = nicht überwacht; `valid_offline_setting`),
   WebSocket `set_device_settings` (`offline`), `reset_device_settings`
   (`offline`), `get_options.overrides.offline`; `list_devices` liefert
   `offline_setting`, `offline_default` ({minutes, integration, global}) und
   `notify_default` ({push, persistent, integration}). Popup: unter jeder
   Einstellung ein Etikett (`.opt-origin`, Klassen `std`/`integ`/`own`)
   mit Standardwert, Erklärung im Tooltip; Auswahl "Wie Integration (…)".
   Die Verbindungsart hat ihre Herkunft schon in der Kachel.
   Erledigt mit `0.32.0`: Punkt 4 Variante A. Das Panel liest aus
   `matter/node_diagnostics` (schon für die Funkart) zusätzlich `node_type`
   (Werte des Matter-Servers `end_device`, `sleepy_end_device`,
   `routing_end_device` = Router/Leader, `bridge`, `unknown`; geprüft an
   python-matter-server 8.1.2) und `network_name` (Thread-Netzname bzw.
   WLAN-SSID); Kacheln "Thread-Rolle" (nur Thread, nur bekannte Rollen) und
   "Netz" (Thread und WLAN) im Abschnitt "Verbindung"; Zwischenspeicher
   `_matter` mit `{type, role, network}`. Verbindungsart von Hand hat
   weiter Vorrang. Nicht an einem echten Matter-Gerät geprüft (im Test-HA
   gibt es keinen Matter-Server), nur im Nachbau.
   Erledigt mit `0.33.0`: Punkt 10 Variante A. Modul `ai_assessment.py`:
   `build_facts` (Fakten eines Geräts aus `async_list_devices`, ohne IDs,
   Entitäten, Adressen), `build_instructions` (Englisch, Antwort in der
   Sprache des Panels, erste Zeile = Überschrift), `_generate` (ruft
   `ai_task.async_generate_data`, 90 s Zeitlimit, Fehlercodes `no_ai_task`,
   `timeout`, `failed`; Tests ersetzen es), `async_assess`. WebSocket
   `device_panel/ai_assess` (nur Admin, nur mit Option `ai_assessment`);
   Option `ai_task_entity` (leer = Standard von HA); `get_options.catalog.
   ai_tasks`; `list_devices.ai_assessment`. Panel: Abschnitt
   "KI-Einschätzung" in den Einstellungen, Knopf und Karte im Popup
   (Zustand je Gerät nur im Speicher, `_ai`). Nicht gegen einen echten
   KI-Anbieter geprüft: `tests/test_ai_assessment.py` ruft die echte
   `ai_task`-Komponente mit einer Ersatz-Entität auf (dafür zuerst
   `homeassistant` einrichten), im Test-HA nur der Fehlerpfad.
   `0.33.1` (Rückfrage des Nutzers): Texte "Inhalt der Ausfall-Meldung"
   und Batterie-Warnung getrennt erklärt; Puls-Kachel stabil.
   Erledigt mit `0.34.0` (Nutzer, 2026-10-04, Mockups `notify-v2/` und
   `notify-v3/`; Wunsch: Push, Ausfall und Batterie an einem Ort, damit
   sofort klar ist, wann welche Meldung kommt): Abschnitt "Überwachung und
   Meldungen" (Variante C ausgebaut, Integrationen als eigener Reiter mit
   Detail), "Integrationen" nur noch "Anzeigen", Batterie-Push pro
   Integration, Inhalt der Batterie-Meldung wählbar, "Erst melden nach"
   nicht kürzer als "Ausgefallen nach" (0 entfällt, Speichern gesperrt,
   alte Werte gelten als "Ausgefallen nach"). Der Nutzer hat weitere
   Punkte angekündigt. `0.34.1` (Wunsch des Nutzers): Puls abschnittweise
   gefärbt, rot über 0, grün nur auf 0 (0.34.0 färbte die ganze Kurve grün,
   sobald gerade niemand fehlte); ohne Release, in `1.0.0` enthalten.
   `1.0.0` (Nutzer, 2026-10-04, `docs/mockups/content-v1/`, A): "Geräte im
   Panel" und "Darstellung" ersetzen "Integrationen", "Gerätetypen",
   "Verbindungsart", "Anzeige" und "Ausgeblendete Geräte" (verworfen: B
   nur Ausnahmen mit Auswahl "Ausblenden …"). `1.1.0` (Wunsch des Nutzers):
   Knopf "Alle zurücksetzen" im Reiter "Integrationen" (Aktion
   `integ-reset-all`, setzt die fünf Optionen pro Integration im Entwurf
   leer; Geräte mit eigener Einstellung bleiben). Die Liste der
   Filter-Chips (`_connCatalog`) zeigt alle Arten aus `CONN`, auch ohne
   Geräte (Wunsch des Nutzers). `1.1.0` blieb ohne Release, in `1.2.0`
   enthalten. `1.2.0` (Nutzer, 2026-10-04, `docs/mockups/ai-v1/`, A):
   Profi-Modus der KI-Einschätzung: Option `ai_prompt` (leer = Standard),
   Vorlage mit `{language}` und `{facts}` in `ai_prompt.py`
   (`DEFAULT_PROMPT`, `prompt_problem`, `render_prompt`), WebSocket
   `device_panel/ai_prompt_preview` (nur Admin, schickt nichts an die KI),
   `get_options.ai_prompt_default`; Panel: Fenster `dialog.prompt-dlg`
   (`_openPrompt`, `_renderPrompt`, `_promptPreview`). Der Optionsdialog von
   HA hat dafür kein Feld. `1.2.0` blieb ohne Release, in `1.3.0` enthalten.
   `1.3.0` (Nutzer, 2026-10-04): die Fakten der KI listen die anderen
   ausgefallenen Geräte der Integration (`same_integration_offline_devices`,
   Name, Bereich, Minuten, längste zuerst, höchstens `SAME_OFFLINE_MAX` = 10);
   die Hinweise `aiNote` und `optAiInfo` nennen es. `1.4.0` (Nutzer,
   2026-10-04): neuer `DEFAULT_PROMPT` (vom Nutzer im Profi-Modus getestet,
   Regeln, Bedeutung der Fakten, Reihenfolge der Ursachen, Antwort mit
   Prüfschritten und Sicherheit); Fakten `signal.weak` (`signal_weak`,
   Schwellen `SIGNAL_WEAK_DBM`/`SIGNAL_WEAK_LQI` wie `sigLevel` im Panel,
   mit `own_threshold`), `battery_powered`, `same_area_other_devices` und
   `same_area_offline_devices` (alle Integrationen, ohne deaktivierte und
   nicht überwachte).
   Batterie-Prognose (`1.5.0`, Nutzer, 2026-10-04, ohne KI):
   `battery_history.forecast()` rechnet immer aus höchstens 365 Tagen seit
   dem letzten Wechsel (Tagesmittel, kleinste Quadrate, Spanne aus dem
   Standardfehler der Steigung) bis zur Warnschwelle des Geräts
   (`device_battery_threshold`; ohne Warnung bis 0 %), unabhängig vom
   Zeitraum-Reiter; `async_battery_history` liefert das Feld `forecast`.
   Zustände `none`/`short`/`flat`/`reached`/`ok`; Panel `_batForecastHtml`,
   Strings `batFc*`, Simulator `__batForecast` und `batForecast()`.
   KI-Fakten `1.6.0` (Nutzer, 2026-10-04; "Funkstandard" = Verbindungsart):
   `same_area_devices` (ersetzt `same_area_offline_devices`; `_peer`,
   `_peer_rank`, höchstens `SAME_AREA_MAX` = 15), `same_area_same_connection`,
   `same_hub_other_devices`/`same_hub_offline_devices` (über `via`, nach
   Name), `same_model_other_devices`, `went_offline_within_5_min_of_this_device`
   (`SAME_TIME_SECONDS` = 300), `last_7d` und `battery_forecast` (beide aus
   `_extras`, async: Protokoll 7 Tage und `async_battery_history` 365d).
   `DEFAULT_PROMPT` (1.6.0: 3638 Zeichen; Grenze `AI_PROMPT_MAX`); die Kopie im
   Simulator (`AI_PROMPT_DEFAULT`) muss nachgeführt werden.
   Gruppen als Variablen `1.7.0` (Nutzer, 2026-10-04): `ai_prompt.FACT_GROUPS`
   (device, history, battery, signal, integration, area, hub, model; jeder Fakt
   genau eine Gruppe, ein Test prüft das), Platzhalter `{facts_<gruppe>}`;
   `prompt_problem`: zuerst unbekannt, dann "no_facts" (weder `{facts}` noch
   Gruppe); `render_prompt` ersetzt in einem Durchgang (Regex), Gruppe ohne
   Fakten = `{}`. Panel: `PROMPT_GROUPS`/`PROMPT_VARS`, `promptVarInfo`,
   `promptVarsHint`; Simulator `promptProblem` nachgeführt.
   Batterie 12 Monate `1.8.0` (Nutzer, 2026-10-04): Fakt
   `battery_last_12_months` (`battery_year()` aus dem Batterie-Verlauf 365d,
   `_extras` liefert `battery_year`; Gruppe `battery`); Standard-Prompt
   (3941 Zeichen) verlangt einen Satz dazu; `AI_PROMPT_MAX` 6000 (Panel
   `PROMPT_MAX`, Simulator nachgeführt).
   Filter "Integration" `1.9.0` (Nutzer, 2026-10-04, "wie Bereich"): Chip
   `chip area integ` (`_integChipHtml`, `data-integ-open`/`data-integ-clear`),
   Ansicht-Feld `integs` (Domains, `AREA_NONE` = ohne Integration);
   Popover und Blatt teilen sich mit dem Bereich (`_pickKind`, `_pickGroups`,
   `_pickPicked`, `_setPick`, Textschlüssel `integ*`); `_scopePass` =
   Bereich und Integration, `_scoped()`, `_scopeText()` für Kopf und Puls-Fenster;
   Zahlen in beiden Auswahlen zählen den jeweils anderen Filter mit.
   Unsichere Prognose `1.10.0` (Nutzer, 2026-10-04): `battery_forecast_fact()`
   liefert `uncertain` und `uncertain_reasons` (Sicherheit nicht "high",
   `accelerating`, unter `FORECAST_DAYS_OK` = 30 Tage Verlauf), `days_range`,
   `days_of_history`; Status "short" wird als Fakt gemeldet. Standard-Prompt
   (4282 Zeichen) verlangt grobe Spanne, nie ein festes Datum, und senkt die
   eigene Sicherheit der KI. Simulator-Kopie nachgeführt.
   Weitere Chips ausblenden `1.11.0` (Nutzer, 2026-10-04, global): Option
   `hide_chips` (`CHIP_KEYS`: area, integration, problems, batteries, battery,
   signal, update, override, new; Validierung `options_api._chips`, feste
   Reihenfolge; auch im HA-Optionsdialog); `list_devices` liefert
   `hide_chips`. Panel: `_hideChips`, `_dropHiddenFilters()` hebt Filter
   ausgeblendeter Chips auf (Probleme, Hinweis, Bereich, Integration),
   Tabelle "Weitere Chips" in Darstellung › Filter-Chips (`CHIP_OTHER`,
   `chipOther`), Trenner nur, wenn "Nur Probleme" oder ein Hinweis erscheint.
   Gruppen/Liste `1.12.0` (Nutzer, 2026-10-04, Variante A): der Schalter
   (`view.flat`) steht nicht mehr in der Chip-Zeile (`_flatSegHtml` entfernt),
   sondern zuoberst im Dialog `cols-dlg` (Desktop) und weiter im Blatt "Ansicht"
   (Handy); `_vseg()` teilen beide; "Standard wiederherstellen" setzt auch `flat`.
   Zurück von der HA-Geräteseite `1.12.2` (Nutzer, 2026-10-05; Pfeil oben links
   landete in der HA-Geräteliste, App und Browser): Ursache im HA-Frontend
   20260930: die Geräteseite hat `back-path="/config/devices/dashboard"`,
   `goBack()` geht nur bei `history.state.from` im Verlauf zurück, sonst
   `navigate(backPath)`. `_navigate()` legt den Eintrag deshalb wie HAs
   navigate() an (`pushState({from: pathname})`). Geprüft in der Testumgebung mit
   beiden Frontends (Wheel `home-assistant-frontend` 20260930.0 über
   `pip download --python-version 3.14` holen, nach `hass_frontend`
   entpacken, HA mit `--skip-pip`). `historyBack=1` aus 1.12.1 wirkte nicht und
   ist wieder entfernt.
   Kachel "Verfügbarkeit" (Rückfrage des Nutzers, 2026-10-04: 98,7 % trotz
   vollem Ring): Variante B gewählt, gross der Anteil jetzt wie der Ring,
   darunter "Ø 24 Std." (verworfen: A wie bisher, C Durchschnitt mit dem
   Gerät, das ihn drückt).
   Offene Backlog-Punkte: 1 Ursache, 2 Gesundheitswert, 3 Funkweg,
   6 Regeln, 8 Entitäten, 9 CSV-Export, 10b KI-Zusammenfassung im
   Puls-Fenster (optional); offen ist auch die Bestätigung des
   Empfangsverlaufs für ZHA.
   Als Nächstes, in dieser Reihenfolge (Nutzer, 2026-10-03):
   b. Erledigt mit `0.26.0`: Puls-Kachel öffnet das Fenster mit den
      Geräten, die in 24 Std. Unterbrüche hatten (`docs/mockups/pulse-v1/`,
      A).
   c. Erledigt mit `0.23.0`: einzelne Geräte ausblenden, Liste der
      ausgeblendeten in den Einstellungen zum Wiedereinblenden
      (`docs/mockups/hide-v1/`, A; nicht überwacht, keine Meldungen).
   d. Erledigt mit `0.26.0`: Spalten-Dialog wie HA "Anpassen" (Auge,
      Ziehgriff, "Standard wiederherstellen", "Fertig";
      `docs/mockups/customize-v1/`, A).
   e. Erledigt mit `0.23.0`: Filter "Bereich" (`docs/mockups/area-v1/`,
      A). Gruppieren und Sortieren nach Bereich (`docs/mockups/area-v2/`)
      nicht weiter verfolgt: Der Nutzer will Bereiche auswählen, nicht
      sortieren (2026-10-03).
   f. Erledigt mit `0.21.0`: Empfang-Warnung pro Gerät (Variante A,
      `docs/mockups/signal-v1/`), gespeichert in
      `.storage/device_panel.devices` "signal", `list_devices` liefert
      `signal_setting`; Bewertung im Panel (`devSigLevel`).
   g. Erledigt mit `0.22.0`: Batterie-Verlauf im Popup (Variante A,
      `docs/mockups/battery-history-v1/`, Achse 0–100 %), WebSocket
      `device_panel/battery_history` in `battery_history.py`.
   h. Erledigt mit `0.21.0`: neue Geräte 3 Tage markiert, Chip "Neu"
      (`list_devices`: `created_at`, `new` nach Serverzeit, aus der
      Geräte-Registry).
   Danach die Backlog-Punkte 5–7: Überwachungsebenen, Geräteansicht
   (Ursache, Funkweg, Empfangsverlauf, Gesundheit), Empfangs- und
   Batterieprotokoll; `docs/CONCEPT.md`, "Pflicht"; Vorlagen in
   `docs/reference/`.
3. Umsetzung nach dem Fahrplan in `docs/CONCEPT.md` (Abschnitt "Fahrplan"),
   der Reihe nach: Geräteliste mit Statistik, Spalten pro Benutzer,
   Einstellungsmenü, Update-Bereich, Geräteansicht, Verfügbarkeitsprotokoll,
   Push-Meldungen, Ideen. Vorlagen liegen in `docs/reference/`.

## Zweisprachigkeit DE/EN (verbindlich)

Alles, was der Nutzer sieht, gibt es auf Deutsch und Englisch. Kein Text
ist fest im Code.

| Bereich | Ort | Regel |
| --- | --- | --- |
| Panel | `panel/strings.js` | `STRINGS.de` und `STRINGS.en` mit identischen Schlüsseln; Sprache aus `hass.locale.language` (`de`/`de-*` → Deutsch, sonst Englisch) |
| HA-Oberfläche (Config-Flow, Optionen, Entitäten, Dienste, Reparaturen) | `strings.json`, `translations/en.json`, `translations/de.json` | `strings.json` identisch mit `en.json`; `de.json` mit denselben Schlüsseln |
| Serverseitige Texte (Push, Reparaturen mit Platzhaltern, Optionslisten) | Python | `hass.config.language`, `de`/`de-*` → Deutsch, sonst Englisch |
| README | `README.md` (EN), `README.de.md` (DE) | gleicher Aufbau, gegenseitig verlinkt, immer beide im selben Commit |
| CHANGELOG | `CHANGELOG.md` (EN), `CHANGELOG.de.md` (DE) | gleicher Aufbau (Keep a Changelog), gegenseitig verlinkt, immer beide im selben Commit |
| Release Notes | Text für den Nutzer | Englisch, aus `CHANGELOG.md` |
| Code-Kommentare | Python, JS | Deutsch |
| Kommunikation mit dem Nutzer | Chat | Deutsch, Schweizer Rechtschreibung (kein Eszett), Anführungszeichen "" |

Absicherung durch Tests (`tests/test_translations.py`): gleiche Schlüssel DE/EN
in `translations/` und `strings.js`, `strings.json` = `en.json`, kein Eszett,
Sprachwahl `pickLang` (`de`/`de-*` → Deutsch, sonst Englisch), gleicher
Aufbau von README und CHANGELOG in beiden Sprachen (Überschriften,
Listenpunkte, Versionen, Link-Fussnoten).
Panel-Tests prüfen die Ansichten in beiden Sprachen: Der HA-Nachbau nimmt die
Sprache aus `?lang=de|en`, die Suiten laufen je Sprache auf Desktop und Handy
und vergleichen die Texte ausgeschrieben (`tests/panel/suites/table-e2e.mjs`,
`popup-e2e.mjs`, `settings-e2e.mjs`; `version-e2e.mjs` nur Deutsch wie in
unifi_dynamic). Der Nachbau rechnet Liste, Popup und Verlauf aus einem
erfundenen Verlauf je Gerät (`HIST` in `sim/ha-sim.html`) und simuliert HACS
(Update-Entität, Schalter "Pre-release", Repository-Befehle).
Neue Suiten genauso aufbauen. Neue Texte immer in beiden Sprachen im selben
Commit.

Begriffe einheitlich halten (Beispiele):

| Deutsch | Englisch |
| --- | --- |
| ausgefallen | offline |
| Verfügbarkeit | availability |
| Unterbruch | outage |
| Softwarestand | software version |
| Einstellungen | Settings |
| Vorabversionen | pre-releases |
| Speichern / Abbrechen | Save / Cancel |

## Arbeitsweise mit dem Nutzer (Kurzfassung)

- Vor UI-Änderungen Mockups (erfundene Daten, Desktop und Handy, Varianten
  mit Empfehlung); der Nutzer entscheidet visuell.
- Bei Verhaltensänderungen nachfragen, mit Auswirkung und Empfehlung.
- Nur auf `main` pushen, andere Branches löschen. Pushen ist jederzeit
  erlaubt; der Nutzer legt Tag und Release mit Ziel `main` an. Übersprungene
  Versionen: Release Notes fassen alles seit dem letzten Release zusammen
  (`CLAUDE.md`, "Git und Releases").
- Jede funktionale Änderung: Version, `PANEL_VERSION`, CHANGELOG DE/EN,
  README DE/EN, Prüfungen, Tests; nach dem Push die Release-Angaben mit
  genauer Version ausgeben (Nutzer legt Tag und Release an).
- Veröffentlichte Tags nie ändern.
- Keine Tokens/Keys im Panel; andere Integrationen nur per Knopfdruck ändern.
