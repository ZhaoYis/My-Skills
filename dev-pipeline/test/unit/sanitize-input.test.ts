import { describe, expect, it } from 'vitest';
import { assertPathWithinBase, sanitizeProjectName } from '../../src/core/init/sanitizeInput.js';

describe('sanitizeInput', () => {
  describe('sanitizeProjectName', () => {
    it('removes curly braces to prevent Handlebars SSTI', () => {
      expect(sanitizeProjectName('{{constructor}}')).toBe('constructor');
      expect(sanitizeProjectName('{{{raw}}}')).toBe('raw');
      expect(sanitizeProjectName('my{project}name')).toBe('myprojectname');
    });

    it('removes backslashes', () => {
      expect(sanitizeProjectName('my\\project')).toBe('myproject');
    });

    it('collapses consecutive whitespace', () => {
      expect(sanitizeProjectName('my   project   name')).toBe('my project name');
      expect(sanitizeProjectName('  leading  ')).toBe('leading');
    });

    it('passes through clean names unchanged', () => {
      expect(sanitizeProjectName('my-project')).toBe('my-project');
      expect(sanitizeProjectName('my_project')).toBe('my_project');
      expect(sanitizeProjectName('My Project 123')).toBe('My Project 123');
    });

    it('handles complex SSTI payloads', () => {
      // All curly braces are stripped, leaving harmless text
      expect(
        sanitizeProjectName("{{#with 'constructor'}}{{this}}{{/with}}"),
      ).toBe("#with 'constructor'this/with");
    });
  });

  describe('assertPathWithinBase', () => {
    it('allows paths within the base directory', () => {
      expect(() => assertPathWithinBase('/home/user/project', 'src/file.ts')).not.toThrow();
      expect(() => assertPathWithinBase('/home/user/project', '.claude/skills/test.md')).not.toThrow();
    });

    it('allows the base directory itself', () => {
      expect(() => assertPathWithinBase('/home/user/project', '.')).not.toThrow();
    });

    it('rejects path traversal attempts', () => {
      expect(() => assertPathWithinBase('/home/user/project', '../../etc/passwd')).toThrow(
        /Path traversal detected/,
      );
      expect(() => assertPathWithinBase('/home/user/project', '../../../etc/shadow')).toThrow(
        /Path traversal detected/,
      );
    });

    it('rejects paths that escape via nested traversal', () => {
      expect(() =>
        assertPathWithinBase('/home/user/project', 'src/../../outside'),
      ).toThrow(/Path traversal detected/);
    });

    it('handles paths that look like traversal but stay within bounds', () => {
      // src/../src/file.ts resolves to src/file.ts which is within base
      expect(() =>
        assertPathWithinBase('/home/user/project', 'src/../src/file.ts'),
      ).not.toThrow();
    });
  });
});
