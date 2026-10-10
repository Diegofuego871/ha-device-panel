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
    # Auch verschachtelte Texte (z. B. ranges, entryStates) und die Länge von Listen.
    script = (
        "import(process.argv[1]).then(({ STRINGS }) => {"
        " const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>"
        "   Array.isArray(v) ? [`${p}${k}[${v.length}]`] : v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [p + k]);"
        " const de = keys(STRINGS.de), en = keys(STRINGS.en);"
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


def test_panel_device_types_match_backend() -> None:
    """Gerätetypen im Panel (Reihenfolge, Symbole, Texte) wie const.DEVICE_TYPES."""
    import re

    from custom_components.device_panel.const import DEVICE_TYPES

    js = (INTEGRATION / "panel" / "device-panel.js").read_text(encoding="utf-8")
    order = re.search(r"const TYPE_ORDER = \[([^\]]*)\]", js).group(1)
    assert [t.strip().strip('"') for t in order.split(",")] == list(DEVICE_TYPES)
    icons = re.search(r"const TYPE_ICONS = \{(.*?)\n\};", js, re.S).group(1)
    assert set(re.findall(r"^  (\w+):", icons, re.M)) == set(DEVICE_TYPES)
    strings = (INTEGRATION / "panel" / "strings.js").read_text(encoding="utf-8")
    for kind in DEVICE_TYPES:
        key = f"type{kind[0].upper()}{kind[1:]}:"
        assert strings.count(key) == 2, key  # Deutsch und Englisch
    for lang in ("en", "de"):
        options = _load(f"translations/{lang}.json")["selector"]["device_type"]["options"]
        assert list(options) == list(DEVICE_TYPES)


def test_push_texts_complete() -> None:
    """Serverseitige Texte (Push, anhaltende Benachrichtigung): DE und EN gleich."""
    from custom_components.device_panel.push import TEXTS

    assert set(TEXTS) == {"de", "en"}
    assert set(TEXTS["de"]) == set(TEXTS["en"])
    placeholders = lambda s: set(re.findall(r"\{(\w+)\}", s))  # noqa: E731
    for key in TEXTS["de"]:
        assert placeholders(TEXTS["de"][key]) == placeholders(TEXTS["en"][key]), key


def test_activity_texts_complete() -> None:
    """Texte des Protokolls (1.38.0): DE und EN gleich, jeder Text kommt in beiden mit denselben Platzhaltern."""
    from custom_components.device_panel.activity import TEXTS

    assert set(TEXTS) == {"de", "en"}
    assert set(TEXTS["de"]) == set(TEXTS["en"])
    placeholders = lambda s: set(re.findall(r"\{(\w+)\}", s))  # noqa: E731
    for key in TEXTS["de"]:
        assert placeholders(TEXTS["de"][key]) == placeholders(TEXTS["en"][key]), key
