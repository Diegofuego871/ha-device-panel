"""Magic Push (2.193.0): Zeit-Bedingung (Uhrzeit von/bis, Wochentage), allein oder verknüpft, Zeitgeber, Rückblick, Sicherung."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import backup, magic, magic_history
from custom_components.device_panel.const import DATA_MAGIC

from .test_magic import _rule, _sensor, _tick
from .test_magic_conditions import _leaf, _tree
from .test_outage_notify import _device, _options, setup  # noqa: F401, F811  (Fixture "setup")

# Dienstag, 10. März 2026 (Wochentag 1), Zeitzone UTC
TUE = datetime(2026, 3, 10, tzinfo=UTC)


def _ts(day: int, hour: int, minute: int = 0) -> float:
    return TUE.replace(day=day, hour=hour, minute=minute).timestamp()


def _time(start: str, end: str = "", days: list[int] | None = None) -> dict[str, Any]:
    return {"entity_id": "", "kind": "time", "from": start, "to": end, "days": days or []}


@pytest.fixture(autouse=True)
async def utc(hass: HomeAssistant) -> None:
    await hass.config.async_set_time_zone("UTC")


def test_time_met_window_and_days() -> None:
    window = _time("10:00", "12:00", [1])
    assert magic.time_met(window, _ts(10, 11)) is True
    assert magic.time_met(window, _ts(10, 9, 59)) is False
    assert magic.time_met(window, _ts(10, 12)) is False  # Ende zählt nicht mehr dazu
    assert magic.time_met(window, _ts(11, 11)) is False  # Mittwoch
    assert magic.time_met(_time("10:00", "12:00"), _ts(11, 11)) is True  # ohne Tage: jeden Tag
    # Ohne Ende: bis Mitternacht
    assert magic.time_met(_time("22:00"), _ts(10, 23, 59)) is True
    assert magic.time_met(_time("22:00"), _ts(11, 0)) is False


def test_time_met_over_midnight_belongs_to_start_day() -> None:
    night = _time("22:00", "06:00", [1])  # beginnt am Dienstag
    assert magic.time_met(night, _ts(10, 23)) is True
    assert magic.time_met(night, _ts(11, 3)) is True  # Mittwoch früh gehört noch zum Dienstag
    assert magic.time_met(night, _ts(10, 3)) is False  # Dienstag früh gehörte zum Montag
    assert magic.time_met(night, _ts(11, 23)) is False


async def test_clean_time_rule(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Lüftung")
    store = hass.data[DATA_MAGIC]
    base = {"device_id": device.id, "entity_id": "", "kind": "time", "name": "Filter", "for_s": 0, "message": "Filter tauschen"}
    saved = await store.async_save_rule({**base, "conditions": _tree("and", _time("10:00", "", [0, 2, 2]))})
    assert saved["entity_id"] == "" and saved["kind"] == "time"
    assert saved["conditions"]["items"] == [{"entity_id": "", "kind": "time", "value": None, "reset_value": None, "from": "10:00", "to": "", "days": [0, 2]}]
    for bad in (_time("10:00", "10:00"), _time("25:00"), _time("10:00", "", [7]), _time("10:00", "11:00", ["x"]), _time("10:00", "11:00")):
        # das letzte: ein Zeitfenster allein gilt den ganzen Zeitraum und braucht eine Gerätebedingung
        with pytest.raises(vol.Invalid):
            await store.async_save_rule({**base, "name": "Kaputt", "conditions": _tree("and", bad)})
    # ohne Baum gibt es keine Zeit
    with pytest.raises(vol.Invalid):
        await store.async_save_rule({**base, "name": "Leer"})
    assert magic.condition_text(hass, saved) == "time 10:00, Mon,Wed"


async def test_time_only_rule_fires_once_per_window(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    freezer.move_to("2026-03-10 09:00:00+00:00")
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Lüftung")
    store = hass.data[DATA_MAGIC]
    await store.async_save_rule(
        {"device_id": device.id, "entity_id": "", "kind": "time", "name": "Filter", "for_s": 0, "message": "Filter tauschen: {entity}", "recover": True, "recover_message": "Fenster zu",
         "conditions": _tree("and", _time("10:00"))}
    )
    await _tick(hass, freezer, 1800)
    assert calls == []
    await _tick(hass, freezer, 1801)  # 10:00
    assert [c.data["title"] for c in calls] == ["Filter tauschen: Lüftung"]
    await _tick(hass, freezer, 1200)  # 10:20: nicht noch einmal
    assert len(calls) == 1
    await _tick(hass, freezer, 14 * 3600)  # nach Mitternacht: der Tag ist um, "wieder normal"
    assert [c.data["title"] for c in calls][-1] == "Fenster zu" and len(calls) == 2
    await _tick(hass, freezer, 10 * 3600)  # am nächsten Tag 10:00 wieder
    assert len(calls) == 3 and calls[-1].data["title"].startswith("Filter tauschen")


async def test_time_only_rule_respects_weekdays(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    freezer.move_to("2026-03-10 09:00:00+00:00")  # Dienstag
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Lüftung")
    await hass.data[DATA_MAGIC].async_save_rule(
        {"device_id": device.id, "entity_id": "", "kind": "time", "name": "Mittwoch", "for_s": 0, "message": "Mittwochs", "conditions": _tree("and", _time("10:00", "", [2]))}
    )
    await _tick(hass, freezer, 3700)  # Dienstag 10:01: nichts
    assert calls == []
    await _tick(hass, freezer, 86400)  # Mittwoch 10:01
    assert [c.data["title"] for c in calls] == ["Mittwochs"]


async def test_time_combined_with_entity(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    freezer.move_to("2026-03-10 09:00:00+00:00")
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    hum = _sensor(hass, device, "hum", "60", "humidity", "%")
    rule = await hass.data[DATA_MAGIC].async_save_rule(
        _rule(device, hum, kind="above", value=75, for_s=0, message="Feucht und spät: {value}", conditions=_tree("and", _time("10:00", "12:00"), _leaf(hum, "above", 75)))
    )
    # die Entität bleibt die der alten Felder, auch wenn die Zeit zuerst steht
    assert rule["entity_id"] == hum and rule["kind"] == "above"
    hass.states.async_set(hum, "80", {"device_class": "humidity", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert calls == []  # feucht, aber noch nicht 10:00
    await _tick(hass, freezer, 3601)
    assert [c.data["title"] for c in calls] == ["Feucht und spät: 80"]


async def test_time_history_without_entities(hass: HomeAssistant) -> None:
    # Die Regel selbst verlangt für ein Zeitfenster eine Gerätebedingung; die Rechnung des Rückblicks geht auch allein
    tree = _tree("and", magic._clean_time(_time("10:00", "11:00")))
    start, now = _ts(10, 0), _ts(11, 0)
    intervals, fires, count, spans = magic_history.evaluate_tree({}, tree, 0, now, start)
    assert count == 1 and intervals == [[_ts(10, 10), _ts(10, 11), True]] and fires[0]["start"] == _ts(10, 10)
    assert spans[0] == [[_ts(10, 10), _ts(10, 11)]]


async def test_time_rule_backup_roundtrip(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Lüftung")
    store = hass.data[DATA_MAGIC]
    rule = await store.async_save_rule(
        {"device_id": device.id, "entity_id": "", "kind": "time", "name": "Filter", "for_s": 0, "message": "Filter tauschen", "conditions": _tree("and", _time("10:00", "", [0]))}
    )
    file = await backup.async_export(hass, ["magic"])
    await store.async_delete_rule(rule["id"])
    report = await backup.async_import(hass, file, ["magic"], dry_run=False)
    assert report["sections"]["magic"]["changed"] == 1
    back = store.get(rule["id"])
    assert back is not None and back["conditions"]["items"][0]["days"] == [0] and back["entity_id"] == ""
    assert report["sections"]["magic"]["changes"][0]["detail"] == "– · time"
