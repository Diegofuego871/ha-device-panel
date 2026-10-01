# Device Panel

[Deutsch](README.de.md)

Home Assistant integration (HACS) with a sidebar panel showing **all devices**:
which ones are offline right now, how often and how long devices fail, and
details such as software version, manufacturer, model and area.

> Early development (0.x). Scope and behaviour may still change.

## Features (planned, see `docs/CONCEPT.md`)

- Table of all devices with status, area, integration, manufacturer/model
  and software version; devices that are offline are listed first.
- Availability per device for 24 h / 7 days / 30 days, number and length of
  outages, timeline.
- Search, filters, sortable and configurable columns, desktop and phone.

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
