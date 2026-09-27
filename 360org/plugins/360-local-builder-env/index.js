'use strict';

module.exports = {
  name: '360-local-builder-env',
  version: '1.0.0',
  description: 'AIaC Multi-Tenant Odoo Docker Dev & Migration Orchestrator Provider',
  register(context) {
    if (context && context.events) {
      context.events.on('project/local-env-build', async () => ({ status: 'ready', engine: 'local-builder-env' }));
    }
  }
};
