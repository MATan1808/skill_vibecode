# Rancher MCP Server & Architecture Reference

## 1. Kiến trúc Hệ Thống Rancher MCP Ecosystem

Hệ sinh thái Rancher quản trị Kubernetes thông qua 3 tầng giao tiếp:
1. **Norman API (`/v3`)**: Management plane quản trị Users, Tokens, Auth Configs, Global Roles, Node Drivers, Catalogs, Settings.
2. **Steve API (`/v1` & `/k8s/clusters/<cluster-id>`)**: Resource aggregator và dynamic Kubernetes proxy.
3. **Fleet GitOps (`fleet.cattle.io`)**: Quản lý GitRepo, BundleDeployment và drift detection đa cụm.

## 2. Rancher MCP Servers

### A. `rancher-mcp-server` (Multi-cluster & Harvester)
- **Repo nguồn**: `/Volumes/DATA/DEV/SKILLS/rancher-mcp-server`
- **Công cụ cung cấp**:
  - `harvester_*`: Quản lý HCI VM, Disk Volumes, Images, Networks, Hosts.
  - `rancher_*`: Quản lý Clusters, Projects, Namespaces, Settings, Auth, Tokens.
  - `k8s_*`: Quản lý CRD, Deployments, StatefulSets, Pods, ConfigMaps, Secrets, Events, Logs.
  - `helm_*`: Liệt kê, cài đặt, upgrade, rollback Helm charts trên các downstream clusters.
  - `fleet_*`: Theo dõi GitRepo, Bundle drift và sync status.

### B. `rancher-ai-mcp` (Rancher Official Toolset)
- **Repo nguồn**: `/Volumes/DATA/DEV/SKILLS/rancher-ai-mcp`
- Cung cấp bridge giao tiếp trực tiếp qua header `Authorization: Bearer <token>` giữa AI agent và Rancher local/downstream clusters.

## 3. Cấu hình Kết nối MCP trong Claude/AIaC

```json
{
  "mcpServers": {
    "rancher": {
      "command": "npx",
      "args": ["-y", "rancher-mcp-server", "--rancher-url=https://<rancher-domain>", "--bearer-token=<token>"],
      "env": {
        "RANCHER_MCP_READ_ONLY": "false"
      }
    }
  }
}
```
