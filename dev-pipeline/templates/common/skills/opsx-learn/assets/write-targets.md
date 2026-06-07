# 写入位置约定

`opsx-learn` 默认采用“通用知识库”模式，但第一次使用时必须显式确认知识库存放位置。

## 首次使用规则

- 若仓库中已经存在明显的知识目录或稳定文档约定，可直接复用该位置。
- 若仓库中不存在明显知识目录，则必须明确提示用户本次知识准备写到哪里。
- **默认位置：`.knowledge/`**。
- 若用户未提出其他偏好，优先建议使用 `.knowledge/` 作为首个知识库存放目录。

## 优先级顺序

1. **项目已有知识目录**
   - 如 `.knowledge/`、`docs/knowledge/`、`knowledge/`、`docs/domain/` 等
2. **项目已有文档体系中的合适位置**
   - 如架构文档、API 文档、模块说明、FAQ、运行手册
3. **与用户确认后新建目录**
   - 默认优先：`.knowledge/`
   - 常见备选：`docs/knowledge/`

## 选择原则

- 优先复用现有信息架构，不额外制造第二套知识体系。
- 若知识属于长期维护资产，优先放在文档目录而非临时笔记目录。
- 若项目明显已经约定了知识库存放方式，直接遵循，不重复确认显而易见的选择。
- 若无法判断，必须向用户确认后再写入。
- 若用户首次使用且没有明确偏好，使用 `.knowledge/`。

## 推荐分类

- 功能闭环 / 业务流程
- API / 接口契约
- 数据模型 / 存储约束
- 外部依赖 / 集成点
- 排障经验 / 常见坑
- 术语表 / 索引

## 知识类型与推荐落位

- 功能闭环 / 业务流程：优先写到 `.knowledge/business/` 或 `.knowledge/project/`
- API / 接口契约：优先写到 `.knowledge/tech/api/`
- 数据模型 / 存储约束：优先写到 `.knowledge/tech/db/`
- 配置约束：优先写到 `.knowledge/config/`，或补充到对应技术主题文档
- WHY / 业务背景：优先补充到 `.knowledge/business/`，必要时补到 `.knowledge/tech/knowledge-why-policy.md`
- 开发经验：优先追加到 `.knowledge/tech/development-experience.md`
- 错误修复 / 排障经验：优先追加到 `.knowledge/tech/todays-mistakes-and-fixes.md`
- 已知风险 / 暂存问题：优先追加到 `.knowledge/risks/known-issues.md`
- 运维知识 / 发布清单：优先写到 `.knowledge/ops/`

## 预检结果使用顺序

当 `scripts/opsx-learn-preflight.sh` 返回知识健康信息时，优先按以下顺序消费：

1. `knowledgeHealthSummary`
   - 用于先向用户快速说明当前是否适合继续沉淀
   - 适合作为写前提醒的第一句话
2. `knowledgeHealthHighlights`
   - 用于补充最值得优先关注的 1～3 个问题
   - 适合直接列给用户确认是否先修复或同步索引
3. `knowledgeHealth`
   - 原始完整报告
   - 仅在需要展开全部检查明细时再引用

推荐做法：

- 先用 `knowledgeHealthSummary` 给出总体判断
- 再从 `knowledgeHealthHighlights` 中提取最重要的问题
- 只有当用户追问细节，或确实需要逐项核对时，再展开 `knowledgeHealth.checks`


当本次沉淀会新增或显著扩展以下内容时，应同步检查 `.knowledge/INDEX.md`：

- 新的 API 路径
- 新的功能域或业务主题
- 新的数据模型 / 表 / 存储对象
- 新的外部服务 / 客户端
- 新的风险主题 / 故障主题
- 新的运维主题

若项目已有其他知识索引文件，则遵循项目既有约定，不重复维护第二套索引。
