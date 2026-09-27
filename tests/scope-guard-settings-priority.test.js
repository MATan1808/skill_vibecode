#!/usr/bin/env node
// Kiểm thử AIaC Scope Guard: settings.local.json là nguồn ưu tiên CẤP 1.
// Mọi đường dẫn Sếp đã ghi trong đó = đã duyệt, hook KHÔNG được hỏi lại.
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', '360org', 'scripts', 'hooks', 'aiac-hook-bridge.js');

function decide(payload, cwd) {
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify(payload),
    cwd: cwd || process.cwd(),
    encoding: 'utf8'
  });
  const parsed = JSON.parse(out);
  return parsed?.hookSpecificOutput?.permissionDecision === 'ask' ? 'ask' : 'allow';
}

const read = (p) => ({ tool_name: 'Read', tool_input: { file_path: p } });
const bash = (c) => ({ tool_name: 'Bash', tool_input: { command: c } });

const AIAC = '/Volumes/DATA/DEV/aiac';
const local = JSON.parse(fs.readFileSync(path.join(AIAC, '.claude', 'settings.local.json'), 'utf8'));
const granted = local.permissions.additionalDirectories.filter((d) => fs.existsSync(d));
assert.ok(granted.length > 0, 'cần ít nhất 1 additionalDirectories tồn tại để kiểm thử');

let pass = 0;
const check = (name, got, want) => {
  assert.strictEqual(got, want, `${name}: got=${got} want=${want}`);
  pass++;
};

// 1-N: mọi folder trong additionalDirectories phải được allow, bất kể cwd nào.
for (const dir of granted) {
  check(`granted ${dir} (cwd=aiac)`, decide(read(path.join(dir, 'README.md')), AIAC), 'allow');
  check(`granted ${dir} (cwd=chính nó)`, decide(bash(`ls ${dir}`), dir), 'allow');
}

// Cross-scope: đứng ở folder được kéo thả vẫn đọc được folder được duyệt khác.
if (granted.length >= 2) {
  check('cross-scope granted[0] từ cwd=granted[1]', decide(read(path.join(granted[0], 'README.md')), granted[1]), 'allow');
}

// AIaC root luôn mở.
check('aiac root', decide(read(path.join(AIAC, 'package.json')), AIAC), 'allow');

// Regression: folder lạ chưa duyệt vẫn phải xin phép.
check('folder chưa duyệt', decide(read('/Volumes/DATA/DEV/khong-ton-tai-xyz/a.md'), AIAC), 'ask');
check('quét thư mục cha DEV', decide(bash('ls /Volumes/DATA/DEV/'), AIAC), 'ask');
check('SKILL_SOURCES root wildcard', decide(bash('ls /Volumes/DATA/DEV/SKILL_SOURCES/'), AIAC), 'ask');

// Regression: path nằm trong NỘI DUNG file không phải target -> không báo động giả.
check('path trong content không phải target', decide({
  tool_name: 'Write',
  tool_input: { file_path: path.join(AIAC, 'tmp-scope-test.md'), content: 'xem /Volumes/DATA/DEV/repo-la/abc.md' }
}, AIAC), 'allow');

// Wildcard đuôi trong settings phải được chuẩn hoá (repo/* -> repo).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-scope-'));
try {
  fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.claude', 'settings.local.json'),
    JSON.stringify({ permissions: { additionalDirectories: [`${granted[0]}/*`] } }));
  check('wildcard đuôi được chuẩn hoá', decide(read(path.join(granted[0], 'README.md')), tmp), 'allow');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\x1b[32m✅ SCOPE GUARD: ${pass}/${pass} TEST CASES PASS 100%\x1b[0m`);
