import { describe, expect, it, vi } from 'vitest';
import { runListToolsCommand } from '../../src/cli/commands/list-tools.js';
import { PACKAGE_VERSION } from '../../src/core/runtime/meta.js';

describe('runListToolsCommand', () => {
  it('prints structured JSON when json is enabled', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runListToolsCommand({ json: true });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      packageVersion: string;
      tools: Array<{ id: string; displayName: string }>;
    };

    expect(payload.packageVersion).toBe(PACKAGE_VERSION);
    expect(payload.tools.map((tool) => tool.id).sort()).toEqual(['claude', 'codex', 'cursor', 'generic']);
    expect(payload.tools[0]).toMatchObject({
      destinations: expect.objectContaining({
        skills: expect.any(String),
        commands: expect.any(String)
      }),
      markers: expect.any(Array),
      supports: expect.any(Array)
    });

    logSpy.mockRestore();
  });
});
