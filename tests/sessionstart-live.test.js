#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-sessionstart-'));
const pluginRoot = path.join(temp, 'claude');
const project = path.join(temp, 'project');

try {
  fs.mkdirSync(path.join(pluginRoot, '360org', 'scripts', 'common'), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, '360org', 'scripts', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.mkdirSync(path.join(project, '.codegraph'), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, '360org', 'scripts', 'common', 'codegraph.js'),
    path.join(pluginRoot, '360org', 'scripts', 'common', 'codegraph.js')
  );
  fs.copyFileSync(
    path.join(repoRoot, '360org', 'scripts', 'common', 'agent-map.py'),
    path.join(pluginRoot, '360org', 'scripts', 'common', 'agent-map.py')
  );
  fs.copyFileSync(
    path.join(repoRoot, '360org', 'scripts', 'hooks', '360-smart-router.js'),
    path.join(pluginRoot, '360org', 'scripts', 'hooks', '360-smart-router.js')
  );
  fs.writeFileSync(path.join(pluginRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  // Codegraph chỉ chạy khi cwd là project root (isProjectRoot: .git/README.md/package.json...).
  fs.writeFileSync(path.join(project, 'README.md'), '# Generic Project\n');
  fs.writeFileSync(path.join(project, 'src', 'a.js'), "import './b'\n");
  fs.writeFileSync(path.join(project, 'src', 'b.js'), 'export const b = 1\n');

  const run = () => spawnSync(process.execPath, [path.join(pluginRoot, '360org', 'scripts', 'hooks', '360-smart-router.js')], {
    cwd: project,
    input: '{}',
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      AIAC_REPO_ROOT: path.join(project, 'missing-git'),
      // Pin explicit: chặn AIAC_SKIP_CODEGRAPH / AIAC_AGENT_MAP của shell ngoài làm sai lệch test.
      AIAC_SKIP_CODEGRAPH: '0',
      AIAC_AGENT_MAP: '1',
    },
  });

  const first = run();
  assert.strictEqual(first.status, 0, first.stderr);
  const payload = JSON.parse(first.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  assert.strictEqual(payload.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(context, /Workspace: GENERIC/);
  // Agent-map không inject vào context (maxAgentMapChars=0, tiết kiệm token);
  // file agent-map.md vẫn được sinh ra và assert ở dưới.
  assert.ok(context.length <= 4400);
  assert.strictEqual(fs.readFileSync(path.join(project, '.claude', 'settings.local.json'), 'utf8'), '{}\n');
  assert.ok(fs.existsSync(path.join(project, '.claude', 'CLAUDE.md')));
  assert.ok(fs.existsSync(path.join(project, '.claude', 'aiac', 'PROJECT_PROFILE.md')));
  assert.ok(fs.existsSync(path.join(project, '.claude', 'aiac', 'SKILL_DISCOVERY.md')));
  const graphPath = path.join(project, '.claude', 'codegraph.md');
  const mapPath = path.join(project, '.claude', 'aiac', 'index', 'agent-map.md');
  assert.ok(fs.existsSync(graphPath));
  assert.ok(fs.existsSync(mapPath));
  const graphMtime = fs.statSync(graphPath).mtimeMs;
  const mapMtime = fs.statSync(mapPath).mtimeMs;

  const second = run();
  assert.strictEqual(second.status, 0, second.stderr);
  assert.strictEqual(fs.statSync(graphPath).mtimeMs, graphMtime);
  assert.strictEqual(fs.statSync(mapPath).mtimeMs, mapMtime);

  console.log('sessionstart fixture self-check passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
