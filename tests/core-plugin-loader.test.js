'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PluginLoader } = require('../360org/core/plugin-loader');

console.log('=== Testing PluginLoader (Lifecycle & Cycles) ===');
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
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-loader-test-'));
  const pluginsDir = path.join(sandbox, 'plugins');
  fs.mkdirSync(pluginsDir);

  const loader = new PluginLoader({ pluginsDir });

  function createPlugin(name, manifest, scriptContent) {
    const dir = path.join(pluginsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest));
    if (scriptContent) {
      fs.writeFileSync(path.join(dir, 'index.js'), scriptContent);
    }
  }

  try {
    await test('Load function export', async () => {
      createPlugin('fn-plugin', { name: 'fn', main: 'index.js' }, `
        module.exports = function(ctx) {
          ctx.fnCalled = true;
          return () => { ctx.fnDisposed = true; };
        };
      `);
      const p = loader.loadPlugin('fn-plugin');
      assert.ok(p.context.fnCalled);
      loader.unloadPlugin('fn-plugin');
      assert.ok(p.context.fnDisposed);
    });

    await test('Load object with apply', async () => {
      createPlugin('apply-plugin', { name: 'app' }, `
        module.exports = {
          apply: function(ctx) { ctx.applyCalled = true; return () => { ctx.applyDisposed = true; }; }
        };
      `);
      const p = loader.loadPlugin('apply-plugin');
      assert.ok(p.context.applyCalled);
      loader.unloadPlugin('apply-plugin');
      assert.ok(p.context.applyDisposed);
    });

    await test('Load object with activate', async () => {
      createPlugin('act-plugin', { name: 'act' }, `
        module.exports = {
          activate: function(ctx) { ctx.actCalled = true; return () => { ctx.actDisposed = true; }; }
        };
      `);
      const p = loader.loadPlugin('act-plugin');
      assert.ok(p.context.actCalled);
      loader.unloadPlugin('act-plugin');
      assert.ok(p.context.actDisposed);
    });

    await test('Fails on invalid entry export', async () => {
      createPlugin('bad-export', { name: 'bad' }, `module.exports = "hello";`);
      const oldStderr = process.stderr.write;
      let output = '';
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('bad-export');
        assert.strictEqual(p, null);
        assert.ok(output.includes('phải export function'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Fails on async entry', async () => {
      createPlugin('async-export', { name: 'async' }, `module.exports = async function() { return () => {}; };`);
      const oldStderr = process.stderr.write;
      let output = '';
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('async-export');
        assert.strictEqual(p, null);
        assert.ok(output.includes('bất đồng bộ chưa được hỗ trợ'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Dependency resolution and cycle detection', async () => {
      createPlugin('a', { dependencies: ['b'] });
      createPlugin('b', { dependencies: ['c'] });
      createPlugin('c', { dependencies: ['a'] });

      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('a');
        assert.strictEqual(p, null);
        assert.ok(output.includes('Cycle dependency detected: a -> b -> c -> a'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Dependency load failure halts parent', async () => {
      createPlugin('parent', { dependencies: ['missing'] });
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('parent');
        assert.strictEqual(p, null);
        assert.ok(output.includes('Không thể load dependency "missing" cho "parent"'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Effect throws properly', async () => {
      createPlugin('fail-effect', { name: 'fe' }, `
        module.exports = function(ctx) {
          ctx.effect(() => { throw new Error('boom'); });
        };
      `);
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('fail-effect');
        assert.strictEqual(p, null);
        assert.ok(output.includes('boom'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Cleanup occurs on entry failure', async () => {
      createPlugin('cleanup-fail', { name: 'cf' }, `
        module.exports = function(ctx) {
          ctx.effect(() => { ctx.clean = true; });
          throw new Error('mid-entry boom');
        };
      `);
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('cleanup-fail');
        assert.strictEqual(p, null);
        assert.ok(output.includes('mid-entry boom'));
        assert.ok(loader.loadedPlugins.get('cleanup-fail') === undefined);
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Missing explicit main halts load', async () => {
      createPlugin('missing-main', { name: 'mm', main: 'missing.js' });
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('missing-main');
        assert.strictEqual(p, null);
        assert.ok(output.includes('không tồn tại'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Missing main property does not halt if index.js exists', async () => {
      createPlugin('implicit-main', { name: 'im' }, 'module.exports = () => {}');
      const p = loader.loadPlugin('implicit-main');
      assert.ok(p);
      loader.unloadPlugin('implicit-main');
    });

    await test('Cycle triggers when dependencies not an array', async () => {
      createPlugin('bad-deps', { dependencies: 'string' });
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('bad-deps');
        assert.strictEqual(p, null);
        assert.ok(output.includes('không hợp lệ'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Invalid dependency types are rejected', async () => {
      createPlugin('bad-deps-arr', { dependencies: [123] });
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('bad-deps-arr');
        assert.strictEqual(p, null);
        assert.ok(output.includes('không hợp lệ'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });

    await test('Path traversal in plugin name is blocked', async () => {
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('../other');
        assert.strictEqual(p, null);
        assert.ok(output.includes('Tên plugin không hợp lệ'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });



    await test('Entry file traversal is blocked', async () => {
      createPlugin('traversal', { name: 'traversal', main: '../outside.js' });
      let output = '';
      const oldStderr = process.stderr.write;
      process.stderr.write = d => { output += d; return true; };
      try {
        const p = loader.loadPlugin('traversal');
        assert.strictEqual(p, null);
        assert.ok(output.includes('nằm ngoài plugin'));
      } finally {
        process.stderr.write = oldStderr;
      }
    });
    await test('Watcher survives failed reload', async () => {
      createPlugin('watch-plugin', { name: 'watch-plugin' }, 'module.exports = () => {}');
      let output = '';
      const oldStderr = process.stderr.write;
      try {
        assert.ok(loader.loadPlugin('watch-plugin'));
        loader.enableHotReload('watch-plugin');
        assert.ok(loader._watchers.has('watch-plugin'));

        fs.writeFileSync(path.join(pluginsDir, 'watch-plugin', 'index.js'), 'module.exports = "invalid";');
        process.stderr.write = d => { output += d; return true; };
        assert.strictEqual(loader.reloadPlugin('watch-plugin'), null);
        assert.strictEqual(loader.loadedPlugins.get('watch-plugin'), undefined);
        assert.ok(loader._watchers.has('watch-plugin'));

        fs.writeFileSync(path.join(pluginsDir, 'watch-plugin', 'index.js'), 'module.exports = () => {}');
        assert.ok(loader.reloadPlugin('watch-plugin'));
        assert.ok(loader._watchers.has('watch-plugin'));
      } finally {
        process.stderr.write = oldStderr;
        loader.unloadPlugin('watch-plugin');
      }
    });

    console.log(`\nPassed: ${passed}`);
    if (failed > 0) {
      console.log(`Failed: ${failed}`);
    }
  } finally {
    loader.unloadAll();
    fs.rmSync(sandbox, { recursive: true, force: true });
    if (failed > 0) process.exitCode = 1;
  }
})();

