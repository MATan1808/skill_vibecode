'use strict';

module.exports = (ctx) => {
  ctx.provide('browser', 'agent-browser', {
    version: '0.34.0',
    persistentSession: true
  });
};
