'use strict';

module.exports = (ctx) => {
  ctx.provide('agent', 'hermes', {
    name: 'hermes-core',
    sshTarget: 'cloudpanel'
  });
};
