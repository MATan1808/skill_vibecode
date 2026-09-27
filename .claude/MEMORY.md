# Project Memory (GENERIC)

> Bộ nhớ cục bộ theo repo (Local-First Memory). AIaC tự động nạp ưu tiên trước Claude Persistent Memory.

## 1. Project Context
- Loại dự án: generic
- Dấu hiệu: không khớp bộ kỹ năng chuyên biệt
- Package manager/runtime: auto-detect

## 2. Core Decisions & Constraints
- Không commit secret, token, private key vào repo.
- Ưu tiên áp dụng Ponytail: YAGNI -> stdlib -> native -> existing dependency -> minimal diff.

## 3. Session Learnings
- [Init] Khởi tạo bối cảnh dự án.
