## Context

当前 pipeline 强制所有变更走完整 Phase 0-7 流程，即使 typo 修复也需要经历提案、审查、归档等阶段。需要引入 Route 分级机制，根据变更风险自动选择不同重量的 workflow 路径。

约束条件：
- 必须向后兼容，旧状态文件默认走 full route
- Route 选择必须在 Phase 0 完成，后续 phase 根据 route 配置决定是否执行
- Route 升级只允许向上（trivial → standard → full），不允许降级
- 配置存储在 `openspec/config.yaml`，状态存储在 `.pipeline-state/<name>.json`

## Goals / Non-Goals

**Goals:**
- 实现三个预定义 route（trivial/standard/full），每个 route 显式声明执行的 phases
- Phase 0 增加 Route 评估步骤，AI 推荐 + 用户确认
- 状态管理脚本支持 route 字段、transition 路由控制、route 升级命令
- 完全向后兼容，旧状态文件默认 full route

**Non-Goals:**
- 不实现自定义 route（只支持三个预定义 route）
- 不实现 Phase 2 门禁动态调整（保持 12 项门禁不变）
- 不实现 route 降级机制
- 不修改现有 phase 模板的内部逻辑（只修改 Phase 0 增加评估步骤）

## Decisions

### 1. Route 配置存储位置

**决策**: 在 `openspec/config.yaml` 中新增 `pipeline.routes` 配置节点

**理由**:
- config.yaml 是 OpenSpec 项目的标准配置文件，用户熟悉其位置
- 配置与代码分离，用户可以根据项目需求调整 route 定义
- 支持未来扩展自定义 route（虽然当前 Non-Goal）

**替代方案**:
- 硬编码在状态管理脚本中：不够灵活，用户无法调整
- 存储在单独的 route.yaml 文件中：增加配置文件数量，不如集中在 config.yaml

### 2. Route 选择时机

**决策**: 在 Phase 0 的 Step 2（判断入口类型）之后、进入具体 phase 之前执行 Route 评估

**理由**:
- Phase 0 是入口判断阶段，适合做流程决策
- 在环境预检完成后执行，确保基础条件满足
- 对于续接已有 change，如果状态已包含 route 则跳过评估，避免重复询问

**替代方案**:
- 在 `openspec new change` 命令时选择：太早，用户可能还不清楚变更范围
- 在每个 phase 开始前询问：太频繁，增加仪式成本

### 3. Route 升级机制

**决策**: 支持向上升级（trivial → standard → full），不允许降级。升级时更新 `route.choice`，记录 `route.upgradedFrom` 和 `route.upgradedAt`

**理由**:
- 向上升级符合风险递增的逻辑：发现风险比预期高时，需要更多保障
- 不允许降级防止跳过必要验证
- 记录升级历史便于审计和追溯

**替代方案**:
- 允许双向升级降级：降级可能跳过必要验证，存在风险
- 升级时回退到升级点重新执行：实现复杂，且已执行的 phase 不应重复

### 4. 状态文件扩展方式

**决策**: 新增 `route` 字段，包含 `choice`、`upgradedFrom`、`upgradedAt` 三个子字段

**理由**:
- 结构化存储 route 信息，便于查询和验证
- 升级历史记录在同一个字段下，逻辑清晰
- 向后兼容：旧状态文件无 `route` 字段时默认 full route

**替代方案**:
- 只存储 `route.choice`，不记录升级历史：丢失审计信息
- 在 `decisions` 字段下存储 route：与现有 decisions 逻辑混合，不够清晰

### 5. Transition 路由控制实现

**决策**: 在 `dev-pipeline-state.mjs` 的 `transition` 命令中增加 route 验证，检查目标 phase 是否在当前 route 的 `phases` 列表中

**理由**:
- transition 是 phase 跳转的唯一入口，在此处验证可以确保所有跳转都受 route 控制
- 验证逻辑简单：检查目标 phase 是否在 route.phases 数组中
- 错误处理清晰：返回 `phase-not-in-route` 错误

**替代方案**:
- 在每个 phase 模板中检查 route：分散逻辑，容易遗漏
- 在 phase 执行前检查：不够及时，可能在执行过程中才发现不允许

### 6. Route 推荐策略

**决策**: AI 基于需求描述的特征推荐 route，推荐依据：
- trivial：变更范围小、无行为变化、不影响 API 或配置语义
- standard：目标明确、风险可控、验证路径清晰
- full：高风险、涉及核心业务逻辑、需要完整验证和归档

**理由**:
- 基于特征的推荐简单直观，易于理解和验证
- 三个 route 的特征边界清晰，不容易混淆
- AI 推荐 + 用户确认的模式平衡了自动化和控制权

**替代方案**:
- 基于文件变更数量推荐：不够准确，10 个文件的 typo 修复仍然是 trivial
- 基于变更类型自动选择（如 git commit message）：太早，用户可能还没提交

## Risks / Trade-offs

**风险 1**: AI 推荐 route 不准确
- **缓解**: 用户确认机制确保最终决定权在用户
- **缓解**: 提供清晰的推荐依据，用户可以理解并修改

**风险 2**: Route 升级后发现应该降级
- **缓解**: 不允许降级是设计决策，防止跳过必要验证
- **缓解**: 用户可以终止当前 change，创建新 change 选择更低的 route

**风险 3**: 旧状态文件兼容性问题
- **缓解**: 默认使用 full route，保持现有行为
- **缓解**: 提供迁移命令（可选），让用户主动升级状态文件

**风险 4**: Route 配置错误导致流程异常
- **缓解**: 配置验证确保 phases 数组合法（0-7 范围，包含 Phase 0 和 6）
- **缓解**: 配置错误时输出清晰的错误信息

**权衡 1**: 灵活性 vs 简单性
- 选择三个预定义 route 而非自定义 route，牺牲灵活性换取简单性
- 理由：大多数变更可以归类为三个等级，自定义 route 增加复杂度但收益有限

**权衡 2**: 自动化 vs 控制权
- 选择 AI 推荐 + 用户确认，而非完全自动选择
- 理由：保留用户控制权，避免 AI 误判导致流程不当

## Migration Plan

### 部署步骤

1. **更新 config.yaml 模板**
   - 在 `src/config/` 中的 config.yaml 模板增加 `pipeline.routes` 默认配置
   - 新初始化的项目自动包含 route 配置

2. **更新 Phase 0 模板**
   - 在 `phase-0-entrance.md.hbs` 增加 Route 评估步骤
   - 使用 `npm run build` 重新编译模板

3. **更新状态管理脚本**
   - 在 `dev-pipeline-state.mjs` 增加 route 字段支持
   - 增加 transition 路由验证
   - 增加 `route upgrade` 命令
   - 使用 `npm run build` 重新编译脚本

4. **测试验证**
   - 运行 `npm test` 确保现有测试通过
   - 手动测试三个 route 的完整流程
   - 测试 route 升级场景
   - 测试旧状态文件兼容性

### 回滚策略

- 如果新版本的 route 机制出现问题，可以回滚到旧版本
- 旧版本不识别 `route` 字段，但不会报错（向后兼容）
- 旧状态文件在新版本中默认走 full route，保持现有行为

### 用户迁移

- 现有项目无需迁移，旧状态文件自动兼容
- 用户可以选择在 `openspec/config.yaml` 中增加 route 配置（可选）
- 如果不配置 route，系统默认使用 full route（现有行为）
