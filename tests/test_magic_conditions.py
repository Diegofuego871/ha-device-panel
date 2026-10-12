"""Magic Push (2.15.0): mehrere verknüpfte Bedingungen (Und/Oder, eine Ebene Gruppen), Rückblick, Befehle."""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import magic, magic_history
from custom_components.device_panel.const import DATA_MAGIC, DOMAIN

from .test_magic import _rule, _sensor, _tick
from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")

TEMP = {"device_class": "temperature", "unit_of_measurement": "°C"}


def _leaf(entity_id: str, kind: str, value: Any, reset: Any = None) -> dict[str, Any]:
    return {"entity_id": entity_id, "kind": kind, "value": value, "reset_value": reset}


def _tree(op: str, *items: dict[str, Any]) -> dict[str, Any]:
    return {"op": op, "items": list(items)}


def _group(op: str, *items: dict[str, Any]) -> dict[str, Any]:
    return {"op": op, "items": list(items)}


@pytest.mark.parametrize(
    ("op", "values", "expected"),
    [
        ("and", [True, True], True),
        ("and", [True, False], False),
        ("and", [True, None], None),  # nicht beurteilbar: keine Meldung
        ("and", [False, None], False),
        ("or", [False, False], False),
        ("or", [False, True], True),
        ("or", [None, True], True),
        ("or", [None, False], False),  # nicht beurteilbare zählen nicht
        ("or", [None, None], None),
    ],
)
def test_combine(op: str, values: list[bool | None], expected: bool | None) -> None:
    assert magic.combine(op, values) is expected


def test_tree_helpers() -> None:
    tree = _tree("and", _leaf("sensor.a", "below", 12), _group("or", _leaf("sensor.b", "is", "on"), _leaf("sensor.a", "above", 30)))
    assert [leaf["entity_id"] for leaf in magic.tree_leaves(tree)] == ["sensor.a", "sensor.b", "sensor.a"]
    rule = {"entity_id": "sensor.a", "kind": "below", "value": 12, "reset_value": None, "conditions": tree}
    assert magic.rule_entities(rule) == ["sensor.a", "sensor.b"]
    # Ohne Baum: die eine Bedingung der alten Felder
    single = {"entity_id": "sensor.a", "kind": "below", "value": 12, "reset_value": 14, "conditions": None}
    assert magic.rule_tree(single)["items"] == [{"entity_id": "sensor.a", "kind": "below", "value": 12, "reset_value": 14}]
    assert magic.has_reset(single) and not magic.has_reset(rule)


async def test_validation_of_conditions(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    window = _sensor(hass, device, "window", "off", "window", domain="binary_sensor")
    magic_push = hass.data[DATA_MAGIC]
    base = _rule(device, temp)
    good = _tree("and", _leaf(temp, "below", 12), _leaf(window, "is", "on"))
    for bad in (
        _tree("and", _leaf(temp, "below", 12), _leaf("sensor.gibt_es_nicht", "above", 1)),
        _tree("and", _leaf(temp, "below", 12), _leaf(window, "change", None)),  # ändert sich nur allein
        _tree("and", _leaf(temp, "change", None), _leaf(window, "is", "on")),
        _tree("and", _leaf(temp, "below", 12), _leaf(window, "is", "")),
        _tree("and", _leaf(temp, "below", 12), _leaf(temp, "above", None)),
        _tree("xor", _leaf(temp, "below", 12), _leaf(window, "is", "on")),
        _tree("and", _leaf(temp, "below", 12), _group("or", _group("and", _leaf(window, "is", "on")))),  # keine Gruppe in der Gruppe
        _tree("and", _leaf(temp, "below", 12), _group("or")),  # leere Gruppe
        _tree("and", _leaf(temp, "below", 12), _leaf(temp, "above", 20, reset=25)),  # Rücksetzwert auf der falschen Seite
        _tree("and", *[_leaf(temp, "below", i) for i in range(magic.MAX_LEAVES + 1)]),
        _tree("and", _leaf(temp, "below", 12), *[_group("or", _leaf(window, "is", "on")) for _ in range(magic.MAX_GROUPS + 1)]),
        {"op": "and", "items": []},
        {"op": "and"},
    ):
        with pytest.raises(vol.Invalid):
            await magic_push.async_save_rule({**base, "conditions": bad})
    saved = await magic_push.async_save_rule({**base, "conditions": good, "name": "Keller"})
    # Die erste Bedingung steht in den alten Feldern, der Baum ist bereinigt gespeichert
    assert (saved["entity_id"], saved["kind"], saved["value"]) == (temp, "below", 12.0)
    assert saved["conditions"]["items"][1] == {"entity_id": window, "kind": "is", "value": "on", "reset_value": None}
    # Eine Bedingung im Baum zählt als eine: kein Baum gespeichert, und "ändert sich" bleibt dann erlaubt
    one = await magic_push.async_save_rule({**base, "conditions": _tree("and", _leaf(temp, "change", None)), "name": "Eine"})
    assert one["conditions"] is None and one["kind"] == "change"
    # Der Baum gewinnt gegen widersprüchliche alte Felder
    mixed = await magic_push.async_save_rule({**base, "entity_id": window, "kind": "is", "value": "on", "conditions": good, "name": "Gemischt"})
    assert (mixed["entity_id"], mixed["kind"]) == (temp, "below")
    # Gruppe mit Und/Oder und Rücksetzwert je Bedingung
    grouped = await magic_push.async_save_rule(
        {**base, "name": "Gruppe", "conditions": _tree("and", _leaf(temp, "below", 12, 14), _group("or", _leaf(window, "is", "on"), _leaf(temp, "above", 30, 28)))}
    )
    assert grouped["conditions"]["items"][0]["reset_value"] == 14.0
    assert grouped["conditions"]["items"][1]["items"][1]["reset_value"] == 28.0


async def test_and_fires_only_when_all_hold(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    hass.config.language = "de"
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    window = _sensor(hass, device, "window", "off", "window", domain="binary_sensor")
    magic_push = hass.data[DATA_MAGIC]
    await magic_push.async_save_rule(
        _rule(
            device, temp, message="Kalt und offen: {conditions}", for_s=300, recover=True, recover_message="Vorbei: {value} {unit}",
            conditions=_tree("and", _leaf(temp, "below", 12), _leaf(window, "is", "on")),
        )
    )
    await hass.async_block_till_done()
    # nur die Temperatur gilt: nichts
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 400)
    assert calls == []
    # jetzt geht das Fenster auf: die Dauer beginnt mit dem Moment, in dem alles gilt (Änderung der zweiten Entität löst aus)
    hass.states.async_set(window, "on", {"device_class": "window"})
    await _tick(hass, freezer, 299)
    assert calls == []
    await _tick(hass, freezer, 2)
    assert len(calls) == 1
    assert calls[0].data["title"] == "Kalt und offen: temp unter 12 °C und window ist offen"
    # Fenster zu: die Gesamtbedingung gilt nicht mehr, "wieder normal"
    hass.states.async_set(window, "off", {"device_class": "window"})
    await hass.async_block_till_done()
    assert len(calls) == 2 and calls[1].data["title"].startswith("Vorbei: 11")


async def test_or_and_groups(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    hum = _sensor(hass, device, "hum", "50", "humidity", "%")
    window = _sensor(hass, device, "window", "off", "window", domain="binary_sensor")
    magic_push = hass.data[DATA_MAGIC]
    # Temperatur unter 12 UND (Fenster offen ODER Feuchte über 70)
    await magic_push.async_save_rule(
        _rule(device, temp, for_s=0, conditions=_tree("and", _leaf(temp, "below", 12), _group("or", _leaf(window, "is", "on"), _leaf(hum, "above", 70))))
    )
    await hass.async_block_till_done()
    hass.states.async_set(window, "on", {"device_class": "window"})  # Temperatur gilt nicht
    await hass.async_block_till_done()
    assert calls == []
    hass.states.async_set(temp, "10", TEMP)  # kalt und Fenster offen
    await hass.async_block_till_done()
    assert len(calls) == 1
    hass.states.async_set(window, "off", {"device_class": "window"})  # weder offen noch feucht: die Episode endet
    await hass.async_block_till_done()
    hass.states.async_set(hum, "80", {"device_class": "humidity", "unit_of_measurement": "%"})  # kalt und feucht: neue Episode
    await hass.async_block_till_done()
    assert len(calls) == 2
    hass.states.async_set(window, "on", {"device_class": "window"})  # beide Teile der Gruppe gelten: dieselbe Episode, keine neue Meldung
    await hass.async_block_till_done()
    assert len(calls) == 2
    # oben Oder: eine Bedingung genügt
    await magic_push.async_save_rule(_rule(device, temp, name="Oder", for_s=0, message="Oder {conditions}", conditions=_tree("or", _leaf(temp, "above", 40), _leaf(window, "is", "on"))))
    await hass.async_block_till_done()
    hass.states.async_set(window, "on", {"device_class": "window"})
    await hass.async_block_till_done()
    assert calls[-1].data["title"] == "Oder temp above 40 °C or window is open"


async def test_unavailable_in_and_and_or(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "10", "temperature", "°C")
    window = _sensor(hass, device, "window", "on", "window", domain="binary_sensor")
    magic_push = hass.data[DATA_MAGIC]
    and_rule = await magic_push.async_save_rule(_rule(device, temp, name="Und", for_s=0, recover=True, recover_message="ok", conditions=_tree("and", _leaf(temp, "below", 12), _leaf(window, "is", "on"))))
    await hass.async_block_till_done()
    assert len(calls) == 1  # beim Speichern gilt alles schon
    # Fenster nicht erreichbar: bei Und nicht beurteilbar, nichts passiert (kein "wieder normal")
    hass.states.async_set(window, "unavailable", {"device_class": "window"})
    await hass.async_block_till_done()
    assert len(calls) == 1 and magic_push.runtime(and_rule["id"])["since"] is not None
    hass.states.async_set(window, "off", {"device_class": "window"})
    await hass.async_block_till_done()
    assert len(calls) == 2  # wieder normal
    # Oder: die nicht erreichbare Entität zählt nicht
    await magic_push.async_delete_rule(and_rule["id"])
    calls.clear()
    hass.states.async_set(window, "unavailable", {"device_class": "window"})
    await magic_push.async_save_rule(_rule(device, temp, name="Oder", for_s=0, conditions=_tree("or", _leaf(temp, "below", 12), _leaf(window, "is", "on"))))
    await hass.async_block_till_done()
    assert len(calls) == 1


async def test_reset_value_per_condition(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    hum = _sensor(hass, device, "hum", "40", "humidity", "%")
    magic_push = hass.data[DATA_MAGIC]
    # Feuchte über 70 (zurück bis 60) UND Temperatur unter 12: der Rücksetzwert gilt für die zweite Bedingung
    rule = await magic_push.async_save_rule(
        _rule(device, hum, for_s=0, recover=True, recover_message="zurück", conditions=_tree("and", _leaf(hum, "above", 70, 60), _leaf(temp, "below", 12, 14)))
    )
    hass.states.async_set(temp, "10", TEMP)
    hass.states.async_set(hum, "75", {"device_class": "humidity", "unit_of_measurement": "%"})
    await hass.async_block_till_done()
    assert len(calls) == 1
    # Temperatur im Zwischenbereich (12 bis 14): Bedingung gilt noch, still
    hass.states.async_set(temp, "13", TEMP)
    await hass.async_block_till_done()
    assert len(calls) == 1 and magic_push.runtime(rule["id"])["since"] is not None
    # über dem Rücksetzwert: wieder normal
    hass.states.async_set(temp, "14.5", TEMP)
    await hass.async_block_till_done()
    assert len(calls) == 2


async def test_payload_variables_and_restart(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    other = _device(hass, "Anderes")
    outside = _sensor(hass, other, "aussen", "5", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    saved = await magic_push.async_save_rule(_rule(device, temp, conditions=_tree("and", _leaf(temp, "below", 12), _leaf(outside, "below", 8))))
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/magic_get", "device_id": device.id})
    got = (await client.receive_json())["result"]
    rule = got["rules"][0]
    assert rule["conditions"]["items"][1]["entity_id"] == outside
    assert "conditions" in got["variables"]["common"]
    # die Entität eines anderen Geräts kommt als zusätzliche mit
    assert outside in [e["entity_id"] for e in got["extra_entities"]]
    assert "unter 12" in rule["condition_text"] or "below 12" in rule["condition_text"]
    # eine einzelne Bedingung liefert ebenfalls einen Baum
    single = await magic_push.async_save_rule(_rule(device, temp, name="Einzeln"))
    await client.send_json({"id": 2, "type": f"{DOMAIN}/magic_list"})
    listed = (await client.receive_json())["result"]["rules"]
    by_name = {r["name"]: r for r in listed}
    assert len(by_name["Einzeln"]["conditions"]["items"]) == 1 and by_name["Einzeln"]["conditions"].get("op") == "and"
    assert set(by_name["Keller kalt"]["leaf_entities"]) == {temp, outside}
    # Speichern und Lesen über die Befehle
    await client.send_json({"id": 3, "type": f"{DOMAIN}/magic_save", "rule": {**_rule(device, temp, name="Neu"), "conditions": _tree("or", _leaf(temp, "below", 5), _leaf(outside, "above", 30))}})
    result = await client.receive_json()
    assert result["success"] and result["result"]["rule"]["conditions"]["op"] == "or"
    await client.send_json({"id": 4, "type": f"{DOMAIN}/magic_save", "rule": {**_rule(device, temp, name="Schlecht"), "conditions": _tree("and", _leaf(temp, "below", 5), _leaf(outside, "change", None))}})
    assert not (await client.receive_json())["success"]
    # Neustart: gespeicherte Regel mit Bedingungen wird gelesen
    stored = magic.clean_stored({**saved, "id": saved["id"]})
    assert stored["conditions"]["items"][1]["entity_id"] == outside
    with pytest.raises(vol.Invalid):
        magic.clean_stored({**saved, "conditions": _tree("and", _leaf(temp, "change", None), _leaf(outside, "is", "x"))})
    assert single["conditions"] is None


def test_history_evaluate_tree() -> None:
    now = 10_000.0
    start = now - 86400
    # Temperatur ist ab t=1000 bis t=5000 unter 12, das Fenster von t=3000 bis t=7000 offen: zusammen 3000 bis 5000 (2000 s)
    rows = {
        "sensor.t": [(start, "15"), (1000.0, "10"), (5000.0, "15")],
        "binary_sensor.w": [(start, "off"), (3000.0, "on"), (7000.0, "off")],
    }
    tree = _tree("and", _leaf("sensor.t", "below", 12), _leaf("binary_sensor.w", "is", "on"))
    intervals, fires, count, spans = magic_history.evaluate_tree(rows, tree, 600, now, start)
    assert count == 1 and fires[0]["start"] == 3000.0 and fires[0]["duration"] == 2000.0 and intervals == [[3000.0, 5000.0, True]]
    assert spans[0] == [[1000.0, 5000.0]] and spans[1] == [[3000.0, 7000.0]]
    # zu kurz für die Dauer: der Abschnitt zählt nicht
    _i, fires_long, count_long, _s = magic_history.evaluate_tree(rows, tree, 3000, now, start)
    assert count_long == 0 and fires_long == []
    # Oder: von 1000 bis 7000 gilt eine der beiden
    or_tree = _tree("or", _leaf("sensor.t", "below", 12), _leaf("binary_sensor.w", "is", "on"))
    intervals_or, _f, count_or, _s = magic_history.evaluate_tree(rows, or_tree, 600, now, start)
    assert count_or == 1 and intervals_or == [[1000.0, 7000.0, True]]


async def test_history_with_conditions(hass: HomeAssistant, setup, hass_ws_client) -> None:  # noqa: F811
    device = _device(hass, "Klima")
    temp = _sensor(hass, device, "temp", "14.2", "temperature", "°C")
    window = _sensor(hass, device, "window", "off", "window", domain="binary_sensor")
    # Ohne Recorder: "nicht verfügbar", mit Baum kein Fehler
    result = await magic_history.async_history(hass, temp, "below", 12, 600, conditions=_tree("and", _leaf(temp, "below", 12), _leaf(window, "is", "on")))
    assert result["available"] is False
    # Ungültiger Baum: Fehler als Antwort des Befehls
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/magic_history", "entity_id": temp, "kind": "below", "value": 12, "for_s": 0, "conditions": _tree("and", _leaf(temp, "below", 12), _leaf(window, "change", None))})
    assert not (await client.receive_json())["success"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/magic_history", "entity_id": temp, "kind": "below", "value": 12, "for_s": 0, "conditions": _tree("and", _leaf(temp, "below", 12), _leaf(window, "is", "on"))})
    assert (await client.receive_json())["success"]


# -- Zurücksetzen erst nach Dauer (2.17.0) -----------------------------------------------------


async def test_reset_for_validation(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    assert (await magic_push.async_save_rule(_rule(device, temp)))["reset_for_s"] == 0  # Vorgabe: sofort wie bisher
    saved = await magic_push.async_save_rule(_rule(device, temp, name="zwei", reset_for_s=300))
    assert saved["reset_for_s"] == 300
    for bad in (-1, magic.FOR_MAX + 1, "x"):
        with pytest.raises(vol.Invalid):
            await magic_push.async_save_rule(_rule(device, temp, name="bad", reset_for_s=bad))
    # "ändert sich" kennt kein Zurücksetzen
    change = await magic_push.async_save_rule(_rule(device, temp, kind="change", value=None, name="Änderung", reset_for_s=300))
    assert change["reset_for_s"] == 0
    # Alte gespeicherte Regeln ohne das Feld laufen weiter (sofort)
    legacy = {k: v for k, v in saved.items() if k != "reset_for_s"}
    assert magic.clean_stored(legacy)["reset_for_s"] == 0


async def test_reset_for_delays_recover_and_swallows_flapping(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    """Unter 12 melden, "wieder normal" erst, wenn es 5 Minuten durchgehend nicht mehr gilt; Flattern bleibt eine Episode."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    await magic_push.async_save_rule(_rule(device, temp, for_s=0, reset_for_s=300, recover=True, recover_message="Wieder warm: {value}"))

    async def set_temp(value: str) -> None:
        hass.states.async_set(temp, value, TEMP)
        await _tick(hass, freezer, 0)

    await set_temp("11")
    assert len(calls) == 1
    # Flattern um die Schwelle: weder "wieder normal" noch eine zweite Meldung
    for value in ("12.5", "11", "12.5", "11", "12.5"):
        await set_temp(value)
        await _tick(hass, freezer, 100)
    assert len(calls) == 1
    # 12.5 hält jetzt 100 s; nach insgesamt 300 s durchgehend normal kommt "wieder normal"
    await _tick(hass, freezer, 150)
    assert len(calls) == 1
    await _tick(hass, freezer, 60)
    assert len(calls) == 2 and calls[1].data["title"] == "Wieder warm: 12.5"
    # neue Episode: wieder eine Meldung
    await set_temp("11")
    assert len(calls) == 3


async def test_reset_for_with_reset_zone_and_before_firing(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    """Mit eigenem Rücksetzwert zählt die Dauer erst ab dem Rücksetzwert; vor der Meldung gibt es keine Wartezeit."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    await magic_push.async_save_rule(_rule(device, temp, for_s=0, reset_value=14, reset_for_s=300, recover=True, recover_message="Wieder warm"))

    async def set_temp(value: str) -> None:
        hass.states.async_set(temp, value, TEMP)
        await _tick(hass, freezer, 0)

    await set_temp("11")
    assert len(calls) == 1
    await set_temp("13")  # Zwischenbereich: keine Wartezeit läuft
    await _tick(hass, freezer, 1000)
    assert len(calls) == 1
    await set_temp("14.5")  # Rücksetzwert erreicht: Wartezeit beginnt
    await _tick(hass, freezer, 200)
    await set_temp("13")  # zurück in die Zone: Wartezeit verfällt
    await _tick(hass, freezer, 400)
    assert len(calls) == 1
    await set_temp("14.5")
    await _tick(hass, freezer, 301)
    assert len(calls) == 2 and calls[1].data["title"] == "Wieder warm"

async def test_reset_for_not_before_firing(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    """Vor der Meldung (Dauer 600) beginnt ein Ausflug die Dauer von vorn; die Wartezeit zum Zurücksetzen gilt nicht."""
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    magic_push = hass.data[DATA_MAGIC]
    await magic_push.async_save_rule(_rule(device, temp, for_s=600, reset_for_s=300))
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 300)
    hass.states.async_set(temp, "20", TEMP)
    await _tick(hass, freezer, 0)
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 400)
    assert calls == []  # die Dauer begann nach dem Ausflug von vorn
    await _tick(hass, freezer, 201)
    assert len(calls) == 1


async def test_reset_for_with_or_conditions(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    device = _device(hass, "Klimasensor Keller")
    temp = _sensor(hass, device, "temp", "20", "temperature", "°C")
    window = _sensor(hass, device, "window", "off", "window", domain="binary_sensor")
    magic_push = hass.data[DATA_MAGIC]
    tree = _tree("or", _leaf(temp, "below", 12), _leaf(window, "is", "on"))
    await magic_push.async_save_rule(_rule(device, temp, for_s=0, reset_for_s=120, conditions=tree, recover=True, recover_message="Alles gut"))
    hass.states.async_set(temp, "11", TEMP)
    await _tick(hass, freezer, 0)
    assert len(calls) == 1
    hass.states.async_set(window, "on")  # zweite Bedingung übernimmt, die erste fällt weg
    hass.states.async_set(temp, "20", TEMP)
    await _tick(hass, freezer, 0)
    await _tick(hass, freezer, 500)
    assert len(calls) == 1  # "Oder" gilt weiter, nichts wird zurückgesetzt
    hass.states.async_set(window, "off")
    await _tick(hass, freezer, 0)
    await _tick(hass, freezer, 119)
    assert len(calls) == 1
    await _tick(hass, freezer, 2)
    assert len(calls) == 2


def test_history_with_reset_for() -> None:
    now = 10000.0
    rows = [(0.0, "14"), (1000.0, "11"), (1500.0, "13"), (1700.0, "11"), (3000.0, "14.5")]
    # ohne Wartezeit: zwei Abschnitte
    assert magic_history.evaluate(rows, "below", 12, 60, now)[2] == 2
    # mit 300 s: der Unterbruch von 200 s gehört zur selben Episode (1000 bis 3000), eine Auslösung
    intervals, fires, count = magic_history.evaluate(rows, "below", 12, 60, now, None, 300)
    assert count == 1 and fires[0]["start"] == 1000.0 and fires[0]["end"] == 3000.0 and len(intervals) == 1
    # mit 100 s: der Unterbruch ist länger, zwei Auslösungen
    assert magic_history.evaluate(rows, "below", 12, 60, now, None, 100)[2] == 2
    # Baum mit zwei Bedingungen: gleiche Rechnung
    tree = _tree("and", _leaf("sensor.a", "below", 12), _leaf("sensor.b", "is", "on"))
    rows_by = {"sensor.a": rows, "sensor.b": [(0.0, "on")]}
    assert magic_history.evaluate_tree(rows_by, tree, 60, now, 0.0)[2] == 2
    assert magic_history.evaluate_tree(rows_by, tree, 60, now, 0.0, 300)[2] == 1
