# Requirements Document

## Introduction

`opsx-dev-pipeline` is a CLI that scaffolds AI dev-workflow skill/command templates. Its core design principle is that every skill must be technology-stack-agnostic ("工具/语言/领域无关") and follow single-source governance ("不写死任何技术栈，命令一律按项目基准解析"). The `opsx-*` skills already follow this principle and use a structured layout of `references/` and `assets/` directories with an explicit "权威来源地图".

Four "flat" review/git skill templates do not yet follow this principle. This feature brings two of them into compliance and removes duplicated content across the review pair:

- **P0 — Hardcoded tech stack.** `git-code-review/SKILL.md.hbs` and `file-code-review/SKILL.md.hbs` hardcode a specific Java enterprise stack (Java 8, Spring Boot, MyBatis-Plus, MapStruct, Lombok) and company-specific identifiers (`YzwResult`, `@Authority`, `PurWebContractPaymentBaseController`, `*BizService` naming tables). These review skills must instead derive conventions dynamically from the project baseline. Any Java-specific tables must be demoted to clearly-labeled optional examples or removed. Hardcoded model/author identity strings ("Co-Authored-By: Claude Opus 4.8", "审查人: Claude Opus 4.8") in `git-code-review`, `file-code-review`, and `git-commit-push` must be made tool/model-neutral.
- **P2 — Duplicated convention content.** The 4.x/5.x convention-checklist blocks are duplicated nearly verbatim between `git-code-review` and `file-code-review`. The shared convention/review checklist must be extracted into a shared reference file so there is a single source, consistent with the existing "权威来源地图 / references / assets" structure.

These templates are Handlebars (`.hbs`) files under `templates/common/skills/`. Generated skill content stays in Chinese, consistent with existing skills. The CLI already registers all four skills as `bundle` assets that expand their source directory recursively, so newly added reference files placed inside a skill's bundle directory are picked up by the install plan and manifest automatically.

### Out of Scope

- Unrelated repo-hygiene items (e.g., `.DS_Store` removal, stray `*.tgz` tarballs).
- `doctor` link-integrity checks.
- The `git-merge-branch` skill (no hardcoded stack or duplicated checklist to address under P0/P2).
- Changes to the `opsx-*` skills, which already comply.

## Glossary

- **Review_Skill**: Either of the two flat single-file skill templates being decoupled: `git-code-review/SKILL.md.hbs` and `file-code-review/SKILL.md.hbs`.
- **Git_Code_Review_Skill**: The template `templates/common/skills/git-code-review/SKILL.md.hbs`.
- **File_Code_Review_Skill**: The template `templates/common/skills/file-code-review/SKILL.md.hbs`.
- **Git_Commit_Push_Skill**: The template `templates/common/skills/git-commit-push/SKILL.md.hbs`.
- **Convention_Checklist_Reference**: The shared reference file extracted from the duplicated convention/review checklist content, stored under each Review_Skill's bundle directory at `references/convention-checklist.md`.
- **Project_Baseline**: The ordered set of project convention sources a Review_Skill resolves at review time: `openspec/project.md` as primary, then the fallback chain `README.md` → `CLAUDE.md` → `AGENTS.md` → nearby architecture documents.
- **Stack_Agnostic_Content**: Skill instruction text that contains no hardcoded programming language, framework, library, or company-specific identifier as a mandatory convention.
- **Optional_Example_Block**: A clearly-labeled, non-mandatory illustrative section presenting a specific technology stack as an example rather than a required convention.
- **Identity_String**: A literal author or reviewer attribution value embedded in skill output (e.g., commit trailer attribution, review report "审查人" field).
- **Install_Plan**: The CLI structure produced by `buildInstallPlan` that enumerates files to install for selected assets.
- **Asset_Manifest**: The asset registry in `src/core/assets/manifest.ts` that defines each skill bundle.
- **Render_Flow**: The CLI install/sync/upgrade pipeline that renders Handlebars templates and writes managed files.

## Requirements

### Requirement 1: Remove hardcoded technology stack from review skills

**User Story:** As a maintainer of `opsx-dev-pipeline`, I want the review skills to be free of hardcoded technology stacks, so that they comply with the project's stack-agnostic design principle and work for any repository.

#### Acceptance Criteria

1. THE Git_Code_Review_Skill SHALL present its mandatory convention-review instructions as Stack_Agnostic_Content.
2. THE File_Code_Review_Skill SHALL present its mandatory convention-review instructions as Stack_Agnostic_Content.
3. WHERE a Review_Skill describes how to obtain review conventions, THE Review_Skill SHALL instruct the agent to derive conventions from the Project_Baseline rather than from any fixed technology stack.
4. THE Git_Code_Review_Skill SHALL contain no company-specific identifier (`YzwResult`, `@Authority`, `PurWebContractPaymentBaseController`, `*BizService`) as a mandatory convention.
5. THE File_Code_Review_Skill SHALL contain no company-specific identifier (`YzwResult`, `@Authority`, `PurWebContractPaymentBaseController`, `*BizService`) as a mandatory convention.

### Requirement 2: Demote Java-specific tables to optional examples

**User Story:** As a developer using a non-Java repository, I want any Java-specific convention tables to appear only as clearly-labeled optional examples, so that the review skill does not impose conventions that do not apply to my project.

#### Acceptance Criteria

1. WHERE a Review_Skill retains a Java-specific naming, annotation, or stack-compliance table, THE Review_Skill SHALL present that table inside an Optional_Example_Block labeled as a non-mandatory example.
2. WHERE a Java-specific table is retained as an Optional_Example_Block, THE Review_Skill SHALL state that the example applies only when the Project_Baseline identifies a matching technology stack.
3. WHERE a Java-specific table provides no stack-agnostic value, THE Review_Skill SHALL omit that table.
4. THE Review_Skill SHALL NOT present any Optional_Example_Block as a required convention check. (Negative form is required here because the constraint is the explicit absence of a mandatory designation.)

### Requirement 3: Make author and reviewer identity strings tool/model-neutral

**User Story:** As a maintainer, I want author and reviewer attribution to be tool/model-neutral, so that generated artifacts do not embed a specific AI model identity.

#### Acceptance Criteria

1. THE Git_Commit_Push_Skill SHALL render commit attribution using a tool/model-neutral Identity_String.
2. THE Git_Code_Review_Skill SHALL render the review report reviewer field using a tool/model-neutral Identity_String.
3. THE File_Code_Review_Skill SHALL render the review report reviewer field using a tool/model-neutral Identity_String.
4. THE Git_Commit_Push_Skill, Git_Code_Review_Skill, and File_Code_Review_Skill SHALL contain no literal model-version identity value (for example "Claude Opus 4.8").

### Requirement 4: Extract shared convention checklist into a single-source reference

**User Story:** As a maintainer, I want the duplicated convention/review checklist to live in one shared reference file, so that the review pair has a single source of truth consistent with the project's references/assets governance.

#### Acceptance Criteria

1. THE Convention_Checklist_Reference SHALL contain the shared convention/review checklist content as Stack_Agnostic_Content.
2. WHEN the shared convention/review checklist is needed, THE Git_Code_Review_Skill SHALL reference the Convention_Checklist_Reference instead of inlining the checklist content.
3. WHEN the shared convention/review checklist is needed, THE File_Code_Review_Skill SHALL reference the Convention_Checklist_Reference instead of inlining the checklist content.
4. THE Git_Code_Review_Skill SHALL list the Convention_Checklist_Reference in a "权威来源地图" (authoritative source map) section consistent with the structure used by the `opsx-*` skills.
5. THE File_Code_Review_Skill SHALL list the Convention_Checklist_Reference in a "权威来源地图" (authoritative source map) section consistent with the structure used by the `opsx-*` skills.
6. THE Convention_Checklist_Reference SHALL be the only location that defines the shared convention/review checklist content across the Review_Skill pair.

### Requirement 5: Preserve install, manifest, and render compatibility

**User Story:** As a CLI user, I want the decoupled skills and their new reference files to install correctly through the existing pipeline, so that initialization, sync, and upgrade continue to work without manual steps.

#### Acceptance Criteria

1. WHEN the CLI builds the Install_Plan for a Review_Skill bundle, THE Install_Plan SHALL include the Convention_Checklist_Reference for that skill.
2. WHEN the CLI renders a Review_Skill bundle, THE Render_Flow SHALL write the Convention_Checklist_Reference to the resolved skill directory.
3. THE Convention_Checklist_Reference SHALL use a file extension already included by the Review_Skill bundle definition in the Asset_Manifest.
4. THE Asset_Manifest SHALL register the Review_Skill bundle such that the Convention_Checklist_Reference is discovered without adding a separate per-file asset entry.
5. WHEN a Review_Skill bundle is installed, THE Render_Flow SHALL produce skill output whose mandatory instructions contain no hardcoded technology stack.

### Requirement 6: Provide graceful baseline fallback

**User Story:** As a developer working in a repository without `openspec/project.md`, I want the review skill to fall back to other convention sources and disclose which baseline it used, so that the review still runs and its basis is transparent.

#### Acceptance Criteria

1. WHILE `openspec/project.md` is present, THE Review_Skill SHALL use `openspec/project.md` as the primary Project_Baseline.
2. IF `openspec/project.md` is absent, THEN THE Review_Skill SHALL resolve the Project_Baseline from the fallback chain `README.md` → `CLAUDE.md` → `AGENTS.md` → nearby architecture documents.
3. THE Review_Skill SHALL record the resolved Project_Baseline source in the review report.
4. IF no Project_Baseline source is found, THEN THE Review_Skill SHALL continue the review using generic conventions and record in the review report that no project baseline was found.

### Requirement 7: Preserve Chinese output and skill behavior

**User Story:** As an existing user of these skills, I want the decoupled skills to keep producing Chinese review reports and the same review workflow, so that the change is non-disruptive.

#### Acceptance Criteria

1. THE Review_Skill SHALL continue to instruct that review report output is produced in Chinese.
2. THE Review_Skill SHALL retain its existing review workflow steps (convention loading, secret scanning, report saving, and report output) other than the convention-source and identity changes required by this feature.
3. THE Git_Commit_Push_Skill SHALL retain its existing commit-and-push workflow steps other than the Identity_String change required by this feature.
