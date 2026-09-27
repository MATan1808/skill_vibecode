#!/usr/bin/env node
'use strict';

/**
 * AIaC Version & Status Inspector CLI
 * Cho phép kiểm tra tức thì phiên bản AIaC, commit git, plugins và server status.
 * Dùng trực tiếp qua CLI hoặc qua slash command /version, /aiac-version.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');

function getVersion() {
  try {
    const versionPath = path.join(repoRoot, 'VERSION');
    if (fs.existsSync(versionPath)) return fs.readFileSync(versionPath, 'utf8').trim();
    const pkgPath = path.join(repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch {}
  return 'Unknown';
}

function getGitInfo() {
  try {
    const commit = execSync('git log -1 --format="%h - %s (%cr)"', { cwd: repoRoot, encoding: 'utf8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    return { commit, branch };
  } catch {
    return { commit: 'N/A', branch: 'main' };
  }
}

function getPluginsSummary() {
  try {
    const pluginsDir = path.join(repoRoot, '360org', 'plugins');
    if (!fs.existsSync(pluginsDir)) return { count: 0, names: [] };
    const dirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name);
    return { count: dirs.length, names: dirs };
  } catch {
    return { count: 0, names: [] };
  }
}

function checkTelemetryDaemon() {
  try {
    const res = execSync('lsof -i :3600 -t', { encoding: 'utf8' }).trim();
    return res ? `Online (PID: ${res.split('\n')[0]}, http://localhost:3600)` : 'Offline';
  } catch {
    return 'Offline';
  }
}

function getLedgerStats() {
  try {
    const harnessDataDir = path.join(repoRoot, '360org', 'plugins', '360-harness', 'data');
    const ledgerPath = path.join(harnessDataDir, 'learning-ledger.jsonl');
    const proposalsPath = path.join(harnessDataDir, 'pending-proposals.json');

    let count = 0;
    let latest = null;
    let pendingCount = 0;

    if (fs.existsSync(ledgerPath)) {
      const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
      count = lines.length;
      if (lines.length > 0) {
        try { latest = JSON.parse(lines[lines.length - 1]); } catch (_) {}
      }
    }

    if (fs.existsSync(proposalsPath)) {
      try {
        const proposals = JSON.parse(fs.readFileSync(proposalsPath, 'utf8'));
        if (Array.isArray(proposals)) pendingCount = proposals.length;
      } catch (_) {}
    }

    return { count, latest, pendingCount };
  } catch {
    return { count: 0, latest: null, pendingCount: 0 };
  }
}

function display() {
  const version = getVersion();
  const git = getGitInfo();
  const plugins = getPluginsSummary();
  const daemon = checkTelemetryDaemon();
  const ledger = getLedgerStats();

  const out = [
    `╔══════════════════════════════════════════════════════════════════╗`,
    `║            AIaC (AI Infrastructure as Code) — v${version.padEnd(10)}║`,
    `╚══════════════════════════════════════════════════════════════════╝`,
    `• Version       : v${version}`,
    `• Git Branch    : ${git.branch}`,
    `• Latest Commit : ${git.commit}`,
    `• Core Plugins  : ${plugins.count} plugins active (360org/plugins/*)`,
    `• Telemetry     : ${daemon}`,
    `• Local Server  : ssh local (192.168.1.100 at /mnt/DATA/work/aiac)`,
    `• Auto-Learning : Active (AutoHarness Continuous Distillation)`,
    `• Learned Items : ${ledger.count} bài học đã lưu vết trong Ledger`,
    `• Proposals     : ${ledger.pendingCount} đề xuất đang chờ duyệt (/proposals)`,
    `──────────────────────────────────────────────────────────────────`
  ].join('\n');

  console.log(out);
}

if (require.main === module) {
  display();
}

module.exports = { getVersion, getGitInfo, getPluginsSummary, checkTelemetryDaemon };
