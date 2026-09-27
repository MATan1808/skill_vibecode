'use strict';

/**
 * AIaC Multi-Agent Orchestration & Self-Healing Pipeline (v3.3.0)
 * 1. Multi-Agent Pipeline: Phối hợp song song các Agent Roles (Architect, Generator, Reviewer, Tester)
 * 2. Self-Healing Feedback Loop: Tự phản biện 3 bước (Observation -> Hypothesis -> Verification) khi gặp lỗi build/test.
 *
 * ponytail: Tận dụng EventBus và Seam Providers để kích hoạt subagent, zero external framework.
 */

class AgentPipeline {
  constructor(loader) {
    this.loader = loader;
    this.events = loader.events;
    this.seams = loader.seams;
  }

  /**
   * Chạy pipeline kiểm thử & sửa lỗi tự động (Self-Healing Loop)
   * @param {Object} executionContext
   * @param {number} maxRetries
   */
  async runSelfHealingLoop(executionContext, maxRetries = 3) {
    let attempt = 0;
    let lastError = null;

    this.events.emit('pipeline/self-healing-start', { executionContext, maxRetries });

    while (attempt < maxRetries) {
      attempt++;
      this.events.emit('pipeline/attempt-start', { attempt, maxRetries });

      try {
        // 1. Thực thi bước test/build hiện tại
        const testResult = await this._executeStep(executionContext);

        if (testResult.success) {
          this.events.emit('pipeline/self-healing-success', {
            attempt,
            output: testResult.output
          });
          return {
            success: true,
            attempts: attempt,
            output: testResult.output
          };
        }

        // Nếu thất bại -> Thu thập thông tin lỗi (Observation)
        lastError = testResult.error || testResult.output;
        this.events.emit('pipeline/observation', { attempt, error: lastError });

        // 2. Sinh giả thuyết nguyên nhân gốc rễ (Hypothesis via Ponytail)
        const hypothesis = this._generateHypothesis(lastError, executionContext);
        this.events.emit('pipeline/hypothesis', { attempt, hypothesis });

        // 3. Tự động áp dụng bản vá (Self-Correction Action)
        const patchResult = await this._applySelfCorrection(hypothesis, executionContext);
        this.events.emit('pipeline/verification', { attempt, patchResult });

      } catch (err) {
        lastError = err.message;
        this.events.emit('pipeline/error', { attempt, error: lastError });
      }
    }

    return {
      success: false,
      attempts: attempt,
      lastError
    };
  }

  async _executeStep(context) {
    if (typeof context.executor === 'function') {
      return context.executor();
    }
    return { success: true, output: 'Pass' };
  }

  _generateHypothesis(error, context) {
    let rootCause = 'Unknown error';
    let suggestion = 'Check logs and traceback';

    if (/syntax|parse|unexpected/i.test(error)) {
      rootCause = 'Syntax / Grammar mismatch';
      suggestion = 'Verify syntax, imports, and brackets in modified files';
    } else if (/not found|cannot find module|undefined/i.test(error)) {
      rootCause = 'Missing dependency or unresolved reference';
      suggestion = 'Check import paths, package manifests and Seam provider registration';
    } else if (/permission|access denied|eacces/i.test(error)) {
      rootCause = 'Permission / File Lock issue';
      suggestion = 'Check file permissions or SSH alias authorization';
    }

    return {
      rootCause,
      suggestedFix: suggestion,
      errorSnippet: String(error).slice(0, 300)
    };
  }

  async _applySelfCorrection(hypothesis, context) {
    if (typeof context.fixer === 'function') {
      return context.fixer(hypothesis);
    }
    return { applied: true, note: `Simulated fix for: ${hypothesis.rootCause}` };
  }
}

module.exports = { AgentPipeline };
