'use strict';

/**
 * AIaC v3.x Full Roadmap Test Suite (v3.1, v3.2, v3.3)
 * 1. Giai đoạn 2: Multi-Host Sandbox Dispatcher & K8s/SSH Routing
 * 2. Giai đoạn 3: Hot-Reloading & Dependency Resolution Graph
 * 3. Giai đoạn 4: Multi-Agent Pipeline & Self-Healing Feedback Loop
 */

const assert = require('assert');
const path = require('path');
const { PluginLoader } = require('../360org/core/plugin-loader');
const { SeamRegistry } = require('../360org/core/capability-seams');
const { LocalSubprocessProvider, SshRemoteProvider, K8sPodRemoteProvider, SandboxDispatcher } = require('../360org/core/sandbox-seam');
const { AgentPipeline } = require('../360org/core/agent-pipeline');

async function testFullRoadmap() {
  process.stdout.write('\n\x1b[34m[Testing AIaC Full Roadmap: v3.1, v3.2 & v3.3]\x1b[0m\n');
  const pluginsDir = path.join(__dirname, '..', '360org', 'plugins');
  const loader = new PluginLoader({ pluginsDir });

  // ==========================================
  // 1. TEST GIAI ĐOẠN 2: MULTI-HOST SANDBOX SEAM
  // ==========================================
  process.stdout.write('  1. Testing Multi-Host Sandbox & Smart Dispatching (v3.1)... ');
  loader.seams.registerProvider('sandbox', 'local-subprocess', new LocalSubprocessProvider());
  loader.seams.registerProvider('sandbox', 'ssh-local', new SshRemoteProvider({ hostAlias: 'local' }));
  loader.seams.registerProvider('sandbox', 'ssh-vuahethong', new SshRemoteProvider({ hostAlias: 'vuahethong' }));
  loader.seams.registerProvider('sandbox', 'ssh-cloudpanel', new SshRemoteProvider({ hostAlias: 'cloudpanel' }));
  loader.seams.registerProvider('sandbox', 'k8s-pod-saas', new K8sPodRemoteProvider({ context: 'saas', namespace: 'customer1' }));

  const dispatcher = new SandboxDispatcher(loader.seams);

  // Kiểm tra Smart Dispatching theo từng context
  const odooProvider = dispatcher.resolveProviderForContext({ workspaceType: 'ODOO_SAAS', namespace: 'customer1' });
  assert.strictEqual(odooProvider.name, 'k8s-pod-saas', 'Odoo SaaS must resolve to K8s provider');

  const wpProvider = dispatcher.resolveProviderForContext({ workspaceType: 'WORDPRESS' });
  assert.strictEqual(wpProvider.name, 'ssh-cloudpanel', 'WordPress must resolve to CloudPanel provider');

  const directSshProvider = dispatcher.resolveProviderForContext({ serverAlias: 'local' });
  assert.strictEqual(directSshProvider.name, 'ssh-local', 'Explicit alias must resolve to corresponding SSH provider');

  process.stdout.write('\x1b[32mPASS\x1b[0m\n');

  // ==========================================
  // 2. TEST GIAI ĐOẠN 3: DEPENDENCY RESOLUTION & HOT-RELOAD
  // ==========================================
  process.stdout.write('  2. Testing Dependency Graph & Hot-Reload Engine (v3.2)... ');
  // 360-wordpress khai báo dependencies: 360-securities, 360-designer, 360-ponytail
  const deps = loader.resolveDependencies('360-wordpress');
  assert.ok(deps.includes('360-securities'), 'Must resolve 360-securities dependency');
  assert.ok(deps.includes('360-designer'), 'Must resolve 360-designer dependency');
  assert.ok(deps.includes('360-ponytail'), 'Must resolve 360-ponytail dependency');

  // Load plugin và test auto-dependency loading
  loader.loadPlugin('360-wordpress');
  assert.ok(loader.loadedPlugins.has('360-wordpress'), '360-wordpress must be loaded');
  assert.ok(loader.loadedPlugins.has('360-securities'), '360-securities must be auto-loaded');
  assert.ok(loader.loadedPlugins.has('360-designer'), '360-designer must be auto-loaded');
  assert.ok(loader.loadedPlugins.has('360-ponytail'), '360-ponytail must be auto-loaded');

  // Test Hot-Reloading
  const reloaded = loader.reloadPlugin('360-wordpress');
  assert.ok(reloaded && reloaded.name === '360-wordpress', 'Hot-reload must succeed without side effects');
  process.stdout.write('\x1b[32mPASS\x1b[0m\n');

  // ==========================================
  // 3. TEST GIAI ĐOẠN 4: MULTI-AGENT & SELF-HEALING
  // ==========================================
  process.stdout.write('  3. Testing Multi-Agent Pipeline & Self-Healing Feedback Loop (v3.3)... ');
  const pipeline = new AgentPipeline(loader);

  // Giả lập case lỗi lần đầu và tự sửa thành công ở lần thứ 2
  let simulatedAttempts = 0;
  let simulatedBugFixed = false;

  const mockExecutionContext = {
    executor: async () => {
      simulatedAttempts++;
      if (!simulatedBugFixed) {
        return { success: false, error: 'SyntaxError: Unexpected token < at line 42' };
      }
      return { success: true, output: 'Tests passed with 100% coverage' };
    },
    fixer: async (hypothesis) => {
      assert.strictEqual(hypothesis.rootCause, 'Syntax / Grammar mismatch');
      simulatedBugFixed = true; // Sửa lỗi
      return { applied: true };
    }
  };

  const selfHealingResult = await pipeline.runSelfHealingLoop(mockExecutionContext, 3);
  assert.strictEqual(selfHealingResult.success, true, 'Self-healing loop must succeed');
  assert.strictEqual(selfHealingResult.attempts, 2, 'Must heal on 2nd attempt');
  assert.strictEqual(selfHealingResult.output, 'Tests passed with 100% coverage');
  process.stdout.write('\x1b[32mPASS\x1b[0m\n');

  // ==========================================
  // 4. CLEAN TEARDOWN
  // ==========================================
  loader.unloadAll();
  assert.strictEqual(loader.loadedPlugins.size, 0, 'All plugins must be cleanly unloaded');
  process.stdout.write('  4. Testing Clean Teardown... \x1b[32mPASS\x1b[0m\n');

  process.stdout.write('\n\x1b[32m[ALL PHASES PASSED] AIaC Roadmap (v3.0 -> v3.1 -> v3.2 -> v3.3) Fully Implemented and Verified!\x1b[0m\n\n');
}

testFullRoadmap().catch(err => {
  process.stderr.write(`\x1b[31mRoadmap Test FAILED:\x1b[0m ${err.stack}\n`);
  process.exit(1);
});
