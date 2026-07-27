# Pipeline State JSON 字段字典

> 本文档完整描述 opsx-dev-pipeline 框架中 `.pipeline-state/*.json` 文件的所有字段、类型、枚举值及约束规则。
>
> `fingerprintId` 的 `fp1` 非对称加密格式是目标规范；模板实现完成升级前，现有 32 位 MD5 值按 `legacy-unverified` 兼容处理。

---

## 1. 概述

### 1.1 文件位置

```
<仓库根目录>/openspec/.pipeline-state/<changeName>.json
```

每个文件对应一个 OpenSpec change，目录由 `dev-pipeline-state.mjs` 自动创建，并在 `openspec/.gitignore` 中忽略。

### 1.2 命名规范

文件名与 change 名称一致，采用 kebab-case，长度 1-64 字符，正则：`/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/`

### 1.3 Schema 版本历史


| 版本  | 引入时间             | 主要变化                                                                                                                        |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| v1  | 初始版本             | 基础字段：`changeName`, `currentPhase`, `status`, `decisions`, `review`, `tests`, `verify`, `delivery`                           |
| v2  | Phase history 引入 | 新增 `_version`, `executionMode`, `phaseHistory`, `gatesBypassed`, `createdBy`, `machineInfo`, `featureInfo`, `fingerprintId` |
| v3  | Review rounds 重构 | `review` 对象增加 `rounds[]` 数组、`currentRound`；`reportPath` 改为暂存路径                                                              |


当前最新版本：**v3** (`schemaVersion: 3`)

---



## 2. 顶层字段


| 字段                 | 类型              | 必填  | Schema 版本 | 可变  | 描述                                                    |
| ------------------ | --------------- | --- | --------- | --- | ----------------------------------------------------- |
| `schemaVersion`    | `number`        | 是   | v1+       | 否   | Schema 版本号，当前固定为 `3`                                  |
| `_version`         | `number`        | 是   | v2+       | 自动  | 单调递增的写入计数器，用于乐观并发控制                                   |
| `changeName`       | `string`        | 是   | v1+       | 否   | kebab-case 格式的 change 名称                              |
| `sourceBranch`     | `string`        | 是   | v1+       | 是   | 功能分支名称                                                |
| `targetBranch`     | `string | null` | 是   | v1+       | 是   | 合并目标分支                                                |
| `currentPhase`     | `number`        | 是   | v1+       | 否   | 当前所处 Phase（0-6）                                       |
| `currentStep`      | `number`        | 是   | v1+       | 否   | 当前所处 Step                                             |
| `status`           | `string`        | 是   | v1+       | 否   | 流水线状态（见 [状态枚举](#23-流水线状态)）                            |
| `executionMode`    | `string`        | 是   | v2+       | 是   | 执行模式（见 [执行模式](#33-执行模式)）                              |
| `createdBy`        | `string`        | 是   | v2+       | 否   | 创建者标识（`git config user.name`）                         |
| `createdByEmail`   | `string`        | 是   | v2+       | 否   | 创建者邮箱（`git config user.email`）                        |
| `machineInfo`      | `object`        | 是   | v2+       | 否   | 机器指纹信息                                                |
| `featureInfo`      | `object | null` | 是   | v2+       | 是   | 外部需求关联信息                                              |
| `fingerprintId`    | `string`        | 是   | v2+       | 自动  | `fp1.<base64url>`，RSA-OAEP-SHA256（RSA-2048）加密的受保护字段摘要 |
| `fingerprintNonce` | `string`        | 是   | v2+       | 否   | 指纹随机盐（8 位 hex），属于受保护字段                                |
| `phaseHistory`     | `array`         | 是   | v2+       | 否   | Phase 执行历史记录                                          |
| `gatesBypassed`    | `string[]`      | 是   | v2+       | 否   | 全局跳过的门禁列表                                             |
| `decisions`        | `object`        | 是   | v1+       | 否   | 决策键值存储（见 [decisions 字段](#31-decisions-决策键)）           |
| `review`           | `object`        | 是   | v1+       | 部分  | 代码审查状态                                                |
| `tests`            | `object`        | 是   | v1+       | 部分  | 测试执行状态                                                |
| `verify`           | `object`        | 是   | v1+       | 部分  | 验证执行状态                                                |
| `archivePath`      | `string | null` | 是   | v1+       | 是   | 归档路径                                                  |
| `delivery`         | `object`        | 是   | v1+       | 部分  | 交付状态                                                  |
| `pauseReason`      | `string`        | 否   | v1+       | 否   | 暂停原因（仅在 `status=paused` 时存在）                          |
| `createdAt`        | `string`        | 是   | v1+       | 否   | 创建时间（格式：`YYYY-MM-DD HH:mm:ss`）                        |
| `updatedAt`        | `string`        | 是   | v1+       | 自动  | 最后更新时间（每次 `saveState` 自动刷新）                           |


升级后的 `fingerprintId` 格式为 `^fp1\.[A-Za-z0-9_-]{342}$`。生成端对以下固定顺序字段执行 canonical JSON 序列化：`schemaVersion`、`changeName`、`createdAt`、`createdBy`、`createdByEmail`、`machineInfo`、`featureId`、`fingerprintNonce`；其中 `featureId` 取 `featureInfo?.featureId ?? ""`。随后计算 SHA-256，并使用项目模板内固定的 RSA-2048 公钥和 OAEP-SHA256 加密 32 字节摘要。`featureUrl` 等其他可变字段不参与计算。

采集端必须使用对应私钥解密，并通过 `timingSafeEqual` 比较重算摘要。`fp1` 解密失败、摘要不一致或未知版本前缀均不得进入可信指标。固定公钥只能检测直接篡改，不能阻止公钥持有者为伪造内容重新加密；完整安全边界见 `metrics-system-design.md`。

### 2.1 流水线状态 (`status`)


| 值           | 含义         | 设置方式                         |
| ----------- | ---------- | ---------------------------- |
| `active`    | 流水线正在运行    | `init` 初始化、`transition` 阶段转换 |
| `paused`    | 流水线已暂停，可恢复 | `pause` 命令、连续 3 次 attempt 失败 |
| `completed` | 流水线已完成     | `complete` 命令（仅 Phase 6 可执行） |




### 2.2 字段可变性说明

- **自动**：由 `dev-pipeline-state.mjs` 自动维护，不接受 `set` 命令修改
- **是**：可通过 `set` 命令修改（属于 `mutablePaths` 集合）
- **否**：只能通过专用命令间接修改（`decision`、`transition`、`attempt`、`record-phase` 等）
- **部分**：部分子字段可修改

---



## 3. 嵌套对象详解



### 3.1 `machineInfo` — 机器信息


| 字段            | 类型       | 描述                                 |
| ------------- | -------- | ---------------------------------- |
| `platform`    | `string` | 操作系统平台（`os.platform()`，如 `darwin`） |
| `hostname`    | `string` | 主机名（`os.hostname()`）               |
| `osRelease`   | `string` | OS 版本号（`os.release()`）             |
| `nodeVersion` | `string` | Node.js 版本（`process.version`）      |
| `arch`        | `string` | CPU 架构（`os.arch()`，如 `arm64`）      |


加载旧版本 Schema 状态时，缺失的字段会填充为 `"unknown"`。

### 3.2 `featureInfo` — 外部需求关联


| 字段           | 类型              | 描述                       |
| ------------ | --------------- | ------------------------ |
| `featureId`  | `string`        | 外部需求系统 ID（如 JIRA、ONES 等） |
| `featureUrl` | `string | null` | 外部需求链接                   |


注意：

- `featureUrl` 不能脱离 `featureId` 单独提供
- 设为 `null` 表示显式跳过需求关联
- 初始化时必须提供 `--feature-id` 或 `--skip-feature-association`
- `featureId` 属于指纹受保护字段；通过 `set featureInfo` 或 `set featureInfo.featureId` 修改时，脚本必须使用原 nonce 在同一次原子保存中自动重算 `fingerprintId`
- 仅修改 `featureUrl` 不触发指纹重算；直接编辑 JSON 修改 `featureId` 会在采集校验时失败



### 3.3 执行模式 (`executionMode`)


| 值            | 描述                                         |
| ------------ | ------------------------------------------ |
| `pipeline`   | 全流程流水线模式，Phase 转换由 pipeline 编排器管理（默认）      |
| `standalone` | 独立命令模式，每个 Phase 由用户手动调用（如 `/opsx:propose`） |
| `hybrid`     | 混合模式，可随时从任意记录的 Phase/Step 恢复执行             |


执行模式仅作为审计标记记录，**不影响 Phase 转换规则和门禁验证**。

### 3.4 `phaseHistory[]` — Phase 执行历史

每条记录的结构：

```json
{
  "phase": 1,
  "step": 5,
  "executedBy": "pipeline",
  "status": "completed",
  "startedAt": "2026-07-26 21:41:51",
  "completedAt": "2026-07-26 21:57:03",
  "decisions": {
    "requirementsConfirmed": true,
    "proposalApproved": true
  },
  "gatesBypassed": ["review-skipped"]
}
```


| 字段              | 类型              | 描述                              |
| --------------- | --------------- | ------------------------------- |
| `phase`         | `number`        | Phase 编号（0-6）                   |
| `step`          | `number`        | Step 编号                         |
| `executedBy`    | `string`        | 执行者标识（见下文）                      |
| `status`        | `string`        | 条目状态                            |
| `startedAt`     | `string`        | 开始时间                            |
| `completedAt`   | `string | null` | 完成时间（`in-progress` 状态时为 `null`） |
| `decisions`     | `object`        | 该时刻的 decisions 快照               |
| `gatesBypassed` | `string[]`      | 该条目中跳过的门禁                       |




#### `executedBy` 常见值


| 值                         | 含义                       |
| ------------------------- | ------------------------ |
| `pipeline`                | 由流水线编排器自动记录              |
| `openspec-propose`        | 由 `/opsx:propose` 独立命令执行 |
| `openspec-apply-change`   | 由 `/opsx:apply` 独立命令执行   |
| `openspec-archive-change` | 由 `/opsx:archive` 独立命令执行 |
| `openspec-verify-change`  | 由 `/opsx:verify` 独立命令执行  |
| `opsx-dev-pipeline`       | 由主流水线 skill 执行           |
| `composer`                | 由入口判断阶段（Phase 0）执行       |




#### 条目状态


| 值             | 含义                        |
| ------------- | ------------------------- |
| `in-progress` | 该条目正在执行中                  |
| `completed`   | 该条目已完成                    |
| `abandoned`   | 该条目已放弃（通过 `--abandon` 标志） |




### 3.5 `decisions` — 决策键

`decisions` 是一个自由形式的键值对象，键名需匹配正则 `/^[A-Za-z][A-Za-z0-9]*$/`。以下是框架中使用的所有已知决策键：


| 键                         | 类型        | 设置 Phase       | 可能的值                                                    | 描述                          |
| ------------------------- | --------- | -------------- | ------------------------------------------------------- | --------------------------- |
| `requirementsConfirmed`   | `boolean` | Phase 1 Step3  | `true`                                                  | 需求理解已确认                     |
| `proposalApproved`        | `boolean` | Phase 1 Step5  | `true`                                                  | 提案已批准（**进入 Phase 2 的门禁**）   |
| `implementationConfirmed` | `boolean` | Phase 2 Step8  | `true`                                                  | 实施摘要已确认（**离开 Phase 2 的门禁**） |
| `reviewDisposition`       | `string`  | Phase 2 Step8  | `"review"` / `"skip-review"`                            | 审查方向：进入审查或跳过审查              |
| `reviewResult`            | `string`  | Phase 3 Step12 | `"passed"` / `"issues-found"`                           | 审查结果                        |
| `postArchiveAction`       | `string`  | Phase 5 Step19 | `"merge"` / `"push-only"` / `"local-only"`              | 归档后交付方式（**进入 Phase 6 的门禁**） |
| `commitApproved`          | `boolean` | Phase 6 Step21 | `true`                                                  | 提交已确认                       |
| `sourcePushApproved`      | `boolean` | Phase 6 Step22 | `true`                                                  | 源分支推送已确认                    |
| `fixProposalPath`         | `string`  | Phase 3 修复子流程  | 文件路径                                                    | 修复提案文档路径                    |
| `fixProposalGenerated`    | `boolean` | Phase 3 修复子流程  | `true`                                                  | 修复提案已生成                     |
| `fixProposalApproved`     | `boolean` | Phase 3 修复子流程  | `true`                                                  | 修复提案已批准                     |
| `fixApplied`              | `boolean` | Phase 3 修复子流程  | `true`                                                  | 修复已实施                       |
| `targetPushApproved`      | `boolean` | Phase 6 Step24 | `true`                                                  | 目标分支推送已确认                   |
| `mergeApproved`           | `boolean` | Phase 6 Step23 | `true`                                                  | 合并已确认                       |
| `mergeStrategy`           | `string`  | Phase 6 Step23 | `"Standard merge"` / `"Squash merge"` / `"No-ff merge"` | 合并策略                        |


> **注意**：`decisions` 是累积式的，新的 decision 不会清除已有键。在所有 `phaseHistory` 条目中也会保存当时的 decisions 快照。



### 3.6 `review` — 代码审查状态



#### Schema v3 结构


| 字段             | 类型              | 描述                     |
| -------------- | --------------- | ---------------------- |
| `currentRound` | `number`        | 当前审查轮次                 |
| `rounds`       | `array`         | 审查轮次历史记录               |
| `reportPath`   | `string | null` | 当前暂存的审查报告路径（下一轮将关联此路径） |
| `status`       | `string`        | 当前审查状态                 |




#### `review.status` 枚举


| 值              | 描述             |
| -------------- | -------------- |
| `pending`      | 尚未执行审查（初始化默认值） |
| `passed`       | 审查通过           |
| `issues-found` | 发现问题           |




#### `review.rounds[]` 条目结构


| 字段           | 类型              | 描述                                 |
| ------------ | --------------- | ---------------------------------- |
| `round`      | `number`        | 轮次编号                               |
| `reportPath` | `string | null` | 该轮的审查报告路径                          |
| `status`     | `string`        | 该轮结果：`"passed"` / `"issues-found"` |
| `timestamp`  | `string`        | 记录时间（格式：`YYYY-MM-DD HH:mm:ss`）     |
| `decisions`  | `object`        | 该轮时的 decisions 快照                  |




#### 审查限制规则

- 连续 3 轮 `issues-found` 会触发自动暂停，`pauseReason` 设为 `"review-attempt-limit-reached"`
- 计数仅在**连续**失败时累计，中间有一轮 `passed` 则计数重置
- `review.status`、`review.currentRound`、`review.rounds` 为**受保护字段**，不能用 `set` 直接修改



### 3.7 `tests` — 测试状态


| 字段         | 类型              | 描述                 |
| ---------- | --------------- | ------------------ |
| `command`  | `string | null` | 测试命令（如 `npm test`） |
| `attempts` | `number`        | 已执行尝试次数            |
| `status`   | `string`        | 测试状态               |
| `detail`   | `string | null` | 附加说明               |




#### `tests.status` 枚举


| 值               | 描述             |
| --------------- | -------------- |
| `pending`       | 尚未执行测试（初始化默认值） |
| `passed`        | 测试通过           |
| `failed`        | 测试失败           |
| `skipped`       | 用户显式跳过测试       |
| `debt-recorded` | 跳过测试但已记录技术债务   |




#### 测试限制规则

- 连续 3 次 `failed` 触发自动暂停，`pauseReason` 设为 `"tests-attempt-limit-reached"`
- 进入 Phase 5 的门禁：`tests.status` 必须为 `"passed"` / `"skipped"` / `"debt-recorded"` 之一



### 3.8 `verify` — 验证状态


| 字段         | 类型              | 描述                       |
| ---------- | --------------- | ------------------------ |
| `command`  | `string | null` | 验证命令（如 `npm run verify`） |
| `attempts` | `number`        | 已执行尝试次数                  |
| `status`   | `string`        | 验证状态                     |
| `detail`   | `string | null` | 附加说明                     |




#### `verify.status` 枚举


| 值         | 描述             |
| --------- | -------------- |
| `pending` | 尚未执行验证（初始化默认值） |
| `passed`  | 验证通过           |
| `failed`  | 验证失败           |
| `skipped` | 用户确认跳过验证       |




#### 验证限制规则

- 连续 3 次 `failed` 触发自动暂停，`pauseReason` 设为 `"verify-attempt-limit-reached"`
- 进入 Phase 6 的门禁：`verify.status` 必须为 `"passed"` 或 `"skipped"`



### 3.9 `delivery` — 交付状态


| 字段               | 类型              | 描述                   |
| ---------------- | --------------- | -------------------- |
| `commitSha`      | `string | null` | 功能分支的提交 SHA          |
| `mergeCommitSha` | `string | null` | 合并提交 SHA（仅 merge 模式） |
| `sourcePushed`   | `boolean`       | 源分支是否已推送             |
| `targetPushed`   | `boolean`       | 目标分支是否已推送            |
| `tag`            | `string | null` | 标签名称（如果创建）           |


---



## 4. Phase 与 Step 参考



### 4.1 Phase 总览


| Phase | 名称     | Step 范围 | 描述                                              |
| ----- | ------ | ------- | ----------------------------------------------- |
| 0     | 入口判断   | 1-2     | 环境预检、入口类型判断（已有 change / 新需求 / 非流水线模式）           |
| 1     | 提案编写   | 3-5     | 需求理解确认 → 创建 change 并生成制品 → 提案确认                 |
| 2     | 提案应用   | 6-8     | 获取实施指令 → 逐任务实施 → 实施完成确认                         |
| 3     | 代码审查   | 9-12    | 加载规范 → 获取变更 → 多维度审查 → 审查结果处理（含修复子流程 R1-R4）      |
| 4     | 单元测试门禁 | 13-14   | 识别测试方式 → 是否需要单元测试                               |
| 5     | 提案归档   | 15-19   | 检查制品 → verify 门禁 → delta spec 同步 → 归档 → 归档后操作选择 |
| 6     | 合并推送   | 20-26   | 预提交检查 → 提交 → 推送 → 合并 → 目标推送 → 清理与标签 → 完成        |




### 4.2 Step 详细映射



#### Phase 0 — 入口判断


| Step | 名称     | 执行者                     |
| ---- | ------ | ----------------------- |
| 1    | 环境预检   | `pipeline` / `composer` |
| 2    | 入口类型判断 | `composer`              |




#### Phase 1 — 提案编写


| Step | 名称                  | 执行者                             |
| ---- | ------------------- | ------------------------------- |
| 3    | 决策点 1a：需求理解确认       | `pipeline`                      |
| 4    | 创建 change 并生成制品     | `openspec-propose`              |
| 5    | 决策点 1：提案确认（**硬门禁**） | `pipeline` / `openspec-propose` |




#### Phase 2 — 提案应用


| Step | 名称           | 执行者                     |
| ---- | ------------ | ----------------------- |
| 6    | 获取实施指令       | `pipeline`              |
| 7    | 逐任务实施        | `openspec-apply-change` |
| 8    | 决策点 2：实施完成确认 | `pipeline`              |




#### Phase 3 — 代码审查


| Step | 名称           | 执行者                 |
| ---- | ------------ | ------------------- |
| 9    | 加载项目规范       | `pipeline`          |
| 10   | 获取变更内容       | `pipeline`          |
| 11   | 执行代码审查       | `pipeline`          |
| 12   | 决策点 3：审查结果处理 | `pipeline`          |
| R1   | 生成修复提案       | `pipeline`（fix 子流程） |
| R2   | 修复提案门禁       | `pipeline`（fix 子流程） |
| R3   | 实施修复         | `pipeline`（fix 子流程） |
| R4   | 重新审查         | `pipeline`（fix 子流程） |




#### Phase 4 — 单元测试门禁


| Step | 名称             | 执行者        |
| ---- | -------------- | ---------- |
| 13   | 识别测试方式         | `pipeline` |
| 14   | 决策点 4：是否需要单元测试 | `pipeline` |




#### Phase 5 — 提案归档


| Step | 名称              | 执行者                       |
| ---- | --------------- | ------------------------- |
| 15   | 检查制品和任务完成状态     | `pipeline`                |
| 16   | 归档前 verify 门禁   | `openspec-verify-change`  |
| 17   | Delta spec 同步检查 | `openspec-sync-specs`     |
| 18   | 执行归档            | `openspec-archive-change` |
| 19   | 决策点 5b：归档后操作    | `pipeline`                |




#### Phase 6 — 合并推送


| Step | 名称            | 执行者                 |
| ---- | ------------- | ------------------- |
| 20   | 读取状态与预提交检查    | `pipeline`          |
| 21   | 决策点 6：分步暂存与提交 | `pipeline`          |
| 22   | 源分支推送门禁       | `pipeline`          |
| 23   | 决策点 7：目标分支与合并 | `pipeline`          |
| 24   | 合并后验证与目标推送    | `pipeline`          |
| 25   | 源分支清理与标签      | `pipeline`          |
| 26   | 完成状态与摘要       | `opsx-dev-pipeline` |


---



## 5. 状态转换规则



### 5.1 允许的 Phase 转换

```
0 → 0, 1
1 → 1, 2
2 → 1, 2, 3, 4
3 → 2, 3, 4
4 → 2, 4, 5
5 → 1, 2, 5, 6
6 → 6
```

- 向前跳转（如 0→5）会逐 Phase 验证所有中间门禁
- 向后回退（如 3→2）允许，用于修正决策后重试
- Phase 6 不可回退



### 5.2 门禁验证规则


| 门禁    | 条件                                                                          | 错误码                                    |
| ----- | --------------------------------------------------------------------------- | -------------------------------------- |
| 提案审批  | 进入 Phase 2 前 `decisions.proposalApproved === true`                          | `proposal-approval-required`           |
| 实施确认  | 离开 Phase 2（进入 3 或 4）前 `decisions.implementationConfirmed === true`          | `implementation-confirmation-required` |
| 测试门禁  | 进入 Phase 5 前 `tests.status ∈ {passed, skipped, debt-recorded}`              | `test-gate-required`                   |
| 验证门禁  | 进入 Phase 6 前 `verify.status ∈ {passed, skipped}`                            | `verify-gate-required`                 |
| 归档门禁  | 进入 Phase 6 前 `archivePath` 不为空                                              | `archive-required`                     |
| 归档后决策 | 进入 Phase 6 前 `decisions.postArchiveAction ∈ {merge, push-only, local-only}` | `post-archive-decision-required`       |




### 5.3 门禁跳过的记录机制

- 独立命令执行中跳过的门禁记录在 `phaseHistory[].gatesBypassed` 中（如 `["review-skipped"]`）
- 同步到全局 `gatesBypassed` 数组
- `gatesBypassed` 是审计记录，**不能**绕过 `validateGates()` 的强制门禁检查
- 要跳过某个门禁，必须设置对应字段（如 `tests.status = "skipped"`）

---



## 6. 可变路径



### 6.1 可通过 `set` 命令修改的字段

```
sourceBranch
targetBranch
executionMode
featureInfo
featureInfo.featureId
featureInfo.featureUrl
archivePath
review.reportPath
tests.command
tests.status
tests.detail
verify.command
verify.status
verify.detail
delivery.commitSha
delivery.mergeCommitSha
delivery.sourcePushed
delivery.targetPushed
delivery.tag
```



### 6.2 受保护字段（不能用 `set` 直接修改）


| 字段                                                        | 修改方式                                                 |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `status` (顶层)                                             | `transition` / `pause` / `complete` / attempt 超限自动暂停 |
| `currentPhase` / `currentStep`                            | `transition`                                         |
| `decisions.*`                                             | `decision` 命令                                        |
| `review.status` / `review.currentRound` / `review.rounds` | `attempt review` 命令                                  |
| `_version` / `updatedAt`                                  | 自动维护（每次 `saveState`）                                 |
| `phaseHistory`                                            | `transition` / `record-phase`                        |
| `gatesBypassed`                                           | `record-phase`                                       |
| `fingerprintId`                                           | `init` / legacy 迁移 / `featureId` 受控变更时自动重算           |
| `fingerprintNonce`                                        | `init` 生成；后续重算保持不变                                   |




### 6.3 各命令修改的字段汇总


| 命令                         | 修改的字段                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `init`                     | 创建全部字段                                                                                 |
| `transition`               | `currentPhase`, `currentStep`, `status`, `phaseHistory`                                |
| `decision <key> <value>`   | `decisions.<key>`                                                                      |
| `set <path> <value>`       | 可变路径中的单个字段；修改 `featureInfo` / `featureInfo.featureId` 且需求 ID 发生变化时同步重算 `fingerprintId` |
| `attempt review <status>`  | `review.currentRound`, `review.rounds[]`, `review.status`, `review.reportPath`         |
| `attempt tests <status>`   | `tests.attempts`, `tests.status`                                                       |
| `attempt verify <status>`  | `verify.attempts`, `verify.status`                                                     |
| `record-phase`             | `phaseHistory[]`, `gatesBypassed`                                                      |
| `pause <reason>`           | `status`, `pauseReason`                                                                |
| `complete`                 | `status`                                                                               |
| `migrate-schema --confirm` | `schemaVersion`, `review` 结构重组                                                         |


---



## 7. Schema 迁移



### 7.1 v1 → v3 迁移

v1 状态文件缺少以下 v2/v3 字段，迁移时自动填充：


| 字段                 | v1 值 | v3 填充值         |
| ------------------ | ---- | -------------- |
| `schemaVersion`    | `1`  | → `3`          |
| `_version`         | 不存在  | → `1`          |
| `executionMode`    | 不存在  | → `"pipeline"` |
| `phaseHistory`     | 不存在  | → `[]`         |
| `gatesBypassed`    | 不存在  | → `[]`         |
| `createdBy`        | 不存在  | → `"unknown"`  |
| `createdByEmail`   | 不存在  | → `""`         |
| `machineInfo.*`    | 不存在  | → `"unknown"`  |
| `featureInfo`      | 不存在  | → `null`       |
| `fingerprintId`    | 不存在  | → `""`         |
| `fingerprintNonce` | 不存在  | → `""`         |




### 7.2 v2 → v3 迁移（Review 结构）

v2 的 `review` 对象是扁平结构 `{ round, reportPath, status }`，v3 重构为：

```
review (v2):                          review (v3):
{                                     {
  "round": 2,              →           "currentRound": 2,
  "reportPath": "...",                "rounds": [
  "status": "issues-found"              {
}                                         "round": 2,
                                          "reportPath": "...",
                                          "status": "issues-found",
                                          "timestamp": "<updatedAt>",
                                          "decisions": { ... }
                                        }
                                      ],
                                      "reportPath": null,
                                      "status": "issues-found"
                                    }
```

迁移需要用户显式确认（`--confirm`），且是幂等操作（`already-v3`）。

### 7.3 Legacy MD5 → `fp1` 迁移

- 32 位十六进制 `fingerprintId` 只识别为 `legacy-unverified`，不得标记为已验真。
- 模板升级后使用当前 `featureInfo.featureId` 和固定公钥为状态文件重新生成 `fp1` 指纹，不需要也不得读取服务端私钥。
- 无法改写的历史 commit 可单独保留，但默认指标查询只统计 `fingerprintVerified=true` 的快照。
- 已是 `fp1` 但解密失败的状态属于篡改或密钥配置错误，不得回退为 legacy 数据。

---



## 8. 并发控制

`_version` 和 `_readVersion` 共同实现乐观并发控制：

1. 加载状态时，`_version` 的快照记录到不可枚举的 `_readVersion`
2. 保存时，比较磁盘上的 `_version` 与 `_readVersion`
3. 如果不一致，说明状态被其他会话修改，返回错误 `pipeline-state-concurrent-modification`
4. 如果一致，`_version += 1` 后原子写入（先写 `.tmp`，再 `rename`）

---



## 9. 完整 JSON 示例

```json
{
  "schemaVersion": 3,
  "_version": 31,
  "changeName": "add-beginner-tutorial",
  "sourceBranch": "feature/lite",
  "targetBranch": null,
  "currentPhase": 6,
  "currentStep": 20,
  "status": "completed",
  "executionMode": "hybrid",
  "createdBy": "大師兄丶",
  "createdByEmail": "zhaoyi_dsx@163.com",
  "machineInfo": {
    "platform": "darwin",
    "hostname": "JerryDiff-2.local",
    "osRelease": "25.5.0",
    "nodeVersion": "v24.11.1",
    "arch": "arm64"
  },
  "featureInfo": {
    "featureId": "WELCOME-2026-02",
    "featureUrl": "https://www.baidu.com"
  },
  "fingerprintId": "fp1.SXJvQWVwU2hhMjU2Q2lwaGVydGV4dF9leGFtcGxlX3RydW5jYXRlZA",
  "fingerprintNonce": "3cbe8198",
  "phaseHistory": [
    {
      "phase": 0,
      "step": 1,
      "executedBy": "pipeline",
      "status": "completed",
      "startedAt": "2026-07-26 21:41:51",
      "completedAt": "2026-07-26 21:41:51",
      "decisions": {},
      "gatesBypassed": []
    }
  ],
  "gatesBypassed": [],
  "decisions": {
    "requirementsConfirmed": true,
    "proposalApproved": true,
    "implementationConfirmed": true,
    "reviewDisposition": "review",
    "reviewResult": "passed",
    "postArchiveAction": "push-only",
    "sourcePushApproved": true
  },
  "review": {
    "currentRound": 1,
    "rounds": [
      {
        "round": 1,
        "reportPath": "openspec/review/2026-07-26-22-01-feature-lite-pipeline-review.md",
        "status": "passed",
        "timestamp": "2026-07-26 22:01:22",
        "decisions": {
          "reviewDisposition": "review",
          "reviewResult": "passed"
        }
      }
    ],
    "reportPath": "openspec/review/2026-07-26-22-01-feature-lite-pipeline-review.md",
    "status": "passed"
  },
  "tests": {
    "command": null,
    "attempts": 0,
    "status": "skipped",
    "detail": "单文件 HTML 游戏项目，无测试基础设施"
  },
  "verify": {
    "command": null,
    "attempts": 0,
    "status": "skipped",
    "detail": "E2E 验证通过"
  },
  "archivePath": "openspec/changes/archive/2026-07-26-add-beginner-tutorial",
  "delivery": {
    "commitSha": "4736c7c",
    "mergeCommitSha": null,
    "sourcePushed": true,
    "targetPushed": false,
    "tag": null
  },
  "createdAt": "2026-07-26 21:41:51",
  "updatedAt": "2026-07-26 22:02:00"
}
```

示例中的 `fingerprintId` 为便于阅读而截断；实际 `fp1` 值由 4 字符版本前缀和 342 字符 Base64URL 密文组成。