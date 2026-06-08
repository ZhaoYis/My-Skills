# 维护索引

修改 `opsx-verify` skill 时，优先检查以下联动关系：

## 文件职责

- `SKILL.md.hbs`
  - 入口说明、约束摘要、Phase 导航、权威来源地图、与其他能力的关系
- `references/phase-*.md`
  - 各阶段详细执行步骤（解析目标 / 构建启动 / 功能校验 / 回归）
- `assets/verify-target-template.md`
  - 验证目标清单结构（与 opsx-design 验证断言字段对接）
- `assets/pass-criteria.md`
  - 通过标准与失败处理回路
- `scripts/opsx-verify-preflight.sh`
  - 预检项目基准、构建/测试命令可发现性

## 常见联动

- 修改"项目基准命令解析"描述时，同时更新：
  - `references/phase-2-build-and-run.md`
  - `references/phase-4-regression.md`
  - `scripts/opsx-verify-preflight.sh`
  - 并确认与 `opsx-dev-pipeline` Phase 3「项目基准」/ Phase 4 verify 解析描述一致
- 修改自动 vs 人工判定标准时，同时更新：
  - `references/phase-3-functional-check.md`
  - `assets/pass-criteria.md`
- 修改验证目标结构时，同时更新：
  - `assets/verify-target-template.md`
  - `references/phase-1-resolve-context.md`
  - 并确认与 `opsx-design` 的 `assets/section-skeleton.md` 第 8 节仍能对接

## 与 Pipeline 的单源归属

- 本 skill 是"如何验证"的能力库；`opsx-dev-pipeline` Phase 4 是"何时必须验证、是否放行归档"的门禁权威。
- 不要把 Phase 4 verify 门禁正文复制到这里；Phase 4 在需要完整验证时引用本 skill。

## 维护检查单

- 是否仍要求中文输出
- 命令是否仍一律"按项目基准"、无写死技术栈词
- 是否仍保留自动 vs 人工的判定标准
- 是否仍保留失败回路（而非直接判定结束）
- 是否仍与 opsx-design 的验证断言字段对接
- 命令模板与 skill 入口路径是否一致
