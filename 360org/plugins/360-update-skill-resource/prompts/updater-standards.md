# Updater Standards

1. Upstream chỉ dùng để tham chiếu và phát hiện delta mới.
2. Chỉ pull repository sạch bằng fast-forward; không reset, stash hoặc force.
3. Mọi plugin AIaC nâng cấp thủ công sau compatibility/security audit.
4. Runtime chỉ được tham chiếu `360org/plugins/*`, không phụ thuộc kho nguồn ngoài AIaC.
5. Không copy/rsync nguyên upstream, không tự cài dependency/MCP/plugin/permission.
6. Viết audit trong `docs/` trước thay đổi; cập nhật provenance, test, version và changelog sau verification.
7. Không tự commit hoặc push.
