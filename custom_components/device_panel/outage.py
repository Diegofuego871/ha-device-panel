"""
Push bei Ausfall und bei Rückkehr (Optionen im Abschnitt
"Push-Benachrichtigung").

Ausfall wird sofort gemeldet, sobald das Protokoll ihn erkennt (also nach
"Ausgefallen nach"), Rückkehr mit der Dauer des Ausfalls. Fallen im selben
Durchlauf mehrere Geräte aus, kommt wahlweise eine Sammelmeldung mit
vermuteter Ursache. Welche Geräte gerade als ausgefallen gemeldet sind, steht
in einer eigenen Datei: Ein Neustart meldet einen laufenden Ausfall nicht
erneut, und die Rückkehr kommt auch nach einem Neustart. Fehlt ein Gerät
dort, obwohl das Protokoll den Ausfall schon vor einer Lücke kennt (eine
Weile nicht überwacht), gilt dasselbe. Pro Gerät lassen
sich die Meldungen ausschalten; überwacht wird das Gerät weiter.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import push
from .availability import OFFLINE, ONLINE, AvailabilityLog
from .const import (
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_GROUP,
    CONF_NOTIFY_ONLINE,
    CONF_NOTIFY_OUTAGE,
    CONF_NOTIFY_SERVICE,
    DOMAIN,
    NOTIFY_GROUP_MIN,
    NOTIFY_NONE,
    STORAGE_VERSION,
)
from .devices import async_integration_info, device_settings, primary_domain
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.notify"


class OutageNotifier:
    def __init__(self, hass: HomeAssistant, log: AvailabilityLog) -> None:
        self.hass = hass
        self._log = log
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Gerade als ausgefallen bekannt: Gerät → Beginn (Unix-Zeit).
        self._offline: dict[str, float] = {}
        self._unsub: Any = None

    @property
    def offline(self) -> dict[str, float]:
        return self._offline

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("offline") if isinstance(stored, dict) else None
        if isinstance(raw, dict):
            self._offline = {str(k): float(v) for k, v in raw.items() if isinstance(v, (int, float))}
        self._unsub = self._log.add_listener(self._on_changes)

    async def async_stop(self) -> None:
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
        # Sofort schreiben: ein verzögerter Termin legte die Datei nach dem
        # Entfernen der Integration sonst neu an.
        await self._store.async_save({"offline": self._offline})

    @callback
    def _on_changes(self, changes: list[tuple[str, Any, float]]) -> None:
        self.hass.async_create_task(self.async_handle(changes))

    async def async_handle(self, changes: list[tuple[str, Any, float]]) -> None:
        went_off: list[tuple[str, float]] = []
        came_back: list[tuple[str, float]] = []
        dirty = False
        for dev, state, at in changes:
            if state == OFFLINE and dev not in self._offline:
                start, _seen = self._log.open_outage(dev)
                if start is not None and start < at:
                    # Lief schon vor einer Lücke (Neustart, eine Weile nicht
                    # überwacht): derselbe Ausfall, nicht nochmals melden; die
                    # Rückkehr nennt die ganze Dauer.
                    self._offline[dev] = start
                    dirty = True
                    continue
                self._offline[dev] = at
                went_off.append((dev, at))
            elif state == ONLINE and dev in self._offline:
                came_back.append((dev, max(0.0, at - self._offline.pop(dev))))
            elif state == "gone":
                # Nicht mehr überwacht: vergessen, ohne Meldung.
                self._offline.pop(dev, None)
        if dirty or went_off or came_back or any(state == "gone" for _d, state, _a in changes):
            self._store.async_delay_save(lambda: {"offline": self._offline}, 1)
        opts = effective(self.hass)
        if opts[CONF_NOTIFY_SERVICE] == NOTIFY_NONE:
            return
        muted = device_settings(self.hass)["notify_off"]
        went_off = [x for x in went_off if x[0] not in muted]
        came_back = [x for x in came_back if x[0] not in muted]
        if went_off and opts[CONF_NOTIFY_OUTAGE]:
            await self._async_push(opts, went_off, online=False)
        if came_back and opts[CONF_NOTIFY_ONLINE]:
            await self._async_push(opts, came_back, online=True)

    async def _async_push(self, opts: dict[str, Any], items: list[tuple[str, float]], online: bool) -> None:
        hass = self.hass
        dev_reg = dr.async_get(hass)
        area_reg = ar.async_get(hass)
        target = opts[CONF_NOTIFY_SERVICE]
        info: list[dict[str, Any]] = []
        for dev, value in items:
            device = dev_reg.async_get(dev)
            if device is None:
                continue
            area = area_reg.async_get_area(device.area_id) if device.area_id else None
            info.append(
                {
                    "id": dev,
                    "name": device.name_by_user or device.name or dev,
                    "area": area.name if area else None,
                    "domain": primary_domain(hass, device),
                    "value": value,
                }
            )
        if not info:
            return
        names = await async_integration_info(hass, {i["domain"] for i in info if i["domain"]})
        integ = lambda d: names.get(d, {}).get("name", d) if d else None  # noqa: E731
        kind = "online" if online else "outage"
        if opts[CONF_NOTIFY_GROUP] and len(info) >= NOTIFY_GROUP_MIN:
            # Viele im selben Durchlauf: eine Meldung, mit gemeinsamer
            # Integration als vermutete Ursache.
            domains = {i["domain"] for i in info}
            parts = [", ".join(i["name"] for i in info)]
            if not online and len(domains) == 1 and (common := next(iter(domains))):
                parts.append(push.text(hass, "outage_cause", integration=integ(common)))
            await push.async_push(
                hass,
                target,
                push.text(hass, f"{kind}_title_many", count=len(info)),
                " · ".join(parts),
                push.notification_data(hass, f"{DOMAIN}_incident", push.panel_url()),
            )
            return
        for i in info:
            if online:
                parts = [push.text(hass, "online_after", duration=push.duration(hass, i["value"])), i["area"]]
            else:
                started = dt_util.as_local(dt_util.utc_from_timestamp(i["value"])).strftime("%H:%M")
                parts = [i["area"], integ(i["domain"]), push.text(hass, "outage_since", time=started)]
            # Gleicher Tag für Ausfall und Rückkehr: die Rückkehr ersetzt die
            # Ausfall-Meldung auf dem Handy.
            data = push.notification_data(hass, f"{DOMAIN}_device_{i['id']}", push.device_url(opts[CONF_NOTIFY_CLICK], i["id"]))
            await push.async_push(
                hass, target, push.text(hass, f"{kind}_title", name=i["name"]), " · ".join(x for x in parts if x), data
            )
