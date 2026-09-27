#!/usr/bin/env node
'use strict';

/**
 * 360 Smart Router: nhận diện workspace, giữ hồ sơ cục bộ và nạp ngữ cảnh nhỏ.
 * ponytail: nhận diện dựa trên dấu hiệu file; bổ sung parser framework khi có ca sai thực tế.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

let cwd = process.cwd();
const claudeRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(os.homedir(), '.claude');
const aiacDir = path.join(claudeRoot, '360org');
const maxInjectedChars = Number(process.env.AIAC_MAX_INJECTED_CHARS || 4_800);
const maxAgentMapChars = 0;
const maxCodegraphChars = 800;
const maxSessionStateChars = 500;
const maxLocalMemoryChars = 1_200;
const codegraphTtlMs = Number(process.env.AIAC_CODEGRAPH_TTL_MS || 24 * 60 * 60 * 1_000);
const codegraphMaxEntries = Number(process.env.AIAC_CODEGRAPH_MAX_ENTRIES || 25_000);
const codegraphMaxFiles = Number(process.env.AIAC_CODEGRAPH_MAX_FILES || 3_000);
const legacySkillsPath = process.env.AIAC_LEGACY_SKILLS_PATH || '/Volumes/DATA/DEV/SKILLS';
const forbiddenDevRoot = process.env.AIAC_FORBIDDEN_DEV_ROOT || '/Volumes/DATA/DEV';
const globalRules = [
  'Áp dụng Ponytail: kiểm tra tái dùng/stdlib/native/dependency trước khi viết mã; ưu tiên diff nhỏ và sửa root cause.',
  'Tối ưu context: dùng Codegraph cache nhỏ nếu có; chỉ chạy Agent-map khi Sếp yêu cầu audit/scan project rõ ràng.',
  'Dùng 360-codegraph deep mode khi audit module/project, cần structure/flow/impact/caller/callee, refactor/migration/risk cao, hoặc bug fix fail 2 lần.',
  'BẮT BUỘC ĐIỀU HƯỚNG 3 LỚP (CHỐNG ĐỌC MÒ): Khi project có graphify-out/graph.json, BẮT BUỘC tra cứu tọa độ qua MCP graphify (affected, query, path, god-nodes) trước khi mở file. TUYỆT ĐỐI KHÔNG đoán mò file hay quét/đọc tuần tự.',
  'Yêu cầu phức tạp: tách khảo sát, triển khai và kiểm chứng; chỉ dùng subagent khi các phần độc lập thực sự giảm thời gian hoặc rủi ro.',
  // ponytail: best-effort workaround cho Gemini lowercase tool name bug (upstream: Claude Code adapter cần normalize)
  'CRITICAL — Tool name case: Claude Code tool names are case-sensitive PascalCase. ALWAYS use Bash (not bash), Read (not read), Write (not write), Edit (not edit), MultiEdit (not multiedit). Calling lowercase names causes "No such tool available" errors that waste the entire turn.',
].join('\n');

function getAiacVersion() {
  try {
    const vPath = path.resolve(__dirname, '..', '..', '..', 'VERSION');
    if (fs.existsSync(vPath)) return fs.readFileSync(vPath, 'utf8').trim();
  } catch {}
  return '3.8.8';
}

function exists(relativePath) {
  return fs.existsSync(path.join(cwd, relativePath));
}

// maxDepth=3: layout multi-addons Odoo để manifest ở modules/<nhóm>/<module>/__manifest__.py
// (depth 3). Depth 2 làm repo addons bị nhận nhầm là generic. Flutter monorepo
// (apps/<app>/pubspec.yaml) cũng hưởng lợi. Chi phí ~1ms.
function findFileInSubdirs(fileName, maxDepth = 3) {
  function scan(directory, depth) {
    if (depth > maxDepth) return false;
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const child = path.join(directory, entry.name);
      if (fs.existsSync(path.join(child, fileName)) || scan(child, depth + 1)) return true;
    }
    return false;
  }
  return scan(cwd, 1);
}

const SKILL_BY_TYPE = {
  odoo: '360-odoo',
  flutter: '360-flutter',
  hermes: '360-hermes',
  wordpress: '360-wordpress',
  payload: '360-payload-website',
  openclaw: '360-openclaw',
  graphify: '360-graphify',
  'desktop-app': '360-desktop-app',
  'desktop-reverse': '360-desktop-reverse',
  'agent-device': '360-agent-device',
};

/**
 * Ưu tiên 1 — project-local: `.claude/aiac/PROJECT_PROFILE.md` thắng auto-detect.
 * Profile sinh bằng writeIfAbsent nên detect sai không thể tự sửa; đây là đường
 * để Sếp/agent chốt đúng loại dự án.
 *
 * Chỉ override khi type có skill thật. `generic` cố ý KHÔNG nằm trong bảng —
 * nếu cho nó override, mọi repo lỡ sinh profile GENERIC sai sẽ bị khoá vĩnh viễn;
 * trả null để auto-detect có cơ hội sửa lại.
 */
function detectFromProfile() {
  let raw;
  try {
    raw = fs.readFileSync(path.join(cwd, '.claude', 'aiac', 'PROJECT_PROFILE.md'), 'utf8');
  } catch {
    return null;
  }
  const matched = raw.match(/^-\s*Loại dự án:\s*([a-z][a-z0-9-]*)/im);
  const type = matched && matched[1].toLowerCase();
  if (!type || !SKILL_BY_TYPE[type]) return null;
  return { type, skill: SKILL_BY_TYPE[type], evidence: 'PROJECT_PROFILE.md (project-local, ưu tiên 1)' };
}

function detectProject() {
  const override = detectFromProfile();
  if (override) return override;

  if (exists('__manifest__.py') || exists('odoo-bin') || exists('setup/odoo') || findFileInSubdirs('__manifest__.py')) {
    return { type: 'odoo', skill: '360-odoo', evidence: '__manifest__.py, odoo-bin hoặc setup/odoo' };
  }
  if (exists('app.asar') || exists('Contents/Resources/app.asar') || cwd.toLowerCase().includes('reverse') || cwd.toLowerCase().includes('decompil')) {
    return { type: 'desktop-reverse', skill: '360-desktop-reverse', evidence: 'app.asar, bundle macOS hoặc thư mục reverse/decompile' };
  }
  if ((exists('src-tauri') && exists('idea.md')) || cwd.toLowerCase().includes('v-assistant') || cwd.toLowerCase().includes('vuaoffice') || exists('apps/shell')) {
    return { type: 'desktop-app', skill: '360-desktop-app', evidence: 'dự án Electron/Tauri Desktop App (VuaOffice / V-Assistant)' };
  }
  if (exists('pubspec.yaml') || findFileInSubdirs('pubspec.yaml')) {
    return { type: 'flutter', skill: '360-flutter', evidence: 'pubspec.yaml' };
  }
  if ((exists('plugin.yaml') && exists('hermes-dev-skills')) || cwd.toLowerCase().includes('hermes')) {
    return { type: 'hermes', skill: '360-hermes', evidence: 'plugin.yaml + hermes-dev-skills hoặc đường dẫn hermes' };
  }
  if (exists('wp-config.php') || exists('wp-content') || cwd.toLowerCase().includes('wordpress')) {
    return { type: 'wordpress', skill: '360-wordpress', evidence: 'wp-config.php, wp-content hoặc đường dẫn WordPress' };
  }
  const hasPayloadConfig = exists('payload.config.ts') || exists('payload.config.js') || exists('src/payload.config.ts') || exists('src/payload.config.js') || findFileInSubdirs('payload.config.ts');
  const pkgJson = readJson(path.join(cwd, 'package.json'));
  const pkgDeps = pkgJson ? { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) } : {};
  const hasPayloadDep = Boolean(pkgDeps['payload'] || pkgDeps['@payloadcms/core'] || pkgDeps['@payloadcms/next']);
  const isPayloadPath = (cwd.toLowerCase().includes('payload') && !cwd.toLowerCase().includes('aiac')) || cwd.toLowerCase().includes('vuaai.net');
  if (hasPayloadConfig || hasPayloadDep || isPayloadPath) {
    return { type: 'payload', skill: '360-payload-website', evidence: 'payload.config.*, package.json (payload) hoặc đường dẫn Payload CMS' };
  }
  if (cwd.toLowerCase().includes('openclaw') || cwd.toLowerCase().includes('vuaai')) {
    return { type: 'openclaw', skill: '360-openclaw', evidence: 'đường dẫn OpenClaw Gateway' };
  }
  if (exists('graphify-out/graph.json') || cwd.toLowerCase().includes('graphify')) {
    return { type: 'graphify', skill: '360-graphify', evidence: 'graphify-out/graph.json hoặc thư mục graphify' };
  }
  if (exists('.agent-device') || exists('.fallowrc.json') || cwd.toLowerCase().includes('agent-device') || exists('maestro.yaml')) {
    return { type: 'agent-device', skill: '360-agent-device', evidence: 'dự án kiểm thử thiết bị / agent-device / Maestro' };
  }
  return { type: 'generic', skill: null, evidence: 'không khớp bộ kỹ năng chuyên biệt' };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function configuredAiacRepo() {
  const runtime = readJson(path.join(aiacDir, 'aiac-runtime.json'));
  const candidate = process.env.AIAC_REPO_ROOT || runtime?.repoRoot;
  return candidate && fs.existsSync(path.join(candidate, '.git')) ? candidate : null;
}

function remoteTouchesLegacyStorage(remoteUrl, repoRoot) {
  if (!remoteUrl) return false;
  if (/^[^/]+@[^:]+:/.test(remoteUrl) || /^[a-z][a-z0-9+.-]*:\/\//i.test(remoteUrl) && !remoteUrl.startsWith('file://')) return false;
  const candidate = remoteUrl.startsWith('file://') ? new URL(remoteUrl).pathname : remoteUrl;
  return isPathInside(legacySkillsPath, path.resolve(repoRoot, candidate));
}

function safeAutoUpdate() {
  const repoRoot = configuredAiacRepo();
  if (!repoRoot) return;
  const lockPath = path.join(os.tmpdir(), 'aiac-upstream-update.lock');
  try {
    const handle = fs.openSync(lockPath, 'wx');
    fs.closeSync(handle);
  } catch {
    return;
  }

  const releaseLock = () => { try { fs.unlinkSync(lockPath); } catch {} };
  const upstream = spawnSync('git', ['remote', 'get-url', 'upstream'], { cwd: repoRoot, encoding: 'utf8', timeout: 2_000 });
  if (remoteTouchesLegacyStorage((upstream.stdout || '').trim(), repoRoot) && process.env.AIAC_ALLOW_LEGACY_SKILLS_UPSTREAM !== '1') {
    releaseLock();
    return;
  }

  const status = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8', timeout: 5_000 });
  if (status.status !== 0 || status.stdout.trim()) {
    releaseLock();
    return;
  }

  const update = spawn('sh', ['-c', 'git fetch --quiet upstream main && git merge --ff-only upstream/main'], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
  });
  update.once('error', releaseLock);
  update.once('exit', releaseLock);
  update.unref();
}

function localRules(project) {
  const shared = [
    '- Kế thừa Global CLAUDE.md; không lặp hoặc ghi đè các rule global.',
    '- Chỉ sửa cấu hình `.claude/` do AIaC tạo; giữ nguyên file cục bộ có sẵn.',
  ];
  const rules = {
    odoo: ['- XML không dùng `attrs=`; dùng `invisible`, `readonly`, `required` trực tiếp.', '- Trước thay đổi dữ liệu production: backup đã kiểm tra và pod one-off cô lập.'],
    'v-assistant': ['- Dùng worktree riêng trước khi đọc/sửa code.', '- Chỉ xác nhận khi đã kiểm tra ứng dụng macOS thật qua `npm run tauri dev` hoặc bản cài local.'],
    flutter: ['- Tránh bang operator (`!`); kiểm tra `context.mounted` sau `await`.', '- Chạy `flutter analyze` trước khi xác nhận.'],
    hermes: ['- Chỉ truy cập CloudPanel khi được Sếp yêu cầu rõ ràng; dùng `ssh cloudpanel`.'],
    wordpress: ['- Dùng `360-wordpress`; audit read-only trước, không hardening/cleanup production nếu chưa có lệnh rõ của Sếp.', '- Chỉ truy cập CloudPanel khi được Sếp yêu cầu rõ ràng; dùng `ssh cloudpanel`.'],
    payload: [
      '- Dùng `360-payload-website` cho dự án marketing site Payload CMS 3.x + Next.js.',
      '- Mac dùng Docker dev, Production dùng native CloudPanel qua PM2.',
      '- Bắt buộc `output: \'standalone\'` trong next.config và `localized: true` cho toàn bộ user-facing fields.',
      '- Chạy `pnpm generate:types` sau khi sửa schema collection/block.'
    ],
    openclaw: ['- Dùng `360-openclaw` cho quản trị API Gateway & Ecosystem.', '- Chỉ truy cập CloudPanel khi được Sếp yêu cầu rõ ràng; dùng `ssh cloudpanel`.'],
    'desktop-reverse': ['- Dùng `360-desktop-reverse` để phân tích bundle/asar/Mach-O/IPC của desktop app.', '- Chỉ phục vụ đọc hiểu kiến trúc và debug an toàn trong sandbox cục bộ.'],
    graphify: ['- Dùng `360-graphify` để tra cứu quan hệ gọi hàm/caller/callee/blast radius.', '- Ưu tiên tra cứu đồ thị `graphify query` hoặc MCP Server trước khi scan mã nguồn lớn.'],
    generic: ['- Dùng `360-dev-workflow` cho mọi dự án phần mềm không phải Odoo (Next.js, Nuxt, Flutter, RN, SaaS, CLI, lib...).', '- Tuân thủ workflow 9 bước (/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship) và 7 mandatory docs.'],
  };
  return [...shared, ...(rules[project.type] || rules.generic)].join('\n');
}

function writeIfAbsent(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function getActiveCwd(rawInput) {
  let parsed = null;
  if (rawInput && typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch {}
  }
  const candidate = (parsed && (parsed.cwd || parsed.workspace || parsed.directory || parsed.project_root || parsed.activeDirectory)) || process.cwd();
  return realPathSafe(candidate);
}

function syncProjectSettings(activeCwd) {
  if (!activeCwd || !fs.existsSync(activeCwd)) return;
  const claudeDir = path.join(activeCwd, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.local.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
    } catch {
      settings = {};
    }
  }
  let modified = false;
  if (settings.allowedWorkspace !== activeCwd) {
    settings.allowedWorkspace = activeCwd;
    modified = true;
  }
  if (!settings.permissions || typeof settings.permissions !== 'object') {
    settings.permissions = {};
    modified = true;
  }
  if (!Array.isArray(settings.permissions.additionalDirectories)) {
    settings.permissions.additionalDirectories = [];
    modified = true;
  }
  const repoRoot = configuredAiacRepo();
  if (repoRoot && fs.existsSync(repoRoot) && realPathSafe(repoRoot) !== realPathSafe(activeCwd)) {
    const safeRepo = realPathSafe(repoRoot);
    if (!settings.permissions.additionalDirectories.some(d => realPathSafe(d) === safeRepo)) {
      settings.permissions.additionalDirectories.push(repoRoot);
      modified = true;
    }
  }
  if (modified) {
    try {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    } catch {}
  }
}

function createProjectFiles(project) {
  const claudeDir = path.join(cwd, '.claude');
  const generatedDir = path.join(claudeDir, 'aiac');
  const settingsPath = path.join(claudeDir, 'settings.local.json');
  const localClaude = path.join(claudeDir, 'CLAUDE.md');
  const localMemory = path.join(claudeDir, 'MEMORY.md');
  const profilePath = path.join(generatedDir, 'PROJECT_PROFILE.md');
  const discoveryPath = path.join(generatedDir, 'SKILL_DISCOVERY.md');

  fs.mkdirSync(generatedDir, { recursive: true });
  syncProjectSettings(cwd);
  writeIfAbsent(localClaude, `# Project Guidelines (${project.type.toUpperCase()})\n\n> File do AIaC tạo. Quy tắc global được kế thừa từ Global CLAUDE.md.\n\n## Quy tắc cục bộ\n${localRules(project)}\n`);
  writeIfAbsent(localMemory, `# Project Memory (${project.type.toUpperCase()})\n\n> Bộ nhớ cục bộ theo repo (Local-First Memory). AIaC tự động nạp ưu tiên trước Claude Persistent Memory.\n\n## 1. Project Context\n- Loại dự án: ${project.type}\n- Dấu hiệu: ${project.evidence}\n- Package manager/runtime: auto-detect\n\n## 2. Core Decisions & Constraints\n- Không commit secret, token, private key vào repo.\n- Ưu tiên áp dụng Ponytail: YAGNI -> stdlib -> native -> existing dependency -> minimal diff.\n\n## 3. Session Learnings\n- [Init] Khởi tạo bối cảnh dự án.\n`);

  const profile = [
    '# AIaC Project Profile',
    '',
    `- Loại dự án: ${project.type}.`,
    `- Dấu hiệu: ${project.evidence}.`,
    `- Kỹ năng chuyên biệt: ${project.skill || 'chưa có'}.`,
    '- Code Knowledge Graph: khi có `graphify-out/graph.json`, bắt buộc dùng MCP graphify trước khi đọc file.',
    '- Agent map: `.claude/aiac/index/agent-map.md` chỉ chạy on-demand khi audit/scan project rõ ràng.',
    '- Codegraph: `.claude/codegraph.md` là cache import nhẹ có guard/lock/cap; `.codegraph/` upstream chỉ dùng deep mode.',
    '- Học theo dự án: ECC lưu tóm tắt phiên, quan sát và kỹ năng học được; AIaC chỉ nạp phần phù hợp, có giới hạn context.',
    '',
  ].join('\n');
  writeIfAbsent(profilePath, profile);

  if (!project.skill) {
    writeIfAbsent(discoveryPath, [
      '# Khám phá kỹ năng AIaC',
      '',
      'AIaC chưa nhận diện được bộ kỹ năng chuyên biệt cho workspace này.',
      '',
      'Khi yêu cầu thực tế đầu tiên xuất hiện, agent phải:',
      '1. Kiểm tra skills đã có của ECC và `360org` để tránh trùng lặp.',
      '2. Chỉ nghiên cứu tài liệu chính thức hoặc nguồn đáng tin cậy đúng với stack cần làm.',
      '3. Ghi đề xuất/draft cục bộ vào `.claude/aiac/discovered-skills/`; không tự cài plugin, không tự cấp quyền hay đưa secret ra ngoài.',
      '4. Chỉ nâng draft thành skill dùng chung sau khi đã áp dụng, kiểm chứng và có giá trị lặp lại.',
      '',
    ].join('\n'));
  }
}

function workspaceLockPath(name) {
  const key = Buffer.from(realPathSafe(cwd)).toString('hex').slice(0, 96);
  return path.join(os.tmpdir(), `aiac-${name}-${key}.lock`);
}

function withWorkspaceLock(name, callback) {
  const lockPath = workspaceLockPath(name);
  let handle;
  try {
    handle = fs.openSync(lockPath, 'wx');
  } catch {
    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs > 10 * 60 * 1_000) fs.unlinkSync(lockPath);
      handle = fs.openSync(lockPath, 'wx');
    } catch {
      return false;
    }
  }
  fs.closeSync(handle);
  const releaseLock = () => { try { fs.unlinkSync(lockPath); } catch {} };
  try {
    return callback(releaseLock, lockPath);
  } catch {
    releaseLock();
    return false;
  }
}

function refreshCache(scriptPath, outputPath, args, options = {}) {
  if (!fs.existsSync(scriptPath)) return;
  const ttlMs = options.ttlMs || 24 * 60 * 60 * 1_000;
  const timeout = options.timeout || 5_000;
  const lockName = options.lockName || 'cache';
  const isStale = !fs.existsSync(outputPath) || Date.now() - fs.statSync(outputPath).mtimeMs > ttlMs;
  if (!isStale) return;

  withWorkspaceLock(lockName, releaseLock => {
    if (!fs.existsSync(outputPath)) {
      spawnSync(args[0], args.slice(1), { cwd, stdio: 'ignore', timeout });
      releaseLock();
      return true;
    }
    const process = spawn(args[0], args.slice(1), { cwd, detached: true, stdio: 'ignore' });
    process.once('error', releaseLock);
    process.once('exit', releaseLock);
    process.unref();
    return true;
  });
}

function isAiacSourceWorkspace() {
  const repoRoot = configuredAiacRepo();
  return repoRoot && path.resolve(cwd) === path.resolve(repoRoot);
}

function isLegacySkillsWorkspace() {
  return isPathInside(legacySkillsPath, cwd);
}

function isForbiddenDevWorkspace() {
  const safeDev = realPathSafe(forbiddenDevRoot);
  const safeCwd = realPathSafe(cwd);
  if (safeCwd === safeDev) return true;
  if (process.env.AIAC_ALLOW_DEV_WORKSPACE === '1') return false;
  if (isAiacSourceWorkspace()) return false;
  return isPathInside(forbiddenDevRoot, cwd);
}

function isProjectRoot() {
  return ['.git', 'package.json', 'pyproject.toml', 'pubspec.yaml', '__manifest__.py', 'go.mod', 'Cargo.toml', 'README.md'].some(exists);
}

function countDirectoryEntries(limit) {
  let count = 0;
  function scan(directory) {
    if (count > limit) return;
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count > limit) return;
      if (entry.name === '.git' || entry.name === '.claude' || entry.name === 'node_modules') continue;
      count += 1;
      if (entry.isDirectory()) scan(path.join(directory, entry.name));
    }
  }
  scan(cwd);
  return count;
}

function writeSkippedCodegraph(reason) {
  const graphPath = path.join(cwd, '.claude', 'codegraph.md');
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  fs.writeFileSync(graphPath, `### Codegraph cục bộ\n\n- Trạng thái: skipped.\n- Lý do: ${reason}.\n`, 'utf8');
}

function allowHeavyScan() {
  return process.env.AIAC_SCAN_MODE === 'audit' || process.env.AIAC_SCAN_PROJECT === '1';
}

function runAgentMap() {
  if (isLegacySkillsWorkspace() || isForbiddenDevWorkspace()) return;
  if (process.env.AIAC_AGENT_MAP !== '1' && !allowHeavyScan()) return;
  const scriptPath = path.join(aiacDir, 'scripts', 'common', 'agent-map.py');
  const mapPath = path.join(cwd, '.claude', 'aiac', 'index', 'agent-map.md');
  if (spawnSync('python3', ['--version'], { stdio: 'ignore', timeout: 1_000 }).status !== 0) return;
  refreshCache(scriptPath, mapPath, ['python3', scriptPath], { timeout: 8_000, ttlMs: codegraphTtlMs, lockName: 'agent-map' });
}

function runCodegraph() {
  if (process.env.AIAC_SKIP_CODEGRAPH === '1' || isLegacySkillsWorkspace() || isForbiddenDevWorkspace()) return;
  if (!isProjectRoot()) return;
  if (!allowHeavyScan() && countDirectoryEntries(codegraphMaxEntries) > codegraphMaxEntries) {
    writeSkippedCodegraph(`workspace vượt ${codegraphMaxEntries} entries; chạy thủ công với AIAC_SCAN_PROJECT=1 khi cần audit`);
    return;
  }
  const scriptPath = path.join(aiacDir, 'scripts', 'common', 'codegraph.js');
  const graphPath = path.join(cwd, '.claude', 'codegraph.md');
  refreshCache(scriptPath, graphPath, [process.execPath, scriptPath, '--max-edges', '20', '--max-files', String(codegraphMaxFiles)], { timeout: 5_000, ttlMs: codegraphTtlMs, lockName: 'codegraph' });
}

function readCapped(filePath, maxChars) {
  if (maxChars <= 0) return '';
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.length <= maxChars ? content : `${content.slice(0, maxChars).trimEnd()}\n… [đã rút gọn]`;
  } catch {
    return '';
  }
}

function readCappedString(content, maxChars) {
  if (!content || maxChars <= 0) return '';
  return content.length <= maxChars ? content : `${content.slice(0, maxChars).trimEnd()}\n… [đã rút gọn]`;
}

function realPathSafe(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(realPathSafe(parentPath), realPathSafe(childPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function belongsToCurrentWorkspace(content) {
  const match = content.match(/^\*\*Worktree:\*\*\s+(.+)$/m);
  if (!match) return false;
  return isPathInside(match[1].trim(), cwd);
}

function cleanSessionSummary(summary) {
  const seen = new Set();
  return summary
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line && !line.includes('This session is being continued') && !line.startsWith('Summary:'))
    .filter(line => {
      const key = line.replace(/^[-*]\s*/, '').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
}

function getLatestSessionIndex() {
  try {
    const sessionDir = path.join(claudeRoot, 'session-data');
    if (!fs.existsSync(sessionDir)) return '';
    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('-session.tmp'))
      .map(f => ({ name: f, time: fs.statSync(path.join(sessionDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    for (const file of files) {
      const content = fs.readFileSync(path.join(sessionDir, file.name), 'utf8');
      if (!belongsToCurrentWorkspace(content)) continue;
      const startIdx = content.indexOf('<!-- ECC:SUMMARY:START -->');
      const endIdx = content.indexOf('<!-- ECC:SUMMARY:END -->');
      if (startIdx === -1 || endIdx === -1) continue;

      const fullSummary = cleanSessionSummary(content.slice(startIdx + '<!-- ECC:SUMMARY:START -->'.length, endIdx).trim());
      const lines = fullSummary.split('\n').filter(l => l.startsWith('-') || l.startsWith('*')).slice(0, 3);
      if (lines.length > 0) {
        return `### Phiên trước (Progressive Index):\n${lines.join('\n')}\n*(Dùng /resume-session nếu cần nạp chi tiết toàn bộ)*`;
      }
    }
    return '';
  } catch {
    return '';
  }
}

function getDynamicContextualMemory() {
  /**
   * Dynamic Memory Vector/Contextual Ranking (Học từ claude-mem):
   * Tự động trích xuất các memory/fact liên quan đến workspace hiện tại dựa trên từ khóa.
   */
  try {
    const memoryDir = path.join(claudeRoot, 'memory');
    if (!fs.existsSync(memoryDir)) return '';
    const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
    const matched = [];
    const wsLower = path.basename(cwd).toLowerCase();

    for (const file of files) {
      const txt = fs.readFileSync(path.join(memoryDir, file), 'utf8');
      if (txt.toLowerCase().includes(wsLower) || txt.toLowerCase().includes('odoo')) {
        const titleMatch = txt.match(/^name:\s*(.+)$/m);
        const descMatch = txt.match(/^description:\s*(.+)$/m);
        if (titleMatch && descMatch) {
          matched.push(`- [${titleMatch[1].trim()}]: ${descMatch[1].trim()}`);
        }
      }
      if (matched.length >= 2) break;
    }
    if (matched.length > 0) {
      return `### Memory Ngữ Cảnh Tự Động:\n${matched.join('\n')}`;
    }
    return '';
  } catch {
    return '';
  }
}

function getAutoLearnedInsights() {
  try {
    const latestFile = path.join(os.homedir(), '.claude', 'aiac', 'latest-learnings.json');
    if (!fs.existsSync(latestFile)) return '';
    const items = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    if (!Array.isArray(items) || items.length === 0) return '';
    const top = items.slice(0, 2).map(i => `- [${i.domain}]: ${i.title}`);
    return `### Auto-Learned Insights (AutoHarness):\n${top.join('\n')}`;
  } catch {
    return '';
  }
}

function getLocalProjectMemory() {
  /**
   * Local-First Project Memory (Dual-Tier Layer 1):
   * Tự động nạp [project]/.claude/MEMORY.md vào đầu SessionStart.
   * Ưu tiên cao hơn Persistent Memory toàn cục.
   */
  try {
    const localMemoryPath = path.join(cwd, '.claude', 'MEMORY.md');
    if (!fs.existsSync(localMemoryPath)) return '';
    const content = fs.readFileSync(localMemoryPath, 'utf8').trim();
    if (!content) return '';
    const capped = readCappedString(content, maxLocalMemoryChars);
    return `### Local Project Memory (.claude/MEMORY.md - Priority 1):\n${capped}`;
  } catch {
    return '';
  }
}

function buildContext(project) {
  if (isLegacySkillsWorkspace()) return `[AIaC] Legacy storage workspace: auto load/index/read/scan disabled for ${legacySkillsPath}.`;
  if (isForbiddenDevWorkspace()) return `[AIaC] ${forbiddenDevRoot}/* workspace: auto load/index/read/scan disabled. Chỉ mở khi Sếp yêu cầu rõ đúng project.`;

  // Prompt Cache Prefix Alignment (Static Rules -> Static Manifests/AST -> Dynamic Tail)
  // Tier 1: Immutable Global Rules & Capabilities
  const aiacVer = getAiacVersion();
  const repoRoot = configuredAiacRepo();
  const folderName = path.basename(cwd);

  const scopeLockHeader = [
    `[AIaC v${aiacVer}] 🎯 TỰ ĐỘNG NHẬN DIỆN WORKSPACE (WORKING FOLDER DETECTED):`,
    `- Thư mục làm việc hiện hành (Current Working Directory): ${cwd}`,
    `- Tên dự án: ${folderName}`,
    `- Workspace: ${project.type.toUpperCase()}`,
    `- Phân loại dự án: ${project.type.toUpperCase()} (Dấu hiệu: ${project.evidence})`,
    `- Ranh giới mã nguồn được phép (Allowed Scope): "${cwd}/*"${repoRoot ? ` VÀ "${repoRoot}/*" (Global AIaC)` : ''}`,
    '',
    '🔒 NGUYÊN TẮC KHÓA PHẠM VI LÀM VIỆC & BẢO VỆ TOKEN (STRICT WORKSPACE BOUNDARY):',
    `1. Ranh giới phiên làm việc: Bạn ĐANG ở trong thư mục "${cwd}". Mọi hành động tìm kiếm, kiểm tra cấu trúc, đọc tài liệu, chạy lệnh BẮT BUỘC thực hiện bên trong thư mục này.`,
    `2. TUYỆT ĐỐI CẤM đọc lan man: Nghiêm cấm mọi hành vi gọi Read, Glob, Grep, Bash để quét hoặc đọc thư mục cha ("${forbiddenDevRoot}/*") hay các dự án lân cận.`,
    `3. Khi Sếp yêu cầu "đọc tài liệu", "tìm docs", "nghiên cứu codebase": Mặc định CHỈ tìm và đọc tài liệu nằm bên trong "${cwd}" (ví dụ: "${cwd}/docs/", "${cwd}/README.md"...).`,
    '4. Yêu cầu ngoại vi: Khi cần tham khảo repo khác, chỉ được đọc khi Sếp chỉ định đích danh hoặc kéo thả folder vào chat. Hệ thống AIaC Scope Guard sẽ tự động can thiệp xin phép Sếp duyệt (Ask Permission) trước khi đọc.',
  ].join('\n');

  const parts = [scopeLockHeader, globalRules];
  if (project.skill) {
    parts.push(`Áp dụng skill ${project.skill} khi yêu cầu liên quan; chỉ mở reference cần thiết, không nạp toàn bộ skill.`);
  } else {
    parts.push('Stack chưa có skill chuyên biệt. Đọc `.claude/aiac/SKILL_DISCOVERY.md` khi yêu cầu chứng minh cần capability mới.');
  }

  // Tier 2: Static Project Memory (Local-First Priority 1)
  const localMemory = getLocalProjectMemory();
  if (localMemory) parts.push(localMemory);

  // Tier 3: Static AST Codegraph & Architecture Index
  const agentMap = readCapped(path.join(cwd, '.claude', 'aiac', 'index', 'agent-map.md'), maxAgentMapChars);
  if (agentMap) parts.push(agentMap);
  const graph = readCapped(path.join(cwd, '.claude', 'codegraph.md'), maxCodegraphChars);
  if (graph) parts.push(graph);

  // Tier 4: Dynamic Volatile State (Contextual Memory & Progressive Session Index)
  const dynMemory = readCappedString(getDynamicContextualMemory(), 400);
  if (dynMemory) parts.push(dynMemory);
  const sessionIndex = readCappedString(getLatestSessionIndex(), maxSessionStateChars);
  if (sessionIndex) parts.push(sessionIndex);
  const autoLearned = getAutoLearnedInsights();
  if (autoLearned) parts.push(autoLearned);

  const context = parts.join('\n\n');
  return context.length <= maxInjectedChars ? context : `${context.slice(0, maxInjectedChars).trimEnd()}\n… [AIaC context đã rút gọn]`;
}

function invokeEcc(rawInput) {
  const baseScript = path.join(claudeRoot, 'scripts', 'hooks', 'session-start.js');
  if (!fs.existsSync(baseScript)) return null;
  const result = spawnSync(process.execPath, [baseScript], { input: rawInput, encoding: 'utf8', env: process.env, cwd, timeout: 5_000 });
  return result.stdout || null;
}

function appendContext(baseOutput, context) {
  let payload;
  try {
    payload = JSON.parse(baseOutput || '{}');
  } catch {
    payload = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } };
  }
  if (!payload.hookSpecificOutput || typeof payload.hookSpecificOutput !== 'object') {
    payload.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: '' };
  }
  payload.hookSpecificOutput.additionalContext = [payload.hookSpecificOutput.additionalContext, context]
    .filter(Boolean)
    .join('\n\n');
  return JSON.stringify(payload);
}

function resolveAiacAsset(...segments) {
  const runtimePath = configuredAiacRepo();
  const candidates = [];
  if (runtimePath) candidates.push(path.join(runtimePath, '360org', ...segments));
  candidates.push(path.join(aiacDir, ...segments));
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function ensureTelemetryDashboard() {
  if (process.env.AIAC_TELEMETRY_DASHBOARD !== '1') return;
  const targetScript = resolveAiacAsset('telemetry', 'server.js');
  const port = Number(process.env.AIAC_TELEMETRY_PORT || 3600);
  if (!targetScript || !Number.isInteger(port) || port <= 0) return;

  const start = () => {
    let nodeExec = process.execPath;
    if (!fs.existsSync(nodeExec) || nodeExec.endsWith('claude') || nodeExec.endsWith('sh')) {
      const fallbackNode = '/Volumes/DATA/DEV/vuaassistant/runtime/node/node';
      if (fs.existsSync(fallbackNode)) {
        nodeExec = fallbackNode;
      }
    }
    const repoPath = configuredAiacRepo() || aiacDir;
    const p = spawn(nodeExec, [targetScript], {
      cwd: repoPath,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        AIAC_REPO_ROOT: repoPath
      }
    });
    p.unref();
  };

  try {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(200);
    socket.once('connect', () => {
      socket.destroy();
    });
    socket.once('timeout', () => {
      socket.destroy();
      start();
    });
    socket.once('error', () => {
      socket.destroy();
      start();
    });
    socket.connect(port, '127.0.0.1');
  } catch (_) {}
}

function resolveModelContextCapacity(modelName) {
  if (!modelName) return 200_000;
  const mLower = modelName.trim().toLowerCase();

  const targetSpecs = resolveAiacAsset('config', 'model-context-specs.json');

  let specs = null;
  if (targetSpecs) {
    try {
      specs = JSON.parse(fs.readFileSync(targetSpecs, 'utf8'));
    } catch (_) {}
  }

  if (specs) {
    if (specs.exact && specs.exact[mLower]) {
      return specs.exact[mLower];
    }
    if (Array.isArray(specs.patterns)) {
      for (const p of specs.patterns) {
        if (new RegExp(p.regex, 'i').test(mLower)) {
          return p.limit;
        }
      }
    }
    return specs.default || 200_000;
  }

  if (mLower.includes('nemotron') || mLower.includes('nemotrol')) return 1_000_000;
  if (mLower.includes('gemini') && mLower.includes('pro')) return 2_000_000;
  if (mLower.includes('gemini') || mLower.includes('antigravity') || mLower.includes('flash')) return 1_000_000;
  if (mLower.includes('opus') || mLower.includes('sonnet') || mLower.includes('fable') || mLower.includes('haiku')) return 200_000;
  if (mLower.includes('gpt-5')) return 256_000;
  if (mLower.includes('gpt-4') || mLower.includes('codex') || mLower.includes('o1') || mLower.includes('o3')) return 128_000;
  return 200_000;
}

function detectAndTuneContextWindow() {
  const model = process.env.ANTHROPIC_MODEL ||
                process.env.CLAUDE_MODEL ||
                process.env.MODEL_NAME ||
                'claude-sonnet-5';

  const targetLimit = resolveModelContextCapacity(model);

  if (!process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS) {
    process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS = String(targetLimit);
    
    // Ghi vào settings.local.json để Claude Code parent process nhận được (auto-compact)
    try {
      const settingsPath = path.join(cwd, '.claude', 'settings.local.json');
      let settings = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
      if (!settings.env) settings.env = {};
      
      // Chỉ cập nhật nếu có sự thay đổi để tránh vòng lặp file watcher
      if (settings.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS !== String(targetLimit)) {
        settings.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS = String(targetLimit);
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      }
    } catch (err) {
      // Bỏ qua lỗi ghi file
    }
  }
}

function main() {
  let rawInput = '';
  try { rawInput = fs.readFileSync(0, 'utf8'); } catch {}
  cwd = getActiveCwd(rawInput);
  try {
    if (fs.existsSync(cwd) && cwd !== process.cwd()) {
      process.chdir(cwd);
    }
  } catch {}
  try {
    detectAndTuneContextWindow();
    ensureTelemetryDashboard();
    if (isLegacySkillsWorkspace()) {
      process.stderr.write('\x1b[33m[360 Smart Router]\x1b[0m Bỏ qua legacy storage workspace: ' + legacySkillsPath + '\n');
      process.stdout.write(appendContext(null, buildContext({ type: 'legacy-storage' })));
      return;
    }
    if (isForbiddenDevWorkspace()) {
      process.stderr.write('\x1b[33m[360 Smart Router]\x1b[0m Bỏ qua DEV workspace: ' + forbiddenDevRoot + '/*\n');
      process.stdout.write(appendContext(null, buildContext({ type: 'dev-disabled' })));
      return;
    }
    const project = detectProject();
    if (!isForbiddenDevWorkspace()) createProjectFiles(project);
    runAgentMap();
    runCodegraph();
    safeAutoUpdate();
    process.stderr.write(`\x1b[32m[360 Smart Router]\x1b[0m 🎯 Working Folder: \x1b[1m${cwd}\x1b[0m | Dự án: \x1b[1m${project.type.toUpperCase()}\x1b[0m\n`);
    process.stdout.write(appendContext(invokeEcc(rawInput), buildContext(project)));
  } catch (error) {
    process.stderr.write(`[360 Smart Router] WARNING: ${error.message}\n`);
    process.stdout.write(appendContext(invokeEcc(rawInput), ''));
  }
}

main();
