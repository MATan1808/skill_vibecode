'use strict';

/**
 * AIaC Plugin Loader & Context (Everything is a Plugin Engine)
 * Quản lý vòng đời Plugin (Load, Mount, Effect, Teardown, Hot-Reload, Dependency Graph).
 *
 * v3.2.0 Additions:
 * - Dependency Graph Resolution (Topological sort & recursive activation)
 * - File-based Hot-Reloading Watcher (Zero restart required)
 * - Giữ Hot-Reload watcher sau mỗi lần reload, kể cả khi entry mới lỗi
 *
 * ponytail: Quản lý plugin dạng module phẳng, tự động unwind effects khi unload.
 */

const fs = require('fs');
const path = require('path');
const { EventBus } = require('./event-bus');
const { SeamRegistry } = require('./capability-seams');

class PluginContext {
  constructor(loader, pluginName) {
    this.loader = loader;
    this.pluginName = pluginName;
    this.events = loader.events;
    this.seams = loader.seams;
    this._disposers = [];
  }

  /**
   * Đăng ký một side-effect có khả năng tự động cleanup khi plugin unload.
   * @param {Function} effectFn Hàm trả về một disposer function hoặc Promise
   */
  effect(effectFn) {
    try {
      if (typeof effectFn !== 'function') {
        throw new TypeError('effect phải là function');
      }
      const disposer = effectFn();
      if (disposer && typeof disposer.then === 'function') {
        disposer.catch(() => {});
        throw new TypeError('Effect bất đồng bộ chưa được hỗ trợ');
      }
      if (typeof disposer === 'function') {
        this._disposers.push(disposer);
      }
    } catch (err) {
      process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Failed to apply effect in "${this.pluginName}": ${err.message}\n`);
      throw err;
    }
  }

  /**
   * Đăng ký Event Listener gắn liền với vòng đời plugin.
   */
  on(eventName, handler, options) {
    const disposer = this.events.on(eventName, handler, options);
    this._disposers.push(disposer);
    return disposer;
  }

  /**
   * Đăng ký Provider vào Seam gắn liền với vòng đời plugin.
   */
  provide(seamName, providerName, implementation) {
    const disposer = this.seams.registerProvider(seamName, providerName, implementation);
    this._disposers.push(disposer);
    return disposer;
  }

  /**
   * Unwind toàn bộ effects đã đăng ký bởi plugin này.
   */
  dispose() {
    while (this._disposers.length > 0) {
      const disposer = this._disposers.pop();
      try {
        if (typeof disposer === 'function') {
          disposer();
        }
      } catch (err) {
        process.stderr.write(`\x1b[31m[AIaC Disposer Error]\x1b[0m "${this.pluginName}": ${err.message}\n`);
      }
    }
  }
}

class PluginLoader {
  constructor(options = {}) {
    this.pluginsDir = path.resolve(options.pluginsDir || path.join(__dirname, '..', 'plugins'));
    this.events = new EventBus();
    this.seams = new SeamRegistry();
    this.loadedPlugins = new Map(); // name -> { manifest, context, dir }
    this._watchers = new Map(); // name -> fs.FSWatcher
  }

  /**
   * Đọc và parse plugin.json
   */
  loadManifest(pluginDir) {
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Lỗi parse ${manifestPath}: ${err.message}\n`);
      return null;
    }
  }

  /**
   * Giải quyết cây phụ thuộc (Dependency Resolution Graph)
   */
  resolveDependencies(pluginName, visited = new Set(), cyclePath = []) {
    this._pluginDir(pluginName);
    if (visited.has(pluginName)) {
      if (cyclePath.includes(pluginName)) {
        throw new Error(`Cycle dependency detected: ${cyclePath.join(' -> ')} -> ${pluginName}`);
      }
      return [];
    }
    visited.add(pluginName);
    cyclePath.push(pluginName);

    const manifest = this.loadManifest(this._pluginDir(pluginName));
    if (!manifest) {
      cyclePath.pop();
      return [];
    }

    const deps = manifest.dependencies || [];
    if (!Array.isArray(deps) || deps.some(dep => typeof dep !== 'string' || !dep)) {
      throw new TypeError(`Dependencies không hợp lệ cho "${pluginName}"`);
    }
    let resolved = [];

    for (const dep of deps) {
      resolved.push(...this.resolveDependencies(dep, visited, cyclePath));
      resolved.push(dep);
    }

    cyclePath.pop();
    // Loại bỏ duplicates giữ nguyên thứ tự
    return Array.from(new Set(resolved));
  }

  _pluginDir(pluginName) {
    if (typeof pluginName !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(pluginName)) {
      throw new TypeError('Tên plugin không hợp lệ');
    }
    const dir = path.join(this.pluginsDir, pluginName);
    if (fs.existsSync(dir) && !fs.realpathSync(dir).startsWith(`${fs.realpathSync(this.pluginsDir)}${path.sep}`)) {
      throw new TypeError('Plugin nằm ngoài thư mục được phép');
    }
    return dir;
  }

  /**
   * Load một plugin package từ thư mục plugin kèm dependencies.
   * @param {string} pluginName Tên thư mục plugin
   */
  loadPlugin(pluginName) {
    if (this.loadedPlugins.has(pluginName)) {
      return this.loadedPlugins.get(pluginName);
    }

    let pluginDir;
    try {
      pluginDir = this._pluginDir(pluginName);
    } catch (err) {
      process.stderr.write(`\x1b[33m[AIaC Plugin Warning]\x1b[0m ${err.message}\n`);
      return null;
    }
    if (!fs.existsSync(pluginDir)) {
      process.stderr.write(`\x1b[33m[AIaC Plugin Warning]\x1b[0m Không tìm thấy plugin "${pluginName}" tại ${pluginDir}\n`);
      return null;
    }

    const manifest = this.loadManifest(pluginDir);
    if (!manifest) {
      process.stderr.write(`\x1b[33m[AIaC Plugin Warning]\x1b[0m Bỏ qua "${pluginName}" vì thiếu plugin.json hợp lệ.\n`);
      return null;
    }

    // 1. Tự động nạp các plugin phụ thuộc trước (Dependency Resolution)
    let dependencies = [];
    try {
      dependencies = this.resolveDependencies(pluginName);
    } catch (err) {
      process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m ${err.message}\n`);
      return null;
    }

    for (const depName of dependencies) {
      if (depName !== pluginName && !this.loadedPlugins.has(depName)) {
        if (!this.loadPlugin(depName)) {
          process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Không thể load dependency "${depName}" cho "${pluginName}"\n`);
          return null;
        }
      }
    }

    const ctx = new PluginContext(this, pluginName);

    // 2. Tự động load entry script nếu có (index.js hoặc main được khai báo)
    const hasExplicitMain = Object.hasOwn(manifest, 'main');
    if (hasExplicitMain && (typeof manifest.main !== 'string' || !manifest.main)) {
      process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Lỗi thực thi entry script cho "${pluginName}": main không hợp lệ\n`);
      return null;
    }
    const resolvedPluginDir = fs.realpathSync(pluginDir);
    const entryFile = path.resolve(resolvedPluginDir, hasExplicitMain ? manifest.main : 'index.js');
    if (!entryFile.startsWith(`${resolvedPluginDir}${path.sep}`) ||
      (fs.existsSync(entryFile) && !fs.realpathSync(entryFile).startsWith(`${resolvedPluginDir}${path.sep}`))) {
      process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Lỗi thực thi entry script cho "${pluginName}": Entry file nằm ngoài plugin\n`);
      return null;
    }
    if (fs.existsSync(entryFile)) {
      if (!fs.statSync(entryFile).isFile()) {
        process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Lỗi thực thi entry script cho "${pluginName}": Entry file không hợp lệ\n`);
        return null;
      }
      try {
        delete require.cache[require.resolve(entryFile)];
        const pluginModule = require(entryFile);
        let disposer;
        if (typeof pluginModule === 'function') {
          disposer = pluginModule(ctx, manifest.config || {});
        } else if (typeof pluginModule === 'object' && pluginModule !== null) {
          if (typeof pluginModule.activate === 'function') disposer = pluginModule.activate(ctx, manifest.config || {});
          else if (typeof pluginModule.apply === 'function') disposer = pluginModule.apply(ctx, manifest.config || {});
          else throw new TypeError('Entry script phải export function, activate() hoặc apply()');
        } else {
          throw new TypeError('Entry script phải export function, activate() hoặc apply()');
        }
        if (disposer && typeof disposer.then === 'function') {
          disposer.catch(() => {});
          throw new TypeError('Plugin lifecycle bất đồng bộ chưa được hỗ trợ');
        }
        if (typeof disposer === 'function') {
          ctx._disposers.push(disposer);
        }
      } catch (err) {
        ctx.dispose();
        process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Lỗi thực thi entry script cho "${pluginName}": ${err.message}\n`);
        return null;
      }
    } else if (manifest.main) {
       process.stderr.write(`\x1b[31m[AIaC Plugin Error]\x1b[0m Lỗi thực thi entry script cho "${pluginName}": Entry file "${manifest.main}" không tồn tại\n`);
       return null;
    }

    const pluginRecord = {
      name: pluginName,
      manifest,
      context: ctx,
      dir: pluginDir,
    };

    this.loadedPlugins.set(pluginName, pluginRecord);
    this.events.emit('plugin/loaded', pluginRecord);

    return pluginRecord;
  }

  /**
   * Hot-Reloading: Reload một plugin mà không ảnh hưởng tới các plugin khác
   */
  reloadPlugin(pluginName) {
    const wasWatching = this._watchers.has(pluginName);
    if (this.loadedPlugins.has(pluginName)) {
      // 1. Unload sạch sẽ context cũ (chạy toàn bộ disposers)
      this.unloadPlugin(pluginName);
    }

    // 2. Load lại plugin với mã nguồn/cấu hình mới
    const reloaded = this.loadPlugin(pluginName);
    if (wasWatching) this.enableHotReload(pluginName);
    this.events.emit('plugin/reloaded', { name: pluginName, success: !!reloaded });
    return reloaded;
  }

  /**
   * Bật Hot-Reload Watcher cho 1 plugin hoặc tất cả
   */
  enableHotReload(pluginName) {
    if (this._watchers.has(pluginName)) return;

    const pluginDir = path.join(this.pluginsDir, pluginName);
    if (!fs.existsSync(pluginDir)) return;

    try {
      let debounceTimer = null;
      const watcher = fs.watch(pluginDir, { recursive: false }, (eventType, filename) => {
        if (!filename || (!filename.endsWith('.json') && !filename.endsWith('.js'))) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.reloadPlugin(pluginName), 100);
      });

      this._watchers.set(pluginName, watcher);
    } catch (err) {
      process.stderr.write(`\x1b[33m[AIaC Watcher Warning]\x1b[0m Không thể bật watch cho ${pluginName}: ${err.message}\n`);
    }
  }

  /**
   * Unload plugin và hoàn nguyên effects sạch sẽ.
   * @param {string} pluginName
   */
  unloadPlugin(pluginName) {
    const pluginRecord = this.loadedPlugins.get(pluginName);

    // Dừng watcher nếu có, kể cả plugin vừa fail reload.
    if (this._watchers.has(pluginName)) {
      try { this._watchers.get(pluginName).close(); } catch {}
      this._watchers.delete(pluginName);
    }
    if (!pluginRecord) return false;

    pluginRecord.context.dispose();
    this.loadedPlugins.delete(pluginName);
    this.events.emit('plugin/unloaded', { name: pluginName });
    return true;
  }

  /**
   * Liệt kê danh sách tất cả các plugin có sẵn trên đĩa.
   */
  discoverAvailablePlugins() {
    if (!fs.existsSync(this.pluginsDir)) return [];
    try {
      return fs.readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && fs.existsSync(path.join(this.pluginsDir, dirent.name, 'plugin.json')))
        .map(dirent => dirent.name);
    } catch {
      return [];
    }
  }

  /**
   * Unload toàn bộ plugin.
   */
  unloadAll() {
    for (const name of Array.from(this.loadedPlugins.keys())) {
      this.unloadPlugin(name);
    }
  }
}

module.exports = { PluginLoader, PluginContext };
