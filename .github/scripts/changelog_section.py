"""Gibt den Abschnitt einer Version aus CHANGELOG.md aus (Release Notes).

Aufruf: python3 .github/scripts/changelog_section.py 0.1.0b1
Endet mit Fehler, wenn die Version fehlt oder ihr Abschnitt leer ist, damit
nie ein Release ohne Notes entsteht.
"""

from __future__ import annotations

import sys
from pathlib import Path

CHANGELOG = Path(__file__).resolve().parents[2] / "CHANGELOG.md"


def section(text: str, version: str) -> str:
    lines: list[str] = []
    inside = False
    for line in text.splitlines():
        if line.startswith("## ["):
            if inside:
                break
            inside = line.startswith(f"## [{version}]")
            continue
        # Link-Fussnoten am Ende gehören zu keinem Abschnitt.
        if inside and line.startswith("[") and "]: " in line:
            break
        if inside:
            lines.append(line)
    return "\n".join(lines).strip()


def main() -> int:
    if len(sys.argv) != 2:
        print("Aufruf: changelog_section.py <version>", file=sys.stderr)
        return 2
    notes = section(CHANGELOG.read_text(encoding="utf-8"), sys.argv[1])
    if not notes:
        print(f"Kein Abschnitt für {sys.argv[1]} in CHANGELOG.md", file=sys.stderr)
        return 1
    print(notes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
