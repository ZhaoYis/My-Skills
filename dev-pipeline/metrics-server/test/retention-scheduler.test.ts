import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callback: undefined as undefined | (() => Promise<void>),
  run: vi.fn().mockResolvedValue([]),
  schedule: vi.fn(),
  stop: vi.fn(),
  validate: vi.fn().mockReturnValue(true),
}));

vi.mock('node-cron', () => ({
  default: {
    validate: mocks.validate,
    schedule: mocks.schedule.mockImplementation((_schedule, callback) => {
      mocks.callback = callback;
      return { stop: mocks.stop };
    }),
  },
}));
vi.mock('../src/config/database.js', () => ({ prisma: {} }));
vi.mock('../src/services/retention-service.js', () => ({
  RetentionService: class {
    run = mocks.run;
  },
}));

const { startRetentionScheduler, stopCollectorScheduler } = await import(
  '../src/scheduler/cron.js'
);
const { observability } = await import('../src/observability/metrics.js');

beforeEach(() => {
  stopCollectorScheduler();
  observability.reset();
  mocks.callback = undefined;
  mocks.run.mockClear();
  mocks.schedule.mockClear();
  mocks.stop.mockClear();
  mocks.validate.mockReturnValue(true);
});

describe('retention scheduler', () => {
  it('runs an eligibility check at startup and on the configured schedule', async () => {
    startRetentionScheduler('30 2 * * *');
    await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledOnce());
    expect(mocks.run).toHaveBeenCalledWith({ triggerSource: 'scheduled' });
    await mocks.callback?.();
    expect(mocks.run).toHaveBeenCalledTimes(2);
    expect(observability.getSchedulerState('retention')).toMatchObject({
      configured: true,
      running: false,
      runs: { success: 2, error: 0 },
    });
    stopCollectorScheduler();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it('rejects an invalid retention cron expression', () => {
    mocks.validate.mockReturnValue(false);
    expect(() => startRetentionScheduler('invalid')).toThrow('Invalid retention schedule');
  });

  it('records scheduler failure state without leaking the thrown error', async () => {
    mocks.run.mockRejectedValueOnce(new Error('database password should not be logged'));
    startRetentionScheduler('30 2 * * *');
    await vi.waitFor(() => expect(observability.getSchedulerState('retention').runs.error).toBe(1));
    expect(observability.getSchedulerState('retention')).toMatchObject({
      configured: true,
      running: false,
      runs: { success: 0, error: 1 },
    });
  });
});
