# OpenSpec Knowledge Base

This directory stores reviewable project knowledge. Entries are atomic claims, sources are
reusable evidence records, sessions describe research activity, and `index.json` is the only
machine-readable discovery entrypoint for agents.

## Layout

- `entries/`: draft, confirmed, deprecated, and rejected knowledge entries.
- `sources/`: redacted evidence summaries and locators.
- `sessions/`: research narratives; do not keep entry drafts here.
- `_templates/`: authoring templates.
- `.schemas/`: JSON Schema contracts.
- `scripts/kb.mjs`: deterministic maintenance CLI.
- `index.json`: derived data; rebuild it instead of editing it.

## Controlled Tags

Every entry has exactly one domain tag. Feature tags are optional and limited to three.

- domain: `auth`, `payment`, `ui`, `data`, `infra`, `deployment`, `testing`
- feature: `api`, `jwt`, `oauth`, `wechat-pay`, `refund`, `checkout`, `cli`, `workflow`,
  `knowledge-base`, `openspec`, `proposal`, `archive`, `search`, `review`, `index`
- auto (generated only): `has-source`, `has-conflict`, `stale`, `needs-review`

Extend the controlled vocabulary through review before using a new tag. Do not manually add auto
tags to entry frontmatter.

## Review Rules

1. One entry states one proposition that a concrete source can prove or disprove.
2. A confirmed entry has at least one source and a reviewer.
3. High-confidence knowledge needs a code or test source. A conversation alone is insufficient.
4. Every entry has an owner. Owners review entries older than 90 days.
5. Replace changed conclusions with a new entry and reciprocal `supersedes` / `supersededBy` links.
6. Never store secrets, personal data, or unredacted customer data.
7. Commit entry and rebuilt `index.json` changes together.

## Commands

Run `node openspec/knowledge/scripts/kb.mjs help` for the complete interface. Mutating commands
preview by default and require `--write`; `rebuild` always regenerates the derived index.

