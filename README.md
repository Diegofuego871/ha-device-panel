[Deutsch](https://github.com/Diegofuego871/ha-device-panel/blob/main/README.de.md)

<div align="center">

<img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/custom_components/device_panel/brand/icon@2x.png" alt="Device Panel" width="112" height="112">

<h1>Device Panel</h1>

<p><b>Every device in Home Assistant at a glance:</b> who is offline right now, how often and how long devices fail, how full the batteries are, how good the signal is, and notifications that you control from one place.</p>

<p><a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=Diegofuego871&repository=ha-device-panel&category=integration"><img src="https://my.home-assistant.io/badges/hacs_repository.svg" alt="Open your Home Assistant instance and open a repository inside the Home Assistant Community Store."></a></p>

<p>
<a href="https://hacs.xyz/"><img src="https://img.shields.io/badge/HACS-Default-41BDF5.svg" alt="HACS Default"></a>
<a href="https://github.com/Diegofuego871/ha-device-panel/releases"><img src="https://img.shields.io/github/v/release/Diegofuego871/ha-device-panel?label=release" alt="Latest release"></a>
<img src="https://img.shields.io/badge/Home%20Assistant-2024.12%2B-41BDF5.svg" alt="Home Assistant 2024.12+">
<a href="https://analytics.home-assistant.io/custom_integrations.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fanalytics.home-assistant.io%2Fcustom_integrations.json&amp;query=%24.device_panel.total&amp;label=active%20installs&amp;color=41BDF5" alt="Active installs (Home Assistant analytics)"></a>
<a href="https://github.com/Diegofuego871/ha-device-panel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Diegofuego871/ha-device-panel?label=licence" alt="Licence: MIT"></a>
<a href="https://github.com/Diegofuego871/ha-device-panel/actions/workflows/tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/Diegofuego871/ha-device-panel/tests.yml?branch=main&label=tests" alt="Tests"></a>
<a href="https://github.com/Diegofuego871/ha-device-panel/actions/workflows/validate.yml"><img src="https://img.shields.io/github/actions/workflow/status/Diegofuego871/ha-device-panel/validate.yml?branch=main&label=HACS%20%2F%20hassfest" alt="HACS / hassfest"></a>
</p>

</div>

## Installation

Device Panel is in the default catalog of HACS. From Home Assistant 2026.11, HACS is built into Home Assistant as the **Marketplace** (Settings › Marketplace); the catalog is the same.

1. HACS (from Home Assistant 2026.11: Marketplace) → search for "Device Panel" (or use the blue button above, it opens the integration in your HACS or Marketplace).
2. Download "Device Panel" and restart Home Assistant.
3. Settings → Devices & services → Add integration → "Device Panel".

<details>
<summary><b>Manual installation, updates and removal</b></summary>

Fallback, if the search does not find it (for example with an old HACS): HACS → ⋮ → Custom repositories (Marketplace: "Add from link") → `https://github.com/Diegofuego871/ha-device-panel`, type "Integration".

Updates: the settings (gear icon) show the installed and the newest version and update via HACS or the Marketplace. Pre-releases (`b` or `rc` in the number) are optional: "Show pre-releases" (Settings › Panel › Updates), then switch on "Pre-release" on the HACS device yourself (the note in the panel links there); the panel does not change HACS entities. Optionally "Install updates automatically" (needs the daily check): a found version is installed through HACS or the Marketplace, you only restart Home Assistant yourself; a red dot on the gear shows that the restart is pending. While it works, the version bar in the settings shows a small "Auto" pill after the title. The daily check can run at a set time, and an optional push (once per version, recipient selectable) tells you about a found or installed version.

### Manual

Copy `custom_components/device_panel` to `config/custom_components/` and restart Home Assistant.

### Removal

Settings → Devices & services → "Device Panel" → ⋮ → Delete. This also deletes the integration's own files (`.storage/device_panel.*`). The registries of Home Assistant are never changed. Then remove it in HACS (from 2026.11: in the Marketplace) and restart.

</details>

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/overview.png" alt="Overview with availability, offline devices, outage pulse and device list" width="900"></p>

## Key features

- **Everything at a glance:** devices online, who is offline and since when, unstable devices and an outage pulse over 24 hours, in a list you can search, filter and sort
- **Availability per device:** every outage with its duration, kept for up to 12 months, also across restarts
- **Battery and signal:** colored symbols, warning thresholds, a battery history with a forecast, and for Bluetooth the receiver a device is connected through
- **Notifications on four levels:** set a default once, change it per integration or label, override it on a single device; every setting names where its value comes from
- **Quiet time and group messages:** notifications wait during the night, and several devices of one integration go out as one message
- **Magic Push and routines:** your own messages and your own switching times, without an automation
- **Charging, updates and new devices:** push when a device is full, an update reminder, all device updates in one window, a mark for new devices
- **Everything in the panel:** all settings, a setup wizard, back up and restore, German and English, and an optional AI assessment

## Overview and device list

The top shows how many devices are online, who is offline right now and the outage pulse. Below, the list is grouped into offline, unstable and online devices. Every row shows status, connection, availability of the last 24 hours, device type, integration, battery, manufacturer and software. Type and connection type (Zigbee, Thread, Z-Wave, Matter, Bluetooth, Wi-Fi, Ethernet, network, cloud) are detected automatically and can be corrected per integration or per device.

### Outages at a glance

Offline devices with the time they have been gone, unstable devices (three or more outages in 24 hours) and the outage pulse. Tapping the pulse lists the devices with outages, a point in the pulse shows who was gone then. Every 10 seconds a small measuring dot travels along the line. When three or more devices fail at once, the panel names the likely common cause, for example the integration or its hub.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/pulse.png" alt="Window with the outage pulse and the devices with outages in 24 hours" width="480"></p>

<details>
<summary><b>Search, filter, sort and your own view</b></summary>

### Search, filter, sort

Search runs over all columns. Filter chips narrow the list: warnings, offline, battery, charging, new devices, devices with their own settings, favorites, each connection type, and an area, an integration and a label filter (only while a device carries a label) that combine with the chips. Hidden devices, integrations and device types are neither shown nor monitored. At the top of the section "Panel" in the settings, a button opens the page of the integration in Home Assistant. The language of the panel (automatic, English or German) and the accent colour can be chosen per user (Settings › Panel › General): Home Assistant or one of nine colours. The animations (measuring dot on the outage pulse, shooting star at the dot of the buttons) are on by default and can be switched off there as well.

### Your own view

The button "View" (phone: the row "Sorting & view") opens a dialog with two tabs. "Columns" (phone: "Sorting"): show or hide columns with the eye, drag them into any order, group the list or show it as one list; this applies per user, separately for desktop and phone. "Filter chips" (administrators only): hide, reorder and pin chips; this applies to all users. The list shows changes at once, but they only take effect with "Save"; on closing, the panel asks "Discard changes?". A heart marks favorites (own chip), and in the settings under "Panel" › "General" you can make the panel your own start page in Home Assistant (browser and Companion app).

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/columns.png" alt="Dialog View with the tabs Columns and Filter chips, eye and drag handle" width="560"></p>

</details>

## Everything about one device

A tap on a device opens a pop-up with everything about it.

- **Statistics:** availability, outages, signal and battery as tiles; each tile opens its history
- **Details:** connection, integration, manufacturer, model, software and all entities
- **Actions:** rename, favorite, hide, open in Home Assistant, and start an update if the device offers one
- **Tabs:** Overview, Switches, Settings, Entities, Magic Push and Routines

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/popup.png" alt="Device pop-up with statistics, connection and device details" width="640"></p>

<details>
<summary><b>More about the device pop-up</b></summary>

A tap on a device opens a pop-up with availability, outages, signal and battery as tiles, plus connection, integration, manufacturer, model, software and all entities. If the device has something to switch (light, socket, shutter, lock, climate and more), the second tab "Switches" shows it as tiles with symbol and state; a tap opens the Home Assistant controls (dimming, colour, position). The device can be renamed (in Home Assistant, entity IDs stay), marked as a favorite, hidden, and opened on its page in Home Assistant. The pop-up has buttons to open the device page and the integration page in Home Assistant. If the device offers an update, the line "Update to X available" in the tile "Software" starts it (administrators only): a window shows the versions and release notes (if the integration provides them), optionally "Create a backup first", asks once more and then shows the progress. Outage notifications for this device rest during the update and for 5 minutes after it. The tabs "Switches" and "Entities" always have the same search field (name, entity ID or state). At the end of the tab "Entities" two buttons copy the link to exactly this device (and an app link for the Home Assistant app). A warning names its reason in the header. If a device is down, its battery tile shows the last value before the failure, dimmed and with its age (for display only, it triggers no warning).

### Statistics and history

Each tile opens a window with 24 hours, 7 or 30 days, 3, 6 or 12 months. Availability shows every outage with start, end and duration and the outages per day.

### Signal and Bluetooth path

The signal history shows the median as a line and the range from worst to best value as an area, with the warning threshold of the device. It comes from the recorder or, for ZHA, Bluetooth and unrecorded sensors, from the panel itself. Bluetooth devices also get the card "Receivers": a bar shows through which receiver (Bluetooth adapter or proxy) the device was heard, gaps are hatched, and one row per receiver gives its current value and age, share and average signal in the period plus the latest switches (receiver names without addresses). If the device was heard for a longer time through a much weaker receiver, a hint says so. The panel records this path itself, from the update on. The rows show which receivers hear the device right now ("now -76 dBm · 8 s ago", renewed every few seconds); the one whose value counts is marked "✓ counts". Key figures stand as tiles on top, all notes (source, median, gaps) behind one info button. To keep single reports from deciding, the signal shown for Bluetooth, ZHA and unrecorded sensors, and with it "weak", is the median of the last 5 minutes (the window says so).

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/signal-via.png" alt="Section Connected via with receivers, share and switches" width="560"></p>

### Battery with forecast

The battery history reaches back up to 12 months, with the battery change marked. The forecast calculates from the last battery change (at most one year) up to the warning threshold of the device, and says how sure it is.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/battery.png" alt="Battery history with battery change, warning threshold and forecast" width="480"></p>

### History of a device

One window with everything about a device: outages and returns with the duration, battery, charging, reception, updates, new devices, push, Magic Push messages and routine runs, by day. A bar chart shows the entries per day (per week for long periods, faults in red) and follows the chips and the search; a tap on a bar sets the period to that day. Chips filter by kind, a tap on a Magic Push row shows the message, a tap on a routine row its trace, and a tap on an entry like "back online after 9 min.: sending the notification" shows the push that went out (title, text, target and result). The tabs "Magic Push" and "Routines" keep their evaluation with key figures and chart. It opens with "History" at the top right of the device pop-up, and from the header of the overviews of Magic Push and routines for all devices.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/devicelog.png" alt="History of a device: list by day with chips for outage, reception, updates, Magic Push and routines" width="640"></p>

### Sign of life of an entity

In tab "Entities" the mark "Sign of life" shows which entities decide whether a device counts as offline. The mark is a button: a tap excludes the entity (dashed border, crossed out), another tap counts it again; "Save" applies the choice. That is how you keep a helper you attached yourself, which is always available, from hiding an outage.

### Settings per device

Every device can override the defaults in the tab "Settings" of its pop-up: its own "offline after" time, no online status or no monitoring (the same rows as for an integration), battery warning, signal warning, charging, and outage and online notifications switched off. Each row shows where the value comes from and what the default would be. A symbol next to the name in the list marks devices with their own settings.

</details>

## Notifications

Everything that notifies you follows one principle: you set a default once, change it for all devices of an integration (or of a label), and override it on a single device where needed. The more specific level wins; a label sits between the device and the integration.

### The principle

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/graphics/en/notification-levels.png" alt="Four levels General, Integration, Label and Device with an example and a table of what can be set where" width="900"></p>

- **General:** in the settings under "Monitoring and notifications", the default for all devices
- **Integration:** in the same place, tab "Integrations": a list of all integrations with what differs from the default, and a detail page per integration with its own tabs
- **Label (optional):** in the settings under "Monitoring and notifications", tab "Labels" (next to "Integrations"): a Home Assistant label gets the same tabs as an integration and applies to all devices that carry it, before the integration and after the device. With several labels the strictest one applies ("Do not monitor", then the longer time or the lower threshold)
- **Device:** in the pop-up of the device, tab "Settings": only this device, with the origin of every value
- **Origin:** every setting says where it comes from (default, integration, label or device), and a chip "Own setting" filters devices that have their own values; in the settings they can be reset one by one or all at once

### From outage to notification

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/graphics/en/notification-flow.png" alt="Six steps from the outage of a device to the notification, with the level that decides each step" width="900"></p>

<details>
<summary><b>More about outage notifications</b></summary>

- **Two times, not added:** "Offline after" (default 2 minutes) decides when the panel shows the device as offline, "Report only after" decides when the notification is sent; both run from the start of the outage, and the second cannot be shorter than the first; both can be set globally, per integration and per device
- **Unstable:** a device that is online but had a number of outages within 24 hours (default 3) counts as unstable; "Unstable from" can be set globally, per integration, per label and per device
- **One message per integration:** when several devices of one integration go offline together (default from three, adjustable), there is one message for that integration instead of many; the notification waits up to a minute for more devices, and the return is combined the same way
- **Quiet time:** one global quiet time with its own times per weekday holds the chosen kinds of notifications (selectable per kind, including Magic Push and the status app) and sends them afterwards as one summary or one by one; critical Magic Push messages always come at once
- **Back up and restore:** all settings (notifications, display, per device, AI, optionally routines and Magic Push) into one file and back, with a preview of what would change, a note for anything missing (device, integration, push target) and an undo; no credentials or tokens in the file
- **Back online:** "Back online" with the duration of the outage replaces the outage message
- **Buttons in the message:** open the device in the panel, or mute the device for 24 hours in the Companion app
- **Persistent notification:** optionally also one message in Home Assistant while devices are offline, per integration

</details>

<details>
<summary><b>Where the notification goes and the kinds of notifications</b></summary>

### Where the notification goes

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/graphics/en/notification-targets.png" alt="One push target for everything, an own target per tab, Magic Push and routines choose their recipient themselves" width="900"></p>

- **One push target:** a notify service, group or notify entity for all messages
- **Own target per tab:** outage, battery, charging, new devices, updates, panel updates and routines can each send to another recipient
- **Look:** every notification shows the icon of its integration and an emoji that you can change per kind; each title starts with a fitting emoji

### The kinds of notifications

Each kind has its own tab in the settings. Outage, battery, charging, new devices and signal are also tabs of every integration, and outage, battery, charging and signal tabs of every device (a device only shows the tabs it has something for: without a battery there is no battery or charging tab, without a signal reading no signal tab), so the levels apply to each of them. A label has the same tabs as an integration, plus "Updates" and "Type".

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/settings-outage.png" alt="Tab Outage: offline after, report only after, detection and message" width="560"></p>

- **Outage and back online:** push, persistent notification and group message, with start, duration, area and integration
- **Battery:** once per device when it falls below the threshold (default 15 %, from 1 to 50 %), immediately or as a daily summary, with a persistent notification of all affected devices
- **Charging:** push when a device is fully charged ("Full from", default 100 %) or the charge stops early, off by default and only for rechargeable devices; devices that charge right now get the chip "Charging" with a green mark and a charge bar
- **Live activity:** optionally the charge progress on the lock screen (iPhone, live activity) or as a live update (Android 16), with quiet updates and, once it is reliable, an estimate of when the target is reached ("done around 14:35"), off by default
- **New devices:** a collecting window, then one message with all devices that appeared; the device carries a "New" mark for three days
- **Update reminder:** daily, weekly or immediately for updates of Home Assistant, add-ons, HACS / Marketplace and device firmware, adjustable per app, per integration and per firmware, optionally repeated while an update stays open; replaces two hand-made automations
- **Signal:** a warning threshold per connection type, per integration and per device (default weak below -80 dBm or LQI 61), also switchable off
- **Panel updates:** an optional push once per version when a new version of the panel is found or installed

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/integ-detail.png" alt="Detail of an integration with tabs for outage, battery, charging, new, signal and devices" width="560"></p>

</details>

<details>
<summary><b>Labels and devices without online status</b></summary>

### Labels

Labels are the labels you give devices in Home Assistant (Settings › Areas, labels & zones). They group devices across integrations, for example "often offline" for devices that should not trigger alerts.

- **Set up:** Settings › Monitoring and notifications › tab "Labels": the plus button picks a label (only labels that sit on at least one device); the detail page has the tabs of an integration plus "Updates" and "Type"
- **Order of precedence:** device › label › integration › global; a choice on the device always wins
- **Several labels:** the strictest applies: "Do not monitor" first, otherwise the longer time or the lower threshold; for type, connection type and notifications on or off, the label higher up in the list counts (move with "Move up" / "Move down")
- **In the panel:** the filter chip "Label" (multi-select, "No label", combines with the other filters) appears as soon as a device carries a label; the pop-up of a device shows "Same as label" and the origin "Label <name>"
- **Only devices:** labels on devices count, labels on entities do not; "Remove label" deletes the settings of the label and leaves Home Assistant untouched

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/settings-labels.png" alt="Settings, tab Labels: a label without online status with the rows Monitor, Watch online status and Offline after" width="560"></p>

### Without online status

Some devices report only now and then, for example Bluetooth sensors, and would look permanently offline. "Without online status" keeps them monitored for battery, charging, signal and updates, but they get no online status, no outages, no outage statistics and no outage notifications.

- **Where:** the same rows in an integration, in a label and in the Settings of a device pop-up: "Monitor" above the tabs (it applies to all of them; switched off, the tabs for outage, battery, charging and signal disappear) and "Watch online status" and "Offline after" in the tab "Outage". "Watch online status: off" means the same everywhere. On a device, an own time switches the status on again
- **Order of precedence:** device › label › integration; with several labels the strictest applies: "Do not monitor", then "No online status", then a time
- **In the panel:** a grey ring instead of the dot, a row in the availability tile ("N without online status") and the filter chip "No online status" (can be hidden and moved like all chips)
- **Setup wizard:** in the step "Notifications", tab "Outage", a ring switch per integration and device, and the switch on the card of a label

</details>

## Magic Push: your own messages

Your own notifications per device without an automation, in the tab "Magic Push" of the device.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/magic-tab.png" alt="Tab Magic Push of a device with two messages" width="560"></p>

<details>
<summary><b>How Magic Push works</b></summary>

- **Any value:** pick a value of the device, or any entity of Home Assistant that stays tied to the device
- **When:** above, below, is, or changes; several conditions linked with And/Or and groups; for how long it must hold; how long it must stay normal before it resets, and at which value
- **Recipient:** any notify target, optionally as a critical notification with a volume from 1 to 10, and how often to repeat
- **Text:** title and content with variables that fit the value (name, value, unit, threshold, area and more), a preview and a look back at the last 24 hours before you save
- **Assistant:** opens in its own window (full screen on the phone), five steps: conditions, how long, delivery, text, name
- **Overview:** the app "Magic Push" (in the launcher) opens a window with all messages of all devices, one card per device, with search and filter; if several devices are visible all cards are collapsed (also while searching), with one message its switch sits in the header, with several each message gets a slim row with a switch, and expanded the area and "Open device" stand below the name; "New message" at the bottom adds one (choose the device first, then as in the device pop-up)
- **History:** one window for everything about a device. Open it with the button "History" at the top right of the device pop-up (left of the heart), from the cards and links of Magic Push and routines, or from the header of the overviews of Magic Push and routines (for all devices). Three tabs: **"All"** lists events, outages (with duration), battery, charging, updates, new devices, push, Magic Push and routines of the device (or of all devices) in one list by day, with chips that only show kinds that have entries, search and a tap on a Magic Push row for the message as sent or on a routine row for its trace. **"Magic Push"** and **"Routines"** keep their evaluation: every message or run with date, kind, title and text as it was sent, value, recipient and what became of it (sent, held back, failed). Period 7 days to 12 months or your own dates, key figures, a bar chart (per day, per week for long periods; a tap on a bar picks that day), choice, search and "Copy as text". Reception appears too: the panel writes an entry when a device turns weak and when it is fine again (checked every 5 minutes, a change counts after two checks in a row). Kept as long as there is room: at most 5000 entries per message and 30 MB for all together (adjustable under Panel › Storage)

</details>

## Routines

Switches an entity of a device once or on a schedule, without an automation.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/routine-tab.png" alt="Tab Routines of a device with a routine" width="560"></p>

<details>
<summary><b>What routines can do</b></summary>

- **What:** pick the entity and the action (on, off, toggle; **set** for numbers and selections such as the brightness of a display, which goes back only "as before"), optionally switch back after a while. Added through the overview "All routines", the first page is "Device, group or scene?": next to devices there are **scenes** (action "Activate", nothing to switch back) and **groups** (for example a light group, behaves like a single lamp), both without a device; the first page lists every device, group and scene as a row of its own, with a filter on top (All, Devices, Groups, Scenes) and a small pill on groups and scenes, and the search finds them by their name; a chosen scene needs no further page "What", a chosen group only asks for the action
- **Several devices:** at the end of the page "What" (or "Options") the button "+ Add device" adds another device; the pages Device, What and Options repeat for it. The devices stand as cards in a fixed order, the one you edit is open. Each device has its own action, options and "Then" (off or as before); time or trigger, switching back (when), push, on/off and name are shared. Up to 10 devices. All are switched at once, a failure does not stop the others (the log then says "partly switched"). The routine shows in the tab and card of every device it contains, collapsed as before, expanded with a row per device
- **Options:** if the entity can be set when it is turned on, a page of its own follows: light brightness, colour temperature and colour; shutter position; climate target temperature and mode; media volume; fan speed. A preview shows the result (the lamp lights in the chosen colour), nothing is switched by it, and "Run now" tries the real strength; without a setting everything stays "as last used"
- **Switch back:** after a while back to "off" (the opposite) or "as before": the routine remembers the scene right before switching (for example brightness and colour) and restores it, so a lamp can be briefly brighter and then as it was. Own page "Switch back": never, after a duration, at a time or by a trigger (for example on at 20:00, off when the rain sensor is dry), with "at the latest after" as a safety net
- **When:** in X minutes, once at a date and time, or repeating daily, weekly on chosen weekdays or monthly, with a check of the next runs before you save; or **by a trigger** instead of a time: any entity, "above" / "below" / "is" / "changes", several conditions with "and" / "or" like Magic Push, "holds for at least", an optional time window (also across midnight), a pause after switching and "only once". Every time has quick choices and a field for your own time (the pause not below 1 minute). It switches only when the condition is newly met
- **Test:** a button "Run now" tries the chosen switch
- **Reminder:** optionally a push at the moment it switches, with a preview and its own recipient
- **Runs in Home Assistant:** with its time zone, so a routine also fires with the panel closed and after a restart (within a catch-up window you set), and "Pause all routines" is one switch, optionally "Pause until" (a chip next to the switch opens a small window with quick choices and your own date and time; afterwards all routines run again by themselves; a warning in the tab of every device shows the pause); a switching command that does not answer ends after 45 seconds
- **Overview:** the lightning bolt in the header (also in the launcher) opens all routines in one card per device (scenes and groups without a device in cards of their own), with search and filter, edit, run, switch on or off, delete and favorites; at the very top the switch "Pause all routines" (same as in the settings, applies at once). If several devices are visible, all cards are collapsed (also while searching); with one routine its switch sits in the header, with several each routine gets a slim row with a switch, so everything can be switched on and off without expanding. With exactly one routine the head always shows its name, collapsed and expanded; expanded, the device, its area and "Open device" stand below the name
- **Tab in the device pop-up:** the same build as the overview: a search field and the filters All, Active, Off and Running (always there), each routine as a row with time, name, switch and arrow; with more than one routine all are collapsed (also while searching or filtering), with exactly one it is open. Expanded, the alarm-clock card with all actions (edit, run, history, delete)
- **History and trace:** "History" on a card (it opens the history of the device with this routine already chosen as a chip; "All routines" lifts the filter; the history button in the header of the device) lists every run: date, trigger (time, trigger, by hand, switching back), action and result (executed, switched back, missed, paused, failed). Same period, chart, choice and search as for Magic Push. A row opens the **trace**: every step in order (trigger and delay, time window, remembered state, call with duration and result, planned switch back, message), copyable as text for troubleshooting. Kept as long as there is room: at most 5000 entries per routine and 30 MB for all together (adjustable)

</details>

## Device updates

The app "Device updates" (administrators) lists all open updates of devices in one window, not Home Assistant itself, its apps or HACS / Marketplace. Chips by integration preselect, checkboxes refine, one button starts the selection after a confirmation (optionally with a backup first). The integration works the selection off in a queue, so it keeps running with the window closed.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/updates.png" alt="Window Device updates with chips by integration and a selection" width="480"></p>

If a new version is available for a device, its tile "Software" in the pop-up gets an outline in the main color; a tap opens the update window of this device, and a running update shows its progress in the tile too.

## App launcher and history

A button in the header opens a launcher with useful pages, in the symbols and colors of the settings of Home Assistant. Administrators also find a power button there that restarts Home Assistant, always after a confirmation.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/launcher.png" alt="App launcher with favorites, Device Panel and Home Assistant pages" width="360"></p>

<details>
<summary><b>What the launcher offers</b></summary>

- **Pages:** routines, Magic Push and the history of this integration, pages of Home Assistant (automations, scenes, scripts, helpers, devices, entities, integrations, tools and more; "Apps" and "Dashboards" are available too but hidden until you switch them on in edit mode; administrators only for the management pages)
- **Your own links and actions:** a page in Home Assistant, an external link that opens in a new browser tab (with its favicon as icon if you like), or an **action** that calls a Home Assistant service or a command of the interface (JSON data, optionally with a question first); optionally also as a button in the header of the settings; while it runs the symbol shows turning arrows, then a green check (or a red cross), and the result is written to the log
- **View and Settings:** two apps in the group "Device Panel" open the view settings (sorting, columns, filter chips) and the central settings, so everything is found in one place; both can be hidden because the header buttons lead there too
- **Favorites:** a heart marks up to five apps that get their own buttons in the header (on the phone the first two); by default these are Routines and Settings. The gear no longer sits there permanently, only when the app "Settings" is pinned; it cannot be hidden. If a restart is pending, the launcher button shows the red dot as long as Settings is not pinned
- **Edit mode:** sort by dragging, hide apps with the eye (History and Status stay visible, marked with a lock), grid or list; everything is saved per user
- **Status:** an app for administrators that shows whether the parts of the integration are running (routines, outage monitoring, battery, charging, reception history, Magic Push, new devices, updates: "running", "late" or "stopped"). If a part stops, you get a push (to the default target, or to a target you choose in the app) and an all-clear when it runs again; a stopped or late part has a button to restart just that part by hand. A red dot on the launcher button, or on the Status button if you pinned it, shows a fault; an orange dot shows that debug mode is on. Limit: if Home Assistant itself stands still, nothing can report it
- **Failed routines:** if a routine fails for good (after the retries), the shooting star flies at the Routines button (in the header, or at the launcher button if it is not pinned), the icon of the app "Routines" shakes in the launcher and carries the chip "Error". In the Routines window the shooting star circles the History button, and in the pop-up of the affected device its History button. History then opens on "Routines" with the filter "Failed". It stays for 24 hours or until you open the routine history once (from the device or the overview)
- **Device updates:** an app for administrators with all open updates of devices (not Home Assistant itself, its apps or HACS / Marketplace) in one window. Chips by integration preselect the devices of an integration, checkboxes refine the choice, one button starts the selection after a confirmation (optionally with a backup first). The integration works the selection off in a queue, so it keeps running with the window closed: at most three updates at a time and one per integration. The window shows waiting, progress, restart, done and failed (with a button to try again). While an update is open, the icon in the launcher shakes and shows the number, and the launcher button shows a dot (shooting star) in the main color. The notification about new updates opens this window if it contains device updates
- **History:** one window with everything, whichever way you open it: from the launcher (app "History") over all devices, from the device pop-up for that device, from the overviews of Magic Push and routines, and from Settings › Storage on the tab "System". Four tabs: "All" (everything that concerns a device), "Magic Push", "Routines" and **"System"** (entries without a device: start, errors, AI, push targets, status app, launcher; with chips for level and kind, search, copy and clear). The **debug mode** is switched on in the tab "System" (48 hours, also across restarts; debug entries of devices show up there too); while it is on, the icon of the app "History" shakes in the launcher like the one of "Device updates"

</details>

## Settings in the panel

The gear (the pinned app "Settings", or the launcher) opens all settings in German or English, in sections. The version bar on top shows the installed and the newest version and updates via HACS or the Marketplace.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/settings-general.png" alt="Settings, tab General: target of the notifications and quiet time" width="640"></p>

<details>
<summary><b>All settings, setup wizard, back up and restore</b></summary>

- **Devices in the panel:** hide integrations, device types and single devices (hiding a device asks for confirmation first; under every integration the list says how many of its devices are not visible and why), set type and connection type per integration, see and reset devices with their own settings
- **Monitoring and notifications:** the tabs General (target of the notifications, quiet time), Outage, Battery, Charging, New, Updates, Signal and Integrations; each tab for a notification starts with a small overview (timeline and pills to switch it quickly)
- **Exceptions:** every tab of "Monitoring and notifications" (except "New devices" for devices) ends with the integrations and devices that differ from the default, with a reset (also under "Devices in the panel" › "Device settings")
- **View:** no longer in the settings but in the dialog "View" above the list (columns and sorting per user, filter chips for all); both tabs have their own "Save"
- **Routines and AI assessment:** pause, catch-up window, recipient; AI task and prompt
- **Status app:** whether the parts of the integration run, with push alerts and a restart button (also an alert when CPU, memory or disk reach a limit you set, default 99 %, each for a minimum duration you set, default 3 minutes); below, small graphs for CPU, memory and disk of Home Assistant (each with its own period: 24 hours, 7 days, 30 days, 3, 6 or 12 months), from the sensors of "System Monitor" or your own (chosen from a searchable list of sensor entities; switched-off sensors can be switched on with one button). Three tabs: "Services" (the parts), "System" (the graphs) and "Settings" (alerts, limits, sources; they only apply after "Save").
- **Panel:** three sub-tabs. "General": the panel as your start page in Home Assistant, the panel language ("Automatic" follows Home Assistant, or English / German; the names of the languages are written in the language selected), the accent colour and the animations (all only for you), the chapter "Setup wizard" (start it again, see below) and, at the very end, the chapter "Back up and restore" (see below). "Updates" (the version line with search and install stays at the very top of the settings): a check every time the settings are opened (at most once per minute), daily check at a set time, optional push, pre-releases and automatic installation via HACS or the Marketplace (you only restart Home Assistant yourself). **"Storage"**: everything the integration stores itself, with a bar of the total and the used size on every line. Chapter "Device histories": retention in days (7 to 365, default 1 year) and a limit in MB for availability and for reception (default 365 days, 20 MB and 50 MB; reception older than 31 days is kept as daily values); the battery history has no storage of its own, it comes from the recorder. Chapter "Sent notifications": retention in days and a limit in MB for the notifications shown in the history of a device (default 365 days, 10 MB); its own storage, so frequent entries of the panel log do not push the notifications out. Chapter "Logs": how much the logs keep, as a size in MB and a number of entries, once for messages and routines (default 30 MB, 5000 entries per message or routine) and once for the panel log (default 10 MB, 4000 entries). When a limit is reached, the oldest entries of all devices are dropped; a lower limit cuts at once and asks first. Chapter "Other data": the size of states and settings (no limit, they hardly grow)
- **Saving:** changes in the pop-up and in the settings apply only with "Save"; closing with unsaved changes asks "Discard changes?"

### Setup wizard

After a fresh installation a window opens once in the middle of the panel (as large as the settings; full screen on a phone) and leads through the basic settings. Nothing is applied until the last step, "Finish"; if you close in between, your step and choices are kept and the next start continues there.

- **Steps:** (a bar per step on top, each one a button to jump directly; forward only when the page is valid) Welcome, Integrations (switch off what you do not need), Device types, Devices (grouped by integration, expandable, one switch per group or device), Notifications (with a second, ring-shaped switch per integration and device for "Watch online status"), Labels (only if a device carries a Home Assistant label: pick a label and set monitoring, times, battery threshold and notifications for all its devices), Quiet hours and system (only once a push target is chosen; the quiet hours plus the notification for high load of CPU, RAM and disk with the current value, limit and minimum duration) and a summary.
- **Notifications:** choose the push target (notify group or service), one switch per kind (failed devices with return, low battery, new devices, fully charged, updates) and, per row, the current values already filled in with the defaults and editable on the spot: "Notify after" (minutes), "Battery low below" (%), "Collect new devices" (minutes), "Full from" (%), the time of the update notification. An arrow on a row opens the integrations of that kind: switch some off for failed devices, low battery and new devices, or on for "Fully charged" (off by default, best practice). Failed devices, low battery and fully charged open once more down to the single devices, one switch each; under "Updates" the arrow lists the integrations with updates and, below, the single updates. In the settings the same choice per integration is a list above the single entries (tab Updates) and a tab "Updates" in the detail of every integration. A button sends a test message. Wrong values (out of range, "Notify after" shorter than the set "Failed after", which the wizard does not offer) block "Next" with a note.
- **Skip:** "Not now" closes the window and keeps your place ("Discard draft" on the welcome page starts over); "Don't show again" ends it for good. From step 1 on, the cross asks which of the two you want. Until the wizard has been finished once, the launcher shows a tile "Setup" at the top of the group "Device Panel" and an orange dot on the launcher button (not configurable, gone after "Finish" or "Don't show again").
- **Again later:** Settings › Panel › General › "Setup wizard" starts it again. The fields show the current state, nothing is reset. Closed without finishing, the tile and the dot come back. Administrators only; the state applies to the whole installation, existing installations count as finished (no window, no tile).

### Back up and restore

Under "Panel" › "General" (below "Start page", administrators only) all settings can be saved to one file and restored later, for example after a new installation or to move them to another Home Assistant.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/backup-restore.png" alt="Preview: what changes, what stays, what is skipped, with notes for missing push targets and devices" width="480"></p>

- **What goes in:** you choose the parts: notifications and monitoring, panel and display, settings per device, AI assessment and, off by default, routines and Magic Push. No credentials and no tokens. "Copy" and "Paste text" are the way for the phone app, where saving a file does not always work.
- **Preview first:** nothing is written before "Apply". The preview counts what changes, stays the same or is not applied, per part, with examples.
- **What is missing is named:** unknown settings, values out of range, devices that do not exist here and routines or messages with a missing entity are skipped with the reason; a push target or integration that is gone is applied with a note.
- **Details:** the three tiles of the preview (will change, unchanged, not applied) and the section rows open a window with the full list: every change old → new (devices with their name), the unchanged values, and every skipped entry with its reason; unknown devices with name, ID and what they affect. "Copy report" puts the list on the clipboard. Routines and Magic Push messages show what they do (entity and action, or condition and push target), not only the name from the file.
- **Undo:** the state before is kept (and, on request, saved as a file); "Undo" brings it back exactly.

</details>

## AI assessment (optional)

Off by default. On a button press the panel asks an AI task of Home Assistant for a guess at the cause, based on facts about the device, its area, hub and similar devices. The function can only be switched on once an AI task is chosen in Home Assistant under "AI suggestions" (the settings link there). No keys, credentials or IDs are sent.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/ai.png" alt="Device pop-up with the AI assessment" width="480"></p>

<details>
<summary><b>More about the AI assessment</b></summary>

- **Expert mode:** the prompt is adjustable, with groups of facts such as `{facts_area}` and `{facts_hub}`, and a preview shows the exact text
- **When it fails:** the pop-up shows the message of the AI task, and the log records the reason, so a quota, key or model problem can be found; an empty answer gets a second try, and a temporary overload of the provider (for example "503, high demand") is retried twice before an error is shown
- **Remove:** a button next to "Create again" takes the assessment away (pop-up and memory), a new one is one tap away
- **Follow-up questions:** under the assessment you can ask the AI more, with suggested questions as pills (the AI suggests them itself, to fit the device and its last answer) and a text field for your own; the answers appear as a conversation, at most three per assessment
- **Memory:** the last assessment of each device is kept and shown again when you open the device; the next assessment gets it, so the AI says what has changed. Long facts are trimmed to a fixed size.
- **Facts:** besides the device itself the AI sees the latest outages with time of day, the signal of the last 24 hours and 7 days, and for Bluetooth the receivers that heard the device (without addresses); it also knows whether a device is charged (robot vacuum, phone) or runs on batteries and talks about charging habits instead of battery life
- **Without AI:** the panel names the likely common cause of group outages and calculates the battery forecast by itself

</details>

## Entities for automations

The integration creates its own service device **"Device Panel"** with entities, so you can use the numbers in automations and dashboards. They are calculated every 30 seconds from the same list as the panel and only written to the history when they change.

<details>
<summary><b>The entities in detail</b></summary>

- **Sensors (counts):** devices active, hidden, offline, with warning, with battery, with low battery, charging, with weak reception, new (last 3 days) and with an update. Every sensor carries the names of the devices as attribute `names` (at most 20, `more` counts the rest). A warning is counted like in the panel (unstable, low battery, weak reception or no data; an outage counts as outage, not as warning). Disabled and unmonitored devices are not counted.
- **Binary sensors:** **Outage** (on when at least one device is offline) and **Problem** (on when there is an error in the log or a part of the integration is not running, see the status app).
- **Switches:** **Routines paused** (always; the same as "Pause all routines" in the panel, attribute `paused_until`) and, if you tick "As a switch and button in Home Assistant" in the assistant of a routine, one switch per routine that turns it on and off (attributes `next_run`, `last_run`, `last_result`, `failed`) and one button that runs it now (also while paused or when the routine is off); both are removed with the routine or when the option is switched off
- **Error counter:** the sensor **"Errors (24 hours)"** counts the entries of level "error" in the panel log of the last 24 hours, with `last`, `last_category` and `last_at` as attributes. What counts as an error (entries of level "error", warnings do not count): a routine that failed for good (after its retries, also when switching back or when run by hand), a push that could not be delivered (the sending failed, or the target is missing or invalid), a failed or unsupported live charging notification, and a failed restart of a part watched by the status app. The button **"Acknowledge errors"** sets the counter to zero: it remembers the moment of pressing (also across restarts), from then on only newer errors count. The log stays untouched, nothing is fixed or restarted, no notification is sent or withdrawn. **"Problem"** (binary sensor) is on while the counter is above zero or a part of the status app has a problem, so acknowledging can switch it off.
- Entities you do not need, you can disable in Home Assistant as usual. The own service device does not appear in the device list of the panel.

</details>

## On the phone

The same panel as cards, with the same pop-ups, windows and assistants in full screen.

<p align="center"><img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/overview-mobile.png" alt="Phone: cards" width="250"> <img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/popup-mobile.png" alt="Phone: pop-up" width="250"> <img src="https://raw.githubusercontent.com/Diegofuego871/ha-device-panel/main/docs/screenshots/en/battery-mobile.png" alt="Phone: battery history" width="250"></p>

## Good to know

<details>
<summary><b>Good to know</b></summary>

- **How "offline" is detected:** a device is online as long as at least one of its entities that count as a sign of life is available; it is offline when all of them are `unavailable` (not `unknown`) for longer than "Offline after". A connectivity sensor (`binary_sensor`, device class `connectivity`) counts alone and takes precedence (`off` also means disconnected). Otherwise the enabled, visible entities without a category count (hidden and diagnostic ones only if nothing else exists). In the device pop-up, tab "Entities", the mark "Sign of life" shows which ones count. A tap on the mark excludes an entity (for example a template helper you attached yourself that is always available, so the device would never be offline); tap again to count it again. A chip row below the search field ("Sign of life", "Excluded", "Others", each with its number; a chip without entities is left out) filters the list as soon as at least one entity does not count as a sign of life; a tap on a chip filters, a second tap shows everything again. The choice applies after "Save", is part of the backup, and the last entity cannot be excluded: if all would be excluded, a note appears right away and "Save" opens a window saying it cannot be saved (otherwise there would be no status). The history shows for every outage and every return which entities counted as a sign of life and in which state (for example `sensor.x=unavailable`): in short form (at most 3 entities) always, in full with the ones you excluded when debug mode is switched on. Alternative: a template `binary_sensor` with device class `connectivity` on the device says directly whether the device is online.
- A device counts as offline after 2 minutes without a sign of life (adjustable, per integration, per label and per device).
- A signal counts as weak below -80 dBm or LQI 61. The warning threshold can be set per connection type, globally, per integration, per label and per device, or switched off.
- An outage lasts until Home Assistant sees the device online again, also across restarts. "At least" (≥) means the start is not known.
- The availability log covers 12 months by default (adjustable, 7 to 365 days) in its own file, not the recorder. Values deleted before the update (older than 31 days) cannot be filled in; the recorder only keeps ten days by default. Time while Home Assistant was not running counts as "no data".
- Hidden devices, integrations and device types are neither shown nor monitored. Every filter chip (area, integration, label and the others) can be hidden and reordered in the settings.
- Battery warning from 1 to 50 % (default 15 %), per integration, per label and per device. An implausibly fast drop (for example 76 % to 2 % within minutes, a measurement error of some sensors) is held until a later report confirms it; fast-draining batteries such as a vacuum cleaner count at once. Nothing to set.
- Device type and connection type are detected automatically. You can fix either per integration or per label; a value set by hand on the device comes first. The type only applies in the panel, not in Home Assistant.
- Signal history comes from the recorder or, for ZHA, Bluetooth and unrecorded sensors, from the panel itself.
- Bluetooth devices show the live signal of Bluetooth (best receiver), not the value of their own signal sensor. The path "Connected via" is recorded by the panel from the update on; earlier paths cannot be reconstructed.
- Every setting shows where it comes from: default, integration, label or device.
- Nothing security-relevant (tokens, keys) is ever shown in the panel.
- All screenshots in this file show invented data.

</details>

## Development and tests

- Python with a real Home Assistant: `pip install pytest-homeassistant-custom-component` (Python 3.13), then `python -m pytest`.
- Panel: `cd tests/panel && npm ci && npx playwright-core install chromium && node run.mjs`. The screenshots in this file come from `node readme-shots.mjs` (invented data), the graphics from `node docs/graphics/render.mjs`.

## Changelog

See [CHANGELOG.md](https://github.com/Diegofuego871/ha-device-panel/blob/main/CHANGELOG.md).

## License

MIT, see [LICENSE](https://github.com/Diegofuego871/ha-device-panel/blob/main/LICENSE).
