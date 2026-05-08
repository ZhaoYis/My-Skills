---
name: phase-5-unit-tests
description: Global step 16, decision 4b (add/run unit tests or skip). Then phase-6-merge-push.md step 17 (pre-commit checks).
when: After decision 4 in phase-4-archive.md (“push only” or “commit and merge”) and before Step 17 in phase-6-merge-push.md.
compatibility: Project must expose a runnable unit-test command; decisions via AskQuestion or appendix numbered options.
---

## Phase 5: Pre-commit unit tests (Step 16)

---

## 16.1 Pick the test command

Use the **project baseline** (`openspec/project.md` or `openspec/config.yaml`, else `CLAUDE.md`), repo conventions (`package.json`, `pom.xml`, `pyproject.toml`, `go.mod`, `Cargo.toml`, …) to suggest **unit-test commands** (e.g. `mvn test`, `npm test`, `pytest`, `go test ./...`, `cargo test`). If ambiguous, list **2–3 candidates** and ask the user to pick (AskQuestion or plain text). The user may override with their usual command.

---

## 16.2 [Decision 4b] Add or extend unit tests?

**AskQuestion** (or numbered options per `recovery-guardrails-appendix.md` → **Compatibility & degradation**).

- `Yes — add/update tests and run until green` — run **sub-flow A** below
- `No — skip unit-test step` — log the choice (note in final summary), go to **Step 17** in `phase-6-merge-push.md`
- `Pause pipeline` — show resume guidance (resume at **Step 16** / this file), exit

---

## Sub-flow A (when “Yes”)

1. Scope tests against **Phase 3** (`phase-3-review.md`) and current `git diff`; if a project-specific skill applies (see appendix pprod), follow its test layout/style.
2. Implement or edit **automated unit tests** only (no manual E2E unless the project treats them as the same command).
3. Run the command from **16.1** (extra flags per **project baseline** when documented in `project.md` / `config.yaml`).
4. **On failure**: short recap, **AskQuestion**: `Fix and re-run` / `Terminate pipeline` (re-run from sub-flow step 3 after fixes).
5. **On success**: continue to **Step 17** in `phase-6-merge-push.md`.

---

## Rules

- Do **not** skip **decision 4b** without asking. If scope changes after “No”, re-enter **Step 16** (this file) as needed.
- Guardrail line item: `recovery-guardrails-appendix.md` → **Guardrails** (pre-commit unit tests).
