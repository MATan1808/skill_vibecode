#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-'));
const claudeRoot = path.join(root, 'claude');
const project = path.join(root, 'project');
const script = path.resolve(__dirname, '..', '360org', 'scripts', 'hooks', '360-smart-router.js');

fs.mkdirSync(path.join(project, 'addons', 'demo'), { recursive: true });
fs.mkdirSync(path.join(claudeRoot, '360org', 'scripts', 'common'), { recursive: true });
fs.copyFileSync(path.resolve(__dirname, '..', '360org', 'scripts', 'common', 'codegraph.js'), path.join(claudeRoot, '360org', 'scripts', 'common', 'codegraph.js'));
fs.copyFileSync(path.resolve(__dirname, '..', '360org', 'scripts', 'common', 'agent-map.py'), path.join(claudeRoot, '360org', 'scripts', 'common', 'agent-map.py'));
fs.writeFileSync(path.join(project, 'addons', 'demo', '__manifest__.py'), '{}\n');
// Codegraph chỉ chạy khi cwd là project root (isProjectRoot: .git/README.md/package.json...).
fs.writeFileSync(path.join(project, 'README.md'), '# Demo Odoo Project\n');
fs.writeFileSync(path.join(project, 'models.py'), "from odoo import models, fields\nclass Demo(models.Model):\n    _name = 'demo.model'\n    name = fields.Char()\n");

const result = spawnSync(process.execPath, [script], {
  cwd: project,
  encoding: 'utf8',
  // Agent-map giờ là opt-in (router chỉ chạy khi AIAC_AGENT_MAP=1 hoặc Sếp yêu cầu audit).
  // Pin explicit: không để AIAC_SKIP_CODEGRAPH / AIAC_AGENT_MAP của shell ngoài làm sai lệch test.
  env: { ...process.env, CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_AGENT_MAP: '1', AIAC_SKIP_CODEGRAPH: '0' },
  input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }),
});
assert.strictEqual(result.status, 0, result.stderr);
const output = JSON.parse(result.stdout);
assert.strictEqual(output.hookSpecificOutput.hookEventName, 'SessionStart');
assert.match(output.hookSpecificOutput.additionalContext, /Workspace: ODOO/);
// Agent-map KHÔNG inject vào context (maxAgentMapChars=0 để tiết kiệm token);
// chỉ ghi ra file để agent đọc on-demand — xác minh bằng assert file tồn tại bên dưới.
assert.strictEqual(fs.readFileSync(path.join(project, '.claude', 'settings.local.json'), 'utf8'), '{}\n');
assert.match(fs.readFileSync(path.join(project, '.claude', 'CLAUDE.md'), 'utf8'), /XML không dùng/);
assert.ok(fs.existsSync(path.join(project, '.claude', 'codegraph.md')));
assert.ok(fs.existsSync(path.join(project, '.claude', 'aiac', 'index', 'agent-map.md')));

fs.rmSync(root, { recursive: true, force: true });
console.log('smart-router self-check passed');
