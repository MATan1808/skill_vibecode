'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SECRET_PATTERN = /(password|passwd|secret|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*['\"]?[^'\"\s]{8,}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|ssh-rsa\s+[A-Za-z0-9/+]+=*/i;

function gitRoot(cwd) {
  const res = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', timeout: 5000 });
  return res.status === 0 ? res.stdout.trim() : '';
}

function unquote(value) {
  return value ? value.replace(/^['"]|['"]$/g, '') : process.cwd();
}

function gitAction(command) {
  const match = command.match(/\bgit(?:\s+-C\s+("[^"]+"|'[^']+'|\S+))?\s+(commit|push)\b/);
  return match ? { cwd: unquote(match[1]), action: match[2] } : null;
}

function firstSecret(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = firstSecret(filePath);
      if (found) return found;
      continue;
    }
    if (entry.isFile() && SECRET_PATTERN.test(fs.readFileSync(filePath, 'utf8'))) {
      return filePath;
    }
  }
  return '';
}

function ensureClaudeConfigTracked(event, command) {
  const action = gitAction(command);
  if (!action) return event;

  const root = gitRoot(action.cwd);
  if (!root) return event;

  const claudeDir = path.join(root, '.claude');
  if (!fs.existsSync(claudeDir)) return event;

  const secretFile = firstSecret(claudeDir);
  if (secretFile) {
    return {
      ...event,
      continue: false,
      reason: `[AIaC Git Guard] Phát hiện nội dung giống secret trong ${secretFile}. Dừng commit/push .claude để Sếp kiểm tra trước.`,
    };
  }

  if (action.action === 'commit') {
    spawnSync('git', ['-C', root, 'add', '-f', '.claude'], { encoding: 'utf8', timeout: 10000 });
    process.stderr.write(`[AIaC Git Guard] Đã stage ${claudeDir}\n`);
  }

  if (action.action === 'push') {
    const status = spawnSync('git', ['-C', root, 'status', '--porcelain', '--', '.claude'], { encoding: 'utf8', timeout: 5000 }).stdout.trim();
    if (status) {
      return {
        ...event,
        continue: false,
        reason: `[AIaC Git Guard] ${claudeDir} còn thay đổi chưa commit. Commit .claude trước rồi push lại.`,
      };
    }
  }

  return event;
}

module.exports = (ctx) => {
  ctx.provide('workflow', 'dev-flow', {
    steps: ['idea', 'req', 'spec', 'plan', 'build', 'test', 'review', 'ship'],
    mandatoryDocs: ['IDEA.md', 'REQUIREMENTS.md', 'SPEC.md', 'ARCH.md', 'README.md', 'DEPLOY_GUIDE.md', 'CHANGELOGS.md']
  });

  ctx.on('tool/pre-execute', async (event, next) => {
    if (event.tool === 'Bash' && typeof event.input?.command === 'string') {
      const guarded = ensureClaudeConfigTracked(event, event.input.command);
      if (guarded.continue === false) return guarded;
    }
    return next(event);
  }, { prepend: true });
};
