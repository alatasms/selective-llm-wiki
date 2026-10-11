#!/usr/bin/env python3
"""Load bounded state and display its maintained summary; no model or file writes."""
from pathlib import Path
import json
import re
import sys

STATE_BYTES = 6000
SUMMARY_CHARS = 1400


def build_response(root: Path, payload: object) -> dict:
    source = payload.get("source", "startup") if isinstance(payload, dict) else "startup"
    try:
        with (root / "state.md").open("rb") as stream:
            raw = stream.read(STATE_BYTES + 1)
        text = raw[:STATE_BYTES].decode("utf-8", errors="ignore")
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        if len(raw) > STATE_BYTES:
            text += "\n[State truncated; read state.md before relying on omitted content.]"
        context = (
            "Dated continuation memory from state.md, not a current code/live audit. "
            "SessionStart already loaded it; do not reread unless changed or truncated. "
            "The startup summary is a visible hook notice; do not repeat it unless asked. "
            "Retrieve other memory only for the current task.\n\n" + text
        )
        match = re.search(r"^## Startup summary[^\S\n]*\n(.*?)(?=^## |\Z)", text, re.M | re.S)
        if match:
            summary = match.group(1).strip()
            if not summary:
                summary = "Startup summary is empty; update it alongside continuation state."
            elif len(summary) > SUMMARY_CHARS:
                summary = summary[:SUMMARY_CHARS] + "\n[Summary truncated; see state.md.]"
        else:
            summary = "Startup summary is missing; add a short section to state.md."
    except OSError:
        context = "Continuation state could not be loaded; do not invent current project status."
        summary = "Could not read state.md; check the workspace and file."
    result = {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": context}}
    if source in {"startup", "resume", "clear"}:
        result["systemMessage"] = "Session summary — state.md\n" + summary
    return result


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        payload = {}
    root = Path(__file__).resolve().parent.parent
    print(json.dumps(build_response(root, payload), ensure_ascii=False))


if __name__ == "__main__":
    main()
