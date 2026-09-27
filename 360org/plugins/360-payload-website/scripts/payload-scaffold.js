#!/usr/bin/env node
'use strict';

/**
 * 360-payload-website Scaffold Tool
 * Scaffold nhanh Collection hoặc Block cho Payload CMS 3.x theo chuẩn 360 CORP.
 * Usage:
 *   node payload-scaffold.js collection <Name> [outDir]
 *   node payload-scaffold.js block <Name> [outDir]
 */

const fs = require('fs');
const path = require('path');

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toCamelCase(str) {
  return str.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function scaffold(type, rawName, targetDir) {
  if (!type || !rawName) {
    console.error('Usage: node payload-scaffold.js <collection|block> <Name> [outDir]');
    process.exit(1);
  }

  const name = toPascalCase(rawName);
  const slug = toKebabCase(rawName);
  const templatesDir = path.join(__dirname, '..', 'templates');

  if (type === 'collection') {
    const templatePath = path.join(templatesDir, 'collection.template.ts');
    let template = fs.readFileSync(templatePath, 'utf8');
    template = template.replace(/\{\{CollectionName\}\}/g, name);
    template = template.replace(/\{\{collectionSlug\}\}/g, slug);

    const outPath = targetDir
      ? path.join(targetDir, `${name}.ts`)
      : path.join(process.cwd(), 'src', 'collections', `${name}.ts`);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, template, 'utf8');
    console.log(`\x1b[32m[Payload Scaffold]\x1b[0m Đã tạo Collection: ${outPath}`);
    return outPath;
  }

  if (type === 'block') {
    const templatePath = path.join(templatesDir, 'block.template.ts');
    let template = fs.readFileSync(templatePath, 'utf8');
    template = template.replace(/\{\{BlockName\}\}/g, name);
    template = template.replace(/\{\{blockSlug\}\}/g, toCamelCase(slug));

    const blockDir = targetDir
      ? path.join(targetDir, name)
      : path.join(process.cwd(), 'src', 'blocks', name);

    fs.mkdirSync(blockDir, { recursive: true });
    const configPath = path.join(blockDir, 'config.ts');
    fs.writeFileSync(configPath, template, 'utf8');

    // Tạo Component.tsx render tương ứng
    const compContent = `import React from 'react'\nimport type { ${name}BlockType } from '@/payload-types'\n\nexport const ${name}BlockComponent: React.FC<${name}BlockType> = ({ eyebrow, headline, description, items }) => {\n  return (\n    <section className="py-16 px-4 max-w-7xl mx-auto">\n      {eyebrow && <p className="text-sm uppercase tracking-wider text-blue-600 font-semibold mb-2">{eyebrow}</p>}\n      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{headline}</h2>\n      {description && <p className="text-lg text-slate-600 max-w-2xl mb-8">{description}</p>}\n      {items && items.length > 0 && (\n        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">\n          {items.map((item, idx) => (\n            <div key={idx} className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition">\n              {item.icon && <div className="text-2xl mb-2">{item.icon}</div>}\n              <h3 className="text-xl font-semibold mb-1">{item.title}</h3>\n              {item.subtitle && <p className="text-slate-500 text-sm">{item.subtitle}</p>}\n            </div>\n          ))}\n        </div>\n      )}\n    </section>\n  )\n}\n`;

    const compPath = path.join(blockDir, 'Component.tsx');
    fs.writeFileSync(compPath, compContent, 'utf8');
    console.log(`\x1b[32m[Payload Scaffold]\x1b[0m Đã tạo Block: ${blockDir}`);
    return blockDir;
  }

  console.error(`Loại scaffold không hỗ trợ: ${type}. Dùng 'collection' hoặc 'block'.`);
  process.exit(1);
}

if (require.main === module) {
  const [,, type, name, outDir] = process.argv;
  scaffold(type, name, outDir);
}

module.exports = { scaffold };
