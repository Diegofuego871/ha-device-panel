"""Live-Aktivität beim Laden (2.19.0): Start, stille Updates im Takt, Ziel des Geräts, Ende, Wegwischen, Neustart."""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.device_panel import charge as charge_module
from custom_components.device_panel.charge import ChargeNotifier
from custom_components.device_panel.const import DATA_CHARGE, LIVE_EVENT_CLEARED, LIVE_EVENT_DISMISSED, LIVE_INTERVAL, LIVE_KEEP
from custom_components.device_panel.devices import async_set_device_settings

from .test_charge import _bat, _device, _setup


async def _live_setup(hass: HomeAssistant, level: int = 30, **options: Any):
    calls = async_mock_service(hass, "notify", "handy")
    device, entity = _device(hass, "Zahnbürste", level)
    await _setup(hass, charge_live=True, notify_charge=False, **options)
    return calls, device, entity, hass.data[DATA_CHARGE]


def _live_calls(calls: list[Any]) -> list[Any]:
    return [c for c in calls if c.data.get("data", {}).get("live_update")]


async def _tick(hass: HomeAssistant, freezer, seconds: float) -> None:
    notifier = hass.data[DATA_CHARGE]
    freezer.tick(timedelta(seconds=seconds))
    notifier.check_stalls(time.time())
    notifier.live_check()
    await hass.async_block_till_done()


async def test_start_with_progress_and_target(hass: HomeAssistant, freezer) -> None:
    """Der Start (nach dem erkannten Anstieg) trägt Fortschritt und Ziel und darf melden (nicht silent)."""
    calls, _device_, entity, notifier = await _live_setup(hass)
    _bat(hass, entity, 40)  # noch kein Anstieg von 20 Punkten
    await hass.async_block_till_done()
    assert not _live_calls(calls)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    live = _live_calls(calls)
    assert len(live) == 1
    data = live[0].data
    assert data["title"] == "🔋 Charging: Zahnbürste" and data["message"] == "55 % of 100 %"
    extra = data["data"]
    assert extra["live_update"] is True and extra["tag"].startswith("device_panel_live_") and extra["tag"] != "device_panel_charge_x"
    assert extra["progress"] == 55 and extra["progress_max"] == 100 and extra["critical_text"] == "55 %"
    assert "silent" not in extra and extra["alert_once"] is True  # der Start darf melden
    assert extra["notification_icon"] == "mdi:battery-charging"


async def test_updates_are_silent_and_throttled(hass: HomeAssistant, freezer) -> None:
    """Updates höchstens alle LIVE_INTERVAL Sekunden und nur bei neuem Prozentwert, immer silent."""
    calls, _device_, entity, notifier = await _live_setup(hass)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 1
    for level in (56, 57, 58):  # jede Minute ein neuer Wert: zu früh
        freezer.tick(timedelta(seconds=60))
        _bat(hass, entity, level)
        await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 1
    await _tick(hass, freezer, LIVE_INTERVAL)  # Takt um, neuer Wert (58 statt 55)
    live = _live_calls(calls)
    assert len(live) == 2 and live[1].data["data"]["progress"] == 58 and live[1].data["data"]["silent"] is True
    # Takt um, aber derselbe Wert: nichts
    await _tick(hass, freezer, LIVE_INTERVAL + 1)
    assert len(_live_calls(calls)) == 2


async def test_goal_is_the_device_target(hass: HomeAssistant, freezer) -> None:
    """Ladeziel ist das "Voll ab" des Geräts: progress_max 80; bei 80 "Geladen", nach 10 Min. wird beendet."""
    calls, device, entity, notifier = await _live_setup(hass)
    await async_set_device_settings(hass, device.id, charge_full=80)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    assert _live_calls(calls)[0].data["data"]["progress_max"] == 80 and _live_calls(calls)[0].data["message"] == "55 % of 80 %"
    freezer.tick(timedelta(seconds=30))
    _bat(hass, entity, 80)
    await hass.async_block_till_done()
    live = _live_calls(calls)
    assert len(live) == 2
    done = live[1].data
    assert done["title"] == "🔋 Charged: Zahnbürste" and done["message"] == "Target of 80 % reached"
    assert done["data"]["progress"] == 80 and done["data"]["progress_max"] == 80 and done["data"]["silent"] is True
    assert done["data"]["notification_icon"] == "mdi:battery-check"
    # "Geladen" bleibt 10 Minuten stehen, dann clear_notification mit demselben Tag; danach nichts mehr
    await _tick(hass, freezer, LIVE_KEEP - 60)
    assert not [c for c in calls if c.data.get("message") == "clear_notification"]
    await _tick(hass, freezer, 61)
    clears = [c for c in calls if c.data.get("message") == "clear_notification"]
    assert len(clears) == 1 and clears[0].data["data"] == {"tag": done["data"]["tag"]}
    await _tick(hass, freezer, 3600)
    assert len([c for c in calls if c.data.get("message") == "clear_notification"]) == 1 and len(_live_calls(calls)) == 2


async def test_off_by_default_and_per_integration_and_device(hass: HomeAssistant, freezer) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    device, entity = _device(hass, "Zahnbürste", 30)
    await _setup(hass, notify_charge=False)  # global aus
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    assert not calls
    # Integration "test" ein: Start
    from .test_outage_notify import _options  # noqa: PLC0415

    await _options(hass, charge_live_integrations={"test": True})
    hass.data[DATA_CHARGE].live_check()
    await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 1
    # Das Gerät geht vor: am Gerät aus beendet die Live-Aktivität
    await async_set_device_settings(hass, device.id, charge_live=False)
    hass.data[DATA_CHARGE].live_check()
    await hass.async_block_till_done()
    assert len([c for c in calls if c.data.get("message") == "clear_notification"]) == 1


async def test_dismissed_stops_updates_for_this_charge(hass: HomeAssistant, freezer) -> None:
    """Weggewischt (iOS-Ereignis von Core oder Android "Benachrichtigung entfernt"): für diese Ladung keine Updates mehr."""
    calls, _device_, entity, notifier = await _live_setup(hass)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    tag = _live_calls(calls)[0].data["data"]["tag"]
    freezer.tick(timedelta(seconds=10))
    hass.bus.async_fire(LIVE_EVENT_DISMISSED, {"tag": tag, "device_id": "iphone"})
    await hass.async_block_till_done()
    await _tick(hass, freezer, LIVE_INTERVAL)
    _bat(hass, entity, 60)
    await hass.async_block_till_done()
    await _tick(hass, freezer, LIVE_INTERVAL)
    assert len(_live_calls(calls)) == 1 and not [c for c in calls if c.data.get("message") == "clear_notification"]
    # Fremder Tag: ohne Wirkung. Ladung vorbei (Stand unverändert): der Eintrag fällt weg, die nächste Ladung startet wieder
    await _tick(hass, freezer, 20 * 60)
    assert tag not in [v["tag"] for v in notifier._live.values()]
    _bat(hass, entity, 20)  # entladen
    await hass.async_block_till_done()
    _bat(hass, entity, 45)
    await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 2


async def test_android_cleared_event_and_own_replace(hass: HomeAssistant, freezer) -> None:
    calls, _device_, entity, notifier = await _live_setup(hass)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    tag = _live_calls(calls)[0].data["data"]["tag"]
    # Direkt nach unserem Senden gilt es als Ersetzen, nicht als Wegwischen
    hass.bus.async_fire(LIVE_EVENT_CLEARED, {"message": "x", "tag": tag, "device_id": "pixel"})
    await hass.async_block_till_done()
    assert notifier._live[next(iter(notifier._live))]["phase"] == "active"
    # Später: weggewischt; der Tag darf auch unter "data" stehen
    freezer.tick(timedelta(seconds=30))
    hass.bus.async_fire(LIVE_EVENT_CLEARED, {"message": "x", "data": {"tag": tag}, "device_id": "pixel"})
    await hass.async_block_till_done()
    assert notifier._live[next(iter(notifier._live))]["phase"] == "dismissed"
    # Ein fremder Tag ändert nichts
    hass.bus.async_fire(LIVE_EVENT_CLEARED, {"tag": "etwas_anderes"})
    await hass.async_block_till_done()


async def test_charge_stops_and_no_restart_loop(hass: HomeAssistant, freezer) -> None:
    """Bleibt der Stand "Ladung beendet nach" (15 Min.) unverändert, wird beendet; ohne neuen Anstieg gibt es keinen Neustart."""
    calls, _device_, entity, notifier = await _live_setup(hass)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 1
    await _tick(hass, freezer, 16 * 60)
    clears = [c for c in calls if c.data.get("message") == "clear_notification"]
    assert len(clears) == 1
    for _ in range(3):
        await _tick(hass, freezer, 60)
    assert len(_live_calls(calls)) == 1 and len([c for c in calls if c.data.get("message") == "clear_notification"]) == 1
    # Steigt der Stand wieder, startet die nächste Aktivität
    _bat(hass, entity, 56)
    await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 2


async def test_no_target_and_entity_target(hass: HomeAssistant, freezer) -> None:
    """Ohne Ziel keine Live-Aktivität (nur ein Protokolleintrag); eine notify-Entität kann es nicht."""
    from custom_components.device_panel import activity  # noqa: PLC0415
    from .test_outage_notify import _options  # noqa: PLC0415

    calls, _device_, entity, notifier = await _live_setup(hass, notify_service="none")
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    assert not calls
    for _ in range(3):
        await _tick(hass, freezer, 60)
    texts = [e["text"] for e in activity.snapshot(hass)["entries"] if "no push target" in e["text"]]
    assert len(texts) == 1  # nur einmal je Ladung
    hass.states.async_set("notify.wohnzimmer", "unknown")
    await _options(hass, notify_service="notify.wohnzimmer")
    await hass.async_block_till_done()
    notifier.live_check()
    await hass.async_block_till_done()
    assert not calls
    assert any("not a notify service" in e["text"] for e in activity.snapshot(hass)["entries"])


async def test_survives_restart(hass: HomeAssistant, freezer, hass_storage: dict[str, Any]) -> None:
    """Nach einem Neustart läuft die Live-Aktivität weiter: kein neuer Start, Update im Takt."""
    calls, _device_, entity, notifier = await _live_setup(hass)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 1
    await notifier.async_stop()
    fresh = ChargeNotifier(hass)
    await fresh.async_start()
    await hass.async_block_till_done()
    hass.data[DATA_CHARGE] = fresh
    assert len(fresh._live) == 1 and next(iter(fresh._live.values()))["phase"] == "active"
    _bat(hass, entity, 58)
    await hass.async_block_till_done()
    assert len(_live_calls(calls)) == 1  # Takt noch nicht um
    await _tick(hass, freezer, LIVE_INTERVAL)
    live = _live_calls(calls)
    assert len(live) == 2 and live[1].data["data"]["silent"] is True and live[1].data["data"]["progress"] == 58
    await fresh.async_stop()


def test_module_exports() -> None:
    assert charge_module.LIVE_INTERVAL == 240 and charge_module.LIVE_KEEP == 600


def test_estimate_finish_needs_reliable_data() -> None:
    """2.49.0: die Schätzung erst mit genug Zeit und Anstieg, gegen Ende langsamer, nie über 12 Stunden."""
    est = charge_module.estimate_finish
    pts = [[0.0, 30.0], [600.0, 36.0]]  # 0,6 Punkte pro Minute
    got = est(pts, 36.0, 100.0, 600.0)
    assert got is not None
    finish, rate, minutes = got
    # bis 80 %: 44 Punkte, darüber 20 Punkte doppelt so lang: (44 + 40) / 0,01 pro Sekunde = 8400 s (auf 5 Minuten gerundet)
    assert abs(finish - (600 + 8400)) <= 300 and finish % 300 == 0 and abs(rate - 0.6) < 1e-6 and minutes == 10
    assert est([[0.0, 30.0], [200.0, 36.0]], 36.0, 100.0, 200.0) is None  # zu kurz
    assert est([[0.0, 30.0], [600.0, 32.0]], 32.0, 100.0, 600.0) is None  # zu wenig Anstieg
    assert est(pts, 100.0, 100.0, 600.0) is None  # Ziel erreicht
    assert est([[0.0, 30.0]], 30.0, 100.0, 600.0) is None  # ein Punkt
    assert est([[0.0, 30.0], [1800.0, 33.0]], 33.0, 100.0, 1800.0) is None  # zu langsam: über 12 Stunden
    # ab 80 % zählt die gemessene Geschwindigkeit ohne Abschlag
    late = est([[0.0, 80.0], [600.0, 86.0]], 86.0, 100.0, 600.0)
    assert late is not None and abs(late[0] - (600 + 1400)) <= 300
    # alte Punkte ausserhalb des Fensters zählen nicht
    assert est([[0.0, 10.0], [4000.0, 50.0], [4100.0, 50.0]], 50.0, 100.0, 4100.0) is None


async def test_live_update_shows_the_finish_time_once_reliable(hass: HomeAssistant, freezer) -> None:
    """Der Start zeigt noch keine Zeit; das nächste Update trägt "fertig gegen HH:MM" vor dem Stand."""
    import re  # noqa: PLC0415

    calls, _device_, entity, notifier = await _live_setup(hass)
    _bat(hass, entity, 55)
    await hass.async_block_till_done()
    first = _live_calls(calls)
    assert len(first) == 1 and first[0].data["message"] == "55 % of 100 %"  # noch keine Schätzung
    for level in (56, 57, 58, 59, 60, 61):
        freezer.tick(timedelta(seconds=60))
        _bat(hass, entity, level)
        await hass.async_block_till_done()
    await _tick(hass, freezer, LIVE_INTERVAL)
    live = _live_calls(calls)
    assert len(live) == 3
    # das Update nach 4 Minuten hat noch zu wenig Messzeit, das nächste trägt die Schätzung
    assert live[1].data["message"].endswith("% of 100 %") and "around" not in live[1].data["message"]
    assert re.fullmatch(r"done (?:tomorrow )?around \d\d:\d\d · 61 % of 100 %", live[2].data["message"]), live[2].data["message"]
    assert live[2].data["data"]["critical_text"] == "61 %" and live[2].data["data"]["silent"] is True
    from custom_components.device_panel import activity  # noqa: PLC0415

    activity.set_debug(hass, True)
    freezer.tick(timedelta(seconds=60))
    _bat(hass, entity, 62)
    await _tick(hass, freezer, LIVE_INTERVAL)
    assert any("charging estimate" in e["text"] for e in activity.get(hass).entries)
