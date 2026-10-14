# Device Panel

[Deutsch](README.de.md)

**Every device in Home Assistant at a glance:** who is offline right now, how often and how long devices fail, how full the batteries are, how good the signal is, and notifications that you control from one place.

<p align="center"><img src="docs/screenshots/en/overview.png" alt="Overview with availability, offline devices, outage pulse and device list" width="900"></p>

## Key features

- **Everything at a glance:** devices online, who is offline and since when, unstable devices, an outage pulse over 24 hours with group outages, and a list you can search, filter and sort
- **Availability per device:** statistics for 24 hours, 7 and 30 days with every outage and its duration, kept for 31 days in its own log, also across restarts
- **Battery overview with notifications:** a colored battery symbol on every device, a warning threshold (default 15 %), push or persistent notification, a history of up to 12 months with a forecast of how long the battery lasts, and a message when a device is fully charged
- **Signal overview with warnings:** signal strength in dBm or LQI on every device, a warning threshold per connection type, a history with median and range, and for Bluetooth the receiver (adapter or proxy) a device is or was connected through
- **Notifications on three levels:** set a default once, change it per integration, override it on a single device; every setting shows where its value comes from (graphic below)
- **Magic Push:** your own messages per device without an automation: pick a value, say when it should notify, write the text, done
- **Timer:** switch an entity of a device once or on a schedule without an automation, with a test button and a preview of the next runs
- **Charging and updates:** "Charging" chip with a charge bar, push when a device is full, live activity (iPhone) or live update (Android 16), and an update reminder that replaces your own automations
- **New devices:** a "New" mark and chip for three days, and an optional push with all devices that appeared
- **App launcher and log:** one button for useful pages of Home Assistant and your own links, plus a log that shows what the notifications decide and why one did not come
- **Optional AI assessment:** a guess at the cause on a button press, only with an AI task of Home Assistant
- **Yours alone:** columns, sort order, filters, favorites and start page are saved per user, on phone and desktop alike
- **Everything in the panel:** all settings, updates via HACS (also automatically), German and English

## Overview and device list

The top shows how many devices are online, who is offline right now and the outage pulse. Below, the list is grouped into offline, unstable and online devices. Every row shows status, connection, availability of the last 24 hours, device type, integration, battery, manufacturer and software. Type and connection type (Zigbee, Thread, Z-Wave, Matter, Bluetooth, Wi-Fi, Ethernet, network, cloud) are detected automatically and can be corrected per integration or per device.

### Outages at a glance

Offline devices with the time they have been gone, unstable devices (three or more outages in 24 hours) and the outage pulse. Tapping the pulse lists the devices with outages, a point in the pulse shows who was gone then. When three or more devices fail at once, the panel names the likely common cause, for example the integration or its hub.

<p align="center"><img src="docs/screenshots/en/pulse.png" alt="Window with the outage pulse and the devices with outages in 24 hours" width="720"></p>

### Search, filter, sort

Search runs over all columns. Filter chips narrow the list: warnings, offline, battery, charging, new devices, devices with their own settings, favorites, each connection type, and an area and an integration filter that combine with the chips. Hidden devices, integrations and device types are neither shown nor monitored.

| Warnings | Battery | Area filter |
|---|---|---|
| <img src="docs/screenshots/en/warnings.png" alt="List filtered by the chip Warnings"> | <img src="docs/screenshots/en/batteries.png" alt="List filtered by the chip Battery"> | <img src="docs/screenshots/en/area.png" alt="Area filter with floors and areas"> |

| Charging | New devices |
|---|---|
| <img src="docs/screenshots/en/charging.png" alt="List filtered by the chip Charging with charge bars"> | <img src="docs/screenshots/en/new.png" alt="List filtered by the chip New"> |

### Your own view

The button "Columns" opens a dialog: show or hide columns with the eye, drag them into any order, group the list or show it as one list. Columns and order are saved separately for desktop and phone. A heart marks favorites (own chip), chips can be hidden, reordered and pinned, and in the settings under "View" you can make the panel your own start page in Home Assistant (browser and Companion app).

<p align="center"><img src="docs/screenshots/en/columns.png" alt="Dialog Columns with eye and drag handle" width="560"></p>

## Everything about one device

A tap on a device opens a pop-up with availability, outages, signal and battery as tiles, plus connection, integration, manufacturer, model, software and all entities. The device can be renamed (in Home Assistant, entity IDs stay), marked as a favorite, hidden, and opened on its page in Home Assistant. A warning names its reason in the header.

<p align="center"><img src="docs/screenshots/en/popup.png" alt="Device pop-up with statistics, connection and device details" width="720"></p>

### Statistics and history

Each tile opens a window with 24 hours, 7 or 30 days. Availability shows every outage with start, end and duration and the outages per day.

<p align="center"><img src="docs/screenshots/en/availability.png" alt="Availability over 7 days with every outage" width="560"></p>

### Signal and Bluetooth path

The signal history shows the median as a line and the range from worst to best value as an area, with the warning threshold of the device. It comes from the recorder or, for ZHA, Bluetooth and unrecorded sensors, from the panel itself. Bluetooth devices also get the section "Connected via": a bar shows through which receiver (Bluetooth adapter or proxy) the device was heard, gaps are hatched, and a legend gives share and average signal per receiver plus the latest switches. The panel records this path itself, from the update on.

| Signal history | Connected via (Bluetooth) |
|---|---|
| <img src="docs/screenshots/en/signal.png" alt="Signal history with median, range and warning threshold"> | <img src="docs/screenshots/en/signal-via.png" alt="Section Connected via with receivers, share and switches"> |

### Battery with forecast

The battery history reaches back up to 12 months, with the battery change marked. The forecast calculates from the last battery change (at most one year) up to the warning threshold of the device, and says how sure it is.

<p align="center"><img src="docs/screenshots/en/battery.png" alt="Battery history with battery change, warning threshold and forecast" width="560"></p>

### Settings per device

Every device can override the defaults in the tab "Settings" of its pop-up: its own "offline after" time (or no monitoring), battery warning, signal warning, charging, and outage and online notifications switched off. Each row shows where the value comes from and what the default would be. A symbol next to the name in the list marks devices with their own settings.

<p align="center"><img src="docs/screenshots/en/device-settings.png" alt="Device pop-up: settings for this device with own time, own battery warning threshold and notifications off" width="720"></p>

## Notifications

Everything that notifies you follows one principle: you set a default once, change it for all devices of an integration, and override it on a single device where needed. The more specific level wins.

### The principle

<p align="center"><img src="docs/graphics/en/notification-levels.png" alt="Three levels General, Integration and Device with an example and a table of what can be set where" width="900"></p>

- **General:** in the settings under "Monitoring and notifications", the default for all devices
- **Integration:** in the same place, tab "Integrations": a list of all integrations with what differs from the default, and a detail page per integration with its own tabs
- **Device:** in the pop-up of the device, tab "Settings": only this device, with the origin of every value
- **Origin:** every setting says where it comes from (default, integration or device), and a chip "Own setting" filters devices that have their own values; in the settings they can be reset one by one or all at once

### From outage to notification

<p align="center"><img src="docs/graphics/en/notification-flow.png" alt="Six steps from the outage of a device to the notification, with the level that decides each step" width="900"></p>

- **Two times, not added:** "Offline after" (default 2 minutes) decides when the panel shows the device as offline, "Report only after" decides when the notification is sent; both run from the start of the outage, and the second cannot be shorter than the first
- **Group message:** from three devices at once there is one message with the likely cause instead of many
- **Back online:** "Back online" with the duration of the outage replaces the outage message
- **Buttons in the message:** open the device in the panel, or mute the device for 24 hours in the Companion app
- **Persistent notification:** optionally also one message in Home Assistant while devices are offline, per integration

### Where the notification goes

<p align="center"><img src="docs/graphics/en/notification-targets.png" alt="One push target for everything, an own target per tab, Magic Push and timers choose their recipient themselves" width="900"></p>

- **One push target:** a notify service, group or notify entity for all messages
- **Own target per tab:** outage, battery, charging, new devices, updates, panel updates and timers can each send to another recipient
- **Look:** every notification shows the icon of its integration and an emoji that you can change per kind; each title starts with a fitting emoji

### The kinds of notifications

Each kind has its own tab in the settings. Outage, battery, charging, new devices and signal are also tabs of every integration, and outage, battery, charging and signal tabs of every device (a device only shows the tabs it has something for: without a battery there is no battery or charging tab, without a signal reading no signal tab), so the three levels apply to each of them.

| Outage | Battery | Charging |
|---|---|---|
| <img src="docs/screenshots/en/settings-outage.png" alt="Tab Outage: offline after, report only after, detection and message"> | <img src="docs/screenshots/en/settings-battery.png" alt="Tab Battery: warning threshold and push"> | <img src="docs/screenshots/en/settings-charge.png" alt="Tab Charging: rise, full from, notification and live activity"> |

| New | Updates | Signal |
|---|---|---|
| <img src="docs/screenshots/en/settings-new.png" alt="Tab New: collecting window and content"> | <img src="docs/screenshots/en/settings-updates.png" alt="Tab Updates: update reminder"> | <img src="docs/screenshots/en/settings-sig.png" alt="Tab Signal: warning threshold per connection type"> |

- **Outage and back online:** push, persistent notification and group message, with start, duration, area and integration
- **Battery:** once per device when it falls below the threshold (default 15 %, from 1 to 50 %), immediately or as a daily summary, with a persistent notification of all affected devices
- **Charging:** push when a device is fully charged ("Full from", default 100 %) or the charge stops early, off by default and only for rechargeable devices; devices that charge right now get the chip "Charging" with a green mark and a charge bar
- **Live activity:** optionally the charge progress on the lock screen (iPhone, live activity) or as a live update (Android 16), with quiet updates, off by default
- **New devices:** a collecting window, then one message with all devices that appeared; the device carries a "New" mark for three days
- **Update reminder:** daily, weekly or immediately for updates of Home Assistant, add-ons, HACS and device firmware, adjustable per app, per integration and per firmware, optionally repeated while an update stays open; replaces two hand-made automations
- **Signal:** a warning threshold per connection type, per integration and per device (default weak below -80 dBm or LQI 61), also switchable off
- **Panel updates:** an optional push once per version when a new version of the panel is found or installed

<p align="center"><img src="docs/screenshots/en/settings-integrations.png" alt="Settings: list of integrations with what differs from the defaults" width="720"></p>

<p align="center"><img src="docs/screenshots/en/integ-detail.png" alt="Detail of an integration with tabs for outage, battery, charging, new, signal and devices" width="720"></p>

## Magic Push: your own messages

Your own notifications per device without an automation, in the tab "Magic Push" of the device.

<p align="center"><img src="docs/screenshots/en/magic-tab.png" alt="Tab Magic Push of a device with two messages" width="560"></p>

- **Any value:** pick a value of the device, or any entity of Home Assistant that stays tied to the device
- **When:** above, below, is, or changes; several conditions linked with And/Or and groups; for how long it must hold; how long it must stay normal before it resets, and at which value
- **Recipient:** any notify target, optionally as a critical notification with a volume from 1 to 10, and how often to repeat
- **Text:** title and content with variables that fit the value (name, value, unit, threshold, area and more), a preview and a look back at the last 24 hours before you save
- **Assistant:** opens in its own window (full screen on the phone), five steps: conditions, how long, delivery, text, name
- **Overview:** one list in the settings shows all messages of all devices, one card per device, with search and filter

<p align="center"><img src="docs/screenshots/en/magic-wizard.png" alt="Magic Push assistant, step 1: what should be monitored" width="560"></p>

<p align="center"><img src="docs/screenshots/en/settings-magic.png" alt="Settings: all Magic Push messages of all devices, one card per device" width="720"></p>

## Timer

Switches an entity of a device once or on a schedule, without an automation.

| Timer of a device | Assistant: when |
|---|---|
| <img src="docs/screenshots/en/timer-tab.png" alt="Tab Timer of a device with a timer"> | <img src="docs/screenshots/en/timer-wizard.png" alt="Timer assistant, step 2: when should it switch"> |

- **What:** pick the entity and the action (on, off, toggle), optionally switch back after a while
- **When:** in X minutes, once at a date and time, or repeating daily, weekly on chosen weekdays or monthly, with a check of the next runs before you save
- **Test:** a button "Run now" tries the chosen switch
- **Reminder:** optionally a push at the moment it switches, with a preview and its own recipient
- **Runs in Home Assistant:** with its time zone, so a timer also fires with the panel closed and after a restart (within a catch-up window you set), and "Pause all timers" is one switch
- **Overview:** the timer button of the launcher opens all timers in one card per device, with search and filter, edit, switch on or off, delete and favorites

<p align="center"><img src="docs/screenshots/en/timers-all.png" alt="Window with all timers, one card per device" width="720"></p>

## App launcher and log

A button in the header opens a launcher with useful pages, in the symbols and colors of the settings of Home Assistant.

| App launcher | Log |
|---|---|
| <img src="docs/screenshots/en/launcher.png" alt="App launcher with favorites, Device Panel and Home Assistant pages"> | <img src="docs/screenshots/en/log.png" alt="Log with entries of the notifications and a filter"> |

- **Pages:** timers, Magic Push and the log of this integration, pages of Home Assistant (automations, scenes, scripts, helpers, devices, entities, integrations, tools and more; administrators only for the management pages)
- **Your own links:** a page in Home Assistant or an external link that opens in a new browser tab, with its favicon as icon if you like
- **Favorites:** a heart marks up to five apps that get their own buttons in the header
- **Edit mode:** sort by dragging, hide apps with the eye, grid or list; everything is saved per user
- **Log:** shows what the notifications decide and why one did not come, with filter and search, and an optional debug mode (switched on for 48 hours, also across restarts)

## Settings in the panel

The gear opens all settings in German or English, in sections. The version bar on top shows the installed and the newest version and updates via HACS.

| Devices in the panel | View | Timers | Panel version |
|---|---|---|---|
| <img src="docs/screenshots/en/settings-section-devices.png" alt="Section Devices in the panel"> | <img src="docs/screenshots/en/settings-section-look.png" alt="Section View with start page and filter chips"> | <img src="docs/screenshots/en/settings-section-timers.png" alt="Section Timers"> | <img src="docs/screenshots/en/settings-section-updates.png" alt="Section Panel version with daily check and automatic installation"> |

- **Devices in the panel:** hide integrations, device types and single devices, set type and connection type per integration, see and reset devices with their own settings
- **Monitoring and notifications:** the tabs Overview (a timeline per notification), Outage, Battery, Charging, New, Updates, Signal, Magic Push and Integrations
- **View:** start page and filter chips (show, hide, reorder, pin)
- **Timers and AI assessment:** pause, catch-up window, recipient; AI task and prompt
- **Panel version:** daily check at a set time, optional push, pre-releases and automatic installation via HACS (you only restart Home Assistant yourself)
- **Saving:** changes in the pop-up and in the settings apply only with "Save"; closing with unsaved changes asks "Discard changes?"

<p align="center"><img src="docs/screenshots/en/settings-monitor.png" alt="Settings: timeline of when a device counts as offline and when the push arrives" width="720"></p>

## AI assessment (optional)

Off by default. On a button press the panel asks an AI task of Home Assistant for a guess at the cause, based on facts about the device, its area, hub and similar devices. The function can only be switched on once an AI task is chosen in Home Assistant under "AI suggestions" (the settings link there). No keys, credentials or IDs are sent.

| Answer in the pop-up | Expert mode: prompt |
|---|---|
| <img src="docs/screenshots/en/ai.png" alt="Device pop-up with the AI assessment"> | <img src="docs/screenshots/en/settings-ai.png" alt="Settings with the prompt in expert mode"> |

- **Expert mode:** the prompt is adjustable, with groups of facts such as `{facts_area}` and `{facts_hub}`, and a preview shows the exact text
- **When it fails:** the pop-up shows the message of the AI task, and the log records the reason, so a quota, key or model problem can be found; an empty answer gets a second try
- **Memory:** the last assessment of each device is kept and shown again when you open the device; the next assessment gets it, so the AI says what has changed. Long facts are trimmed to a fixed size.
- **Facts:** besides the device itself the AI sees the latest outages with time of day, the signal of the last 24 hours and 7 days, and for Bluetooth the receivers that heard the device (without addresses); it also knows whether a device is charged (robot vacuum, phone) or runs on batteries and talks about charging habits instead of battery life
- **Without AI:** the panel names the likely common cause of group outages and calculates the battery forecast by itself

## On the phone

The same panel as cards, with the same pop-ups, windows and assistants in full screen.

| List | Pop-up | Battery |
|---|---|---|
| <img src="docs/screenshots/en/overview-mobile.png" alt="Phone: cards" width="260"> | <img src="docs/screenshots/en/popup-mobile.png" alt="Phone: pop-up" width="260"> | <img src="docs/screenshots/en/battery-mobile.png" alt="Phone: battery history" width="260"> |

| Charging | Launcher | Timer assistant | Magic Push |
|---|---|---|---|
| <img src="docs/screenshots/en/charging-mobile.png" alt="Phone: charging devices" width="200"> | <img src="docs/screenshots/en/launcher-mobile.png" alt="Phone: app launcher" width="200"> | <img src="docs/screenshots/en/timer-wizard-mobile.png" alt="Phone: timer assistant" width="200"> | <img src="docs/screenshots/en/magic-wizard-mobile.png" alt="Phone: Magic Push assistant" width="200"> |

## Good to know

- A device counts as offline after 2 minutes without a sign of life (adjustable, per integration and per device).
- A signal counts as weak below -80 dBm or LQI 61. The warning threshold can be set per connection type, globally, per integration and per device, or switched off.
- An outage lasts until Home Assistant sees the device online again, also across restarts. "At least" (≥) means the start is not known.
- The availability log covers 31 days in its own file, not the recorder. Time while Home Assistant was not running counts as "no data".
- Hidden devices, integrations and device types are neither shown nor monitored. Every filter chip can be hidden and reordered in the settings.
- Battery warning from 1 to 50 % (default 15 %), per integration and per device. An implausibly fast drop (for example 76 % to 2 % within minutes, a measurement error of some sensors) is held until a later report confirms it; fast-draining batteries such as a vacuum cleaner count at once. Nothing to set.
- Device type and connection type are detected automatically. You can fix either per integration; a value set by hand on the device comes first. The type only applies in the panel, not in Home Assistant.
- Signal history comes from the recorder or, for ZHA, Bluetooth and unrecorded sensors, from the panel itself.
- Bluetooth devices show the live signal of Bluetooth (best receiver), not the value of their own signal sensor. The path "Connected via" is recorded by the panel from the update on; earlier paths cannot be reconstructed.
- Every setting shows where it comes from: default, integration or device.
- Nothing security-relevant (tokens, keys) is ever shown in the panel.
- All screenshots in this file show invented data.

## Installation

### HACS (custom repository)

1. HACS → ⋮ → Custom repositories → `https://github.com/Diegofuego871/ha-device-panel`, type "Integration".
2. Install "Device Panel" and restart Home Assistant.
3. Settings → Devices & services → Add integration → "Device Panel".

Updates: the settings (gear icon) show the installed and the newest version and update via HACS. Pre-releases (`b` or `rc` in the number) are optional: "Show pre-releases" → "Enable in HACS". Optionally "Install updates automatically" (needs the daily check): a found version is installed through HACS, you only restart Home Assistant yourself; a red dot on the gear shows that the restart is pending. While it works, the version bar in the settings shows a small "Auto" pill after the title. The daily check can run at a set time, and an optional push (once per version, recipient selectable) tells you about a found or installed version.

### Manual

Copy `custom_components/device_panel` to `config/custom_components/` and restart Home Assistant.

### Removal

Settings → Devices & services → "Device Panel" → ⋮ → Delete. This also deletes the integration's own files (`.storage/device_panel.*`). The registries of Home Assistant are never changed. Then remove it in HACS and restart.

## Development and tests

- Python with a real Home Assistant: `pip install pytest-homeassistant-custom-component` (Python 3.13), then `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`. The screenshots in this file come from `node readme-shots.mjs` (invented data), the graphics from `node docs/graphics/render.mjs`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT, see [LICENSE](LICENSE).
