'use strict';

/**
 * AIaC Core Self-Test Suite
 * Kiểm tra EventBus (emit, parallel, serial, waterfall around-middleware),
 * SeamRegistry (provide, get, dispose),
 * PluginLoader (manifest parsing, effect lifecycle, automatic cleanup).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { EventBus } = require('./event-bus');
const { SeamRegistry } = require('./capability-seams');
const { PluginLoader } = require('./plugin-loader');

async function testEventBus() {
  process.stdout.write('Testing EventBus... ');
  const bus = new EventBus();

  // Test 1: emit & disposer
  let emitCount = 0;
  const offEmit = bus.on('test/emit', (val) => { emitCount += val; });
  bus.emit('test/emit', 5);
  assert.strictEqual(emitCount, 5, 'Emit must invoke listener');
  offEmit();
  bus.emit('test/emit', 5);
  assert.strictEqual(emitCount, 5, 'Disposed listener must not be called');

  // Test 2: waterfall around-middleware
  bus.on('test/pipeline', async (payload, next) => {
    payload.steps.push('stage1');
    const result = await next(payload);
    result.steps.push('stage1:after');
    return result;
  });

  bus.on('test/pipeline', async (payload, next) => {
    payload.steps.push('stage2');
    return next(payload);
  });

  const initial = { steps: ['init'] };
  const res = await bus.waterfall('test/pipeline', initial);
  assert.deepStrictEqual(res.steps, ['init', 'stage1', 'stage2', 'stage1:after'], 'Waterfall must maintain around-middleware order');

  // Test 3: serial & parallel
  const calls = [];
  bus.on('test/parallel', async () => { calls.push(1); });
  bus.on('test/parallel', async () => { calls.push(2); });
  await bus.parallel('test/parallel');
  assert.strictEqual(calls.length, 2, 'Parallel must run all listeners');

  process.stdout.write('\x1b[32mPASSED\x1b[0m\n');
}

async function testSeamRegistry() {
  process.stdout.write('Testing SeamRegistry... ');
  const seams = new SeamRegistry();

  const mockProvider = { run: () => 'ok' };
  const offProvider = seams.registerProvider('linter', 'wpcs', mockProvider);

  assert.strictEqual(seams.getProvider('linter'), mockProvider, 'Must retrieve default provider');
  assert.strictEqual(seams.getProvider('linter', 'wpcs'), mockProvider, 'Must retrieve provider by name');

  offProvider();
  assert.strictEqual(seams.getProvider('linter'), null, 'Disposed provider must be removed');

  process.stdout.write('\x1b[32mPASSED\x1b[0m\n');
}

async function testPluginLoader() {
  process.stdout.write('Testing PluginLoader... ');
  const tempDir = path.join(__dirname, '__temp_test_plugins__');
  const tempPluginDir = path.join(tempDir, 'sample-plugin');
  fs.mkdirSync(tempPluginDir, { recursive: true });

  fs.writeFileSync(path.join(tempPluginDir, 'plugin.json'), JSON.stringify({
    name: 'sample-plugin',
    version: '1.0.0',
    description: 'Test plugin',
    main: 'index.js'
  }));

  let pluginRan = false;
  let cleanedUp = false;
  fs.writeFileSync(path.join(tempPluginDir, 'index.js'), `
    module.exports = (ctx) => {
      ctx.effect(() => {
        return () => {
          global.__testCleanedUp = true;
        };
      });
      ctx.on('sample/event', () => {
        global.__testPluginRan = true;
      });
    };
  `);

  global.__testPluginRan = false;
  global.__testCleanedUp = false;

  const loader = new PluginLoader({ pluginsDir: tempDir });
  const record = loader.loadPlugin('sample-plugin');
  assert.ok(record, 'Plugin record must be returned');

  loader.events.emit('sample/event');
  assert.strictEqual(global.__testPluginRan, true, 'Plugin event must fire');

  loader.unloadPlugin('sample-plugin');
  assert.strictEqual(global.__testCleanedUp, true, 'Plugin effect must cleanup on unload');

  // Dọn dẹp temp
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.stdout.write('\x1b[32mPASSED\x1b[0m\n');
}

async function runAllTests() {
  try {
    await testEventBus();
    await testSeamRegistry();
    await testPluginLoader();
    process.stdout.write('\x1b[32mAll AIaC Core Self-Checks Passed Successfully!\x1b[0m\n');
  } catch (err) {
    process.stderr.write(`\x1b[31mSelf-Check FAILED:\x1b[0m ${err.stack}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
