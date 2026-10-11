#!/usr/bin/env python3
"""Check local Markdown discovery routes; no model calls or file mutations."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


def prose(text: str) -> str:
    # Lightweight fenced-example exclusion, not a full Markdown parser.
    return re.sub(r"(?ms)^\s*(`{3,}|~{3,})[^\n]*\n.*?^\s*\1\s*$", "", text)


SUMMARY_RE = r"^## Startup summary[^\S\n]*\n(.*?)(?=^## |\Z)"
STATE_BYTES = 6000   # what the SessionStart hook injects
SUMMARY_CHARS = 1400  # what the SessionStart notice displays


def front_matter_error(text: str) -> bool:
    """True when a leading '---' block is never closed."""
    if not text.startswith("---\n"):
        return False
    return re.search(r"(?m)^---[^\S\n]*$", text[4:]) is None


def check(root: Path) -> list[str]:
    root = root.resolve()
    errors = []
    state = root / "state.md"
    if not state.is_file():
        errors.append("state.md: missing")
    else:
        text = state.read_text(encoding="utf-8")
        match = re.search(r"^## Startup summary[^\S\n]*\n(.*?)(?=^## |\Z)", text, re.M | re.S)
        if not match or not match.group(1).strip():
            errors.append("state.md: missing or empty Startup summary")
    index = root / "index.md"
    if not index.is_file():
        errors.append("index.md: missing")
    wiki = list((root / "wiki").rglob("*.md"))
    slugs = {}
    for target in wiki + list((root / "raw").rglob("*.md")):
        slugs.setdefault(target.stem, []).append(target)
    extras = [p for p in (state, root / "log.md") if p.is_file()]
    for file in ([index] if index.is_file() else []) + wiki + extras:
        raw_text = file.read_text(encoding="utf-8")
        text = prose(raw_text)
        relative = file.relative_to(root)
        if front_matter_error(raw_text):
            errors.append(f"{relative}: front matter opened with '---' but never closed")
        for link in re.findall(r"\[[^\]\n]*\]\(([^)\n]+)\)", text):
            path = link.strip()
            if path.startswith("<") and path.endswith(">"):
                path = path[1:-1]
            parts = urlsplit(path)
            if parts.scheme or parts.netloc or not parts.path:
                continue
            dest = (file.parent / unquote(parts.path)).resolve()
            if not dest.is_relative_to(root):
                errors.append(f"{relative}: local link leaves workspace: {path}")
            elif not dest.exists():
                errors.append(f"{relative}: missing link target: {path}")
        for link in re.findall(r"\[\[([^\]\n]+)\]\]", text):
            target = link.split("|", 1)[0].split("#", 1)[0].strip()
            if not target:
                continue
            if "/" in target:
                dest = (file.parent / target).resolve()
                if dest.suffix != ".md":
                    dest = dest.with_suffix(".md")
                if not dest.is_relative_to(root) or not dest.is_file():
                    errors.append(f"{relative}: invalid explicit wikilink: {link}")
            else:
                stem = target[:-3] if target.endswith(".md") else target
                matches = slugs.get(stem, [])
                if not matches:
                    errors.append(f"{relative}: missing wikilink: {link}")
                elif len(matches) > 1:
                    errors.append(f"{relative}: ambiguous wikilink, use an exact path: {link}")
    return errors


def notices(root: Path) -> list[str]:
    """Non-failing observations; an orphan or an oversized state is not automatically wrong."""
    root = root.resolve()
    found = []
    state, index = root / "state.md", root / "index.md"
    if state.is_file():
        data = state.read_bytes()
        text = data.decode("utf-8", errors="ignore")
        if len(data) > STATE_BYTES:
            found.append(f"state.md: {len(data)} bytes; the startup hook injects only the first {STATE_BYTES}")
        match = re.search(SUMMARY_RE, text, re.M | re.S)
        if match and len(match.group(1).strip()) > SUMMARY_CHARS:
            found.append(f"state.md: Startup summary exceeds {SUMMARY_CHARS} characters and will be truncated in the notice")
        updated = re.search(r"^Updated:\s*(.*)$", text, re.M)
        if not updated:
            found.append("state.md: no 'Updated:' line; freshness will show as undated")
        elif not re.search(r"\b\d{4}-\d{2}-\d{2}\b", updated.group(1)) and "not initialized" not in updated.group(1).lower():
            found.append("state.md: 'Updated:' has no YYYY-MM-DD date; freshness will show as undated")
    if index.is_file():
        catalog = index.read_text(encoding="utf-8")
        for page in sorted((root / "wiki").rglob("*.md")):
            rel = page.relative_to(root).as_posix()
            if rel not in catalog and f"[[{page.stem}" not in catalog:
                found.append(f"{rel}: not listed in index.md (orphan pages are allowed; confirm it is intentional)")
    return found


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    errors = check(root)
    for error in errors:
        print(error)
    for notice in notices(root):
        print(f"notice: {notice}")
    if errors:
        print(f"\n{len(errors)} structural issue(s); no files changed.")
        return 1
    print("Memory discovery checks passed; factual accuracy was not evaluated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
