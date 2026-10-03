"""
Meldungen bei Ausfall und Rückkehr (Abschnitte "Push-Benachrichtigung" und
"Anhaltende Benachrichtigung", Bild 5 in docs/mockups/panel-v1).

Ein Ausfall wird gemeldet, sobald das Protokoll ihn erkennt (also nach
"Ausgefallen nach"), oder erst, wenn er "Erst melden nach" Minuten dauert;
kürzere Aussetzer lösen dann weder Ausfall- noch Online-Meldung aus. Die
Rückkehr kommt mit der Dauer des Ausfalls, nur für gemeldete Ausfälle.
Werden mehrere Geräte zugleich fällig, kommt wahlweise eine Sammelmeldung
mit vermuteter Ursache. Welche Geräte gerade als ausgefallen bekannt und
welche davon gemeldet sind, steht in einer eigenen Datei: Ein Neustart
meldet einen laufenden Ausfall nicht erneut, die Rückkehr kommt auch nach
einem Neustart, und ein noch nicht fälliger Ausfall wird nach dem Start
gemeldet, wenn er dann lang genug dauert. Fehlt ein Gerät dort, obwohl das
Protokoll den Ausfall schon vor einer Lücke kennt (eine Weile nicht
überwacht), gilt er als gemeldet.

Kein Push für Geräte mit "Meldungen aus", für stumm geschaltete (Aktion
"24 Std. stumm" in der Meldung) und für Geräte von Integrationen ohne Push;
überwacht werden sie weiter. Die anhaltende Benachrichtigung in Home
Assistant listet alle gerade ausgefallenen Geräte, ausser "Meldungen aus"
und Integrationen ohne "Anhaltend".
"""

from __future__ import annotations

import logging
import time
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import push
from .availability import OFFLINE, ONLINE, AvailabilityLog
from .const import (
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_DELAY,
    CONF_NOTIFY_EXCLUDE,
    CONF_NOTIFY_FIELDS,
    CONF_NOTIFY_GROUP,
    CONF_NOTIFY_ONLINE,
    CONF_NOTIFY_OUTAGE,
    CONF_NOTIFY_SERVICE,
    CONF_OUTAGE_PERSISTENT,
    CONF_PERSISTENT_EXCLUDE,
    DOMAIN,
    MUTE_ACTION_PREFIX,
    MUTE_HOURS,
    NOTIFY_GROUP_MIN,
    NOTIFY_NONE,
    PERSISTENT_OUTAGE_ID,
    STORAGE_VERSION,
)
from .devices import async_device_facts, async_mute_device, device_settings, notify_muted_until, primary_domain
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.notify"
# Ereignis der Companion-App, wenn ein Knopf unter einer Meldung getippt wird.
EVENT_ACTION = "mobile_app_notification_action"


def _local_time(ts: float) -> str:
    return dt_util.as_local(dt_util.utc_from_timestamp(ts)).strftime("%H:%M")


class OutageNotifier:
    def __init__(self, hass: HomeAssistant, log: AvailabilityLog) -> None:
        self.hass = hass
        self._log = log
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Gerade als ausgefallen bekannt: Gerät → Beginn (Unix-Zeit).
        self._offline: dict[str, float] = {}
        # Davon gemeldet (oder ohne Meldung erledigt): nur für diese kommt
        # "wieder online", und ein Neustart meldet sie nicht erneut.
        self._notified: set[str] = set()
        self._unsubs: list[CALLBACK_TYPE] = []
        self._timer: CALLBACK_TYPE | None = None
        # Anhaltende Benachrichtigung: gezeigt, letzter Inhalt; weggeklickt
        # erscheint sie erst bei einem neuen Ausfall wieder.
        self._shown = False
        self._message: str | None = None
        self._refresh = True

    @property
    def offline(self) -> dict[str, float]:
        return self._offline

    @property
    def notified(self) -> set[str]:
        return self._notified

    def _data(self) -> dict[str, Any]:
        return {"offline": self._offline, "notified": sorted(self._notified)}

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("offline") if isinstance(stored, dict) else None
        if isinstance(raw, dict):
            self._offline = {str(k): float(v) for k, v in raw.items() if isinstance(v, (int, float))}
        notified = stored.get("notified") if isinstance(stored, dict) else None
        # Ältere Datei ohne "notified": alles bekannte gilt als gemeldet.
        self._notified = {str(d) for d in notified if d in self._offline} if isinstance(notified, list) else set(self._offline)
        self._unsubs.append(self._log.add_listener(self._on_changes))
        self._unsubs.append(self.hass.bus.async_listen(EVENT_ACTION, self._on_action))
        self._unsubs.append(persistent_notification.async_register_callback(self.hass, self._on_notification))
        # Beim Start von HA meldet die erste Bewertung des Protokolls jedes
        # Gerät, danach folgt ein Durchlauf hier. Läuft HA schon (Integration
        # neu geladen), hat das Protokoll vor uns bewertet: gleich nachholen
        # (fällige Meldungen, anhaltende Benachrichtigung).
        if self.hass.is_running:
            self.hass.async_create_task(self.async_flush())

    async def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        if self._timer is not None:
            self._timer()
            self._timer = None
        if self._shown:
            persistent_notification.async_dismiss(self.hass, PERSISTENT_OUTAGE_ID)
        # Sofort schreiben: ein verzögerter Termin legte die Datei nach dem
        # Entfernen der Integration sonst neu an.
        await self._store.async_save(self._data())

    @callback
    def _on_changes(self, changes: list[tuple[str, Any, float]]) -> None:
        self.hass.async_create_task(self.async_handle(changes))

    @callback
    def _on_notification(self, update_type: persistent_notification.UpdateType, items: dict[str, Any]) -> None:
        """Merkt, ob unsere Meldung noch da ist (wer sie wegklickt, will Ruhe)."""
        if PERSISTENT_OUTAGE_ID in items:
            self._shown = update_type != persistent_notification.UpdateType.REMOVED

    async def _on_action(self, event: Event) -> None:
        """Knopf "24 Std. stumm" unter einer Meldung: Push für das Gerät stumm."""
        action = str(event.data.get("action") or "")
        if not action.startswith(MUTE_ACTION_PREFIX):
            return
        device_id = action[len(MUTE_ACTION_PREFIX):]
        if dr.async_get(self.hass).async_get(device_id) is None:
            return
        await async_mute_device(self.hass, device_id, time.time() + MUTE_HOURS * 3600)
        _LOGGER.debug("Meldungen für %s %d Std. stumm", device_id, MUTE_HOURS)

    async def async_options_changed(self) -> None:
        self._refresh = True
        await self.async_flush()

    async def async_handle(self, changes: list[tuple[str, Any, float]]) -> None:
        came_back: list[tuple[str, float]] = []
        new_outage = False
        dirty = False
        for dev, state, at in changes:
            if state == OFFLINE and dev not in self._offline:
                start, _seen = self._log.open_outage(dev)
                dirty = True
                if start is not None and start < at:
                    # Lief schon vor einer Lücke (Neustart, eine Weile nicht
                    # überwacht): derselbe Ausfall, nicht nochmals melden; die
                    # Rückkehr nennt die ganze Dauer.
                    self._offline[dev] = start
                    self._notified.add(dev)
                    continue
                self._offline[dev] = at
                new_outage = True
            elif state == ONLINE and dev in self._offline:
                start = self._offline.pop(dev)
                dirty = True
                if dev in self._notified:
                    self._notified.discard(dev)
                    came_back.append((dev, max(0.0, at - start)))
            elif state == "gone":
                # Nicht mehr überwacht: vergessen, ohne Meldung.
                if self._offline.pop(dev, None) is not None:
                    dirty = True
                self._notified.discard(dev)
        if dirty:
            self._store.async_delay_save(self._data, 1)
        await self.async_flush(new_outage=new_outage, came_back=came_back)

    async def async_flush(self, new_outage: bool = False, came_back: list[tuple[str, float]] | None = None) -> None:
        """Fällige Ausfall-Meldungen, Online-Meldungen, anhaltende Benachrichtigung, nächster Termin."""
        opts = effective(self.hass)
        now = time.time()
        delay = opts[CONF_NOTIFY_DELAY] * 60
        due = [(dev, start) for dev, start in self._offline.items() if dev not in self._notified and start + delay <= now]
        if due:
            # Fällig heisst erledigt, auch wenn für das Gerät kein Push geht
            # (aus, stumm, Integration ohne Push): sonst käme er später.
            self._notified.update(dev for dev, _start in due)
            self._store.async_delay_save(self._data, 1)
        if opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE:
            if due and opts[CONF_NOTIFY_OUTAGE]:
                await self._async_push(opts, [x for x in due if self._pushable(opts, x[0], now)], online=False)
            if came_back and opts[CONF_NOTIFY_ONLINE]:
                await self._async_push(opts, [x for x in came_back if self._pushable(opts, x[0], now)], online=True)
        self._update_persistent(opts, new_outage)
        self._schedule(delay, now)

    @callback
    def _schedule(self, delay: float, now: float) -> None:
        """Termin für den nächsten noch nicht fälligen Ausfall."""
        if self._timer is not None:
            self._timer()
            self._timer = None
        pending = [start + delay for dev, start in self._offline.items() if dev not in self._notified]
        if pending:
            self._timer = async_call_later(self.hass, max(1.0, min(pending) - now + 1), self._on_timer)

    @callback
    def _on_timer(self, _now: Any) -> None:
        self._timer = None
        self.hass.async_create_task(self.async_flush())

    def _pushable(self, opts: dict[str, Any], dev: str, now: float) -> bool:
        if dev in device_settings(self.hass)["notify_off"] or notify_muted_until(self.hass, dev, now):
            return False
        device = dr.async_get(self.hass).async_get(dev)
        return device is not None and primary_domain(self.hass, device) not in opts[CONF_NOTIFY_EXCLUDE]

    async def _async_push(self, opts: dict[str, Any], items: list[tuple[str, float]], online: bool) -> None:
        hass = self.hass
        dev_reg = dr.async_get(hass)
        target = opts[CONF_NOTIFY_SERVICE]
        info: list[dict[str, Any]] = []
        for dev, value in items:
            device = dev_reg.async_get(dev)
            if device is None:
                continue
            info.append({"id": dev, "name": device.name_by_user or device.name or dev, "value": value, **await async_device_facts(hass, device, opts)})
        if not info:
            return
        kind = "online" if online else "outage"
        if opts[CONF_NOTIFY_GROUP] and len(info) >= NOTIFY_GROUP_MIN:
            # Viele zugleich: eine Meldung, mit gemeinsamer Integration als
            # vermutete Ursache.
            domains = {i["domain"] for i in info}
            parts = [", ".join(i["name"] for i in info)]
            if not online and len(domains) == 1 and next(iter(domains)):
                parts.append(push.text(hass, "outage_cause", integration=info[0]["integration"]))
            await push.async_push(
                hass,
                target,
                push.text(hass, f"{kind}_title_many", count=len(info)),
                " · ".join(parts),
                push.notification_data(hass, f"{DOMAIN}_incident", push.panel_url()),
            )
            return
        for i in info:
            url = push.device_url(opts[CONF_NOTIFY_CLICK], i["id"])
            if online:
                parts = [push.text(hass, "online_after", duration=push.duration(hass, i["value"])), i["area"]]
                actions = None
            else:
                parts = self.message_parts(opts, i)
                actions = push.device_actions(hass, url, i["id"])
            # Gleicher Tag für Ausfall und Rückkehr: die Rückkehr ersetzt die
            # Ausfall-Meldung auf dem Handy.
            data = push.notification_data(hass, f"{DOMAIN}_device_{i['id']}", url, actions)
            await push.async_push(
                hass, target, push.text(hass, f"{kind}_title", name=i["name"]), " · ".join(x for x in parts if x), data
            )

    def message_parts(self, opts: dict[str, Any], i: dict[str, Any]) -> list[str]:
        """Inhalt einer Ausfall-Meldung nach "Inhalt der Meldung", in fester Folge."""
        hass = self.hass
        parts: list[str] = []
        for field in opts[CONF_NOTIFY_FIELDS]:
            if field == "area":
                parts.append(i["area"] or "")
            elif field == "integration":
                parts.append(i["integration"] or "")
            elif field == "since":
                parts.append(push.text(hass, "outage_since", time=_local_time(i["value"])))
            elif field == "battery" and (bat := i["battery"]):
                level = f"{bat['level']} %" if bat.get("level") is not None else push.text(hass, "battery_low") if bat.get("low") else None
                if level:
                    parts.append(push.text(hass, "field_battery", level=level))
            elif field == "connection" and i["connection"]:
                parts.append(push.text(hass, f"conn_{i['connection']}"))
            elif field == "signal" and (sig := i["signal"]) and sig.get("value") is not None:
                value = f"{sig['value']} dBm" if sig["kind"] == "dbm" else f"LQI {sig['value']}"
                parts.append(push.text(hass, "field_signal", value=value))
            elif field == "model":
                parts.append(i["model"] or "")
        return [p for p in parts if p]

    def _update_persistent(self, opts: dict[str, Any], new_outage: bool) -> None:
        """Anhaltende Benachrichtigung mit allen gerade ausgefallenen Geräten."""
        hass = self.hass
        dev_reg = dr.async_get(hass)
        off = device_settings(hass)["notify_off"]
        lines: list[tuple[float, str]] = []
        if opts[CONF_OUTAGE_PERSISTENT]:
            for dev, start in self._offline.items():
                device = dev_reg.async_get(dev)
                if device is None or dev in off or primary_domain(hass, device) in opts[CONF_PERSISTENT_EXCLUDE]:
                    continue
                name = device.name_by_user or device.name or dev
                since = push.text(hass, "outage_persistent_since", time=_local_time(start))
                lines.append((start, f"- [{name}]({push.panel_url(dev)}) · {since}"))
        if not lines:
            if self._shown:
                persistent_notification.async_dismiss(hass, PERSISTENT_OUTAGE_ID)
            self._message = None
            self._refresh = False
            return
        message = "\n".join(
            [push.text(hass, "outage_persistent_intro"), "", *(line for _s, line in sorted(lines)), "", push.text(hass, "outage_persistent_outro")]
        )
        # Weggeklickt: erst bei einem neuen Ausfall (oder nach Start bzw.
        # geänderten Optionen) wieder zeigen; sonst nur nachführen, wenn sich
        # der Inhalt ändert.
        if not (self._shown or new_outage or self._refresh):
            return
        self._refresh = False
        if self._shown and message == self._message:
            return
        persistent_notification.async_create(hass, message, push.text(hass, "outage_persistent_title"), PERSISTENT_OUTAGE_ID)
        self._message = message
        self._shown = True
