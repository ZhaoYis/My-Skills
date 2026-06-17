---
name: html-prototype-design
description: End-to-end workflow for building and iterating single-file HTML product prototypes—wizard flows, async waiting pages, modals, footer state machine, demo toggles, business annotations, and visual polish via ui-ux-pro-max. Use when creating or refining HTML prototypes, 单页原型, wireframe落地, 步骤条, 等待页, 弹窗原型, 原型美化, or preparing prototypes for business review.
---

# HTML 单页原型设计

从需求到可评审原型的完整流程。默认产出**单文件 HTML**（内联 CSS/JS），视觉延续现有设计系统，不重造 UI 风格。

## 何时使用

- 新建或迭代 B 端/工具类单页 HTML 原型
- 多步骤向导 + 异步任务 + 弹窗能力
- 需要给业务/产品评审，而非直接上生产

## 总体流程

```
Phase 1  理解现状 → 收窄范围
Phase 2  方案探讨（可选，先方案后编码）
Phase 3  结构与流程落地
Phase 4  异步 / 等待 / 结果态
Phase 5  弹窗与子能力
Phase 6  体验抛光与代码整理（不改视觉）
Phase 6B 原型美化（ui-ux-pro-max，先选风格再改代码）
Phase 7  功能标注与业务文案审查
Phase 8  交付前走查
```

详细模式见 [patterns.md](patterns.md)；走查清单见 [review-checklist.md](review-checklist.md)。

---

## Phase 1：理解现状，收窄范围

1. **通读现有 HTML**：布局（侧栏/主区/底栏）、CSS 变量、步骤配置、底部按钮逻辑。
2. **确认唯一主路径**：若存在多模式/多入口，与用户确认是否只保留一条（删除未选路径的 HTML、JS、CSS，避免死代码）。
3. **对齐 DOM 锚点**：用户常给 DOM Path；映射到 `#id` / `[data-step]` / 稳定 class，作为后续改动锚点。

**原则**：原型优先「一条清晰故事线」，次要能力可弹窗或选填，不并行维护两套流程。

---

## Phase 2：方案探讨（用户要方案时）

用户未指定实现细节时，先给 **2～4 套**可选方案，每套包含：

- 线框或 ASCII 结构
- 适用场景与优缺点
- 与现有组件的复用关系（如复用已有 loading 样式）

**不要**在用户未要求时实现全部方案。用户说「A 和 B 结合」时，输出融合线框后再编码。

常见方案类型：

| 场景 | 方案方向 |
|------|----------|
| 长耗时任务 | 阶段流水线 / 进度条+倒计时 / 可离开+消息通知 |
| 内联大块能力 | 改为工具栏入口 + 弹窗 |
| 多结果展示 | 结果页内 scheme-bar 切换演示态（仅原型） |

---

## Phase 3：结构与流程落地

### 步骤向导

```javascript
const steps = [
  { desc: '步骤一说明', panel: 'step1' },
  { desc: '异步处理中', panel: 'processing' },
  { desc: '结果报告', panel: 'report' }
];
```

- 步骤条：**只展示 `desc`**（业务语言），可压缩高度；`label` 仅作内部标识时可省略渲染。
- 面板：`.step-panel` + `.visible` 控制显示；`getCurrentPanelId()` 供底栏与标注联动。
- 已完成步骤可回跳；**异步进行中**限制随意跳转。

### 底部主操作栏

单一函数驱动（如 `updateFooterActions()`）：

| 状态 | 典型按钮 |
|------|----------|
| 中间步 | 上一步 / 下一步（或场景主动词） |
| 触发长任务 | 隐藏底栏，防误触 |
| 任务成功 | 单一主 CTA（如「查看报告」） |
| 任务失败/超时 | 上一步 + 重新执行 |

**禁止**成功/失败共用一套按钮而不分支。

### 布局

- 固定画布宽度：`侧栏 + 主内容 max-width + 可选标注栏(340px)`
- 主滚动容器单独 `#contentScroll`（或 `data-proto-scroll`），便于徽章定位

---

## Phase 4：异步 / 等待 / 结果态

### 推荐组合：阶段流水线 + 可离开提示

等待页建议包含：

1. 标题 +  spinner/进度条
2. **参考倒计时**（标明「仅供参考」）
3. **分阶段列表**（已完/进行中/待办）
4. **异步提示条**（完成后通知，可离开页面）
5. 任务编号等元信息（按需，避免冗余统计）

进行中：**隐藏底栏**；去掉与原型无关的操作（如「取消任务」若未实现则不展示）。

### 结果态（成功 / 失败 / 超时）

- 同一容器内切换，配 **scheme-bar** 供评审切换演示（标注为原型能力，业务文案不写「UI 方案」）
- **不自动跳转**下一步，除非用户明确要求；成功时由底栏主按钮进入
- 失败/超时：底栏为「上一步 + 重新执行」，不是成功态的主 CTA

### 演示用 URL 参数

便于评审不同分支，例如：

- `?taskFail=1` / `?taskTimeout=1` — 任务失败/超时
- `?parseFail=1` — 子流程失败

---

## Phase 5：弹窗与子能力

### 入口

- 从页面内联大块改为 **工具栏按钮**；AI/智能类能力用渐变/shimmer/专属图标强化意图
- 按钮文案与图标尺寸需可读（图标约 18–20px）

### 弹窗结构

```
modal-header（或 hero 贴顶）
modal-body   → hero 说明 + 主内容区 + 多 view（upload / loading / failed）
modal-footer → 固定「取消 + 主操作」，loading 时主按钮 disabled，不隐藏 footer
```

- `overflow: hidden` + hero 顶圆角与 dialog 一致
- Loading **在 body 内切换 view**，不另开全屏层
- Loading 文案精简：spinner + **一行阶段文案**
- 支持 **多文件** 时用列表展示，可逐项删除 + 清空全部 + 上限提示

### 弹窗与标注

打开弹窗时只显示弹窗内标注；见 [html-prototype-annotations](../html-prototype-annotations/SKILL.md)。

---

## Phase 6：体验抛光与代码整理

用户说「优化代码，风格不要变」时：

- 删除未使用 HTML/CSS/JS（整块移除，不留注释尸体）
- 合并重复逻辑（状态 sync、poll 完成、escapeHtml 等）
- 配置数据化（阶段文案数组、mock 数据集中）
- **不改**视觉：颜色、间距、组件形态保持不变

其他常见抛光：

- 去掉与演示无关的浮动入口（反馈、权益等）
- 步骤条、弹窗圆角、徽章被裁剪等问题单独修复

---

## Phase 6B：原型美化（ui-ux-pro-max）

用户要求**美化、更好看、升级视觉、换肤**时进入本阶段。  
**必须**先读并遵循 **[ui-ux-pro-max](~/.claude/skills/ui-ux-pro-max/SKILL.md)**，不可凭感觉随意改色。

用户说「优化代码，风格不要变」→ **跳过本阶段**，只做 Phase 6。

### Step 1：提供风格选项（先方案，后编码）

在改任何 CSS 之前，向用户呈现 **3～4 套**风格方案供选择：

1. 用 `--design-system` 查询与产品类型匹配的建议（见 [style-options.md](style-options.md)）
2. 每套包含：气质、色彩、字体、形态特征、适合场景、改动幅度
3. 等用户选定（或组合，如「A 配色 + B 卡片」）后再动手

**禁止**未选风格就直接大改界面。

### Step 2：落地选中风格

- 优先重构 `:root` CSS 变量（主色、表面色、圆角、阴影、字体）
- 统一按钮 / 卡片 / 表格 / 弹窗 / 步骤条视觉语言
- 遵循 ui-ux-pro-max 优先级：对比度、focus、触控尺寸、动效时长、`prefers-reduced-motion`
- **不改变** Phase 3～5 已定的交互与 DOM 结构（除非用户明确要求）

### Step 3：美化后快速验证

- 主流程走一遍，确认可读性与 CTA 层级
- 标注徽章、底栏、弹窗 footer 仍正常

详细选项模板与约束：[style-options.md](style-options.md)

---

## Phase 7：功能标注（业务评审）

使用独立 skill：**[html-prototype-annotations](../html-prototype-annotations/SKILL.md)**

要点：

- 右侧 340px 说明面板 + 橙色编号一一对应
- `#protoMarkerLayer` 固定层，避免 overflow 裁剪
- 描述面向业务：能做什么、选填/必选、原型未实现处如实说明
- 完成后 **逐条对照界面** 审查准确性（按钮文案、可点击性、导出范围等）

---

## Phase 8：交付前走查

使用 [review-checklist.md](review-checklist.md)。

交付物说明建议包含：

- 主路径操作顺序
- URL 参数演示分支
- 原型未实现项清单（校验、真实下载、接口等）

---

## 与用户协作方式

1. **DOM Path / 截图** → 精确定位，改前确认对应功能块
2. **要方案** → 先方案后实现；**指定方案** → 直接落地
3. **小步迭代** → 单点修改不扩散；用户纠正方向时以最新指令为准
4. **中文界面文案** → 与产品/业务用语一致，以页面实际文字为准

---

## 附加资源

- 可复用模式详解：[patterns.md](patterns.md)
- 美化风格选项模板：[style-options.md](style-options.md)
- 交付走查清单：[review-checklist.md](review-checklist.md)
- 功能标注系统：[html-prototype-annotations](../html-prototype-annotations/SKILL.md)
- 视觉美化 intelligence：[ui-ux-pro-max](~/.claude/skills/ui-ux-pro-max/SKILL.md)
