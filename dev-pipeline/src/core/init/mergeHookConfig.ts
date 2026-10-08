type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 已有宿主配置不能安全合并时，在任何 Asset 写入前拒绝执行。 */
export function parseHookConfig(content: string, configPath: string): JsonObject {
  let parsed: unknown;
  try {
    // 与 fs-extra.readJson 一致，接受 Windows 编辑器可能写入的 UTF-8 BOM。
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`Invalid hook configuration JSON: ${configPath}`);
  }
  if (!isObject(parsed)) {
    throw new Error(`Hook configuration must be a JSON object: ${configPath}`);
  }
  if (parsed.hooks !== undefined && !isObject(parsed.hooks)) {
    throw new Error(`Hook configuration hooks must be an object: ${configPath}`);
  }
  if (isObject(parsed.hooks)) {
    const entries = parsed.hooks.PreToolUse;
    if (entries !== undefined && !Array.isArray(entries)) {
      throw new Error(`Hook configuration PreToolUse must be an array: ${configPath}`);
    }
  }
  if (parsed._opsxManaged !== undefined && !isObject(parsed._opsxManaged)) {
    throw new Error(`Hook configuration _opsxManaged must be an object: ${configPath}`);
  }
  return parsed;
}

function isPipelineHook(value: unknown): boolean {
  if (!isObject(value) || value.type !== 'command' || typeof value.command !== 'string') {
    return false;
  }
  // 只识别本 CLI 分发的两个脚本；同一 matcher 下的用户 Hook 仍然保留。
  const invocation = value.command.match(
    /^\s*(?:node(?:\.exe)?|"[^"\n]*[/\\]node(?:\.exe)?")\s+(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s|$)/i,
  );
  const script = invocation?.[1] ?? invocation?.[2] ?? invocation?.[3];
  return (
    script !== undefined &&
    /(?:^|[/\\])opsx-dev-pipeline[/\\]scripts[/\\]hooks[/\\](?:block-dangerous-bash|block-sensitive-write)\.mjs$/.test(
      script,
    )
  );
}

function keepUserEntries(entries: unknown[]): unknown[] {
  return entries.flatMap((entry) => {
    if (!isObject(entry) || !Array.isArray(entry.hooks)) return [entry];
    const hooks = entry.hooks.filter((hook) => !isPipelineHook(hook));
    if (hooks.length === entry.hooks.length) return [entry];
    if (
      hooks.length === 0 &&
      Object.keys(entry).every((key) => key === 'matcher' || key === 'hooks')
    ) {
      return [];
    }
    return [{ ...entry, hooks }];
  });
}

/** 合并配置而非拼接 JSON；旧 Pipeline Hook 被替换，重复 Sync 保持幂等。 */
export function mergeHookConfig(
  existingContent: string,
  generatedContent: string,
  configPath: string,
): string {
  const existing = parseHookConfig(existingContent, configPath);
  const generated = parseHookConfig(generatedContent, configPath);
  const existingHooks = (existing.hooks ?? {}) as JsonObject;
  const generatedHooks = (generated.hooks ?? {}) as JsonObject;
  const entries = keepUserEntries((existingHooks.PreToolUse ?? []) as unknown[]);
  const merged = {
    ...generated,
    ...existing,
    _opsxManaged: {
      ...((existing._opsxManaged ?? {}) as JsonObject),
      ...((generated._opsxManaged ?? {}) as JsonObject),
    },
    hooks: {
      ...generatedHooks,
      ...existingHooks,
      PreToolUse: [...entries, ...((generatedHooks.PreToolUse ?? []) as unknown[])],
    },
  };
  return `${JSON.stringify(merged, null, 2)}\n`;
}

/** 卸载只剥离 Pipeline 配置；返回 null 表示文件中没有需要保留的用户设置。 */
export function removePipelineHookConfig(content: string, configPath: string): string | null {
  const config = parseHookConfig(content, configPath);
  if (isObject(config.hooks)) {
    const hooks = { ...config.hooks };
    if (Array.isArray(hooks.PreToolUse)) {
      const entries = keepUserEntries(hooks.PreToolUse);
      if (entries.length > 0) hooks.PreToolUse = entries;
      else delete hooks.PreToolUse;
    }
    if (Object.keys(hooks).length > 0) config.hooks = hooks;
    else delete config.hooks;
  }
  if (isObject(config._opsxManaged) && config._opsxManaged.package === 'opsx-dev-pipeline') {
    const metadata = { ...config._opsxManaged };
    delete metadata.package;
    delete metadata.templateVersion;
    delete metadata.hooksEnabled;
    if (Object.keys(metadata).length > 0) config._opsxManaged = metadata;
    else delete config._opsxManaged;
  }
  const generatedSchemas = new Set([
    'https://json.schemastore.org/claude-code-settings.json',
    'https://opencode.ai/config.json',
  ]);
  const userKeys = Object.keys(config).filter(
    (key) => key !== '$schema' || !generatedSchemas.has(String(config.$schema)),
  );
  return userKeys.length > 0 ? `${JSON.stringify(config, null, 2)}\n` : null;
}
