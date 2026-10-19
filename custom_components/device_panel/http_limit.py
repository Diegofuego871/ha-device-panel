"""Antworten von aussen nur bis zu einer Obergrenze lesen (seit 2.101.0)."""

from __future__ import annotations

from aiohttp import ClientResponse


async def read_limited(resp: ClientResponse, limit: int) -> bytes | None:
    """
    Den Rumpf der Antwort lesen, höchstens limit Byte; None, wenn er grösser ist.

    Stückweise statt mit read(n): read(n) liefert nur, was gerade angekommen ist, und kann eine grosse Antwort ohne Fehler
    verkürzen. Der Inhalt-Länge-Kopf wird vorab geprüft, damit eine grosse Antwort gar nicht erst gelesen wird.
    """
    declared = resp.headers.get("Content-Length", "")
    if declared.isdigit() and int(declared) > limit:
        return None
    data = bytearray()
    async for chunk in resp.content.iter_chunked(8192):
        data += chunk
        if len(data) > limit:
            return None
    return bytes(data)
