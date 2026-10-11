# Setup

## New knowledge workspace

Download/extract or clone this repository, enter its directory, and run:

```bash
python3 scripts/check_memory.py
python3 -m unittest discover -s tests -v
claude
```

Python 3.10+ is needed for the small startup hook and structural checker. Claude Code needs an ordinary working account/setup. No model flag is required. Define the project scope and current task in your first conversation. The included Markdown is fictional template content, not completed work.

## Existing project

Use a copy or a reviewable branch. Preserve existing sources, wiki history and project rules.

1. Merge the selective retention/retrieval rules from `CLAUDE.md` into the project's existing instructions.
2. Add or reconcile `state.md`, `index.md`, `log.md`, `wiki/`, `raw/` and `docs/memory-schema.md`. Derive continuation from actual evidence; do not overwrite current state with the sample.
3. Copy `scripts/session_start.py`, `scripts/check_memory.py` and `scripts/guard_memory.py`; resolve name collisions and adjust references.
4. Merge the SessionStart, PreToolUse and PostToolUse hooks from `.claude/settings.json`, retaining unrelated settings and replacing any old broad memory loader.
5. Merge `.claude/skills/{ingest,query,lint}`. Optionally add the read-only `.claude/agents/{wiki-reader,wiki-auditor}.md` and their routing instructions.
6. Run the structural checker, start `claude`, and verify the startup notice reflects your current state.

See [migration](docs/migration.md) for details. Do not replace all project files wholesale.

## Interactive wiki dashboard

For Claude Code terminal 2.1.287+, install the optional mod once from this repository:

```bash
claude plugin marketplace add .
claude plugin install selective-wiki-ui@selective-llm-wiki
```

Then enter your knowledge project and run `claude` normally. The dashboard finds that project's Markdown; it does not modify originals or install memory rules into other projects. Keep the local marketplace checkout at its registered path. See [dashboard features, commands and verification](docs/mod.md).

Inside Claude Code, run `/tui fullscreen`, then `/wiki-status`. Fullscreen enables mouse interaction and saves your renderer preference for future sessions. A wide fullscreen terminal places the panel on the right; a narrow terminal places it above the prompt. Maximizing the window alone does not enable fullscreen rendering. See [Claude's fullscreen documentation](https://code.claude.com/docs/en/fullscreen).

## Verify memory updates

Complete a task or accept a decision. Check that Claude retained the useful delta and synchronized `state.md` with its Startup summary. Reopen a session and compare the notice with the file. If nothing meaningful changed, a session need not produce new notes or a log entry. The hook displays saved text; it does not write or invent progress.
