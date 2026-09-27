'use strict';

module.exports = (ctx) => {
  ctx.provide('marketing', 'copy-engine', {
    languages: ['vi', 'en'],
    ratios: ['16:9', '1:1', '9:16']
  });
};
