"""
Magic Push (seit 2.6.0): Meldungen nach Mass pro Gerät, ohne Automation.

Eine Regel gehört zu einer Entität eines Geräts und sagt: wenn der Wert über- oder unterschritten
wird, einen bestimmten Zustand hat oder sich ändert, und das mindestens eine Zeit lang, dann
kommt eine Push-Meldung mit frei geschriebenem Text. Optional folgt eine Meldung, wenn der Wert
wieder normal ist (ebenfalls frei geschrieben), und die Meldung kann in Abständen wiederholt
werden, solange der Wert so bleibt.

Seit 2.15.0 kann eine Meldung mehrere Bedingungen verknüpfen (Und/Oder, mit einer Ebene Gruppen): "conditions" ist
ein Baum {"op": "and"|"or", "items": [Bedingung | Gruppe]}, eine Gruppe {"op", "items": [Bedingung]}, eine Bedingung
{"entity_id", "kind" (über, unter, ist), "value", "reset_value"}. Die erste Bedingung (der Reihe nach) steht zusätzlich in den
alten Feldern entity_id, kind, value, reset_value; ohne Baum gibt es genau diese eine Bedingung. Dauer und
Wiederholung gelten für das Ganze, der Rücksetzwert je Bedingung. "ändert sich" gibt es nur als einzige Bedingung.

Der Text kennt Variablen in geschweiften Klammern, die zur Entität passen: bei einer Zahl
{value} {unit} {threshold}, bei einem Zustand {value} als Wort der Entität ("offen" statt "on"),
bei "ändert sich" zusätzlich {old} und {new}. Es wird nur ersetzt, nie ausgewertet: keine
Vorlagen-Sprache, damit ein Text nichts ausführen kann.

Regeln liegen in .storage/device_panel.magic (mit dem Stand je Regel, damit eine laufende Dauer
und "schon gemeldet" einen Neustart überstehen). Nicht erreichbare Entitäten (unavailable,
unknown) lösen nichts aus und beenden nichts: dafür gibt es den Ausfall-Push.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from functools import partial
from typing import Any

import voluptuous as vol
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, State, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import activity, push, push_icon
from .compat import registry_devices
from .const import DOMAIN, NOTIFY_NONE, STORAGE_VERSION
from .devices import async_integration_info, primary_domain
from .options_api import effective

_LOGGER = logging.getLogger(__name__)

STORE_KEY = f"{DOMAIN}.magic"
KINDS = ("above", "below", "is", "change")
NUMERIC_KINDS = ("above", "below")
MAX_PER_DEVICE = 20
MAX_TOTAL = 200
NAME_MAX = 60
TEXT_MAX = 300
VALUE_MAX = 64
FOR_MAX = 7 * 86400
REPEAT_MAX = 30 * 86400
# Verknüpfte Bedingungen (seit 2.15.0)
OPS = ("and", "or")
LEAF_KINDS = ("above", "below", "is")
MAX_LEAVES = 10
MAX_GROUPS = 4
IGNORED = ("unavailable", "unknown", "", None)

_ID_RE = re.compile(r"^[0-9a-f]{12}$")
_ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
_NOTIFY_RE = re.compile(r"^notify\.[a-z0-9_]+$")
_DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_VAR_RE = re.compile(r"\{(\w+)\}")

# Variablen je Art der Entität (das Panel zeigt dieselben als Auswahl).
VARIABLES_COMMON = ("device", "area", "entity", "integration", "rule", "duration", "since", "time", "conditions")
VARIABLES = {
    "number": ("value", "unit", "threshold"),
    "state": ("value",),
    "change": ("value", "unit", "old", "new"),
}

# Wörter der Zustände (de, en) nach Geräteklasse eines Binärsensors: Zustand "on" ist links.
_BINARY: dict[str, tuple[str, str, str, str]] = {
    "door": ("offen", "geschlossen", "open", "closed"),
    "garage_door": ("offen", "geschlossen", "open", "closed"),
    "opening": ("offen", "geschlossen", "open", "closed"),
    "window": ("offen", "geschlossen", "open", "closed"),
    "motion": ("Bewegung", "keine Bewegung", "motion", "no motion"),
    "moving": ("in Bewegung", "ruhig", "moving", "still"),
    "occupancy": ("belegt", "frei", "occupied", "clear"),
    "presence": ("zuhause", "abwesend", "home", "away"),
    "moisture": ("nass", "trocken", "wet", "dry"),
    "smoke": ("Rauch erkannt", "kein Rauch", "smoke detected", "no smoke"),
    "gas": ("Gas erkannt", "kein Gas", "gas detected", "no gas"),
    "carbon_monoxide": ("CO erkannt", "kein CO", "CO detected", "no CO"),
    "problem": ("Problem", "OK", "problem", "OK"),
    "safety": ("unsicher", "sicher", "unsafe", "safe"),
    "tamper": ("Manipulation", "normal", "tampered", "normal"),
    "lock": ("entriegelt", "verriegelt", "unlocked", "locked"),
    "plug": ("eingesteckt", "ausgesteckt", "plugged in", "unplugged"),
    "power": ("Strom", "kein Strom", "power", "no power"),
    "connectivity": ("verbunden", "getrennt", "connected", "disconnected"),
    "battery": ("schwach", "normal", "low", "normal"),
    "battery_charging": ("lädt", "lädt nicht", "charging", "not charging"),
    "light": ("Licht", "dunkel", "light", "dark"),
    "vibration": ("Vibration", "ruhig", "vibration", "still"),
    "cold": ("kalt", "normal", "cold", "normal"),
    "heat": ("heiss", "normal", "hot", "normal"),
    "running": ("läuft", "gestoppt", "running", "stopped"),
    "sound": ("Geräusch", "ruhig", "sound", "quiet"),
    "update": ("Update verfügbar", "aktuell", "update available", "up to date"),
}
_ONOFF = ("ein", "aus", "on", "off")
# Zustände anderer Bereiche: Wörter (de, en) und die wählbaren Zustände für "ist …".
_WORDS: dict[str, dict[str, tuple[str, str]]] = {
    "lock": {
        "locked": ("verriegelt", "locked"),
        "unlocked": ("entriegelt", "unlocked"),
        "locking": ("verriegelt gerade", "locking"),
        "unlocking": ("entriegelt gerade", "unlocking"),
        "jammed": ("klemmt", "jammed"),
        "open": ("offen", "open"),
    },
    "cover": {
        "open": ("offen", "open"),
        "closed": ("geschlossen", "closed"),
        "opening": ("öffnet", "opening"),
        "closing": ("schliesst", "closing"),
    },
    "person": {"home": ("zuhause", "home"), "not_home": ("abwesend", "away")},
    "device_tracker": {"home": ("zuhause", "home"), "not_home": ("abwesend", "away")},
}
_ONOFF_DOMAINS = ("switch", "light", "input_boolean", "fan", "siren", "humidifier", "automation", "script")
_NUMERIC_DOMAINS = ("sensor", "number", "input_number", "counter")


def _float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    # nan und inf sind keine Werte, mit denen sich vergleichen lässt
    return number if number == number and number not in (float("inf"), float("-inf")) else None


def number_text(hass: HomeAssistant, number: float) -> str:
    """Zahl wie am Gerät: höchstens zwei Stellen, ohne unnötige Nullen, mit Komma im Deutschen."""
    text = f"{number:.2f}".rstrip("0").rstrip(".")
    text = "0" if text in ("-0", "") else text
    return text.replace(".", ",") if push.language(hass) == "de" else text


def device_class(state: State | None, entry: er.RegistryEntry | None = None) -> str | None:
    if state is not None and state.attributes.get("device_class"):
        return str(state.attributes["device_class"])
    if entry is not None:
        return entry.device_class or entry.original_device_class
    return None


def entity_kind(state: State | None, entry: er.RegistryEntry | None = None) -> str:
    """"number" für Zahlen (Sensor mit Einheit oder Zahl), sonst "state" (Zustand mit Wörtern oder Text)."""
    domain = (entry.domain if entry else None) or (state.domain if state else "")
    cls = device_class(state, entry)
    if cls == "enum" or domain not in _NUMERIC_DOMAINS:
        return "state"
    if state is not None and state.state not in IGNORED and _float(state.state) is None:
        return "state"
    return "number"


def state_options(hass: HomeAssistant, entity_id: str) -> list[dict[str, str]]:
    """Wählbare Zustände für "ist …" (Wert und Wort); leer, wenn der Zustand frei getippt wird."""
    state = hass.states.get(entity_id)
    domain = entity_id.split(".", 1)[0]
    cls = device_class(state)
    if domain == "binary_sensor" or domain in _ONOFF_DOMAINS:
        return [{"value": "on", "label": state_word(hass, domain, cls, "on")}, {"value": "off", "label": state_word(hass, domain, cls, "off")}]
    if domain in _WORDS:
        return [{"value": key, "label": state_word(hass, domain, cls, key)} for key in _WORDS[domain]]
    if state is not None and isinstance(state.attributes.get("options"), list):
        return [{"value": str(o), "label": str(o)} for o in state.attributes["options"][:50]]
    return []


def state_word(hass: HomeAssistant, domain: str, cls: str | None, value: str) -> str:
    """Das Wort zu einem Zustand ("offen" statt "on"); ohne Wort der Zustand selbst."""
    de = push.language(hass) == "de"
    if domain == "binary_sensor" or domain in _ONOFF_DOMAINS:
        words = _BINARY.get(cls or "", _ONOFF) if domain == "binary_sensor" else _ONOFF
        if value == "on":
            return words[0] if de else words[2]
        if value == "off":
            return words[1] if de else words[3]
        return value
    pair = _WORDS.get(domain, {}).get(value)
    if pair:
        return pair[0] if de else pair[1]
    return value


# -- Prüfen -----------------------------------------------------------------


def cond_met(kind: str, value: Any, state: str | None) -> bool | None:
    """Gilt die Bedingung für den Zustand? None: nicht beurteilbar (nicht erreichbar, keine Zahl)."""
    if state in IGNORED:
        return None
    if kind in NUMERIC_KINDS:
        x, limit = _float(state), _float(value)
        if x is None or limit is None:
            return None
        return x > limit if kind == "above" else x < limit
    if kind == "is":
        x, y = _float(state), _float(value)
        if x is not None and y is not None:
            return abs(x - y) < 1e-9
        return str(state).strip().casefold() == str(value).strip().casefold()
    return None


def reset_met(kind: str, value: Any, reset_value: Any, state: str | None) -> bool | None:
    """
    Gilt der eigene Rücksetzwert? (seit 2.8.0). "unter": zurückgesetzt ab dem Rücksetzwert (grösser oder gleich),
    "über": bis zum Rücksetzwert (kleiner oder gleich), "ist": beim gewählten Zustand. Ohne Rücksetzwert gilt das
    Gegenteil der Bedingung (wie bisher). None: nicht beurteilbar.
    """
    if state in IGNORED:
        return None
    if reset_value in (None, ""):
        met = cond_met(kind, value, state)
        return None if met is None else not met
    if kind in NUMERIC_KINDS:
        x, limit = _float(state), _float(reset_value)
        if x is None or limit is None:
            return None
        return x <= limit if kind == "above" else x >= limit
    if kind == "is":
        return cond_met("is", reset_value, state)
    return None


# -- Verknüpfte Bedingungen (seit 2.15.0) ---------------------------------------------


def primary_leaf(rule: dict[str, Any]) -> dict[str, Any]:
    """Die erste Bedingung einer Regel aus den alten Feldern."""
    return {"entity_id": rule["entity_id"], "kind": rule["kind"], "value": rule.get("value"), "reset_value": rule.get("reset_value")}


def rule_tree(rule: dict[str, Any]) -> dict[str, Any]:
    """Der Bedingungsbaum einer Regel; ohne gespeicherten Baum die eine Bedingung der alten Felder."""
    return rule.get("conditions") or {"op": "and", "items": [primary_leaf(rule)]}


def tree_leaves(node: dict[str, Any]) -> list[dict[str, Any]]:
    """Alle Bedingungen eines Baums der Reihe nach (die erste ist die der alten Felder)."""
    out: list[dict[str, Any]] = []
    for item in node["items"]:
        out.extend(tree_leaves(item) if "items" in item else [item])
    return out


def rule_entities(rule: dict[str, Any]) -> list[str]:
    """Entitäten aller Bedingungen, ohne Wiederholung, die erste zuerst."""
    seen: dict[str, None] = {}
    for leaf in tree_leaves(rule_tree(rule)):
        seen.setdefault(leaf["entity_id"], None)
    return list(seen)


def combine(op: str, values: list[bool | None]) -> bool | None:
    """
    Werte verknüpfen. Und: eine falsche Bedingung macht alles falsch; ist eine nicht beurteilbar (nicht erreichbar) und
    keine falsch, ist das Ganze nicht beurteilbar (keine Meldung, nichts beendet). Oder: nicht beurteilbare zählen nicht,
    es gelten die anderen.
    """
    if op == "or":
        known = [v for v in values if v is not None]
        return any(known) if known else None
    if any(v is False for v in values):
        return False
    return None if any(v is None for v in values) else True


def eval_tree(node: dict[str, Any], leaf_value: Any) -> bool | None:
    """Baum auswerten; leaf_value(Bedingung) liefert True, False oder None."""
    values = [eval_tree(item, leaf_value) if "items" in item else leaf_value(item) for item in node["items"]]
    return combine(node.get("op", "and"), values)


def leaf_met(leaf: dict[str, Any], state: str | None) -> bool | None:
    """Gilt die Bedingung für den Zustand?"""
    return cond_met(leaf["kind"], leaf.get("value"), state)


def leaf_hold(leaf: dict[str, Any], state: str | None) -> bool | None:
    """Nach der Meldung: gilt die Bedingung noch, auch im Zwischenbereich des eigenen Rücksetzwerts?"""
    met = leaf_met(leaf, state)
    if met is False and leaf.get("reset_value") not in (None, "") and reset_met(leaf["kind"], leaf.get("value"), leaf["reset_value"], state) is False:
        return True
    return met


def has_reset(rule: dict[str, Any]) -> bool:
    return any(leaf.get("reset_value") not in (None, "") for leaf in tree_leaves(rule_tree(rule)))


def _leaf_text(hass: HomeAssistant, leaf: dict[str, Any]) -> str:
    """Eine Bedingung als Satzteil: "Temperatur unter 12 °C", "Fenster ist offen"."""
    registry = er.async_get(hass)
    entry = registry.async_get(leaf["entity_id"])
    state = hass.states.get(leaf["entity_id"])
    own = dr.async_get(hass).async_get(entry.device_id) if entry is not None and entry.device_id else None
    label = entity_label(leaf["entity_id"], entry, own, state)
    if leaf["kind"] in NUMERIC_KINDS:
        unit = str(state.attributes.get("unit_of_measurement") or "") if state is not None else ""
        value = number_text(hass, _float(leaf.get("value")) or 0.0) + (f" {unit}" if unit else "")
        key = "magic_above" if leaf["kind"] == "above" else "magic_below"
        return f"{label} {push.text(hass, key, value=value)}"
    domain = leaf["entity_id"].split(".", 1)[0]
    word = state_word(hass, domain, device_class(state, entry), str(leaf.get("value")))
    return f"{label} {push.text(hass, 'magic_is', value=word)}"


def condition_text(hass: HomeAssistant, rule: dict[str, Any]) -> str:
    """Die ganze Bedingung als Satz: "Temperatur unter 12 °C und (Fenster ist offen oder Feuchte über 60 %)"."""

    def node_text(node: dict[str, Any], nested: bool) -> str:
        word = f" {push.text(hass, 'magic_or' if node.get('op') == 'or' else 'magic_and')} "
        parts = [node_text(item, True) if "items" in item else _leaf_text(hass, item) for item in node["items"]]
        text = word.join(parts)
        return f"({text})" if nested and len(parts) > 1 else text

    return node_text(rule_tree(rule), False)


def _clean_leaf(hass: HomeAssistant, raw: Any, *, alone: bool) -> dict[str, Any]:
    """Eine Bedingung prüfen: Entität gibt es, über/unter mit Zahl, ist mit Zustand, Rücksetzwert auf der Seite des Normalen."""
    if not isinstance(raw, dict):
        raise vol.Invalid("Bedingung erwartet")
    entity_id = raw.get("entity_id")
    if not isinstance(entity_id, str) or not _ENTITY_RE.match(entity_id):
        raise vol.Invalid("Entität erwartet")
    if er.async_get(hass).async_get(entity_id) is None and hass.states.get(entity_id) is None:
        raise vol.Invalid("Die Entität gibt es nicht")
    kind = raw.get("kind")
    if kind not in (KINDS if alone else LEAF_KINDS):
        raise vol.Invalid('"ändert sich" gibt es nur als einzige Bedingung' if kind == "change" else "Art der Bedingung unbekannt")
    leaf: dict[str, Any] = {"entity_id": entity_id, "kind": kind, "value": None, "reset_value": None}
    if kind in NUMERIC_KINDS:
        number = _float(raw.get("value"))
        if number is None:
            raise vol.Invalid("Für über und unter wird eine Zahl gebraucht")
        leaf["value"] = number
    elif kind == "is":
        value = _threshold(raw.get("value")) if raw.get("value") not in (None, "") else None
        if value is None:
            raise vol.Invalid("Für ist wird ein Zustand gebraucht")
        leaf["value"] = value
    if kind != "change":
        leaf["reset_value"] = _clean_reset(raw.get("reset_value"), kind, leaf["value"])
    return leaf


def _raw_leaves(raw: Any) -> list[Any]:
    """Alle Bedingungen eines ungeprüften Baums der Reihe nach (Form wird geprüft)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list) or not raw["items"]:
        raise vol.Invalid("Bedingungen erwartet")
    out: list[Any] = []
    for item in raw["items"]:
        if isinstance(item, dict) and "items" in item:
            if not isinstance(item["items"], list) or not item["items"]:
                raise vol.Invalid("Eine Gruppe braucht Bedingungen")
            out.extend(item["items"])
        else:
            out.append(item)
    return out


def clean_conditions(hass: HomeAssistant, raw: Any) -> dict[str, Any]:
    """
    Bedingungsbaum mit mehreren Bedingungen prüfen (seit 2.15.0) und bereinigen. Höchstens MAX_LEAVES Bedingungen und
    MAX_GROUPS Gruppen, Gruppen nicht verschachtelt, "ändert sich" nicht erlaubt.
    """
    _raw_leaves(raw)
    op = raw.get("op", "and")
    if op not in OPS:
        raise vol.Invalid("Und oder Oder erwartet")
    groups = 0
    items: list[dict[str, Any]] = []
    for item in raw["items"]:
        if isinstance(item, dict) and "items" in item:
            groups += 1
            if groups > MAX_GROUPS:
                raise vol.Invalid(f"Höchstens {MAX_GROUPS} Gruppen")
            if item.get("op", "and") not in OPS:
                raise vol.Invalid("Und oder Oder erwartet")
            inner = item["items"]
            if not isinstance(inner, list) or not inner or any(isinstance(x, dict) and "items" in x for x in inner):
                raise vol.Invalid("Eine Gruppe enthält Bedingungen, keine weitere Gruppe")
            items.append({"op": item.get("op", "and"), "items": [_clean_leaf(hass, x, alone=False) for x in inner]})
        else:
            items.append(_clean_leaf(hass, item, alone=False))
    tree = {"op": op, "items": items}
    count = len(tree_leaves(tree))
    if count > MAX_LEAVES:
        raise vol.Invalid(f"Höchstens {MAX_LEAVES} Bedingungen")
    return tree


def _text(max_len: int, minimum: int = 0):
    def check(value: Any) -> str:
        if not isinstance(value, str):
            raise vol.Invalid("Text erwartet")
        # Titel einer Meldung ist eine Zeile; Steuerzeichen haben im Text nichts verloren.
        text = " ".join(value.replace("\r", " ").replace("\n", " ").split()).strip()
        if len(text) < minimum or len(text) > max_len or any(ord(c) < 32 for c in text):
            raise vol.Invalid(f"Text mit {minimum} bis {max_len} Zeichen erwartet")
        return text

    return check


def _body(max_len: int):
    """Inhalt der Meldung (seit 2.7.0): mehrzeilig erlaubt, leer erlaubt (dann entsteht die Zeile automatisch)."""

    def check(value: Any) -> str:
        if value is None:
            return ""
        if not isinstance(value, str):
            raise vol.Invalid("Text erwartet")
        lines = [" ".join(line.split()) for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
        text = "\n".join(lines).strip()
        while "\n\n\n" in text:
            text = text.replace("\n\n\n", "\n\n")
        if len(text) > max_len or any(ord(c) < 32 and c != "\n" for c in text):
            raise vol.Invalid(f"Text mit höchstens {max_len} Zeichen erwartet")
        return text

    return check


def _seconds(maximum: int):
    def check(value: Any) -> int:
        number = _float(value)
        if number is None or number != int(number) or not 0 <= number <= maximum:
            raise vol.Invalid(f"Ganze Sekunden von 0 bis {maximum} erwartet")
        return int(number)

    return check


def _threshold(value: Any) -> float | str:
    number = _float(value)
    if number is not None:
        return number
    if isinstance(value, str) and 0 < len(value.strip()) <= VALUE_MAX and not isinstance(value, bool):
        return value.strip()
    raise vol.Invalid("Wert erwartet")


RULE_SCHEMA = vol.Schema(
    {
        vol.Optional("id"): vol.All(str, vol.Match(_ID_RE)),
        vol.Required("device_id"): vol.All(str, vol.Match(_DEVICE_RE)),
        vol.Required("entity_id"): vol.All(str, vol.Match(_ENTITY_RE)),
        vol.Required("name"): _text(NAME_MAX, 1),
        vol.Required("kind"): vol.In(KINDS),
        vol.Optional("value"): vol.Any(None, _threshold),
        vol.Required("for_s"): _seconds(FOR_MAX),
        vol.Required("message"): _text(TEXT_MAX, 1),
        vol.Optional("recover", default=False): bool,
        vol.Optional("recover_message", default=""): vol.Any(None, "", _text(TEXT_MAX)),
        # Inhalt unter dem Titel (seit 2.7.0), frei mit Variablen; leer = automatische Zeile wie bisher
        vol.Optional("body", default=""): _body(TEXT_MAX),
        vol.Optional("recover_body", default=""): _body(TEXT_MAX),
        vol.Optional("repeat_s", default=0): _seconds(REPEAT_MAX),
        vol.Optional("target"): vol.Any(None, "", vol.All(str, vol.Match(_NOTIFY_RE))),
        vol.Optional("enabled", default=True): bool,
        # Kritische Mitteilung (seit 2.7.0): durchbricht stumm und "Nicht stören"; Lautstärke 1 bis 10 (iOS: 0.1 bis 1.0)
        # Eigener Rücksetzwert (seit 2.8.0): leer = zurückgesetzt, sobald die Bedingung nicht mehr gilt (wie bisher)
        vol.Optional("reset_value", default=None): vol.Any(None, "", _threshold),
        # Zurücksetzen erst nach Dauer (seit 2.17.0): die Bedingung muss so lange nicht mehr gelten (und im Zwischenbereich
        # des Rücksetzwerts nicht mehr liegen), bevor "wieder normal" kommt und eine neue Episode möglich ist; 0 = sofort
        vol.Optional("reset_for_s", default=0): _seconds(FOR_MAX),
        # Verknüpfte Bedingungen (seit 2.15.0), geprüft in clean_rule
        vol.Optional("conditions", default=None): vol.Any(None, dict),
        vol.Optional("critical", default=False): bool,
        vol.Optional("critical_volume", default=push.CRITICAL_VOLUME_MAX): vol.All(int, vol.Range(min=1, max=push.CRITICAL_VOLUME_MAX)),
    }
)


def _clean_reset(reset: Any, kind: str, value: Any) -> float | str | None:
    """Rücksetzwert prüfen: leer = automatisch; bei über/unter muss er auf der Seite des Normalen liegen."""
    if reset in (None, ""):
        return None
    if kind in NUMERIC_KINDS:
        number = _float(reset)
        if number is None:
            raise vol.Invalid("Für den Rücksetzwert wird eine Zahl gebraucht")
        if kind == "below" and number < value:
            raise vol.Invalid("Der Rücksetzwert muss bei unter mindestens so gross wie die Schwelle sein")
        if kind == "above" and number > value:
            raise vol.Invalid("Der Rücksetzwert muss bei über höchstens so gross wie die Schwelle sein")
        return number
    return reset


def clean_rule(hass: HomeAssistant, raw: dict[str, Any]) -> dict[str, Any]:
    """Regel prüfen und bereinigen (Fehler als vol.Invalid mit Text für das Panel)."""
    rule = RULE_SCHEMA(raw)
    # Bedingungen (seit 2.15.0): die erste steht in den alten Feldern und wird wie bisher geprüft
    raw_tree = rule.get("conditions")
    raw_leaves = _raw_leaves(raw_tree) if raw_tree else []
    if raw_leaves:
        first = raw_leaves[0]
        if not isinstance(first, dict):
            raise vol.Invalid("Bedingung erwartet")
        for key in ("entity_id", "kind", "value", "reset_value"):
            rule[key] = first.get(key)
        if not isinstance(rule["entity_id"], str) or not _ENTITY_RE.match(rule["entity_id"]) or rule["kind"] not in KINDS:
            raise vol.Invalid("Bedingung unvollständig")
    device = dr.async_get(hass).async_get(rule["device_id"])
    if device is None:
        raise vol.Invalid("Gerät nicht gefunden")
    # Freie Entität (seit 2.10.0): jede Entität von Home Assistant ist erlaubt, auch von einem anderen Gerät oder ohne
    # Gerät; die Meldung bleibt an dieses Gerät gebunden.
    if er.async_get(hass).async_get(rule["entity_id"]) is None and hass.states.get(rule["entity_id"]) is None:
        raise vol.Invalid("Die Entität gibt es nicht")
    kind = rule["kind"]
    if kind in NUMERIC_KINDS:
        if _float(rule.get("value")) is None:
            raise vol.Invalid("Für über und unter wird eine Zahl gebraucht")
        rule["value"] = _float(rule["value"])
        rule["reset_value"] = _clean_reset(rule.get("reset_value"), kind, rule["value"])
    elif kind == "is":
        if rule.get("value") in (None, ""):
            raise vol.Invalid("Für ist wird ein Zustand gebraucht")
        rule["reset_value"] = _clean_reset(rule.get("reset_value"), kind, rule.get("value"))
    else:
        # "ändert sich": kein Wert, kein Normalzustand, keine Wiederholung
        rule["value"] = None
        rule["reset_value"] = None
        rule["recover"] = False
        rule["repeat_s"] = 0
        rule["reset_for_s"] = 0
    rule["recover_message"] = rule.get("recover_message") or ""
    if rule["recover"] and not rule["recover_message"]:
        raise vol.Invalid("Für die Meldung bei wieder normal fehlt der Text")
    rule["target"] = rule.get("target") or None
    if len(raw_leaves) > 1:
        tree = clean_conditions(hass, raw_tree)
        first = tree_leaves(tree)[0]
        rule.update(entity_id=first["entity_id"], kind=first["kind"], value=first["value"], reset_value=first["reset_value"])
        rule["conditions"] = tree
    else:
        rule["conditions"] = None
    return rule


# -- Text ---------------------------------------------------------------------


def render(text: str, context: dict[str, str]) -> str:
    """Variablen ersetzen; Unbekanntes bleibt stehen. Nur Ersetzen, nie Auswerten."""
    return _VAR_RE.sub(lambda m: context.get(m.group(1), m.group(0)), text)


def _clock(hass: HomeAssistant, ts: float) -> str:
    local = dt_util.as_local(dt_util.utc_from_timestamp(ts))
    return local.strftime("%H:%M")


def entity_label(entity_id: str, entry: er.RegistryEntry | None, device: dr.DeviceEntry | None, state: State | None) -> str:
    """Name der Entität wie im Geräte-Popup: eigener Name, sonst der des Geräts (has_entity_name), sonst HA-Name."""
    name = (entry.name or entry.original_name) if entry is not None else None
    if not name and device is not None and entry is not None and entry.has_entity_name:
        name = device.name_by_user or device.name
    return str(name or (state.attributes.get("friendly_name") if state is not None else None) or entity_id)


def context(
    hass: HomeAssistant,
    rule: dict[str, Any],
    state: State | None,
    *,
    since: float,
    now: float,
    old: str | None = None,
    new: str | None = None,
) -> dict[str, str]:
    """Werte für die Variablen, passend zur Art der Entität."""
    dev_reg = dr.async_get(hass)
    device = dev_reg.async_get(rule["device_id"])
    entry = er.async_get(hass).async_get(rule["entity_id"])
    area = ar.async_get(hass).async_get_area(device.area_id) if device is not None and device.area_id else None
    domain = rule["entity_id"].split(".", 1)[0]
    cls = device_class(state, entry)
    numeric = entity_kind(state, entry) == "number"
    raw = state.state if state is not None else ""

    def show(value: str | None) -> str:
        if value in IGNORED:
            return ""
        number = _float(value) if numeric else None
        return number_text(hass, number) if number is not None else state_word(hass, domain, cls, str(value))

    threshold = ""
    if rule["kind"] in NUMERIC_KINDS and _float(rule.get("value")) is not None:
        threshold = number_text(hass, _float(rule["value"]))  # type: ignore[arg-type]
    elif rule["kind"] == "is" and rule.get("value") not in (None, ""):
        threshold = show(str(rule["value"]))
    duration = push.duration(hass, max(0.0, now - since))
    ctx = {
        "device": (device.name_by_user or device.name or "") if device is not None else "",
        "area": area.name if area else "",
        # Bei einer freien Entität (anderes Gerät) heisst sie nach ihrem eigenen Gerät, "device" bleibt das der Meldung
        "entity": entity_label(rule["entity_id"], entry, dev_reg.async_get(entry.device_id) if entry is not None and entry.device_id else device, state),
        "integration": rule.get("_integration", ""),
        "rule": rule.get("name", ""),
        "value": show(raw),
        "unit": str(state.attributes.get("unit_of_measurement") or "") if state is not None and numeric else "",
        "threshold": threshold,
        "duration": duration,
        "since": _clock(hass, since),
        "time": _clock(hass, now),
        "old": show(old),
        "new": show(new if new is not None else raw),
        "conditions": condition_text(hass, rule),
    }
    return ctx


def content(hass: HomeAssistant, rule: dict[str, Any], ctx: dict[str, str], *, recovered: bool = False) -> str:
    """Inhalt der Meldung: der eigene Text mit eingesetzten Variablen, ohne eigenen die automatische Zeile."""
    own = rule.get("recover_body" if recovered else "body") or ""
    text = "\n".join(" ".join(line.split()) for line in render(own, ctx).split("\n")).strip()
    return text or info_line(hass, rule, ctx, recovered=recovered)


def info_line(hass: HomeAssistant, rule: dict[str, Any], ctx: dict[str, str], *, recovered: bool = False) -> str:
    """Zeile unter dem Titel: Gerät und wie lange (bei Änderung: alt → neu)."""
    parts = [ctx["device"]]
    if rule["kind"] == "change":
        if ctx["old"] and ctx["new"]:
            parts.append(f"{ctx['old']} → {ctx['new']}")
    elif recovered:
        parts.append(push.text(hass, "magic_after", duration=ctx["duration"]))
    elif rule["for_s"] > 0 or ctx["duration"] != push.duration(hass, 0):
        parts.append(push.text(hass, "magic_since", duration=ctx["duration"]))
    return " · ".join(p for p in parts if p)


# -- Auslösen -------------------------------------------------------------------


class MagicPush:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORE_KEY)
        self._rules: dict[str, dict[str, Any]] = {}
        self._runtime: dict[str, dict[str, Any]] = {}
        self._by_entity: dict[str, list[dict[str, Any]]] = {}
        self._timers: dict[str, CALLBACK_TYPE] = {}
        # Wartezeit bis zum Zurücksetzen (reset_for_s), getrennt von Dauer/Wiederholung
        self._rtimers: dict[str, CALLBACK_TYPE] = {}
        # "Ändert sich" mit Dauer: der neue Wert muss bis "due" bleiben; wird mitgespeichert (seit 2.17.1)
        self._pending: dict[str, dict[str, Any]] = {}
        self._unsub_track: CALLBACK_TYPE | None = None
        self._unsubs: list[CALLBACK_TYPE] = []
        self._integration_names: dict[str, str] = {}

    # -- Start, Stopp -------------------------------------------------------------

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        raw = stored.get("rules") if isinstance(stored, dict) else None
        for rule_id, item in (raw.items() if isinstance(raw, dict) else []):
            try:
                rule = clean_stored(item)
            except vol.Invalid:
                _LOGGER.warning("Magic Push: gespeicherte Regel %s ist ungültig und wird ignoriert", rule_id)
                continue
            self._rules[rule["id"]] = rule
        runtime = stored.get("runtime") if isinstance(stored, dict) else None
        if isinstance(runtime, dict):
            for rule_id, rt in runtime.items():
                if rule_id in self._rules and isinstance(rt, dict):
                    self._runtime[rule_id] = {
                        "since": _float(rt.get("since")),
                        "fired": bool(rt.get("fired")),
                        "last_sent": _float(rt.get("last_sent")),
                        "last_fired": _float(rt.get("last_fired")),
                    }
        pending = stored.get("pending") if isinstance(stored, dict) else None
        if isinstance(pending, dict):
            for rule_id, item in pending.items():
                rule = self._rules.get(rule_id)
                due = _float(item.get("due")) if isinstance(item, dict) else None
                if rule is not None and rule["kind"] == "change" and due is not None and isinstance(item.get("old"), str) and isinstance(item.get("new"), str):
                    self._pending[rule_id] = {"old": item["old"], "new": item["new"], "due": due}
        # Gelöschte Geräte nehmen ihre Regeln mit.
        self._unsubs.append(self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._on_device_registry))
        self._retrack()
        await self.async_load_integration_names()
        async_at_started(self.hass, self._on_started)

    async def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        if self._unsub_track is not None:
            self._unsub_track()
            self._unsub_track = None
        for cancel in (*self._timers.values(), *self._rtimers.values()):
            cancel()
        self._timers = {}
        self._rtimers = {}
        # Ausstehendes sofort schreiben (die Dauer überlebt so den Neustart)
        await self._store.async_save(self._data())

    def _data(self) -> dict[str, Any]:
        return {"rules": self._rules, "runtime": self._runtime, "pending": self._pending}

    def _save(self) -> None:
        self._store.async_delay_save(self._data, 5)

    def _save_now(self) -> None:
        """Sofort schreiben: nach einer Meldung darf ein Absturz nicht vergessen lassen, dass sie schon raus ist (seit 2.17.1)."""
        self.hass.async_create_task(self._store.async_save(self._data()))

    @callback
    def _on_started(self, _hass: HomeAssistant) -> None:
        self._resync()

    @callback
    def _on_device_registry(self, event: Event) -> None:
        if event.data.get("action") != "remove":
            return
        gone = event.data.get("device_id")
        for rule in [r for r in self._rules.values() if r["device_id"] == gone]:
            self._forget(rule["id"])
        self._retrack()
        self._store.async_delay_save(self._data, 1)

    # -- Regeln -------------------------------------------------------------------

    def rules(self, device_id: str | None = None) -> list[dict[str, Any]]:
        out = [r for r in self._rules.values() if device_id is None or r["device_id"] == device_id]
        return sorted(out, key=lambda r: (r["name"].casefold(), r["id"]))

    def get(self, rule_id: str) -> dict[str, Any] | None:
        return self._rules.get(rule_id)

    def runtime(self, rule_id: str) -> dict[str, Any]:
        return self._runtime.setdefault(rule_id, {"since": None, "fired": False, "last_sent": None, "last_fired": None})

    async def async_save_rule(self, raw: dict[str, Any], *, adopt_id: bool = False) -> dict[str, Any]:
        """Regel neu anlegen oder ändern (mit id). adopt_id: eine unbekannte id bei einer neuen Regel übernehmen (Wiederherstellung einer Sicherung)."""
        rule = clean_rule(self.hass, raw)
        existing = self._rules.get(rule.get("id", ""))
        if "id" in rule and existing is None and not (adopt_id and _ID_RE.match(str(rule["id"]))):
            raise vol.Invalid("Meldung nicht gefunden")
        if existing is not None and existing["device_id"] != rule["device_id"]:
            raise vol.Invalid("Die Meldung gehört zu einem anderen Gerät")
        if existing is None:
            if len(self._rules) >= MAX_TOTAL:
                raise vol.Invalid(f"Höchstens {MAX_TOTAL} Meldungen insgesamt")
            if len(self.rules(rule["device_id"])) >= MAX_PER_DEVICE:
                raise vol.Invalid(f"Höchstens {MAX_PER_DEVICE} Meldungen pro Gerät")
            rule["id"] = str(rule["id"]) if adopt_id and rule.get("id") else uuid.uuid4().hex[:12]
        rule["created"] = existing["created"] if existing and "created" in existing else time.time()
        changed = existing is None or any(existing.get(k) != rule.get(k) for k in ("entity_id", "kind", "value", "reset_value", "conditions", "for_s", "repeat_s", "recover", "reset_for_s"))
        self._rules[rule["id"]] = rule
        if changed:
            self._reset(rule["id"])
        self._retrack()
        await self._store.async_save(self._data())
        state = self.hass.states.get(rule["entity_id"])
        if state is not None:
            self._evaluate(rule, state, None)
        return rule

    async def async_delete_rule(self, rule_id: str) -> bool:
        if rule_id not in self._rules:
            return False
        self._forget(rule_id)
        self._retrack()
        await self._store.async_save(self._data())
        return True

    async def async_set_enabled(self, rule_id: str, enabled: bool) -> dict[str, Any] | None:
        rule = self._rules.get(rule_id)
        if rule is None:
            return None
        rule["enabled"] = enabled
        self._reset(rule_id)
        self._retrack()
        await self._store.async_save(self._data())
        if enabled and (state := self.hass.states.get(rule["entity_id"])) is not None:
            self._evaluate(rule, state, None)
        return rule

    def _forget(self, rule_id: str) -> None:
        self._cancel(rule_id)
        self._rules.pop(rule_id, None)
        self._runtime.pop(rule_id, None)
        self._pending.pop(rule_id, None)

    def _reset(self, rule_id: str) -> None:
        """Laufende Dauer und "schon gemeldet" verwerfen (Regel geändert oder aus- und eingeschaltet)."""
        self._cancel(rule_id)
        self._pending.pop(rule_id, None)
        rt = self.runtime(rule_id)
        rt["since"] = None
        rt["fired"] = False

    def _retrack(self) -> None:
        if self._unsub_track is not None:
            self._unsub_track()
            self._unsub_track = None
        self._by_entity = {}
        for rule in self._rules.values():
            if rule["enabled"]:
                for entity_id in rule_entities(rule):
                    self._by_entity.setdefault(entity_id, []).append(rule)
        if self._by_entity:
            self._unsub_track = async_track_state_change_event(self.hass, list(self._by_entity), self._on_state)

    # -- Auswerten ----------------------------------------------------------------

    @callback
    def _resync(self) -> None:
        self._restore_pending()
        for rule in list(self._rules.values()):
            state = self.hass.states.get(rule["entity_id"])
            if state is not None:
                self._evaluate(rule, state, None)

    def _restore_pending(self) -> None:
        """Nach dem Start: "ändert sich" mit Dauer weiterlaufen lassen, sofern der neue Wert noch gilt (seit 2.17.1)."""
        now = time.time()
        for rule_id, pending in list(self._pending.items()):
            rule = self._rules.get(rule_id)
            state = self.hass.states.get(rule["entity_id"]) if rule is not None else None
            if rule is None or not rule["enabled"] or state is None or (state.state != pending["new"] and state.state not in IGNORED):
                # Regel weg oder der Wert hat sich inzwischen wieder geändert: nichts zu melden
                self._pending.pop(rule_id, None)
                continue
            if rule_id in self._timers:
                continue
            if pending["due"] <= now:
                # Die Dauer ist während des Ausfalls abgelaufen: sofort entscheiden, ohne Timer
                self._on_timer(rule_id, None)
            else:
                self._timers[rule_id] = async_call_later(self.hass, pending["due"] - now, partial(self._on_timer, rule_id))

    @callback
    def _on_state(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        new: State | None = event.data.get("new_state")
        old: State | None = event.data.get("old_state")
        for rule in list(self._by_entity.get(entity_id, ())):
            self._evaluate(rule, new, old)

    def _cancel(self, rule_id: str) -> None:
        if (cancel := self._timers.pop(rule_id, None)) is not None:
            cancel()
        self._cancel_reset(rule_id)

    def _cancel_reset(self, rule_id: str) -> None:
        if (cancel := self._rtimers.pop(rule_id, None)) is not None:
            cancel()

    def _met(self, rule: dict[str, Any]) -> bool | None:
        """Gilt die ganze Bedingung jetzt? None: nicht beurteilbar (Entität nicht erreichbar)."""

        def leaf(item: dict[str, Any]) -> bool | None:
            state = self.hass.states.get(item["entity_id"])
            return leaf_met(item, state.state if state is not None else None)

        return eval_tree(rule_tree(rule), leaf)

    def _held(self, rule: dict[str, Any]) -> bool | None:
        """Wie _met, aber im Zwischenbereich eines eigenen Rücksetzwerts gilt die Bedingung noch (nach der Meldung)."""

        def leaf(item: dict[str, Any]) -> bool | None:
            state = self.hass.states.get(item["entity_id"])
            return leaf_hold(item, state.state if state is not None else None)

        return eval_tree(rule_tree(rule), leaf)

    def _evaluate(self, rule: dict[str, Any], state: State | None, old: State | None) -> None:
        """Eine Regel prüfen. state und old gehören zur Entität, die sich geändert hat (bei "ändert sich" die der Regel)."""
        if not rule["enabled"]:
            return
        now = time.time()
        rule_id = rule["id"]
        rt = self.runtime(rule_id)
        if rule["kind"] == "change":
            if state is None or state.state in IGNORED:
                return
            if old is None or old.state in IGNORED or old.state == state.state:
                return
            self._cancel(rule_id)
            if rule["for_s"] <= 0:
                self._fire(rule, state, now, old=old.state)
            else:
                self._pending[rule_id] = {"old": old.state, "new": state.state, "due": now + rule["for_s"]}
                self._save()
                self._timers[rule_id] = async_call_later(self.hass, rule["for_s"], partial(self._on_timer, rule_id))
            return
        # Mit mehreren Bedingungen kann sich eine andere Entität geändert haben: Stand der ersten für Variablen und Meldung
        state = self.hass.states.get(rule["entity_id"])
        met = self._met(rule)
        if state is None or met is None:
            return
        if met:
            # Die Bedingung gilt wieder, bevor die Wartezeit zum Zurücksetzen um war: gleiche Episode, nichts wird gemeldet
            self._cancel_reset(rule_id)
            if rt["since"] is None:
                rt["since"] = now
                rt["fired"] = False
                self._save()
            if not rt["fired"] and rule_id not in self._timers:
                self._arm(rule, state, now)
            elif rt["fired"] and rule["repeat_s"] > 0 and rule_id not in self._timers:
                # Wiederholung ruhte im Zwischenbereich des Rücksetzwerts: ab jetzt weiter, im alten Takt
                delay = max(0.0, (rt["last_sent"] or now) + rule["repeat_s"] - now)
                self._timers[rule_id] = async_call_later(self.hass, delay, partial(self._on_timer, rule_id))
        elif rt["since"] is not None:
            # Schon gemeldet und ein eigener Rücksetzwert gesetzt: im Zwischenbereich bleibt alles still und gemeldet,
            # zurückgesetzt wird erst am Rücksetzwert. Vor der Meldung gilt die Bedingung durchgehend, sonst von vorn.
            if rt["fired"] and has_reset(rule) and self._held(rule) is True:
                self._cancel_reset(rule_id)
                return
            # Zurücksetzen erst nach der eingestellten Dauer (seit 2.17.0); vor der Meldung gibt es nichts zu melden
            if rt["fired"] and rule["reset_for_s"] > 0:
                if rule_id not in self._rtimers:
                    self._rtimers[rule_id] = async_call_later(self.hass, rule["reset_for_s"], partial(self._on_reset_timer, rule_id))
                return
            self._resolve(rule, state, now)

    @callback
    def _on_reset_timer(self, rule_id: str, _now: Any) -> None:
        """Wartezeit zum Zurücksetzen um: gilt die Bedingung noch nicht wieder, ist die Episode zu Ende."""
        self._rtimers.pop(rule_id, None)
        rule = self._rules.get(rule_id)
        if rule is None or not rule["enabled"] or rule["kind"] == "change":
            return
        rt = self.runtime(rule_id)
        state = self.hass.states.get(rule["entity_id"])
        if rt["since"] is None or not rt["fired"] or state is None:
            return
        # None (nicht erreichbar) setzt nichts zurück; die nächste Änderung stösst die Wartezeit neu an
        if self._met(rule) is not False or (has_reset(rule) and self._held(rule) is True):
            return
        self._resolve(rule, state, time.time())

    def _arm(self, rule: dict[str, Any], state: State, now: float) -> None:
        rt = self.runtime(rule["id"])
        delay = (rt["since"] or now) + rule["for_s"] - now
        if delay <= 0:
            self._fire(rule, state, now)
        else:
            self._timers[rule["id"]] = async_call_later(self.hass, delay, partial(self._on_timer, rule["id"]))

    @callback
    def _on_timer(self, rule_id: str, _now: Any) -> None:
        """Timer abgelaufen. Muss ein callback sein, sonst läuft es als Executor-Job im Thread."""
        self._timers.pop(rule_id, None)
        rule = self._rules.get(rule_id)
        if rule is None or not rule["enabled"]:
            return
        state = self.hass.states.get(rule["entity_id"])
        if state is None or (rule["kind"] == "change" and state.state in IGNORED):
            if rule["kind"] == "change" and self._pending.pop(rule_id, None) is not None:
                self._save()
            return
        now = time.time()
        if rule["kind"] == "change":
            pending = self._pending.pop(rule_id, None)
            self._save()
            if pending and state.state == pending["new"]:
                self._fire(rule, state, now, old=pending["old"])
            return
        rt = self.runtime(rule_id)
        if rt["since"] is None or self._met(rule) is not True:
            return
        self._fire(rule, state, now, repeat=rt["fired"])

    def _fire(self, rule: dict[str, Any], state: State, now: float, *, old: str | None = None, repeat: bool = False) -> None:
        rule_id = rule["id"]
        rt = self.runtime(rule_id)
        if rule["kind"] != "change":
            rt["fired"] = True
        rt["last_sent"] = rt["last_fired"] = now
        self._save_now()
        ctx = self._context(rule, state, since=rt["since"] or now, now=now, old=old)
        title = render(rule["message"], ctx)
        message = content(self.hass, rule, ctx)
        code = "magic_repeat" if repeat else "magic_fired"
        self.hass.async_create_task(self._async_send(rule, title, message, code, ctx, critical=rule["critical"]))
        if rule["repeat_s"] > 0 and rule["kind"] != "change":
            self._timers[rule_id] = async_call_later(self.hass, rule["repeat_s"], partial(self._on_timer, rule_id))

    def _resolve(self, rule: dict[str, Any], state: State, now: float) -> None:
        rule_id = rule["id"]
        rt = self.runtime(rule_id)
        since, fired = rt["since"] or now, rt["fired"]
        self._reset(rule_id)
        self._save_now()
        if fired and rule["recover"]:
            ctx = self._context(rule, state, since=since, now=now)
            title = render(rule["recover_message"], ctx)
            self.hass.async_create_task(self._async_send(rule, title, content(self.hass, rule, ctx, recovered=True), "magic_recovered", ctx))

    def _context(self, rule: dict[str, Any], state: State | None, *, since: float, now: float, old: str | None = None) -> dict[str, str]:
        ctx = context(self.hass, {**rule, "_integration": self._integration(rule)}, state, since=since, now=now, old=old)
        return ctx

    def _integration(self, rule: dict[str, Any]) -> str:
        domain = None
        device = dr.async_get(self.hass).async_get(rule["device_id"])
        if device is not None:
            domain = primary_domain(self.hass, device)
        return self._integration_names.get(domain or "", domain or "")

    async def async_load_integration_names(self) -> None:
        domains = {primary_domain(self.hass, d) for d in registry_devices(dr.async_get(self.hass))} - {None}
        info = await async_integration_info(self.hass, {d for d in domains if d})
        self._integration_names = {d: v.get("name", d) for d, v in info.items()}

    # -- Senden -------------------------------------------------------------------

    def target(self, rule: dict[str, Any]) -> str:
        return rule.get("target") or effective(self.hass)["notify_service"]

    async def _async_send(self, rule: dict[str, Any], title: str, message: str, code: str, ctx: dict[str, str], *, critical: bool = False) -> bool:
        hass = self.hass
        opts = effective(hass)
        target = self.target(rule)
        device = dr.async_get(hass).async_get(rule["device_id"])
        if target == NOTIFY_NONE or device is None:
            activity.record(hass, "info", "magic", "magic_no_target", rule["name"], rule["device_id"])
            return False
        icon = await push_icon.async_integration_icon(hass, primary_domain(hass, device))
        data = push.notification_data(hass, f"{DOMAIN}_magic_{rule['id']}", push.device_url(opts["notify_click_target"], device.id), icon=icon)
        # Nur die Meldung selbst ist kritisch; "wieder normal" kommt als gewöhnliche Meldung
        if critical:
            data.update(push.critical_data(rule["critical_volume"]))
        activity.record(hass, "info", "magic", code, rule["name"], rule["device_id"], title=title)
        return await push.async_push(hass, target, title, message, data, topic="magic", quiet={"label": rule["name"]})

    async def async_test(self, raw: dict[str, Any], which: str = "main") -> bool:
        """Test: eine echte Meldung mit dem jetzigen Wert an den gewählten Empfänger."""
        rule = clean_rule(self.hass, raw)
        title, message, ctx = self.preview(rule, which)
        activity.record(self.hass, "info", "magic", "magic_test", rule["name"], rule["device_id"])
        # Der Test klingt wie die echte Meldung, damit man die Lautstärke hören kann
        return await self._async_send({**rule, "id": rule.get("id", "test")}, f"{title}", message, "magic_test", ctx, critical=rule["critical"] and which == "main")

    def preview_raw(self, raw: dict[str, Any], which: str = "main") -> tuple[str, str]:
        """Vorschau für einen Entwurf: fehlende Texte und Namen sind erlaubt (dann ist der Text leer)."""
        draft = {**raw, "name": raw.get("name") or "Magic Push", "message": raw.get("message") or "x", "recover": False}
        draft["recover_message"] = raw.get("recover_message") or ""
        rule = clean_rule(self.hass, draft)
        rule["message"] = " ".join(str(raw.get("message") or "").split())
        rule["recover_message"] = " ".join(str(raw.get("recover_message") or "").split())
        title, message, _ctx = self.preview(rule, which)
        return title, message if title else ""

    def preview(self, rule: dict[str, Any], which: str = "main") -> tuple[str, str, dict[str, str]]:
        """Titel und Zeile der Meldung mit dem jetzigen Wert; Dauer als Beispiel (Wartezeit der Regel)."""
        state = self.hass.states.get(rule["entity_id"])
        now = time.time()
        example = max(float(rule["for_s"]), 60.0) if which == "recover" else float(rule["for_s"])
        old = None
        if rule["kind"] == "change" and state is not None:
            options = [o["value"] for o in state_options(self.hass, rule["entity_id"])]
            other = [o for o in options if o != state.state]
            old = other[0] if other else state.state
        ctx = self._context(rule, state, since=now - example, now=now, old=old)
        if which == "recover":
            return render(rule["recover_message"], ctx), content(self.hass, rule, ctx, recovered=True), ctx
        return render(rule["message"], ctx), content(self.hass, rule, ctx), ctx


def clean_stored(raw: Any) -> dict[str, Any]:
    """Gespeicherte Regel lesen (ohne die Prüfung gegen die Register, die beim Anlegen läuft)."""
    schema = RULE_SCHEMA.extend({vol.Required("id"): vol.All(str, vol.Match(_ID_RE)), vol.Optional("created"): vol.Coerce(float)})
    rule = schema(raw)
    if rule["kind"] in NUMERIC_KINDS and _float(rule.get("value")) is None:
        raise vol.Invalid("Zahl fehlt")
    rule["target"] = rule.get("target") or None
    rule["recover_message"] = rule.get("recover_message") or ""
    if rule.get("conditions"):
        # Form prüfen (die Register-Prüfung läuft nur beim Anlegen); Fehler = Regel wird ignoriert
        leaves = _raw_leaves(rule["conditions"])
        if len(leaves) < 2 or any(not isinstance(x, dict) or x.get("kind") not in LEAF_KINDS or not isinstance(x.get("entity_id"), str) for x in leaves):
            raise vol.Invalid("Bedingungen ungültig")
        if rule["conditions"].get("op", "and") not in OPS:
            raise vol.Invalid("Bedingungen ungültig")
    else:
        rule["conditions"] = None
    return rule


# -- Angaben für das Panel ---------------------------------------------------------


def notify_groups(hass: HomeAssistant) -> set[str]:
    """Notify-Gruppen: Dienste der Plattform "group" und Gruppen-Entitäten (soweit erkennbar)."""
    out: set[str] = set()
    try:
        from homeassistant.components.notify.legacy import NOTIFY_SERVICES  # noqa: PLC0415

        for service in hass.data.get(NOTIFY_SERVICES, {}).get("group", []):
            if name := getattr(service, "_service_name", None):
                out.add(f"notify.{name}")
    except Exception:  # noqa: BLE001 - nur zum Beschriften
        _LOGGER.debug("Notify-Gruppen nicht erkannt", exc_info=True)
    for entry in er.async_get(hass).entities.values():
        if entry.domain == "notify" and entry.platform == "group":
            out.add(entry.entity_id)
    return out


def targets_payload(hass: HomeAssistant, current: list[str]) -> list[dict[str, Any]]:
    """Empfänger zur Wahl (Dienste, Gruppen, Entitäten); ein nicht mehr vorhandenes, gewähltes Ziel bleibt stehen."""
    from .options_api import notify_targets  # noqa: PLC0415

    groups = notify_groups(hass)
    out = [
        {"value": t["value"], "kind": "group" if t["value"] in groups else t["kind"]}
        for t in notify_targets(hass, NOTIFY_NONE)
        if t["kind"] in ("service", "entity")
    ]
    known = {t["value"] for t in out}
    for value in current:
        if value and value not in known:
            out.append({"value": value, "kind": "missing"})
    return out


def entity_descriptor(hass: HomeAssistant, entity_id: str) -> dict[str, Any]:
    """Angaben zu einer Entität für die Wahl und die Texte: Art (Zahl oder Zustand), Wert, Einheit, wählbare Zustände."""
    entry = er.async_get(hass).async_get(entity_id)
    state = hass.states.get(entity_id)
    own = dr.async_get(hass).async_get(entry.device_id) if entry is not None and entry.device_id else None
    kind = entity_kind(state, entry)
    cls = device_class(state, entry)
    raw = state.state if state is not None else None
    available = raw not in IGNORED
    domain = entity_id.split(".", 1)[0]
    number = _float(raw) if kind == "number" else None
    return {
        "entity_id": entity_id,
        "name": entity_label(entity_id, entry, own, state),
        "domain": domain,
        "device_class": cls,
        "kind": kind,
        "state": raw,
        "available": available,
        "value": number_text(hass, number) if number is not None else (state_word(hass, domain, cls, str(raw)) if available else None),
        "number": number,
        "unit": str(state.attributes.get("unit_of_measurement") or "") if state is not None and kind == "number" else "",
        "category": entry.entity_category.value if entry is not None and entry.entity_category else None,
        "options": state_options(hass, entity_id) if kind == "state" else [],
        "device_name": (own.name_by_user or own.name or "") if own is not None else "",
    }


def entities_payload(hass: HomeAssistant, device_id: str) -> list[dict[str, Any]]:
    """Alle Entitäten eines Geräts zur Wahl (erst die ohne Kategorie, dann Diagnose und Konfiguration)."""
    entries = er.async_entries_for_device(er.async_get(hass), device_id)
    return [entity_descriptor(hass, entry.entity_id) for entry in sorted(entries, key=lambda e: (e.entity_category is not None, e.entity_id))]


def search_entities(hass: HomeAssistant, query: str, limit: int = 40) -> list[dict[str, Any]]:
    """Suche in allen Entitäten (freie Entität, seit 2.10.0): nach Name, Entitäts-ID und Gerät, ohne Suchtext die ersten nach Name."""
    needle = " ".join(query.casefold().split())
    registry = er.async_get(hass)
    devices = dr.async_get(hass)
    found: list[tuple[str, str]] = []
    for state in hass.states.async_all():
        entry = registry.async_get(state.entity_id)
        own = devices.async_get(entry.device_id) if entry is not None and entry.device_id else None
        name = entity_label(state.entity_id, entry, own, state)
        haystack = f"{name} {state.entity_id} {(own.name_by_user or own.name or '') if own is not None else ''}".casefold()
        if all(part in haystack for part in needle.split()):
            found.append((name.casefold(), state.entity_id))
    found.sort()
    return [entity_descriptor(hass, entity_id) for _name, entity_id in found[:limit]]


def rule_payload(hass: HomeAssistant, magic: MagicPush, rule: dict[str, Any]) -> dict[str, Any]:
    """Regel mit Stand für das Panel: aktiv (Bedingung gilt gerade), zuletzt gemeldet, Entität fehlt."""
    rt = magic.runtime(rule["id"])
    state = hass.states.get(rule["entity_id"])
    entry = er.async_get(hass).async_get(rule["entity_id"])
    registry = er.async_get(hass)
    exists = all(registry.async_get(eid) is not None or hass.states.get(eid) is not None for eid in rule_entities(rule))
    return {
        **{k: v for k, v in rule.items() if not k.startswith("_")},
        # Immer der Baum (bei einer Bedingung mit genau einer), für das Panel; dazu die ganze Bedingung als Satz
        "conditions": rule_tree(rule),
        "condition_text": condition_text(hass, rule),
        "active": rt["since"] is not None,
        "since": rt["since"],
        "fired": bool(rt["fired"]),
        "last_fired": rt["last_fired"],
        "entity_missing": not exists,
        # Entität eines anderen Geräts oder ohne Gerät (freie Entität, seit 2.10.0)
        "entity_free": entry is None or entry.device_id != rule["device_id"],
        "available": magic._met(rule) is not None if rule["kind"] != "change" else state is not None and state.state not in IGNORED,
    }
