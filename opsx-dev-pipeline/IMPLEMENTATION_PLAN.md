# opsx-dev-pipeline skill 实施方案

## 目标

本方案用于指导后续对 `opsx-dev-pipeline` skill 做结构优化，重点不是改变执行语义，而是降低文档重复、明确单一事实来源，并把维护流程变成可操作的 change-impact 驱动模式。

本次优化目标：

1. 将 `SKILL.md` 从“总手册”收缩为“入口页 / 导航页”
2. 将全局规则收敛到 `references/recovery-guardrails-appendix.md`
3. 将 `assets/decision-point-index.md` 与 `assets/failure-recovery-index.md` 收缩为索引文档
4. 将 `assets/maintenance-index.md` 升级为维护控制台与变更影响矩阵
5. 为后续 skill 自身维护建立 plan-first 的默认流程

---

## 实施原则

1. **先收权，再删摘要**
   - 先明确唯一权威来源，再删除重复说明。
2. **只做结构优化，不改流程语义**
   - 不改变决策点含义、不改变阶段顺序、不改变门禁。
3. **正文下沉，入口变薄**
   - `SKILL.md` 只保留入口、导航和极简摘要。
4. **索引只做索引，不再做第二套规范**
   - `assets/*.md` 只回答“去哪看”和“改哪里会影响哪里”。

---

## 目标职责分层

### `SKILL.md`
只保留：
- skill metadata
- Input
- 最小执行约束摘要
- Phase 导航表
- 权威来源地图
- 极简流程概览
- 维护入口提示

不再承担：
- 全局规则正文
- 决策自动化分级正文
- 已有 change 续接规则正文
- 大型脚本表
- 长流程要点复述

### `references/phase-*.md`
继续作为各阶段执行正文，负责：
- 前置条件
- 步骤
- 命令
- 阶段内决策点
- 阶段内恢复点
- 阶段间交接

### `references/recovery-guardrails-appendix.md`
作为跨阶段规则唯一正文，负责：
- Guardrails
- AskQuestion fallback
- Error Handling
- 决策自动化分级
- 统一动作语义
- 已有 change 的保守恢复原则

### `assets/decision-point-index.md`
收缩为决策点索引，保留：
- ID
- Phase
- 触发条件
- 主要选项
- 下一步
- 恢复续接点
- 权威来源

不再承担第二套决策规则正文。

### `assets/failure-recovery-index.md`
收缩为失败恢复导航矩阵，保留：
- 失败场景
- 恢复动作
- 恢复续接点
- 是否需要确认
- 权威来源

不再承担第二套 Error Handling 正文。

### `assets/maintenance-index.md`
升级为维护控制台，负责：
- 变更类型 → 权威文件矩阵
- 变更类型 → 同步更新矩阵
- 变更类型 → 验证矩阵
- 常见遗漏点清单
- plan-first 维护流程

---

## 逐文件改动清单

### 1. `SKILL.md`

#### 删除 / 下沉
- 下沉大部分规则正文到 `references/recovery-guardrails-appendix.md`
- 删除或显著缩短：
  - `全局步骤索引（跨 Phase 连续编号）`
  - `兼容性、降级与子技能 fallback（摘要）`
  - `脚本（可选）`中的大表
  - `要点（与引用文件同序）`
- 删除或缩短与 appendix 重复的内容：
  - `澄清后强制回到流程`
  - `退出须用户同意`
  - `决策点默认规则（摘要）`

#### 保留
- frontmatter / metadata
- `Input`
- `Phase 引用表`
- `流程概览（Mermaid）`，但明确标注“仅示意，以 references 为准”
- 一句维护入口提示

#### 新增
- 新增：`权威来源地图`
- 新增：`最小执行约束摘要`
- 可选新增：`阅读顺序（精简版）`

#### 核对
- `SKILL.md` 是否还能引导读者找到当前 phase 与 appendix
- 是否不再完整定义：
  - 续接规则
  - 决策自动化分级
  - AskQuestion fallback
  - Error Handling

---

### 2. `references/recovery-guardrails-appendix.md`

#### 删除 / 下沉
- 不做大删减，重点是承接权威职责
- 避免吸收维护矩阵内容

#### 保留
- `流水线中断与恢复`
- `AskQuestion 不可用`
- `子技能缺失时的 fallback 对照表`
- `Schema 识别与适配`
- `Guardrails`
- `Error Handling`
- `决策点总览`
- `决策自动化分级`
- `统一动作语义`
- `已有 change 续接的保守恢复建议`

#### 新增
- 新增或强化定位声明：
  - 本文件是跨阶段规则、恢复、降级与决策总则的唯一正文来源
- 可补一段说明：
  - `SKILL.md` 只做摘要
  - `assets/*.md` 只做索引

#### 核对
- 是否已成为以下主题的唯一正文：
  - Guardrails
  - AskQuestion fallback
  - Error Handling
  - 决策自动化分级
  - 统一动作语义
  - 保守恢复原则

---

### 3. `assets/decision-point-index.md`

#### 删除 / 下沉
- 删除或显著缩短：
  - `统一动作语义`
  - `关键续接规则`
- 不再保留可被视为第二套规则正文的解释段

#### 保留
- `权威来源规则`
- `决策点总表`
- `维护入口`

#### 新增
- 强化定位说明：
  - 本文件仅作索引与导航
  - 不单独定义执行语义
- 可增加说明：
  - 规则正文见 appendix / phase docs

#### 核对
- 每个决策点是否都有：
  - 权威来源
  - 所属 Phase
  - 恢复续接点
- 是否不会再被误解为唯一规范

---

### 4. `assets/failure-recovery-index.md`

#### 删除 / 下沉
- 删除与 appendix `Error Handling` 重复的大段正文
- 删除任何“第二份恢复总则”

#### 保留
- 失败场景表 / 恢复矩阵
- 恢复动作
- 恢复续接点
- 是否需要用户确认
- 权威来源

#### 新增
- 强化每一类失败场景的“权威来源”字段
- 若缺失，可新增字段：
  - `所属 Phase`
  - `需否确认`
  - `正文来源`

#### 核对
- 是否已经从“说明文档”退回成“导航索引”
- 是否能根据失败场景快速跳转到 appendix / phase / script I/O

---

### 5. `assets/maintenance-index.md`

#### 删除 / 下沉
- 保留主体结构，但弱化对规则本身的解释型段落

#### 保留
- `Phase / reference / script 主映射表`
- `高复用脚本反向影响表`
- `文档维护触发矩阵`
- `维护时优先复用的资料`
- `回归基线资料入口`

#### 新增

##### A. 变更类型 → 权威文件矩阵
至少覆盖：
- 决策点选项变化
- 决策自动化分级变化
- 已有 change 续接规则变化
- AskQuestion fallback 变化
- Error Handling 变化
- schema-aware 规则变化
- verify 规则变化
- 脚本 I/O 变化
- Phase 门禁 / 顺序变化

##### B. 变更类型 → 同步更新矩阵
列出每类改动后必须同步检查的文件。

##### C. 变更类型 → 验证矩阵
映射到以下入口：
- `bash scripts/opsx-selftest.sh`
- `bash tests/integrity-check.sh`
- `bash tests/comprehensive-pipeline-test.sh`
- `bash tests/final-validation.sh`
- 纸面场景演练
- 导航一致性检查
- 单源一致性检查

##### D. 常见遗漏点清单
例如：
- 改了 appendix 没同步 `decision-point-index`
- 改了脚本字段没同步 `script-io-conventions`
- 改了续接规则没同步 `SKILL.md`
- 改了 verify 逻辑没同步 `failure-recovery-index`
- 改了 phase 门禁没同步流程概览

##### E. plan-first 维护流程
建议写成：
1. 识别变更类型
2. 定位主权威文件
3. 列同步文件
4. 先改正文
5. 再改索引
6. 最后改入口摘要
7. 运行验证
8. 做单源一致性检查

#### 核对
- 是否支持“先判断改动类型，再列联动文件”
- 是否支持“明确给出验证动作”
- 是否不再承担规则正文角色

---

## 对照审阅文件

以下文件不一定大改，但必须同步核对：

### `references/phase-0-entrance.md`
- 保留入口执行逻辑
- 不扩展成全局恢复总则
- 与 appendix 的续接原则保持一致

### `references/phase-1-propose.md`
- 决策点 1 / 1a 与 `assets/decision-point-index.md` 一致
- 不再依赖 `SKILL.md` 的旧规则正文

### `references/phase-2-apply.md`
- 决策点 2 / 2a / 2b 与 appendix / index 一致
- schema-aware 引用仍正确

### `references/phase-3-review.md`
- 决策点 3 的动作语义与 appendix 一致
- fix-review 的交接清晰

### `references/phase-3.1-fix-review.md`
- 明确复用 Phase 1 决策点 1 的三选项语义
- 不复制新的总规则

### `references/phase-4-archive.md`
- verify 与 archive 边界清晰
- 4a 与 4 的语义和索引一致

### `references/phase-5-unit-tests.md`
- 决策点 4b 仍是明确门禁
- 入口可发现性不因 `SKILL.md` 瘦身而下降

### `references/phase-6-merge-push.md`
- 5a / 5b / 5 / 5c / 6 / 6a / 6b 与索引一致
- 不依赖 `SKILL.md` 的长摘要来解释流程

### `assets/schema-adapter-summary.md`
- `SKILL.md` / appendix / maintenance-index 对它的引用一致

### `assets/script-io-conventions.md`
- `SKILL.md` 瘦身后，脚本 I/O 仍明确指向这里
- `maintenance-index` 仍把脚本字段变化的联动检查指向这里

---

## 推荐执行顺序

1. `references/recovery-guardrails-appendix.md`
2. `assets/decision-point-index.md`
3. `assets/failure-recovery-index.md`
4. `SKILL.md`
5. `assets/maintenance-index.md`
6. 对照检查各 `references/phase-*.md`
7. 最后检查 `assets/schema-adapter-summary.md` 与 `assets/script-io-conventions.md`

原因：
- 先把正文权威立住
- 再处理索引降重
- 再瘦入口
- 最后升级维护面板

---

## 实施完成后的检查表

### 正文收权
- [x] appendix 明确成为全局规则唯一正文
- [x] 续接规则唯一正文落定
- [x] 决策自动化分级唯一正文落定
- [x] Error Handling 唯一正文落定

### 索引降重
- [x] decision-point-index 不再重复正文
- [x] failure-recovery-index 不再重复正文

### 入口瘦身
- [x] SKILL.md 删除长步骤索引
- [x] SKILL.md 删除大脚本表
- [x] SKILL.md 删除“要点”长流程复述
- [x] SKILL.md 新增权威来源地图

### 维护增强
- [x] maintenance-index 新增变更类型矩阵
- [x] maintenance-index 新增同步更新矩阵
- [x] maintenance-index 新增验证矩阵
- [x] maintenance-index 新增常见遗漏点
- [x] maintenance-index 新增 plan-first 流程

### 一致性检查
- [x] 各 phase 文件引用关系无漂移
- [x] schema-aware 引用关系一致
- [x] script I/O 引用关系一致

---

## 验证动作

实施后建议至少运行：

```bash
bash scripts/opsx-selftest.sh
bash tests/integrity-check.sh
bash tests/comprehensive-pipeline-test.sh
bash tests/final-validation.sh
```

另外补做 3 个手工检查：

1. 从 `SKILL.md` 出发，能否快速找到当前 phase 正文
2. 从 `assets/maintenance-index.md` 出发，能否快速列出一次规则变更的联动文件
3. 从一个失败场景出发，能否快速跳到 appendix 正文
