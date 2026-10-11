# Using selective memory

## First session
Open Claude Code from the workspace root. The startup notice will show that the sample state is not initialized. Describe the project and what you are working on. Ask Claude to keep durable decisions and continuation state, then verify the first update.

## A new decision

> We decided to use one adapter per provider. Record the rationale: independent vendor changes should not affect other adapters. This is accepted design, not implemented code.

Expected: a source-backed decision note, a compact catalog entry if the page is new, a brief log entry, and state updates only if continuation changed. Explicit statements in the conversation can be captured with a small verbatim source record when no export is available; do not fabricate an original transcript.

## A repeated question

> Why did we choose one adapter per provider?

Expected: targeted retrieval and an answer from the decision. If nothing new emerges, no synthesis page and no log entry.

## New evidence

> Ingest this vendor document. Keep the integration limitations that would change our implementation.

Expected: preserve the original, integrate useful deltas into relevant notes, and create a source summary only if it improves future retrieval. Volatile vendor claims may need current primary-source checks before consequential use.

## Progress and continuation

> The adapter task is complete; the next task is verifying cancellation behavior.

Expected: reconcile implementation/verification evidence rather than assuming “complete” means tested live, update state and its startup summary together, preserve durable results if needed. The next normal session displays the updated summary.

## Maintenance

```bash
python3 scripts/check_memory.py
```

For a semantic review, ask `/lint` to examine a topic or explicitly request the full archive. Reports are read-only. To authorize repairs, ask, for example, `/lint fix broken links in the adapter notes`. The checker finds structural problems; it cannot resolve conflicting evidence or decide what should be retained. A single-note audit checks its relevant links without running a workspace-wide scan.

## Dashboard workflows

Each action loads only its matching project skill when needed:

| Action | Skill | Behavior |
| --- | --- | --- |
| Research wiki | query | Retrieve local evidence and answer; no memory writes |
| Audit wiki | lint, report mode | Report problems and proposed repairs; no writes |
| Ingest source | ingest, supplied-source mode | Integrate a selected raw/docs source within the requested scope |
| Save conversation memory | ingest, conversation mode | Save meaningful conversation changes; ignore note selection/search text |

For Audit wiki, select a note in Search, enter a topic, use both, or leave both empty to review current continuation and relevant notes. A selected note is a starting point; related evidence may be read to resolve a conflict. Asking for repairs in the dashboard scope does not switch modes; authorize fixes separately in the conversation.

In Search, use **Wiki** for note research/audits or **Sources** to search files in `raw/` and `docs/`. An empty source search shows no list or scan count. Enter search words and press Enter; clearing the field removes results immediately. Select a source, optionally write what to retain (for example, “Only Redis decisions”), then press **Ingest source**. This queues a short request to the project ingest skill. Adding a file or selecting it does not automatically start intake. Existing originals stay unchanged, existing canonical notes are checked before adding new ones, and a repeated source need not create new pages. Save conversation memory remains independent of that source.

Small supported text files can be searched by content and previewed. Large files and other formats can be found by filename; format extraction depends on the tools in the Claude session. Unsupported formats are reported instead of invented. Search bounds are disclosed; narrow the filename when the listing is capped.

Save conversation memory needs no selected file. It neither creates a transcript nor starts a worker, and writes nothing when there is no meaningful delta. State and Startup summary stay synchronized when continuation changes. Normal task-boundary memory updates remain automatic under project instructions; the button is a convenience.

## Localized startup summary
The display is literal text from `state.md`. You can write its summary in Turkish or another language while leaving detailed technical notes in English. Tell the agent your preferred language. The hook does not translate or summarize at startup.

## Hook troubleshooting
Check `/hooks` to confirm the project SessionStart definition is loaded. Check Python availability and run the hook script directly with a JSON source input. Preserve unrelated settings when merging. A missing summary or unreadable state produces a notice; oversized state is explicitly marked. The visible notice may be styled as a warning because `systemMessage` is the documented user-visible hook field.

The startup notice is not a new assistant response. Do not put a prompt hook or a nested Claude invocation inside the loader to manufacture one.

## Broad queries and audits
The main session may use a bounded wiki-reader or wiki-auditor for genuinely multi-note work. For explicit examples and client tool verification, see [optional subagents](subagents.md). Simple lookups remain in the main session; workers propose findings, never canonical memory writes.
