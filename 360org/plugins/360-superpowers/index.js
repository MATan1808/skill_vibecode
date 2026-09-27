'use strict';

const { AgentPipeline } = require('../../core/agent-pipeline');

module.exports = (ctx) => {
  const pipeline = new AgentPipeline(ctx.loader);

  ctx.provide('agent', 'superpowers', {
    version: '6.3.0',
    brainstormingRouter: true,
    sddRoles: ['architect', 'generator', 'reviewer', 'tester'],

    // Giai đoạn 4: Autonomous Self-Healing Runner
    async executeSelfHealing(context, retries = 3) {
      return pipeline.runSelfHealingLoop(context, retries);
    },

    getPipeline() {
      return pipeline;
    }
  });
};
