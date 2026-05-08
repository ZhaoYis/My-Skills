**Pipeline interrupt and resume**

Many clarification rounds or a long chat are **not** an automatic reason to stop; ending the full flow without user agreement follows **Guardrails** → “Exit requires user consent”.

Whenever the user picks **Terminate pipeline** or **Pause pipeline** at a decision point, show:
- Change name, stopped phase, reason
- **Phase checklist** (`[x]` done / `[ ]` not done)
- **Resume**: Re-run this skill with the change name to continue from the breakpoint, or finish manually with `openspec-apply-change`, `git-code-review`, `openspec-archive-change`, `git-commit-push`, `git-merge-branch`

---

**Guardrails**

- This skill inlines core flows from child skills (`openspec-propose`, `openspec-apply-change`, `git-code-review`, `git-commit-push`, `git-merge-branch`) for continuity; if those skills change, update matching sections here.
- Every decision point must offer explicit options via AskQuestion; auto-run between decision points.
- **Proposal gate**: Do not enter Phase 2 without an explicit **Confirm proposal, start implementation** at decision 1; user edits go through conversation and artifact updates until confirm or terminate.
- For **free text** (requirements, proposal edits, custom commit message), ask in plain messages — not AskQuestion.
- **After clarification, return to the flow**: When the user sends **free text** tied to the pipeline (clarifications, proposal edits, implementation notes, review feedback, commit draft, etc.), the agent **must not** only answer or summarize and end the turn. In the **same** reply: state current **Phase** and **change**; run updates and commands per that Phase `references/phase-*.md`; land on the **next decision point** (call AskQuestion when required). If something is missing, list gaps and ask; after the user answers, repeat until the next decision or explicit terminate/pause.
- **Exit requires user consent**: Do not end the pipeline unilaterally with “session too long,” “too much context,” “let’s stop here,” etc. If the agent **must** end the whole pipeline (and the user did not already choose Terminate), explain why and **AskQuestion** for consent; **agreed** → show breakpoint info per “Pipeline interrupt and resume” then stop; **not agreed** → return to current **Phase / change / unfinished step** and continue per “After clarification…” and the current `phase-*.md`. **Exceptions**: **Error Handling** prereq failures (openspec missing, not a git repo); user already chose terminate/pause on a decision path — honor it.
- **Pause pipeline** options: show resume guidance, exit; user re-runs with change name to resume.
- Review fix loop: max **3** rounds, then force pause.
- Proposal edits: stop when aligned with the original requirement (no fixed cap); if still misaligned after many rounds, suggest pause/split and let user terminate or not.
- When coding, follow `pprod-code-auto-gen` if it applies to the project.
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
| `openspec/project.md` missing | Warn; use CLAUDE.md defaults |
| Change name collision | Ask reuse vs new name |
| Change does not exist | List changes; user picks |
| Nothing to review | Note it; jump to Phase 4 |
| Push failed | Offer pull --rebase + retry or terminate |
| Merge conflict | List files; abort / theirs / ours / manual |
| Cannot create review dir | Show error; report in chat only |
| Archive target exists | Append `-N` |
| openspec command failed or unexpected JSON | Show output; AskQuestion: retry / skip step / terminate |
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
| 5a | Commit | Behind / diverged | pull --rebase / ignore / terminate |
| 5b | Commit | Sensitive files | exclude / include / terminate |
| 5 | Commit | Commit message | confirm / edit (text) / cancel (exit) |
| 5c | Push | Push failed | pull --rebase / terminate |
| 6 | Merge | Target + strategy | branch list + strategy |
| 6a | Merge | Conflict | abort / theirs / ours / manual |
| 6b | Merge | After merge | keep source / delete source |

> **Note**: Suffix letters mark conditional decision points; 3a can repeat each fix round.
