# Device Panel

[Deutsch](README.de.md)

Home Assistant integration (HACS) with a sidebar panel showing **all devices**:
which ones are offline right now, how often and how long devices fail, and
details such as software version, manufacturer, model and area.

> Early development (0.x). Scope and behaviour may still change.

## Features

- Overview at the top: how many devices are online, which ones are offline
  right now and for how long, plus low batteries, weak signal and available
  updates (tap to filter).
- Device list grouped into offline (longest first, highlighted in red), no
  data and online; cards on the phone.
- Connection type per device: Zigbee, Z-Wave, Thread, Matter (Thread, Wi-Fi
  or LAN), Bluetooth, Wi-Fi, network, cloud; signal strength in dBm or LQI
  and the hub, bridge or Bluetooth proxy in between.
- Battery level, software version with update hint, integration,
  manufacturer and model; search across all columns, filters by connection
  type and "problems only".
- A device counts as offline after 2 minutes without a sign of life. A
  connectivity sensor decides first; otherwise all regular entities must be
  unavailable. Outages that started right after a restart of Home Assistant
  are shown as "at least" (≥).

### Planned (see `docs/CONCEPT.md`)

- Columns, sorting and filters per user, separately for desktop and phone.
- Settings in the panel, updates with pre-releases, flexible monitoring
  rules, device view with history, push notifications.

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
HACS creates this entity disabled.

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
