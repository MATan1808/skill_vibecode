'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { EventEmitter } = require('events');

const root = path.resolve(__dirname, '..');
const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aiac-hooks-audit-')));
const oldCwd = process.cwd();
const oldEnv = { ...process.env };
const stdout = process.stdout.write;
const stderr = process.stderr.write;
let passed = 0;
async function test(name, check) {
  await check();
  passed++;
  console.log(`✓ ${name}`);
}

(async () => {
  try {
    process.env.HOME = sandbox;
    process.env.USERPROFILE = sandbox;
    process.chdir(sandbox);
    const hooks = path.join(root, '360org/scripts/hooks');
    const stop = require(path.join(hooks, 'aiac-stop-pipeline.js'));
    const { evaluateGoalCompletion: evaluate } = require(path.join(hooks, 'aiac-goal-evaluator.js'));
    const projectDir = path.join(sandbox, '.claude/projects', sandbox.replace(/\//g, '-'));
    fs.mkdirSync(projectDir, { recursive: true });
    const transcript = path.join(projectDir, 'session có dấu.jsonl');
    fs.writeFileSync(transcript, '{}\n');
    const foreign = path.join(sandbox, '.claude/projects/other/session.jsonl');
    fs.mkdirSync(path.dirname(foreign), { recursive: true });
    fs.writeFileSync(foreign, '{}\n');
    const symlink = path.join(projectDir, 'escape.jsonl');
    fs.symlinkSync(foreign, symlink);
    const directory = path.join(projectDir, 'directory.jsonl');
    fs.mkdirSync(directory);

    async function invoke(payload, spawnChild) {
      let output = '';
      let errors = '';
      process.stdout.write = data => { output += data; return true; };
      process.stderr.write = data => { errors += data; return true; };
      try {
        await stop.main(payload, spawnChild);
        return { output: JSON.parse(output), errors };
      } finally {
        process.stdout.write = stdout;
        process.stderr.write = stderr;
      }
    }
    await test('Chấp nhận transcript đúng workspace', () => assert(stop.isCurrentProjectTranscript(transcript)));
    for (const [label, candidate] of [
      ['workspace khác', foreign], ['symlink ra ngoài', symlink],
      ['đường dẫn tương đối', 'session.jsonl'], ['thư mục giả file', directory],
      ['file không tồn tại', path.join(projectDir, 'missing.jsonl')], ['kiểu dữ liệu sai', {}]
    ]) {
      await test(`Chặn ${label}`, () => assert.strictEqual(stop.isCurrentProjectTranscript(candidate), false));
    }
    for (const payload of ['{}', 'null', '{broken', JSON.stringify({ transcript_path: foreign })]) {
      await test(`Stop không fallback: ${payload}`, async () => {
        let calls = 0;
        const result = await invoke(payload, () => { calls++; });
        assert.strictEqual(calls, 0);
        assert.deepStrictEqual(result.output, { continue: true, suppressOutput: true });
      });
    }
    await test('Stop truyền nguyên vẹn argv, cwd và unref', async () => {
      let unref = false;
      let calls = 0;
      await invoke(JSON.stringify({ transcript_path: transcript }), (command, args, options) => {
        calls++;
        assert.strictEqual(command, process.execPath);
        assert.deepStrictEqual(args, [path.join(root, '360org/plugins/360-harness/scripts/aiac-auto-distiller.js'), 'distill', transcript]);
        assert.strictEqual(options.cwd, sandbox);
        assert.strictEqual(options.detached, true);
        const child = new EventEmitter();
        child.unref = () => { unref = true; };
        return child;
      });
      assert.strictEqual(calls, 1);
      assert(unref);
    });
    await test('Lỗi spawn đồng bộ không chặn Stop', async () => {
      const result = await invoke(JSON.stringify({ transcript_path: transcript }), () => { throw new Error('fixture spawn failure'); });
      assert(result.output.continue);
      assert(result.errors.includes('fixture spawn failure'));
    });
    await test('Lỗi spawn bất đồng bộ được xử lý', async () => {
      const result = await invoke(JSON.stringify({ transcript_path: transcript }), () => {
        const child = new EventEmitter();
        child.unref = () => child.emit('error', new Error('fixture async failure'));
        return child;
      });
      assert(result.output.continue);
      assert(result.errors.includes('fixture async failure'));
    });
    for (const payload of ['{"trigger":"manual"}', 'null', '{broken']) {
      await test(`PreCompact schema và dấu mốc: ${payload}`, () => {
        const result = spawnSync(process.execPath, [path.join(hooks, 'aiac-compact-lite.js')], {
          cwd: sandbox, env: process.env, input: payload, encoding: 'utf8', timeout: 5000
        });
        assert.strictEqual(result.status, 0, result.stderr);
        assert.strictEqual(result.stderr, '');
        assert.deepStrictEqual(JSON.parse(result.stdout), { continue: true, suppressOutput: true });
        const marker = JSON.parse(fs.readFileSync(path.join(sandbox, '.claude/aiac/sessions/last-compact.json'), 'utf8'));
        assert.strictEqual(marker.status, 'precompact-recorded');
        assert.strictEqual(marker.source, payload.includes('manual') ? 'manual' : 'auto');
        assert(!Number.isNaN(Date.parse(marker.recordedAt)));
      });
    }
    for (const [condition, text, completed] of [
      ['pass', '10 passed; 0 failed', true], ['pass', 'Passed: 10; Failed: 0', true],
      ['pass', '10 passed; Failed: 2', false], ['pass', 'passed; command failed', false],
      ['unknown', 'passed', false], ['', 'passed', false],
      ['pass', 'not verified', false], ['http', 'HTTP/2 200 OK', true],
      ['http', 'HTTP/2 500', false], ['exit 0', 'exit code 0', true]
    ]) {
      await test(`Goal ${condition}: ${text}`, () => assert.strictEqual(evaluate({ condition }, text).completed, completed));
    }
    await test('Max turns là exhausted, không phải completed', () => {
      const goalPath = path.join(sandbox, '.claude/aiac/goal.json');
      fs.writeFileSync(goalPath, JSON.stringify({ active: true, condition: 'unknown', evalCount: 1, maxTurns: 1 }));
      const result = spawnSync(process.execPath, [path.join(hooks, 'aiac-goal-evaluator.js')], {
        cwd: sandbox, env: process.env, input: '{}', encoding: 'utf8', timeout: 5000
      });
      assert.strictEqual(result.status, 0, result.stderr);
      const goal = JSON.parse(fs.readFileSync(goalPath, 'utf8'));
      assert.strictEqual(goal.completedAt, undefined);
      assert(goal.exhaustedAt);
    });
    await test('Overlay chỉ có một Stop pipeline và giữ PreCompact', () => {
      const overlay = JSON.parse(fs.readFileSync(path.join(root, 'config/claude/settings.overlay.json'), 'utf8'));
      const stops = overlay.hooks.Stop.flatMap(entry => entry.hooks);
      assert.strictEqual(stops.length, 1);
      assert(stops[0].command.endsWith('aiac-stop-pipeline.js'));
      assert(overlay.hooks.PreCompact[0].hooks[0].command.endsWith('aiac-compact-lite.js'));
    });
    console.log(`Passed: ${passed}\nFailed: 0`);
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
    process.chdir(oldCwd);
    for (const key of ['HOME', 'USERPROFILE']) {
      if (oldEnv[key] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[key];
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
