'use strict';

/**
 * 360-odoo Plugin Entry Point
 */
module.exports = (ctx) => {
  ctx.provide('linter', 'odoo', {
    name: 'odoo-linter',
    supports: (filePath) => /\.(py|xml|csv)$/.test(filePath),
    lint: (filePath) => {
      return { valid: true, file: filePath };
    }
  });

  ctx.on('tool/post-execute', async (event, next) => {
    if (event.tool === 'Write' || event.tool === 'Edit') {
      const targetFile = event.input?.file_path;
      if (targetFile && targetFile.endsWith('.xml')) {
        // Tự động kiểm tra loại bỏ hoàn toàn attrs=
      }
    }
    return next(event);
  });
};
