# Multi-Host Execution Sandbox & Smart Dispatcher

> Hướng dẫn cấu hình và thực thi lệnh qua hệ thống Capability Sandbox Seam trong AIaC v3.x.

---

## 1. Các Nhà cung cấp Sandbox (Execution Providers)

AIaC v3.x trừu tượng hóa toàn bộ môi trường chạy lệnh qua các Seam Provider:

| Provider | Loại | Mục đích & Ngữ cảnh |
|---|---|---|
| **`LocalSubprocessProvider`** | `local` | Chạy lệnh subprocess trực tiếp trên máy local (macOS/Linux). |
| **`SshRemoteProvider`** | `ssh` | Kết nối & chạy lệnh từ xa qua SSH alias cấu hình trong `~/.ssh/config` (`local` - `root@360-Corp`, `vuahethong`, `cloudpanel`). |
| **`K8sPodRemoteProvider`** | `k8s` | Chạy lệnh trực tiếp trong Pod Kubernetes (cluster `saas`) qua `kubectl exec`. |

---

## 2. Smart Sandbox Dispatcher

`SandboxDispatcher` tự động phân tích ngữ cảnh dự án (dựa trên workspace, config hoặc cờ tham số) để định tuyến lệnh tới đúng Provider:

```javascript
const { SeamRegistry } = require('../core/capability-seams');
const { SshRemoteProvider, K8sPodRemoteProvider, SandboxDispatcher } = require('../core/sandbox-seam');

const seams = new SeamRegistry();
const dispatcher = new SandboxDispatcher(seams);

// Ví dụ định tuyến tự động
const provider = dispatcher.resolveProviderForContext({
  type: 'odoo-saas',
  namespace: 'davita'
});

const result = await provider.exec('sh /var/lib/odoo/manual_backup.sh');
console.log(result.stdout);
```

---

## 3. Quy chuẩn An toàn Thực thi

1. **SSH BatchMode**: Mọi lệnh SSH đều chạy với flag `-o BatchMode=yes -o ConnectTimeout=5` để không treo tiến trình nếu mất kết nối hoặc sai key.
2. **Kubernetes Context**: Lệnh `kubectl` luôn được ghim context `--context saas` để chống thực thi nhầm cluster.
3. **Database Backup**: Luôn thực hiện backup DB trước mọi thao tác cập nhật trên server production `vuahethong`.
