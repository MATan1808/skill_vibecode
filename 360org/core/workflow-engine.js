'use strict';

/**
 * AIaC Resumable Workflow Engine (v3.8.0)
 * Lấy cảm hứng từ Claude Code Harness s16 (Workflow Runtime)
 * Hỗ trợ deterministic orchestration:
 *  - pipeline(items, ...stages): Pipeline không barrier giữa các items
 *  - parallel(thunks): Barrier concurrent execution
 *  - agent(prompt, opts): Subagent dispatch with structured JSON schema & semantic hash caching
 *  - Journaling: Lưu kết quả từng bước vào .runtime/<runId>.journal.jsonl
 *  - Resume: Re-run với resumeFromRunId để bypass các bước không đổi (0 token, 0ms)
 *
 * ponytail: Zero external dependencies, pure Node.js stdlib crypto/fs/path.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function stableHash(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex').slice(0, 16);
}

class WorkflowJournal {
  constructor(journalPath) {
    this.journalPath = journalPath;
    this.cache = new Map();
    this._fd = null;
    this._load();
  }

  _load() {
    if (fs.existsSync(this.journalPath)) {
      const lines = fs.readFileSync(this.journalPath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry && entry.key) {
            this.cache.set(entry.key, entry.value);
          }
        } catch (_) {}
      }
    }
  }

  record(key, value) {
    this.cache.set(key, value);
    try {
      const dir = path.dirname(this.journalPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.journalPath, JSON.stringify({ key, value, ts: Date.now() }) + '\n');
    } catch (err) {
      process.stderr.write(`[AIaC WorkflowJournal Error] Ghi journal thất bại: ${err.message}\n`);
    }
  }

  get(key) {
    return this.cache.has(key) ? this.cache.get(key) : undefined;
  }
}

class WorkflowContext {
  constructor(options = {}) {
    this.runId = options.runId || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.runtimeDir = options.runtimeDir || path.join(process.cwd(), '.runtime');
    this.journal = new WorkflowJournal(path.join(this.runtimeDir, `${this.runId}.journal.jsonl`));
    this.agentRunner = options.agentRunner || (async (p) => ({ output: `Processed: ${p}` }));
    this.currentPhase = 'init';
    this.logs = [];
    this.stats = { totalAgents: 0, cachedAgents: 0 };
  }

  phase(name) {
    this.currentPhase = name;
  }

  log(message) {
    this.logs.push(`[${this.currentPhase}] ${message}`);
  }

  computeKey(kind, label, prompt, schema) {
    const basis = `${kind}|${label || ''}|${prompt}|${JSON.stringify(schema || {})}`;
    return `${kind}-${stableHash(basis)}`;
  }

  async agent(prompt, opts = {}) {
    // AIaC custom model mapping injection
    if (opts.role) {
      const routeMap = { review: "claude-VIP", code: "antigrafity-claude-3.8-flash", fix: "antigrafity-claude-3.8-flash", plan: "Claude-Pro-Pack", idea: "Claude-Pro-Pack" };
      opts.model = routeMap[opts.role.toLowerCase()] || opts.model;
    }

    const label = opts.label || 'agent';
    const schema = opts.schema || null;
    const key = this.computeKey('agent', label, prompt, schema);

    const cached = this.journal.get(key);
    if (cached !== undefined) {
      this.stats.cachedAgents++;
      return cached;
    }

    this.stats.totalAgents++;
    const res = await this.agentRunner(prompt, opts);
    this.journal.record(key, res);
    return res;
  }

  async pipeline(items, ...stages) {
    const runItem = async (item, idx) => {
      let val = item;
      for (const stage of stages) {
        val = await stage(val, item, idx);
      }
      return val;
    };
    return Promise.all(items.map((it, i) => runItem(it, i)));
  }

  async parallel(thunks) {
    return Promise.all(thunks.map(fn => Promise.resolve().then(() => fn())));
  }
}

class WorkflowEngine {
  constructor(options = {}) {
    this.runtimeDir = options.runtimeDir || path.join(process.cwd(), '.runtime');
    this.registeredWorkflows = new Map();
  }

  register(name, meta, scriptFn) {
    if (!name || typeof scriptFn !== 'function') {
      throw new Error('Workflow name và script function là bắt buộc');
    }
    this.registeredWorkflows.set(name, { meta: meta || {}, scriptFn });
  }

  async run(name, args = {}, options = {}) {
    const wf = this.registeredWorkflows.get(name);
    if (!wf) {
      throw new Error(`Workflow "${name}" chưa được đăng ký trong AIaC Engine`);
    }

    const runId = options.resumeFromRunId || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ctx = new WorkflowContext({
      runId,
      runtimeDir: this.runtimeDir,
      agentRunner: options.agentRunner,
    });

    const result = await wf.scriptFn(ctx, args);
    return {
      runId,
      result,
      stats: ctx.stats,
      logs: ctx.logs,
    };
  }
}

module.exports = { WorkflowEngine, WorkflowContext, WorkflowJournal };
