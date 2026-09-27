#!/usr/bin/env node
'use strict';

/**
 * Test suite cho 360-payload-website plugin
 * Tối thiểu 10 test cases độc lập theo quy chuẩn AIaC
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const pluginDir = path.join(repoRoot, '360org', 'plugins', '360-payload-website');
const routerPath = path.join(repoRoot, '360org', 'scripts', 'hooks', '360-smart-router.js');
const linterPath = path.join(pluginDir, 'scripts', 'payload-linter.js');
const scaffoldPath = path.join(pluginDir, 'scripts', 'payload-scaffold.js');
const hookPath = path.join(pluginDir, 'hooks', 'post-write-payload-check.js');

let passedCases = 0;

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runNode(script, options = {}) {
  const result = spawnSync(process.execPath, [script, ...(options.args || [])], {
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    input: options.input || '',
  });
  return result;
}

// Case 1: Plugin Manifest Validation
(function testPluginManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
  assert.strictEqual(manifest.name, '360-payload-website');
  assert.ok(manifest.connectors.some(c => c.name === 'payload-scaffold'));
  assert.ok(manifest.connectors.some(c => c.name === 'payload-linter'));
  assert.ok(manifest.hooks.PostToolUse.length > 0);
  passedCases++;
})();

// Case 2: Plugin Index Capability Seams
(function testPluginIndexSeams() {
  const pluginIndex = require(path.join(pluginDir, 'index.js'));
  const providedSeams = {};
  const mockCtx = {
    provide: (domain, name, impl) => {
      providedSeams[`${domain}:${name}`] = impl;
    },
    on: () => {}
  };
  pluginIndex(mockCtx);
  assert.ok(providedSeams['cms:payload'], 'Seam cms:payload missing');
  assert.strictEqual(providedSeams['cms:payload'].framework, 'next.js');
  assert.ok(providedSeams['payload:engine'], 'Seam payload:engine missing');
  assert.strictEqual(providedSeams['payload:engine'].editor, 'lexical');
  passedCases++;
})();

// Case 3: Payload Linter Pass on Valid Project
(function testLinterValidProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-lint-valid-'));
  fs.writeFileSync(path.join(tmpDir, 'next.config.ts'), 'export default { output: "standalone" };\n');
  const collectionsDir = path.join(tmpDir, 'src', 'collections');
  fs.mkdirSync(collectionsDir, { recursive: true });
  fs.writeFileSync(path.join(collectionsDir, 'Posts.ts'), `
    export const Posts = {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text', localized: true }
      ]
    };
  `);

  const { lintProject } = require(linterPath);
  const result = lintProject(tmpDir);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.issues.length, 0);
  assert.strictEqual(result.warnings.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  passedCases++;
})();

// Case 4: Payload Linter Fails when Missing Standalone in next.config
(function testLinterFailsMissingStandalone() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-lint-no-standalone-'));
  fs.writeFileSync(path.join(tmpDir, 'next.config.mjs'), 'export default { reactStrictMode: true };\n');

  const { lintProject } = require(linterPath);
  const result = lintProject(tmpDir);
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.some(i => i.includes("Thiếu output: 'standalone'")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
  passedCases++;
})();

// Case 5: Payload Linter Warns on Unlocalized Field
(function testLinterWarnsUnlocalizedField() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-lint-unlocalized-'));
  fs.writeFileSync(path.join(tmpDir, 'next.config.js'), 'module.exports = { output: "standalone" };\n');
  const collectionsDir = path.join(tmpDir, 'collections');
  fs.mkdirSync(collectionsDir, { recursive: true });
  fs.writeFileSync(path.join(collectionsDir, 'Categories.ts'), `
    export const Categories = {
      slug: 'categories',
      fields: [
        { name: 'description', type: 'textarea' }
      ]
    };
  `);

  const { lintProject } = require(linterPath);
  const result = lintProject(tmpDir);
  assert.strictEqual(result.valid, true);
  assert.ok(result.warnings.some(w => w.includes("Field 'description' (textarea)") && w.includes("chưa bật 'localized: true'")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
  passedCases++;
})();

// Case 6: Payload Scaffold Collection
(function testScaffoldCollection() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-scaffold-col-'));
  const res = runNode(scaffoldPath, { args: ['collection', 'Services', tmpDir] });
  assert.strictEqual(res.status, 0);
  const targetFile = path.join(tmpDir, 'Services.ts');
  assert.ok(fs.existsSync(targetFile));
  const content = fs.readFileSync(targetFile, 'utf8');
  assert.match(content, /slug:\s*'services'/);
  assert.match(content, /localized:\s*true/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  passedCases++;
})();

// Case 7: Payload Scaffold Block
(function testScaffoldBlock() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-scaffold-blk-'));
  const res = runNode(scaffoldPath, { args: ['block', 'FeatureHero', tmpDir] });
  assert.strictEqual(res.status, 0);
  const configFile = path.join(tmpDir, 'FeatureHero', 'config.ts');
  const compFile = path.join(tmpDir, 'FeatureHero', 'Component.tsx');
  assert.ok(fs.existsSync(configFile), 'Block config.ts missing');
  assert.ok(fs.existsSync(compFile), 'Block Component.tsx missing');
  const compContent = fs.readFileSync(compFile, 'utf8');
  assert.match(compContent, /FeatureHeroBlock/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  passedCases++;
})();

// Case 8: Post Write Hook Detects Missing Standalone
(function testPostWriteHook() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-hook-'));
  const targetNextConfig = path.join(tmpDir, 'next.config.ts');
  fs.writeFileSync(targetNextConfig, 'export default {};\n');

  const inputPayload = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: targetNextConfig }
  });

  const res = runNode(hookPath, { input: inputPayload });
  assert.strictEqual(res.status, 0);
  const output = JSON.parse(res.stdout);
  assert.ok(output.hookSpecificOutput?.additionalContext?.includes("output: 'standalone'"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
  passedCases++;
})();

// Case 9: Router Detects Payload Config Project
(function testRouterDetectsPayloadConfig() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-payload-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-payload-site-'));
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  write(path.join(project, 'payload.config.ts'), 'export default buildConfig({});\n');

  const res = runNode(routerPath, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  assert.strictEqual(res.status, 0);
  const payload = JSON.parse(res.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  assert.match(context, /Workspace: PAYLOAD/);
  assert.match(context, /360-payload-website/);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
  passedCases++;
})();

// Case 10: Router Detects Payload Dependency in package.json
(function testRouterDetectsPayloadPackageJson() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-pkg-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-pkg-site-'));
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  write(path.join(project, 'package.json'), JSON.stringify({
    name: 'vuaai-site',
    dependencies: {
      'payload': '^3.85.0',
      'next': '^16.0.0'
    }
  }));

  const res = runNode(routerPath, { cwd: project, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  assert.strictEqual(res.status, 0);
  const payload = JSON.parse(res.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  assert.match(context, /Workspace: PAYLOAD/);
  assert.match(context, /360-payload-website/);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
  passedCases++;
})();

// Case 11: Router Detects Payload Directory Path
(function testRouterDetectsPayloadDirectoryPath() {
  const claudeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-router-dir-'));
  const payloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-project-'));
  write(path.join(claudeRoot, '360org', 'aiac-runtime.json'), JSON.stringify({ repoRoot }));
  write(path.join(payloadDir, 'README.md'), '# Payload Website\n');

  const res = runNode(routerPath, { cwd: payloadDir, env: { CLAUDE_PLUGIN_ROOT: claudeRoot, AIAC_SKIP_CODEGRAPH: '1' } });
  assert.strictEqual(res.status, 0);
  const payload = JSON.parse(res.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  assert.match(context, /Workspace: PAYLOAD/);
  assert.match(context, /360-payload-website/);

  fs.rmSync(claudeRoot, { recursive: true, force: true });
  fs.rmSync(payloadDir, { recursive: true, force: true });
  passedCases++;
})();

// Case 12: Templates Existence and Completeness
(function testTemplatesComplete() {
  const tplDir = path.join(pluginDir, 'templates');
  const requiredFiles = [
    'docker-compose.yml',
    'ecosystem.config.cjs',
    'gitlab-ci.yml',
    'collection.template.ts',
    'block.template.ts'
  ];
  for (const file of requiredFiles) {
    const full = path.join(tplDir, file);
    assert.ok(fs.existsSync(full), `Template ${file} missing`);
    const content = fs.readFileSync(full, 'utf8');
    assert.ok(content.length > 50, `Template ${file} too small`);
  }
  passedCases++;
})();

console.log(`\x1b[32m✅ TẤT CẢ ${passedCases}/12 TEST CASES ĐÃ ĐẠT 100% THÀNH CÔNG!\x1b[0m`);
