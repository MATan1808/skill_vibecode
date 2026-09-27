'use strict';

/**
 * AIaC v3.8.0 Harness Upgrade Verification Suite
 * Kiểm thử 3 module nâng cấp cốt lõi:
 * 1. Resumable Workflow Engine with Semantic Hash Journaling (s16)
 * 2. Goal Loop Evaluator Autonomous Stop Gate (s17)
 * 3. Context Pruner & Smart Compactor (s08)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WorkflowEngine } = require('../360org/core/workflow-engine');
const { evaluateGoalCompletion } = require('../360org/scripts/hooks/aiac-goal-evaluator');
const { pruneLargeOutput } = require('../360org/scripts/hooks/aiac-compact-lite');

async function testHarnessUpgrades() {
  process.stdout.write('\n\x1b[34m[AIaC v3.8.0 Harness Upgrade Tests]\x1b[0m\n');

  // 1. TEST RESUMABLE WORKFLOW ENGINE
  const tmpRuntime = fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-wf-test-'));
  try {
    const engine = new WorkflowEngine({ runtimeDir: tmpRuntime });
    let agentCallCount = 0;

    const mockRunner = async (prompt) => {
      agentCallCount++;
      return { answer: `Result for ${prompt}` };
    };

    engine.register('code-review', { phases: ['Review', 'Verify'] }, async (ctx, args) => {
      ctx.phase('Review');
      const dimensions = args.dimensions || ['bugs', 'perf'];
      const reviews = await ctx.pipeline(
        dimensions,
        async (dim) => ctx.agent(`Audit ${dim}`, { label: `audit:${dim}` }),
        async (res, dim) => ctx.agent(`Verify ${res.answer}`, { label: `verify:${dim}` })
      );
      return { confirmed: reviews.length };
    });

    // Lần chạy 1: Chạy mới hoàn toàn
    const run1 = await engine.run('code-review', { dimensions: ['security', 'perf'] }, { agentRunner: mockRunner });
    assert.strictEqual(run1.result.confirmed, 2);
    assert.strictEqual(agentCallCount, 4, 'Run 1 must call runner 4 times (2 audit + 2 verify)');
    assert.strictEqual(run1.stats.cachedAgents, 0);

    // Lần chạy 2: Resume với cùng runId
    const run2 = await engine.run('code-review', { dimensions: ['security', 'perf'] }, {
      resumeFromRunId: run1.runId,
      agentRunner: mockRunner
    });
    assert.strictEqual(run2.result.confirmed, 2);
    assert.strictEqual(agentCallCount, 4, 'Run 2 (resumed) must NOT call runner again (100% cache hit)');
    assert.strictEqual(run2.stats.cachedAgents, 4);
    process.stdout.write('  [PASS] \x1b[32mResumable Workflow Engine (s16):\x1b[0m 100% Cache Replay on Resume (PASS)\n');
  } finally {
    fs.rmSync(tmpRuntime, { recursive: true, force: true });
  }

  // 2. TEST GOAL EVALUATOR (s17)
  const goalPass = { condition: 'pytest tests/ exits 0 and all tests pass', active: true };
  const goodOutput = 'Running tests...\n30 passed in 0.45s\nexit code 0';
  const badOutput = 'Running tests...\nAssertionError: failed in auth\nexit code 1';
  const incompleteOutput = 'I have edited the files.';

  const evalGood = evaluateGoalCompletion(goalPass, goodOutput);
  assert.strictEqual(evalGood.completed, true);

  const evalBad = evaluateGoalCompletion(goalPass, badOutput);
  assert.strictEqual(evalBad.completed, false);

  const evalIncomplete = evaluateGoalCompletion(goalPass, incompleteOutput);
  assert.strictEqual(evalIncomplete.completed, false);
  process.stdout.write('  [PASS] \x1b[32mGoal Evaluator Gate (s17):\x1b[0m Accurately judges test completion (PASS)\n');

  // 3. TEST CONTEXT PRUNER (s08)
  const bigLog = Array.from({ length: 100 }, (_, i) => `Log line ${i + 1}`).join('\n');
  const pruned = pruneLargeOutput(bigLog, 20);
  assert.ok(pruned.includes('AIaC Context Pruner'));
  assert.ok(pruned.includes('Log line 1'));
  assert.ok(pruned.includes('Log line 100'));
  assert.ok(!pruned.includes('Log line 50'), 'Intermediate lines must be pruned');
  process.stdout.write('  [PASS] \x1b[32mContext Pruner Middleware (s08):\x1b[0m Pruning huge logs preserves tokens (PASS)\n');

  process.stdout.write('\n\x1b[32m[RESULT] All AIaC v3.8.0 Harness Upgrades Verified Successfully!\x1b[0m\n\n');
}

testHarnessUpgrades().catch(err => {
  process.stderr.write(`\x1b[31mHarness Test Failed:\x1b[0m ${err.stack}\n`);
  process.exit(1);
});
