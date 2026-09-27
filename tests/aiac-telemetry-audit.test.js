'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== Testing Telemetry (Audit fixes) ===');
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}\n  ${err.stack}`);
    failed++;
  }
}

(async () => {
  const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-telemetry-test-')));
  const oldCwd = process.cwd();
  const oldEnvRoot = process.env.AIAC_ENV_ROOT;
  process.env.AIAC_ENV_ROOT = path.join(sandbox, 'env');

  process.chdir(sandbox);
  const repoRoot = path.join(sandbox, 'repo');
  const harnessDir = path.join(repoRoot, '360org', 'plugins', '360-harness', 'data');
  const envRoot = path.join(sandbox, 'env');
  
  fs.mkdirSync(harnessDir, { recursive: true });
  fs.mkdirSync(path.join(envRoot, '.claude'), { recursive: true });
  
  // mock telemetry server module isolation
  fs.mkdirSync(path.join(sandbox, 'mock-server'));
  
  let originalServerSource = fs.readFileSync(path.join(oldCwd, '360org', 'telemetry', 'server.js'), 'utf8');
  // Strip top level execute / require code that crashes in test
  let mockSource = originalServerSource
    .replace(/server\.listen\(PORT, '127\.0\.0\.1', \(\) => \{[\s\S]*?\}\);/, '')
    .replace('setInterval(fetchLiveTelemetry, 5000);', '//setInterval')
    .replace(/const db = new Database.*/g, 'const db = null;')
    .replace(/db\.exec\(/g, '// db.exec')
    .replace(/path\.resolve\(__dirname, '\.\.', '\.\.'\)/g, `"${repoRoot}"`)
    .replace(/path\.resolve\(__dirname, '\.\.', '\.\.', '\.\.'\)/g, `"${envRoot}"`);
    
  mockSource += `\nmodule.exports = { getAutoHarnessStats, escapeHtml };`;
  
  fs.writeFileSync(path.join(sandbox, 'mock-server', 'server.js'), mockSource);
  const server = require(path.join(sandbox, 'mock-server', 'server.js'));

  try {
    await test('getAutoHarnessStats: Mapped by contentHash for true final state', async () => {
      // Create ledger with duplicate hashes, second one overrides status
      fs.writeFileSync(path.join(harnessDir, 'learning-ledger.jsonl'), 
        JSON.stringify({ id: '1', contentHash: 'hash1', type: 'USER_DIRECTIVE', status: 'PENDING_APPROVAL' }) + '\n' +
        JSON.stringify({ id: '2', contentHash: 'hash2', type: 'RESOLVED_PITFALL', status: 'PENDING_APPROVAL' }) + '\n' +
        JSON.stringify({ id: '1', contentHash: 'hash1', type: 'USER_DIRECTIVE', status: 'REJECTED', ledgerAction: 'REJECTED' }) + '\n' +
        JSON.stringify({ id: '2', contentHash: 'hash2', type: 'RESOLVED_PITFALL', status: 'APPROVED', ledgerAction: 'APPROVED' }) + '\n'
      );
      
      const stats = server.getAutoHarnessStats();
      assert.strictEqual(stats.approvedCount, 1);
      assert.strictEqual(stats.directiveCount, 1);
      assert.strictEqual(stats.fixVerifyCount, 1);
      assert.strictEqual(stats.estimatedTokensProtected, undefined);
    });
    
    await test('getAutoHarnessStats: pending from queue only', async () => {
      fs.writeFileSync(path.join(harnessDir, 'pending-proposals.json'), JSON.stringify([
        { id: '123' }, { id: '456' }
      ]));
      const stats = server.getAutoHarnessStats();
      assert.strictEqual(stats.pendingCount, 2);
    });

    await test('getAutoHarnessStats: handles missing files gracefully', async () => {
      fs.rmSync(harnessDir, { recursive: true, force: true });
      const stats = server.getAutoHarnessStats();
      assert.strictEqual(stats.approvedCount, 0);
      assert.strictEqual(stats.pendingCount, 0);
      assert.strictEqual(stats.totalLearned, 0);
      fs.mkdirSync(harnessDir, { recursive: true });
    });

    await test('getAutoHarnessStats: fallback to ID when contentHash missing', async () => {
      fs.writeFileSync(path.join(harnessDir, 'learning-ledger.jsonl'), 
        JSON.stringify({ id: 'item1', type: 'USER_DIRECTIVE', status: 'APPROVED', ledgerAction: 'APPROVED' }) + '\n' +
        JSON.stringify({ id: 'item2', type: 'RESOLVED_PITFALL', status: 'REJECTED', ledgerAction: 'REJECTED' }) + '\n'
      );
      const stats = server.getAutoHarnessStats();
      assert.strictEqual(stats.totalLearned, 2);
      assert.strictEqual(stats.approvedCount, 1);
    });

    await test('getAutoHarnessStats: ignores corrupt lines', async () => {
      fs.writeFileSync(path.join(harnessDir, 'learning-ledger.jsonl'), 
        'this is not json\n' +
        JSON.stringify({ id: 'item1', status: 'APPROVED' }) + '\n' +
        '{ broken: json }\n'
      );
      const stats = server.getAutoHarnessStats();
      assert.strictEqual(stats.totalLearned, 1);
    });

    await test('getAutoHarnessStats: status Configured if Stop hook mounted', async () => {
      fs.writeFileSync(path.join(envRoot, '.claude', 'settings.json'), JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node scripts/hooks/aiac-stop-pipeline.js' }] }] }
      }));
      const stats = server.getAutoHarnessStats();
      assert.strictEqual(stats.status, 'Configured (Stop Hook Mounted)');
    });

    await test('getAutoHarnessStats: status Inactive if Stop hook not mounted', async () => {
      fs.writeFileSync(path.join(envRoot, '.claude', 'settings.json'), JSON.stringify({
        hooks: { PreToolUse: [] }
      }));
      const stats = server.getAutoHarnessStats();
      assert.strictEqual(stats.status, 'Inactive (Stop Hook Not Mounted)');
    });

    await test('escapeHtml: escapes basic HTML chars', async () => {
      const escaped = server.escapeHtml('<div id="test">&\'</div>');
      assert.strictEqual(escaped, '&lt;div id=&quot;test&quot;&gt;&amp;&#039;&lt;/div&gt;');
    });

    await test('escapeHtml: handles null and undefined', async () => {
      assert.strictEqual(server.escapeHtml(null), '');
      assert.strictEqual(server.escapeHtml(undefined), '');
    });

    await test('escapeHtml: leaves safe text untouched', async () => {
      const safe = 'hello world 123';
      assert.strictEqual(server.escapeHtml(safe), safe);
    });

    console.log(`\nPassed: ${passed}`);
    if (failed > 0) {
      console.log(`Failed: ${failed}`);
      process.exitCode = 1;
    }
  } finally {
    if (oldEnvRoot === undefined) {
      delete process.env.AIAC_ENV_ROOT;
    } else {
      process.env.AIAC_ENV_ROOT = oldEnvRoot;
    }
    process.chdir(oldCwd);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
})();
