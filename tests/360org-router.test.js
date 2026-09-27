#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const router = path.join(repoRoot, '360org', 'scripts', 'hooks', '360-smart-router.js');
const overlayPath = path.join(repoRoot, 'config', 'claude', 'settings.overlay.json');
const mergeScript = path.join(repoRoot, 'scripts', 'aiac', 'merge-claude-settings.js');
const doctorScript = path.join(repoRoot, '360org', 'scripts', 'aiac', 'doctor.js');
const resetScript = path.join(repoRoot, '360org', 'scripts', 'aiac', 'reset-claude-env.js');
const hookBridge = path.join(repoRoot, '360org', 'scripts', 'hooks', 'aiac-hook-bridge.js');

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runNode(script, options = {}) {
  const result = spawnSync(process.execPath, [script, ...(options.args || [])], {
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    input: options.input || '',
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  return result;
}

(function overlayContainsAllHooks() {
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  for (const event of ['SessionStart', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop']) {
    assert.ok(Array.isArray(overlay.hooks?.[event]), `${event} missing`);
    assert.ok(overlay.hooks[event].length > 0, `${event} empty`);
  }
})();

(function mergeAddsAllHooks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-merge-'));
  const target = path.join(root, 'settings.json');
  write(target, JSON.stringify({ hooks: { SessionStart: [] }, keep: true }));
  runNode(mergeScript, { args: ['--target', target] });
  const settings = JSON.parse(fs.readFileSync(target, 'utf8'));
  for (const event of ['SessionStart', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop']) {
    assert.ok(Array.isArray(settings.hooks?.[event]), `${event} missing after merge`);
  }
  assert.strictEqual(settings.keep, true);
  fs.rmSync(root, { recursive: true, force: true });
})();

(function mergeReplacesAiacManagedHooks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-merge-replace-'));
  const target = path.join(root, 'settings.json');
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  const staleStop = JSON.parse(JSON.stringify(overlay.hooks.Stop));
  for (const hook of staleStop[0].hooks) hook.timeout = 10;
  write(target, JSON.stringify({ hooks: { Stop: staleStop } }));
  runNode(mergeScript, { args: ['--target', target] });
  const settings = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.strictEqual(settings.hooks.Stop.length, 1);
  assert.deepStrictEqual(settings.hooks.Stop[0].hooks.map(hook => hook.timeout), [5]);
  fs.rmSync(root, { recursive: true, force: true });
})();

(function routerUsesProjectScopedCleanSummary() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-project-'));
  const otherProject = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-other-'));
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  write(path.join(claudeRoot, 'session-data', '2026-08-18-other-session.tmp'), `# Session\n**Worktree:** ${otherProject}\n<!-- ECC:SUMMARY:START -->\n## Session Summary\n- other project task\n<!-- ECC:SUMMARY:END -->\n`);
  write(path.join(claudeRoot, 'session-data', '2026-08-18-current-session.tmp'), `# Session\n**Worktree:** ${project}\n<!-- ECC:SUMMARY:START -->\n## Session Summary\n- current task\n- current task\n- This session is being continued from a previous conversation that ran out of context.\nSummary: noisy\n<!-- ECC:SUMMARY:END -->\n`);
  fs.utimesSync(path.join(claudeRoot, 'session-data', '2026-08-18-current-session.tmp'), new Date(1), new Date(1));
  fs.utimesSync(path.join(claudeRoot, 'session-data', '2026-08-18-other-session.tmp'), new Date(2), new Date(2));

  const result = runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot } });
  const payload = JSON.parse(result.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  assert.match(context, /current task/);
  assert.doesNotMatch(context, /other project task/);
  assert.doesNotMatch(context, /This session is being continued/);
  assert.strictEqual((context.match(/current task/g) || []).length, 1);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
  fs.rmSync(otherProject, { recursive: true, force: true });
})();

// Regression: manifest Odoo nằm ở modules/<nhóm>/<module>/__manifest__.py (depth 3).
// maxDepth=2 làm repo addons bị nhận nhầm generic => không nạp 360-odoo.
(function routerDetectsOdooAddonsAtDepthThree() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-odoo-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-odoo-repo-'));
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  write(path.join(project, 'modules', 'extra', 'commissions', '__manifest__.py'), "{'name': 'Commissions'}\n");

  const result = runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /Workspace: ODOO/);
  assert.match(context, /360-odoo/);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
})();

// Ưu tiên 1: PROJECT_PROFILE.md của project thắng auto-detect.
(function routerProjectProfileOverridesAutoDetect() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-profile-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-profile-repo-'));
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  // Không có dấu hiệu Odoo trên đĩa — chỉ profile khai báo.
  write(path.join(project, '.claude', 'aiac', 'PROJECT_PROFILE.md'), '# AIaC Project Profile\n\n- Loại dự án: odoo (Odoo 17 addons).\n');

  const result = runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /Workspace: ODOO/);
  assert.match(context, /360-odoo/);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
})();

// Profile 'generic' cũ KHÔNG được khoá auto-detect, nếu không repo lỡ sinh
// profile sai sẽ mắc kẹt vĩnh viễn (PROJECT_PROFILE.md ghi bằng writeIfAbsent).
(function routerGenericProfileDoesNotBlockAutoDetect() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-stale-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-stale-repo-'));
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  write(path.join(project, '.claude', 'aiac', 'PROJECT_PROFILE.md'), '# AIaC Project Profile\n\n- Loại dự án: generic.\n');
  write(path.join(project, 'modules', 'extra', 'commissions', '__manifest__.py'), "{'name': 'Commissions'}\n");

  const result = runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /Workspace: ODOO/);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
})();

(function routerSkipsLegacySkillsWorkspace() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-legacy-'));
  const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-legacy-skills-'));
  const project = path.join(legacyRoot, 'child');
  write(path.join(project, 'README.md'), '# Legacy\n');
  write(path.join(claudeRoot, '360org', 'scripts', 'common', 'agent-map.py'), "from pathlib import Path\nPath('.claude/aiac/index/agent-map.md').parent.mkdir(parents=True, exist_ok=True)\nPath('.claude/aiac/index/agent-map.md').write_text('agent map ran')\n");
  write(path.join(claudeRoot, '360org', 'scripts', 'common', 'codegraph.js'), "require('fs').writeFileSync('.claude/codegraph.md', 'codegraph ran')\n");

  runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_LEGACY_SKILLS_PATH: legacyRoot, AIAC_AGENT_MAP: '1' } });
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'codegraph.md')));
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'aiac', 'index', 'agent-map.md')));
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'aiac', 'PROJECT_PROFILE.md')));

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(legacyRoot, { recursive: true, force: true });
})();

(function routerSkipsLegacySkillsUpstreamAutoUpdate() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-upstream-'));
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-repo-upstream-'));
  const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-legacy-upstream-'));
  const legacyUpstream = path.join(legacyRoot, 'ECC');
  write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  write(path.join(repo, '.git', 'config'), `[remote "upstream"]\n\turl = ${legacyUpstream}\n`);
  write(path.join(repo, 'README.md'), '# AIaC\n');
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot: repo }));
  const lockPath = path.join(os.tmpdir(), 'aiac-upstream-update.lock');
  fs.rmSync(lockPath, { force: true });

  runNode(router, { cwd: repo, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_LEGACY_SKILLS_PATH: legacyRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  assert.ok(!fs.existsSync(lockPath));

  fs.rmSync(lockPath, { force: true });
  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(legacyRoot, { recursive: true, force: true });
})();

(function routerDoesNotAutoRunAgentMap() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-map-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-project-map-'));
  write(path.join(project, 'README.md'), '# Project\n');
  write(path.join(claudeRoot, '360org', 'scripts', 'common', 'agent-map.py'), "from pathlib import Path\nPath('.claude/aiac/index/agent-map.md').parent.mkdir(parents=True, exist_ok=True)\nPath('.claude/aiac/index/agent-map.md').write_text('agent map ran')\n");

  runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'aiac', 'index', 'agent-map.md')));

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
})();

(function routerSkipsLargeCodegraphWorkspace() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-large-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-project-large-'));
  write(path.join(project, 'README.md'), '# Project\n');
  write(path.join(project, 'one.js'), 'export const one = 1\n');
  write(path.join(project, 'two.js'), 'export const two = 2\n');

  runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_CODEGRAPH_MAX_ENTRIES: '2', AIAC_SKIP_CODEGRAPH: '0' } });
  const graph = fs.readFileSync(path.join(project, '.claude', 'codegraph.md'), 'utf8');
  assert.match(graph, /Trạng thái: skipped/);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
})();

(function routerCodegraphLockPreventsDuplicateRun() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-lock-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-project-lock-'));
  write(path.join(project, 'README.md'), '# Project\n');
  write(path.join(claudeRoot, '360org', 'scripts', 'common', 'codegraph.js'), "require('fs').writeFileSync('.claude/codegraph.md', 'codegraph ran')\n");
  const key = Buffer.from(fs.realpathSync(project)).toString('hex').slice(0, 96);
  const lockPath = path.join(os.tmpdir(), `aiac-codegraph-${key}.lock`);
  fs.writeFileSync(lockPath, 'locked');

  try {
    runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_CODEGRAPH_MAX_ENTRIES: '100', AIAC_SKIP_CODEGRAPH: '0' } });
    assert.ok(!fs.existsSync(path.join(project, '.claude', 'codegraph.md')));
  } finally {
    fs.rmSync(lockPath, { force: true });
    fs.rmSync(claudeRoot, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
})();

(function routerHasNoMachineSpecificAiacFallback() {
  const source = fs.readFileSync(router, 'utf8');
  assert.doesNotMatch(source, /\/Volumes\/DATA\/DEV\/aiac/);
})();

(function routerDoesNotScanDevWorkspacesByDefault() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-dev-deny-'));
  const devRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-dev-root-'));
  const project = path.join(devRoot, 'project');
  write(path.join(project, 'README.md'), '# Project\n');
  write(path.join(claudeRoot, '360org', 'scripts', 'common', 'agent-map.py'), "from pathlib import Path\nPath('.claude/aiac/index/agent-map.md').parent.mkdir(parents=True, exist_ok=True)\nPath('.claude/aiac/index/agent-map.md').write_text('agent map ran')\n");
  write(path.join(claudeRoot, '360org', 'scripts', 'common', 'codegraph.js'), "require('fs').writeFileSync('.claude/codegraph.md', 'codegraph ran')\n");

  const result = runNode(router, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_FORBIDDEN_DEV_ROOT: devRoot, AIAC_AGENT_MAP: '1' } });
  const payload = JSON.parse(result.stdout);
  assert.match(payload.hookSpecificOutput.additionalContext, /auto load\/index\/read\/scan disabled/);
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'codegraph.md')));
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'aiac', 'index', 'agent-map.md')));
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'aiac', 'PROJECT_PROFILE.md')));
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'settings.local.json')));

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(devRoot, { recursive: true, force: true });
})();

(function overlayEnablesTelemetryDashboard() {
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  assert.strictEqual(overlay.env?.AIAC_TELEMETRY_DASHBOARD, '1');
})();

(function routerStartsTelemetryDashboardBeforeDevDeny() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-telemetry-'));
  const devRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-dev-root-'));
  const project = path.join(devRoot, 'project');
  const marker = path.join(claudeRoot, 'telemetry-started');
  write(path.join(project, 'README.md'), '# Project\n');
  write(path.join(claudeRoot, '360org', 'telemetry', 'server.js'), "require('fs').writeFileSync(process.env.AIAC_TELEMETRY_MARKER, 'ready')\n");

  runNode(router, {
    cwd: project,
    env: {
      CLAUDE_PLUGIN_ROOT: claudeRoot,
      AIAC_FORBIDDEN_DEV_ROOT: devRoot,
      AIAC_TELEMETRY_DASHBOARD: '1',
      AIAC_TELEMETRY_PORT: '1',
      AIAC_TELEMETRY_MARKER: marker,
    },
  });
  for (let i = 0; i < 20 && !fs.existsSync(marker); i += 1) {
    spawnSync(process.execPath, ['-e', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25)']);
  }
  assert.ok(fs.existsSync(marker), 'telemetry dashboard was not started before DEV deny return');

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(devRoot, { recursive: true, force: true });
})();

(function hookBridgeBlocksDevPathOutsideAllowedWorkspace() {
  const devRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-hook-dev-'));
  const project = path.join(devRoot, 'project');
  const other = path.join(devRoot, 'other', 'file.js');
  write(path.join(project, 'README.md'), '# Project\n');
  const result = runNode(hookBridge, {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: other } }),
    env: { AIAC_LIGHT_HOOKS: '1', AIAC_FORBIDDEN_DEV_ROOT: devRoot, AIAC_ALLOWED_DEV_WORKSPACE: project },
  });
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.hookSpecificOutput?.permissionDecision, 'ask');
  assert.match(payload.hookSpecificOutput?.permissionDecisionReason, /ngoài project/);

  fs.rmSync(devRoot, { recursive: true, force: true });
})();

(function hookBridgeAllowsConfiguredDevWorkspace() {
  const devRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-hook-dev-'));
  const project = path.join(devRoot, 'project');
  const filePath = path.join(project, 'file.js');
  write(filePath, 'export const ok = true\n');
  const result = runNode(hookBridge, {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: filePath } }),
    env: { AIAC_LIGHT_HOOKS: '1', AIAC_FORBIDDEN_DEV_ROOT: devRoot, AIAC_ALLOWED_DEV_WORKSPACE: project },
  });
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.continue, true);

  fs.rmSync(devRoot, { recursive: true, force: true });
})();

(function hookBridgeRejectsBroadDevWorkspace() {
  const devRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-hook-dev-'));
  const filePath = path.join(devRoot, 'project', 'file.js');
  write(filePath, 'export const blocked = true\n');
  const result = runNode(hookBridge, {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: filePath } }),
    env: { AIAC_LIGHT_HOOKS: '1', AIAC_FORBIDDEN_DEV_ROOT: devRoot, AIAC_ALLOWED_DEV_WORKSPACE: devRoot },
  });
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.hookSpecificOutput?.permissionDecision, 'ask');
  assert.match(payload.hookSpecificOutput?.permissionDecisionReason, /ngoài project/);

  fs.rmSync(devRoot, { recursive: true, force: true });
})();

(function hookBridgeAllowsSpecificSkillSourcesSubRepoNetPath() {
  const devRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-hook-netpath-'));
  const subRepo = path.join(devRoot, 'SKILL_SOURCES', 'hermes-dev-skills');
  const filePath = path.join(subRepo, 'scripts', 'test.py');
  write(filePath, 'print("ok")\n');
  const result = runNode(hookBridge, {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: filePath } }),
    env: { AIAC_LIGHT_HOOKS: '1', AIAC_FORBIDDEN_DEV_ROOT: devRoot, AIAC_ALLOWED_DEV_WORKSPACE: subRepo },
  });
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.continue, true);

  // Chặn root wildcard SKILL_SOURCES
  const blockedResult = runNode(hookBridge, {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: filePath } }),
    env: { AIAC_LIGHT_HOOKS: '1', AIAC_FORBIDDEN_DEV_ROOT: devRoot, AIAC_ALLOWED_DEV_WORKSPACE: path.join(devRoot, 'SKILL_SOURCES') },
  });
  const blockedPayload = JSON.parse(blockedResult.stdout);
  assert.strictEqual(blockedPayload.hookSpecificOutput?.permissionDecision, 'ask');
  assert.match(blockedPayload.hookSpecificOutput?.permissionDecisionReason, /ngoài project/);

  fs.rmSync(devRoot, { recursive: true, force: true });
})();

(function installScriptParses() {
  const result = spawnSync('bash', ['-n', path.join(repoRoot, 'install-aiac.sh')], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
})();

(function powershellInstallerParsesWhenAvailable() {
  const command = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const version = spawnSync(command, ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
  if (version.status !== 0) return;
  const scriptPath = path.join(repoRoot, 'install-aiac.ps1');
  const result = spawnSync(command, ['-NoLogo', '-NoProfile', '-Command', `[scriptblock]::Create((Get-Content -LiteralPath '${scriptPath.replace(/'/g, "''")}' -Raw)) | Out-Null`], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
})();

(function doctorScriptParses() {
  const result = spawnSync(process.execPath, ['-c', doctorScript], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
})();

(function resetScriptParses() {
  const result = spawnSync(process.execPath, ['-c', resetScript], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
})();

(function runtimeDoctorUsesAiacRuntimeRepoRoot() {
  const envRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-doctor-runtime-'));
  const runtimeDoctor = path.join(envRoot, '.claude', '360org', 'scripts', 'aiac', 'doctor.js');
  write(runtimeDoctor, fs.readFileSync(doctorScript, 'utf8'));
  write(path.join(envRoot, '.claude', '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  write(path.join(envRoot, '.claude', 'settings.json'), JSON.stringify({
    env: { AIAC_TELEMETRY_DASHBOARD: '1' },
    hooks: Object.fromEntries(['SessionStart', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop'].map(name => [name, [{}]])),
  }));
  fs.mkdirSync(path.join(envRoot, '.claude', 'session-data'), { recursive: true });

  runNode(runtimeDoctor, { env: { AIAC_ENV_ROOT: envRoot } });

  const forbiddenRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-forbidden-dir-'));
  write(path.join(envRoot, '.claude', 'settings.json'), JSON.stringify({
    env: { AIAC_TELEMETRY_DASHBOARD: '1' },
    hooks: Object.fromEntries(['SessionStart', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop'].map(name => [name, [{}]])),
    permissions: { additionalDirectories: [forbiddenRoot] },
  }));
  const blocked = spawnSync(process.execPath, [runtimeDoctor], { env: { ...process.env, AIAC_ENV_ROOT: envRoot, AIAC_FORBIDDEN_DEV_ROOT: forbiddenRoot }, encoding: 'utf8' });
  assert.notStrictEqual(blocked.status, 0);
  assert.match(blocked.stdout, /Không cấp additionalDirectories/);

  fs.rmSync(envRoot, { recursive: true, force: true });
  fs.rmSync(forbiddenRoot, { recursive: true, force: true });
})();

console.log('Passed: 26');
console.log('Failed: 0');
