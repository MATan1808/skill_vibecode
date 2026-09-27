'use strict';

/**
 * AIaC 360-agent-device Plugin
 * Cung cấp Seam Provider điều khiển thiết bị (iOS, Android, macOS) cho AI Agent
 */

module.exports = (ctx) => {
  ctx.provide('device', 'agent-device', {
    name: '360-agent-device',
    platforms: ['ios', 'android', 'macos', 'web'],
    version: '1.0.0',
    binary: 'agent-device',
    capabilities: [
      'accessibility-snapshot',
      'interactive-refs',
      'ui-tap-fill-scroll',
      'evidence-capture',
      'maestro-export'
    ]
  });
};
