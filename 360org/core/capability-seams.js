'use strict';

/**
 * AIaC Capability Seams
 * Mô hình 3 vai trò (Tam giác tính năng):
 * 1. Service Definition: Khai báo Interface chuẩn
 * 2. Service Provider: Triển khai thực tế (Local CLI, Docker/Pod, SSH Remote)
 * 3. Consumer: Công cụ hoặc Hook tương tác với Agent/Claude Code
 *
 * ponytail: Zero abstraction thừa, định nghĩa seam dạng adapter đơn giản có thể test được.
 */

class SeamRegistry {
  constructor() {
    this._seams = new Map();
  }

  /**
   * Đăng ký một Service Provider vào Seam.
   * @param {string} seamName Tên Seam (vd: 'shell', 'fs', 'linter', 'database')
   * @param {string} providerName Tên Provider (vd: 'local-exec', 'ssh-cloudpanel', 'k8s-pod')
   * @param {Object} implementation Đối tượng cài đặt các phương thức của Seam
   * @returns {Function} Disposer function
   */
  registerProvider(seamName, providerName, implementation) {
    if (!this._seams.has(seamName)) {
      this._seams.set(seamName, new Map());
    }
    const providers = this._seams.get(seamName);
    providers.set(providerName, implementation);

    return () => {
      providers.delete(providerName);
      if (providers.size === 0) {
        this._seams.delete(seamName);
      }
    };
  }

  /**
   * Lấy Provider mặc định hoặc theo tên.
   * @param {string} seamName
   * @param {string} [providerName]
   * @returns {Object|null}
   */
  getProvider(seamName, providerName) {
    const providers = this._seams.get(seamName);
    if (!providers || providers.size === 0) return null;
    if (providerName) {
      return providers.get(providerName) || null;
    }
    // Trả về provider đầu tiên đăng ký nếu không chỉ định
    return providers.values().next().value || null;
  }

  /**
   * Liệt kê tất cả các Seams & Providers đang active.
   */
  listSeams() {
    const result = {};
    for (const [seamName, providers] of this._seams.entries()) {
      result[seamName] = Array.from(providers.keys());
    }
    return result;
  }

  clear() {
    this._seams.clear();
  }
}

module.exports = { SeamRegistry };
