# Contributing

Explain the concrete memory or startup failure a change fixes. Keep instructions short and sources attributable. Prefer targeted retrieval and existing-note updates to broad reads or more automatic note creation. Do not include personal transcripts, credentials or private project data in examples.

Before submitting:

```bash
python3 scripts/check_memory.py
python3 -m unittest discover -s tests -v
```

For hook changes, check startup/resume/clear visibility, silent compact behavior, missing state and bounded output. A local test does not establish actual client rendering; disclose whether you checked Claude Code itself. For instruction changes, describe a realistic before/after workflow and any trade-off rather than claiming guarantees from prompt wording.

Python helpers use only the standard library. Preserve that property unless a dependency has a clear, discussed benefit. Keep fictional examples explicitly labeled. Submit small, independently reviewable changes.

For mod changes, also run `claude plugin validate .`, `claude plugin validate ./plugins/selective-wiki-ui` and `claude plugin test ./plugins/selective-wiki-ui` with a supported Claude release. Tests use the native mocked runner, not a paid model. Preserve bounded local reads, explicit user initiation for model actions, the main writer rule and the rest of the host's UI. Disclose whether live rendering and actual model/worker execution were checked; native element tests do not prove those behaviors. See [the mod guide](docs/mod.md).
