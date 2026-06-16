---
name: html-prototype-annotations
description: Adds numbered orange markers and a right-side annotation panel to single-file HTML prototypes for business review. Use when the user asks for 功能标注、原型标注、标注说明、annotation panel、proto markers, or wants reviewers to align UI with requirements without opening devtools.
---

# HTML 原型功能标注

为单页 HTML 原型添加**橙色编号徽章 + 右侧说明面板**，供业务/产品评审，编号与面板条目一一对应。

## 何时使用

- 交付给业务人员的 HTML 原型，需要「看图说话」
- 多步骤流程、弹窗较多，Reviewer 容易漏看能力点
- 用户要求「加标注」「标注说明」「给业务看」

## 架构（三块）

| 模块 | 作用 |
|------|------|
| `PROTO_ANNOTATIONS` | 标注数据：id、分组、锚点、标题、业务描述 |
| `#protoMarkerLayer` | 固定层渲染橙色编号，避免被 `overflow:hidden` 裁剪 |
| `#protoAnnotationPanel` | 右侧 340px 面板，分组列表 + 当前步骤高亮 |

布局：`body` 总宽度 = 侧栏（如有）+ 主内容区 + **340px** 标注栏。按实际侧栏与主内容宽度相加即可。

## 实施流程

```
Task Progress:
- [ ] 1. 预留布局宽度与右侧面板 HTML
- [ ] 2. 复制 CSS（见 reference.md）
- [ ] 3. 复制 JS 核心（见 reference.md）
- [ ] 4. 编写 PROTO_ANNOTATION_GROUPS + PROTO_ANNOTATIONS
- [ ] 5. 在步骤切换 / 弹窗 open·close 时调用 updateProtoAnnotationPanel()
- [ ] 6. 走查：逐步骤 + 各弹窗核对编号位置与文案
- [ ] 7. 业务文案审查（见 examples.md）
```

### Step 1：布局

- `body { display:flex; min-width: …; width: …; }`
- 主内容区与标注面板并列；标注面板 `height:100vh; flex-shrink:0; width:340px`
- 在主应用容器同级插入 `#protoAnnotationPanel`（通常在 `body` 末尾）

### Step 2–3：CSS + JS

从 [reference.md](reference.md) 复制完整样式与 `mountProtoMarkers` 等函数。

初始化顺序（脚本末尾）：

```javascript
mountProtoMarkers();
renderProtoAnnotationList();
updateProtoAnnotationPanel();
```

### Step 4：标注数据

**分组** `PROTO_ANNOTATION_GROUPS`：与页面步骤/场景对应，如 `global`、`step1`、`step2`、`modal`。

**条目** `PROTO_ANNOTATIONS` 字段：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✓ | 唯一数字，与徽章一致 |
| `group` | ✓ | 对应 GROUPS 的 `key` |
| `anchor` | ✓ | CSS 选择器，锚定 DOM |
| `title` | ✓ | 短标题（业务可读） |
| `desc` | ✓ | 1–2 句业务说明 |
| `pos` | | `'left'` 时徽章贴锚点左上；默认贴右上 |

锚点选择器优先：`#id` > 唯一 class > 步骤容器属性（如 `[data-step="n"]`）下子元素。

弹窗内锚点用 `#modalId .modal-dialog`，不要锚 `.modal-overlay`。

### Step 5：联动钩子

在以下时机调用 `updateProtoAnnotationPanel()` 与 `scheduleProtoMarkerLayout()`：

- 步骤/视图切换（wizard、tab、路由面板等）
- 任意 `.modal-overlay` 添加/移除 `.open`
- 动态显示/隐藏影响锚点可见性的 DOM（banner、空态切换等）

弹窗打开时：`isProtoAnchorVisible` 仅显示**当前打开弹窗内**的 modal 组标注，背景步骤标注自动隐藏。

### Step 6：走查清单

- 每步可见标注是否对应当前界面
- 弹窗打开时是否只显示弹窗标注
- 滚动/resize 后徽章是否仍对齐锚点
- 点击面板行是否 scroll + 闪动对应徽章

## 业务文案原则

面向业务人员，**不是**给开发看的注释：

- ✅ 写用户能做什么、看到什么、流程边界
- ✅ 原型未实现处注明「本原型仅展示，未做 xxx 校验」
- ❌ 避免 Hero、UI 方案、anchor、panel 等技术词
- ❌ 不与界面按钮文案矛盾（以页面实际文案为准）
- ❌ 不写未接线能力（如按钮展示但无 click handler）

详细正反例见 [examples.md](examples.md)。

## 扩展

**新增标注**：取下一个 `id` → 加入 `PROTO_ANNOTATIONS` → 确认 `anchor` 在 DOM 中存在 → 走查可见性。

**新增步骤分组**：在 `PROTO_ANNOTATION_GROUPS` 加 `{ key, label }`，条目 `group` 与之对应；在 `getProtoPanelLabel` 中补充 label 映射。

**新增弹窗**：`group:'modal'`，锚点 `#xxxModal .modal-dialog`；open/close 处已有 `scheduleProtoMarkerLayout` 则无需改逻辑。

## 反模式

- 把 marker 放在锚点内部 → 易被 `overflow:hidden` 裁切；必须用 `#protoMarkerLayer`
- 只写开发注释 → 业务看不懂
- 一个锚点绑多个 id → 徽章重叠
- 忘记在弹窗切换时 refresh → 编号错位或显示过时锚点

## 附加资源

- CSS/JS 模板：[reference.md](reference.md)
- 业务描述范例：[examples.md](examples.md)
