# Changelog

[Deutsch](CHANGELOG.de.md)

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.137.0] - 2026-10-24

The setup wizard also asks about update notifications.

### Changed

- **Setup wizard, row "Fully charged":** off by default, and the wizard no longer switches it on for all integrations with battery devices. The notification applies only to integrations you switch on one by one (best practice); with the row on and no integration chosen, a note says where (Settings › Battery › Charging).
- **Setup wizard, step "Notifications":** the values under each row have no outline any more; the number sits large (18 px) in a quiet field on the right with its unit, and the button "Send test message" is as wide as the target field.

### Added

- **Setup wizard, step "Notifications":** a fifth row "Updates" (new updates for Home Assistant, apps and HACS) with a switch; with the mode "once a day" the time of the notification can be set right there (default 09:00). Other modes (immediately, weekly) are set in the settings and stay as they are. Like the other rows it needs a push target, and an invalid time blocks "Next".

## [2.136.1] - 2026-10-24

The buttons of the setup wizard have icons, like in the routine wizard, and the empty space on top is gone on a phone.

### Fixed

- **Setup wizard, "Back" and "Next":** both buttons have the same width now ("Next" was wider).
- **Setup wizard, welcome page:** the three secondary buttons ("Not now", "Don't show again", "Discard draft") look alike now and have icons; "Let's go" has an arrow.
- **Setup wizard on a phone:** a large empty space above the step line is gone. The wizard added the safe area of the phone on top, although the panel already sits below the header of Home Assistant; the cross is now as close to the top as in the other full-screen windows.

### Changed

- **Setup wizard, buttons:** "Back" has an arrow to the left, "Next" and "Let's go" an arrow to the right, "Finish" a check mark.

## [2.136.0] - 2026-10-24

The setup wizard remembers where you stopped. Includes the changes from 2.135.1.

### Added

- **Setup wizard, intermediate state:** at every step change and when the window is closed (cross, Escape, "Not now"), the step and your choices are stored (option `wizard_draft`, for all administrators). The next start (tile, settings, or the automatic opening) continues at that step with your choices; nothing is applied until "Finish". Closing no longer asks "Cancel setup?". On the welcome page (reached with "Back") the button "Discard draft" returns to the current state of the settings. "Finish" and "Don't show again" delete the intermediate state. The state is not part of the backup file; the draft is checked against the current devices, integrations and targets when it is read.
- WebSocket `set_options` accepts `wizard_draft` (`{"step", "d"}` or `null`, at most 200,000 characters); `get_options` returns it.

### Changed

- **Launcher, tile "Setup":** while the wizard is open, the tile carries an orange pill "Open" (like "Debug" on the log), matching the orange dot on the launcher button.
- **Setup wizard, close button:** the cross is the standard one (thin circle) and sits at the very top right, like in the other windows; the progress bar is below it.
- **Setup wizard, step "Notifications":** only "Notify after" is offered for failed devices; "Failed after" is no longer shown, to keep the step simple (it stays at its current value and can be changed in the settings). "Notify after" still must not be shorter than it; the note names the current value.

### Fixed

- **Setup wizard, logos of the integrations:** the logos (Philips Hue, Shelly and others) sat on a blue tile like the letter badges. They now sit on the neutral background, like in the settings.
- **Setup wizard, welcome page:** the button "Let's go" was squeezed flat by the layout and looked much smaller than "Not now" and "Don't show again". All three buttons are now 44 px high; "Let's go" stays the filled, most inviting one across the full width.

## [2.135.1] - 2026-10-24

The button "Let's go" of the setup wizard has the same size as the other buttons, the logos have no blue background, the step "Notifications" is simpler, and the launcher tile shows an orange pill.

### Changed

- **Setup wizard, close button:** the cross is the standard one (thin circle) and sits at the very top right, like in the other windows; the progress bar is below it.
- **Launcher, tile "Setup":** while the wizard is open, the tile carries an orange pill "Open" (like "Debug" on the log), matching the orange dot on the launcher button.
- **Setup wizard, step "Notifications":** only "Notify after" is offered for failed devices; "Failed after" is no longer shown, to keep the step simple (it stays at its current value and can be changed in the settings). "Notify after" still must not be shorter than it; the note names the current value.

### Fixed

- **Setup wizard, logos of the integrations:** the logos (Philips Hue, Shelly and others) sat on a blue tile like the letter badges. They now sit on the neutral background, like in the settings.
- **Setup wizard, welcome page:** the button "Let's go" was squeezed flat by the layout and looked much smaller than "Not now" and "Don't show again". All three buttons are now 44 px high; "Let's go" stays the filled, most inviting one across the full width.

Not released; included in 2.136.0.

## [2.135.0] - 2026-10-24

A setup wizard leads through the basic settings after the installation.

### Added

- **Setup wizard:** after a fresh installation a window opens once in the middle (full screen on a phone). Steps: Welcome, Integrations, Device types, Devices (grouped by integration, expandable, one switch per group or device), Notifications, Quiet hours (only with a push target) and a summary. Nothing is saved until "Finish" (one `set_options`); closing with changes asks first.
- **Step "Notifications":** push target, one switch per kind (failed devices with return, low battery, new devices, fully charged) and, per row, the current values filled in with the defaults and editable ("Failed after", "Notify after", "Battery low below", "Collect new devices", "Full from"), with a check of the ranges and of "Notify after" not shorter than "Failed after". A button sends a test message.
- **"Not now" and "Don't show again":** "Not now" closes the window; "Don't show again" ends the wizard for good.
- **Launcher:** until the wizard has been finished once, a tile "Setup" sits at the top of the group "Device Panel" and an orange dot on the launcher button. Not configurable; gone after "Finish" or "Don't show again".
- **Settings › Panel › General:** new chapter "Setup wizard" with the button "Start wizard" and the date of the last completion. The fields show the current state, nothing is reset. If the wizard is not finished, the tile and the dot come back.
- New option `wizard_state` (`new`, `later`, `open`, `done`, `off`) and `wizard_done_at`: they apply to the whole installation, only administrators change them, they are not part of the backup file. A fresh installation starts with `new`; existing installations count as `done` (no window, no tile).
- WebSocket `wizard_data` (all candidate devices with integration, type and area, without exclusions) and `wizard_test` (test message to a `notify.*` target); `list_devices` returns `wizard`.

## [2.134.1] - 2026-10-24

The filter chip also shows when the device has only one routine or message.

### Fixed

- **History of a card on a device with only one routine or message:** the chips of 2.134.0 stayed away because they appeared only from two entries on, so the filter was invisible again. When the history is opened from a card, the chips ("All routines" and the chosen routine, or "All messages" and the chosen message) now show even with a single entry, and "All ..." removes the filter.

## [2.134.0] - 2026-10-24

The history of a single routine or message now shows its filter as a chip. Includes the changes from 2.133.0.

### Changed

- **History of a routine or message, on a device:** a tap on "History" on a card opens the history of the **device** with that routine or message already chosen as a chip. The chips "All routines" and one per routine (or "All messages" and one per message) are always there; a tap on "All ..." removes the filter, a tap on another one switches. The subtitle names the device and the number. Before, the filter showed only as the name in the subtitle and could not be changed without closing the window. A device with only one routine or message has no chips.
- **History over all devices** (tabs "Magic Push" and "Routines"): a chip "Message" or "Routine" opens a list under it with "All messages/routines" and every entry with its device; the chosen one shows on the chip. One entry at a time (no multiple choice).
- WebSocket `protocol_get`: new `item_ids` (a choice inside `device_id` or over all devices); `items` always lists every entry of that scope and now carries `device_id`. `item_id` still works.

## [2.133.0] - 2026-10-24

Renaming a device opens its own window on a phone.

### Changed

- **Rename device on a phone:** the pencil next to the name now opens a small window at the top with a large field (the keyboard no longer covers it), the original name with "Reset", and the buttons "Cancel" and "Save name". Enter saves, Escape or the cross cancels. Before, the field sat in the header of the pop-up between the round buttons and was too small. On a desktop nothing changes: the field stays in the header.

Not released; included in 2.134.0.

## [2.132.0] - 2026-10-24

The settings now say why devices of a shown integration are missing. Includes the changes from 2.130.0 and 2.131.0.

### Added

- **Reason for missing devices** (Settings › Devices in the panel › Integrations): the line under an integration says how many of its devices are not visible and why, for example "3 devices · 3 not visible, type hidden: Media" or "1 hidden one by one". Before, it only said "3 devices" and the list showed none of them, because the setting "Show" of the integration is separate from the hidden types and the hidden single devices. An integration that is hidden itself shows no reason (its switch says it).
- The WebSocket command `get_options` returns `hidden_by_type` and `hidden_by_device` for every integration of the catalog.

## [2.131.0] - 2026-10-24

The text link "History of the device" is gone from the tabs "Routines" and "Magic Push" of a device. Includes the changes from 2.130.0.

### Removed

- **Text link "History of the device ›"** above the cards in the tabs "Routines" and "Magic Push" of the device pop-up, and in the foot of every device in the overviews of Magic Push and routines (there "Open device ›" stays). The round history button in the header does the same and is always there. The buttons "History" on the single cards stay.

### Changed

- **Symbol "reset" mirrored** (from 2.130.0): the arrows run clockwise, a running app spins the same way.

Not released; included in 2.132.0.

## [2.130.0] - 2026-10-24

The "reload" arrow runs clockwise everywhere and spins the same way.

### Changed

- **Symbol "reset" mirrored** (round arrow with a point at the top): the arrows now run **clockwise**, like the refresh symbol of the update check. It is used for the app "Backup" in the launcher and in its header button, for "Restore default" and "Reset" buttons (view, chip order, per-integration settings, AI prompt, backup undo) and for "Restart".
- **App that is running** (launcher): the arrows spin clockwise, in the direction they point. Before, the symbol pointed counter-clockwise and spun the other way round.
- README screenshots are not taken again; they show the old direction until the next time.

Not released; included in 2.131.0.

## [2.129.0] - 2026-10-24

The Status app offers the same six periods as the device histories, the tab "System" of the history starts with "All", and Magic Push rows show an arrow.

### Changed

- **Status app, tab "System":** every curve (CPU, memory, disk) now has the six periods of the battery history: **24 hours, 7 days, 30 days, 3 months, 6 months, 12 months** (before four: 24 hours, 30 days, 6 months, 1 year). On a phone the six buttons use two rows. Up to 7 days the curve comes from the history of the recorder, from 30 days on from the long-term statistics; the note about missing statistics shows only from 30 days on.
- WebSocket `status_system`: `range` and `ranges` now take `24h`, `7d`, `30d`, `90d`, `180d` or `365d` (the same keys as the battery history); the old keys `6m` and `1y` are gone. The panel sends the new ones, so nothing has to be migrated.
- **History, tab "System":** the period starts on **"All"** (before 30 days), so the entries of the whole retention are there at once. The other tabs keep 30 days; going back from "System" restores the period you had.
- **History, tab "Magic Push":** a row with a message text shows an arrow next to the value (turns up when open), like the rows in the tab "All". Rows without text have no arrow. The arrow in the table of routines was already there.
- **README:** the Status app describes the six periods.

## [2.128.0] - 2026-10-24

Every curve of the Status app has its own period buttons. Includes the changes from 2.126.0 and 2.127.0.

### Changed

- **Status app, tab "System":** CPU and memory now have the same buttons for the period as the disk (24 hours, 30 days, 6 months, 1 year). Each curve keeps its own period, the others stay as they are. Before, only the disk could be switched and CPU and memory were fixed at 24 hours. Older periods come from the long-term statistics of Home Assistant; without them the curve shows only what the recorder still has, with the usual note.
- WebSocket `status_system` takes an optional `ranges` (`cpu`, `ram`, `disk`, each `24h`, `30d`, `6m` or `1y`) and returns it per curve; `range` still sets the disk and stays valid without `ranges`.

## [2.127.0] - 2026-10-24

Entries of the history that can be tapped now show it with an arrow. Includes the changes from 2.126.0.

### Changed

- **Arrow at the end of tappable rows** in the history (tabs "All" and "System"): a down arrow (turns up when open) for a Magic Push message and for a sent notification, a right arrow for a routine run (opens its trace) and for an entry that opens its device. Plain entries have no arrow. Before, you had to know that these rows could be tapped.
- **Chart in the tab "All"** (from 2.126.0): bars per day (per week for periods over 120 days), faults in red; it follows the chips and the search, a tap on a bar sets the period to that day.

Not released; included in 2.128.0.

## [2.126.0] - 2026-10-24

The bar chart of Magic Push and routines is now also in the list "All" of the history.

### Added

- **Chart in the tab "All":** bars per day (per week for periods over 120 days), faults (outage, warning, error, failed push or run) in red. It follows the chips and the search, like the list below, and a tap on a bar sets the period to that day. Over all devices it counts all of them.

### Changed

- WebSocket `protocol_get` with kind `all` returns `step` and `buckets` like the other kinds.
- **README:** the section "History of a device" mentions the chart; the screenshots of the history were taken again.

Not released; included in 2.127.0.

## [2.125.0] - 2026-10-24

One history instead of two windows: the window "Log" is now the tab "System" of the history, and the app "Log" is called "History".

### Added

- **Tab "System" in the history** (only over all devices, not on a device): the entries of the panel log without a device (start, errors, AI, push targets, status app, launcher) and **all debug entries**, with chips for **level** (error, warning, info, debug) and **kind**, search, period (7 days to 12 months), copy as text, clear (with a question first) and the entry opens its device. It asks again every 4 seconds, but not in the middle of a swipe.
- **Debug mode in the tab "System":** the switch sits there, with the time it switches itself off (48 hours, also across restarts, as before). It applies to the whole panel.
- **New entry:** Settings › Panel › Storage has a button "Open history (System)" in the chapter "Logs".
- New WebSocket kind `system` for `device_panel/protocol_get` (administrators) with `filter` for the level and `cat` for the kind.

### Changed

- **The app "Log" in the launcher is called "History"** (German "Protokoll"), subtitle "with debug mode" stays. It opens the history over all devices on the tab "All". The internal id stays, so pinned apps and their order are kept. The symbol is the same as in the device pop-up and in the overviews.
- The history window has four tabs: All, Magic Push, Routines, System. On a device and from a single message or routine there is no tab "System".
- **README:** "App launcher and history" describes the one window and its entries.

### Removed

- The separate window "Log" (`dialog.log-dlg`, `get_log` in the panel). Debug mode, entries and limits are unchanged; nothing has to be migrated.

## [2.124.0] - 2026-10-24

Sent notifications get their own storage with their own retention, and the summary after quiet time shows up for every device it names. Includes the changes from 2.123.0.

### Added

- **Own storage for sent notifications** (Settings › Panel › Storage, new chapter "Sent notifications"): **retention in days** (7 to 365, default 1 year) and a **limit in MB** (1 to 200, default 10 MB), with the used size. Before, the notifications lived in the panel log, which keeps a limited number of entries for everything together; frequent entries pushed the notifications out. Now they stay as long as you set. A lower limit cuts at once when you save, after the usual question. The total bar counts them with the logs.
- The notifications of version 2.123.0 still in the panel log are taken over once into the new storage.

### Changed

- **Summary after quiet time:** the notification that delivers the held messages is now logged for every device of the held messages (before it belonged to no device). In the mode "one by one" the delivered messages keep their device and kind, so they are linked to their entry in the history again.
- The panel log keeps only a line per notification ("sent: title"); title, text and target are in the history of the device.
- The WebSocket command `storage_usage` returns `push` (bytes, entries, devices, days); new options `push_keep_days` and `push_max_mb`. The file `device_panel.push_log` is removed with the integration.
- **README:** the chapter "Sent notifications" is described under "Storage".

## [2.123.0] - 2026-10-24

In the history of a device a tap on an entry shows the push that was sent: to whom and what it said.

### Added

- **Sent notifications in the history of a device:** every push to a notify target is now logged with its **title, text, target and result** (sent, held in quiet time, failed, target missing). The history shows it as its own row (chip "Push") and under the entry that caused it: a tap on "back online after 9 min.: sending the notification" (also outage, battery, charging, new device) opens the push as it went out. Group notifications appear for each device they name. The search also finds the text of the notification.
- Notifications held in quiet time are logged when they are held, with the devices.

### Changed

- Entries of the panel log now carry the code of their text and, for notifications, the content (`push`) and the devices (`device_ids`); both survive a restart of Home Assistant. Text of a notification is cut at 600 characters.
- **README:** the section "History of a device" mentions the tap on an entry.

### Fixed

- **Integration failed to set up (introduced in 2.122.0):** with a device whose identifier has more than two parts (for example a Shelly device) the setup stopped with "too many values to unpack (expected 2, got 3)", so the panel did not start. The service device of the integration is now recognised by the first part of the identifier only; the identifiers in the detail of a device are read the same way.

Not released; included in 2.124.0.

## [2.122.0] - 2026-10-24

Own entities: counts and states of the panel for automations and dashboards, with an error counter.

### Added

- **Service device "Device Panel" with entities** (calculated every 30 seconds from the list of the panel, written to the history only on change):
  - **11 sensors:** devices active, hidden, offline, with warning, with battery, with low battery, charging, with weak reception, new and with an update, plus **"Errors (24 hours)"**. Each count carries the names of the devices as attribute `names` (at most 20, `more` counts the rest).
  - **2 binary sensors:** **Outage** (at least one device is offline) and **Problem** (an error in the log or a part of the integration is not running).
  - **Error counter:** counts the entries of level "error" in the panel log of the last 24 hours, with the last error as attributes. The new button **"Acknowledge errors"** sets it to zero; the log stays untouched.
- Warnings are counted like in the panel (unstable, low battery, weak reception or no data); disabled and unmonitored devices do not count.
- README (DE/EN): new section "Entities for automations".

### Changed

- The own service device is not listed in the device list of the panel (the sensors would count themselves).
- **History window (Magic Push, routines):** the chart now follows the filter chips and the search, like the list below (before it always showed all entries of the period; the key figures above stay for the whole period).
- The data file of the error counter (`device_panel.summary`) is removed together with the other files when the integration is removed.
- `test_audit_fixes`: two routines due in the same second no longer expect a fixed order (they share one point in time).

## [2.121.0] - 2026-10-24

The history symbol sits in the header of the device pop-up, a close button in every history window, and the charts use the whole screen on a phone.

### Changed

- **Charts of a device on a phone** (battery, availability, reception): the window now sits at the very top of the screen instead of a sheet with a gap above it, so the chart gets more room. On desktop nothing changes.
- **History window:** an "X" at the top right in every view of the history (a device, Magic Push, routines); "Back" at the bottom left stays, both close the window.
- **Device pop-up:** the button "History" moved from the quick row to the top right, to the left of the heart, with the same icon as in the overviews of Magic Push and routines. The quick row keeps only the two links that leave the panel ("Open device in HA", "Open integration in HA"); everything at the top opens a window inside the panel. On a phone the name in the header is one step smaller (21 instead of 24 px), so the three round buttons leave it more room.
- **README:** the screenshots of the device pop-up were taken again (symbol in the header).

Not released; included in 2.122.0.

## [2.120.0] - 2026-10-24

Reception in the history of a device: an entry when a device turns weak and when it is fine again.

### Added

- **Reception as an event:** the panel writes an entry to the log (category "Reception", with the device) when a device turns **weak** and when its reception is **fine again**, with the value and the threshold ("reception weak: -86 dBm", threshold -80 dBm). The check runs every 5 minutes with the same calculation as the list (median of the last 5 minutes, threshold of the device, integration or connection type); a change counts only after **two checks in a row**, so a value on the threshold does not write an entry every minute. The first state of a device is no event; an offline device keeps its state.
- The entries appear in the history of the device (tab "All", chip "Reception") and in the log of the panel (filter "Reception").

### Changed

- The note under the list in the history window no longer says that reception is missing.
- **README:** all screenshots were taken again with the current version (periods up to 12 months, new button "History", new tab "Storage"). New pictures: the history of a device (list by day and the evaluation of Magic Push) the tab "Storage" in the settings and the dialog "View" on the phone; a new section "History of a device" describes them.

## [2.119.0] - 2026-10-24

Availability and reception up to 12 months back, with the same periods as the battery.

### Added

- **Periods 3, 6 and 12 months** in the windows **Availability** and **Reception** (like the battery: 24 hours, 7 days, 30 days, 3, 6 and 12 months). Availability shows the timeline, every outage and the bars per day over the whole period; reception shows daily values (median, worst and best value per day).
- **Reception as daily values:** hourly values stay for 31 days; older ones are condensed to one value per day (median, worst, best) and kept up to the retention you set. That keeps the storage small: one year of a device takes about 15 KB.

### Changed

- **Retention up to 365 days, default 1 year** (Settings › Panel › Storage, chapter "Device histories"): before 7 to 31 days, default 31. The limit in MB is now 20 MB for availability and 50 MB for reception (before 10 and 20). Values you set yourself stay as they are.
- The note on retention no longer says "30 days at most".
- The histories grow beyond the 31 days kept so far from this update on. Values that were already deleted cannot be restored (the recorder of Home Assistant keeps only ten days by default).

### Fixed

- **Phone, header of the settings and of the overviews:** the round action button (and the new button "History") sat a few pixels higher than the close button. Both are now on the same line.

## [2.118.0] - 2026-10-24

The history window became the history of a device: everything about a device in one list, also from the overviews of Magic Push and routines.

### Added

- **Tab "All" in the history window:** one list by day (Today, Yesterday, date) with **everything about a device**: outages and returns with the duration (from the availability), battery, charging, updates, new devices, push, Magic Push messages and routine runs. Chips filter by kind and only show kinds that have entries in the period, with their number. Search over all texts. A tap on a Magic Push row opens the message as it was sent, a tap on a routine row its trace. Debug entries, the system and the apps are not in the list (they belong to no device). Reception does not appear yet (there is no event for it).
- **Button "History" in the quick row of the device pop-up** (administrators), after "Open device in HA" and "Open integration page".
- **Button "History" in the header of the overviews of Magic Push and routines** (left of the close button, separated by a line): it opens the history of all messages or all routines of all devices; the tab "All" then lists all devices, with the name of the device on each row.
- New WebSocket kind `all` for `device_panel/protocol_get`, also without device (all devices); `magic` and `routine` without message or device now return those of all devices.

### Changed

- The history window now always has three tabs: **All**, **Magic Push** and **Routines**. They keep their evaluation (key figures, chart, table, trace). Before, there were two tabs, and only when the window was opened for a device.

## [2.117.0] - 2026-10-24

New tab "Storage" in the settings of the panel: everything the integration stores itself, with its size and limits.

### Added

- **Tab "Storage" (Settings › Panel, third tab after "General" and "Updates"):** at the top the total as a number and a bar in five parts (histories, message logs, panel log, states, other) with a legend. Below, chapter "Device histories", chapter "Logs" and chapter "Other data". Every line with a limit shows how much is used (size, devices, days) and a bar for the share of the limit; the bar turns yellow from 90 %. In the summary of the section: "Storage: 7,2 MB used".
- **Device histories with limits:** availability and reception of all devices had a fixed retention of 31 days and no limit. Now each has a **retention in days** (7 to 31; the panel shows 30 days at most, so more would not be visible) and a **limit in MB** (defaults 31 days, 10 MB for availability and 20 MB for reception). When the limit in MB is reached, the oldest values of all devices are dropped (the state at the start of the period stays). A lower limit cuts at once when you save, after a question; the question names what is cut. The battery history has no storage of its own (recorder of Home Assistant); a note says so.
- **Other data:** states of the messages, charging, new devices, updates and quiet time, the AI assessments, and routines, Magic Push, devices and panel in three lines with their size (no limit, they hardly grow).
- New WebSocket command `device_panel/storage_usage` (administrators); it replaces `device_panel/protocol_usage` (which only knew the message logs and the panel log).

### Changed

- The chapter "Logs" (limits for message logs and panel log) moved from "General" to the new tab "Storage". Values and defaults are unchanged. "General" now has "Start page" and "Back up and restore".

## [2.116.1] - 2026-10-24

The README shows its images and links in HACS.

### Fixed

- **README in HACS:** when Device Panel was opened in HACS inside Home Assistant, **no image** showed (screenshots and graphics) and the link to the other language led nowhere. HACS renders the README on the address of Home Assistant and does not resolve relative paths such as `docs/screenshots/en/overview.png`. Images and links in `README.md` and `README.de.md` now use the full GitHub address. On GitHub itself nothing changes.

## [2.116.0] - 2026-10-21

More symbols and an action button in the header of the settings; the choice "Symbol / Favicon" only appears for an external link.

### Added

- **Action in the header of the settings:** an action app has a new check box **"Show in the settings"**. With it, the action appears as a round button in the **header of the settings, left of the close button and separated from it by a thin line**, so you can call it right there (for example a service that is useful while you change settings). The button shows the same progress as in the launcher (turning arrows, then green check or red cross; the reason of an error as tooltip), asks first if you switched that on, and the result goes to the log. **Only one action** can have the check mark (on a phone there is no room for more): if another one already has it, the check box says so ("already taken by …"), ticking it is refused with an error message naming that action, saving is refused too, and in stored data only the first keeps the mark. The settings of the view (columns, sorting) do not get these buttons.

- **More symbols:** the form of an own app offers **40 instead of 16 symbols**. New: update, download, upload, play, power, lock, cloud, Wi-Fi, bell, gear, history, reload, light bulb, thermometer, fan, shield, door, garage, water, fire, key, rocket, volume and robot vacuum. Existing apps keep their symbol.

### Fixed

- **Action app, progress display:** the turning arrows turned **against** the direction of their arrow heads. They now turn counter-clockwise, like the arrows point.

### Changed

- **README, installation:** Device Panel is now in the **default catalog of HACS**. The installation section leads with the search for "Device Panel" in HACS and the blue "Open your Home Assistant instance and open a repository inside HACS" button; the custom repository stays as a fallback.
- **Form of an own app:** the choice between "Symbol" and "Favicon" is shown **only for the type "External link"**. For "Page" (before: the Favicon tab was only greyed out) and for "Action" it is hidden completely; the symbols to choose from remain. A favicon only makes sense for an address outside Home Assistant.

### Internal

- `svc.settings` (`checkAction`), `settingsActionsHtml`/`paintSettingsActions` in `apps.js`, `data-ap-actions` in the settings header, `.dlg-act`/`.dlg-sep`; `APP_ICONS` in `apps.js` (40 entries), 12 new paths in the symbol table of `device-panel.js` (Material Design Icons), `data-f-srctabs` in the form, `.sub-tabs[hidden]`; suites `launcherfav` and `launcheract` adapted.

## [2.115.0] - 2026-10-21

Action apps show their progress and write the result to the log.

### Added

- **Progress display:** while an action app runs, its symbol turns into a **circle with turning arrows** (in the launcher as tile or row, and in the header if it is a favourite). When the service or command has finished, a **green check and a green border** show for three seconds; on an error a **red cross and a red border**. Then the usual symbol is back. While it runs, a second tap does nothing. With "reduce motion" set in the system the arrows turn slowly.
- **Entry in the panel log:** every run is recorded in the log (category "Apps"): "action done: `cover.open_cover`" as information, or "action failed: `cover.open_cover`: reason" as a warning, with the name of the app. The filter "Apps" of the log shows only these.

### Internal

- WebSocket `device_panel/log_launcher_action` (administrators; name, target as service or command, result, error up to 300 characters), texts `launcher_run_ok` and `launcher_run_failed` in `activity.py`; `AppLauncher._setRun`/`runState`, CSS `.run-running|ok|err`. Tests: `test_activity.py`, suite `launcheract` (states, log entries), simulator `__serviceDelay`.

## [2.114.0] - 2026-10-21

Action apps can also send a command of the interface (WebSocket), for example to make HACS look for a new version.

### Added

- **Action app, "Service or command":** the field of an action app takes, besides a Home Assistant service (`domain.service`), a **command of the interface** as the panel itself uses them (`area/command`, for example `hacs/repository/refresh`). The data are then the fields of the message (without `type` and `id`, which belong to the command), for example `{"repository": "123456789"}`. It runs with your rights, with the question first if you switched it on. Typical use: a button that makes HACS look for a new version of Device Panel right away; the number is the one in the address of the HACS page of Device Panel. The code of the integration knows nothing of HACS for this; everyone creates the action themselves if they want it.

### Changed

- The hint and the error texts of the form name both forms (service and command); the question before running says "service" or "command".

### Internal

- `checkAction` knows both forms (`isCommand`: a slash), the command runs through `callWS`; tests: suite `launcheract` (command, `type`/`id` in the data rejected).

## [2.113.0] - 2026-10-21

App launcher: a new type of own app, "Action", that calls a Home Assistant service.

### Added

- **Own app of type "Action":** besides "Page" (of Home Assistant) and "External link", the form for an own app has the tabs **Page | External link | Action**. An action app calls a **service of Home Assistant** when you tap it, as in a script: field **Service** (`domain.service`, for example `homeassistant.update_entity`), field **Data** (JSON object, for example `{"entity_id": "update.device_panel_update"}`) and the switch **"Ask before running"** (off by default; with it, a question comes first). The service runs with **your** rights. The result shows at the bottom of the launcher ("… done" or "… failed: reason"), from the header (launcher closed) as a toast of the page. Action apps carry a small bolt mark, show their service as subtitle in edit mode, can be marked as favourites like other apps and stand in the header.
- Typical use: a button that makes HACS look for a new version of Device Panel (`homeassistant.update_entity` on the HACS update entity), now that the panel itself no longer uses HACS internals.

### Changed

- The check box "External link" of the form became the tab bar above (same behaviour, one control for all three types).
- **Button "Check for updates" (settings):** it no longer calls the internal commands of HACS (`hacs/repositories/list`, `hacs/repository/refresh`) in the browser either (the same kind of access the HACS review objected to in the integration). It reloads the HACS update entity through the public service `homeassistant.update_entity`; whoever wants HACS to look right away creates an "Action" app (see above).

### Internal

- `checkAction` and `sanitizeApps` in `apps.js` (service only `domain.service`, data a plain object up to 2000 characters, invalid actions are dropped), `AppLauncher.run`/`_exec`, `_askConfirm` accepts arguments for its texts. Tests: new suite `launcheract`, suites `launcher` and `launcherfav` adapted.

## [2.112.1] - 2026-10-21

The automatic update no longer touches HACS internals (request of the HACS review).

### Changed

- **Automatic update:** before installing, the integration used to make HACS reload the repository through its internal objects (`hass.data["hacs"]`). That is private state of another integration and can break with any HACS release. It is removed. The integration now only uses public services of Home Assistant: `homeassistant.update_entity` on the HACS update entity, then `update.install`. Effect: HACS checks for new versions only every few hours, so a release that has just appeared can take a few hours longer to show up for the automatic update; the next daily check picks it up.

### Internal

- `_async_hacs_refresh` removed from `update_check.py`; test `test_auto_update_starts_as_soon_as_a_check_finds_a_version` checks that the HACS object is never touched.

Not released; included in 2.113.0.

## [2.112.0] - 2026-10-20

The reception window is tidier: key figures as tiles, one card "Receivers", all notes behind one info button.

### Changed

- **Reception window (mockup `signal-layout-v1`, variant A):** before, seven blocks of text and three charts stood on top of each other, with the key numbers buried in running text. Now:
  - **Tiles on top:** "Now" (with signal level, "avg 5 min" and the warning threshold; the threshold turns yellow when the device is weak) and below it "Median", "Worst" and "Best" of the period.
  - **Chart** as before, with the legend and an **ⓘ button**: it unfolds the notes once (source of the recording, "value and warning are the median of the last 5 minutes", gaps, "the earlier path cannot be reconstructed", explanation of the live values). Before, every section had its own note.
  - **One card "Receivers"** replaces "Currently heard by" and "Connected via": the path bar with times, then one row per receiver with its name, the mark **"✓ counts"** (its value is the signal), the current value and age of its latest report ("now -76 dBm · 8 s ago", renewed every 5 seconds), its share and average in the period, and the mark **"⚠ 21 dB weaker"** for a receiver that carried the signal for a longer time much weaker than the main receiver (details as tooltip; replaces the long text box). Receivers that are heard right now but were not on the path in the period are listed in grey at the end; receivers without a fresh report say "not heard right now".
  - **Recent changes** stay visible below the receivers.
- Nothing was dropped: all values, notes and hints are still there, only grouped.

### Internal

- `_signalHistHtml` (tiles, info panel), new `_receiversHtml` replaces `_liveHtml` and `_viaHtml`; strings `sigNow`, `sigAvg5`, `sigMedian`, `sigWorst`, `sigBest`, `sigInfo`, `sigReceivers`, `sigScope`, `sigPct`, `sigUsed`, `sigWeaker`, `sigAvgShort`, `sigRowNow`, `sigRecvIdle` (removed: `sigFacts`, `sigLive`). Tests: suites `signallive` (rewritten), `signalvia`, `sighist` adapted.

## [2.111.0] - 2026-10-20

"Weak reception" and the reception value are based on the median of the last minutes instead of the single report.

### Changed

- **Reception (Bluetooth, ZHA and sensors the recorder does not log):** a single report swings by 10 dB and more (fading, several receivers, a proxy that only listens now and then). Judged on the single value, a device at the threshold (default -80 dBm) flipped between "weak" and "not weak" all the time, and "Weak reception" warnings appeared and disappeared without anything having changed. The **value in the list, the "weak" decision, the filter chip, the sorting, the warning reason and the AI facts** now use the **median of the last 5 minutes** (measurements of the panel's own recording plus the current value; from three measurements on, before that the single value). A real change shows after a few minutes, a single outlier no longer does. The reception window says so under the chart ("The current value and the "weak" warning are based on the median of the last 5 minutes"); the live line shows the single values of the receivers as before. The recorded history stays unchanged (it records the single values).
- Not affected: Wi-Fi and other devices whose reception comes from a sensor of the recorder (their value is steady anyway).

### Internal

- `SignalLog.steady` (window `STEADY_WINDOW_S` 300 s, `STEADY_MIN` 3), `devices.signal_source(…, smooth=True)`; the recording reads the single value (`smooth=False`). The result of `signal_history` has `smoothed`. Tests: `tests/test_signal_history.py`, suite `signallive`.

## [2.110.0] - 2026-10-20

The app launcher always shows all apps.

### Changed

- **App launcher:** the group "Home Assistant" no longer ends after 6 (phone) or 8 (desktop) apps with a switch "All 12 ›" / "Fewer". All apps are always shown; with more apps the launcher **scrolls**. The button and its two texts are removed.

### Internal

- `_listHtml` in `apps.js` without limit, `ui.all`, handler `all`, `.ap-more` and the strings `appsAll`/`appsLess` removed. Tests: `launcher` (all 12 tiles, no button), `launchercol`.

Not released; included in 2.111.0.

## [2.109.0] - 2026-10-20

The reception window of a Bluetooth device shows live which receivers hear it right now.

### Added

- **Reception window, live line (Bluetooth):** under the chart a line reads for example "Currently heard by: **Shelly Garage -76 dBm (8 s ago)**, Storen Küche -97 dBm (3 s ago)": every receiver (adapter or proxy) that has heard the device, with its latest RSSI and how fresh that report is, strongest first. The receiver whose value counts as the signal is bold. The line updates every 5 seconds while the window is open (the age keeps running). It shows at a glance whether a weak value comes from the device or only from one receiver that happens to hear it badly. Hint on hover or long press explains the bold entry. Nothing is shown for devices without a Bluetooth address or when no receiver hears the device.

### Fixed

- **Bluetooth reception, placeholder value:** a receiver reporting 0 dBm (a placeholder, not a measurement) counted as the "strongest" value and could be chosen over a real measurement. Values of 0 dBm and above are now ignored like "no value" (-127).

### Internal

- `devices._ble_seen` (all receivers with age and RSSI), `_ble_pick` (the choice), new `ble_listeners`; WebSocket `device_panel/signal_listeners` (live line only, no history) and field `listeners` in `device_panel/signal_history`. Tests: `tests/test_ble_best.py`, `tests/test_signal_history.py`, new suite `signallive`.


## [2.108.0] - 2026-10-20

Bluetooth reception shows the strongest receiver instead of the one Home Assistant happens to keep.

### Changed

- **Bluetooth devices, reception:** all adapters and Bluetooth proxies listen at the same time, but Home Assistant keeps the receiver it chose first and only switches when another one is clearly stronger (or the old one goes stale). So a device often stood on a weaker proxy, and the value jumped when HA switched. The panel now reads the last advertisement of **every** receiver and shows the **strongest RSSI**, with the name of the receiver that delivered it; value and receiver always come from the same advertisement. The **signal history** and the "connected via" path use the same choice, so they never contradict the list.
- **Details:** only receivers that heard the device recently count (their last advertisement at most 60 seconds older than the freshest; a proxy that stopped hearing it does not keep an old good value). The previous receiver stays while it is at most 2 dB weaker than the strongest, so the name does not flip back and forth between two nearly equal proxies (and the history stays free of noise). Where HA gives no per-receiver view, it falls back to the value HA keeps, as before.
- Effect: reception of Bluetooth devices is usually better and steadier than before; "Weak reception" warnings for them appear less often. Single readings still vary by a few dB, that is the radio itself.

### Internal

- `devices._ble_best` (one place for value and receiver, used by `_ble_signal` and `ble_receiver`), `_ble_stamps` (HA rebuilds the timestamps on every access, so they are cached for 5 s per receiver). Tests: new `tests/test_ble_best.py`.

## [2.107.0] - 2026-10-20

"Apps" and "Dashboards" of Home Assistant as launcher apps, switched off by default.

### Added

- **App launcher:** two new pages of Home Assistant, **Apps** (Settings › Apps, `/config/apps/installed`) and **Dashboards** (`/config/lovelace/dashboards`), for administrators. They are **hidden by default**; you switch them on with the eye in edit mode (and can pin them as favourites like any other app). Existing settings get them as hidden once; whoever switches them on keeps that. "Reset" in edit mode hides them again.

### Internal

- Launcher data `v` 3 (`sanitizeApps`, `HIDDEN_BY_DEFAULT`); the one-time step of v 2 (pin the settings) now only runs for data older than v 2. Suite `launcher` extended.

## [2.106.1] - 2026-10-20

The log asks before it is cleared.

### Changed

- **Log, button "Clear":** a pop-up asks first "Clear the log?" (all entries are deleted, including the saved ones; this cannot be undone) with "Cancel" and "Delete all". Only "Delete all" clears.

### Internal

- Uses the common confirm pop-up (`_askConfirm`). Suite `log` extended.

## [2.106.0] - 2026-10-20

One log window for Magic Push and routines, with tabs.

### Added

- **Log window:** at the top two tabs, **"Magic Push"** (left) and **"Routines"**, in one window. It opens on the tab it was opened from. The other tab shows the log of **all messages or routines of the same device** (with the choice of a single one); going back restores the first context (the single message or routine you came from). The period stays; filter, search and choice start afresh per tab.

### Changed

- **Panel log renamed "Log" (German; it was "Protokoll")** to tell it apart from the per-message and per-routine history. In English the history of a message, routine or device is now **"History"** (button "History", "History of the device"), the panel log stays "Log". Settings: "Panel log" rows say "Panel log", the chapter "Histories and log".
- **Panel log, footer:** next to the number of entries the **size in MB** (for example "532 entries, 5 shown · 0.1 MB"). `device_panel/get_log` reports `bytes`.

### Internal

- Buttons "Log" on cards now carry the device (`data-device`) next to `data-id`, so the window knows the device of a single message or routine. `ProtocolUi.alt` holds the context of the other tab. Suite `protocol` extended.

## [2.105.1] - 2026-10-20

Log windows: "Back" at the bottom; settings chapters in a new order; more room in the device cards.

### Changed

- **Log windows (all views):** "Back" sits at the bottom left, in the footer, instead of the cross at the top right. In the trace, "Back" still goes to the table. On the phone the count of entries in the footer is hidden to make room.
- **Settings, Panel › General:** the chapter "Back up and restore" is the last one again; "Logs" comes before it.
- **Overviews, foot of a device card:** "Open device" and "Log of the device" have more room between them.

### Internal

- Suites `protocol`, `protocollimits` and `backup` adjusted.

## [2.105.0] - 2026-10-20

The size of the logs is set in the settings; the log window can go back as far as there are entries.

Includes the changes from 2.104.0 and 2.103.0.

### Added

- **Settings, Panel › General, new chapter "Logs"** (at the very bottom): how much the logs keep, as a **size in MB** and a **number of entries**, separately for **messages and routines** (default **30 MB**, **5000 entries per message or routine**) and for the **panel log** (default **10 MB**, **4000 entries**; before it was fixed at 500). The current use is shown next to each field. When a limit is reached, the **oldest entry** drops (for the MB of messages and routines the oldest over all of them). A **lower limit cuts at once**; if existing entries would be lost, the settings ask first ("Cut and save"), because it cannot be undone. The size is that of the stored JSON.
- **Log window:** a new period **"All"** (from the oldest entry, also beyond 12 months); the chart goes per week and shows at most the newest 399 weeks. "Custom" after "All" starts with the dates of the oldest entry and today.
- New command `device_panel/protocol_usage` (administrators only) for the use shown in the settings.

### Changed

- **No time limit any more:** the 12 months of 2.104.0 are gone; entries stay as long as the size and the number allow. The note below the log table names the limits in force.
- **Panel log (activity log):** its limit is no longer a fixed 500 entries but the two settings; `device_panel/get_log` reports the number as `max`.

### Internal

- `protocol.Protocol.enforce()` / `usage()` / `limits()`, `activity.enforce()` / `apply_limits()` / `usage()`; the options listener applies the limits after saving. Options `protocol_max_mb`, `protocol_max_entries`, `log_max_mb`, `log_max_entries` (ranges 1–200, 100–100000, 1–200, 100–20000). Tests: `test_protocol`, `test_activity`, `test_update_check` adjusted; new suite `protocollimits`.

## [2.104.0] - 2026-10-20

A log for every Magic Push message and every routine, with a chart and, for routines, a copyable trace.

Includes the changes from 2.103.0.

### Added

- **Magic Push, log:** the button **"Log"** on a card (in the overview and in the device pop-up) opens a window with every message sent: date, kind (triggered, repeated, back to normal, test), **title and text as sent**, value, recipient and what became of it (sent, held back by the quiet time, failed with the reason, no recipient). On top: the period (**7 days, 30 days, 6 months, 12 months** or your own dates), key figures, a **bar chart** (per day, per week for periods over 120 days; a tap on a bar picks that day, a part in red marks problems), a choice (triggered, back to normal, test, held back, failed), a search over title, text and value, and **"Copy as text"**. A row opens the message as it was sent.
- **Routines, log and trace:** the same window for a routine: date, trigger (time, trigger, by hand, switching back), action and result (executed, switched back, missed, paused, new attempt, failed with the reason), with key figures and the share of runs on time. A row opens the **trace**: every step in order (trigger and delay, time window, remembered state, call with the services, duration and state afterwards, planned switch back, message to the phone, result); failed steps in red. **"Copy trace"** puts it into the clipboard as text, "Newer" and "Older" move through the entries.
- **Log of the device:** "Log of the device" in the device pop-up (tabs Magic Push and Routines) and in the footer of each device card in the overviews lists all messages or routines of the device in one table, with a choice of a single message or routine.
- **Kept for:** 12 months, at most 4000 entries per message or routine (the oldest are dropped). Stored in a file of its own per message or routine (`.storage/device_panel.protocol_<id>`), written with a delay of 30 seconds and when Home Assistant stops. A typical message entry needs about 250 bytes, a routine run with its trace about 650 bytes; a message that fires a few times a month stays in the kilobytes, a routine that runs daily at about 0.5 MB after a year, the limit of 4000 entries at about 1 MB (messages) to 2.6 MB (routines with a trace). Deleting a message or routine deletes its log; removing the integration deletes all logs.

### Internal

- New `protocol.py` (storage, limits, query with key figures and buckets), `protocol_ws.py` (`device_panel/protocol_get`, administrators only), `panel/protocol.js` (window `dialog.proto-dlg`, same shell as the activity log). `push.async_push(outcome=…)` reports held back / sent / reason; `routines._async_call(trace=…)` records the steps. The log stays in memory over a reload of the integration (like the activity log), so entries waiting to be written are not lost when settings are saved.
- Tests: `tests/test_protocol.py`, new suite `protocol`; simulator command `device_panel/protocol_get`.

Not released; included in 2.105.0.

## [2.103.0] - 2026-10-20

Search field in the device pop-up for "Switches" and "Entities".

### Added

- **Device pop-up, tabs "Switches" and "Entities":** from eight entries on there is a **search field** above the list (name, entity ID or the shown state; upper and lower case do not matter), with the cross to clear it, a counter "n of m" and the note "No matches". Both tabs have their own text. The text stays when you change the tab and while the pop-up refreshes; it starts empty for the next device. While the field has the focus, the pop-up does not refresh itself (as with the other input fields). With fewer than eight entries there is no field.

### Internal

- `_devSearchHtml`, `_devSearchInput`, `_devMatch`, `_entListHtml`, `_switchGridHtml` in `device-panel.js`; the text is kept in `_devQ`. Test: new suite `devsearch`.

Not released; included in 2.104.0.

## [2.102.0] - 2026-10-20

New Magic Push messages from the overview, and the "new" button sits at the bottom.

### Added

- **Magic Push, overview:** the window with all messages now has a button **"New message"** at the bottom, like the one in the device pop-up. It opens the same assistant with one step more in front: **Device** (step 1 of 6, with search). "Next" loads the entities of the device, "Back" returns to the choice (it is kept; with the same device the conditions stay, with another one the draft starts afresh), "Cancel" closes without a question. Then everything is as in the device pop-up; the message belongs to the chosen device.

### Changed

- **Routines and Magic Push, overview:** the button for a new entry is no longer a plus at the top right but the button **"New routine"** or **"New message"** at the bottom, in the look of the one in the device pop-up. It stays at the bottom edge of the window while you scroll, so it never disappears with a long list. The texts of the windows name it.

### Internal

- `startNewFromAll`, `chooseDevice` and step 0 in `magic-push.js` (as for the routines); `.dlg-addbar` (sticky). Tests: new suite `magicadd`, `magicall` and `routineall` adjusted.

## [2.101.1] - 2026-10-20

Names in Home Assistant notifications are escaped, sliders cope with odd values from a device, and the CI actions are pinned.

### Security

- **Persistent notifications (new devices, low battery, devices offline):** device, area and integration names are inserted as plain text now. Markdown characters (`[ ] ( ) ! * _ ` < > ~ | & \`) get a backslash and line breaks become spaces. Before, a name like `X](https://…)` could add its own link or an image from another server to the notification, which every Home Assistant user sees. Names without such characters look as before. The push messages to the phone are plain text and unchanged.
- **CI:** the actions in `.github/workflows` (`checkout`, `setup-python`, `setup-node`, `upload-artifact`, `hacs/action`, `hassfest`) are pinned to a commit instead of a movable tag or branch. The version stays in a comment next to the commit.

### Fixed

- **Routines, page "Options" (sliders):** a device can report odd values: text instead of a number, `null`, a lower limit above the upper one, a step of 0 or larger than the whole range. Temperature (climate), colour temperature (light) and number entities then got a broken slider, in the worst case the page failed to build. The values are now checked in the backend and again in the panel; if they are unusable, the usual limits apply (temperature 7 to 35 °C or 45 to 95 °F, step 0.5 or 1; colour temperature 2000 to 6500 K; number 0 to 100, step 1). Normal devices are not affected. The values in the markup are also escaped.

### Internal

- `push.md_text`, `routines._finite`/`_bounds`/`_step` and `cleanSpec` in `routines.js`. Tests: `test_new_devices`, `test_battery`, `test_outage_notify`, `test_routine_options`, new suite `routineweird`.

## [2.101.0] - 2026-10-19

Hardening after a security review: fewer ways for outside data to reach internal addresses, size limits for answers from outside, and a clearer restore preview.

### Security

- **Favicon for external links:** what the page itself names (icon links, redirects) is no longer fetched when it points to the Home Assistant machine itself or to link-local addresses (`127.x`, `::1`, `localhost`, `169.254.x.x` including the cloud metadata address). Redirects are now followed by hand (at most 5) and every target is checked. The address you enter yourself is exempt (a service on `localhost` still works) and so are devices in your home network (`192.168.x.x`, `10.x.x.x`, router). A name that only resolves to such an address (DNS) is not caught: there is no name resolution before the request.
- **Update entity in HACS:** it is recognised only by the link of its release to this repository on GitHub (anchored at the host `github.com`), no longer by the title "Device Panel" or the entity ID. This applies to the panel (button "Update") and to "Install updates automatically". If HACS has no release link yet (for example right after a start), the panel treats the entity as not found until HACS has loaded; the daily check tries again.
- **Answers from outside are limited in size:** the answer of the GitHub API (version check, release texts) to 2 MB, the text files with the release notes to 1 MB (as before), the icon from the icon CDN of Home Assistant to 512 KB and 2048 × 2048 pixels (checked in the PNG header before decoding). Larger answers are dropped.

### Added

- **Restore, preview:** routines and Magic Push messages from a file show **what they do**, not only their name: entity and action (routines) or entity, condition and push target (Magic Push), in the section row and in the window "Will change"; for an existing entry as old → new. A file from someone else can no longer hide behind a harmless name.

### Changed

- **Release notes:** the changelog text is now read to the end in pieces. Before it was one read that returns only what has arrived so far; a truncated read was not observed, this is a precaution.

### Internal

- New module `http_limit.py` (`read_limited`). Tests: `test_favicon`, `test_update_check`, `test_push_icon`, `test_backup`, suite `backup`.

Not released; included in 2.101.1.

## [2.100.0] - 2026-10-19

The panel no longer changes HACS entities.

### Changed

- **Pre-releases: the panel no longer switches HACS's "Pre-release" switch.** The button "Enable in HACS" is gone: it enabled HACS's disabled "Pre-release" entity in the entity registry and switched it on, and switching "Show pre-releases" off switched it off again. An integration should not enable, disable or toggle another integration's entities. With a beta found and "Pre-release" off in HACS, "Update" stays locked as before and the note links to the HACS device ("Open HACS device"), where you enable and switch on "Pre-release" yourself; afterwards "Update" installs the beta. Switching "Show pre-releases" off leaves the switch in HACS as it is.
- Unchanged: the daily check, "Update" and "Install updates automatically" still install through the HACS update entity of Device Panel itself.
- The stored value `prerelease_hacs` (which switch the panel had turned on) is no longer used; `device_panel/set_panel` no longer accepts it.

## [2.99.2] - 2026-10-19

Routine cards show entity names as text.

### Security

- **Routines, card in the list:** the line describing what the routine does ("Socket on, back off after 20 min.") put the **name of the entity** into the page as HTML instead of text. A name containing HTML (for example `"><img src=x onerror=…>`, set by an integration or a network device) could run code in the panel with the administrator's Home Assistant connection. The line is now escaped like all other texts. All other places were checked (see Internal).

### Internal

- New check `tests/panel/xss-run.mjs` (simulator mode `PANEL_XSS=1`): every displayed text from the backend (names, areas, models, labels, messages and more) gets a piece of HTML appended that closes attributes (`"` and `'`) and inserts an image with `onerror`; all 107 suites run against it and every place where such HTML takes effect is reported with its context. Before the fix: 104 hits, all in the routine card; after it: none.

Not released; included in 2.100.0.

## [2.99.1] - 2026-10-19

The heart Easter egg also beats with "reduce motion" switched on.

### Fixed

- **Easter egg (five quick clicks on the logo):** with the system setting **"Reduce motion"** switched on (often the case on a desktop), the heart in the top left stood still and the line in the pulse chart was not drawn. The heart now beats **gently** (smaller) in that case, and the line is drawn as usual. Without that setting nothing changes.

## [2.99.0] - 2026-10-19

Restore: the preview tiles open detail windows.

### Added

- **Restore, preview:** the three tiles (**will change**, **unchanged**, **not applied**) and the section rows are tappable (arrow ›) and open a **detail window** with a "Back to the preview" button. **Will change** lists all changes by section, per setting old → new (devices with their name, settings with readable names); a tap on a section row jumps to that section. **Unchanged** lists the values that already apply. **Not applied** lists every skipped entry with its reason, devices with name, ID and what they affect; **"Copy report"** is there. Before, the preview showed only three examples and the skipped entries as one long list.

### Internal

- The restore report (`device_panel/backup_import`) now carries the full lists per section: `changes` (what, old, new, device) and `same` (what, device), each up to 500 entries, next to the counts and the three examples. Test `test_backup`, suite `backup`.

## [2.98.1] - 2026-10-19

Settings › Panel opens on the left tab; restoring explains what it skips.

### Fixed

- **Settings › Panel** now opens on the tab **"General"** (left) instead of "Updates" (right). The tab you choose is still kept while the dialog stays open.
- **Restore: a backup of your own settings no longer reports "device unknown".** Devices deleted in Home Assistant stay in the panel's own stores (type, connection type, battery and other values per device) and were written into the backup; on restore they were skipped as unknown. They are now left out of the backup. A file from before this change still reports them, now with details (see Changed).

### Changed

- **Restore, report:** the row "N devices unknown" can be opened (**"Show devices"**): per device the name (if the file knows it), the ID and what it affects (battery, notifications, type, hidden …). **"Copy report"** puts the whole list (skipped and notes, with names and IDs) on the clipboard. The report also appears in the result window after restoring.
- **Restore, option "Save current settings first"** (was "Save the state before as a file") with a clearer text: it saves the current state as a file before anything is overwritten, so the restore can be undone later, even after closing the panel.

## [2.98.0] - 2026-10-18

Back up and restore settings.

### Added

- **Settings › Panel › General: new chapter "Back up and restore"** below "Start page" (administrators only, applies to all users). **"Back up"** saves the settings to a file (`device-panel-YYYY-MM-DD.json`); you choose the parts: notifications and monitoring, panel and display, settings per device (own values, type, connection type, hidden devices), AI assessment, and, off by default, routines and Magic Push (they refer to entities and devices that may be missing). The file contains push targets, device IDs and free texts, but no credentials and no tokens. **"Copy"** puts the same text on the clipboard (for the phone app, where saving a file does not always work).
- **"Restore"** reads such a file (or pasted text) and first shows a **preview** without writing anything: how many values change, stay the same or are not applied, per part, with a few examples. Nothing is written before **"Apply"**. What the file does not mention stays unchanged; nothing is deleted.
- **Missing things are reported, not ignored silently:** a setting that does not exist in this version, a value outside its range, a device ID that does not exist here, or a routine or Magic Push message whose device or entity is missing are **skipped with the reason**; a push target that no longer exists or an integration that is not installed is **applied with a note** (without a push target no push is sent until you change it).
- **Undo:** before restoring, the panel takes the current state and can save it as a file ("Save the state before as a file", on by default); **"Undo"** in the result window restores exactly that state (also removes what the restore added) until you close the window. The same file restores it later with the same function.
- Backup and restore are blocked while the settings have unsaved changes.

### Internal

- Backend `backup.py` with the commands `device_panel/backup_export` and `device_panel/backup_import` (`dry_run` for the preview, `replace` for undo); routines and Magic Push messages keep their IDs when restored (no duplicates when restoring twice). Tests: `tests/test_backup.py`, suite `backup`.

## [2.97.0] - 2026-10-18

The header of an open settings group stays pinned.

### Added

- **Settings: the header of an opened group stays pinned** below the title "Settings" while you scroll through its content, until the next group pushes it away (an opened next group pins its own header then). A tap on the pinned header closes the group, wherever you are. Closed groups do not pin. After closing a group whose start had scrolled out of view, the view jumps to that group instead of landing somewhere random.

## [2.96.0] - 2026-10-18

The overview of each notification moves into its own tab.

### Changed

- The tab **"Overview" is now called "General"** (settings, "Monitoring and notifications"). It no longer repeats the five cards of Outage, Battery, Charging, New and Updates, which also stood in the tabs, and keeps "Where notifications go" and "Quiet time".
- Instead, **each of those tabs starts with its own small overview**: a card with the chapter (icon and title), the timeline and the **pills** (Push, Persistent, Back online, Group outage), as the overview showed them. The pills switch the notification at once, next to the switch in the same tab. The "Change" links and the "Differs" lines of the old cards are gone (the section "Exceptions" at the end of each tab stays). The tab Updates gained the timeline it lacked.
- Texts that pointed to the tab "Overview" now say "General".
- The way back from an integration to the list ("All integrations") is now a **real button** with an arrow (frame, same size and style as "Back" in the dialogs) instead of a small blue text link.

## [2.95.1] - 2026-10-18

Quiet time moves into the overview; fewer kinds are held by default.

### Changed

- **"Quiet time" is no longer a tab of its own.** It is now a section at the very bottom of the tab "Overview" in the settings ("Monitoring and notifications"), after "Where notifications go", with the same blue bar in the title. The tab bar has eight tabs again.
- **Default of the held kinds:** Magic Push and routines are now **off** by default, like the status app (held by default: outages, back online, battery, charging, new devices, updates, panel update). Existing quiet-time settings stay as saved; new ones can be switched on one by one.

## [2.95.0] - 2026-10-18

Quiet time: notifications wait during the night.

### Added

- New tab **"Quiet time"** in the settings ("Monitoring and notifications"). One global quiet time for all recipients, with its own **times per weekday** (from, to; the window may run past midnight, each day can be switched off, "Use Monday's times for all" copies the times). Default: every day 22:00 to 07:00.
- **Which notifications wait** is selectable per kind: outages, back online, battery, charging, new devices, updates, panel update, routines, status app and Magic Push (everything except the status app by default). All other kinds arrive immediately. **Critical Magic Push** notifications always arrive immediately.
- **After the quiet time** either **one summary** ("Quiet time is over: Outages 2 · Battery 1", with devices still offline, short outages and the other kinds) or **each notification separately** (selectable). In the separate mode a notification that was replaced in the meantime (same tag) is sent only once, and a device that came back is not announced as offline. At most 300 notifications are held.
- Held notifications survive a restart of Home Assistant; when the quiet time has ended meanwhile, they are sent at startup. Changing the settings releases what no longer applies at once (quiet time off, kind deselected, window ended). The activity log shows what was held and released.

## [2.94.0] - 2026-10-18

Outages are combined per integration.

### Changed

- **One notification per integration** instead of one for everything that happens to fail at the same moment. When several devices of **one integration** go offline together, one notification for that integration comes ("Zigbee Home Automation: 7 devices offline", with the first six names, "and 1 more" and the start of the outage). Fewer devices than the threshold are sent one by one. Devices of other integrations are no longer pulled into the combined message; before, a mixed group stayed a mixed group without a clear cause.
- The first notification of an integration **waits up to one minute** for the other devices to become due, so they all stand in one message (a single device of an integration is not delayed). **Back online** is combined the same way: when the last notified device of the integration is back, or after one minute, one message "Zigbee Home Automation: 7 devices back online" comes with the same tag, so it **replaces** the outage message on the phone.
- The switch "Combine group outages" is now called **"Combine outages per integration"**.

### Added

- New setting **"Combine from"** (settings, "Monitoring and notifications" › "Outage", below the switch; 2 to 20 devices, default 3). It is also in the options of the integration in Home Assistant.

### Internal

- The tests run in parallel (about 13 instead of 35 minutes; failed suites are repeated once and marked as unstable), a consistency test checks every "own setting per device" against the backend and the panel (`tests/test_consistency.py`, suite `consistency`), and the README screenshots show the current dialogs.

Not released; included in 2.95.0.

## [2.93.0] - 2026-10-18

Hiding a device asks for confirmation.

### Changed

- Pop-up of the device: **"Hide device"** now asks first ("Hide device?", with the note that the device disappears for all users, is no longer monitored and sends no notifications). "Cancel" is focused and changes nothing. After "Hide" the note "... hidden" with **"Undo"** still appears at the bottom, and the device can still be shown again in the settings. The button sits right next to "Close" and was easy to hit by mistake.

## [2.92.1] - 2026-10-18

The device pop-up graphic shows "Report only after".

### Fixed

- Pop-up of the device, tab "Settings", section "Outage": the graphic now shows **two bars** like the one in the settings, "Offline after" and the push "Report only after" (own value of the device, else the integration, else global; never shorter than the first). Until now the pop-up showed only the first bar, so the new setting of 2.91.0 had no graphic on the device. Without push (muted, switched off, no target) the second bar gives the reason.

## [2.92.0] - 2026-10-18

Icons on all Back, Next, Close and Cancel buttons; the switches tab stays current; the easter egg is now a pulsing heart.

### Added

- **Icons on all navigation buttons.** "Back" (arrow left), "Next" (arrow right), "Close" and "Cancel" (cross) now carry a symbol in the pop-up of the device, the settings, the dialogs of Status, Routines and Magic Push (wizards, confirmations) and the launcher, like "Save" (disk) and "Hide device" (eye) already did. The label that switches between "Cancel" and "Close" in the settings keeps its symbol. The other buttons of the dialogs got one too, so that **every button in this style carries a symbol**: "Delete" (bin), "Discard" (bin), "Keep editing" (pencil), "Done"/"Apply"/"Switch on" (check or power), "Copy", "Edit", "Default", "Try again", "Run now", "Add System Monitor" and "Load favicon". (The small text links in lists, such as "Edit" or "Delete" on a routine card, stay text.)
- **Easter egg:** the logo at the top left now turns into a **blue pulsing heart** (the "D" disappears) that beats in time with the line in the pulse chart, so it is visible after scrolling down too, and also without the pulse tile. After the show the logo comes back unchanged.

### Changed

- The easter egg lasts **2 seconds longer** (7.4 instead of 5.4 seconds, four passes of the line). The short 💓 note without a pulse tile is gone, the heart replaces it.

### Fixed

- Pop-up of the device, tabs **"Switches"** and **"Entities"**: after switching an entity in the dialog of Home Assistant and coming back, the old state stayed until the tab was changed. The pop-up now redraws as soon as Home Assistant reports a new state or attribute of one of the entities of the open device (gently, not in the middle of a touch or input).

## [2.91.0] - 2026-10-18

"Report only after" per device and per integration.

### Added

- **"Report only after"** (time from the start of an outage to the notification) can now be set **per integration** (settings, "Monitoring and notifications" › "Integrations", tab "Outage") and **per device** (pop-up, tab "Settings", next to "Offline after"), like "Offline after". The device wins over the integration, the integration over the global value; each row shows where the value comes from. The new setting counts as an own setting: tag at the device name, overview of deviations and reset in the settings.
- The new value is **never shorter than "Offline after"** (on all three levels). Saving an own value that is too short gives an **error message** instead of shifting it silently. Without an own value the longer of the two applies at runtime.

### Changed

- The outage notification now waits per device for its own time (device, integration or global).

## [2.90.0] - 2026-10-17

AI assessment: can be collapsed.

### Added

- Pop-up of the device: the **AI assessment** can be **collapsed**. The header of the frame is now a button with an arrow; collapsed, only the header remains (the assessment, the follow-up questions and the note are hidden, a running request goes on). The state is saved **per user** (with the favorites, in the user data of Home Assistant, a local copy as fallback), so it stays collapsed in every device and after reloading until the user opens it again.

### Changed

- The sub-tab **"Default page"** in the settings section "Panel" is now called **"General"**.

## [2.89.0] - 2026-10-17

Easter egg: a heartbeat in the pulse chart.

### Added

- **Easter egg:** tap the logo at the top left five times in quick succession (each tap within 1.5 seconds of the one before) and a heartbeat draws itself across the pulse chart for a few seconds, three beats, while the chart steps back and the pulse symbol thumps. It repeats on request, survives the chart being redrawn meanwhile, and respects "reduce motion" (the line then only fades in and out, without moving). Without the pulse tile (no data yet) a small 💓 appears instead.

## [2.88.0] - 2026-10-17

The settings button is a favorite: pinned in the header only when the user wants it; on the phone two pinned buttons.

Includes the changes from 2.87.0 and 2.86.0.

### Changed

- The gear **no longer sits permanently** at the right end of the header. The app **Settings** is now a favorite like the others and shows in the header only while it is pinned (heart in the launcher). **By default Settings is a favorite**, together with Routines: both stand pinned in the header. The launcher button now sits at the very right.
- **Phone:** the header now carries **two** pinned buttons (before: one, plus the fixed gear). The dashed line in the edit mode of the launcher ("Phone header: only the top two favorites") moves below the second favorite.
- The app **Settings** can **no longer be hidden** (padlock instead of the eye), because without the fixed gear there would be no way to the settings once it is hidden and not pinned. A "hidden" mark saved earlier is ignored.
- **Existing saved favorites** get the Settings once as the second favorite (on the phone the header then looks as before: the first favorite and the settings); whoever unpins it keeps it that way. Without saved favorites the new default applies (Routines, Settings).
- Red dot "Restart pending" (after an update): as before at the gear when **Settings is pinned**; **otherwise at the launcher button** (the label says "restart pending"). The card **Settings** in the launcher shows the red pill "Restart" in both cases.

## [2.87.0] - 2026-10-17

View with "Save": one dialog "View" with two tabs; the panel gets sub-tabs "Default page" and "Updates".

Not released; included in 2.88.0.

### Added

- Dialog **View** (button "View" above the list; on the phone the row "Sorting & view"; also the app "View" in the launcher): one dialog with two tabs. **Columns** (on the phone **Sorting**) holds what was in the dialog "Columns" and the sheet "View" before: group or list, columns (desktop), sorting, direction and details on the card (phone). It applies **per user**, separately for desktop and phone. **Filter chips** holds the chip editor (show, hide, reorder, pin, preview), moved here from the settings; it applies to **all users** and only **administrators** see the tab. Without the administrator right the dialog has only the first tab and loads no options.
- **Save** for the view: both tabs only change a draft. The list behind shows the change at once, but it is kept (per user in the user data, the chips in the options of the integration) only with **Save**. The counter shows both changes, a dot marks the changed tab. Closing with a draft asks "Discard changes?"; "Discard" puts the list back to the saved state. The tab "Filter chips" can be saved while still loading.
- The settings: the section **Panel** (until now "Panel version") has two sub-tabs. **Default page**: the switch "Set as my start page" with the note "Applies only to you, not to other users". **Updates**: the settings of the update check (daily check, time, automatic installation, reminder). The **version line** (check for updates, install, release notes, pre-releases) stays **at the very top** of the settings, as before, so it is quickly reached and seen at once on opening.
- Every **Save** button now carries the floppy disk symbol in front of the text, in the same style as the eye on the hide button: pop-up of the device, settings, the dialogs of Status, Routines and Magic Push, and the launcher.
- The symbol "eye with a small gear" now also stands on the button "View" and on the row "Sorting & view" on the phone (before: the columns symbol and the sorting arrows).

### Changed

- The button "Columns" is now called **View** (dialog title "View"); the old dialog "Columns" and the sheet "View" are gone, replaced by the dialog above.
- The section "View" is gone from the settings; start page and filter chips moved as described above.
- A filter or area chosen in the list (area, integration, chips, table head sorting) still applies and is saved at once; only the settings in the dialog "View" wait for "Save".

## [2.86.0] - 2026-10-17

AI assessment: button "Remove".

Not released; included in 2.88.0.

### Added

- Pop-up of the device, AI assessment: next to "Create again" a new button **Remove** takes the assessment away, from the pop-up and from the memory (new command `device_panel/ai_clear`). The button "Assess with AI" stands there again; a new assessment is one tap away. It stays away when the pop-up is opened again, because the remembered assessment is gone. It also no longer flows into the context of a later assessment. No confirmation, since it is easy to recreate. A long assessment (with follow-up questions) could not be got rid of before.

## [2.85.0] - 2026-10-17

App launcher: the apps "View" and "Settings".

Includes the changes from 2.84.0 and 2.83.0.

### Added

- App launcher, group "Device Panel": two new apps, **View** (symbol: eye with a small gear, in blue) and **Settings** (gear, in brown-grey). "View" opens the dialog "Columns" (on the phone the sheet "View") with sorting, columns and filter chips; "Settings" opens the central settings. Both can also be reached by the buttons in the header, so the user can **hide them** in edit mode (eye), like Routines and Magic Push; both are visible by default. They can be made favorites too.
- App launcher: the card **Settings** shows a red pill "Restart" as long as the red dot sits on the gear in the header (restart pending after an update). The launcher button gets no dot for it; the dot stays only at the gear in the header. Gone as soon as the new version runs.
- Symbols may now be put together from several shapes (the eye with the gear cut out of it); until now a symbol was one single shape.

## [2.84.0] - 2026-10-17

Pop-up of the device: button "Open integration in HA".

Not released; included in 2.85.0.

### Added

- Pop-up of the device, next to the device button: the button **Open integration in HA** (same style, on the same line, also on the phone). Both buttons follow one scheme and are shorter than before: "Open device in HA" and "Open integration in HA". It opens the page of the integration of this device in Home Assistant (for example the ESPHome page for an ESPHome device) and closes the pop-up; with unsaved changes it asks first, like the device page. Devices without integration have no such button.

### Changed

- Pop-up of the device: the button "Open device page" is now **"Open device in HA"** (shorter, same scheme as the integration button).

## [2.83.0] - 2026-10-17

New device type "Display".

Not released; included in 2.84.0.

### Added

- New device type **Display** (screen symbol) for displays, for example an ESPHome display. There is no automatic detection (a display has no entity kind of its own in Home Assistant, so a guess would often be wrong): you set the type by hand on the device (pop-up, tab "Settings") or for a whole integration (settings, "Device types"). It shows in the list, in the filter and in the exclusions like the other types, in German and English. The order of the types: "Display" stands after "Media".

### Changed

- Overview, tile "Just offline": the line at the bottom ("No warnings") no longer shows while devices are offline and none has a warning. Warnings count only devices that are online (weak signal, low battery, unstable), so "No warnings" right under an outage read as a contradiction. With warnings the line stays; with all devices online it still reads "No warnings".

## [2.82.0] - 2026-10-17

Pop-up of the device, tab "Entities": copy the link to the device.

Includes the changes from 2.81.0.

### Added

- Pop-up of the device, tab "Entities": at the very end the section **Link to this device** with two rows. **Copy link** copies the address you are using for Home Assistant right now plus `/device-panel?device=<id>`; opening it shows this device in the panel (the same deep link the push uses). **Copy app link** copies `homeassistant://navigate/device-panel?device=<id>`, the form of the Home Assistant app. A tap shows a check mark. The links are put together when drawing and when copying, so they always match the address in use. Limits: away from home a link works only if its address is reachable from outside; whether the app link opens the Home Assistant app depends on the phone (the form follows the documentation of the app, not tested on a phone).

## [2.81.0] - 2026-10-17

App launcher: button "Restart Home Assistant" with a confirmation.

Not released; included in 2.82.0.

### Added

- App launcher (administrators only): a power button in the header, left of "Edit", restarts Home Assistant. It always asks first in a window of its own ("Restart Home Assistant?", with the note that integrations, routines and connections are unavailable for a few minutes); the safe answer "Cancel" has the focus, Escape cancels too. Only "Restart" calls the service `homeassistant.restart`. Home Assistant itself checks the right (administrators only) and refuses the restart if the configuration is invalid; the refusal shows as a note in the launcher. The broken connection during the restart is no error. The button is missing in edit mode and for users who are not administrators.

## [2.80.0] - 2026-10-17

Routines can set numbers and selections; a hanging switching command ends after 45 seconds.

### Added

- Routines: new action **Set** for `number` and `select` entities (for example the brightness of a display or an operating mode). The assistant shows a slider and a number field with the unit and the allowed range for a number, buttons (or a list for more than five values) for a selection; the value is checked against the range and the options of the entity. A routine of this kind goes back only with **As before** (the value right before switching is restored); the opposite does not exist. The test button, the preview, the sentences and the push ("Brightness set to 60 % · 14:32") know the new action. `button` entities are not included.
- Pop-up of the device, tab "Switches": `number` and `select` entities appear as tiles too (state shown, a tap opens the control of Home Assistant; nothing is switched by the tile).

### Changed

- Routines: every switching command ends after **45 seconds** (fixed, no option). A command that does not answer (for example a cloud device) counts as an error with the reason "the device did not answer" and is tried again after 5 minutes, at most twice; other routines no longer wait for it. Limit: Home Assistant keeps running a cancelled service call, so a very slow device can still switch late.

### Fixed

- Tab bars (the sliding capsule): if the bar was redrawn right after a tap (for example because fresh data arrived in the Status window), the capsule jumped back to its starting point and drove again, so it looked like it hopped to and fro. It now continues from where it really is. Fixes the hopping in the Status window and every other place with tab bars.

## [2.79.0] - 2026-10-16

Window "Routines": the switch "Pause all routines" stands at the very top.

### Added

- Window "Routines" (lightning bolt in the header): at the very top stands **Pause all routines**, the same switch as in the settings under "Routines". It applies at once, without "Save", and both places show the same state (option `routines_pause`). While paused, a note in warning colour says "Paused: nothing switches until you turn it on again. The routines skip their times."; otherwise the short explanation. If saving fails, the error shows in the window and the switch stays as it was.
- The answer of `device_panel/routine_list` carries the state as `paused`, so the window shows it without a second call.

### Fixed

- Windows "Routines" and "Magic Push": if the window was closed and opened again at once, the delayed close event could wipe the state of the new opening (the list then did not react to taps). It now only wipes it when the window is closed.

## [2.78.0] - 2026-10-16

Settings, monitoring and notifications: the tabs "Charging" and "Signal" end like the others with a section "Exceptions".

Includes the changes from 2.77.0.

### Added

- Tab "Charging": the end now has a section **Exceptions** with the box "N integrations differ" (with the values, for example "Shelly: Charging on (full from 90 %)", and the jump to "Integrations") and the list **"Own charging values on devices"**. Before, the settings did not show on which devices the charging alert differs from the default. The list shows every own value per device (charging on or off, full from, rise, ended after, push at end, live), with area and integration. A cross resets one device, "Reset all" all of them; as in the other tabs the reset only happens on save, after which the integration or the global values apply again. The section is there when the charging alert is off too, because devices can still have own values. It stands at the very bottom, after the list "Per integration".
- Under "Devices in the panel" › "Device settings" and in the detail of an integration the same list for the charging alert stands next to the others. On the overview "N devices" in the row "Charging" now leads to this tab and counts all devices with own charging values (before only those with an own switch).
- New list `overrides.charge` in `get_options` and new parameter `charge` for `device_panel/reset_device_settings` (takes back all own charging values of the named devices; the answer counts `charge` too).

### Changed

- Tab "Signal": in the section "Exceptions" the box "N integrations differ" now comes first, as in Outage, Battery and New, then the list of devices with their own threshold.
- Long values in the list (charging alert with several own values) stand under the name of the device over the full width, so the name is not squeezed.
- The tab "New" stays as it is: there are no values per device, only the box of the integrations.

## [2.77.0] - 2026-10-16

Not released; included in 2.78.0.

Status app: the minimum duration of the alert at high load is set per kind (processor, memory, disk), the recipient has a section of its own.

### Changed

- Status app, settings, "Alert at high load": the **minimum duration** is no longer one number for all but is set per kind. Under the limit of processor, memory and disk there is a row "Minimum duration" of its own (1 to 60 minutes, default 3 each). The needs differ: a processor may jump to 100 % for a moment, a disk should be reported at once. An error (empty, not a whole number, outside 1 to 60) shows in the block of that kind and blocks "Save". New options `status_cpu_minutes`, `status_ram_minutes` and `status_disk_minutes`; the former common option `status_load_minutes` is gone. If it was set, its value is kept for all three kinds at the first start (an own one that was already set stays), after that each can be changed alone. The hint under the section no longer names a number.
- Status app, settings: the **recipient** has a section of its own, "Recipient of the alerts", at the very top. It applies to all alerts of the Status app (when something stops and at high load); before, the choice stood under "Alert when something stops" although it also governs the alert at high load. Below follow "Alert when something stops" (only the switch now), "Alert at high load" and the source of the values. The warning "No target is chosen" stands at the recipient and now names high load too. The stored options do not change (`notify_service_status` stays).

## [2.76.0] - 2026-10-16

The app "Status" can no longer be hidden.

### Changed

- App launcher, edit mode: the app **Status** gets a lock instead of the eye, like the log. It can no longer be hidden, because the settings of the alerts live there (when something stops and at high load, recipient, source of the values). Sorting and choosing it as a favorite still work. If someone had already hidden it, it is visible again. **Routines** and **Magic Push** can still be hidden with the eye and are visible by default. The hint on the lock names the reason for each app.

## [2.75.0] - 2026-10-16

Magic Push is an app of its own with its own window, no longer a tab in the settings.

Includes the changes from 2.74.0.

### Changed

- Magic Push: the overview of all messages of all devices has moved out of the settings ("Monitoring and notifications", tab "Magic Push") and opens as a **window of its own**, like "All routines": bell in the header, title "Magic Push", subtitle "All devices", cross to close. These are not settings in the true sense, the messages belong to the devices and are saved at once. Content and use are unchanged: one card per device, search, filter (All, On, Off, Triggered), fold cards in and out, switch on and off, edit (opens the window of the assistant), delete with confirmation and "Open device". New messages are still created in the pop-up of the device, in the tab "Magic Push". The window reloads the list when a device pop-up is closed; after closing and opening it again the search is empty.
- The app "Magic Push" in the launcher opens this window (before: the settings at the tab "Magic Push").
- Settings, "Monitoring and notifications": the tab "Magic Push" is gone, eight tabs remain (Overview, Outage, Battery, Charging, New, Updates, Signal, Integrations), in four columns and two rows on the desktop. Its entry in the search of the settings is gone too.
- README: the picture of the overview shows the new window (`magic-all.png`, before `settings-magic.png`); the picture of the settings with the tabs is new.

## [2.74.0] - 2026-10-16

Not released; included in 2.75.0.

Window "All routines": every routine can be run from there; alert at high load with a minimum duration; fixes from the code review (routines, push, texts).

### Added

- Window with all routines (lightning bolt in the header): each routine has a button **Run** next to "Edit", like in the pop-up of the device. It switches at once, without asking, also when the routine is switched off; the schedule stays as it is, a switch-back is planned. The result shows in the card of that routine ("Done." in green or "Could not switch: …" in red, for example "not reachable"), not at the top of the long list; the next action in the window clears it. The introduction of the window names it too.
- Status app, settings, "Alert at high load": new row **Minimum duration** (1 to 60 minutes, default 3, for processor, memory and disk). The value must be at or above the limit at that many checks in a row (one check per minute) before the push comes; 1 reports at the first check, a higher number ignores longer peaks. Before, it was fixed at 3. New option `status_load_minutes`. The hint under the section names the current number.

### Changed

- Phone: the actions under a routine or Magic Push rule (Edit, Run, Delete, heart) are a little narrower at the sides (7 instead of 12 px), so the four fit on one line at 390 px; the height of 44 px for the finger stays.
- App launcher, edit list: the line "Is the panel running?" under "Status" is gone (the other apps keep their line).
- Push: with additional data (tag, link) a **temporary** error (network, timeout) is tried once more with the same data after 2 seconds; before, the second attempt always went out without them, so the all-clear did not replace the first message and a tap did not open the app. Only when the target **rejects** the additional data (for example Telegram, e-mail) does the plain message follow at once, as before; if the retry fails as well, it goes out plain as a last resort.
- Status window: it no longer asks every 10 seconds while the panel is hidden (like the list of devices).
- Tests: the unit tests treat deprecation warnings from the integration's own code as errors (those of Home Assistant stay off), so a deprecated call like the one of 1.31.1 shows up; new tests for the points of this section.
- Cleaned up: 14 unused texts and 7 unused code parts (Python) and variables (JavaScript) removed; no change in behaviour.

### Fixed

- Status app, tab "System": the curves of processor and memory show a short peak. Before, every section of the curve (about 5 minutes) was the mean of its values, so a peak of a few minutes at 100 % looked like 30 to 60 %, while "Peak 100 %" under the curve used the raw values. Now each section shows its highest value; the average under the curve is unchanged. Disk and the longer ranges stay as they were.
- Routines: a switching command that does not answer (for example a cloud device) no longer makes other routines due at the same time "missed". They waited for the lock and counted their delay from the moment they got it, so after more than the catch-up time (default 10 minutes) they were skipped and never switched. The delay now counts from the timer; such a routine runs late instead of never. A routine that really is too late (Home Assistant was off) is still "missed".
- Filter "Integration": the entry for devices without integration read "No integrations." instead of "No integration" (a text key was defined twice). The empty list keeps "No integrations."; a test now finds duplicate text keys.
- Status alerts: the time in the push ("… · 14:32") is in the time zone of Home Assistant, no longer in that of the system (in a container without time zone it was UTC).

## [2.73.0] - 2026-10-16

Status app: three tabs, "Services", "System" and "Settings"; the alert at high load opens "System".

### Changed

- Status app: the graphs have their own tab. The tabs are now **Services** (the parts of the integration with their pills and restart buttons; this was "State"), **System** (processor, memory and disk as graphs, without a heading of their own) and **Settings** (unchanged: alerts, limits, source of the values, saved with "Save"). The window opens on "Services". The system values are only fetched while "System" or "Settings" is open, no longer every 60 seconds in the background.
- The push at high load opens the Status app straight on the tab "System": its link is `/device-panel?app=status&tab=system`. The push for a stopped part still opens "Services". The parameter `tab` (`services`, `system`, `settings`) is removed from the address afterwards, like `app`.
- Status app: the line "Is the panel running?" under the title of the window is gone; it no longer fits now that the app also shows the system.

## [2.72.0] - 2026-10-16

Status app: two tabs, "State" and "Settings"; the settings only apply after "Save".

### Added

- Status app, new tab bar "State" | "Settings". "State" keeps what you look at (the parts with their pills, the restart buttons, the three graphs). "Settings" holds everything you can change: "Alert when something stops" (switch and recipient), "Alert at high load" (switch and limit for CPU, memory and disk) and "Source of the values" (automatic or an own sensor). The tab opens on "State".
- Saving is deliberate: a switch, a limit, the recipient or a chosen sensor is only a draft until "Save" is pressed; then everything goes out in one call (`set_options`) and the window stays open with "Saved". The bar at the bottom shows the number of open changes ("1 change", "2 changes"), "Save" (only active when something changed and all limits are valid) and "Discard" (back to the saved values); without changes the second button reads "Close". While there are unsaved changes, a dot on the tab "Settings" shows it on the tab "State". Closing the window (cross, click outside, Esc) or opening the "System Monitor" page with unsaved changes asks "Discard changes?" first. A value set back to the saved one counts as no change.

### Changed

- Before, every switch, the recipient, each limit and each chosen sensor was saved at once. That is gone: nothing changes until "Save". An invalid limit (empty, not a whole number, outside 1 to 100) still shows the error at the field and now also blocks "Save".
- The hints on the cards "No sensor found" point to the tab "Settings" instead of "below".

## [2.71.0] - 2026-10-16

Status app: push alert at high CPU, memory and disk load; the "Debug" pill no longer overlaps the icon.

### Added

- Alert at high load: in the Status app, below "Alert when something stops", a new section "Alert at high load" with one row each for **processor (CPU)**, **memory (RAM)** and **disk**: a switch (default on) and a limit in percent (default 99, free from 1 to 100). One push when the value stays at or above the limit for **3 minutes in a row** (short peaks send nothing, the check runs every minute): "⚠️ Device Panel: Processor at 99 %". When it is clearly below the limit again (at least 2 points under it, for 2 checks) an all-clear follows, "✅ Device Panel: Processor back below 99 %", which replaces the first push. A value that hovers around the limit does not chatter. Tapping the push opens the Status app. The recipient is the same as for "Alert when something stops" (own target or the default); the warning "No target chosen" now also covers these alerts. The log notes both messages. The value is the one the card shows (own sensor or found automatically; a sensor in gigabytes with a known total is converted to percent). Only values in percent can be compared: for a sensor in gigabytes without a total, or no sensor, there is no alert and the row says so. New options `status_cpu_alert`, `status_ram_alert`, `status_disk_alert` (default true) and `status_cpu_limit`, `status_ram_limit`, `status_disk_limit` (default 99). An invalid limit shows an error at the field and is not saved. Limits: a message that is open when Home Assistant restarts is sent again if the value is still too high after 3 minutes.

### Fixed

- App launcher: the "Debug" and "Fault" pills on a tile no longer sit on top of the icon. They now stand centred above it (the tile has more room at the top), on the desktop and on the phone.

## [2.70.1] - 2026-10-16

Not released; included in 2.71.0.

Status app, system: after switching on sensors, nothing seems lost any more.

### Changed

- The button "Switch on sensors" asks first: it lists the sensors (name and entity), says what happens (only the sensors themselves are switched on, nothing is deleted, existing histories stay, Home Assistant reloads the integration after about 30 seconds and the sensors are briefly unavailable) and how to undo it (Settings, Devices & services, Entities). "Cancel" changes nothing.

### Fixed

- Right after switching on, the card said "The chosen sensor no longer exists." The newly switched-on sensor has no state until Home Assistant has reloaded the integration. Now the card stays with the sensor that has values (for the disk "Disk use" in gigabytes) and switches to the new one as soon as it has a state; if only the new one exists, it says it is reloading (not an error). A chosen sensor that is switched off in Home Assistant is reported as such.
- Disk: a freshly switched-on percent sensor only has values from now on, so the curve looked empty ("history lost"). If "Disk use" and "Disk free" are on, the longer history of "Disk use" is converted to percent as long as it reaches further back than the percent sensor. Nothing was ever deleted.

## [2.70.0] - 2026-10-16

Status app, system: find the disk sensors, choose entities with a search, times on the graphs.

### Added

- Choose the sensor with a search field: under "Source of the values" each kind opens a list of **sensor entities** (name and `sensor.…` below it, not devices) with the usual search field and its clear button; "Automatic" stays on top. All sensors with a number and a unit are offered, the likely ones (percent without a device class; for the disk also sizes in bytes) first, the rest is found by typing. Before, a plain drop-down cut off after 200 entries could not show sensors like `sensor.system_monitor_arbeitsspeicherauslastung` or `sensor.system_monitor_belegter_massenspeicher`.
- Disk without a percent sensor: "System Monitor" creates "Disk usage" (percent) switched off, often only "Disk use" in gigabytes is on. The card now finds that sensor on its own. With "Disk free" also on, the percentage is calculated (used / (used + free)) and the size is shown; with only "Disk use" the card shows the gigabytes (for example "318.4 GiB") with its own axis instead of percent. Sensors from the Supervisor integration ("Host disk used" and "total") are used too when there is no System Monitor. Any sensor in bytes or another unit can also be chosen for the disk; the card then shows its own unit.
- Sensors that exist but are switched off (System Monitor and the Supervisor create most of them that way): the card names them and has a button "Switch on sensors". Only on that press, only sensors of System Monitor and the Supervisor; Home Assistant then reloads the integration itself and the values show up after about a minute. New WebSocket command `device_panel/status_system_enable` (administrators, parameter `kind`).
- "System Monitor" not set up: the card says so and that it is not required (an own sensor can be chosen), and a button "Add System Monitor" opens the page "Add integration" of Home Assistant at that integration (it only opens the page, nothing is changed). `device_panel/status_system` carries `integrations` (`systemmonitor`, `hassio`) for this.
- Graphs with a time axis: clock times under the curve (every 3 hours for 24 hours, days for 30 days, months for 6 months and 1 year) with faint vertical lines, and "now" at the right.

### Changed

- `device_panel/status_system`: each card carries `mode` (`percent` or `absolute`), `unit`, `axis_max` and `disabled`; `candidates` carry `unit` and `pref`.

## [2.69.0] - 2026-10-16

Status app: the disk in gigabytes as well as percent.

### Added

- Status app, card "Disk": under the percentage the size, for example "318.4 of 530.7 GiB used · 212.3 GiB free" (the unit as Home Assistant reports it, GiB; from 1024 GiB in TiB). The numbers come from the sensors "Disk use" and "Disk free" of the integration "System Monitor" for the same disk (total = used + free). Without these two sensors (they may be switched off by default) the card shows the percentage only, with a hint which sensors to enable. With an own sensor chosen for the disk there is no size. `device_panel/status_system` carries it as `size` (`used`, `free`, `total`, `unit`) in the disk entry.

## [2.68.0] - 2026-10-16

Status app: small graphs for CPU, memory and disk.

### Added

- Status app, new section "System": three cards with the current value and a small graph from the recorder. **Processor (CPU)** and **memory (RAM)** show the last 24 hours; the **disk** has a bar to choose 24 hours, 30 days, 6 months or 1 year (long periods come from the long-term statistics of the recorder: hourly means, from 6 months daily means). Every card shows "24 h ago" to "now" and the average and peak of the period. The panel records nothing itself: the values come from sensors Home Assistant already has.
- Sensors are found automatically: first the integration "System Monitor" (processor, memory and disk in percent, the host), for CPU and memory otherwise the values of Home Assistant Core from the Supervisor integration (marked "Home Assistant Core (the process only)", because they are not the host). Several disks: the main disk ("/") first. Nothing found: a hint on every card says to enable "System Monitor". Under "Source of the values" each kind can instead be set to an own sensor (any sensor in percent with a state class); stored as the options `status_cpu_entity`, `status_ram_entity` and `status_disk_entity` (empty = automatic). A chosen sensor that no longer exists is reported, not silently replaced.
- New WebSocket command `device_panel/status_system` (administrators; parameter `range`: `24h`, `30d`, `6m`, `1y`, only for the disk). The window asks again every 60 seconds.

## [2.67.0] - 2026-10-16

Not released; included in 2.68.0.

Routine assistant: no second choice after a scene or group was picked.

### Changed

- Routine assistant: a scene or group picked on the first page is not asked for again. A **scene** has nothing left to define (the only action is "Activate"), so the page "What" is dropped: after the first page it goes straight to "When" (four pages instead of five). A **group** keeps one page, now called "Action" with the question "What should happen with "<name>"?": only On / Off / Toggle, no list of all groups any more. When a routine is edited, the page "What" with its list stays as before.

## [2.66.0] - 2026-10-16

Routine assistant: one list with a filter and a pill; the status alert opens the Status app.

### Added

- Status alert: a tap on the push "⚠️ Device Panel: <part> is down" (and on "✅ … is running again") now opens the Status app directly instead of the overview. The link is `/device-panel?app=status`; it is removed from the address afterwards, like `?device=`. Only administrators get the app (the same as in the launcher).

### Changed

- Routine assistant, first page ("Device, group or scene?"): every device, every group and every scene stands in the list as a row of its own, without searching first (devices, then groups, then scenes). The collective entries "Scenes" and "Groups" are gone. A filter bar on top (All, Devices, Groups, Scenes, each with its number) narrows the list; it only shows when there are groups or scenes without a device. Groups and scenes carry a small pill ("Group" / "Scene") on the right, devices keep "N entities". The search works over the chosen filter and still finds a device by the scenes and lamps in it. A tap and "Next" lead to the page "What" with the scene or group already chosen. The limit of 40 rows from 2.65.0 is gone, the filter replaces it.

## [2.65.0] - 2026-10-16

Routine assistant: every scene and group is found directly by its name.

### Changed

- Routine assistant, first page ("Device, group or scene?"): typing a name in the search now shows every matching scene and group as a row of its own (with its symbol and the kind "Scene" or "Group" on the right), no longer only the collective entries "Scenes" and "Groups". A tap and "Next" lead to the page "What" with that scene or group already chosen and its action set. Nobody has to know the words "scene" or "group" any more; helper groups (Group integration) are found the same way. Without a search the list stays short (devices, then "Scenes" and "Groups"). The search shows at most 40 such rows and says how many more matches there are. The device list of the server (`routine_devices`) carries the single entries as `items` (`id`, `name`) for the collective entries.

## [2.64.0] - 2026-10-16

Settings: look for a new version every time they are opened.

### Changed

- Settings, section "Panel version": every time the settings are opened, the panel now asks GitHub for the newest version right away (before, it used the answer of up to 6 hours ago unless you pressed "Check for updates"). While it checks, the usual "checking" display shows. The server still asks GitHub at most once per minute, so opening the settings several times in a row does not use up GitHub's limit; the button "Check for updates" works as before. Opening does not reload HACS on its own and does not drop an earlier install error; while an installation or a restart is running, the settings keep the current state. If GitHub knows a newer version than HACS, HACS is reloaded once for that version, also when it was found on opening.

### Fixed

- Release notes window: "The release notes could not be loaded: HTTP 404" for releases whose tag has no "v" (such as 2.63.0). The notes are now looked up under both "v2.63.0" and "2.63.0", in the changelog files as well as in the GitHub release text.

## [2.63.0] - 2026-10-15

Status: restart a part by hand.

### Added

- App "Status": a part that is "late" or "stopped" has a button "Restart". A question follows first ("Restart <part>?"): it restarts only this part of the integration on a fresh object, not Home Assistant and no other integration, and the saved state is kept. With routines, what was due is caught up if it is still within the catch-up window, otherwise it is noted as missed. Afterwards a short note "<part> was restarted." appears and the state follows; a failed restart shows the error in the window and puts the old object back. The server refuses a restart of a part that is running and a second restart within 20 seconds. The log notes every restart ("Restarted by hand") and every failure. New WebSocket command `device_panel/status_restart` (administrators).
- Search fields: every search field now has the same clear button (a small X on the right, visible only while something is typed): in the routine assistant (device list, entity list, condition search), in the app launcher, and in the free-entity search of Magic Push; the log, the overview lists and the main search already had it. A tap empties the field, the list follows and the cursor stays in the field. One shared mechanism (`data-fc`) instead of one handler per field.
- Nothing restarts automatically: that would risk doubled or lost routine runs and hide the cause of a stop.

## [2.62.0] - 2026-10-15

Not released; included in 2.63.0.

New app "Status": is the panel running?

### Added

- Launcher, new app "Status" (group Device Panel, administrators only, not pinned by default): shows whether the parts of the integration are running, with a state per part ("running", "late", "stopped"), a header ("Everything is running" or "Fault: N parts") and a line "Integration started: <time> · N routines loaded · M missed". The parts: routines (measured by whether something is overdue: due, but did not run), outage monitoring, battery, charging and reception history (each by the time of its last beat; late after 4 times the beat, at least 2 min; stopped after 10 times, at least 5 min), Magic Push, new devices and updates (event-driven, no fixed beat: only whether they are loaded). Mockups: `docs/mockups/status-v1`.
- Alert when something stops: a watcher checks every minute; a part that is stopped at two checks in a row (so a stall of Home Assistant itself does not alert) triggers one push "⚠️ Device Panel: <part> is down" and, when it runs again, "✅ … is running again" (replaces the first one). The alert goes into the log as well. At the top of the app: switch "Alert when something stops" (default on) and a drop-down "Recipient" like in the tabs of the settings ("Default (…)" = the global target, or an own target); stored as the options `status_notify` and `notify_service_status`.
- Warning when nothing can be sent: if the switch is on but neither an own nor the global target is chosen, a red line under "Recipient" says that nothing will be reported.
- Dots in the header: a red dot on the launcher button when a part is late or stopped, an orange dot while debug mode is on (red goes first). If the app Status (or the Log) is pinned with the heart, the dot sits on its own button instead of on the launcher button. In the launcher the app Status shows a red pill "Fault", like "Debug" on the Log (the pill "Debug" now shows without opening the log first).
- `list_devices` carries `debug` and `status` (numbers for the dots); new WebSocket command `device_panel/status_get` (administrators).
- Limit: if Home Assistant itself stands still or restarts, this watcher cannot report it; that needs something outside (for example an external ping).

## [2.61.0] - 2026-10-15

Not released; included in 2.62.0.

Routines: scenes and groups.

### Added

- Routine assistant, "Add routine" in the window "All routines": the first page is now "Device, group or scene?". After the devices come two entries without a device: "Scenes" and "Groups". Only entries that contain something are shown.
- Scenes (Home Assistant `scene`, without a device): the one action is "Activate" (`scene.turn_on`). A scene has no opposite, so there is no page "Switch back" and no options page; time or trigger, time window, pause and "only once" work as for every routine. Push and log say "Scene <name> activated". "Run now" in the assistant activates the scene once.
- Groups (a light, switch, fan … that lists other entities in its `entity_id` attribute and has no device, for example a light group; groups of the Group integration (helpers) also count while they are unreachable): they behave like a single lamp, with on, off, toggle, brightness and colour options and switching back (also "as before").
- Overview and window "All routines": routines of scenes and groups stand in their own cards "Scenes" and "Groups" after the devices (with their own symbol, without the link "Open device"). All scenes appear in "Scenes", also those of a device (for example Hue scenes); those also stay with their device and appear in its routine tab. Scenes do not appear in the tab "Switches" of the device pop-up.
- The search in the assistant also finds the entities inside devices, "Scenes" and "Groups" (typing "alles" finds the scene "Alles aus"), and the page "What" has its own search field from 8 entities on (an instance with 78 scenes needs it).
- The limit of 20 routines per device does not apply to "Scenes" and "Groups" (the limit of 200 in total does).
- New value in the routine data: `device_id` may be `@scenes` or `@groups` (WebSocket `routine_devices`, `routine_get`, `routine_list`, `routine_save` accept them). Scripts are not offered.

## [2.60.0] - 2026-10-15

App launcher: full screen on the phone.

### Changed

- App launcher on the phone: the window now fills the whole screen, exactly like "All routines", and its close button sits in the same place and has the same size (38 px, 12 px from the top and right edge). It was the last window that came up as a sheet from below. On the desktop it stays a window under the button. The form for your own apps stays a sheet.

## [2.59.0] - 2026-10-15

Not released; included in 2.60.0.

Routines: your own time next to the quick choices.

### Changed

- Device pop-up: more space (14 instead of 6 px) between the button "Open HA device page" and the tab bar, which looked squeezed.

### Added

- Routine assistant, trigger: next to the quick choices there is now a field "or own time" with a unit for every time that had only quick choices: "Holds for at least" (start and switching back; seconds, minutes or hours, from 1 second up to 7 days), "Pause" after a switch (minutes or hours) and "At the latest after" (minutes, hours or days). Typing a value takes the quick choice off (the capsule disappears); clearing the field brings back the default; choosing a quick choice empties the field. An invalid value shows the allowed range under the field and blocks "Next". The pause cannot go below 1 minute, the shortest quick choice, so nobody gets a pause shorter than the default offers; all other fields allow what the server allows. When you edit a routine, a value that is not a quick choice stands in the field.

## [2.58.0] - 2026-10-15

New tab "Switches" in the device pop-up; the close buttons of the log, "All routines" and the launcher match the new look.

### Added

- Device pop-up, new tab "Switches" (second place, emoji 🕹️): all entities of the device that can be switched (switch, light, fan, shutter, valve, lock, siren, humidifier, climate, media player, as with the routines) as compact tiles in three columns, each with a symbol, the name and the state ("on" tiles are coloured, a lamp and a shutter also show brightness and position). A tap opens the Home Assistant controls of that entity, exactly like the entity in the tab "Entities" (dimming, colour, position, temperature are there); the tile itself never switches anything, so a lock or a shutter cannot react by accident. Entities that cannot be reached are dimmed. A device without anything to switch has no tab (five tabs as before). Mockups: `docs/mockups/switches-v1`.

### Changed

- Close button in the full-screen windows on the phone (settings, log, "All routines"): it now sits at the same height as the settings button of the overview (12 px from the top edge), so it stays in the same place when a window opens.
- Launcher window: its close button has the grey outline like the other round buttons (size and position unchanged, the window is not full screen).

## [2.57.0] - 2026-10-15

Tabs with emoji and text on the desktop; the lightning bolt for routines.

### Changed

- Device pop-up, desktop: every tab now shows its emoji in front of the label ("📊 Overview", "⚙️ Settings", "🧩 Entities", "🔔 Magic Push", "⚡ Routines"). Before, only the phone showed emoji (and the label only on the chosen tab); the desktop showed text alone. On the phone nothing changes. Tabs with a second line ("2 on") keep it, with the emoji to the left of both lines.
- Routines get the lightning bolt instead of the stopwatch: as the emoji of the tab, as the symbol of the button in the header (and in the launcher, and in the header of the window "All routines"), and in the push notification ("⚡ Routine: <name>"). The stopwatch no longer fit a routine that can also start by a trigger.

## [2.56.0] - 2026-10-15

Not released; included in 2.57.0.

Close, heart and plus buttons in the window headers look like the buttons of the overview.

### Changed

- The round buttons in the header of every window (cross, heart in the device pop-up, plus in "All routines") now look like the buttons of the panel overview (settings, launcher, favorites): a grey outline on the card colour instead of a filled grey disc, and the same size (42 px, on the phone 38 px). On the phone the cross sits at the same distance from the right edge as the settings button, so it is in the same place when a window opens over the overview.

## [2.55.0] - 2026-10-15

Timers are now called routines.

### Changed

- "Timer" is now "Routine" everywhere: the tab in the device pop-up ("Routines"), the launcher app and the button in the header, the window "All routines", the section in the settings (pause all, catch up missed ones, recipient, notify on failure), the push notifications ("⏱️ Routine: <name>", "⚠️ Routine failed: <name>"), the log category, the README and the screenshots. Since a routine can now also start by a trigger and switch back by time or trigger, "timer" no longer described it. How routines work does not change.
- Everything you saved stays: routines (the storage file `device_panel.timers` moves to `device_panel.routines` on the first start, with its running state), the four settings (`timers_pause`, `timers_catch_up`, `timers_notify_error`, `notify_service_timers` become `routines_pause`, `routines_catch_up`, `routines_notify_error`, `notify_service_routines`), the favorite routines (hearts) and the launcher entry "Timer" with its place among the favorites.
- Internal names follow the new name: files (`routines.py`, `routines_ws.py`, `routines.js`, `routine-trigger.js`), the WebSocket commands (`device_panel/routine_*`, field `routine_id`), the CSS classes (`rt-*`) and the strings (`rt*`). Anyone who calls the old commands (`device_panel/timer_*`) has to switch to the new ones.

## [2.54.1] - 2026-10-15

Not released; included in 2.55.0.

Timer: no error message when switching to a trigger.

### Fixed

- Timer, trigger: switching to "By a trigger" no longer shows the red message "Conditions expected" before a condition has been entered. The assistant now asks the server for the preview only once the conditions (and a time window, if set) are complete.

## [2.54.0] - 2026-10-15

Timers: a trigger instead of a time, and switching back by time or trigger.

### Added

- Timer, page "When": a switch "At a time | By a trigger". With "By a trigger" the timer switches when conditions are met, built like Magic Push: any entity, "above", "below", "is" or "changes", several conditions with "and" / "or" and one level of groups, and optionally "Holds for at least" (immediately, 30 s, 2 min, 5 min). The condition text appears as a sentence ("When Temperatur Garten is below 5."). The timer only switches when the condition is newly met: if it is already met when the timer is saved, after a restart or when the time window begins, nothing happens until it has been unmet in between.
- Timer, trigger: time window ("Only in a time window", for example 22:00 to 06:00, also across midnight). The window applies only to the start: outside it nothing happens, and a condition met outside the window is not postponed.
- Timer, trigger: minimum pause after a switch (1, 5, 15 or 60 min, default 1 min) and the switch "Trigger only once" (default off; afterwards the timer turns itself off).
- Timer, new page "Switch back" (replaces the switching-back controls of the page "What"): "Never", "After a duration", "At a time" or "By a trigger", each with "Turn off" or "As before". The return trigger counts only when it is newly met and has the same conditions and "Holds for at least" as the start. As a safety net, "At the latest after" (30 min to 6 h) switches back even if the trigger never comes. Start and end can be combined freely: for example on at 20:00 and off when the rain sensor is dry, or on by a trigger and off at a time.
- Timer, lists and summary: a timer with a trigger shows the sentence and "waits for trigger" instead of the next run, with a bolt badge in the lists; the log and the push name the reason ("skipped: outside the time window", "skipped: pause", "skipped: switching back still waiting").
- Protection: the switched entity cannot be its own trigger (also not in the return trigger).

### Changed

- Timer assistant: the pages are now What, Options (only if available), When, Switch back (only for actions with an opposite), Message and Name; the switching-back controls moved from "What" to the new page. Existing timers keep their behaviour unchanged.

## [2.53.0] - 2026-10-15

AI assessment: the AI area is set apart from the rest of the device pop-up.

### Changed

- Device pop-up, AI assessment: everything that comes from the AI (the button, the assessment, the follow-up questions with their suggestions and text field) now stands in one frame with a coloured header "AI assessment" and, once there is an assessment, the source (for example "Google AI Task") on the right. Inside, the assessment and the follow-up questions are separated by a dashed line, and below the frame "Connection" and "Device" begin clearly. Before, assessment, chat and the sections below flowed into each other, so it was hard to see what belongs to the AI and what does not. The line "Created 10:41 · Create again" under the assessment now shows only the time, since the source is in the header. The note about what is sent stays inside the frame.

## [2.52.1] - 2026-10-15

Timer: hidden entities can be switched too.

### Fixed

- Timer: hidden entities can now be switched too. Before, the timer assistant left out every entity Home Assistant marks as "hidden", so a device whose only light is hidden (for example single Hue lamps of a group, which Hue hides) showed "This device has no entity a timer can switch". Hidden only means that Home Assistant does not show the entity in automatic dashboards; it can be switched like any other. Disabled entities stay excluded, because they have no state. The same goes for the device list in "Add timer" of the window of all timers.

## [2.52.0] - 2026-10-15

Timers: switching options (brightness, colour, position, temperature, volume, speed) and switching back "as before".

### Added

- Timer, new page "Options" after "What to switch": if the chosen entity can be set when it is turned on, the assistant shows a page of its own with a preview and one control per setting. Light: brightness, colour temperature (with "Warm", "Neutral", "Cold") and colour (eight colours and a free colour from the browser's colour picker); shutter or blind: position (0 to 100 %); climate: target temperature (within the limits and step of the device) and mode (heat, cool, auto and so on, as far as the device has them); media player: volume; fan: speed. The preview shows the lamp in the chosen colour and brightness, the shutter at its position, the target temperature, and so on; nothing is switched by it. Every setting also has "As last used": without a setting everything stays as before, so the default does not change and a timer that sets nothing behaves exactly as it did. The page only exists for "Turn on" (for shutters "Open") and only if the entity offers settings; for other entities the assistant has the same four steps as before. Settings that exclude each other (colour temperature and colour) are cleared against each other.
- Timer, "Then back to" (appears as soon as switching back is set): "Turn off" (so far the only way, the opposite of the action) or "As before". With "As before" the timer remembers the scene of the entity right before it switches (on or off, brightness and colour of a lamp, position of a shutter, mode and target temperature of a climate device, volume of a media player, speed of a fan) and sets it again after the time, for example "the lamp briefly brighter and then as it was". If the entity was off, it is turned off again; if it was already on, it stays on. The scene is stored and survives a restart. If a timer switches again while its switching back is still waiting, the first scene stays (the lamp does not "return" to the state the timer itself set). If a scene cannot be restored (the state was unknown), the timer falls back to the opposite. The log and the push say "as before".
- Timers can now also switch climate devices (turn on, turn off, toggle) and media players (the same), and thus also set them. Only what the device can do is offered: "Turn on" and "Turn off" for a device that supports it, and "Turn on" also for a device that cannot be turned on but can be set (a speaker with volume). Between two calls of one switching (turn on, then temperature or volume) the timer waits one second so that the device is ready for the second.

### Changed

- Timer, "Run now" in the assistant uses the chosen settings and therefore switches with exactly the chosen strength; so you can check on the spot how it really looks. As before it switches back nothing and saves no timer.
- Timer, the sentence in the assistant, the summary and the lists names the settings: "Hue Lamp turn on (50 %, warm white (2700 K)), back as before after 10 min." For shutters with a position: "Rollo move to 50 %".
- Battery forecast: durations of a year or more are shown in years and months instead of a decimal number: "Lasts about 2 years 11 months" instead of "2.9 years" (also in the range, for example "Range 2 years 10 months to 2 years 11 months"). Below a year it stays months, below 45 days days.
- Timer assistant: the step display counts the pages that exist (with a page "Options" "Step 3 of 6", without it "Step 3 of 5" from the window of all timers).

## [2.51.0] - 2026-10-15

AI assessment: the suggested follow-up questions come from the AI.

Includes the changes from 2.50.0.

### Changed

- AI assessment, follow-up questions: the pills above the text field are no longer always the same. The AI itself suggests up to three follow-up questions that fit the device and its last answer, for example "Does the router restart at night?" or "How old is the battery?". It adds them as a last line to the same answer (no extra call, no extra cost); the panel cuts the line off and shows it as pills. After every answer there are new suggestions, questions that were asked disappear. The suggestions are kept with the last assessment, also across restarts. This works with a prompt you edited yourself too, because the request for the line is added by the panel and is not part of the prompt; the preview in expert mode shows it. If the AI sends no suggestions (or the line is damaged), the former fixed questions stay as a fallback.

## [2.50.0] - 2026-10-15

Not released; included in 2.51.0.

Signal window: receiver names without addresses, hint for a distant receiver.

### Added

- Signal window, section "Connected via": if the device was received through a receiver for at least 10 % of the time whose average signal was at least 10 dBm weaker than that of the main receiver, a short hint says so, for example "Through "Storen Küche" the device was received 13 % of the time, on average -97 dBm: 20 dBm weaker than through "Shelly Eingang EG Aussen" (avg -77 dBm). That can explain the dips in the chart." (at most two hints). The panel cannot change this: Home Assistant picks the receiver, and the panel does not change other integrations. It helps to bring a closer proxy or to keep the distant one from reaching the device.

### Changed

- Receiver names are shown without Bluetooth addresses: Home Assistant often names a proxy "Name (E4:B3:23:17:F5:3A)", which made the lines in the legend, in the list of changes and in "Connected via" long. If two receivers have the same name, the address stays for them, so that they can still be told apart. The stored names stay unchanged.

## [2.49.0] - 2026-10-15

Live activity while charging: estimated finish time.

Includes the changes from 2.48.1.

### Added

- Live activity (iPhone) and live update (Android 16) while charging: as soon as the estimate is reliable, the text starts with "done around 14:35" (after midnight "done tomorrow around 02:10"), followed by the level ("done around 14:35 · 62 % of 100 %"). The time appears with the next regular update (at most every 4 minutes, as before), there is no extra push and no setting for it. The panel estimates it from the measurements of the running charge: the speed over the last 30 minutes, and only once at least 5 minutes and 3 points of rise are measured, so the start shows no time yet. A battery charges more slowly towards the end, so below 80 % the remaining part above 80 % counts twice as long (a rough assumption, not yet learned from earlier charges of the device). The time is rounded to 5 minutes; nothing is shown if the charge stands still or the estimate would be more than 12 hours away. The log (debug) records each estimate with speed, measuring time and result.

### Fixed

- Signal window, section "Connected via": the colour bar now lies exactly under the chart above, on the same width and with the same time marks (12:00, 15:00 … now). Before, the bar ran across the whole width while the chart starts after its axis, so a time in the chart and the same time in the bar were not above each other and you could not read from the chart which receiver the device was connected to. Without a chart above (no measurements, for example for a device that is offline) the bar keeps the whole width. With a young recording the bar starts at the beginning of the recording: the time before it stays empty on the left and "now" is always at the far right, so the bar grows from the right instead of from the left (before, it ran from the left edge and left the empty rest on the right, which was confusing at the start).
- App launcher: the favorites no longer have a blue border. All tiles look the same; the heart and the section "Favorites" already show which are favorites.

## [2.48.1] - 2026-10-15

Not released; included in 2.49.0.

### Fixed

- AI assessment and follow-up questions: when the provider is temporarily overloaded (for example Google "503 UNAVAILABLE, This model is currently experiencing high demand"), the panel now tries again up to two more times, after 5 and 15 seconds, before it reports an error. Such errors usually pass within seconds, and before, the first one ended the assessment. Each new try is written to the log (Info). Errors that a new try cannot fix, such as an exceeded quota (429) or a wrong key, are still reported at once.

## [2.48.0] - 2026-10-15

AI assessment: follow-up questions.

Includes the changes from 2.46.1 and 2.47.0.

### Added

- AI assessment: under an assessment in the device pop-up there is now a section "Ask a follow-up". Above, suggested questions as pills (for example "What should I check first?", "Is it the battery?" only for a device with a battery, "Is there a pattern in the outages?" only after outages, "Is the signal the problem?" only with a signal reading, "How sure is this assessment?"); below, a text field for your own question (Enter or the arrow sends it, at most 200 characters). The answer appears as a conversation under the assessment, the question on the right, the answer on the left. The AI gets the same details as for the assessment, its own earlier assessment, the earlier questions of this assessment and the new question, and is told to answer briefly (2 to 4 sentences), only from the facts, and to treat the question as data and not as an instruction. There are at most three follow-up questions per assessment (each is one call of the AI task); "Create again" starts a new assessment with three new questions. A question you typed stays in the field when the pop-up is rebuilt, and after an error it comes back into the field. The conversation lives in the panel and is gone when the page is reloaded, the assessment itself stays as before. The log (debug) records each follow-up, a failure is logged like one of an assessment.

## [2.47.0] - 2026-10-15

Not released; included in 2.48.0.

Log: the entries survive a restart of Home Assistant.

Includes the changes from 2.46.1.

### Changed

- Log: the last 500 entries, debug entries included, are now kept across restarts of Home Assistant. Before, they lived in memory only and were gone after every restart, so the history that explains a problem was missing right when it was needed. The limit stays at 500 entries (the newest ones). The entries are written to the integration's small log file, delayed and at most every 30 seconds (and when Home Assistant stops); "Clear" empties the stored entries too, and removing the integration deletes them. The window says "kept across restarts" instead of "in memory only", and "since" names the start of the kept history.

## [2.46.1] - 2026-10-15

Not released; included in 2.47.0.

### Changed

- Device pop-up, tab "Settings": when a device has only the outage settings and the tab bar is therefore omitted, a title "Outage" now stands above them, so it is clear at first glance what the settings belong to. With a tab bar there is no title.

## [2.46.0] - 2026-10-14

Device pop-up: tabs without content are hidden.

Includes the changes from 2.45.0.

### Changed

- Device pop-up, tab "Settings": the sub-tabs Battery, Charging and Signal only appear when the device has something to show. A device without a battery level (a presence sensor on mains power, for example) no longer has the tabs "Battery" and "Charging" that only said "This device does not report a battery level."; a device without a signal reading has no tab "Signal". The tab "Outage" always stays. If only "Outage" is left, the tab bar is omitted.

## [2.45.0] - 2026-10-14

Not released; included in 2.46.0.

AI assessment: shorter prompts, more context, the last answer flows in, measurement errors are marked.

### Added

- AI assessment: the panel remembers the last assessment of every device (kept across restarts, at most 150 devices, 30 days). The pop-up shows it again when you open the device, without asking the AI, and the next assessment gets it as the fact `previous_assessment` (how long ago, headline, text, status back then). The default prompt tells the AI to check what has changed since and not to repeat itself blindly. A prompt you edited yourself can use it through the new group `{facts_previous}` or `{facts}`. The remembered texts are deleted when the integration is removed.
- AI assessment: more context where there is data: `integration_problem` (the integration is not running: setup_retry, setup_error and similar, which alone explains an outage), `entities` (how many entities of the device exist and how many are unavailable), `home_assistant_started_minutes_ago` (an outage right after a restart often belongs to the restart) and `battery_sensor_glitches_7d` (how often the battery sensor reported an impossible value that the panel discarded; the AI is told not to read it as a real drop and to call such a sensor unreliable).

### Changed

- AI assessment: the whole instruction is limited to 18000 characters (about 4500 tokens). Longer facts are trimmed from the least important end: the lists of other devices in the area, of offline devices of the integration and of the hub, then the months of the battery history; everything about the device itself stays. The log (category System) says what was trimmed.

## [2.44.0] - 2026-10-14

AI assessment: devices that are charged are recognised.

### Added

- AI assessment: the AI now knows whether a device is charged or runs on replaceable batteries. New facts `battery_kind` ("rechargeable" or "probably_rechargeable") with `battery_kind_reason`, and `charging_now` (since when, from which level). The panel derives it from evidence: a charging indicator of the device or a set-up charging notification, a charge that is running right now, a device type that is always charged (robot vacuum, phone), or three or more rises of the level in the history. Where the panel cannot tell, the fact is missing and the prompt tells the AI to decide from type, manufacturer and model. Before, a robot vacuum was assessed like a sensor with a battery ("the battery is stable, the forecast is uncertain").
- AI assessment: for a rechargeable device the battery forecast ("days until the warning threshold") is left out, and the default prompt tells the AI to talk about charging habits (how often it was charged, whether it is charging now) instead of battery life or a battery change; a low level only means it needs charging.

### Changed

- AI assessment: the longest allowed prompt is now 12000 characters instead of 6000 (settings, expert mode). The default prompt had grown beyond 6000 and could no longer be saved after copying it.

## [2.43.0] - 2026-10-14

Battery: measurement errors are caught by themselves, and the log keeps only what is new.

### Changed

- Battery level: an implausibly fast drop is held until it is confirmed, without any setting. Some sensors report an impossible value in between (76 % - 2 % - 68 % within minutes); that triggered "Battery low" and made a device look like it was charging. The panel now looks at how fast the level fell, not at the value: a drop counts as suspicious only if it is at least 25 points and larger than a battery can physically lose in the time since the last report (2 points per minute plus 10). A vacuum cleaner that loses a point per minute, or a sensor that reports once an hour, is therefore never held. A held level is confirmed by another matching report at least 10 minutes later, or when it stays unchanged for 30 minutes; if the level returns first, the reading is discarded as a measurement error. Rises are never filtered (charging and battery changes are real). The list, the battery warning, the charging detection and the facts for the AI use the trusted level; each decision is written to the log (category Battery).
- Battery history: such dips that come back within an hour no longer appear in the chart, the forecast and the AI facts (the long-term statistics smooth them already).
- Log: the debug line "Charging" is only written when the level of a device changes. A reconnection of Matter or Eve devices reports many devices at once with the same value and filled the log with identical lines (and pushed out the entries that matter). Everything else stays as detailed as before.

## [2.42.0] - 2026-10-14

Not released; included in 2.43.0.

AI assessment: the reason of a failure is visible, and the AI gets more facts.

### Added

- AI assessment: when the AI task reports an error, the pop-up now shows its message under the explanation ("Message of the AI task: ..."), and the log (Settings, log) gets a warning with the reason, the size of the prompt and the AI task. Before, the panel only said "The AI task reported an error", and the reason stood only in the Home Assistant log. A successful run writes a debug line with prompt size, answer size and duration.
- AI assessment: new facts, each only where there is data: `recent_outages_7d` (the latest outages of the week with how long ago, duration, local start time and weekday, which shows patterns such as "every night at 3"), `signal.last_24h` and `signal.last_7d` (median, worst and best signal from the panel's own recording) and `bluetooth_receivers_24h` (the receivers that heard a Bluetooth device in the last 24 hours with share and average signal, how often it switched, and whether there were gaps). The default prompt explains them; a prompt you edited yourself keeps its text and can use the new facts through the groups `{facts_history}` and `{facts_signal}` or `{facts}`.

### Changed

- AI assessment: an empty answer of the AI task (for example from a reasoning model that uses up its output while thinking) gets a second try; if it is empty again, a clear message names the likely remedy (another model or more output tokens) instead of the general error.

### Fixed

- AI assessment: Bluetooth addresses no longer reach the AI. Home Assistant often names a Bluetooth proxy "Name (B0:A7:32:46:E3:C2)", and that name went into the facts as "connected via" although no addresses are meant to be sent. The address is removed before.

## [2.41.2] - 2026-10-14

Bluetooth: value and receiver from the same source.

### Changed

- Bluetooth devices now show the live signal of Bluetooth (the best reception over all receivers, as in Settings, Bluetooth, Advertisements) instead of the value of their own signal sensor. Reason: sensors such as the SwitchBot "Bluetooth signal" read the receiver that can control the device, not the best one. That contradicted the receiver shown ("via Garage proxy") and could trigger "Weak signal" although a proxy hears the device well. The sensor stays as a fallback while Bluetooth reports nothing. The signal history of these devices now comes from the panel's own recording instead of the recorder and starts empty with this update (24 hours fill within minutes, 30 days over time); the earlier recorder values are no longer shown.

## [2.40.1] - 2026-10-14

Bluetooth: the receiver is also shown for devices whose signal comes from a sensor.

### Fixed

- Bluetooth devices that have their own signal sensor (for example SwitchBot "Bluetooth signal") showed no receiver in the list ("via Office blinds") and no section "Connected via" in the signal window, although Home Assistant knows the receiver (Settings, Bluetooth, Advertisements). The panel only asked Bluetooth when a device had no signal sensor. Now the receiver is read for every Bluetooth device; the signal value itself still comes from the sensor, as before. The panel records the path of such devices from this update on, the section "Connected via" fills over time (without average signal, since the sensor values come from the recorder).

## [2.40.0] - 2026-10-14

Signal: the path of Bluetooth reception ("Connected via").

### Added

- Signal window of a Bluetooth device: new section "Connected via" under the history, for 24 h, 7 days and 30 days. A bar shows which receiver (Bluetooth adapter of Home Assistant or a Bluetooth proxy, for example "Living room proxy") the device was heard through, one colour per receiver; gaps where the device was not received are hatched. Below it a legend lists each receiver with its share of the time and its average signal ("60 % · avg -74 dBm"), and the list "Changes" names the latest switches ("Kitchen → Office blinds") with their time. The panel notes the receiver every minute together with the signal and keeps it for 31 days in its own file. It only shows what the panel recorded itself, since this update: an earlier path cannot be reconstructed, and the window says so. Devices without a Bluetooth receiver (Zigbee, Wi-Fi and so on) and Bluetooth devices without a recorded path show nothing new. Per receiver the name is the one Home Assistant gives the scanner; the colours stay the same per device in the order the receivers first appeared.

## [2.39.1] - 2026-10-14

Not released; included in 2.40.0.

Start page: like all other settings.

### Changed

- Settings, "Start page": the switch "Set as my start page" no longer applies at once but, like all other settings, only with "Save" (it shows the label "changed", counts as a change, and closing without saving asks "Discard changes?"). Switching it on remembers your previous start page of Home Assistant; switching it off and saving brings that one back. Without a previous start page the entry is removed and the default of Home Assistant applies again.

## [2.39.0] - 2026-10-14

Start page: the panel as your start page of Home Assistant.

### Added

- Settings, new area "Start page" at the very top of the section "View" (above the filter chips): the switch "Set as my start page" makes this panel the page Home Assistant opens at startup, in the browser and in the Companion app. It applies at once (no "Save"), only for your account, and writes `default_panel` into your user data of Home Assistant without touching the other values there. Switching it off removes it, then the default of Home Assistant applies again. The profile page of Home Assistant cannot do this, its choice only lists built-in pages and dashboards, not the panel of an integration. The section summary then reads "Your start page". Errors are shown under the switch.

### Changed

- The settings section "Appearance" (German "Darstellung") is now called "View" (German "Ansicht").

## [2.38.0] - 2026-10-14

AI assessment: link to the AI settings of Home Assistant, and only with an AI task.

### Added

- Settings, "AI assessment": a link "Open AI suggestions in Home Assistant" leads to the AI settings of Home Assistant (`/config/ai`, where the AI task for "Data generation tasks" is chosen).

### Changed

- The switch "Show the button "Assess with AI"" can only be switched on if there is an AI task: one chosen in Home Assistant under "AI suggestions" for "Data generation tasks" (or one chosen here that still exists). Without it the switch is locked and a message says why and what to do: "No AI task selected. In Home Assistant, under "AI suggestions", choose an AI task entity for "Data generation tasks". Only then can the AI assessment be switched on here." The server checks this too, so a request that bypasses the panel is refused with the same message. If the function is already on and the AI task disappears, it stays on, with a note, and other settings can still be saved.
- The hints on the AI task now point to "AI suggestions" instead of "Settings → System → General".
- Settings, version bar with active automatic updates (2.37.0): instead of the badge with the circling ring on the symbol, a small pill "Auto" stands after the title (like the pill "Beta"). The symbol stays the plain green check, nothing moves any more (the ring was too restless and did not turn on every device). The subtitle no longer says "automatic"; the pill says it (hovering it reads "Updates are installed automatically"). Same conditions as before: switch and daily check on, only at "Up to date".

## [2.37.0] - 2026-10-14

A sign that automatic updates are active.

### Added

- Settings, version bar: while "Install updates automatically" is really working (switch on and daily check on, as saved), the symbol of the bar ("Up to date") carries a small badge with circling arrows and a slowly circling green ring, and the subtitle reads "Up to date · automatic". Hovering the badge says "Updates are installed automatically". The ring stands still if "reduce motion" is set on the device. Only in the settings (the gear in the header is unchanged, it keeps the red dot for a pending restart). A found update is installed at once with automatic updates, so the line "Update available" stays without the sign.

## [2.36.0] - 2026-10-14

Not released; included in 2.37.0.

Search field: no longer as wide as the whole window.

### Changed

- Desktop (from 1101 px): the search field no longer stretches to the buttons at the far right but ends exactly with the tile "Offline right now" below it, so the cross to clear it is easy to reach. The buttons stay at the right edge. If there is not enough room (for example five favorites in a window of about 1100 px), the field gives way and gets narrower; nothing overflows. Narrower windows and the phone are unchanged (the field fills the rest).

## [2.35.1] - 2026-10-14

Not released; included in 2.36.0.

The logos of the integrations come back by themselves.

### Fixed

- Device list: sometimes all integration logos were missing after opening the app (the icon of the connection type was shown instead) until the Companion app was restarted. Causes: if the first request for the access token of the logo service failed (for example because the connection was lost while the app woke up), it was never repeated; a logo whose image failed to load once stayed marked as "no logo" for the whole session; and after waking up an old token was not renewed (the timers rest in the background). Now the request is repeated with growing intervals, a failed logo is tried again after 5 minutes and with every new token, and an old token is renewed when the app wakes up. A Home Assistant without the logo service (before 2026.3) is still asked only once.

## [2.35.0] - 2026-10-13

App launcher: the symbols and colors of Home Assistant.

### Changed

- App launcher: the apps of Home Assistant show the same symbol and color as the page they open in the settings of Home Assistant, taken from the frontend of Home Assistant itself: a circle in the color of the page with a white symbol. Automations, scenes and scripts are green, helpers purple, devices, entities, integrations and areas indigo, tools violet, backups blue; history and logbook have no color in Home Assistant, so they get a color from its palette. The apps of the Device Panel (timer, Magic Push, log) keep their symbol and get a color of the same palette; your own apps get the main color, and a favicon stays as it is, without a circle.
- The buttons of the favorites in the header show the same symbol as the launcher, without a color.

## [2.34.0] - 2026-10-13

Not released; included in 2.35.0.

App launcher: custom apps are created only in edit mode.

### Changed

- App launcher, normal view: the tile "Custom app" (plus) is gone, and so is the heading "Custom" when there is nothing to show under it. A custom app is created in edit mode ("Edit", then "Add custom app"). The heading comes back as soon as a custom app is there that is not a favorite (a favorite appears only under "Favorites"; if your only custom app is a favorite, there is no "Custom" section).

## [2.33.1] - 2026-10-13

Not released; included in 2.35.0.

Favicon in its original colors, launcher list with titles only, no more "Start again" in timers.

### Fixed

- Favicon of a custom app: it appeared tinted blue and, if dark (for example GitHub), barely visible on the dark background, because it sat on the blue circle of the icons. It now keeps its original colors on a light rounded tile, without the blue circle, in the launcher (grid and list), in edit mode, in the preview and in the button of the header.

### Changed

- Launcher, list view: each row shows only the title, no longer the path or address below it (the edit mode still shows them; the search still finds apps by path).

### Removed

- Timers: the button "Start again" in the device popup and in the window with all timers is gone. It did the same as the switch of the timer (switch on again), which every card already has.

## [2.33.0] - 2026-10-13

App launcher: favicon for custom apps with an external link.

### Added

- Custom apps with an external link can use the favicon of the site instead of an icon. In the form a switch "Icon | Favicon" (the favicon only with "External link" on) and the button "Load favicon" (only with a valid https:// or http:// address). Home Assistant fetches the icon, not the browser: it reads the site for `<link rel="icon">`, otherwise takes `/favicon.ico`. This also works with http:// and with devices in the home network (a router), and the browser loads nothing from the foreign site when the launcher opens. Limits: 5 seconds per request, 100 KB, only images (PNG, ICO, GIF, JPEG, WebP, SVG, recognised by content); no cookies or credentials are sent, and the certificate is not checked so that devices with their own certificate work. The command is for administrators only.
- The favicon is saved as a small image in the user data of Home Assistant with the app and replaces the icon everywhere: launcher (grid and list), edit mode, preview and the button in the header. Switching back to "Icon" removes it. Messages explain why no favicon was found (none, too large, not reachable).

### Changed

- Form "Custom app": the order is now name, external link, address, image (icon or favicon), so that the favicon is released before you reach it.
- Battery window and AI assessment: a device counts as one that is charged (not fitted with new batteries) not only with the charge notification switched on, but also when it has a charging indicator of its own (a binary sensor of the class "battery charging" or the battery state of the companion app). A rise of the level is then called a charge ("Charge", "Charged", "since the charge on …") even without the charge notification. Devices with neither keep "Change", because the panel cannot tell a charge from new batteries there.

## [2.32.0] - 2026-10-13

Not released; included in 2.33.0.

Debug mode across restarts, AI assessment calls a charge a charge.

### Changed

- Log, debug mode: the switch now stays on for 48 hours, also across restarts of Home Assistant, and then switches itself off (an entry in the log says so). Next to the switch the window always shows "48 h" and, while it is on, until when it runs. After a restart an entry notes that the mode was switched on again. Switching it off by hand ends it at once. The entries of the log themselves are still only kept in memory and are lost on a restart.
- AI assessment: if the charge notification is active for the device, a rise of the level in the battery history of the last 12 months is given to the AI as a charge ("battery_charges", "recent_charges") and no longer as a battery change; the default prompt tells it to call such a rise a charge. Devices without the charge notification keep the battery changes.

### Fixed

- Timers: a one-time timer ("In …" or "Once") that has run is switched off, and editing it no longer switches it on again by itself: the switch "Active" in the wizard stays off, and "Save" keeps it off. It has to be switched on by hand again (switch in the wizard or switch in the list). A timer that has not run yet stays on when edited. Until now editing a finished timer silently re-armed it.

## [2.31.1] - 2026-10-13

Not released; included in 2.33.0.

App launcher: calmer normal view, more space in the header.

### Changed

- Launcher, normal view: no hearts on the apps any more, only one heart next to the heading "Favorites". Favorites are set in edit mode. The dashed line with the phone hint is shown only in edit mode, and the first favorite is no longer larger than the others.
- A favorite appears only in the section "Favorites", not a second time in its group (the search still finds every app).
- The launcher keeps its height while you type in the search.
- Phone: more space between the buttons in the header (the search field is a little narrower).

## [2.31.0] - 2026-10-13

App launcher: useful pages one tap away, favorites in the header, your own links.

### Added

- App launcher: a button in the header (grid icon) opens a launcher with apps in three groups. Device Panel: Timer (the overview of all timers), Magic Push (the settings at the Magic Push tab) and the log. Home Assistant: automations, scenes, scripts, helpers, devices, entities, integrations, tools, areas, history, logbook and backups (the management pages only for administrators). Custom: your own links. A search field filters the apps.
- Favorites: the heart on an app puts it as a button into the header, in its place the stopwatch button of the timers is now just the first favorite (the default). Up to five favorites; on the desktop all of them stand in the header, on the phone only the first one. In the launcher a dashed line marks this border (vertical in the grid, horizontal in the list). The gear stays at the far right.
- Edit mode: drag the handle (or the arrow keys on it) to sort, in every group; the eye hides an app (a hidden app is no longer a favorite), the heart sets favorites, "Reset to default" restores selection, order and hidden apps (with "Undo"). The log cannot be hidden, it is the only way to the debug mode. A switch "Grid | List" chooses the view, separately for the desktop and the phone.
- Custom apps: name, icon and target. Without the check box "External link" the target is a page of Home Assistant (starts with "/"), otherwise an address with https:// or http://, which always opens in a new browser tab (`noopener noreferrer`, Home Assistant stays open); other schemes such as javascript: are rejected. External links carry a small link mark. Custom apps can be edited, deleted (with "Undo") and made favorites.
- Everything is saved per user in the user data of Home Assistant (with a local copy in the browser, the newer state wins), like the hearts of devices and timers.

### Changed

- The log button moved from the header of the settings into the launcher (app "Log"). The stopwatch button in the header is now the favorite "Timer" and can be removed from there.
- The label of the timer button reads "Timer" (before "All timers").
## [2.30.0] - 2026-10-13

Not released; included in 2.31.0.

Battery history: a charge is called a charge.

### Changed

- Battery history window: if the charge notification is active for the device, a rise of the level is no longer called a "change" of the battery but a charge: the mark in the chart reads "Charge", the list "Charged", and the texts say "since the charge on …" (also in the forecast). Devices without the charge notification keep "Change".

## [2.29.1] - 2026-10-13

Not released; included in 2.31.0.

Slimmer scrollbars without arrows.

### Fixed

- Scrollbars on the desktop: the classic bar with arrows lay in the rounded corners of the pop-ups and the arrows were cut off. The bars are now slim, without arrows, and keep a distance from the corners. In the pop-ups and in all lists with their own scrollbar.

## [2.29.0] - 2026-10-13

More in the debug log.

### Added

- Log, debug mode: more intermediate steps are recorded while the switch is on. Outage: a device is detected as offline (with the waiting time before the notification), an outage that began before a gap, the return of a device (with or without notification), a device that is no longer monitored. Battery: one summary per check (devices checked, low, new), only when the numbers change. Timers: the planned next run or switch-back. System: which settings were saved (only the names, never the values), device settings and device type set by hand, and the unloading of the integration. Nothing is recorded with the switch off.

## [2.28.5] - 2026-10-13

Larger pop-ups on the desktop, rounded corners, same size for settings, device, timers and log.

### Changed

- Desktop: the large windows (device pop-up, settings, window with all timers, log) now have the same size, 880 px wide, and are up to 1100 px high instead of 780 px, as far as the screen allows. The statistics, pulse and notes windows are higher as well. On the phone nothing changes.

### Fixed

- Settings, device pop-up and other pop-ups with their own scrollbar: the right corners were square where the scrollbar lay over the rounding. The pop-ups are now clipped to their rounded shape, so the scrollbar stays inside the corners.

## [2.28.4] - 2026-10-13

Not released; included in 2.28.5.

Window with all timers as wide as the settings.

### Changed

- Window with all timers: on the desktop it now has the same size as the settings and the device pop-up (640 px wide instead of 860 px).

## [2.28.3] - 2026-10-13

Window with all timers as a pop-up on the desktop.

### Changed

- Window with all timers: on the desktop it is now a pop-up like the log (centred, rounded, with the page dimmed behind it) instead of filling the whole page. On the phone (up to 700 px) it stays full screen. The note at the top now also mentions the plus button.

## [2.28.2] - 2026-10-13

Timer assistant: "Run now" is a proper button.

### Changed

- Timer assistant: "Run now" is no longer a small text link but a button with an outline, 44 px high and with larger text, so it is easy to hit on a touch screen. The message ("Done.") stands next to it.

### Fixed

- Log: the log and the debug mode are now kept when the integration is reloaded (they are only lost when Home Assistant restarts or the integration is removed). Note: saving settings never reloaded the integration; the log is emptied by a restart of Home Assistant.

## [2.28.1] - 2026-10-13

Timer assistant: the state shown updates after "Run now".

### Fixed

- Timer assistant, step "What to switch": after "Run now" the card kept showing the old state ("on" although it had just been switched off). The states are now fetched again after switching.

## [2.28.0] - 2026-10-13

Test button in the timer assistant.

### Added

- Timer assistant, step "What to switch": a "Run now" button under the result line switches the chosen entity with the chosen action immediately, as a test. Nothing is saved, there is no switching back, no push and no log entry. A short message says whether it worked or why not (for example "The device is unreachable").

### Changed

- Sidebar icon: a house with bars ("home-analytics") instead of the two-devices symbol, which looked like phones. Home Assistant may show the old icon until the page is reloaded.

## [2.27.1] - 2026-10-13

Settings: the close button is on the right.

### Changed

- Settings: "Close" (with open changes "Cancel") now sits on the right and "Save" on the left, so the closing button is always on the same side as in the pop-ups.

## [2.27.0] - 2026-10-13

Add a timer straight from the window with all timers.

### Added

- Window with all timers: a "+" button in the header (between the title and the cross) starts the timer assistant. It is the same assistant as on a device, with one extra first step on its own page: you choose the device first (search by name, area or integration; only devices with something a timer can switch are listed). After that everything works as usual, and the progress bar shows five steps. Saving or closing returns to the list of all timers.

## [2.26.0] - 2026-10-12

Favorite timers (heart), and the title in the header only disappears on the phone.

### Added

- Window with all timers: a heart right of "Delete" on every timer card marks a favorite timer. As soon as there is at least one favorite, the filter bar gets a fifth tab with a heart (and the count), showing only the favorites with their devices expanded, and the window always opens on that tab. When the last favorite is removed, the tab disappears. The hearts belong to the user (stored in the Home Assistant user data like the favorite devices, so they follow you to other devices).

### Changed

- Timer assistant: with "switch back afterwards" the preview now shows exactly when it switches back, to the minute: under each next run ("back off: tomorrow 06:50") and in the last step under "Next run". Calculated by Home Assistant with its time zone.
- The title "Devices" in the header is visible again on wide screens (from 700 px); on the phone it stays gone, as in 2.25.0. The timer button stays centred on both.
- Timer durations are shown exactly, down to the second, instead of being rounded: 690 minutes now read "11 h 30 min" (before "11 h"), 90 seconds "1 min 30 s". This applies to the result line of the assistant, the sentence of a timer, and the range messages.

### Fixed

- Window with all timers: a timer that has switched and is waiting to switch back ("switch back afterwards") now counts as running: it appears under the tab "Running" (and counts there), and its card says when it switches back ("back off: today 06:30"). Before, only countdown timers were "running".
- Window with all timers on iPhone: the intro text above the search field changed its size depending on the list (larger and three lines with an empty list), which moved the search field and the tab bar. The panel now turns off the automatic text enlargement of iOS, so the text and the tab bar keep the same size and height on every tab.
- Window with all timers: after typing a search, the cross in the search field could leave the old hits on screen (the list was not redrawn when it looked unchanged). Fixed; it also applies after expanding or collapsing devices.

## [2.25.0] - 2026-10-12

Panel updates (time of the daily check, push notification, red dot while a restart is pending) and a leaner header without the title.

### Changed

- The visible title "Devices" above the list is gone (the application is already called "Device Panel"); the logo stays and the search field takes over the space. The title remains for screen readers.

### Added

- A small red dot on the gear button as long as a panel update is installed and the restart is still pending (HACS has the new version on disk while the old one runs). It disappears after the restart; its label says "restart pending".
- Settings › Panel updates › "Time of the check": the daily check runs at a time you choose (Home Assistant's time). Empty, the default, stays as before: at a random time after Home Assistant starts, then every 24 hours. "Automatic" resets it.
- Settings › Panel updates › "Notify by push": a push notification once per version. Without automatic installation it says that a new version is available; with automatic installation it says, after installing, that the version is installed and the restart is pending (if the installation fails, the "available" notification is sent instead). The recipient (group, service or entity) can be chosen in a row below; default is the push target of the Overview. Tapping the notification opens the panel. Only with the daily check turned on.

## [2.24.1] - 2026-10-12

### Added

- The window with all timers (stopwatch button) now also has "Delete", with the same confirmation as in the device tab. It still has no "Run now" and no way to create timers.

### Changed

- The stopwatch button in the header sits exactly in the middle between its left neighbour (search field, on wide screens the "View" button) and the gear: the same distance on both sides (15 px on the phone, where the search field stays as wide as before; 22 px on wide screens).
- On the phone the device pop-up now also opens full screen, like the settings and the view sheet. There is no background left to tap, the cross and "Close" close it.

## [2.24.0] - 2026-10-12

Settings and the view sheet open full screen on the phone, the cards' actions are easier to hit, and the timer assistant can save on every page.

### Added

- Timer assistant: a "Save" button on every page (between "Back" and "Next"), enabled as soon as all steps are valid. Changing only the time of an existing timer no longer needs a click through all four steps: change, save, the window closes. On the last page the usual "Save" stays.

### Changed

- On the phone the settings and the sheet "View" (sort and display) now fill the whole screen (like the window of all timers) instead of a sheet that leaves a strip of the list visible at the top. There is no background left to tap, the cross closes them.
- On the phone the actions on the cards of the timer and Magic Push overviews ("Edit", "Delete", "Open device") are easier to hit: larger text, 44 px tall touch areas and a bit more space between them. On wide screens nothing changes.

## [2.23.1] - 2026-10-12

Automatic updates install as soon as a version is found.

### Fixed

- "Install updates automatically" now starts the installation as soon as any check finds a newer version, as intended. Before,
  it only ran after the daily check and, in the panel, only on "Check for updates", so opening the settings showed
  "Version available" without installing. Now every detection triggers it: the check after the start of Home Assistant,
  the daily check, opening the settings and "Check for updates". In the panel this is tried once per version and session
  (a failed attempt is not repeated in a loop; "Check for updates" tries again).
- Before the installation the integration asks HACS to reload the versions of this repository (as the panel does). HACS
  itself only checks every few hours and often did not know a fresh release yet, so the installation did not start.
  This uses internals of HACS on a best-effort basis; without them it falls back to refreshing the update entity. If HACS
  does not know the new version yet, this is noted in the log (debug mode) and tried again at the next check.
- Home Assistant is still never restarted by itself.

### Added

- Settings › Timer has a new row "Recipient" (like on the tabs of Monitoring and notifications): the group, service or entity that receives the notifications of all timers (failure message and "Report by push"). Default is the push target of the Overview, as before. A recipient set on a single timer still takes precedence; the assistant shows the effective default.

### Changed

- The log button moved from the header of the device list to the header of the settings dialog, left of the cross, which
  gives the header room again (it got crowded with the timer button). The log still opens as before, on top of the
  settings.
- The collection of all timers is removed from Settings › Timer; it lives in the window behind the stopwatch button in the
  header of the device list. The section keeps only the options (pause all timers, make up missed timers, notify on
  failure).
- "Notify on failure" is now described exactly (info button next to the option, hint in the assistant, option text in the
  integration): it is a normal push notification (service, group or entity), not a persistent notification in Home Assistant
  and nothing under Repairs. It is sent only after the timer tried three times (at once and twice more, 5 minutes apart),
  also when switching back. It goes to the timer's own recipient, otherwise to the push target under "Monitoring and
  notifications"; if that says "No notification", nothing is sent and it only appears in the log (category Timer). A timer
  with "Report by push" on always sends it. On the phone a newer notification of the same timer replaces the older one.
  Missed runs (Home Assistant was not running) and paused timers send nothing, they only appear in the log.
- Same distance everywhere between neighbouring round buttons in the headers, so they are easy to hit with a finger: 22 px
  between the log button and the cross in the settings, between the stopwatch button and the gear in the header of the
  device list, and between the heart and the cross in the device pop-up (as before).

## [2.23.0] - 2026-10-12

A window with all timers, one symbol for timers everywhere, and a better Favorites chip on the phone.

### Added

- New stopwatch button (⏱️, the same symbol as the tab "Timer") in the header of the device list, next to the log and the gear. It opens a full-screen window with all
  timers of all devices, grouped by device so it is clear which device each one belongs to (search, filter All, On, Off,
  Running, collapse all, "Open device"). There you can edit a timer (the assistant opens on top) and switch it on or off.
  You cannot create new timers there (that stays in the tab "Timer" of a device), and you cannot delete or run them.

### Changed

- Timers have the same symbol everywhere: the stopwatch (⏱️), also on the new header button and in the window of all timers.
- The "Favorites" chip is a little wider (42 px) and no longer shrinks in the scrolling chip bar on the phone (it was
  squeezed to about 18 px), so the heart no longer looks squeezed. The heart in the device pop-up sits a little further
  from the cross.

## [2.22.0] - 2026-10-12

Favorites and automatic updates (both requested by the user): a heart on the device page with a filter chip showing only a red heart, and an option to install updates automatically.

### Added

- Heart at the top of the device pop-up, left of the cross. A tap marks the device as a favorite (red, filled heart) or
  removes the mark. It takes effect at once, without "Save", like renaming. The favorites belong to each user (stored in
  the Home Assistant user data, with a local copy as fallback) and are the same on desktop and phone.
- New filter chip "Favorites": only a small red heart, no text and no number, so it takes little space. It shows the
  devices marked with the heart; a second tap, or "All", clears the filter. By default it is the second chip, right
  after "All", active, and not pinned (only "All" stays pinned by default). Like the other chips it can be hidden
  (Settings › Display › Filter chips; "Favorites") and moved by dragging. Installations with a saved chip order get it
  right after "All" (behind the pin line) until they move it.
- Install updates automatically (Settings › Panel version, new switch under "Check for updates daily"). When on, the
  integration installs a newer version through HACS (like the "Update" button) right after its daily check, with the
  panel closed. It only works together with the daily check: with the daily check off the switch is locked and has no
  effect. A pre-release is installed only if pre-releases are offered. Home Assistant is never restarted by itself:
  after the installation the log (category "Updates") and Settings → Repairs say that a restart is needed, and the panel
  shows "Restart now". If a user checks by hand ("Check for updates") and a version is found, it is installed at once,
  without pressing "Update" a second time. A failed installation is logged and tried again at the next daily check.
  Nothing happens without HACS. The switch is a panel setting for the whole instance and applies with "Save".

### Changed

- Timer "Once": a date is optional. A new switch "Specific date" (off by default) shows the date field; turning it on
  fills in tomorrow. Without a date the timer switches the next time the clock reaches the chosen time, today or
  tomorrow. After that it is always switched off and has to be enabled again (that is the difference to "Daily");
  enabling it again waits for the next time. With a date it works as before. In the list such a timer shows "once" and "Once, next time at 06:30".
- The switch on the timer cards in the device pop-up is a little larger (44 × 24 px instead of 36 × 20 px).
- Device pop-up on the phone: the small symbols stay. The symbol of the "Magic Push" tab is now a bell (🔔) instead of
  the sparkle, which looked too little like a notification.

## [2.21.0] - 2026-10-12

Timer: switch an entity of a device once or on a schedule (requested by the user).

### Added

- New tab "Timer" in the device pop-up (now the fifth tab, after "Magic Push"). A timer switches one switchable entity
  of the device (switch, light, fan, humidifier, siren, input_boolean, cover, valve, lock). Only entities that belong
  to the device are offered. Actions: turn on, turn off, toggle (for covers and valves open and close, for locks lock
  and unlock; locks have no toggle). The tab lists the timers of the device
  as clock cards with the next run, a switch to enable or disable, and the actions "Edit", "Run" and "Delete" (with
  confirmation). A countdown timer shows a ring with the remaining time.
- The assistant for a new timer opens in its own window (full screen on the phone), four steps: 1. what to switch (entity,
  action, optional "Switch back afterwards" after 10 min, 30 min, 1 h or your own time), 2. when ("In ..." as countdown,
  "Once" at a date and time, "Repeat" daily, weekly with weekdays or monthly on a day of the month, including "last
  day"), 3. whether to report by push, 4. name (empty = name of the entity) and check with the next runs. Wrong input is
  shown at the field and blocks "Next". Closing with changes asks "Discard changes?".
- Report by push (switch, per timer, off by default): a reminder on your phone at the moment the timer switches, so
  you have a control. The content is fixed and the same for every timer ("Timer: <name>", "<entity> is now on · 11:15"),
  the assistant shows a preview and "Send test". The recipient can be chosen (services, groups, entities as in
  "Monitoring and notifications"); the default is the push target from the first menu of the settings, and a timer
  without own choice follows a later change of it. A push is sent only when the timer really switches, not when you
  edit it. Failures are reported as well (can be turned off).
- New section "Timer" in the settings (collapsible, same approach as Magic Push): one card per device with all its
  timers, search, filter (All, On, Off, Running), "Collapse all", enable or disable, edit (opens the pop-up of the
  device in the assistant), run, delete. Under it the general options: "Pause all timers", "Make up missed timers"
  (minutes, 0 to 60, default 10) and "Notify on failure".
- The engine runs in Home Assistant, not in the browser: a timer fires with the panel closed. It uses the time zone of
  Home Assistant (daylight saving time is respected; a monthly timer on the 31st runs on the last day of shorter
  months). A single or countdown timer disables itself afterwards and stays in the list as "Done" (a countdown timer
  disappears after a day); "Start again" sets a new time. The next run survives a restart. Runs that fell into a pause or
  a restart longer ago than the catch-up window are skipped and logged (a repeating timer moves to its next run). A
  failed switch is retried twice after 5 minutes.
- Log: timer runs, manual runs, switching back, retries, failures, skipped runs, paused timers and missing targets
  appear in the log under the category "Timer".

### Changed

- The tab bar of the device pop-up has five tabs. On the phone (width up to 600 px) the tabs show a small symbol
  above the text so that all five fit in one row.
- Phone: the curve of the "Outage pulse" row now spans from the middle of the tile to the right edge (before, it was
  squeezed into 112 px). The title of the row may wrap to two lines on narrow phones.

## [2.20.0] - 2026-10-12

Saving works the same everywhere, and the light theme no longer looks greyed out (both requested by the user).

### Changed

- Changes in the device pop-up now take effect only with "Save", like in the settings dialog (gear). This covers the type,
  the connection type and all settings of a device (outage, notifications, battery, charging, signal). Until then the
  device shows the chosen values, the footer shows "n changes" with "Cancel" and "Save", and nothing is sent. "Save"
  sends one call per kind (type, connection type, settings) and keeps the pop-up open with "Saved". A change set back
  to its old value does not count. The draft survives the refresh of the list that runs every 10 seconds.
- Closing a window with unsaved changes (button "Cancel", cross, tap on the background, Escape, or "Open device page")
  asks in a centered pop-up "Discard changes?" with "Keep editing" or "Discard", the same pop-up as in the Magic Push
  assistant. This now applies to the device pop-up and to the settings dialog (gear). Without changes, everything
  closes at once. If saving fails, the draft stays and the error appears next to the value.
- Still immediate (no draft): renaming a device, hiding a device, the list actions of Magic Push (switch on or off,
  delete), the dialogs "Customize" and the filters. Each of them is a single action, not a group of settings.

### Fixed

- Light theme: the device pop-up and the settings dialog (gear) no longer look greyed out. The translucent glass look,
  made for the dark theme, turned grey over the dimmed background. In the light theme the windows, header, tabs and
  buttons are now plain white (tiles only very slightly set off); grey only appears on hover. The dark theme and the
  sheet on the phone (width up to 600 px) are unchanged; it was the desktop window that looked grey.

## [2.19.0] - 2026-10-12

Live activity while charging (iPhone) and live update (Android 16).

### Added

- A device that charges can now show its progress as a live activity on the lock screen and in the Dynamic Island (iPhone,
  Companion app, iOS 17.2 or later) or as a live update (Android 16) (requested by the user). It shows "62 % of 80 %" with a
  progress bar, where the goal is the "Full from" level of the device, so not always 100 %. It works independently of the
  push notification "Report charging". Off by default; switch it on globally (tab "Charging"), per integration (tab
  "Integrations", section "Charging") or per device (device pop-up, group "Charging"); the device comes first, like the
  other charging settings. The recipient is the target of the tab "Charging" (a notify service or group; a notify entity
  cannot do this).
- Quiet updates: the start may notify, every further update is silent (iOS `silent`, Android `alert_once`), at most every
  4 minutes and only when the percentage changed, so the phone does not vibrate on every refresh. When the goal is reached
  the activity shows "Charged" for 10 minutes and is then removed (`clear_notification`). It also ends when the charge
  stops (level unchanged for the time "Charging stopped after") or the charger is unplugged.
- If the user swipes the activity away, no further updates are sent for this charge (otherwise every update would start
  a new activity, on iOS with a notification). Android reports it with `mobile_app_notification_cleared`; for iOS Core
  does not yet send an event (pull request home-assistant/core#183255 is still open), the app listens for
  `mobile_app_live_activity_dismissed` and will use it as soon as Core provides it. Until then a swiped-away activity
  comes back with the next update (every 4 minutes at the earliest). With a notify group as target it cannot be told which
  phone it was, so the whole target stops.
- The live activity survives a restart of Home Assistant. The activity log shows start, goal, end and swiping away.
- Options dialog: new option "Charging: live activity while charging".

## [2.18.0] - 2026-10-12

Not released; included in 2.19.0.

Monitoring and notifications: an own recipient for each tab.

### Added

- Each tab with notifications (Outage, Battery, Charging, New, Updates) can now have its own recipient (requested by
  the user). In the tab, directly under "Notification", there is a new row "Recipient". "Default" follows the target from
  the tab "Overview" and is the starting point, so nothing changes for existing installations. Any other notify service,
  group or entity can be chosen instead; "No target" is not offered there (to switch notifications off, use the switch
  of the tab). A tab with its own target also sends when the global target is "No target". The overview timeline, the
  list of integrations and the warning "Without a target no push is sent" take the tab's target into account. A target that
  no longer exists stays selectable (marked as missing), like the global one.

## [2.17.2] - 2026-10-12

Not released; included in 2.19.0.

Magic Push: the step bars of the assistant stay at the same height.

### Fixed

- The step bars at the top of the assistant no longer jump from step to step (reported by the user): a symbol in the line
  above them (for example the thermometer from step 2 on) made that line taller on the phone, so the bars sat a few pixels
  lower than in step 1. The line now has a fixed height, and a long entity name is shortened with "..." instead of
  wrapping.

## [2.17.1] - 2026-10-12

Magic Push: more robust across crashes and restarts of Home Assistant.

### Fixed

- After a message ("triggered" or "back to normal") the state is now written to disk immediately instead of after up to
  5 seconds. If Home Assistant crashed or lost power right after sending (no clean shutdown), it did not know that the
  message had gone out and sent the same one again after the start. A clean shutdown was not affected.
- "Changes" with a duration ("the new value must stay for at least ...") now survives a restart: the running wait is
  stored and continues after the start. If the time ran out while Home Assistant was off and the value is still the
  same, the message comes right at the start; if the value changed back in the meantime, nothing is sent. Before, such
  a change was lost.

### Changed

- The step bars at the top of the assistant are slightly thicker (6 instead of 4 px) and have a larger tap area (34 instead
  of 24 px), so they are easier to hit and easier to see (requested by the user).
- The arrow to fold and unfold is now the same everywhere in Magic Push (requested by the user): on the condition
  cards, on the recipient selection in step 3, on "Choose a free entity" and on the device cards in the settings. Before,
  step 3 and the overview used a small text triangle of a different size, which also changed size when opened. Now it is
  the same larger arrow, pointing down when closed and up when open.

## [2.17.0] - 2026-10-12

Magic Push: "Reset only after" a duration, against flapping around the threshold.

### Added

- New setting in step 2 ("How long"): "Reset only when it no longer holds for at least" (requested by the user). The
  message counts as done ("back to normal", and a new message becomes possible) only once the condition has not held for
  this long in a row. A value that swings around the threshold for less time stays one message instead of sending
  "message, back to normal, message, ..." in a row. Same controls as "for at least": Immediately, 1 min, 5 min, 10 min,
  30 min, 1 h or a custom time (up to 7 days). It combines with "Own value" (the time only starts once the reset value
  is reached) and with several conditions (it applies to the whole). Not available for "changes".
- The look back (page 2) takes the setting into account: short interruptions belong to the same episode.

### Changed

- New messages start with 1 min; "Immediately" gives the previous behaviour. Existing messages keep "Immediately", so
  nothing changes for them until you edit them.

## [2.16.0] - 2026-10-12

Not released; included in 2.17.0.

Magic Push: the "Discard changes?" question as a pop-up in the middle.

### Changed

- Closing the assistant with unsaved changes (requested by the user) now asks "Discard changes?" in a pop-up in the middle
  of the window, with a dimmed background, instead of in the button bar at the bottom. It is harder to miss. Everything
  behind it is locked until you answer, and the focus sits on "Keep editing", so Enter discards nothing.
- The condition cards in step 1 are easier to hit with a finger (requested by the user): the arrow to fold a condition is
  bigger and brighter, and the "x" to remove a condition or group has a 44 px touch target with a larger symbol.

## [2.15.0] - 2026-10-11

Magic Push: several linked conditions (And/Or, with groups), all on the first page of the assistant.

### Added

- Magic Push can combine several conditions (requested by the user, mockups `docs/mockups/magic-conditions-v1`). On the
  first page of the assistant you add conditions with "+ Condition": each has its own entity (also from other devices),
  kind (above, below, is) and value, with a chart of the last 24 hours. Two or more conditions are linked with "And" or
  "Or"; a sentence "Notify when ..." shows what the message does. "+ Group" adds a box inside which the conditions are
  linked the other way ("all" or "one is enough"), for example "A and (B or C)". One level of groups, at most 10
  conditions and 4 groups.
- Every condition has its own reset value ("Reset"), so each one keeps its own zone against flapping. "Changes" can only
  be the single condition of a message.
- New text variable `{conditions}`: the conditions as a sentence, for example "Temperature above 25 °C and Window is
  open".
- The look back (page 2) shows one timeline per condition plus a "Together" row with the moments the message would have
  fired.
- The overview and the message list show the whole condition as a sentence.

### Changed

- The assistant has five steps again, but in a new order: 1 Conditions (entity and condition, one or more) · 2 How long
  (duration and look back) · 3 Delivery · 4 Text · 5 Name. "How long", "Repeat" and "Also notify when back to normal"
  apply to the whole condition.
- With "And", a condition that is `unavailable` or `unknown` means nothing happens; with "Or" it is ignored while another
  condition decides. The first condition is still stored in the old fields, so existing messages keep working unchanged.

## [2.14.0] - 2026-10-11

Not released; included in 2.15.0.

Magic Push: a preview under each message.

### Changed

- Step 4 of the assistant ("Text") now shows each preview right below its own fields (requested by the user): title and
  content of the message, their variables, then the preview with "Send test"; below that "Also notify when back to
  normal" with its own title, content and variables, and again its own preview with its own "Send test". Before, both
  previews stood together at the bottom. Step 5 (summary) still shows both previews together.

## [2.13.1] - 2026-10-11

Not released; included in 2.14.0.

### Fixed

- Magic Push on the phone: choosing "Choose a free entity" scrolled the list too far, so the search field was no longer
  visible. The assistant window now follows the visible area above the keyboard (also when the phone pushes the page up)
  and scrolls only its own content, so that the search field sits at the top of what is visible. "Back"/"Next" stay above
  the keyboard as well.

## [2.13.0] - 2026-10-11

Magic Push: overview in the settings with structure, search and filter.

### Changed

- The overview "Magic Push" in the settings (Monitoring and notifications) now groups the messages in one card per device
  (requested by the user, mockups `docs/mockups/magic-overview-v1`, variant B). The card head shows the device (icon, name,
  area and integration, a red "offline" mark) and the number of its messages; the messages sit inside the card, each with
  switch, "Edit" and "Delete", and "Open device" at the end. A tap on the head collapses the card; collapsed, it shows a
  short summary ("2 messages · 1 off · 1 triggered", "currently unreachable"). "Collapse all" / "Expand all" sits above
  the list. With more than three devices all cards start collapsed. The state is kept while the settings are open.

### Added

- Search field above the overview, like in the other long lists of the settings: it looks through name, sentence, device,
  area, integration, recipient and entity ID (several words must all appear), shows "n of m" and has a cross.
- Filter "All / On / Off / Triggered" with the numbers (Triggered: the condition holds right now). Search and filter
  expand the matching cards; without them the cards are as before.

## [2.12.0] - 2026-10-11

Magic Push: new order of the steps.

### Changed

- The assistant of Magic Push now asks where the message goes before what it says (requested by the user). Step 3 is
  "Delivery": recipient, critical notification with volume, and repeating. Step 4 is "Text": title and content of the
  message and, if wanted, "Also notify when back to normal" with its own title and content, all in one window, followed by
  the preview and "Send test". The test therefore already uses the chosen recipient, volume and repetition. Step 5 stays
  "Name". Existing messages are unchanged; when editing, the steps in the bar are in the new order.

## [2.11.0] - 2026-10-11

Magic Push: the assistant gets its own window.

### Changed

- The assistant of Magic Push (new message and edit) now opens in its own window on top of the device pop-up instead of
  inside the tab (requested by the user, mockups `docs/mockups/magic-push-dialog-v1`, variant A). On the phone the window
  fills the whole screen: a slim top bar with the title, the device and "Close", the step bar below it, the content in
  between and "Back"/"Next" fixed at the bottom, so they are always within reach. This gives the steps about a third
  more room, and the keyboard no longer pushes the content under a tall pop-up header. On the desktop the window is wide
  (920 px) and shows the chart, the look back and the preview in a column on the right next to the form. The tab
  "Magic Push" in the pop-up now shows only the list of messages with "New message" and "Edit".
- "Edit" in the overview in the settings opens the assistant window directly, without the device pop-up behind it; after
  saving or closing, the settings are there again and the overview is reloaded.
- Closing the window (cross, Escape, "Cancel" in step 1) with unsaved changes asks "Discard changes?"; without changes it
  closes at once. A tap next to the window does not close it.

## [2.10.0] - 2026-10-11

Magic Push: overview in the settings and free entities.

### Added

- New tab "Magic Push" under "Monitoring and notifications" in the settings (requested by the user). It shows all
  Magic Push messages of all devices, grouped by device: the device (icon, name, area and integration, a mark if it is
  offline) as a heading, below it its messages with name, sentence ("Temperature below 12 °C · for 10 min. · back from
  14 °C"), state and when it last fired. Messages can be turned on and off, edited and deleted (with a confirmation)
  right there; "Edit" opens the pop-up of the device with the assistant on that message, and a tap on the device opens
  its pop-up in the tab Magic Push. New messages are not created here, only in the pop-up of a device. The changes
  apply at once, not with "Save"; the overview reloads when a device pop-up is closed.
- Free entity (requested by the user): at the very bottom of step 1 of the assistant, "Choose a free entity" opens a
  search over all entities of Home Assistant (by name, entity ID and device; several words work). The message stays
  tied to this device, but the entity can come from another device or from none: value, unit and states come from the
  chosen entity, `{entity}` is its name and `{device}` stays the device of the message. This allows, for example, a
  calculated absolute humidity on a sensor that cannot measure it. The list and the overview mark such messages with the
  entity ID.

### Changed

- The settings on the phone show only the titles of the sections; the small preview line below each title is gone
  there (requested by the user). On the desktop it stays.
- The tab bar of "Monitoring and notifications" now has nine tabs: five and four on the desktop, three rows of three on
  the phone.
- Magic Push no longer insists that an entity belongs to the device (see "Free entity"); an entity must exist.

### Fixed

- On the phone, opening the search for a free entity let the keyboard cover the search field. The field now scrolls up
  right under the tabs when it opens, and again once the keyboard is out (also for renaming a message in the list).
- The error for an invalid reset value now names the condition and the limit ("With "below 14 g/m³" the reset value must
  be at least 14 g/m³ ...") and points to the other direction when a lower or higher value is meant.

## [2.9.0] - 2026-10-11

Not released; included in 2.10.0.

Magic Push: your own reset condition.

### Added

- In step 2 of the Magic Push assistant, the new section "Reset" (requested by the user). "Automatic" keeps the old
  behaviour: the message is reset as soon as the condition no longer holds. With "Own value" you choose where it is
  reset: for a number a reset value (for example fire below 12 °C, reset only from 14 °C; the assistant suggests a value
  and checks that it lies on the normal side of the limit), for a state the state at which it is reset (for example
  only at "closed"). Between the two values everything stays quiet: no second message and no "back to normal".
  "Back to normal" and the new arming (important with "only once" and repeating) follow the reset value. Before the
  message has fired nothing changes: the condition must hold without a break, otherwise the time starts again. A
  repeat that waited in between continues in its old rhythm. The chart shows a second, green line for the reset value,
  the look back counts with it, and the list shows "back from 14 °C". "Changes" has no reset. Messages from earlier
  versions stay automatic.

## [2.8.0] - 2026-10-11

Magic Push: title and content written separately.

### Added

- In the Magic Push assistant, the title and the content of a message are now two separate, free fields, both with
  variables (requested by the user). Until now only the title could be written; the line below it was made
  automatically. Step 3 has the title (one line) and the content (several lines allowed, up to 300 characters); a tap on
  a variable inserts it into the field you chose last. Leave the content empty and the line is made automatically as
  before (device and how long, or old and new value for a change). New messages start with a default content
  ("{device} · for {duration}"). "Back to normal" has its own title and its own content in step 4. The preview shows
  both, and "Send test" sends both. Messages from earlier versions keep their automatic line.

## [2.7.0] - 2026-10-11

Not released; included in 2.8.0.

Magic Push: critical notification with a volume.

### Added

- In step 4 ("Delivery") of the Magic Push assistant, the new switch "Critical notification" (requested by the user).
  With it on, a slider sets the volume from 1 to 10. A critical message also arrives when the device is muted or on
  "Do not disturb". For iOS the volume is sent as 0.1 to 1.0 (`push.sound` with `critical: 1`; 0 would be silent, so
  the scale starts at 1). For Android, which has no volume per message, the message is sent with `ttl: 0`,
  `priority: high` and the channel `alarm_stream`, so it sounds through the alarm sound at the volume set on the
  device. Only the message itself is critical; "back to normal" arrives as an ordinary message. "Send test" sounds
  like the real message, so you can hear the volume. The preview is marked "critical", and the list shows "critical
  (volume 7)". iOS needs critical alerts allowed for the Companion app in its settings.

### Changed

- In the Magic Push assistant, all choices (condition, state, duration, repeat) are now tab bars like the tabs above,
  with the sliding capsule and the same look (requested by the user). The value selector "− number +" has the same
  surface. A bar without a selected button (a free time was typed) shows no capsule.

## [2.6.1] - 2026-10-11

Not released; included in 2.8.0.

Release notes open again with a new version from HACS.

### Fixed

- "Release notes" at an available update showed the error "does not match the expected pattern at 'latest'. Got
  'v2.6.0'" (reported by the user). HACS reports the new version with its tag ("v2.6.0"), but the server accepted only
  the plain number. The panel now sends the number without the "v", and the server also accepts a leading "v".

## [2.6.0] - 2026-10-11

Magic Push: your own messages per device, without an automation.

### Added

- New fourth tab "Magic Push" in the device pop-up (requested by the user). It lists the messages of the device (name,
  a sentence such as "Temperature below 12 °C · for 10 min. · once", when it last fired, a switch) with "Edit",
  "Rename" and "Delete" (with a confirmation). The tab shows the number of active messages.
- "New message" opens an assistant in five steps: value, when, text, delivery, name. 1) Pick any entity of the device,
  with its current value. 2) The condition: above, below, equals or changes for a number; is or changes for a state
  (with the words of the entity, such as open or closed). The duration ("for at least") comes with suggestions and
  always a free time (number and unit, up to 7 days). A chart or timeline of the last 24 hours and a look back
  ("would have fired once, yesterday 04:12, lowest value 11.6 °C") show what the setting would have done; the look back
  may be empty and needs the recorder. 3) The text is free; variables fit the entity ({value}, {unit}, {threshold} for
  a number, {value} as the entity's word for a state, {old} and {new} for a change, and always {device}, {area},
  {entity}, {integration}, {rule}, {duration}, {since}, {time}) and are inserted at the cursor. A preview with the
  current value is always shown. 4) The recipient: the default from the settings or a notify service, group or entity;
  repeat (only once, 30 min., 1 h, daily or a free time); "Also notify when back to normal" with a text that is just as
  free as the first one, with its own preview; "Send test". 5) The name, with a suggestion, and a summary.
- A message fires when the condition has held for the given time, once per episode (again only after the value was back
  to normal), or repeated. "Changes" fires per change, once the new value has stayed for the time. Entities that are
  unavailable or unknown report nothing and do not reset the time. The state survives restarts; messages of a removed
  device are removed too. Up to 20 messages per device and 200 in total.
- A push of Magic Push shows the icon of the integration and opens the device in the panel, like the other
  notifications. The log has a new category "Magic Push".
- Commands `device_panel/magic_get`, `magic_save`, `magic_delete`, `magic_enable`, `magic_preview`, `magic_test` and
  `magic_history` (administrators only). The messages are stored in `.storage` and are deleted when the integration is
  removed.

## [2.5.0] - 2026-10-11

Long lists at the end in the settings.

### Changed

- In the settings, a long list now always comes last in its tab, so you do not have to scroll past it (requested by the
  user). In "Charging" the emoji field and the preview now sit above the list "Per integration", in "Updates" above the
  list "Single apps and integrations". In "Display", "Reset order" moved above the chip list. The tabs "Outage",
  "Battery", "New" and "Signal" already ended with their lists of exceptions.

## [2.4.0] - 2026-10-11

Not released; included in 2.5.0.

Read the release notes of the installed version too.

### Added

- In the settings, the row of the installed version ("Up to date") now also has the button "Release notes" (requested by
  the user). Without an update it opens the same window with the notes of the installed version, headed "Installed
  version x.y.z", so you can read what the current version brought. The window works as before: the language of the
  panel, a hint if only English exists, the button "On GitHub" and "Try again" on errors.

## [2.3.0] - 2026-10-11

Release notes in a window instead of a link.

### Changed

- In the settings, "Release notes" at an available update no longer opens GitHub but a window in the panel (requested
  by the user). It shows the notes of all versions after the installed one up to the new one, newest first, so skipped
  versions are included. In a German panel they come in German (from `CHANGELOG.de.md` of the new version on GitHub),
  otherwise in English; if a language is missing, the window says so and shows English. A button "On GitHub" in the
  window still opens the release page. Without a network connection or at GitHub's rate limit the window shows the
  error with "Try again". The texts are cached for six hours.

## [2.2.0] - 2026-10-11

An emoji per push notification, set in the panel.

### Added

- The emoji at the start of a push title can be changed per notification (requested by the user), in the tab of the
  notification in "Monitoring and notifications": "Outage" (offline, group outage, back online), "Battery" (low
  battery), "Charging" (charged, charging stopped), "New" and "Updates". The field sits above the preview, which follows
  while you type. The default is today's emoji (🔴 🚨 🟢 🪫 🔋 🔌 ✨ ⬆️). The field takes up to 3 characters (a
  flag or an emoji with a skin tone counts as one) and can be saved empty for a title without emoji. "Default" sets the
  emoji back. The persistent notifications in Home Assistant keep their emoji; the setting is in the panel only, not in
  the options dialog of Home Assistant.

## [2.1.0] - 2026-10-11

The icon of the integration in push notifications.

### Added

- A push notification that clearly belongs to one integration now shows that integration's icon instead of the Device
  Panel icon: "Back online: Aqara FP400" shows the icon of the integration the device is set up with (for example
  Matter). This applies to outage and back-online, low battery, charging, and new device notifications. A
  notification about several devices shows the icon only when all of them belong to the same integration; otherwise,
  and for update reminders, the Device Panel icon stays. Nothing to set up.
- Where the icon comes from: first `brand/icon.png` of the integration itself, otherwise the icon service of Home
  Assistant (`brands.home-assistant.io`), the same source Home Assistant uses for its own integration pages. Each icon
  is fetched only once, put on a square area with a margin (iOS cuts the corners of the image) and stored in
  `.storage/device_panel_icons`; the companion app loads it without login, like the Device Panel icon. An icon that
  cannot be found is retried after six hours; until then, and when Home Assistant has no network access, the Device
  Panel icon is used. A notification is never held back for longer than four seconds because of an icon. The folder
  is deleted when the integration is removed.

### Changed

- The right edge of the outage pulse now shows the state right now (requested by the user): the last section counts
  only devices that are offline at this moment. Before, a device that had been gone for a short time kept the curve at
  the right edge up and red for up to 30 minutes after it came back, although "Offline now" already said 0. The
  outages stay visible in the sections before, in the bar of each device and in the list of the pulse window. A short
  outage that lies entirely within the current half hour no longer shows in the curve once the device is back. The
  window lists the same devices when you tap the last section.

## [2.0.10] - 2026-10-11

Not released; included in 2.1.0.

Device pop-up: the tab "Settings" on two lines.

### Changed

- In the device pop-up, the tab "Settings" now shows its number on a second line when the device has settings of its
  own: "Settings" in a slightly smaller font, below it "1 custom" in small type. Before, "Settings · 1 custom" was
  squeezed into one line (requested by the user). The tab without own settings and the other tabs stay as they were.

## [2.0.9] - 2026-10-11

Not released; included in 2.1.0.

Blue ring left over after closing a window on the phone.

### Fixed

- On the phone, a blue ring stayed around the tile "Outage pulse" (and could stay around other tapped elements) after
  opening and closing its window: the browser gives the focus back to the tapped element when a window closes and
  shows a focus ring there. On touch devices the focus is now released when a window closes (pulse, device
  pop-up, settings, view, statistics, areas, log, prompt editor). The keyboard focus on the desktop is not affected.

## [2.0.8] - 2026-10-11

Not released; included in 2.1.0.

A clear sign for a switched-off notification in the graphics.

### Changed

- The end point of a switched-off notification ("No push") is a grey ring with a diagonal stroke instead of a dashed
  ring that looked like a pixel error (requested by the user, mockups `off-marker-v1`, variant B). This applies to all
  graphics: overview, the settings tabs, integration detail and device pop-up. The bars of "Outage" and "New", which
  showed no sign at all when switched off, now show the same ring at the end of the dashed line.

## [2.0.7] - 2026-10-11

Not released; included in 2.1.0.

Settings per device in one place; "Display" only has the filter chips.

### Changed

- "Devices in the panel" has a new tab "Per device" (requested by the user): all devices with a setting of their own
  are listed there, each kind in its own list with reset buttons (outage time, notifications switched off, battery,
  connection type set by hand, signal warning). Single entries or all of them can be reset; it applies with "Save".
  The lists stay at their own topic as well (for example the battery ones under "Battery"). The tab shows how many
  devices have a setting of their own.
- The signal warning thresholds per connection type, which were part of "Display" › "Connection type", are now a
  tab "Signal" in "Monitoring and notifications" (the same place where integrations and devices have their "Signal"
  tab), with the devices that have their own threshold below "Exceptions". The settings themselves do not change.
- "Display" no longer has the tab "Connection type": only the filter chips remain, without sub-tabs.
- "Monitoring and notifications" has eight tabs (new: "Signal"), always in two rows of four, also on the desktop.

## [2.0.6] - 2026-10-11

Pencil at the device name without the blue ring.

### Changed

- The pencil next to the device name (rename) is a small circle on the lightly tinted surface, like the area of the
  new tabs, instead of a blue ring (requested by the user). The keyboard focus is shown in a neutral colour.

### Fixed

- On the phone, opening the device pop-up, the settings, the statistics window or the prompt editor no longer shows
  a focus ring on the first button (the pencil appeared with a blue ring).

## [2.0.5] - 2026-10-11

Tabs as a segmented control, and one line for sorting and view on the phone.

### Changed

- The tabs look and behave like the segmented control of the UniFi app (requested by the user, mockups
  `segmented-v1`): a rounded area with equally wide fields; the selected field is a darker capsule with accent-colour
  text, the others have no frame. On a change the capsule glides to the new tab with a slight overshoot and the text
  fades to the accent colour; with "reduce motion" the capsule jumps instead. This applies to all tabs: settings,
  integration detail and device pop-up. This replaces the framed tabs of 2.0.2 and 2.0.3.
- With more than four tabs the phone shows four columns (seven tabs: 4 + 3, the last one left and as large as the
  others), on narrow phones (under 390 px) three columns; on the desktop one row. On the phone the tabs are at least
  44 px high.
- Phone: the button "Columns" at the top and the pill "Sorted by" below the chips (both opened the same sheet
  "View") are replaced by one line "Sorting & view" below the chips; on the right it shows the selected sorting in the
  accent colour, with the direction arrow (requested by the user, mockups `sort-line-v1`, variant C). The search
  field is wider. The desktop is unchanged.

## [2.0.4] - 2026-10-11

Connection type per integration next to the type.

### Changed

- The connection type per integration (Zigbee, Thread, Wi-Fi, ...) is now set in the same list as the type:
  Settings › "Devices in the panel" › "Integrations" has a second selection "Connection type" next to "Type"
  (requested by the user). It is the same setting as before, so values already set stay. On the phone, "Type" and
  "Connection type" stand below the name; the detected connection types are shown as a tooltip of the selection.
- "Display" › "Connection type" no longer has its own list of integrations; a note with a link leads to the new
  place. The per-device exceptions and the reception thresholds stay there.
- The summary of "Devices in the panel" shows how many integrations have a connection type set.

## [2.0.3] - 2026-10-11

Tabs without a background area, larger on the phone.

### Changed

- The tabs keep their frame, but the area behind the whole row is gone: the row has the same background as the rest
  of the pop-up or the settings (requested by the user, mockups `tabs-frame-v1`, variant A). This applies to all
  tabs: settings, integration detail and device pop-up.
- The tabs have their natural width and are left-aligned (mockups `tabs-touch-v1`, variant 2): they no longer fill
  the row, so the last tab ("Integrations") is no longer stretched over the whole width but as large as the others
  and on the left. When space runs out, the next tabs move to a second row.
- On the phone the tabs are larger to be operated with a finger: at least 44 px high, text 14 px.

## [2.0.2] - 2026-10-10

Unified graphics, framed tabs and a press fix. This version is a regular release (not a pre-release); it includes the
material look from 2.0.0 and 2.0.1.

### Changed

- All timeline graphics are unified (requested by the user, mockups `graphics-v1`, variant A): lines and bars no
  longer reach the right edge but end at 80 % of the width, and the value and its description sit below the end
  point (ring). This applies to the bars of "Outage" and "New" (the longest bar ends at 80 %, the value moved from
  the right edge to the end) and to the lines of "Battery", "Charging" and "Updates" (the line ends at the last
  mark). Everywhere they appear: overview, the settings tabs, the integration detail and the device pop-up. Only
  the look changes: no values, fields or functions.
- Tabs that are not selected get a light frame so they are easier to recognise as tabs. This applies to all tabs:
  settings, integration detail and device pop-up.

### Fixed

- Pressing and holding a row (for example a section in the settings, an integration, a list row or a log row) no
  longer shows a darker area at the edge: such rows no longer shrink while pressed but show the hover colour
  instead (introduced in 2.0.0).

## [2.0.1] - 2026-10-10

Material look sharpened and applied to the list (pre-release).

### Changed

- The sheets (device pop-up, settings, log) are more translucent (64 % instead of 80 %) with a stronger light top
  edge, a darker and more blurred background and clearly visible glass on tiles, tabs and cards, so the material
  can be seen on a phone as well (requested by the user, after testing 2.0.0).
- The list gets the same look: larger tighter title "Devices", cards with larger radius and soft depth, the chip
  bar as translucent material over the list, group titles ("Offline", "Online") in the stronger title style.
  Only styles change.

## [2.0.0] - 2026-10-10

Material look, step 1 (pre-release).

### Changed

- New look for the device pop-up, the settings and the log window (requested by the user, mockups
  `apple-design-v1`, variant B, step 1 of 2): translucent sheets with blur and a light top edge, a dimmed and
  slightly blurred background, head and buttons fade out softly instead of ending in a hard line, glass-like tiles,
  buttons and tabs, tighter spacing of large titles and slightly wider spacing of small labels, and an instant
  press feedback (3 % smaller). Only styles change: no fields, values, tags or functions. Without support for
  `backdrop-filter` or with "reduce transparency" the sheets stay opaque as before; with "reduce motion" the press
  feedback is off. Step 2 (sheet that can be dragged, springs) follows separately. Can be reverted by going back
  to 1.44.0.

## [1.44.0] - 2026-10-10

Tabs wrap onto a second row.

### Changed

- All tabs (settings, detail of an integration, device pop-up, sub-tabs of the sections and the prompt window)
  keep the clear segmented look and now wrap onto a second row when there is no more room, instead of scrolling
  sideways or being squeezed (requested by the user; the style was chosen from the mockups `tabs-style-v1`: the
  existing look stays). The tabs of a row fill its width.

## [1.43.0] - 2026-10-10

Clear section titles in the settings.

### Changed

- One title style for every new topic in the settings (requested by the user): larger (18 px, bold), in the
  text colour with an accent bar in front, so it is clear at first glance that a new section starts. The
  small grey capital titles ("Detection", "Notification" …) look the same now. New titles where a topic
  began without one: "What the panel shows", "Integrations in the panel", "Device types in the panel" and
  "Hidden devices" (Devices in the panel); "Where notifications go" (Overview); "Notification" and
  "Integrations" (Charging); "Display", "Provider" and "Prompt" (AI assessment). "Connection type per
  integration", "Signal: warning threshold per connection type" and "Filter chips" are titles too.

## [1.42.0] - 2026-10-10

Not released; included in 1.43.0.

The same tabs on every level.

### Changed

- The same tabs in the settings, in the detail of an integration and in the device pop-up (requested by the
  user, "so it is built exactly the same everywhere"):
  - Settings › Monitoring and notifications: "Charging" is a tab of its own (before: a sub-tab of "Battery"):
    Overview, Outage, Battery, Charging, New, Updates, Integrations. On a phone the row of tabs scrolls
    sideways and keeps the chosen tab in the middle.
  - Detail of an integration: tabs Outage, Battery, Charging, New, Signal and Devices instead of one long
    page. Each tab shows the graph of the matching tab in the settings (with the values that apply to the
    integration), a dot marks a tab with an own setting of the integration, "Reset all to default" stays below.
  - Device pop-up, tab Settings: sub-tabs Outage, Battery, Charging and Signal with the graph and the settings
    of the device (origin as before). The tabs are always there; what a device cannot do (no battery, no
    signal) says a short hint. A dot marks a tab with an own setting of the device.
- "Charging detected at a rise of" can be set from 2 % (requested by the user; before: 5 to 80 %), in the global
  setting, per integration (the list now offers 2 % and 3 %) and per device.
- Content that scrolls under the tab row of the device pop-up fades out instead of being cut off hard (the tiles
  "Type" and "Connection type" seemed to stick to the tabs).

## [1.41.0] - 2026-10-10

Not released; included in 1.43.0.

Charging stopped per integration and per device.

### Added

- "Charging stopped after" and the push when charging stops can be overridden per integration and per
  device (requested by the user), like "Full from" and the rise. In the device pop-up (tab Settings) two
  more rows: "Charging stopped after" (global or integration value, or "Own time" from 5 to 120 minutes) and
  "Push when charging stops" (default, on, off), each with its origin. In the detail of an integration (tab
  Integrations, group "Battery"): a time (5 to 120 minutes) and on/off, with the default (global value). The list
  shows "Charging on (stopped after 30 min, push at end on)". Order: device, integration, global. New options
  `charge_stall_integrations` and `charge_stop_integrations` (panel only); new settings `charge_stall` and
  `charge_stop` in `set_device_settings`; `list_devices` has `charge_stall_setting`, `charge_stop_setting` and
  the values in `charge_default`.

- Push titles start with an emoji (requested by the user) so the topic is clear at first glance: 🪫 low
  battery, 🔴 offline, 🚨 group outage, 🟢 back online, ✨ new device, 🔋 charged, 🔌 charging stopped,
  ⬆️ update reminder. The previews in the settings show the same titles. The persistent notifications in
  Home Assistant start with the emoji of their topic as well (🪫, 🔴, ✨).
- Charge bar with target (requested by the user, mockup `charge-target-v1`, variant C): when "Full from" is below
  100 % (for example 80 %), the rest behind the target is hatched, with a line and a small number at the
  target. Shown in the list with the chip "Charging" and in the battery tile of the device pop-up. At 100 % the
  bar stays as before. `list_devices` has `full` in `charging`.

### Changed

- Fixed height of the windows (requested by the user): the device pop-up, the settings, the statistics
  window, the outage window ("pulse"), the area selection and the prompt window keep the same height whatever
  tab or range is chosen (before, the pop-up got shorter on a tab with less content). Head, tabs and buttons
  stay in place, the content fills the rest and scrolls when it is longer. Smaller windows with constant
  content (columns, view) are unchanged.
- The battery warning ("Low from") can be set down to 1 % (requested by the user: "I do not want to patronise
  anyone"; before: 5 to 50 %). Applies to the device pop-up, the global setting, the setting per integration and
  the Home Assistant options; 0 and values above 50 are still rejected.

### Fixed

- Log window: "All" stays in place in both chip rows when you scroll sideways (before, the first chip of the
  second row scrolled out of view on the phone).
- The device pop-up (and the log window) is no longer rebuilt by the periodic refresh (every 10 seconds)
  while you touch it, swipe in it or have a selection open. On the iPhone a replaced content cancels the
  swipe, the page behind scrolls along and can trigger the reload of the app ("the device view is no longer
  scrollable, everything scrolls together"); an open selection would also close. The refresh waits until
  the touch has ended (about a second) and then updates; your own actions still update at once. The cause
  is not confirmed on a real device (no reproduction possible); if it still happens, please report the
  exact steps.

## [1.40.0] - 2026-10-10

Not released; included in 1.43.0.

Charging stopped.

### Added

- Charging stopped (requested by the user): a device without a charging indicator of its own that was
  charging by its level no longer counts as charging once the level stays unchanged for a set time
  (default 15 minutes, 5 to 120), for example with a charge limit or when the charger is unplugged. The mark,
  the chip "Charging" and the bar disappear, and the log says "charging stopped at 80 %". If the level rises
  again, the charge continues. New: a push "Charging stopped" with the level, the charge so far and how long
  the level has been unchanged, with its own switch (off by default; only for devices whose charging
  notification is on). Both in Settings › Battery › Charging (options `charge_stall` and
  `notify_charge_stop`, also in the Home Assistant options). Devices with a charging indicator of their own
  report the end themselves and are not affected.

## [1.39.0] - 2026-10-10

"Full from" with steps and an own value.

### Changed

- "Full from" of the charging notification (requested by the user): the steps are now 100, 95, 90 and
  80 % (98 % is gone) or "Own value" with a number field from 50 to 100 %. This holds in the device
  pop-up, globally (Settings › Battery › Charging) and per integration; a value outside the steps
  shows "Own value". The range is now 50 to 100 % (before 90 to 100 %); the Home Assistant option
  `charge_full` takes the same range. The fallback rule for devices that report rarely (a jump to full)
  now needs a jump of more than 10 points below "Full from", so a step from 79 to 80 % does not count as
  charging at "Full from" 80 %.

## [1.38.0] - 2026-10-10

Not released; included in 1.39.0.

Log: why a notification came or did not.

### Added

- Log (requested by the user, mockups `popup-tabs-log-v1`, P1): a new button "Log" in the header, left of the
  gear. The window is large on the desktop and fills the screen on the phone. It lists what the
  notifications decide and why something did not come ("charging notification off for this device", "no push
  target chosen", "push target does not exist", muted, off …): charging (detected, fully charged, notification
  sent or not), outage and back online, battery (newly low, and why no push), new devices, update
  reminders, every push (sent or failed) and the start. Filter by level (Info, Warning, Error) and area, search
  with an X to clear, "Copy" for the shown entries and "Clear". A row with a device opens its pop-up. The
  checkbox "Record debug entries" in the window also records intermediate steps (every new battery level
  with low point and thresholds), until the next restart. The entries are only in memory (the last 500) and
  go to the Home Assistant log as well (warnings and errors are visible there anyway). New WebSocket
  commands `get_log`, `set_log` and `clear_log` (administrators only).

## [1.37.0] - 2026-10-10

Not released; included in 1.39.0.

Tabs in the device pop-up.

### Changed

- Device pop-up with three tabs (requested by the user, mockups `popup-tabs-log-v1`, R3):
  "Overview", "Settings" and "Entities". "Overview" holds the statistics, assessment,
  connection and device details for reading; type and connection type show as text there. All
  settings of the device are in "Settings": type, connection type and everything under
  "Settings for this device" (outage, battery, signal, charging, notifications). The tab shows
  the number of own settings ("Settings · 2 custom") with a dot; "Entities" has the list of
  entities. The pop-up always opens on "Overview".

## [1.36.0] - 2026-10-10

Charging notification per integration with its own values.

### Added

- Charging notification per integration (requested by the user): in the detail of an
  integration (tab Integrations, group "Battery"), as soon as the charging notification is on
  for it, "Full from" and "Charging detected at a rise" with the default (global value) or an own
  value (rise 5 to 80 % in steps, full 90, 95, 98, 100 %). The list shows "Charging on (full
  from 98 %, rise 15 %)". Order: device, integration, global. New options
  `charge_full_integrations` and `charge_rise_integrations` (panel only); in the device pop-up
  the default reads "Same as integration (95 %)".

### Fixed

- A device without a charging indicator of its own was marked "charging" from a mere rise of
  its level, also when it does not charge: a button-cell sensor in a fridge (BTHome) swung
  from 53 to 61 % and showed up in the chip "Charging". The level alone now counts only when
  the charging notification is switched on for the device (own "On" or from the integration),
  which declares it rechargeable; otherwise it is never marked. Devices with a charging
  indicator (binary sensor battery_charging, companion app "Battery state") are unchanged.

## [1.35.0] - 2026-10-10

Devices that are charging right now.

### Added

- Filter chip "Charging" (requested by the user, mockups `charging-state-v1`, B and C): shows
  the devices that are charging right now, after "Battery"; it only appears when a device
  charges, and like the other chips it can be hidden, pinned and moved in the settings
  (Display). With the chip on, the list is one list sorted by level (fullest first), each
  device with a green bar, "81 % · from 38 % · for 1 h 20 min" and a green stripe on the phone.
- Marking in the list: a green pill "charging" next to the device (phone: right in the row,
  desktop: behind the name, in the battery column with a lightning symbol); in the device
  pop-up the battery tile says "charging for 1 h 20 min".
- Detection for all devices with a battery, independent of the charging notification: the
  charging indicator of the device where it has one (binary sensor with device class
  battery_charging, or the companion app "Battery state"), otherwise the rise of the level from
  its lowest value by the set rise (default 20 %), as long as the level is not full and has
  risen in the last 2 hours. A fall of 5 points ends it. Devices that report rarely (many
  Bluetooth and Zigbee sensors) show "charging" late or never. `list_devices` has the new field
  `charging` (level, start level, since, source).
- Charging notification per device (requested by the user): in the device pop-up, as soon as
  the charging notification applies to the device (own "On" or from the integration), two more
  rows: "Full from" (global value or 90, 95, 98, 100 %) and "Charging detected at a rise"
  (global value or own value from 5 to 80 %), each with the origin ("Device", "Default would be
  ..."). The own values count for the push and for the mark "charging". New settings
  `charge_full` and `charge_rise` in `set_device_settings`; `list_devices` has
  `charge_full_setting`, `charge_rise_setting` and the global values in `charge_default`.

### Changed

- The charging notification now observes all monitored devices with a battery (before: only the
  switched-on ones); it still sends the push only for those.
- Settings › Battery › "Charging": the timeline of the overview is also there, like for the
  warning. The rise (field) and "Full from" (selection) are set in the timeline, with the
  hints below it.
- The search fields of the lists in the settings and of the pickers (area, integration) have
  an own clear button (X) now, as soon as something is typed; iOS does not show the one of the
  browser.

## [1.34.0] - 2026-10-10

Overview with all notifications.

### Added

- Settings › Monitoring and notifications › Overview (requested by the user): two new rows,
  so the overview covers every notification. "Charging" shows the rise that detects charging
  and "Full from" with the push, the chip "Push" (switches the charging notification), and
  for which integrations and devices it is switched on. "Updates" shows when the push comes
  (immediately after the collect window, daily or Mondays at the set time), the chip "Push",
  the kinds and the number of exceptions. "Change" opens the matching tab, for "Charging" the
  sub-tab "Charging", for "Low battery" the sub-tab "Warning".

## [1.33.0] - 2026-10-10

Not released; included in 1.34.0.

Charging notification also per integration in the tab "Integrations".

### Added

- Settings › Monitoring and notifications › Integrations (requested by the user): in the
  detail of an integration with battery devices, group "Battery", the switch "Charging
  notification" (default off, like the list in "Battery" › "Charging", it is the same
  value). The list of integrations shows "Charging on" and the filter "Deviating" finds
  them; "Reset all" and "Everything to default" switch it off again. A hint says when the
  charging notification is switched off globally or has no target.

## [1.32.0] - 2026-10-10

Battery tab: sub-tabs "Warning" and "Charging".

### Changed

- Settings › Monitoring and notifications › Battery (requested by the user, mockups
  `battery-layout-v1`, C): two sub-tabs. "Warning" holds the threshold timeline, the
  notification, its content and the exceptions, now titled "Exceptions to "Low from"" so it is
  clear what they refer to. "Charging" holds the charging notification with its own view
  (switch, "Full from", rise, integrations with search, preview). The dot on a sub-tab shows
  a change.

## [1.31.1] - 2026-10-10

Not released; included in 1.32.0.

Fix: panel loads slowly or not at all since Home Assistant 2026.10.

### Fixed

- Panel and settings loaded very slowly or not at all, saving took long, and the whole of
  Home Assistant could feel sluggish since Home Assistant 2026.10. Cause: since 2026.10 every
  read of `DeviceEntry.config_entries` and `primary_config_entry` (deprecated since 2026.8,
  replaced by `config_entry_id`) is reported at runtime, which inspects the call stack. The
  panel read them several times per device and request, so some hundreds of devices meant
  thousands of reports that blocked Home Assistant. The panel now reads `config_entry_id`
  (older Home Assistant versions keep working with `config_entries`). A test checks that no
  module reads the deprecated properties any more.
- The same cause, second place (Home Assistant log): `device_registry.devices` was used as a
  mapping (`.values()`), which is also reported since 2026.10. The panel now iterates the
  registry.

### Changed

- Charging notification: the rise is given in "%" instead of "points" (panel and options
  dialog); the description gives an example.

## [1.31.0] - 2026-10-10

Update reminder per app and integration.

### Added

- Update reminder: a list of all update entities of Home Assistant in the tab "Updates"
  (requested by the user): Home Assistant Core, operating system and supervisor, every
  installed app (add-on), HACS entries and device firmware, by name with the installed version
  and an "update available" dot. Every entry follows its kind (the four switches above the
  list) until you switch it individually: off for one app of a kind that is on, or on for one
  firmware of a kind that is off. An entry with its own choice is marked "own choice" and
  goes before the kind. The list has a search field from 8 entries.
- The preview in the tab "Updates" now shows the updates that are open right now and would be
  reported (examples only when nothing is open).
- New options `updates_exclude` and `updates_include` (entity IDs, set in the panel).

### Changed

- The kind "Add-ons" is now called "Apps (add-ons)", like in Home Assistant.

## [1.30.0] - 2026-10-10

Not released; included in 1.31.0.

Charging notification.

### Added

- Charging notification (requested by the user, mockups and concept `charging-v1`,
  `docs/CONCEPT-laden-updates.md`): a push as soon as a device is fully charged. Off by
  default; switch it on in the tab "Battery" under Monitoring and notifications (section
  "Charging"), per integration, or per device in the device pop-up ("Report charging": same
  as integration, on, off; the device wins).
  - Detection without a charging entity: the panel remembers the lowest level since the
    last discharge. A rise of 20 % or more from there (22 % to 42 %, for example) counts as charging; at "full"
    (default 100 %) it sends one push. Both values are configurable ("Full from" 90, 95, 98
    or 100 %; rise 5 to 80 %), because some devices never report 100 %.
  - Fallback for devices that report rarely: a jump from below 90 % straight to "full"
    is reported as well, without a duration ("from 38 %"). The notification re-arms once the
    level has dropped 10 points below "full".
  - Notification: "Charged: name", text "100 % · in 1 h 40 min from 22 % · area"; same push
    target and image as the other notifications; tap opens the device in the panel.
  - Preview in the settings, like the battery notification; the list of integrations has a
    search field from 8 entries.
  - Caution: a new battery looks like charging, so keep it off for devices with
    non-rechargeable batteries.
  - New options `notify_charge`, `charge_full`, `charge_rise` and `charge_integrations`,
    also in the options dialog; per-device setting in `.storage/device_panel.devices`.

## [1.29.0] - 2026-10-10

Not released; included in 1.30.0.

Update reminder.

### Added

- Update reminder (requested by the user, mockup `charging-v1`): a push notification when a
  new update is available in Home Assistant, in the new tab "Updates" under Monitoring and
  notifications. It replaces automations with a counter and a helper entity: the panel
  watches the update entities of Home Assistant itself. Off by default; same push target as
  the other notifications, its image and "tap opens the update page".
  - Time: daily at a set time (default 09:00), weekly (Monday) or immediately after a
    collect window (default 5 minutes).
  - Kinds: Home Assistant (core, OS, supervisor), add-ons, HACS (also this panel), device
    firmware (off by default). Skipped versions are never reported.
  - One notification lists all open updates with "name old → new". An update is reported
    once per version; optionally again after 3 or 7 days if it stays open.
  - Preview in the settings, like the battery notification.
  - New options `notify_updates`, `updates_mode`, `updates_time`, `updates_window`,
    `updates_repeat` and `updates_kinds`, also in the options dialog.

### Changed

- The settings section "Updates" (version of this panel) is now called "Panel version", to
  tell it apart from the new tab. The update row of the panel stays at the top of the
  settings.

## [1.28.0] - 2026-10-10

Not released; included in 1.30.0.

Search field in long lists of the settings.

### Added

- Search field above long lists in the settings (requested by the user, mockup
  `settings-search-v1`, A): from 8 entries on, for the integrations, types and hidden
  devices (Devices in the panel), Monitoring and notifications › Integrations, the
  connection type per integration and the lists of devices with their own setting. The
  list filters as you type, shows "1 of 9" and "No matches."; the search stays when the
  dialog redraws. "Toggle all" still switches the whole list.

## [1.27.0] - 2026-10-08

Reason for the warning at the top of the device pop-up.

### Added

- Device pop-up (requested by the user, mockup `warn-reason-v1`, K2): the reasons for a
  warning now stand at the top as tags under the name: "Unstable · 5× in 24 h",
  "Weak signal · LQI 61", "Battery low · 9 %". The matching tiles in the statistics get a
  yellow frame and a dot, so tag and tile belong together visibly. Devices without a
  warning show neither.

### Changed

- The pill "Unstable" under the name is replaced by the tag.

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

[2.6.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.6.0
[2.137.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.137.0
[2.136.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.136.1
[2.136.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.136.0
[2.135.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.135.0
[2.134.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.134.1
[2.134.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.134.0
[2.132.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.132.0
[2.129.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.129.0
[2.128.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.128.0
[2.125.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.125.0
[2.124.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.124.0
[2.122.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.122.0
[2.120.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.120.0
[2.119.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.119.0
[2.118.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.118.0
[2.117.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.117.0
[2.116.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.116.1
[2.116.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.116.0
[2.115.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.115.0
[2.114.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.114.0
[2.113.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.113.0
[2.112.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.112.0
[2.111.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.111.0
[2.109.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.109.0
[2.108.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.108.0
[2.107.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.107.0
[2.106.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.106.1
[2.106.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.106.0
[2.105.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.105.1
[2.105.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.105.0
[2.102.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.102.0
[2.101.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.101.1
[2.100.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.100.0
[2.99.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.99.1
[2.99.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.99.0
[2.98.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.98.1
[2.98.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.98.0
[2.97.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.97.0
[2.96.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.96.0
[2.95.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.95.1
[2.95.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.95.0
[2.93.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.93.0
[2.92.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.92.1
[2.92.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.92.0
[2.91.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.91.0
[2.90.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.90.0
[2.89.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.89.0
[2.88.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.88.0
[2.85.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.85.0
[2.82.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.82.0
[2.80.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.80.0
[2.79.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.79.0
[2.78.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.78.0
[2.76.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.76.0
[2.75.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.75.0
[2.73.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.73.0
[2.72.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.72.0
[2.71.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.71.0
[2.70.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.70.0
[2.69.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.69.0
[2.68.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.68.0
[2.66.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.66.0
[2.65.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.65.0
[2.64.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.64.0
[2.63.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.63.0
[2.60.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.60.0
[2.58.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.58.0
[2.57.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.57.0
[2.55.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.55.0
[2.54.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.54.0
[2.53.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.53.0
[2.52.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.52.1
[2.52.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.52.0
[2.51.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.51.0
[2.49.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.49.0
[2.48.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.48.0
[2.46.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.46.0
[2.44.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.44.0
[2.43.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.43.0
[2.41.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.41.2
[2.40.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.40.1
[2.40.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.40.0
[2.39.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.39.0
[2.38.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.38.0
[2.37.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.37.0
[2.35.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.35.0
[2.33.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.33.0
[2.31.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.31.0
[2.29.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.29.0
[2.28.5]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.5
[2.28.3]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.3
[2.28.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/2.28.2
[2.28.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.1
[2.28.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.28.0
[2.27.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.27.1
[2.27.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.27.0
[2.26.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.26.0
[2.25.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.25.0
[2.24.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.24.1
[2.24.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.24.0
[2.23.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.23.1
[2.23.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.23.0
[2.22.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.22.0
[2.21.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.21.0
[2.20.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.20.0
[2.19.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.19.0
[2.17.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.17.1
[2.17.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.17.0
[2.15.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.15.0
[2.13.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.13.0
[2.12.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.12.0
[2.11.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.11.0
[2.10.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.10.0
[2.8.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.8.0
[2.5.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.5.0
[2.3.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.3.0
[2.2.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.2.0
[2.1.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.1.0
[2.0.6]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.6
[2.0.5]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.5
[2.0.4]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.4
[2.0.3]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.3
[2.0.2]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.2
[2.0.1]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.1
[2.0.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v2.0.0
[1.44.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.44.0
[1.43.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.43.0
[1.39.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.39.0
[1.36.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.36.0
[1.35.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.35.0
[1.34.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.34.0
[1.32.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.32.0
[1.31.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.31.0
[1.27.0]: https://github.com/Diegofuego871/ha-device-panel/releases/tag/v1.27.0
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
