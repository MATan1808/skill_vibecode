#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-codegraph-'));
const script = path.resolve(__dirname, '..', '360org', 'scripts', 'common', 'codegraph.js');

function write(relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

write('src/main.ts', "import { helper } from './helper';\nexport { helper };\n");
write('src/helper.ts', 'export const helper = 1;\n');
write('addons/demo/__init__.py', 'from . import models\n');
write('addons/demo/models.py', 'from addons.demo import utils\n');
write('addons/demo/utils.py', 'VALUE = 1\n');
write('pubspec.yaml', 'name: sample_app\n');
write('lib/main.dart', "import 'package:sample_app/feature.dart';\n");
write('lib/feature.dart', 'void run() {}\n');

const result = spawnSync(process.execPath, [script, '--max-edges', '20'], { cwd: root, encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr);
const graph = fs.readFileSync(path.join(root, '.claude', 'codegraph.md'), 'utf8');
assert.match(graph, /lib\/main\.dart/);
assert.match(graph, /lib\/feature\.dart/);
assert.doesNotMatch(graph, /node_modules/);
assert.match(graph, /Phạm vi: chỉ import resolve được trong project/);

fs.rmSync(root, { recursive: true, force: true });
console.log('codegraph self-check passed');
