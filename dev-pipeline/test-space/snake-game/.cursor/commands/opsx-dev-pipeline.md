---
name: "OPSX: Pipeline"
description: Drive the full OpenSpec + Git development pipeline (Phase 0-6)
allowed-tools: Bash(openspec:*), AskUserQuestion
category: Workflow
tags: [workflow, experimental]
---

# opsx-dev-pipeline

Use this command as the entrypoint for the bundled `opsx-dev-pipeline` skill.

## Intent

Drive the full OpenSpec + Git development pipeline through the installed skill at:

- `.cursor/rules/opsx-dev-pipeline/SKILL.md`

## Flow

Load and follow the `opsx-dev-pipeline` skill. It covers Phase0–6: preflight → propose → apply → review → unit tests → archive → merge & push.
