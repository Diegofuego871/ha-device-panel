"""
Gleiche Wahl der Lebenszeichen im Server und im Popup (2.204.1): tests/panel/fixtures/liveness-cases.json hält Fälle mit dem Ergebnis von
liveness_entities fest; dieser Test prüft den Server, die Suite liveness-cases-e2e das Popup (_lconnState) gegen dieselbe Datei.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from homeassistant.const import EntityCategory
from homeassistant.helpers.entity_registry import RegistryEntryHider

from custom_components.device_panel.devices import liveness_entities

CASES = Path(__file__).parent / "panel" / "fixtures" / "liveness-cases.json"


def _entry(e: dict) -> SimpleNamespace:
    tier = e["liveness_tier"]
    return SimpleNamespace(
        entity_id=e["entity_id"],
        disabled_by=None,
        domain=e["entity_id"].split(".")[0],
        device_class="connectivity" if e["connectivity"] else None,
        original_device_class=None,
        entity_category=EntityCategory.DIAGNOSTIC if tier == 3 else None,
        hidden_by=RegistryEntryHider.USER if tier == 2 else None,
    )


def test_server_matches_the_cases() -> None:
    cases = json.loads(CASES.read_text(encoding="utf-8"))
    assert len(cases) >= 100
    for case in cases:
        conn = {e["entity_id"] for e in case["entities"] if e["connectivity"]}
        exclude = set(case["marked"]) | (set() if case["on"] else conn)
        relevant, _ = liveness_entities([_entry(e) for e in case["entities"]], frozenset(exclude))
        assert sorted(r.entity_id for r in relevant) == case["expected"], case
