"""Schalter in Home Assistant (2.177.0): "Routinen pausiert" immer, ein Schalter je Routine mit Haken "ha_switch"."""

from __future__ import annotations

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from custom_components.device_panel.const import DATA_ROUTINES, DOMAIN

from .test_outage_notify import _device, _options, setup  # noqa: F401  (Fixture "setup")
from .test_routines import _raw, _switch, _zurich  # noqa: F401  (Fixture "_zurich")


def _entity_id(hass: HomeAssistant, unique_suffix: str) -> str | None:
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    return er.async_get(hass).async_get_entity_id("switch", DOMAIN, f"{entry.entry_id}_{unique_suffix}")


async def test_pause_switch_always_exists_and_follows_the_option(hass: HomeAssistant, setup) -> None:  # noqa: F811
    entity_id = _entity_id(hass, "routines_paused")
    assert entity_id and hass.states.get(entity_id).state == STATE_OFF
    await hass.services.async_call("switch", "turn_on", {"entity_id": entity_id}, blocking=True)
    await hass.async_block_till_done()
    manager = hass.data[DATA_ROUTINES]
    assert manager.paused() is True and hass.states.get(entity_id).state == STATE_ON
    await hass.services.async_call("switch", "turn_off", {"entity_id": entity_id}, blocking=True)
    await hass.async_block_till_done()
    assert manager.paused() is False and hass.states.get(entity_id).state == STATE_OFF


async def test_routine_switch_follows_the_checkbox(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_routine(_raw(device, plug, name="Gartenlicht", kind="repeat", repeat="daily", time="06:30", delay_s=None))
    await hass.async_block_till_done()
    # Ohne Haken kein Schalter
    assert _entity_id(hass, f"routine_{saved['id']}") is None
    # Haken setzen: der Schalter entsteht, an (die Routine ist aktiv)
    saved = await manager.async_save_routine({**saved, "ha_switch": True})
    await hass.async_block_till_done()
    entity_id = _entity_id(hass, f"routine_{saved['id']}")
    assert entity_id and hass.states.get(entity_id).state == STATE_ON
    assert hass.states.get(entity_id).attributes["friendly_name"].endswith("Routine: Gartenlicht")
    assert manager.switch_entity_id(saved["id"]) == entity_id
    # Schalter in HA: Routine aus, und umgekehrt (Panel)
    await hass.services.async_call("switch", "turn_off", {"entity_id": entity_id}, blocking=True)
    await hass.async_block_till_done()
    assert manager.get(saved["id"])["enabled"] is False and hass.states.get(entity_id).state == STATE_OFF
    await manager.async_set_enabled(saved["id"], True)
    await hass.async_block_till_done()
    assert hass.states.get(entity_id).state == STATE_ON
    # Umbenennen: Anzeigename folgt, Entity-ID bleibt
    await manager.async_save_routine({**manager.get(saved["id"]), "name": "Terrassenlicht"})
    await hass.async_block_till_done()
    assert hass.states.get(entity_id).attributes["friendly_name"].endswith("Routine: Terrassenlicht")
    # Haken abwählen: Schalter und Eintrag in der Registry verschwinden
    await manager.async_save_routine({**manager.get(saved["id"]), "ha_switch": False})
    await hass.async_block_till_done()
    assert hass.states.get(entity_id) is None and _entity_id(hass, f"routine_{saved['id']}") is None


async def test_routine_switch_is_removed_with_the_routine(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_routine(_raw(device, plug, kind="repeat", repeat="daily", time="06:30", delay_s=None, ha_switch=True))
    await hass.async_block_till_done()
    entity_id = _entity_id(hass, f"routine_{saved['id']}")
    assert entity_id and hass.states.get(entity_id)
    await manager.async_delete_routine(saved["id"])
    await hass.async_block_till_done()
    assert hass.states.get(entity_id) is None and _entity_id(hass, f"routine_{saved['id']}") is None


async def test_routine_switches_come_back_after_reload(hass: HomeAssistant, setup) -> None:  # noqa: F811
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_routine(_raw(device, plug, kind="repeat", repeat="daily", time="06:30", delay_s=None, ha_switch=True))
    await hass.async_block_till_done()
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    entity_id = _entity_id(hass, f"routine_{saved['id']}")
    assert entity_id and hass.states.get(entity_id).state == STATE_ON


async def test_ha_switch_is_part_of_the_backup(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Sichern, Routine löschen, wiederherstellen: der Haken und damit der Schalter kommen zurück."""
    from custom_components.device_panel import backup

    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_routine(_raw(device, plug, kind="repeat", repeat="daily", time="06:30", delay_s=None, ha_switch=True))
    file = await backup.async_export(hass, ["routines"])
    assert file["sections"]["routines"]["items"][0]["ha_switch"] is True
    await manager.async_delete_routine(saved["id"])
    await hass.async_block_till_done()
    assert _entity_id(hass, f"routine_{saved['id']}") is None
    await backup.async_import(hass, file, ["routines"], dry_run=False)
    await hass.async_block_till_done()
    assert manager.get(saved["id"])["ha_switch"] is True
    assert _entity_id(hass, f"routine_{saved['id']}")


def _button_id(hass: HomeAssistant, routine_id: str) -> str | None:
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    return er.async_get(hass).async_get_entity_id("button", DOMAIN, f"{entry.entry_id}_routine_run_{routine_id}")


async def test_routine_button_runs_the_routine_always(hass: HomeAssistant, setup) -> None:  # noqa: F811
    """Mit dem Haken gibt es auch den Knopf "Jetzt ausführen"; er läuft immer, auch bei Pause und ausgeschalteter Routine."""
    from pytest_homeassistant_custom_component.common import async_mock_service

    on = async_mock_service(hass, "switch", "turn_on")
    manager = hass.data[DATA_ROUTINES]
    device = _device(hass, "Steckdose")
    plug = _switch(hass, device)
    saved = await manager.async_save_routine(_raw(device, plug, name="Gartenlicht", kind="repeat", repeat="daily", time="06:30", delay_s=None, ha_switch=True))
    await hass.async_block_till_done()
    button = _button_id(hass, saved["id"])
    assert button and hass.states.get(button).attributes["friendly_name"].endswith("Routine ausführen: Gartenlicht")
    assert manager.button_entity_id(saved["id"]) == button
    # Pause an, Routine aus: der Knopf schaltet trotzdem
    await manager.async_set_enabled(saved["id"], False)
    await _options(hass, routines_pause=True)
    await hass.async_block_till_done()
    assert manager.paused() is True
    await hass.services.async_call("button", "press", {"entity_id": button}, blocking=True)
    await hass.async_block_till_done()
    assert len(on) == 1 and on[0].data["entity_id"] == plug
    # Haken abwählen: Schalter und Knopf verschwinden
    await manager.async_save_routine({**manager.get(saved["id"]), "ha_switch": False})
    await hass.async_block_till_done()
    assert _button_id(hass, saved["id"]) is None and _entity_id(hass, f"routine_{saved['id']}") is None
    assert hass.states.get(button) is None
