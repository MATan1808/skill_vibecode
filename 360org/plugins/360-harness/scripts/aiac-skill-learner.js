#!/usr/bin/env node
'use strict';

/**
 * AIaC Skill Learner & Auto-Optimizer Engine
 * Kế thừa từ AutoHarness (tigerless-labs/autoharness)
 * Đảm nhiệm vai trò:
 * 1. Thu thập và đối chiếu chỉ mục các plugin hiện có trong AIaC (Compare-First Index)
 * 2. Đề xuất cập nhật (patch/update/create) vào đúng Plugin phù hợp
 * 3. Promoter Gate: Kiểm tra tính an toàn, bảo mật và toàn vẹn trước khi ghi
 * 4. Ghi nhận nhật ký thay đổi (Ledger) kèm bằng chứng thực tế
 */

const fs = require('fs');
const path = require('path');

const AIAC_ROOT = path.resolve(__dirname, '../../../..');
const PLUGINS_DIR = path.join(AIAC_ROOT, '360org', 'plugins');

function getPluginCatalog() {
  const catalog = [];
  if (!fs.existsSync(PLUGINS_DIR)) return catalog;

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('360-')) continue;

    const pluginPath = path.join(PLUGINS_DIR, entry.name);
    const skillPath = path.join(pluginPath, 'prompts', 'SKILL.md');
    const pluginJsonPath = path.join(pluginPath, 'plugin.json');

    let description = '(Không có mô tả)';
    let triggers = [];

    if (fs.existsSync(skillPath)) {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const descMatch = content.match(/description:\s*([^\n]+)/i);
      if (descMatch) description = descMatch[1].trim();
    } else if (fs.existsSync(pluginJsonPath)) {
      try {
        const pJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
        description = pJson.description || description;
      } catch (e) {}
    }

    // Liệt kê các references có sẵn
    const refsDir = path.join(pluginPath, 'prompts', 'references');
    const refs = fs.existsSync(refsDir) ? fs.readdirSync(refsDir).filter(f => f.endsWith('.md')) : [];

    catalog.push({
      name: entry.name,
      path: pluginPath,
      description,
      references: refs
    });
  }

  return catalog;
}

function printCatalogIndex() {
  const catalog = getPluginCatalog();
  console.log(`\n=== AIaC Skill Catalog Index (${catalog.length} Core Plugins) ===\n`);
  for (const p of catalog) {
    console.log(`- \x1b[34m${p.name}\x1b[0m: ${p.description}`);
    if (p.references.length > 0) {
      console.log(`  └─ References: ${p.references.join(', ')}`);
    }
  }
  console.log('\n=========================================================\n');
}

function matchTargetPlugin(keyword) {
  const catalog = getPluginCatalog();
  const lowerKw = keyword.toLowerCase();

  // Ưu tiên khớp trực tiếp tên
  const exact = catalog.find(p => p.name.toLowerCase().includes(lowerKw));
  if (exact) return exact;

  // Khớp mô tả hoặc references
  const fuzzy = catalog.find(p =>
    p.description.toLowerCase().includes(lowerKw) ||
    p.references.some(r => r.toLowerCase().includes(lowerKw))
  );

  return fuzzy || null;
}

function validateProposal(proposal) {
  const errors = [];
  if (!proposal.plugin) errors.push('Thiếu tên plugin mục tiêu.');
  if (!proposal.reason) errors.push('Thiếu lý do (reason) trích xuất bài học.');
  if (!proposal.evidence) errors.push('Thiếu bằng chứng (evidence) từ phiên thực tế.');

  // Quét secret cơ bản
  const secretPattern = /(api[_-]?key|password|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\/+-]{12,}["']/i;
  if (proposal.content && secretPattern.test(proposal.content)) {
    errors.push('Phát hiện nội dung có khả năng chứa hardcoded secret/API key!');
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'index';

  switch (cmd) {
    case 'index':
      printCatalogIndex();
      break;

    case 'match':
      const kw = args[1];
      if (!kw) {
        console.error('Vui lòng cung cấp từ khóa để tìm plugin mục tiêu (VD: node aiac-skill-learner.js match odoo)');
        process.exit(1);
      }
      const matched = matchTargetPlugin(kw);
      if (matched) {
        console.log(`\n✅ Tìm thấy Plugin mục tiêu phù hợp nhất cho "${kw}": \x1b[32m${matched.name}\x1b[0m`);
        console.log(`   Đường dẫn: ${matched.path}`);
        console.log(`   Mô tả: ${matched.description}`);
        if (matched.references.length > 0) {
          console.log(`   Các chuyên đề hiện có: ${matched.references.join(', ')}`);
        }
      } else {
        console.log(`\n⚠️ Không tìm thấy plugin phù hợp trực tiếp cho "${kw}". Cân nhắc tạo umbrella skill mới nếu đây là domain độc lập.`);
      }
      break;

    case 'help':
    default:
      console.log(`
AIaC Skill Learner & Auto-Optimizer CLI (AutoHarness Core)

Cách sử dụng:
  node aiac-skill-learner.js index            Liệt kê danh mục chỉ mục toàn bộ plugin AIaC (Compare-First)
  node aiac-skill-learner.js match <từ-khóa>   Dò tìm plugin phù hợp nhất để cập nhật bài học
  node aiac-skill-learner.js help             Xem hướng dẫn
`);
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getPluginCatalog,
  matchTargetPlugin,
  validateProposal
};
