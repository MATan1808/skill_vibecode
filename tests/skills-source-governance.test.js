'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'config', 'skills-source-manifest.json');
const updaterRoot = path.join(repoRoot, '360org', 'plugins', '360-update-skill-resource');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const updaterFiles = [
  path.join(updaterRoot, 'index.js'),
  path.join(updaterRoot, 'plugin.json'),
  path.join(updaterRoot, 'README.md'),
  path.join(updaterRoot, 'prompts', 'SKILL.md'),
  path.join(updaterRoot, 'prompts', 'updater-standards.md'),
];

assert.strictEqual(manifest.schemaVersion, 2);
assert.strictEqual(manifest.policy.integrationMode, 'manual-selective');
assert.strictEqual(manifest.policy.runtimeExternalDependency, false);
assert.strictEqual(manifest.policy.automaticCopy, false);
assert.strictEqual(manifest.policy.automaticInstall, false);
assert.strictEqual(manifest.policy.automaticCommitOrPush, false);
assert.ok(Array.isArray(manifest.trackedSources) && manifest.trackedSources.length > 0);

const forbidden = ['/Volumes/DATA/DEV/SKILLS/', '/Volumes/DATA/DEV/SKILL_SOURCES/'];
for (const source of manifest.trackedSources) {
  assert.ok(source.name);
  assert.ok(source.repository);
  assert.ok(source.reviewedCommit);
  assert.ok(source.target);
  assert.ok(source.decision);
  for (const prefix of forbidden) {
    assert.ok(!JSON.stringify(source).includes(prefix), `${source.name} contains runtime source path ${prefix}`);
  }
}

for (const filePath of updaterFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  assert.ok(!source.includes('source_dir'), `${filePath} configures a machine-local source directory`);
  assert.ok(!source.includes('resource-sync'), `${filePath} still exposes automatic resource sync`);
  assert.ok(!source.includes('update-skills-source.sh'), `${filePath} still exposes the retired sync script`);
}

const plugin = JSON.parse(fs.readFileSync(path.join(updaterRoot, 'plugin.json'), 'utf8'));
assert.deepStrictEqual(plugin.connectors, []);

console.log('skills-source-governance: ok');
