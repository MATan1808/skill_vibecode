#!/usr/bin/env node
'use strict';

/**
 * AIaC Version Sync — đồng bộ 100% version anchors theo package.json.
 * Chạy trước mỗi release: node scripts/aiac/sync-version.js
 * ponytail: replace theo regex neo cứng từng file thay vì parse AST/Markdown;
 * nếu format heading đổi thì cập nhật bảng RULES bên dưới.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
const semver = '[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?';

// [file, regex, replacement] — replacement dùng ${v} cho version hiện tại.
const RULES = [
  ['VERSION', /^.*$/m, '${v}'],
  ['AGENTS.md', new RegExp(`^\\*\\*Version:\\*\\* ${semver}`, 'm'), '**Version:** ${v}'],
  ['docs/tr/AGENTS.md', new RegExp(`^\\*\\*Sürüm:\\*\\* ${semver}`, 'm'), '**Sürüm:** ${v}'],
  ['docs/zh-CN/AGENTS.md', new RegExp(`^\\*\\*版本:\\*\\* ${semver}`, 'm'), '**版本:** ${v}'],
  ['agent.yaml', new RegExp(`^version: ${semver}`, 'm'), 'version: ${v}'],
  ['.claude-plugin/plugin.json', new RegExp(`"version": "${semver}"`), '"version": "${v}"'],
  ['.claude-plugin/marketplace.json', new RegExp(`"version": "${semver}"`), '"version": "${v}"'],
  ['.codex-plugin/plugin.json', new RegExp(`"version": "${semver}"`), '"version": "${v}"'],
  ['.agents/plugins/marketplace.json', new RegExp(`"version": "${semver}"`), '"version": "${v}"'],
  ['plugins/ecc/.codex-plugin/plugin.json', new RegExp(`"version": "${semver}"`), '"version": "${v}"'],
  ['.opencode/package.json', new RegExp(`"version": "${semver}"`), '"version": "${v}"'],
  ['.opencode/plugins/ecc-hooks.ts', new RegExp(`## Active Plugin: ECC v${semver}`), '## Active Plugin: ECC v${v}'],
  ['docs/SELECTIVE-INSTALL-ARCHITECTURE.md', new RegExp(`"repoVersion": "${semver}"`), '"repoVersion": "${v}"'],
  ['docs/zh-CN/README.md', new RegExp(`\\| \\*\\*版本\\*\\* \\| 插件 \\| 插件 \\| 参考配置 \\| ${semver} \\|`), '| **版本** | 插件 | 插件 | 参考配置 | ${v} |'],
];

// READMEs đa ngữ: chèn heading release hiện tại trỏ về docs/CHANGELOGS.md nếu chưa có.
const RELEASE_DOCS = [
  ['docs/pt-BR/README.md', 'Consulte docs/CHANGELOGS.md para o changelog completo.'],
  ['docs/tr/README.md', 'Tam değişiklik listesi için docs/CHANGELOGS.md dosyasına bakın.'],
  ['README.zh-CN.md', '完整变更日志见 docs/CHANGELOGS.md。'],
  ['docs/zh-CN/README.md', '完整变更日志见 docs/CHANGELOGS.md。'],
];

const changed = [];

function patch(relPath, mutate) {
  const filePath = path.join(repoRoot, relPath);
  if (!fs.existsSync(filePath)) return;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after);
    changed.push(relPath);
  }
}

for (const [relPath, pattern, replacement] of RULES) {
  patch(relPath, src => src.replace(pattern, replacement.replace('${v}', version)));
}

// Lock files: chỉ 2 field version của chính package gốc, không đụng deps.
for (const lockPath of ['package-lock.json', '.opencode/package-lock.json']) {
  patch(lockPath, src => {
    const lock = JSON.parse(src);
    lock.version = version;
    if (lock.packages && lock.packages['']) lock.packages[''].version = version;
    return `${JSON.stringify(lock, null, 2)}\n`;
  });
}

for (const [relPath, note] of RELEASE_DOCS) {
  patch(relPath, src => {
    if (src.includes(`### v${version} `)) return src;
    const firstHeading = src.search(/^### v[0-9]/m);
    if (firstHeading < 0) return src;
    const date = new Date().toISOString().slice(0, 10);
    const block = `### v${version} — AIaC Release (${date})\n\n${note}\n\n`;
    return src.slice(0, firstHeading) + block + src.slice(firstHeading);
  });
}

// Bảng Tóm Tắt Phiên Bản (Version Matrix) trong docs/CHANGELOGS.md:
// Tự động trích xuất tiêu đề release hiện tại và chèn dòng mới vào bảng nếu chưa có
patch('docs/CHANGELOGS.md', src => {
  const versionRowPattern = new RegExp(`\\|\\s*\\*\\*\`v${version.replace(/\\./g, '\\.')}\`\\*\\*\\s*\\|`);
  if (versionRowPattern.test(src)) return src;

  // Trích xuất ngày tháng và tiêu đề từ heading ## [version] - YYYY-MM-DD — TITLE
  const headingRegex = new RegExp(`^##\\s*\\[${version.replace(/\\./g, '\\.')}\\]\\s*-\\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\\s*—\\s*(.+)$`, 'm');
  const match = src.match(headingRegex);

  let date = new Date().toISOString().slice(0, 10);
  let title = `AIaC Platform Release v${version}`;

  if (match) {
    date = match[1].trim();
    title = match[2].trim();
  }

  // Tìm vị trí bảng Version Matrix: sau dòng divider "|:---:|:---:|:---:|---|"
  const matrixHeaderDivider = '|:---:|:---:|:---:|---|';
  const dividerIdx = src.indexOf(matrixHeaderDivider);
  if (dividerIdx < 0) return src;

  const insertPos = dividerIdx + matrixHeaderDivider.length;
  const newRow = `\n| **\`v${version}\`** |  **Stable** | ${date} | **${title}** |`;

  return src.slice(0, insertPos) + newRow + src.slice(insertPos);
});

console.log(`[AIaC Version Sync] v${version} — ${changed.length} file(s) updated`);
for (const item of changed) console.log(`  • ${item}`);
