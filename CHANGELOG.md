# Changelog

[Deutsch](CHANGELOG.de.md)

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[0.1.0b2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b2
[0.1.0b1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v0.1.0b1
