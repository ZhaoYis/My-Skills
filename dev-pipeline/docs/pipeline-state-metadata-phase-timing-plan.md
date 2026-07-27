# Pipeline State Enhancement Plan: Metadata, Identity & Phase Timing

> 日期: 2026-07-26 | 状态: ✅ 已实现并通过全量验证

---

## Context

当前 `dev-pipeline-state.mjs` 的 Schema v2 状态文件缺少以下关键信息：

1. **创建者身份** — 无法追溯是谁创建的 change
2. **机器环境信息** — 无法知道 change 是在哪台机器上创建的
3. **需求追溯** — 无法关联外部需求系统（如 JIRA）
4. **唯一标识** — 状态文件无唯一标识符，无法为统计去重
5. **Pipeline 阶段耗时** — `transition` 命令不记录 phaseHistory，导致 pipeline 驱动的阶段没有进入/退出时间

这些问题影响：多用户协作追溯、问题排查、跨系统集成、以及后续的统计分析。

---

## 一、Schema 变更

### 1.1 新增字段

保持 `schemaVersion: 2`（字段均为可选/有默认值，向后兼容）。在 `init` 时写入，在 `loadState` 时对缺失字段补默认值。

```jsonc
{
  // ── 新增：创建者信息 ──
  "createdBy": "zhangsan",                    // git config user.name → USER → userInfo().username → hostname
  "createdByEmail": "zhangsan@example.com",   // git config user.email → ""（允许空）

  // ── 新增：机器环境信息 ──
  "machineInfo": {                             // object, init 时采集
    "platform": "darwin",                      //   os.platform()
    "hostname": "MacBook-Pro.local",           //   os.hostname()
    "osRelease": "25.5.0",                     //   os.release()
    "nodeVersion": "v22.5.1",                  //   process.version
    "arch": "arm64"                            //   os.arch()
  },

  // ── 新增：需求追溯 ──
  "featureInfo": null,                         // object | null
  // 示例：
  // {
  //   "featureId": "PROJ-1234",
  //   "featureUrl": "https://jira.example.com/browse/PROJ-1234"
  // }

  // ── 新增：唯一标识 ──
  "fingerprintId": "a1b2c3d4...",            // string, MD5 hex, init 时计算（非防篡改，仅做唯一标识）
  "fingerprintNonce": "f3a81c2b"             // string, 8-char hex random, init 时生成
}
```

### 1.2 字段语义

| 字段 | 类型 | 说明 |
|------|------|------|
| `createdBy` | `string` | 创建者标识。优先 `git config user.name` → `process.env.USER` → `os.userInfo().username` → `os.hostname()` |
| `createdByEmail` | `string` | 创建者邮箱。`git config user.email`，无配置则为空字符串 |
| `machineInfo` | `object` | 创建时的机器环境快照（不随后续操作更新） |
| `featureInfo` | `object \| null` | 关联的需求信息。`null` 表示未关联 |
| `featureInfo.featureId` | `string` | 需求编号（如 JIRA issue key） |
| `featureInfo.featureUrl` | `string` | 需求地址（如 JIRA URL） |
| `fingerprintId` | `string` | MD5 指纹，用于唯一标识和统计去重（非防篡改签名） |
| `fingerprintNonce` | `string` | 8 位十六进制随机数，参与指纹计算，使同内容 change 产生不同指纹 |

### 1.3 指纹算法（仅用于唯一标识）

```
fingerprintId = md5(
  createdAt + "|" +
  createdBy + "|" +
  createdByEmail + "|" +
  changeName + "|" +
  hostname + "|" +
  (featureId || "") + "|" +
  fingerprintNonce
)
```

- **createdAt**: ISO 8601 时间戳（init 时的精确值）
- **createdBy**: 创建者标识
- **createdByEmail**: 创建者邮箱，无则为空字符串
- **changeName**: change 名称（唯一标识）
- **hostname**: 机器主机名（`os.hostname()`）
- **featureId**: 需求 ID，无则为空字符串
- **fingerprintNonce**: 8 位随机十六进制数（`crypto.randomBytes(4).toString('hex')`）

### 1.4 不可变字段

`createdBy`、`createdByEmail`、`machineInfo`、`fingerprintId`、`fingerprintNonce` 不加入 `mutablePaths` — 这些是创建时快照，不可修改。

可变字段：`featureInfo`、`featureInfo.featureId`、`featureInfo.featureUrl` 加入 `mutablePaths`，允许后续补充/修改需求关联。

---

## 二、`dev-pipeline-state.mjs` 代码变更

### 2.1 新增 import

```javascript
import crypto from 'node:crypto';
import os from 'node:os';
import { execSync } from 'node:child_process';
```

### 2.2 新增工具函数

```javascript
// 采集创建者标识
// git config 会向上遍历目录，stdio: 'pipe' 抑制 stderr 噪音
function resolveCreatedBy() {
  try {
    const name = execSync('git config user.name', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (name) return name;
  } catch { /* ignore */ }
  return process.env.USER || os.userInfo().username || os.hostname() || 'unknown';
}

// 采集创建者邮箱
function resolveCreatedByEmail() {
  try {
    const email = execSync('git config user.email', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (email) return email;
  } catch { /* ignore */ }
  return '';
}

// 采集机器信息
function collectMachineInfo() {
  return {
    platform: os.platform(),
    hostname: os.hostname(),
    osRelease: os.release(),
    nodeVersion: process.version,
    arch: os.arch(),
  };
}

// 生成唯一指纹
function computeFingerprint(createdAt, createdBy, featureId, nonce) {
  const input = `${createdAt}|${createdBy}|${featureId || ''}|${nonce}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

// 确保旧状态文件包含新字段
function ensureMetaFields(state) {
  if (!state.createdBy) state.createdBy = 'unknown';
  if (!state.createdByEmail) state.createdByEmail = '';
  if (!state.machineInfo || !state.machineInfo.platform) {
    state.machineInfo = {
      platform: state.machineInfo?.platform || 'unknown',
      hostname: state.machineInfo?.hostname || 'unknown',
      osRelease: state.machineInfo?.osRelease || 'unknown',
      nodeVersion: state.machineInfo?.nodeVersion || 'unknown',
      arch: state.machineInfo?.arch || 'unknown',
    };
  }
  if (!state.featureInfo) state.featureInfo = null;
  if (!state.fingerprintId) state.fingerprintId = '';
  if (!state.fingerprintNonce) state.fingerprintNonce = '';
  return state;
}
```

### 2.3 `init` 命令变更

**新的命令行签名**：

```bash
node dev-pipeline-state.mjs init <changeName> [sourceBranch] \
  [--created-by <name>] \
  [--feature-id <id>] \
  [--feature-url <url>]
```

**逻辑变更**：

```javascript
// 解析命名参数（--key value 格式）
const namedArgs = {};
for (let i = 2; i < args.length; i++) {
  if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
    namedArgs[args[i]] = args[i + 1];
    i++;
  }
}

const createdBy = namedArgs['--created-by'] || resolveCreatedBy();
const createdByEmail = resolveCreatedByEmail();
const featureId = namedArgs['--feature-id'] || null;
const featureUrl = namedArgs['--feature-url'] || null;

const now = new Date().toISOString();
const nonce = crypto.randomBytes(4).toString('hex');

const state = {
  // ... 现有字段 ...
  createdBy,
  createdByEmail,
  machineInfo: collectMachineInfo(),
  featureInfo: featureId ? { featureId, featureUrl } : null,
  fingerprintNonce: nonce,
  fingerprintId: computeFingerprint(now, createdBy, featureId, nonce),
  // ── 新增：init 时即创建 Phase 0 的 in-progress 条目 ──
  phaseHistory: [{
    phase: 0,
    step: 1,
    executedBy: 'pipeline',
    status: 'in-progress',
    startedAt: now,
    completedAt: null,
    decisions: {},
    gatesBypassed: [],
  }],
  createdAt: now,
  updatedAt: now,
};
```

### 2.4 `loadState` 变更

在所有使用 `loadState` 的地方，加载后自动补全缺失字段：

```javascript
async function loadState(root, changeName) {
  // ... 现有逻辑 ...
  const state = JSON.parse(raw);
  ensureMetaFields(state);  // ← 新增：确保旧状态有默认值
  return rememberReadVersion(state);
}
```

### 2.5 `mutablePaths` 变更

新增可修改字段：

```javascript
const mutablePaths = new Set([
  // ... 现有字段 ...
  'featureInfo',            // ← 新增：允许后续补充/修改需求关联
  'featureInfo.featureId',
  'featureInfo.featureUrl',
]);
```

> **设计决策**：`createdBy`、`createdByEmail`、`machineInfo`、`fingerprintId`、`fingerprintNonce` 不加入 mutablePaths — 这些是创建时快照，不可修改。

### 2.6 `transition` 命令变更 — 自动记录 Phase 历史

**当前行为**：`transition` 仅更新 `currentPhase`/`currentStep`，不写 `phaseHistory`。

**新行为**：`transition` 在成功迁移时自动记录 phaseHistory，并合并两次 `saveState` 为一次。

**关键规则**：

1. **`init` 时创建 Phase 0 的 in-progress 条目**，确保 Phase 0 有进入时间（startedAt = init 时间）
2. **无论向前或向后跳转**，目标 phase 都创建 in-progress 条目（如不存在）
3. **离开当前 phase 时**，如果 phaseHistory 中没有当前 phase 的 in-progress 条目（旧状态文件的兜底），则创建一条 completed 条目（startedAt = completedAt，表示只知道结束时间）
4. **不重复创建**：如目标 phase 已有 in-progress 条目，不重复
5. **合并 gateInference 和 phase change 的 saveState 为一次**（消除部分失败风险）

**过渡逻辑**：

```javascript
// transition: 先捕获 fromPhase
const fromPhase = state.currentPhase;

// gate inference (内存修改，不单独落盘)
applyGateInference(state);

// gate 验证
const gateError = validateGates(state, fromPhase, toPhase);
if (gateError) {
  emitError(gateError[0], gateError[1], 'complete-required-gate', EXIT_INVALID_TRANSITION);
  return;
}

// 修改 currentPhase/currentStep
state.currentPhase = toPhase;
state.currentStep = toStep;
state.status = 'active';

const now = new Date().toISOString();

// 1. 完成旧 phase
const previousInProgress = state.phaseHistory.find(
  e => e.phase === fromPhase && e.status === 'in-progress'
);
if (previousInProgress) {
  previousInProgress.status = 'completed';
  previousInProgress.completedAt = now;
  previousInProgress.decisions = { ...state.decisions };
} else {
  // 旧 phase 没有 in-progress，创建 completed 条目（startedAt = completedAt）
  state.phaseHistory.push({
    phase: fromPhase,
    step: state.currentStep,
    executedBy: 'pipeline',
    status: 'completed',
    startedAt: now,
    completedAt: now,
    decisions: { ...state.decisions },
    gatesBypassed: [],
  });
}

// 2. 为目标 phase 创建 in-progress（向前或向后都创建）
const existingInProgress = state.phaseHistory.find(
  e => e.phase === toPhase && e.status === 'in-progress'
);
if (!existingInProgress) {
  state.phaseHistory.push({
    phase: toPhase,
    step: toStep,
    executedBy: 'pipeline',
    status: 'in-progress',
    startedAt: now,
    completedAt: null,
    decisions: { ...state.decisions },
    gatesBypassed: [],
  });
}

// 唯一一次 saveState
if (await saveState(root, state)) output({ status: 'ok', state });
```

**关于 fromPhase 变量**：在 transition 开始处捕获 `fromPhase = state.currentPhase`，避免后续修改后丢失原始值。

**不影响 gate 推断**：`record-phase` 依然由独立技能包装层调用（executedBy 不同）。`transition` 自动记录的条目 `executedBy: 'pipeline'`，用于区分 pipeline 驱动 vs 独立技能驱动的阶段。

### 2.7 `migrate-schema` 变更

v1 → v2 迁移时，同时补齐新字段：

```javascript
function migrateToV2(state) {
  state.schemaVersion = SCHEMA_VERSION;
  state._version = diskVersion(state);
  state.executionMode = state.executionMode || 'pipeline';
  state.phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
  state.gatesBypassed = Array.isArray(state.gatesBypassed) ? state.gatesBypassed : [];
  // ── 新增：补齐 meta 字段 ──
  ensureMetaFields(state);
  return state;
}
```

---

## 三、模板变更

### 3.1 6 个 command 模板（`.hbs`）

在 pre-flight 的 init 步骤中，增加 AskUserQuestion 引导用户录入需求信息：

```markdown
### Pre-flight

1. 运行 `node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs get "<name>"` 检查状态是否存在。
2. 如果不存在（exit code 10），**询问用户是否需要关联外部需求**（如 JIRA issue）。
   提示用户提供 featureId 和 featureUrl，用户可以跳过。
3. 运行 init：
   ```bash
   CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
   node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs init "<name>" "$CURRENT_BRANCH" \
     --feature-id "<featureId>" \
     --feature-url "<featureUrl>"
   ```
   如果用户跳过了需求录入，省略 --feature-id 和 --feature-url 参数。
```

> **设计决策**：`featureId`/`featureUrl` 由 AI Agent 在运行时通过 AskUserQuestion 获取并拼入命令，**不走 Handlebars 变量**（`templateContext` 在 build 时静态解析，无法传递运行时动态值）。

### 3.2 Phase 参考文档

无需修改（transition 自动记录 phaseHistory，AI Agent 只需正常调用 transition）。

---

## 四、测试变更

### 4.1 新增测试用例

| # | 测试名 | 验证内容 |
|---|--------|---------|
| 1 | `init` 包含所有新元数据字段 | createdBy、createdByEmail、machineInfo（含子字段）、featureInfo 为 null、fingerprintId 为 32 位 hex、fingerprintNonce 为 8 位 hex |
| 2 | `init` 接受 feature 参数 | --feature-id + --feature-url，验证 featureInfo 正确 |
| 3 | `init` 接受 --created-by override | --created-by testuser，验证 createdBy 覆盖自动检测 |
| 4 | fingerprint 唯一性 | 两个 change 的 fingerprintId 不同 |
| 5 | 旧状态文件自动补齐 | 无新字段的 v2 文件 → loadState 后补齐默认值 |
| 6 | `transition` 自动记录 phaseHistory | 0→1→2，phaseHistory 有完整条目，executedBy 为 'pipeline' |
| 7 | `transition` 不重复记录 | 同 phase 内多次 transition 不产生重复条目 |
| 8 | `mutablePaths` 允许修改 featureInfo | set 命令修改 featureInfo.featureId 成功 |
| 9 | fingerprint 一致性 | 多次 transition 后 fingerprintId/fingerprintNonce 不变 |
| 10 | transition 向后跳转的 phaseHistory | Phase 5→2 后目标 phase 有 in-progress，源 phase 有 completed |
| 11 | record-phase + transition 交错 | hybrid 模式下互不覆盖，executedBy 正确区分 |
| 12 | 连续多次 transition phaseHistory 完整性 | 0→1→2→1→2→4，各 phase startedAt/completedAt 正确，无重复 |
| 13 | 纯 pipeline 模式 phaseHistory 完整生命周期 | 无 record-phase 调用，init 时 Phase 0 有 in-progress（startedAt），transition 0→1 后变为 completed（startedAt ≠ completedAt） |

### 4.2 预期测试数量

- 现有 14 个测试 → 保持不变
- 新增 13 个测试 → 共计 27 个测试

---

## 五、实施步骤

| 步骤 | 内容 | 文件 | 风险 |
|------|------|------|------|
| 1 | ✅ 新增 import（crypto, os, child_process） | `dev-pipeline-state.mjs` | 低 |
| 2 | ✅ 新增工具函数（resolveCreatedBy, resolveCreatedByEmail, collectMachineInfo, computeFingerprint, ensureMetaFields） | `dev-pipeline-state.mjs` | 低 |
| 3 | ✅ 修改 `init` 命令：解析命名参数 + 新字段 | `dev-pipeline-state.mjs` | 中 |
| 4 | ✅ 修改 `loadState`：调用 ensureMetaFields | `dev-pipeline-state.mjs` | 低 |
| 5 | ✅ 新增 `mutablePaths` 条目（featureInfo 相关） | `dev-pipeline-state.mjs` | 低 |
| 6 | ✅ 修改 `transition`：合并 saveState + 自动记录 phaseHistory（含向前/向后/补全逻辑） | `dev-pipeline-state.mjs` | 中 |
| 7 | ✅ 修改 `migrate-schema`：调用 ensureMetaFields | `dev-pipeline-state.mjs` | 低 |
| 8 | ✅ 修改 6 个 command 模板：pre-flight 增加 AskUserQuestion | `templates/common/commands/opsx/*.hbs` | 中 |
| 9 | ✅ 新增 13 个测试用例 | `test/integration/pipeline-state.test.ts` | 中 |
| 10 | ✅ 运行全量验证：typecheck + lint + test + test:pipeline + pack:check | — | 低 |

---

## 六、向后兼容

| 场景 | 处理 |
|------|------|
| 现有 v2 状态文件（无新字段） | `loadState` 自动补齐默认值，无需迁移 |
| v1 状态文件 → v2 迁移 | `migrate-schema` 同时补齐新字段 |
| `init` 不带新参数 | 自动采集 createdBy + createdByEmail + machineInfo；featureInfo 为 null |
| `transition` 增加 phaseHistory | 不影响 gate 推断（gate 推断只看 executedBy 和 phase/status） |
| fingerprint 字段为空字符串 | 旧状态补齐时为 `""`，为未来 verify-fingerprint 命令预留 |

---

## 七、验证方式

```bash
# 1. 类型检查
npm run typecheck

# 2. 构建
npm run build

# 3. Lint
npm run lint

# 4. 单元/集成测试（包含新增 13 个）
npm test

# 5. Pipeline E2E 测试
npm run test:pipeline

# 6. 打包完整性检查
npm run pack:check
```

### 手动验证

```bash
# 在 test-space/snake-game 中测试：
cd test-space/snake-game

# 1. 新 init 包含元数据
node ../../templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs \
  init "test-meta" "feature/test-meta" \
  --feature-id "PROJ-1234" \
  --feature-url "https://jira.example.com/browse/PROJ-1234"

# 2. 查看状态（验证所有新字段存在）
node ../../templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs \
  get "test-meta"

# 3. transition 自动记录 phaseHistory
node ../../templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs \
  transition "test-meta" 1 3
node ../../templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs \
  transition "test-meta" 2 6
# → 检查 phaseHistory 中是否有 Phase 0 completed + Phase 1 completed + Phase 2 in-progress
```
