---
name: kb
description: Search and maintain the OpenSpec project knowledge base. Use when the user asks to find known facts, constraints, assumptions, questions, or decisions; capture an exploration result; review or reject knowledge; associate knowledge with a change; or rebuild the knowledge index.
---

# Knowledge Base

Use `openspec/knowledge/index.json` as the only discovery entrypoint. Read an entry Markdown file
only after selecting its ID from the index. Do not discover knowledge by scanning `entries/`.

Run deterministic operations through:

```bash
node openspec/knowledge/scripts/kb.mjs <command> [options]
```

## Search

Run `search` with the narrowest known `--change`, `--scope`, `--type`, `--status`, and `--tag`
filters. The default status is `confirmed`. Use `--status all` only when the user asks to inspect
draft or historical knowledge. Use `--json` when consuming results as an agent; never parse the
human terminal layout.

## Capture

Convert exactly one atomic proposition at a time. Split statements that contain independent
claims. A question has no answer yet; an assumption is a tentative answer. Attach an existing
source when available and use only controlled tags from `openspec/knowledge/README.md`.

1. Run `capture` without `--write` and show the preview, source gaps, and conflict candidates.
2. Ask the user to confirm the write.
3. Add `--write` only after explicit confirmation.

When handling `--from-explore <n>`, resolve the numbered candidate from the current exploration
response and pass its title and statement explicitly. Never invoke capture automatically from
explore mode.

## Review

Inspect the entry and every source before reviewing. Reject confirmation when the claim is not
atomic, contains unquantified vague wording, has no source, or violates the high-confidence source
rule. Run `review` without `--write`, ask for confirmation, and rerun with `--write`.

Use `--action merge --into KB-NNNN` when a new entry replaces an old conclusion. The command writes
both directions of the supersession link and deprecates the old entry. Use `--action conflict
--with KB-NNNN` for unresolved contradictory claims; never choose a winner automatically.

## Link And Rebuild

`link` changes only an entry's `relatedChanges`; it never modifies pipeline state. Preview and
confirm manual links. Phase 5 may run `link ... --write` only for knowledge IDs explicitly cited by
the archived proposal.

Run `rebuild` after manual Markdown edits. Treat validation failures as blocking and edit source
files rather than the derived index.

