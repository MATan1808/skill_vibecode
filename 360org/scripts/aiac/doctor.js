#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const envRoot = process.env.AIAC_ENV_ROOT || (fs.existsSync('/Volumes/DATA/ENV') ? '/Volumes/DATA/ENV' : os.homedir());
const claudeRoot = path.join(envRoot, '.claude');
const runtimePath = path.join(claudeRoot, '360org', 'aiac-runtime.json');
const requiredHooks = ['SessionStart', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop'];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveRepoRoot(runtime) {
  const candidate = runtime?.repoRoot;
  if (candidate && fs.existsSync(path.join(candidate, 'config', 'claude', 'settings.overlay.json'))) return candidate;
  return path.resolve(__dirname, '..', '..', '..');
}

function hasRequiredHooks(settings) {
  return requiredHooks.filter(name => !Array.isArray(settings?.hooks?.[name]) || !settings.hooks[name].length);
}

function check(title, ok, detail) {
  return { title, ok, detail };
}

function gitCheckIgnore(filePath) {
  const result = spawnSync('git', ['check-ignore', '-q', filePath], { cwd: repoRoot, stdio: 'ignore' });
  return result.status === 0;
}

const runtime = readJson(runtimePath);
const repoRoot = resolveRepoRoot(runtime);
const overlayPath = path.join(repoRoot, 'config', 'claude', 'settings.overlay.json');
const runtimeSettingsPath = path.join(claudeRoot, 'settings.json');
const routerPath = path.join(repoRoot, '360org', 'scripts', 'hooks', '360-smart-router.js');
const sessionDir = path.join(claudeRoot, 'session-data');
const overlay = readJson(overlayPath);
const runtimeSettings = readJson(runtimeSettingsPath);
const routerSource = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, 'utf8') : '';
const sourceOnly = process.env.AIAC_DOCTOR_SOURCE_ONLY === '1';
const forbiddenDevRoot = process.env.AIAC_FORBIDDEN_DEV_ROOT || '/Volumes/DATA/DEV';

function collectForbiddenAdditionalDirectories(settings) {
  const dirs = settings?.permissions?.additionalDirectories;
  if (!Array.isArray(dirs)) return [];
  return dirs.filter(dir => typeof dir === 'string' && isPathInside(forbiddenDevRoot, dir));
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(realPathSafe(parentPath), realPathSafe(childPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function realPathSafe(targetPath) {
  const resolved = path.resolve(targetPath || '.');
  try {
    return fs.realpathSync(resolved);
  } catch {
    const parent = path.dirname(resolved);
    if (parent === resolved) return resolved;
    return path.join(realPathSafe(parent), path.basename(resolved));
  }
}

const forbiddenAdditionalDirs = collectForbiddenAdditionalDirectories(runtimeSettings);

const overlayMissing = hasRequiredHooks(overlay);
const runtimeMissing = hasRequiredHooks(runtimeSettings);
const checks = [
  check('Overlay canonical đủ 5 hook', overlayMissing.length === 0, overlayMissing.length ? `Thiếu: ${overlayMissing.join(', ')}` : overlayPath),
  check('Telemetry dashboard tự bật ở SessionStart', overlay?.env?.AIAC_TELEMETRY_DASHBOARD === '1', overlayPath),
  check('Telemetry cache được ignore', gitCheckIgnore('360org/telemetry/telemetry_cache.json'), '360org/telemetry/telemetry_cache.json'),
  check('Router không hardcode path máy Sếp', !routerSource.includes(repoRoot + '/'), routerPath),
];

if (!sourceOnly) {
  checks.push(
    check('Runtime settings đủ 5 hook', runtimeMissing.length === 0, runtimeMissing.length ? `Thiếu: ${runtimeMissing.join(', ')}` : runtimeSettingsPath),
    check('Runtime bật telemetry dashboard', runtimeSettings?.env?.AIAC_TELEMETRY_DASHBOARD === '1', runtimeSettingsPath),
    check(`Không cấp additionalDirectories trong ${forbiddenDevRoot}/*`, forbiddenAdditionalDirs.length === 0, forbiddenAdditionalDirs.length ? forbiddenAdditionalDirs.join(', ') : runtimeSettingsPath),
    check('aiac-runtime.json trỏ đúng repo', runtime?.repoRoot === repoRoot, runtime?.repoRoot || 'Không đọc được runtime'),
    check('session-data tồn tại', fs.existsSync(sessionDir), sessionDir),
  );
}

const failed = checks.filter(item => !item.ok);
console.log('# AIaC Doctor');
console.log('');
for (const item of checks) {
  console.log(`- [${item.ok ? 'x' : ' '}] ${item.title} — ${item.detail}`);
}
console.log('');
console.log(failed.length ? `Kết quả: FAIL (${failed.length} lỗi)` : 'Kết quả: PASS');
process.exit(failed.length ? 1 : 0);
