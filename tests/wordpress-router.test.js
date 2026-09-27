#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-wp-router-'));
const claudeRoot = path.join(root, 'claude');
const project = path.join(root, 'project');
const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, '360org', 'scripts', 'hooks', '360-smart-router.js');

try {
  fs.mkdirSync(path.join(project, 'wp-content', 'plugins', 'demo'), { recursive: true });
  fs.mkdirSync(path.join(claudeRoot, '360org', 'scripts', 'common'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, '360org', 'scripts', 'common', 'codegraph.js'), path.join(claudeRoot, '360org', 'scripts', 'common', 'codegraph.js'));
  fs.copyFileSync(path.join(repoRoot, '360org', 'scripts', 'common', 'agent-map.py'), path.join(claudeRoot, '360org', 'scripts', 'common', 'agent-map.py'));
  fs.writeFileSync(path.join(project, 'wp-config.php'), '<?php\n');
  fs.writeFileSync(path.join(project, 'wp-content', 'plugins', 'demo', 'demo.php'), "<?php add_action('init', 'demo_init'); function demo_init() {}\n");

  const result = spawnSync(process.execPath, [script], {
    cwd: project,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_AGENT_MAP: '1' },
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }),
  });
  assert.strictEqual(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.match(output.hookSpecificOutput.additionalContext, /Workspace: WORDPRESS/);
  assert.match(output.hookSpecificOutput.additionalContext, /360-wordpres/);
  assert.match(output.hookSpecificOutput.additionalContext, /wordpress/);
  assert.match(fs.readFileSync(path.join(project, '.claude', 'CLAUDE.md'), 'utf8'), /360-wordpres/);
  assert.ok(fs.existsSync(path.join(project, '.claude', 'aiac', 'index', 'agent-map.md')));
  console.log('wordpress-router self-check passed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
