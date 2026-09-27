---
name: 360-vcloud
description: Kỹ năng phát triển chính & điều phối kỹ thuật tiêu chuẩn cao nhất cho hệ sinh thái VCloud (Flutter Mobile App) & v_mobile (Odoo Backend API)
metadata:
  origin: 360org
---

# 360-vcloud — Kỹ Năng Phát Triển Chính Hệ Sinh Thái VCloud (`vcloud` & `v_mobile`)

**`360-vcloud`** là **Bộ Kỹ Năng Phát Triển Chính (Primary Dev Skill)** cho toàn bộ hệ sinh thái VCloud. Khi phát triển `v_mobile` hoặc `vcloud`, AI kích hoạt `360-vcloud` làm hạt nhân điều phối, đồng thời tự động triệu gọi các công cụ, plugin và bộ kỹ năng chuyên sâu liên đới với **tiêu chuẩn kỹ thuật cao nhất**.

---

## 🏛️ 1. MA TRẬN ĐIỀU PHỐI & GỌI SKILL/TOOL LIÊN ĐỚI

```text
                                 ┌─────────────────────────────────────────┐
                                 │               360-vcloud                │
                                 │     (Primary Main Development Skill)    │
                                 └────────────────────┬────────────────────┘
                                                      │
                    ┌─────────────────────────────────┴─────────────────────────────────┐
                    ▼                                                                   ▼
  ┌─────────────────────────────────────────┐         ┌─────────────────────────────────────────┐
  │                v_mobile                 │         │                 vcloud                  │
  │           (Backend Odoo API)            │         │          (Frontend Mobile App)          │
  ├─────────────────────────────────────────┤         ├─────────────────────────────────────────┤
  │ 🛠️ Call Skills & Tools Liên đới:        │         │ 🛠️ Call Skills & Tools Liên đới:        │
  │ - `360-odoo` (Odoo Core Standards)      │         │ - `360-flutter` (Mobile App Standards)  │
  │ - `360org/scripts/odoo/odoo_linter.py`  │         │ - Official Flutter/Dart Core Plugins    │
  │ - `odoo_graph_mcp.py` (DB Relations)    │         │ - Apple HIG Guidelines & Design Spec    │
  │ - `360-ponytail` (Root cause & Minimal) │         │ - `360-ponytail` (RAM Cache & Lazy Load)│
  │ - Zero-Downtime 9-Step Kubernetes SaaS  │         │ - CI/CD Pipeline (TestFlight/PlayStore) │
  └─────────────────────────────────────────┘         └─────────────────────────────────────────┘
```

---

## 💎 2. TIÊU CHUẨN KỸ THUẬT CAO NHẤT KHI DEV V_MOBILE & VCLOUD

### 2.1. Tiêu Chuẩn Kỹ Thuật Khi Dev `v_mobile` (Odoo Backend API)
* **Skill liên đới chính**: `360-odoo` + `360-ponytail`.
* **Tiêu chuẩn ORM & Models**:
  - Tuân thủ chuẩn Odoo 17+: Không dùng `attrs=`, dùng `invisible`, `readonly`, `required`.
  - Khai báo ràng buộc qua `models.Constraint()` và chỉ mục `models.Index()`.
* **Tối ưu Hóa Truy Vấn Database**:
  - Nghiêm cấm vòng lặp N+1 queries. Toàn bộ API chat, message, avatar và danh sách kênh bắt buộc dùng **Batch SQL Prefetch `O(1)`** với Index scan `(model, res_id, id DESC)`, đảm bảo SLA phản hồi `< 15ms`.
  - Đếm tin nhắn chưa đọc bằng Single SQL Aggregate.
* **Quy trình Deploy Server**:
  - Bắt buộc thực hiện đúng **9 bước Zero-Downtime Upgrade** trên cụm Kubernetes `saas` (`vuahethong.net`) kèm backup database tự động trước khi nạp schema mới.

### 2.2. Tiêu Chuẩn Kỹ Thuật Khi Dev `vcloud` (Flutter Mobile Client)
* **Skill liên đới chính**: `360-flutter` + `360-ponytail`.
* **Kiến trúc Clean Architecture 3 Lớp**:
  - Phân tách tuyệt đối *Data Layer ➔ Domain Layer ➔ Presentation Layer*.
  - UI Widget tuyệt đối không gọi trực tiếp API client; 100% thông qua Repository và Riverpod Controller.
* **Hiệu Năng & An Toàn Bộ Nhớ**:
  - **SWR RAM Cache First**: Trả dữ liệu tức thì `< 16ms` cho Ticket, Task, Timesheet.
  - **Sequential Smart Polling (2.5s)**: Thay thế toàn bộ Timer đa luồng, triệt tiêu lỗi treo giao diện trên iOS / iPhone 13.
  - **Isolate Parsing**: Đẩy toàn bộ tác vụ decode Base64 và parse JSON nặng vào `compute()`.
  - Bắt buộc kiểm tra `if (!mounted) return;` sau mọi lệnh `await`.
* **Trải Nghiệm Apple HIG & Dark Mode**:
  - Đảm bảo touch target ≥ 44x44pt; chuyển trang trượt ngang chuẩn iOS; Dynamic Dark Theme thích ứng thời gian thực (6h–18h).

---

## 🚦 3. QUY TẮC PHÂN BIỆT LỆNH TRIỂN KHAI CỦA SẾP (BẮT BUỘC)

| Lệnh / Yêu cầu của Sếp | Nền tảng đích | Hành động thực thi |
|---|:---:|---|
| **"Push lên production"**<br>**"Deploy production"**<br>**"Update module server"** | **`v_mobile`**<br>*(Odoo Backend API)* | 1. Thao tác trên repo **`v_mobile`** (nhánh `17.0`).<br>2. Chạy quy trình nâng cấp Odoo Zero-Downtime 9 bước trên máy chủ **`vuahethong.net`** (Kubernetes SaaS). |
| **"Release version mới"**<br>**"Build version mới"**<br>**"Bump build"** | **`vcloud`**<br>*(Flutter Mobile App)* | 1. Thao tác trên repo **`vcloud`** (nhánh `release/ios-appstore`).<br>2. Bump build `pubspec.yaml`, sync docs, push tag `v*` để kích hoạt CI/CD đóng gói **TestFlight iOS & Play Store Android**.<br>3. **Tuyệt đối không đụng vào server Linux/Kubernetes.** |
