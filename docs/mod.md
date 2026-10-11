# Selective Wiki dashboard

The optional `selective-wiki-ui` Claude Code mod makes selective memory visible and usable inside a normal `claude` session. The Markdown files remain the source of truth. No database, background service, JavaScript package install, build step or separate model API is needed at runtime.

## Features

| Control | Behavior | Model usage |
|---|---|---|
| Continuation tab | Startup summary, active work, blockers, next step | None |
| Freshness indicator | Recorded date and elapsed days; live verification remains unknown | None |
| History tab | Last five dated, meaningful log entries, newest first | None |
| Search tab | Wiki filter searches Markdown notes; Sources filter searches files in `raw/` and `docs/` | None |
| Select a result | Show its path, matching line and bounded local preview | None |
| Refresh / Hide / Open | Reload local records or toggle the pane | None |
| Research local wiki | Ask the main session to answer a question, optionally using `wiki-reader` | Current Claude model |
| Audit wiki | Ask for scoped, read-only findings, optionally using `wiki-auditor` | Current Claude model |
| Ingest source | Integrate the selected source through ingest in supplied-source mode; optional retention scope | Current Claude model |
| Save conversation memory | Ask the main agent to persist meaningful changes from the conversation | Current Claude model |

Search and scope fields accept arbitrary languages. Notes and the displayed startup summary keep their original language; interface labels are English. A record date is not a live-check date. Even a record saved today is shown as **live verification unknown**.

## Install once, then run `claude`

Use Claude Code **2.1.287+ in the terminal**. This is the documented release where mods are enabled by default. See [Claude's mod requirements](https://code.claude.com/docs/en/plugins/mods/overview#turn-mods-on-or-off).

From this repository's root:

```bash
claude plugin validate .
claude plugin validate ./plugins/selective-wiki-ui
claude plugin marketplace add .
claude plugin install selective-wiki-ui@selective-llm-wiki
claude
```

The marketplace/plugin install is a one-time user-level registration. After that, normal `claude` loads the mod; no model argument or wrapper is required. The mod only opens automatically in a project where it finds both `state.md` and `index.md`. It searches upward from the session directory, so nested project sessions work too.

A local marketplace points at this checkout: keep it at a stable path. For a hosted repository, add its actual GitHub `owner/repository` instead of `.`. Do not copy a fictitious repository URL. See [official marketplace installation](https://code.claude.com/docs/en/plugin-marketplaces#create-a-marketplace).

For a single session without persistent installation:

```bash
claude --plugin-dir ./plugins/selective-wiki-ui
```

To add the memory system to another project, follow [SETUP.md](../SETUP.md) and [migration](migration.md) first. Installing the UI does not overwrite that project's instructions, state or agents. If optional project agents are absent, research/audit use the main session with the same requested reading scope and report the fallback.

## Everyday use

For mouse interaction, first run `/tui fullscreen` inside Claude Code, then `/wiki-status`. The renderer preference is saved for future sessions. Maximizing the terminal window alone does not enable fullscreen rendering. See [Claude’s fullscreen documentation](https://code.claude.com/docs/en/fullscreen).

The mod requests a pane at startup. Claude only places an automatically opened pane when the terminal is at least 144 columns wide (110 after the user has opened it once). On narrower terminals, the startup notice and wiki band appear, with a message explaining how to open the dashboard. Run `/wiki-status` or press Open wiki to open it at any width. See [Claude’s pane placement rules](https://code.claude.com/docs/en/plugins/mods/interface#when-a-pane-waits-for-a-wider-terminal). Use Tab and Enter to move between controls. It docks beside the transcript on wider fullscreen terminals, and uses an inline pane on narrower/classic layouts; Claude controls placement. Hide it with the Hide button or Escape and reopen it from the small band above the prompt. Closing the pane does not erase memory.

The slash commands provide the same operations:

| Command | Purpose |
|---|---|
| `/wiki-status` | Refresh and open continuation state |
| `/wiki-refresh` | Refresh the saved records |
| `/wiki-toggle` | Open or hide the dashboard |
| `/wiki-search source evidence` | Search local notes without a model |
| `/wiki-sources vendor` | Search source files locally; empty searches show no list |
| `/wiki-research Why did we choose this provider?` | Start an explicit local research task |
| `/wiki-audit cancellation behavior` | Start an explicit scoped audit |
| `/wiki-save` | Reconcile meaningful conversation changes into memory; ignores search/selection |

Actions start only after the user presses their button or runs the command. State has Save conversation memory, history has Audit wiki, and the Wiki filter in search has Research wiki and Audit wiki. The Sources filter searches raw/docs files and shows Ingest source after selection, with an optional retention scope. Save uses the current conversation only; it ignores search text and selected notes and does not need a subagent. Research/audit use the question or scope and selected note. They queue until Claude is idle. Repeated presses while an action is queued do not duplicate it. Empty research questions are rejected. Research and audit authorize reading/reporting; Save conversation memory delegates justified writes to the main agent. Normal project instructions also continue to request state updates at meaningful task boundaries; the button is a manual recovery/convenience action.

Each action requests only its matching project skill when needed: Research wiki uses `.claude/skills/query/SKILL.md`; Audit wiki uses `.claude/skills/lint/SKILL.md` in report mode; Save conversation memory uses `.claude/skills/ingest/SKILL.md` in conversation mode; Ingest source uses the same ingest skill in supplied-source mode. If the skill is absent, Claude is asked to report it and stop without writing. Audit supports a selected note, topic, both, or current continuation with neither. Repairs require a separate authorized request.

After each main turn the mod refreshes state/history locally. It does not refresh for subagent completions, launch workers, ingest transcripts, or scan the archive automatically. It also reloads the local view after clear/resume/fork/compact events. External file edits appear on Refresh or the next main turn. Search results are recomputed when a search is submitted or refreshed, not after every keystroke.

The existing Python SessionStart hook still injects the small state and shows its notice. If a project has the panel but not `scripts/session_start.py`, the panel says so and logs the summary at session start instead; the summary is then not injected into the model's context.

If a future Claude Code release changes the mod API, `session.start` failures are caught and reported as a one-line log; the Markdown memory, startup hook and guards keep working. The mod adds the interactive view; it does not replace startup context. On headless sessions it opens no pane and local commands return bounded text. Those command outputs can enter the conversation; the visual pane and previews do not inject note bodies into model context.

## Bounds and failure behavior

- Startup/main-turn refresh reads `state.md` (shown up to 16 KB) and `log.md` (up to 32 KB). A larger file is clipped by UTF-8 bytes, the head of `state.md` and the most recent part of `log.md`, with a visible warning; a file over 512 KB is refused. It does not read `index.md` contents or `raw/`.
- User-triggered searches inspect at most 160 candidate files, 80 directories, depth 6, and 512 KB of candidate text. Wiki notes over 24 KB are skipped. Sources over 24 KB and non-text formats remain searchable by filename without loading their content. Text preview extensions are md/txt/rst/csv/json/yaml/yml/html/htm. At most 12 results appear; previews cap at 3,000 characters. Sources search runs only on filter/search/refresh requests, never at startup. Search folds case and diacritics and accepts a word's inflected form when the note holds its root (4+ characters, up to 10 suffix characters); exact substring matches rank higher.
- File paths must resolve inside the detected wiki root. Search skips symlink entries, hidden entries and paths outside the root. Source selection and queued intake revalidate that the file resolves within its raw/docs folder. This is ordinary filesystem checking, not an atomic guarantee against another process replacing a path between checking and reading it.
- Missing or unreadable records display a useful error and clear the previous continuation snapshot. History is ordered by date, so oldest-first and newest-first logs both show the five newest entries. Scan caps and skipped entries are reported; an incomplete search is not presented as exhaustive. Use targeted research for deeper retrieval.
- The UI uses session-local variables. It stores no additional memory database or cross-session cache and writes no canonical files directly.
- No network, subprocess, direct model-completion, permission-override or transcript-rewrite APIs are called by this mod. The explicit prompts remain subject to Claude's normal project tools and permissions.

## Verify

```bash
claude plugin validate .
claude plugin validate ./plugins/selective-wiki-ui
claude plugin test ./plugins/selective-wiki-ui
python3 scripts/check_memory.py
python3 -m unittest discover -s tests -v
# Optional Node.js check, independent of Claude rollout gates:
node tests/test_panel_contract.mjs
```

The native mod tests use Claude's own `claude-code/testing` runner, mocked files, mocked prompts and a controlled clock. They validate both terminal and desktop element trees, local search/preview, event refreshes and action routing without sign-in, real memory writes, network or model usage. See [official mod testing](https://code.claude.com/docs/en/plugins/mods/test).

Implementation verification on 2026-10-11: marketplace and plugin validation passed on Claude Code 2.1.285. All 22 native tests passed using `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` **for the test process only**, because this build gates the runner behind early access. No user setting or installed Claude version was changed. On 2.1.287+, use the ordinary test command above; the old flag is ignored by those releases.

Automated element tests do not verify terminal painting or a real model's adherence to the prompts. Follow-up verification on Claude Code 2.1.287: all 23 native tests passed without an early-access flag, including the unplaced-pane fallback. Live terminal rendering was checked: the mod loaded, its band rendered, and `/wiki-status` opened the panel in an 80-column terminal. The debug log confirmed that the original automatic-open request was waiting for 144 columns. Local search was also exercised in the terminal; actual model/worker execution has not been checked. To verify those after installation:

1. Start `claude` inside your knowledge project; confirm the startup notice and wiki band; on a narrow terminal open the dashboard with `/wiki-status`.
2. Check `/plugin` lists `selective-wiki-ui` as an active mod.
3. Search a known note, select it, and check the preview/path. Refresh and toggle should create no assistant turn.
4. Run one explicit research or audit action; inspect its tool trace and read-only worker use when applicable.
5. Complete a meaningful task, use Save conversation memory if needed, and check the next session's startup summary reflects the saved change.

## Update, disable or remove

After changing the plugin in a local marketplace, update its version and run `claude plugin update selective-wiki-ui@selective-llm-wiki`; installed copies can be cached. Then restart or run `/reload-plugins`. Hosted marketplace updates use Claude's normal plugin update flow. Disable or uninstall `selective-wiki-ui` from `/plugin` when desired; the Markdown memory and Python startup hook remain usable. Remove the local marketplace with `claude plugin marketplace remove selective-llm-wiki` if it is no longer needed.

For absent panes, check the Claude version, active-mod listing and project files, then run `/wiki-status`. Managed settings may disable mods. For command-name conflicts, rename the commands consistently in the module before loading it alongside the conflicting plugin. Do not load both a persistent install and a second development copy in the same session.

Skill-routing update (1.0.3), 2026-10-11: the 17 Python tests and plugin validation passed. Local mocked regressions passed for skill selection, all audit scopes, UI tab actions, queued deduplication, selected-note research/audit, conversation-save isolation and programmatic-action rejection. The expanded native suite could not run because Claude 2.1.287 returned “rollout switch served off”; no rollout bypass or real model/API invocation was used. Prompt checks do not establish model adherence.

In 1.0.4, action messages carry only the skill path, operation mode and applicable scope/selection. Workflow instructions remain in the project skill instead of being repeated in the transcript. Missing skills stop the action without writing. Claude Code still displays the plugin-message attribution; this change does not hide it.

Source intake update (1.0.5), 2026-10-11: plugin validation, 17 Python tests and local mocked source-panel regressions passed, including filter routing, source selection/scope, large/binary filename discovery, no binary preview, queue deduplication, missing/symlink/escaped-source rejection and conversation-save isolation. Native tests were added but the native runner remained blocked by “rollout switch served off”. No actual model intake or terminal painting was exercised for this update.

Blank Sources pane fix (1.0.6): Claude Code 2.1.287 requires every Input to provide an onSubmit handler. The optional source-scope field lacked it, so drawing Sources could fail. A strict local input-contract regression reproduced the failure before the fix and passed afterward. Enter now updates the scope without starting intake. The dependency-free panel regression can run locally; native execution remains subject to Claude rollout availability.

Latest local verification, 2026-10-11: Claude Code 2.1.287 allowed the native runner; all 32 tests passed. The large-source test now exercises the registered command through the native test API. A fresh terminal session in the disposable test workspace loaded the installed plugin and `/wiki-status` opened its panel. This verifies command registration and panel rendering in that session, not real model intake or worker execution; no model/API request was made.

Live supplied-source check, 2026-10-11: the user ingested a fictional notification source through the panel in a disposable workspace. Inspection confirmed the decision, source links, index membership and synchronized continuation summary; the source stayed unchanged and implementation/live verification was not claimed. The log unnecessarily mentioned discarded noise, so ingest instructions now explicitly omit it from all memory records. Version 1.0.8 compares dated records with the local calendar day, preventing false future-date warnings after local midnight.

Robustness update (1.0.9), 2026-10-11: oversized `state.md`/`log.md` are clipped by bytes with a warning instead of blanking the panel; history is ordered by date; search is diacritic/Turkish-aware with root matching; a missing startup hook is reported and its summary shown; `session.start` failures degrade to a log line. Added `scripts/guard_memory.py` (confirmation before editing an existing `raw/` original; post-edit summary/link feedback) and extra checker notices. Verified locally: 22 Python tests, the Node contract test and 35 native mod tests passed on Claude Code 2.1.287, and plugin validation passed. Live terminal rendering and the guard hooks inside a real Claude session were not exercised.
