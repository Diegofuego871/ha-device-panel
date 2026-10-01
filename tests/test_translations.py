"""Texte: Deutsch und Englisch vollständig, Schweizer Schreibweise (kein Eszett)."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

INTEGRATION = Path(__file__).resolve().parents[1] / "custom_components" / "device_panel"
ROOT = INTEGRATION.parents[1]


def _keys(data: dict, prefix: str = "") -> set[str]:
    out: set[str] = set()
    for key, value in data.items():
        if isinstance(value, dict):
            out |= _keys(value, f"{prefix}{key}.")
        else:
            out.add(f"{prefix}{key}")
    return out


def _load(name: str) -> dict:
    return json.loads((INTEGRATION / name).read_text(encoding="utf-8"))


def test_strings_json_equals_english() -> None:
    assert _load("strings.json") == _load("translations/en.json")


def test_german_and_english_have_same_keys() -> None:
    en = _keys(_load("translations/en.json"))
    de = _keys(_load("translations/de.json"))
    assert en - de == set(), f"fehlt auf Deutsch: {sorted(en - de)}"
    assert de - en == set(), f"fehlt auf Englisch: {sorted(de - en)}"


def test_no_sharp_s() -> None:
    files = [*INTEGRATION.glob("*.py"), *INTEGRATION.glob("translations/*.json"), *INTEGRATION.glob("panel/*.js")]
    files += [ROOT / name for name in ("README.md", "README.de.md", "CHANGELOG.md", "CHANGELOG.de.md")]
    offenders = [str(f.relative_to(ROOT)) for f in files if "\u00df" in f.read_text(encoding="utf-8")]
    assert not offenders, f"Eszett statt ss in: {offenders}"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js fehlt")
def test_panel_strings_complete() -> None:
    script = (
        "import(process.argv[1]).then(({ STRINGS }) => {"
        " const de = Object.keys(STRINGS.de), en = Object.keys(STRINGS.en);"
        " console.log(JSON.stringify({ onlyDe: de.filter((k) => !en.includes(k)), onlyEn: en.filter((k) => !de.includes(k)) }));"
        "})"
    )
    result = subprocess.run(
        ["node", "-e", script, (INTEGRATION / "panel" / "strings.js").as_uri()],
        capture_output=True,
        text=True,
        check=True,
    )
    diff = json.loads(result.stdout)
    assert diff == {"onlyDe": [], "onlyEn": []}


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js fehlt")
def test_panel_language_selection() -> None:
    """Deutsch für de und de-*, sonst Englisch (Regel aus docs/HANDOVER.md)."""
    cases = {
        "de": "de",
        "de-CH": "de",
        "DE-at": "de",
        "en": "en",
        "en-GB": "en",
        "fr": "en",
        "dev": "en",
        "": "en",
    }
    script = (
        "import(process.argv[1]).then(({ pickLang }) => {"
        " const cases = JSON.parse(process.argv[2]);"
        " const out = {};"
        " for (const lang of Object.keys(cases)) {"
        "  out[lang] = [pickLang({ locale: { language: lang } }), pickLang({ language: lang })];"
        " }"
        " out.none = [pickLang(null), pickLang({})];"
        " console.log(JSON.stringify(out));"
        "})"
    )
    result = subprocess.run(
        ["node", "-e", script, (INTEGRATION / "panel" / "strings.js").as_uri(), json.dumps(cases)],
        capture_output=True,
        text=True,
        check=True,
    )
    got = json.loads(result.stdout)
    expected = {lang: [want, want] for lang, want in cases.items()}
    expected["none"] = ["en", "en"]
    assert got == expected


def _structure(path: Path) -> list[str]:
    """
    Aufbau einer Markdown-Datei ohne den Wortlaut: Überschriften-Ebenen,
    Listenpunkte, Zitate, Codeblöcke. Versionsüberschriften und
    Link-Fussnoten im CHANGELOG müssen wörtlich gleich sein.
    """
    out: list[str] = []
    in_code = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("```"):
            in_code = not in_code
            out.append("code")
        elif in_code:
            continue
        elif line.startswith("## ["):
            out.append(line)
        elif match := re.match(r"(#+) ", line):
            out.append(match.group(1))
        elif re.match(r"(-|\d+\.) ", line):
            out.append("item")
        elif line.startswith(">"):
            out.append("quote")
        elif re.match(r"\[[^\]]+\]: ", line):
            out.append(line)
    return out


@pytest.mark.parametrize(("en", "de"), [("README.md", "README.de.md"), ("CHANGELOG.md", "CHANGELOG.de.md")])
def test_docs_bilingual(en: str, de: str) -> None:
    """README und CHANGELOG gibt es in beiden Sprachen, gleich aufgebaut und gegenseitig verlinkt."""
    assert _structure(ROOT / en) == _structure(ROOT / de)
    assert f"]({de})" in (ROOT / en).read_text(encoding="utf-8")
    assert f"]({en})" in (ROOT / de).read_text(encoding="utf-8")
