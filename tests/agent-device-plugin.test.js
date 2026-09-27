'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PluginLoader } = require('../360org/core/plugin-loader');

console.log('=== Testing AIaC 360-Agent-Device Plugin ===');

const pluginDir = path.resolve(__dirname, '../360org/plugins/360-agent-device');
const manifestPath = path.join(pluginDir, 'plugin.json');

// 1. Manifest
assert.ok(fs.existsSync(manifestPath), 'plugin.json phải tồn tại');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.name, '360-agent-device');
assert.ok(manifest.inject.includes('agent-device'));
assert.ok(manifest.inject.includes('ios-simulator'));
assert.ok(manifest.inject.includes('android-emulator'));
console.log('  ✓ plugin.json hợp lệ và đầy đủ các tags inject');

// 2. Prompts & References
const skillPath = path.join(pluginDir, 'prompts', 'SKILL.md');
assert.ok(fs.existsSync(skillPath), 'SKILL.md phải tồn tại');
const skillContent = fs.readFileSync(skillPath, 'utf8');
assert.ok(skillContent.includes('360-agent-device'));
assert.ok(skillContent.includes('agent-device'));
assert.ok(skillContent.includes('snapshot -i'));

const references = [
  'verification-loop.md',
  'ios-simulator-guide.md',
  'android-emulator-guide.md',
  'macos-desktop-guide.md',
  'maestro-and-scripting.md'
];
for (const ref of references) {
  const refPath = path.join(pluginDir, 'prompts', 'references', ref);
  assert.ok(fs.existsSync(refPath), `Reference ${ref} phải tồn tại`);
}
console.log('  ✓ Đầy đủ 5 tài liệu tham chiếu chuyên sâu (references)');

// 3. Scripts
const runScript = path.join(pluginDir, 'scripts', 'agent-device-run.sh');
const docScript = path.join(pluginDir, 'scripts', 'device-doctor.sh');
assert.ok(fs.existsSync(runScript), 'agent-device-run.sh phải tồn tại');
assert.ok(fs.existsSync(docScript), 'device-doctor.sh phải tồn tại');
console.log('  ✓ Đầy đủ các scripts tiện ích thực thi');

// 4. Seam Provider
const loader = new PluginLoader({ pluginsDir: path.resolve(__dirname, '../360org/plugins') });
const plugin = loader.loadPlugin('360-agent-device');
assert.ok(plugin, 'PluginLoader phải load được 360-agent-device');
assert.strictEqual(plugin.name, '360-agent-device');
console.log('  ✓ PluginLoader nạp và đăng ký seam provider thành công');

console.log('\nAll 360-agent-device tests passed successfully!');
