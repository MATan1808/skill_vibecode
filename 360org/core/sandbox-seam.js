'use strict';

/**
 * AIaC Remote & Multi-Host Sandbox Seam (v3.1.0)
 * Triển khai Tam giác Tính năng cho môi trường thực thi (Execution Sandbox):
 * 1. Service Definition: SandboxService interface (exec, testConnection)
 * 2. Service Providers:
 *    - LocalSubprocessProvider: Thực thi tiến trình cục bộ (macOS/Darwin)
 *    - SshRemoteProvider: Thực thi cô lập từ xa qua SSH (hỗ trợ alias 'local', 'vuahethong', 'cloudpanel')
 *    - K8sPodRemoteProvider: Thực thi lệnh trực tiếp trong Pod Kubernetes qua kubectl context 'saas'
 * 3. Smart Sandbox Dispatcher: Tự động phân loại Workspace/Context để định tuyến lệnh tới đúng Provider.
 *
 * ponytail: Zero external dependency, dùng trực tiếp ssh và kubectl CLI có sẵn.
 */

const { spawn } = require('child_process');

class LocalSubprocessProvider {
  constructor(options = {}) {
    this.name = options.name || 'local-subprocess';
    this.type = 'local';
    this.cwd = options.cwd || process.cwd();
  }

  async exec(command, options = {}) {
    const cwd = options.cwd || this.cwd;
    const timeout = options.timeout || 30_000;
    const env = { ...process.env, ...(options.env || {}) };

    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', command], { cwd, env, timeout });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        resolve({
          exitCode: code ?? 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          provider: this.name,
          hostType: 'local'
        });
      });

      proc.on('error', (err) => {
        resolve({
          exitCode: 1,
          stdout: stdout.trim(),
          stderr: err.message,
          provider: this.name,
          hostType: 'local'
        });
      });
    });
  }
}

class SshRemoteProvider {
  constructor(options = {}) {
    this.hostAlias = options.hostAlias || 'local'; // SSH host alias trong ~/.ssh/config: 'local', 'vuahethong', 'cloudpanel'
    this.name = options.name || `ssh-${this.hostAlias}`;
    this.type = 'ssh';
    this.remoteCwd = options.remoteCwd || '/tmp';
  }

  async exec(command, options = {}) {
    const host = options.hostAlias || this.hostAlias;
    const timeout = options.timeout || 30_000;
    const workingDir = options.cwd || this.remoteCwd;

    // Bọc lệnh thực thi trong remote working directory
    const wrappedCommand = `cd "${workingDir}" 2>/dev/null || true; ${command}`;
    const sshArgs = [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=5',
      host,
      wrappedCommand
    ];

    return new Promise((resolve) => {
      const proc = spawn('ssh', sshArgs, { timeout });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        resolve({
          exitCode: code ?? 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          provider: this.name,
          hostAlias: host,
          hostType: 'ssh'
        });
      });

      proc.on('error', (err) => {
        resolve({
          exitCode: 1,
          stdout: stdout.trim(),
          stderr: err.message,
          provider: this.name,
          hostAlias: host,
          hostType: 'ssh'
        });
      });
    });
  }
}

class K8sPodRemoteProvider {
  constructor(options = {}) {
    this.name = options.name || 'k8s-pod-saas';
    this.type = 'k8s';
    this.context = options.context || 'saas';
    this.namespace = options.namespace || 'default';
    this.podSelector = options.podSelector || 'app=odoo';
  }

  async exec(command, options = {}) {
    const context = options.context || this.context;
    const namespace = options.namespace || this.namespace;
    const timeout = options.timeout || 45_000;

    // Chạy kubectl exec trực tiếp từ máy local với context chỉ định
    const kubectlArgs = [
      '--context', context,
      '-n', namespace,
      'exec',
      options.podName || `deployment/${options.deploymentName || `${namespace}-deploy-odoo`}`,
      '--',
      'sh', '-c', command
    ];

    return new Promise((resolve) => {
      const proc = spawn('kubectl', kubectlArgs, { timeout });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        resolve({
          exitCode: code ?? 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          provider: this.name,
          k8sContext: context,
          namespace: namespace,
          hostType: 'k8s'
        });
      });

      proc.on('error', (err) => {
        resolve({
          exitCode: 1,
          stdout: stdout.trim(),
          stderr: err.message,
          provider: this.name,
          hostType: 'k8s'
        });
      });
    });
  }
}

/**
 * Smart Sandbox Dispatcher: Tự động phát hiện loại workspace và định tuyến tới Provider phù hợp
 */
class SandboxDispatcher {
  constructor(seamRegistry) {
    this.seams = seamRegistry;
    this.defaultProvider = 'local-subprocess';
  }

  resolveProviderForContext(contextInfo = {}) {
    const { workspaceType, serverAlias, namespace } = contextInfo;

    if (serverAlias) {
      const aliasProvider = `ssh-${serverAlias}`;
      if (this.seams.getProvider('sandbox', aliasProvider)) {
        return this.seams.getProvider('sandbox', aliasProvider);
      }
    }

    if (workspaceType === 'ODOO_SAAS' || namespace) {
      return this.seams.getProvider('sandbox', 'k8s-pod-saas') || this.seams.getProvider('sandbox', 'ssh-vuahethong');
    }

    if (workspaceType === 'WORDPRESS' || workspaceType === 'PAYLOAD_CMS' || workspaceType === 'HERMES') {
      return this.seams.getProvider('sandbox', 'ssh-cloudpanel') || this.seams.getProvider('sandbox', 'ssh-local');
    }

    return this.seams.getProvider('sandbox', this.defaultProvider) || new LocalSubprocessProvider();
  }
}

module.exports = {
  LocalSubprocessProvider,
  SshRemoteProvider,
  K8sPodRemoteProvider,
  SandboxDispatcher
};
