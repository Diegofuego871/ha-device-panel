"""Namen von Bluetooth-Empfängern für die Anzeige (seit 2.50.0)."""

from __future__ import annotations

import re
from typing import Any

_MAC_RE = re.compile(r"\s*\(?\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b\)?")


def strip_address(text: Any) -> Any:
    """
    Adressen aus einem Namen entfernen ("Küche (B0:A7:32:46:E3:C2)" wird "Küche"); andere Werte bleiben. Home Assistant nennt einen
    Bluetooth-Proxy oft "Name (Adresse)": Die Adresse macht die Zeilen im Panel lang und gehört nicht zur KI. Besteht der Name nur aus
    der Adresse, bleibt er unverändert (lieber eine Adresse als nichts).
    """
    if not isinstance(text, str):
        return text
    return _MAC_RE.sub("", text).strip() or text
