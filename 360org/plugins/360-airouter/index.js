'use strict';

const { SandboxDispatcher } = require('../../core/sandbox-seam');

module.exports = (ctx) => {
  const dispatcher = new SandboxDispatcher(ctx.seams);

  ctx.provide('router', 'airouter', {
    modelProviders: ['claude', 'deepseek', 'gemini', 'openai'],
    planModels: ['claude-3-7-sonnet', 'claude-opus', 'deepseek-r1'],
    buildModels: ['gemini-2.0-flash', 'gemini-2.5-pro', 'codex'],

    // Giai đoạn 2: Smart Sandbox & Model Dispatching
    routeTask(taskType, workspaceContext = {}) {
      const isPlanning = ['req', 'spec', 'plan', 'review', 'audit', 'architect'].includes(taskType);
      const selectedModel = isPlanning ? 'claude-3-7-sonnet' : 'gemini-2.0-flash';
      const selectedSandbox = dispatcher.resolveProviderForContext(workspaceContext);

      return {
        taskType,
        model: selectedModel,
        role: isPlanning ? 'PLAN & ANALYSIS' : 'CODE & EXECUTION',
        sandboxProvider: selectedSandbox ? selectedSandbox.name : 'local-subprocess'
      };
    },

    getSandboxDispatcher() {
      return dispatcher;
    }
  });
};
