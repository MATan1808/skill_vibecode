'use strict';

/**
 * 360-gitsync Plugin Entry Point
 */
module.exports = (ctx) => {
  ctx.provide('git-filter', 'githubignore', {
    name: 'githubignore-filter',
    filter: (filePath) => !filePath.includes('.env')
  });

  // Guard chặn push nhầm sang GitHub không qua script lọc
  ctx.on('tool/pre-execute', async (event, next) => {
    if (event.tool === 'Bash' && typeof event.input?.command === 'string') {
      const cmd = event.input.command;
      if (cmd.includes('git push') && cmd.includes('github') && !cmd.includes('git-sync-publish.sh')) {
        process.stderr.write(`\x1b[33m[360-gitsync Guard]\x1b[0m Cảnh báo: Thao tác push GitHub phải dùng git-sync-publish.sh\n`);
      }
    }
    return next(event);
  }, { prepend: true });
};
