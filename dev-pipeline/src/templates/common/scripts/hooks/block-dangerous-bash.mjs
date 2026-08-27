#!/usr/bin/env node
// block-dangerous-bash.mjs
// opsx-dev-pipeline shared PreToolUse hook for Claude Code + OpenCode.
//
// Reads JSON on stdin (host-provided tool invocation envelope), inspects the
// Bash command, and either approves (exit 0) or denies (exit 2 + JSON) the call.
//
// Deny rules:
//   - rm -rf /, rm -rf ~, rm -rf . (and absolute path hitting home/system dirs)
//   - git push --force / --force-with-lease / -f
//   - git branch -D (capital D, force delete)
//   - chmod 777 / chmod -R 777
//   - curl <url> | sh, wget <url> | bash, curl <url> | sudo sh, ...
//   - mkfs / dd if=<file>
//
// Allow by default — anything not matching an explicit deny rule passes.
//
// Failure semantics:
//   - stdin parse fail → stderr WARN + exit 0 (allow; do not block on host quirks)
//   - stdin timeout (>1s) → exit 0 (host-side `failClosed` decides further action)
//   - non-Bash tool_name → exit 0 (handled by other hooks)
//
// Cross-platform: pure Node.js, no jq or bash dependency. Requires Node.js 20+.

import process from 'node:process';

// ---- 1. read stdin with 1s ceiling -----------------------------------
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

// ---- 2. parse envelope ------------------------------------------------
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
if (toolName !== 'bash') {
  // Other tools (Write/Edit/etc.) are handled by block-sensitive-write.mjs.
  // Also accept no tool_name at all — host variants differ.
  if (toolName && toolName !== 'bash') process.exit(0);
}

const command = String(
  envelope.tool_input?.command
    ?? envelope.toolInput?.command
    ?? '',
).trim();

if (!command) {
  warn('cannot parse tool_input.command; allowing');
  process.exit(0);
}

const normalized = command.replace(/\s+/g, ' ').trim();

// ---- 3. deny helpers --------------------------------------------------
function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
      systemMessage: `Blocked by opsx-dev-pipeline hook: ${reason}`,
    }) + '\n',
  );
  process.exit(2);
}

// ---- 4. deny rules (any match wins) -----------------------------------

// 4.1 rm -rf / rm -rf ~ / rm -rf . / rm -rf /something
if (/^rm\s+(-[rRfF]+\s+)+[~/]/.test(normalized)) deny('destructive-rm-blocked');
if (/^rm\s+(-[rRfF]+\s+)+(~|\/|\.)(\s|$)/.test(normalized)) deny('destructive-rm-blocked');

// 4.2 git push --force / --force-with-lease / -f
if (/git\s+push\s+.*--force(-with-lease)?(\s|$)/.test(normalized)) deny('force-push-blocked');
if (/git\s+push\s+.*-f(\s|$)/.test(normalized)) deny('force-push-blocked');

// 4.3 git branch -D / --force (capital D / long flag = force delete).
//     Lowercase -d is safe — allowed.
if (/git\s+branch\s+(-D|--force)(\s|$)/.test(normalized)) deny('force-branch-delete-blocked');

// 4.4 chmod 777 / chmod -R 777
if (/chmod\s+(-R\s+)?777(\s|$)/.test(normalized)) deny('world-writable-chmod-blocked');

// 4.5 remote-pipe-shell: curl|wget <url> | sh|bash|sudo sh
if (/(curl|wget)\s+[^|]*\|(\s*)(sudo\s+)?(sh|bash|zsh)(\s|$)/.test(normalized)) {
  deny('remote-pipe-shell-blocked');
}

// 4.6 mkfs / dd writing to device
if (/^mkfs(\.[a-z0-9]+)?(\s|$)/i.test(normalized)) deny('filesystem-format-blocked');
if (/\bdd\s+.*if=\S+/.test(normalized)) deny('raw-disk-write-blocked');

// ---- 5. default allow -------------------------------------------------
process.exit(0);
