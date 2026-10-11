---
name: query
description: Answer project knowledge questions by retrieving relevant notes and evidence. Use for wiki questions and Research wiki; read and report without changing memory.
---

# Query — selective memory

Follow `CLAUDE.md` if not already loaded. This operation reads and reports; it does not write notes, state, index or log. A separate authorized save uses `ingest`.

Use the question as scope and any selected note as a starting point, not the entire evidence set. Search relevant filenames, headings and keywords, then read matching sections. Use the compact catalog when discovery needs it; do not preload the whole index, log or raw archive. Expand directly relevant links/originals to resolve consequential gaps, supersession or contradictions.

Match evidence to the question: user statements for intent, code for implementation, meaningful tests/live observations for behavior. A recorded note is not fresh verification. Cite consequential claims with paths/source sections, disclose conflicts and uncertainty, and answer concisely. Missing evidence is not proof of absence.

Dashboard Research wiki is local and read-only: do not perform external research, launch teams, commit or publish. Outside the dashboard, external verification requires the surrounding request's scope; use current primary sources for volatile external facts.

For synthesis requiring several topic/source reads, the main agent may use `wiki-reader` when worthwhile. Single-note questions stay in the main session. Pass explicit root, question, candidate paths, restrictions and an evidence-focused output budget of about 300 words. Review the return and fill consequential gaps. If unavailable, use the same scoped read-only approach yourself. Do not launch a worker by default or save its output automatically.
