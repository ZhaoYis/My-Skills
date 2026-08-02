#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TYPES = ['fact', 'constraint', 'assumption', 'question', 'decision'];
const STATUSES = ['draft', 'confirmed', 'deprecated', 'rejected'];
const CONFIDENCE = ['low', 'medium', 'high'];
const SOURCE_KINDS = ['code', 'doc', 'conversation', 'ticket', 'url', 'command', 'test', 'file'];
const OPPOSITES = [
  ['支持', '不支持'],
  ['允许', '禁止'],
  ['可以', '不能'],
  ['enabled', 'disabled'],
  ['supports', 'does not support'],
  ['allow', 'deny'],
];
const VAGUE_WORDS = ['明显', '很多', '经常', '通常', '大概', 'probably', 'often', 'many'];
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*[^\s]+/i,
  /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
];

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value =
      inlineValue ?? (argv[index + 1]?.startsWith('--') ? true : (argv[++index] ?? true));
    if (result[key] === undefined) result[key] = value;
    else result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
  }
  return result;
}

function scalar(value) {
  const text = value.trim();
  if (text === 'null' || text === '~') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => scalar(item));
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\'", "'");
  }
  return text;
}

function parseFrontmatter(content, file) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);
  const data = {};
  let parent = null;
  for (const [lineIndex, rawLine] of match[1].split(/\r?\n/).entries()) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (indent > 0 && parent) {
      if (line.startsWith('- ')) {
        if (!Array.isArray(data[parent])) data[parent] = [];
        data[parent].push(scalar(line.slice(2)));
        continue;
      }
      const nested = line.match(/^([^:]+):\s*(.*)$/);
      if (nested && data[parent] && !Array.isArray(data[parent])) {
        data[parent][nested[1].trim()] = scalar(nested[2]);
        continue;
      }
    }
    const pair = line.match(/^([^:]+):\s*(.*)$/);
    if (!pair) throw new Error(`${file}:${lineIndex + 2}: invalid frontmatter line`);
    const key = pair[1].trim();
    const value = pair[2];
    if (value === '') {
      data[key] = key === 'tags' ? {} : [];
      parent = key;
    } else {
      data[key] = scalar(value);
      parent = null;
    }
  }
  return { data, body: content.slice(match[0].length).trimStart() };
}

function quote(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const text = String(value);
  return /^[A-Za-z0-9_./:@-]+$/.test(text) ? text : JSON.stringify(text);
}

function stringifyFrontmatter(data) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) lines.push(`${key}: [${value.map(quote).join(', ')}]`);
    else if (value && typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        lines.push(
          `  ${nestedKey}: ${Array.isArray(nestedValue) ? `[${nestedValue.map(quote).join(', ')}]` : quote(nestedValue)}`,
        );
      }
    } else lines.push(`${key}: ${quote(value)}`);
  }
  return `${lines.join('\n')}\n---\n`;
}

function splitList(value) {
  if (value === undefined || value === true || value === '') return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function findKnowledgeRoot(rootOption) {
  let current = path.resolve(String(rootOption || process.cwd()));
  for (;;) {
    const direct = path.join(current, 'openspec', 'knowledge');
    if (await exists(path.join(direct, 'knowledge.config.json'))) return direct;
    if (
      path.basename(current) === 'knowledge' &&
      (await exists(path.join(current, 'knowledge.config.json')))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Knowledge base not found. Run opsx-dev-pipeline init or pass --root <project>.');
}

async function listMarkdown(directory) {
  if (!(await exists(directory))) return [];
  return (await fs.readdir(directory))
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => path.join(directory, name));
}

async function loadRecords(directory) {
  return Promise.all(
    (await listMarkdown(directory)).map(async (file) => ({
      file,
      ...parseFrontmatter(await fs.readFile(file, 'utf8'), file),
    })),
  );
}

function requireValue(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateSource(source) {
  const errors = [];
  requireValue(/^SRC-\d{4,}$/.test(source.id), 'invalid source id', errors);
  requireValue(SOURCE_KINDS.includes(source.kind), 'invalid source kind', errors);
  requireValue(Boolean(source.locator), 'source locator is required', errors);
  requireValue(Boolean(source.title), 'source title is required', errors);
  requireValue(CONFIDENCE.includes(source.reliability), 'invalid source reliability', errors);
  return errors;
}

function validateEntry(entry, sources, config) {
  const errors = [];
  requireValue(/^KB-\d{4,}$/.test(entry.id), 'invalid entry id', errors);
  requireValue(TYPES.includes(entry.type), 'invalid entry type', errors);
  requireValue(STATUSES.includes(entry.status), 'invalid entry status', errors);
  requireValue(Boolean(entry.title), 'title is required', errors);
  requireValue(Boolean(entry.statement), 'statement is required', errors);
  requireValue(Array.isArray(entry.scope) && entry.scope.length > 0, 'scope is required', errors);
  requireValue(Array.isArray(entry.owners) && entry.owners.length > 0, 'owner is required', errors);
  requireValue(CONFIDENCE.includes(entry.confidence), 'invalid confidence', errors);
  requireValue(Boolean(entry.capturedBy), 'capturedBy is required', errors);
  requireValue(
    config.tags.domain.includes(entry.tags?.domain),
    `invalid domain tag: ${entry.tags?.domain}`,
    errors,
  );
  const features = entry.tags?.feature ?? [];
  requireValue(
    Array.isArray(features) && features.length <= 3,
    'feature tags must contain 0-3 values',
    errors,
  );
  for (const tag of features) {
    requireValue(config.tags.feature.includes(tag), `invalid feature tag: ${tag}`, errors);
  }
  const sourceIds = entry.sources ?? [];
  for (const sourceId of sourceIds)
    requireValue(sources.has(sourceId), `missing source: ${sourceId}`, errors);
  if (entry.status === 'confirmed') {
    requireValue(sourceIds.length > 0, 'confirmed entry requires a source', errors);
    requireValue(Boolean(entry.reviewedBy), 'confirmed entry requires reviewedBy', errors);
    if (entry.type !== 'assumption') {
      for (const word of VAGUE_WORDS) {
        requireValue(
          !String(entry.statement).includes(word),
          `unquantified vague word: ${word}`,
          errors,
        );
      }
    }
  }
  if (entry.status === 'confirmed' && entry.confidence === 'high') {
    const sourceKinds = sourceIds.map((id) => sources.get(id)?.kind);
    requireValue(
      sourceKinds.includes('code') || sourceKinds.includes('test'),
      'confirmed high confidence requires a code or test source',
      errors,
    );
  }
  return errors;
}

function hasSecrets(value) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeWords(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}-]+/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1),
  );
}

function conflictCandidate(left, right) {
  if (!left.scope?.some((scope) => right.scope?.includes(scope))) return false;
  const leftTags = [left.tags?.domain, ...(left.tags?.feature ?? [])];
  const rightTags = [right.tags?.domain, ...(right.tags?.feature ?? [])];
  if (!leftTags.some((tag) => tag && rightTags.includes(tag))) return false;
  const leftText = String(left.statement).toLowerCase();
  const rightText = String(right.statement).toLowerCase();
  const opposite = OPPOSITES.some(
    ([positive, negative]) =>
      (leftText.includes(positive) && rightText.includes(negative)) ||
      (leftText.includes(negative) && rightText.includes(positive)),
  );
  if (!opposite) return false;
  const leftWords = normalizeWords(leftText);
  const overlap = [...normalizeWords(rightText)].filter((word) => leftWords.has(word));
  return overlap.length > 0 || left.tags?.domain === right.tags?.domain;
}

function stale(entry, staleAfterDays) {
  const updated = Date.parse(entry.updatedAt);
  return Number.isFinite(updated) && Date.now() - updated > staleAfterDays * 86_400_000;
}

function addIndex(index, key, id) {
  if (!index[key]) index[key] = [];
  if (!index[key].includes(id)) index[key].push(id);
}

async function rebuild(root, { quiet = false } = {}) {
  const config = JSON.parse(await fs.readFile(path.join(root, 'knowledge.config.json'), 'utf8'));
  const sourceRecords = await loadRecords(path.join(root, 'sources'));
  const entryRecords = await loadRecords(path.join(root, 'entries'));
  const sources = new Map();
  const ids = new Set();
  const failures = [];
  for (const record of sourceRecords) {
    if (ids.has(record.data.id)) failures.push(`${record.file}: duplicate id ${record.data.id}`);
    ids.add(record.data.id);
    sources.set(record.data.id, record.data);
    for (const error of validateSource(record.data)) failures.push(`${record.file}: ${error}`);
  }
  for (const record of entryRecords) {
    if (ids.has(record.data.id)) failures.push(`${record.file}: duplicate id ${record.data.id}`);
    ids.add(record.data.id);
    for (const error of validateEntry(record.data, sources, config))
      failures.push(`${record.file}: ${error}`);
  }
  if (failures.length) throw new Error(`Knowledge validation failed:\n- ${failures.join('\n- ')}`);

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    entries: {},
    index: {
      byScope: {},
      byTag: {},
      byChange: {},
      byType: Object.fromEntries(TYPES.map((type) => [type, []])),
    },
  };
  for (const record of entryRecords) {
    const entry = record.data;
    const detected = entryRecords
      .filter((other) => other.data.id !== entry.id && other.data.status === 'confirmed')
      .filter((other) => conflictCandidate(entry, other.data))
      .map((other) => other.data.id);
    const conflict = [...new Set([...(entry.conflict ?? []), ...detected])].sort();
    const autoTags = [
      ...(entry.sources?.length ? ['has-source'] : []),
      ...(conflict.length ? ['has-conflict'] : []),
      ...(stale(entry, config.staleAfterDays) ? ['stale'] : []),
      ...(entry.status === 'draft' ? ['needs-review'] : []),
    ];
    output.entries[entry.id] = {
      id: entry.id,
      type: entry.type,
      status: entry.status,
      title: entry.title,
      statement: entry.statement,
      scope: entry.scope,
      tags: entry.tags,
      autoTags,
      confidence: entry.confidence,
      updatedAt: entry.updatedAt,
      validUntil: entry.validUntil ?? null,
      sources: entry.sources ?? [],
      relatedChanges: entry.relatedChanges ?? [],
      conflict,
      file: `entries/${path.basename(record.file)}`,
    };
    for (const scope of entry.scope) addIndex(output.index.byScope, scope, entry.id);
    for (const tag of [entry.tags.domain, ...(entry.tags.feature ?? [])])
      addIndex(output.index.byTag, tag, entry.id);
    for (const change of entry.relatedChanges ?? [])
      addIndex(output.index.byChange, change.replace(/^change:/, ''), entry.id);
    addIndex(output.index.byType, entry.type, entry.id);
  }
  await fs.writeFile(path.join(root, 'index.json'), `${JSON.stringify(output, null, 2)}\n`);
  if (!quiet)
    console.log(`Rebuilt ${path.join(root, 'index.json')} (${entryRecords.length} entries).`);
  return output;
}

async function nextId(directory, prefix) {
  const records = await loadRecords(directory);
  const max = records.reduce((value, record) => {
    const number = Number(String(record.data.id).slice(prefix.length + 1));
    return Number.isFinite(number) ? Math.max(value, number) : value;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

async function writeRecord(file, data, body) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${stringifyFrontmatter(data)}\n${body.trim()}\n`);
}

async function capture(root, options) {
  const required = ['type', 'title', 'statement', 'domain', 'owner', 'capturedBy'];
  for (const key of required)
    if (!options[key])
      throw new Error(`capture requires --${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  if (!TYPES.includes(options.type)) throw new Error(`Invalid type. Use: ${TYPES.join(', ')}`);
  if (hasSecrets(`${options.title}\n${options.statement}`))
    throw new Error('Potential secret detected; redact before capture.');
  const config = JSON.parse(await fs.readFile(path.join(root, 'knowledge.config.json'), 'utf8'));
  if (!config.tags.domain.includes(options.domain))
    throw new Error(`Invalid domain tag. Use: ${config.tags.domain.join(', ')}`);
  const features = splitList(options.feature);
  const invalidFeature = features.find((tag) => !config.tags.feature.includes(tag));
  if (invalidFeature)
    throw new Error(
      `Invalid feature tag ${invalidFeature}. Use: ${config.tags.feature.join(', ')}`,
    );
  if (features.length > 3) throw new Error('At most three feature tags are allowed.');
  const now = new Date().toISOString();
  let generatedSource = null;
  if (options.sourceKind) {
    if (!options.sourceLocator || !options.sourceTitle) {
      throw new Error('--source-kind requires --source-locator and --source-title');
    }
    if (!SOURCE_KINDS.includes(options.sourceKind)) {
      throw new Error(`Invalid source kind. Use: ${SOURCE_KINDS.join(', ')}`);
    }
    if (
      hasSecrets(`${options.sourceLocator}\n${options.sourceTitle}\n${options.sourceSummary || ''}`)
    ) {
      throw new Error('Potential secret detected in source metadata; redact before capture.');
    }
    const reliabilityDefaults = {
      code: 'high',
      test: 'high',
      conversation: 'medium',
      ticket: 'medium',
      url: 'medium',
      doc: 'medium',
      command: 'medium',
      file: 'medium',
    };
    generatedSource = {
      id: await nextId(path.join(root, 'sources'), 'SRC'),
      kind: options.sourceKind,
      locator: options.sourceLocator,
      publicLocator: options.publicLocator || null,
      title: options.sourceTitle,
      capturedAt: now,
      capturedBy: options.capturedBy,
      reliability: options.sourceReliability || reliabilityDefaults[options.sourceKind],
      contentHash: options.contentHash || null,
      redaction: options.redaction || 'none',
    };
  }
  const sourceIds = [
    ...new Set([...splitList(options.source), ...(generatedSource ? [generatedSource.id] : [])]),
  ];
  const entry = {
    id: await nextId(path.join(root, 'entries'), 'KB'),
    type: options.type,
    status: 'draft',
    title: options.title,
    scope: splitList(options.scope).length ? splitList(options.scope) : ['project'],
    statement: options.statement,
    tags: { domain: options.domain, feature: features },
    confidence:
      options.confidence ||
      (generatedSource?.kind === 'code' || generatedSource?.kind === 'test'
        ? 'high'
        : sourceIds.length
          ? 'medium'
          : 'low'),
    owners: splitList(options.owner),
    capturedBy: options.capturedBy,
    reviewedBy: null,
    createdAt: now,
    updatedAt: now,
    validUntil: options.validUntil || null,
    sources: sourceIds,
    relatedChanges: splitList(options.change).map(
      (change) => `change:${change.replace(/^change:/, '')}`,
    ),
    relatedEntries: [],
    conflict: [],
    supersedes: options.supersedes || null,
    supersededBy: null,
  };
  const current = await rebuild(root, { quiet: true });
  entry.conflict = Object.values(current.entries)
    .filter((other) => other.status === 'confirmed' && conflictCandidate(entry, other))
    .map((other) => other.id);
  const body = `## Statement\n\n${entry.statement}\n\n## Rationale / Context\n\n${options.context || 'Captured for later review.'}\n\n## Evidence\n\n${entry.sources.length ? entry.sources.map((id) => `- ${id}`).join('\n') : '- No source attached yet.'}\n\n## Open Questions\n\n- ${options.openQuestion || 'None.'}`;
  const sourceRecords = await loadRecords(path.join(root, 'sources'));
  const sourceMap = new Map(sourceRecords.map((record) => [record.data.id, record.data]));
  if (generatedSource) sourceMap.set(generatedSource.id, generatedSource);
  const entryErrors = validateEntry(entry, sourceMap, config);
  const sourceErrors = generatedSource ? validateSource(generatedSource) : [];
  if (entryErrors.length || sourceErrors.length) {
    throw new Error(
      `Capture validation failed:\n- ${[...sourceErrors, ...entryErrors].join('\n- ')}`,
    );
  }
  if (generatedSource) {
    console.log(
      `${options.write ? 'Writing' : 'Preview'} ${generatedSource.id}:\n${stringifyFrontmatter(generatedSource)}`,
    );
  }
  console.log(
    `${options.write ? 'Writing' : 'Preview'} ${entry.id}:\n${stringifyFrontmatter(entry)}\n${body}`,
  );
  if (!options.write) return;
  if (generatedSource) {
    const sourceBody = `## Summary\n\n${options.sourceSummary || 'Redacted source summary.'}`;
    await writeRecord(
      path.join(root, 'sources', `${generatedSource.id}.md`),
      generatedSource,
      sourceBody,
    );
  }
  await writeRecord(path.join(root, 'entries', `${entry.id}.md`), entry, body);
  if (entry.supersedes) await setReciprocalSupersedes(root, entry.id, entry.supersedes);
  await rebuild(root);
}

async function findEntry(root, id) {
  const file = path.join(root, 'entries', `${id}.md`);
  if (!(await exists(file))) throw new Error(`Entry not found: ${id}`);
  return { file, ...parseFrontmatter(await fs.readFile(file, 'utf8'), file) };
}

async function setReciprocalSupersedes(root, newId, oldId) {
  const newer = await findEntry(root, newId);
  const older = await findEntry(root, oldId);
  newer.data.supersedes = oldId;
  older.data.supersededBy = newId;
  older.data.status = 'deprecated';
  older.data.updatedAt = new Date().toISOString();
  await writeRecord(newer.file, newer.data, newer.body);
  await writeRecord(older.file, older.data, older.body);
}

async function review(root, options) {
  const id = options._[1];
  if (!id) throw new Error('review requires an entry id');
  const action = options.action;
  if (!['confirm', 'reject', 'merge', 'conflict'].includes(action))
    throw new Error('review --action must be confirm, reject, merge, or conflict');
  const record = await findEntry(root, id);
  const updated = { ...record.data, updatedAt: new Date().toISOString() };
  if (action === 'confirm') {
    if (!options.reviewer) throw new Error('confirm requires --reviewer');
    updated.status = 'confirmed';
    updated.reviewedBy = options.reviewer;
    if (options.confidence) updated.confidence = options.confidence;
  } else if (action === 'reject') {
    updated.status = 'rejected';
    updated.reviewedBy = options.reviewer || updated.reviewedBy;
  } else if (action === 'merge') {
    if (!options.into) throw new Error('merge requires --into KB-NNNN');
    updated.status = 'deprecated';
    updated.supersededBy = options.into;
  } else {
    if (!options.with) throw new Error('conflict requires --with KB-NNNN');
    updated.conflict = [...new Set([...(updated.conflict ?? []), options.with])];
  }
  const config = JSON.parse(await fs.readFile(path.join(root, 'knowledge.config.json'), 'utf8'));
  const sourceRecords = await loadRecords(path.join(root, 'sources'));
  const sourceMap = new Map(sourceRecords.map((source) => [source.data.id, source.data]));
  const errors = validateEntry(updated, sourceMap, config);
  if (errors.length) throw new Error(`Review validation failed:\n- ${errors.join('\n- ')}`);
  console.log(
    `${options.write ? 'Writing' : 'Preview'} ${id}: ${record.data.status} -> ${updated.status}`,
  );
  if (!options.write) return;
  await writeRecord(record.file, updated, record.body);
  if (action === 'merge') await setReciprocalSupersedes(root, options.into, id);
  if (action === 'conflict') {
    const other = await findEntry(root, options.with);
    other.data.conflict = [...new Set([...(other.data.conflict ?? []), id])];
    other.data.updatedAt = new Date().toISOString();
    await writeRecord(other.file, other.data, other.body);
  }
  await rebuild(root);
}

async function link(root, options) {
  const id = options._[1];
  const change = String(options.change || '').replace(/^change:/, '');
  if (!change) throw new Error('link requires --change <name>');
  if (options.fromProposal) {
    const proposal = path.resolve(String(options.fromProposal));
    const content = await fs.readFile(proposal, 'utf8');
    const ids = [...new Set(content.match(/\bKB-\d{4,}\b/g) ?? [])].sort();
    if (!ids.length) {
      console.log('No KB references found in the proposal; nothing to link.');
      return;
    }
    console.log(
      `${options.write ? 'Writing' : 'Preview'} ${ids.length} proposal link(s) -> change:${change}`,
    );
    if (!options.write) {
      for (const entryId of ids) console.log(`- ${entryId}`);
      return;
    }
    for (const entryId of ids) {
      const record = await findEntry(root, entryId);
      record.data.relatedChanges = [
        ...new Set([...(record.data.relatedChanges ?? []), `change:${change}`]),
      ];
      record.data.updatedAt = new Date().toISOString();
      await writeRecord(record.file, record.data, record.body);
    }
    await rebuild(root);
    return;
  }
  if (!id) throw new Error('link requires an entry id or --from-proposal <file>');
  const record = await findEntry(root, id);
  const relation = `change:${change}`;
  const relatedChanges = [...new Set([...(record.data.relatedChanges ?? []), relation])];
  console.log(`${options.write ? 'Writing' : 'Preview'} ${id} -> ${relation}`);
  if (!options.write) return;
  record.data.relatedChanges = relatedChanges;
  record.data.updatedAt = new Date().toISOString();
  await writeRecord(record.file, record.data, record.body);
  await rebuild(root);
}

function relativeTime(date) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86_400_000));
  return days === 0 ? 'today' : `${days}d ago`;
}

async function search(root, options) {
  const index = JSON.parse(await fs.readFile(path.join(root, 'index.json'), 'utf8'));
  const sourceRecords = await loadRecords(path.join(root, 'sources'));
  const sources = new Map(sourceRecords.map((record) => [record.data.id, record.data]));
  const statuses = options.status === 'all' ? [] : splitList(options.status || 'confirmed');
  const scopes = splitList(options.scope);
  const tags = splitList(options.tag);
  const keyword = String(options.keyword || options._.slice(1).join(' ')).toLowerCase();
  const change = options.change ? String(options.change).replace(/^change:/, '') : '';
  const rank = { high: 3, medium: 2, low: 1 };
  const results = Object.values(index.entries)
    .filter((entry) => !change || entry.relatedChanges.includes(`change:${change}`))
    .filter((entry) => !scopes.length || scopes.some((scope) => entry.scope.includes(scope)))
    .filter((entry) => !statuses.length || statuses.includes(entry.status))
    .filter((entry) => !options.type || entry.type === options.type)
    .filter(
      (entry) =>
        !tags.length ||
        tags.every((tag) => entry.tags.domain === tag || entry.tags.feature.includes(tag)),
    )
    .filter(
      (entry) =>
        !keyword || `${entry.id} ${entry.title} ${entry.statement}`.toLowerCase().includes(keyword),
    )
    .sort(
      (left, right) =>
        rank[right.confidence] - rank[left.confidence] ||
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (!results.length) {
    console.log('No matching knowledge entries.');
    return;
  }
  for (const entry of results) {
    const warnings = [
      ...entry.autoTags.filter((tag) => tag === 'stale'),
      ...(entry.conflict.length ? [`conflict:${entry.conflict.join(',')}`] : []),
    ];
    console.log(
      `[${entry.id}] ${entry.title}  (${entry.status}, ${entry.confidence}, updated ${relativeTime(entry.updatedAt)})${warnings.length ? ` [${warnings.join('; ')}]` : ''}`,
    );
    console.log(`Scope: ${entry.scope.join(', ')}`);
    console.log(
      `Sources: ${
        entry.sources.length
          ? entry.sources.map((sourceId) => sources.get(sourceId)?.locator || sourceId).join(', ')
          : 'none'
      }`,
    );
    console.log(
      `Changes: ${entry.relatedChanges.length ? entry.relatedChanges.join(', ') : 'none'}\n`,
    );
  }
}

function help() {
  console.log(`Usage: node openspec/knowledge/scripts/kb.mjs <command> [options]

Commands:
  rebuild                         Validate files and regenerate index.json
  search [keyword]                Search the derived index (default status: confirmed)
    --scope <scope> --type <type> --status <status|all> --tag <tag> --change <name> --json
  capture --type <type> --title <title> --statement <statement> --domain <tag>
    --owner <owner> --captured-by <name> [--scope <scope>] [--feature <tags>]
    [--source <SRC-id>] [--source-kind <kind> --source-locator <locator> --source-title <title>]
    [--source-summary <redacted text>] [--confidence <level>] [--change <name>]
    [--from-explore <n>]
    [--write]                      Preview unless --write is supplied
  review <KB-id> --action <confirm|reject|merge|conflict>
    [--reviewer <name>] [--confidence <level>] [--into <KB-id>] [--with <KB-id>] [--write]
  link <KB-id> --change <name> [--write]
  link --from-proposal <proposal.md> --change <name> [--write]

Mutating commands preview by default. Agents must never infer --write confirmation.`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const command = options._[0] || 'help';
  if (command === 'help' || options.help) return help();
  const root = await findKnowledgeRoot(options.root);
  if (command === 'rebuild') await rebuild(root);
  else if (command === 'search') await search(root, options);
  else if (command === 'capture') await capture(root, options);
  else if (command === 'review') await review(root, options);
  else if (command === 'link') await link(root, options);
  else throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
