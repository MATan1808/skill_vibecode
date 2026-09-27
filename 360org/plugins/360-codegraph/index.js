'use strict';

module.exports = (ctx) => {
  ctx.provide('graph', 'codegraph', {
    script: '360org/scripts/common/codegraph.js'
  });
};
