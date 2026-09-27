---
name: 360-harness
description: "Kiến trúc Agent Harness chuẩn hoá AIaC 3.0 tổng hợp từ 4 nguồn tinh hoa: DeepSeek-Harness, DeepSeek-Reasonix, Learn-Claude-Code và AutoHarness. Điều phối Agent Loop, Context Management, Resumable Workflow, Memory, Security Sandbox và Cơ chế Tự học / Tự tối ưu hóa Kỹ năng (Self-Learning Skill Layer)."
author: 360 CORP (Sếp Châu)
version: 1.1.0
triggers:
  - "harness"
  - "agent harness"
  - "build harness"
  - "agent loop"
  - "reasonix"
  - "deepseek harness"
  - "learn claude code"
  - "orchestration engine"
  - "autoharness"
  - "tự học skill"
  - "tự tối ưu skill"
  - "learn skill"
  - "distill skill"
  - "consolidate skills"
---

# 360-Harness: Chuẩn Kỹ Thuật Agentic Harness AIaC (AI Infrastructure as Code)

> **Triết lý Cốt lõi**: *"Agency comes from model training. An Agent Product = Model + Harness."*
> - Model là **người lái** (Driver) cung cấp trí tuệ, suy luận và ý định hành động.
> - Harness là **phương tiện** (Vehicle) cung cấp môi trường thực thi, công cụ, quản lý ngữ cảnh, ranh giới bảo mật và cơ chế tự học tiến hoá.

---

## 1. Bản Đồ Tổng Hợp Kiến Trúc 4 Nguồn Tinh Hoa

```
                     ┌──────────────────────────────────────────────────────────┐
                     │                   360-HARNESS ENGINE                     │
                     └────────────────────────────┬─────────────────────────────┘
                                                  │
         ┌──────────────────┬─────────────────────┴───────────────┬──────────────────┐
         │                  │                                     │                  │
         ▼                  ▼                                     ▼                  ▼
┌──────────────────┐┌──────────────────┐                ┌──────────────────┐┌──────────────────┐
│ DeepSeek-Harness ││ DeepSeek-Reasonix│                │ Learn-Claude-Code││   AutoHarness    │
│(Cordis PluginOS) ││ (Go Single Engine│                │  (17-Step Spine) ││  (Self-Learning) │
└────────┬─────────┘└────────┬─────────┘                └────────┬─────────┘└────────┬─────────┘
         │                  │                                     │                  │
         ▼                  ▼                                     ▼                  ▼
• Everything Plugin • ACP v1 Protocol                    • Single Loop Spine• Continuous Learn 
• Capability Seams • Dual-Model Planner/Exec             • Context Compactor• Compare-First
• Monotonic SQLite  • Sandbox Boundary                   • Resumable Flow   • Umbrella Merge
• Wire-protocol     • Subprocess Isolation               • Goal Stop Gate   • Ledger Evidence
```

---

## 2. Mô Hình 8 Trụ Cột Cốt Lõi (8 Pillars of AIaC Harness)

### Trụ cột 1: Agent Loop & Atomic Tools (Vòng lặp & Công cụ Nguyên tử)
- **Cơ chế**: Vòng lặp đơn nhất `Observation ➔ Reasoning ➔ Tool Action ➔ Observation`.
- **Nguyên tắc Tools**: Atomic (đơn nhiệm), composable (dễ ghép nối), typed schema (khai báo JSONSchema chặt chẽ).
- **Quy tắc**: Harness không bọc thêm logic if/else phức tạp thay thế suy luận của model; harness chỉ cung cấp Action Space chuẩn xác.

### Trụ cột 2: Dual-Model Composition (Phối hợp Model Thông minh)
- **Tách biệt vai trò**:
  - **Planner / Reviewer**: Sử dụng Model lý luận sâu (`Claude Sonnet 5`, `DeepSeek-Reasoner`, `Codex`) cho `/req`, `/spec`, `/plan`, `/code-review`, `/review`.
  - **Executor / Builder**: Sử dụng Model thực thi nhanh, cost-effective (`Gemini 2.5 Flash`, `DeepSeek-V3`) cho `/build`, `/test`, `/ship`.
- **Ổn định Cache**: Duy trì session riêng biệt cho Planner và Executor để tối đa hóa Prompt Caching.

### Trụ cột 3: Cache-Aware Context Management & Smart Compaction (Quản lý Ngữ cảnh & Tỉa gọt)
- **3 Tầng Quản lý Ngữ cảnh**:
  1. *Stable Environment Header*: Nạp tóm tắt ngắn gọn môi trường lúc khởi động (`SessionStart`).
  2. *Tool Output Pruner*: Tỉa gọt output bash khổng lồ, log thừa trước khi đẩy vào lịch sử.
  3. *Semantic Compactor*: Nén tóm tắt các turn cũ, bảo toàn 100% toạ độ Code Graph (`file_path:line`), quyết định kiến trúc và file đang sửa.

### Trụ cột 4: Resumable Deterministic Workflows (Quy trình Tiếp tục Tức thì)
- **Orchestration**: Hỗ trợ `pipeline()`, `parallel()`, `agent()`.
- **Journaling**: Ghi log ngữ nghĩa dạng hash `.runtime/<runId>.journal.jsonl`.
- **Resume**: Khi quy trình gián đoạn (timeout, crash, kill), nạp lại `runId` ➔ 100% Cache hit cho các node đã xong (0 token, 0ms latency).

### Trụ cột 5: Multi-Agent Teams & Isolation Worktrees (Đội Ngũ Agent & Worktree Cô Lập)
- **Spawning**: Khởi tạo Subagents giải quyết bài toán độc lập, context tách rời hoàn toàn.
- **Git Worktree**: Khi các agent cần sửa mã song song, cấp phát worktree cô lập tránh xung đột file (`EnterWorktree`).
- **Mailbox Coordination**: Đồng bộ kết quả qua message queue bất đồng bộ.

### Trụ cột 6: Security Sandbox & Trust Boundaries (Hộp Cát & Ranh Giới Tin Cậy)
- **Thứ bậc Quyền**: Local Project (`.claude/settings.local.json`) ➔ Global AIaC Root (`/Volumes/DATA/DEV/aiac`) ➔ IDE Client.
- **DEV Guard**: Chặn tuyệt đối quét lan man ra ngoài workspace được cấp phép trong `permissions.additionalDirectories`.
- **Pre-Git Guard**: Kiểm duyệt secret và bắt buộc cập nhật đồng bộ tài liệu `docs/*` trước khi commit/push.

### Trụ cột 7: Goal Loop Evaluator & Evidence Gates (Cổng Đánh Giá Mục Tiêu)
- **Stop Hook Gate**: Chặn dừng phiên (`Stop`) nếu chưa đạt đủ bằng chứng thực thi:
  1. *Test Evidence*: Bộ test pass 100%.
  2. *Process Evidence*: Exit code = 0.
  3. *Network Evidence*: HTTP 200 OK từ live server/curl test.

### Trụ cột 8: Self-Learning & Auto-Optimizing Skill Engine (AutoHarness)
- **Cơ chế Tự học Tiến hoá (Continuous Experience Distillation)**:
  - Tự động rút ra bài học sau mỗi chuỗi thao tác thực tế hoặc khi người dùng gọi `/learn`.
  - **Compare-First (Sáp nhập trước)**: Không bao giờ sinh micro-skill lẻ tẻ; ưu tiên `patch` hoặc `update` vào Plugin/Reference cùng domain đang có (`360-odoo`, `360-vcloud`, `360-instance-arch`...).
  - **Tách biệt Đề xuất & Xác thực**: Reflector (LLM) chỉ đề xuất Intent; Promoter (Deterministic Gate) kiểm tra format, chống leak secret, kiểm tra cú pháp trước khi ghi nguyên tử (Atomic Commit).
  - **Sáp nhập Ô dù (Umbrella Consolidation - Curator)**: Tự động gom các kỹ năng hẹp về các kỹ năng ô dù cấp lớp (Class-level skills) kèm subfiles `references/` và `scripts/`.
  - **Sổ cái Minh chứng (Ledger)**: Mọi thay đổi kỹ năng đều có lý do (`reason`) và trích dẫn bằng chứng thực tế (`evidence`) từ phiên làm việc.
  - *Chi tiết đầy đủ (CANONICAL)*: Xem [autoharness-self-learning.md](references/autoharness-self-learning.md).

---

## 3. Hướng Dẫn Kích Hoạt & Lệnh Vận Hành

| Lệnh / Thao tác | Chức năng |
|---|---|
| `node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/harness-cli.js init` | Khởi tạo cấu hình Harness chuẩn AIaC cho project |
| `node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/harness-cli.js verify` | Chạy bộ kiểm thử kiểm tra độ tương thích 8 trụ cột |
| `node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/harness-cli.js run <workflow>` | Thực thi Deterministic Workflow với Journaling |
| `node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/harness-cli.js learn` | Kích hoạt AutoHarness chắt lọc bài học từ session |
| `node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/harness-cli.js consolidate` | Rà soát và sáp nhập các kỹ năng hẹp về ô dù chuẩn |
| `node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-skill-learner.js index` | Xem danh mục toàn bộ Plugin & References trong AIaC |
| `node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-skill-learner.js match <kw>` | Dò tìm plugin phù hợp nhất để cập nhật bài học |
