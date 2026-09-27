'use strict';

module.exports = (ctx) => {
  ctx.provide('app-suite', 'vuaoffice', {
    runtime: 'electron',
    suite: 'office-suite'
  });
};
