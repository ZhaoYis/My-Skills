import type { AgentDefinition } from './types.js';
import { initAgentHandler } from './init-agent.js';
import { syncAgentHandler } from './sync-agent.js';
import { upgradeAgentHandler } from './upgrade-agent.js';
import { uninstallAgentHandler } from './uninstall-agent.js';
import { doctorAgentHandler } from './doctor-agent.js';
import { listToolsAgentHandler } from './list-tools-agent.js';
import { pipelinePhaseAgentHandler } from './pipeline-phase-agent.js';
import { PIPELINE_PHASES } from '../types.js';
import type { PipelinePhase } from '../types.js';

/**
 * All built-in Agent definitions.
 *
 * Each agent maps CLI commands or pipeline phases to the Agent abstraction.
 */
export const builtinAgents: AgentDefinition[] = [
  // ── CLI Utility Agents ──

  {
    id: 'init',
    name: '项目初始化',
    description:
      '在当前目录初始化 opsx-dev-pipeline 模板文件，根据目标 AI 工具生成对应的 skills、commands 和规则文件。',
    phases: ['pre_pipeline' as PipelinePhase],
    category: 'cli',
    handler: initAgentHandler,
    requiredOptions: ['tool'],
  },
  {
    id: 'sync',
    name: '同步托管文件',
    description:
      '根据 manifest 重新渲染已托管文件，将项目恢复到与模板定义一致的状态。',
    phases: ['pre_pipeline' as PipelinePhase, 'phase4_archive' as PipelinePhase],
    category: 'cli',
    handler: syncAgentHandler,
  },
  {
    id: 'upgrade',
    name: '升级托管文件',
    description:
      '在 sync 基础上额外采纳包内新增的 skill/command，并在无现有知识目录时自动采纳 .knowledge 骨架。',
    phases: ['pre_pipeline' as PipelinePhase],
    category: 'cli',
    handler: upgradeAgentHandler,
  },
  {
    id: 'uninstall',
    name: '卸载托管文件',
    description:
      '按 manifest 删除所有托管文件并清理空目录，可选保留 .knowledge 知识库。',
    phases: ['terminated' as PipelinePhase],
    category: 'cli',
    handler: uninstallAgentHandler,
  },
  {
    id: 'doctor',
    name: '健康检查',
    description:
      '检查 manifest、知识库骨架与索引健康状态，输出 0–100 健康评分与修复建议。',
    phases: [...PIPELINE_PHASES] as PipelinePhase[],
    category: 'cli',
    handler: doctorAgentHandler,
  },
  {
    id: 'list-tools',
    name: '列出 AI 工具',
    description: '列出当前内置支持的 AI 工具适配器及其配置信息。',
    phases: ['pre_pipeline' as PipelinePhase],
    category: 'cli',
    handler: listToolsAgentHandler,
  },

  // ── Pipeline Phase Agent ──

  {
    id: 'pipeline-phase',
    name: '流水线阶段执行器',
    description:
      '按当前阶段执行流水线操作：读取阶段参考文档、恢复上下文、执行阶段逻辑、记录决策、建议下一阶段。',
    phases: [...PIPELINE_PHASES] as PipelinePhase[],
    category: 'pipeline',
    handler: pipelinePhaseAgentHandler,
  },
];

// ── Re-exports ──

export { initAgentHandler } from './init-agent.js';
export { syncAgentHandler } from './sync-agent.js';
export { upgradeAgentHandler } from './upgrade-agent.js';
export { uninstallAgentHandler } from './uninstall-agent.js';
export { doctorAgentHandler } from './doctor-agent.js';
export { listToolsAgentHandler } from './list-tools-agent.js';
export {
  pipelinePhaseAgentHandler,
  PHASE_DESCRIPTIONS,
  PHASE_REFERENCE_MAP,
} from './pipeline-phase-agent.js';