'use strict';

module.exports = (ctx) => {
  ctx.provide('layout', 'instance-arch', {
    roots: ['modules', 'docs', 'work', 'backups', 'upgrade', 'resources', 'config'],
    addonsPathOrder: ['extra', 'default', 'addons', 'themes']
  });
};
