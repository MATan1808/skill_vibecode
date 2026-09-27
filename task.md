# AIaC Project Checklist

> Checklist phát triển AI Infrastructure as Code (360org). Chỉ đánh dấu hoàn thành khi có kiểm chứng tương ứng.

## Đã hoàn thành và có kiểm chứng

- [x] T1.1 Khởi tạo repo AIaC kế thừa ECC và cô lập tài sản 360org.
- [x] T1.2 Đưa Global `CLAUDE.md` vào root AIaC, giữ lại các rule vận hành/bảo mật đã xây.
- [x] T1.3 Tạo overlay settings và merge idempotent, giữ nguyên fixture model/permissions/skill overrides/hooks.
- [x] T1.4 Chuyển installer sang mô hình không `--delete`, không thay link/skill không thuộc AIaC.
- [x] T1.5 Tạo router nhận diện Odoo, V-Assistant, Flutter, Hermes và OpenClaw.
- [x] T1.6 Chuẩn hóa project-local config: chỉ tạo file thiếu, `settings.local.json` hợp lệ, rule nằm trong `CLAUDE.md`.
- [x] T1.7 Giữ ba capability không trùng: Ponytail (anti-overengineering), Caveman (kỷ luật context), Superpowers (phân rã/kiểm chứng task).
- [x] T1.8 Viết codegraph local import cho JS/TS, Python, Dart; có self-check và Flutter smoke-check.
- [x] T1.9 Giới hạn context router: 3.600 ký tự AIaC, 1.400 ký tự codegraph; không nạp nguyên skill lớn mọi phiên.
- [x] T1.10 Dùng lifecycle ECC hiện hữu cho session summary, observation, instinct, learned skill và token/cost tracking; không tạo hệ nhớ song song.
- [x] T1.11 Thêm quy trình draft skill cục bộ khi chưa có capability; cấm tự cài plugin/MCP/quyền/secret.
- [x] T1.12 Thay auto-pull hard-code bằng fetch + fast-forward chỉ khi repo sạch, có lock và runtime path portable.
- [x] T1.13 Đồng bộ README, REQUIREMENTS, SPEC, ARCH và DEPLOY_GUIDE theo kiến trúc thực tế.
- [x] T1.14 Audit CodeGraph upstream: MIT, local-first SQLite semantic graph/MCP, hỗ trợ Python/Dart/JS/TS; tích hợp độc lập qua namespace `360-codegraph`.
- [x] T1.15 Ghim CodeGraph v1.5.0 checksum, tắt telemetry và cài binary không gọi installer upstream; fixture index/explore và installer pass.

## Đã hoàn thành trong vòng T2

- [x] T2.1 Audit toàn bộ skill/plugin trong `/Volumes/DATA/DEV/SKILLS` bằng `config/capabilities.manifest.json`: nguồn, trigger, overlap ECC, dependency, test, quyết định giữ/gộp/bỏ.
- [x] T2.2 Kiểm thử installer trên `HOME` cô lập, gồm trường hợp `~/.claude/skills` là symlink; không thay đổi máy thật.
- [x] T2.3 Rà soát và thay thế an toàn bypass kiểm tra symlink trong ECC fork; giữ path validation fail-closed và thêm regression test.
- [x] T2.4 Thiết kế MCP catalog secret-free tại `config/mcp/catalog.json`, enable theo project qua `merge-project-mcp.js`, không ghi đè MCP cá nhân; 360-codegraph là fixture đầu tiên.
- [x] T2.5 Kiểm thử SessionStart bằng fixture Claude Code mới: payload, giới hạn context, cache graph, project config và update guard.
- [x] T2.6 Kiểm thử codegraph trên Odoo thật (`/Volumes/DATA/DEV/saas.project`), Flutter thật (`/Volumes/DATA/DEV/MOBILES/VCloud`) và V-Assistant qua worktree riêng.

## Cần thực hiện tiếp

- [x] T2.7 Commit và merge T2 sau khi toàn bộ kiểm thử đích pass.
- [x] T2.8 Thêm `360-agent-map` tự kích hoạt trong SessionStart để tối ưu token và chọn đúng file/symbol trước khi đọc sâu.
- [x] T2.9 Gom WordPress skills vào `360-wordpres/[securities, wp-ui-design, wp-dev]`, đối chiếu `/Volumes/DATA/DEV/SKILLS/wp-dev-skills/` và giữ đủ feature đã dev.
- [ ] T3.1 Kiểm thử CodeGraph MCP bằng Claude Code phiên thật sau khi Sếp muốn bật project-local MCP; hiện đã có catalog/merge fixture nhưng chưa bật global.
