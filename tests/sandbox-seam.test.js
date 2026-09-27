'use strict';

/**
 * Test Remote Sandbox Seam
 * Kiểm thử khả năng hoán đổi linh hoạt giữa Local Provider và Remote SSH Provider (alias 'local').
 */

const assert = require('assert');
const { SeamRegistry } = require('../360org/core/capability-seams');
const { LocalSubprocessProvider, SshRemoteProvider } = require('../360org/core/sandbox-seam');

async function testSandboxSeam() {
  process.stdout.write('\n\x1b[34m[Testing AIaC Sandbox Seam & Remote SSH Provider]\x1b[0m\n');
  const seams = new SeamRegistry();

  // 1. Đăng ký 2 Provider vào Seam 'sandbox'
  const localProvider = new LocalSubprocessProvider();
  const remoteLocalSshProvider = new SshRemoteProvider({ hostAlias: 'local', remoteCwd: '/root' });

  seams.registerProvider('sandbox', 'local-subprocess', localProvider);
  seams.registerProvider('sandbox', 'ssh-local-server', remoteLocalSshProvider);

  // 2. Test thực thi qua Local Provider
  process.stdout.write('  1. Testing LocalSubprocessProvider... ');
  const localRes = await localProvider.exec('whoami && uname -s');
  assert.strictEqual(localRes.exitCode, 0, 'Local command must succeed');
  assert.ok(localRes.stdout.length > 0, 'Local stdout must not be empty');
  process.stdout.write(`\x1b[32mPASS\x1b[0m (Output: "${localRes.stdout.replace(/\n/g, ' ')}")\n`);

  // 3. Test thực thi qua SSH Remote Sandbox (alias 'local')
  process.stdout.write('  2. Testing SshRemoteProvider on alias "local"... ');
  const remoteRes = await remoteLocalSshProvider.exec('whoami && hostname && uname -a');
  assert.strictEqual(remoteRes.exitCode, 0, 'Remote SSH command on alias "local" must succeed');
  assert.ok(remoteRes.stdout.includes('root') || remoteRes.stdout.length > 0, 'Remote stdout must return response from server');
  process.stdout.write(`\x1b[32mPASS\x1b[0m\n     \x1b[36m➔ Remote Host Output:\x1b[0m "${remoteRes.stdout.replace(/\n/g, ' | ')}"\n`);

  // 4. Test Seam Consumer gọi động qua Registry
  process.stdout.write('  3. Testing Seam Swapping via Registry... ');
  const activeSandbox = seams.getProvider('sandbox', 'ssh-local-server');
  assert.ok(activeSandbox, 'Must retrieve ssh-local-server from registry');

  const dynamicRes = await activeSandbox.exec('echo "Dynamic Seam Resolution OK: $(uptime | cut -d, -f1)"');
  assert.strictEqual(dynamicRes.exitCode, 0);
  process.stdout.write(`\x1b[32mPASS\x1b[0m\n     \x1b[36m➔ Response:\x1b[0m ${dynamicRes.stdout}\n`);

  process.stdout.write('\n\x1b[32m[SUCCESS] Remote Sandbox Seam verified and functional on local server!\x1b[0m\n\n');
}

testSandboxSeam().catch(err => {
  process.stderr.write(`\x1b[31mSandbox Test FAILED:\x1b[0m ${err.stack}\n`);
  process.exit(1);
});
