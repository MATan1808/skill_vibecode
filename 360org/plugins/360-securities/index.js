'use strict';

module.exports = (ctx) => {
  ctx.provide('security', 'securities', {
    communityPlugin: '360-securities',
    hardeningLayers: 12
  });
};
