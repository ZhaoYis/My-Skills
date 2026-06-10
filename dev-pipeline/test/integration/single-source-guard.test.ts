import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

/**
 * Single-source guard for the shared convention checklist (Requirement 4.6).
 *
 * The convention checklist is intentionally duplicated as two byte-identical
 * physical copies (one per review-skill bundle) because `expandBundle` only
 * walks a single bundle source root and cannot reach a sibling bundle. These
 * guards enforce the "single logical source" contract:
 *   1. The two physical copies never drift (byte-identical).
 *   2. Neither review `SKILL.md.hbs` inlines the checklist body — the mandatory
 *      checklist table headers live only in the reference file.
 */

const SKILLS_ROOT = path.join(PACKAGE_ROOT, 'templates', 'common', 'skills');

const GIT_REVIEW_REFERENCE = path.join(
  SKILLS_ROOT,
  'git-code-review',
  'references',
  'convention-checklist.md'
);
const FILE_REVIEW_REFERENCE = path.join(
  SKILLS_ROOT,
  'file-code-review',
  'references',
  'convention-checklist.md'
);

const GIT_REVIEW_SKILL = path.join(SKILLS_ROOT, 'git-code-review', 'SKILL.md.hbs');
const FILE_REVIEW_SKILL = path.join(SKILLS_ROOT, 'file-code-review', 'SKILL.md.hbs');

// Mandatory checklist table header rows that must live only in the reference.
const MANDATORY_TABLE_HEADERS = ['| 维度 | 检查要点 |', '| 严重程度 | 图标 | 判定标准 |'];

describe('single-source convention checklist guard', () => {
  it('keeps both convention-checklist.md copies byte-identical', async () => {
    const gitBytes = await fs.readFile(GIT_REVIEW_REFERENCE);
    const fileBytes = await fs.readFile(FILE_REVIEW_REFERENCE);

    expect(gitBytes.equals(fileBytes)).toBe(true);
  });

  it('defines the mandatory checklist table headers in the reference', async () => {
    const reference = await fs.readFile(GIT_REVIEW_REFERENCE, 'utf8');

    for (const header of MANDATORY_TABLE_HEADERS) {
      expect(reference).toContain(header);
    }
  });

  it('does not inline the checklist body in either review SKILL.md.hbs', async () => {
    const gitSkill = await fs.readFile(GIT_REVIEW_SKILL, 'utf8');
    const fileSkill = await fs.readFile(FILE_REVIEW_SKILL, 'utf8');

    for (const header of MANDATORY_TABLE_HEADERS) {
      expect(gitSkill).not.toContain(header);
      expect(fileSkill).not.toContain(header);
    }
  });
});
