#!/usr/bin/env node
'use strict';

/**
 * AIaC Stop Event Pipeline Hook
 * Kích hoạt tự động khi Agent hoàn thành turn hoặc kết thúc phiên (Stop Hook).
 * Chỉ gửi transcript của workspace hiện tại sang AutoHarness để đề xuất bài học.
 * Goal evaluator chưa nối vào Stop vì payload native không cung cấp bằng chứng test.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

function isCurrentProjectTranscript(candidate, cwd = process.cwd()) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return false;

  try {
    const homeDir = process.env.HOME || os.homedir();
    const projectDir = path.join(homeDir, '.claude', 'projects', cwd.replace(/\//g, '-'));
    const resolvedProjectDir = fs.realpathSync(projectDir);
    const resolvedCandidate = fs.realpathSync(candidate);
    return resolvedCandidate.startsWith(`${resolvedProjectDir}${path.sep}`) &&
      resolvedCandidate.endsWith('.jsonl') && fs.statSync(resolvedCandidate).isFile();
  } catch {
    return false;
  }
}

async function main(rawInput = null, spawnChild = spawn) {
  if (rawInput === null) {
    try {
      rawInput = fs.readFileSync(0, 'utf8');
    } catch {
      rawInput = '';
    }
  }

  let transcriptPath = null;
  try {
    const payload = JSON.parse(rawInput);
    if (isCurrentProjectTranscript(payload.transcript_path)) transcriptPath = payload.transcript_path;
  } catch {}

  // Không có transcript chính xác thì không distill: tránh đọc session của workspace khác.
  const distillerPath = path.resolve(__dirname, '..', '..', 'plugins', '360-harness', 'scripts', 'aiac-auto-distiller.js');
  if (transcriptPath && fs.existsSync(distillerPath)) {
    try {
      const child = spawnChild(process.execPath, [distillerPath, 'distill', transcriptPath], {
        detached: true,
        stdio: 'ignore',
        cwd: process.cwd(),
        env: process.env
      });
      child.on('error', error => process.stderr.write(`[AIaC Stop Pipeline] ${error.message}\n`));
      child.unref();
    } catch (error) {
      process.stderr.write(`[AIaC Stop Pipeline] ${error.message}\n`);
    }
  }

  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}

if (require.main === module) {
  main().catch(() => {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
  });
}

module.exports = { isCurrentProjectTranscript, main };
