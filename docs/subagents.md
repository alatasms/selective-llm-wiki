# Optional read-only subagents

The normal `claude` flow remains unchanged. These definitions are discovered from `.claude/agents/`; the main agent decides when a task warrants delegation, or you can explicitly request the named worker. They are not a team, do not launch at startup, and have no independent persistent memory.

## Two narrow roles

| Agent | Useful scope | Default return | Turn budget |
|---|---|---|---|
| wiki-reader | A question needing evidence from several notes/sources | ~300 words plus precise pointers | 12 |
| wiki-auditor | A requested semantic audit across records | ~400 words, consequence and evidence | 16 |

Budgets are local defaults, not product limits or completeness guarantees. Report partial coverage and continue only for a necessary gap. Both use `model: inherit`, respecting the parent's chosen/default model.

## Tool boundary

Both define `tools: Read, Grep, Glob`. They have no Bash, Write, Edit, Skill, Agent or network/MCP tools in their allowlist. No `memory` field is present: persistent subagent memory automatically enables Read/Write/Edit, which would undermine this role and create a competing memory layer. We do not rely on `permissionMode: plan` as the read-only boundary. The single-writer rule covers these workers; it does not lock out a separate human or another independent Claude session.

`omitClaudeMd: true` avoids preloading repeated project/user/local instructions. It requires Claude Code **2.1.271+**. The parent must pass relevant project restrictions in every delegation. Managed policy still applies; this field does not bypass policy. On older versions, remove that field to use normal instruction loading, then check the effective configuration rather than assume the optimization worked. Other client restrictions can disable agents or tools.

See the official [subagent reference](https://code.claude.com/docs/en/sub-agents).

## Invocation examples

Start normally:

```bash
claude
```

For broad retrieval:

> Use wiki-reader to investigate the cancellation-policy decisions in this workspace. Search wiki/decisions and wiki/findings first, read raw evidence only if needed, and return findings, source pointers and unresolved contradictions. Do not modify memory.

For a scoped audit:

> Run structural checks, then use wiki-auditor to review the current cancellation notes and continuation state for contradictions or unsupported current claims. Give me proposed edits; keep all actual writes in the main session.

The parent passes exact existing paths; examples do not create missing folders. A narrow question such as “what did we decide on this page?” normally stays in the main session.

## Single writer and result handoff

The parent receives a finding/evidence/uncertainty/delta report, checks consequential claims, answers, and saves only a useful new durable delta. It updates state and Startup summary together if continuation changed. A worker report does not itself become a new wiki page. No automatic summaries, tool logs or parallel writes are added.

## Verify in Claude Code

1. Start a new session and inspect `/agents` for wiki-reader and wiki-auditor.
2. Inspect their available tools: only Read, Grep and Glob. Check that memory is not enabled.
3. Request a scoped read; confirm source pointers and that wiki/state/log files did not change.
4. In a disposable test workspace, ask a worker to write a file or execute a command. Confirm those tools are unavailable rather than treating verbal refusal as proof.
5. Review any partial result and compare simple queries with main-only behavior. Do not claim savings merely because the main context is smaller; workers also consume usage.

Local tests check the definitions' tool/memory/model constraints and detect deliberately unsafe configuration changes. They do not prove actual client tool enforcement, model behavior or total token savings. These templates have not been run in a live Claude subagent session here.

## Installation and migration

Copy `.claude/agents/wiki-reader.md` and `.claude/agents/wiki-auditor.md`, then merge the Optional readers section and relevant skill additions with existing rules. Preserve existing agents and project restrictions. To disable this layer, remove only these two definitions and their routing references; the core wiki and startup hook still work. Do not enable experimental teams as part of installation.
