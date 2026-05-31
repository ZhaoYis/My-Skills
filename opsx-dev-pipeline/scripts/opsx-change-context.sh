#!/usr/bin/env bash
set -euo pipefail

change="${1:?用法: $0 <change-name>}"

python3 - "$change" <<'PY'
import json
import sys
from pathlib import Path

change = sys.argv[1]
root = Path.cwd()
config_path = root / "openspec" / "config.yaml"
meta_path = root / "openspec" / "changes" / change / ".openspec.yaml"

if not config_path.exists():
    print(json.dumps({
        "schema": "spec-driven",
        "stacks": [],
        "contexts": [],
        "standards": [],
        "rulesSummary": {},
    }, ensure_ascii=False))
    raise SystemExit(0)

def parse_sections(text: str):
    sections = {}
    current = None
    current_sub = None
    for line in text.splitlines():
        if line and not line.startswith(" ") and line.endswith(":"):
            current = line[:-1].strip()
            sections.setdefault(current, {"context": [], "rules": []})
            current_sub = None
            continue
        if current is None:
            continue
        stripped = line.strip()
        if stripped == "context: |":
            current_sub = "context"
            continue
        if stripped == "rules:":
            current_sub = "rules"
            continue
        if current_sub == "context":
            if line.startswith("    "):
                sections[current]["context"].append(line[4:])
            elif stripped == "":
                sections[current]["context"].append("")
        elif current_sub == "rules":
            if line.startswith("    "):
                sections[current]["rules"].append(line[4:])
    return sections

config_text = config_path.read_text(encoding="utf-8")
sections = parse_sections(config_text)

schema = "default"
for line in config_text.splitlines():
    stripped = line.strip()
    if stripped.startswith("schema:"):
        schema = stripped.split(":", 1)[1].strip() or "default"
        break

stacks = []
if meta_path.exists():
    for line in meta_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("stacks:"):
            value = stripped.split(":", 1)[1].strip()
            if value.startswith("[") and value.endswith("]"):
                inner = value[1:-1].strip()
                if inner:
                    stacks = [item.strip() for item in inner.split(",") if item.strip()]
            elif value:
                stacks = [value]
            break

selected = ["shared", *stacks]
contexts = []
rules_summary = {}
standards = []
for key in selected:
    section = sections.get(key)
    if not section:
        continue
    context_text = "\n".join(section["context"]).strip("\n")
    if context_text:
        contexts.append({"section": key, "text": context_text})
        for line in context_text.splitlines():
            stripped = line.strip()
            if stripped.startswith("Standards:"):
                standards.append(stripped.split(":", 1)[1].strip())
    rule_lines = section["rules"]
    artifact = None
    for raw in rule_lines:
        stripped = raw.strip()
        if not stripped:
            continue
        if stripped.endswith(":") and not stripped.startswith("-"):
            artifact = stripped[:-1]
            rules_summary.setdefault(artifact, [])
            continue
        if stripped.startswith("-") and artifact:
            rules_summary[artifact].append({"section": key, "rule": stripped[1:].strip()})

result = {
    "schema": schema,
    "stacks": stacks,
    "contexts": contexts,
    "standards": standards,
    "rulesSummary": rules_summary,
}
print(json.dumps(result, ensure_ascii=False))
PY
