#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
odoo_doctor.py — Auto-fix bug Odoo AN TOÀN, có cổng duyệt.

Input 2 dạng:
  (a) paste lỗi/log/traceback  →  --log <file> | --log-text "..." | stdin
  (b) cấp quyền DB (read-only)  →  --db <name> [--db-host --db-user] (introspect)

Quy trình (bám systematic-debugging 4-pha, xem references/debugging-and-bugfixing.md):
  parse traceback → định vị + phân loại → RCA → IN RCA REPORT + LỆNH BACKUP bắt buộc
  → DỪNG ở cổng chờ PO duyệt. KHÔNG tự ghi thẳng vào production.

Sau khi PO duyệt: agent áp bản vá BẰNG CODE CUSTOM (_inherit/OWL patch, không đụng
core, không sửa field/DB/UI tay), test trên bản restore, rồi mới đề xuất áp prod.

Chỉ stdlib, Python 3.9+. `python odoo_doctor.py --self-check` để kiểm logic thuần.
"""
from __future__ import annotations

import argparse
import re
import sys

C_RED = "\033[91m"; C_GREEN = "\033[92m"; C_YELLOW = "\033[93m"; C_CYAN = "\033[96m"; C_RESET = "\033[0m"

# Phân loại exception → giả thuyết root cause + hướng xử lý Odoo.
ERROR_HINTS = {
    "AccessError": ("Phân quyền: user thiếu quyền / record rule chặn.",
                    "Kiểm ACL (ir.model.access.csv) + ir.rule. VẼ SƠ ĐỒ MERMAID phân quyền, xin PO duyệt trước khi sửa."),
    "ValidationError": ("Ràng buộc nghiệp vụ (@api.constrains) hoặc SQL constraint bị vi phạm.",
                        "Truy hàm constrains liên quan; sửa dữ liệu đầu vào hoặc nới constraint đúng nghiệp vụ."),
    "UserError": ("Chặn nghiệp vụ chủ động từ code.", "Đọc thông điệp; truy nơi raise; xử lý theo luồng nghiệp vụ."),
    "AttributeError": ("Truy cập field/None không tồn tại (thường field rỗng = False).",
                       "Thêm null-guard đúng chỗ; kiểm field có tồn tại ở version này không."),
    "KeyError": ("Thiếu key trong dict/context/env.", "Kiểm nguồn dict; dùng .get() có default; kiểm context truyền vào."),
    "ValueError": ("Ép kiểu / selection / domain sai.", "Kiểm giá trị đầu vào & định dạng; kiểm selection field."),
    "ProgrammingError": ("Lỗi SQL (cột thiếu, kiểu sai) — hay gặp sau nâng version chưa migrate.",
                         "Kiểm schema vs model; nếu do version → cần migration script (odoo_migrate.py)."),
    "IntegrityError": ("Vi phạm ràng buộc DB (unique/foreign key/not null).",
                       "Truy dữ liệu vi phạm; sửa qua migration/constraint, KHÔNG sửa field tay."),
    "MissingError": ("Record đã bị xoá/không tồn tại (unlink rồi vẫn dùng).",
                     "Kiểm vòng đời record; guard exists() trước khi thao tác."),
}


def log(m): print(f"{C_CYAN}[doctor]{C_RESET} {m}")
def warn(m): print(f"  {C_YELLOW}[!]{C_RESET} {m}")


# --------------------------------------------------------------------------- #
# CORE LOGIC THUẦN (test được qua --self-check)
# --------------------------------------------------------------------------- #
def parse_traceback(text):
    """Trích exception + vị trí custom-code sâu nhất + module hint từ traceback Odoo."""
    info = {"exception": None, "message": None, "file": None, "line": None, "func": None, "module": None}
    if not text:
        return info

    # Dòng exception cuối: 'SomeError: message'
    exc_matches = re.findall(r"^([A-Za-z_][\w.]*Error|[A-Za-z_]*Warning):\s?(.*)$", text, re.MULTILINE)
    if exc_matches:
        exc, msg = exc_matches[-1]
        info["exception"] = exc.split(".")[-1]
        info["message"] = msg.strip()

    # Mọi frame 'File "...", line N, in func'. Ưu tiên frame trong custom addons.
    frames = re.findall(r'File "([^"]+)", line (\d+), in (\S+)', text)
    if frames:
        custom = [f for f in frames if re.search(r"(extra-addons|custom|addons)/", f[0])
                  and "/odoo/addons/" not in f[0] and "/base/" not in f[0]]
        chosen = custom[-1] if custom else frames[-1]
        info["file"], info["line"], info["func"] = chosen[0], int(chosen[1]), chosen[2]
        m = re.search(r"(?:extra-addons|custom|addons)/([^/]+)/", chosen[0]) \
            or re.search(r"odoo\.addons\.([^.\s]+)", text)
        if m:
            info["module"] = m.group(1)
    return info


def classify(exception, message):
    """→ (giả thuyết root cause, hướng xử lý)."""
    base = ERROR_HINTS.get(exception, ("Chưa phân loại tự động.", "Điều tra thủ công theo 4-pha systematic-debugging."))
    return base


def is_access_related(exception, message):
    if exception in ("AccessError",):
        return True
    return bool(message and re.search(r"access|permission|not allowed|record rule|ir\.rule", message, re.I))


def is_schema_related(exception, message):
    """Lỗi hay do nâng version chưa migrate → gợi ý dùng odoo_migrate.py."""
    if exception in ("ProgrammingError", "IntegrityError"):
        return True
    return bool(message and re.search(r"column .* does not exist|relation .* does not exist", message, re.I))


def backup_command(db, client="[client-name]", container="[db_container]"):
    """Lệnh backup CHUẨN (mẫu đang dùng, SSH alias vuahethong). Bắt buộc chạy trước khi vá."""
    path = f"/home/instances/{client}/data/db_backup"
    return (f'ssh vuahethong "mkdir -p {path} && docker exec -t {container} '
            f'pg_dump -U odoo {db} -F c -b -f {path}/{db}_before_fix_$(date +%Y%m%d_%H%M%S).dump"')


def render_rca_report(info, db=None):
    exc = info.get("exception") or "?"
    msg = info.get("message") or ""
    cause, action = classify(exc, msg)
    loc = f'{info.get("file")}:{info.get("line")} (in {info.get("func")})' if info.get("file") else "chưa định vị"
    lines = [
        "# RCA REPORT — Bug Odoo",
        "",
        "## 1. Triệu chứng",
        f"- **Exception:** `{exc}`",
        f"- **Message:** {msg or '(trống)'}",
        f"- **Vị trí (custom code sâu nhất):** `{loc}`",
        f"- **Module nghi vấn:** `{info.get('module') or '?'}`",
        "",
        "## 2. Giả thuyết Root Cause (pha 2 — systematic-debugging)",
        f"- {cause}",
        f"- **Hướng xử lý:** {action}",
    ]
    if is_access_related(exc, msg):
        lines += [
            "",
            "## 2b. ⚠️ Liên quan PHÂN QUYỀN — bắt buộc sơ đồ Mermaid ACL",
            "> Vẽ sơ đồ groups → ir.model.access → ir.rule liên quan, trình PO duyệt TRƯỚC khi sửa.",
            "",
            "```mermaid",
            "graph LR",
            "  U[User groups] --> ACL[ir.model.access.csv]",
            "  ACL --> M[(Model bị chặn)]",
            "  R[ir.rule record rule] --> M",
            "```",
        ]
    if is_schema_related(exc, msg):
        lines += [
            "",
            "## 2c. ⚠️ Nghi do NÂNG VERSION chưa migrate schema",
            "> Nếu lỗi cột/bảng thiếu sau khi đổi version → không phải bug code, cần migration script. "
            "Chuyển sang `odoo_migrate.py` (xem references/migration-and-upgrade.md).",
        ]
    lines += [
        "",
        "## 3. CỔNG AN TOÀN (bắt buộc, không được bỏ qua)",
        "- [ ] **Backup DB trước khi vá** (chạy lệnh dưới, sửa `[client-name]`/`[db_container]`):",
        "",
        "```bash",
        backup_command(db or "[db_name]"),
        "```",
        "- [ ] Trình RCA report này cho **PO duyệt** phương án vá.",
        "",
        "## 4. Phương án vá đề xuất (áp dụng 3 Nguyên tắc Vàng)",
        "- Sửa **bằng code custom** (`_inherit`/`_inherits` hoặc OWL patch), KHÔNG sửa field/DB/UI tay.",
        "- KHÔNG chạm Odoo Core.",
        "- Viết **test tái hiện** lỗi (RED) trước, sửa, chạy PASS (GREEN), test trên **bản restore copy**.",
        "- Commit qua git; trace log runtime sau khi restart; chờ PO xác nhận đã fixed.",
        "",
        f"> Trạng thái: **CHỜ PO DUYỆT** — chưa áp bất kỳ thay đổi nào lên production.",
        "",
    ]
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
def self_check():
    tb = (
        'Traceback (most recent call last):\n'
        '  File "/odoo/addons/base/models/ir_http.py", line 237, in _dispatch\n'
        '    result = endpoint(**request.params)\n'
        '  File "/mnt/extra-addons/acme_sale/models/sale_order.py", line 88, in action_confirm\n'
        '    partner = self.partner_id.commercial_partner_id.vat.upper()\n'
        "AttributeError: 'bool' object has no attribute 'upper'\n"
    )
    info = parse_traceback(tb)
    assert info["exception"] == "AttributeError", info
    assert info["file"].endswith("acme_sale/models/sale_order.py"), info
    assert info["line"] == 88 and info["func"] == "action_confirm", info
    assert info["module"] == "acme_sale", info

    acc = parse_traceback('odoo.exceptions.AccessError: You are not allowed to access\n'
                          'AccessError: You are not allowed to access this document')
    assert is_access_related(acc["exception"], acc["message"])

    assert is_schema_related("ProgrammingError", 'column "x_new" does not exist')
    assert not is_schema_related("AttributeError", "nope")

    rep = render_rca_report(info, db="acme")
    assert "RCA REPORT" in rep and "CHỜ PO DUYỆT" in rep and "before_fix" in rep
    assert "acme_sale" in rep

    rep_acl = render_rca_report(acc, db="acme")
    assert "mermaid" in rep_acl and "ir.rule" in rep_acl, "AccessError phải kèm sơ đồ ACL"

    print(f"{C_GREEN}self-check PASS{C_RESET} (parse/classify/access/schema/report-gate)")
    return True


def _read_input(args):
    if args.log_text:
        return args.log_text
    if args.log:
        with open(args.log, encoding="utf-8", errors="ignore") as f:
            return f.read()
    if not sys.stdin.isatty():
        return sys.stdin.read()
    return None


def main():
    ap = argparse.ArgumentParser(description="Auto-fix bug Odoo an toàn (có cổng duyệt)")
    ap.add_argument("--log", help="File log/traceback")
    ap.add_argument("--log-text", help="Nội dung lỗi truyền trực tiếp")
    ap.add_argument("--db", help="Tên DB (để in lệnh backup đúng)")
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args()

    if args.self_check:
        sys.exit(0 if self_check() else 1)

    text = _read_input(args)
    if not text:
        warn("Chưa có input. Truyền --log <file>, --log-text \"...\", hoặc pipe log qua stdin.")
        ap.print_help()
        sys.exit(1)

    info = parse_traceback(text)
    if not info["exception"]:
        warn("Không parse được exception rõ ràng. Đây có thể là log runtime dài — "
             "trích đoạn traceback (phần 'Traceback ... Error: ...') rồi chạy lại.")
    print(render_rca_report(info, db=args.db))
    log("Trạng thái: CHỜ PO DUYỆT. Backup trước, duyệt phương án, rồi mới vá bằng code custom.")


if __name__ == "__main__":
    main()
