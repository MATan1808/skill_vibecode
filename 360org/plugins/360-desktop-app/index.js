'use strict';

/**
 * 360-desktop-app Plugin Entry Point
 */
module.exports = (ctx) => {
  ctx.provide('builder', 'tauri', {
    name: 'tauri-builder',
    build: () => 'npm run tauri dev'
  });

  ctx.on('tool/post-execute', async (event, next) => {
    return next(event);
  });
};
