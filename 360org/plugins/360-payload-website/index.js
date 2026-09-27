'use strict';

/**
 * 360-payload-website Plugin Entry Point
 * Cung cấp capability seams cho Payload CMS 3.x + Next.js
 */

const { lintProject } = require('./scripts/payload-linter');
const { scaffold } = require('./scripts/payload-scaffold');

module.exports = (ctx) => {
  // Cung cấp CMS seam
  ctx.provide('cms', 'payload', {
    framework: 'next.js',
    cmsType: 'payload-3.x',
    deployTarget: 'cloudpanel',
    lint: lintProject,
    scaffold: scaffold,
  });

  // Cung cấp Payload seam chuyên biệt
  ctx.provide('payload', 'engine', {
    version: '3.85+',
    database: 'sqlite-wal | postgres',
    editor: 'lexical',
    router: 'app-router',
  });

  // Đăng ký event middleware kiểm tra sau khi sửa file
  ctx.on('tool/post-execute', async (event, next) => {
    if (event.tool === 'Write' || event.tool === 'Edit') {
      const targetFile = event.input?.file_path;
      if (targetFile && /next\.config\.(ts|mjs|js)$/.test(targetFile)) {
        // Tự động kiểm tra standalone output
      }
    }
    return next(event);
  });
};
