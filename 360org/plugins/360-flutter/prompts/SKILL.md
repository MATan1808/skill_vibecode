---
name: 360-flutter
description: Kỹ năng và quy chuẩn phát triển Flutter Mobile App toàn diện tại 360org. Tích hợp Official Flutter/Dart Plugins (22 skills), Flutter DevTools (Emulator, Widget Preview, Stacktrace Symbolizer, UX Audit Planner), Mobile UI/UX Specs (WCAG 2.2), Apple HIG Guidelines (iOS/macOS) và Clean Architecture.
metadata:
  origin: 360org
---

# 360org — Bộ Kỹ Năng Phát Triển Flutter & Mobile App Toàn Diện (`360-flutter`)

Bộ kỹ năng chuẩn hóa cao nhất cho các ứng dụng di động Flutter thuộc hệ sinh thái **360org**.

---

## 🗺️ Bản Đồ Kiến Trúc Modules

```
360-flutter/
├── official-plugins/     # Official Flutter/Dart Skills (22 skills - chuẩn Upstream)
├── tools-and-devops/     # Công cụ nâng cao (Emulator CLI, Widget Preview, Stacktrace Symbolizer, UX Audit Planner)
├── ui-ux-designer/       # Quy chuẩn Mobile UI/UX Spec, Wireframe ASCII & Accessibility (WCAG 2.2)
├── design-system/        # UI Polish, Micro-interactions & Design System extraction
└── apple-guidelines/     # Chuẩn Apple HIG tối ưu cho Flutter (HIG Designer & HIG Audit Review)
```

---

## 📚 1. Official Flutter/Dart Core Plugins (`official-plugins/`)

*Giữ chuẩn 100% từ Official Flutter Plugins, hỗ trợ cập nhật upstream qua git pull.*

| Nhóm | Thư mục skill | Mô tả ngắn |
|---|---|---|
| **Testing & Mocks** | `dart-add-unit-test`<br>`dart-generate-test-mocks`<br>`dart-collect-coverage`<br>`dart-migrate-to-checks-package`<br>`flutter-add-widget-test`<br>`flutter-add-integration-test` | Viết Unit Test, Widget Test, Integration Test, sinh mock objects với `mockito`/`mocktail`, đo độ bao phủ code coverage. |
| **Dart 3 & Performance** | `dart-use-pattern-matching`<br>`dart-use-primary-constructors`<br>`dart-run-static-analysis`<br>`dart-fix-runtime-errors`<br>`dart-resolve-package-conflicts` | Pattern matching, sealed classes (Dart 3+), sửa lỗi runtime/dependency conflicts, chạy static analysis. |
| **UI, Routing & Data** | `flutter-build-responsive-layout`<br>`flutter-implement-json-serialization`<br>`flutter-setup-declarative-routing`<br>`flutter-setup-localization`<br>`flutter-use-http-package`<br>`flutter-fix-layout-issues` | Cấu hình `go_router`, JSON serialization (`freezed`), đa ngôn ngữ (l10n), sửa lỗi RenderFlex overflow. |
| **Native & FFI** | `dart-setup-ffi-assets`<br>`dart-use-ffigen` | Tích hợp C/C++ native code và tự động tạo bindings qua `ffigen`. |

---

## 🛠️ 2. Flutter Tools & DevOps (`tools-and-devops/`)

- **`android-emulator`**: Quản lý, khởi chạy và điều khiển Android Emulator bằng CLI.
- **`preview-widget`**: Tạo Widget Preview / Golden Snapshot Test nhanh để xem trước UI trong khi dev.
- **`symbolize-android-stacktrace`**: Giải mã (symbolize) native C/C++ & Dart stacktraces từ Android crash logs.
- **`flutter-improve-design`**: Quét mã nguồn Flutter, phát hiện các điểm nghẽn trải nghiệm thực tế (image load pop-in, list view padding, feedback visual...) và lập kế hoạch nâng cấp UI/UX tự động tại `docs/improvements/design/`.

---

## 🎨 3. UI/UX Mobile Design & Accessibility (`ui-ux-designer/`)

- **P0 Content Visibility**: Giữ nội dung quan trọng nhất luôn thấy ngay mà không cần cuộn.
- **Responsive Compact Targets**: Thiết kế chuẩn theo dải màn hình 320pt - 840pt.
- **Accessibility (WCAG 2.2 & Semantics)**: Quy chuẩn touch targets (min 24x24 / 48x48dp), bọc `Semantics`, hỗ trợ TalkBack/VoiceOver.

---

## 💎 4. Design System Polish (`design-system/`)

- **UI Polish & Micro-interactions**: Tối ưu chuyển động (`animate`), tinh chỉnh bố cục (`arrange`), màu sắc (`colorize`), nén bớt chi tiết thừa (`distill`).
- **Design System Extraction**: Trích xuất widgets & design tokens dùng chung thành thư viện (`extract`).

---

## 🍏 5. Apple HIG Guidelines & Design cho Flutter (`apple-guidelines/`)

Tối ưu giao diện Flutter theo chuẩn Apple Human Interface Guidelines (iOS & macOS):

- **`designer/` (Apple HIG Designer)**:
  - Áp dụng 4 trụ cột thiết kế Apple: **Clarity**, **Deference**, **Depth**, **Consistency**.
  - Thiết kế UI chuẩn phong cách iOS/macOS: SF Typography, SF Symbols, translucency & glassmorphism.
- **`review-audit/` (HIG Review & Audit)**:
  - Bộ tiêu chí audit và đánh giá UI/UX Flutter theo chuẩn Apple HIG.

---

## 🚀 Quy Trình Phát Triển 9 Bước (Clean Architecture)

Áp dụng cho mọi dự án Flutter tại 360org:

```
/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship
```

**Clean Architecture 3 Lớp:**
1. **Data**: Datasources, API, Models (DTOs), Repositories Implementation.
2. **Domain**: Entities, Repository Interfaces, Use Cases.
3. **Presentation**: UI (Widgets, Pages), State Management (Riverpod / BLoC).

**7 Tài Liệu Kỹ Thuật Bắt Buộc & Pre-Push Trigger:**
- Bắt buộc duy trì 7 tài liệu: `IDEA.md`, `REQUIREMENTS.md`, `SPEC.md`, `ARCH.md`, `README.md`, `DEPLOY_GUIDE.md`, `CHANGELOGS.md`.
- **⚡ Pre-Push & Pre-Commit Docs Sync (BẮT BUỘC)**: Trước BẤT KỲ commit/push nào lên remote (GitLab/GitHub), AI phải tự động rà soát và cập nhật đồng bộ toàn bộ tài liệu `*.md` để phản ánh chính xác các widget, usecase, API entity và bug fix mới.

**Quy tắc an toàn mã nguồn & Phân định Ranh giới Hệ thống (BẮT BUỘC):**
- **Phân định Ranh giới Repo Mobile vs Backend Odoo**: 
  * `vcloud` (`vclients`): Dự án **Flutter Mobile App (Client-side)**. Đóng gói IPA/AAB lên TestFlight/App Store/Play Store qua CI/CD. **TUYỆT ĐỐI KHÔNG deploy lên server Linux/Kubernetes**.
  * `v_mobile`: Module **Backend Odoo (Python API)** chạy trên server Odoo (`vuahethong.net`). Cung cấp REST endpoints cho Mobile kết nối.
  * Nghiêm cấm tuyệt đối việc nhầm lẫn giữa 2 repo, không tự ý SSH hay deploy backend khi đang ở phiên làm việc của Mobile App.
- Bắt buộc kiểm tra `if (!mounted) return;` sau các thao tác `await`.
- Propagation từ khóa `const` để tránh rebuild widget không cần thiết.
- Chạy `flutter analyze` & `flutter test` trước mỗi commit.
