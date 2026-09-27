# Quy Chuẩn Đồng Bộ Update Toàn Diện AIaC (AIaC Holistic Update & Sync Standard)

> Quản lý tập trung bởi **AIaC (AI Infrastructure as Code)** — 360 CORP.

Quy định cứng: **"Update là phải đồng bộ toàn diện, zero-drift, không để sót bất kỳ điểm neo nào"**. Bất kỳ thao tác nâng cấp lõi, thêm plugin/skill, hoặc bump version nào của AIaC đều bắt buộc tuân thủ quy chuẩn này.

---

## 1. Bản Đồ 6 Điểm Đồng Bộ Bắt Buộc (Mandatory 6-Point Matrix)

Mỗi lần update hoặc release phiên bản mới (`v<x>.<y>.<z>`), toàn bộ hệ thống phải đồng bộ 100% qua 6 điểm then chốt:

```text
[1. File Version Core] ───► [2. Scripts Version Sync (sync-version.js)]
         │
         ▼
[3. Telemetry Engine & Dashboard (AIaC Performance Pro)]
         │
         ▼
[4. Catalog & Publish Manifests (package.json files[], agent.yaml)]
         │
         ▼
[5. Docs & Changelogs (docs/CHANGELOGS.md, README.md, DEPLOY_GUIDE.md)]
         │
         ▼
[6. Git Attribution & Clean Release Tag (GitLab origin, v<version>)]
```

### Chi tiết 6 điểm:

1. **File Version Core**:
   - `VERSION`, `package.json`, `package-lock.json`, `.opencode/package.json`, `.opencode/package-lock.json`.
   - Bắt buộc chạy script tự động: `node scripts/aiac/sync-version.js`.

2. **Telemetry Engine & Enterprise Dashboard (AIaC Performance Pro — Port 3600)**:
   - **Dynamic Version**: Bắt buộc dùng `getCurrentVersion()` đọc động trực tiếp từ `/Volumes/DATA/DEV/aiac/VERSION` với cache TTL ngắn. Tuyệt đối không hardcode chuỗi version tĩnh.
   - **Comprehensive Discovery**: Tự động nhận diện 100% Core Plugins (`360org/plugins/*`) và System Skills (`skills/*`). Không được để sót kỹ năng mới thêm.
   - **Context Capacity Rules**: Luôn cập nhật phân loại dung lượng context cho các AI models thế hệ mới (Claude 5, Gemini 2.5/3.8, Antigravity, GPT-5...).
   - **Daemon Process Management**: Khởi động qua hook với `cwd: aiacDir` tường minh và reload tiến trình nền trên port 3600 sau khi update core.

3. **Everything Is A Plugin Harness**:
   - Mọi chuẩn kỹ thuật, skill, hook mới đều đóng gói dưới `360org/plugins/<plugin-name>/`.
   - Tuyệt đối không tạo file rời trôi nổi trong `.claude/skills/*` làm source of truth.

4. **Surface & Manifest Alignment**:
   - Khi thêm plugin/skill mới, bắt buộc cập nhật danh mục export trong `agent.yaml`, `package.json` (`files[]`), và catalog CI.
   - Chạy kiểm tra: `npm run catalog:check` và `npm run command-registry:check`.

5. **Tài Liệu Chi Tiết (Docs Synchronization)**:
   - Cập nhật `docs/CHANGELOGS.md` ghi rõ phiên bản, ngày `(YYYY-MM-DD)` và các tag chuẩn (`[NEW]`, `[FIX]`, `[IMPROVE]`, `[SECURITY]`, `[REFACTOR]`).
   - Cập nhật `README.md`, `docs/DEPLOY_GUIDE.md` nếu có thay đổi hành vi hoặc cấu hình.

6. **Git Commit Chuẩn & Release Tagging**:
   - Commit với thông điệp rõ ràng theo Conventional Commits: `feat(...)`, `fix(...)`, `chore: release ...`.
   - Bắt buộc kèm trailer chuẩn: `Authored-By: 360org <support@360.org.vn>`.
   - Đẩy lên remote GitLab (`origin main`). Khi Sếp duyệt release, tạo git tag `v<version>` và push tag.

---

## 2. Checklist Tự Kiểm Tra Trước Khi Báo Cáo (Pre-Delivery Checklist)

- [ ] Đã chạy `node scripts/aiac/sync-version.js` (0 version drift).
- [ ] Đã kiểm tra Telemetry API: `curl -s http://localhost:3600/api/telemetry | jq .version`.
- [ ] Số lượng plugins & skills trong Telemetry phản ánh đủ 100% kho kỹ năng hiện có.
- [ ] Test suite hoặc assert-based check pass 100%.
- [ ] `git status` sạch, không để lại file rác (`.pyc`, `.tmp`, cache thừa).
