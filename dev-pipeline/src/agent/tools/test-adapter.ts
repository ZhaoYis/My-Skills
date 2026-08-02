import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { type CommandRunner, NodeCommandRunner, parseCommandLine } from './command-runner.js';
import type { TestTools, ToolResponse } from './protocol.js';

export class TestAdapter implements TestTools {
  constructor(
    private readonly rootDir: string,
    private readonly runner: CommandRunner = new NodeCommandRunner(),
  ) {}

  async detect(): Promise<ToolResponse<string[]>> {
    const candidates: string[] = [];
    try {
      const packageJson = JSON.parse(
        await readFile(path.join(this.rootDir, 'package.json'), 'utf8'),
      ) as {
        scripts?: Record<string, string>;
      };
      if (packageJson.scripts?.test) candidates.push('npm test');
      if (packageJson.scripts?.['test:unit']) candidates.push('npm run test:unit');
      if (packageJson.scripts?.verify) candidates.push('npm run verify');
    } catch {
      // package.json is optional for non-Node repositories.
    }
    return {
      status: candidates.length > 0 ? 'succeeded' : 'blocked',
      summary: candidates.length > 0 ? 'test commands detected' : 'no test command detected',
      value: candidates,
      evidence: [{ type: 'candidates', value: candidates }],
    };
  }

  async run(input: { command: string }): Promise<ToolResponse> {
    try {
      const parsed = parseCommandLine(input.command);
      const result = await this.runner.run(parsed.command, parsed.args, { cwd: this.rootDir });
      return {
        status: result.exitCode === 0 ? 'succeeded' : 'failed',
        summary:
          result.exitCode === 0 ? 'tests passed' : `tests failed with exit ${result.exitCode}`,
        evidence: [
          { type: 'command', value: input.command },
          { type: 'stdout', value: result.stdout },
          { type: 'stderr', value: result.stderr },
        ],
      };
    } catch (error) {
      return { status: 'failed', summary: error instanceof Error ? error.message : String(error) };
    }
  }
}
