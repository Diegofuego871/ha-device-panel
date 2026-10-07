# Changelog

[Deutsch](CHANGELOG.de.md)

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.26.0] - 2026-10-07

Header tiles side by side on the phone.

### Added

- The window "Outages in 24 h" now shows the group outage notes (up to 3) with their
  full text, above the device list; so far they were only on the tile.

### Changed

- Header on the phone (up to 600 px wide; requested by the user, mockup
  `hero-mobile-v1`, V2): "Availability" and "Offline right now" now sit side by
  side, each half the width (185 px on an iPhone 17), instead of three tiles to swipe
  through. Tablet and desktop stay as they were.
  - Availability: smaller ring (the number only) with the percentage beside it,
    the 24 h average and the lines below.
  - Offline right now: smaller number, the two longest devices and "+ 2 more", a short
    warning line ("3 warnings"); the sentence "No device is offline right now." is
    left out (the 0 and "All online" say the same).
  - Outage pulse: a slim row under the two tiles with the title, the headline of the
    group outage (or the summary) and a small curve; a tap opens the window as before.

## [1.25.0] - 2026-10-06

Device type per integration.

### Added

- Device type per integration (requested by the user): in Settings › Devices in
  the panel › Integrations, a column "Type" next to "Show" with a selection
  "Automatic" plus all device types; each row shows the types detected for the
  integration. A type set here applies to all devices of the integration instead
  of the detection; "Automatic" (the default) keeps the detection as before. A
  type set by hand on a single device still comes first (device, then
  integration, then detection).
  - In the pop-up the selection reads "Same as integration: Switch" with the note
    "set for the whole integration" as long as the device has no type of its own.
  - The type counts everywhere the type counts: list, filter, exclusions by type
    (including the counts in "Types") and the AI assessment. It only applies in
    the panel; it is not written to Home Assistant.
  - The section summary shows "type set for N integrations".
  - New option `type_integrations` ({domain: type}), also in the options
    dialog; `list_devices` additionally returns `type_integration`.

## [1.24.0] - 2026-10-06

Not released; included in 1.25.0.

Push notification for new devices.

### Added

- Push notification when a new device appears in Home Assistant (requested by
  the user), with its own tab "New" in Settings › Monitoring and notifications,
  built like "Outage" and "Battery":
  - Off by default. Only devices that appear after you switch it on are
    reported; hidden, disabled and excluded devices are not.
  - Collect window (default 5 minutes, 1 to 60): the first new device starts it,
    then one notification arrives with everything that came in meanwhile. One
    device gives "New device: Name", several give "3 new devices" with the
    details in brackets. The window also gives area, manufacturer and model time
    to fill in.
  - Content of the notification (area, integration, connection type,
    manufacturer / model) with a preview, optional persistent notification in
    Home Assistant with the devices found last (until you dismiss it). Tapping
    the notification opens the device, as set under "Opens".
  - Timeline with the window in the tab and a third row in the overview.
  - Per integration: switch "Report new devices" in the integration details;
    the list and "All to default" include it. New installations start with
    "ibeacon" excluded (Bluetooth trackers create devices all the time).
  - New options `notify_new`, `new_window`, `new_persistent`, `new_fields` and
    `new_exclude_integrations`, also in the options dialog.

## [1.23.0] - 2026-10-06

Integration logos in the settings.

### Changed

- The integration lists in the settings show the logo of the integration too
  (display, monitoring and notifications, connection type per integration, hidden
  integrations), instead of the coloured initials. Same source and fallback as in
  the device list: without a logo or on an older Home Assistant the initials stay.

## [1.22.0] - 2026-10-06

Integration logos in the list.

### Changed

- In the device list, the round avatar shows the logo of the integration instead
  of the icon of the connection type (requested by the user); the status dot
  stays. The logos come from the brand service of your own Home Assistant
  (`/api/brands/integration/<domain>/icon.png`, since Home Assistant 2026.3, with
  the access token from `brands/access_token`), so nothing is loaded from the
  internet and it works offline. In the dark theme `dark_icon.png` is used if there
  is one. Without a logo (for example some custom integrations) or on an older Home
  Assistant, the icon of the connection type stays. The connection type remains in
  its column, in the pop-up and in the filter chips.

## [1.21.0] - 2026-10-06

Rename devices.

### Added

- Device pop-up: a pencil next to the name renames the device in Home Assistant
  (requested by the user). It sets the device name in the device registry, the
  same as the device page of Home Assistant, so the new name applies everywhere.
  Enter or the check mark saves, Escape or the cross cancels. The name of the
  integration is kept and shown as "Original name" with "Reset"; an empty name
  restores it. Only the device is renamed, entity IDs stay as they are. Only
  administrators can rename (new command `device_panel/rename_device`).

## [1.20.0] - 2026-10-06

Parallel outage timeline.

### Changed

- Settings › Monitoring and notifications: the timeline of "Offline after" and
  "Notify after" now shows two parallel bars that start at the same zero point
  ("device gone"), because both times count from the start of the outage
  (requested by the user). The bar length follows the value (the longer one fills
  the width, the other is shown in proportion, at least a fifth) and changes while
  you type. Same in the overview and in the integration details; a missing push
  shows a dashed line with the reason, and an integration that delays the push
  shows the global value as a dashed mark.

## [1.19.0] - 2026-10-06

Copy the entity ID.

### Added

- Device pop-up: every entity in the list has a copy button that puts its
  entity ID on the clipboard (requested by the user). A check mark confirms it;
  the button does not open the entity details.

## [1.18.0] - 2026-10-06

Start values for new installations.

### Changed

- New installations start with the values the author uses (requested by the
  user, based on screenshots of the settings):
  - Order of the filter chips: "All" (pinned) first, then Integration, New,
    Offline, Warnings, Low battery, Battery, Area, the connection types (Thread,
    Wi-Fi, Bluetooth, Zigbee, LAN, Cloud, Matter, Network, Unknown, Z-Wave) and
    last Weak signal, Update available and Own setting. Without a stored order
    this is also what "Default order" restores.
  - Content of the outage notification: area, integration, connection type,
    offline since and last battery level (before: area, integration, offline
    since).
  - Content of the battery notification: level, area and integration (before:
    level and area).
  - The chip "Own setting" is hidden (it can be switched on in Settings ›
    Display › Filter chips).
- The content of the notifications and the hidden chip apply only to new
  installations, existing ones keep what they have. The new default order also
  applies to installations that never changed the order of the chips (earlier
  default: Area, Integration, "All" and the connection types by number of
  devices); a stored order stays as it is.

### Fixed

- In Settings › Display › Filter chips, the preview of the phone bar with the
  pinned chips no longer covers the header of the dialog when you scroll.

## [1.17.0] - 2026-10-06

Signal warning threshold per connection type.

### Added

- Warning threshold for the signal per connection type (requested by the user):
  Wi-Fi, Bluetooth, Zigbee, Z-Wave and so on each get their own value, because
  they report in different units (Wi-Fi and Bluetooth in dBm, Zigbee usually in LQI) and
  have different ranges. Each connection type is set to "Default", "Own" or
  "Off" ("Off" never marks it as weak).
  - Global: Settings › Display › Connection type, block "Signal: warning
    threshold per connection type". Only connection types with devices that
    report a signal value are listed.
  - Per integration: Settings › Monitoring and notifications › Integrations,
    section "Signal" of the integration. The value of the integration goes
    before the global value; "All to default" and "Reset all" include it, the
    integration list shows "Signal (n connection types)".
  - Order of precedence: own value on the device, then integration, then global
    value, then the fixed default (below -80 dBm or LQI 61).
  - A number only applies to devices that report in the same unit (negative =
    dBm, positive = LQI); otherwise the next level applies.
  - In the device pop-up the first option names where the value comes from
    ("Global value (below -85 dBm)", "Like integration (below -90 dBm)", "... (off)"),
    with the origin "Integration Shelly" and what the default would be.
  - The AI assessment uses the value that applies to the device (`signal.weak`
    and `own_threshold`).
  - New options `signal_low` and `signal_low_integrations` (also in the options
    dialog as YAML, for example `{"wifi": -85, "zigbee": 40, "ble": "off"}`).

## [1.16.0] - 2026-10-06

Warning instead of problem.

### Added

- New filter chip "Offline" (German "Ausgefallen") with the number of devices
  that are offline right now. Like the hint chips it appears only when it
  applies, and it can be ordered, hidden and pinned like the others.
- A line at the bottom of the tile "Currently offline": "3 devices with a
  warning" (requested by the user, mockups `docs/mockups/chip-warn-v1/`, V1). A
  tap shows only those devices. Without warnings the line says "No warnings".

### Changed

- Two levels instead of "problem": **Outage** (device offline) and **warning**
  (unstable, low battery, weak signal, or no data). The chip "Problems only" is
  now "Warnings" and shows only warnings, without outages; it shows its number
  and appears only when it applies. With "Offline" switched on as well, you get
  what "Problems only" showed before.
- "Threshold" is now "warning threshold" for battery and signal ("Own warning
  threshold", "Own battery warning threshold", in the panel, the options dialog
  and the README). Stored settings stay valid, no keys changed.

### Fixed

- The description of the chip said "Only offline and unstable devices" although
  it also showed low battery, weak signal and devices without data. It now says
  what the chip does.

## [1.15.0] - 2026-10-05

Pin filter chips.

### Added

- Settings › Display › Filter chips: a line "pinned up to here" in the chip
  list (requested by the user, mockups `docs/mockups/chip-pin-v1/`, B). It
  has a handle and moves like a chip. The visible chips above it stay on the
  left when the chip bar scrolls sideways on the phone, with a shadow at the
  edge once you scroll. At the very top (default) nothing is pinned.
  - The bar scrolls sideways only on narrow screens (up to 600 px); on the
    desktop it wraps as before and pinning has no effect.
  - Pinned chips that would take more than 60 % of the bar scroll along
    instead, so the rest stays reachable.
  - The preview above the list marks the edge with a pin and, once something
    is pinned, adds the phone bar scrolled sideways (you can scroll it to try).
  - Applies to all users, stored with the order in `chip_order`.

## [1.14.0] - 2026-10-05

One list for all filter chips.

### Added

- Settings › Display › Filter chips: a preview "How the bar looks" above the
  list shows the chips in the order you set, with the hidden and the
  not-applicable ones left out like in the real bar. It updates with every
  change.
- Fine separators in the bar between two chips of a different kind: the
  selection windows (Area, Integration), "All" with the connection types
  (exactly one active), and "Problems only" with the hints. In the default
  order they stand where they always did.

### Changed

- The order of all chips is one list (requested by the user, mockups
  `docs/mockups/chip-order-v3/`, D2). "All" is a row of its own with a lock
  ("fixed"): it can be moved but not switched off. Every connection type is a
  row of its own with a switch and a handle, so Zigbee can also stand between
  two hints. Top to bottom is left to right. Before, "Connection types" was
  one block and the connection types had a second list below.
  - The second list "Connection type" and the button "Sort by number" are
    gone. "Default order" resets everything (Area, Integration, All, connection
    types by number of devices, then "Problems only" and the hints).
  - "Toggle all" switches all chips, including the connection types.
  - Connection types with the same number of devices now stand in a fixed
    order instead of the order of the devices.
  - Existing settings are kept: the block from 1.13.0 and the order of the
    connection types become one order. In the options dialog of Home
    Assistant, "Order of the connection type chips" is now only the starting
    order until you drag chips in the panel.

## [1.13.1] - 2026-10-05

Not released; included in 1.14.0.

Update box after a restart of Home Assistant.

### Fixed

- After "Restart now" in the update box, "Home Assistant is restarting…"
  stayed for good as long as the page was not reloaded: Home Assistant does
  not reload the panel after a restart, and the panel never cleared that
  state. The box now reads the running version again as soon as Home
  Assistant answers; if a different version is running, the message goes
  away. If no restart happened within 5 minutes, the "Restart now" button
  comes back.
- If Home Assistant refuses the restart (for example because the
  configuration is invalid), the error now appears in the box ("Restart
  failed: …") and the button stays. Before, the panel claimed it was
  restarting.

## [1.13.0] - 2026-10-05

Order of all filter chips.

### Added

- The order of all chips above the list can be set (requested by the user,
  for example to put "Battery" first). Settings › Display › Filter chips: the
  list "Other chips" has a handle on every row (drag with mouse or finger, or
  move with the arrow keys), like the connection type chips. The new row
  "Connection types" stands for "All" and the connection type chips as one
  block; it is always on and can be moved like the others. The order inside
  the block stays adjustable below.
  - Chips that apply to no device still do not appear, wherever they stand.
  - Separators only stand around the connection type block, and only next to
    a visible chip. "Default order" resets it; the default order is stored as
    empty. Applies to all users.
  - New option `chip_order` (set in the panel, kept by the options dialog of
    Home Assistant, which cannot drag).

## [1.12.2] - 2026-10-05

Back from the Home Assistant device page, found and fixed.

### Fixed

- The arrow at the top left of the Home Assistant device page led to the
  device list of Home Assistant instead of back to the panel (reported by
  the user, also in the browser, so not a problem of the app). Cause: since
  the frontend of Home Assistant 20260930 the device page has a fixed back
  page (the device list) and goes back in the history only if the history
  entry says where you came from (`history.state.from`). The panel's link
  created the entry without it. It now creates the entry like Home
  Assistant's own navigation. Checked in a Home Assistant with that frontend:
  before the arrow went to `/config/devices/dashboard`, now to
  `/device-panel`; also with the older frontend 20260128.6.
  - Applies to "Open HA device page" in the device pop-up and to the link to
    the HACS device in the settings.

### Changed

- The marker `historyBack=1` that 1.12.1 added to the link is removed again:
  it had no effect on the device page.

## [1.12.1] - 2026-10-05

Back from the Home Assistant device page.

### Fixed

- "Open HA device page" (device pop-up, and the link to the HACS device in
  the settings) now opens the page with Home Assistant's own marker
  `historyBack=1` (reported by the user: the arrow at the top left of the
  device page led to the device list of Home Assistant instead of back to
  the panel, in the companion app). With the marker Home Assistant goes back
  in the history, to the panel, instead of to a fixed page. Versions of Home
  Assistant that do not know the marker ignore it; there the arrow already
  goes back in the history.

## [1.12.0] - 2026-10-04

"Groups | List" moves into the customize dialog.

### Changed

- The switch "Groups | List" no longer takes room in the chip row (requested
  by the user: do we really need it?). It now sits at the top of the dialog
  "Customize" ("Columns" on the desktop, "View" on the phone), with its note:
  groups keep the offline devices on top and sort within each group, the list
  sorts across all devices (for example by battery).
  - The setting itself is unchanged and stays saved per user, separate for
    desktop and phone.
  - "Restore default" in the desktop dialog also restores the groups.
  - The chip row and the line below it on the phone are shorter.

## [1.11.0] - 2026-10-04

Hide any filter chip.

### Added

- All filter chips can be hidden (requested by the user): Settings,
  "Appearance", tab "Filter chips", new table "Other chips" above the
  connection types: Area, Integration, Problems only, Battery, Low battery,
  Weak signal, Update available, Own setting and New, each with a switch and
  "Toggle all". "All" always stays.
  - Applies to all users, like the hidden connection type chips; the
    devices stay visible.
  - A hidden chip clears its filter (requested by the user): "Problems only",
    the hint, the area and the integration are reset, so no invisible filter
    shortens the list. The header counts all devices again.
  - The summary of the section counts the hidden chips of both tables.
  - New option `hide_chips`, also in the options dialog of Home Assistant
    ("Hide filter chips").

## [1.10.0] - 2026-10-04

The AI assessment takes an uncertain battery forecast into account.

### Added

- The fact `battery_forecast` of the AI assessment (requested by the user)
  now says when the calculation is uncertain: `uncertain` with
  `uncertain_reasons` (confidence not "high", the drop is getting steeper so
  the forecast is probably too optimistic, or less than 30 days of
  history), plus `days_range` (no `max`: at least that long) and
  `days_of_history`. With too little history the fact says so
  ("too little history for a forecast") instead of being left out.
- The default prompt tells the AI to treat an uncertain forecast as such: only
  a rough range, never a firm date, say that it is uncertain, do not base the
  cause on it, and lower its own certainty when a battery statement rests on
  it.

### Changed

- The default prompt is about 340 characters longer (4282 of 6000). A saved
  own prompt keeps its text; "Default" in expert mode loads the new one.

## [1.9.0] - 2026-10-04

Not released; included in 1.10.0.

Filter by integration, like the filter by area.

### Added

- Filter chip "Integration" next to "Area" (requested by the user): select
  one or more integrations in a list with the number of devices each
  (pop-over on the desktop, sheet on the phone, search from nine entries,
  "No integration" for devices without one).
  - The list shows only the devices of the selected integrations; the other
    chips filter within them. Tapping "All" clears area and integration.
  - Combines with the filter by area (both must match): the numbers in each
    selection and on the chips count with the other filter.
  - The header (availability, offline now, outage pulse, group outages) and
    the pulse window count only these devices; the title names the
    selection ("· Kitchen · Shelly").
  - The active chip shows one or two names, otherwise the number, and a
    cross that clears only this filter.
  - Saved per user like the view, separate for desktop and phone. An
    integration that no longer exists drops out silently.
  - The filter uses the integration of the device as the column
    "Integration" shows it.

## [1.8.0] - 2026-10-04

The battery of the last 12 months in the AI assessment.

### Added

- New fact `battery_last_12_months` for the AI assessment (requested by the
  user): average and lowest level per calendar month (at most 12), the
  battery changes with days ago and the level before and after (the last 6),
  the lowest level and the number of days covered. It comes from the
  battery history (recorder) and is part of the group `{facts_battery}`.
- The default prompt explains it, compares the time between battery changes
  with the current drop and adds one sentence on the battery of the last
  12 months to every assessment of a battery device (trend, changes,
  forecast).

### Changed

- The prompt may now be up to 6000 characters (before 4000): the default
  prompt needs almost 4000. Saved prompts stay valid.
- The note in the settings names the 12 months of the battery.

## [1.7.0] - 2026-10-04

Groups of facts as variables in the expert mode of the AI assessment.

### Added

- Expert mode: besides `{language}` and `{facts}` (everything, as before) the
  prompt can use groups of the facts as variables (requested by the user):
  `{facts_device}`, `{facts_history}`, `{facts_battery}`, `{facts_signal}`,
  `{facts_integration}`, `{facts_area}`, `{facts_hub}` and `{facts_model}`.
  Whoever does not use `{facts}` inserts only the wanted groups and so
  controls scope, order and cost. The facts themselves are not split
  further; every fact belongs to exactly one group.
  - The window "Edit prompt" shows the new variables as chips with a short
    explanation (tooltip) and a hint.
  - A prompt needs `{facts}` or at least one group; an unknown variable is
    reported first.
  - A group without facts for the device is empty (`{}`). The preview shows
    the exact text.
  - The variables are replaced in one pass: a placeholder inside a device
    name is not replaced again.
- The default prompt is unchanged and still uses `{facts}`.

## [1.6.0] - 2026-10-04

Not released; included in 1.7.0.

More context for the AI assessment: the room, the radio standard, the hub and more.

### Added

- Facts for the AI assessment (requested by the user):
  - `same_area_devices`: the other devices in the same area with their
    values (type, integration, connection type, status, minutes offline,
    signal with `signal_weak`, battery, interruptions in 24 h), notable ones
    first (offline, unstable, weak signal or low battery), healthy ones too
    as counter-evidence; at most 15, no IDs or entities.
  - `same_area_same_connection`: how many devices in the area use the same
    radio standard (for example Thread or Bluetooth) and how many are
    offline.
  - `same_hub_other_devices` and `same_hub_offline_devices`: other devices
    on the same hub or router, how many are offline and how many are in the
    same area.
  - `went_offline_within_5_min_of_this_device`: for offline devices of the
    area, hub and integration, whether they failed together with this one.
  - `same_model_other_devices`: same manufacturer and model, also by
    software version (series or firmware fault).
  - `last_7d`: availability, interruptions and longest interruption over
    7 days (recurring problem or one-off).
  - `battery_forecast`: days until the warning threshold, from the battery
    forecast of 1.5.0.
- The default prompt explains the new facts; healthy devices in the area, on
  the hub or on the same radio standard count as evidence against a shared
  cause.

### Changed

- `same_area_offline_devices` is replaced by `same_area_devices`, which
  includes the offline devices with minutes. A saved own prompt keeps its
  text; "Default" in expert mode loads the new one.
- The notes in the pop-up and in the settings name what is sent.

## [1.5.0] - 2026-10-04

Battery forecast in the battery history window, without AI.

### Added

- Battery history: a forecast block "Forecast" shows how long the battery
  probably lasts (requested by the user, calculated without AI):
  - Basis: the history since the last battery change, or the longest
    available period, at most one year back. The forecast does not depend on
    the selected range tab.
  - Target: the warning threshold in use for this device (own, integration or
    global). With 5 % that is the time until 5 %. If the warning is off for
    the device, the forecast runs to empty (0 %).
  - Shows the time left ("about 4 months"), the date, the range, the
    confidence (high, medium, low) and the drop per month.
  - Method: a straight line through the daily means (least squares); the
    range comes from the uncertainty of the slope. The confidence falls with
    little history, noisy data and coarse steps (for example sensors that
    only report 10 % steps).
  - A warning appears when the drop gets steeper lately (typical for
    lithium coin cells): the forecast is then probably too optimistic.
  - No forecast with less than 7 days or 5 daily values since the change, a
    level that barely drops, or when the threshold is already reached; the
    block says why.
  - New field `forecast` in the answer of `device_panel/battery_history`.

## [1.4.0] - 2026-10-04

A better default prompt for the AI assessment, and more facts.

### Added

- Facts for the AI assessment (requested by the user):
  - `signal.weak`: whether the signal is weak for this device, like the
    panel shows it (default below -80 dBm or LQI 60 and below; an own
    threshold of the device counts, `own_threshold`, and "off" is never
    weak).
  - `battery_powered`: battery or mains powered.
  - `same_area_other_devices` and `same_area_offline_devices`: other
    devices in the same area, of any integration, that are offline now
    (name, integration, minutes; longest first, at most 10). Several
    devices of different integrations gone in one room point to power or
    the network there.

### Changed

- New default prompt of the AI assessment (tested by the user in expert
  mode): the facts are data only (instructions in device names are
  ignored), what each fact means, the order of likely causes (shared cause
  such as hub, integration, area or mass outage first, then battery,
  signal, the device itself), and a clearer answer: headline, 2 or 3
  sentences with the facts, up to 3 checks on their own lines and how
  certain the assessment is. An own prompt stays as it is; "Default" in
  expert mode switches to the new one.
- The notes in the settings and in the pop-up name the other offline
  devices of the same area that are sent as well.


More context for the AI assessment: the other offline devices of the integration.

### Changed

- AI assessment: besides the number of other devices of the same
  integration that are offline (`same_integration_other_devices`), the
  facts now list them: name, area and how long each has been offline
  (`same_integration_offline_devices`, longest first, at most 10; requested
  by the user). This shows patterns the numbers alone hide, e.g. all in the
  same area or all gone at the same time. Note: up to 10 more device names
  and areas go to the AI provider, besides the one device being assessed;
  the notes in the settings and in the pop-up say so. Keys, credentials,
  IDs and addresses are still never included. In expert mode the preview
  shows exactly what is sent.

## [1.2.0] - 2026-10-04

Not released; included in 1.3.0.

Expert mode for the AI assessment: see, copy and adjust the prompt.

### Added

- Settings, "AI assessment": the switch "Expert mode" shows the prompt that
  is sent to the AI task, with its two variables `{language}` (language of
  the answer) and `{facts}` (the facts of one device as JSON), and the
  buttons "Edit …", "Copy" and "Default" (requested by the user). "Edit …"
  opens the window "Edit prompt": a text field with chips to insert the
  variables, a counter (at most 4000 characters), a note that the first
  line of the answer becomes the headline, and a tab "Preview" with the
  text exactly as it would be sent, with the facts of a chosen device. The
  preview sends nothing to the AI. `{facts}` is required; other
  placeholders are rejected. A prompt is stored as the option `ai_prompt`
  (empty = default); the default needs no storing. A custom prompt cannot
  request more data: still only the facts go out, never keys, credentials,
  IDs or addresses. The options dialog of Home Assistant has no field for
  it.

## [1.1.0] - 2026-10-04

Not released; included in 1.2.0.

"Reset all" for the integrations, all filter chips in the settings.

### Changed

- Settings, "Appearance" › "Filter chips": the list shows every
  connection type that exists, also those without devices right now
  (e.g. Matter, LAN), so a chip can be hidden or put in order in advance
  (requested by the user). Before, only types with devices were listed.

### Added

- Settings, "Monitoring and notifications" › "Integrations": the button
  "Reset all" next to the filter sets every integration back to the
  defaults at once (offline after, push, persistent notification, low
  battery threshold, push on low battery), like "Reset all" for the
  devices. It applies with "Save"; greyed out when nothing differs.
  Devices with their own setting stay as they are (reset in the tabs
  "Outage" and "Battery").

## [1.0.0] - 2026-10-04

Five sections in the settings instead of eight.

### Changed

- Settings (requested by the user: fewer items, what belongs together in
  one place): "Devices in the panel" comes first and holds everything that
  decides which devices the panel shows and monitors: the switches "Show
  service devices" and "Show disabled devices", and the tabs
  "Integrations", "Types" and "Devices" (the devices hidden one by one),
  each with the number hidden and a dot for unsaved changes. "Monitoring
  and notifications" is unchanged. "Appearance" holds what only changes
  how devices appear: the tabs "Connection type" (per integration, with
  the exceptions on devices) and "Filter chips" (which chips, in which
  order). The old sections "Integrations", "Device types", "Connection
  type", "Display" and "Hidden devices" are merged into these two. No
  option changed; saved settings stay as they are. The summary of
  "Devices in the panel" says what is hidden, e.g. "1 integration, 1 type
  hidden".

## [0.34.1] - 2026-10-04

Not released; included in 1.0.0.

The pulse is red where it is above zero and green only where it is zero.

### Fixed

- Pulse at the top and in the window "Outages in 24 h": the line is now
  coloured section by section (requested by the user): red as long as the
  curve is above zero, including the rise and the drop, green only where
  it is zero; the red area only under the red sections. 0.34.0 turned the
  whole curve green as soon as no device was offline right now, so the
  bumps of past outages were green as well.

## [0.34.0] - 2026-10-04

Monitoring and notifications in one place, with a timeline per notification.

### Added

- Settings: new section "Monitoring and notifications" at the top, with four
  tabs (requested by the user: everything that monitors or notifies in one
  place, so it is clear at a glance when which notification arrives):
  - "Overview": one timeline per notification. Outage: device gone, offline
    in the panel after "Offline after", push after "Report only after"
    (one mark when both are equal). Low battery: threshold, then push right
    away or daily at the chosen time. The switches as chips (push,
    persistent, back online, group outage), how many integrations and
    devices differ (with links), push target and what a tap opens.
  - "Outage": the two times on an editable timeline, detection (unstable
    from, grace period), notification (push, back online, group outage,
    persistent notification, content with preview) and the exceptions
    (integrations, devices to reset).
  - "Battery": "Low from" on the timeline, push with time and daily
    content, persistent notification, content with preview, exceptions.
  - "Integrations": one row per integration with what differs from the
    defaults in one sentence, filter "Differs". A tap opens all settings of
    the integration with its own timeline (e.g. push only after 60 min when
    its devices count as offline only then): monitor, offline after, push
    on outage, persistent notification, low from, push on low battery, its
    devices with their own setting, "All to default". Labels "Default" and
    "Own" as in the device pop-up.
- Push on low battery can be switched off per integration (option
  `battery_push_exclude_integrations`); the red mark in the panel and the
  persistent notification stay. The device pop-up says so next to the
  battery warning.
- The content of the low battery push is adjustable like the outage
  notification: level, area, integration, manufacturer and model (option
  `battery_fields`, default level and area as before), with a preview. The
  daily or group notification lists the extra details in brackets after
  each device.

### Changed

- "Report only after" can no longer be shorter than "Offline after"
  (requested by the user): before that a device does not count as offline,
  a shorter value had no effect and was misleading. The panel shows the
  error under both fields and blocks saving, also when "Offline after" is
  raised later; the options dialog of Home Assistant shows the same error.
  The value 0 ("as soon as offline") no longer exists. A value saved
  before (0 or shorter) counts as "Offline after", as it always did, and
  stays until it is changed.
- The section "Integrations" only has "Show"; push, persistent and offline
  after per integration moved to "Monitoring and notifications" ›
  "Integrations". The sections "Outage detection", "Battery", "Push
  notification" and "Persistent notification" are merged into the new
  section.
- "Monitor" is a switch of its own per integration (before: "Don't
  monitor" in the selection "Offline after"); off still means no outages,
  battery warning, statistics or notifications.
- Options dialog of Home Assistant: same order as the new section, with the
  two new fields.
- The pulse at the top turns green again as soon as no device is offline
  (requested by the user: "green again, so you can see it"); the bumps of
  past outages stay visible. Red only while a device is missing. Same in
  the window "Outages in 24 h".
- Tile "Availability": the big number is the share online right now, like
  the ring ("100 % now" when all are online); below it, smaller, the
  average of the last 24 hours ("avg. 24 h: 98.7 %"). Before, the big
  number was the 24-hour average and read like an error next to a full
  ring (question from the user). Never 100 % while a device is missing.

## [0.33.1] - 2026-10-04

Clearer: "Content of the outage notification" is not the battery warning.

### Changed

- Settings, section "Push notification": "Content of the notification" is
  now "Content of the outage notification", the switch "Battery" is now
  "Last battery level" (like "Last signal"). A note box under the switches
  says what the setting covers: only the outage notification ("Offline:
  …"), not the low battery warning, which is a separate notification with
  fixed content (level and area) and is set up in the section "Battery".
  That section says the reverse. The options dialog of Home Assistant has
  the same wording.

### Fixed

- The pulse tile in the header no longer swaps the whole row of tiles every
  10 seconds: its time axis followed the second of the last query, so the
  row was rebuilt with every refresh, and a tap at that very moment was lost
  (the pulse window did not open, found by the test suite). The axis now
  follows the minute.

## [0.33.0] - 2026-10-03

Optional AI assessment of a device.

### Added

- Device pop-up: a button "Assess with AI" below the statistics. On a press
  (never on its own) the panel sends the facts of that one device (name,
  area, type, manufacturer and model, status and duration of an outage,
  availability and interruptions of the last 24 hours, battery, signal,
  hub, integration, whether other devices of the integration are offline,
  mass outages it was part of) to an AI task of Home Assistant
  (`ai_task.generate_data`) and shows the answer as a card with a headline,
  the source and the time, and "Create again". Never sent: keys,
  credentials, IDs, addresses, entity names. The answer stays in the panel
  only, it is not stored. Errors (no AI task, timeout, error of the task)
  are explained.
- Settings, new section "AI assessment": off by default, because depending
  on the provider the data leaves your network and costs per request.
  Switching it on shows the button; the AI task can be chosen (empty =
  default of Home Assistant). The options dialog has the same two settings
  (`ai_assessment`, `ai_task_entity`). Needs an AI task in Home Assistant
  (Settings → System → General).

## [0.32.0] - 2026-10-03

Not released; included in 0.33.0.

Thread role and network name for Matter devices.

### Added

- Device pop-up, section "Connection": for Matter devices two more tiles
  from the Matter diagnostics: "Thread role" (router, end device or sleepy
  end device, with a short hint) and "Network" (the Thread network name,
  for Wi-Fi devices the network name of the Wi-Fi). The tiles are
  additional information: the connection type set by hand (e.g. Thread)
  stays possible and takes precedence over the detection. Unknown roles,
  bridges and devices the Matter server cannot reach show no tile.

## [0.31.0] - 2026-10-03

Not released; included in 0.33.0.

Origin of every setting in the device pop-up, and "Offline after" per device.

### Added

- Device pop-up, "Settings for this device": under every setting a label
  shows where the value comes from (Default, Integration with its name, or
  Device) and what the default would be ("Default would be 2 min"). The
  explanation moved into the tooltip of the label. The choices say it too:
  "Same as integration (1 h)" instead of "Global value" when the
  integration has its own value.
- New row "Offline after" per device: same as the integration or global
  value, own time in minutes (1 to 1440) or "Don't monitor". The device
  comes first, also against "Don't monitor" of its integration. A symbol
  next to the name and the chip "Own setting" show devices with an own
  time; in the settings (section "Outage detection") a list resets them to
  the integration or global value, one by one or all together.
- Outage notifications show the state of the integration: "Push on ·
  Persistent off", and "Same as integration" when the integration is
  excluded from push or persistent notifications.

## [0.30.0] - 2026-10-03

Not released; included in 0.33.0.

Own "Offline after" per integration, and "Don't monitor".

### Added

- Settings, section "Integrations": a new column "Offline after" with a
  choice per integration: default, a fixed time (1, 2, 5, 10, 15 or 30
  minutes; 1, 2, 6, 12 or 24 hours) or "Don't monitor". Devices that report
  rarely (e.g. Bluetooth sensors) no longer count as offline after two
  minutes. The device's primary integration decides. On the phone the
  choice sits under the name. The options dialog of Home Assistant has the
  same setting as a mapping (`offline_after_integrations`, e.g.
  `zha: 60` or `hue: off`, 1 to 1440 minutes).
- "Don't monitor": the devices of the integration stay visible, in their own
  group "Not monitored" with the status "Not monitored", but have no
  outages, no availability statistics, no notifications (outage or
  battery) and no own signal recording, and they do not count in the
  header, the outage pulse or the unstable devices.

### Changed

- The recorder backfill of the availability log uses the "Offline after"
  time of each device's integration.

## [0.29.1] - 2026-10-03

Not released; included in 0.33.0.

Clearer "Content of the notification".

### Fixed

- Settings, "Content of the notification": the preview now picks the
  offline device with the most details, and where the device shown has no
  value (e.g. no battery level) it shows an example value in italics, so
  every switch visibly changes the preview. A note says so; the real
  notification leaves such a detail out.
- The explanation says what the switches mean: "Battery" and "Last signal"
  give the last known value of the device that went offline, "Offline
  since" the start of the outage, and the low battery warning is a
  separate notification.

## [0.29.0] - 2026-10-03

Battery history for 6 and 12 months.

### Added

- The window "Battery" has two more periods: 6 months and 12 months, from
  the long-term statistics as daily means (months on the axis, battery
  changes still marked). On the phone the period selector scrolls sideways
  and brings the chosen period into view.

## [0.28.0] - 2026-10-03

Fixed header on phone and desktop.

### Changed

- Phone and desktop, in both views (groups and list): only the list
  scrolls now. Once the tiles have scrolled away, a line stays at the top
  ("11 of 16 online · 4 offline", with the area when the filter is on); the
  chips (on the phone also the sorting) stay below it, and on the desktop
  the table header sticks directly under the chips. Tapping the line
  scrolls back to the tiles.
- The tile "Added" in the device pop-up shows the date with the year
  (e.g. "Sat, 13/06/2026, 12:56").

## [0.27.1] - 2026-10-03

Connection loss no longer shows an error.

### Fixed

- After the phone had been asleep, the panel showed "Loading failed:
  [object Object]" and an empty list. Home Assistant reports a lost
  connection not as an error with text but as a number or an object, and the
  panel did not understand it. Now the list stays, a note "Connection to
  Home Assistant interrupted, trying again …" appears at the bottom, and
  the panel asks again by itself (after 1, 2, 4, 8 s, then every 10 s) and
  at once when the phone wakes up, the page comes back or the network
  returns. On the first load without a connection the panel keeps saying
  "Loading devices …" with the same note. A query without any answer stops
  after 20 s. Real errors keep their text; unreadable ones now read
  "unknown error" instead of "[object Object]".

## [0.27.0] - 2026-10-03

Signal history fills, button "Hide device".

### Changed

- Signal history: for a sensor the recorder does not record (excluded in
  its configuration), the panel now records the signal itself, like for
  ZHA and Bluetooth (every minute while the device is online). The window
  "Signal" says why.
- The button in the device pop-up is now called "Hide device" instead of
  "Hide". On narrow phones the two buttons stay on one line.

### Fixed

- Signal and battery history showed only the point "now" when the
  recorder had no entry in the period, e.g. because the value had not
  changed for longer than the recorder keeps data (default 10 days) or the
  sensor is excluded from the recorder. The current value applies since
  its last change, so the line now runs from there (at most from the start
  of the period), with the note "Value unchanged since …".
- A failed recorder query for the signal or battery history is now logged
  as a warning instead of only at debug level.

## [0.26.0] - 2026-10-03

Outage pulse window, header per area, dialog "Customize".

### Added

- Tapping the tile "Outage pulse" opens the window "Outages in 24 h": the
  pulse large, below it all devices with outages in the last 24 hours,
  most outages first, with number, total time offline and the 24-hour
  strip; devices that are offline right now are marked. Tapping a point
  in the pulse shows only the devices that were offline then, tapping a
  device opens its pop-up.

### Changed

- With the filter "Area", the header follows the selected areas: the tile
  "Availability" with its ring, "Offline now", the outage pulse and the
  group outages count only their devices, and the tiles show the area
  after their title. A group outage remains only if at least 3 devices in
  the area were affected.
- Desktop: the columns are chosen in the dialog "Customize" instead of a
  small pop-over: an eye shows or hides a column, the handle drags it into
  a different order, "Device" is always visible; "Restore default" and
  "Done" at the bottom. On the phone, the sheet "View" uses the same eyes
  and buttons.

### Fixed

- The outage pulse counted a device several times in a 30-minute section
  when it went offline more than once in it (or an outage ran across a
  restart), so the curve could show 3 devices where only one was
  affected. It now counts devices, as its tooltip says and like the strip
  in the list.

## [0.25.0] - 2026-10-03

"All" clears every filter.

### Changed

- Tapping the chip "All" clears all filters at once: area, connection
  type, "Problems only" and the hint chips (battery, new …). The search
  stays (it has its own ×). "All" is highlighted only when no filter is
  active, and its number shows all devices, as many as tapping it shows.

## [0.24.0] - 2026-10-03

Not released; included in 0.25.0.

Coloured battery symbol and signal history.

### Added

- Tapping the tile "Signal" in the device pop-up opens the signal history
  for 24 h, 7 days and 30 days: the value as a line, the threshold of the
  weak signal warning dashed, above it the current value, median, worst
  and best value. Signal from a sensor (e.g. Wi-Fi RSSI, Zigbee2MQTT LQI)
  comes from the recorder (30 days from the long-term statistics). For ZHA
  and Bluetooth, whose value comes directly from the integration, the panel
  records the signal itself every minute (median per 5 min for 24 h, per
  hour for 31 days, with the range from worst to best value); this history
  starts with the update. Gaps mean the device was offline or not
  received.

### Changed

- The battery symbol shows the level as a fill and in four colours like
  the signal bars: green above 50 %, yellow-green up to 50 %, orange up to
  30 %, red when the battery counts as low (threshold of the battery
  warning, like the chip "Low battery"). Also in the device pop-up.

## [0.23.0] - 2026-10-03

Hide single devices and filter by area.

### Added

- Hide single devices: button "Hide" in the device pop-up. A hidden device
  disappears completely: not in the list or the header, not monitored, no
  notifications. A note with "Undo" appears afterwards. Applies to all
  users.
- Settings, new section "Hidden devices": all hidden devices with name,
  area and integration, a switch "Show" per device and "Show all", applied
  with "Save". Also in the options dialog of the integration (field
  "Hidden devices").
- Filter "Area": chip at the start of the chip row. Select one or more
  areas or a whole floor; the list shows only their devices, and the other
  chips filter within them. Floors and areas in the order set in Home
  Assistant, areas without a floor and "No area" at the end, the number of
  devices per area, search from 9 areas. Saved per user, separately for
  desktop and phone. The header (ring, "Offline right now", pulse) keeps
  showing the whole home.

## [0.22.0] - 2026-10-03

Battery history in the device pop-up.

### Added

- Tapping the tile "Battery" in the device pop-up (devices with a battery
  in percent) opens the window "Battery" with 24 h, 7 days, 30 days and
  3 months: the level as a line with area like a share price, axis always
  0–100 %, the warning threshold dashed, battery changes marked and listed
  below (jump of at least 30 points upwards). Above: the current level,
  the change since the last battery change and the use per day, otherwise
  lowest and highest value.
- Source is the recorder: 24 h and 7 days from the history, 30 days and
  3 months from the long-term statistics (hourly values, kept beyond the
  10 days of the recorder). Without statistics (sensor without
  state_class) the history is used as far as the recorder has data; the
  window says so.

## [0.21.0] - 2026-10-03

Not released; included in 0.22.0.

Weak signal warning per device and new devices marked.

### Added

- Device pop-up, "Settings for this device": "Weak signal warning" like the
  battery warning: global value (below -80 dBm or LQI 61), own threshold
  "weak below" or off. The own threshold starts a little below today's
  value (5 dBm or 10 LQI). Marking, the chip "Weak signal" and "Problems
  only" follow; it counts as an own setting (symbol next to the name, chip
  "Own setting") and can be reset in the settings, section "Connection
  type". For devices that always have a weak signal.
- New devices: for 3 days after they were added to Home Assistant they
  show "New" next to the name (date in the tooltip), and the chip "New"
  shows only them. The device pop-up shows "Added" with the date.

### Changed

- The section "Notifications for this device" in the device pop-up is now
  called "Settings for this device".

## [0.20.0] - 2026-10-03

Not released; included in 0.22.0.

Outage notifications per integration, with delay, content, actions and a
persistent notification.

### Added

- Settings → "Integrations": besides "Show" two more columns, "Push" and
  "Persistent", each with "Toggle all". They decide which integrations send
  outage notifications and which appear in the persistent notification;
  hidden integrations lock both. The summary shows "push for N" when push
  notifications are on.
- Settings → "Push notification": "Report only after" (0–60 min, default
  0). Short outages send no notification, not even "back online". The
  waiting time runs on without a state change and survives a restart of
  Home Assistant.
- "Content of the notification": area, integration, connection type,
  offline since, last signal, battery, manufacturer / model as switches
  (default: area, integration, offline since), always in this order, with
  a preview of an outage notification using a device from the list.
- Outage notifications have the buttons "Open" (the device in the panel)
  and "Mute 24 h" (mutes the device for a day). The device pop-up shows
  "Muted until …"; "Global setting" lifts it.
- New section "Persistent notification" with "For outages": one
  notification in Home Assistant lists all offline devices with a link to
  each, as long as they are offline. Dismissed, it comes back only with a
  new outage.

### Changed

- "Report outages" names the waiting time when "Report only after" is
  longer than "Offline after".

### Fixed

- A connection type set by hand (e.g. Thread) could jump back to the
  previous one (e.g. Matter) until the next refresh: a list request that
  had started before the change overwrote it. Such a result is now
  discarded and the list is requested again. The same applied to the type
  set by hand, the settings per device and saved settings.
- Availability window: an outage that lasted across restarts of Home
  Assistant appeared as a new entry after every restart. Outages without
  "online" in between are now one entry from the start to the end, in the
  list, the count, the total, the percentage and the tooltip, as in the
  tiles. The bar still shows the time without data.

## [0.19.0] - 2026-10-02

Not released; included in 0.22.0.

Columns, sorting and view per user, separately for desktop and phone.

### Added

- Desktop: button "Columns" next to the search with a list of all columns:
  show or hide, drag into your own order (also with the arrow keys),
  "Reset". New optional columns: area, outages 24 h, hub / bridge.
- Sort by clicking a column header: ascending, descending, then back to the
  default (offline first, longest outage on top). Devices without a value
  stay at the end.
- "Groups | List" next to the filter chips: groups keep offline, unstable
  and other devices apart and sort within them; "List" shows one list.
- Phone: line "Sorted by" below the chips and a sheet "View" (button next to
  the search) with sorting, direction, groups or list, and the details on
  the card (show, hide, drag into your own order).
- The view is saved per user in Home Assistant, on all devices alike,
  separately for desktop and phone: sorting, direction, groups or list,
  columns or card details, and the filter chips. The search text is not
  saved.

## [0.18.0] - 2026-10-02

Availability log filled from the recorder.

### Added

- Once after the update or installation, the availability log is filled
  from the recorder history for the time before the first entry of each
  device, as far back as the recorder keeps data (default 10 days, at most
  31 days). The same rule as the ongoing detection applies: offline only
  when all entities that show the device is alive are unavailable for at
  least "Offline after", no outage when the device is back within the grace
  period after a start, and time when Home Assistant was not running counts
  as "no data". It runs in the background two minutes after the start and
  sends no notifications for past outages. Limits: up to 3 entities per
  device, quiet ones first (connectivity sensor, then everything except
  sensors); entities with very many changes are skipped; a crash of Home
  Assistant does not show as a gap.

## [0.17.0] - 2026-10-02

Not released; included in 0.18.0.

Filters follow the search, new chip "Battery", connection type by hand as
an own setting.

### Added

- Chip "Battery": all devices with a battery, in every group sorted by
  level (lowest first); on the phone every card shows the level.
- Search field: a button (×) clears the search.
- A connection type set by hand on the device counts as an own setting:
  symbol next to the name (tooltip with the automatic value), included in
  the chip "Own setting", and listed in the settings section "Connection
  type" for resetting, one by one or all at once.

### Changed

- The number on a chip counts with the search and the other filters: as
  many devices as tapping it shows (before: always all devices). Chips
  without a match stay visible, dimmed, with 0.
- Tapping an active connection type chip again turns it off ("All").
- Phone: the tiles at the top (availability, offline now, outage pulse)
  all have the same height.
- Availability in percent only from 1 hour of data (list, pop-up,
  statistics window, average at the top). Before, a short outage right
  after the start showed e.g. "50 %"; now "–" with the note "Percent after
  1 h of data". Outages and their duration are still shown.

## [0.16.0] - 2026-10-02

Connection type per integration.

### Added

- Settings, new section "Connection type": per integration a selection
  "Automatic" or a connection type (Zigbee, Thread, Z-Wave, Matter,
  Bluetooth, Wi-Fi, LAN, Network, Cloud). It applies to all devices of the
  integration instead of the detection, also to correctly detected ones; a
  connection type set by hand on the device still comes first. Each row
  shows what the detection found ("5 devices · detected: 4 Zigbee,
  1 Unknown"). List, column and filter chips follow it. Also in the options
  dialog, e.g. "hue: zigbee".
- Device pop-up, tile "Connection type": without a choice on the device the
  first option reads "Same as integration: …" with a note when the
  integration sets it.

## [0.15.0] - 2026-10-02

Settings stay open after saving; push image no longer cut off.

### Changed

- Settings in the panel: "Save" no longer closes the dialog. It shows
  "Saved" next to the buttons and reloads the saved state; open sections
  and the scroll position stay. Without unsaved changes the left button
  reads "Close" instead of "Cancel".

### Fixed

- Push notifications: the "D" symbol was cut off at the corners on the
  phone (iOS shows the image in a rounded square). Notifications now use
  their own image with a margin (`/device_panel/push/icon.png`).

## [0.14.0] - 2026-10-02

Not released; included in 0.15.0.

Battery warning off for a whole integration; removing the integration
deletes its data.

### Added

- Settings section "Battery", list "Own threshold per integration": per
  integration a selection like in the device pop-up, "Global value",
  "Own threshold" or "Off". "Off" turns off the battery warning (marking,
  push, persistent notification) for all devices of the integration; their
  battery level stays visible. An own threshold on the device still comes
  first. Also in the options dialog, e.g. "bthome: off".
- Removing the integration deletes its own files (`.storage/device_panel.*`:
  availability log, settings per device, reported outages and batteries,
  shared panel settings), so nothing is left behind. Home Assistant's
  registries were never changed.

### Changed

- "Own threshold per integration": instead of an empty field for the
  global value, each row has a selection; the number field appears with
  "Own threshold". An empty field there is invalid (back to the global
  value via the selection).

## [0.13.0] - 2026-10-02

Not released; included in 0.15.0.

Order of the connection type chips; outage duration across restarts of
Home Assistant.

### Added

- Settings section "Display", "Filter chips of the connection type": drag
  the chips by the handle into your own order (mouse, touch, or arrow keys
  on the handle). "Sort by number" goes back to the default order (most
  devices first). Applies to all users, like hiding the chips. Also in the
  options dialog ("Order of the connection type chips"): chosen types in
  the order of selection, the others follow by number of devices.

### Changed

- The outage duration shows its start as a tooltip ("Offline since …",
  with weekday, date and time); "longest for" on the outage board also
  shows "≥" when the start is unknown.

### Fixed

- Outage duration after a restart of Home Assistant: list, outage board,
  pop-up and notifications showed the time since the restart instead of the
  real outage, often with "≥". An outage now only ends when Home Assistant
  sees the device online again; time without data in between (Home
  Assistant not running) does not end it. Start and duration come from the
  availability log, also across several restarts. "≥" only remains when the
  start is really unknown (e.g. the device was online when Home Assistant
  stopped and gone after the start).
- Statistics: an outage across a restart counted as two (24 hours, 7 and 30
  days, "unstable") and could show a false group outage at the start. Now it
  counts once; the bars still show the time without data.
- After every restart, a device that was already offline counted as online
  for the first minutes: the log recorded "online" and, with notifications
  on, "Back online" and a second "Offline" were sent. Such entries from
  earlier versions are removed when the log is loaded.

## [0.12.0] - 2026-10-02

Not released; included in 0.15.0.

Connection type by hand.

### Added

- Device pop-up, tile "Connection type": choose it like the type,
  "Automatic: <detected>" or any connection type (Zigbee, Thread, Z-Wave,
  Matter, Bluetooth, Wi-Fi, LAN, Network, Cloud), for devices whose
  connection is not detected (e.g. "Unknown"). Applies immediately and is
  stored by the integration; list, column and filter chips follow it.
  "Automatic" goes back to the detection.

## [0.11.0] - 2026-10-02

Filter chips of the connection type can be hidden.

### Added

- Settings section "Display", also in the options dialog: "Filter chips of
  the connection type". Hide single chips (Zigbee, Wi-Fi, Thread …) above
  the list for a clearer overview; the devices stay visible. "All",
  "Problems only" and the hints always stay. Applies to all users. If the
  filter of a hidden chip is active, it goes back to "All".

## [0.10.0] - 2026-10-02

Not released; included in 0.11.0.

Settings per device at a glance: marked in the list, filterable and
resettable in the settings.

### Added

- Device list: a device with its own setting shows it next to its name, one
  symbol per kind: battery with its own threshold ("30 %"), battery warning
  off, outage and online notifications off; the tooltip names the value and
  the global value. Also on the phone cards.
- Chip "Own setting" (shown when there is one): only devices with their own
  setting.
- Settings, sections "Battery" and "Push notification": the devices with
  their own value (also hidden ones), each with area and integration; reset
  one by one (×, undo possible) or "Reset all". Like all settings it applies
  with "Save", "Cancel" discards it.

## [0.9.1] - 2026-10-02

Not released; included in 0.11.0.

### Changed

- Device pop-up and settings speak of the global value instead of "as
  configured": "Global value (15 %)", "Global setting", "Global value:
  15 %" in the short line, "Empty = global value" for the threshold per
  integration (also in the options dialog).

### Fixed

- On the phone (iOS) a selection in the device pop-up or in the settings
  opened again right after choosing, and again after each refresh. After a
  change the selection now stays closed.

## [0.9.0] - 2026-10-02

Push notifications for outages and when devices are back online, the time of
the battery push, and notification settings per device. All new
notifications are off by default, so the update does not start sending
anything by itself.

### Added

- Settings section "Push notification", also in the options dialog:
  "Report outages" sends a push as soon as a device counts as offline
  (after "Offline after"), with area, integration and the time it went
  offline. "Report back online" sends the all clear with the duration of the
  outage; on the phone it replaces the outage notification. A running
  outage is not reported again after a restart of Home Assistant, and the
  all clear still arrives.
- "Combine group outages" (on by default): 3 or more devices offline in the
  same check give one notification, with the probable cause if they all
  belong to the same integration.
- Section "Battery": "Time of the push notification", immediately or once a
  day at a chosen time (default 08:00). The daily notification lists the
  newly affected devices or all devices with a low battery (a reminder
  every day until the battery is replaced). Switching to "immediately"
  sends the devices still waiting for the daily notification.
- Device pop-up "Notifications for this device", saved immediately: battery
  warning as configured, with an own threshold or off (off also removes
  the marking in the list); outage and online notifications off for this
  device, which is still monitored.

### Changed

- The open section in the settings stands out: darker header, bold title,
  tinted content.
- The summary of "Push notification" reads "notifies on outage, back
  online, low battery"; before, "low battery" alone looked like a status.
- A percentage outside 5–50 in the device pop-up stays in the field with the
  allowed range below it, instead of being reset.

## [0.8.0] - 2026-10-01

Own battery threshold per integration.

### Added

- Settings section "Battery": "Own threshold per integration" lists only
  integrations with battery devices, with the number of devices and the
  weakest battery; an empty field uses the general threshold "Low from". It
  applies to the marking in the list, push and persistent notification; the
  device's primary integration counts. An integration with its own
  threshold stays listed without devices, so it can be reset. Also in the
  options dialog as a mapping (e.g. `zha: 25`).

### Fixed

- Texts with quotation marks in the settings were cut off after typing
  (e.g. the short line under "Low from"); a value with quotation marks
  could break an attribute in the panel.

## [0.7.0] - 2026-10-01

Not released; included in 0.8.0.

Battery warning with a threshold of your choice, as a push notification, a
persistent notification in Home Assistant, both or neither. Both
notifications are off by default, so the update does not start sending
anything by itself.

### Added

- Settings section "Battery", also in the options dialog: "Low from"
  (5–50 %, default 15 %) instead of the fixed 15 %; it applies to the
  marking in the list, the hint "Low battery" and "Problems only".
- "Push notification" (battery): once per device when it drops below the
  threshold, again only after the battery was 5 points above it in between
  (e.g. new battery); a device that is briefly unreachable is not reported
  again. More than 3 devices at once: one summary. Switching it on reports
  the devices affected right now once. Survives restarts without repeating.
- "Persistent notification" (battery): one notification in Home Assistant
  listing all devices with a low battery, each linked to the panel; it
  disappears by itself once all are above the threshold. Dismissed, it
  stays away until another device is affected or Home Assistant restarts.
- Settings section "Push notification" (like UniFi Dynamic Clients):
  "Target" (notify service, group or notify entity) and "Tapping the
  notification opens" (device in the panel or Home Assistant device page).
  A hint appears if push is switched on without a target. Targets that
  reject image and tap target get the plain message.
- Link to a device: `/device-panel?device=<id>` opens its pop-up, also when
  the panel is already open.

## [0.6.0] - 2026-10-01

Not released; included in 0.8.0.

Set when a device counts as offline or unstable, and choose whether service
devices and disabled devices appear in the list.

### Added

- Settings section "Outage detection", also in the options dialog of the
  integration: "Offline after" (1–60 minutes, default 2), "Unstable from"
  (2–50 outages in 24 hours, default 3) and "Grace period after start"
  (0–30 minutes, default 5, 0 turns it off). A value outside the range is
  marked in red and cannot be saved.
- Settings section "Display", also in the options dialog: "Show service
  devices" (e.g. sun, weather forecast, add-ons; shown devices are also
  monitored) and "Show disabled devices" (own group "Disabled" at the end
  of the list, not monitored, not counted at the top or under "Problems
  only"). Both are off by default, as before.

### Changed

- The options dialog lists the settings in the same order as the panel.

## [0.5.0] - 2026-10-01

Choose what the panel shows: hide whole integrations or device types, and
correct the type of a single device.

### Added

- Settings sections "Integrations" and "Device types": every integration and
  every type with its number of devices and a "Show" switch, plus "Toggle
  all". Hidden devices are not shown in the panel and not monitored (no
  outages, no history). Also available in the options dialog of the
  integration ("Hide integrations", "Hide device types").
- New device types "Phone / computer" (Companion app), "Network" (router,
  access point, switch, NAS of integrations such as UniFi, FRITZ!Box or
  Synology), "Valve" and "Energy / meter" (devices that mainly measure
  power, energy, gas or water).
- Change the type of a device in its pop-up: "Automatic: …" keeps the
  detected type, any other choice is kept as "set by hand" and also applies
  to the exclusions.

### Changed

- Valves are no longer listed as "Cover / blind" but as their own type
  "Valve".
- The outage pulse and the group outages only count devices the panel
  shows.
- A device that is no longer monitored (hidden, disabled, removed) gets "no
  data" from that moment on instead of continuing as online.

## [0.4.0] - 2026-10-01

First stable release, building on the pre-releases 0.1.0b1 to 0.3.0b1 below. Updates
directly from the panel: no detour via HACS for every new release. HACS now
offers Device Panel without its "Pre-release" switch and no longer reports
every commit as an update.

### Added

- Settings in the panel (gear icon next to the search), the same options as
  the options dialog of the integration; everything applies with "Save",
  "Cancel" discards.
- Version box at the top of the settings: installed version, newest version
  (GitHub and HACS), "Check for updates", "Update" via the HACS update
  entity, progress while HACS downloads, a hint and a button to restart
  Home Assistant afterwards, and a link to the release notes. If HACS does
  not know a new version yet, the panel makes HACS reload it.
- "Show pre-releases" for the whole instance (beta versions in purple). If
  HACS would not install a pre-release because its "Pre-release" switch is
  off, "Enable in HACS" enables and switches it on; switching pre-releases
  off in the panel switches it off again.
- Option "Check for updates daily" (on by default): a new stable version is
  reported under Settings → Repairs. Also available in the options dialog
  of the integration.

### Changed

- As long as the installed version is a pre-release, newer pre-releases are
  offered by default (until "Show pre-releases" is saved once).

## [0.3.0b1] - 2026-10-01

Each device gets its own pop-up with statistics, and the list shows where a
device comes from and what it is.

### Added

- Availability log: Device Panel records for every monitored device when it
  goes offline and comes back (stored for 31 days in its own file, not in
  the recorder). Short dropouts below the 2-minute threshold are not
  recorded; the start of an outage is the real moment the device stopped
  responding. Time when Home Assistant was not running counts as "no data",
  never as an outage, and the first 5 minutes after a start are a grace
  period.
- List columns "Type" (e.g. light, outlet, motion, door/window, climate,
  hub/bridge), "Integration" with the config entry the device belongs to,
  and "Availability 24 h" with a strip of the last 24 hours. This prepares
  excluding whole integrations or device types later.
- Group "Unstable": online devices with 3 or more outages in 24 hours.
- Outage pulse: devices with an outage over the last 24 hours, with a hint
  when several devices dropped out at once (group outage), naming the
  shared integration.
- Device pop-up (like UniFi Dynamic Clients): status, availability 24 h,
  outages in 7 days, signal and battery as tiles; connection, integration
  (with a warning if its config entry is not loaded), device details and
  all entities with their state. Entities that decide whether the device is
  alive are marked. A tap on an entity opens the Home Assistant entity
  dialog; a button opens the Home Assistant device page.
- Statistics window (opens from the tiles): availability for 24 hours, 7
  days or 30 days with a timeline (online, offline, no data), the outages
  with time and duration, and outages per day.

### Changed

- Low battery, weak signal and updates are now filter chips next to
  "problems only" (instead of a tile at the top); "problems only" also
  includes unstable devices.
- The availability figure at the top is the average of the last 24 hours as
  soon as the log has data.
- Wide tables scroll sideways; the device column stays in place.

## [0.2.0b1] - 2026-10-01

First pre-release of the new device list (design C).

### Added

- Overview at the top: share of devices online, devices offline right now
  with duration (longest first), low battery, weak signal and available
  updates as filters.
- Connection type per device: Zigbee, Z-Wave, Thread, Matter (Thread, Wi-Fi
  or LAN from the Matter diagnostics), Bluetooth, Wi-Fi, network, cloud;
  signal strength in dBm or LQI (also from ZHA and Bluetooth); hub, bridge or
  Bluetooth proxy.
- Battery level, update hint and integration names per device.
- Filter chips by connection type and "problems only"; groups offline, no
  data, online; cards on the phone.

### Changed

- A device only counts as offline after 2 minutes without a sign of life; a
  connectivity sensor takes precedence, diagnostic entities only count if
  there is nothing else. Outages that began right after a restart are shown
  as "at least" (≥).
- Numbers and times follow the Home Assistant language of the user.

## [0.1.0b2] - 2026-10-01

Second pre-release. Use it instead of 0.1.0b1: that release was published
from an earlier commit and contains neither the icon nor the changes below
(its manifest still says 0.1.0).

### Added

- Icon and logo in `brand/` (Home Assistant 2026.3 and later loads them
  locally).
- The icon is served at `/device_panel/icon.png` without login, ready for
  push notifications in the Companion app (as in UniFi Dynamic Clients).
- Panel tests in German and English, on desktop and phone.

### Changed

- English panel texts say "offline" instead of "down".

## [0.1.0b1] - 2026-10-01

First pre-release.

### Added

- First skeleton: config flow (single instance), sidebar panel listing all
  devices with status, area, integration, manufacturer/model and software
  version; devices that are offline are listed first; search and status filter.
- Tests against a real Home Assistant and Playwright suites for the panel,
  GitHub Actions for HACS/hassfest validation and tests.

[1.26.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.26.0
[1.25.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.25.0
[1.23.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.23.0
[1.22.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.22.0
[1.21.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.21.0
[1.20.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.20.0
[1.19.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.19.0
[1.18.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.18.0
[1.17.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.17.0
[1.16.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.16.0
[1.15.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.15.0
[1.14.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.14.0
[1.13.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.13.0
[1.12.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.12.2
[1.12.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.12.1
[1.12.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.12.0
[1.11.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.11.0
[1.10.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.10.0
[1.8.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.8.0
[1.7.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.7.0
[1.5.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.5.0
[1.4.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.4.0
[1.3.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.3.0
[1.0.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.0.0
[0.34.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.34.0
[0.33.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.33.1
[0.33.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.33.0
[0.29.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.29.0
[0.28.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.28.0
[0.27.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.27.1
[0.27.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.27.0
[0.26.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.26.0
[0.25.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.25.0
[0.23.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.23.0
[0.22.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.22.0
[0.18.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.18.0
[0.16.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.16.0
[0.15.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.15.0
[0.11.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.11.0
[0.9.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.9.0
[0.8.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.8.0
[0.5.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.5.0
[0.4.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.4.0
[0.3.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.3.0b1
[0.2.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.2.0b1
[0.1.0b2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b2
[0.1.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b1
