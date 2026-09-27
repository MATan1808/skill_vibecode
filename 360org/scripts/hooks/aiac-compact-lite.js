#!/usr/bin/env node
'use strict';

/**
 * AIaC Context Pruner & Smart Compactor (v3.8.0)
 * Lấy cảm hứng từ Claude Code Harness s08 (Context Compact)
 *
 * PreCompact chỉ ghi dấu mốc phiên cục bộ. Claude Code thực hiện việc compact;
 * hook không tuyên bố đã sửa hay nén transcript.
 *
 * `pruneLargeOutput` là helper thuần cho caller chủ động tỉa log; PreCompact
 * không thể thay đổi transcript bằng schema hook native hiện tại.
 */

const fs = require('fs');
const path = require('path');

function pruneLargeOutput(content, maxLines = 30) {
  if (typeof content !== 'string') return content;
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;

  const head = lines.slice(0, 12).join('\n');
  const tail = lines.slice(-12).join('\n');
  const omitted = lines.length - 24;

  return `${head}\n\n[... AIaC Context Pruner: Đã rút gọn ${omitted} dòng log trung gian để bảo toàn bộ nhớ đệm ...]\n\n${tail}`;
}

async function handlePreCompact() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf8');
  } catch {}

  let payload = {};
  try {
    payload = JSON.parse(rawInput);
  } catch {
    payload = {};
  }

  // Ghi nhận trạng thái trước compact vào session log
  const sessionDir = path.join(process.cwd(), '.claude', 'aiac', 'sessions');
  try {
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    const compactLog = path.join(sessionDir, 'last-compact.json');
    fs.writeFileSync(compactLog, JSON.stringify({
      recordedAt: new Date().toISOString(),
      source: payload?.trigger === 'manual' ? 'manual' : 'auto',
      status: 'precompact-recorded'
    }, null, 2));
  } catch (_) {}

  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}

if (require.main === module) {
  handlePreCompact().catch(err => {
    process.stderr.write(`[AIaC Context Pruner Error] ${err.message}\n`);
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
  });
}

module.exports = { pruneLargeOutput };
