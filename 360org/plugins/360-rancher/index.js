'use strict';

module.exports = (ctx) => {
  ctx.provide('k8s', 'rancher', {
    cluster: 'saas',
    context: 'saas'
  });
};
