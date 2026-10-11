# Selective Wiki UI

A Claude Code mod for a selective Markdown knowledge workspace. It provides continuation/freshness/history tabs, bounded local wiki/source search and previews, local refresh/toggle controls, and explicit research/audit/source-ingest/state-update actions using the user's current model.

Requires terminal Claude Code 2.1.287+ for normal mod loading. No npm install or build step. Load this directory with `claude --plugin-dir ./plugins/selective-wiki-ui`, or install from the repository's marketplace once and then use normal `claude`.

The target project needs `state.md` and `index.md`; canonical notes live under `wiki/`. This plugin does not bootstrap or overwrite project memory. The repository's Python hook and project instructions provide startup context and selective writing.

See [the complete guide](../../docs/mod.md) for installation, every command, bounds, tests and known verification limits. Licensed under the repository's [MIT license](../../LICENSE).
