#!/usr/bin/env python3
"""Mechanical guards for memory rules; stdlib only, no model calls, never writes files.

PreToolUse : editing an existing original in raw/ requires explicit user confirmation.
PostToolUse: after state.md / wiki / index.md edits, report a missing or oversized
             Startup summary and broken links as context for the model to repair.
Bash or external edits are not observable here; scripts/check_memory.py remains the audit.
"""
from pathlib import Path
import importlib.util
import json
import sys

WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}


def _checker():
    spec = importlib.util.spec_from_file_location("check_memory", Path(__file__).with_name("check_memory.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _target(root: Path, payload: dict):
    if payload.get("tool_name") not in WRITE_TOOLS:
        return None
    args = payload.get("tool_input") or {}
    raw = args.get("file_path") or args.get("notebook_path")
    if not isinstance(raw, str) or not raw:
        return None
    path = Path(raw)
    if not path.is_absolute():
        path = Path(payload.get("cwd") or root) / path
    try:
        return path.resolve().relative_to(root.resolve())
    except (OSError, ValueError):
        return None


def decide(root: Path, payload: dict):
    rel = _target(root, payload)
    if rel is None:
        return None
    event = payload.get("hook_event_name")
    parts = rel.parts
    if event == "PreToolUse":
        exists = (root / rel).exists()
        if parts and parts[0] == "raw" and exists:
            return {"hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": f"{rel.as_posix()} is a preserved original; existing sources in raw/ are not rewritten. "
                                            "Approve only if you intend to change the original.",
            }}
        return None
    if event == "PostToolUse":
        problems = []
        checker = _checker()
        rel_text = rel.as_posix()
        if rel_text == "state.md":
            problems += [e for e in checker.check(root) if e.startswith("state.md")]
            problems += [n for n in checker.notices(root) if n.startswith("state.md")]
        elif parts and parts[0] == "wiki" or rel_text in {"index.md", "log.md"}:
            problems += [e for e in checker.check(root) if e.startswith(rel_text)]
        if problems:
            return {"hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "Memory check after editing " + rel_text + ":\n- " + "\n- ".join(problems)
                                     + "\nRepair these if they are in scope; structural checks do not establish factual accuracy.",
            }}
    return None


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        payload = {}
    if not isinstance(payload, dict):
        return
    root = Path(__file__).resolve().parent.parent
    try:
        result = decide(root, payload)
    except Exception:  # a guard must never block the session
        return
    if result:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
