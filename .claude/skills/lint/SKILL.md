---
name: lint
description: Audit selective memory for broken links, conflicting claims, missing provenance and relevant drift. Report by default; fix only when explicitly authorized. Use for Wiki audit, requested maintenance or demonstrated retrieval failures.
---

# Lint — selective memory

Follow `CLAUDE.md` if not already loaded. Read relevant memory-schema sections only when conventions need clarification.

Choose mode: **report** by default; **fix** only when the user explicitly authorizes repairs. The dashboard Audit wiki action always reports, even when scope text asks for a fix. Do not edit files or log a report-only audit. In fix mode the main agent evaluates and performs authorized changes; preserve originals/history and report unresolved uncertainty.

Choose scope:
- Selected note: start there and inspect directly relevant links/evidence.
- Topic text: retrieve matching notes and necessary related evidence.
- Both: use the selected note within the requested topic.
- Neither: inspect current continuation and its relevant notes.

Ordinary post-write checks cover changed pages and direct links. Full archive maintenance requires an explicit broad request or demonstrated accumulated drift; do not silently expand a local audit. Use `python3 scripts/check_memory.py` for workspace-wide structural maintenance, not every single-note audit. Structural success does not establish factual truth.

Check broken discovery paths, missing provenance, supersession, stale continuation and incompatible current claims. Match evidence to each claim; do not expire settled architecture at a universal age or treat an orphan page as useless. For consequential verification outside scope, report the exact gap rather than invent a check or date.

Return concise prioritized findings with paths, evidence, uncertainty and proposed repairs. If none are found, state the inspected scope and limits. For worthwhile multi-note semantic review, optionally use `wiki-auditor` with explicit root, scope, paths, restrictions and about 400 words of findings. Small checks need no worker; unavailable workers fall back to the same scoped review in the main session.

After authorized fixes, check changed pages/direct links, synchronize state and Startup summary if continuation changed, and log only meaningful changes. Commits, publishing and destructive actions follow session authorization.
