'use strict';

/**
 * AIaC Event Bus: Micro-kernel Event Lifecycle Middleware
 * Hỗ trợ 4 chế độ dispatch lấy cảm hứng từ Cordis:
 * 1. emit: Quan sát thụ động (listeners observe in registration order, không block)
 * 2. waterfall: Around-middleware pipeline (cho phép rewrite payload hoặc short-circuit qua next())
 * 3. parallel: Chạy bất đồng bộ đồng thời tất cả listeners
 * 4. serial: Chạy tuần tự từng listener có await
 *
 * ponytail: Tối giản, zero external dependencies, hoạt động độc lập trong Node.js runtime.
 */

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Đăng ký một event listener với chế độ effect có khả năng hoàn nguyên (disposer).
   * @param {string} eventName Tên event
   * @param {Function} handler Callback xử lý
   * @param {Object} options Tuỳ chọn ({ prepend: boolean })
   * @returns {Function} Disposer function để unregister
   */
  on(eventName, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Handler cho event "${eventName}" phải là một Function.`);
    }

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }

    const list = this._listeners.get(eventName);
    if (options.prepend) {
      list.unshift(handler);
    } else {
      list.push(handler);
    }

    // Trả về hàm Disposer để unwind effect
    return () => {
      const idx = list.indexOf(handler);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        this._listeners.delete(eventName);
      }
    };
  }

  /**
   * Dispatch kiểu Emit: Gửi sự kiện cho các listener quan sát, không đợi kết quả.
   */
  emit(eventName, ...args) {
    const list = this._listeners.get(eventName) || [];
    for (const handler of list) {
      try {
        handler(...args);
      } catch (err) {
        process.stderr.write(`\x1b[31m[AIaC EventBus emit error] ${eventName}:\x1b[0m ${err.message}\n`);
      }
    }
  }

  /**
   * Dispatch kiểu Parallel: Chạy đồng thời toàn bộ listeners qua Promise.all.
   */
  async parallel(eventName, ...args) {
    const list = this._listeners.get(eventName) || [];
    const tasks = list.map(handler => Promise.resolve().then(() => handler(...args)));
    return Promise.all(tasks);
  }

  /**
   * Dispatch kiểu Serial: Chạy tuần tự từng listener.
   */
  async serial(eventName, ...args) {
    const list = this._listeners.get(eventName) || [];
    const results = [];
    for (const handler of list) {
      const res = await handler(...args);
      results.push(res);
    }
    return results;
  }

  /**
   * Dispatch kiểu Waterfall (Around-middleware):
   * Mỗi listener nhận (...args, next).
   * Gọi next() để chuyển quyền cho listener tiếp theo.
   * Không gọi next() sẽ ngắt chuỗi (short-circuit).
   * Giá trị trả về lan truyền ngược qua return của next().
   */
  async waterfall(eventName, initialPayload, ...extraArgs) {
    const list = this._listeners.get(eventName) || [];
    let index = 0;

    const dispatch = async (currentPayload) => {
      if (index >= list.length) {
        return currentPayload;
      }
      const handler = list[index++];
      let nextCalled = false;

      const next = async (modifiedPayload) => {
        nextCalled = true;
        const payloadToPass = modifiedPayload !== undefined ? modifiedPayload : currentPayload;
        return dispatch(payloadToPass);
      };

      const result = await handler(currentPayload, next, ...extraArgs);
      // Nếu handler trả về kết quả cụ thể mà không gọi next(), xem như short-circuit và dùng kết quả đó
      if (!nextCalled && result !== undefined) {
        return result;
      }
      return result !== undefined ? result : currentPayload;
    };

    return dispatch(initialPayload);
  }

  /**
   * Xoá sạch toàn bộ listeners.
   */
  clear() {
    this._listeners.clear();
  }
}

module.exports = { EventBus };
