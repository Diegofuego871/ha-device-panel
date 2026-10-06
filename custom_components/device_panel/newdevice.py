"""
Push bei neuen Geräten (seit 1.24.0, Reiter "Neu" in "Überwachung und
Meldungen"): Legt Home Assistant ein Gerät an, merkt sich das Panel es und
meldet nach dem Sammelfenster (Minuten) alle, die inzwischen dazukamen, in
einer Meldung. Das Fenster gibt auch Bereich, Hersteller und Modell Zeit, sich
zu füllen; eine neu hinzugefügte Integration mit vielen Geräten ergibt eine
Sammelmeldung statt vieler. Gemeldet werden nur Geräte, die nach dem
Einschalten entstehen. Nicht gemeldet werden ausgeblendete, deaktivierte und
Dienst-Geräte, ausgeschlossene Integrationen und Geräte einer Integration,
die pro Integration auf "keine neuen Geräte melden" steht. Optional eine
anhaltende Benachrichtigung in HA mit den zuletzt gefundenen Geräten (bleibt,
bis sie weggeklickt wird).
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

from . import push
from .const import (
    CONF_NEW_EXCLUDE,
    CONF_NEW_FIELDS,
    CONF_NEW_PERSISTENT,
    CONF_NEW_WINDOW,
    CONF_NOTIFY_CLICK,
    CONF_NOTIFY_NEW,
    CONF_NOTIFY_SERVICE,
    DOMAIN,
    NEW_RECENT_MAX,
    NOTIFY_NONE,
    PERSISTENT_NEW_ID,
    STORAGE_VERSION,
)
from .devices import async_device_facts, primary_domain, shown_devices
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.new"


class NewDeviceNotifier:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        # Seit der letzten Meldung angelegte Geräte (ID -> Zeitpunkt).
        self._pending: dict[str, float] = {}
        # Zuletzt gefundene Geräte für die anhaltende Benachrichtigung.
        self._recent: list[dict[str, Any]] = []
        self._shown = False
        self._unsubs: list[CALLBACK_TYPE] = []
        self._unsub_timer: CALLBACK_TYPE | None = None

    @property
    def pending(self) -> dict[str, float]:
        return self._pending

    @property
    def recent(self) -> list[dict[str, Any]]:
        return self._recent

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        if isinstance(stored, dict) and isinstance(raw := stored.get("recent"), list):
            self._recent = [r for r in raw if isinstance(r, dict) and isinstance(r.get("id"), str)][:NEW_RECENT_MAX]
        self._unsubs.append(self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._on_registry))
        self._unsubs.append(persistent_notification.async_register_callback(self.hass, self._on_notification))

    @callback
    def _on_registry(self, event: Event) -> None:
        if event.data.get("action") != "create":
            return
        opts = effective(self.hass)
        if not opts[CONF_NOTIFY_NEW]:
            return
        self._pending.setdefault(event.data["device_id"], time.time())
        # Das Fenster beginnt mit dem ersten neuen Gerät.
        if self._unsub_timer is None:
            self._unsub_timer = async_call_later(self.hass, opts[CONF_NEW_WINDOW] * 60, self._on_timer)

    @callback
    def _on_timer(self, _now: Any) -> None:
        self._unsub_timer = None
        self.hass.async_create_task(self.async_flush())

    @callback
    def _on_notification(self, update_type: persistent_notification.UpdateType, items: dict[str, Any]) -> None:
        """Wer unsere Meldung wegklickt, will Ruhe: die Liste der zuletzt gefundenen beginnt neu."""
        if PERSISTENT_NEW_ID not in items:
            return
        self._shown = update_type != persistent_notification.UpdateType.REMOVED
        if update_type == persistent_notification.UpdateType.REMOVED and self._recent:
            self._recent = []
            self._save()

    async def async_options_changed(self) -> None:
        opts = effective(self.hass)
        if not opts[CONF_NOTIFY_NEW]:
            # Ausgeschaltet: nichts Offenes mehr melden.
            self._pending = {}
            if self._unsub_timer is not None:
                self._unsub_timer()
                self._unsub_timer = None

    async def async_stop(self) -> None:
        if self._unsub_timer is not None:
            self._unsub_timer()
            self._unsub_timer = None
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        # Sofort schreiben: ein verzögerter Termin legte die Datei nach dem
        # Entfernen der Integration sonst neu an.
        await self._store.async_save({"recent": self._recent})

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"recent": self._recent}, 1)

    async def async_flush(self) -> None:
        """Gesammelte Geräte melden: ein Gerät einzeln, mehrere in einer Meldung."""
        hass = self.hass
        ids = list(self._pending)
        self._pending = {}
        opts = effective(hass)
        if not ids or not opts[CONF_NOTIFY_NEW]:
            return
        # Nur, was das Panel zeigt (nicht ausgeblendet, nicht deaktiviert, Integration nicht ausgeschlossen).
        shown = {device.id: device for device, _entries in shown_devices(hass, opts)}
        excluded = set(opts[CONF_NEW_EXCLUDE])
        items: list[dict[str, Any]] = []
        for dev in ids:
            device = shown.get(dev)
            if device is None or primary_domain(hass, device) in excluded:
                continue
            items.append({"id": dev, "name": device.name_by_user or device.name or dev, **await async_device_facts(hass, device, opts)})
        if not items:
            return
        if opts[CONF_NOTIFY_SERVICE] != NOTIFY_NONE:
            await self._async_push(opts, items)
        if opts[CONF_NEW_PERSISTENT]:
            self._update_persistent(items)

    def parts(self, opts: dict[str, Any], item: dict[str, Any]) -> list[str]:
        """Inhalt der Meldung nach "Inhalt der Meldung", in fester Folge."""
        out: list[str] = []
        for field in opts[CONF_NEW_FIELDS]:
            if field in ("area", "integration", "model"):
                out.append(item.get(field) or "")
            elif field == "connection" and item.get("connection"):
                out.append(push.text(self.hass, f"conn_{item['connection']}"))
        return [p for p in out if p]

    async def _async_push(self, opts: dict[str, Any], items: list[dict[str, Any]]) -> None:
        hass = self.hass
        target = opts[CONF_NOTIFY_SERVICE]
        if len(items) > 1:
            # Mehrere: eine Sammelmeldung, je Gerät der Name, die Angaben in Klammern.
            lines = []
            for i in items:
                extra = self.parts(opts, i)
                lines.append(f"{i['name']} ({', '.join(extra)})" if extra else i["name"])
            await push.async_push(
                hass, target, push.text(hass, "new_title_many", count=len(items)), ", ".join(lines),
                push.notification_data(hass, f"{DOMAIN}_new", push.panel_url()),
            )
            return
        item = items[0]
        message = " · ".join(self.parts(opts, item)) or push.text(hass, "new_found")
        url = push.device_url(opts[CONF_NOTIFY_CLICK], item["id"])
        await push.async_push(
            hass, target, push.text(hass, "new_title", name=item["name"]), message,
            push.notification_data(hass, f"{DOMAIN}_new_{item['id']}", url),
        )

    def _update_persistent(self, items: list[dict[str, Any]]) -> None:
        """Anhaltende Benachrichtigung: die zuletzt gefundenen Geräte, neueste zuerst."""
        hass = self.hass
        now = time.time()
        found = [{"id": i["id"], "name": i["name"], "area": i.get("area"), "integration": i.get("integration"), "at": now} for i in items]
        known = {r["id"] for r in found}
        self._recent = (found + [r for r in self._recent if r["id"] not in known])[:NEW_RECENT_MAX]
        lines = [
            "- " + " · ".join(x for x in (f"[{r['name']}]({push.panel_url(r['id'])})", r.get("integration"), r.get("area")) if x)
            for r in self._recent
        ]
        message = "\n".join([push.text(hass, "new_persistent_intro"), "", *lines, "", push.text(hass, "new_persistent_outro")])
        persistent_notification.async_create(hass, message, push.text(hass, "new_persistent_title"), PERSISTENT_NEW_ID)
        self._shown = True
        self._save()
