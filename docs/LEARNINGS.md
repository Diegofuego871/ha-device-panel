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
  dessen X aus; eigenes X, kein Zurück-Knopf. Das `close`-Ereignis (auch bei
  Escape) kommt asynchron: Aufräumen dort, Tests darauf warten lassen.
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
`recorder/info` scheitert ohne Recorder; das ist harmlos. Ebenso
ein `pageerror` "Object" beim Laden, der auch auf `/config/dashboard`
auftritt (HA-Frontend, nicht das Panel).

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
- Claude-Code-Sessions können keine Tags pushen und keine Remote-Branches
  löschen (beides 403); der Push auf `main` funktioniert. Tags, Releases und
  das Löschen von Branches übernimmt deshalb der Nutzer.
- Beim Anlegen eines Release auf GitHub ist das Ziel standardmässig `main`.
  Liegt der Stand auf einem anderen Branch, zeigt der Tag auf den falschen
  Commit (so geschehen bei `v0.1.0b1`). Deshalb nur auf `main` arbeiten.
