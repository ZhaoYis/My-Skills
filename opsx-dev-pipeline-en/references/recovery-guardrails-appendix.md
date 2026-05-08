**Pipeline interrupt and resume**

Many clarification rounds or a long chat are **not** an automatic reason to stop; ending the full flow without user agreement follows **Guardrails** → “Exit requires user consent”.

Whenever the user picks **Terminate pipeline** or **Pause pipeline** at a decision point, show:
- Change name, stopped phase, reason
- **Phase checklist** (`[x]` done / `[ ]` not done)
- **Resume**: Re-run this skill with the change name; or finish manually using **Phase 3** (`phase-3-review.md`), **Phase 4** (`phase-4-archive.md`), **Phase 5** (`phase-5-unit-tests.md`), **Phase 6** (`phase-6-merge-push.md`) Git steps and decision flows; for openspec, follow **Phase 1 / 2 / 4** and the equivalent `openspec` CLI.

---

**Compatibility & degradation**

### AskQuestion unavailable

When **AskQuestion is not available** (non-Cursor or tool missing): at each decision point, list **numbered options** using the **exact same option labels** as the current `phase-*.md`. Ask the user to reply with the **number** or **paste the option text**; map the reply to the same next step as AskQuestion would. Scenarios that require **free text** (requirements, proposal edits, custom commit messages) stay in plain chat — no numbered decision list.  
Where **Error Handling** says to use AskQuestion, use the **same semantics** with **numbered options** + wait for the user’s choice.

### Child-skill fallback mapping

Do **not** require loading or invoking these child skills separately. If a child skill is missing from the catalog or invocations fail, **run the equivalent flow in this skill** (authoritative steps are always in `references/phase-*.md`):

| Child skill | Equivalent in this skill |
|-------------|--------------------------|
| `openspec-propose` | Phase 1, `phase-1-propose.md` (steps 3–4) |
| `openspec-apply-change` | Phase 2, `phase-2-apply.md` (steps 5–7) |
| `openspec-archive-change` | Phase 4, `phase-4-archive.md` (steps 12–15) |

**Git (review / commit / merge)**: no separate `git-*` skills — use **Phase 3** (review + report), **Phase 5** (pre-commit unit tests), **Phase 6** (stage, commit, push, merge, conflicts).

For the Phase 3 **fix-cr** subflow, “invoke `openspec-propose` / `openspec-apply-change`” means: run the matching **Phase 1 / Phase 2** sections here using the fix change name — no external skill load.

### Openspec / Git versions

This pipeline does **not** pin openspec minor versions. If CLI subcommands or JSON fields differ from examples, follow actual `openspec --help` and command output. Project metadata may live in **`openspec/project.md`** (legacy / coexistent) or **`openspec/config.yaml`** (common in newer installs) — follow what the repo has, then **Error Handling**.

### Project-specific skill (pprod)

`pprod-code-auto-gen`: follow only when the repo or user clearly indicates a pprod stack; otherwise ignore.

---

**Guardrails**

- **Phase 3 / Phase 5 / Phase 6** inline full code review, pre-commit unit tests, commit/push, and merge flows. **Openspec** equivalents sit in **Phase 1 / 2 / 4** (`openspec-propose`, `openspec-apply-change`, `openspec-archive-change`). Keep `references/` in sync if standalone skills change. At **runtime** rely on this skill’s Phase docs and **Child-skill fallback mapping** only — **no** extra Git review/commit/merge packages.
- Every decision point must expose **explicit paths**; **prefer** AskQuestion; if unavailable, use **numbered lists** per **AskQuestion unavailable**. Auto-run non-decision steps between decision points.
- **Proposal gate**: Do not enter Phase 2 without an explicit **Confirm proposal, start implementation** at decision 1; user edits go through conversation and artifact updates until confirm or terminate.
- For **free text** (requirements, proposal edits, custom commit message), ask in plain messages — not AskQuestion.
- **After clarification, return to the flow**: When the user sends **free text** tied to the pipeline (clarifications, proposal edits, implementation notes, review feedback, commit draft, etc.), the agent **must not** only answer or summarize and end the turn. In the **same** reply: state current **Phase** and **change**; run updates and commands per that Phase `references/phase-*.md`; land on the **next decision point** (**prefer** AskQuestion; if unavailable, **numbered options** per **Compatibility & degradation**). If something is missing, list gaps and ask; after the user answers, repeat until the next decision or explicit terminate/pause.
- **Exit requires user consent**: Do not end the pipeline unilaterally with “session too long,” “too much context,” “let’s stop here,” etc. If the agent **must** end the whole pipeline (and the user did not already choose Terminate), explain why and ask for consent (**prefer** AskQuestion; if unavailable, **numbered options**: agree to stop vs continue); **agreed** → show breakpoint info per “Pipeline interrupt and resume” then stop; **not agreed** → return to current **Phase / change / unfinished step** and continue per “After clarification…” and the current `phase-*.md`. **Exceptions**: **Error Handling** prereq failures (openspec missing, not a git repo); user already chose terminate/pause on a decision path — honor it.
- **Pause pipeline** options: show resume guidance, exit; user re-runs with change name to resume.
- Review fix loop: max **3** rounds, then force pause.
- Proposal edits: stop when aligned with the original requirement (no fixed cap); if still misaligned after many rounds, suggest pause/split and let user terminate or not.
- When coding: if **Project-specific skill (pprod)** applies, follow `pprod-code-auto-gen`; otherwise follow normal repo conventions.
- **Pre-commit unit tests (Phase 5 Step 16 / decision 4b)**: After decision 4 chooses a commit/push path, always ask whether to add/extend unit tests; never skip this confirmation silently (AskQuestion or numbered options). Full procedure: `references/phase-5-unit-tests.md`.
- Always include openspec-related files in commits.
- Commit messages: conventional commits + `Co-Authored-By`.
- After merge, check out the source branch again unless the user chose to delete it.
- Warn and confirm on sensitive files.
- Do not use `--no-verify` or `--force` unless the user explicitly asks.
- Final summary reflects the path taken; skipped phases marked **skipped**.
- Multi-round review reports use `-round-N` to avoid overwrite.

**Error Handling**

| Situation | Action |
|-----------|--------|
| openspec CLI unavailable | Prompt install; exit |
| Not in a git repo | Prompt init; exit |
| Both `openspec/project.md` and `openspec/config.yaml` missing | Warn; use CLAUDE.md defaults |
| Change name collision | Ask reuse vs new name |
| Change does not exist | List changes; user picks |
| Nothing to review | Note it; jump to Phase 4 |
| Push failed | Offer pull --rebase + retry or terminate |
| Merge conflict | List files; abort / theirs / ours / manual |
| Cannot create review dir | Show error; report in chat only |
| Archive target exists | Prefer `openspec archive` / `opsx-dev-pipeline-en/scripts/opsx-archive.sh` (CLI handles naming); with manual `mv`, append `-N` |
| openspec command failed or unexpected JSON | Show output; ask (**prefer** AskQuestion; else numbered options): retry / skip step / terminate |
| openspec hangs (> ~30s) | Kill; suggest network/config; retry or terminate |

**Decision index**

| # | Phase | What | Typical options |
|---|-------|------|-----------------|
| 0 | Entry | Resume existing change | Continue from inferred phase / new change / terminate |
| 1 | Propose | Confirm proposal (Apply gate) | Start implementation / revise in dialog / terminate |
| 1a | Propose | Name collision | Continue on existing / new name |
| 2a | Apply | state=blocked | Back to Phase 1 / terminate |
| 2b | Apply | Task blocked | More detail / skip task / terminate |
| 2 | Apply | Implementation done | Review / pause / skip review / terminate |
| 3 | Review | Review outcome | Fix proposal / direct fix / pause / ignore / terminate |
| 3a | Review subflow | Fix proposal confirm | Confirm fix / edit / abandon (cleanup change) |
| 4a | Archive | Unfinished work | Archive anyway / back to apply / terminate |
| 4 | Archive | After archive | commit+merge / push only / terminate |
| 4b | Phase 5 | Pre-commit unit tests (Step 16) | yes (write + run green) / no (skip) / pause |
| 5a | Commit | Behind / diverged | pull --rebase / ignore / terminate |
| 5b | Commit | Sensitive files | exclude / include / terminate |
| 5 | Commit | Commit message | confirm / edit (text) / cancel (exit) |
| 5c | Push | Push failed | pull --rebase / terminate |
| 6 | Merge | Target + strategy | branch list + strategy |
| 6a | Merge | Conflict | abort / theirs / ours / manual |
| 6b | Merge | After merge | keep source / delete source |

> **Note**: Suffix letters mark conditional decision points; 3a can repeat each fix round. **4b** runs after decision 4 chooses a commit/push path and before **Phase 6** Step 17 (pre-commit checks); full procedure: `references/phase-5-unit-tests.md`; if paused, resume at Phase 5 **Step 16**.
