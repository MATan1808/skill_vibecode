'use strict';

module.exports = (ctx) => {
  ctx.provide('indexer', 'agent-map', {
    script: '360org/scripts/common/agent-map.py'
  });
};
