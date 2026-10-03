# Device Panel

[Deutsch](README.de.md)

Home Assistant integration (HACS) with a sidebar panel showing **all devices**:
which ones are offline right now, how often and how long devices fail, and
details such as software version, manufacturer, model and area.

> Early development (0.x). Scope and behaviour may still change.

## Features

- Overview at the top: how many devices are online, the average
  availability of the last 24 hours, which devices are offline right now and
  for how long, and an outage pulse over 24 hours that points out group
  outages (several devices at once, with the shared integration).
  Tapping the pulse opens the devices with outages in 24 hours, most
  first; a point in the pulse shows only the devices that were offline
  then.
- Device list grouped into offline (longest first, highlighted in red),
  unstable (3 or more outages in 24 hours), no data and online; cards on the
  phone. The device column stays in place when the table scrolls sideways.
- Columns for status, connection, availability over 24 hours (strip and
  percentage, the percentage from 1 hour of data), type (e.g. light, outlet, motion, door/window, climate,
  hub/bridge, network, phone/computer, energy/meter), integration with its
  config entry, battery, manufacturer and model, software with update hint;
  optionally area, outages in 24 hours and hub / bridge.
- View per user, saved in Home Assistant and separate for desktop and
  phone: show or hide the columns (desktop, dialog "Customize") or the
  details on the card (phone) with the eye and order them by the handle,
  sort by any column (click on the header), groups or one list, and the
  active filter chips.
- Connection type per device: Zigbee, Z-Wave, Thread, Matter (Thread, Wi-Fi
  or LAN), Bluetooth, Wi-Fi, network, cloud; signal strength in dBm or LQI
  and the hub, bridge or Bluetooth proxy in between.
- Search across all columns (with a button to clear it), filters by
  connection type, "problems only", battery (all battery devices, sorted by
  level), low battery, weak signal and available updates. The number on a
  chip counts with the search and the other filters: as many devices as
  tapping it shows. Tapping an active chip again turns it off; "All"
  clears every filter at once (the search stays). In the
  settings ("Display"), single connection type chips can be hidden and all
  of them dragged into your own order.
- Filter by area: the chip "Area" at the start of the chip row selects one
  or more areas or a whole floor (order as set in Home Assistant, "No area"
  for devices without one). The list shows only their devices, and the
  other chips filter within them. The header (availability, offline now,
  outage pulse, group outages) then counts only these devices as well.
  Saved per user like the view.
- Pop-up per device (like UniFi Dynamic Clients): availability 24 hours,
  outages in 7 days, signal and battery as tiles; connection, integration
  (warns if its config entry is not loaded), device details and all
  entities with their state, the ones that decide whether the device is
  alive marked. Tap an entity for the Home Assistant entity dialog, or open
  the Home Assistant device page. The type and the connection type of the
  device can be changed here if the detection is wrong. The connection type
  can also be set per integration in the settings (for all its devices; the
  device comes first).
- Statistics window from the tiles: availability over 24 hours, 7 or 30 days
  with a timeline, every outage with time and duration, and outages per
  day.
- A device counts as offline after 2 minutes without a sign of life
  (adjustable under "Outage detection", like "unstable from" and the grace
  period after a start). A connectivity sensor decides first; otherwise all
  regular entities must be unavailable. An outage only ends when Home
  Assistant sees the device online again: its duration runs on across
  restarts of Home Assistant. "At least" (≥) only when the start is unknown
  (e.g. the device was online when Home Assistant stopped and gone after the
  start); the tooltip shows the start.
- Availability log for 31 days in its own file (not the recorder). Time when
  Home Assistant was not running counts as "no data", never as an outage of
  its own; the bars show it as such. If a device was offline before and
  after, the numbers count it as one outage. Once after the installation
  the log is filled from the recorder history, as far back as the recorder
  keeps data.
- Hide single devices (button "Hide" in the device pop-up, with "Undo"),
  whole integrations or device types (settings in the panel or options
  dialog of the integration): hidden devices are neither shown nor
  monitored and send no notifications. The settings list the hidden
  devices ("Hidden devices") to show them again. Optionally show service devices (e.g. sun, add-ons) and
  disabled devices (own group, not monitored).
- Battery warning: choose from which level a battery counts as low (5–50 %,
  default 15 %) and how you are told: as a push notification (once per
  device, to a notify service or entity of your choice), as a persistent
  notification in Home Assistant listing all affected devices, both or
  neither. Tapping a push notification opens the device in the panel. The
  push comes immediately or once a day at a chosen time, with the newly
  affected or all devices with a low battery. Per integration (only
  integrations with battery devices are listed) choose the global value, an
  own threshold or off; per device in its pop-up as well. The device comes
  first, then the integration, then the global value.
- Outage notifications: a push as soon as a device counts as offline and,
  if you like, an all clear when it is back online, with the duration of
  the outage (it replaces the outage notification on the phone). Several
  devices at once give one notification with the probable cause. "Report
  only after" (0–60 min) waits before the push; short outages send nothing,
  not even "back online", and a pending outage survives a restart. Choose
  the content (area, integration, connection type, offline since, last
  signal, battery, manufacturer / model) with a preview in the settings.
  The push has the buttons "Open" and "Mute 24 h"; the pop-up shows the
  mute until it ends and "Global setting" lifts it. Per integration the
  columns "Push" and "Persistent" decide which integrations notify; per
  device the notifications can be switched off in its pop-up, e.g. for a
  charger that is often offline on purpose; the device is still monitored.
  Optionally a persistent notification in Home Assistant lists all offline
  devices as long as they are offline, with a link to each device. Off by
  default.
- Battery history: the tile "Battery" in the device pop-up opens the level
  over 24 h, 7 days, 30 days or 3 months as a line, with the warning
  threshold and battery changes; from the recorder (long-term statistics
  beyond its 10 days).
- Weak signal warning per device, in its pop-up: global value (below
  -80 dBm or LQI 61), own threshold or off, for devices that always have a
  weak signal. Marking and the chip "Weak signal" follow.
- Signal history: the tile "Signal" in the device pop-up opens the signal
  over 24 h, 7 or 30 days with median, worst and best value and the warning
  threshold. From the recorder when a sensor provides the signal; for ZHA
  and Bluetooth the panel records it itself (every minute, kept for
  31 days in its own file).
- Battery level as a coloured symbol with fill: green, yellow-green, orange
  and red when low (threshold of the battery warning).
- New devices: "New" next to the name for 3 days after they were added to
  Home Assistant, with their own chip.
- Settings per device at a glance: a symbol next to the name (own battery
  threshold, battery warning off, notifications off, connection type set by
  hand, own signal warning), the chip "Own setting" shows only those
  devices, and the settings list them for resetting, one by one or all at
  once.
- Settings in the panel (gear icon) with updates: check for a new version,
  update via HACS with one click, restart afterwards, optionally offer
  pre-releases ("Enable in HACS" switches on the HACS pre-release option).
  Optional daily check that reports a new version under Settings → Repairs.
  Everything applies with "Save"; the dialog stays open afterwards.

### Planned (see `docs/CONCEPT.md`)

- Monitoring levels with rules, probable cause and radio path in the
  device view.

## Installation

### HACS (custom repository)

1. HACS → ⋮ → Custom repositories → `https://github.com/Diegofuego871/ha-device-panel`,
   type "Integration".
2. Install "Device Panel" and restart Home Assistant.
3. Settings → Devices & services → Add integration → "Device Panel".

**Pre-releases:** versions with `b` or `rc` in the number (for example
`0.1.0b2`) are published as GitHub pre-releases. HACS only installs them if
the "Pre-release" entity on the HACS device of this repository is enabled and
switched on (Settings → Devices & services → HACS → device "Device Panel").
HACS creates this entity disabled. The panel can do this for you: Settings
(gear icon) → "Show pre-releases" → "Enable in HACS".

**Updates:** Settings (gear icon) in the panel show the installed and the
newest version; "Update" installs it via HACS, then restart Home Assistant.

### Manual

Copy `custom_components/device_panel` to `config/custom_components/` and
restart Home Assistant.

### Removal

Settings → Devices & services → "Device Panel" → ⋮ → Delete. This also
deletes the integration's own files (`.storage/device_panel.*`: availability
log, settings per device, reported outages and batteries, shared panel
settings). The registries of Home Assistant are never changed by the
integration. Then remove it in HACS (or delete the folder) and restart.

## Development and tests

- Python with a real Home Assistant: `pip install pytest-homeassistant-custom-component`
  (Python 3.13), then `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT, see [LICENSE](LICENSE).
