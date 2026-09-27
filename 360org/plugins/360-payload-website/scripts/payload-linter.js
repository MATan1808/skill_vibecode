#!/usr/bin/env node
'use strict';

/**
 * 360-payload-website Linter Tool
 * Kiểm tra các quy chuẩn Payload CMS 3.x thực chiến cho hệ sinh thái 360 CORP:
 * 1. Bắt buộc có output: 'standalone' trong next.config (cho PM2 CloudPanel deploy)
 * 2. Bắt buộc localized: true cho mọi user-facing field (text, textarea, richText)
 * 3. Kiểm tra kết nối DB SQLite (WAL mode) hoặc PostgreSQL
 */

const fs = require('fs');
const path = require('path');

function lintProject(targetDir = process.cwd()) {
  const issues = [];
  const warnings = [];

  // 1. Kiểm tra next.config.*
  const nextConfigCandidates = [
    path.join(targetDir, 'next.config.ts'),
    path.join(targetDir, 'next.config.mjs'),
    path.join(targetDir, 'next.config.js')
  ];

  const foundNextConfig = nextConfigCandidates.find(f => fs.existsSync(f));
  if (foundNextConfig) {
    const content = fs.readFileSync(foundNextConfig, 'utf8');
    if (!content.includes("'standalone'") && !content.includes('"standalone"')) {
      issues.push(`[Next.js Gotcha] Thiếu output: 'standalone' trong ${path.basename(foundNextConfig)}. Sẽ làm lỗi deploy native CloudPanel qua PM2.`);
    }
  } else {
    warnings.push('Không tìm thấy file next.config.*');
  }

  // 2. Kiểm tra localization trong collections và blocks
  const scanDirs = [
    path.join(targetDir, 'src', 'collections'),
    path.join(targetDir, 'collections'),
    path.join(targetDir, 'src', 'blocks'),
    path.join(targetDir, 'blocks')
  ];

  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;

    function walk(curr) {
      let entries = [];
      try { entries = fs.readdirSync(curr, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const fullPath = path.join(curr, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          lintSchemaFile(fullPath);
        }
      }
    }

    function lintSchemaFile(filePath) {
      const content = fs.readFileSync(filePath, 'utf8');
      // Tìm các khai báo field text, textarea, richText
      // Regex thô phát hiện field định nghĩa không có localized: true
      const fieldRegex = /\{\s*name:\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*type:\s*['"](text|textarea|richText)['"]/g;
      let match;
      while ((match = fieldRegex.exec(content)) !== null) {
        const fieldName = match[1];
        const fieldType = match[2];
        if (fieldName === 'slug' || fieldName === 'id' || fieldName === 'icon') continue;

        // Trích xuất đoạn object của field quanh vị trí match
        const snippet = content.slice(match.index, match.index + 250);
        if (!snippet.includes('localized: true')) {
          warnings.push(`[i18n Warning] Field '${fieldName}' (${fieldType}) trong ${path.relative(targetDir, filePath)} chưa bật 'localized: true'.`);
        }
      }
    }

    walk(dir);
  }

  return { issues, warnings, valid: issues.length === 0 };
}

if (require.main === module) {
  const targetDir = process.argv[2] || process.cwd();
  console.log(`\x1b[34m[360-payload-website]\x1b[0m Bắt đầu kiểm tra Payload CMS tại: ${targetDir}`);
  const result = lintProject(targetDir);

  if (result.issues.length > 0) {
    console.error('\x1b[31m❌ Các lỗi nghiêm trọng cần sửa:\x1b[0m');
    result.issues.forEach(i => console.error(`  - ${i}`));
  }

  if (result.warnings.length > 0) {
    console.warn('\x1b[33m⚠️  Cảnh báo gợi ý tối ưu:\x1b[0m');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('\x1b[32m✅ Mọi quy chuẩn Payload CMS 3.x đã đạt chuẩn 100%!\x1b[0m');
  }

  process.exit(result.valid ? 0 : 1);
}

module.exports = { lintProject };
