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

## Panel (Frontend)

- **Vanilla Web Component**, kein Lit, kein Build, kein CDN. Logik, Texte
  (`strings.js`) und Styles (`styles.js`) in eigenen Modulen, alle mit dem
  Cache-Buster geladen.
- **Nie mit `innerHTML` vergleichen:** Der Browser serialisiert anders
  (`disabled` → `disabled=""`). Vergleich immer mit dem zuletzt gesetzten
  String (`setHtml`-Helfer mit WeakMap). Sonst wird bei jedem `hass`-Update
  neu aufgebaut, Klicks gehen verloren, Dropdowns schliessen.
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
  dessen X aus; eigenes X, kein Zurück-Knopf.
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

## Release und HACS

- Struktur: `custom_components/<domain>/`, `hacs.json` im Repo-Root,
  `manifest.json` mit `version`, `documentation`, `issue_tracker`,
  `codeowners`, `iot_class`, `integration_type`.
- Logo/Icon: `custom_components/<domain>/brand/icon.png` und `logo.png`
  (HA ≥ 2026.3 lädt Brand-Bilder lokal), optional zusätzlich PR an
  home-assistant/brands.
- GitHub Actions: `validate.yml` (HACS-Action + hassfest) und `tests.yml`.
- Releases über GitHub-Tags `vX.Y.Z`; HACS zeigt die Release Notes.
  Vorabversionen als GitHub-Pre-Release (Versionsnummer mit `b1`/`rc1`
  macht die Erkennung robuster).
- Veröffentlichte Tags nie umschreiben.
- Claude-Code-Sessions dürfen nur ihren Branch pushen; ein Tag-Push endet
  mit 403. Releases deshalb über einen Workflow mit `workflow_dispatch`, den
  die Session auslösen kann (muss auf dem Standard-Branch liegen).
