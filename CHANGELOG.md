# Changelog

[Deutsch](CHANGELOG.de.md)

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
