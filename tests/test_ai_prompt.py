"""Profi-Modus der KI-Einschätzung (1.2.0): eigener Prompt mit {language} und {facts}."""

from __future__ import annotations

import json
import time
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.device_panel import ai_assessment
from custom_components.device_panel.ai_assessment import build_facts
from custom_components.device_panel.ai_prompt import DEFAULT_PROMPT, ai_prompt, prompt_problem, render_prompt
from custom_components.device_panel.const import AI_PROMPT_MAX, DATA_AVAILABILITY, DOMAIN


@pytest.fixture
async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.data[DATA_AVAILABILITY]._started = time.time() - 3600


def _lamp(hass: HomeAssistant) -> dr.DeviceEntry:
    source = MockConfigEntry(domain="test", title="Eintrag")
    source.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=source.entry_id, identifiers={("test", "Lampe")}, name="Lampe")
    entry = er.async_get(hass).async_get_or_create("light", "test", f"{device.id}-l", device_id=device.id)
    hass.states.async_set(entry.entity_id, "on")
    return device


def test_default_prompt_has_both_placeholders_and_is_valid() -> None:
    assert "{language}" in DEFAULT_PROMPT and DEFAULT_PROMPT.rstrip().endswith("{facts}")
    assert prompt_problem(DEFAULT_PROMPT) is None
    # Standard oder leer = Standard (nichts gespeichert)
    assert ai_prompt(DEFAULT_PROMPT) == "" and ai_prompt("") == "" and ai_prompt("  \n") == "" and ai_prompt(None) == ""


@pytest.mark.parametrize(
    ("text", "problem"),
    [
        ("Beurteile das Gerät. Antworte auf {language}.", "no_facts"),
        ("Fakten: {facts} und {name}", "unknown:{name}"),
        ("{facts} {Language}", "unknown:{Language}"),
        ("x" * AI_PROMPT_MAX + "{facts}", "too_long"),
    ],
)
def test_prompt_problems(text: str, problem: str) -> None:
    assert prompt_problem(text) == problem
    with pytest.raises(vol.Invalid):
        ai_prompt(text)


def test_braces_in_normal_text_are_fine() -> None:
    # JSON-Beispiele und Klammern mit Leerzeichen oder Anführungszeichen sind keine Platzhalter
    text = 'Antworte als {"title": "..."} auf {language}.\n{facts}'
    assert prompt_problem(text) is None
    assert ai_prompt(f"  {text}  \r\n") == text


def test_render_replaces_only_the_two_placeholders() -> None:
    facts = json.dumps({"name": "{language}", "note": "{facts}"})
    out = render_prompt("Auf {language}:\n{facts}", facts, "German")
    # Auch Platzhalter-Text in den Fakten bleibt unberührt
    assert out == f"Auf German:\n{facts}"
    assert render_prompt("", "{}", "English").endswith("{}") and "English" in render_prompt("", "{}", "English")


async def test_option_roundtrip_and_default_is_listed(hass: HomeAssistant, setup, hass_ws_client) -> None:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_options"})
    result = (await client.receive_json())["result"]
    assert result["values"]["ai_prompt"] == "" and result["ai_prompt_default"] == DEFAULT_PROMPT
    # Ungültig: Fehler, nichts gespeichert
    await client.send_json({"id": 2, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": "Ohne Fakten"}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    await client.send_json({"id": 3, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": 5}})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"
    mine = "Kurz auf {language}:\n{facts}"
    await client.send_json({"id": 4, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": mine}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 5, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["ai_prompt"] == mine
    # Standard zurück: leer
    await client.send_json({"id": 6, "type": f"{DOMAIN}/set_options", "values": {"ai_prompt": DEFAULT_PROMPT}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 7, "type": f"{DOMAIN}/get_options"})
    assert (await client.receive_json())["result"]["values"]["ai_prompt"] == ""


async def test_assess_uses_own_prompt(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    lamp = _lamp(hass)
    calls: list[str] = []

    async def fake(hass_: HomeAssistant, entity_id: str | None, instructions: str) -> Any:
        calls.append(instructions)
        return "Titel\n\nText"

    monkeypatch.setattr(ai_assessment, "_generate", fake)
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/set_options", "values": {"ai_assessment": True, "ai_prompt": "Nur kurz auf {language}.\n{facts}"}})
    assert (await client.receive_json())["success"]
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_assess", "device_id": lamp.id, "language": "de"})
    assert (await client.receive_json())["success"]
    assert calls[0].startswith("Nur kurz auf German") and '"name": "Lampe"' in calls[0]
    assert "careful assistant" not in calls[0]


async def test_preview_sends_nothing_and_checks_draft(hass: HomeAssistant, setup, hass_ws_client, monkeypatch) -> None:
    lamp = _lamp(hass)

    async def never(*args: Any) -> Any:
        raise AssertionError("die Vorschau darf nichts an die KI schicken")

    monkeypatch.setattr(ai_assessment, "_generate", never)
    client = await hass_ws_client(hass)
    # Ohne Entwurf: gespeicherter Prompt (hier der Standard); funktioniert auch bei ausgeschalteter KI
    await client.send_json({"id": 1, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "language": "en"})
    msg = await client.receive_json()
    assert msg["success"], msg
    assert "careful assistant" in msg["result"]["text"] and '"name": "Lampe"' in msg["result"]["text"] and "{facts}" not in msg["result"]["text"]
    # Entwurf
    await client.send_json({"id": 2, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "language": "de", "prompt": "Hallo {language}\n{facts}"})
    text = (await client.receive_json())["result"]["text"]
    assert text.startswith("Hallo German") and '"status"' in text
    # Ungültiger Entwurf, unbekanntes Gerät, zu lang
    await client.send_json({"id": 3, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "prompt": "ohne"})
    assert (await client.receive_json())["error"]["code"] == "invalid_prompt"
    await client.send_json({"id": 4, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": "gibtsnicht"})
    assert (await client.receive_json())["error"]["code"] == "not_found"
    await client.send_json({"id": 5, "type": f"{DOMAIN}/ai_prompt_preview", "device_id": lamp.id, "prompt": "x" * (AI_PROMPT_MAX + 1)})
    assert (await client.receive_json())["error"]["code"] == "invalid_format"


async def test_facts_list_other_offline_devices_of_the_integration(hass: HomeAssistant, setup, freezer) -> None:
    """1.3.0: Name, Bereich und Dauer der anderen ausgefallenen Geräte derselben Integration, längste zuerst, höchstens 10."""
    from datetime import timedelta  # noqa: PLC0415

    from custom_components.device_panel.ai_assessment import SAME_OFFLINE_MAX, build_facts  # noqa: PLC0415
    from custom_components.device_panel.devices import async_list_devices  # noqa: PLC0415

    log = hass.data[DATA_AVAILABILITY]
    ereg = er.async_get(hass)
    dreg = dr.async_get(hass)
    source = MockConfigEntry(domain="zha", title="ZHA")
    source.add_to_hass(hass)
    entities: dict[str, str] = {}
    for i in range(14):
        dev = dreg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("zha", f"d{i:02d}")}, name=f"Melder {i:02d}")
        entities[dev.id] = ereg.async_get_or_create("binary_sensor", "zha", f"{dev.id}-m", device_id=dev.id).entity_id
        hass.states.async_set(entities[dev.id], "on")
    online = dreg.async_get_or_create(config_entry_id=source.entry_id, identifiers={("zha", "ok")}, name="Heiler Melder")
    hass.states.async_set(ereg.async_get_or_create("binary_sensor", "zha", f"{online.id}-m", device_id=online.id).entity_id, "on")
    log.evaluate()
    ids = list(entities)
    # Gerät 0 fehlt zuerst (am längsten), dann nacheinander die übrigen bis Nr. 12; Nr. 13 bleibt online
    for n, dev_id in enumerate(ids[:13]):
        hass.states.async_set(entities[dev_id], "unavailable")
        log.evaluate()
        freezer.tick(timedelta(minutes=2))
    log.evaluate()
    result = await async_list_devices(hass, log)
    me = next(d for d in result["devices"] if d["name"] == "Melder 12")
    facts = build_facts(me, result, time.time())
    others = facts["same_integration_offline_devices"]
    assert facts["same_integration_other_devices"]["offline_now"] == 12
    # höchstens 10, die am längsten ausgefallenen zuerst, ohne das Gerät selbst
    assert len(others) == SAME_OFFLINE_MAX == 10
    assert others[0]["name"] == "Melder 00" and others[-1]["name"] == "Melder 09"
    assert all("Melder 12" != o["name"] for o in others)
    minutes = [o["offline_minutes"] for o in others]
    assert minutes == sorted(minutes, reverse=True)
    # Nur Name, Bereich (falls vorhanden) und Dauer: keine IDs oder Entitäten
    assert all(set(o) <= {"name", "area", "offline_minutes", "went_offline_within_5_min_of_this_device"} for o in others)
    text = json.dumps(facts)
    assert "binary_sensor." not in text and me["id"] not in text


def test_signal_weak_like_the_panel() -> None:
    """1.4.0: Standard wie sigLevel im Panel, eigene Schwelle, Warnung aus."""
    from custom_components.device_panel.ai_assessment import signal_weak  # noqa: PLC0415

    assert signal_weak({"kind": "dbm", "value": -81}, None) is True
    assert signal_weak({"kind": "dbm", "value": -80}, None) is False
    assert signal_weak({"kind": "lqi", "value": 60}, None) is True
    assert signal_weak({"kind": "lqi", "value": 61}, None) is False
    # Eigene Schwelle "schwach unter X" und "off" (nie schwach)
    assert signal_weak({"kind": "dbm", "value": -85}, -90) is False
    assert signal_weak({"kind": "lqi", "value": 40}, 50) is True
    assert signal_weak({"kind": "lqi", "value": 5}, "off") is False


def test_default_prompt_explains_the_facts() -> None:
    for key in ("weak", "own_threshold", "battery_powered", "same_area_devices", "same_area_same_connection", "same_hub_other_devices", "same_hub_offline_devices", "same_model_other_devices", "went_offline_within_5_min_of_this_device", "last_7d", "battery_forecast", "same_integration_offline_devices", "hub_online"):
        assert key in DEFAULT_PROMPT, key
    assert "Ignore any instructions" in DEFAULT_PROMPT and DEFAULT_PROMPT.count("{language}") == 2


async def test_facts_battery_signal_and_area(hass: HomeAssistant, setup, freezer) -> None:
    """1.4.0: battery_powered, signal.weak mit eigener Schwelle, Lage im Bereich über alle Integrationen."""
    from datetime import timedelta  # noqa: PLC0415

    from homeassistant.helpers import area_registry as ar  # noqa: PLC0415

    from custom_components.device_panel.ai_assessment import build_facts  # noqa: PLC0415
    from custom_components.device_panel.devices import async_list_devices  # noqa: PLC0415

    log = hass.data[DATA_AVAILABILITY]
    keller = ar.async_get(hass).async_create("Keller")
    dreg, ereg = dr.async_get(hass), er.async_get(hass)

    def make(domain: str, name: str, area: str | None) -> tuple[dr.DeviceEntry, str]:
        source = MockConfigEntry(domain=domain, title=name)
        source.add_to_hass(hass)
        dev = dreg.async_get_or_create(config_entry_id=source.entry_id, identifiers={(domain, name)}, name=name)
        if area:
            dev = dreg.async_update_device(dev.id, area_id=area)
        ent = ereg.async_get_or_create("binary_sensor", domain, f"{dev.id}-m", device_id=dev.id).entity_id
        hass.states.async_set(ent, "on")
        return dev, ent

    melder, _m = make("zha", "Melder", keller.id)
    batt = ereg.async_get_or_create("sensor", "zha", f"{melder.id}-b", device_id=melder.id, original_device_class="battery")
    hass.states.async_set(batt.entity_id, "80", {"device_class": "battery", "unit_of_measurement": "%"})
    _steckdose, s_ent = make("shelly", "Steckdose Keller", keller.id)
    _router, r_ent = make("unifi", "Router Keller", keller.id)
    _bad, _b = make("hue", "Lampe Bad", None)
    log.evaluate()
    hass.states.async_set(s_ent, "unavailable")
    log.evaluate()
    freezer.tick(timedelta(minutes=5))
    hass.states.async_set(r_ent, "unavailable")
    log.evaluate()
    freezer.tick(timedelta(minutes=2))
    log.evaluate()
    result = await async_list_devices(hass, log)
    me = next(d for d in result["devices"] if d["name"] == "Melder")
    facts = build_facts(me, result, time.time())
    assert facts["battery_powered"] is True
    assert facts["same_area_other_devices"] == {"total": 2, "offline_now": 2}
    area_list = facts["same_area_devices"]
    assert [x["name"] for x in area_list] == ["Steckdose Keller", "Router Keller"]
    assert area_list[0]["offline_minutes"] >= area_list[1]["offline_minutes"]
    # Melder ist selbst nicht ausgefallen: keine Angabe zur Gleichzeitigkeit
    assert all(x["status"] == "offline" and "went_offline_within_5_min_of_this_device" not in x for x in area_list)
    assert "same_area_offline_devices" not in facts
    # Gerät ohne Bereich: keine Angaben zum Bereich; ohne Batterie: battery_powered false
    lamp = next(d for d in result["devices"] if d["name"] == "Lampe Bad")
    lf = build_facts(lamp, result, time.time())
    assert "same_area_other_devices" not in lf and lf["battery_powered"] is False
    # Eigene Schwelle des Geräts zählt
    me2 = {**me, "signal": {"kind": "lqi", "value": 40}, "signal_setting": 30}
    f2 = build_facts(me2, result, time.time())
    assert f2["signal"] == {"kind": "lqi", "value": 40, "weak": False, "own_threshold": 30}
    # Ohne eigene Schwelle: Standard (LQI 60 und darunter schwach)
    f3 = build_facts({**me, "signal": {"kind": "lqi", "value": 40}, "signal_setting": None}, result, time.time())
    assert f3["signal"] == {"kind": "lqi", "value": 40, "weak": True}


def _dev(i: str, **kw: Any) -> dict[str, Any]:
    base = {"id": i, "name": f"Gerät {i}", "online": True, "area_id": "wz", "area": "Wohnzimmer", "connection": "thread", "via": "Hub", "integration": {"domain": "matter", "title": "Matter"}, "type": "light"}
    return {**base, **kw}


def test_facts_room_hub_model_and_time() -> None:
    """1.6.0: alle Geräte des Raums mit Werten, Funkstandard, Hub, gleiches Modell, Zeitnähe."""
    from datetime import UTC, datetime  # noqa: PLC0415

    now = 1_800_000_000.0
    iso = lambda ago: datetime.fromtimestamp(now - ago * 60, UTC).isoformat()  # noqa: E731
    me = _dev("me", online=False, offline_since=iso(30), manufacturer="Acme", model="X1", sw_version="1.0")
    devices = [
        me,
        _dev("a", online=False, offline_since=iso(29), manufacturer="Acme", model="X1", sw_version="1.0"),  # gleichzeitig
        _dev("b", online=False, offline_since=iso(600), connection="zigbee", via="Anderer"),  # viel früher, anderer Funk
        _dev("c", signal={"kind": "lqi", "value": 20}, battery={"level": 9, "low": True}, avail24={"outages": 3}),
        _dev("d", flaky=True),
        _dev("e", unmonitored=True),
        _dev("f", area_id="kueche", area="Küche", via="Hub", manufacturer="Acme", model="X1", sw_version="2.0"),
        {**_dev("hub", via=None), "name": "Hub"},
    ]
    result = {"devices": devices, "integrations": {"matter": "Matter"}, "incidents": []}
    facts = build_facts(me, result, now)
    # Raum: auffällige zuerst (ausgefallen, instabil, schwach/leer), dann gesunde; nicht überwachte fehlen
    # Fehlende Angaben fehlen ganz (kein null)
    assert all(None not in x.values() for x in facts["same_area_devices"])
    names = [x["name"] for x in facts["same_area_devices"]]
    assert names[:2] == ["Gerät b", "Gerät a"] and "Gerät e" not in names and names.index("Gerät d") < names.index("Gerät c")
    c = next(x for x in facts["same_area_devices"] if x["name"] == "Gerät c")
    assert c["signal_weak"] is True and c["battery_low"] is True and c["interruptions_24h"] == 3 and c["connection_type"] == "thread"
    a = next(x for x in facts["same_area_devices"] if x["name"] == "Gerät a")
    assert a["went_offline_within_5_min_of_this_device"] is True
    b = next(x for x in facts["same_area_devices"] if x["name"] == "Gerät b")
    assert b["went_offline_within_5_min_of_this_device"] is False
    # Funkstandard im Raum: thread (a, c, d, Hub) ohne das Zigbee-Gerät b
    assert facts["same_area_same_connection"] == {"connection_type": "thread", "total": 4, "offline_now": 1}
    # Hub: a, c, d, f (b hat einen anderen Hub, e ist nicht überwacht); 1 ausgefallen, 3 im selben Raum
    assert facts["same_hub_other_devices"] == {"total": 4, "offline_now": 1, "in_same_area": 3}
    assert [x["name"] for x in facts["same_hub_offline_devices"]] == ["Gerät a"]
    # Gleiches Modell: a und f; gleiche Software nur a
    assert facts["same_model_other_devices"] == {"total": 2, "offline_now": 1, "same_software_version": {"total": 1, "offline_now": 1}}
    text = json.dumps(facts)
    assert '"id"' not in text and "area_id" not in text


def test_facts_room_is_limited() -> None:
    now = 1_800_000_000.0
    me = _dev("me")
    devices = [me, *[_dev(f"{i:02d}") for i in range(30)]]
    facts = build_facts(me, {"devices": devices, "integrations": {}, "incidents": []}, now)
    assert len(facts["same_area_devices"]) == ai_assessment.SAME_AREA_MAX == 15
    assert facts["same_area_other_devices"]["total"] == 30


def test_facts_week_and_battery_forecast() -> None:
    now = 1_800_000_000.0
    me = _dev("me", has_battery=True, battery={"level": 40, "low": False})
    result = {"devices": [me], "integrations": {}, "incidents": []}
    week = {"pct": 97.5, "outages": 4, "longest": 1800}
    ok = {"status": "ok", "days": 83.4, "target": 10, "confidence": "high", "accelerating": False, "days_low": 70.2, "days_high": 101.7, "days_used": 120.4}
    facts = build_facts(me, result, now, {"week": week, "forecast": ok})
    assert facts["last_7d"] == {"availability_percent": 97.5, "interruptions": 4, "longest_interruption_minutes": 30}
    # sichere Prognose: mit Spanne und Verlaufstagen, nicht unsicher
    assert facts["battery_forecast"] == {
        "days_left": 83, "days_range": {"min": 70, "max": 102}, "until_percent": 10, "confidence": "high",
        "days_of_history": 120, "drop_is_accelerating": False, "uncertain": False,
    }
    for status, text in (("reached", "warning threshold reached"), ("flat", "level barely drops")):
        assert build_facts(me, result, now, {"forecast": {"status": status}})["battery_forecast"] == {"status": text}
    # zu wenig Verlauf: als unsicher gemeldet, mit den Tagen
    short = build_facts(me, result, now, {"forecast": {"status": "short", "days_used": 3.2, "min_days": 7}})["battery_forecast"]
    assert short == {"status": "too little history for a forecast", "days_of_history": 3, "uncertain": True}
    # keine Angaben oder kein Verlauf: kein Fakt
    assert "battery_forecast" not in build_facts(me, result, now, {"forecast": {"status": "none"}})
    assert "last_7d" not in build_facts(me, result, now, {"week": None}) and "battery_forecast" not in build_facts(me, result, now)


def test_battery_forecast_is_flagged_uncertain() -> None:
    """1.10.0: unsicher bei Sicherheit nicht "high", steilerem Rückgang oder unter 30 Tagen Verlauf; mit Gründen."""
    base = {"status": "ok", "days": 90, "target": 15, "confidence": "high", "accelerating": False, "days_low": 80, "days_high": None, "days_used": 100}
    sure = ai_assessment.battery_forecast_fact(base)
    assert sure["uncertain"] is False and "uncertain_reasons" not in sure
    # offene Obergrenze: "max" fehlt (mindestens so lange)
    assert sure["days_range"] == {"min": 80}
    low = ai_assessment.battery_forecast_fact({**base, "confidence": "low"})
    assert low["uncertain"] is True and low["uncertain_reasons"] == ["confidence low"]
    medium = ai_assessment.battery_forecast_fact({**base, "confidence": "medium"})
    assert medium["uncertain"] is True and medium["uncertain_reasons"] == ["confidence medium"]
    steep = ai_assessment.battery_forecast_fact({**base, "accelerating": True})
    assert steep["uncertain"] is True and steep["drop_is_accelerating"] is True and "steeper" in steep["uncertain_reasons"][0]
    thin = ai_assessment.battery_forecast_fact({**base, "days_used": 12.4})
    assert thin["uncertain"] is True and thin["uncertain_reasons"] == ["only 12 days of history"] and thin["days_of_history"] == 12
    # alles zusammen: drei Gründe in fester Reihenfolge
    allr = ai_assessment.battery_forecast_fact({**base, "confidence": "low", "accelerating": True, "days_used": 10})
    assert len(allr["uncertain_reasons"]) == 3 and allr["uncertain_reasons"][0] == "confidence low"
    assert ai_assessment.battery_forecast_fact({"status": "none"}) is None
    # Der Standard-Prompt erklärt es und senkt die eigene Sicherheit der KI
    for word in ("uncertain", "uncertain_reasons", "days_range", "days_of_history", "never a firm date", "Lower it when a battery statement rests on an uncertain forecast"):
        assert word in DEFAULT_PROMPT, word


async def test_extras_week_and_forecast(hass: HomeAssistant, setup) -> None:
    """_extras holt 7 Tage aus dem Protokoll und die Prognose aus dem Batterie-Verlauf."""
    from custom_components.device_panel.devices import async_list_devices  # noqa: PLC0415

    dev = _lamp(hass)
    batt = er.async_get(hass).async_get_or_create("sensor", "test", f"{dev.id}-b", device_id=dev.id, original_device_class="battery")
    hass.states.async_set(batt.entity_id, "80", {"device_class": "battery", "unit_of_measurement": "%"})
    log = hass.data[DATA_AVAILABILITY]
    log.evaluate()
    result = await async_list_devices(hass, log)
    device = next(d for d in result["devices"] if d["id"] == dev.id)
    extra = await ai_assessment._extras(hass, device, log, time.time())
    assert set(extra) == {"week", "forecast", "battery_year"} and extra["forecast"]["status"] in {"none", "short"}
    # Ohne Batterie keine Prognose
    plain = {**device, "has_battery": False}
    assert set(await ai_assessment._extras(hass, plain, log, time.time())) == {"week"}


def test_group_placeholders_are_valid_and_alone_enough() -> None:
    """1.7.0: Gruppen statt {facts}; mindestens eine von beiden, sonst no_facts."""
    from custom_components.device_panel.ai_prompt import FACT_GROUPS  # noqa: PLC0415

    assert set(FACT_GROUPS) == {"device", "history", "battery", "signal", "integration", "area", "hub", "model"}
    assert prompt_problem("Antwort in {language}.\n{facts_device}\n{facts_area}") is None
    assert prompt_problem("Nur {facts_hub}") is None
    assert prompt_problem("Antwort in {language}, ohne Fakten") == "no_facts"
    assert prompt_problem("{facts_foo}") == "unknown:{facts_foo}"
    assert ai_prompt("Prompt {facts_signal}") == "Prompt {facts_signal}"
    # Jeder Fakt gehört zu genau einer Gruppe
    keys = [k for keys in FACT_GROUPS.values() for k in keys]
    assert len(keys) == len(set(keys))


def test_every_fact_belongs_to_a_group_and_groups_render_alone() -> None:
    from datetime import UTC, datetime  # noqa: PLC0415

    from custom_components.device_panel.ai_prompt import FACT_GROUPS  # noqa: PLC0415

    now = 1_800_000_000.0
    me = _dev(
        "me", name="Lampe {facts_area}", online=False, offline_since=datetime.fromtimestamp(now - 1800, UTC).isoformat(), since_at_least=True,
        manufacturer="Acme", model="X1", sw_version="1.0", update=True, has_battery=True, battery={"level": 50, "low": False},
        signal={"kind": "lqi", "value": 80}, signal_setting=30, avail24={"pct": 90.0, "outages": 2, "longest": 600},
    )
    other = _dev("o", online=False, offline_since=datetime.fromtimestamp(now - 1700, UTC).isoformat(), manufacturer="Acme", model="X1", sw_version="1.0")
    hub = {**_dev("hub", via=None), "name": "Hub"}
    result = {"devices": [me, other, hub], "integrations": {"matter": "Matter"}, "incidents": [{"at": now - 900, "count": 2, "integration": "matter", "devices": ["me", "o"]}]}
    facts = build_facts(me, result, now, {"week": {"pct": 99.0, "outages": 1, "longest": 60}, "forecast": {"status": "flat"}})
    allowed = {k for keys in FACT_GROUPS.values() for k in keys}
    assert set(facts) <= allowed, set(facts) - allowed
    # Fast alles ist belegt: nur "same_hub_*" nicht, weil me am Hub "Hub" hängt (hub_online, same_hub_*) – hier geprüft
    for key in ("hub_online", "same_hub_other_devices", "mass_outages_24h_involving_this_device", "battery_forecast", "last_7d", "same_model_other_devices", "same_area_devices"):
        assert key in facts, key
    # Nur die genannten Gruppen erscheinen; ein Platzhalter im Gerätenamen wird nicht nochmals ersetzt
    text = ai_assessment.build_instructions(facts, "de", "Sprache {language}\nA: {facts_hub}\nB: {facts_signal}")
    assert '"hub_online"' in text and '"signal"' in text and '"same_area_devices"' not in text and '"manufacturer"' not in text
    full = ai_assessment.build_instructions(facts, "de", "{facts_device}")
    assert "Lampe {facts_area}" in full and '"same_area_devices"' not in full
    # Gruppe ohne Fakten: leeres Objekt
    assert ai_assessment.build_instructions({}, "en", "{facts_area}").strip() == "{}"


def test_battery_year_summary() -> None:
    """1.8.0: Batterie der letzten 12 Monate: Mittel und Tiefstand je Monat, Wechsel, ohne IDs."""
    from datetime import UTC, datetime  # noqa: PLC0415

    day = 86400
    now = datetime(2026, 10, 15, 12, tzinfo=UTC).timestamp()
    # Ein Jahr mit zwei Wechseln: Stand fällt von 100 auf 20, Wechsel, fällt wieder von 100 auf 60
    points = [[now - (365 - i) * day, 100 - i * 0.4 if i < 200 else (100 - (i - 200) * 0.25 if i < 300 else 100 - (i - 300) * 0.6)] for i in range(366)]
    changes = [{"at": now - 165 * day, "from": 20, "to": 100}, {"at": now - 65 * day, "from": 25, "to": 100}]
    year = ai_assessment.battery_year({"points": points, "changes": changes}, now)
    assert year["battery_changes"] == 2 and year["days_covered"] == 365
    assert [c["days_ago"] for c in year["recent_changes"]] == [65, 165]  # neueste zuerst
    assert year["recent_changes"][0] == {"days_ago": 65, "from_percent": 25, "to_percent": 100}
    months = year["monthly_percent"]
    assert len(months) <= ai_assessment.BATTERY_MONTHS_MAX and list(months) == sorted(months)
    assert all(m["lowest"] <= m["average"] for m in months.values())
    assert year["lowest_percent"] == min(round(p[1]) for p in points)
    # ohne Wechsel: kein recent_changes; ohne Punkte: None
    assert "recent_changes" not in ai_assessment.battery_year({"points": points, "changes": []}, now)
    assert ai_assessment.battery_year({"points": [], "changes": []}, now) is None
    # begrenzt auf die letzten Wechsel
    many = [{"at": now - i * 10 * day, "from": 10, "to": 100} for i in range(1, 20)]
    assert len(ai_assessment.battery_year({"points": points, "changes": many[::-1]}, now)["recent_changes"]) == ai_assessment.BATTERY_CHANGES_MAX
    assert '"id"' not in json.dumps(year)


def test_facts_include_the_battery_year_in_the_battery_group() -> None:
    from custom_components.device_panel.ai_prompt import FACT_GROUPS  # noqa: PLC0415

    now = 1_800_000_000.0
    me = _dev("me", has_battery=True, battery={"level": 40, "low": False})
    year = {"monthly_percent": {"2026-09": {"average": 50, "lowest": 40}}, "lowest_percent": 40, "days_covered": 300, "battery_changes": 0}
    facts = build_facts(me, {"devices": [me], "integrations": {}, "incidents": []}, now, {"battery_year": year})
    assert facts["battery_last_12_months"] == year and "battery_last_12_months" in FACT_GROUPS["battery"]
    # Ohne Batterie oder ohne Angabe: kein Fakt
    plain = _dev("p")
    assert "battery_last_12_months" not in build_facts(plain, {"devices": [plain], "integrations": {}, "incidents": []}, now, {"battery_year": year})
    assert "battery_last_12_months" not in build_facts(me, {"devices": [me], "integrations": {}, "incidents": []}, now)
    # Die Gruppe {facts_battery} trägt ihn
    text = ai_assessment.build_instructions(facts, "de", "{facts_battery}")
    assert "battery_last_12_months" in text and '"name"' not in text
    assert "battery_last_12_months" in DEFAULT_PROMPT and "12 months" in DEFAULT_PROMPT
