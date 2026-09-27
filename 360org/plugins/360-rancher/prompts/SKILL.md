---
name: 360-rancher
description: |
  MUST be loaded when managing, operating, troubleshooting, or upgrading Rancher clusters,
  Kubernetes workloads on Rancher (context: saas), System Upgrade Controller (SUC),
  Rancher AI MCP / ReAct agents, and zero-downtime rolling upgrades.
  Trigger phrases include: "rancher", "upgrade rancher", "quản trị rancher", "rancher mcp",
  "system upgrade controller", "k8s saas update", "rancher rolling update", "scale pod zero downtime".
metadata:
  type: project
---

# Bộ Kỹ Năng Quản Trị, Upgrade & Vận Hành Rancher K8s SaaS (360-rancher)

> ⚠️ **Scope:** Áp dụng toàn diện cho việc quản trị, vận hành, tích hợp AI MCP và nâng cấp hệ sinh thái **Rancher Multi-Cluster**, **Kubernetes SaaS Cluster (context `saas`)**, **System Upgrade Controller (SUC)**, và **Fleet GitOps**.

---

## 1. Nguyên Tắc Cốt Lõi Zero-Downtime Update (BẮT BUỘC)

*   **TUYỆT ĐỐI KHÔNG TẠO SCRIPT POD / ONE-OFF POD HAY SCALE VỀ 0**: Việc scale về 0 gây ngắt kết nối service và downtime cho khách hàng.
*   **Quy Trình Scale-Up Zero-Downtime (Rancher Scale = 2)**:
    1.  **Scale UP**: Nâng deployment lên `replicas=2` để pod mới được scheduler cấp phát, mount storage và load code/database.
    2.  **Verify Ready**: Đợi pod mới đạt trạng thái `Ready` (`1/1 Running`) thông qua Readiness Probe và `kubectl rollout status`.
    3.  **Scale DOWN**: Sau khi Pod mới đã sẵn sàng nhận traffic 100%, hạ scale về `replicas=1`. Kubernetes sẽ tự động drain và terminate pod cũ an toàn.
*   **Môi trường thực thi**: Tất cả lệnh `kubectl` / `helm` phải được chạy từ iMac local với context tương ứng (`--context saas`). Tuyệt đối không SSH vào node server để chạy lệnh kubectl.

---

## 2. Các Tầng Quản Trị & Công Cụ Tích Hợp

### A. Quản Trị Hệ Thống Qua MCP (AI Agent Integration)
Tận dụng các bộ công cụ trong hệ sinh thái Rancher MCP (`/Volumes/DATA/DEV/SKILLS/`):
*   **`rancher-mcp-server`**: Cung cấp toàn bộ công cụ quản lý Multi-cluster (Steve API), Norman API (`/v3`), Harvester VM/Storage/Network, Helm releases, và Fleet GitOps.
    - Tài liệu chi tiết: `references/rancher-mcp-ecosystem.md`
*   **`rancher-ai-mcp` & `rancher-ai-agent`**: Kiến trúc ReAct Agent phối hợp với LLM reasoning engine để phân tích log, phát hiện sự cố và thực thi tool an toàn qua Rancher API Token.

### B. Quản Trị Nâng Cấp Tự Động Với System Upgrade Controller (SUC)
*   **`system-upgrade-controller`**: Bộ điều khiển Kubernetes-native quản trị việc nâng cấp tự động Node OS, K3s/RKE2 Engine thông qua CRD `Plan` (`upgrade.cattle.io/v1`).
*   Đảm bảo quy trình nâng cấp tuần tự (`concurrency: 1`), tự động `cordon` và `drain` an toàn không làm gián đoạn workload.
    - Tài liệu chi tiết: `references/system-upgrade-controller.md`

---

## 3. Playbook Thao Tác Chuẩn

### Quy Trình 1: Update Workload Ứng Dụng (Zero-Downtime)
Sử dụng script tích hợp sẵn tại `scripts/rancher-rolling-update.sh`:
```bash
/Volumes/DATA/DEV/aiac/360org/skills/360-rancher/scripts/rancher-rolling-update.sh <namespace> <deployment-name> [context]
```
Hoặc chạy lệnh trực tiếp:
```bash
# Bước 1: Scale up lên 2 replicas
kubectl scale deployment <namespace>-deploy-odoo --replicas=2 -n <namespace> --context saas

# Bước 2: Chờ rollout hoàn tất
kubectl rollout status deployment/<namespace>-deploy-odoo -n <namespace> --context saas --timeout=300s

# Bước 3: Scale down về 1 replica
kubectl scale deployment <namespace>-deploy-odoo --replicas=1 -n <namespace> --context saas

# Bước 4: Xác minh 2 bước (Live HTTP 200 + Log check)
curl -I -s https://<domain>/web/login
kubectl logs -n <namespace> -l app=odoo --tail=50 --context saas
```

### Quy Trình 2: Nâng Cấp Phiên Bản Rancher Server (Control Plane)
```bash
# 1. Tạo backup snapshot Rancher
kubectl create -f rancher-backup.yaml -n cattle-system --context saas

# 2. Upgrade Helm Release Rancher
helm repo update
helm upgrade rancher rancher-latest/rancher \
  --namespace cattle-system \
  --set hostname=rancher.360.org.vn \
  --version <target-version> \
  --kube-context saas

# 3. Theo dõi rollout status
kubectl rollout status deployment/rancher -n cattle-system --context saas
```

### Quy Trình 3: Xử Lý Sự Cố & Thu Thập Log Pod Lỗi
```bash
# Lấy danh sách pod lỗi
kubectl get pods -n <namespace> --field-selector=status.phase!=Running --context saas

# Đọc log chi tiết pod
kubectl logs <pod-name> -n <namespace> -c <container-name> --tail=100 --context saas

# Xem sự kiện cluster
kubectl get events -n <namespace> --sort-by='.metadata.creationTimestamp' --context saas
```
