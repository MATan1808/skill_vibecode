#!/usr/bin/env node
'use strict';

/**
 * Codegraph tạo bản đồ import cục bộ, nhỏ và xác định được để Claude đọc nhanh.
 * Không dùng dependency ngoài; chỉ biểu diễn liên kết resolve được trong project.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outputPath = path.join(root, '.claude', 'codegraph.md');
const maxEdgesArg = process.argv.indexOf('--max-edges');
const maxFilesArg = process.argv.indexOf('--max-files');
const maxEdges = maxEdgesArg >= 0 ? Number(process.argv[maxEdgesArg + 1]) : 40;
const maxFiles = maxFilesArg >= 0 ? Number(process.argv[maxFilesArg + 1]) : 3_000;
const ignoreDirs = new Set(['.git', '.claude', '.dart_tool', '.idea', 'node_modules', 'dist', 'build', 'coverage', 'ios', 'android', 'web', 'vendor']);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.dart']);

function walk(dir, files = []) {
  if (Number.isInteger(maxFiles) && files.length >= maxFiles) return files;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (Number.isInteger(maxFiles) && files.length >= maxFiles) return files;
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !ignoreDirs.has(entry.name)) walk(filePath, files);
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(filePath);
      if (Number.isInteger(maxFiles) && files.length >= maxFiles) return files;
    }
  }
  return files;
}

function parseImports(filePath, content) {
  const extension = path.extname(filePath).toLowerCase();
  const imports = [];
  let match;

  if (['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'].includes(extension)) {
    const regex = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+|require\s*\()\s*['"]([^'"]+)['"]/g;
    while ((match = regex.exec(content))) imports.push({ kind: 'js', value: match[1] });
  } else if (extension === '.py') {
    const fromRegex = /^\s*from\s+([.\w]+)\s+import\s+/gm;
    const importRegex = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
    while ((match = fromRegex.exec(content))) imports.push({ kind: 'py', value: match[1] });
    while ((match = importRegex.exec(content))) {
      for (const value of match[1].split(',')) imports.push({ kind: 'py', value: value.trim().split(/\s+as\s+/)[0] });
    }
  } else if (extension === '.dart') {
    const regex = /^\s*(?:import|export|part)\s+['"]([^'"]+)['"]/gm;
    while ((match = regex.exec(content))) imports.push({ kind: 'dart', value: match[1] });
  }
  return imports;
}

function pathKey(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function fileCandidates(absolutePath) {
  const candidates = [absolutePath];
  if (!path.extname(absolutePath)) {
    for (const extension of sourceExtensions) candidates.push(`${absolutePath}${extension}`);
    for (const extension of sourceExtensions) candidates.push(path.join(absolutePath, `index${extension}`));
  }
  return candidates;
}

function readDartPackageName() {
  try {
    const match = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8').match(/^name:\s*([^\s#]+)/m);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function buildIndexes(files) {
  const fileSet = new Set(files.map(filePath => path.resolve(filePath)));
  const pythonModules = new Map();
  for (const filePath of files.filter(file => path.extname(file) === '.py')) {
    const rel = pathKey(filePath).replace(/\.py$/, '');
    const moduleName = rel.endsWith('/__init__') ? rel.slice(0, -'/__init__'.length).replace(/\//g, '.') : rel.replace(/\//g, '.');
    if (moduleName) pythonModules.set(moduleName, filePath);
  }
  return { fileSet, pythonModules, dartPackage: readDartPackageName() };
}

function resolveJs(filePath, value, fileSet) {
  if (!value.startsWith('.')) return null;
  return fileCandidates(path.resolve(path.dirname(filePath), value)).find(candidate => fileSet.has(candidate)) || null;
}

function resolvePython(filePath, value, pythonModules) {
  if (!value) return null;
  if (value.startsWith('.')) {
    const dots = value.match(/^\.+/)[0].length;
    const suffix = value.slice(dots);
    let directory = path.dirname(filePath);
    for (let index = 1; index < dots; index += 1) directory = path.dirname(directory);
    const target = suffix ? path.resolve(directory, suffix.replace(/\./g, path.sep)) : directory;
    return fileCandidates(target).find(candidate => fs.existsSync(candidate)) || null;
  }
  return pythonModules.get(value) || pythonModules.get(`${value}.__init__`) || null;
}

function resolveDart(filePath, value, indexes) {
  if (value.startsWith('.')) {
    return fileCandidates(path.resolve(path.dirname(filePath), value)).find(candidate => indexes.fileSet.has(candidate)) || null;
  }
  const prefix = `package:${indexes.dartPackage}/`;
  if (!indexes.dartPackage || !value.startsWith(prefix)) return null;
  return fileCandidates(path.join(root, 'lib', value.slice(prefix.length))).find(candidate => indexes.fileSet.has(candidate)) || null;
}

function resolveImport(filePath, imported, indexes) {
  if (imported.kind === 'js') return resolveJs(filePath, imported.value, indexes.fileSet);
  if (imported.kind === 'py') return resolvePython(filePath, imported.value, indexes.pythonModules);
  return resolveDart(filePath, imported.value, indexes);
}

function mermaidId(filePath) {
  return `n_${Buffer.from(filePath).toString('hex')}`;
}

function generateGraph() {
  const files = walk(root).sort((left, right) => pathKey(left).localeCompare(pathKey(right)));
  const indexes = buildIndexes(files);
  const edges = new Map();

  for (const filePath of files) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    for (const imported of parseImports(filePath, content)) {
      const target = resolveImport(filePath, imported, indexes);
      if (!target || !indexes.fileSet.has(target)) continue;
      const from = pathKey(filePath);
      const to = pathKey(target);
      if (from !== to) edges.set(`${from}\u0000${to}`, { from, to });
    }
  }

  const sortedEdges = [...edges.values()].sort((left, right) => `${left.from}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.to}`));
  const limit = Number.isInteger(maxEdges) && maxEdges > 0 ? maxEdges : 40;
  const visibleEdges = sortedEdges.slice(0, limit);
  const lines = [
    '### Codegraph cục bộ',
    '',
    `- Nguồn: ${files.length} tệp mã; ${sortedEdges.length} liên kết import cục bộ.`,
    `- Hiển thị: ${visibleEdges.length}/${sortedEdges.length} liên kết theo thứ tự ổn định.`,
    '- Phạm vi: chỉ import resolve được trong project; package ngoài không được đưa vào context.',
    '',
    '```mermaid',
    'graph TD',
  ];

  for (const edge of visibleEdges) {
    lines.push(`  ${mermaidId(edge.from)}["${edge.from}"] --> ${mermaidId(edge.to)}["${edge.to}"]`);
  }
  if (sortedEdges.length > visibleEdges.length) lines.push(`  more["… ${sortedEdges.length - visibleEdges.length} liên kết đã lược bỏ"]`);
  lines.push('```', '');
  return lines.join('\n');
}

const graph = generateGraph();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, graph, 'utf8');
process.stderr.write(`[Codegraph] ${outputPath}\n`);
