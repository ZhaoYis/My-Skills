import {
  emitError,
  execCommandSync,
  prepareOpenSpecRepo,
  runJsonCommand,
  validateChangeName,
  validateIdentifier,
} from './pipeline-lib.mjs';

const MAX_BUFFER = 10 * 1024 * 1024;

function failureOutput(error) {
  return [error?.stdout, error?.stderr]
    .map((value) => (Buffer.isBuffer(value) ? value.toString('utf8') : value))
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .trim();
}

const [change, requestedArtifact] = process.argv.slice(2);
if (!change) {
  emitError('missing-argument', '缺少必需参数：change-name', 'provide-required-argument', 4);
}

validateChangeName(change);
const repoRoot = prepareOpenSpecRepo();
let artifact = requestedArtifact;

if (!artifact) {
  let statusOutput;
  try {
    statusOutput = execCommandSync('openspec', ['status', '--change', change, '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: MAX_BUFFER,
    });
  } catch (error) {
    const exitCode = Number.isInteger(error?.status) ? error.status : 1;
    emitError(
      'openspec-status-failed',
      `openspec status 执行失败（exit ${exitCode}）：${failureOutput(error)}`,
      'check-change-name',
      5,
    );
  }

  if (!statusOutput.trim()) {
    emitError('openspec-status-empty', 'openspec status 返回空输出', 'check-change-exists', 6);
  }

  let status;
  try {
    status = JSON.parse(statusOutput);
  } catch {
    emitError(
      'openspec-status-json-parse-failed',
      '无法解析 openspec status 输出的 JSON',
      'check-openspec-output',
      6,
    );
  }

  artifact = Array.isArray(status?.artifacts)
    ? status.artifacts.find(
        (item) => item?.status === 'ready' && typeof item.id === 'string' && item.id.length > 0,
      )?.id
    : undefined;
  if (!artifact) {
    emitError('no-ready-artifact', '没有 status 为 ready 的制品', 'pass-artifact-id', 4);
  }
}

validateIdentifier('artifact-id', artifact);
const result = runJsonCommand(
  ['openspec', 'instructions', artifact, '--change', change, '--json'],
  {
    failureReason: 'openspec-instructions-failed',
    nextAction: 'check-artifact-id',
  },
);
process.stdout.write(`${JSON.stringify(result)}\n`);
