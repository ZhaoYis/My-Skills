export type RuleGroups = Record<string, string[]>;

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseRuleYaml(text: string): RuleGroups {
  const groups: RuleGroups = {};
  let current: string | undefined;

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    const keyMatch = line.match(/^([\w-]+):\s*$/);
    if (keyMatch?.[1]) {
      current = keyMatch[1];
      groups[current] = groups[current] ?? [];
      continue;
    }

    const itemMatch = line.match(/^\s+-\s+(.*)$/);
    if (itemMatch?.[1] && current) {
      groups[current].push(unquote(itemMatch[1].trim()));
    }
  }

  return groups;
}

export function mergeRuleGroups(packs: RuleGroups[]): RuleGroups {
  const merged: RuleGroups = {};
  for (const pack of packs) {
    for (const [category, rules] of Object.entries(pack)) {
      const existing = merged[category] ?? [];
      for (const rule of rules) {
        if (!existing.includes(rule)) {
          existing.push(rule);
        }
      }
      merged[category] = existing;
    }
  }
  return merged;
}

export function formatRuleGroups(groups: RuleGroups, categoryOrder: readonly string[]): string {
  const categories = [
    ...categoryOrder.filter((category) => (groups[category]?.length ?? 0) > 0),
    ...Object.keys(groups).filter(
      (category) => !categoryOrder.includes(category) && (groups[category]?.length ?? 0) > 0,
    ),
  ];

  return categories
    .map((category) => {
      const items = (groups[category] ?? [])
        .map((rule) => `    - ${JSON.stringify(rule)}`)
        .join('\n');
      return `  ${category}:\n${items}`;
    })
    .join('\n');
}
