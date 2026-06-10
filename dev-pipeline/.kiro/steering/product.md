# Product

`opsx-dev-pipeline` is a CLI that initializes AI development workflow templates in a project. Based on the AI tool the user selects, it generates the matching skills, commands, rules, and prompts so teams can adopt a consistent, OpenSpec-driven development pipeline.

## What it does

- Scaffolds tool-specific assets into a target project (skills, commands, docs, base files).
- Supports multiple AI tools via adapters: Claude Code (`claude`, default), Cursor (`cursor`), Codex (`codex`), and a tool-agnostic `generic` layout.
- Tracks everything it writes in a manifest so files can be re-rendered (`sync`), extended (`upgrade`), removed (`uninstall`), and health-checked (`doctor`).
- Seeds a `.knowledge/` skeleton for progressive knowledge capture, with health scoring and stale/broken-link checks.
- Ships optional, opt-in features (`prototype`, `structural-analysis-hint`) that degrade gracefully when disabled.

## Key commands (end-user)

- `init` — install templates into the current directory.
- `sync` — re-render only files already tracked in the manifest.
- `upgrade` — sync plus adopt newly added skills/commands and knowledge skeleton.
- `uninstall` — remove managed files (optionally keep `.knowledge`).
- `doctor` — inspect manifest and `.knowledge/` health, with a 0–100 score and upgrade hints.
- `list-tools` — list supported AI tool adapters.

## Design principles

- Single-source governance: the pipeline skill is the authority on when design/verify gates are required.
- Knowledge-first: tasks should check `.knowledge/` before starting; absence is a no-op, never an error.
- Non-destructive by default: append rather than overwrite; respect `--dry-run` and conflict prompts.
