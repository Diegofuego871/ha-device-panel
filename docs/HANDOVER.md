# Übergabe: Stand und nächste Schritte

Einstieg für jede neue Claude-Code-Session. Zuerst diese Datei lesen, dann
`CLAUDE.md`, `docs/CONCEPT.md`, `docs/LEARNINGS.md`, `docs/DESIGN.md`.

## Stand (2.21.0, Timer)

- 2.21.0 (Wunsch des Nutzers, Mockups `docs/mockups/timer-v1`): Timer, die eine schaltbare Entität eines Geräts einmalig
  (Countdown "In X Min." oder Datum mit Uhrzeit) oder wiederholt (täglich, wöchentlich mit Wochentagen, monatlich) schalten,
  optional mit "danach zurückschalten" und mit Push pro Timer (Schalter, fester Inhalt, Vorschau, Empfänger wählbar,
  Standard = `effective(hass)["notify_service"]`; Push nur, wenn der Timer schaltet).
  **Backend** `timers.py`: Klasse `TimerManager` (Speicher `.storage/device_panel.timers` mit `timers` und `runtime`; je Timer
  ein `async_track_point_in_utc_time` für min(fällig, Zurückschalten); `asyncio.Lock`; Toleranz = max(`timers_catch_up` * 60,
  90 s), Verpasstes wird übersprungen (wiederholt: nächster Termin, einmalig: erledigt); zwei Wiederholungen nach 300 s;
  Countdown räumt sich nach 86400 s auf; Zeitzone von HA, Sommerzeit über UTC-Rundweg, monatlich fällt auf den letzten
  Tag, `mday = -1` = letzter Tag), `occurrence_after/first_due/next_runs`, `TIMER_SCHEMA`, `switchable_entities`,
  `timer_payload`. Befehle in `timers_ws.py` (`device_panel/timer_get|list|save|delete|enable|run|preview|test`).
  Push-Texte in `push.py` (`timer_*`), Protokoll-Kategorie "timer" in `activity.py`. Optionen `timers_pause`,
  `timers_catch_up` (Minuten, 0 bis 60, Standard 10), `timers_notify_error` (Standard an).
  **Panel** `panel/timers.js` (`TimerUi`, wie `magic-push.js`): Reiter "Timer" im Popup (Behälter `.tm-root`, `attach(root)`
  nach jedem Neuzeichnen), Assistent in eigenem Fenster `dialog.magic-dlg.timer-dlg` (Magic-Push-CSS `mgw-*`, `mg-*`;
  Schlüssel `data-tm`, in `_initSeg` über `dataset.tm`), Übersicht in den Einstellungen (Abschnitt "timers", `data-set="timer-*"`,
  Suchschlüssel `timers`). Reiterleiste: fünf Reiter, auf dem Handy (bis 600 px) Symbole per `::before`. Simulator
  `tests/panel/sim/ha-sim.html` kennt die Timer-Befehle; Suite `timer-e2e` (258 Prüfungen), Python `tests/test_timers.py`.
  Offen: Entscheide 1 bis 5 und 7 der Mockup-Fragen sind nach Empfehlung gefallen (siehe `docs/mockups/timer-v1/README.md`),
  Marke "⏱ n" und Chip "Mit Timer" in der Geräteliste fehlen; nichts auf einem echten Gerät und Handy geprüft (vor allem
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
  Meldung) statt `_resolve` ein Timer in `self._rtimers` (`_on_reset_timer`); gilt die Bedingung vorher wieder (oder liegt
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
  `cond_met`, Variablen `render`, Klasse `MagicPush` mit Zustandsverfolgung, Timern für Dauer und Wiederholung,
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
