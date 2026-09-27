#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const overlayPath = path.join(repoRoot, 'config', 'claude', 'settings.overlay.json');
const targetIndex = process.argv.indexOf('--target');
if (targetIndex >= 0 && (!process.argv[targetIndex + 1] || process.argv[targetIndex + 1].startsWith('--'))) {
  throw new Error('Thiếu đường dẫn sau --target.');
}
const targetPath = targetIndex >= 0
  ? path.resolve(process.argv[targetIndex + 1])
  : path.join(os.homedir(), '.claude', 'settings.json');
const dryRun = process.argv.includes('--dry-run');
const backupPath = `${targetPath}.bak-aiac-${new Date().toISOString().replace(/[:.]/g, '-')}`;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Không đọc được JSON '${filePath}': ${error.message}`);
  }
}

function hookKey(entry) {
  return JSON.stringify({ matcher: entry.matcher || '*', hooks: entry.hooks || [] });
}

function isAiacManagedHook(entry) {
  return Array.isArray(entry.hooks) && entry.hooks.some(hook => {
    const command = hook && typeof hook.command === 'string' ? hook.command : '';
    return command.includes('360-smart-router.js') ||
      command.includes('aiac-hook-bridge.js') ||
      command.includes('aiac-compact-lite.js') ||
      command.includes('aiac-stop-pipeline.js') ||
      command.includes('run-with-flags.js');
  });
}

function mergeHooks(current = {}, overlay = {}) {
  const result = { ...current };
  for (const [event, additions] of Object.entries(overlay)) {
    let existing = Array.isArray(result[event]) ? result[event] : [];
    for (const addition of additions) {
      if (isAiacManagedHook(addition)) {
        existing = existing.filter(entry => !(isAiacManagedHook(entry) && (entry.matcher || '*') === (addition.matcher || '*')));
      }
      const known = new Set(existing.map(hookKey));
      if (!known.has(hookKey(addition))) existing.push(addition);
    }
    result[event] = existing;
  }
  return result;
}

function merge(current, overlay) {
  const result = { ...current };
  for (const [key, value] of Object.entries(overlay)) {
    if (key === 'hooks') {
      result.hooks = mergeHooks(current.hooks, value);
    } else if (Array.isArray(value)) {
      const existing = Array.isArray(current[key]) ? current[key] : [];
      result[key] = [...new Set([...existing, ...value])];
    } else if (value && typeof value === 'object') {
      result[key] = { ...(current[key] || {}), ...value };
    } else if (!(key in result)) {
      result[key] = value;
    }
  }
  return result;
}

const current = readJson(targetPath);
const overlay = readJson(overlayPath);
const merged = merge(current, overlay);

if (JSON.stringify(current) === JSON.stringify(merged)) {
  console.log('[AIaC] settings.json đã có cấu hình overlay; không thay đổi.');
  process.exit(0);
}

if (dryRun) {
  console.log('[AIaC] Dry-run: sẽ thêm overlay mà không thay đổi settings.json.');
  process.exit(0);
}

if (fs.existsSync(targetPath)) fs.copyFileSync(targetPath, backupPath);
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`[AIaC] Đã merge cấu hình; backup: ${backupPath}`);
