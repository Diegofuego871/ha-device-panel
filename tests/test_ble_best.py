"""Bluetooth-Empfang (2.108.0): der stärkste Empfänger statt der, den Home Assistant gerade führt (devices._ble_best)."""

from __future__ import annotations

import sys
import time
from types import SimpleNamespace
from typing import Any

import pytest
import homeassistant.components as components
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr

from custom_components.device_panel import devices
from custom_components.device_panel.const import DATA_BLE_BEST

ADDR = "B0:A7:32:47:26:EA"


def _scanner(source: str, name: str, age: float | None = 1.0, address: str = ADDR) -> SimpleNamespace:
    stamps = {} if age is None else {address: time.monotonic() - age}
    return SimpleNamespace(source=source, name=name, discovered_device_timestamps=stamps)


def _item(scanner: SimpleNamespace, rssi: Any) -> SimpleNamespace:
    return SimpleNamespace(scanner=scanner, advertisement=SimpleNamespace(rssi=rssi))


@pytest.fixture
def ble(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Bluetooth mit einstellbaren Empfängern; "last" ist, was Home Assistant selbst führt."""
    hass.config.components.add("bluetooth")
    state: dict[str, Any] = {"items": [], "last": None, "names": {}}
    # Die echte Integration lässt sich in der Testumgebung nicht laden (USB-Abhängigkeit): ein Ersatz mit denselben Aufrufen
    fake = SimpleNamespace(
        async_scanner_devices_by_address=lambda _hass, _address, connectable=True: list(state["items"]),
        async_last_service_info=lambda _hass, _address, connectable=True: state["last"],
        async_scanner_by_source=lambda _hass, source: state["names"].get(source),
    )
    monkeypatch.setitem(sys.modules, "homeassistant.components.bluetooth", fake)
    monkeypatch.setattr(components, "bluetooth", fake, raising=False)
    state["fake"] = fake
    return state


def test_strongest_receiver_wins_over_the_one_home_assistant_keeps(hass: HomeAssistant, ble) -> None:
    near, far = _scanner("AA:01", "Proxy Büro"), _scanner("AA:02", "Proxy Garage")
    # HA führt die schwächere Meldung weiter (Garage), die stärkere kommt vom Büro
    ble["items"] = [_item(far, -88), _item(near, -61)]
    ble["last"] = SimpleNamespace(source="AA:02", rssi=-88)
    assert devices._ble_best(hass, ADDR) == (-61, "AA:01", "Proxy Büro")
    signal, via = devices._ble_signal(hass, ADDR)
    assert signal == {"kind": "dbm", "value": -61} and via == "Proxy Büro"


def test_value_and_receiver_come_from_the_same_advertisement(hass: HomeAssistant, ble) -> None:
    ble["items"] = [_item(_scanner("AA:01", "A"), -70), _item(_scanner("AA:02", "B"), -55)]
    value, source, name = devices._ble_best(hass, ADDR)
    assert (value, source, name) == (-55, "AA:02", "B")
    device = SimpleNamespace(connections={(dr.CONNECTION_BLUETOOTH, ADDR)})
    assert devices.ble_receiver(hass, device) == ("AA:02", "B")


def test_stale_receivers_are_ignored(hass: HomeAssistant, ble) -> None:
    fresh, old = _scanner("AA:01", "Frisch", age=2), _scanner("AA:02", "Alt", age=600)
    # Der alte Proxy hat einen besseren Wert, hört das Gerät aber seit Minuten nicht mehr: zählt nicht
    ble["items"] = [_item(fresh, -80), _item(old, -50)]
    assert devices._ble_best(hass, ADDR)[:2] == (-80, "AA:01")
    # Selten sendendes Gerät: beide Meldungen liegen nah beieinander (innerhalb des Fensters), beide zählen
    ble["items"] = [_item(_scanner("AA:01", "A", age=200), -80), _item(_scanner("AA:02", "B", age=230), -50)]
    assert devices._ble_best(hass, ADDR)[:2] == (-50, "AA:02")


def test_previous_receiver_stays_while_within_the_tolerance(hass: HomeAssistant, ble) -> None:
    a, b = _scanner("AA:01", "A"), _scanner("AA:02", "B")
    ble["items"] = [_item(a, -60), _item(b, -75)]
    assert devices._ble_best(hass, ADDR)[1] == "AA:01"
    # B ist jetzt 1 dB besser: A bleibt (Rauschen), der Name springt nicht
    ble["items"] = [_item(a, -61), _item(b, -60)]
    assert devices._ble_best(hass, ADDR) == (-61, "AA:01", "A")
    # B ist deutlich besser: Wechsel
    ble["items"] = [_item(a, -70), _item(b, -60)]
    assert devices._ble_best(hass, ADDR) == (-60, "AA:02", "B")
    assert hass.data[DATA_BLE_BEST][ADDR] == "AA:02"
    # Verschwindet der bisherige Empfänger aus der Sicht, gilt der verbleibende
    ble["items"] = [_item(a, -72)]
    assert devices._ble_best(hass, ADDR)[:2] == (-72, "AA:01")


def test_invalid_values_are_skipped_and_fallback_is_the_kept_advertisement(hass: HomeAssistant, ble) -> None:
    # 0 dBm ist ein Platzhalter, kein Messwert: er wäre sonst der "stärkste" und würde einen Empfänger ohne Messung wählen
    ble["items"] = [_item(_scanner("AA:01", "A"), -127), _item(_scanner("AA:02", "B"), None), _item(_scanner("AA:03", "C"), 4), _item(_scanner("AA:04", "D"), 0)]
    ble["last"] = SimpleNamespace(source="AA:09", rssi=-77)
    ble["names"]["AA:09"] = SimpleNamespace(name="Adapter hci0")
    # Keine brauchbare Einzelsicht: wie bisher die Meldung, die HA führt
    assert devices._ble_best(hass, ADDR) == (-77, "AA:09", "Adapter hci0")
    ble["items"] = []
    assert devices._ble_best(hass, ADDR) == (-77, "AA:09", "Adapter hci0")
    ble["last"] = None
    assert devices._ble_best(hass, ADDR) is None
    assert devices._ble_signal(hass, ADDR) == (None, None)


def test_without_timestamps_and_without_bluetooth(hass: HomeAssistant, ble) -> None:
    # Ein Empfänger ohne Zeitangabe zählt als frisch
    ble["items"] = [_item(_scanner("AA:01", "A", age=None), -64)]
    assert devices._ble_best(hass, ADDR)[:2] == (-64, "AA:01")
    hass.config.components.remove("bluetooth")
    assert devices._ble_best(hass, ADDR) is None


def test_interface_errors_are_swallowed(hass: HomeAssistant, ble) -> None:
    def boom(*_a: Any, **_k: Any) -> Any:
        raise RuntimeError("intern geändert")

    ble["fake"].async_scanner_devices_by_address = boom
    assert devices._ble_best(hass, ADDR) is None


def test_timestamps_are_cached_briefly_per_scanner(hass: HomeAssistant, ble) -> None:
    """HA baut die Zeitpunkte je Abfrage neu auf (alle Adressen): kurz zwischenspeichern, aber nie für einen anderen Empfänger."""
    scanner = _scanner("AA:01", "A", age=1)
    ble["items"] = [_item(scanner, -60)]
    devices._ble_best(hass, ADDR)
    scanner.discovered_device_timestamps[ADDR] = time.monotonic() - 500  # innerhalb der Frist unbemerkt
    assert devices._ble_stamps(hass, scanner, time.monotonic())[ADDR] > time.monotonic() - 10
    # Ein anderes Objekt mit derselben Quelle (Empfänger neu angelegt) liest neu
    other = _scanner("AA:01", "A", age=300)
    assert devices._ble_stamps(hass, other, time.monotonic())[ADDR] < time.monotonic() - 100


def test_zero_dbm_does_not_beat_a_real_measurement(hass: HomeAssistant, ble) -> None:
    ble["items"] = [_item(_scanner("AA:01", "Echt"), -83), _item(_scanner("AA:02", "Platzhalter"), 0)]
    assert devices._ble_best(hass, ADDR) == (-83, "AA:01", "Echt")


def test_listeners_list_every_receiver_strongest_first_with_age(hass: HomeAssistant, ble) -> None:
    """Live-Zeile im Empfangs-Fenster (2.109.0): Name, RSSI, Alter in Sekunden, und welcher Empfänger zählt."""
    shelly, store = _scanner("AA:01", "Shelly Garage (B0:A7:32:46:E3:C2)", age=8), _scanner("AA:02", "Storen Küche", age=3)
    ble["items"] = [_item(store, -97), _item(shelly, -76)]
    device = SimpleNamespace(connections={(dr.CONNECTION_BLUETOOTH, ADDR)})
    rows = devices.ble_listeners(hass, device)
    assert [(r["name"], r["rssi"], r["used"]) for r in rows] == [("Shelly Garage", -76, True), ("Storen Küche", -97, False)]
    assert [r["age"] for r in rows] == [8, 3]
    # Der gezählte Empfänger ist derselbe wie beim Wert in der Liste
    assert devices._ble_best(hass, ADDR)[1] == "AA:01"
    # Der bisherige bleibt in der Toleranz auch in der Live-Zeile "gezählt"
    ble["items"] = [_item(store, -75), _item(shelly, -76)]
    assert [r["used"] for r in devices.ble_listeners(hass, device)] == [False, True]


def test_listeners_empty_without_address_view_or_bluetooth(hass: HomeAssistant, ble) -> None:
    device = SimpleNamespace(connections={(dr.CONNECTION_BLUETOOTH, ADDR)})
    assert devices.ble_listeners(hass, device) == []
    assert devices.ble_listeners(hass, SimpleNamespace(connections={("mac", "aa:bb")})) == []
    ble["items"] = [_item(_scanner("AA:01", "A"), -60)]
    hass.config.components.remove("bluetooth")
    assert devices.ble_listeners(hass, device) == []
