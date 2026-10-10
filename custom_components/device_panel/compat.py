"""
Verträglichkeit mit verschiedenen Home-Assistant-Versionen beim Gerät-Register.

Zweite Veraltung (HA 2026.10, Log des Nutzers): `device_registry.devices` als Abbildung zu
benutzen (`.values()`, `.get()`, `[…]`) meldet ebenfalls; die Sammlung wird iteriert und liefert
dann die Einträge. Ältere HA liefern beim Iterieren die IDs, dort bleibt `.values()`.

Seit HA 2026.8 hat ein Gerät genau einen Eintrag (`config_entry_id`); die Eigenschaften
`config_entries` und `primary_config_entry` sind veraltet. Ab HA 2026.10 meldet jedes Lesen
davon zur Laufzeit (`report_usage` untersucht dazu den Aufrufstapel). Das Panel liest sie
pro Gerät mehrfach je Abfrage: bei einigen hundert Geräten Tausende Meldungen, die den
Event-Loop von Home Assistant minutenlang blockieren. Darum nie `config_entries` direkt
lesen, sondern `device_entry_ids()` (tests/test_compat.py prüft den Quelltext).
"""

from __future__ import annotations

from typing import Any

_MISSING = object()


def device_entry_ids(device: Any) -> list[str]:
    """
    IDs der Config-Einträge eines Geräts. Neue HA: `config_entry_id`. Ältere HA (und
    zusammengesetzte Geräte alter IDs, bei denen das Lesen nicht meldet): `config_entries`.
    """
    if not getattr(device, "is_composite_device", False):
        entry_id = getattr(device, "config_entry_id", _MISSING)
        if entry_id is not _MISSING:
            return [entry_id] if entry_id else []
    return list(device.config_entries)


def device_primary_entry_id(device: Any) -> str | None:
    """Config-Eintrag, nach dem Integration und Ausschlüsse eines Geräts gehen."""
    if not getattr(device, "is_composite_device", False):
        entry_id = getattr(device, "config_entry_id", _MISSING)
        if entry_id is not _MISSING:
            return entry_id or None
    return getattr(device, "primary_config_entry", None) or next(iter(device.config_entries), None)


def registry_devices(dev_reg: Any) -> list[Any]:
    """
    Alle Geräte des Registers. Neue HA: Iterieren liefert die Einträge (`.values()` meldet).
    Ältere HA: Iterieren liefert die IDs, dann gilt `.values()`.
    """
    devices = dev_reg.devices
    items = list(devices)
    if items and isinstance(items[0], str):
        return list(devices.values())
    return items
