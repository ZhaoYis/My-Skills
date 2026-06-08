# Phase 3：产出结构化需求并交接

## 目标

把 Phase 2 的结构化要素整理成一份可直接喂给 `opsx-analysis` 的结构化需求，并明确待确认项。

## 执行步骤

1. **套用模板**
   - 按 `assets/structured-requirement-template.md` 组织输出。

2. **汇总待确认项**
   - 把 Phase 1/2 中所有"推断"与"空白"汇总为待确认问题；若需要对外提问，可转 `opsx-clarify`。

3. **交接给 opsx-analysis**
   - 提示：该结构化需求可作为 `opsx-analysis` 的输入，进入功能点拆解与影响面分析。
   - 不在本 skill 内做实施级设计；设计交由 `opsx-design`。

## 输出要求

- 一份符合模板的结构化需求。
- 一份待确认项清单。
- 采集路径标注（外部工具 / 降级）。

## Guardrails

- 不越界产出最终设计或实现方案。
- 待确认项必须显式列出，不静默替用户补全。
