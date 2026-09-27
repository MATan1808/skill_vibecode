'use strict';

/**
 * AIaC 360-desktop-reverse Plugin
 * Đăng ký seam provider cho desktop app reverse & inspect
 */

module.exports = (ctx) => {
  ctx.provide('inspector', 'desktop-reverse', {
    name: '360-desktop-reverse',
    supportedTargets: ['electron', 'tauri', 'macho', 'dotnet', 'qt'],
    version: '1.0.0'
  });
};
