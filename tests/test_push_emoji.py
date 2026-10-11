"""Emoji im Titel der Push-Meldungen (2.2.0): Zählung, Prüfung, Standard, leer, Versand."""

from __future__ import annotations

from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.device_panel import push
from custom_components.device_panel.const import DOMAIN, EMOJI_DEFAULTS, EMOJI_KEYS
from custom_components.device_panel.options_api import emoji, emoji_for, grapheme_count, values_from

from .test_outage_notify import _device, _entity, _options, _tick, setup  # noqa: F401  (Fixture "setup")


@pytest.mark.parametrize(
    ("text", "count"),
    [
        ("", 0),
        ("🔴", 1),
        ("⬆️", 1),  # Pfeil mit Variantenwahl: zwei Codepunkte
        ("👍🏽", 1),  # Hautton
        ("👨‍👩‍👧", 1),  # Zero-Width-Joiner-Folge
        ("🇨🇭", 1),  # Flagge aus zwei Regionalzeichen
        ("🇨🇭🇩🇪", 2),
        ("1️⃣", 1),  # Keycap
        ("abc", 3),
        ("abcd", 4),
        ("🔴🟢🪫", 3),
        ("🔴🟢🪫✨", 4),
    ],
)
def test_grapheme_count(text: str, count: int) -> None:
    assert grapheme_count(text) == count


def test_emoji_validation() -> None:
    assert emoji(None) is None  # Standard
    assert emoji("") == ""  # ohne Emoji
    assert emoji("  🔥 ") == "🔥"
    assert emoji("⬆️✨🔴") == "⬆️✨🔴"  # drei sichtbare Zeichen, mehr Codepunkte
    assert emoji("ab!") == "ab!"
    for bad in ("abcd", "🔴🟢🪫✨", 5, ["🔴"], "a\nb", "a\x00", "x" * 40):
        with pytest.raises(vol.Invalid):
            emoji(bad)


def test_values_and_effective_emoji() -> None:
    values = values_from({})
    assert all(values[key] is None for key in EMOJI_KEYS.values())
    assert {kind: emoji_for(values, kind) for kind in EMOJI_DEFAULTS} == EMOJI_DEFAULTS
    values = values_from({"emoji_outage": "🔥", "emoji_online": "", "emoji_new": "abcd"})
    assert emoji_for(values, "outage") == "🔥"
    assert emoji_for(values, "online") == ""  # leer gespeichert: kein Emoji
    assert emoji_for(values, "new") == EMOJI_DEFAULTS["new"]  # ungültig gespeichert: Standard


async def test_title_uses_emoji(hass: HomeAssistant) -> None:
    hass.config.language = "de"
    default = values_from({})
    assert push.title(hass, default, "outage", "outage_title", name="Lampe") == "🔴 Ausgefallen: Lampe"
    assert push.title(hass, default, "group", "outage_title_many", count=3) == "🚨 Sammelausfall: 3 Geräte"
    assert push.title(hass, default, "updates", "update_title") == "⬆️ Home Assistant Update"
    own = values_from({"emoji_outage": "🔥🔥", "emoji_online": ""})
    assert push.title(hass, own, "outage", "outage_title", name="Lampe") == "🔥🔥 Ausgefallen: Lampe"
    assert push.title(hass, own, "online", "online_title", name="Lampe") == "Wieder online: Lampe"


async def test_set_and_reset_from_panel(hass: HomeAssistant, hass_ws_client) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    async def call(payload: dict[str, Any]) -> dict[str, Any]:
        await client.send_json({"id": call.n, **payload})
        call.n += 1
        return await client.receive_json()

    call.n = 1
    result = (await call({"type": f"{DOMAIN}/get_options"}))["result"]
    assert result["emoji_defaults"] == EMOJI_DEFAULTS and result["emoji_max"] == 3
    assert all(result["values"][key] is None for key in EMOJI_KEYS.values())

    answer = await call({"type": f"{DOMAIN}/set_options", "values": {"emoji_outage": "🔥", "emoji_battery": ""}})
    assert answer["success"]
    values = (await call({"type": f"{DOMAIN}/get_options"}))["result"]["values"]
    assert values["emoji_outage"] == "🔥" and values["emoji_battery"] == ""

    # Zu lang: abgelehnt, nichts geändert
    answer = await call({"type": f"{DOMAIN}/set_options", "values": {"emoji_outage": "abcd"}})
    assert not answer["success"]
    assert (await call({"type": f"{DOMAIN}/get_options"}))["result"]["values"]["emoji_outage"] == "🔥"

    # Standard: null
    answer = await call({"type": f"{DOMAIN}/set_options", "values": {"emoji_outage": None, "emoji_battery": None}})
    assert answer["success"]
    values = (await call({"type": f"{DOMAIN}/get_options"}))["result"]["values"]
    assert values["emoji_outage"] is None and values["emoji_battery"] is None


async def test_outage_push_uses_own_emoji(hass: HomeAssistant, setup, freezer) -> None:  # noqa: F811
    calls = async_mock_service(hass, "notify", "handy")
    lamp = _device(hass, "Lampe")
    light = _entity(hass, lamp, "light", "l", "on")
    await _options(hass, notify_service="notify.handy", notify_outage=True, notify_online=True, emoji_outage="🔥", emoji_online="")
    setup.evaluate()
    hass.states.async_set(light, "unavailable")
    await _tick(hass, setup, freezer, 3)
    hass.states.async_set(light, "on")
    await _tick(hass, setup, freezer, 1)
    assert [c.data["title"] for c in calls] == ["🔥 Offline: Lampe", "Back online: Lampe"]
