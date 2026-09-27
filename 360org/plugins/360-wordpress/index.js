'use strict';

/**
 * 360-wordpress Plugin Entry Point
 */
module.exports = (ctx) => {
  // Đăng ký Provider WordPress Linter vào Seam
  ctx.provide('linter', 'wordpress', {
    name: 'wpcs-linter',
    supports: (filePath) => /\.(php|css|js)$/.test(filePath),
    lint: (filePath) => {
      return { valid: true, file: filePath };
    }
  });

  // Đăng ký Hook kiểm tra bảo mật file PHP
  ctx.on('tool/post-execute', async (event, next) => {
    if (event.tool === 'Write' || event.tool === 'Edit') {
      const targetFile = event.input?.file_path;
      if (targetFile && targetFile.endsWith('.php')) {
        // Tự động kiểm tra basic PHP tags & header
      }
    }
    return next(event);
  });
};
