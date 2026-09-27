#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const catalogPath = path.join(repoRoot, 'config', 'mcp', 'catalog.json');
const serverIndex = process.argv.indexOf('--server');
const projectIndex = process.argv.indexOf('--project');

if (serverIndex < 0 || !process.argv[serverIndex + 1] || process.argv[serverIndex + 1].startsWith('--')) {
  throw new Error('Thiếu tên server sau --server.');
}

const serverName = process.argv[serverIndex + 1];
const projectRoot = projectIndex >= 0
  ? path.resolve(process.argv[projectIndex + 1] || '')
  : process.cwd();
const targetPath = path.join(projectRoot, '.mcp.json');
const dryRun = process.argv.includes('--dry-run');

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Không đọc được JSON '${filePath}': ${error.message}`);
  }
}

const catalog = readJson(catalogPath);
const entry = catalog.servers && catalog.servers[serverName];
if (!entry) throw new Error(`MCP server '${serverName}' chưa có trong catalog AIaC.`);

for (const marker of entry.requiresProjectState || []) {
  if (!fs.existsSync(path.join(projectRoot, marker))) {
    throw new Error(`Chưa bật MCP '${serverName}': project thiếu '${marker}'.`);
  }
}

const current = readJson(targetPath, { mcpServers: {} });
const existingServers = current.mcpServers || {};
if (existingServers[serverName]) {
  console.log(`[AIaC] .mcp.json đã có MCP '${serverName}'; không thay đổi.`);
  process.exit(0);
}

const merged = {
  ...current,
  mcpServers: {
    ...existingServers,
    [serverName]: entry.mcpServer,
  },
};

if (dryRun) {
  console.log(`[AIaC] Dry-run: sẽ thêm MCP '${serverName}' vào ${targetPath}.`);
  process.exit(0);
}

fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`[AIaC] Đã thêm MCP '${serverName}' vào ${targetPath}.`);
