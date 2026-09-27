#!/usr/bin/env node
'use strict';

/**
 * AIaC Goal Evaluator & Autonomous Stop Gate (v3.8.0)
 * Lấy cảm hứng từ Claude Code Harness s17 (Goal Loop)
 *
 * Nhiệm vụ:
 * 1. Đọc trạng thái Goal từ session/state (hoặc file `.claude/aiac/goal.json`).
 * 2. Khi Agent kết thúc turn (sự kiện hook Stop):
 *    - Nếu Goal đang active: Kiểm tra xem bằng chứng nghiệm thu (test pass, exit 0, HTTP 200, lint ok)
 *      đã xuất hiện trong output hội thoại gần nhất hay chưa.
 *    - Nếu CHƯA có bằng chứng: Trả về `{ continue: false, reason: "..." }` để Agent tiếp tục turn mới.
 *    - Nếu ĐÃ ĐỦ bằng chứng: Đóng Goal thành công và cho phép dừng phiên.
 *
 * ponytail: Pure regex/heuristic log scanning, không làm chậm session.
 */

const fs = require('fs');
const path = require('path');

function getGoalFile() {
  const cwd = process.cwd();
  return path.join(cwd, '.claude', 'aiac', 'goal.json');
}

function readActiveGoal() {
  const goalFile = getGoalFile();
  if (!fs.existsSync(goalFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(goalFile, 'utf8'));
    if (data && data.active && data.condition) {
      return data;
    }
  } catch (_) {}
  return null;
}

function evaluateGoalCompletion(goal, contextText) {
  if (!goal || typeof goal.condition !== 'string' || !goal.condition.trim()) {
    return { completed: false, reason: 'Mục tiêu không có điều kiện kiểm chứng.' };
  }

  if (typeof contextText !== 'string') {
    return { completed: false, reason: 'Điều kiện hoặc bằng chứng không hợp lệ.' };
  }
  const condition = goal.condition.toLowerCase();
  const text = contextText.toLowerCase();

  // 1. Nếu goal yêu cầu exit 0 / test pass
  if (condition.includes('pass') || condition.includes('exit 0') || condition.includes('exit code 0') || condition.includes('test')) {
    const hasSuccessIndicator =
      text.includes('passed') ||
      text.includes('100% pass') ||
      text.includes('exit code 0') ||
      text.includes('0 failures') ||
      text.includes('all tests pass') ||
      text.includes('test result: ok') ||
      text.includes('pass (target');

    const failureText = text.replace(/\b0\s+(?:failed|failures?)\b|\b(?:failed|failures?)\s*:\s*0\b/g, '');
    const hasFailureIndicator = /\b(?:fail(?:ed|ure|ures)?|assertionerror|error|traceback)\b/.test(failureText);

    if (hasSuccessIndicator && !hasFailureIndicator) {
      return { completed: true, reason: 'Phát hiện bằng chứng test/run thành công với exit code 0.' };
    }
    return {
      completed: false,
      reason: `[AIaC Goal Gate] Mục tiêu "${goal.condition}" chưa có bằng chứng thực thi thành công (test pass / exit code 0) trong phiên. Vui lòng chạy lệnh kiểm thử để xác minh trước khi hoàn tất.`
    };
  }

  // 2. Nếu goal yêu cầu HTTP 200 / live check
  if (condition.includes('200') || condition.includes('http') || condition.includes('curl')) {
    if (text.includes('http/1.1 200') || text.includes('http/2 200') || text.includes('200 ok')) {
      return { completed: true, reason: 'Phát hiện response HTTP 200 OK.' };
    }
    return {
      completed: false,
      reason: `[AIaC Goal Gate] Mục tiêu "${goal.condition}" chưa ghi nhận phản hồi HTTP 200 OK từ server. Vui lòng curl/request kiểm tra.`
    };
  }

  return { completed: false, reason: 'Điều kiện này chưa có bộ kiểm chứng.' };
}

async function handleGoalStopHook() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf8');
  } catch {}

  let payload = {};
  try {
    payload = JSON.parse(rawInput);
  } catch {}

  const goal = readActiveGoal();
  if (!goal) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  // Thu thập text hội thoại hoặc output gần nhất từ payload
  const contextText = JSON.stringify(payload);
  const evaluation = evaluateGoalCompletion(goal, contextText);

  if (!evaluation.completed) {
    // Tăng turn count và chặn stop
    goal.evalCount = (goal.evalCount || 0) + 1;
    if (goal.evalCount <= (goal.maxTurns || 5)) {
      try {
        fs.writeFileSync(getGoalFile(), JSON.stringify(goal, null, 2));
      } catch (_) {}

      process.stdout.write(JSON.stringify({ decision: 'block', reason: evaluation.reason }));
      return;
    }
  }

  // Goal hoàn tất hoặc chạm max turns, clear goal
  try {
    goal.active = false;
    if (evaluation.completed) {
      goal.completedAt = new Date().toISOString();
    } else {
      delete goal.completedAt;
      goal.exhaustedAt = new Date().toISOString();
    }
    fs.writeFileSync(getGoalFile(), JSON.stringify(goal, null, 2));
  } catch (_) {}

  process.stdout.write(JSON.stringify({ continue: true }));
}

if (require.main === module) {
  handleGoalStopHook().catch(err => {
    process.stderr.write(`[AIaC Goal Gate Error] ${err.message}\n`);
    process.stdout.write(JSON.stringify({ continue: true }));
  });
}

module.exports = { evaluateGoalCompletion, readActiveGoal };
