'use strict';

module.exports = {
  name: '360-graphify',
  version: '1.0.0',
  description: 'AIaC Graphify Code Knowledge Graph and Index Provider',
  register(context) {
    if (context && context.events) {
      context.events.on('project/graphify-index', async (payload) => {
        return { status: 'ready', engine: 'graphify' };
      });
    }
  }
};
