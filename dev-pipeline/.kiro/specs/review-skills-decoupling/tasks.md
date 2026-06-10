# Implementation Plan: Review Skills Decoupling

## Overview

This plan converts the design into incremental, file-scoped content-editing tasks plus extensions to the existing `vitest` integration suite. The work is Handlebars/Markdown template editing — there is no new TypeScript runtime logic. Tasks are ordered so the shared `references/convention-checklist.md` exists before the `SKILL.md.hbs` rewrites that point to it, and so test extensions land after the content they assert against.

Implementation language for the test edits is **TypeScript** (the existing `test/integration/*.test.ts` vitest suite). Template artifacts are **Handlebars (`.hbs`)** and static **Markdown**.

Per the design, this feature has no "Correctness Properties" section (template/configuration work), so there are no property-based test tasks. Verification uses the established example/snapshot-style integration assertions and a byte-identical guard test.

## Tasks

- [x] 1. Author the shared convention checklist reference (single source)
  - [x] 1.1 Create `templates/common/skills/git-code-review/references/convention-checklist.md`
    - Author the canonical stack-agnostic checklist as static Markdown (no Handlebars variables, so it is copied verbatim as `kind: 'static'`).
    - Include the mandatory sections: 规范来源解析 (Project_Baseline resolution order + record resolved baseline), 通用审查维度 (language-neutral dimension table), 严重程度判定 (severity table).
    - Mandatory sections MUST contain no programming language, framework, library, or company-specific identifier (`YzwResult`, `@Authority`, `PurWebContractPaymentBaseController`, `*BizService`) as a required convention.
    - Place all Java/Spring content inside a clearly-labeled `可选示例 ... 非强制` Optional_Example_Block gated on "only when the Project_Baseline identifies a matching stack."
    - Keep content in Chinese, consistent with existing skills.
    - This file is the authoring source of truth for the pair.
    - _Requirements: 4.1, 2.1, 2.2, 2.3, 2.4, 7.1_

  - [x] 1.2 Mirror the reference into `templates/common/skills/file-code-review/references/convention-checklist.md`
    - Create a byte-identical copy of the file authored in 1.1 (the `file-code-review` bundle cannot read the sibling bundle's directory, so each bundle needs its own copy).
    - Content MUST match 1.1 exactly to satisfy the drift guard.
    - _Requirements: 4.1, 5.3, 5.4_

- [x] 2. Rewrite the git-code-review skill template
  - [x] 2.1 Rewrite `templates/common/skills/git-code-review/SKILL.md.hbs`
    - Remove the inline 5.1–5.12 Java naming/annotation tables and the bottom "Convention Checklist (from openspec/project.md)" Java table from the body.
    - Rewrite the "Load project conventions" step to derive conventions from the Project_Baseline chain (`openspec/project.md` → `README.md` → `CLAUDE.md` → `AGENTS.md` → nearby architecture docs → generic fallback) rather than a fixed stack.
    - Add a `## 权威来源地图` section listing `references/convention-checklist.md` as the authoritative checklist source, mirroring the `opsx-verify` layout.
    - Do NOT inline the checklist body; only point to the reference (single-source).
    - Set the report `审查人` field to `{{toolName}}` and the commit-trailer examples to `Co-Authored-By: {{toolName}} <noreply@opsx-dev-pipeline.local>`; remove any `Claude Opus 4.8` literal.
    - Preserve existing workflow steps (scope selection, secret scanning, report saving to `openspec/review/`, full-report output, optional proposal flow), Chinese output, the baseline fallback chain text, and a `规范基准` disclosure line in the report template (record resolved baseline / "未找到项目基准" when none found).
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.4, 3.2, 3.4, 4.2, 4.4, 4.6, 5.5, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

- [x] 3. Rewrite the file-code-review skill template
  - [x] 3.1 Rewrite `templates/common/skills/file-code-review/SKILL.md.hbs`
    - Remove the inline 4.1–4.12 Java tables from the body; replace with a pointer to `references/convention-checklist.md`.
    - Rewrite the convention-loading step to derive conventions from the Project_Baseline chain (no git scope step — file/snippet review).
    - Add a `## 权威来源地图` section listing `references/convention-checklist.md`, mirroring the `opsx-*` layout.
    - Do NOT inline the checklist body (single-source).
    - Set the report `审查人` field to `{{toolName}}`; remove any `Claude Opus 4.8` literal.
    - Preserve existing workflow steps (convention loading, secret scanning, report saving, report output), Chinese output, baseline fallback chain text, and the `规范基准` disclosure line.
    - _Requirements: 1.2, 1.3, 1.5, 2.1, 2.4, 3.3, 3.4, 4.3, 4.5, 4.6, 5.5, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_

- [x] 4. Neutralize the git-commit-push identity strings
  - [x] 4.1 Edit `templates/common/skills/git-commit-push/SKILL.md.hbs`
    - Update both commit-message templates (single-line and heredoc) to use `Co-Authored-By: {{toolName}} <noreply@opsx-dev-pipeline.local>`.
    - Remove any `Claude Opus 4.8` literal model-version identity.
    - Change no other workflow step.
    - _Requirements: 3.1, 3.4, 7.3_

- [x] 5. Checkpoint - manual review of template content
  - Re-read the three rewritten `.hbs` files and the two reference copies to confirm mandatory sections are stack-agnostic, the `权威来源地图` points to the reference, and no `Claude Opus 4.8` literal remains. Ensure all tests pass, ask the user if questions arise.

- [x] 6. Extend integration tests for install/render compatibility and content guarantees
  - [x] 6.1 Extend `toolExpectations` in `test/integration/init-matrix.test.ts`
    - Add `<skillsDir>/git-code-review/references/convention-checklist.md` and `<skillsDir>/file-code-review/references/convention-checklist.md` to each tool's expected-file array (claude/cursor/codex/generic) so the matrix proves the reference is written under the resolved skill dir for all tools.
    - _Requirements: 5.1, 5.2_

  - [x] 6.2 Add decoupling + identity content assertions in `test/integration/init-matrix.test.ts`
    - After `runInit` for `claude`, read the rendered `git-code-review/SKILL.md` and `file-code-review/SKILL.md` and assert mandatory content does NOT contain `YzwResult`, `@Authority`, `PurWebContractPaymentBaseController`, `*BizService`, or `Claude Opus 4.8`.
    - Assert each `SKILL.md` contains a `权威来源地图` section and references `references/convention-checklist.md`.
    - Assert each `SKILL.md` instructs Chinese output and retains the baseline fallback chain text and the `规范基准` disclosure line.
    - Read rendered `git-commit-push/SKILL.md` and assert it contains no `Claude Opus 4.8` and renders the tool display name in the commit trailer.
    - Assert any retained Java content appears only under the optional-example marker (mandatory body is stack-agnostic).
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 4.2, 4.3, 4.4, 4.5, 5.5, 6.1, 6.2, 6.3, 7.1, 7.2_

  - [x] 6.3 Add packaged-artifact assertions in `test/integration/package-artifact.test.ts`
    - Add `.cursor/rules/git-code-review/references/convention-checklist.md` and `.cursor/rules/file-code-review/references/convention-checklist.md` to the post-install `pathExists` assertions, proving the reference survives `npm pack` + real install.
    - _Requirements: 5.3, 5.4_

  - [x] 6.4 Add the byte-identical single-source guard test
    - In the integration suite, read both `templates/.../git-code-review/references/convention-checklist.md` and `templates/.../file-code-review/references/convention-checklist.md` from source and assert byte-equality (guards against drift).
    - Assert neither review `SKILL.md.hbs` inlines the checklist body (mandatory checklist table headers appear only in the reference, not in the `.hbs`).
    - _Requirements: 4.6_

- [x] 7. Final checkpoint - verify build and tests
  - [x] 7.1 Run typecheck and the integration suite
    - Run `npm run build` (or the project's typecheck script) and `npm test` (`vitest run`, single-run mode — do not use watch mode).
    - Fix any failures introduced by the template edits or test extensions before completing.
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

## Notes

- This feature has no Correctness Properties section in the design (template/configuration work), so there are no property-based test tasks; verification is example/snapshot integration tests plus a byte-identical guard test.
- No `src/` changes are required — `expandBundle` recursion + `includeExtensions` already pick up the nested static `.md` reference, and `{{toolName}}`/`{{skillsDir}}` already exist in the render context.
- Task 1 must complete before tasks 2 and 3, since the rewritten `SKILL.md.hbs` files reference `references/convention-checklist.md`.
- Tasks are file-scoped: each leaf task edits/creates a single file, except the test-content tasks which extend specific existing test files.
- Each task references specific requirement clauses for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["6.1", "6.3", "6.4"] },
    { "id": 3, "tasks": ["6.2"] },
    { "id": 4, "tasks": ["7.1"] }
  ]
}
```
