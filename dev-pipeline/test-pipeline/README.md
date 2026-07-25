# Pipeline E2E Tests

该项目在隔离临时仓库中验证当前 `opsx-dev-pipeline` Skill 的真实交付契约，不调用外部 AI Agent，也不依赖本机安装的 OpenSpec。

## 执行模型

```text
EnvironmentFactory
  -> 复制 fullstack-todo 样例
  -> 直接调用当前 runInit 安装 Skill
  -> 创建受控 OpenSpec CLI fixture
  -> 创建 main、feature 分支和隔离 bare remote

PipelineAgentOrchestrator
  -> Phase0: 真实 preflight + 初始化持久状态
  -> Phase1: 真实 new/validate 包装脚本 + 生成提案制品
  -> Phase2: 真实 apply instructions + 修改样例代码
  -> Phase3: 写入审查报告 + 记录 review attempt
  -> Phase4: 实际运行 npm test + 记录测试门禁
  -> Phase5: 实际运行 verify + 真实 archive 包装脚本
  -> Phase6: commit + source push + no-ff merge + post-merge tests/verify + target push

PhaseValidators
  -> 同时核对状态文件、文件系统、Git 工作区和远端 refs
```

OpenSpec 使用受控 fixture 是为了让测试结果与机器环境无关；Skill 自带的 Shell 包装脚本、JSON 协议和状态脚本仍是实际安装后执行的文件。

## 运行

```bash
npm run test:pipeline
```

或在本目录运行：

```bash
npm test
npm run test:report
```

要求 Node.js 20+ 和 Git，不要求全局安装 OpenSpec，不访问真实远程仓库。

## 场景

| 场景 | 验证内容 |
|---|---|
| `fullstack-todo-full-flow.test.ts` | Phase0-6 完整交付、报告与远端 refs |
| `missing-openspec.test.ts` | preflight 缺依赖退出码与不创建状态 |
| `archive-with-pending-tasks.test.ts` | 归档失败保持 Phase5，并可显式处理后恢复 |
| `report-integrity.test.ts` | 失败断言归一化、无 executor 禁止伪通过 |

报告仅在场景显式请求时写入 `reports/`；生成目录不作为测试输入。
