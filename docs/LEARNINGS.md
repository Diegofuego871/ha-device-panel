# Learnings aus "UniFi Dynamic Clients"

Erfahrungen aus über 60 Releases von Diegofuego871/unifi_dynamic. Jede Regel
hat dort einen echten Fehler oder Umweg gekostet.

## Home Assistant (Backend)

- **Panel als eingebautes iframe-Panel** registrieren
  (`frontend.async_register_built_in_panel(component_name="iframe", …,
  require_admin=True)`), nicht als Custom Panel. HA rendert dann Kopfzeile,
  Menü-Knopf (mit Mitteilungs-Punkt) und Safe-Area selbst, das iframe hat eine
  feste Höhe. Custom-Panel-Varianten scheiterten an Sticky-Header, iOS-
  Safe-Area und Scrollen. `panel.html` holt `hass` aus dem Elternfenster und
  überträgt die Theme-Variablen (siehe `panel/panel.html`).
- **Cache-Buster:** `panel.html?v=PANEL_VERSION`, die Seite reicht `?v=` an
  alle JS-Importe weiter. Bei jeder Panel-Änderung erhöhen.
- **WebSocket-Befehle** statt REST: `websocket_api.websocket_command` +
  `require_admin`, einmal pro Instanz registrieren (Flag in `hass.data`).
  Jeden Befehl, der eine Config-Entry-ID annimmt, auf `entry.domain ==
  DOMAIN` prüfen.
- **Zahlen im Optionsdialog:** `NumberSelector` liefert Kommazahlen (`10.0`);
  vor dem Speichern in `int` umwandeln, damit Panel und Dialog dieselben
  Werte schreiben. `unit_of_measurement` nur setzen, wenn es eine Einheit
  gibt: Das Schema verlangt `str`, `None` scheitert. Ungültige Bereiche
  lehnt der Selektor selbst ab (`InvalidData`).
- **Deaktivierte Geräte:** `er.async_entries_for_device` lässt deaktivierte
  Entitäten weg; für ein deaktiviertes Gerät `include_disabled_entities=True`
  übergeben, sonst hat es keine Entitäten (Typ, Popup). Zustände gibt es für
  sie nicht.
- **Anhaltende Benachrichtigung:** `persistent_notification.async_create`
  mit fester ID ersetzt die Meldung; `async_register_callback` meldet
  `UpdateType.REMOVED`, wenn der Benutzer sie wegklickt. Sie lebt nur im
  Speicher: nach einem Neustart neu aufbauen. In `manifest.json` unter
  `dependencies` (wie unifi_dynamic).
- **Push in Tests:** `async_mock_service(hass, "notify", "handy")` liefert die
  Aufrufe; für "lehnt Zusatzdaten ab" einen eigenen Dienst registrieren, der
  bei `data` eine Ausnahme wirft.
- **Speichern:** `Store.async_delay_save` entprellt und verschiebt bei jedem
  Aufruf. Bei häufigen Änderungen wird im Betrieb nie geschrieben, nur beim
  Beenden. Immer `storage_util.PeriodicSaver` verwenden (schreibt spätestens
  nach `delay`).
- **Recorder-Last:** Jede Zustands- oder Attributänderung ist eine Zeile in
  der Datenbank. Werte, die sich bei jedem Poll ändern (Zeitstempel, RSSI),
  stufen (z. B. 5 Minuten) oder als `_unrecorded_attributes` markieren.
  Verläufe im Panel aus eigenen Dateien, nicht aus dem Recorder.
- **"Keine Daten" ist nicht "offline":** HA-Neustarts und Ausfälle der
  Datenquelle als Lücke (None) speichern, nicht als Ausfall. Beim Start die
  Lücke seit dem letzten Lauf markieren.
- **Offene Blöcke abschliessen:** Laufende Aggregationsblöcke (5 Min./Stunde)
  bei jedem Durchgang für alle Schlüssel prüfen und abschliessen; sonst bleiben
  Werte verschwundener Objekte für immer "aktuell". Abfragen nach Zeitraum
  filtern, auch den laufenden Block.
- **Options-Änderungen:** Update-Listener nötig; nur bei Werten neu laden, die
  beim Setup eingefroren werden (Intervall, Zeitpläne), sonst frisch lesen.
- **Config-Flow:** Verbindungsdaten im Flow testen; `reconfigure` und
  `reauth` anbieten; Unique-ID sauber wählen (bei mehreren Instanzen).
- **Sprache serverseitig** (Push, Optionslisten): `hass.config.language`,
  Deutsch bei `de`/`de-*`, sonst Englisch. Keine festen deutschen Texte.
- **Dienste** brauchen Übersetzungen in `strings.json` (`services.<name>`),
  sonst erscheint in der englischen Oberfläche der Text aus `services.yaml`.
- **Geräte-Lookup** über eine zentrale Hilfsfunktion (API-Änderungen in HA
  2026.8: `async_get_device_by_identifier`).
- Mindestversion in `hacs.json` (`homeassistant`) ehrlich setzen und gegen
  die genutzten APIs prüfen.
- **Andere Integrationen importieren** (z. B. `homeassistant.components.zha`,
  `bluetooth`): hassfest verlangt sie in `dependencies` oder
  `after_dependencies`. Für "nutzen, wenn vorhanden" `after_dependencies`.
  Lokal läuft hassfest nicht, erst in der CI: Manifest bei neuen Importen
  selbst prüfen.
- **Entitätsname:** Bei `has_entity_name` ohne eigenen Namen (`name` und
  `original_name` leer) heisst die Hauptentität wie das Gerät. Nicht auf
  `friendly_name` aus dem Zustand verlassen: der fehlt, wenn ein Zustand
  ohne Attribute gesetzt wurde.
- **HACS ohne stabiles Release:** Gibt es nur Vorabversionen und ist der
  Schalter "Pre-release" aus, nimmt HACS den neuesten Commit des
  Standard-Branches als "Version" (`display_available_version`) und meldet
  nach jedem Push ein Update. Auch installiert wird dann der Stand von
  `main`, kein Release. Abhilfe: ein stabiles Release (oder den Schalter
  einschalten).
- **GitHub `releases/latest`** antwortet mit 404, solange es nur
  Vorabversionen gibt. Das ist kein Fehler: dann gibt es eben keine stabile
  Version (`update_check.async_latest_release`).
- **Tests ohne Netz:** Die tägliche Versionsprüfung läuft auch beim
  Aufräumen von `hass` noch an. Der Patch auf `update_check._async_get_json`
  steht deshalb als erste autouse-Fixture in `tests/conftest.py` (vor allem,
  was `hass` startet), sonst ist er beim Aufräumen schon weg. Das Modul dort
  beim Sammeln importieren: später zeigt `custom_components` je nach
  Reihenfolge auf das Testpaket von HA.
- **Verfügbarkeitsprotokoll:** gleiche Regel wie die Liste verwenden
  (`device_status`), sonst widersprechen sich Liste und Verlauf. Beim Stoppen
  sofort "keine Daten" schreiben; beim Start die Lücke ab dem letzten
  Lebenszeichen. Im echten HA geprüft: Ausfall, Rückkehr, Neustart-Lücke.

- **`last_changed` überlebt keinen Neustart:** Nach dem Start haben alle
  Zustände `last_changed` = Zeitpunkt, an dem die Entität angelegt wurde.
  Wer daraus die Ausfalldauer liest, zeigt nach jedem Neustart die Zeit seit
  dem Start (Fehler bis 0.12.0). Dauer über Neustarts nur aus eigenen Daten
  (Protokoll: Beginn = erster Ausfall nach der letzten Beobachtung "online",
  Lücken ohne Daten beenden ihn nicht).
- **"Kurzer Aussetzer" ist nach dem Start kein Lebenszeichen:** Die Regel
  "unter der Schwelle gilt als online" machte jedes schon ausgefallene Gerät
  in den ersten Minuten nach dem Start online (last_changed = Start). Das
  Protokoll schrieb "online", die Meldung "wieder online" ging hinaus. Ein
  Zustand "alle Entitäten weg, noch unter der Schwelle" darf nichts
  schreiben (`devices.device_down_since`).
- **Neustart-Tests wie beim Hochfahren:** Im Test läuft HA schon; die erste
  Bewertung kam beim Einrichten, bevor die Meldungen zuhörten, und der
  Fehler blieb verborgen. `hass.set_state(CoreState.not_running)` vor dem
  Einrichten, danach `running` und `EVENT_HOMEASSISTANT_STARTED` feuern.
  Im echten HA: Testintegration mit Gerät, dessen Verfügbarkeit eine Datei
  steuert (siehe "Prüfung im echten Home Assistant").

- **Dateien beim Entfernen löschen, aber zuerst ausstehend schreiben:**
  `async_remove_entry` läuft nach dem Entladen. Ein mit `async_delay_save`
  geplantes Schreiben (Meldungen, Batterie: 1 s) legte die Datei nach dem
  Löschen neu an, weil `Store.async_remove` nur die eigene Instanz kennt.
  Darum beim Entladen sofort `async_save` (verwirft den Termin), dann im
  Entfernen mit neuen `Store`-Instanzen löschen und geladene Stände aus
  `hass.data` nehmen (sonst brächte ein neues Einrichten ohne Neustart sie
  zurück). Test: Unterbruch planen, entfernen, Zeit vorspulen, nichts da.
- Mehrere Zeiten pro Integration ("Ausgefallen nach"): jede Stelle, die die
  Schwelle brauchte (Erkennung, Liste, Ausfallbeginn, Nachfüllen aus dem
  Recorder), muss sie je Gerät holen (`options_api.offline_after_for`);
  ein globaler Wert, der an einer Stelle übrig bleibt, gibt widersprüchliche
  Status (Liste "ausgefallen", Protokoll "online"). Nicht überwachte Geräte
  gehören in `listed_devices`, nicht in `monitored_devices`.

- `ai_task` (Home Assistant ab 2025.8): `async_generate_data(hass, task_name=,
  entity_id=, instructions=)` liefert `.data` (Text ohne `structure`). Ohne
  `entity_id` gilt die Standard-Aufgabe; ist keine gesetzt, wirft es
  `HomeAssistantError("No entity_id provided and no preferred entity set")`.
  Import erst beim Aufruf, damit die Integration auch ohne ai_task läuft;
  In der CI fehlt `hassil` (Abhängigkeit von `conversation`, die `ai_task`
  braucht): der Test mit echter `ai_task`-Komponente überspringt sich dort
  (`pytest.importorskip("hassil")`), läuft aber lokal.
  Fehlertexte nicht ins Panel geben, ohne sie zu kürzen (sie können
  Anbieter-Meldungen enthalten).
- Matter-Diagnose (`matter/node_diagnostics`): `node_type` kennt
  `end_device`, `sleepy_end_device`, `routing_end_device` (Router und
  Leader), `bridge`, `unknown`; `network_name` ist bei Thread der Netzname,
  bei WLAN die SSID (aus `lastNetworkID`). Werte vorher im Quelltext von
  python-matter-server nachlesen (`pip download python-matter-server
  --no-deps`), nicht raten: "router" gibt es dort nicht.

- Einstellungen, die nur für eine von mehreren Meldungen gelten, sagen das
  im Namen und in einem sichtbaren Hinweis, nicht nur in grauer Kleinschrift:
  "Inhalt der Meldung" (nur Ausfall) wurde für die Batterie-Warnung gehalten
  (Rückmeldung des Nutzers, 0.33.1). `notify_fields` wirkt nur in
  `outage.message_parts`; die Batterie-Meldung (`battery.py`) hat festen Inhalt.

## Panel (Frontend)

- **Vanilla Web Component**, kein Lit, kein Build, kein CDN. Logik, Texte
  (`strings.js`) und Styles (`styles.js`) in eigenen Modulen, alle mit dem
  Cache-Buster geladen.
- **Nie mit `innerHTML` vergleichen:** Der Browser serialisiert anders
  (`disabled` → `disabled=""`). Vergleich immer mit dem zuletzt gesetzten
  String (`setHtml`-Helfer mit WeakMap). Sonst wird bei jedem `hass`-Update
  neu aufgebaut, Klicks gehen verloren, Dropdowns schliessen.
- **Zurück von einer HA-Seite:** Die Geräteseite von HA hat keinen festen
  Rücksprung; ihr Pfeil ruft `goBack()` (`history.back()`, wenn mehr als ein
  Eintrag da ist). Links ins Frontend von HA deshalb als `pushState` im
  Elternfenster (`_navigate`) und mit `?historyBack=1`, HAs eigenem Merker
  ("geh im Verlauf zurück statt zur festen Seite"); ältere Versionen
  ignorieren ihn. In HA 2026.2.3 geht der Pfeil schon ohne ihn zurück ins
  Panel; Meldung eines Nutzers der Companion-App (Pfeil führte in die
  Geräteliste) ist ungeprüft. Im Test: `window.__nav` im Simulator.
- **`hass`-Setter wird sehr oft aufgerufen** (jede Zustandsänderung in HA).
  Dort nur günstige, idempotente Arbeit.
- **Abruf:** nie zwei gleichzeitig (ältere Antwort überschreibt neuere),
  Polling pausieren, wenn `document.visibilityState === "hidden"`, beim
  Zurückkehren sofort laden. Verbindungsfehler (Code 1/3, "connection_lost")
  still mit Backoff wiederholen, erst nach 30 s melden.
- **Nur der `<tbody>` wird neu gerendert;** Werkzeugleiste und Kopf bleiben,
  damit Suchfeld und Filter Fokus und Cursor behalten.
- **Sticky-Kopf + horizontales Scrollen:** ein einziger Scroll-Container
  (`.content`, overflow auto), Kopfzeilen `position: sticky`, Tabelle selbst
  ist die Karte. `overscroll-behavior: contain` (nicht `none`, fühlt sich auf
  iOS unnatürlich an).
- **Dialoge:** `<dialog>` mit `showModal`, auf dem Handy als Blatt von unten.
  Unter-Fenster (Statistik) dimmen den Dialog dahinter stark und blenden
  dessen X aus; eigenes X, kein Zurück-Knopf. Das `close`-Ereignis (auch bei
  Escape) kommt asynchron: Aufräumen dort, Tests darauf warten lassen.
  `open` ist sofort `false`, was `close` nachführt (z. B. `aria-expanded`
  am Knopf "Spalten") erst wenige Millisekunden später; `view-e2e` las das
  in 0.26.0 zu früh und war in CI zeitweise rot. Beides in derselben
  Warte-Bedingung prüfen.
- **Fixierte erste Spalte:** `position: sticky; left: -<Innenabstand>` an `th`
  und `td`, deckende Hintergründe (Farben mit der Kartenfarbe mischen, nicht
  mit `transparent`). Kopf, Chips und Fusszeile mit `sticky; left: 0`, damit
  sie beim seitlichen Scrollen stehen bleiben. Gruppenzeilen: Text in einem
  eigenen `sticky`-Element, die Zelle über alle Spalten klebt nicht.
- **HACS erkennen:** Update-Entität über `hass.entities` (Plattform `hacs`)
  und den Link `release_url` des Repositorys, nie über eine feste Entity-ID.
  Der Schalter "Pre-release" hängt am selben HACS-Gerät; ist er deaktiviert,
  fehlt er in `hass.entities` und steht nur in `config/entity_registry/list`.
- **Hover und Hauptknöpfe:** Eine allgemeine Hover-Regel (`background`) darf
  farbige Hauptknöpfe nicht überschreiben; eigene Hover-Regel je Variante.
- **Entitäts-Dialog von HA** aus dem iframe: `hass-more-info` am Element
  `home-assistant` des Elternfensters auslösen (`bubbles`, `composed`).
- **CSS-Klassennamen eindeutig halten** (Kollisionen zwischen Tabelle und
  Dialog haben mehrfach Layouts zerschossen).
- **Benutzereinstellungen** (Spalten, Sortierung, Filter, Zeitraum) pro
  Benutzer über `frontend/set_user_data`, lokale Kopie in localStorage, der
  neuere Stand gewinnt. Instanzweite Einstellungen im Backend speichern.
- **Alle Einstellungen gelten erst mit "Speichern"**, "Abbrechen" verwirft
  (einheitlich, auch für Benutzer-Optionen).
- **Deep-Links** (`?entry=…&mac=…`) aus Push-Meldungen öffnen direkt die
  Geräteansicht; auf `location-changed` des Elternfensters hören.
- **Maskieren:** jeder Wert aus Geräte-/Entitätsnamen geht durch `_escape`.

- **`escape` muss auch `"` und `'` maskieren:** `div.textContent` +
  `innerHTML` maskiert nur `&`, `<`, `>`. In Attributen (`data-short`,
  `aria-label`, `title`, `value`) brach ein Text mit `"` ab (0.8.0 behoben,
  Prüfung in `settings-e2e`).
- **Fehler-Rahmen gegen "geändert":** `.opt.changed > .opt-line .opt-input`
  ist spezifischer als `.opt-input.bad`; das Feld blieb trotz Fehler blau.
  Die Fehlerregel braucht dieselbe Kette (`.opt.changed > .opt-line
  .opt-input.bad`). Prüfung über die berechnete Rahmenfarbe, nicht nur die
  Klasse.
- **Zeitfeld (`input[type=time]`):** liefert "" solange die Eingabe
  unvollständig ist; wie die Zahlenfelder beim Tippen nur
  `_updateSettingsMeta` (Markierung, Fehler, Kurzzeile), kein Neuaufbau.
  Der `TimeSelector` von HA liefert "HH:MM:SS", gespeichert wird "HH:MM".
  Die Anzeige folgt dem Browser (en-US "08:00 AM", headless Chromium immer
  so), nicht der Sprache von HA: keine feste Breite (84 px schnitt "AM" ab),
  `width: auto`. Die Paar-Zeile (Auswahl + Uhrzeit) braucht `flex: 1 1 auto`,
  sonst rechnet Chrome die Breite des umbrechenden Flex-Containers zu knapp
  und bricht auch auf dem Desktop um.
- **Fokus nach Neuaufbau nie an Auswahlfelder auf Touch-Geräten:** iOS
  öffnet eine `<select>` (und Zeitfelder), sobald sie per `focus()` den
  Fokus bekommt. Das Popup und die Einstellungen geben nach dem Neuaufbau
  den Fokus zurück; das liess die Auswahl nach jeder Wahl und jeder Abfrage
  wieder aufgehen (0.9.1). `refocus()` lässt Auswahl- und Zeitfelder bei
  `(pointer: coarse)` aus, sonst `focus({ preventScroll: true })`. Test:
  vorher fokussieren, wählen, abfragen, dann `activeElement` prüfen
  (Playwright mit `isMobile`/`hasTouch` meldet `pointer: coarse`).
- **Einstellungen gelöschter Geräte behalten:** HA stellt ein wieder
  hinzugefügtes Gerät (gleiche Kennungen) mit derselben Geräte-ID her
  (`deleted_devices`). Darum bleiben Einträge in
  `.storage/device_panel.devices`; die Übersicht zum Zurücksetzen zeigt nur
  vorhandene Geräte.
- **Zurücksetzen mit Geräte-IDs, nicht "alle":** Das Panel schickt die
  markierten Geräte; ein Wert, den jemand anderes inzwischen gesetzt hat,
  bleibt stehen.
- **Lokale Bereichsprüfung ist kein Speicherfehler:** Im Popup nichts
  senden, die Eingabe stehen lassen und den Bereich unter dem Feld nennen;
  "Konnte nicht gespeichert werden" nur für Antworten des Backends.
- **Ziehen mit Pointer-Ereignissen, Zuhörer am Fenster:** Wer die Zeile
  beim Ziehen im DOM verschiebt, verliert `setPointerCapture` am Griff; die
  Zeile wanderte auf dem Desktop nur eine Position weit (0.13.0).
  `pointermove`/`pointerup` darum am Fenster (`ownerDocument.defaultView`,
  im iFrame), `touch-action: none` am Griff, damit der Finger nicht scrollt.
  Pfeiltasten auf dem Griff für die Tastatur. Erst beim Loslassen in den
  Entwurf schreiben und neu aufbauen, nie während des Ziehens.
- **Toast hinter modalem Dialog:** `showModal()` legt den Dialog in die
  oberste Ebene (top layer); ein Toast im Shadow DOM bleibt dahinter
  unsichtbar, egal welcher `z-index`. Bleibt ein Dialog nach einer Aktion
  offen (Einstellungen seit 0.15.0), gehört die Bestätigung in den Dialog.
- **Zusammenfassungen nicht wie Zustände formulieren:** "Batterie schwach"
  als Liste eingeschalteter Meldungen las sich wie eine Warnung; mit Verb
  ("meldet …").
- **Langzeitstatistik im Test (0.22.0):** `async_import_statistics` mit
  `source: "recorder"` und der Entität als `statistic_id` schreibt echte
  Stundenwerte in die Test-Datenbank (`mean_type`, `unit_class` angeben,
  sonst Warnung); danach `async_wait_recording_done`. So läuft
  `statistics_during_period` wie im Betrieb.
- **Batteriesensoren melden selten (0.22.0):** Zwischen 22 % und 100 %
  lagen im Test 18 Std.; ein Wechsel nur "innert 3 Std." wurde nicht
  erkannt. Der vorige Punkt zählt darum immer.
- **Negative Zahlen auf dem Handy (0.21.0):** `inputmode="numeric"` zeigt
  auf iOS nur Ziffern, ohne Minus; für die Empfang-Schwelle in dBm darum
  `type="number"` ohne `inputmode` (Zahlen- und Zeichentastatur). Auf einem
  echten iPhone noch nicht geprüft.
- **Geräte-Registry kennt das Anlegedatum (0.21.0):** `DeviceEntry.created_at`
  (seit HA 2024.7); ältere Einträge hat die Migration auf 1970 gesetzt. Im
  Test lässt sich ein Eintrag mit `attr.evolve(device, created_at=…)`
  ersetzen (private Attribute wie `_suggested_area` verhindern den
  Konstruktor).
- **Empfang ohne Verlauf im Recorder (0.24.0):** ZHA liefert LQI/RSSI am
  Geräteobjekt (die Sensoren dafür sind meist deaktiviert), Bluetooth den
  RSSI aus `async_last_service_info`. Beide stehen nicht im Recorder; der
  Verlauf braucht eine eigene Aufzeichnung. Beide liefern nach einem Ausfall
  den letzten Wert weiter: nur aufzeichnen, solange das Protokoll das Gerät
  online sieht. Für den Verlauf eines ausgefallenen Sensor-Geräts den Sensor
  nach der Registry suchen (`signal_sensor`), nicht nach dem Zustand.
- **Tipp-Hervorhebung in Bildschirmfotos (0.24.0):** Auf dem Handy-Nachbau
  (Touch) zeichnet Chromium die Hervorhebung des angetippten Elements
  (Kachel im Popup) kurz über dem darüber geöffneten Fenster; im Bild eine
  fremde Fläche. Kein Fehler des Panels; ohne Tipp geöffnet ist sie weg.
- **Globale Klassen im Panel (0.23.0):** `.sub` (Unterzeile in der Liste)
  setzt `display: block`; als Zusatzklasse an einer Flex-Zeile stapelte sie
  Kästchen und Name untereinander. Neue Bausteine bekommen eigene,
  eindeutige Klassen (`.arow.in` statt `.arow.sub`), und jede neue Ansicht
  wird im Bild geprüft, nicht nur per Test.
- **Popover unter einem tiefen Anker (0.23.0):** Der Chip "Bereich" steht
  unter dem Kopf, also weit unten; ein Popover mit fester Höchsthöhe ragte
  aus dem Fenster, Zeilen darunter waren nicht erreichbar (Playwright:
  "element is outside of the viewport"). Höhe darum aus dem Platz bis zum
  unteren Rand (`_placeAreas`).
- **Dialog statt Popover (0.26.0):** Das Spalten-Popover brauchte eigene
  Handler für Klick ausserhalb, Escape und einen Klick-Fänger, damit der
  Klick ausserhalb nicht zugleich die Liste traf. Als `<dialog>` mit
  `showModal()` erledigt der Browser Escape und den Fokus; Klick auf den
  Hintergrund ist ein Klick auf das Dialog-Element selbst
  (`ev.target === dlg`), und das Ereignis `close` setzt den Zustand
  zurück, egal wie geschlossen wurde.
- **Kopf pro Bereich ohne neue Abfrage (0.26.0):** Der Puls lässt sich im
  Panel aus den Streifen `avail24.strip` der Geräte im Bereich zählen
  (Wert 1 = Unterbruch im Abschnitt), weil das Backend den Puls gleich
  zählt; nur die Sammelausfälle brauchten die Geräte-IDs im Ergebnis.
  `test_incident_and_pulse` prüft, dass die Streifen je Abschnitt
  zusammengezählt den Puls des Backends ergeben.
- **Puls zählte Abschnitte statt Geräte (bis 0.25.0):** `pulse` erhöhte
  den Zähler pro Ausfall-Abschnitt; ein Gerät, das in einer halben Stunde
  dreimal kurz weg war, ergab 3. Aufgefallen erst im echten HA beim
  Vergleich mit dem Puls aus den Streifen (Kopf pro Bereich), die Tests
  hatten je Gerät nur einen Ausfall. Jetzt pro Gerät eine Menge der
  Abschnitte (`test_pulse_counts_devices_not_outages`).
- **Raster-Spalte `1fr` wächst mit dem Inhalt (0.26.0):** `1fr` heisst
  `minmax(auto, 1fr)`; eine Zeile mit `white-space: nowrap` macht die
  Spalte so breit wie der Text, `text-overflow: ellipsis` greift nie, und
  der Bereich hinter "Verfügbarkeit" lief bis in den Rand der Kachel.
  `minmax(0, 1fr)` lässt die Spalte schrumpfen. Prüfung in `area-e2e`:
  Abstand des Bereichs zum Rand jeder Kachel mindestens 12 px.
- **Recorder ohne Zeile im Zeitraum (0.27.0):** Der Recorder schreibt nur
  Wechsel (`state_changed`), keine gleichen Werte; ein Sensor, der sich
  länger nicht ändert, als der Recorder aufbewahrt (Standard 10 Tage), hat
  weder eine Zeile im Zeitraum noch einen Stand zu Beginn.
  `state_changes_during_period` liefert dann nichts, ebenso für einen in
  der Konfiguration ausgeschlossenen Sensor (kein `states_meta`). Der
  Zustand selbst weiss es aber: `last_changed` sagt, seit wann der Wert
  gilt (`battery_history.held`). Ob der Recorder eine Entität aufzeichnet:
  `get_instance(hass).entity_filter` (in HA 2026.9 ist `is_entity_recorded`
  nach `recorder/entity_options.py` gewandert, nicht mehr in
  `recorder/__init__`).
- **Lokale Variable verdeckt Funktion (0.27.0):** In `SignalLog.sample`
  hiess der Merker `recorded` wie die neue Funktion `recorded()`; Python
  meldete "bool object is not callable" erst zur Laufzeit. Merker heisst
  jetzt `wrote`. Ein Test über den neuen Pfad hat es gefunden.
- **callWS wirft nicht immer einen Error (0.27.1):** Nach dem Ruhezustand
  des Handys lehnt HA offene Abfragen mit einer Zahl (`ERR_CONNECTION_LOST`
  = 3) oder einem Objekt ohne `message` ab; `err.message || String(err)`
  ergab "[object Object]" (Fehlerbericht des Nutzers). Fehlertext immer
  über `errText`, Verbindungsfehler über `isConnectionError`: Daten
  behalten, Hinweis, Wiederholung mit wachsendem Abstand und sofort bei
  `visibilitychange`, `online`, `pageshow`, `focus`. Eine Abfrage kann auch
  nie antworten: `_callWithTimeout` (20 s), sonst bliebe `_fetching` für
  immer besetzt. Nachbau: `window.__wsFail` (number, object, empty, text),
  Suite `reconnect-e2e`.
- **Tagesmittel und Batteriewechsel (0.29.0):** Bei Tagesmitteln
  verteilt sich ein Sprung (19 → 59 → 98 %) auf zwei Tage und zählte als
  zwei Wechsel; `changes()` nimmt für `period == "day"` ein Fenster von
  2 Tagen. Und: sechs Zeiträume in `.seg-sw` machten das Fenster auf dem
  Handy breiter als den Bildschirm (Inhalt rutschte seitlich weg); die
  Auswahl `.stat-range` scrollt jetzt selbst, `battery-e2e` prüft
  `scrollWidth <= clientWidth`.
- **Vorschau muss jeden Schalter zeigen (0.29.1):** Die Vorschau von
  "Inhalt der Meldung" nahm das erste ausgefallene Gerät; hatte es keine
  Batterie, änderte der Schalter "Batterie" nichts und wirkte kaputt
  (Rückmeldung des Nutzers). Jetzt das Gerät mit den meisten Angaben, fehlende
  Werte als Beispiel in Kursiv, mit Hinweis. Allgemein: Eine Vorschau mit
  echten Daten braucht einen Ersatz, wenn die Daten die Einstellung nicht
  zeigen.
- **Hinweis mit Aktion (0.23.0):** `.toast` steht mit `left: 50%` und
  `translateX(-50%)`; ohne `width: max-content` bricht der Text schon bei
  der halben Fensterbreite um.
- **Alter Stand überdeckt eigene Änderung (0.20.0):** `_fetch` lief nie
  doppelt; eine Abfrage, die vor einer Änderung im Popup begonnen hatte,
  lieferte danach den alten Stand und überschrieb die sofort gezeigte Wahl,
  das Neuladen nach der Änderung wurde übersprungen. Folge: Thread von Hand
  sprang bis zur nächsten Abfrage (10 s) auf Matter zurück (Fehlerbericht
  des Nutzers). Nach jeder eigenen Änderung `_fetch(true)`: ein Zähler
  markiert laufende Abfragen als veraltet, ihr Ergebnis wird verworfen und
  sofort neu abgefragt. Test: Nachbau mit `__listDelay` (Antwort mit dem
  Stand vom Beginn, verzögert).

- `setHtml` ersetzt den ganzen Inhalt, sobald sich der String ändert. Alles,
  was im String von der Uhrzeit abhängt (Achsen, Tooltips mit Zeiten),
  ändert ihn bei jeder Abfrage und ersetzt Knoten unter dem Finger: Ein Tipp
  zwischen "touchend" und "click" geht dann verloren (Puls-Kachel, 0.33.1,
  nur gelegentlich in der Testsuite aufgefallen: "Fenster offen" scheiterte
  etwa bei jedem 20. Lauf). Zeiten im String auf die Minute abrunden. Der
  Fehler fand sich mit einem MutationObserver und einem Vorher/Nachher-Vergleich
  des HTML-Strings, nicht durch Wiederholen oder Warten.

- **`node --check` prüft die Panel-Module nicht (0.34.0):** Node 22 meldete
  für `device-panel.js` (mit `import`, ohne `"type": "module"`) Exit 0,
  obwohl eine schliessende Klammer fehlte; erst das Laden im Browser
  scheiterte ("Unexpected token 'else'"). Mit Modul-Syntax prüfen:
  `node --input-type=module --check < datei.js` (findet den Fehler, auch
  `.mjs` geht). `CLAUDE.md` nennt seither diesen Befehl.
- **Klassen mit gängigen Namen kollidieren (0.34.0):** Die Zusatzklasse
  `bat` am neuen Zeitstrahl erbte `.bat { display: inline-flex }` der
  Batterie-Zelle in der Liste; alle Marken lagen übereinander. Zusatzklassen
  neuer Bausteine mit eigenem Präfix (`mtl-b`, `mk-p`), und
  `:first-of-type` zählt nach Elementtyp: Vor den Marken steht der Balken
  (auch ein `div`), die Regel griff nie (`.mtl-bar + .mtl-mk`).
- **Code zwischen zwei Kommentaren entfernen (0.34.0):** Beim Ausschneiden
  der alten Tabellen-Funktionen "von Kommentar A bis Kommentar B" ging
  `_connCatalog` mit, das dazwischen stand; die Einstellungen öffneten sich
  nicht mehr. Danach die Liste der Methoden vor und nach dem Eingriff
  vergleichen (`grep -oE "^  _[A-Za-z0-9]+\("` und `diff`).

## Tests
## Tests

- **Python mit echtem HA:** `pytest-homeassistant-custom-component` (Python
  3.13). Frontend im Test als geladen markieren (`hass.config.components.add
  ("frontend")`), sonst scheitert das Setup an `hass_frontend`.
- **Fehlertests zuerst rot sehen:** Einen Test gegen den alten Code laufen
  lassen und prüfen, dass er fehlschlägt.
- **Panel:** HA-Nachbau (`tests/panel/sim/`) mit erfundenen Daten, der
  `callWS` simuliert; Playwright-Suiten pro Thema, Desktop und Handy,
  echte Klicks/Taps statt `element.click()` wo es um Gesten geht.
  `run.mjs` startet Server und alle Suiten, CI führt sie bei jedem Push aus.
- Screenshots der Suiten nach `tests/panel/output/` (nicht im Repo).
- **Eingabe in Zahlenfelder:** `ElementHandle` kennt in der verwendeten
  Version von `playwright-core` kein `pressSequentially` (nur `Locator`);
  `fill("")` und dann `type("10")` nutzen. Das Panel baut beim Tippen nicht
  neu auf (nur `_updateSettingsMeta`), sonst spränge der Cursor.
- **`pkill -f` mit einem Muster, das in der eigenen Befehlszeile steht**
  (z. B. `http.server 8950`), beendet die eigene Shell (Exit 144). Beenden und
  Starten in getrennten Aufrufen, wie bei HA.
- **Chromium in der Cloud-Session:** Der vorinstallierte Browser passt nicht
  zur Version von `playwright-core` ("Executable doesn't exist"); statt
  herunterzuladen `CHROMIUM_PATH=/opt/pw-browsers/chromium node run.mjs`.
- **Nachbau:** keine globalen Funktionen mit Namen von `window`-Eigenschaften
  (`history`, `location`, `name` …): eine Funktion `history` verdeckte
  `window.history`, und `pushState` des Panels schlug fehl.
- **Keine Tageszeit in Erwartungen:** Ob die heutige Säule (7 Tage) rot ist,
  hing von der Uhrzeit des Laufs ab (vor 11 Uhr falsch). Erwartungen aus den
  Daten des Nachbaus ableiten (`window.__availHistory`).
- **Touch-Gesten mit CDP:** Playwright hat kein Touch-Ziehen;
  `Input.dispatchTouchEvent` (touchStart, mehrere touchMove, touchEnd) über
  `ctx.newCDPSession(page)` erzeugt echte Pointer-Ereignisse vom Typ
  "touch". Danach 1,5 s warten: Chrome 153 (CI, `chromium-headless-shell`)
  verschluckt bis knapp 1 s nach so einer Folge den Klick des nächsten
  Tipps (`pointerdown`/`pointerup` kommen, `click` nicht); Chrome 141 lokal
  nicht. Kein Fehler des Panels (geprüft: kein Nachlauf-Scrollen, ohne
  Neuaufbau gleich). CI-Fehler mit der Browser-Version der CI nachstellen:
  `chrome-headless-shell` von `cdn.playwright.dev` ins Scratchpad laden und
  über `CHROMIUM_PATH` nutzen. Positionen erst messen,
  nachdem die Liste einmal ins Bild gescrollt ist, sonst verschiebt das
  Scrollen das Ziel.
- **Recorder in Python-Tests:** `recorder_mock` muss vor `hass` entstehen;
  die automatischen Fixtures in `conftest.py` brauchen `hass` aber schon
  vorher ("assert not hass_fixture_setup"). Im Testmodul die Fixture
  `mock_recorder_before_hass` mit `async_test_recorder` überschreiben (so
  macht es HA selbst). Verlauf in der Vergangenheit: `freezer.move_to`,
  `hass.states.async_set`, `async_wait_recording_done`. Der Lauf des
  Recorders beginnt dabei zur echten Zeit, also nach der eingefrorenen.
- **Playwright `click()`** scrollt das Element vorher ins Bild; bei breiten
  Tabellenzeilen verschiebt das die Tabelle seitlich. Für Prüfungen auf die
  Scrollposition mit `page.mouse.click(x, y)` klicken.

## Prüfung im echten Home Assistant

Der Nachbau ersetzt keinen Test in der echten Oberfläche. In der Session:
`pip install home-assistant-frontend==<Version aus components/frontend/manifest.json>`,
Konfiguration mit `frontend:`, `config:` und `demo:` (Demo-Geräte), dazu die
Pakete aus den Manifesten von `assist_pipeline`, `conversation`, `camera`
usw., sonst scheitert `get_services` und die Oberfläche bleibt bei "Loading
data". Ersteinrichtung und Anmeldung über `/api/onboarding/*` und
`/auth/token`, Integration über `/api/config/config_entries/flow`, Tokens als
`hassTokens` in `localStorage` (vor dem Test erneuern: das Zugriffstoken
gilt 30 Min.). Geräte mit `POST /api/states/<entity_id>` auf `unavailable`
setzen. Push prüfen: eine kleine eigene Integration in der Test-Konfiguration
registriert `notify.testhandy` und schreibt jeden Aufruf in eine Datei; eine
Batterie entsteht, indem man bei einem Demo-Sensor die Geräteklasse in der
Registry auf `battery` setzt (`config/entity_registry/update`) und den
Zustand per REST setzt (die Registry-Klasse hat Vorrang vor dem Attribut).
Ausfall über einen Neustart: `POST /api/states` reicht nicht (Demo-Geräte
sind nach dem Start wieder da). Eine Testintegration mit Konfigurationsfluss
legt ein Gerät mit einer Lampe an (`should_poll`, alle 10 s), die nicht
verfügbar ist, solange eine Datei existiert; Datei anlegen, Ausfall
abwarten, HA stoppen und starten, Liste, Protokoll und Pushes prüfen.
"Ausgefallen nach" und Anlaufphase auf 1 Min. stellen spart Wartezeit.
Nachfüllen aus dem Recorder prüfen (0.18.0): `recorder:` in die
Konfiguration, einen Lauf mit einem Ausfall aufzeichnen, HA stoppen, das
Protokoll vor einem Zeitpunkt nach dem Ausfall kürzen (wie eine frische
Installation) und den Merker `backfilled` löschen, starten und 2 Min.
warten; der Ausfall muss wieder im Protokoll stehen. Achtung: Ein Gerät mit
einem zweiten lebenden Sensor (z. B. Batterie ohne Kategorie) fällt nie
ganz aus, live wie beim Nachfüllen; die Kategorie in der Registry
überschreibt die Integration beim Start, `hidden_by` bleibt.
`recorder/info` scheitert ohne Recorder; das ist harmlos. Ebenso
ein `pageerror` "Object" beim Laden, der auch auf `/config/dashboard`
auftritt (HA-Frontend, nicht das Panel).

## Release und HACS

- Struktur: `custom_components/<domain>/`, `hacs.json` im Repo-Root,
  `manifest.json` mit `version`, `documentation`, `issue_tracker`,
  `codeowners`, `iot_class`, `integration_type`.
- **Bild der Push-Meldung mit Rand:** iOS zeigt `icon_url` als Absender-Bild
  in einem abgerundeten Quadrat (Android oft rund) und schneidet dabei die
  Ecken ab. Ein knapp zugeschnittenes Icon verliert sie; eigenes Bild mit
  rund 20 % Rand. Neuer Dateiname bzw. Pfad, damit kein Zwischenspeicher
  das alte Bild weiter zeigt.
- Logo/Icon: `custom_components/<domain>/brand/icon.png` und `logo.png`
  (HA ≥ 2026.3 lädt Brand-Bilder lokal), optional zusätzlich PR an
  home-assistant/brands.
- GitHub Actions: `validate.yml` (HACS-Action + hassfest) und `tests.yml`.
- Releases über GitHub-Tags `vX.Y.Z`; HACS zeigt die Release Notes.
  Vorabversionen als GitHub-Pre-Release (Versionsnummer mit `b1`/`rc1`
  macht die Erkennung robuster).
- Veröffentlichte Tags nie umschreiben.
- Claude-Code-Sessions können keine Tags pushen und keine Remote-Branches
  löschen (beides 403); der Push auf `main` funktioniert. Tags, Releases und
  das Löschen von Branches übernimmt deshalb der Nutzer.
- Beim Anlegen eines Release auf GitHub ist das Ziel standardmässig `main`.
  Liegt der Stand auf einem anderen Branch, zeigt der Tag auf den falschen
  Commit (so geschehen bei `v0.1.0b1`). Deshalb nur auf `main` arbeiten.
