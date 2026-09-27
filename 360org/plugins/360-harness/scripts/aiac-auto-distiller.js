#!/usr/bin/env node
'use strict';

/**
 * AIaC Autonomous Continuous Distiller (AutoHarness Engine)
 * Tự động chắt lọc bài học kinh nghiệm, quy chuẩn từ Sếp và bẫy lỗi (Fix-Verify Pairs)
 * Chạy tự động ngầm ở sự kiện hook Stop/SessionEnd mà không cần người dùng gõ lệnh thủ công.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const AIAC_ROOT = process.env.AIAC_ROOT || path.resolve(__dirname, '../../../..');
const HARNESS_DATA_DIR = path.join(AIAC_ROOT, '360org', 'plugins', '360-harness', 'data');
const LEDGER_FILE = path.join(HARNESS_DATA_DIR, 'learning-ledger.jsonl');
const PROPOSALS_FILE = path.join(HARNESS_DATA_DIR, 'pending-proposals.json');
const PROPOSALS_LOCK_DIR = `${PROPOSALS_FILE}.lock`;
const LATEST_LEARNINGS_FILE = path.join(os.homedir(), '.claude', 'aiac', 'latest-learnings.json');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(HARNESS_DATA_DIR)) fs.mkdirSync(HARNESS_DATA_DIR, { recursive: true });
const userAiacDir = path.join(os.homedir(), '.claude', 'aiac');
if (!fs.existsSync(userAiacDir)) fs.mkdirSync(userAiacDir, { recursive: true });

/**
 * 1. Tìm transcript session gần nhất của Claude Code
 */
function findLatestSessionFile(cwd = process.cwd()) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) return null;
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  // Map cwd to folder name: /Volumes/DATA/DEV/aiac -> -Volumes-DATA-DEV-aiac
  const folderName = cwd.replace(/\//g, '-');
  const targetFolder = path.join(projectsDir, folderName);

  if (fs.existsSync(targetFolder)) {
    let files = [];
    try {
      files = fs.readdirSync(targetFolder)
        .filter(f => f.endsWith('.jsonl') && !f.startsWith('.'))
        .map(f => path.join(targetFolder, f))
        .filter(full => isCurrentProjectTranscript(full, cwd))
        .map(full => ({ full, mtime: fs.statSync(full).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
    } catch (_) {
      return null;
    }

    if (files.length > 0) return files[0].full;
  }

  return null;
}

/**
 * 2. Đọc và lọc các entries gần nhất trong session transcript
 */
function readRecentSessionEvents(sessionFilePath, maxLines = 1500) {
  if (!sessionFilePath || !Number.isInteger(maxLines) || maxLines < 1) return [];
  let fd;
  try {
    fd = fs.openSync(sessionFilePath, 'r');
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) return [];
    // ponytail: đọc tối đa 2 MiB cuối; bỏ dòng bị cắt, dùng cursor nếu cần lịch sử dài hơn.
    const start = Math.max(0, stat.size - 2 * 1024 * 1024);
    const buffer = Buffer.alloc(stat.size - start);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, start);
    let content = buffer.subarray(0, bytesRead).toString('utf8');
    if (start > 0) {
      const newline = content.indexOf('\n');
      content = newline < 0 ? '' : content.slice(newline + 1);
    }
    const events = [];
    for (const line of content.split('\n').filter(Boolean).slice(-Math.min(maxLines, 1500))) {
      try {
        const event = JSON.parse(line);
        if (event && typeof event === 'object' && !Array.isArray(event)) events.push(event);
      } catch (_) {}
    }
    return events;
  } catch {
    return [];
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * 3. Bộ lọc An toàn & Chống Leak Secret (Promoter Gate)
 */
function sanitizeContent(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/(api[_-]?key|secret|token|password|bearer)\s*[:=]\s*["']?[^\s"']{12,}["']?/gi, '$1: [REDACTED_SECRET]')
    .replace(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,})/g, '[REDACTED_SECRET]');
}

const SECRET_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:authorization\s*[:=]\s*)?bearer\s+[A-Za-z0-9._~+/=-]{12,}|(?:["']?(?:api[_-]?key|password|secret|token|bearer)["']?\s*[:=]\s*)["']?[^\s"']{12,}["']?|(?:AKIA|ASIA)[A-Z0-9]{16}|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,})/i;

function hasSecret(text) {
  return typeof text === 'string' && SECRET_PATTERN.test(text);
}

/**
 * 4. Đọc Sổ Cái (Ledger) để chống trùng lặp
 */
function readExistingLedgerHashes() {
  const hashes = new Set();
  if (fs.existsSync(LEDGER_FILE)) {
    try {
      const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.contentHash) hashes.add(entry.contentHash);
          if (entry.title) hashes.add(entry.title.toLowerCase().trim());
        } catch (_) {}
      }
    } catch (_) {}
  }
  if (fs.existsSync(PROPOSALS_FILE)) {
    try {
      const proposals = JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf8'));
      if (Array.isArray(proposals)) {
        for (const p of proposals) {
          if (p.contentHash) hashes.add(p.contentHash);
          if (p.title) hashes.add(p.title.toLowerCase().trim());
        }
      }
    } catch (_) {}
  }
  return hashes;
}

/**
 * 5. Tự động nhận diện bài học từ transcript (Reflector)
 */
function extractUserText(messageObj) {
  if (!messageObj) return '';
  if (messageObj.attachment && Array.isArray(messageObj.attachment.prompt)) {
    return messageObj.attachment.prompt
      .filter(p => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text)
      .join('\n');
  }
  const content = messageObj.content || messageObj.text || '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textParts = [];
    for (const item of content) {
      if (item.type === 'text' && typeof item.text === 'string') {
        textParts.push(item.text);
      }
    }
    return textParts.join('\n');
  }
  return '';
}

function extractLessonsFromEvents(events) {
  const candidates = [];
  const existingHashes = readExistingLedgerHashes();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || !['user_message', 'user', 'attachment'].includes(event.type)) continue;

    const rawText = extractUserText(event.message || event);
    if (!rawText || rawText.includes('<task-notification>') || rawText.includes('<system-reminder>') ||
      rawText.startsWith('This session is being continued')) continue;

    const lower = rawText.toLowerCase();
    const isDirective = ['bắt buộc', 'không được', 'tuyệt đối', 'cấm', 'quy chuẩn', 'luật cứng', 'từ giờ',
      'chuyển sang', 'cỏ cái này', 'bỏ cái này', 'nhớ là', 'tự học', 'tự động học', 'phải tự động',
      'tốt nhất là', 'phải có thông báo', 'chết luôn', 'approved', 'phê duyệt', 'vùng cấm']
      .some(signal => lower.includes(signal));

    if (!isDirective || rawText.length < 15 || rawText.length > 500) continue;

    const clean = rawText.replace(/\n+/g, ' ').trim();
    const hash = crypto.createHash('sha256').update(clean).digest('hex').slice(0, 16);
    if (existingHashes.has(hash)) continue;

    existingHashes.add(hash);
    let domain = '360-dev-workflow';
    if (lower.includes('odoo') || lower.includes('enterprise') || lower.includes('backend_ui')) domain = '360-odoo';
    else if (lower.includes('server') || lower.includes('ssh') || lower.includes('cloudmounter') || lower.includes('sync') || lower.includes('instance')) domain = '360-instance-arch';
    else if (lower.includes('git') || lower.includes('gitlab') || lower.includes('push')) domain = '360-gitsync';
    else if (lower.includes('harness') || lower.includes('learn') || lower.includes('tự học') || lower.includes('tự động học')) domain = '360-harness';
    else if (lower.includes('flutter') || lower.includes('mobile')) domain = '360-flutter';
    candidates.push({ type: 'USER_DIRECTIVE', title: clean.slice(0, 80), detail: clean, domain, contentHash: hash, sourceTurn: i });
  }

  // ponytail: chỉ tự đề xuất chỉ thị người dùng; thêm lại fix-verify khi transcript chứng minh cùng lệnh test trước/sau và Edit thành công.
  return candidates;
}

/**
 * 6. Quản lý Hàng Đợi Đề Xuất & Duyệt Bài Học (Approval Gate)
 */
function getPendingProposals() {
  if (!fs.existsSync(PROPOSALS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf8'));
    return Array.isArray(data) && data.every(isValidProposal) &&
      new Set(data.map(item => item.id)).size === data.length ? data : null;
  } catch {
    return null;
  }
}

function withProposalsLock(action) {
  try {
    fs.mkdirSync(PROPOSALS_LOCK_DIR);
  } catch {
    // ponytail: lock không tự thu hồi sau crash để không ghi đè writer còn sống; xóa lock sau khi xác nhận process cũ đã dừng.
    return null;
  }

  try {
    return action();
  } finally {
    try { fs.rmdirSync(PROPOSALS_LOCK_DIR); } catch (_) {}
  }
}

function savePendingProposals(proposals) {
  const tempFile = `${PROPOSALS_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(proposals, null, 2), 'utf8');
    fs.renameSync(tempFile, PROPOSALS_FILE);
    return true;
  } catch (_) {
    try { fs.unlinkSync(tempFile); } catch (_) {}
    return false;
  }
}

function isCurrentProjectTranscript(candidate, cwd = process.cwd()) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return false;
  try {
    const projectDir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/\//g, '-'));
    const resolvedProjectDir = fs.realpathSync(projectDir);
    const resolvedCandidate = fs.realpathSync(candidate);
    return resolvedCandidate.startsWith(`${resolvedProjectDir}${path.sep}`) &&
      resolvedCandidate.endsWith('.jsonl') && fs.statSync(resolvedCandidate).isFile();
  } catch {
    return false;
  }
}

function isSafeDomain(domain) {
  if (typeof domain !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(domain)) return false;
  const pluginsDir = path.join(AIAC_ROOT, '360org', 'plugins');
  const candidate = path.join(pluginsDir, domain);
  try {
    const resolvedPluginsDir = fs.realpathSync(pluginsDir);
    const resolvedCandidate = fs.realpathSync(candidate);
    return resolvedCandidate.startsWith(`${resolvedPluginsDir}${path.sep}`) && fs.statSync(resolvedCandidate).isDirectory();
  } catch {
    return false;
  }
}

function isValidProposal(item) {
  return !!item && typeof item === 'object' && !Array.isArray(item) &&
    ['id', 'title', 'detail', 'domain', 'contentHash'].every(key => typeof item[key] === 'string' && item[key] && item[key].length <= 4000) &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(item.id) && /^[a-zA-Z0-9_-]{1,128}$/.test(item.contentHash) &&
    (item.type === undefined || ['USER_DIRECTIVE', 'RESOLVED_PITFALL'].includes(item.type)) &&
    (item.decision === undefined || ['APPROVED', 'REJECTED'].includes(item.decision)) &&
    !hasSecret(JSON.stringify(item)) && isSafeDomain(item.domain);
}

function proposalFields(item) {
  return {
    id: item.id, type: item.type || 'USER_DIRECTIVE', domain: item.domain,
    title: item.title, detail: item.detail, contentHash: item.contentHash,
    proposedAt: item.proposedAt
  };
}

function readLedger() {
  try {
    return fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function atomicWrite(file, content) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function ledgerDecision(id) {
  let decision = null;
  for (const event of readLedger()) {
    if (event.id === id && ['APPROVED', 'REJECTED'].includes(event.ledgerAction)) decision = event.ledgerAction;
  }
  return decision;
}

function appendLedgerAction(item, action, timestampKey, now) {
  try {
    const existing = ledgerDecision(item.id);
    if (existing) return existing === action;
    fs.appendFileSync(LEDGER_FILE, JSON.stringify({
      ...proposalFields(item),
      status: action,
      [timestampKey]: now,
      ledgerAction: action
    }) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

function recordProposedLesson(lesson) {
  if (!lesson || typeof lesson !== 'object' ||
    !['title', 'detail', 'domain', 'contentHash'].every(key => typeof lesson[key] === 'string' && lesson[key]) ||
    !['title', 'detail', 'domain', 'contentHash'].every(key => !hasSecret(lesson[key])) ||
    !isSafeDomain(lesson.domain)) return false;

  return withProposalsLock(() => {
    const proposals = getPendingProposals();
    if (!Array.isArray(proposals) || proposals.some(item => item && item.contentHash === lesson.contentHash)) return false;
    try {
      if (readLedger().some(event => event.contentHash === lesson.contentHash)) return false;
    } catch {
      return false;
    }

    const now = new Date().toISOString();
    const entry = {
      id: `prop_${crypto.randomUUID()}`,
      type: ['USER_DIRECTIVE', 'RESOLVED_PITFALL'].includes(lesson.type) ? lesson.type : 'USER_DIRECTIVE',
      domain: lesson.domain,
      title: sanitizeContent(lesson.title),
      detail: sanitizeContent(lesson.detail),
      contentHash: lesson.contentHash,
      proposedAt: now,
      status: 'PENDING_APPROVAL'
    };
    if (!isValidProposal(entry)) return false;

    proposals.push(entry);
    if (!savePendingProposals(proposals)) return false;
    try {
      fs.appendFileSync(LEDGER_FILE, JSON.stringify({ ...proposalFields(entry), status: 'PENDING_APPROVAL', ledgerAction: 'PROPOSED' }) + '\n', 'utf8');
    } catch (_) {
      // ponytail: queue là nguồn chân lý của pending; chỉ cần reconciliation khi audit thấy journal thiếu thường xuyên.
    }
    return true;
  }) ?? false;
}

function approveProposal(idOrAll = 'all') {
  return withProposalsLock(() => {
    const proposals = getPendingProposals();
    if (!Array.isArray(proposals) || proposals.length === 0) return { approved: 0, items: [] };

    const toApprove = idOrAll === 'all'
      ? proposals
      : proposals.filter(p => p.id === idOrAll);

    if (toApprove.length === 0) return { approved: 0, items: [] };

    const now = new Date().toISOString();
    let latest = [];
    try {
      if (fs.existsSync(LATEST_LEARNINGS_FILE)) {
        latest = JSON.parse(fs.readFileSync(LATEST_LEARNINGS_FILE, 'utf8'));
        if (!Array.isArray(latest)) latest = [];
      }
    } catch (_) {
      latest = [];
    }

    const actuallyApproved = [];
    const processedIds = new Set();

    for (const item of toApprove) {
      if (!isValidProposal(item)) continue;
      
      const cleanItem = proposalFields(item);

      let refSuccess = false;
      const pluginDir = path.join(AIAC_ROOT, '360org', 'plugins', item.domain);
      const refsDir = path.join(pluginDir, 'prompts', 'references');
      const autoNotesFile = path.join(refsDir, 'auto-learned-rules.md');

      if (!fs.existsSync(pluginDir)) {
        console.warn(`[AutoHarness] Bỏ qua cập nhật reference bài học ${item.id} vì không tìm thấy domain ${item.domain}`);
        continue;
      }

      try {
        if (!fs.existsSync(refsDir)) fs.mkdirSync(refsDir, { recursive: true });
        
        // Exact line match, not regexp
        const marker = `- **Mã duyệt**: ${item.id}`;
        const content = fs.existsSync(autoNotesFile) ? fs.readFileSync(autoNotesFile, 'utf8') : '';
        
        if (content.split('\n').some(line => line.trim() === marker)) {
          refSuccess = true;
        } else {
          const header = fs.existsSync(autoNotesFile)
            ? ''
            : `# Các Quy Chuẩn & Bài Học Tự Động Tiếp Thu (${item.domain})\n\n> File này được AutoHarness tự động chắt lọc và Sếp Châu phê duyệt.\n\n---\n\n`;

          const snippet = `### [${now.slice(0, 10)}] ${cleanItem.title}\n- **Loại**: ${cleanItem.type}\n- **Chi tiết**: ${cleanItem.detail}\n- **Mã duyệt**: ${cleanItem.id}\n\n`;
          fs.appendFileSync(autoNotesFile, header + snippet, 'utf8');
          refSuccess = true;
        }
      } catch (_) {}
      
      if (!refSuccess) continue;
      
      const ledgerSuccess = appendLedgerAction(cleanItem, 'APPROVED', 'approvedAt', now);
      if (!ledgerSuccess) continue;

      actuallyApproved.push(cleanItem);
      processedIds.add(item.id);
      
      // Deduplicate latest
      latest = latest.filter(x => x && x.id !== cleanItem.id);
      latest.unshift({ ...cleanItem, status: 'APPROVED', approvedAt: now });
    }

    const remaining = proposals.filter(p => !processedIds.has(p.id));
    if (!savePendingProposals(remaining)) return { approved: 0, items: [] };

    if (latest.length > 20) latest = latest.slice(0, 20);
    try {
      const userDir = path.dirname(LATEST_LEARNINGS_FILE);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      atomicWrite(LATEST_LEARNINGS_FILE, JSON.stringify(latest, null, 2));
    } catch (_) {}

    return { approved: actuallyApproved.length, items: actuallyApproved };
  }) || { approved: 0, items: [] };
}

function rejectProposal(idOrAll = 'all') {
  return withProposalsLock(() => {
    const proposals = getPendingProposals();
    if (!Array.isArray(proposals) || proposals.length === 0) return { rejected: 0 };

    const toReject = idOrAll === 'all'
      ? proposals
      : proposals.filter(p => p.id === idOrAll);
    if (toReject.length === 0) return { rejected: 0 };

    const rejectedIds = new Set();
    const now = new Date().toISOString();
    for (const item of toReject) {
      if (isValidProposal(item) && appendLedgerAction(item, 'REJECTED', 'rejectedAt', now)) {
        rejectedIds.add(item.id);
      }
    }

    if (!savePendingProposals(proposals.filter(p => !rejectedIds.has(p.id)))) {
      return { rejected: 0 };
    }
    return { rejected: rejectedIds.size };
  }) || { rejected: 0 };
}

/**
 * 7. Hàm thực thi chính (Chạy ngầm ở hook Stop)
 */
async function autoDistill(explicitTranscriptPath = null) {
  const sessionFile = explicitTranscriptPath
    ? (isCurrentProjectTranscript(explicitTranscriptPath) ? explicitTranscriptPath : null)
    : findLatestSessionFile();
  if (!sessionFile) {
    let queue = [];
    try { queue = getPendingProposals(); } catch (_) {}
    return { proposed: 0, pendingTotal: Array.isArray(queue) ? queue.length : 0, error: queue === null };
  }

  const events = readRecentSessionEvents(sessionFile, 1500);
  const candidates = extractLessonsFromEvents(events);

  let count = 0;
  for (const c of candidates) {
    if (recordProposedLesson(c)) count++;
  }

  let pending = [];
  try { pending = getPendingProposals(); } catch (_) {}
  return { proposed: count, pendingTotal: Array.isArray(pending) ? pending.length : 0, totalFound: candidates.length, error: pending === null };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'distill';

  if (cmd === 'list') {
    const proposals = getPendingProposals() || [];
    console.log(`\n=== Danh Sách Bài Học Chờ Sếp Duyệt (${proposals.length} đề xuất) ===\n`);
    if (proposals.length === 0) {
      console.log('Hiện tại không có bài học nào đang chờ duyệt.');
    } else {
      proposals.forEach((p, idx) => {
        console.log(`[${idx + 1}] ID: \x1b[36m${p.id}\x1b[0m | Domain: \x1b[33m${p.domain}\x1b[0m | Loại: ${p.type}`);
        console.log(`    Tiêu đề : ${p.title}`);
        console.log(`    Chi tiết: ${p.detail.slice(0, 120)}...`);
        console.log(`    Thời gian: ${p.proposedAt}`);
        console.log('    ----------------------------------------------------------');
      });
    }
    console.log('');
  } else if (cmd === 'approve') {
    const targetId = args[1] || 'all';
    const res = approveProposal(targetId);
    console.log(`✅ Đã phê duyệt và áp dụng ${res.approved} bài học vào plugin tương ứng.`);
  } else if (cmd === 'reject') {
    const targetId = args[1] || 'all';
    const res = rejectProposal(targetId);
    console.log(`❌ Đã từ chối/loại bỏ ${res.rejected} đề xuất.`);
  } else if (cmd === 'distill' && args[1]) {
    autoDistill(args[1]).then(res => {
      if (res.proposed > 0) {
        console.log(`[AutoHarness] Tự động chắt lọc được ${res.proposed} bài học mới, đưa vào danh sách chờ Sếp duyệt (Tổng chờ duyệt: ${res.pendingTotal}).`);
      }
    }).catch(() => {});
  } else {
    autoDistill().then(res => {
      if (res.proposed > 0) {
        console.log(`[AutoHarness] Tự động chắt lọc được ${res.proposed} bài học mới, đưa vào danh sách chờ Sếp duyệt (Tổng chờ duyệt: ${res.pendingTotal}).`);
      }
    }).catch(() => {});
  }
}

module.exports = {
  autoDistill,
  extractLessonsFromEvents,
  findLatestSessionFile,
  getPendingProposals,
  recordProposedLesson,
  approveProposal,
  rejectProposal,
  readRecentSessionEvents
};
