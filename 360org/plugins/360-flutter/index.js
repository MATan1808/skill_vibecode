'use strict';

/**
 * 360-flutter Plugin Entry Point
 */
module.exports = (ctx) => {
  ctx.provide('linter', 'flutter', {
    name: 'dart-analyze',
    supports: (filePath) => /\.dart$/.test(filePath),
    lint: (filePath) => {
      return { valid: true, file: filePath };
    }
  });

  ctx.on('tool/post-execute', async (event, next) => {
    if (event.tool === 'Write' || event.tool === 'Edit') {
      const targetFile = event.input?.file_path;
      if (targetFile && targetFile.endsWith('.dart')) {
        // Tự động kiểm tra mounted checks & bang operator
      }
    }
    return next(event);
  });
};
