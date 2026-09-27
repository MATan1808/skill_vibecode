#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, 'scripts', 'aiac', 'merge-project-mcp.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-mcp-'));

try {
  fs.writeFileSync(path.join(temp, '.mcp.json'), JSON.stringify({
    mcpServers: {
      personal: { command: 'personal' },
    },
  }));

  let result = spawnSync(process.execPath, [script, '--server', 'codegraph', '--project', temp], { encoding: 'utf8' });
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /thiếu '.codegraph'/i);

  fs.mkdirSync(path.join(temp, '.codegraph'));
  result = spawnSync(process.execPath, [script, '--server', 'codegraph', '--project', temp], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);

  const merged = JSON.parse(fs.readFileSync(path.join(temp, '.mcp.json'), 'utf8'));
  assert.deepStrictEqual(merged.mcpServers.personal, { command: 'personal' });
  assert.strictEqual(merged.mcpServers.codegraph.command, 'codegraph');
  assert.deepStrictEqual(merged.mcpServers.codegraph.env, { CODEGRAPH_TELEMETRY: '0' });

  result = spawnSync(process.execPath, [script, '--server', 'codegraph', '--project', temp], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.strictEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(temp, '.mcp.json'), 'utf8')).mcpServers).length, 2);

  console.log('mcp catalog self-check passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
