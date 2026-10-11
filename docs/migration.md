# Migrating an existing LLM wiki

Work on a copy or reviewable branch first. This template does not require deleting or re-ingesting your archive.

1. Preserve source material, decisions and history. Keep your current raw/wiki folders.
2. Move long incident narratives out of always-loaded instructions into relevant topic references. Keep the short principles and important project boundaries in root instructions.
3. Create one short continuation state. Derive it from evidence, date it, and mark unverified current-status assumptions. A historical log saying “not pushed” is not today's push status.
4. Add the maintained startup summary near the top of state. Keep it synchronized with detailed continuation state.
5. Replace broad startup index/log loaders with the state hook. Merge settings; preserve unrelated hooks. Do not install both old and new memory loaders.
6. Compact the catalog to paths and short titles. Keep every useful discovery route. Do not hide conflicting current truth inside an index summary.
7. Change query behavior from “read the whole index and file every useful answer” to targeted retrieval and durable-delta writes.
8. Change ingest behavior from mandatory summary/cross-link sweeps to conditional summaries and directly affected note updates.
9. Separate small post-write checks from full archive maintenance. Retain project-specific safety and source precision rules.
10. Review behavior in real sessions. If important knowledge is repeatedly missed, improve retrieval and topic names before tightening budgets further.

Before replacing files prepared earlier, merge any newer work. Do not overwrite new log entries, accepted decisions, state or configuration. The hook is optional: without it, the agent can read state directly, but no automatic notice appears.

## Optional reader/auditor layer
Merge the two agent definitions and routing rules only if broad retrieval/audits benefit your workflow. Read [subagent configuration](subagents.md), including explicit tool limits, project restriction handoff and the version requirement. Preserve existing agents. No teams or per-agent memory need to be enabled.
