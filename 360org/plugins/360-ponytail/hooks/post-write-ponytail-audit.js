#!/usr/bin/env node
'use strict';

const fs = require('fs');

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const toolName = payload.tool_name || payload.toolName || payload.name;
if (!['Edit', 'Write'].includes(toolName)) process.exit(0);

const input = payload.tool_input || payload.toolInput || {};
const filePath = String(input.file_path || input.path || 'file vừa thay đổi')
  .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
  .slice(0, 300);
const output = {
  continue: true,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: [
      `[360-ponytail] Tự kiểm tra ${filePath}:`,
      'đã tái sử dụng code/stdlib/native/dependency hiện có chưa;',
      'diff có phải nhỏ nhất vẫn sửa đúng root cause không;',
      'logic không tầm thường đã có runnable check chưa.',
    ].join(' '),
  },
};

process.stdout.write(JSON.stringify(output));
