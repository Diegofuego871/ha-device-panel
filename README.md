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
- Device list grouped into offline (longest first, highlighted in red),
  unstable (3 or more outages in 24 hours), no data and online; cards on the
  phone. The device column stays in place when the table scrolls sideways.
- Columns for status, connection, availability over 24 hours (strip and
  percentage), type (e.g. light, outlet, motion, door/window, climate,
  hub/bridge, network, phone/computer, energy/meter), integration with its
  config entry, battery, manufacturer and model, software with update hint.
- Connection type per device: Zigbee, Z-Wave, Thread, Matter (Thread, Wi-Fi
  or LAN), Bluetooth, Wi-Fi, network, cloud; signal strength in dBm or LQI
  and the hub, bridge or Bluetooth proxy in between.
- Search across all columns, filters by connection type, "problems only",
  low battery, weak signal and available updates.
- Pop-up per device (like UniFi Dynamic Clients): availability 24 hours,
  outages in 7 days, signal and battery as tiles; connection, integration
  (warns if its config entry is not loaded), device details and all
  entities with their state, the ones that decide whether the device is
  alive marked. Tap an entity for the Home Assistant entity dialog, or open
  the Home Assistant device page. The type of the device can be changed
  here if the detection is wrong.
- Statistics window from the tiles: availability over 24 hours, 7 or 30 days
  with a timeline, every outage with time and duration, and outages per
  day.
- A device counts as offline after 2 minutes without a sign of life
  (adjustable under "Outage detection", like "unstable from" and the grace
  period after a start). A connectivity sensor decides first; otherwise all
  regular entities must be unavailable. Outages that started right after a
  restart of Home Assistant are shown as "at least" (≥).
- Availability log for 31 days in its own file (not the recorder). Time when
  Home Assistant was not running counts as "no data", never as an outage.
- Hide whole integrations or device types (settings in the panel or options
  dialog of the integration): hidden devices are neither shown nor
  monitored. Optionally show service devices (e.g. sun, add-ons) and
  disabled devices (own group, not monitored).
- Battery warning: choose from which level a battery counts as low (5–50 %,
  default 15 %) and how you are told: as a push notification (once per
  device, to a notify service or entity of your choice), as a persistent
  notification in Home Assistant listing all affected devices, both or
  neither. Tapping a push notification opens the device in the panel. The
  push comes immediately or once a day at a chosen time, with the newly
  affected or all devices with a low battery. The threshold can also be set
  per integration (only integrations with battery devices are listed) and
  per device in its pop-up (own threshold or off).
- Outage notifications: a push as soon as a device counts as offline and,
  if you like, an all clear when it is back online, with the duration of
  the outage (it replaces the outage notification on the phone). Several
  devices at once give one notification with the probable cause. Per
  device they can be switched off in its pop-up, e.g. for a charger that is
  often offline on purpose; the device is still monitored. Off by default.
- Settings per device at a glance: a symbol next to the name (own battery
  threshold, battery warning off, notifications off), the chip "Own
  setting" shows only those devices, and the settings list them for
  resetting, one by one or all at once.
- Settings in the panel (gear icon) with updates: check for a new version,
  update via HACS with one click, restart afterwards, optionally offer
  pre-releases ("Enable in HACS" switches on the HACS pre-release option).
  Optional daily check that reports a new version under Settings → Repairs.

### Planned (see `docs/CONCEPT.md`)

- Columns, sorting and filters per user, separately for desktop and phone.

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

## Development and tests

- Python with a real Home Assistant: `pip install pytest-homeassistant-custom-component`
  (Python 3.13), then `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT, see [LICENSE](LICENSE).
