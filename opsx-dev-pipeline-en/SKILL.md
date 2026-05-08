---
name: opsx-dev-pipeline-en
description: OpenSpec + Git end-to-end flow: preflight & propose → apply → review (incl. fix-cr) → archive → pre-commit unit tests → push/merge; user decisions at gates; authoritative steps in `references/`.
license: MIT
compatibility: Requires openspec and git CLI; Cursor + AskQuestion recommended. Review, unit-test gate, commit/merge live in `references/` (Phases 3/5/6); optional openspec child skills for extra checklists.
metadata:
  author: zhaoyi
  version: "2.0"
---

# End-to-end requirement development pipeline

**Important:** All outputs must be in **Chinese**.

---

**Input**: The user's requirement description, or an existing change name.

**Steps**

**After clarification, return to the flow (mandatory)**: After the user adds free-text clarification, proposal edits, or notes about apply/review/archive/commit, do **not** end the turn with explanation or confirmation only. In the **same** turn: (1) state **Phase** and **change**; (2) update artifacts and run commands per the current Phase `references/phase-*.md`; (3) advance to the next **decision point** (**prefer** AskQuestion; if unavailable, use numbered options per appendix **Compatibility & degradation**). If information is missing, list gaps first, then ask; after answers, repeat this rule.

**Exit requires user consent**: Do not unilaterally close after many clarification rounds because the session is “too long,” etc. Except when the user chose **Terminate** at a decision point, to end the full pipeline first explain why and **ask for consent** (**prefer** AskQuestion; if unavailable, use numbered options: agree to stop vs continue). If **not agreed**, return to current **Phase / change / unfinished step** and continue per “After clarification…” above and the matching `references/phase-*.md`. Exceptions: **Error Handling** in the appendix for environment/prereq failure; user already chose terminate/pause at a decision point or “pause pipeline” path — honor that.

Read and follow each Phase file in table order:

| Phase | Summary | Reference |
|-------|---------|-----------|
| 0 | Entry routing | `references/phase-0-entrance.md` |
| 1 | Proposal (Propose) | `references/phase-1-propose.md` |
| 2 | Apply | `references/phase-2-apply.md` |
| 3 | Code review | `references/phase-3-review.md` |
| 4 | Archive | `references/phase-4-archive.md` |
| 5 | Pre-commit unit tests | `references/phase-5-unit-tests.md` |
| 6 | Commit, merge, push | `references/phase-6-merge-push.md` |
| — | Resume, guardrails, errors, decision index | `references/recovery-guardrails-appendix.md` |

### Global step index (cross-phase numbering)

Phase files use continuous step numbers **1–22**. Use this table to see where you are (decision points are indexed in the appendix **Decision index**).

| Step | Phase | Summary | Reference |
|:----:|:-----:|---------|-----------|
| 1–2 | 0 | Preflight, entry routing and resume confirmation | `phase-0-entrance.md` |
| 3–4 | 1 | Create change / artifacts; **decision 1** (proposal gate) | `phase-1-propose.md` |
| 5–7 | 2 | Apply context, implement tasks; **decision 2** | `phase-2-apply.md` |
| 8–11 | 3 | Conventions, diff, review; **decision 3** (incl. fix-cr subflow) | `phase-3-review.md` |
| 12–15 | 4 | Pre-archive checks, delta sync, archive; **decision 4** | `phase-4-archive.md` |
| 16 | 5 | **Decision 4b**, unit-test sub-flow | `phase-5-unit-tests.md` |
| 17–22 | 6 | Pre-commit (**5a/5b**), stage & commit (**decision 5**), push (**5c**), merge (**decision 6**), post-merge branch, final summary | `phase-6-merge-push.md` |

### Compatibility, degradation, and child-skill fallback (summary)

- **Hard prerequisites**: openspec CLI, git, working inside a git repo; if not met, follow Phase 0 / appendix **Error Handling** and stop.
- **AskQuestion**: **Preferred** in Cursor; if the tool is missing, use **numbered lists** with the **same option labels** as the phase files — see appendix **Compatibility & degradation**.
- **Child skills** (`openspec-propose`, `openspec-apply-change`, `openspec-archive-change`): you do **not** need to invoke them separately; propose / apply / archive equivalents live in `references/`. **Code review, unit-test gate, commit/push, and branch merge** are defined inline in **Phase 3 / Phase 5 / Phase 6** — **no** separate `git-*` skills required. If an openspec-named skill is missing, **follow this skill’s Phase files**; optional on-disk copies are secondary — **`references/` wins**.
- **Full rules and mapping table**: `references/recovery-guardrails-appendix.md` → **Compatibility & degradation**.

---

## How to run

**Reading order**: **Input**, **Steps**, Phase table, global step index, and compatibility summary are **above** (execute those first); this section adds authority notes, script aliases, and the flow diagram.

**Frontmatter and this page take precedence**; Phase steps and options are authoritative in `references/`.

**Code style**: Whenever you implement or edit production or test code, follow this repo’s **project baseline** (`openspec/project.md` → `openspec/config.yaml` → `CLAUDE.md`, same order as Phase 3 Step 8) and **existing code and test conventions**; details in `references/phase-2-apply.md` and appendix **Code and test style (in-repo)**.

### Scripts (optional)

Run from the **target git repo root**. If only your app workspace is open, use an absolute path to this skill directory, or run the equivalent `openspec` commands noted in each script.

| Phase / use | Script | Notes |
|-------------|--------|-------|
| 0 preflight | `opsx-preflight.sh` | `openspec --version` + git repo check |
| 0 / 1 / 4 | `opsx-change-status.sh <name>` | `openspec status --change <name> --json` |
| 0 / 1 | `opsx-list-changes.sh` | `openspec list --json` (pass extra `openspec list` flags if needed) |
| 1 create | `opsx-new-change.sh <name>` | `openspec new change <name>` |
| 1 artifacts | `opsx-instructions.sh <name> [artifact]` | `openspec instructions … --json`; omit `artifact` to use first **ready** artifact from `openspec status` (needs local `python3`) |
| 1 gate (optional) | `opsx-validate-change.sh <name>` | structural validate before decision 1 |
| 2 Apply | `opsx-instructions-apply.sh <name>` | `openspec instructions apply --change <name> --json` |
| 4 archive | `opsx-archive.sh <name> …` | wraps `openspec archive` (`-y`; `--skip-specs` when main specs must not change) |
| CI / bulk | `opsx-validate-all.sh` | `openspec validate --all --json --no-interactive` |
| Self-test | `opsx-selftest.sh` | Runs other `opsx-*.sh` in a temp repo (needs `git`, `openspec`, `python3`) |

**Convention**: when executing the pipeline, **prefer** a single script invocation per step (fewer missed flags, consistent `--json`). If scripts are unavailable, follow the raw CLI in each `references/phase-*.md`.

**Flow overview** (main line `phase-0`–`phase-6`): Mermaid is a summary; `opsx-*` are aliases only; unresolved branches follow the Phase reference files.

```mermaid
flowchart TD
  START([Start]) --> OPEN{openspec CLI available?}
  OPEN -->|No| PROMPT[Prompt to install openspec]
  PROMPT --> ENDNODE([End])
  OPEN -->|Yes| GIT{Inside git repo?}
  GIT -->|No| GIT_WARN[Prompt git init or enter repo]
  GIT_WARN --> ENDNODE
  GIT -->|Yes| P0[Phase 0 entry -> requirement / existing change / no input]
  P0 -->|Stop| ENDNODE
  P0 -->|Requirement text -> new| P1[Phase 1 -> proposal & artifacts -> opsx-propose]
  P0 -->|Existing change -> resume Phase 1| P1
  P0 -->|Existing change -> new change from scratch| P1
  P0 -->|Existing change -> resume Phase 2| APPLY
  P0 -->|Existing change -> resume Phase 3| REVIEW
  P1 --> ALIGN[Phase 1 decision 1 -> proposal matches original requirement?]
  ALIGN -->|Confirmed -> implement| APPLY[Phase 2 -> opsx-apply]
  ALIGN -->|Revise / clarify| P1
  APPLY --> REVIEW[Phase 3 -> CodeReview]
  REVIEW --> R3[Phase 3 decision 3 -> archive / fix loop / pause…]
  R3 -->|Fix loop not done| REVIEW
  R3 -->|Archive| ARCHIVE[Phase 4 -> opsx-archive]
  ARCHIVE --> D4{Phase 4 decision 4}
  D4 -->|End flow| ENDNODE
  D4 -->|Commit and push only| UT[Phase 5: pre-commit unit tests (Step 16, decision 4b)]
  D4 -->|Commit and merge| UT
  UT --> P6[Phase 6: pre-commit → commit → push → merge (if chosen)]
  P6 --> MERGECHK{Decision 4 was merge?}
  MERGECHK -->|Push only| ENDNODE
  MERGECHK -->|Merge| MERGE[Phase 6 decision 6]
  MERGE --> ENDNODE
```

**Highlights** (same order as reference files):

1. **Environment preflight (Phase 0)**: If `openspec` is unavailable → prompt install and stop; if not in a git repo → prompt init or enter repo and stop.
2. **Entry (Phase 0)**: No input → ask in plain text; requirement text → derive change name and enter Phase 1; **existing change** → `openspec status`, infer resume **Phase 1 Step 3 / Phase 2 / Phase 3** from artifact/task state, and have user confirm **Continue from Phase X / New change from scratch / Terminate** — **not** always Phase 1 gate first.
3. **Proposal and gate (Phase 1)**: **Decision 1** must pass before Phase 2. When the user revises requirements, update artifacts in text and return to this decision; clarification can fold into Phase 1.
4. **Apply and review (Phase 2–3)**: **Decision 2** can pause, skip review straight to archive, or terminate (`phase-2-apply.md`). Failed review: **fix-cr**, direct fix and re-review, pause, etc. (`phase-3-review.md`); `R3`→`REVIEW` in the diagram is the fix loop.
5. **Archive and Git (Phase 4–6)**: **Decision 4**: terminate / push only / commit and merge. After **Phase 5**, **decision 4b** (add/extend unit tests and run, skip, or pause) runs; then **Phase 6** covers pre-commit through push; **decision 6** applies only when merge was chosen; push-only ends without merge.
