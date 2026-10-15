"""Timer-Schaltoptionen (2.52.0): Was sich einstellen lässt, Prüfen, Schalten mit Optionen, "wie vorher" (Szene merken)."""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import timers
from custom_components.device_panel.const import DATA_TIMERS

from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")
from .test_timers import _raw, _restart, _switch, _tick, _zurich  # noqa: F401  (Fixture "_zurich")

LIGHT_ATTRS = {"supported_color_modes": ["color_temp", "xy"], "min_color_temp_kelvin": 2000, "max_color_temp_kelvin": 6500, "supported_features": 0}


@pytest.fixture(autouse=True)
def _no_gap(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keine Pause zwischen zwei Diensten in den Tests."""
    monkeypatch.setattr(timers, "CALL_GAP_S", 0)


def _state(hass: HomeAssistant, entity_id: str, state: str, attrs: dict[str, Any]) -> None:
    hass.states.async_set(entity_id, state, attrs)


# -- Was sich einstellen lässt ----------------------------------------------------------------------


async def test_option_specs_per_kind(hass: HomeAssistant) -> None:
    hass.states.async_set("light.a", "off", LIGHT_ATTRS)
    assert [s["key"] for s in timers.option_specs(hass.states.get("light.a"))] == ["brightness_pct", "color_temp_kelvin", "rgb_color"]
    assert timers.option_specs(hass.states.get("light.a"))[1] | {} == {"key": "color_temp_kelvin", "type": "kelvin", "min": 2000, "max": 6500}
    # Lampe nur an/aus: nichts einstellbar
    hass.states.async_set("light.b", "off", {"supported_color_modes": ["onoff"]})
    assert timers.option_specs(hass.states.get("light.b")) == []
    # Lampe mit Helligkeit
    hass.states.async_set("light.c", "off", {"supported_color_modes": ["brightness"]})
    assert [s["key"] for s in timers.option_specs(hass.states.get("light.c"))] == ["brightness_pct"]
    hass.states.async_set("cover.a", "open", {"supported_features": 4})
    assert [s["key"] for s in timers.option_specs(hass.states.get("cover.a"))] == ["position"]
    hass.states.async_set("cover.b", "open", {"supported_features": 3})
    assert timers.option_specs(hass.states.get("cover.b")) == []
    hass.states.async_set("climate.a", "off", {"supported_features": 1 | 128 | 256, "min_temp": 16, "max_temp": 28, "target_temp_step": 0.5, "hvac_modes": ["off", "heat", "cool", "weird"]})
    specs = {s["key"]: s for s in timers.option_specs(hass.states.get("climate.a"), "°C")}
    assert specs["temperature"] == {"key": "temperature", "type": "temperature", "unit": "°C", "step": 0.5, "min": 16, "max": 28}
    assert specs["hvac_mode"]["values"] == ["heat", "cool"]
    hass.states.async_set("media_player.a", "off", {"supported_features": 4 | 128 | 256})
    assert [s["key"] for s in timers.option_specs(hass.states.get("media_player.a"))] == ["volume_pct"]
    hass.states.async_set("fan.a", "off", {"supported_features": 1})
    assert [s["key"] for s in timers.option_specs(hass.states.get("fan.a"))] == ["percentage"]
    hass.states.async_set("switch.a", "off", {})
    assert timers.option_specs(hass.states.get("switch.a")) == []
    # Nicht erreichbar: Fähigkeiten unbekannt
    hass.states.async_set("light.d", "unavailable", {})
    assert timers.option_specs(hass.states.get("light.d")) == []
    assert timers.option_specs(None) == []


async def test_actions_follow_the_device_for_climate_and_media(hass: HomeAssistant) -> None:
    # Media: Lautsprecher, der sich nur einstellen lässt (Lautstärke), kann "ein" (= einstellen) und sonst nichts
    hass.states.async_set("media_player.a", "playing", {"supported_features": 4})
    assert timers.actions_for_state("media_player", hass.states.get("media_player.a")) == ["on"]
    hass.states.async_set("media_player.b", "off", {"supported_features": 128 | 256})
    assert timers.actions_for_state("media_player", hass.states.get("media_player.b")) == ["on", "off", "toggle"]
    hass.states.async_set("media_player.c", "playing", {"supported_features": 1})
    assert timers.actions_for_state("media_player", hass.states.get("media_player.c")) == []
    hass.states.async_set("climate.a", "heat", {"supported_features": 128})
    assert timers.actions_for_state("climate", hass.states.get("climate.a")) == ["off"]
    # Nicht erreichbar: alle Aktionen, die Fähigkeiten sind unbekannt
    hass.states.async_set("climate.b", "unavailable", {})
    assert timers.actions_for_state("climate", hass.states.get("climate.b")) == ["on", "off", "toggle"]
    # Andere Arten wie bisher
    hass.states.async_set("lock.a", "locked", {})
    assert timers.actions_for_state("lock", hass.states.get("lock.a")) == ["on", "off"]


# -- Prüfen -----------------------------------------------------------------------------------------


def test_clean_options_form() -> None:
    assert timers.clean_options("light", "on", None) == {}
    assert timers.clean_options("light", "on", {}) == {}
    assert timers.clean_options("light", "on", {"brightness_pct": 40, "color_temp_kelvin": 2700}) == {"brightness_pct": 40, "color_temp_kelvin": 2700}
    assert timers.clean_options("climate", "on", {"temperature": 21, "hvac_mode": "heat"}) == {"temperature": 21.0, "hvac_mode": "heat"}
    for domain, action, raw, message in (
        ("switch", "on", {"x": 1}, "keine Schaltoptionen"),
        ("light", "off", {"brightness_pct": 40}, "nur beim Einschalten"),
        ("light", "toggle", {"brightness_pct": 40}, "nur beim Einschalten"),
        ("light", "on", {"brightness_pct": 0}, "Helligkeit"),
        ("light", "on", {"brightness_pct": 101}, "Helligkeit"),
        ("light", "on", {"brightness_pct": True}, "Helligkeit"),
        ("light", "on", {"rgb_color": [1, 2]}, "length"),
        ("light", "on", {"rgb_color": [1, 2, 300]}, "Farbe"),
        ("light", "on", {"color_temp_kelvin": 2700, "rgb_color": [255, 0, 0]}, "schliessen sich aus"),
        ("light", "on", {"unbekannt": 1}, "extra keys"),
        ("cover", "on", {"position": 120}, "Position"),
        ("climate", "on", {"hvac_mode": "off"}, "value must be one of"),
        ("climate", "on", {"temperature": 999}, "Temperatur"),
        ("media_player", "on", {"volume_pct": -1}, "Lautstärke"),
        ("fan", "on", {"percentage": 0}, "Stufe"),
        ("light", "on", "hell", "ungültig"),
    ):
        with pytest.raises(vol.Invalid) as err:
            timers.clean_options(domain, action, raw)
        assert message in str(err.value), (domain, raw, str(err.value))


async def test_validation_against_the_entity(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Lampen")
    lamp = _switch(hass, device, "lamp", "off", "light")
    _state(hass, lamp, "off", {"supported_color_modes": ["brightness"]})
    thermo = _switch(hass, device, "thermo", "off", "climate")
    _state(hass, thermo, "off", {"supported_features": 1 | 128 | 256, "min_temp": 16, "max_temp": 28, "hvac_modes": ["off", "heat"]})
    plain = _switch(hass, device, "plain")
    for raw, message in (
        (_raw(device, lamp, options={"color_temp_kelvin": 2700}), "unterstützt die Entität nicht"),
        (_raw(device, thermo, options={"temperature": 30}), "ausserhalb des Bereichs"),
        (_raw(device, thermo, options={"hvac_mode": "cool"}), "unterstützt die Entität nicht"),
        (_raw(device, plain, options={"brightness_pct": 5}), "keine Schaltoptionen"),
        (_raw(device, lamp, action="off", options={"brightness_pct": 5}), "nur beim Einschalten"),
    ):
        with pytest.raises(vol.Invalid) as err:
            await manager.async_save_timer(raw)
        assert message in str(err.value), (raw, str(err.value))
    saved = await manager.async_save_timer(_raw(device, lamp, options={"brightness_pct": 40}))
    assert saved["options"] == {"brightness_pct": 40} and saved["back_mode"] == "opposite"
    # Ohne Angabe: leer, wie bisher
    assert (await manager.async_save_timer(_raw(device, lamp)))["options"] == {}
    # "Wie vorher" ohne Zurückschalten gilt nicht
    assert (await manager.async_save_timer(_raw(device, lamp, back_mode="restore")))["back_mode"] == "opposite"
    assert (await manager.async_save_timer(_raw(device, lamp, back_mode="restore", back_s=600)))["back_mode"] == "restore"
    # Nicht erreichbar beim Speichern: die Form genügt
    hass.states.async_set(thermo, "unavailable", {})
    assert (await manager.async_save_timer(_raw(device, thermo, options={"temperature": 30})))["options"] == {"temperature": 30.0}


# -- Schalten mit Optionen --------------------------------------------------------------------------


async def test_light_turns_on_as_set(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "light", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Lampen")
    lamp = _switch(hass, device, "lamp", "off", "light")
    _state(hass, lamp, "off", LIGHT_ATTRS)
    await manager.async_save_timer(_raw(device, lamp, delay_s=60, options={"brightness_pct": 40, "color_temp_kelvin": 2700}))
    await manager.async_save_timer(_raw(device, lamp, name="Rot", delay_s=60, options={"rgb_color": [255, 0, 0]}))
    await _tick(hass, freezer, 61)
    assert sorted(((c.data.get("brightness_pct"), c.data.get("color_temp_kelvin"), c.data.get("rgb_color")) for c in on), key=str) == [(40, 2700, None), (None, None, [255, 0, 0])]
    assert all(c.data["entity_id"] == lamp for c in on)


async def test_cover_goes_to_position(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    position = async_mock_service(hass, "cover", "set_cover_position")
    opened = async_mock_service(hass, "cover", "open_cover")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Rollo")
    cover = _switch(hass, device, "cover", "closed", "cover")
    _state(hass, cover, "closed", {"supported_features": 15})
    await manager.async_save_timer(_raw(device, cover, delay_s=60, options={"position": 30}))
    await manager.async_save_timer(_raw(device, cover, name="Offen", delay_s=60))
    await _tick(hass, freezer, 61)
    assert [c.data for c in position] == [{"entity_id": cover, "position": 30}] and len(opened) == 1


async def test_climate_and_media_call_in_order(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls: list[tuple[str, str, dict[str, Any]]] = []
    for domain, service in (("climate", "turn_on"), ("climate", "set_hvac_mode"), ("climate", "set_temperature"), ("media_player", "turn_on"), ("media_player", "volume_set")):

        async def _record(call, domain=domain, service=service) -> None:
            calls.append((domain, service, dict(call.data)))

        hass.services.async_register(domain, service, _record)
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Gerät")
    thermo = _switch(hass, device, "thermo", "off", "climate")
    _state(hass, thermo, "off", {"supported_features": 1 | 128 | 256, "min_temp": 16, "max_temp": 28, "hvac_modes": ["off", "heat"]})
    media = _switch(hass, device, "media", "off", "media_player")
    _state(hass, media, "off", {"supported_features": 4 | 128 | 256})
    by_name = lambda domain: [(s, d) for dom, s, d in calls if dom == domain]  # noqa: E731
    await manager.async_save_timer(_raw(device, thermo, name="Mit Modus", delay_s=60, options={"hvac_mode": "heat", "temperature": 21.5}))
    await _tick(hass, freezer, 61)
    assert by_name("climate") == [
        ("set_hvac_mode", {"entity_id": thermo, "hvac_mode": "heat"}),
        ("set_temperature", {"entity_id": thermo, "temperature": 21.5}),
    ]
    calls.clear()
    # Nur die Temperatur: das Gerät wird erst eingeschaltet (es kann es), dann eingestellt
    await manager.async_save_timer(_raw(device, thermo, name="Nur Temperatur", delay_s=60, options={"temperature": 20}))
    await _tick(hass, freezer, 61)
    assert by_name("climate") == [("turn_on", {"entity_id": thermo}), ("set_temperature", {"entity_id": thermo, "temperature": 20.0})]
    await manager.async_save_timer(_raw(device, media, delay_s=60, options={"volume_pct": 30}))
    await _tick(hass, freezer, 61)
    assert by_name("media_player") == [("turn_on", {"entity_id": media}), ("volume_set", {"entity_id": media, "volume_level": 0.3})]


async def test_try_now_uses_the_options(hass: HomeAssistant, setup) -> None:  # noqa: F811
    on = async_mock_service(hass, "light", "turn_on")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Lampen")
    lamp = _switch(hass, device, "lamp", "off", "light")
    _state(hass, lamp, "off", LIGHT_ATTRS)
    assert await manager.async_try(lamp, "on", {"brightness_pct": 75}) == (True, None)
    assert on[0].data == {"entity_id": lamp, "brightness_pct": 75}
    with pytest.raises(vol.Invalid):
        await manager.async_try(lamp, "on", {"brightness_pct": 500})
    # Ohne Optionen wie bisher
    assert await manager.async_try(lamp, "on") == (True, None)
    assert on[1].data == {"entity_id": lamp}


# -- Wie vorher -------------------------------------------------------------------------------------


async def test_restore_light_to_previous_scene(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    on = async_mock_service(hass, "light", "turn_on")
    off = async_mock_service(hass, "light", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Lampen")
    lamp = _switch(hass, device, "lamp", "on", "light")
    before = {**LIGHT_ATTRS, "brightness": 128, "color_mode": "color_temp", "color_temp_kelvin": 2700, "xy_color": (0.5, 0.4)}
    _state(hass, lamp, "on", before)
    saved = await manager.async_save_timer(_raw(device, lamp, delay_s=60, back_s=120, back_mode="restore", options={"brightness_pct": 100, "color_temp_kelvin": 6000}))
    await _tick(hass, freezer, 61)
    assert on[0].data == {"entity_id": lamp, "brightness_pct": 100, "color_temp_kelvin": 6000}
    rt = manager.runtime(saved["id"])
    # Gemerkt wird die Szene vor dem Schalten, ohne die Farbe eines anderen Farbmodus
    assert rt["snapshot"]["state"] == "on" and rt["snapshot"]["attrs"]["brightness"] == 128 and rt["snapshot"]["attrs"]["xy_color"] == [0.5, 0.4]
    _state(hass, lamp, "on", {**LIGHT_ATTRS, "brightness": 255, "color_mode": "color_temp", "color_temp_kelvin": 6000})
    await _tick(hass, freezer, 121)
    assert off == []
    assert on[1].data == {"entity_id": lamp, "brightness": 128, "color_temp_kelvin": 2700}
    assert manager.runtime(saved["id"])["snapshot"] is None and manager.runtime(saved["id"])["revert_due"] is None


async def test_restore_off_light_turns_off_again(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    async_mock_service(hass, "light", "turn_on")
    off = async_mock_service(hass, "light", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Lampen")
    lamp = _switch(hass, device, "lamp", "off", "light")
    _state(hass, lamp, "off", LIGHT_ATTRS)
    await manager.async_save_timer(_raw(device, lamp, delay_s=60, back_s=120, back_mode="restore"))
    await _tick(hass, freezer, 61)
    _state(hass, lamp, "on", LIGHT_ATTRS)
    await _tick(hass, freezer, 121)
    assert len(off) == 1 and off[0].data == {"entity_id": lamp}


async def test_restore_keeps_state_that_was_already_on(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    """Eine Steckdose, die schon an war, bleibt nach "wie vorher" an; mit dem Gegenstück ginge sie aus."""
    on = async_mock_service(hass, "switch", "turn_on")
    off = async_mock_service(hass, "switch", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device, state="on")
    await manager.async_save_timer(_raw(device, plug, delay_s=60, back_s=120, back_mode="restore"))
    await manager.async_save_timer(_raw(device, plug, name="Gegenstück", delay_s=60, back_s=120))
    await _tick(hass, freezer, 61)
    await _tick(hass, freezer, 121)
    assert len(on) == 3 and len(off) == 1  # zwei Schaltvorgänge ein, dann einmal Gegenstück aus und einmal "wie vorher" wieder ein


async def test_restore_cover_climate_media_fan(hass: HomeAssistant) -> None:
    base = lambda eid: {"entity_id": eid}  # noqa: E731
    assert timers.restore_calls("cover", "cover.a", {"state": "open", "attrs": {"current_position": 60}}) == [("cover", "set_cover_position", {**base("cover.a"), "position": 60})]
    assert timers.restore_calls("cover", "cover.a", {"state": "closed", "attrs": {}}) == [("cover", "close_cover", base("cover.a"))]
    assert timers.restore_calls("cover", "cover.a", {"state": "opening", "attrs": {}}) == [("cover", "open_cover", base("cover.a"))]
    assert timers.restore_calls("cover", "cover.a", {"state": "stopped", "attrs": {}}) is None
    assert timers.restore_calls("climate", "climate.a", {"state": "off", "attrs": {}}) == [("climate", "turn_off", base("climate.a"))]
    assert timers.restore_calls("climate", "climate.a", {"state": "heat", "attrs": {"temperature": 21}}) == [
        ("climate", "set_hvac_mode", {**base("climate.a"), "hvac_mode": "heat"}),
        ("climate", "set_temperature", {**base("climate.a"), "temperature": 21}),
    ]
    assert timers.restore_calls("media_player", "media_player.a", {"state": "standby", "attrs": {}}) == [("media_player", "turn_off", base("media_player.a"))]
    assert timers.restore_calls("media_player", "media_player.a", {"state": "playing", "attrs": {"volume_level": 0.2}}, 128) == [
        ("media_player", "turn_on", base("media_player.a")),
        ("media_player", "volume_set", {**base("media_player.a"), "volume_level": 0.2}),
    ]
    assert timers.restore_calls("media_player", "media_player.a", {"state": "playing", "attrs": {}}) == []
    assert timers.restore_calls("fan", "fan.a", {"state": "on", "attrs": {"percentage": 66}}) == [("fan", "turn_on", {**base("fan.a"), "percentage": 66})]
    assert timers.restore_calls("fan", "fan.a", {"state": "off", "attrs": {}}) == [("fan", "turn_off", base("fan.a"))]
    assert timers.restore_calls("valve", "valve.a", {"state": "closing", "attrs": {}}) == [("valve", "close_valve", base("valve.a"))]
    assert timers.restore_calls("lock", "lock.a", {"state": "locked", "attrs": {}}) == [("lock", "lock", base("lock.a"))]
    assert timers.restore_calls("lock", "lock.a", {"state": "jammed", "attrs": {}}) is None
    assert timers.snapshot_of(None) is None
    hass_state = type("S", (), {"state": "unavailable", "domain": "light", "attributes": {}})()
    assert timers.snapshot_of(hass_state) is None  # type: ignore[arg-type]


async def test_unknown_scene_falls_back_to_the_opposite(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    async_mock_service(hass, "cover", "open_cover")
    close = async_mock_service(hass, "cover", "close_cover")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Rollo")
    cover = _switch(hass, device, "cover", "stopped", "cover")
    saved = await manager.async_save_timer(_raw(device, cover, delay_s=60, back_s=120, back_mode="restore"))
    await _tick(hass, freezer, 61)
    # Zustand "stopped" lässt sich nicht herstellen: es gilt das Gegenstück
    assert manager.runtime(saved["id"])["snapshot"] == {"state": "stopped", "attrs": {}}
    await _tick(hass, freezer, 121)
    assert len(close) == 1


async def test_scene_survives_restart_and_pending_revert_keeps_it(hass: HomeAssistant, setup, freezer, hass_storage: dict[str, Any]) -> None:  # noqa: F811
    async_mock_service(hass, "light", "turn_on")
    off = async_mock_service(hass, "light", "turn_off")
    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Lampen")
    lamp = _switch(hass, device, "lamp", "off", "light")
    _state(hass, lamp, "off", LIGHT_ATTRS)
    saved = await manager.async_save_timer(_raw(device, lamp, delay_s=60, back_s=600, back_mode="restore", options={"brightness_pct": 100}))
    await _tick(hass, freezer, 61)
    assert manager.runtime(saved["id"])["snapshot"]["state"] == "off"
    # Die Lampe leuchtet jetzt; ein Neustart vergisst die gemerkte Szene nicht
    _state(hass, lamp, "on", LIGHT_ATTRS)
    manager = await _restart(hass)
    assert manager.runtime(saved["id"])["snapshot"]["state"] == "off"
    # Ein zweites Auslösen "von Hand" während das Zurückschalten aussteht, überschreibt die Szene nicht mit dem Zwischenstand
    assert await manager.async_run_now(saved["id"]) == (True, None)
    assert manager.runtime(saved["id"])["snapshot"]["state"] == "off"
    await _tick(hass, freezer, 601)
    assert len(off) == 1


async def test_restore_text_in_push_and_log(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    async_mock_service(hass, "light", "turn_on")
    async_mock_service(hass, "light", "turn_off")
    handy = async_mock_service(hass, "notify", "handy")
    await _options(hass, notify_service="notify.handy")
    from custom_components.device_panel import activity

    manager = hass.data[DATA_TIMERS]
    device = _device(hass, "Lampen")
    lamp = _switch(hass, device, "lamp", "off", "light")
    _state(hass, lamp, "off", LIGHT_ATTRS)
    await manager.async_save_timer(_raw(device, lamp, delay_s=60, back_s=120, back_mode="restore", push=True))
    await _tick(hass, freezer, 61)
    await _tick(hass, freezer, 121)
    assert len(handy) == 2
    assert handy[1].data["message"].startswith("lamp ist wieder wie vorher · ")
    assert any("zurückgeschaltet" in e["text"] and "wie vorher" in e["text"] for e in activity.get(hass).entries)


async def test_old_timers_without_options_still_load(hass: HomeAssistant, setup) -> None:  # noqa: F811
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    raw = {"id": "0123456789ab", "device_id": device.id, "entity_id": plug, "name": "Alt", "action": "on", "kind": "countdown", "delay_s": 600, "enabled": False}
    timer = timers.TimerManager._clean_stored(raw)
    assert timer["options"] == {} and timer["back_mode"] == "opposite"
    assert timers.TimerManager._clean_runtime({"snapshot": "kaputt"})["snapshot"] is None
