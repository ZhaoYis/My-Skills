#!/usr/bin/env node
// block-sensitive-write.mjs
// opsx-dev-pipeline shared PreToolUse hook for Claude Code + OpenCode.
//
// Reads JSON on stdin (host-provided tool invocation envelope), inspects the
// file path the LLM is about to write, and either approves (exit 0) or denies
// (exit 2 + JSON) the call.
//
// Deny rules (matched against the file path basename or full path):
//   - *.env / *.env.*                  (environment files)
//   - *.key / *.pem / *.p12 / *.pfx / *.secret
//   - credentials.json / service-account.json
//   - openspec/.pipeline-state/*.json  (managed by dev-pipeline-state.mjs)
//   - .git/                            (internal git directory)
//
// Allow by default — anything not matching an explicit deny rule passes.
//
// Failure semantics:
//   - stdin parse fail → stderr WARN + exit 0
//   - stdin timeout    → exit 0 (host-side `failClosed` decides further action)
//   - non-write tool   → exit 0 (handled elsewhere)
//
// Cross-platform: pure Node.js, no jq or bash dependency. Requires Node.js 20+.

import process from 'node:process';

async function readStdin(timeoutMs = 1000) {
  return new Promise((resolve) => {
    let buf = '';
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      resolve(buf);
    };
    const onData = (chunk) => {
      buf += chunk.toString('utf8');
    };
    const onEnd = () => finish();

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    setTimeout(finish, timeoutMs);
  });
}

function warn(msg) {
  process.stderr.write(`WARN: ${msg}\n`);
}

// ---- 1. parse envelope ------------------------------------------------
const raw = await readStdin(1000);
let envelope = {};
if (raw.trim()) {
  try {
    envelope = JSON.parse(raw);
  } catch {
    warn('cannot parse stdin JSON; allowing');
    process.exit(0);
  }
}

const toolName = String(envelope.tool_name ?? envelope.toolName ?? '').toLowerCase();
const WRITE_TOOLS = new Set(['write', 'edit', 'multiedit', 'notebookedit', 'multi_edit', 'patch']);
if (toolName && !WRITE_TOOLS.has(toolName)) {
  process.exit(0);
}

// tool_input paths live under different field names depending on host/version:
//   Claude Code Write:        tool_input.file_path
//   Claude Code Edit:         tool_input.file_path
//   Claude Code MultiEdit:    tool_input.file_path
//   OpenCode write/edit:      tool_input.filePath
//   OpenCode multi_edit:      tool_input.filePath
const filePath = String(
  envelope.tool_input?.file_path ??
    envelope.toolInput?.file_path ??
    envelope.tool_input?.filePath ??
    envelope.toolInput?.filePath ??
    envelope.tool_input?.path ??
    envelope.toolInput?.path ??
    '',
).trim();

if (!filePath) {
  warn('cannot parse tool_input file path; allowing');
  process.exit(0);
}

// Normalize backslashes for matching (Windows-style paths from some hosts).
const normalized = filePath.replace(/\\/g, '/');
const basename = normalized.split('/').pop() ?? '';

// ---- 2. deny helpers --------------------------------------------------
function deny(reason) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
      systemMessage: `Blocked by opsx-dev-pipeline hook: ${reason}`,
    })}\n`,
  );
  process.exit(2);
}

// ---- 3. deny rules (any match wins) -----------------------------------

// 3.1 .git/ internal directory
if (/(^|\/)\.git(\/|$)/.test(normalized)) deny('git-internal-write-blocked');

// 3.2 openspec/.pipeline-state/*.json — managed by dev-pipeline-state.mjs
if (/(^|\/)openspec\/\.pipeline-state\/[^/]+\.json$/.test(normalized)) {
  deny('pipeline-state-write-blocked');
}

// 3.3 *.env / *.env.*
if (
  basename === '.env' ||
  basename.startsWith('.env.') ||
  basename.endsWith('.env') ||
  /\.env\./.test(basename)
) {
  deny('sensitive-env-blocked');
}

// 3.4 credentials / service-account JSON files
if (basename === 'credentials.json' || basename === 'service-account.json') {
  deny('sensitive-credentials-blocked');
}

// 3.5 crypto key material (last so longer suffixes win)
if (/\.(key|pem|p12|pfx|secret)$/.test(basename)) deny('sensitive-key-blocked');

// ---- 4. default allow -------------------------------------------------
process.exit(0);
