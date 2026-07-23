# Remove Preset Skills and Related Capabilities — Design

**Date:** 2026-07-23
**Status:** Approved

## Goal

Remove the following preset skills from the package and remove the product capabilities that depend specifically on them:

- `file-code-review`
- `git-code-review`
- `git-commit-push`
- `git-merge-branch`
- `opsx-analysis`
- `opsx-ci-triage`
- `opsx-clarify`
- `opsx-design`
- `opsx-health`
- `opsx-learn`
- `opsx-pr`
- `opsx-prototype`
- `opsx-verify`

After the removal, clean obsolete tests and verify the main package, packaged artifact, CLI initialization paths, and the remaining standalone pipeline tests.

## Decisions

1. Remove each skill completely, not merely from the default installation set.
2. Remove every same-named command template and asset registration.
3. Remove the optional features `prototype`, `opsx-pr`, and `opsx-ci-triage`.
4. Remove Phase 7 PR/CI delivery mode and its dedicated runtime, recovery, script, documentation, and test-pipeline behavior.
5. Do not provide backward compatibility for manifests containing the three removed optional feature values. Existing schema validation must reject them.
6. Do not modify the user's existing `.claude/settings.json` change.
7. Preserve historical design records where useful, but mark them as superseded rather than presenting them as current product behavior.

## Scope

### Template bundles and commands

Delete each matching directory under `templates/common/skills/`, including its `SKILL.md.hbs`, references, assets, and scripts. Delete each matching template under `templates/common/commands/`.

Remove the corresponding skill-bundle and command entries from `src/core/assets/manifest.ts`. The generic bundle-expansion and installation-plan algorithms remain unchanged.

### Feature configuration and manifest schema

Remove `prototype`, `opsx-pr`, and `opsx-ci-triage` from:

- `config/features.json`
- the `FeatureId` type and optional-feature constants
- CLI argument validation and interactive prompts
- the installed-manifest schema

A CLI invocation using a removed feature must fail with the existing invalid-feature error behavior and exit code 1. A stored manifest containing a removed feature must fail schema validation; no automatic migration or compatibility alias will be added.

### Main pipeline

Remove Phase 7 PR/CI delivery mode and artifacts dedicated to it, including:

- Phase 7 guidance;
- PR/CI decision and recovery rules;
- PR delivery runtime-state fields;
- dedicated delivery-resolution scripts;
- PR-mode acceptance scenarios in `test-pipeline`;
- references that delegate work to `opsx-pr` or `opsx-ci-triage`.

Remove all delegation and reuse instructions that point to the other deleted skills. Do not describe those capabilities as built in unless an independent implementation already exists. Shared files that also support retained behavior must be edited narrowly rather than deleted wholesale.

### User-facing documentation

Update current product documentation and generated tool overlays so that they no longer advertise or invoke removed skills. This includes:

- post-install notes in `config/tools.json`;
- Claude, Cursor, Codex, and Generic overlays;
- README skill tables, examples, diagrams, and scenario-selection guidance;
- roadmap sections that describe removed functionality as current or planned product behavior.

Historical specifications may remain, but must be clearly identified as superseded and excluded from checks for current-product references.

## Test Design

### Delete obsolete tests

Delete tests whose only subject no longer exists, including:

- the review-skill single-source guard;
- `opsx-learn` preflight execution scenarios;
- `opsx-prototype` optional-feature generation scenarios;
- template-content assertions for removed skills;
- the standalone PR-mode delivery scenario and helpers used only by that scenario.

Delete an entire test file only when no retained behavior remains in it.

### Update retained tests

Update the four-adapter initialization matrix to remove all expected paths for the deleted skills, bundle files, and commands.

Keep generic installation and uninstallation planning coverage. Replace fixtures named after removed assets with retained managed assets.

Update packaged-artifact coverage to verify both sides of the new contract:

1. retained templates are present and can be installed from the tarball;
2. the tarball and generated installation contain none of the 13 removed names.

Keep or add validation coverage proving that the CLI and manifest schema reject the three removed optional feature values.

Keep assertions that the retained pipeline stages are generated in the expected order after Phase 7 is removed.

## Existing Installation Behavior

The change does not add a new cleanup mechanism for arbitrary files already installed in downstream projects. Existing sync, upgrade, and uninstall behavior remains responsible for files it can identify as managed. User-modified or unknown legacy files must not be deleted through a new unconditional cleanup path.

New initialization, sync, and upgrade plans must never create the removed assets.

## Verification

Run the following main-project checks:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test
npm run init:smoke
npm run pack:check
```

Run initialization dry-runs for all supported adapters:

```bash
npm run dev -- init --tool claude --yes --dry-run
npm run dev -- init --tool cursor --yes --dry-run
npm run dev -- init --tool codex --yes --dry-run
npm run dev -- init --tool generic --yes --dry-run
```

Run the remaining standalone package tests:

```bash
npm --prefix test-pipeline run test
```

Verification succeeds when:

1. all applicable commands pass;
2. no adapter installation plan contains a removed skill or command;
3. retained core pipeline assets still generate correctly;
4. the npm tarball contains no removed template;
5. current source, configuration, tests, and product documentation contain no stale functional references;
6. any skipped or environment-blocked standalone test is reported explicitly rather than treated as passing.

## Non-Goals

- Replacing removed skills with new equivalents.
- Migrating old manifests automatically.
- Rewriting Git history.
- Deleting user-managed legacy files from downstream projects.
- Refactoring generic asset or installation-plan infrastructure unrelated to the removal.
