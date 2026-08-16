import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Route 对应的 Phase 路径
const ROUTE_PHASE_PATHS = {
  trivial: [0, 2, 6],
  standard: [0, 1, 2, 3, 4, 5, 6, 7],
  full: [0, 1, 2, 3, 4, 5, 6, 7],
};

// Phase 标题映射
const PHASE_TITLES = {
  0: '入口判断 + Route 分级',
  1: '提案编写 (Propose)',
  2: '提案应用 (Apply)',
  3: '代码审查 (Review)',
  4: '单元测试门禁',
  5: '提案归档 (Archive)',
  6: '提交与推送',
  7: '合并与交付',
};

// Phase 文件名映射
const PHASE_FILES = {
  0: 'phase-0-entrance.md',
  1: 'phase-1-propose.md',
  2: 'phase-2-apply.md',
  3: 'phase-3-review.md',
  4: 'phase-4-unit-tests.md',
  5: 'phase-5-archive.md',
  6: 'phase-6-commit-push.md',
  7: 'phase-7-merge-deliver.md',
};

function parseArgs(args) {
  const result = {
    phase: undefined,
    route: 'standard',
    format: 'markdown',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--phase' && args[i + 1]) {
      result.phase = Number(args[++i]);
    } else if (arg === '--route' && args[i + 1]) {
      result.route = args[++i];
    } else if (arg === '--format' && args[i + 1]) {
      result.format = args[++i];
    }
  }

  return result;
}

function isPhaseAllowed(route, phase) {
  const phasePath = ROUTE_PHASE_PATHS[route] || ROUTE_PHASE_PATHS.standard;
  return phasePath.includes(phase);
}

function getRoutePhasePath(route) {
  return ROUTE_PHASE_PATHS[route] || ROUTE_PHASE_PATHS.standard;
}

async function loadPhaseReference(phase) {
  const fileName = PHASE_FILES[phase];
  if (!fileName) return null;

  const referencePath = path.join(__dirname, '..', 'references', fileName);

  try {
    const content = await readFile(referencePath, 'utf-8');
    // 移除 frontmatter（---...--- 之间的内容）
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  } catch {
    return null;
  }
}

function formatMarkdown(phase, title, route, reference, skipped, skipReason) {
  const lines = [];

  lines.push(`# Phase ${phase}: ${title}`);
  lines.push('');
  lines.push(`**Route**: ${route}`);
  lines.push('');

  if (skipped) {
    lines.push('> ⚠️ **此 Phase 已被当前 Route 跳过**');
    lines.push('>');
    lines.push(`> ${skipReason}`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## 执行指引');
  lines.push('');
  lines.push(reference);

  return lines.join('\n');
}

function formatJson(phase, title, route, reference, skipped, skipReason) {
  return JSON.stringify(
    {
      phase,
      title,
      route,
      reference,
      skipped,
      skipReason,
    },
    null,
    2,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.phase === undefined) {
    console.error('Error: --phase is required');
    process.exit(1);
  }

  const phase = args.phase;
  const route = args.route;
  const format = args.format;
  const title = PHASE_TITLES[phase] || `Phase ${phase}`;

  // 检查 Phase 是否被 Route 跳过
  if (!isPhaseAllowed(route, phase)) {
    const phasePath = getRoutePhasePath(route);
    const skipReason = `Route "${route}" 跳过此 Phase。当前 Route 路径：${phasePath.join(' → ')}`;

    if (format === 'json') {
      console.log(formatJson(phase, title, route, '', true, skipReason));
    } else {
      console.log(formatMarkdown(phase, title, route, '', true, skipReason));
    }
    return;
  }

  // 加载 Phase reference
  const reference = await loadPhaseReference(phase);
  if (!reference) {
    const errorMsg = `# ${title}\n\nReference 文件未找到。`;
    if (format === 'json') {
      console.log(formatJson(phase, title, route, errorMsg, false, null));
    } else {
      console.log(formatMarkdown(phase, title, route, errorMsg, false, null));
    }
    return;
  }

  if (format === 'json') {
    console.log(formatJson(phase, title, route, reference, false, null));
  } else {
    console.log(formatMarkdown(phase, title, route, reference, false, null));
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
