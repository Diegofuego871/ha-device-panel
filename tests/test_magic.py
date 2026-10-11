"""Magic Push (2.6.0): Prüfen, Variablen, Auslösen mit Dauer, Wiederholen, wieder normal, Neustart, Befehle, Rückblick."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_fire_time_changed, async_mock_service

from custom_components.device_panel import magic, magic_history
from custom_components.device_panel.const import DATA_MAGIC, DOMAIN

from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")


@pytest.mark.parametrize(
    ("kind", "value", "state", "expected"),
    [
        ("below", 12, "11.9", True),
        ("below", 12, "12", False),
        ("above", 75, "75.1", True),
        ("above", 75, "75", False),
        ("above", 75, "unavailable", None),
        ("above", 75, "kaputt", None),
        ("below", "x", "5", None),
        ("is", "on", "ON", True),
        ("is", "on", "off", False),
        ("is", 5, "5.0", True),
        ("is", "offen", "unknown", None),
        ("change", None, "1", None),
    ],
)
def test_cond_met(kind: str, value: Any, state: str, expected: bool | None) -> None:
    assert magic.cond_met(kind, value, state) is expected


def test_render_replaces_only_known_variables() -> None:
    ctx = {"value": "11,8", "unit": "°C"}
    assert magic.render("Nur {value} {unit} {unbekannt} {value.__class__}", ctx) == "Nur 11,8 °C {unbekannt} {value.__class__}"


def _sensor(hass: HomeAssistant, device: dr.DeviceEntry, key: str, state: str, cls: str | None = None, unit: str | None = None, domain: str = "sensor") -> str:
    entry = er.async_get(hass).async_get_or_create(domain, "test", f"{device.id}-{key}", device_id=device.id, original_device_class=cls, original_name=key)
    attrs: dict[str, Any] = {}
    if cls:
        attrs["device_class"] = cls
    if unit:
        attrs["unit_of_measurement"] = unit
    hass.states.async_set(entry.entity_id, state, attrs)
    return entry.entity_id


def _rule(device: dr.DeviceEntry, entity_id: str, **kwargs: Any) -> dict[str, Any]:
    return {
        "device_id": device.id,
        "entity_id": entity_id,
        "name": "Keller kalt",
        "kind": "below",
        "value": 12,
        "for_s": 600,
        "message": "Keller ist kalt: {value} {unit}",
        **kwargs,
    }


async def _tick(hass: HomeAssistant, freezer, seconds: float) -> None:
    # Zustandsänderungen erst verarbeiten lassen, sonst startet die Dauer nach dem Zeitsprung
    await hass.async_block_till_done()
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_validation(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Klima")
    other = _device(hass, "Anderes")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    foreign = _sensor(hass, other, "x", "1")
    magic_push = hass.data[DATA_MAGIC]
    for bad in (
        {**_rule(device, temp), "value": None},  # über/unter ohne Zahl
        {**_rule(device, temp), "name": ""},
        {**_rule(device, temp), "name": "x" * 61},
        {**_rule(device, temp), "message": ""},
        {**_rule(device, temp), "for_s": -1},
        {**_rule(device, temp), "for_s": 8 * 86400},
        {**_rule(device, temp), "kind": "gleich"},
        {**_rule(device, temp), "recover": True},  # ohne Text
        {**_rule(device, temp), "target": "light.kueche"},
        {**_rule(device, foreign)},  # Entität eines anderen Geräts
        {**_rule(device, "sensor.gibt_es_nicht")},
        {**_rule(device, temp), "device_id": "nichtda"},
        {**_rule(device, temp, kind="is"), "value": None},
    ):
        with pytest.raises(vol.Invalid):
            await magic_push.async_save_rule(bad)
    saved = await magic_push.async_save_rule({**_rule(device, temp), "name": "  Keller   kalt \n"})
    assert saved["name"] == "Keller kalt" and len(saved["id"]) == 12
    # "ändert sich": kein Wert, kein Normalzustand, keine Wiederholung
    change = await magic_push.async_save_rule(_rule(device, temp, kind="change", value=5, recover=True, recover_message="ok", repeat_s=60))
    assert change["value"] is None and change["recover"] is False and change["repeat_s"] == 0


async def test_limits(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    for i in range(magic.MAX_PER_DEVICE):
        await magic_push.async_save_rule({**_rule(device, temp), "name": f"Regel {i}"})
    with pytest.raises(vol.Invalid):
        await magic_push.async_save_rule(_rule(device, temp))


async def test_fires_after_duration_and_recovers(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    hass.config.language = "de"
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    rule = await magic_push.async_save_rule(
        _rule(device, temp, recover=True, recover_message="Wieder warm: {value} {unit} nach {duration}")
    )
    await hass.async_block_till_done()
    assert calls == []
    # unter der Schwelle, aber noch nicht lange genug
    hass.states.async_set(temp, "11.8", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 540)
    assert calls == []
    # zwischendurch wieder darüber: die Dauer beginnt von vorn, keine Meldung, keine "wieder normal"-Meldung
    hass.states.async_set(temp, "13", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 120)
    assert calls == []
    hass.states.async_set(temp, "11.5", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 599)
    assert calls == []
    await _tick(hass, freezer, 2)
    assert len(calls) == 1
    assert calls[0].data["title"] == "Keller ist kalt: 11,5 °C"
    assert calls[0].data["message"].startswith("Klimasensor Keller · seit 10 Min")
    data = calls[0].data["data"]
    assert data["tag"] == f"{DOMAIN}_magic_{rule['id']}" and data["url"] == f"/device-panel?device={device.id}"
    # bleibt so: nur einmal
    await _tick(hass, freezer, 3600)
    assert len(calls) == 1
    # wieder normal: eine Meldung mit der Dauer
    hass.states.async_set(temp, "12.6", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert len(calls) == 2
    assert calls[1].data["title"].startswith("Wieder warm: 12,6 °C nach ")
    assert "nach" in calls[1].data["message"]
    # noch einmal darunter: eine neue Auslösung
    hass.states.async_set(temp, "10", {"device_class": "temperature", "unit_of_measurement": "°C"})
    await _tick(hass, freezer, 601)
    assert len(calls) == 3


async def test_repeat_and_no_recover_by_default(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    hum = _sensor(hass, device, "hum", "60", "humidity", "%")
    await hass.data[DATA_MAGIC].async_save_rule(_rule(device, hum, kind="above", value=75, for_s=0, repeat_s=1800, message="Feucht: {value} {unit}"))
    hass.states.async_set(hum, "80", {"device_class": "humidity", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls] == ["Feucht: 80 %"]
    await _tick(hass, freezer, 1799)
    assert len(calls) == 1
    await _tick(hass, freezer, 2)
    assert len(calls) == 2
    await _tick(hass, freezer, 1800)
    assert len(calls) == 3
    # zurück: ohne "wieder normal" keine Meldung, und die Wiederholung hört auf
    hass.states.async_set(hum, "70", {"device_class": "humidity", "unit_of_measurement": "%"})
    await _tick(hass, freezer, 7200)
    assert len(calls) == 3


async def test_state_words_and_change(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    hass.config.language = "de"
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    window = _sensor(hass, device, "window", "off", "window", domain="binary_sensor")
    magic_push = hass.data[DATA_MAGIC]
    await magic_push.async_save_rule(
        _rule(device, window, kind="is", value="on", for_s=300, message="{entity} ist seit {duration} {value}", name="Fenster offen")
    )
    hass.states.async_set(window, "on", {"device_class": "window"})
    await _tick(hass, freezer, 301)
    assert [c.data["title"] for c in calls] == ["window ist seit 5 Min. offen"]
    # ändert sich: sofort, mit alt und neu als Wörter
    await magic_push.async_save_rule(_rule(device, window, kind="change", value=None, for_s=0, message="Fenster: {old} → {new}", name="Wechsel"))
    hass.states.async_set(window, "off", {"device_class": "window"})
    await hass.async_block_till_done()
    assert calls[-1].data["title"] == "Fenster: offen → geschlossen"
    assert calls[-1].data["message"] == "Klimasensor Keller · offen → geschlossen"
    # Attributänderung ohne neuen Zustand ist keine Änderung
    n = len(calls)
    hass.states.async_set(window, "off", {"device_class": "window", "x": 1})
    await hass.async_block_till_done()
    assert len(calls) == n


async def test_change_with_duration_needs_stable_value(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    mode = _sensor(hass, device, "mode", "heat", domain="select")
    await hass.data[DATA_MAGIC].async_save_rule(_rule(device, mode, kind="change", value=None, for_s=60, message="Modus {new}", name="Modus"))
    hass.states.async_set(mode, "cool")
    await _tick(hass, freezer, 30)
    hass.states.async_set(mode, "auto")  # vor Ablauf wieder geändert: der erste Wechsel gilt nicht
    await _tick(hass, freezer, 45)
    assert calls == []
    await _tick(hass, freezer, 30)
    assert [c.data["title"] for c in calls] == ["Modus auto"]


async def test_unavailable_changes_nothing(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    await hass.data[DATA_MAGIC].async_save_rule(_rule(device, temp, recover=True, recover_message="normal", for_s=60))
    hass.states.async_set(temp, "10", {"unit_of_measurement": "°C"})
    await _tick(hass, freezer, 30)
    hass.states.async_set(temp, "unavailable")  # weder auslösen noch beenden noch zurücksetzen
    await _tick(hass, freezer, 40)
    assert calls == []  # der Timer lief ab, während der Wert fehlte: keine Meldung ohne Wert
    # Wert kommt zurück und liegt weiter darunter: die Dauer zählt seit dem ersten Unterschreiten, also sofort
    hass.states.async_set(temp, "10", {"unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert len(calls) == 1
    hass.states.async_set(temp, "unavailable")
    await hass.async_block_till_done()
    assert len(calls) == 1  # keine "wieder normal"-Meldung wegen Ausfall


async def test_target_and_no_target(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    default = async_mock_service(hass, "notify", "handy")
    group = async_mock_service(hass, "notify", "familie")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    await magic_push.async_save_rule(_rule(device, temp, for_s=0, name="A"))
    await magic_push.async_save_rule(_rule(device, temp, for_s=0, name="B", target="notify.familie", message="Gruppe"))
    # Standard "keine Meldungen": nur die Regel mit eigenem Empfänger sendet
    hass.states.async_set(temp, "10", {"unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert default == [] and [c.data["title"] for c in group] == ["Gruppe"]
    await _options(hass, notify_service="notify.handy")
    hass.states.async_set(temp, "14", {"unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    hass.states.async_set(temp, "9", {"unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert len(default) == 1 and len(group) == 2


async def test_disable_delete_and_device_removal(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    rule = await magic_push.async_save_rule(_rule(device, temp, for_s=60))
    hass.states.async_set(temp, "10", {"unit_of_measurement": "°C"})
    await _tick(hass, freezer, 30)
    await magic_push.async_set_enabled(rule["id"], False)
    await _tick(hass, freezer, 120)
    assert calls == []
    # wieder einschalten: die Bedingung gilt noch, die Dauer beginnt neu
    await magic_push.async_set_enabled(rule["id"], True)
    await _tick(hass, freezer, 61)
    assert len(calls) == 1
    assert await magic_push.async_delete_rule(rule["id"]) is True and await magic_push.async_delete_rule(rule["id"]) is False
    hass.states.async_set(temp, "14", {"unit_of_measurement": "°C"})
    hass.states.async_set(temp, "10", {"unit_of_measurement": "°C"})
    await _tick(hass, freezer, 120)
    assert len(calls) == 1
    # Gerät entfernt: seine Regeln gehen mit
    other = await magic_push.async_save_rule(_rule(device, temp))
    dr.async_get(hass).async_remove_device(device.id)
    await hass.async_block_till_done()
    assert magic_push.get(other["id"]) is None


async def test_survives_restart(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    rule = await magic_push.async_save_rule(_rule(device, temp, for_s=0, recover=True, recover_message="normal"))
    hass.states.async_set(temp, "10", {"unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert len(calls) == 1
    await magic_push.async_stop()
    # Neuer Start: Regel, laufende Dauer und "schon gemeldet" kommen aus dem Speicher; keine zweite Meldung
    fresh = magic.MagicPush(hass)
    await fresh.async_start()
    await hass.async_block_till_done()
    assert fresh.get(rule["id"]) is not None
    assert fresh.runtime(rule["id"])["fired"] is True and fresh.runtime(rule["id"])["since"] is not None
    assert len(calls) == 1
    hass.states.async_set(temp, "14", {"unit_of_measurement": "°C"})
    await hass.async_block_till_done()
    assert [c.data["title"] for c in calls][-1] == "normal"
    await fresh.async_stop()


async def test_invalid_stored_rule_is_ignored(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    hass_storage[magic.STORE_KEY] = {"version": 1, "data": {"rules": {"abc": {"id": "abcdefabcdef", "kaputt": 1}}, "runtime": {}}}
    magic_push = magic.MagicPush(hass)
    await magic_push.async_start()
    assert magic_push.rules() == []
    await magic_push.async_stop()


async def test_preview_and_test_message(hass: HomeAssistant, setup) -> None:  # noqa: F811
    hass.config.language = "de"
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "14.25", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    draft = {"device_id": device.id, "entity_id": temp, "kind": "below", "value": 12, "for_s": 600, "message": "{entity}: {value} {unit}, Schwelle {threshold}"}
    title, message = magic_push.preview_raw(draft, "main")
    assert title == "temp: 14,25 °C, Schwelle 12" and message == "Klimasensor Keller · seit 10 Min."
    # unvollständig (noch kein Text): Vorschau leer statt Fehler
    assert magic_push.preview_raw({**draft, "message": ""}, "main") == ("", "")
    assert magic_push.preview_raw({**draft, "recover_message": "Wieder gut: {value}"}, "recover")[0] == "Wieder gut: 14,25"
    assert await magic_push.async_test({**draft, "name": "Test"}) is True
    assert calls[-1].data["title"] == "temp: 14,25 °C, Schwelle 12"


# -- Rückblick ---------------------------------------------------------------------


def test_history_evaluate_numbers() -> None:
    now = 100000.0
    rows = [(now - 80000, "14"), (now - 50000, "11.5"), (now - 47000, "11.0"), (now - 40000, "13"), (now - 5000, "11.9"), (now - 100, "unavailable")]
    intervals, fires, count = magic_history.evaluate(rows, "below", 12, 600, now)
    # erster Abschnitt 10000 s unter 12, tiefster Wert 11; zweiter 4900 s (bis "unavailable")
    assert count == 2
    assert fires[0]["start"] == now - 5000 and fires[0]["extreme"] == 11.9
    assert fires[1]["start"] == now - 50000 and fires[1]["extreme"] == 11.0 and fires[1]["duration"] == 10000
    assert intervals[0][2] is True
    # Dauer länger als alles: keine Auslösung, aber die Abschnitte bleiben
    intervals, fires, count = magic_history.evaluate(rows, "below", 12, 20000, now)
    assert count == 0 and fires == [] and len(intervals) == 2 and not intervals[0][2]


def test_history_evaluate_state_and_change() -> None:
    now = 10000.0
    rows = [(0.0, "off"), (1000.0, "on"), (1100.0, "off"), (5000.0, "on")]
    intervals, fires, count = magic_history.evaluate(rows, "is", "on", 300, now)
    assert count == 1 and fires[0]["start"] == 5000.0 and fires[0]["end"] is None  # läuft noch
    assert [i[2] for i in intervals] == [False, True]
    intervals, fires, count = magic_history.evaluate(rows, "change", None, 300, now)
    # Wechsel auf on (100 s, zu kurz), auf off (3900 s), auf on (5000 s)
    assert count == 2


def test_history_points_downsampled() -> None:
    rows = [(float(i * 60), str(i % 10)) for i in range(500)]
    pts = magic_history.points(rows, 0.0, 30000.0)
    assert len(pts) <= magic_history.MAX_POINTS and pts[-1][0] <= 30000.0
    assert magic_history.points([(0.0, "unavailable")], 0.0, 10.0) == []


async def test_history_without_recorder_and_with_rows(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14", "temperature", "°C")
    result = await magic_history.async_history(hass, temp, "below", 12, 600)
    assert result["available"] is False and result["points"] == [] and result["count"] == 0
    now = time.time()
    hass.config.components.add("recorder")

    class _Instance:
        async def async_add_executor_job(self, func, *args):
            return [(now - 5000, "14"), (now - 3000, "11"), (now - 1000, "14")]

    with patch("homeassistant.components.recorder.get_instance", return_value=_Instance()):
        result = await magic_history.async_history(hass, temp, "below", 12, 600, now=now)
    assert result["available"] and not result["empty"] and result["count"] == 1 and result["kind"] == "number"
    assert result["fires"][0]["extreme"] == 11.0
    # leer: der Verlauf darf leer sein
    class _Empty:
        async def async_add_executor_job(self, func, *args):
            return []

    with patch("homeassistant.components.recorder.get_instance", return_value=_Empty()):
        result = await magic_history.async_history(hass, temp, "below", 12, 600, now=now)
    assert result["available"] and result["empty"] and result["count"] == 0


# -- Befehle -------------------------------------------------------------------------


async def test_websocket_commands(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    group = async_mock_service(hass, "notify", "familie")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    window = _sensor(hass, device, "window", "off", "window", domain="binary_sensor")
    client = await hass_ws_client(hass)

    async def call(command: str, **payload: Any) -> dict[str, Any]:
        call.n += 1
        await client.send_json({"id": call.n, "type": f"{DOMAIN}/{command}", **payload})
        return await client.receive_json()

    call.n = 0
    got = (await call("magic_get", device_id=device.id))["result"]
    assert got["rules"] == [] and got["default_target"] == "notify.handy"
    by_id = {e["entity_id"]: e for e in got["entities"]}
    assert by_id[temp]["kind"] == "number" and by_id[temp]["value"] == "14,2" or by_id[temp]["value"] == "14.2"
    assert by_id[window]["kind"] == "state" and [o["value"] for o in by_id[window]["options"]] == ["on", "off"]
    assert {t["value"] for t in got["targets"]} >= {"notify.handy", "notify.familie"}
    assert got["variables"]["number"] == ["value", "unit", "threshold"]
    assert not (await call("magic_get", device_id="nichtda"))["success"]

    saved = await call("magic_save", rule=_rule(device, temp, for_s=0))
    assert saved["success"]
    rule_id = saved["result"]["rule"]["id"]
    bad = await call("magic_save", rule={**_rule(device, temp), "value": None})
    assert not bad["success"] and bad["error"]["code"] == "invalid_format"
    assert (await call("magic_get", device_id=device.id))["result"]["rules"][0]["id"] == rule_id

    renamed = await call("magic_save", rule={**_rule(device, temp, for_s=0), "id": rule_id, "name": "Neuer Name"})
    assert renamed["result"]["rule"]["name"] == "Neuer Name" and renamed["result"]["rule"]["id"] == rule_id
    assert not (await call("magic_save", rule={**_rule(device, temp), "id": "0" * 12}))["success"]

    preview = await call("magic_preview", rule={**_rule(device, temp), "message": "Jetzt {value}"})
    assert preview["result"]["title"] == "Jetzt 14,2" or preview["result"]["title"] == "Jetzt 14.2"
    assert (await call("magic_test", rule={**_rule(device, temp), "target": "notify.familie"}))["result"]["sent"] is True
    assert len(group) == 1 and calls == []

    off = await call("magic_enable", rule_id=rule_id, enabled=False)
    assert off["result"]["rule"]["enabled"] is False
    assert not (await call("magic_enable", rule_id="0" * 12, enabled=True))["success"]
    history = await call("magic_history", entity_id=temp, kind="below", value=12, for_s=600)
    assert history["result"]["available"] is False
    assert not (await call("magic_history", entity_id="../x", kind="below"))["success"]
    deleted = await call("magic_delete", rule_id=rule_id)
    assert deleted["result"] == {"deleted": rule_id}
    assert not (await call("magic_delete", rule_id=rule_id))["success"]


def test_state_words() -> None:
    class _Hass:
        class config:
            language = "de"

    assert magic.state_word(_Hass(), "binary_sensor", "window", "on") == "offen"  # type: ignore[arg-type]
    assert magic.state_word(_Hass(), "binary_sensor", "moisture", "off") == "trocken"  # type: ignore[arg-type]
    assert magic.state_word(_Hass(), "binary_sensor", None, "on") == "ein"  # type: ignore[arg-type]
    assert magic.state_word(_Hass(), "lock", None, "unlocked") == "entriegelt"  # type: ignore[arg-type]
    assert magic.state_word(_Hass(), "sensor", None, "irgendwas") == "irgendwas"  # type: ignore[arg-type]
