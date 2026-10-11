# Memory conventions

## Storage and read policy
Root instructions plus the dated continuation state are the small startup layer. The archive remains on disk and is searched only when relevant. Search filenames/headings/keywords, read matching sections, then expand to links or originals as needed. A fixed top-k must not hide relevant evidence. Use the catalog for discovery and the historical log for history or discrepancies.

`state.md` is replaceable continuation state, not a chronological journal. Maintain the short `## Startup summary` and detailed state together at meaningful boundaries; date updates. Keep the summary close to the top, preferably 3–5 short bullets. An entry can describe an unverified recorded fact, but must not present it as freshly checked. The hook reads only the first 6,000 bytes and displays at most 1,400 characters of summary. Treat truncation as a reason to inspect the complete file.

`wiki/` holds canonical project notes. `raw/` holds originals or source-address stubs (address, access date, version if known). Newly authorized sources may be added; existing originals are immutable. A rewritten or condensed source is derived content and belongs in the wiki. Do not place secrets in startup state or commit sensitive source material to a public repository.

## Retention gate
Honor explicit saves. Otherwise ask whether information is new/corrective, specific to the project and likely to affect future work or costly to rediscover. Retain accepted decisions/preferences, expensive findings, recurring traps and actionable blockers. Skip routine activity, generic explanations, duplicated answers and cheaply rediscovered code facts unless their rationale has lasting value.

A relevant source does not automatically require a summary page. An informative answer does not automatically require a synthesis. Search for existing notes; update the smallest relevant section first. Create a page only for a distinct reusable topic. Update directly affected records, not every mention across the wiki. Save an important decision promptly; batch ordinary related updates at a natural boundary.

## Pages and sources
Use descriptive kebab-case names. Suggested new page metadata:

```yaml
---
type: decision
date: YYYY-MM-DD
---
```

Other types may include `finding`, `concept`, `entity`, `source` and `synthesis`. Optional fields such as `tags`, `source`, `related`, `confidence`, `last_verified` and `superseded_by` are useful only when they convey actual information. Preserve existing conventions when migrating an established wiki.

Use exact relative Markdown paths for source/canonical links. `[[slug]]`, `[[slug|label]]` and `[[slug#section]]` links are also supported by the checker when the target basename is unambiguous. Originals and derived notes may share a basename, so use explicit paths when a wikilink would be ambiguous.

Cite consequential claims near the claim: original section/quote, URL/access date, or code path plus commit and line when appropriate. Disclose relevant uncommitted changes; a commit does not cover them. Distinguish proposal, accepted decision, code implementation and live verification. Evidence depends on the question: user messages establish intent, code implementation, tests/live checks observed behavior, primary sources external facts. A wiki note is a pointer to evidence, not fresh proof.

Editing a page does not justify bumping `last_verified`. On mixed-age pages, annotate verification beside individual claims. Age and supersession do not make a historically correct decision false. Revise current claims while preserving significant reasoning; mark superseded pages and update catalog status. Do not leave incompatible pages both asserting current truth.

## Catalog, log and maintenance
Catalog entries contain a title/short purpose and exact path; no incident stories or duplicated findings. Update only when membership, path, title or status changes. The log is append-only: normally one dated entry of 1–3 lines per meaningful batch. Do not log a repeated answer or create an empty record.

One writer integrates shared memory at a time. After writes, check changed pages and direct links. Full maintenance is a separate task, requested or justified by repeated retrieval failures or accumulated drift. Structural checks precede expensive semantic review. Reverify volatile consequential facts when using them; settled architecture does not expire at a universal 90-day threshold. An orphan page is not automatically useless.

`scripts/guard_memory.py` (PreToolUse/PostToolUse on file-edit tools) asks before an existing original in `raw/` is changed and reports a missing summary or broken links after edits. It cannot see shell or external edits. `scripts/check_memory.py` also prints notices (orphans, oversized state/summary, undated `Updated:`) that do not fail the check.

Commit/push behavior follows session authorization and repository policy, not an automatic wiki rule.

## Working budgets
Aim for short root instructions, roughly 200–400 words of state and compact catalog entries. These are targets, not cutoffs for relevant evidence. Keep the smallest sufficient reads/writes. Evaluate actual startup context, avoidable rereads, duplicated notes and important rediscoveries; file bytes alone are not measured token savings.
