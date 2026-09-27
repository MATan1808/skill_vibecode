'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== Testing AutoHarness Distiller (P1 Isolation) ===');
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}\n  ${err.stack}`);
    failed++;
  }
}

(async () => {
  const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-distiller-test-')));
  const oldEnv = { ...process.env };
  const oldCwd = process.cwd();

  // Cô lập toàn bộ HOME và data trước require: constants được tính lúc module load.
  process.env.HOME = sandbox;
  process.env.USERPROFILE = sandbox;
  process.env.AIAC_ROOT = sandbox;
  // Initialize AIAC data structure in sandbox
  const harnessDir = path.join(sandbox, '360org', 'plugins', '360-harness');
  const dataDir = path.join(harnessDir, 'data');
  const refDir = path.join(harnessDir, 'prompts', 'references');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(refDir, { recursive: true });

  process.chdir(sandbox);

  // Load distiller with isolated env
  const distiller = require(path.join(oldCwd, '360org/plugins/360-harness/scripts/aiac-auto-distiller.js'));

  try {
    await test('findLatestSessionFile isolated and safe', async () => {
      // should return null when .claude/projects missing
      process.env.HOME = sandbox;
      assert.strictEqual(distiller.findLatestSessionFile(sandbox), null);

      const projectsDir = path.join(sandbox, '.claude', 'projects');
      const projDir = path.join(projectsDir, sandbox.replace(/\//g, '-'));
      fs.mkdirSync(projDir, { recursive: true });

      // empty dir -> null
      assert.strictEqual(distiller.findLatestSessionFile(sandbox), null);

      // dummy jsonl
      const dummy = path.join(projDir, 'dummy.jsonl');
      fs.writeFileSync(dummy, '{}');
      assert.strictEqual(distiller.findLatestSessionFile(sandbox), dummy);

      // traversal fails
      assert.strictEqual(distiller.findLatestSessionFile('../other-dir'), null);
    });

    await test('hasSecret catches bearer and tokens', async () => {
      // Access via reflection if not exported, or just test via recordProposedLesson
      // Since hasSecret isn't exported, we test it through recordProposedLesson
      const lessonWithBearer = {
        title: 'API fix',
        domain: '360-harness',
        contentHash: 'hash1',
        detail: 'use bearer: "ey12345678901234567890"'
      };

      const res = distiller.recordProposedLesson(lessonWithBearer);
      assert.strictEqual(res, false, 'Should reject secret bearer token');

      const cleanLesson = {
        title: 'API fix',
        domain: '360-harness',
        contentHash: 'hash2',
        detail: 'check null before parsing JSON'
      };
      const cleanRes = distiller.recordProposedLesson(cleanLesson);
      assert.strictEqual(cleanRes, true, 'Should accept clean lesson');

      const queue = distiller.getPendingProposals();
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].contentHash, 'hash2');
    });

    await test('Atomic and fault-tolerant approval', async () => {
      // Clear queue
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), '[]', 'utf8');

      distiller.recordProposedLesson({
        title: 'Safe lesson',
        domain: '360-harness',
        contentHash: 'hash-atomic',
        detail: 'use exact equality'
      });

      const q1 = distiller.getPendingProposals();
      assert.strictEqual(q1.length, 1);
      const id = q1[0].id;

      // Simulate ledger write failure by making it a directory
      const ledgerPath = path.join(dataDir, 'learning-ledger.jsonl');
      fs.rmSync(ledgerPath, { force: true });
      fs.mkdirSync(ledgerPath);

      const res = distiller.approveProposal(id);
      assert.strictEqual(res.approved, 0, 'Should not approve if ledger append fails');

      // Queue should remain intact!
      const q2 = distiller.getPendingProposals();
      assert.strictEqual(q2.length, 1, 'Queue must not drop unapproved proposal');
      assert.strictEqual(q2[0].id, id);

      // Fix ledger
      fs.rmSync(ledgerPath, { recursive: true, force: true });

      const res2 = distiller.approveProposal(id);
      assert.strictEqual(res2.approved, 1, 'Should approve after ledger is writable');

      const q3 = distiller.getPendingProposals();
      assert.strictEqual(q3.length, 0, 'Queue should be empty after successful approval');
    });



    await test('Bounded tail read protects memory', async () => {
      const transcriptPath = path.join(sandbox, 'huge.jsonl');
      const lines = [];
      for (let i = 0; i < 2000; i++) {
        lines.push('{"type": "user_message", "message": {"content": "turn ' + i + '"}}');
      }
      fs.writeFileSync(transcriptPath, lines.join('\n'), 'utf8');


      // Doesn't matter what extract returns, what matters is the events count was capped at 1500.
      const readEvents = distiller.readRecentSessionEvents(transcriptPath, 1500);
      assert.strictEqual(readEvents.length, 1500);
      assert.ok(readEvents[0].message.content.includes('turn 500'));
    });

    await test('Corrupt queue fail-closed and domain traversal blocked', async () => {
      // Setup bad domain
      const res1 = distiller.recordProposedLesson({
        title: 'a',
        domain: '../other',
        contentHash: 'hash-traversal',
        detail: 'b'
      });
      assert.strictEqual(res1, false, 'Should block path traversal domain');

      // Valid domain, valid queue
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), '[]', 'utf8');
      const res2 = distiller.recordProposedLesson({
        title: 'a',
        domain: '360-harness',
        contentHash: 'hash-valid-1',
        detail: 'b'
      });
      assert.strictEqual(res2, true);
      assert.strictEqual(distiller.getPendingProposals().length, 1);

      // Corrupt the queue
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), '{ broken }', 'utf8');
      const res3 = distiller.recordProposedLesson({
        title: 'a',
        domain: '360-harness',
        contentHash: 'hash-valid-2',
        detail: 'b'
      });
      assert.strictEqual(res3, false, 'Should fail closed (not overwrite) when queue corrupt');

      const q = distiller.getPendingProposals();
      assert.strictEqual(q, null);
    });

    await test('autoDistill handles corrupt queue gracefully', async () => {
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), 'not an array', 'utf8');
      const res = await distiller.autoDistill();
      assert.strictEqual(typeof res.pendingTotal, 'number');
      assert.strictEqual(res.pendingTotal, 0);
    });

    await test('Idempotent rejection', async () => {
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), '[]', 'utf8');
      distiller.recordProposedLesson({
        title: 'Test reject',
        domain: '360-harness',
        contentHash: 'hash-reject',
        detail: 'b'
      });
      const q = distiller.getPendingProposals();
      const id = q[0].id;

      // First reject
      const res1 = distiller.rejectProposal(id);
      assert.strictEqual(res1.rejected, 1);

      // Queue is now empty
      assert.strictEqual(distiller.getPendingProposals().length, 0);

      // Simulate partial failure where it's in ledger but still in queue
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), JSON.stringify([{
        id: id,
        title: 'Test reject',
        domain: '360-harness',
        contentHash: 'hash-reject',
        detail: 'b'
      }]), 'utf8');

      const res2 = distiller.rejectProposal(id);
      assert.strictEqual(res2.rejected, 1);

      const ledgerContent = fs.readFileSync(path.join(dataDir, 'learning-ledger.jsonl'), 'utf8');
      const rejectLines = ledgerContent.split('\n').filter(l => l.includes('REJECTED') && l.includes(id));
      assert.strictEqual(rejectLines.length, 1, 'Should be idempotent, only one REJECTED line in ledger');
    });

    await test('Idempotent approval', async () => {
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), '[]', 'utf8');
      distiller.recordProposedLesson({
        title: 'Test approve',
        domain: '360-harness',
        contentHash: 'hash-approve',
        detail: 'b'
      });
      const q = distiller.getPendingProposals();
      const id = q[0].id;

      // First approve
      const res1 = distiller.approveProposal(id);
      assert.strictEqual(res1.approved, 1);

      // Put it back in queue
      fs.writeFileSync(path.join(dataDir, 'pending-proposals.json'), JSON.stringify([q[0]]), 'utf8');

      // Second approve
      const res2 = distiller.approveProposal(id);
      assert.strictEqual(res2.approved, 1);

      const ledgerContent = fs.readFileSync(path.join(dataDir, 'learning-ledger.jsonl'), 'utf8');
      const approveLines = ledgerContent.split('\n').filter(l => l.includes('APPROVED') && l.includes(id));
      assert.strictEqual(approveLines.length, 1, 'Should be idempotent, only one APPROVED line in ledger');
    });

    await test('extractLessonsFromEvents deduplicates USER_DIRECTIVE inside same batch', async () => {
      const events = [
        { type: 'user_message', message: { content: 'tuyệt đối không dùng var' } },
        { type: 'user_message', message: { content: 'tuyệt đối không dùng var' } }, // Exact duplicate
        { type: 'user_message', message: { content: 'tuyệt đối không dùng console.log' } }
      ];

      const candidates = distiller.extractLessonsFromEvents(events);
      // We expect 2 candidates, not 3
      assert.strictEqual(candidates.length, 2);
      assert.strictEqual(candidates[0].contentHash !== candidates[1].contentHash, true);
    });

    await test('explicit transcript chỉ nhận đúng workspace', async () => {
      const projectDir = path.join(sandbox, '.claude', 'projects', sandbox.replace(/\//g, '-'));
      fs.mkdirSync(projectDir, { recursive: true });
      const acceptedTranscript = path.join(projectDir, 'explicit.jsonl');
      fs.writeFileSync(acceptedTranscript, JSON.stringify({ type: 'user_message', message: { content: 'bắt buộc harness kiểm tra null' } }) + '\n', 'utf8');

      const accepted = await distiller.autoDistill(acceptedTranscript);
      assert.strictEqual(accepted.totalFound > 0, true);
      assert.strictEqual(accepted.proposed > 0, true);

      const foreignTranscript = path.join(sandbox, 'foreign.jsonl');
      fs.writeFileSync(foreignTranscript, '{}\n', 'utf8');
      const rejected = await distiller.autoDistill(foreignTranscript);
      assert.strictEqual(rejected.proposed, 0);
      assert.strictEqual(rejected.totalFound, undefined);
    });

    await test('readRecentSessionEvents từ chối giới hạn không hợp lệ', async () => {
      const transcript = path.join(sandbox, 'invalid-limit.jsonl');
      fs.writeFileSync(transcript, '{}\n', 'utf8');
      assert.deepStrictEqual(distiller.readRecentSessionEvents(transcript, 0), []);
      assert.deepStrictEqual(distiller.readRecentSessionEvents(transcript, 1.5), []);
    });

    console.log(`\nPassed: ${passed}`);
    if (failed > 0) {
      console.log(`Failed: ${failed}`);
      process.exitCode = 1;
    }
  } finally {
    process.chdir(oldCwd);
    for (const key of ['HOME', 'USERPROFILE', 'AIAC_ROOT']) {
      if (oldEnv[key] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[key];
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
})();
