import prompts from 'prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectInputs } from '../../src/core/init/collectInputs.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('tech stack input collection', () => {
  it('accepts a matching tech stack in non-interactive mode', async () => {
    const answers = await collectInputs(
      '/tmp/demo',
      { yes: true, stack: 'backend', techStack: 'java-spring-boot' },
      new Map(),
    );

    expect(answers.techStack).toBe('java-spring-boot');
  });

  it('keeps tech stack optional in non-interactive mode', async () => {
    const answers = await collectInputs('/tmp/demo', { yes: true, stack: 'backend' }, new Map());

    expect(answers.techStack).toBeUndefined();
  });

  it('rejects unknown and mismatched tech stacks', async () => {
    await expect(
      collectInputs('/tmp/demo', { yes: true, stack: 'backend', techStack: 'invalid' }, new Map()),
    ).rejects.toThrow('Invalid tech stack: invalid. Valid:');

    await expect(
      collectInputs(
        '/tmp/demo',
        { yes: true, stack: 'backend', techStack: 'react-vite' },
        new Map(),
      ),
    ).rejects.toThrow('Tech stack react-vite is not valid for stack backend');
  });

  it('filters interactive tech stack choices by the selected parent stack', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({
      projectName: 'demo',
      tool: 'claude',
      stack: 'frontend',
      techStack: 'react-vite',
      language: 'zh',
    });

    const answers = await collectInputs('/tmp/demo', {}, new Map());
    const questions = vi.mocked(prompts).mock.calls[0]?.[0];
    const techStackQuestion = Array.isArray(questions)
      ? questions.find((question) => question.name === 'techStack')
      : undefined;
    const choices =
      typeof techStackQuestion?.choices === 'function'
        ? techStackQuestion.choices(undefined, { stack: 'frontend' }, techStackQuestion)
        : techStackQuestion?.choices;

    expect(choices).toEqual([
      expect.objectContaining({ title: 'React + Vite', value: 'react-vite' }),
    ]);
    expect(answers.techStack).toBe('react-vite');
  });

  it('accepts python-react for fullstack and lists it in interactive choices', async () => {
    const answers = await collectInputs(
      '/tmp/demo',
      { yes: true, stack: 'fullstack', techStack: 'python-react' },
      new Map(),
    );
    expect(answers.techStack).toBe('python-react');

    vi.mocked(prompts).mockResolvedValueOnce({
      projectName: 'demo',
      tool: 'claude',
      stack: 'fullstack',
      techStack: 'python-react',
      language: 'zh',
    });

    await collectInputs('/tmp/demo', {}, new Map());
    const questions = vi.mocked(prompts).mock.calls[0]?.[0];
    const techStackQuestion = Array.isArray(questions)
      ? questions.find((question) => question.name === 'techStack')
      : undefined;
    const choices =
      typeof techStackQuestion?.choices === 'function'
        ? techStackQuestion.choices(undefined, { stack: 'fullstack' }, techStackQuestion)
        : techStackQuestion?.choices;

    expect(choices).toEqual([
      expect.objectContaining({ title: 'Java Spring Boot + React', value: 'java-react' }),
      expect.objectContaining({ title: 'Python FastAPI + React', value: 'python-react' }),
    ]);
  });
});
