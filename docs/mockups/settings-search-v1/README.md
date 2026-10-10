# Mockups Suchfeld in den Einstellungen (2026-10-09)

Wunsch des Nutzers: lange Listen in den Einstellungen filterbar machen.
Varianten (`1-Varianten.png`): **A (Empfehlung)** Suchfeld oben in jeder langen Liste (ab 8 Einträgen)
mit Trefferzahl; B wie A, aber klebend; C ein Suchfeld im Kopf, filtert über alle Abschnitte.
Entscheid des Nutzers: A (2026-10-10), umgesetzt in 1.28.0.
Kandidaten: Geräte im Panel (Integrationen, Typen, Geräte), Überwachung › Integrationen,
Verbindungsart pro Integration, "Auf Geräten" (Ausnahmen), Batterie/Empfang pro Integration,
Filter-Chips; im Kopf der Integrations-Chip (hat noch keine Suche, der Bereichs-Chip hat eine).
Neu rendern: `CHROMIUM_PATH=... node docs/mockups/settings-search-v1/src/render.mjs`
