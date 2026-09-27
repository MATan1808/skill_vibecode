#!/usr/bin/env node
'use strict';

/**
 * AIaC Pre-Commit / Pre-Push Auto Refactor Hook.
 * Tự động chạy AST Pattern Refactor trước khi lưu/commit, tiết kiệm 100% token LLM.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.cwd();
const claudeRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(require('os').homedir(), '.claude');
const refactorScript = path.join(claudeRoot, '360org', 'scripts', 'ast-grep', 'aiac-ast-refactor.py');

function runAutoRefactor() {
  if (!fs.existsSync(refactorScript)) return;

  // Chạy refactor local 0ms
  const res = spawnSync('python3', [refactorScript, '--rule', 'all', '--path', cwd, '--write'], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  });

  if (res.stdout && res.stdout.includes('Khớp')) {
    process.stderr.write(`\x1b[32m[AIaC Auto-Refactor]\x1b[0m Đã tự động tối ưu cú pháp (0 LLM tokens)\n`);
  }
}

runAutoRefactor();
