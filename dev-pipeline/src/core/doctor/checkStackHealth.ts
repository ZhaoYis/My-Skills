import fs from 'node:fs';
import path from 'node:path';
import type { StackIssue, StackHealthResult } from './types.js';

/**
 * Validate the stack profile in openspec/config.yaml.
 *
 * Checks performed:
 *   - config.yaml exists
 *   - YAML is parseable (basic line parser, no external YAML deps)
 *   - stack.id is present and non-empty
 *   - stack.services[] is a non-empty array
 *   - each service has name and path
 *   - each service path exists on disk
 *   - required commands are present and non-empty
 *   - cwd fields resolve to actual directories
 */
export async function checkStackHealth(targetDir: string): Promise<StackHealthResult> {
  const configPath = path.join(targetDir, 'openspec', 'config.yaml');
  const issues: StackIssue[] = [];

  if (!fs.existsSync(configPath)) {
    return { valid: false, stackFound: false, configPath: null, issues: [{ path: 'openspec/config.yaml', severity: 'error', message: 'openspec/config.yaml not found' }] };
  }

  let raw: string;
  try { raw = fs.readFileSync(configPath, 'utf-8'); } catch {
    return { valid: false, stackFound: false, configPath, issues: [{ path: 'openspec/config.yaml', severity: 'error', message: 'Cannot read file' }] };
  }

  const root = parseYaml(raw);
  const stackRoot = root['stack'];
  if (!stackRoot || typeof stackRoot !== 'object' || Array.isArray(stackRoot)) {
    return { valid: false, stackFound: false, configPath, issues: [{ path: 'stack', severity: 'error', message: 'No stack section found' }] };
  }
  const s = stackRoot as Record<string, unknown>;

  // stack.id
  const stackId = typeof s['id'] === 'string' ? s['id'] : undefined;
  if (!stackId) issues.push({ path: 'stack.id', severity: 'error', message: 'stack.id is required' });

  // stack.languages
  const languages = Array.isArray(s['languages']) ? s['languages'] : [];
  if (languages.length === 0) issues.push({ path: 'stack.languages', severity: 'warning', message: 'No languages declared' });

  // stack.services[]
  const services = Array.isArray(s['services']) ? s['services'] : [];
  const stacks: string[] = [];
  if (services.length === 0) {
    issues.push({ path: 'stack.services', severity: 'error', message: 'At least one service is required' });
  } else {
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      if (typeof svc !== 'object' || svc === null || Array.isArray(svc)) continue;
      const svcObj = svc as Record<string, unknown>;
      const prefix = `stack.services[${i}]`;

      const svcName = typeof svcObj['name'] === 'string' ? svcObj['name'] : '';
      if (!svcName) { issues.push({ path: `${prefix}.name`, severity: 'error', message: `Service #${i} has no name` }); }
      else { stacks.push(svcName); }

      const svcDir = typeof svcObj['path'] === 'string' ? svcObj['path'] : '';
      if (!svcDir) {
        issues.push({ path: `${prefix}.path`, severity: 'error', message: `Service "${svcName}" has no path` });
      } else if (!fs.existsSync(path.join(targetDir, svcDir))) {
        issues.push({ path: `${prefix}.path`, severity: 'error', message: `Path "${svcDir}" does not exist on disk` });
      }

      // Validate command objects: dev, test, integration, e2e
      for (const cmdKey of ['dev', 'test', 'integration', 'e2e']) {
        validateCommand(svcObj, cmdKey, `${prefix}.${cmdKey}`, svcName, targetDir, issues);
      }
    }
  }

  // stack.verify
  const verifyRoot = s['verify'];
  if (verifyRoot && typeof verifyRoot === 'object' && !Array.isArray(verifyRoot)) {
    const v = verifyRoot as Record<string, unknown>;
    for (const verifyKey of ['build', 'smoke', 'contract']) {
      validateCommand(v, verifyKey, `stack.verify.${verifyKey}`, 'verify', targetDir, issues);
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    stackFound: true,
    configPath,
    stackId,
    serviceCount: services.length,
    stacks,
    issues,
  };
}

function validateCommand(
  parent: Record<string, unknown>,
  key: string,
  jsonPath: string,
  contextName: string,
  targetDir: string,
  issues: StackIssue[],
): void {
  const cmd = parent[key];
  if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd)) return;
  const c = cmd as Record<string, unknown>;

  const isRequired = c['required'] === true;
  const command = typeof c['command'] === 'string' ? c['command'] : '';

  if (!command && isRequired) {
    issues.push({ path: `${jsonPath}.command`, severity: 'error', message: `${contextName}.${key} is required but has no command` });
  }

  const cwd = typeof c['cwd'] === 'string' ? c['cwd'] : '';
  if (cwd && !fs.existsSync(path.join(targetDir, cwd))) {
    issues.push({ path: `${jsonPath}.cwd`, severity: 'warning', message: `cwd "${cwd}" does not exist on disk` });
  }
}

// ── Minimal YAML parser (no external deps) ──

function parseYaml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split('\n');
  const pathStack: { indent: number; obj: Record<string, unknown> }[] = [{ indent: -1, obj: result }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const content = line.trim();
    const colonIdx = content.indexOf(':');
    if (colonIdx < 0) continue;

    const key = content.slice(0, colonIdx).trim();
    const rawValue = content.slice(colonIdx + 1).trim();

    // Pop stack
    while (pathStack.length > 1 && pathStack[pathStack.length - 1].indent >= indent) {
      pathStack.pop();
    }
    const parent = pathStack[pathStack.length - 1].obj;

    if (rawValue === '' || rawValue === '|' || rawValue === '>' || rawValue === 'null') {
      if (rawValue === 'null') {
        parent[key] = null;
      } else if (rawValue === '|' || rawValue === '>') {
        // Block scalar
        let block = '';
        let j = i + 1;
        while (j < lines.length && (lines[j].trim() === '' || lines[j].search(/\S/) > indent)) {
          if (lines[j].trim() !== '') block += (block ? '\n' : '') + lines[j].trimEnd();
          j++;
        }
        parent[key] = block;
        i = j - 1;
      } else {
        const child: Record<string, unknown> = {};
        parent[key] = child;
        pathStack.push({ indent, obj: child });
      }
    } else if (rawValue === 'true') {
      parent[key] = true;
    } else if (rawValue === 'false') {
      parent[key] = false;
    } else if (rawValue === '[]') {
      parent[key] = [];
    } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      parent[key] = rawValue.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(s => s.length > 0);
    } else if (rawValue.startsWith('- ')) {
      // List item
      const existing = parent[key];
      const arr: unknown[] = Array.isArray(existing) ? existing : [];
      if (!Array.isArray(existing)) parent[key] = arr;
      arr.push(parseScalar(rawValue.slice(2).trim()));
    } else if (!isNaN(Number(rawValue)) && rawValue !== '') {
      parent[key] = Number(rawValue);
    } else {
      parent[key] = parseScalar(rawValue);
    }
  }
  return result;
}

function parseScalar(v: string): string {
  return v.replace(/^["']|["']$/g, '');
}
