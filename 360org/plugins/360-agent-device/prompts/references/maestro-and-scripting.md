# Kịch Bản Replay .ad & Tích Hợp Maestro CI/CD (Maestro & Scripting)

> Hướng dẫn đóng gói các bước tương tác thành kịch bản tự động chạy lại nhiều lần (Replay) và xuất sang Maestro YAML để chạy trên CI/CD GitLab.

---

## 1. Ghi Lại Kịch Bản Tương Tác (.ad Script)

Khi Agent thực hiện các thao tác kiểm thử đạt kết quả tốt, Agent có thể lưu lại chuỗi thao tác thành file kịch bản `.ad` (Agent Device Script) để tái sử dụng:

```bash
# Bắt đầu ghi session
agent-device record-script start ./tests/e2e/login_flow.ad

# Thực hiện các bước test...
agent-device open com.example.app --platform ios --foreground
agent-device fill @e1 "user@test.vn" --settle
agent-device fill @e2 "password123" --settle
agent-device press @e3 --settle

# Dừng ghi
agent-device record-script stop
```

---

## 2. Tái Chạy Kịch Bản (Replay)

Bất kỳ lúc nào cần kiểm tra lại lỗi hồi quy (Regression Test):
```bash
agent-device run ./tests/e2e/login_flow.ad
```

---

## 3. Xuất Sang Maestro YAML Cho GitLab CI/CD

`agent-device` hỗ trợ chuyển đổi kịch bản sang định dạng chuẩn Maestro:
```bash
agent-device export maestro ./tests/e2e/login_flow.ad -o ./tests/e2e/maestro_login.yaml
```

File YAML sinh ra có dạng:
```yaml
appId: vn.vcloud.mobile
---
- launchApp
- tapOn: "Tên đăng nhập"
- inputText: "admin@360.org.vn"
- tapOn: "Mật khẩu"
- inputText: "SecretPass"
- tapOn: "Đăng nhập"
- assertVisible: "Bảng điều khiển"
```

Tích hợp vào `.gitlab-ci.yml`:
```yaml
mobile_e2e_test:
  stage: test
  script:
    - maestro test tests/e2e/maestro_login.yaml
```
