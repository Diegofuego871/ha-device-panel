"""
Labels als Ebene zwischen Gerät und Integration (seit 2.155.0).

Die Einstellungen eines Labels stehen in denselben Zuordnungen und Listen wie die der Integrationen, unter dem Schlüssel "label:<ID>". Die
Integration eines Geräts wird als `Scope` weitergereicht: ein String mit der Domain (wie bisher, damit jede Suche nach der Domain weiter
stimmt), dazu die Schlüssel der eingerichteten Labels, die das Gerät trägt, in der Reihenfolge, die der Benutzer festgelegt hat.
Die Funktionen unten lösen eine Einstellung auf: Gerät (steht nicht hier), dann Label, dann Integration, dann global (das Aufrufen).
Hat ein Gerät mehrere eingerichtete Labels, gilt das strengste: "aus" vor einer Zeit, bei Zeiten die längere, bei Schwellen die tiefere
(weniger Meldungen); bei allem, was sich nicht vergleichen lässt, das Label weiter oben in der Liste.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr

from .const import CONF_LABELS, DOMAIN, LABEL_PREFIX

OFF = "off"
NOSTATUS = "nostatus"

Found = Sequence[tuple[str, Any]]


class Scope(str):
    """Domain der Integration eines Geräts, dazu die Schlüssel seiner eingerichteten Labels (`labels`)."""

    labels: tuple[str, ...]

    def __new__(cls, domain: str, labels: Iterable[str] = ()) -> Scope:
        obj = super().__new__(cls, domain)
        obj.labels = tuple(labels)
        return obj


def label_key(label_id: str) -> str:
    return f"{LABEL_PREFIX}{label_id}"


def is_label_key(key: Any) -> bool:
    return isinstance(key, str) and key.startswith(LABEL_PREFIX)


def configured_labels(hass: HomeAssistant) -> list[str]:
    """IDs der eingerichteten Labels in der Reihenfolge des Benutzers."""
    entry = next(iter(hass.config_entries.async_entries(DOMAIN)), None)
    value = entry.options.get(CONF_LABELS) if entry else None
    return [v for v in value if isinstance(v, str)] if isinstance(value, list) else []


def scope_of(hass: HomeAssistant, device: dr.DeviceEntry | None, domain: str | None) -> str | None:
    """
    Domain mit den Labels des Geräts. Ohne Domain None; ohne eingerichtetes Label am Gerät die Domain selbst (ein einfacher String).
    """
    if not domain:
        return None
    ids = configured_labels(hass)
    if not ids or device is None:
        return domain
    mine = getattr(device, "labels", None) or ()
    keys = [label_key(i) for i in ids if i in mine]
    return Scope(domain, keys) if keys else domain


def entity_label_keys(hass: HomeAssistant, entry: Any) -> tuple[str, ...]:
    """Die Schlüssel der eingerichteten Labels des Geräts einer Entität (leer ohne Gerät oder Label)."""
    device_id = getattr(entry, "device_id", None)
    ids = configured_labels(hass) if device_id else []
    if not ids:
        return ()
    device = dr.async_get(hass).async_get(device_id)
    mine = getattr(device, "labels", None) or ()
    return tuple(label_key(i) for i in ids if i in mine)


def label_keys(scope: Any) -> tuple[str, ...]:
    """Die Label-Schlüssel eines Scope (leer bei einer einfachen Domain oder None)."""
    return getattr(scope, "labels", ())


# --- Zusammenfassen mehrerer Labels (das strengste) --------------------------------------------------------------------------------


def first(found: Found) -> tuple[str, Any]:
    """Das Label weiter oben in der Liste."""
    return found[0]


def strictest_time(found: Found) -> tuple[str, Any]:
    """"off" (nicht überwachen) vor "nostatus" (ohne Online-Status) vor einer Zeit; bei Zeiten die längere."""
    for value in (OFF, NOSTATUS):
        for item in found:
            if item[1] == value:
                return item
    return max(found, key=lambda kv: kv[1])


def lowest(found: Found) -> tuple[str, Any]:
    """"off" vor einer Zahl; bei Zahlen die tiefere (weniger Meldungen: Batterie-Schwelle, Empfang-Schwelle)."""
    for item in found:
        if item[1] == OFF:
            return item
    return min(found, key=lambda kv: kv[1])


def off_wins(found: Found) -> tuple[str, Any]:
    """Ein Aus (False) vor einem Ein."""
    for item in found:
        if item[1] is False:
            return item
    return found[0]


# --- Auflösen ----------------------------------------------------------------------------------------------------------------------


def pick(mapping: Mapping[str, Any] | None, scope: Any, combine: Callable[[Found], tuple[str, Any]] = first) -> tuple[str | None, Any]:
    """
    (Schlüssel, Wert) aus einer Zuordnung {Domain oder "label:<ID>": Wert}: das Label des Geräts (mehrere: nach combine), sonst die Integration;
    (None, None) ohne Eintrag.
    """
    if not mapping or not scope:
        return None, None
    found = [(k, mapping[k]) for k in label_keys(scope) if k in mapping]
    if found:
        return combine(found)
    domain = str(scope)
    return (domain, mapping[domain]) if domain in mapping else (None, None)


def listed(values: Iterable[str] | None, scope: Any) -> str | None:
    """
    Der Schlüssel (Label zuerst, dann die Integration), der in der Liste steht, sonst None. Für Listen der Ausnahmen ("kein Push") und der
    eingeschalteten Integrationen: ein Label in der Liste gilt für alle seine Geräte.
    """
    if not values or not scope:
        return None
    members = values if isinstance(values, (set, frozenset, dict)) else set(values)
    for key in label_keys(scope):
        if key in members:
            return key
    domain = str(scope)
    return domain if domain in members else None


# --- Katalog der Labels von Home Assistant ----------------------------------------------------------------------------------------


def registry_labels(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    """Alle Labels von Home Assistant {ID: {id, name, icon, color}}."""
    from homeassistant.helpers import label_registry as lr  # noqa: PLC0415

    return {
        e.label_id: {"id": e.label_id, "name": e.name, "icon": e.icon, "color": getattr(e.color, "value", e.color) if e.color else None}
        for e in lr.async_get(hass).async_list_labels()
    }


def label_list(hass: HomeAssistant, counts: Mapping[str, int], *, keep: Iterable[str] = ()) -> list[dict[str, Any]]:
    """
    Labels mit Zahl der Geräte (counts: {ID: Zahl}), nach Name sortiert; nur die mit mindestens einem Gerät und die in keep genannten
    (die eingerichteten, auch wenn es in Home Assistant keines mehr gibt: "missing").
    """
    known = registry_labels(hass)
    out = [{**item, "devices": counts.get(i, 0), "missing": False} for i, item in known.items() if counts.get(i, 0) or i in set(keep)]
    out.sort(key=lambda x: str(x["name"]).lower())
    for i in keep:
        if i not in known:
            out.append({"id": i, "name": i, "icon": None, "color": None, "devices": counts.get(i, 0), "missing": True})
    return out
