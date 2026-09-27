#!/usr/bin/env node
'use strict';

/**
 * Hook PostToolUse cho 360-payload-website
 * Nhắc nhở gotcha output: 'standalone' ngay khi sửa next.config
 */

const fs = require('fs');

let rawInput = '';
try { rawInput = fs.readFileSync(0, 'utf8'); } catch {}

let payload = {};
try { payload = JSON.parse(rawInput); } catch {}

const filePath = payload.tool_input?.file_path || payload.tool_response?.filePath;

if (filePath && /next\.config\.(ts|mjs|js)$/.test(filePath)) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('standalone')) {
      const output = {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: "[360-payload-website] ⚠️ CẢNH BÁO: File next.config vừa sửa thiếu cấu hình `output: 'standalone'`. Cần bổ sung để đảm bảo deploy CloudPanel PM2 không bị lỗi thiếu bundle!"
        }
      };
      process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }
  } catch {}
}

process.stdout.write(JSON.stringify({ continue: true }));
