import { afterEach, describe, expect, it } from 'vitest';
import {
  getAllowedTransitions,
  getRecoveryBehavior,
  isRecoverable,
  isTerminal,
  validateTransition,
} from '../../src/core/hermes/state-machine.js';
import type { PipelinePhase } from '../../src/core/hermes/types.js';

describe('state-machine', () => {
  describe('getAllowedTransitions', () => {
    it('returns all allowed next phases for pre_pipeline', () => {
      const allowed = getAllowedTransitions('pre_pipeline');
      expect(allowed).toContain('phase0_entrance');
      expect(allowed).toContain('terminated');
    });

    it('returns correct transitions for phase2_apply', () => {
      const allowed = getAllowedTransitions('phase2_apply');
      expect(allowed).toContain('phase3_review');
      expect(allowed).toContain('terminated');
      expect(allowed).toHaveLength(2);
    });

    it('returns review fix path from phase3_review', () => {
      const allowed = getAllowedTransitions('phase3_review');
      expect(allowed).toContain('phase3_fix');
      expect(allowed).toContain('phase4_archive');
      expect(allowed).toContain('terminated');
    });

    it('returns empty for completed phase', () => {
      expect(getAllowedTransitions('completed')).toEqual([]);
    });

    it('returns empty for terminated phase', () => {
      expect(getAllowedTransitions('terminated')).toEqual([]);
    });

    it('returns valid transitions for phase7_ci_pending', () => {
      const allowed = getAllowedTransitions('phase7_ci_pending');
      expect(allowed).toContain('phase7_ci_triage');
      expect(allowed).toContain('phase7_pr_merge');
      expect(allowed).toContain('terminated');
    });
  });

  describe('validateTransition', () => {
    it('allows valid transition from phase1 to phase2', () => {
      expect(validateTransition('phase1_propose', 'phase2_apply')).toBe(true);
    });

    it('allows termination from any non-terminal phase', () => {
      expect(validateTransition('phase0_entrance', 'terminated')).toBe(true);
      expect(validateTransition('phase1_propose', 'terminated')).toBe(true);
      expect(validateTransition('phase2_apply', 'terminated')).toBe(true);
    });

    it('rejects invalid transition (skipping phases)', () => {
      expect(validateTransition('phase0_entrance', 'phase3_review')).toBe(false);
    });

    it('rejects transition from terminal phase', () => {
      expect(validateTransition('completed', 'phase0_entrance')).toBe(false);
      expect(validateTransition('terminated', 'phase2_apply')).toBe(false);
    });

    it('rejects backward transition', () => {
      expect(validateTransition('phase3_review', 'phase2_apply')).toBe(false);
    });

    it('allows review fix loop', () => {
      expect(validateTransition('phase3_review', 'phase3_fix')).toBe(true);
      expect(validateTransition('phase3_fix', 'phase3_review')).toBe(true);
    });
  });

  describe('isTerminal', () => {
    it('returns true for completed', () => {
      expect(isTerminal('completed')).toBe(true);
    });

    it('returns true for terminated', () => {
      expect(isTerminal('terminated')).toBe(true);
    });

    it('returns false for active phases', () => {
      expect(isTerminal('pre_pipeline')).toBe(false);
      expect(isTerminal('phase2_apply')).toBe(false);
      expect(isTerminal('phase7_ci_pending')).toBe(false);
    });
  });

  describe('isRecoverable', () => {
    it('returns true for active phases', () => {
      expect(isRecoverable('phase0_entrance')).toBe(true);
      expect(isRecoverable('phase3_review')).toBe(true);
    });

    it('returns false for terminal phases', () => {
      expect(isRecoverable('completed')).toBe(false);
      expect(isRecoverable('terminated')).toBe(false);
    });
  });

  describe('getRecoveryBehavior', () => {
    it('returns descriptive behavior for each phase', () => {
      const allPhases: PipelinePhase[] = [
        'pre_pipeline',
        'phase0_entrance',
        'phase1_propose',
        'phase2_apply',
        'phase3_review',
        'phase3_fix',
        'phase4_archive',
        'phase5_unittest',
        'phase6_push',
        'phase6_merge',
        'phase7_pr_created',
        'phase7_ci_pending',
        'phase7_ci_triage',
        'phase7_pr_merge',
        'completed',
        'terminated',
      ];

      for (const phase of allPhases) {
        const behavior = getRecoveryBehavior(phase);
        expect(behavior).toBeTruthy();
        expect(typeof behavior).toBe('string');
      }
    });
  });
});