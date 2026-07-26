# Pipeline State Enhancement Plan: Metadata, Integrity & Phase Timing

> 日期: 2026-07-26 | 状态: 设计阶段 — 待评审

---

## Context

当前 `dev-pipeline-state.mjs` 的 Schema v2 状态文件缺少以下关键信息：

1. **创建者身份** — 无法追溯是谁创建的 change
2. **机器环境信息** — 无法知道 change 是在哪台机器上创建的
3. **需求追溯** — 无法关联外部需求系统（如 JIRA）
4. **完整性保护** — 状态文件无防篡改机制，也无法为统计提供唯一标识
5. **Pipeline 阶段耗时** — `transition` 命令不记录 phaseHistory，导致 pipeline 驱动的阶段没有进入/退出时间

这些问题影响：多用户协作追溯、问题排查、跨系统集成、以及后续的统计分析。

---

## 一、Schema 变更

### 1.1 新增字段

保持 `schemaVersion: 2`（字段均为可选/有默认值，向后兼容）。在 `init` 时写入，在 `loadState` 时对缺失字段补默认值。

```jsonc
{
  // ── 新增：创建者与机器信息 ──
  "createdBy": "zhangsan",                    // string, init 时采集
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

  // ── 新增：防篡改签名 ──
  "signatureFingerprint": "a1b2c3d4...",      // string, MD5 hex, init 时计算
  "signatureNonce": "f3a81c2b"                // string, 8-char hex random, init 时生成
}
```

### 1.2 字段语义

| 字段 | 类型 | 说明 |
|------|------|------|
| `createdBy` | `string` | 创建者标识。优先 `git config user.name` → `process.env.USER` → `os.userInfo().username` |
| `machineInfo` | `object` | 创建时的机器环境快照（不随后续操作更新） |
| `featureInfo` | `object \| null` | 关联的需求信息。`null` 表示未关联 |
| `featureInfo.featureId` | `string` | 需求编号（如 JIRA issue key） |
| `featureInfo.featureUrl` | `string` | 需求地址（如 JIRA URL） |
| `signatureFingerprint` | `string` | MD5 签名指纹，用于防篡改和唯一标识 |
| `signatureNonce` | `string` | 8 位十六进制随机数，参与签名计算，使同内容 change 产生不同指纹 |

### 1.3 签名算法

```
signatureFingerprint = md5(
  createdAt + "|" +
  createdBy + "|" +
  (featureId || "") + "|" +
  signatureNonce
)
```

- **createdAt**: ISO 8601 时间戳（init 时的精确值）
- **createdBy**: 创建者标识
- **featureId**: 需求 ID，无则为空字符串
- **signatureNonce**: 8 位随机十六进制数（`crypto.randomBytes(4).toString('hex')`）

验证方式：重新计算 hash 并与存储值比对。任何字段被篡改都会导致不匹配。

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
function resolveCreatedBy() {
  try {
    const gitUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
    if (gitUser) return gitUser;
  } catch { /* ignore */ }
  return process.env.USER || os.userInfo().username || 'unknown';
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

// 生成签名指纹
function computeFingerprint(createdAt, createdBy, featureId, nonce) {
  const input = `${createdAt}|${createdBy}|${featureId || ''}|${nonce}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

// 确保旧状态文件包含新字段
function ensureMetaFields(state) {
  if (!state.createdBy) state.createdBy = 'unknown';
  if (!state.machineInfo) state.machineInfo = {};
  if (!state.featureInfo) state.featureInfo = null;
  if (!state.signatureFingerprint) state.signatureFingerprint = '';
  if (!state.signatureNonce) state.signatureNonce = '';
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

**逻辑变更**（`dev-pipeline-state.mjs` 约 line 268-297）：

```javascript
// 解析命名参数
const namedArgs = {};
for (let i = 2; i < args.length; i++) {
  if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
    namedArgs[args[i]] = args[i + 1];
    i++;
  }
}

const createdBy = namedArgs['--created-by'] || resolveCreatedBy();
const featureId = namedArgs['--feature-id'] || null;
const featureUrl = namedArgs['--feature-url'] || null;

const now = new Date().toISOString();
const nonce = crypto.randomBytes(4).toString('hex');

const state = {
  // ... 现有字段 ...
  createdBy,
  machineInfo: collectMachineInfo(),
  featureInfo: featureId ? { featureId, featureUrl } : null,
  signatureNonce: nonce,
  signatureFingerprint: computeFingerprint(now, createdBy, featureId, nonce),
  createdAt: now,
  updatedAt: now,
};
```

### 2.4 `loadState` 变更

在所有使用 `loadState` 的地方（`get`、`migrate-schema`、`record-phase`、`decision`、`set`、`attempt`、`transition`、`pause`、`complete`），加载后自动补全缺失字段：

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

> **设计决策**：`createdBy`、`machineInfo`、`signatureFingerprint`、`signatureNonce` 不加入 mutablePaths — 这些是创建时快照，不可修改。

### 2.6 `transition` 命令变更 — 自动记录 Phase 历史

**当前行为**：`transition` 仅更新 `currentPhase`/`currentStep`，不写 `phaseHistory`。

**新行为**：`transition` 在成功迁移时自动记录 phaseHistory：

```javascript
// 在 transition 成功改变 phase 之后（约 line 497-501）：
state.currentPhase = toPhase;
state.currentStep = toStep;
state.status = 'active';

// ── 新增：自动记录 phase history ──
const now = new Date().toISOString();

// 1. 完成旧 phase 的 in-progress 记录
const previousEntry = state.phaseHistory.find(
  e => e.phase === fromPhase && e.status === 'in-progress'
);
if (previousEntry) {
  previousEntry.status = 'completed';
  previousEntry.completedAt = now;
  previousEntry.decisions = { ...state.decisions };
}

// 2. 如果向前移动，开始新 phase 的 in-progress 记录
if (toPhase > fromPhase) {
  // 检查是否已有 in-progress 记录（避免重复）
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
}
```

**关于 `fromPhase` 变量**：当前 transition 逻辑中，`validateGates(state, state.currentPhase, toPhase)` 使用 `state.currentPhase` 作为 from。需要在 transition 之前捕获 `fromPhase = state.currentPhase`。

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

### 2.8 新增 `verify-signature` 命令（可选）

```bash
node dev-pipeline-state.mjs verify-signature <changeName>
```

行为：
1. 读取状态文件
2. 重新计算 `computeFingerprint(createdAt, createdBy, featureInfo?.featureId, signatureNonce)`
3. 与存储的 `signatureFingerprint` 比较
4. 返回 `{ valid: true/false }`

> 优先级：**P2** — 可在后续迭代实现，当前先存储签名即可。

---

## 三、Phase 参考文档变更

### 3.1 不再需要的变更

由于 `transition` 已自动记录 phaseHistory，**phase 参考文档无需修改**。AI Agent 只需正常调用 `transition`，阶段耗时自动记录。

### 3.2 独立技能 Command 模板变更

6 个 command 模板（`templates/common/commands/opsx/*.hbs`）在 pre-flight 的 `init` 调用中增加新参数：

```bash
# propose.md.hbs pre-flight 中的 init 调用：
node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs init "<name>" "$CURRENT_BRANCH" \
  --created-by "$(git config user.name)" \
  --feature-id "{{featureId}}" \
  --feature-url "{{featureUrl}}"
```

`{{featureId}}` 和 `{{featureUrl}}` 将是 Handlebars 模板变量，在 init 时由用户提供或从上下文推断。

> 实际实施时需评估 Handlebars 渲染是否能传入这些变量。如果不能，则改为在 pre-flight 步骤中直接使用 `git config` 的结果，featureInfo 通过 AskUserQuestion 获取。

---

## 四、Build-Side 变更

### 4.1 `src/core/assets/types.ts`

无需变更（AssetDefinition 类型不涉及状态 schema）。

### 4.2 `src/core/assets/manifest.ts`

无需变更（asset 清单不涉及状态脚本内部字段）。

### 4.3 `src/core/init/buildInstallPlan.ts`

无需变更（安装计划不涉及状态 schema）。

---

## 五、测试变更

### 5.1 `test/integration/pipeline-state.test.ts`

新增以下测试用例：

#### 测试 1: `init` 包含所有新元数据字段
```
it('initializes with createdBy, machineInfo, featureInfo, and signature')
```
- 基本 init → 验证 `createdBy` 非空字符串
- 验证 `machineInfo` 包含 `platform`、`hostname`、`arch`、`nodeVersion`
- 验证 `featureInfo` 为 `null`（未提供 feature 参数时）
- 验证 `signatureFingerprint` 为 32 位 hex 字符串（MD5）
- 验证 `signatureNonce` 为 8 位 hex 字符串

#### 测试 2: `init` 接受 feature 参数
```
it('accepts --feature-id and --feature-url')
```
- 带 `--feature-id PROJ-1234 --feature-url https://jira.example.com/browse/PROJ-1234` 的 init
- 验证 `featureInfo.featureId` 和 `featureInfo.featureUrl`

#### 测试 3: `init` 接受 `--created-by`
```
it('accepts --created-by override')
```
- 带 `--created-by testuser` 的 init
- 验证 `createdBy` 为 `"testuser"`（覆盖自动检测）

#### 测试 4: 签名唯一性
```
it('generates unique fingerprints for different changes')
```
- 创建两个 change
- 验证 `signatureFingerprint` 不同（nonce 保证唯一性）

#### 测试 5: 旧状态文件自动补齐
```
it('auto-fills missing fields on legacy v2 states')
```
- 写入一个不含新字段的 v2 状态文件
- 执行 `get` 命令
- 验证返回的 state 包含默认值（`createdBy: "unknown"`、`featureInfo: null` 等）

#### 测试 6: `transition` 自动记录 phaseHistory
```
it('transition records phase history entries automatically')
```
- init → transition 1 → transition 2 → transition 4
- 验证 `phaseHistory` 中有 Phase 0、1、2 的 completed 条目
- 验证 Phase 4 有一个 in-progress 条目
- 验证 `executedBy` 为 `"pipeline"`

#### 测试 7: `transition` 不重复记录
```
it('transition does not duplicate phase history entries')
```
- init → transition 1 → 在 Phase 1 中多次 transition 1（同 phase 内移动）
- 验证 phaseHistory 中 Phase 1 只有一条记录

#### 测试 8: `mutablePaths` 允许修改 `featureInfo`
```
it('allows setting featureInfo via set command')
```
- init → `set featureInfo.featureId '"PROJ-5678"'`
- 验证修改成功

#### 测试 9: 签名一致性
```
it('maintains consistent signature after state transitions')
```
- init → 记录签名 → 多次 transition
- 验证 `signatureFingerprint` 和 `signatureNonce` 不变

### 5.2 预期测试数量

- 现有 10 个测试 → 保持不变
- 新增 9 个测试 → 共计 19 个测试

---

## 六、实施步骤

| 步骤 | 内容 | 文件 | 风险 |
|------|------|------|------|
| 1 | 新增 import（crypto, os, child_process） | `dev-pipeline-state.mjs` | 低 |
| 2 | 新增工具函数（resolveCreatedBy, collectMachineInfo, computeFingerprint, ensureMetaFields） | `dev-pipeline-state.mjs` | 低 |
| 3 | 修改 `init` 命令：解析命名参数 + 新字段 | `dev-pipeline-state.mjs` | 中 |
| 4 | 修改 `loadState`：自动补齐缺失字段 | `dev-pipeline-state.mjs` | 低 |
| 5 | 新增 `mutablePaths` 条目 | `dev-pipeline-state.mjs` | 低 |
| 6 | 修改 `transition`：自动记录 phaseHistory | `dev-pipeline-state.mjs` | 中 |
| 7 | 修改 `migrate-schema`：补齐新字段 | `dev-pipeline-state.mjs` | 低 |
| 8 | 新增 9 个测试用例 | `test/integration/pipeline-state.test.ts` | 中 |
| 9 | 运行全量验证：typecheck + lint + test + test:pipeline + pack:check | — | 低 |

---

## 七、向后兼容

| 场景 | 处理 |
|------|------|
| 现有 v2 状态文件（无新字段） | `loadState` 自动补齐默认值，无需迁移 |
| v1 状态文件 → v2 迁移 | `migrate-schema` 同时补齐新字段 |
| `init` 不带新参数 | 自动采集 createdBy + machineInfo；featureInfo 为 null |
| `transition` 增加 phaseHistory | 不影响 gate 推断（gate 推断只看 `executedBy` 和 phase/status） |
| 签名字段存在但为空字符串 | 旧状态补齐时为 `""`，verify-signature 命令跳过校验 |

---

## 八、验证方式

```bash
# 1. 类型检查
npm run typecheck

# 2. 构建
npm run build

# 3. Lint
npm run lint

# 4. 单元/集成测试（包含新增 9 个）
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
# → 检查 phaseHistory 中是否有 Phase 0 completed + Phase 1 in-progress

# 4. 签名验证（如果实现了 verify-signature）
node ../../templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs \
  verify-signature "test-meta"
```
