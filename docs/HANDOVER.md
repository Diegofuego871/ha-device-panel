# Übergabe: Stand und nächste Schritte

Einstieg für jede neue Claude-Code-Session. Zuerst diese Datei lesen, dann
`CLAUDE.md`, `docs/CONCEPT.md`, `docs/LEARNINGS.md`, `docs/DESIGN.md`.

## Stand (Testlauf: parallel)

- `tests/panel/run.mjs` startet die Suiten parallel (`PANEL_JOBS`, Standard: Kerne minus eins, höchstens 4; `PANEL_JOBS=1` wie früher nacheinander): voller Lauf rund 13 statt 35 Minuten. Der Server ist reiner Dateiserver, jeder Browser hält seinen Zustand. Fehlgeschlagene Suiten laufen am Ende einzeln noch einmal (`PANEL_RETRY=0` schaltet ab); bestehen sie, werden sie als "instabil" ausgewiesen, sonst gilt der Fehler. Beobachtet unter Last (6 Jobs): `brand`, `dlgheight`, `segjump`, `settingspin` sporadisch; bei 4 Jobs alle grün. `graphics-e2e` wartet bis zu 3 s, bis die Reiter-Kapsel steht (war sporadisch rot, auch ohne Last). `test_new_devices::test_nothing_when_off_and_only_after_switching_on` war einmal in der CI rot (2 statt 1 Meldung), lokal in 40 Läufen nie; Ursache nicht gefunden, beobachten.

## Stand (2.92.0, Symbole an Navigationsknöpfen, Herz-Easter-Egg, Schalter live)

- Alle Knöpfe "Zurück" (`arrowLeft`), "Weiter" (`arrowRight`, nach dem Text), "Schliessen"/"Abbrechen" (`close`) tragen ein Symbol (Geräte-Popup, Einstellungen, Status, Routinen, Magic Push, Launcher); Rückfragen "Ja/Nein" (Löschen, Verwerfen) blieben unverändert. Der Knopf in den Einstellungen wechselt per `innerHTML` (nicht mehr `textContent`), sonst ginge das Symbol verloren.
- Easter Egg: `_heartLogo(on)` tauscht das Innenleben und die viewBox des Logos (`.tb-main > svg`) gegen das blaue MDI-Herz (`ee-heart`, Animation `ee-beat` 1,85 s x 4, Schläge bei 20/53/86 %, im Takt der Linie `ee-reveal`); `EE_MS = 7400`. Danach kommt das Logo aus `_logoKeep` zurück.
- `_watchEntityStates()` (in `set hass`): Reiter "Schalter" und "Entitäten" zeichnen sich neu, wenn sich Zustand oder `last_updated` einer Entität des offenen Geräts ändern. Test: `switchlive`.

## Stand (2.91.0, "Erst melden nach" pro Integration und Gerät)

- Wunsch des Nutzers: "Erst melden nach" wie "Ausgefallen nach" auf allen drei Ebenen; nie kürzer als "Ausgefallen nach", mit Fehlermeldung statt stillem Verschieben. Wirksam: Gerät > Integration > global (`options_api.notify_delay_for`, Laufzeit `max(wert, ceil(offline/60))`). Neu: Option `notify_delay_integrations` (`notify_delay_map`, `notify_delay_conflicts` in `apply_values`), Geräteeinstellung `notify_delay` (`devices.py`: `async_notify_delay_error`, `device_notify_delay`, Zurücksetzen, Übersicht), WS `set_device_settings`/`reset_device_settings` mit `notify_delay`, `outage.py` (`_delay` je Gerät in `async_flush`/`_schedule`). Panel: Popup-Zeile `dev-delay`/`dev-delay-min`, Integrationsdetail `data-delay-mode`, `_settingsErrors().notify_delay_integrations`, Übersicht `ovrDelay*`. Die HA-Optionsfluss-Schemaliste (config_flow) wurde bewusst nicht erweitert. Tests: Suiten `notifydelay`, `notifydelay-integ`; Python-Tests (`test_availability`, `test_outage_notify`, `test_overrides`, `test_update_check`). Die HA-Tests laufen auch in der Session: `uv venv --python 3.13 <dir>` und `uv pip install --python <dir>/bin/python pytest-homeassistant-custom-component`, dann `<dir>/bin/python -m pytest -q` (655 Tests, rund 30 s). In 2.91.0 war das zunächst nicht erkannt worden; die CI fand 4 Fehler in den Tests (fehlendes `notify_delay` in Erwartungen, doppelte WS-ID), danach grün.

## Stand (2.90.0, KI-Einschätzung zuklappbar)

- Wunsch des Nutzers (Screenshot Popup): die KI-Einschätzung lässt sich zuklappen, pro Benutzer gespeichert. `_aiHtml`: Kopfzeile `button.ai-head` (`data-dlg="ai-fold"`, `aria-expanded`), zugeklappt (`.ai-box.fold`) nur die Kopfzeile. Stand `this._aiFold`, gespeichert im Datensatz der Favoriten (`_favData().aiFold`, `FAV_KEY`, `_toggleAiFold`, `_setFavs`): lokal sofort, bei HA verzögert, der neuere Stand gewinnt. Test in `ai-e2e`.

## Stand (2.89.0, Easter Egg Herzschlag)

- Wunsch des Nutzers: fünf schnelle Klicks aufs Logo oben links lassen im Puls-Diagramm einige Sekunden lang einen Herzschlag schlagen. `device-panel.js`: `_logoTap()` (Klick-Zähler `_eeTaps`, `EE_TAPS = 5`, je höchstens 1,5 s Abstand), Zustand nur als Endzeit `_eeUntil` (`EE_MS = 5400`), `_heartOn()`, `_heartbeatSvg(W, H)` (Pfad mit drei Schlägen, über dem Diagramm in `.pchart`, `non-scaling-stroke`; nur in der Kachel, nicht im Fenster "Puls"). Die Kachel wird laufend neu aufgebaut: das Overlay kommt mit negativer `animation-delay` (CSS-Variable `--ee-delay`) in der richtigen Phase wieder. Stile `.ee-ecg`, `.pchart.ee`, `.kt.ee` (Aufdecken per `clip-path`, Ausblenden, Pochen des Symbols; `prefers-reduced-motion` ohne Bewegung). Ohne Kachel nur ein Hinweis 💓. Nicht in der README (Überraschung), nur im CHANGELOG. Test: `heartbeat`.
- v2.88.0 ist veröffentlicht (Tag auf 0998e12).

## Stand (2.88.0, Einstellungen als Favorit)

- Wunsch des Nutzers (Screenshot Launcher im Bearbeiten-Modus): das Zahnrad steht nicht mehr fest in der Kopfzeile, nur noch wenn der Benutzer "Einstellungen" anheftet; am Handy zwei angeheftete Knöpfe (`PHONE_PINS = 2` in `apps.js`, vorher einer), die gestrichelte Linie im Launcher-Bearbeiten-Modus sitzt vor der dritten Zeile (`styles.js`, `appsPhoneMark`); Standard-Favoriten `["routine","settings"]`.
- `apps.js`: `BUILTIN` `settings` ist `locked` (nicht ausblendbar; ohne festes Zahnrad gäbe es sonst keinen Weg in die Einstellungen; ein altes `hidden: ["settings"]` wird ignoriert, `isHidden`). `sanitizeApps` setzt `v: 2`; bestehende Daten ohne `v` bekommen "settings" einmal als zweiten Favoriten (`fav.slice(0,1), "settings", …`), Daten mit `v: 2` bleiben unberührt. Der angeheftete Knopf der Einstellungen trägt die Klasse `gear-btn` (Stile, Tests; `.toolbar .apps-btn:last-child { margin-right: 0 }`).
- Punkte: `device-panel.js` `_gearDot` setzt nur noch `_gearRestart` und ruft `_apps.paintDots()`; `AppLauncher.dotLevels()` kennt `pins.settings` und `why` (Grund fürs Launcher-Beschriftung: status, settings, log); rot "Neustart steht aus" sitzt am angehefteten Knopf der Einstellungen, sonst am Launcher-Knopf; die Karte "Einstellungen" im Launcher trägt in beiden Fällen die Pille.
- Tests: neue Suite `settingspin`; angepasst `launcher`, `launcherview`, `routineall`, `searchwidth`.

## Stand (2.87.0, Ansicht mit "Speichern", Disketten-Symbol)

- Wunsch des Nutzers (Mockups `docs/mockups/view-v3`): die Ansicht an einem Ort, mit eigenem "Speichern" (nicht sofort) für beide Reiter ("Spalten"/"Sortierung" pro Benutzer, "Filter-Chips" für alle, nur Administratoren). Umsetzung: der Dialog der Einstellungen (`dialog.settings`) hat einen Modus `st.mode = "view"` (`_openSettings("view")`, `_openView()`), Reiter `st.vtab` (`data-set="vtab"`). `_viewBodyHtml()` baut Reiterleiste und Reiter; der Chips-Reiter ist `fields.chips` aus `_settingsBodyHtml()` (liefert im Modus "view" nur diesen Block). Ansicht-Entwurf: `_setView(patch, { draft: true })` überspringt `_saveView()`; `st.viewBase = { kind, snap }` ist der Stand beim Öffnen, `_viewChanged()` vergleicht (`"view"` zählt als Änderung in `_settingsChanges`), `_saveSettings` ruft `_saveView()` und setzt `viewBase.snap` neu, `_closeSettings` ruft `_revertView()` (Schliessen mit Entwurf fragt vorher über `_requestCloseSettings`). Nicht-Administratoren: nur Reiter "Spalten", `get_options` wird nicht geladen (`_reloadSettings` kommt ohne `st.data` aus). `_bindViewControls(dialog)` bindet Auge, Ziehen, Pfeiltasten, Sortierung, Gruppen/Liste, Standard; der Hörer `_swallowUntil` (Bereichsfilter) liegt weiter dort. Die alten Dialoge `cols-dlg` und `dialog.view` sind weg (`_toggleCols`, `_renderCols`, `_openViewSheet`, `_renderViewSheet` entfernt). `_setAreas`/`_setIntegs`/`_cycleSort` speichern weiter sofort (Filter in der Liste, kein Dialog).
- Einstellungen: Abschnitt "look" entfällt; Abschnitt `updates` heisst "Panel" (`secPanel`) mit Unterreitern `pstart` ("Allgemein", Startseite-Schalter, Hinweis `startOwnNote`) und `pupdates` ("Updates", nur die Einstellungen der Prüfung; die Versionszeile `.ver-slot` bleibt wie immer ganz oben über den Abschnitten, Wunsch des Nutzers); `st.sub.panel`, Vorgabe "pupdates". `SUB_TAB_KEYS.pstart/pupdates`.
- Disketten-Symbol (`MDI.save`) an allen Speichern-Knöpfen (Geräte-Popup, Einstellungen, Status, Routinen, Magic Push, Launcher). Symbol `viewSettings` am Knopf "Ansicht" (vorher "Spalten") und in der Handy-Zeile.
- Tests: neue Suite `viewsave`; angepasst: `view`, `focus`, `launcherview`, `startpage`, `chiporder`, `chips`, `hidechips`, `conn`, `listlast`, `listsearch`, `prodevice`, `sigtype`.
- Offen: die README-Bilder `docs/screenshots/*/settings-section-updates.png` und `columns.png` zeigen noch den alten Stand (Panel-Version, Dialog "Anpassen"); `settings-section-look.png` wird nicht mehr verwendet. Neu aufnehmen.

## Stand (2.86.0, KI-Einschätzung entfernen)

- Wunsch des Nutzers (Screenshot Popup): ein Knopf, der die KI-Einschätzung wegnimmt, sie nimmt viel Platz ein. Umsetzung: Knopf "Entfernen" in der Fusszeile der Karte (`data-dlg="ai-clear"`, `_aiClear`), Backend `ai_assessment.async_clear` und WebSocket-Befehl `device_panel/ai_clear` (nur Administratoren, `AiMemory.forget`, liefert True, wenn eine da war). Ohne Rückfrage (leicht neu erstellbar). Die Einschätzung fliesst damit auch nicht mehr in den Kontext der nächsten ein. Tests: `test_ai_context`, Suite `aiclear`; Simulator kennt `ai_clear`.

## Stand (2.85.0, Apps "Ansicht" und "Einstellungen" im Launcher)

- Wunsch des Nutzers (Screenshot Launcher, Gruppe "Device Panel"): die Ansichtseinstellungen (Symbol Auge mit Zahnrad, farbig) und die normalen Einstellungen als Apps; beide ausblendbar (nicht `locked`), weil es einen zweiten Weg gibt (Knöpfe in der Kopfzeile), standardmässig sichtbar. `apps.js` `BUILTIN` `view`/`settings`, `PANEL_COLOR`, Aktion `host._openView()` (Handy: Blatt, sonst Dialog "Spalten") und `host._openSettings()`. `MDI.viewSettings` ist ein zusammengesetztes Symbol (Auge mit durch eine Maske ausgeschnittenem Zahnrad); `mdiPath` nimmt Einträge, die mit "<" beginnen, als fertiges SVG-Innenleben.
- Pille "Neustart" (rot) an der Karte "Einstellungen", solange der rote Punkt am Zahnrad der Kopfzeile steht (`_gearDot` setzt `host._gearRestart` und ruft `_apps.paintDots()`; `apps.js` `_badge`); bewusst kein Punkt am Launcher-Knopf (Wunsch des Nutzers). Test in `updatecfg`. Der Punkt am Zahnrad bedeutet heute nur "Neustart nach Update steht aus"; die Störung eines Dienstes zeigt die Status-App (Pille "Störung", Punkt am Launcher-Knopf), nicht die Einstellungen.
- (Die Ansicht-Reiter folgten in 2.87.0.)

## Stand (2.84.0, Knopf "HA-Seite der Integration öffnen")

- Wunsch des Nutzers (Screenshot Popup): neben "HA-Geräteseite öffnen" ein Knopf im gleichen Stil, der die HA-Seite der Integration des Geräts öffnet. `device-panel.js`: Action `open-integration` (`/config/integrations/integration/<domain>`, Domain aus `d.integration.domain`, nur `[a-z0-9_]`), schliesst über `_requestCloseDevice` (fragt bei Entwurf nach). Ohne Integration kein Knopf. Beschriftung (auf Wunsch kurz, ein Schema, beide Knöpfe auf einer Zeile auch auf dem Handy): "Gerät in HA öffnen" / "Integration in HA öffnen" (EN "Open device in HA" / "Open integration in HA"), `.q-t` mit Auslassungspunkten erst unter etwa 350 px. Pfad der Seite nach dem HA-Frontend, nicht in einer echten HA-Instanz geprüft.
- (view-v3 ist in 2.87.0 umgesetzt, mit "Speichern".)

## Stand (2.83.0, Gerätetyp "Display")

- Wunsch des Nutzers (Screenshot Büro Display, Typ "Sonstiges"): die Typen kommen vom Panel (`const.DEVICE_TYPES`, Erkennung in `devices.device_type`), nicht von HA. Neu: "display" nach "media" (Backend, `TYPE_ORDER`/`TYPE_ICONS`/`typeDisplay` im Panel, `strings.json` + Übersetzungen, Simulator). Ohne automatische Erkennung (ESPHome-Displays haben `number`/`select`/`light`/`switch`, kein sicheres Merkmal); Wahl von Hand am Gerät oder pro Integration. Tests: `test_translations` (Panel gleich Backend), `test_type_integration`.
- Ebenfalls in 2.83.0 (Wunsch des Nutzers, Screenshot der Kachel "Gerade ausgefallen" mit "Keine Warnungen" darunter, Entscheid: Zeile ausblenden): `_heroHtml` zeigt `warnLine` in der Ausfall-Kachel nur noch mit Warnungen; bei allen Geräten online bleibt "Keine Warnungen". Grund: `devWarn` zählt nur Geräte, die online sind.

## Stand (2.82.0, Link zum Gerät kopieren)

- Wunsch des Nutzers (Screenshot Reiter Entitäten): ganz unten ein kopierbarer Link, der direkt zu dieser Geräteansicht führt, automatisch zusammengesetzt. Entscheide: nur im Reiter Entitäten, Adresse des Browsers; Frage, ob es in der App geht: zusätzlich "App-Link kopieren". Keine Mockups (Aufbau wie die Entitätenliste).
- `device-panel.js`: `_deviceLink(id, kind)` (web: `top.location.origin` + `/device-panel?device=<id>`, app: `homeassistant://navigate/...`), `_deviceLinksHtml(d)` am Ende des Reiters "ent", `_copyLink` (Action `copy-link`, `_copyText`, Häkchen). Klasse `dl-row`/`dl-list` (nicht `lnk`: die gibt es schon als Link-Knopf). Die URL wird bei jedem Zeichnen und beim Kopieren neu gebildet.
- Nicht geprüft: ob die Companion-App den App-Link öffnet (nur nach Dokumentation aufgebaut) und ob ein https-Link in der App oder im Browser aufgeht; Letzteres hängt vom Handy ab.
- Suite `devlink` (Abschnitt, Adressen, Zwischenablage, Tastatur, Deep-Link öffnet dasselbe Gerät).

## Stand (2.81.0, Knopf "Home Assistant neu starten" im Launcher)

- Wunsch des Nutzers (Screenshot des Launchers): oben ein Neustart-Knopf mit Bestätigung. Entscheide des Nutzers: Platz links neben "Bearbeiten", eigenes Rückfragefenster im Panel-Stil, nur Administratoren. Keine Mockups (Aufbau von Nutzer benannt, Knopf wie `.ap-x`).
- `apps.js`: `.ap-pw` in der Kopfzeile (nur `_admin()` und nicht im Bearbeiten-Modus), `data-ap="restart"` fragt über `host._askConfirm`; `device-panel.js`: `_askDiscard` ist jetzt ein Sonderfall von `_askConfirm(keys, onYes)` (dasselbe Fenster `discard-dlg`, Fokus auf der sicheren Antwort), `_restartHa()` ruft `homeassistant.restart` über `_callService`; Verbindungsabbruch ist kein Fehler (`isConnectionError`), Ablehnung durch HA erscheint als Snack. Das Recht prüft HA (`async_register_admin_service`), das Panel blendet den Knopf nur aus. Die Einstellungen haben weiter ihren eigenen Neustart-Knopf mit `window.confirm` (Versionszeile), unverändert.
- Suite `restart` (Rückfrage, Abbrechen, Escape, Bestätigen genau ein Aufruf, Fehler, Verbindungsabbruch, Bearbeiten-Modus, Nicht-Administrator).

## Stand (2.80.0, Routinen setzen Zahlen und Auswahlen, 45-s-Zeitlimit)

- Wunsch des Nutzers (Display mit `number.*_uhr_helligkeit`): Routinen sollen `number` und `select` setzen, beides auch im Reiter "Schalter"; hängende Befehle enden nach fest 45 s, ohne Einstellung. Entscheidungen des Nutzers, keine Mockups. Kein `button`.
- Backend (`routines.py`): SERVICES `number.set_value`/`select.select_option`, Aktion `set` (Optionen `value` bzw. `option`, geprüft in `clean_options`/`validate_options` gegen `option_specs`), Zurück nur `restore` (`can_back`, `restore_calls` für number/select), `CALL_TIMEOUT_S = 45` um jeden Dienstaufruf (`asyncio.timeout`; Grund `timeout`). HA führt den abgebrochenen Dienst weiter aus. Texte in `push.py` (`routine_text_set`, `routine_res_set`, `routine_reason_timeout`).
- Panel: `routines.js` (`initSet`, `setValid`, `setValueHtml`, Handler `setnum`/`setopt`), `routine-trigger.js` (Hinweis statt Zurück-Reiter), `DOMAIN_EMOJI` mit number/select (Reiter "Schalter" listet sie über dieses Verzeichnis). Suiten `routineset`, `switchesnum`; Simulator prüft `set`.
- Fehler aus Video des Nutzers (Status-App, Reiterkapsel springt hin und her): `_initSeg` startete bei einem Neuzeichnen innerhalb von 500 ms wieder am ursprünglichen Ausgang. Jetzt wird die Lage der fahrenden Kapsel Bild für Bild mitgeschrieben (`live`) und das Neuzeichnen setzt dort an. Suite `segjump` (alt: 5 Rückschritte, neu: 0).
- Risiko: Geräte mit sehr vielen number-Entitäten (ESPHome-Display) füllen den Reiter "Schalter" (Konfig-Kategorie steht am Ende).

## Stand (2.79.0, "Alle Routinen pausieren" im Fenster "Routinen")

- Wunsch des Nutzers (Screenshot des Fensters, Satz abgebrochen: "Ganz oben am besten:"): die Einstellung "Alle Routinen pausieren" auch in der Routinen-Übersicht spiegeln, ganz oben. Umgesetzt als Schalter über dem Hinweis (`routines.js` `pauseHtml`, nur im Fenster, `all.dlg`), mit Warnhinweis bei Pause; sofort gespeichert (`set_options` `routines_pause`, `device-panel.js` `_rtAllPause`), kein Entwurf. Der Nutzer hat nur "ganz oben" gesagt: die Gestalt (Schalterzeile mit Satz) ist meine Wahl nach dem Muster der Einstellungen, keine Mockups.
- Backend: `ws_routine_list` liefert `paused` (`options_api.effective`). Test in `test_routines`, Suite `routineall` (Reihenfolge, sofort gespeichert, Neuöffnen, Fehlerfall). Simulator `routine_list` mit `paused`.
- Fehler dabei gefunden: der verzögerte "close"-Hörer von `dialog.rtall-dlg` (wie schon bei `mgall-dlg`) löschte den Stand eines inzwischen neu geöffneten Fensters; er löscht nur noch bei geschlossenem Fenster.

## Stand (2.78.0, Abweichungen am Ende der Reiter Laden und Empfang)

- Wunsch des Nutzers (Screenshots Laden und Batterie): im Reiter Laden sieht man nicht, auf welchen Geräten ein Override besteht; einheitlich "immer am Schluss ein Abschnitt Abweichungen pro Integration und Gerät" (Ausnahme Neue Geräte). Keine Mockups: der Aufbau ist der des Reiters Batterie.
- Bestand vorher: Ausfall (Kasten + `offline` + `notify`) und Batterie hatten ihn, Neu nur den Kasten (es gibt keine Werte pro Gerät), Empfang nur die Geräteliste ohne Kasten, Laden nichts. Jetzt: `_integDiffBox(d, "charge" | "sig")` (`_integItems` liefert `chg`), `_overridesHtml("charge")`, Laden ruft beides am Ende auf (auch bei ausgeschalteter Lademeldung, nach der Liste "Pro Integration"), Empfang den Kasten vor der Geräteliste. Updates unverändert: die Listen dort (`updates_exclude`/`updates_include`) sind die Einstellung selbst, keine Werte pro Gerät.
- Backend: `devices.py` `CHARGE_SETTING_KEYS`, `async_device_overrides` liefert `charge` (je Gerät ein Wörterbuch `on/full/rise/stall/stop/live`), `async_reset_device_settings(..., charge)` nimmt alle sechs Schlüssel zurück und zählt je Gerät einmal; WebSocket `reset_device_settings` hat `charge`. Panel: `st.resets.charge`, `reset_charge` in `MON_TAB_KEYS.charge` und `SUB_TAB_KEYS.devset`, `_chargeOwnText`, Zeilenklasse `.ovr-row.long` (Wert unter dem Namen), Liste auch unter Geräte-Einstellungen und im Detail einer Integration, Übersicht zählt `overrides.charge`.
- Tests: neue Suite `chargediff-e2e`, `test_overrides` (neuer Test, `charge` in den Antworten), `test_availability`, Simulator (`overrides().charge`, Reset).

## Stand (2.77.0, Mindestdauer je Art, Empfänger als eigener Abschnitt)

- Wunsch des Nutzers: je Position (CPU, RAM, Festplatte) eine eigene Mindestdauer, "die Anforderungen sind ganz unterschiedlich". Optionen `status_cpu_minutes`, `status_ram_minutes`, `status_disk_minutes` (1 bis 60, Standard 3, `const.py` `INT_RANGES`); `status.py` `LOAD_KINDS` trägt als dritten Wert den Schlüssel, `_check_load` liest `hold` je Art. Die gemeinsame `status_load_minutes` (2.74.0, mit 2.75.0 veröffentlicht) entfällt; `__init__._migrate_options` übernimmt sie beim Start einmal für alle drei Arten (`setdefault`, eine schon gesetzte eigene bleibt) und löscht sie (`LEGACY_STATUS_LOAD_MINUTES`).
- Panel: `status-ui.js` `minutesKey(kind)`, `minutesBad(kind)`; je Art eine zweite Zeile `.opt-line.st-min` im selben Block (Kästchen rechtsbündig mit dem der Grenze, `st-pad`), `data-st-minutes="<kind>"`. Der Hinweis `stLoadShort` ist ein fester Text ohne Zahl.
- Empfänger: Antwort des Nutzers "oke das passt" auf die Empfehlung: eigener Abschnitt `stTargetTitle` "Empfänger der Meldungen" ganz oben (`configHtml`), darunter "Meldung bei Stillstand" nur mit dem Schalter. Keine Backend-Änderung.
- Geräte ohne aktivierte Entität (zum Beispiel reiner Bluetooth-Proxy): Antwort "wir lassen es so", keine Änderung und kein README-Hinweis.
- Tests: `statusload-e2e` (je Art Mindestdauer, Fehler im Block, Speichern von drei Werten, Reihenfolge der Abschnitte), `test_status` (je Art, Migration), `test_update_check`, Simulator.

## Stand (2.76.0, Status-App nicht mehr ausblendbar)

- Wunsch des Nutzers (Screenshot der Bearbeiten-Liste): Status wie das Protokoll mit Schloss statt Auge, weil dort die Einstellungen der Meldungen liegen; verschieben und als Favorit geht weiter. Routinen und Magic Push bleiben ausblendbar, standardmässig sichtbar. `apps.js`: `status` mit `locked: true` (`isHidden` ignoriert die Angabe in `hidden`, ein früher Ausgeblendeter ist wieder da); Hinweis am Schloss je App `appsLocked_<id>` (`appsLocked_log`, `appsLocked_status`). Test in `launcher-e2e`.
- Der Screenshot des Nutzers zeigte noch "Läuft das Panel?" unter Status: das ist der Stand vor 2.74.0 (zwischengespeicherte Seite, die Unterzeile entfällt seit 2.74.0).

## Stand (2.75.0, Magic Push als eigene App mit eigenem Fenster)

- Wunsch des Nutzers (Screenshot der Einstellungen, Reiter "Magic Push"): der ganze Teil raus aus den Einstellungen, eigene App wie Protokoll oder Status, mit eigenem, eigenständigem Pop-up wie bei den Routinen ("sind keine Einstellungen"). Keine Mockups: der Nutzer nannte das Muster selbst (Fenster "Alle Routinen").
- Neu `dialog.mgall-dlg` in `device-panel.js`: `_openMagicAll/_closeMagicAll/_renderMagicAllFrame/_renderMagicAll/_loadMagicAll/_bindMagicAll/_magicAllAction/_mgAllStale`, Stand `this._mgAll` (`dlg: true`, `query`), Rumpf `[data-mga-body]`, Aktionen `data-mga="magic-…"`, Suche `data-lsearch="magic"` mit `data-mga-clear`, Schliessen `data-mga-close`. Der "close"-Hörer setzt `_mgAll` nur zurück, wenn das Fenster nicht schon wieder offen ist (das Ereignis kommt verzögert). `magic-push.js` `overviewHtml` und Verwandte lesen die Suche aus `all.query`; `standalone` meldet Fehler an `host._mgAll`. App `magic` in `apps.js` ruft `_openMagicAll()`. Nach dem Schliessen eines Geräte-Popups lädt `_loadMagicAll()` (ohne Wirkung, wenn das Fenster zu ist).
- Aus den Einstellungen entfernt: Reiter `magic` (`MON_TAB_KEYS`, Reiterliste, `_monMagicHtml`), `st.magicAll`, Suche `search.magic`, Hörer. Die Reiterleiste hat acht Reiter (Desktop vier Spalten, Handy ebenfalls vier, siehe `styles.js` `nth-child(8)`). `_openSettings(tab)` behält den Parameter, nichts ruft ihn mehr mit einem Reiter auf. CSS: `mgall-dlg` überall neben `rtall-dlg`.
- Tests: `magicall-e2e` neu auf das Fenster (acht Reiter in den Einstellungen, Fenster ohne Plus, übrige Prüfungen wie zuvor), `launcher-e2e` (Magic Push öffnet das Fenster). `readme-shots.mjs` nimmt `magic-all` statt `settings-magic` auf. In dieser Sitzung lief Chromium nur mit `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Offen, vom Nutzer zu entscheiden: Empfänger der Status-Meldungen (Empfehlung: eigener Abschnitt "Empfänger der Meldungen" oben, ohne Backend-Änderung); Geräte ohne aktivierte Entität (zum Beispiel reiner Bluetooth-Proxy) werden nicht gelistet (Hinweis in die README oder Anzeige "nicht überwachbar").

## Stand (2.74.0, Korrekturen aus dem Prüfbericht)

- Prüfbericht (gesamtes Repository) und Freigabe des Nutzers: W1 `routines.py` `_async_process` misst die Verspätung ab dem Start der Verarbeitung (`queued`), nicht erst nach der Sperre (kein Zeitlimit um den Schaltbefehl, Entscheid des Nutzers); W2 doppelter Schlüssel `integNone` (Liste: `integNoneList`); W3 `status.py` Uhrzeit mit `dt_util.now()`. Push: `push.async_push` wiederholt bei vorübergehenden Fehlern einmal mit denselben Zusatzdaten (`RETRY_DELAY_S`), nur bei `_REJECTED` (Prüffehler) gleich ohne. Status-Fenster fragt nicht ab, solange das Dokument verdeckt ist. `pytest.ini`: `error::DeprecationWarning:custom_components`. Entfernt: 14 ungenutzte Texte (u. a. `app_status_sub`: die Bearbeiten-Liste im Launcher zeigt bei "Status" keine Unterzeile), `level_of`, `recent`, `LIST_OPTIONS`, `CATEGORIES`, `WS_TYPE_LIST_DEVICES`, `ROUTINES_CATCH_UP_CHOICES`, `DOMAINS`. Danach auf Wunsch des Nutzers (Protokoll: CPU-Meldungen, aber 100-%-Spitze nicht auf der Kurve): `system_stats.thin_peaks` (je Abschnitt der höchste Wert statt Mittel, nur CPU/RAM; `thin` mittelte, "Spitze" nahm Rohwerte) und Option `status_load_minutes` (1 bis 60, Standard 3; Zahl der Prüfungen in Folge, ersetzt die feste `LOAD_HOLD`; eine Zeile "Mindestdauer" in `loadHtml`, `MINUTES_KEY`, `intBad`). Bewusst nicht gemacht (Empfehlung "Lassen"): teilweise gescheitertes Einrichten, Favicon-Abruf im eigenen Netz; optional offen: Lint-Kleinigkeiten (`asyncio.TimeoutError`, `zip` ohne `strict`). Tests: `tests/test_audit_fixes.py` (7), Suite `launcher` (Unterzeile).

## Stand (2.74.0, "Ausführen" im Fenster "Alle Routinen")

- Wunsch des Nutzers (Screenshot der Übersicht): pro Routine "Ausführen". Seit 2.24.1 war es dort bewusst weggelassen; jetzt `routines.js` `overviewCardHtml` immer mit `routine-run`, im Fenster `data-rta`. `device-panel.js` `_rtAllRun` (wie `_rtAllToggle`): `routine_run`, Ergebnis als `all.ran = {id, ok, text}` in der Karte (`[data-rt-ran]`, `.rt-ran`), weil oben in der langen Liste nicht sichtbar; jede andere Aktion setzt `all.ran` zurück; `all.busy` sperrt doppelte Klicks. Handy: `.mg-acts .linkbtn` 7 px seitlich, Herz 10 px Abstand (gemessen: vier Knöpfe auf 390 px DE in einer Zeile, Abstand Löschen-Herz 12 px wie vom Test verlangt). Tests: Suite `routineall` (144).

## Stand (2.73.0, Status-App mit drei Reitern Dienste/System/Einstellungen)

- Vorschlag des Nutzers, von mir bestätigt: erster Reiter `services` (Teile, `zoneHtml`), zweiter `system` (Kurven, `systemHtml` ohne Überschrift), dritter `settings`. `STATE_TABS` in `status-ui.js`; `open(tab)` setzt den Reiter nur beim frischen Öffnen (sonst bleibt er). Systemwerte (`loadSystem`) nur bei `system` und `settings` (beim Reiterwechsel, beim Öffnen und im 60-s-Takt); `settings` braucht sie für Kandidaten und Quelle. Deep-Link `?app=status&tab=system` (`push.panel_url(app, tab)`, `_deepLink` in `device-panel.js`): die Meldung bei hoher Auslastung in `status.py` nutzt es, die bei Stillstand nicht. Offene Idee, nicht umgesetzt: ein Punkt am Reiter "System", wenn eine Grenze überschritten ist (heute zeigt der erste Reiter und der rote Punkt am Launcher nur die Dienste). Tests: `statustabs` (92), `statussystem` (148, öffnet mit Reiter "System"), `deeplink` (48, neu: `tab=system`), `test_status` (Link).
- Die Zeile "Läuft das Panel?" unter dem Titel entfällt (Wunsch des Nutzers, passt nicht mehr): `stSub` gestrichen, Titel im Kopf mittig zum Symbol (`dialog.status-dlg .dlg-title` in `styles.js`). Die Kachel im Launcher trägt den Satz noch (`app_status_sub`), bewusst nicht geändert.

## Stand (2.72.0, Status-App mit Reitern Zustand/Einstellungen und Speichern)

- Wunsch des Nutzers: alle Einstellungen der Status-App (Meldung bei Stillstand, bei hoher Auslastung, Quelle der Werte) in einen zweiten Reiter "Einstellungen", dort immer mit Speichern. Keine Mockups (Nutzer hat Aufbau und Reiter selbst genannt; das Muster ist das des Panel-Fensters Einstellungen: Zähler, Speichern, Schliessen). `status-ui.js`: `this.draft` (nur geänderte Optionen, Grenzen als getippter Text), `val(key)`, `setDraft`, `limitBad`, `saveAll` (ein `set_options`, danach `load` und `loadSystem`), `guard` (Rückfrage über `host._askDiscard` bei Schliessen/Esc/Seite "System Monitor"), `renderFoot` (eigenes `[data-st-foot]` unter dem Körper, damit Tippen in einer Grenze die Leiste nachführt, ohne das Feld neu zu zeichnen), `tabsHtml` (`.sub-tabs`, `data-st-tab`, `_initSeg`-Schlüssel `st-tab`, Punkt `chg` am Reiter Einstellungen im Reiter Zustand). Reiter beim frischen Öffnen immer "Zustand". Nicht gespeichert wird beim Schliessen nichts. Tests: Suite `statustabs` (84, neu); `status`, `statusload`, `statussystem` angepasst (Entwurf, dann Speichern).

## Stand (2.71.0, Meldung bei hoher Auslastung, Pille am Launcher)

- Wunsch des Nutzers: Push bei hoher CPU/RAM/Festplatte, Grenze frei, Standard 99 % und an. `status.py`: `_check_load` (jede Minute im Takt des Wächters), `LOAD_HOLD` 3 Prüfungen über der Grenze, `LOAD_CLEAR` 2 darunter, `LOAD_MARGIN` 2 Punkte; `_async_notify_load` mit tag `device_panel_status_load_<art>` (Entwarnung ersetzt), Ziel wie die Stillstandsmeldung (`notify_target(opts, "status")`), Link `?app=status`. Wert über `system_stats.current_percent` (gleicher Sensor wie die Karte, Gigabyte mit Gesamtgrösse in Prozent). Optionen `status_<art>_alert` (bool, True) und `status_<art>_limit` (int 99, Bereich 1 bis 100 in `INT_RANGES.update` in `const.py`). Panel: `loadHtml()` in `status-ui.js` (Eingabe `.opt-input` mit Prozent, Schalter, Fehler am Feld, `saveLimit`; `render(force)` wegen des Fokus). Nicht persistiert: eine offene Meldung wird nach HA-Neustart erneut gesendet. Tests: fünf in `tests/test_status.py`, Suite `statusload` (32).
- Pille "Debug"/"Störung" an der Launcher-Kachel (Screenshot des Nutzers): `.ap-badge` oben mittig, Kachel oben 18 px Polster (`styles.js`); Prüfung in Suite `status` (Geometrie: Pille endet über dem Symbol).

## Stand (2.70.1, Einschalten mit Rückfrage, "pending", Verlauf bleibt)

- Nutzer drückte "Sensoren einschalten", obwohl schon Werte da waren: die Karte meldete danach "existiert nicht mehr" (neuer Sensor ohne Zustand bis zum Neuladen der Integration, 30 s `RELOAD_AFTER_UPDATE_DELAY` in `config_entries.py` geprüft) und die Kurve war leer (Prozent-Sensor hat erst ab jetzt Werte). Behoben: `auto_entity` bevorzugt Sensoren mit Zustand; `pending`/`off`/`missing` getrennt (`missing` nur ohne Registry-Eintrag); `_longer_history` rechnet den längeren Verlauf von "belegt" in Prozent um; im Panel Rückfrage `data-st-enable-ask` → `data-st-enable` mit Liste, Folgen und Rückgängig-Hinweis. Tests: `test_freshly_enabled_sensor_does_not_replace_a_working_one`, `test_new_percent_sensor_keeps_the_longer_history_of_used`, `test_own_choice_switched_off_in_ha_is_reported`; Suite `statussystem` (132).

## Stand (2.70.0, System-Sensoren finden, Auswahl mit Suche, Zeitstrahl)

- Befund vom Nutzer (Screenshot, Entitäten `sensor.system_monitor_arbeitsspeicherauslastung`, `sensor.system_monitor_belegter_massenspeicher`): CPU und RAM wurden gefunden, die Festplatte nicht, weil System Monitor "Massenspeicher-Auslastung" (Prozent) ausgeschaltet anlegt und nur "belegt" (GiB) an war; die Auswahl zeigte die Sensoren nicht (Liste bei 200 abgeschnitten, nur Prozent-Sensoren). Im HA-Quellcode geprüft: alle System-Monitor-Sensoren sind standardmässig aus (`legacy_enabled`), Namen sind übersetzt (unique_id ist der Schlüssel: `disk_use_percent`, `disk_use`, `disk_free`, Anhang = Pfad).
- `system_stats.py` neu geschrieben: Quellen mit Ausschlussanfang, `disk_group`, `_total_of` (belegt + frei bzw. Supervisor "gesamt"), Modus `percent` (auch aus Gigabyte gerechnet, `_percent_of`) oder `absolute` (`_plain`, `axis_max` aus `_axis_max`), `disabled_sources`, WebSocket `status_system_enable`, `integrations`. Auswahl: `candidates` mit `unit` und `pref` (naheliegende zuerst).
- Panel `status-ui.js`: Auswahl mit Suchfeld (`data-st-pick`, `data-st-pickq`, `data-st-choose`, Muster der Suchfelder mit `_fieldClearHtml`), höchstens 60 Einträge (`PICK_MAX`), Knopf "Sensoren einschalten" (`data-st-enable`), "System Monitor hinzufügen" (`data-st-add`, `host._navigate`), Zeitstrahl über `host._ticks` (Modi 24h, 30d, 180d, 365d). Tests: `test_system_stats.py` (16), Suite `statussystem` (120).
- Offen/Annahme: nach dem Einschalten lädt HA die Integration nach etwa 30 Sekunden neu (`RELOAD_AFTER_UPDATE_DELAY`); die App fragt nach 45 Sekunden nochmals. Nicht an einer echten Instanz geprüft.

## Stand (2.69.0, Festplatte auch in Gigabyte)

- Wunsch des Nutzers: Prozent und Gigabyte. `system_stats.disk_size`: aus dem Prozent-Sensor von System Monitor (unique_id `disk_use_percent<Anhang>`) die Sensoren `disk_use<Anhang>` und `disk_free<Anhang>` (gleiche Platte, im HA-Quellcode geprüft, Einheit GiB); gesamt = belegt + frei; ab 1024 GiB TiB. Fehlen sie, deaktiviert oder fremder Sensor: `size` None, das Panel zeigt Prozent und einen Hinweis. Panel: `[data-st-size]` in `metricHtml`. Hinweis zur Einheit: GiB (1024³), nicht GB (1000³), so wie HA sie meldet. Tests: `test_disk_size_in_gigabytes`, `test_status_system_carries_the_disk_size`, Suite `statussystem` (60). 2.68.0 ist veröffentlicht (Tag `v2.68.0`).

## Stand (2.68.0, Status-App: System-Grafiken)

- Wunsch des Nutzers: kleine Grafiken von HA im Status, CPU und RAM 24 Std., Festplatte mit 24 Std./30 Tage/6 Monate/1 Jahr. Quelle weiss der Nutzer nicht: automatisch + Auswahl in der App. `system_stats.py`: `auto_entity` (Registry: Plattform `systemmonitor` mit unique_id `processor_use` / `memory_use_percent` / `disk_use_percent`, sonst `hassio` `home_assistant_core_cpu_percent` / `_memory_percent`, geprüft im HA-Quellcode: System Monitor `slugify(key_argument)`, hassio `home_assistant_core_{key}`), `candidates` (Sensoren in % ohne Geräteklasse, mit state_class), Kurven über `battery_history._history/_statistics/held/thin` (ab 30 Tagen Statistik, ab 180 Tagen Tagesmittel). WebSocket `device_panel/status_system` (`range`), Optionen `status_cpu_entity|ram|disk` (leer = automatisch, in `options_api` validiert). Panel: Abschnitt "System" in `status-ui.js` (`metricHtml`, `plotHtml`, `sourceHtml`, Reiterleiste `data-st-range` mit Schlüssel `st-range` in `_initSeg`), alle 60 Sekunden neu. Nicht prüfbar ohne echte Instanz: ob "System Monitor" die Entitäten bei dir anlegt (Disk-Sensor ist je nach Version standardmässig aus).
- Simulator: `status_system` (erfundene Kurven), `__systemNone`, `__systemNoStats`, `__systemFails`. Tests: `tests/test_system_stats.py` (5), Suite `statussystem` (52).
- 2.67.0 hat keinen Tag und ist übersprungen ("Nicht veröffentlicht").

## Stand (2.67.0, keine zweite Auswahl nach Szene oder Gruppe)

- Wunsch des Nutzers (Screenshots: Seite "Was" zeigte die Liste der Szenen/Gruppen noch einmal): `chosenWhat()` in `routines.js` liefert die auf Seite 1 gewählte Szene/Gruppe (nur Anlegen aus dem Fenster aller Routinen, `w.pick && w.pickEnt`). Szene: `steps()` lässt Schritt 1 weg (Seite "Wann" folgt direkt, vier Seiten). Gruppe: Seite 1 zeigt nur die Aktion (Titel `rtQ_1_fixed`, Name `rtStepName_1_fixed`), keine Liste. Beim Bearbeiten (`w.pick` false) bleibt die Liste, der Bearbeiten-Assistent startet bei "Wann". Suiten `routinescene` (80), `searchclear` (Liste per `wiz.pickEnt = ""`).

## Stand (2.66.0, eine Liste mit Filter und Pille; Statusmeldung öffnet die Status-App)

- Wunsch des Nutzers: alle Objekte direkt anzeigen, Filter oben oder Pille. Gebaut: beides. `pickRows()` in `routines.js` liefert Geräte, Gruppen, Szenen einzeln (`kind`); Filterleiste `data-rt="dev-kind"` (Reiterleiste `.sub-tabs`, Zahlen wie im Fenster aller Routinen, nur wenn es Szenen oder Gruppen ohne Gerät gibt); Pille `.mg-kind` (Szene primär, Gruppe grün) statt "N Entitäten". Die Sammelzeilen und `ITEM_ROWS_MAX` (2.65.0) sind weg. Kein Mockup vorab: der Nutzer hatte beide Varianten genannt, Screenshots `tests/panel/output/routinescene-*-0.png`; bei Änderungswunsch Variante anpassen.
- Statusmeldung: `push.panel_url(app="status")` → `/device-panel?app=status`; `_deepLink` in `device-panel.js` öffnet `this._status.open()` (nur Administratoren) und entfernt den Parameter. Test `test_push_opens_the_status_app`, Suite `deeplink`.
- 2.65.0 ist veröffentlicht (Tag `v2.65.0`).

## Stand (2.65.0, Szenen und Gruppen direkt in der Suche des Routinen-Assistenten)

- Wunsch des Nutzers (Screenshot: Suche "grupp" fand nur den Sammeleintrag "Gruppen"): niemand soll die Wörter "Szene" oder "Gruppe" suchen müssen; jede Szene, Gruppe und jeder Helfer soll über den eigenen Namen direkt gefunden werden. `routines.switchable_devices` liefert bei den Sammelstellen `items` [{id, name}] (Name wie auf der Seite "Was", `entity_label`). `devsHtml` in `routines.js`: mit Suchtext je Treffer eine eigene Zeile (`data-id` = Sammelstelle, `data-ent` = Entität, rechts die Art "Szene"/"Gruppe"), höchstens `ITEM_ROWS_MAX` (40) mit Hinweis `rtMoreResults`; ohne Suchtext nur die beiden Sammelzeilen. `w.pickEnt` + `preselect()` setzen die Entität und die Aktion beim "Weiter" (wie das Antippen auf "Was"). Reiter (Geräte/Gruppen/Szenen) bewusst nicht gebaut: der Nutzer wollte lieber die direkte Suche. 2.64.0 ist veröffentlicht (Tag `v2.64.0`), 2.65.0 folgt direkt. Suite `routinescene` (72), Test `test_holders_in_listing_and_websocket`, `test_group_helper_is_found_and_searchable`.

## Stand (2.64.0, Einstellungen prüfen beim Öffnen auf eine neue Version)

- Wunsch des Nutzers: Bei jedem Öffnen der Einstellungen wird frisch nach einer neuen Version gesucht. `_openSettings` ruft `_loadVersion(true, { open: true })` (nicht, wenn gerade `installing` oder `restarting`): `force` umgeht den 6-Stunden-Zwischenspeicher
  (`CACHE_SECONDS`), der Server begrenzt weiter auf einmal pro Minute (`FORCE_MIN_SECONDS`); `open` lädt HACS nicht von sich aus neu (`_refreshHacs` nur auf Knopfdruck) und verwirft `installError` nicht. Das automatische Nachladen von HACS läuft einmal je neu gefundener Version
  (`v.hacsRefreshedFor`, vorher ein Schalter für die ganze Sitzung). Suite `version`: neuer Block 0 (80 Prüfungen). Zwei GitHub-Abfragen je Prüfung (Release und Vorabversionen) bei 60 pro Stunde ohne Anmeldung: Fehler "rate_limit" wird bereits angezeigt.
- Fehler "HTTP 404" im Fenster Release Notes: `update_check.async_release_notes` baute den Tag fest als `v{Version}`; der Nutzer legt Releases teils ohne "v" an (2.63.0). Jetzt werden beide Schreibweisen versucht (Rohdateien CHANGELOG(.de).md und Release-Text). Test `test_tag_without_v_prefix`. Tag-Prüfung vor dem Push: immer Tags UND Releases, mit und ohne "v".

## Stand (2.63.0, Status: Neustart von Hand)

- Wunsch des Nutzers: Knopf "Neu starten" je Teil, kein automatischer Neustart (Risiko doppelter oder verlorener Routinenläufe, verdeckt die Ursache). `StatusWatch.async_restart(key)` in `status.py`: nur bei Teil nicht "ok" und nach `RESTART_COOLDOWN_S` (20 s); hält die Objekte an (rückwärts, sie schreiben ihren Stand),
  baut frische (`_build`; Ausfall-Überwachung = Protokoll und Melder zusammen, der Melder hängt am neuen Protokoll), startet sie und setzt sie in `hass.data` (`RESTART_DATA`). Gelingt der Start nicht, kommen die alten Objekte zurück (Protokolleintrag Fehler). `_restarted[key]` ist die neue Messgrundlage (`_base`), weil ein frisches Objekt noch keinen Takt hat.
  Routinen: der neue Manager holt Fälliges über `async_at_started`/Resync nach (Nachhol-Fenster), sonst "verpasst". WebSocket `device_panel/status_restart` (Administrator). Panel: Knopf und Rückfrage in `status-ui.js` (`ui.confirm`, `ui.busy`, `restart()`, Hinweis `st-flash`). Simulator: `status_restart`, `__statusRestartFails`, `__statusRestarts`.
  Tests: fünf neue in `tests/test_status.py`, Suite `status` (112 Prüfungen).
- X in allen Suchfeldern (Wunsch des Nutzers, überall gleich): `_fieldClearHtml("data-fc", "", text)` neben dem Feld in einem `<label>`; zwei Hörer auf dem Shadow-Root in `device-panel.js` (`input`: Sichtbarkeit; `click`: leeren, `input` auslösen, Fokus). Neue Suchfelder: `type="search"` im `label.list-search` mit diesem Knopf, kein eigener Handler. Suite `searchclear` (18).
- Offen: an einer echten HA-Instanz nicht erprobt (besonders der Neustart der Routinen mit laufenden Aufträgen).

## Stand (2.62.0, App "Status": Wächter für die Teile der Integration)

- Wunsch des Nutzers (Watchdog, Stufe 1 und 2; Stufe 3, externer Ping, bleibt zurückgestellt, bis klar ist, ob er Uptime Kuma oder Healthchecks.io nutzt). Mockups `docs/mockups/status-v1` (Variante A). Entscheide: Name "Status"; nur wenn der Nutzer die App selbst
  mit dem Herz anheftet, steht ein Knopf in der Kopfzeile; Empfänger als Auswahlliste wie bei den Reitern (nicht als Reiterknöpfe wie im Mockup); Punkte: rot = Störung, orange = Debug, am Launcher-Knopf oder, wenn die App angeheftet ist, an ihrem eigenen Knopf (rot vor orange); Pille "Störung" im Launcher wie "Debug".
- Backend `status.py`: `StatusWatch` (Daten `DATA_STATUS`, als Letzter gestartet) prüft jede Minute (`CHECK_INTERVAL`). Teile mit Takt (`TICK_PARTS`: availability 30 s, battery, charge, signal je 60 s) setzen `last_tick` in ihrem Takt (je eine Zeile in `availability.py`, `battery.py`, `charge.py`, `signal_history.py`);
  `classify`: verspätet ab 4 × Takt (mindestens 120 s), steht ab 10 × Takt (mindestens 300 s). Routinen: `RoutineManager.overdue_s(now)` (fällig, aber nicht gelaufen), gemessen ab dem Start des Wächters. Magic Push, Neue Geräte, Updates (`LOADED_PARTS`) sind ereignisgesteuert: nur "geladen".
  Push erst, wenn ein Teil bei zwei Prüfungen hintereinander steht (`_suspect`, gegen Stocken von HA), einmal je Störung (`_alerted`), Entwarnung beim Wiederlaufen; Je Teil derselbe Tag (`device_panel_status_<teil>`): die Entwarnung ersetzt die Meldung. Optionen `status_notify` (bool, Standard an) und `notify_service_status` (Thema "status" in `NOTIFY_TOPICS`, leer = globales Ziel).
  `list_devices` trägt `debug` und `status` (Zahlen); WebSocket `device_panel/status_get` (Administrator). Tests: `tests/test_status.py` (10); die Fixtures von `test_outage_notify.py` und `test_updates.py` schalten `status_notify` aus, weil Tests mit grossen Zeitsprüngen sonst Wächter-Meldungen sehen.
- Panel: `status-ui.js` (`StatusUi`: Fenster `dialog.status-dlg`, Config oben mit `set_options`, Zustand aus `status_get`, alle 10 s neu), Stile `.st-*` und `status-dlg` neben jeder Regel von `rtall-dlg`; `apps.js`: App `status` (admin, `act: "status"`), `dotLevels`, `paintDots`, `_paintLauncherDot` (in `renderBar`), Pillen in `_badge`;
  `device-panel.js`: `_debugOn` und `_statusSum` aus `list_devices`. Simulator: `window.__statusStates` (je Teil "ok", "late", "down"), `__statusSnap`, `__statusSum`; Suite `status` (80 Prüfungen), `launcher` angepasst (Gruppe Device Panel hat drei Apps).
- Offen: nicht an einer echten HA-Instanz geprüft (Toleranzen der Takte, Verhalten nach Ruhezustand); Grenze bleibt, dass ein Stillstand von HA selbst nicht gemeldet werden kann.

## Stand (2.61.0, Routinen: Szenen und Gruppen)

- Wunsch des Nutzers: Beim Anlegen über "Alle Routinen" auch Szenen und Gruppen von Leuchten wählen; Titel "Gerät, Gruppe oder Szene?"; keine Skripte. Umsetzung: Sammelstellen statt Gerät, `device_id` = `@scenes` oder `@groups`
  (`HOLDERS` in `routines.py`; `_DEVICE_RE` lässt sie zu; `is_holder`, `in_holder`, `holder_entity_ids`, `log_device`). Szene = `SERVICES["scene"] = {"activate": ("scene", "turn_on")}`, Aktion `activate` (`ACTIONS`), ohne Gegenteil (`opposite` = None),
  also ohne Zurückschalten und ohne Optionen; Wort "activated" (Push `routine_text_activated`, Protokoll `routine_run_scene`, `routine_run_scene_manual`). Gruppe = schaltbare Entität (nicht Szene) ohne Gerät mit Liste in `entity_id` oder aus der Plattform "group" (`is_group_state`, auch unerreichbar), verhält sich wie die Lampe.
  Alle Szenen stehen bei "Szenen" (`in_holder`), auch die eines Geräts (Hue); sie stehen zusätzlich bei ihrem Gerät (`switchable_entities`). Die Suche in Schritt 0 trifft auch die Namen der Entitäten (`names` in `switchable_devices`), Schritt "Was" hat ab `ENT_SEARCH_MIN` Entitäten ein Suchfeld (`entsHtml`). Pro Sammelstelle keine Grenze von 20 (nur 200 insgesamt). `clean()` prüft bei Sammelstellen die Zugehörigkeit statt des Geräts; Push ohne Gerät öffnet das Panel ohne Gerät und ohne Integrationsbild;
  das Protokoll hat dort `device_id` None. `switchable_devices` hängt `{"id": "@scenes", "name": "", "entities": n, "holder": True}` an (nur wenn nicht leer); das Panel benennt sie (`rtHolderScenes`, `rtHolderGroups`).
  Panel (`routines.js`): `HOLDERS`, `isHolder`; Schritt 0 mit Emoji statt Gerätesymbol, Übersicht mit eigenen Karten nach den Geräten ohne "Gerät öffnen"; `routineEmoji("scene")` = 🎬, aber nicht in `DOMAIN_EMOJI` (der Reiter "Schalter" zeigt keine Szenen).
  Simulator: `HOLDER_ENTS` (`window.__noHolders` blendet sie aus). Tests: `tests/test_routines.py` (vier neue), Suite `routinescene` (48 Prüfungen), `routineadd` angepasst.
- Offen: nicht an einer echten HA-Instanz geprüft (Szenen ohne `unique_id`, Licht-Gruppen aus YAML). Gruppen der alten Art (`group.*`) werden nicht angeboten.

## Stand (2.60.0, App-Launcher als Vollbild auf dem Handy)

- Wunsch des Nutzers: `dialog.apps-dlg` bis 700 px vollflächig (`inset: 0`, ohne Rundung und `clip-path`), Kopf `.ap-head` 12/12/8/16 px, `.ap-x` 38 px: Kreuz 12 px vom oberen und rechten Rand wie bei den anderen Vollbild-Fenstern.
  Das Formular `dialog.app-dlg` bleibt ein Blatt, der Desktop ein Popover. Der Test "Tipp neben das Fenster" gilt nur noch am Desktop, am Handy schliesst das Kreuz.

## Stand (2.59.0, Routinen: eigene Zeit neben den Schnellwahlen)

- Wunsch des Nutzers: Bei den Zeiten des Assistenten, die nur Schnellwahlen hatten, steht ein Feld "oder eigene Zeit" mit Einheit (wie bei "Nach Dauer"/Zurückschalten, die es schon hatten). `routine-trigger.js`:
  Tabelle `FREE` (je Angabe `sel`, Wert im Entwurf, Feld im Entwurf `…Own`, Einheiten, Grenzen, Vorgabe): `hold` und `bhold` (Mindestens so lange erfüllt, Start und Zurück; Sek./Min./Std., 1 s bis `hold_max`),
  `pause` (Min./Std., unter 1 Min. = kleinste Schnellwahl nicht erlaubt, bis `pause_max`), `bmax` (Spätestens nach; Min./Std./Tage, `back_min` bis `back_max`). Methoden `freeHtml`, `freeError`, `pickFree`, `typeFree`
  (Tippen: Kapsel weg, Fehlerzone `ferr-<Schlüssel>` läuft mit; Feld geleert: Vorgabe, ganzes Neuzeichnen), `unitFree`, `freeOk`; `triggerValid`, `backValid`, `draftIncomplete` prüfen mit. `ownHtml` (routines.js) nimmt die Einheiten als Parameter.
  Der Server lässt weiter Pausen ab 10 s zu (`PAUSE_MIN`); die 1 Minute ist eine Grenze des Assistenten. Ein von Hand (API) gespeicherter Wert unter einer Minute steht beim Bearbeiten im Feld und wird als Fehler gezeigt.
  Suite `routinetrigger` (176 Prüfungen).

## Stand (2.58.0, Reiter "Schalter", Kreuz in Vollbild-Fenstern)

- Wunsch des Nutzers, Mockups `docs/mockups/switches-v1`, Entscheid: Variante C (kompakte Kacheln, drei Spalten), Emoji 🕹️ für Schalter und ⚡ für Routinen. Reiter `sw` an zweiter Stelle im Geräte-Popup
  (`device-panel.js`: `_switchEntities(d)` filtert `_detail.data.entities` nach `DOMAIN_EMOJI` aus `routines.js`, `_switchesHtml`), nur wenn das Gerät etwas Schaltbares hat; ist `sw` gewählt und das
  nächste Gerät hat nichts, gilt "Übersicht". Kachel = `<button class="sw-cell" data-dlg="more-info" data-entity=…>`: Der Tipp geht wie bei der Entitätenliste durch `_openMoreInfo`, es gibt keinen
  Schaltbefehl. "an" = Zustand in `SWITCH_ON`; Helligkeit (Lampe) und Position (Rollladen) aus den Attributen von `hass.states`. Simulator: `window.__detailExtra` ergänzt Entitäten je Gerät.
  Suite `switches` (52 Prüfungen).
- Schliessen-Knopf: in Einstellungen, Protokoll und "Alle Routinen" auf dem Handy 6 px höher (`margin-top: -6px`), damit er auf der Höhe des Zahnrad-Knopfs der Übersicht sitzt (12 px vom oberen Rand,
  im Nachbau gemessen); Launcher `.ap-x` bekommt nur den grauen Rand.
- Offene Frage des Nutzers (nicht gebaut): Langer Druck auf eine Kachel. Stand: Tipp = Bedienung von HA, nichts schaltet. Möglich wären Tipp = Umschalten und langer Druck = Bedienung (wie HA-Kacheln),
  was aber das versehentliche Schalten von Schloss und Rollladen erlaubt.

## Stand (2.57.0, Emoji und Text in den Reitern auf dem Desktop, Blitz für Routinen)

- Wunsch des Nutzers: Das Emoji der Reiter im Geräte-Popup steht jetzt in jeder Breite (`.dev-tabs .sub-tab[data-tab=…]::before`), auf dem Desktop vor der Beschriftung, auf dem Handy wie
  bisher nur das Symbol (die Beschriftung nur am gewählten Reiter). Zweizeilige Reiter sind auf dem Desktop ein Raster (Emoji über beide Zeilen). Routinen: ⚡ als Reiter-Emoji, Symbol `flash`
  (Kopfzeile, Launcher, Kopf des Fensters "Alle Routinen") und Titel der Push-Meldung "⚡ Routine: …". Das Symbol `timer` bleibt für die Marke "Ausgefallen nach" (Zeit) in Gebrauch.
- Offen: der Reiter "Schalter" (Mockups `docs/mockups/switches-v1`) ist noch nicht gebaut; der Nutzer hat nur den Blitz für Routinen gewählt, Schalter-Emoji und Anzeige (A/B/C) stehen aus.

## Stand (2.56.0, Kreuz, Herz und Plus wie die Knöpfe der Übersicht)

- Wunsch des Nutzers (Bild vom Handy): `.dlg-close`, `.dlg-fav` (und damit `.dlg-add`) tragen jetzt den Stil von `.gear-btn`: Rand `1px solid var(--dp-divider)`, Fläche `var(--dp-card)`, 42 px,
  auf dem Handy (bis 600 px) 38 px wie die Knöpfe der Kopfzeile. Auf dem Handy liegt das Kreuz 12 px vom rechten Rand, genau wie das Zahnrad (gemessen im Nachbau); auf dem Desktop
  sitzt das Fenster mittig, dort stimmt nur die Grösse. Kein neuer Test: `fav-e2e` prüft den Abstand Herz zum Kreuz (22 px), der gleich blieb.

## Stand (2.55.0, Timer heissen Routinen)

- Wunsch des Nutzers ("Wir nehmen Routinen", keine Überreste): Aus "Timer" wird "Routine", im Text und im Code. Dateien `routines.py`, `routines_ws.py`, `panel/routines.js`,
  `panel/routine-trigger.js`, Klassen `RoutineManager`/`RoutineUi`, WS `device_panel/routine_*` (Feld `routine_id`), CSS `.rt-*`, Attribute `data-rt`/`data-rta`, Texte `rt*`,
  Reiter-Id `routine`, Einstellungs-Abschnitt `routines`, Protokoll-Kategorie `routine`, Push-Tag `device_panel_routine_<id>`. Das Symbol war bis 2.56.0 `timer` (MDI),
  seit 2.57.0 ist Symbol, Reiter-Emoji und Titel der Meldung der Blitz (`flash`, ⚡).
- **Übernahme gespeicherter Daten (je einmal, bleibt im Code, bis die Version breit verteilt ist):** Speicherdatei `device_panel.timers` (Schlüssel `timers`) → `device_panel.routines`
  (`RoutineManager._async_load_stored`, `LEGACY_STORE_KEY`; die neue Datei gewinnt, die alte wird nur übernommen und gelöscht, wenn die neue fehlt); Optionen
  `timers_pause`/`timers_catch_up`/`timers_notify_error`/`notify_service_timers` (`const.RENAMED_OPTIONS`, `__init__._migrate_options` vor allem anderen in `async_setup_entry`);
  Benutzerdaten `device_panel_timer_stars` → `device_panel_routine_stars` (`_loadRtStars`, alter Eintrag wird auf `null` gesetzt) und die Launcher-App `timer` → `routine` in
  `sanitizeApps` (Favoriten, Ausgeblendetes, Reihenfolge). Tests: `test_routines.py` (3 am Ende), Suite `routinelegacy`, `launcher` (Bereinigen).
- Die alten Mockup-Ordner (`docs/mockups/timer-*`) und die Einträge im CHANGELOG bis 2.54.1 behalten den Namen "Timer": Sie beschreiben, was damals galt.
- Die deutschen Texte brauchten die Grammatik von Hand (die Routine, Mehrzahl Routinen, "sie" statt "er"); die Umbenennung selbst lief mit einem Skript, danach wurden die
  deutschen Sätze einzeln geprüft. Wer weitere Texte ergänzt: Reiter, Titel und Zahlen im Plural ("Routinen"), Einzelnes "Routine".

## Stand (2.54.1, Auslöser ohne Fehlermeldung beim Wechsel)

- Beim Wechsel auf "Durch einen Auslöser" fragte `fetchPreview` den Server ohne Bedingung, die Antwort "Bedingungen erwartet" stand als rote Meldung im Fenster. Jetzt überspringt `fetchPreview` die Anfrage, solange `draftIncomplete()` (`routine-trigger.js`: Bedingung fehlt, Wert leer, Zeitfenster ungültig, Zurück-Bedingung fehlt) gilt und leert `pv`/`pvError`. Suite `routinetrigger` prüft beides nach 900 ms.

## Stand (2.54.0, Routine: Auslöser und Zurückschalten per Zeit oder Auslöser)

- Wunsch des Nutzers, Mockups `docs/mockups/timer-trigger-v1`/`v2`, alles nach Empfehlung. **Backend** `routines.py`: `kind: "trigger"` mit `conditions` (Magic-Baum
  `{op, items[leaf|group]}`, wiederverwendet aus `magic.py`: `clean_conditions`, `eval_tree`, `leaf_met`, `condition_text`), `hold_s`, `window {from,to}`,
  `pause_s` (Standard 60, 10 bis 86400), `once_trigger`; Rückschalten `back_kind` (none/duration/time/trigger), `back_s`, `back_time`, `back_conditions`,
  `back_hold_s`, `back_max_s`, `back_mode`. Zustand im Arbeitsspeicher (`_met`, `_end_met`, `_holds`, ein Abo `async_track_state_change_event` über `_retrack`);
  Eintreten nur aus "nicht erfüllt" (`_init_met` setzt die Ausgangslage beim Start/Speichern). Auslösen über `rt["due"]=now` + `_async_process` (nutzt die
  vorhandene Retry-/Verpasst-Logik), Ende über `rt["revert_due"]=now`. Übersprungen wird mit `routine_skip_window`/`_pause`/`_busy` (`activity.py`).
  Sperre eigene Entität in `clean()`. Payload: `reverting`, `waiting_end`, `last_trigger`, `condition_text`, `back_condition_text`, `condition_entities`.
- **Panel**: neue Datei `routine-trigger.js` (per `import()` mit Cache-Buster in `routines.js`, Methoden per `Object.assign` an `RoutineUi`): Bedingungs-Editor,
  Seite "Wann" (Umschalter `whenmode`), Seite "Zurückschalten" (`BACK_STEP = 6`, in `steps()` nach "Wann", nur bei `opposite(action)`). Schreibzonen
  `winerr`, `csum-start/back`, `backsum` in `paintZones`. Wichtig: Das `change`-Ereignis von `c-value` zeichnet nicht neu (sonst ersetzt der Fokuswechsel
  den Knopf unter dem Zeiger und der Klick auf "+" geht verloren).
- Tests: `tests/test_routine_trigger.py` (21), Suite `routinetrigger-e2e` (124 Prüfungen); `routine`, `routineadd`, `routineopts` an die sechs Seiten angepasst.
- Nicht an einer echten Instanz geprüft: das Auslöse-Verhalten mit echten Entitäten; Haltezeiten ("Mindestens so lange") gehen bei einem Neustart verloren
  (nicht gespeichert); Auslöser, die während eines wartenden Zurückschaltens eintreffen, werden übersprungen (`routine_skip_busy`); das Zeitfeld folgt dem
  Zeitformat des Browsers.

## Stand (2.53.0, KI-Bereich abgesetzt)

- Wunsch des Nutzers, Mockups `docs/mockups/ai-frame-v1`, Variante A: `_aiHtml` setzt alles in `.ai-box` (Rahmen, violett getönt) mit Kopfzeile `.ai-head` ("KI-Einschätzung" = `secAiSettings`, rechts die Quelle `st.source`); der frühere Abschnittstitel `<h3>` steht jetzt in der Kopfzeile. Einschätzung (`.ai-card` ohne eigenen Rahmen) und Rückfragen (`.ai-ask` mit gestrichelter Linie oben) liegen innen. Fusszeile zeigt nur noch die Zeit (`aiAt`, vorher `aiBy` mit Quelle). Tests: `ai-e2e` angepasst (Titel, Quelle in der Kopfzeile).

## Stand (2.52.0, Routine: Schaltoptionen und "wie vorher")

- Wunsch des Nutzers nach Mockups `docs/mockups/timer-light-v1` (Variante A, dann als eigene Seite statt Aufklappen in der Karte): Beim Einschalten lässt
  sich einstellen, wie geschaltet wird, und beim Zurückschalten gibt es "Aus" oder "Wie vorher". Standard unverändert (nichts eingestellt = wie zuletzt).
- **Backend** `routines.py`: `SERVICES` um `climate` und `media_player` erweitert; `OPTION_SCHEMAS` (light: `brightness_pct`, `color_temp_kelvin`, `rgb_color`;
  cover: `position`; climate: `temperature`, `hvac_mode`; media_player: `volume_pct`; fan: `percentage`), `clean_options` (Form, nur bei Aktion `on`),
  `option_specs(state)` (was die Entität kann, aus `supported_features`, `supported_color_modes`, `min_/max_temp` und so weiter; im Payload `entity["options"]`),
  `validate_options` (gegen die Fähigkeiten, wenn erreichbar), `actions_for_state` (Klima/Medien: ein/aus als Fähigkeit), `service_calls` (Dienstfolge, bei zwei
  Diensten `CALL_GAP_S` = 1 s Pause), `snapshot_of` / `restore_calls` ("wie vorher"; Szene in `runtime["snapshot"]`, nur wenige Angaben je Art
  `SNAPSHOT_ATTRS`). Routinen-Felder `options` (Standard `{}`) und `back_mode` (`opposite`/`restore`, ohne `back_s` immer `opposite`). `_take_snapshot` behält die
  Szene, solange ein Zurückschalten aussteht. Lässt sich die Szene nicht herstellen (`restore_calls` gibt `None`), gilt das Gegenstück. WS `routine_try` nimmt `options`.
  Texte `routine_res_restored`, `routine_text_restored` in `push.py`.
- **Panel** `routines.js`: neue Seite "Optionen" mit der Nummer 5 (`OPTS_STEP`), in `steps()` zwischen 1 und 2, nur wenn `hasOptions()`; die übrigen Nummern
  blieben. `stepBy`, `setStep`, `canSaveAll`, Schrittanzeige zählen über `steps()`. Vorschau `prevHtml` (Zone `prev`), Regler `.to-range` (Eingabe aktualisiert nur
  Vorschau, Wert und Schnellwahl, damit das Ziehen nicht abreisst; `change` zeichnet neu), Farben `.to-col`, Schnellwahl als Reiterleiste (`data-rt="optq"`,
  `data-group` je Einstellung). Rückstellung `data-rt="bmode"` in Schritt 1 (nur mit Zurückschalten). `sentenceOf` nennt Einstellungen und "wie vorher".
- Tests: `tests/test_routine_options.py` (16), Suite `routineopts-e2e` (126 Prüfungen), Simulator kennt `options`/`back_mode`.
- Nicht an echten Geräten geprüft: die Dienstaufrufe von Klima und Medien (vor allem die 1-Sekunden-Pause und `turn_on` vor `set_temperature`/`volume_set`),
  die Wiederherstellung einer Lampe in den Modi `xy`/`hs`/`rgbww` (nur mit Testwerten), Farbwahl des Browsers auf dem Handy.

## Stand (README neu, ohne Versionswechsel)

- README.md/README.de.md neu geschrieben (Überblick der Funktionen, drei Grafiken zum Meldungsprinzip, rund 44 Bilder je Sprache). Grafiken: `docs/graphics/render.mjs`
  (HTML mit Chromium zu PNG, Texte DE/EN im Skript, Ebenen Allgemein/Integration/Gerät, Ablauf vom Ausfall bis zur Meldung, Ziele je Reiter). Printscreens:
  `tests/panel/readme-shots.mjs` (Fensterbilder als Ausschnitt des Dialogs `shotDlg`, Umgebungsvariablen `SHOTS_OUT/LANGS/MOBILE/ONLY`), danach die genutzten
  Dateien auf 256 Farben bringen (PIL `quantize`) und nach `docs/screenshots/` legen. Aussagen der README nur aus Code/Konzept belegt: "Erst melden nach" gilt nur
  allgemein, Ausgefallen nach, Meldungen, Batterie, Empfang, Laden gelten auf drei Ebenen, Neue Geräte und Updates auf zwei (Integration bzw. App).

## Stand (2.33.1, Favicon für externe Links)

- 2.33.0/2.33.1: Eigene Apps mit externem Link können ihr Favicon als Symbol verwenden. Backend `favicon.py` (WS `device_panel/fetch_favicon`, nur Administratoren):
  HA liest die Seite (`<link rel="icon">`, sonst `/favicon.ico`), 5 s je Abruf, 100 KB, Bildart am Inhalt erkannt (`sniff`), keine Zertifikatsprüfung
  (`verify_ssl=False`, nur ein öffentliches Bild), Fehlercodes `invalid_url`, `unreachable`, `not_found`, `too_large`. Panel `apps.js`: Formular mit
  Reiterleiste `data-set="fsrc"` (Symbol | Favicon), Knopf `data-f-fetch`; die App trägt `favicon` (Data-URI, `isFavicon` prüft Bildart und Länge,
  `sanitizeApps` nur bei `ext`); Batterie-Fenster/KI: `ChargeNotifier.rechargeable` (Lademeldung ODER eigene Ladeanzeige `charging_entity`) steuert "Laden" statt "Wechsel"; `_icon(a, size)` zeigt es statt des Symbols (Launcher, Bearbeiten-Modus, Kopfzeile, Vorschau); seit 2.33.1 in Originalfarben auf weisser Fläche (`.ap-fi`, `.ap-ico:has(> .ap-fi)` ohne blauen Kreis). Suiten `launcherfav`,
  pytest `test_favicon.py`.

## Stand (2.32.0, Debug-Modus über Neustarts)

- 2.32.0: Der Debug-Schalter des Protokolls bleibt 48 Stunden (`activity.DEBUG_HOURS`), auch über Neustarts von HA: Ablaufdatum in `.storage/device_panel.debug`
  (`activity.STORE_KEY`, `{"debug_until": ts|null}`), `activity.async_restore` beim Start (einmal je Start, `log.restored`), Zeitgeber `async_call_later`
  schaltet ihn aus (`debug_expired`), `activity.async_forget` beim Entfernen. WS `get_log`/`set_log` liefern `debug_until`; das Fenster zeigt "· 48 Std." bzw. "· 48 Std., bis …". Routine: `routines.js` (Vorbelegung beim Bearbeiten) lässt `enabled` eines erledigten Routines aus (vorher `rt.done ? true : rt.enabled`), Suite `routinedone`.
  Die Einträge selbst bleiben im Arbeitsspeicher. KI-Einschätzung: `battery_year` nennt bei aktiver Lademeldung `battery_charges`/`recent_charges`
  (`history["charging"]`), der Standard-Prompt (`ai_prompt`) sagt der KI, einen Anstieg Laden zu nennen.

## Stand (2.31.1, App-Launcher)

- 2.31.0 und 2.31.1: App-Launcher (`panel/apps.js`, Klasse `AppLauncher`, Mockups `docs/mockups/launcher-v1`/`launcher-v2`). Knopf `.apps-btn` und Favoriten
  `.app-pin` (Klasse auch `.rtall-btn`) in `.toolbar`; Fenster `dialog.apps-dlg` (Popover unter dem Knopf, am Handy Blatt), Formular `dialog.app-dlg`.
  Stand pro Benutzer: `frontend/set_user_data` unter `device_panel_apps` (`{fav, hidden, order, custom, layout, updated}`, lokale Kopie, neuerer Stand
  gewinnt, `sanitizeApps` prüft alles). Höchstens 5 Favoriten (`MAX_FAV`; Herzen nur im Bearbeiten-Modus, ein Favorit steht nur im Abschnitt Favoriten), am Handy nur der erste in der Kopfzeile (der Strich dazu nur im Bearbeiten-Modus, nicht in der normalen Ansicht). Raster/Liste getrennt für
  Desktop und Handy (`layout.desktop`/`layout.phone`). Protokoll (`locked`) nicht ausblendbar und nur noch hier (Knopf im Kopf der Einstellungen
  entfernt). Externe Links: `<a target="_blank" rel="noopener noreferrer">`, nur https/http (`checkTarget`). Hinweise mit "Rückgängig" erscheinen
  im Fenster (`snack`), weil der Toast der Seite unter dem modalen Fenster liegt. `_openSettings(tab)` nahm den Reiter (bis 2.74.0 Magic Push aus dem
  Launcher, seit 2.75.0 öffnet die App ein eigenes Fenster). Suite `launcher-e2e`; `log`, `busy`, `routineall` angepasst.

## Stand (2.23.1, Auto-Update bei jeder Erkennung)

- 2.23.1: `update_check.async_refresh_issue` stösst bei einer neueren Version `async_auto_install` an (Start, tägliche Prüfung, WS `version`
  beim Öffnen der Einstellungen); `async_auto_install` lädt vorher das HACS-Repository neu (`_async_hacs_refresh`, HACS-Interna
  `hass.data["hacs"].repositories.get_by_full_name(...).update_repository(force=True)`, bestmöglich). Panel: `_loadVersion` installiert bei
  jeder Erkennung, pro Version und Sitzung einmal (`v.autoTried`), mit "Nach Updates suchen" erneut. Nicht geprüft: echtes HACS.

- 2.25.0: Panel-Updates. Optionen `update_check_time` (leer = automatisch, sonst `async_track_time_change`; `async_reschedule_daily` bei Änderung),
  `update_notify` und Reiter-Ziel `panelupdate` (`notify_service_panelupdate`); `update_check.async_notify` (einmal pro Version und Art `found`/`done`,
  gemerkt in `device_panel.panel` unter `notified`, erst nach erfolgreichem Versand). Ohne Auto-Update: Push "verfügbar" bei der Erkennung;
  mit Auto-Update: "installiert" nach `update.install` (bei Fehlschlag "verfügbar"). Roter Punkt am Zahnrad (`.has-dot`, `_gearDot`,
  `_versionDotInit`): `_versionState().restart` (HACS `installed_version` > laufende Version), alle 5 s höchstens neu berechnet.
- 2.23.1 auch: Protokoll-Knopf (`data-set="log"`, Klasse `dlg-close dlg-log`) im Kopf der Einstellungen statt `.log-btn` in der Kopfzeile;
  öffnet `dialog.log-dlg` über den Einstellungen. Suiten `log`, `busy` angepasst.

- 2.23.1 auch: Einstellungen › Routinen zeigt nur noch die Optionen (Sammlung aller Routinen entfernt: `_monRoutinesHtml`, `_loadRoutinesAll`,
  `_routinesAllAction` und `st.routinesAll` weg; nur noch das Fenster `_rtAll`). Fehlermeldung der Routine genau beschrieben
  (`optRoutinesNotifyErrorInfo`): normale Push-Meldung über `push.async_push` (Tag `device_panel_routine_<id>`), nicht anhaltend, nach 3 Versuchen,
  Ziel Routinen-Ziel, sonst `notify_service_routines` (neues Reiter-Ziel `routines` in `NOTIFY_TOPICS`, Zeile "Empfänger" in Einstellungen › Routinen), sonst `notify_service`, bei "none" nur Protokoll `routine_no_target`.

## Davor (2.22.0, Favoriten)

- 2.22.0 (Wunsch des Nutzers): Herz im Kopf des Geräte-Popups (`.dlg-fav`, `data-dlg="fav"`, sofort, ohne Entwurf) und Chip
  "Favoriten" (nur rotes Herz, `bare`-Eintrag in `HINTS` mit `key: "favorites"`, `.chip.hint.fv.bare`, immer sichtbar).
  Favoriten gehören dem Benutzer: IDs in `frontend/set_user_data` unter `device_panel_favorites` (`{ids, updated}`, lokale
  Kopie in localStorage, neuerer Stand gewinnt, wie die Ansicht); `_applyFavs()` setzt `d.fav` auf jedes Gerät (nach
  `list_devices` und jedem Tipp), `_toggleFav(id)`. Chip-Option: `CHIP_KEYS` bekommt `favorites` (hide_chips, Auswahlliste,
  `CHIP_ORDER_KEYS`); Standardfolge `all, pin, favorites, integration, …`; gespeicherte Folgen ohne `favorites` bekommen es
  in `chipOrder()` gleich nach "Alle" und hinter dem Anheft-Marker. Der Chip hat keine Zahl und keinen Text (`aria-label`
  und `title` aus `hintFavorites`). Suite `fav-e2e`; `chiporder`, `hidechips`, `filter`, `integ`, `table` an den neuen
  Chip angepasst, `fixed-e2e` wartet jetzt auf die verschwundene Zeile (war eine Wettlauf-Prüfung). Nicht umgesetzt:
  Herz in der Geräteliste/Kachel, Sortierung nach Favoriten. Auf einem echten Gerät nicht geprüft.

- Auto-Update (ebenfalls 2.22.0): Panel-Einstellung `auto_update` (Store `device_panel.panel`, `set_panel`, mit `prerelease` in
  `st.extra` des Panels, gilt mit "Speichern"; Schalter `data-auto-update` im Abschnitt "Panel-Version" unter
  "Täglich nach Updates suchen", gesperrt ohne tägliche Prüfung). Backend `update_check.async_auto_install(hass)`, aufgerufen
  nach jeder täglichen Prüfung (`_run`): nur wenn `auto_update_active` (Schalter und `update_check`); HACS-Entität über
  die Entity-Registry (`_hacs_update_entity`, Release-Link oder Titel), `homeassistant.update_entity`, dann `update.install`
  (Timeout 300 s), wenn HACS' `latest_version` über der laufenden Version liegt, nicht schon geladen ist (`installed_version`
  über der laufenden) und nicht läuft; Vorabversion nur mit eingeschaltetem "Vorabversionen". Danach Protokoll
  (`auto_update_done`/`_failed`, Kategorie "updates") und Reparatur-Meldung `restart_required` (nicht persistent, verschwindet
  mit dem Neustart). Der Neustart bleibt beim Benutzer. Im Panel installiert `_loadVersion(true)` (Knopf "Nach Updates
  suchen") sofort, wenn `_autoActive()`; das blosse Öffnen der Einstellungen installiert nicht. Tests `test_update_check.py`
  (sechs neue), Suite `autoupdate-e2e`. Nicht geprüft: echtes HACS (Entität, `update.install`-Dauer, Verhalten bei
  Vorabversionen) und der Ablauf über Nacht.

- Routine "Einmal" ohne Datum (2.22.0, Wunsch des Nutzers): `date` darf `None` sein (Standard im Assistenten); `routines.once_at(routine,
  tz, after)` liefert dann das nächste Eintreffen der Uhrzeit (wie täglich), `first_due`/`next_runs` übergeben "jetzt"; Prüfung
  "Vergangenheit" nur mit Datum; Einschalten plant neu. Panel: Schalter `data-rt="date-on"` ("Bestimmtes Datum", aus; an setzt morgen ein und zeigt das Datumsfeld), `whenText` "Einmalig, nächstes Mal um …". Der Schalter geht danach immer aus (wie bei jedem einmaligen Routine).

- Fenster "Alle Routinen" (2.23.0, Wunsch des Nutzers): Blitz (Symbol `flash`, wie der Reiter Routinen; die Glocke gehört Magic Push) `.rtall-btn` in der Kopfzeile, Dialog `dialog.rtall-dlg` (seit 2.28.3 Popup wie das Protokoll auf dem Desktop, bis 700 px Vollbild; vorher immer Vollbild,
  Inhalt max. 860 px). Eigener Zustand `this._rtAll` (`dlg: true`, `query`), nutzt `RoutineUi.overviewHtml/overviewListHtml/overviewCardHtml`
  mit Attribut `data-rta` statt `data-set` (`RoutineUi.a(all, action)`); nur Bearbeiten (Assistent darüber, `ui.open(device, true)`),
  Ein/Aus, Neu starten, Filter, Suche, Falten, "Gerät öffnen"; kein Neuanlegen, Löschen, Ausführen. Laden `_loadTmAll`,
  Aktualisierung nach Assistent/Popup über `closeWizard`, `_resetDevice`, `afterChange`. Suite `routineall-e2e`.

## Davor (2.21.0, Routine)

- 2.21.0 (Wunsch des Nutzers, Mockups `docs/mockups/timer-v1`): Routine, die eine schaltbare Entität eines Geräts einmalig
  (Countdown "In X Min." oder Datum mit Uhrzeit) oder wiederholt (täglich, wöchentlich mit Wochentagen, monatlich) schalten,
  optional mit "danach zurückschalten" und mit Push pro Routine (Schalter, fester Inhalt, Vorschau, Empfänger wählbar,
  Standard = `effective(hass)["notify_service"]`; Push nur, wenn die Routine schaltet).
  **Backend** `routines.py`: Klasse `RoutineManager` (Speicher `.storage/device_panel.routines` mit `routines` und `runtime`; je Routine
  ein `async_track_point_in_utc_time` für min(fällig, Zurückschalten); `asyncio.Lock`; Toleranz = max(`routines_catch_up` * 60,
  90 s), Verpasstes wird übersprungen (wiederholt: nächster Termin, einmalig: erledigt); zwei Wiederholungen nach 300 s;
  Countdown räumt sich nach 86400 s auf; Zeitzone von HA, Sommerzeit über UTC-Rundweg, monatlich fällt auf den letzten
  Tag, `mday = -1` = letzter Tag), `occurrence_after/first_due/next_runs`, `ROUTINE_SCHEMA`, `switchable_entities`,
  `routine_payload`. Befehle in `routines_ws.py` (`device_panel/routine_get|list|save|delete|enable|run|preview|test`).
  Push-Texte in `push.py` (`routine_*`), Protokoll-Kategorie "routine" in `activity.py`. Optionen `routines_pause`,
  `routines_catch_up` (Minuten, 0 bis 60, Standard 10), `routines_notify_error` (Standard an).
  **Panel** `panel/routines.js` (`RoutineUi`, wie `magic-push.js`): Reiter "Routinen" im Popup (Behälter `.rt-root`, `attach(root)`
  nach jedem Neuzeichnen), Assistent in eigenem Fenster `dialog.magic-dlg.routine-dlg` (Magic-Push-CSS `mgw-*`, `mg-*`;
  Schlüssel `data-rt`, in `_initSeg` über `dataset.rt`), Übersicht in den Einstellungen (Abschnitt "routines", `data-set="routine-*"`,
  Suchschlüssel `routines`). Reiterleiste: fünf Reiter, auf dem Handy (bis 600 px) Symbole per `::before`. Simulator
  `tests/panel/sim/ha-sim.html` kennt die Routinen-Befehle; Suite `routine-e2e` (258 Prüfungen), Python `tests/test_routines.py`.
  Offen: Entscheide 1 bis 5 und 7 der Mockup-Fragen sind nach Empfehlung gefallen (siehe `docs/mockups/timer-v1/README.md`),
  Marke "⏱ n" und Chip "Mit Routine" in der Geräteliste fehlen; nichts auf einem echten Gerät und Handy geprüft (vor allem
  das Schalten über einen Neustart, Sommerzeit und die Push-Zustellung).

## Davor (2.20.0, einheitlich speichern)

- 2.20.0 (Wunsch des Nutzers): Geräte-Popup und Zahnrad speichern nur noch mit "Speichern"; Schliessen mit Änderungen
  fragt "Änderungen verwerfen?" (`dialog.discard-dlg`, eigenes modales Fenster, `_askDiscard(onYes)`). Geräte-Entwurf
  `this._devDraft = {id, orig, cur}` (`_devEdit`, `_devChanges`, `_devDiscard`, `_devSave`, `_requestCloseDevice(after)`,
  `_reapplyDevDraft()` nach jedem `list_devices`): Werte werden direkt im Gerät (`this._devices`) gesetzt, `orig` merkt den
  gespeicherten Stand; `_setDeviceType/_setDeviceConnection/_setDeviceSettings` sind nur noch Hüllen um `_devEdit`.
  `_devSave` sendet erst Typ, dann Verbindungsart, dann einen gemeinsamen `set_device_settings`; Fehler stehen beim Wert
  (`_typeError`, `_connError`, `_devSetError`) und der Entwurf bleibt. Bewusst sofort geblieben: Umbenennen, Gerät
  ausblenden, Listenaktionen von Magic Push, "Anpassen", Filter. Neue Suite `savecheck-e2e`; Suiten, die im Popup etwas
  wählen, klicken danach `[data-dlg="save"]`. Auf einem echten Gerät noch nicht geprüft.

## Davor (2.19.0, Live-Aktivität beim Laden)

- 2.19.0 (Wunsch des Nutzers; Entscheide: gleicher Empfänger wie die Lademeldung, 10 Min. "Geladen", iOS und Android, nur
  Prozent, Takt 4 Min., Wegwisch-Ereignis ausgewertet). Option `charge_live` (global, aus), `charge_live_integrations`
  (`bool_map`), Gerät `charge_live` in den Geräte-Einstellungen; Auflösung `devices.charge_live_value` und
  `device_charge_opts()[CONF_CHARGE_LIVE]` (Gerät, Integration, global), unabhängig von `notify_charge`. Ziel:
  `notify_target(opts, "charge")`. Engine in `charge.py` (`ChargeNotifier`): `_live_eval(dev, now)` (aus `_on_state` und
  jede Minute `live_check()`), Zustand `self._live[dev] = {tag, phase active|done|dismissed, at, level, done_at}`, im Store
  `device_panel.charge` unter `live`; Start, wenn geladen wird (`_is_charging`: Ladeanzeige oder Anstieg, ohne Bedingung der
  Lademeldung) und Stand unter "Voll ab"; Updates `silent` höchstens alle `LIVE_INTERVAL` (240 s) und nur bei neuem
  gerundetem Prozentwert; bei "Voll ab" ein Update "Geladen", nach `LIVE_KEEP` (600 s) `clear_notification`; Ende bei
  beendeter Ladung (`check_stalls` merkt "beendet" jetzt auch für Geräte nur mit Live-Aktivität) oder ausgeschaltet.
  Daten: `live_update`, `tag` (`device_panel_live_<Gerät>`, nicht der der Meldung), `progress`, `progress_max` (= "Voll ab"),
  `notification_icon`, `critical_text`, `url`/`clickAction`, `alert_once`, bei Updates `silent`; Versand `push.async_live` und
  `async_live_clear` (nur notify-Dienste, Entitäten können es nicht, kein Wiederholen ohne Daten). Wegwischen:
  `_on_live_event` hört auf `mobile_app_live_activity_dismissed` (iOS, Core-PR #183255, bei Redaktionsschluss offen) und
  `mobile_app_notification_cleared` (Android; ein Ereignis in den 5 s nach unserem Senden gilt als Ersetzen); Tag aus
  `data.tag` oder `data.data.tag`; Phase "dismissed" = für diese Ladung nichts mehr. Bei einer Gruppe als Ziel stoppt das
  ganze Ziel. Tests: `tests/test_charge_live.py`. Offen: auf iPhone und Android prüfen (Start, stilles Update, Wegwischen,
  Gruppe als Ziel).

## Stand davor (2.18.0, eigener Empfänger pro Reiter)

- 2.18.0 (Wunsch des Nutzers, Screenshot "Überwachung und Meldungen"): Optionen `notify_service_outage|battery|charge|new|updates`
  (`const.NOTIFY_TOPICS`), leer = das globale `notify_service`. `options_api.notify_target(opts, topic)` löst auf; die fünf
  Module (`outage`, `battery`, `charge`, `newdevice`, `updates`) und `devices.py` (Push-Flags im Popup) benutzen es statt
  `opts[CONF_NOTIFY_SERVICE]`. `values_from` macht ungültige Werte zu "", `PANEL_SCHEMA` nimmt leer oder `notify.*`, "none"
  wird zu leer. `notify_targets(hass, current, extra)` und WS `get_options` führen eigene Ziele, die es nicht mehr gibt,
  als "missing". Panel: `_hasTarget(d, topic)`, `ui.targetRow(topic)` (Zeile direkt unter "Meldung", Auswahl "Standard (…)" +
  Ziele ohne "Kein Ziel"), Übersicht/Zusammenfassung/Integrationen rechnen je Reiter (`tg`, `tgt`). Magic Push hat sein
  Ziel weiter pro Meldung. Die Live-Aktivität beim Laden (geplant, Version 2.19.0) folgt dem Ziel des Reiters "Laden".
  Tests: `tests/test_notify_topics.py`, `notify-e2e`. 2.17.2 (Schrittbalken) ist nicht veröffentlicht, in 2.18.0 enthalten.

## Stand davor (2.17.1, Magic Push: robuster bei Absturz und Neustart)

- 2.17.1 (Frage des Nutzers zur Neustart-Festigkeit): `_fire` und `_resolve` schreiben mit `_save_now()` sofort
  (`async_save`, nicht mehr nur `async_delay_save(…, 5)`), damit ein Absturz nach dem Senden keine Doppelmeldung auslöst.
  "Ändert sich" mit Dauer: `_pending` enthält jetzt `due` (Zeitpunkt) und liegt im Speicher (Schlüssel `pending`);
  `_restore_pending()` (aus `_resync`, nach dem Start) setzt den Timer neu, meldet sofort bei abgelaufener Dauer und
  verwirft, wenn sich der Wert zurückgeändert hat. Bekannt und bewusst: nach dem Start gilt die Bedingung als
  durchgehend erfüllt, was dazwischen war, weiss HA nicht; die Wartezeit "Zurücksetzen erst nach" liegt nur im Speicher
  und beginnt nach dem Start von vorn. Tests: `tests/test_magic_restart.py`.

## Stand davor (2.17.0, Magic Push: Zurücksetzen erst nach Dauer)

- 2.17.0 (Wunsch des Nutzers, gegen Flattern bei "Automatisch"): Regelfeld `reset_for_s` (0 bis 7 Tage, Vorgabe 0, bei
  "ändert sich" immer 0). Engine (`magic.py`): in `_evaluate` startet bei nicht mehr geltender Bedingung (und nach der
  Meldung) statt `_resolve` einen Timer in `self._rtimers` (`_on_reset_timer`); gilt die Bedingung vorher wieder (oder liegt
  sie in der Zone des Rücksetzwerts), wird er verworfen (`_cancel_reset`), die Episode läuft weiter, nichts wird gemeldet.
  Vor der Meldung gibt es keine Wartezeit. Nicht erreichbar (`None`) setzt nichts zurück. `_cancel` räumt beide Timer.
  Rückblick: `evaluate`/`evaluate_tree` nehmen `reset_for_s` (ein kürzerer Unterbruch bleibt in der Episode), WS
  `magic_history` hat `reset_for_s`. Panel: neuer Block `resetForHtml` in Schritt 2 (`rfor`, `rfor-own`, `rfor-unit`,
  Zone `rforhint`), Entwurf `reset_for_s`/`resetForOwn`, neue Meldungen mit 60 s, `draftFrom` liest den gespeicherten Wert;
  Satz `zurück nach …`. Tests: `tests/test_magic_conditions.py` (Abschnitt "Zurücksetzen erst nach Dauer"), `magic-e2e`.
  2.16.0 (Pop-up, Touch-Ziele) ist nicht veröffentlicht und in 2.17.0 enthalten.

## Stand davor (2.16.0, Magic Push: Rückfrage beim Schliessen als Pop-up)

- 2.16.0 (Wunsch des Nutzers, Screenshot): "Änderungen verwerfen?" steht nicht mehr in `.mgw-foot`, sondern als Pop-up in
  der Mitte des Fensters: `.mgw-ov` (absolut über dem ganzen `dialog.magic-dlg`, abgedunkelt) mit `.mgw-discard` (Karte).
  Kopf, Fortschritt, Inhalt und Fuss tragen dabei `inert`, Fokus auf `discard-no` (`paintWindow`). Test: `magic-e2e`.
  Ebenfalls 2.16.0: Touch-Ziele der Bedingungs-Karten grösser (`.mg-xbtn` 44 px, Pfeil `.mg-lchev`).

## Stand davor (2.15.0, Magic Push: mehrere verknüpfte Bedingungen)

- 2.15.0 (Wunsch des Nutzers, Mockups `docs/mockups/magic-conditions-v1`, Variante "Eine Seite"): Schritte 1 Bedingungen ·
  2 Wie lange · 3 Versand · 4 Text · 5 Name. Regel hat `conditions` = `{"op": "and"|"or", "items": [Blatt | Gruppe]}`,
  Gruppe = `{"op", "items": [Blatt]}` (eine Ebene), Blatt = `{entity_id, kind (above|below|is), value, reset_value}`.
  Gespeichert nur bei mehr als einem Blatt (sonst `None`); das erste Blatt (Tiefensuche) steht zusätzlich in den alten
  Feldern `entity_id/kind/value/reset_value`, damit Altdaten und Einzelregeln unverändert laufen. Grenzen `MAX_LEAVES`
  10, `MAX_GROUPS` 4; "ändert sich" nur als einzige Bedingung.
- Auswertung (`magic.py`): `combine(op, werte)` dreiwertig (AND nach Kleene, OR übergeht `None`), `eval_tree`,
  `leaf_met`, `leaf_hold` (Zone je Blatt über `reset_value`), `has_reset`. Engine: `_retrack` hört auf alle Blatt-
  Entitäten, `_met`/`_held`, Dauer/Wiederholung/"wieder normal" gelten für das Ganze. AND mit `unavailable` → nichts
  passiert. Neue Variable `{conditions}` (`condition_text`, Texte `push.text` `magic_and/or/above/below/is`).
- Rückblick: `magic_history.evaluate_tree` rechnet in Zeitscheiben über alle Entitäten (Spannen je Blatt plus kombinierte
  Intervalle und Auslösungen); WS `magic_history` nimmt optional `conditions`, Antwort enthält `leaves`.
  `rule_payload` liefert immer einen Baum (`rule_tree`) und `condition_text`; `magic_list` hat `leaf_entities`.
- Panel (`magic-push.js`): Entwurf `draft.conds` (Baum mit nur im Panel gültigen `uid`), `syncPrimary()` spiegelt das erste
  Blatt in `d.entity_id/kind/…`; `w.cur` offenes Blatt (nur eines gleichzeitig), `w.adding` Hinzufügen. Seite 1:
  `pickerHtml` (leer) / `condListHtml` mit `leafHtml`, `groupHtml`, `leafEditorHtml`; Seite 2: `step2Html` mit
  `reviewChartHtml`/`timelinesHtml`. Rückblick Seite 1 je Blatt (`requestLeafHistory`, for_s 0), Seite 2 kombiniert
  (`requestHistory`). Seg-Kapseln der Gruppen brauchen `data-mg` plus `data-group=uid`.
- Tests: `tests/test_magic_conditions.py` (pytest), `magic-cond-e2e.mjs`, angepasst `magic-e2e.mjs`, `magicall-e2e.mjs`;
  Simulator versteht `conditions`. Offen: auf echtem iPhone prüfen. 2.14.0 und 2.13.1 sind nicht veröffentlicht und in
  2.15.0 enthalten.

## Stand davor (2.14.0, Magic Push: Vorschau unter jeder Nachricht)

- 2.14.0 (Wunsch des Nutzers): Schritt 4 hat zwei Vorschau-Zonen: `[data-mg-zone="pv"]` (`pvHtml("main")`) direkt unter
  Titel/Inhalt/Variablen und `[data-mg-zone="pvr"]` (`pvHtml("recover")`) am Ende von `recoverHtml()`, jede mit eigenem
  "Test senden". Schritt 5 zeigt beide zusammen (`pvHtml()` ohne Argument). `paintZones` kennt `pvr`; auf dem Desktop
  bleiben die Vorschauen in Schritt 4 im Fluss (nicht in `.mgw-side`), in Schritt 5 stehen sie rechts. 2.13.1 (Tastatur)
  ist nicht veröffentlicht und in 2.14.0 enthalten.

## Stand davor (2.13.1, Magic Push: Tastatur im Assistenten-Fenster)

- 2.13.1 (gemeldet: "Freie Entität wählen" scrollt zu weit): `scrollIntoView` im Fenster schob das Suchfeld über den
  oberen Rand der sichtbaren Fläche, weil das Handy die Seite (visualViewport) schon hochgeschoben hatte. Jetzt:
  `MagicPush.visibleArea()` (visualViewport des obersten Fensters minus Abstand des iframes), `fitWindow()` (Fenster nur so
  hoch wie die sichtbare Fläche, CSS `--mgw-top`/`--mgw-h`, ≤ 700 px), `watchViewport()` (resize/scroll), `revealField`
  scrollt nur den Inhalt (`scrollParent`) und stellt das Feld oben in die sichtbare Fläche. Test: `magic-e2e` simuliert
  die Tastatur mit einem Ersatz für `_topWindow().visualViewport` (unten und hochgeschoben). Offen: auf echtem iPhone
  prüfen; verhält sich die Companion-App anders (kein visualViewport-Ereignis), hilft nur die Lage des Feldes.

## Stand davor (2.13.0, Magic Push: Übersicht mit Gerätekarten, Suche, Filter)

- 2.13.0 (Entscheid des Nutzers: Variante B, keine wählbare Gruppierung; Mockups `docs/mockups/magic-overview-v1`):
  `MagicPush.overviewHtml` zeichnet Suchfeld (`data-lsearch="magic"`, Text in `_settings.search.magic`), Filter
  (`.mg-filter`, Aktionen `data-set="magic-filter"`) und die Zone `[data-mg-all-zone]` (`overviewListHtml`: Zahl, "Alle
  einklappen", Karten `.mg-dcard` mit Kopf `.mg-dhead`, Zeilen `.mg-card`, Fuss "Gerät öffnen"). Zustand in
  `_settings.magicAll`: `filter`, `open` (zu/offen ohne Filter; Standard: offen bis 3 Geräte), `sopen` (mit Filter,
  Standard offen, beginnt bei neuer Suche/neuem Filter neu). Suche: `_applyListSearch` zeichnet nur die Zone neu, wenn
  sich der Suchtext (`data-q`) ändert; Fokus und Cursor überstehen einen Neuaufbau (`refocus`, `lsearch`). Filter
  "Ausgelöst" = eingeschaltet und `active`. Tests: `magicall-e2e` (Suche, Filter, Falten, viele Geräte).

## Stand davor (2.12.0, Magic Push: Schrittfolge Versand vor Text)

- 2.12.0 (Wunsch des Nutzers): Schritte des Assistenten: 1 Wert, 2 Wann, 3 Versand (`step3Html`: Empfänger, kritisch +
  Lautstärke, Wiederholen; bei "ändert sich" nur Empfänger/kritisch und Hinweis), 4 Text (`step4Html`: Titel, Inhalt,
  Variablen, "wieder normal" mit eigenem Titel/Inhalt in `recoverHtml()`, Vorschau-Zone, Test), 5 Name. `canNext`: Schritt 3
  `!repeatError()`, Schritt 4 Titel gefüllt und (bei "wieder normal") dessen Titel gefüllt. Vorschau wird erst ab Schritt 4
  geholt (`requestPreview`, `goto`); `syncDefaults` ab Schritt 3. `pvHtml`: Test nur in Schritt 4 (`w.step === 4`). Strings
  `mgStepName_3/4`, `mgQ_3/4` getauscht. Tests: `magic-e2e` (488), `magicall-e2e` (120).

## Stand davor (2.11.0, Magic Push: Assistent im eigenen Fenster)

- 2.11.0 (Entscheid des Nutzers: Variante A, Vollbild auf dem Handy; Rest nach Empfehlung, Mockups
  `docs/mockups/magic-push-dialog-v1`): Der Assistent lebt in `dialog.magic-dlg` (steht fest im Panel-Template, ein
  Fenster, `MagicPush.bindWindow`). `MagicPush.win()/q()/qa()/inScope()` ersetzen `this.root` im Assistenten; `this.root`
  bleibt nur die Liste im Reiter. `paint()` zeichnet bei `view === "wizard"` über `paintWindow()` (Kopf, Fortschritt,
  `.mgw-body` scrollt, `.mgw-foot` fest; Scrollpositionen bleiben), Desktop (≥ 900 px, `placeSide`): Zonen `chart`, `hist`,
  `pv` wandern in `.mgw-side`. Schliessen: `requestClose()` fragt bei Änderungen (`wiz.snap` gegen Entwurf) "Änderungen
  verwerfen?" (`wiz.confirmClose`); Escape (`cancel`) ebenso, Klick daneben tut nichts. `attach()` zeichnet den Assistenten
  nicht neu; `_renderDevice` baut bei offenem Assistenten nicht neu auf. "Bearbeiten" in den Einstellungen:
  `MagicPush.open(deviceId, true)` (standalone) + `editWhenLoaded`, ohne Popup; nach Schliessen `reset()` und
  `_loadMagicAll()`; Ladefehler erscheint in der Übersicht. Tests: `magic-e2e` (484), `magicall-e2e` (120). Offen: iOS-Tastatur
  im iframe nicht auf echtem iPhone geprüft.

## Stand davor (2.10.0, Magic Push: Übersicht in den Einstellungen, freie Entität)

- 2.10.0: (1) WS `magic_list` (alle Meldungen aller Geräte mit `device_name` und `entity`-Angaben) und Reiter "magic" in
  `_monitorHtml` (`_monMagicHtml`, `_loadMagicAll`, `_magicAllAction`; Aktionen `data-set="magic-*"`; Schalter per
  `change`; `MagicPush.overviewHtml`). Bearbeiten: `_openDevice(id, "magic", ruleId)` → `editWhenLoaded`. Nach dem
  Schliessen des Geräte-Popups lädt die Übersicht neu (`_resetDevice`). (2) Freie Entität: `clean_rule` verlangt nur noch,
  dass die Entität existiert (Register oder Zustand); `entity_descriptor`, `search_entities`, WS `magic_entity_search`,
  `extra_entities` in `magic_get`, `entity_free` in `rule_payload`; `{entity}` heisst nach dem eigenen Gerät der Entität,
  `{device}` bleibt das der Meldung. Panel: unterster Block in Schritt 1 (`wiz.free`, `searchFree`, `extra`). (3) Handy:
  `.set-sec-sum` unter 600 px ausgeblendet; neun Reiter: 5 Spalten Desktop, 3 Handy. Tests: `magicall-e2e`, `magic-e2e`,
  `test_magic` (Suche, freie Entität).

## Stand davor (2.9.0, Magic Push: eigener Rücksetzwert)

- 2.9.0: Regelfeld `reset_value` (leer = automatisch wie bisher; Zahl bei über/unter, Zustand bei "ist"; bei "ändert sich"
  immer leer). `magic.reset_met` und `_clean_reset` (unter: Rücksetzwert ≥ Schwelle, über: ≤). Auslösen in `_evaluate`:
  nach der Meldung bleibt die Episode im Zwischenbereich bestehen (still, kein "wieder normal"), vor der Meldung gilt
  die Bedingung durchgehend; eine ruhende Wiederholung wird beim Wiedereintritt im alten Takt neu gesetzt. Rückblick:
  `magic_history.evaluate(..., reset_value)`, WS `magic_history` nimmt `reset_value`. Panel Schritt 2 "Zurücksetzen"
  (Reiterleiste, Zahlenwähler `reset-value`, Zustände `reset-state`), grüne Linie im Diagramm, Satz "zurück ab …".
  Offen: Rücksetzdauer ("erst nach n Min.") wurde bewusst nicht gebaut (Entscheid des Nutzers: nur der Wert).

## Stand davor (2.8.0, Magic Push: Titel und Inhalt getrennt)

- 2.8.0: Regelfelder `body` und `recover_body` (mehrzeilig, ≤ 300, leer = automatische Zeile wie bisher, `_body` in
  `magic.py`; ältere Regeln laden leer). `content()` ersetzt `info_line` beim Senden und in der Vorschau (`preview`).
  Panel Schritt 3: Titel `<input>`, Inhalt `<textarea>`, ein Chip-Satz je Gruppe (`data-group` main/recover) fügt in das
  zuletzt gewählte Feld ein (`wiz.focus`, per `focusin`); Schritt 4: eigener Titel und Inhalt für "wieder normal".
  Entwurf: `draft.touched` je Feld (Standardtexte folgen Art, Dauer und Entität, bis von Hand geschrieben wird).
  2.6.1 und 2.7.0 sind nicht getaggt (Nicht veröffentlicht); die Notes für 2.8.0 fassen alles seit 2.6.0 zusammen.

## Stand davor (2.7.0, Magic Push: kritische Mitteilung)

- 2.7.0: Regelfelder `critical` (bool) und `critical_volume` (1 bis 10, Vorgabe 10) in `magic.py` (`RULE_SCHEMA`; ältere
  Regeln laden mit den Vorgaben). `push.critical_data(volume)`: iOS `push.sound {name, critical: 1, volume: n/10}`,
  Android `ttl 0`, `priority high`, `channel alarm_stream`. Nur die Hauptmeldung ist kritisch (auch beim Wiederholen und
  im Test "main"), "wieder normal" nicht. Panel: Schalter und Regler in Schritt 4 (`data-mg="critical"`, `"volume"`).
  Quelle: companion.home-assistant.io "Critical notifications" (iOS-Volume dort nur als `1.0` gezeigt; 0.0 bis 1.0 nach
  Apples Doku, aus dem Gedächtnis bestätigt, nicht gegen die Apple-Seite selbst). Nicht auf einem Gerät gehört.
- 2.7.0 (ergänzt): Design-Regel "Auswahlknöpfe" (CLAUDE.md, DESIGN.md): alle Segmentauswahlen sind `.sub-tabs` mit `.seg-pill`.
  `_initSeg` kennt jetzt `data-mg` als Schlüssel und entfernt die Kapsel einer Leiste ohne `.on`.

## Stand davor (2.6.1, Fehlerkorrektur Release Notes)

- 2.6.1: HACS liefert `latest_version` mit Tag ("v2.6.0"); `_versionState` übernimmt das, und `release_notes` lehnte
  es ab (Schema `VERSION_ARG`). Korrigiert an beiden Enden: `_openNotes` entfernt das "v", `VERSION_ARG` und
  `async_release_notes` akzeptieren es. Tests: `test_release_notes.py` (WS mit "v"), `notes-e2e` (neue Version "v0.5.0").

### Magic Push (2.6.0)

- 2.6.0: Magic Push, vierter Reiter im Geräte-Popup (Entscheide des Nutzers: Variante C = Assistent, Wiederholung und
  "wieder normal" konfigurierbar, Text für "wieder normal" frei wie der erste, Empfänger wählbar mit Standard =
  Push-Ziel der Einstellungen, Rückblick 24 Std. (darf leer sein), unavailable/unknown melden nichts, Meldungen
  benennen/umbenennen/löschen, Name als fünfter Schritt). Backend: `magic.py` (Regeln, Prüfung `clean_rule`,
  `cond_met`, Variablen `render`, Klasse `MagicPush` mit Zustandsverfolgung, Timer für Dauer und Wiederholung,
  Store `device_panel.magic`), `magic_history.py` (Rückblick über den Recorder, gleiche `cond_met`), WS `magic_get/
  save/delete/enable/preview/test/history`. Panel: `panel/magic-push.js` (Klasse `MagicPush`, verwaltet Liste und
  Assistent selbst in `.mg-root`; `attach()` nach jedem Neuaufbau des Popups; solange der Assistent offen ist, baut
  `_renderDevice` nicht neu auf), Strings `mg*`, CSS `.mg-*`. Timer-Callbacks müssen `@callback` sein, sonst laufen sie
  im Executor (so gefunden). Tests: `tests/test_magic.py`, `suites/magic-e2e.mjs`; Mockups `docs/mockups/magic-push-v2`.
  Offen/Unsicher: nicht in echtem HA mit echtem Recorder und iPhone geprüft; Notify-Gruppen werden best effort erkannt.

## Stand davor (2.5.0, lange Listen zuunterst)

- 2.5.0: Regel für die Einstellungen: Eine lange Liste (Pro Integration, alle Apps, Chips, Abweichungen) steht
  immer als letzter Block ihres Reiters; Konfiguration, Emoji und Vorschau davor. Geändert: Reiter "Laden"
  (`integList` nach der Vorschau), "Updates" (`list` nach der Vorschau), "Darstellung" (Knopf "Reihenfolge
  zurücksetzen" über der Liste). Neue Listen halten sich daran. Test: `listlast-e2e`.

- 2.4.0 (nicht veröffentlicht, in 2.5.0 enthalten): Auch ohne Update hat die Zeile "Aktuell" den Knopf "Release Notes" (`data-ver="notes"`). `_openNotes`
  fragt dann ohne `installed` nach `latest = installierte Version` (Backend: nur diese Version, Tag `v<installiert>`);
  Kopf "Installierte Version x.y.z" (`notesInstalled`), Link auf deren Release. Eine Version ohne Tag (Entwicklung)
  ergibt "HTTP 404" mit Link/Erneut versuchen.

- 2.3.0: "Release Notes" in der Versionszeile der Einstellungen ist ein Knopf (`data-ver="notes"`) und öffnet
  `dialog.notes-dlg` (`_openNotes`/`_renderNotes`/`_bindNotes`) statt GitHub. WS `device_panel/release_notes`
  {installed, latest, language, force} → `update_check.async_release_notes`: Abschnitte aller Versionen nach der
  installierten bis zur neuesten aus `CHANGELOG.de.md` bzw. `CHANGELOG.md` am Tag `v<latest>`
  (`raw.githubusercontent.com`), Rückfall Englisch, zuletzt der Text des GitHub-Releases; Zwischenspeicher 6 Std.
  (Fehler 5 Min.). Die Versionsnummern gehen in den URL-Pfad: Prüfung mit `VERSION_ARG` (nur Nummern). Markdown
  setzt das Panel selbst um (`releaseMarkdownHtml`: Überschriften, Listen, fett, Code, https-Links; HTML wird
  escaped). Tests: `tests/test_release_notes.py`, `notes-e2e`. Nicht geprüft: Anzeige auf dem iPhone.

- 2.2.0: Emoji im Push-Titel pro Meldung einstellbar: Optionen `emoji_outage|group|online|battery|charge|charge_stop|new|updates`
  (`const.EMOJI_DEFAULTS`/`EMOJI_KEYS`; None = Standard, "" = ohne Emoji, höchstens 3 sichtbare Zeichen, Prüfung
  `options_api.emoji`/`grapheme_count`, Panel `_graphemes` mit Intl.Segmenter). `push.title(hass, opts, kind, key, **kw)`
  setzt das Emoji vor den Text (die Titel in `push.TEXTS` haben kein Emoji mehr; die anhaltenden Benachrichtigungen
  behalten es). Panel: `_emojiHtml` über der Vorschau (Ausfall: 3 Felder, Batterie, Laden nur bei eingeschalteter
  Meldung: 2, Neu, Updates), `_syncEmoji` führt Feld, Standard-Knopf und Vorschau-Spanne (`data-pve`) nach, ohne neu
  aufzubauen (setHtml überspringt gleiches HTML, darum auch beim Zurücksetzen von Hand). Nur im Panel, nicht im
  Optionsdialog von HA. Tests: `tests/test_push_emoji.py`, `emoji-e2e`.

- 2.1.0: Puls zeigt am rechten Rand den Stand jetzt: `availability.pulse` zählt im letzten Abschnitt nur noch
  laufende Ausfälle (`down_now`, `avail24.down` im Gerät); Panel `_inPulse`/`_headPulse` (Bereichsfilter, Fenster-Liste)
  ebenso; Streifen pro Gerät unverändert. Simulator (`ha-sim.html`) bildet das nach.
- 2.1.0: Push-Meldungen zeigen das Icon der Integration (`push_icon.py`): `async_integration_icon(hass, domain)` →
  URL unter `/device_panel/icons/<domain>.png` oder None; Quelle erst `brand/icon.png` der Integration
  (`integration.file_path`), dann CDN `brands.home-assistant.io/_/<domain>/icon.png` (4 s Timeout), mit Rand 512 × 512
  (Pillow, Anteil 62 %), Ordner `.storage/device_panel_icons` (statischer Pfad ohne Zwischenspeicher, in
  `async_remove_entry` gelöscht), Fehlschlag 6 Std. gemerkt, Auffrischen nach 30 Tagen. Sammelmeldungen nur bei
  gemeinsamer Integration (`async_common_icon`), Update-Erinnerung unverändert. Fallback: `push/icon.png`. Tests:
  `tests/test_push_icon.py`. **Nicht geprüft:** Anzeige auf einem echten iPhone; ob HA 2026.10 Core-Icons lokal
  liefert (der Code nutzt das CDN direkt, wie HA selbst).

- 2.0.10: Geräte-Popup, Reiter "Einstellungen" mit eigenen Einstellungen auf zwei Zeilen (`.sub-tab.two`, `.tab-l` 13 px,
  `.tab-s` 11.5 px; Text `devTabOwnCount`, `aria-label` bleibt "Einstellungen · n eigene"). Test in `popup-e2e`.

- 2.0.9: Fehler behoben: Nach dem Schliessen eines Fensters gibt der Browser den Fokus an die antippte Kachel zurück und
  zeigt dort `:focus-visible` (blauer Ring an "Ausfall-Puls"). `close`-Listener in der Einfangphase auf dem Shadow-Root
  ruft `_blurOnTouch()` (nur `pointer: coarse`). Neue Suite `focus-e2e`.

- 2.0.8: Zeichen für "Meldung aus" (`.mk-off`) in allen Grafiken: grauer Ring mit Schrägstrich (Mockups
  `docs/mockups/off-marker-v1`, B); bei den Balken steht der Ring am Ende der gestrichelten Linie. Nur Stile.

- 2.0.7: Einstellungen pro Gerät an einem Ort: "Geräte im Panel" › Reiter "Pro Gerät" (`devset`, alle fünf Override-Listen
  `_overridesHtml`: offline, notify, battery, connection, signal; Zähler über `_subCount("devset")`). Die globalen
  Empfang-Warnschwellen (`_sigGlobalHtml`) und die Empfang-Overrides stehen im neuen Reiter "Empfang" (`sig`,
  `_monSigHtml`) der Überwachung (jetzt acht Reiter, immer 4 + 4). "Darstellung" hat keine Unterreiter mehr, nur noch
  die Filter-Chips (`SUB_TAB_KEYS.conn` entfiel, `gosub` und `connMoved` aus 2.0.4 ebenfalls). Neue Suite `prodevice-e2e`.

- 2.0.6: Stift am Gerätenamen (`.dn-edit`) als getönter Kreis statt blauem Ring, Tastatur-Fokus neutral; `_blurOnTouch()`
  nimmt nach `showModal` auf dem Handy den Fokus vom ersten Knopf (Popup, Einstellungen, Statistik, Prompt).

- 2.0.5: Reiter (`.mon-tabs`, `.sub-tabs`) als Segmentschalter nach der UniFi-Aufnahme (Mockups `docs/mockups/segmented-v1`,
  mit `prototype.html`): Fläche, gleich breite Felder (Grid), Kapsel `.seg-pill` als eigenes Element, das `_initSeg()`
  per MutationObserver setzt und beim Wechsel gleiten lässt (FLIP über `_segLast`, weil die Leisten bei jedem Aufbau
  neu gezeichnet werden; ResizeObserver nur bei echter Breitenänderung, ersetzte Leisten werden ausgenommen). Ab fünf
  Reitern auf dem Handy vier Spalten (unter 390 px drei), "Bewegung reduzieren" ohne Gleiten. Handy: Zeile
  "Sortierung & Ansicht" (`.sort-btn` mit `.lbl`/`.val`) ersetzt Pille und Knopf oben (`.view-btn` auf dem Handy
  ausgeblendet; Mockups `sort-line-v1`, C). Tests: `graphics-e2e`, `view-e2e`.
  Ungeprüft auf einem echten iPhone: Gefühl des Gleitens, Verhalten bei sehr schmalen Fenstern.

- 2.0.4: "Verbindungsart pro Integration" (`connection_integrations`) steht neben dem Typ in "Geräte im Panel" ›
  "Integrationen" (`exTable` mit Liste von Zusatzspalten, `connExtra`); die eigene Liste in "Darstellung" ›
  "Verbindungsart" entfiel (Hinweis mit Sprung `data-set="gosub"`). `SUB_TAB_KEYS`, Zusammenfassungen und `conn-e2e`
  angepasst. Gleiche Einstellung, keine Datenänderung.

- 2.0.3: Reiter (`.mon-tabs`, `.sub-tabs`) ohne Fläche dahinter, jeder Reiter mit eigenem Rahmen, natürliche Breite
  linksbündig (`flex: 0 0 auto`), auf dem Handy (max. 600 px) mindestens 44 px hoch, Schrift 14 px. Mockups
  `docs/mockups/tabs-frame-v1` (A) und `tabs-touch-v1` (Variante 2). Test in `graphics-e2e`.

- 2.0.2 (regulär, keine Vorabversion): einheitliche Grafiken (`.mtl`/`.ptl`: Linie und Balken enden bei 80 %, Wert
  unter dem Ring am Endpunkt, Mockups `docs/mockups/graphics-v1`, Variante A; `_tlHtml` mit `at: 80`, `_ptlHtml` mit
  `.ptl-txt` statt `.ptl-head`), nicht gewählte Reiter mit leichtem Rahmen (`.mon-tab:not(.on), .sub-tab:not(.on)`,
  Schatten innen), Zeilen in Behältern (`.mrow`, `.set-sec-head`, `.ilist-row`, `button.lg-row`, …) werden beim
  Drücken nicht mehr kleiner (zeigte den Grund des Behälters als dunkle Fläche). Neue Suite `graphics-e2e`.
  Schritt 2 des Material-Looks (ziehbares Blatt) steht weiter aus, erst nach Rückmeldung des Nutzers.

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
  (`look`; bis 2.0.6 Reiter "Verbindungsart" mit `connection_integrations` und den
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
   Reihenfolge aller Chips `1.13.0` (Nutzer, 2026-10-05, "Batterie ganz oben";
   Entscheid: alles frei, Verbindungsarten als ein Block): Option `chip_order`
   (`const.CHIP_ORDER_KEYS` = `CHIP_KEYS` mit `connections` an Stelle 3;
   `options_api.chip_order`, Reihenfolge bleibt, Doppelte fallen weg; leer =
   Standard, nicht genannte folgen in der Standardfolge; nicht im
   HA-Optionsdialog, bleibt dort erhalten). Panel: `chipOrder()` ergänzt die
   Folge, `_chipsHtml` baut jeden Chip als Stück und setzt Trenner nur um
   `connections` neben sichtbaren Nachbarn; Einstellungen: `exTable(..., drag)`
   nimmt jetzt den Optionsnamen (`data-drag`, `data-drag-list`), feste Zeile
   `fixed` (Schalter an, ohne `data-list`), `_dragOrder()`; Standardfolge wird
   als `[]` gespeichert. Tests: `chiporder-e2e.mjs`, `test_update_check.py`.
   Geräte, die gerade laden `1.35.0` (Nutzer, 2026-10-10, Mockup `charging-state-v1`, B in der Liste, C bei gewähltem Chip):
   `ChargeNotifier` beobachtet jetzt alle überwachten Geräte mit Batterie (Push nur für die eingeschalteten, `_on_state`);
   `step()` führt zusätzlich `peak` und `up_at`; `charging()` (Anstieg >= `charge_rise`, nicht voll, Anstieg in den letzten
   `CHARGE_STALE` = 2 Std., Rückgang um `CHARGE_DROP` = 5 Punkte beginnt neu) und `charging_of()` (Ladeanzeige-Entität geht
   vor: `charging_entity()`, Binärsensor battery_charging oder Companion `_battery_state`). `devices._charging()` liefert
   `charging` {level, from, since, source} in `list_devices`. Chip `charging` (`CHIP_KEYS`, `HINTS`, `CHIP_OTHER`,
   `CHIP_DEFAULT`), `_chargingPillHtml`, `_chargingInfoHtml`, Chip-Ansicht flach nach Stand. Simulator `window.__charging`.
   Tests `test_charge.py`, `chargechip-e2e.mjs`. Unterreiter Laden: Zeitstrahl mit `charge_rise` (Feld) und
   `charge_full` (Auswahl `data-cfull`) im Zeitstrahl wie bei der Warnung (`_chargeHtml`, `.mtl-mk .opt-select`). X in den Suchfeldern der Listen und Auswahlfenster: `_fieldClearHtml`,
   `data-lclear` / `data-area-search-clear`, `.field-clear`.
   Lademeldung pro Gerät (eigene Werte, 1.35.0): `device_settings` `charge_full` {Gerät: 90..100} und `charge_rise`
   {Gerät: 5..80} (`.storage/device_panel.devices`), `devices.device_charge_opts()` mischt sie in die Optionen für
   `ChargeNotifier` (Push und "lädt"); WS `set_device_settings`; Popup `dev-charge-full`, `dev-charge-rise`,
   `dev-charge-rise-val`. Tests `test_charge.py`, `charge-e2e.mjs`.
   Pro Integration (1.36.0): Optionen `charge_full_integrations`/`charge_rise_integrations` ({Domain: Wert}, `options_api.charge_map`),
   `devices.charge_values()` (Gerät > Integration > global), `charge_default` mit `full_integration`/`rise_integration`;
   Panel `data-cfull-integ`/`data-crise-integ` im Integrations-Detail (Auswahl mit Stufen), `INTEG_OWN_MAPS`.
   Fehler 1.36.0 (Nutzer, Kühlschrank-Sensor mit Knopfzelle als "lädt" markiert): `ChargeNotifier.charging_of()` nimmt den Stand nur noch,
   wenn `enabled()` (Lademeldung für das Gerät) gilt; die Ladeanzeige des Geräts gilt weiter immer. Test `test_charging_flag_in_list_and_entity_wins`.
   Reiter im Geräte-Popup `1.37.0` (Nutzer, Mockups `popup-tabs-log-v1`, R3): `_renderDevice()` baut `ov` (Statistik, KI, Verbindung,
   Gerät; Typ und Verbindungsart nur als Text), `set` (`_typeSelHtml(d, true)`/`_connSelHtml(d, true)` + `_deviceNotifyHtml`) und `ent`
   (Entitäten); Zustand `_devTab` (öffnet immer auf "ov", Knopf `data-dlg="tab"` mit `data-tab`), Zähler `devOwnCount(d)` am Reiter
   (Punkt über `.sub-tab.chg`). Tests tippen zuerst `dialog.device [data-tab="set"]`. Hinweis: das geschlossene Popup behält sein
   HTML, `.sub-tab` darum in Tests immer mit `dialog.settings` einschränken.
   Protokoll `1.38.0` (Nutzer, Mockups `popup-tabs-log-v1`, P1): Backend `activity.py` (Ringspeicher der letzten 500 Einträge im
   Arbeitsspeicher, `record(hass, severity, cat, code, name, device_id, **args)`, Texte DE/EN in `TEXTS`, Debug-Einträge nur bei
   eingeschaltetem Schalter, Eintrag geht zusätzlich ans Python-Protokoll); Einträge in `push.py` (jeder Versand), `charge.py`
   (beobachtet, lädt, voll, aus/kein Ziel, Debug je Stand), `outage.py` (`_log_flush`), `battery.py` (`_log_new`), `newdevice.py`,
   `updates.py`, Start in `__init__.py`; WS `get_log`/`set_log`/`clear_log` (Admin). Panel: Knopf `.log-btn` links vom Zahnrad
   (eigene Klasse, damit `.gear-btn` in den Tests das Zahnrad bleibt), `dialog.log-dlg` mit `_openLog`/`_renderLogFrame`/
   `_renderLogBody` (Kopf und Suche nur beim Öffnen, damit die Eingabe das Nachfragen alle 4 s übersteht), Zeile mit Gerät
   öffnet `_openDevice` über dem Protokoll. Tests `test_activity.py`, `log-e2e.mjs`; Simulator `window.__log`.
   "Voll ab" mit Stufen und eigenem Wert `1.39.0` (Nutzer): Stufen 100, 95, 90, 80 (`CHARGE_FULL_PRESETS`) oder "Eigener Wert" (Zahlenfeld,
   50 bis 100, `INT_RANGES[CONF_CHARGE_FULL]`), im Popup (`dev-charge-full`, `dev-charge-full-val`), global (`data-cfull`, `_tlInput(d, "charge_full")`)
   und pro Integration (`data-cfull-integ`, `data-cfull-integ-val`); ein Wert ausserhalb der Stufen gilt als eigener. `charge.step()`: Ersatzregel
   nur bei Sprung über `min(CHARGE_JUMP_FROM, full - 10)`. Tests `chargefull-e2e.mjs`, `test_charge.py`.
   Ladung beendet `1.40.0` (Nutzer): `ChargeNotifier.check_stalls(now)` (Termin jede Minute, `_on_tick`): Gerät, das nach dem Stand lädt, mit
   eingeschalteter Lademeldung, ohne eigene Ladeanzeige und seit `charge_stall` Minuten (Standard 15, 5..120) ohne Anstieg (`up_at`), bekommt den
   Merker `stopped` (`charging()` gibt dann None; ein Anstieg löscht ihn in `step()`); Protokoll `charge_stopped_*`, Push `_async_push_stop` nur mit
   `notify_charge_stop` (Standard aus). Panel: Zeilen in Batterie › Laden. Tests `test_charge.py`, `charge-e2e.mjs`.
   Ladung beendet pro Integration und Gerät `1.41.0` (Nutzer): Optionen `charge_stall_integrations` ({Domain: Minuten}, `charge_map`) und
   `charge_stop_integrations` ({Domain: bool}, `options_api.bool_map`); Geräte-Einstellungen `charge_stall` ({Gerät: 5..120}) und `charge_stop` ({Gerät: bool})
   in `.storage/device_panel.devices`; `devices.charge_stop_values()` und `device_charge_opts()` (Gerät > Integration > global) liefern `charge_stall` und
   `notify_charge_stop`, `check_stalls` nutzt sie je Gerät; `charge_default` hat `stall`, `stop`, `stall_integration`, `stop_integration`. Panel: Popup
   `dev-charge-stall`, `dev-charge-stall-val`, `dev-charge-stop`; Integrations-Detail `data-cstall-integ`, `data-cstop-integ`. Tests `chargestop-e2e.mjs`, `test_charge.py`.
   Wischen im Popup `1.41.0` (Nutzer, Video nicht angekommen, Ursache nur vermutet): `_renderDevice(soft)` und `_renderLogBody(soft)` bauen beim
   Abfragen nicht neu auf, solange `_dlgBusy()` gilt (Berührung aktiv oder weniger als 0,8 s her, Scroll/Wheel im Fenster);
   `_trackBusy(dlg)` setzt die Merker. Nur der Abfragepfad ist weich, eigene Aktionen bauen sofort neu auf. Test `busy-e2e.mjs`.
   Material nachgeschärft und Liste angepasst `2.0.1` (Nutzer nach Test): Blatt 64 %, kräftigere Oberkante, Liste (`.toolbar h1`, `.hero > *`, `.chips`, `.cards .gh`) im selben Block von `styles.js`.
   Material-Look `2.0.0` (Nutzer, Schritt 1 von 2, Mockups `docs/mockups/apple-design-v1`, Variante B; Skill `.claude/skills/apple-design`): Block am Ende von `styles.js`
   (durchscheinende Blätter mit `backdrop-filter`, nur unter `@supports` und `not (prefers-reduced-transparency)`, Druck-Rückmeldung unter `not (prefers-reduced-motion)`).
   Nur Stile. Schritt 2 offen: ziehbares Blatt mit Federn (Prototyp `prototype.html`), mit Schalter zum Abschalten und Touch-Test (iPhone-Scrollproblem!).
   Zurück: v1.44.0. Als Vorabversion veröffentlichen (Nutzer legt den Tag an).
   Reiter umbrechen `1.44.0` (Nutzer, Mockups `docs/mockups/tabs-style-v1`; der Nutzer wählte das bisherige Segment-Aussehen): `.mon-tabs, .sub-tabs { flex-wrap: wrap }`,
   `.mon-tab, .sub-tab { flex: 1 0 auto; white-space: nowrap }`; das seitliche Scrollen der Reiterzeile (1.42.0) entfällt. Test `levels-e2e.mjs`.
   Abschnittstitel `1.43.0` (Nutzer): ein Stil `.set-title` (= `.mon-grp`, `.ex-title`; 18 px fett mit Akzentbalken), Helfer `ttl(key)` in `_settingsBodyHtml`; neue Titel
   `ttlShow`, `ttlIntegShow`, `ttlTypes`, `ttlHiddenDevs`, `ttlAiShow`, `ttlAiTask`, `ttlAiPrompt`, `grpTarget`; Verbindungsart/Empfang-Köpfe sind Titel (nicht mehr `.bat-own`).
   Gleiche Reiter auf allen Ebenen `1.42.0` (Nutzer, "überall genau gleich aufgebaut"): Ausfall | Batterie | Laden | Neu | Empfang | Geräte.
   Global: "Laden" ist ein eigener `mon-tab` (`MON_TAB_KEYS.charge`, vorher Unterreiter `bat_charge`; die Tab-Zeile scrollt seitlich, `.mon-tabs`,
   der gewählte Reiter wird in `_renderSettings` zentriert). Integration: `_integDetailHtml` baut je Reiter `outHtml/batHtml/chgHtml/newHtml/sigHtml/devsHtml`
   mit der Grafik des globalen Reiters (wirksame Werte), `st.sub.integ` (`data-set="isub"`), Punkt `.chg` = eigene Einstellung der Integration.
   Gerät: `_deviceNotifyHtml` sammelt die Zeilen in `parts.out/bat/chg/sig`, Unterreiter `data-dlg="stab"` (`this._devSub`, beim Öffnen "out"), Grafik aus den
   wirksamen Werten des Geräts (`offline_default`, `battery_default`, `charge_default`), Hinweis `devNoBattery`/`devNoSignal`, wenn das Gerät es nicht kann.
   `.dev-tabs::after` blendet durchlaufenden Inhalt weich aus. Tests `devset-e2e`, `charge-e2e`, `integ-e2e`, `overview-e2e` u. a. angepasst.
   Emoji in Push-Titeln `1.41.0` (Nutzer): erstes Zeichen jedes Titels in `push.py` `TEXTS` (`*_title`, `*_title_many`, `update_title`), dieselben Emoji in den
   Panel-Vorschauen (`pv*Title` in `strings.js`); dieselben Emoji vorne an den Titeln der anhaltenden Benachrichtigungen (`*_persistent_title`). Tests passen die erwarteten Titel an.
   Ladebalken mit Ziel `1.41.0` (Nutzer, Mockup `charge-target-v1`, C): `charging()` liefert `full` (Voll ab des Geräts), `_chargeBarHtml(c)` zeichnet Rest/Strich/Zahl
   (`.chg-rest`, `.chg-tick`, `.chg-goal`, `.has-goal`), in der Liste (Chip "Lädt") und als `extra` der Batterie-Kachel im Popup. Test `chargechip-e2e.mjs`.
   Log-Chips `1.41.0` (Nutzer): `.lg-chips .chip:first-child` ist sticky (deckender Hintergrund). Test `log-e2e.mjs`.
   Batterie-Schwelle ab 1 % `1.41.0` (Nutzer): `INT_RANGES[CONF_BATTERY_LOW] = (1, 50)` (vorher 5), Panel `[1, 50]` (Popup, global, pro Integration), Simulator
   und Texte (`battery_map` "1 bis 50"); Tests `test_battery.py`, `devset-e2e.mjs`, `settings-e2e.mjs`.
   Feste Höhe der Fenster `1.41.0` (Nutzer): `dialog.device`, `.settings`, `.stat-dlg`, `.pulse-dlg`, `.area-sheet`, `.prompt-dlg` haben eine feste Höhe
   (Desktop `min(780px, 100% - 48px)`, Handy 92 %, Statistik 86 %), Flex-Spalte mit `.dlg-body { flex-grow: 1 }`, damit die Knöpfe unten bleiben und der
   Inhalt den Rest füllt. Fenster mit gleichbleibendem Inhalt (`view`, `cols-dlg`) bleiben wie sie sind. Test `dlgheight-e2e.mjs`.
   Übersicht mit allen Meldungen `1.34.0` (Nutzer, 2026-10-10): `_monOverviewHtml` hat fünf Zeilen (`lane(...)`: Ausfall,
   Batterie, Laden `data-lane="charge"`, Neue Geräte, Updates); `lane()` nimmt `sub` (Unterreiter, `data-sub` am
   "Ändern"-Knopf, der Handler setzt `st.sub.battery`) und `id`. Strings `laneCharge`, `tlCharge*`, `tlUpd*`, `laneUpd*`.
   Test `overview-e2e.mjs`, `newdevices-e2e.mjs` (fünf Zeilen).
   Lademeldung pro Integration auch im Reiter Integrationen `1.33.0` (Nutzer, 2026-10-10): Schalter `data-cinteg` in
   `_integDetailHtml` (Gruppe Batterie), gleicher Wert wie die Liste im Unterreiter Laden (`charge_integrations`);
   `INTEG_OWN_LISTS` enthält `charge_integrations` (Zurücksetzen = aus), `_integItems` zeigt "Laden an" (`diffCharge`).
   Test `charge-e2e.mjs`.
   Reiter Batterie `1.32.0` (Nutzer, 2026-10-10, Mockup `battery-layout-v1`, C): Unterreiter "Warnung | Laden"
   (`st.sub.battery` = `bat_warn`/`bat_charge`, `SUB_TAB_KEYS`, Handler `data-set="subtab" data-group="battery"`);
   "Abweichungen" heissen `grpDiffBat` ("Abweichungen von Schwach ab") und stehen bei der Warnung; `_chargeHtml`
   ohne Überschrift. Test `charge-e2e.mjs`.
   Fehler `1.31.1` (Nutzer, 2026-10-10, hohe Priorität): Panel lud seit HA 2026.10 langsam/gar nicht. Ursache:
   `DeviceEntry.config_entries`/`primary_config_entry` melden ab 2026.10 zur Laufzeit (`report_usage`); das
   Panel las sie hundertfach je Abfrage. Neu `compat.device_entry_ids()` / `device_primary_entry_id()`
   (`config_entry_id`, Rückfall `config_entries`); `tests/test_compat.py` verbietet direkte Lesezugriffe.
   Ursache durch das Log des Nutzers bestätigt (Logger homeassistant.helpers.frame: Warnungen zu
   `config_entries`, `primary_config_entry` und `device_registry.devices.values()`); zweite Stelle: neu
   `compat.registry_devices()`. Nicht gegen HA 2026.10 selbst getestet (nur 2026.2.3 verfügbar).
   Update-Erinnerung pro Eintrag `1.31.0` (Nutzer, 2026-10-10): `updates.catalog(hass)` liefert alle `update.*`-Entitäten
   (`id, name, kind, platform, installed, latest, available`, nach Art und Name) als `catalog.updates` in `get_options`;
   Optionen `updates_exclude`/`updates_include` (Entitäts-IDs, `options_api.update_ids`); `updates.is_wanted()`: Ausnahme
   vor Art. Panel: Liste im Reiter "Updates" (`data-uitem`, Suche `updates`, Normalisierung `_normalizeUpdateItems`),
   Vorschau mit den echten offenen Updates. Art "Add-ons" heisst "Apps (Add-ons)". Tests `test_updates.py`, `updates-e2e.mjs`.
   Lademeldung `1.30.0` (Nutzer, 2026-10-10, Mockup `charging-v1`, Konzept `docs/CONCEPT-laden-updates.md`):
   `charge.ChargeNotifier` beobachtet die Batterie-Sensoren (`battery_entity`), `step()` merkt den tiefsten Stand
   seit dem Entladen; Anstieg >= `charge_rise` (2..80 seit 1.42.0, Standard 20) = lädt, Push bei Stand >= `charge_full`
   (90..100, Standard 100); Ersatzregel: Sprung von < 90 auf >= voll (`CHARGE_JUMP_FROM`), wieder scharf bei
   Stand < voll - `CHARGE_REARM`. Schalter `notify_charge` (aus), Integrationen `charge_integrations`, pro Gerät
   `charge` (true/false/None) in `.storage/device_panel.devices` (Gerät geht vor); Merker in
   `.storage/device_panel.charge`. Ladeanzeige-Entität (Konzept Regel 1) bewusst nicht umgesetzt. Panel:
   `_chargeHtml` im Reiter "Batterie" (Voll ab `data-cfull`, Anstieg, Integrationen `data-cinteg` mit Suche
   `charge`, Vorschau), Popup-Zeile `dev-charge` (nur mit Batteriestand). Tests `test_charge.py`, `charge-e2e.mjs`.
   Update-Erinnerung `1.29.0` (Nutzer, 2026-10-10, Mockup `charging-v1`, Konzept `docs/CONCEPT-laden-updates.md`):
   `updates.UpdateNotifier` hört auf `update.*` (EVENT_STATE_CHANGED), Modi `instant` (Sammelfenster
   `updates_window`), `daily`/`weekly` (`updates_time`, Montag), Arten `updates_kinds` (core/addons über
   Plattform `hassio`, `hacs`, `devices`), Merker `{Entität: {v, at}}` in `.storage/device_panel.updates`,
   `updates_repeat` (nie/3d/7d). Standard täglich 09:00, aus. Panel: Reiter "Updates" (`_monUpdatesHtml`,
   `MON_TAB_KEYS.updates`, Vorschau mit Beispielen); Abschnitt "Updates" heisst "Panel-Version". Tests
   `test_updates.py`, `updates-e2e.mjs`.
   Suchfeld in langen Listen `1.28.0` (Nutzer, 2026-10-10, Mockup `settings-search-v1`, A): `_searchHtml(key, n)`
   (ab 8 Einträgen) und `_applyListSearch(root)`; Zeilen in Behältern `.srch-rows[data-srch]` (exTable ohne
   Ziehen, `conn`, `integ`, `ovr-*`), `hidden` per Eingabe ohne Neuaufbau, Suchtext in `st.search`. Test `listsearch-e2e.mjs`.
   Grund der Warnung im Popup `1.27.0` (Nutzer, 2026-10-08, Mockup `warn-reason-v1`, K2): `why`-Marken
   (`.why-tags`) unter dem Namen für instabil, schwachen Empfang, Batterie niedrig (ersetzen die Pille
   "Instabil"); `_statTile/_staticTile(..., warn)` setzen `.st-tile.warned` (gelber Rahmen, Punkt per `::after`).
   Strings `warnWeakSignal`, `warnBatteryLow`. Test `warnwhy-e2e.mjs`.
   Kopf auf dem Handy `1.26.0` (Nutzer, 2026-10-07, Mockup `docs/mockups/hero-mobile-v1`, V2): bis 600 px
   stehen "Verfügbarkeit" (`.kt.ring`, Ring 62 px, Text über `.rtxt` mit `display: contents` ins Raster) und
   "Gerade ausgefallen" (`.kt.offl`) je halbe Breite nebeneinander, der Puls (`.kt.pul`) ist eine schlanke
   Zeile (Raster: Titel und Hinweis links, Kurve rechts, `.pticks` aus, `.inc-text` aus). Kurzfassungen
   stehen doppelt im Markup und werden per CSS umgeschaltet (`.kwarn .w-long/.w-short`, `.olist .more-long/
   .more-short`, Text `warnShort`); Liste auf dem Handy nur die zwei längsten Geräte. Der Text des
   Sammelausfalls (`_incidentHtml`) steht zusätzlich im Puls-Fenster (bis 3). Tablet und Desktop unverändert.
   Test: `hero-mobile-e2e.mjs` (iPhone 17, 375 pt, Grenze 600/601 px); `filter-e2e.mjs` und `warn-e2e.mjs`
   angepasst. `docs/screenshots/*/overview-mobile.png` neu.
   Gerätetyp pro Integration `1.25.0` (Nutzer, 2026-10-06, ohne Mockup, nach dem Muster der Verbindungsart
   pro Integration): Option `type_integrations` {Domain: Typ} (`options_api.type_map`, auch im
   Optionsdialog); Vorrang in `devices.effective_type`: von Hand am Gerät, dann
   `devices.integration_type` (primäre Integration), dann Erkennung. `list_devices` liefert `type`
   (wirksam), `type_auto`, `type_manual` und neu `type_integration`; Ausschlüsse nach Typ und der
   Katalog der Typen rechnen mit dem wirksamen Typ. Der Typ gilt nur im Panel (nicht im HA-Register).
   Platzierung nach Bildschirmfoto des Nutzers: Spalte "Typ" in der Liste der Integrationen
   (Reiter "Integrationen" von "Geräte im Panel", `SUB_TAB_KEYS.integrations` enthält
   `type_integrations`), nicht im Reiter "Typen". Panel: `exTable(..., extra)` (die
   Auswahlspalte `.ex-col.sel` aus 0.30.0, Handy: Auswahl mit Beschriftung unter dem Namen)
   mit `typeExtra`, Erkennung je Zeile aus `_typeIntegInfo()`, festgelegte Integrationen ohne
   Geräte bleiben zum Zurücksetzen in der Liste; Popup "Wie Integration: X" (`typeAutoInteg`,
   `typeByInteg`), Zusammenfassung `sumTypeInteg`. `.ex-row:has(.ex-col.sel) .ex-name` bricht
   lange Erkennungstexte um, statt Schalter oder Auswahl zu verdrängen. Simulator: `applyTypes()`. Tests:
   `test_type_integration.py`, `typeinteg-e2e.mjs`.
   Push bei neuen Geräten `1.24.0` (Nutzer, 2026-10-06, ohne Mockup, nach dem Muster von Ausfall und
   Batterie; Entscheide: nur Geräte ab dem Einschalten, Sammelfenster einstellbar, Override pro
   Integration): `newdevice.NewDeviceNotifier` lauscht auf `EVENT_DEVICE_REGISTRY_UPDATED` (action
   "create"), sammelt `new_window` Minuten ab dem ersten Gerät und meldet dann (`async_flush`: nur
   `devices.shown_devices`, nicht `new_exclude_integrations`; ein Gerät einzeln mit Tag
   `device_panel_new_<id>`, mehrere als Sammelmeldung `device_panel_new`); `new_persistent` legt
   eine Meldung `device_panel_new` mit den letzten 10 Geräten an (Wegklicken leert die Liste,
   `.storage/device_panel.new`, beim Entfernen der Integration gelöscht). Optionen `notify_new`,
   `new_window` (1..60), `new_persistent`, `new_fields` (`NEW_FIELDS`), `new_exclude_integrations`;
   `NEW_INSTALL_OPTIONS` schliesst "ibeacon" aus. Panel: Reiter "Neu" (`_monNewHtml`,
   `_newFieldsHtml`, `_newRows`, `MON_TAB_KEYS.new`), dritte Übersicht-Zeile, Schalter im
   Integrations-Detail, `_ptlHtml(rows, edit, zero)` mit Null "Gerät gefunden". Tests:
   `test_new_devices.py`, `newdevices-e2e.mjs`.
   Logos auch in den Einstellungen `1.23.0`: `_ibadge(domain, name)` ersetzt die Buchstaben-Kennzeichen
   (`.ibadge`, Listen der Integrationen); die Logos der Katalog-Integrationen werden beim Laden der
   Optionen vorab geladen (`_brandPreloadDomains`), spät eintreffende Ergebnisse zeichnen auch den
   offenen Einstellungsdialog neu. Test: `brand-e2e.mjs`.
   Logos der Integrationen `1.22.0` (Nutzer, 2026-10-06; Entscheid: Avatar ersetzen, lokal
   von HA): `_avatar` zeigt `/api/brands/integration/<Domain>/icon.png?token=` (HA >= 2026.3,
   Token per WebSocket `brands/access_token`, alle 10 Min. neu; im dunklen Design zuerst
   `dark_icon.png`); `_brandSrc/_brandProbe` laden jedes Logo einmal vor und merken ok/fail,
   ohne Dienst oder Logo bleibt das Verbindungs-Icon. Das Popup nutzt weiter das Typ-Icon.
   Simulator: `brands/access_token`, Route in `server.mjs` ("matter" ohne Logo, `?nobrands=1`
   wie eine ältere HA); die README-Bilder entstehen mit `nobrands`. Test: `brand-e2e.mjs`.
   Gerät umbenennen `1.21.0` (Nutzer, 2026-10-06, ohne Mockup): WebSocket
   `device_panel/rename_device` (Admin) setzt `name_by_user` im Geräte-Register, leer =
   zurück; `list_devices` liefert `name_original` und `name_custom`. Popup: Stift im
   Kopf (`_nameHtml`, `_renameStart/_renameSave/_renameCancel`, Zustand `this._rename`,
   Enter/Escape im Feld). Nur das Gerät, keine Entitäts-IDs. Tests: `test_rename.py`,
   `rename-e2e.mjs`.
   Paralleler Ausfall-Zeitstrahl `1.20.0` (Nutzer, 2026-10-06): `_ptlHtml(rows)` und
   `_outageRows()` ersetzen `_outageMarks()` (Übersicht, Reiter "Ausfall", Integration);
   `_ptlWidth()` rechnet die Länge, `_updateSettingsMeta` passt `--w` beim Tippen an.
   Der Batterie-Zeitstrahl nutzt weiter `_tlHtml`. Tests: `notify-`, `settings-e2e`.
   Startwerte für neue Installationen `1.18.0` (Nutzer, 2026-10-06, nach
   Bildschirmfotos der Einstellungen): Die Standardfolge der Chips ist fest
   (`CHIP_DEFAULT` im Panel; "Alle", Anheft-Marker, Integration, Neu, Ausgefallen,
   Warnungen, Batterie niedrig, Batterie, Bereich, Thread, WLAN, Bluetooth,
   Zigbee, LAN, Cloud, Matter, Netzwerk, Unbekannt, Z-Wave, Schwacher Empfang,
   Update verfügbar, Eigene Einstellung) und gilt, wo `chip_order` leer ist, auch
   für bestehende Installationen; nur eine eigene `connection_order` aus 1.12.0
   ohne `chip_order` behält die alte Anordnung. Inhalt der Meldungen und der
   ausgeblendete Chip "Eigene Einstellung" stehen als `const.NEW_INSTALL_OPTIONS`
   in den Optionen einer neu eingerichteten Instanz (`config_flow`, `options=`);
   bestehende Installationen behalten ihre Werte und den alten Standard
   (`DEFAULT_NOTIFY_FIELDS`, `DEFAULT_BATTERY_FIELDS`). Bereich und Z-Wave bleiben
   sichtbar (Entscheid des Nutzers). Dazu der Fehler, dass die Haftgruppe der
   Chip-Vorschau (sticky, z-index 2) beim Scrollen den Dialog-Kopf überdeckte:
   `isolation: isolate` am Streifen und z-index 4 für Kopf und Aktionsleiste.
   Tests: `chiporder-e2e.mjs` (Schritt 1b prüft die Überdeckung mit
   `elementFromPoint`), `test_init.py`; Standardfolge in `area-`, `chips-`,
   `hidechips-`, `integ-` und `table-e2e` nachgezogen.
   Empfang-Warnschwelle pro Funkart `1.17.0` (Nutzer, 2026-10-06: "Wi-Fi,
   Bluetooth und Zigbee separat", Sollwert und "Aus" dazu; ohne Mockup, auf
   Empfehlung): Optionen `signal_low` {Verbindungsart: Zahl oder "off"} und
   `signal_low_integrations` {Domain: {Verbindungsart: ...}} (`options_api.signal_map`,
   `signal_integrations_map`, `signal_default`; Zahl negativ = dBm, positiv = LQI).
   Geltung: Gerät (`signal_setting`) vor Integration vor global vor festem Standard
   (`SIGNAL_WEAK_*`); eine Zahl gilt nur, wenn ihr Vorzeichen zur Einheit des
   Geräts passt, "off" immer. `list_devices.signal_default` {value, source} je
   Gerät (wie `battery_default`); Panel: `sigOwn(d)` für `devSigLevel` und die
   Verlaufslinie, `sigDefaultOf()` für die Zeilen. Einstellungen: Darstellung ›
   Verbindungsart, Block `_sigGlobalHtml`; Integrations-Detail, Abschnitt
   "Empfang" (`_sigRowsHtml(d, dom)`, `data-sig-mode`/`data-sig` = "Domain|Art",
   Domain leer = global); Entwurf über `_setSig`, Prüfung `_sigInvalid()` (Bereich
   nach Einheit der Gruppe, `_sigGroups()` zählt Geräte mit Empfangswert je Art und
   Integration; die Art ist die des Backends (`connection`), nicht die verfeinerte des
   Panels: ein Matter-Gerät bleibt "matter"). Eine Änderung zählt pro Option, nicht pro Funkart. KI:
   `ai_assessment._signal_limit`. Tests: `test_signal_default.py`,
   `sigtype-e2e.mjs`, Simulator `signal_default`.
   Warnung statt Problem `1.16.0` (Nutzer, 2026-10-06, Mockups
   `docs/mockups/chip-warn-v1/`, V1; Entscheid A): Zwei Stufen. `devOffline(d)` =
   offline, `devWarn(d)` = instabil, Batterie niedrig, schwacher Empfang oder keine
   Daten (ohne Ausfälle; deaktivierte und nicht überwachte zählen nicht). Chips
   `offline` (neu, `const.CHIP_KEYS`, Ansicht `view.offline`, `_offlineOnly`) und
   `problems` (Schlüssel blieb, Anzeige "Warnungen"); beide mit Zahl, nur
   sichtbar, wenn sie zutreffen oder aktiv sind (`_chipsHtml`/`level()`);
   `_problemPass`: ist einer aktiv, zählt Ausfall bzw. Warnung, beide aktiv =
   beides (oder). Zeile `.kwarn` unten in der Kachel (`_heroHtml`, Klasse
   `.kt.offl` als Spalte, `data-warn-open` setzt "Alle" zurück und dann
   "Warnungen"). `chipOrder` ordnet `offline` in älteren Folgen vor `problems`
   ein. "Warnschwelle" in Texten (Panel, HA, README); Optionsnamen unverändert.
   Tests: neue Suite `warn-e2e.mjs`, angepasst `table-`, `hidechips-`,
   `chiporder-`, `signal-`, `override-`, `devset-`, `settings-e2e`.
   Chips anheften `1.15.0` (Nutzer, 2026-10-05, Mockups
   `docs/mockups/chip-pin-v1/`, B): `"pin"` ist ein Schlüssel in `chip_order`
   (`const.CHIP_ORDER_KEYS`), kein Chip; ganz vorn (Standard, fehlt er in älteren
   Folgen, setzt `chipOrder()` ihn nach vorn) = nichts angeheftet. `joinChips(order,
   parts, mode, mark)` setzt die sichtbaren Chips vor `pin` in `<span
   class="chip-pin">` (Modus "group"; Vorschau: Modus "mark" mit Pin-Zeichen);
   CSS: ab 600 px sticky links mit Schatten (`.chips.scrolled`), auf dem Desktop
   `display: contents`; `_guardPin()` löst die Gruppe ab 60 % der Leistenbreite
   (`.too-wide`). Einstellungen: `pinLine` in `exTable` (Linie mit Etikett und
   Griff), Vorschau zusätzlich als Handy-Leiste (`.chip-prev-strip`,
   `_renderSettings` scrollt sie einmal an). Tests: `chiporder-e2e.mjs`
   (Linie, Pfeiltasten, Haftgruppe, Grenze, Scrollen).
   Eine Liste für alle Chips `1.14.0` (Nutzer, 2026-10-05, Mockups
   `docs/mockups/chip-order-v3/`, D2; ersetzt den Block "connections" aus
   1.13.0): `chip_order` enthält `all`, jede Verbindungsart und die übrigen Chips
   (`const.CHIP_ORDER_KEYS`); `options_api._stored_chip_order` macht aus dem
   Block "connections" beim Lesen `all` plus `connection_order`;
   `connection_order` bleibt als Ausgangsfolge (HA-Optionsdialog), das Panel
   leert sie beim Ziehen. Panel: `chipOrder(order, connOrder, counts)` ergänzt
   fehlende Verbindungsarten nach Anzahl hinter die letzte bzw. hinter `all`
   (Gleichstand in der Reihenfolge von `CONN`), `chipKind()`/`joinChips()`
   setzen die Trenner (Auswahlfenster | `all` und Verbindungsarten | Probleme und
   Hinweise), `_chipsHtml` baut jeden Chip als Stück; Einstellungen: eine
   `exTable` mit `x.list` je Zeile (`hide_connections` für Verbindungsarten),
   `fixed` für `all` (Schloss `.fix-badge`), `allKey` "chips" für "Alle
   umschalten", `_chipPreviewHtml` (Vorschau `.chip-prev`), `_setChipOrder`
   (Standardfolge als `[]`). Tests: `chiporder-e2e.mjs` (Ziehen, Pfeiltasten,
   Trenner, Vorschau, Ausblenden, Zurücksetzen), `test_update_check.py`
   (Migration).
   Neustart im Update-Kasten `1.13.1` (Rückfrage des Nutzers, 2026-10-05, ob ein
   HACS-Update das eigene Update behindert): HACS selbst stört nicht
   (`restart` = HACS-`installed_version` > laufende Version aus
   `device_panel/version`, `in_progress` je Entität). Fehler im Panel:
   `v.restarting` wurde nie zurückgesetzt, HA lädt die Seite nach dem
   Neustart nicht neu, "startet neu…" blieb stehen (`version-e2e` umging das
   mit `_version = null`). Jetzt `restartFrom`/`restartAt`: `_loadVersion`
   beendet den Zustand bei anderer laufender Version oder nach
   `RESTART_WAIT_MS` (5 Min.), `_fetch` lädt nach der Rückkehr der Verbindung
   neu; lehnt HA ab (kein Verbindungsfehler), steht `restartError` in der Zeile.
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
