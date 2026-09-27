#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CONFIRM_FLAG = '--confirm-reset-env-claude';
const envRoot = process.env.AIAC_ENV_ROOT || (fs.existsSync('/Volumes/DATA/ENV') ? '/Volumes/DATA/ENV' : os.homedir());
const claudeRoot = path.join(envRoot, '.claude');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveRepoRoot() {
  const runtime = readJson(path.join(claudeRoot, '360org', 'aiac-runtime.json'));
  const candidates = [
    process.env.AIAC_REPO_ROOT,
    runtime?.repoRoot,
    path.resolve(__dirname, '..', '..', '..'),
  ].filter(Boolean);
  const found = candidates.find(candidate => fs.existsSync(path.join(candidate, 'install-aiac.sh')));
  if (!found) throw new Error('Không xác định được repo AIaC để cài lại.');
  return found;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function assertSafeTarget() {
  if (path.basename(claudeRoot) !== '.claude') throw new Error(`Target không hợp lệ: ${claudeRoot}`);
  if (!path.resolve(claudeRoot).endsWith(`${path.sep}.claude`)) throw new Error(`Target không phải .claude: ${claudeRoot}`);
}

function assertCommitted(repoRoot) {
  if (!fs.existsSync(path.join(repoRoot, '.git'))) return;
  const status = run('git', ['-C', repoRoot, 'status', '--porcelain']);
  if (status) throw new Error('Repo AIaC còn thay đổi chưa commit; dừng reset theo yêu cầu commit trước khi xoá.');
  const head = run('git', ['-C', repoRoot, 'rev-parse', 'HEAD']);
  const remote = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'origin/main'], { encoding: 'utf8' });
  if (remote.status === 0 && remote.stdout.trim() !== head) {
    throw new Error('Repo AIaC chưa push lên origin/main; dừng reset theo yêu cầu commit GitLab trước khi xoá.');
  }
}

function backupExisting() {
  if (!fs.existsSync(claudeRoot)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${claudeRoot}.bak-aiac-reset-${stamp}`;
  fs.renameSync(claudeRoot, backupPath);
  return backupPath;
}

function main() {
  if (!process.argv.includes(CONFIRM_FLAG) && process.env.AIAC_CONFIRM_RESET_CLAUDE_ENV !== '1') {
    console.error(`Cần ${CONFIRM_FLAG} để reset ${claudeRoot}.`);
    process.exit(2);
  }

  assertSafeTarget();
  const repoRoot = resolveRepoRoot();
  assertCommitted(repoRoot);
  const backupPath = backupExisting();
  fs.mkdirSync(claudeRoot, { recursive: true });

  run('bash', [path.join(repoRoot, 'install-aiac.sh')], {
    cwd: repoRoot,
    env: { ...process.env, AIAC_ENV_ROOT: envRoot, AIAC_SKIP_CODEGRAPH: '1' },
    stdio: 'inherit',
  });
  fs.mkdirSync(path.join(claudeRoot, 'session-data'), { recursive: true });

  const doctor = path.join(claudeRoot, '360org', 'scripts', 'aiac', 'doctor.js');
  if (fs.existsSync(doctor)) run(process.execPath, [doctor], { env: { ...process.env, AIAC_ENV_ROOT: envRoot }, stdio: 'inherit' });

  console.log(`[AIaC] Reset Claude env xong: ${claudeRoot}`);
  if (backupPath) console.log(`[AIaC] Backup cũ: ${backupPath}`);
}

main();
