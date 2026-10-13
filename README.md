# Device Panel

[Deutsch](README.de.md)

**Every device in Home Assistant at a glance:** who is offline right now, how often and how long devices fail, how full the batteries are and how good the signal is.

<p align="center"><img src="docs/screenshots/en/overview.png" alt="Overview with availability, offline devices, outage pulse and device list" width="900"></p>

## What you get

- **Overview:** devices online, who is offline and since when, an outage pulse over 24 hours with group outages
- **Device list** grouped into offline, unstable and online, with search, filters by area and integration, filter chips (including a favorites heart) and your own columns
- **Per device:** availability, outages, signal and battery in a pop-up, with history and statistics
- **Notifications you control:** outage, back online, low battery and new devices as push (each title starts with a fitting emoji) or persistent notification, per integration; a push shows the icon of its integration and an emoji you can change per notification; each tab (outage, battery, charging, new devices, updates) can send to its own recipient, by default the global target
- **Magic Push:** your own messages per device without an automation: pick a value, say when (above, below, is, changes, optionally several conditions linked with And/Or and groups, for how long, how long it must stay normal before it is reset, and where each is reset), choose the recipient (optionally as a critical notification with a volume) and how often to repeat, write the title and the content with variables that fit the value, and see a preview and a look back at the last 24 hours before you save; the assistant opens in its own window (full screen on the phone), name, rename and delete messages in the tab "Magic Push" of the device, any entity of Home Assistant can serve as the value, and one overview in the settings lists all messages of all devices in one card per device, with search and filter
- **Timer:** switch an entity of a device once or on a schedule, without an automation: pick the entity and the action (on, off, toggle), optionally switch back after a while, and say when (in X minutes, once at a date and time, or repeating daily, weekly on chosen weekdays or monthly), with a "Run now" test button for the chosen switch and a check of the next runs before you save; optionally a push reminder at the moment it switches (fixed content with a preview, recipient selectable per timer, default is a recipient for all timers in the timer settings, otherwise the push target of the settings); the engine runs in Home Assistant with its time zone, so a timer also fires with the panel closed and after a restart (within a catch-up window you set); the assistant opens in its own window (full screen on the phone), the timers of a device are in the tab "Timer", and the timers app of the launcher (a stopwatch button in the header while it is a favorite) opens an overview of all timers in one card per device (a pop-up on the desktop, full screen on the phone), with search and filter (edit, switch on or off, delete; a heart marks favorite timers, which get their own tab; a "+" button there adds a timer, with the device chosen first)
- **Charging and updates:** filter chip "Charging" with a green mark and a charge bar (showing the target when "Full from" is below 100 %) for devices that charge right now (without a charging indicator of its own, a device counts only with the charging notification switched on), optional push when a device is fully charged or the charge stops early, and optionally a live activity (iPhone) or live update (Android 16) with the charge progress up to the target of each device (quiet updates, off by default), and an update reminder (daily, weekly or immediately) that replaces your own automations; both off by default; the update reminder can be set per app, per integration and per firmware
- **App launcher:** a button in the header opens a launcher (with the symbols and colors of the settings of Home Assistant) with useful pages: the timers, Magic Push and the log of this integration, pages of Home Assistant (automations, scenes, scripts, helpers, devices, tools and more; administrators only for the management pages) and your own links, created in edit mode (a page in Home Assistant, or an external link that always opens in a new browser tab, with its favicon as icon if you like). A heart marks up to five favorites that get their own buttons in the header (on the phone only the first one); edit mode sorts by dragging, hides apps with the eye and switches between grid and list. Everything is saved per user
- **Log:** the launcher opens a log (large on the desktop, full screen on the phone) that shows what the notifications decide and why one did not come, with filter, search and an optional debug mode (switched on for 48 hours, also across restarts of Home Assistant)
- **Battery forecast:** how long the battery lasts until its warning threshold, without AI
- **Notifications:** push and persistent notification for outages and low batteries, with a timeline of when what arrives; defaults per integration, overrides per device
- **Optional AI assessment:** a guess at the cause on a button press, prompt adjustable in expert mode
- **Settings in the panel,** including updates via HACS, in German and English; the same tabs (Outage, Battery, Charging, New, Signal) in the global settings, in each integration and on each device
- **Phone and desktop,** with the view saved per user

## Screenshots

### Outages at a glance

Offline devices with the time they have been gone, unstable devices and the outage pulse. Tapping the pulse lists the devices with outages, a point in the pulse shows who was gone then.

<p align="center"><img src="docs/screenshots/en/pulse.png" alt="Window with the outage pulse and the devices with outages in 24 hours" width="720"></p>

### Everything about one device

Availability, outages, signal and battery as tiles, plus connection, integration, manufacturer, model, software and all entities. Type and connection type can be corrected here (or set once per integration in the settings), and the device can be renamed (in Home Assistant, entity IDs stay).

<p align="center"><img src="docs/screenshots/en/popup.png" alt="Device pop-up with statistics, connection and device details" width="720"></p>

### History: availability, signal, battery

| Availability | Signal | Battery with forecast |
|---|---|---|
| <img src="docs/screenshots/en/availability.png" alt="Availability over 7 days with every outage"> | <img src="docs/screenshots/en/signal.png" alt="Signal history with median, range and warning threshold"> | <img src="docs/screenshots/en/battery.png" alt="Battery history with battery change, warning threshold and forecast"> |

The forecast calculates from the last battery change (at most one year) up to the warning threshold of the device, and says how sure it is.

### Settings per device

Every device can override the defaults in the "Settings" tab of its pop-up: its own "offline after" time (or no monitoring), its own battery warning threshold, its own signal warning, and outage and online notifications switched off or muted for 24 hours, for example for a charger that is often offline on purpose. Each row shows where the value comes from and what the default would be. A symbol next to the name in the list shows devices with their own settings.

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
- Battery warning from 1 to 50 % (default 15 %), per integration and per device.
- Device type and connection type are detected automatically. You can fix either per integration; a value set by hand on the device comes first. The type only applies in the panel, not in Home Assistant.
- Signal history comes from the recorder or, for ZHA, Bluetooth and unrecorded sensors, from the panel itself.
- Every setting shows where it comes from: default, integration or device.
- Changes in the device pop-up and in the settings take effect only with "Save". Closing with unsaved changes asks "Discard changes?".
- Nothing security-relevant (tokens, keys) is ever shown in the panel.

## Installation

### HACS (custom repository)

1. HACS → ⋮ → Custom repositories → `https://github.com/Diegofuego871/ha-device-panel`, type "Integration".
2. Install "Device Panel" and restart Home Assistant.
3. Settings → Devices & services → Add integration → "Device Panel".

Updates: the settings (gear icon) show the installed and the newest version and update via HACS. Pre-releases (`b` or `rc` in the number) are optional: "Show pre-releases" → "Enable in HACS". Optionally "Install updates automatically" (needs the daily check): a found version is installed through HACS, you only restart Home Assistant yourself; a red dot on the gear shows that the restart is pending. The daily check can run at a set time, and an optional push (once per version, recipient selectable) tells you about a found or installed version.

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
