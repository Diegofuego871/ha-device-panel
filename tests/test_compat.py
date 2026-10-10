"""Verträglichkeit mit HA 2026.10: veraltete Eigenschaften des Geräts nie lesen (1.31.1)."""

from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace

from custom_components.device_panel.compat import device_entry_ids, device_primary_entry_id

SRC = Path(__file__).parent.parent / "custom_components" / "device_panel"


class _Reporting:
    """Wie HA 2026.10: jedes Lesen der veralteten Eigenschaften wird gezählt."""

    def __init__(self, **attrs):
        self.reads = 0
        self.__dict__.update(attrs)

    @property
    def config_entries(self):
        self.reads += 1
        return {"old-entry"}

    @property
    def primary_config_entry(self):
        self.reads += 1
        return "old-entry"


def test_new_ha_reads_single_entry_without_deprecated_properties() -> None:
    device = _Reporting(config_entry_id="e1", is_composite_device=False)
    assert device_entry_ids(device) == ["e1"]
    assert device_primary_entry_id(device) == "e1"
    assert device.reads == 0


def test_new_ha_orphan_has_no_entry() -> None:
    device = _Reporting(config_entry_id=None, is_composite_device=False)
    assert device_entry_ids(device) == []
    assert device_primary_entry_id(device) is None
    assert device.reads == 0


def test_composite_device_reads_all_entries() -> None:
    # Zusammengesetztes Gerät: Lesen meldet nicht und liefert die Vereinigung.
    device = SimpleNamespace(config_entry_id=None, is_composite_device=True, config_entries={"a", "b"}, primary_config_entry="a")
    assert sorted(device_entry_ids(device)) == ["a", "b"]
    assert device_primary_entry_id(device) == "a"


def test_old_ha_falls_back_to_config_entries() -> None:
    device = SimpleNamespace(config_entries={"x"}, primary_config_entry="x")
    assert device_entry_ids(device) == ["x"]
    assert device_primary_entry_id(device) == "x"
    assert device_primary_entry_id(SimpleNamespace(config_entries=set())) is None


def test_no_direct_reads_of_deprecated_device_properties() -> None:
    """Ausser in compat.py liest kein Modul `config_entries` oder `primary_config_entry` eines Geräts."""
    bad = []
    for path in sorted(SRC.glob("*.py")):
        if path.name == "compat.py":
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            code = line.split("#", 1)[0]
            if re.search(r"(?<!hass)\.config_entries\b(?!\s+import)", code) or "primary_config_entry" in code or "config_entries_subentries" in code:
                bad.append(f"{path.name}:{number}: {line.strip()}")
    assert not bad, "\n".join(bad)
