#!/usr/bin/env node
/**
 * Kiểm thử tính nhất quán Workflow 9 bước (/idea → ... → /code-review → /test → ... → /ship).
 * Chống phân mảnh: mọi file khai báo workflow BẮT BUỘC có /code-review giữa /build và /test,
 * và không còn sót chuỗi 8 bước cũ.
 *
 * ponytail: assert thuần + đọc file, không framework. Trần: chỉ check chuỗi text trong
 * các file được liệt kê; thêm plugin mới khai báo workflow thì thêm 1 dòng vào WORKFLOW_FILES.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// File là NGUỒN CHÂN LÝ của workflow — bắt buộc nêu rõ chuỗi 9 bước.
const CANONICAL = [
  'CLAUDE.md',
  '360org/plugins/360-dev-workflow/prompts/workflow-standards.md',
  '360org/plugins/360-dev-workflow/prompts/SKILL.md',
  '360org/plugins/360-dev-workflow/prompts/references/multi-agent-orchestration.md',
  '360org/plugins/360-odoo/prompts/references/multi-agent-orchestration.md',
  'config/capabilities.manifest.json',
];

// File kế thừa — chỉ cần nhắc /code-review và không còn "8 bước".
const INHERITED = [
  '360org/plugins/360-odoo/prompts/SKILL.md',
  '360org/plugins/360-odoo/prompts/odoo-dev-guide.md',
  '360org/plugins/360-hermes/prompts/SKILL.md',
  '360org/plugins/360-hermes/prompts/references/multi-agent-orchestration.md',
  '360org/plugins/360-payload-website/prompts/SKILL.md',
  '360org/plugins/360-vuaoffice/prompts/SKILL.md',
  '360org/plugins/360-airouter/prompts/SKILL.md',
  '360org/plugins/360-desktop-app/prompts/SKILL.md',
  '360org/plugins/360-flutter/prompts/SKILL.md',
  '360org/scripts/hooks/360-smart-router.js',
];

const STALE = [/8 bước/i, /8-step/i, /8 Bước/];
let pass = 0;
const fail = [];

function check(name, fn) {
  try { fn(); pass += 1; console.log(`  ✅ ${name}`); }
  catch (e) { fail.push(`${name}: ${e.message}`); console.log(`  ❌ ${name} — ${e.message}`); }
}

console.log('\n=== WORKFLOW 9-STEP CONSISTENCY ===\n');

// Case 1-6: file canonical phải có /code-review nằm GIỮA /build và /test.
CANONICAL.forEach((f) => check(`[canonical] ${f} có /code-review giữa /build và /test`, () => {
  const t = read(f);
  const m = t.match(/\/build[^\n]{0,20}\/code-review[^\n]{0,20}\/test/);
  assert.ok(m, 'không tìm thấy chuỗi /build → /code-review → /test');
}));

// Case 7-16: file kế thừa phải nhắc /code-review.
INHERITED.forEach((f) => check(`[inherited] ${f} nhắc /code-review`, () => {
  assert.ok(read(f).includes('code-review'), 'thiếu /code-review');
}));

// Case 17: không còn sót chuỗi "8 bước" ở bất kỳ file workflow nào.
check('không còn sót chuỗi 8 bước ở mọi file workflow', () => {
  const dirty = [...CANONICAL, ...INHERITED].filter((f) => {
    const t = read(f);
    return STALE.some((re) => re.test(t));
  });
  assert.strictEqual(dirty.length, 0, `còn sót: ${dirty.join(', ')}`);
});

// Case 18: /code-review phải được khai báo là cổng chặn (blocking gate) ở canonical AIaC.
check('CLAUDE.md khai báo /code-review là CỔNG CHẶN', () => {
  const t = read('CLAUDE.md');
  assert.ok(/CỔNG CHẶN/.test(t), 'thiếu từ khoá CỔNG CHẶN');
  assert.ok(/CẤM|không được/i.test(t), 'thiếu điều kiện chặn sang /test');
});

// Case 19: reference canonical phải nêu đủ 4 trục soi diff.
check('reference canonical nêu đủ 4 trục soi diff', () => {
  const t = read('360org/plugins/360-dev-workflow/prompts/references/multi-agent-orchestration.md');
  ['Correctness', 'Reuse', 'Over-engineering', 'Security'].forEach((axis) => {
    assert.ok(t.includes(axis), `thiếu trục ${axis}`);
  });
});

// Case 20: bảng model assignment canonical phải đánh số tới bước 9 = /ship.
check('bảng model assignment canonical đánh số tới 9 = /ship', () => {
  const t = read('360org/plugins/360-dev-workflow/prompts/references/multi-agent-orchestration.md');
  assert.ok(/\|\s*9\s*\|\s*`\/ship`/.test(t), 'bước 9 không phải /ship');
  assert.ok(/\|\s*6\s*\|\s*`\/code-review`/.test(t), 'bước 6 không phải /code-review');
});

// Case 21: trần 3 vòng fix→re-review phải được ghi rõ (chống cày vô hạn).
check('trần 3 vòng fix→re-review được ghi rõ', () => {
  const t = read('360org/plugins/360-dev-workflow/prompts/references/multi-agent-orchestration.md');
  assert.ok(/3 vòng/.test(t), 'thiếu trần 3 vòng');
});

// Case 22: Code Reviewer phải khác model với Coder.
check('Code Reviewer bắt buộc khác model với Coder', () => {
  const t = read('360org/plugins/360-dev-workflow/prompts/references/multi-agent-orchestration.md');
  assert.ok(/khác model/.test(t), 'thiếu ràng buộc khác model');
});

const total = pass + fail.length;
console.log(`\n${fail.length === 0 ? '✅' : '❌'} WORKFLOW 9-STEP: ${pass}/${total} TEST CASES PASS`);
if (fail.length) { fail.forEach((f) => console.error(`   - ${f}`)); process.exit(1); }
