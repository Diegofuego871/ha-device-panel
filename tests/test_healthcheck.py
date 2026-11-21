"""
HealthCheck-Dienste (2.236.0): Lebenszeichen an externe Dienste, generisch (URL, Abstand, Zeilen der Fälle mit eigenem Zusatz), bis zu fünf. "In
Ordnung" oder, solange ein Fall zutrifft, die URL mit dem Zusatz der obersten zutreffenden Zeile; Testknöpfe "OK senden" und je Fall. Die URL steht ganz
im Panel (nur für Administratoren) und in der Sicherung, nie im Log. Ein Lebenszeichen hält nie etwas auf.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker, AiohttpClientMockResponse

from custom_components.device_panel import backup
from custom_components.device_panel.const import (
    DATA_BACKUP_ALERT,
    DATA_BATTERY,
    DATA_HEALTHCHECK,
    DATA_OUTAGE,
    DOMAIN,
    HEALTHCHECK_MIN_GAP,
    HEALTHCHECK_START_DELAY,
    HEALTHCHECK_TIMEOUT,
    MAX_HEALTHCHECKS,
)
from custom_components.device_panel.healthcheck import active_case, apply_suffix, case_url, host_of, valid_items, valid_suffix

# Erfundene Kennungen (nie eine echte URL eines Nutzers in Tests)
HC = "https://hc-ping.com/00000000-1111-2222-3333-444444444444"
CR = "https://cronitor.link/p/0123456789abcdef/haus"
CASES = [{"kind": "offline", "suffix": "/fail"}, {"kind": "battery", "suffix": "/1"}]


@pytest.fixture
async def entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Device Panel")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def ws(client, **msg: Any) -> dict[str, Any]:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def advance(hass: HomeAssistant, freezer, seconds: float) -> None:
    """Zeit vorstellen; Aufrufe laufen als Hintergrundaufgaben (async_block_till_done wartet sonst nicht auf sie)."""
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)


async def add(client, **values: Any) -> dict[str, Any]:
    return await ws(client, type=f"{DOMAIN}/healthcheck_save", **{"name": "Haus", "url": HC, "interval": 300, "cases": CASES, **values})


def calls(aioclient_mock: AiohttpClientMocker) -> list[str]:
    return [str(url) for _method, url, _data, _headers in aioclient_mock.mock_calls]


class _Flag:
    """Zustand der echten Wächter nachstellen: das Panel liest nur `offline`, `low` und `failing`."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    @property
    def offline(self) -> dict[str, float]:
        return self._hass.data[DATA_OUTAGE]._offline  # noqa: SLF001

    @offline.setter
    def offline(self, value: dict[str, float]) -> None:
        self._hass.data[DATA_OUTAGE]._offline = value  # noqa: SLF001

    @property
    def low(self) -> dict[str, Any]:
        return self._hass.data[DATA_BATTERY]._low  # noqa: SLF001

    @low.setter
    def low(self, value: dict[str, Any]) -> None:
        self._hass.data[DATA_BATTERY]._low = value  # noqa: SLF001

    @property
    def failing(self) -> bool:
        return self._hass.data[DATA_BACKUP_ALERT].failing

    @failing.setter
    def failing(self, value: bool) -> None:
        self._hass.data[DATA_BACKUP_ALERT]._open = 1.0 if value else None  # noqa: SLF001


@pytest.fixture
def flags(hass: HomeAssistant, entry) -> _Flag:
    return _Flag(hass)


# ----- Werte -----


def test_values_are_checked_one_by_one() -> None:
    """Höchstens fünf, nur http oder https, Abstand 1 Minute bis 24 Stunden; ein kaputter Eintrag fällt einzeln weg, ein kaputter Zusatz macht die Zeile ungültig."""
    items = [{"id": f"a{i}", "url": HC, "interval": 300} for i in range(7)]
    assert len(valid_items(items)) == MAX_HEALTHCHECKS
    out = valid_items([
        {"id": "ok", "url": f" {CR} ", "interval": 5, "cases": [{"kind": "offline", "suffix": " ?state=fail "}, {"kind": "offline", "suffix": "/doppelt"}, {"kind": "ufo", "suffix": "/x"}]},
        {"id": "ftp", "url": "ftp://hc-ping.com/x", "interval": 300},
        {"id": "js", "url": "javascript:alert(1)", "interval": 300},
        {"id": "ok", "url": HC, "interval": 300},  # doppelt
        {"id": "Gross!", "url": HC, "interval": 300},
        {"id": "lang", "url": "http://192.168.1.5:8000/ping/x", "interval": 999999, "cases": [{"kind": "battery", "suffix": "fail"}, {"kind": "backup", "suffix": ""}]},
    ])
    assert [i["id"] for i in out] == ["ok", "lang"]
    assert out[0]["url"] == CR and out[0]["interval"] == 60 and out[0]["name"] == "cronitor.link"
    assert out[0]["cases"] == [{"kind": "offline", "suffix": "?state=fail"}]  # doppelte Art und unbekannte Art fallen weg
    assert out[1]["interval"] == 86400 and out[1]["cases"] == []  # Zusatz ohne "/", "?" oder "&" und leerer Zusatz: keine Zeile


@pytest.mark.parametrize(
    ("url", "suffix", "expected"),
    [
        (HC, "/fail", HC + "/fail"),
        (HC + "/", "/fail", HC + "/fail"),
        (CR, "?state=fail", CR + "?state=fail"),
        (CR + "?state=run&x=1", "?state=fail", CR + "?x=1&state=fail"),
        (HC, "fail", None),
        (HC, "", None),
    ],
)
def test_the_case_address_from_url_and_suffix(url: str, suffix: str, expected: str | None) -> None:
    assert apply_suffix(url, suffix) == expected


def test_only_a_valid_suffix_is_accepted() -> None:
    assert valid_suffix(HC, None) == "" and valid_suffix(HC, "  ") == ""
    assert valid_suffix(HC, " /fail ") == "/fail"
    assert valid_suffix(HC, "fail") is None and valid_suffix(HC, "/a b") is None and valid_suffix(HC, "/" + "x" * 300) is None and valid_suffix(HC, 5) is None


def test_only_the_host_is_named() -> None:
    assert host_of(HC) == "hc-ping.com" and host_of("kaputt") == "?"
    assert case_url({"url": HC, "cases": CASES}, "offline") == HC + "/fail"
    assert case_url({"url": HC, "cases": CASES}, "backup") is None


# ----- Fälle -----


async def test_the_top_row_that_applies_wins(hass: HomeAssistant, entry, flags: _Flag) -> None:
    item = {"url": HC, "cases": [{"kind": "backup", "suffix": "/b"}, {"kind": "offline", "suffix": "/o"}, {"kind": "battery", "suffix": "/l"}]}
    assert active_case(hass, item) is None
    flags.offline = {"d1": 1.0}
    assert active_case(hass, item) == "offline"
    flags.low = {"d2": {}}
    assert active_case(hass, item) == "offline"  # die Reihenfolge der Zeilen entscheidet, nicht die Art
    flags.failing = True
    assert active_case(hass, item) == "backup"
    assert active_case(hass, {"url": HC, "cases": []}) is None  # ohne Zeilen nie ein Fall


# ----- Aufrufe -----


async def test_pings_after_the_start_and_in_its_interval(hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    saved = await add(client, interval=120)
    assert saved["success"], saved
    await advance(hass, freezer, 2)
    assert calls(aioclient_mock) == [HC]  # gleich nach dem Speichern
    status = hass.data[DATA_HEALTHCHECK].status[saved["result"]["id"]]
    assert status["sent"] == "ok" and status["result"] == "ok" and status["code"] == 200
    await advance(hass, freezer, 121)
    assert calls(aioclient_mock) == [HC, HC]
    # Panel: Dienst mit der ganzen URL (Entscheid des Nutzers) und dem letzten Ergebnis
    listing = (await ws(client, type=f"{DOMAIN}/healthcheck_list"))["result"]
    assert listing["max"] == MAX_HEALTHCHECKS and listing["cases"] == ["offline", "battery", "backup"]
    assert listing["items"][0]["url"] == HC and listing["items"][0]["status"]["result"] == "ok" and listing["items"][0]["cases"] == CASES


async def test_a_case_sends_its_address_at_once_and_the_end_the_heartbeat(
    hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker, flags: _Flag
) -> None:
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(HC + "/fail", status=200)
    client = await hass_ws_client(hass)
    saved = await add(client, interval=3600)
    await advance(hass, freezer, HEALTHCHECK_START_DELAY + 1)  # der Takt ruht in den ersten Sekunden nach dem Start
    assert calls(aioclient_mock) == [HC]
    hid = saved["result"]["id"]
    # Ein Gerät fällt aus: im nächsten Takt (höchstens 10 Sekunden) geht die Adresse des Falls hinaus, ohne den Abstand abzuwarten, auch innerhalb des Mindestabstands
    flags.offline = {"d1": 1.0}
    await advance(hass, freezer, 11)
    assert calls(aioclient_mock) == [HC, HC + "/fail"]
    assert hass.data[DATA_HEALTHCHECK].status[hid]["sent"] == "offline"
    # Ende des Falls: das Lebenszeichen, aber erst nach dem Mindestabstand zum letzten Aufruf
    flags.offline = {}
    await advance(hass, freezer, 11)
    assert calls(aioclient_mock) == [HC, HC + "/fail"]
    await advance(hass, freezer, HEALTHCHECK_MIN_GAP)
    assert calls(aioclient_mock) == [HC, HC + "/fail", HC]
    assert hass.data[DATA_HEALTHCHECK].status[hid]["sent"] == "ok"


async def test_a_service_without_a_row_for_the_case_only_sends_the_heartbeat(
    hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker, flags: _Flag
) -> None:
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    await add(client, cases=[{"kind": "backup", "suffix": "/b"}], interval=60)
    await advance(hass, freezer, HEALTHCHECK_START_DELAY + 1)
    flags.offline = {"d1": 1.0}  # keine Zeile dafür
    await advance(hass, freezer, 70)
    assert set(calls(aioclient_mock)) == {HC}


async def test_the_test_buttons_send_exactly_what_they_say(hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(HC + "/fail", status=200)
    aioclient_mock.get(HC + "/1", status=200)
    client = await hass_ws_client(hass)
    hid = (await add(client))["result"]["id"]
    await advance(hass, freezer, 2)
    aioclient_mock.clear_requests()
    aioclient_mock.get(HC, status=200)
    aioclient_mock.get(HC + "/fail", status=200)
    aioclient_mock.get(HC + "/1", status=200)
    aioclient_mock.mock_calls.clear()
    for kind, url in (("offline", HC + "/fail"), ("battery", HC + "/1"), ("ok", HC)):
        result = await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind=kind)
        assert result["success"] and result["result"]["status"]["test"] is True and result["result"]["status"]["sent"] == kind
        assert calls(aioclient_mock)[-1] == url
    # Ein Fall ohne Zeile lässt sich nicht testen
    result = await ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=hid, kind="backup")
    assert not result["success"] and result["error"]["code"] == "not_found"


async def test_a_failing_call_is_recorded_without_the_address(hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker, caplog) -> None:
    aioclient_mock.get(HC, status=500)
    client = await hass_ws_client(hass)
    hid = (await add(client))["result"]["id"]
    await advance(hass, freezer, 2)
    assert hass.data[DATA_HEALTHCHECK].status[hid]["result"] == "http" and hass.data[DATA_HEALTHCHECK].status[hid]["code"] == 500
    # Nur was die Integration selbst ins Log schreibt (das Test-Log von Home Assistant zeigt beim Speichern auch den Inhalt der Ablage)
    ours = " ".join(r.getMessage() for r in caplog.records if r.name.startswith("custom_components.device_panel"))
    assert "hc-ping.com" in ours and HC not in ours and "00000000-1111" not in ours


async def test_a_hanging_service_never_holds_anything_up(hass: HomeAssistant, entry, hass_ws_client, aioclient_mock: AiohttpClientMocker, monkeypatch) -> None:
    """Ein Dienst, der nie antwortet: der Aufruf endet nach seiner Zeitgrenze als "keine Antwort", Speichern und Testknopf warten nicht auf ewig."""
    monkeypatch.setattr("custom_components.device_panel.healthcheck.HEALTHCHECK_TIMEOUT", 0.2)

    async def hang(*_args) -> AiohttpClientMockResponse:
        await asyncio.sleep(30)
        raise AssertionError("nie erreicht")

    aioclient_mock.get(HC, side_effect=hang)
    client = await hass_ws_client(hass)
    saved = await asyncio.wait_for(add(client), 2)
    assert saved["success"]
    result = await asyncio.wait_for(ws(client, type=f"{DOMAIN}/healthcheck_ping", check_id=saved["result"]["id"], kind="ok"), 2)
    assert result["result"]["status"]["result"] == "timeout"
    assert HEALTHCHECK_TIMEOUT == 10


async def test_the_first_ping_after_a_restart_waits_a_little(hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    await add(client)
    await advance(hass, freezer, 2)
    healthcheck = hass.data[DATA_HEALTHCHECK]
    assert len(calls(aioclient_mock)) == 1
    await healthcheck.async_stop()
    healthcheck._last_auto.clear()  # noqa: SLF001 (nach einem Neustart von Home Assistant weiss der Speicher nichts mehr)
    aioclient_mock.mock_calls.clear()
    healthcheck.async_start()
    await advance(hass, freezer, HEALTHCHECK_START_DELAY - 5)
    assert calls(aioclient_mock) == []
    await advance(hass, freezer, 10)
    assert calls(aioclient_mock) == [HC]


# ----- Verwalten -----


async def test_save_edit_delete_and_limits(hass: HomeAssistant, entry, freezer, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    for url in ("", "ftp://x/y", "kein url", "https://"):
        assert (await add(client, url=url))["error"]["code"] == "invalid_url"
    assert (await add(client, name="  "))["error"]["code"] == "invalid_name"
    assert (await add(client, cases=[{"kind": "offline", "suffix": "fail"}]))["error"]["code"] == "invalid_suffix"
    assert (await add(client, cases=[{"kind": "offline", "suffix": "/a"}, {"kind": "offline", "suffix": "/b"}]))["error"]["code"] == "invalid_suffix"
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_save", name="x", url=HC, interval=5, cases=[]))["error"]["code"] == "invalid_format"
    ids = []
    for n in range(MAX_HEALTHCHECKS):
        saved = await add(client, name=f"Dienst {n}")
        assert saved["success"], saved
        ids.append(saved["result"]["id"])
    assert (await add(client))["error"]["code"] == "too_many"
    # Ändern: Name, Zeilen und Reihenfolge
    edited = await add(client, check_id=ids[0], name="Neu", cases=[{"kind": "battery", "suffix": "/l"}, {"kind": "offline", "suffix": "/o"}])
    assert edited["success"]
    first = next(i for i in edited["result"]["items"] if i["id"] == ids[0])
    assert first["name"] == "Neu" and [c["kind"] for c in first["cases"]] == ["battery", "offline"]
    assert (await add(client, check_id="gibtsnicht"))["error"]["code"] == "not_found"
    deleted = await ws(client, type=f"{DOMAIN}/healthcheck_delete", check_id=ids[1])
    assert deleted["success"] and len(deleted["result"]["items"]) == MAX_HEALTHCHECKS - 1
    assert (await ws(client, type=f"{DOMAIN}/healthcheck_delete", check_id=ids[1]))["error"]["code"] == "not_found"


async def test_only_administrators_see_or_change_the_services(hass: HomeAssistant, entry, hass_client_no_auth, hass_read_only_access_token) -> None:
    """Ein Benutzer ohne Administratorrechte bekommt weder die Liste (mit den URLs) noch das Protokoll, und er kann nichts speichern."""
    from homeassistant.components.websocket_api.const import URL

    client = await hass_client_no_auth()
    async with client.ws_connect(URL) as sock:
        await sock.receive_json()
        await sock.send_json({"type": "auth", "access_token": hass_read_only_access_token})
        assert (await sock.receive_json())["type"] == "auth_ok"
        for n, msg in enumerate((
            {"type": f"{DOMAIN}/healthcheck_list"},
            {"type": f"{DOMAIN}/healthcheck_history", "check_id": "x", "hours": 24},
            {"type": f"{DOMAIN}/healthcheck_save", "name": "a", "url": HC, "interval": 300},
            {"type": f"{DOMAIN}/healthcheck_delete", "check_id": "x"},
            {"type": f"{DOMAIN}/healthcheck_ping", "check_id": "x", "kind": "ok"},
        )):
            await sock.send_json({"id": n + 1, **msg})
            answer = await sock.receive_json()
            assert answer["success"] is False and answer["error"]["code"] == "unauthorized", msg


async def test_health_checks_are_part_of_the_backup(hass: HomeAssistant, entry, hass_ws_client, aioclient_mock: AiohttpClientMocker) -> None:
    """Sichern, zurücksetzen, wiederherstellen: die Dienste kommen mit URL und Zeilen zurück; die Vorschau nennt nie die URL."""
    aioclient_mock.get(HC, status=200)
    client = await hass_ws_client(hass)
    await add(client, name="Eins")
    await add(client, name="Zwei", url=CR, cases=[{"kind": "backup", "suffix": "?state=fail"}])
    file = await backup.async_export(hass, ["monitor"])
    saved = file["sections"]["monitor"]["healthchecks"]
    assert [i["name"] for i in saved] == ["Eins", "Zwei"] and saved[1]["url"] == CR and saved[1]["cases"] == [{"kind": "backup", "suffix": "?state=fail"}]
    # Zurücksetzen
    for item in list(saved):
        await ws(client, type=f"{DOMAIN}/healthcheck_delete", check_id=item["id"])
    assert hass.data[DATA_HEALTHCHECK].items() == []
    # Vorschau ändert nichts und nennt keine URL
    preview = await backup.async_import(hass, file, ["monitor"], dry_run=True)
    assert preview["sections"]["monitor"]["changed"] >= 2 and hass.data[DATA_HEALTHCHECK].items() == []
    assert CR not in str(preview) and HC not in str(preview)
    report = await backup.async_import(hass, file, ["monitor"], dry_run=False)
    assert report["sections"]["monitor"]["skipped"] == []
    assert hass.data[DATA_HEALTHCHECK].items() == saved
    # Zweimal ist derselbe Zustand: nichts ändert sich mehr
    again = await backup.async_import(hass, file, ["monitor"], dry_run=False)
    assert again["sections"]["monitor"]["changed"] == 0
    # Ein beschädigter Dienst fällt einzeln weg
    broken = {**file, "sections": {"monitor": {**file["sections"]["monitor"], "healthchecks": [*saved, {"id": "kaputt", "url": "javascript:x", "interval": 300}]}}}
    skipped = (await backup.async_import(hass, broken, ["monitor"], dry_run=True))["sections"]["monitor"]["skipped"]
    assert [s["what"] for s in skipped] == ["kaputt"]


async def test_removing_the_integration_stops_the_services(hass: HomeAssistant, entry, aioclient_mock: AiohttpClientMocker) -> None:
    assert hass.data[DATA_HEALTHCHECK].started
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert DATA_HEALTHCHECK not in hass.data


async def test_backup_alert_failing_follows_open_failures(hass: HomeAssistant, entry) -> None:
    alert = hass.data[DATA_BACKUP_ALERT]
    assert alert.failing is False
    alert._pending = {"ts": 1.0, "kind": "failed"}  # noqa: SLF001 (Zustand nachstellen)
    assert alert.failing is True
    alert._pending = {"ts": 1.0, "kind": "ok", "secs": 5.0}  # noqa: SLF001
    assert alert.failing is False
    alert._open = 1.0  # noqa: SLF001
    assert alert.failing is True
