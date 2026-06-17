# 原型美化 · 风格选项模板

美化前**必须先展示选项、等用户选定**，再读 [ui-ux-pro-max](~/.claude/skills/ui-ux-pro-max/SKILL.md) 并改代码。

## 如何生成选项

根据产品类型查询设计系统（路径按本机 skill 安装位置调整）：

```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<产品类型> <行业> admin dashboard" --design-system -p "Prototype"

python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "minimalism glassmorphism flat" --domain style -n 8
```

将查询结果收敛为 **3～4 套**可对比方案，勿一次丢 10 种风格。

---

## 呈现格式（给用户选）

每套方案用同一结构，便于对比：

```markdown
### 方案 A · [风格名]

- **气质**：[一句话，如「稳重可信、政企友好」]
- **色彩**：[主色 + 辅助色倾向，如「深蓝主色 + 中性灰背景」]
- **字体**：[标题/正文字体倾向]
- **形态**：[圆角大小、阴影、是否渐变/毛玻璃]
- **适合**：[什么类型的评审/客户]
- **改动幅度**：[小调 token / 中等换肤 / 较大布局优化]
```

结尾询问：

> 请选择 A / B / C（或说明想组合的元素，如「A 的配色 + C 的卡片布局」）。确认后再开始改代码。

---

## 常见 B 端原型预设方向（无查询时的兜底）

| 方案 | 风格关键词 | 典型特征 |
|------|-----------|----------|
| A 专业简约 | minimalism, flat | 白/浅灰底、细边框、小阴影、蓝色主色、信息密度高 |
| B 科技智能 | gradient, glassmorphism | 渐变主按钮、轻毛玻璃卡片、AI 入口更突出 |
| C 政企可信 | conservative, accessible | 高对比、少动效、字重清晰、红色仅用于警示 |
| D 现代面板 | bento, card-heavy | 大圆角卡片、分区明确、统计块色块区分 |

按实际产品删改，不必每次凑满 4 个。

---

## 美化实施约束

- **不动**已评审通过的主流程与交互（步骤、底栏状态机、弹窗 view 切换）
- **可改** CSS 变量、字体、圆角、阴影、间距、按钮/卡片/表格视觉
- 单文件 HTML：优先改 `:root` token，避免散落硬编码 hex
- 保留标注栏宽度与 `#protoMarkerLayer` 行为
- 遵循 ui-ux-pro-max：对比度、focus、touch target、`prefers-reduced-motion`
- 用户说「风格不要变」→ **跳过本阶段**，只做 [patterns.md](patterns.md) 中的代码整理

---

## 美化后自检

- [ ] 全局风格一致（按钮/卡片/表格/弹窗同一套 token）
- [ ] 主 CTA 仍一眼可辨
- [ ] 步骤条、底栏、标注可读性未下降
- [ ] 无 emoji 当图标；SVG  stroke 宽度统一
