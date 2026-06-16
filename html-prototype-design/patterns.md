# 原型设计模式参考

## 1. 步骤向导 + 底栏状态机

```javascript
function updateFooterActions() {
  if (isTaskRunning()) { hideFooter(); return; }
  if (shouldShowRetryFooter()) { showPrev + showRetry; return; }
  if (shouldShowSuccessFooter()) { showPrimaryCTA(); return; }
  // 默认：上一步 + 下一步/主动词
}
```

阻塞条件独立函数：`isTaskRunning()`、`isSubFlowRunning()`，便于组合。

步骤渲染只输出业务 `desc`：

```javascript
steps.forEach(function(step, i) {
  // 仅 step.desc，不渲染内部 label
});
```

---

## 2. 异步任务三态

| 状态 | 页面 | 底栏 |
|------|------|------|
| `running` | 进度 + 阶段列表 + 异步提示 | 隐藏 |
| `success` | 成功结果 preview | 主 CTA |
| `failed` / `timeout` | 对应图标 + 说明 | 上一步 + 重试 |

结果 preview 内 scheme-bar 切换演示，**不**代替正式报告页。

```javascript
function switchResultScheme(type, btn) {
  // toggle .is-active on bar buttons
  // toggle .is-visible on result panels
  updateFooterActions(); // 成功/失败底栏不同
}
```

---

## 3. 阶段推进（Mock）

```javascript
var STAGES = ['阶段一…', '阶段二…', '阶段三…'];

function runMockPoll(onComplete) {
  var i = 0;
  function advance() {
    if (i >= STAGES.length) { onComplete(); return; }
    updateStageUI(i);
    i++;
    timer = setTimeout(advance, 2500);
  }
  advance();
}
```

阶段 UI 与底栏/弹窗 footer 同步禁用主按钮。

---

## 4. 弹窗多视图

```html
<div class="modal-body">
  <div class="modal-hero">…能力说明…</div>
  <div class="modal-view is-visible" id="viewUpload">…</div>
  <div class="modal-view" id="viewLoading">spinner + 一行文案</div>
  <div class="modal-view" id="viewFailed">错误说明</div>
</div>
<div class="modal-footer">
  <button id="btnCancel">取消</button>
  <button id="btnPrimary" disabled>开始</button>
</div>
```

状态切换只改 `is-visible`，footer 始终存在；`parsing` 时 `#btnPrimary` disabled + 文案「处理中…」。

---

## 5. 多文件上传列表

- `input[type=file][multiple]` + 内存数组累积文件
- 每次选择后 `input.value = ''` 以便再次选择
- 拖拽 `dragenter/dragover/drop` + `is-dragover` 样式
- 去重：`name + size + lastModified`
- 列表：文件名 + 单项删除 + 清空全部 + 上限 alert

---

## 6. 特色入口按钮（AI / 智能）

```css
.btn-feature-entry {
  background: linear-gradient(135deg, #2563EB, #7C3AED);
  color: #fff;
  position: relative; overflow: hidden;
}
.btn-feature-entry::after { /* shimmer 动画 */ }
```

SVG 图标：星芒 + 节点/轨道，约 20px，轻微 drop-shadow。

---

## 7. 批量/最近记录弹窗

**最近记录**：列表 + 多选 + 全选 + 底部「已选 N 条」+ 应用按钮（无选中 disabled）

**批量导入**：下载模板 + 上传 + 预览表 + 确定提交（有数据才可提交）

沿用现有 table/modal 样式，不新造设计语言。

---

## 8. 报告/结果页

- **汇总页** + **详情页** 切换（`reportView = 'summary' | 'detail'`）
- 汇总统计卡片：仅可点击项写「点击筛选」；纯展示项不写交互
- 导出入口分条描述，不混在一个按钮说明里

---

## 9. 代码整理（不改风格）

安全重构顺序：

1. 删 DOM 与对应 CSS/JS 事件
2. 合并重复函数
3. 提取常量数组
4. 统一命名（state / updateXxxUI / syncXxxPanelState）

避免：抽过度抽象、改 class 名导致样式漂移、改 spacing/color。
