# Device Panel

[Deutsch](README.de.md)

**Every device in Home Assistant at a glance:** who is offline right now, how often and how long devices fail, how full the batteries are and how good the signal is.

<p align="center"><img src="docs/screenshots/en/overview.png" alt="Overview with availability, offline devices, outage pulse and device list" width="900"></p>

## What you get

- **Overview:** devices online, who is offline and since when, an outage pulse over 24 hours with group outages
- **Device list** grouped into offline, unstable and online, with search, filters by area and integration, filter chips and your own columns
- **Per device:** availability, outages, signal and battery in a pop-up, with history and statistics
- **Battery forecast:** how long the battery lasts until its warning threshold, without AI
- **Notifications:** push and persistent notification for outages and low batteries, with a timeline of when what arrives; defaults per integration, overrides per device
- **Optional AI assessment:** a guess at the cause on a button press, prompt adjustable in expert mode
- **Settings in the panel,** including updates via HACS, in German and English
- **Phone and desktop,** with the view saved per user

## Screenshots

### Outages at a glance

Offline devices with the time they have been gone, unstable devices and the outage pulse. Tapping the pulse lists the devices with outages, a point in the pulse shows who was gone then.

<p align="center"><img src="docs/screenshots/en/pulse.png" alt="Window with the outage pulse and the devices with outages in 24 hours" width="720"></p>

### Everything about one device

Availability, outages, signal and battery as tiles, plus connection, integration, manufacturer, model, software and all entities. Type and connection type can be corrected here, and the device can be renamed (in Home Assistant, entity IDs stay).

<p align="center"><img src="docs/screenshots/en/popup.png" alt="Device pop-up with statistics, connection and device details" width="720"></p>

### History: availability, signal, battery

| Availability | Signal | Battery with forecast |
|---|---|---|
| <img src="docs/screenshots/en/availability.png" alt="Availability over 7 days with every outage"> | <img src="docs/screenshots/en/signal.png" alt="Signal history with median, range and warning threshold"> | <img src="docs/screenshots/en/battery.png" alt="Battery history with battery change, warning threshold and forecast"> |

The forecast calculates from the last battery change (at most one year) up to the warning threshold of the device, and says how sure it is.

### Settings per device

Every device can override the defaults in its pop-up: its own "offline after" time (or no monitoring), its own battery warning threshold, its own signal warning, and outage and online notifications switched off or muted for 24 hours, for example for a charger that is often offline on purpose. Each row shows where the value comes from and what the default would be. A symbol next to the name in the list shows devices with their own settings.

<p align="center"><img src="docs/screenshots/en/device-settings.png" alt="Device pop-up: settings for this device with own time, own battery warning threshold and notifications off" width="720"></p>

### Notifications you control

| Overview as a timeline | Settings per integration |
|---|---|
| <img src="docs/screenshots/en/settings-monitor.png" alt="Settings: timeline of when a device counts as offline and when the push arrives"> | <img src="docs/screenshots/en/settings-integrations.png" alt="Settings: list of integrations with what differs from the defaults"> |

### AI assessment (optional, off by default)

| Answer in the pop-up | Expert mode: prompt |
|---|---|
| <img src="docs/screenshots/en/ai.png" alt="Device pop-up with the AI assessment"> | <img src="docs/screenshots/en/settings-ai.png" alt="Settings with the prompt in expert mode"> |

Only on a button press, with an AI task of Home Assistant. No keys, credentials or IDs are sent. Groups of facts such as `{facts_area}` and `{facts_hub}` can be used in the prompt, a preview shows the exact text.

### On the phone

| List | Pop-up | Battery |
|---|---|---|
| <img src="docs/screenshots/en/overview-mobile.png" alt="Phone: cards" width="260"> | <img src="docs/screenshots/en/popup-mobile.png" alt="Phone: pop-up" width="260"> | <img src="docs/screenshots/en/battery-mobile.png" alt="Phone: battery history" width="260"> |

## Good to know

- A device counts as offline after 2 minutes without a sign of life (adjustable, per integration and per device).
- A signal counts as weak below -80 dBm or LQI 61. The warning threshold can be set per connection type, globally, per integration and per device, or switched off.
- An outage lasts until Home Assistant sees the device online again, also across restarts. "At least" (≥) means the start is not known.
- The availability log covers 31 days in its own file, not the recorder. Time while Home Assistant was not running counts as "no data".
- Hidden devices, integrations and device types are neither shown nor monitored. Every filter chip can be hidden and reordered in the settings.
- Battery warning from 5 to 50 % (default 15 %), per integration and per device.
- Signal history comes from the recorder or, for ZHA, Bluetooth and unrecorded sensors, from the panel itself.
- Every setting shows where it comes from: default, integration or device.
- Nothing security-relevant (tokens, keys) is ever shown in the panel.

## Installation

### HACS (custom repository)

1. HACS → ⋮ → Custom repositories → `https://github.com/Diegofuego871/ha-device-panel`, type "Integration".
2. Install "Device Panel" and restart Home Assistant.
3. Settings → Devices & services → Add integration → "Device Panel".

Updates: the settings (gear icon) show the installed and the newest version and update via HACS. Pre-releases (`b` or `rc` in the number) are optional: "Show pre-releases" → "Enable in HACS".

### Manual

Copy `custom_components/device_panel` to `config/custom_components/` and restart Home Assistant.

### Removal

Settings → Devices & services → "Device Panel" → ⋮ → Delete. This also deletes the integration's own files (`.storage/device_panel.*`). The registries of Home Assistant are never changed. Then remove it in HACS and restart.

## Development and tests

- Python with a real Home Assistant: `pip install pytest-homeassistant-custom-component` (Python 3.13), then `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`. The screenshots in this file come from `node readme-shots.mjs` (invented data).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT, see [LICENSE](LICENSE).
