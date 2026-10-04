"""
Prompt der KI-Einschätzung (seit 1.2.0, docs/mockups/ai-v1, A).

Der Standard steht hier; im Profi-Modus der Einstellungen kann der Nutzer ihn
kopieren und ändern (Option ai_prompt, leer = Standard). Der Prompt ist eine
Vorlage mit genau zwei Platzhaltern: {language} (Sprache der Antwort) und
{facts} (die Fakten eines Geräts als JSON, siehe ai_assessment.build_facts).
Ein eigener Prompt kann keine weiteren Daten anfordern; es gehen immer nur
die Fakten raus. Ohne HA-Abhängigkeiten, damit options_api ihn prüfen kann.
"""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol

from .const import AI_PROMPT_MAX

PLACEHOLDER_LANGUAGE = "{language}"
PLACEHOLDER_FACTS = "{facts}"
PLACEHOLDERS = (PLACEHOLDER_LANGUAGE, PLACEHOLDER_FACTS)

DEFAULT_PROMPT = (
    "You are a careful assistant for a Home Assistant installation. Below are facts about ONE smart home device "
    "as JSON. Assess why it is (or was) offline or unstable and what the owner could check, most likely cause first. "
    "Use only these facts; do not invent values. Say what is uncertain. "
    "Answer in {language}. Format: the first line is a short headline (at most 6 words) naming the most likely cause; "
    "then an empty line; then 3 to 5 short sentences of plain text (no markdown, no lists). "
    "If nothing is wrong, say so briefly.\n\nFacts:\n{facts}"
)

# Wörter in geschweiften Klammern sind Platzhalter; JSON oder anderer Text
# mit Klammern (Anführungszeichen, Leerzeichen, Zahlen) gilt als normaler Text.
_PLACEHOLDER_RE = re.compile(r"\{[A-Za-z_][A-Za-z0-9_]*\}")


def prompt_problem(text: str) -> str | None:
    """Warum ein Prompt nicht geht: "too_long", "no_facts" oder "unknown:{name}"; sonst None."""
    if len(text) > AI_PROMPT_MAX:
        return "too_long"
    if PLACEHOLDER_FACTS not in text:
        return "no_facts"
    for found in _PLACEHOLDER_RE.findall(text):
        if found not in PLACEHOLDERS:
            return f"unknown:{found}"
    return None


def ai_prompt(value: Any) -> str:
    """Eigener Prompt: leer oder gleich dem Standard = Standard (""), sonst geprüft."""
    if value is None:
        return ""
    if not isinstance(value, str):
        raise vol.Invalid("Text erwartet")
    text = value.replace("\r\n", "\n").strip()
    if not text or text == DEFAULT_PROMPT:
        return ""
    problem = prompt_problem(text)
    if problem:
        raise vol.Invalid(f"Ungültiger Prompt: {problem}")
    return text


def render_prompt(template: str, facts_json: str, language: str) -> str:
    """Platzhalter einzeln ersetzen (nicht str.format): Klammern im Text bleiben unberührt."""
    # {language} zuerst, damit Klammern in den Fakten nicht mehr ersetzt werden.
    return (template or DEFAULT_PROMPT).replace(PLACEHOLDER_LANGUAGE, language).replace(PLACEHOLDER_FACTS, facts_json)
