'use strict';

module.exports = (ctx) => {
  ctx.provide('linter', 'ponytail', {
    name: 'ponytail-evaluator',
    ladderRungs: ['YAGNI', 'Reuse', 'Stdlib', 'Native', 'Existing-Dependency', 'One-Line', 'Minimal-Code']
  });
};
