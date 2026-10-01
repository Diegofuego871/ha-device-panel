# Changelog

[Deutsch](CHANGELOG.de.md)

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[0.3.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.3.0b1
[0.2.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.2.0b1
[0.1.0b2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b2
[0.1.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b1
