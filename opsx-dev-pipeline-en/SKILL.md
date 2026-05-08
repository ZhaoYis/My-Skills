---
name: opsx-dev-pipeline-en
description: End-to-end requirement-driven development pipeline — openspec + git preflight (Phase 0), resume Phase 1/2/3 or new proposal by entry type (opsx-propose), align proposal with requirements gate, apply (opsx-apply), review-and-fix loop (incl. fix-cr subflow), archive (opsx-archive), then push-only or push-and-merge per decision 4. User decisions at key points.
license: MIT
compatibility: Requires openspec CLI and git CLI. Strongly recommended in Cursor — AskQuestion tool. Optional child skills: `openspec-propose`, `openspec-apply-change`, `openspec-archive-change` for extra on-disk notes; code review, commit/push, and merge are fully specified in this skill’s `references/` (Phase 3 & 5).
metadata:
  author: zhaoyi
  version: "2.0"
---

# End-to-end requirement development pipeline

## How to run

**Frontmatter and this page take precedence**; Phase steps and options are authoritative in `references/`.

### Scripts (optional speed-up)

Run from the **target git repo root**. Scripts for this skill live under `opsx-dev-pipeline-en/scripts/` (independent from the Chinese `opsx-dev-pipeline` copy). If only your app workspace is open, use an absolute path to this skill directory, or run the equivalent `openspec` commands noted in each script.

| Phase / use | Script | Notes |
|-------------|--------|------|
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

**Flow overview** (main line `phase-0`–`phase-5`): Mermaid is a summary; `opsx-*` are aliases only; unresolved branches follow the Phase reference files.

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
  D4 -->|Commit and push only| PUSH[Phase 5 -> commit + push]
  PUSH --> ENDNODE
  D4 -->|Commit and merge| PUSHM[Phase 5 -> commit + push]
  PUSHM --> MERGE[Phase 5 decision 6 -> merge to target branch]
  MERGE --> ENDNODE
```

**Highlights** (same order as reference files):

1. **Environment preflight (Phase 0)**: If `openspec` is unavailable → prompt install and stop; if not in a git repo → prompt init or enter repo and stop.
2. **Entry (Phase 0)**: No input → ask in plain text; requirement text → derive change name and enter Phase 1; **existing change** → `openspec status`, infer resume **Phase 1 Step 3 / Phase 2 / Phase 3** from artifact/task state, and have user confirm **Continue from Phase X / New change from scratch / Terminate** — **not** always Phase 1 gate first.
3. **Proposal and gate (Phase 1)**: **Decision 1** must pass before Phase 2. When the user revises requirements, update artifacts in text and return to this decision; clarification can fold into Phase 1.
4. **Apply and review (Phase 2–3)**: **Decision 2** can pause, skip review straight to archive, or terminate (`phase-2-apply.md`). Failed review: **fix-cr**, direct fix and re-review, pause, etc. (`phase-3-review.md`); `R3`→`REVIEW` in the diagram is the fix loop.
5. **Archive and Git (Phase 4–5)**: **Decision 4**: terminate / push only / commit and merge. Choosing commit-and-merge surfaces **decision 6**; push-only ends after push.

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
| 5 | Commit, merge, push | `references/phase-5-merge-push.md` |
| — | Resume, guardrails, errors, decision index | `references/recovery-guardrails-appendix.md` |

### Global step index (cross-phase numbering)

Phase files use continuous step numbers **1–21**. Use this table to see where you are (decision points are indexed in the appendix **Decision index**).

| Step | Phase | Summary | Reference |
|:----:|:-----:|---------|-----------|
| 1–2 | 0 | Preflight, entry routing and resume confirmation | `phase-0-entrance.md` |
| 3–4 | 1 | Create change / artifacts; **decision 1** (proposal gate) | `phase-1-propose.md` |
| 5–7 | 2 | Apply context, implement tasks; **decision 2** | `phase-2-apply.md` |
| 8–11 | 3 | Conventions, diff, review; **decision 3** (incl. fix-cr subflow) | `phase-3-review.md` |
| 12–15 | 4 | Pre-archive checks, delta sync, archive; **decision 4** | `phase-4-archive.md` |
| 16–21 | 5 | Pre-commit, stage & commit (**decision 5**), push, merge (**decision 6**), post-merge branch, final summary | `phase-5-merge-push.md` |

### Compatibility, degradation, and child-skill fallback (summary)

- **Hard prerequisites**: openspec CLI, git, working inside a git repo; if not met, follow Phase 0 / appendix **Error Handling** and stop.
- **AskQuestion**: **Preferred** in Cursor; if the tool is missing, use **numbered lists** with the **same option labels** as the phase files — see appendix **Compatibility & degradation**.
- **Child skills** (`openspec-propose`, `openspec-apply-change`, `openspec-archive-change`): you do **not** need to invoke them separately; propose / apply / archive equivalents live in `references/`. **Code review, commit/push, and branch merge** are defined inline in **Phase 3 / Phase 5** — **no** separate `git-*` skills required. If an openspec-named skill is missing, **follow this skill’s Phase files**; optional on-disk copies are secondary — **`references/` wins**.
- **Full rules and mapping table**: `references/recovery-guardrails-appendix.md` → **Compatibility & degradation**.
