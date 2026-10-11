# Selective project memory

## Scope
This workspace keeps source-backed knowledge for the user's project. Ask for or infer the actual project scope from the current request, then update state; fictional sample notes are examples, not project decisions.

## Startup and retrieval
Use the `state.md` content injected by SessionStart. Read the file directly only if injection is absent, changed, or truncated. The maintained startup summary is displayed as a hook notice; do not repeat it unless asked.
Do not preload `index.md`, `log.md`, raw sources, the entire wiki, or every workflow. Search relevant filenames, headings and keywords; read matching sections and expand when the evidence requires it. The compact catalog is available on demand.

## Retention
Honor explicit save requests. Otherwise persist only new/corrective project information likely to change future work: accepted decisions/preferences, costly-to-rediscover findings, recurring traps and actionable blockers. Routine progress, generic explanations and repeated answers do not create notes.
Search for an existing canonical note before writing. Update it first; create a page only for a distinct reusable topic. Summaries and cross-updates are conditional, not mandatory.
Update `state.md` and its `Startup summary` together when the active work, blocker, pending decision or next step changes. Do this at meaningful boundaries without waiting for the user to request it. Keep state short; completed items leave the continuation state after any necessary durable result is preserved.

## Evidence and history
Preserve true originals in `raw/`; new sources may be added during authorized intake, existing ones are never rewritten. Derived content belongs in `wiki/`. Distinguish a proposal, accepted decision, implementation and live verification. Source consequential claims precisely. Date memory; do not present it as a fresh code/live audit.
Refresh verification dates only after checking applicable claims. Preserve significant decision history and mark superseded current pages. Only one writer updates shared memory at a time. Do not silently delete sources or history.

## Optional readers
Keep simple lookups and small updates in the main session. For a question requiring several source/topic reads, delegate a bounded scope to `wiki-reader`; for requested multi-note semantic review or demonstrated drift, use `wiki-auditor`. Never launch them at startup or for every operation. Normally use one worker, and expand only for a clear need.
Pass the workspace root, concrete question/scope, relevant paths, project restrictions and expected result explicitly: these agents omit CLAUDE.md and do not inherit conversation history. They have no persistent memory or writing tools. Review their evidence and limitations before integrating findings; the main session alone writes canonical memory. Do not delegate an entire ingest to a reader. Do not enable agent teams for this workflow. If a worker stops partially, continue only when its remaining scope is necessary; do not blindly retry.

## Workflows
Use `.claude/skills/ingest/SKILL.md` for source intake or conversation memory, `query/SKILL.md` for read-only knowledge questions and `lint/SKILL.md` for maintenance reports (repairs need explicit authorization). Load only the operation needed. Dashboard research/audit always read and report; Save conversation memory uses ingest without a selected note or subagent; Ingest source uses supplied-source mode for the selected raw/docs file and preserves the original.
Read relevant sections of `docs/memory-schema.md` when writing or resolving conventions. Check changed pages and direct links after ordinary writes; a full archive audit is a separate task.
Write notes in the user's chosen documentation language. The startup summary may use their conversational language. Keep source text unchanged. Use `log.md` for brief meaningful-change records, not a transcript of tools or routine answers.

## Working boundaries
Inspect code for implementation claims and meaningful tests/live evidence for working behavior. Use current primary sources when volatile facts matter. Report uncertainty and contradictions; do not convert an unaccepted proposal into a user decision.
Preserve current session authorization and project rules. Ask only for unresolved decisions or actions that actually require approval. Continue independent work when possible. Do not stage unrelated files, commit automatically, push, deploy or change live systems merely because this memory template is installed; follow the user's task and repository policy.
