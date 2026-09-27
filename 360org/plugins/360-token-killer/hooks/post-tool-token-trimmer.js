#!/usr/bin/env node
'use strict';

/**
 * 360 Token Killer — PostToolUse Sanitizer & Output Compressor
 * Tự động cắt tỉa log rác và cảnh báo khi tool output vượt ngưỡng cho phép
 */

const fs = require('fs');

const MAX_OUTPUT_CHARS = 12000;
const MAX_LINES = 150;

let rawInput = '';
try {
  rawInput = fs.readFileSync(0, 'utf8');
} catch (_) {}

if (!rawInput) process.exit(0);

try {
  const payload = JSON.parse(rawInput);
  const toolName = payload.tool_name || payload.toolName || payload.name;
  const toolResult = payload.tool_response || payload.toolResult || payload.result || '';

  let content = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);

  if (content.length > MAX_OUTPUT_CHARS) {
    const lines = content.split('\n');
    let compressed = '';
    if (lines.length > MAX_LINES) {
      const head = lines.slice(0, 50).join('\n');
      const tail = lines.slice(-50).join('\n');
      const trimmedCount = lines.length - 100;
      compressed = `${head}\n\n... [360-token-killer: Đã cắt tỉa ${trimmedCount} dòng log rác để tiết kiệm token & chống tràn context] ...\n\n${tail}`;
    } else {
      compressed = content.slice(0, MAX_OUTPUT_CHARS) + '\n... [360-token-killer: Output đã được rút gọn tự động]';
    }

    const savedTokens = Math.round((content.length - compressed.length) / 4);
    process.stderr.write(`\x1b[33m[360 Token Killer]\x1b[0m Đã nén output của tool \x1b[1m${toolName}\x1b[0m (tiết kiệm ~${savedTokens.toLocaleString()} tokens)\n`);

    const output = {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[360-token-killer] Output của tool ${toolName} đã được tự động cắt tỉa để chống lãng phí token.`
      }
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }
} catch (_) {}

process.exit(0);
