'use strict';

module.exports = (ctx) => {
  ctx.provide('assistant', 'vuaassistant', {
    runtime: 'tauri-rust',
    os: 'macos'
  });
};
