# Quản Trị Upgrade Kubernetes Node & Rancher (System Upgrade Controller)

## 1. System Upgrade Controller (SUC)
- **Repo nguồn**: `/Volumes/DATA/DEV/SKILLS/system-upgrade-controller`
- **CRD Cốt Lõi**: `plans.upgrade.cattle.io` (Plan)
- **Cơ Chế Hoạt Động**:
  - Quản lý việc nâng cấp tự động hệ điều hành node (k3s / rke2 / host OS) bằng cách chọn các Nodes thỏa mãn `nodeSelector`.
  - Điều phối nâng cấp tuần tự theo `concurrency` và giới hạn `drain` an toàn.
  - Sau khi Job chạy thành công trên Node, SUC đánh nhãn (label) phiên bản mới lên Node.

## 2. Cấu trúc Khai báo Plan Upgrade Mẫu

```yaml
apiVersion: upgrade.cattle.io/v1
kind: Plan
metadata:
  name: k3s-server-upgrade
  namespace: system-upgrade
spec:
  concurrency: 1
  version: v1.28.11+k3s2
  nodeSelector:
    matchExpressions:
      - {key: node-role.kubernetes.io/master, operator: In, values: ["true"]}
  serviceAccountName: system-upgrade
  cordon: true
  drain:
    force: true
    ignoreDaemonSets: true
    deleteLocalData: true
  upgrade:
    image: rancher/k3s-upgrade
```

## 3. Quy Trình Nâng Cấp Rancher Control Plane (Zero-Downtime)

1. **Backup Rancher Data**:
   - Sử dụng `rancher-backup` operator chụp snapshot lưu trữ offsite trên S3/MinIO.
2. **Upgrade Helm Chart Rancher**:
   ```bash
   helm repo update
   helm upgrade rancher rancher-latest/rancher \
     --namespace cattle-system \
     --set hostname=<rancher-domain> \
     --set bootstrapPassword=<admin-password> \
     --version <new-version>
   ```
3. **Giám sát Rollout Pods**:
   ```bash
   kubectl rollout status deployment/rancher -n cattle-system --timeout=300s
   ```
