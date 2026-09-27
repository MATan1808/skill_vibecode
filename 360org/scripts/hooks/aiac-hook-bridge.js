#!/usr/bin/env node
'use strict';

/**
 * AIaC Lifecycle Hook Bridge (PreToolUse & PostToolUse)
 * Nhận sự kiện từ Claude Code CLI, chuyển qua AIaC EventBus & Plugin Middlewares.
 * Hỗ trợ auto-lint, auto-format, capability gating và security checks.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PluginLoader } = require('../../core/plugin-loader');

const pluginsDir = path.join(__dirname, '..', '..', 'plugins');
const loader = new PluginLoader({ pluginsDir });
const disabled = process.env.AIAC_LIGHT_HOOKS === '1';
const devRoot = process.env.AIAC_FORBIDDEN_DEV_ROOT || '/Volumes/DATA/DEV';
const legacyRoot = process.env.AIAC_LEGACY_SKILLS_PATH || '/Volumes/DATA/DEV/SKILLS';

if (!disabled) {
  // Tự động load toàn bộ plugins có sẵn
  const availablePlugins = loader.discoverAvailablePlugins();
  for (const p of availablePlugins) {
    loader.loadPlugin(p);
  }
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

function isPathInside(parentPath, childPath) {
  const relative = path.relative(realPathSafe(parentPath), realPathSafe(childPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getDevRepoRoot(targetPath) {
  const safeTarget = realPathSafe(targetPath);
  const safeDev = realPathSafe(devRoot);
  if (!isPathInside(safeDev, safeTarget) || safeTarget === safeDev) return null;
  const relParts = path.relative(safeDev, safeTarget).split(path.sep).filter(Boolean);
  if (relParts.length === 0) return null;
  if (relParts[0].toLowerCase() === 'skills' || relParts[0].toLowerCase() === 'skill_sources') {
    if (relParts.length < 2) return null;
    return path.join(safeDev, relParts[0], relParts[1]);
  }
  return path.join(safeDev, relParts[0]);
}

function isAllowedDevWorkspace(targetPath) {
  if (!targetPath) return false;
  const safeTarget = realPathSafe(targetPath);
  const safeDev = realPathSafe(devRoot);
  const safeLegacy = realPathSafe(legacyRoot);

  if (!isPathInside(safeDev, safeTarget) || safeTarget === safeDev) return false;
  if (isPathInside(safeLegacy, safeTarget)) return false;

  // Cho phép net-path con cụ thể dưới SKILL_SOURCES (VD: /Volumes/DATA/DEV/SKILL_SOURCES/hermes-dev-skills)
  // Nhưng chặn root wildcard SKILL_SOURCES
  const skillSourcesRoot = path.join(safeDev, 'SKILL_SOURCES');
  if (safeTarget === realPathSafe(skillSourcesRoot)) return false;

  return true;
}

function getConfiguredDevWorkspaces() {
  const workspaces = [];

  // Luôn luôn cấp quyền truy cập đầy đủ cho AIaC Repo Root (Global AI Infrastructure)
  const runtimeJsonPath = path.join(os.homedir(), '.claude', '360org', 'aiac-runtime.json');
  const envRuntimePath = fs.existsSync('/Volumes/DATA/ENV/.claude/360org/aiac-runtime.json') ? '/Volumes/DATA/ENV/.claude/360org/aiac-runtime.json' : null;
  const targetRuntime = envRuntimePath || (fs.existsSync(runtimeJsonPath) ? runtimeJsonPath : null);
  let repoRootCandidate = process.env.AIAC_REPO_ROOT;
  if (!repoRootCandidate && targetRuntime) {
    try {
      const parsed = JSON.parse(fs.readFileSync(targetRuntime, 'utf8'));
      repoRootCandidate = parsed?.repoRoot;
    } catch {}
  }
  if (!repoRootCandidate) {
    repoRootCandidate = path.resolve(__dirname, '..', '..', '..');
  }
  if (repoRootCandidate && fs.existsSync(repoRootCandidate)) {
    workspaces.push(repoRootCandidate);
  }
  if (fs.existsSync('/Volumes/DATA/DEV/aiac')) {
    workspaces.push('/Volumes/DATA/DEV/aiac');
  }

  if (process.env.AIAC_ALLOWED_DEV_WORKSPACE) {
    if (isAllowedDevWorkspace(process.env.AIAC_ALLOWED_DEV_WORKSPACE)) {
      workspaces.push(process.env.AIAC_ALLOWED_DEV_WORKSPACE);
    }
  }

  // Đọc cấu hình từ .claude/settings.local.json hoặc settings.json.
  // BẮT BUỘC đọc cả AIaC repo root, không chỉ cwd: khi Sếp kéo thả folder vào chat,
  // Claude Code đổi cwd sang folder đó nên whitelist ghi ở AIaC root sẽ bị bỏ qua (#drag-drop-grant).
  const settingsRoots = Array.from(new Set([
    process.cwd(),
    repoRootCandidate,
    '/Volumes/DATA/DEV/aiac'
  ].filter(Boolean)));
  const settingsCandidates = settingsRoots.flatMap(root => [
    path.join(root, '.claude', 'settings.local.json'),
    path.join(root, '.claude', 'settings.json')
  ]);

  for (const setPath of settingsCandidates) {
    try {
      if (fs.existsSync(setPath)) {
        const data = JSON.parse(fs.readFileSync(setPath, 'utf8'));
        if (data && typeof data === 'object') {
          // LUẬT CỨNG: settings.local.json là nguồn ưu tiên CAO NHẤT (Cấp 1).
          // Đường dẫn Sếp đã ghi trong đó = ĐÃ ĐƯỢC DUYỆT, không filter lại, không hỏi lại.
          // Chỉ chuẩn hoá bỏ wildcard đuôi (`/Volumes/.../repo/*` -> `/Volumes/.../repo`).
          const takeAll = (arr) => {
            for (const item of arr) {
              if (typeof item !== 'string') continue;
              const clean = item.replace(/\/+\*+$/, '').trim();
              if (clean.startsWith('/')) workspaces.push(clean);
            }
          };

          // 1. Quét allow paths trực tiếp
          if (Array.isArray(data.allowedWorkspaces)) takeAll(data.allowedWorkspaces);
          if (typeof data.allowedWorkspace === 'string') takeAll([data.allowedWorkspace]);
          // 2. Quét mảng permissions.allow, permissions.additionalDirectories hoặc aiac.allowedPaths
          if (data.permissions) {
            if (Array.isArray(data.permissions.allow)) {
              for (const item of data.permissions.allow) {
                if (typeof item === 'string') {
                  takeAll(item.match(/\/(?:Volumes|Users|mnt|home|opt|srv)\/[^\s'"`)]+/g) || []);
                }
              }
            }
            if (Array.isArray(data.permissions.additionalDirectories)) takeAll(data.permissions.additionalDirectories);
          }
          if (data.aiac && Array.isArray(data.aiac.allowedWorkspaces)) takeAll(data.aiac.allowedWorkspaces);
        }
      }
    } catch {}
  }

  const cwd = realPathSafe(process.cwd());
  if (isAllowedDevWorkspace(cwd)) {
    const relative = path.relative(realPathSafe(devRoot), cwd).split(path.sep).filter(Boolean);
    if (relative[0]) {
      if (relative[0].toLowerCase() === 'skills' && relative[1]) {
        workspaces.push(path.join(realPathSafe(devRoot), relative[0], relative[1]));
      } else {
        workspaces.push(path.join(realPathSafe(devRoot), relative[0]));
      }
    }
  }

  return Array.from(new Set(workspaces.map(w => realPathSafe(w)).filter(Boolean)));
}

function isAllowedDevTarget(targetPath) {
  const safeTarget = realPathSafe(targetPath);
  const allowedWorkspaces = getConfiguredDevWorkspaces();
  for (const ws of allowedWorkspaces) {
    if (isPathInside(ws, safeTarget)) {
      return true;
    }
  }

  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectDevPaths(payload) {
  const input = payload.tool_input || {};
  const baseCwd = realPathSafe(payload.cwd || payload.workspace || process.cwd());
  const paths = [];

  function extractStrings(obj, key) {
    if (key && (key === 'content' || key === 'new_string' || key === 'old_string')) {
      return; // Không quét nội dung file ghi, chỉ quét target paths và shell commands
    }
    if (typeof obj === 'string') {
      const normalizedStr = obj.replace(/\\/g, '/');
      const matches = normalizedStr.match(new RegExp(`${escapeRegExp(devRoot.replace(/\\/g, '/'))}(?:/[^\\s'"\`;&|<>)]*)?`, 'g')) || [];
      paths.push(...matches);
      if (obj.startsWith(devRoot) || obj.startsWith(realPathSafe(devRoot))) {
        paths.push(obj);
      }

      // Kiểm tra relative path traversal hoặc path chỉ định (file_path, path, dir, etc.)
      const isPathKey = key && /path|file|dir|cwd|target/i.test(key);
      if (isPathKey && !obj.includes('\n') && !obj.startsWith('http:') && !obj.startsWith('https:')) {
        try {
          const resolved = path.resolve(baseCwd, obj);
          if (isPathInside(devRoot, resolved)) {
            paths.push(resolved);
          }
        } catch {}
      } else if (obj.includes('..') || (obj.includes('/') && !obj.includes('\n'))) {
        const tokens = obj.split(/[\s'"`;|&<>]+/);
        for (const token of tokens) {
          if (!token || token.startsWith('http:') || token.startsWith('https:')) continue;
          if (token.includes('..') || token.startsWith('/') || token.startsWith('\\')) {
            try {
              const resolved = path.resolve(baseCwd, token);
              if (isPathInside(devRoot, resolved)) {
                paths.push(resolved);
              }
            } catch {}
          }
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => extractStrings(item, key));
    } else if (obj !== null && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        extractStrings(v, k);
      }
    }
  }

  extractStrings(input, '');

  return Array.from(new Set(paths)).filter(target => {
    try {
      return isPathInside(devRoot, target);
    } catch {
      return false;
    }
  });
}

function guardDevScope(payload) {
  const devPaths = collectDevPaths(payload);
  if (!devPaths.length) return null;
  const blocked = devPaths.filter(target => !isAllowedDevTarget(target));
  if (!blocked.length) return null;
  const toolName = payload.tool_name || 'Tool';
  const blockedList = blocked.join(', ');

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Agent đang cố gắng đọc vùng ngoài project: ${blockedList}\nSếp có cho phép không? (Chọn Yes để duyệt 1 lần, hoặc kéo thả folder đó vào chat để cấp quyền vĩnh viễn)`,
      additionalContext: `[AIaC Scope Guard] Tool ${toolName} đang xin quyền truy cập vùng ngoài project: ${blockedList}. Đang chờ Sếp phê duyệt (Nếu Sếp từ chối, hãy dừng tool và hỏi Sếp).`
    }
  };
}

async function handleHook() {
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

  const scopeBlock = guardDevScope(payload);
  if (scopeBlock) {
    process.stdout.write(JSON.stringify(scopeBlock));
    return;
  }

  if (disabled) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  const toolName = payload.tool_name || '';
  const toolInput = payload.tool_input || {};
  const toolResponse = payload.tool_response || {};

  // 1. Nếu là PreToolUse (can thiệp trước khi tool chạy)
  if (!payload.tool_response) {
    const context = {
      event: 'PreToolUse',
      tool: toolName,
      input: toolInput,
    };

    const finalContext = await loader.events.waterfall('tool/pre-execute', context);
    const output = finalContext.continue === false
      ? {
          continue: false,
          stopReason: finalContext.reason || 'AIaC policy blocked this tool call.',
          reason: finalContext.reason || 'AIaC policy blocked this tool call.',
        }
      : {
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            updatedInput: finalContext.input,
          },
        };
    process.stdout.write(JSON.stringify(output));
    return;
  }

  // 2. Nếu là PostToolUse (can thiệp sau khi tool chạy thành công)
  const context = {
    event: 'PostToolUse',
    tool: toolName,
    input: toolInput,
    response: toolResponse,
  };

  const finalContext = await loader.events.waterfall('tool/post-execute', context);
  const output = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: finalContext.additionalContext || '',
    },
  };
  process.stdout.write(JSON.stringify(output));
}

handleHook().catch(err => {
  process.stderr.write(`\x1b[31m[AIaC Hook Bridge Error]\x1b[0m ${err.message}\n`);
  process.stdout.write(JSON.stringify({ continue: true }));
});
