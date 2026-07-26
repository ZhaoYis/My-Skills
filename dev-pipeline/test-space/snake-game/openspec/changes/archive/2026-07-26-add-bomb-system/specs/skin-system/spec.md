# skin-system Specification (Delta)

## MODIFIED Requirements

### Requirement: Skin System Registration

系统 MUST 支持至少 4 套预定义皮肤，每套包含完整的 CSS 变量集、Canvas 绘制参数和炸弹渲染参数。

每套皮肤 MUST 包含以下色值分组：
- CSS 变量：`--bg`、`--surface`、`--border`、`--text`、`--text-secondary`、`--accent`、`--food`、`--snake-head`、`--danger`
- Canvas 参数：棋盘背景色、网格线色、蛇头色、蛇身渐变起止色、食物渐变色（高光/中/暗）、食物光晕色、粒子色相范围、眼白/瞳孔色、暂停遮罩色
- 炸弹 Canvas 参数：休眠炸弹主体色、休眠炸弹光晕色、不稳定炸弹主体色、不稳定炸弹光晕色、不稳定炸弹火花色、爆炸闪光色、爆炸冲击波色、爆炸粒子色、爆炸焦痕色
- 背景光晕：页面 `body` 的两个 radial-gradient 色值

#### Scenario: 默认加载经典皮肤
- **GIVEN** 用户首次打开游戏，localStorage 中无 `snake-skin` 记录
- **WHEN** 页面加载完成
- **THEN** 自动加载"经典"皮肤
- **AND** DOM 使用经典皮肤的 CSS 变量
- **AND** Canvas 使用经典皮肤的绘制参数（包括炸弹参数）

#### Scenario: 加载已保存的皮肤
- **GIVEN** 用户之前选择了"午夜"皮肤，localStorage 中有 `snake-skin: "midnight"`
- **WHEN** 页面加载完成
- **THEN** 自动加载"午夜"皮肤
- **AND** 色块按钮中"午夜"处于激活态

#### Scenario: localStorage 不可用时的降级
- **GIVEN** localStorage 抛出异常（隐私模式、容量满等）
- **WHEN** 页面加载或用户切换皮肤
- **THEN** 使用"经典"皮肤作为默认值
- **AND** 游戏正常运行不崩溃

---

### Requirement: Skin Color Independence

从皮肤对象中移除所有硬编码的 Canvas 绘制颜色后，`draw()` 函数 MUST 不出现皮肤定义之外的任何硬编码色值，包括炸弹和爆炸的渲染颜色。

#### Scenario: 所有 Canvas 颜色来自皮肤
- **GIVEN** 皮肤系统已加载
- **WHEN** `draw()` 函数执行
- **THEN** 所有 `ctx.fillStyle`、`ctx.strokeStyle` 等的颜色参数来自 `currentSkin.canvas` 对象
- **AND** `spawnParticles()` 的粒子色相来自 `currentSkin.canvas.particleHue` 和 `currentSkin.canvas.particleHueRange`
- **AND** 炸弹和爆炸渲染的所有颜色参数来自 `currentSkin.canvas` 对象
