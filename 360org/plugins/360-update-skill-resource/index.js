'use strict';

module.exports = (ctx) => {
  ctx.provide('updater', 'manual-selective-audit', {
    mode: 'audit-first',
    automaticCopy: false,
    automaticInstall: false,
    automaticCommitOrPush: false,
    reportDir: '360org/plugins/360-update-skill-resource/reports'
  });
};
