"""Verträglichkeit mit HA 2026.10: veraltete Eigenschaften des Geräts nie lesen (1.31.1)."""

from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel.compat import device_entry_ids, device_primary_entry_id, registry_devices

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


def test_registry_devices_old_and_new_style() -> None:
    old = SimpleNamespace(devices={"id1": "entry1", "id2": "entry2"})  # ältere HA: Iterieren liefert IDs
    assert registry_devices(old) == ["entry1", "entry2"]

    class _New(list):
        def values(self):  # meldet in HA 2026.10; darf nie aufgerufen werden
            raise AssertionError("values() gelesen")

    entries = [SimpleNamespace(id="e1"), SimpleNamespace(id="e2")]
    assert registry_devices(SimpleNamespace(devices=_New(entries))) == entries
    assert registry_devices(SimpleNamespace(devices={})) == []


async def test_registry_devices_with_real_registry(hass: HomeAssistant) -> None:
    source = MockConfigEntry(domain="test", title="t")
    source.add_to_hass(hass)
    reg = dr.async_get(hass)
    device = reg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "a")}, name="A")
    assert [d.id for d in registry_devices(reg)] == [device.id]


def test_no_direct_reads_of_deprecated_device_properties() -> None:
    """Ausser in compat.py liest kein Modul `config_entries` oder `primary_config_entry` eines Geräts."""
    bad = []
    for path in sorted(SRC.glob("*.py")):
        if path.name == "compat.py":
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            code = line.split("#", 1)[0]
            if re.search(r"\.devices\.(values|items|keys|get)\(|\.devices\[", code) and "dr." in code:
                bad.append(f"{path.name}:{number}: {line.strip()}")
            if re.search(r"(?<!hass)\.config_entries\b(?!\s+import)", code) or "primary_config_entry" in code or "config_entries_subentries" in code:
                bad.append(f"{path.name}:{number}: {line.strip()}")
    assert not bad, "\n".join(bad)
