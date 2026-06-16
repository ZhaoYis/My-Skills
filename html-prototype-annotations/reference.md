# 标注系统参考模板

集成到任意单页 HTML 原型时，按需调整选择器、分组与布局宽度。

## HTML：右侧面板

放在 `body` 内、主应用容器同级：

```html
<aside class="proto-annotation-panel" id="protoAnnotationPanel" aria-label="功能标注说明">
  <div class="proto-annotation-panel__head">
    <h2>功能标注说明</h2>
    <p>左侧界面中的橙色编号与本面板一一对应，便于评审与需求对齐。</p>
    <span class="proto-annotation-panel__step" id="protoAnnotationStepHint">当前：…</span>
  </div>
  <div class="proto-annotation-panel__body" id="protoAnnotationList"></div>
</aside>
```

## CSS

```css
.has-proto-marker { position: relative; }

.proto-marker-layer {
  position: fixed; inset: 0; pointer-events: none; z-index: 9999; overflow: visible;
}
.proto-marker-layer.is-modal-active { z-index: 1001; }

.proto-marker {
  position: fixed; top: 0; left: 0;
  min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box;
  border-radius: 999px; background: #F97316; color: #fff;
  font-size: 11px; font-weight: 700;
  border: 2px solid #fff; box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4);
  pointer-events: none; font-variant-numeric: tabular-nums;
  display: inline-flex; align-items: center; justify-content: center;
  line-height: 1; white-space: nowrap;
  transform: translate(-50%, -50%);
}
.proto-marker.is-hidden { display: none; }
.proto-marker.is-proto-flash { animation: protoFlash 1.2s ease 2; }
@keyframes protoFlash {
  0%, 100% { box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4); transform: translate(-50%, -50%) scale(1); }
  50% { box-shadow: 0 0 0 5px rgba(249, 115, 22, 0.28); transform: translate(-50%, -50%) scale(1.08); }
}

.proto-annotation-panel {
  width: 340px; flex-shrink: 0;
  background: #FAFBFC; border-left: 1px dashed #CBD5E1;
  display: flex; flex-direction: column; height: 100vh; overflow: hidden;
}
.proto-annotation-panel__head {
  flex-shrink: 0; padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border-light, #E2E8F0);
  background: var(--bg-card, #fff);
}
.proto-annotation-panel__head h2 {
  font-size: 15px; font-weight: 700; margin: 0 0 6px;
}
.proto-annotation-panel__head p {
  font-size: 12px; color: var(--text-muted, #64748B); margin: 0; line-height: 1.5;
}
.proto-annotation-panel__step {
  margin-top: 10px; padding: 4px 10px; border-radius: 999px;
  display: inline-block; font-size: 11px; font-weight: 600;
  background: var(--primary-50, #EFF6FF); color: var(--primary, #2563EB);
}
.proto-annotation-panel__body {
  flex: 1; min-height: 0; overflow-y: auto; padding: 8px 0 24px;
}
.proto-annotation-group {
  padding: 10px 16px 4px; font-size: 11px; font-weight: 600;
  color: var(--text-muted, #64748B);
}
.proto-annotation-item {
  display: flex; gap: 10px; padding: 10px 16px;
  border-bottom: 1px solid var(--border-light, #E2E8F0);
  cursor: pointer; transition: background 0.15s ease;
}
.proto-annotation-item:hover { background: var(--bg-hover, #F8FAFC); }
.proto-annotation-item.is-current { background: #FFF7ED; }
.proto-annotation-item.is-dim { opacity: 0.45; }
.proto-annotation-num {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  background: #F97316; color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.proto-annotation-item.is-current .proto-annotation-num {
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2);
}
.proto-annotation-text { min-width: 0; }
.proto-annotation-text strong {
  display: block; font-size: 13px; margin-bottom: 4px;
}
.proto-annotation-text span {
  display: block; font-size: 12px; line-height: 1.55; color: var(--text-secondary, #475569);
}
```

## 数据 schema

```javascript
var PROTO_ANNOTATION_GROUPS = [
  { key: 'global', label: '全局与导航' },
  { key: 'step1', label: '步骤一 · …' },
  { key: 'modal', label: '弹窗能力' }
];

var PROTO_ANNOTATIONS = [
  {
    id: 1,
    group: 'global',
    anchor: '.page-header',
    pos: 'left',           // 可选
    title: '页头信息区',
    desc: '…业务描述…'
  }
];
```

## JS 核心函数

**页面需自备：**

- `escapeHtml(str)` — 渲染面板时转义
- `getCurrentPanelId()` — 返回当前步骤/视图 id（与 `PROTO_ANNOTATIONS[].group` 对应，如 `'step1'`、`'global'`）

**可选约定（与可见性逻辑匹配）：**

- 步骤容器：`.step-panel` + `.visible` 表明显示中
- 弹窗：`.modal-overlay.open`
- 隐藏元素：`.hidden` 或 `display:none`

### 可见性（含弹窗互斥）

```javascript
function getOpenProtoModal() {
  return document.querySelector('.modal-overlay.open');
}

function isProtoAnchorVisible(el) {
  if (!el || !el.isConnected) return false;
  if (el.classList.contains('hidden')) return false;
  var panel = el.closest('.step-panel');
  if (panel && !panel.classList.contains('visible')) return false;
  var overlay = el.closest('.modal-overlay');
  var openModal = getOpenProtoModal();
  if (openModal) {
    if (!overlay || overlay !== openModal) return false;
  } else if (overlay) {
    return false;
  }
  var style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  var rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
```

### 布局徽章

```javascript
var protoMarkerMap = {};
var protoLayoutTimer = null;

function layoutProtoMarkers() {
  var layer = document.getElementById('protoMarkerLayer');
  var openModal = getOpenProtoModal();
  if (layer) layer.classList.toggle('is-modal-active', !!openModal);
  Object.keys(protoMarkerMap).forEach(function(id) {
    var entry = protoMarkerMap[id];
    var el = entry.anchor, marker = entry.marker, item = entry.item;
    if (!isProtoAnchorVisible(el)) {
      marker.classList.add('is-hidden');
      return;
    }
    var rect = el.getBoundingClientRect();
    var x = item.pos === 'left' ? rect.left + 2 : rect.right - 2;
    marker.style.left = x + 'px';
    marker.style.top = (rect.top + 2) + 'px';
    marker.classList.remove('is-hidden');
  });
}

function scheduleProtoMarkerLayout() {
  if (protoLayoutTimer) cancelAnimationFrame(protoLayoutTimer);
  protoLayoutTimer = requestAnimationFrame(function() {
    protoLayoutTimer = null;
    layoutProtoMarkers();
  });
}
```

### 挂载、列表渲染、面板更新

```javascript
function mountProtoMarkers() {
  var layer = document.getElementById('protoMarkerLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'protoMarkerLayer';
    layer.className = 'proto-marker-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  PROTO_ANNOTATIONS.forEach(function(item) {
    var el = document.querySelector(item.anchor);
    if (!el) return;
    el.classList.add('has-proto-marker');
    var marker = document.createElement('span');
    marker.className = 'proto-marker';
    marker.textContent = item.id;
    marker.setAttribute('data-proto-id', item.id);
    layer.appendChild(marker);
    protoMarkerMap[item.id] = { anchor: el, marker: marker, item: item };
  });
  var scrollEl = document.querySelector('[data-proto-scroll]') || document.getElementById('contentScroll');
  if (scrollEl) scrollEl.addEventListener('scroll', scheduleProtoMarkerLayout, { passive: true });
  window.addEventListener('resize', scheduleProtoMarkerLayout);
  scheduleProtoMarkerLayout();
}

function renderProtoAnnotationList() {
  var container = document.getElementById('protoAnnotationList');
  if (!container) return;
  container.innerHTML = '';
  PROTO_ANNOTATION_GROUPS.forEach(function(group) {
    var groupItems = PROTO_ANNOTATIONS.filter(function(item) { return item.group === group.key; });
    if (!groupItems.length) return;
    var heading = document.createElement('div');
    heading.className = 'proto-annotation-group';
    heading.textContent = group.label;
    container.appendChild(heading);
    groupItems.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'proto-annotation-item';
      row.setAttribute('data-proto-group', item.group);
      row.setAttribute('data-proto-id', item.id);
      row.innerHTML =
        '<span class="proto-annotation-num">' + item.id + '</span>' +
        '<div class="proto-annotation-text"><strong>' + escapeHtml(item.title) + '</strong>' +
        '<span>' + escapeHtml(item.desc) + '</span></div>';
      row.addEventListener('click', function() { focusProtoAnnotation(item.id); });
      container.appendChild(row);
    });
  });
}

function getProtoPanelLabel(panelId) {
  var group = PROTO_ANNOTATION_GROUPS.find(function(g) { return g.key === panelId; });
  if (group) return '当前：' + group.label.replace(/^步骤[^·]+·\s*/, '');
  if (panelId === 'global') return '当前：全局导航';
  if (panelId === 'modal') return '当前：弹窗';
  return '当前步骤';
}

function updateProtoAnnotationPanel() {
  var panel = getCurrentPanelId();
  var hint = document.getElementById('protoAnnotationStepHint');
  if (hint) hint.textContent = getProtoPanelLabel(panel);
  document.querySelectorAll('.proto-annotation-item').forEach(function(row) {
    var group = row.getAttribute('data-proto-group');
    var isCurrent = group === 'global' || group === 'modal' || group === panel;
    row.classList.toggle('is-current', isCurrent);
    row.classList.toggle('is-dim', !isCurrent);
  });
  scheduleProtoMarkerLayout();
}

function focusProtoAnnotation(id) {
  var entry = protoMarkerMap[id];
  if (!entry) return;
  entry.anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(function() {
    scheduleProtoMarkerLayout();
    entry.marker.classList.remove('is-proto-flash');
    void entry.marker.offsetWidth;
    entry.marker.classList.add('is-proto-flash');
  }, 360);
  var row = document.querySelector('.proto-annotation-item[data-proto-id="' + id + '"]');
  if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
```

### 弹窗 / 步骤钩子示例

```javascript
function onViewChange() {
  updateProtoAnnotationPanel();
  scheduleProtoMarkerLayout();
}

function openModal(modal) {
  modal.classList.add('open');
  onViewChange();
}

function closeModal(modal) {
  modal.classList.remove('open');
  onViewChange();
}
```

## 布局宽度

```
body.width = sidebarWidth（可选）+ mainContentWidth + 340
```

标注栏固定 340px；其余宽度按原型实际侧栏与主内容区设定。
